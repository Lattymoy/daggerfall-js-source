# The differential parity harness (AUDIT 18)

Compiles **Daggerfall Unity's own reader classes** under Mono and diffs their
output against this port's, over the whole ARENA2 corpus. Reader parity stops
being an argument and becomes a measurement.

At AUDIT 18 it compared **10,865,545 values** and found the reader layer
byte-identical except for three real defects (all since fixed) and a handful of
documented, inert residuals.

## Run it

```sh
bash prepare.sh                 # fetch DFU sources + apply the harness patches
ARENA2_PATH=/path/to/arena2 bash run.sh
```

`prepare.sh` sparse-clones Daggerfall Unity into `./dfu`. Point it at a
checkout you already have with `DFU_PATH=/path/to/daggerfall-unity`.
Needs `mcs` and `mono` (`apt-get install mono-mcs mono-runtime`).

`run.sh` prints one line per corpus: values compared, lines differing.

## Why DFU's source is not committed here

Port-Doctrine keeps Daggerfall Unity an **external** reference — the sparse
clone — for the same reason ARENA2 never enters the repo. Vendoring 1.2MB of
its C# would quietly change that stance, so `prepare.sh` reproduces the
checkout instead. What IS committed is only what this project wrote: the
driver, the shims, the JS dumpers, and five patches.

DFU is MIT (Interkarma and contributors); see the repo's attribution.

## What is committed

| Path | What |
|---|---|
| `cs/Dump.cs`, `cs/Dump2.cs` | the driver — one subcommand per corpus |
| `cs/shim/UnityShim.cs` | `Color32`, `Color`, `Mathf`, `Debug`, `Resources`, `Application`. **`Mathf.RoundToInt` is banker's rounding** — Unity rounds half to even and that is load-bearing here |
| `cs/shim/GameShim.cs` | the vanilla, no-mods, default-settings path for the few game-layer members the readers touch |
| `cs/shim/BiogParse.cs`, `SpectralShim.cs` | DFU source sliced programmatically, not retyped |
| `cs/shim/HarnessCorpus.cs` | records FaceUVTool's inputs so both sides consume one corpus |
| `js/*.mjs` | the port-side dumpers, same format |
| `patches/*.cs.patch` | the five behaviour-neutral edits (see `prepare.sh`) |
| `tables/*.mjs` | the **data-table** differential: extracts DFU's hardcoded C# tables and the port's JS literals and diffs them key-for-key. ~9,900 values across 30 tables at AUDIT 18 |

## The format

`key<TAB>value`, fixed emission order. Floats are emitted as their **IEEE-754
32-bit hex bit pattern** (the JS side uses `Float32Array`), so C# `float` and
JS doubles compare exactly with no formatting ambiguity and no precision
false-positives. Bulk data compares by SHA-1 over the exact byte stream.

## Reading a non-zero result

A difference is not automatically a port bug. Check, in order:

1. **Your own harness.** A shim or dump-format artefact is worse than useless.
   AUDIT 18 caught three of its own this way — loading with `UseDisk` where DFU
   uses `UseMemory` (which skips `Arch3dPatch`) produced 8 fake mesh
   divergences; sharing one `DFPalette` across IMG files corrupted later ones.
2. **`bible/01-Overview/Port-Ledger.md` A and B.** Approved departures and
   deliberately preserved DFU bugs are not findings. Row 18's float→double
   widening alone accounts for 52,505 of 1,917,087 UVs.
3. **Then** the port.

To prove a mismatch is really the port's, build a **controlled probe**: copy the
sources to a second tree, make one targeted change, and show the C# output moves
to match. That is how F3 (the faction struct-copy) and F4 (the reciprocal
normalize) were settled.

## Not differentiable

`GetSpectralEmissionColors32` / `GetFireWallColors32` (depend on
`Color.Lerp`'s engine-internal float→byte rounding — the shim would be the thing
under test); `umRandom` (no DFU counterpart, Ledger A); `MeshReader`, `RMBLayout`,
`RDBLayout`, `TextureReader` beyond `SetSpectral` (Unity game layer — out of scope
for a *reader* harness); readers with no port counterpart yet
(`MonsterFile`, `FlatsFile`, `VidFile`, `FlcFile`, `BookFile`, `CfaFile`, …).

## Generated, and ignored

`dfu/`, `cs/api/`, `cs/dump.exe`, `out/` — all reproducible from `prepare.sh`
and `run.sh`. `out/` alone reaches ~2.4GB.
