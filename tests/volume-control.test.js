import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installFoundry, environment, deferred } from "./helpers.js";

installFoundry();
const { SoundPad } = await import("../scripts/SoundPad.js");
const { VolumeControl } = await import("../scripts/volume-control.js");
const { library, newEntry } = await import("../scripts/library.js");
const { getService } = await import("../scripts/socket-handler.js");
const change = input => ({ target: { dataset: { field: "volume" }, value: String(input) } });
const approximately = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-12);
let env, pad, a, b;

beforeEach(async () => {
    env = environment();
    globalThis.game = env;
    globalThis.ui = { notifications: { error() {}, info() {} } };
    foundry.utils.fromUuid = async uuid => ({ ...env.sound, uuid, name: uuid === env.sound.uuid ? "A" : "B" });
    getService().tracker.listeners.clear();
    await getService().dispose();
    SoundPad.instance = null;
    pad = new SoundPad();
    pad.data = await library.ensure();
    a = newEntry({ ...env.sound, name: "A", volume: 0.4 });
    b = newEntry({ ...env.sound, name: "B", uuid: "Playlist.p.PlaylistSound.b", volume: 0.2 });
    await pad.mutate(data => data.pads[0].sounds.push(a, b));
    await pad.dispatch("selectSound", { dataset: { id: a.id } });
    pad.setRecipients(["player"]);
});
afterEach(async () => {
    getService().tracker.listeners.clear();
    await getService().dispose();
});

test("one prepared control rejects nonnumeric, nonfinite and out-of-range values", () => {
    const control = new VolumeControl();
    for (const value of [NaN, Infinity, -1, 1.1, "0.5", null]) {
        assert.throws(() => control.setInput(value));
    }
    control.setInput(0);
    assert.equal(control.gain, 0);
    control.setInput(1);
    assert.equal(control.gain, 1);
});

test("same selection preserves a prepared value across renders", async () => {
    await pad.onChange(change(0.25));
    await pad._prepareContext({});
    await pad.dispatch("selectSound", { dataset: { id: a.id } });
    assert.equal(pad.volumeControl.input, 0.25);
    assert.equal(env.emitted.length, 0);
});

test("switching entry loads its saved default without changing ongoing A", async () => {
    await getService().play("gm", a.uuid, { label: "A", volume: 0.4 });
    const playing = getService().playback.current.sound;
    await pad.dispatch("selectSound", { dataset: { id: b.id } });
    approximately(pad.volumeControl.gain, 0.2);
    assert.equal(playing.volume, 0.4);
    assert.equal(playing.playing, true);
    assert.equal(getService().tracker.rows()[0].label, "A");
});

test("moving the slider is draft-only even when audio is playing", async () => {
    await getService().play("gm", a.uuid, { volume: 0.4 });
    const before = library.read();
    await pad.onChange(change(0.15));
    assert.equal(getService().playback.current.sound.volume, 0.4);
    assert.deepEqual(library.read(), before);
    assert.equal(env.emitted.length, 0);
});

test("Play uses the one control, not the older saved preset", async () => {
    await pad.onChange(change(0.25));
    await pad.dispatch("playSound");
    assert.equal(env.emitted[0].data.data.volume, 0.125);
    assert.equal(library.read().pads[0].sounds[0].volume, 0.4);
});

test("Preview uses the same prepared level without sending to players", async () => {
    await pad.onChange(change(0.25));
    await pad.dispatch("preview");
    assert.equal(getService().preview.current.sound.volume, 0.125);
    assert.equal(env.emitted.length, 0);
});

test("preparing a new level leaves an already playing preview untouched", async () => {
    await pad.dispatch("preview");
    const sound = getService().preview.current.sound;
    await pad.onChange(change(0.1));
    approximately(sound.volume, 0.4);
    assert.equal(getService().previewLabel, "A");
});

test("Apply affects current recipient audio, not selected B or preview", async () => {
    await getService().play("gm", a.uuid, { label: "A", volume: 0.4 });
    await pad.dispatch("selectSound", { dataset: { id: b.id } });
    await pad.dispatch("preview");
    const preview = getService().preview.current.sound;
    const before = library.read();
    pad.setRecipients(["gm"]);
    await pad.onChange(change(0.25));
    await pad.dispatch("applyVolume");
    assert.equal(getService().playback.current.sound.volume, 0.125);
    approximately(preview.volume, 0.2);
    assert.deepEqual(library.read(), before);
    assert.equal(getService().tracker.rows()[0].label, "A");
});

test("Apply remains usable without a selected library entry", async () => {
    pad.selectedSoundId = null;
    await pad.onChange(change(0));
    await pad.dispatch("applyVolume");
    assert.equal(env.emitted[0].data.action, "changeVolume");
    assert.equal(env.emitted[0].data.volume, 0);
});

test("Apply with no recipients fails without side effects", async () => {
    pad.setRecipients([]);
    await assert.rejects(pad.dispatch("applyVolume"));
    assert.equal(env.emitted.length, 0);
});

