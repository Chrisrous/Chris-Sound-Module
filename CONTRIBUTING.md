# Contributing

## Workflow

Read the current user guide, API and architecture before changing behavior. Work on a feature
branch, add a failing regression for a reproduced bug, then implement the smallest fix.
Run `npm run validate` and `npm run package`. Open a PR describing the changes and test results.
List unit, browser and Foundry integration tests separately. Use the PR checklist.

Node.js 22+ and Python 3 are sufficient. Runtime code is native ES modules with no build step
or extra Foundry dependencies. There is intentionally no package lock because the baseline
project has no npm dependencies to resolve.

## Conventions

- Follow `.editorconfig`: UTF-8, LF, no trailing whitespace. Use readable statements and
  focused functions. New JS uses four-space indentation. Older untouched files retain their
  existing formatting to avoid mixing unrelated formatting changes with bug fixes.
- Keep technical module ID, settings keys, persisted schema and public macro names stable.
- Use stable User IDs and PlaylistSound UUIDs. Never assume names are unique.
- Put new user-facing text in both locale files. Do not build HTML from user-provided text.
- Keep selection, preview, current playback and persistent presets independent.
- Test async cancellation, failure recovery and partial group delivery, not only happy paths.
- Do not add runtime dependencies, telemetry, account credentials or private Foundry assets.

## Documentation

Keep guides focused on setup, behavior and troubleshooting. Release notes describe changes,
compatibility and migration steps. Prefer concise technical descriptions over process reports.
Keep historical behavior in `docs/archive/` and current instructions in the main guides.

## Repository layout

`scripts/` contains runtime modules. `templates/`, `css/` and `lang/` contain the UI.
`tests/` groups tests by behavior. `tools/` holds reproducible validation/package scripts.
Current documentation lives in `docs/`; historical candidate notes live in `docs/archive/`.
Generated artifacts stay in `dist/`, outside version control. See `docs/TESTING.md` for releases.

Packaging regressions also run with `npm run test:package` (Python unittest).
