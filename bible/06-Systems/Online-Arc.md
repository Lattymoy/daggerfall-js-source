# Online (ONLINE1, 2026-09-12)

**Mac: "I want to talk about implementing the basic bones of
multiplayer. The goal is being able to see others in the world while
allowing you to bring over one of your own save file. This is our first
iteration and thus I want it to be basic. All I care about is being
able to see and traverse with other players. If using classic, you'd
see the other user's paperdoll. If using enhanced, you would see the
other person's Morrowind sprite. I want to add an option to the menu
labeled online which allows you to bring your own developed character
into a massive server (a full fledged open world where there's no
limit)."** Decisions taken the same day: Cloudflare hosts the relay; a
client without the Morrowind data seeing the paperdoll instead is
acceptable; rooms everywhere (the world, towns, dungeons, interiors);
names over heads. Then, before the merge, Mac: "Lets do a deep audit on
it first" - AUDIT ONLINE, below.

Daggerfall Unity has no multiplayer. This is the port's own, a Ledger A
row, and it touches nothing DFU's laws govern: every player runs their
own world from their own save, and the only thing shared is presence.
`11-Multiplayer/Multiplayer.md` is the earlier co-op design (a host's
browser as the server, its world shared); ONLINE1 keeps its first
decision - your own character from your own save - and none of the
sharing, and that record now says so at its head.

## The shape

**The wire's law** - `src/net/wire.js`, ONE home: what a client may say
(a hello once and first - an id and its secret, a name, a look, a pose
- then poses at most `POSE_HZ_MAX` a second under a token bucket, and
pings), the bounds of a name, a pose and a look (its items projected
onto the six fields the doll reads), the room key's shape, the world's
cell shard, the range a pose travels inside a cell, what a joiner is
told (the nearest `ROSTER_MAX`), the room's own gates (`HELLO_HZ_MAX`,
`SOCKETS_MAX`, `DROP_STRIKES_MAX`). The relay (`server/src/relay.js`) re-exports it and the session
imports it, so what the relay refuses the client never sends and what
the relay sends the client checks by the same law. The pose bound is
the map's extent (`POSE_BOUND`, 1024 pixels of `PIXEL_UNITS`).
`test/online_relay.test.js` executes it.

**The relay** - `server/` - is a Cloudflare Worker whose one Durable
Object class, `Room` (`server/src/index.js`), holds the hibernatable
WebSockets of the players in one room and fans each pose out to the
peers in range. The room's key rides every socket's attachment (a
hibernated object wakes with no instance state); the look lives in the
object's storage under the id (an attachment is bounded - 16 KiB in
the runtime that ships, 2 KiB in the docs - and a hello that overflowed
it threw); a socket replaced by a reconnect with
its own id loses the id before it closes, so no leave is broadcast for
an id that lives on. It stores nothing past the connection: an empty
room forgets every look. Deployed at
`wss://daggerfall-online.mackcothran.workers.dev` (`npx wrangler
deploy` in `server/`, the token in the environment, never in the
tree; wrangler bundles the law from `src/net/wire.js`, so the relay
deploys from the game tree).

**Rooms.** The streaming world is sharded into `WORLD_CELL`-pixel
cells (`world:<cx>,<cy>`, sixteen map pixels a side); inside one a pose
reaches only the peers within `RANGE_PIXELS` (three) of the sender, and
the client draws only those - interest management, so a cell may hold
many and a player sees the few around them. A dungeon and an interior
are each a room by the location's map id (`dungeon:m<mapId>`,
`interior:m<mapId>.<buildingKey>`; the region and a slug of the name
only when there is no map id), small, hearing everything. The client
mints the key from what the host knows (`roomKeyFor`, `src/net/online.js`;
the mode machine's `roomIdentity()` names the dungeon by map id and the
building by key) and changes rooms by closing the socket and opening
another - after the key has held half a second, so a cell edge is not a
churn. A place the host cannot name (no map id, no building key) is no
room: the session leaves rather than pool the unknown.

