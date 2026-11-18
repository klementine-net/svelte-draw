#!/usr/bin/env bash
# Builds the documentation site and the demo and publishes both to GitHub Pages: the gh-pages
# branch of a remote, with the site at its root and the demo under /demo/.
#
#   scripts/publish-site.sh [remote]        # remote: public (klementine-net/svelte-draw) by default
#
# Both are served from <host>/svelte-draw/ (BASE_PATH changes that). They need the klementine.ui
# checkout this workspace installs from, so they are built here, not by GitHub.
set -euo pipefail

remote="${1:-public}"
base="${BASE_PATH:-/svelte-draw}"
root="$(cd "$(dirname "$0")/.." && pwd)"
url="$(git -C "$root" remote get-url "$remote")"
commit="$(git -C "$root" rev-parse --short HEAD)"
out="$(mktemp -d)"
trap 'rm -rf "$out"' EXIT

(cd "$root/site" && BASE_PATH="$base" pnpm exec vite build)
cp -R "$root/site/build/." "$out/"
(cd "$root/examples/whiteboard" && pnpm exec vite build --base "$base/demo/" --outDir "$out/demo" --emptyOutDir)

# No Jekyll: the files are served as they are (Jekyll would leave out the _app folder).
touch "$out/.nojekyll"

cd "$out"
git init -q -b gh-pages
git add -A
git commit -q -m "🚀 deploy(site): from $commit"
git push -q -f "$url" gh-pages
echo "Published $commit to the gh-pages branch of $remote."
