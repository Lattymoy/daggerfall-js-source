#!/bin/sh
# Sequential mutation rounds. Must run one at a time: they patch the working tree.
set -e
# Run from a DISPOSABLE git worktree - this mutates src/.
cd "${WORKTREE:-$PWD}"
export ARENA2_PATH="${ARENA2_PATH:?set ARENA2_PATH}"

echo "=== R2 systems ==="
node .mutaudit/mutate.mjs --files src/systems/ --per-file 6 --out r2.jsonl --seed 777
echo "=== R3 world+formats ==="
node .mutaudit/mutate.mjs --files src/world/,src/formats/ --per-file 4 --out r3.jsonl --seed 4242
echo "=== R4 characters ==="
node .mutaudit/mutate.mjs --files src/characters/ --per-file 3 --out r4.jsonl --seed 99
echo "=== R5 ui+render+scenes ==="
node .mutaudit/mutate.mjs --files src/ui/,src/render/,src/scenes/ --per-file 3 --out r5.jsonl --seed 31337
echo "=== ALL ROUNDS DONE ==="
