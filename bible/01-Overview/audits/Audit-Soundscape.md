# AUDIT SOUNDSCAPE (2026-10-24) - the world heard, audited before it merges

The owner, of SOUNDSCAPE (SEA-AIR and WORLD-AIR), SEA-SCORE and HORSE-VOICE (`08-Audio/Audio.md`, `06-Systems/Horse-Care.md`
HORSE-VOICE, Port-Ledger A's three rows): **"Audit this and ensure its perfect"**. This page is the findings, each with its
verdict. What the audit changed is written into the record's sections as they now stand, each change under its
finding's id (AUDIT SOUNDSCAPE S1 and on), and the code says the same at every site.

## How it was run

Six lanes, each a cold adversarial reader of the branch at f5e9fa237 (its base 3efcee249's merge of main followed, the
same tree), told to reproduce every finding - a probe script and its saved output - before reporting it, and to cite the
code by its text. Each read a FROZEN SNAPSHOT of the tree (Home.md's DO NOT FIX WHILE THE VERIFIER IS READING): the
fixes were made in the working tree beside them and no lane read a line of them. Every finding was then met by a pin
that fails without its fix and a mutant record that proves it.

| Lane | Over | How |
|---|---|---|
| S - the sea | SEA-AIR: the laws, the driver, the deck's events, the bells | 16 probes: a pause under the bells, the camera turned against her bow, my own deck at anchor, a passenger's deck, the beds and the mod's hull loops measured through the engine in Chromium, the bed maker without idle callbacks |
| W - the land | WORLD-AIR and the host half: the shore, the wild, the town, the doors | 14 probes, the player's own ARENA2 read: every one of 22,070 doors' types, a dungeon's rect, a swimmer far out, a lake, the edge walked along, the crash's sync, the clips' edges, the CC0 pages |
| H - the horse | HORSE-VOICE: the voices, the hooves, the rig, the peers, the loader | 10 probes: the rig against its parent's (7,452 calls, the same), the switch flipped mid-ride, a gallop's stride against its breath, a journey and a pause |
| M - the music | SEA-SCORE: the law, the hold, the songs, their levels, MIDI-out | 9 probes: the law driven through a boarding and a dark pirate, the hold at the calm line and a hostile's edge, every song rendered whole in Chromium beside MIDI.BSA's, the notes' overlaps, CC7 on a device |
| P - the pins and the record | every test, mutant record and claim of the change | 55 mutants of its own and 6 its titles claim, the suite over every file that names the touched ones (758 files, 8,469 tests), the record against the code |
| R - the real game | the change in the running game, its own data | the game booted in Chromium on the player's ARENA2 - a town, a coast, the deck (its report below, when it comes) |

**WHAT THEY FOUND.** 50 findings in five lanes (S 11, W 14, H 9, M 8, P 8; lane R's below): one HIGH, thirteen MEDIUM,
the rest LOW and NOTE. The HIGH broke the suite (P1). Seven of the MEDIUM reached the player as a promise broken: a
pause rang every bell stroke it held at once (S1); a deck off the helm was land, the surf "standing in it" at full over
40 m of water (S2); the town's air played in a dungeon's rect (W1) and its taverns and anvils stood inside their
buildings (W2); a swimmer far out was at the shore (W3); a boarding played the overland song over a sea fight's climax
(M1); and the fight's song gave away a dark ship the watch had not sighted (M2). The other six were the pins' (P2-P7):
doors the host reads never varied, a pause pinned nowhere, the rig never run on its producers' shapes. Each is FIXED
below or LEFT and said.

## S - the sea (SEA-AIR)

- **S1 MEDIUM - a pause bunched the bells.** The events' clock ran under a pause while the queue held, so every stroke
  that fell due under one rang on the unpause frame together (six strokes, 15 dB over one). FIXED: the clock stands
  with the game (`if (!s.paused) t += step;`). Pinned (seaair A PAUSE AND A FLICKER), AUDIT-SOUNDSCAPE-S1-the-clock-run-under-a-pause.
- **S2 MEDIUM - my own deck off the helm, or a sea ship's, was land**: no sea air, and over 40 m of water the shore's
  surf at full ("standing in it"). FIXED: the host is handed the naval host's deck test (`aboard`), any ship's deck the
  sea's, lying still off a helm; and the shore's edge is found from either side (W3). Pinned (soundscapehost ANY SHIP'S
  DECK), AUDIT-SOUNDSCAPE-S2-*.
- **S3 LOW - her bow, her sides and her bell were the camera's.** Looking astern put the spray astern; looking abeam put
  every slap on her bow and stern; the bell turned with the head. FIXED: her heading off her own rotation (world.js
  boatForward, handed as `bow`) places all three; the ear's forward only where she gives none. Pinned (seaair HER BOW,
  soundscapehost HER BOW AND A PEER'S BOAT), AUDIT-SOUNDSCAPE-S3-*.
- **S4 LOW - a passenger on another player's boat heard her lying still and furled** at six knots (my own idle helm's
  word). FIXED: a boat I ride and do not steer says her way by her root's own going (eased over 0.6 s, a step past
  40 m/s a recentre or a snap) and her sails by her masts' Animators. Pinned, AUDIT-SOUNDSCAPE-S4-*.
- **S5 LOW - without requestIdleCallback all three of a deck's beds were made in its first frame** (58.9 ms). FIXED with
  W4: off the main thread.
- **S6 LOW (judgement) - the beds sat 16 to 24 dB under Come Sail Away's own hull loops** on the same bus, under 500 Hz
  where both live. FIXED: levelled up about 9.5 dB - a moderate sea about -38 dBFS at the ear, a gale about -34, beside
  DFU's rain loop's -40 and still well under the mod's loops' -24. Pinned to its literals (seaair THE BEDS).
- **S7 LOW - the clips were asked once**: a first load that failed left every slap, creak and gull silent for the
  session. FIXED: one loader for the port's clips and the horse's (`clipInstall.js`): asked again at 2 s, 8 s, 30 s and
  2 min, then not at all; a file refused (4xx) never asked again; asked every frame with nothing to do it makes
  nothing. Pinned (soundjobs THE CLIPS' LOADER), AUDIT-SOUNDSCAPE-S7-*, -H2-*, -H6-*.
- **S8 LOW - the luff flapped at once at every return of its law**, a burst where a luff is a flap every second or three.
  FIXED: never sooner than LUFF_GAP_S's shortest after the last flap. Pinned, AUDIT-SOUNDSCAPE-S8-the-luff-at-each-return.
- **S9 NOTE - online, a crossing's dial silenced the bells while the shared clock ran at its own pace.** FIXED: the
  pace is read off the clock itself (its minutes a real second, eased over 3 s), never the dial: none past 0.5 (Come
  Sail Away's x5 rings none). Pinned (seaair THE DRIVER'S BELLS), SEA-AIR-the-paces-gate.
- **S10 NOTE - `ROPE_GAP_S.furled` was never heard, and raising sail inherited its gap.** FIXED: the furled gap gone;
  the ropes re-armed as the sails go up.
- **S11 NOTE (judgement) - two winds**: the sea's state reads the sky's wind, her sailing Come Sail Away's own. LEFT, SAID:
  the ear hears one wind, the one WIND3's bed and the trees already say; the record states the choice.
- Checked and sound: the bells' count (the US convention, midnight's eight across the wrap, the pairs); the helm's dial
  reaching the world clock; `far` offsets across a recentre; handedness; switch, helm, modal and skin lifecycles leave
  nothing looping; the seams; 3.2 us a frame at sea; the gulls' ring and the map's edges; DAGGER.SND 107 played as the
  arena and the naval host play it.

## W - the land (WORLD-AIR, the host half)

- **W1 MEDIUM - the town's air played in any location's rect** - a dungeon's, a graveyard's, a coven's. FIXED: PlayerGPS's
  own strict town test (`_isPlayerInTownStrict`). Pinned (soundscapehost THE WORLD HOST's text), AUDIT-SOUNDSCAPE-W1-*.
- **W2 MEDIUM - a tavern's noise and a smith's anvil stood at the building's placement**, its middle, 7 to 13 m inside it.
  FIXED: each at its own doorway - its door's centre 1.2 m out along its face (`foeSpacing.js` doorSpotsNear, the one
  home of a door's place). Pinned (THE HOST ON LAND), AUDIT-SOUNDSCAPE-W2-the-door-inside-its-building.
- **W3 MEDIUM - a swimmer far out at sea was at the shore's edge**, the surf at full. FIXED: the edge is where the water
  changes, found from either side; far out there is none. Pinned (THE SHORE'S EDGE), SOUNDSCAPE-HOST-the-seas-side-unread.
- **W4 LOW - a bed made in an idle callback still stalled the frame** (an idle callback with a timeout runs as one
  ordinary task on a busy page): 15 to 50 ms warm, 70 to 170 cold. FIXED: made in a module worker (`soundJobs.js`,
  `soundWorker.js`, spelled the way Vite bundles one), idle time where none can be had, at once with neither; one at a
  time; a thrower given up; a failed worker's beds made here and its town jobs asked again of their driver (their voices
  went with it). Pinned (soundjobs), AUDIT-SOUNDSCAPE-W4-*. Run under Vite's dev server in Chromium: the swell and a town's
  murmur made in the worker and registered, the longest main-thread call 2.6 ms, no error.
- **W5 LOW - each wave's crash played twice, once a second late.** FIXED: once a wave, started so its own loudest falls on
  the bed's crash; the curl lengthened to 1.0 s so the later take can be. Pinned (THE EDGE STANDS AND THE CRASH IS THE
  WAVE'S), AUDIT-SOUNDSCAPE-W5-the-crash-at-the-beds-crash.
- **W6 LOW - the crash was attenuated twice** (the gain and the panner). FIXED: its loudness the sea's alone. Pinned,
  AUDIT-SOUNDSCAPE-W6-the-crash-attenuated-twice.
- **W7 LOW - a pause ran the queue's clock.** FIXED: every clock stands with the game. Pinned (A PAUSE), AUDIT-SOUNDSCAPE-W7-*.
- **W8 LOW - a lake the map draws was the sea**, its shore surfing. FIXED: the host reads the open sea (world.js openSea).
- **W9 LOW - the edge moved with the ear** between asks. FIXED: the host's edge is a point that stands; its distance is
  measured live. Pinned, AUDIT-SOUNDSCAPE-W9-the-edge-moving-with-me.
- **W10 NOTE - the surf stood at the ear's height** - off a cliff, in the air. FIXED: at the sea's own surface (Deep
  Waters' `oceanY`). Pinned, AUDIT-SOUNDSCAPE-W10-the-surface-unread.
- **W11 NOTE - the host walks the door list twice a second.** LEFT, SAID: a few hundred entries on a clock of its own,
  a few microseconds; the doors within reach are the list's own question.
- **W12 NOTE - the frogs' croaks clicked at their edges, and the owl sat 8 dB over the crow's caw** at the same peak (a
  pure tone is louder than its peak says). FIXED: each croak eased in over 4 ms and out over 15 (`sndify.mjs` bake
  `edges`, the frogs alone re-baked); the owls taken down to 0.2-0.32. Pinned (THE FROGS' EDGES, THE WILD BY CLIMATE),
  AUDIT-SOUNDSCAPE-W12-*.
- **W13 NOTE - one 8 s loop of the same voices was a loop an ear finds, and a tavern at four in the morning was as loud
  as at noon.** FIXED: the murmur two loops, the second lower; the tavern asleep from 2 to 10. AUDIT-SOUNDSCAPE-W13-*.
- **W14 NOTE - "far and seldom" in a town was seldom alone.** FIXED: 1.6 times further off too. AUDIT-SOUNDSCAPE-W14-*.
- Checked and sound: every door's type off its block (0 mismatches over 22,070 doors); the climates' table; winterIn;
  Deep Waters' column in the scene's frame; the CC0 pages and their authors.

## H - the horse (HORSE-VOICE)

- **H1 LOW - a ride heard on DFU's sounds a while came back to stale voices**: a mount's whinny 300 s after the mount, a
  long-gone gallop's blowing, a spook's neigh a minute late. FIXED: the rig's switch-off arm hushes the voices
  (`hush`), owing nothing. Pinned, HORSE-VOICE-H1-*.
- **H2 LOW - the loader asked every 2 s for the session** (450 requests a minute for a file refused). FIXED with S7.
- **H3 LOW - the gallop's breath kept pitch 1's stride while a gallop plays at DFU's 1.2**, slipping a stride every five
  breaths. FIXED: the stride over the loop's own pitch. Pinned, HORSE-VOICE-H3-the-stride-at-pitch-1.
- **H4 NOTE - a pause dropped the clock's moment.** FIXED: held and said on the first frame after (DFU's `Time.time`
  stops). Pinned, HORSE-VOICE-H4-a-moment-dropped-in-a-pause.
- **H5 NOTE, older than this change - the classic arm neighs at a constant 0.6 through a Travel Options journey and under
  a pause**, where DFU's neigh rides RidingVolumeScale on `Time.time`. LEFT, FLAGGED for a change of its own: the arm is
  the port's older line kept verbatim (the classic parity this change promises), and the voiced arm is right on both.
- **H6 NOTE - allocations every frame** (a promise, the queue's filter). FIXED: the loader makes nothing with nothing to
  do; the queue filtered only when it holds anything.
- **H7 NOTE - the tool said the fast clop has three ghost falls**; HorseClop2 has seven. FIXED: the comment says seven and
  that the cadence keeps three.
- **H8 NOTE - "off horse care, a long gallop leaves its own blowing" holds only where a rider gallops** - with Roleplay &
  Realism's riding. FIXED: Horse-Care.md says so.
- **H9 NOTE (judgement) - the spook fires on a foe unseen in the spawn band.** LEFT, SAID: it is DFU's own question,
  areEnemiesNearby; the record says "foes about" and names it.
- Checked and sound: the classic rig's 7,452 calls the parent's; the peers' parity; DFU's laws untouched; no gain twice;
  the ground's table; no TDZ; the cooldown; a dismount dropping the spook's neigh.

## M - the music (SEA-SCORE)

- **M1 MEDIUM - a boarding dropped the fight's song for the overland one.** "Grapples away!" and "Repel boarders!" let the
  helm go, the law answered null and the deck fight, a sea fight's climax, played the weather song. FIXED: aboard in a
  sea fight the fight's still, and a fight ended aboard keeps its tail. Pinned (seascore THE HOLD, soundscapehost EVERY
  DOOR THE SCORE READS), AUDIT-SOUNDSCAPE-M1-*.
- **M2 MEDIUM - the fight's song gave away a dark ship the watch could not see** (hostileNear's 700 m, no night law):
  the leak AUDIT WK-W2 closed. FIXED: the naval host's `battle` - her guns run out, the crew called by WK-W2's alarm, or a
  boarding. Pinned, AUDIT-SOUNDSCAPE-M2-*.
- **M3 LOW - the hold was a timer, not hysteresis**: a change every 90 s on the dot at the calm line, the still sea's
  choir and the shanty's last tutti never heard; a hostile at the edge restarted the fight's song seventeen times in
  five minutes. FIXED: a song plays whole (its length, never under 90 s), the law must want another for 20 s on end, the
  fight's tail 20 s. Pinned, AUDIT-SOUNDSCAPE-M3-*.
- **M4 LOW - the record's levels measured each song's first 30 s.** FIXED: the probe renders and measures every song
  whole, beside MIDI.BSA's outdoor songs whole; the record restates every number (22/22 checks pass).
- **M5 LOW - re-struck notes on a sustaining voice cancelled**: the storm's drive quietest, with holes 18-20 dB deep, on
  its own tonic. FIXED: THE DRIVE, a cello that speaks and stops inside its note, and a key struck again ends the note
  before it. Pinned (seascore THE BAND), AUDIT-SOUNDSCAPE-M5-*.
- **M6 LOW - on a MIDI device the mix flattens above about 0.6 MusicVolume** (CC7 tops out at 127). LEFT, FLAGGED: at the
  default every level fits, as MIDI-OUT1 records for the made scores; re-voicing six songs' velocities is its own pass.
- **M7 NOTE - SEAFIGHT has no major IV, and SEAOPEN is G major with a borrowed flat seventh**, not Mixolydian. FIXED: the
  header and the record.
- **M8 NOTE - the fight's timpani fifth reaches G1 and the night's flute B3** on a GM device. LEFT, SAID: the FM bank plays
  any key; the record says so.
- Checked and sound: no MIDI.BSA name begins SEA; made once, registered before play, a pack replaces them by name; the
  chain; the gate; velocities, durations, programs and channels; every loop seam on its bar line.

## P - the pins and the record

- **P1 HIGH - the change turned the suite red**: the Enhanced sounds note was 548 characters, FT15's cap 450. FIXED: 444,
  the rest the bible's.
- **P2 MEDIUM - the pins never varied what the host hands the songs and the air** - the fight, a port, the weather, the
  night, the wind, the land near, the town, the winter, the weaponsmith. FIXED: every door varied and heard
  (soundscapehost EVERY DOOR THE SCORE READS, EVERY DOOR THE AIR READS), AUDIT-SOUNDSCAPE-P2-*.
- **P3 MEDIUM - stepping from land onto a deck never let the land's air go, unpinned.** It did; now pinned (THE HOST).
- **P4 MEDIUM - a pause was pinned nowhere outside the voice.** FIXED: the deck, the land, the rig and the world host's
  hand-over each pinned, AUDIT-SOUNDSCAPE-P4-the-pause-unwired.
- **P5 MEDIUM - the rig's reads never saw the shapes their producers make.** FIXED: the rig run with horse care's `bar`,
  foes about, a journey's 0 and a pause (horsevoice THE RIG'S READS), AUDIT-SOUNDSCAPE-P5-*.
- **P6 MEDIUM - numbers the record states were pinned only against themselves.** FIXED: each to its literal, in every lane.
- **P7 MEDIUM - mutants a title named had no record.** FIXED: the records written; "sails set, making way, no luff"
  pinned. Two lane P found equivalent (the surf's reach gate, a null cached) stand unrecorded.
- **P8 NOTE - small errors in the record** (a cicada and a night bird never installed, the owl's "double", the second
  howl's glide, both owls' rows, "a second call in three", the beds' "5 to 30 ms"). FIXED, each.

## R - the real game

Lane R (the change booted in Chromium on the player's ARENA2: a town, a coast, a deck) had not reported when this page
was written; its findings are added here, each with its verdict, when it does.

## The pins

`test/systems/soundscape/seaair.test.js` (10), `soundbeds.test.js` (3), `soundjobs.test.js` (5), `worldair.test.js` (10),
`seascore.test.js` (6), `test/scenes/soundscapehost.test.js` (10), `test/systems/horse/horsevoice.test.js` (13);
`tools/mutants/soundscape.json` (135), `seascore.json` (38), `horsevoice.json`
(49), all dead. `bootWorld`'s ceiling rose by the audit's 3 logical lines of wiring
(`test/scenes/hostceiling.test.js`, the reason beside it); `createNavalHost` grew by its `battle` word, inside its own.

Not done here: nobody has listened to any of it. Every level is set on measurements.
