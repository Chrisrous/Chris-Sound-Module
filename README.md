# Chris Sound Module

A GM-operated SoundPad for playing playlist sounds on one selected user's client.
English and German interface; game-system independent; no additional Foundry module dependencies.

## Foundry v14 migration: 2.0.0-rc.1

This is a **manual-install release candidate**, targeting Foundry VTT v14 and reviewed
against the public v14.368 API. Automated tests use API doubles, not Foundry itself.
**Live GM/player testing is still required.** Compatibility `verified` is intentionally
not claimed. This branch does not support Foundry v12/v13; keep the older version for those installations.

### Install the release candidate

1. Back up the existing `Data/modules/chris-sound-module` directory and stop Foundry.
2. Extract the supplied ZIP into your Foundry user-data `Data/modules` directory.
   The final manifest must be `Data/modules/chris-sound-module/module.json` (no double nesting).
3. Restart Foundry, enable Chris Sound Module in a v14 test world, and reload all clients.
4. Open SoundPad through Configure Settings, or run the opening macro below.
5. Complete the [live smoke-test checklist](docs/V14_MIGRATION.md#live-smoke-test-checklist).

The candidate manifest deliberately omits `manifest` and `download`: it must not point
at the old v1.1.0 ZIP, a non-existent release, or the main-branch manifest while under test.
It is not distributed by the existing stable auto-update channel. See the release gate
in the migration document before publishing a stable version.

## Using the SoundPad

Drag a **PlaylistSound** from a playlist into the drop zone. Select a sound, select an
online user, then press Play. The volume shown in the pad is used when playback starts;
changing the slider sends its value when the change is committed/released. Stop affects
only this module's sound for the selected user, never the world's ordinary playlist playback.
The playlist sound's `repeat` and audio channel are respected. Playback also follows the
receiving user's Foundry audio-channel controls, browser policy and audio device settings.

Only one module sound is controlled per receiving browser. A new Play replaces the previous
module sound; it does not layer another inaccessible audio element on top. GMs can select
themselves for local playback. Offline users are disabled and checked again when a command is sent.
Sound entries, selection and volume survive closing/reopening the same pad during a browser
session. They are **not persisted across a browser reload**. Removing entries from the pad
does not stop an already-playing sound; use Stop for that.

## Macros and module API

Existing name-based macros remain available:

```javascript
await playSoundForPlayer("Player6", "Ambient Sounds", "Tor");
await changeVolumeForPlayer("Player6", 0.4);
await controlSoundForPlayer("Player6", "stopSound");
```

Names must identify a unique user, playlist and sound. Ambiguous names now produce an
error rather than potentially addressing the wrong user. Legacy global wrappers notify
on failure and return `false`; direct module API methods reject/throw on invalid operations.

The preferred API uses a User ID and a PlaylistSound UUID:

```javascript
const sound = game.modules.get("chris-sound-module").api;
await sound.openSoundPad();
// Replace the example IDs with your own user's ID and the playlist sound UUID.
await sound.playSoundForUser("USER_ID", "Playlist.PLAYLIST_ID.PlaylistSound.SOUND_ID", { volume: 0.4 });
await sound.changeVolumeForUser("USER_ID", 0.2);
await sound.stopSoundForUser("USER_ID");
```

`window.SoundPad`, `window.soundPad` (GM only), and `soundPad.render(true)` remain available.
Internal FormApplication overrides and the old global `currentAudio` are not supported APIs.
The UUID is resolved again on each Play, so renaming or moving the sound's asset path does
not break a pad entry. Removing/recreating its document does require dragging it in again.
A remote API return value of `true` means **command sent**, not confirmed playback or audibility.

## Security and limitations

All public control methods require a GM; receivers validate the payload, target and claimed
GM role. **The raw Foundry module socket does not authenticate the client-supplied sender ID.**
These checks protect ordinary use, not against a malicious connected client forging messages.
Socket packets are relayed to other connected clients: targeted playback is not confidential
transport and does not hide audio paths or packet contents. Do not send secrets in audio URLs.
See [the documented trust boundary](docs/V14_MIGRATION.md#socket-trust-boundary).

If nothing is heard, first click inside the receiving browser to unlock its audio, check its
Foundry audio-channel volume and ensure the file URL is accessible to that browser. Playback
errors notify the receiving client; remote success/error acknowledgements are not implemented.
Enable diagnostic console logging in module settings when troubleshooting.

## Development

Node.js 22+ and Python 3 are sufficient; no `npm install` is needed.

```sh
npm run check
npm test
python3 tools/package.py
```

The package command creates a deterministic manual-install ZIP and SHA-256 checksum in `dist/`.
CI repeats static checks, unit tests and packaging. No workflow publishes or deploys a release.
The tests cover module behavior with doubles; they do not certify Foundry rendering, WebAudio,
real browser autoplay, network routing, multi-client delivery, or other-module interactions.

## License

MIT, copyright Chrisrous. See [LICENSE](LICENSE).
