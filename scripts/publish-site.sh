#!/usr/bin/env bash
# Builds the documentation site and the demo and publishes both to GitHub Pages: the gh-pages
# branch of a remote, with the site at its root and the demo under /demo/.
#
#   scripts/publish-site.sh [remote]        # remote: origin (klementine-net/svelte-draw) by default
#
# Both are served from <host>/svelte-draw/ (BASE_PATH changes that). They are built here
# and pushed as files.
set -euo pipefail

remote="${1:-origin}"
base="${BASE_PATH:-/svelte-draw}"
root="$(cd "$(dirname "$0")/.." && pwd)"
url="$(git -C "$root" remote get-url "$remote")"
commit="$(git -C "$root" rev-parse --short HEAD)"
out="$(mktemp -d)"
trap 'rm -rf "$out"' EXIT

# The apps use the built package (packages/draw/dist).
(cd "$root" && pnpm --filter @klementine/svelte-draw build)
(cd "$root/site" && BASE_PATH="$base" pnpm exec vite build)
cp -R "$root/site/build/." "$out/"
(cd "$root/examples/whiteboard" && pnpm exec vite build --base "$base/demo/" --outDir "$out/demo" --emptyOutDir)

# No Jekyll: the files are served as they are (Jekyll would leave out the _app folder).
touch "$out/.nojekyll"

# The published pages count visits, without cookies (Cloudflare Web Analytics). The script is
# added here and nowhere else: not in the library, not in the example's source, not in a local
# build. The token is the project's own, so it is used for the project's own repository only; a
# copy published elsewhere counts nothing unless ANALYTICS_TOKEN is set (empty: no counting).
if [ -z "${ANALYTICS_TOKEN+x}" ] && [[ "$url" == *klementine-net/svelte-draw* ]]; then
	ANALYTICS_TOKEN=597da3a96c234d3ca16094a7722884af
fi
if [ -n "${ANALYTICS_TOKEN:-}" ]; then
	# $1: the options after the token. Writes the script before </head> of the files on stdin.
	count() {
		BEACON="<script defer src=\"https://static.cloudflareinsights.com/beacon.min.js\" data-cf-beacon='{\"token\": \"$ANALYTICS_TOKEN\"$1}'></script>" \
			xargs -0 perl -pi -e 's#</head>#$ENV{BEACON}</head>#'
	}
	# The demo writes its view into the address on every move, and the counter would take each
	# of those for a page opened: there it counts the page load alone ("spa": false). The site's
	# pages are real pages, counted as they are opened.
	find "$out/demo" -name '*.html' -print0 | count ', "spa": false'
	find "$out" -path "$out/demo" -prune -o -name '*.html' -print0 | count ''
fi

cd "$out"
git init -q -b gh-pages
git add -A
git commit -q -m "🚀 deploy(site): from $commit"
git push -q -f "$url" gh-pages
echo "Published $commit to the gh-pages branch of $remote."
