#!/bin/sh
# ARN1: fetches Bethesda's own free release of The Elder Scrolls: Arena (1.06,
# Arena106Setup.zip on Bethesda's CDN - the link OpenTESArena's README gives) and
# extracts its ARENA folder to /home/claude/arenadata/ARENA. Like ARENA2
# (tools/fetch-data.sh), the data never enters the repo.
set -e
TOOLS="$(cd "$(dirname "$0")" && pwd)"
DEST="${1:-/home/claude/arenadata}"
URL="https://cdnstatic.bethsoft.com/elderscrolls.com/assets/files/tes/extras/Arena106Setup.zip"
SHA256="aed6d15d9cd29fde12464097fd73e0c9fa290d2a57979e84a1cc8ac0c3fb1fc7"
mkdir -p "$DEST"
cd "$DEST"
if [ ! -f ARENA/GLOBAL.BSA ]; then
  [ -f Arena106Setup.zip ] || { echo "Downloading Arena106Setup.zip (~9MB)..."; curl -sSL -o Arena106Setup.zip "$URL"; }
  echo "$SHA256  Arena106Setup.zip" | sha256sum -c -
  unzip -q -o Arena106Setup.zip Arena106.exe
  # Arena106.exe is a self-extracting RAR; node-unrar-js (MIT) opens it, installed beside the data
  [ -d .unrar/node_modules/node-unrar-js ] || npm install --silent --no-save --prefix .unrar node-unrar-js@2.0.2
  node "$TOOLS/unrarSfx.mjs" Arena106.exe . .unrar/node_modules
fi
echo "Arena ready: $DEST/ARENA ($(ls "$DEST/ARENA" | wc -l) files)"
echo "Run its tests with: TES_ARENA_PATH=$DEST/ARENA npm test"
