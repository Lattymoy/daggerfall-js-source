# FIELD BUGS 2026-10-21c - enemy desync, and a player's CPU profile, read to their roots

The owner (2026-10-21): "People are also experiencing enemy dsync", then three screenshots of a player's CPU profile of
the client's main thread from a Discord message - the Come Sail Away boat pool 11%, peer bodies and the network update
10-11%, the Horse Cart pool 11%, grass streaming 11-24%, the naval host 3-4% - with the player's own suggested fixes.
No report said where or when the enemies went wrong, so the live relay (world237) and the account service were read
for the cause, and the profile's every line was traced on the code. Read on the code as it stands at main's
`4bba28c6c`. Multiplayer is the port's own (DFU has no relay), so no DFU member moves; the boats' far cadence names
its departure in `Port-Ledger.md`. The pins are `fb1021_*` and `fb1021b_*`, the mutants `tools/mutants/fb1021_*.json`
and `fb1021b_*.json`.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "enemy dsync" | A crowded cell's foes budget dropped the FULL frames first - they carry the sweep, the sites and the grants - so a reader missed deaths and removals and pruned a silent owner's foes; and the handover batches, deltas to the budget, were lost after their owner had let the foes go | FOES-FIRST, HIT-DROPS, AUDIT FOES-FIRST, FOES-HOLD, AUDIT FOES-HOLD |
| 2 | "enemy dsync" | A slow owner's foes ran slow for everyone and their puppets stalled and jumped: the owner gave them half its clamped frame (FOE-CATCHUP), and a reader led them by arrival time | OWNER-CLOCK, HOST-CLOCK |
| 3 | the profile's boat pool, `rendererModelKey` 2.6% | One shape stamp for every tree in the game: any boat built anywhere re-planned every boat; and every boat drawn was walked, baked and lit every frame wherever she sailed | BOAT-STAMP, BOAT-FAR, BOAT-OWN, HELD-DRAW, HELD-FLATS |
| 4 | the profile's Horse Cart pool | Inside 400 m every horse was posed and its palette sent every frame, off-screen and parked ones too | HORSE-VIEW, HORSE-VIEW II |
| 5 | the profile's peer bodies, Web Worker | Already on a distance cadence (PEER-CADENCE); a worker would move only what is cheap (interpolation, 0.02 ms) | not a defect |
| 6 | the profile's grass | Under its budget on a walk (PERF-EXT22's slice a frame) - but a slice a frame paced the rim by the frame rate, and at 20 fps a DFU ride, a run or a cart fell more than eight cells behind on 5-13% of its frames (a gallop 25%), at 30 fps a ride 3.5% and a gallop 13%: two whole cells on each of those frames | FB1021B, AUDIT FB1021B |

## What the live service showed (2026-10-21)

- **The relay's own counts** (Analytics Engine `daggerfall_relay`, `world` rooms, ten hours): 482,305 frames its byte
  budgets dropped of 17.0 million foes frames - 2.8%. Every drop of a cell is `_foesFan`'s, the one room-wide bucket of
  `FOES_ROOM_BYTES_PER_S`. Over four days the drop rate ran from 0.01% to 1.25% of all frames in, highest at the
  evening's crowds and the Starfall's.
- **The readers' tallies** (`grant_tallies`, its newest 50,000 rows by rowid, about nine hours): 284,994 `ungranted` -
  a foe whose grant its reader never heard; grants ride full frames - from 1,673 owners, read by 1,968 readers, spread
  over every five minutes of the hour. Not one `stats`: the foe bounds removed nothing from an honest owner.
- **The rooms' resets** (Workers Observability): 877 "Internal error in Durable Object storage caused object to be
  reset" across about a hundred rooms, nearly all between 19:00 and 23:00 UTC on 2026-10-20, each closing every socket in
  its room and its foes with them. Nearly none since world237 went out at 00:24 UTC. No cause was found in this code and
  Cloudflare's status page named none; recorded, not fixed.
- **Not readable from here:** the relay's own settings (`grantMode`, `grantStrip`, `grantDoor`), kept in the hub's
  storage and set with `/relay`. Under `enforce`, the 285,000 `ungranted` records a night are foes its readers stand
  down - the owner checks it with `/relay grantMode`.

## FOES-FIRST and HIT-DROPS (1) - `bible/11-Multiplayer/Scale-Arc.md` FOES-FIRST

