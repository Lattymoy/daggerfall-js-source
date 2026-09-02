#!/bin/bash
# Fetch the DFU sources the differential harness compiles, and apply the
# harness edits - five behaviour-neutral ones and, since E8, the ONE that
# is not (FaceUVTool's row-18 widening; see below).
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
#
# ...and ONE that is not behaviour-neutral, and says so:
#   FaceUVTool  - ROAD-E E8. Ledger row 18 (Port-Ledger.md A) approves the
#                 port computing FaceUVTool in JS doubles where DFU's
#                 df3duvparams_lt/df3duvmatrix_t are float. That departure
#                 alone moves 52,505 of 1,917,087 corpus UVs, which would
#                 bury every OTHER faceuv finding under it - so the faceuv
#                 corpus is compared against a DFU built AT MATCHED
#                 PRECISION: this patch widens the two structs, the
#                 determinant and Xi/Yi/Zi to double. Vector3 is ALREADY
#                 double in DFU (API/Vector3.cs:35-45, :151-160, :508-520,
#                 :583-597), so nothing in the basis walk is touched.
#                 The audit-18 F4 pin (test/audit18.test.js:190) carries
#                 expected values dumped from exactly this build; before
#                 E8 the edit lived only in a scratchpad tree, so the
#                 "re-runnable" claim on Port-Ledger row :483 was not true
#                 of anything in the repo. It is now.
echo "== applying the harness patches =="
for f in Arch3dFile BlocksFile DFBlock SpellRecord DaggerfallSpellReader FaceUVTool; do
  patch -s -p0 -d "$D/cs/api" -i "$D/patches/$f.cs.patch" -o "$D/cs/api/$f.cs.new" "$D/cs/api/$f.cs" \
    && mv "$D/cs/api/$f.cs.new" "$D/cs/api/$f.cs" \
    || { echo "patch failed for $f.cs - DFU master has moved; re-derive it" >&2; exit 1; }
done

echo "ready: $(ls "$D/cs/api" | wc -l) sources in cs/api"
echo "next:  ARENA2_PATH=/path/to/arena2 bash $D/run.sh"
