#!/bin/bash
# Fetch the DFU sources the differential harness compiles, and apply the
# three behaviour-neutral harness edits.
#
# DFU source is NOT committed to this repo, for the same reason ARENA2 is
# not: Port-Doctrine keeps Daggerfall Unity an EXTERNAL reference (the
# sparse clone), and vendoring 1.2MB of it here would quietly change that
# stance. This script reproduces the checkout instead.
#
#   bash prepare.sh                      # sparse-clone DFU into ./dfu
#   DFU_PATH=/path/to/daggerfall-unity bash prepare.sh   # reuse a checkout
#
# Then: bash run.sh
set -eu
D="$(cd "$(dirname "$0")" && pwd)"
DFU_PATH="${DFU_PATH:-$D/dfu}"

if [ ! -d "$DFU_PATH/Assets/Scripts/API" ]; then
  echo "== sparse-cloning Daggerfall Unity (MIT, Interkarma and contributors) =="
  rm -rf "$DFU_PATH"
  git clone --filter=blob:none --no-checkout --depth 1 \
    https://github.com/Interkarma/daggerfall-unity.git "$DFU_PATH"
  git -C "$DFU_PATH" sparse-checkout init --cone
  git -C "$DFU_PATH" sparse-checkout set Assets/Scripts
  git -C "$DFU_PATH" checkout
fi
API="$DFU_PATH/Assets/Scripts/API"
[ -d "$API" ] || { echo "no Assets/Scripts/API under $DFU_PATH" >&2; exit 1; }

# The 37 reader files the driver compiles. Everything else in DFU's tree
# drags in UnityEngine or the game layer and is out of scope for a READER
# harness (see README).
FILES="Arch3dFile Arch3dPatch BaseImageFile BlocksFile BsaFile CifRciFile
ClassFile DFBitmap DFBlock DFCareer DFColor DFLocation DFMesh DFPalette
DFPosition DFRandom DFRegion DFSize DFSound FaceUVTool FactionFile FileProxy
FntFile GfxFile ImgFile ItemsFile MagicItemsFile MapsFile PakFile PatchList
PowerOfTwo SkyFile SndFile TextFile TextureFile Vector3 WoodsFile"

mkdir -p "$D/cs/api"
missing=""
for f in $FILES; do
  if [ -f "$API/$f.cs" ]; then cp "$API/$f.cs" "$D/cs/api/$f.cs"; else missing="$missing $f"; fi
done
# Two live outside API/ in the DFU tree.
for p in "Save/SpellRecord.cs" "Utility/DaggerfallSpellReader.cs"; do
  b="$(basename "$p")"
  src="$(find "$DFU_PATH/Assets/Scripts" -name "$b" -print -quit)"
  [ -n "$src" ] && cp "$src" "$D/cs/api/$b" || missing="$missing $b"
done
[ -n "$missing" ] && { echo "MISSING from this DFU checkout:$missing" >&2; exit 1; }

# The harness edits, each marked HARNESS in-file. All five are
# behaviour-neutral and exist only to compile outside Unity:
#   Arch3dFile  - records FaceUVTool's exact inputs so both sides consume
#                 one corpus (proven inert: the arch3d dump is identical
#                 with and without it)
#   BlocksFile  - `ref var` reassignment rewritten as direct struct-array
#                 indexing (mcs 6.8 does not accept the C# 7.3 form)
#   DFBlock     - FullSerializer converters/attributes stripped
#   SpellRecord - SaveTree plumbing stripped (SaveTreeBaseRecord is game
#                 layer; the harness only reads SPELLS.STD records)
#   DaggerfallSpellReader - FullSerializer JSON helpers stripped
echo "== applying the harness patches =="
for f in Arch3dFile BlocksFile DFBlock SpellRecord DaggerfallSpellReader; do
  patch -s -p0 -d "$D/cs/api" -i "$D/patches/$f.cs.patch" -o "$D/cs/api/$f.cs.new" "$D/cs/api/$f.cs" \
    && mv "$D/cs/api/$f.cs.new" "$D/cs/api/$f.cs" \
    || { echo "patch failed for $f.cs - DFU master has moved; re-derive it" >&2; exit 1; }
done

echo "ready: $(ls "$D/cs/api" | wc -l) sources in cs/api"
echo "next:  ARENA2_PATH=/path/to/arena2 bash $D/run.sh"
