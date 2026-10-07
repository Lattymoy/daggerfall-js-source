# AUDIT CARDS (2026-10-07) - the Tavern Cards arc, CARDS0 to CARDS2b

Mac: **"Lets do a comprehensive audit on everything developed so far"** - the arc on
`11-Multiplayer/Tavern-Cards.md`: the design record (CARDS0), the cards' law (CARDS1), the table and the seat (CARDS2),
the seated body and the seat on the wire (CARDS2b).

## How it was run

Five lanes, each an adversarial reader of a FROZEN snapshot (a git worktree at 444f558c - Home.md's DO NOT FIX WHILE
THE VERIFIER IS READING), each told to reproduce every finding before it reported it:

| Lane | Over | How |
|---|---|---|
| A | `net/cardLaw.js`, `net/dice.js` | ~140k random hands against independent invariants and an independent evaluator (200k seven-card pairs), the rules case by case |
| B | the seat in the interior host, `world/cardTables.js`, the census | every road the seat meets, read end to end |
| C | the wire, the sender, the peers, the relay versions | the frames, the relay's own checks, the live relay's `/health` |
| D | the seated body's pose | solved on retail's biped at four yaws, three tops and five race scales |
| E | the record and the pins | the mutants re-run in a copy of the tree, candidate mutants of its own |

Beside the lanes, the sweep of every test that reads a touched host (1,562 files) found ten failures of CARDS2b's own
(below, S1). Every finding was verified against the code before it was fixed; the fixes were made in the live tree,
never the snapshot.

## Findings

