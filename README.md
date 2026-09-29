# Chris SoundPad

Target playlist sounds to selected Foundry VTT users without changing ordinary world playlists.

**Stable release: 2.0.0 | Foundry v14 only | MIT**

The owner confirmed successful RC6 testing and authorized this release on 2026-09-29.
The shipped JavaScript, templates, CSS and translations are unchanged from that candidate.
Compatibility is declared for Foundry generation 14. An exact tested build was not supplied.

## Start here

1. Back up your world and existing module directory.
2. In Foundry Setup, open **Add-on Modules > Install Module**, paste the manifest URL below
   and install. Existing installations using this URL can use **Update**.
3. Enable **Chris SoundPad** in your world and reload every connected browser.
   For manual ZIP installation, stop Foundry first and replace only
   `Data/modules/chris-sound-module`.
4. As GM, use the left headphones button or **Open Chris SoundPad** in the Playlists sidebar.
5. Drag a playlist sound into the pad, select recipients, choose a sound and press **Play**.

Installation and update manifest:

```text
https://raw.githubusercontent.com/Chrisrous/Chris-Sound-Module/main/module.json
```

[Release and manual ZIP](https://github.com/Chrisrous/Chris-Sound-Module/releases/tag/v2.0.0)

RC2 through RC6 pads, groups and personal preferences need no migration.
RC installations without an update URL may require one manual update to 2.0.0.
This version does not support v12/v13. The old v1.1.0 release remains available for v12.

## One volume control

Choose a sound to load its saved default into the one slider. Moving it changes the level for
 the **next Play or Preview only**. It does not change audio already playing.

- **Apply to recipient playback** sends that level to the named recipients' current/pending module audio.
- **Save as sound default** persists that level for the selected entry. It does not affect live audio.

Selecting sound B while sound A is playing never stops, relabels or changes A. Stop always
addresses the displayed recipient selection. Clear selection is not Stop.

## Included

Persistent named pads per GM/world, saved recipient groups, search, categories, favorites,
aliases and ordering. Per-sound loop/fade settings, local preview, individual recipient
feedback, personal player volume/mute and an independent emergency stop. English and German.
Both launchers and legacy macros are retained. No additional Foundry module dependencies.

## Documentation

| Document | Purpose |
| --- | --- |
| [User guide](docs/USER_GUIDE.md) | Everyday use and troubleshooting |
| [Deutsche Anleitung](docs/USER_GUIDE_DE.md) | Bedienung, Lautstärke und Installation |
| [API and macros](docs/API.md) | Stable public methods, return values and examples |
| [Architecture](docs/ARCHITECTURE.md) | Responsibilities, data and trust boundaries |
| [Testing and releases](docs/TESTING.md) | Local checks, real-client acceptance and packaging |
| [Changelog](CHANGELOG.md) | Concise version history |
| [Contributing](CONTRIBUTING.md) | Development workflow and conventions |
| [Security](SECURITY.md) | Known limits and responsible reporting |
| [Historical records](https://github.com/Chrisrous/Chris-Sound-Module/tree/main/docs/archive) | Preserved RC1-RC5 development notes |

## Development

Node.js 22+ and Python 3. No `npm install` is required for the baseline checks.

```sh
npm run validate
npm run package
```

Tests use API doubles and an in-process relay. CI checks Linux and Windows, builds a
reproducible module ZIP and makes it available as a build artifact. Normal PR/main CI is read-only.
The separate 2.0.0 publication workflow runs only on `release/2.0.0`, checks the accepted
RC6 runtime against its exact commit, and verifies draft and public release downloads.
It does not merge pull requests or change the main branch. See [Testing and releases](docs/TESTING.md).
Do not commit `dist/`, user data, audio assets, secrets or generated test logs.

## Limits

Reports are session-local client responses, not proof of audibility or an authoritative global
mixer. Multiple tabs can each play audio. The raw module socket and its acknowledgements are
not authenticated by this module and are not confidential. See [Security](SECURITY.md).

Developed by Chrisrous. [MIT License](LICENSE).

Packaging regressions also run with `npm run test:package` (Python unittest).
