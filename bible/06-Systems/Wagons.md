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
`src/world/wagonArt.js` paints fifteen 64 x 64 pictures from numbers (twenty
since WAGONS2 added the caravan's room - below), using the
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
- **Open Wagon**: 1500 kg, value 9000, hitched 7.1 m, four seats.
- **Caravan**: 2000 kg, value 25000, hitched 7.7 m, enterable.

WAGON-PRICE (2026-10-10) raised the two new kinds' values ten times, from
900 and 2500. Each kind also carries a `floor`, the price it was first
shelved at (150, 900, 2500), which the item law reads below.

How the kinds are wired in:

- **Shop**: the General Store shelves all three
  (`src/systems/shopStock.js`).
- **Names**: a marked row keeps the template's name, as every minted row
  does; what it shows is the kind's name (`wagonItemName`, read first by
  `src/systems/itemInfo.js` resolveItemName) - and, since the final audit,
  the guild vault's Put in, its rows and its log line (the account service
  names the row, `server-account/src/guildVault.js` pieceName) and the keyed
  shelf (`src/scenes/worldModes.js` `_itemLabel`).
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
interior host's own transition, its door a logical anchor at the caravan.
~~The room is the small ship's cabin, Warm Ashes' SHIPAA00.RMB.~~ Retired by
WAGONS2: the room is the caravan's own, its shape, turned with it (below).

The room is the player's own:

- it is kept for good in the save's scene cache under one name (a character
  has one caravan);
- the decorator furnishes it as it furnishes a house or a ship, paid from the
  purse;
- the wagon's storage is reachable inside, because Horse Cart and Cargo's
  door law gives the wagon to any building whose door stands within 50 m.

Leaving puts the player on the ground behind the caravan's rear door, grounded
by the host.

## WAGONS2 (2026-10-09)

Mac, the next message: "1. Comprehensive audit and this needs to be perfect
2. Overworld implementation 3. People should be able to use the interior just
like.hoises, like crafting and such 4. The implementation of the real window
overhaul, allowing players to see inside/outside of house windows + the new
wagon. 5. Exterior and interior texture customization of the wagons 6. Real
wheel movement".

Asked, Mac chose:

- **windows:** from outside, a fake room behind each house window (interior
  mapping, lit at night); from inside, the real world;
- **the caravan's room:** a room built from the caravan's own model, turned
  with it, its windows on the caravan's;
- **paint:** free, any time - the outside on the Stable's card, the inside in
  the decorator's paint tab - and seen by other players;
- **visitors:** like an online home - the owner sets private, party, guild or
  public, and visitors cannot take from the storage.

### The caravan's own room

`src/world/caravanRoomModel.js` builds the room from the caravan's bake: a
floor, two sides and two ends under a barrel ceiling (eight facets through
both eaves and the peak), each face looking in, all of it `CARAVAN_WALL`
inside the body. The sides and the front take the caravan's own u, so a point
is glass in the room's picture exactly where it is glass in the caravan's -
the windows meet.

`src/systems/caravanRoom.js` gives the room its own block (`CARAVAN_BLOCK`)
and model id (`CARAVAN_ROOM_MODEL_ID`, one no ARCH3D carries). The interior
host reads the block as any record. `src/scenes/caravanRoom.js`
serveRoomModels answers the model through the building's hold, so ARCH3D is
never asked. The lantern flat is `hang`ed from the roof and lit.

The room stands at the caravan's pose, turned with it: the descriptor is v2
(`turn` added; a v1 descriptor reads as turn 0), and the door is
`trs(origin, 0, turn, 0)`. Decor is kept translation-only, so the interior
host turns the scene back at its cache and forward at its restore
(`turnCaravanScene`). A caravan parked another way round keeps its furniture
where it stood in the room.

