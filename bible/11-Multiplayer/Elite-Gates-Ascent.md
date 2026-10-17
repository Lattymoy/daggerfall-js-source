# The Ascent: the Elite Breach's halls as the academy's ways (LAW 9)

STATUS (2026-10-16): the plan of LAW 9. Mac, having seen the halls dressed: *"I just feel like we could do more to
utilizing climbing sections, different elevations. Something that isnt just a straight line from point A to point B.
Like, I want it to feel like you're actually traverversing corridors, different rooms, etc. This is just too simple"*.
Asked: climbing both on the route and off it (*"Both"*), and inside PR #800. What shipped of it, piece by piece, is
recorded in `Elite-Gates.md` section 31 (THE ASCENT) and that record wins where the two differ.

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
