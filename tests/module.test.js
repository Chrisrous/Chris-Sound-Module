import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
class Collection {
  constructor(contents = []) { this.contents = contents; }
  get(id) { return this.contents.find(entry => entry.id === id); }
}
class MockSound {
  constructor(options = {}) {
    this.options = options;
    this.playing = false;
    this.level = undefined;
    this.plays = [];
    this.stops = 0;
    this.fades = [];
  }
  get volume() { return this.level; } // Deliberately read-only, like v14.
  async load(options) { this.loadOptions = options; await this.loadGate?.promise; return this; }
  async play(options) {
    this.plays.push(options);
    await this.playGate?.promise;
    this.playing = true;
    this.level = options.volume;
    return this;
  }
  async stop() { this.stops++; this.playing = false; return this; }
  async fade(value, options) { this.fades.push({ value, options }); this.level = value; }
  end() { this.playing = false; this.plays.at(-1)?.onended?.(); }
}
class MockApplication {
  constructor(options) { this.options = options; this.renderCalls = []; }
  _canRender() {}
  async _prepareContext() { return { base: true }; }
  _onRender() {}
  async render(options) { this.renderCalls.push(options); return this; }
}

globalThis.foundry = {
  applications: { api: { ApplicationV2: MockApplication, HandlebarsApplicationMixin: base => base } },
  utils: { fromUuid: async () => null }
};
const socket = await import("../scripts/socket-handler.js");
const { SoundPad } = await import("../scripts/SoundPad.js");
const shared = await import("../scripts/shared.js");
let gm, player, soundDoc, emitted, notices, created, registered, menus, hookCallbacks;

beforeEach(() => {
  gm = { id: "gm", name: "Game Master", active: true, isGM: true };
  player = { id: "player", name: "Player", active: true, isGM: false };
  soundDoc = {
    id: "sound", uuid: "Playlist.playlist.PlaylistSound.sound", name: "Thunder",
    documentName: "PlaylistSound", path: "sounds/thunder.ogg", volume: 0.4,
    repeat: true, channel: "environment", parent: { name: "Weather" }
  };
  emitted = []; notices = []; created = []; registered = []; menus = []; hookCallbacks = {};
  globalThis.game = {
    user: gm, users: new Collection([gm, player]),
    playlists: new Collection([{ id: "playlist", name: "Weather", sounds: new Collection([soundDoc]) }]),
    audio: {
      unlock: Promise.resolve(), music: {}, environment: {}, interface: {},
      create: options => { const sound = new MockSound(options); created.push(sound); return sound; }
    },
    socket: { connected: true, emit: (...args) => emitted.push(args), on: (...args) => registered.push(args) },
    settings: { get: () => false, register: (...args) => registered.push(args), registerMenu: (...args) => menus.push(args) },
    modules: new Map([[shared.MODULE_ID, {}]]),
    i18n: { format: (key, data) => `${key} ${JSON.stringify(data)}`, localize: key => key }
  };
  globalThis.ui = { notifications: { error: value => notices.push(value) } };
  globalThis.Hooks = { once: (name, fn) => { hookCallbacks[name] = fn; } };
  foundry.utils.fromUuid = async uuid => uuid === soundDoc.uuid ? soundDoc : null;
  socket.playback.current = null;
  socket.playback.generation++;
  SoundPad.instance = null;
});
const audioData = (extra = {}) => ({ src: "sounds/thunder.ogg", volume: 0.4, loop: true, channel: "environment", ...extra });
const command = (extra = {}) => ({ version: 1, senderId: "gm", userId: "player", action: "playSound", data: audioData(), ...extra });

test("protocol rejects malformed messages, unknown actions and invalid volume", () => {
  for (const data of [null, {}, [], command({ version: 0 }), command({ action: "deleteWorld" }),
    command({ data: null }), command({ data: audioData({ volume: NaN }) }),
    command({ data: audioData({ volume: Infinity }) }), command({ data: audioData({ volume: "0.4" }) }),
    command({ data: audioData({ volume: -0.1 }) }), command({ data: audioData({ volume: 1.1 }) }),
    command({ data: audioData({ loop: "true" }) }), command({ data: audioData({ channel: "constructor" }) })]) {
    assert.ok(!socket.validCommand(data));
  }
  assert.ok(socket.validCommand(command()));
  assert.ok(socket.validCommand(command({ action: "stopSound" })));
  assert.ok(socket.validCommand(command({ action: "changeVolume", volume: 0 })));
});

