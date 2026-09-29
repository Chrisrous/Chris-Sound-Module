# Foundry v14 migration and core expansion

Historical version notes. For current behavior, see [the user guide](../USER_GUIDE.md).
Date: 2026-09-29. Candidate: **2.0.0-rc.2**.
Baseline: `feature/foundry-v14`, RC1 commit `a44c0604b7807bee68a4e040a7b8502b7e9224cd`.
The initial API migration is documented in [the RC1 notes](RC1_MIGRATION_ARCHIVE.md).
RC2 adds persistent storage, feedback and groups.

## Features

| Feature | Implementation |
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
plus 120 seconds, accepted up to 180 seconds ahead). Device clocks should be reasonably aligned.

Same-account, different-window edits use best-effort revision detection, not an atomic server
compare-and-swap. Different GM accounts have separate data. Do not edit one GM library concurrently
in multiple windows. User settings/world backups are not confidential storage for GM secrets.

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
