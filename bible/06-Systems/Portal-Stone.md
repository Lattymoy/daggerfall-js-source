# The Portal Stone

A one-use item that opens a portal for 30 seconds to anywhere on the map; anyone who steps in follows. It costs five
Welkynd Shards (what salvaging rarity gear gives, `06-Systems/Loot-Arc.md`) at any shop and is always in stock. The
**Portal Book** keeps up to ten house doors a stone can open to. The player meets the stone on every shopkeeper's popup,
in the pack and hotbar, and as a violet vortex in the open world. It is the port's own; DFU has no such item.

## How it works

**The item** (`src/systems/gate/gateSpoils.js`). Template 572: bound, stacking with its own kind, miscellany
(`UselessItems2`, never a gem), the Diamond's picture. The realm's trade service refuses it
(`src/net/realm/realmTradeLaw.js` `BOUND_TEMPLATES`).

**The counter.** Every shop keeper (`shopStock.js` `isShop`'s nine kinds) carries **Portal Stone (5 shards)** on both
of their popups: on the classic skin a row under the art (key P), on Enhanced Plus a button above Exit. A bank teller
and a street merchant never carry it. A press asks how many with DFU's split-stack field, seeded with 1 (never the most:
a stray Return would spend a purse), then a Yes/No offer ("Buy 3 Portal Stones for 15 Welkynd Shards? You carry 23.").
With one stone to be had the field is skipped. Shards spent must be unlocked and unworn. Every sale mints its stones,
so no keeper runs out and no haggle, holiday or theft touches it. A sale lightens the pack (a stone weighs less than
its shards). The question and sale are `src/scenes/portalCounter.js` `createPortalCounter`.

**One sale law** (`src/systems/portalStone.js` `buyPortalStones`): `n` stones for exactly `n` times
`PORTAL_STONE_SHARDS`, all or nothing. `portalStoneMax` is the spendable shards over the price, capped by the room
left on the stack the stones land on (`LOOT_STACK_MAX`, 65,535; a locked stack is never landed on).

**The use.** The pack's Use or a hotbar press hands the stone to the open world's door. Indoors it says "A portal can
only be opened under the open sky."; a dungeon has no door. The door refuses in water, on a boat's deck, and while a
portal of the player's stands. The travel map opens in teleport mode, with no fee. The pick asks the door again, then
places the portal `PORTAL_AHEAD` (2 m) ahead, short of a wall by `PORTAL_WALL_GAP`, never nearer than
`PORTAL_MIN_AHEAD`, on ground within `PORTAL_GROUND_PROBE`. Any refusal spends nothing. Then one stone is spent from
the list it came from (pack, wagon or a companion's storage).

**The holds** (`portalHold`), asked by the door, the pick and the step: dead or a move under way, a duel, a siege's
room, an enemy near, a journey. A portal is never a way out of what the travel map refuses.

**The portal** (`src/scenes/portalGates.js`, the vortex `src/scenes/portalFx.js`). It stands fixed for
`PORTAL_OPEN_MS` (30 s) in the world frame, so the floating origin does not move it. Anyone who steps in, within
`PORTAL_REACH` (0.9 m) across and `PORTAL_REACH_Y` (2 m) up, arrives through the Mages Guild's teleport (free, at once,
by a start marker). An entry is a step from outside to inside (`portalStepIn`); a step is forgotten across a frame gap
of `PORTAL_STEP_GAP_MS` or a jump of `PORTAL_STEP_JUMP`, so a portal opening on someone or outside a door takes nobody.
A sealing portal takes nobody. A load ends every portal standing.

**Past the Bay.** The stone's map picks any land past the Bay, named by its province, and any city; the sea picks
nothing (`src/systems/travel/pastBayTravel.js` `portalLandAt`). A teleport past the Bay is judged by
`teleportJourney`, not a journey's law. With no place at the pixel, the landing must be safe ground - above water,
level and open - or the nearest that is (`src/player/enterExit.js` `safeGroundAt`).

**Cyrodiil's open zone.** The stone ignores the zone's teleport law, in or out. In the zone it is held only by the PvP
combat lock and a foe alerted to the player (`src/scenes/portalStoneHost.js`). The guild's teleport and Recall keep the
zone's law.

**Event gates.** While an event's gate (a Dagon's Breach, an Elite Breach arch, a fallen star) stands on a screen, no
stone's portal stands within `EVENT_GROUND_M` (40 m) of it (`src/systems/eventGround.js`). The pick refuses with no
stone spent; a peer's word of one there is not believed; one already open closes. Another player's parked wagon on an
event's ground is not drawn. An Elite Breach call's own portal is exempt.

**Online.** The opener's foes frame carries the portal (`portalWire`: id, place, destination pixel, time left) while
the opener stands within `PORTAL_SAY_REACH` (32 m); the relay reads nothing inside it. A peer's record is checked
(`validPortalRecord`), believed only within `PORTAL_PEER_REACH` (40 m) of the opener's feet as this player sees them,
named off the receiver's own map, one per opener, never longer than first said, and stood on the receiver's ground
within `PORTAL_REGROUND`. A peer's copy runs out on its own time.

**The Portal Book** (`src/systems/portalBook.js`, template 577: bound, pack-only, weightless). Every character has one,
in the kit or given once at restore. From inside a house - the player's home, their guild's hall, another guild's open
hall, or another player's home they were let into - **K** keeps its front door's landing as a spot
(`src/scenes/portalBookHost.js`). `PORTAL_BOOK_MAX` (10) spots, one a house, saved. **1** to **0** open a spot outdoors
through the stone's own door, holds and pick, spending one stone; **F** forgets one. Whoever steps in lands at the door.

**The gift.** A character made before the stone is given ten (`PORTAL_GIFT_STONES`) once, at a load, marked by the
save's `portalGift`; a character made since is born past it.

## Rules

- A stone at every shop for Welkynd Shards, always available, one use, open a short time, anyone may follow (the owner).
- Every existing player received ten, and they stack (the owner).
- Stones are bought in bulk by the sale's own law, not a loop of single sales (the owner).
- Anywhere on land past the Bay (the owner).
- Portal Stones work all over the open zone, held only by aggro or the flag's cooldown (the owner).
- A portal book keeps house doors a stone can open to (the owner).
- Bound: the shards that buy it are, so a stone never carries their worth to another player.
- The row stands with Loot Rarity off too.
- Price `PORTAL_STONE_SHARDS` (5); time `PORTAL_OPEN_MS` (30 s).

## Code and tests

- `src/systems/portalStone.js` - sale, holds, place, step, wire, words, numbers
- `src/systems/gate/gateSpoils.js` - the stone's and book's rows, the gift
- `src/scenes/portalStoneHost.js` `createPortalStoneHost` - the door, pick, step and arrival, built by `world.js`
- `src/scenes/portalGates.js`, `src/scenes/portalFx.js` - the pool and the vortex
- `src/scenes/portalCounter.js`, `src/scenes/shopRows.js` - the counter, built once by `worldModes.js`
- `src/systems/portalBook.js`, `src/scenes/portalBookHost.js` - the Portal Book
- `test/systems/portal1_stone.test.js` - the row, counter, bulk sale, use, holds, step, wire, pool and hosts
- `test/systems/portal1_gift.test.js` - the gift
- `test/systems/portalbay_stone.test.js` - capitals and land past the Bay, refusals, safe landing
- `test/systems/portalbook.test.js` - the book
- `test/scenes/rpt1026_events_gateway.test.js` - event gates

## Open

- Not seen in a browser: the portal, two players stepping through one, the classic row, the count's field on either
  skin.
