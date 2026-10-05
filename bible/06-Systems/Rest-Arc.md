# Rest - campfires, beds and the field kit: resting online as an act, not a span of time

REST (proposed 2026-10-02). Mac, after QCLOCK-WORLD's audit measured the waits a rest can no longer skip online:
*"Honestly when it comes to resting, I think we rework it entirely. Using the campfire item, which is already used for
C&C, let players, using the loot menu, select an interaction (for example, the new resting will utilize any campfire in
dungeons, plus the campfire item.) Resting is no longer time based online with campfires, beds, camping sets, being the
main way to rest. New players now start with a campfire, which now is an item that can be pickup up and used multiple
times with limited uses with more availability in shops. Dungeon layouts now recieve multiple strategic placements for
campfires."* Then: *"Yep this is it. I think we should also introduce other type of consumables that can fill in the
gaps when a campfire isn't available. Lets do this and be as detailed as possible."*

**Status: BUILT 2026-10-03 - Mac: "Go" on every call of section 15.** REST1-REST6 and REST8 shipped; REST7 waits for
the online switch (see **As built**, before the Record, for every reading the build took). The design below is kept as
it was approved. Every claim about today's code was read
off the tree on 2026-10-02 (six read-only passes: the rest itself, every reader of rested time, the camps and the
plaque, the dungeon layouts, the consumables and their seams, the online constraints and the quest waits) and is cited
by module and function rather than line, so it survives the next merge. **Offline is untouched**: DFU's rest, byte for
byte (section 11).

---

## 0. The change on one page

