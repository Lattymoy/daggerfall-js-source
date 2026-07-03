# Characters-Arc (ACTIVE)

People and enemies: the classic DATA layer verbatim first (positions,
factions, flags, spawn tables), classic billboards as the baseline
visual, then the voxel rig system replaces them piece by piece (the
doctrine's design win - see Port-Doctrine 2). Inputs COMPLETE: Readers
(people/NPC records parsed since the BLOCKS reader), World (interiors,
RDB layout), Player (activation reach for talk), Rendering (billboard
batches, point lights).

## Direction pivot (Mac, 2026-07-03)

Townsfolk STAY classic billboards - they already read right, and
band-recolored mannequins proved that unauthored voxel bodies
undersell the game. The rig craft goes where the 1:1 payoff is: the
PLAYER paperdoll. ?voxelfolk survives only as the render-path test
harness for drawCharacter until C7 exists (not a product direction;
C4c's milestone note stands as history). Every C6 piece is AUTHORED
at Voxlight enemy craft against the real paperdoll art - no
band-recolor shortcuts ship, ever.

## Slice plan

- **C1 (SHIPPED) - interior people (AddPeople verbatim)**: BlockPeopleRecords ->
  billboards at (XPos, -YPos, ZPos) * GlobalScale, base at the raw
  position (DFU pivots at centre then shifts +size.y/2 - our batches
  take base positions, so the raw position IS the base). Every person
  carries StaticNPC layout data (factionID, flags, archive/record,
  position hash inputs). Visibility gates (shop hours, house
  ownership, guild membership, TG/DB house rule - DaggerfallInterior
  AddPeople tail) are RECORDED as data and routed to Systems; C1
  spawns everyone. Corpus test over all interiors; in-engine proof in
  a populated tavern.
- **C2 (SHIPPED) - exterior NPCs + name banks**: RMB exterior people flats with
  faction metadata (StaticNPC), GetNameBankOfRegion verbatim over the
  ported REGION_RACES table.
- **C3 (SHIPPED) - dungeon enemies (data)**: RDBLayout AddFixedEnemies /
  AddRandomEnemies verbatim (fixed ids, the random encounter tables +
  classic seed math), spawned as classic enemy billboards, no AI.
- **C4 - voxel rig foundation**: C4a vendored (SHIPPED, below).
  C4b: dagger's renderer grows a vertex-color character path (faces ->
  fan-triangulated interleaved buffer, lit by dagger's pipeline - no
  Voxlight pixel-lock ref hack). C4c: the bare humanoid replaces one
  townsfolk billboard behind ?voxelfolk, classic billboard height at
  the same base. DECIDE-C1 goes live at C4c.
- **C5 - the paperdoll SYSTEM, verbatim (data)**: the 1:1 core. Equip
  slots (~27), the strict layer/occlusion order (cloak interior behind
  body, exterior in front, armor over clothes...), wearable item
  templates with race/gender variants, and the dye/material tint
  tables. Ported + corpus-tested exactly like C1-C3 - this data DRIVES
  every visual slice after it.
- **C6 - outfit pieces on the rig (upstream-first)**: extend the
  Rewrite rig's socket set to cover the paperdoll slots (head, chest,
  pauldrons, forearms, hands, legs, feet, cloak - cape exists) IN
  project-final first, re-vendor + re-capture the parity fixture. One
  voxel builder per item TYPE; template x variant combos resolve
  through the verbatim dye/palette tables (the classic tint mechanism,
  which is what keeps hundreds of combos tractable). Authored through
  a paperdoll-lab page (rig + piece + sliders -> lock), the Voxlight
  lab workflow.
- **C7 - the live paperdoll (DECIDE-C2 resolved: live rotating
  viewport)**: the equipped rig rendered low-res in a UI viewport,
  mouse-drag rotate - the inventory paperdoll IS the character. The
  same equipped rig walks the world on NPCs (the design win the 2D
  paperdoll never had).
- **C8 - enemy rigs + spectral emission**: rigged enemies replace the
  C3 billboards; the Rendering arc's blocked spectral-emission row
  unblocks here.

## Milestones

