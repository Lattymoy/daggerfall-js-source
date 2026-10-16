# AUDIT BAY - SHIPS OF THE BAY audited: the packets' life, a ship handed on, everything of a ship fading with her

Mac: *"Audit this. Must be perfect"* - SHIPS OF THE BAY (ea3a7361e, `03-World/Naval-Combat.md` SHIPS OF THE BAY: the
names, a friendly ship's green bar, her course on her tag, a fade out of the world, packets between the ports). Every
finding was reproduced on the real modules first - the real host through real frames over Come Sail Away's real pool
(`test/navalSea.mjs`), two and three of them in a room (`test/navalRoom.mjs`), the renderer and the shadow pass over a
recording GL, world.js's own code lifted and run - pinned by tests that fail on the record's own code (ea3a7361e), and
mutation-proven. The record's own re-judge, left half done, is finished here (below).

| | Finding | What it was | Done |
|---|---|---|---|
| A1 | a course an origin's move off | the floating origin moved, a ship's `course` did not: a packet steered for (300, 300) an origin's shift of (100, 0, 50) away until her lane spoke again, a relief for good | the course and a packet's legs move with the world |
| A2 | a struck packet kept for ever | the lane kept her (`linerBusy` read "not afloat" as busy) and the director counted her its own: still in the sea two minutes after the player sailed 5 km off | struck, she is spent and her lane's no more: the sea's own law lets her hulk go |
| A3 | a packet taken over lost her lane | her stander gone, the heir held her with no lane, no course, no errand - a cruise of her own | every ship in my sea known by her seeds |
| A4 | a ship handed on blinked | a raider beside b, a sailing off: on b's screen 1.00 to 0.08, gone, stood anew 0.12 to 0.87 - eight seconds out and in; a packet the same | held ORPHAN_S for a player near her, who takes her over where she lies |
| A5 | one launcher stood every packet | the share's elected launcher alone stood any: a packet 900 m from b and 2 km from a was stood by neither | every player stands their own; twins are the claim rule's |
| A6 | steered for her place on the clock | a packet lagging her place round a headland made straight for it: 49 of 100 points of her line over the land | along her own leg from where she is (`pursue`) |
| A7 | the first free berth | a packet lying at the port took berth 0 and the day's own ship there was never stood; b's packet berthed on a's moored ship | the LAST open berth; a berth another's ship lies at is none |
| A8 | a crown's packet named by the reader's waters | one packet, two names - "Lysandus's Wrath" of Daggerfall, "Barenziah's Wrath" of Wayrest (12 of 12 renamed) | named by her home port's region |
| A9 | another's packet read nothing | a peer's copy carried no lane; a peer's ship at a berth no errand | her lane along her own leg (A22); moored at a berth by where she lies |
| A10 | the card's state ran to two lines | the aside card's "Friendly - patrolling off Copperhold Orchard" stood it 64 to 76 px | one line, cut at the card's edge |
| A11 | "bound out to sea" while answering the guns | a crown's ship sailing for gunfire read her old voyage | nothing said - a relief still comes to your aid |
| A12 | a fading ship cast a whole shadow | the depth maps drew her whole to the last frame, sun and lanterns | her shadow cut as her hull is |
| A13 | her lanterns lit at full | 8 of 8 lights at full colour with a tenth of her in the world; her far lamps too | her lights go with her lantern flats |
| A14 | her fire, smoke, wake and colours at full | a twentieth of her in the world flew her flag, laid her foam, burned and smoked | they go with her flats |
| A15 | four pins the fade weakened | a ship let go stands in the sea while she fades; pins asking only that she was in the sea kept passing (SEAPEACE-the-prize-let-go-before-the-grapple survived) | each asks that she is not fading |
| A16 | nothing said leaving an unnamed harbour | a packet departing a harbour with no town's name read nothing | her lane's next port |
| A17 | the voyage's turn swapped ships in sight | at her voyage's end she faded out at her berth in the port's sight and another ship was stood at the roadstead | a ship on the water sails the next voyage as herself (her seeds) |
| A18 | a sunk packet stood again | a player who never saw her go stood her afresh where she went down | spent by every player who sees it, and said in the word |
| A19 | the near list let a packet go beside the player | only packets whose PLACE on the clock lay within 1,600 m were handed over: one fallen that far behind (1 km in 20 minutes) was let go at the player's side | every packet of the lanes about the player |
| A20 | the port's own faded out before the one in port | the player who rolled the port sailed past HARBOUR_LEAVE; their moored ships faded from their berths for the one still there, the roll long done | taken over where they lie |
| A21 | the lookout sounded for ever | a way gone NaN - SHIPLIFE-AI-no-hold's mutant - stepped `courseClear`'s soundings without end: test/systems/naval/shiplife.test.js hung for good, on 168bf2587 alike | a reach or a start no number is no clear course |
| A22 | a packet behind her clock came about short of her port | the clock's leg turned under her and she sailed home from mid-lane; and (found by the audit's own mutants) a peer's copy kept the leg she was first known on for good - taken over, she sailed it again from wherever she was, or went for the nearest harbour's berth | the leg she sails is hers till she has sailed it - mine, and a peer's followed by where she lies; taken over, her errand her lane's |

