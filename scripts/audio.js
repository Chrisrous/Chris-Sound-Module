import { message, validVolume } from "./shared.js";

const CANCELLED = Symbol("cancelled");
export const START_TIMEOUT = 60000;
export const validFade = value => Number.isFinite(value) && value >= 0 && value <= 30000;

/** Owns only sounds created by this module. Preview uses a separate instance. */
export class SoundPlayback {
  constructor(getAudio = () => game.audio, getPreferences = () => ({ factor: 1, muted: false }), timeout = START_TIMEOUT) {
    this.getAudio = getAudio;
    this.getPreferences = getPreferences;
    this.timeout = timeout;
    this.current = null;
    this.states = new Set();
  }

  preferences() {
    const value = this.getPreferences();
    return { factor: validVolume(value?.factor) ? value.factor : 1, muted: value?.muted === true };
  }

  level(state) {
    const { factor, muted } = this.preferences();
    return muted ? 0 : state.volume * factor;
  }

  status(state, status, code = "") {
    // Callback failures must never interrupt audio cleanup.
    try { state.notify(status, { ...this.preferences(), code }); }
    catch (error) { console.error("Chris Sound Module | Status callback", error); }
  }

  async cancel(state, status = "cancelled", fade = 0) {
    if (!state.cancelled) {
      state.cancelled = true;
      clearTimeout(state.timer);
      state.abort(CANCELLED);
      if (this.current === state) this.current = null;
      this.status(state, status);
    }
    // Keep fading instances owned until they actually stop, so Panic can interrupt them.
    try {
      if (state.sound && (state.sound.playing || state.started)) {
        // A native STOPPING state need not expose playing=true. Silence it explicitly.
        if (fade === 0) await state.sound.fade(0, { duration: 0 });
        await state.sound.stop({ fade });
      }
    } finally { this.states.delete(state); }
  }

  async wait(state, task) {
    const result = await Promise.race([task, state.cancelPromise]);
    if (result === CANCELLED || state.cancelled) throw CANCELLED;
    return result;
  }

  async play(data, notify = () => {}) {
    const previous = [...this.states];
    const state = { sound: null, volume: data.volume, data, notify, cancelled: false };
    state.cancelPromise = new Promise(resolve => { state.abort = resolve; });
    this.current = state;
    this.states.add(state);
    state.timer = setTimeout(() => {
      this.status(state, "error", "startTimeout");
      void this.cancel(state, "error").catch(console.error);
    }, this.timeout);
    state.timer.unref?.();
    try {
      // Sequential transitions: fade the old sound out before fading the new one in.
      await this.wait(state, Promise.all(previous.map(old => this.cancel(old, "cancelled", old.data.fadeOut ?? 0))));
      const audio = this.getAudio();
      if (audio.locked) this.status(state, "waitingAudio");
      await this.wait(state, audio.unlock);
      this.status(state, "loading");
      const sound = audio.create({ src: data.src, context: audio[data.channel], singleton: false, preload: false, autoplay: false });
      state.sound = sound;
      await this.wait(state, sound.load({ autoplay: false }));
      if (sound.failed) throw new Error(message("Messages.PlaybackFailed"));
      const startingLevel = this.level(state);
      const startingVolume = state.volume;
      const startingPrefs = JSON.stringify(this.preferences());
      const starting = sound.play({
        volume: startingLevel, loop: data.loop, fade: data.fadeIn ?? 0,
        onended: () => {
          if (state.cancelled) return;
          state.ended = true;
          clearTimeout(state.timer);
          this.states.delete(state);
          if (this.current === state) this.current = null;
          this.status(state, "ended");
        }
      });
      // An already-starting native sound can finish after cancellation. Silence it then too.
      void starting.then(async () => {
        state.started = true;
        if (state.cancelled) { await sound.fade(0, { duration: 0 }); await sound.stop({ fade: 0 }); }
      }).catch(console.error);
      await this.wait(state, starting);
      clearTimeout(state.timer);
      if (startingVolume !== state.volume || startingPrefs !== JSON.stringify(this.preferences())) {
        await sound.fade(this.level(state), { duration: 0 });
      }
      if (state.cancelled) return false;
      if (state.ended) return true;
      this.status(state, "playing");
      return true;
    } catch (error) {
      if (error === CANCELLED || state.cancelled) return false;
      this.status(state, "error", "playbackFailed");
      await this.cancel(state, "error").catch(console.error);
      throw error;
    }
  }

  async stop({ immediate = false } = {}) {
    await Promise.all([...this.states].map(state => this.cancel(state, "stopped", immediate ? 0 : (state.data.fadeOut ?? 0))));
    return true;
  }

  async setVolume(volume) {
    if (!validVolume(volume)) throw new Error(message("Messages.InvalidVolume"));
    if (!this.current) return false;
    this.current.volume = volume;
    if (this.current.sound?.playing) await this.current.sound.fade(this.level(this.current), { duration: 0 });
    return true;
  }

  async refreshPreferences() {
    for (const state of this.states) {
      if (!state.sound || (!state.sound.playing && !state.started)) continue;
      const level = this.level(state);
      await state.sound.fade(state.cancelled ? Math.min(state.sound.volume, level) : level, { duration: 0 });
      if (!state.cancelled) this.status(state, "playing");
    }
  }
}
