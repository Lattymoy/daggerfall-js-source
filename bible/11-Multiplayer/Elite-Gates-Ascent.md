# The Ascent: the Elite Breach's halls as ways

How the Elite Breach (the Spire, `Elite-Gates.md`) lays a hall under hall laws 9 and 10. A hall is a way through the
torn academy: corridors that turn, rooms with several exits, stairs, towers, bridges that pass over earlier ways,
climbs, and broken bridges crossed on moving pieces. The way climbs and falls 10-30 m between the arrival plate and the
door. Players meet it as the platforming and traversal between a hall's fights. A breach keeps the law it opened under
(`src/net/eliteGates/egDurable.js` `EG_LAWS`); laws 4-8 lay a hall along a line as before.

## How it works

**The route** (`src/net/eliteGates/egAscent.js`, from the hall law `src/net/eliteGates/egLaw.js` `layHall`). The hall's
spec carries `route`: nodes `[x, y, z]` and links of kind `walk`, `stair`, `climb`, `drop`, `span` or `bridge`, each on a
road (0 the main way, 1 the fork's other, 2 a side way), and `main`, the path from plate to door. Under laws 9 and 10 the
route is the one measure of progress: the toll, the fair trail, the void's cast-back, the Captive's chains and
`egInHall` read the length along `main`. The plan follows the hall kind's recipe of courses and rooms, a height profile
within `EG_ASCENT_RISE_CM`, and legs kept `EG_ASCENT_APART_CM` apart, inside `EG_ASCENT_BOUND`. The route's sanity
check (`egAscentSane`) holds every link walkable, the main way connected, at most `EG_ASCENT_CROSSINGS_MAX` crossings,
and length within `EG_ROUTE_LEN_MAX_M`; a hall that fails is laid again from the next dies.

**Height everywhere.** Ways cross over and under each other, so every "is this point on the floor" test reads height
too: the fight floor's tests, the blow judge, drop portals, fliers' air, the legion's and lords' places, the telegraphs.
A floor counts within 0.5 m under to 3.0 m over its top. A melee blow reaches only a body on its own storey; a shaft or
spell crosses open air but not a floor or ceiling between (`src/net/eliteGates/egWalkGraph.js` `egStacked`). Stacked
floors are at least 4 m apart. Where a fall would skip ahead along the route, a void zone casts the body back.

**Rooms** (`src/net/eliteGates/egRoomLaw.js`). Code-built hero records laid by the hero machinery: Stair Hall, Tower,
Gallery Hall, Cloister, Broken Hall, Undercroft and Crossing. Each has one way in and one to three out, at any height.
Fight rooms stay where the hall's kind puts them.

**Climbing.** On the main way, climb pitches of 2.5-4.5 m with rest ledges, at most two in a row and never over 9 m, that
a body at Climbing 0 can climb (`src/player/parkour.js`); a stair or ramp elsewhere in the hall always offers the slower
way. Off the way, harder climbs lead to caches and vantages, never required. The fair trail holds a climber within
`EG_CLIMB_NEAR_M` of the face.

**Branches.** A hall's ways may split and meet; side ways lead to caches, vantages and second floors. At most three
roads a hall.

**The Broken Way (law 10).** A bridge on the way at least `EG_BROKEN_MIN_CM` long breaks in the middle and is crossed on
`EG_BROKEN_PIECES` of its band's `EG_BROKEN_KINDS`, each a gap of the jump envelope apart; turned courses use only pieces
that keep still (`EG_BROKEN_TURNED`). Each is a course of its own, proven by the timed solver. A fight hall's door
follows its trial, and the relay holds a trial's clocks until the company stands on its fight floor
(`src/net/eliteGates/egBrain.js` `egTrialAwaits`). An approach draws two kinds of its band's set. Passage chasms are
widened to a real gap. Drops fall, Rails run apart, and a Pendulum is proven over the whole flight.

**Proofs and bounds.** The median and span proofs (`src/net/eliteGates/egSpanLaw.js`, `src/net/eliteGates/egRouteProof.js`)
time each road along its links: every road 0 and 1 within 1.6 times its fastest. The real-motor sweep
(`tools/egSpanSolve.mjs`, the `eg-sweep` workflow) follows the route's main path. A hall stays inside the wire's bound
(`GATE_COURT_BOUND`, 160 m), z up to `EG_HALL_LEN_MAX`, halls `EG_HALL_PITCH` apart.

## Rules

- Halls use climbing, elevation, turning corridors and rooms, not a straight line from A to B (Mac).
- Climbing both on the route and off it (Mac).
- Traversal between sections is a challenge and its platforming detailed (Mac).
- A breach keeps the law it opened under; no law 4-8 hall changes by a byte.
- The legion and the lords never climb; a climb's lip is never a fight floor's only way in.
- Moving pieces keep their +z travel; a turned course takes only still pieces.

## Code and tests

- `src/net/eliteGates/egAscent.js` - the route planner, laws 9 and 10
- `src/net/eliteGates/egRoomLaw.js`, `src/net/eliteGates/egWalkGraph.js` - rooms, storeys, the walk graph
- `src/net/eliteGates/egSpanLaw.js`, `src/net/eliteGates/egRouteProof.js`, `tools/egSpanSolve.mjs` - proofs and the sweep
- `src/net/eliteGates/egLaw.js`, `src/net/eliteGates/egDurable.js` - the hall law and its versions
- `test/net/eliteGates/law9_route.test.js`, `test/net/eliteGates/law9_height.test.js`, `test/net/eliteGates/law9_rooms.test.js`, `test/net/eliteGates/law9_proofs.test.js` - law 9
- `test/net/eliteGates/egperfect_broken.test.js`, `test/net/eliteGates/egperfect_broken_unit.test.js`, `test/net/eliteGates/egperfect_audit.test.js` - law 10