test("Save default writes only the selected entry's volume", async () => {
    await pad.dispatch("selectSound", { dataset: { id: b.id } });
    pad.setRecipients([]);
    await pad.onChange(change(0.25));
    await pad.dispatch("saveVolume");
    const saved = library.read().pads[0].sounds;
    assert.equal(saved[0].volume, 0.4);
    assert.equal(saved[1].volume, 0.125);
    assert.equal(saved[1].name, "B");
    assert.equal(env.emitted.length, 0);
});

test("saved default survives reselecting that entry", async () => {
    await pad.onChange(change(0.25));
    await pad.dispatch("saveVolume");
    await pad.dispatch("selectSound", { dataset: { id: b.id } });
    await pad.dispatch("selectSound", { dataset: { id: a.id } });
    assert.equal(pad.volumeControl.input, 0.25);
});

test("Save default with no selected entry rejects without changing the library", async () => {
    const before = library.read();
    pad.selectedSoundId = null;
    await assert.rejects(pad.dispatch("saveVolume"));
    assert.deepEqual(library.read(), before);
});

test("failed settings write preserves saved volume and allows retry", async () => {
    const original = env.settings.set;
    const before = library.read();
    await pad.onChange(change(0.25));
    env.settings.set = async () => { throw new Error("disk unavailable"); };
    await assert.rejects(pad.dispatch("saveVolume"), /disk unavailable/);
    assert.deepEqual(library.read(), before);
    env.settings.set = original;
    await pad.dispatch("saveVolume");
    assert.equal(library.read().pads[0].sounds[0].volume, 0.125);
});

test("queued Save retains the captured entry and level when selection changes", async () => {
    const gate = deferred();
    const queued = library.update(async () => { await gate.promise; });
    await pad.onChange(change(0.25));
    // The library uses revision checks. A conflicting queued edit must fail, not write B.
    const saved = pad.dispatch("saveVolume");
    await pad.dispatch("selectSound", { dataset: { id: b.id } });
    gate.resolve();
    await queued;
    await assert.rejects(saved, /LibraryConflict/);
    assert.equal(library.read().pads[0].sounds[1].volume, 0.2);
});

test("sound editor Save changes metadata but never consumes the one slider", async () => {
    await pad.onChange(change(0.25));
    pad.field = name => ({ value: { alias: "Edited", category: "Effects", repeat: "yes", fadeIn: "1", fadeOut: "2" }[name] });
    await pad.dispatch("savePreset");
    assert.equal(pad.selected.volume, 0.4);
    assert.equal(pad.selected.alias, "Edited");
    assert.equal(pad.volumeControl.input, 0.25);
    assert.equal(env.emitted.length, 0);
});

test("sound editor Cancel cannot undo an explicitly saved default", async () => {
    pad.captureDraft({ dataset: { field: "alias" }, value: "Discard me" });
    await pad.onChange(change(0.25));
    await pad.dispatch("saveVolume");
    await pad.dispatch("cancelEdit");
    assert.equal(pad.selected.volume, 0.125);
    assert.equal(pad.selected.alias, "");
});

test("recipient change interrupts a slider gesture without sending or saving", async () => {
    const target = change(0.25).target;
    pad.beginVolumeGesture(target);
    const input = pad.volumeControl.input;
    pad.volumeControl.setInput(0.25);
    pad.setRecipients(["other"]);
    await assert.rejects(pad.onChange({ target }), /VolumeContextChanged/);
    assert.equal(pad.volumeControl.input, input);
    assert.equal(env.emitted.length, 0);
});

test("selection change during a gesture keeps B's default, not A's stale value", async () => {
    const target = change(0.25).target;
    pad.beginVolumeGesture(target);
    await pad.dispatch("selectSound", { dataset: { id: b.id } });
    await assert.rejects(pad.onChange({ target }), /VolumeContextChanged/);
    approximately(pad.volumeControl.gain, 0.2);
    assert.equal(env.emitted.length, 0);
});

test("no sound/recipient selection is required to prepare a future value", async () => {
    pad.selectedSoundId = null;
    pad.setRecipients([]);
    await pad.onChange(change(0.25));
    assert.equal(pad.volumeControl.input, 0.25);
    assert.equal(env.emitted.length, 0);
});

test("all sound-editor states have exactly one editable range in the template", () => {
    const html = readFileSync(new URL("../templates/soundpad.html", import.meta.url), "utf8");
    assert.equal([...html.matchAll(/type="range"/g)].length, 1);
    assert.match(html, /data-field="volume"/);
    assert.doesNotMatch(html, /data-field="(?:liveVolume|presetVolume)"/);
    assert.match(html, /data-action="applyVolume"/);
    assert.match(html, /data-action="saveVolume"/);
});

test("personal player mute still wins when this UI sends Apply", async () => {
    await env.settings.set("chris-sound-module", "personalMute", true);
    await getService().play("gm", a.uuid);
    pad.setRecipients(["gm"]);
    await pad.onChange(change(1));
    await pad.dispatch("applyVolume");
    assert.equal(getService().playback.current.sound.volume, 0);
});

test("live Apply never writes a preview or source PlaylistSound", async () => {
    const source = structuredClone(env.sound);
    await pad.dispatch("preview");
    await pad.onChange(change(0.25));
    await pad.dispatch("applyVolume");
    assert.deepEqual(env.sound, source);
    approximately(getService().preview.current.sound.volume, 0.4);
});
