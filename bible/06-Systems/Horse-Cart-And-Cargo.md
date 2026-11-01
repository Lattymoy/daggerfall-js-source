# Horse Cart and Cargo

demifiend000's Horse Cart and Cargo (1.0.0-rc12), ported from its IL, with an online half of this
game's own: a persistent animated horse and cargo cart with hitching and mounting, Follow and Wait commands, storage
access at doors, animated wheels and cargo that fills the bed by weight. Online, other players see each other's teams
and riders, and a parked team stays in the world for everyone. The new wagon kinds are on `06-Systems/Wagons.md`; the
town watch that throws parked wagons is on `06-Systems/Wagon-Warden.md`. The horse's pictures and the text rows are
our own; the release's record is in `01-Overview/Own-Work.md`.

## How it works

**The mod's law is its IL.** No source ships with the mod; every law cites an offset in the 1.0.0-rc12 assembly
(`[IL_xxxx]`), and `test/systems/horse/hcc_scope.test.js` holds every authored method against the module that carries
it, or says why it has no twin (Unity plumbing, Harmony patches for mods the game does not have, DFU's message bus).

**The horse** (`src/systems/horse/horseArt.js`) is Daggerfall's horse under its rider (TEXTURE.495, the walk's five
views and eight frames), the rider taken off and the flank under his leg filled from the hide beside it, our own saddle
painted on in colours no coat dyes. The names, sizes, views, frames and timing are the mod's. From the front the rider
is ours as data (`src/systems/horse/horseFrontRider.js`, a mask a walk frame over TEXTURE.495 record 0), laid over the
baked mask by `withFrontRider`: every row above the forehead, every pixel above the hooves in the rider's ramps, and
all but the hide over his legs, so no pixel of the rider is left above the hooves in any front frame.

**The runtime** (`src/systems/horse/horseCart.js`, `TrailingWagonRuntime`) runs five wagon modes and five horse modes:

- **Riding the cart.** The wagon hangs on its shafts behind the rider (`hitchAxle`, `hitchedPoseStep` in
  `src/systems/horse/horseFollow.js`), grounded and tilted by the mod's probe, wheels turning by travel, cargo pieces
  showing by fullness (25, 50, 75, 90% of capacity).
- **Dismounting** parks the wagon where its wheels stood, the horse hitched ahead. A parked wagon is a solid box,
  grounded by a two-wheel solve.
- **The horse** is an eight-direction billboard of our pictures (above). Talk mode makes a waiting horse follow (path
  following, detours, stuck recovery, and optional evasion away from foes targeting the player) and a following one
  wait. Info mode names it (31 characters). Grab or Steal rides it or mounts the team.
- **The team** is mounted by walking up to it, from the transport window's cart row, or with the quick-mount key; the
  summon key brings horse and wagon to the player's heels outdoors.
- **Doors** park the team: a building or dungeon door within 50 m gives the inventory's wagon button access to its
  storage inside. Stepping out closes the access.
- **Fast travel** takes a following horse along, or leaves it waiting, by the setting.
- **The save** is `WagonSaveData`, riding the save envelope as `horseCart` in DFU's per-mod slot.

**Settings** (`src/systems/modSettings.js` `horse-cart-and-cargo`): the mod's eight keys and Enabled. Disabled, nothing
stands, nothing rides the wire and the windows fall back as if DFU never loaded it.

**Online.** A player's parked wagon, waiting or following horse and trailing team are drawn for everyone near: the
record rides the cell's foes frame as `hv` (`src/systems/horse/horseCartWire.js`, `validHccRecord`). A reader eases a
peer's team between words and draws it with the same pieces. The World Tooltips plaque names a peer's horse and wagon
and adds an "Owned by" line naming the owner. Nothing of the storage rides the wire.

**Parked teams persist** (`src/net/wire.js` `validParkData`, the cell room on `server/src/index.js`). A cell room keeps a
parked team for 72 hours after its owner last spoke for it, and hands the list to everyone who joins. A player can park
only in the cell where they stand; a per-owner registry drops the old cell's record when the team moves.

**Riders are seen.** The pose carries whether a player rides a horse or the cart, and which mounted sprite set; others
draw a riding peer with Eye Of The Beholder's mounted sprites (`src/net/peer/peerRiders.js`), whether or not they use
that mod.

## Rules

- **The mod, ported from its IL, with its online integration enhanced** (Mac).
- **Others' wagons don't block** (Mac): another player's team stands no collider and never takes the click from a door.
- **A parked team stays for others, with an owned line on the plaque, and others see riders** (Mac).
- **The hotkeys are the registry's** `HorseMount` and `HorseSummon` actions (`,` and `.`), because the mod's `K` and `G`
  belong to Travel Options and Handheld Torches here; a player's old choice is migrated once.

## Daggerfall Unity

The mod is one MonoBehaviour, `TrailingWagonRuntime`, over DFU's transport modes, `PlayerActivate`, the inventory's
wagon arm and `StreamingWorld`. Departures, each this game's own:

- **The wagon on its shafts.** The mod trails the wagon 2.5 m back on a breadcrumb trail and eases it there, which
  rubber-bands and looks unhitched; here it hangs 3.1 m from the hitch with no horizontal ease.
- **A dismount never parks at a stale pose**: the cached trailing pose is forgotten whenever the drawn wagon is torn
  down while still driven, so the mod's own fallback (2.5 m behind the player) applies.
- **The hotkeys** are registry actions, not the mod's text keys.
- **The pictures and the text rows** are ours (OWN-WORK, the owner); the mod's text table's names were never shown.
- **Everything online**: the shared record, the kept parked teams, the owned line, riders seen, others' wagons not
  blocking.

## Code and tests

- `src/systems/horse/horseCartLaw.js` - enums, constants, the save record, the predicates
- `src/systems/horse/horseFollow.js` - following, the hitch, grounding
- `src/systems/horse/horseCart.js`, `src/systems/horse/trailingPoseCache.js` - the runtime and its cached pose
- `src/systems/wagon/wagon41214.js` - the classic wagon's pieces and cargo
- `src/scenes/horseCartPool.js` - drawing, targets, colliders, peers' teams
- `src/systems/horse/horseCartWire.js`, `src/net/peer/peerRiders.js` - online records and riders
- `src/systems/horse/horseArt.js`, `src/systems/horse/horseFrontRider.js` - our horse and its front-view rider
- `test/systems/horse/hcc_scope.test.js` - the method ledger against the IL
- `test/systems/horse/ownwork4_horseart.test.js` - our horse; mutants `tools/mutants/ownwork4_horse.json`
- `test/net/hcc_park.test.js`, `test/systems/horse/hcc_stale_park.test.js`, `test/scenes/audit_hcc_branch.test.js`
