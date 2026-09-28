import { message, requireGM, reportError, validVolume } from "./shared.js";
import { playSoundForUser, stopSoundForUser, changeVolumeForUser } from "./socket-handler.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class SoundPad extends HandlebarsApplicationMixin(ApplicationV2) {
  static instance = null;

  constructor(options = {}) {
    // The settings menu and the legacy macro must open the same pad, not reset it.
    if (SoundPad.instance) return SoundPad.instance;
    super(options);
    this.sounds = [];
    this.selectedSoundId = null;
    this.playerId = "";
    this.volume = 0.8;
    SoundPad.instance = this;
  }

  static DEFAULT_OPTIONS = {
    id: "soundpad",
    classes: ["chris-sound-module"],
    tag: "div",
    position: { width: 520, height: 480 },
    window: { title: "CHRIS_SOUND_MODULE.Setting.SoundPadLabel", icon: "fa-solid fa-music", resizable: true },
    actions: {
      selectSound: SoundPad.onSelectSound,
      playSound: SoundPad.onPlaySound,
      stopSound: SoundPad.onStopSound,
      clearSounds: SoundPad.onClearSounds
    }
  };

  static PARTS = {
    pad: { template: "modules/chris-sound-module/templates/soundpad.html" }
  };

  _canRender(options) {
    if (super._canRender(options) === false) return false;
    requireGM();
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    return {
      ...context,
      sounds: this.sounds.map(sound => ({ ...sound, selected: sound.uuid === this.selectedSoundId })),
      users: game.users.contents.map(user => ({
        id: user.id, name: user.name, active: user.active, selected: user.id === this.playerId
      })),
      selectedSoundName: this.sounds.find(sound => sound.uuid === this.selectedSoundId)?.name ?? "—",
      volume: this.volume,
      volumePercent: Math.round(this.volume * 100),
      hasSound: Boolean(this.selectedSoundId),
      hasSounds: this.sounds.length > 0,
      hasPlayer: Boolean(this.playerId)
    };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    // PARTS replaces this subtree at each render: no listeners accumulate on the frame.
    const root = this.element.querySelector(".chris-sound-soundpad");
    root.querySelector(".player-select").addEventListener("change", event => {
      this.playerId = event.currentTarget.value;
      void this.render().catch(reportError);
    });
    const slider = root.querySelector(".volume-slider");
    slider.addEventListener("input", event => {
      this.volume = Number(event.currentTarget.value);
      root.querySelector(".volume-value").textContent = `${Math.round(this.volume * 100)}%`;
    });
    // Send once on release/keyboard change instead of flooding the socket on input.
    slider.addEventListener("change", event => {
      this.volume = Number(event.currentTarget.value);
      if (!this.playerId) return;
      void this.runAction(() => changeVolumeForUser(this.playerId, this.volume));
    });
    const dropArea = root.querySelector(".soundpad-drop-area");
    dropArea.addEventListener("dragover", event => {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    });
    dropArea.addEventListener("drop", event => { void this.runAction(() => this._onDrop(event)); });
  }

  async runAction(action) {
    try { requireGM(); return await action(); }
    catch (error) { reportError(error); return false; }
  }

  static async onSelectSound(event, target) {
    return this.runAction(async () => {
      const sound = this.sounds.find(entry => entry.uuid === target.dataset.soundId);
      if (!sound) return;
      this.selectedSoundId = sound.uuid;
      this.volume = sound.volume;
      await this.render();
    });
  }

  static async onPlaySound() {
    return this.runAction(async () => {
      if (!this.selectedSoundId) throw new Error(message("Messages.SelectSoundFirst"));
      if (!this.playerId) throw new Error(message("Messages.SelectPlayerFirst"));
      await playSoundForUser(this.playerId, this.selectedSoundId, { volume: this.volume });
    });
  }

  static async onStopSound() {
    return this.runAction(async () => {
      if (!this.playerId) throw new Error(message("Messages.SelectPlayerFirst"));
      await stopSoundForUser(this.playerId);
    });
  }

  static async onClearSounds() {
    return this.runAction(async () => {
      this.sounds = [];
      this.selectedSoundId = null;
      await this.render();
    });
  }

  async _onDrop(event) {
    event.preventDefault();
    requireGM();
    let data;
    try { data = JSON.parse(event.dataTransfer?.getData("text/plain") ?? ""); }
    catch { throw new Error(message("Messages.DropDataError")); }
    if (data?.type !== "PlaylistSound" || typeof data.uuid !== "string") {
      throw new Error(message("Messages.InvalidDropType"));
    }
    // Resolve the UUID; do not assume its dot-separated layout.
    const sound = await foundry.utils.fromUuid(data.uuid);
    requireGM();
    if (sound?.documentName !== "PlaylistSound") throw new Error(message("Messages.SoundNotFoundInPlaylist"));
    if (this.sounds.some(entry => entry.uuid === sound.uuid)) return;
    this.sounds.push({
      uuid: sound.uuid, name: sound.name, playlist: sound.parent?.name ?? "",
      volume: validVolume(sound.volume) ? sound.volume : 0.8
    });
    await this.render();
  }
}
