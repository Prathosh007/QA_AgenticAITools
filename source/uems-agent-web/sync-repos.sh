#!/bin/bash
# sync-repos.sh — Clone (if needed) and pull latest master for all UEMS repos.
# Usage: ./sync-repos.sh /path/to/repos /path/to/repos.json
#
# Intended for cron: */30 * * * * /path/to/sync-repos.sh /data/repos /path/to/repos.json

# Note: no 'set -e' — individual clone/pull failures are tolerated.

# Prevent git from prompting for credentials — fail fast instead of hanging.
export GIT_TERMINAL_PROMPT=0
export GIT_SSH_COMMAND="ssh -o BatchMode=yes -o ConnectTimeout=10"

REPO_DIR="${1:?Usage: sync-repos.sh <repo-dir> <repos-json>}"
REPOS_JSON="${2:?Usage: sync-repos.sh <repo-dir> <repos-json>}"

if [ ! -f "$REPOS_JSON" ]; then
  echo "Error: repos.json not found at $REPOS_JSON"
  exit 1
fi

mkdir -p "$REPO_DIR"

# Extract repo names and git URLs from repos.json
# Format: { "platform": { "repo-name": { "gitUrl": "..." } } }
REPOS=$(python3 -c "
import json, sys
with open('$REPOS_JSON') as f:
    data = json.load(f)
for platform in data.values():
    for name, info in platform.items():
        url = info.get('gitUrl', '')
        if url:
            print(f'{name}\t{url}')
" 2>/dev/null || true)

if [ -z "$REPOS" ]; then
  echo "Warning: No repos found in $REPOS_JSON"
  exit 0
fi

SYNCED=0
FAILED=0

# Per-repo timeout (seconds) — prevents a hung clone from blocking the script
REPO_TIMEOUT=60
TIMEOUT_CMD=""
if command -v timeout &>/dev/null; then
  TIMEOUT_CMD="timeout $REPO_TIMEOUT"
elif command -v gtimeout &>/dev/null; then
  TIMEOUT_CMD="gtimeout $REPO_TIMEOUT"
fi

while IFS=$'\t' read -r name url; do
  TARGET="$REPO_DIR/$name"

  if [ -d "$TARGET/.git" ]; then
    # Pull latest
    echo "Pulling $name..."
    if $TIMEOUT_CMD git -C "$TARGET" pull --ff-only --quiet origin master 2>/dev/null; then
      SYNCED=$((SYNCED + 1))
    else
      # Try main branch if master doesn't exist
      if $TIMEOUT_CMD git -C "$TARGET" pull --ff-only --quiet origin main 2>/dev/null; then
        SYNCED=$((SYNCED + 1))
      else
        echo "  Warning: pull failed for $name (may have local changes or timed out)"
        FAILED=$((FAILED + 1))
      fi
    fi
  else
    # Clone
    echo "Cloning $name..."
    if $TIMEOUT_CMD git clone --quiet --depth 1 --no-single-branch "$url" "$TARGET" 2>/dev/null; then
      SYNCED=$((SYNCED + 1))
    else
      echo "  Warning: clone failed for $name (check access or timed out)"
      FAILED=$((FAILED + 1))
      # Clean up partial clone if any
      rm -rf "$TARGET" 2>/dev/null || true
    fi
  fi
done <<< "$REPOS"

echo "Sync complete: $SYNCED ok, $FAILED failed"