## The packets (A2, A3, A5-A8, A17-A19, A22)

**Reproduced first** (`test/systems/naval/auditbay_lanes.test.js`, the real host). A packet lagging round a headland steered for her
place on the clock up its far side: 49 of 100 points of the line from her to it over the land (A6). Struck, she stayed
the lane's - `linerBusy` read "not afloat" as busy and the director's density counted her its own - two minutes and 5
km on (A2). At her voyage's turn, moored at her home port, she faded out at her berth and another was stood at the
roadstead in the same port's sight (A17). And measured over a long straight leg: a packet makes 31-66% of her best way
by her heading in a wind of 1 (the game's runs 1 to 2, a tenth of it in fog), her schedule LANE_CRUISE's 70% - she
falls behind her place, 1 km in 20 minutes: the near list dropped her beside the player (A19), and the clock's leg
turned under her and she came about for home short of her port (A22).

**The fix.** `systems/naval/seaLanes.js`: a packet carries her `leg` - the leg under her, or lying at a port the one
that brought her there - for the place ahead she was steered at (`LANE_LEAD_S`, gone), and `seeds`, her place's last
LANE_LINEAGE (24) voyages', hers first; `region`, her home port's. `pursue(leg, x, z, ahead)`: the point `ahead` on
along the leg from the point of it nearest her, any segment, a run carried round a corner, clamped at the end, and the
leg's remainder from there (`left`). `scenes/naval/navalHost.js liners`: each ship in my sea known by her seeds - mine
steered, a peer's read on her tag; every player's own packets at the shared sea's traffic; the last open berth; a
packet stood named by her lane's region; the stand barred by her voyage's ship anywhere in my sea or her place's of an
earlier voyage afloat; let go past LINER_DROP_M only - out of the list (her lineage past) she is the sea's as any ship
(moored, a dwell of her own; lying off a port, an errand of her own). `steerLiner`: her OWN leg (`way`, to `dest`)
pursued LINER_LOOKAHEAD_M (300 m) on from where she is; out of any berth through its mouth first; within LINER_PORT_M
(500 m) of her leg's end by its own remainder (a leg come back by its end across a headland is no arrival) at her port
- its last open berth, moored till her clock sails her on (come early she waits), else lying off her leg's end.
`moveOn`, every packet's - mine and a peer's copy alike - at each list: at her own leg's port (`madePort`: mine by her
errand there - into a berth of it, moored at one however far it lies from her leg's end, lying off it though a fight
carried her from it; another's at a berth of it, her errand never riding the word; any by her leg's remainder within
LINER_PORT_M) with her clock bound elsewhere, she takes up her clock's leg at once - never while she fights.
`firstWay`: a packet I did not stand is first known on her clock's leg - or, met under way between its ports heading
back along it, on the leg before it (behind her clock by a leg, for the port it left); fighting, at a berth or off her
clock's port, where she heads says nothing (off the port it left, heading for it, she has made it: moveOn sails her
on). Taken over (`adopt`) or met in her lane again, a ship of mine keeps her lane's errand alone (`laneErrand`: lying
at a berth or on her way out of a harbour, kept; SHIP-LIFE's own, never). Struck or going down she is spent, by every
player who sees it, said in the word (`l`, `systems/naval/navalWire.js` NAVAL_WIRE_SPENT: 8, read whole or the word
refused), and her lane's no more. `scenes/world.js laneShips`: every packet of every lane with a port within
LANE_PATH_PX / 2 + LANE_NEAR_PX (34 pixels) of the player - a ship on a way within reach has one there - each with her
seeds, her leg in the scene, her ports by key and name, her region; the clock's second no longer handed over (her
phase sails her).

**Found by the audit's own mutants.** The tag first read a peer's packet by her clock - her stander's own leg rides no
word - and kept her own leg (`way`, `dest`) from the first tag as mine did, but never moved it on: a copy known on her
leg out, met again sailing home, was taken over and turned about for the port behind her. And `adopt` drew her
SHIP-LIFE's errand where she lay: a merchantman mid-lane within VOYAGE_REACH of a harbour was sent for its nearest
free berth - the port she had left, out through its mouth again. Both pinned (`test/systems/naval/auditbay_lanes.test.js`,
"another's packet is followed along her own leg", "at her port by her errand").

