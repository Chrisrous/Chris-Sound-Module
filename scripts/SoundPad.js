import { message, requireGM, reportError } from "./shared.js";
import { library, newEntry, newId } from "./library.js";
import { getService } from "./socket-handler.js";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class SoundPad extends HandlebarsApplicationMixin(ApplicationV2) {
  static instance = null;
  constructor(options = {}) {
    if (SoundPad.instance) return SoundPad.instance;
    super(options);
    this.data = null; this.selectedSoundId = null; this.targetIds = []; this.groupId = "";
    this.search = ""; this.category = ""; this.favoritesOnly = false; this.drafts = new Map();
    SoundPad.instance = this;
    getService().tracker.subscribe(() => this.renderStatus());
  }
  static DEFAULT_OPTIONS = {
    id: "soundpad", classes: ["chris-sound-module"], tag: "div",
    position: { width: 690, height: 760 },
    window: { title: "CHRIS_SOUND_MODULE.Setting.SoundPadLabel", icon: "fa-solid fa-music", resizable: true },
    actions: Object.fromEntries(["selectSound", "playSound", "stopSound", "clearSounds", "newPad", "renamePad", "deletePad",
      "favorite", "removeSound", "moveUp", "moveDown", "savePreset", "preview", "stopPreview", "panic",
      "saveGroup", "deleteGroup", "selectOnline"].map(key => [key, SoundPad.onAction]))
  };
  static PARTS = { pad: { template: "modules/chris-sound-module/templates/soundpad.html" } };
  _canRender(options) { if (super._canRender(options) === false) return false; requireGM(); }
  get pad() { return this.data?.pads.find(pad => pad.id === this.data.activePadId); }
  get selected() { return this.pad?.sounds.find(sound => sound.id === this.selectedSoundId); }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    this.data ??= await library.ensure();
    const saved = this.selected;
    const selected = saved ? { ...saved, ...this.drafts.get(saved.id) } : null;
    const group = this.data.groups.find(group => group.id === this.groupId);
    const users = game.users.contents.map(user => ({ id: user.id, name: user.name, active: user.active, selected: this.targetIds.includes(user.id) }));
    for (const id of this.targetIds) if (!game.users.get(id)) users.push({ id, name: id, active: false, selected: true });
    return { ...context, selectedDirty: Boolean(saved && this.drafts.has(saved.id)),
      pads: this.data.pads.map(pad => ({ ...pad, selected: pad.id === this.pad.id })), padName: this.pad.name,
      sounds: this.pad.sounds.map(sound => ({ ...sound, label: sound.alias || sound.name, selected: sound.id === this.selectedSoundId })),
      selected: selected ? { ...selected, label: selected.alias || selected.name,
        slider: foundry.audio.AudioHelper.volumeToInput(selected.volume),
        percent: Math.round(foundry.audio.AudioHelper.volumeToInput(selected.volume) * 100),
        fadeInSeconds: selected.fadeIn / 1000, fadeOutSeconds: selected.fadeOut / 1000,
        loopDefault: selected.loop === null, loopYes: selected.loop === true, loopNo: selected.loop === false } : null,
      users, groups: this.data.groups.map(group => ({ ...group, selected: group.id === this.groupId })), groupName: group?.name ?? "",
      categories: [...new Set(this.pad.sounds.map(sound => sound.category).filter(Boolean))].sort().map(name => ({ name, selected: this.category === name })),
      search: this.search, favoritesOnly: this.favoritesOnly, hasTargets: this.targetIds.length > 0
    };
  }
  async _onRender(context, options) {
    await super._onRender(context, options);
    const root = this.element.querySelector(".chris-sound-soundpad");
    root.addEventListener("change", event => { void this.runAction(() => this.onChange(event)); });
    root.addEventListener("input", event => {
      const field = event.target.dataset.field;
      this.captureDraft(event.target);
      if (field === "search") { this.search = event.target.value; this.filterRows(); }
      if (field === "volume") root.querySelector(".volume-value").textContent = `${Math.round(Number(event.target.value) * 100)}%`;
    });
    const drop = root.querySelector(".soundpad-drop-area");
    drop.addEventListener("dragover", event => { event.preventDefault(); if (event.dataTransfer) event.dataTransfer.dropEffect = "copy"; });
    drop.addEventListener("drop", event => { void this.runAction(() => this._onDrop(event)); });
    this.filterRows(); this.renderStatus();
  }
  captureDraft(target) {
    if (!this.selected) return;
    const field = target.dataset.field;
    const key = field === "repeat" ? "loop" : field;
    if (!["alias", "category", "loop", "fadeIn", "fadeOut"].includes(key)) return;
    let value = target.value;
    if (key === "loop") value = value === "inherit" ? null : value === "yes";
    if (key === "fadeIn" || key === "fadeOut") value = Number(value) * 1000;
    this.drafts.set(this.selected.id, { ...this.drafts.get(this.selected.id), [key]: value });
  }
  filterRows() {
    const query = this.search.toLocaleLowerCase();
    for (const row of this.element?.querySelectorAll(".sound-row") ?? []) {
      const sound = this.pad?.sounds.find(sound => sound.id === row.dataset.id);
      if (!sound) continue;
      row.hidden = (this.favoritesOnly && !sound.favorite) || (this.category && this.category !== sound.category)
        || ![sound.alias, sound.name, sound.category, sound.playlist].join(" ").toLocaleLowerCase().includes(query);
    }
  }
  renderStatus() {
    const root = this.element?.querySelector(".recipient-status");
    if (!root) return;
    root.replaceChildren();
    const rows = getService().tracker.rows();
    const counts = new Map();
    for (const row of rows) {
      counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
      const line = document.createElement("div");
      const clients = Object.values(row.clients);
      const details = clients.length ? clients.map(client => `${message(`Status.${client.status}`)}${client.muted || client.factor === 0 ? ` (${message("UI.PersonallyMuted")})` : ""}${client.code ? `: ${message(`Error.${client.code}`)}` : ""}`).join(" / ") : message(`Status.${row.status}`);
      const count = clients.length > 1 ? ` (${message("UI.ClientCount", { count: clients.length })})` : "";
      line.textContent = `${game.users.get(row.userId)?.name ?? row.userId}${count}: ${details}${row.label ? ` | ${row.label}` : ""}`;
      root.append(line);
    }
    const summary = document.createElement("strong");
    summary.textContent = [...counts].map(([status, count]) => `${count} ${message(`Status.${status}`)}`).join(", ") || message("UI.NoStatus");
    root.prepend(summary);
    const preview = this.element.querySelector(".preview-status");
    if (preview) preview.textContent = message(`Status.${getService().previewStatus}`);
  }
  async runAction(action) {
    try { requireGM(); return await action(); }
    catch (error) {
      reportError(error);
      // Refresh stale data after a failed edit; never silently overwrite another window.
      try { this.data = library.read(); if (this.data.pads.length) await this.render(); } catch { /* Preserve the original error. */ }
      return false;
    }
  }
  async mutate(change) {
    this.data = await library.update(change, this.data.revision);
    if (!this.selected) this.selectedSoundId = null;
    for (const id of this.drafts.keys()) if (!this.data.pads.some(pad => pad.sounds.some(sound => sound.id === id))) this.drafts.delete(id);
    await this.render();
  }
  static onAction(event, target) { return this.runAction(() => this.dispatch(target.dataset.action, target)); }
  field(name) { return this.element.querySelector(`[data-field="${name}"]`); }
  async confirm(key) {
    return foundry.applications.api.DialogV2.confirm({ window: { title: message("UI.ConfirmTitle") }, content: `<p>${message(key)}</p>`, rejectClose: false });
  }
  async onChange(event) {
    const { field } = event.target.dataset;
    this.captureDraft(event.target);
    if (field === "pad") {
      const id = event.target.value; this.selectedSoundId = null; this.category = "";
      return this.mutate(data => { data.activePadId = id; });
    }
    if (field === "group") {
      this.groupId = event.target.value;
      this.targetIds = [...(this.data.groups.find(group => group.id === this.groupId)?.userIds ?? [])];
      return this.render();
    }
    if (field === "target") {
      this.targetIds = [...this.element.querySelectorAll('[data-field="target"]:checked')].map(input => input.value);
      return this.render();
    }
    if (field === "categoryFilter") { this.category = event.target.value; this.filterRows(); }
    if (field === "favoritesOnly") { this.favoritesOnly = event.target.checked; this.filterRows(); }
    if (field === "volume" && this.selected) {
      const volume = foundry.audio.AudioHelper.inputToVolume(Number(event.target.value));
      const id = this.selected.id, padId = this.pad.id, targets = [...this.targetIds];
      await this.mutate(data => { data.pads.find(pad => pad.id === padId).sounds.find(sound => sound.id === id).volume = volume; });
      await Promise.allSettled(targets.map(id => getService().volume(id, volume)));
    }
  }
  async dispatch(action, target) {
    const padId = this.pad.id;
    const id = target?.dataset.id;
    const sound = this.pad.sounds.find(sound => sound.id === id);
    if (action === "selectSound") { this.selectedSoundId = id; return this.render(); }
    if (action === "selectOnline") { this.targetIds = game.users.contents.filter(user => user.active && !user.isGM).map(user => user.id); return this.render(); }
    if (action === "preview") { if (!this.selected) throw new Error(message("Messages.SelectSoundFirst")); return getService().previewSound(this.selected.uuid, this.selected); }
    if (action === "stopPreview") return getService().stopPreview();
    if (action === "panic") return getService().panic();
    if (action === "playSound") {
      if (!this.selected) throw new Error(message("Messages.SelectSoundFirst"));
      if (!this.targetIds.length) throw new Error(message("Messages.SelectPlayerFirst"));
      return getService().playMany(this.targetIds, this.selected.uuid, { ...this.selected, label: this.selected.alias || this.selected.name });
    }
    if (action === "stopSound") return Promise.allSettled(this.targetIds.map(id => getService().stop(id)));
    if (action === "newPad" || action === "renamePad") {
      const name = this.field("padName").value.trim();
      if (!name) throw new Error(message("Messages.NameRequired"));
      return this.mutate(data => {
        if (action === "newPad") { const pad = { id: newId(), name, sounds: [] }; data.pads.push(pad); data.activePadId = pad.id; }
        else data.pads.find(pad => pad.id === padId).name = name;
      });
    }
    if (action === "deletePad") {
      if (!await this.confirm("UI.ConfirmDeletePad")) return;
      return this.mutate(data => {
        data.pads = data.pads.filter(pad => pad.id !== padId);
        if (!data.pads.length) data.pads.push({ id: newId(), name: message("UI.DefaultPad"), sounds: [] });
        data.activePadId = data.pads[0].id;
      });
    }
    if (action === "clearSounds") {
      if (!await this.confirm("UI.ConfirmClear")) return;
      return this.mutate(data => { data.pads.find(pad => pad.id === padId).sounds = []; });
    }
    if (["favorite", "removeSound", "moveUp", "moveDown"].includes(action)) {
      if (!sound) return;
      return this.mutate(data => {
        const sounds = data.pads.find(pad => pad.id === padId).sounds;
        const index = sounds.findIndex(sound => sound.id === id);
        if (action === "favorite") sounds[index].favorite = !sounds[index].favorite;
        else if (action === "removeSound") sounds.splice(index, 1);
        else { const next = index + (action === "moveUp" ? -1 : 1); if (next >= 0 && next < sounds.length) [sounds[index], sounds[next]] = [sounds[next], sounds[index]]; }
      });
    }
    if (action === "savePreset") {
      if (!this.selected) return;
      const selectedId = this.selected.id;
      const repeat = this.field("repeat").value;
      const values = { alias: this.field("alias").value.trim(), category: this.field("category").value.trim(),
        loop: repeat === "inherit" ? null : repeat === "yes", fadeIn: Number(this.field("fadeIn").value) * 1000,
        fadeOut: Number(this.field("fadeOut").value) * 1000 };
      await this.mutate(data => Object.assign(data.pads.find(pad => pad.id === padId).sounds.find(sound => sound.id === selectedId), values));
      this.drafts.delete(selectedId); return this.render();
    }
    if (action === "saveGroup") {
      const name = this.field("groupName").value.trim(), groupId = this.groupId, userIds = [...this.targetIds];
      if (!name || !userIds.length) throw new Error(message("Messages.GroupRequired"));
      const nextId = groupId || newId();
      await this.mutate(data => { const group = data.groups.find(group => group.id === nextId);
        if (group) Object.assign(group, { name, userIds }); else data.groups.push({ id: nextId, name, userIds }); });
      this.groupId = nextId; return this.render();
    }
    if (action === "deleteGroup") {
      if (!this.groupId || !await this.confirm("UI.ConfirmDeleteGroup")) return;
      const groupId = this.groupId;
      await this.mutate(data => { data.groups = data.groups.filter(group => group.id !== groupId); });
      this.groupId = ""; return this.render();
    }
  }
  async _onDrop(event) {
    event.preventDefault(); requireGM();
    this.data ??= await library.ensure();
    const padId = this.pad.id;
    let data;
    try { data = JSON.parse(event.dataTransfer?.getData("text/plain") ?? ""); } catch { throw new Error(message("Messages.DropDataError")); }
    if (data?.type !== "PlaylistSound" || typeof data.uuid !== "string") throw new Error(message("Messages.InvalidDropType"));
    const sound = await foundry.utils.fromUuid(data.uuid); requireGM();
    if (sound?.documentName !== "PlaylistSound") throw new Error(message("Messages.SoundNotFoundInPlaylist"));
    return this.mutate(data => { const pad = data.pads.find(pad => pad.id === padId);
      if (!pad.sounds.some(entry => entry.uuid === sound.uuid)) pad.sounds.push(newEntry(sound)); });
  }
  async close(options = {}) { getService().previewIntent = null; await getService().preview.stop({ immediate: true }); return super.close(options); }
}
