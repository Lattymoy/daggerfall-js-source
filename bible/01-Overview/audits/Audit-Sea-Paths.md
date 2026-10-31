# AUDIT SEA PATHS - ship pathfinding at sea, 2026-10-31

The owner, 2026-10-31: *"Can we audit both player and AI ship pathfinding in the eltheric sea and the open waters of
tamriel and ensure its perfect"*. Three cold lanes read the tree at a1d895841, each proving its findings with node probes
on the freeware's own map (ARENA2, the Bay composed with the land past it and the Eltheric Ocean as the world host
composes them):

- **AI, in the scene** - `systems/naval/shipLife.js` (the water grid, the errands), `navalAI.js` where it steps them,
  the naval host's grids, the fishing boats;
- **AI, the world's lanes** - `systems/naval/seaLanes.js`, `scenes/naval/worldLanes.js`, the Overworld's raiders;
- **the player** - the planner's sea layers (`systems/travel/travelRoute.js`), the journey's hand on the helm
  (`systems/seaHelm.js`, the world host's crossing), the sea legs' arrival, booked passage.

Every finding below was reproduced before a line changed, and each fix carries an `AUDIT SEA PATHS <ID>` comment. The
pins are `test/systems/naval/auditseapaths.test.js`, beside the pins they moved (`PIN MOVED` where each stands). The
mutants are `tools/mutants/auditseapaths.json`: 39, 38 dead, one equivalent as recorded. Fifteen records of earlier
lists aimed at lines these fixes moved; each was re-aimed by content and dies again.

## Fixed - AI ships in the scene

- **AI-1, a voyage out of the world aimed at land.** Her mark was drawn 2.6 km out with only its first 800 m sounded:
  531 of the real map's 5,680 departures lay on land, and at Gallocart two of five merchantmen circled the mouth for
  forty minutes. The mark is now drawn where the water carries her straight (the grid's `run`, backed off until
  `clear` holds), and a ship with no 300 m of water on any bearing keeps her own cruise.
- **AI-2, under way and getting nowhere was never a stall.** The stall read her speed alone. Now a mark she comes no
  20 m nearer in 60 s takes her on to the next point, else her detour; a detour is 60 s at most; a point passed
  abreast (beyond it along the leg into it, the next point clear) is made; a galley reaches a point within half her
  93 m; and a replanned way's first point, her own place, no longer clears her detours.

- **AI-3, harbour to harbour mostly failed.** A departing ship took the nearest harbour by distance and gave the voyage
  up at the mouth when the grid found no way (29 of 44 in a streamed window). She now takes the nearest of two the grid
  finds a way to, its way kept, else she sails out.
- **AI-4, ground not yet built was kept as land.** The grid cached a cell sounded before its pixel streamed until the
  origin moved. The host's sounding answers null there (`navalIsWater`), and the grid keeps no cell it was unsure of.
- **AI-5, one clearance for every hull.** The grid opened a 60 m gap the galley's lookout (half her beam and 4 m)
  refused, and she circled it. A hull's grid now asks that much at least (`gridClearOf`).
- **AI-6, a step through a spit one tile thick.** Eight soundings a cell left gaps of 8 to 12 m. Each cell now sounds
  its eight spokes every 3 m out to its clearance, so no way crosses a 6.4 m wall or rock.
- **AI-7, a fishing ring point ashore.** 101 of 602 boats had one, circled all day. A ring keeps the points with the
  grid's room about them that the water from her ground reaches, by the ground where a chord does not, and a smack
  works it on her sweeps.

## Fixed - the world's lanes

- **LN-1, the Bay's lanes read the coastal dilation.** The boot's dilation (`dilateCoastalClimate`, a texture repair)
  pushes the land's climate two pixels to sea, and the lanes' Ocean test read through it: 103 ports, Daggerfall,
  Sentinel and Wayrest among them, had no roadstead (295 lanes, 233 ports served). The lane water is now CLIMATE.PAK's
  own climate (`undilatedClimateIndex`) under SEA-SQUARE's four-corner law (`bayLaneWater`): 370 lanes, 292 ports
  served, each capital two lanes. The four-corner law also keeps the roadsteads off the kernel's land.
- **LN-2, ports past the Bay with no packet.** Blacklight, Lilmoth and Soulrest stood 443 to 604 pixels from every port.
  A port with none within its 400 pixel reach now looks to its way's cap, 800 (`laneNetwork`'s `farPx`); Vivec is
  joined through Blacklight.
