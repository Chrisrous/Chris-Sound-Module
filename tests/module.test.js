import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { installFoundry, environment, MockSound, deferred, tick, delay, fakeNode } from "./helpers.js";
installFoundry();
const { SoundPlayback } = await import("../scripts/audio.js");
const socket = await import("../scripts/socket-handler.js");
const { PadLibrary, EMPTY_LIBRARY, newEntry, validateLibrary, library } = await import("../scripts/library.js");
const { StatusTracker } = await import("../scripts/status.js");
const { SoundPad } = await import("../scripts/SoundPad.js");
const { MODULE_ID, validSource } = await import("../scripts/shared.js");
let env, runtimes, trackers, services, notices, hooks;
const data = extra => ({ src: "sounds/thunder.ogg", volume: 0.4, loop: true, channel: "environment", fadeIn: 0, fadeOut: 0, ...extra });
const command = extra => ({ version: 2, kind: "command", requestId: foundry.utils.randomID(), senderId: "gm", sessionId: "session", userId: "player", seq: 1, expiresAt: Date.now() + 120000, action: "playSound", data: data(), ...extra });
const ack = (record, extra = {}) => ({ requestId: record.requestId, userId: record.userId, clientId: "client1", seq: 1, status: "playing", muted: false, factor: 1, ...extra });
const runtime = (getPrefs, timeout) => { const value = new SoundPlayback(() => env.audio, getPrefs, timeout); runtimes.push(value); return value; };
const service = target => { const value = new socket.SoundService(() => target ?? env); services.push(value); return value; };
const tracker = timeout => { const value = new StatusTracker(timeout); trackers.push(value); return value; };
const drop = value => ({ preventDefault() {}, dataTransfer: { getData: () => typeof value === "string" ? value : JSON.stringify(value) } });
beforeEach(() => {
  env = environment(); globalThis.game = env;
  runtimes = []; trackers = []; services = []; notices = []; hooks = {};
  globalThis.ui = { notifications: { error: text => notices.push(text) } };
  globalThis.document = { createElement: () => fakeNode() };
  globalThis.Hooks = { once: (name, fn) => { hooks[name] = fn; }, on: (name, fn) => { hooks[name] = fn; } };
  foundry.utils.fromUuid = async uuid => uuid === env.sound.uuid ? env.sound : null;
  SoundPad.instance = null;
});
afterEach(async () => {
  for (const value of trackers) value.clear();
  for (const value of runtimes) await value.stop({ immediate: true });
  for (const value of services) await value.dispose();
  await socket.getService().dispose(); socket.getService().tracker.listeners.clear();
});

