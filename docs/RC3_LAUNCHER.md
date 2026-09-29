# RC3: visible SoundPad launcher

Date: 2026-09-29. Candidate: `2.0.0-rc.3`.
Baseline: RC2 commit `af8a6860d02620014b916f6665dd7b256a35ca3a`.

## What changed

A labelled **Open SoundPad / SoundPad öffnen** button now appears at the top of the
Playlists sidebar for GMs. It is also installed in the playlist popout. It does not
require a scene, canvas tools or a macro. Existing settings-menu and macro entry points
remain available. Repeated clicks share a pending opening, then reveal the same pad.
An already-open pad is not re-rendered, preserving unsaved fields; a minimized pad is
restored with ApplicationV2.maximize and brought forward with bringToFront.

`launcher.js` subscribes to the documented `renderPlaylistDirectory` specialization
of the ApplicationV2 render hook during init. It receives a native HTMLElement and
adds a separate, namespaced row without replacing Foundry controls. Framed popouts use
their window-content element. Other layouts fall back to the supplied element itself.
Elements are created through ownerDocument, with textContent for labels and a native
button for keyboard accessibility. No global HTML IDs or core data-action names are used.
Repeated/partial renders reuse one row and one onclick handler. A ready refresh covers
an already-rendered sidebar/popout and enables buttons created before game.ready.

Role checks are enforced when rendering the launcher and again by the shared opener.
Errors opening a pad use the existing notification handler and do not leave an opening
lock stuck. This is not a new server authorization mechanism.

The library schema, user-setting keys, sound documents, socket protocol, audio playback,
target groups, preview and recipient preferences are unchanged from RC2. Stored RC2 pads
are retained. No new dependency, keybinding, export/import or release publication is added.

## Validation

- 22 new Node tests pass locally in `tests/launcher.test.js` using explicit DOM/API doubles.
  Coverage includes GM/player gating, translated/escaped labels, idempotency, replacement
  roots, empty directories, ownerDocument, sidebar/popout placement, startup ordering,
  opening/reopening/minimization, pending-click deduplication and failure recovery.
- The existing static checker passes: 8 runtime modules, 97 EN/DE keys, exact-case imports,
  matching manifest/package versions, manifest assets and basic template/action checks.
- A separate local Chromium 144.0.7559.96 check used the actual launcher module and native
  browser DOM/events: mouse, Enter, Space, repeated hooks, restoration, popout, preservation
  of existing controls and player-side removal passed without uncaught browser errors.
  ApplicationV2 and game were still doubles; this was not Foundry's real sidebar or CSS.
- Existing core tests are preserved unchanged and run with the new tests in GitHub CI.
  Check the workflow for the resulting commit rather than treating old CI as current evidence.

No live Foundry instance, real Foundry sidebar rendering, real Handlebars render or real
multiplayer audio test was performed. Compatibility.verified remains unset and the PR
must remain a draft pending live acceptance. Main and the published release are unchanged.

## Live acceptance

Back up the world and replace `Data/modules/chris-sound-module` with the RC3 folder.
Restart Foundry and reload all browsers. No re-entry of RC2 pads should be necessary.

- [ ] As GM, open the right-hand Playlists tab: one labelled button appears at the top.
- [ ] Click it, click again, minimize the pad, click again: the same pad is foregrounded.
- [ ] Edit a preset without saving, click the launcher: unsaved text remains intact.
- [ ] Create/update a playlist and reopen/pop out its sidebar: no missing/duplicate button.
- [ ] Navigate to the button with Tab and activate with Enter and Space.
- [ ] With no active scene or an empty playlist list, the button still opens the pad.
- [ ] As player, no GM launcher appears. Existing personal audio settings remain available.
- [ ] Check stored pads/groups and an existing macro, then complete the RC2 audio checklist.
- [ ] Inspect consoles for errors with the actual installed theme/sidebar extensions.

## Primary API references

Reviewed on 2026-09-29 against documentation identifying v14.368 Stable:

- https://foundryvtt.com/api/functions/hookEvents.renderApplicationV2.html
- https://foundryvtt.com/api/classes/foundry.applications.sidebar.tabs.PlaylistDirectory.html
- https://foundryvtt.com/api/classes/foundry.applications.api.ApplicationV2.html
