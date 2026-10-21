# FIELD BUGS 2026-10-20f - the Elite Breach, from a player who ran it, read to its roots

ilovemybonk's word on the Elite Breach in the Discord's #general (2026-10-20), answering Lattymoy's "Did you enjoy the
content?", handed over as two screenshots with "Elite Breach feedback". Three reports and a remark. Each was traced on the
real producers: the laws that lay the halls (`net/eliteGates/egLaw.js`), the relay's director (`net/eliteGates/egBrain.js`) run
as the relay runs it, and the client's own modules. Read on the code as it stands at main's `ccfb3c135`. The calls the reports
left open are taken here, under the owner's standing word on these threads (Mac, 2026-10-19: "Stop with the decisions for
me"); each section says which it took and why. DFU has no Spire, no Elite Breach, no Orrery, no fair trail and no relay, so
no DFU member moves and no ledger row but ELITE-GATES' own. The pins are `fb1020f_*`, the mutants `tools/mutants/fb1020f_*.json`.
The record was 20d on its branch (its pins `fb1020d_*`), renumbered past LONE-HERALD's 20d and OFFERING-RAY's 20e at the
merge of main.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "the clocks that do the time in the orrery task halls do not have models showing you where to interact with them. You have to search around an empty area for the 'rewind back, move forward' options while imps hit you with a constant nova effect that blinds your vision" | An Athenaeum's six stones were gold discs on the floor. Each was turned through two activation boxes 0.9 m to either side of the disc and a metre up, with nothing drawn there. The lock's pressure (a Harrier every 15 s until the Orrery is true) filled the legion while the player searched the air | ORRERY-STONES |
| 2 | "There were a few instances with the 'cross.' Objectives where it seemed the game doesnt register i made it to the end. (If it helps, i get a 'no footing' damage number when i hit enemies while i cant exit the hall)" | The relay's fair trail read a member's silence as blindness. A client says no pose while nothing about it changes, so a member who waited out a span's timed pieces without moving the mouse was "unseen" there. A crossing more than 30% unseen opens no door, and nothing said so | FAIR-STILL, DOOR-WORD |
| 3 | "it says at the end it only took 31k damage" when "ive dumped a literal million damage into a redoubt 16 boss"; "i cant tell how much and when my spells do as much damage as they do" | The hit numbers said each blow's CLAIM. The room landed what the member's purse, the lord's weight and its health allowed, about 195 a second at level 60. Circle 16's lord holds about 32k for a solo level-60 member, so the chart's 31k was the lord's whole | LANDED-WORD |
| - | "It got very grindy at the end, which is understandable" | The depth law's own (section 18), as designed | not a defect |

## ORRERY-STONES: an Athenaeum's stones stand, and their levers are the handles (1)

`src/scenes/eliteGates/egOrrery.js` (new: the stones on this screen), `src/world/superDungeon/sdHall.js` (`buildStoneModel`, one
stone alone - the hall's `stoneInto`), `src/scenes/superDungeon/sdHall.js` (`sdHandWay`, the hands' short way exported),
`src/scenes/eliteGates/egSpan.js` (the stand, the frame, the targets, the clear), `src/scenes/eliteGates/egFight.js` (the words
over a stone).

FOUND. An Athenaeum's lock is the Hour's Orrery (`11-Multiplayer/Elite-Gates.md` section 8.4). The relay raises six `stone`
objects on its court (`egBrain.js`, the Athenaeum's arm of the fight's stand, `r: 1`). The client drew each as a gold disc a
metre across on the floor (`egFight.js` drawGround), and its name and hour over it (ORRERY-SIGHT,
`Field-Bugs-2026-10-17e.md`). It offered the activation ray two boxes a stone, 0.7 m on a side, 0.9 m to either side of the
disc's middle along the hall's x and a metre over its floor (ORRERY-HEIGHT, `Field-Bugs-2026-10-17c.md`). Nothing was drawn
at either box. ORRERY-SIGHT's own record left it: "the stones are still drawn as discs. A stone with its dial and hand ...
a question for the hall's look". So a player found a turn only by sweeping the crosshair through empty air beside a disc
until the plaque read "Turn it forward an hour".