A travelling room (a caravan, a ship's cabin) is no town's layout: the WD3
layout stamp skips it. Before this, a ship's cabin's decor was held back by a
town's stamp - fixed with it.

The owner uses the room as a house: the decorator, its crafting stations,
rest, and the wagon's storage. Visitors: below.

### The paint

`src/systems/wagonLooks.js` is the law. A wagon's paint rides its item:
`wagonLook` is `{ o, w, f, c }` - the outside (every kind), and the
caravan's walls, floor and ceiling. Each list has six choices, the first the
wagon as built. A look the law does not know reads as built; the built look
keeps no field. Painting costs nothing.

`src/world/wagonArt.js` paints each choice past the first to its own records,
`LOOK_RECORD_STRIDE` (100) from the built ones. The caravan's glass is a hole
(alpha 0, uploaded as a cut-out). The outside draw remaps the wagon's records
to its paint's (`src/scenes/horseCartPool.js` lookRemap); the caravan's room
inside its body is drawn in its inside paint, casting no shadow.

The room's faces wear LIVE records (choice 9). A paint is painted into them
(`paintCaravanRoom` - each let go, then uploaded again), so a paint chosen in
the room is on its walls the next frame.

The Stable's card lists the driven wagon's outside paints. The decorator's
Paint tab in a caravan lists its walls, floor and ceiling.

On the wire the look is one number, `wl` = o + 6w + 36f + 216c (at most 1295):
on the hv word and on a parked team's record. A bad code reads as built.

### The wheels

Each wheel rolls on its own: `src/systems/horseCart.js` wheelContacts and
rolledAngles turn each by its own contact's travel, along its own heading,
over its own radius. A wheel with no contact last time keeps its angle.

The open wagon's and the caravan's front axle, pole and front pair turn on
their kingpin (`src/world/wagonModels.js` bogie). The lock is measured off
the bake (steerLimitOf): **6.85 degrees** either way, since the front wheels
stand outside the body's side. They trail as two bars
(`src/systems/horseFollow.js` bogieAxle): the kingpin on the pole from the
hitch, the body on the wheelbase from the kingpin.

A dismount keeps each wheel's angle and the steer (`rest`); a load forgets
them. Another player's wagon is turned here, off the pose drawn here, seeded
by the word's angle. Under the Overworld each grown wheel keeps its own clock.

### The Overworld

A wagon is drawn grown with its rider under the Overworld (OW-BIG).
`src/scenes/horseCartPool.js` drawnFrameOf is the one drawn frame for the
wagon and what sits in it:

- the others seated in my wagon are drawn on its grown seats (seatGlue);
- my body is drawn on my seat (`src/player/motor.js` drawFeet);
- a seated companion's sprite is stood and grown there (seatDraw);
- a peer's companion in their wagon's back is drawn in their grown wagon
  (puppetSeatDrawn) - taken for seated by where it stands, no wire change.

The bodies themselves stay on the true seats.

A rider seated in another's wagon sets out on no journey of their own. The
Overworld refuses it, as it refuses a boat's passenger, and the party's walk
never takes them. The owner's word unheard for a moment is not the owner
gone: a rider sits on through `RIDE_LOST_GRACE_MS`. A journey telling its
riders cannot be set out on twice.

### The team mounted again (audit)

Mac's wagons' hitches are longer than the mod's 3.1 m, so the mod's reaches
(the player 5 m from the wagon, the horse 3.5 m) could not be met. A team
parked with its horse in the shafts could not be mounted again. The reaches
now measure to the wagon's run, from its anchor forward by `hitch - 3.1`
(`src/systems/horseCart.js` nearestOnWagon). The store's reach is measured
the same way.

### Visits (WAGONS2-VISIT)

Mac, item 3: "People should be able to use the interior just like houses,
like crafting and such". Asked who may come into a player's caravan online,
he chose "Like an online home": the owner sets who, and visitors cannot take
from its storage. They come in "to craft, rest, look around". Online only.

**Who may enter** is the caravan's own (`src/systems/caravanVisit.js`):
`wagonEntry` on the caravan item, one of an online home's four entries
(`src/net/homeLaw.js` HOME_ENTRIES). Absent, the owner alone.

- Online, the owner's parked caravan lists "Who may enter: Only me". A press
  turns it round as a home's door does (`homeNextEntry`).
- It rides the word (`hv`'s `we`, and for the guild entry `wg`, the guild's
  tag) and the cell's park record (`validParkData`), so it holds while the
  owner is away.
- A visitor's client reads it as a home's door is read (`homeMayEnter`): the
  owner by the relay's stamp, the party by its signed handles, the guild by
  its tag. As with homes, the check is the client's: the relay keeps no door
  for `caravan:<k>` (it gates only `owned:` rooms), so a modified client can
  join an "Only me" caravan's room and hear what its owner placed. That is
  the homes' own law, kept on purpose (the final audit named it, and left
  it).

**The room** is the caravan's own on the relay: `caravan:<k>`, where `k` is
the owner's park key, the key the cell's record carries
(`src/net/privateInterior.js` caravanRoomOf). Its poses are in MapsFile's
frame. The owner inside stands in it too (`src/scenes/world.js`
privateRoomHere): before, the owner got a town building's room in a town and
no room in the wilderness, so their party lost them. An older relay is asked
for no caravan room.

