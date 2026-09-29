# Chris SoundPad

GM-controlled, targeted playlist audio for Foundry VTT v14. German and English interface.
Technical module ID: `chris-sound-module`. No additional runtime dependencies.

## 2.0.0-rc.5: recipient-selection hotfix

**Manual-install release candidate, not live-Foundry certified.** The feature branch and
PR remain separate from main and the published release. No `compatibility.verified` claim.

### Recipient selection in RC5

The recipient list is visible on first opening. **Change selection** opens/closes it,
and **Done** collapses it. Tick or untick a player's box or label. Space works while
that checkbox is focused. Selection no longer re-renders the entire window.
**Clear selection** deselects all recipients without stopping any audio. **Online players**
selects connected non-GM users. Group and sound drafts survive recipient edits.
See [RC5 fix and live checks](docs/RC5_RECIPIENT_FIX.md) for reproduction and test limits.

### Opening

As a GM, click the **headphones control in the left scene-controls column**, or open
**Playlists > Open Chris SoundPad** in the right sidebar or playlist popout. All entry
points reveal the same window, restore it when minimized and preserve unsaved fields.
The playlist button also works without an active scene. Settings and macros remain available.

The left control uses v14 scene-control registration and a native render-hook listener
on its own button to avoid changing the current canvas tool. Third-party themes replacing
that markup need live testing. A nested Open tool remains as a fallback.

### Selection is not playback

Suppose **Rain** is playing for Anna and you select **Door creak**:

- **Next start** shows Door creak, its saved default volume and the intended recipients.
  Selecting it sends nothing. Play and Preview use saved presets, not unsaved editor drafts.
- **Playback at selected recipients** still reports Rain for Anna, with the last client status.
  Selecting a different sound never relabels those reports.
- **New volume value** is a value to send to those recipients' current module sound.
  Releasing this slider does not save anything to Door creak or Rain. It works without
  selecting any library entry. It is not a measurement of the players' effective loudness.
- **Stop selected recipients** stops their current/pending module sound, regardless of
  which library entry is selected. Changing the recipient selection does not stop the old one.
- **Preview** is local and separately labelled. Its toggle stops only the preview.
  **Stop all module sounds** is the independent emergency stop, without a confirmation dialog.

To change a sound's default volume, choose **Edit sound**, adjust **Default volume**, then
**Save**. This changes future starts only. **Cancel** discards that entry's draft.

## Interface and retained features

Choose a pad at the top. **Manage pad** contains create, rename, delete, clear and sort mode.
Search, category and favorite filters stay above the scrollable sound list. Drag playlist
sounds directly into that list. Each row offers selection, favorite and an Actions menu.
Edit opens a side panel. Sort mode reveals the existing up/down ordering controls.

The recipient summary is always visible. Expand **Change selection** for individual users,
online players and saved groups. Editing a selected group's checkboxes switches to individual
selection without modifying the saved group. Use the explicit **Update group** action to
write back to it, or save the individual selection as a new group.

All existing core capabilities remain: named pads per GM/world, saved target groups,
search/categories/favorites/aliases, single-entry removal and ordering, volume/repeat/fade
presets, local preview, remote status, panic stop, personal player volume/mute and legacy macros.
Presets never modify source playlists. Removing an entry or pad never deletes audio files
or stops playback. Pad/group deletion and clearing still require confirmation.

The bottom transport stays outside the sound-list scroll area. Status details are collapsible,
but offline/error/unknown/no-response warnings remain visible. Saved and pending form values
survive ordinary redraws. Multiple tabs of one player remain distinguishable in reports.

One incoming module sound per browser replaces the previous one. Fades are 0 to 30 seconds,
sequential fade-out then fade-in, not simultaneous crossfades. Personal volume/mute is available
in module settings and cannot be overridden by ordinary GM control commands.

**Still deferred:** JSON export/import and configurable keybindings. Parallel tracks,
scene automation and sample-accurate synchronization are outside this release.

## Installation / upgrade

1. Back up the world and `Data/modules/chris-sound-module`.
2. Stop Foundry and replace that module folder with the same-named folder in the RC5 ZIP.
3. Confirm `Data/modules/chris-sound-module/module.json` says `2.0.0-rc.5`.
4. Restart Foundry, enable **Chris SoundPad** in a v14 test world and reload every client.
5. Run the [RC5 recipient checks](docs/RC5_RECIPIENT_FIX.md) and the earlier core acceptance checks.

