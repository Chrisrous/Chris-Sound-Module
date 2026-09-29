# RC1: Foundry v14 migration

Historical version notes. For current behavior, see [the user guide](../USER_GUIDE.md).
Date: 2026-09-28. Candidate: `2.0.0-rc.1`.
Baseline: `Chrisrous/Chris-Sound-Module` main commit `ecb6e01161409ddcdb19fff8d494ec10242722e7`.
Public API reviewed: Foundry VTT **14.368 Stable**.

## API changes

- Replace FormApplication/getData/activateListeners with ApplicationV2,
  HandlebarsApplicationMixin, DEFAULT_OPTIONS, PARTS, _prepareContext and async _onRender.
  Use native DOM listeners and data-action handlers; no jQuery requirement.
- Register the restricted settings submenu in init. All clients register the receiver at ready.
  One entry module imports exact-case paths; the old `./soundpad.js` import did not match `SoundPad.js`.
- Replace HTMLAudioElement with `game.audio.create`, dedicated music/environment/interface
  contexts, audio unlock, Sound.load/play/stop and Sound.fade. Sound.volume is read-only;
  zero-duration fade is the public volume-update path. Use documented playback `onended`.
- Map PlaylistSound.repeat to Sound's loop option (the old code read `sound.loop`).
  Resolve PlaylistSound UUIDs through foundry.utils.fromUuid rather than splitting UUID strings.
- Target the User ID. Retain old name-based macro signatures, but reject ambiguous names.
  Resolve the current document on every Play, so renames and changed audio paths are respected.
- Manage one module-owned sound per receiving browser with cancellation generations. Stop
  cancels deferred playback before unlock/load completes. A newer Play supersedes older work.
  Keep a volume change received while the sound is loading or starting. Never stop ordinary playlists.
- Preserve pad state within the browser session, deduplicate dropped UUIDs, retain target/volume
  across renders, reset selected sound when clearing, localize control text/errors and scope styling.
- No additional runtime dependencies, persistence migration, world document writes, external
  telemetry, automatic release publication, or changes to the original stable release.

## Socket trust boundary

The module uses Foundry's built-in `module.chris-sound-module` socket with `socket: true`.
The server relays module messages to other clients; receiver code filters by User ID before
creating audio. This controls which unmodified client plays a sound, **not who can inspect the packet**.
Audio URLs and packet metadata are not secret or encrypted by this module.

The sender ID in the payload is client-supplied. Checking that it refers to an active GM is
useful defensive validation but is **not authentication or authorization enforced by the server**.
A malicious connected client can forge it. This does not close that trust boundary.
If hostile-client resistance is required, a separately designed authenticated server-supported
transport is needed; swapping to another client-only wrapper must not be assumed to solve it.

## Primary API references

Reviewed on 2026-09-28; documentation can change after this review.

- ApplicationV2: https://foundryvtt.com/api/classes/foundry.applications.api.ApplicationV2.html
- HandlebarsApplicationMixin: https://foundryvtt.com/api/functions/foundry.applications.api.HandlebarsApplicationMixin.html
- Settings submenu: https://foundryvtt.com/api/interfaces/foundry.types.SettingSubmenuConfig.html
- AudioHelper: https://foundryvtt.com/api/classes/foundry.audio.AudioHelper.html
- Sound: https://foundryvtt.com/api/classes/foundry.audio.Sound.html
- Sound creation: https://foundryvtt.com/api/interfaces/foundry.audio.SoundCreationOptions.html
- Sound playback: https://foundryvtt.com/api/interfaces/foundry.audio.SoundPlaybackOptions.html
- PlaylistSound data: https://foundryvtt.com/api/interfaces/foundry.documents.types.PlaylistSoundData.html
- UUID lookup: https://foundryvtt.com/api/functions/foundry.utils.fromUuid.html
- Module manifest and socket relay: https://foundryvtt.com/article/module-development/
