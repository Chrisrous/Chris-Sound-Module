# RC5: recipient-selection hotfix

Historical version notes. For current behavior, see [the user guide](../USER_GUIDE.md).
Candidate: **2.0.0-rc.5**. Date: 2026-09-29.
Baseline: RC4 commit `ce5408b4c931c4fcadf743bc6a259f9f3e0a645d`.

## Checkbox focus

RC4 rebuilt the recipient controls after each selection change. This removed keyboard focus,
so a second Space press could not toggle the same checkbox without refocusing it. RC5 keeps
the existing controls and updates their state in place.

## Fix

- Replace the recipient `<details>` popup with an explicit **Change selection / Auswahl ändern**
  action button and a controlled inline panel. `aria-expanded` and `aria-controls` describe it.
- The picker is visible on the first opening. Done collapses it and returns keyboard focus to
  its opening button. It can be reopened without rendering or changing selection.
- Use labelled native checkboxes with stable per-user IDs. Handle each change from its own
  `value` and boolean `checked`, not a global `:checked` snapshot of a replacing part.
- Checkbox/group/online/clear changes update only the relevant DOM properties. They do not
  render the whole application, destroy the checkbox, reset scroll or overwrite an active draft.
- Keep summaries, Play/Stop/Volume enabled state and group-edit controls synchronized in place.
- Abort old render listeners before rebinding. After an unrelated render, reapply the current
  selection, not an obsolete template snapshot.
- **Clear selection / Auswahl aufheben** clears targets only. It is not a stop command.
- Offline users remain selectable. A stored group member whose User was deleted gets a
  placeholder checkbox and can be removed from the selection. After removal that placeholder
  is disabled until the next render removes it, without destroying the node mid-change.
- Selecting the individual-selection option retains current members. Group changes remain
  session-only until explicitly saved/updated. Unknown group IDs are ignored.

## Scope contract retained

Selection is not playback. Selecting/deselecting a user, clearing targets or switching groups
never emits Play, Stop or Volume. The selected library entry and stored defaults are untouched.
Existing audio and historical reports retain their identities. Live Volume and recipient Stop
address only the explicitly selected recipients when invoked. A changed target set still
invalidates an in-progress volume gesture, even if the user changes the set back afterwards.

Audio runtime, socket transport, status tracking, library storage, scene/playlist launchers
and personal preferences are unchanged. Library schema 1 and protocol 2 are retained.
No data conversion or additional runtime dependencies.

## Primary API reference

ApplicationV2 rendering replaces inner content. Its action handlers are configured in
DEFAULT_OPTIONS. RC5 uses these hooks without patching Foundry.
https://foundryvtt.com/api/classes/foundry.applications.api.ApplicationV2.html
