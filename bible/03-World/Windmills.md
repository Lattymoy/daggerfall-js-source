# Windmills of Daggerfall - Kamer's mod, 1:1 with permission

The arc that built this - WM1 through WM4c, 2026-08-29 to 2026-08-30 -
lives in `03-World/World-Arc.md:1133-2030`, interleaved with the slices
around it, and until the MODS AUDIT of 2026-09-08 there was no page
that held the mod's law against the port's in one place. Every other
vendored mod has one (`Roads.md`, `07-Rendering/Dynamic-Skies.md`,
`07-Rendering/Seasons-Iliac-Bay.md`); this is the windmills'. The
Ledger row is `01-Overview/Port-Ledger.md`, section A, "WINDMILLS THAT
TURN".

## What the mod is

Kamer's "Windmills of Daggerfall" v2.0 (Nexus mod 33; the archive
`WindMills.rar`, supplied by Mac 2026-08-29, GUID
`aaac5c33-f615-444e-98fe-818b4a484b4c`) is NOT a models-only mod. The
archive is the Unity source project - 24 prefabs, 21 PNGs, 21 `.mat`,
9 DAEs, 3 `.cs`, `WindMills.dfmod.json` - and its behaviour is
placement data (7 WorldData `.RMB.json` block overrides, each adding a
subrecord to a farm block) PLUS two live scripts (`Spin_Up.cs`,
`SpinTime_Roller.cs`; `LoadWindmill.cs` is dead tutorial scaffolding
outside the manifest) PLUS an interior subrecord the author built for
each block. Its v2.0 changelog: "Windmills moved and removed from some
farms, villagers no longer walk through them, windmills added to the
minimap, windmill redesign, you can now enter windmills with an
interior redesign, added sounds to windmills, windmills now change
based on climate and season." Upstream (Nexus, the DF Workshop forums)
is unreachable from the build container; the archive is the source of
truth.

## The law table

