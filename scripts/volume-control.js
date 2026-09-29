import { message, validVolume } from "./shared.js";
/**
 * One editable level for the next Play/Preview. Never sends audio or writes storage.
 * Explicit application actions decide whether to use it for live audio or a preset.
 * Values in this model are perceptual slider positions, not WebAudio gain.
 */
export class VolumeControl {
    constructor() {
        this.input = 0.8;
        this.selectionId = null;
        this.selectionRevision = 0;
    }
    /** A different selected entry loads its saved default without touching playback. */
    select(entry) {
        const id = entry?.id ?? null;
        if (id === this.selectionId)
            return;
        this.selectionId = id;
        this.selectionRevision++;
        if (entry)
            this.input = foundry.audio.AudioHelper.volumeToInput(entry.volume);
    }
    setInput(value) {
        if (typeof value !== "number" || !validVolume(value)) {
            throw new Error(message("Messages.InvalidVolume"));
        }
        this.input = value;
    }
    get gain() {
        return foundry.audio.AudioHelper.inputToVolume(this.input);
    }
    get percent() {
        return Math.round(this.input * 100);
    }
}
