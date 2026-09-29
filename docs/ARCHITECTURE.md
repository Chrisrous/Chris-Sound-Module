# Architecture

## Runtime responsibilities

| Module | Responsibility |
| --- | --- |
| `main.js` | Settings/hooks, public API and compatibility macro wrappers |
| `launcher.js` | Left/right launchers and singleton window reveal |
| `SoundPad.js` | ApplicationV2 state, action orchestration and editor commands |
| `volume-control.js` | Single prepared slider value; no audio or persistence side effects |
| `presentation.js` | Native recipient/status DOM updates without rebuilding checkbox inputs |
| `library.js` | Validated schema-1 user-scoped storage and serialized edits |
| `socket-handler.js` | Protocol-2 transport, command intent ordering, status routing and macro lookup |
| `audio.js` | Module-owned audio lifetime, fades, cancellation and personal player limits |
| `status.js` | Bounded, session-local acknowledgements and last reports |

## Volume and identity contract

The selected library entry, prepared level, preview and recipient playback are different state.
VolumeControl stores a perceptual UI input. Selection loads a saved default without sending a
command. Play/Preview take a numeric gain snapshot. Apply snapshots recipients and gain. Save
default snapshots pad/entry IDs and gain, and writes only that entry through library validation.

A new selection cannot relabel a previous Play report. Stop affects recipients, not the selected
entry. A gesture interrupted by a selection/recipient change is cancelled. A redraw alone is
not a selection change. Working volume is session-local until explicitly saved.

The source playlist, schema version 1, user settings and protocol 2 remain unchanged in RC6.
No migration is necessary for RC2-RC5 data. Do not rename the technical module ID or settings keys.

## Async and security boundaries

SoundService reserves intents per recipient, invalidates pending Play on newer Play/Stop, and
sends volatile packets instead of replaying stale commands after reconnect. SoundPlayback owns
only this module's sounds. Local preview uses a separate playback instance. Group outcomes are
independent. StatusTracker bounds storage and distinguishes missing/unknown reports from silence.

This is not server-enforced authorization or confidential transport. See [Security](../SECURITY.md).
Settings revision checks detect many stale edits, but are not atomic server compare-and-swap.

## Tests and change scope

The RC6 refactor separates presentation from orchestration. Audio, transport, persistence and
launcher behavior are not rewritten. Existing tests are retained, with explicit changes to the
superseded two-slider interaction expectations. Purpose-named suites replace release-number
naming. Historical documents preserve the earlier contracts in `archive/`.
