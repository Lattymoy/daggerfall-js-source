# Multiplayer

DFO Online's co-op model: every player brings their own character from their own save, and meets others in a shared
world kept by a relay. A player meets it the moment they go online - other players walk past, fight the same dungeon
foes, open the same doors and see the same time of day. The online systems built on this (chat, parties, duels, the
open zone, the bosses) have their own pages; this page holds the base the rest stands on.

## How it works

**The relay.** Every client holds one WebSocket to a Cloudflare Worker whose one Durable Object class, `Room`
(`server/src/index.js`), holds the sockets of one room. The client names the room in the path (`/room/<key>`). The
relay's law is one module, `src/net/wire.js`, which the relay re-exports (`server/src/relay.js`) and the client
session (`src/net/online.js`) imports, so what the relay refuses the client never sends.

**Rooms.** The streaming world is cut into `WORLD_CELL`-pixel cells (`world:<cx>,<cy>`). Inside a cell a pose reaches
only the peers within `RANGE_PIXELS` of the sender. A town, a dungeon and an interior are each a room of their own,
and everyone in them hears everyone. A chat channel is a room on the `CHAT_ROOMS` whitelist: it relays lines, never
poses. A cell's key (`worldRoom`) is a floored world pixel and may be negative, so a cell past the Bay's west and
south edges is a room like any other.

**Identity.** A hello carries an id and the secret the first hello minted. A second hello with the same id must
carry the same secret; it then replaces the old socket. A welcome carries at most `ROSTER_MAX` peers, the nearest.

**Poses.** A pose is position, facing, gait, weapon state, swing and cast counts and arrows loosed. The client sends
`POSE_HZ` a second and slows towards `POSE_HZ_MIN` in a crowd (`poseHzFor`); the relay drops anything past
`POSE_HZ_MAX`. A look is the paperdoll's recipe - race, gender, face and the worn items projected onto
`LOOK_ITEM_FIELDS` - so a look is small and carries no inventory. Other players are drawn by `src/net/remotePlayers.js`
and the `src/net/peer/` modules.

**The room's memory.** A world room (a dungeon or an interior, `isWorldRoom`) keeps a snapshot of its place in the
object's storage: the foes and how they stand, piles, dropped loot, actions and door locks. The room's host - the
hello'd socket in it longest - publishes it, and a joiner gets it in the welcome. A dungeon one player cleared stays
cleared for the next, through an empty room, for `worldTtlMsFor` its key. The relay stores the frame as it came and
reads none of it.

**Live foes, doors and loot.** The host streams its changed foes (`foes`, `FOES_HZ_MAX` a second) and the relay fans
them to everyone else, whose foes are puppets. A blow on a host's foe (`hit`) goes to the host alone. A player's own
foes in a world room - a building's, a shared quest's - ride `own` beside the host's. A door, lever, platform or
opened container is whoever touched it: any player sends `act`, and the relay fans it to the rest. When the host
leaves, the seat passes on (`host` frame) and the puppets go live from where the stream left them.

**The clock.** Online, time is a function of wall time: `sharedClassicMinutes` counts from `ONLINE_EPOCH_MS` at
Daggerfall Unity's default time scale (a game minute every five real seconds). The welcome carries the relay's clock,
so a client with a wrong machine clock reads the world's time through the offset. Nothing local moves it.

**Quests.** Each player's quests, dialogue, travel map and history are their own; the story you are in is yours.
Two exceptions: the foes of a quest the party shared ride the party's stream, so the party fights the same ones and a
kill counts for every linked copy; and the foes of a world quest (`WORLD_QUESTS`, the Curse of Daggerfall) ride the
cell for everyone (`src/scenes/quest/questFoeHost.js`).

**Trust.** Outside the refereed rooms the room code and the relay's gates are the access control: a client's blow is
applied as sent. A siege, a duel, the open zone and the boss fights are refereed by the relay (`src/net/siege/siegeRef.js`,
`src/net/duel/duelRef.js`, `src/net/wild/wildRef.js`, `src/net/bossRef.js`, `src/net/bossBody.js`); what a realm
character carries off is judged at its checkpoint (`06-Systems/Integrity-Arc.md`).

## Rules

- Quests stay separate: no player's quest engine decides for another, and no one's save changes shape because they
  played with a friend (Mac).
- One simulation per room, the host's; the relay introduces, relays and referees, and runs no world. Lockstep is not
  possible here: the frame loop has a variable `dt` and the simulation draws unseeded randoms (Mac).
- WebSocket through a Cloudflare Durable Object, no WebRTC: a relay always connects (Mac).
- The world is the server: a place's memory is the relay's, never a save's (Mac, WORLD1).
- The shared clock is wall time; no rest, fast travel, sentence, `?tod` or `?timescale` moves it online (Mac, WORLD5).
- One home for the wire's law: `src/net/wire.js`. The relay refuses a client older than the world online with
  `GROUND_OLD_WORDS` (`server/src/index.js`).
- Ingress is gated and counted: `MAX_FRAME_BYTES` a frame, `SOCKETS_MAX` sockets a room, `HELLO_WAIT_MS` to say
  hello, `DROP_STRIKES_MAX` dropped poses before a close.
- A deploy of the relay restarts every Durable Object and drops every connected player (`server/wrangler.toml`);
  `RELAY_VERSION` in `src/net/wire.js` names what is live.
- A scrolling flex column whose rows may hide their overflow gives those rows `flex: none`, or the rows shrink to
  nothing instead of scrolling (`.dfchat-line`, `src/ui/chatPanel.js`).

## Code and tests

- `src/net/wire.js` - the wire's law: frames, rooms, rates, bounds, the shared clock, `RELAY_VERSION`
- `server/src/index.js` `Room` - the relay's Durable Object
- `server/src/relay.js` - the relay's door onto the wire's law
- `src/net/online.js` - the client session: hello, poses, the welcome, reconnects
- `src/net/remotePlayers.js`, `src/net/peer/` - other players' bodies and effects
- `src/scenes/quest/questFoeHost.js` - shared-quest and world-quest foes
- `test/server/online_relay.test.js` - the relay's law, executed
- `test/net/chat1.test.js` - the chat panel's behaviour and its sheet's flex law
- `tools/chatLayoutProbe.mjs` - measures the chat list's layout in Chromium

## Open

- Splitting a party across interiors.
- Voice chat.
- Validating a client's blow outside the refereed rooms.
- Binary framing or WebRTC behind the same messages, when the numbers call for it.
