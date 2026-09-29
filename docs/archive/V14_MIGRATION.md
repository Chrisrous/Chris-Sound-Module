# Foundry v14 migration and core expansion

Date: 2026-09-29. Candidate: **2.0.0-rc.2**.
Baseline: `feature/foundry-v14`, RC1 commit `a44c0604b7807bee68a4e040a7b8502b7e9224cd`.
The original 36-test RC1 migration record is retained in [the historical archive](RC1_MIGRATION_ARCHIVE.md).
Statements there about missing persistence, feedback and groups describe RC1 only.

## Implemented scope

| Approved feature | Implementation |
| --- | --- |
| Persistent named pads | Hidden `scope: user` setting, versioned validated data, queued writes, stale-revision checks |
| Playback feedback | Request/session IDs, per-client status sequences, 10-second no-response indicator, independent group outcomes |
| Optional fades | Per-entry 0 to 30000 ms, Foundry `Sound.play({fade})` and `Sound.stop({fade})`, sequential transitions |
| Saved target groups | Named groups of stable User IDs; deduplication and individual offline/failure reporting |
| GM preview | Separate local SoundPlayback instance; dedicated Stop; closing pad stops preview only |
| Sound management | Search, category filtering, favorite toggles, aliases, individual removal, manual up/down ordering |
| Emergency stop | All active recipients, incoming audio, local previews and pending requests; bypasses fade-out |
| Sound presets | Volume, repeat inherit/override, fade-in and fade-out without editing source playlists |
| Player audio preferences | User-scoped factor and mute, applied at start and on subsequent volume/preference changes |

Deferred: export/import, extra quick-access buttons/keybindings, multiple simultaneous incoming
tracks, scene automation and sample-accurate group synchronization. Existing opening macros remain.

## Architecture and compatibility

- `audio.js`: owns created Sound instances, including fading instances until stopped. Cancellable
  waits prevent obsolete work from starting after unlock/load. A late native start is stopped too.
  A 60-second start limit prevents very old sounds from starting after audio finally becomes usable.
- `library.js`: validated version-1 library. Default pads are created on first GM use. Invalid or
  newer data is rejected without reset. User-scoped settings isolate different GM accounts/worlds.
  No original playlist or audio-file writes. There is no RC1 disk migration because RC1 did not persist pads.
- `status.js`: bounded session-local diagnostics (200 requests, at most 16 responding clients per
  request). Request/recipient/session binding and monotonic status sequences reject stale replies.
  Multiple tabs are not falsely represented as exactly-once playback. A volume acknowledgement does
  not hide the original playback's subsequent completion. Status text is inserted via textContent.
- `socket-handler.js`: protocol 2, stable IDs, best-effort claimed-GM validation, duplicate and sequence
  rejection, volatile delivery, cancellation of still-resolving outgoing Play intents, per-recipient
  group outcomes and preserved legacy macro wrappers. All clients must reload when upgrading RC1.
- `SoundPad.js`: ApplicationV2/Handlebars parts and delegated native events. Preset drafts survive
  unrelated renders; save applies them. Volume is perceptually converted and sent once on change.
- `main.js`: init registration, ready receiver/API setup, userConnected updates and personal preferences.

The public v14 documentation was consulted for user-scoped settings, ApplicationV2, DialogV2,
Sound playback/fades, audio unlock and volume conversion, and userConnected. Retrieved public
pages identify v14.368, with one AudioHelper response identifying v14.365. This is an API review,
not execution against either installed Foundry build.

## Trust, transport and operational boundaries

This remains a raw module socket. Packets can be inspected by other connected clients, and the
payload's sender ID is not server-authenticated. Neither role checks nor request IDs make it a
hostile-client-resistant protocol. Acknowledgements are client reports and can also be forged.
Started does not imply that the player's operating system, hardware or Foundry channel is audible.
Personal preferences apply to cooperative module clients, not an adversarially modified client.

Volatile messages are deliberately not buffered or replayed across reconnect. They can be dropped
when transport is unavailable; missing acknowledgements must not be presented as success. No
automatic retry occurs. Emergency stop reaches connected cooperative clients only. A failed local
stop does not prevent sending emergency commands to other recipients. Clock-based packet expiry
allows a bounded age/future window and assumes reasonably aligned device clocks (expiry at send
plus 120 seconds, accepted up to 180 seconds ahead). Test with real machines before release.

