# FIELD BUGS 2026-10-09 - seven Discord threads

Seven threads from the Discord's bug-reports, handed over by Mac as screenshots.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | snow in desert and swamp towns with snow turned off for them (Toomgis) | under investigation | open |
| 2 | casting again adds to the effect's timer instead of resetting it - Light at 613 (Doctor Bill) | DFU's own law: an incumbent effect's `AddState` stacks the new cast's rounds onto it (audit F12, `systems/effects.js`) | not a port bug - kept |
| 3 | the first open of overworld travel freezes, and frames fall the longer one travels (Shabalako) | under investigation | open |
| 4 | the game freezes opening chat, the wagon (EvoAva) | under investigation | open |
| 5 | Knightspire's tavern sign hangs on a residence (DarkScorpyon) | the game's own data: block TVRNAM00 record 0 is a tavern's model with a tavern's interior and sign, typed House2 in the block's building list, which is where DFU reads a building's type | not a port bug - kept (SIGN-HOUSE) |
| 6 | a torch cannot be placed before my own door, but can before a stranger's (Shiki_Eternal) | under investigation | open |
| 7 | `TypeError: Cannot read properties of undefined (reading 'velocity')` at `poseAhead`, on a ship's deck (Cruor) | a peer's word dropped a boat between two frames; the peek read the place it no longer names | fixed (PEEK-WORD) |

## STACK: a re-cast stacks its rounds (2)

Not a port bug. DFU's `IncumbentEffect.AddState` is "Stack my rounds onto incumbent" for Light and the other
incumbent effects, and the port carries it as audit F12 (`systems/effects.js` header: "re-casts of an incumbent STACK
rounds onto it"). Classic Daggerfall stacks too. Resetting instead would be a departure from DFU, which is Mac's call
(Port Doctrine); nothing changed.

## SIGN-HOUSE: a tavern's sign on a residence (5)

Not a port bug. No location is named Knightspire; the snowy candidates are Knightscester (Wrothgarian Mountains), and,
with Beautiful Villages worn, Knightswych and Knightswood. Read with the port's own readers over the freeware ARENA2:
block `TVRNAM00.RMB` record 0 is tavern model 249 with the tavern interior `DTAVR001.HS2` and tavern sign 43727 2.4 m
from its door - and its building list types it 18, House2, a residence. The block's real tavern is record 6, 54 m
off, with its own sign. `ARMRAM01.RMB` record 10 is the same (sign 43746). Beautiful Villages retypes TVRNAM00 record 0
as a tavern but leaves the same mismatch in its own `TVRNAS04` record 6, `TVRNAS06` record 5 (the block it rebuilt as
houses, `03-World/Beautiful-Towns.md`) and `TVRNAS07` record 8 - the author's bytes, checked by sha256. The port reads
a building's type from the block's list and a door's key from its record, as DFU does (`world/rmbLayout.js`,
`systems/talkTopics.js`), and stands a shop sign as an ordinary scene model tied to no building, as DFU does. Of
BLOCKS.BSA's 249 tavern signs, 244 hang at a tavern's door. Making that house a tavern would be a departure from DFU,
and would get no name: the town's MAPS.BSA list names one tavern per tavern record. Nothing changed.

## PEEK-WORD: a peer's boat that her word no longer names (7)

Cruor's error, on another player's ship: `Cannot read properties of undefined (reading 'velocity')` in `nextPose`, under
`poseAhead`. A word from a peer (`applyOwner`) replaces her boats at once and marks them dirty; the boats that stand are
matched to it only in the next `frame`'s `realign`. The world's online frame runs BEFORE the peers' frame and asks
`poseAhead` for the boat a passenger stands on (`scenes/world.js` `csaPoseAhead`), so on the frame a word arrived that
named fewer boats - a boat packed away, sunk, or sold - the stood list was longer than the word, `l.boats[i]` was
undefined, and `nextPose` threw outside the peers' own `try` (their frame's throw is that owner's loss alone, AUDIT
PRE-MERGE 0928 O1; the peek had no such guard). Uncaught, it was the red console over the deck.

`poseAhead` now reads the word's place first and answers null when the word names no boat there, or a boat of another
hull (a word that reordered her boats) - the host's own fallback, the boat's pose as it stands, carries the passenger
for that one frame, and the frame's realign matches the word as before (`scenes/comeSailAwayPeers.js`
`poseAhead`). `test/csa_together.test.js` (+1) drops a boat and changes a hull between frames and fails, with the
reported error, without the guard; `tools/mutants/csa_together.json` +2 (the missing place, the other hull), and the
`CSAK-peers-peek-late` record re-aimed at the guarded line.
