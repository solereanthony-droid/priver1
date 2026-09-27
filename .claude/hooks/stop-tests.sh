#!/bin/bash
# Stop : si le code a changé depuis la dernière réussite, lance npm test.
# En cas d'échec, Claude reçoit la fin du rapport et doit corriger avant de s'arrêter.
set -uo pipefail

input=$(cat)
# Évite une boucle : si Claude continue déjà à cause de ce hook, on ne relance pas.
if echo "$input" | grep -q '"stop_hook_active": *true'; then exit 0; fi

cd "$CLAUDE_PROJECT_DIR" || exit 0
[ -d node_modules ] || exit 0

paths="src server test index.html vite.config.js package.json package-lock.json"
changes=$( { git diff HEAD -- $paths; git ls-files --others --exclude-standard -- $paths | xargs -r cat; } 2>/dev/null )
[ -n "$changes" ] || exit 0

stamp="${TMPDIR:-/tmp}/btp974-tests-ok-$(echo "$CLAUDE_PROJECT_DIR" | md5sum | cut -c1-8)"
hash=$(printf '%s' "$changes" | md5sum | cut -c1-32)
[ -f "$stamp" ] && [ "$(cat "$stamp")" = "$hash" ] && exit 0

if out=$(npm test 2>&1); then
  echo "$hash" > "$stamp"
  exit 0
fi
{ echo "Les tests échouent après tes modifications (npm test). Corrige avant de terminer :"; echo "$out" | tail -40; } >&2
exit 2
