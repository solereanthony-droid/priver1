#!/bin/bash
# Démarrage d'une session Claude Code sur le web : installe les dépendances
# pour que le build et les tests (npm test) fonctionnent tout de suite.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"
# npm install (et non npm ci) : réutilise node_modules mis en cache avec le conteneur.
npm install --no-audit --no-fund --loglevel=error
