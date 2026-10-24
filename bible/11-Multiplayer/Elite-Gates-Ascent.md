# The Ascent: the Elite Breach's halls as the academy's ways (LAW 9)

STATUS (2026-10-16): the plan of LAW 9. Mac, having seen the halls dressed: *"I just feel like we could do more to
utilizing climbing sections, different elevations. Something that isnt just a straight line from point A to point B.
Like, I want it to feel like you're actually traverversing corridors, different rooms, etc. This is just too simple"*.
Asked: climbing both on the route and off it (*"Both"*), and inside PR #800. What shipped of it, piece by piece, is
recorded in `Elite-Gates.md` section 31 (THE ASCENT) and that record wins where the two differ.

STATUS (2026-10-18): LAW 10, THE BROKEN WAY (section 11 - Mac: *"Traversing between sections should present a challenge,
platforming should be detailed"*), recorded in `Elite-Gates.md` section 31 (EG-PERFECT). Law 9 is kept beside it, byte for
byte.

`Elite-Gates-Look.md` (EG-LOOK) dressed the halls without touching the law. This page changes the law: the hall
generator (`net/eliteGates/egLaw.js` layHall), its proofs (`net/eliteGates/egSpanLaw.js`), the relay's judging of where a body stands, and
the client's clamp. Laws 4-8 stay byte for byte (`net/eliteGates/egDurable.js` EG_LAWS - a breach opened under a law keeps it);
LAW 9 is new. The relay version for the arc (`world213` since the seventh merge of main) is not yet deployed, so it carries LAW 9 with it.

## What was wrong (measured over 600 halls of law 8, 2026-10-16)

- **A hall is a line.** Every hall is laid along +z from its arrival plate to its door; x moves only on the Low Road
  (+15 m) and by a metre or two inside a run. Nothing doubles back, nothing turns.
- **It hardly climbs.** The only way up on a course is one Riser (+2.3 m); the most a road climbs is about 2.8 m a hall.
  Every Drop, shaft and flight goes down; a hero's exit may never stand above its mouth. Raised floors (balconies,
  perches, pillars) are dead ends.
- **Rooms are beads on the string.** Every chamber and passage has one way in and one way out, on the course's line.
  The only branch is THE FORK (one split, one merge, one way); the only loop Grath's triangle.
- **Climbing is never asked.** The port's climbing (`player/parkour.js` - free-climb, mantle, hang, shimmy, grip) is on
  in the Spire and nothing is built for it.

## The idea

**A hall is a way through the torn academy.** The company comes in at the arrival plate and must find its way up,
down, round and through: along a corridor that turns, into a stair hall and up its grand stair to the gallery, out
across a bridge that passes over the corridor it came along, up a tower's spiral, down into a collapsed undercroft and
up its broken wall by hand, through a cloister round three sides of its court, to the door. Rooms have more than one
way out; the ways cross over and under each other; the hall climbs and falls 10-30 m between its plate and its door.
Off the way, harder climbs lead to the academy's caches and vantages. Everything the Spire already is - the spans'
courses, the fragments, the hero fragments, the courts and their lords - stands along the new ways.

## 1. The route

LAW 9's spec carries THE ROUTE (`spec.route`): the hall's ways as a graph in the hall's frame (cm in the law, metres in
the spec as every other field).

- `nodes`: `[x, y, z]` - the places the ways join (a room's doors, a stair's foot and head, a climb's foot and lip, a
  span's ends).
- `links`: `{ a, b, kind, road, len }` - how one gets from node to node: `walk` (flat ground), `stair` (a stair or a
  ramp), `climb` (a climb pitch - section 4), `drop` (a Drop, one way), `span` (a course of the span generator's pieces,
  proven by its own proofs), `bridge`. `road` 0 the main way, 1 THE FORK's other, 2 a side way (never proven, never
  required - section 5); `len` the walked length (m).
- `main`: the node path from the arrival plate to the door (road 0).

