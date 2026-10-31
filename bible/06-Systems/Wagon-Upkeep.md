# Wagon upkeep

Wagons wear with use and must be mended. Every wagon kind (the Small Cart, the Open Wagon and the Caravan,
`06-Systems/Wagons.md`) carries a condition that the road, a journey and the town watch take down. A Wagon Yard or a
Wagon Repair Kit puts it back. Horses have their own upkeep (`06-Systems/Horse-Care.md`). The player meets it on the
Stable page, on the saddle panel while driving, and at a Wagon Yard's counter.

## How it works

**Tiers.** Features, World tab, Travel - **Wagon upkeep**, the `wagonUpkeep` pref, enhanced skin only. Three tiers, the
same model as horse care and Climates & Calories:

| Tier | Stored | What the wagon pays |
|---|---|---|
| Off | `false` | Nothing. DFU's plain wagon: it never wears and sells whole. |
| Boons (default) | nothing | Nothing is taken. It wears and is mended as on Hard, but a worn wagon rolls at DFU's pace and sells whole. A Sound wagon rolls 1.1 times faster. |
| Hard | `'hard'` | Rickety rolls at 0.85 of its pace, Failing at 0.7, and a counter prices the wagon by its condition. |

**Condition.** A wagon is the Small Cart item (template 93) with a condition out of 1400. Its states:

| State | From | Pace on Hard |
|---|---|---|
| Sound | 60% | 1 |
| Worn | 30% | 1 |
| Rickety | 10% | 0.85 |
| Failing | below 10% | 0.7 |

Wear stops at one point: a wagon is never broken and is always drivable. A step down to Rickety or Failing is said
once. A wagon's value never falls; only its condition does.

**What wears it.**
- The road: 1% of whole a kilometre on a road, 2.5 times that off one, up to 1.75 times under a full load. The Open
  Wagon wears at 0.85 and the Caravan at 0.7 of the cart's rate. Only metres the motor rolls count, never a placement
  or an origin shift. A parked wagon does not wear.
- A journey on the travel map that the wagon goes on: 1% a day, at most 20% a journey.
- The town watch carrying it off: 10%.

**Mending.**
- A Wagon Yard's **Mend** row. The wright makes the wagon whole for up to 12% of its kind's value (never under 40
  gold), scaled by what it lacks, after a Yes/No box. A wagon not drawn up at the yard costs half again.
- A **Wagon Repair Kit** (template 1711): a quarter of whole back, never above 60%, an hour's work. Used from the
  pack, the wagon's load, the Stable page or the saddle panel. A Wagon Yard sells them in stacks.
- A smith refuses horses and wagons in its own words. A held Repairs Objects enchantment skips them.

**Where it shows.** The Stable page shows the wagon's meter, state, advice, the yard's price at the yard and away,
and **Use a repair kit**. On Enhanced Plus the saddle panel shows the state, the load and the **Repair kit**,
**Cargo** and **Climb down** doors.

## Rules

- No wagon is ever broken; wear stops at its last point (the owner). `src/systems/wagon/wagonUpkeep.js` `WEAR_FLOOR`.
- Same tiers as horse care (Mac). `src/systems/upkeep/upkeepTiers.js` `WAGON_UPKEEP_RULES`.
- A Sound wagon rolls faster on Boons (Mac). `src/systems/upkeep/upkeepTiers.js` `WAGON_SOUND_BOON`.
- Red means it costs: where wear costs nothing (Boons), a failing wagon's chip stops at amber and its words say no
  pace is lost.
- One accessor: every reader asks the tier through `src/systems/upkeep/upkeepSwitch.js` `wagonUpkeepRules` (null for
  Off and on any skin but enhanced). A law handed no rules runs Hard.
- The tier is each player's own online (`online: 'player'` in `src/systems/features.js`). The condition rides the wire;
  a sale is priced by the seller's tier.
- The prefs load (`src/systems/uiPrefs.js` `loadPrefs`) keeps a stored `false` as Off, moves a stored `true` to Hard,
  and drops any other value. No save holds the switch.
- `scenes/worldModes.js` and `scenes/dungeonContext.js` stand no transport; only the overworld and exterior hosts wear
  a wagon.

## Daggerfall Unity

DFU's wagon (the Small Cart item, template 93) carries a condition that nothing lowers. Departures: the wagon wears
and is mended at a Wagon Yard or with a kit, so keeping it is worth something. The Boons default keeps it never worse
than DFU's. A smith refuses it, so it is never left at a counter for days.

## Code and tests

- `src/systems/wagon/wagonUpkeep.js` - states, wear (`rollWear`, `journeyWear`, `wearWagon`), mending (`mendPrice`,
  `mendWagon`, `kitMendWagon`), pace (`wagonPace`) and sale (`wagonSoldWhole`)
- `src/systems/upkeep/upkeepTiers.js` - the tiers as data, a leaf with no imports
- `src/systems/upkeep/upkeepSwitch.js` - `wagonUpkeepRules`, the one accessor
- `src/systems/upkeep/upkeepRuntime.js` - the wear account, the ride pace, the Stable card, the kit's Use
- `src/systems/upkeep/upkeepItemRows.js` - the Wagon Repair Kit item row
- `src/systems/merchantYards.js` - `YARD_MEND_ROW`, `YARD_KITS_STACK`
- `src/systems/repairService.js` - `TRANSPORT_CANNOT_BE_REPAIRED_TEXT`
- `src/systems/tradeModes.js` - a wagon's sale price by tier
- `src/ui/enhanced/enhancedSaddle.js`, `src/ui/holdingsPages.js` - the saddle panel and the Stable page
- `src/scenes/world.js` `mendAtYard`, `src/scenes/wagon/wagonWardenHost.js` `throwMine` - the yard's wright and the
  watch's wear
- `test/systems/wagons4_upkeep.test.js` - wear, states, mending, the smith's refusal
- `test/systems/wagontiers.test.js` - the tiers, the accessor, the Boons boon and no red
- `test/systems/steedui_saddle.test.js` - the saddle panel and the Stable page
