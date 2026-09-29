# API and macros

Use `game.modules.get("chris-sound-module").api` after Foundry's `ready` event. Control methods
require a GM. Public methods use linear gain in [0, 1], not the perceptual UI slider position.
RC6's one-slider UI does not change the API defaults or packet protocol.

```js
const api = game.modules.get("chris-sound-module").api;
await api.openSoundPad();
await api.playSoundForUser("USER_ID", "Playlist.PLAYLIST_ID.PlaylistSound.SOUND_ID", {
    volume: 0.4, loop: false, fadeIn: 500, fadeOut: 1000
});
await api.changeVolumeForUser("USER_ID", 0.2);
await api.stopSoundForUser("USER_ID");
```

Replace the example IDs with real world document IDs. Durations are milliseconds in [0, 30000].
Omitted options inherit the playlist sound where supported (volume/repeat/channel).

| Method | Result/meaning |
| --- | --- |
| `openSoundPad()` | Promise resolving to the single SoundPad window |
| `playSoundForUser(userId, uuid, options)` | Sent/executed boolean; false can indicate superseded work |
| `playSoundForUsers(userIds, uuid, options)` | Per-recipient result array; failures do not block other recipients |
| `changeVolumeForUser(userId, gain)` | Updates the user's current/pending module audio, not a pad preset |
| `stopSoundForUser(userId)` | Stops current/pending module audio for that user |
| `previewSound(uuid, options)` | Local preview independent from recipient playback |
| `stopPreview()` | Cancels/stops local preview only |
| `stopAllModuleSounds()` | Emergency stop for reachable module clients and local preview |
| `getPlaybackStatus()` | Copy of session-local last-report rows, not an authoritative live mixer |

Direct control methods throw/reject on invalid operations. A remote success return means a
command was sent, not that playback started or was audible. Inspect reported status separately.
User IDs, sound UUIDs and labels are not authentication or confidentiality controls.

## Legacy macros

```js
await playSoundForPlayer("Player6", "Ambient Sounds", "Gate");
await changeVolumeForPlayer("Player6", 0.4);
await controlSoundForPlayer("Player6", "stopSound");
```

The global wrappers notify on failure and return false. Names must be unambiguous. Existing
`window.SoundPad`, `window.soundPad` and `soundPad.render(true)` entry points remain available.
Internal fields, DOM selectors and event-handler methods are not a stable public API.

## References

The implementation targets the public Foundry v14 API:
https://foundryvtt.com/api/classes/foundry.audio.AudioHelper.html
https://foundryvtt.com/api/classes/foundry.audio.Sound.html
https://foundryvtt.com/api/classes/foundry.applications.api.ApplicationV2.html