test("protocol validates bounded v2 commands and rejects malformed fields", () => {
  assert.ok(socket.validCommand(command()));
  for (const packet of [null, {}, command({ version: 1 }), command({ action: "deleteWorld" }), command({ seq: NaN }),
    command({ data: data({ volume: "0.4" }) }), command({ data: data({ volume: Infinity }) }), command({ data: data({ volume: -1 }) }),
    command({ data: data({ loop: "yes" }) }), command({ data: data({ channel: "constructor" }) }),
    command({ data: data({ fadeIn: -1 }) }), command({ data: data({ fadeOut: 30001 }) }), command({ sessionId: "" }),
    command({ userId: "a".repeat(129) }), command({ kind: "status" })]) assert.ok(!socket.validCommand(packet));
});
test("source URLs exclude executable schemes and control characters", () => {
  for (const src of ["sounds/a.ogg", "https://example.org/a.mp3", "Musik/Donner.ogg"]) assert.ok(validSource(src));
  for (const src of ["", "  ", "data:a", "javascript:alert(1)", "file:///x", "a\u0000b", null]) assert.ok(!validSource(src));
});
test("sound presets inherit repeat or override it without modifying documents", () => {
  assert.equal(socket.soundData(env.sound).loop, true);
  const original = structuredClone(env.sound);
  const result = socket.soundData(env.sound, { loop: false, volume: 0.2, fadeIn: 500, fadeOut: 900 });
  assert.equal(result.loop, false); assert.equal(result.fadeIn, 500); assert.deepEqual(env.sound, original);
  assert.throws(() => socket.soundData(env.sound, { fadeOut: 31000 }));
});
test("Foundry Sound uses non-singleton correct channel and public playback options", async () => {
  const value = runtime(); await value.play(data({ fadeIn: 450 }));
  const sound = env.created[0]; assert.equal(sound.options.context, env.audio.environment);
  assert.equal(sound.options.singleton, false); assert.equal(sound.loadOptions.autoplay, false);
  assert.equal(sound.plays[0].fade, 450); assert.equal(sound.plays[0].loop, true);
});
test("second play stops previous sound and does not modify world playlists", async () => {
  const value = runtime(); await value.play(data()); await value.play(data({ src: "new.ogg" }));
  assert.equal(env.created[0].playing, false); assert.equal(env.created[1].playing, true);
  assert.equal(env.playlists.contents[0].sounds.contents[0], env.sound);
});
test("normal Stop passes stored fade-out duration", async () => {
  const value = runtime(); await value.play(data({ fadeOut: 750 })); await value.stop();
  assert.equal(env.created[0].stops[0].fade, 750);
});
test("panic interrupts an already fading sound", async () => {
  const value = runtime(); await value.play(data({ fadeOut: 5000 }));
  const gate = deferred(); env.created[0].stopGate = gate;
  const stopping = value.stop(); await tick(); await value.stop({ immediate: true });
  assert.equal(env.created[0].playing, false); assert.equal(env.created[0].stops.at(-1).fade, 0);
  gate.resolve(); await stopping;
});
test("new sound waits for previous fade-out instead of layering unmanaged audio", async () => {
  const value = runtime(); await value.play(data({ fadeOut: 500 }));
  const gate = deferred(); env.created[0].stopGate = gate;
  const next = value.play(data()); await tick(); assert.equal(env.created.length, 1);
  gate.resolve(); await next; assert.equal(env.created.length, 2);
});
test("Stop cancels locked audio without waiting for a first gesture", async () => {
  const gate = deferred(); env.audio.unlock = gate.promise; env.audio.locked = true;
  const value = runtime(), statuses = []; const pending = value.play(data(), status => statuses.push(status));
  await tick(); await value.stop(); assert.equal(await pending, false);
  gate.resolve(); await tick(); assert.equal(env.created.length, 0); assert.ok(statuses.includes("waitingAudio"));
});
test("only newest command awaiting audio unlock starts", async () => {
  const gate = deferred(); env.audio.unlock = gate.promise;
  const value = runtime(), old = value.play(data()), latest = value.play(data({ src: "new.ogg" }));
  gate.resolve(); assert.equal(await old, false); assert.equal(await latest, true); assert.equal(env.created.length, 1);
});
test("volume changes during unlock, load and start are retained", async t => {
  for (const stage of ["unlock", "load", "play"]) await t.test(stage, async () => {
    const gate = deferred(), original = env.audio.create;
    if (stage === "unlock") env.audio.unlock = gate.promise;
    else env.audio.create = options => { const sound = original(options); sound[`${stage}Gate`] = gate; return sound; };
    const value = runtime(), pending = value.play(data()); await tick(); await value.setVolume(0.1);
    gate.resolve(); await pending; assert.equal(value.current.sound.volume, 0.1);
    env.audio.create = original; env.audio.unlock = Promise.resolve();
  });
});
test("Stop during load prevents any later play", async () => {
  const gate = deferred(), create = env.audio.create;
  env.audio.create = options => { const sound = create(options); sound.loadGate = gate; return sound; };
  const value = runtime(), pending = value.play(data()); await tick(); await value.stop();
  gate.resolve(); assert.equal(await pending, false); await tick(); assert.equal(env.created[0].plays.length, 0);
});
test("Stop during native start also stops late completion", async () => {
  const gate = deferred(), create = env.audio.create;
  env.audio.create = options => { const sound = create(options); sound.playGate = gate; return sound; };
  const value = runtime(), pending = value.play(data()); await tick(); await value.stop({ immediate: true });
  gate.resolve(); assert.equal(await pending, false); await tick(); assert.equal(env.created[0].playing, false);
});
test("obsolete load errors cannot clear a newer playing state", async () => {
  const gate = deferred(), create = env.audio.create;
  env.audio.create = options => { const sound = create(options); if (env.created.length === 1) sound.loadGate = gate; return sound; };
  const value = runtime(), old = value.play(data()); await tick(); await value.play(data());
  gate.reject(new Error("network")); assert.equal(await old, false); assert.equal(value.current.sound, env.created[1]);
});
test("failed loads report error and do not prevent a later valid play", async () => {
  const create = env.audio.create; env.audio.create = options => { const sound = create(options); sound.failed = true; return sound; };
  const value = runtime(), statuses = [];
  await assert.rejects(value.play(data(), status => statuses.push(status))); assert.equal(value.current, null); assert.ok(statuses.includes("error"));
  env.audio.create = create; assert.equal(await value.play(data()), true);
});
test("natural end releases state without clearing a newer sound", async () => {
  const value = runtime(); await value.play(data()); const first = env.created[0]; await value.play(data());
  first.end(); assert.equal(value.current.sound, env.created[1]); env.created[1].end(); assert.equal(value.current, null);
});
test("a sound ending during start cannot report playing after ended", async () => {
  const create = env.audio.create; env.audio.create = options => { const sound = create(options); sound.endImmediately = true; return sound; };
  const value = runtime(), statuses = []; await value.play(data(), status => statuses.push(status)); assert.equal(statuses.at(-1), "ended");
});
test("start timeout cancels stale unlocked playback", async () => {
  const gate = deferred(); env.audio.unlock = gate.promise;
  const value = runtime(undefined, 5), statuses = []; const pending = value.play(data(), (status, details) => statuses.push({ status, details }));
  await delay(15); assert.equal(await pending, false); gate.resolve(); await tick();
  assert.equal(env.created.length, 0); assert.ok(statuses.some(item => item.details.code === "startTimeout"));
});
test("personal volume multiplies sender volume and never writes readonly Sound.volume", async () => {
  const preferences = { factor: 0.25, muted: false }, value = runtime(() => preferences);
  await value.play(data()); assert.equal(env.created[0].volume, 0.1);
  await value.setVolume(1); assert.equal(env.created[0].volume, 0.25);
  preferences.muted = true; await value.refreshPreferences(); assert.equal(env.created[0].volume, 0);
  await value.setVolume(1); assert.equal(env.created[0].volume, 0);
});
test("personal mute during pending native start is applied on completion", async () => {
  const gate = deferred(), create = env.audio.create, preferences = { factor: 1, muted: false };
  env.audio.create = options => { const sound = create(options); sound.playGate = gate; return sound; };
  const value = runtime(() => preferences), pending = value.play(data({ fadeIn: 3000 })); await tick();
  preferences.muted = true; await value.refreshPreferences(); gate.resolve(); await pending; assert.equal(env.created[0].volume, 0);
});
test("invalid volume update is rejected without changing audio", async () => {
  const value = runtime(); await value.play(data()); await assert.rejects(value.setVolume(2)); assert.equal(env.created[0].volume, 0.4);
});
test("misaddressed, inactive, expired and non-GM commands are ignored", async () => {
  const value = service(); assert.equal(await value.receive(command()), false); env.user = env.users.get("player");
  for (const packet of [command({ senderId: "other" }), command({ senderId: "missing" }), command({ expiresAt: Date.now() - 1 })]) assert.equal(await value.receive(packet), false);
  env.users.get("gm").active = false; assert.equal(await value.receive(command()), false); assert.equal(env.created.length, 0);
});
test("duplicate and reordered protocol messages never replay a sound", async () => {
  env.user = env.users.get("player"); const value = service(), packet = command({ seq: 2 });
  assert.equal(await value.receive(packet), true); assert.equal(await value.receive(packet), false);
  assert.equal(await value.receive(command({ seq: 1 })), false); assert.equal(env.created.length, 1);
});
test("stable-ID Play resolves current asset paths and sends volatile packets", async () => {
  const value = service(); env.sound.path = "new.ogg"; await value.play("player", env.sound.uuid);
  assert.equal(env.emitted[0].data.data.src, "new.ogg"); assert.equal(env.emitted[0].volatile, true);
});
test("self-targeting needs no socket echo and gets a playback acknowledgement", async () => {
  const value = service(); assert.equal(await value.play("gm", env.sound.uuid), true);
  assert.equal(env.emitted.length, 0); assert.equal(value.tracker.rows()[0].status, "playing");
});
test("offline and disconnected sends fail without buffered packets", async () => {
  const value = service(); env.users.get("player").active = false;
  await assert.rejects(value.play("player", env.sound.uuid)); assert.equal(value.tracker.rows()[0].status, "offline");
  env.users.get("player").active = true; env.socket.connected = false;
  await assert.rejects(value.play("player", env.sound.uuid)); assert.equal(env.emitted.length, 0);
});
test("permission is rechecked after UUID resolution", async () => {
  const value = service(); foundry.utils.fromUuid = async () => { env.user = env.users.get("player"); return env.sound; };
  await assert.rejects(value.play("player", env.sound.uuid)); assert.equal(env.emitted.length, 0);
});
test("Stop invalidates a Play still resolving its document", async () => {
  const gate = deferred(), value = service(); foundry.utils.fromUuid = () => gate.promise;
  const pending = value.play("player", env.sound.uuid); await value.stop("player"); gate.resolve(env.sound);
  assert.equal(await pending, false); assert.deepEqual(env.emitted.map(item => item.data.action), ["stopSound"]);
});
test("new Play supersedes older unresolved Play and retains an intervening volume", async () => {
  const gate = deferred(), value = service(); let calls = 0;
  foundry.utils.fromUuid = () => ++calls === 1 ? gate.promise : Promise.resolve(env.sound);
  const old = value.play("player", env.sound.uuid), next = value.play("player", env.sound.uuid);
  await value.volume("player", 0.3); await next; gate.resolve(env.sound); assert.equal(await old, false);
  assert.equal(env.emitted.at(-1).data.data.volume, 0.3);
});
test("preview is local and independent of incoming/self-targeted audio", async () => {
  const value = service(); await value.play("gm", env.sound.uuid); const incoming = value.playback.current.sound;
  await value.previewSound(env.sound.uuid); assert.equal(env.emitted.length, 0); assert.equal(incoming.playing, true);
  await value.stopPreview(); assert.equal(incoming.playing, true); assert.equal(value.preview.current, null);
});
test("Stop preview cancels unresolved preview documents", async () => {
  const gate = deferred(), value = service(); foundry.utils.fromUuid = () => gate.promise;
  const pending = value.previewSound(env.sound.uuid); await value.stopPreview(); gate.resolve(env.sound);
  assert.equal(await pending, false); assert.equal(env.created.length, 0);
});
test("panic reaches every connected user and cancels unresolved outgoing Play", async () => {
  const gate = deferred(), value = service(); foundry.utils.fromUuid = () => gate.promise;
  const pending = value.play("player", env.sound.uuid); await value.panic(); gate.resolve(env.sound);
  assert.equal(await pending, false); assert.deepEqual(env.emitted.map(item => item.data.userId).sort(), ["other", "player"]);
  assert.ok(env.emitted.every(item => item.data.action === "panic"));
});
test("panic received from another GM cancels a still-resolving local preview", async () => {
  env.users.contents.push({ id: "gm2", isGM: true, active: true });
  const gate = deferred(), value = service(); foundry.utils.fromUuid = () => gate.promise;
  const pending = value.previewSound(env.sound.uuid);
  await value.receive(command({ senderId: "gm2", userId: "gm", action: "panic" })); gate.resolve(env.sound);
  assert.equal(await pending, false); assert.equal(env.created.length, 0);
});
test("group sending deduplicates IDs and reports offline recipients independently", async () => {
  const value = service(); env.users.get("other").active = false;
  const result = await value.playMany(["player", "other", "player"], env.sound.uuid);
  assert.equal(result.length, 2); assert.equal(result[0].sent, true); assert.equal(result[1].sent, false);
  assert.equal(env.emitted.length, 1); assert.equal(value.tracker.rows().find(row => row.userId === "other").status, "offline");
});
test("group resolution cancellation is individual, not all-or-nothing", async () => {
  const gate = deferred(), value = service(); foundry.utils.fromUuid = () => gate.promise;
  const pending = value.playMany(["player", "other"], env.sound.uuid); await value.stop("player"); gate.resolve(env.sound);
  const result = await pending; assert.equal(result[0].cancelled, true); assert.equal(result[1].sent, true);
});
test("socket registration is idempotent and disconnect cancels pending audio without replay", async () => {
  const value = service(), gate = deferred(); value.register(); value.register(); assert.equal(env.socketHandlers.get(`module.${MODULE_ID}`).length, 1);
  env.audio.unlock = gate.promise; const pending = value.play("gm", env.sound.uuid); await tick();
  env.socket.connected = false; env.socketHandlers.get("disconnect")[0](); gate.resolve();
  assert.equal(await pending, false); assert.equal(env.created.length, 0); env.socket.connected = true;
  await tick(); assert.equal(env.created.length, 0);
});
test("non-GMs cannot send, preview, panic or change personal limits through control APIs", async () => {
  const value = service(); env.user = env.users.get("player");
  await assert.rejects(value.play("other", env.sound.uuid)); await assert.rejects(value.previewSound(env.sound.uuid));
  await assert.rejects(value.panic()); assert.throws(() => value.stop("other")); assert.throws(() => value.volume("other", 0.5));
});
test("status tracker binds request/recipient and rejects invalid or regressive replies", () => {
  const value = tracker(), record = value.track(command());
  assert.equal(value.accept(ack(record, { userId: "other" })), false); assert.equal(value.accept(ack(record, { seq: NaN })), false);
  assert.equal(value.accept(ack(record)), true); assert.equal(value.accept(ack(record, { status: "loading" })), false);
  assert.equal(value.accept(ack(record, { seq: 2, status: "ended" })), true);
  assert.equal(value.accept(ack(record, { seq: 3, status: "playing" })), false);
});
test("status timeout indicates no response and accepts a late genuine reply", async () => {
  const value = tracker(5), record = value.track(command()); await delay(15);
  assert.equal(record.status, "noResponse"); value.accept(ack(record)); assert.equal(record.status, "playing");
});
test("waitingAudio is not falsely presented as no response", async () => {
  const value = tracker(5), record = value.track(command()); value.accept(ack(record, { status: "waitingAudio" })); await delay(15);
  assert.equal(record.status, "waitingAudio");
});
test("multiple tabs are reported separately rather than falsely exactly-once", () => {
  const value = tracker(), record = value.track(command()); value.accept(ack(record));
  value.accept(ack(record, { clientId: "client2", status: "waitingAudio" })); assert.equal(Object.keys(record.clients).length, 2); assert.equal(record.status, "mixed");
});
test("untrusted client IDs cannot mutate object prototypes", () => {
  const value = tracker(), record = value.track(command()); value.accept(ack(record, { clientId: "__proto__" }));
  assert.equal(Object.getPrototypeOf(record.clients), null); assert.equal({}.status, undefined);
});
test("volume acknowledgements do not hide later natural-end status", () => {
  const value = tracker(), playing = value.track(command()); value.accept(ack(playing));
  const volume = value.track(command({ action: "changeVolume", volume: 0.1 })); value.accept(ack(volume, { status: "volumeChanged" }));
  value.accept(ack(playing, { seq: 2, status: "ended" })); assert.equal(value.rows()[0].status, "ended");
});
test("status storage is bounded and connection loss becomes unknown", () => {
  const value = tracker(); for (let i = 0; i < 220; i++) value.track(command()); assert.equal(value.records.size, 200);
  value.disconnected("player"); assert.equal(value.rows()[0].status, "unknown");
});
test("legacy name macros remain and ambiguous names fail rather than misroute", async () => {
  await socket.playSoundForPlayer("Player", "Weather", "Thunder"); await socket.changeVolumeForPlayer("Player", 0.2);
  await socket.controlSoundForPlayer("Player", "stopSound"); assert.deepEqual(env.emitted.map(item => item.data.action), ["playSound", "changeVolume", "stopSound"]);
  env.users.contents.push({ ...env.users.get("player"), id: "duplicate" }); await assert.rejects(socket.playSoundForPlayer("Player", "Weather", "Thunder"));
});
test("legacy extra arguments cannot override sender/target/action", async () => {
  await socket.controlSoundForPlayer("Player", "changeVolume", { volume: 0.2, senderId: "player", userId: "gm", action: "panic" });
  assert.equal(env.emitted[0].data.userId, "player"); assert.equal(env.emitted[0].data.senderId, "gm"); assert.equal(env.emitted[0].data.action, "changeVolume");
});
test("pads persist across store instances and are separated by user and world", async () => {
  const shared = new Map(), one = environment("gm", shared, "one"), otherUser = environment("player", shared, "one"), otherWorld = environment("gm", shared, "two");
  const first = new PadLibrary(() => one.settings); const value = await first.ensure();
  await first.update(data => { data.pads[0].name = "Weather"; }, value.revision);
  assert.equal(new PadLibrary(() => one.settings).read().pads[0].name, "Weather");
  assert.equal(new PadLibrary(() => otherUser.settings).read().pads.length, 0);
  assert.equal(new PadLibrary(() => otherWorld.settings).read().pads.length, 0);
});
test("queued library mutations preserve both sequential edits", async () => {
  const value = new PadLibrary(); await value.ensure();
  await Promise.all([value.update(data => { data.pads[0].sounds.push(newEntry(env.sound)); }), value.update(data => { data.pads[0].name = "New"; })]);
  assert.equal(value.read().pads[0].name, "New"); assert.equal(value.read().pads[0].sounds.length, 1);
});
test("stale browser revisions fail without overwriting newer pads", async () => {
  const value = new PadLibrary(), original = await value.ensure(); await value.update(data => { data.pads[0].name = "New"; });
  await assert.rejects(value.update(data => { data.pads[0].name = "Stale"; }, original.revision)); assert.equal(value.read().pads[0].name, "New");
});
test("failed setting writes do not replace saved data and the queue recovers", async () => {
  const value = new PadLibrary(); await value.ensure(); const original = value.read(), set = env.settings.set;
  env.settings.set = async () => { throw new Error("disk"); }; await assert.rejects(value.update(data => { data.pads[0].name = "Lost"; }));
  assert.deepEqual(value.read(), original); env.settings.set = set; await value.update(data => { data.pads[0].name = "Recovered"; });
  assert.equal(value.read().pads[0].name, "Recovered");
});
test("unsupported stored schema and invalid presets are preserved, not reset", async () => {
  await env.settings.set(MODULE_ID, "library", { ...EMPTY_LIBRARY, version: 99 }); const value = new PadLibrary();
  assert.throws(() => value.read()); assert.equal(env.settings.get(MODULE_ID, "library").version, 99);
  await env.settings.set(MODULE_ID, "library", EMPTY_LIBRARY); await value.ensure();
  await assert.rejects(value.update(data => { data.pads[0].sounds.push({ ...newEntry(env.sound), fadeIn: -1 }); }));
  assert.equal(value.read().pads[0].sounds.length, 0);
});
test("library rejects duplicate sounds, invalid active pad and invalid group data", async () => {
  const value = new PadLibrary(); await value.ensure(); const original = value.read();
  for (const mutate of [data => { const sound = newEntry(env.sound); data.pads[0].sounds.push(sound, sound); },
    data => { data.activePadId = "missing"; }, data => { data.groups.push({ id: "group", name: "A", userIds: ["a", "a"] }); }]) {
    const draft = structuredClone(original); mutate(draft); assert.throws(() => validateLibrary(draft));
  }
});
test("non-GMs cannot write pad data through the library API", async () => {
  const value = new PadLibrary(); env.user = env.users.get("player"); await assert.rejects(value.ensure());
});
test("ApplicationV2 pad is singleton with restricted rendering", () => {
  const pad = new SoundPad(); assert.equal(new SoundPad(), pad); assert.equal(SoundPad.DEFAULT_OPTIONS.window.resizable, true);
  assert.equal(SoundPad.PARTS.pad.template, "modules/chris-sound-module/templates/soundpad.html");
  env.user = env.users.get("player"); assert.throws(() => pad._canRender({}));
});
test("valid drag-drop saves and deduplicates sound UUIDs", async () => {
  const pad = new SoundPad(); await pad._onDrop(drop({ type: "PlaylistSound", uuid: env.sound.uuid }));
  await pad._onDrop(drop({ type: "PlaylistSound", uuid: env.sound.uuid })); assert.equal(pad.pad.sounds.length, 1);
  assert.equal(library.read().pads[0].sounds.length, 1);
});
test("invalid drop JSON, type and missing/non-sound documents do not write entries", async () => {
  const pad = new SoundPad();
  for (const payload of ["bad", null, { type: "Actor", uuid: "A" }, { type: "PlaylistSound", uuid: "missing" }]) await assert.rejects(pad._onDrop(drop(payload)));
  foundry.utils.fromUuid = async () => ({ documentName: "Actor" }); await assert.rejects(pad._onDrop(drop({ type: "PlaylistSound", uuid: "A" })));
  assert.equal(pad.pad.sounds.length, 0);
});
test("favorite, individual removal and arbitrary reordering affect only pad entries", async () => {
  const pad = new SoundPad(); await pad._onDrop(drop({ type: "PlaylistSound", uuid: env.sound.uuid }));
  const first = pad.pad.sounds[0].id;
  await pad.mutate(data => { data.pads[0].sounds.push(newEntry({ ...env.sound, uuid: "Playlist.p.PlaylistSound.second" })); });
  await pad.dispatch("favorite", { dataset: { id: first } }); assert.equal(pad.pad.sounds[0].favorite, true);
  await pad.dispatch("moveDown", { dataset: { id: first } }); assert.equal(pad.pad.sounds[1].id, first);
  await pad.dispatch("removeSound", { dataset: { id: first } }); assert.equal(pad.pad.sounds.length, 1); assert.equal(env.sound.name, "Thunder");
});
test("search/category/favorite filters operate on display and original metadata", async () => {
  const pad = new SoundPad(); await pad._onDrop(drop({ type: "PlaylistSound", uuid: env.sound.uuid }));
  const row = { dataset: { id: pad.pad.sounds[0].id } }; pad.element = { querySelectorAll: () => [row] };
  pad.search = "weather"; pad.filterRows(); assert.equal(row.hidden, false);
  pad.search = "no match"; pad.filterRows(); assert.equal(row.hidden, true);
  pad.search = ""; pad.favoritesOnly = true; pad.filterRows(); assert.equal(row.hidden, true);
});
test("preset editor persists aliases, categories, repeat and fades", async () => {
  const pad = new SoundPad(); await pad._onDrop(drop({ type: "PlaylistSound", uuid: env.sound.uuid })); pad.selectedSoundId = pad.pad.sounds[0].id;
  const fields = { alias: "Quiet thunder", category: "Weather", repeat: "no", fadeIn: "0.5", fadeOut: "1.5", presetVolume: "0.25" };
  pad.field = name => ({ value: fields[name] }); await pad.dispatch("savePreset");
  assert.equal(pad.selected.alias, "Quiet thunder"); assert.equal(pad.selected.loop, false); assert.equal(pad.selected.fadeOut, 1500);
});
test("saved named target groups retain stable IDs including offline users", async () => {
  const pad = new SoundPad(); await pad._prepareContext({}); pad.targetIds = ["player", "other"]; pad.field = () => ({ value: "Party" });
  await pad.dispatch("saveGroup"); assert.equal(library.read().groups[0].name, "Party");
  env.users.get("other").active = false; const context = await pad._prepareContext({});
  assert.equal(context.users.find(user => user.id === "other").selected, true); assert.equal(context.users.find(user => user.id === "other").active, false);
});
test("delete/clear use confirmation and never stop audio or delete playlists", async () => {
  const pad = new SoundPad(); await pad._onDrop(drop({ type: "PlaylistSound", uuid: env.sound.uuid }));
  const value = socket.getService(); await value.play("gm", env.sound.uuid);
  foundry.applications.api.DialogV2.confirm = async () => false; await pad.dispatch("clearSounds"); assert.equal(pad.pad.sounds.length, 1);
  foundry.applications.api.DialogV2.confirm = async () => true; await pad.dispatch("clearSounds"); assert.equal(pad.pad.sounds.length, 0);
  assert.equal(value.playback.current.sound.playing, true);
});
test("status text uses textContent for untrusted names and aliases", async () => {
  const pad = new SoundPad(); await pad._prepareContext({}); env.users.get("player").name = "<script>unsafe</script>";
  const root = fakeNode(), preview = fakeNode(); pad.element = { querySelector: selector => selector === ".recipient-status" ? root : selector === ".preview-status" ? preview : null };
  socket.getService().tracker.track(command(), "<img src=x>"); pad.renderStatus(); assert.ok(root.children[1].textContent.includes("<script>unsafe</script>"));
  assert.equal(root.children[1].innerHTML, undefined);
});
test("closing pad stops preview but keeps incoming playback even after GM role changes", async () => {
  const pad = new SoundPad(), value = socket.getService(); await value.play("gm", env.sound.uuid); await value.previewSound(env.sound.uuid);
  env.user = env.users.get("player"); await pad.close(); assert.equal(value.preview.current, null); assert.equal(value.playback.current.sound.playing, true);
});
test("entry registers user-scoped persistence/preferences and exposes old/new APIs", async () => {
  await import("../scripts/main.js"); hooks.init(); hooks.ready();
  const definitions = new Map(env.settingsDefs.map(([, key, value]) => [key, value]));
  for (const key of ["library", "personalVolume", "personalMute"]) assert.equal(definitions.get(key).scope, "user");
  assert.equal(env.menus[0][2].restricted, true);
  const api = env.modules.get(MODULE_ID).api;
  for (const name of ["openSoundPad", "playSoundForUser", "playSoundForUsers", "stopAllModuleSounds", "previewSound", "stopPreview", "getPlaybackStatus"]) assert.equal(typeof api[name], "function");
  await globalThis.playSoundForPlayer("Player", "Weather", "Thunder"); assert.equal(env.emitted.length, 1);
});