A room's foes bucket was shared by every owner in the cell, with no order: the deltas (every 200 ms, small) kept a
crowded cell's bucket drained and the full frames (every 2 s, large) lost first. Measured on the real Room
(`tools/foesFirstBench.mjs`): thirty owners of sixty sockets heard 1.2% of their full frames; now 100%, the bytes out
the same. A delta spends the bucket down to `FOES_FULL_RESERVE` (a quarter), a full frame into a debt of a quarter
second at most; a sender's full frame goes first once a `FOES_FIRST_MS`, a frame that hands foes on (an owner leaving,
dying, going through a door) once a `FOES_FIRST_MS` too, and its next frame first once it has been unheard
`FOES_UNHEARD_MS`. The audit found the handovers held as deltas (a crowded cell's heard 29.2%, a star's 0.8%: now 100%)
and a junked frame's sender left unheard (every frame of it first): both fixed. A cell whose full frames alone pass the
budget (the Starfall's eighty sockets) left them first-come and blind to size, so one LARGE owner among smaller ones, a
star's stander, heard none of its full frames: FOES-HOLD (below) holds such a frame for its turn. The new blobs measure
it live - blob3 the blows the hit funnels dropped (silent until now), blob4 and blob5 the full frames dropped and asked.
Relay world239.

## FOES-HOLD (1, the owner: "No band aids and true improvements") - `bible/11-Multiplayer/Scale-Arc.md` FOES-HOLD

Where a room's full frames alone are more than its budget, a first frame the budget refuses is HELD for its turn
(`server/src/foesHold.js`): one line, one turn a sender, a newer full frame in its sender's place, nothing of a sender
overtaking its own (the readers' `n`), no delta past a held frame, a held frame borrowing to minus the reserve; a held
sender still streaming is beaten - an empty frame of its own, which every reader takes as the owner heard - so its
readers keep its puppets while its turn comes round; a handover waits its turn, never replaced nor aged out, and a
leaving sender's are given a last try before its leave is said, one reserve deeper than any first frame; no frame
jumps the line (a page that calls every frame a handover buys its one turn). Measured on the real Room
(`tools/foesFirstBench.mjs`, 60 s a scene, against FOES-FIRST alone): the star's stander heard 0% -> 44.8% of its full
frames; the bigger star's full frames 31.4 s apart at the 99th -> 5.0 s, the record cap's 60 s -> 10.4 s, nobody
unheard past 4.5 s (10.9 s before); three handover batches at once heard 32.2% -> 100%, and thirty owners handing on
their foes as they close (a door, a teleport, a death) 45% -> 100%. Inside the budget nothing is held and nothing
changed; past it the deltas wait behind the full frames (1.4-4.8% heard -> 0.4%), which carry every record they do.
Five more blobs (blob6-10) count the hold live, and `tools/relayLoad.mjs` reads them (its `fulls` question). AUDIT
FOES-HOLD (the second pass's cold lanes): the held sender's beat repeated the sender's own `k` uncharged (a few sockets
put the room's bucket hundreds of MiB in debt) - now a room key's or none, charged to the first frames' floor; the hold
kept the parsed frame (85 MiB of heap for 4 MiB of text) - now the text, and room made from the sender holding the
most; a handover at a leave was heard 22.5% of the time at a star - now 100%; the pins and the counts with them
(`Scale-Arc.md` AUDIT FOES-HOLD). Relay world239, re-hashed in place.

## OWNER-CLOCK (2) - `bible/06-Systems/Online-Arc.md` OWNER-CLOCK

Every foes and own frame now says its owner's step time (`tm`, ms, wrapped as the pose's stamp is; 14 bytes at most,
0.3% to 3% of a room's foes budget), and a reader leads a puppet by the owner's time between its records, as far as the
owner's own pace of sending (0.3 s to 0.75 s) - a 3-fps owner's foes stood still 35% of the time on a reader's screen,
now 4.8%; a pair carrying one `tm` twice (a clock that stood) is led on the arrival clock. The relay passes `tm` unread
inside `data` - OWNER-CLOCK needs no relay change of its own - and an older reader never reads it. Online with anyone
else in the owner's room (the cell, not only those who see its foes), a slow owner's street foes step its own clamped
frame - 0.1 s at most, in 0.05 s substeps, one extra call a frame and only inside a tenth of the frame's measured time
(none after time away, none on a clock too coarse to price a call) - so they keep pace with its player and never
outrun it, where FOE-CATCHUP alone gave them half of it below 10 fps (three quarters at 15). As first built the same
day they caught up the wall's time instead, three times the player at 3 fps; the audit put them back to the host's
frame. HOST-CLOCK, the same day, put every other pool of the owner's through the same law: a building's encounter pool
and the watch called into it (worldModes.js, one statement at the mount), a dungeon's foes (drawFoes' foe loop, now the
call it hands over) and the street's watch (world.js's one statement) - one plan a frame for all of them, priced at all
of them, the tactics brain's clock carried once, so the watch's brains and bodies keep one clock. A slow building or
dungeon host's foes keep its player's pace (x1 at every rate, where 0.75 at 15 fps and 0.5 below 10 before), measured
on the real pools through the hosts' own wiring. The second pass's audit found a dungeon joiner paying for a catch-up
that stepped none of its foes (they are the host's puppets) - one call now - and a later pool's extras made past the
frame's share on the forecast alone; both fixed and pinned (`Online-Arc.md` AUDIT HOST-CLOCK). FOE-CATCHUP's row in `Port-Ledger.md` says exactly what changed, for
the owner to approve.

## BOAT-STAMP and BOAT-FAR (3) - `bible/07-Rendering/Performance-Priority.md`

Each prefab tree keeps its own shape stamp (`world/prefabNode.js` `prefabShapeStamp(node)`): one tree built a frame
made 747 model keys and an 8.9 ms boat frame; now none and 2.1 ms. A boat past 600 m is walked, baked and lit every
fourth frame on the time she missed, her held walk reused by the flats and the draw, a peer's boat's Animators the
same - the sea's ships' far-life law, moved to `scenes/comeSailAway/farLife.js`: four near and twenty far boats, 4.5 ms
to 2.5 ms. Its audit: a far boat's held walk now ends at any on/off switch in her tree (hidden or shown the next
frame, not up to three later), the stamp's field is `_treeStamp` (the renderer's `_sh*` names are its shadow memory's),
and `setParent` refuses a cycle (as Unity does).

BOAT-OWN, HELD-DRAW and HELD-FLATS (the same day, this record's Left and BOAT-FAR's What it still pays): my own boats'
Animators and particle systems, which Come Sail Away's runtime stepped every frame at any range, live by the far law
through a module the runtime wires (`scenes/comeSailAway/farLife.js` `createBoatLives` - the runtime three logical lines
shorter, its ceiling 2,783 -> 2,780): ten boats of mine, eight moored 1-3 km off, 1.66 -> 0.87 ms a frame (a loaded
container; 0.96 -> 0.39 quieter). A boat switched on or off or reshaped since she last lived lives that frame
(`farTreeStep` - mine, a peer's, the pool's walk alike), so a far boat stood again starts over as she stands. A held
boat is drawn from what her walk's draw found and her flats keep the scale her walk found, only their places made:
four near and twenty far lit boats, the pool's frame and draw 15.59 -> 12.26 ms (5.67 -> 4.66 quieter).

## HORSE-VIEW (4) - `bible/07-Rendering/Performance-Priority.md`

A 3D horse's gait steps every frame; its pose and palette upload wait for the view and the peers' bodies' cadence, a
rider's horse posed with its rider's body, a horse turned into view posed before it is drawn. The cadence - the
horses' and the peers' bodies' alike - is measured from the camera that draws, through its lens (the audit: from the
head, a horse 2.3 m from a zoomed-out third-person camera was posed every other frame, and the spyglass's every
third; now every frame). Twenty peers' horses,
half behind the eye: twenty uploads a frame to 3.7, the pool's frame 0.24 ms to 0.09 ms.

