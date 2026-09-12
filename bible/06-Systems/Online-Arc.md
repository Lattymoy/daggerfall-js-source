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
own world from their own save; presence is shared (ONLINE1), words
(CHAT1) and, since WORLD1, a world room's memory - the host's snapshot
of the place, handed to whoever comes next. `11-Multiplayer/Multiplayer.md`
is the earlier co-op design (a host's browser as the server, its world
shared); ONLINE1 kept its first decision - your own character from your
own save - and none of the sharing, WORLD1 began the second in its own
shape, and that record says so at its head.

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
an id that lives on. It stored nothing past the connection until
WORLD1 (below): an empty room forgets every look and secret, and
keeps its world. Deployed at
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
player's id and its secret are minted once per TAB and kept in the
tab's own storage (`tabStorage`, the seam's; TABS1 - Mac: "even though
I load in with a different save, it always says the character is open
in another window": the id lived in the browser's storage, so two tabs
of one browser were one player). The
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
relay to join, on the prefs shelf (`onlineName`, `onlineServer`); every
restorable save is a card and the one pressed is the character brought
in (SLOTS1, below); PLAY ONLINE resolves `'online'`, which
`src/main.js`'s enhanced branch turns into `?online` beside `?load`
and the picked slot's `?loadkey`, under F12's set-or-delete law.
Saving stays local; the relay never sees the save.

## SLOTS1 (2026-09-12): the save to bring in

**Mac: "one thing we need to add so I can test myself is multiple save
slots and then the ability to choose which save to use in online."**
The slot store was SAV4's (`src/systems/saveSlots.js`: a save is the
(character, slot name) pair, SaveLoadManager's own identity), and the
classic save window had the whole list; the enhanced skin drew one
card - the most recent - and its Save pane wrote QuickSave alone.
Now:

- `restorableSaves()` is the one walk: every slot this build can
  restore, most recent first, with its info and snap; the most-recent
  question is its head.
- The Load and Online panes draw a card per slot (the slot's name as
  the tag, the character's line and numbers); the pressed card's key
  rides the door - the front door's `takePickedSaveKey` into
  `?loadkey` (the SAV4 boot arm loads it), the pause door's into the
  host's `loadKey` seam. Delete removes that slot alone.
- The Save pane (pause) takes a slot name: a name the character
  already has overwrites it and the card says which, a new name is a
  new slot; the character's own slots stand below as cards, each an
  Overwrite. The name rides `takePickedSaveName` into the pause door's
  `quickSave` arm, which hands it to the host's `saveAs` seam - the
  two verbs the MAC1 pin reads stay as they are.

Pinned in `test/slots1.test.js` (3): the list executes over a fake
storage; the seams hand a pick over once; the doors are pinned by
source. Two browsers, two slots, two names over two heads: Mac's own
test.

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

## MWBODY1 (2026-09-12): the others in the Morrowind body

**Mac: "Can we go ahead and knock out the deferred morrowind model."**
ONLINE1 deferred it because the rig was read as a singleton. It is
not: `src/combat/fpArm.js` exports one INSTANCE (`fpArm =
createFpArm()`) of a factory, every mutable the machine owns lives in
the instance's closure, and what the module keeps at its level (the
ESM walk, the textures, the face matches, the garment colours, the clip
reports, the icons)
is keyed by content and shared by design. So a peer is one more
`createFpArm()` - `src/net/peerBodies.js`, `PeerBodies`:

- **Built from the look** through the same door the player's own arms
  take (`buildFpArm`): `peerBuildOpts` maps the look onto the inputs
  weaponRig's `armBuildOptsOf` maps the entity onto - the race in the
  ESM's spelling (`mwRaceId`), the female flag, the face, the worn
  readout (`dfWornEquipment` over the stub's equip table), the right
  hand. Builds run one at a time; a body that will not build (a race
  with no body records, a build that threw) is released and the doll
  stands, retried after `BODY_RETRY_MS`; bodies are capped at
  `BODIES_MAX` (a build parses meshes for seconds and holds a GPU
  mesh), and the rest keep the doll.
- **Fed a camera of its own.** The rig reads a camera callback once a
  frame (the player's own is world.js's `{ pos, yaw, pitch, sneaking,
  bob, move }`);
  a peer's is a stub from the pose - the yaw (eased, so the rig sees a
  turn every frame), `mv` as the forward move and, at 2, the run (the
  wire's own bit, the sender's `isRunning`), so the movement slot
  (MW-D26) picks the walk, the run or the idle, and the ground speed
  measured off the drawn pose, which sets the clip's rate. The view is
  switched to third once built (`setViewMode`; a build resets it to
  first) and the machine stepped by the frame's dt. The pitch is not
  applied: the body stands level, vanilla's own law.
- **Drawn by its own `drawThird`** at the peer's feet with its yaw -
  the same sprite-box pass the player's body takes (MW-D24), right
  after it, in the exterior pass and in both modal passes
  (`host.drawPeerBodies`). A peer in a body draws no doll; its name
  rides the doll pass's own list, at the capsule's head by the race's
  height scale (MW-D34).
- **The gate** is the host's: the enhanced skin, the player's own arms
  switch (MWA1's `mwArms` pref - the layer is on when the arms are)
  and Morrowind data attached. Off, every body is released and every
  peer is a doll. The name rides the doll pass's list at the body's own

## AUDIT MWBODY (2026-09-12)

Mac: "Lets do an audit on this." Three opus finders (the rig as a peer
body, the module and the host, the pins and the record - the last by
mutation), each refuted against the code and fixed here:

- **A throw was the frame's end (A1).** One peer's rig throwing in
  `update` or `drawThird` took the game loop down for everyone. Both
  are guarded now: the body stands down to its doll, the look waited
  out, the reason said once.
- **The recenter (B2).** The bodies' feet were placed before the
  floating origin's step and drawn after it: every peer jumped a tile
  for one frame at each crossing, the same D5 the dolls had. The feet
  follow the origin (`offsetAll`).
- **The run guess (B3/A7).** `RUN_SPEED` sat under the walk speed of
  any character with SPD past 52; most peers ran while walking. The
  wire carries the sender's own bit now (`mv` 2).
- **The flicker (B1/A2/A6).** A peer at the range edge, silent past the
  timeout, or across a room change left the drawable set and its body
  was released and rebuilt - seconds of parsing per flicker, a queue
  that never drained. A body lingers `BODY_LINGER_MS`; a released
  body's build is skipped before it runs and unloaded when it lands.
- **The cap (B5/B12).** First come, forever: the first eight peers
  seen kept their bodies while the one in front of you stood as a
  doll. The nearest first now, and a far body yields its slot past
  `SWAP_MARGIN`; the sweep runs before the count.
- **The range (B6/A3).** Eight rigs posed and re-uploaded every frame
  for peers two kilometres off: past `BODY_RANGE` the rig sleeps and
  the doll stands; a body behind the eye is not drawn.
- **The step (B8).** A snap read as a sprint for half a second: a jump
  past `JUMP_UNITS` resets the pace.
- **The turn (A8).** The rig reads turning off the yaw's change frame
  to frame, and an eased pose stops between arrivals: the turn clip
  stuttered. The drawn yaw eases toward the pose's (`YAW_EASE`).
- **The rest.** A build's failure said nothing and was never pruned
  (B9/A16/A17: kept with its reason, said once, dropped on success);
  the dead stood in their bodies over the death screen (B7); nothing
  released the rigs on the page's hide (B11); a body was reported
  standing on `state` alone while the rig had no clip to draw
  (B4/A12: `thirdActive` gates it); a data re-attach left the peers in
  the last generation's bodies (A9); a rejoin with new gear every
  second rebuilt every second (A11: `BODY_REBUILD_MS`); two builds at
  once opened every archive twice (B10/A13: the archives once); the
  posed bounds were walked again per body per frame (A4); a movement
  note grew per frame (A14); the record's stray sentences (C4-C6,
  C10, C11, C18-C20).
- **The pins (C1-C3, C5, C7-C9, C15, C17).** Ten of forty-three
  mutations survived: the released-while-building guard, the serialized
  builds, the host's draw hook, four constants pinned against
  themselves, a fake that could not throw or refuse the third person,
  a `drawThird` that drew before a step. All killed; the fake rig is
  shaped like the instance API.

Left as recorded (the weapon, the swing and the arrow came with MAC7,
below): strafe and backpedal play the forward walk; a body's textures are the instance's
own (no sharing across peers of one look); the first-person arm is
built and refused alongside the body it never draws.

