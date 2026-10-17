# FIELD BUGS 2026-10-15d - threads from the bug-reports channel

Five Discord threads from 2026-10-14, handed over as screenshots, read on the code as it stands at main's `bd385fc6`,
and one question of Mac's own on the way. Each is traced on the real modules first; the fixes are pinned one to a tag,
and the decisions are Mac's (2026-10-15).

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "Wagon appears outside of buildings/dungeons when stabled" - "I keep sending my wagon away, but every time I enter a building or dungeon it appears outside again ... it wasn't happening a few days ago" (Fay) | HOLDINGS' Send away left the pair in the mod's WithPlayer state - the state of a wagon beside a player on foot - and the door parks every such wagon at the entrance (the mod's IL_98f0) | fixed (WAGON-STABLED) |
| 2 | "Repair Regression" - "worn items should always repair before backpack items. If you wear a Cast When Held ring or Item Deteriorates armor and pick up 20 damaged axes, bows, and shoes off dungeon mobs to sell in town, the game decides those 20 pieces of vendor trash are more important than the ring on your finger" (Unconquerable) | MEND-STARVE (`Field-Bugs-2026-10-14.md`, the day before) put a worn piece that wears itself behind every other damaged piece, the pack's included | changed (MEND-TIERS), Mac's call: worn first, the self-wearing piece next, the pack last |
| 3 | "Flying kick doesn't work" - "tried doing it mid-air, off ledges, flat ground aiming up aiming down etc nothing works, also when in werewolf form it simply says 'the beast knows no technique'"; the HUD: "You cannot leap from here." (very stinky) | TECH1 as designed: every leap and dash is refused off the ground, and the one line says it for eleven causes; on flat ground the kick launched on the real motor. The werewolf's line is TECH1's own | changed (KICK-AIR), Mac's call: the kick goes from the air |
| 4 | "Right Arm armor disappearing" - "The armor for my right arm has disappeared between logging in and logging out, but the rest of my gear is saved fine" (Thatweirdphoenix) | not reproduced: slot 13 (RightArm) came back from every save and load tried, offline and online; DFU's own law (every shield covers the left arm, none the right) breaks a shield-bearer's right pauldron first, and a broken piece comes off | asked of the player |
| 5 | "I think the issue can be tied to the fact I reforged lines and honed them in the mages guild ... I sold one blade, which was unmodded" (Boar; the thread's title not handed over) | not decided: the thread's own complaint is not in the screenshot | asked of the player |
| 6 | "If parked outside of the pvp zone in the wrothgarian mountains, can it be lost?" (Mac) | the wagon and the horse never: a vehicle is kept. But a death in the zone dropped the cart's cargo and half its gold wherever the wagon stood | changed (CART-AWAY), Mac's call: "if its parked outside the zone nothing should be lost" |

## WAGON-STABLED: a pair sent away stays at the stable (1)

`src/systems/horse/horseCart.js` sendTransportAway, handlePreTransition, leaveStable; `src/systems/horse/horseCartLaw.js`
newSaveData; `src/ui/holdingsPages.js` stableWords; `src/systems/upkeep/upkeepRuntime.js` horseWhereOf.

THE REPORT. "I keep sending my wagon away, but every time I enter a building or dungeon it appears outside again ... it
wasn't happening a few days ago."

FOUND. Send away (HOLDINGS, 10155e299a, 2026-10-03) reset the pair to the mod's WithPlayer - the same record as a wagon
beside a player on foot - and HandlePreTransition [IL_98f0] parks every such wagon at a door and leaves every such
horse waiting there; mounting the horse laid the stabled wagon behind as well. Reproduced at a building's door and a
dungeon's. No commit in the reported days moved it: STEED-UI (2026-10-11) put a Stable button on the saddle panel, and
Send away became an everyday act.

FIXED. Two save words of the port's own (`WagonStabled`, `HorseStabled`), set by Send away and let go by a summon, a
park, a mount, or a record laid afresh. A stabled pair is parked at no door, left behind by no mount and taken on no
journey; a pair driven or ridden through a door parks the mod's way, and WithPlayer never sent keeps every mod law. An
old save loads not stabled. The Stable's card says Stabled only for a pair sent away and With you otherwise (the next
door leaves it outside), and horse care's keep follows the card: a horse never sent is with its owner. THE FOUR HOSTS:
worldModes.js runs every interior and dungeon entry through handlePreTransition; world.js and exterior.js reach it
through createWorldModes; dungeonContext.js has no door from outdoors, and its save seams carry the words. Pinned by
`test/systems/horse/fb1015_wagonstabled.test.js` (`tools/mutants/fb1015_wagonstabled.json`, 27, dead); PINS MOVED: hcc_law (the
record's field count, 15 to 17), holdings (the Stable's view and words), steed1_horsecare (the keep's view), wagons2
(the journey's source).

## MEND-TIERS: worn first, the piece that wears itself next, the pack last (2)

`src/systems/enchantments.js` repairsObjectsTarget, mendTier.

THE REPORT. "Repair Regression": a worn Cast When Held ring or Item Deteriorates armour, and twenty damaged axes, bows
and shoes picked up to sell - the loot was mended and the ring was not.

FOUND. MEND-STARVE (`Field-Bugs-2026-10-14.md`, 705af64180, the day before) ranked a worn piece that wears itself on the
tick's own round (Cast When Held, CastWhenHeld.cs:27; Item Deteriorates, ItemDeteriorates.cs:29) after every damaged
piece, the pack's included. Such a piece wears a point a tick, so the loot took every tick and the ring lost a point a
tick: a 40% ring beside twenty pieces of loot, 400 rounds through the payloads, lost 100 while the loot mended.
MEND-STARVE's own fault stands - first in the order, the piece took +1 and -1 forever and no other worn piece was
mended.

FIXED. Mac's three tiers (`mendTier`): what is worn, then a worn piece that wears itself, then the pack, with MEND-WORN's
mendOrder inside each. Arbeck's other worn gear is still mended first. The accepted trade-off: while such a piece is
below its condition the tick holds it and the pack waits - Cast When Held wears on every tick's round out of rest, so
while one is worn and damaged nothing carried is mended, and two such pieces share the tick (the more worn is held).
The repair kit (`smithItems.js` repairKitTargets) was already worn-first and is unchanged. Pinned by
`test/systems/fb1015_mendtiers.test.js` (`tools/mutants/fb1015_mendtiers.json`, 5: 4 dead, 1 equivalent as recorded); PIN MOVED
in `test/systems/fb1014_mendstarve.test.js` (the boots wait); re-aimed by content: MEND-STARVE-the-self-wearing-piece-first-again
and MEND-WORN-pack-order (dead).

## KICK-AIR: the Flying Kick goes from the air (3)

`src/combat/technique/techniqueRoster.js` kick (`airborne`); `src/combat/techniques.js` refusal; `src/player/motor.js`
techniqueLaunch.

THE REPORT. "Flying kick doesn't work": "tried doing it mid-air, off ledges, flat ground aiming up aiming down etc nothing
works", the HUD saying "You cannot leap from here."; as a werewolf, "the beast knows no technique".

FOUND. TECH1's design (`05-Combat/Weapon-Techniques.md`): one gate refused every leap and dash off the ground, on the
press and again on the release - a jump, a fall, a ledge, or a press let go after takeoff - and the one line said it for
eleven causes. On flat ground the kick launched on the real motor through the whole press, hold and release. The
werewolf's line is TECH1's own and stays.

CHANGED (Mac's call). The roster marks the kick `airborne` and the gate reads the mark; every other leap and dash stays
grounded, and every other refusal - a climb, a wall, a vault, the water, a levitation, a slow fall, the saddle, a
knockdown - is the kick's too. From the air it is the same kick, aimed from the airborne feet. A flight launched
mid-fall keeps that fall's start: the launch had re-anchored it, so a kick near the ground would have cancelled a
12 m fall's damage. THE FOUR HOSTS: none changed - exterior.js, world.js and worldModes.js each hand the one
PlayerMotor to the runner, and dungeonContext.js reads worldModes' (or `dungeon.js`'s) through its technique door.
Pinned by `test/systems/fb1015_kickair.test.js` (`tools/mutants/fb1015_kickair.json`, 9, dead).

## CART-AWAY: a wagon away from a death in the zone keeps its cargo (6)

`src/systems/wild/wildDropLaw.js` takeWildDeath, wildDropCandidates, takeWildGold (`cart`), wildCartMayBeAway;
`src/systems/wild/wildCart.js`; `server-account/src/wild.js` wildFall; `src/scenes/world.js` wildTakeDrop.

THE ASK. Mac, asked "If parked outside of the pvp zone in the wrothgarian mountains, can it be lost?": "Yeah, if its
parked outside the zone nothing should be lost."

FOUND. The wagon and its horse are never lost - a vehicle is on the zone's kept list, and no wagon breaks nor horse dies
(UPKEEP-ONLINE). But the account service's take (INT9, `/v1/wild/fall`) dropped every cart piece and half its gold
wherever the wagon stood: it read `wagonItems` and never the Horse Cart and Cargo record beside them.

CHANGED (Mac's call). The cart's share only while the wagon is with the fallen: driven, beside them unstabled,
following, or parked on a pixel of the zone. Parked anywhere else (the band is not the zone), stabled or none, every
piece and its gold stay. The fallen's tab says so (`cart` 0, from its wagon record and wildMaskOf); the service, which
holds no map files, honours it only where the stored record's mode agrees. A seizure honours no word; an old tab says
none; a repeat ask answers the first take. THE LIMIT: the wagon record is the client's own (Wild-Zone.md section 22).
THE FOUR HOSTS: world.js WIRED (one existing line); dungeonContext.js and worldModes.js reach it through world.js;
exterior.js NOT WIRED (online only). No migration; the account service's version moves (acct138). Pinned by
`test/systems/fb1015_cartaway.test.js` (`tools/mutants/fb1015_cartaway.json`, 20, dead); PINS MOVED: int9_wild_ref,
fb1014_pvpescrow; re-aimed: INT9-AUDIT-SVC-THE-FITTED-FEW-ASKED, ESCROW-the-escrow-asked-of-any-room.

## The right arm: asked of the player (4)

THE REPORT. Twice, the right arm's armour gone between a login and a logout, the rest of the gear kept.

FOUND. Nothing on the save's path drops it. Slot 13 is DFU's RightArm in every table that names it (`paperdoll.js`
EQUIP_SLOTS, `equipRules.js` SLOT_RULES' 106, Roleplay & Realism Items' 518 and 526), and a save and load through
`save.js` snapshotPlayer, restorePlayer and `equip.js` fillEquipTable brought it back every time - classic steel and the
mod's sets, cloaks in the slots either side, offline and as an online page. The realm stores the save as it is sent;
the judge freezes trade and never edits a save. What does take it off is DFU's own wear: a blow lands on each arm three
times in twenty (`formulas.js` STRUCK_BODY_PARTS), every shield covers the left arm and none the right
(`armorMaterials.js`), and a pauldron holds 2,048 points against a cuirass's 4,096 - so for a player with a shield the
right pauldron is the first piece to break (200 runs of 200 through the real damageEquipment), and a broken piece
comes off (`equip.js` lowerCondition) and stays in the pack at 0%.

ASKED. Whether the player carries a shield, and whether a broken right pauldron sits in the pack.

## The reforged blades: asked of the player (5)

THE REPORT. Two posts from Boar's thread, its title not handed over: the three Masterworks reforged and honed at the
Mages Guild, and one blade, unmodded, sold.

FOUND. On the market, a Masterwork its maker reforged or honed has no route: the crafted-piece and auction lists keep
only a piece as its making minted it (`smithItems.js` asMinted), and the pack's route refuses the maker's own piece
(`server-account/src/market.js` market-piece-route) - so an unmodded blade lists and the modded ones show nowhere. The
shop's sale, the item law, the loot check and the ids were ruled out: a reforge and a hone change the piece in place,
and every sale removes the one item handed to it. Whether that dead end is the thread's complaint is not in the
screenshot.

ASKED. What went wrong - the thread's title and what was tried - before anything changes.