While the lock stands untrue, `ceil(n/4)` Harriers rise every 15 s (`EG_LOCK_EVERY_MS`). For a company of one, that is a
Harrier every 15 s up to the legion's cap: four in the first circles, seven by circle 16 (`egLegionCapOf`). Each Harrier
bites from a disc about the member it runs at. A minute or two of searching filled the court with them. Each bite is a
telegraph filling under the player, DFU's red damage flash, and blood on the lens past a tenth of the player's health
(`ui/bloodScreen.js`). That is the "constant nova effect". It is the hall's pressure as designed, and the search for the
handles is what let it pile up.

The Spire's stones stand exactly where the Hour's do. The law lays them on a ring of 11 m about the court's heart at
30, 90, 150, 210, 270 and 330 degrees (`egLaw.js`: `polar(X, zc, 1100, deg)`), and the Hour's stand at `SD_STONE_RING_R` 11
on `SD_STONE_BEARINGS`, the same six. So the Spire's stone j faces its court's heart as the Hour's stone j faces its dial's.

FIXED. Each of an Athenaeum's stones stands as the Hour's own stone j: plinth, shaft, the kingdom's relief, the dial and its
notch, the two cast levers, the brass cap, the bezel, the hand and the crown gear (`world/superDungeon/sdHall.js`'s builders,
one copy). It is carried from the Hour's place to its spot by a translation alone (`egStoneShift`), on its spot's own floor
(the law's centimetres, ORRERY-HEIGHT's law), and is not turned. Its two levers ARE the handles: each activation box is the
Hour's `handleBox` carried the same way. The right lever as you face the stone turns it forward and the left turns it back,
as in the Hour. The keys, the plaque's words and the press are unchanged. Its hand and crown gear show the room's word
(`orr`): the relay's start before the trial, the true hours once the hall is behind the company (its door opens on a true
Orrery alone), and going to a turn's hour the short way at the Hour's pace (`SD_HAND_RATE`). The stone is solid, as the
Hour's are (AUDIT SD II): its slab, cap and levers stand in the collider. The words over a stone (ORRERY-SIGHT) stand over its
crown gear, `EG_STONE_TOP_M`, never across its sign. Every part goes through the span's own `place`, in the circle's batch
and the band's dress, so it is culled and freed with the span. The Hour's hall pictures its faces wear are uploaded once a
renderer (`ensureSdHallArt`, as the Remnant does).

The gold disc stays under each stone, so the stone still reads as an errand on the floor. The Harriers' pressure is not
changed: it is the lock's design, and the search it punished is gone.

The four hosts: `scenes/world.js`, `scenes/worldModes.js` and `scenes/dungeonContext.js` read `egSpan.targets()`, `press` and
`hoverName` as before, so the levers reach the crosshair through them with no line changed. `scenes/exterior.js` is
offline, with no breach (section 28).

PINS. `test/scenes/eliteGates/fb1020f_orrerystones.test.js` (4):
- THE STONES, under THE ASCENT's court and the 0 court of the laws before it: each spot stands the Hour's stone j, all four
  parts drawn, its foot on its spot and its floor, carried and never turned, facing the court's heart;
- THE LEVERS: each handle's box holds its stone's drawn lever whole, forward on the right as one faces it, at the lever's
  height over its own floor. The real ray (`pickActivatableHit`) from a body before the stone, over the circle's collider and
  the stones' solids, finds it from within the room's reach;
- SOLID: a body's way from the court's heart meets each slab at its face;
- THE HANDS: at the start before the trial, at a word's hours in it (0.3 hours a tenth of a second, the short way), and at
  the truth once the hall is behind, each crown gear with its hand;
- THE WORDS: in a woken Athenaeum on the director's own breach, each stone's words stand over its crown and its sign.

