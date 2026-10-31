# Online

Online play puts many players in one Tamriel. Each player runs their own world on their own machine; a Cloudflare relay
shares presence, chat and each place's memory, and an account service keeps what must outlive a session (characters,
homes, guilds, currency). The player meets it through the front door's ONLINE pane, the names over other players'
heads, the chat box and the shared state of the places they visit. Daggerfall Unity has no multiplayer; all of this is
our own.

## How it works

### The wire

`src/net/wire.js` is the one law both ends read. The relay re-exports it (`server/src/relay.js`) and the client imports
it, so what the relay refuses the client never sends, and what the relay sends the client checks the same way. Frames
are JSON text, one message each. A client says `hello` once and first (an id and its secret, a name, a look, a pose),
then poses, pings and the room's other words. `RELAY_VERSION` names the protocol; it changes with every wire change.

### Rooms

The relay is a Cloudflare Worker whose Durable Object `Room` (`server/src/index.js`) holds the hibernatable sockets of
one room. The client names the room (`src/net/online.js` `roomKeyFor`):

- The open country is cut into `WORLD_CELL`-pixel cells, `world:<cx>,<cy>`. Inside a cell a pose reaches only peers
  within `RANGE_PIXELS` of the sender. A player near a cell edge also holds the neighbouring cells within range (the
  halo, `HALO_OF_PARAM`), so a peer across the edge is seen. A crowded part of the map shares one object per node of a
  quadtree over the cells (`src/net/cellTree.js`; `bible/11-Multiplayer/Scale-Arc.md`).
- A dungeon is `dungeon:m<mapId>`, a building `interior:m<mapId>.<buildingKey>`. The map id is read unsigned. A place
  the client cannot name is no room: the session leaves rather than pool strangers.
- A quest's dungeon or building can be an instance for a player and their party (`src/net/instanceRoom.js`;
  `bible/11-Multiplayer/Instances.md`).
- Chat channels are rooms on a whitelist (`CHAT_ROOMS`): World, one per region for all 71 regions, languages, Trade and
  LFG. The hub (`SOCIAL_ROOM`, sharded `HUB_SHARDS` ways in `src/net/hubShards.js`) keeps friends, parties, the seat
  and server-wide words. Chat is in `bible/06-Systems/Chat-Roster-And-Names.md` and
  `bible/11-Multiplayer/Chat-Safety-Arc.md`.

### The session

`OnlineSession` (`src/net/online.js`) holds one room's socket and its peers. A pose goes out when it moved, at most
`POSE_HZ` a second (fewer in a crowd), and every `HEARTBEAT_MS` regardless. Each peer is drawn eased toward its last
pose and snapped on a teleport. A peer silent past `PEER_TIMEOUT_MS` is hidden; only the room's `leave` removes it. A
dropped socket reconnects with a doubling backoff (`BACKOFF_MIN_MS` to `BACKOFF_MAX_MS`). The relay's own closes are
final: `CLOSE_POLICY` (a refused frame), `CLOSE_REPLACED` (another socket said hello with this id). The id and its
secret are minted once per tab. A changed look is sent as a `look` frame.

### Who may play

Online play uses a realm character kept by the account service, never a local save; saving online is the service's
(`bible/06-Systems/Realm-Arc.md`). A hello whose identity token names no realm character of its account is refused with
`REALM_DOOR_WORD`. One account has one seat: a tab that goes online closes the account's other tabs through the hub,
and other tabs of the same browser through a `BroadcastChannel` (`src/net/oneSeat.js`). The newest tab wins; a tab that
lost its seat waits for its player to take it back.

### The others, drawn

`src/net/remotePlayers.js` draws each peer as their paperdoll on a billboard, composed through the pure
`composePaperDollPixels` door with its own buffer. With the Morrowind layer on, a peer is a Morrowind body instead
(`src/net/peer/`), and the doll stands wherever a body does not. The pose carries the drawn weapon, swings, casts,
arrows, mount, torch, seat and concealment, so a peer looks as they play. Names and badges are drawn over heads within
`NAME_RANGE`.

### A room's memory and its foes

Each world room has a host, chosen by the relay (`{t:'host'}`). The host:

- publishes the room's memory (`{t:'world'}`) every `WORLD_PUBLISH_MS`: a dungeon's dead, opened doors and emptied
  containers, a building's doors and opened shelves. The relay keeps it for whoever comes next and forgets it
  `WORLD_TTL_MS` after the room last emptied (`INSTANCE_TTL_MS` for an instance).
- runs the layout's foes and streams them (`{t:'foes'}`, every `FOES_MS`). Everyone else draws them as puppets and
  sends blows to the host (`{t:'hit'}`). The host's foes hunt every player in the room.
- shares doors, levers, platforms and loot as acts (`{t:'act'}`) from whoever touched them.

In the open country there is no layout: each player's encounter foes are their own, streamed to the cell
(`{t:'own'}`), and a quest's foes ride to the player's party. Dead foes and emptied containers come back on their own
clock from the moment they fell (`src/systems/dungeon/dungeonRespawn.js`).

### Loot

