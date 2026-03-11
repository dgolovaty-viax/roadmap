#!/bin/bash
# viax Roadmap — Deploy to Vercel via GitHub
#
# Usage:
#   bash deploy.sh                        — deploy all current changes
#   bash deploy.sh "commit message"       — deploy with custom message
#   bash deploy.sh --setup                — push env vars to Vercel (run once from local machine)

set -e

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_FILE="$REPO_DIR/.deploy-config"

# Load config
if [ ! -f "$CONFIG_FILE" ]; then
  echo "✗ Missing .deploy-config"
  exit 1
fi
source "$CONFIG_FILE"

# ── SETUP MODE ──────────────────────────────────────────────────────────────
if [ "$1" = "--setup" ]; then
  echo "▶ Fetching Vercel project ID for '$VERCEL_PROJECT'..."
  PROJECT_ID=$(curl -s "https://api.vercel.com/v9/projects/$VERCEL_PROJECT" \
    -H "Authorization: Bearer $VERCEL_TOKEN" \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

  if [ -z "$PROJECT_ID" ]; then
    echo "✗ Could not find Vercel project. Check VERCEL_PROJECT in .deploy-config."
    exit 1
  fi

  push_env() {
    local KEY=$1; local VALUE=$2
    echo "  Setting $KEY..."
    curl -s -X POST "https://api.vercel.com/v10/projects/$PROJECT_ID/env" \
      -H "Authorization: Bearer $VERCEL_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"key\":\"$KEY\",\"value\":\"$VALUE\",\"type\":\"encrypted\",\"target\":[\"production\",\"preview\",\"development\"]}" \
      | python3 -c "import sys,json; r=json.load(sys.stdin); print('    ✓') if 'key' in r else print('    ✗', r.get('error',{}).get('message',''))"
  }

  push_env "VITE_SUPABASE_URL"      "$VITE_SUPABASE_URL"
  push_env "VITE_SUPABASE_ANON_KEY" "$VITE_SUPABASE_ANON_KEY"
  echo "✓ Done. Trigger a redeploy for env vars to take effect."
  exit 0
fi

# ── DEPLOY MODE ─────────────────────────────────────────────────────────────
# Also sync the latest static roadmap HTML
STATIC_SOURCE="/sessions/determined-trusting-sagan/mnt/outputs/viax-roadmap.html"
if [ -f "$STATIC_SOURCE" ]; then
  cp "$STATIC_SOURCE" "$REPO_DIR/public/roadmap.html"
fi

COMMIT_MSG="${1:-"Deploy: $(date '+%Y-%m-%d %H:%M')"}"

git -C "$REPO_DIR" add -A

if git -C "$REPO_DIR" diff --cached --quiet; then
  echo "✓ No changes to deploy."
  exit 0
fi

echo "▶ Committing: $COMMIT_MSG"
git -C "$REPO_DIR" -c user.name="Dennis Golovaty" -c user.email="dgolovaty@viax.io" \
  commit -m "$COMMIT_MSG"

echo "▶ Pushing to GitHub → triggering Vercel build + deploy..."
git -C "$REPO_DIR" remote set-url origin "https://${GITHUB_TOKEN}@github.com/dgolovaty-viax/roadmap.git"
git -C "$REPO_DIR" push origin main

echo "✓ Done! Vercel will build and deploy in ~60 seconds."
echo "   https://roadmap-viax.vercel.app"