Mutants `tools/mutants/fb1020f_orrerystones.json` (9, all dead).

PINS MOVED.
- `egz_camera_budget.test.js`: the stones add four GL draws to a circle that lays an Athenaeum, two batched kinds of two
  records each (the stones and bezels; the hands and crown gears that turn). Over 60 circles the frame's mean, worst and
  worst occluding go from 32.9, 39 and 51 to 33.8, 43 and 55, under the Hour's 82.
- `eglook_spans.test.js`: the stones wear the Hour's hall pictures (its atlas and the hands' glow), and only in a circle
  that lays an Athenaeum. Their brass is the band's. The rule's purpose, that span pieces no longer wear the Steps' clock
  faces, stands: the stones are the Hour's Orrery itself.
- `egswap_client.test.js`: those pictures go up once a session with the first circle that lays an Athenaeum, as a band's
  Beats' do (`ensureSdHallArt`, counted off the producer).

`fb1017c_orreryheight.test.js`'s handles are the levers now. Each is found from a body 1.55 m before its stone's
face, over the circle's collider and the stones' solids, at the lever's height over its own floor. Before, they were found
from the stone's middle, which is inside the stone now. Its three mutants (`fb1017c.json`) were re-aimed by content at
`egStoneShift`, the one place the floor is read now. All dead.

Seen in the Spire lab (`spire.html`, seed 1, circle 11, its third hall): the six stones on the court, each with its dial,
hand, crown gear and levers.

## FAIR-STILL: a member standing still is seen standing (2)

`src/net/eliteGates/egFair.js` (`egStillGap`, egFairPose).

FOUND. "Cross." is a span's objective (`egLaw.js` EG_OBJECTIVES). Only the relay judges arrival: the first member at the door
(`egAtDoor`, within 3 m of the end plate's middle, on its floor) whose FAIR TRAIL holds opens it (`egBrain.js` doorOpener,
fairOf). The fair trail is section 21's anti-cheat (`egFair.js`), and one of its laws is BLINDNESS: a gap over 0.4 s between
two of a member's poses (`EG_BLIND_MS`) judges nothing, and a crossing more than 30% blind (`EG_FAIR_BLIND_MAX`) opens no
door. But a client says a pose only when something about it changes: a step, a turn of the head, a draw. Otherwise it sends
one every `HEARTBEAT_MS`, 20 s (`net/online.js` sendPose, `wire.js` poseChanged). So silence is the protocol's own word for
"unchanged". The census already reads it that way (`server/src/index.js` _egTrails, AUDIT EG V L4-1). The fair trail read it
as BLIND.

