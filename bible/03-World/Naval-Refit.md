# Naval Refit

The sea's second refit: a ship's hold reachable anywhere, faster way out of a fight, a raid ending where it was fought,
boarding by grapples, the ram as a bounded blow, four shot kinds, combat feel, a captain's flag, paint, cabin wood, deck
props, a name plaque, a figurehead, a captain's skill tree, metal refit tiers, a trade good on every Eltheric isle, the
sea's ships in their own colours, and the sea's AI kept off the Overworld's clock. The player meets it aboard their own
ship and on the Fleet page. It builds on the sea fight (`Naval-Combat.md`) and Come Sail Away (`Come-Sail-Away.md`).

## How it works

- **Cargo anywhere** (`src/scenes/holdDoor.js`). A ship's hold opens from anywhere: the hold's key (F4), the helm's
  Hold, the Fleet page's Hold; the ship at hand, last helmed or the fleet's first, wherever it lies.
- **Peace way** (`src/systems/comeSailAway/peaceWay.js`). Out of a fight a ship's way and its acceleration are
  `PEACE_WAY` (1.15) of what they are in one.
- **Raid ashore** (`src/scenes/raidAshore.js`). A voyage's raid fought where the player stands ends there: crew and
  last raiders withdrawn, the quest ended; one raid at a time (`Warm-Ashes-Ships.md`).
- **Boarding by grapples** (`src/systems/naval/navalBoarding.js`). A struck ship within the grapples' reach can be
  boarded at any way: the haul draws it alongside while the player's way comes off.
- **The ram** (`src/systems/naval/navalRam.js`). A blow alone, bounded: a share of the lesser hull by the closing way,
  never on a struck ship, only as hard as the rammer's recoil pays for. The player's stem rams fair game only; a lawful
  ship at peace is bumped. A galley rams only the ship it fights.
- **Shot kinds** (`src/systems/naval/shotKinds.js`). Four loads, chosen per battery group: round, grape (thins crew),
  chain (takes down sails), heated (sets fires). Pirates board with grape.
- **Combat feel.** Gun smoke drifting on the air, spouts for falls far off, a near pass whistling and a near fall
  drenching the deck, the side a blow came from on the plate, a burning ship's magazine going up as it founders.
- **Colours and looks** (`src/systems/naval/shipFlag.js`, `src/systems/naval/shipLivery.js`,
  `src/scenes/cabinLook.js`, `src/systems/naval/deckFittings.js`, `src/scenes/comeSailAway/shipPlaque.js`,
  `src/systems/naval/figurehead.js`). A flag of the captain's design or the guild's arms, flown as cloth at the
  masthead; a paint scheme for hull, trim and canvas; the cabin's wood; Daggerfall's crates and chests placed on the open
  deck by a deck plan; the ship's name on a gilt board on each bow; a figurehead carving. All seen by every player.
- **The sea's colours** (`src/systems/naval/seaColours.js`). Every ship of the sea wears its own paint and flag (a
  navy's crown, a merchant house, a pirate crew); a pirate under false colours wears the house it passes for. Struck,
  its colours come down.
- **Captain's stars** (`src/systems/naval/captainTree.js`). A captain's level, earned off the captain's log, buys a
  point a level in a Firmament-styled sky: the Master's seamanship and the Commander's war, each star a share of a
  ship's own number where it is read (way, oars, helm, hold, hull, repairs, trade, guns, reload, aim).
- **Metal refits** (`src/systems/fleet.js` `ORE_TIERS`). Past the shipwright's three tiers, nine of metal, Steel to
  Daedric (DFU's ladder), each asking a captain's level, the metal (ingots, or a weapon or plate of it melted down) and
  the line's first store.
- **Isle trade** (`src/systems/naval/tradeGoods.js` `isleGood`). Every Eltheric isle's freeport makes one Bay good and
  sells it as made.
- **Time dilation** (`src/systems/travel/travelThreat.js`). A journey inside a hostile ship's reach is held at real
  time and the Overworld brought down; online a shared sea is kept at real time.

## Rules

- The owner's nine items, then the plaque, the sea's liveries, the captain's tree with ore refits, and no AI time
  dilation on the Overworld. No band aids.
- The game's words call a ship "the ship", "this ship" or "it", never "her" or "she", plainly (the owner).
- The player's Dwemer submarines are out of scope.
- Online every look a player chooses rides the wire, so every player sees it.

## Daggerfall Unity

Daggerfall has no sea and DFU none either. Where a change leaves Come Sail Away's own law (peace way, the hold door,
the haul) it is a named departure (NAVAL-REFIT).

## Code and tests

- `test/scenes/holddoor.test.js`, `test/systems/comeSailAway/peaceway.test.js`
- `test/systems/naval/boardmagnet.test.js`, `test/systems/naval/ramreturn.test.js`
- `test/systems/naval/shotkinds.test.js`, `test/systems/naval/combatfeel.test.js`
- `test/systems/naval/shipcolours.test.js`, `shiplivery.test.js`, `shipplaque.test.js`, `figurehead.test.js`,
  `seacolours.test.js`
- `test/systems/naval/captaintree.test.js`, `test/systems/naval/isletrade.test.js`,
  `test/systems/naval/timedilation.test.js`
- `test/systems/naval/auditrefit.test.js`, `test/systems/naval/auditrefit2.test.js` - the audits