Pinned in `test/mwbody1.test.js` (7): the constants once and
literally; the look's mapping and the stub camera execute; PeerBodies
over a fake rig factory shaped like the instance API (one rig per peer
built one at a time, the view, the step, the draw only once stepped,
the release, the origin's shift, the linger, the skipped and the
unloaded build, the jump, the range, the nearest-first cap and the
yield, the refused and the thrown failure with their reasons, the
retry, the gate); the doll pass's skip and the name; the host by
source. Not seen with two real players and the data attached from
here: Mac's two browsers are the gate.

## CHAT1 (2026-09-12): the live chat

**Mac: "So next for online, I want to add a new UI element. The live
chat in enhanced format. Players will be able to type and chat live
with other players. Currently I just want one world tab with the
ability to add more tabs at a later time."**

- **A channel is a room** (`src/net/wire.js` CHAT ROOMS): a key in
  CHAT_ROOMS - a whitelist, the World tab's `chat:world` alone today -
  is a channel, not a place. The Room (`server/src/index.js`) keeps the
  secret and no look there, tells a joiner an empty roster, announces
  no join and no leave, relays no pose (gated and counted all the
  same), and hands every chat line to every socket that said hello -
  the sender included, which is the receipt. A later tab is a later
  entry in the list, and the Worker opens no object for a `chat:` key
  outside it. In a PLACE room a chat line reaches whoever a pose
  would, and the sender besides (the receipt is a channel's law and a
  place's alike), so a local tab can ride the presence socket when it
  comes. The wire: `{t:'chat', text}` in, `{t:'chat', id, name, text,
  at}` out, `at` the relay's clock.
- **The law**, one home at both ends: `sanitizeChat` (control
  characters, every Unicode format character and the variation
  selectors bar U+FE0F gone, a lone surrogate gone, a stack of
  combining marks cut to three, whitespace one, CHAT_MAX 240 and never
  a bound inside a surrogate pair - and idempotent, so what the client
  sends the relay takes), the frame after hello only, `chatGate` at
  CHAT_HZ_MAX (2 a second, the burst the same) with its own bucket and
  strikes (CHAT_STRIKES_MAX 20, then 'too many lines' and 1008), the
  room's own budget CHAT_ROOM_HZ_MAX (20 lines a second for everyone,
  over which a line is dropped with no strike and no echo). A channel
  holds CHAT_SOCKETS_MAX (2048) sockets and admits CHAT_HELLO_HZ_MAX
  (50) hellos a second - deeper than a place's, never off. A room that
  drains sweeps its own storage on the way out.
- **The session** (`src/net/online.js`, `presence: false`): the hello
  with no pose, a pose refused, a `{t:'ping'}` every HEARTBEAT_MS that
  the runtime's auto-response answers while the object sleeps (a
  channel of idle players wakes its object for nothing); `sendChat`
  sanitizes and gates as the relay does and answers false for a line
  that did not go (nothing to say, over the rate, no socket) so the
  field keeps it; a line in reaches `onChat` as {id, name, text, at,
  mine}; `rejoin` is the one way back after the page's goodbye and,
  CHAT_REJOIN_MS (30 s) on, after a terminal close; `statusLine` takes
  its label. One such session per tab, under the presence session's
  own id, secret, name and look (the relay guards an id by its secret
  per room, so one identity holds in every room), and none at all when
  the relay the player named is one the law refuses.
- **The log** (`src/net/chat.js`, pure): CHAT_TABS (the World tab
  alone), CHAT_KEEP (200) lines a tab, unread unless the panel is open
  ON that tab, a version the panel repaints on (never per frame), the
  peek - the last CHAT_PEEK (5) lines younger than CHAT_FADE_MS (20 s),
  held three quarters then faded - on the log's own clock (B1: one
  clock, never the rAF's).
- **The panel** (`src/ui/chatPanel.js`, the enhanced skin's DOM,
  top-left under the touch layer's corner buttons): closed, the peek
  over the world and "Enter to chat" (a Chat button with an unread
  badge on a touch device); open, a tab bar (one button per row of
  CHAT_TABS, a badge each), the tab's lines with the relay's time and
  a tag from each sender's guarded id (two Macs read as two people),
  the field. THE OPEN KEY IS THE CURSOR KEY: DFU's ActivateCursor
  binding (Enter by default), resolved through the registry, since
  opening frees the cursor - the panel is a pointer surface, so the
  host releases the lock on open and takes it back inside the closing
  gesture (MAC1's rule), and a rebind moves the chat key with it. The
  key opens and puts the caret in the field; Enter in the field sends
  on the active tab and closes; a line that did not go stays in the
  field and the panel stays; an empty Enter and Escape close; a touch
  Send keeps it open. ONE capture listener on the window: a key typed
  into the field is stopped there, before the host's bubble listener,
  so the host's ring (`keys.add`) never fills from a chat line - CG2,
  typing 'w' walks no one - and F5 stays swallowed; an Enter that
  commits an IME candidate is the IME's; a held Enter opens once and
  its repeats send nothing; Tab stays in the field; the key UP is not
  stopped, so a key held when the panel opened leaves the ring on
  release. The key opens only when no enhanced overlay is up (the
  compass dial is one, now), no other field owns the key, the host is
  willing (`canOpen`: not paused, no window over the HUD) and the
  event is the keyboard's own (`isTrusted` - the touch layer's ⏎
  synthesizes an Enter for the windows it drives). A PRESS inside the
  open box is stopped at the box (the host adds every window mousedown
  to its ring and swings on the left button outdoors); a RELEASE is
  not, so a press begun on the canvas still lets go. Lines are
  textContent, never markup; the open list grows by the lines that
  arrived and keeps a reader's scroll unless it sat at the bottom; the
  root is no live region (the box is the log).
- **The host** (`src/scenes/world.js`): `chatStart` from `onlineStart`
  on the enhanced skin with a document and a relay the law admits;
  `chatFrame` rejoins and ticks every channel and renders the panel -
  hidden, and closed, under a window over the HUD, the pause, or an
  enhanced overlay; the channel's own status line (`chat: connecting`,
  `chat: reconnecting`, a refusal) - BEFORE the dead return, so the
  channels keep their heartbeat and their reconnect while the death
  screen is up (the panel itself is paused away like any HUD: the dead
  read and say nothing until they rise). The page's hide leaves every
  channel and keeps the panel, so a page restored from the cache gets
  its chat back through the rejoin. Classic has no chat yet (Mac: "in
  enhanced format").
- **Not done**: no local tab (the presence socket already carries a
  line as far as a pose; the tab is the next row of CHAT_TABS); no
  history past the tab's 200 (a reload is a clean log); no name
  reservation (the tag beside the name is the cue - a reservation
  would hand 'Traveller' to whoever came first), no mute, block or
  moderation beyond the rate gates and the sanitizer; a line the room's
  budget dropped is gone without a word beyond the missing echo; the
  dead cannot chat; a channel's capacity unmeasured past a handful.

Pinned in `test/chat1.test.js` (7) - below.

## AUDIT CHAT (2026-09-12)

Mac: "Lets do an audit on this before merging." Four opus finders (the
relay's law and the Room; the session, the log and the host; the
panel's input, keys, DOM and mobile; the pins and the record by
mutation), each refuting its own candidates against the code and
proving what stood with scratch tests - the panel's in headless
Chromium with real trusted input. Every finding fixed here, on the PR:

- **A1 (high) a channel was a prefix.** `isChatRoom` answered yes to
  any `chat:` key, so anyone could mint a room with a channel's
  privileges - and the channel's hello gate was OFF, so the chat
  gate's strike cap was free (connect, twenty-three 16 KB frames,
  reconnect at once). Now CHAT_ROOMS is a whitelist, the Worker 404s
  a `chat:` key outside it, and a channel's hello gate runs at
  CHAT_HELLO_HZ_MAX, deeper than a place's and never off.
- **A2 (high) no room-wide budget.** Every gate was per socket and the
  fan was everyone, so one object owed talkers × listeners frames a
  second with nobody over the rate. CHAT_ROOM_HZ_MAX bounds the room.
- **A3 (medium) ungated channel ingress.** A pose in a channel returned
  above the gate, uncounted and never closed; a ping (pre-existing)
  likewise. Both are gated on the socket's bucket first now.
- **A4 (medium) / B3 (medium) the sanitizer.** Five hand-written ranges
  missed U+061C, the soft hyphen, the tag block and the variation
  selectors; two hundred combining marks on one letter painted over
  the game; and two lone high surrogates made the sanitizer
  non-idempotent, so the client could send a line the relay refused
  with a terminal 1008. Every Cf, the selectors bar U+FE0F, lone
  surrogates gone; marks cut to three; fuzzed idempotent.
