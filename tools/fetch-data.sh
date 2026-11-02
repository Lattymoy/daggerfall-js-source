#!/bin/sh
# Fetches the official DFU DaggerfallGameFiles.zip (freeware Daggerfall data)
# and extracts arena2/ to /home/claude/dfdata. Data never enters the repo.
# Source: DFU cross-platform install wiki (Interkarma's Google Drive link).
set -e
DEST="${1:-/home/claude/dfdata}"
mkdir -p "$DEST"
cd "$DEST"
if [ ! -d arena2 ]; then
  echo "Downloading DaggerfallGameFiles.zip (~150MB)..."
  curl -sL -o gamefiles.zip "https://drive.usercontent.google.com/download?id=0B0i8ZocaUWLGWHc1WlF3dHNUNTQ&export=download&confirm=t"
  unzip -q gamefiles.zip 'arena2/*'
fi
echo "ARENA2 ready: $DEST/arena2 ($(ls "$DEST/arena2" | wc -l) files)"
echo "Run tests with: ARENA2_PATH=$DEST/arena2 npm test"
