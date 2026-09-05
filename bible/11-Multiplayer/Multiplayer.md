# Multiplayer

Co-op for the Daggerfall JavaScript port. Locked with Mac on 2026-09-01
after a survey of what the port actually has; the three decisions below
are his, the reasoning under each is why they are the version that
ships.

## What it is, and is not

**It is** two to eight players walking the same Iliac Bay together, each
with their own character from their own save, seeing each other, sharing
the host's world - its time, its weather, its enemies, its doors - and
fighting beside each other against NPCs.

**It is not** PvP, an MMO, a persistent shared world, or a shared
campaign. Nobody's save changes shape because they played with a friend.

## The three locked decisions

### 1. Quests stay separate

Each player's quest state, dialogue state, travel map and history are
their own. You walk together; the story you are in is yours.

Why: the save envelope (`systems/save.js:602`) already splits the world
from the player - `position, pose, classicMinutes, world, locationKey`
on one side; `quest, talk, travelMap, escortingFaces, interior` on the
other. That line IS the replication boundary. A shared campaign would
mean one quest engine deciding for eight saves and every quest action
becoming a network transaction; separate quests mean the quest engine
is untouched.

The cost is honest: two players on the same quest each get their own
copy of the target, and a quest NPC one player has already dealt with
may still stand for the other. That is Borderlands' rule and it is the
rule here.

### 2. The host's browser is the server

One player hosts. Their browser runs the world - enemies, time,
weather, actions - exactly as it does solo, and everyone else is a
renderer with local prediction for their own body. The Cloudflare side
introduces peers and relays bytes; it runs no game.

Why, and this is the constraint that decides everything: **lockstep is
impossible here.** The frame loop is `requestAnimationFrame` with a
variable `dt` (`scenes/world.js:5492`) and 110 source files call
`Math.random` unseeded. Two clients cannot simulate the same world in
parallel and agree, and making them able to would mean a fixed-step
deterministic rewrite of the simulation. So one authority owns the
world and the rest trust it. The host is the cheapest authority because
the code is already here; a Durable Object running the simulation would
be a second copy of the game in a Worker.

The cost: when the host leaves, the session ends. Host migration is a
later slice, not a v1 requirement.

### 3. WebSocket through a Cloudflare Durable Object

Every client holds one WebSocket to a Durable Object named by the room
code. The DO holds the roster and relays. No WebRTC in v1.

Why: WebRTC data channels are faster and cost nothing per byte, and they
are where browser multiplayer projects go to die - signaling, STUN,
TURN, symmetric NAT, and the player whose router hates them. A relay
always connects. For a game whose movement update is a few dozen bytes
at 10-20Hz, the extra hop is invisible. WebRTC can come later as a
transport optimization behind the same message layer, and the message
layer is designed so it can.

Cloudflare because Mac already holds the key and the deploy is static:
GitHub Pages cannot host a socket, and a Worker plus one DO per room is
the smallest server that exists.

## Architecture

### Topology

```
  host browser  ─┐
  client A      ─┼─ WebSocket ─→  Worker  ─→  DurableObject("room:ABCD")
  client B      ─┘                                 roster + relay
```

The DO knows who is in the room and who is host. It forwards every
message from the host to all clients, and every message from a client
to the host (and, for transforms, to the other clients too - the host
does not need to re-emit what it merely renders). It holds no game
state beyond the roster, so a DO restart loses nothing the host does
not resend.

### Authority

| Owns | Who | Notes |
|---|---|---|
| World time (`classicMinutes`) | host | 1Hz tick, clients snap |
| Weather, region conditions | host | on change |
| Location (`locationKey`) | host | the party is where the host is |
| Enemies: spawn, position, state, death | host | clients render, never simulate |
| Doors, action records, dungeon state | host | any client may REQUEST; host applies and echoes |
| Loose loot, world items | host | pickup is a request; host arbitrates first-come |
| Each player's body: position, pose, weapon, animation | that player | broadcast 10-20Hz, others interpolate |
| Each player's inventory, gold, quests, dialogue | that player | never leaves their browser |
| Damage a player deals to an enemy | that player computes, host applies | trust model below |
| Damage an enemy deals to a player | host computes, that player applies | |

### Trust

Friends-only co-op. A client's damage claim is applied as sent. There
is no anti-cheat in v1 and no plan for one; the room code is the access
control. This is recorded so nobody later mistakes its absence for an
oversight.

### The state model is the save

`systems/save.js` already knows how to snapshot the world and restore
it. **A joining client receives the host's world snapshot through the
same envelope a save file uses**, restores it the way `restore` does,
and is then in the host's world at the host's time. The player half of
the envelope is theirs and is not touched. Sync after that is deltas
against that baseline.

This is the single biggest reason the feature is tractable: the
serialization problem is solved, versioned, and pinned.

### Messages

JSON over the socket, one object per frame, every message carrying a
schema version. Small on purpose; binary framing is a later
optimization behind the same names.

| Message | From | Cadence | Carries |
|---|---|---|---|
| `hello` | client | once | protocol version, player name, race/gender/class for the body |
| `roster` | DO | on change | who is here, who is host |
| `world` | host | on join, on location change | the save envelope's world half |
| `tick` | host | 1Hz | classicMinutes, weather |
| `tf` | any player | 10-20Hz | pos, yaw, pitch, pose flags, weapon, anim state |
| `enemy` | host | on change, ≤20Hz | per-enemy pos, state, health |
| `req` | client | on action | door / loot / activate - "I want to" |
| `ev` | host | on apply | the applied result, to everyone |
| `hit` | player | on strike | target, damage, source - see Trust |
| `leave` | DO | on disconnect | who |

### Rendering other players

The port already has everything it needs. In the enhanced skin the
third-person Morrowind body (`fpArm`'s `thirdBuilt`/`thirdMesh`, MW-D24)
is a full posed model driven by the same animation state a remote `tf`
carries; in the classic skin the player is a sprite and other players
are more sprites. Remote transforms are buffered ~100ms and
interpolated, the standard answer to a 10-20Hz feed.

### Locations

v1: the party is wherever the host is. A joining player is placed at
the host's position. When the host enters a building or a dungeon, the
world host changes for everyone; clients that were elsewhere are
brought along. Splitting up across interiors is a later slice - it is
mostly a rendering question (a client "away" in another interior is in
a scene the host is not running), and it is not what basics means.

### What is deliberately not persisted

Nothing multiplayer goes in a save. Sessions are ephemeral; the only
thing worth remembering locally is the last room code, and even that is
a convenience.

## Constraints the codebase imposes

- **Four hosts.** exterior (`world.js`), dungeon (`dungeonContext.js`),
  interior (`worldModes.js`), and the fourth. The four-hosts rule in
  this bible exists because every one of them has been missed at least
  once. Multiplayer must land at ONE seam each host calls, never as
  four copies. The weapon rig's construction seam is the model.
- **Solo must not change.** With no room joined, every probe, every pin
  and every solo session behaves byte-for-byte as before. The
  multiplayer layer is a null object when absent.
- **Both skins.** Classic and enhanced both play; the room UI is skin
  work, the transport is not.
- **`bootProbe` and the fleet keep running** with no Worker present.
  The Worker is a runtime dependency of a joined session only.

## Open questions, deliberately open

- Host migration (a client becomes host when the host drops). Later.
- Splitting the party across interiors. Later.
- Voice or text chat. Probably text in the HUD; not basics.
- Whether a client's damage claim ever gets validated. Not planned.
- Binary framing / WebRTC. When the numbers say so, not before.
