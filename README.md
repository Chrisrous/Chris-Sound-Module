# Chris Sound Module

A GM-operated SoundPad for targeted playlist audio. Foundry VTT v14, English/German,
no additional Foundry module or npm runtime dependencies.

## 2.0.0-rc.2: core feature expansion

This is a **manual-install release candidate**. The v14 API migration and the feature
expansion have automated tests, but **no real Foundry/browser/multi-client certification**.
`compatibility.verified` is deliberately unset. Main and the stable release are not updated.
Foundry v12/v13 are not supported by this candidate.

### Included

- Named sound pads and target groups saved in user-scoped world settings.
- Search, favorites, categories, custom display names, individual removal and manual ordering.
- Per-entry volume, repeat override and fade-in/fade-out presets. The original playlist is unchanged.
- Independent local preview with its own Stop button.
- Recipient-specific loading, audio-permission, playback, completion, error and timeout reports.
- An emergency Stop for all connected module clients, including previews and pending requests.
- Each player controls their own module volume factor and mute in module settings.
- Cancellation guards, duplicate suppression and non-buffered socket delivery. No automatic replay.

**Deferred comfort package:** JSON export/import and additional quick-access buttons/keybindings.
Parallel audio tracks, scene automation and synchronized/sample-accurate starts are also out of scope.

## Install / upgrade the candidate

1. Back up the Foundry world and existing `Data/modules/chris-sound-module` directory.
2. Stop Foundry. Replace the module directory with the directory inside the candidate ZIP.
3. Check `Data/modules/chris-sound-module/module.json`: version must be `2.0.0-rc.2`.
4. Restart Foundry, enable the module in a v14 test world and reload **all** clients.
5. Open SoundPad via Configure Settings or the macro below. Complete the live checklist in
   [the migration and test record](docs/V14_MIGRATION.md).

Do not mix RC1 and RC2 browser tabs: the socket protocol changed. RC1 had no persistent pads,
so drag its desired sounds into RC2 once. The RC intentionally has no `manifest`/`download`
update URLs. It is not distributed by the previous stable automatic update channel.

## SoundPad workflow

Enter a name and create a pad. Drag PlaylistSound entries into the drop zone. Use search,
category and favorite filters; the arrow buttons change the full saved order, not just the
filtered view. Removing entries or pads does not delete playlist documents or audio files.
Removing an entry does not stop playback. Use Stop or the emergency button.

Select an entry to edit its display name, category, repeat setting and fades (0 to 30 seconds).
**Save those options before Play or Preview.** Unsaved edits are retained while editing and
marked when rendered. Volume is saved and sent on slider release, not on every input event.
The UI uses Foundry's perceptual volume conversion; macro volume arguments remain linear 0 to 1.
Repeat can inherit the current playlist setting or be overridden per entry.

Select recipients with the checkboxes. Offline users remain visible and can be stored in groups,
but playback is sent only to available recipients. Selecting a saved group restores its User IDs.
Choosing the manual entry allows a new group. Saving a selected existing group updates it.
Preview is local to the GM and never changes the selected players' audio. Closing the pad stops
preview only. One incoming module sound per browser replaces the previous one. Transitions are
sequential fade-out then fade-in, not simultaneous crossfades. Fade-out applies to Stop/replacement.

Each recipient can set **Personal module volume factor** (0 to 1) or **Mute module sounds**.
Effective sound gain is sender volume multiplied by that factor, or zero while muted, followed
by Foundry's normal channel/device controls. Preview respects the same local preference.

## Status and operational limits

A return value of `true` from an individual remote control method means **sent**, not confirmed
playback or audibility. Use the status panel or `getPlaybackStatus()` for client reports.
No response after 10 seconds is distinct from an explicit waiting-for-audio report. Audio that
cannot begin within 60 seconds is cancelled and requires a new command. Commands are not retried
or replayed after disconnect. A local socket disconnect stops this module's audio and cancels work.
The emergency button cannot control unreachable clients. Retry it after restoring connectivity.
Multiple tabs for one user can each play sound; their replies are displayed separately.

User-scoped settings separate GM libraries and are part of that Foundry world's data. They are
not an encrypted secret store. Same-user concurrent editing has stale-revision checks but no
server-side compare-and-swap guarantee; avoid simultaneous edits in two tabs of one GM account.

Raw module packets are relayed to other connected clients. Targeted playback is **not confidential
transport**. Claimed GM sender IDs and client acknowledgements are not authenticated by this module
and can be forged by a hostile connected client. Do not put secrets into URLs or assume the status
panel proves actual hearing. No telemetry or permanent recipient activity history is stored.

## Macros and module API

```javascript
const audio = game.modules.get("chris-sound-module").api;
await audio.openSoundPad();
await audio.playSoundForUser("USER_ID", "Playlist.PLAYLIST_ID.PlaylistSound.SOUND_ID", {
  volume: 0.4, loop: false, fadeIn: 500, fadeOut: 1000 // Fades in milliseconds in the API.
});
await audio.playSoundForUsers(["USER_ID_A", "USER_ID_B"], "Playlist.PLAYLIST_ID.PlaylistSound.SOUND_ID");
await audio.changeVolumeForUser("USER_ID", 0.2);
await audio.stopSoundForUser("USER_ID");
await audio.previewSound("Playlist.PLAYLIST_ID.PlaylistSound.SOUND_ID");
await audio.stopPreview();
await audio.stopAllModuleSounds();
console.log(audio.getPlaybackStatus()); // Session-local snapshot, not an audibility guarantee.
```

The three legacy name-based macro signatures are retained, with ambiguous names rejected:

```javascript
await playSoundForPlayer("Player6", "Ambient Sounds", "Tor");
await changeVolumeForPlayer("Player6", 0.4);
await controlSoundForPlayer("Player6", "stopSound");
```

Legacy globals notify and return false on failure. Preferred API calls reject invalid operations;
group calls return per-recipient outcomes, and status reports arrive asynchronously. `SoundPad`
and `soundPad` remain available. Internal UI fields and the old global `currentAudio` are not APIs.

## Development

Node.js 22+ and Python 3 are sufficient. No `npm install` is required.

```sh
npm run check
npm test
python3 tools/package.py
```

Tests include small API/DOM doubles and an in-process multi-client relay simulation. They do not
run Foundry, compile templates with real Handlebars, exercise real WebAudio/Socket.IO or certify
integration with third-party modules. CI validates and builds only; it does not publish releases.

MIT, copyright Chrisrous. See [LICENSE](LICENSE).
