# The Sky-Ketch

A Rourken airship, the Mzunthar, keeps station over a crown capital every ten real hours, and a party of up to eight
boards its own copy of the ship as a raid: the Boarding Watch, the Gallery of Hammers, the Starved Engine fed by aether
cells carried by hand, the Sailwalk's platforming, the Tonal Warden, and the Ketchmaster's chest. It is the only place
the Dwarven Thunderlock and Pistolet drop. Online only; a questline and a Discord herald go with it.

## How it works

**The clock** (`src/net/ketch/ketchLaw.js`). Voyages start at `KT_EPOCH_MS` and come every `KT_EVERY_MS` (ten hours).
The ship is sighted `KT_SIGHT_MS` before arriving, keeps station `KT_STATION_MS`, then weighs anchor; crews aboard have
`KT_LAST_MS` more. `ketchVoyageAt` names the voyage and phase (away, sighted, docked, departing). A crew boards only
while it keeps station (`ketchBoards`). Ten hours do not divide the day, so arrivals walk round every time zone.

**Stations** (`KT_STATION_CROWNS`, `src/scenes/ketch/ketchStations.js`). One station a province, at its crown capital:
Daggerfall (High Rock, the Bay's lane 0), Sentinel (Hammerfell), Solitude, Mournhold, Alinor, Falinesti, Torval and
Helstrom. Cyrodiil, the open zone, has none, and Wayrest keeps none. Each station's voyage comes
`KT_THEATRE_STAGGER_MS` after the one before, so the eight never arrive together. A Bay station is its city's MAPS.BSA
row; a station past the Bay is its seat's place among TESA's places (`ketchStationPixel`).

**In the sky** (`src/scenes/ketch/ketchSky.js`). On the clock alone, so every screen sees one ship: it flies in from the
east, hangs still off its city 260 m over the fields, and lowers its anchor-lift. Standing in the lift
`KT_BOARD_HOLD_MS` rides it up. Its ring is on the held map and ink map (`src/ui/ketch/ketchMapMark.js`), its rows in the
Timers window (`src/systems/eventTimers.js`) for my province beside the Bay's.

**One party, one ship.** A ship is an instance room (`kt:<voyage>.<captain's digest>`), run by the pure director
(`src/net/ketch/ketchBrain.js`). The door admits the captain, the captain's party by the hub's word, staff and returning
members - never a ninth, never a stranger, never a newcomer while it weighs anchor. A member rides back to the ship it
was taken into, whoever leads the party since.

**The stages.**

1. The Boarding Watch: `KT_WATCH_WAVES` waves of spheres, sentries and finally the Watch-Captain.
2. The Gallery of Hammers: hammers and steam lanes on the shared clock; two Hammer Wardens.
3. The Starved Engine: it eats aether cells, five and one for each two aboard, up to seven (`engineNeeds`).
4. The Sailwalk: drifting spars outboard over the sky, the Hour's course law (`src/net/eliteGates/egSpanLaw.js`); a fall
   is caught by the nets and cast back for 15% health. The bosun's line runs back once the bridge is unbarred.
5. The Tonal Warden.
6. The Ketchmaster's Cabin: each earner's share waits at the chest.

**The constructs** (`src/net/ketch/ketchConstructs.js`). Spheres, Sentries, Spiders, Hammer Wardens and the
Watch-Captain, run by the relay; every blow a shape stamp held at the wind-up floor. Health is `hpS` seconds of the
crew's reference damage. Each construct drops Pellets where it falls (`KT_CONSTRUCT_PELLETS`), up to
`KT_CONSTRUCT_PELLETS_MAX` a voyage.

**The cells** (the new mechanic). A member takes a charged cell from a cradle (`pick`), carries it to a socket (`bank`).
A carrier walks at `KT_CARRY_PACE` with its weapon put up. Any blow, a fall, or letting go drops it; it lies
`KT_CELL_LIES_MS`. A cradle recharges in `KT_CRADLE_BACK_MS`; spiders pour from the vents every `KT_SPIDER_EVERY_MS`,
at carriers first.

**The Tonal Warden** (`src/net/ketch/ketchWarden.js`, the boss seam). Each fighter brings `KW_TTK_S` seconds of reference
damage to its health; a fight empty for `KW_LOST_MS` is lost.

1. The Steersman (to 65%): Keel-Strike, Steam Lash, Tonal Ring.
2. The Discord (to 35%): warded while any of four resonators is false; every `KW_DISCORD_EVERY_MS` a quarter of
   everyone's health. Cells from the bridge's cradles put resonators right; all four break the ward and stun it.
3. The Last Note: the Keel-Song every `KW_SONG_EVERY_MS` unless every tuning-fork is broken; the outer ring's sections
   fall away in turn.

At `KW_ENDS_MS` the ship turns west: `KW_END_PCT` of everyone's health every two seconds.

**Judged where the client cannot skip** (`src/net/ketch/ketchJudge.js`). A body is struck only deep in a stamp on the
blow's own storey; a lane is caught when two poses straddle it. The relay believes no member faster than the fastest
build runs (`KT_FAST_RUN_MPS`, `ktLeastMs`): a cell is set no sooner than its walk takes, and the bridge unbars no
sooner than the Sailwalk's least crossing.

**Death aboard** is a fall: no penalty, the body wakes in the fields under the ship at a sliver of health. With a
crewmate aboard it first lies down `KT_DOWN_MS`, and a crewmate's Resurrect within `KT_REZ_REACH_M` raises it at
`KT_REZ_PCT`. The made level's rules (`src/systems/madeLevel.js`): no save, rest, map, Mark or Recall, portal stone,
companions, levitation or flight. Whole-bridge blows are paid once each (`src/net/ketch/ketchLink.js` `paidKeys`).

**The hold.** The receipt is `y1` (`src/net/ketch/ketchReceipt.js`), signed by the relay. The account service pays one
share a voyage and account (`server-account/src/ketch.js` `claimKetch`, `/v1/ketch/claim`); the same ship again from
the claiming device is the same kill, any other ship that voyage is `taken`. The hub keeps each earner's receipt and
hands it at every hello. The spoils (`src/systems/ketch/ketchSpoils.js`), rolled on the receipt's seed:
`KT_SPOILS_GOLD_PER_LEVEL` gold a level, a Legendary piece `KT_SPOILS_LEGENDARY` of the time (else Rare) and one Rare or
better, `KT_SPOILS_PELLETS` Pellets, the Dwarven Thunderlock (`KT_THUNDERLOCK_CHANCE`) and the Dwarven Pistolet
(`KT_PISTOLET_CHANCE`), and last two Gilded guns - Volendrung's Echo and the Ketchmaster's Word - at
`KETCH_GILDED_CHANCE` each (`src/systems/gilded.js`).

**On screen** (`src/ui/ketch/ketchHud.js`). The voyage tracker (stage, wave, cells, forks, crew, clocks) and the Warden's
bar. Every line goes through the text core (`src/systems/ketch/ketchWords.js`); the relay's own English refusals are
read back by key (`ketchRefusal`).

**The questline** (`skyKetch`, `src/systems/questlines/qlLines.js`, from Imrah Bel-Tavir): The Ketch That Never Lands,
The Starved Engine, The Tonal Warden (the title Skyfarer), and What the Lodestone Answers.

**The herald** (`src/net/ketch/ketchHerald.js`). Three Discord cards a voyage on the clock - sighted (pinging the role),
arrived, weighing anchor - each naming its station's city.

## Rules

- Online only, on the real clock; the relay runs each crew's ship and signs receipts; the service pays (the owner).
- Every ten hours (the owner).
- Eight players: one party, one ship (the owner).
- A new mechanic: pick up an item and bank it to progress (the owner) - the cells.
- Platforming, rooms with different encounters, a proper Dwemer boss (the owner).
- The guns drop here alone, with a Gilded version of each; any gun drop is rare (the owner).
- Constructs drop Pellets (the owner).
- One station per province at its crown capital; no site-bound world event in the open zone (the owner).
- The ship is "it", never "she", wherever a player reads; plain words (the owner).
- Raise before the fall: a crewmate's Resurrect works aboard inside the down window (the owner).
- Lore: the Rourken, Volendrung, aetherium and the Numidium are canon; the Mzunthar and its Warden are the port's own.

## Daggerfall Unity

Daggerfall has no airship, no other players and no raid; none of this is a DFU member. Carrying a cell in the hands is
a departure: Daggerfall carries nothing in its hands.

## Code and tests

- `src/net/ketch/` - law (clock, stations), deck, brain, constructs, warden, judge, receipt, claims, link, herald
- `src/scenes/ketch/` - sky, client, deck host, fight, shares, stations, standing
- `src/world/ketch/` - the made ship: model, kit, art, look
- `src/systems/ketch/` - spoils, words; `src/ui/ketch/` - HUD and map mark
- `server-account/src/ketch.js` - the share
- `test/net/ketch/` - the law, relay, everywhere stations, owed blows
- `test/scenes/ketch_client.test.js` - the client

How it looks: `Sky-Ketch-Look.md`.

## Open

- The fixed-city exterior host draws only the Bay's own Ketch; the interior and dungeon hosts lay the made level from
  the client's record.
