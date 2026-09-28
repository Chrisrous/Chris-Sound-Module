import { randomUUID } from "node:crypto";
export const tick = () => new Promise(resolve => setImmediate(resolve));
export const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
export function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
export class Collection {
  constructor(contents = []) { this.contents = contents; }
  get(id) { return this.contents.find(entry => entry.id === id); }
}
export class MockSound {
  constructor(options) { this.options = options; this.playing = false; this.plays = []; this.stops = []; this.fades = []; }
  get volume() { return this.level; }
  async load(options) { this.loadOptions = options; await this.loadGate?.promise; if (this.loadError) throw this.loadError; return this; }
  async play(options) { this.plays.push(options); await this.playGate?.promise; this.level = options.volume; this.playing = true; if (this.endImmediately) this.end(); return this; }
  async stop(options = {}) { this.stops.push(options); if (options.fade) await this.stopGate?.promise; this.playing = false; return this; }
  async fade(value, options) { this.fades.push({ value, options }); this.level = value; }
  end() { this.playing = false; this.plays.at(-1)?.onended?.(); }
}
export class MockApplication {
  constructor(options) { this.options = options; this.renderCalls = []; this.rendered = false; }
  _canRender() {}
  async _prepareContext() { return { base: true }; }
  async _onRender() {}
  async render(options) { this.renderCalls.push(options); return this; }
  async close() { this.closed = true; return this; }
}
export function installFoundry() {
  globalThis.foundry = {
    applications: { api: { ApplicationV2: MockApplication, HandlebarsApplicationMixin: base => base, DialogV2: { confirm: async () => true } } },
    audio: { AudioHelper: { inputToVolume: v => Number(v) ** 1.5, volumeToInput: v => Number(v) ** (1 / 1.5) } },
    utils: { randomID: () => randomUUID().replaceAll("-", ""), fromUuid: async () => null }
  };
}
export function environment(userId = "gm", sharedStore = new Map(), world = "world") {
  const users = new Collection([{ id: "gm", name: "GM", active: true, isGM: true },
    { id: "player", name: "Player", active: true, isGM: false }, { id: "other", name: "Other", active: true, isGM: false }]);
  const created = [], emitted = [], settingsDefs = [], menus = [], socketHandlers = new Map();
  const storeKey = key => `${world}:${userId}:${key}`;
  const env = { user: users.get(userId), users, created, emitted, settingsDefs, menus, ready: true,
    audio: { locked: false, unlock: Promise.resolve(), environment: {}, music: {}, interface: {},
      create: options => { const sound = new MockSound(options); created.push(sound); return sound; } },
    settings: {
      get: (_module, key) => structuredClone(sharedStore.get(storeKey(key))),
      set: async (_module, key, value) => { sharedStore.set(storeKey(key), structuredClone(value)); return value; },
      register: (...args) => settingsDefs.push(args), registerMenu: (...args) => menus.push(args)
    },
    socket: { connected: true, on: (name, fn) => { const handlers = socketHandlers.get(name) ?? []; handlers.push(fn); socketHandlers.set(name, handlers); },
      off: (name, fn) => socketHandlers.set(name, (socketHandlers.get(name) ?? []).filter(entry => entry !== fn)),
      emit: (name, data) => emitted.push({ name, data, volatile: false }) },
    socketHandlers, i18n: { format: (key, data) => `${key} ${JSON.stringify(data ?? {})}`, localize: key => key },
    modules: new Map([["chris-sound-module", {}]])
  };
  env.socket.volatile = { emit: (name, data) => emitted.push({ name, data, volatile: true }) };
  const sound = { id: "sound", uuid: "Playlist.playlist.PlaylistSound.sound", documentName: "PlaylistSound", name: "Thunder", path: "sounds/thunder.ogg", volume: 0.4, repeat: true, channel: "environment", parent: { name: "Weather" } };
  env.sound = sound; env.playlists = new Collection([{ id: "playlist", name: "Weather", sounds: new Collection([sound]) }]);
  return env;
}
export function fakeNode() { return { children: [], listeners: {}, dataset: {}, value: "", textContent: "",
  addEventListener(name, fn) { this.listeners[name] = fn; }, replaceChildren(...nodes) { this.children = nodes; },
  append(node) { this.children.push(node); }, prepend(node) { this.children.unshift(node); } }; }