test("source validation permits Foundry paths and HTTPS, not inline/executable URLs", () => {
  for (const src of ["sounds/x.ogg", "https://cdn.example/a.ogg?token=1", "music/Unter der Brücke.mp3"]) assert.ok(shared.validSource(src));
  for (const src of [null, "", "  ", "javascript:alert(1)", " data:audio/mp3;base64,123", "file:///secret", "a\u0000b"]) assert.ok(!shared.validSource(src));
});

test("messages for a different user are ignored without creating audio", async () => {
  assert.equal(await socket.handleSocketMessage(command()), false);
  assert.equal(created.length, 0);
});

test("unknown, inactive and non-GM claimed senders are rejected", async () => {
  game.user = player;
  assert.equal(await socket.handleSocketMessage(command({ senderId: "nobody" })), false);
  assert.equal(await socket.handleSocketMessage(command({ senderId: player.id })), false);
  gm.active = false;
  assert.equal(await socket.handleSocketMessage(command()), false);
  assert.equal(created.length, 0);
});

test("selected player receives a Foundry Sound in the correct audio context", async () => {
  game.user = player;
  assert.equal(await socket.handleSocketMessage(command()), true);
  assert.equal(created[0].options.context, game.audio.environment);
  assert.equal(created[0].options.singleton, false);
  assert.equal(created[0].loadOptions.autoplay, false);
  const { onended, ...options } = created[0].plays[0];
  assert.equal(typeof onended, "function");
  assert.deepEqual(options, { volume: 0.4, loop: true });
});

test("a second play stops the previous sound, without touching world playlists", async () => {
  const runtime = new socket.SoundPlayback();
  await runtime.play(audioData());
  await runtime.play(audioData({ src: "sounds/other.ogg" }));
  assert.equal(created[0].stops, 1);
  assert.equal(created[0].playing, false);
  assert.equal(created[1].playing, true);
  await runtime.stop();
  assert.equal(created[1].stops, 1);
});

test("volume uses fade instead of writing the read-only Sound.volume property", async () => {
  const runtime = new socket.SoundPlayback();
  await runtime.play(audioData());
  await runtime.setVolume(0);
  assert.deepEqual(created[0].fades, [{ value: 0, options: { duration: 0 } }]);
  await assert.rejects(runtime.setVolume(2));
});

test("Stop cancels a Play waiting for the first browser gesture", async () => {
  const gate = deferred(); game.audio.unlock = gate.promise;
  const runtime = new socket.SoundPlayback();
  const pending = runtime.play(audioData());
  await runtime.stop(); gate.resolve();
  assert.equal(await pending, false);
  assert.equal(created.length, 0);
});

test("only the newest of two Play requests waiting for an audio gesture starts", async () => {
  const gate = deferred(); game.audio.unlock = gate.promise;
  const runtime = new socket.SoundPlayback();
  const old = runtime.play(audioData());
  const latest = runtime.play(audioData({ src: "sounds/new.ogg" }));
  gate.resolve();
  assert.equal(await old, false); assert.equal(await latest, true);
  assert.equal(created.length, 1); assert.equal(created[0].options.src, "sounds/new.ogg");
});

test("volume changes while waiting for audio unlock are retained", async () => {
  const gate = deferred(); game.audio.unlock = gate.promise;
  const runtime = new socket.SoundPlayback();
  const pending = runtime.play(audioData());
  await runtime.setVolume(0.2); gate.resolve(); await pending;
  assert.equal(created[0].plays[0].volume, 0.2);
});

test("Stop cancels a Play still loading its asset", async () => {
  const gate = deferred(); const runtime = new socket.SoundPlayback();
  game.audio.create = options => { const sound = new MockSound(options); sound.loadGate = gate; created.push(sound); return sound; };
  const pending = runtime.play(audioData()); await tick();
  await runtime.stop(); gate.resolve();
  assert.equal(await pending, false); assert.equal(created[0].plays.length, 0);
});

