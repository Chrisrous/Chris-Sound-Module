import { MODULE_ID, message, requireGM, validVolume } from "./shared.js";
import { validFade } from "./audio.js";

export const EMPTY_LIBRARY = { version: 1, revision: "0", activePadId: "", pads: [], groups: [] };
export const newId = () => foundry.utils.randomID();
const copy = value => structuredClone(value);
const text = (value, max = 120) => typeof value === "string" && value.length <= max;
const id = value => typeof value === "string" && value.length > 0 && value.length <= 256;
const unique = values => new Set(values).size === values.length;

/** Reject unsupported/corrupt data without silently overwriting it. */
export function validateLibrary(value) {
  if (!value || value.version !== 1 || !id(value.revision) || !text(value.activePadId, 256)
      || !Array.isArray(value.pads) || value.pads.length > 100
      || !Array.isArray(value.groups) || value.groups.length > 100) throw new Error(message("Messages.InvalidLibrary"));
  for (const pad of value.pads) {
    if (!id(pad.id) || !text(pad.name) || !pad.name.trim() || !Array.isArray(pad.sounds) || pad.sounds.length > 1000
        || !unique(pad.sounds.map(entry => entry.id)) || !unique(pad.sounds.map(entry => entry.uuid))) throw new Error(message("Messages.InvalidLibrary"));
    for (const entry of pad.sounds) {
      if (!id(entry.id) || !id(entry.uuid) || !text(entry.name) || !text(entry.alias) || !text(entry.playlist)
          || !text(entry.category, 60) || typeof entry.favorite !== "boolean" || !validVolume(entry.volume)
          || !(entry.loop === null || typeof entry.loop === "boolean") || !validFade(entry.fadeIn) || !validFade(entry.fadeOut)) {
        throw new Error(message("Messages.InvalidLibrary"));
      }
    }
  }
  for (const group of value.groups) {
    if (!id(group.id) || !text(group.name) || !group.name.trim() || !Array.isArray(group.userIds)
        || group.userIds.length > 1000 || !group.userIds.every(id) || !unique(group.userIds)) throw new Error(message("Messages.InvalidLibrary"));
  }
  if (!unique(value.pads.map(pad => pad.id)) || !unique(value.groups.map(group => group.id))
      || (value.pads.length && !value.pads.some(pad => pad.id === value.activePadId))) throw new Error(message("Messages.InvalidLibrary"));
  return value;
}

export function newEntry(sound) {
  return { id: newId(), uuid: sound.uuid, name: String(sound.name).slice(0, 120), alias: "",
    playlist: String(sound.parent?.name ?? "").slice(0, 120), category: "", favorite: false,
    volume: validVolume(sound.volume) ? sound.volume : 0.8, loop: null, fadeIn: 0, fadeOut: 0 };
}

export class PadLibrary {
  constructor(settings = () => game.settings) { this.settings = settings; this.queue = Promise.resolve(); }
  read() { return copy(validateLibrary(this.settings().get(MODULE_ID, "library") ?? EMPTY_LIBRARY)); }
  update(change, expectedRevision) {
    const operation = this.queue.then(async () => {
      requireGM();
      const current = this.read();
      if (expectedRevision !== undefined && current.revision !== expectedRevision) throw new Error(message("Messages.LibraryConflict"));
      const draft = copy(current);
      await change(draft);
      draft.revision = newId();
      validateLibrary(draft);
      requireGM();
      await this.settings().set(MODULE_ID, "library", draft);
      return copy(draft);
    });
    this.queue = operation.catch(() => {});
    return operation;
  }
  async ensure() {
    const current = this.read();
    if (current.pads.length) return current;
    return this.update(draft => {
      if (draft.pads.length) return;
      const pad = { id: newId(), name: message("UI.DefaultPad"), sounds: [] };
      draft.pads.push(pad); draft.activePadId = pad.id;
    });
  }
}
export const library = new PadLibrary();
