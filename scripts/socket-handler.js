import {
  MODULE_ID, SOCKET_CHANNEL, AUDIO_CHANNELS, message, requireGM,
  logMessage, validVolume, validSource
} from "./shared.js";

/** One controllable module sound per receiving browser. Never touches world playlists. */
export class SoundPlayback {
  constructor(getAudio = () => game.audio) {
    this.getAudio = getAudio;
    this.generation = 0;
    this.current = null;
  }

  async play(data) {
    const generation = ++this.generation;
    const previous = this.current;
    const state = { sound: null, volume: data.volume };
    this.current = state;
    try {
      if (previous?.sound?.playing) await previous.sound.stop();
      const audio = this.getAudio();
      // Do not auto-start a cancelled request after the browser's first gesture.
      await audio.unlock;
      if (generation !== this.generation) return false;
      const sound = audio.create({
        src: data.src,
        context: audio[data.channel],
        singleton: false,
        preload: false,
        autoplay: false
      });
      state.sound = sound;
      await sound.load({ autoplay: false });
      if (this.current !== state || generation !== this.generation) return false;
      if (sound.failed) throw new Error(message("Messages.PlaybackFailed"));
      await sound.play({
        volume: state.volume, loop: data.loop,
        onended: () => { if (this.current === state) this.current = null; }
      });
      if (this.current !== state || generation !== this.generation) {
        await sound.stop();
        return false;
      }
      // A volume command can arrive while load()/play() is pending.
      if (sound.volume !== state.volume) await sound.fade(state.volume, { duration: 0 });
      return true;
    } catch (error) {
      if (this.current === state) this.current = null;
      if (state?.sound?.playing) {
        try { await state.sound.stop(); } catch (cleanupError) { console.error(MODULE_ID, cleanupError); }
      }
      if (generation !== this.generation) return false;
      throw error;
    }
  }

  async stop() {
    ++this.generation;
    const state = this.current;
    this.current = null;
    if (state?.sound?.playing) await state.sound.stop();
    return true;
  }

  async setVolume(volume) {
    if (!validVolume(volume)) throw new Error(message("Messages.InvalidVolume"));
    if (!this.current) return false;
    this.current.volume = volume;
    // Sound.volume is a getter in v14. Use the public fade API, not assignment.
    if (this.current.sound?.playing) await this.current.sound.fade(volume, { duration: 0 });
    return true;
  }
}

export const playback = new SoundPlayback();

/** Validate only the small protocol supported by this module. */
export function validCommand(data) {
  if (!data || typeof data !== "object" || data.version !== 1) return false;
  if (typeof data.userId !== "string" || typeof data.senderId !== "string") return false;
  if (data.action === "stopSound") return true;
  if (data.action === "changeVolume") return validVolume(data.volume);
  return data.action === "playSound" && data.data && validSource(data.data.src)
    && validVolume(data.data.volume) && typeof data.data.loop === "boolean"
    && AUDIO_CHANNELS.has(data.data.channel);
}

export async function handleSocketMessage(data) {
  if (!validCommand(data) || data.userId !== game.user.id) return false;
  // Best-effort role filtering only. A raw module socket does NOT authenticate
  // this client-supplied senderId. See docs/V14_MIGRATION.md for the trust boundary.
  const sender = game.users.get(data.senderId);
  if (!sender?.isGM || !sender.active) return false;
  logMessage("Received", data.action);
  if (data.action === "playSound") return playback.play(data.data);
  if (data.action === "stopSound") return playback.stop();
  return playback.setVolume(data.volume);
}

let socketRegistered = false;
export function registerSocket() {
  if (socketRegistered) return;
  game.socket.on(SOCKET_CHANNEL, data => {
    void handleSocketMessage(data).catch(error => {
      console.error(`${MODULE_ID} | Playback failed`, error);
      ui.notifications.error(message("Messages.PlaybackFailed"));
    });
  });
  socketRegistered = true;
}

function uniqueByName(collection, name, kind) {
  const matches = collection.contents.filter(entry => entry.name === name);
  if (matches.length !== 1) throw new Error(message("Messages.NameNotUnique", { kind, name }));
  return matches[0];
}

function targetUser(idOrName) {
  const user = game.users.get(idOrName) ?? uniqueByName(game.users, idOrName, "User");
  if (!user.active) throw new Error(message("Messages.PlayerOffline", { name: user.name }));
  return user;
}

async function sendCommand(user, action, fields = {}) {
  requireGM();
  if (!user.active) throw new Error(message("Messages.PlayerOffline", { name: user.name }));
  const payload = { version: 1, action, userId: user.id, senderId: game.user.id, ...fields };
  if (!validCommand(payload)) throw new Error(message("Messages.InvalidCommand"));
  // A module socket need not echo to its sender. Self-targeting is explicitly local.
  if (user.id === game.user.id) return handleSocketMessage(payload);
  if (game.socket.connected === false) throw new Error(message("Messages.Disconnected"));
  game.socket.emit(SOCKET_CHANNEL, payload);
  logMessage("Sent", action, "to", user.id);
  return true; // Sent, not a remote playback acknowledgement.
}

function soundData(sound, options) {
  if (sound?.documentName !== "PlaylistSound" || !validSource(sound.path)) {
    throw new Error(message("Messages.SoundNotFoundInPlaylist"));
  }
  const volume = options.volume ?? (validVolume(sound.volume) ? sound.volume : 0.8);
  if (!validVolume(volume)) throw new Error(message("Messages.InvalidVolume"));
  return {
    src: sound.path, volume, loop: Boolean(sound.repeat),
    channel: AUDIO_CHANNELS.has(sound.channel) ? sound.channel : "music"
  };
}

/** Preferred API: stable User ID and PlaylistSound UUID, resolved on every play. */
export async function playSoundForUser(userId, soundUuid, options = {}) {
  requireGM();
  const user = game.users.get(userId);
  if (!user) throw new Error(message("Messages.SelectPlayerFirst"));
  const sound = typeof soundUuid === "string" ? await foundry.utils.fromUuid(soundUuid) : null;
  return sendCommand(user, "playSound", { data: soundData(sound, options) });
}

export function stopSoundForUser(userId) {
  requireGM();
  const user = game.users.get(userId);
  if (!user) throw new Error(message("Messages.SelectPlayerFirst"));
  return sendCommand(user, "stopSound");
}

export function changeVolumeForUser(userId, volume) {
  requireGM();
  const user = game.users.get(userId);
  if (!user) throw new Error(message("Messages.SelectPlayerFirst"));
  return sendCommand(user, "changeVolume", { volume });
}

/** Legacy macro signatures retained; ambiguous names now fail instead of misrouting. */
export async function playSoundForPlayer(playerName, playlistName, songName) {
  requireGM();
  const user = targetUser(playerName);
  const playlist = uniqueByName(game.playlists, playlistName, "Playlist");
  const sound = uniqueByName(playlist.sounds, songName, "Sound");
  return sendCommand(user, "playSound", { data: soundData(sound, {}) });
}

export function controlSoundForPlayer(playerName, action, additionalData = {}) {
  requireGM();
  const user = targetUser(playerName);
  if (action === "stopSound") return sendCommand(user, action);
  if (action === "changeVolume") return sendCommand(user, action, { volume: additionalData.volume });
  throw new Error(message("Messages.InvalidCommand"));
}

export function changeVolumeForPlayer(playerName, volume) {
  return controlSoundForPlayer(playerName, "changeVolume", { volume });
}
