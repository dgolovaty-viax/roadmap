#!/bin/bash
# viax Roadmap — Deploy to Vercel via GitHub
# Usage: bash deploy.sh "optional commit message"
#
# Requires a .deploy-config file in this directory with:
#   GITHUB_TOKEN=your_token_here

set -e

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
SOURCE_FILE="/sessions/determined-trusting-sagan/mnt/outputs/viax-roadmap.html"
CONFIG_FILE="$REPO_DIR/.deploy-config"
COMMIT_MSG="${1:-"Update viax roadmap $(date '+%Y-%m-%d %H:%M')"}"

# Load config
if [ ! -f "$CONFIG_FILE" ]; then
  echo "✗ Missing .deploy-config — create it with GITHUB_TOKEN=your_token"
  exit 1
fi
source "$CONFIG_FILE"

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
