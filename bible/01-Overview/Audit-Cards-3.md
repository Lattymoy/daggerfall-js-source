# AUDIT CARDS-3 (2026-10-08) - the Tavern Cards arc, CARDS0 to CARDS5

Mac: **"I wanna do a deep comprehensive of everything and give the cards daggerfall especially themes instead of the
simple hearts queens and kings"** - the arc on `11-Multiplayer/Tavern-Cards.md` after CARDS5 (the relay deals),
CARDS4b (the regulars in their chairs) and CARDS3b (the hand held, the chips dragged, the riffle) landed on AUDIT
CARDS-2 (`Audit-Cards-2.md`). The theme is its own slice, CARDS-BAY (Tavern-Cards section 21).

## How it was run

Five lanes, each an adversarial reader of a FROZEN snapshot (a git worktree at 37d121ef - Home.md's DO NOT FIX WHILE
THE VERIFIER IS READING), each told to reproduce every finding before it reported it:

| Lane | Over | How |
|---|---|---|
| A | the relay's card tables (`server/src/index.js`, `net/holdemTable.js`, `net/wire.js`) | 1.8M random sit/stand/act/tick operations on the pure table (3 seeds x 1,500 tables, about 112k hands); the relay end to end on the fake room (54k operations with drops, same-id reconnects, wakes and fires); storage and frame sizes |
| B | the client online and the interior host's card block, the regulars' bodies | the host block sliced from `worldModes.js` and RUN against an in-process relay that can drop and rejoin a player, run the client's gate and fail a send; the regulars' paperdoll layer counted texture by texture |
| C | the held hand, the drag, the riffle, the cloth | the real `cardPointerListen` in Chromium; 20 seeds of the host's draw list at 60 fps, every card tracked frame to frame; 40 seeds of all-in run-outs; the probe's shots against the panel |
| D | the record and the pins | doc against code, the six failing suite pins judged, 61 candidate mutants of its own |
| E | AUDIT CARDS-2's fixes, playing online, the merge | every earlier fix re-verified; 1,030 online evenings on the fake room (about 24,000 hands, 500 drops, 1,500 wakes) under four player styles; lane F's economy sims re-run; `git merge-tree` against main |

Every finding was reproduced again on the LIVE tree before its fix and pinned after it.

## Findings