THE ROUTE is the law's one measure of progress. Wherever the arc measured progress along z - the toll, THE FAIR TRAIL's
`far`, the void's cast-back "back", the Divers' next island, the Captive's chains, the Low Road's pick, `egInHall` - LAW
9 measures it along the route (the length along `main` of the nearest point on it, in three dimensions). Laws 4-8 keep z
(their route is the course's line, and every number they make stays as it was).

## 2. Height everywhere (stacked floors)

LAW 9's ways cross over and under each other, so a floor may stand over another floor - a fight floor too. Every test
that asks "is this point on the floor" in plan alone answers by height as well: the fight floor's own tests (`egOnFight`,
`egFightPieceAt`, `egKeepOnFight`, `egFloorTest`, `net/eliteGates/egFloor.js` onFloor), the blow judge (a stamp lands on the fight
floor the body stands on, never on the one over or under it - `net/bossRef.js` judgeShapes' floor), the walk graph's drop
portals (only where a body can actually fall - an open edge over the floor below, never through a ceiling or a wall), the
fliers' air (`egAirOf`), the legion's and the lords' places and charges, the haven grid, the Molten Rim, the client's
`onTraverse`, the telegraph pass (a shape drawn on the floor it stands on). Each takes the body's feet height and keeps
the floor within the walk graph's band (0.5 m under to 3.0 m over its top). Where a law 4-8 hall has no stacked floor,
every answer is the same as before (pinned on their goldens).

A member's own blow on a body (`net/eliteGates/egBodies.js` egHitBody) keeps the storey the same way: a swing reaches a body
of its own storey alone, however near in plan. A shaft or a spell crosses the open air to a body of another storey, and is
refused only where the two stand stacked - a floor or a ceiling over the lower one's plan up to the higher one's own floor
(`net/eliteGates/egWalkGraph.js` egStacked, over egFloorBetween). So Valkynaz Ilthys's banners, on the Council Rotunda's
balconies 4 m over its court, are shot from the court as the laws before judged them, and never through a balcony's deck
from under its rim (FIELD BUGS 2026-10-18d BANNER-SHAFT: every kind of blow was held to its storey, and the banners broke
only from their own balconies).

Floors stacked are at least 4 m apart (a body's height and the ceiling's thickness); a fall onto a floor of the way
further on is a fall onto ground - the void's cast-back keeps its 30 m - so wherever a fall would skip ahead along the
route, the law lays a VOID ZONE (a shaft's or a gap's footprint over which a body is cast back as into the void), and
the fair trail judges a skip by the route's own measure.

## 3. Rooms

A ROOM is a code-built hero: the hero record's own form (`src/assets/egfrags/*.law.json` - its floors as polygons at
their heights, its ramps, its ceilings and open edges, its walls, its sockets in and out, its walk graph, its anchors,
hazards, inner course, alcoves and lights, its proof), made by the law from the hall's seed rather than baked, and laid
by the hero's own machinery (`heroLay`, the hero clamp, the hero walk graph). A room has one socket in and one to three
out, at any of its heights and on any of its sides, and its exits may stand above its mouth. Rooms stand along the route
and the route's links run through them. The archetypes (each in every band's forms - EG_KIT_STYLE):

| room | what | its ways |
|---|---|---|
| **Stair Hall** | a square hall, a grand stair climbing round three walls to a gallery 5-8 m up; the fight on the floor | in below, out below and out from the gallery |
| **Tower** | a round tower, a spiral stair of two or three turns (8-15 m), landings at its windows | in at its foot, out at its head onto a bridge, a window landing a side way |
| **Gallery Hall** | the library's two levels: the floor and a gallery round it on columns, reached by stairs at its ends | in and out at either level |
| **Cloister** | a square court with an arcade walk round it, the way round three sides (two turns), the court a fight floor | in at one corner, out at the next but one |
| **Broken Hall** | the floor collapsed into the undercroft: the way drops down and climbs the far wall (section 4) | in above, out above on the far side |
| **Undercroft** | a vaulted low hall under a court or a bridge the way crosses later | in and out below, a stair up |
| **Crossing** | a hall where two ways cross at two heights, a bridge over a floor | four sockets, two levels |

A Court's lord's ground and the fight rooms (a yard's court, a proving court, a Rift-Yard) stay where the hall's kind puts
them along the route; a fight room's floor may be any of the archetypes' fight floors.

## 4. Climbing

- **On the way (road 0)**: CLIMB PITCHES - a wall of the academy (ashlar, broken masonry, the band's own: bone and roots in
  the Cairn, black glass with silver seams in the Shade, basalt prisms in the Wellhead) with a lip at its top and a
  landing behind the lip, its face a collider wall the climbing motor holds (`player/parkour.js`), in pitches of 2.5-4.5 m
  with a rest ledge between pitches, so a body at Climbing 0 with its fatigue spent climbs it (the grip's own arithmetic,
  `parkour.js` - pinned). At most two pitches in a row; a climb on the way is never longer than 9 m. A climb on the way
  always has a stair or a ramp beside it somewhere in the hall a slower body can take (THE MEDIAN's law: the climb is the
  fast way, the long way round is the other).
- **Off the way (road 2)**: harder climbs - 6-14 m, a pitch to 6 m, few ledges - to the academy's CACHES (a Reliquary's
  coffer, the band's own treasure the arc already pays) and VANTAGES (a ledge over the hall from which the way ahead is
  seen). Never required, never proven, never a fight floor.
