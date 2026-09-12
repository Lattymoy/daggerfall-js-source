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

Left as recorded: a peer's arrows never show (the wire carries no
inventory - MAC7 put the weapon in its hand and the swing on the wire,
below); strafe and backpedal play the forward walk; a body's textures are the instance's
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

## What it does not do (yet)

- **The Morrowind body** ships (MWBODY1, above); a client without the
  Morrowind data, or on the classic skin, sees the paperdoll instead
  (Mac: acceptable), and so does everyone past `BODIES_MAX` bodies.
- **The look is sent once**, in the hello: gear changed mid-session is
  not seen by the peers until the next room (a `look` frame is the
  next iteration's).
- **The live chat** ships (CHAT1, above): one World tab. No
  player-versus-player, no shared clock or weather, no shared NPCs or
  loot: each player's world is their own.
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
`test/online.test.js` (8): the one law at both ends and the world's
bound, the room key by map id and its nulls, the pose's change and
easing, the id, the session on its own clock over a fake socket, the
socket's lifecycle and the terminal closes, the look and the stub
clamped, the others drawn through a fake renderer (the crop, the cache,
the retry, the eviction, the name under the viewport rect), the
compositor's door pure by source. Not seen with two real players from
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