RC5 keeps RC2/RC3/RC4 library schema 1, setting keys and socket protocol 2. Existing pads,
groups and personal settings need no migration. RC1 tabs use a different protocol and
must not remain connected. This candidate does not support v12/v13 and deliberately
omits stable `manifest`/`download` URLs. It is not published through the old update channel.

## Reports and trust boundaries

Reports are the **last responses to this GM browser session's commands**, not a global,
authoritative live mixer. A different GM, a page reload, disconnected client or missing
reply can leave actual playback unknown. No report means unknown, not silence. Stop and
live volume target the named recipients' actual current module sound, even if that sound
is different from the last reported one. Requested volume values are not effective device gain.

A returned `true` means command sent, not audibility. No response after 10 seconds is distinct
from waiting for audio permission. Audio unable to start within 60 seconds is cancelled.
Commands are not replayed on reconnect. Emergency stop cannot reach disconnected browsers.
Normal Foundry playlists are never stopped by this module. Closing the pad stops only preview.

User-scoped settings belong to the world and separate GM libraries. Same-user concurrent edits
have revision checks, not atomic server compare-and-swap. Avoid editing one GM's library in
multiple tabs simultaneously. Each player tab can receive and play audio separately.

Raw module socket packets are relayed and are **not confidential**. Claimed GM sender IDs
and acknowledgements are not authenticated by this module. A hostile connected client can
forge them. Do not put secrets in audio URLs. No telemetry or permanent listening log is stored.

## Macros / public API

```javascript
const audio = game.modules.get("chris-sound-module").api;
await audio.openSoundPad();
await audio.playSoundForUser("USER_ID", "Playlist.PLAYLIST_ID.PlaylistSound.SOUND_ID", {
  volume: 0.4, loop: false, fadeIn: 500, fadeOut: 1000
});
await audio.playSoundForUsers(["USER_ID_A", "USER_ID_B"], "Playlist.PLAYLIST_ID.PlaylistSound.SOUND_ID");
await audio.changeVolumeForUser("USER_ID", 0.2);
await audio.stopSoundForUser("USER_ID");
await audio.previewSound("Playlist.PLAYLIST_ID.PlaylistSound.SOUND_ID");
await audio.stopPreview();
await audio.stopAllModuleSounds();
console.log(audio.getPlaybackStatus());
```

API volumes are linear 0 to 1, fades are milliseconds. UI sliders use Foundry's perceptual
conversion. Legacy globals still notify and return false on failure:

```javascript
await playSoundForPlayer("Player6", "Ambient Sounds", "Tor");
await changeVolumeForPlayer("Player6", 0.4);
await controlSoundForPlayer("Player6", "stopSound");
```

Ambiguous names are rejected. Preferred APIs reject invalid operations, group calls return
per-recipient outcomes. `SoundPad` and `soundPad` remain available. Internal UI fields are not API.

## Development / validation

Node.js 22+ and Python 3, no npm install required:

```sh
npm run check
npm test
python3 tools/package.py
```

Historical RC4 validation: **135 passing automated tests**, including the original transport
simulation, plus 13 separate native-browser harness checks. The harness loads actual module
JS/CSS but uses custom template expansion and Foundry doubles. It is **not real Foundry,
its Handlebars runtime, real networked multiplayer or real WebAudio acceptance**.
CI validates and builds only, never publishes. Check the PR for its independently reported result.

RC5 adds 16 recipient-selection regression tests. The 46 locally available recipient/RC4
tests and 14 offline Chromium checks pass. The full repository suite is checked independently
in GitHub Actions. See the current PR and [RC5 fix record](docs/RC5_RECIPIENT_FIX.md).

See [RC4 design and acceptance](docs/RC4_INTERFACE.md), [RC3 launcher history](docs/RC3_LAUNCHER.md),
[RC2 core migration](docs/V14_MIGRATION.md) and [RC1 archive](docs/RC1_MIGRATION_ARCHIVE.md).
MIT, copyright Chrisrous. See [LICENSE](LICENSE).