- The climb's foot and lip are route nodes, its link `climb`; the fair trail holds a climber within `EG_CLIMB_NEAR_M` of
  the climb's face; a fall from a climb is a fall onto its foot (or the void's, over the void); THE CLAMP keeps a climber
  on the face built for it (a climb zone), never up a passage's wall.
- Roleplay & Realism's climbing restriction (a weapon drawn refuses a climb) is the member's own choice and holds.

## 5. Branches

THE FORK becomes the general case: a hall's ways may split and meet again (a climb against a long stair, a corridor
against a bridge over it), every road the law proves crossable (section 6). Side ways (road 2) lead off to caches,
vantages and a room's second floor, and come back or end. At most three roads a hall; at most two crossings.

## 6. The proofs

THE MEDIAN and the span proofs (`net/eliteGates/egSpanLaw.js`) hold over THE ROUTE rather than z: a road's crossing time is its
links' times along it - a walk at the span build's run over its real length, a stair at the motor's climb of a stair, a
climb at the climbing motor's speed and its mantle, a drop at its fall, a span by the span generator's own timed solver -
and every road 0 and 1 holds the median within 1.6 times its fastest, the windows and the waits as before. The real-motor
sweep (`tools/egSpanSolve.mjs`, `.github/workflows/eg-sweep.yml`) follows the route's main path - turning, taking stairs,
climbing - not a line along +z.

## 7. The bounds