| # | Sev | Finding | Verdict |
|---|---|---|---|
| C1 | HIGH | CARDS1 re-hashed `world175` in place calling it undeployed; the live relay answers `{"version":"world175"}` (relay-deploy.yml deploys every push to main that moves RELAY_VERSION). Merged alone, the relay's law would have changed under a live version - SLAM8's bug. | FIXED: the row restored byte for byte from main; world176 (already CARDS2b's) carries the dice lift, said in its row and in RELAY_VERSION's chain |
| C2 | MED | The world175 -> world176 sed rewrote history in 21 version chains ("TEXT-F1 moved it on last (world176") and dropped the live world175 from four capability lists | FIXED: rebuilt from main - lists append world176, chains prepend "CARDS2b moved it on last", the bare reads move on |
| S1 | MED | The sweep: CARDS2b's body-at-the-seat and third-person view rewrote lines DISC18, CLIMB6 C16, AUDIT 65 XL-4, MWBODY1 and AUDIT CLIMB-ARC N1 pin; the Escape line broke U43's one dispatch; the seat byte broke MAC7's arm literal; and the RELAY_VERSION bump REPLACED its 148 KB version chain (HT-WAIST-NET's pin) | FIXED: the seat's view is section 2's first person (the design's own); Escape spent above the dispatch as AUDIT 29 D1 spends one; the byte set after the literal; the chain restored with CARDS2b at its head |
| B1 | HIGH | `forceExitToExterior` (a load, a quest teleport, Recall, a respawn, sailing) never cleared the seat: outdoors the pose kept saying the tavern seat to every peer; loaded into a room, the eye stayed at the old seat | FIXED: `setMode` empties the seat whenever the mode leaves the interior, and a new room seats nobody |
| B2 | MED | The seated eye overrode the death camera's sink and tilt | FIXED: the seated eye is set straight after the body's, before the death's sink |
| B3 / C3 | MED | "The nearest free seat" was never free - two players sat in one chair, both drawn there | FIXED: `takenSeats` over the others' seated feet (`host.seatedPeers`, from `peersNear`'s new `st`); a full table says so |
| B5 | LOW | A swing while seated struck from the capsule's eye, not the seat's | FIXED: the swing button and a swing key stand you up first. RECORDED: a readied spell fires on its press, before the release's stand (the cast law's order, `activateGate.js`) |
| B6 | LOW | Seats stood round the WORLD box, which bulges past a table turned off the square | FIXED: the context keeps the table's own box and matrix; the seats stand round it |
| D1 | MED | The head's look, solved after the arms, carried the hands 4 cm off their marks (the biped's clavicles hang from its neck) | FIXED: no look - a seat square to its side faces the table |
| D2 | MED | The drop and the marks were metres while the body scales with its race: a tall body sat high, knees under its hips | FIXED: the drop and the ankle follow the height, the feet's ahead and side and the hands' side the build. RECORDED: a body the table does not scale with reaches as far as its arms go (build 0.9, height 1.1: wrists 5 cm short, 4 cm over) |
| D3 / E3 | MED | Seats turned to the table's middle put one hand 0.11-0.39 m off the edge, in the air; the solve test posed one square seat with no table | FIXED: seats sit square to their side, SEAT_OUT 0.35 m (now seatPose's, the hands' one home) with the hands 0.1 m past the edge; the test solves EVERY seat of `cardTableSeats`' own table and asserts both wrists inside its box |
| D5 | LOW | A climb still easing out held a body that had sat down | FIXED: the seat wins the climb's slot |
| D6 | LOW | A peer's sit was drawn as a slide to the chair (the seat on at once, the feet easing) | FIXED: `lerpPose` takes a sit or a stand whole |
| C5 | LOW | The sprite lanes' strides and a peer's footsteps read `peerMoving` without the seat | FIXED: `peerMoving` itself says a sitter is no walker - one law |
| A1 | MED | A big blind all-in for less than the small blind left the small blind owing the full blind against nobody; the seat clock folded a covered hand | FIXED: `owedBy` - with nobody else able to act, only what a live seat bet |
| A2 | LOW-MED | `newHand` threw on a sparse, a null or a non-array table, and took twice-named and nameless seats | FIXED: refused, never thrown on |
| A3 | LOW | Stacks past 2^53 lost chips | FIXED: `chips` - a safe integer |
| A4 | LOW | One shuffle assertion could not tell 0..i from 0..i-1 (the next one can) | FIXED: its comment says so |
| E1 | HIGH | Nothing pinned that standing up stands you up (the slot emptied, the eye home) | FIXED: pinned, and mutants on both lines |
| E2 | HIGH | Nothing pinned that the rig is handed the seat, or the race | FIXED: `seatRequestFor` is pure and driven; fpArm's line pinned |
| E4 | MED | First-person statements and "CARDS2b is open" left current after CARDS2b | FIXED: the view is first person again (S1); section 11's superseded numbers marked |
| E5 | MED | The peer seat cache's facing and top unpinned | FIXED: pinned both ways |
| E6, E7, E8 | LOW | `sidePots`' empty-layer branch, `seatFloorOk`'s boundary, a vacuous ordering pin | FIXED |
| E10 | LOW | The sprite lane standing at its seat flagged in the bible only | FIXED: FLAGGED in `player/seatPose.js`; the open flags are 12 |
| C4 | LOW | Seated, foes and the collider still stand at the capsule, 0.5-2 m from the drawn seat | RECORDED: the first blow stands you up |
| B4 | LOW | A duel's sparring blows never reach the hurt listener, so they do not stand you up | RECORDED (section 12 now says "a hit that reaches the health door") |
| A-note | - | Section 5's "a seat whose player leaves folds" needs a fold out of turn | RECORDED for CARDS5 |

## What held

Lane A's 140k hands: chips conserved, every hand ended, every street's cards and burns right, no folded or all-in seat
ever to act, every legal action accepted and every illegal one refused, the input never touched, no hole card leaked,
the payouts matched an independent layer-by-layer reference on 75k showdowns (2.2k splits), and the evaluator matched
an independent one on 200k pairs. `rollDice` is draw-for-draw the old one over 200k specs. Lane B: the probe, the
target's shape, the occlusion, the seat cache, the census's reading of BLOCKS.BSA and its metres. Lane C: the frame
of the sent seat in every room kind, no relay speed check outside the battle rooms, `st`'s bounds and its omission
law. Lane D: no NaN, no bone stretched, both knees forward, the elbows outside the torso, the body's drawn model the
exact inverse of the request's mapping, the peer's request and draw on one feet and yaw, no body drawn in first
person.

## The pins

`test/cards1_cardlaw.test.js` 15, `test/cards2_seat.test.js` 10, `test/cards2b_seated.test.js` 8.
`tools/mutants/cards1.json` 48 (47 dead, 1 equivalent as recorded - a folded seat's bet, which can never top the live
ones), `cards2.json` 54, `cards2b.json` 39 - all dead. The foreign records the fixes moved were re-aimed by content:
`climb5.json` (`peerMoving`, back to main's body-camera record), `invisnet.json` (`peersNear`'s row), `worldhover.json`
(`setMode`), `cards1.json`'s `CD-bb-no-option`.