| the mod | the port | verdict |
|---|---|---|
| Sail turns about its own local Z at -13 deg/s (`Spin_Up.Update`) | `ROTOR_AXIS = 'z'`, `ROTOR_SIGN = -1` (`windmills.js`) | FAITHFUL (sign restored at WM4b after a wrong +1 at WM2e) |
| 13 deg/s always, gale or calm | 13 on the wind model's FAIR DAY, the rest from the wind - `CALM_ROTOR_DEG_PER_SEC`, `ROTOR_GAIN` derived from `WIND_ROW_FAIR`, the stall at the model's floor `WIND_ROW_CALM`, the furl at 40 | DEPARTED, recorded (Ledger A, enhanced-only; Mac: keep that). Re-anchored by the MODS AUDIT - below |
| No stall, no cap, no per-mill phase | `STALL_WIND`, `FURL_DEG_PER_SEC`, `rotorPhase(x, z)` | the port's own, declared as skin |
| Blade hub at local (3.96, 6.01, -5.5) on the 41600 prefab | `ROTOR_HUB` | FAITHFUL |
| `Blade.dae` (node `Blades`, 26 tris, 2 groups), `New_Windmill 2.dae` (332 tris, 5 groups), `41601.dae` (722 tris, 8 groups), `Plank_Gear.dae`, `Roller.dae` | baked by `scripts/bakeWindmill.mjs` into `world/windmillMesh.js`, byte-identical on re-bake | FAITHFUL; the five exports sha256-pinned since the MODS AUDIT (`test/vendorIntegrity.test.js`) |
| Body materials from `41600.prefab`: 364_2 / 067_1 / 369_3 / 067_1 / 332_0; the blade's from the DAE's own bound images (000_77, 067_1) | `BODY_MATERIALS`; the ROTOR's submesh pairs | FAITHFUL - archive 0 is the solid-colour archive, so 000_77 is a palette swatch. The blade is the one part read off the DAE rather than the prefab's `m_Materials`; the sail's 067_1 is verified in all seventeen prefabs, the 000_77 group's binding was not read from the prefab |
| Seven placements, one mill per block: FARMAA00/01/02/05/06/07/09 | `PLACEMENTS`, `rmbLayout.windmillsFor` | FAITHFUL - his list |
| Each subrecord places TWO models: 41600 and classic 118 (the door-carrier) | `entry.building`, `enhancedOnly` | FAITHFUL |
| 17 climate/season variant prefabs; walls (slot 0) and roof (slot 2) differ; desert never winters | `SKIN_SLOTS`, `CLIMATE_SKINS`, `skinnedBody` | FAITHFUL (his records verbatim, NOT rebased through ClimateSwaps) |
| `41600_DesertFall/Spring/Winter`, `41600_Desert 1` | not carried | DFU's `MeshReplacement.GetName:329-343` never asks for those names |
| Machinery 41601 with its 8 prefab materials, served before ARCH3D | `MACHINERY`, `dataPipeline.js` | FAITHFUL |
| `Plank_Gear` at (11.02, 4.49, -2.28), quat (0.5, 0.5, -0.5, 0.5), `Spin_Up`, -13 deg/s about own Z, no collider, hums | `MACHINERY_CHILDREN[0]`, `mountMachineryChild` | FAITHFUL (the beam lands vertical along parent -Y with the port's transform; with an added up-axis conversion it would lie horizontal) |
| `Roller` at (9.64, -7.14, -2.21), quat (-0.7071, 0, 0, 0.7071), `SpinTime_Roller`, +13 deg/s about own X, MeshCollider | `MACHINERY_CHILDREN[1]`, collider at rest pose | FAITHFUL - and see the node-matrix note below |
| Machinery turns at his constant indoors | `advanceMachinery` | FAITHFUL |
| `Spin_Up.Start` loops `ArenaFireDaemon`, LoopOnAwake, spatialBlend 1, log rolloff, min 1, max 500 | `MILL_SOUND` | FAITHFUL |
| The second AudioSource in `Spin_Up.Start` (never given a clip) | not implemented | a no-op upstream |
| The added interior subrecord | `WINDMILL_INTERIOR`, `attachWindmillRecord` | FAITHFUL to the vendored file - see the open question below |
| Header counts 44 models / 12 flats / 10 doors | rewritten to the arrays' 16 / 11 / 0 | DEPARTED, recorded |
| 21 `.PNG` exports of classic archives | never carried | doctrine's second non-negotiable, enforced by `windmillmesh.test.js` |
| The 7 whole WorldData blocks; `11511.prefab`, `11512.dae`, `WindNoDoor.dae`, `Door.dae`, `41600 1/2/4.prefab`, `LoadWindmill.cs` | not carried | outside the manifest's Files list or Daggerfall's own layout |
| Handedness: every number Unity-space, the mesh Collada right-handed | X negated, normals mirrored, winding reversed at the bake | FAITHFUL |

All 60 windmill pins pass; re-running the bake reproduces
`windmillMesh.js` byte for byte.

## The seams

Mill draw in `?exterior`: one upload per location on the enhanced
skin, the tower into the static draw list with an AABB padded by
`MILL_SAIL_PAD` for the sails' sweep, a collider, and a `windmills[]`
entry with its matrix and phase; the companion 118 rides the ordinary
model loop and is skipped on the classic skin. In `?world`: uploaded on
the first mill streamed in, stored pixel-local, the phase keyed on the
pixel-plus-local position so the floating origin cannot re-seed it.
Rotor advance in both hosts reads `sky.wind()` once a frame, advances
every mill and culls only the draw, and stands a mill still when the
row is null. The hum starts per mill, ungated on the wind, silenced
indoors, stopped by a destroyed pixel; indoors only the part carrying
`Spin_Up` (the gear) hums. The interior door: the 118 building has no
`recordIndex` of its own because its subrecord is not in the block the
port reads; `attachWindmillRecord` appends it, idempotently, enhanced
skin only, and the context build mounts the machinery per placement.

## MODS AUDIT (2026-09-08) - the 1:1 re-audit

Mac: "go ahead and audit the other mods while youre at it to ensure they
are 1:1." An Opus explorer walked the archive's record (the WM4 audit
opened every file in it) against the port. What it found, and what was
done:

**The rotor's anchor fed nothing (fixed).** `ROTOR_GAIN` was derived
from `WEATHER_SKY.sunny.wind` so that "13 in fair weather" could not
drift - and WIND1 replaced the row's vector with the wind model's
(`shared.js` `weatherRowNow.wind = windModel.vector()`), so no consumer
had read that vector since; Audit-56 measured 3 to 24 deg/s on a fair
day. And `STALL_WIND = 0.005` sat ABOVE the model's floor
`WIND_ROW_CALM = 0.0046` while the module's prose said no row was below
it. The wind model now names its calm roll and drift (`CALM_MIN`,
`CALM_SPAN`, `DRIFT_MEAN`, `DRIFT_SWING`) and derives its FAIR DAY from
them (`FAIR_STRENGTH`, `WIND_ROW_FAIR` - the mean strength with no front
up); the mill anchors 13 deg/s to that row and its stall to the model's
floor (a dead calm stands the mill still; the stillest day the model
rolls crawls at about two degrees a second; a full thunder front runs
past the furl). `windmills.js` imports nothing from the sky table any
more and the pins say so, and the anchor pin checks the model's own
fair afternoons average the anchor's strength.

