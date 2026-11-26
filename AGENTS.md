# Agents: svelte-draw

svelte-draw: an infinite canvas for Svelte. A pnpm workspace of its own: the engine in
`packages/draw`, example apps in `examples/*`. Read README.md, then `packages/draw/AGENTS.md`.

- **Draw is a library on its own.** Nothing here imports an application's code; an app
  installs the built package (`pnpm --filter @simon-lund/svelte-draw build` makes it).
- **klementine.ui is a peer** (`@klementine/ui`), installed from the monorepo checkout beside
  this one. Only `packages/draw/src/lib/svelte` and the examples may import it; after a change
  there, `pnpm install --force` here.
- **Checks:** `pnpm check`, `pnpm test`, `pnpm lint` at the root (Node 24, pnpm 11);
  `pnpm test:browser` runs the Svelte layer in Chrome. Where they are installed through asdf,
  call them by the absolute path of the install: the shims fail outside an interactive shell.
- **This repository is public.** No local paths, names of people or anything private in code,
  docs or commit messages, and no other products of ours by name. The documentation site
  (`site/`) and the demo are published with `scripts/publish-site.sh`.
- **The docs read as a published library**: install from npm, an early-development warning on
  the pages people arrive at, and openly built with AI. tldraw is credited once per place
  people land (the READMEs' and the introduction's Credits) and named nowhere else; features
  are described on their own terms, never by comparison.
- **The site documents the code.** Its API reference is read from the source at build time;
  the guides are written by hand: change the page in `site/src/routes/docs/` with the code it
  describes. Its design is decided in `site/DESIGN.md`.
- Commits: `<gitmoji> <type>(<scope>): <subject>`, e.g. `✨ feat(draw): …`.
- Code, comments and docs in English.