A LAW 9 hall stands inside the wire's bound about its origin (`net/wire.js` GATE_COURT_BOUND, 160 m): x within ±150 m, z
from -10 to 158 m (`EG_HALL_LEN_MAX`), y within -60 to +60 m. Its spec within EG_SPEC_SAID_MAX. Its fragments within
EG_FRAGS_MAX (rooms counted as fragments, the cap raised as the spec's size allows - pinned). Its halls 500 m apart as
before (EG_HALL_PITCH).

## 8. The dress

Every room, corridor turn, stair, tower, climb wall and crossing is dressed as EG-LOOK dresses the ground
(`world/eliteGates/egGround.js`: the academy's walls outward of the collider, vaults, stairs with treads and balustrades, the
towers' drums, the climb walls' masonry with its holds and ledges, the band's forms) and the ruin stands about them
(`world/eliteGates/egRuin.js`: foundations under every floor, cornices, bridges' arches). The lab (`spire.html`) gains a MAP view - the
hall from above with its route drawn - and views inside each room.

## 9. The slices

1. **HEIGHT** - section 2 over laws 4-9 (nothing changes for laws 4-8).
2. **THE ROUTE** - section 1's measure and every reader of progress (laws 4-8 keep z).
3. **THE ROUTE'S PROOFS** - section 6, and the sweep's pilot.
4. **THE ROOMS AND THE WAYS** - LAW 9's generator: the route planner, the room archetypes, corridors that turn, climb
   pitches, branches, void zones; its goldens; EG_LAWS; the relay's hash.
5. **THE DRESS** - section 8.
6. **THE LAB AND THE SWEEP** - the map view, rooms' views; every band's halls walked by the real motor.

## 10. What it does not do, said so

- No hall leaves the wire's bound or the 500 m pitch; no change to the circle's plan (its kinds, its lords, its decrees).
- No climbing for the legion: the legion and the lords keep to the walk graph (stairs and ramps), and a climb's lip is
  never a fight floor's only way in.
- No law 4-8 hall changes by a byte.

## 11. LAW 10 - THE BROKEN WAY (EG-PERFECT, 2026-10-18)

Mac: *"Traversing between sections should present a challenge, platforming should be detailed"*. Measured over law 9
(the traversal, hall and spans audits of 2026-10-18 - 20,000 halls, the real motor on the real collider): the way walked
48-69% of every hall on bridges, landings and stairs no piece and no foe touched, its longest unbroken walk a median of
180-390 m by kind; the planner shared the solver's tries and laid 7% of its spans plainest (12.8% from circle 11, 89-98%
under the Gale - its fork linked the Low Road's islands as "bridges" across its 4.5 m Drop and THE ROUTE'S SANITY refused
every one); a fight hall's door stood 177-243 m past its trial, out of the closing's reach 76-100% of the time; every
approach drew one kind (the first circle's `still`); five of the eight passage kits were crossed without a jump (gaps
0.55-1.0 m); no open-course Drop stood in 2,089 halls; a run of Rails passed through itself; a Pendulum was proven at the
middle of the flight alone. LAW 10 (`net/eliteGates/egAscent.js` EG_BROKEN_LAW) answers each; laws 4-9 lay as they laid.

- **A bridge breaks.** A bridge the way takes, EG_BROKEN_MIN_CM long or more, breaks where its break stands clear (what
  hangs under a course, EG_ASCENT_HANG_CM.step): its middle fallen away and crossed on EG_BROKEN_PIECES of one of its band's
  EG_BROKEN_KINDS, each a gap of THE ENVELOPE past the last, at the Steps' own timing, EG_BROKEN_FOOT_CM of bridge kept at
  either end - its pieces off the planner's die, so no course's draw moves. Along +z they are laid by the span generator's
  road; along +x, -z or -x (a TURNED course, `hd` on each piece) only the pieces that keep still (EG_BROKEN_TURNED - a still
  slab, a Crumble, a Beat, a Vent), laid off every road's line and read in their heading's own frame by every reader of a
  chain (`net/eliteGates/egSpanLaw.js` egStepLocal, egAlongOf; `net/eliteGates/egRouteProof.js` egRouteSpanSteps along x; the
  pilot's frame in `tools/egSpanSolve.mjs`). Each is a course of its own: its ground in `route.courses` (marked `b`), proven by
  THE TIMED SOLVER where it stands, the way a bridge, a span and a bridge. The approach comes into a course's foot along
  +z EG_BROKEN_RUN cells from its last landing (a run long enough to break), on a quarter of the search, else law 9's two.
  THE AUDIT (2026-10-18) set how a bridge breaks: its pieces drawn once - EG_BROKEN_PIECES, and one more for every
  EG_BROKEN_PER_CM it runs past EG_BROKEN_LONG_CM, EG_BROKEN_MOST at most - then that many, one fewer, down to one, each
  break tried along the bridge at EG_BROKEN_SLIDES (its middle first) where it stands (a centred break that met anything
  left the bridge whole, and bridges of 30 m and more were walked whole); a lone piece is never a still
  slab (15% of the broken bridges were one still slab); a break - a Drift's sway with it - stands EG_BROKEN_CLEAR_CM clear
  of every leg, the two it joins too (a Drift swung within a centimetre of a room's wall); an approach's run past
  EG_BROKEN_SPLIT_CM is laid as bridges of EG_BROKEN_CHUNK_CM and more, each broken on its own (a 136 m approach broke
  once); a Gust is never an approach's kind (THE TIMED SOLVER reads no gust: run straight on after a Crumble run, the real
  motor fell on 1.9% of the roads); and a try that lays no span link - a hall walked without a jump - is refused.
- **The fork stands.** The Low Road's first island is reached by its bridge, every later one by its own span. A span's
  fork is laid as its first course (where the bound has room for its length), its course held under EG_FORK_COURSE_CM
  (its Low Road's second passage left out past it) and no trunk passage under two ranks of the decrees. THE AUDIT: the
  plan's own tries (`lean`) lay the fork second again (laid first, it cost three halls their fork).
- **The plan's own tries.** A hall the planner refused is laid again EG_BROKEN_TRIES more times (its fewest rooms, never
  the deep profile - `lean`), its courses whole, before the plainest; a stretch whose rooms find no room is planned again
  with one fewer, down to none.
- **A fight hall's door follows its trial.** A Rift-Yard's, an Athenaeum's, a Scriptorium's and a Proving Walk's rooms all
  stand before its first course and the way climbs to it; its door follows its trial straight on where its bridge and plate
  stand clear. The relay holds such a trial's clocks until its company stands on its fight floor (`net/eliteGates/egBrain.js`
  egTrialAwaits, EG_AWAIT_CLOCKS - a Rift-Yard's, an Athenaeum's and a Deepway's). THE AUDIT: a Scriptorium's quiet too
  (`quietUntil` - it ran from the hall's wake, and the company walking its rooms first heard the pull before the fastest
  build could reach the door: seed 7's hall 8, 53 s against 57.8), held until a member stands on its trial's own ground
  (`egOnTrialGround` - its first course that is no broken bridge); and the Deserter closes no rift while a trial waits
  (it closed them unopposed while the company walked the rooms).
- **Two kinds an approach.** A Court's, an Athenaeum's and a Proving Walk's first course draws two different kinds of
  its band's whole set in two runs (the first circle a Drift and a Beat), an island between them at a Court from its sixth
  circle.
- **THE ENVELOPE in the passages.** The Caverns', the deep Caverns', the Stacks' and the Ossuary's chasms are as wide as
  their pieces at one gap of THE ENVELOPE; the Mist Stair's at its least gap (its floors keep 4 m). A passage's length and
  width - the envelope a hero record is baked to - are unmoved (`net/eliteGates/egFragLaw.js` EG_FRAG_BROKEN_LAW, named by the hall
  law, never the newest unnamed).
- **A Drop falls, the High Road keeps time.** A Drop drawn where its road stands at its floor falls EG_DROP_LAW10_CM to
  EG_DROP_CM below it; a fork's High Road is carried on past its Drop by Beats half a cycle apart, and draws no Drop of its
  own (THE AUDIT: a drawn Drop beside the fork's barely fell). A fall into a void zone is the void's from
  `EG_VOID_DROP_M` under the ground left - THE AUDIT: past the deepest Drop (EG_DROP_CM and a quarter metre; at 3 m every
  way down a Drop under a Gale fork's plate zone was the void's - seed 3's hall 7, both roads); under law 10 a zone stands
  under the arrival plate too (`voidsOf` - in seed 2's hall 3 a step off it fell 19.3 m onto a leg 166 m along the 449 m way, credited).
- **Rails apart, a Pendulum over the flight.** A run of Rails stands at one gap and one period, each half a cycle behind
  the last (THE AUDIT: π - `egPieceAt` reads a phase as its angle; half the period read so set them 172-258 degrees apart),
  its travel under half its gap less EG_RAIL_CLEAR; the Forge's conveyors are one belt; THE TIMED SOLVER refuses travelling
  neighbours that meet and takes a Pendulum's weight over the whole flight (EG_SOLVE_FLIGHT_LAW) - THE AUDIT: on the body's
  own path, at EG_SOLVE_FLIGHT_N even instants, its middle on the launch edge and a body's radius past it at its run's pace,
  its feet on the jump's arc (the reach's path ran the body 27% fast, its feet at the landing's height: 7% of the launches it
  called clear met the weight; at twelve instants the swing between two let 3% through); a link reads only the pieces of its
  own heading (`egRouteSpanSteps`).
- **The halls' fittings where a body reaches them.** A chamber's alcove stands at its court's rim and its ring opens there
  (`net/eliteGates/egWalkGraph.js` egRingSideOpen - every reader of a ring wall; THE AUDIT: a doorway EG_RING_DOOR wide about
  the alcove of the ring's own chamber, its side's wall kept either side - `egRingSideWalls` - where the whole 3.4-5.4 m side
  stood open about a 2 m niche, and a passage's alcove beside the ring opens none of it); a balcony 4 m up and more; a Rampart's caster
  pillar on the side no bastion holds, its Gauntlet plate on its top; a Winch plate against the walkway; a Glade's braziers
  on its ground; a Captive's chains about its hero chamber's own line; a Reliquary Vault off its island's rim, a Proving
  Walk's a side span off its court (off its second span's island where its court is walled); rooms drawn from the whole
  fresh pool (law 9 drew from its first four: a tower in 82% of its halls).

What it does not do: it turns no moving piece (a Drift, a Rail, a Pendulum keep +z); it changes no lord, no circle's plan
and no bound; the rooms' own records and the climbs are law 9's.

**The pins under law 10.** Law 10 lays every seed's halls anew, so a pin measured on a law 9 hall now names law 9 - by its
`law` argument or THE SEAM (`egLawSeam(9)`), a relay rig's breach with it (`B.egv`): the EG-PERFECT halls' repros (the
Captive's chains, the closing's walk, the Deserter, the Ashfall, the Gauntlet's plates on their stairs, the Casters'
stands, the toll's rooms, the voids, the hang). A sweep that holds a property over the halls runs over law 10's own: the
closing's walk over seeds 1-2 read from its trial's own ground (the first course that is no broken bridge, as
`egTrialEndAt` reads it); the Captive's chains over seeds 1-40 (law 10 hangs every three on its floor: 56 kept, none
refused - law 9 refused two); the Deserter halls of seeds 1-30; the lamps' budget over seeds 1-2; the Orrery's handles; a
Fallen Stacks' stands 4 m up. Two matchers read a hall too loosely for law 10 and now read it exactly: the place's-white pin
matches the tide by its reach (a Deepway's engine marks its chamber's middle, the tide's own centre), and the motes'
clearance is measured on its one disc alone (law 10's way circles that court at its height). Seed 115's hall 52 lays its
Eclipse chamber's way 721 m under law 10, past the route's 640, and its next slot's hero stands instead - the law's own
refusal, the pin moved to seed 111's hall 57.
