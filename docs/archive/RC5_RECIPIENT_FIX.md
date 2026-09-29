# RC5: recipient-selection hotfix

Candidate: **2.0.0-rc.5**. Date: 2026-09-29.
Baseline: RC4 commit `ce5408b4c931c4fcadf743bc6a259f9f3e0a645d`.

## Report and reproduced issue

The user reported being unable to select or deselect players in the live RC4 window.
Their screenshot shows a collapsed recipient disclosure with no selected recipients.
The exact reported mouse failure is **not proven reproduced** in the local harness.

A related, concrete RC4 bug was reproduced with actual module JavaScript and native Chromium DOM:
focus a recipient checkbox, press Space, and wait for the resulting render. RC4 replaces the
whole part, moves focus to BODY and increments its render count. Pressing Space again no
longer unchecks that recipient. A subsequent mouse click still worked in that harness.
This is evidence of the DOM/focus bug, not evidence of the exact user's Foundry/theme cause.

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
No data conversion, new runtime dependencies, stable release or main-branch changes.

## Validation

- 16 new recipient regressions plus the existing 30 RC4 tests pass locally: **46/46**.
- The earlier group unit test now supplies a real checkbox-shaped `checked` value. Its
  saved-group protection assertions are unchanged. Other pre-existing test files are unchanged.
- **14 native Chromium harness checks pass**: mouse/label and Space select/deselect, stable
  focus/DOM, repeated selection, groups/drafts, Clear/online, disclosure/Done, full replacement,
  volume-gesture cancellation, selected B/reported A, deleted group members, German labels,
  540px width with 24 users and no uncaught browser errors.
- Browser checks use actual module JS/CSS and the actual template text expanded by a test-only
  subset renderer. Foundry APIs and template expansion are doubles. This is not a live
  Foundry, full Handlebars, audio-device or real multi-client certification.
- Static checks and ZIP integrity/byte comparisons are recorded separately. The complete
  repository suite runs in GitHub Actions; consult the PR for its current result.

## Live acceptance still required

1. Replace the module with RC5, restart Foundry and reload all connected browser clients.
2. Open Chris SoundPad. Check and uncheck Player A using the box, its label and Space.
   The panel must stay open and Space must work twice without refocusing.
3. Select A and B, deselect A, clear, then choose online players. Check the named targets
   beside Play and the live controls after every change. Merely selecting must make no sound.
4. Choose a saved group and change its members. Its saved contents must remain unchanged
   until Update group. Test the offline user and a group referring to a deleted user.
5. Play A, select library entry B, and change recipients. A's reports must retain A's name.
   Stop and live volume must affect only the currently named recipients, never B's preset.
6. Check the picker and emergency stop in a small window and with the user's enabled themes.
   If interaction is still blocked, capture both the console error and the enabled module list.

The candidate remains unverified for live Foundry until these checks pass.

## Primary API reference

Reviewed 2026-09-29: ApplicationV2 render replaces inner content and its action handlers
are configured in DEFAULT_OPTIONS. RC5 uses those supported hooks without patching Foundry.
https://foundryvtt.com/api/classes/foundry.applications.api.ApplicationV2.html