test("new Play cannot be overwritten by an older slow load", async () => {
  const gate = deferred(); const runtime = new socket.SoundPlayback();
  game.audio.create = options => {
    const sound = new MockSound(options); if (!created.length) sound.loadGate = gate;
    created.push(sound); return sound;
  };
  const old = runtime.play(audioData()); await tick();
  await runtime.play(audioData({ src: "sounds/new.ogg" })); gate.resolve();
  assert.equal(await old, false); assert.equal(created[0].plays.length, 0);
  assert.equal(runtime.current.sound, created[1]);
});

test("volume changes during load are used when playback starts", async () => {
  const gate = deferred(); const runtime = new socket.SoundPlayback();
  game.audio.create = options => { const s = new MockSound(options); s.loadGate = gate; created.push(s); return s; };
  const pending = runtime.play(audioData()); await tick();
  await runtime.setVolume(0.1); gate.resolve(); await pending;
  assert.equal(created[0].plays[0].volume, 0.1);
});

test("a Stop during asynchronous play also stops a late playback completion", async () => {
  const gate = deferred(); const runtime = new socket.SoundPlayback();
  game.audio.create = options => { const s = new MockSound(options); s.playGate = gate; created.push(s); return s; };
  const pending = runtime.play(audioData()); await tick();
  await runtime.stop(); gate.resolve();
  assert.equal(await pending, false); assert.equal(created[0].playing, false);
});

test("a volume change during asynchronous play is applied after playback begins", async () => {
  const gate = deferred(); const runtime = new socket.SoundPlayback();
  game.audio.create = options => { const s = new MockSound(options); s.playGate = gate; created.push(s); return s; };
  const pending = runtime.play(audioData()); await tick();
  await runtime.setVolume(0.1); gate.resolve(); await pending;
  assert.equal(created[0].volume, 0.1);
});

test("failed asset loading clears state and later valid playback still works", async () => {
  const runtime = new socket.SoundPlayback(); const create = game.audio.create;
  game.audio.create = options => { const s = create(options); s.failed = true; return s; };
  await assert.rejects(runtime.play(audioData())); assert.equal(runtime.current, null);
  game.audio.create = create;
  assert.equal(await runtime.play(audioData()), true);
});

test("an obsolete rejected load does not clear a newer sound", async () => {
  const gate = deferred(); const runtime = new socket.SoundPlayback();
  game.audio.create = options => { const s = new MockSound(options); if (!created.length) s.loadGate = gate; created.push(s); return s; };
  const old = runtime.play(audioData()); await tick();
  await runtime.play(audioData({ src: "sounds/new.ogg" })); gate.reject(new Error("network"));
  assert.equal(await old, false); assert.equal(runtime.current.sound, created[1]);
});

test("natural end releases state without clearing a newer sound", async () => {
  const runtime = new socket.SoundPlayback(); await runtime.play(audioData());
  const old = created[0]; await runtime.play(audioData()); old.end();
  assert.equal(runtime.current.sound, created[1]); created[1].end(); assert.equal(runtime.current, null);
});

test("stable-ID API resolves fresh documents and maps repeat, volume and channel", async () => {
  soundDoc.name = "Renamed thunder"; soundDoc.path = "sounds/renamed.ogg";
  await socket.playSoundForUser(player.id, soundDoc.uuid);
  assert.equal(emitted[0][0], shared.SOCKET_CHANNEL);
  assert.equal(emitted[0][1].userId, player.id);
  assert.deepEqual(emitted[0][1].data, audioData({ src: "sounds/renamed.ogg" }));
  assert.equal(created.length, 0);
});

test("self-targeted playback executes locally without a socket echo", async () => {
  assert.equal(await socket.playSoundForUser(gm.id, soundDoc.uuid), true);
  assert.equal(emitted.length, 0); assert.equal(created.length, 1);
});

test("legacy name-based Play, Stop and volume macros remain supported", async () => {
  await socket.playSoundForPlayer("Player", "Weather", "Thunder");
  await socket.controlSoundForPlayer("Player", "stopSound");
  await socket.changeVolumeForPlayer("Player", 0.2);
  assert.deepEqual(emitted.map(([,p]) => p.action), ["playSound", "stopSound", "changeVolume"]);
});