HORSE-VIEW II (the same day, this record's Left): the road's strangers' 3D horses and the standing horses are posed by
the same law, which is its own module now (`world/horseView.js`, the pool's too) - their gait's clocks every frame, their
poses in the view on the cadence, a horse swung into the view caught up before it is drawn. Twelve strangers' horses,
half behind the eye: twelve palettes a frame to 1.85; eight standing horses in the view: eight to 4.33.

## FB1021B (6) - `bible/07-Rendering/Performance-Exterior.md` THE GRASS ON THE MOVE

Measured on the real field over Daggerfall's own ground (`tools/grassMoveProbe.mjs`: WOODS.WLD's woodlands round map
pixel 200,200, the streamer's own floating origin, world.js's keep) at DFU's walk, run, ride, gallop and cart speeds and
at 60, 30 and 20 frames a second. The steady walk was what PERF-EXT22 said; its catch-up was not: PERF-EXT22 placed the
rim a slice a frame - a cell every five frames, whatever the eye's speed - and past eight cells waiting placed every
cell whole, two a frame. So the rim kept the frame rate's pace and the slowest machines fell into the catch-up on the
move: two whole cells (12,244 candidates, eight to ten times a slice frame) on 5% of a 20 fps run's or cart's frames,
13% of a ride's, 25% of a gallop's, 3.5% and 13% of a ride's and a gallop's at 30 fps, 4% of a strong gallop's at 60.
A boot, a teleport, a fast travel's arrival and the jungle floor's re-made meadow placed two whole cells a frame for
~175 frames, and on the move a third of what a gallop's birth placed was behind the rider and let go unseen.

A defect, fixed in `render/labGrass.js` `createGrassField.update`: a rim cell's deadline is the eye's own step - the
frames before it could come inside GRASS_DUE_AT (0.9) of the range - and the rim takes one slice a frame and past it the
least pace that meets every deadline; the cells due now (a birth's, an invalidate's) take a share of the frame
(GRASS_FRAME_MS of a 60 Hz frame, 3 ms, that share of a longer one up to a 20 fps frame) past that pace, the first
whole cell under the eye always; what the step leaves behind waits for the rest. The count switch (GRASS_CATCH_UP) is
gone. The bytes a cell is placed with are unchanged. The trade - a birth's frames lighter, its far band slower - is
stated in the record for the owner to weigh.

AUDIT FB1021B (the same day, the record's own section): one cell due now had turned the deadlines off - the frame's
share replaced the pace and went to the cells due now first - so a birth on the move (the jungle floor's re-made meadow
on a ride, an Overworld journey's end, a publish over the disc) or a band cell re-read behind the step, on a machine
whose share placed less than the eye brought in, never recovered: the test bench's slow machine born on a 20 fps DFU
ride stood holes inside 0.9 for 1,006 frames, 342 cells crossing it unplaced, and a strong gallop with one band cell
re-read behind it had a hole on every frame. Fixed: the pace is counted without the cells due now and spent first, on
the rim cells it reaches; the cells due now take the share past it - 0 cells crossing on every run, and a birth on the
move whole in the frames a standing one takes (597 for 562 there). And: a cell in progress the eye brings inside the
fade's start is placed whole as an inner cell; the jungle's two fields each take their own share (said, not shared:
the record says why); a whole cell's cost with its pack and the cell in progress's `behind` pinned.

## Left

- **The Durable Object resets' cause.** Not found in this code, read again for the owner's "no band aids": a Starfall
  cell (the event live that evening, world235) writes its star's ledger - at most STAR_ACCOUNTS_MAX (64) accounts, a few
  KB - when a word moves it and every STAR_SAVE_MS, mostly on its owner's words (`net/starfall/starfallLaw.js`
  foldStarWord), a few writes a second, no storm; no `deleteAll` runs; a drained room's sweep lists two prefixes.
  Cloudflare's troubleshooting page names a storage operation past its time limit as the documented reset (a
  `deleteAll` on a large object its example) and says nothing of "Internal error in Durable Object storage". The live
  read - Workers Observability's resets by room against the rooms that were writing - was not possible from this
  session (its Cloudflare call refused by the session's own permission check); `tools/relayLoad.mjs`'s `storage`
  question (FOES-HOLD) reads the second half from the relay-load workflow, with the repository's own token.
- **The relay settings' state.** Read from the deploy: `GRANT_MODE`, `GRANT_STRIP` and `GRANT_DOOR` have no value in
  `server/wrangler.toml`, so the relay runs `measure` (an `ungranted` tally stands nothing down) with the strip and the
  door off - unless the owner set one with `/relay`, which the hub's storage keeps and only `/relay grantMode` reads.
- **The version.** This release is world239, past STAR-TUNE's world238 (#1090, merged first - its law is in world239's
  with it); GRANT-SLEEP #1066, open, claimed world238 too and takes the next number at its merge.
- **FOES-HOLD's own (`Scale-Arc.md` FOES-HOLD's Left).** A room past its budget moves its puppets by its full frames:
  thinner frames would carry more, a slice of the wire's own. A room's budget is shared: sockets sending the largest
  frames the wire takes still take their turns, one a sender, and stretch an honest owner's round. The dungeon's own
  lane takes the beat by reading; the pins run it through the street pool and the dungeon host's stream.
- **The grass (FB1021B, `Performance-Exterior.md` THE GRASS ON THE MOVE's Left).** A cell's pack - now as dear as its
  placement, still one piece on the frame a cell ends; the cells a teleport's loading frames place over ground not yet
  built (read on the code, not measured); the worker PERF-EXT22 did not build. And the trade FB1021B states for the
  owner, re-measured at its audit: a birth's frames lighter (p99 7-9 ms of CPU at 60 fps where the base's were 11-13),
  its band whole in up to two and a half times the seconds on this container - timed on the wall clock, so a busier
  machine reads longer; and in the jungle, while both fields fill, two shares a frame (AUDIT FB1021B F3).
