# Blood

The port's own blood: marks that stay where blood lands, sprays sized by the blow, a killing blow's burst, gibs from
a warhammer's overkill, wounded foes that leave trails, corpses that pool, footprints, wall drips, drying over time,
and drops on the lens when the player is hit hard. DFU's own splash (`src/scenes/hitEffects.js`, `EnemyBlood`) still
plays on every hit; this adds what is left behind. The player tunes it under Settings' blood rows.

## How it works

- **Who bleeds.** DFU's own `bloodIndex` (`src/characters/enemy/enemyBasics.js`) decides: a bloodless foe marks
  nothing.
- **The rate ladder** (`src/combat/blood/bloodDecals.js`). A hit's damage over the target's maximum health picks a
  rung (`ladderRate`, `bloodRate`); the gore tier's density scales it with a floor of one, so less blood is never none
  (`scaleRate`). The rate sets the spray's drop count, radius and mark size (`sprayCount`, `sprayRadius`, `markSize`);
  drops fall in one to three lobes along the blow (`sprayPattern`) and fly on solved arcs to where they land.
- **Overkill.** A hit for `OVERKILL_PERCENT` (175%) of a body's health throws a second, wider burst
  (`isOverkill`, `burstCount`). Only the player's warhammer (`HEAVY_WEAPON_TEMPLATE`, 126) takes the heavy branch, and
  only it throws gibs: ten chunks thrown up and out, falling at three times gravity, spraying where they land, frozen
  after four seconds (`src/combat/blood/bloodGibs.js`).
- **Marks** (`src/combat/blood/bloodMarks.js`). A fixed ring of oriented quads laid on whatever surface the blood met,
  recycled oldest first: the gore tier sets how many exist before the oldest is reused, not a lifetime. Wall marks run
  down as drips; a walker who treads in blood leaves a few prints. The pool is the host's own binding, ended by name.
- **The art** (`src/combat/blood/bloodArt.js`) is generated at boot from noise: an atlas of pool, spatter, streak,
  drip and print shapes in four variants each. Fresh blood varies a little in colour and darkens to a dried brown
  over `DRY_TIME` (180 s) in eight stages.
- **Bleeding** (`src/combat/blood/bloodBleed.js`). A foe under half its health (`BLEED_THRESHOLD`) drips every 2 to 5
  seconds, more as it nears death; a dead foe with a corpse lies in a pool that spreads over 12 seconds.
- **Settings** (`src/combat/blood/bloodSwitch.js`, rows in `src/systems/features.js`): `blood-marks` (marks stay, on),
  `blood-gore` (Light, Normal, Heavy, Abattoir: density and mark count; Normal by default), `blood-overkill` (on),
  `blood-screen` (lens drops, on). `?blood=off` also turns marks off. The mark count takes effect on the next load.

## Rules

- DaggerBlood (Excoriated) is the reference for the feel only: there is no permission to integrate it, so none of
  its code, art or settings text ships, and it has no Mod-Registry row (Mac). Only behavioural facts (thresholds,
  counts, orderings) were read from it.
- The port ships no blood picture: every pixel is generated at boot.
- A blood pool's cost is fixed when it is built and never grows during a fight.
- Blood on the lens is the port's own; the reference has none.

## Daggerfall Unity

DFU has only `EnemyBlood`'s one-shot splash (TEXTURE.380), which the port keeps. Everything left behind is the port's
own, near DaggerBlood's feel. Departures from DaggerBlood: foes bleed, where it bleeds the player; the generated art;
the screen drops.

## Code and tests

- `src/combat/blood/bloodDecals.js` - the rate ladder, sprays, overkill
- `src/combat/blood/bloodMarks.js` - the mark ring, prints, drips, gibs in play
- `src/combat/blood/bloodGibs.js`, `bloodBleed.js`, `bloodArt.js` - gibs, bleeding, generated art
- `src/combat/blood/bloodSwitch.js` - the settings
- `test/combat/blood1_decals.test.js`, `test/combat/blood5_flight.test.js` - the ladder, the ring, overkill, the
  switches, the drops' flight