**The Ledger row was stale in five places (fixed).** "Six placements"
three times over (WM4a found the seventh), "his -13 and our +13 turn
the sails the same way" (WM4b reversed that: his sign is ours), and
"there is no sound" (WM4c shipped the hum). Corrected in the row, each
with the slice that changed it.

**The blade's bounding box was mislabelled (fixed).**
`06-Systems/Mod-Support-Arc.md` gave `Blade.dae`'s plane as x/z; it is
x/y (x[-17.03, 17.05], y[-17.04, 17.05], z[-1.75, 1.56]). The conclusion
- the blade pivots on its own centre - survives.

**The probe asked a retired question (fixed).** `tools/windmillProbe.mjs`
was written to find the sail inside classic model 41600; WM2d found
classic Daggerfall stands no windmill and 41600 is Kamer's own id. Its
header says so now; the tool still dumps any classic id and its
self-test needs no ARENA2.

**The `Roller.dae` node matrix (recorded).** `Blade.dae`, `Windmill.dae`
and `41601.dae` carry the Z_UP node matrix whose composition with
Z-up-to-Y-up is the identity, which is what the bake asserts to apply
no transform. `Plank_Gear.dae`'s is a rotation plus a translation and
`Roller.dae`'s is the IDENTITY; the bake passes `'ignore'` for both
children on one argument - the prefab references the mesh asset
directly, so Unity applied neither. For the gear the geometry
corroborates it (the beam lands vertical, as a drive shaft should).
For the roller an identity node matrix means the raw Z-up data is
carried through with no conversion, where the other parts get theirs
from their node matrix - a 90-degree difference about X. The roller's
long axis lands on +X either way and it SPINS about its own X
(`SpinTime_Roller`), so the difference is a phase offset on a part that
turns: not visible, and not a departure that can be settled without
the prefab under an eye. Recorded, not changed.

**The mill is not on the automap, and townsfolk walk through it
(recorded, not portable from here).** The changelog's "windmills added
to the minimap" and "villagers no longer walk through them" are one
edit: the block's 64x64 `AutoMapData` inside his WorldData override,
which the automap draws and `CityNavigation` carves from. The port
carries only the ADDED placement record from each override - a
WorldData block is Daggerfall's layout and stays out - so both consumers
read the CLASSIC bytes: no mill on the automap, and the mill's footprint
walkable weight for mobile NPCs (the tower's collider stops the player;
NPCs path on the grid). Carrying his `AutoMapData` edit would mean
carrying part of his block, or deriving the footprint from the mill's
placement and painting it into the grid at attach time. The second is a
port-side design, not a 1:1 item; it is for Mac to call. Named here so
it is not mistaken for a wiring defect.

**The mill's building is not a building (recorded).** DFU's `RMBLayout`
walks `SubRecords.Length`, which over his override includes the added
subrecord, so his mill's 118 gets a name, an automap plate and
discovery. The port bounds the building walk by the DECLARED count
(`talkTopics.js` `blockBuildingCount`, `buildingSummaries.js`) so an
out-of-range `recordIndex` cannot read the fixed 32-slot list's garbage,
and the mill's door takes worldModes' "fails open" arm: no
`discoverBuilding`, no summary, no hours lock, no nameplate. Defensible
and deliberate; it was recorded only in source comments citing
`AUDIT 39 (#18/#20)` and `AUDIT 39r (R10)`, which resolve to no bible
page. This is that page.

**`interior.json` may be a truncated copy of his room (open, for Mac).**
Its header declares 44 models, 12 flats and 10 doors over arrays of
16, 11 and 0 - while `NumSection3Records 51` and `NumPeopleRecords 1`
match exactly, so the header is not wholesale stale. The README reads
the mismatch as another hand-edit slip, but the two precedents it
cites run the OTHER way (declared lower than carried, which is what
hand-ADDING a record produces); declared higher by 28 is the opposite
signature, and the Ledger row, written while the rar was open, calls it
a "44-model INTERIOR". The baked module rewrites the counts to the
arrays' lengths and the pin asserts that, so nothing downstream can
notice. Ten declared doors against none carried is the sharp edge: only
the 199_8 enter-marker flat stands between the player and no way back
out. The rar is not in the container; Mac has it. If the vendored file
is short, re-extracting the subrecord from any of the seven overrides
settles it in one bake.

Also recorded: the blade's 000_77 group is bound from the DAE rather
than the prefab (above); and `vendor/windmills-kamer/` has no upstream
URL or licence file - only the README's prose provenance and, now, the
hashes. Those hashes are against the archive Mac supplied, which is the
only source there is.
