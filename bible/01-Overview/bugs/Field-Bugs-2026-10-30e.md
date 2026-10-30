# FIELD BUGS 2026-10-30e - a shaft at a foe by a wall, the beast's pick, a start's commission (WALL-SHAFT, WERE-PICK, START-INSTANCE)

Four Discord #bug-reports threads, handed over in a session. Read on main's `a0c18be6a` with the freeware's data
(`tools/fetch-data.sh`). The pins are `test/combat/wallshaft.test.js`, `test/systems/disc10_lycan.test.js`,
`test/systems/quest/instances3_door.test.js` and `test/systems/starts/auditstarts.test.js` (START-INSTANCE). The mutants
are `tools/mutants/fb1030e_fieldbugs.json` and `tools/mutants/disc10.json` (WERE-PICK).

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "Enemies standing very close to walls don't have a hitbox": arrows go through them | A wall within a step's whole reach took the shaft before the bodies on the step were tested | WALL-SHAFT |
| 2 | "werewolf transformation loot menu loots all items" | WERE-LOOT sent every press of the beast to the take-all loop | WERE-PICK |
| 3 | Summerset's start, "The Emperor's commission": the quest item is in none of its 3 places online | The door offered Public, a room laid smaller that stands no quest item | START-INSTANCE |
| 4 | A worn Mark's Chameleon goes after a rest or a journey | Not found. A landed blow ends it until the 6-hour reroll | open |

## 1. A shaft at a foe by a wall (WALL-SHAFT)

FOUND. Every flight of a player's shaft asks the walls first: a wall within the step's reach plus the shaft's radius
retires it there (`cover.js` coverStep, `hostMagic.js` flightStop). The bodies are tested after the step is flown. So
when one step reached both a foe and the wall behind it, the wall took the shaft. DaggerfallMissile.cs:337 casts one
ray, and its first hit is the nearer collider, body or wall.

MEASURED. A foe whose body touches a wall, shot dead centre down a straight flight: 20% of shafts passed through at
30 frames a second and 45% at 20. In the street's flight (`ArrowFlight`) at 15 frames a second, 37 of 60.

FIXED. A player's shaft is tested along its whole step (SHAFT-SWEEP), so it now meets a wall by touch as it meets
cover (AUDIT TACT B5). Short of the touch it flies only to it, and the bodies are tested first. It stops on the wall a
step later at most, at the same point. The dungeon's flight passes `!!m.fromPlayer` to flightStop and `ArrowFlight`
passes it to coverStep. Every shaft in the probe lands at 15, 20 and 30 frames a second.

NOT CHANGED. A foe's shaft and a spell still meet a wall at the step's whole reach: they are tested where the step
ends, not along it.

## 2. The beast's pick (WERE-PICK)

FOUND. WERE-LOOT (`05-Combat/Hand-Wraps.md`) let a transformed player loot with the pack window shut. Its press went to
the take-all loop for every key (`quickLoot.js` quickLootTake, `how === 'all' || beast`). Quick loot is on by default,
so the plaque still lit a row and the wheel still moved it, and the press took everything.

FIXED. A beast's press takes the row the plaque has lit, through the one-item take (`takeOneItem`). E and J take the lit
row, the wheel moves it, and P takes the lot. With quick loot off no row is lit, so a press takes the lot as before.

NOT CHANGED. The pack window stays shut while shapechanged (DaggerfallInventoryWindow's GetSuppressInventory).

## 3. A start's commission (START-INSTANCE)

FOUND. A province start (`systems/starts/quests/_STARTSU.txt` for Summerset) places its commission at one of its lair's
item markers, chosen online on the dungeon whole (`questWorld.js` questSized). Online the Laboratory of Silinaire's
public room is laid small: 5 blocks, of which only the start block holds a marker. No quest item stands in a re-laid
room (`instancePlaces.js` questMountsHere), so it is in none of the 3 places there. Offline the dungeon is whole.

Every automatic way in reaches the whole dungeon: a load inside resumes through the quest's instance (AUDIT STARTS W3),
and a relay with no instances gives the whole room. The door did not: it offered Public, last since QUEST-FIRST.

FIXED. While a province start's commission is still in its dungeon, the door offers no Public row, as Privateer's
Hold's door offers none (HOLD-ONCE). With no party the door enters my instance with no popup. A party member's room is
still offered. A player already in the public room leaves and comes back in.

## 4. A worn Mark's Chameleon (open)

A Mark of Skill with Cast When Held: Chameleon loses its Chameleon "after rest or travel", the Mark still worn. Not
reproduced: 300 rests and journeys of the real equip, magic rounds and reroll kept it. The one way found is a landed
blow (`concealment.js` breakNormalPowerConcealment, DFU's ChameleonNormal law). It ends a worn piece's Chameleon in
place until the item's 6-hour reroll (`enchantments.js` enchantmentMagicRound), and a fight on a rest or a journey can
land one. A Mark worn to 0 condition also drops it. Left for the owner's call.
