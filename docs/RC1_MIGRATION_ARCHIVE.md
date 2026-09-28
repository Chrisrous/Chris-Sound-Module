# Foundry v14 migration and validation record

Date: 2026-09-28. Candidate: `2.0.0-rc.1`.
Baseline: `Chrisrous/Chris-Sound-Module` main commit `ecb6e01161409ddcdb19fff8d494ec10242722e7`.
Public API reviewed: Foundry VTT **14.368 Stable**.

## Scope and migration decisions

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

## Validation status

**Implemented and locally tested, not runtime-certified in Foundry.**

Local tools: Node.js 22.16.0, Python 3, Linux filesystem (case-sensitive).
`npm test`: 36 automated tests passing against deliberately small API/DOM doubles.
`npm run check`: runtime JavaScript syntax, exact-case relative imports, referenced manifest
assets, locale key parity/completeness and basic Handlebars block balance.
`python3 tools/package.py`: deterministic ZIP build, integrity check, packaged manifest match,
SHA-256 checksum. These are not a complete Handlebars compiler or Foundry integration tests.

Test coverage includes invalid/misaddressed messages, best-effort claimed-sender filtering,
read-only audio volume, repeat/channel mapping, independent module playback, self-targeting,
rapid replacement, stop before audio unlock, stop during load/play, volume during unlock/load/play,
failed or superseded load completion, natural end, duplicate names, offline/disconnected targets,
permission rechecks, legacy macros, init/ready wiring, pad selection/drop state and native input/change events.

**Not executed:** actual v14 launch, real Handlebars rendering, drag payloads from the real playlist
sidebar, AudioContext/channel behavior, browser autoplay, real Socket.IO relay, two-client playback,
multiple tabs for one user, hot reload, or interactions with third-party modules/game systems.
No compatibility `verified` flag is set. CI execution status is separate from local test results.

## Socket trust boundary

The module uses Foundry's built-in `module.chris-sound-module` socket with `socket: true`.
The server relays module messages to other clients; receiver code filters by User ID before
creating audio. This controls which unmodified client plays a sound, **not who can inspect the packet**.
Audio URLs and packet metadata are not secret or encrypted by this module.

The sender ID in the payload is client-supplied. Checking that it refers to an active GM is
useful defensive validation but is **not authentication or authorization enforced by the server**.
A malicious connected client can forge it. Do not claim this closes that trust boundary.
If hostile-client resistance is required, a separately designed authenticated server-supported
transport is needed; swapping to another client-only wrapper must not be assumed to solve it.

## Live smoke-test checklist

Use a backup/test world on v14.368, a GM browser and a separate player browser; ideally add
a second player to confirm they do not hear audio intended for the first. All run the same RC.
Record exact Foundry build, game system version, browsers and enabled modules with the result.

- [ ] Install without a double-nested module folder; see version 2.0.0-rc.1; no missing-import error.
- [ ] Open from settings and a macro, close/reopen, resize and change EN/DE language/theme.
      One pad instance retains its session entries, selection, target and slider value.
- [ ] Drop a real playlist sound, select it, repeat the drop (no duplicate). Try an invalid drop.
- [ ] Play for player A: A hears it, player B and GM do not. Self-target GM: GM hears it once.
      Normal world playlists continue unaffected. Multiple tabs of one user may each receive it.
- [ ] Test non-looping and repeating sounds; verify playlist music/environment/interface channels
      and receiving-client channel controls. Slider 0 must mute; 1 must not exceed channel limits.
- [ ] Play repeatedly; only the latest module sound remains. Stop silences it. Change volume
      during slow loading. Stop immediately after Play; no later restart when loading completes.
- [ ] Repeat before the receiving browser's first audio gesture. A stopped pending sound must
      not start on the first click. A still-current pending sound may then start normally.
- [ ] Rename a sound/playlist and change the asset path: UUID-based playback still finds it.
      Delete the sound: localized error, no crash or stale source replay. Test duplicate names in macros.
- [ ] Try offline users, lost network, missing files and browser audio failures. No unhandled
      rejection. Note that the GM currently receives no remote playback acknowledgement.
- [ ] Run all three legacy macros and preferred ID-based API calls. Non-GM control is refused
      in ordinary use; do not treat the sender ID checks as protection against packet forgery.
- [ ] Remove pad entries: selected entry clears, but existing playback continues until Stop.
      Reloading the browser clears pad entries (persistence is not in this release).
- [ ] Inspect both clients' consoles for runtime errors/deprecation warnings throughout.

## Release gate

Keep the candidate on its feature branch until the live checklist is recorded as passing.
Only then promote the code, choose a stable version and synchronize module.json/package.json,
set compatibility.verified to the actually tested Foundry build, and restore the intended stable
manifest URL plus a download URL for a real release asset. Verify the download itself, its archive
layout and the included manifest before advertising the stable installation/update link.
Do not point main's public manifest at the old v1.1.0 ZIP or publish a nonexistent future asset URL.

## Optional follow-up improvements (not included)

1. Persist named sound pads per GM/world, with search, categories and individual removal.
2. Return playback success/failure acknowledgements to the GM, with request IDs and timeouts.
3. Add optional fade-in/fade-out and saved target groups, with explicit rules for overlapping audio.

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