**Frames.** A world cell's pose is in MapsFile's own world units
(`streamingWorld.worldCoords`, `NATIVE_PIXEL` a map pixel, the floating
origin's inverse), y the scene's shed of the origin's vertical shift;
an interior's pose is the scene's, its height shed the same way (the
building rides the exterior's frame, P8); a dungeon's is its own scene.
The host converts on the way out and back (`onlineToScene`), and at a
floating-origin recenter the peers' billboards follow the origin with
every other world-position pool.

**The session** - `src/net/online.js`, `OnlineSession` - one socket,
one room, the peers of that room, on its own clock (the relay a
`wss://` address or none, `relayUrl`; the hello carries the id and
the secret minted beside it): each peer with the
pose it last sent and the pose it is DRAWN at, eased toward the last
over one send interval so a peer walks rather than teleports, and
snapped there when the jump is a teleport. A pose goes out when it
moved, at most `POSE_HZ`, and every `HEARTBEAT_MS` regardless - the
socket's keepalive and the peers' clock. Only the room's leave removes
a peer; one silent past `PEER_TIMEOUT_MS` (out of range, or gone with
the leave on its way) is hidden, not dropped. A dropped socket
reconnects with a backoff that doubles; the relay's own closes - a
frame refused (1008), replaced by another window (4000) - are terminal,
and `statusLine()` says which. The welcome merges into the peers
known. Every frame the relay sends is checked by the wire's law. The
player's id is minted once and kept through the storage seam. The
WebSocket class and the clock are handed in, so `test/online.test.js`
drives it over a fake socket.

**The others, drawn** - `src/net/remotePlayers.js`. Every peer is drawn
as their PAPERDOLL: the look travels in the hello (race, gender, face,
and the equipped items' doll fields - `templateIndex`, `group`,
`material`, `dye`, `variant`, `equipSlot`), clamped at the door as
relay data; a stub entity with those and an equip table stands in for
the peer at the compositor's PURE door, `composePaperDollPixels`
(`src/ui/paperDoll.js`): its own art set (a small cache of identities)
and its own buffer, nothing of the inventory's doll read or written.
The figure is cropped to its alpha, uploaded under a synthetic archive
(`PEER_ARCHIVE`), and stands on the ground the player's own capsule
tall at the peer's feet; dolls are kept to `DOLLS_MAX` and released
past it, a doll that failed to compose waits `DOLL_RETRY_MS`, a peer
whose look changed gets a new batch. The name is drawn over the head
in the HUD's own pass (`drawText`, projected by the frame's own
matrices through `src/player/tapRay.js`'s `projectToScreen`, the touch
layer's, the one home, under the docked HUD's viewport rect), within
`NAME_RANGE`, never over a window that covers the HUD; the session's
status line sits in the corner when there is one.

**The host.** The streaming world (`src/scenes/world.js`, the host the
front door boots) runs the session once a frame after the look is paid
(the pose out, the peers in), pushes the peers' batches onto its own
billboard pass in the overworld, and hands the mode machine two hooks
- `extraBillboards` for the dungeon's and the interior's own passes,
`drawPeerNames` after them. The dead broadcast nothing and see no
one; the page's hide is a clean leave. `?online` beside `?load` is the
switch; `?server=` and `?name=` override the prefs. The fixed city
(`src/scenes/exterior.js`) is a dev route the front door never boots
and carries no session: its interior frame and its town room disagreed
with this host's, and one host is one frame.

**The door.** The front door's rail gains ONLINE on both skins
(`src/ui/enhancedMenu.js` `paneOnline`): a name for over the head (24
plain characters, the relay's bound, and the pane says so) and the
relay to join, on the prefs shelf (`onlineName`, `onlineServer`); the
most recent save is the character brought in; PLAY ONLINE resolves
`'online'`, which `src/main.js`'s enhanced branch turns into `?online`
beside `?load` under F12's set-or-delete law. Saving stays local; the
relay never sees the save.

## AUDIT ONLINE (2026-09-12)

Mac: "Lets do a deep audit on it first." Five opus finders, one per
lens (the relay, the session, the drawing, the host, the door and the
record), each refuted against the code and fixed in the same slice.
What they found that was real:

- **The clock (B1).** The hosts fed the frame's rAF clock into a
  session stamped by `Date.now()`: every peer stood frozen at its first
  pose, the timeout never fired, a dropped socket never reconnected.
  `tick()` takes no argument now.
- **The bound (B2/E2).** `validPose` refused most of the Bay - the
  classic start cell included - so the relay closed every mover with
  1008 and the client retried forever. `POSE_BOUND` is the map's extent,
  and the law has one home.
- **The door (E1).** `main.js` wired the online flag into the classic
  start window's branch, which never answers `'online'`: PLAY ONLINE
  booted a new character with no relay. The pin that certified it was
  restamped with the fix.
- **The compositor (C1-C4, C8, C9).** A peer's doll composed through
  the paperdoll singleton, whose coalescing refresh could hand the
  inventory a stranger's doll, or the stranger the player's, panel and
  all, and leave the compositor on the wrong identity. The compose is
  pure now, over an art set; the peer's door touches nothing of the
  singleton.
- **Silence (B3/B11/B14).** A peer standing still sent nothing and was
  dropped after twenty seconds, then could never come back (a pose from
  an unknown id is ignored). The heartbeat, the hidden-not-dropped
  rule, and the range filter on the client.
- **The closes (B4/B5/B6).** The relay's 1008 and 4000 were retried
  every second (a two-tab eviction loop in the second case); a
  replaced socket's leave erased the reconnected player for everyone.
- **The object (D10/E4/A1).** A hibernated Room woke without its key
  and the range gate turned off for the whole cell; the key rides the
  attachment. The look moved to storage (an attachment is bounded, and
  a hello that overflowed it threw after the eviction had run - A4).
- **The relay, measured (A3, A5-A10, A12).** The lens ran the relay
  under wrangler with real sockets: any client could kick and
  impersonate any peer by saying hello with its public id (the id's
  SECRET now, minted beside it); the roster went to everyone and was
  unbounded (the nearest `ROSTER_MAX`); a reconnect storm cost the room
  2N frames a cycle with nothing gating hellos or sockets (`HELLO_HZ_MAX`
  a room, `SOCKETS_MAX`); the fan-out deserialized every socket's
  attachment per pose, saturating one object near sixty players in a
  crowd (an index read once); the payload was stringified per
  recipient; a failed send passed for a delivery (the socket is closed);
  pings and over-rate poses were ungated ingress (the runtime answers
  pings while the object sleeps, `DROP_STRIKES_MAX` closes a flood); a
  look's items travelled whole, junk and all, and the junk before the
  gear dropped the gear (projected onto the six fields, filtered before
  sliced). The relay is linted with the tree now, and observability is
  on.
- **The host (D3-D7, D11, D12, D14).** The name projected through the
  whole canvas under the docked HUD; a null room key kept the old room
  and streamed scene coordinates as world units; the peers jumped a
  tile for one frame at every floating-origin crossing; the interior's
  height carried the origin's vertical shift; a cell edge was a socket
  churn; the dead kept broadcasting; an unkeyed door pooled. And the
  two hosts disagreed on the interior's frame and the town's room
  (D6/D8), so the dev host lost its session.
- **The drawing (C5-C7, C10-C13).** A failed doll retried every frame,
  textures were never released, record keys could collide, the doll
  was the panel tall (short and floating), a look change kept the old
  doll, the look was trusted.
- **The pins (B18/E7/E9/A14).** Seven mutations survived the first
  session pin and ten the relay's (a fixture that tested itself, the
  id's charset, the frame cap's edges, the gate's burst cap and its
  backwards clock), two assertions could not fail, one projection test
  read source text. Rewritten: `test/online.test.js` (8) and
  `test/online_relay.test.js` (7, the Room over fake sockets and a fake
  state).

## What it does not do (yet)

- **The Morrowind body for a peer.** The enhanced third person rides
  the player's own rig (`src/combat/fpArm.js`: one instance, built from
  the player's own race and gear), so a peer wears the paperdoll in
  both skins. The next iteration makes the rig instantiable per body.
- **The look is sent once**, in the hello: gear changed mid-session is
  not seen by the peers until the next room (a `look` frame is the
  next iteration's).
- No chat, no player-versus-player, no shared clock or weather, no
  shared NPCs or loot: each player's world is their own.
- A peer across a world-cell border is not seen until both stand in
  the same cell (D9: two players a pixel apart astride a cell edge are
  in two rooms; the cell is sixteen pixels, the range three, so the
  seam is a strip - the 3x3 neighbourhood is the next iteration's).
- The relay is one Durable Object per room and has not been measured
  past a handful of players; interest management filters what is sent,
  not what is iterated.
- No identity beyond the display name: the id is a random token kept
  in the browser.

## Pinned

`test/online_relay.test.js` (7): the wire's law with mutants (the range
widened, the gate that never refills or never caps, a pose before
hello, the junk before the gear) and the Room over fake sockets and a
fake state (the key on the attachment surviving a wake, the look in
storage, the roster with looks and its cap, the range fan-out, the
leave, the replaced socket's silent close, the secret that guards an
id, the hello gate, the socket cap, the over-rate strikes, the failed
send, the worker's routes).
`test/online.test.js` (8): the one law at both ends and the world's
bound, the room key by map id and its nulls, the pose's change and
easing, the id, the session on its own clock over a fake socket, the
socket's lifecycle and the terminal closes, the look and the stub
clamped, the others drawn through a fake renderer (the crop, the cache,
the retry, the eviction, the name under the viewport rect), the
compositor's door pure by source. Not seen with two real players from
here - Mac's two browsers are the gate.
