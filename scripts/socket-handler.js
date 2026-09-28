import { MODULE_ID, SOCKET_CHANNEL, AUDIO_CHANNELS, message, validVolume, validSource } from "./shared.js";
import { SoundPlayback, validFade } from "./audio.js";
import { StatusTracker } from "./status.js";
import { newId } from "./library.js";
export { SoundPlayback } from "./audio.js";

const token = value => typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
export function validCommand(packet) {
  if (!packet || packet.version !== 2 || packet.kind !== "command" || !token(packet.requestId)
      || !token(packet.senderId) || !token(packet.userId) || !token(packet.sessionId)
      || !Number.isSafeInteger(packet.seq) || packet.seq < 1 || !Number.isFinite(packet.expiresAt)) return false;
  if (["stopSound", "panic"].includes(packet.action)) return true;
  if (packet.action === "changeVolume") return validVolume(packet.volume);
  const data = packet.data;
  return packet.action === "playSound" && data && validSource(data.src) && validVolume(data.volume)
    && typeof data.loop === "boolean" && AUDIO_CHANNELS.has(data.channel) && validFade(data.fadeIn) && validFade(data.fadeOut);
}

export function soundData(sound, options = {}) {
  if (sound?.documentName !== "PlaylistSound" || !validSource(sound.path)) throw new Error(message("Messages.SoundNotFoundInPlaylist"));
  const data = { src: sound.path, volume: options.volume ?? (validVolume(sound.volume) ? sound.volume : 0.8),
    loop: options.loop ?? Boolean(sound.repeat), channel: AUDIO_CHANNELS.has(sound.channel) ? sound.channel : "music",
    fadeIn: options.fadeIn ?? 0, fadeOut: options.fadeOut ?? 0 };
  if (!validVolume(data.volume) || typeof data.loop !== "boolean" || !validFade(data.fadeIn) || !validFade(data.fadeOut)) throw new Error(message("Messages.InvalidPreset"));
  return data;
}

