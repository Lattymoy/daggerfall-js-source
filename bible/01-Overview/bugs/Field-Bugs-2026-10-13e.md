# FIELD BUGS 2026-10-13e - ten threads from the bug-reports channel

(Named 2026-10-13c until main's #876 took that name for PORT-TOWNS (`01-Overview/bugs/Field-Bugs-2026-10-13c.md`), then
2026-10-13d until main's #874 took that one for REMAINS (`01-Overview/bugs/Field-Bugs-2026-10-13d.md`); its pages, pins and
records renamed with it each time, as FIELD BUGS 2026-10-13b was.)

Ten Discord threads from 2026-10-12 and 2026-10-13, handed over as screenshots, read on the code as it stands at main's
`3f66ff06`. Each was traced on the real modules first, most with a reproduction; the fixes are built and pinned one to a
tag. Where the fix departs from Daggerfall Unity it rides the owner's standing word on such departures - "I dont care
about DFU. We're our own thing now." (FIELD BUGS 2026-09-30b) and "I dont care about DFU parity wtf" (2026-10-11b) - and
is a Ledger A row.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "New affixes on crafted items" - "Added potency and cast speed, cast cost affixes are not rolling on crafted jewelry" (Boar) | the crafting mint takes the loot ladder's rarity roll and never its last pass, the one door the proc lines (focus, cast speed, potency, wellspring) come through | fixed (CRAFT-PROCS) |
| 2 | "Cant turn in writs" - "Have the materials literally on hand. They don't accept them" (Uncon...) | law 3: a writ spends only what the service counted (gathered, or bought with silver); looted, shop-bought, traded and gold-bought Iron is held and never counted - and the card said "0 held" and "Not enough" with 100 in the pack | fixed (WRIT-WALL); the law kept |
| 3 | "Shared Guild quest doesn't give me map location after friend talked to the quest npc" (Starempire42) | a `reveal` marks the clicker's own map, and a shared quest's copy carried it complete without running it | fixed (SHARE-REVEAL) |
| 4 | "The current situation where doors lock at shops and inns in Daggerfall Capital" - "Once you get stuck, there's no way out" (Nes) | one player's Lock spell, at the caster's level, reached every visitor through the building's act and its thirty-day memory | fixed (SPELL-LOCK) |
| 5 | "Some locations have floating houses" - "Temple of Kynareth has floating houses due to terrain modifications" (SylviaBun) | the pack hills' stand-ins seat a plateau's houses at their origin and fall away under their edges | fixed (HILL-SEAT) |
| 6 | "Cant complete quest 'the lost child'" - "accidentally said 'no' ... now i cant interact with it at all" (Ant1-Chr1st) | DFU's own soft-lock: K0C00Y05's No leads nowhere and its clicked-npc task never listens again | fixed (NO-ASKS-AGAIN), a departure |
| 7 | "Performance issues with boss AoE attacks circles and player sprites" (HellRay) | his mark and his host's paths laid their quads 4 m past the ground they draw: an AoE frame shaded 3.4 screens of telegraph fragments; the crowd's cost is the bodies it draws | the telegraphs' overdraw cut (AOE-PERF); the crowd measured, nothing drawn for nothing |
| 8 | "Molag bal mace do nothing" - "It's effect is not working and it's extremely fragile" (Boar) | the strength arm raises a stat the port caps at 100 - DFU raises the cap with it | fixed (MACE-MAX) |
| 9 | "Tavern in Issaqumbaa marked as a player house" (SylviaBun) | the door's plaque named the first building box holding the ray's point - a neighbour house's - while the click entered the tavern | fixed (DOOR-NAME) |
| 10 | "Delayed death after combat despite full health" (sxxlxxr, Knightshead) | DFU's exhaustion collapse: fatigue spent with a foe in the spawn band is death whatever the health, and the box saying so was replaced by the death screen before it drew | fixed (SPENT-ASHORE), a departure |

## SPELL-LOCK: a Lock spell's lock is its caster's, and no peer's word locks a door past its own data (4)

`src/world/actionSystem.js` lockCeiling, lockLands, restoreSaveData's `remote` and `level`, applyRemote;
`src/world/interior/interiorShared.js` applyInteriorShared; `src/scenes/dungeonContext.js` applyWorld; `src/scenes/worldModes.js`
the building's cached copy.

