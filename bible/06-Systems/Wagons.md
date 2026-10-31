# Wagons

Three wagons from Mac's models, built on Horse Cart and Cargo (`06-Systems/Horse-Cart-And-Cargo.md`): the Small Cart
with a new model, the Open Wagon with seats in the back for players and companions, and the Caravan with an enterable,
furnishable room. The player buys them at a town's Wagon Yard and drives them like the classic cart. Upkeep and wear
are on `06-Systems/Wagon-Upkeep.md`.

## How it works

**The kinds** (`src/systems/wagon/wagonKinds.js`). DFU has one cart, Transportation's Small Cart (template 93). The new
wagons are that same item with a `wagonKind` mark, so every "has a cart" check still works:

| Kind | Capacity | Value | Horses | Extra |
|---|---|---|---|---|
| Small Cart | 750 kg | 150 | 1 | none |
| Open Wagon | 1,500 kg | 9,000 | 2 | four seats, a driver's bench |
| Caravan | 2,000 kg | 25,000 | 2 | an enterable room, a driver's bench |

A player who owns more than one drives the best (`activeWagonItem`); the wagon store, both inventories and the counters
read the driven wagon's capacity (`wagonKgFor`). The Wagon Yard in every city and town sells and buys all three
(`src/systems/merchantYards.js`); horses come from the town's Stable, and the pack holds as many Horses as are bought.

**The models.** Mac's Blender scene is committed as `src/assets/wagons/source/Wagon_Cart_Tiny_1.fbx`;
`tools/bakeWagons.mjs` bakes the three wagons into `src/assets/wagons/cart.json`, `openWagon.json` and `caravan.json`,
and `test/tooling/wagons1_bake.test.js` re-bakes them byte for byte. The files carry no textures, so
`src/world/wagonArt.js` paints every picture from numbers in Daggerfall's palette. `src/world/wagonModels.js` builds
each wagon's parts: statics, each wheel on its own turning centre, the cargo bed, the seats, the bench, the door.

**Driving.** Each wagon hitches its team at its own measured length. The Open Wagon and the Caravan need two horses,
standing either side of the pole, and the driver sits on the front bench with the camera there, so the wheel takes
the view to third person as on foot. The Small Cart keeps one horse in its shafts, ridden the mod's way. Each wheel
rolls by its own contact, and the front axle of the two big wagons turns on its kingpin (6.85 degrees either way).
Traces and reins are Verlet ropes (`src/systems/wagon/wagonRopes.js`). A summoned wagon is laid where it cannot trap
the player under it. Under the Overworld a driven rig is drawn at a fixed readable length, not grown like the
traveller.

**Riding in the back** (`src/systems/wagon/wagonSeats.js`, `src/scenes/wagon/wagonRiders.js`). Another player's Open
Wagon offers "Ask to ride" within 6 m. The owner accepts or declines on the duel strip; an unanswered ask lapses after
30 s, and a declined player waits 15 s before asking that owner again. The owner's word alone says who sits where
(four seats). When the owner fast-travels, riders follow on the party's journey with no fare and sit down again on
arrival. Companions take the seats players do not, and step down over the side when the wagon parks
(`getDownPoint`). Riders ride standing.

**The Caravan's room** (`src/systems/caravanRoom.js`, `src/world/caravanRoomModel.js`, `src/scenes/caravanRoom.js`).
A parked Caravan offers "Step inside". The room is built from the caravan's own model, turned with it, its windows
where the caravan's are, showing the world outside. It is kept in the save, furnished by the decorator like a house,
and the wagon's storage is reachable inside. Leaving sets the player on open ground behind the rear door.

**Visits** (`src/systems/caravanVisit.js`), online only. The owner sets who may enter, as an online home's door: only
me, party, guild or public. Visitors may craft, rest and look around, but not take from the storage. The room is its
own relay room (`caravan:<k>`), and what the owner placed or took out is shown to visitors.

**Paint** (`src/systems/wagon/wagonLooks.js`). Free, any time: six choices for every wagon's outside on the Stable card,
and for the Caravan's walls, floor and ceiling in the decorator's Paint tab. Other players see it.

**On the wire.** The driven wagon's word rides the foes frame (`src/systems/horse/horseCartWire.js`); a parked team's
record keeps the kind, whether a horse stands in it, and the paint (`src/net/wire.js` `validParkData`).

## Rules

- **The Wagon Cart is the Small Cart's model; capacity steps 750, 1,500, 2,000 kg; riders are players and companions**
  (Mac).
- **Caravan visitors as an online home** (Mac): the owner chooses who enters; visitors cannot take from the storage.
  As with homes, the check is the client's.
- **Paint is free, any time, and shared** (Mac).
- **The bench and a team of two for the Open Wagon and the Caravan; the second horse is bought** (Mac).
- **Traces and reins for the ropes** (Mac).

## Daggerfall Unity

DFU's one cart is the Small Cart, model 41214, with no seats, no room and one horse. Departures, each this game's own:
the new model, the per-kind hitch length (the mod's 3.1 m fits only 41214), the cart's forward tilt when unhitched,
riders standing (billboards have no seated pose), the driver on a bench instead of riding the horse, two-horse teams
and their harness, and the Caravan's room. Eye Of The Beholder's own cart (41239) is untouched.

## Code and tests

- `src/systems/wagon/wagonKinds.js`, `wagonSeats.js`, `wagonLooks.js`, `wagonRopes.js` - kinds, seats, paint, ropes
- `src/world/wagonModels.js`, `src/world/wagonArt.js`, `src/world/caravanRoomModel.js` - models, art, the room's shape
- `src/scenes/horseCartPool.js` - drawing wagons, teams, harness and riders
- `src/scenes/wagon/wagonRiders.js`, `src/scenes/caravanRoom.js`, `src/systems/caravanVisit.js` - riders, the room, visits
- `tools/bakeWagons.mjs` - the bake
- `test/tooling/wagons1_bake.test.js`, `test/systems/wagons2_final.test.js`, `test/scenes/fb1018_wagonalight.test.js`

## Open

- The Small Cart has no bench, so the Morrowind body stays in first person on it.
- Eye Of The Beholder has no sitting art; its sprite stands on the bench's footboard.
- Horses are billboards, so a trace meets the picture beside the chest from some angles.
- A floating-origin recentre on the very frame a wagon parks can leave a companion standing in the bed until it
  walks out at heel.