C1-C3 audit: gates green (148/26), extraction validated - ENEMY_BASICS
re-derived from comment-stripped source is IDENTICAL (62 records), and
interior people/flat basing confirmed verbatim (DFU bases BOTH at the
raw position via the +size.y/2 shift; our batches take bases). Three
fixes at root in dungeonEnemies.js: a dead `rand` import, a dead
GLOBAL_SCALE import + re-export (the P4-P6 audit's re-export class),
and the table-fill guard reshaped to DFU's exact form - the fill
indexes EncounterTables[dungeonType] UNGUARDED (out of range throws
before any flat, same as C#) with the dead-in-practice per-flat range
check mirrored in the random branch. Privateer's pin unchanged.

### C3 - dungeon enemies, data + classic billboards (SHIPPED)

The classic selection path verbatim in `dungeonEnemies.js`: fixed
enemies from editor record 16 (factionOrMobileId & 0xff, the garbage-
MSB rule, typeValue 99 skipped) and random enemies from record 15 -
DFRandom.srand(LocationId), 256 non-water picks from
EncounterTables[dungeonType] + 256 water picks from table 19 through
ChooseRandomEnemyType's level banding, water routing on
waterLevel < raw classic Y, slot = flags with the slot-0 reroll, the
Slaughterfish/Dreugh/Lamia water veto, Passive on action byte 99, and
gender flags for types > 43. Three generated data modules (extraction-
scripted, never hand-copied): MOBILE_TYPES, ENCOUNTER_TABLES (45x20;
the source's dead commented Cemetery block stripped - Ledger B), and
ENEMY_BASICS (per-type texture archives + behaviour). RDB markers now
carry the flat resource (rawY/flags/factionOrMobileId/soundIndex/
action byte). dungeonContext spawns classic billboards (gender picks
the archive, record 0 standing frame, RDB raw-pivot rule) and returns
`enemies`; both dungeon pins gain the count; `__enemies` joins the
probes. DFU seeds the slot-0 Unity stream with DateTime ticks (an
upstream TODO) - we seed a xorshift with the LocationId for
determinism (Ledger A). Pins: Privateer's Hold 42 enemies / 25 fixed /
types [0,1,3,4,7,15,136,138,141]; in-engine the Daggerfall city crawl
reads `128 enemies` and the first (type 130, fixed) is framed on
camera. No AI - C5 rigs replace the billboards.

### C2 - exterior NPCs + name banks (SHIPPED)

Exterior: RMBLayout's verbatim rule - a flat record with NON-ZERO
factionID is an exterior NPC (editor flats skipped first, DFU order).
collectBlockFlats passes factionID/flags/recordPosition through on
every flat; `collectExteriorNpcs` filters the registry. Corpus pinned:
76 NPCs across 16 RMB blocks, archives [179,181,210] - the 210 is
SENT7.RMB's faction-tagged lamp, a classic quirk (Ledger B). Names:
NameHelper verbatim over DFRandom - FirstName 0+1/2+3, Surname 4+5,
Nord 0+1+"sen", Redguard 0+1+2+(75% male set 3 / female set 4, the C#
short-circuit preserved so females never consume the roll - the
stream-parity test pins it). Bank data is DFU's NameGen.txt committed
as nameGen.json, lenient-JSON normalized (Ledger B).
getNameBankOfRegion casts REGION_RACES verbatim. MonsterName routed to
Systems (UnityEngine.Random stream, quest-facing).

### C1 - interior people (SHIPPED)

`src/characters/interiorPeople.js`: AddPeople's data layer verbatim -
(XPos, -YPos, ZPos) * GlobalScale with the raw position as the BASE
(DFU centre-pivots then shifts +size.y/2; our batches take bases), and
the StaticNPC inputs (archive/record, factionID, flags, raw triple) on
every person. interiorContext batches people through the flat billboard
path and returns the `people` list parent-framed; both interior pins
gain the people count, `__people` joins the probe set. Visibility
gates (ownership / shop hours / open rules / GuildHall anytime / TG-DB
member) ride as data; evaluation routes to Systems. Corpus pinned:
14174 people across 6724/6832 interiors, 0 in empty records, archives
[176,177,181,182,183,184]. In-engine proof: TVRNAL06.RMB:0 in ?world -
pin `64 draws, 3 doors, 11 lights, 2 people`, patrons visible in the
captured frame.

### C4b + C4c - character render path + ?voxelfolk (SHIPPED)

C4b: dagger's renderer grows the character path - CHAR_VS/CHAR_FS are
the mesh program's lighting + fog verbatim over a vertex color (no
texture, no emission, no cutout), fed by the pure packer in
render/characterMesh.js (rig faces fan-triangulated into interleaved
pos/color/normal, REAL normals - dagger lights in-shader, no Voxlight
cel bake or pixel-lock ref slot). drawCharacter owns its program
binding (the R9 rule) AND the cull state: rig winding is inconsistent
by upstream design, so GL back-face culling is disabled per draw and
restored. C4c: ?voxelfolk swaps interior people billboards for ONE
packed bare humanoid drawn per person - uniform scale to 1.8, feet on
the billboard base (ty = y - minY * s), static facing until the
animation slice; flag off is C1 untouched. __peopleList joins the
probes. In-engine: TVRNAL06 patrons stand as the 710-face body under
interior ambient + point lights, framed on camera; pin unchanged
(`2 people`). DECIDE-C1 is now LIVE.

### C4a - Rewrite rig vendored (SHIPPED)

project-final's Rewrite Engine core + rig (math/geometry/palette,
limb/body/muzzleFlash - 6 modules, flat-pathed under
src/characters/rewrite/) with a vendor-time parity gate: 16
bare-humanoid cases (loco x hold + plug-free specials) hashed exactly
like Voxlight's 78-case fixture, captured from the canonical
rewrite/rig - the vendored copy is byte-identical (710 bare faces).
render/ stays Voxlight-side; dagger's renderer grows its own
vertex-color character path next (C4b), then one townsfolk archetype
behind ?voxelfolk (C4c) - DECIDE-C1 goes live there.

## DECIDEs (Mac)

- **DECIDE-C1 (RESCOPED at the pivot)** - equipment-piece art review
  cadence: per piece as authored, or batch a slot set then review.
- **DECIDE-C2 (RESOLVED)** - inventory paperdoll presentation: live
  rotating 3D viewport (not a baked sprite). Mac, 2026-07-03.

See: 01-Overview/Port-Ledger.md section C rows routed here.
