#!/bin/bash
# Installs Fretline's npm dependencies in Claude Code cloud sessions so
# `npm test`, `npm run build` and `npm run e2e` work straight away.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# The cloud image ships Chromium under /opt/pw-browsers; don't download another.
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# --no-save keeps the lockfile untouched: it was written by a newer npm, and
# the npm in the image would otherwise rewrite it on every session.
npm install --no-save --no-audit --no-fund

# Playwright's pinned Chromium build differs from the one in the image, so
# point the e2e scripts at the image's Chromium.
if [ -n "${CLAUDE_ENV_FILE:-}" ] && [ -x /opt/pw-browsers/chromium ]; then
  echo 'export FRETLINE_CHROMIUM=/opt/pw-browsers/chromium' >> "$CLAUDE_ENV_FILE"
fi
