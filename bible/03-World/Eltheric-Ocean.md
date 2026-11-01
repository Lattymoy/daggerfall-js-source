# The Eltheric Ocean

The sea past the Veil: a vast procedural ocean west of the Iliac Bay, reached by sailing far out on the open Abecean.
Its isles hold freeport towns, ruins, wild strands and bare rocks; corsairs, island traders and six legendary ships sail
it. The deeper west, the deadlier and richer. Past Veilhaven's peace it is an open PvP zone with its own vaults, events,
bounties, season boards and ship-to-ship fights. The Bay's own sea is `Captains-Sea.md`.

## How it works

- **The sea** (`src/world/ethericSea.js`). A box of the Bay's own pixel grid, 8,064 by 4,992 pixels (6,606 by
  4,089 km), north of the continent: a pure function of its pixel, so every client stands the same sea. Its depth bands
  run west of the Veil: the Shallows, the Reaches, the Deep Aether, the Abyss. The ground is grown by DFU's terrain
  kernel from height and climate bytes answered here. Past the box nothing streams.
- **The depth** (`src/world/etherWatersBake.js`). The Ocean's plain, about two hundred metres down off every coast,
  carved and swum as the Bay's is (`Deep-Waters.md`). Ocean Holes' pits open here too (`Ocean-Holes.md`).
- **Isles and places** (`src/world/etherPlaces.js`). A lattice of isles off one hash: a port (a town and a freeport's
  quay), a ruin (a dungeon), a wild isle (an Eltheric good on its strand) or a bare rock, named, in its own climate. Towns
  and ruins are the game's own places cloned from MAPS.BSA rows. The day's trees, herb patches, veins, boulders and
  schools are gathered as the Bay's.
- **Freeports.** Crownless, with their own harbourmaster. Each isle makes one Bay good of its own (`Naval-Refit.md`).
- **Ships and legends** (`src/systems/naval/etherShips.js`). Corsairs and island traders under the sea's own names, no
  crown's navy or law. Six legendary ships, each with its own haunt, terror and purse, return from the deep a month
  after they are sunk.
- **The crossing** (`src/systems/naval/etherCrossing.js`). Far enough out on the open Abecean the game asks whether to
  sail on; three days on the ship comes out off Veilhaven. A party aboard crosses with the ship.
- **The chart** (`src/ui/etherChartWindow.js`). The travel map's door past the Veil opens the captain's chart: isles
  charted, depths, the Veil and the legends' haunts heard of. Its door leads up into the Overworld, which plates the
  isles' ports and ruins and marks the bands and raiders seeded on the sea.
- **The open sea** (`src/systems/wild/etherWild.js`). Online, past Veilhaven's peace the sea is the open zone, the
  Wrothgarian Mountains' law on a second ground, its depth bands the mountains' four rings.
- **Reasons to go deep.** The Eltheric Tidemail set drops only in the Deep Aether and the Abyss
  (`11-Multiplayer/Sigil-Sets.md`). The day's vaults are elite halls on water (`src/systems/sea/seaVaults.js`). Events
  on the shared clock: the Aether Storm and the treasure fleet (`src/systems/sea/seaEvents.js`). A freeport's bounty
  board on captains who kill other players at sea, posted from players' own gold (`src/net/sea/seaBountyLaw.js`).
  Season boards for the deepest voyage and the legends ended (`src/net/sea/seaSeasonLaw.js`). Broadsides between
  captains: a ship wrecked or boarded, its hold a prize, refereed by the relay (`src/net/sea/seaPrizeLaw.js`).

## Rules

- An open sea map to traverse to the Eltheric Ocean: an endless procedural oceanscape with isles, towns, dungeons,
  exotic resources and deadly legendary ships (the owner). The name is Eltheric, it has real depth, and gathering
  nodes stand on its isles and in its water (the owner).
- The Overworld rises past the Veil with enemies shown as in the Bay (the owner).
- Open PvP in this zone, with the Wrothgarian Mountains' open-zone aspects on the isles (the owner).
- Where the game has a law it is used: the terrain kernel, cloned places, DFU's loot rolls, gold.
- The region is Betony's for every system that asks one; only place words say "the Eltheric Ocean".
- A place's name may repeat across the sea; two places of one name share an automap and a building's discovery.
- The sky, clouds and fog are the world's own past the Veil.

## Daggerfall Unity

Nothing in Daggerfall or DFU lies past the Bay's western water. The whole sea is the port's own departure (ELTHERIC
OCEAN).

## Code and tests

- `src/world/ethericSea.js`, `src/world/etherPlaces.js`, `src/world/etherWatersBake.js` - the sea, isles and depth
- `src/systems/naval/etherShips.js`, `src/systems/naval/etherCrossing.js` - ships, legends, the crossing
- `src/systems/wild/etherWild.js`, `src/systems/sea/`, `src/net/sea/` - the open sea and its ventures
- `test/world/ethersea.test.js`, `test/world/etherplaces.test.js`, `test/world/ethersea_dwhold.test.js`
- `test/systems/naval/ethercross.test.js`, `test/systems/naval/ethership.test.js`, `test/net/ether_nodes.test.js`
- `test/systems/sea/seavaults.test.js`, `seaevents.test.js`, `seabounty.test.js`, `seaseason.test.js`,
  `shippvp.test.js`, `seaset.test.js`, `auditsea.test.js`
