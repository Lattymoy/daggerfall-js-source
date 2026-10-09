# The three wagons (WAGONS1, 2026-10-09)

Mac, sending `Wagon_Cart_1.fbx`, `Wagon_1.fbx` and `Caravan_1-1.fbx`:
"Here are 3 new models that will need to be textured 1. Is a replacement
model for the current cart ingame 2. Theres an open wagon which I want to
implement as a new type of cart with increased storage and the ability for
players to request to sit in the back of the cart and be transported across
daggerfall 3. Is a closed wagon varient that also increases storage but also
acts as an enterable and customizable interior". Then `Wagon_Cart_Tiny_1.fbx`:
"This might be the small cart. Im not sure".

Asked, Mac chose:

- the **Wagon Cart** (the scene's station at X 57) as the Small Cart's new
  model;
- **players and companions** as the riders in the open wagon's back;
- the new wagons **bought like the Small Cart**, with capacity stepping
  750 -> 1500 -> 2000 kg;
- **one branch** for all of it.

Not a DFU member: the port's own, built on Horse Cart and Cargo
(`06-Systems/Horse-Cart-And-Cargo.md`). Ledger A (WAGONS1).

## The source and the bake

The four files are ONE Blender scene (`wagons.blend`) saved four times. Mac
keeps his wagons as working stations along the scene's X, and every save added
one, so the newest file is a superset of the other three, object for object.
It is the one committed: `src/assets/wagons/source/Wagon_Cart_Tiny_1.fbx`.
`tools/bakeWagons.mjs` bakes three wagons out of it into
`src/assets/wagons/cart.json`, `openWagon.json` and `caravan.json`.

The bake works like the ships' bake (`tools/shipBake.mjs`):

- each wagon is mirrored into the port's left-handed frame, in metres;
- +z is the way the wagon is pulled;
- the origin is on the ground under the rear wheels' centres;
- one scale, 0.45, holds for all three.

Two stations are skipped by name:

- a second caravan at X 25, an earlier draft never sent as its own file;
- the handcart at X 74. This is the Tiny file's own station; Mac was unsure of
  it, and the Wagon Cart was chosen over it.

The joined copies above Y 15 are skipped too. `test/wagons1_bake.test.js`
re-bakes all three files byte for byte. It also refuses a scene that moves
under a spec: a part out of its box, an object no spec names, or a skipped
station standing inside a wagon.

None of the files carries a texture, so the art is painted.
`src/world/wagonArt.js` paints fifteen 64 x 64 pictures from numbers, using the
fleet's tools (`src/world/galleonArt.js`) under the pseudo-archive 38181:

- oak sideboards, pine floorboards, dark oak running gear;
- iron tyres and seven-spoke wheel faces;
- the open wagon's canvas tilt over its box, as one livery on its height;
- the caravan in a travelling family's colours: bottle green picked out in
  oxblood and gilt, shuttered side windows, a round front window under a
  sunburst, and its door painted on the rear end.

`src/world/wagonModels.js` lays every face on its picture (`wagonFaceSkin`). It
builds each wagon into the parts the cart's presentation draws: its statics,
each wheel re-based on its own turning centre, and the rear pair used for the
parked two-wheel solve. It also adds the port's own extras:

- `cargo`: the classic twelve cargo pieces, laid in this bed;
- `seats`: the open wagon's four;
- `hitchPitch`: the cart's tilt;
- `door`: the caravan's.

Every part is lowered by Horse Cart and Cargo's one-metre ground offset
(NORMAL_GROUND_OFFSET), so the wheels meet the ground where model 41214's do.

## The kinds

`src/systems/wagonKinds.js` is the law. DFU has one cart: Transportation's
Small Cart, template 93. Every "has a cart" check in the port asks for that
template, so the new wagons are that same item with a mark: `wagonKind`
(`openWagon` or `caravan`; absent means the Small Cart). The kinds:

- **Small Cart**: 750 kg, value 150, hitched 3.8 m, no seats.
- **Open Wagon**: 1500 kg, value 900, hitched 7.1 m, four seats.
- **Caravan**: 2000 kg, value 2500, hitched 7.7 m, enterable.

How the kinds are wired in:

- **Shop**: the General Store shelves all three
  (`src/systems/shopStock.js`).
- **Names**: a marked row keeps the template's name, as every minted row
  does; what it shows is the kind's name (`wagonItemName`, read first by
  `src/systems/itemInfo.js` resolveItemName).
- **Driving**: a player who owns more than one drives the best
  (`activeWagonItem`).
- **Capacity**: the wagon store, both inventories and both counters read the
  driven wagon's capacity (`wagonKgFor`; `src/systems/itemTransfer.js`
  planStore's `wagonKg`).
- **Stable card and icon**: the Stable card names the kind, and the pack's
  icon is the kind's model.

**The Small Cart's model is replaced.** The classic wagon 41214 is no longer
drawn for the cart; Mac's Wagon Cart is. Eye of the Beholder's own cart
(41239) is that mod's model and is untouched.

## Hitching

