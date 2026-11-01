# Horse Care

Every horse has its own stats, a bond that feeding grows, hunger and breath. A horse walks by default and gallops on
the run key while it has breath. The player meets it on the Stable page, the saddle panel under the compass, the
breath bar on the HUD, and a Stable's three horses a day. It is the enhanced skin's: Features, World tab, Travel,
**Horse care** (`horseCare`), with three tiers, each player's own online. Wagons are `bible/06-Systems/Wagon-Upkeep.md`.

## How it works

### The tiers

`HORSE_CARE_RULES` (`src/systems/upkeep/upkeepTiers.js`) writes the tiers as data, after Climates and Calories'
model (`bible/06-Systems/Climates-Calories.md`):

| Tier | Stored | What the horse pays |
|---|---|---|
| Off | `false` | nothing: DFU's horse, no stats, one pace, nothing to feed |
| Boons (default) | nothing | nothing below DFU's horse: care earns, neglect costs nothing |
| Hard | `'hard'` | the whole system: hunger costs stats and breath, starving fades the bond, a team drags a load |

In Boons the world is the same (stats, bond, hunger words), but nothing is taken: hunger costs no stat or breath, the
pace with Run held is never under DFU's, a team never drags, and hunger's chip stops at amber. A starving or winded
horse in Boons does not gallop and rides DFU's pace. Off carries every horse's food clock with the clock, so turning
care back on finds the horse as it was. Every reader asks the tier through `src/systems/upkeep/upkeepSwitch.js`
`horseCareRules`, which answers null for Off and on any skin but the enhanced one.

### The law (`src/systems/steedCare.js`)

- **Stats.** Speed, Stamina, Endurance and Strength (`STEED_STATS`) come from the horse's seed (its coat's,
  `bible/06-Systems/Horse-Coats.md`): `STEED_BORN_MIN` to `STEED_BORN_MAX`, most near 50. No field stores them. A stat
  is its born value plus a point per `BOND_STEP` of bond, less hunger's penalty on Hard, held to 1..`STEED_STAT_CAP`.
  Speed scales the ride's pace (`steedSpeedScale`), Stamina the breath (`breathMax`), Endurance how fast a gallop spends
  and regains breath, Strength a wagon team's pace under load (`teamDraftScale`).
- **The bond** (`horseBond`, in tenths) grows `DAY_BOND_TENTHS` for a day's food, times the food's love, through the
  words Wary to Kindred (`BOND_TIERS`). It is the owner's: a traded horse comes to its new owner a stranger.
- **Hunger** (`horseFed`, the minute of the owner's clock its food runs out): Fed, Hungry, then Starving after
  `STARVING_AFTER`. On Hard a starving horse loses its gallop and fades `STARVING_BOND_TENTHS_A_DAY`. A horse never dies.
- **Food** (`STEED_FOODS`): a Sack of Oats (24 hours) sold at a Stable, or an apple by hand (4 hours, more love). A
  horse fed `FULL_AHEAD` ahead refuses more.
- **The keep** (`tendHorses`, each game minute; `src/systems/upkeep/upkeepRuntime.js`): a horse with its owner is fed
  by hand and eats oats from the pack or the wagon across a skipped span; one waiting in the world grazes (hungry,
  never starving); a stabled one is fed by the stable.
- **Breath** (`stepBreath`, in memory only): a gallop spends it; at nought the horse is winded until `WINDED_UNTIL` is
  back. It returns at `BREATH_BACK`, slower under a rider, and whole across a skipped span.

### Riding

Under horse care a horse walks and the run key gallops (`src/systems/transport.js` `setGallopGate`), after Roleplay and
Realism's Enhanced Riding has its say about towns. The gallop spends the horse's breath, not the rider's fatigue. The
hosts hand the motor the ride's pace each frame (`src/player/motor.js` `rideSpeedScale`).

### Surfaces

- **The Stable page** (`src/ui/holdingsPages.js`): a card per horse owned, on every tier; with care on, its bond, hunger,
  breath and stats, Feed oats, Give an apple, and Ride this one.
- **The saddle panel** (`src/ui/enhanced/enhancedSaddle.js`) on Enhanced Plus: breath, hunger, bond, gait, pace and
  doors. A movable HUD piece (`bible/10-UI/Controls.md`).
- **The HUD**: the ridden horse's breath in the grip bar's place.
- **A Stable** stands `STABLE_HORSES_OFFERED` horses a day, the same for every client in the town
  (`src/systems/merchantYards.js` `stableHorses`), priced by their stats (`steedValue`).
- **The breath is heard** on the enhanced skin (`src/systems/horse/horseVoice.js`).

### The tamed dragon

The Dwarven Dragon runs on the same law: stats from its tame id, bond and hunger on its item, breath beside the
horse's. It drinks Dwarven Oil alone (`DWARVEN_OIL_TEMPLATE`) and hunts while it waits (`tendSteed`;
`bible/11-Multiplayer/Dwarven-Dragon.md`).

## Rules

- Every horse has different stats; feeding grows the bond and the stats (the owner).
- Horses never die (the owner).
- A horse walks by default; the run key gallops (the owner).
- Care can be turned off; the tiers follow Climates and Calories' boons (Mac).
- Keep the walk: Boons' "never below DFU's horse" is the pace with Run held; the walk with Run released stands on
  every caring tier (Mac).
- Online the fields ride the item record (`src/systems/item/itemFields.js` `horseBond`, `horseFed`), and the item law
  holds them to DFU's horse.

## Daggerfall Unity

DFU's horse has one pace (`PlayerSpeedChanger.GetBaseSpeed`'s riding arm), no stats and no needs, and forbids running
in the saddle (`CanRunUnlessRiding`). Off is that horse. Every rule above is a departure of the enhanced lane.

## Code and tests

- `src/systems/steedCare.js` - stats, bond, hunger, food, the keep, breath
- `src/systems/upkeep/upkeepTiers.js`, `upkeepSwitch.js`, `upkeepRuntime.js` - tiers, the accessor, the runtime
- `src/systems/transport.js` - the gallop gate and the walk
- `src/ui/holdingsPages.js`, `src/ui/enhanced/enhancedSaddle.js` - the Stable page and the saddle panel
- `test/systems/steed1_horsecare.test.js` - the law
- `test/systems/horsetiers.test.js` - the tiers
- `test/systems/horsewalk.test.js` - the walk and the gallop
- `test/systems/steedui_saddle.test.js` - the saddle panel
- `test/systems/horse/fb1016b_horsecareoff.test.js` - every horse listed with care off
