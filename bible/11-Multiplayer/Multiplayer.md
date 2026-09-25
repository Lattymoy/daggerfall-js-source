# Multiplayer

> **ONLINE1 (2026-09-12) shipped the first cut - `06-Systems/Online-Arc.md`;
> WORLD1 (2026-09-12) began the persistent shared world.** Of the three
> decisions below the arc keeps the first (your own character from your
> own save) whole; the second stands in a new shape - the relay names a
> HOST per room (the player in it longest) and keeps the host's snapshot
> of a dungeon's world for whoever comes next, while the world still
> runs in the host's browser - and WORLD2 (2026-09-12) made that
> literal for a dungeon's foes: one simulation per room, the host's,
> streamed to the rest, whose foes are puppets - and WORLD3 (2026-09-12)
> made its doors, levers and platforms everyone's and its foes every
> player's hunters. Loot, then shared time and weather, are the arc's
> next slices. This page is the co-op design the arc grows into; where
> the two disagree, the arc is what runs.

Co-op for Daggerfall Enhanced (BR1; the page was written while the
public name was Daggerfall JavaScript). Locked with Mac on 2026-09-01
after a survey of what the port actually has; the three decisions below
are his, the reasoning under each is why they are the version that
ships.

## What it is, and is not

**It is** two to eight players walking the same Iliac Bay together, each
with their own character from their own save, seeing each other, sharing
the host's world - its time, its weather, its enemies, its doors - and
fighting beside each other against NPCs.

**It is not** PvP, an MMO, or a shared campaign - with ONE door through the first: a DUEL (DUEL1, 2026-09-24, Mac:
"I want to be the foundation of pvp"), consensual and bounded - two players who both said yes, in a ring of light,
until one falls to 1 health, and both are healed after (`06-Systems/Community-Arc.md` DUEL1). Nobody's save changes
shape because they played with a friend. It IS, since WORLD1
(2026-09-12, Mac: "The world is the server and every player should
inhabit that world while also being able to continue their progress
... True persistance"), a persistent shared world one room at a time:
a dungeon's dead stay dead for whoever comes next, kept by the relay
and not by anyone's save.

## The three locked decisions

### 1. Quests stay separate

Each player's quest state, dialogue state, travel map and history are
their own. You walk together; the story you are in is yours.

Why: the save envelope (`systems/save.js:781`) already splits the world
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
variable `dt` (`scenes/world.js:9267`) and 110 source files call
`Math.random` unseeded. Two clients cannot simulate the same world in
parallel and agree, and making them able to would mean a fixed-step
deterministic rewrite of the simulation. So one authority owns the
world and the rest trust it. The host is the cheapest authority because
the code is already here; a Durable Object running the simulation would
be a second copy of the game in a Worker.

The cost as designed: when the host leaves, the session ends. WORLD1
(2026-09-12) shipped the relay's own answer to the seat - it passes to
the player in the room longest, said in a host frame - and WORLD2
(2026-09-12) handed the live simulation of a dungeon's foes over with
it: the puppets go live from the pose the stream left them in.

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
does not need to re-emit what it merely renders). It held no game
state beyond the roster until WORLD1: a world room keeps the host's
snapshot of the place in the object's durable storage, so a restart or
an empty room loses nothing.

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

Nothing multiplayer goes in a save. A session is ephemeral; the place
is not - since WORLD1 a world room's memory lives in the relay, for
`WORLD_TTL_MS` past its last visitor (AUDIT WORLD A3). The only thing
worth remembering locally is the last room code, and even that is a
convenience.

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

- Host migration (a client becomes host when the host drops): the seat, WORLD1 (the relay's word); a dungeon's foes, WORLD2 (the puppets go live); its doors, levers and platforms need no seat at all, WORLD3 (an act is whoever touched them, the memory carries them); its loot, WORLD4 (a container the room has opened is the room's, and needs no seat either).
- Splitting the party across interiors. Later.
- Voice chat. Text chat shipped in the ONLINE arc (CHAT1, `06-Systems/Online-Arc.md`) - one World tab in the enhanced HUD; a co-op party tab is the next row of its CHAT_TABS. Voice is not basics.
- Whether a client's damage claim ever gets validated. Not planned.
- Binary framing / WebRTC. When the numbers say so, not before.

## CHAT2 - the list holds its rows (2026-09-15)

**Mac, relaying a player:** *"The chat UI when accumulating messages
scrunched together and makes history unreadable and after some time,
chat history disappears altogether."*

Two symptoms, one bug, and a layout one.

`.dfchat-list` is a fixed-height flex COLUMN (`height: min(220px,
34vh)`, `overflow-y: auto`) and `.dfchat-line` carried `overflow:
hidden`. Per CSS Flexbox 4.5 a flex item's **automatic minimum size**
applies only while its overflow is `visible`; with `overflow: hidden`
the item's `min-height: auto` resolves to **zero**, which leaves the
default `flex-shrink: 1` free to compress every row instead of letting
the content overflow into the scroll. Measured in Chromium:

| rows | row height | scrollHeight vs clientHeight |
|---|---|---|
| 5 | 18.30px | 232 / 232 |
| 10 | 18.30px | 232 / 232 |
| 20 | 9.09px | 232 / 232 |
| 40 | 3.55px | 232 / 232 |
| 80 | 0.78px | 233 / 232 |
| 200 | **0.00px** | 410 / 232 |

The scroll never engaged because there was nothing to scroll - the
content had been squeezed to fit. That ramp IS the report: "scrunched
together" in the middle of it, "disappears altogether" at the end. The
rows were in the DOM the whole time and the lines were in the log; they
were drawn zero pixels tall. `flex: none` on the row is the fix: a chat
line does not shrink, the list scrolls.

**Why no pin caught it.** `test/chat1.test.js` drives the panel against
a fake document, and a fake document has no layout - its boxes are
whatever the fake says they are. That is the right tool for the panel's
BEHAVIOUR (the keys, the IME, the grown list, the badge) and it can
never see a box. So this gets two checks, split by what each can
actually hold:

- `tools/chatLayoutProbe.mjs` **measures**, in Chromium, with no dev
  server and no game data - the panel's own sheet is the subject. It
  fails on the old CSS and passes on the new, and it checks the closed
  peek too, so a fix to the list cannot quietly break the overlay.
- `test/chat1.test.js` holds the **law**, and states it over the SHEET
  rather than over `.dfchat-line`: the sheet still contains a
  fixed-height flex-column scroller (so the rule cannot go vacuous),
  and nothing in the sheet hides its overflow without also refusing to
  shrink. A future row class dropped into the list inherits the pin
  instead of the bug.

**The general shape**, for the next DOM surface this project grows: a
scrolling flex column whose children may carry `overflow: hidden` needs
`flex: none` on those children, or it silently becomes a squeezer. It
fails quietly - no error, no warning, and worse the more content
arrives, which is exactly backwards from how a bug wants to be found.
