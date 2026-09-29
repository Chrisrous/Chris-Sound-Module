# Chris SoundPad

Target playlist sounds to selected Foundry VTT users without changing ordinary world playlists.

**Current candidate: 2.0.0-rc.6 | Foundry v14 only | MIT**

This is a manual-install release candidate. Automated tests are not live Foundry certification.
The published stable update channel and `main` remain separate until live acceptance is complete.

## Start here

1. Back up your world and existing module directory. Stop Foundry.
2. Extract the module ZIP into your user-data `Data/modules` directory.
   The final path must be `Data/modules/chris-sound-module/module.json`.
3. Restart Foundry, enable **Chris SoundPad** and reload every connected browser.
4. As GM, use the left headphones button or **Open Chris SoundPad** in the Playlists sidebar.
5. Drag a playlist sound into the pad, select recipients, choose a sound and press **Play**.

RC2 through RC5 pads, groups and personal preferences use the same stored data as RC6.
The candidate intentionally has no stable manifest/download URLs. Do not use it on v12/v13.

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
| [Historical records](https://github.com/Chrisrous/Chris-Sound-Module/tree/feature/foundry-v14/docs/archive) | Preserved RC1-RC5 development notes |

## Development

Node.js 22+ and Python 3. No `npm install` is required for the baseline checks.

```sh
npm run validate
npm run package
```

Tests use API doubles and an in-process relay. CI checks Linux and Windows, builds a
reproducible module ZIP and makes it available as a build artifact. Nothing auto-publishes.
Do not commit `dist/`, user data, audio assets, secrets or generated test logs.

## Limits

Reports are session-local client responses, not proof of audibility or an authoritative global
mixer. Multiple tabs can each play audio. The raw module socket and its acknowledgements are
not authenticated by this module and are not confidential. See [Security](SECURITY.md).

Developed by Chrisrous. [MIT License](LICENSE).

Packaging regressions also run with `npm run test:package` (Python unittest).
