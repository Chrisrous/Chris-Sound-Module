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
    this.editorOpen = false; this.sortMode = false; this.panels = new Set();
    this.padNameDraft = null; this.groupNameDraft = null; this.groupEditId = "";
    this.liveVolume = 0.8; this.targetRevision = 0; this.volumeGestures = new WeakMap();
    SoundPad.instance = this;
    getService().tracker.subscribe(() => this.renderStatus());
  }
  static DEFAULT_OPTIONS = {
    id: "soundpad", classes: ["chris-sound-module"], tag: "div",
    position: { width: 800, height: 750 },
    window: { title: "CHRIS_SOUND_MODULE.Setting.SoundPadLabel", icon: "fa-solid fa-music", resizable: true },
    actions: Object.fromEntries(["selectSound", "playSound", "stopSound", "clearSounds", "newPad", "renamePad", "deletePad",
      "favorite", "removeSound", "moveUp", "moveDown", "savePreset", "preview", "stopPreview", "panic",
      "saveGroup", "deleteGroup", "selectOnline", "editSound", "cancelEdit", "toggleSort", "togglePreview", "updateGroup"].map(key => [key, SoundPad.onAction]))
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
      pads: this.data.pads.map(pad => ({ ...pad, selected: pad.id === this.pad.id })), padName: this.padNameDraft ?? this.pad.name,
      sounds: this.pad.sounds.map(sound => ({ ...sound, label: sound.alias || sound.name, selected: sound.id === this.selectedSoundId, dirty: this.drafts.has(sound.id), menuOpen: this.panels.has(`entry-${sound.id}`) })),
      savedLabel: saved ? saved.alias || saved.name : message("UI.NoSelection"),
      savedPercent: saved ? Math.round(foundry.audio.AudioHelper.volumeToInput(saved.volume) * 100) : 0,
      editorOpen: this.editorOpen && Boolean(saved), sortMode: this.sortMode,
      padsOpen: this.panels.has("pads"), targetsOpen: this.panels.has("targets"), statusOpen: this.panels.has("status"),
      groupEditName: this.data.groups.find(entry => entry.id === this.groupEditId)?.name ?? "",
      canUpdateGroup: Boolean(this.groupEditId && !this.groupId),
      targetSummary: this.targetSummary(), liveVolume: this.liveVolume, livePercent: Math.round(this.liveVolume * 100),
      selected: selected ? { ...selected, label: selected.alias || selected.name,
        slider: foundry.audio.AudioHelper.volumeToInput(selected.volume),
        percent: Math.round(foundry.audio.AudioHelper.volumeToInput(selected.volume) * 100),
        fadeInSeconds: selected.fadeIn / 1000, fadeOutSeconds: selected.fadeOut / 1000,
        loopDefault: selected.loop === null, loopYes: selected.loop === true, loopNo: selected.loop === false } : null,
      users, groups: this.data.groups.map(group => ({ ...group, selected: group.id === this.groupId })), groupName: this.groupNameDraft ?? group?.name ?? this.data.groups.find(entry => entry.id === this.groupEditId)?.name ?? "",
      categories: [...new Set(this.pad.sounds.map(sound => sound.category).filter(Boolean))].sort().map(name => ({ name, selected: this.category === name })),
      search: this.search, favoritesOnly: this.favoritesOnly, hasTargets: this.targetIds.length > 0, canPlay: Boolean(saved && this.targetIds.length)
    };
  }
  async _onRender(context, options) {
    await super._onRender(context, options);
    const root = this.element.querySelector(".chris-sound-soundpad");
    root.addEventListener("change", event => { void this.runAction(() => this.onChange(event)); });
    root.addEventListener("toggle", event => {
      const panel = event.target.dataset.panel;
      if (panel) { if (event.target.open) this.panels.add(panel); else this.panels.delete(panel); }
    }, true);
    root.addEventListener("input", event => {
      const field = event.target.dataset.field;
      this.captureDraft(event.target);
      if (field === "search") { this.search = event.target.value; this.filterRows(); }
      if (field === "presetVolume") {
        const label = root.querySelector(".preset-volume-value");
        if (label) label.textContent = `${Math.round(Number(event.target.value) * 100)}%`;
      }
      if (field === "liveVolume" || field === "volume") {
        if (!this.volumeGestures.has(event.target)) this.volumeGestures.set(event.target, this.targetRevision);
        this.liveVolume = Number(event.target.value);
        const label = root.querySelector(".volume-value");
        if (label) label.textContent = `${Math.round(this.liveVolume * 100)}%`;
      }
    });
    const drop = root.querySelector(".soundpad-drop-area");
    drop.addEventListener("dragover", event => { event.preventDefault(); if (event.dataTransfer) event.dataTransfer.dropEffect = "copy"; });
    drop.addEventListener("drop", event => { void this.runAction(() => this._onDrop(event)); });
    this.filterRows(); this.renderStatus();
    for (const panel of root.querySelectorAll?.("details[data-panel]") ?? []) panel.open = this.panels.has(panel.dataset.panel);
  }
  captureDraft(target) {
    const field = target.dataset.field;
    if (field === "padName") this.padNameDraft = target.value;
    if (field === "groupName") this.groupNameDraft = target.value;
    if (!this.selected || field === "volume") return;
    const key = field === "repeat" ? "loop" : field === "presetVolume" ? "volume" : field;
    if (!["alias", "category", "loop", "fadeIn", "fadeOut", "volume"].includes(key)) return;
    let value = target.value;
    if (key === "volume") value = foundry.audio.AudioHelper.inputToVolume(Number(value));
    if (key === "loop") value = value === "inherit" ? null : value === "yes";
    if (key === "fadeIn" || key === "fadeOut") value = Number(value) * 1000;
    this.drafts.set(this.selected.id, { ...this.drafts.get(this.selected.id), [key]: value });
    const notice = this.element?.querySelector?.(".csm-unsaved");
    if (notice) notice.hidden = false;
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
  targetSummary(ids = this.targetIds) {
    return ids.map(id => {
      const user = game.users.get(id);
      return `${user?.name ?? id}${user?.active ? "" : ` (${message("Status.offline")})`}`;
    }).join(", ") || message("UI.NoTargets");
  }
  renderStatus() {
    const root = this.element?.querySelector?.(".recipient-status");
    if (!root) return;
    const document = root.ownerDocument ?? globalThis.document;
    const rows = getService().tracker.rows();
    const textFor = row => {
      const clients = Object.values(row.clients);
      const details = clients.length ? clients.map(client => `${message(`Status.${client.status}`)}${client.muted || client.factor === 0 ? ` (${message("UI.PersonallyMuted")})` : ""}${client.code ? `: ${message(`Error.${client.code}`)}` : ""}`).join(" / ") : message(`Status.${row.status}`);
      const count = clients.length > 1 ? ` (${message("UI.ClientCount", { count: clients.length })})` : "";
      const level = Number.isFinite(row.volume) ? ` · ${message("UI.RequestedVolume")}: ${Math.round(foundry.audio.AudioHelper.volumeToInput(row.volume) * 100)}%` : "";
      return `${game.users.get(row.userId)?.name ?? row.userId}${count}: ${row.label || message("UI.UnknownSound")} · ${details}${level}`;
    };
    root.replaceChildren();
    const counts = new Map();
    for (const row of rows) {
      counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
      const line = document.createElement("div"); line.textContent = textFor(row); root.append(line);
    }
    const summary = [...counts].map(([status, count]) => `${count} ${message(`Status.${status}`)}`).join(", ") || message("UI.NoStatus");
    const summaryNode = this.element.querySelector(".csm-status-summary");
    if (summaryNode) summaryNode.textContent = summary;
    else { const node = document.createElement("strong"); node.textContent = summary; root.prepend(node); }
    const live = this.element.querySelector(".csm-live-reports");
    if (live) {
      live.replaceChildren();
      for (const id of this.targetIds) {
        const row = rows.find(row => row.userId === id), line = document.createElement("div");
        line.textContent = row ? textFor(row) : `${game.users.get(id)?.name ?? id}: ${message("UI.NoPlaybackReport")}`;
        live.append(line);
      }
      if (!this.targetIds.length) live.textContent = message("UI.NoTargets");
    }
    const warnings = this.element.querySelector(".csm-status-warnings");
    if (warnings) {
      warnings.textContent = rows.filter(row => ["error", "offline", "unknown", "noResponse", "mixed"].includes(row.status))
        .map(row => `${game.users.get(row.userId)?.name ?? row.userId}: ${message(`Status.${row.status}`)}`).join(", ");
      warnings.hidden = !warnings.textContent;
    }
    const service = getService();
    const preview = this.element.querySelector(".preview-status");
    if (preview) preview.textContent = `${service.previewLabel || message("UI.NoPreview")} · ${message(`Status.${service.previewStatus}`)}`;
    const previewButton = this.element.querySelector('[data-action="togglePreview"]');
    if (previewButton) {
      const active = Boolean(service.preview.current || service.previewIntent);
      previewButton.textContent = message(active ? "UI.StopPreview" : "UI.Preview");
      previewButton.disabled = !active && !this.selected;
    }
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
      const id = event.target.value; this.selectedSoundId = null; this.category = ""; this.padNameDraft = null; this.editorOpen = false;
      return this.mutate(data => { data.activePadId = id; });
    }
    if (field === "group") {
      this.groupId = event.target.value; this.groupEditId = this.groupId; this.groupNameDraft = null; this.targetRevision++;
      this.targetIds = [...(this.data.groups.find(group => group.id === this.groupId)?.userIds ?? [])];
      return this.render();
    }
    if (field === "target") {
      this.groupEditId = this.groupId || this.groupEditId; this.groupId = ""; this.targetRevision++;
      this.targetIds = [...this.element.querySelectorAll('[data-field="target"]:checked')].map(input => input.value);
      return this.render();
    }
    if (field === "categoryFilter") { this.category = event.target.value; this.filterRows(); }
    if (field === "favoritesOnly") { this.favoritesOnly = event.target.checked; this.filterRows(); }
    if (field === "liveVolume" || field === "volume") {
      const revision = this.volumeGestures.get(event.target);
      this.volumeGestures.delete(event.target);
      if (revision !== undefined && revision !== this.targetRevision) throw new Error(message("Messages.TargetsChanged"));
      const input = Number(event.target.value);
      if (!Number.isFinite(input) || input < 0 || input > 1) throw new Error(message("Messages.InvalidVolume"));
      this.liveVolume = input;
      const volume = foundry.audio.AudioHelper.inputToVolume(input), targets = [...this.targetIds];
      if (!targets.length) throw new Error(message("Messages.SelectPlayerFirst"));
      // Runtime-only command: NEVER persist to the selected sound or use its identity.
      await Promise.allSettled(targets.map(id => getService().volume(id, volume)));
    }
  }

  async dispatch(action, target) {
    const padId = this.pad.id;
    const id = target?.dataset.id;
    const sound = this.pad.sounds.find(sound => sound.id === id);
    if (action === "editSound") { if (sound) this.selectedSoundId = id; this.editorOpen = Boolean(this.selected); return this.render(); }
    if (action === "cancelEdit") { if (this.selected) this.drafts.delete(this.selected.id); this.editorOpen = false; return this.render(); }
    if (action === "toggleSort") { this.sortMode = !this.sortMode; return this.render(); }
    if (action === "togglePreview") return this.dispatch(getService().preview.current || getService().previewIntent ? "stopPreview" : "preview");
    if (action === "selectSound") { if (!sound) return; this.selectedSoundId = id; return this.render(); }
    if (action === "selectOnline") { this.groupEditId = this.groupId || this.groupEditId; this.groupId = ""; this.targetRevision++; this.targetIds = game.users.contents.filter(user => user.active && !user.isGM).map(user => user.id); return this.render(); }
    if (action === "preview") { if (!this.selected) throw new Error(message("Messages.SelectSoundFirst")); return getService().previewSound(this.selected.uuid, { ...this.selected, label: this.selected.alias || this.selected.name }); }
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
      await this.mutate(data => {
        if (action === "newPad") { const pad = { id: newId(), name, sounds: [] }; data.pads.push(pad); data.activePadId = pad.id; }
        else data.pads.find(pad => pad.id === padId).name = name;
      });
      this.padNameDraft = null; return this.render();
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
      const values = { volume: this.field("presetVolume") ? foundry.audio.AudioHelper.inputToVolume(Number(this.field("presetVolume").value)) : this.selected.volume, alias: this.field("alias").value.trim(), category: this.field("category").value.trim(),
        loop: repeat === "inherit" ? null : repeat === "yes", fadeIn: Number(this.field("fadeIn").value) * 1000,
        fadeOut: Number(this.field("fadeOut").value) * 1000 };
      await this.mutate(data => Object.assign(data.pads.find(pad => pad.id === padId).sounds.find(sound => sound.id === selectedId), values));
      this.drafts.delete(selectedId); this.editorOpen = false; return this.render();
    }
    if (action === "saveGroup" || action === "updateGroup") {
      const name = this.field("groupName").value.trim(), groupId = action === "updateGroup" ? this.groupEditId : this.groupId, userIds = [...this.targetIds];
      if (action === "updateGroup" && !this.data.groups.some(group => group.id === groupId)) throw new Error(message("Messages.GroupRequired"));
      if (!name || !userIds.length) throw new Error(message("Messages.GroupRequired"));
      const nextId = groupId || newId();
      await this.mutate(data => { const group = data.groups.find(group => group.id === nextId);
        if (group) Object.assign(group, { name, userIds }); else data.groups.push({ id: nextId, name, userIds }); });
      this.groupId = nextId; this.groupEditId = nextId; this.groupNameDraft = null; return this.render();
    }
    if (action === "deleteGroup") {
      if (!(this.groupId || this.groupEditId) || !await this.confirm("UI.ConfirmDeleteGroup")) return;
      const groupId = this.groupId || this.groupEditId;
      await this.mutate(data => { data.groups = data.groups.filter(group => group.id !== groupId); });
      this.groupId = ""; this.groupEditId = ""; this.groupNameDraft = null; return this.render();
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
