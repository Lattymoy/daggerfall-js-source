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
names over heads.

Daggerfall Unity has no multiplayer. This is the port's own, a Ledger A
row, and it touches nothing DFU's laws govern: every player runs their
own world from their own save, and the only thing shared is presence.

## The shape

**The relay** - `server/` - is a Cloudflare Worker whose one Durable
Object class, `Room`, holds the WebSockets of the players in one room
and fans each pose out to the peers in range. It stores nothing past
the connection. Its law is pure and executes in
`test/online_relay.test.js` (`server/src/relay.js`): a client says
hello once and first (an id, a name, a look, a pose), then poses at
most `POSE_HZ_MAX` a second (a token bucket; the rest are dropped, the
latest kept), and nothing else; a joiner is told everyone else who has
said hello; a pose reaches the peers in range. Deployed at
`wss://daggerfall-online.mackcothran.workers.dev` (`npx wrangler
deploy` in `server/`, the token in the environment, never in the
tree).

**Rooms.** The streaming world is sharded into `WORLD_CELL`-pixel
cells (`world:<cx>,<cy>`, sixteen map pixels a side); inside one a pose
reaches only the peers within `RANGE_PIXELS` (three) of the sender -
interest management, so a cell may hold thousands and a player sees
the few around them, which is how "no limit" holds. A town in the
fixed-city host, a dungeon and an interior are each a room by location
(`town:<region>.<name>`, `dungeon:<region>.<name>`,
`interior:<region>.<town>.<buildingKey>`), small, hearing everything.
The client mints the key from what the host knows (`roomKeyFor`,
`net/online.js`; the mode machine's `roomIdentity()` names the
dungeon or the building) and changes rooms by closing the socket and
opening another.

**Frames.** A world cell's pose is in MapsFile's own world units
(`streamingWorld.worldCoords`, `NATIVE_PIXEL` a map pixel, the
floating origin's inverse), y the scene's; every other room's pose is
the scene's own frame - the peers are in the same scene. The host
converts on the way out and back (`onlineToScene`).

**The session** - `net/online.js`, `OnlineSession` - one socket, one
room, the peers of that room: each with the pose it last sent and the
pose it is DRAWN at, eased toward the last over one send interval so a
peer walks rather than teleports; a peer silent past `PEER_TIMEOUT_MS`
is dropped; a dropped socket reconnects with backoff. The player's id
is minted once and kept in storage. The WebSocket class and the clock
are handed in, so `test/online.test.js` drives it over a fake socket.

**The others, drawn** - `net/remotePlayers.js`. Every peer is drawn as
their PAPERDOLL: the look travels in the hello (race, gender, face,
and the equipped items' doll fields - `templateIndex`, `group`,
`material`, `dye`, `variant`, `equipSlot`), a stub entity with those
and an equip table stands in for the peer at the compositor
(`ui/paperDoll.js`, which gained `refreshPaperDoll(entity,
{ background: false })` so the panel stays clear), the pixels are
copied out and uploaded under a synthetic archive (`PEER_ARCHIVE`),
and the doll stands on the ground as a billboard the player's own
capsule tall at the peer's feet. The compositor is a module singleton
keyed by identity, so one peer composes at a time and the local
player's doll is composed back after each. The name is drawn over the
head in the HUD's own pass (`drawText`, projected by the frame's own
matrices through `player/tapRay.js`'s `projectToScreen`, the touch
layer's, the one home), within `NAME_RANGE`.

**The hosts.** The streaming world and the fixed city each run the
session once a frame before any mode draws (the pose out, the peers
in), push the peers' batches onto their own billboard pass in the
overworld, and hand the mode machine two hooks - `extraBillboards` for
the dungeon's and the interior's own passes, `drawPeerNames` after
them. `?online` beside `?load` is the switch; `?server=` and `?name=`
override the prefs.

**The door.** The front door's rail gains ONLINE (`ui/enhancedMenu.js`
`paneOnline`): a name for over the head and the relay to join, on the
prefs shelf (`onlineName`, `onlineServer`); the most recent save is
the character brought in (the same card Load shows); PLAY ONLINE boots
the world with `?online` beside `?load` (`main.js`). Saving stays
local; the relay never sees the save.

## What it does not do (yet)

- **The Morrowind body for a peer.** The enhanced third person rides
  the player's own rig (`combat/fpArm.js`: one instance, built from
  the player's own race and gear), so a peer wears the paperdoll in
  both skins. The next iteration makes the rig instantiable per body.
- No chat, no player-versus-player, no shared clock or weather, no
  shared NPCs or loot: each player's world is their own.
- A peer across a world-cell border is not seen until both stand in
  the same cell.
- No identity beyond the display name: the id is a random token kept
  in the browser.

## Pinned

`test/online_relay.test.js` (4): the relay's law with mutants (the
range widened, the gate that never refills, a pose before hello).
`test/online.test.js` (4): the room key held to the relay's shard, the
pose's change and easing, the projection, the session over a fake
socket, the look and the stub, the compositor's door. The relay's
health route answers; the room route demands a WebSocket. Not seen
with two real players from here - Mac's two browsers are the gate.