| # | Sev | Finding | Verdict |
|---|---|---|---|
| D1 | HIGH | Online, the cloth and the turn's clock ran on the wrong clock: `OnlineSession` stamps a frame's `at` with `Date.now()`, the cloth and the panel read `performance.now()` - a deal dated 1.79e12 never reached the cloth, the panel read "Your turn - 1791430904 s." (lane D) | FIXED: world.js restamps every holdem frame with `performance.now()` on its way to the host |
| B2 | HIGH | The client took its chair on faith: a frame the relay made before it read the sit showed the chair empty and dropped it for good (seated at the relay, never shown her cards, clocked out every hand); a raced chair left the loser "seated" in the winner's chair, drawn as his, holding his cards before the eye (lanes B, D, E) | FIXED: my chair is the one my id sits in (`RemoteCardTable`) - pending until a state shows it, lost ('refused') when another holds it or the sit is refused, lost ('stood', 'broke') when a confirmed chair empties; a refused sit stands the player up |
| B1 | HIGH | A reconnect left the player seated in a hand that was over, or waiting at a table that no longer seated him: the relay stood the old socket up and told it, not him; "Your turn" with Fold and Call for good (lane B) | FIXED: online.js counts the primary socket's welcomes; on a new one the host asks its sit again (`resit`, the chair pending, the turn forgotten) - and the relay lets a dropped player's sit take his own chair back mid-hand (E-N1) |
| C1 | MED-HIGH | The panel covered the held hand and most of the player's own stack (lane C) | FIXED: on a wide screen the panel docks to the right; the hand lifts clear of the panel's top (`heldLift`, eased, at most `HELD_LIFT_MAX`) |
| A1 | MED | A sit refused at another table stood the sitter up from his current table first: folded out of turn unsaid, the pot moved unsaid, storage left holding the old hand (lanes A, D, E) | FIXED: the sit is tried first; only a sit that took stands him up elsewhere, said and saved |
| A2 | MED | One account sat twice at one table under two ids and saw both hands (lane A) | FIXED: 'account seated' - one seat an account in a room |
| A3 | MED | Seats whose sockets the relay closed itself were never stood up: ghost hands dealt for ever on the alarm, the room never forgot, and once an empty room's hello swept the secrets anyone saying a ghost's id took its cards (lane A) | FIXED: the alarm reaps; its tick stands every seat with no hello'd socket and gives the alarm back when the last table goes; the empty room's sweep stands every seat |
| A4 | LOW-MED | No room-wide budget on sits: ten sockets toggling sit and stand pushed 1.17 MB in ten seconds into a room of sixty, with 380 storage writes (lanes A, E) | FIXED: the room's sits on `holdemSitRoomGate` (`HOLDEM_SIT_ROOM_HZ_MAX`, refused 'busy'); a word that moved nothing writes nothing |
| A5 | LOW | A table reopened at other chairs or stakes was accepted silently - the first sitter decided every cloth (lane A) | FIXED: 'table differs' |
| B3 | MED | A relay refusal was never painted when it came, and once set never cleared (lanes B, D) | FIXED: a refusal repaints (`said`); a new turn or the table moving on clears it |
| B4 | MED | The client's gate dropped the stand word, the host closed its game anyway, and the relay kept the player seated - clocked out every hand (lane B) | FIXED: a stand that did not go is said again each frame until it goes (`cardStand`) |
| B5 | MED | On the player's turn the panel was rebuilt once a second, destroying the slider being dragged and the button being pressed (lane B) | FIXED: a model that differs only in its message rewrites the message in place |
| B6 | MED-LOW | Playing the regulars at table N, the relay's table N was laid as a watch on the same cloth (lanes B, D, E) | FIXED: a seated player never watches his own table |
| B7 | LOW-MED | Stood up by the relay (out of chips), the host barely noticed; the log said it in the third person (lanes B, D) | FIXED: the game turns over ('broke', 'stood'), the drain that stood him is said to him |
| D4 | MED | ACC1-CI: `net/holdemTable.js` and `net/cardLaw.js` joined the account Worker's bundle through wire.js but not its deploy's path filter - a change to either alone never redeployed it (lane D) | FIXED: both in `account-deploy.yml`'s filter |
| C2 | MED | A press on his own stack when it was not his turn stood the player up, cashed him out and folded the hand (lane C) | FIXED: a press on the stack is always the chips' |
| C3 | MED | The held hand teleported when picked up and when folded; the second card's arrival jolted the first (lane C) | FIXED: each card eases between its cloth pose and the hand (`blendMatrix`, `HELD_EASE_S`); the fan is laid for the whole hand |
| C4 | MED | The next hand was dealt before the last showdown finished on the cloth - a run-out's river never turned, the pot share jumped (lane C) | FIXED: offline the deal waits for the cloth (`settledAt`); at the relay each street of a run-out lengthens the pause (`HOLDEM_RUNOUT_MS`) |
| C5 | MED | On touch devices the peek and the chip drag could not be reached (lane C) | FIXED: pointer events |
| E-N4 | MED | M9 regressed: CARDS3b narrowed the cloth pin to cards at rest, one frame in thirty - the fold-from-rest and flat-scoop mutants survived (lane E); sampled every frame, a pot share came home THROUGH a resting hole card (lane D) | FIXED: the share comes home in the stack's own columns, away from the cards (`chipDiscs` outward); the pin samples every frame, and a continuity pin fails any card that jumps |
| C6 | LOW-MED | A dragged bet was not kept to the table: let go five metres past it (or over the panel), it bet (lane C) | FIXED: `onTable`, the table's frame on the places; a release over the panel or off the table bets nothing |
| C7 | LOW-MED | A drag never called while a raise was open: the untouched slider raised (lane C) | DECIDED (section 19): chips pushed in with the slider untouched CALL; nothing to call, the least bet |
| D7 | LOW-MED | `look` was dead on both ends: a player entering mid-hand saw nothing till the next event (lane D) | FIXED: each of the room's tables is asked once a visit |
| E-N3 | MED | A relay player could sit in a chair the regulars sat in - two bodies in it (lane E) | FIXED: a regular is not drawn in a chair a player took; "Play the regulars" only with a chair for one (B11) |
| B8 | LOW-MED | With the living world off, a regular's last line stayed on the screen for good, into every room (lane B) | FIXED: the crew layer told once more when the last line ends |
| B9 | LOW | The seated cloth skipped the chair-count check watchers get (lane B) | FIXED: A5 refuses the mismatch at the relay; the host drops a cloth of other chairs |
| B10 | LOW | Each evening's regulars' doll textures were never released (lane B) | FIXED: `destroy()` frees the dolls (clear keeps them for the next stand) |
| C8 | LOW | While a bet was carried the full stack was still drawn (lane C) | FIXED: the carried chips are off the stack (`poses(t, view, carried)`) |
| C10 | LOW | Hovering the panel peeked the hand under it; a drag let go after the turn passed still acted; the right button dragged (lane C) | FIXED |
| E-N5 | LOW | A friendly game refused every save, the realm's quiet checkpoints included (lane E) | FIXED: `cardTableLive` is a gold table's |
| D9 | LOW | The FOUR HOSTS record never named exterior.js's card table: it mounts worldModes but hands it no `cardOnline` and no `cardRegulars` (lane D) | RECORDED (section 20): there, the table is offline and its regulars unseen |
| D10, D11 | LOW | Section 19's "a throw may skim a stack" was not the whole truth (the push, above); three comments moved off their lines | FIXED |
| M | - | 58 of lane D's 61 candidate mutants survived: the relay table's blinds, button, words both ways, clock; the client's catch-up and clock; the regulars' looks; the riffle; the host lines | FIXED: `test/auditcards3_relay`, `_host`, `_pins` and new driven host tests in `cards5_client`; `tools/mutants/auditcards3.json`: 111 dead and 2 equivalent (lane D's 61, 9 re-aimed; 52 on this audit's fixes and the deck) |
| S | - | Six suite pins failed on the pushed head (ACC1-CI, audit24 wave45, HT-WAIST-BACK, LW8, LW8b, MWBODY1) | ACC1-CI was D4. The rest were text: the regulars now draw through their own hooks (`drawCardRegulars`, `cardRegularBillboards`), the pinned lines as they were; pointer events took wave45's first `mousemove` back |