FOUND. Nothing in the port locks a building's inner door: interiorContext adds its doors with no starting lock, as
DaggerfallInterior.AddActionDoors sets none, and no closing-hour or night law touches an interior door. A lock of 40 or
41 has one source - the Lock spell, which locks at its CASTER'S level (`mysticism.js` triggerLock, Lock.cs:116); a
building's own lock tops out near quality/2 and the dungeon table has no 40 or 41. Online a building's doors are shared
(WORLD3's act, WORLD6a's room memory, kept by the relay for WORLD_TTL_MS, thirty days), and the record carries the lock:
one player's Lock reached every visitor, and every visitor who walked in for a month restored it. At 20 and over a lock
is magically held (MAGIC_LOCK_THRESHOLD: no pick, no bash) and Open yields only at the caster's level or above
(Open.cs:117), so a level-21 player behind a level-41 lock had no way through - and the Lock swings an open door shut,
so a player in an inn's room, or a shop's back room, was shut in. The screenshots' players stand at level 21 and 19.
Daggerfall has one player, who can always Open what they locked. Reproduced through the real ActionSystem and the real
building memory: a level-41 Lock on A's copy landed 41 on B's by the act and on C's by the memory, and B's pick, five
best-roll bashes and a level-8 Open left it at 41. `actionSystem.js`'s ACTION_LOCK_MAX said "DFU's own values run
0..20" - RDBLayout's LOCK_VALUES run to 255 (the sentence is mended).

FIXED:

- A PEER LOCKS NO DOOR PAST ITS OWN DATA. `lockCeiling(o)`: the door's starting lock, or LockDoor's 16 where the door's
  own action can lock it. A peer's word - an act (applyRemote), a building's memory (applyInteriorShared), a dungeon's
  (applyWorld's `wire`) - lands a lock only up to it: a pick, a bash, an Open and a re-lock to the door's own value are
  shared as WORLD3 shares them; a Lock spell's lock stays its caster's, and the door keeps the lock it has. The swing
  still lands (the door shuts for everyone; a press opens it). A placed door not hung yet keeps a peer's swing and no
  lock (HOME-DOORS' early records). A memory already on the relay is read the same way, so the thirty days poisoned
  before this lands nothing.
- THE TRAPPED PLAYER'S OWN COPY IS MENDED. A building's cached copy and a dungeon's save took the peer's lock before
  this: their restore drops a lock past both the door's ceiling and the player's level - no Lock of theirs could have
  cast it (a level never drops). Their own Lock, at or under their level, stays theirs.

`test/world/fb1013e_spelllock.test.js` (4); `tools/mutants/fb1013e_spelllock.json` (14, all dead).

## DOOR-NAME: a door's plaque names its own building (9)

`src/scenes/worldModes.js` doorBuilding, exteriorHoverName's building arm.

FOUND. "To Residence ... Buy it" is HOME-PLAQUE's word for a building with no name that passes `homeCandidate` (House1-6
or HouseForSale): the plaque had resolved a HOUSE for the tavern's door. It resolved it by the ray's point -
`buildingUnderRay`, the first StaticBuilding box of every loaded block's that held it - while the click enters, prices
and buys the door's own record (`activateStaticDoor`'s `buildingDataForDoor(hit)`). A box is the axis-aligned box of a
rotated building (DaggerfallStaticBuildings.cs:73-86), wider than its walls, and World Tooltips box-tests only the HIT
block's buildings (GetBuildings(hit.transform), Modded_HUDTooltipWindow.cs:701-702); the port tested every block's. So a neighbour
house's box over the tavern's doorstep named the tavern's door, while the click walked into the tavern - and the town's
map, drawn off the blocks' own bytes, showed a tavern. Reproduced through the real mode machine on a tavern beside a
turned House3: the plaque named the house and discovered it.

FIXED. A door's plaque names the building the door belongs to - its own record, the one its click enters (`doorBuilding`,
the same `buildingDataForDoor` on the same entry) - and the mod's discovery maps that building. A departure from the
mod's box test (Ledger A). The press keeps the box for ActivateBuilding's discovery, as DFU's does.

NOT SEEN. Issaqumbaa's own blocks (no ARENA2 here): which house's box covers the tavern's step. Asked of the reporter:
whether "Buy it" walks into the tavern - if it does, this was it.

`test/systems/fb1013e_doorname.test.js` (1); `tools/mutants/fb1013e_doorname.json` (2, both dead).

## SHARE-REVEAL: a shared quest's `reveal` marks the receiver's map too (3)

`src/systems/quest/machine.js` REPLAYABLE_ONE_TIME_ACTIONS.

FOUND. The quest reads as the Mages Guild's N0B00Y17 ("Azimuthal Vectors"): `_S.05_ clicked npc _scholar_`, and `_S.12_`
runs `reveal _itemdung_` with the log entry that names the dungeon. RevealLocation writes the CLICKER'S map
(PlayerGPS.DiscoverLocation, RevealLocation.cs:59) - a player's own discovery, not quest state. A shared quest travels as
its save state and restores every action as it stands; QUEST1 re-arms on the receiver the one-time actions whose effect
lands in the holder's own world, and `reveal` was not among them. So the friend's map had The Nest of Aneloth and the
reporter's journal said "Not on your map yet". Nobody could tell them: a quest's people take the click
(QuestResourceBehaviour, PlayerActivate.cs:1525-1528) and its `clicked npc` fires once, as in DFU, and DFU's "Where is"
names only the current town's quest buildings. Reproduced on the real quest through the real share.