test("native live slider sends once on release without rewriting the selected preset", async () => {
  const pad = new SoundPad(); await pad._onDrop(drop({ type: "PlaylistSound", uuid: env.sound.uuid }));
  pad.selectedSoundId = pad.pad.sounds[0].id; pad.targetIds = ["player"];
  const root = fakeNode(), dropArea = fakeNode(), label = fakeNode();
  root.querySelector = selector => selector === ".soundpad-drop-area" ? dropArea : label;
  pad.element = { querySelector: selector => selector === ".chris-sound-soundpad" ? root : null, querySelectorAll: () => [] };
  await pad._onRender({}, {});
  const event = { target: { dataset: { field: "liveVolume" }, value: "0.25" } };
  root.listeners.input(event); assert.equal(label.textContent, "25%"); assert.equal(env.emitted.length, 0);
  root.listeners.change(event); await tick();
  assert.equal(env.emitted.length, 1); assert.equal(env.emitted[0].data.volume, 0.125);
  assert.equal(library.read().pads[0].sounds[0].volume, 0.4);
  const over = { preventDefault() { this.prevented = true; }, dataTransfer: {} };
  dropArea.listeners.dragover(over); assert.equal(over.prevented, true); assert.equal(over.dataTransfer.dropEffect, "copy");
});
test("unsaved preset edits survive unrelated re-renders and are marked as unsaved", async () => {
  const pad = new SoundPad(); await pad._onDrop(drop({ type: "PlaylistSound", uuid: env.sound.uuid })); pad.selectedSoundId = pad.pad.sounds[0].id;
  pad.captureDraft({ dataset: { field: "alias" }, value: "Draft alias" });
  pad.captureDraft({ dataset: { field: "fadeOut" }, value: "1.5" });
  const context = await pad._prepareContext({}); assert.equal(context.selected.alias, "Draft alias"); assert.equal(context.selected.fadeOutSeconds, 1.5);
  assert.equal(context.selectedDirty, true); assert.equal(library.read().pads[0].sounds[0].alias, "");
});
test("named pads can be created, renamed, switched and removed without deleting assets", async () => {
  const pad = new SoundPad(); await pad._prepareContext({}); const first = pad.pad.id;
  pad.field = () => ({ value: "Weather" }); await pad.dispatch("newPad"); assert.equal(pad.data.pads.length, 2); assert.equal(pad.pad.name, "Weather");
  pad.field = () => ({ value: "Weather revised" }); await pad.dispatch("renamePad"); assert.equal(pad.pad.name, "Weather revised");
  await pad.onChange({ target: { dataset: { field: "pad" }, value: first } }); assert.equal(pad.pad.id, first);
  await pad.dispatch("deletePad"); assert.equal(pad.data.pads.length, 1); assert.equal(env.playlists.contents.length, 1);
});
test("invalid group API input and invalid presets do not send messages", async () => {
  const value = service(); await assert.rejects(value.playMany("player", env.sound.uuid));
  await assert.rejects(value.playMany([{}], env.sound.uuid)); await assert.rejects(value.play("player", env.sound.uuid, { loop: "yes" }));
  assert.equal(env.emitted.length, 0);
});

test("a local audio failure cannot prevent panic packets reaching other recipients", async () => {
  const value = service(), stop = value.playback.stop, error = console.error;
  value.playback.stop = async () => { throw new Error("local device failure"); }; console.error = () => {};
  try { await value.panic(); assert.deepEqual(env.emitted.map(item => item.data.userId).sort(), ["other", "player"]); }
  finally { value.playback.stop = stop; console.error = error; }
});
test("a volume command with no active sound reports idle, not applied", async () => {
  env.user = env.users.get("player"); const value = service();
  await value.receive(command({ action: "changeVolume", volume: 0.2 }));
  assert.equal(env.emitted.at(-1).data.status, "idle");
});

test("panic still silences a native stopping state whose playing getter is false", async () => {
  const value = runtime(); await value.play(data({ fadeOut: 5000 })); const sound = env.created[0], gate = deferred();
  sound.stop = async options => { sound.stops.push(options); sound.playing = false; if (options.fade) await gate.promise; return sound; };
  const pending = value.stop(); await tick(); assert.equal(sound.playing, false);
  await value.stop({ immediate: true }); assert.equal(sound.level, 0); assert.equal(sound.stops.at(-1).fade, 0);
  gate.resolve(); await pending;
});
