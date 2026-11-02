#!/bin/bash
# AUDIT 18 differential parity harness - full re-run.
#   bash run.sh            (build + dump both sides + diff everything)
set -u
D="$(cd "$(dirname "$0")" && pwd)"
ARENA2_PATH="${ARENA2_PATH:-}"
[ -n "$ARENA2_PATH" ] || { echo "set ARENA2_PATH to your arena2 directory" >&2; exit 1; }
export ARENA2_PATH
export DFU_PATH="${DFU_PATH:-$D/dfu}"
export FACEUV_CORPUS=$D/out/faceuv_corpus.txt
mkdir -p "$D/out"

echo "== building C# ground-truth driver =="
( cd "$D/cs" && mcs -target:exe -out:dump.exe -langversion:latest shim/*.cs api/*.cs Dump.cs Dump2.cs ) || exit 1

echo "== generating FaceUVTool input corpus from ARCH3D =="
mono "$D/cs/dump.exe" faceuvcorpus /dev/null 2>/dev/null

# corpus : cs-cmd : js-script [: js-arg]
CORPORA="
bsa:bsa:bsa.mjs
texture:texture:texture.mjs
texparams:texparams:texparams.mjs
texspectral:texspectral:texspectral.mjs
tables:tables:tables.mjs
img:img:img.mjs
cifrci:cifrci:cifrci.mjs
arch3d:arch3d:arch3d.mjs
blocks:blocks:blocks.mjs
maps:maps:maps.mjs
woods:woods:woods.mjs
dfrandom:dfrandom:dfrandom.mjs
faceuv:faceuv:faceuv.mjs
class:class:class.mjs
biog:biog:biog.mjs
spells:spells:spellsmagic.mjs:spells
magic:magic:spellsmagic.mjs:magic
textrsc:-:textrsc.mjs
textcat:-:textcat.mjs
faction:-:faction.mjs
misc:-:misc.mjs
"
mono "$D/cs/dump.exe" misc "$D/out/cs.misc.txt" 2>/dev/null
grep -P "^textrsc\.(recordCount|\d+\.(id|byIdLen|byIdSha))\t" "$D/out/cs.misc.txt" > "$D/out/cs.textrsc.txt"
grep -P "^textrsc\.\d+\.textcat\t"                            "$D/out/cs.misc.txt" > "$D/out/cs.textcat.txt"
grep -P "^faction\."                                          "$D/out/cs.misc.txt" > "$D/out/cs.faction.txt"
grep -vP "^(faction|textrsc)\."                               "$D/out/cs.misc.txt" > "$D/out/cs.misc.f.txt"

for row in $CORPORA; do
  name=${row%%:*}; rest=${row#*:}
  cscmd=${rest%%:*}; rest=${rest#*:}
  js=${rest%%:*}; jsarg=""
  case "$rest" in *:*) jsarg=${rest#*:};; esac
  cs="$D/out/cs.$name.txt"
  [ "$cscmd" != "-" ] && mono "$D/cs/dump.exe" "$cscmd" "$cs" 2>/dev/null
  [ "$name" = "misc" ] && cs="$D/out/cs.misc.f.txt"
  node --max-old-space-size=4096 "$D/js/$js" "$D/out/js.$name.txt" $jsarg 2>/dev/null
  jsf="$D/out/js.$name.txt"
  if [ "$name" = "tables" ]; then
    # PatchRegionIndex is documented as not ported (mapsFile.js header).
    grep -vP "^tbl\\.patchRegion\\." "$cs" > "$cs.f"; cs="$cs.f"
  fi
  if [ "$name" = "maps" ]; then
    # climate.names and DungeonBlock water/castle are written by NEITHER reader
    # (C# struct defaults vs absent JS fields) - filtered on both sides.
    grep -vP "\.climate\.names\t|\.dun\.blk\.[0-9]+\.(water|castle)\t" "$cs"  > "$cs.f";  cs="$cs.f"
    grep -vP "\.climate\.names\t|\.dun\.blk\.[0-9]+\.(water|castle)\t" "$jsf" > "$jsf.f"; jsf="$jsf.f"
    grep -vP "^maps\.wcs\.\d+\.names\t" "$cs"  > "$cs.g";  cs="$cs.g"
    grep -vP "^maps\.wcs\.\d+\.names\t" "$jsf" > "$jsf.g"; jsf="$jsf.g"
  fi
  n=$(diff "$cs" "$jsf" | grep -cP '^[<>] ')
  lines=$(wc -l < "$cs")
  printf '%-12s %9s values   %6s differing lines\n' "$name" "$lines" "$n"
done