**Said, not fixed.** The schedule's LANE_CRUISE stays 70% - its speed is every client's shared clock, and a packet
behind it now finishes her leg and sails on at once; one ahead waits at her port. A peer's packet is followed by where
she lies and heads, not by her stander's own leg (no room on the word's ship): first known off a port while a leg
behind her clock - leaving it for the port her clock left, a window of minutes once in many voyages - she reads her
clock's port till she has sailed on.

## A ship handed on (A4, A20)

**Reproduced first** (`test/navalRoom.mjs`). A raider beside b, her stander a sailing off past RAIDER_DROP_M: a
retired her (in a's word while she faded, whole on b's screen), dropped her, b's copy let go - faded out, gone - and
the plan stood her in b's sea anew: 1.00 to 0.08, gone, 0.12 to 0.87 in eight seconds. A packet the same past
LINER_DROP_M. The port's own: a rolled the port and sailed past HARBOUR_LEAVE; b, in port, had rolled it already (a
had been the roller) and saw its moored ships fade out of their berths.

**The fix.** A ship of mine let go by my range while a player stands within its drop range of her (`peerNear`) is HELD
ORPHAN_S - in my word, steered, never fading - for that player's claim; a peer's packet or raider within my drop range
whose stander's feet are past theirs, or whom their word has let go, sailing about no fight (a raider no peer's chase
holds and my life has not spent), is ADOPTED where she lies, one past her handover count, and the stander's copy
yields into it - whole on both screens throughout, a packet on the leg her copy was followed along (A22), her errand
her lane's; no claim in ORPHAN_S, she fades. The port's own let go by the one sailing off are taken over by the player
who rolls the port now. Pinned on both screens, every tick.

## The words (A9-A11, A16)

