# Agents: Klementine Draw

Klementine Draw: an infinite canvas for Svelte. A pnpm workspace of its own: the engine in
`packages/draw`, example apps in `examples/*`. Read README.md, then `packages/draw/AGENTS.md`.

- **Draw is not part of the Klementine app.** Nothing here imports Klementine's core or shell;
  an app installs Draw from this folder (`file:`), like Desk.
- **klementine.ui is a peer** (`@klementine/ui`), installed from the monorepo checkout beside
  this one. Only `packages/draw/src/lib/svelte` and the examples may import it; after a change
  there, `pnpm install --force` here.
- **Checks:** `pnpm check`, `pnpm test`, `pnpm lint` at the root (Node 24, pnpm 11). Where
  they are installed through asdf, call them by the absolute path of the install: the shims
  fail outside an interactive shell.
- **This repository is public.** No local paths, names of people or anything private in code,
  docs or commit messages. The demo is published with `scripts/publish-demo.sh`.
- Commits: `<gitmoji> <type>(<scope>): <subject>`, e.g. `✨ feat(draw): …`.
- Code, comments and docs in English.
