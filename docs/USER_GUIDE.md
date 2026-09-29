# User guide

## Installation and opening

Use a backed-up v14 test world. Stop Foundry and replace only
`Data/modules/chris-sound-module` with the directory from the module ZIP. Restart and reload
all GM/player browsers. Confirm the version in Module Management. Do not nest the module twice.
Keep the world data: pads and groups are stored there, not in the module directory.

Open the GM-only window with the left headphones control, the right Playlists button or
Settings. All entry points reveal the same window, including when minimized.

## Prepare a sound

Choose a named pad and drag a PlaylistSound into it. Select an entry without starting playback.
Search, category and favorites filter the list. Actions > Edit sound edits the display name,
category, repeat and fade-in/fade-out (0 to 30 seconds). Save commits those settings. Cancel
discards those editor changes. These edits never modify the source playlist.

The single volume slider is outside the editor and is independent of editor Save/Cancel.
Selecting another entry loads that entry's saved default. Reselecting the same entry and
ordinary redraws retain your prepared level. No audio or storage writes occur when you drag it.

## Use the one volume slider

| Action | Effect |
| --- | --- |
| Move the slider | Prepare the level for the next Play or Preview |
| Play | Start the selected saved sound with the prepared level for the displayed recipients |
| Preview | Start local GM preview with the prepared level |
| Apply to recipient playback | Change recipients' current or pending module sound, even with no entry selected |
| Save as sound default | Save the prepared level to the selected entry for later selection/starts |

Example: Rain is playing for Alice. Select Door and set 30%. Rain remains unchanged. Play
starts Door at 30%. Apply changes whatever module sound Alice currently has to 30%, even if
it is still Rain. Save as sound default writes 30% to Door only.

The Apply button always names its recipients in the same control area. Changing recipients
sends nothing. A sound/recipient change during a slider gesture cancels that gesture. Device
volume, Foundry channel volume and the player's personal module limit still apply.

## Recipients and groups

Change selection opens the inline checkbox list. Click the box/name or use Space. Select online
players excludes GMs. Clear selection removes ticks without stopping audio. Offline users and
removed users referenced by a saved group remain explicitly deselectable.

Changing a stored group's membership switches to individual selection. Update group or Save
group is required to persist it. Group edits do not overwrite pads or start playback.

## Stop and monitor

Stop recipient selection affects those users' actual current/pending module audio, not the
selected list entry. Preview Stop affects preview only. Emergency Stop also cancels pending
module playback, but cannot reach disconnected clients and never stops normal world playlists.

The next-play label, local preview and last recipient reports have separate identities.
Loading/waiting-for-audio is not success. Ended means a past sound ended, not a global guarantee
of silence. After a GM reload or another GM's command, state may be unknown. Multiple tabs
report separately. Requested level is not a measurement of physical loudness.

## Troubleshooting

Check recipient selection, network connection, file availability and local mute/channel level.
Click in the player browser to unlock audio. Run all browsers on the same module candidate.
If a problem persists, include exact Foundry build, system, browser, module version, reproduction
steps and redacted console errors in an issue. Do not publish signed audio URLs or world data.