`boundOf`: afloat, answering the guns, nothing (a relief comes to your aid); another's ship lying still at a berth of
a harbour I know is moored at it (`berthOf`); departing a harbour with no name, her lane's words; a packet - mine or
another's, by her own leg and its port (A22) - lying off her port within LINER_PORT_M of her leg's end, else bound for
it; a port with no name says nothing. `ui/naval/navalHud.js`: the card's state on one line, cut at its edge (`white-space:
nowrap; text-overflow: ellipsis`) - the aside card's 64 px held.

## Everything of her fading with her (A12-A14)

**Reproduced first** (`test/scenes/naval/auditbay_render.test.js`). The pool's light list lit 8 of 8 lanterns at full with a tenth
of her in the world; the host's far lamps drew hers; a twentieth of her flew her flag, laid her wake and splashes
(world.js's particle lists), burned (her flame flats), raised embers, smoke and her founder, and lit her burning glow;
the depth maps drew her whole.

**The fix.** `render/shadowPass.js`: DEPTH_CUT_FS - the lit pass's own `dissolveCut` over the map's texels (the filter
reads the kept share as the shadow's strength); `recordMesh`'s `cut` (the renderer's `1 - dissolve`, drawn and
off-screen records alike), never a cache's; the replay draws a cut record with the cutting program, its cut uploaded
once a record a replay - a whole one's the plain depth program, nothing uploaded, so the frame's cost is LA-COST1's.
Under FADE_FLATS: `scenes/comeSailAway/comeSailAwayPool.js lights` lists none of hers; `navalHost.js lampsInto` draws no lamp of
hers; `poseShip` stands her flames down (`scenes/naval/navalFlames.js show`, a flame's batch left out of the flats' axis),
raises no embers, smoke or founder; `lights` lights no glow of hers; `world.js csaParticleLists` draws none of her
particles.

## The pins the fade weakened (A15)

A ship let go now stands in the sea while she fades; four pins asked only that a ship was in the sea - `seapeace` (the
prize her taker comes for), `auditnav2_captains` F27 (the quarry and her pursuer) and F23 (two struck in sight),
`shipclaim` (a prize left by a refused claim). Each asks now that she is not fading. SEAPEACE-the-prize-let-go-before-
the-grapple, which survived the record's re-judge, dies (below).

## The lookout (A21)

The re-judge hung on SHIPLIFE-AI-no-hold (a moored ship never held): her way went NaN, `navalAI.js courseClear`'s
reach with it, and its soundings stepped for ever - the shiplife suite hung for good, on 168bf2587 alike (five
minutes, killed). A reach or a start that is no number, or no step, is no clear course now: the soundings stop, and
the mutant dies (four failing). Pinned in a worker of its own on a clock, so a regression fails rather than hangs the
suite.

## The record's re-judge, finished

SHIPS OF THE BAY judged the first 491 of its 1,014 records and left the rest for after it. All 1,014, on ea3a7361e's
own code: 1,004 dead, two equivalent as recorded, six surviving on 168bf2587 alike (A0928-R5-flat-scale-walks-again,
NAV-B-her-colours-struck, NAV-C-the-tactic-ignored, NAV1-the-tacks-carry-dropped, NAV1-no-pay-off, NAV1-never-warped -
none of that change's), SEAPEACE-the-prize-let-go-before-the-grapple surviving (A15), and SHIPLIFE-AI-no-hold hung
(A21).

## The pins and the mutants

`test/systems/naval/auditbay_lanes.test.js` (25) and `test/scenes/naval/auditbay_render.test.js` (4), each red on ea3a7361e (A21's by its
worker's clock: the soundings never stopped). `tools/mutants/auditbay.json` (121): 119 dead, two equivalent as
recorded (the lying-off's point - her own leg's end or her clock's, one point whenever she lies off it; the host's
bound on the spent it says - the word's record keeps the last NAVAL_WIRE_SPENT itself). Its first run's ten survivors:
the two equivalents; the finding above (a peer's copy's leg); and seven a pin each made or mended - a packet fighting
kept (her record's list missed its pin), at her port by her errand (moored at a berth beside her leg; lying off it, a
fight having carried her from it), moored at the port she left with her own port's harbour known, a word of her spent
alone, a frame's sight of her struck between the feed's reads, a whole record's shadow uploading nothing. The second
run's one survivor named a check `moveOn` already makes (off the port her clock left, heading for it), struck.

PINS MOVED, each by content: `sealanes` (her leg, her seeds and her ports by key for the place ahead and the ports'
names; the stand's course along her leg; the steering along her own leg; out of the list she is the sea's; the feed's
every packet), `shipstance` (a packet's tag in the host's own form - her ports by key, her own leg and its port; lying
off her port by her leg's end), `shipwatch` (the far lamps after she has come in whole), `navaudit_guns` and
`navaudit_presentation` (a ship stood whole before her smoke is asked), `el2_shadows` (the mesh record's cut),
`nav_g_online` (the door's `spent`), `el1_enhancedlighting` EL1 and `farclip1` FAR-CLIP1 (the lane's compiles, 22 on
its install: the shadow pass's cutting program among them), and A15's four. Records re-aimed by content:
`audit0928_render.json` AUDIT0928-R1-shadow-pass-blind-to-it, `el2.json` renderer-wire-casts, `nav_r.json`
MERGE-OW6-the-hold-unpassed-to-the-plan, `navaudit_online.json` NAV1O-wire-self-alone-unsaid,
NAV1O-wire-traffic-unread and NAV1O-traffic-unsaid-host, `perfextb.json`
PERF-EXT11-9-the-replay-resets-its-lasts-once-a-replay-not-once-a-record, `sealanes.json` 28 of its 71 (the place
ahead gone: CLOCK-ahead-here is CLOCK-leg-home-unreversed now, the clock's home leg reversed), `shadowreach.json`
record-is-a-draw, `shipfade.json` FADE-raider-yielded-fades, FADE-raider-drops-at-once, FADE-raider-back-unread and
POOL-flats-kept, `shiplife.json` SHIPLIFE-HOST-every-client-rolls and SHIPLIFE-HOST-adopted-errandless,
`shipstance.json` TAGS-bound-while-fighting, TAGS-bound-though-struck, TAGS-leaving-unsaid, TAGS-dwell-unsaid and
TAGS-liner-unsaid, `shipwatch.json` H-dark-lamps.

Judged again - every record on navalHost.js, seaLanes.js, navalWire.js, navalAI.js, shadowPass.js,
comeSailAwayPool.js, navalFlames.js and navalHud.js, the records whose suites this changed, and world.js's and
renderer.js's near these: 1,563 records in 92 lists, on this audit's own code - 1,547 dead, nine equivalent as
recorded, and seven that survive on 168bf2587 alike, none of this change's: SHIPS OF THE BAY's six
(A0928-R5-flat-scale-walks-again, NAV-B-her-colours-struck, NAV-C-the-tactic-ignored, NAV1-the-tacks-carry-dropped,
NAV1-no-pay-off, NAV1-never-warped) and NAV1G-no-bear-free, whose list (`navaudit_guns.json`, its suite a moved pin's
here) no re-judge of these arcs had judged. Not seen in a browser.
