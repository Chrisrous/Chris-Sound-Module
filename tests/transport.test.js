import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { installFoundry, environment, tick, deferred, delay } from "./helpers.js";
installFoundry();
const { SoundService } = await import("../scripts/socket-handler.js");
const { MODULE_ID, SOCKET_CHANNEL } = await import("../scripts/shared.js");
let clients;
const flush = async () => { for (let i = 0; i < 5; i++) await tick(); };
beforeEach(() => { clients = []; globalThis.game = environment(); foundry.utils.fromUuid = async () => game.sound; });
afterEach(async () => { for (const client of clients) await client.service.dispose(); });
function connect(userId) {
  const env = environment(userId), service = new SoundService(() => env);
  const client = { env, service }; clients.push(client);
  env.socket.volatile.emit = (name, data) => {
    env.emitted.push({ name, data: structuredClone(data) });
    if (!env.socket.connected) return;
    for (const other of clients) {
      if (other === client || !other.env.socket.connected) continue;
      queueMicrotask(() => { for (const receive of other.env.socketHandlers.get(name) ?? []) receive(structuredClone(data)); });
    }
  };
  service.register(); return client;
}
test("GM-to-player relay returns loading/started/ended status while other clients stay silent", async () => {
  const gm = connect("gm"), a = connect("player"), b = connect("other");
  await gm.service.play("player", game.sound.uuid); await flush();
  assert.equal(a.env.created.length, 1); assert.equal(b.env.created.length, 0); assert.equal(gm.env.created.length, 0);
  assert.equal(gm.service.tracker.rows()[0].status, "playing");
  assert.deepEqual(a.env.emitted.filter(item => item.data.kind === "status").map(item => item.data.status), ["loading", "playing"]);
  a.env.created[0].end(); await flush(); assert.equal(gm.service.tracker.rows()[0].status, "ended");
});
test("group delivery receives an independent acknowledgement for each recipient", async () => {
  const gm = connect("gm"), a = connect("player"), b = connect("other");
  await gm.service.playMany(["player", "other"], game.sound.uuid); await flush();
  assert.equal(a.env.created.length, 1); assert.equal(b.env.created.length, 1);
  assert.ok(gm.service.tracker.rows().every(row => row.status === "playing")); assert.equal(gm.service.tracker.rows().length, 2);
});
test("a recipient with the module absent is distinguishable from a successful one", async () => {
  const gm = connect("gm"), a = connect("player"); gm.service.tracker.timeout = 5;
  await gm.service.playMany(["player", "other"], game.sound.uuid); await flush(); await delay(15);
  assert.equal(gm.service.tracker.rows().find(row => row.userId === "player").status, "playing");
  assert.equal(gm.service.tracker.rows().find(row => row.userId === "other").status, "noResponse");
  assert.equal(a.env.created.length, 1);
});
test("waiting audio is acknowledged, then Stop cancels it with no later restart", async () => {
  const gm = connect("gm"), a = connect("player"), gate = deferred();
  a.env.audio.locked = true; a.env.audio.unlock = gate.promise;
  await gm.service.play("player", game.sound.uuid); await flush(); assert.equal(gm.service.tracker.rows()[0].status, "waitingAudio");
  await gm.service.stop("player"); await flush(); assert.equal(gm.service.tracker.rows()[0].status, "stopped");
  gate.resolve(); await flush(); assert.equal(a.env.created.length, 0);
});
test("personal mute wins over remote Play/Volume and is visible in client acknowledgement", async () => {
  const gm = connect("gm"), a = connect("player"); await a.env.settings.set(MODULE_ID, "personalMute", true);
  await gm.service.play("player", game.sound.uuid, { volume: 1, fadeIn: 3000 }); await flush();
  assert.equal(a.env.created[0].volume, 0); await gm.service.volume("player", 1); await flush(); assert.equal(a.env.created[0].volume, 0);
  assert.equal(Object.values(gm.service.tracker.rows()[0].clients)[0].muted, true);
});
test("panic stops remote audio, local preview and local incoming audio, with acknowledgements", async () => {
  const gm = connect("gm"), a = connect("player"), b = connect("other");
  await gm.service.playMany(["gm", "player", "other"], game.sound.uuid); await gm.service.previewSound(game.sound.uuid); await flush();
  await gm.service.panic(); await flush();
  for (const client of [gm, a, b]) assert.ok(client.env.created.every(sound => !sound.playing));
  assert.ok(gm.service.tracker.rows().every(row => row.status === "stopped"));
});
test("duplicate relay packets are idempotent on receiving clients", async () => {
  const gm = connect("gm"), a = connect("player"); await gm.service.play("player", game.sound.uuid); await flush();
  const packet = gm.env.emitted.find(item => item.data.kind === "command").data;
  for (const receive of a.env.socketHandlers.get(SOCKET_CHANNEL)) receive(packet);
  await flush(); assert.equal(a.env.created.length, 1);
});
test("two browser sessions for one user report separately, including mixed states", async () => {
  const gm = connect("gm"), a = connect("player"), b = connect("player"), gate = deferred();
  b.env.audio.locked = true; b.env.audio.unlock = gate.promise;
  await gm.service.play("player", game.sound.uuid); await flush();
  const row = gm.service.tracker.rows()[0]; assert.equal(Object.keys(row.clients).length, 2); assert.equal(row.status, "mixed");
  await gm.service.panic(); await flush(); gate.resolve(); await flush();
  assert.equal(a.env.created[0].playing, false); assert.equal(b.env.created.length, 0);
});
test("status messages addressed to another GM session are ignored", async () => {
  const gm = connect("gm"), a = connect("player"); await gm.service.play("player", game.sound.uuid); await flush();
  const packet = a.env.emitted.at(-1).data; packet.recipientSessionId = "wrongSession"; packet.seq += 10; packet.status = "error";
  assert.equal(await gm.service.receive(packet), false); assert.equal(gm.service.tracker.rows()[0].status, "playing");
});
