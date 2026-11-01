# Horse Coats

Every horse is born with its own look: a coat, a pattern, legs and a seed that places its markings. The owner can
change the coat, pattern and legs on the Stable card at any time; the markings stay where they fell. The player sees it
on the riding sprite, the standing and following horses and wagon teams, their own and other riders in the saddle,
the 3D horse in the Morrowind lane, and the horses on the road. Daggerfall has one bay horse; this is the port's own.

## How it works

### The look (`src/systems/horse/horseCoats.js`)

A look rides the horse item (DFU's Transportation Horse, template 94) in four fields, declared in
`src/systems/item/itemFields.js`:

| Field | Values | Absent |
|---|---|---|
| `horseCoat` | `HORSE_COATS`: bay, chestnut, black, grey, dun, buckskin, palomino | bay |
| `horsePattern` | `HORSE_PATTERNS`: solid, pinto, appaloosa, dapples, roan | solid |
| `horseLegs` | `HORSE_LEGS`: plain, socks, stockings | plain |
| `horseSeed` | 1..65535 | not yet born |

The seed places the pinto patches, appaloosa spots, dapples, roan flecks and the tops of the socks, and shades the
coat a little off any other (`shadeOf`). The look worn is the ridden horse's, the first horse in the pack
(`riddenHorseLook`).

- **Born unique.** A horse with no seed is born where it is next looked at (`birthHorses`, in both exterior hosts'
  tick and before the Stable card reads it): coat, pattern and legs rolled on `BIRTH_WEIGHTS`, and a seed of its own.
- **Re-dyable.** `restyleRiddenHorse` changes coat, pattern or legs, free, from the Stable card
  (`src/ui/holdingsPages.js`). Never the seed.

### The dye

A look is the same pictures dyed as they upload (`recolorHorse`), never new art written anywhere. It reaches:

- the riding sprite (`src/systems/riding.js`, `src/player/mountRig.js`); the cart's sprite is never dyed;
- Horse Cart and Cargo's standing views and walk frames (`src/scenes/horseCartPool.js`), dyed a few pictures a frame
  and the least-used looks let go;
- Eye Of The Beholder's riders, the player's own and other players' (`src/net/peer/peerRiders.js`);
- the road's strangers (`src/world/road/roadTeams.js`), each on `strangerHorseLook(key)` so every client sees the same.

A Stable's horses for sale stay bays; a horse is born when it reaches its owner.

### The 3D horse

On the Morrowind lane every horse is a rigged 3D horse (`src/world/horseModel.js`, `src/world/horseRig.js`, baked by
`tools/bakeHorse.mjs`) with walk, trot, gallop and idle. It takes the same dye: a solid coat's texel is exactly the
colour a sprite pixel takes, and markings fall by each texel's place on the hide (`recolorHorseTexels`). The rider sits
it through `src/player/seatPose.js`; third person is unlocked in the saddle.

### The wire

A look is one number, `horseLookCode`, at most `HORSE_LOOK_CODE_MAX`; 0 is the bay. It rides a mounted player's pose
(`rc`), the horse-cart pool's word, and a parked team's record. A code past the law's is drawn as a bay.

## Rules

- Every horse is born unique and re-dyable, with pinto, appaloosa, dapples, socks and roan (a player's choice when
  asked).
- The seed is the horse: never changed, and it also seeds the horse's stats (`bible/06-Systems/Horse-Care.md`).
- Recolouring is free, at any time.
- Dyed pictures are never written to disk; ARENA2's art stays the player's.

## Code and tests

- `src/systems/horse/horseCoats.js` - the look, birth, restyle, the dye, the wire code
- `src/scenes/horseCartPool.js`, `src/systems/riding.js`, `src/net/peer/peerRiders.js` - where it is worn
- `src/world/horseModel.js`, `src/world/horseRig.js` - the 3D horse
- `test/systems/horse/coats1_horsecoats.test.js` - the look, birth, dye and wire
- `test/formats/morrowind/coats3d_horse3d.test.js` - the 3D horse's dye and markings
