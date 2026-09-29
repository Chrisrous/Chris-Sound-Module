# Changelog

Stable versions have public GitHub releases. Historical candidate records remain in `docs/archive/`.

## 2.0.0 - 2026-09-29

### Released
- First stable Foundry v14 release, promoted after owner-reported successful RC6 testing.
- Includes the v14 API migration, all nine core improvements, both launchers, recipient fixes,
  one-volume-control interface and repository cleanup documented below.
- No runtime, template, CSS or localization changes from the tested 2.0.0-rc.6 candidate.
- Restore the original stable manifest URL and a versioned release ZIP download.
- Add an owner-authorized, release-branch-only workflow with Linux/Windows validation,
  draft-asset verification and anonymous public-download verification. Normal CI stays read-only.
- Keep technical ID, stored schema 1, settings and socket protocol 2 unchanged.
- Foundry generation 14 is owner-confirmed. Exact build/system/browser versions were not supplied.

## 2.0.0-rc.6

### Changed
- One volume control for next Play/Preview. Applying to current recipient audio and saving a
  selected sound's default are separate explicit actions. Remove the duplicate editor slider.
- Loading another sound's default never changes ongoing audio or stored presets.
- Readable UI source, an isolated volume model, purpose-named regression tests and current docs.
- Archive earlier RC development records. Exclude archives and developer files from module ZIPs.
- Add contributor/security guidance, issue/PR templates, editor/Git conventions, cross-platform
  test discovery and expanded static/package validation.
- Pin CI action revisions, test on Linux/Windows and retain installable build artifacts. No auto-release.

## 2.0.0-rc.5
- Fix recipient checkbox focus/state loss, use an explicit inline picker and add Clear selection.

## 2.0.0-rc.4
- Introduce Chris SoundPad branding, the left launcher and on-demand editing.
- Distinguish selected sound, local preview and reported recipient playback.

## 2.0.0-rc.3
- Add the visible Playlists/sidebar-popout launcher and singleton window reveal.

## 2.0.0-rc.2
- Add persistent pads, groups, recipient feedback, fades, preview, sound organization,
  emergency stop, per-entry presets and personal player volume/mute.

## 2.0.0-rc.1
- Migrate the v12 module to Foundry v14 ApplicationV2 and audio APIs.
- Preserve legacy macros, add cancellation guards, localization, tests and packaging.

## 1.1.0
- Previous published version targeting Foundry v12. Retained as the v1.1.0 GitHub release.
