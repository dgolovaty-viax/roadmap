#!/bin/bash
# viax Roadmap — Deploy to Vercel via GitHub
#
# Usage:
#   bash deploy.sh                        — deploy latest roadmap
#   bash deploy.sh "commit message"       — deploy with custom message
#   bash deploy.sh --setup                — push env vars to Vercel (run once)

set -e

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
SOURCE_FILE="/sessions/determined-trusting-sagan/mnt/outputs/viax-roadmap.html"
CONFIG_FILE="$REPO_DIR/.deploy-config"

# Load config
if [ ! -f "$CONFIG_FILE" ]; then
  echo "✗ Missing .deploy-config — create it with required keys"
  exit 1
fi
source "$CONFIG_FILE"

# ── SETUP MODE: push env vars to Vercel ────────────────────────────────────
if [ "$1" = "--setup" ]; then
  echo "▶ Fetching Vercel project ID for '$VERCEL_PROJECT'..."

  PROJECT_ID=$(curl -s "https://api.vercel.com/v9/projects/$VERCEL_PROJECT" \
    -H "Authorization: Bearer $VERCEL_TOKEN" \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

  if [ -z "$PROJECT_ID" ]; then
    echo "✗ Could not find Vercel project '$VERCEL_PROJECT'. Check VERCEL_PROJECT in .deploy-config."
    exit 1
  fi

  echo "  Project ID: $PROJECT_ID"

  push_env() {
    local KEY=$1
    local VALUE=$2
    echo "  Setting $KEY..."
    curl -s -X POST "https://api.vercel.com/v10/projects/$PROJECT_ID/env" \
      -H "Authorization: Bearer $VERCEL_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"key\":\"$KEY\",\"value\":\"$VALUE\",\"type\":\"encrypted\",\"target\":[\"production\",\"preview\",\"development\"]}" \
      | python3 -c "import sys,json; r=json.load(sys.stdin); print('    ✓ set') if 'key' in r else print('    ✗', r.get('error',{}).get('message','unknown error'))"
  }

  push_env "SUPABASE_URL" "$SUPABASE_URL"
  push_env "SUPABASE_ANON_KEY" "$SUPABASE_ANON_KEY"

  echo "✓ Vercel environment variables set."
  echo "  Trigger a redeploy for them to take effect."
  exit 0
fi

# ── DEPLOY MODE: copy → commit → push ──────────────────────────────────────
COMMIT_MSG="${1:-"Update viax roadmap $(date '+%Y-%m-%d %H:%M')"}"

echo "▶ Copying latest roadmap..."
cp "$SOURCE_FILE" "$REPO_DIR/index.html"

echo "▶ Staging changes..."
git -C "$REPO_DIR" add index.html

if git -C "$REPO_DIR" diff --cached --quiet; then
  echo "✓ No changes to deploy."
  exit 0
fi

echo "▶ Committing: $COMMIT_MSG"
git -C "$REPO_DIR" -c user.name="Dennis Golovaty" -c user.email="dgolovaty@viax.io" \
  commit -m "$COMMIT_MSG"

echo "▶ Pushing to GitHub → triggering Vercel deploy..."
git -C "$REPO_DIR" remote set-url origin "https://${GITHUB_TOKEN}@github.com/dgolovaty-viax/roadmap.git"
git -C "$REPO_DIR" push origin main

echo "✓ Done! Vercel will deploy in ~30 seconds."
