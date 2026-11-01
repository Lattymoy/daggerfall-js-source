# Living World II: roads, caravans, outlaws, companies, patrons

The second half of the living world (`06-Systems/Living-World.md`): the traffic on the roads, merchant caravans with
horses and wagons that the player can trade with, rob or escort, outlaw bands with hideouts, adventuring companies
that dive dungeons and leave them picked over, townsfolk who buy from players' home traders, and news that travels
from town to town. Everything here is part of the `living-world` Features row and follows its rules.

## How it works

**The road's traffic** (`src/systems/livingWorld/census.js`, `trips.js`). Beside the merchants, mercenaries,
adventurers, sailors, pilgrims, couriers and pedlars (`TRAVELLER_JOBS`), towns send out carters to market (on the
market town's market day), hunters into the wild, patrols, nobles with retainers and minstrels (`ROAD_JOBS`), and a
fourth rank of more pedlars, pilgrims, couriers, hunters and divers (`WIDE_JOBS`). Each job has its own cycle, trip
chance, range and pace. Travellers walk from 07:00 to 19:00 and camp or take an inn at night.

**The wagon train** (`wagons.js` `teamOf`). A merchant's caravan draws one wagon, two from a great house's town (36
blocks or more); a noble's procession draws a baggage wagon; a pedlar or carter leads a pack horse. The wagon is model
41214 read from the player's own ARCH3D, the horse the Horse Cart and Cargo sprites under `vendor/`. A caravan draws
its wagon whatever the Horse Cart and Cargo switch says.

**The caravan's door** (`caravanDoor.js`, `src/scenes/caravanHost.js`). A party's leader who keeps a counter asks the
player what they want first. A merchant or carter keeps a general store's counter on the road, a pedlar a pawnbroker's,
its quality by the town's size, its purse limited. A merchant offers escort work: 60 gold a day of the walk out (more
by level) and 100 a foe of each fight won, paid at the destination; falling 300 m behind for an hour of the clock breaks
the contract. A party whose armed members are all down while its leader stands yields its purse and goods.

**Crime on the road.** A deed against a party is a crime against the region where the road runs, charged with DFU's own
law (`court.js` `lowerRepForCrime`) only when a witness reaches a town alive. Killing every witness first voids it.

**Outlaws** (`outlaws.js`, `src/scenes/hideouts.js`). A region keeps 1 band for each 40 towns, at most 4, none for a
lone town. Each band holds a hideout off the middle of a road between two of the region's towns, robs the parties on
its stretch, and may be routed; a routed band's place stands empty for a while before another takes it.

**Companies** (`companies.js`). A town's adventurers walk and dive in companies of 2 to 4 (5 in a city), balanced
between warrior, thief and mage classes where the roster allows, with a generated name ("The Lantern Company").

**The deep's own** (`deepRoute.js`, `src/scenes/dungeonDivers.js`). A company's dive goes stop by stop through the
dungeon's random foe and treasure markers, block by block. For a day of the clock after it passes, the random foes at
the stops it reached are dead and the random treasure piles picked over. Quest markers, fixed foes and fixed treasure
are never touched. The player may meet the company below.

**The patrons** (`src/net/patronLaw.js`, `patrons.js`). Townsfolk buy from players' home traders. The account service
decides every sale: each open trader listing in a public home is offered to its town's patrons once each real hour,
at most 0.6 of the piece's worth as the service judges it, within a town's hourly demand and each seller's hourly and
daily ceilings (`PATRON_TOWN_HOUR`, `PATRON_SELLER_HOUR`, `PATRON_SELLER_DAY_GOLD`). The street only draws the buyer
the service named.

**The word travels** (`carried.js`). A party coming in from another town carries that town's news and the player's
deeds known there, as they stood when the party set out, and the news is heard in its new town for 3 days. A heard
deed moves a stranger's regard a little, never past friend or enemy (`REPUTE`).

**Past the Bay.** Travellers past the Bay walk the roads there (`beyondWays.js`), within 18 pixels (`TRIP_REACH_PX`),
and keep to their side of the Bay's edge.

## Rules

- **Pure stays pure** (Mac): every traveller, wagon, band, company, route and cleared stop is a pure function of the
  world's data, a seed and the clock. The one exception is the patrons, whose sales the account service decides.
- **A company's dive changes the dungeon for a while, and only what it reached** (`DIVE_CLEAR_MIN`); no dungeon is ever
  cleared for good by people the player never saw.
- **A deed on the road is a crime only if a witness carries it home.**
- **An escort walks online and may ride the clock offline**: online nobody may move the shared clock, so the player
  keeps pace with the caravan; offline, travelling with it moves the clock as a journey does.
- **The patrons are a capped faucet** (`src/net/patronLaw.js` `PATRON_PAY_SHARE`), and their gold is written where the
  wealth measure counts it.
- **Every new traveller job is appended** to its rank, so no saved regard or turn is re-keyed; the relations record
  stays `v: 1`, add-only (`relations.js`).
- **More travellers and divers everywhere** (the owner): the fourth rank (`WIDE_JOBS`, `WIDE_DIVE_CHANCE`).

## Code and tests

- `src/systems/livingWorld/trips.js`, `census.js`, `beyondWays.js` - who travels, where, when and by which way
- `src/systems/livingWorld/wagons.js`, `caravanDoor.js`, `src/scenes/caravanHost.js` - wagons and the caravan's door
- `src/systems/livingWorld/outlaws.js`, `src/scenes/hideouts.js` - the bands and their hideouts
- `src/systems/livingWorld/companies.js`, `deepRoute.js`, `src/scenes/dungeonDivers.js` - companies and their dives
- `src/net/patronLaw.js`, `src/systems/livingWorld/patrons.js`, `server-account/src/market.js` - the patrons
- `src/systems/livingWorld/carried.js` - news between towns
- `test/systems/livingWorld/lw10_wagons.test.js`, `lw11_caravan.test.js`, `lw16_word.test.js`,
  `lwdense_town.test.js` - wagons, the caravan, the word, density
- `test/scenes/lw14_deep.test.js`, `test/server/patronload2.test.js` - the deep's own, the patrons

## Open

Mac's calls, built with working numbers and still his to set: the traffic targets; the patrons' numbers and whether a
private home's trader sells to the street; a band on the bounty board; the escort's pay in gold or Marks; couriers on
horseback; an arrest on the road by a patrol; the repute's numbers; the Trade, Talk, Steal and Hire rows on the World
Tooltips plaque and stealing from a wagon (the choice window and the counter's own steal stand in); whether a caravan
robbed under escort pays.
