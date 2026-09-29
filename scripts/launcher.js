import { requireGM, message, reportError } from "./shared.js";
import { SoundPad } from "./SoundPad.js";

const LAUNCHER_CLASS = "chris-sound-module-launcher";
const registeredHooks = new WeakSet();
let opening = null;

/** Open or reveal the existing pad without re-rendering unsaved form fields. */
export function openSoundPad() {
  requireGM();
  if (opening) return opening;
  opening = (async () => {
    const pad = new SoundPad();
    if (!pad.rendered) await pad.render({ force: true });
    requireGM();
    if (pad.minimized) await pad.maximize();
    pad.bringToFront();
    return pad;
  })().finally(() => { opening = null; });
  return opening;
}

async function onOpen(event) {
  event.preventDefault();
  event.stopPropagation();
  try { return await openSoundPad(); }
  catch (error) { reportError(error); return false; }
}

/**
 * v14 renderPlaylistDirectory hook: native HTMLElement, including sidebar popouts.
 * This is a separate row above the directory, not a replacement of core controls.
 */
export function renderPlaylistLauncher(application, element = application?.element) {
  if (!element?.querySelectorAll || !element.ownerDocument) return;
  const existing = [...element.querySelectorAll(`.${LAUNCHER_CLASS}`)];
  if (!game.user?.isGM) {
    for (const row of existing) row.remove();
    return;
  }

  const document = element.ownerDocument;
  // Framed popouts have a content container; embedded tabs use the element itself.
  const content = element.querySelector(".window-content") ?? element;
  const row = existing.shift() ?? document.createElement("div");
  for (const duplicate of existing) duplicate.remove();
  row.className = LAUNCHER_CLASS;
  let button = row.querySelector("button");
  if (!button) {
    button = document.createElement("button");
    button.type = "button";
    button.className = "chris-sound-module-open";
    const icon = document.createElement("i");
    icon.className = "fa-solid fa-music";
    icon.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    button.append(icon, label);
    row.append(button);
  }
  const label = message("Setting.OpenSoundPad");
  button.querySelector("span").textContent = label;
  button.title = label;
  button.setAttribute("aria-label", label);
  button.disabled = !game.ready;
  // Assign rather than accumulate handlers when only one Handlebars part re-renders.
  button.onclick = onOpen;
  if (content.firstElementChild !== row) content.prepend(row);
}

/** Register before the initial sidebar render; repeated calls are harmless. */
export function registerSoundPadLauncher() {
  if (registeredHooks.has(Hooks)) return;
  Hooks.on("renderPlaylistDirectory", renderPlaylistLauncher);
  registeredHooks.add(Hooks);
}

/** Catch an already-rendered sidebar at ready without forcing a directory re-render. */
export function refreshSoundPadLauncher() {
  const directory = ui.playlists;
  for (const application of [directory, directory?.popout]) {
    if (application?.element) renderPlaylistLauncher(application, application.element);
  }
}