**What the owner placed** is said to that room (the `caravan` frame,
`{ c, d }`): the pieces as the save keeps them, unturned, through the decor
law, as many as fit the frame. It is sent on every welcome to the room and on
every change. The relay keeps the last one from the owner alone, hands it to
each joiner, and forgets it 72 h (PARK_TTL_MS) after it was said. What the
storage holds never leaves the owner's save.

**A visit** needs no owner present: a parked caravan whose cell keeps its
record, on a relay that keeps caravan rooms.

- Its plaque lists "Step inside" where its door is open to me, at the mod's
  3.2 m reach.
- The press builds the same room at that caravan's pose, in its owner's inside
  paint, through the one door law and the one transition. It is a private
  visit: my own scene cache is neither read nor kept.
- The owner's pieces stand, turned with the caravan as it stands here.
- A visitor looks around, crafts at its stations and rests. They never open
  its storage ("This belongs to <owner>."), never decorate, drop nothing and
  cast nothing (a home visitor's rules).
- A save made visiting comes back outside.

**Moved on or gone.** Inside, a listener joined to the caravan's cell with no
presence (`src/net/caravanVisitLink.js`) hears its record. If the caravan
moves past 2 m, stops being parked or a caravan, or is gone, I am stood
outside behind its door and told "The caravan has moved on. You step
outside." A repaint reaches the room live.

**The relay** (world187, re-hashed in place - world183, world185, then
world186, until the merges past main's CHAP4c, PERF-RELAY1, INT7-INT10 and
SD-HERALD): the
`caravan` frame and its keeping,
`relaySupportsCaravan` at 187, and the park record's `we`/`wg`.

**Known limits.** Visitors see the pieces as the owner placed them the last
time the owner stood in the caravan online. A paint changed inside reaches
the cell when the owner comes out. The stations a visitor may use are the
ones the owner's document lists, as the door is the owner's client's to keep
- a modified owner client could list a station it does not have.

**The visits' audit.**

- The relay meters the `caravan` frame: one document a second from a socket
  (CARAVAN_DOC_MIN_MS), an unchanged one neither stored again nor fanned
  until its lease wants renewing, the fan charged to the sender's own act
  bytes. Re-hashed in place.
- The listener hears the cell that keeps the record (the record's own room),
  not the cell the drawn pose names.
- A door set against a visitor while they stand inside stands them out,
  told why ("<owner> has shut the caravan's door. You step outside.").
- Who may enter is never carried to a new owner: `wagonEntry` is one of the
  receiver's marks the wire's clamp leaves behind
  (`src/net/realmTradeLaw.js` RECEIVER_MARKS), and the vault's receipt drops
  them too. A bought caravan opens to its owner alone.
- The owner's name is the relay's stamp on the record, never a stale peer
  id's.
- A rider seated in another's wagon is offered no visit.
- At an older relay, my own caravan keeps the owned room it had before.

### Windows (RW1)

Mac's item 4 named the new wagon too ("+ the new wagon"). The caravan's
windows are holes in its pictures, uploaded as cutouts. From inside, the
view out paints the street behind them, as it does behind a house's glass.
The street pass draws the wagons standing outside, but never the caravan
whose room the player stands in. `07-Rendering/Real-Windows.md` has the
whole law.

### The room waits for its caravan (audit)

The room is the character's. It is kept for good in the save whether or not
a caravan is owned, and the next caravan opens onto it.

An earlier audit sold the room back (`decorSold`) when the last caravan left
the pack. That was retired: the pack is not a sale. Staging a caravan at a
shop's Sell and taking it back emptied the room, and so did a trade or a
market listing that was cancelled - and what the room's storage held was
lost.

### The second audit (four lenses)

Items and economy, motion and drawing, the caravan's room, and online.

- **The loaded wagon stays.** The wagon a player drives while it holds
  anything cannot change hands. A trade, the market, the guild vault and the
  keyed shop refuse it (`src/systems/tradePack.js` packTradeRefusal; the
  trade and the market say why, the vault and the keyed shop leave it off
  their lists), as the counter's Sell already drops it. Since the final
  audit the account service refuses it too (`src/net/realmTradeLaw.js`
  takeTradeGoods). A loaded caravan
  traded away had left 2000 kg on a 750 kg cart.
- **The item law reads a wagon's mark.** `wagonKind` and `wagonLook` are
  declared fields (`src/systems/itemFields.js`). A mark on anything but the
  Small Cart, or a marked kind below its own floor, is a `wagon` finding
  (`src/systems/itemLaw.js`). The floor is the price the kind was first
  shelved at, so a wagon bought before WAGON-PRICE stays lawful.
- **A room only onto its caravan.** A room is restored only while the
  caravan stands parked where it was entered (`CARAVAN_STANDS_NATIVES`): the
  runtime's place at a Recall, the save's own record at a load. It is never
  entered from a seat in another's wagon.
- **Travelling rooms' layout copies folded back.** A ship's cabin visited in
  a town of another layout mod had been kept apart per layout. Those copies
  are folded into the room at its next visit (`src/systems/sceneCache.js`
  foldLayoutCopies).
- **The riders' ways out.**
  - An owner on the road, or with the model not yet up, keeps the riders'
    seats. The seats were being emptied on every journey.
  - Jump gets a rider down even while the owner is unheard.
  - A journey the rider cannot go on, or one that did not go, stands them
    down and says so (`RIDE_TEXT.leftBehind`).
  - A seat the wagon does not have seats nobody.
  - Asking another wagon from a seat gets down first.
  - A body moved off its seat by a load, a respawn or a teleport is never
    stood back beside the wagon (`GET_DOWN_REACH`).
  - Leaving the outdoors, dying or loading ends the ride.
  - The rider pays no fare.
  - A journey names a pixel of the travel map.
  - An owner's `ps` draws only a player who stands on that seat
    (`SEAT_GLUE_REACH`).
- **The drawing.**
  - A grown seated companion casts no shadow.
  - A peer's companion is taken for seated only at the seat's height, and
    only if it is a companion.
  - My body is never drawn at a stale grown seat.
- **The wheels.**
  - A four-wheeler parked at its lock is driven off at its rest steer
    (`hitchedPoseStep`'s `seedForward`). Before, it snapped straight and
    swung its body.
  - A change of kind under a standing team swaps the new kind's parts in.
  - A parked peer's wheels do not roll when the ground re-stands it.
  - A peer's change of kind starts its wheels afresh.

### The final audit (five lenses, after the merges that renumbered the relay world185, world186, then world187)

The relay and the visits, the riders and the wheels, the caravan's room as a
house, the windows' render half, and the items with the docs and the pins.
Each fix is pinned in `test/wagons2_final.test.js` (or beside its own law's
tests) and has its mutants in `tools/mutants/wagons2_final.json`.

- **The relay** (re-hashed in place; world187 since main's INT7-INT10 and SD-HERALD took world185 and world186).
  - The `caravan` frame's second is the room's, not a socket's
    (`CARAVAN_DOC_MIN_MS`): one account's many sockets in its own room were
    one second each.
  - Its fan is charged to the room's act bytes after the sender's, as an
    act's is.
  - A fan refused while a bucket is in debt is owed, not dropped: the alarm
    at the repay sends it (`_caravanFan`). Nothing said an unchanged document
    again, so its visitors kept the old layout.
- **The owner's own room after a load inside it.** A fresh session has had no
  welcome to say its relay, and with no room it never has one; the world
  channel's word stands for it (`caravanRelayOk`).
- **A save or a Recall that cannot come back lands at the rear door.** A
  visit's save, a caravan moved or sold, or the mod off: the player stands
  behind the door it was made by, told "You stand outside the caravan."
  (`caravanDoorLanding`). It fell to the building's no-door arm (the pixel's
  centre, a town's roof) and a Recall stood inside the wagon's body.
- **The room comes back onto its caravan as it faces.** A caravan re-parked
  on its own spot facing another way is another room (`CARAVAN_STANDS_TURN`,
  15 degrees; `parkedCaravanAt`'s heading).
- **A hired trader in a home alone.** A caravan or a ship had it sold for
  25,000 gold and never trading (`stationsOffered(trader)`, the view's
  `trader`).
- **The hosts' last seams.** The fixed city's windows show its wagons in the
  street, and staff sent to a player in a caravan land behind its rear door.
- **Names.** The Open Wagon and the Caravan by their own names in the guild
  vault and on the keyed shelf (above, Names).
- **One home each.** The counter's wagon guard (`sellGuardOf`, six copies in
  two trade windows, pinned nowhere) and the loaded wagon's law
  (`wagonLoadedHeld`, the pack's and the keyed shelf's). Every plan the two
  inventories make reads the driven wagon's capacity (pinned by walking the
  calls).
- **The words.** "The floor is now red rug." (it said "are"); out of reach,
  "You are too far away..." (it said there was no room); an Accept after the
  ask lapsed says so; the ride's strip stands below the duel's.
- **The riders.**
  - A rider's own word (`wr`) seats them in the drawing however far their
    pose lags at the Overworld's pace (`sitsIn`); an owner's word alone still
    draws nobody. A peer's companion is read by its own record against the
    wagon's own word (`wordSeat`).
  - A teleport while seated ends the ride where the body landed (each frame's
    pin undid it).
  - A seated rider sets out on no journey of their own: the classic arm of a
    journey and a fast travel of their own refuse it, as the Overworld did.
  - The far end's wait runs for the journey this ride followed alone.
  - Riders go only with the wagon: an owner whose wagon stays (parked, or a
    following team left at the departure) gives up the seats before leaving
    (`wagonGoesOnJourney`, `release`).
  - A seat lost to another tab clears the book.
- **The windows** (also in `07-Rendering/Real-Windows.md`).
  - The view out is lit by the weather and the cloud as the street frame is
    (`viewOutLight`): a rainy noon was a clear day's, the air brightened.
  - Deep Waters' sea is in it: a pure-ocean pixel's seafloor and the carved
    sea's top.
  - A room drawn dark wears no amber bloom (`RW_SEED_GLSL`, one seed for the
    room and the emission replay; compiled and linked in Chromium).
  - The target keeps the larger side, is let go when the street is off, and
    is sized by the world's own image, not the canvas.
- **Pins that pinned less than they said**, made to bite: the bracket's frame
  target, the release, the pictures' count (twenty), and the loaded wagon's
  law on the keyed shelf.

**Known limit (the final audit).** Glass counts as in view while it is in
the camera's frustum: interiors are drawn whole, so a window in another room
behind walls keeps the street pass running while the player moves. The cost
is bounded (VIEW_SCALE, VIEW_MAX_SIDE, one pass a frame); an occlusion query
on the glass is the fix, not made blind here.

## The relay

A parked team's record (HCC-PARK) now keeps the wagon's kind and whether a
horse stands in it (`wk`, `wh`; `src/net/wire.js` validParkData) - and, since
WAGONS2, its paint (`wl`). That is a relay change, so RELAY_VERSION is
`world187` (world182, world183, world185, then world186, on the branch -
renumbered past main's at each merge). Until the relay is deployed, a parked wagon the relay restores
comes back as the Small Cart, as built.

## THE FOUR HOSTS

- `src/scenes/world.js` - wired: the models, the kinds, the capacity, the
  stable, the caravan's door, the riders and the companions' seats; since
  WAGONS2 the paint, the Overworld's seats, the visits (the plaque's rows and
  word, the visit's door, the room's key, the owner's pieces, the listener).
- `src/scenes/exterior.js` (the fixed city) - wired for the models, the kinds,
  the capacity, the stable and the paint, and (the final audit) its windows'
  view out of the street's wagons. FLAGGED: no caravan room, no riders
  and no visits. It has no peers and no private-room path, so the plaque lists
  none of those rows.
- `src/scenes/worldModes.js` - the caravan's room: its entry, save field,
  restore, decor kind and exit; since WAGONS2 its turn, its paint tab, the
  visit (the guest's stations, bed and refusals, the pieces stood and
  published) and the travelling rooms' layouts.
- `src/scenes/dungeonContext.js` - draws no wagon. FLAGGED: no caravan room,
  no riders and no visits.

## Pins

- `test/wagons1_bake.test.js` - the bake.
- `test/wagons1.test.js` - the kinds, capacity, pictures, parts, measures,
  faces, cargo, seats, icon, pool, cart's tilt, caravan's row, the word and
  the hosts.
- `test/wagons1_seats.test.js` - the seats' words, the owner, the rider, the
  journey, the companions, the caravan and the interior host.

- `test/wagons2.test.js`, `test/wagons2_wheels.test.js` - WAGONS2 and its audit.
- `test/wagons2_visit.test.js`, `test/wagons2_visit_relay.test.js` - the visits.
- `test/wagons2_final.test.js` - the final audit (and its riders' and
  windows' pins beside their own, in `wagons2.test.js` and
  `windows1_view.test.js`).

The mutants are in `tools/mutants/wagons1.json`, `wagons2.json`, `wagons2_wheels.json`, `wagons2_visit.json` and `wagons2_final.json`. Records re-aimed:
`audit29.json`, `companionweight.json`, `disc8.json`, `disc24.json`,
`hcc.json`, `homevendor.json`, `prwagon1.json`, `soc1.json`,
`wagonhitch.json`.

Not seen in a browser: this container has no ARENA2 data.
