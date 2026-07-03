# Characters-Arc (ACTIVE)

People and enemies: the classic DATA layer verbatim first (positions,
factions, flags, spawn tables), classic billboards as the baseline
visual, then the voxel rig system replaces them piece by piece (the
doctrine's design win - see Port-Doctrine 2). Inputs COMPLETE: Readers
(people/NPC records parsed since the BLOCKS reader), World (interiors,
RDB layout), Player (activation reach for talk), Rendering (billboard
batches, point lights).

## Slice plan

- **C1 - interior people (AddPeople verbatim)**: BlockPeopleRecords ->
  billboards at (XPos, -YPos, ZPos) * GlobalScale, base at the raw
  position (DFU pivots at centre then shifts +size.y/2 - our batches
  take base positions, so the raw position IS the base). Every person
  carries StaticNPC layout data (factionID, flags, archive/record,
  position hash inputs). Visibility gates (shop hours, house
  ownership, guild membership, TG/DB house rule - DaggerfallInterior
  AddPeople tail) are RECORDED as data and routed to Systems; C1
  spawns everyone. Corpus test over all interiors; in-engine proof in
  a populated tavern.
- **C2 - exterior NPCs + name banks**: RMB exterior people flats with
  faction metadata (StaticNPC), GetNameBankOfRegion verbatim over the
  ported REGION_RACES table.
- **C3 - dungeon enemies (data)**: RDBLayout AddFixedEnemies /
  AddRandomEnemies verbatim (fixed ids, the random encounter tables +
  classic seed math), spawned as classic enemy billboards, no AI.
- **C4 - voxel rig foundation**: the humanoid rig on our renderer,
  outfit-piece workflow from project-final (design -> solo-tune ->
  lock); one townsfolk archetype replaced behind a flag.
- **C5 - enemy rigs + spectral emission**: rigged enemies; the
  Rendering arc's blocked spectral-emission row unblocks here.
- **C6 - paperdoll -> outfit equipment mapping**.

## Milestones

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

## DECIDEs (Mac)

- **DECIDE-C1** - rig art direction pass timing: after C4's first
  archetype, or batch all archetypes then review.

See: 01-Overview/Port-Ledger.md section C rows routed here.
