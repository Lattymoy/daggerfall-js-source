# FIELD BUGS 2026-10-25f - falling through the floor inside homes

One report: "House Collision: Players can fall through the floor inside homes (specifically observed in
player-purchased properties)." Read on `df1a2f8d8c` against the player's ARENA2 and both town packs (Beautiful
Villages, Beautiful Cities), with Daggerfall Unity's `DaggerfallInterior` (AddModels, IsBadInteriorModel,
AddActionDoors) as the reference. The pins are `test/world/fb1025_doorvoid.test.js`, the mutants
`tools/mutants/fb1025_doorvoid.json`. Named 25b: main's `Field-Bugs-2026-10-25.md` (ART-DOLL, ASK-LONGER) took 25.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "fall through the floor inside homes" | A ground-floor corner with no floor in seven Beautiful Cities houses: our copy of DFU's 31000 repair took out the pack's own room cell | BAD-CELL |
| 2 | the same | An interior door with a floor on one side and none past it on the other (Beautiful Cities' House2) | DOOR-VOID |

## Not the owned home's build

An owned home is built piece by piece so its owner can take its furniture out (BASE-HIDE, `scenes/decor/decorBase.js`):
each prop model is its own collider bucket. That was ruled out first, on the real data:

- No piece a home's owner can take out is the only floor under a walkable place in any of the 10,299 residences of
  Daggerfall's own blocks and both packs. The pieces with a drop under them are tables, beds and carts.
- Every residence was built twice, as a stranger's room and as an owned one, and walked the same scripted way in both.
  The same ten rooms let a body fall in both builds; the 140 HouseForSale houses let none fall in either.
- No floor query reads the room's shell bucket alone, and VOID-ENTRY's failsafe (`player/enterExit.js` standFromVoid)
  runs in every interior, homes included.

So the holes are in rooms anyone can enter. Owned homes are where players walk the most, which is where they were
found. Of the ten falling rooms, eight are in Daggerfall blocks no location of MAPS.BSA or either pack places. The two
left, Beautiful Cities' FIGHGL00 #1 and GENRGL01 #4, are House4 residences the bank sells as homes.

## BAD-CELL (1) - `src/world/interior/interiorLayout.js`

FOUND. FIGHGL00 #1's ground storey has a 3.2 m cell with no model under it (x 22.6-25.8, z 73.6-76.65 at its own door),
and the room above it stands. The missing cell is the pack's model 31000. DFU's IsBadInteriorModel drops EVERY 31000 of
60 listed block/records, keyed on the block and the record alone. In Daggerfall's own data each of the 60 holds one
31000, at the same record position (192, -192, 64) - the misplaced model the repair names. Beautiful Cities rebuilds
seven of those rooms with a 31000 of its own at (64, -63, 448), a ground-floor room cell: FIGHGL00 #1, GENRGL01 #2-4,
TVRNGL04 #6, RESIGL04 #3 and RESIGL03 #1. The repair took that cell out, and a player walking into the corner fell.
Where a pack keeps Daggerfall's record unchanged (CUSTAA02 #0, #2, #3), the misplaced 31000 is still there.

THE CALL (our departure from `DaggerfallInterior.IsBadInteriorModel`, Port-Ledger section A): the repair drops a 31000
only at the misplaced spot. Daggerfall's own rooms lose exactly what DFU's do; a pack's own 31000 stands. A world-data
patch adding the cell back was the first proposal, and was set aside: the pack's data is right, and the patch would
have fixed two rooms of seven.

## DOOR-VOID (2) - `src/world/interior/doorsToNowhere.js`, `src/world/actionSystem.js`

FOUND. Beautiful Cities' House2 design (DARKAB00, DARKAB01, DARKAB02, record 0) hangs `door:1` on a lip of floor half
a metre deep with nothing past it: a 60 m ray down finds nothing. Opened and walked through, it drops the player into
the void, and VOID-ENTRY's failsafe stands them back at the door. Daggerfall's own data has fifty more, every one in a
block no town places.

THE CALL (our departure from `DaggerfallInterior.AddActionDoors` and `DaggerfallActionDoor.Open`, Port-Ledger section A):

- **The room decides when it is built.** `sealDoorsToNowhere` reads the room's finished collider: a side has a floor
  when a ray down from a stride past the leaf (`DOOR_SIDE_STEP`, 1 m) meets one within `DOOR_FLOOR_REACH` (10 m,
  standsOnFloor's reach), so a stairwell or a cellar is a floor and only nothing is not. A door with a floor on one side
  and none on the other is sealed; a door with none on either side hangs in no room and is left alone.
- **Nothing opens a sealed door.** `_openDoor` refuses it before DFU's own order (so no lock, spell, bash, foe or action
  chain), `activate` answers it before an armed Open or Lock is spent, `attemptBash` never bursts it, and
  `restoreSaveData` keeps it shut whatever a save from before the seal or a peer says.
- **The player is told.** "This door will not open." on the mid-screen label, where a locked door's line is said
  (`player.sealedDoor`, drafted in every language).
- **A home's owner cannot take it out.** The room-door list (`systems/decor/decorInteriorDoors.js`) lets an owner take
  a swing door out of the room; a sealed one is not on it, and an owner's list saved before the seal takes nothing out.
  The room's doors are offered to the list once the seal has run.

THE FOUR HOSTS: both interior hosts build through `scenes/interiorContext.js` (worldModes' buildings and the standalone
interior scene), which seals and wires the line; the dungeon and the two exterior hosts build no interior door.

PINS. `fb1025_doorvoid.test.js` (10): the seal law over real colliders (one side, the other, both, none; a lip; a turned
leaf and a leaf thin in its own x; a cellar inside the reach and a pit past it), every way of opening a sealed door, the
room built through `buildInteriorContext` with its line said, a home's owner kept from taking a sealed door out, BAD-CELL's layout over a synthetic listed record, and two
over ARENA2 (the 60 classic records and the 7 pack ones; every residence and house for sale of both packs and
Daggerfall's blocks, the sealed list pinned door by door). `interior.test.js` (BAD-CELL's spot, axis by axis) and
`fb1007b_towerfloors.test.js` (its filter's new argument) moved, each marked. MUTANTS:
`tools/mutants/fb1025_doorvoid.json` (13, all dead).

NOT SEEN IN GAME. Checked on the real data through the real layout, collider and action system, not on a real install.
Not exercised: furniture an owner places themselves, an online home's visit flow, and the live game loop (stairs,
crouching, other players).