/** Separate services can be exercised in the multi-client transport tests. */
export class SoundService {
  constructor(getGame = () => game) {
    this.getGame = getGame; this.sessionId = newId(); this.seq = 0; this.epoch = 0;
    this.intents = new Map(); this.seen = new Map(); this.tracker = new StatusTracker();
    const prefs = () => ({ factor: this.getGame().settings.get(MODULE_ID, "personalVolume") ?? 1,
      muted: this.getGame().settings.get(MODULE_ID, "personalMute") === true });
    this.playback = new SoundPlayback(() => this.getGame().audio, prefs);
    this.preview = new SoundPlayback(() => this.getGame().audio, prefs);
    this.previewStatus = "stopped";
  }
  requireGM() { if (!this.getGame().user?.isGM) throw new Error(message("Messages.GmOnly")); }
  emit(packet) {
    const socket = this.getGame().socket;
    if (socket.connected === false) throw new Error(message("Messages.Disconnected"));
    // Volatile Socket.IO delivery is deliberately not buffered across disconnection.
    (socket.volatile ?? socket).emit(SOCKET_CHANNEL, packet);
  }
  report(command) {
    let seq = 0;
    return (status, details = {}) => {
      const packet = { version: 2, kind: "status", requestId: command.requestId, recipientId: command.senderId,
        recipientSessionId: command.sessionId, userId: this.getGame().user.id, clientId: this.sessionId,
        seq: ++seq, status, muted: details.muted === true, factor: details.factor ?? 1, code: details.code ?? "" };
      if (packet.recipientId === this.getGame().user.id && packet.recipientSessionId === this.sessionId) this.tracker.accept(packet);
      else if (this.getGame().socket.connected !== false) this.emit(packet);
    };
  }
  async receive(packet) {
    const current = this.getGame();
    if (packet?.kind === "status") {
      return packet.version === 2 && packet.recipientId === current.user.id && packet.recipientSessionId === this.sessionId
        && current.user.isGM && this.tracker.accept(packet);
    }
    if (!validCommand(packet) || packet.userId !== current.user.id || packet.expiresAt < Date.now()
        || packet.expiresAt > Date.now() + 180000) return false;
    // Claimed sender checks are NOT server authentication. See the documented trust boundary.
    const sender = current.users.get(packet.senderId);
    if (!sender?.active || !sender.isGM) return false;
    const key = `${packet.senderId}:${packet.sessionId}`;
    if ((this.seen.get(key) ?? 0) >= packet.seq) return false;
    this.seen.set(key, packet.seq);
    if (this.seen.size > 500) this.seen.delete(this.seen.keys().next().value);
    if (current.settings.get(MODULE_ID, "enableLogging")) console.debug(`${MODULE_ID} | Received`, packet.action, packet.requestId);
    const report = this.report(packet);
    try {
      if (packet.action === "playSound") return await this.playback.play(packet.data, report);
      if (packet.action === "changeVolume") {
        const applied = await this.playback.setVolume(packet.volume);
        report(applied ? "volumeChanged" : "idle", this.playback.preferences()); return true;
      }
      if (packet.action === "panic") {
        this.epoch++; this.intents.clear(); this.previewIntent = null;
        await Promise.all([this.playback.stop({ immediate: true }), this.preview.stop({ immediate: true })]);
        this.previewStatus = "stopped";
      } else await this.playback.stop();
      report("stopped", this.playback.preferences()); return true;
    } catch (error) {
      report("error", { ...this.playback.preferences(), code: "playbackFailed" });
      console.error(`${MODULE_ID} | Playback failed`, error);
      return false;
    }
  }
  register() {
    if (this.socket) return;
    this.socket = this.getGame().socket;
    this.onPacket = packet => { void this.receive(packet).catch(console.error); };
    this.onDisconnect = () => {
      this.epoch++; this.intents.clear(); this.previewIntent = null; this.tracker.disconnected();
      void Promise.all([this.playback.stop({ immediate: true }), this.preview.stop({ immediate: true })]).catch(console.error);
    };
    this.socket.on(SOCKET_CHANNEL, this.onPacket);
    this.socket.on("disconnect", this.onDisconnect);
  }
  async dispose() {
    this.socket?.off?.(SOCKET_CHANNEL, this.onPacket);
    this.socket?.off?.("disconnect", this.onDisconnect);
    this.socket = null; this.tracker.clear();
    await Promise.all([this.playback.stop({ immediate: true }), this.preview.stop({ immediate: true })]);
  }
  async send(userId, action, fields = {}, label = "") {
    this.requireGM();
    const game = this.getGame();
    const packet = { ...fields, version: 2, kind: "command", requestId: newId(), sessionId: this.sessionId,
      senderId: game.user.id, userId, action, seq: ++this.seq, expiresAt: Date.now() + 120000 };
    if (!validCommand(packet)) throw new Error(message("Messages.InvalidCommand"));
    const record = this.tracker.track(packet, label);
    const user = game.users.get(userId);
    if (!user?.active) { this.tracker.mark(record, "offline"); throw new Error(message("Messages.PlayerOffline", { name: user?.name ?? userId })); }
    if (user.id === game.user.id) return this.receive(packet);
    try { this.emit(packet); } catch (error) { this.tracker.mark(record, "unknown"); throw error; }
    if (game.settings.get(MODULE_ID, "enableLogging")) console.debug(`${MODULE_ID} | Sent`, action, userId);
    return true; // Compatibility: sent, not audibility. See tracker for confirmations.
  }
  reserve(userId) { const intent = { epoch: this.epoch }; this.intents.set(userId, intent); return intent; }
  async play(userId, uuid, options = {}) {
    this.requireGM();
    const intent = this.reserve(userId);
    const sound = await foundry.utils.fromUuid(uuid);
    this.requireGM();
    if (intent.epoch !== this.epoch || this.intents.get(userId) !== intent) return false;
    const data = soundData(sound, { ...options, ...(intent.volume === undefined ? {} : { volume: intent.volume }) });
    return this.send(userId, "playSound", { data }, options.label ?? sound.name);
  }
  async playMany(userIds, uuid, options = {}) {
    this.requireGM();
    if (!Array.isArray(userIds) || userIds.length > 1000 || !userIds.every(token)) throw new Error(message("Messages.InvalidCommand"));
    const ids = [...new Set(userIds)];
    const intents = ids.map(id => this.reserve(id));
    const sound = await foundry.utils.fromUuid(uuid);
    this.requireGM();
    const data = soundData(sound, options);
    return Promise.all(ids.map(async (userId, index) => {
      if (intents[index].epoch !== this.epoch || this.intents.get(userId) !== intents[index]) return { userId, sent: false, cancelled: true };
      try {
        const adjusted = { ...data, volume: intents[index].volume ?? data.volume };
        return { userId, sent: await this.send(userId, "playSound", { data: adjusted }, options.label ?? sound.name) };
      } catch (error) { return { userId, sent: false, error: error.message }; }
    }));
  }
  stop(userId) { this.requireGM(); this.reserve(userId); return this.send(userId, "stopSound"); }
  volume(userId, volume) {
    this.requireGM();
    if (!validVolume(volume)) throw new Error(message("Messages.InvalidVolume"));
    const intent = this.intents.get(userId); if (intent) intent.volume = volume;
    return this.send(userId, "changeVolume", { volume });
  }
  async panic() {
    this.requireGM(); this.epoch++; this.intents.clear();
    const localStop = Promise.allSettled([this.playback.stop({ immediate: true }), this.preview.stop({ immediate: true })]);
    const deliveries = Promise.all(this.getGame().users.contents.filter(user => user.active).map(async user => {
      try { return { userId: user.id, sent: await this.send(user.id, "panic") }; }
      catch (error) { return { userId: user.id, sent: false, error: error.message }; }
    }));
    await localStop;
    return deliveries;
  }
  async previewSound(uuid, options = {}) {
    this.requireGM();
    const intent = this.previewIntent = {};
    const epoch = this.epoch;
    const sound = await foundry.utils.fromUuid(uuid);
    this.requireGM();
    if (this.previewIntent !== intent || epoch !== this.epoch) return false;
    return this.preview.play(soundData(sound, options), status => { this.previewStatus = status; this.tracker.changed(); });
  }
  stopPreview() { this.requireGM(); this.previewIntent = null; return this.preview.stop({ immediate: true }); }
  refreshPreferences() { return Promise.all([this.playback.refreshPreferences(), this.preview.refreshPreferences()]); }
}

