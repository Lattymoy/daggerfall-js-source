# Multiplayer Arc

The slices, in order. Each one is shippable on its own, verifiable
without the next, and reversible. The first thing that can be SEEN
working is MP1, and everything before it exists to make MP1 honest.

Design and the three locked decisions: `Multiplayer.md`.

## MP0 - The room

The Worker and one Durable Object per room code. `hello`, `roster`,
`leave`, a relay that forwards host→all and client→host, and a
four-letter code you can read out loud. No game touches it yet: the
deliverable is two browser tabs that both see the same roster, and a
node pin that drives the DO's relay logic with fake sockets.

Also here: `net/room.js` in the port - the client side, ONE module, a
null object when no room is joined. Every later slice goes through it.

Verified by: two tabs, one roster, one leaves, the other sees it.

## MP1 - Two browsers in one exterior see each other move

The slice that makes it real. A joining client receives the host's
`world` envelope, restores it, spawns at the host's position, and both
players broadcast `tf`. Each renders the other as the third-person body
(enhanced) or a player sprite (classic), interpolated.

The seam: the exterior host's frame loop reads `room.remotes()` and
draws them; its own player pushes `room.transform(...)`. That is the
construction seam, and it is named here so the other three hosts get
the same one in MP4/MP5 rather than their own.

Verified by: a Playwright probe with two browser contexts in one room,
asserting the second sees the first's body at the first's position and
that moving one moves it on the other's screen. `bootProbe` unchanged.

## MP2 - One clock, one sky

`tick` at 1Hz: `classicMinutes`, weather. Clients snap time and weather
to the host's. Rest and loiter, which advance time, are host-only
actions in a room - a client's rest request is a `req` the host
applies.

Verified by: two contexts, host rests, both clocks agree.

## MP3 - The host's enemies

Enemies are the host's. `enemy` carries pos/state/health for everything
awake; clients render and never simulate. A client's strike is a `hit`
the host applies; an enemy's strike on a client is a `hit` the host
sends and that client applies to their own entity.

The subtle part: enemy AI targeting must know about remote players as
targets. The host's motor already has one player; it gets a list.

Verified by: two contexts, one enemy, both see it die.

## MP4 - Through the door together

Interiors. When the host enters, the party follows: a `world` envelope
for the new location, clients transition. The interior host takes the
MP1 seam.

## MP5 - Into the dungeon together

Dungeons. The dungeon host takes the seam; dungeon state (doors,
action records, lights) rides `world` on entry and `ev` after.

## MP6 - Loot

Loose loot and containers. A pickup is a `req`; the host arbitrates
first-come and the item goes to exactly one inventory. Dropped items
are host-owned world state.

## MP7 - The door in front of the room

The UI: Host / Join on the menu with the code, a roster on the HUD,
join/leave notices in the game's own text idiom. Both skins.

## MP8 - Later

Host migration, split parties across interiors, chat, reconnection to a
running session, WebRTC behind the same messages. Named so they are not
mistaken for missing; none is basics.

## Laws that apply from MP0

- One seam per host, named in the slice that adds it, swept by a pin.
- `net/room.js` is a null object when no room is joined; solo behaviour
  is pinned unchanged.
- Every message carries a version; an unknown version is a refusal
  with a reason, never a guess.
- The save envelope is the wire format for world state. No second
  serializer.
