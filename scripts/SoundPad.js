import { refreshRecipients, targetSummary, renderStatus } from "./presentation.js";
import { message, requireGM, reportError } from "./shared.js";
import { library, newEntry, newId } from "./library.js";
import { getService } from "./socket-handler.js";
import { VolumeControl } from "./volume-control.js";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
export class SoundPad extends HandlebarsApplicationMixin(ApplicationV2) {
    static instance = null;
    constructor(options = {}) {
        if (SoundPad.instance)
            return SoundPad.instance;
        super(options);
        this.data = null;
        this.selectedSoundId = null;
        this.targetIds = [];
        this.groupId = "";
        this.search = "";
        this.category = "";
        this.favoritesOnly = false;
        this.drafts = new Map();
        this.editorOpen = false;
        this.sortMode = false;
        this.panels = new Set(["targets"]);
        this.listenerController = null;
        this.padNameDraft = null;
        this.groupNameDraft = null;
        this.groupEditId = "";
        this.volumeControl = new VolumeControl();
        this.targetRevision = 0;
        this.volumeGestures = new WeakMap();
        SoundPad.instance = this;
        getService().tracker.subscribe(() => this.renderStatus());
    }
    static DEFAULT_OPTIONS = {
        id: "soundpad", classes: ["chris-sound-module"], tag: "div",
        position: { width: 800, height: 750 },
        window: { title: "CHRIS_SOUND_MODULE.Setting.SoundPadLabel", icon: "fa-solid fa-music", resizable: true },
        actions: Object.fromEntries(["selectSound", "playSound", "stopSound", "clearSounds", "newPad", "renamePad", "deletePad",
            "applyVolume", "saveVolume", "favorite", "removeSound", "moveUp", "moveDown", "savePreset", "preview", "stopPreview", "panic",
            "saveGroup", "deleteGroup", "selectOnline", "clearTargets", "toggleRecipients", "editSound", "cancelEdit", "toggleSort", "togglePreview", "updateGroup"].map(key => [key, SoundPad.onAction]))
    };
    static PARTS = { pad: { template: "modules/chris-sound-module/templates/soundpad.html" } };
    _canRender(options) { if (super._canRender(options) === false)
        return false; requireGM(); }
    get pad() { return this.data?.pads.find(pad => pad.id === this.data.activePadId); }
    get selected() { return this.pad?.sounds.find(sound => sound.id === this.selectedSoundId); }
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        this.data ??= await library.ensure();
        const saved = this.selected;
        this.volumeControl.select(saved);
        const selected = saved ? { ...saved, ...this.drafts.get(saved.id) } : null;
        const group = this.data.groups.find(group => group.id === this.groupId);
        const users = game.users.contents.map(user => ({ id: user.id, name: user.name, active: user.active, selected: this.targetIds.includes(user.id) }));
        for (const id of this.targetIds)
            if (!game.users.get(id))
                users.push({ id, name: id, active: false, selected: true });
        return { ...context, selectedDirty: Boolean(saved && this.drafts.has(saved.id)),
            pads: this.data.pads.map(pad => ({ ...pad, selected: pad.id === this.pad.id })), padName: this.padNameDraft ?? this.pad.name,
            sounds: this.pad.sounds.map(sound => ({ ...sound, label: sound.alias || sound.name, selected: sound.id === this.selectedSoundId, dirty: this.drafts.has(sound.id), menuOpen: this.panels.has(`entry-${sound.id}`) })),
            savedLabel: saved ? saved.alias || saved.name : message("UI.NoSelection"),
            editorOpen: this.editorOpen && Boolean(saved), sortMode: this.sortMode,
            padsOpen: this.panels.has("pads"), targetsOpen: this.panels.has("targets"), statusOpen: this.panels.has("status"),
            groupEditName: this.data.groups.find(entry => entry.id === this.groupEditId)?.name ?? "",
            canUpdateGroup: Boolean(this.groupEditId && !this.groupId),
            targetSummary: this.targetSummary(), volumeInput: this.volumeControl.input, volumePercent: this.volumeControl.percent,
            selected: selected ? { ...selected, label: selected.alias || selected.name,
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
        // A part may be reused or replaced. Remove listeners from the previous render.
        this.listenerController?.abort();
        const Controller = root.ownerDocument?.defaultView?.AbortController ?? AbortController;
        this.listenerController = new Controller();
        const listen = (type, handler, options = {}) => root.addEventListener(type, handler, {
            ...options, signal: this.listenerController.signal
        });
        listen("change", event => { void this.runAction(() => this.onChange(event)); });
        listen("toggle", event => {
            const panel = event.target.dataset.panel;
            if (panel) {
                if (event.target.open)
                    this.panels.add(panel);
                else
                    this.panels.delete(panel);
            }
        }, { capture: true });
        listen("pointerdown", event => {
            if (event.target.dataset.field === "volume")
                this.beginVolumeGesture(event.target);
        });
        listen("keydown", event => {
            if (event.target.dataset.field === "volume" && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"].includes(event.key))
                this.beginVolumeGesture(event.target);
        });
        listen("input", event => {
            const field = event.target.dataset.field;
            this.captureDraft(event.target);
            if (field === "search") {
                this.search = event.target.value;
                this.filterRows();
            }
            if (field === "volume") {
                this.beginVolumeGesture(event.target);
                const value = Number(event.target.value);
                if (!Number.isFinite(value) || value < 0 || value > 1)
                    return;
                this.volumeControl.setInput(value);
                this.refreshVolume();
            }
        });
        const drop = root.querySelector(".soundpad-drop-area");
        drop.addEventListener("dragover", event => { event.preventDefault(); if (event.dataTransfer)
            event.dataTransfer.dropEffect = "copy"; }, { signal: this.listenerController.signal });
        drop.addEventListener("drop", event => { void this.runAction(() => this._onDrop(event)); }, { signal: this.listenerController.signal });
        this.filterRows();
        this.renderStatus();
        for (const panel of root.querySelectorAll?.("details[data-panel]") ?? [])
            panel.open = this.panels.has(panel.dataset.panel);
        this.refreshRecipients();
        this.refreshVolume();
    }
    /** Update only recipient controls. A checkbox click must not replace its own DOM. */
    refreshRecipients() { return refreshRecipients(this); }
    /** Selection affects future commands only. It never sends audio or edits a saved group. */
    setRecipients(ids, { groupId = "" } = {}) {
        const next = [...new Set(ids)];
        const changed = next.length !== this.targetIds.length || next.some(id => !this.targetIds.includes(id));
        if (groupId) {
            this.groupId = groupId;
            this.groupEditId = groupId;
            this.groupNameDraft = null;
        }
        else {
            this.groupEditId = this.groupId || this.groupEditId;
            this.groupId = "";
        }
        if (changed)
            this.targetRevision++;
        this.targetIds = next;
        this.refreshRecipients();
    }
    captureDraft(target) {
        const field = target.dataset.field;
        if (field === "padName")
            this.padNameDraft = target.value;
        if (field === "groupName")
            this.groupNameDraft = target.value;
        if (!this.selected)
            return;
        const key = field === "repeat" ? "loop" : field;
        if (!["alias", "category", "loop", "fadeIn", "fadeOut"].includes(key))
            return;
        let value = target.value;
        if (key === "loop")
            value = value === "inherit" ? null : value === "yes";
        if (key === "fadeIn" || key === "fadeOut")
            value = Number(value) * 1000;
        this.drafts.set(this.selected.id, { ...this.drafts.get(this.selected.id), [key]: value });
        const notice = this.element?.querySelector?.(".csm-unsaved");
        if (notice)
            notice.hidden = false;
    }
    filterRows() {
        const query = this.search.toLocaleLowerCase();
        for (const row of this.element?.querySelectorAll(".sound-row") ?? []) {
            const sound = this.pad?.sounds.find(sound => sound.id === row.dataset.id);
            if (!sound)
                continue;
            row.hidden = (this.favoritesOnly && !sound.favorite) || (this.category && this.category !== sound.category)
                || ![sound.alias, sound.name, sound.category, sound.playlist].join(" ").toLocaleLowerCase().includes(query);
        }
    }
    targetSummary(ids = this.targetIds) { return targetSummary(this, ids); }
    renderStatus() { return renderStatus(this); }
    async runAction(action) {
        try {
            requireGM();
            return await action();
        }
        catch (error) {
            reportError(error);
            // Refresh stale data after a failed edit; never silently overwrite another window.
            try {
                this.data = library.read();
                if (this.data.pads.length)
                    await this.render();
            }
            catch { /* Preserve the original error. */ }
            return false;
        }
    }
    async mutate(change) {
        this.data = await library.update(change, this.data.revision);
        if (!this.selected)
            this.selectedSoundId = null;
        for (const id of this.drafts.keys())
            if (!this.data.pads.some(pad => pad.sounds.some(sound => sound.id === id)))
                this.drafts.delete(id);
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
            this.volumeControl.select(null);
            const id = event.target.value;
            this.selectedSoundId = null;
            this.category = "";
            this.padNameDraft = null;
            this.editorOpen = false;
            return this.mutate(data => { data.activePadId = id; });
        }
        if (field === "group") {
            const id = event.target.value;
            const group = this.data.groups.find(entry => entry.id === id);
            if (id && !group)
                return;
            // Choosing individual selection keeps the current members; Clear is explicit.
            return this.setRecipients(group ? group.userIds : this.targetIds, { groupId: id });
        }
        if (field === "target") {
            const { value: id, checked } = event.target;
            // Read the changed checkbox, not a :checked snapshot of a replacing part.
            if (typeof checked !== "boolean" || (!game.users.get(id) && !this.targetIds.includes(id)))
                return;
            if (checked === this.targetIds.includes(id))
                return;
            const next = new Set(this.targetIds);
            if (checked)
                next.add(id);
            else
                next.delete(id);
            return this.setRecipients([...next]);
        }
        if (field === "categoryFilter") {
            this.category = event.target.value;
            this.filterRows();
        }
        if (field === "favoritesOnly") {
            this.favoritesOnly = event.target.checked;
            this.filterRows();
        }
        if (field === "volume") {
            this.volumeControl.select(this.selected);
            const gesture = this.volumeGestures.get(event.target);
            this.volumeGestures.delete(event.target);
            if (gesture && (gesture.targets !== this.targetRevision || gesture.selection !== this.volumeControl.selectionRevision)) {
                if (gesture.selection === this.volumeControl.selectionRevision) this.volumeControl.setInput(gesture.input);
                this.refreshVolume();
                throw new Error(message("Messages.VolumeContextChanged"));
            }
            this.volumeControl.setInput(Number(event.target.value));
            this.refreshVolume();
            // Deliberately no socket or settings writes. Applying/saving is explicit.
        }
    }
    /** Keep the gesture bound to the state displayed when it began. */
    beginVolumeGesture(target) {
        this.volumeControl.select(this.selected);
        if (!this.volumeGestures.has(target)) {
            this.volumeGestures.set(target, {
                targets: this.targetRevision,
                selection: this.volumeControl.selectionRevision,
                input: this.volumeControl.input
            });
        }
    }
    refreshVolume() {
        const root = this.element;
        const slider = root?.querySelector?.('[data-field="volume"]');
        if (slider) {
            slider.value = String(this.volumeControl.input);
            slider.setAttribute("aria-valuetext", `${this.volumeControl.percent}%`);
        }
        const label = root?.querySelector?.(".volume-value");
        if (label)
            label.textContent = `${this.volumeControl.percent}%`;
        const save = root?.querySelector?.('[data-action="saveVolume"]');
        if (save)
            save.disabled = !this.selected;
    }
    /** Snapshot recipients before any async work. Selection is never a playback ID. */
    async applyVolume() {
        const targets = [...this.targetIds];
        if (!targets.length)
            throw new Error(message("Messages.SelectPlayerFirst"));
        const gain = this.volumeControl.gain;
        return Promise.allSettled(targets.map(id => getService().volume(id, gain)));
    }
    /** Saving the single control writes only the captured entry, never live audio. */
    async saveVolume() {
        if (!this.selected)
            throw new Error(message("Messages.SelectSoundFirst"));
        const padId = this.pad.id, entryId = this.selected.id, gain = this.volumeControl.gain;
        await this.mutate(data => {
            const entry = data.pads.find(pad => pad.id === padId)?.sounds.find(sound => sound.id === entryId);
            if (!entry)
                throw new Error(message("Messages.SoundNotFoundInPlaylist"));
            entry.volume = gain;
        });
        ui.notifications.info?.(message("Messages.VolumeSaved"));
    }
    async dispatch(action, target) {
        if (action === "applyVolume")
            return this.applyVolume();
        if (action === "saveVolume")
            return this.saveVolume();
        const padId = this.pad.id;
        const id = target?.dataset.id;
        const sound = this.pad.sounds.find(sound => sound.id === id);
        if (action === "editSound") {
            if (sound)
                this.selectedSoundId = id;
            this.volumeControl.select(this.selected);
            this.editorOpen = Boolean(this.selected);
            return this.render();
        }
        if (action === "cancelEdit") {
            if (this.selected)
                this.drafts.delete(this.selected.id);
            this.editorOpen = false;
            return this.render();
        }
        if (action === "toggleSort") {
            this.sortMode = !this.sortMode;
            return this.render();
        }
        if (action === "togglePreview")
            return this.dispatch(getService().preview.current || getService().previewIntent ? "stopPreview" : "preview");
        if (action === "selectSound") {
            if (!sound)
                return;
            this.selectedSoundId = id;
            this.volumeControl.select(this.selected);
            return this.render();
        }
        if (action === "toggleRecipients") {
            const open = !this.panels.has("targets");
            if (open)
                this.panels.add("targets");
            else
                this.panels.delete("targets");
            this.refreshRecipients();
            if (!open)
                this.element?.querySelector?.(".csm-recipient-toggle")?.focus();
            return;
        }
        if (action === "selectOnline")
            return this.setRecipients(game.users.contents.filter(user => user.active && !user.isGM).map(user => user.id));
        if (action === "clearTargets")
            return this.setRecipients([]);
        if (action === "preview") {
            if (!this.selected)
                throw new Error(message("Messages.SelectSoundFirst"));
            this.volumeControl.select(this.selected);
            return getService().previewSound(this.selected.uuid, { ...this.selected, volume: this.volumeControl.gain, label: this.selected.alias || this.selected.name });
        }
        if (action === "stopPreview")
            return getService().stopPreview();
        if (action === "panic")
            return getService().panic();
        if (action === "playSound") {
            if (!this.selected)
                throw new Error(message("Messages.SelectSoundFirst"));
            if (!this.targetIds.length)
                throw new Error(message("Messages.SelectPlayerFirst"));
            this.volumeControl.select(this.selected);
            return getService().playMany([...this.targetIds], this.selected.uuid, { ...this.selected, volume: this.volumeControl.gain, label: this.selected.alias || this.selected.name });
        }
        if (action === "stopSound")
            return Promise.allSettled(this.targetIds.map(id => getService().stop(id)));
        if (action === "newPad" || action === "renamePad") {
            const name = this.field("padName").value.trim();
            if (!name)
                throw new Error(message("Messages.NameRequired"));
            await this.mutate(data => {
                if (action === "newPad") {
                    const pad = { id: newId(), name, sounds: [] };
                    data.pads.push(pad);
                    data.activePadId = pad.id;
                }
                else
                    data.pads.find(pad => pad.id === padId).name = name;
            });
            this.padNameDraft = null;
            return this.render();
        }
        if (action === "deletePad") {
            if (!await this.confirm("UI.ConfirmDeletePad"))
                return;
            return this.mutate(data => {
                data.pads = data.pads.filter(pad => pad.id !== padId);
                if (!data.pads.length)
                    data.pads.push({ id: newId(), name: message("UI.DefaultPad"), sounds: [] });
                data.activePadId = data.pads[0].id;
            });
        }
        if (action === "clearSounds") {
            if (!await this.confirm("UI.ConfirmClear"))
                return;
            return this.mutate(data => { data.pads.find(pad => pad.id === padId).sounds = []; });
        }
        if (["favorite", "removeSound", "moveUp", "moveDown"].includes(action)) {
            if (!sound)
                return;
            return this.mutate(data => {
                const sounds = data.pads.find(pad => pad.id === padId).sounds;
                const index = sounds.findIndex(sound => sound.id === id);
                if (action === "favorite")
                    sounds[index].favorite = !sounds[index].favorite;
                else if (action === "removeSound")
                    sounds.splice(index, 1);
                else {
                    const next = index + (action === "moveUp" ? -1 : 1);
                    if (next >= 0 && next < sounds.length)
                        [sounds[index], sounds[next]] = [sounds[next], sounds[index]];
                }
            });
        }
        if (action === "savePreset") {
            if (!this.selected)
                return;
            const selectedId = this.selected.id;
            const repeat = this.field("repeat").value;
            const values = { alias: this.field("alias").value.trim(), category: this.field("category").value.trim(),
                loop: repeat === "inherit" ? null : repeat === "yes", fadeIn: Number(this.field("fadeIn").value) * 1000,
                fadeOut: Number(this.field("fadeOut").value) * 1000 };
            await this.mutate(data => Object.assign(data.pads.find(pad => pad.id === padId).sounds.find(sound => sound.id === selectedId), values));
            this.drafts.delete(selectedId);
            this.editorOpen = false;
            return this.render();
        }
        if (action === "saveGroup" || action === "updateGroup") {
            const name = this.field("groupName").value.trim(), groupId = action === "updateGroup" ? this.groupEditId : this.groupId, userIds = [...this.targetIds];
            if (action === "updateGroup" && !this.data.groups.some(group => group.id === groupId))
                throw new Error(message("Messages.GroupRequired"));
            if (!name || !userIds.length)
                throw new Error(message("Messages.GroupRequired"));
            const nextId = groupId || newId();
            await this.mutate(data => {
                const group = data.groups.find(group => group.id === nextId);
                if (group)
                    Object.assign(group, { name, userIds });
                else
                    data.groups.push({ id: nextId, name, userIds });
            });
            this.groupId = nextId;
            this.groupEditId = nextId;
            this.groupNameDraft = null;
            return this.render();
        }
        if (action === "deleteGroup") {
            if (!(this.groupId || this.groupEditId) || !await this.confirm("UI.ConfirmDeleteGroup"))
                return;
            const groupId = this.groupId || this.groupEditId;
            await this.mutate(data => { data.groups = data.groups.filter(group => group.id !== groupId); });
            this.groupId = "";
            this.groupEditId = "";
            this.groupNameDraft = null;
            return this.render();
        }
    }
    async _onDrop(event) {
        event.preventDefault();
        requireGM();
        this.data ??= await library.ensure();
        const padId = this.pad.id;
        let data;
        try {
            data = JSON.parse(event.dataTransfer?.getData("text/plain") ?? "");
        }
        catch {
            throw new Error(message("Messages.DropDataError"));
        }
        if (data?.type !== "PlaylistSound" || typeof data.uuid !== "string")
            throw new Error(message("Messages.InvalidDropType"));
        const sound = await foundry.utils.fromUuid(data.uuid);
        requireGM();
        if (sound?.documentName !== "PlaylistSound")
            throw new Error(message("Messages.SoundNotFoundInPlaylist"));
        return this.mutate(data => {
            const pad = data.pads.find(pad => pad.id === padId);
            if (!pad.sounds.some(entry => entry.uuid === sound.uuid))
                pad.sounds.push(newEntry(sound));
        });
    }
    async close(options = {}) { this.listenerController?.abort(); getService().previewIntent = null; await getService().preview.stop({ immediate: true }); return super.close(options); }
}
