# Tamriel's Biomes

Every province past the Iliac Bay is split into the zones its lore names, forty-four in all, three to ten a province.
Each zone has its own ground climate, air, jungle and canopy where it has them, and its own fauna: three encounter
tables read off a roster of what the lore sets there. The player meets the zones as the land and the wild change across
each province. What a zone looks like is `Tamriel-Lands.md`'s.

## How it works

- **Where a zone is** (`src/world/tamriel/tamrielBiomes.js`). The province is the land's (`provinceKeyBeyondBay`: the
  player's own trace once it lands, the authored rings before it or with `?tamrieltrace=off`). A zone's seeds are its
  lore's places: its cities (`src/world/tamriel/tamrielGeography.js` `CITIES`) and its regions' hearts, some as offsets
  from a named summit (`heartsAnchor`). Seeds off the land snap to the nearest land within `SEED_SNAP` or are dropped,
  and are stood again whenever the land moves (`standSeeds`). Within `CITY_GROUND` of a city a point is that city's
  zone. Borders wander, but a zone keeps to its province except near a border.
- **Peaks.** A zone that names ranges takes every point they lift past `PEAKS_LIFT`; a province's `peaks: true` zone
  takes the rest. Where the trace stands with the owner's heightmap, the peaks follow the relief: a province's highest
  8% (`PEAKS_SHARE`) of land past the Bay, above a floor and near a peaks range's spine. Red Mountain is its own zone,
  never snow.
- **Cyrodiil's jungle.** The Pocket Guide's Cyrodiil: the Nibenay Valley (the Imperial City) is grassland at the centre,
  ringed by the Nibenay Jungle; the Colovian uplands are jungle; the Gold Coast is deciduous; Blackwood is one country
  on both sides of the Black Marsh border. The jungle zones stand Bantha's four storeys (`Bantha-Jungle.md`).
- **Valenwood's canopy.** Grahtwood, Malabal Tor and Greenshade stand the jungle (`jungle: true`) and close the sky over
  it (`canopy: true`) with the graht-oaks (`Graht-Oaks.md`); the light under them is
  `src/world/jungle/jungleCanopy.js`. Reaper's March and every other zone keep their sky.
- **Fauna** (`src/systems/tamrielFauna.js`). Each zone has DFU's three tables (town at night, wild by day, wild by night)
  at their own indices from `BIOME_TABLE_BASE` (100), twenty slots each in level order, built by `faunaTable` from its
  roster. A roster entry is a mobile id and its rarity there (common, uncommon, rare, very rare) with a classic
  stand-in where it has one. Slot i draws, by a hash of zone and slot, from monsters within four levels of i + 1,
  weighed by rarity, distance and repeats; people from slot 3 up. No creature stands more than `WINDOW_MAX` (2) times
  in any six slots running. No aquatic creature stands on a land table.

## Rules

- Each region receives its own biome; Cyrodiil receives the unique jungle; every biome is lore accurate with lore
  accurate fauna, as detailed as possible (the owner). The Nibenay Valley is grassland ringed by jungle, Colovia is
  jungle and the Gold Coast deciduous (the owner).
- Valenwood has no sky: the trees cover it (the owner).
- The era is 3E 405. The Pocket Guide to the Empire (first edition) sets the country; the later games and ESO name the
  plants and beasts it does not.
- Recorded choices: Cyrodiil is jungle in 3E 405, a named departure from the lore's later temperate Cyrodiil.
  Morrowind is before the Red Year: ash storms in the Ashlands, no blight past the Ghostfence, no horses, no bears, big
  cats, wolves or spiders on Vvardenfell. Black Marsh stands no orc, centaur or wereboar. Dragons are gone in this era;
  the Dragonling is not a dragon. Dwemer constructs stand only where their ruins are. The Reach's harpies stand for its
  hagravens. The Grazelands wear the Woodlands' ground under Subtropical air.
- A lair past the Bay rolls DFU's dungeon tables by its dungeon type; the zone's tables are the open country's.
- On the Bay nothing changes: a Bay pixel has no zone.

## Daggerfall Unity

Daggerfall shows none of these provinces. DFU's `RandomEncounters.ChooseRandomEnemy` reads a twenty-slot table about
the player's level; the zones' tables keep that shape. The zones, their tables, the jungle and the canopy are the
port's own departure (TAMRIEL'S BIOMES).

## Code and tests

- `src/world/tamriel/tamrielBiomes.js` - the zones, seeds, peaks and lookup
- `src/systems/tamrielFauna.js` - rosters and tables
- `test/world/tesabiome_biomes.test.js` - the zones, seeds, peaks, wander, cache; with ARENA2 the player's trace
- `test/systems/tesabiome_fauna.test.js` - rosters, the table law, DFU's band through the real roll
- `test/world/valenwood_canopy.test.js` - the canopy's light
- `test/world/audittesa2g_zones.test.js` - Red Mountain's hearts and borders
- `tools/mutants/tesabiome.json` - the mutants
