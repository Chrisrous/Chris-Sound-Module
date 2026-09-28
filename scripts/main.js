import { MODULE_ID, requireGM, reportError } from "./shared.js";
import { SoundPad } from "./SoundPad.js";
import {
  registerSocket, playSoundForUser, stopSoundForUser, changeVolumeForUser,
  playSoundForPlayer, controlSoundForPlayer, changeVolumeForPlayer
} from "./socket-handler.js";

export function openSoundPad() {
  requireGM();
  return new SoundPad().render({ force: true });
}

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "enableLogging", {
    name: "CHRIS_SOUND_MODULE.Setting.EnableLoggingName",
    hint: "CHRIS_SOUND_MODULE.Setting.EnableLoggingHint",
    scope: "client", config: true, default: false, type: Boolean
  });
  game.settings.registerMenu(MODULE_ID, "soundpad", {
    name: "CHRIS_SOUND_MODULE.Setting.OpenSoundPad",
    label: "CHRIS_SOUND_MODULE.Setting.SoundPadLabel",
    icon: "fa-solid fa-music", type: SoundPad, restricted: true
  });
});

Hooks.once("ready", () => {
  registerSocket(); // All clients must receive commands, not just GMs.
  game.modules.get(MODULE_ID).api = Object.freeze({
    SoundPad, openSoundPad, playSoundForUser, stopSoundForUser, changeVolumeForUser,
    playSoundForPlayer, controlSoundForPlayer, changeVolumeForPlayer
  });
  // Existing macros need not change. New integrations should use the module API.
  const legacy = { playSoundForPlayer, controlSoundForPlayer, changeVolumeForPlayer };
  for (const [name, action] of Object.entries(legacy)) {
    globalThis[name] = async (...args) => {
      try { return await action(...args); }
      catch (error) { reportError(error); return false; }
    };
  }
  globalThis.SoundPad = SoundPad;
  if (game.user.isGM) globalThis.soundPad = new SoundPad();
});
