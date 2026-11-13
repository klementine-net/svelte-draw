#!/usr/bin/env bash
# Builds the example whiteboard and publishes it as the demo on GitHub Pages: the gh-pages
# branch of a remote, with the demo under /demo/ and a front page that sends visitors there.
#
#   scripts/publish-demo.sh [remote]        # remote: simon-lund by default
#
# The demo is served from <site>/svelte-draw/demo/ (DEMO_BASE changes that). It needs the
# klementine.ui checkout this workspace installs from, so it is built here, not by GitHub.
set -euo pipefail

remote="${1:-simon-lund}"
base="${DEMO_BASE:-/svelte-draw/demo/}"
root="$(cd "$(dirname "$0")/.." && pwd)"
url="$(git -C "$root" remote get-url "$remote")"
commit="$(git -C "$root" rev-parse --short HEAD)"
out="$(mktemp -d)"
trap 'rm -rf "$out"' EXIT

(cd "$root/examples/whiteboard" && pnpm exec vite build --base "$base" --outDir "$out/demo" --emptyOutDir)

# No Jekyll: the files are served as they are.
touch "$out/.nojekyll"
cat > "$out/index.html" <<'HTML'
<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<title>Klementine Draw</title>
		<meta http-equiv="refresh" content="0; url=demo/" />
	</head>
	<body>
		<p><a href="demo/">Klementine Draw: the demo</a></p>
	</body>
</html>
HTML

cd "$out"
git init -q -b gh-pages
git add -A
git commit -q -m "🚀 deploy(demo): from $commit"
git push -q -f "$url" gh-pages
echo "Published $commit to the gh-pages branch of $remote."
