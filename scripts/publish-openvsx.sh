#!/usr/bin/env bash
# Publish a packaged .vsix to the Open VSX Registry (the store Cursor, VSCodium
# and Windsurf install from). Creates the namespace first if it is missing.
# Usage: OVSX_PAT=... scripts/publish-openvsx.sh <file.vsix>
set -euo pipefail

VSIX="${1:?usage: publish-openvsx.sh <file.vsix>}"
OVSX="npx -y ovsx@1.3.0"

if [ -z "${OVSX_PAT:-}" ]; then
  echo "::error::OVSX_PAT is empty. Create an access token at https://open-vsx.org/user-settings/tokens and save it as the repository secret OVSX_PAT."
  exit 1
fi
if [ ! -f "$VSIX" ]; then
  echo "::error::VSIX not found: $VSIX"
  exit 1
fi

NAMESPACE=$(node -p "require('./package.json').publisher")

# Create the namespace only when Open VSX does not know it yet.
STATUS=$(curl -s --max-time 30 -o /dev/null -w '%{http_code}' "https://open-vsx.org/api/${NAMESPACE}")
if [ "$STATUS" = "404" ]; then
  echo "Namespace '${NAMESPACE}' not found on Open VSX, creating it."
  if ! OUT=$($OVSX create-namespace "$NAMESPACE" -p "$OVSX_PAT" 2>&1); then
    if printf '%s' "$OUT" | grep -qi 'already exists'; then
      echo "Namespace '${NAMESPACE}' already exists."
    else
      printf '%s\n' "$OUT"
      echo "::error::Could not create the Open VSX namespace '${NAMESPACE}'."
      exit 1
    fi
  fi
else
  echo "Namespace '${NAMESPACE}' exists on Open VSX (HTTP ${STATUS})."
fi

$OVSX publish "$VSIX" -p "$OVSX_PAT"
