# Morrowind assets - the opt-in 3D layer, and how it loads

The port can draw the first-person arms, hands, weapons and (in the
test room) a third-person body off the player's own Morrowind data:
`Morrowind.bsa`, the expansions' archives, the `.esm` masters, and any
loose `meshes/` or `textures/` a mod ships (MW-D40). Nothing of it is
in the repo; it is attached through the Enhanced pane's picker and kept
in the browser's IndexedDB (`scenes/dataSource.js`, the `morrowind`
store). The arc that built the layer is spread over Systems-Arc (the
MW-D slices), `02-Formats/Morrowind-Rules.md` (what OpenMW does, cited)
and the IG slices (Testing.md rows); this page is the layer's own home,
opened by MW-LOAD.

## The load path

1. **Attach** (`storeMorrowindFiles`): the picked files that match
   `.bsa/.esm/.esp` or a loose asset extension go into the store, keyed
   by basename (archives, masters) or canonical data-files path (loose).
2. **Register** (`registerMorrowindData`, from the controller's boot):
   counts the set for the settings row and stamps the attach
   generation the rig polls.
3. **Open** (`loadMorrowindArchives`): every stored `.bsa`, ranked so
   expansions and mods answer before `Morrowind.bsa`, behind one loose
   archive that answers before all of them (the engine's data-files
   law). Cached for the session against the generation (IG2).
4. **Build** (`combat/fpArm.js buildFpArm`, from the weapon rig): the
   masters are read whole and walked for the race, body-part, armour,
   clothing, weapon and GMST records (memoised per session, IG2); the
   skeleton, the body parts, the weapon and its animations are read out
   of the archives and parsed (NIF, KF); the textures they name are
   read and decoded (DDS to RGBA8) and uploaded.
5. **Swap** (the rig's worn/weapon watchers): a change of equipment
   rebuilds the pieces off the same caches.

## MW-LOAD (2026-09-08) - the archive is opened, not read

Mac: "improve the load time when Morrowind assets are enabled.
currently it takes a little too long to properly load in."

**Where the time went.** Every boot read every stored archive out of
IndexedDB as a whole `ArrayBuffer` - a structured clone of every byte
- and then indexed its directory; the masters likewise. On a retail
set that is three archives of 150-300 MB and masters of 80 MB, cloned
and resident before a single mesh was asked for, and the first-person
arm needs a few dozen entries of them. Measured in headless Chromium on
a settled store, per 300 MB archive:

| read | cost |
|---|---|
| `get` as a whole ArrayBuffer | 1.0-3.3 s |
| `get` as a Blob handle | 0 ms |
| the Blob's first 2 MB range | 5-7 ms |
| fifty 200 KB ranges | 45-48 ms (about 1 ms each) |
| the Blob read whole | 240-310 ms |

And the parsers, at retail sizes: a 10,000-entry BSA directory 39 ms;
the six master walks 22-52 ms each on a synthetic 70 MB master (about
180 ms for all six, once per session); a 1024x1024 DXT1/DXT5 texture
with its mip chain 55-59 ms to decode, a 512x512 one 11-13 ms.

**The fix.** A Morrowind file is stored as the Blob it arrived as
(`storeAssets`), which IndexedDB keeps on disk and hands back as a
handle. `MwBsaFile.open(blob)` reads the header and the directory by
range and leaves the data buffer where it is; an entry's bytes come in
by range when a reader `load`s it, cached in the archive. `get` stays
synchronous and answers what has been loaded - the contract every
reader already speaks - and throws, by name, for a lazily opened
archive asked for an entry nobody loaded. The loose archive speaks the
same doors with everything resident. A set attached before MW-LOAD is
stored as bytes; `assetBlob` wraps such a value once and re-stores it
as a Blob behind the read, so the next boot opens it by range. The
readers in `combat/fpArm.js` load what each stage will read before the
stage runs - one `loadFromArchives` door, deduped and concurrent, the
same `find` law as the synchronous read, and `findLoaded` naming any
read that outran its load (the record of each site is in that file's
`MW-LOAD:` notes; `test/mwload_fparm.test.js` attributes every
synchronous archive read to its covering load). The item icon's
getter stays synchronous, so on a lazy archive it is a two-phase
door: the first ask kicks one load, answers null (the classic sprite
stands, as every other miss means), and notifies the pack to repaint;
the next ask reads bytes in hand. `buildFpArm` reports its stage
timings (`archives`, `esm`, `meshes`, `textures`, `total`) on the
built object and in one `[mw] arm built in N ms` line.

**The masters (the second cost, and the larger one).** `buildFpArm`
asked six questions of every stored `.esm` - the body parts, the
races, the armors, the clothes, the weapons, one GMST - and each was
its own walk of the whole file through `walkEsm`. On a synthetic
master with 2 KB records that is 20-50 ms a walk; on Morrowind.esm,
whose records are a few dozen bytes each, the explorer measured
1.0-2.7 s a walk, times six, times the three retail masters, and the
memo that held the answers was per page load. So the six questions
are now ONE pass (`extractArmRecords` in `formats/mwFirstPerson.js`,
riding the same per-record readers the six extractors call, pinned
equal to them), and the answer - plain data, JSON whole - is KEPT:
`loadMorrowindArmRecords` in `scenes/dataSource.js` writes it to the
derived store under a key that names the reader version, the file, its
Blob size and a stamp over its first and last 64 KB, and on a later
boot reads it back without touching the master's bytes at all. The
envelope refuses itself when stale (another version, a torn set, a
key that is not this file's), and a refused set is re-extracted. A
build takes its records through that door when the deps carry it
(`d.loadMorrowindArmRecords`) and walks the bytes as before when they
do not (a test's deps, or a store that could not keep the set).
Measured in headless Chromium on a synthetic 79 MB master: the first
load reads and extracts in 280-390 ms and keeps the set; the next
page load answers in 10 ms.

The probe also found a root-cause gap under every swap cache: the
attach fingerprint was the sorted NAMES, so re-attaching a different
file under the same name (a newer master, a modded one) bumped
nothing and the caches answered for the file that was gone. The
fingerprint carries the stored sizes now, read off the Blob handles.

**The face match.** `matchFaceFor` measures every playable head and
hair of the race and sex - a mesh parse and a texture decode each -
to pick the nearest to the classic portrait. The decode now stops at
level 0 (`decodeDds(bytes, { levels: 1 })` through
`decodeTextureImage`), which is the only level the measurement reads;
the chain below it was a third again of the work.

**What it does not do.** The texture decode still runs on the main
thread per build, and the third-person body is still built with the
arm rather than on the first switch to third person. Both are on the
board if the timing line says they matter on Mac's machine.
