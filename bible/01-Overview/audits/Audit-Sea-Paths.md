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
mutants are `tools/mutants/auditseapaths.json`: 73, 72 dead, one equivalent as recorded. Thirty-five records of earlier
lists aimed at lines these fixes moved; each was re-aimed by content and dies again, but `P7-corner-cut`, now equivalent
as recorded (O2).

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

## Fixed - the six left open (O1-O6)

The owner, of the six the first pass left open: *"Take care of all the open item"*. Each is closed below, under its id.

- **O1, voyages past the grid's reach.** A way the grid's search spends `PATH_NODES` on is sought again over cells four
  of its own a side (a weighted search), and each coarse step found again in the grid's own cells; one way's whole spend
  is three of `PATH_NODES`. Harbour to harbour on the real map, 0 of 50 pairs fail (19 did): Pallaton to Sentinel and
  Jalonia to Naresa sail harbour to harbour.
- **O2, Necrom and Ebonheart.** Vivec and Ebonheart share a channel a picture cell wide on the slant, and the lane search
  refused every diagonal past a cell's corner: it now takes one where the Bay's scale holds the step. A port past the
  Bay with no port in reach and no lane with a way looks out to 1,600 pixels, a way allowed twice the distance (Necrom).
  Every port past the Bay a lane holds is served.
- **O3, corner clips.** The scene's grid walks the host's own tiles (`navalIsWater.tile`), so no leg clips a tile's
  corner, and a packet or a raider sailing for a point of her own takes the grid's way to it (`courseVia`). The world's
  lanes and raiders read the kernel's own ground (`world/water/kernelSea.js`, 99.3% of a coast's tiles agree): a lane
  leg over its land goes round through its pixels' own water at an eighth of a pixel, and a raider is born and sails
  only on it. All 398 ways hold on it, the count they had, and the book's first build is 0.5 s (0.2 s before).

- **O4, the Eltheric's beach.** Its isles stood a pixel past their last land byte: a byte over the sea's own height (4
  and 5) is the planner's land there, and a journey's sailed legs are mended round the kernel's land with marks of
  their own (`systems/travel/seaLegsMend.js`). The worst sailed run over land in the auditor's twelve voyages fell from
  1,210 m to 20 m, the kernel's own beach tiles.
- **O5, a packed boat past the Bay.** Ashore with a boat to hand, the plan may walk to the nearest shore and sail the
  sea lanes from it, the cheaper of that and the box's plan kept. Rihad to Woodhearth plans (none did); Sentinel to
  Hegathe costs 665 (1,033) and Woodhearth to Haven 675 (851), what the helm's own voyages cost.
- **O6, the straightening's cost.** Galloped out from each point and halved back, the end asked first: a zigzag
  channel's way in 21,962 soundings, where the look back from each end asked 43,777.

## Connected - the five lanes with no way (C1)

The owner, of the five lanes this record left with no packet: *"Connect them all"*. The record said their ports' waters
do not join. They do - one sea on the picture joins every port past the Bay - but each way ran past its lane's cap:
Senchal to Torval 829 pixels against 800, Necrom to Vivec and to Ebonheart 1,129 and 1,363, the Imperial City to
Winterhold and to Windhelm 5,900, round the land and up the Niben.

- **C1, a lane past its cap.** A lane past the Bay whose search finds no way under its cap is sought over the picture's
  whole sea, its own length its cap (`worldLanes.js` longLanes). The cap is tested by the search alone (`beyondReaches`),
  so a way is still drawn when it is first asked. Every lane past the Bay sails; every other lane's way is unchanged.
- **Near.** A long lane's ellipse would hold the whole land: a player is near one within `pad` of its way (`nearWay`).
- **Packets.** A lane sails LANE_PACKETS_MAX (400) at most, its headway widened past it: the Imperial City's to Skyrim,
  4,800 km, would sail 1,900. The longest before sailed 303.
- **Cost.** The book past the Bay builds in 0.35 s (0.2 s before): a picture cell's sea and each step past a cell's corner
  are kept, the kernel's last pixel kept to hand.
- **The living world.** A long lane is longer than any block of passages (WW7-11): `seaTrip` passes it for a shorter.

Sixteen of the Bay's lanes still have no way: one end's roadstead lies in a lake or a pocket of one to sixteen pixels,
and 20 of those 21 ports have no sea within ROADSTEAD_PX. No water joins them.

The lanes change where a packet sails and where the serpent rises (its site is rolled over the lanes): every client of
one version agrees, and a client of the last version disagrees until it updates, as with every lane change before.
