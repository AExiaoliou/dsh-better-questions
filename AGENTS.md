# AGENTS.md

## Repository overview

`dsh-better-questions` is a DeepSeek Harness plugin that provides the `ask_with_prototype` tool. It supports ordinary questions plus YAML layout, code, HTML/CSS, and file prototypes. The package targets DSH `0.2.1-alpha.1`, Cordis `4.0.5-alpha.1`, and React 18; keep those compatibility constraints in mind when changing runtime integrations.

## Development environment

- Use Node.js 22.19+ or Node.js 24+.
- Use pnpm 11.7.0 (`packageManager` in `package.json`).
- Install dependencies with `pnpm install --frozen-lockfile --ignore-scripts`.
- Do not commit `node_modules`, generated build output, coverage, archives, screenshots, or local Harness/profile data.

## Source layout

- `src/index.ts`: Host plugin entry point and registry wiring.
- `src/host/`: Host-side tool and session projection implementation.
- `src/client/`: Client-side React views, previews, stores, and lifecycle integration.
- `src/shared/`: Shared request/result models and layout definitions.
- `src/skills.ts`: Registers the bundled prototype-specific skills.
- `skills/`: Skill markdown loaded on demand by the plugin.
- `scripts/`: Build, smoke, measurement, and optional visual verification scripts.
- `cordis.patch.yml`: Harness bundle patch and injection configuration.

The Host and Client TypeScript projects are checked independently through `tsconfig.host.json` and `tsconfig.client.json`. Preserve the existing separation when adding imports or runtime behavior.

## Common commands

Run the full local validation pipeline before submitting a substantive change:

```sh
pnpm check
```

Focused commands are:

```sh
pnpm typecheck
pnpm test
pnpm build
node scripts/smoke.mjs
pnpm measure
pnpm pack
```

`pnpm visual` is optional and requires local Chrome. Its screenshots are development artifacts and should not be committed.

## Change guidance

- Keep changes focused and preserve the public tool and result contracts.
- When changing question schemas, prototype validation, preview behavior, skill content, or DSH integration points, update the relevant tests and README documentation in the same change.
- Keep Host code free of Client-only imports and keep Client code compatible with the Harness ModuleLoader/runtime singletons.
- Treat DSH and Cordis APIs as version-specific. Verify contracts against the pinned runtime version and existing project documentation before changing registry, tool, skill, projection, slot, or client lifecycle code.
- Preserve the safety boundaries for HTML previews and the strict validation rules for layout prototypes.
- Use clear commit messages. Include the reason for a change and the validation commands run in the pull request.

## Testing and review

For runtime or behavior changes, run the narrowest relevant focused checks while iterating, then run `pnpm check` before committing. UI changes should also receive the available visual/runtime verification described in `README.md` when a compatible Harness environment is available. Document compatibility limitations when runtime checks cannot be completed.

Do not add secrets, personal profile data, machine-specific absolute paths, generated bundles, or dependency directories to commits.