A room's container is one base list for everyone, rolled on dice seeded by the container's name
(`src/systems/roomLoot.js` `roomContainerName`), with each player's own Luck and Renown rolled as a personal bonus over
it. Takes are claims by place, judged first come by the owner (`judgeRoomClaim`). A foe's body in the street or a
building is its spawner's; others read and claim it by place (`src/net/bodyLoot.js`, `src/scenes/bodyLootHost.js`).

### Time, rest and death

The clock and the day's weather are the world's, from the relay's clock (`sharedClassicMinutes`;
`bible/06-Systems/Online-Time-Arc.md`). A rest waits for nothing online (`bible/06-Systems/Online-Waits.md`). A death
online respawns the player at the nearest fitting safe place - a temple, a town, a graveyard, or a dungeon's door - with
part of their health back (`src/systems/deathRespawn.js`), and costs a tenth of the gold carried
(`src/systems/deathPenalty.js`).

### Homes

A player can buy a building in any town as an online home (`src/net/homeLaw.js`, kept by
`server-account/src/homes.js`). A home is one character's, priced by the ground it stands on and the town's size, and
its owner says who may enter (`HOME_ENTRIES`: private, party, public, guild). The owner furnishes it with decor
(`src/net/decorLaw.js`), can hang doors, rent a room, paint its outside, set pieces in its yard
(`bible/11-Multiplayer/Yard-Cells.md`) and hire vendors. A guild may own one home as its hall (`src/net/hallLaw.js`).
A home bought offline stays offline.

### Everything else online

Each has its own page: parties and friends (`bible/06-Systems/Social-Party-Arc.md`), guilds
(`bible/11-Multiplayer/Guilds-Made-Plain.md`), the Seats and sieges (`bible/11-Multiplayer/Seats-Arc.md`), the
professions and silver (`bible/06-Systems/Professions-Arc.md`), the update notice
(`bible/06-Systems/Server-Update-Notice.md`), world bosses and staff events (`bible/11-Multiplayer/`).

## Rules

- The wire's law has one home, `src/net/wire.js`; the relay and the client both read it.
- The relay's bounds live in the wire: `POSE_HZ_MAX`, `HELLO_HZ_MAX`, `SOCKETS_MAX`, `ROSTER_MAX`,
  `DROP_STRIKES_MAX`, `NAME_MAX`, `MAX_FRAME_BYTES`, and the world's extent `WORLD_PIXEL_BOUND` (all of Tamriel, never
  the Bay's 1000).
- A hello with an id the room holds must carry that id's secret; a reconnect with both replaces the old socket.
- A player brings their own developed character online; presence, words and places are shared, each player runs their
  own world (Mac). Online characters are the realm's, apart from offline saves (Mac).
- A client without the Morrowind data sees the paperdoll instead (Mac).
- One character online at a time per account (Mac). The newest tab wins.
- Dungeon respawn: twenty minutes, forty for an elite dungeon (the owner); the wild zone and Super dungeons use
  `RESPAWN_MS`, thirty minutes (Mac). Each dead foe and each emptied container runs on its own clock
  (`dungeonRespawnMs`).
- A container is a shared base plus a personal bonus, and the host arbitrates a race for one piece (Mac).
- A death online respawns and costs a tenth of the gold carried; there is no switch (Mac). The bank and letters of
  credit are never taken.
- Housing is exclusive: one owner per building, server-wide; who walks in is the owner's choice; a house bought
  offline stays offline (Mac). A character may hold `HOME_CAP` homes in a region (the owner).
- A home's price is held to `HOME_PRICE_MIN`..`HOME_PRICE_MAX` by the service (`homePriceOk`); a sale refunds
  `HOME_SALE_SHARE`.

## Daggerfall Unity

DFU has no multiplayer. Where online play changes a single-player law: death respawns instead of ending the run
(DFU's `PlayerDeath` returns to the title); dead foes and emptied containers respawn; a house is three a region where
`DaggerfallBankManager` allows one; a home's price is its ground, not `GetHousePrice`'s radius.

## Code and tests

- `src/net/wire.js` - the wire's law, the room keys, every relay bound, `RELAY_VERSION`
- `src/net/online.js` - `OnlineSession`, `roomKeyFor`, the pose cadence and the reconnect
- `src/net/remotePlayers.js` - the peers drawn, their names over heads
- `src/net/oneSeat.js` - one seat per account and per browser
- `src/net/cellTree.js` - the cell quadtree the Worker maps cells onto
- `src/systems/roomLoot.js`, `src/scenes/roomLootHost.js`, `src/net/bodyLoot.js` - shared loot
- `src/systems/dungeon/dungeonRespawn.js` - respawn times
- `src/systems/deathRespawn.js`, `src/systems/deathPenalty.js` - the online death
- `src/net/homeLaw.js`, `src/net/decorLaw.js`, `src/net/hallLaw.js` - homes, decor, guild halls
- `server/src/index.js` - the Worker and the `Room` Durable Object
- `test/server/online_relay.test.js` - the wire's law and the Room over fake sockets
- `test/net/online.test.js` - the session over a fake socket, room keys, easing
- `test/net/world1.test.js` to `test/net/world4.test.js` - room memory, foes, acts, loot
- `test/net/oneseat.test.js` - the seat
- `test/scenes/donline1_respawn.test.js` - the online respawn

## Open

- The relay is one Durable Object per room or cell node; interest management filters what is sent, not what is
  iterated.
