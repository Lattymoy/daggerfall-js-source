# FIELD BUGS 2026-10-30g - a shaft by a wall, the beast's pick, a start's commission, a worn Chameleon (WALL-SHAFT, WERE-PICK, START-INSTANCE, WORN-CONCEAL)

Four Discord #bug-reports threads, handed over in a session. Read on main's `a0c18be6a` with the freeware's data
(`tools/fetch-data.sh`). The pins are `test/combat/wallshaft.test.js`, `test/systems/disc10_lycan.test.js`,
`test/systems/quest/instances3_door.test.js`, `test/systems/starts/auditstarts.test.js` (START-INSTANCE) and
`test/systems/fb1030g_wornconceal.test.js`. The mutants are `tools/mutants/fb1030g_fieldbugs.json` and
`tools/mutants/disc10.json` (WERE-PICK). Written as page (e); main's ARMORY-MIRROR took it first, and TRIP-HOME (f).

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "Enemies standing very close to walls don't have a hitbox": arrows go through them | A wall within a step's whole reach took the shaft before the bodies on the step were tested | WALL-SHAFT |
| 2 | "werewolf transformation loot menu loots all items" | WERE-LOOT sent every press of the beast to the take-all loop | WERE-PICK |
| 3 | Summerset's start, "The Emperor's commission": the quest item is in none of its 3 places online | The door offered Public, a room laid smaller that stands no quest item | START-INSTANCE |
| 4 | A worn Mark's Chameleon goes after a rest or a journey | A landed blow ended it until the piece's 6-hour reroll | WORN-CONCEAL |

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

AUDIT FB1030g W1. Parked a radius short of a wall, the shaft's 0.45 m and a body's 0.45 m reached a foe pressed behind a
door: at 30 frames a second, 200 of 200 through a 0.15 m door at 30 degrees. A swept contact now needs no geometry
between the shaft and the foe's axis (`spellcast.js` sweepFrom, walledOff). The axis, not the hit surface: a foe walks
0.35 m off a wall, so its 0.45 m body pokes through a thin door. None go through now, straight on or at a slant, in
both flights. Not changed: the box a sea serpent or a dragon is struck by keeps the radius, so a grazing shot may still
meet one through a thin hull.

## 2. The beast's pick (WERE-PICK)

FOUND. WERE-LOOT (`05-Combat/Hand-Wraps.md`) let a transformed player loot with the pack window shut. Its press went to
the take-all loop for every key (`quickLoot.js` quickLootTake, `how === 'all' || beast`). Quick loot is on by default,
so the plaque still lit a row and the wheel still moved it, and the press took everything.

FIXED. With quick loot on, a beast's press takes one row, through the one-item take (`takeOneItem`): the row the plaque
has lit, else the plaque's first row. E and J take it, the wheel moves it, and P takes the lot. With quick loot off a
press takes the lot as before, and the quick-loot filter's leavings stay on the pile.

AUDIT FB1030g P1. A touch screen draws no plaque, and a search find, a vault before its rows arrive and a body that
lists verbs light no row. The first cut took the lot there, so a beast on a phone still took everything. Now it takes
the first row. Not changed: a lit map is read in the window, never taken, so a beast's press on one says the window
is shut.

NOT CHANGED. The pack window stays shut while shapechanged (DaggerfallInventoryWindow's GetSuppressInventory).

## 3. A start's commission (START-INSTANCE)

FOUND. A province start (`systems/starts/quests/_STARTSU.txt` for Summerset) places its commission at one of its lair's
item markers, chosen online on the dungeon whole (`questWorld.js` questSized). Online the Laboratory of Silinaire's
public room is laid small: 5 blocks, of which only the start block holds a marker. No quest item stands in a re-laid
room (`instancePlaces.js` questMountsHere), so it is in none of the 3 places there. Offline the dungeon is whole.

Every automatic way in reaches the whole dungeon: a load inside resumes through the quest's instance (AUDIT STARTS W3),
and a relay with no instances gives the whole room. The door did not: it offered Public, last since QUEST-FIRST.

FIXED. While a province start's commission is still in its dungeon and the public room is laid smaller, the door
offers no Public row, as Privateer's Hold's door offers none (HOLD-ONCE). With no party it enters my instance and says
why (`instanceDoor.js` INSTANCE_TEXT.questHere). A party member's room is still offered. A Recall anchored in the public
room goes in by the quest. A player already in the public room leaves and comes back in.

AUDIT FB1030g S1-S4. The first cut shut Public at every start; Black Marsh's and Valenwood's public rooms are laid whole
and stand the commission, so theirs is kept (`startPublicShut`). It entered with no word (S2), let a Recall into the
public room (S3), and pinned the unsigned map id with no signed case (S4). Not reproduced: the player may have been in
the instance, where no path loses the item.

## 4. A worn Mark's Chameleon (WORN-CONCEAL)

FOUND. A Mark of Skill with Cast When Held: Chameleon loses its Chameleon "after rest or travel", the Mark still worn.
A rest or a journey alone did not do it: 300 of them, on the real equip, magic rounds and reroll, kept it. The one way
found is a landed blow (`concealment.js` breakNormalPowerConcealment, DFU's ChameleonNormal law). It ended a worn
piece's Chameleon in place until the piece's 6-hour reroll (EntityEffectManager.RerollItemEffects), up to 30 real
minutes online. A fight on a rest or a journey lands one.

FIXED. Asked to choose, the session's answer was "Whatever is best". A blow still ends a worn Chameleon, Invisibility or
Shadow, so an attack shows the attacker. It stands again in place 2 magic rounds after the last blow (`enchantments.js`
WORN_CONCEAL_BACK_ROUNDS; each blow starts the count again in `concealment.js`), about 10 seconds online, with no
condition spent. A departure, Port-Ledger A (WORN-CONCEAL).

AUDIT FB1030g C1-C2. The first cut rerolled the whole piece two rounds after the first blow: a second power was rolled
again (a Strength of 41 to 50, fished for by a blow) and a busted Shield on it refilled (C1), and in a fight a worn
Invisibility stood every other round (C2). Now only the ended concealment stands up, the piece's 6-hour clock stands, and
a blow each round keeps it down.

OTHER WAYS IT GOES, unchanged. Online, flagged for PvP in the open zone or the open sea, worn concealment is taken until
the flag drops (PVP-RULES). A piece worn to 0 condition drops its power, and a repair does not bring it back until it is
worn again. Dispel Magic takes it, as in DFU.

The second report's Hircine's Ring quest (X0C00Y00) ran whole on the machine: the Wereboar placed, the kill making the
contact, the ring given. No defect found.