**Departure (HITCH LENGTH).** Horse Cart and Cargo hitches its horse 3.1 m
ahead of the wagon's axle (HITCHED_HORSE_LOCAL_Z, measured for 41214). Each of
Mac's wagons is longer, so each kind carries its own hitch, measured off its
model. `src/systems/horseCart.js` `hitchZ()` reads it from the presentation
(`hitchOf`) at every site that read the constant, and the constant still
answers when there is no presentation.

**Departure (THE CART'S TILT).** Mac drew the Wagon Cart standing as a cart
stands unhitched: tipped forward on its one axle, with its shafts' tips on the
ground (10.1 degrees). Parked without a horse, it is drawn that way. With a
horse in the shafts, the presentation turns it back about its axle, so its bed
is level and its shafts sit at the horse's flank.

## The seats in the back (the Open Wagon)

`src/systems/wagonSeats.js` is the law and `src/scenes/wagonRiders.js` runs
both ends of it on the world host.

**A player rides by asking.**

1. Another player's open wagon lists "Ask to ride" on its plaque, within 6 m.
2. The press says `wr: { a: owner }` on the rider's foes frame.
3. The owner sees the ask on the duel strip (`src/ui/duelPrompt.js`).
4. Accept seats the rider in the lowest free seat. Decline turns them away,
   and they may not ask that owner again for 15 s. An unanswered ask lapses
   after 30 s.

**Who sits where** is the owner's word alone: `hv.ps` on the owner's wagon,
at most four, each rider and each seat once. A rider is seated only while that
word names them. While seated:

- their feet are pinned to the seat on the wagon as drawn here;
- their motor is held;
- they say `wr: { s: [owner, seat] }`.

Jump, the owner's word dropping them, or the owner leaving the room stands
them down beside the wagon.

**Across Daggerfall.** When the owner fast-travels with riders aboard:

1. The owner's word says `go` and the travel waits a moment (GO_LEAD_MS) so
   the riders hear it.
2. Each rider follows on the party's own journey
   (`src/systems/partyTravel.js`), with no fare, since the owner paid.
3. They land beside the owner's wagon and sit down again.

**Companions** take the seats the players have not, while the wagon goes with
its owner (trailing behind the cart, or following). When it is parked they
step down and walk at heel (`src/scenes/crewAshore.js` `seat`; the motor's
seat gate in `src/characters/enemyMotor.js`).

**Departure (STANDING RIDERS).** Riders and companions ride STANDING in the
bed. The port's people are billboards and DFU has no seated pose to give
them.

**The word rides the foes frame** (`hv`'s `wk`, `wh`, `ps`, `go`, `pn`;
`src/systems/horseCartWire.js`), which the relay carries as it is. An older
client drops what it does not know.

## The caravan's room

`src/systems/caravanRoom.js` is the law and `src/scenes/caravanRoom.js` is
the door. A parked caravan's plaque lists "Step inside".

The caravan is entered as a ship's cabin is (SAILING-CABINS): through the
interior host's own transition, into a room Daggerfall already has. The room
is the small ship's cabin, Warm Ashes' SHIPAA00.RMB, its door a logical anchor
at the caravan.

The room is the player's own:

- it is kept for good in the save's scene cache under one name (a character
  has one caravan);
- the decorator furnishes it as it furnishes a house or a ship, paid from the
  purse;
- the wagon's storage is reachable inside, because Horse Cart and Cargo's
  door law gives the wagon to any building whose door stands within 50 m.

Leaving puts the player on the ground behind the caravan's rear door, grounded
by the host.

## The relay

A parked team's record (HCC-PARK) now keeps the wagon's kind and whether a
horse stands in it (`wk`, `wh`; `src/net/wire.js` validParkData). That is a
relay change, so RELAY_VERSION is `world183`. Until the relay is deployed, a
parked wagon the relay restores comes back as the Small Cart.

## THE FOUR HOSTS

- `src/scenes/world.js` - wired: the models, the kinds, the capacity, the
  stable, the caravan's door, the riders and the companions' seats.
- `src/scenes/exterior.js` (the fixed city) - wired for the models, the kinds,
  the capacity and the stable. FLAGGED: no caravan room and no riders. It has
  no peers and no private-room path, so the plaque lists neither row.
- `src/scenes/worldModes.js` - the caravan's room: its entry, save field,
  restore, decor kind and exit.
- `src/scenes/dungeonContext.js` - draws no wagon. FLAGGED: no caravan room
  and no riders.

## Pins

- `test/wagons1_bake.test.js` - the bake.
- `test/wagons1.test.js` - the kinds, capacity, pictures, parts, measures,
  faces, cargo, seats, icon, pool, cart's tilt, caravan's row, the word and
  the hosts.
- `test/wagons1_seats.test.js` - the seats' words, the owner, the rider, the
  journey, the companions, the caravan and the interior host.

The mutants are in `tools/mutants/wagons1.json`. Records re-aimed:
`companionweight.json`, `disc8.json`, `hcc.json`, `prwagon1.json`,
`soc1.json`, `wagonhitch.json`.

Not seen in a browser: this container has no ARENA2 data.