let instance;
export const getService = () => instance ??= new SoundService();
export const registerSocket = () => getService().register();
export const handleSocketMessage = packet => getService().receive(packet);
export const playSoundForUser = (userId, uuid, options) => getService().play(userId, uuid, options);
export const stopSoundForUser = userId => getService().stop(userId);
export const changeVolumeForUser = (userId, volume) => getService().volume(userId, volume);
export const playSoundForUsers = (userIds, uuid, options) => getService().playMany(userIds, uuid, options);
export const stopAllModuleSounds = () => getService().panic();
export const previewSound = (uuid, options) => getService().previewSound(uuid, options);
export const stopPreview = () => getService().stopPreview();

function uniqueByName(collection, name, kind) {
  const matches = collection.contents.filter(entry => entry.name === name);
  if (matches.length !== 1) throw new Error(message("Messages.NameNotUnique", { kind, name }));
  return matches[0];
}
function legacyUser(name) { return game.users.get(name) ?? uniqueByName(game.users, name, "User"); }
export async function playSoundForPlayer(playerName, playlistName, songName) {
  getService().requireGM();
  const user = legacyUser(playerName);
  const sound = uniqueByName(uniqueByName(game.playlists, playlistName, "Playlist").sounds, songName, "Sound");
  return playSoundForUser(user.id, sound.uuid);
}
export function controlSoundForPlayer(playerName, action, additionalData = {}) {
  getService().requireGM(); const user = legacyUser(playerName);
  if (action === "stopSound") return stopSoundForUser(user.id);
  if (action === "changeVolume") return changeVolumeForUser(user.id, additionalData.volume);
  throw new Error(message("Messages.InvalidCommand"));
}
export const changeVolumeForPlayer = (name, volume) => controlSoundForPlayer(name, "changeVolume", { volume });
