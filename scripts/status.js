export const STATUS_VALUES = new Set(["sent", "waitingAudio", "loading", "playing", "ended", "stopped", "cancelled", "error", "offline", "noResponse", "unknown", "volumeChanged", "mixed", "idle"]);
const TERMINAL = new Set(["ended", "stopped", "cancelled", "error"]);

/** Bounded, session-local diagnostics. No permanent player activity log. */
export class StatusTracker {
  constructor(timeout = 10000) { this.timeout = timeout; this.records = new Map(); this.latest = new Map(); this.listeners = new Set(); }
  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  changed() { for (const fn of this.listeners) { try { fn(); } catch (error) { console.error(error); } } }
  track(command, label = "") {
    const record = { requestId: command.requestId, userId: command.userId, action: command.action, label, status: "sent", clients: Object.create(null) };
    this.records.set(command.requestId, record);
    if (command.action !== "changeVolume" || !this.latest.has(command.userId)) this.latest.set(command.userId, command.requestId);
    while (this.records.size > 200) {
      const [key, old] = this.records.entries().next().value;
      clearTimeout(old.timer); this.records.delete(key);
      if (this.latest.get(old.userId) === key) this.latest.delete(old.userId);
    }
    record.timer = setTimeout(() => { if (record.status === "sent") { record.status = "noResponse"; this.changed(); } }, this.timeout);
    record.timer.unref?.();
    this.changed();
    return record;
  }
  mark(record, status) { clearTimeout(record.timer); record.status = status; this.changed(); }
  accept(packet) {
    const record = this.records.get(packet?.requestId);
    if (!record || record.userId !== packet.userId || typeof packet.clientId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(packet.clientId)
        || !Number.isSafeInteger(packet.seq) || packet.seq < 1 || !STATUS_VALUES.has(packet.status)
        || typeof packet.muted !== "boolean" || !Number.isFinite(packet.factor) || packet.factor < 0 || packet.factor > 1) return false;
    const previous = record.clients[packet.clientId];
    if (previous && (previous.seq >= packet.seq || TERMINAL.has(previous.status))) return false;
    if (!previous && Object.keys(record.clients).length >= 16) return false;
    record.clients[packet.clientId] = { status: packet.status, seq: packet.seq, muted: packet.muted, factor: packet.factor,
      code: ["startTimeout", "playbackFailed"].includes(packet.code) ? packet.code : "" };
    clearTimeout(record.timer);
    const statuses = new Set(Object.values(record.clients).map(client => client.status));
    record.status = statuses.size > 1 ? "mixed" : packet.status;
    this.changed(); return true;
  }
  disconnected(userId) {
    for (const record of this.records.values()) {
      if (userId && record.userId !== userId) continue;
      if (!TERMINAL.has(record.status) && record.status !== "offline") {
        clearTimeout(record.timer); record.status = "unknown"; record.clients = Object.create(null);
      }
    }
    this.changed();
  }
  rows() { return [...this.latest.values()].map(key => this.records.get(key)).filter(Boolean); }
  clear() { for (const record of this.records.values()) clearTimeout(record.timer); this.records.clear(); this.latest.clear(); this.changed(); }
}