test("ambiguous names never silently choose the first matching user or sound", async () => {
  game.users.contents.push({ ...player, id: "duplicate" });
  await assert.rejects(socket.playSoundForPlayer("Player", "Weather", "Thunder"));
  game.users.contents.pop();
  game.playlists.contents[0].sounds.contents.push({ ...soundDoc, id: "duplicate" });
  await assert.rejects(socket.playSoundForPlayer("Player", "Weather", "Thunder"));
  assert.equal(emitted.length, 0);
});

test("offline players, deleted documents and disconnected sockets fail clearly", async () => {
  player.active = false;
  await assert.rejects(socket.playSoundForUser(player.id, soundDoc.uuid));
  player.active = true;
  await assert.rejects(socket.playSoundForUser(player.id, "missing"));
  game.socket.connected = false;
  await assert.rejects(socket.playSoundForUser(player.id, soundDoc.uuid));
  assert.equal(emitted.length, 0);
});

test("non-GMs cannot send commands through any public API", async () => {
  game.user = player;
  await assert.rejects(socket.playSoundForUser(player.id, soundDoc.uuid));
  await assert.rejects(socket.playSoundForPlayer("Player", "Weather", "Thunder"));
  assert.throws(() => socket.stopSoundForUser(player.id));
  assert.throws(() => socket.changeVolumeForUser(player.id, 0.3));
  assert.throws(() => socket.controlSoundForPlayer("Player", "stopSound"));
  assert.throws(() => socket.changeVolumeForPlayer("Player", 0.3));
  assert.equal(emitted.length, 0);
});

test("permission is rechecked after asynchronous UUID resolution", async () => {
  foundry.utils.fromUuid = async () => { game.user = player; return soundDoc; };
  await assert.rejects(socket.playSoundForUser(player.id, soundDoc.uuid));
  assert.equal(emitted.length, 0);
});

test("additional legacy fields cannot override target, sender or action", async () => {
  await socket.controlSoundForPlayer("Player", "changeVolume", { volume: 0.2, userId: "gm", senderId: "player", action: "playSound" });
  assert.equal(emitted[0][1].userId, "player"); assert.equal(emitted[0][1].senderId, "gm");
  assert.equal(emitted[0][1].action, "changeVolume");
  assert.throws(() => socket.controlSoundForPlayer("Player", "unknown"));
});

const dropEvent = data => ({ preventDefault() {}, dataTransfer: { getData: () => typeof data === "string" ? data : JSON.stringify(data) } });

test("v14 ApplicationV2 configuration and Handlebars PARTS are declared", () => {
  const pad = new SoundPad(); assert.ok(pad instanceof MockApplication);
  assert.equal(SoundPad.PARTS.pad.template, "modules/chris-sound-module/templates/soundpad.html");
  assert.equal(SoundPad.DEFAULT_OPTIONS.window.resizable, true);
  assert.deepEqual(Object.keys(SoundPad.DEFAULT_OPTIONS.actions), ["selectSound", "playSound", "stopSound", "clearSounds"]);
});

test("settings and legacy openings share the same pad and keep session state", () => {
  const pad = new SoundPad(); pad.playerId = player.id;
  assert.equal(new SoundPad(), pad); assert.equal(new SoundPad().playerId, player.id);
  game.user = player; assert.throws(() => pad._canRender({}));
});

test("valid drop uses fromUuid and duplicate drops do not duplicate buttons", async () => {
  const pad = new SoundPad();
  await pad._onDrop(dropEvent({ type: "PlaylistSound", uuid: soundDoc.uuid }));
  await pad._onDrop(dropEvent({ type: "PlaylistSound", uuid: soundDoc.uuid }));
  assert.equal(pad.sounds.length, 1); assert.equal(pad.sounds[0].uuid, soundDoc.uuid);
});

test("invalid JSON, wrong document types and missing drop documents are rejected", async () => {
  const pad = new SoundPad();
  for (const data of ["bad json", null, { type: "Actor", uuid: "abc" }, { type: "PlaylistSound", uuid: "missing" }]) {
    await assert.rejects(pad._onDrop(dropEvent(data)));
  }
  assert.equal(pad.sounds.length, 0);
});

