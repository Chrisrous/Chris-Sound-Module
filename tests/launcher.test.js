import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Minimal DOM/API doubles. Real browser coverage is separate from these unit tests.
class Element {
  constructor(tag, document) {
    this.tagName = tag; this.ownerDocument = document; this.children = [];
    this.className = ""; this.attributes = {}; this.parentElement = null;
  }
  get firstElementChild() { return this.children[0] ?? null; }
  append(...children) { for (const child of children) { child.remove(); child.parentElement = this; this.children.push(child); } }
  prepend(child) { child.remove(); child.parentElement = this; this.children.unshift(child); }
  remove() { if (this.parentElement) { const list = this.parentElement.children; list.splice(list.indexOf(this), 1); this.parentElement = null; } }
  setAttribute(key, value) { this.attributes[key] = value; }
  querySelectorAll(selector) {
    const matches = node => selector.startsWith(".") ? node.className.split(" ").includes(selector.slice(1)) : node.tagName === selector;
    return this.children.flatMap(child => [...(matches(child) ? [child] : []), ...child.querySelectorAll(selector)]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
}
const document = { createElement: tag => new Element(tag, document) };
const make = (tag = "section", className = "") => { const node = document.createElement(tag); node.className = className; return node; };
const en = JSON.parse(readFileSync(new URL("../lang/en.json", import.meta.url)));
const de = JSON.parse(readFileSync(new URL("../lang/de.json", import.meta.url)));
const localize = locale => key => key.split(".").reduce((value, part) => value?.[part], locale) ?? key;
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
class Application {}
globalThis.foundry = { applications: { api: { ApplicationV2: Application, HandlebarsApplicationMixin: base => base } } };
const { SoundPad } = await import("../scripts/SoundPad.js");
const { renderPlaylistLauncher, registerSoundPadLauncher, refreshSoundPadLauncher, openSoundPad } = await import("../scripts/launcher.js");
let pad, notices, hooks;
beforeEach(() => {
  notices = []; hooks = [];
  globalThis.game = { user: { isGM: true }, ready: true, i18n: { localize: localize(en), format(key) { return this.localize(key); } }, settings: { get: () => false } };
  globalThis.ui = { notifications: { error: error => notices.push(error) } };
  globalThis.Hooks = { on: (name, handler) => hooks.push({ name, handler }) };
  pad = { rendered: false, minimized: false, renders: 0, fronts: 0, maximizes: 0,
    async render(options) { this.renders++; this.options = options; this.rendered = true; return this; },
    async maximize() { this.maximizes++; this.minimized = false; },
    bringToFront() { this.fronts++; } };
  SoundPad.instance = pad;
});
function setup(root = make()) { renderPlaylistLauncher({}, root); return { root, button: root.querySelector("button") }; }
const event = () => ({ prevented: false, stopped: false, preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; } });

test("adds a labelled native button before existing playlist controls", () => {
  const root = make(), core = make("header"); root.append(core);
  const { button } = setup(root);
  assert.equal(root.firstElementChild.className, "chris-sound-module-launcher");
  assert.equal(root.children[1], core);
  assert.equal(button.type, "button"); assert.equal(button.disabled, false);
  assert.equal(button.querySelector("span").textContent, "Open Chris SoundPad");
  assert.equal(button.attributes["aria-label"], "Open Chris SoundPad");
  assert.equal(button.querySelector("i").attributes["aria-hidden"], "true");
});
test("German labels are text, not injected HTML", () => {
  game.i18n.localize = localize(de);
  const { button } = setup(); assert.equal(button.querySelector("span").textContent, "Chris SoundPad öffnen");
  game.i18n.localize = () => "<img src=x>";
  const other = setup().button; assert.equal(other.querySelector("span").textContent, "<img src=x>");
  assert.equal(other.querySelector("img"), null);
});
test("repeated partial renders retain one button and one handler", async () => {
  const { root, button } = setup();
  for (let i = 0; i < 20; i++) renderPlaylistLauncher({}, root);
  assert.equal(root.querySelectorAll("button").length, 1);
  assert.equal(root.querySelector("button"), button);
  const click = event(); await button.onclick(click);
  assert.equal(pad.renders, 1); assert.equal(pad.fronts, 1);
  assert.equal(click.prevented, true); assert.equal(click.stopped, true);
});
test("a replacement root gets a working button without touching the old root", async () => {
  const first = setup(), second = setup();
  assert.notEqual(first.button, second.button);
  await second.button.onclick(event()); assert.equal(pad.fronts, 1);
});
test("cleans up accidental duplicate rows on the next render", () => {
  const { root } = setup(); root.append(make("div", "chris-sound-module-launcher"));
  renderPlaylistLauncher({}, root); assert.equal(root.querySelectorAll(".chris-sound-module-launcher").length, 1);
});
test("framed playlist popout places the row inside content, not the window header", () => {
  const root = make(), header = make("header"), content = make("section", "window-content");
  root.append(header, content); setup(root);
  assert.equal(root.firstElementChild, header);
  assert.equal(content.firstElementChild.className, "chris-sound-module-launcher");
});
test("embedded empty playlists need no documents, scene or canvas", async () => {
  const { button } = setup(); await button.onclick(event()); assert.equal(pad.renders, 1);
});
test("uses the element ownerDocument, not a global or parent window document", () => {
  const otherDocument = { createElement: tag => new Element(tag, otherDocument) };
  const root = new Element("section", otherDocument); setup(root);
  assert.equal(root.querySelector("button").ownerDocument, otherDocument);
});
test("player clients do not get a launcher", () => {
  game.user.isGM = false; assert.equal(setup().button, null);
});
test("a re-render removes the button after GM permission is lost", () => {
  const { root } = setup(); game.user.isGM = false; renderPlaylistLauncher({}, root);
  assert.equal(root.querySelector("button"), null);
});
test("opening rechecks permission even through a stale button", async () => {
  const { button } = setup(); game.user.isGM = false;
  assert.equal(await button.onclick(event()), false); assert.equal(pad.renders, 0); assert.equal(notices.length, 1);
});
test("direct API calls reject non-GMs", () => {
  game.user.isGM = false; assert.throws(() => openSoundPad()); assert.equal(pad.renders, 0);
});
test("a pre-ready button is enabled by ready refresh", () => {
  game.ready = false; const { root, button } = setup(); assert.equal(button.disabled, true);
  ui.playlists = { element: root }; game.ready = true; refreshSoundPadLauncher(); assert.equal(button.disabled, false);
});
test("ready refresh covers both existing sidebar and popout", () => {
  const sidebar = make(), popout = make(); ui.playlists = { element: sidebar, popout: { element: popout } };
  refreshSoundPadLauncher(); assert.ok(sidebar.querySelector("button")); assert.ok(popout.querySelector("button"));
});
test("missing UI elements are harmless", () => {
  renderPlaylistLauncher({}, null); renderPlaylistLauncher({}, {}); refreshSoundPadLauncher();
  const root = make(); renderPlaylistLauncher({ element: root }); assert.ok(root.querySelector("button"));
});
test("registers the v14 hook once per Hooks object", () => {
  registerSoundPadLauncher(); registerSoundPadLauncher();
  assert.equal(hooks.length, 3); assert.equal(hooks[0].name, "renderPlaylistDirectory");
  assert.equal(hooks[0].handler, renderPlaylistLauncher);
});
test("reopening an existing pad preserves unsaved values and avoids rendering", async () => {
  pad.rendered = true; pad.unsavedText = "uncommitted preset";
  assert.equal(await openSoundPad(), pad); assert.equal(pad.renders, 0); assert.equal(pad.fronts, 1);
  assert.equal(pad.unsavedText, "uncommitted preset");
});
test("reopening a minimized pad restores and foregrounds it", async () => {
  pad.rendered = true; pad.minimized = true; await openSoundPad();
  assert.equal(pad.maximizes, 1); assert.equal(pad.fronts, 1); assert.equal(pad.renders, 0);
});
test("rapid clicks share one pending render and do not create more windows", async () => {
  const gate = deferred(); pad.render = async () => { pad.renders++; await gate.promise; pad.rendered = true; return pad; };
  const first = openSoundPad(), second = openSoundPad(); assert.equal(first, second);
  gate.resolve(); assert.equal(await first, pad); assert.equal(pad.renders, 1); assert.equal(pad.fronts, 1);
});
test("render failure is reported and the next opening can retry", async () => {
  const original = pad.render; pad.render = async () => { throw new Error("render failed"); };
  const { button } = setup(); assert.equal(await button.onclick(event()), false); assert.equal(notices.length, 1);
  pad.render = original; assert.equal(await button.onclick(event()), pad); assert.equal(pad.renders, 1);
});
test("permission is rechecked after asynchronous rendering", async () => {
  pad.render = async () => { game.user.isGM = false; };
  await assert.rejects(openSoundPad()); assert.equal(pad.fronts, 0);
});
test("entry point installs the hook at init and refreshes existing UI at ready", async () => {
  const callbacks = {};
  Hooks.once = (name, callback) => { callbacks[name] = callback; };
  game.settings.register = () => {}; game.settings.registerMenu = () => {};
  const main = await import("../scripts/main.js"); callbacks.init();
  assert.equal(main.openSoundPad, openSoundPad);
  assert.equal(hooks.filter(hook => hook.name === "renderPlaylistDirectory").length, 1);
  // Executing ready also needs the unmodified module audio service's minimal context.
  foundry.utils = { randomID: () => "testsession" };
  game.socket = { on() {} }; game.modules = new Map([["chris-sound-module", {}]]);
  ui.playlists = { element: make() }; callbacks.ready();
  assert.ok(ui.playlists.element.querySelector("button"));
  assert.equal(game.modules.get("chris-sound-module").api.openSoundPad, openSoundPad);
});