## What held

Lane A: the pure table over 1.8M operations - chips conserved every operation, no hole card in a room frame before the
showdown, no deck in any frame, no stuck hand, a deal always scheduled when two can play; the relay end to end with
A1's fix in place - every hole frame to its own seat only, the alarm never late, memory always matching storage; a
table of six at 2 KB, sixteen at 32 KB; the wire refusing every malformed word. Lane B: an older relay falls back to
the friendly game, no purse touched; another seat's cards never shown; every watch freed on every road out. Lane C: no
held card clipping the cloth at any pitch; AUDIT CARDS-2's M4 (156k + 470k frames), M5 and the cloth half of M6 hold;
the riffle never cuts a chip or leaves the table. Lane E: 31 of AUDIT CARDS-2's 32 fixes held in the code (M9 was
E-N4); 24,000 online hands with 0 failures; the economy within noise (exploit -38 to +27 bb/h, sd ±30).

## Recorded, not built

- `D-public-clock-always` and `D-client-at-dropped` are equivalent (their records say why).
- A thrown card's last centimetres may still skim a tall stack's top chip for a frame (three frames in four evenings).
- The deck is not one continuous object: the riffle's cards appear from nothing and the first throw starts at the
  dealer's hand, not the squared deck (lane C, LOW).
- A frame repeats the whole public table; a delta would shrink it (lane E, bandwidth).
- THE MERGE (lane E): main is 54 commits on; five files conflict, all by both sides adding: `worldModes.js` at
  `tryExit` (take main's signature, the seat's line FIRST), `Testing.md`, `Active-Arcs.md`, `Port-Ledger.md`,
  `Online-Arc.md`. main is still at world175: world176 does not collide.
