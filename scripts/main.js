import { MODULE_ID, requireGM, reportError } from "./shared.js";
import { SoundPad } from "./SoundPad.js";
import { EMPTY_LIBRARY } from "./library.js";
import { getService, registerSocket, playSoundForUser, stopSoundForUser, changeVolumeForUser,
  playSoundForUsers, stopAllModuleSounds, previewSound, stopPreview,
  playSoundForPlayer, controlSoundForPlayer, changeVolumeForPlayer } from "./socket-handler.js";

export function openSoundPad() { requireGM(); return new SoundPad().render({ force: true }); }
const refreshPreferences = () => { if (game.ready) void getService().refreshPreferences().catch(reportError); };
Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "enableLogging", {
    name: "CHRIS_SOUND_MODULE.Setting.EnableLoggingName", hint: "CHRIS_SOUND_MODULE.Setting.EnableLoggingHint",
    scope: "client", config: true, default: false, type: Boolean
  });
  game.settings.register(MODULE_ID, "library", { name: "SoundPad library", hint: "", scope: "user", config: false, type: Object, default: EMPTY_LIBRARY });
  game.settings.register(MODULE_ID, "personalVolume", {
    name: "CHRIS_SOUND_MODULE.Setting.PersonalVolumeName", hint: "CHRIS_SOUND_MODULE.Setting.PersonalVolumeHint",
    scope: "user", config: true, type: Number, default: 1, range: { min: 0, max: 1, step: 0.01 }, onChange: refreshPreferences
  });
  game.settings.register(MODULE_ID, "personalMute", {
    name: "CHRIS_SOUND_MODULE.Setting.PersonalMuteName", hint: "CHRIS_SOUND_MODULE.Setting.PersonalMuteHint",
    scope: "user", config: true, type: Boolean, default: false, onChange: refreshPreferences
  });
  game.settings.registerMenu(MODULE_ID, "soundpad", {
    name: "CHRIS_SOUND_MODULE.Setting.OpenSoundPad", label: "CHRIS_SOUND_MODULE.Setting.SoundPadLabel",
    icon: "fa-solid fa-music", type: SoundPad, restricted: true
  });
});
Hooks.once("ready", () => {
  registerSocket();
  game.modules.get(MODULE_ID).api = Object.freeze({ SoundPad, openSoundPad,
    playSoundForUser, stopSoundForUser, changeVolumeForUser, playSoundForUsers, stopAllModuleSounds, previewSound, stopPreview,
    getPlaybackStatus: () => structuredClone(getService().tracker.rows().map(({ timer, ...row }) => row)),
    playSoundForPlayer, controlSoundForPlayer, changeVolumeForPlayer });
  for (const [name, action] of Object.entries({ playSoundForPlayer, controlSoundForPlayer, changeVolumeForPlayer })) {
    globalThis[name] = async (...args) => { try { return await action(...args); } catch (error) { reportError(error); return false; } };
  }
  globalThis.SoundPad = SoundPad;
  if (game.user.isGM) globalThis.soundPad = new SoundPad();
  Hooks.on("userConnected", (user, connected) => {
    if (!connected) getService().tracker.disconnected(user.id);
    if (SoundPad.instance?.rendered) void SoundPad.instance.render().catch(reportError);
  });
});