A span is timed pieces: Beats that come and go, Drifts that swing, Crumbles that fall and return. A player waits for them. A
player who waited without moving the mouse was unseen for every second of it. Measured on the director's own breach
(`egBreachNew`, `egEnter`, `egStep`, `egPoseIn`): a member walked each span of the build's law along its main way, 44 halls in
twelve seeds' circles 1-4, at ten poses a second. It stood still without a pose before each leg the timed solver crosses on
timed pieces (`egRouteSolved`'s pairs), for the given time a pair. Then it stood posing at the door.

| still, a pair | doors that never opened (member at the door) | blind share, median |
|---|---|---|
| 1 s | 24 of 44 | 0.29 |
| 1.5 s | 35 of 44 | 0.38 |
| 2 s | 42 of 44 | 0.45 |

A blind share only falls as more of the crossing is seen. A player who walked about long enough on the plate saw the door open
at last, and one who stood still at it never did. That is "a few instances" where "it seemed the game doesn't register I made
it to the end".

"No footing" is TURNED-BLOW's word (`Field-Bugs-2026-10-18f.md`), shown when a blow is struck from traversal ground: steps,
bridges, stairs and rooms, everything but the islands, the arrival plate and the end plate (`egWalkGraph.js` egFightView).
On a span that is 70-93% of the way, and every step before the end plate, the door bridge among them. The word was right
where it showed. It says the player was on the way, near the end, not on the plate. Nothing about it changes here.

Two more findings were measured and left as they are:
- The door's reach is 3 m on a plate of 5 m, and the door bridge lands on the plate's rim, so a member on the outer 2 m is on
  the plate and not at the door. The portico stands at the plate's heart, inside the reach. The reach also times a crossing
  for the boards (`egFairCross`), so it is not widened here.
- In each of the 44 spans the way passes 10-14 m from the end plate, at its height, with 60-90 m still to go - THE BROKEN
  WAY's loop (spec law 10). It is the law's design, and the door is in view but not reached.

FIXED. A gap that begins on held ground (the trail's last support, stamped at the pose before it) and ends on held ground
within `EG_FAIR_SNAP_M` (2.5 m) of where it began is a member standing still (`egStillGap`). It is judged as a stretch (its
speed, its air) and is never blind. EG_FAIR_SNAP_M is the game's own snap, and more than the first step a client says as it
moves off after a wait (one frame of THE FAST BUILD's run). A gap that went further, or began or ended in the air, stays
blind: what a body did unseen is still unknown, and the law's purpose stands. With the fix, the same walk, standing still
1, 1.5 and 2 s a pair before each timed piece, opens all 44 doors, its blind share 0. The relay's law changed, so world237
(`wire.js` RELAY_VERSION).

PINS. `test/net/eliteGates/fb1020f_fairstill.test.js` (3):
- THE LAW: standing still three seconds is seen and breaks nothing; the same gap ending past the snap, or begun in the air,
  is blind; `egStillGap` at the snap's edge;
- THE CROSSING: each span of three seeds' circles 1-4, walked as above with a 2 s wait a pair, opens its door and says no
  word;
- DOOR-WORD's, below.

The law's pins also hold a gap begun at a jump's top (blind, though the body stood on the plate the pose before) and the
snap's edge.

PIN MOVED. `egint_relay.test.js` THE FAIR TRAIL: its blind gap was a gap from the arrival plate to an island and then 1.9 s
standing on the island. The second gap is a member standing still now, so the pin's blind crossing is the first gap made
long. It still proves that a crossing more than 30% blind opens no door.

## DOOR-WORD: a member the door will not take is told why (2)

`src/net/eliteGates/egBrain.js` (`doorWord`; the span's and the Brink's trial arm, the Deepway's way down, the closing),
`src/net/eliteGates/egFair.js` (`EG_FAIR_WORDS`), `src/net/wire.js` (`efair`, `EG_FAIR_WIRE_WORDS`),
`src/scenes/eliteGates/egClient.js` (`EG_FAIR_TEXT`, the door's line).

FOUND. A trail the door refuses was refused in silence: the door in the trial (doorOpener), the step through it in the
closing (`egDown`), and every pose-gated credit. A refused `down` even had the client say "You wait at the door for your
company." every second. The objective kept saying *Cross.*

FIXED. A member standing at the door, in the hall it was heard arriving in, on a trail the door refuses is told why, once a
hall, to it alone: `{k:'efair', w}`. `w` is the break's own reason (`speed`, `air`, `void`) when the trail broke since its
last island, else `blind`. This happens in the trial of a span or a Brink, at a Deepway's way down, and in any hall's
closing. The client says it in the middle of the screen and in the chat (`EG_FAIR_TEXT`). While the door refuses it, the
closing's door line is that word, never "You wait at the door". A break clears on the last island stood on, so the words
for a break say to go back to it and cross again. A crossing seen too little is seen whole as the member stands at the door
(FAIR-STILL), so the blind word says to stay at the door. `efair` rides world237 with LANDED-WORD. A page before it drops
the frame (`validEgOut`'s default).

PINS. `fb1020f_fairstill.test.js` DOOR-WORD (1): the wire's words are the law's, all four carried and no other; a teleport
onto the door told `speed` once, to it alone; a crossing seen too little told `blind`; a refused `down` in the closing told
once a hall; a fair crossing told nothing; the client says each word, and its door line is the reason while the door
refuses it.

Mutants `tools/mutants/fb1020f_fairstill.json` (11, FAIR-STILL's and DOOR-WORD's together, all dead).

The four words are routed through the text core (`eg.fair.*`) and drafted in the thirteen whole languages, with the Spire
in each one's own word (`tools/l10nInSession.mjs`).

## LANDED-WORD: a blow's number is what it landed (3)

`src/net/eliteGates/egBrain.js` (egBlow's `eland`), `src/net/eliteGates/egLords.js` (egLordHit answers what the lord lost; the
seam returns it), `src/net/wire.js` (`eland`, `EG_LAND_RELAY_MIN`, `relaySupportsEgLand`), `src/net/online.js` (`egLandOk`),
`src/scenes/eliteGates/egClient.js` (the word to the fight), `src/scenes/eliteGates/egFight.js` (`landsWord`, `landed`, the
stand-ins' `landsByWord`), `src/ui/hitNumbers.js` (numberFor, showFollowUp), `src/systems/loot/lootPowers.js` and
`src/systems/martialPowers.js` (a follow-up's target).

FOUND. On a body the relay runs, the hit number was the striker's CLAIM: a swing's formula damage, or a spell's held to one
blow's cap (STAND-IN-WHOLE, `Field-Bugs-2026-10-19f.md`: 780 at level 60, 975 with the Vestiges' factor). The room lands what
the member's purse allows (the gate's hand and purse, `spendPurse`, `net/gate/gateBrain.js`): each blow at most `12 x ref`, out
of one bucket a member, `15 x ref` deep and refilling at `3 x ref` a second, where ref is `dpsRef(level)` grown by the
Vestiges' declared factor. The lord's own weight then applies (`egLordHitX`: the Unyielding decree, a stun, a Kynreeve's
front, a flyer out of a blade's reach), and the lord's health caps it. An area spell sends one claim for each body it
touches, every one shown at its cap, while the one bucket pays them all. A lord's health is `egTtkRef(c)` seconds of the
company's reference damage (`egLordsNew`), not of its spells.

Redoubt 16 follows circle 16's Court (hall 80). `egTtkRef(16)` is 180 x 1.07^15 = 496.6 s, so a solo member's lord holds
32,281 at level 60 and 30,791 at level 57. That is the most a chart can ever count, and the report's 31k is the lord's whole.
At level 60 the room lands at most about 195 a second (244 with the Vestiges' factor), so the fastest kill is about 166 s
however strong the spells. Pinned on the director's own breach at that Court (seed 2's, a level-60 member alone): 600 spells
of 3,000 claimed 1,800,000. The lord lost 30,176, and the member's damage and the chart's said 30,176. The screen had said
780 a spell, 468,000; before STAND-IN-WHOLE it said each claim whole.

The damage over time a spell leaves (BOSS-DOT) and an Arcane Echo's repeat were counted and never shown.

A side finding, on the way: a lord an errand holds at a threshold (`hpFloor`) takes back what falls past the line
(`egLordHit`), but the seam answered the purse's whole. While a lord was held, the recap, a Court's chart and the
earned share counted blows it never felt.

THE CALL. The duel already shows a blow's number at the referee's word (INT8, `scenes/world.js` duelHpIn: "the host says a
miss and the referee's word a hit"). A copy of the purse on the striker's machine would still be a guess: the Vestiges'
weight, the lord's and its held line are the room's. So the room says what landed.

FIXED.
- **The room's word.** Each blow the room judges tells its striker alone what it landed: `{k:'eland', i, d}`, whole points
  (`egBlow`). A blow it refuses (a second break's refusal, struck from traversal ground, a lord that will not admit it)
  lands 0 and says so.
- **The held line.** `egLordHit` answers what the lord lost, and the seam returns it. The word, the member's damage, the
  recap, the chart and the earned share count that.
- **The screen.** A breach's stand-ins are marked `landsByWord` while the relay says the word (`egFight.js`, each frame, from
  `online.egLandOk`). A hit on one shows no claim (`hitNumbers.js` numberFor). A miss and a turned blow ("No footing",
  "Warded") still say theirs at once. The room's word shows the number a moment later through HN1's seam
  (`reportPlayerAttack`), 0 included, and a lasting round's and an Echo's words show too. So the numbers a player sees add up
  to what the chart says.
- **A follow-up blow.** Open Hand's second, Many Endings' echo and the martial signatures' again (`systems/loot/lootPowers.js`,
  `systems/martialPowers.js`) raise their own number (ROSE-SEEN, `Field-Bugs-2026-10-15e.md`). On a body the relay runs,
  each is owed to the blow's one claim (`systems/playerDoor.js` oweFoe), and the room's word for that blow counts it. So on a
  body whose room says what lands it raises no claim of its own (`ui/hitNumbers.js` showFollowUp, its `target`).
- **An older relay.** A page facing a relay before world237 (`EG_LAND_RELAY_MIN`) keeps its claims, since it would hear no
  word. The relay goes first, or with the pages.

What it costs: a landed number loses the gold a critical or a backstab painted. The room says what landed, not how the
swing rolled. The gate's court, the Abyss's Remnant and the sea serpent still show claims. Their rooms are other relays'
laws, and none of them was reported. Each owes the same word, and it is written here as the next slice of this law.

PINS. `test/net/eliteGates/fb1020f_landedword.test.js` (5):
- THE REPORT: at circle 16's Court, a solo level-60 member claims over a million in spells. Every blow's word goes to it
  alone, and their sum is the lord's health lost, the member's damage and its chart's, under the lord's whole. A refused blow
  lands 0;
- THE HELD LINE: a lord ten points over its line loses ten, and the word and the member's damage say ten;
- THE SCREEN: no claim on a body whose room says what lands; a miss and a turned blow keep their words; the fight marks its
  stand-ins and shows each word as a number, 0 included; an older relay's claims return; the breach client hands the word to
  the fight and tells it whether its relay says it;
- THE WIRE: `eland` bounded to a body's number and whole points; world237 the first relay that says it, and the relay this
  tree builds says it, read off the welcome;
- THE FOLLOW-UP: Many Endings' echo on a breach body's stand-in raises nothing and still rides the blow's claim; on a foe of
  this machine's it rises as before.

Mutants `tools/mutants/fb1020f_landedword.json` (16, all dead).

PINS MOVED. `fb1018f_turnedblow.test.js`'s source pin reads the relay asking the strike law as `return land(0)`, and
`Field-Bugs-2026-10-18f.md`'s anchor quotes that line. `audit_martial.test.js`'s L1 N1 source pin reads the martial path's
follow-up handing its target. Re-aimed by content (7, all dead): `fb1015e_rose.json`'s six records on the follow-up's
lines, and `audit_martial.json`'s AUDIT-MARTIAL-L1N1-the-owed-number-unshown.

## The relay's version

`wire.js` RELAY_VERSION `world237` (`world236` on its branch, renumbered past LONE-HERALD's `world236`, FIELD BUGS 2026-10-20d, at the merge of main), its law's row in `test/net/relayversion.test.js`. Its bundle's files are unchanged
(nothing joined the graph), and every RELAY_VERSION pin was moved to it (42 files). NOT YET DEPLOYED.

Mutant records re-aimed by content at the lines as they now read (7, all dead): `egint.json`'s EGINT-repeat-hits-land,
`egz_legion.json`'s EGZ-the-strike-rule-gone, `egz_lords.json`'s EGZK-his-fall-untold, EGZK-the-threat-unweighed and
EGZK-the-director-never-joins, `egz_rules.json`'s EGZI-wire-toll-unread and `soc1.json`'s S38-version-not-bumped.