- **A5 (medium) the name.** The relay guards the id and the panel
  showed only the name, so anyone could be 'Mac'. A tag from the id
  rides beside the name.
- **A6 / B6 (medium) a refused channel was dead for the page.** Only
  `join` clears `terminal`, and a channel never changes rooms.
  `rejoin` after CHAT_REJOIN_MS. **B4 (medium)** the page's goodbye
  left every channel and destroyed the panel with no way back on a
  cache restore: the panel stays and `rejoin` brings the links back.
- **A7 (medium) storage.** The empty-hello sweep never runs in a room
  that is never empty; the last socket out sweeps.
- **A8 / B2 (medium) a lost line.** The client did not run the relay's
  chat gate, the relay drops an over-rate line without a word, and the
  field was cleared before the answer. `sendChat` gates first; a line
  that did not go stays in the field.
- **A9 / B1 (high) the back door.** A relay the law refused nulled the
  presence session's url, and the channel's constructor resurrected
  the public default from that null - the player's id, secret and name
  went to a host they had opted out of. No url, no chat.
- **B5 / D4 the status line** said `chat: closed` through every
  reconnect; the session's own `statusLine` takes a label now.
- **B7 / C10 / D-record** "the dead may still talk" was false (the
  death screen pauses the game); the sentence now says what the code
  does. **D3** "no pose ever out" was unenforced; `sendPose` refuses.
  **D10** a pose never reaches the sender, a chat line does; said.
  **D11** Multiplayer.md's open question was closed for text.
- **C1 (high) the compass dial** was the one enhanced overlay
  `overlayOpen()` could not see, so Enter over the rose opened the
  chat under the scrim AND committed the dial. The dial registers with
  the stack. **C2 (high)** the panel opened under pointer lock: the
  mouse kept looking and swinging while the player typed and nothing
  in the box could be clicked. The host frees the lock on open and
  takes it back on close. **C3 (high)** the IME's Enter shipped the
  half-composed line. **C4 (medium)** the panel ate Enter at the
  window and starved DFU's ActivateCursor toggle for good, on a
  hardcoded key; the open key is that binding now, through the
  registry. **C5 (medium)** the box swallowed the RELEASE, so a swing
  begun on the canvas and let go over the panel never let go. **C6**
  a held Enter's first repeat sent a stale draft. **C7** Tab walked
  focus onto Send and gave the keyboard back to the game. **C8** every
  line rebuilt two hundred rows and yanked the reader down. **C9** the
  root's `aria-live` re-announced the whole panel.
- **D1 (high)** the "own bucket" pin ran in a channel where the pose
  arm never reaches its gate; it runs in a place now. **D2 (high)**
  CG2 rests on the host listening in the bubble phase and nothing
  pinned it; the fake window has both phases and the source is pinned.
  **D5-D9** the listener count, the form's preventDefault, the full
  swallow lists, the relay's clock and the attachment bound are pinned.

Refuted and left: the same id across a place and a channel (one object
per key, disjoint storages); the look shared by reference (a channel
keeps no look); the heartbeat clock on reconnect; the `at` stamp's
domain; the peek and splice costs (microseconds); NumpadEnter (implicit
submission still sends); a press inside the box released outside.

## MAC6 (2026-09-12): the dungeon save comes home

**Mac: "A bug. 1. When playing online it doesnt place you where you
last saved your account."**

Not the relay's: the BOOT LOAD's, through the Online door and the Load
door alike. A save taken inside a world-hosted dungeon is the dungeon
host's own envelope (`src/scenes/dungeonContext.js`'s composer - F9
and the pause door's Save both route there in dungeon mode): keyed
`dungeon:<id>`, a dungeon-local position, no map pixel. The world
host's `worldQuickLoad` had two arms - the open world (teleport to the
pixel, land, re-enter a building) and "saved elsewhere" - so a
character saved in Privateer's Hold, where every new character
begins, came back restored and standing at the start cell outdoors.

DFU's load respawns at the save's own map pixel and re-enters the
dungeon BEFORE it restores the position: `RespawnPlayer`'s
insideDungeon arm (PlayerEnterExit.cs:534-537 - TeleportToCoordinates,
GetLocation, StartDungeonInterior) and `RestorePosition` after it
(SerializablePlayer.cs:441-454), off the worldPosX/worldPosZ it saved
beside insideDungeon (:215-217). The port now:

- **carries where the dungeon stands**: `snapshotPlayer` takes
  `dungeon` ({pixel, mapId}, `src/systems/save.js`) and hands it back
  from `restorePlayer`; the dungeon host's composer fills it from its
  own map row through MapsFile's pixel law. A save from before the
  field is found by its dungeon id across the world's location index
  (`dungeonPixelFor`, pure - the host injects the pixel law).
- **splits the dungeon host's load arm**: `quickLoad` is
  `restorePlayer` then `restoreSaved(extras, setPlayerPos)`; the world
  host calls the second half alone with `session: false`, since it
  restored the quest and conversation machines before it teleported
  and a second restore would mount the quest resources twice.
- **the mode machine forwards**: `restoreDungeonSave(extras)`
  (`src/scenes/worldModes.js`) with the same position applier the key
  route hands the context.
- **the boot's third arm** (`src/scenes/world.js`): teleport to the
  pixel, `startInDungeon` (the enter marker first, DFU's
  StartDungeonInterior), then the saved position over it. Never
  silent: a dungeon the world cannot find, or a location with no
  entrance, says so and leaves the character restored where it stands.

Pinned in `test/mac6.test.js` (2): the envelope's field both ways and
the finder over fake locations; the three hosts by source. Not seen
with a real save from here - Mac's Privateer's Hold is the gate.

## MAC7 (2026-09-12): the peer's weapon and swing

**Mac: "Bug. 1. Morrowind doesnt show the player holding their
weapon/attacking. It shows the full sprite and animations but no
weapons."**

The peers' bodies. MWBODY1 built every peer's rig with the weapon its
look carries, but a rig's weapon is sheathed until someone calls
`setSheathed(false)` and it swings only on `attack(strike)` - the two
doors `weaponRig` opens for the player's own rig every frame - and
nothing of either travelled: the wire's pose was position, look
angles and a move bit, so every peer stood empty-handed and never
swung. Now:

- **the wire** (`src/net/wire.js`): a pose carries `wd` (the sender's
  weapon drawn), `an` (the sender's swing count, 16 bits, a peer plays
  a swing when it changes) and `as` (the swing's kind - an index into
  POSE_STRIKES, DFU's WeaponStates order, `combat/fpsWeapon.js`'s own
  STATE_INDEX), all clamped by `validPose` at both ends; a pose from
  before them reads sheathed and unswung.
- **the session** (`src/net/online.js`): a draw or a swing is a change
  worth sending at once (`poseChanged`), and the eased pose carries the
  three whole (`lerpPose`).
- **the rig** (`src/combat/weaponRig.js`): `swing` {n, strike} counts
  every strike the machine starts, BEFORE the Morrowind arm's own gate
  - a classic-skin player swings too, and the peers in Morrowind bodies
  must see it. The host (`src/scenes/world.js`) reads it and the
  sheath into every pose it sends, the hello's included.
- **the body** (`src/net/peerBodies.js`): inside the update guard
  (AUDIT MWBODY A1), the rig's weapon is drawn while the sender's is,
  a swing plays once per count with the wire's kind - never the count
  the body was born with (a late joiner does not replay an old blow),
  never while sheathed - and `release()` runs every frame as weaponRig
  gives its own rig, so a wind-up that is not held lets go.

**#2 (Mac: "Do bow hold, spell casting and arrows on bow").** Four
more bits on the same pose, the same doors on the same rig:

- **the bow's hold**: `wd` is 2 while the sender's machine sits in
  StrikeUp - BowDrawback's draw (`combat/playerWeapon.js`'s gesture:
  the press draws, the release fires) - and a swing that arrives with
  wd 2 is the draw: `attack('StrikeUp', { hold: true })`, and
  `release()` waits while wd stays 2, exactly as weaponRig withholds
  it while the machine holds. The shot is the next count (StrikeDown,
  which the held rig refuses and release fires); a draw let down
  without a shot (the undraw) releases too, as the player's own does.
- **the arrow**: `am` is `hasDaggerfallArrows(entity.items)` - the
  read weaponRig's own per-frame `setWeapon` takes - and a body hands
  its weapon back through `setWeapon(weapon, { hasAmmo })` once per
  change of the bit; a body with nothing in hand is handed no arrow.
- **the spell stance**: `sr` is the host's `magic.spellArmed()`
  (HasReadySpell) and the body stands in it through `readySpell`, a
  boolean compare on the rig's side.
