export const MODULE_ID = "chris-sound-module";
export const SOCKET_CHANNEL = `module.${MODULE_ID}`;
export const AUDIO_CHANNELS = new Set(["music", "environment", "interface"]);

export function message(key, data = {}) {
  return game.i18n.format(`CHRIS_SOUND_MODULE.${key}`, data);
}

export function requireGM() {
  if (!game.user?.isGM) throw new Error(message("Messages.GmOnly"));
}

export function logMessage(...args) {
  if (game.settings.get(MODULE_ID, "enableLogging")) {
    console.debug(`${MODULE_ID} |`, ...args);
  }
}

export function reportError(error) {
  console.error(`${MODULE_ID} |`, error);
  ui.notifications.error(error instanceof Error ? error.message : message("Messages.CommandFailed"));
}

export function validVolume(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

export function validSource(src) {
  if (typeof src !== "string" || !src.trim() || src.length > 8192 || /[\x00-\x1f]/.test(src)) return false;
  // Foundry data paths and HTTP(S) assets are supported; executable/inline schemes are not.
  const scheme = src.trim().match(/^([a-z][a-z\d+.-]*):/i);
  return !scheme || ["http", "https"].includes(scheme[1].toLowerCase());
}
