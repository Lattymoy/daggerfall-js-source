# Wagon upkeep (WAGONS4, 2026-10-11)

The owner: "Wagons have durability and require upkeep to keep from breaking down and becoming unusable." Horses are
`06-Systems/Horse-Care.md` (STEED1); this page is the wagon - every kind (`06-Systems/Wagons.md`: the Small Cart, the
Open Wagon and the Caravan).

A departure of the port's own, the enhanced lane's alone: Features, World tab, Travel - **Wagon upkeep**, the
`wagonUpkeep` pref - three tiers since WAGON-TIERS (below): Off, Boons (the default) and Hard, each player's own online.
Off, a wagon is DFU's plain wagon: it never wears.

WAGON-MEND (2026-10-12, the owner: "wagons shouldnt entirely break down to become unusable"): no wagon is ever broken.
WAGONS4 shipped a fifth state, Broken at nought, which no team pulled - refused at every door a short team is, the
classic cart's driver put afoot beside it. It is retired: wear stops at a wagon's last point (`wagonUpkeep.js`
WEAR_FLOOR), Failing is the floor, and a wagon a save holds at nought from before is Failing too. The hosts' `teamShort`
is WAGONS3's short team alone again, and the classic Transport window's Cart row and a journey's fare read the cart as
DFU does.

## The tiers (WAGON-TIERS, 2026-10-15)

> Mac: *"Yes, same tiers"* - wagon upkeep on horse care's model (`06-Systems/Horse-Care.md`, The tiers), which is
> Climates & Calories' (`06-Systems/Climates-Calories.md` SURV-TIERS, SURV-BOONS, BOONS-DEFAULT).

