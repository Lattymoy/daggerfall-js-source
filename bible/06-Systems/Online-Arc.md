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
  keyed by the dungeon's `locationKey` (and, since WORLD4, no pile's
  contents - only the containers the room has opened);
  `restoreSharedWorld(shared)`
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
  before. ~~The cure - a seeded layout - is slice 3's (below).~~ WORLD3
  cured it the other way round: the roster is the ROOM's, and a foe
  whose species the stream or the memory disagrees with is REBUILT at
  its index (`retypeFoe`). A seeded layout would still be cheaper and
  is unclaimed.
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

For later slices, from the lenses: ~~a SEEDED LAYOUT before slice 3
(the shared half of the pool must not band on the live player level - a
fixed level or the location's seed for the random flats online, or the
layout roster published beside the memory)~~ - WORLD3 took the
disagreement instead of preventing it (`retypeFoe` rebuilds the
mismatched foe at its index); a seeded layout is still the cheaper cure
and is unclaimed; ~~loot's memory should carry
"emptied", not contents (slice 4)~~ - WORLD4 did exactly that: a
container nobody has opened carries nothing at all, and one the room
has opened carries what is left in it; a host's quickload inside a dungeon
rewinds the layout's foes for every joiner since WORLD2 (the next
stream carries the rewound records) and ~~nothing else of theirs (the
doors, the piles, their own)~~ - AUDIT WORLD4 D7: since WORLD4 it
rewinds the room's OPENED containers too, because the reloaded lists
are what the next publish and the next close carry; the doors are
still their own - and is itself rewound by the room's
memory on re-entry - persistence, but it will read as "F12 does nothing
to the dungeon"; publishes and applies happen under an open window or
a pause, ~~which slice 3 gates explicitly~~ - WORLD3 gated nothing of
the sort and says so in its own "what it does not do"; the gate is
unclaimed.

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

What it did not do. WORLD3 (below) took the foes' sight of every
player, the blow's direction and position, the arrow's shaft, the
shared doors and the room's roster; AUDIT WORLD2 B9 had already taken
the peer's kill. So, as WORLD2 shipped: the host's foes TARGETED THE
HOST ALONE - a layout foe did not see a non-host, so a non-host beside
the host was not attacked and one alone with a foe struck it unopposed
(WORLD3: the peers ride the target machine); a blow carried no
direction and no position, so it never shoved and the aggro turned
toward the host (WORLD3: `p` and `d` ride the hit); the arrow's shaft
landed in the host's copy of the foe's items (WORLD3: `ar`); doors,
levers and platforms were each client's own (WORLD3: the act frame);
two players' random flats differ by level, so a puppet mirrored a
species that might not be its own (WORLD3: the roster is the room's -
`retypeFoe`). Still open after WORLD3: a spell's other effects (a
paralysis, a drain) land on the puppet locally, and the stream
overwrites what it carries; the foes past the layout's run - an
encounter's, a summon's, a quest's - are each player's own, and since
AUDIT WORLD3 D1 the peers do not ride their target machine at all.

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
author's alone; the shared clock and weather and
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

## AUDIT WORLD3 (2026-09-13)

**Mac: "Begin."** Six opus lenses over WORLD3 - the relay and the wire;
the action graph's change seam; the peers as targets; the puppet's
blows at its own player; the roster rebuild; the hit, the pins and the
record - each refuting its own candidates and proving the survivors by
execution, then every survivor refuted again by two or three
adversaries. Sixteen findings confirmed and six upheld out of a split
vote; four refuted and dropped (among them a claim of mine that the
change seam costs a millisecond a frame - the entry rate is nothing
like once a frame, because the motor reassigns `doorKey` each senses
pass).

**THE ONE ROOT.** WORLD3 made a peer `isPlayer: true` so it would pass
every gate of `GetTargets` - and four guards elsewhere spelled "not
another foe, therefore MINE" the same way. Each of them then read the
LOCAL player's state for a foe hunting somebody else. `isLocalPlayerTarget`
names the distinction once (`enemyTargets.js`), and the four sites take
it:

- **C3 (high) a foe that saw only a PEER raised the local player's
  enemy alert, refused their rest, and killed them.** `inSight` and
  `detected` mean "this foe senses its TARGET"; `areEnemiesNearby`
  reads the pair with no target test at all, and `_dist` beside it is
  the distance to that target. So the host, alone in a cleared corridor
  half a map from the joiner's fight, could not rest - and when its
  fatigue ran out `onExhausted` read enemies nearby and set health to
  0. The motor latches whose player it answers for
  (`targetIsLocalPlayer`) and how far MY player is (`_distLocal`, the
  spawn band's own measure); the alert and the rest gate read both, and
  a bare ai stub - the unarmed player-only shape - reads as before.
- **C1 (med)** the ray to a peer was aimed at the LOCAL player's live
  capsule planted on the peer's feet - the third reading of "the
  target's own capsule" in that file, and the only one WORLD3 left
  unpatched. Folded onto the one home.
- **C2 (med)** the illusion gate read the LOCAL player's invisibility
  for a peer target, so the host going invisible blinded every foe
  hunting the joiner. A peer has no concealment of its own and now
  takes the empty bag, which is what "I do not know" must mean.
- **C4 (med)** a foe's first sight of a peer spent the HOST's
  language-pacification edge - the host's skill, the host's tally, the
  host's HUD line, and a foe stood down on a roll about somebody else.
- **C5 (low)** and its stealth roll rolled the HOST's Stealth against a
  distance measured to the joiner, and advanced the host's skill for
  it.

**The relay and the wire.**

- **A1 (high) the act fan had no BYTE budget** - only a frame count -
  and an act frame is capped at `MAX_FRAME_BYTES` and read by nobody.
  Six hello'd sockets sending the largest frame at their own rate is
  119.6 MiB/s out of one Durable Object, measured over the one fake:
  29.9x the ceiling AUDIT WORLD2 A5 set for the foes fan after
  measuring exactly this class. The act fan now spends
  `ACT_ROOM_BYTES_PER_S` the same way - the frame times its listeners,
  over it dropped and nobody struck.
- **A2 (high) an act's records were validated by NEITHER end.** A `t`
  of `"x"` made the receiver's tween arithmetic NaN, which never
  satisfies `t >= 1`, so the object hung mid-swing for the life of the
  session: one 146-byte frame from a stranger bricked a door for every
  other player in the room, permanently. `validActionRecord` projects
  and clamps a record to the shape the graph itself mints - the four
  states, a tween in [0,1], a lock inside DFU's own range - inside
  `applyRemote`, where the save's own restore reads it too.
- **A3 (med) a dropped act never healed.** The seam is a DELTA and both
  refusals are silent (the relay drops over its room budget without a
  word; `sendAct` refuses over the rate at home), so a change that fell
  in the gap was a permanent disagreement about where a door stands -
  where WORLD2 built the opposite for the same shape of loss (the foes
  stream re-sends every foe every `FOES_FULL_MS`). The host holds the
  refused KEYS and the next frame carries their CURRENT records,
  re-read from the graph; a quiet room flushes them from the frame.

**The action graph.**

- **B1 (high) a peer's FAILED LOCKPICK wrote its retry latch onto every
  other client's door.** `failedSkillLevel` is
  `DaggerfallActionDoor`'s PER-PLAYER latch and the seam shipped it: a
  same-skill peer's pick then did nothing at all - no line, no sound,
  no tally, no roll - for ever, and two players of different skill
  taking turns defeated the latch entirely and tallied Lockpicking
  without bound. `sharedRecord` is the half a room may know, so a
  failed pick now emits no act at all and no sender's latch is
  believed.
- **B3 (low)** `applyRemote` rang the RDB sound only when a TWEEN
  began, but `_play` rings it on every Play - so every zero-duration
  mover (an acting flat's Translation) slid in silence on every screen
  but the author's. A Play always moves the record's own state; that is
  the test now.

**The puppets and the seat.**

- **D1 (high) the peers rode the candidate list of foes PAST the
  layout's run** - a quest spawn, a summon, an encounter - which are
  never streamed. Such a foe could pick a peer and then nobody resolved
  its blows: the host took nothing, the peer never learned it existed,
  and the quest fight was dead until the peer walked away. The peers
  ride a STREAMED foe's list alone.
- **D2 (high) a puppet whose LOCAL record was not hostile read blind,
  so every blow the host's foe landed became a miss.** `_senses`
  refuses sight for a non-hostile record; hostility is not on the wire
  and a joiner's own blows never raise it (the divert returns before
  `handleAttackFromPlayer`). A joiner was invulnerable to a
  passive-marker foe - a castle guard - for the whole fight, while the
  host watched a dozen of them beat on it. A streamed target IS the
  host's word that the foe is fighting; the puppet takes it.
- **D3 (med)** losing the seat left every puppet's motor target
  dangling - very often a PEER candidate - and `updateMissiles` mints a
  streamed cast's `aimFoe` from it, which no capsule test can strike:
  an ex-host took no spell damage from the room's foes at all. The off
  direction forgets the target as the on direction always did.

**The roster and the hit.**

- **E1 (med) a roster rebuilt online broke the player's OWN save.** The
  save records the rebuilt species; a fresh build re-derives the layout
  at the local level, so the record disagrees and `applyWorld`'s
  mismatch arm silently discarded that slot's death, health, items,
  effects and team. The save's restore takes the rebuild too - the
  record IS the truth for its slot.
- **E2 (med)** the record that TRIGGERED a rebuild was dropped, so the
  replacement stood alive at full health where the room had a corpse,
  and the host's next full frame was up to two seconds away - or, after
  a handover, never. `applyFoeRecord` is one body and the rebuild's
  continuation calls it.
- **E3 (low)** `retypeFoe` admitted a species the build chain can never
  stand (`ENEMY_BASICS[39]`, `maleTexture` 0), so the rebuild failed
  silently and retried on every frame of the stream, pushing a dead
  entry into the build-time-only `flatGroups` map each time. One
  predicate (`canStandFoe`) for the rebuild and the build.
- **E4 (low)** a rebuild in flight across a dungeon exit minted a live
  billboard batch into a torn-down context, after `destroy()` had
  already walked the pool. `stand` reads the teardown latch.
- **F1 (med)** the striker's feet rode only the kinds that carry a
  knock ray, and the spell sink hands none - so a joiner's spell turned
  the host's foe toward the HOST while naming the joiner as its
  attacker. They ride every kind.
- **F2 (high) the hit's direction was applied as a knockback vector
  unnormalised and unbounded.** The motor clamps the SPEED and then
  multiplies the raw direction by it, and the collider substeps
  proportionally to the magnitude - so one 85-byte frame carrying
  `d:[1e9,0,0]` asked the host's collider for 2.4e8 substeps and froze
  the tab, taking every other player's simulation with it. A direction
  is a unit vector or it is nothing; a position outside the dungeon's
  reach is nothing.

**The pins and the record.** F5: WORLD3's executed peer pin could not
fail - the fixture's peer height was the default, so both arms of the
capsule ternary evaluated to the same number and a mutant that ignored
the peer's capsule passed; the fixture now differs from the local
player's. F3/F4: the head of WORLD2's gap list credited WORLD3 with an
item AUDIT WORLD2 B9 had already closed while leaving the two the slice
DID take standing in the present tense, and two AUDIT WORLD promises
addressed to "slice 3" by name (the seeded layout, the window/pause
gate) were left standing after slice 3 shipped without either - struck
in place, naming what actually happened.

Relay redeployed (840669fa); live, in a map-id room: six senders into
one room fanned 85 of the 150 deliveries their frames asked for - the
byte budget biting on the fan, every socket kept and no error frame -
and an honest door still travelling afterwards.

Pinned in `test/auditworld3.test.js` (4): the relay's act byte budget
over the one fake (the fan costing the frame times its listeners, over
it dropped and nobody struck, the frame budget still beside it); the
action graph executed on bare graphs (the projection refusing every
shape the graph never mints and the brick with it, the latch travelling
in neither direction and a failed pick emitting nothing while the
second player's pick still runs, an instant mover heard by the peers);
the motor and the targets executed (the peer's own capsule, the
target's concealment, the two latches and the rest gate over them, the
encounter edge and the stealth tally kept for MY player, and each of
them still firing for a foe hunting me); and the hosts and the record
by source. `test/world3.test.js` restamped where the law moved, its
peer pin made to fail.

## WORLD4 (2026-09-13): the room's loot

**Mac: "Lets start on slice 4."** Slice 4 of the persistent shared
world: A CONTAINER THE ROOM HAS OPENED IS THE ROOM'S. Until now a
dungeon's loot was every client's own roll, and the room's memory
carried the host's whole pile list - so a joiner's own loot was
replaced wholesale by the host's, fifteen seconds stale, and a chest
one player emptied could refill for another.

THE LAW, in one breath: a container nobody has opened stays each
client's own and the room knows nothing of it; the moment anyone OPENS
one it becomes the room's, and stays the room's.

- **The wire** (`src/net/wire.js`): nothing new. The loot rides
  WORLD3's `{t:'act', data}` frame as a second half beside the doors -
  `{k, a?, l?}`, either or both - and the relay reads none of that
  frame's `data`, so slice 4 needed NO relay change, no frame of its
  own and no budget of its own: AUDIT WORLD3's act budgets (the rate,
  the room's frames, the room's bytes) and its refused-act heal cover
  it as they stand. Proved live against the relay already deployed.
- **The dungeon host** (`src/scenes/dungeonContext.js`): `lootHolder`
  names what a key holds in takeLoot's own vocabulary - `loot:<i>` a
  layout pile (the block markers' order, the same on every client) and
  `corpse:<i>` a layout foe's body, bounded by `_layoutFoes` exactly as
  the stream and the hit are: a quest spawn's or a summon's body is the
  player's own, and so is a DROPPED pile (AUDIT WORLD B3 - a drop is
  the dropper's). `publishLoot` says the container is the room's TWICE:
  on the OPEN, which CLAIMS it (a second reader opening the same chest
  a moment later adopts the first's list rather than their own roll),
  and on the CLOSE, which says what is left - the same moment DFU's own
  law frees an emptied container's flat, and the moment the taking is
  finished rather than half done. `applyLoot` lands another's word
  through the projection and IN PLACE (`held.length = 0`, then push),
  ~~so a window already open on that container updates under the
  reader's hands~~ - AUDIT WORLD4 C1: it does not, and could not: the
  pack binds each loot row to the item OBJECT and never repaints, so
  that landing orphaned every row and the next click took the item AND
  left it in the chest. **A container you have open is yours until you
  close it**, and your close is then the room's newest word.
  `settleLootFlat` frees the flat of a pile the ROOM emptied while this
  player stood beside it (and re-mints one the room refilled - AUDIT
  WORLD4 C3/D2 gave the settle its second direction).
- **The projection** (`src/systems/loot.js`): AUDIT WORLD3 A2's law
  applied to the other thing the frame now carries. An item record is
  an OPEN shape (the inventory arc grows it; a magic item carries its
  enchantments), so `validLootItem`/`validLootList` CLAMP rather than
  whitelist - a plain object of bounded breadth (`LOOT_ITEM_KEYS_MAX`)
  and depth (`LOOT_DEPTH_MAX`, an enchantment list is 2), bounded
  strings, finite numbers, a `templateIndex` a template could carry,
  at most `LOOT_LIST_MAX` items, and no prototype key. What survives is
  a COPY: no reference off the wire reaches the pack. An EMPTY list is
  valid and is the commonest word a room says about a container.
- **The memory** (`sharedWorld`): the piles' blanket contents are gone
  and the opened containers stand in their place, so an untouched pile
  is every client's own roll as it was before anyone arrived, and a
  joiner is told about exactly the chests somebody has been into.
  (AUDIT WORLD4 D4: true of the piles and false of the CORPSES until
  the audit - every layout body's item list rode the foes half of the
  same envelope, opened or not, so the law held for half its own
  container vocabulary. The foes half now carries no `items` at all.)
  `restoreSharedWorld` lands them through the same door the live frame
  takes. The SAVE keeps its whole pile list, untouched:
  `collectWorld`/`applyWorld` are the save's and did not move.

What it does not do: the take is seen by the room when the window
CLOSES, not per item, so two players who open the same untouched chest
in the same breath both take it and both keep it (the claim on the open
narrows that window to the time between two opens, and the room's list
is then whoever closed last); a player's own dropped pile is still
theirs alone, so handing an item to a friend by dropping it does not
work yet; gold, the wagon and the quest reward pile are each player's
own; a container in a town, a cell or a building is nobody's yet
(a dungeon is still the only room with a world); and a corpse past the
layout's run - a quest spawn's, a summon's - is the player's own body
to loot, as its foe is their own to fight.

Pinned in `test/world4.test.js` (3): the projection executed (the empty
list valid, the copy a copy, the bounds on breadth, depth, strings,
count and templateIndex, a magic item's enchantments surviving whole, a
prototype key refused); the wire and the Room over the one fake (an
`l`-only frame parsed, fanned to everyone hello'd but its author,
spending the ACT bucket and not the poses', a town relaying none, and
the session sending and taking it under the same gate and cap); the
dungeon host and the memory by source. Live, against the relay already
deployed (840669fa) and with no deploy of its own: a claim fanned, an
emptied fanned, a door and a chest in one frame, the author hearing
neither and no error. Not seen with two real players from here - Mac's
browsers are the gate: one player empties a chest and the other finds
it empty, and finds the flat gone.

## AUDIT WORLD4 (2026-09-13)

**Mac: "Lets do an audit on thid."** Four opus lenses over WORLD4 - the
wire and the budgets; the projection and everything downstream that
READS an item; the dungeon host's claim, land and settle; the memory,
the pins and the record - each refuting its own candidates and proving
the survivors by execution, then refuted again adversarially. Fifteen
findings after de-duplication, four of them high. One cost is recorded
rather than paid (C5, below).

**THE ONE ROOT.** WORLD4 wrote two caps - `LOOT_LIST_MAX` (64 items in
a container's word) and the wire's `MAX_FRAME_BYTES` - and enforced
both at the FAR end only. The mint never asked whether what it was
about to say could be said, so a container a player had stored into
past the cap produced, in order: a frame every receiver dropped in
silence (A2/B2), then a frame the SENDER refused for its size, whose
key the AUDIT WORLD3 A3 heal put in the pending set and re-read and
re-refused every frame for ever, folding every later door into the same
oversized union and sending none of them (A1 - a live-lock, not a
heal), and finally, on the next reader's claim, the WIPE of the stash
that started it (D1). `actFrameFits` is now the wire's own law with ONE
HOME, so the host can tell a refusal the next token heals from one
nothing will; `lootRecords` is the one home of what may be said at all,
and skips - once, out loud - a container it cannot say, which stays
its owner's own.

- **B1 (high) an `enchantments` STRING froze the tab for good.** The
  projection clamps rather than whitelists, and a bounded string is a
  legal value, so `enchantments: 'abc'` survived it entire. Three
  readers then walked the field as an array (`itemEnchantments`,
  `hasArtifactSubtype`, `hasArtifactEffect`); the first is the
  enchantment magic round, called from the frame body with no `try`
  above it, so the throw escaped the frame and the tab stopped
  rendering - permanently, because the item was now in the pack.
  `LOOT_ARRAY_FIELDS` names the fields the readers walk, the projection
  refuses an item whose field is not an array (before AND after the
  clamp), and the three readers hold `Array.isArray` of their own.
- **C1 (high) the room's word under an open window made two of one
  item.** Above, and struck in WORLD4's own paragraph.
- **C2/D5 (high) a claim un-emptied a chest for everyone.** The claim
  on the OPEN asserted this client's list unconditionally. A joiner
  inside the memory's fifteen-second publish window - or anyone whose
  frame the relay had dropped - opened an emptied chest, found their
  own untouched roll in it, and told the room. A claim now speaks only
  where the room has not already spoken (`_lootSeen`), and the first
  word about a container makes the room's MEMORY due that same frame
  (`onLootClaimed` through the mode to the host's publish clock)
  instead of up to fifteen seconds later.
- **C3/D2 an emptied pile the room refilled went invisible for ever.**
  The settle had only the freeing half; the save's own restore arm has
  always had both. Every read that lets a player see, hover or open a
  pile gates on its batch, so a refilled pile kept its items and
  nothing else: un-seeable, un-openable, and still real for everyone
  else. One home for both directions, and the save's arm calls it.
- **C4 a peer could freeze the room's memory.** The container key
  arrived off the wire beside the list, and only the list was
  projected: `loot:0x0a`, `loot:1e1`, `loot: 10 ` and `loot:0000000010`
  all named pile 10 to `Number()`, so one peer could mint an unbounded
  family of aliases for one container, each landing in `_lootSeen` and
  each emitting a full record into the memory until the memory itself
  was too large to publish. One canonical spelling (`lootKeyOf`), and
  nothing else is a key.
- **C6 a claim for a container nobody opened.** `openInventory`
  REFUSES a transformed lycanthrope (GetSuppressInventory) and returns
  null. The claim went first, so a werewolf brushing a chest told the
  room its contents while seeing nothing. The claim follows the mount.
- **B3/D4 the foes' item lists.** `corpse:<i>` reads a foe's `items`
  array, so the foes half of the memory was carrying the same
  containers as the loot half - every layout body, opened or not
  (D4: the law was false for half its own vocabulary), and landing them
  through `patchFoe` with no projection at all (B3), where one
  malformed record threw after `_sharedApplied` was set and left the
  restore half applied and never retried. The envelope's foes carry no
  `items`; a list that does arrive off the WIRE goes through the
  projection or nowhere; a save off disk is this client's own word and
  keeps its list whole.
- **D3 what this client will not say, it will not hear.** The memory
  stopped SENDING `piles` and went on APPLYING them, so a snapshot
  written before WORLD4 (the relay keeps one for `WORLD_TTL_MS`) still
  blanket-replaced a joiner's own rolls - the very thing the slice
  removed - and any host that sent the field could do it deliberately.
- **C5, recorded and not fixed:** a shooter's arrows recovered from a
  corpse the room has opened are destroyed by the room's next word
  about it, because the word is the whole list. Per-item takes are
  slice 4's known cost (see "what it does not do"), and this is that
  cost in its sharpest form.
- **D6/D7 the pins and the record.** Three of `test/world4.test.js`'s
  source pins had `[\s\S]*?` gaps wide enough for a mutation to walk
  through, and the mint itself was unpinned; the quickload sentence
  above was left true of the doors and false of the piles.

Pinned in `test/auditworld4.test.js` (6): the wire executed (the fit at
its exact boundary, the session refusing on the same law it publishes
with a rate token in hand, and the host's two arms by source - the
union shed, then the act dropped, never re-pended); the projection and
its three readers executed on a string, a number, an object and an
honest array; the mint and the canon (the cap obeyed at the mint, said
once, and every alias the old key read as one container refused); the
claim, the deferral and the memory's due date; the memory's two halves;
and the record itself, which must carry the sentences this audit
struck. `test/world4.test.js` restamped where the law moved, its three
slack pins closed and the mint pinned. No relay change and no deploy:
every fix is client-side. Live against the relay already deployed
(840669fa): a claim on the open, an emptied on the close, a door and a
chest in one frame, the author hearing neither and no error - and a
frame one byte over `MAX_FRAME_BYTES` fanned to NOBODY, with no error
frame back and both sockets kept, which is the live-lock's fuel: the
sender learns nothing from the wire, so the law has to live at home.

## AUDIT WORLD34 (2026-09-13)

**Mac: "So I think both slice 3/4 need a comprehensive audit because
enemies, doors, and everything else doesnt persist between connected
players. They still see their own enemies and stuff."** Five opus
lenses over WORLD3 and WORLD4 together, each told the live report and
made to find it: the boot path and the room's lifecycle; the foes
stream end to end; the acts, the loot and the memory; the relay as it
runs on Cloudflare and the story of its deploy; and the shipped scope
against what a player standing somewhere actually sees. Neither the
deployed relay nor the game data was reachable from the audit's
container, so every claim below is either EXECUTED over the real
session and the real Room (the fakes in `test/fakeRoom.mjs` and
`test/fakeSocket.mjs`) or cited to a line; the record says which.
Thirteen findings fixed, five recorded and not paid.

**THE ONE ROOT (A1).** The wire's world-room law - `isWorldRoom`,
`/^dungeon:m\d{1,8}$/`, ONE HOME at both ends - admitted eight digits
of map id, and a real `MapTableData.MapId` is a 32-bit integer:
Privateer's Hold is **187853213**, Daggerfall 1291010263, Wayrest
630439035 (the port's own table, `world/dungeonTextures.js`
MAIN_STORY_DUNGEON_IDS, DFU's `IsMainStoryDungeon` verbatim). So every
real dungeon minted a key the law refused, at the client and at the
relay alike; the room was joined all the same (a key is a key), the
poses and the chat relayed (presence worked, which is why Mac saw the
other player), and `sendFoes`, `sendAct`, `worldPublish`, the welcome's
memory and `dungeonAuthority` all read the same predicate and all went
silent - both players kept their own authority and stepped their own
foes, with no status line, no console line and no error frame, because
a silent drop was the law's design for a town. Four slices shipped
green over it because every fixture used a three-digit id, and
`test/auditworld.test.js` PINNED `dungeon:m123456789` as no world room
(AUDIT WORLD A3's bound, written without a real number in hand). The
bound is ten digits now, the unsigned 32-bit ceiling; the pin is
turned; `test/auditworld34.test.js` runs the port's fourteen real ids
through the law and two real sessions through the real Room in
Privateer's Hold's own room. The same lesson BR3 had the same day: a
law pinned on a synthetic value is not pinned.

**THE RELAY MUST BE REDEPLOYED** for this fix to reach a player
(`cd server && npx wrangler deploy`): it refuses by the same regex, and
the deploy was by hand, not in CI, when this was written (since SRV-N/CI,
PR #209, the push to main deploys a version drift -
`.github/workflows/relay-deploy.yml`). `/health` now answers with
`RELAY_VERSION` (`world34`) so a stale relay can be told from a browser
tab (D4).

- **A2 (high) a map id with bit 31 set read negative.** MAPS.BSA's id
  is read `getInt32`; `roomKeyFor` asked `mapId > 0` and fell to the
  name slug - a joinable room the wire keeps no world for, and one two
  clients could spell differently. The unsigned value is the id.
- **B1 (high) a dead foe was never retyped.** Two players' random
  flats differ by level (dungeonEnemies.js bands the pick), so a
  joiner's roster disagreed with the host's at EVERY index (executed:
  24 of 24 markers between a level-3 and a level-12 character), and
  `retypeFoe` refused a dead one - a joiner whose own save had killed
  the foe at `i` stood the room's live foe there mismatched for the
  life of the context: frozen, and invulnerable to that joiner, since
  `damageFoe` keeps a mismatched puppet's blow home. Retyped now; the
  record that follows lands it dead or alive as the room has it.
- **B2 (high) two layouts under one key.** Smaller Dungeons is a
  per-client setting (and a quest's frozen copy of one), and its clone
  keeps `recordElement.header.locationId`, so a five-block client and a
  full-dungeon client shared one `_locationKey`, accepted each other's
  frames and landed foes and doors on the wrong markers, silently.
  ONLINE, THE WHOLE DUNGEON: `useSmallerDungeon` answers false under
  `online` (the world host's `dungeonOnline`, through the entry seam
  and the quest layer's two location doors), and a stream keyed to
  another layout is refused and said once.
- **B3 (med) an empty layout had no heartbeat.** `foesFrame` returned
  null when nothing changed AND when there was nothing to say, so a
  dungeon with no layout foes streamed nothing, `FOES_STALE_MS` expired
  six seconds in, and every joiner flipped to its own authority and
  back on the next frame, running `setAuthority` over the pool each
  time. A FULL frame goes even when empty: it is the seat's heartbeat.
- **C1 (high) the memory rode the welcome alone.** The relay stored a
  world frame and never sent it to anyone but the next joiner, so two
  players entering a room together were both handed `null`, and nothing
  ever re-synced what stood before either touched it (executed: B's
  memory stayed null through six seconds of A publishing). A stored
  memory is now pushed once, as `{t:'world', id, data}`, to every
  hello'd socket whose welcome carried none (the mark rides the
  attachment, so a wake keeps it; under the foes fan's byte budget;
  the session takes it from the host alone).
- **C2 (high) the memory's records unprojected, and the latch on
  them.** `sharedWorld` shipped the SAVE record - `failedSkillLevel`,
  the picker's per-player latch AUDIT WORLD3 B1 had kept off the act
  path - and `restoreSharedWorld` handed it to `restoreSaveData` raw,
  where the act path runs `validActionRecord` (A2). Executed: one
  host's failed pick silenced every joiner's attempt at that skill,
  and one `t` of NaN in a stored memory bricked a door for every joiner
  for `WORLD_TTL_MS`. The shared half out, projected in.
- **C3 (med) a refused act was thrown away when the socket was away.**
  `actSend` and `actFlush` CLEARED the pending set whenever the socket
  was not open - a reconnect's second, a room hold - and the seam is a
  delta, so every door touched inside it was lost for good. The set
  outlives the socket now and is flushed on its return; it is cleared
  only when the room is no world room at all.
- **D1 (med, relay) a socket the room closed itself said no leave.**
  The runtime delivers `webSocketClose` for the PEER's close alone; a
  refusal or a failed send closed the socket and told nobody, so the
  survivors kept the gone host's id, `isHost()` stayed false for the
  one the relay had already seated, and the foes froze while the
  memory stopped being written (executed). Every door out of the object
  reaps through `_leave` now, and a leave is said once.
- **D2 (low, relay) the memory's floor was the room's, not the
  author's.** A new host's first publish after a handover fell inside
  the old host's `WORLD_MIN_MS` stamp and was dropped, while its client
  had already spent its publish clock and heard `true`. Per author.
- **D3 (low) `sendWorld` was the one out-frame without the room's
  guard** - it said `true` in a town while the relay kept nothing.
- **D5 (med) nothing said whether a dungeon was shared.** `statusLine`
  is null on an open socket, the session logged nothing on a join or a
  host change, and the Online pane's copy still read the pre-WORLD1
  sentence ("Nothing else is shared yet"). The session says
  `[online] room <key> - a shared world | presence only` on every join
  and `[online] host <id>` on every seat in a world room; the pane says
  what a dungeon shares and what a town does not. Had either existed,
  the root would have been one console line to find.

**Recorded, not paid.** E1: Chrome copies `sessionStorage` on
"Duplicate tab", so two tabs made that way share `peerId` and the
second replaces the first for the life of the page (AUDIT ONLINE B4's
deliberate terminal close, "this character is online in another
window") - open the second tab fresh. E2: a quickload inside a shared
dungeon restores the save's doors and piles locally through
`applyWorld` with nothing said to the room (AUDIT WORLD4 D7's cost,
sharper now). E3: a trigger plate re-enters `receive` every
`COLLISION_TIMEOUT_S` (8.3 a second) against `ACT_HZ_MAX` (5), and
`_changed` walks the whole graph twice per entry - the refusals heal
through the pending set, the cost stands. E4: `corpse:<i>` loot cannot
land while the foe at `i` is not dead locally. E5: leave, re-enter and
leave a dungeon inside `WORLD_MIN_MS` and the second farewell is
dropped. And THE SCOPE, restated for Mac plainly: towns, the open
country and buildings share who is there and nothing else (a town is a
world CELL on the shipped path - `town:` is minted only by the dev
city); in a dungeon the layout's foes, the doors, levers and platforms
and every opened container are the room's, while random encounters,
summons, quest foes, untouched piles and dropped loot are each
client's own by design; no shared clock or weather (slice 5). The
desktop app's three releases (app-v0.1.x, 2026-08-31) predate ONLINE1
entirely - the site is the only place this code runs.

Pinned in `test/auditworld34.test.js` (13): the law on the fourteen
real ids at both ends and the unsigned id; two real sessions through
the real Room in `dungeon:m187853213` (foes, act and memory crossing)
against the slug room (presence and nothing else); the reap (a
refusal and a failed send each saying a leave and a seat, once); the
floor per author; the memory pushed once to the socket whose welcome
carried none, across a wake, and taken from the host alone; the guard
on `sendWorld`; the whole dungeon online through the law and the two
seams; and by source the dead foe's retype, the heartbeat, the memory's
two projections, the pending set, the console lines (executed on the
session), the pane's copy, the relay's version and this record.
`test/auditworld.test.js` A3 turned; the WORLD1-3 and AUDIT 28 source
pins restamped where the law moved. Relay change: yes - REDEPLOY.

## WORLD5 (2026-09-13): the shared clock and weather, the quest clocks stood down

**Mac: "Let's tackle slice 5 first."** Slice 5 of the persistent shared
world, the last of WORLD1's plan: THE SHARED CLOCK AND WEATHER, and the
quest clocks stood down online (Mac, WORLD1: "When it comes to time
limits on quest, I think these should be naturally disabled while
online").

**THE CLOCK IS NOBODY'S TO KEEP.** Online, the world's time is a
FUNCTION OF WALL TIME - `net/wire.js sharedClassicMinutes`, one home at
both ends: `ONLINE_EPOCH_MS` (2026-09-14T00:00Z) is the instant the
world stood at the classic game start (13:30, 4 Morning Star 3E405 -
`ONLINE_EPOCH_MINUTES` is gameDate's own constant, pinned equal), and it
has run at DFU's default TimeScale since (`ONLINE_MINUTES_PER_MS`, the
ticker's own rate: a game minute every five real seconds, a day every
two real hours, a year every thirty real days). No frame carries it, no
host hands it over, no handover races it, no hibernation loses it. The
relay says its own clock in every place room's welcome (`now`, ms) so a
machine whose clock is off reads the world's time through the offset
(the session's `clockOffsetMs`, `onClock`; a clock a year off is no
clock). The world host installs it at boot (`setSharedClock`, before
anything reads the time, and `setSharedWeather` beside it), and while it stands `worldMinutes()` reads it
and EVERY write is refused - `setWorldMinutes`, `advanceWorldMinutes`,
the ticker's `advance` (RaiseTime: the exhaustion collapse, a training
session, a sentence), `?tod`, `?timescale`. The tick claims what the
clock owes between two readings (the rounds, the days) and fabricates
not one minute from dt, so a frame that comes late owes what passed and
a frame of fabricated time owes nothing.

**THE SAVE ARRIVES, IT DOES NOT CATCH UP.** A save a month behind the
world would have fired a month of loans, diseases and price walks on
its first online frame; one a year ahead would have read a negative
day. `alignEntityClocks` sets the player's own markers to the world's
when the session starts - the day marker, the broker's, every
disease's day and every poison's minute - and the day's weather is
rolled from the shared day's seed whatever sky the save carried. The
world's time is where the player has arrived, not this save's
continuation; a save made online carries the world's time and plays on
from it offline.

**A REST TAKES THE TIME IT TAKES.** `RestSession` is paced by the
world's clock online (`deps.sharedMinutes`, every host's rest deps):
a sub-tick when the clock has moved `MINUTES_PER_TICK`, an hour of
rest when it has moved sixty - five real minutes at TimeScale 12 - and
the window's own timer is not consulted. The rounds a sub-tick owes are
the ones the clock owes (the ticker's `advance` runs them, the
dungeon's own rest arm claims them), the vitals tick per rested hour
as ever, and a rest is ended early as ever. A FAST TRAVEL takes no
world time: the arrival minute is now, the trip's jump and the
arrival clamp (the vampire's dusk) stand down, the fare and the
cautious heal stand.

**THE DAY PICKS THE SKY.** The six-zone climate array was rolled from
`Math.random` once per game date, so two players under one sky rolled
two. With the shared clock on (`setSharedWeather`), every roll of the
array - the day change's, the boot's lazy one, a respawn's re-roll into
another climate base - draws from a generator seeded by the DAY (and
the climate, for a respawn), so every client rolls one sky for one
date with no frame to carry it. The enhanced lane's hourly evolution
(CLK2) was already seeded by the hour and the zone, so it agrees for
free between two enhanced clients; a classic-lane client and an
enhanced one still differ within the day (recorded, below).

**THE QUEST CLOCKS STAND DOWN.** `questClocksStoodDown` rides the quest
machine's deps through the bridge and the parser to every live quest,
and `Clock.tick` charges nothing while it answers true - the world-time
sample still moves, so the hours a clock stood down are never charged
when it stands up again offline. The journal shows the clock as it
stood. [SUPERSEDED BY WORLD7: a Daggerfall clock is a delay as often
as a limit, and stood down no delay ever ran - the letter never came.
The clocks charge PLAYED time now; the word is `questClockStepMax`.]

What it does not do. The clock is the world's for everyone online in
every room - a cell, a town, a building, a dungeon - which is the
point; a classic-lane and an enhanced client under the same date may
differ within the day (the evolution is the enhanced lane's); the
weather a climate crossing keeps until the world turns is still each
client's own walk (DFU's law, unchanged); two clients that boot online
minutes apart roll one array and may still apply it on different
frames (the drain is the exterior frame's, as ever); no shared moon,
no shared holiday beyond what the date already decides. Relay change:
the welcome's `now` - REDEPLOYED (RELAY_VERSION `world5`).

Pinned in `test/world5.test.js` (8): the wire's constants against the
calendar's and the ticker's, at both ends; the welcome's clock in a
dungeon and a cell and not a channel, the session's offset and its
refusal of a clock a year off; the ticker under the shared clock (the
source read, every write refused, three minutes of the world three
rounds whatever the frame's dt, a frame of three thousand real seconds
owing nothing, RaiseTime running the owed seven minutes and moving
nothing); the markers aligned; the shared weather (one date one sky
whatever generator the caller handed in, the boot's lazy roll the
same, forty dates not one sky, a respawn's roll repeatable, offline the
caller's own again); the rest paced by the clock and the timer law
untouched offline; the quest clock stood down and standing up; and the
hosts by source. The AUDIT 23, AUDIT 63, ROAD-Ar, TL3, TP1, MAC7,
AUDIT WORLD4 and ONLINE1 pins restamped where the law moved.

## AUDIT WORLD5 (2026-09-13)

**Mac: "Lets do an audit on this."** Four opus lenses over WORLD5,
each told the live report and made to find it: the wire, the relay and
what the player is told; the weather and the boot; the clock and the
ticker; the rest, the travel and the quests. Every finding below was
EXECUTED against the real modules (`test/auditworld5.test.js` runs the
ticker, the rest session, the weather sim, the collapse and the save
door under a shared clock the test holds) or cited to a line; the
record says which. Fourteen findings fixed in this slice, the rest
recorded and not paid. The relay changed (C11) and **must be
redeployed** (`cd server && npx wrangler deploy`); `/health` answers
`world51` when it has been.

**THE ONE SHAPE.** WORLD5 made the clock a function of wall time and
refused every local write, and then left four things that used to be
moves of the clock standing as if the clock had moved: the dungeon's
rest arm claimed its own broker window (C1), the exhaustion collapse
paid its hour (C6), the sentence refilled the pools (C9) and the
cautious trip healed (C14). Under a clock nobody moves, a thing that
charged time and paid in kind now pays for nothing - the collapse and
the sentence were free heals, the cautious trip a free instant full
heal on a black screen - and a thing that claimed its own window ran
it twice, because the tick's own reading was left behind. The same
shape, four times: the price was the clock move, and the clock move
is gone.

**C1 (CRITICAL) - THE DUNGEON'S RESTED NIGHT RAN ITS ROUNDS TWICE.**
`dungeonContext.js`'s `_restAdvance` claims its own broker window
(AUDIT 24 wave 30's fix: the rest window runs no frame body), and
under the shared clock that claim moved `_lastMagicRoundMinute` past
the tick's `_sharedLastTick`; the next frame's tick read from the old
reading, `claimMagicRounds` found `here < _lastMagicRoundMinute` and
took it for a load's rewind - its backstop - re-anchored, and ran the
night again: every poison, disease and continuous-damage effect twice
per rested hour, in the dungeon only. The claim now moves the tick's
reading with it (`worldTick.js`, in `claimMagicRounds` under
`_sharedClock`); executed: the arm's claim of ten minutes, then the
tick owing nothing, then two more minutes owing two.

**C2 - A SOURCE THAT STEPPED BACKWARDS FROZE THE TICK.** `next =
max(reading, source)`: when the relay's offset corrected this machine's
clock backwards (or the machine's clock was set back) the reading stood
ahead of the source and every tick owed nothing until the clock caught
its old self up - a hundred-minute correction was eight real minutes
with no round and no day. The tick re-anchors on a source below its
reading. And the world host's `onClock` was a bare assignment: the
first welcome's offset landed AFTER the boot-time arrival (the socket
opens later), so until then every marker stood at the uncorrected
clock's time and the first corrected tick caught up (or froze for) the
difference. A correction over a second now runs the same
`onlineArrival` the session's start runs (the markers, the day's roll,
the season); a room move's welcome saying the same offset again moves
nothing.

**C3 - THE ALIGNMENT STAMPED FOUR MARKERS AND THE REST STAYED DATED BY
THE SAVE.** WORLD5's `alignEntityClocks` set the day marker, the
broker's, each disease's day and each poison's minute to now, and
nothing else - `lastSkillCheckTime`, `timeOfLastSkillTraining`, the
enemy-alert stamp, the two crime-guild letter clocks, every loan's
due date, every rented room's expiry, every summoned item's hour, the
vampire's `lastTimeFed`, every guild rank's `lastRankChange`. The
rest lens executed the worst case: an ordinary sixty-day save joining
a world at day 375 read its skill check 69,120 minutes in the future
and raised NO skill for 48 game days (four real days) with 100,000
uses banked; training refused as too soon; a room rented for a day
reading 1,176 hours left. The other way round (a save far ahead of a
young world) every deadline read as long past. The alignment is a
SHIFT now: every marker moves by the distance from the save's own
clock (its day marker) to the world's, so a room keeps its hours, a
loan its week, a summoned item what it had left, a skill check that
was due is due now; a "last" marker never lands ahead of now; a zero
stays zero (the letter clocks, a summoned item's hour, a first skill
check - zero means none); a fresh character with no day marker moves
nothing. Executed both ways, and through `liveVampirism`, which now
steps over a hole in the effects list rather than throwing on it.

**C4 - A LOAD ONLINE WAS NOT AN ARRIVAL.** The alignment ran once, at
the session's start, over the save the boot restored - a quick load, a
boot `?load`, the classic import and the dungeon's own load all
restored the SAVE's clock into every marker, and the next tick caught
up the distance to the world (a month of loans and diseases in one
frame) or read it negative; and `restoreWeather` put the saved sky up
to stand until the next day change. The one door every host loads
through is `save.js restorePlayer`, and under the shared clock it now
aligns and rolls the day's array from the shared seed (the first
exterior frame drains it over the saved sky, and the drain is a jump).
Executed over a real snapshot.

**C5 - THE SHARED ROLL WAS THE ROLLER'S, NOT THE DAY'S.** The roll's
stamp was the roll's own minute, so a joiner at noon drained a "live"
roll and got a three-hour front for a sky that changed at midnight;
and the enhanced lane's hourly evolution re-anchored on the joiner's
first hour (`_evolveHour === null` rolls nothing), so a client that
joined at 15:00 was missing fifteen hours of evolution the client that
stood there since midnight had applied - two skies under one seed.
Under the shared clock the roll is THE DAY'S: stamped at the day's
first minute (a noon drain is a jump, a five-past-midnight drain a
front - both executed) and the evolution re-anchored at the hour
before the day's first, so the next evolve replays every hour of the
day up to now (executed: a client evolving hour by hour from midnight
and one joining at 15:07 carry one array). Offline the stamp is the
roll's own minute and CLK2's re-anchor stands.

**C6 - THE COLLAPSE PAID ITS HOUR FOR FREE.** `RaiseTime(1 hour)` is
refused online; the three recovery rates were not. Fatigue drained to
zero was an hour's health and magicka for nothing, as often as the
drain reached zero. The one home (`rest.js exhaustionOutcome`) pays
the fatigue hour every collapse - it is what stands the player up; the
next frame collapses again without it - and the health and the magicka
once per WORLD hour, which is what an hour's rest yields over the same
five real minutes. Offline unchanged.

**C7 - A COVERED REST BANKED THE WORLD'S TIME AND RESOLVED THE NIGHT
IN ONE FRAME.** The rest lens executed it: a nine-hour rest covered by
the pause menu (or a quest box, or a hidden tab) while the clock ran a
real hour, then one uncovered frame - 54 sub-ticks, nine rested hours,
nine enemy checks against ONE snapshot of the foe list, the spawn-abort
latch armed for a next frame that never came, `_spawnEncounter` landing
after the rest had ended. Offline this cannot happen: a covered frame
never reaches `_accrue`, and the frame's dt is clamped under one
sub-tick's wait, so the timer takes at most one sub-tick a frame. The
same two laws now hold under the shared clock: a covered frame moves
the reading up to the clock keeping less than one sub-tick owed (the
covered time is LOST, as the timer loses it), and a leap is taken ONE
sub-tick a frame, so each hourly check reads the foes on a frame of
its own (executed: a foe wandering in during the first hour breaks the
rest on the sixth frame).

**C8 - THE DUNGEON'S REST ARM ROLLED THE SAME TEN MINUTES EVERY
SUB-TICK.** `const start = floor(classicMinutesRef.value); value += n`
- the write refused, `start` read AFTER it, so every sub-tick offered
`intermittentEnemySpawn` the same ten minutes, ten minutes ahead of
the clock, once per sub-tick (a night whose window missed the
12-in-144 band rolled nothing; one that hit it rolled it 54 times).
The session now hands `advanceMinutes` the sub-tick's own END (the
reading just counted; null offline) and the arm derives `[start, end)`
from it for the spawner and the broker alike. Executed: two sub-ticks,
two ends ten apart.

**C9 - A SENTENCE SERVED NO DAYS AND REFILLED THE POOLS.** The prison's
refill lands "when daysInPrisonLeft hits 0, after the RaiseTime" - the
days are its price, and online `advanceDays` is refused. A surrender
was a free full heal of all three pools for the walk to the guardhouse.
Online the sentence refills nothing; the rescue's and the acquittal's
refills stand (neither costs a day offline either).

**C10 - `exterior.js`'S BRIDGE SAID NOTHING.** Its quest bridge ctx
carried no `questClocksStoodDown`, and the bridge's fallback is
`false` - unreachable today (`?exterior` never carries `online`), but a
host that says nothing charges every clock. It says the same word
world.js does. [WORLD7: the word is `questClockStepMax` now, the
same on both hosts.]

**C11 - THE WELCOME'S CLOCK WAS THE HELLO'S.** `now` was taken at the
top of the hello and the welcome built four storage awaits later, so
every millisecond of them rode to the client as the relay's clock.
Stamped as the welcome is built. `RELAY_VERSION` is `world51`.

**C12 - THE PANE DID NOT SAY THE CLOCK.** AUDIT WORLD34 made the
Online pane's copy the law of what is shared; WORLD5 shared the clock
and the sky and said nothing. One sentence: the clock and the sky are
the world's and run on real time; a rest, a trip, a sentence or a
lesson takes none of it; the quest clocks stand still.

**C13 - THE INSTALL SAT BELOW THE SEASON READS.** `bootWorld` read
`worldMinutes()` for the climate season and the mod's four-valued one
BEFORE the shared clock was installed, so an online boot dressed the
world in the session clock's season and the shared clock's turned it
over on the first frame (a full re-skin). The install is the boot's
first act now, and the pin reads that nothing between the boot's door
and it reads the clock.

**C14 - THE CAUTIOUS TRIP WAS A FREE INSTANT FULL HEAL.** DFU's
cautious traveller arrives rested because the days passed; online the
trip takes no world time, and Cautious + Camp Out is a zero fare
(`calculateTripCost` executed: `{piecesCost: 0, totalCost: 0}`), so
every pool refilled in full on a 1.5-second black screen, repeatable,
which retired resting, potions and the temples as a healing economy.
The heal is the trip's nights, and online there are none.

**Recorded, not paid.** (1, PAID BY OL3) Every world-time deadline now runs on wall
time INCLUDING while the player is logged off: a room rented for a day
is gone in two real hours whether or not the tab is open; the 350-day
ceiling is 700 real hours; the tombstoned-quest week fourteen real
hours; a loan's month sixty. That is what a shared clock means, and the
alternative (per-player deadlines in a shared world) is a different
design; the pane's sentence says the clock runs on real time. (2, `CreateFoe` PAID BY OL3) Only
`Clock` stands down. `DailyFrom`, `GivePc`'s daylight gate,
`PlaySound`'s interval, `CreateFoe`'s `spawnInterval`, the tombstone
week and `TrainPc`'s three hours all read the shared clock and PACE
correctly (one event per tick, no bursts); `CreateFoe` keeps its waves
coming on wall time while the player idles, which is a cadence, not a
deadline, and stays deliberately. (3) Training costs no time online:
`TrainPc`'s `raiseTime(3h)` and the guild trainer's hours are refused,
so a lesson costs fatigue and gold and no afternoon; the daily
cooldown (`timeOfLastSkillTraining`) still holds, on the shared clock.
(4) The pause-menu catch-up is bounded (the broker's 2,880-round cap,
one day block) and measured at 8.8 ms for a real day away; DFU freezes
time under a pausing window and this world cannot. (5, PAID BY OL2) The rest window
does not say it is clock-paced: an hour of rest is five real minutes
and the counter moves once per five, which a player will read as a
hang. (6, PAID BY OL2) The travel popup counts down the trip's days for a trip that
takes none, inn nights are charged for nights nobody spends, and
`arrivalClampMinutes` is computed and discarded online; the sun-averse
traveller arrives when they arrive (WORLD5's own record). (7, PAID BY OL3) The
session refuses a welcome clock more than a year off - a machine a
year wrong reads the world's time uncorrected rather than not at all.
(8) The classic and enhanced lanes diverge under one seed by design
(the evolution is the enhanced lane's), and `?weather` still pins a
sky locally. (9) `setSharedClock(null)` has no caller outside the
tests: the clock is installed for the page's life.

**Pinned** in `test/auditworld5.test.js` (nine tests): C1 through C8
executed, C9 through C14 by source. The WORLD5 pins moved with the law
(`onClock`, the arrival, the relay's version and stamp, the rest's
leap a sub-tick a frame); the AUDIT 24 wave 30, AUDIT 26 F204,
encounters and S40 pins restamped for the arm's new signature.

## OL1 (2026-09-14): online is the enhanced lane, whole

**Mac: "with online, specifically #8, I definitely think I want any
current and future enhancements/mods enabled on for online."** AUDIT
WORLD5's eighth recorded item was that the classic and enhanced lanes
diverge under one shared seed - the weather's hourly evolution is the
enhanced lane's, a mod's roads and seasons are a mod's - so two players
in one world could stand under two skies on two road networks. Mac's
answer is a lane, not a per-switch rule: WHILE THE PAGE IS ONLINE the
skin is enhanced (over `?skin=classic` too - a shared world has one
lane), every enhancement the port owns is on, and every vendored mod is
enabled, whatever the player's shelf says.

**A read, not a write.** The forcing lives in `systems/onlineLane.js`
and is asked FIRST by the three places a switch is read - `uiSkin.js`
(the skin), `uiPrefs.js getPref` (the port's own switches) and
`modSettings.js modSetting` (a mod's `Enabled`). Nothing is forced at a
mount site (there are forty-seven `isEnhanced()` sites and the
forty-eighth would be missed), and nothing is written: the shelf and
the mod store keep the player's own choices, which stand again the
moment they play offline. `?online` is the fact (main.js sets it for
Play Online and deletes it on every other door), read off the URL like
the skin override is.

**What is forced:** the skin; `enhancedEnvironments`, `enhancedAI`,
`enhancedCombatVisuals`, `enhancedWater`, `pixelatedSky`; `mwArms` (the
Morrowind arms build at boot where the archives are attached -
`autoBuildArms` guards the data, so a machine without them wears the
doll as offline); and every vendored mod's `Enabled` (Dynamic Skies,
Seasons of the Iliac Bay, Basic Roads, Meaner Monsters, the Physical
Combat And Armor Overhaul, Unleveled Loot). Enhanced AI is the one that
was OFF by default as the port's opt-in departure from DFU's classic
motor; online it is on for everyone, which is also the first time both
clients in a dungeon step their foes by one motor.

**What stays the player's:** the dials - grass density, cloud quality,
land view distance - because a machine that cannot hold the full field
keeps the lane at a lower cost, and none of them decides what the world
is, only how this machine draws it; the touch knobs, the FPS counter,
the HUD scale and the text size; and a mod's own dials (a fog density,
a material swap), as its own modsettings would leave them. The probes'
URL kill doors (`?sky=classic`, `?water=off`, `?evolve=off`) stay
doors: an online page never carries one.

**The future half is a pin, not a promise.** `test/onlinelane.test.js`
walks every boolean key in `PREF_DEFAULTS` and fails on one the lane
has neither forced (`ONLINE_FORCED_PREFS`) nor left to the player by
name (`ONLINE_PLAYERS_OWN_PREFS`), pins that every key beginning
`enhanced` is forced, and that every vendored mod carries the one key
the lane forces. A new enhancement cannot land without answering the
question.

**Said to the player.** A forced switch in the Settings and Mods panes
is shown locked - "On (online)", disabled, with the reason in its
title - so a press teaches rather than changes nothing; the Mods pane
says it once at the top; the Online pane's copy says the lane at the
door.

**MAC-N3 (2026-09-16): the fact was never on the URL.** "main.js sets
it for Play Online" above was true of an in-memory `URLSearchParams`
the front door edits and hands to `bootWorld` - and nothing wrote that
copy back to `location.search`, which is the one read `isOnlinePage`
makes. So for every Play Online session the lane answered *offline*:
the skin stayed the stored choice, no enhancement and no mod was
forced, and a Classic player had no chat (Mac: "Chat UI not visable
with classic in online mode"). The relay was fine, because the world
host reads the copy. `onlineLane.publishBootParams` writes the decided
params to the URL through `history.replaceState` before the world
boots, and the six keys the menu decides (`BOOT_DOOR_KEYS`) are cleared
off both copies before the menu runs, so a reload after an online
session does not show the Mods pane locked for a player who has not
chosen yet. One home, not a second read path. The record is
`01-Overview/Mac-Bugs-N.md`.

## OL2 (2026-09-14): the rest window says the clock, the trip says it arrives now

**Mac: "Now tackle #s 5/6."** AUDIT WORLD5's fifth and sixth recorded
items, paid.

**(5) THE REST WINDOW SAYS IT IS CLOCK-PACED.** Under the shared clock
an hour of rest is five real minutes and the counter moved once per
five, on a page that showed a bare hour count - a working rest read as
a hang. `RestWindow.status()` now carries the world's minutes while the
session is paced by them (the same `deps.sharedMinutes` the session
reads; null offline, and then nothing is added and the page is what it
was), and both pages - the native counter page under the vitals, the
text chain between the hours and the vitals - say the world's time of
day and the pace: "World time 15:05 - an hour here is 5 real minutes".
The five is DERIVED from the wire's one rate
(`REAL_MINUTES_PER_WORLD_HOUR = round(60 / (ONLINE_MINUTES_PER_MS *
60000))`), not spelled, so a rate change cannot leave a stale number
on the page. The text page's lines moved into `restingLines()` so the
pin reads the same body the page draws.

**(6) THE TRIP SAYS IT ARRIVES NOW.** Online the trip takes no world
time (WORLD5) and the popup still counted down the trip's days,
charged inn nights for nights nobody spent, and said nothing. The host
now says the fact through one dep, `noWorldTime` (world.js:
`sharedClockOn`, threaded through the map window; a host that says
nothing travels as DFU does), and while it is true: the day countdown
is empty and the trip begins on the next tick; no inn night is paid -
not even DFU's "always at least one stay", which is a night too
(`sleepModeInn && !noWorldTime()` into `calculateTripCost`); the days
label says "now"; and a line under the panel says why ("Online: the
world's clock does not wait. You arrive now, and no inn is paid."). The
fare for a ship's passage stands, because a crossing is a crossing,
and the trip's DFU minutes are still computed because the host reads
them offline. `arrivalClampMinutes` is still computed and discarded
online (the sun-averse traveller arrives when they arrive, WORLD5's own
record) - two source pins hold that line and it costs nothing.

## OL3 (2026-09-14): the clock does not punish absence

**Mac: "Yeah you got it my man. Go ahead and get these done per your
opinion."** Three of AUDIT WORLD5's recorded items, paid together
because they are one thing: a shared clock that runs while the player
is away must not charge them for being away without saying so.

**(1) THE PRICE IS SAID IN REAL TIME.** Every world-time deadline runs
on wall time through a logout - a week's lodging is fourteen real
hours, a loan's month sixty - and the shared world keeps ONE clock, so
per-player deadlines would be a different design. The honest fix is
that the player buys what they think they are buying. The shared
clock's inverse now rides beside its source: `wire.js
wallMsForClassicMinutes` (the relay-clock millisecond at which the
world reads a classic minute), installed by the world host through
the relay's offset as `setSharedClock(source, wallOf)`, and read as
`worldTick.js sharedWallMs` / `sharedRealTimeText` ("Tue 15 Sep
18:05", in the font's own ASCII, this machine's zone; null offline).
The tavern's offer carries a row under DFU's - "The room is yours
until Tue 15 Sep 18:05 by your clock - the world's time runs while you
are away." - through one hook, `realTimeOf` (a fresh rental from now,
a renewal from the standing expiry, exactly RentRoom's own arithmetic;
a host that answers nothing offers as DFU does). The bank's due-by
label carries the real time in brackets beside DFU's date, since a
default lowers reputation and brings the guards; offline it is the
date alone. The loan reminder letters are the safety net and are
untouched.

**(2) `CreateFoe` STANDS DOWN WITH THE CLOCK.** Mac's WORLD1 word was
that quest time limits should not punish being online, and a quest
that keeps spawning ambush waves on wall time while the player idles
or is away is the same punishment by another door. The spawn interval
now reads the quest's `questClocksStoodDown` as the Clock does: while
stood down the marker rides the clock so no interval accrues (no
backdate on a first tick either), a wave already in flight still lands
and is counted (the placement is not a timer), and standing up the
first wave waits a full interval from there. `DailyFrom`, the daylight
gate and `PlaySound` are pacing, not pressure, and stay as recorded.
[WORLD7 re-spelt this with the Clock: the interval charges played
time - a tick's gap past the step forgiven, a resume waiting a full
interval from there; the stand-down word is gone.]

**(7) A CLOCK A YEAR OFF IS SAID.** The session refused a welcome clock
more than a year from this machine's and ran the world's time
uncorrected in silence. It now keeps `clockWarning` while the fault
stands - the console hears it once, with both clocks, and the HUD's
status line shows it on an OPEN session ("this machine's clock is more
than a year from the world's - set it, or the shared time is wrong
here") - and a sane welcome clears it.

**Left as recorded, on purpose:** (3) training's free hours (the daily
cooldown bounds it to what DFU allows); (4) the pause-menu catch-up (a
shared world does not pause); (8)'s residue, the probes' URL kill
doors; (9) the uninstall no caller uses.

## WORLD6 (2026-09-14): towns, cells and buildings share more than presence

**Mac: "Lets tackle #1 next."** The first of the arc's "not yet" list
after WORLD5 closed WORLD1's plan: a dungeon is one shared world with a
memory, and outside one, players share only who is there. THE PLAN,
from a survey of every piece of mutable world state outside a dungeon
(an opus lens over the exterior, the interiors and the per-player set):

1. **6a - the building is a world room** (this slice). A building
   interior has had a relay room of its own since ONLINE1
   (`interior:m<mapId>.<buildingKey>`) and carried presence alone,
   because the wire's world-room law admitted dungeons only. Its
   mutable state is small and already save-shaped in the scene cache:
   the shelves and cupboards (stock, and the day it was stocked), the
   doors' action records, the player's own piles. Widen the law, give
   the interior mode the dungeon's three laws (the memory, the acts,
   the loot), and buildings are shared.
2. **6b - the cell is a world room.** The open country and the towns
   keep guards, encounter foes, corpses and dropped piles per player,
   each pool with its own AI loop (`cityGuards.js`, `exteriorFoes.js`)
   and freed with the map pixel. One simulation per cell needs the
   puppet arm WORLD2 gave the dungeon's foes, in two more pools, over
   a room that is a sixteen-pixel cell rather than a place - and the
   cell seam (two players a pixel apart astride an edge are in two
   rooms) is the same slice's problem. The region's prices and
   conditions walk by the day block and can be seeded by the shared
   day as the weather is (WORLD5), which is the cheap half.
3. **Recorded, not planned:** the wandering population (no identity
   across a pixel unload for one player either); building discovery
   and the talk state (knowledge - the player's own by DFU's design);
   quests, banks, houses, ships, rentals (the player's own); a dropped
   pile (AUDIT WORLD B3 - the dropper's); the treasure markers' roll
   (it reads the player's level and gender).

### 6a: the building is a world room

- **The wire** (`src/net/wire.js`, both ends through `server/src/
  relay.js`): `isWorldRoom` admits `interior:m<mapId>.<buildingKey>` -
  the map id unsigned as roomKeyFor mints it (AUDIT WORLD34 A2), the
  building key up to eight digits (`MakeBuildingKey`: (x<<16)+(y<<8)+i,
  or the 1<<24 sentinel). A slugged location (no map id), a town's
  room and a cell are still no world room. Everything gated on the
  predicate - the memory, the acts, `sendWorld`/`sendAct`/`onAct`,
  the relay's own admission - follows without a second switch; the
  relay MUST BE REDEPLOYED (`RELAY_VERSION` `world6`).
- **The pure half** (`src/world/interiorShared.js`): the memory
  mirrors the dungeon's and is subtracted the same way - the action
  records' SHARED half (`sharedRecord`, AUDIT WORLD3 B1), projected
  before they land (`validActionRecord`, A2/WORLD34 C2) and RESTORED
  rather than heard (where the doors stand as I walk in is a restore,
  like the cache's); the loot as WORLD4's law, in the cache's own
  vocabulary (`shelf:<i>`, `container:<i>`, one spelling each): a
  container nobody has opened (`items: null`) is every client's own
  lazy roll and the memory says nothing of it; one the room has opened
  is the room's, with what is left and THE DAY IT WAS STOCKED (`d`) -
  the restock is a day comparison against the world's day (WORLD5),
  so the day rides the record and every client agrees on when a shelf
  turns over. The word lands IN PLACE on an opened container, WHOLE on
  one this client never opened (a second reader adopts the first's
  roll), never under this player's open window (AUDIT WORLD4 C1); a
  list past `LOOT_LIST_MAX` is not said, once, out loud (A2/B2/D1).
  `interiorLocationKey` spells the memory's key exactly as the room's,
  so the two agree by construction.
- **The interior mode** (`src/scenes/worldModes.js`): at the mount the
  room's key and this context's stamp (AUDIT WORLD B1), the seen set,
  the said-once set, the applied latch (B7) and the open window; an
  OWNED house or ship keeps no room - ownership is the player's own
  (DFU has one player), so an owner's storage is never the room's and
  a stranger's roll never lands on it. The doors go out the moment
  they move (the graph's own change seam, keyed by the building). A
  container is the room's from the OPEN (a claim, which speaks only
  for one the room has not spoken about - C2/D5, and makes the memory
  due this frame), on a RESTOCK (the new day's stock is the room's,
  whoever browsed first), and on the CLOSE - which, because a trade
  window has no close hook of its own (X6), is the frame's settle: the
  window opened on the container is gone, through whichever drain
  freed it. The leave fires after the cache and before both teardowns
  (the exit door, the load-or-teleport), as the dungeon's does.
  `placeSharedWorld` / `restorePlaceSharedWorld` / `applyPlaceActions`
  / `placeActionRecords` dispatch on the standing PLACE, a dungeon's
  four arms untouched beneath them.
- **The world host** (`src/scenes/world.js`): one path - the publish,
  the welcome's restore, the act in, the pending re-read - through the
  place; `onInteriorLeave` publishes at once as `onDungeonLeave` does.
  The room's own key was already the building's, so a player walking
  through a shop door already changes socket; now the room means
  something.
- **The pane** says it: a building is a shared world too - its doors,
  and every shelf and cupboard anyone has opened.

Not done here, on purpose: the interior's foes and guards (a quest's
or a crime's - the player's own, not streamed); the dropped piles and
the treasure markers' piles (B3, and a per-player roll); bookshelves
(a library's, a guild's, a temple's - the books taken are a shelf's
items, but the flow has no window to settle on; next); a last-writer-
wins on a restock two players make in one day (each rolls their own
and the later close stands, as the dungeon's loot already runs).

Pinned in `test/world6.test.js` (6): the wire at both ends; the real
Room keeping a building's memory and handing it on, a town's ignored;
the pure half's vocabulary, records, landing, memory and re-read; the
hosts by source. The WORLD1, WORLD3, WORLD5, AUDIT WORLD34 and AUDIT
WORLD5 pins restamped where the law and the path moved.

## AUDIT WORLD6a (2026-09-14)

**Mac: "Audit before we move on."** Three opus lenses over the
building-as-a-world-room slice, each told the live record and made to
find it: the wire, the relay and the keys; the interior's live wiring
and the world host; the pure half and what the slice left out. Every
finding below was executed against the real modules (the fake Room
and socket, the pure half on a bare context, the loot projector) or
cited to a line. Fourteen paid in this slice, four recorded. The relay
changed (B3) and **must be redeployed**; `/health` answers `world61`.

**A1 (CRITICAL) - THE BUILDING'S MEMORY WAS NEVER PUBLISHED.** The
interior mode built its wiring bag with the key spelled `key` and
handed the whole bag to `composeInteriorShared`, which read
`locationKey` - so every publish answered null, the relay stored
nothing for any interior room, and no joiner was ever handed the
building as the host left it; only the live acts worked, and only for
players already standing in the room. The slice's headline law was
inert, and the only pin on the call site was a source regex that
matched the broken line verbatim. The bag is minted by the pure half
now (`mintInteriorShared`), the field names live in one home, no site
reads the old spelling (a pin counts them), and the audit's test
EXECUTES the composition through the very bag the mode hands in. The
lesson is AUDIT WORLD34 A1's again: a law pinned by its spelling is
not pinned.

**B1 (CRITICAL) - A PEER MINTED PRICED GOODS ONTO A SHOP'S SHELF.**
`validLootItem` took any `templateIndex` and clamped every other field
without reading it; a shelf's list lands on every client and
`calculateCost` reads `value`, so a forged Daedric dai-katana at
`value: 0` sat on a shop's shelf for two gold, for everyone, and the
room remembered it for thirty days. THE PRICE IS NOT THE WIRE'S: the
projector floors an item's value at what the port itself mints for the
template and material (`itemBaseValue`, ItemBuilder's own arithmetic)
and refuses a template the port does not have; an honest value above
the floor (an enchantment's worth, a book's price) stands. A forged
item still lands, at its true price - a peer selling a conjured thing,
which WORLD4's law already accepts for a chest - and that is recorded
below. The floor is the projector's, so the dungeon's chests take it
too.

**A2/B2 - THE STOCKED DAY LANDED UNREAD.** `d` is the one field the
interior's record carries that the dungeon's never did; `needsRestock`
is `stockedDate < today`, so a `d` of 1e15 froze a shelf's restock for
ever, a `d` of 0 rerolled it on every browse, and either rode the
scene cache into the victim's SAVE and the room's memory for thirty
days. The day is projected like the list: a whole number no later
than tomorrow (the world's day is shared - a peer a day ahead has a
clock a day off, not a time machine), the RECORD refused whole
otherwise (a list without its day would land, restock and republish
over the room). **A3** - and the day only moves FORWARD: a stale close
from a window opened yesterday un-restocked a shelf the new day had
rolled, and the roll repeated. The mode hands `today` in for the
memory and for an act.

**A3 (CRITICAL) - A WINDOW PUSHED OVER AN OPEN SHELF WAS ITS CLOSE.**
The settle read "the window is gone" as `interiorOverlay !== openWin`,
and `interiorOverlay` mirrors the TOP of a STACK (ROAD-B B1) that
`mountInterior` pushes onto - so a quest popup, an inventory or a text
box over an open shelf sent the close mid-transaction, cleared
`openKey`, let a peer's word land under the live window (AUDIT WORLD4
C1's orphaned rows: an item taken twice) and moved the shelf under
both theft comparisons - a peer's purchase made this player a thief,
a peer's sale hid a theft. The stack is asked whether the window still
exists (`containsWindow`), after the frame's reconcile.

**A4 - THE KEYED SHOP FALLBACK CLAIMED NOTHING.** Without the trade art
the shop runs through `showShelfList`, which opened no claim and set
no `openKey`: a purchase was never told to the room, and a peer's word
landed under its rows - where `doBuy` spliced at `indexOf(it)`, which
was `-1` for a moved row, so the LAST item left the shelf and the
row's went into the pack. Every page of the fallback is an open now,
and a row the shelf no longer holds buys nothing.

**A5 - A RESTOCK WAS SAID BEFORE THE PROMPT (WORLD4 C6 again).** The
container arm rolled a stranger's cupboard and published it before the
private-property prompt, so a player who answered No - DFU's "No
claims nothing" - had already made the cupboard the room's. A restock
is said where the window mounts: `interiorLootOpened` takes the arm's
word that this open rolled the new day's stock, and says it as the
room's stock rather than a claim; No says nothing.

**A6/B6 - AN OWNED BUILDING KEPT A ROOM NOBODY FED.** An owner's
`_intShared` had no key, but the host still minted the room, the owner
joined it and could hold the seat, and published nothing while the
others could not. And DFU does not distinguish ships (owning one owns
them all), so two players in one hull disagreed about whether the room
existed. An owned house and ANY ship keep no room at all: the mode
reports a 0 building key and the host mints none.

**A7 - THE FIRST ACT IN A NEW BUILDING WAS DROPPED.** AUDIT WORLD B8's
window (the socket held in the cell's room for `ROOM_HOLD_MS` after
the mode names a place) is one frame in a dungeon and a room change at
every shop door now; `actSend` cleared the pending set when the SOCKET
was in no world room. The room the mode NAMES counts: the act pends
for the socket's arrival.

**B8** - a foes frame in a building's room stamped the dungeon
authority's heartbeat (`_foesInAt` is module-level and outlives a room
change); the stamp is a dungeon's alone now. **B4** - the law admitted
`interior:m1.0`, `m0.<key>` and padded aliases no end mints, rooms the
relay would pay for that no player can reach; no zero and no leading
zero in either number, for dungeons too. **B5** - the session spelt a
negative building key raw where the memory spelt it unsigned (AUDIT
WORLD34 A2 relocated to the second field); unsigned at both ends.
**B3** - the namespace of buildings is 10^18 names an attacker may
fill for `WORLD_TTL_MS` each, at 512 KiB; a shop's memory measured at
2-4 KB a shelf, so an interior room stores `WORLD_FRAME_MAX_INTERIOR`
(64 KiB) and no more, at the relay (once the key is known - the prefix
door knows no room) and at the client. **B7** - the context's stamp
could be one character (`Math.random().toString(36).slice(2)`) and a
collision refused the room's memory in silence; twelve digits always,
from the wire's one mint, for the dungeon too.

**Recorded, not paid.** (1) A forged item at its true price still
lands on a shelf - a peer selling a conjured thing, which is WORLD4's
accepted cost for a chest; the fix is a per-item provenance the wire
does not carry. (2) The seen set is per context and the memory lands
once per context (WORLD1 B7, WORLD4): a joiner inside the window
between a claim and the next publish, or a host handed the seat with
a `seen` the acts never reached, can carry a stale list forward; the
exposure is larger for a building (a shop door is a room change) and
the cure is a per-key memory law, WORLD1's to change. (3) The scene
cache writes the room's lists as this player's own, so an offline game
carries a shop as the room last showed it - the world as last seen,
which is what a cache is; the poisoned day (A2) was the harm, and it
is bounded. (4) Bookshelves, treasure piles, dropped piles, interior
foes and guards, and a same-day double restock stay as WORLD6a
recorded them.

**Pinned** in `test/auditworld6a.test.js` (6): the root executed
through the bag (A1), the price floor (B1), the day's bound and
direction (A2/B2/A3), the law and the interior's cap at the relay and
the client (B3/B4/B5), the stamp (B7), and A3-A7/B6/B8 by source. The
WORLD1, WORLD4, WORLD5, WORLD6, AUDIT WORLD34 and AUDIT WORLD5 pins
restamped where the law moved.

## WORLD6b (2026-09-14): the cell streams its foes

**Mac: "Continue"** (after AUDIT WORLD6a). The second item of the WORLD6
plan, in two halves; this is the first. The plan said "the cell is a
world room", and the survey said why it cannot be one the way a
dungeon is: a dungeon is a LAYOUT every client builds alike, so its
foes have an index the room can name and a host can own the lot; the
open country's room is a sixteen-pixel CELL, and nothing in it is
built alike - every encounter foe was one client's roll, near that
client, on terrain only the clients near it have built, freed with
the map pixel. So a cell has NO HOST SIMULATION and NO MEMORY (it is
no world room, `isWorldRoom` is untouched), and the law is per foe:
**A FOE IS ITS SPAWNER'S.** The spawner steps it and streams it,
everyone else in the cell puppets it, and a blow on another's foe
goes to its OWNER as a hit. What one player meets, everyone sees and
can fight; what nobody is near, nobody simulates.

### 6b-i: a foe is its spawner's, everyone else's puppet

- **The wire** (`src/net/wire.js`, both ends through `relay.js`):
  `isCellRoom` (`world:<x>,<y>`, the cell `worldRoom` mints, up to
  three digits each), `streamsFoes` (a world room or a cell), and
  `hitOwnerOf` - a cell's hit carries the owner's id as `to` (a peer
  id of at most 64), and names nobody otherwise.
- **The relay** (`server/src/index.js`, `RELAY_VERSION` `world62` -
  REDEPLOY): a cell's foes frame is admitted from ANYONE hello'd - at
  the door before the parse (the prefix's own bucket, no strike
  counted, AUDIT WORLD2 A3/A4) and in the arm - and fanned to everyone
  else with the sender's id under the room's byte budget (A5); a cell's
  hit goes to the ONE socket `to` names, never the striker's own, and
  nowhere without a `to` or to one not in the room, under the room's
  hit funnel (A6). A world room keeps WORLD2's host law untouched: a
  joiner's stream ignored and counted, the hit to the host whatever
  `to` says. A cell still keeps no memory (a large frame outside a
  world room is refused, AUDIT WORLD A1).
- **The session** (`src/net/online.js`): in a cell `sendFoes` is
  anyone's (no seat asked), `sendHit` needs a `to` that is a peer and
  never me (my foe is my own door's), `onFoes` hears every peer (never
  myself, never a malformed frame), `onHit` hears a blow that names me
  and no other. The join line says what a cell shares.
- **The encounter pool** (`src/scenes/exteriorFoes.js`): every foe of
  MINE carries `seq` (numbered from one) and streams in WORLD2's own
  record (`i t x f y h d a m` - the feet through the world host's
  converter into the WORLD frame, the pose's own law, AUDIT ONLINE D7;
  the attack count with the ranged bit low) - the changed ones every
  `FOES_MS`, every one every `FOES_FULL_MS`, keyed to the room; a
  quest's foe never rides (Multiplayer.md's first lock), a puppet never
  rides. A peer's record stands here as a PUPPET (`f.puppet` the owner,
  `f.seq` the owner's number) through the pool's ONE spawn chain at
  the streamed feet, species and gender (the bit decoded, no roll),
  OUTSIDE my cap (`activeCount` is mine alone); a frame no newer than
  the owner's last, or another cell's, is not the world; a corpse I
  never saw stands nothing. The puppet branch in the foe loop (before
  the senses, the cull, the attack) eases the feet to the stream
  (`PUPPET_EASE_S`), snaps a far jump, sets the yaw, walks while the
  streamed feet move, fires the hurt one-shot on a health drop and the
  strike edge once per count, draws and sounds like any foe, and drops
  both damage latches unconsumed - it lands no blow of its own (its
  owner's foe lands those, on its owner). A blow on a puppet goes to
  its owner through the one damage door (`damageFoe` diverts before
  the shield pool: `{to, i, dmg, kind}`), the striker's own ring,
  blood and pain played before it as ever. A peer's blow on MY foe
  (`applyHit`, by my number, bounded, the kind kept) lands through the
  same door as the dungeon's does (WORLD2/AUDIT WORLD2 B9/C4): seen and
  heard at the owner, no HUD mark of mine, no area wake, no ally
  revert, the foe turned on me - its owner - since the striker's feet
  are not on the hit (recorded, as the dungeon's is). A puppet dies
  where the stream says (its body through `mintCorpse`, the one home
  the dungeon's law asked for - carrying none of my loot), and is
  swept when a full frame stops naming it, its owner leaves the room
  (`pruneOwners` from the session's peer map, every frame), or the
  room changes (`clearPuppets`, the owners' frame numbers starting
  over); nothing of a puppet rides my save (`snapshotWorld`).
- **The world host** (`src/scenes/world.js`): the stream's cell arm
  asks no seat and sends the exterior pool's frame above ground alone;
  a cell's foes and hits route to the pool, a world room's to the
  dungeon (a cell's frame is no dungeon heartbeat); the net is
  installed once with the two frame converters; the pane says towns
  and the open country share the creatures that find you.
- **The day's rolls are the shared day's** (`src/systems/worldTick.js`
  `dayRollsFor`): under the shared clock the price walk and the faction
  powers' two arms draw from a generator the world's day seeds (the
  weather's own law, WORLD5 `rollsFor`; the two power arms of one
  minute share one generator, so the 266-day double walk does not
  replay itself), so two players whose state agrees walk the region
  alike, whatever their own dice; offline the caller's. The STATE
  stays each player's - the prices and the powers live on the entity,
  DFU has one player; one economy is the region as a world (6b-ii).

### 6b-ii: the foe hunts every player in the cell

**Mac: "Continue"** (after AUDIT WORLD6b). WORLD3's law for the dungeon
host's foes, per owner: MY foe hunts every player in the cell, and a
peer's copy of it hunts the peer.

- **The peers ride MY foes' target machine** as candidates minted off
  the pose stream (`peerCandidates` in the pool, off the net's `peers`
  - the one closure the dungeon host reads, `peersNear`; one identity
  per id, so the machine's reference compares hold; a peer the net no
  longer lists is dead to the machine and dropped). The attack and the
  cast aim at the target's OWN feet (`_targetFeet`: the local player,
  a peer at its feet, a foe at its motor's); every site that meant ME
  reads `isLocalPlayerTarget` (the alert, the death's alert clear, the
  shaft's player arm). A puppet is never a candidate (AUDIT WORLD6b B8).
- **The record carries the target** (`g`: '.' me, an id a peer, ''
  none - WORLD3's spelling, in `validFoeRecord`'s law).
- **A PUPPET whose streamed target is ME resolves its owner's foe's
  blow here** - the mobile's damage frame through the one player arm
  (`resolveFoeMeleeVsPlayer`, factored out of the loop: my reach and my
  yaw cone read off the streamed pose by the senses as observation,
  Dodging tallied, my own stats, the riders, the hurt and the flash),
  and its shaft flies at me for real; at another peer the frame is
  dropped and the shaft names the peer's candidate (the flight lands
  only on the foe it names - one that pays nothing); at its owner
  ('.') neither. A streamed target is the owner's word that the foe is
  fighting somebody (AUDIT WORLD3 D2): a passive one turns hostile
  here, or every blow would be a miss.
- **MY foe's blow at a peer is the peer's to resolve**: here the
  swing's voice alone, nothing on me, no Dodging of mine.
- **A peer's hit on my foe carries the striker's feet (`p`, the world
  frame - bounded as a pose is, then this scene's) and the blow's
  direction (`d`, a unit vector or nothing; a spell knocks nothing,
  verbatim - AUDIT WORLD3 F2's law)**: the foe turns on the striker's
  CANDIDATE at those feet (`handleAttackFromPlayer`'s peer arm names
  the peer, the dungeon's spelling) and the shove goes the way the
  blow went. The divert out spells both.
- ~~**No cast at a peer** (6b-iii): a foe whose target is a peer does not
  cast - the cast at a peer is the puppet's to cast at the peer (the
  dungeon's `c`/`s`), and the pool's caster is the owner's own still.~~
  Superseded by 6b-iii(a): the foe casts at the peer it hunts (AUDIT
  WORLD6b-iii(a) C7 struck this line - two live laws contradicted).

Pinned in `test/world6bii.test.js` (5), EXECUTED: the wire's target
law; my foe picking the peer off the machine (the identity, the live
feet, the record's `g`, its blow at the peer landing nothing on me, the
peer gone dead to the machine, a puppet never a candidate); the
puppet's blow at me (Dodging tallied, the hostility the owner's word,
at another dropped, the shaft at me, at a peer's body and at nobody);
the hit's feet and direction in (the striker's candidate, the seeded
feet, the shove, the bounds, the spell) and out; the hosts by source.

### 6b-iii(a): the cast at a peer

**Mac: "Continue"** (after AUDIT WORLD6b-ii). WORLD3's cast law for the
dungeon host's foes, per owner, with the audit's bounds.

- **The owner's foe casts at the peer it hunts.** The decision runs as
  at me (AUDIT WORLD6b-ii A1's law: never gated off, or the pick
  latches and the stand-off band roots the foe - the audit's
  suppression arm is RETIRED, superseded; the tick was the pay-out),
  reading no effects of mine (`PEER_CAST_TARGET`: a peer's effects are
  none to the pick); the missile leaves toward the peer's transform
  (the executor takes `aimAt`, the world host's hook aims where it is
  told and at me otherwise); an area cast blasts the foes around the
  caster ~~and puts nothing of mine in its sphere (I am not its
  target)~~ - AUDIT WORLD6b-iii(a) A1/C4 struck that: my capsule is a
  collider in every sphere, whoever the caster hunts (the null guarded
  an arm the pick never reaches and bought a free safe stand). The
  cast rides the record - `c` the count, `s` the spell (WORLD3's
  spelling), and since the audit `u` whom it was at - in the wire's
  law.
- **The puppet at me casts the spell itself**: a count up by one is
  one cast (a joiner latches the count it arrives with and replays
  nothing); the missile flies at me, the blast is measured against my
  capsule, ~~a self-cast lands on the puppet's own entity~~ (AUDIT
  WORLD6b-iii(a) B2: a puppet takes no damage in this pool - its
  owner's word is its health - and its self-cast is nobody's blow);
  UNDER the owner's blow budget and the leap gate (AUDIT WORLD6b-ii
  B1/C1: a cast is a blow - the same bucket); at another peer or at
  nobody its Spell one-shot alone.
- ~~The dungeon's own cast at a peer (`castEnemySpell` there) still
  aims its missile at the host and hands the peer's feet to the blast
  - recorded for the dungeon's next audit.~~ The dungeon's missile
  aimed itself at the peer in flight all along (WORLD3's `aimFoe`
  arm); what it handed was the PEER's feet as the blast's probe for
  the LOCAL player - paid by AUDIT WORLD6b-iii(a) C2.

Pinned in `test/world6biii.test.js` (4), EXECUTED: the wire's c/s law;
the owner's cast at a peer (the decision run against the stand-in,
the missile's aim point, the blast with nothing of mine, the count and
the spell on the record, at me the hook's own aim and my feet); the
puppet's cast at me (the joiner's latch, once per count, the missile
and the blast, the one-shot at another and at nobody, the budget, the
leap); the hosts by source.

### 6b-iii(b): the cell seam

**Mac: "Continue"** (after AUDIT WORLD6b-iii(a)). D9's strip: the cell
is sixteen pixels and the relay's range three, so two players a pixel
apart astride a cell edge were in two rooms and saw nothing of each
other - a three-pixel strip along every edge where the country went
empty.

- **The halo.** A player hellos into every neighbouring cell room whose
  nearest pixel is within RANGE_PIXELS of its own (`cellHaloFor`, the
  wire's law: Chebyshev as the fan is; none mid-cell, one along an
  edge, three at a corner; a held room stays a pixel past the range -
  the hysteresis that keeps a player pacing the edge from churning
  sockets). A halo room is posed into (its fan ranges me by the pose,
  its roster places me) and listened to (its roster, a peer's foes, a
  blow at me, a line), never streamed to: by symmetry everyone within
  range of me is a member of MY cell's room, so my foes, my chat and my
  pose through my own cell reach every peer in range.
- **One roster.** The session's `peers` merges every room held (a peer
  stays while any room reports it, goes when the last does); a frame
  from a halo room places its peers and carries their foes and blows;
  the host, the clock and the memory are my own room's alone.
- **A blow through the owner's cell.** A foes frame is keyed to its
  owner's cell (`k`); the pool accepts one keyed to any cell I hold
  (`inRoom`) and remembers the owner's; my hit on that owner's puppet is
  keyed to the OWNER's cell and sent through that room's socket, where
  the owner is reported - the relay routes `to` inside one room. AUDIT
  WORLD6b-iii(b) A3: the key is a PREFERENCE - the owner is struck where
  it is reported (its cell, my own, any halo), since a crossing makes
  the key stale for a foes interval; and a blow at MY foe keyed to any
  cell I hold is mine (C1).
- **The crossing.** A step into a cell already held as a halo PROMOTES
  its socket in place: no close, no reconnect, no roster wiped, and the
  puppets stand (the seam is no room change to them; the prune takes
  back any whose owner the hunt no longer sees); the cell left steps
  down to a halo until it is out of range. A new cell still hears every
  foe of mine at once (the full frame). AUDIT WORLD6b-iii(b) B1/B8: the
  join is at ONCE when the cell is held (the 500 ms hold bought a strip
  with no socket in the cell stood in), the cell stood in is wanted
  until the join, and a LIVE halo alone is promoted (A1).
- **No relay change**: a halo member is a member; the door's budgets,
  the roster cap and the ranged fan apply to it as to anyone. A dropped
  halo socket is retried on the session's clock; a terminal close ends
  the halo (the primary hears the same verdict on its own).

Pinned in `test/world6biiib.test.js` (4), EXECUTED: the wire's geometry
(mid-cell, an edge, a corner, the hysteresis, the map's edge); the
session over fake sockets (the halo hello'd and posed into, the merged
roster, a peer's foes and blow and line through it, foes and chat
through my own cell alone, a hit through the owner's cell and refused
elsewhere, the promotion, the halo left, leave closing all, the retry,
no halo outside a cell); the pool (a frame keyed to a held cell stands
its puppet, one to an unheld cell does not, my blow keyed to the
owner's cell); the world host by source.

## AUDIT WORLD6b-iii(b) (2026-09-14)

**Mac: "Audit".** Three opus lenses over the cell seam - A the session's
halo, B the geometry, the relay and the world host, C the pool, the
hits and the hunt across the seam. Every finding verified against the
code; paid at the root; pinned by execution in
`test/auditworld6biiib.test.js` - the session driven in the world
host's OWN frame order, which the slice's pin never was. No relay
change.

### The critical

- **B1 (critical, paid): the world host closed the halo of the cell it
  was entering on the crossing frame, so the promotion never fired.**
  The wanted list is the new pixel's: `cellHaloFor` names neither the
  pixel's own cell (the one stepped into) nor, after `setHalo`'s own
  filter, the cell left (my own) - so on the crossing frame, inside the
  500 ms hold, the halo the promotion was for was closed, and the join
  after the hold found no halo and took the old leave-and-reconnect:
  both sockets closed, two opened, the roster wiped, `status` off
  'open' and so every puppet pruned. The record's crossing was
  reachable from the pin alone. Paid: the cell stood in is wanted
  until the join (`wantHalo.push(key)`), and a cell already HELD is
  joined at once - the hold (AUDIT WORLD2 C8's, against a world room's
  churn) bought a cell crossing nothing but a strip with no socket in
  the cell stood in (B8). Executed in the host's own frame order:
  two sockets across the crossing, neither closed, nobody wiped.

### A - the session

- **A1/B7/C2 (high, paid): a promotion onto a dropped halo demoted the
  live socket.** The guard tested the entry, not its socket: a halo
  pending its retry (ws null) handed a dead socket to the primary, and
  the next `setHalo` (keyed on `this._ws`) closed the good one - the
  player offline in both cells for a backoff. A LIVE, OPEN halo alone
  is promoted; a stale entry is dropped and the ordinary join stands
  the cell's socket at once.
- **A3/C1/B6 (high, paid): a blow keyed to a cell the owner had just
  crossed out of was refused for a foes interval, silently.** The hit's
  `k` was a veto (the owner had to be reported in that room) and the
  owner's `applyHit` demanded its own cell exactly; the pool discards
  the divert's verdict. The key is a preference: the owner is struck
  where it is REPORTED (its cell, my own, any halo; refused only when
  no held room reports it), and a blow at my foe keyed to any cell I
  hold is mine.
- **A2 (high, paid): a halo's terminal close was re-opened every
  frame.** The entry was deleted, `setHalo`'s only idempotence was the
  entry's presence, and a refused hello became connect-hello-refuse at
  the wire's rate against a shared hello gate. The verdict is
  remembered (`status: 'terminal'`, no socket, no retry) until the room
  leaves the wanted set.
- **A4 (medium, paid): the primary's terminal close left the halos
  posing my ghost** and standing puppets I could not strike back; the
  record claimed the opposite direction only. One door (`_endHalo`)
  for `leave` and both terminal closes.
- **A5 (medium, paid): the halo's life hung on the primary's socket.**
  A one-second blip closed every halo, wiped the seam's roster, lost
  the hysteresis and re-hello'd the neighbours on the way back - the
  churn the slack was written against, by the back door; and the pose
  fan sat behind the primary's send. The want-set is the ROOM's
  (`isCellRoom(this.room) && !this.terminal`), and the pose goes
  through every open socket.
- **A6 (medium, paid): a demoted primary kept a stale status** ('error'
  after a relay error frame, its close on its way) - a zombie halo,
  never posed into, never retried, never closed. The demoted entry's
  status is the socket's: open, or connecting.
- **A7 (medium, paid): a halo stuck connecting was immortal**, and a
  socket that could not be made was nothing (re-tried every frame).
  Stamped `since`; past the longest backoff it is dropped and retried;
  a failed constructor is an entry with a retry.
- **A8 (declined): the merged roster past ROSTER_MAX.** Bounded at four
  rooms' worth; the per-frame cost is a lerp per entry and the fans are
  ranged by the relay, so a far entry is static. Recorded, with AUDIT
  WORLD6b's ROSTER_MAX residual.
- **A9 (note, paid): dead code** - `_holder`, `_heldElsewhere`'s unused
  parameter, `_bind`'s ignored argument. Gone.
- **A11 (note, recorded): a promotion consumed the new cell's welcome
  as a halo** - no host, no clock offset from it. A cell reads neither;
  the relay does seat a host in a cell room, inert at both ends.

### B - the geometry, the relay, the world host

- **B2/B3 (verified): the halo's lattice IS the fan's.** Map pixel x is
  floor(worldX / PIXEL_UNITS) and y its 499-flip, over 200 000 poses; a
  cell's sixteen map rows are sixteen consecutive world rows; Chebyshev
  is flip-invariant; `cellHaloFor` matches a brute-force nearest-pixel
  law over a four-cell window; the symmetry law (everyone within range
  holds my cell) held over 200 000 pairs. Off the map `trunc` and
  `floor` differ by one pixel - unreachable in the placed world.
- **B4 (note, recorded): no relay change**, verified by diff; but the
  seam's population now shares a cell's ROOM budgets (the foes fan's
  bytes per second, the roster and socket caps) with its neighbours'
  seam members, and a halo member can be elected the host of a cell it
  only borders (inert). The client sends one pose to up to four
  sockets at a corner.
- **B5/C3 (high, paid): an unanswerable roster pruned every owner.**
  `peersNear()` answers null while the socket is not open, and `?? []`
  read that as nobody: every owner and every puppet swept every frame
  while the halos - independent now - kept feeding frames, a
  spawn-and-discard loop per foe per frame (six builds for six frames
  in the probe). No answer is no prune; the stale sweep still reaps a
  quiet owner.
- **B9 (low, paid): the geometry pin never told max from min** - the
  diagonals were all (1, 1). Pinned at (3, 4) and (3, 3), and the y
  reach.

### C - the pool, the hits, the hunt

- **C5 (medium, paid in part): a promotion sends no hello, so the look
  composed for the crossing was dropped** - peers in the new cell saw
  the gear worn when the halo opened. The look is composed before a
  halo opens (the host's frame); the residual (gear changed within the
  last pixels before the edge) is recorded - a look travels in a hello
  alone.
- **C6 (low, paid): the same pose through two rooms restarted the
  ease** (and a halo's welcome walked a peer back once). A pose within
  a hair of the last is seen, not re-eased.
- **C7 (verified): the frame's `k` is unvalidated on the wire but
  unstorable** - `inRoom` admits only a key I hold.
- **C8 (note, recorded): the halo is silent on the HUD** - a halo that
  refuses to connect is never said; `statusLine` is the primary's.

Pinned in `test/auditworld6biiib.test.js` (6), EXECUTED: the crossing
in the world host's own frame order (the halo kept on the crossing
frame, the join at once, nothing closed, nobody wiped, the old cell
held on and then let go); a dropped halo not promoted and the ordinary
join at once, a demoted primary stepping down as connecting; a halo's
terminal close remembered and cleared once out of range, a primary
blip ridden out with the pose through the halo, a stuck halo dropped
and retried, the primary's terminal close ending every halo; the blow
struck where its owner is reported and refused only when nowhere, the
pool taking a blow keyed to a held cell, the duplicated pose seen not
re-eased; the diagonal and the y reach; by source the host's join, the
wanted cell, the look, the prune, the session's doors, the records.

### 6b-iii(c): a puppet's corpse loot

**Mac: "Continue"** (after AUDIT WORLD6b-iii(b)). A puppet's body was
its owner's and nobody else's ("no loot of this player's", WORLD6b
B14): a peer who killed my rat, or stood over the one I killed, found a
body that could not be opened. THE PILE IS THE OWNER'S ROLL, TAKEN
UNDER THE OWNER'S WORD - no per-foe room, no relay change: the take
and the grant ride the hit frame, which the relay routes by `to` and
reads no further.

- **The word.** The owner's record says how many items the body holds
  (`o`, a u8 - 0 alive, 0 once emptied; the wire's law); the reader
  latches it, and a puppet's body is a loot target while it says more
  than none (a word of none re-closes it, a later word of some re-opens
  it).
- **The ask.** A peer's take sends `{to: owner, k: the owner's cell, i,
  take: 1}` through the session's hit door (the owner's budget, the
  owner reported); nothing is taken and nothing said on the taker's
  word. A body its word says is empty is told "The body has no
  treasure." at home, no frame.
- **The grant.** The owner answers a take with `{to: taker, k, i,
  grant: [...]}` - as much of the pile as one frame carries under
  GRANT_FRAME_MAX, through WORLD4's projection (`validLootList`: an item
  the port could have minted, its price floored) - and empties the pile
  of what went ONLY once the frame left (a refused frame - the rate, the
  size - takes nothing); a larger pile goes in parts and the record
  still says it holds something. A body it no longer has, or one with
  nothing on it, answers an empty grant.
- **The landing.** The taker lands the grant through the ONE take law
  (`takeCorpseLoot` over a stand-in body: arrows taken whole, gold to
  the counter, the count said); an empty grant says the body has no
  treasure and disables it. Two takers race at the owner: the second is
  told so. A grant that is not a list, or carries an item the port
  could not mint, is refused whole.
- **Found on the way**: a killing blow that overshot left a NEGATIVE
  health on the death record, the wire refused the record whole, and
  the full frame then REMOVED the puppet - no body ever streamed to a
  peer (WORLD6b's, live since 6b-i). The record clamps `h` into the
  wire's bound.

Pinned in `test/world6biiic.test.js` (4), EXECUTED on two pools joined
by nets: the wire's `o`; the owner's body saying what it holds and the
death record in bound; the puppet's body a target; the ask routed to
the owner, nothing taken and nothing said; the grant through the
projection, the pile emptied once the frame left, the next record
saying none; the landing through the one take law with the count said,
the body no target after; a second taker told the body has no treasure;
asked again at home with no frame; a refused frame taking nothing; a
body not mine and a malformed grant; a pile larger than a frame granted
in parts; by source.

## AUDIT WORLD6b-iii(c) (2026-09-14)

**Mac: "Continue"** (after WORLD6b-iii(c)). Three opus lenses over a
puppet's corpse loot - A the owner's grant, B the taker's landing and
the world host, C the wire, the relay, the session and the records.
Every finding verified against the code; paid at the root; pinned by
execution in `test/auditworld6biiic.test.js`. The relay changed
(`world64`): the hit arm counts bytes.

### The criticals

- **A1/C7 (critical, paid): the take answered ANY peer for ANY body of
  mine by number.** No range, no roster, no sight: a peer across the
  cell - or one I could not see at all - walked the sequence numbers
  and emptied every body I killed the instant it fell. The taker's
  reach law lived at the untrusted end alone. Paid: the asker must be
  a peer the hunt SEES (`peerCandidate`) standing within the corpse's
  activation distance plus the pose's slack of the body; otherwise
  silence. **A5** with it: a quest's foe (never streamed) answers as a
  body that does not exist.
- **A3/C2 (critical, paid): a refused projection became an EMPTY grant
  that still spliced the pile.** `validLootList` answers null for a
  list it refuses (an item the port could not mint, a list past
  LOOT_LIST_MAX) and `?? []` read that as "nothing here" - then the
  pile was spliced by the count that never went: the owner's whole
  roll destroyed and the taker told the body was empty. A pile past
  sixty-four items walked into it on its own. Paid: a refusal narrows
  to the one item and DROPS it (it can never be granted), the rest
  goes; the pile is emptied of what WENT (`grant.length`). **A4/C10**
  with it: one item larger than a frame is dropped rather than
  re-offered for ever, and the click always answers.
- **B1/C1 (critical, paid): the grant arm had no "I asked" latch.** A
  grant landed for a puppet I never asked about, a body I never saw, a
  peer whose foes I did not stand - the first door in the port by which
  a peer wrote into another player's PACK. Paid: the ask latches on the
  puppet only when the frame left; a grant lands only for a body of
  that owner's asked inside TAKE_WINDOW_MS, once (**B8**: one ask in
  flight, a double-click sends nothing and a second grant is refused);
  otherwise refused whole.
- **B2/C1 (critical, paid): the projection left the stack count
  open.** One gold pile at 1e15 minted a fortune, at -5 drained the
  purse (`addGoldPieces` is unclamped by DFU's law); a negative stack on
  arrows negated the stack it merged into. Paid in WORLD4's projection
  for every consumer (chests, shelves, grants): a stack is a whole
  number in [1, LOOT_STACK_MAX] or the item is no item.

### A - the owner's side

- **A2/B3/C4 (high, paid): every take made me spend my own hit
  budget.** A take for a number invented on the spot bought a frame
  out of me for free, and six peers at their own gate exhausted my
  outgoing HIT_HZ_MAX for good - every blow I landed on a puppet
  refused at home, silently. Paid: a body I do not have, a live foe, an
  asker out of reach answer NOTHING; an answer is under the asker's own
  budget (TAKES_PER_S) - over it, silence.
- **A6/B4 (medium, paid): the projection let `equipSlot` and
  `questItem` through.** A wire-borne worn mark re-linked into the
  pack's slots on the next load and pushed my own out; a quest mark
  clogged the pack for good. Stripped in the projection: those marks
  are the receiver's, never a container's word.
- **A7 (low, paid): a record in flight at the splice re-opened a body
  the empty grant just closed.** The grant carries the owner's frame
  counter; a word no newer than it re-opens nothing.
- **A8 (verified): a forged `k` on a take is self-harm only** - refused
  unless it names a cell I hold, and the answer routes where the taker
  is reported.

### B - the taker's side

- **B5 (recorded): the landing has no weight and no pack cap** - the
  exterior's bulk take never had one (the recorded UI residue); the ask
  latch bounds the honest case to one pile per ask and the projection
  bounds the pile. The dungeon's corpse take is a window.
- **B6 (recorded): a body that vanishes under the taker says nothing**
  (its owner left, or the puppet was rebuilt - a rebuilt corpse is
  never re-stood); the ask expires in silence and the next click asks
  again.
- **B10 (note, paid): the rare-drop chime rings over a peer's body
  too** - a puppet's own pile is empty by B14, so LR3's one cue never
  rang for a grant.

### C - the wire, the relay, the records

- **C3 (high, paid, RELAY): the hit arm carried a frame's worth of
  items with no byte budget.** Since 6b-iii(c) a hit is a 12 KiB bulk
  carrier, not a 150-byte control frame; three sockets pushed 720
  KiB/s into one destination through an arm that counted frames alone
  (AUDIT WORLD3 A1's law, unpaid here). Paid: HIT_ROOM_BYTES_PER_S (256
  KiB a second, the room's) through the one byteGate the foes and the
  acts use; over it the frame is dropped, nobody struck. `world64`.
- **C5 (high, paid): the frame had no record bound.** Corpses ride
  until the pixel is left, the relay junks a frame past
  CELL_FRAME_RECORDS_MAX whole and strikes the socket out in the end -
  a player who fought in one pixel stopped streaming to everyone,
  silently, in minutes. Paid: the sender keeps the live foes first and
  the newest bodies; the oldest leave the roll and the readers' sweep
  takes them down.
- **C8 (low, paid): the dungeon's record streamed the overshoot raw** -
  a negative health onto every joiner's puppet (WORLD2's bound, never
  refused there). Clamped.
- **C9 (low, paid): a live foe with no number streamed as alive at
  zero.** A health that is no number is omitted.
- **C2's arithmetic (verified): 4 KiB of headroom is eighty times the
  relay's envelope.** The frame cap counts UTF-16 units, not bytes -
  pre-existing, recorded.
- **Back-compat (verified): an older client refuses a take or a grant
  as a blow with no damage; an older owner's bodies are never targets
  (no `o`).**

Pinned in `test/auditworld6biiic.test.js` (7), EXECUTED: the owner's
laws (a peer unseen, a peer across the cell, a body not mine, a live
foe, a quest's foe: silence; in reach the grant; the asker's budget);
the refused projection (the unmintable item dropped and the rest
granted in two takes, a pile past the list bound in parts, one item
larger than a frame dropped and the good one behind it granted); the
taker's latch (no puppet, a body not asked, a second click, a grant
past the window, inside it, a second grant, the stale record and the
newer one); the projection's stack bound and stripped marks, a
negative gold pile refused through the arm; the frame's record bound
(the live foe first, the newest bodies, the oldest gone); the Room's
hit bytes (inside the budget a grant lands, over it dropped and nobody
struck, a budget of one grant); by source the dungeon's clamp, the
chime, the omitted health, the roster read, the relay's gate, the
record.

### 6b-iii (recorded, next)

- **The guards** (`cityGuards.js`): the watch is a crime's - the
  player's own; not until the crime is shared.
- ~~**A puppet's corpse loot**: its owner's roll; the take would be the
  loot law over a per-foe room.~~ Paid by 6b-iii(c), over the hit frame.
- ~~**The cell seam**: two players a pixel apart astride an edge are in
  two rooms (D9); the 3x3 neighbourhood.~~ Paid by 6b-iii(b).
- **One economy**: the region's prices and powers as a world's.
- ~~**Buildings' foes** and the interior pools: a building streams no
  foes still (AUDIT WORLD6a B8).~~ Closed by 6b-iii(d): none, by the
  lockbook - not an omission.
- ~~The striker's poison and disease riders on the hit; the roster's
  `ROSTER_MAX` bound (AUDIT WORLD6b).~~ Paid by 6b-iii(e): the poison
  and the shaft ride the hit; a stranger beyond the welcome is asked
  for (`who`). The disease rider was never a player's (the monster's
  alone, `onMonsterHit`) - the wording was over-broad.

### 6b-iii(d): buildings' foes - none, by the lockbook

**Mac: "Continue"** (after AUDIT WORLD6b-iii(c)). The plan carried "a
building streams no foes still" as the last 6b-iii item that stood on
its own. Read against the code and the locks, it is not a gap:

- **A building interior carries no static enemies in DFU** (the IF
  record, Characters-Arc: DaggerfallInterior's marker vocabulary is
  `Rest, Enter, Treasure, LadderBottom, LadderTop`; the layout chain
  mints none). The interior pool is a HOME, not a spawner, for exactly
  three things: a quest's CreateFoe, the Daedra summoning's punishment,
  and the watch called into it.
- **Each of the three is the player's own by a lock already written.**
  A quest's foe is the quest owner's alone and never rides
  (Multiplayer.md's first lock, "quests stay separate" - the dungeon's
  stream skips its quest foes for the same reason); the summoning's
  punishment is the summoner's own trial; the watch is a crime's, and
  the crime is not shared (the guards item, above).
- So a building's room streams nothing and lands nothing - the world
  host streams a world room's frame from the dungeon alone and lands
  one on the dungeon alone (AUDIT WORLD6a B8 already keeps a building's
  frame off the dungeon's heartbeat) - and no net is installed on the
  interior pool. The day the crime or a quest is shared, the pool is
  ready: it is the exterior pool's own factory, puppet arm and all.

Pinned in `test/world6biiid.test.js` (1), by source: the interior
pool's spawn sites are the summon's, the quest's and the enchant
replace alone; no net on it; the world host's frame out and in are the
dungeon's; the fact and the lock in their records.

Pinned in `test/world6b.test.js` (8), EXECUTED: the wire at both ends;
the real Room fanning a non-host's frame in a cell and routing a hit
to `to`, the dungeon's law untouched; the session's four doors in a
cell and in a world room; the pool on a crafted MONSTER.BSA with the
net installed - my frame out, a peer's puppets in (the spawn chain,
the cap, the stale and foreign frames, the eased and snapped follow,
the hurt and the strikes, the divert, the death and the three sweeps),
a peer's blow on mine (the door, the bounds, no area wake); the day
change under the shared clock; the world host by source. The WORLD1,
WORLD2, WORLD5, WORLD6a, AUDIT WORLD (A1), WORLD34, WORLD4, WORLD5,
WORLD6a pins restamped where the law moved; the pool's provenance,
latch, voice and hostility pins (audit24/26/58, pacify, roadb, nt2)
restamped for the peer arm.

### 6b-iii(e): the striker's rider and the roster's bound

**Mac: "Continue"** (after WORLD6b-iii(d)). The two residuals AUDIT
WORLD6b recorded and did not pay, each standing on its own.

**The striker's poison.** FormulaHelper inflicts a poisoned blade's or
shaft's dose INSIDE the damage calc and clears it from the weapon
either way (`formulas.js` :682-686, the `onInflictPoison` seam), so at
a puppet the dose ran on the local shadow's entity - an entity nobody
reads - and the owner's foe never felt it; the dose was spent for
nothing. Now:

- **The pool has ONE poison door, `poisonFoe(f, pt)`** (the exterior's
  and the dungeon's twin): a foe of mine is dosed there, through the
  pool's own uniform seam (ENGINE-PRNG RULE); a PUPPET's dose is set
  aside on the foe (`_divertPt`) and spent by the blow's divert, which
  the same calc's damage reaches next. The melee chain
  (`resolvePlayerHit`'s hook) and the shaft (the hosts'
  `playerArrowHitFoe` hook, routed by pool as the damage door is: the
  watch dosed at the host, a pool foe through its door; the interior
  host splits by `_encounter`) both go through it.
- **The hit carries it** - `pt`, a whole number inside
  ItemEnums.Poisons (`hitPoisonOf`, 128..139; `HIT_POISON_MIN/MAX`
  pinned equal to poisons.js's own bound so the worker's bundle carries
  no systems import). The dose is the CALC's word: FormulaHelper doses
  on the calc's `damage > 0`, and the Strikes payload can zero the
  number after it (AUDIT WORLD6b-iii(e) A3 - the slice gated the rider
  on the final number and dropped a spent dose). The owner lands it as
  FormulaHelper lands it: inside the blow, before the health moves,
  the foe's OWN saving throw rolled where the foe is real; outside the
  enum nothing (DFU's `startPoison` registers nothing for it either).
- **The shaft, too.** The exterior's arrow blow said `kind: 'melee'`
  (the hosts' `dealDamage` passed no kind) and the puppet's local copy
  took the Arrow. Now the kind rides and the hit carries `ar: 1`, and
  the owner's copy lands the Arrow where BowDamage puts it - after the
  damage, for every shaft that CONNECTED (:145-147 is outside the
  damage fork; WORLD3's spelling for the dungeon's hit) - the zero blow
  carrying its kind since AUDIT WORLD6b-iii(e) A2, and the landing
  bounded (`HIT_ARROWS_MAX`, A1). The body's pile says so (`o`) and the
  grant carries it back.
- **The disease rider is the MONSTER's alone.** `onMonsterHit` rides
  the weaponless monster arm (`!attacker.isPlayer`) and nowhere else;
  a player's blow carries one rider, the poison. AUDIT WORLD6b's
  "poison and disease riders" was over-broad - pinned by source, the
  record amended.

**The roster's bound.** `ROSTER_MAX` (64) bounds the WELCOME - the
nearest, AUDIT ONLINE A5's bill bound - not the room, which holds
`SOCKETS_MAX` (256). A member beyond the welcome was unseen for good:
its poses dropped (no peer to place), its foes refused (AUDIT WORLD6b
A8/C6), its blow's striker unknown to my foe. Every later joiner is
announced (`join`), so the gap was exactly the members present before
me and beyond the nearest 64. Now the stranger is learned from the
relay's own traffic:

- **`who`.** A frame from an id I hold in NO room - a pose, a foes
  frame in a cell, a blow that landed in a cell - asks the relay for it
  by name through the socket the frame came on (`_askWho`), once per
  `WHO_RETRY_MS` (10 s) per id and `WHO_HZ_MAX` (5, after AUDIT
  WORLD6b-iii(e) B5) a second in all; an ask the gate or a dead socket
  refused is not marked, so the next frame asks; the asked list goes
  with the room (B4). The relay relays only a hello'd socket's frames,
  so a stranger's frame is the relay's word that it is a member.
- **The answer is its JOIN**, to the asker alone - the member's hello
  name and look (from storage) and its latest metered pose - the frame
  the session already reads; its next pose is placed and its foes are
  heard. A name that is no hello'd socket in the room, or the asker's
  own, answers nothing and is junk (AUDIT WORLD2 A4's instrument, a
  stream struck out); a channel answers nothing; the asks ride their
  own bucket at the relay (`_meterWho`, the same strikes) and
  `parseClient` admits the frame from a hello'd socket alone. The
  roster stays the welcome's size; a member is asked for only when it
  is heard.

Relay `world65` (`world66` after the audit). Pinned in
`test/world6biiie.test.js` (5), EXECUTED:
the wire's bounds and one home at both ends; two pools (the striker's
dose at a puppet not on the shadow but on the hit with the kind and
the shaft, spent once, the owner dosing its foe inside a damaging blow
and landing the Arrow for every connecting shaft, nothing outside the
enum or on a blow of no damage, the owner's own dose direct); the
session (a stranger's pose, foes and blow ask once per retry under
the gate, a peer and my own never, the join answer making a peer whose
pose is placed and foes heard, the ask on the halo's socket, a dead
socket marking nothing); the real Room (the answer to the asker alone
with the latest pose, nobody and one's own name junk, a channel
silent, the asks' own bucket, a socket not hello'd refused); by source
the hosts' doors, the dungeon twin and the monster-only disease rider.
Restamped: world2/world3 (the dungeon divert), world6b/world6bii (the
arrow hit's `ar`), auditworld6b (the divert's gate), auditworld2 (the
parser's doc), audit39_worldmodes (the interior arrow's kind),
c2combat (the poison pin reads the one door), the relay version pins.

## AUDIT WORLD6b-iii(e) (2026-09-14)

**Mac: "Continue."** Three opus lenses over the striker's rider and the
roster's bound: A the pools' poison door and the hit, B the wire, the
relay and the session's `who`, C the dungeon twin, the records and the
merge. Twenty-six findings; fourteen paid, the rest recorded. Every
paid one is pinned by EXECUTION in `test/auditworld6biiie.test.js`
(6) where a rig can reach it, by source where it cannot.

### The majors

- **A3 (major, paid): the dose was gated on the wrong number.**
  FormulaHelper doses on the calc's `damage > 0` and clears the weapon
  (formulas.js :682-686); the Strikes payload runs AFTER it at the
  tail and can zero the number (LowDamageVs -5, clamped at 0). The
  slice's divert sent `pt` only when the FINAL damage was positive, so
  a poisoned, enchanted blade against a matching affinity spent its
  dose at the shadow and the owner's foe never felt it; and when a
  damaging divert had already gone that frame, the zero door skipped
  `damageFoe` and the dose set aside rode the NEXT blow - a bare fist
  a frame later carried a poison. Now the dose is the calc's word at
  both ends (the divert sends it whatever the number, the owner lands
  it whatever the number - bounded by `startPoison`'s own law: twelve
  poisons, a live one refused again), and the zero door spends a dose
  it does not send. Executed.
- **A1 (major, paid): the hit's `ar` minted Arrows without bound.**
  The owner added one Arrow per `ar: 1` frame with no damage gate and
  no cap; the relay funnels sixty blows a second onto one socket, so a
  crafted stream stacked thousands into a live foe's pile - free loot,
  and past `LOOT_STACK_MAX` the projection refused the item whole and
  the grant DROPPED it, so the pile was gone for every honest taker.
  `HIT_ARROWS_MAX` (255) a body from peers' shafts, both twins;
  executed to the bound.
- **B1 (major, paid): `who` was the one arm past the hello that read
  storage, per ask, for free.** Every other ingress arm carries a
  room-wide budget; this one carried a per-socket gate alone and did a
  storage read per answered ask - a full room of self-minted sockets
  asking at their own rate was 1280 reads a second out of one object,
  indefinitely, with nothing to strike (a real member answers, so no
  junk). Now the room's own budget (`WHO_ROOM_HZ_MAX`, 60 a second,
  every asker together, over it dropped and nobody struck) and the
  looks kept on the instance from the hello (a repeat ask reads
  nothing; after a hibernation the storage's copy once, then kept).
  Executed: two asks, no read; after a wake, one.
- **B2 (major, paid): the answer's pose crossed the range law.** The
  pose fan says a member's position only within `RANGE_PIXELS`; the
  answer said it for anyone named - the welcome's sixty-four ids
  became a live position feed over the whole cell, a radar the fan
  was built to deny. Now the pose rides within range alone (a
  stranger heard through the fan is in range by construction; a room
  without the law says it). Executed.
- **C1/A2 (major, paid): the zero blow's kind.** The record claimed the
  Arrow lands "for every shaft that CONNECTED"; a shaft that landed
  nothing reached the owner through the zero door as a SWING (no
  kind, no `ar`), so its Arrow was lost and the owner told wrong.
  `attackFromPlayer` takes the kind; the hosts pass the shaft's.
  Executed.
- **C2 (major, paid): the dungeon had no zero-blow door.** AUDIT
  WORLD6b-ii B4's `attackFromPlayer` was the exterior's alone: the
  dungeon's melee zero arm and its arrow hook called
  `handleAttackFromPlayer` directly, so a zero blow at a puppet woke
  EVERY foe on my screen (puppets included - hostility is not on the
  wire, so it never healed) and told the host nothing (WORLD2 B13
  unpaid underground). The door, the dungeon's; the flight says what
  landed so a damaging shaft sends no second frame.

### A - the pools

- **A5 (note, paid):** the dose is read inside the provenance gate -
  a fall's or a foe's door on the puppet leaves it. Executed.
- **A8 (minor, paid):** the melee chain is EXECUTED now through
  `resolvePlayerHit` (a fake weapon standing in for
  `playerWeapon.resolveHit`'s contract): the hook, then the results
  loop reaching the divert with the dose on it.
- **A4 (note):** the sender gated on the raw damage and the owner on
  the rounded - moot now that neither gates.
- **A6 (note, recorded):** the dungeon's `inflictPoison` rides
  `Math.random` (its whole pool does, by its own note); the exterior's
  `rolls` seam is `Math.random` in production too - the rule is a
  test seam, not a stream.
- **A7 (note):** the foe-vs-foe arm's `damageFoe(t, d, null, ffwd)`
  fallback defaults `fromPlayer` true, but every pool foe carries
  `hurtFromFoe`, so the fallback is dead for pool foes. Fine as is.

### B - the wire, the relay, the session

- **B3 (minor, paid):** a name that left between the frame that asked
  and the ask is the honest race, and it was JUNK - a counter that
  never decays, two hundred of them closing the socket. Junk is one's
  own name alone now (the parser refuses a bad one); a name gone
  answers nothing. Executed.
- **B4 (minor, paid):** the asked list goes with the room - `leave`
  and a crossing clear it (an answer lost in the last cell held the
  stranger unseen for `WHO_RETRY_MS` in the next). Executed.
- **B5 (minor, paid):** `WHO_HZ_MAX` 5 - a halo let go drops every
  peer it alone held, and their puppets with them; re-learning twenty
  at two a second was ten seconds of empty ground.
- **B6 (minor, paid):** `parseClient` checks the name as it checks
  every scalar ("what the relay refuses the client never sends") - a
  bad one is an error, not a frame. Executed.
- **B9 (note, paid):** the socket asked for is read again after the
  storage await (input gates make it moot today; a ghost join after
  a leave if they ever were not). By source.
- **B7 (note, recorded):** the striker's ask runs after `onHit`, so a
  stranger's FIRST blow wakes my foe with no candidate (AUDIT
  WORLD6b-ii A3's law); the pose branch heals it within a frame.
- **B8 (note, recorded):** the merged roster's guard is `peers`, so a
  peer known through a halo alone is not asked for in the primary;
  when the halo lets it go, its puppets pop and the next frame asks -
  a one-round-trip flicker where there was a permanent loss.
- **B10 (note, recorded):** the rig's attachment cap is 16 KiB; the
  runtime's is 2 KiB. The worst attachment measures 796 bytes, so
  nothing breaks, and `_setAttach`'s refusal is read at the hello
  alone - a cap the rig cannot exercise.

### C - the dungeon twin, the records, the merge

- **C3 (minor, paid):** the "monster's alone" pin reads
  `src/combat/pcaao.js` too (its core's `onMonsterHit` sits in the AI
  arm, past the player and class-enemy arm).
- **C4 (minor, paid):** a pin that passed either way (the same poison
  twice) replaced by one that does not.
- **C5 (minor, paid):** the restamped list names c2combat.
- **C6 (minor, paid):** "a blow that landed" is a cell's; a dungeon's
  stranger is asked for by its pose.
- **C7 (note, paid):** two cites the shift carried stale
  (`exteriorFoes.js`'s export line in Audit-58 and roadg_pools; the
  notebook's three sites in UI-Arc) re-resolved by hand.
- **C8 (note, recorded):** BowDamage's Arrow recovery is cited
  `:145-147` in five places and `:146-148` in one
  (`exteriorFoes.js`'s foe arm) - one is off by one; left until the
  C# is at hand.
- **C10 (note, recorded):** `playerArrowHitFoe` still adds an Arrow to
  a PUPPET's shadow entity; the exterior never serializes a puppet,
  but the dungeon's `collectWorld` writes every foe's items, so a
  joiner that later takes the seat publishes its own shafts' Arrows
  beside the host's. A divergence in the memory, not in play.
- **Verified fine:** no stale `_divertPt` on any early return (the
  hook fires only inside `damage > 0` at the calc, and only `Math.max`
  follows it); no save leak (both serializers name their fields); the
  quest foe and the summon past the layout dose locally; the wire's
  bounds, the landing order, the saving throw at the owner, the
  disease rider monster-only in both cores, the suite line, the cite
  tests, the merge (no stray file, the tool's fixtures untouched).

Relay `world66`. Restamped: world2/world3 (the dungeon divert and the
bounded landing), auditworld6b (the divert's gate), auditworld6bii,
audit58_combat and roadg_pools (the one door with the shaft's kind),
citedrift (the flight's hook), the relay version pins.

## AUDIT WORLD6b (2026-09-14)

**Mac: "Audit first."** Three opus lenses over WORLD6b-i - A the relay
and the session, B the encounter pool's puppet and stream arms, C the
world host's wiring, the day's rolls, the record and the pins. Every
finding verified against the code before it was paid; the pay-outs are
root fixes, pinned by execution in `test/auditworld6b.test.js`, the
relay redeployed (`RELAY_VERSION` `world63`).

### A - the relay and the session

- **A1 (major, paid): the cell's hit funnel was charged before the
  route was known.** In a cell the destination is the client's `to`;
  the room-wide token was spent, THEN the socket looked up - so a `to`
  naming nobody delivered nothing, bought a token, and counted no
  junk. Three sockets streaming twenty unroutable blows a second
  silenced every honest blow in the country for as long as they sat
  there, nobody struck. Now the ROUTE is resolved first; a `to` no
  socket carries delivers nothing, spends nothing, and is counted as
  junk (AUDIT WORLD2 A4's instrument) so a stream of them is struck.
- **A2 (major, paid): one room-wide hit budget served many owners.**
  `HIT_ROOM_HZ_MAX` (60) funnelled onto ONE host in a dungeon; in a
  cell six honest fights saturated it and the seventh's blows dropped
  silently. The funnel is the DESTINATION socket's own bucket now
  (`hbucket` on its attachment) - AUDIT WORLD2 A6's law as written,
  "the funnel onto the host's ONE socket", per socket.
- **A3 (major, paid): a cell's foes admission was an unbudgeted ingress
  and a serialise sink.** The byte budget bounded egress only, and the
  re-stringify ran before it; every hello'd socket could push 12 x 64
  KiB a second of parsed-and-restringified junk, never struck. The
  room budgets its cell INGRESS at the door, before the parse (dropped
  unread, nobody struck - the fan's own law), and the fan's budget is
  asked before the stringify on an estimate of the envelope.
- **A4 (major, paid): the cell's foes fan ignored the range gate the
  pose fan applies.** Two players ten pixels apart in one sixteen-pixel
  cell heard no poses and every foe; my pool grew with the cell's
  population for foes nobody near me could see. The fan is ranged as
  the pose's is (`inRange`, `RANGE_PIXELS`); a dungeon's still reaches
  every socket in the place.
- **A5 (minor, paid):** `hitOwnerOf` took any string of 1-64; it tests
  the wire's own id law (`ID_RE`).
- **A6 (minor, paid):** the record said `sendHit` needs a `to` that is
  "a peer" and the session never asked the roster; it does (an owner
  already gone bought the funnel for nothing).
- **A7 (note, paid):** the hit carries the cell key `k` as the frame
  does, and `applyHit` refuses another room's.
- **A8 (note, paid):** `onFoes` in a cell fires for a peer the roster
  holds - past `ROSTER_MAX` a stranger's frames stood puppets the
  prune took back every frame (C6, the same).
- **A9 (note, paid):** a cell's host word no longer stamps the dungeon
  seat's heartbeat (`_foesInAt` is a world room's).
- Sound: no spoofing (the relay stamps `id` from the attachment);
  CLOSE_REPLACED cannot yield two sockets with one id; every branch of
  the pre-parse door for a cell, a dungeon, an interior, a town, a
  chat room and a socket before hello; `sendWorld`/`sendAct`/`onAct`/
  `onWorld` unreachable from a cell; in-flight frames from the old
  socket dropped on a room change.

### B - the encounter pool

- **B1 (critical, paid): the puppet divert had no provenance gate.**
  `damageFoe` diverted EVERY caller to the owner as the player's blow
  - a fall, another foe's maul, a poison round, the magic-round broker
  - so a bear mauling Bob's rat on my screen damaged Bob's rat and
  turned it on Bob (AUDIT WORLD2 B7 re-opened). The divert is gated
  on `fromPlayer && !peer` as the dungeon's door is; a non-player blow
  on a puppet is dropped (the owner's simulation has its own); and the
  magic-round broker skips a puppet's entity (`shared.js`).
- **B2 (critical, paid): a peer's kill spent MY soul gems, filled MY
  Azura's Star and spoke MY kill notice.** The death block never read
  `peer` (a failed trap even refused the death). Threaded line for
  line with the dungeon's (AUDIT WORLD2 B9): no trap, no Star, no
  notice for a blow I did not strike; the corpse, the alert clear and
  `raiseEnemyDeath` stay.
- **B3 (critical, paid) / C2: puppets were unbounded.** One frame could
  stand 400 foes (batches, entities, careers, textures) at every reader
  - by accident in a crowded cell, on purpose from a hostile client.
  Bounded at both ends, the wire's law: a cell's frame carries at most
  `CELL_FRAME_RECORDS_MAX` (64) records or it is junk at the relay; a
  record is PROJECTED (`validFoeRecord` - the feet inside the pose's
  own bounds, the health, the numbers) or refused whole; a reader
  stands at most `CELL_PUPPETS_MAX` (8, `MAX_ACTIVE_ENCOUNTER_FOES`)
  live puppets per owner.
- **B4 (major, paid): an owner that restarted its pool was frozen out
  for ever.** The frame counter was per owner and cleared only on MY
  room change; a reload keeps the id and numbers from one, so every
  later frame was "stale". The counter is the owner's PRESENCE's: it
  ends when the owner leaves (the prune) - and, C3, when the owner
  goes quiet (`FOES_STALE_MS`, the seat's own window, `now` and
  `staleMs` on the net).
- **B5 (major, paid): a swept puppet's record was re-adopted before the
  splice.** `removePuppet` flagged the record and left it in the roll
  for the frame's tail splice; the owner's next record landed on the
  corpse-less dead and stood nothing - every cell seam crossing lost a
  peer's foes for up to `FOES_FULL_MS`. The record ENDS in
  `removePuppet` (spliced), and the lookup is an owner:seq index (B16).
- **B6 (major, paid): a build in flight survived the clear.** A puppet
  built through the async spawn chain landed after `clearPuppets` or
  the prune, at the old cell's feet, sometimes adopted as the new
  cell's foe at the same number. The build carries the owner's
  generation; a stale one ends on arrival.
- **B7 (major, paid): a corpse mint in flight survived the sweep.** The
  marker landed in `corpseBatches` owned by a record already gone.
  `mintCorpse`'s late guard reads `_gone` beside the epoch.
- **B8 (major, paid): my foes and the watch could pick a puppet as a
  target and fight a ghost;** an archer's shaft into one added an
  arrow to items nobody could loot. Puppets are out of the shared
  candidate list at the host, and a foe's shaft into a puppet lands
  nothing.
- **B9 (major, paid): a Wabbajack strike on a puppet minted a local foe
  of mine in a peer's foe's place;** `removeFoe`, `zeroFoeHealth` and
  the replace arm refuse a puppet.
- **B10 (minor, paid):** a puppet's zero-damage connect goes through
  the one door (AUDIT WORLD2 B13: a zero blow is a blow, the owner's
  foe turns).
- **B11/B12 (minor, paid):** a record whose species disagrees with the
  puppet's, or that says a dead puppet lives, ends the old puppet and
  stands anew (the dungeon's retype law, per foe).
- **B13 (minor, paid):** a record for a puppet still building is the
  word that lands when the build does - a `d:1` no longer stood the
  puppet alive until the next full frame.
- **B14 (note, paid):** a puppet's stand rolls no loot table, wears no
  kit, casts nothing: what my neighbours stream must not move my own
  dice.
- **B15 (note, paid):** the corpse loot keys by a stable id (`uid`) as
  the watch's does (AUDIT 39) - puppets splice far more often than
  the cull ever did.
- **B16 (note, paid):** an owner:seq index replaces the per-record
  `find`.
- Sound: the save and the loot exclusions; `activeCount`; the frame's
  quest-foe and puppet exclusions; the `k` and `n` guards within a
  session; `collectPixel`, `destroy`, the cull and the fall skipped for
  puppets; `puppetStep`; the joiner's attack latch; the HUD marks; the
  ring, blood and pain at the owner; the peer arm's area wake.

### C - the world host, the day's rolls, the record

- **C1 (major, paid): the puppet's target was cached in the SCENE
  frame and the floating origin did not move it.** `offsetAll` shifted
  every foe's feet and not `_pup.feet`; at every map-pixel crossing
  every standing puppet snapped a whole pixel (819.2 units) away for
  up to `FOES_FULL_MS` (AUDIT 17e F23's class, AUDIT ONLINE D5's for
  peer bodies). The target is kept in the WORLD frame and converted
  through `toScene` every step - the pose's own law - so no
  `offsetAll` entry can be forgotten.
- **C2 (major, paid):** the frame's bounds - see B3.
- **C3 (major, paid):** interest and staleness - see A4 and B4; a
  puppet whose owner's stream has died is swept after `FOES_STALE_MS`.
- **C4 (major, paid): "two players whose state agrees walk alike" was
  not what the code did.** One generator seeded by today walked
  `daysPast` days region-major, so the draw depended on when each
  player LAST ran the day change: a player back from three days away
  walked a different region than one there every day. Online the walk
  is one day at a time, each day from its own generator; catching up
  equals having stayed. Offline the caller's stream walks the span
  whole, as DFU does.
- **C5 (minor, paid):** the price walk and the powers drew the
  IDENTICAL sequence on a day both fired; each consumer has a salt
  (`DAY_SALT`), the weather's own shape.
- **C6 (minor, paid):** see A8.
- **C7 (minor, paid):** a room change resets the full-frame clock, so a
  new room hears every foe of mine at once instead of after
  `FOES_FULL_MS`.
- **C8 (minor, paid):** the death branch returned before the room
  latch; the puppets go with the room at the death.
- **C9 (minor, paid):** the pane says "everyone NEARBY sees and can
  HELP fight" - the fan is ranged and a puppet lands no blow.
- **C10 (minor, paid):** the teardown ends the owners' records; an
  orphan body - see B7.
- **C11 (minor, paid):** `selfId` was dead wiring on the net; gone.
- **Note:** a 30-day catch-up's per-minute generator mint measured
  0.53 ms; the constants sat between imports - moved below them.
- **Pins:** the converters and the compensation change were pinned by
  source alone; the audit's pins execute a converting net through a
  compensation change (C1), the per-day walk against a continuous one
  (C4), the prune's clock (C3), the funnel per destination and the
  unroutable blow (A1/A2), the ranged fan and the bounded frame
  (A4/B3), the ingress budget (A3), the provenance gate and the peer
  kill (B1/B2), the cap and the projection (B3/C2), the restart, the
  splice, the cancelled build and the late body (B4-B7), the refusals
  (B8/B9), the rebuild and the pending word (B11-B13), the stable
  loot key (B15).

**Recorded, not paid (6b-ii's, added to the list):** the striker's
poison and disease riders run on the local puppet's entity before the
divert and never reach the owner's foe (the hit should carry them, as
WORLD3 put the arrow's shaft on the dungeon's); the roster's
`ROSTER_MAX` bound leaves a 65th player's foes unseen; the peer's blow
carries no feet (the owner's foe turns on the owner). [The feet: paid
by WORLD6b-ii. The poison and the roster's bound: paid by
WORLD6b-iii(e), which also found the "disease" half was never a
player's rider.]

## AUDIT WORLD6b-ii (2026-09-14)

**Mac: "Lead the way."** The last two audits each found criticals in
freshly shipped code, and 6b-ii touched the target machine and the
combat resolution, so the audit came before 6b-iii. Three opus lenses
- A the owner's side of the hunt, B the puppet's side and the hit-in,
C the wiring, the merge with the Features arc and the record. Every
finding verified against the code; paid at the root; pinned by
execution in `test/auditworld6bii.test.js`. No relay change.

### The criticals

- **B1/C1 (critical, paid): a puppet's blow at me was unbounded on an
  untrusted client's word.** WORLD3's law was carried across a
  boundary it was not written for: the dungeon has ONE streamer, the
  relay-elected host; a cell has every peer. A hostile client streams
  eight Daedra at my feet, facing me, naming me, striking every frame
  (`t` any species, `f` inside the pose's bounds, `g` my id, `a` a
  count): measured eleven blows a second, the full monster formula,
  the riders, the flash - dead in under a second, no cheat beyond a
  crafted frame. Bounded now, at the reader: per puppet the mobile's
  own attack state already bounds a streamed strike to one blow per
  attack animation (a strike edge mid-swing is ignored - verified);
  per OWNER the blows are budgeted (`PUPPET_BLOWS_PER_S`, a token
  bucket on the owner's record: the honest maximum of a full pool of
  foes at their fastest cadence); and a puppet that LEAPT - moved
  farther since its last record than three times its species' own
  speed could carry it, plus a slack - lands nothing until its next
  record walks it: an honest foe cannot teleport to me, and a dropped
  frame's catch-up is inside the law. Recorded, not paid: the eight
  puppets that stand still at my feet from their first record (the
  cell's substitute for the host seat is a bound, not a seat).
- **A1 (critical, paid): a caster that switched to a peer froze for
  ever.** The cast gate skipped the caster's whole update while the
  target was a peer; `selectedSpell` latched, the motor's stand-off
  band read it live (`canCastRangedSpell`) and the foe stood rooted
  inside its band - never closing, never swinging, never re-picking -
  for as long as the peer was nearer. Reproduced headlessly (200
  steps: rooted at 10 units vs closed to 2.17). The decision is state,
  not an action: the tick runs always, SUPPRESSED at a peer inside the
  caster (the pick clears on its own cadence, the timers keep
  counting), so the motor closes to melee. The cast at a peer stays
  6b-iii's.

### A - the owner's side

- **A2 (major, paid):** the distance cull read `detected` unnarrowed -
  since the hunt it is of ITS target, so a foe that walked off with a
  peer across the cell was never culled, and eight of them held the
  pool full (no encounter near me) for the session. The cull reads MY
  relevance (`targetIsLocalPlayer`, AUDIT WORLD3 C3's own latch).
- **A3/B5 (major, paid):** a peer's blow with no candidate for the
  striker (a pose hiccup, out of range, past the roster) fell through
  to `PLAYER_TARGET` - my pacified foe woke on ME, seeded at a
  stranger's feet. A peer's blow never names me: with no candidate the
  foe is woken (the give-up timer) with no target and no feet, and the
  next machine pass picks. The dungeon's identical fallback is
  recorded for its own audit.
- **A4/C4 (minor, paid):** the Seducer's transform read a peer as me
  (DFU's trigger is Target == PlayerEntityBehaviour) - both pools.
- **A5 (note, paid):** peers walked AHEAD of the player in the target
  list and won priority ties against me; the caller now names the
  player's slot (`PLAYER_TARGET` in the list) and the peers walk after.
- **A6/B8 (note, paid):** a puppet's senses latched
  `targetIsLocalPlayer = true` and ran for every puppet - a peer's foe
  hunting another peer refused my rest as an enemy that had detected
  me, and raycast forever; the latch tells the stream's truth
  (`_pupMine`) and the senses run for a puppet at me alone.
- **A7 (note, paid):** the melee block's two `continue`s were dead and
  a trap; an if/else now.
- **A8 (note, paid):** a foe with no target streamed `'.'` (hunting its
  owner) and latched the puppet hostile; none is `''`.
- **A9 (note, paid):** the cast target entity read MY effects for a peer
  target; a peer's is not mine to read.

### B - the puppet's side

- **B2/B3 (major, paid): a class puppet punched me at MY level with no
  weapon.** A puppet's entity was built at my level with no kit (B14's
  own law), so `calculateAttackDamage` took the weaponless fork and my
  level: a Knight's blow was 4.3 at my level 3 and 15.6 at my level 20,
  decided by whose client resolved it; a peer's archer's shaft the
  same. The ATTACKER's terms ride the record - `l` the foe's level, `w`
  its right-hand weapon as [template, material] or null - in the
  wire's law; the puppet is built at the owner's level (a mismatch
  rebuilds, as a species does) and wears the owner's weapon, rebuilt
  from the descriptor with no dice. "My own stats" means the target's.
- **B4 (major, paid):** a player arrow into a puppet ran
  `handleAttackFromPlayer` with `peer` false - my whole area woke for a
  blow on a peer's foe, and a zero-damage shaft never reached the
  owner. One door (`attackFromPlayer`): a puppet's owner hears the zero
  blow unless a damaging one went this frame; no area of mine wakes.
- **B6 (medium, paid):** a puppet beating on me raised no enemy alert
  (the rest, the trip, the roll) - both pools raise it, and the
  exterior clears it when the puppet ends.
- **B7 (minor, paid):** a puppet's shaft rang `ArrowShoot` twice.
- **B9 (note, paid):** the hostility flip's comment described the
  dungeon's castle guard; it is a guard here.
- **B10 (note, paid, the dungeon's):** the dungeon dropped a puppet's
  latches in `puppetStep`, BEFORE the mobile set them - a frame latched
  while the target was another survived to the next frame and fired at
  me if the target flipped; dropped after the mobile now, the
  exterior's order.
- **B11 (note, recorded):** a peer's blow at me draws my dice
  (`calculateAttackDamage` on the shared stream); the number of draws
  is set by peers' cadence.

### C - the wiring, the merge, the record

- **C2 (major, paid): the hunt was gated on the POSE stream, the blow
  on the FOES stream.** A peer gone quiet past `PEER_TIMEOUT_MS` was
  undrawn and dead to my foes' machine, and its puppets kept resolving
  blows on me - an attacker off screen that could not be hunted back.
  One liveness: a puppet's blow needs its owner among the peers the
  hunt sees (visible), and the prune reads the same list.
- **C3 (major, paid):** the pane still promised a cooperative hunt
  ("can help fight" - C9's own words, written when a puppet landed no
  blow); it says a peer's creatures can hurt you too. The pin's title
  claimed a pane assertion its body did not make; the audit's pin
  reads the pane.
- **C5 (minor, paid):** a peer's aim height flickered with the body
  slot (the doll answers 0 while not standing); the last standing
  height is the peer's.
- **The merge (sound):** every hunk between the slice's commit and the
  PR merge is the Features arc's own; nothing of 6b-i, 6b-ii or AUDIT
  WORLD6b was reverted; `buildTag.js` is generated at prebuild and
  pinned only against its own read.
- **Notes (recorded):** `canSeeTarget` raycasts per peer per foe per
  classic tick (memo it beside `_peerFrame`, next); the watch reads
  `isPlayerTarget` throughout and would misfire the day peers enter
  its list (6b-iii's guards).

Pinned in `test/auditworld6bii.test.js` (9), EXECUTED: the caster's
suppressed tick and its wiring; the cull of a foe that walked off
with a peer; a peer's blow with no candidate naming nobody; a fresh
foe's empty target; the owner's blow budget and the leap; the
attacker's level and weapon on the record and on the puppet; the one
attack door for a puppet and a foe of mine; the alert from a puppet
at me, the senses for a puppet at me alone, the owner's liveness; the
hosts by source.

## AUDIT WORLD6b-iii(a) (2026-09-14)

**Mac: "Continue"** (after WORLD6b-iii(a)). The slice let a foe cast at
a peer and a puppet cast at me on its owner's word, and the two audits
before it each found criticals in the fresh boundary, so the audit
came before the cell seam. Three opus lenses - A the owner's side (the
decision, the executor, the hosts' hooks), B the puppet's side (the
streamed cast, the sinks, the budget), C the wire, the relay, the
dungeon twin, the merge with main and the records. Every finding
verified against the code; paid at the root; pinned by execution in
`test/auditworld6biii.test.js`. No relay change: the relay never
projects a foes record (C1 - the live `world63` fans `c`/`s` as it
fans any key), and the wire's new keys are bounded at both ends.

### The criticals

- **B1 (critical, paid): a puppet cast ANY spell in SPELLS.STD on its
  owner's word.** The streamed `s` was resolved out of the whole
  classic table (`spellsByIndex`), and a puppet carried no list of its
  own (AUDIT WORLD6b B14 kept the dice out of it - but SetEnemySpells
  is a table read, not a roll). A rat's puppet cast a lich's spell, at
  no magicka and past the silence gate (`noSpellPointCost`), scaled by
  a class puppet's owner-said level. The blow budget bounded the RATE
  and nothing else: six free picks a second from the whole book. Paid
  at the stand: `assignEnemySpells` runs for a puppet too (its species'
  list, or its class level's - both already authoritative, the reader
  rebuilds the puppet on either changing) and the streamed cast is
  resolved out of `f.entity.spells` and nowhere else; a spell not of
  its list is its Spell one-shot alone, no token spent.
- **B2 (critical, paid): a puppet's own self or area cast went to its
  owner as MY hit.** The pool's `foeSinks.hurt` called `damageFoe` on
  the default `fromPlayer: true`, so a puppet's CasterOnly damage or
  AreaAroundCaster blast - and, through the host's `foeSinks`, which
  ignored the engine's provenance argument, any foe's blast over a
  puppet - was diverted to the owner as my blow (a 200-damage phantom
  in the probe), where the owner's foe turned on me. Paid at the three
  doors: the pool's sink says `fromPlayer: false, kind: 'spell'`, the
  world host's `foeSinks(g, fromPlayer)` reads the engine's second
  argument (AUDIT WORLD2 B7's law, which the dungeon's sink had and the
  exterior's did not) and the guard door forwards the options bag.
  And the engine's blast sweep skips a puppet when the caster is a foe
  (C15): its owner's world resolves that foe; my own blast on a puppet
  still goes to its owner as my hit.

### A - the owner's side

- **A1 (high, paid): "nothing of mine in the blast at a peer" guarded
  an arm the pick never reaches, and the reachable blast hit me anyway
  - credited to ME at MY level.** `castSpellFrom` nulled `playerFeet`
  for a peer target, and `playerFeet` inside the executor is the
  AreaAroundCaster probe (rangeType 3) alone - which the decision
  never picks (`pickRangedSpell` filters 2/4, the touch arm 0/1). The
  area cast a foe CAN pick (4, AreaAtRange) leaves as a missile and
  explodes in the engine against my capsule either way; and the
  engine's WALL arm spent `playerEntity.level` and `playerCaster()` on
  every enemy blast. Worse, in review: the decision handed the
  TARGET's feet as the probe (`_tgt`), masked by the null - the
  dungeon's C2 in this pool. Paid: my feet are the probe whoever the
  target is (DFU's OverlapSphere is over colliders, not a target test;
  the null bought a strictly-safe stand beside a Daedra hunting a
  peer), and the wall arm spends the missile's own caster and level
  through one `missileCaster(m)` the flight arm shares.
- **A2 (high, paid): the missile was aimed for a PEER target alone; a
  foe duelling another FOE still fireballed me.** The comment above
  the decision stated the law and the line below it aimed at peers
  only. Paid: `castAimAt` - the SELECTED target's transform through
  `targetAimPoint` (the one law, its peer arm and its foe arm), null
  for me; the hand-inlined peer copy (A6) is gone with it.
- **A3 (medium, paid): the cast's recipient was read 200 ms after the
  cast.** `c`/`s` latched at the release, `g` read off the LIVE hunt
  when the frame went out - a foe that cast at me and turned to a peer
  inside the frame's window sent that peer a cast it never made (and
  the mirror dropped one). The blow count `a` had the same defect from
  6b-ii. Paid on the wire: `u` whom the last cast was at and `b` whom
  the last blow was at, in `g`'s spelling, latched with their counts;
  the reader latches each with its strike or cast and resolves it by
  ITS recipient (an older record without them falls back on `g`); `g`
  stays the live hunt for hostility, the senses and the alert. A
  damage frame with no swing behind it lands nothing.
- **A4/B5 (medium, paid): a puppet I paralysed kept casting.** The
  swing was gated on `entityIsParalyzed`, the cast ran above the gate.
  Hoisted; both arms read it (DFU's CanAct gates both).
- **A5 (medium, paid): the slice's owner pin never ran the decision.**
  It replaced `EnemyCaster` wholesale, so the retired-suppression law,
  the band in the peer's frame and the veto were unexercised, and its
  blast case used the unreachable arm. The audit's pin runs the REAL
  caster: an imp hunting Bob picks its ranged spell off its own list,
  reads the stand-in, releases at Bob's transform, spends its magicka
  and, out of it, closes to melee - DFU's arc.
- **A9 (note, paid): free casts never rode the record.** The spider's
  paralyze rider called the executor without touching the count. The
  count, the spell and the recipient are latched at the ONE release
  now (`castSpellFrom`), so every cast is a count by construction; a
  refused release (silenced, no magicka) counts nothing.
- **A11/B8/C3 (note, paid): two of the three hosts' `fireMissile`
  hooks dropped the aim point** (exterior.js, worldModes.js), latent
  because only world.js installs the net. One law now:
  `missileAimDirection(from, aimAt ?? targetAimPoint(null, player.pos,
  player.height))` in all three, the subtraction in one home.
- **A7 (note, recorded): the veto is structurally false at a peer.**
  `PEER_CAST_TARGET` carries no effects, so EffectsAlreadyOnTarget
  never vetoes a re-pick of Paralysis on an already-paralysed peer;
  the real fix wants the peer's active effect kinds on the wire.
- **A8 (note, recorded): a Touch spell at a peer leaves as a missile
  from melee range, and its cadence is my level's** - DFU's own
  reading (`attack.playerLevel`), unchanged.
- **A12 (note, recorded): a peer that leaves is cast at for one classic
  target tick** - the candidate's health goes 0 and the machine's next
  pass drops it; a wasted cast, no throw.

### B - the puppet's side

- **B3/C9 (medium, paid): a record with `c` up and no `s` cast spell
  0.** No spell, no cast: the reader latches the count and casts
  nothing.
- **B4 (medium, paid): the puppet's cast had no range or sight gate,
  and a puppet is never distance-culled** - one across the map cast at
  me. Paid: `puppetCastInBand` reads the owner's own bands off the
  streamed pose (DoRangedAttack's 6..51.2 in sight for a missile or a
  blast at range, DoTouchSpell's melee reach for a touch, a self-cast
  or a blast around the caster) with the leap's slack; outside them
  the one-shot alone. The senses run BEFORE the cast now.
- **B6 (low, paid): a self-heal here made every record after it a
  hurt** - the drop was measured against the live entity the heal had
  raised. Measured against the last STREAMED health (`p.h`).
- **B7 (low, paid): a cast or blow refused by the leap gate still
  spent a token** and starved the owner's other puppets. The leap is
  read before the bucket.
- **B9 (note, recorded): a rebuild swallows exactly one cast** - the
  new puppet latches the count it arrives with, as the strike latch
  and the joiner do. Consistent, not paid.
- **B10 (note, recorded): a cast on the same frame as a strike edge
  loses its Spell one-shot** - the mobile's priority (DFU's), the cast
  still fires.

### C - the wire, the dungeon twin, the merge, the records

- **C1 (verified): the deployed relay strips nothing** - see above.
- **C2 (high, paid): the dungeon's cast at a peer handed the PEER's
  feet to the blast's probe for the LOCAL player**, so a rangeType-3
  blast beside the peer landed on ME wherever I stood (WORLD3-era,
  live). My feet and height are the probe; the missile aimed itself at
  the peer in flight all along.
- **A10 (note, paid): the dungeon read MY effects for a peer's pick**
  (`isPlayerTarget` admits a peer; AUDIT WORLD6b-ii A9 unpaid there).
  `PEER_CAST_TARGET` moved to `enemyTargets.js`, one home for both
  pools, and the dungeon reads it through its deps.
- **C8 (low, paid): `s` was bounded 256 times wider than the u8 it
  carries.** Bounded at 255, `c` at 0xffff (the minter's own mask).
- **C5/C6/C7 (paid): the records stated the retired law** - two
  Testing.md rows ("the caster's suppressed tick", "no cast at a
  peer"), a test title, and the 6b-ii bullet standing unstruck beside
  6b-iii(a). Restamped and struck.
- **C10/C11 (low, paid): two loose pins** - the decision's substring
  anchored at the call's end (a sixth argument would read as
  `playerEntity`), the executor's option pinned inside its
  destructure.
- **C12 (low, paid in part): the cite re-aim is a line shifter, not a
  resolver.** Seven cites that were wrong BEFORE the shift were
  re-aimed by hand (`exterior.js` x5, `world.js`, `dungeonContext.js`);
  the pass itself stays mechanical (citedrift's CD4 is the content
  gate, over its named set).
- **C13 (declined): `buildTag.js`'s eight characters** are
  `scripts/buildTag.mjs`'s own output (`git rev-parse --short`, run at
  every build) - not a hand-set value.
- **C14 (note, recorded): `c`/`s`/`u`/`b` ride every record**, casters
  or not - a worst-case 64-record frame is well inside the frame cap;
  the egress fan lost a tenth of its headroom (the first-drop point
  from about nine to eight worst-case senders in range). A conditional
  emission would make an absent field mean zero, which muddles the
  partial-record reading the pins use; left as is.
- **The merge (verified): `git diff` against the merge base carries
  the slice's hunks and cite re-aims alone**; the suite line matched
  the count.

Pinned in `test/auditworld6biii.test.js` (6), EXECUTED: the real
decision at a peer (the imp's own list, the stand-in, Bob's transform,
the record's c/s/u, the magicka spent); the engine's wall arm at the
caster's level and a foe's blast skipping a puppet while mine reaches
it; a puppet's self-cast sending nothing to its owner and landing
nothing here; the owner's bands off the streamed pose (a missile inside
six or beyond the band none, a touch beyond reach none), paralysis, the
hurt against the streamed health; the direction law, the frozen
stand-in, the u8; by source the three sinks, the leap before the
bucket, the one counted release, the wall arm, the dungeon's probe and
stand-in, the records. `test/world6biii.test.js` rewritten under the
law (the wire's u/b and the u8; the blast measured against me at a
peer, the owner's `u`; the puppet's own list, the cast's recipient, no
spell no cast, the bands, the leap spending nothing); `world6bii`'s
puppet-blow pin and `auditworld6bii`'s budget pin drive the swing's
edge (a damage frame with no swing lands nothing); `x3casting`,
`audit62_foes`, `audit39_worldmodes`, `world3` restamped where the law
moved.

## STOP (2026-09-14): where the arc stands

**Mac: "Lets actual stop here and log where we are at because there
are a few things id like to discuss."** The log, so the discussion
starts from the record and not from memory.

**Shipped and live.** Everything from ONLINE1 through WORLD6b-iii(e)
and its audit is merged to main; the relay is deployed at `world66`
and answers on `/health`. The suite stood at ~~7474 tests across 755
files~~ at the stop (superseded - Testing.md carries the live count),
green. In one line each:

- ONLINE1/SLOTS1/MWBODY1/CHAT1/MAC6/MAC7: presence, the doll, the
  chat, the dungeon save, the peer's weapon and swing.
- WORLD1-WORLD5: a dungeon is one shared world - its memory, one
  simulation per room (the host's foes, everyone else's puppets), the
  doors and levers, the loot, the shared clock and weather.
- WORLD6a: a building is a world room (its shelves, doors, piles).
- WORLD6b (i-iii): a cell streams every player's encounter foes; the
  foe hunts every player; the cast at a peer; the cell seam (the
  halo); a puppet's corpse loot; buildings' foes closed as none by the
  lockbook; the striker's poison and the shaft on the hit; a stranger
  beyond the welcome's roster asked for (`who`).
- Every slice audited by three opus lenses, the findings paid or
  recorded, pinned by execution.

**Open, on the 6b-iii list** (each a design slice, not a residual;
see "6b-iii (recorded, next)" above and the explanation given at the
stop):

- ~~**The guards on a shared crime.**~~ PAID by WATCH1 (2026-09-17,
  the smaller reading - see its section below): the crime stays the
  criminal's, the watch rides the criminal's cell frames as puppets,
  hunts its owner alone, and a peer's blow on it is not the owner's.
  Recorded, not paid, in that section: the larger reading (a crime
  event on the wire, the witness test run once, a peer's murder
  marking the region for everyone, a watchman hunting a peer).
- ~~**One economy.**~~ PAID by ECON1 (2026-09-17, see its section
  below; OL4 the same day put the shops on a night shift online): the
  region's prices are a pure function of the world's day, computed
  alike on every client - no memory, no owner, no wire - with the
  merchants' power tilt dropped (the powers stay each player's: quests
  move them). A player away a week reads today's index, as one who
  stayed does. Recorded, not paid, in that section: the powers as a
  world's, and the bank.
- Recommended order at the stop: the guards first (contained in a
  cell, the pool laws exist), the economy second.

**Recorded, not paid** (the last audit's notes, standing): the
striker's ask runs after the blow, so a stranger's first blow wakes
my foe with no candidate; the merged roster's one-round-trip flicker
when a halo lets a peer go; the rig's attachment cap is not the
runtime's; the dungeon's poison seam rides Math.random; the shaft's
Arrow on a puppet's shadow reaches the dungeon's memory on a
handover; one BowDamage cite off by one.

**The wider "not yet"** is the list below, unchanged: no
player-versus-player, the look sent once, no identity beyond the
name, the relay unmeasured past a handful of players.

**Standing reminder:** the Cloudflare API token pasted into the chat
during the deploys should be rotated.

## WORLD7 (2026-09-14): the quest clocks run online, charging played time

**Mac: "quests dont seem to work in online. I brought a newly created
and saved character over and the journal is empty."** Then, on the
suggestion: **"Go."** The save was never the fault - the Online door
loads the picked slot through the same restore as Load, and the
journal reads the same machine. The fault was WORLD5's law that every
quest clock STANDS DOWN online, written for time limits: a Daggerfall
clock is a DELAY as often as a limit, and the scripts say so.
Brisienna's letter waits on a seven-to-fourteen-day clock (the
journal's first entry is removed at the door of Privateer's Hold and
the letter restarts it); the tutorial's pages wait on clocks of
minutes; every "come back in three days" waits on one. Stood down, the
letter never came, the journal stayed empty, and the main quest never
began online.

**THE LAW: A CLOCK CHARGES PLAYED TIME.** Online a quest clock charges
the frame's world time and never more than one PLAYED STEP
(`PLAYED_STEP_MAX_SECONDS`, thirty world minutes - two and a half real
minutes under the shared clock's twelve-to-one; a frame never spans
it). A gap past the step is time AWAY - the tab closed or hidden (the
machine ticks off the frame loop, so a hidden tab runs no frames and
charges one step when it comes back), a window held (the quest tick
waits on an overlay), the character off the world - and is forgiven,
the sample moved. Offline there is no bound: a rest or a
trip charges its whole span, DFU's own. So delays progress while you
play; a limit still stands, in hours played; none expires while away;
a login charges at most one step.

- **The word rides the stand-down's chain**, renamed: the hosts hand
  `questClockStepMax` (the step under the shared clock, `Infinity`
  offline) to the bridge, the bridge to the machine, the machine's
  three doors and the parser to every Quest, the Quest to every Clock.
  `questClocksStoodDown` is gone from the tree.
- **`CreateFoe`'s spawn interval charges the same way** (OL3's law
  re-spelt): the marker moves forward by whatever a tick's gap exceeds
  the step (time away, forgiven - one wave on return, not sixty); a
  resume with no tick sample (a load, a quest restored) whose time
  since the save is past a step is forgiven whole and the first wave
  waits a full interval from there (OL3's standing-up arm); a wave in
  flight still lands; offline the marker arithmetic is DFU's own.

**What it does not do.** A limit is still a limit in played hours -
Mac's WORLD1 word was "naturally disabled", and this is its spirit
rather than its letter: nothing can expire while you are away, and a
fourteen-day limit is many real hours of play. Suppressing the failing
clocks alone is not possible: nothing in a script marks a clock as a
deadline. A quest line's "=clock_ days" means played days online. The
step is one home and one number; a machine that cannot hold a frame
under two and a half real minutes charges one step per frame.

Pinned in `test/world7.test.js` (3), EXECUTED over the real Clock and
the real machine: a frame charges its seconds, a gap of a step the
step, a day away one step with the hour then finishing on played time
and the same-named task started; a fourteen-day letter arriving after
fourteen played days with a week away between each; a resume charging
one step; offline a span charging whole and a quest with no seam as
ever; a scheduled quest's hour under the step through the whole chain;
the chain by source. `test/world5.test.js`'s stand-down pin re-spelt
to the played step; `test/ol3.test.js` (2) re-spelt to the interval's
played time (executed: the backdate, the wave, the hour's gap forgiven
to one step, the resume's full interval, offline whole);
`test/auditworld5.test.js` C10 restamped. Suite 7483 across 758.

## RESTX1 (2026-09-15): online, a rest waits for nothing

**Mac: "So now for online I want to change the rest mechanic to not use
any time. Basically rest just becomes the way to regain. We can dive
deeper in how we want to handle it at a later time but for now this is
the solution."**

### What was actually wrong, and it is not what it looks like

Online a rest has never been able to MOVE the clock. The world's time
is a function of wall time and `worldTick.setWorldMinutes` refuses every
local write while the shared clock stands (`:834-838`) - WORLD5's own
law, and the right one.

What WORLD5 did about it was make the rest honest: if a rest cannot
fabricate minutes, it should PACE itself off the world's own clock, so
an hour of rest is an hour of the shared world's time. That is exactly
right and it is where the cost hid. At DFU's TimeScale an hour is five
real minutes, so **resting eight hours meant forty real minutes of
sitting in a window watching a counter.** Nobody does that. They close
the window and stay hurt, and the rest mechanic quietly stops existing
online.

So the waiting goes, and nothing else does.

### The law

Online, a **rest** (`full` or `timed`) resolves AT ONCE - inside the one
frame that asks - and passes **no minutes at all**, because none were
ever available to pass. The hourly ladder is untouched: the same hours
counted, the same per-hour `restVitals`, the same enemy check every
hour, the same prevented-rest poll, the same `CheckRent`. Only the
waiting between the rungs is gone. Nothing is fabricated, and nothing is
taken out of the other players' sky.

**Loiter is not rest, and loiter keeps waiting.** Loiter recovers
nothing by design; passing time IS its entire purpose - waiting for a
shop to open, waiting for dark. A loiter that resolved at once would do
literally nothing, so online it still rides the shared clock exactly as
WORLD5 left it. One verb regains; the other waits. `AUDIT WORLD5 C7`
and `C8` were written on a timed rest because at the time every mode
rode the clock; they are re-aimed onto LOITER, where their law still
holds unchanged.

### What a free rest does not do

It follows from "no time passes", and it is the deliberate shape rather
than an omission: **no world minutes, so no quest ticks, no magic
rounds, no disease or poison progress, no encounter catch-up.** The
host's `advanceMinutes` is simply never called - the one place a rest
spends time, and the free path skips it whole, together with the quest
tick that rides the same sub-tick. You healed; nothing else happened.

### Where it lives

`systems/restSession.js`, and nowhere else. The session asks
`sharedMinutes` - the dep it already had from WORLD5 - so the predicate
is "the shared clock is standing AND this is not a loiter". **THE FOUR
HOSTS are untouched by this slice**, which is OL1's own shape: a lane is
not forced at a mount site, because a port that forces at forty-seven
sites is a port where the forty-eighth is missed. The pin holds that
too - none of the four may name the predicate.

`FREE_REST_HOUR_CAP` (99, DFU's own prompt cap) is a per-frame CHUNK,
not a stop: `full` ends only when `fullyHealed` answers true and has no
counter of its own, so nothing else would keep one frame from spinning.
It always converges anyway - a free rest passes no minutes for a disease
to drain through, and all three recovery rates clamp above zero
(`healthRecoveryRate` and `fatigueRecoveryRate` at 1;
`spellPointRecoveryRate` at 1 except for the NoRegenSpellPoints careers,
which `restFullyHealed` exempts from the magicka test) - so the cap is
insurance. It is driven in the pins, because an untested guard is a
guess.

### Open, and deliberately so

Mac: *"We can dive deeper in how we want to handle it at a later time."*
This is the simple version and it is reversible. Three judgment calls
were made to keep it small, each easy to change:

1. **The hours dial still means hours of regain.** A timed rest pays
   exactly the per-hour vitals it always did, just without the wait.
   The alternative - rest always fills you up - is a smaller change to
   the player and a bigger one to the code, and it makes the dial a
   decoration. Note that a free 99-hour rest reaches the same place, so
   in practice "Rest until healed" is the path.
2. **Skills still tally.** `restVitals` tallies Medical per hour and
   `onRestFinished` still raises skills, as offline. Free instant rests
   make that cheaper than it was; whether that matters is a balance
   question, not a correctness one.
3. **Loiter was left alone.** See above.

`test/restx1_online_rest.test.js` - 7 pins, 8 mutants, 8 dead. (RESTX2, 2026-09-17: the lane and its test are RETIRED; `test/restx2_online_rest.test.js` holds the law that replaced it - see RESTX2 below.)

## AUDIT RESTX + AUDIT OQ (2026-09-15)

**Mac: "Do an audit on this. While youre at it. Please audit the online
quest system."** The rest change read back against the tree with the
whole path DRIVEN, and the online quest system mapped and
mutation-sized beside it. **One finding, paid; three records narrowed;
the quest system clean.**

### RESTX F1 - the rate limit time was providing

`restVitals` tallies Medical every hour, and in DFU **that tally is
rate-limited by the hour costing time.** RESTX1 removed the cost, and
the rate limit went with it. Measured, not argued:

| | tallies | cost |
|---|---|---|
| `rest 99 hours` at full health, online, before | **99** | one click, one frame, repeatable for ever |
| the same 99 hours offline | 99 | **74 real seconds** of watching a counter |

The `timed` arm called `tickVitals` unconditionally - DFU's own law, and
correct while an hour was a real 0.75 seconds. So the free lane restores
the limit with the only thing it has left: **an hour is paid for when it
does something.** That is also what the switch says it is - "rest just
becomes the way to regain" - and resting when there is nothing to regain
is not resting. The paced lanes (offline, and any loiter) are untouched
and keep the unconditional tally, because there the hour really was
spent. Now: 0 tallies at full health, 99 for ninety-nine healing hours,
9 for a paced offline rest. 3 mutants, 3 dead.

### Three records narrowed, because RESTX1 moved what they describe

None of these is a defect; each is a sentence that was true of rests and
is now true only of loiter or of the ordinary clock.

- **OL2's rest counter.** "Under the shared clock the counter moves once
  per five real minutes and a bare hour count reads as a hang" was the
  reason `status()` carries the world's minutes. A rest no longer shows
  that page at all - it resolves in one frame - so the decoration is
  **loiter's** now. The code is unchanged and still right; only its
  subject narrowed.
- **The enchantment reroll.** The rest page records that "S40's
  advanceMinutes runs the magic rounds THROUGH the sleep, so a rested
  night rerolls as it passes". Online it no longer does, because no
  minutes pass. **Nothing is lost**: the world's clock runs on wall time
  regardless, so an item six hours stale still rerolls on its own hour
  clock through the ordinary per-frame tick - half an hour later, while
  the player walks around, rather than inside the rest.
- **Quest delays.** Before RESTX1 an online rest paced off the shared
  clock and ticked the machine through it, so resting DID push a quest
  delay forward - at forty real minutes a night. It no longer does.
  The delay still advances, because WORLD7's clocks charge played time
  and the world's time is wall time; **the player simply cannot
  accelerate it by sleeping.** Worth stating plainly, because it is the
  one thing about RESTX1 that will surprise someone: online, sleeping is
  no longer a way to skip to tomorrow.

### AUDIT OQ - the online quest system

Mapped end to end, and **no defect found.** What it is, stated once so
the next reader does not have to re-derive it:

**Quests are entirely per-player.** Each client runs its own
`QuestMachine`, its own journal, its own resources. The quest system's
ONLY online awareness is two things, both WORLD7's: `questClockStepMax`
(a clock charges played time, never more than one step) and `CreateFoe`'s
spawn interval on the same law. Nothing else in `systems/quest/` knows a
room exists.

**The boundary that makes that safe is `_layoutFoes`** - the dungeon
host's index of where the layout's own run ends. Every foe past it "is
this player's own" (`dungeonContext.js:1070`, AUDIT WORLD B2): a quest
foe is minted above it, never streamed, never puppet-ised by the room's
authority switch, and never touched by a joiner's stream. So a joiner's
quest foe really does spawn and really can be killed by the player whose
quest it is, which is the thing that would have been quietly broken if
the boundary were not there.

**Quest items ride site links, not shared containers.** `PlaceItem`
assigns the resource to a PLACE with a marker; it never puts anything in
a dungeon loot pile, so WORLD4's "a container anyone opens is the room's"
cannot reach a quest item.

**Sized by mutation rather than read:** erasing the per-player boundary
(`_layoutFoes = 1e9`) reddens WORLD1's host pin; stopping the world host
handing the played step reddens four suites. WORLD7's own machine pin is
EXECUTED over the real quest tables, the real `QuestMachine` and the real
`Clock` - a scheduled quest's hour, five days away charged as one step,
then finished on played time with its task started - which is the pin
that actually proves quests run online at all.

**The open question, and it is Mac's:** a quest foe being the player's
own means **two players in one dungeon do not see each other's quest
targets.** That is the correct reading of a per-player quest system and
it is what the code has always done; whether co-op *should* share a
quest - one party, one target, shared credit - is a design decision
nobody has made yet, and it is a much larger slice than this one.

## WORLD8 (2026-09-14): the hour's respawn

**Mac: "I would like dungeons and the world to repsawn every hour not
every dat"** - a real hour, on the second suggestion. A dungeon's
memory (WORLD1) kept its dead foes dead and its emptied containers
empty for as long as the relay remembered the room - thirty days
after it last drained - and the country's foes were rolls that needed
no law. Now:

**THE LAW: A DEATH AND A TAKE ARE STAMPED, AND AN HOUR LATER THE THING
IS DUE BACK.** `RESPAWN_MS` (one real hour) and `respawnDue(stamp,
now)` in `wire.js`, one home at both ends; the stamp is the relay's
clock (a wall millisecond - the wire's inverse `wallMsForClassicMinutes`
over the shared world minute, no offset subtracted, since AUDIT
WORLD7/8 B1; null offline, so nothing is ever due offline and a save
keeps its dead, DFU's own).

- **A foe.** The one corpse door stamps `_diedAt`; the memory's record
  carries it as `died`; a record applied keeps the ROOM's stamp, not
  this client's arrival. A memory that arrives with a foe dead past
  the hour skips that record whole - a fresh build stands as it is, a
  live one already dead here (this host stayed) is rebuilt. The
  rebuild is `respawnFoe(i)`: the corpse flat freed (the un-death
  arm's own helper, `freeCorpse`), the body's loot record forgotten,
  and the foe REBUILT fresh at its marker through the one build chain
  (`retypeFoe` as its own species - a new entity at full health with
  its own loot roll, the old record dead to everything holding it).
  The host's stream then says the index is alive and every puppet
  stands up through WORLD2's un-death door.
- **A container.** The room's word about a container carries a stamp
  (`t` on the loot record - set on this client's own claim, kept from
  the record on an apply, now for a record without one). A record past
  the hour is not applied and the room's word forgotten: this client's
  own roll stands. A treasure pile the sweep forgets is rolled again
  through the build's own roll, one home now (`rollPileItems`); a
  window this player has open is theirs until they close it (AUDIT
  WORLD4 C1's law).
- **The sweep** runs once a second in the foe pass: the HOST rebuilds
  its layout's foes dead past the hour (the stream carries the rest);
  every client forgets the containers past the hour and rolls its
  piles.

**What it does not do.** The country's foes are rolls (DFU's
encounter law, by the world clock) and come and go on their own; a
building's shelves restock by the day, DFU's own, and stay so; the
relay is untouched (the memory is bytes to it), and its thirty-day
forgetting stands above the hour - a memory forgotten has long since
respawned whole. A memory written before WORLD8 carries no stamp; it
is applied as it stands and stamped at the arrival that applied it,
so it is due an hour later. A foe of the player's own past the layout
(a quest's, a summon's) is not the room's and does not return. A save written online carries its stamps,
so loading it in an online session rebuilds what that save killed
more than an hour ago, a second after the load (the law, not the
save's word).

Pinned in `test/world8.test.js` (2): the wire's law executed (the
hour, what is due and what is not - no stamp, no clock, a stamp
ahead, a minute short - one home at both ends, the thirty days
above); the dungeon by source (the stamp at the corpse door and in
the record, kept from the room's; the memory's arm; the rebuild
through the one chain; the sweep; the loot's three stamps; the pile
roll one home; the country's pool untouched). Restamped: world2
(the corpse door, the un-death arm), world4 (the loot record and its
apply), auditworld (the memory's arm), auditworld4 (the claim), sl2rewind
(the corpse freed through the one helper), audit23_systems (the pile
roll). Suite 7485 across 759.

## AUDIT WORLD7/8 (2026-09-14)

**Mac: "Continue."** Three opus lenses over WORLD7 and WORLD8 together:
A the Clock and the spawn interval, B the dungeon memory's foes (the
stamp, the rebuild, the sweep, the stream), C the loot's stamps, the
wire and the records. Thirty-three findings; twenty paid, the rest
recorded. Pinned by EXECUTION in `test/auditworld78.test.js` (4)
where a rig reaches, by source where it cannot.

### The criticals

- **A1/A2/A5 (critical, paid): a backward sample ADDED its span.**
  `Math.min(gap, step)` bounded the positive side alone; a negative
  gap - an offline save game-weeks past the shared calendar (the world
  starts at the classic start plus wall time), the relay's welcome
  correcting this machine's clock backwards - GREW every running clock
  by the whole span, once, for good. Brisienna's fourteen days became
  forty-four played for exactly the character Mac brought over. Online
  a backward sample is a resume: nothing charged, the sample moved;
  offline the raw gap stands, DFU's own. Executed.
- **A3 (critical, paid): `CreateFoe` was blind to the same gap.** A
  marker ahead of the world spawned nothing for the whole offset. A
  backward gap online is a resume too (the marker stands here); a
  backward gap mid-session the same. Executed through the machine.
- **B1 (major, paid): the stamp was THIS MACHINE's clock.** `sharedWallMs`
  subtracts the relay offset back out - right for OL3's display, wrong
  for a stamp two machines compare: a host forty minutes slow made
  every joiner see a cleared dungeon alive, and a wrong clock poisoned
  the memory's stamps for thirty days. The stamp is the wire's inverse
  over the shared minute now, no offset - the relay's own. Executed
  under an installed offset.
- **B3 (major, paid): the puppet's un-death stood the OLD body up.**
  The host's respawn mints a fresh entity; the stream's `d:0` woke the
  dead one - looted (no activation target, and a stale list the next
  opener made the room's word), still cursed (a frozen drain killed it
  again within a second and sent the host the blow, every hour,
  invisibly), and with the dead foe's counts (phantom swing and cast
  edges). The stream's un-death is a REBUILD now, WORLD3 E2's own arm;
  the save's rewind keeps the plain door.
- **C1 (major, paid): the claim minted its record BEFORE stamping.**
  The record carried the PREVIOUS word's time, so a chest closed an
  hour after its last use was skipped by every receiver as due back - a
  stash lost in silence. Stamped first now.
- **B2/C3 (major, paid): the rebuild freed the corpse before it could
  refuse.** A rebuild that failed (a fetch, the context torn down, one
  in flight) left the foe dead, bodiless and never due again, and the
  memory then carried the unstamped death for thirty days. The refusals
  are asked first; the corpse is freed and the body's record forgotten
  on success; the stamp is kept on failure so the sweep tries again.

### A - the Clock and the spawn interval

- **A4 (major, record, paid):** the machine ticks off the frame loop; a
  hidden tab runs no frames and charges one step on return - the record
  said "a step per throttled tick". Reworded in the record and the
  constant's note.
- **A6 (minor, paid):** an away while a wave was in flight was not
  forgiven (the marker stood, the away counted whole once the wave
  landed). The marker moves on the in-flight path too. Executed with an
  hour's interval.
- **A11 (note, paid):** a save from before the sample field stamped NaN
  into the remainder; the sample is now when the field is absent.
- **A5 (minor, recorded):** legitimate gaps past the step that
  under-charge by design - a window held (the quest tick waits on an
  overlay), a full-screen video, a long load. Played time's own law.
- **A7/A8 (note, recorded):** the arm runs past `spawnMaxTimes`
  harmlessly; a quest line's `=clock_ days` means played days online;
  no UI computes a deadline as a date.
- **A10 (minor, paid):** the exterior host's import comment and AUDIT
  WORLD5 C10's paragraph said the stand-down; stamped WORLD7.

### B - the memory's foes

- **B4 (minor, paid):** `died` was the one memory field with no
  projection - a far-future stamp revoked the hour for every foe for
  thirty days. Never ahead of now at both readers.
- **B6 (minor, paid):** the quest pool's remove door (Wabbajack's
  replace of a layout foe) left no stamp, so that index never came
  back. It stamps.
- **B7 (minor, paid):** the foe half of the sweep swapped a body out
  from under an open corpse window; a body I have open is mine.
- **B8 (minor, paid):** the memory's respawn arm skipped the record
  whole, species included; the room's species is rebuilt first
  (WORLD3's roster law), alive.
- **B9 (minor, paid):** the sweep's burst is capped (`RESPAWN_BURST`,
  four a tick) - a room cleared in one sitting comes back over seconds,
  not in one.
- **B5/B10 (note, recorded, the record amended):** a memory from before
  WORLD8 is stamped at the arrival that applies it (due an hour later,
  not "as it stands"); a save written online carries its stamps into an
  online load.

### C - the loot, the wire, the records

- **C2 (major, paid):** a peer's far-future loot stamp switched the
  hour off for a container for everyone and rode into the memory.
  Clamped to now on the apply.
- **C4 (minor, paid):** the sweep rolled a pile the room had merely
  OPENED; the law says emptied. A pile with a remainder keeps it, as
  the apply's skip keeps the local list.
- **C6 (minor, paid):** the open window's guard sat below the
  forgetting; it is asked first.
- **C12 (minor, paid):** an un-death left the body's loot record in the
  room's word, so the next corpse's claim was refused as already spoken.
  The un-death forgets it.
- **C9 (note, paid):** the Ledger's WORLD5 sentence stamped superseded.
- **C5/C11 (note, recorded):** the loot record grew by a stamp - a few
  kilobytes at most against the memory's half-megabyte; the memory's
  total is still uncapped (pre-existing). Per-client divergence after
  the hour is WORLD4's own law (each client its own roll until the next
  claim).
- **C10/B11 (note, recorded):** the dungeon context has no executed
  harness; the loot and foe halves stay source-pinned. The clock law
  and the wire's laws are executed.

Restamped: world8 (every paid spelling), world2 (the un-death), world5
and world7 (the clock line), auditworld (the memory's arm).

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
  Since WORLD6a a BUILDING is a world room too - its doors, and every
  shelf and cupboard anyone has opened, with the day it was stocked;
  towns keep nothing yet, and since WORLD6b a CELL streams every
  player's encounter foes to everyone in it (a foe is its spawner's;
  no guards, no puppet loot, my foe hunts me alone - 6b-ii; audited:
  the fan is ranged, the frame bounded, a foe is its spawner's to
  hurt and to kill); since
  WORLD5 the clock and the day's weather are
  the world's and the quest clocks charge played time online (WORLD7);
  no
  player-versus-player. Until AUDIT
  WORLD34 no real dungeon was a world room at all (A1: the law's
  eight-digit bound against nine-digit map ids), and the relay must be
  redeployed for one to be. A memory is forgotten
  `WORLD_TTL_MS` (thirty days) after its room last emptied (AUDIT
  WORLD A3 - a bound on parked storage, Mac's to change; since WORLD8
  its dead and its emptied containers come back after an hour), and two
  players' random flats differ by level, so a foe whose species the
  room's memory or the host's stream disagrees with is REBUILT as the
  room's at its index (WORLD3 - the roster is the room's).
- ~~A peer across a world-cell border is not seen until both stand in
  the same cell (D9: two players a pixel apart astride a cell edge are
  in two rooms; the cell is sixteen pixels, the range three, so the
  seam is a strip - the 3x3 neighbourhood is the next iteration's).~~
  Paid by WORLD6b-iii(b): the halo - a player holds the neighbouring
  cells within range too.
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
`test/auditworld3.test.js` (4): AUDIT WORLD3's fixes - the act fan's
byte budget; the record projection, the picker's latch and the instant
mover's sound, executed on bare graphs; the local player told from any
player, executed on the motor; the hosts and the record by source.
`test/world4.test.js` (3): the loot projection executed, the act
frame's loot half over the one fake and through the session, the
dungeon host and the memory by source.

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

## FOE1 - A COMMENT ATE THE HIT (2026-09-15, Mac relaying players)

*"During online play, certain enemies cant be damaged."*

`src/scenes/worldModes.js:5173` read, on one physical line:

```js
useMagicItem: (item) => host.useMagicItem?.(item),   // HT1: the torch keys onFoeHit: (hit) => host.onFoeHit?.(hit),   // WORLD2: a puppet's blow goes to the host
```

Everything from `// HT1:` on is a comment. **`onFoeHit` was not a
property of the opts object.** `a0570bca` (the Handheld Torches port)
appended its own note to the end of the line that already carried
`onFoeHit`, and took the property with it. Parsing the call confirms it:
22 keys passed, and that was not one of them.

**Why that is an invulnerable enemy.** Online, a joiner applies no local
damage to a layout foe - `damageFoe`'s non-authority arm hands the blow
to the room's host through `opts.onFoeHit?.(...)` and RETURNS
(`dungeonContext.js:4003`). With the property missing that call is a
no-op on `undefined`: no damage, no frame, no warning, nothing on the
console. Every layout foe in every online dungeon absorbed every blow
from everyone but the room's authority, for eight slices, in silence.
The zero-damage connecting blow went with it, so a joiner's swing did
not even wake what it hit.

**And that is why the report says *certain*.** Foes at indices past the
layout - a quest's foe, a summon, a rest encounter - take the LOCAL
damage path and died normally beside the ones that could not be hurt.
The host saw nothing wrong at all.

**The pin is shaped by how this escaped.** A text match over that file
would have passed throughout: the characters `onFoeHit: (hit) => ...`
were on the line. The pin strips the comments from the whole
`buildDungeonContext` call and then asserts the six online seams survive
- a property inside a comment is a property that is gone - so the next
swallowed one is caught by the same assertion rather than needing its
own.

## AUDIT FOES (2026-09-15) - three lenses over the foe damage path

Mac, relaying players: *"during online play, certain enemies cant be
damaged."* FOE1 above is the answer to the report. These are what the
same three lenses found around it.

**FOE2 (critical) - a blow the wire refused was LOST.** AUDIT WORLD3 A3
gave the acts a pending set because "an act the wire refused must not be
lost"; the blow never got one, and needed it more. An act is a STATE, so
a lost one reads wrong until someone touches the door again; a hit is a
DELTA and the striker applies nothing locally. `sendHit` refuses on five
conditions and **both sinks discarded the answer** (`?? false`, never
read), and the relay drops over its own budgets without a word.

The commonest refusal is not a network fault at all, it is the rate
gate, and it is **not random**: one swing emits ONE FRAME PER FOE IN
REACH, in pool order, against `HIT_HZ_MAX` (10/s). Measured over the
real swing timing, a Speed-100 character among six foes offers 26 blows
a second and lands 44 on the first two while the last three take **two
apiece**. The same physical enemies starve every swing. That is the
player's report, in a fight with no network trouble in it.

A refused blow waits and goes on a later frame (`net/hitPend.js`, its
own home so it can be driven). Two bounds, because a held blow that can
never be sent is the live-lock AUDIT WORLD4 A1 paid for: at most 64
held, nothing older than 2 s, and a room change empties the queue. Order
is kept - a new blow goes behind what is already waiting.

**FOE3 (critical) - the primary socket vetoed a blow the halo could
carry.** `sendHit` asked `!this._ws || this.status !== 'open'` BEFORE
the routing loop that picks the owner's socket. So while my own cell's
socket was down - reconnecting, a room at `SOCKETS_MAX`, the RTT of any
crossing that is not a halo promotion - **every foe owned by every peer
went bullet-proof**, while its stream kept arriving through the halo and
it kept walking and swinging at me. `sendPose` learned this exact lesson
at AUDIT WORLD6b-iii(b) A5; `sendHit` never did. In a cell the routing
loop is the check.

**FOE4 (high) - the blow goes while the BODY is wrong.** The divert was
gated on `!foe._pupMismatch` under B5's reading, "its index is another
foe's on the host" - and WORLD3 retired that premise: the roster is the
room's, and the index names the same marker on every client (driven: the
layout's foe COUNT never varies with player level; only the SPECIES the
level bands does). Held home it was not a late blow, it was **no** blow.
And the mismatch is the NORM on a join - a level-3 and a level-14
character disagree at **758 of 760** markers - so every index depended
on an async, fallible rebuild clearing the flag, and any rebuild that
refused left that foe invulnerable to that client for the life of the
context. The rebuild is bounded now too: a build that cannot succeed on
this machine stops being asked after three tries and says so once,
instead of asking again several times a second for ever.

**FOE5 (medium) - the dungeon host trusted an unbounded number.** It
never recomputes the damage (the striker's own calc is the game's), and
had no ceiling, so any joiner could one-shot every foe in the room and
empty it through the kill door. The exterior twin has carried this bound
since WORLD6b; both now name the same one.

**FOE6 (high) - an orphaned puppet, permanent and bullet-proof.**
`_pupIndex` is written unconditionally at the stand and `removePuppet`
deleted **by key**, so when two builds for one `owner:seq` were in
flight - which `clearPuppets` opens, by emptying `_pupPending` while a
build is still out - the late one's self-removal evicted the record that
was actually standing. Every sweep walks `_pupIndex`, so that puppet was
reachable by nothing: not the stream, not the full frame, not
`pruneOwners`, not `clearPuppets`. It stood frozen at its spawn pose and
spawn health for the session and swallowed every blow. Deleted by
identity now.

**FOE8 (medium) - a City Watch puppet rebuilt five times a second.**
`makeEnemyEntity` adds `Range(3,7)` to a Knight_CityWatch inside the
constructor (DFU's own), so `entity.level` is never the level it was
built at - and the stream's `l` was compared against it, found a
mismatch on every record, and tore the puppet down and rebuilt it.
Compared against the build level now, which is what the record carries.

**FOE9 (medium) - a blow spent on a ghost.** `retypeFoe` swaps `foes[i]`
and marks the old record dead, but an arrow already in flight, a lock-on
or a melee pick from the previous frame still points at the old one.
`indexOf` answers -1, the divert was skipped, and the blow fell through
to the LOCAL path and landed on a body nothing draws and nothing
streams. With a joiner's roster retyping at nearly every index on
arrival, that is not rare. The blow is dropped instead.

### Found, measured, and NOT paid

- **The owner's 120 m cull deletes a foe a peer is fighting.** The peer
  keeps a live, attackable, un-damageable puppet until the next full
  frame (up to 2 s), then it vanishes mid-swing; the owner's `applyHit`
  finds nothing and returns false. The cull is **deliberate** - AUDIT
  WORLD6b-ii A2 chose my own relevance on purpose, because eight foes
  that walked off with peers held the pool full for the session. The
  proper fix is a removal record on the foes frame (the stream carries
  deltas and has no way to say "gone" but the next full frame's
  absence), which is a slice, not a patch, and it re-opens a budget a
  previous audit tuned. Not re-decided here.
- **The relay's three silent drops.** A hit rides the socket's POSE
  bucket, then a per-destination funnel (`HIT_ROOM_HZ_MAX` 60 - measured
  to bite at 7+ joiners in one room, 11.5% lost at eight), then a
  **room-wide** byte budget one looter at its ingress cap can exhaust
  for everybody. FOE2's queue cannot heal these: `sendHit` returned
  true, the frame left. An ack would be a protocol change.
- **A summon or ally cannot kill a peer's foe.** `fromPlayer === false`
  takes neither branch - no local damage, no divert - so a fall, another
  foe's maul, and your own Daedroth all do literally nothing to a
  puppet. The first two are WORLD2's law on purpose; the third is a gap
  in it.
- **A foe's blast on a puppet is credited to ME.** `world.js:3247` and
  `:2925` pass `foeSinks: (f) => enchantFoeSinks(f)`, dropping the
  provenance argument `applySpellToFoe` hands them (`hostMagic.js:187`)
  - the same shape AUDIT WORLD6b-iii(a) B2 fixed one layer down.
  Threading it touches four hosts.
- **A building interior streams no foes at all.** `makeInteriorFoes`
  never calls `setNet`, and the world host routes foes only for cells
  and dungeons - so every player rolls their own and sees different
  enemies in the same shop, while `test/world6b.test.js` asserts
  `streamsFoes('interior:…') === true`. WORLD6b-iii(d) closed buildings'
  foes as "none by the lockbook"; the quest foe, the summoning's
  punishment and the watch are each the player's own by a lock already
  written, so this may be correct and the test's claim merely wider than
  the shipped design. Named here so the next reader checks rather than
  assumes.
- **Authority blackout windows** of up to `FOES_STALE_MS` (6 s) where a
  joiner's hits go to a host that will not apply them - the host walked
  out of the dungeon, or `online.onHost` stamped `_foesInAt` for a host
  nowhere near it. Bounded, and it affects every foe at once, so it is
  not "certain enemies".
- **A peer's killing blow bypasses the Soul Trap tether** (WORLD2 B9, on
  purpose). Offline a trap with no empty gem holds a foe at 1 health and
  reads as "cannot kill this one"; online a peer's blow always kills.

## FOE10 - THE BLOW CROSSES, END TO END (2026-09-15)

Mac: *"Can you audit the online enemies. I think another session broke
other players being able to attack enemies."*

**He is right, and it is FOE1 above.** The archaeology is unambiguous:
`git log -S "host.onFoeHit" -- src/scenes/worldModes.js` names exactly
one commit that ever wrote that line (WORLD2, 2026-09-12) and exactly one
that removed it - `a0570bca`, *"HT1: Handheld Torches 1.4.1 ported 1:1"*,
2026-09-14, which appended `// HT1: the torch keys` to the end of the
line the property was sharing. A different slice, a different session,
and the whole of "other players cannot attack enemies".

**Nothing since has touched that path.** Every commit to
`src/net/online.js`, `src/net/wire.js`, `src/scenes/exteriorFoes.js` and
`server/src/` since WORLD6b is this arc's own; the Ambient Text wave, the
online-rest slice and the Discord door touched none of them. The receive
wiring (`world.js`'s `online.onHit`) has not changed since WORLD6b-i.
Verified on the merged tree by parsing rather than grepping: the
`buildDungeonContext` opts really carry `onFoeHit`, `world.js` really
hands it the wire through the pending set, `sendHit`'s halo route is
live, and the relay still routes a hit to the host alone.

**What this pass adds is the pin that was missing.** AUDIT WORLD34 A1
drove two real sessions through the real relay `Room` and held that the
host's FOES fan to the joiner and the joiner's ACT fans back - and never
drove the one frame this report is about. A blow is the only thing a
joiner cannot do for itself (it applies no local damage at all), so the
hit frame is the single point of failure for "other players can attack
enemies", and it was the one frame with no end-to-end pin over it. It has
one now: a joiner's blow leaves its socket, the relay routes it to the
HOST alone, and it arrives at the host's `onHit` with the striker named
and the payload whole - while a bystander in the same room hears nothing
and the host's own blows stay its own door's. Four mutations - the send
refused, the relay routing to the wrong socket, the relay dropping a
world room's hit, the host's receive gate closed - four dead.

**If it still looks broken in play, the fix is newer than the build.**
FOE1 merged to main today; Pages publishes from main on push, so a client
loaded before that deploy is still running the broken bundle. The build
stamp in the door's foot names the commit it was built from - `90dc0160`
or later carries the fix.

## PERF-ON (2026-09-15): the more people, the worse the frame

Mac: *"Next thing I want to tackle is improving online performance. I
notice the more people that are online, the worse fps becomes."*

The cost was MEASURED before anything was touched, and only one thing
in the online frame turned out to scale without a bound: the NAME over
each peer's head. Everything else already had one - `peerBodies` caps
the Morrowind rigs at `BODIES_MAX` 8 and culls past `BODY_RANGE` 120,
and a peer's doll is a single billboard batch created once, with only
its `origin` written per frame.

`RemotePlayers.drawNames` calls `drawText` a peer, and `drawText`
issued one `drawScreenQuad` a GLYPH - a full GL state setup each, about
seventeen calls a letter. A nine-letter name was 153 GL calls a frame a
peer; thirty peers was most of a frame spent on lettering. The fix is
in the renderer, not in `net/`, and is recorded in full at
`07-Rendering/Rendering-Arc.md` PERF-ON: the glyphs of a string are a
RUN, drawn by one instanced `drawScreenQuadRun`, so a name is 14 GL
calls and one draw whatever its length. Nothing in `net/` changed.
(NAME1, 2026-09-16: the enhanced lane - the only lane online runs in -
draws its names in the DOM layer `ui/nameLayer.js` now; this pass is the
bitmap face a document-less host draws, and the measurement stands for it.)

The pin that matters for this arc is the per-peer MEASUREMENT: 1, 4 and
16 peers must be 1, 4 and 16 draws, with no loose glyphs. That is the
symptom's own shape - what does one more peer cost - and it reddens if
the name pass ever grows a per-glyph cost again.

**Pinned** in `test/perfon_text_run.test.js` (7). NOT SEEN ON A GPU -
there is no GL in the container; Mac's eye is the next gate.

## ONCRASH1 - ONE FRAME ENDED EVERYBODY'S RUN (2026-09-15, Mac)

*"Receiving reports of player browser crashing when online."*

Two defects, both of them the same shape: **something arrives off the
wire and is handed straight to code that was never told it came from a
stranger.** Neither is reachable offline, which is why the reports all
say "when online".

### 1. THE SEAM - the handler's throw went to the window

`OnlineSession._receive` runs inside the WebSocket's `onmessage`. The
handlers it calls are not small:

| frame | what it reaches |
|---|---|
| `foes` | stands, retypes and steps every puppet in the room |
| `world` | applies a whole room's memory - dead foes, taken loot, doors |
| `hit` | lands damage, kills, mints a corpse's pile |
| `act` | moves doors, levers and platforms |
| `host` | swaps who STEPS the room's foes |

There was nothing between a throw in any of that and
`main.js`'s `addEventListener('error')`. So a throw did not lose the
frame - it put the red CRASH overlay over the run, and the next stream
tick put it back. Worse, the frame that caused it is another player's,
so the crash lands on the READER: the tab that dies is not the tab that
is wrong. A room of four with one client sending something unexpected
is three crashes and one player who saw nothing.

The port already knew the answer and had written it one layer up -
AUDIT MWBODY A1: *"a throw from one peer's rig is that peer's doll,
never the frame's end."* `_deliver` is that law at the wire's own door.

**It is not a catch-and-forget**, which would be the same outage with
the evidence deleted. The frame is dropped, the session stands, and the
throw is counted in `stats.threw`, printed in FULL the first time each
kind throws - once a kind, because a stream that throws throws at
`FOES_HZ_MAX` and a console flood is its own outage - and SAID on the
HUD status line for `THREW_SAY_MS`. A player who reports "it crashed"
now has the line naming which frame did it.

**This contains the crash. It does not fix the thrower.** What throws is
still a bug and still has to be found; what has changed is that finding
it no longer costs a room of players their session, and the port now
tells us which handler to look in instead of a stack in an overlay
nobody screenshots.

### 2. THE WRAP - a loop that could not terminate

```js
while (d >  Math.PI) d -= 2 * Math.PI;
while (d < -Math.PI) d += 2 * Math.PI;
```

Four copies of that, in `net/online.js` (easing a peer's yaw),
`net/peerBodies.js` (turning a peer's rig), `characters/enemyMotor.js`
(a puppet's facing) and `combat/fpArm.js` (the turn clip's rate) - all
four of them **beside a correct, one-step `wrapAngle` in
`player/lockOn.js` that none of them knew about.**

At a large angle the loop body is a no-op: `1e300 - 2 * Math.PI ===
1e300` in IEEE doubles, so the condition never falls and the loop runs
for ever. The tab stops answering and the browser kills it. And the
angle those two `net/` sites wrap is a **peer's yaw**, which the wire
checked for being finite and nothing else - `finite` admits 1e300. One
player's pose was enough to hang every other player in the room.

The loops are one step now (`world/mat4.js` `wrapAngle`, the port's one
math home, where the callers can actually reach it), and the wire's door
wraps the yaw besides - on the pose and on a streamed foe record - which
is what the wire's own law asks for: *it admits exactly what the game
can name*, and nobody faces 1e300 radians. **Wrapped, not refused**: a
turn is a turn whatever its winding, and `player/lookFilter.js`
ACCUMULATES the local yaw for the life of the session without ever
wrapping it, so a legitimate large-ish yaw must still arrive.

The yaw ALONE. Pitch reaches no wrap - the peer bodies stand level and
the dolls read no pitch - so wrapping it would move a field with no
defect behind it. An absurd pitch is recorded, not paid.

### What is honest about the two

The wrap is a **root cause**: that loop cannot hang any more, at the
door or downstream, and a fifth hand-rolled copy is refused by a
generative sweep of all of `src/`. Whether it is THE cause of Mac's
reports is unproven - it needs a yaw far larger than turning produces,
so it is a hardening fix until a report names it.

The seam is the likelier explanation for a crash overlay, and it is the
one that makes the NEXT report diagnosable: the crash text names its
frame now.

**Pinned** in `test/oncrash1.test.js`, and then AUDITED - see below,
because the pins were weaker than their own titles said.


## AUDIT ONCRASH1 - THE FIX THAT MADE ONE BUG WORSE (2026-09-15, Mac)

*"Audit this."*

Three lenses. The seam, the wrap and the wire, the pins and the record.
Two of the three found something that ONCRASH1 itself had caused.

### The containment made a crash into a silent duplication

`restoreSharedWorld` sets a latch and then applies the room's memory:

```js
if (shared.stamp === _sharedStamp || _sharedApplied) return false;
_sharedApplied = true;        // FIRST
applyWorld({ ... });          // can throw half way
applyLoot(shared.world.loot); // never runs if it did
```

Before ONCRASH1 a throw in `applyWorld` was a crash: bad, but the player
knew and the run ended. Contained, the throw is eaten and the latch stays
UP, so `restoreSharedWorld` refuses every later publish for the life of
the dungeon - and because `applyLoot` never ran, **every container the
room has already emptied is still full for this player.** They loot it,
the items enter their entity, and the next save write keeps them. A loud
failure became a quiet one that mints items.

That is the honest cost of containment, and the answer is not to stop
containing - it is that a handler must not commit before it can fail.
The latch is the LAST thing now; a failed restore leaves it DOWN and the
host's next `WORLD_PUBLISH_MS` publish retries. The interior twin
(`worldModes.js`) already had the order right; the dungeon arm was the
odd one out.

### The containment had a hole of exactly the shape it was closing

`_deliver` returned the moment its `fn` did. Three sites reached from
inside `onWorld` and `onFoes` start a promise whose `.then` body is deep
game code with **no `.catch`** - `retypeFoe(...).then((ok) => patchFoe(...))`.
The throw arrived a microtask later as an UNHANDLED REJECTION, and
`main.js` listens for those too. Same wire input, same handler, same red
overlay. `_deliver` follows a thenable to its end now, and each of those
three sites carries its own `.catch`, because the port's law is that a
throw is contained where it is RAISED.

### And the door was not where the fix was

`_deliver` wrapped the handler CALLS. The frame's own body - the roster
prune, `_member`, `_askWho`, the projections - sat outside every `try`,
so a throw there still reached the window. A lens proved it by driving
the real session in headless Chromium and watching `pageerror` fire. The
door is `onmessage`; the whole frame is one contained act now.

### Three doors, and the commit's claim covered one

ONCRASH1 said *"the wire's door bounds a streamed foe record"*. True of
the exterior cell, false of the dungeon - which is the path the reports
were about. `dungeonContext.js` never imported `validFoeRecord`; it
checked by hand, `Number.isFinite(r.y)` with no bound, the feet with no
`POSE_BOUND`, the health with no `FOE_HEALTH_MAX`. And the third door,
the room's MEMORY, had no projection at all: `patchFoe` writes
`f.ai.feet[0] = sf.feet[0]` and `f.ai.yaw = sf.yaw` raw, which is the
incident written down in that function's own comment - fixed there for
the ITEMS and left for everything else. The relay serves a memory back
unparsed for thirty days, so one bad record poisons every joiner for a
month.

All three doors are the wire's now: the stream through `validFoeRecord`,
the memory through a new `validSharedFoe` beside it, the pose through
`validPose`. A field outside the law is dropped; a record outside it is
refused whole.

### A heartbeat that a throw could keep alive

`_foesInAt` was stamped when a foes frame ARRIVED, not when it applied.
Contained, a stream that throws on this client every frame still read as
a live host, so `FOES_STALE_MS` could never fire and the seat never came
back: a dungeon of frozen puppets, indefinitely. The heartbeat is the
apply's word now.

### "Neither is reachable offline" was wrong

The commit said that. `world.js` `applyPose` did `cam.yaw = pose.yaw ??
cam.yaw` with no check, so a quickload or a classic import with a
corrupted yaw hung `fpArm`'s wrap with no socket in sight. Bounded now,
like the wire's.

And the loop that the wrap fix was about has a sibling the port had
already been burned by: `collider.move()`'s substep count. AUDIT WORLD3
F2 hit it - *"2.4e8 substeps and froze the tab for every player in the
room"* - and fixed it by normalising the vector at the ONE call site
that had caused it. Every bound lived in a caller. It has a ceiling of
its own now; past it the remainder is one step, which is what a teleport
is.

### The pins could not fail, again

The third lens mutated the source under them: **10 of 21 mutants came
back green.** A CLAMP passed for a wrap, because no input between PI and
2PI was ever tested. The "at the door or downstream" test pinned the
DOOR alone - every peer pose reaches `lerpAngle` through `validPose`,
which now wraps, so restoring the hanging loop downstream passed in
0.2 s. "Any ONE call site left bare" was false: there are two `world`
call sites and only the frame's was driven. And the generative sweep was
a regex for `while (... Math.PI ...)`, which a hoisted `TAU`, a
`for (;;)`, a recursive wrap and even `while (Math.abs(dy) > Math.PI)`
all walked straight past - the last because its own parenthesis broke
the character class.

Rebuilt: every wrap site is driven with the door BYPASSED, the wrap's
contract is pinned by exact value across `(PI, 2PI)` and at both ends,
the sweep looks for the SHAPE (a value stepped by a whole turn, inside a
loop or a self-call, with each file's own name for a turn resolved
first), and `{ timeout }` turns a hang into a red - `node --test` has no
default timeout, so "a hung pin is a failed pin" had been a hope, not a
mechanism.

**28 mutations, 28 dead**, including all ten the lens proved survived.

### What was and was not observed

ONCRASH1's record said *"NOT SEEN RUNNING ... the container has no GL and
no player in a room."* Both clauses are true and neither is a REASON:
nothing in this arc touches GL or needs a room, and a lens drove the
whole thing in headless Chromium here in under a minute, confirming that
a handler throw reaches `window.onerror` before the fix and does not
after. That is the same shape as the ARENA2 excuse this project was
burned by a day earlier. Said plainly instead: **the laws are driven in
node against a real session; the browser probe was run once by hand and
is not yet a pin; no live relay and no second player were involved.**

### Recorded, not paid

- ~~The corpse grant can duplicate loot.~~ **PAID** - LOOT-DUP, below.
- `lerpPose` can overflow a peer's PITCH to Infinity; inert only because
  `peerCamera` writes `c.pitch = 0`.
- `getMeleeWeaponAnimTime` returns 0 at speed 115 and the loop that
  reads it never terminates; unreachable only because `liveStat` clamps
  to 100 in another module.
- Six accumulator loops (`acc += dt; while (acc >= step)`) with no
  `MAX_FRAME_DT` clamp, where `player/motor.js` and
  `characters/enemyMotor.js` have one.
- `_peerHeights`, `remotePlayers._dolls`' failure entries and
  `peerBodies._failed` are never pruned.
- `wrapAngle(-PI)` is `+PI` where the four loops answered `-PI`, and the
  two differ by ~1e-6 at 1e6 rad because a loop accumulates rounding.
  The one-step answer is the correct one; the commit's "the same answer
  for a small angle" is true to about 1e-14.


## SLAM1 - TWO HUNDRED PEOPLE IN ONE SQUARE (2026-09-16, Mac)

*"This Sunday is Daggerfall's 30th anniversary. A streamer is going to
host a 30th celebration server slam smack dab in DFE."*

A pose reached everyone in the room within range, so one Durable
Object's cost was N senders times N listeners. MEASURED, over the real
`Room` on the fake DO, a crowd standing together:

| players in one room | pose sends/s |
|---|---|
| 16 | 2,400 |
| 48 | 22,560 |
| 96 | 91,200 |
| 200 | 398,000 |

Clean quadratic. The send counts are exact because they are arithmetic -
`N x (N-1) x POSE_HZ` - and they reproduce over the real `Room` on the
fake DO at 48, 96 and 200.

**AUDIT SLAM STRUCK THE CPU COLUMN THIS TABLE USED TO CARRY (15 / 71 /
223 ms per second), AND THE SENTENCE UNDER IT.** The 200-player row's
figure was withdrawn earlier for counting the harness's own `JSON.parse`
as Durable Object work; the other three rows are the same measurement and
should have gone with it. Re-run with that `JSON.parse` removed, 48
players is ~22 ms/s and 96 is ~60 ms/s against the published 71 and 223 -
inflated about 3.3x. And "somewhere around two hundred one object stops
keeping up" was never observed at all: nothing in this repo has ever run
against a Workers isolate, so there is no basis for naming the point where
one stops keeping up. What is true is the quadratic, which is arithmetic.

**The range cull does not save it, and finding that out killed the first
fix proposed for this.** The cull is why a cell is cheap when the
country is spread out. An event is everybody converging on ONE SPOT,
where every range test passes - and a cell measured identically to a
town at every population. Range-culling the place rooms would have cost
a slice and bought nothing for the one case it was bought for.

What saves it is that **nobody can see two hundred people.** A name
stops at `NAME_RANGE` (60 scene units), at most `BODIES_MAX` (8) peers
ever stand in a Morrowind body, and the rest are billboards in a crowd.
So a pose goes to the nearest `POSE_FAN_MAX` listeners and no further -
the same bound, and the same reason, as `rosterFor`'s
nearest-`ROSTER_MAX` welcome. The cost stops being N squared.

At 200 in one room: **64,000 sends a second instead of 398,000.**

> **CORRECTION (AUDIT SLAM).** The CPU figure first published here - "43%
> of one core instead of over budget" - was wrong and is withdrawn.
> About 60% of what it counted was the test harness's own `JSON.parse`,
> not Durable Object work; the relay's share re-measures at ~12%. "Over
> budget" asserted an observation nobody made: no budget is defined
> anywhere in this repo, and the unbounded 200-player room measures at
> ~9% of one container core of relay work. The SEND counts above are
> exact - and exact because they are closed-form arithmetic,
> `N x min(N-1, FAN) x rate`, not measurements. Calling them "measured"
> overstated how they were obtained.
>
> **And the direction of the win is not established.** On relay work
> alone the bounded path costs MORE at 200 players (~12% against ~9%),
> because `nearestFan` sorts ~199 entries for every pose. SLAM1 is only
> a win if `ws.send()` is expensive relative to that sort - plausible in
> a Workers isolate, unmeasured here, and it should have been stated as
> an assumption rather than left implicit.

A listener past the bound is told nothing for a while; it is **not
dropped**. The silence law (AUDIT ONLINE B3/B11/B14) HIDES a quiet peer
rather than removing it, so nobody leaves the room over standing at the
back, and anyone who walks closer resumes at the next pose.

`nearestFan` returns its list UNTOUCHED when it is under the bound - no
sort, no copy - because every ordinary room in the Bay would otherwise
pay for an event it is not having.

**Pinned** in `test/slam1.test.js` (6), driven over the real relay at the
room's own admission rate: one pose reaches exactly `POSE_FAN_MAX`
listeners and they are the contiguous NEAREST run (a first-N answer is
wrong by construction in the fixture), a cell is bounded like a town,
and nobody past the bound is closed or said to have left. **10
mutations, 10 dead.**

**NOT SEEN ON THE REAL RELAY.** Every number here is this container's
CPU against the fake Durable Object. A Workers isolate is not this
machine; treat the SHAPE (quadratic, then linear) as the finding and the
absolute milliseconds as optimistic. `RELAY_VERSION` is `world67` (this line first read `world72`: the later slices' version-bump seds relabelled it - the same in-place rewrite the ledger pin forbids for its rows, caught by the final audit), and the
relay must be deployed for any of this to be true in production.


## SLAM2 - A WAVE STOPS BEING A WAVE (2026-09-16, Mac)

A room admits `HELLO_HZ_MAX` hellos a second and refuses the rest with
`CLOSE_BUSY`. That is correct. What was not is that every client refused
in the same instant then waited the SAME `_backoff` and came back in the
same instant, so the wave stayed a wave - re-colliding at 1s, 2s, 4s,
8s, and each collision spending the room's hello budget on frames it had
to refuse rather than on players it could have admitted.

A stream saying *"everyone go here now"* is precisely a phase-locked
wave. The retry is spread uniformly across its window now, with the
floor at `BACKOFF_MIN_MS` so a jittered retry is never an instant one.
The backoff still DOUBLES, so a relay that is genuinely down is not
hammered: the jitter spreads the window, it does not shrink it. The
halo's retries are jittered the same way - eight rooms a client, all
refused together otherwise.

> **CORRECTION (AUDIT SLAM).** That last sentence was FALSE when it was
> written. The halo has three retry paths and SLAM2 treated two;
> `_openHalo`'s constructor-catch still read `this._now() + backoff`
> with no jitter at all. Closed in SLAM5. And none of SLAM2's four pins
> touched the halo, so all three could have been reverted and stayed
> green - the eight-rooms-a-client motivation the section leads with had
> no coverage whatever.

The jitter's source is INJECTED beside the clock, so the wave law is
pinnable and nothing reaches for `Math.random` behind a test's back.

### What this slice does NOT claim, and why that matters

The pin this wanted was the obvious one: drive three hundred real
sessions at the real `Room` and watch the wave drain faster. **It cannot
be written against `test/fakeRoom.mjs`, and finding that out is worth
more than the pin would have been.**

The fake Durable Object does not model the runtime's **input gating**.
Three hundred concurrent hellos all read the same `hellos` bucket before
any write lands, so every one of them is admitted and the gate appears
to do nothing at all. That is an artefact of the fake, not the truth
about production - the real runtime defers events while a storage
operation is in flight. Any conclusion about CONCURRENCY drawn from
`fakeRoom` is unreliable, and that now goes for every slice that uses
it, not just this one.

So what is pinned is the client's own arithmetic, which is the part this
slice changed: three hundred clients refused in the same instant come
back spread over at least twenty distinct moments with no moment holding
more than an eighth of them, against one single millisecond before.

**Pinned** in `test/slam2.test.js` (4). **6 mutations, 6 dead.**

**Recorded, not paid:** `onopen` resets `_backoff` to the floor the
instant the socket opens, before the relay has accepted the hello - so a
relay that accepts the handshake and then closes non-terminally is
retried at the floor for ever rather than backing off. Lens A raised
this during AUDIT ONCRASH1 and it is still open; the reset belongs on
the WELCOME, not on the open.


## SLAM3 - HOW OFTEN TO SPEAK IN A CROWD (2026-09-16, Mac)

SLAM1 bounded WHO hears a pose. This bounds HOW OFTEN one is said - the
last of the three terms in a room's cost (senders x `POSE_FAN_MAX` x
rate) still fixed, and the only one a client can lower without asking
anybody.

Past `POSE_CROWD` peers the rate comes down so the product stays roughly
flat: twice the crowd, half the rate, floored at `POSE_HZ_MIN`. **Under
the threshold nothing changes at all** - ordinary play in the Bay is two
or three people and must not pay for an event it is not having.

Measured, 200 players in one room on the fake DO:

| | pose sends/s |
|---|---|
| unbounded fan, 10 Hz | 398,000 |
| SLAM1's fan, 10 Hz | 64,000 |
| SLAM1's fan + this, 4 Hz | **25,600** |

> **CORRECTION (AUDIT SLAM).** This table first read `60,952` for the
> middle row and carried CPU percentages. `60,952` is **wrong** - it
> matches no formula in the code and contradicts SLAM1's own section
> four pages up, which says 64,000 for the identical configuration. The
> CPU column is withdrawn for the reasons given under SLAM1. Every send
> count here is arithmetic, not an observation.

### The ease had to move with it

This is the half that would have been easy to miss. The receiver eased
every peer over an assumed `1 / POSE_HZ`. That assumption was **already
wrong** for anyone on a slow line or a throttled tab - the ease finished
early and the peer stood still until its next pose, which is exactly the
stutter AUDIT MWBODY A8 names for the yaw - and slowing a crowded sender
would have made it wrong for everybody at once, turning a walk into a
series of hops.

A peer is eased over the interval **it is actually keeping** now,
measured at arrival and bounded both ways: a burst must not snap it, a
long silence must not make it crawl back. A peer that has not moved
twice yet has no interval and falls back to the default.

Measured MOVE TO MOVE, never from the welcome. The first cut took it
from `at`, which is also stamped when a roster entry first names a peer
- and the time between hearing OF somebody and seeing them move is not
an interval anybody is keeping. ONLINE1's own ease pin caught it.

**Pinned** in `test/slam3.test.js` (5), driven over a real session:
an ordinary room keeps `POSE_HZ` exactly, a crowd of 200 speaks at the
floor and `sendPose` really refuses the ordinary interval there, a peer
at 4 Hz is mid-ease at 125 ms rather than parked on its target, and the
measured interval floors and ceilings. **9 mutations, 9 dead** - the ninth being the welcome-measured gap above.

Note what the three slices together did NOT do: none of them shards a
room. One Durable Object still holds one town, and at some population it
will still be the wall - these bought headroom, not infinity.


## SLAM4 - WHAT ONLY EVER GREW (2026-09-16, Mac)

Three maps in the online path had no way of shrinking. None of them
matters in a twenty-minute test, which is exactly why none was caught:
each is keyed by a peer id or a LOOK, and the case they were written for
is a four-hour stream where hundreds of people come and go and almost
every look is seen once.

- **`_peerHeights`** (`scenes/world.js`) kept every id that had ever
  stood in the room, for the life of the session. Pruned against
  `online.peers` - the ROSTER, deliberately not the drawable set, because
  AUDIT WORLD6b-ii C5 put this map here so a height SURVIVES a peer not
  standing for a moment. Pruning by what is drawn would bring the aim
  flicker back.
- **`remotePlayers._dolls`** kept a `{ failedUntil }` record for every
  look that would not compose. `_evict` counts only the READY dolls, so
  those were never counted and never swept - and only re-asking for that
  exact look cleared one, which nobody does for a look worn once. They
  age out now, and the FAILURE path reaches the sweep at all: it was the
  one outcome that never did.
- **`peerBodies._failed`** kept every look whose Morrowind body would
  not build, forgotten only when a peer wearing that same look asked
  again. Swept past `BODY_RETRY_MS`.

All three keep a fresh entry: the retry window is what stops a broken
look being re-composed or re-built on every frame, and sweeping early
would trade a slow leak for a fast loop.

**Pinned** in `test/slam4.test.js` (4). **7 mutations, 7 dead**,
including both halves of each: never swept, and swept while still fresh.


## SLAM5 - THE HELLO PATH (2026-09-16, AUDIT SLAM)

Two findings from the lenses over SLAM1-4. Neither was SLAM1-4's doing;
both would have ended the event.

### A hard wall at 130 players

The hello arm read a look for EVERY hello'd socket - up to
`SOCKETS_MAX - 1` = 255 keys in one `storage.get(keys)` - only for
`rosterFor` to throw all but `ROSTER_MAX` away. **A Durable Object's
batched get takes at most 128 keys**, which this very file already
knows: `_sweep` and `alarm` both chunk their deletes at 128.

So the 130th player to join made the get THROW - after `_setAttach` had
already marked them present, and before the welcome or the join fan.
They sat connected, with an empty roster, no host and no clock,
invisible to a room that was never told they had arrived. Driven against
storage that enforces the limit: **129 of 200 join, the 130th throws on
a 129-key get.** (This line first said a 199-key get: that is what the
200th ATTEMPT asks for, not what the 130th throws on. The
"falls from 199 keys to ZERO" in Testing.md is right - that is the
largest get the old path ever reached.) `test/fakeRoom.mjs` accepts any
array length, which is
precisely why 7881 green tests never saw it.

Selecting the roster BEFORE reading the looks fixes the breach and the
waste together: at most `ROSTER_MAX` keys are ever asked for, and an
awake object asks for **none**, because `_looks` already holds what
every hello said. The `who` path has read it that way since AUDIT
WORLD6b-iii(e) B1; the hello path just never did. After: 200 of 200
join and the largest batched get is **zero keys**.

### One metric

`rosterFor` ranked by `pixelDistance` - Chebyshev on 32768-unit MAP
PIXELS - while SLAM1's fan ranks by squared Euclidean in the pose's own
frame. **Two metrics over one set do not nest**, so SLAM1's
`POSE_FAN_MAX <= ROSTER_MAX` pin asserted a nesting that did not exist:
measured at an event standing, only 11 of the 32 the fan reached were
among the 64 the welcome named, and 53 of those 64 were peers the joiner
would never hear from. And in a place room the poses are SCENE units, so
every pixel distance floored to 0, the sort was a no-op, and "the
nearest 64" meant the first 64 in socket order.

`nearestFan` is the one ranking now, at both doors, and the nesting the
pin claimed is real and pinned.

**Pinned** in `test/slam5.test.js` (5), driven over the real `Room`
against storage that enforces the 128-key limit. **8 mutations, 8
dead** - including one that survived the first cut: nothing asserted the
roster still CARRIED its looks, and reading nothing from storage looks
identical to answering null for everybody, which draws no peer at all.

## SLAM6 - THE FAN STOPPED ERASING PEOPLE (2026-09-16, AUDIT SLAM)

The first of the four AUDIT SLAM findings, and the one this branch's own
SLAM1 introduced: **the pose fan's bound did not quiet a distant peer, it
deleted one.**

**THE ROOT.** SLAM1 bounded the fan to the nearest `POSE_FAN_MAX` (32)
listeners and sent everyone else *nothing*. Its own note called that
"hearing silence", and pointed at the silence law to say nobody was
dropped. But the silence law is exactly what makes it fatal: a peer that
says nothing for `PEER_TIMEOUT_MS` is **HIDDEN**. So every listener past
the bound did not see a still figure - it saw an empty square.

And the bound is a **rank**, not a distance, so the loss is worst for the
player with the most people around them. The nearest 32 of a crowded
player fill a tiny radius; the nearest 32 of a lone walker reach the
whole town. At an event the most crowded player in the room is the person
everybody came for.

**MEASURED**, over the shipped law across a thirty-second standing, 200
players in a disc one RMB block wide (102.4 scene units), the streamer
dead centre; run twice, once with the crowd spread evenly and once packed
towards the middle, with identical results:

| | sends/s | the streamer was heard by | hidden from | worst gap |
|---|---|---|---|---|
| unbounded | 159,200 | 199/199 | 0 | 250 ms |
| SLAM1 | 25,600 | **32/199** | **167** | 250 ms |
| SLAM6 | 59,000 | **199/199** | **0** | 1000 ms |

**THE FIX IS A TIER, NOT A WIDER BOUND.** Raising `POSE_FAN_MAX` moves
the cliff; it does not remove it. `poseFan` (net/wire.js) sends every
pose to the nearest `POSE_FAN_MAX` and cuts everyone else into
`POSE_FAR_SHARE` slices by distance, serving one slice per pose by turns.
Every listener in the room hears the sender at least once per rotation,
the cost stays `POSE_FAN_MAX + ceil((n-1-POSE_FAN_MAX)/share)` per pose,
and the only state it needs is a counter on the sender's own attachment
(`turn`, masked to 16 bits).

**THE SHARE IS DERIVED, NOT CHOSEN.** A peer is eased over its own
observed interval (SLAM3), and that interval is clamped at `GAP_MAX_MS` -
past it the ease finishes early and the peer *stands*. A far listener's
interval is `share / hz`; the crowded rate never falls below
`POSE_HZ_MIN`. So `POSE_HZ_MIN * GAP_MAX_MS / 1000 = 4` is the largest
share for which every far peer still **walks**, and the measurement
agrees exactly: the longest any of the 199 went without the streamer was
1000 ms, which is `GAP_MAX_MS` to the millisecond.

**THE OTHER HALF IS AT HOME, AND WITHOUT IT THE FIRST HALF DELIVERS
NOTHING.** A pose from an id the welcome never named was *dropped* while
a `who` was asked - and the welcome names only the nearest `ROSTER_MAX`
(64), so at 200 players most of the room is a stranger to most of the
room. The `who` path is the room's scarcest arm (`WHO_HZ_MAX` 5 a second
per client, `WHO_ROOM_HZ_MAX` 60 a second for the whole room), so the far
tier would have reached people the client could not yet draw. A
stranger's pose now **stands** the peer where it says it is - the wire's
own default name, no look, and therefore the look-less doll that *every*
stranger shares, which costs the paperdoll cache one entry rather than
one per stranger. The ask goes on to learn who it is.

The mark for that ask moved with it: `_askWho` is keyed on whether the
relay has **introduced** the peer (`told`), not on whether a peer record
exists (which the stand makes true on the first frame, so the ask would
never be made again) and not on whether it has a look (which a peer that
hello'd without one legitimately lacks, so it would be asked about
forever). A **foes** frame is still the introduction's: a pose is one
figure standing where it says it is, a pool is a world, and AUDIT WORLD6b
A8/C6 holds unchanged.

`RELAY_VERSION` is `world68` (this line first read `world72`: the later slices' version-bump seds relabelled it - the same in-place rewrite the ledger pin forbids for its rows, caught by the final audit). **The relay must be deployed by hand for
any of this to be true in the room** - nothing in CI deployed it then; since
SRV-N/CI (PR #209) the push to main does, on a version drift.

**Pinned** in `test/slam6.test.js` (6) and in the two re-aimed SLAM1
relay pins, driven over the real `Room` on the fake Durable Object.
**14 mutations, 14 dead.** SLAM1's own test header carries a correction
naming what this withdrew.

**Still open, recorded and not paid** (the `who` path's throughput). At
200 players a joiner hears ~135 strangers and can ask for 5 a second,
against a room that answers 60 a second in all; the back of the crowd
therefore stands as the look-less doll for MINUTES before it wears its
own gear - measured after the fact at 172 s for the room and ~148 s for
the worst client, not the "tens of seconds" this line first claimed. Nobody is invisible and nobody is hidden, which is
what this slice was for, but the introduction is now the bottleneck the
fan used to hide. The fix is a batched ask - one `who` frame naming up to
N ids, answered with N joins - and it is a wire change, so it is its own
slice.

## SLAM7 - THE PAPERDOLL CACHE EVICTED THE SCENE (2026-09-16, AUDIT SLAM)

The second AUDIT SLAM finding. SLAM6 is what turned it from a footnote
into Sunday's problem: until this week the pose fan reached at most 32
listeners, so a client held at most 32 distinct looks and never came near
the cache's cap. The fan now reaches the whole room.

**THE ROOT.** `_evict` kept `DOLLS_MAX` (64) ready dolls and released the
rest - counting **every** ready doll, including the ones billboards were
standing in at that moment. `_release` destroys the batches wearing a
released look. So past 64 distinct looks in view, each sweep tore down a
peer that was *on screen*, which the next frame composed again, which
swept another. A paperdoll composite is not cheap and they are serialized
on one queue.

A second, quieter root underneath it: the order was **FIFO by birth, not
by use**. `_dolls.set(key, doll)` on a key already in the Map does not
move it, so "the oldest" meant the first look ever composed, however long
it had been on screen since.

**MEASURED**, 40 frames, one `sync` a frame, the compose queue draining
between frames as it really does:

| looks in view | composes (ideal) | billboards destroyed | peers drawn |
|---|---|---|---|
| 64 | 64 (64) | 0 | 64 |
| 70 | 304 (70) | 234 | 64 |
| 128 | 2,624 (128) | 2,496 | 64 |
| 199 | **5,464** (199) | **2,496** | **64** |

At 199 the 64 drawn were a *different* 64 each frame: the crowd
flickered, and the client paid 27x the compose work to make it do so.

**THE FIX.** A cache may evict what nothing is using; evicting what is on
screen is not eviction, it is a guaranteed recompose. The cap now counts
only the dolls **the scene does not need** - and "needed" is the looks the
last `sync` asked for and has not been handed yet, because a doll composes
**between** two frames and is worn by nothing for exactly that gap. (AUDIT
SLAM CORRECTION: this section first said "needed" was *two* things, the
worn looks *and* the asked-for looks, presented as independently
necessary. They are not independent: every batch is created inside the
same `sync` loop that fills `_wanted`, and a departed peer's batch is
dropped in the same `sync`, so the batch keys are always a subset of the
wanted keys and the "worn" half of `_needed()` does no work on its own.
Deleting it passed the whole suite. It stays as belt-and-braces against a
future caller that mints a batch outside `sync`, and this record now says
so rather than claiming a load-bearing role it does not have.) That gap alone cost
213 of the 412 composes the first cut of this fix still paid at 199
looks. Among the spares the map is now a real LRU: a key drawn this frame
is moved to the back, so the sweep takes the one nobody has looked at
longest.

**Measured after:** one compose per distinct look at every size (199 for
199), not one billboard destroyed, every peer drawn and none flickering.

**THE BOUND IS STRUCTURAL, AND IT IS A TRADE.** `_dolls` now holds
`DOLLS_MAX` spares plus one doll per look drawn, and the looks drawn are
bounded by the peers the host hands `sync`, which is bounded by the room
(`SOCKETS_MAX`). Driven: a brand-new look every frame for 400 frames,
8,000 distinct looks seen, 20 in view - the map settles at exactly
`DOLLS_MAX + 20` and releases all 7,916 of the rest. The cost is GPU
texture memory: a doll is a crop of a `PAPERDOLL_W x PAPERDOLL_H`
(110x184) RGBA composite, so a full room drawn is **15.4 MB**, or 20.3 MB
with the spares. (This line first said "single-digit megabytes", which is
true only if the alpha crop averages under about half the panel - nobody
measured that, so the bound stated here is the panel's.) That is the trade, taken deliberately: memory the machine has,
against a compose storm and a flickering crowd it does not.

**Pinned** in `test/slam7.test.js` (5), driven over `RemotePlayers` with
counting fakes. **9 mutations, 9 dead** - one of them a survivor of the
first cut: nothing asserted *which* spare the sweep takes, so evicting
the newest spare instead of the oldest passed every pin. The LRU is a
driven behaviour now, not a Map's incidental ordering.

## AUDIT SLAM (2026-09-16) - three lenses over SLAM1..SLAM7

Mac: *"Lets do a comprehensive audit on everything so far."* Three
adversarial lenses over the whole branch: the relay and the wire, the
client side, and the event end-to-end with the pins and this record.

**The headline is that the branch was not ready.** Twenty-odd findings,
the worst of them mine, and two of my own published claims withdrawn.
What follows is the ledger. SLAM8 pays the first two; the rest are named
here with their fix so nothing is lost.

### Paid in SLAM8

**A KEEPALIVE MUST NEVER BE TIERED.** `HEARTBEAT_MS` (5000) x
`POSE_FAR_SHARE` (4) = 20000 = `PEER_TIMEOUT_MS`, **to the millisecond,
margin zero**. A standing player sends nothing but the heartbeat, SLAM6's
far tier served one in four of those, and the silence law hides a peer at
exactly 20 s. Two hundred people standing still to listen to somebody is
what an event *is*, and every one of them would have watched the rest of
the crowd blink out and back at the 20-second boundary; one late
heartbeat hid a peer for a full twenty seconds. Driven over the real
`Room`: before, a standing sender reached 32 of 59 listeners; after, 59
of 59, every heartbeat. A moving sender is still tiered (155 sends where
unbounded is 236), so the saving SLAM6 bought is not handed back. The
cost of the fix at 200 standing is 200 x 199 / 5 s = **7,960 sends a
second**, beside the 59,000 the moving case already pays.

The category error: the tier is a bandwidth saving for MOTION, and a
keepalive is the one frame whose whole job is to be heard. `poseChanged`
moved to `net/wire.js` so the relay decides "did it move" with the
client's own law and the same epsilon - byte equality would let a hand
resting on a mouse re-tier the heartbeat.

**`turn` COUNTED POSES RECEIVED, NOT POSES RELAYED.** `_meter` writes its
patch back whether or not the rate gate passed, so the far tier's
rotation advanced on refused frames while the fan served only passed
ones. Any drop pattern sharing a factor with `POSE_FAR_SHARE` pins the
served slice to one parity; at exactly twice the gate the bucket settles
into pass/fail alternation and two of four slices are never served again
- SLAM1's erasure, back, for that sender. `_meter` now takes a second
patch applied only on pass.

**AND `RELAY_VERSION` CANNOT BE FORGOTTEN AGAIN.** SLAM5 changed the
relay's hello path and left the version at `world67`, so `world67` named
both the relay that stops an event at 130 players and the one that does
not - and `/health` is the only pre-flight check this port has, because
the relay is deployed by hand. A comment asking politely is what failed,
so the version is now bound to the law itself: `test/relayversion.test.js`
records sha256(`server/src/index.js` + `src/net/wire.js`) per version and
fails until a new version with its own hash is added. Proven against the
SLAM5 case verbatim.

### The pin that let it through

`test/slam6.test.js` asserted
`(POSE_FAR_SHARE * 1000) / POSE_HZ_MIN < PEER_TIMEOUT_MS` - which reduces
to `1000 < 20000` and is about the rate of a peer that is MOVING. The
peer at risk of the silence law is the one standing still. Mutating
`HEARTBEAT_MS` to 9000, which hides every standing far peer permanently,
passed all 7,897 tests. The line is corrected, and SLAM8 pins the
standing margin on the standing rate: a standing peer is heard
`PEER_TIMEOUT_MS / HEARTBEAT_MS` = 4 times before it could be hidden, so
neither one nor two lost heartbeats can erase somebody from a room they
are standing in.

### Recorded, NOT yet paid - in the order they should be

1. **The `who` path cannot introduce a full room.** Three lenses hit this
   from three sides. Relay: `WHO_ROOM_HZ_MAX` = 60/s against ~9,180
   introductions needed at 200 players = **172 s**, worst client waiting
   ~148 s. Client: measured **starving, not lagging** - 54 distinct ids
   asked of 135, 81 never, flat from one minute to ten, because
   `_askWho` has no cursor and reacts to pose-arrival order, which a
   rank-ordered far tier delivers stably. Those 81 stand for the whole
   stream as identical look-less dolls and their foes frames are refused
   for ever by SLAM6's `told` gate. **`WHO_ROOM_HZ_MAX`'s own comment
   justifies 60 as bounding STORAGE READS, and SLAM5 removed that cost** -
   the budget guards an expense that no longer exists. Fix: raise it, and
   make the client's ask a rotation cursor over untold peers in `tick()`.
2. **The world push is structurally unpayable past ~40 players.**
   `byteGate` caps its bucket at `rate`, so a charge larger than `rate`
   can never pass however long it waits; the dungeon/interior memory
   charges `frameBytes x unseenSockets` indivisibly against 4 MiB and
   latches `worldSeen` only on success. At 200 with a 100 KiB memory:
   **0 of 199 ever receive it, for ever, silently.** Doors, levers and
   emptied containers never sync. Pre-existing (WORLD34 C1 / WORLD2 A5)
   and reachable since long before SLAM5. Same shape on the act fan,
   where `actFrameFits` promises 16 KiB the relay can deliver at ~5 KiB.
   Fix: spend per listener inside the loop and latch `worldSeen` only for
   the sockets actually served.
3. **The far tier's slice is indexed by a rank that is re-sorted every
   pose**, so slice membership churns when the crowd moves and the
   "served once per rotation" law holds only for a crowd standing still -
   which is the only case SLAM6 measured. Measured on the shipped law:
   never-heard stays **0** at every speed (the erasure fix holds), but
   15% of pairs exceed `GAP_MAX_MS` at a shuffle and 50% at a walk, with
   worst gaps over 6 s. Smoothness, not erasure. Fix: bucket the far tier
   by a stable per-listener key (`hash(id) % share === turn % share`),
   which is true by construction under any movement and needs no sort.
4. **Stood strangers take all eight `BODIES_MAX` slots** and build eight
   identical default Morrowind rigs - the eight figures closest to the
   camera, each a multi-second mesh parse, paid twice. Fix: skip untold
   peers when filling body slots.
5. **SLAM2's first retry has a jitter span of exactly zero** (`_backoff`
   starts at `BACKOFF_MIN_MS`), so 200 clients return in the same
   millisecond after any close that is not `CLOSE_BUSY` - and because
   `_backoff` resets at `onopen` while `CLOSE_BUSY` arrives after open, a
   busy-room client retries at a fixed 2500 ms for ever.
6. **A peer crossing into the near tier is drawn at 4.1x its real speed**
   for a quarter second (SLAM3 x SLAM6: the eased interval collapses from
   1000 ms to 250 ms and the accumulated lag burns in one segment).
7. **~64% of the client's per-frame peer work is `lookKey`'s
   `JSON.stringify`**, recomputed for every peer every frame. Fix: a
   `WeakMap` memo keyed on the look object.
8. **`_rooms` membership is written only by a welcome or a join**, never
   by the poses that prove it, so a `leave` in one room deletes a peer
   alive in another; SLAM6 turns that from "she vanishes" into "she
   stands there with the wrong name and body".
9. **A socket blip re-anonymises everyone past the nearest 64** (the
   welcome's prune), and with finding 1 most never recover.
10. **The roster panel that landed on `main` while this branch was out**
    (CHAT-R1's net/roster module - NOT on this branch, which is why it is
    named without backticks; the bible's own path pin reads those, and
    was right to refuse a path that does not exist here). Its `rosterRows`
    lists every entry of `session.peers` with no introduction filter, so
    after the merge it fills with ~135 identical "Traveller" rows. Its
    comment that `ROSTER_MAX` bounds what a room reports is falsified by
    SLAM6: `peers` is bounded by the room (255), not 64, so its 200-row
    cap stops being belt-and-braces and can actually cut. Fix at the
    merge: list `told` peers. Mac has asked to hold the merge, so this is
    written down rather than paid.

### Corrections to this record

- **`Testing.md`'s slam1 row still carried the withdrawn CPU figure**
  ("43% of a core rather than 398k and over budget") after `Online-Arc`
  withdrew it. Struck.
- **The SLAM1 table's "DO cpu ms per second" column (15 / 71 / 223) is
  the same discredited measurement and was never withdrawn** - only its
  200-player row was. Re-run with the harness's own `JSON.parse` removed,
  48 players is ~22 ms/s and 96 is ~60 ms/s against the published 71 and
  223, so the surviving rows are inflated ~3.3x. Struck with the third.
- **"the 130th throws on a 199-key get"** (SLAM5) is wrong: the 130th
  throws on a **129-key** get. The 199-key get is what the 200th attempt
  asks for. `Testing.md`'s "falls from 199 keys to ZERO" is correct.
- **"tens of seconds"** for the back of the crowd to wear its own gear
  (SLAM6) understates by ~5x: measured **172 s** for the room, ~148 s for
  the worst client.
- **"single-digit megabytes"** for a full room of dolls (SLAM7) is
  unsupported. At the panel size this record itself quotes, 110x184 RGBA
  = 79 KB, so 199 drawn is **15.4 MB** and 20.3 MB with spares. The claim
  holds only if the alpha crop averages under half the panel, which
  nobody measured.
- **A FOURTH INVENTED PERFORMANCE FIGURE, mine.** `net/online.js` SLAM2:
  *"Measured over real sessions against the real relay, a 300-client wave
  drains in a fraction of the time and stops re-colliding."* There is no
  such harness in `test/` or `tools/`, and SLAM2's own section says the
  pin **cannot** be written against `fakeRoom`. Withdrawn.
- **`wire.js` and `index.js` still called SLAM1's send counts "measured"
  and still carried "one object stops keeping up somewhere around two
  hundred"** after `test/slam1.test.js` withdrew both. Struck there too.

### What the audit says about the pins

**Thirteen mutants survived the full 7,897-test suite**, at least one per
slam file - among them `POSE_FAN_MAX` 32 -> 8, `HEARTBEAT_MS` 5000 ->
9000, and deleting the worn half of SLAM7's `_needed()`. The "N
mutations, N dead" lines in this file were not false - those mutations
did die - but they were published as if they meant the pins were
adequate, and they do not: **the mutation sets were never committed, so
nobody could check.** They should be a committed script.

Three further pin defects, all real:
- `test/slam5.test.js` ships a literal tautology, `assert.equal(last, last)`,
  with a comment admitting the value is unused.
- The comment-stripper three pins share (`replace(/\/\/[^\n]*/g, ' ')`)
  **eats a real line of `net/online.js`**, because `wss://` contains
  `//`. Everything after it on that line is invisible to every pin that
  reads the stripped source - including SLAM2's sweep for stray
  `Math.random`.
- `test/slam4.test.js`'s `_peerHeights` pin is source text only: moving
  the prune line after `return out;` (dead code, text unchanged) keeps it
  green.

## SLAM9 - THE ROOM COULD NOT INTRODUCE ITSELF (2026-09-16, AUDIT SLAM)

The first of the audit's recorded-not-paid findings, and the biggest thing
wrong with the branch: all three lenses hit it, from three sides.

**AT HOME THE ASK WAS A REACTION, AND IT STARVED.** `_askWho` fired from
every stranger's pose as it arrived. A rank-ordered far tier delivers
those in a *stable* order, so the same head of the order re-qualified
after `WHO_RETRY_MS` and won the `WHO_HZ_MAX` token every time. Measured
over a real session - 199 peers, 135 strangers, ten minutes:

| | asks sent | distinct ids asked | never asked |
|---|---|---|---|
| stable arrival order (a far tier's) | 3,004 | **54 of 135** | **81** |
| the same, order reshuffled each second | 3,004 | 135 | 0 |

Flat from the first minute to the tenth. Not slow: **stuck**. The
reshuffled row is the proof the order was the cause. So the ask is now a
fair rotation from `tick()` over every un-introduced peer (`_askRound`):
each is reached once per pass whatever order its poses arrive in, skipping
any asked inside `WHO_RETRY_MS`, stopping when the gate is dry. **After:
135 of 135 asked, the last of them by t = 26 s** - one pass at
`WHO_HZ_MAX`, as the arithmetic says.

**AT THE RELAY THE BUDGET GUARDED A COST THAT NO LONGER EXISTED.**
`WHO_ROOM_HZ_MAX` was 60, and its own comment justified 60 as bounding
*storage reads*: "the one arm past the hello that reads storage (a look)…
1280 storage reads a second". SLAM5 deleted that cost - the hello fills
`_looks`, so an answer on an awake object is a map hit and one send. The
budget outlived its reason and it was binding: 200 clients offered ~1,000
asks a second against 60 answered, and the room took **172 s** to finish
introducing itself. It is now **derived**: `SOCKETS_MAX × WHO_HZ_MAX`, the
sum of every socket's own gate, so a room of correct clients asking as
fast as they are allowed is answered in full and the room-wide bound
binds only when the per-socket gates are not the whole story. And it is
spent *before* the scan for the target - a refused ask used to cost the
object a fresh `SOCKETS_MAX`-entry array and a linear search for nothing.

**TWO THINGS THE FIRST TWO MADE VISIBLE.**

*A socket blip re-anonymised everyone past the nearest 64.* The welcome
prunes the roster it does not name - the merge-not-wipe law (AUDIT ONLINE
B13) is about the peers it *does* name - and their next pose re-stood each
as a nameless, look-less stranger to be asked for all over again.
Measured: 199 named and dressed before the blip, 64 after the welcome,
135 "Travellers" a moment later. An introduction is a fact about an *id*,
not about a socket, so it is kept (`_known`, bounded at `KNOWN_MAX` = two
rooms' worth) and a re-stood stranger wears it at once, told. The join
fan keeps a remembered look current: a peer that changes gear re-hellos
and the relay tells the room.

*A pose is proof of membership in the room it arrived on.* `_rooms` was
written by a welcome or a join alone, so a peer introduced in my cell and
posing through a halo was never a member of the halo - and the cell's
`leave` deleted her while she stood, alive, in the next room over; her
next pose re-stood her as a stranger. Every room a peer speaks in holds
it now, and `leave` is per room, as WORLD6b-iii(b) meant.

**A version bump nearly relabelled deployed bytes.** The
`world69 → world70` sed over the test files rewrote the *key* of the
`world69` row in `test/relayversion.test.js`, so the row claimed `world70`
had `world69`'s hash. The pin caught it - which is what it is for - and
the file now says to exclude itself from that sed. `RELAY_VERSION` is
`world70`.

**Pinned** in `test/slam9.test.js` (6): the full-room starvation case
driven for 40 simulated seconds; the round's fairness (the next five, not
the first five again); the blip re-standing peers as themselves; the bound
on `_known`; membership from a pose across a halo; and 200 asks in one
instant all answered where the old budget answered 60. Five re-aimed pins
(`slam6`, `online`, `world6biiie`, `auditworld6biiie`) drive `tick()` now
rather than expecting an ask on the pose.

## SLAM10 - THREE OF SLAM6'S OWN REGRESSIONS (2026-09-16, AUDIT SLAM)

Audit ledger items 3, 4 and 6, all SLAM6's, paid together because each is
a consequence of standing strangers and tiering the fan.

**THE FAR TIER WAS INDEXED BY A RANK THAT MOVED.** SLAM6 cut the listeners
past `POSE_FAN_MAX` into `POSE_FAR_SHARE` slices of a list `ranked()`
re-sorts on every pose, and served slice `turn % share`. A rank is not a
stable thing. When the crowd moves, ranks shuffle; a listener crossing a
slice boundary between two turns is served twice or not at all; and
"served once every `share` poses" - which SLAM6 published as a guarantee
and derived `POSE_FAR_SHARE` from - was true only for a crowd standing
perfectly still, the one case it measured. On the shipped law, 200 in one
block at 4 Hz:

| crowd | never-heard pairs | pairs whose worst gap > `GAP_MAX_MS` | worst gap |
|---|---|---|---|
| standing | 0 | 0.0% | 1000 ms |
| shuffling, 2 u/s | 0 | 15.4% | 6750 ms |
| walking, 8 u/s | 0 | 50.1% | 5250 ms |

Never-heard stayed 0, so SLAM6's *erasure* fix held; what failed was the
smoothness law - a far peer sprinting six seconds of walking in one and
standing frozen for five, the exact artefact the share was derived to
prevent. The far tier is now bucketed by **`hashKey(listener id) % share`**
(`wire.js`, FNV-1a), a function of who the listener is and nothing else,
so over any `share` consecutive poses every far listener is served exactly
once *by construction*, whatever the crowd does. Driven both ways: a pure
200-body random walk at 8 u/s over 48 poses with **0 far pairs ever more
than `POSE_FAR_SHARE` poses unheard**, and over the real `Room` with the
far listeners' ranks permuted between every one of the sender's poses,
**every far listener heard exactly one**. The near set is still the
nearest `max` by distance - that half of the law is about who can see
whom, and distance is the right measure for it.

**A STRANGER TOOK A MORROWIND BODY.** SLAM6 stands a peer from its pose
before the relay has named it, and `PeerBodies` offers its `BODIES_MAX`
rigs to the *nearest* peers - so at an event the eight figures closest to
the camera were eight **identical default Bretons**, each a multi-second
mesh parse, each paid twice (once for the placeholder, again at
`BODY_REBUILD_MS` when the real look landed). A stranger keeps the shared
look-less doll - one compose for the whole crowd - until it is introduced;
the rig is the dearest thing a peer can wear and it waits for the name.

**A PEER CROSSING INTO THE NEAR TIER DASHED.** The ease is a lag
interpolator: `from` is where the peer is drawn, `to` the newest pose, so
the drawn figure trails by one interval. When SLAM6 promoted a listener
into a sender's near tier, that sender's interval fell from 1000 ms to
250 ms in a single step and the whole accumulated lag burned inside one
250 ms segment - a peer walking at 5 u/s drawn at **20.6 u/s** for a
quarter second, under `JUMP_UNITS` so the rig played the walk at 4x rather
than snapping. The measured interval may now **halve at most per pose**:
the catch-up is capped at twice the peer's real speed and converges in two
intervals (1000 → 500 → 250, pinned), growth is unbounded as before so a
silence still ceilings rather than crawls, and the steady state is
untouched.

`RELAY_VERSION` is `world71` (this line first read `world72`: the later slices' version-bump seds relabelled it - the same in-place rewrite the ledger pin forbids for its rows, caught by the final audit); the version bump was run with
`test/relayversion.test.js` excluded, as that file now says to.

**Pinned** in `test/slam10.test.js` (5) and in two re-aimed `slam6` pins
and one `slam1` count that encoded the rank-sliced far tier. **9
mutations, 9 dead**: the far tier back to rank slices (SLAM6 verbatim),
the bucket read off the rank index, the hash made constant, the bucket
ignoring the turn, the relay not passing the id, strangers taking bodies,
the interval collapsing in one step, shrinking too slowly, and growth
bounded too.

## SLAM11 - A FAN LARGER THAN ONE SECOND OF ITS BUDGET COULD NEVER LAND (2026-09-16, AUDIT SLAM)

Audit ledger item 2. Pre-existing since WORLD34 C1 / WORLD2 A5, and the
audit's one relay finding that was not this branch's doing - reachable
from ~40 players, long before SLAM5's wall at 130.

**THE ROOT.** `byteGate` is a token bucket **capped at `rate`**. Three
arms charged a whole fan - the frame times its listeners - as one
indivisible sum against it. A sum past the cap does not pass slowly; it
*never* passes, however long the caller waits, because waiting accumulates
nothing beyond the cap. Measured over the real `Room`, a 100 KiB dungeon
memory published to a room of N:

| players | fan per publish | sockets handed the memory |
|---|---|---|
| 8 | 0.7 MiB | 7 of 7 |
| 32 | 3.0 MiB | 31 of 31 |
| 64 | 6.2 MiB | **0 of 63** |
| 200 | 19.5 MiB | **0 of 199** |

`worldSeen` latched only inside `if (budget.pass)`, so nothing was
remembered and every publish re-attempted the same unpayable sum. Doors,
levers and emptied containers silently never synced, and the memory had to
be under ~21 KiB for a full room to receive it at all. The act fan had the
same cliff at ~5 KiB to 199 listeners, while `actFrameFits` told its
author anything up to `MAX_FRAME_BYTES` (16 KiB) would land - and a door
is not self-healing; nothing re-sends it.

**THE FIX IS A BUCKET THAT CAN BORROW** (`byteGate(..., borrow = true)`).
A must-deliver fan passes when the bucket is not *in debt* and takes it
negative by what it costs; nothing else passes until the rate has repaid
the debt. The rate law holds on average, the debt is bounded by one fan
(nothing passes while negative), and the frame lands whole instead of
never. Driven: a 110 KiB memory to 63 sockets, **63 of 63 handed it**,
once each, where the old law handed it to nobody; a 15 KiB act to eleven
listeners against a bucket one byte short of the fan, **every listener got
the door**, the bucket in debt by the overshoot, the next act waiting until
the rate repaid it.

**The memory push gets its own bucket** (`_roomWorld`). It used to charge
the *foes stream's*, and a 100 KiB memory's debt would have stalled live
foes for seconds. **The foes fan does not borrow**, deliberately: it is a
continuous stream where one oversized fan would block the next second of
frames, and dropping a frame whole is the kinder failure there - the next
full frame heals it. Its own cliff - a frame the sender cannot make land at
this room size - is the sender's to chunk, and is recorded below.

`RELAY_VERSION` is `world72`.

**Pinned** in `test/slam11.test.js` (6, the sixth added by PINS - the refused push): the plain bucket's cliff (so the
reason for borrowing stays true), the borrowing bucket's four laws, the
memory landing past the old cliff on its own bucket once each, the act
landing and waiting, and the foes fan *not* borrowing. `auditworld3`'s act
pin re-aimed from "over the budget: dropped" to "in debt: dropped; not in
debt: lands and goes into debt". **8 mutations, 8 dead** - borrow ignored,
the debt not charged, passing while in debt, the memory back on the foes
bucket, the memory without borrow, the act without borrow, the foes *with*
borrow, and `worldSeen` latched on a refused push.

**Recorded, not paid:** the foes stream's own cliff. `FOES_FRAME_MAX`
(64 KiB) is legal by the wire, and at 199 listeners any frame over ~21 KiB
is dropped whole on every publish - not one frame, *all* of them, so "the
next full frame heals it" is false for a host whose pool is that large.
The relay cannot fix an oversized stream; the sender must chunk it, or its
cap must be a function of the room's size. A client change, its own slice.

## SLAM12 - THE CLIENT'S HYGIENE (2026-09-16, AUDIT SLAM)

Audit ledger items 5 and 7 and three of Lens B's smaller findings, each
small, each real, paid together because they share no law with anything
else on the ledger.

**SLAM2's first retry had a jitter span of exactly zero.** `_backoff`
starts at `BACKOFF_MIN_MS`, so `_backoff - BACKOFF_MIN_MS` was 0 on the
first retry and `rand()` was multiplied by nothing. Measured over 200
sessions dropped in one instant: **one distinct return instant.** The
jitter began on the *second* retry, and a wave collides on the first - a
relay restart, a Durable Object eviction, the `room full` 503 that never
opens the socket. The span's floor is now `BACKOFF_MIN_MS` at all four
sites (the primary's, and the halo's three), so round one is uniform over
[1 s, 2 s]; rounds one and two share a window and the doubling shows from
the third. **Three of the four sites had no pin at all** - the mutation
batch found each in turn (the halo's close path, its tick path, its
constructor-catch), and each is driven now with 200 sessions and 200
distinct instants.

**`_backoff` was reset when the socket opened**, and a full room's
`CLOSE_BUSY` arrives *after* it opens (the hello gate), so the reset undid
the hard back-off `CLOSE_BUSY` had just set: a client against a busy room
retried at a fixed 2500 ms for ever, and SLAM2's doubling never happened
in the one case it was written for. It is reset by the **welcome** now -
the relay saying yes - for the primary and for each halo. Pinned on the
retry *delay*, not on `_backoff`, because the latter reads the ceiling
under both the fix and the mutant: 2500 → 4500 → 4500 → 4500 against the
mutant's 2500 for ever.

**A terminal close never forgot its room.** 199 stale peers were eased by
every tick and counted by `poseHzFor` for the life of the page. A
`CLOSE_REPLACED` or `CLOSE_POLICY` forgets the room now. A plain drop
still keeps its peers **on purpose**: through a one-second blip the crowd
stays drawn where it was rather than vanishing and re-standing, and the
reconnect's welcome merges over it (AUDIT ONLINE B13). Both halves pinned.

**`lookKey` re-stringified every peer's look every frame** - once per doll
peer in `RemotePlayers.sync`, once per peer in `PeerBodies.sync` - and at
199 dressed peers that `JSON.stringify` was ~64% of the client's whole
per-frame peer work (1.19 ms of 1.85 ms, measured). A look object is
replaced, never mutated, so a `WeakMap` on it is exactly the key's
lifetime. Pinned: a thousand reads of one object, zero stringifies.

**A doll that landed after its key was released kept its GPU texture** -
after `_evict`, or after `destroy()` at the page's hide - with nothing
referencing it. Measured: sync fifty peers, destroy, fifty uploaded, none
released. The late arrival frees its texture now.

**Pinned** in `test/slam12.test.js` (8). Two lifecycle pins re-aimed to
the jittered window (`online`: deterministic `rand`, the window's edges,
"a good open resets it" → "the welcome resets it"; `chat1`: the retry read
at the window's far edge). **10 mutations, 10 dead** - three of them
survivors of the first cut, one per unpinned halo site, each closed with a
driven pin before the count was written down.

## PINS - THE AUDIT'S THIRTEEN SURVIVORS, AND THE LISTS THAT PROVE THEY ARE DEAD (2026-09-16, AUDIT SLAM)

AUDIT SLAM's second section found **thirteen mutants that survived the
full suite**, at least one per slam file, and observed that every "N
mutations, N dead" in this record described a set nobody could re-run.
This slice closes both.

**The thirteen.** Two were closed by SLAM8 (`HEARTBEAT_MS` 9000,
`PEER_TIMEOUT_MS` 5000 - the standing-crowd margin), one by SLAM12 (the
halo jitters reverted). The rest are closed here, each by a pin that can
fail:

- **S1** `POSE_FAN_MAX` 32 → 8: every pin was written in terms of the
  constant. It is 32 now by assertion, with its reason, and it is pinned
  *above* `POSE_CROWD`. (The final audit corrected the rationale this line
  first gave: the share's derivation `POSE_HZ_MIN × GAP_MAX_MS / 1000`
  depends on the floor rate alone, not on the bound's place against the
  crowd threshold. The pin is kept - a bound under the threshold would tier
  a room the rate law leaves at full speed - but it is not a premise of the
  derivation.)
- **S3** the backoff cap removed: driven to eight drops, the wait sits on
  `BACKOFF_MAX_MS` and stays.
- **S4** `poseHzFor` `round` → `floor`: `poseHzFor(32)` is 8, not 7.
- **S5** `GAP_MIN_MS` 50 → 1: pinned equal to `1000 / POSE_HZ_MAX` - the
  floor *is* the fastest cadence a correct client can keep.
- **S6** `DOLL_RETRY_MS` 5000 → 50, **S11** `DOLLS_MAX` 64 → 5: the
  constants once and literally, with why.
- **S7** the welcome roster losing its poses: driven - a joiner's welcome
  places each peer where it said it stood.
- **S13** `destroy()` not clearing `_wanted`: driven.
- **S12** the worn half of `_needed()` deleted: **kept alive by
  decision.** Every batch is minted inside the same `sync` that fills
  `_wanted`, so the worn half is a subset of the wanted half and does no
  work on its own; SLAM7's record claimed both halves were independently
  necessary and is corrected above. The code stays as belt-and-braces and
  the mutant is recorded as *equivalent*, not as a gap.
- **S10** the `turn` mask: cosmetic - the value is only ever read modulo
  `POSE_FAR_SHARE` - and recorded, not pinned.

**The pins the audit called weak.** `slam5`'s literal
`assert.equal(last, last)` is deleted, and its `maxKeys <= 128` bound,
subsumed two lines later by `maxKeys === 0`. `slam3`'s restatement of the
source's own `Math.max` is deleted. `slam7`'s `> total - 5` release bound
is exact equality now. `slam2`'s 400-character source slice - 2.5x the
function it meant to read, spilling into two neighbours - runs to the
matching brace. `slam4`'s `_peerHeights` pin, which stayed green when the
prune was moved after `return out;` as dead code, now reads the order:
push, prune, return.

**The stripper that ate a line.** Three pins shared
`.replace(/\/\/[^\n]*/g, ' ')` to strip comments, and `wss://` contains
`//`: everything after it on that line of `online.js` was invisible to
every pin reading the stripped source - including `slam2`'s sweep for a
stray `Math.random`. The two remaining uses strip only a `//` that begins
a comment.

**THE LISTS ARE COMMITTED.** `tools/mutate.mjs` runs a JSON list of
mutants - apply, test, restore byte-for-byte, report - and
`tools/mutants/` holds the exact sets for SLAM8 through SLAM12 and this
slice. Run over all fifty-seven: **55 dead, 2 survived** on the first
pass. One was S12, by decision, now flagged `equivalent` with its reason
so the harness reports it as recorded rather than as a gap. **The other
was a real gap the committed list found on its own**: SLAM11's "`worldSeen`
latched on a refused push" had died in a by-hand run and survived the
committed one - nothing drove the *refused* push. It does now (`slam11`:
a bucket in debt hands the memory to nobody and latches nobody; repaid,
the next publish hands it to everyone), and the re-run is 19 dead, 0
survived, 1 equivalent as recorded. That is the whole argument for
committing the lists, made by the lists.

SLAM1-SLAM7's mutation sets predate the harness and are not recoverable
verbatim; their counts stand in this record as they were run, and the
thirteen survivors the audit found among them are the ones closed above.

## AUDIT SLAM FINAL (2026-09-16) - three lenses over SLAM8..PINS, the merge gate

Mac: "Do one more audit before we merge. Needs to be perfect." Three
lenses, the same three as AUDIT SLAM (A the relay and the wire, B the
client, C the harness, the pins and the record), over everything from
SLAM8 to PINS. The verdict was NOT READY on lens A, READY WITH ONE CLAUSE
on lens B, and a list on lens C. What each found, and where it is paid:

**Lens A - the relay (paid in SLAM13).** A1 the act fan's borrow was one
sender's to hold - a modified client sending the largest act to a full
room put the room's bucket four seconds in debt per frame, at
`ACT_HZ_MAX`, and every other door was refused while it did. A2 the
keepalive's whole fan had no floor - SLAM8 fans an unmoved pose to
everyone because the port's client sends one every `HEARTBEAT_MS`; a
modified client sends them at `POSE_HZ_MAX`, 20 x 199 sends a second from
one socket. A3 `poseChanged` compared the yaw bare across the -PI/PI seam
`validPose` wraps into, so a player facing due south had every keepalive
tiered - SLAM8's bug back for one heading. A4 the memory push borrowed the
whole fan: the largest memory into a full room is 127 MiB queued in one
tick, the object's whole memory. A5 a version skew was invisible from both
ends: the client ships by CI and the relay by hand, `main` is `world66`
(the relay that dies at the 130th hello), and nothing on either end could
see the disagreement. A6 (recorded, not paid): a mover's STOP pose - the
first unmoved one - is tiered like a move, so a far listener may ease a
peer to a place it never went for up to `GAP_MAX_MS`; the next heartbeat
corrects it. Judged tolerable: one second, once, and only past the bound.

**Lens B - the client (SLAM14).** B1 `heardIn` is set once, on the first
stranger's pose, and never refreshed for a known untold peer - so an ask
can go to a room it has left. B2 a reconnect's welcome `_unmember`s the
135 of 199 the roster does not name, blanking them for a round trip; they
should be stamped unconfirmed and dropped only if no pose follows. B3 a
`_known` look is stood as told and never re-asked, so a peer that changed
its gear between rooms keeps its old look; and the comment "a peer that
changes its gear re-hellos" is false - nothing re-hellos on a gear change.
B4/B5 (recorded): `_needed`'s worn half is redundant with `wanted`; the
`dollFor` orphan-texture release is right but unpinned. B6 `lookKey(null)`
recomputes each time; a constant.

**Lens C - the harness, the pins, the record.** C1 the one number nobody
has: what a deployed Durable Object carries. The fake has no limit, every
"sends a second" in this record is arithmetic over the law, and the lines
that claimed to know where a real object stops ("past about two hundred it
cannot keep up", "observed a real object carry") were struck by SLAM13.
**Mac must load-probe the deployed worker** - 200 walking clients against
`/health`'s `world73` - before Sunday; nothing in this repo can. C2 the
version pin goes red at merge because `main`'s `wire.js` differs - mint
the next version at the merge commit, do not relabel. C3 `main`'s
`rosterRows` must skip `told === false`. C4 = B2. C6 `tools/mutate.mjs`
read a child killed by ENOBUFS (status null) as "dead": hardened - a
function replacer, `maxBuffer` 256 MiB, a null status is HARNESS ERROR and
fails the run. C7 `chat1`'s hello burst read the real clock - held now.
Survivors the lens found: the relay hash covered two files while the
bundle is four (paid: the import graph); the world bucket's rate and
refill cap unpinned (paid); the halo welcome-reset unpinned (SLAM14); the
`dollFor` release arguments unpinned (SLAM14); `_who`'s bound unpinned
(paid); `poseHzFor(33)` (paid). Record errors, corrected: SLAM1/6/10's
version lines relabelled by the seds; SLAM11's pinned count; PINS S1's
rationale; `slam8:82` asserted the HAZARD's presence (a smaller share
would have failed the pin) - reworded to pin the law; the act-debt bound
`<=` needed slack (the SLAM11 pin asserts `< 0` and the SLAM13 pin `>
-frame`); the `relayversion` row's "4 mutations" had no committed list
(it has: `tools/mutants/relayversion.json`, 5 dead).

## SLAM13 - THE FINAL LENS'S RELAY FINDINGS (2026-09-16, AUDIT SLAM FINAL)

Five holes in law the slams before it wrote, each one a modified client or
a large room could put a full room through. `RELAY_VERSION` is `world73`.

**A1 THE SENDER'S SHARE.** `ACT_SENDER_BYTES_PER_S` = a sixteenth of
`ACT_ROOM_BYTES_PER_S` (64 KiB/s), a borrowing bucket on the sender's
attachment (`abytes`), charged BEFORE the room's. A frame the sender's
bucket refuses charges the room nothing; a frame the room refuses charges
the sender nothing (its bucket is refilled, not charged) - an honest
sender behind a flooder does not pay for a door that never opened. Sixteen
honest senders fill the room's rate exactly; one flooder holds at most a
sixteenth of it; an honest door - a few KiB to a room - lands whole and at
once. Driven: a 15 KiB act to 63 listeners (945 KiB a fan, past both
rates) lands whole and puts its sender in debt; the second is refused by
the sender's share and the room's bucket is untouched to the byte; an
honest door from somebody else lands for everyone.

**A2 THE KEEPALIVE FLOOR.** `KEEPALIVE_FAN_MS` = `HEARTBEAT_MS / 2`. A
keepalive is fanned whole only when the sender's last whole fan (`kept`,
stamped on the PASS patch as `turn` is, so a gate-refused pose that
reached nobody does not restart the floor) is that old; inside the floor
it is tiered like a move. Half the heartbeat so an honest client's every
heartbeat clears it with jitter to spare; a flood buys at most two whole
fans a second. `HEARTBEAT_MS` moved to `wire.js` so the floor and the
period cannot be tuned apart; `online.js` re-exports it. Driven: four
identical keepalives in one instant - the nearest hear four, the far tier
hears the first whole and a share of the rest; a heartbeat later, whole
again for everyone; half a heartbeat later, whole again. And the pass
patch: a walk drains the gate, a keepalive is refused, the next honest one
is heard whole by all 59.

**A3 THE YAW SEAM.** `poseChanged` compares
`Math.abs(wrapAngle(a.yaw - b.yaw))`. Driven at the wire (0.002 rad
across the seam is unmoved; a half turn is a turn; a full winding is no
heading) and at the relay (a standing player facing due south, drifting
across the seam every heartbeat, is heard by the farthest listener at
every one).

**A4 A LISTENER AT A TIME.** The memory push charges its bucket per
listener and stops at the first refusal; the ones not served stay UNSEEN
for the next publish (`WORLD_PUBLISH_MS`, by which time the rate has
repaid the debt). The debt is never deeper than one frame. A 100 KiB
memory reaches forty listeners a publish, a 20 KiB one the whole room in
one; the largest (512 KiB) reaches nine. Driven with a 480 KiB memory into
19 listeners: 9 served (a second of the rate plus one on the borrow), the
debt under one frame and exactly `FOES_ROOM_BYTES_PER_S - 9 x frame`, the
served latched and nobody else; a minute idle refills one second's worth,
not sixty; the rest on the following publishes, nobody twice. SLAM11's
"every one of the 63 handed it on one publish" is re-aimed to the rate: 38
this publish, all 63 by the next.

**A5 THE VERSION IN THE WELCOME.** `RELAY_VERSION` lives in `wire.js`
(index.js re-exports it for `/health` and the nine pins), and every
welcome - a place room's and a channel's - carries it as `v`. The session
compares it with the `RELAY_VERSION` it was built with and says a skew
ONCE on the console and on `statusLine` while it stands
(`VERSION_WARNING`: "the relay is running another version than this
client - reload, or the relay needs deploying"); a matching welcome clears
it; a welcome with no `v` is a relay older than world73 and is said as
"unversioned". Nothing is refused: a skew is news, not a fault, and the
old law still walks.

**THE RELAY'S LAW IS THE BUNDLE.** `test/relayversion.test.js` hashes the
worker's import graph from `server/src/index.js` (relay.js, wire.js,
world/mat4.js), pins the graph, and from world73 records that hash. The
rows before it stay under their day's two-file hash.

**Struck.** The three lines claiming to know where a real object stops
(`wire.js` x2, `index.js`), and `slam1`'s header and Testing.md row that
repeated it.

**Pins.** `test/slam13.test.js` (11): one home for the numbers, the seam
at the wire and the relay, the burst tiered and the heartbeat whole, the
pass-patch `kept`, the sender's share both ways, the listener-at-a-time
push with its rate and cap, the version in both welcomes, the session's
warning said once and cleared (retired by SKEW1 below - it was the two
lines Mac saw outside the chat box), and the final lens's small survivors (the
`_who` prune, `poseHzFor(33) === 7`, `byteGate`'s cap). Re-aimed:
`slam8` (keepalives at the heartbeat, on a held clock; the inverted trap
line), `slam11` (the rate, not the whole room), `chat1`/`world5`/
`online_relay` (the welcome carries `v`; the hello burst on a held clock),
`auditworld3` (its act-debt lines on a held clock - the pin re-stamped the
bucket at `now` and flaked one run in five under a real one). Mutants:
`tools/mutants/slam13.json` - **17 mutations, 17 dead**;
`tools/mutants/relayversion.json` - 5, 5 dead.

## SLAM14 - THE FINAL LENS'S CLIENT FINDINGS (2026-09-16, AUDIT SLAM FINAL)

Lens B's "ready with one clause", the clause and its neighbours paid. No
relay change; `RELAY_VERSION` stays `world73`.

**B2/C4 THE RECONNECT BLINK.** The welcome handler `_unmember`ed every
peer the roster did not name, and the roster names the nearest
`ROSTER_MAX` - so every blip dropped 135 of 199 to be re-stood a round
trip later by their next pose (dressed, since SLAM9, but gone from the
screen and their bodies torn down meanwhile). A welcome says who is NEAR,
not who is HERE. The unnamed are kept and stamped `unconfirmed` for that
room (a per-room map on the peer); a pose or a join in that room confirms
it (`_confirm`), a leave answers for it, and one that never speaks again
leaves each such room in `tick()` when the silence law hides it -
`PEER_TIMEOUT_MS` since it was last seen, the moment it would have
vanished from the screen in any case. Nobody present blinks; a peer that
left while I was away is pruned. Driven: 199 stand, the blip's welcome
names 64, all 199 still stand and draw; a pose confirms one, a join
another, a leave takes a third; at the timeout nobody is dropped, one
millisecond past it the 132 that never spoke again are gone and the two
confirmed stay. And per room: named by my cell's roster and unnamed by a
halo's, a peer is unconfirmed in the halo alone; a pose in my cell says
nothing about the halo, a pose through the halo confirms her there.

**B3 THE RECALL.** SLAM9 stands a re-met peer in the look it wore, told,
and its comment said the join fan keeps that look current because a peer
re-hellos when its gear changes. Nothing does: a look rides the hello
alone, so a peer that changed its gear between rooms or during the blip
wore its old look here for as long as it stayed. A peer stood from memory
is `recall` now: told (drawn dressed at once, its bodies stood, its foes
trusted) and walked by `_askRound` as a stranger is; the relay's join
answers with the look it holds and `_refresh` clears the flag. One ask per
re-stood peer, at the who gate. The false line is struck and pinned
struck.

**B1 `heardIn` FOLLOWS THE POSES.** Stamped once on the standing pose, a
stranger first heard in my cell and since heard only through a halo was
asked for down the cell's socket, where the relay no longer held it. The
ask goes down the socket its latest pose came on.

**B6** `lookKey(null)` is one constant (`NULL_LOOK_KEY`).

**Two of lens C's unpinned survivors, pinned.** The HALO's welcome resets
the halo's backoff (SLAM12 pinned the primary's alone; driven up the
ladder by three `CLOSE_BUSY`s, opening alone does not reset it, the
welcome does). The late-landing doll's texture is released to
`PEER_ARCHIVE` by its record (driven: compose held open, `destroy()`, then
the doll lands - one release, the archive and a record string).

**Re-aimed.** `online` (Zed unnamed is kept, unconfirmed, and goes past
the timeout; a roster that is not a list names nobody and drops nobody),
`slam9` (the welcome keeps the 94 it did not name; the re-standing is
driven by leaves; the re-stood are recalled at the gate's pace and the
answers clear it), `world6biiib` (a fresh halo roster keeps Ann,
unconfirmed there, until she is silent past the timeout).

**Pins.** `test/slam14.test.js` (6). Mutants: `tools/mutants/slam14.json`
- **15 mutations, 14 dead, 1 equivalent as recorded** (Y13: the constant
and the recomputation are the same string; the saving is a
`JSON.stringify` per look-less peer per frame, unobservable from outside;
the source pin holds the constant's presence).

**Recorded, not paid.** A6 (a mover's stop pose is tiered - one second,
once, past the bound), B4 (`_needed`'s worn half is redundant with
`wanted`), B5 (`_wanted`'s pin is by outcome, not by list). C1 stands:
**the deployed object is unmeasured; Mac must load-probe it.**

**The whole sweep, on the tree as committed.** `node tools/mutate.mjs
tools/mutants/*.json` over every list from SLAM8 to SLAM14 and the two
support lists: **94 mutants - 92 dead, 0 survived, 2 equivalent as
recorded** (S12, Y13). Eight records had moved with SLAM13's source
(`HEARTBEAT_MS`'s home, the pose arm's `now`, the per-listener push) and
were re-aimed to the new lines, not dropped - a list that cannot apply is
a count nobody can re-run, which is what the lists exist to prevent.

## MERGE - the slam branch onto main (2026-09-17)

Mac: "Merge." `main` had moved under the branch by SRV-N, AUDIT-SRVN and
CHAT-G (a server restart notice, its four findings, the chat's third
gate). What met, and how it was settled:

- **One `v` on every welcome.** SRV-N and SLAM13 A5 both put the relay's
  version on the welcome, for different readers: SRV-N's `onRelay` →
  `net/updateNotice.js` tells a player the relay RESTARTED under them
  (a change of name across reconnects, whatever the name); SLAM13's
  `versionWarning` tells them this CLIENT was built against another law
  than the relay is running (a skew against `RELAY_VERSION`, said once on
  the console and the HUD line). Both stand, on the one field, in SRV-N's
  place (last, after `now`) and SRV-N's channel shape. `RELAY_VERSION`
  lives in `wire.js` (SLAM13) and is `world74`.
- **The nine version pins** take SRV-N's monotone `relayVersionAtLeast`
  form, which ends the nine-file sed for good; `relayversion.test.js`
  keeps binding the name to the bytes, and its graph pin caught the
  worker reaching `net/nameFilter.js` through CHAT-G - the row for
  `world74` is the first over five files.
- **The hello path** is SLAM5's (the roster chosen before the looks are
  read); main's still read every socket's look and would have died at the
  130th player.
- **`rosterRows`** is left as main wrote it. The final lens asked for a
  `told === false` filter; main's CHAT-R1 pin says "a nameless peer is
  still a row", and a stranger stood by its pose IS in the room - it is
  counted, wears the fallback name until the `who` answers, and the
  roster's count stays true. Mac's pin over the lens's ask.
- **Cites** re-mapped with `tools/citeMerge.mjs` (14 moved).
- **The relay deploy is a workflow now** (main's SRV-N/CI: "Deploy relay",
  `workflow_dispatch`, then `/health` polled until it
  names the version the run built). Its version step grepped
  `server/src/index.js` for the declaration, which SLAM13 had moved to
  `src/net/wire.js` - it would have refused every run with "could not read
  RELAY_VERSION". It reads `wire.js` now. So the checklist's "deploy by
  hand" is "run the workflow": the token lives in the repo's secrets, and
  the one this session's transcript carried must be rotated THERE.

## SLAM15 - THE THREE LEFT RECORDED, PAID (2026-09-17, AUDIT SLAM FINAL)

Mac: "Take care of the left recorded." `RELAY_VERSION` is `world75`.

**A6 A STOP IS HEARD WHOLE.** The pose that ends a walk - the first with
`mv` 0 after one that moved - carries where the player actually stopped,
and the tier served it to one far slice in four. The other three eased to
the last pose they were served, up to a second of walking short of the
truth, and stood there wrong until the heartbeat corrected it five
seconds on. A stop is one frame per walk, so the relay fans it whole as
it fans a keepalive, under the keepalive's own floor (`kept`,
`KEEPALIVE_FAN_MS`): a client toggling `mv` at the gate's ceiling buys the
same two whole fans a second a keepalive flood does, and no more. Driven:
eight steps then the stop - every one of 59 listeners holds the stop as
its latest pose, where before it some far listener held a mid-walk one;
ten "stops" in one instant - one whole, the rest tiered, `kept` stamped
once; a heartbeat later, whole again.

**B4** `_needed` unioned the worn keys into `_wanted`, and the union was
redundant by construction: `sync` adds every drawn peer's key to
`_wanted` before it touches the peer's batch and destroys the batch of
every peer it did not draw; `destroy()` empties both. The invariant
(worn ⊆ wanted after every sync, through a look change and a departure)
is pinned and `_needed` returns the wanted set. The restored union is in
the mutant list as `equivalent`, which is the proof of the redundancy.

**B5** `_wanted` was pinned by count; it is pinned by list - exactly the
drawn dolls' look keys, not a body peer's, not an unshown peer's, rebuilt
each frame.

**Pins.** `test/slam15.test.js` (4). Mutants: `tools/mutants/slam15.json`
- **8 mutations, 7 dead, 1 equivalent as recorded**. Re-aimed: `chat1`'s
pose-arm regex (two more lines before `still`), `slam8` K3 and `slam13`
X6/X12 records to the merged source.

**S12 retired.** PINS recorded `S12-needed-worn-half-deleted` as an
equivalent mutant - deleting the worn union changed nothing. SLAM15 made
that deletion the law, so the record could no longer apply and is
removed from `tools/mutants/pins.json`; the same claim lives on as
`slam15.json`'s Z8 (the union RESTORED, equivalent). The whole sweep on
this tree: **100 mutants - 98 dead, 0 survived, 2 equivalent as
recorded** (Y13, Z8).

## SKEW1 - THE TWO LINES OUTSIDE THE CHAT BOX (2026-09-16)

Mac: "When the relay deploys/server restarts, there are 2 strings of
messages that happen outside of the chat box."

They were SLAM13 A5's client half. The session compared the welcome's
`v` with the `RELAY_VERSION` it was built against and, on a mismatch, put
"the relay is running another version than this client - reload, or the
relay needs deploying" on `statusLine` - which the HUD draws top-left for
the presence session AND under the chat box for the chat link. Two
lines, outside the chat, for every player, until a reload.

And the skew it named is the ORDINARY state of a deploy, not a fault.
From the run logs of the world75 push: the relay's drift-deploy landed at
15:00:10, the client build (Pages) at 15:02:37. Every reconnect in those
two and a half minutes compared a world74 client with a world75 relay,
and every tab already open stayed on the old build until its player
reloaded - so the two lines were the deploy's normal aftermath, shown to
everyone, and said nothing SRV-N's notice ("The server was updated and
restarted...") and its build poll ("A new version of the game has been
released...reload") were not already saying inside the chat. The one
case A5 alone covered - a relay BEHIND its client - is closed by the
drift-deploy (main's SRV-N/CI): a push whose version drifts deploys.

The comparison, the field (`versionWarning`), the text
(`VERSION_WARNING`) and the console line are gone from `net/online.js`;
`v` is read by SRV-N's `onRelay` alone. The relay is untouched (no
version bump: `index.js` and `wire.js` did not change). `slam13`'s A5
client pin is inverted - a foreign `v` reaches `onRelay`, and
`statusLine` stays null for the presence label and the chat label alike,
with no console line and no field - and the three mutants that drove the
warning (X13-X15) are dropped from `tools/mutants/slam13.json`.

## LOCALDEV1 + ROSTER-G (2026-09-16) - see 06-Systems/Chat-Roster-And-Names.md

Mac: "Players dont show in online and the roster naming itself seems
hardcoded." The roster beside the chat read the player's own map cell;
it reads the world channel now, which names its members (`world77`).
Found on the way: the worker entry re-exported `RELAY_VERSION` as a
string and workerd refused to start it locally (`world76`). Both are
written up in the chat file.

## SOC (2026-09-16) - see 06-Systems/Social-Party-Arc.md

Mac: "A social button next to the chat UI ... friend other users, see if
they are online/last online + be able to invite friends or other
individuals to the new 4 person party system ... the players name who are
in a party together should turn green ... pressing F on their body ...
seen on the world map, regardless of their location." The world channel's
object is THE HUB (`world78`): accounts (an id and a secret beside the
peer's, minted per browser profile), friends, requests, presence and
last-seen, four-seat parties and the party pose fan; the client's picture
in `net/social.js`; the panel, the party HUD, the F key and the map on
top. Written up on its own page. Audited the same day (AUDIT SOC, four
lenses over the merged arc, `world79`): the hub's directed acts cooled
per target, accounts nobody's list names swept on an alarm a page at a
time, pending rows without presence, by-account acts for relations alone,
one tab speaking for a seat; the link's inbound gates and frame bound;
the host's counted pointer surfaces and F inside - the arc page's AUDIT
SOC section.

## NAME1 + BUBBLE1 (2026-09-16) - the names over the others, and what they say

Mac: "Player names clip and cut off the top of the sprite head and
additionally grow in size the further away + are able to be seen through
walls." and "I want to introduce chat bubbles above the player when they
chat." One Opus lane, one commit, `src/ui/nameLayer.js` new.

**NAME1, three laws on one point.** `RemotePlayers.namePoints` projects
the head top EXACTLY (`y + height`, the body's capsule or the doll's `h`;
the old `+ 0.25` world lift was half the clip - a quarter unit is many
pixels at arm's length and one at forty, so its clearance swung with depth
the wrong way) and the clearance is NAME_GAP_PX (5) in SCREEN pixels:
the label's bottom edge sits the gap above the head at every distance.
`projectToScreen` (player/tapRay.js) hands back `depth` beside x/y, and
`nameScaleFor(depth) = clamp(NAME_SCALE_REF / depth, MIN, MAX)` is the
perspective law - a far name is the small one (REF 18: scale 1 at depth
18, the near clamp at 12, the far at 32.7; half the size at double the
depth between them). Sight: `sightBlockedBy(collider, eye, head)` runs ONE
ray on the player's own collider - the live, mode-aware one worldModes
re-points at every door - stopped NAME_SIGHT_SKIN (0.2) short of the head
so a doorframe does not blind a name; the same triangles the player cannot
walk through, the same test `pickActivatableHit` and `pickFoeAlong`
already make. Chosen over a depth read because the hosts draw to the
default framebuffer (a depth sample would be a render target per frame or
a readPixels stall, and it would answer for the pixel, not the peer). It
is the LAST cull, after range and the strip, one ray per drawn peer. LIMIT,
written in the code: the exterior's terrain is not a collider bucket
(`player/collider.js` keeps the ground as a heightAt floor), so out in the
open a hill hides the body and not the name.

**The face.** Online forces the enhanced skin, so the names are drawn by
`ui/nameLayer.js`: a fixed, pointer-transparent layer in PIXEL_STACK
(bone, no smoothing), one `.dfname` element per visible peer, MOVED per
frame and never rebuilt (a write counter pins it: a moved name is two
property writes and no node), z-index 3 - under the enhanced HUD, its
text column, the mid-screen label and the status line at 4 (a tie goes
to the later element, and this layer is appended after them - AUDIT
NAME F4), and under the chat, the party HUD, the friends panel and the
FPS read-out. The party colour is SOC4's own
seam (`social?.colorOf(id)`, an RGBA) converted by `cssRgba` -
`cssRgba(PARTY_GREEN) === PARTY_GREEN_CSS` exactly. The bitmap face
(`drawNames`, the classic font) is KEPT for a host with no document (every
Node probe, the suite) and reads the same points: one law, two rulers -
the point carries the anchor, the depth and the lens for both, and each
face applies its own pixel term (AUDIT NAME F3/F13: the bitmap gap is
scaled by the host scale, the DOM size takes the viewport and the HUD
scale by value); `RemotePlayers.nameFrame` draws exactly one of them per
frame, and `world.js` is one call (F14). `blocked` is appended BEHIND `colorOf`
in `drawNames`'s signature so SOC4's law ("a caller that says nothing
draws the names it always drew") holds as written.

**BUBBLE1.** A line a peer says in the WORLD channel stands over their
name for BUBBLE_MS (6 s), fading over the last quarter on ChatLog.peek's
own curve, wrapped by the sheet (`max-width: 15em`) and cut at
BUBBLE_CHARS (100) with `...`, a rounded box with a tail toward the head.
The feed is a PULL: the layer reads the ChatLog's world tab forward from a
`seq` watermark, so the chat wiring `link.onChat = (line) =>
chatLog.push(tab.id, line)` is byte for byte what CHAT1 pinned. Refused:
another tab, `system: true`, `mine: true`, no id, no text. Bounded: one
bubble per peer (the newest replaces), BUBBLE_MAX (4) at once with the
oldest evicted, and only for a peer the name pass is drawing - out of
range, behind a wall, off the strip or under a window is no bubble either
(AUDIT NAME F1: in a dungeon the pass was not called under a window, so
the names froze on the glass and the pump stalled - the dungeon overlay
arm runs the pass before it returns now, and a line said under the window
bubbles at its own age when it closes).
The text is the wire's own (net/online.js ran `sanitizeChat` before
`onChat`; this module names that and never re-runs it, and never writes
innerHTML). No bubble for my own lines anywhere: I have no body in my own
view, and ChatLog.peek already shows my last lines over the world.

**Seen** in Chromium over `tools/name1Probe.mjs` (the real modules served
same-origin - the artifact the first record lacked): at 1600x900 and FOV
60 three peers at depths 6 / 18 / 36 draw at 24.0 / 16.0 / 9.0 px (the
legible floor) with bottom edges 4.7-5.0 px above the head, bone
`rgb(233,228,217)`, party green `rgb(115,255,115)`, the layer at z-index 3
and pointer-transparent, a 9-character bubble over two lines and a
155-character line cut to 102 with `...`; at FOV 120 every name is at the
9 px floor; on a 390x844 phone 22.5 / 15.0 / 9.0 px. Not in the game
(ARENA2 absent). Pinned in `test/name1_bubbles.test.js` (20: the anchor at
two depths, the size law by value and monotone and at two heights and two
FOVs, the sight test against a REAL `player/collider.js` wall with the
bucket boxes and the ray budget, the hysteresis over a flickering ray, the
DOM face's write counter, the bubbles' every refusal, the cap, the line's
own age, the watermark keyed to the log, the host's composition driven
end to end); `tools/mutants/name1.json` 71 - 68 dead, 3 equivalent as
recorded.

**AUDIT NAME (2026-09-17).** A read-only lens over the slice found fifteen
things, all fixed the same day. HIGH: the dungeon overlay arm returned
before the name pass, so under any dungeon window the DOM layer stayed
painted at last frame's positions and the bubble pump stalled (F1); the
sight ray walked EVERY collider bucket with a full DDA - 3.9 ms a frame at
30 buckets and 60 peers, 24 ms at 199 - so each bucket keeps its AABB and
rejects a ray by a slab test before any walk, and a per-peer sight cache
re-asks every NAME_SIGHT_MS (150) with NAME_SIGHT_HOLD_MS of hysteresis
before a name goes (2.13 -> 0.19 ms at 60 peers, 8.63 -> 0.33 at 199; 18
rays for 60 frames of 3 peers where the raw law asked 180) (F2/F5).
MEDIUM: the size law had no viewport, FOV or HUD-scale term (2.2x
oversized on a phone, unchanged at FOV 120 where the body is 3x smaller)
- `nameLensScale(proj)` reads 1/tan(fovY/2) off the projection itself,
`nameViewportScale(h)` the height, `namePixelSize` applies the HUD scale
outside a 9..30 px legible band (F3); z-index 3 (F4); a bubble's age is
the LINE's stamp, not the pump's, so lines queued under a window do not
bubble as new when it closes (F6); the DOM face is gated on the skin as
the chat is, so a classic-skin online page keeps the bitmap names (F7).
LOW: the watermark keyed to the log's identity (F8), a zero-alpha bubble
neither shown nor counted (F9), whitespace-only text no bubble (F10),
finite guards on a point and a stamp (F11), one bone (`--bone`, #e9e4d9)
(F12), the bitmap gap scaled (F13), the host's four statements in
`nameFrame` where a pin can drive them (F14), the probe artifact (F15).
Still open, as the slice recorded: terrain does not occlude; the layer is
not hidden on `gamePaused()`; not destroyed at pagehide. Left open: terrain does not occlude; the
layer is not hidden on `gamePaused()` (only on `hudCovered`, the gate the
old call took); not destroyed at pagehide (a bfcached page's rejoin would
be nameless for life).

## RESPAWN1 - A DUNGEON'S DEAD STOOD BACK UP, AND THE DOOR WAS WHY (2026-09-17)

Mac, forwarding a patch he was sent: a dungeon's kills did not persist.
Clear a room, leave, come back, and everything is alive again.

**One line, and every other part of the pipeline was already right.** The
kill was stamped with the relay's clock (`died`, WORLD8), collected by
`collectWorld`, sent inside the room's memory, stored by the relay and
served back on the next join. Then the RESTORE threw the whole thing
away, because `validSharedFoe` - AUDIT ONCRASH1 A3's door over the
memory's foes - asked for `team` and `mobileTeam` as NUMBERS:

```js
if (!Number.isInteger(sf[k]) || sf[k] < -1 || sf[k] > 255) return null;
```

They are not numbers in this port. `entity.team` is `MobileTeams`' NAME -
'PlayerEnemy', 'PlayerAlly', 'Vermin' - which is what
`characters/enemyEntity.js` defaults, what the whole of
`characters/enemyTargets.js` compares, and what `combat/playerWeapon.js`
reads as `=== 'PlayerAlly'`. The number came from DFU's own serializer
(`SerializableEnemy.cs:125`, `(int)entity.Team + 1`), which is the
reading the port did not take. And the publisher hands the LIVE field
over (AUDIT 63 F26's pair), so every foe record carried a string where
the door wanted an integer.

A bad field refuses the record WHOLE - that is the door's own law, and
the right one - and the restore drops a refused record
(`.filter(Boolean)`). **Every foe has a team. So every record was
refused, every dungeon memory restored as an empty list, and the room
rebuilt itself alive** however correctly the kill had been stamped,
stored and served. Driven before the fix: a record carrying the real
`team: 'PlayerEnemy'` answered `null`; the same record without the pair
passed.

**The pin that should have caught it encoded the bug.** ONCRASH1 A3's
own test passed `team: 2`. That is the shape of a fault that survives a
green suite: the test and the code made the same wrong reading, so they
agreed. `test/respawn1.test.js` is deliberately not another example - it
reads the PUBLISHER's field list out of `collectWorld`'s own record in
the source, builds the record that publisher would really write, and
asserts the door admits it whole and field by field. A field added to
the record with a law the door does not share now names itself there
rather than emptying a dungeon's memory in silence.

### The other half of the patch, measured and declined

The patch also wrapped every `ws.close()` in `net/online.js` in a drain
loop, on the claim that a `send()` issued a moment earlier is "silently
dropped" - and that the frame so lost is the `final: true` snapshot a
dungeon publishes on its way out (`leave`, which `join` calls on every
room change). **Measured, it is not.** `tools/wsDrainProbe.mjs` stands a
real RFC 6455 server (there is no `ws` package in this tree, so it is
the handshake and a byte count) and drives Chromium at it: a 256 KiB
payload, still sitting in `bufferedAmount` at the moment of the close in
10 trials out of 10, arrived whole in 10 out of 10. The browser flushes
the send buffer before the close frame, which is RFC 6455 7.1.1's own
order. A drain loop there buys nothing, and costs a polling timer and a
deferred socket teardown, so it is not taken. The probe is kept, because
the claim will be made again.

The wire's law changed, so the relay's version did: **`world80`**, with
its row in `test/relayversion.test.js` beside the bytes it names. The
deploy workflow (`relay-deploy.yml`) takes it to the worker on the push
to main, because `/health` will report `world79` until it does.

The patch's two scene files were not taken either: they are a copy of an
older tree and would have reverted the Enhanced Lighting arc and the
quickslot arc wholesale. They carried no respawn change of their own.

## RESTX2 (2026-09-17): online, a rest paces on the window's own timer

Mac's "BetterResting" zip, two files cut from an older main. What it
asked for, in its own comments: monsters should still be able to
interrupt an online wait, and the hours-remaining counter should
visibly tick down rather than jump straight to its answer.

RESTX1 (above) made an online REST resolve in ONE frame - the whole
hourly ladder inside a single `tick()`, no minutes passed, no host
clock jump, no encounter roll, no countdown - and left LOITER pacing
off the shared world clock at DFU's TimeScale, five real minutes an
hour. Both were the same mistake from two sides: the shared clock was
being read for PACING, when the only thing it has to say online is
that it cannot be written.

**One law, every mode, online or off:** the window's own real-time
timer (`REST_WAIT_PER_HOUR` / `LOITER_WAIT_PER_HOUR` real seconds a
simulated hour - waitTimePerHour / minutesPerTick, DFU's quirk, so an
hour is six sub-ticks of 0.075 s) paces every sub-tick. `_accrue`
banks the frame in every lane; `_takeSubTick` consults the timer and
nothing else. So online the counter ticks down at the offline rate
(eight hours in under four real seconds), and `advanceMinutes` is
spent on EVERY sub-tick, so the magic-round catch-up and the hourly
rest-interruption roll run online as they always have offline: a foe
that walks up breaks the rest.

**What the roll reads.** The shared clock is still refused every local
write (worldTick.setWorldMinutes), and `playerTicker.classicMinutes`
stands under it - so a host reading it under a rest computed a span
of zero and rolled nothing. The session keeps `_onlineSimMinutes`: a
counter local to this one session, seeded from the shared clock at
the first sub-tick (floored), ten a sub-tick from there, forgotten
when the session ends, handed to the host as the sub-tick's END
(AUDIT WORLD5 C8's slot; null offline, where the host reads its own
clock). Nothing here is visible to another player or survives past
the rest; it only has to look, from the inside, like an hour passed.
After the rest the host's `_lastEncMinutes` sits ahead of the standing
clock until it catches up, and those frames roll nothing - the rest
already rolled them.

**The quest tick alone stays offline-only.** A quest clock is
cross-player-visible state; ticking it against a locally simulated
minute would desync this player's quests from everyone else's.

**Retired with the lane:** `_free()`, `FREE_REST_HOUR_CAP`,
`_freeHours`, `_sharedAt`, `_sharedTaken`, `_holdShared` (a covered
frame banks nothing because `_accrue` is never reached under a cover -
the timer's own law, in every lane now), and AUDIT RESTX F1's
full-health guard on the Medical tally: the exploit it closed ("rest
99 hours" = 99 tallies on one click) needed an hour that cost no time,
and every hour costs its real seconds again. DFU's unconditional tally
stands everywhere. The rest window's OL2 clock line lost its pace half
("an hour here is 5 real minutes" stopped being true) and says the one
thing that still is: `World time 15:05 - resting does not move it`;
`REAL_MINUTES_PER_WORLD_HOUR` went with the sentence.

**THE FOUR HOSTS.** The zip fixed `exterior.js`'s `runEncounterTick`
alone; `world.js` reads the standing clock the same way and got the
same seam: `runEncounterTick(playerFeet, simMinutesEnd = null)`, `now`
is the rest's minute when handed one, and the rest deps hand
`sharedEnd` through. The dungeon's `_restAdvance` already read it; the
interior's arm rolls nothing inside a building and is unchanged.

`test/restx2_online_rest.test.js` - 8 pins; WORLD5's loiter pin, AUDIT
WORLD5 C7/C8 and OL2 (5) re-aimed onto the timer; `restx1_online_rest`
retired. `tools/mutants/restx2camp.json` carries RESTX2's ten.

## D-ONLINE1 (2026-09-17): online, a death respawns instead of ending the run

Mac's "daggerfalljsWildlifeSpawnsRespawn" zip, the respawn half.
Players: "when i die i just end up at the title menu", "still see you
have died then main menu"; Mac: "you should just respawn in this
case". Classic single-player death is "you die, you load a save"; in
co-op the party is still playing, and ending the run - or loading a
save that unwinds everyone's progress - is the wrong cost for one
death. An original addition, not a DFU system, riding the cemetery
transfer's own teleport core.

**Three bugs the zip found in the path it built, kept as written.**
`_actLive` was never "am I online": `isWorldRoom` matches a dungeon or
a building room alone, and the open world stands in a CELL room, so a
death OUTDOORS - where a camp lives - read as offline.
`_onlineWorldSession` counts both. And `onlineFrame` LEAVES the room
the instant the death screen is up (AUDIT ONLINE D12), every frame,
before `onReset` ever runs - so a reset that read `online.room` always
found it null. `_deathWasOnline` is snapshotted at the PRESENTER,
synchronously (a fast F11 reaches the reset before the next frame),
and at the frame as a backstop for the modal hosts' deaths, BEFORE the
leave.

**The reset.** Enter, the three-second timer, or F11 (which used to
quickload from under the death screen - online, respawn IS "get me
back in"): `respawnOnlinePlayer`. Two things differ from the zip.
It left a building's interior standing (only a dungeon was exited);
any mode but the open world is left first through
`forceExitToExterior`, which also clears the modal host's death screen
with its slot. And it landed on the tile's dead centre (the
`_teleportToPixel` default); the landing is a `RandomStartMarker`, as
TeleportAway names it (AUDIT 64 F19) - a town's gate, a cemetery's, a
dungeon's door. Dead underground the door out is the pixel already
under the player; otherwise `nearestSafeLocation` (systems/
deathRespawn.js) picks the closest temple, town or CEMETERY graveyard
by map-pixel distance over the region's mapTable, the same search the
cemetery transfer makes; a region with none stands where they fell.
Then `_lastEncMinutes` is reset (no encounter catch-up across the
trip), half health back and never none, `surfacePlayer`, and a flavour
line in the death screen's place. The modal hosts ask through one
door: worldModes' interior death screen calls `host.onlineRespawn`,
the dungeon context is handed the same as `opts.onlineRespawn`, and
both end the run as ever when it answers false - offline is untouched,
and the fixed city keeps the bare form.

Not carried: `window.__online`, a console debug hook the zip left on
unconditionally. Not verified in a browser: no online session exists in
this container; the door is pinned by source and the pick by law.
`test/donline1_respawn.test.js` - 3 pins; FIX-E, AUDIT 21 F6, AUDIT
WORLD B6 and MWBODY1 re-aimed. Mutants in `tools/mutants/restx2camp.json`.

## WATCH1 (2026-09-17): the criminal's watch rides the cell

**Mac, resuming the STOP list above: "1. Gaurds first 2. Whatever is
best."** The first open slice at the stop was "the guards on a shared
crime", with two decisions left open there: whether a peer's murder
marks the region for everyone, and whom the watch hunts. Both are
decided here on the SMALLER reading, and the reasons are written down
so the larger one can be argued from the record.

**What a peer saw before.** A crime is its criminal's alone -
Multiplayer.md's first lock, every player runs their own world from
their own save - and so was the city watch it summoned: `cityGuards`
is a pool the encounter stream never named. A peer standing beside a
murderer saw the killer swing at nothing while five watchmen chased
them round the village; a peer who tried to help hit air.

**The reading taken.** The crime STAYS the criminal's: the flag, the
witnesses, the legal reputation, the spawn law, the hunt and the
despawn on the crime's clearing are all untouched. What changes is
that the watch RIDES the criminal's own cell `foes` frames, as `t:
146` records - Knight_CityWatch, whose ENEMY_BASICS row every client
holds - behind the encounter foes, in the foes' own record shape.
Every peer in range stands them as puppets through `applyFoes`'s one
spawn chain, exactly as a rat of mine is stood (at the streamed feet,
at the owner's level, no loot, outside the reader's cap); they walk,
swing and fall where the stream says. The relay reads nothing inside a
record, so there is no relay change. (`RELAY_VERSION` moved to
`world81` at AUDIT WATCH1 all the same: `wire.js` gained the reader's
`CELL_WATCH_PUPPETS_MAX`, and the relay bundle's bytes are its law -
SLAM8 - so the worker is redeployed with nothing new to do.)

**A FOE IS ITS SPAWNER'S, and so is a watchman.** A peer's blow on a
watch puppet goes to its owner as a hit by the number the watchman
rode under - `seq`, minted by the encounter pool's own counter the
first time he rides, so one number space names one thing and the
owner's `applyHit` finds a foe or a watchman, never both. At the
owner the blow lands through `cityGuards`' OWN door (`hurtGuard`) with
`fromPlayer: false`: DaggerfallEntityBehaviour.cs:203's `source ==
Player` gate, F035's law, which a peer is outside. So no aggro turn
(the watch is already the criminal's enemy), and a watchman a peer
kills is no Murder of the criminal's - the crime stays what it was.
The knockback still lands (C15's gate is knockDir's), the shield
still absorbs, the corpse still falls and rides the next frame as `d:
1` - with NO pile on the wire and none on the body (AUDIT WATCH1 A3,
below) - and the peer's own screen rang, bled and voiced the blow
before the divert, as it does for any puppet.

**Whom the watch hunts: its owner and its owner's foes, never a
peer.** The watch's target candidates are the host's own
(`_foeSenses().candidates()`, MT-ii) - the roster is the encounter
pool's alone - so a watchman's `g` on the wire is `'.'` (me) or `''`
(a foe of mine), and his `_atkB` the same; a puppet of him lands
nothing at its reader (exteriorFoes' `update`, the puppet arm:
`recipientIsMe(f, f._pupBlowAt)`) and only draws the swing. The strike
edge in `cityGuards.update` latches the attack count in the wire's
spelling (the ranged bit low: the watch never shoots - `rangedAttack =
false`, AUDIT 18) through the one home, `enemyTargets.bumpAtkCount`
and `wireRecipient`.

**The seams, by name.** `cityGuards.js`: the guard record gains `seq`
(null until he rides), `_atkA`, `_atkB`; the strike edge latches the
count. `exteriorFoes.js`: `setNet` takes `watch` - `{ list, hurt }` -
`foesFrame` walks `[...foes, ...watchList()]` and numbers an unnumbered
watchman off `_nextSeq`; `applyHit` looks a number up in the foes then
the watch (`watchOf`), and routes a watchman to `_net.watch.hurt`.
`world.js`: the net hands `cityGuards.guards` and `hurtGuard(...,
{ fromPlayer: false, peer: true })`. The striker's own melee door routes
by pool membership (`cityGuards.guards.includes(f)`), never by species,
so a 146 puppet is the encounter pool's and no crime arm of the
striker's runs. THE FOUR HOSTS: `world.js` alone is online and is
wired; `exterior.js` (the fixed city, a full encounter pool and a
watch) and `worldModes.js` (the interior host's `interiorFoes` and
ROAD-B's indoor watch) mount no net at all - `setNet` is called from
`world.js` and nowhere else - so their watches stream nothing and are
flagged here by name; the dungeon's foes are the host's stream
(WORLD2) and it has no watch on the wire.

**Recorded and NOT carried - the larger reading, if wanted:**
- A peer who strikes or kills my watch commits nothing: the striker's
  door is the encounter pool's, which has no crime machinery. In the
  larger reading that is Assault/Murder at the striker, needing a
  crime event on the wire.
- My murder marks no crime and no legal reputation on a peer; the
  watch hunts only me. The larger reading is the shared crime event
  with the witness test run once.
- The townspeople each client converts into watchmen are each client's
  own roll; a peer sees my converted watchmen as puppets AND its own
  unconverted townsperson still standing (the civilians are not
  streamed - that is a slice of its own).
- A walk-away (the crime cleared) leaves the roll silently and is
  taken down at the readers by the next FULL frame, the encounter
  foes' own law for a culled foe; up to FOES_FULL_MS a peer sees a
  standing watchman the owner no longer runs.
- `exterior.js` and `worldModes.js` mount no net (see THE FOUR HOSTS
  above); the world host alone is online.
- A peer's shafts can stuff a watchman's kit with Arrows up to
  HIT_ARROWS_MAX (the foes' own bound, pre-existing arm, new target):
  the kit reads into the knockback weight and, on a kill by the owner,
  into the pile. Bounded; recorded.

Not verified in a browser: no online session and no second player
exist in this container; the whole path is pinned by execution across
two real pools netted together (`test/watch1.test.js`, ~~5 pins~~ 6
after AUDIT ALL) and `tools/mutants/watch1.json` (~~33 mutants, 32
dead~~ 39, 38 dead after AUDIT ALL, 1 equivalent as recorded). AUDIT WORLD6b-iii(b)'s C1 source pin, WORLD6b's net pin,
WORLD6b-ii's and WORLD6b-iii(a)'s spelling pins, WORLD6b-iii(c)'s
record pin, WORLD6b-iii(e)'s owner-door pin and WORLD2's count pin
re-aimed.

### AUDIT WATCH1 (2026-09-17, Mac: "Audit this first") - three opus lenses over the first cut

Three lenses (the game law and the net flow; the wire, the relay and
abuse; the pins, the mutants and the records), every finding
reproduced against the real pools before it was paid. In severity
order:

- **A1 THE WATCH NEVER STOOD FOR A BUSY CRIMINAL.** The reader's
  per-owner puppet cap (CELL_PUPPETS_MAX, 8) was one cap for foes and
  watch, and the watch rides behind the foes - so a criminal carrying
  a full encounter roll (the murderer fleeing through the country, the
  headline case) streamed a watch no peer ever stood, on every frame,
  for ever (the cap counts STANDING puppets). Paid: the watch has its
  own allowance, CELL_WATCH_PUPPETS_MAX (10 - SpawnCityGuards stands
  five, but makeNpcGuardsIntoEnemies converts a town's whole
  wandering-guard population uncapped), counted apart in
  `livePuppetsOf`, pending builds included.
- **A2 THE SWING WAS NEVER AT ANYONE.** The strike edge handed
  `isPlayerTarget` the target's FEET (`_tgt`), so `_atkB` was always
  `''` and the `'.'` arm was dead code, while the record and the pin
  certified it. Latent (a reader compares the recipient against
  itself), but the field the record claims. Paid through ONE HOME:
  `enemyTargets.wireRecipient` and `bumpAtkCount`, now read by the
  encounter pool (which had two hand copies of the spelling), the
  watch and the dungeon host's count. The dungeon's own recipient
  spelling (a null target under unarmed targeting is '.') is a
  deliberate variant and stays.
- **A3 A BODY NO PEER CAN OPEN, ADVERTISED AS OPEN.** A killed
  watchman rode with `o` its kit, so every reader offered the body as
  a loot target; the take arm never reached the watch, the owner
  answered silence, and the peer clicked a corpse for ever with no
  line. Paid the smaller way: a watch record rides `o: 0` (its body is
  the owner's own door, cityGuards.takeLoot). And the no-Murder door
  was a loot farm: two clients could clear a town's watch at no cost
  and the owner strip five armed bodies for free. Paid: a body another
  hand felled carries nothing (the G3 walk-away precedent).
- **A4 THE OWNER HEARD "City Watch just died." FOR A PEER'S KILL,** and
  ECV1's reveal flashed for a peer's blow - the foes' door has had
  WORLD6b B2's peer half since the cell stream landed. Paid: the host
  hands `peer: true` and `damageGuard` gates the notice and the reveal
  on it.
- **A5 A WATCH PUPPET STOOD THREE TO SIX LEVELS ABOVE ITS WATCHMAN.**
  `makeEnemyEntity` rolls the City Watch bonus for 146 unconditionally
  and the reader handed it the streamed level, which carries the bonus
  already - the one species where `builtLevel` and `entity.level`
  disagreed, and the one term a crafted `t: 146` record could ride.
  Paid: `exactLevel` on the puppet arm.
- **B2 FIVE HIT FRAMES FROM ANYWHERE IN THE CELL ENDED THE WATCH.** No
  reach, no liveness: a socket across the cell (or a halo) could kill
  every watchman unseen, and with no watchman standing the conversion
  stops and the surrender box resets - GUARD1's spree re-opened by
  another player's word. Paid: the take arm's law - the striker must
  be a peer the hunt sees (the roster's pose), within the PLAYER's own
  reach of the watchman (WEAPON_REACH for a blade, MAX_RANGED_DISTANCE
  for a shaft or a spell, plus the pose's slack), or the blow is
  nothing. A net with `list` and no `hurt` refuses rather than throws.
  The foes' own hit arm keeps its old law (no reach) - recorded here,
  not this slice's.
- **A6/B6 THE FRAME'S TRIM.** Past CELL_FRAME_RECORDS_MAX the trim
  sorted bodies by a map built from the foes alone, so every watch body
  read as the oldest; and `_sentKey` was latched before the trim, so a
  record the trim dropped was unsent until the next full frame
  (pre-existing, widened). Paid: a body is stamped on the pool's own
  clock when it first rides, the map reads both pools and never a
  puppet's number, and a dropped record's key is cleared.
- **G1** the `dead && !corpse` skip is load-bearing for a watchman
  world.js's cross-pool remover ended between frames - pinned and
  mutated now. **The records**: the FOUR HOSTS named; "applyPuppetRecord's
  gate" named the wrong function (it is `update`'s puppet arm,
  `recipientIsMe`); EW1 was the wrong citation for `rangedAttack =
  false` (AUDIT 18); the STOP bullet retired properly; the `_damage`
  seam comment's caller list; the equivalent mutant recorded, not
  dropped; the superseded suite figure at the STOP marked.

Not paid, recorded: the take arm for a watch body (a `watch.take` seam
beside `watch.hurt`, granting out of cityGuards' own emptying door) - a
slice of its own if a peer is ever to loot the watch; the foes' hit
arm's reach; the striker's routing door pinned by source (an executed
pin would have to stand world.js's own `dealDamage` closure).

## OL4 (2026-09-17): shops staffed around the clock online

**A player complaint relayed by Mac: players could not shop at night
online.** PR #237 ("OL4 - online shop staffing without rewriting
classic hours"), landed on this branch with the records it lacked.

**The lockout.** DFU closes a shop outside its hours (PlayerActivate
.IsBuildingOpen, :102-106, the two tables at :91-92) and on Suns Rest
(:1294-1302), and the single player sleeps or travels to morning. Online
the clock is the world's (WORLD5) and nobody can move it - RESTX2's rest
paces on a timer and the shared clock is refused every write - so a
classic closure is a real-time lockout of hours, for everyone.

**The reading taken.** Classic's schedule stays a pure primitive,
`classicBuildingOpen`, preserved exactly. `buildingHoursState(type, {
hour, holidayId, online })` layers the shared-world policy above it and
answers BOTH - `classicOpen`, what untouched Daggerfall says, and `open`,
what this running world says - with `staffing` as data (CLOSED, CLASSIC,
ONLINE_SHIFT). While the shared clock stands (`worldTick.sharedClockOn`
- AUDIT ALL O1: the clock is the reason for the shift and the one
predicate every clock-derived online law reads; the first cut read the
URL, which a dev door can carry with no clock behind it), and for a SHOP
alone, a classic closure is covered by a continuous relief shift. `isBuildingOpen` and `buildingIsUnlocked`'s
shop arm route through it, so the door, the entry-time `insideOpenShop`
latch, the shelves and the interior people stand on one rule; houses,
guild halls, temples, palaces and ships keep R1's rules online, and
offline nothing moves. A restored interior (AUDIT ALL O2: Play Online
always begins on a restore, and a save taken inside a shop entered while
classically closed carried the latch `false` - the door opened, the
shelf opened in STEALING mode, no clerk stood) keeps the saved latch and
adds the effective hours at the restore, never taking the latch away
(DFU's own law for the saved record). The other direction is recorded:
a save taken online inside a shop at 03:00 carries `true` home, and an
offline load stands its clerk in a shop DFU has locked until the player
leaves. The classic closures are 45 real minutes (the alchemist's night)
and a two-hour real outage on Suns Rest at TimeScale 12, not a real day.

**Recorded, not carried.** The Bank (8:00-15:00) and the Library
(9:00-23:00) are not shops and keep their hours online: a night player
can shop but cannot bank or read - a follow-up if wanted (the tavern is
0/25, never closed, and OL3 prices the stay). The night clerk is not
drawn distinctly - the existing shop people stand the shift; ONLINE_SHIFT
is the hook for that
presentation slice. The shared ECONOMY (one region memory, one owner
walking the day, the reputation term) is the STOP list's open slice
still. Not verified in a browser: no online session exists in this
container; pinned in `test/lockpicking.test.js` (R1's hours pins,
extended in place) and `tools/mutants/ol4.json`.

## ECON1 (2026-09-17): the region's prices are the world's

**Mac: "Economy slice next."** The STOP list's last open slice, taken
the way its own bullet suggested: the reputation term dropped rather
than split out, and the state made a function of the day rather than
a memory with an owner.

**What was wrong.** DFU walks each region's price index once a day
(UpdateRegionalPrices, FormulaHelper.cs:2053-2088) on the PLAYER's own
state - the 62 indices drawn at the start (RandomizeInitialRegionalPrices,
750..1250) and tilted each day by The Merchants' power against the
region's - because DFU has one player. WORLD6b made the day's ROLLS
the world's (one generator per day, seeded by the world's day and the
consumer's salt) and left the STATE each player's, and said so: "one
economy is the region as a world, and a later slice". So two players
in one shop on one day read two prices, by when each had arrived and
what each save carried.

**The reading taken: computed, not streamed.** Under the shared clock
the index is a pure function of the world's day, `worldRegionPricesOn(
day)` in `systems/worldTick.js`:
- the opening indices are drawn on the world's EPOCH day - the day the
  online world stood at the classic start, `ONLINE_EPOCH_MINUTES`
  (WORLD5's constant, `net/wire.js`) - from that day's generator with
  its own salt (`DAY_SALT.priceInit`), region-major as DFU draws them;
- every day since is walked with that day's generator (`DAY_SALT
  .prices`), one roll a region, region-major - DFU's own step
  (`priceWalkStep`, 51/50 up on a passed roll, 49/50 down, clamped to
  250..4000) with the merchants' tilt from the game's own BASE powers
  (AUDIT ALL E1 - the first cut set the tilt to ZERO because the LIVE
  powers are each player's, quests move them; but at zero the index
  never left ~500..1600 in twenty simulated years, so PricesHigh and
  PricesLow could never light online and The Merchants' power never
  took its price bump in `regionPower.js` - the only consumer of those
  flags). The base powers are FACTION.TXT's, identical on every unmodded
  client, so `worldPriceTiltOf` over the talk host's FILE dict (never
  the player's store) answers `trunc((merchants - province) / 5)` as
  DFU does, and null where DFU walks nothing - a region with no
  Province faction, or a world with no Merchants; the day's roll is
  still drawn for every region, DFU's stream position. The host installs
  it once FACTION.TXT is read (`setWorldPriceTilt`), which starts the
  world over from the epoch; until then the walk is untilted (a boot's
  first seconds). A MODDED FACTION.TXT desyncs the shared economy;
  recorded, not guarded;
- cached by day and walked forward; a day behind the cache is rebuilt
  from the epoch; a day before the epoch reads the epoch's. Cold or
  warm, the day's answer is the day's: catching up equals having
  stayed, and the open decision at the STOP ("what a player away a week
  reads") answers itself - today's index, the same as everyone's.

**The seam.** `shopStock.regionPriceAdjustment` - the one door every
consumer reads the index through (the shop, repair, the guild services,
the quest machine's macro; no host reads `regionPrices` directly, pinned)
- answers the world's while a price source stands, draws nothing off the
player's dice and writes nothing. `setSharedClock` installs the source
with the clock and removes it with it. The player's `regionPrices` are
never written online: the save keeps its own economy for its own world,
and offline DFU's own walk, tilt and all, resumes from it. `runDayChange`
online walks no prices; it applies the CONDITION half (PricesHigh over
2000, PricesLow under 500, the normal band clearing both - the inputs
of The Merchants' weekly power bump in `regionPower.js`, their only
consumer; the player's own store) from the world's index, for the
regions DFU's own walk reaches (a Province faction in the player's
store; no Merchants, no walk, no flags - AUDIT ALL E8),
one day at a time, with the day's own generator (`DAY_SALT.conditions`)
for the flag's duration draw - so two players who walked different
spans read the same flags today.

**One home.** The walk's step (`priceWalkStep`), the opening draw
(`initialRegionPrice`) and the flag half (`applyPriceConditionFlags`)
are factored out of `updateRegionalPrices` and read by both the player's
walk and the world's; `dayRng` is the day's generator whoever asks, and
`dayRollsFor` (WORLD6b's) reads it under the clock.

**Recorded, not carried.**
- The POWERS stay each player's (WORLD6b's law: the day's rolls, the
  player's state). A shared power walk would fight every quest's
  `changePower`; a world's powers are a memory with an owner, which is
  the larger reading and a slice of its own if wanted.
- The bank is not region-priced (interest and loans are the player's
  account's) and is untouched; the guild halls' and repair prices ride
  the seam and are the world's.
- A save that went online carries its own prices home unchanged: the
  world's economy is read, never copied.
- Offline the merchants' tilt is the LIVE one (DFU's own).
- The trade window's price now moves under the player at a day boundary
  with the window open (AUDIT ALL E3, a change in kind): the source
  reads the raw shared clock, where the player's own walk was gated
  behind the tick a held window stops. Once every two real hours, one
  step (<=2%), and a committed price is captured before the Yes/No box,
  so no transaction bills a number it did not show.
- Before the relay's welcome corrects the clock offset, a client a few
  seconds off reads the neighbouring day's index across a boundary
  (AUDIT ALL E6): one step, self-healing.
- A rebuild from the epoch grew without bound (twelve game days a real
  day); a checkpoint every 512 days bounds it (AUDIT ALL E4).

No wire change, no relay change of this slice's (`RELAY_VERSION` is
`world82` after the main merge - see MERGE below). Not verified in a
browser: no online session exists in this container;
`test/econ1_world_prices.test.js` (6 pins) drives the world's function,
the seam, the day change online and offline, the tilt and the
checkpoints; `tools/mutants/econ1.json` (27 mutants, 25 dead, 2
equivalent as recorded). WORLD6b's and AUDIT WORLD6b C4/C5's day-walk
pins re-aimed to the world's prices.

## MERGE - main onto this branch (2026-09-17), recorded after the fact

Between WATCH1's audit and OL4, `origin/main` had moved twice (PR #243,
#244) and was merged in (a28a17e): 25 conflicts, every one citation
line drift, resolved by taking main's side whole and re-applying by hand
what that dropped - the dungeon host's `foeDeps.bumpAtkCount` fold (a
real code change that rode a conflicted file). Two things went wrong
and were found by AUDIT ALL, not by the gates:

- **`citeShift` ran against a stale base mid-merge** - the hazard
  Hardening.md writes down ("`citeShift` must not run mid-merge") -
  and DOUBLE-SHIFTED eleven citations into `cityGuards.js`,
  `exteriorFoes.js` and `enemyEntity.js` that the branch's own commits
  had already re-aimed; `test/citedrift.test.js` sweeps none of them.
  Restored to their true lines at AUDIT ALL.
- **The relay version row was rewritten in place.** The merge moved one
  comment line in `wire.js` under `world81`, and OL4's commit relabelled
  `world81` with the new bytes - SLAM5 verbatim, the thing the version
  pin exists to prevent, and two commits shipped with that pin red.
  `world81` is restored to the audit's bytes and `world82` names
  today's; the worker needs a redeploy with nothing new to do.

## AUDIT ALL (2026-09-18, Mac: "Lets audit everything so far") - four opus lenses over the branch

Four lenses over everything since the WATCH1 audit: the audit's own fixes
(A), OL4 (O), ECON1 (E), and the merge with the records (M). Every
finding reproduced against the real modules before it was paid.

**A - the audit's own fixes.** A1 (REGRESSION, severe): the per-class
pending count opened an unbounded puppet stand - a peer re-wording a
pending build's record without `t` (the wire makes it optional) moved
the build out of its class's count, and six frames stood sixty watchmen;
the old class-blind count could not be gamed. Paid: a pending build's
species is fixed at the build. A3 (the disease one level up): the
frame's trim cut the watch first past 64 live records, so a criminal
with a large roll streamed no watch at all; paid: the watch's live share
is reserved as its puppet share is. B2: the melee reach gate's static
envelope fit, but its headroom (~1.1 m) was less than the stream's lag
(a watchman's stride in one foes interval plus the pose gap), so a
chasing blow on a running watchman vanished at the owner without a
word; paid: the watchman's own stride in one interval joins the reach.
A4: a peer's killing shaft put one Arrow into the body A3 had just
emptied; paid. A6 (pre-existing): `cityGuards.restoreWorld` re-rolled
every standing watchman's Range(3,7) on a quickload (a free difficulty
re-roll; online the streamed level moved and every reader rebuilt its
puppet); paid through A5's `exactLevel`, the snapshot carrying the level.
Sound: the roster's frame (the floating origin), the lazy roster read,
the one-home fold, the empty body's loot line, a peer's kill and the
death event, the other hosts.

**O - OL4.** O1: the whole feature hung on two unpinned default
parameters keyed on the URL; the predicate is the shared clock now (one
home with RESTX2, OL3, ECON1), pinned and mutated. O2: a restored
interior kept the save's closed-shop latch, so every online session that
began inside a closed shop opened its shelves in stealing mode with no
clerk; paid (the latch is only ever added to at a restore). Records: the
outage's real length, the Bank and the Library at night, the latch's
offline direction, the seam's contract pinned.

**E - ECON1.** E1 (the one that mattered): with the tilt at zero the
index never left ~500..1600, the flags never lit and The Merchants'
power never took its bump - paid with the world's tilt off the file's
base powers. E2: the player's walk leaned on the seam's lazy init the
source skips (a latent throw); paid. E4: the unbounded rebuild;
checkpoints. E8: the online flag arm reached regions DFU never walks;
paid. E3/E6: the mid-window step and the pre-welcome offset, recorded.
E5: the records named consumers of the flags that do not exist; fixed.

**M - the merge and the records.** Eleven double-shifted citations, the
version row rewritten in place (see MERGE above), the WATCH1 Ledger
row's "RELAY_VERSION stands", the Testing.md row's "RELAY_VERSION
unmoved", four Port-Status ordinals one low and its "eight together"
count four short, `buildTag.js` carrying a stamp for a commit the branch
does not contain, a stale cap comment. All corrected here.

Not verified in a browser: no online session exists in this container.
Pins: `test/watch1.test.js` (6), `test/lockpicking.test.js` (9),
`test/econ1_world_prices.test.js` (6); mutants: watch1 39 (38 dead, 1
equivalent), ol4 12 (12 dead), econ1 27 (25 dead, 2 equivalent as
recorded).
