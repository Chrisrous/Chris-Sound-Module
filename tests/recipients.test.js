import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installFoundry, environment, fakeNode } from "./helpers.js";
installFoundry();
const { SoundPad } = await import("../scripts/SoundPad.js");
const { getService } = await import("../scripts/socket-handler.js");
const { library, newEntry } = await import("../scripts/library.js");
let env, pad;
const change = (value, checked) => ({ target: { dataset: { field: "target" }, value, checked } });
beforeEach(async () => {
  globalThis.game = env = environment();
  globalThis.ui = { notifications: { error() {} } };
  globalThis.document = { createElement: () => fakeNode() };
  foundry.utils.fromUuid = async () => env.sound;
  getService().tracker.listeners.clear(); await getService().dispose();
  SoundPad.instance = null; pad = new SoundPad(); pad.data = await library.ensure();
});
afterEach(async () => { getService().tracker.listeners.clear(); await getService().dispose(); });

test("recipient list is initially open and uses an explicit accessible button", async () => {
  assert.equal((await pad._prepareContext({})).targetsOpen, true);
  const text = readFileSync(new URL("../templates/soundpad.html", import.meta.url), "utf8");
  assert.match(text, /data-action="toggleRecipients" aria-expanded=/);
  assert.match(text, /aria-controls="soundpad-recipients"/);
  assert.doesNotMatch(text, /<details[^>]*data-panel="targets"/);
  assert.match(text, /name="csm-recipient-{{id}}"/);
});
test("check and uncheck update the changed user without replacing the DOM", async () => {
  pad.element = { querySelectorAll() { throw Error("Must not read a replacing :checked snapshot"); } };
  await pad.onChange(change("player", true)); assert.deepEqual(pad.targetIds, ["player"]);
  await pad.onChange(change("other", true)); assert.deepEqual(pad.targetIds, ["player", "other"]);
  await pad.onChange(change("player", false)); assert.deepEqual(pad.targetIds, ["other"]);
  await pad.onChange(change("other", false)); assert.deepEqual(pad.targetIds, []);
  assert.equal(pad.renderCalls.length, 0); assert.equal(env.emitted.length, 0);
});
test("rapid selection changes do not await a render or lose preceding ticks", async () => {
  await Promise.all([pad.onChange(change("player", true)), pad.onChange(change("other", true)), pad.onChange(change("player", false))]);
  assert.deepEqual(pad.targetIds, ["other"]); assert.equal(pad.targetRevision, 3);
});
test("duplicate checkbox change does not toggle twice or cancel a valid volume gesture", async () => {
  await pad.onChange(change("player", true)); const revision = pad.targetRevision;
  await pad.onChange(change("player", true)); assert.deepEqual(pad.targetIds, ["player"]);
  assert.equal(pad.targetRevision, revision);
});
test("invalid changes cannot add an arbitrary recipient", async () => {
  await pad.onChange(change("missing", true)); await pad.onChange(change("player", undefined));
  assert.deepEqual(pad.targetIds, []); assert.equal(env.emitted.length, 0);
});
test("offline and removed selected users can be deselected", async () => {
  env.users.get("player").active = false; await pad.onChange(change("player", true));
  assert.deepEqual(pad.targetIds, ["player"]);
  env.users.contents = env.users.contents.filter(user => user.id !== "player");
  await pad.onChange(change("player", false)); assert.deepEqual(pad.targetIds, []);
});
test("saved group becomes individual selection but is not overwritten", async () => {
  await pad.mutate(data => data.groups.push({ id: "g", name: "Party", userIds: ["player"] }));
  await pad.onChange({ target: { dataset: { field: "group" }, value: "g" } });
  const renders = pad.renderCalls.length, before = library.read();
  await pad.onChange(change("other", true));
  assert.equal(pad.groupId, ""); assert.equal(pad.groupEditId, "g");
  assert.deepEqual(pad.targetIds, ["player", "other"]); assert.deepEqual(library.read(), before);
  assert.equal(pad.renderCalls.length, renders);
});
test("choosing individual selection retains members and Clear removes them explicitly", async () => {
  await pad.mutate(data => data.groups.push({ id: "g", name: "Party", userIds: ["player"] }));
  await pad.onChange({ target: { dataset: { field: "group" }, value: "g" } });
  await pad.onChange({ target: { dataset: { field: "group" }, value: "" } });
  assert.deepEqual(pad.targetIds, ["player"]); await pad.dispatch("clearTargets");
  assert.deepEqual(pad.targetIds, []); assert.deepEqual(library.read().groups[0].userIds, ["player"]);
});
test("online shortcut includes online players only and does not render or play", async () => {
  env.users.get("other").active = false; await pad.dispatch("selectOnline");
  assert.deepEqual(pad.targetIds, ["player"]); assert.equal(pad.renderCalls.length, 0);
  assert.equal(env.emitted.length, 0);
});
test("recipient disclosure opens and closes without replacing inputs", async () => {
  const before = library.read(); await pad.dispatch("toggleRecipients");
  assert.equal(pad.panels.has("targets"), false); await pad.dispatch("toggleRecipients");
  assert.equal(pad.panels.has("targets"), true); assert.equal(pad.renderCalls.length, 0);
  assert.deepEqual(library.read(), before);
});
test("checkbox change invalidates an existing volume gesture, including change-back", async () => {
  await pad.onChange(change("player", true));
  const target = { dataset: { field: "liveVolume" }, value: "0.1" };
  pad.volumeGestures.set(target, pad.targetRevision);
  await pad.onChange(change("other", true)); await pad.onChange(change("other", false));
  await assert.rejects(pad.onChange({ target }), /TargetsChanged/); assert.equal(env.emitted.length, 0);
});
test("selection does not stop or relabel running A when B is selected", async () => {
  await pad.mutate(data => data.pads[0].sounds.push(newEntry({ ...env.sound, name: "B" })));
  pad.selectedSoundId = pad.pad.sounds[0].id;
  await getService().play("gm", env.sound.uuid, { label: "A" });
  await pad.onChange(change("gm", true)); await pad.dispatch("clearTargets");
  assert.equal(getService().playback.current.sound.playing, true);
  assert.equal(getService().tracker.rows()[0].label, "A"); assert.equal(pad.selected.name, "B");
});
test("Stop and volume after selection change target only the new recipients", async () => {
  await pad.onChange(change("player", true)); await pad.onChange(change("player", false));
  await pad.onChange(change("other", true)); const before = library.read();
  await pad.onChange({ target: { dataset: { field: "liveVolume" }, value: "0.2" } }); await pad.dispatch("stopSound");
  assert.deepEqual(env.emitted.map(entry => [entry.data.action, entry.data.userId]), [["changeVolume", "other"], ["stopSound", "other"]]);
  assert.deepEqual(library.read(), before);
});
test("draft sound settings and group name survive multiple recipient edits", async () => {
  await pad.mutate(data => data.pads[0].sounds.push(newEntry(env.sound)));
  pad.selectedSoundId = pad.pad.sounds[0].id;
  pad.captureDraft({ dataset: { field: "alias" }, value: "Draft" }); pad.groupNameDraft = "Unsaved group";
  await pad.onChange(change("player", true)); await pad.onChange(change("other", true));
  const context = await pad._prepareContext({}); assert.equal(context.selected.alias, "Draft");
  assert.equal(context.groupName, "Unsaved group"); assert.equal(library.read().pads[0].sounds[0].alias, "");
});
test("duplicate change on a saved group member leaves group identity intact", async () => {
  await pad.mutate(data => data.groups.push({ id: "g", name: "Party", userIds: ["player"] }));
  await pad.onChange({ target: { dataset: { field: "group" }, value: "g" } });
  await pad.onChange(change("player", true)); assert.equal(pad.groupId, "g");
});
test("removed users in saved groups stay selected until explicitly removed", async () => {
  await pad.mutate(data => data.groups.push({ id: "g", name: "Old party", userIds: ["player", "removed-user"] }));
  await pad.onChange({ target: { dataset: { field: "group" }, value: "g" } });
  assert.deepEqual(pad.targetIds, ["player", "removed-user"]);
  await pad.onChange(change("removed-user", false)); assert.deepEqual(pad.targetIds, ["player"]);
  assert.deepEqual(library.read().groups[0].userIds, ["player", "removed-user"]);
});