**One key, three answers**, on wagon upkeep's own key, the tiers written out as data beside horse care's in
`systems/upkeep/upkeepTiers.js` (the import-free leaf both switches' tiers live in):

| Tier | Stored (the `wagonUpkeep` pref) | What the wagon pays |
|---|---|---|
| Off | `false` - the old switch's own | nothing: it is DFU's plain wagon - it never wears, rolls at its team's pace, and a counter buys it whole |
| Boons - the default | nothing (PREF1: a default is never stored) | nothing: never worse than DFU's plain wagon - and a Sound one rolls faster |
| Hard | `'hard'` | the system as WAGONS4 and WAGON-MEND built it - everything below this section, as it stood |

Boons' rules, each a field of `WAGON_UPKEEP_RULES` because the tiers differ on it:

1. **Same world.** The wear (the road, a journey, the watch's throw), the condition, the four states and their words,
   the Wagon Yard's Mend and the kit are the world's in both tiers - a Boons wagon worn to Failing is Failing, and the
   yard and the kit make it whole as on Hard.
2. **Nothing is ever taken.** A Rickety or Failing wagon rolls at DFU's pace (`wearSlows`: `wagonUpkeep.js` wagonPace
   is never under 1 on Boons), and a counter buys it as a whole wagon (`wearPrices`: `wagonUpkeep.js` wagonSoldWhole, read
   by `systems/tradeModes.js` saleConditionPercentage - on Hard Roleplay & Realism: Items' conditionCostBase prices it
   by its condition, a Caravan at its last point a fifth of a whole one's price). Off sells it whole too: DFU's wagon
   never wore. A team's own drag under a load is horse care's (Strength, `teamDraftScale` - none on its Boons).
3. **A wagon kept earns.** Mac, 2026-10-15: *"Sound wagon rolls faster"* - DECIDED. On Boons a Sound wagon (60% of
   whole and up, so a kit's 60% keeps it) rolls at 1.10 times DFU's pace (`upkeepTiers.js` WAGON_SOUND_BOON, the rules'
   `soundPace`, read by `wagonUpkeep.js` wagonPace through the one accessor); Worn, Rickety and Failing roll at DFU's.
   Hard and Off are unchanged (a Sound wagon at its team's pace). The boon composes as every ride pace does: the
   runtime multiplies it with the team's own pace under its load (horse care's Strength, `upkeepRuntime.js`
   rideScale), and the hosts hand the product to the motor (`player.rideSpeedScale`) - the Overworld's and the
   journeys' host, `scenes/world.js`, as every other - so it is the ride's speed wherever the wagon is driven; a fast
   travel's days read no ride pace, this one's as none before it. The Stable page says it: "Sound - it rolls faster
   for it."
4. **No red** (RED MEANS IT COSTS). Where wear costs nothing a failing wagon's chip on the saddle panel stops at amber
   (`ui/enhanced/enhancedSaddle.js`), its bar on the Stable page is rickety's plain (`ui/holdingsPages.js` wagonMeterTone), the
   panel says no pace to get back, the Stable page says "Rickety - it still rolls at its pace." and "Failing - it
   still rolls at its pace.", and a step down is said without the slowness: "Your Small Cart is rickety. A Wagon Yard
   can mend it.", "Your Small Cart is falling apart. A Wagon Yard or a Wagon Repair Kit will mend it."

**One accessor.** Every reader asks the tier through `systems/upkeep/upkeepSwitch.js` wagonUpkeepRules - the live tier's rules,
null for Off and on any skin but the enhanced one: the upkeep's wear by the road, a journey and the watch's throw, the
ride's pace, the Stable page, the saddle panel and the kit's Use (`systems/upkeep/upkeepRuntime.js`'s doors and
registerUpkeepUses, each handed the accessor by the two hosts that ride), the Wagon Yard's wright (`scenes/world.js`
mendAtYard - Off, "The wright has no work for you."), and a counter's sale (`systems/tradeModes.js`). The laws that
charge take the rules as an argument (`wagonUpkeep.js` wagonPace, wagonSoldWhole), and one handed none runs Hard. The
boolean switch is gone; the shelf's key has one reader.

**Online.** Every tier, Off included, is the player's (`online: 'player'`) - Climates & Calories' reading
(MODS-ONLINE-3), as horse care's: a tier decides only what THIS player's wagon pays. The condition rides the wire as it
always did, and a counter's price is the seller's tier's. A Sound wagon's boon is the player's own online, as
Climates & Calories' boons are (AUDIT C&C B1, BOONS ONLINE: KEPT): every tier is every player's to choose, and the boon
is earned by keeping the wagon - as a fast horse's earned pace already rode online.

**Moving the players already on it** (`systems/uiPrefs.js` loadPrefs, horse care's way). A stored Off (the old
switch's `false`) is Off with nothing converted; the old default, On, was never stored (PREF1), so a player who never
touched the switch plays the new default, Boons; an On written to the shelf lands on Hard, written so at the next save;
any other value is dropped at the load. No save holds the switch.

Pinned: `test/systems/wagontiers.test.js` (7 - the one key, the switch online, Boons never worse than DFU's plain wagon, the
shelf, no red and each tier's words, the one accessor, a Sound wagon's boon); mutants `tools/mutants/wagontiers.json`
(26, all dead). The pins
written before the tiers pin Hard, PIN MOVED where their vocabulary did: the upkeep is handed Hard's rules where it was
handed `true`.

## The durability is the condition it always carried (`systems/wagon/wagonUpkeep.js`)

Every wagon is DFU's Small Cart item (template 93) and has carried a condition since its mint - 1400 of 1400
(`itemTemplates.js` mintCondition) - which nothing lowered. WAGONS4 lowers it. A wagon minted before its condition
was is whole. The item card's Condition and a sale's condition price (Roleplay & Realism: Items' conditionCostBase)
were already reading it - on Hard; Boons and Off sell a wagon whole (The tiers). Its VALUE never falls: the item law
holds a marked wagon to its kind's floor, and wear is its condition alone.

| State | From | Its team's pace (Hard; on Boons 1.1 Sound, 1 every other state) |
|---|---|---|
| Sound | 60% | 1 |
| Worn | 30% | 1 |
| Rickety | 10% | 0.85 |
| Failing | under 10%, to its last point (and a save's nought) | 0.7 |

A step down to Rickety or Failing is said once.

## What wears it

- **The road** (`rollWear`, through the runtime's wear account): by the kilometre it rolls with its owner - driven, or
  its team following them (the motor's odometer's metres: a placement, a carry or an origin shift is never counted) -
  1% of whole a kilometre on a road, 2.5 times off one, up to 1.75 times under a full load, and the bigger wagons are
  built heavier (the Open Wagon 0.85, the Caravan 0.7). A point comes off whole (1400 points: some seven metres of
  road), the metres owed kept for the next. A half-loaded Caravan is worn to its last point some hundred kilometres of
  road from new, and rolls on at the failing pace.
- **A journey on the travel map** it goes on (driven, or its team following along - `horseCart.js`
  wagonGoesOnJourney; never a wagon sent to the stable, WAGON-STABLED; with Horse Cart and Cargo off, the cart goes
  where its owner goes): 1% a day, 20% a journey at most.
- **The town watch** carrying it off (`scenes/wagon/wagonWardenHost.js` throwMine, WARDEN1): 10%.

A wagon left parked does not wear.

## Failing, it still goes

Worn as far as wear takes it, a wagon is Failing: on Hard its team pulls it at 0.7 of its pace (`upkeepRuntime.js`
rideScale, times its team's Strength under its load - horse care's), on Boons at its pace, and it is driven, hitched,
followed and taken on a journey like any other on every tier. On Hard the Stable page, the saddle panel and its line
(`ui/enhanced/enhancedSaddle.js` saddleHint) say to mend it to get its pace back.

## Mending

- **A Wagon Yard** (`03-World/Merchant-Yards.md`): its keeper's third row, **Mend** (`merchantYards.js`
  YARD_MEND_ROW). The wright makes the wagon driven whole for 12% of its kind's value at most (40 gold at the least),
  by what it lacks - a Caravan at nought 3000, a worn one half that - asked in a Yes/No box, then paid
  (`scenes/world.js` mendAtYard). A wagon not drawn up at the yard (Horse Cart and Cargo's wagon out of the counter's
  reach - the reach its load is taken at) costs half again: a wright goes out to it.
- **A Wagon Repair Kit** (1711, WAGONS4's own - `systems/upkeep/upkeepItemRows.js`): a quarter of whole back, to 60% at most,
  an hour's work. Used from the pack or the wagon's own load, or from the
  Stable page's button, where the wagon's load can be reached. A Wagon Yard sells them in a stack of YARD_KITS_STACK.
- **Never a smith**: a wagon left at a smith's counter left the pack for days, and Horse Cart and Cargo's wagon in the
  world with it - so a smith refuses a horse and a wagon first, in their own words, at both counters
  (`systems/repairService.js` repairRefusal 'transport', TRANSPORT_CANNOT_BE_REPAIRED_TEXT). Before WAGONS4 no wagon
  was ever damaged, so the counter's "does not need repair" had stood in the way.
- **Never a held Repairs Objects** (AUDIT WAGONS4): the enchantment's pick passes a wagon and a horse by
  (`systems/enchantments.js` repairsObjectsTarget) - DFU's wagon never wore, so its mend never reached one; here it
  would have mended a failing Caravan free and whole, past the yard's price and the kit's ceiling.

## The Stable page

The wagon's card shows its Repair meter in its state's tone (sound and worn the kit's verdigris, rickety plain, failing
blood - STEED-UI; on Boons failing plain, The tiers), its state's word and advice (Boons' its own), what a Wagon Yard asks to make it whole - at the yard, and
with its wright going out to it (`upkeepRuntime.js` wagonCard's mend and mendAway, `ui/holdingsPages.js` mendLine) -
and **Use a repair kit** while a kit would mend it (`ui/holdingsPages.js` wagonLines).

## The saddle panel (STEED-UI - `10-UI/Controls.md`, THE SADDLE PANEL)

On Enhanced Plus, on the bench, the wagon is on screen under the compass (`ui/enhanced/enhancedSaddle.js`): its state and share
of whole, its load against its limit, and its doors - **Repair kit** (where a kit would mend it, dark without a kit or
the wagon's reach), **Cargo** (its load opened with the wagon chosen, where Horse Cart and Cargo's own reach allows -
`systems/horse/horseCart.js` openWagonCargo), **Climb down**. On Hard a failing wagon's line says to mend it to get its pace
back, and its chip is red; on Boons it is amber and the line says nothing of a pace it has.

## Online

The wagon's condition rides the wire as it always did. The kit followed REST6's law, SHIP BEFORE ANYONE CAN SEE ONE:
UPKEEP_ITEMS_ONLINE was false for the release that shipped it (#791). UPKEEP-ONLINE (2026-10-12, the owner: "We never
added oats or repair kits to the new horse/wagon system") turned it on - every release since has carried the template -
so online a Wagon Yard sells its kits as it did offline from the first (`systems/upkeep/upkeepItemRows.js`).

## The four hosts

`scenes/world.js` and `scenes/exterior.js` wear the wagon in the frame's upkeep and register the kit's Use, each handed
the one accessor `wagonUpkeepRules` (WAGON-TIERS; WAGON-MEND
took out the broken word they handed the runtime, the classic window's Cart row's gate and the classic bench's
dismount); world.js wears it by a journey's days, by the watch's throw, and stands the Wagon Yard's wright. `scenes/worldModes.js` and `scenes/dungeonContext.js` stand no transport
(a building or a dungeon puts the driver on foot) and are named, not wired; worldModes.js refuses a wagon at a smith's
counter (its own repair list).

Pinned: `test/systems/wagons4_upkeep.test.js`; mutants `tools/mutants/wagons4.json`, and WAGON-MEND's and UPKEEP-ONLINE's
`tools/mutants/wagonmend.json`. The saddle panel and the page's polish:
`test/systems/steedui_saddle.test.js`; mutants `tools/mutants/steedui.json`. THE TIERS: `test/systems/wagontiers.test.js`; mutants
`tools/mutants/wagontiers.json`.
