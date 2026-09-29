# RC3: visible SoundPad launcher

Historical version notes. For current behavior, see [the user guide](../USER_GUIDE.md).
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

## Primary API references

- https://foundryvtt.com/api/functions/hookEvents.renderApplicationV2.html
- https://foundryvtt.com/api/classes/foundry.applications.sidebar.tabs.PlaylistDirectory.html
- https://foundryvtt.com/api/classes/foundry.applications.api.ApplicationV2.html