- **Online, a rest is an act at a rest point, not hours on a dial.** A rest point is a lit fire (a dungeon's own
  campfire, a placed Campfire, a tent's fire, a world brazier or hearth), a bed (a rented room, an owned house, a ship,
  a guild hall where DFU lets you rest; a dungeon's bed since FIELD BUGS 2026-10-05 DUNGEON-BEDS) or, as the poor
  substitute, a Bedroll. You face it, the loot plaque offers
  **Rest**, you hold still for a few seconds, and you wake.
- **A rest is one night.** The recommended model (OPEN 1) moves the character's own clock eight hours at once - the
  same raise a rest makes today, made once and never chosen - so every system that reads the character's time
  (spells, diseases, needs, rooms, training, guild waits: section 7's 29 rows) keeps its meaning without a special
  case. A second rest inside the **night interval** (ten real minutes of play) is a **short rest**: it heals, and no
  night passes, so a fire is a place to recover and never a fast-forward button. At the fastest, a character who
  rests a night every ten minutes lives 600 of their own minutes per ten real ones (120 lived, 480 slept).
- **The rest window, the hours prompt, "rest until healed" and loitering go away online.** The R key rests at the
  rest point in reach, or says where one is needed.
- **The Campfire becomes a tool, not a match.** Template 541 (today's Campfire Kit) is placed, rested at, cooked at
  and **picked back up**; a charge is the fuel of one night its owner sleeps at it (8 charges, refuelled with
  Firewood). Every new online character starts with one, Climates & Calories on or off, and every General Store
  stocks them.
- **Every dungeon gets fires.** A deterministic placement law (section 4) stands two to seven permanent campfires in
  each dungeon - one by the entrance, one before the deepest reach, the rest spread between - the same on every
  client with nothing on the wire (the PROF2 veins' precedent). They warm, cook, light and rest; they never burn out
  and nobody can pick them up.
- **Seven consumables fill the gaps** where no fire stands or there is no time to sit (section 6): the Bedroll, the
  Ember Jar, Firewood, the Restorative Tonic, the Meditation Candle, Waking Salts and the Sleeping Draught - beside
  the Bandage (DFU's 249, RRI's bandaging) and the potions that already exist.
- **Quest waits get their own rule** (section 8, OPEN 12), because no rest model on its own fixes them: the
  recommendation restores TIMEFREE's audited delay half - a "come back in three days" lands after about two real
  minutes of play online - while deadlines stay QCLOCK-WORLD's, on played world time, and a rest never burns them.

---

## 1. The problem, stated whole

1. **Online, rest is a time machine that fights the shared world.** A rest raises the character's own clock
   (`src/systems/worldTick.js` `advanceOwnMinutes`, `raisedMinutes`), 10 minutes a sub-tick
   (`src/systems/restSession.js` `MINUTES_PER_TICK`), an hour in 0.45 real seconds (`REST_WAIT_PER_HOUR` 0.75 over six
   sub-ticks). Everything personal races ahead; the world, the sky and every other player do not. LIVED1 and TIME made
   that coherent, and every reader of the character's time had to learn which clock it reads (`Online-Time-Arc.md`
   section 5). It is coherent; it is also the reason every timed system online has a second law.
2. **Waits cannot be both fair and skippable.** TIME3 let a rest spend a quest's days (a three-day wait was a 72-hour
   rest, about half a minute). QCLOCK-WORLD took that away at Mac's call, and its audit measured the price: of the
   399 vendored quest clocks, 121 measurable waits - median 0.3 hours of play, p75 6.5, p90 24.3, max 188; 49 of a
   game day or more, 22 of a week or more; 30 in the main quest (S0000008's letters 10-13 days, 20-26 hours of play
   each). A rest that cannot move a wait leaves the player nothing to do but play the hours.
3. **A rest anywhere is a full heal anywhere.** Outside a town, a dungeon and the wilds are free to rest in
   (`restSession.js` `canRest`): one safe corner and an "until healed" rest of a few seconds undoes any fight. Climates
   & Calories priced rough rests (Hard: half the recovery, two ambush rolls, stiff - `src/systems/survival/difficulty.js`),
   but the corner was still anywhere.
4. **The party rest is machinery for a problem that goes away.** A vote, a 15 m gather, a mirrored rest window per
   member, cooldowns, a stop that ends it for everyone (`src/systems/partyRestLaw.js`, `world.js` `partyRestGate` /
   `partyRestFollowTick`): all of it exists to keep several people's hours in step.
5. **The campfire is a match.** A Campfire Kit's use is spent at the placing, the fire burns down in 480 world minutes
   and is gone (`src/systems/survival/camp.js` `placeCampItem`, `campExpired`; `src/scenes/camps.js` `tick`), and the
   kit only exists while Climates & Calories is on (`src/systems/survival/items.js` `provisionsStock`,
   `startingProvisions`). Its menu is a list picker, not the plaque (`camps.js` `hoverName` answers a title alone).

---

## 2. The model

### 2.1 Rest points

| Rest point | Where it comes from today | Rest kind (`src/systems/survival/rest.js` `REST_KIND`) |
|---|---|---|
| Dungeon campfire (new, section 4) | placement law, every client | Camp |
| A placed Campfire (template 541, section 3) | `camps.js` pool, kind Fire | Camp |
| A pitched tent (Camping Equipment, 530) | `camps.js` pool, kind Tent | Camp (the tent's fire) |
| A world fire: DFU's fire bowl, flame or brazier (TEXTURE.210 records 0, 1, 20) | `src/systems/survival/hearth.js` `collectHearths`, dungeons' `dungeonHearths` | Camp |
| An Ember Jar's fire (new, section 6) | `camps.js` pool, kind Fire, no pick-up | Camp |
| A bed: rented room, owned house (`homeBed`), ship, guild hall | `restSession.js` `canRest` / `interiorRestPlace` | Bed |
| A dungeon's bed (FIELD BUGS 2026-10-05 DUNGEON-BEDS; none in a palace, AUDIT FB1005 B3) | `dungeonContext.js` `dungeonBeds`, `restAct.js` `bedInReach` | Bed |
| A Bedroll (new, section 6) | the item, laid where a camp could stand, and in dungeons | Rough |

A rest point is **in reach** within `BY_FIRE_REACH` (4 m) of a fire, inside the room where DFU allows the rest for a
bed (the rented room, the house, the ship's cabin, a guild hall - `canRest`'s own answer), within `BY_FIRE_REACH` of a
dungeon's bed on its own floor (`bedInReach`: to the bed's nearest point, the feet within 1.5 m of its foot), and on the
spot for a Bedroll. Climates & Calories off, the rest kinds still decide nothing but the yield (every rest priced as a bed today,
`src/scenes/shared.js` `createRestDeps`; section 2.4 keeps that).

### 2.2 The act

1. **Begin.** The plaque's **Rest** row on a fire or a tent (section 10), the R key with a rest point in reach, the
   Bedroll's Use, or a bed's own press (the RRI bed click, a ship's bed). Refused - with today's words where they
   exist - when an enemy can see you or stands unaware within 12 m (`src/systems/encounters.js`, the resting variant),
   when swimming or not grounded, in town outdoors (a Bedroll; DFU's vagrancy), with a pending quest offer, or for a
   vampire unfed (`src/systems/vampirism.js`'s rest block): `restSession.js` `restDecision` is the gate, unchanged in
   order.
2. **Hold still.** A channel of **6 real seconds** at a fire, a tent or a bed, **10** on a Bedroll (OPEN 4): the HUD
   draws a ring and "Resting..." at the reticle. It is broken by taking damage, by an enemy coming into sight (the same
   resting enemy check, polled every frame), by moving more than a metre, by opening a window, and by leaving the
   point's reach. Broken, nothing happens; the point is not spent.
3. **The ambush.** At the channel's start the night rolls its encounter once (section 2.5). A hit spawns the foes and
   breaks the rest with DFU's own "You are awakened by..." line.
4. **Wake.** The night (or the short rest) is applied in one step (2.3), the yield (2.4) lands, and the HUD says it:
   "You wake rested." / "You rest a while." (a short rest) / "You slept poorly." (a rough night in Casual) /
   "You rise stiff and sore from a hard night." (Hard, rough - today's text, `shared.js`).

### 2.3 A night, and a short rest

- **A night** moves the character's own clock **480 minutes at once** through the one raise seam
  (`advanceOwnMinutes`), so the tick walks what eight rested hours walk today: the magic rounds (480, under the 2880
  cap), the per-minute block, the day block's character half, the calendar's character arms, the survival minutes.
  The sub-ticked loop is gone; the walk is the same walk, made once. It is still a raise, so QCLOCK-WORLD charges
  quests nothing for it.
- **The night interval.** A night passes at most once per **120 lived minutes of the character's clock** - ten real
  minutes of play, since lived time runs at TimeScale 12 - counted from the last night (OPEN 2). Inside it a rest is a
  **short rest**: the yield's healing lands, no clock moves, nothing ages [REST-SLEEP1: and the sleep need is paid as a
  night of its kind pays it - As built]. The status widget shows **Rested** (a buff
  tile, its minutes left at its foot, as NEED-TIER's need tiles say their stage) while the interval runs.
- **Why a night and not zero.** Section 7's census found 29 systems that read rested time. Under a night each keeps
  DFU's meaning - a buff wears off overnight, a disease takes its day, hunger grows, a room's night is spent, a
  guild's wait counts - and the interval bounds how fast anyone can sleep through them: at 600 own minutes per ten
  real ones, a 28-day rank wait takes at least 11 hours of play (today about two real minutes of resting; under zero
  time 56 hours of play). Zero time is OPEN 1's alternative; section 7 gives its replacement for every row.

### 2.4 The yield

| Rest kind | Health, magicka, fatigue | Sleep need (C&C) | Stiff (Hard) | Ambush |
|---|---|---|---|---|
| Bed | full | paid as eight bed hours (1.5 h an hour: 12 h of debt) | no | none (indoors) |
| Camp (any fire, a tent) | full | paid as eight camp hours (1.5 h an hour) | no | one roll |
| Rough (Bedroll) | Casual: full; Hard: eight hours at DFU's rates, halved (`REST_COST`) | eight rough hours (0.5 h an hour) | 4 h, as today | one roll; two in Hard |
| Short rest (inside the interval) | as the kind; nothing else | nothing [REST-SLEEP1: as the kind's night - As built] | no | none |

Full is the recommendation (OPEN 3) - a fire is a sanctuary, and the fight before it was the price. The alternative
is eight hours at DFU's rates (`src/systems/rest.js` `healthRecoveryRate` and the fatigue and magicka eighths), which
leaves a hurt character a second, short rest short of full. Climates & Calories off, every kind yields as a bed (no
sleep need, no stiffness) - today's pricing.

### 2.5 The ambush, one roll a night

Today every rested minute rolls the encounter tick (`world.js` `runEncounterTick` with `restAsks`; the dungeon's
`intermittentEnemySpawn` with `isResting` in its own `_restAdvance`), and a rough night in Hard asks twice. A night
rolls **once**, at the odds its 480 minutes carried: `1 - (1 - p)^480` for the per-minute `p` the tick uses where the
player rests (wilderness by day or night on the sky, the dungeon's own), twice for Hard's rough night. The pricing the
SURV-TIERS audit set stays exactly the pricing; it is only taken in one draw. A bed indoors rolls nothing, as now. A
short rest rolls nothing (no time passes). **A dungeon campfire wards** (OPEN 9): no wandering spawn stands within
15 m of one, so its roll is the dungeon's roll beyond that ring - the bonfire's promise, not a guarantee: a layout foe
can still walk up.

### 2.6 Strangers and parties

- **Strangers.** Today a stranger within 50 m outdoors or 30 m in a dungeon blocks a rest (`world.js`). A rest point
  is public: a stranger never blocks a rest at a fire or a bed. A Bedroll keeps the rule (OPEN 15).
- **The party.** The vote, the gather and the mirrors retire online. **A night carries the party** (OPEN 11): when a
  member rests a night, every member within 15 m who keeps "Rest with my party" on (`uiPrefs` `restWithParty`, shared
  on the pose as `nr`) gets the same night in the same step - each on their own clock, each their own yield and their
  own ambush-free wake (only the rester rolls). A follower who is mid-fight or swimming is skipped, not refused. One
  pose field (the night's stamp) replaces the mirrored rest record. [CAMP-ROLL: and members who press Rest together
  roll once - the camp's acts elect one roller, and the others sleep its night - As built]

---

## 3. The Campfire - template 541, reworked

Template 541 keeps its index (saves keep their kits) and becomes **Campfire** ("Campfire Kit" in a save reads as the
same item; the name is the template's).

| | Today (`src/systems/survival/items.js`, `camp.js`) | REST |
|---|---|---|
| Uses | `CAMPFIRE_USES` 5, one spent at placing | **8 charges**, one spent per night its **owner** sleeps at it (OPEN 5, 6) |
| Place | Use, spends a use; fire burns 480 world minutes, then is swept | Use places it, free; it burns while placed; unattended 480 world minutes, it goes **cold**, not gone |
| Pick up | impossible (`packCamp` answers nothing for a fire) | **Pick up** returns the item with its charges (`w` on the camp record) |
| At 0 charges | the kit is spliced out | it stays, "no fuel": Firewood refuels it (+3, to 8) |
| Weight, price | 3 kg, base 25 | 3 kg, base **40** (OPEN 6) |
| Who may use it | anyone rests and cooks; only the owner packs | anyone rests and cooks; only the owner picks up, relights, refuels; only the owner's nights spend charges (no draining a friend's fire) |
| Where | not indoors, not in town, not with foes near, not in water, on ground (`campDecision`) | unchanged; dungeons allowed, as now |
| Lane | Climates & Calories only | **online: always** (the rest needs it); offline: with C&C, as now |

- **Cold, not gone.** A cold Campfire is still a record: its owner can relight it (free) or pick it up. Online a
  stale owner's records are swept with the owner (`camps.js` `sweepOwners`), as today. The cap stays
  `CAMPS_PER_OWNER` 4, and a placing at it is never refused: it packs the owner's OLDEST camp away where it stands,
  its gear home as Pack gives it (FIELD BUGS 2026-10-04d CAMP-CAP - the refusal had locked characters out of camping
  for good, `01-Overview/Field-Bugs-2026-10-04d.md`).
- **The record.** `campWire` already carries `w` (0..255) and `k` 1 (fire): charges ride `w`, so a client one build
  behind still validates the record (`validCampRecord` refuses a new `k`, not a new meaning of `w`). Pick-up mints
  541 with `currentCondition = w` (`mintCondition`'s field, `src/systems/itemTemplates.js`), the info card's "N uses
  left" becoming "N nights of fuel".
- **The tent unifies with it.** Camping Equipment's 50 uses are today spent per pitch; under REST a use is spent per
  night its owner sleeps in it, pitching free - one rule for both (OPEN 6).
- **Start kit.** Every new online character starts with a full Campfire, C&C on or off (`src/systems/startingGear.js`
  `addSurvivalProvisions` grows an online arm; C&C's own 2-of-5 kit becomes this one full).
- **Shops.** General Store 2-4 always online (today 1-3 with C&C only, `provisionsStock`), Pawn Shop 0-2, a tavern 1 -
  and online a Campfire bought is back on its shelf, so a shelf that stocks one never sells out, and no shop buys one
  back (ENDLESS-STOCK, FIELD BUGS 2026-10-04: `shopStock.js` restockEndless, from both purchases - commitTrade's Buy and
  the keyed list's doBuy - and shopBuysItem);
  the online half-price essentials rate (`src/systems/shopStock.js` / the trade modes' `isPotion` arm) grows a
  Campfire and Firewood arm.

---

## 4. Dungeon campfires - the placement law

Deterministic, from layout data alone, the same on every client, nothing on the wire: the shape of PROF2's dungeon
veins (`src/net/nodeLaw.js` hashes the dungeon id into marker slots; `dungeonContext.js` `profVeinWall` casts the
rays). A dungeon's fires are permanent, never cold, never picked up.

### 4.1 Inputs (all already built per dungeon)

- the block grid (`src/world/dungeonLayout.js` `layoutDungeon`: origin per block, the starting block flag, the block
  names - B for borders),
- each block's markers (`src/world/rdbLayout.js` `layoutRdbBlock`): start (199.10), enter (199.8), random and fixed
  enemies (199.15/16), random treasure (199.19), quest spawn and item (199.11/18), fixed treasure (216); the water
  level; the action and exit doors,
- the collider (`src/player/collider.js` `raycast`, `findClearFloor`) with the `'dungeon'` bucket filter,
- the walkable-floor raster and its storeys (`src/systems/automapFloors.js` `deriveFloors`, `levelField`),
- the existing fires (`dungeonHearths`: TEXTURE.210 records 0, 1, 20).

### 4.2 Candidates

Every start, enter, treasure, quest and fixed-treasure marker, and every non-border block's centre, landed on the
floor below it and kept only if all hold:

- **ground:** a floor probe lands within 4 m below, normal `ny > 0.9` (no stairs, no ramps);
- **room to sit:** eight chest-height rays find no wall within 1.5 m; `findClearFloor` agrees;
- **dry:** at least 0.5 m above the dungeon's water level;
- **out of the way:** at least 3 m from every action and exit door, at least 8 m from every enemy marker;
- **not an arena:** never in a gate arena (`isGateArena`) and never in a sealed dungeon's boss block.

### 4.3 Choosing

The seed is the dungeon's `locationId` (a spawned or elite dungeon's clone carries its own, `src/world/spawnedDungeons.js`),
through the same `hash32`/`mix` the champions and elite picks use. Candidates are enumerated in layout order (block
index, then marker order); ties break on the hash.

1. **The entrance fire:** the valid candidate nearest the start marker, within 25 m (else the starting block's best).
2. **The deep fire:** the valid candidate farthest from the entrance fire, measured in 3D with height weighted twice -
   the approach to the deepest reach, where the quest's target usually waits.
3. **The spread:** farthest-point sampling over the rest, each new fire at least **80 m** (about a block and a half)
   from every fire already chosen and from every existing TEXTURE.210 fire, until there are
   **N = clamp(round(blocks / 3), 2, 7)** fires in all (OPEN 7). A storey with candidates and no fire takes the next
   pick first.
4. **Elite dungeons** take half (at least one, the entrance's): the elite's danger is the point. Small dungeons (the
   Smaller Dungeons setting is ignored online; offline it shrinks the grid) count the grid they build.

Existing TEXTURE.210 fires are rest points too (2.1); the law only adds where none stand.

### 4.4 What a placed fire is

- **Drawn** as TEXTURE.210 record 1 (`FIRE_FLAT`, the camp's own flame), its own billboard batch, animated like the
  layout's flats (`armFlatAnim`), with the torches' burn sound.
- **Lit** through the camps' light path (the nearest four fires within 64 m, range 12 - `camps.js`), never by growing
  the layout's light arrays (their flicker arrays are sized once at build).
- **Registered** as hearths: pushed into `dungeonHearths`, so warmth, drying, cooking and the camp rest kind all work
  through `byFire` / `fireNear` with no new law.
- **A target** keyed `dfire:<i>` (its index in the chosen list), named "Campfire", its plaque rows Rest and Cook.
- **On the map:** the enhanced held map marks a fire once the row it stands in is revealed (the TP-SEEN shape,
  `src/ui/automapSheet.js` `seenPortals`; a new mark kind in `src/ui/inkAutomap.js`); the compass takes them through
  the dungeon's `nodeMarks` seam as the veins do. The classic 3D map gains a marker model per fire.
- **Online:** nothing to sync - every client stands the same fires. No relay bump.

---

## 5. Beds

- **Where DFU lets you rest indoors, a bed is the rest point.** A rented room (with nights left), an owned house
  (`homeBed` online counts as a permanent scene), a ship's cabin, a guild hall that allows it: `canRest`'s answer,
  unchanged. Indoors the R key rests there without targeting the bed; the RRI bed click and a ship's bed press stay.
- **A dungeon's bed is a rest point** (FIELD BUGS 2026-10-05 DUNGEON-BEDS, the Discord: "Beds in dungeons should count
  as beds so I can rest in a dungeon"). The page named no dungeon bed and the dungeon's point was a fire alone; its 108
  beds (Roleplay Realism's 41000-41002, 42 RDB blocks) are a bed's rest within a fire's reach of the box
  (`restAct.js` bedInReach), as is a bed pressed below deck. `01-Overview/Field-Bugs-2026-10-05.md`.
- **Rooms count nights** (OPEN 10). Today `checkRent` counts rested hours down and the room's own expiry counts the
  character's days (`src/systems/tavern.js`'s sweep), and the two can disagree (the room's text says it expired while
  the sweep keeps it). Online under REST a room rented for N days buys **N nights**: a night at its bed spends one,
  and the room also lapses after N days lived, whichever comes first. The words: "Room rented: 3 nights."

---

## 6. The consumables that fill the gaps

Each answers one gap and none replaces the fire. All are port templates in a new block, **1700-1709** (unused today;
registered with `registerCustomTemplates` in UselessItems2, imported where `src/systems/save.js` reaches, as the
profession rows are), stackable unless they carry charges, and usable from the hotbar (`kind: 'use'`). Numbers are
recommendations (OPEN 13).

| # | Item | Gap it fills | Effect | Uses, weight, base price | Sources |
|---|---|---|---|---|---|
| 1700 | **Bedroll** | no fire, a night needed | a rough rest point anywhere a camp could stand, in dungeons too; the Rough row of 2.4 | 10 nights, 2.5 kg, 80 | General Store; Outfitting (hide + cloth, tier 1) |
| 1701 | **Ember Jar** | the Campfire is out of fuel, or left behind | lights a one-night fire where a Campfire could stand: a Camp rest point and a cooking fire for 180 world minutes; cannot be picked up | 1, 0.5 kg, 15 | General Store, tavern; dungeon piles J-O 4%, foes 2% |
| 1702 | **Firewood** | the Campfire's fuel | +3 charges to a Campfire (to 8) | 1, 1.5 kg, 8 | General Store; Logging (a new BURN/SAW output) |
| 1703 | **Restorative Tonic** | mid-dungeon, no time to sit | at once: +40% fatigue, and with C&C the sleep need 4 h lighter | 1, 0.2 kg, 30 | Alchemist, General Store; Alchemy (PROF9) or Herbalism; piles 4% |
| 1704 | **Meditation Candle** | magicka without a night | kneel 6 s (the rest's channel rules): +50% magicka | 3, 0.3 kg, 35 | Temples, Mages Guild; Carpentry wax or Masonry (OPEN 13) |
| 1705 | **Waking Salts** | Drowsy or Exhausted with no rest point | an hour of play with the sleep need's penalties held off; the debt keeps growing, and 2 h more lands when it ends | 3, 0.1 kg, 40 | Alchemist; Alchemy |
| 1706 | **Sleeping Draught** | a hard night (Hard, rough) | the next night sleeps as a bed: full yield, no stiffness, the bed's sleep rate | 1, 0.2 kg, 45 | Alchemist, tavern |

Already there, and kept in the family: the **Bandage** (DFU's 249; RRI bandaging heals the lesser of Medical/3 and 40%
of maximum health and tallies Medical - `src/systems/rriKits.js` `useBandage`), stocked at every General Store and
temple online; the **potions** (`src/systems/potions.js` - Healing, Stamina, Restore Power), the healing supply on
shelves and in piles (`src/systems/healingSupply.js`); C&C's rations and waterskin.

**The seams each item needs** (the consumables pass, verified on the tree):
1. the template row, with `hitPoints` as its charges (`mintCondition`), `rarity` for the shelf, its world icon;
2. a use handler (`registerItemUseHandler`, with `.usable` where gated) answering the kinds the UIs already know -
   `text`, `refused`, `closesWindow`, and for the Bedroll and the Ember Jar a placing kind beside `placeFire`;
3. an info-card arm (`src/systems/itemInfo.js` and the enhanced card), or it falls to the generic misc text;
4. a shelf provider or a fixed count (`registerCustomItemsForGroup`, or the healing supply's fixed-count shape);
5. loot hooks where listed (`registerTabledLootHandler` for piles J-O, `registerEnemyLootExtra` for foes);
6. any new item field declared in `ITEM_FIELDS` (`src/systems/itemFields.js`; `test/rf5_itemfields.test.js` pins
   that mints write nothing undeclared);
7. the online essentials price arm; the hotbar already takes any item;
8. crafted ones: a recipe row in `src/net/recipeLaw.js` (or a conversion in `src/net/professionLaw.js`), a `mintPiece`
   arm for the new kind (`src/systems/smithItems.js` - an unknown kind falls through to armour today), the station's
   family list, and the account service picks the recipe up from the shared module (an `acct` bump, no migration
   unless a new Stores material is added).

**Ship before anyone can see one.** `validLootItem` (`src/systems/loot.js`) refuses a template its build does not know,
and a container holding one reads "from a newer version" to an older client: the templates land a release before
any shelf, pile, trade or Campfire record carries them.

---

## 7. Every reader of rested time, under REST

The census (every system an online rest moves today; the night model's answer, and zero time's replacement for OPEN 1).
"At the fastest" is a night every ten real minutes of play: 600 of the character's minutes per ten real ones.

| # | System (where) | Today: a rest... | Under a night | If zero time instead |
|---|---|---|---|---|
| 1 | Spell effects, magic rounds (`worldTick.js` `claimMagicRounds`; `src/systems/effects.js`) | runs 480 rounds an 8 h rest | the same, once | a night ends every timed effect on you (not an item's held magic) |
| 2 | Regeneration, career and enchanted (round hooks) | fires through it | the same | moot: the yield heals |
| 3 | Enchantment payloads (RepairsObjects and kin) | tick through it | the same | nothing overnight |
| 4 | Diseases (`src/systems/diseases.js`) | a day's roll and countdown per day | a day every three nights | a night counts one day |
| 5 | Poisons (`src/systems/poisons.js`) | run out or kill in sleep | 480 minutes | a night runs them out |
| 6 | Infection dream and turn | about three days' rest delivers both | nine nights; at the fastest about 72 min of play | a night counts one day |
| 7 | Vampire thirst (`src/systems/vampirism.js`) | a day's rest leaves them unfed | unfed after three nights; the rest block stands | a night counts one day |
| 8 | Lycanthropy urge and the daily change (`src/systems/lycanthropy.js`) | builds and clears | 8 h a night; the full moon is the sky's | a night counts one day |
| 9 | C&C needs (`src/systems/survival/needs.js` `survivalMinute`) | hunger, thirst, auto-eat, sleep paid, drying, rot, sobering | the same eight hours, the yield's sleep rate | **sleep debt has no other payer**: the yield must pay it; hunger and thirst cost a night's worth |
| 10 | Stiff (`survival/rest.js` `stiffen`) | set at waking, outlasted by the next rest | set; outlasted by the next night | lasts 4 h of play |
| 11 | Skill checks (`src/systems/advancement.js`, `onRestFinished`) | open after 6 h since the last | a night always opens it | open at a rest if 6 h lived since the last |
| 12 | Training cooldown (720 min) | a 12 h rest reopens it | two nights; at the fastest about 12 min of play | 1 h of play |
| 13 | Guild rank wait (`src/systems/guilds.js`, 28 days) | 28 days' rest, about 2 real minutes | at the fastest about 11 h of play | 56 h of play |
| 14 | Crime-guild letters (`src/systems/crimeGuilds.js`, 3 days) | a 3-day rest | at the fastest about 72 min of play, or OPEN 12's short wait | 6 h of play, or the short wait |
| 15 | Curse quests (`src/systems/racialQuests.js`, 38 / 84 days) | rested days count | at the fastest about 15 / 34 h of play, or the short wait | 76 / 168 h of play, or the short wait |
| 16 | Reputation drift (`worldTick.js` calendar arms) | a week's rest returns a point | nights count | weeks of play |
| 17 | Rented rooms (`tavern.js`; `checkRent`) | hours down; two counters that disagree | **nights** (section 5) | nights (section 5) |
| 18 | Loans (`src/systems/banking.js`, 365 days) | a rest brings them due | at the fastest about 146 h of play | in effect never due |
| 19 | Smith repairs (`src/systems/repairService.js`, a day or more) | a day's rest finishes one | three nights a day; at the fastest about 24 min | 2 h of play a day |
| 20 | Conjured items (`src/systems/createItem.js` `removeExpiredItems`) | expire in sleep | the same | a night expires them |
| 21 | Enemy alert decay (8 h, `encounters.js`) | an 8 h rest clears it | the same | stays up |
| 22 | Rest-interruption encounters | every rested minute rolls | **one roll a night** (2.5) | one roll a rest |
| 23 | Revenants' return (`src/systems/revenant.js`, 1-3 days) | a rest makes them due | nights count | play only |
| 24 | Watch challenge cooldown and grace (`src/systems/standing.js`) | outwaited by a rest | nights count | play only |
| 25 | Tavern meal gate (240 min) | a rest reopens it | the same | 20 min of play |
| 26 | Quest clocks (`src/systems/quest/clock.js` `chargeSeconds`) | charged nothing (QCLOCK-WORLD) | unchanged | unchanged |
| 27 | Quest raw readers: PlaySound's interval, the tombstone's week, GUARD-ONLINE's watch (`src/systems/quest/onlineGuard.js`) | come due after a rest | the same (a night is a raise on the raw clock) | play only; the guard's watch kept by standing in the hall |
| 28 | Bounties (`src/systems/bountyBoard.js` `lapseBounties`) | **the event clock**: a rest does nothing | unchanged (about two real hours) | unchanged |
| 29 | A placed fire's burn-down (`camps.js`, world minutes) | the event clock; a rest at your own tent stokes it | unchanged; cold, not gone (section 3) | unchanged |

**Raises that stay raises** (not rests, untouched by REST): fast travel and the journey's walk, training's own hours,
TrainPc, the tavern meal and blackout, cooking at a camp (and the hunt's search, until HUNT-OUT, 2026-10-04), the exhaustion collapse (an hour: a penalty),
the vampire's fortnight, the cures, a prison sentence. Cautious travel's full heal stays.

**The dungeon's second rest.** The dungeon host runs its own copy of the rested minute (`dungeonContext.js`
`_restAdvance`: rounds, survival, alert decay, the spawn roll). REST retires it: the night goes through the one raise
seam in every host, and the ambush is 2.5's single roll.

---

## 8. Quest waits - the rule no rest model supplies

A night is a raise; QCLOCK-WORLD charges quests nothing for a raise; so under REST, as now, a quest's wait online is
played hours. Three ways out (OPEN 12):

- **A - the short wait (recommended).** Restore TIMEFREE's **delay half** only (reverted with it; the reading lives in
  the history at commits a075cbdd6, 6611f0188 and 6bd966f27): the script reading that tells a deadline from a delay
  (`clockIsDeadline` - a clock whose end loses the quest, costs a standing, or shuts a reward waiting on it is a
  deadline; the rest are delays; a closing started after the quest is settled is a delay; the hand tables
  `ONLINE_DEADLINES` and `ONLINE_CLOSINGS`; "at once" clocks), audited by hand over all 399 vendored clocks: 262
  deadlines, 137 delays, the main quest's 30 deadlines listed and pinned. Online a **delay** is cut once to the short
  wait (24 minutes of the character's clock, about two real minutes of play) and lands; a **deadline** runs on
  QCLOCK-WORLD's played world time and fires as DFU's. The journal says "a few" days only for a delay; deadlines keep
  their count, their "Time remains" and the herald's warning (TIMEFREE's walk skipped every clock; this one skips
  delays). The crime-guild letters and the curse arms may take the short wait too (TIMEFREE's
  `CRIME_GUILD_LETTER_ONLINE_MINUTES`, `ONLINE_RACIAL_INTERVAL_MINUTES` with `racialArmIdle`); the bounties' never-lapse
  and the any-hour letters stay out.
  **Its one sharp edge:** under TIMEFREE a deadline misread as a delay only froze; here it would fire its task - a
  failure - in two minutes. The audit's reading and its two tables carry more weight than they did, and the 30
  main-quest deadlines and TIMEFREE's tests come back with it, re-aimed (the freeze assertions become "runs on played
  time").
- **B - a night spends a delay.** Delays charge a night as a day (deadlines never): "come back in three days" is three
  nights, at least twenty minutes of play under the interval (main-quest letters of 10-13 days, 10-13 nights: about
  two hours). Diegetic, and the same classifier is needed.
- **C - both.** The short wait, and a night ends a delay at once.

**REST8 built (2026-10-03): option A** (OPEN 12, Mac's call: the recommendation). TIMEFREE's delay half is back on
QCLOCK-WORLD's clock, online only - the gate is the quest hooks' `sharedClock`, TIMEFREE's own (`quest/clock.js`
`questWaitsShort`, its `questTimeFree` renamed for what it gates now); offline nothing changes.

- **The reading, whole.** `clockIsDeadline` (`reached`, `readsAsDeadline`, `startersOf`, `closes`), the hand table
  `ONLINE_DEADLINES` (the cure quests' hunters, U0C00Y00's escape, M0B11Y18's mark, Brisienna's month, and the entries
  the audits below add), the "at once" clocks (`declaredAtOnce`), the run-time half (`isDeadline`: a task-started
  deadline closes on the short wait once the quest is a success, unless started after it - `startedAfterSuccess`,
  saved). Restored line for line from commits a075cbdd6 and 6611f0188, every hand-audited classification kept but the
  two R1 corrects: 264 deadlines, 135 delays over the 399 vendored clocks as REST8 built it - 271 and 128 now (AUDIT
  REST-PARTY D2, AUDIT REST II Q1/Q2 and AUDIT REST III D2, below) - and the main quest's deadlines listed and pinned (31
  as built: the audit's 30 and S0000502's tower; 32 with AUDIT REST II's S0000011).
- **R1 - two deadlines the audit read as delays.** T3 reads `end quest` by what the end ALONE sets off, but the reward
  that clears it was read over the whole conditional reach. Two clocks fell between: K0C00Y02's gold ("you only have
  =2mondung_ days": `when _2mondung_ and not _mggold_` ends it unpaid; the pay needs a brick returned first - TIMEFREE's
  test called it "two months") and S0000502's Direnni tower, the main quest's ("my master will wait inside for
  =towertime_ days": `when _towertime_ and not _goout_` ends it; the reward needs the item found with him). Both were
  delays, so online each quest ended unpaid two minutes in - under TIMEFREE, which shipped, too. `readsAsDeadline`
  reads the reward alone now, T3's own rule; over the corpus it moves those two and nothing else (checked: every other
  delay whose end alone ends the quest is a closing or an "at once" clock; no other delay's end alone costs a standing
  but R0C11Y03's, which AUDIT REST II Q1 found a deadline).
- **A delay** (`Clock.waitsShort`: online and not a deadline) has its remainder cut once to `ONLINE_DELAY_SECONDS` (24
  minutes of the character's clock) at the tick, then is charged as any clock - QCLOCK-WORLD's played step, never a
  raise, so a night spends none of it either: it lands after about two real minutes of play. The journal's live read
  makes the same cut (QT-LIVE1's one arithmetic). Its `=x_` count reads "a few", and the journal walk skips it (no
  "Time remains" for a letter).
- **A deadline** is QCLOCK-WORLD's untouched: played world time, DFU's end - armed at nothing, it fires on its first
  tick as offline (AUDIT TIMEFREE T7's frozen guard went with the freeze). Its count, its "Time remains", the rail and
  the herald's urgency stand.
- **The crime-guild letters and the curse arms** take the short wait (`CRIME_GUILD_LETTER_ONLINE_MINUTES`;
  `ONLINE_RACIAL_INTERVAL_MINUTES` with `racialArmIdle`, which reads the world host's live quests through the racial
  host's `activeQuestNames` - one line in `src/scenes/world.js`). **Out, as QCLOCK-WORLD has them:** a taken bounty
  lapses and shows its time; a letter waits for the sky's morning.
- **The edge, as built.** Measured against what each misreading costs: a deadline read as a delay fires its end - a
  failure - two minutes in (as it did under TIMEFREE, whose delays were cut the same); a delay read as a deadline now
  only waits its played days, where TIMEFREE froze it for ever. So the one harmful misreading is the first - R1 found
  two - and it is what the pins guard: the split, both tables, the 31 main-quest deadlines, and every vendored clock
  ticked online past the short wait - all 135 delays landed, not one of the 264 deadlines cut (266 and 133 since AUDIT REST-PARTY)
  (`test/rest8_questwaits.test.js`).
- **Pins:** `test/rest8_questwaits.test.js` (TIMEFREE's file re-aimed: the freeze assertions now "runs on played
  time"), `test/rest8_audit_timefree.test.js` (AUDIT TIMEFREE's and AUDIT TIMEFREE II's, re-aimed the same way; T7
  retired with the freeze; R1's two, ticked). Campaigns `tools/mutants/rest8.json` (22) and
  `tools/mutants/rest8_audit_timefree.json` (14), all dead; `tools/mutants/qtlive1.json`'s one moved record re-aimed.
  `Online-Time-Arc.md` 6.3d is the law's page. The Online pane's sentence is REST9's (the words), and still says
  QCLOCK-WORLD's (true of a deadline, silent on a delay); the unreleased QCLOCK-WORLD patch notes had the four lines
  REST8 made false corrected (a wait, the countdowns, the day counts, the curse and guild letters).

---

## 9. Online - what the wire, the relay and the service need

- **No relay bump for the fires or the rest.** Dungeon fires are deterministic; the rest is a client act; the relay
  reads no camp data (`server/src/index.js`: "The relay reads none of it"). The party's night is one new pose field;
  the pose's validators live in `src/net/wire.js`, so that field **is** a relay change (`RELAY_VERSION`, the
  relay-version pin's hash row, the deploy) - unless it rides the existing rest record's slot (OPEN 11).
- **Camp records stay readable a build behind.** Charges ride `w`; `k` stays 0 / 1. A Bedroll laid is not a camp
  record (it is the rester's own act), so no new `k`.
- **New templates** (1700-1706): registered at import, shipped a release before any shelf or pile carries them
  (section 6). The relay never reads items; the account service only for crafted ones (the recipe module it imports:
  an `acct` bump; a migration only for a new Stores material such as wax).
- **Shared dungeon state** is untouched: fires are not doors or chests and need no `act` field.
- **The party's night**, the stranger rule at rest points, and the retired votes are the online lane's alone; offline
  never sees them.

---

## 10. On screen

- **The plaque's rows** (`src/systems/worldHover.js` `resolveHover` takes `actions` from a namer; `src/systems/quickLoot.js`
  `plaqueActionFor` reads the lit one; the horse and cart pool is the nearest precedent). A fire's namer answers
  `{ title, subs, actions }`:
  - a dungeon fire: **Campfire** - Rest, Cook;
  - your Campfire: **Your Campfire** · "6 nights of fuel" - Rest, Cook, Pick up (Relight when cold, Refuel with
    Firewood in the pack);
  - another player's Campfire: **Ana's Campfire** - Rest, Cook;
  - a tent: **Camp** - Rest, Cook, Pack (yours);
  - a world brazier or hearth: **Fire** - Rest, Cook (today: Cook only).
  The camps' `hoverName` grows `actions` from `campMenu`'s row keys, which already fit as ids. The classic skin and
  touch keep the list picker (`src/ui/listPicker.js`): the classic loot panel draws only item frames.
- **R** rests at the rest point in reach; with none: "Find a fire or a bed to rest, or lay out a bedroll." In a
  dungeon with fires it adds the nearest's bearing on the compass.
- **The channel ring** at the reticle, "Resting..."; broken: "Your rest is interrupted."
- **The status widget**: **Rested** (a buff tile, its minutes left at its foot) through the night interval.
- **The rest window** online: gone. Offline: unchanged.
- **The Online pane** (`src/ui/enhancedMenu.js`) says it: rest at fires and beds; a rest is a night; quest waits and
  deadlines as OPEN 12 settles.

---

## 11. Offline

DFU's rest, unchanged: the window, the hours, until healed, loitering, the sub-ticked hours, the per-minute rolls, the
party code's offline arms. What offline does get (OPEN 8): the reworked Campfire's pick-up and charges (one item law
in both lanes; offline a charge is spent per night slept at it through the timed rest, a night being any rest of six
hours or more), the dungeon fires as cooking and camp-kind points (they make an offline rest a camp rest, as a
brazier does today), and the consumables. The night interval, the single ambush and the rest-as-act are online's.

---

## 12. Numbers in one place

| Number | Value | Why |
|---|---|---|
| A night | 480 minutes of the character's clock | DFU's customary 8 h |
| Night interval | 120 lived minutes (10 real minutes of play) | bounds sleeping through personal timers (section 7) |
| Channel | 6 s (fire, tent, bed), 10 s (Bedroll) | long enough to need safety, short enough not to bore |
| Break on movement | > 1 m | a nudge is not a walk |
| Rest reach | 4 m of a fire (`BY_FIRE_REACH`); a bed's room | today's reach |
| Campfire | 8 charges, base 40, 3 kg | about a dungeon's worth of nights |
| Firewood | +3 charges, base 8 | a refill at a fraction of a new fire |
| Dungeon fires | clamp(round(blocks/3), 2, 7); 80 m apart; elite half | entrance, deep, spread |
| Candidate clearance | 3 m from doors, 8 m from enemy markers, 0.5 m above water | out of the way and dry |
| Ward | 15 m around a dungeon fire | no wandering spawn stands inside it |
| Party night | 15 m, `restWithParty` on | today's gather radius and switch |

---

## 13. Tests and probes (the slices' own, named here so the plan is checkable)

- the rest act: refusals in `restDecision`'s order, the channel's five breaks, night vs short rest across the
  interval, the yield per kind and tier, the single ambush's odds equal to 480 per-minute rolls (exact, for each
  host's `p`), Rested's tile;
- the census: a night walks what eight sub-ticked hours walked, row by row (1-25) - the same rounds, needs, disease
  day, room night - with the dungeon's copy retired; quests charged nothing;
- the Campfire: place free, a night spends one owner charge, a friend's night none, cold at 480 world minutes and kept,
  pick-up returns `w`, Firewood refuels to 8, a record from a build behind still validates;
- dungeon fires: the same list on two machines for every vendored dungeon (the ARENA2 suite's own data), every fire
  passes 4.2's tests, the count law, the spacing, the entrance and deep picks, elite halving, none in a gate arena;
- the consumables: each template known to `validLootItem`, its use, its card, its shelf, its loot odds, its recipe;
- the party's night; strangers at rest points; the words;
- live: a dungeon walked from the entrance fire to the deep fire online, the plaque's rows on every rest point, the
  map and compass marks (`tools/` probes in the shape of the status-widget probe).

---

## 14. Slices

1. **REST1 - the act.** Online: the rest point test, the channel, the night through the one raise seam, the short rest
   and the interval, the yield table, the R key, the rest window and loiter retired online, Rested's tile, rooms by
   nights, the dungeon's second rest retired. Existing fires, tents and beds are the rest points.
2. **REST2 - the Campfire.** Template 541 reworked (charges per owner night, place free, cold not gone, pick up,
   relight), the plaque rows on every camp and fire, the start kit online for everyone, the shelves, the essentials
   price.
3. **REST3 - dungeon fires.** The placement law, the flats, the light, the hearth registration, the ward, the map and
   compass marks.
4. **REST4 - the ambush.** One roll a night, Hard's two, beds none.
5. **REST5 - the party's night.** The pose field (and the relay bump if it needs one), the stranger rule at rest
   points, the votes and mirrors retired online.
6. **REST6 - the consumables.** 1700-1706 registered (a release ahead), uses, cards, shelves, loot.
7. **REST7 - crafting.** The Bedroll at Outfitting, Firewood at Logging, the tonic, the salts and the draught at
   Alchemy when PROF9 lands (Herbalism until then), the candle (OPEN 13): recipes, mint arms, station lists, the
   account service's bump.
8. **REST8 - quest waits.** OPEN 12's choice: A restores TIMEFREE's delay half with its audit and tests re-aimed.
9. **REST9 - the words.** The Online pane, the patch notes, the help.
10. **AUDIT REST.** Every lens: the act, the census, the Campfire, the fires on every vendored dungeon, the consumables,
    online skew, the words.

---

## 15. OPEN - Mac's calls (each with the recommendation)

1. **A night, or zero time?** Recommended: **a night** - 480 minutes of the character's clock at once, through the
   seam a rest uses today; every system keeps its meaning (section 7). Zero time is what "no longer time based" says
   word for word, and section 7's last column is its price (sleep debt paid by hand, guild ranks 56 hours of play).
2. **The night interval.** Recommended: **10 real minutes of play** between nights; a rest inside it heals and passes
   nothing.
3. **What a rest heals.** Recommended: **full** at a fire, a tent or a bed; a Bedroll as the tier prices a rough night.
4. **The channel.** Recommended: **6 s**, 10 on a Bedroll; broken by damage, sight, a metre's move, a window.
5. **Whose charge a night spends.** Recommended: **the owner's nights only** - a friend sleeping at your fire costs you
   nothing.
6. **Campfire numbers.** Recommended: **8 charges, base 40, Firewood +3 at base 8**; the tent's 50 spent per night,
   pitching free.
7. **Dungeon fire count.** Recommended: **clamp(round(blocks/3), 2, 7)**, 80 m apart, entrance and deep first, elite
   half.
8. **Dungeon fires offline too?** Recommended: **yes**, as cooking and camp-kind points; the rest itself stays DFU's.
9. **A fire's ward.** Recommended: **15 m** in which no wandering spawn stands.
10. **Rooms online.** Recommended: **a day rented is a night**, lapsing after the days lived too.
11. **The party.** Recommended: **a night carries members within 15 m with "Rest with my party" on**; votes and mirrors
    retired online.
12. **Quest waits.** Recommended: **A** - TIMEFREE's audited delay half (a wait lands after about two real minutes of
    play online), deadlines on played world time, and the crime-guild letters and curse arms on the short wait.
    [ANSWERED AND BUILT 2026-10-03: A, as recommended (REST8, section 8).]
13. **The consumables.** Recommended: **the seven in section 6** at those numbers; the candle's craft (Carpentry's wax
    or Masonry) Mac's pick.
14. **Loitering online.** Recommended: **retired** - the sky runs on real time, so a loiter waits for nothing online.
15. **Strangers at a rest point.** Recommended: **never block**; a Bedroll keeps today's rule.
16. **The Campfire without C&C.** Recommended: **core online for everyone** (start kit, shelves), C&C or not.

---

## As built (2026-10-03)

Mac: "Go" - every recommendation of section 15 taken. Slices REST1-REST6 and REST8 shipped on 2026-10-03; REST7 waits
(below). Each slice's tests are its Testing.md row; each law has its mutant list (`tools/mutants/rest3.json`,
`rest5.json`, `rest6.json`, and the re-aimed SURV3/SURV-TIERS records for REST2).

- **REST1 - the act** (`src/systems/restAct.js`; createRestDeps' `restAct`, `restNight`, `restShort`). As section 2,
  with these readings: the channel is the rest window's own `channel` state (both skins), so the window being modal is
  what keeps the player still - no step can be taken inside it - and an enemy is the end-of-channel check (the enemy
  in reach, or a spawn latched while holding), not a per-frame poll. **The ambush (REST4) is not a separate draw:** the
  night is one synchronous RestSession, so the per-minute rolls run inside it at the price the SURV-TIERS audit set -
  the same odds as one roll at `1 - (1 - p)^480`, the break landing at the hour it falls, as an ambush mid-night.
  `restNightAt` rides the save; a rented room's day is a night (`spendRoomNight`) [AUDIT REST II P6: rooms count nights].
- **REST2 - the Campfire** (`src/systems/survival/camp.js`, `src/scenes/camps.js`, `src/systems/survival/items.js`): as
  section 3 - the Pawn Shop's 0-2 and the online half price for a Campfire and Firewood came with AUDIT REST
  (`shopStock.js`, `tradeModes.js`); the port's taverns keep no shelf, so a tavern sells none.
- **REST3 - dungeon fires** (`src/world/dungeonFires.js`; `tools/dungeonFireProbe.mjs` for the real dungeons, which
  this tree's container cannot read - run it with ARENA2_PATH). As section 4, with these readings: N counts the
  non-border blocks (a border block is a cap of rock, not a room); a 6 m height band stands in for 4.2's storey
  (`automapFloors.js` derives its storeys off the draw, after the fires must stand); no dungeon in the port is sealed,
  so 4.2's boss-block rule has nothing to read; a fire is lit by a light of its own pushed before the layout's flicker
  is sized (so the camps' light path is not needed), and is a light billboard to Improved Interior Lighting as any
  210 flat is; its key is the hearth's (`hearth:<i>`) and its plaque says "Campfire"; the classic 3D automap stays
  DFU's, unmarked - the held map and the compass mark the fires. Placed offline too (OPEN 8).
- **REST5 - the party's night** (world.js `carryPartyNight`, `encounters.js` `quietNights`): as 2.6, with no relay
  bump - the night's stamp is the pose's `restStartedAt` (a rest's open stamps no start online), which an older client
  reads as its own "a rest just happened" cooldown. A follower inside their own night interval gets a short rest.
- **REST6 - the consumables** (`src/systems/restItems.js`): as section 6, with these readings: the Bedroll is a laid
  spot (not a camp record: nothing on the wire, nothing saved) and its Use begins the rest on it at once; the Candle is
  lit from the pack and the next rest is its kneel (both windows; offline too); the shelves are a General Store's and
  an Alchemist's (the port's temples, guilds and taverns keep no shelf), so the Candle and the Draught are the
  Alchemist's and the Ember Jar the General Store's. **Online every source is shut** - `REST_ITEMS_ONLINE` is false for
  this release (section 6's last rule: the templates ship a release before any shelf, pile, foe or recipe carries
  them); offline the shelves and the piles carry them with Climates & Calories.
- **AUDIT REST** (2026-10-03, an independent pass over REST1-REST6; `test/auditrest.test.js`, `tools/mutants/auditrest.json`).
  Fixed: a Campfire left standing in a dungeon was lost at the exit - the dungeon keeps nothing of mine, so it now comes
  back into the pack with its fuel (`camps.js` packOwnFires; an Ember Jar's goes with the dungeon); the Draught makes
  only a ROUGH night a bed's (a fire or a tent prices as one already, and a tent's fire stays tended) and is spent by
  any rest of an hour under it (an offline nap had kept it for ever); a lit Candle is the pack's (sold, dropped or a
  load since, no kneel - and no other copy spent); an offline loiter of six hours spent a night of fuel - a loiter is
  no night; an older build stamps `restStartedAt` when its rest window OPENS, which would have carried newer members
  into a whole night - a night's stamp now carries a mark (the second's 777th millisecond, restAct.js nightStamp) an
  older build's open meets one time in a thousand [AUDIT REST-PARTY P2: three marks now, one a rest kind - three times
  in a thousand]; a worn-through tent no longer stokes or stands as a fire; the Salts
  read the sleep stage (a Rested debt refused them); the laid Bedroll follows a recentre and the pack (a load leaves
  no phantom); an old save's kit fire (no fuel of its own: `camp.fuel` marks a Campfire) burns away as it always did;
  the dungeon fires compare squared distances in plain arithmetic (Math.hypot's last bit differs between engines, and a
  tie must be the same tie on every client) and stand in no palace's block; the words - "Rest with my party", /ready
  online, the Online pane, an Ember Jar's last night, the patch notes. Kept, as readings: a guild hall's rest is a
  rough night with Climates & Calories (SURV4's own law; 2.1's table listed it under Bed - the notes now say so); a
  quest box raised during a night no longer pauses it (the night is one step; the box waits at the wake, over the
  rest window's own). Not verifiable here: the fires on the real dungeons (no ARENA2 in this container -
  `tools/dungeonFireProbe.mjs` reports them) and a spot on a room's roof between storeys (the collider's rays are
  two-sided; the ceiling and wall rays are the guard).
- **AUDIT REST-PARTY** (2026-10-03, the arc audited again with the party rest adapted to the night - four lenses: the
  act and the ambush, the Campfire and the supplies, the dungeon fires, the quest waits; the party by hand.
  `test/auditrestparty.test.js`, `auditrestparty_camps.test.js`, `auditrestparty_quests.test.js`,
  `auditrestparty_fires.test.js`; `tools/mutants/auditrestparty*.json`, every mutant dead).
  - **The party's night** (2.6), its decision lifted into `src/systems/partyRestLaw.js` (`nightMoved`,
    `carriedNightAction`, `carriedRestKind`) and run on a table - REST5 had pinned it by regexes alone. P1: it carried
    members in a tavern, temple or guild hall, where TAVERN-REST1/GUILD-REST1 had taken the party's rest out (indoors
    "near" is the building, so one member's rented bed slept everyone in the house, a room's night spent or a bed got
    free) - nobody is carried there now. P2: a carried member slept their OWN spot, and a fire's reach is 4 m where the
    party's is 15, so a mate at 5 m woke "You slept poorly" in Casual (the default) and at 17 of 60 and stiff in Hard
    beside a rester who woke full - PARTY-REST4's per-request ("party member MUST heal their health near the leader")
    undone. The night's stamp now says where it was slept (`restAct.js` `PARTY_NIGHT_MARKS`: one millisecond mark a
    rest kind, read off the open - an older build's window open lands on one three times in a thousand; still no relay
    bump), and a carried member sleeps the better of it and their own (`carriedRestKind`; a Sleeping Draught is its
    drinker's, never the party's). P3: a dead member was told they slept. P4: PARTY-REST-FAR1's word comes back online -
    a mate who rests a night in the same place beyond 15 m is said once ("Ada rested a night without you - come within 15
    m of them to rest with the party."). P5: the vote's tally no longer counts online, where there is no vote.
  - **The ambush (REST4) never broke a night online - A1, the arc's worst.** Every host stands its resting encounter
    asynchronously (its art awaited), and the night ran as one synchronous call, so no foe joined a pool inside it: a
    night a hit rolled (a wilderness night about 85% of the time, a dungeon with the alert up two in three) was slept to
    its end - healed whole, stamped, the party carried - with the foe arriving after the wake, and every later sub-tick
    rolled again (two foes standing at the wake on average). "As built"'s "the break landing at the hour it falls" was
    true only of the tests, which flipped `enemiesNearby` by hand. A host now says so the moment the spot is found
    (`restAct.js` `ambushNight`, the session's own OnEncounter latch - DFU's AbortRestForEnemySpawn), and the night is
    ticked a sub-tick a call, so it breaks with "enemies nearby" at the sub-tick the hit fell in, its hours counted,
    nothing more rolled, nobody carried. A2: a quest's CreateFoe inside the night reaches it too (both windows). A3: a
    pressed bed outdoors (a ship's) is priced as the bed it is named. A4: a room that runs out mid-night is no whole
    night - no top-up, no fuel, nobody carried. A5: the channel held to its end asks the point again: a fire, tent or
    Bedroll gone, or a blow taken while holding, interrupts ("Your rest is interrupted."); a night that came due while
    holding is a night. Kept, as readings: a broken night still stamps the interval it slept into; the dungeon's own
    `_restAdvance` is not retired (section 7's last paragraph) - the night walks it through that host's advance, which
    runs every census row; the world tick's day blocks catch up on the frame after the wake.
  - **The Campfire and the supplies.** B1: a load out of a dungeon packed my standing Campfire into the pack the save
    had just restored - a second Campfire on every quickload; a load drops it now (the save stands its own), a leave or
    a teleport still packs it. B2: offline a night moves the world's minutes, so my Campfire burned out under its
    sleeper and spent no charge (the fuel was free offline) - it is tended through a camp night as a tent is. B3: my fire
    is put away BEFORE the room's memory is published (it stood in the dungeon for every later joiner), and a peer's cold
    fire whose owner has left the room is swept each frame. B4: customs carried REST6's supplies into the realm, usable -
    customs keeps them with the offline character now and says so, and online none is used while
    `REST_ITEMS_ONLINE` is off. B5: an old save's kit fire (no fuel of its own) offered "Pick up" and minted a Campfire
    from nothing - it is stamped out, as before REST; Firewood feeds a kit to its own maximum (an old five-use kit read
    160%). B6: the Waking Salts one hour at a time (three taken at once held three hours and landed one hour's debt).
    B7: the hotbar's Campfire is one with fuel.
  - **The dungeon fires.** C1: the 15 m ward is online's alone - offline the rest is DFU's, ambushes and all (OPEN 8).
    C2: an entrance fire stands 25 m clear of the layout's own fires, and one nearer the door than any candidate is the
    entrance's; C5: and it counts toward N (an elite with a brazier at its door places none of its own). C3: 4.2's
    "no stairs, no ramps" is kept now - `ny` 0.99 and eight samples 0.5 m out within 5 cm (a stair tread is flat). C4:
    the floor ray reads every bucket and keeps a spot only over the dungeon's own mesh (a lift over a shaft put its fire
    in the pit). C6: `tools/dungeonFireProbe.mjs` reads the doors and the fires as the host does
    (`dungeonFires.js` `fireLayoutInputs`, the host's own call). C7: the law read a hearth's foot off `billboardSize`,
    which applies a texture mod's XML scale - a modded client could stand other fires; it reads the classic record's
    (`lawFoot`). Not verifiable here, as before: the real dungeons (the
    5 cm tolerance on a cave's floor is the probe's question - run it with ARENA2_PATH).
  - **The quest waits.** D1: B0B81Y02's `_S.30_` - the artifact hunt, task-started by the lich's map before the
    knight's reward - read as a closing once the quest was a success, so online the hunt ended two minutes after the
    reward; `ONLINE_DEADLINES` holds it. D2: N0B00Y17's `_time2_` (the scholar's "Please be prompt") and K0C30Y03's
    `_S.13_` (the guard's lead) are deadlines the script reading calls delays, R1's class: 266 deadlines and 133 delays
    now. D3: `declaredAtOnce` rides the save (S0000106's delay read as a deadline after a load). D4: the exemption that
    keeps a table entry from closing on success is pinned.
  - **The type check was red** (`npm run types`, which the deploy runs): two `{}`-defaulted use-handler contexts and the
    Rested tile's input undeclared.
  - **The mutation run** (every campaign on a file the arc changed, 4,575 records). SURVTIERS3's kit-fire mutant lived -
    no test rested beside B5's unfuelled fire; pinned. REST6's Bedroll had copied CAMP-GROUND's probe into `layBedroll`,
    and the copy kept CAMP-GROUND's text pins green while the camp's own probe broke (`probe-back-to-buckets-only`,
    `probe-loses-its-fallback`: dead on main, alive on the arc) - the probe is one home now, `camps.js` `groundProbe`,
    its two callers counted. REST2's online-Campfire `else` left AUDITSURV's chargen-provisions mutant unparseable;
    re-aimed. Eight more live on main as well (AUDIT-REALM-L1F3's three, PROF4's two, PROF11, QS4, SURVART-4): not the
    arc's.
- **AUDIT REST II** (2026-10-03, Mac: "After this lets do a comprehensive audit. This needs to be perfection" - eight
  lenses over the whole pull request: the act and the night, the party's night, the Campfire and the supplies, the
  dungeon fires, the quest clocks, the four hosts and the frame, what the player is told, the merges and the tests;
  every finding verified before it was fixed, each fix pinned red first and mutation-proven: `test/auditrest2_camps.test.js`,
  `auditrest2_party.test.js`, `auditrest2_quests.test.js`, `auditrest2_fires.test.js`; `tools/mutants/auditrest2_*.json`).
  - **The Campfire's lifecycle (H).** H1, AUDIT REST-PARTY B1's own regression: a Recall or an anchor teleport out of a
    dungeon passes `cacheScene` false (a dungeon caches nothing, Teleport.cs), as the load does, so B1's load arm
    dropped the standing Campfire - gone for good; the load says so itself now (`forceExitToExterior`'s `load`), and a
    dropped fire is told to the room. H2: a building's hearth's "Rest here" did nothing online and opened the cooking
    list offline - the interior pool rests, and its click carries the plaque's lit row, as the other hosts'. H3: B2 was
    not fixed underground - the dungeon's frame is held under the rest window, so its tick never tended my fire, and
    offline a dungeon night was free; the rest's own advance tends it (`camps.tend`). H4: "You take your Campfire with
    you." was said into the dungeon's HUD as it was torn down - said on the HUD that is up once outside. H5: an online
    logoff underground (the 2-minute checkpoint, the tab closed) woke at a temple and the placed Campfire was lost; a
    load that does not enter the dungeon carries the save's fires out (`survival/camp.js` packSavedFires). H6: a dungeon
    save carried none of the camps standing outside - a quickload duplicated a Campfire placed after the save, a fresh
    page lost them; the save carries them (`world.outerCamps`) and every dungeon load stands the save's (the same
    dungeon's own load since AUDIT REST III A1). H7: any repair counter refilled a Campfire's eight nights for less than
    one Firewood - the Campfire, the Bedroll, the Candle and the Salts are `isNotRepairable`. H8: a General Store
    stocked two to four Campfires on EVERY shelf model (sixteen in a store of four) - the counter's shelf alone (with
    Climates & Calories each shelf still draws the count, so its later draws stay put; online with the arc off only the
    counter draws one, as offline). H9: customs missed a supply left with a repairer. H10: a Candle lit from the wagon
    said "lit" and never knelt - refused with words. H11: Firewood picked a full old five-use kit before a Campfire with
    room. H12: online a cold camp offered a Rest that refused with the wrong words - it goes, and Relight or Stoke
    leads. H13: "Campfire" as the item names it; Firewood's card; "rest supplies"; an Ember Jar's fire hovers as itself.
    H14: no offline shelf sells the Bedroll (online's rest point - offline every rest is DFU's). H15: the Salts' hold on
    the exhausted drain pinned by behaviour (the source pin's clause was optional).
  - **The party's night and the act (P).** P1: nothing limited how often one mate's stamp carried the party - any marked
    stamp that differed from the last seen, inside the 30 s window, was a night (the relay bounds the field from below
    alone), so a forged pose slept every mate in reach once a second, a forged bed mark healing a Hard character whole
    on bare ground; `partyRestLaw.js` createNightWatch keeps each member's high-water mark and answers a move over it at
    most once a PARTY_NIGHT_GAP_MS (a minute), the far and busy lines included - and inside it a night my own clock owes
    me (AUDIT REST III C1: a journey or training makes the next night due at once). P2: a connection blip carried one
    night twice - a missing pose neither sets nor lowers the mark, and a mate who left is forgotten (`keep`). P3: a
    carried night cut by a prevent-rest condition said "through the night" - `restAct.js` carriedNightEnd/nightWhole
    (every rest that ran raises, as the rester's window does: AUDIT REST III C3; and no carried night meets a room's
    end: C2); and every host's encounter route calls ambushNight() first, so a quest's CreateFoe reaches a carried night
    and one under a quest box (A2's gap). P4: a member inside town limits was carried into a night there - 'town', the
    act's own law, with its own line. P5: the mark is read only off a moved stamp, through a frozen key array. P6: rooms
    count nights (`tavern.js` rentRoom's `nights`, an extension's added; `spendRoomNight` spends one, the last ends the
    room; an old save's room reads ceil(hours / 24) once) - three days with an hour of play between nights had given
    two; the days lived still lapse it. P7: a foe stood in the night's LAST sub-tick still gave a whole night -
    runRestNight reads the latch after its loop. P8: the hold is broken the moment it is hurt, a foe is in reach or the
    latch is set (`channelBroken`, both skins), never only at its end. P9: the death pin was a copy's (PARTY-REST-FAR1's
    line) - it reads carryPartyNight's own body.
  - **The quest clocks (Q).** THE RULE (decided): a clock the quest's own text presents as a time limit is a deadline,
    kept at its days of played time online; a clock that only makes the player wait is a delay. Q1: R0C11Y03's
    `_2ndparton_`, AUDIT TIMEFREE's one hand closing, was the time to come back for the reward after a correct delivery
    - cut to the short wait, "The Heartless Daedra" failed (-30, unpaid) two minutes after the heart was delivered; the
    reading calls it a deadline, and `ONLINE_CLOSINGS` is retired with its entry. Q2: S0000011's chapter ("Time is of
    the essence") and O0B00Y12's drop ("as soon as possible") are deadlines by hand; the corpus swept once (47 clocks,
    every verdict pinned; 49 with AUDIT REST III D2's two) - 269 deadlines, 130 delays (271 and 128 after D2), the main
    quest's 32. Q3: bounties held through TIMEFREE's never-lapse lapsed on the first tick after the update - the ledger
    saves a version, and an older ledger's rows run from now, once, online. Q4: no text says a deadline "stays frozen".
    Q5: the `actions.js` cites, off by one, corrected by content.
  - **The dungeon fires (F).** F1: a joiner's rest asked the host for an encounter its 15 m ward then refused at
    every spot (a 20 m fire room refused 2000 of 2000), and the night broke for nothing - the joiner runs the host's own
    placement (`dungeonContext.js` encounterSpot) and asks only where a spot stands outside the ward; a sent ask breaks
    a running night at its next sub-tick (ambushNight). F2: a palace stands no fire (any castle block - layoutFireCount).
    F3: no fire within 1.5 m of a start, enter, treasure, quest or fixed-treasure marker - a marker's fire stands on the
    first spot of a fixed ring 2 m out that keeps every rule. F4: a floor looks up - the collider says when a ray struck
    a face's back (`raycastHit` `back`; its face normal is the world pass's wound normal, which the game draws only
    facing the eye), so a room's roof between storeys is no floor; and a second level ring 1.4 m out, so a tabletop,
    plinth or ledge is no hearth. F5: the layout brazier taken for the entrance's fire carries the ward, the compass's
    mark and the map's (`dungeonFirePlan` doorFire). F6: the probe tool reads patchSeams'd models. F7: an exit door is
    measured from its face's centre. F8: the drowned abyss puts the placed fires out with the light fixtures. F9: the
    cold-fire sweep reads the room at most once a second, and only while a peer's camp stands. The room's chest rays are
    literals now (no Math.sin/cos). And the merge of main's #545: no fire on the Arena's sand (a made level, its rest
    refused). Not verifiable here: the real dungeons (the probe, with ARENA2_PATH).
  - **The tests and the merges (L8).** The time3_quests row had lost QCLOCK-WORLD's sentence in the first merge of main
    and said the opposite of its suite (restored); two survtiers3 records' provenance notes (restored); a struck
    renderer cite moved with no cause (main's again); the Field Cook's jar mutant, killed only by a record the game never
    writes (equivalent, its test's jar the real shape); Testing.md's counts and REST2's re-aims.
  - **What the player is told (L7).** The patch notes, rewritten against the code sentence by sentence: the Bedroll and
    the other supplies arrive online later (and offline the Bedroll is not sold); the offline changes named (the
    Campfire's 40, a tent's wear by the night, a ship's bed as a bed); rooms count nights; a quest day of two real hours
    beside the sky's one; the curse and guild quests' short wait already live; PLAIN-LOOT and NEED-TIER, which this
    branch carries and no note announced, have their own section.
  - **Left open, said:** a forged pose can still be answered once a minute (a short rest, to a forger's own mates) - and
    with a night whenever a mate's own interval lapses, as before P1, which caps the answers, not the nights (AUDIT REST
    III C4); the room's words still quote hours (tavern windows); the punishment daedra of 40C00Y00 `_S.22_` stay a
    delay (no limit in its text) where the cure quests' hunters are deadlines by hand - THE RULE read literally.
- **AUDIT REST III** (2026-10-03, Mac: "Audit this and ensure its perfection" - six fresh lenses over every AUDIT REST II
  fix: the Campfire's lifecycle, the supplies and the shops, the party's night and the act, the quest clocks, the
  dungeon fires, and what the player and the next developer are told; every finding verified before it was fixed, each
  fix pinned and mutation-proven: `test/auditrest3.test.js`, the E1, C6 and B1 pins in the files whose harness they
  ride (`auditrest2_fires`, `auditrest2_party`, `auditrest2_camps`); `tools/mutants/auditrest3.json`).
  - **Found and fixed.** E1 (medium): F1's joiner ran encounterSpot and the host ran it again - two trials of the same
    dice, so in a fire room 24-30 m across the joiner asked where the host stood nothing (its night broken for nothing,
    F1 again by chance) and kept quiet where the host would have stood one; the ask carries the joiner's spot (`rs.s` -
    the relay passes an act's data whole, no relay change) and the host stands its foe there, held to what the
    placement asks of a spot (`askedSpotStands`: the band, no wall between, a floor, open space, the ward), searching
    for itself where it fails; the joiner mirrors the host's gap. A1 (medium): H6 covered the world host's dungeon load
    alone - the same dungeon's own load (F9 underground, `dungeonContext` quickLoad) never stood the save's camps
    outside, so offline the duplicate and the loss were whole there; one home (`world.js` standSavedOuterCamps, the
    `outerCampsLoad` seam). B1 (medium): H8's "the draw is still taken" pin was blind - at quality 10 no draw follows
    the fires count, and its mutant survived; the pin counts the draws. D1: a held bounty's `takenAt` (and `paidAt`)
    did not move with the lane, so Bring online lapsed every bounty a ledger of this build held - `offlineCopy.js`
    rebaseWorldStamps moves them, both doors. C1: P1's gap read honest nights as ten minutes apart, and a journey,
    training or a RaiseTime makes the next one due at once - a night my clock owes me is answered inside the minute.
    C3: P3 took the skill raise from a carried night cut short; closing a rest raises on every one of EndRest's arms
    (the rester's window does), so every carried rest that ran raises. C6: the hold asked the rest point only at its
    end - it asks while held (`channelBroken`'s `restActNow`), so a fire gone out breaks it at once, as the notes say.
    B2: customs missed a supply standing as the owner's own decor (DECOR2a `decorOwn`) - it and its piece stay
    offline. B3: Firewood took the first of my Campfires in reach, full or not - the emptiest with room. B4: the "rest
    supplies" line counted a cached shop shelf, a loot pile and a dead foe - said of the character's own now. A2: a
    friend's cold tent offered a Stoke that its owner's next frame undid - a tent's Stoke is its owner's. A3: online my
    own cold tent lost its Rest, which stokes it first - kept, after Stoke. E4: the abyss put out the placed fires and
    left the layout's braziers (the adopted entrance one among them) as flameless fires - each hearth row names its
    flat, and every one whose flame is a fixture goes. E2: the collider kept a mirrored placement's winding where the
    world pass turns it back (WOD5) - latent, now as drawn. D2: two dead clocks whose text sets a limit
    (K0C00Y07's ransom, B0B71Y03's daughter) read "a few days" online - by hand, 271 deadlines and 128 delays.
  - **The record and the tests.** C2: nightWhole's room's-end arm could not be reached (a carried night has no room)
    and its mutant died only to an impossible row - gone. E3: F8's "any removal" mutant likewise - retired with the
    rewrite. B5: an Ember Jar's fire said "You see your Campfire."; B7: a dead string. D6: a cite one line off. F12:
    test titles named mutants no record holds. F4: the F1 harness's placement dice are seeded (Math.random flaked about
    one run in 700). F8: H12's lane pinned by behaviour. The AUDIT REST II record above corrected in place (H6, H8, P1,
    P3, Q2's 47 and the left-open nights - C4); section 8's retired table and its counts narrowed (F9). The patch notes
    (in the pull request): a failed quest's own penalty (F2), "the last update" named (F5), an online Campfire's last
    night (F6), the offline shelves and the offline carry-out (F7), rooms (C5).
  - **Not this pull request's:** the mutation run over every record on the 23 files AUDIT REST II changed in code
    (3,982) left six survivors and one stale equivalent that do the same on main (`ACC1d-14`, `AUDIT-DISC28-MO2`,
    `ONESEAT-hidden-tab-lingers`, `PERF-ON2`, `world-peer-gate-still-skips`, `WB3b-the-omen-deaf-to-the-kill`;
    `AUDITCLIMB2-G1` dies), beside the known `AUDIT29-A17`.
  - **Left open, said:** R0C11Y03's journal counts down the delivery's `_1stparton_` after the heart is delivered (its
    only reader can no longer fire) - early, never late (D5).
- **REST-SLEEP1** (2026-10-04, from play: *"Seems like if you have to wait for night to pass you cannot rest again to
  remove the tiredness/drowsy debuffs until the time passes"*). A short rest paid nothing of the sleep need (2.4's row),
  and the need has no other payer (section 7, row 9) - so a night that left its sleeper Tired or Drowsy held them there,
  at the fire, for the whole ten real minutes: a foe's break in the night's first hour (a wilderness night is broken
  more often than not, and a broken night still stamps the interval - AUDIT REST-PARTY's reading), a rough night's third
  of a bed's rate, or a debt past the twelve hours a night pays (Exhausted at the cap wakes Exhausted). A short rest now
  pays the debt as a night of its kind would - its 480 minutes at the kind's rate, a bed's or a fire's twelve hours, the
  ground's four, Hard's rough floor kept - and still moves no clock: nothing ages, nothing rolls, no fuel is spent, no
  night is stamped. ONE PAY: the minute law's sleeping branch is lifted into `survival/needs.js` `paySleep` (a minute
  through it is the same arithmetic as before, bit for bit), and the short rest pays through it
  (`src/systems/restAct.js` `sleepShortRest`, called by createRestDeps' `restShort`, so both skins and the party's
  carried short rest take it). With the arc off there is no need to pay, and a vampire has none (the minute law freezes
  the debt). `test/restsleep1_shortrest.test.js`, `tools/mutants/restsleep1.json` (11, all dead); SURV1's and AUDIT
  SURV's floor records re-aimed by content to the lifted lines.
- **CAMP-ROLL** (2026-10-04, from play: *"In a party, or with other players. Every player spawns their own enemies when
  resting. What's a detailed way to handle this?"*, then *"Do it"*). 2.6 carried a member who stood by, but a member who
  pressed Rest themselves was "busy" and slept a night of their own: REST5 retired the vote that had let one real rest
  run at a time, so a party at one fire opened an act each, and each act's night rolled its own ambush (a rest is its
  rester's own roll - AUDIT PSCALE1 COUNT-1), each hit standing a pack already sized for the party (`partyExtraFoes`).
  Four sleepers, up to four party-sized packs; underground, one host ask a sleeper (REST-SYNC). Now **the act's night is
  the camp's.** The members resting with the party within its 15 m whose acts open on a night say so on the pose -
  `restStartedAt` with a camp mark (`src/systems/restAct.js` CAMP_MARKS: `open` 774 and `done` 773, beside the nights'
  775-777, never read as a night) and `rs` - and every client elects the same one roller with no message of its own:
  the lowest account id among them (`src/systems/partyRestLaw.js` createCampWatch). The roller's night is DFU's, rolled
  once at the odds it always had. Every other member's channel ends in a wait, "Resting with Ada..." (both skins; Esc
  or Stop ends it with nothing slept), which ends when the roller's night lands (slept as theirs through the bag's one
  carried-night sequence, `src/scenes/shared.js` createRestDeps `restCampNight`: their spot or mine, whichever is
  better, its rolls quiet - `encounters.js` quietNights), when their ambush breaks it (`restEnemyAt` moved: the same
  foes, the same break, and mine said on so the next waiter hears it), when a foe, a blow or the point gone breaks my
  own hold (the channel's own end check), when the roller leaves (their `done` mark, or `rs` dropped: the next lowest
  rolls), or after CAMP_WAIT_MS (15 s) - my own roll, today's behaviour, the fail-open. The open is the baseline, so a
  camp mate's night that lands while I still hold the channel is mine to sleep. A night heard is never overwritten by
  `done` (`settle` asks for the open mark first), and the party's carry loop says nothing of a night my window is
  watching. The ambush a resting roller stands outdoors keeps its band (minDistance) from every camp mate's feet as DFU
  keeps it from mine, where the ground allows - else DFU's own placement, so the odds stay DFU's (`world.js`
  `_standEncounterFoe` through partyRestLaw.js `campPasses`); underground the arm keeps DFU's flag-false placement
  (PlayerEntity.cs:610 - a foe may stand over a sleeper), and the roller's ask is the camp's one. THE FOUR HOSTS: the
  outdoor host (`world.js` outdoorRestDeps) and the dungeon (`dungeonContext.js`, forwarded through `worldModes.js`)
  carry the camp (createRestDeps `camp`); a building rolls nothing (encounters.js: inside, no dungeon), so worldModes'
  interior bag carries none; the `?exterior` dev host (`exterior.js`) has no party. NOT DONE, and why: strangers, and
  members resting alone, at one fire still each roll - a stranger's stamps ride no pose I can read (the party pose goes
  to the party alone), and a member who chose to rest alone chose their own night. No relay change (the marks are
  values of a field the pose carries). `test/camproll.test.js` (11), `tools/mutants/camproll.json` (32, all dead); the
  carried night's pins moved to the bag's sequence (`rest5_partynight`, `auditrestparty`, their mutants re-aimed by
  content), RESTFIX1's and REST6's window pins re-aimed, AUDIT REST III's C6 records aimed at the channel's own line,
  and AUDIT OW5b E1's stander scope given the two new names.
- **REST7 - crafting: NOT BUILT, deliberately.** The recipes are a source like the shelves, so they could not open
  before `REST_ITEMS_ONLINE` does; adding them now changes the account service's bundle (an `acct` bump) for rows that
  stay shut. They ride the release that turns the switch on, with the shelves.
- **DECK-CAMP (2026-10-04, from the field: "Campfires placed on a boat dont attach to a boat")** - a Campfire or a tent
  placed on a boat's deck rides her. Come Sail Away's boats stand in the world's collider, so the placing's probe found
  her deck - and the camp kept the scene point it was stood at as she sailed on. Now the host reads the boat under the
  spot off the collider's surface probe (`world.js campDeckAt`: her bucket; mine by her number, another player's by
  theirs and hers; a sea ship or a boat with no number takes none) and the record carries `deck` - which boat, the point
  in her deck's frame (`navalDeck.js intoDeck`, the swell's roll and pitch with it) and the heading on her
  (`survival/camp.js validDeck`). Each exterior frame, after the boats move and before the lights and the world pass,
  the pool poses every deck camp off her (`scenes/camps.js ride`): its point, its heading, the flame's batch (built
  about its foot, moved by its origin - never rebuilt), its light, its box and its tent (laid by her rotation alone,
  never her model's scale). Out of sight (Come Sail Away hides her past a pixel and indoors), or while a load's boats
  are still standing, it is hidden with her and kept. Once she is GONE - mine packed, laid up or purged with the boats
  settled (`campDeckResolve`: no load, no restore pending), another player's no longer in her owner's word or her owner
  gone - a camp of mine is struck after DECK_GONE_S (2 s) and its gear packed back with its charges ("Your camp aboard
  was struck and stowed in your pack."); a peer's waits on its owner's word. The save keeps the address (a restored camp
  waits hidden for her), the streaming sweep never takes a deck's camp (no pixel), a floating-origin move moves its
  flame, and the wire says `d` - [her owner ('' the sender's own), her number, the point, the heading] - read back from
  where each player stands (`campFromWire`: the sender's own boat is that peer's, one named by my id mine); a peer's
  word that only moves her keeps its camp standing. A camp on a deck is a fire to rest at and cook by like any other.
  THE FOUR HOSTS: `scenes/world.js` hands the boats; a building (`worldModes.js`) and a dungeon (`dungeonContext.js`)
  stand no boat of the camps', the standalone street (`exterior.js`) no Come Sail Away. `test/deckcamp.test.js`,
  `tools/mutants/deckcamp.json` (20, all dead).

## Record

- 2026-10-02: proposed (this page). Built on QCLOCK-WORLD (`Online-Time-Arc.md` 6.3c) and its audit's measure of the
  waits; it supersedes nothing yet.
- 2026-10-03: REST8 - quest waits, option A (section 8's as-built note; `Online-Time-Arc.md` 6.3d): TIMEFREE's delay
  half restored on QCLOCK-WORLD's clock, its deadlines left on played time; R1, two misread deadlines corrected.
- 2026-10-03: BUILT (Mac: "Go"). REST1 + REST2, REST3, REST5, REST6 and REST8 committed in that order, origin/main
  merged in; REST7 deferred with the online switch (As built). The patch notes ride the pull request's description
  (REL6), "Patch notes: Resting at rest points".
- 2026-10-03: AUDIT REST-PARTY (As built): the party rest adapted to the night (the tavern's exemption, the rester's
  spot, the far word), the ambush that never broke a night online, and every lens's findings fixed, pinned and
  mutation-proven.
- 2026-10-03: origin/main merged in (#541 PROF9 Cooking, PROF10 Jewelcrafting, PROF12 Alchemy; #546 ELITE-RATES; #547
  SILVER-WAYS and PROF2b; #548 REL6 - this arc's two patch-notes files leave the tree for the pull request), its cites by
  citeMerge and the struck rows by content. One real overlap: PROF9's Field Cook lights a Campfire Kit without its
  charge (survival/camp.js placeCampItem `keep`), and REST2 spends no charge on any placing - the option is accepted
  and changes nothing, PROF9's two mutants on it are retired and its pin re-aimed; **the perk needs a new meaning
  (Mac's call)** - e.g. a Field Cook's Firewood feeds four nights, or a night at their own Campfire spends none one
  time in three. [DECIDED below, the same day: a night at their own Campfire spends none, every night.]
- 2026-10-03: origin/main merged in (#553 REL7, #550 HAUL-CARDS - its silver pin, read by what each claim was paid,
  is the full suite's load flake this branch's gate met). The mutation run's three arc-blinded mutants fixed (AUDIT
  REST-PARTY, "The mutation run").
- 2026-10-03: origin/main merged in (#551 FIELD BUGS 2026-10-03, #555 REL7): 166 conflicting hunks were cites alone
  (main's side taken, citeMerge, the struck rows by content); two were real - `quest/clock.js`, where main's
  BODYGUARD-CLOSE (`closesStartUp`, a start-up closing closes on the short wait once paid) sits beside REST8's
  `ONLINE_DEADLINES` exemption in `isDeadline`, both kept. Its pin assumed TIMEFREE's frozen deadline (a hundred unpaid
  hours online leave The Bodyguard open); with REST8 a deadline runs on the world's clock, so the unpaid `_timer_` runs
  out after its day and three hours, as DFU's - the pin now steps twenty unpaid hours, and pins that run-out too.
- 2026-10-03: THE FIELD COOK GIVEN AGAIN (Mac: "Do whatever you think fits best"). DECIDED: the faithful carry - PROF9
  made a Campfire Kit's lighting free, and REST2 moved that charge from the lighting to the night, so **a Field Cook's
  night at their own Campfire spends no fuel** (`survival/camp.js` fieldCookKeeps and spendCampNight's `fieldCook`,
  `scenes/camps.js` spendNightNear). A Campfire's alone: an Ember Jar's one night and a tent's wear spend as ever (a
  tent wore under PROF9 too), and an old save's kit fire has no fuel of its own to keep. One kit, every night - what a
  Field Cook had before REST. No relay or account-service change: the service validates the spec's id, and its
  description is the client's (`net/professionLaw.js`, "A night at your own Campfire spends no fuel."). The dead
  `keep` option leaves placeCampItem. Pinned in `test/prof9_client.test.js` (the law and the pool), seven mutants dead.
- 2026-10-03: AUDIT REST II (As built, "AUDIT REST II"): eight lenses, every finding verified and fixed, pinned red
  first and mutation-proven - the Campfire's lifecycle (H1-H15), the party's night and the act (P1-P9), the quest
  clocks (Q1-Q5, THE RULE), the dungeon fires (F1-F9), the tests and merges, and what the player is told.
- 2026-10-03: origin/main merged in (#545 the Arena of Daggerfall and Beautiful Villages and Cities): 293 hunks cites
  alone, nine by hand keeping both sides; one interplay closed - no dungeon fire on the Arena's sand.
- 2026-10-03: origin/main merged in (#559 HOTFIX 1003, the live login crash): 62 hunks, line-number cites alone.
- 2026-10-03: AUDIT REST III (As built, "AUDIT REST III"): six fresh lenses over every AUDIT REST II fix - three
  medium findings (the joiner's encounter one trial, not two; the same dungeon's own load and the camps outside; a
  blind draw pin) and fourteen more fixed, pinned and mutation-proven; the AUDIT REST II record and the patch notes
  corrected.
- 2026-10-04: REST-SLEEP1 (As built, from play): a short rest pays the sleep need as a night of its kind pays it -
  Tired or Drowsy no longer waits out the night interval at the fire; still no clock moved.
- 2026-10-04: CAMP-ROLL (As built, from play): one ambush roll a camp - members who press Rest together elect one
  roller off the pose, and the others wait on its night and sleep it, or break with its ambush.
