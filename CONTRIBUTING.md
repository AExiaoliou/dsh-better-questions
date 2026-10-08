# Contributing

Thanks for helping improve `dsh-better-questions`.

## Before you start

Please search existing issues and pull requests before opening a new one. For larger changes, open an issue first so the design can be discussed before implementation.

## Development setup

Requirements:

- Node.js 22.19 or newer (or Node.js 24 or newer)
- pnpm 11.7.0
- A compatible DeepSeek Harness development environment for runtime checks

Install dependencies and run the full local check:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm check
```

Useful focused commands:

```sh
pnpm typecheck
pnpm test
pnpm build
node scripts/smoke.mjs
pnpm pack
```

`pnpm visual` is optional and requires a local Chrome installation. Generated build output, coverage, archives, and screenshots should not be committed.

## Making changes

Keep changes focused and preserve the existing public contract. When changing the question schema, preview behavior, skill files, or DSH integration points, update the relevant tests and README documentation in the same pull request.

Use clear commit messages and include in the pull request:

- what changed and why;
- how the change was tested;
- screenshots or recordings for visible UI changes;
- compatibility notes for DSH or Cordis version changes.

Do not add secrets, personal profile data, local installation paths, generated bundles, or dependency directories to commits.

## Pull requests

Pull requests should pass the checks required by CI. A maintainer may ask for changes to preserve compatibility with the pinned DSH alpha APIs or to keep the package safe to install in a Harness session.

By contributing, you agree that your contributions are provided under the MIT License in this repository.
