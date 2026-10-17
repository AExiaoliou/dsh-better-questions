# Changelog

All notable changes to this project will be documented here.

The project is currently at `0.2.0`. See the [README](README.md) for compatibility and verification details.

## [0.2.0] - 2026-10-17

### Breaking changes

- Remove the per-question `type` field. There are no layout, code, HTML, none, or file question types; `type` is now an unknown field and is rejected. The 64 KiB prototype and 256 KiB batch byte budgets are gone.
- `proto` now holds a prototype file path the model wrote before asking, never inline prototype content. Selecting an option (or its "Open file" action) opens the file in the right sidebar; the plugin renders nothing inline and leaves rendering to the sidebar's `documentPreviews` renderers, chosen by file extension.
- Remove the six bundled skills, the plugin's skill injection and registration, and the `skills` package entry. Remove the `yaml` and `@deepseek-ai/dsh-skill` devDependencies.
- Bump the session projection `stateVersion` to `2`. Persisted v1 projection state is discarded, and old call records whose arguments contain `type` no longer replay as cards.

### Removed

- Delete `scripts/visual/` and the `visual` package script.

### Changed

- `scripts/smoke.mjs` no longer registers or exercises skills and asserts that the tool parameters expose no `type` property; `scripts/measure.mjs` measures only the tool definition.
- Update README, AGENTS.md, CONTRIBUTING.md, package metadata, and locale descriptions for the sidebar-preview contract. The draft store key remains `dsh.better-questions.drafts.v1`.

## [0.1.4] - 2026-10-13

- Remove the experimental `check_layout_prototype` tool and Host-side preview renderer.
- Keep layout validation in `ask_with_prototype` as the single supported path.

## [0.1.2] - 2026-10-13

- Remove package peer dependency declarations.
- Add DSH CLI installation instructions and installation screenshot.