- **LN-3, raiders over the kernel's land.** A raider's course asked its pixel's own byte. It asks the square's four
  corners now (`tvRaidSea`). Over twelve lives on six coasts, the Bay's, the land past it and Veilhaven's, the
  positions on the kernel's land fell from 780 to 37, and the deepest from over 1 km to 225 m.
- **LN-4, a lane leg past a corner of land.** Four soundings a pixel stepped past land up to 179 m deep. A leg now
  holds only where every map pixel it crosses is water (`holdsLine`), the lanes past the Bay and across its edge too.

## Fixed - the player

- **PL-1, a sea leg past the Bay could not be arrived at.** SEA-SQUARE centres its window on the pixel's byte, a corner
  four pixels share, and the autopilot asked arrival in the one pixel: Eltheric voyages stopped "no way at sea" 18 m
  and 68 m from the mark. A sailed or launched leg now arrives anywhere in its window (`edgeArrival`), and a land leg
  after it keeps the autopilot's own law.
- **PL-2, a plan across the Veil.** Veilhaven's helm to Daggerfall sailed one leg of 3,466 pixels, 2,607 of them over
  sea no ground streams. A plan with one end in the Eltheric Ocean's box and one out of it is none (the crossing is
  the way), and a plan inside it keeps to the box.
- **PL-3, 631 Eltheric port isles unreachable.** Their town and every pixel about it read water, and a landfall was a
  step onto dry ground. A place on water with no dry pixel within the landfall's reach (3 pixels) is landed on itself;
  one with dry ground in reach lands there as before (AUDIT STARTS V4). Syrisol Landing and Ishomere Landing plan by
  helm and by passage.
- **PL-4, a boat to hand made walkable trips fail.** The search afloat and ashore spent its count (Wayrest to Markarth,
  Daggerfall to Farrun, boat parts packed). A plan with a boat that finds nothing is planned again on foot
  (`tvMooredDry`); a passenger is never set walking.
- **PL-5, the no-way clock ended every detour.** It ran against her nearest approach, so a headland a kilometre deep
  stopped her behind it. While the hand steers off land the clock follows her, the way back counts, and a separate
  900 s budget ends a dead end (`seaNoWay`). Every hull now rounds bars of 400 m to 3 km in every wind.

## Open, with the reason

- **Long voyages past the grid's reach.** `PATH_NODES` (6,000 cells) does not find a way round a peninsula of 1.5 km
  or more: Pallaton to Sentinel and Jalonia to Naresa still sail out of the world rather than harbour to harbour. A
  coarse first search would lift it; it is a design choice for the owner, not a defect left.
- **Necrom and Ebonheart run no packet.** Their water joins no port's within the 800 pixel cap.
- **Corner clips under a point sampler's floor.** A straightened leg sounded every 5 m can clip a corner by under that
  (0.6 m at Aldwall Rock); a lane leg can cross the kernel's land inside a square whose four corners are water (307 m
  at worst, 0.75% of the Bay's lane length), and 37 raider positions stand on it so. The captains' lookout keeps a
  hull off all of these.
- **The planner's water at bytes 4 and 5.** The planner calls them water; the built ground stands them just over the
  sea. Eltheric legs run beside isles there and the hand steers round them (no hull touched land in the lane's runs).
- **A packed boat past the Bay never sails the lanes.** The lanes are asked from a helm alone; from the shore the
  search walks or sails the box. PL-4 lets the walk through; walking to the shore and then the lanes is a slice.
- **The straightening's cost** grows with the square of a way's points (31,000 to 60,000 soundings in a long
  channel); it is a cost, not a wrong way.

The lanes change where a packet sails and where the serpent rises (its site is rolled over the lanes): every client of
one version agrees, and a client of the last version disagrees until it updates, as with every lane change before.
