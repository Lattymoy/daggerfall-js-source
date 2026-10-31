# Living World

The living world turns Daggerfall's anonymous street walkers into residents who keep a name, a face, a home and a day.
They work, shop, eat, drink, sleep, talk to each other, lodge at inns, travel between towns, dive into dungeons and
remember how the player treated them. The player meets it on every town street and road in the enhanced skin, with
the Features row `living-world` on (the default). The classic skin, or the row off, keeps DFU's walkers. The roads,
caravans, outlaws, companies, patrons and travelling news are on `06-Systems/Living-World-II.md`.

## How it works

**One clock, nothing sent.** Every resident, plan, trip, caravan, encounter and dive is a pure function of the world's
own data (MAPS, BLOCKS, the roads), a seed and the sky clock (`worldTick.js` `skyMinutes`). Every player on a page sees
the same baker walk to the same oven at the same minute, and nothing crosses the relay. A rest, a wait or a journey
moves the clock, and the people move with it. Online, two read-only inputs narrow it: the chapter sheet (a guild's
evenings at its hall) and a town's economy band (its talk of trade, a market town's market days).

**The census** (`src/systems/livingWorld/census.js`). A town's residents are minted from its buildings: each house a
household, each shop its keeper, each tavern its staff, temples their priests, guild halls their members, the palace
its court, and the town's size its watch, merchants, adventurers and, at a port, sailors. Slot `i` of a town is the same
person for every reader: `L<mapId>.<i>`. A town holds ten residents a block, at most 520 (`CENSUS_PER_BLOCK`,
`CENSUS_CAP`). A capital cut from a larger city is a town of quarters, each street net its own (`places.js`
`quartersOf`).

**The places** (`places.js`): every door's navgrid cell, the social spots (before taverns, temples, guild halls, the
palace and the square), the market spots before shops, and the exits.

**The day** (`dayPlan.js`). A resident's day runs 04:00 to 04:00, drawn from their seed: wake by temper, work at a
trade, errands into shops and guild halls, a meal, the evening's tavern, temple or square, home, sleep. Walks follow
the navgrid's A* (`townPaths.js`) at DFU's walking pace, 1.3 m/s, so a resident beside the player keeps pace with
them. Indoors, residents stand through the whole room; a traveller, a crew ashore or a tavern-dwelling adventurer
lodges in a room by one of the inn's beds, never one the player rents.

**The street stirs** (`stir.js`). Two or three residents with time free meet at a social spot and talk in short scripted
exchanges about their trades, the weather, the temple and the roads (`meetups.js`, `lines.js`). Now and then an
incident plays out: a gate guard questions a traveller, a quarrel the watch breaks up, and more. A resident standing
still keeps moving rather than freezing into a still picture.

**Looks** (`looks.js`). Every part is DFU's (the climate's people, `PERSON_TEXTURES`, the talk portrait, `fullName` on
the region's name bank), drawn once from the resident's seed instead of at every spawn. Beyond the walls a fighter
wears their class's sprite; in town, one with a calling (a guild member, a temple's priest) wears it all day.

**The watch.** Three shifts keep the town round the clock (`dayPlan.js` `WATCH_SHIFTS`): a gate post at each exit,
the rest on patrol in pairs, with more patrols in bigger towns (`census.js` `watchExtraOf`). A watchman wears uniform
only on duty. The watch calls Halt as one voice, at most once every 15 seconds (`enemySounds.js` `HALT_GAP_S`). It
greets or warns the player by their legal standing and warns before arresting for a first minor offence
(`src/scenes/arrestFlow.js`). Monsters may attack townspeople, and the watch comes to defend them (`quarry.js`).

**Friends and enemies** (`relations.js`). Each resident holds a regard of the player's character from -100 to 100:
a friend at 40, an enemy at -40, hostile at -70. Words, help in a fight, a blow or a crime seen move it, and it eases
back half a point a day of the character's own time (`regardClock.js`). A friend greets the player by name and may be
courted; an enemy will not talk, and an armed one draws on the player beyond the walls. The record is the character's,
saved as modSaveData vendor `LivingWorld`.

**The roads, the ports and the deep.** Travellers' trips are drawn a cycle of days at a time from their seed
(`trips.js`), walked by day on the Travel Options planner's roads and camped by night. Trouble on a leg is rolled
against the party's strength, and a player near at that minute sees it fought and can turn it (`trouble.js`). A sea
leg rides the sea lanes' packets, and a port's sailors are their crews (`portCrews.js`). An adventurer's dive goes in
at the dungeon's door; the fallen lie where they fell, with a keepsake the player may carry home to their household
(`keepsake.js`). A traveller slain is gone for good, and a newcomer takes the place after the town mourns (`lives.js`).

**Past the Bay.** The towns and dungeons come from the world's registry (`src/scenes/livingWorld/livingIndex.js`), so
every listed place past the Bay has its residents. Travellers keep to their own side of the Bay's edge: the Bay's
living world is every client's, while the land past it is only on clients that stand it (`livingSide`). Ways past the
Bay are planned on the roads there (`beyondWays.js`), and road trouble rolls the province's own beasts
(`src/scenes/livingWorld/troubleFoes.js`).

## Rules

- **The enhanced lane, a Features row** (`src/systems/livingWorld/livingSwitch.js` `livingWorldOn`): on by default,
  the player's own; off, the classic skin keeps `src/systems/town/townPopulation.js` as DFU has it.
- **Pure, seeded, on the sky clock**; no byte on the relay (Mac). New traveller jobs are appended to the roster so no
  saved regard is re-keyed.
- **A resident keeps their identity for life**; armour is the class sprite (Mac, "Class looks + still flats").
- **Relations are the character's**: the world is shared, how it feels about the player is the player's.
- **The watch** (Mac): round the clock, gate posts and patrols in pairs, uniform only on duty; Halt "once, then
  rarely"; the watch knows the player; the watch protects the town's people.
- **Lodgers in their rooms** (Mac); **town density by size** (the owner); **more street incidents** (the owner);
  **more watch presence** (the owner).
- **Cost**: the roads' layer stays within 6 ms a frame on `tools/livingPerfProbe.mjs`.

## Daggerfall Unity

DFU's `PopulationManager` keeps a pool of identity-less walkers around the player, re-rolled at every spawn, wandering
by tile weights and gone at dusk; nothing travels, sleeps or remembers. This game keeps it whole in the classic lane.
The living world replaces it in the enhanced lane because Mac asked for a world whose people have lives. DFU's
`EnemySenses` never lets a monster target a civilian; the living world lets one, so the watch has someone to protect.
DFU gives each watchman his own Halt clock; the living watch speaks as one.

## Code and tests

- `src/systems/livingWorld/` - census, places, day plan, paths, meetups, lines, stir, looks, relations, trips,
  trouble, lives, keepsakes, quarry
- `src/scenes/livingWorld/` - the host's living modules: the index, roads, trips, indoors, the watch, the fallen
- `src/systems/livingWorld/livingTown.js` - a town's residents on the street, and what the player's deeds do to them
- `test/systems/livingWorld/` - the census, the day, the roads, the deep, the watch, density, incidents
- `test/scenes/lw7b_beyond.test.js`, `test/scenes/haltone_watch.test.js` - beyond the walls, the watch's one voice