FIXED. RevealLocation joins the re-armed set: it is self-contained (this quest's own Place, the holder's own map, and
discoverLocation is idempotent). A fresh receive marks every place the partner's copy has revealed, and a resync marks
each new one, once. A `readmap` reveal files its note once on the receiver.

FOR THE REPORTER, NOW: a copy that took the reveal complete before this keeps it complete; Settings, Repair active
quests (QREPAIR) files every reveal that has run again, and marks the dungeon.

`test/systems/quest/fb1013e_sharereveal.test.js` (2); `tools/mutants/fb1013e_sharereveal.json` (1, dead); `disc28.json`'s
DISC28-I-getitem-not-replayed re-aimed by content (the set's text grew), dead.

## HILL-SEAT: a hill holds what the author stood on it (5)

`world/townStandIns.js` (blockHillPatch, HILL_SEAT_TOLERANCE, HILL_PATCH_SINK; blockHillSeat's `lay` and its 2 m cell
index; the hill's UV rule shared with hillMesh), `scenes/world.js`, `scenes/exterior.js`.

FOUND. No terrain layer moves the ground under a location's buildings: blendLocationTerrain levels the rect and the
buildings stand at the same height (measured 0.000 m on synthetic temple pixels, coastal and inland, Landforms on and
off, with roads, rivers and the water bed). The grass in the screenshot is a HILL: Beautiful Villages stands its Kynareth
temples as 1x1 blocks, and TEMPASH3 (Ipsham's, about a fifth of them) stands houses 127, 129 and 201 and temple 402 on
the RMB Resource Pack's hill 52758, its plateau 4.13-4.22 m up. HILL-SHAPES (FIELD BUGS 2026-10-05) draws each pack hill
as a stand-in - each cell the median of the pack's surface - and seated these houses at their ORIGIN; the median falls
away toward the plateau's edge: 0.23-0.33 m under a house 5 m out, 0.74-1.24 m 7 m out, up to 2.23 m under a 14 m
house's corners - the lit gap under the screenshot's wall. `fb1005_hills` sampled only the middle half of a footprint.
In DFU with the pack, the author's own mesh holds the plateau.

FIXED. A model whose lowest vertex stands over the block's plane (by 0.5 m), over a drawn hill, within a metre of its
top (so not one the author hung there), and that hangs more than 0.05 m anywhere over the hull of its own drawn
vertices, gets a pad: a flat top 0.05 m under its base over its whole footprint and 0.25 m past it, then a 45-degree
bank down until it is 0.25 m under the hill or the plane, wearing the hill's picture in the hill's frame, every face up.
Read exactly: the footprint's corners, the hill's vertices inside it and every crossing of a hill edge with the
footprint's edge, and a 1 m grid. No model moves and nothing rises over a base. The pads are laid into the block's seat,
so TREES-SEATED's trees stand on them. Every point of the four TEMPASH3 footprints is within 0.05 m now (0.15 m is the
law, HILL-SHAPES' bar for the origin taken to the whole footprint); the four pads come to 837 triangles.

NOT SEEN, with no GPU here: whether a bank buries a quest marker; how the seam between bank and hill looks, at distance
and under the climates' textures and the shadows; walking the bank; a real pixel's build cost (15-40 ms a block here, on
a loaded machine). The real meshes, the gated sweep and what a bank buries were measured with ARENA2 by FIELD BUGS
2026-10-15f TEMPLE-STEPS: the banks buried no door, but they buried Merdale's temple flight (by up to 1.25 m) and
TEMPASF1's and TEMPASH4's stairs - a pad buries nothing the author left in the open now.

`test/world/fb1013e_hillseat.test.js` (8, one on ARENA2_PATH); `tools/mutants/fb1013e_hillseat.json` (18, all dead). No pin
moved.

## WRIT-WALL: a writ's card names what it will not take (2)

`src/net/profBook.js` walled; `src/ui/noticeWindow.js` writNode; `src/ui/workTab.js` writWalledText, the guild writ's
card; `src/net/accountClient.js` (`stores-gold`).

FOUND. The item and the count are right: an Alchemist's Iron is `metal:iron` (DFU's MetalIngredients #71, 0.5 kg - the
screenshot's 100 weigh 50), and heldOf reads 100 across the pack, the bag and the wagon. A writ spends only what law 3
and GOLD-MARKET's wall allow (`06-Systems/Materials-Bag.md` section 5): the Stores' own and bought units, and the units
the service handed out and still counts as carried - never gold's (the service's spendableSql). So looted, shop-bought,
traded or gold-bought Iron reads 0, in the bag, in the Stores or withdrawn: a unit keeps its origin. That is the law,
and it is kept. THE DEFECT WAS THE CARD: "0 held" with Take shut, and its only word a hover - "Not enough - your Stores,
Materials Bag and pack together" - false beside a pack of 100, and no hover at all on a phone. UNCOUNTED (FIELD BUGS
2026-10-09c) had ended this silence on the Stores page alone. The guild writ's card said "You have none", and the gold
refusal told the reader to withdraw what never fills a writ out of the Stores either. Reproduced over the real Worker:
Iron off an Alchemist's shelf, and Iron bought with gold, each read "0 held" with nothing said.

FIXED. The book reads `held`'s other side: `walled` - the Stores' gold and loose units, and every unit carried past what
`held` counts (held + walled is every unit held). Where walled units are why a writ cannot be filled, the card says so
under Take and on Take's title - "100 Iron you hold cannot fill a writ: only what you gathered, or bought with silver,
counts - not what was looted, bought at a shop or with gold, or given by another player." - and the guild writ's card
says the same, never "You have none" beside it. The gold refusal: "What you bought with gold is not used there, in your
Stores or out of them: it goes to your pack or back on the market for gold." Through `t()`, drafted in the thirteen whole
languages.

FOR THE OWNER. Counting looted, shop-bought or traded units toward a writ changes law 3 (and would let shop gold become
writ silver): not done, the owner's call, as FIELD BUGS 2026-10-09f left it.

NOT SEEN. Where the reporter's Iron came from; the card names it whichever way it came.

`test/systems/professions/fb1013e_writwall.test.js` (3); `tools/mutants/fb1013e_writwall.json` (13, all dead). No pin moved.

## MACE-MAX: the Mace lifts its wielder past what they hold rested (8)

`src/systems/statMods.js` liveStat; `src/systems/artifactEffects.js` the Mace's strikes, magicRound, unequipped;
`src/systems/enchantments.js` (type 26's unequipped); `src/systems/save/save.js` copyEffectEntry.

FOUND. The Mace is minted right (createArtifact = DFU's SetArtifact: Daedric, 1500 uses, enchantment [26, 2]) and its
Strikes payload fires in every host (each host's player blow reaches calculateAttackDamage, whose tail runs it); "Spells:
none" is DFU's own RSC 8702. Nearly every foe has no magicka, so nearly every landed blow takes the STRENGTH arm - and DFU
raises the live effect's stat MAX mod beside its mod (MaceOfMolagBalEffect.cs:138-139: "Using the Mace of Molag Bal can
actually give its bearer ... more strength than he would have fully rested"), and GetLiveStatValue clamps at
MaxStatValue plus the merged max mods (DaggerfallStats.cs:155-161). The port clamped at a flat 100 with no max-mod layer
- its header RECORDED it - so a wielder at 100 Strength gained nothing on any blow: the effect did nothing. Beside it,
the magicka overflow moved the max only at the next round, so a second strike in the same round counted the first's
overflow again (two 10-point drains on a full pool raised it 30, not DFU's 20), and the bonus outlived taking the Mace
off: its decay runs only in a worn item's rounds, which with the max lifted would have been strength past 100 for good.

FIXED. DaggerfallStats' max mods: any live effect entry may carry `statMaxMods`, and liveStat's ceiling is
MAX_STAT_VALUE plus every live entry's (MergeStatMaxMods; an ended entry's are not live). The Mace raises max mod and
mod together and its decay clears both; the max mods are saved with the effect (effectData.statMaxMods). The overflow
raises the live max at once (ChangeMaxMagickaModifier, :117-123). Taking the Mace off removes its live effect
(UnequipHeldItem's Held-bundle sweep), through the type-26 row's new `unequipped` hook. The recorded departure's sentence
is deleted. DFU's only writer of StatMaxMods is this effect.

FRAGILITY - DFU'S, NOT CHANGED. Measured over 400 kills a row through the real formula (a level-10 wielder, Blunt
Weapon 60): the loss per kill equals DFU's bill rebuilt from the same blows - wear, plus the blow's damage whenever the
target fails its save (MaceOfMolagBalEffect.cs:147-151), about 85-90% of it. 20-57 uses a kill (a Spider 20, an Orc 46,
an Orc Sergeant 56): 26-74 kills from 1500 uses, and a broken enchanted piece is gone (smiths repair no magic, DFU's
default). A mundane Daedric mace holds 6,400 in DFU and 12,800 here (WEAPON-POOL), which makes the gap read wider. One
port-only weight rides the bill: the payload sees the landed damage after the target's own multipliers (a stagger's
x1.25, an overreach's x1.3, a revenant's), as the drain does - the owner's call.

NOT SEEN. Whether the reporter stood at 100 Strength. The inspect card shows 100 while the bonus lasts: its bound is the
relay's (`CARD_STAT_MAX`, a relay deploy to move).

`test/systems/fb1013e_macemax.test.js` (4); `tools/mutants/fb1013e_macemax.json` (8, all dead). No pin moved.

## CRAFT-PROCS: a crafted piece never rolled a line that does something (1)

`src/systems/smithItems.js` mintPiece, mintPieces, temperItem; `src/systems/loot/lootRarity.js` lastPass (its `on`);
`src/net/productRecord.js` (`v`, MINT_VERSION, mintVersionOf); `server-account/src/professions.js` (the craft's stamp,
the temper's re-sign), `server-account/src/market.js` (pieceOf's `version`).

FOUND. Every line that does something - LOOT4's proc kinds: a jewel's focus (the report's "cast cost"), cast speed,
potency (BAL9c) and wellspring; a weapon's elemental, leech, slayer, cast speed and potency; armour's thorns - is drawn
only in a loot door's LAST PASS (lootRarity.js lastPass -> rollProcLine); the ladder's own draw leaves them out. Every
loot door takes the pass (the gate's spoils, a foe's cap, a host's combat, a raid's). The craft's mint rolled its
quality's Magic or Rare with applyRarity and never took it, so no crafted piece could carry one: for a jewel, exactly the
four lines reported. No page excluded crafts on purpose - Professions-Arc's Masterwork takes "one Loot Rarity Rare
roll", and AUDIT LOOT's "a Masterwork's roll never reach it" (Loot-Arc.md) predates cast speed and BAL9c and is about
the seeded doors' order. Reproduced on the real mint: 2,000 Superior and 2,000 Masterwork jewels, no line.

FIXED. The craft's mint takes the pass after its roll, on the record's own seeded stream: a Superior's chance at one line
is a loot door's Magic's (483 of 2,400 jewels), a Masterwork's a Rare's (849 of 2,400), every kind seen; nothing else on
the piece moves but its worth, by the line's. The Loot Rarity switch is not asked at the mint (the piece is its record's
on every client; the line's reader asks the switch). THE RECORD SAYS ITS LAW: the market and a temper mint a piece again
from its record, so a craft's product record now carries its mint version (`v` 1, stamped by the service at the craft,
kept by a temper's re-sign, carried by the market's piece), and a record made before has none and mints byte for byte
as it did - no piece already made changes, here or on another client. The account service's acct129 (no migration;
acct126, acct127, then acct128, on the branch - renumbered past MINE-PERKS, HOMES-SHED and BUSY-GATE at the merges).

NOT SEEN. Pieces made before keep no line, by the version's design. A client not yet updated mints a `v` 1 record
without its line until it updates. Crafts still take no technique, curse or socket pass (not reported). A record grows
eight characters (the worst case 457 of 512).

`test/systems/fb1013e_craftprocs.test.js` (5); `tools/mutants/fb1013e_craftprocs.json` (26, all dead). Re-aimed by content, dead:
loot2, loot4 x3, prof3, prof10, prof7 x2, prof9 x2, audit30, and the account version's line in ten records. PIN MOVED:
the account version's pin in 19 suites (acct129).

## SPENT-ASHORE: the collapse among foes costs a tenth, never a death (10)

`systems/rest/rest.js` exhaustionOutcome (`spent`, EXHAUSTED_SPENT_SHARE, EXHAUSTED_FIGHTING_LINE); the four hosts' collapse.

FOUND. DFU's SetFatigue raises OnExhausted when fatigue reaches 0 (DaggerfallEntity.cs:362-364), and PlayerEntity's
OnExhausted SetHealth(0)s a dry-footed player when AreEnemiesNearby - any live foe inside the classic spawn band (1094
classic units, about 27 m), seen or not (PlayerEntity.cs, EnemySenses.cs:262). The port kept it 1:1 on dry land. A
fight's swings (8 each) and techniques (256-384; the technique gate leaves a sliver) drain the bar, nothing refills it
awake, and walking after the fight charges 8 a game minute (five real seconds) - so the bar ran out seconds after the
last kill, and the player died at full health, past the shield, FULL-GUARD and every death save (a SetHealth(0) asks
none). Nothing said why: "You collapse from exhaustion." was pushed and replaced by the death screen in the same call.
FIELD BUGS 2026-09-30b's "For Mac" item 5 had named it - "Exhaustion with foes about on dry feet is still DFU's death,
whatever the health - the same shape SWIM-SPENT ended in the water". Reproduced on the real ticker with a real EnemyAI 20
m off and unaware: never hit, health 100/100 at the call, dead five seconds after the kill; a death save always willing
was never asked; a foe 30 m off, the rest hour.

FIXED, a departure under the owner's word on SWIM-SPENT ("I dont care about DFU. We're our own thing now") and
FULL-GUARD's (no kill from full health): on dry feet with foes about a drain to nothing costs SWIM-SPENT's share - a tenth
of the health pool, never nothing (one constant, EXHAUSTED_SPENT_SHARE, the water's and the shore's) - said on the HUD
("You are too exhausted to fight - get clear and rest!", drafted in the twenty-five languages), with no box, and Come Sail
Away hears no death. Ten drains from full health, so the fighter has the bar's warning and fifty seconds to get clear.
The `death` outcome, RSC 1072's id and every host's SetHealth(0) collapse are gone. With no foes about the collapse is
the rest hour it always was; in the water, SWIM-SPENT's drown.

NOT SEEN. Which foe stood in the band at Knightshead; reproduced on the real ticker, not on the reporter's save.

`test/systems/fb1013e_spentashore.test.js` (4, red on the code before); `tools/mutants/fb1013e_spentashore.json` (14, all dead).
PIN MOVED, by intent: rest, audit26_streaming2, fb0930b_swimspent, auditworld5, disc28_fatigue, macro7_gate, csa_close
(two), effectarms (X1), playerdeath (AUDIT-DEATH1); and, at the merge with main's FIELD BUGS 2026-10-13d (REMAINS, which
kept DFU's collapse and stood its elder's death on it), `fb1013d_remains`'s fall - she dies of the collapses as they come,
through the same door, and her remains stand as that batch pins them. Re-aimed by content, dead: audit_air1 (two DEATH1 records), csa_close
(CSA-J-modes-exhaust-no-hook), fb0930b_swimspent (two).

## NO-ASKS-AGAIN: a No that leads nowhere asks again, on the next click (6)

`src/systems/quest/noAsksAgain.js` (new: inertNo, asksOnAClick, CLICK_TRIGGERS, askAgain); `src/systems/quest/quest.js`
update, restoreSaveData.

FOUND. The Lost Child is K0C00Y05: `_S.07_ task: clicked npc _child_` asks `prompt 1017 yes _S.09_ no _no_`, and nothing
reads `variable _no_`. Prompt.cs asks once (`allowRearm = false`; it completes when shown); ClickedNpc.cs answers true
for a set task, and Task.cs Update checks no trigger of one; nothing clears `_S.07_`. The quest still takes the child's
click (QuestResourceBehaviour.DoClick), so no talk window opens - "now i cant interact with it at all" - and all three
flags are saved, so a restart changes nothing. DFU soft-locks the same way: the port was faithful. Reproduced on the real
script and click path.

THE LIMIT, found in the corpus: 11 inert Nos. Ten are a robber's or a guard's "hand it over" under `injured _foe_`
(A0C00Y14, A0C00Y15, K0C00Y03, O0B00Y00, O0B10Y00, R0C10Y00, R0C10Y01, R0C10Y02, R0C10Y18, R0C11Y19; O0B00Y01's three
share one `_no_`): there No is the refusal and the quest goes on, and the injured trigger holds until the foe is stood
again, so a re-armed demand would come back every tick until a Yes gave the goods away.

FIXED, a departure under the owner's word ("I dont care about DFU. We're our own thing now") - one law, read off the
parsed quest, never its text: a prompt whose No is a plain variable with no actions, named by nothing but that prompt,
asked by a plain `_x_ task:` (never a global's) that nothing names and whose every trigger is a click, is re-armed once
answered No - the task cleared as a `clear` clears it, the Prompt alone made incomplete, the No cleared. It runs every
tick and at the end of every restore, so a save taken after the No loads asking again (and a shared or reclaimed copy,
which restore through it). A No that does something stays DFU's. In the shipped corpus the law re-arms The Lost Child
(and C0C00Y10's healer since QUEST-AUDIT III, below).

FOR THE OWNER - TAKEN (QUEST-AUDIT III, the owner: "fix any and all outstanding issues";
`01-Overview/audits/Quest-Audit-III.md`). C0C00Y10's healer answers No with `_no_ task: clear _S.10_` - the author meant
the healer to ask again, and DFU's allowRearm blocks it there too, so the talisman could never be bought after a No. A No
whose every action clears its click-asked task alone now asks again.

NOT SEEN. Whether a quest's Yes/No box can be closed with neither answer (neither variable set) - this law does not
cover that.

`test/systems/quest/fb1013e_noasks.test.js` (5); `tools/mutants/fb1013e_noasks.json` (12, all dead; one killed by questsave.test.js's
restore-order pin). No pin moved.

## AOE-PERF: the boss's circles shaded ground they never draw on (7)

`src/render/gate/gateTelegraph.js` telegraphMarkReach, telegraphStrip, the vertex stage's `uStrip`; `tools/fb1013ePerfProbe.mjs`.

MEASURED FIRST (a recording GL in Node found the CPU's side small - the passes make no buffer, program or texture a frame
and stall nothing - so the cost had to be measured where it is spent): `tools/fb1013ePerfProbe.mjs` runs the real
Renderer in Chromium on SwiftShader at 960x540, the court's own mesh, art, lights and fog, the shapes from the real
producers, the GL synced by a 1x1 read before and after the part timed, cases interleaved, the median of five rounds, at
a load average of 8-10 on four cores (a first pass at 40-50 gave the same ratios at about four times the milliseconds).
SwiftShader pays for every fragment a quad covers, discarded or not - the overdraw a GPU pays too. At a fighter's eye 8 m
from him, the court frame itself takes about 2.0 s here, and an AoE frame laid twelve blended telegraph passes over 3.4-3.7
screens of fragments: 575 ms on top of it - more than forty players cost (265 ms; eight Morrowind bodies 157 ms, forty
sprite walkers 190 ms). Two kinds of shape were laid over ground they never draw on at any pixel's size: his MARK (ring,
floor, chevron - every frame of the fight), its quad 4 m past the chevron's tip; and his host's PATHS and TETHERS, each
quad the box about the lane's whole run for a strip 0.7 m wide.

FIXED. The mark's quad is its own ground (`telegraphMarkReach`) and a path's or a tether's its own strip (`telegraphStrip`,
the vertex stage laying the walkways' quad along it, `uStrip`). Every other shape keeps TELEGRAPH_REACH - its glow, keyline
and wave reach as far as the pixel is large. The fragment stage is byte for byte the one it was; the AoE frames read back
differ from before in 675-885 texels on hard edges, fewer than the old pass differs from itself with the eye moved a
millimetre. His mark 0.39 -> 0.05 screens (60 -> 9 ms), his host's eight shapes 1.51 -> 0.54 (303 -> 100 ms), an AoE frame
3.37 -> 2.06 (575 -> 430 ms; 300-373 ms at a first-person eye). A single blow is unchanged (0.45-0.51 screens). ONE PASS A
COURT, the shapes looped in one fragment stage, was built and measured: slower in every case on SwiftShader and failing the
look check - not shipped.

THE CROWD, MEASURED AND NOT CHANGED. Past eight a peer is one billboard (an Eye Of The Beholder walker); the eight bodies
nearest are posed and drawn each frame, about 20 ms each here, the cost growing with the players drawn and nothing drawn
for nothing. A body's picture kept across frames would change its look (it breathes; the braziers flicker its light).
The CPU's side is under 5 ms in every case.

NOT SEEN. A GPU; the classic class sprite and the paperdoll lane (they need ARENA2); the names and the auras (the probe
draws neither). The reporter's machine and settings.

THE SHADOW PASS, COUNTED AFTER (2026-10-14). The probe timed the telegraph and the crowd after `beginFrame`; the shadow
maps are drawn inside it. `tools/courtShadowProbe.mjs` counts them: a still court draws none, but his glow and every
landing flash are composed as lamps (`world/gate/gateArena.js` withCourtLights marks none carried), so while he walked among
a crowd 12 cube faces, 6 lo faces and 6 copies a frame were drawn for his glow alone, and a Hellfire landing on five
draws 36 faces a frame (66 at worst) over its 27 lit frames and the two after, replaying the bodies about him (0.43M
corners a frame). Composed carried they would cost nothing and cast no shadow; Mac kept the shadows and asked for the
engine fixed (2026-10-14, "Engine fix (Recommended)"): LIGHT-ID (`07-Rendering/Enhanced-Lighting-Arc.md`) names each
light by its producer's record, so his glow moving draws its cube whole - 6 faces, no lo face, no copy - and a light
holding a 512 map draws no lo map (the landing's worst lo frame 126 faces to 54). The look is the same byte for byte
(`tools/lightIdLookProbe.mjs`). `07-Rendering/Performance-Rig.md` AOE-PERF has the table.

`test/net/gate/fb1013e_aoeperf.test.js` (4); `tools/mutants/fb1013e_aoeperf.json` (11, all dead; wb4's and wb13a's campaigns re-run,
62 of 62 dead). No pin moved. `07-Rendering/Performance-Rig.md` AOE-PERF, `11-Multiplayer/World-Bosses.md` WB13a.

## For Mac

1. **Writs and the count (2).** A writ spends only what law 3 counts; looted, shop-bought, traded and gold-bought units
   are named on the card now and still never fill one. Counting them is a change to law 3 (and would let shop gold become
   writ silver) - left as FIELD BUGS 2026-10-09f left it.
2. **The Mace's bill (8).** DFU's own: wear, plus the blow's damage whenever the target fails its save - 26-74 kills from
   1500 uses. The port's target-side multipliers (a stagger, an overreach, a revenant) ride the damage into the bill, as
   they ride the drain.
3. **C0C00Y10's healer (6).** Its No (`_no_ task: clear _S.10_`) was meant to ask again, and DFU's allowRearm blocked it,
   so the talisman could never be bought after a No. Taken by QUEST-AUDIT III: such a No asks again.
4. **A spent fighter's swings (10).** SPENT-ASHORE charges a tenth for every drain to nothing, as SWIM-SPENT does in the
   water - a swing at an empty bar is a drain, so ten swings there are a death. A latch of one charge a game minute is
   one line, if the swings should not count.
5. **The pads' look (5).** HILL-SEAT is measured on the real layout and the real stand-in with stand-in house boxes; the
   real footprints, the packs' whole sweep (gated on ARENA2_PATH) and the look on a GPU are unseen here.
6. **The inspect card (8).** It shows 100 while the Mace's bonus lasts: the bound is the relay's `CARD_STAT_MAX`, a relay
   deploy to move.
7. **Not this batch's.** `audit_wb9.json`'s AUDIT-WB9-flown-over-the-collider-alone (`src/scenes/spoilsPool.js`,
   untouched here) survives - found in AOE-PERF's campaign run, and re-judged on main's `ab8d3640` alone: it survives
   there too, so the law it names is checked by nothing on main today.

## THE FOUR HOSTS

- SPELL-LOCK: the law is the ActionSystem's, every host's door graph. worldModes.js (a building: its act through
  applyRemote, its memory through applyInteriorShared, its cached copy with the player's level) and dungeonContext.js
  (its act through applyRemote, its room memory as a peer's word and its save with the player's level) are wired;
  world.js and exterior.js stand no action doors in the street.
- DOOR-NAME: the plaque is worldModes.js's exteriorHoverName, the one namer both street hosts (world.js, exterior.js)
  call; a building's and a dungeon's doors name no building (worldModes.js's rooms, dungeonContext.js).
- SHARE-REVEAL: the quest machine's, run wherever a quest ticks; no host seam.
- HILL-SEAT: the street hosts stand the town blocks and both are wired through one function - world.js merges a
  block's pads into the pixel's static batch and its collider bucket (freed with the pixel, and on a failed build);
  exterior.js draws and collides them for the fixed city's life, as it does every model of its one location.
  worldModes.js's rooms and dungeonContext.js stand no hill.
- WRIT-WALL: the board is every host's (an overlay); no host seam.
- MACE-MAX: the law is the entity's (liveStat) and the enchantment dispatcher's. Every host's player blow reaches
  calculateAttackDamage's Strikes payload - world.js and exterior.js through their foes' and guards' resolvePlayerHit,
  worldModes.js's rooms through the same two pools, dungeonContext.js through its own - and every host mounts the
  enchant clock that stamps a strike.
- CRAFT-PROCS: the craft's mint, run where a craft's answer, a temper or a market piece is minted (the board's and the
  stations' pages, every host alike); and the account service. No host seam.
- SPENT-ASHORE: all four take the arm before any box and before Come Sail Away's death hook, and none keeps a
  SetHealth(0) collapse - world.js and exterior.js (`onExhaustedExterior`; exterior.js has no CSA hook), worldModes.js
  (`onExhaustedInterior`, its CSA-J hook moved below the arm), dungeonContext.js (`onExhausted`, after the drown arm and
  the arena's sand's fall - a bout keeps its own law).
- NO-ASKS-AGAIN: the quest machine's law, which world.js, exterior.js, worldModes.js and dungeonContext.js all tick and
  restore the same way; no host edited.
- AOE-PERF: the pass is the one the hosts share, none edited - world.js hands the court's and the Hour's pass
  (drawGateCourt, drawSdTelegraph) and draws the street's peers; worldModes.js draws both passes in the dungeon arm and the
  peers in the dungeon and the building; dungeonContext.js stands the court's level and draws neither; exterior.js stands
  no gate and no peers.

## Pins

`test/world/fb1013e_spelllock.test.js` (4), `test/systems/fb1013e_doorname.test.js` (1), `test/systems/quest/fb1013e_sharereveal.test.js` (2).
`tools/mutants/fb1013e_spelllock.json` 14, `fb1013e_doorname.json` 2, `fb1013e_sharereveal.json` 1: all dead. Re-aimed
by content, dead: `disc28.json`'s DISC28-I-getitem-not-replayed (the re-armed set grew) and `housing.json`'s
HOME-DOORS-the-early-record-dropped (the early record now drops a peer's lock). `test/scenes/citedrift.test.js`'s vendor table
carries the mod's `.cs:701-702` that DOOR-NAME's comment cites.
`test/world/fb1013e_hillseat.test.js` (8, one on ARENA2_PATH); `tools/mutants/fb1013e_hillseat.json` 18, all dead.
`test/systems/professions/fb1013e_writwall.test.js` (3); `tools/mutants/fb1013e_writwall.json` 13, all dead.
`test/systems/fb1013e_macemax.test.js` (4); `tools/mutants/fb1013e_macemax.json` 8, all dead.
`test/systems/fb1013e_craftprocs.test.js` (5); `tools/mutants/fb1013e_craftprocs.json` 26, all dead.
`test/systems/fb1013e_spentashore.test.js` (4); `tools/mutants/fb1013e_spentashore.json` 14, all dead.
`test/systems/quest/fb1013e_noasks.test.js` (5); `tools/mutants/fb1013e_noasks.json` 12, all dead.
`test/net/gate/fb1013e_aoeperf.test.js` (4); `tools/mutants/fb1013e_aoeperf.json` 11, all dead.
