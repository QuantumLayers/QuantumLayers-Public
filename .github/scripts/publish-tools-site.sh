#!/usr/bin/env bash
# Copies free-tools/ (minus repo-only files) to the root of the `tools-site`
# branch and pushes a commit if anything changed. Run from the repo root of a
# checkout of main. Used by .github/workflows/publish-tools-site.yml.
set -euo pipefail

BRANCH="${PUBLISH_BRANCH:-tools-site}"
SRC_SHA="$(git rev-parse --short HEAD)"
REPO="$(pwd)"
WORK="$(mktemp -d)"
cleanup() {
  cd "$REPO"
  git worktree remove --force "$WORK/site" >/dev/null 2>&1 || true
  git worktree prune || true
  rm -rf "$WORK"
}
trap cleanup EXIT
git worktree prune

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

if git ls-remote --exit-code --heads origin "$BRANCH" >/dev/null 2>&1; then
  # Explicit refspec: actions/checkout makes a single-branch clone, where a
  # bare `git fetch origin <branch>` wouldn't create origin/<branch>.
  git fetch origin "+refs/heads/$BRANCH:refs/remotes/origin/$BRANCH"
  git worktree add -B "$BRANCH" "$WORK/site" "origin/$BRANCH"
else
  # First publish: start the branch with no history.
  git worktree add --detach "$WORK/site"
  git -C "$WORK/site" checkout --orphan "$BRANCH"
  git -C "$WORK/site" rm -rf -q .
fi

# Replace the branch contents with free-tools/ (so deletions on main are
# published too), then drop repo-only files the site doesn't serve.
find "$WORK/site" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -a free-tools/. "$WORK/site/"
rm -rf "$WORK/site/tests" "$WORK/site/datasets/build.js"
find "$WORK/site" -path "$WORK/site/.git" -prune -o -name '*.md' -type f -print0 | xargs -0 -r rm -f

# Cache-busting: the host serves .css/.js with a 7-day max-age, so a page
# could pair new HTML with a stale stylesheet. Stamp every local stylesheet
# and script reference with a hash of the file it points to
# (ql-theme.css -> ql-theme.css?v=1a2b3c4d5e): a changed file gets a new URL,
# an unchanged one keeps its cached copy. Only the published copy is
# rewritten; the sources on main stay clean.
python3 - "$WORK/site" <<'PY'
import hashlib, pathlib, re, sys
root = pathlib.Path(sys.argv[1]).resolve()
ref = re.compile(r'(\b(?:src|href)=")([^"#?:]+\.(?:css|js))(?:\?v=[0-9a-f]+)?(")')
hashes = {}
def stamp(page):
    def sub(m):
        target = (page.parent / m.group(2)).resolve()
        if root not in target.parents or not target.is_file():
            return m.group(0)  # external or missing: leave as is
        if target not in hashes:
            hashes[target] = hashlib.sha256(target.read_bytes()).hexdigest()[:10]
        return f'{m.group(1)}{m.group(2)}?v={hashes[target]}{m.group(3)}'
    return ref.sub(sub, page.read_text(encoding='utf-8'))
n = 0
for page in root.rglob('*.html'):
    if '.git' in page.parts:
        continue
    new = stamp(page)
    if new != page.read_text(encoding='utf-8'):
        page.write_text(new, encoding='utf-8'); n += 1
print(f'cache-busting: stamped asset links in {n} pages ({len(hashes)} assets)')
PY

cat > "$WORK/site/README.md" <<EOF
# tools-site (generated, don't edit)

This branch is published automatically from \`free-tools/\` on \`main\` by
\`.github/workflows/publish-tools-site.yml\`, and deployed by Hostinger to
https://quantumlayers.com/tools/. Edit the files on \`main\` instead.
EOF

cd "$WORK/site"
git add -A
if git diff --cached --quiet; then
  echo "tools-site already up to date with main@$SRC_SHA."
  exit 0
fi
git commit -q -m "publish free-tools from main@$SRC_SHA"
git push origin "$BRANCH"
echo "Published main@$SRC_SHA to $BRANCH."
