# AGENTS.md

## Repository overview

`dsh-better-questions` is a DeepSeek Harness plugin that provides the `ask_with_prototype` tool. It supports ordinary questions plus optional prototype files: the model writes a prototype file first and puts its path in an option's `proto`, and selecting that option (or its "Open file" action) opens the file in the Harness right sidebar, which renders it by file type. The plugin renders nothing inline. The package targets DSH `0.2.1-alpha.1`, Cordis `4.0.5-alpha.1`, and React 18; keep those compatibility constraints in mind when changing runtime integrations.

## Development environment

- Use Node.js 22.19+ or Node.js 24+.
- Use pnpm 11.7.0 (`packageManager` in `package.json`).
- Install dependencies with `pnpm install --frozen-lockfile --ignore-scripts`.
- Do not commit `node_modules`, generated build output, coverage, archives, screenshots, or local Harness/profile data.

## Source layout

- `src/index.ts`: Host plugin entry point and registry wiring.
- `src/host/`: Host-side tool and session projection implementation.
- `src/client/`: Client-side React views, draft stores, sidebar opening, and lifecycle integration.
- `src/shared/`: Shared request/result models.
- `scripts/`: Build, smoke, and measurement scripts.
- `cordis.patch.yml`: Harness bundle patch and injection configuration.

The Host and Client TypeScript projects are checked independently through `tsconfig.host.json` and `tsconfig.client.json`. Preserve the existing separation when adding imports or runtime behavior.

## Common commands

Run the full local validation pipeline before submitting a substantive change:

```sh
pnpm check
```

`pnpm check` runs typecheck, test, build, `scripts/smoke.mjs`, and `pnpm measure` in that order. Focused commands are:

```sh
pnpm typecheck
pnpm test
pnpm build
node scripts/smoke.mjs
pnpm measure
pnpm pack
```

`node scripts/smoke.mjs` and `pnpm measure` load `dist/`, so run `pnpm build` first.

## Change guidance

- Keep changes focused and preserve the public tool and result contracts.
- When changing question schemas, prototype path validation, sidebar opening behavior, or DSH integration points, update the relevant tests and README documentation in the same change.
- Keep Host code free of Client-only imports and keep Client code compatible with the Harness ModuleLoader/runtime singletons.
- Keep prototype rendering out of the plugin: the card only opens a file (for example through `ctx.sidebarRight.openResource`), and the sidebar's `documentPreviews` registry owns rendering and its safety boundaries.
- Treat DSH and Cordis APIs as version-specific. Verify contracts against the pinned runtime version and existing project documentation before changing registry, tool, projection, slot, or client lifecycle code.
- Use clear commit messages. Include the reason for a change and the validation commands run in the pull request.

## Testing and review

For runtime or behavior changes, run the narrowest relevant focused checks while iterating, then run `pnpm check` before committing. UI changes should also be verified against a compatible Harness environment (for example that selecting an option opens the right-sidebar file preview) when one is available. Document compatibility limitations when runtime checks cannot be completed.

Do not add secrets, personal profile data, machine-specific absolute paths, generated bundles, or dependency directories to commits.
