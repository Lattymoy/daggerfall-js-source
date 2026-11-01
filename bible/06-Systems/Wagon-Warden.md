# Wagon Warden

The town watch throws parked wagons out of town. When a parked team stands on a town road too long, or a town holds too
many, a guard jogs up, lifts the wagon and its horses over his head, and throws them along a high arc to land upright
outside town, cargo and all. Everyone online sees it. The owner walks out for the wagon or summons it. This is the
game's own joke; Daggerfall has nothing like it.

## How it works

**Who is watched.** A parked wagon (Horse Cart and Cargo's deployed cart, with or without its horse in the shafts), and
a horse standing within 12 m of it, which is thrown with it (`WARDEN_HORSE_BY_NATIVES`). A lone horse is never thrown.
Only in a city, hamlet or village (`src/systems/wagon/wagonWarden.js` `WARDEN_TOWN_TYPES`); a wagon on a road between
towns, at a farm or at a dungeon stands as long as it likes.

**The road.** A wagon is on the road when a third of its footprint (`WARDEN_ROAD_SHARE`) lies on the town's road cells,
sampled on a 3 x 3 grid over the town's walk grid. Ten real minutes after it came to stand there, it is thrown
(`src/net/wire.js` `WARDEN_ROAD_MS`).

**The crowd.** A town holds four parked teams (`WARDEN_TOWN_CAP`). A fifth throws the one parked longest, until four
stand, but one account is one team a town: an account's later teams there are thrown first.

**The landing.** Straight out through the town's nearest edge, preferring one whose landing stays in the wagon's own
map pixel, then its cell, 40 m past the edge (`WARDEN_LAND_PAST`), strayed up to 12 m along it so two seldom land in one
heap. The wagon keeps its cargo, paint and turn.

**Online, the relay keeps the clock.** The cell room that keeps a parked team (`06-Systems/Horse-Cart-And-Cargo.md`)
records when it came to stand. The owner's park word adds what the relay cannot know: the town, the road and the landing
(`validParkData`). The relay judges the cell's teams at every store, every hello and the first frame of anyone in the
room past the next road team's time (`Room._parkWarden` in `server/src/index.js`, over `wardenVerdicts`). A throw marks
the record, goes to the room, and tells the owner's sockets with `parkYeet`; an owner away is told when they next speak
for that spot. A word that moves the team clears the mark. An older relay throws nothing.

**The client** (`src/scenes/wagon/wagonWardenHost.js`). The save's parked wagon is stamped once the town under it is
built, and the stamp rides the save (`WARDEN_VENDOR`). The owner's throw is taken on the next street frame, never during
a load: the save moves to the landing and the owner is told. A reader sees the throw played, then the record moves. A
Caravan's visitor follows it to where it landed.

**Offline**, the client is the watch: the road's rule alone, on the stamp's own clock. There is no crowd offline.

**The throw, played** (`src/scenes/wagon/wagonWardenShow.js`). A watch guard (the city guards' sprite) jogs up the
town's streets, lifts the wagon in three heaves until it rests on top of his sprite, winds up and throws it, tumbling a
whole number of turns so it lands upright. The horse neighs, the swing whistles, the landing thumps. It is played only
within 200 m of the eye (`WARDEN_SHOW_REACH`); while thrown, the team is held out of the pool's own drawing, collision
and seats, and a rider in its back is stood down.

## Rules

- **Thrown outside town, fetched or summoned, cargo kept; everyone sees it; ten real minutes on a road; four a town,
  the longest parked first** (Mac).
- **One account is one team a town**, so one socket cannot clear a town.
- **The thrower stays a sprite** even where the watch walks in Morrowind bodies: the joke is the sprite under the wagon.
- With the Horse Cart and Cargo mod off, nothing is stamped or thrown.

## Code and tests

- `src/systems/wagon/wagonWarden.js` - the client's law: towns, road share, landing, stamp, offline clock
- `src/net/wire.js` - the park word's fields, `wardenVerdicts`, the relay's constants
- `server/src/index.js` - the relay's round and the `parkYeet` frame
- `src/scenes/wagon/wagonWardenHost.js`, `src/scenes/wagon/wagonWardenShow.js` - the host and the throw
- `test/systems/horse/warden1.test.js` - the wire, the relay on a fake clock, the client, the pool, the show
- `test/systems/wagon/warden1_audit.test.js` - one team an account, the spot, the landing, the show's ends

## Open

- Several accounts can still crowd a town.
- In a city that fills its map pixel, every landing is in the next pixel.
- A cell forgets a throw with its record (72 hours without the owner's word), and the owner is then never told.
- The single-town bench (`src/scenes/exterior.js`) runs no watch.
- A town by a coast or cliff may throw a wagon into the sea; the summon fetches it.