test("a resolved non-PlaylistSound document is rejected", async () => {
  foundry.utils.fromUuid = async () => ({ documentName: "Actor" });
  await assert.rejects(new SoundPad()._onDrop(dropEvent({ type: "PlaylistSound", uuid: "Actor.foo" })));
});

test("selection, player and volume survive render preparation; Clear resets selection only", async () => {
  const pad = new SoundPad(); await pad._onDrop(dropEvent({ type: "PlaylistSound", uuid: soundDoc.uuid }));
  await SoundPad.onSelectSound.call(pad, {}, { dataset: { soundId: soundDoc.uuid } });
  pad.playerId = player.id; pad.volume = 0.25;
  const context = await pad._prepareContext({});
  assert.equal(context.base, true); assert.equal(context.sounds[0].selected, true);
  assert.equal(context.users[1].selected, true); assert.equal(context.volume, 0.25);
  assert.equal(context.selectedSoundName, "Thunder");
  await SoundPad.onClearSounds.call(pad);
  assert.equal(pad.sounds.length, 0); assert.equal(pad.selectedSoundId, null);
  assert.equal(pad.playerId, player.id); assert.equal(emitted.length, 0);
});

test("UI Play sends the displayed volume and stable target IDs", async () => {
  const pad = new SoundPad(); pad.selectedSoundId = soundDoc.uuid; pad.playerId = player.id; pad.volume = 0.1;
  await SoundPad.onPlaySound.call(pad);
  assert.equal(emitted[0][1].data.volume, 0.1); assert.equal(emitted[0][1].userId, player.id);
});

test("native volume listeners update the display on input and send only on change", async () => {
  const pad = new SoundPad(); pad.playerId = player.id;
  const element = () => ({ listeners: {}, addEventListener(type, callback) { this.listeners[type] = callback; } });
  const slider = element(), select = element(), drop = element(), label = {};
  const nodes = { ".volume-slider": slider, ".player-select": select, ".soundpad-drop-area": drop, ".volume-value": label };
  pad.element = { querySelector: () => ({ querySelector: selector => nodes[selector] }) };
  await pad._onRender({}, {});
  slider.listeners.input({ currentTarget: { value: "0.23" } });
  assert.equal(pad.volume, 0.23); assert.equal(label.textContent, "23%"); assert.equal(emitted.length, 0);
  slider.listeners.change({ currentTarget: { value: "0.23" } }); await tick();
  assert.equal(emitted.length, 1); assert.equal(emitted[0][1].volume, 0.23);
  select.listeners.change({ currentTarget: { value: "gm" } }); await tick();
  assert.equal(pad.playerId, "gm"); assert.equal(pad.renderCalls.length, 1);
  const event = { prevented: false, preventDefault() { this.prevented = true; }, dataTransfer: {} };
  drop.listeners.dragover(event); assert.equal(event.prevented, true); assert.equal(event.dataTransfer.dropEffect, "copy");
});

test("invalid volume changes on the receiving socket leave the playing sound unchanged", async () => {
  game.user = player; await socket.handleSocketMessage(command());
  assert.equal(await socket.handleSocketMessage(command({ action: "changeVolume", volume: "loud" })), false);
  assert.equal(created[0].volume, 0.4); assert.equal(created[0].fades.length, 0);
  await socket.handleSocketMessage(command({ action: "stopSound" }));
  assert.equal(created[0].playing, false); assert.equal(socket.playback.current, null);
});

test("module entry registers settings at init, receiver on ready and exposes legacy macros", async () => {
  await import("../scripts/main.js"); hookCallbacks.init();
  assert.equal(menus[0][2].type, SoundPad); assert.equal(menus[0][2].restricted, true);
  hookCallbacks.ready(); socket.registerSocket();
  assert.equal(registered.filter(([key]) => key === shared.SOCKET_CHANNEL).length, 1);
  assert.equal(typeof game.modules.get(shared.MODULE_ID).api.playSoundForUser, "function");
  assert.equal(globalThis.soundPad, new SoundPad());
  await globalThis.playSoundForPlayer("Player", "Weather", "Thunder");
  assert.equal(emitted.length, 1);
});
