# RC4 interface and scope contract

Historical version notes. For current behavior, see [the user guide](../USER_GUIDE.md).
Date: 2026-09-29. Candidate: `2.0.0-rc.4`. Visible name: **Chris SoundPad**.
Baseline: `e715033a8e0855d2bd2cf5805db8f1645b3ffb35` (RC3).

## Purpose

Provide a direct left-hand opening control and simplify session-time operation without
removing existing capabilities. Most importantly, never equate a library selection with
currently running audio. Keep preparation, recipient control and local preview separate.

## Operation scopes

| Element | Scope | Side effect |
| --- | --- | --- |
| Select entry | Library selection / next start | No audio or recipient command |
| Next start label | Saved selected entry and current target IDs | Not a playback claim |
| Edit default volume / repeat / fades / alias / category | Draft of that entry | No persistence or playback until Save |
| Save preset | Persist selected entry's draft | No command, source playlist unchanged |
| Cancel edit | Discard that entry's draft | No command or saved-data change |
| Play | Saved selected entry, recipient IDs snapshotted for the call | Replaces module audio at those recipients |
| Preview / stop preview | Separate local preview | Does not affect recipient or normal playlist audio |
| Live volume | Current selected recipients, independent of selected entry | Changes their current/pending module sound only |
| Stop selected recipients | Current selected recipients | Stops their module audio/pending work, not selected library entry |
| Stop all module sounds | All reachable clients, local preview | Immediate, no confirm, not ordinary playlists |
| Remove entry / clear / delete pad | Library metadata | Does not stop audio or delete source documents/assets |

Live volume is deliberately labelled a **new value to send**, not a reading. Its release
never saves a preset. An in-progress slider gesture is rejected if recipient selection has
changed. It is available with no selected library entry. Default volume is saved explicitly
in the editor and shown next to Next start. Play/Preview always use saved options. Unsaved
editor values remain visible as drafts but cannot be mistaken for an already-saved start.

Example: Rain is reported playing for Anna. Selecting Door creak changes Next start only.
Live volume and recipient Stop still address Anna's actual module playback. Changing to Ben
shows Ben's report or an explicit unknown/no-report message. Anna is not stopped implicitly.
All reports remain accessible in Details. Preview keeps its own label after any selection change.

## Report semantics

The existing session-local tracker remains the source of recipient diagnostics. Stop reports
retain the previous sound label rather than substituting the selected entry. Volume acknowledgements
do not replace the original play record, so its later end report remains visible. A volume
acknowledgement tied to an older play cannot overwrite the newer play's requested volume.

This is not a synchronized global mixer. Reports only describe responses to commands from this
GM session. Other GM sessions, disconnects, reloads, packet loss and missing replies can make
actual playback different or unknown. All report sections explicitly describe last reports.
No report does not mean stopped. A stop/volume command addresses actual current module audio at
the named recipients even when its identity is unknown. This limitation is not hidden by the UI.

Client mute/factor and multiple tabs remain visible in detailed reports. Failure/unknown/offline
warnings are also shown outside the collapsed detail panel. No packet authentication or privacy
claim has been added. Socket protocol 2 and its trust boundary are unchanged.

## Layout / complete action mapping

One primary view: compact pad/recipient controls, filterable scrolling sound list, editor on
request, fixed transport. No second basic/expert mode. Each of the original 18 actions remains:

| Original action | Reachable control |
| --- | --- |
| selectSound | Sound row |
| playSound | Next start: Play |
| stopSound | Recipient transport: Stop selected recipients |
| clearSounds | Manage pad: Remove all sounds, with confirmation |
| newPad | Manage pad: New pad |
| renamePad | Manage pad: Rename |
| deletePad | Manage pad: Delete pad, with confirmation |
| favorite | Star on each sound row |
| removeSound | Entry Actions: Remove |
| moveUp | Manage pad: Sort mode, then row Up |
| moveDown | Manage pad: Sort mode, then row Down |
| savePreset | Edit sound: Save |
| preview | Transport Preview toggle while idle |
| stopPreview | Same toggle while playing or awaiting preview |
| panic | Always-visible emergency Stop |
| saveGroup | Change selection: Save group |
| deleteGroup | Change selection: Delete group, with confirmation |
| selectOnline | Change selection: Online players |

Existing search/category/favorite filters, drag-and-drop, setting controls, macros and API are
retained. Added convenience actions: Edit, Cancel, Sort toggle, Preview toggle and explicit Update
group. Editing group membership switches to individual selection without silently saving it.
Updating the old group and saving a new individual group are separate choices.

Open details sections, typed pad/group names and per-entry preset drafts survive unrelated
renders. Save/Cancel close the editor. Removing an entry clears its draft. Sound-list scrolling
does not move the transport. The editor adapts to a narrow window through scoped container CSS.

## Launchers and compatibility

Branding changes only visible strings and module title. Keep the module ID, module folder,
settings keys, library schema 1, stable stored entry IDs and all public macro signatures.
RC2/RC3 pads/groups/preferences require no data conversion.

Register a GM-only control under the unique module ID using `getSceneControlButtons` and a
headphones icon. A `renderSceneControls` listener captures clicks on the module's own
`data-control` element before the core delegated action, opens the singleton window and leaves
the active canvas tool alone. Repeated hooks do not accumulate listeners. A nested button tool
is a fallback for altered markup. No core controls are replaced, monkey-patched or removed.

The actual first-column markup and interaction ordering must be tested in Foundry and with
third-party UI themes. The unit/native-DOM tests are not proof of those integrations. When scene
controls are unavailable, the retained playlist/settings/macro opening paths still exist.
The playlist and left buttons share the same open/reveal/minimized-restoration function.

## Official API references

Reviewed against public v14.368 documentation on 2026-09-29:

- https://foundryvtt.com/api/functions/hookEvents.getSceneControlButtons.html
- https://foundryvtt.com/api/interfaces/foundry.SceneControl.html
- https://foundryvtt.com/api/classes/foundry.applications.ui.SceneControls.html
- https://foundryvtt.com/api/functions/hookEvents.renderApplicationV2.html
- https://foundryvtt.com/api/classes/foundry.applications.api.ApplicationV2.html