- **the cast**: `cn` and `cr` are weaponRig's `cast` {n, rangeType},
  counted at `castSpellAnim` - the one door both lanes' hands come
  through (CastReadySpell's PlayOneShot moment) - and a body casts
  once per count with the wire's range through `castSpell(rangeType)`
  (TargetTypes' index: self, touch or target by the arm's own map),
  never the count it was born with.

Not done: the doll (the paperdoll billboard has no arm to swing), and
a peer's cast is the arm's motion alone - no missile, no hands in the
classic lane.

Pinned in `test/mac7.test.js` (4): the wire's seven at both ends and
the session's change and easing; the body over the fake rig with the
doors recorded (drawn, sheathed, once per count, never on birth, never
sheathed, the throw law; the hold and its withheld release, the arrow
once per change and never without a weapon, the stance, the cast once
per count); the rig and the host by source. Not seen with two real
players from here - Mac's two browsers are the gate.

## WORLD1 (2026-09-12): the room's memory

**Mac: "So now that this is situated its now important that we bring
the world in line for anyone online. Currently theres a lot
disconnected like enemies, doors, etc. The world is the server and
every player should inhabit that world while also being able to
continue their progress. When it comes to time limits on quest, I
think these should be naturally disabled while online. True
persistance."** Then: "Begin. Take your time."

The plan, five slices: (1) the room's memory - a place's world kept
by the relay and handed to whoever comes next; (2) the authority's
handover - one live simulation per room, passed on when its host
leaves; (3) the live world as events - a blow, a door, a lever sent as
it happens, so two players in one room fight one foe; (4) loot; (5)
the shared clock and weather, and the quest clocks stood down online.
Slice 1 ships here; a dungeon is its first room (the one place whose
world is one self-contained snapshot with a restore arm at both hosts
- MAC6's `collectWorld`/`applyWorld`); towns, cells and buildings are
the next rooms.

- **The host** (`src/net/wire.js`, `server/src/index.js`): every place
  room has one - the hello'd socket that has been in the room longest
  (the hello's `since` stamp on the attachment, ties by id; nothing on
  the instance, so a wake changes no host) - and the relay says who:
  `host` rides every welcome, and a `{t:'host', id}` frame goes to
  everyone when the host leaves (the next-longest) or, on the
  same-millisecond tie the smaller id wins, when a joiner leads. The
  session (`src/net/online.js`) keeps `host`, answers `isHost()`, and
  calls `onHost(id, mine)` on a change alone.
- **The memory** (`server/src/index.js`): in a WORLD ROOM
  (`isWorldRoom` - a `dungeon:` key, today) the host publishes
  `{t:'world', data}` - the one frame admitted past `MAX_FRAME_BYTES`,
  told by its prefix before any parse and capped at `WORLD_FRAME_MAX`
  (512 KiB of UTF-16), an object from a hello'd socket - and the room
  stores it AS IT CAME, never parsed there: the JSON in `WORLD_CHUNK`
  (96 KiB) pieces under `world:<i>` with `world:meta` {chunks, size,
  at, by}, a smaller world deleting its stale tail. A frame from
  anyone but the host, a second one within `WORLD_MIN_MS` (5 s) of the
  same socket's last (the stamp on the attachment, wake-proof), or one
  into a room that keeps no world is IGNORED, not refused - a handover
  races, and a late host's frame is not an offence. The next welcome
  carries the memory raw (`"world":<the stored JSON>`), and the sweeps
  - the empty hello's, the drain's - now forget looks, secrets and the
  hello bucket by prefix (`_sweep`, `storage.list`) and never the
  world: the memory outlives an empty room, which is the point.
- **The dungeon host** (`src/scenes/dungeonContext.js`):
  `sharedWorld()` is `collectWorld()` with the layout's foes alone
  (the leading run before the first `isQuestFoe` - a quest's foes are
  the quest owner's, and quests stay separate: Multiplayer.md's first
  lock), nothing of the player's own (no `teleportedIntoDungeon`),
  keyed by the dungeon's `locationKey`; `restoreSharedWorld(shared)`
  refuses another dungeon's memory and applies with `truncate: false`
  - `applyWorld`'s cut past the record's length is the save's alone
  (a save holds the whole pool), so a memory from a player without
  this quest leaves this player's quest foes standing.
- **The world host** (`src/scenes/world.js`): `onWorld` (the welcome's
  memory) lands on the standing dungeon through the mode machine's
  `restoreDungeonSharedWorld`; `worldPublish(now, force)` sends the
  host's snapshot every `WORLD_PUBLISH_MS` (15 s) while it hosts and
  the socket is open, and at once - forced - when the dungeon is left
  (`onDungeonLeave`, fired by `exitDungeonNow` and the load-or-teleport
  teardown BEFORE the quest flats come down), on the death screen and
  on the page's hide; a new host publishes at once. The client keeps
  the cap too (`sendWorld` refuses a frame past `WORLD_FRAME_MAX`
  rather than earn the relay's terminal close).

Not done here: the live moment - two players in one dungeon each ran
their own foes until WORLD2 (below) made the layout's foes one
simulation per room. The shape of a day is `WORLD_PUBLISH_MS`: a
save's world published every fifteen seconds and on every farewell.

Pinned in `test/world1.test.js` (4): the wire's world frame at both
ends (after hello, an object, past the small cap by its prefix alone,
never past the large one; the world rooms; the constants one home);
the Room over fake sockets and a fake state (the host in the welcome
and the host frame on a leave alone, across a wake; the memory chunked
with its meta, republished smaller with no tail, served verbatim; a
non-host's, a too-soon and a town's frame ignored; the sweeps
forgetting looks, secrets and the bucket and keeping the world; a
channel's welcome unchanged); the session (host, isHost, onHost on a
change, onWorld on a memory, sendWorld the host's and under the cap,
the host forgotten on leave); the three hosts by source. Seen live:
a host's publish into a `dungeon:` room and a second socket's welcome
carrying `host` and `world` whole (122 KB, two chunks), the host handed over on a leave and the memory outliving an empty room, after the relay's redeploy (397de224).

## AUDIT WORLD (2026-09-12)

Mac: "Lets audit everything so far." Four opus finders over everything
since AUDIT CHAT - MAC6, MAC7, OD1 and WORLD1: the relay and the wire;
the client's world half; the peer's arm and the doll; the pins by
mutation and the record by drift - each refuting its own candidates
against the code and proving what stood with scratch tests and live
probes of the deployed relay. Every survivor refuted again here; every
one that stood fixed on the PR:

**The relay and the wire.**

- **A1 (med) the world door was unmetered.** Any hello'd socket in any
  room could stream 512 KiB world frames at line rate: each was parsed
  on the object before the host check dropped it - no bucket spent, no
  strike. Now a large frame, or any frame shaped as one, is answered
  BEFORE any parse: refused with no hello, metered on the pose bucket
  (`_meter`, the one gate the pose arm uses too), and ignored unparsed
  for anyone but a world room's host.
- **A2 (med) the prefix was a cap bypass.** JSON's last duplicate key
  wins, so `{"t":"world",…,"t":"pose"}` passed the large cap and parsed
  as a 512 KiB pose under the pose gate. The type keeps the cap after
  the parse.
- **A3 (med) parked worlds.** `isWorldRoom` was a `dungeon:` prefix
  over an eighty-character key and the sweeps never touch `world:*`,
  so a script could leave 540 KiB in as many rooms as it cared to name,
  for ever. The key is a map id's now (`dungeon:m<mapId>`), and a world
  room's memory is forgotten `WORLD_TTL_MS` (thirty days) after the
  room last drained unless someone is in when the alarm fires
  (`alarm()`, armed on the drain). Mac's call: thirty days is a bound
  against parked storage, not a design - DFU itself forgets a dungeon
  on every exit.
- **A4 (med) a reconnect lost the seat and told no one.** The
  reconnecting host's fresh `since` handed the seat to the
  next-longest, and neither the hello nor the replaced socket's leave
  said so - the room's publishing stalled until an unrelated leave.
  The reconnect keeps the first hello's stamp, so the seat stays; a
  hello announces only when the seat actually moved.
- **A5 (low) the floor rode the socket.** `worldAt` on the attachment
  let a host reset `WORLD_MIN_MS` by reconnecting. The floor is the
  room's `world:meta.at`.
- **A6 (low) the stale tail's delete was a second write.** A crash
  between the put and the delete orphaned chunks no sweep reclaimed.
  Both are issued together, one coalesced write.

**The client's world half.**

- **B1 (high) the host's own memory came back.** A socket drop and its
  reconnect re-hello into the same room, and the welcome handed the
  host its own snapshot up to fifteen seconds old; `restoreSharedWorld`
  resurrected every foe killed since, corpses deleted, loot re-minted.
  The snapshot carries the context's stamp and the context refuses its
  own.
- **B2 (high) "the layout's foes" was "everything before the first
  live quest foe".** The pool only grows; a rest interruption's rat or
  a summon pushed before a quest foe rode the memory and landed on the
  joiner's quest target by index, and a quest foe whose quest ended
  lost its mark. The run is measured once after the markers' build
  (`_layoutFoes`) and cuts the snapshot both ways.
- **B3 (high) the snapshot carried the player's own dropped loot,**
  and `restorePiles` on the receiving side deleted that player's floor
  stash and minted the host's under their feet. The memory carries no
  drops; the clearing restore is the save's alone.
- **B4 (high) two clients' layout pools hold different species at the
  same index** (`chooseRandomEnemyType` bands on the live player level)
  and the record carried no type. The record carries `mobileType` and
  patches only its own kind; a save from before the field patches as
  before. The cure - a seeded layout - is slice 3's (below).
- **B5 (med) one farewell in three was dropped:** the forced publish
  on exit, death or hide fell inside the relay's five-second floor. A
  forced publish is marked `final` and the relay admits one per socket
  inside the floor.
- **B6 (med) the death farewell never fired underground:** the dungeon
  context borrows the death presenter, so `townTalk.overlay` never held
  the screen - no publish, no leave, the corpse kept hosting. The mode
  names its own death screen (`deathUp`).
- **B7 (med) `applyWorld` was written for a rebuilt pool** and the
  shared path ran it on a live one from a socket callback - a foe
  teleported mid-swing, a corpse-loot window's array replaced under it,
  a door re-solidified around the player. The memory lands once per
  context, on the freshly built pool; a second apply is slice 3's
  events.
- **B8 (low)** the dungeon's snapshot went into the cell's room during
  the room hold; **B9 (low)** a refused publish was silent and retried
  at frame rate; **B10 (low)** the boot's dungeon arm said "Game
  loaded." twice. A world room alone; a refusal said once with the
  clock stamped; `announce` off on the boot's arm.

**The peer's arm.**

- **C1 (high) the arm bag read world.js's own rig,** which is never
  stepped indoors or underground - so in a dungeon, WORLD1's whole
  subject, every peer stood with the street's sheath flag and never
  swung or cast. The mode machine names the live rig and the stance
  (`liveArm`).
- **C2 (med) a sheathed arm never cast:** the Morrowind arm's
  `castSpell` refused the None stance, so a caster with nothing drawn
  - a peer with wd 0, and the player's own arm alike - played nothing
  while the spellcast group was composed for it. The cast plays from
  None and returns there.
- **C3 (med) a refused strike was lost:** the count advanced whether or
  not the rig took the blow, and the equip that `setSheathed` started
  the same frame refuses it. The strike is kept `PENDING_FRAMES` and
  played once when it takes.
- **C4 (med) a loose and the next draw in one pose** stranded the peer
  at full draw. The count after a held draw is its loose: release plays
  it, nothing is queued (a queued strike shot again once the arm came
  back), and a redraw in the same pose follows the release.
- **C5/C6 (med/low) the arrow's `setWeapon` cut a strike in flight**
  (the last arrow's loose, every time) and was committed whether the
  rig took it. It waits for a quiet arm and lands only as the rig took
  it.
- **C7 (low) a body that slept replayed a stale swing.** Out of range
  or lingering, the counts follow; on waking nothing is replayed.

**The pins and the record.**

- **D1 (high)** the exit-hook pin's lazy regex matched the other
  teardown; **D3 (high)** the fake rig recorded each door apart, so
  sheath-before-strike was unpinned; **D4 (med)** the joiner-leads
  frame was unpinned - and pinning it found the election skipping the
  joiner; **D5 (med)** the finder's decoys sat after the match; **D9**
  the floor's value was unpinned; **D13** a brittle comment anchor. All
  repinned; **D10** the three fake Durable Objects are one
  (`test/fakeRoom.mjs`, which drops a socket the object closed as the
  runtime does).
- **D2 (high)** the arc's and the module's opening law, `Home.md`, the
  Ledger's row and wrangler's head still said presence alone was
  shared; **D6 (med)** Multiplayer.md's "no game state beyond the
  roster", "when the host leaves, the session ends", "sessions are
  ephemeral", "host migration - later"; **D7 (med)** "a peer's arrows
  never show"; **D8** `online.test.js` (8) is (9) since OD1; **D11**
  the wire's pose list; **D12** `stats.worlds` minted lazily. All
  struck or amended.

Pinned in `test/auditworld.test.js` (4): the relay over the one fake
(the door before the parse and its meter, the cap kept by type, the
map-id key and the alarm both ways, the reconnect's seat and the room's
floor, the farewell once and the host's alone, the coalesced write by
source); the session's farewell; the body over an ordered fake rig (the
doors in order, the pending strike taken once and dropped after
`PENDING_FRAMES`, the loose law and the redraw, the arrow's wait and
commit, the re-latch out of range and after a linger); the hosts and
the record by source. WORLD1's own pins restamped where the law moved
(the floor in storage, the joiner-leads frame, the exit hook sliced to
its function, the dungeon's two doors). Relay redeployed (b57433f6);
live, in a map-id room: a non-host's junk frame past the small cap
ignored with the socket kept, the host's reconnect keeping its seat
with no host frame to the peer, an ordinary publish inside the floor
dropped and the farewell taken.

For later slices, from the lenses: a SEEDED LAYOUT before slice 3 (the
shared half of the pool must not band on the live player level - a
fixed level or the location's seed for the random flats online, or the
layout roster published beside the memory); loot's memory should carry
"emptied", not contents (slice 4); a host's quickload inside a dungeon
rewinds the layout's foes for every joiner since WORLD2 (the next
stream carries the rewound records) and nothing else of theirs (the
doors, the piles, their own), and is itself rewound by the room's
memory on re-entry - persistence, but it will read as "F12 does nothing
to the dungeon"; publishes and applies happen under an open window or
a pause, which slice 3 gates explicitly.

## WORLD2 (2026-09-12): one simulation per room

**Mac: "Lets continue on with the next phase. We can merge in bulk
once completed."** Slice 2 of the persistent shared world: THE HOST'S
FOES ARE EVERYONE'S. Until now every player in a dungeon room ran their
own copy of its foes and the memory reconciled them fifteen seconds at
a time; now the room's host runs the layout's foes and streams them,
and everyone else's are puppets.

- **The wire** (`src/net/wire.js`, `server/src/index.js`):
  `{t:'foes', data}` - the host's changed foes, the other frame
  admitted past `MAX_FRAME_BYTES` by its prefix (`frameCap`) up to
  `FOES_FRAME_MAX` (64 KiB), `FOES_HZ_MAX` (12) a second on the
  stream's own bucket (`_meterFoes`, so the poses' stands), fanned to
  everyone hello'd but the host as `{t:'foes', id, data}`; a non-host's
  is ignored unparsed at the door. `{t:'hit', data}` - a blow on the
  host's foe, under the small cap, from anyone but the host, forwarded
  to the host's socket alone as `{t:'hit', id, data}`. A world room
  alone; the relay reads neither.
- **The session** (`src/net/online.js`): `sendFoes` (the host's alone,
  in a world room, the stream's gate kept at home, never past the cap),
  `sendHit` (anyone else's), `onFoes` (the room's host's frames alone -
  a stale host's are not the world), `onHit` (while hosting);
  `FOES_MS` (200) and `FOES_FULL_MS` (2000), the cadence.
- **The world host** (`src/scenes/world.js`): `foesStream` every
  `FOES_MS` while hosting a world room - the changed foes, every foe
  `FOES_FULL_MS` apart so a dropped delta heals; the seat decides who
  steps the layout's foes (`dungeonAuthority`: mine unless a world
  room's open socket says another; `setDungeonAuthority` on every host
  change; a new host streams every foe at once); `onFoes` and `onHit`
  routed into the dungeon; `onFoeHit` in the host bag for a puppet's
  blow.
- **The dungeon host** (`src/scenes/dungeonContext.js`): `_authority`.
  In the foe loop a PUPPET (`!_authority` and an index under
  `_layoutFoes`) steps by `puppetStep` - the feet eased toward the
  streamed feet over the stream's interval (`PUPPET_EASE_S`), a jump
  past `PUPPET_SNAP` snapped, the yaw set, the walk while the streamed
  feet move, the hurt one-shot after a health drop, the attack edge
  once per streamed count with its ranged bit, the mobile's damage
  latches cleared unconsumed - and skips everything the authority
  decides (senses, pursuit, the swing, the cast, the fall, the door,
  the pacification); the mobile arm draws both, and a puppet's barks
  and its swing's sound are its own. `foesFrame(full)` - every layout
  foe whose record `{i, f, y, h, d, a, m}` changed (feet to the
  centimetre, yaw to the milliradian; `a` the attack count minted at
  the strike edge, the ranged bit low; `m` moving). `applyFoes` - each
  record onto its puppet, a drop the hurt, death and un-death through
  `setFoeDead` (the ONE kill door - the save's restore takes it too),
  the attack once per count and never the count a joiner arrived with,
  a frame older than the last stale. `damageFoe`'s first line - on a
  puppet a player's blow goes out as `{i, dmg, kind}` (the number
  computed before the door by the striker's own weapon, arrow or
  spell; the sounds and the HUD already played) and a fall's or a foe's
  is dropped. `applyHit` - the host's own door with the peer's number
  and kind (aggro, the shield pool, death and its corpse).
  `setAuthority` - off, puppets from the next frame; on, THE HANDOVER:
  the puppet's pose stands, the motor resumes live
  (`EnemyAI.resumeLive`, `EnhancedEnemyAI` dropping its path: the
  grounding, the target and its senses, the path and the clocks, the
  accumulator forgotten; `isHostile` and `hasEncounteredPlayer` kept),
  the attack machine and the mobile's latches cleared so no phantom
  edge or blow fires, the stream from every foe.
- **The mode machine** (`src/scenes/worldModes.js`): the four
  forwards; a dungeon built while another hosts starts under the seat
  as it stands; the hit routed into the build.

What it did not do, until WORLD3 (below) took the first four: the
host's foes TARGETED THE HOST ALONE - a layout foe did not see a non-host, so a non-host beside the host is not
attacked and one alone with a foe strikes it unopposed (the host's
senses see peers in slice 3); a blow carries no direction (a peer's
blow never shoves) and no position (the aggro turns toward the host);
the arrow's shaft lands in the host's copy of the foe's items; soul
trap and Azura's Star on a peer's kill read the host's inventory; a
spell's other effects (a paralysis, a drain) still land on the puppet
locally, and the stream overwrites what it carries; doors, levers and
platforms are still each client's own (slice 3); two players' random
flats differ by level, so a puppet mirrors a species that may not be
its own until the layout is seeded (slice 3); the foes past the
layout's run - an encounter's, a summon's, a quest's - are still each
player's own.

Pinned in `test/world2.test.js` (4): the wire's two frames at both
ends (the foes frame past the small cap by its prefix alone, never
past its own whatever prefix it wore; the hit under the small cap; the
stream's gate); the Room over the one fake (the stream fanned to
everyone but the host, a non-host's ignored unparsed, the stream's own
bucket leaving the poses' untouched, a hit to the host alone and never
the host's own, a town relaying neither, the seat's move re-routing
both); the session (sendFoes the host's alone under its gate and cap
with t first, sendHit anyone else's, onFoes from the host alone, onHit
while hosting); the hosts by source (the hit door first in damageFoe,
the kinds, the puppet branch, the count, puppetStep, the frame out and
in, the hit in, the handover, the one kill door, the API, the mode
machine's forwards and the seat, the world host's stream and routes)
and the motor's resume executed on both motors. Relay redeployed
(06b8eddf); live, in a map-id room: the stream to the joiner and not
back, a large prefixed frame through, a non-host's ignored with the
socket kept, a hit to the host alone and never the host's own, the
seat's move re-routing both. Not seen with two real players from here
- Mac's two browsers are the gate: two in one dungeon, the host's foes
walking and dying on the other screen, a blow from the joiner landing
through the host, the host leaving and the joiner's foes coming alive.

## AUDIT WORLD2 (2026-09-12)

Mac: "Lets do an audit on slice 2." Four opus finders over WORLD2 - the
relay and the wire for the two new frames; the puppets; the world
host's lifecycle across every transition; the pins by mutation and the
record by drift - each refuting its own candidates against the code
and proving what stood with scratch tests and live probes. Every
survivor refuted again here; every one that stood fixed on the
branch:

**The seat and the stream (the three lenses agreed).**

- **A1/B1/C1 (high) a handover between two OTHER players froze a
  third.** `_foesSeqIn` reset only when MY authority changed, so a
  joiner who stayed a joiner kept the old host's high-water mark and
  judged every frame of the new host stale - for as long as the old
  host had streamed. The stream's host id rides in
  (`applyDungeonFoes(id, data)` → `applyFoes(data, from)`); a new id
  starts the count over and re-latches every puppet (no phantom
  strike from the old host's attack counts - B2/C7).
- **A2/B3/C2 (high) a dead socket froze a joiner's dungeon, for ever
  on a terminal close.** The seat was a latch set on a host CHANGE
  alone; a drop, a terminal close or `leave()` cleared nothing, so
  the puppets stood still and every blow went to a socket that could
  not take it. Now a dead socket and a leave clear the seat through
  the one door (`_setHost(null)` in `onclose` and `leave()`), and
  `dungeonAuthority()` is read EVERY FRAME - mine unless a world
  room's open socket names another, and that seat is alive.
- **C5 (med) no watchdog on a silent stream:** a host whose socket
  died without the relay's notice left the joiner frozen and
  invulnerable until the runtime noticed. The stream is the seat's
  heartbeat (`_foesInAt`; the welcome's word its first): a seat not
  heard from within `FOES_STALE_MS` (three full frames) is no seat,
  and the joiner steps its own foes until it speaks again.
- **C3 (low)** a dungeon rebuilt inside the welcome window started as
  puppets with no host to send to: `online.host` is a term of the
  seat now.
- **C8 (med) the room hold applied to dungeon keys,** delaying every
  handover half a second and letting one dungeon's stream land in
  another by index on a load or a teleport inside the hold. A world
  room's edge is never held, and every frame names its dungeon
  (`k`), refused elsewhere.

**The relay.**

- **A3 (med) the door metered by prefix, the arms dispatched by
  type:** a duplicate-key frame spent the wrong bucket. `doored`
  remembers the prefix and an arm whose type disagrees meters again.
- **A4 (med) the door was a free ingress sink:** a large frame in any
  room was metered, discarded unparsed and never refused. Outside a
  world room a large frame is refused as the small cap always was; a
  non-host's stream of prefixed frames in a world room is counted
  (`junk`) and struck out; **A7** the refusal names the prefix.
- **A5 (med) the foes fan had no room budget:** one host into a full
  room was 191 MiB/s out of one object. The fan spends a byte budget
  on the instance (`FOES_ROOM_BYTES_PER_S`: the frame times its
  listeners; over it, dropped without a strike).
- **A6 (med) the hit funnel was unbudgeted and ungated:** every
  joiner could aim `POSE_HZ_MAX` hits at the host's one socket, and a
  blow over the joiner's own pose bucket vanished unseen. The room
  budgets the funnel (`HIT_ROOM_HZ_MAX`) and `sendHit` gates at home
  (`HIT_HZ_MAX`, the pose bucket's headroom over `POSE_HZ`), refusing
  an over-rate blow to its caller.
- **A8/D12 (low)** the relay's and the wire's heads say the two frames
  and both buckets.

**The puppets and the doors.**

- **B4 (high) a joiner was blind to "enemies nearby":** the senses
  ran inside the authority's step alone, so `areEnemiesNearby` let a
  joiner sleep in a room full of the host's live foes and refused the
  exhaustion collapse among them. A puppet runs the motor's senses as
  observation off the streamed pose (`_senses`), never a decision.
- **B5 (med) the stream had no species guard where the memory has
  one:** two clients' random flats differ by level, so a rat's death
  landed on a joiner's daedroth by index and its blows went out under
  the wrong index. The record carries `t` (the species); a mismatch
  is left alone and its blows kept home.
- **B6 (med) the joiner's own blows never marked its HUD** (the divert
  returned before the target frame and the concealed reveal); **C4
  (med) a peer's blow hijacked the HOST's target frame** instead. The
  marks come first, the striker's own, and never for a peer's blow.
- **B7 (med) a foe's spell on a puppet went to the host as the
  player's blow** (the sink hard-defaulted `fromPlayer`), waking the
  host's whole room. The sink names its striker; a foe's missile and a
  foe's cast through the one cast engine are not the player's.
- **B8/C4 (med) on the host a peer's blow was silent and invisible;
  B9 (med) it woke the host's whole dungeon, reverted its charmed
  allies, and read the host's gems on the kill.** `applyHit` plays the
  hit's ring, the blood and the pain, and applies the blow as a PEER's
  (`peer: true`): the struck foe alone turns, no room-wide wake, no
  ally revert, no soul trap or Star of the host's.
- **B10 (low)** a streamed death dropped the corpse at the eased feet,
  behind a running foe: the corpse falls where the host's foe fell.
- **B12 (low)** `resumeLive` left `_restGrounded` set, so a foe that
  took the seat standing still never re-grounded until it moved.
- **B13 (low)** a connecting swing of no damage sent nothing, so it
  never woke the host's foe (DFU's own rule): a zero blow goes too.
- **B14 (low)** a dead/alive/dead flap while the corpse texture warmed
  minted two batches and freed one: one mint in flight per foe.
- **A9/C6 (low)** a refused stream frame lost its deltas until the next
  full frame: a refusal makes the next frame full. **B11 (low)** the
  stream's clock re-armed only when something was sent, so a quiet
  room rebuilt forty keys a frame: it re-arms regardless.

**The pins and the record.**

- **D2/D3/D4/D5/D11/D13/D15** pins that could not fail (the frame's
  layout bound and its delta stamp, the frame-in's index gate, a small
  unprefixed frame's meter and its sender, a small unprefixed world
  frame's meter, my own id as the host, comment-anchored regexes, a
  fake collider the producer never mints) repinned; **D14** the fake
  socket is one home (`test/fakeSocket.mjs`) for the two string-shaped
  copies (the three older object-shaped copies are a later hygiene
  row); **D16** two stale sibling cites.
- **D1/D6/D7/D8/D9/D10** the sentences WORLD2 falsified - Home.md's
  "the live moment is the next iteration", WORLD1's "not done", the
  Ledger's "still each player's own", Multiplayer.md's "slice 2 hands
  it over", the bullet's "still comes back", AUDIT WORLD's "rewinds
  nothing for anyone else" - struck or amended.

Pinned in `test/auditworld2.test.js` (3): the relay over the one fake
(the budgets one home and the byte gate, a duplicate-key frame
spending the type's bucket, a large frame refused outside a world room
and a small prefixed one ignored with the socket kept, a non-host's
stream struck out, the refusal named for its prefix, the fan's byte
budget and the hit funnel both dropping without a strike, a small
unprefixed world frame metered, the heads); the session (a dead socket
and a leave clearing the seat through the one door with the world
host told, the hits' gate at home, my own id as the host, the stale
constant); the record's struck sentences. `test/world2.test.js`'s
hosts-by-source pins rewritten to the audited law and strengthened.
Relay redeployed (ff7f7e70); live: the stream, the hit and the seat's
move as before, a large frame in a town refused with the socket
closed, a non-host's prefixed frame in a dungeon ignored with the
socket kept, a foes frame under a world prefix fanned.

For later slices, from the lenses: the hurt one-shot inferred from a
health drop (a shield-absorbed knockback plays nothing; carry `k`);
the yaw snapped where the feet ease; a hit with no pose (the aggro,
the knockback, the arrow's shaft and the kill's credit belong to the
striker - slice 3's hit carries `{x,y,z}` and `dir`); the seducer
transforming on each client alone; `meleeTimer` zero after a
handover; the joiner's first half-second underground simulated
locally before the welcome; the host's pause freezing the room for
everyone; a per-host stream epoch on the wire; the three
object-shaped fake sockets to fold into `test/fakeSocket.mjs`.

## WORLD3 (2026-09-12): the live world as events

**Mac: "Begin."** Slice 3 of the persistent shared world: THE LIVE
WORLD AS EVENTS. A dungeon's doors, levers and platforms are
everyone's; the host's foes see every player; a puppet resolves the
host's foe's blows against its own player; the roster is the room's;
the hit carries the striker.

- **The wire** (`src/net/wire.js`, `server/src/index.js`):
  `{t:'act', data}` - a change to the room's doors, levers and movers,
  from ANYONE hello'd in a world room (a door is whoever touched it,
  not the host's alone), under the small cap, on the actions' own
  bucket at the relay (`ACT_HZ_MAX`, `_meterActs` - a door never
  starves a pose), fanned to everyone hello'd but its author as
  `{t:'act', id, data}` under the room's budget (`ACT_ROOM_HZ_MAX`,
  `_roomActs` - over it dropped, nobody struck). A town relays none.
  The relay reads none of it.
- **The session** (`src/net/online.js`): `sendAct` (anyone's, in a
  world room, `ACT_HZ_MAX` at home, refused to the caller past it),
  `onAct` (another's, in a world room, never my own back).
- **The action graph** (`src/world/actionSystem.js`): THE CHANGE SEAM.
  The five entries a player or a foe reaches the graph by (`activate`,
  `attemptBash`, `toggleDoor`, `receive`, `attemptLockpicking`) ride
  `_changed`: the OUTERMOST call snapshots the save record
  (`collectSaveData` - what a save carries is what a room shares) and
  hands `onChanged` the records that differ after; a nested entry (the
  cascade's receive, a pick's toggle) diffs nothing of its own; a
  refused entry (mid-play) and the tick emit nothing. `applyRemote`
  lands another's records through `restoreSaveData` (the state, the
  tweens, the lock; the settle) and is HEARD as the scene hears its
  own - a door beginning to open (`onDoorState`), a mover or a door's
  Move beginning to play (`onActionSound`, its own index); never back
  through the seam. The per-player relays (a teleport, a text, a
  trap's hurt) stay each player's own, as DFU runs them on the one who
  triggered.
- **The dungeon host** (`src/scenes/dungeonContext.js`):
  `actions.onChanged` -> `opts.onActions({k, a})` keyed by this
  dungeon; `applyActions` this dungeon's alone. THE PEERS AS
  CANDIDATES: `peerCandidates` mints one stable identity per peer off
  the world host's `peers()` (feet in the scene, the drawn pose; the
  body's height), read once a frame, a peer gone dead to the machine
  (`health` 0) and dropped; the candidate list carries them while I
  step the foes. THE RECORD carries `g` (the target: `'.'` the host,
  an id a peer, `''` none), `c` and `s` (the cast count and its spell
  - minted where the caster decides) and `x` (the gender). A PUPPET
  reads whose blow it is (`_pupTarget`, `_pupMine`) and, when the
  streamed target is ME, keeps the mobile's damage frame for
  `resolveFoeMelee(f, _pf, {vsPlayer})` (my own reach, my own stats -
  the host decided the swing, I decide the hit), keeps its shoot
  marker for a real shaft at me, and casts the streamed spell at me
  (`castEnemySpell` at no cost - the host paid); at another the shaft
  is loosed at the peer's body and pays nothing (`aimFoe` a peer: no
  arm at impact), the cast is its one-shot alone. On the host a foe
  with a PEER target swings its voice alone (the peer resolves), looses
  its shaft and its spell missile TOWARD the peer (`targetAimPoint`'s
  peer arm; `castEnemySpell`'s feet the peer's) and pays nothing on
  the host on the way. THE ROSTER: `retypeFoe(i, type, gender)`
  rebuilds a layout foe in place through the one build chain
  (`buildFoeAt(..., {at})`: the old batch freed, the old record dead
  to everything holding it, the new at its index; the source record
  kept on every record as `src`) - the stream's mismatch (B5) and the
  memory's (B4, `patchFoe` landing on the rebuilt foe) both take it;
  the memory carries `gender`. THE HIT carries `p` (the striker's
  feet), `d` (the blow's direction - melee and arrow; a spell knocks
  nothing) and `ar` (an arrow's shaft): `applyHit` reads them, names
  the striker (`peerId`) so `handleAttackFromPlayer` turns the foe on
  the PEER's candidate at the striker's feet, and lands the shaft
  where BowDamage puts it.
- **The target machine** (`src/characters/enemyTargets.js`,
  `src/characters/enemyMotor.js`): a peer candidate
  (`{isPlayer, isPeer, id, feet, height, health}`) is a player to
  every gate of GetTargets (the team chain, the quest gate, the
  NoTarget mode - `isPlayerTarget` true; `isPeerTarget` names it),
  measured at its OWN feet and capsule where the local player is
  measured at `playerFeet`; a peer in sight is a player in sight (the
  area DFU draws around the one player is drawn around every player in
  the room); the machine hands the peer's own feet back; `targetHealth`
  reads a peer's own; the motor aims its senses at the peer's feet and
  reads its capsule.
- **The mode machine and the world host** (`src/scenes/worldModes.js`,
  `src/scenes/world.js`): `onActions`, `peers`, `selfId` into the
  build; `applyDungeonActions`; `online.onAct` routed; the peers at
  their scene feet off the session's drawn poses.

What it does not do: a missed arrow's shaft stays home (the divert runs
on a landed blow); the host's pause still freezes the room for everyone
(the stream's full frames are its heartbeat); a foe's spell's other
effects (a paralysis, a drain) land on the puppet locally and the stream
overwrites what it carries; the bash's sound and the pick's line are the
author's alone; loot is still slice 4; the shared clock and weather and
the quest clocks are slice 5; no player-versus-player.

Pinned in `test/world3.test.js` (5): the wire and the Room over the one
fake (the act from a hello'd socket under the small cap, fanned to
everyone hello'd but its author, on its own bucket, under the room's
budget, a town relaying none); the session (sendAct anyone's in a world
room under its gate and cap, onAct never mine, never in a town); the
change seam and applyRemote executed on bare graphs (one set per
outermost entry with the cascade inside it, nothing on a tick or a
refused entry, the set landed and heard on another graph, never
re-emitted, a lock riding); the target machine with a peer executed
(the peer a player to every gate, at its own feet and capsule, a peer
in sight arming the machine, its own feet handed back, a gone peer
dropped, the aim point, the motor's senses); the hosts by source. Not
seen with two real players from here - Mac's browsers are the gate: a
door opened by the joiner swinging on the host's screen and a lever's
platform rising on both; the host's foe turning on the joiner and its
blows landing on the joiner's health; the joiner's arrow shoving the
foe the way it flew.

Relay redeployed (a3b12d0d); live, in a map-id room: a joiner's act
reaching the host and the other joiner and never its author, the host's
reaching both joiners, a town relaying none with the author's socket
kept.

## What it does not do (yet)

- **The Morrowind body** ships (MWBODY1, above); a client without the
  Morrowind data, or on the classic skin, sees the paperdoll instead
  (Mac: acceptable), and so does everyone past `BODIES_MAX` bodies.
- **The look is sent once**, in the hello: gear changed mid-session is
  not seen by the peers until the next room (a `look` frame is the
  next iteration's).
- **The live chat** ships (CHAT1, above): one World tab.
- **The room's memory** (WORLD1, above) is a dungeon's alone, and
  since WORLD2 the layout's foes are ONE simulation per room - the
  host's, streamed; a foe killed between two publishes by a host that
  vanished ALONE in the room comes back for the next visitor (a joiner
  who was there mirrored the death and publishes it). Since WORLD3 the
  host's foes hunt every player in the room and its doors, levers and
  platforms move for everyone (an act from whoever touched them).
  Towns, cells and buildings keep nothing yet; no shared clock or
  weather (slice 5); the quest clocks still run online; no
  player-versus-player. A memory is forgotten
  `WORLD_TTL_MS` (thirty days) after its room last emptied (AUDIT
  WORLD A3 - a bound on parked storage, Mac's to change), and two
  players' random flats differ by level, so a foe whose species the
  room's memory or the host's stream disagrees with is REBUILT as the
  room's at its index (WORLD3 - the roster is the room's).
- A peer across a world-cell border is not seen until both stand in
  the same cell (D9: two players a pixel apart astride a cell edge are
  in two rooms; the cell is sixteen pixels, the range three, so the
  seam is a strip - the 3x3 neighbourhood is the next iteration's).
- The relay is one Durable Object per room and has not been measured
  past a handful of players; interest management filters what is sent,
  not what is iterated.
- No identity beyond the display name: the id is a random token kept
  in the tab.

## Pinned

`test/online_relay.test.js` (7): the wire's law with mutants (the range
widened, the gate that never refills or never caps, a pose before
hello, the junk before the gear) and the Room over fake sockets and a
fake state (the key on the attachment surviving a wake, the look in
storage, the roster with looks and its cap, the range fan-out, the
leave, the replaced socket's silent close, the secret that guards an
id, the hello gate, the socket cap, the over-rate strikes, the failed
send, the worker's routes).
`test/online.test.js` (9): the one law at both ends and the world's
bound, the room key by map id and its nulls, the pose's change and
easing, the id, the session on its own clock over a fake socket, the
socket's lifecycle and the terminal closes, the look and the stub
clamped, the others drawn through a fake renderer (the crop, the cache,
the retry, the eviction, the name under the viewport rect), the
compositor's door pure by source, OD1's doll standing up bottom-up. Not seen with two real players from
here - Mac's two browsers are the gate.
`test/chat1.test.js` (7), re-pinned by AUDIT CHAT: the wire's chat law
at both ends (the sanitizer's classes - every format character, the
selectors, a lone surrogate, a stack of marks - and its idempotence
fuzzed, the whitelist, the frame after hello, the gate's burst and
refill), the Room as a channel over fake sockets (no roster, join,
leave or look; a pose and a ping gated then declined; every line to
everyone with the sender on the relay's clock; the secret; the hello
gate deeper and never off; the deeper cap; the Worker's 404; the drain
sweep) and a line in a place reaching as far as a pose with the gate's
own bucket proved where the pose gate runs, the room's budget, the
channel session over a fake socket (no pose, a pose refused, the ping
heartbeat, sendChat gated, onChat with mine, rejoin after the goodbye
and after a terminal close, the labelled status), the log (the tab and
the whitelist, the cap, unread by open-and-active, the fade, the tag),
the panel over a fake document and a two-phase window (the cursor key
through the registry, the field's keys stopped before the host's
bubble listener, F5 swallowed, the IME's Enter, a held Enter, Tab, a
refused line kept, send-and-close, Escape, a press stopped and a
release passed, the pointer hooks, hidden under a window or an
overlay, text never markup and tagged, the list grown, the touch
button and form), the host by source (the dial on the stack). Not seen
with two real players from here either.
`test/mac6.test.js` (2): the dungeon save's field through the envelope
both ways, the finder by dungeon id over fake locations (any iterable,
the first match), the dungeon host's split load arm, the mode
machine's forward and the boot's third arm by source.
`test/mac7.test.js` (4): the pose's arm - drawn or held, swing count
and kind, arrow, spell stance, cast count and range - at both ends
(clamped, the WeaponStates order pinned against fpsWeapon's index and
the cast ranges against spellcast's TargetTypes, a pose from before
them sheathed, unswung, unarrowed and uncast), the session's change
and easing, the body over a fake rig with every door recorded, the
rig's two counters and the host's pose by source.
`test/world1.test.js` (4): the wire's world frame at both ends and
the world rooms, the Room's host election and memory over fake
sockets across a wake (chunked, republished smaller, served verbatim,
the ignored frames, the sweeps that keep it), the session's host and
sendWorld, the three hosts by source.
`test/auditworld.test.js` (4): AUDIT WORLD's fixes - the relay's door
before the parse, the cap by type, the map-id key and the alarm, the
reconnect's seat and the room's floor, the farewell; the session's
farewell; the body's doors in order, the pending strike, the loose
law, the arrow's wait and commit, the re-latch; the hosts and the
record by source.
`test/world2.test.js` (4): the wire's foes frame and hit at both ends,
the Room's stream and hit routing over the one fake, the session's
sendFoes/sendHit/onFoes/onHit, the hosts by source (the puppet branch,
the frame out and in, the hit door, the handover) and the motor's
resume executed - strengthened by AUDIT WORLD2.
`test/auditworld2.test.js` (3): AUDIT WORLD2's fixes - the relay's
budgets, the type's bucket, the refusals, the strikes; the session's
seat cleared on a dead socket and a leave, the hits' gate at home; the
record.
`test/world3.test.js` (5): the wire's act frame and the Room's fan
over the one fake, the session's sendAct/onAct, the action graph's
change seam and remote apply executed, the target machine with a peer
executed, the hosts by source.

## OD1 - THE PEER DOLL GOES UP BOTTOM-UP (2026-09-12, Mac's report)

Mac: "Paperdoll is upside down when viewing other players in
multiplayer (morrowind is great)."

**The mechanism.** `composePaperDollPixels` is the UI's compositor and
its buffer is a UI image: row 0 at the top, the order `bitmapToColor32`
writes and the HUD blit samples. The billboard shader samples GL's
bottom-up texel order - `render/renderer.js`'s header ("Textures
arrive from TextureFile.getColor32 already bottom-up ... upload as-is
with flipY off") and its vUV note ("the quad top samples v = 1"). Every
other billboard in the game arrives bottom-up from the texture
reader; the doll's crop was the only top-down buffer ever handed to
`createBillboardBatch`, so every peer stood on their head. The
Morrowind bodies (MWBODY1) are meshes and were never affected.

**The fix.** `cropRgba(rgba, w, r, { bottomUp: true })` writes the rows
in reverse; `_composeDoll` asks for it. The classic composite and the
inventory's own upload are untouched. Ledger row OD1. Pinned:
`test/online.test.js` OD1 (the reversed crop, and the doll's upload
with a marked top-left pixel on its last row).