Same-account, different-window edits use best-effort revision detection, not an atomic server
compare-and-swap. Different GM accounts have separate data. Do not edit one GM library concurrently
in multiple windows. User settings/world backups are not confidential storage for GM secrets.

## Automated validation

Local environment: Node.js 22.16.0, Python 3, case-sensitive Linux filesystem.
Local result: **83/83 tests pass**, including 9 simulated multi-client transport tests.
Static checks pass for 7 runtime modules and 97 EN/DE localization keys.
The expanded tests replace and extend the RC1 behavioral suite for protocol 2 and persistent UI.
They cover malformed packets, source validation, permissions, repeat/fade options, personal limits,
independent preview, cancellation during UUID resolution/unlock/load/native start/fade-out,
request expiry and duplicates, status ordering/timeouts/multiple tabs, user/world persistence,
write failure and conflicts, library validation, UI operations, native slider events and legacy macros.
An additional in-process relay suite exercises GM and separate player service instances, per-target
acknowledgements, a missing module receiver, unlock cancellation, personal mute, global stop,
repeated packets and two tabs for one user.

Run `npm run check`, `npm test` and `python3 tools/package.py`. A generated test transcript records
actual results; CI results must be checked separately. Tests use doubles. Static template block,
localization and action checks are not a Handlebars compiler or an actual browser render.

## Required live checklist before publishing

Record exact Foundry build, game system, browsers, enabled modules and results. Use a backed-up
v14 test world, a GM browser and at least two player browsers, all on RC2.

- [ ] Install, init/ready, module settings and English/German UI load without console errors.
- [ ] Open, resize, close/reopen and change themes. Confirm the list and controls remain usable.
- [ ] Create/rename/delete pads; drop actual playlist sounds; duplicates stay single; search,
      categories, favorites and ordering work. Source playlists and audio files remain untouched.
- [ ] Save preset aliases/category/repeat/fades. Edit options, move the volume slider or select
      targets before saving: unsaved option drafts must not silently disappear.
- [ ] Reload Foundry/browser and use another browser with the same GM/world: saved pads/groups
      persist. Different GM accounts/worlds remain separate. Test write failure and stale editing.
- [ ] Create/update/delete target groups, including offline/deleted users. Other available members
      still receive audio and each has an honest status. No old command plays when users reconnect.
- [ ] Preview only on GM, while an incoming/self-targeted module sound is already playing.
      Stop preview and close pad without interrupting that incoming sound. Remove the selected
      entry while preview plays and check the dedicated preview Stop remains available.
- [ ] Individual playback: selected player hears audio, unselected player and GM do not. Check
      live loading/started/ended/error reports, absent receiver timeouts and both tabs of one user.
- [ ] Browser audio initially locked, slow/missing files, repeat on/off, each Foundry audio channel.
      Stop while locked/loading/starting. Wait then unlock: cancelled sounds must remain cancelled.
- [ ] Test personal factor and mute before Play, during slow loading, during fade-in/out and after
      GM volume changes. Verify ordinary playlists and channel controls remain unaffected.
- [ ] Test sequential fades and rapid replacement. Emergency stop during active fade, preview,
      queued/native start and slow UUID resolution must prevent obsolete playback returning.
- [ ] Disconnect/reconnect GM and players. No automatic replay. Unreachable recipients must not
      be reported as confirmed stopped. Test aligned and deliberately skewed device clocks.
- [ ] Existing name-based macros and new ID/group/preview/panic APIs work. Inspect consoles for
      deprecations, rejected promises and conflicts with other enabled modules.

## Release gate

Keep PR #6 as draft until live results are recorded. Do not claim `compatibility.verified` or publish
this RC to the stable update channel. After successful live checks, choose a stable version,
synchronize package/manifest versions, set verification to the tested build, and use real released
manifest/ZIP asset URLs. Validate the downloaded archive layout and included manifest.

## Primary references

- https://foundryvtt.com/api/classes/foundry.applications.api.ApplicationV2.html
- https://foundryvtt.com/api/classes/foundry.applications.api.DialogV2.html
- https://foundryvtt.com/api/interfaces/foundry.types.SettingConfig.html
- https://foundryvtt.com/api/classes/foundry.audio.AudioHelper.html
- https://foundryvtt.com/api/classes/foundry.audio.Sound.html
- https://foundryvtt.com/api/interfaces/foundry.audio.SoundPlaybackOptions.html
- https://foundryvtt.com/api/functions/hookEvents.userConnected.html
- https://foundryvtt.com/article/module-development/
- https://socket.io/docs/v4/client-offline-behavior/
