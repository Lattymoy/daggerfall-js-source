# The Shipyards, the Crew Halls and the Lighthouses (SHIPYARDS)

> DF-LOOK (2026-10-15, `01-Overview/DF-Art.md`): the port's pictures - the SHIPS and CREW boards and the beacon's flame among them - are painted here again (DF-ART's swap to Daggerfall's records reverted), laid on in Daggerfall's colours as they go up - grained and snapped to the player's own ART_PAL.COL (`world/dfLook.js`); the flame's own light stays as painted.

THE PORT'S OWN (2026-10-11). Mac: *"I want to give ports the same treatment we did wagons and horses. A new highly
detailed shipmaster vendor and crew recruitment station within it. All detailed functions including ship upgrading
should be present here, along with ship buying, etc. This should also come with a detailed overhaul to piers and
introduce the new lighthouse building. Everything should show on the map/overworld and be able to be asked by NPCs."*
Asked four things, Mac chose:

- **Where** - "Town's seaward edge": both on the town's own open ground at the edge nearest the sea, placed off the
  town's layout like the Stables (`03-World/Merchant-Yards.md`).
- **Ship sales** - "Shipyard only": the shipyard sells every hull and buys them back; Come Sail Away's random shelf
  deeds and parts are retired.
- **Crew hiring** - "Pick named recruits": a daily roster of named sailors - class, trade, grade, a signing fee - and
  the player chooses who joins which ship and at what post.
- **The lighthouse** - "Climbable, with keeper": a stone tower and the keeper's cottage, its lamp lit from dusk with a
  sweeping beam, and the keeper lets the player climb to the gallery.

Daggerfall has no ships and no lighthouses, and Come Sail Away sells a hull off a shop's shelf. Like the yards, a port's
places are not buildings: no building record, no deed, no quest place, and the blocks' own automap bytes untouched. The
whole of it is a departure, Ledger A (SHIPYARDS, SHIPYARDS-FOUND, THE PIER'S DRESS).

## Where they stand

**Which towns** (`systems/portPlaces.js` `isPortTown`). A city, a town or a village (`PORT_TOWN_TYPES`) that is a port
by its own data - Travel Options' hand-written harbours (`systems/travel/travelPorts.js` `hasPort`) or Daggerfall's
PortTownAndUnknown byte (`portTownByData`) - AND that the open sea bears on (INLAND-PORTS,
`01-Overview/bugs/Field-Bugs-2026-10-14-inland-ports.md`; `portSites.js:"export function portTownOnSea(loc, hasPort, isSea) {"`,
the host's `portOnSea`): a pixel of the open sea within `SEA_RING` (2) of the town's, the ring the bearing below is read
off, so every port town has a seaward edge. THE OPEN SEA is the map's water that reaches the map's border
(`portSites.js:"export function openSeaOf(isWater, width, height) {"` - the one water law's pixels flooded eight-way from
the map's edge, Deep Waters' own flood of the sea; past the Veil, the Eltheric Ocean's water round its isles). The data
alone is no coast: the byte's 0x10 is the region capitals' mark and Travel Options' table copied the byte's list, so 36
capitals in the hills and the deserts stood a shipyard and a lighthouse at their middle (Ilessan Hills beside its own
ponds - the report); and the byte's low bits name a lake's side as the sea's. On the real map 106 of the 155 towns that
are ports by their data stand them, and the harbour board's ports are the same 106 (`03-World/Captains-Sea.md` THE
PORTS). A seat's members' harbour (`hasPortFor`) is one guild's word, so it stands no shipyard: every client stands the
same one. Its harbour - the quays and the DOCKS below - is sounded out to that same ring when the town's own shore
gives no berth within HARBOUR_REACH (FB1020c HARBOUR-REACH, `03-World/Holdings.md` section 7): 37 of the 106 stood a
shipyard and a lighthouse and no quay until then (Daggerfall, Sentinel and Wayrest among them); 105 stand one now,
Aldbrugh none (open).

**The ground** is the yards' (`world/merchantYards/merchantYardSites.js` `townGroundOf`): the town's navgrid on the enhanced lane's
water table, its buildings `BUILDING_CLEAR_M` off, its props, flats, palace blocks and the monument - with the Stable and
the Wagon Yard already closed on it, `YARD_GAP_M` round each. The yards are placed by their own two steps, as they
always were (`townGroundOf`, then `yardSitesOn`), and the port's places go on what they left (`scenes/world.js`
`townPlacesFor`, one memo a town, keyed by its measures and whether it is a port).

**The sea** (`world/portSites.js`). Where the town's own blocks hold the sea - open water cells (no automap byte, a
ground tile of the water family on the enhanced table) in a body that reaches the block grid's edge with
`SEA_CELLS_MIN` (48) cells at least, never a pond or a fountain (`townSeaOf`) - each cell's distance to it is walked
four-way (`seaField`, kind `water`). Where they hold none, the sea's bearing off the map pixels round the town's
(`seaBearing`: every pixel of the open sea within `SEA_RING` (2) - the port's one water law, `isWaterPixel` over
CLIMATE.PAK and WOODS.WLD, flooded from the map's border (INLAND-PORTS: a lake behind the town never turns its yard) - two
near, one far; the map's y runs south, the frame's z north), and a cell's distance is how far it stands in from the town's
seaward edge, and `LATERAL_K` of its distance off that edge's middle (kind `bearing`). The bearing's sum nought - the sea
all round evenly; a port town always has the sea within the ring - the town's middle, as the yards' (kind `middle`). A body of the town's own water whose middle lies against the map's
bearing - on the far side of the town's middle from the sea the map shows - is a lake or a river's reach inland and no
sea (`townSeaOf`'s `bearing`, AUDIT SHIPYARDS U2): the shipyard turned its back on the sea to face it.

**The place** (`portSite`). A rectangle (`PORT_FOOT`: the shipyard 22 m by 16, the lighthouse 13 by 13; its front - its
gate's side - along +z), turned to one of the four axes; its ground open and off every road, a ring of `YARD_PAD_M` open
round it. Each BACKS ONTO THE SEA: a place whose front stands no farther from the sea than its back by its own depth
costs `FACE_K` (2) cells for every cell it falls short - more than a front onto no road - so a shipyard backs onto the
water first and opens onto a street where it can. The shipyard's score is that and the sea's distance at the middle of
its back edge (`backMiddle` - its sea wall, its slipway running out through it), a front facing no road costing
`NO_ROAD_COST` (12) more; the lighthouse's is that and the sea's distance at its middle, less `LIGHT_APART_K` (0.5) of a
cell for every cell it stands from the shipyard (to `LIGHT_APART_CAP`, 40): the town's light at its harbour's end, not
beside its yard. `LIGHT_APART_K` outweighs the `LATERAL_K` (0.25) the light pays along the seaward edge for every cell off
its middle and falls short of the cell it pays for every cell inland (AUDIT SHIPYARDS L3-1: at the same quarter the two
cancelled, and on a bearing the light stood beside the yard). Ties to the lower row, then column, then turn; every
distance an exact sum or a `Math.sqrt` of one - the same on every engine. The people's navgrid is closed over both
(`carveYards`). What fits stands - the shipyard first, then the lighthouse on what it left - and what does not is said
once in the console (`[port] <town>: no room for its ...`); a town with room for neither stands none.

## What stands

The port's own geometry in the port's own art, made at boot under the pseudo-archive 38231 (`world/portArt.js`
`PORT_ARCHIVE`): the yards' timber, planks, shingles, straw, earth, gravel, water and iron at the yards' own records, and
stone, whitewash, slate, glass, a leaded window, rope, canvas, tar, sawdust, a hull's planking, cobbles, a door, notices
and brass besides, the two boards, and the beacon's flame and embers (BEACON-TOWER, below: the red band and the copper
went with the tower that wore them). Nothing of Daggerfall's is read for either.

**The shipyard** (`world/shipyardModel.js` `buildShipyardModel`, `SHIPYARD` its layout). A board fence round the yard; a
gate arch at its front, two tall posts and a beam with the SHIPS board hung from it on iron rods - an anchor and the word
in painted capitals; a hull on the stocks along its slipway, her stern to the sea - keel, stem and sternpost, frames,
her planking laid from the keel up to `PLANKED_TO` of her side and her upper frames bare, on blocks and shores, a
scaffold along her with a shipwright up on it; the sheerlegs over the slipway's end with their tackle, and a capstan; a
timber yard - logs on bearers, sawn planks stacked with stickers, a steam box on trestles over its firebox; the
shipmaster's OFFICE - plank walls, a shingled roof, a porch where he stands, a lantern by its door (`SHIPYARD.lantern`,
the point its light stands at too); the CREW HALL - an open shed of a lean-to, its table the crewmaster stands behind, a
CREW board (a coil of rope and the word), a notice board of ships wanting hands; a sea wall along its back, either side
of the slipway's end; coils of rope, a capstan's drum, an anchor leant on the fence. No prop runs through another and no
two faces of different pictures lie in one plane (AUDIT SHIPYARDS L5-1, L5-3): the shores skip the steam box and the
scaffold's posts, the capstan's bars clear the sea wall and the posts, the second shipwright stands at the firebox's
front, the gables stop under their roofs, the hall's eaves beam butts its far side, the scaffold's inner posts stop under
its walk.

**The lighthouse** (`world/lighthouseModel.js`) - a BEACON TOWER since BEACON-TOWER (below). A round stone plinth, the tower
in grey ashlar narrowing up to its gallery (`towerR`), two string courses round it; its door to the town under a lintel,
slit windows of leaded panes up its faces; a corbel table, three stepped stones under each face, carrying the gallery at
`GALLERY_Y` (17.6 m), and round it a battlemented parapet (`parapetR` its inner face) - a crenel to the town and one to
the sea, a merlon between each two; on the gallery the open stone lantern, eight round arches on their sills (`ARCH_CROWN`
their crown), a cornice with the lantern's ceiling under it, a steep slate cone (`roofH`) and an iron rod and vane at its
point (`LANTERN_H` the lantern's height to that point); in it the beacon, an iron brazier on a stone pedestal, its coals
smouldering; the keeper's cottage beside it, its water butt and the oil casks by the tower clear of each other and of
the plinth; the door and the slit windows lean with the tower's taper. The beacon's flames are a mesh of their own
(`buildLighthouseFire`), drawn casting no shadow - the lamp's light stands in them, as it stood inside the lantern room's
glass the first tower had, which as a caster shadowed its own light on every side (AUDIT SHIPYARDS L5-2) - only in the
lanterns' hours, and never a solid.

**The gallery's guard** (`guardBand`), the collider's alone: a corridor just inside the parapet from the gallery's floor
to `guardH` (2.2 m) over it, lidded in to the lantern's faces, standing in a bucket of its own while the feet are on the
gallery under its lid (`scenes/portHost.js` `guardFor`: it stands once they are inside its band `GUARD_HEADROOM` under
the lid and stays while they are within its height and the parapet's reach). AUDIT SHIPYARDS L4-1: a ring over the
iron railing the first tower had, open over its top, let the classic climb (Climbing 10 in 1.63 s), a boosted jump and the enhanced climb with a
vault go over it - a 19.68 m fall - and the lid, standing always, was a floor to a body coming down onto the gallery from
over it.

**The people** (`scenes/portHost.js` `peopleOf`). In the shipyard the SHIPMASTER on his office's porch, the CREWMASTER
behind the crew hall's table, three SAILORS looking for a berth at its open side and two SHIPWRIGHTS at the hull, one up
on the scaffold; at the lighthouse the LIGHTKEEPER by the tower's door. Each a person of the town's own people
(`walkerRace`, the yards' law) in the walkers' idle record and one of the race's four outfits - the sailors' and the
shipwrights' drawn off the place's key (`folkOf`), so every client stands the same people - and each offered its
Morrowind body. The shipmaster, the crewmaster and the lightkeeper are named on the region's bank off a seed of the
town's map id and the place's own salt (`portKeeper` - the yards' one draw, `systems/merchantYards.js` `townKeeper`), and
the shipyard and the crew hall are named for them ("Voss's Shipyard", "Wayrest's Crew Hall"); the lighthouse and the
docks for the town ("The Sentinel Light", "Sentinel Docks" - `portPlaceName`).

## The shipmaster's window

On the shipmaster, the SHIPS board or the hull on the stocks: the plaque names the shipyard, its shipmaster and its
trade, with four rows - **Ships for sale**, **Your fleet**, **Shipwright**, **Refits** - each opening the shipmaster's
window (`ui/shipyardWindow.js`, through the sea fight's door: `ui/naval/navalPlunderDoor.js`'s third slot) on that page; a
press with no row lit opens Ships for sale. On the crewmaster, the CREW board, the notice board or a sailor: **Sign on
hands** - the window's Crew Hall. Info names who they are; Steal takes nothing ("The shipmaster never takes an eye off
his yard"); a shipwright says his work. Too far speaks the street's refusal; the reach is a static NPC's (6.4 m). Its
host half is `scenes/shipyardHost.js` (`model(site, view)` a page, `act(site, verb, ...)` a deed).

**Ships for sale** (`systems/shipyards.js`). Every hull Come Sail Away builds, cheapest first (`SHIPYARD_HULLS`): the
Rowboat, the Large Boat (Mac's Tiny Ship), the Small Ship (Mac's galleon), the Carrack and the Large Galley, at the
mod's own prices (`HULL_PRICES`). Each card gives her length and beam, her crew and the named hands her deck stands
(`playerCrewCount` - none, none, four, five, eight), her guns, her ram, her hull and canvas, and the shipmaster's line on
her; the galley's says no quay takes her. The Rowboat is sold as her PARTS, into the pack (the shelf's own form for her:
she is launched wherever there is water); every other as her DEED, entered in the Fleet's book laid up at this port
(`fleet.js` `titleDeed`) - the window turns to Your fleet with her chosen, and Bring her here brings her round to the quay.
Each is minted as the shelf minted it (`mintDeed`, `mintParts`), its number the host's Come Sail Away UID. A purchase asks
a second press (`CONFIRM_MS`: a double click is one press - AUDIT SHIPYARDS L1-5), and parts the pack cannot take are
refused before a coin is paid (the carry gate's dry run, L1-4). A yard never sells out. With Come Sail Away off, nothing
is sold ("turn it on in the mods' settings and reload" - the switch is latched at a load).

**The price.** The shipyard's counter is a yard's (`YARD_QUALITY`, `YARD_PRICE_INDEX` - the same in every town), haggled
by the counter's one law: `calculateCost`, then `getTradePrice` with the buyer's live Mercantile and Personality, a
ship one piece. A concluded deal - a ship bought, a ship sold - tallies Mercantile as a counter's does (DFU OnTrade).
Online a sale is capped at half the least ask, as at every counter (REALM P0.4, MERC-RISE, MERC-SLOPE), so buying a ship
and selling her back never pays (pinned over the shipyard's own prices, AUDIT SHIPYARDS L6-4); offline, Daggerfall's
haggle stands, as at every counter - at high skills a ship bought and sold back pays, as any item does at any counter.

**Your fleet.** Every ship of the player's (the Fleet's own sweep - `scenes/fleetHost.js` `model`), where she lies, her
worth and the shipmaster's offer for her; Bring her here (a summons - the window makes way and hands the water to the
host, the Holdings page's hand-off, and comes back on this page where the placing would not start), Lay her up, and
her name. **Selling** asks a second press. Her WORTH (`shipWorth`) is what she was bought for - never more than a new hull
of hers costs, so no save's word reaches the counter's 32-bit haggle (AUDIT SHIPYARDS L1-2: past a few million an offer
turned negative) - a claimed prize her papers' value, half what her refits cost in gold (`REFIT_RESALE`), by her hull's
state - a wreck `SALE_FLOOR` (0.6) of it; the offer is never below nothing. The shipmaster buys a ship of the player's
that is HERE - at this port, laid up, or packed - and never one at her helm, afar, fighting, with another player aboard,
with her hands ashore at the player's side (by her number wherever she lies, L1-6), with cargo in her hold, with anything
in her cabin's chests or on its floor (`saleRefusal`, and the host's `cabinHolds` - a dropped pile and a dropped torch
too: a sale let them go with her room, L6-2), or one that came into the realm through customs (`fleetCrossed`, L1-2:
"She came into the realm through customs - the shipmaster does not buy her. She stays yours." - realm customs
(`systems/realmCustoms.js` `applyCustoms`) enters every Come Sail Away ship a crossing save holds, the Fleet's records,
the placed boats and the deeds and parts in its lists, in the Fleet's own save slot (`crossed`), as Daggerfall's deeds
cross kept and unsold). Sold while Come Sail Away's placing is armed with her, the placing is let go (L1-1: the click
placed her again from the item and she sold twice, unbounded - and the placing click itself now places nothing whose
item has left its collection, `systems/comeSailAway/comeSailAway.js` `holdsItem`); a summons lets an armed placing go (L1-9). Sold, a
boat standing in the world
is laid up first by the mod's own law (`LayUpBoat`) - she leaves the water as a ship sent away does; her parts leave the
pack; her cabin is let go as a sold house's room is (`scenes/worldModes.js` `cabinSold`); her title and record leave the
ledger (`forgetShip`), her hurts and crew the sea fight's state (`scenes/naval/navalHost.js` `forgetBoat`), her empty hold's
entry Come Sail Away's (`forgetHold`); the offer is credited - past the purse's carrying, as a letter of credit, as the
counters pay (`sellProceeds`, L1-3: a galley's price was 160 kg of coin).

**Shipwright** and **Refits.** The shipwright's own work on a ship at hand - at this port, at the helm here, or laid up
(`AT_HAND`) - his model the sea fight's (`scenes/naval/navalHost.js` `yardModelOf`: her hull, her canvas, her hands by the
head, her powder and provisions), and her four refit lines (`scenes/fleetHost.js` `offer`, `systems/fleet.js`). A ship
chosen on one page is chosen on the others.

## The crew hall

**The roster** (`systems/crewHall.js` `recruitsOf`). `RECRUITS_A_DAY` (6) sailors at a town's hall each day of the
world's clock, drawn off a seed of the town's map id and the day - every client meets the same hall the same day: each
a NAME on the region's bank, a CLASS of the crews' own (`PLAYER_CREW`), a GRADE - Green, Able, Seasoned, Veteran - with
the fights and boardings he has stood, and a TRADE: the post he signs on for (`CREW_ROLES`; a Bard keeps his calling). A
First Mate is Seasoned at the least, a Bosun Able. His SIGNING FEE is his grade's (180, 260, 420, 700) times his
trade's premium (a First Mate 1.6, a Bosun 1.3, a Gunner and a Carpenter 1.2, a Bard 1.1), to ten gold, never under a
shipwright's hand (`HAND_PRICE`: `REPAIR_PRICE.crew` a man's share of her crew), so no recruit is the cheaper way to
fill her. A sailor already serving a ship of the player's is not on the roster - known by his roster id, saved on the
hand (`hall`), never by his name (AUDIT SHIPYARDS L2-9: a name hid another man); a ship already carrying a hand of his
name refuses him in its own words.

**Signing on** (`enlistPlan`, `scenes/naval/navalHost.js` `enlistHand`). A crewed ship at hand is chosen; a recruit takes a
place on her deck - her crew raised to the share that stands one more named hand (`playerCrewCount`), never past her
whole, mustered without a state (`navalDamage.js` `muster`: a wreck stays a wreck - AUDIT SHIPYARDS L2-5). His CHARGE is
his fee, or the men his place raises her by at the shipwright's price if that is more (`hireCharge`, L2-2: a hire raised
up to eleven men for a six-man fee); the window shows it for the ship chosen. He joins at his trade's post - a First Mate
stands the one she had down to Deckhand - with his record, at her roster's end, and a seasoned man lifts her spirits by
what his `lift` gives, kept on him and taken back when he leaves (L2-4: a hire and a pay-off pumped her spirits past
the port's cap). A ship as she is bought has her whole crew, so a FULL DECK (L7-2: every recruit was refused): there a
recruit signs on IN PLACE OF a hand the player names ("Sign on in place", the newest free hand first), her crew
unchanged, that hand paid off (`swapHand`), at his fee. Never while she fights; a roster turned over at midnight says so
("The crewmaster has a new day's roster" - L2-8); a recruit's words follow the hall's ("X signs on to Y as her Z").

**Paid off** (`releasePlan`, `releaseHand`): a named hand leaves her - never one ashore at the player's side (by his
place in her roster, `awayOf`'s indices - L2-3: read by name, never so) - wherever he stood in her roster, her crew down by
a man's share (`navalDamage.js` `discharge`: no blow, no fire, no state). Where her men still stand as many on her deck
(a galley's sixty stand eight), the man who steps up into the place is NAMED (L2-1: a stranger was minted); her LAST man
is never paid off - crew none, she would strike her colours ("That is the last of her crew"). No fee comes back. Never
while she fights (L2-11). A hand's post is changed from the same page - a Bard's the Fleet's own line, Lookout none - and
he or she is spoken of as the hand is (L7-9). Online, a hire is the hiring client's: a peer draws the hall's seeded deck
for the player's ship, and two players may sign the same named sailor (L2-10, L7-8 - FLAGGED: the wire carries no hall).

## The lighthouse

**The lamp** (`scenes/portHost.js` `lights`, `glows`). In the lanterns' hours (the town's: `lightsOnAt`, 17:00 to 08:00)
the lamp - the beacon's fire - is a scene light at the fire's middle (`LAMP_RANGE`, 28 m), its flames are drawn over
the coals, and the shipyard's office lantern is another light
(`OFFICE_LAMP_RANGE`); its glow and two beams sweeping a full circle one round every `BEAM_PERIOD_S` (14 s) - over the
town too - each `BEAM_PUFFS` added puffs out to `BEAM_LEN_M`, wider and fainter as they go, are drawn as added light in
the sea fight's particle pass (`render/navalRender.js`) from as far as `BEAM_SEEN_M` (2.6 km) - a light a captain sees
from the sea. Each lighthouse's beams turn on their own phase (off its key) of the wall clock (`beamClock`), the same on
every client (AUDIT SHIPYARDS L4-6: each client's own frame clock turned its own sweep); a puff the eye stands in fades
out, whole again at `BEAM_NEAR_FADE` of its size (`nearFade`, L7-12: from the gallery each sweep was a flash). By day,
nothing. A night frame allocates nothing here (L4-2, PERF-LIGHTS' law): the glows' and the lights' records are each
place's own, written in place into arrays cut to their count; a person's idle key and size are read as its frame turns;
the port's twenty-six pictures are painted a few a frame (`ART_BUDGET_MS`, L5-5: at once they were a ~60 ms frame), the
meshes made once all are up and the places standing in the collider meanwhile.

**The stair.** On the lightkeeper or the tower's door: **Climb the tower** - the keeper lets the player up, and the host
stands them on the gallery's sea side facing the sea (`climbLighthouse`, as a boarding places a body). On the hatch on
the gallery: **Climb down** - at the tower's foot, before the door's step by a body's capsule and more (`STEP_CLEAR`,
AUDIT SHIPYARDS L4-4: it stood the player in the step), facing the town. Up on foot alone, never at a helm, never with a
foe about (each refusal the host's own words - `stairRefusal`, `stairFeetY`); down always, so a gallery is never a trap
- onto the drawn ground at the door where it stands higher than the tower's middle. The pool holds a place's collider
back while the player's feet stand on its ground as it first rises - up the lighthouse's hollow tower to half a metre
under its gallery and inside its lantern to its roof's point (L4-5: it stopped at 2.5 m, and a body levitating inside
was sealed in, then shut in the lantern room's glass the first tower had), never feet up on the gallery - and a load stands the pool again at once, after the
loaded player stands and before the frame's first step: a save made on the gallery loads onto its floor.

## The beacon tower (BEACON-TOWER, 2026-10-11, Mac: "The lighthouse model is insanely good but way too modern for daggerfall's lore")

**What was modern.** The first tower was a lighthouse of the age of steam: whitewash and two red bands (a daymark,
painted so a ship tells one light from another by day), a lantern room glazed in iron mullions, a copper dome with its
vent ball, an iron railing round the gallery. The Iliac Bay of 3E 405 lights its coasts as a medieval coast was lit - a
tower of bare stone with a fire on its head, and High Rock's towers wear steep slate cones.

**What it is now** (`world/lighthouseModel.js`). The tower in the port's grey ashlar from its plinth to its head, two
string courses round it (`courses`); its slit windows in leaded panes (`world/portArt.js` `portWindowArt` - they were a
sheet of plate glass with a streak of sky across it, and the shipyard office's windows wear the same panes now); a CORBEL
TABLE, three stepped stones under each of the tower's sixteen faces, carrying the gallery's slab - out to 3.3 m now, to
carry the parapet; a battlemented PARAPET round the walk (`parapetR` its inner face, the line the guard stands just inside;
1 m high, a merlon half a metre over it on every other face - the crenels on the town's and the sea's bearings, where the
hatch is and where the climb comes out facing the sea); on the gallery the open LANTERN - eight faces of stone 0.3 m thick,
each opened by a round arch over a sill 0.75 m high (`ARCH_CROWN`, 2.51 m over the floor), a cornice with the lantern's
ceiling under it, and a slate cone 2.6 m high over eaves 0.26 m out (`LANTERN_H`, 5.6 m to its point) with an iron rod,
a collar and a pennant vane at its point; in the lantern the BEACON - a stone pedestal and an iron brazier on it, its
coals (`embers`) their own light, smouldering by day. The gallery's floor and the slab's underside wear the stone flat off
the world's axes (`section`'s top and foot): each slice wore the whole picture from the middle out, a star of seams.

**The fire** (`buildLighthouseFire`; `scenes/portHost.js` `draw`, `paintArt`). Three crossed sheets of flame over the
coals, each both ways, wearing the port's flame (`portFlameArt`: three tongues on nothing, white-hot at their roots, red
at their tips) - a cutout (`PORT_HOW`: `uploadTexture`'s `cutout`, a texel under half alpha a hole), and the flame and
the coals each their own light (`uploadEmissionTexture`, `white`: lit as the gate's fires and the realm's lights are, at
any hour, by nothing else's light). The flames are drawn only in the lanterns' hours, casting no shadow - the lamp's
light stands in them, AUDIT SHIPYARDS L5-2's law - and are no solid: the collider holds the model and the keeper's box.
The lamp (`LIGHTHOUSE_POINTS.lamp`) is the fire's middle, where it stood; its scene light, its glow and the two sweeping
beams Mac chose for the lighthouse are as they were.

**What did not move.** The plinth, the door with its lintel and step, the slit windows' places, the hatch, the keeper's
cottage with its butt and the oil casks (the beacon's oil now), the footprint, `GALLERY_Y`, the guard's band and lid (on
the parapet's line, lidded in to the lantern's faces), and every point the climb, the guard and the keeper stand on. The
arches' crown stands 0.31 m over the guard's lid - less than a crouching body (`CROUCH_HEIGHT`, 0.9) - so nobody passes
over the lid through an arch, and the walk from the lantern's faces out to the guard's band stands clear of every stone,
all round, up to the lid. The eye names the fire the beacon, and the keeper's words speak of it - its hours, its stair, its
oil under lock (`PORT_TEXT`).

**Seen** in a software render of its own geometry (perspective, depth, the port's own art with its cutout, its own light by
night) from the town, from the sea, from under the corbels and from the gallery into the lantern, by day and by night -
never yet in a port town of the player's.

**Tests.** `test/world/beacontower.test.js` (8): the tower is stone, the battlements, the walk is clear, the lantern is open, the
roof's point is the lantern's top, the fire, the art and the words - on the producer's own model and the real collider's
rays. PIN MOVED: `test/world/shipyards1_place.test.js` (the gallery's spot between the lantern and the parapet; the art's list;
the third mesh the flames), `test/systems/shipyards1_audit_port.test.js` (the gallery holds inside the parapet; the guard's line;
the hollow tower to the roof's point; L5-2's pin the flames' - drawn with noShadow in the lanterns' hours, never by day,
never in the collider). Mutants: `tools/mutants/beacontower.json` (21), every one dead - BEACON-the-tower-whitewashed
survived the first cut of its pin, which read only faces wholly over the cottage's chimney while the shaft is one face
from the plinth to the corbels; it reads every face that rises over the chimney now. `shipyards1.json`'s
SHIPYARDS-the-gallery-to-the-town and `shipyards1_audit.json`'s the-guard-unheld and the-guard-outside-the-rail are
re-aimed at the parapet's name and the-glass-casts at the flames' draw; the-glass-out-of-the-collider is retired with the
glass - its law turned (the flames are no solid: BEACON-the-flames-a-solid) - so `shipyards1_audit.json` holds 72. The
three lists, run again whole: 169 judged, 168 dead and the one survivor above; `beacontower.json` again with its pin
mended, 21 of 21 dead.

## The piers

THE PIER'S DRESS (`systems/naval/quays.js` `pierDress`, `world/quayModel.js`) overhauls every harbour's quays -
`03-World/Holdings.md` section 7: its timbers under the decks and its deck's small fittings drawn and never collided, a
piece's body out of the gangway's lane, the lanterns' light where the berth lies now (AUDIT SHIPYARDS L5-5, L5-6).

## Found as the yards are (SHIPYARDS-FOUND)

- **The talk directory** (`systems/portPlaces.js` `portDirectoryRows`, `scenes/townTalk.js` rebuildDirectory): the
  shipyard, the crew hall (at the crewmaster's table), the lighthouse and the DOCKS (the first berth's quay of the
  harbour the book has sounded off the town's shore, `scenes/world.js` `portPlacesOf`) are rows under keys no building
  holds (`foundBuildingKey`: `YARD_KEY_BASE` and its place in `FOUND_KIND_ORDER`, after the yards' two, so the Stable and
  the Wagon Yard keep theirs). The Where-is page stands a group each - "Shipyards", "Crew halls", "Lighthouses",
  "Docks" (`FOUND_TALK_GROUPS`) - after the yards'; each is asked as a building is (the compass, the knowledge roll, the
  map's mark) - but the crew hall and the docks, which no town map letters, are answered with the way there, never
  "let me mark it on your map" (`lettersOnMap`, AUDIT SHIPYARDS L7-5). The docks' row joins once the harbour is sounded:
  the frame hands the town's places again then, once (`townTalk.setPorts`), waiting on the harbour book's own test -
  `csaIsPortTown` (L3-2: the shipyard's test kept a seat's docks to a second visit and waited for ever on a harbour the
  book never sounds). The rows are `world/portSites.js` `portPlaceRows`'s, the berth's point `sceneToLocationXZ`'s, a port
  by its data `systems/portPlaces.js` `portTownByData`'s and on the open sea `world/portSites.js` `portTownOnSea`'s
  (INLAND-PORTS) - each executed by the tests, never read off world.js (L6-10).
- **The town maps** (`world/merchantYards/merchantYardMap.js` `yardTownBlocks`, `ui/town/townMapDoor.js`): the shipyard's ground in a
  shop's byte, the lighthouse's in a house's (`PORT_MAP_TYPE`), each lettered by its own name. The docks lie out on the
  water past the town's blocks, which is all a town map draws.
- **The Overworld** (`scenes/portHost.js` and `scenes/quayPool.js` `overworldMarks`, `ui/travel/travelViewHud.js`
  `portGlyph`): the shipyard (an anchor), the lighthouse (a tower under its light) and the docks (a bollard on its quay),
  each named, with the Towns switch and never counted a town.

## The shelves

The General Store and the Pawn Shop no longer shelve Come Sail Away's two items, and no counter buys them
(`systems/comeSailAway/comeSailAwayItems.js`, `systems/shopStock.js` `shopBuysItem`) - as MERCHANT-YARDS took the horse and the cart
off the General Store. AssignVariantsToShopItems stands, ported: a shelf a save stocked before is still rewritten
(`03-World/Come-Sail-Away.md`, the shelves).

## The tutorial's pages (TUT1)

TUT1 landed beside this slice, and a slice that changes how a system plays changes its page (`10-UI/Tutorials.md`).
**Sailing** (`ships`) no longer sends the player to a general store: a port's shipyard sells ships - the Rowboat as parts,
any other laid up where she was bought, brought round from the shipyard's Your fleet page (AUDIT SHIPYARDS L7-4: "waits at
the port" - she lies in the book until summoned). **Shipwrights** became **Shipyards** (`shipyard`, "Port towns have a
shipyard by the water" - L7-6: not every port has room): the shipmaster's
trade, the crew hall, and the shipwright reached from the helm as before - and the shipmaster's window pops it as the
shipwright's does (`ui/naval/navalPlunderDoor.js` openNavalWindow: only a prize's hold pops the sea fight's page).
**Lighthouses** (`lighthouse`) is new, popped by a climb up the host made (`scenes/portHost.js` - never the way down,
never a refused stair).

## The four hosts

- `scenes/world.js` - WIRED: each port town's build places the shipyard and the lighthouse on what its yards left and
  carves the people's navgrid round them; the pool (`scenes/portHost.js`) is made beside the yards', framed, drawn - in
  the street and in the view out of a window - its people on the flats' axis and in bodies, its lamps in the lights and
  its beams in the added pass, taken down at a re-anchor and a load (the shipmaster's window shut with it); the hover
  names it; the press is handed to it; the shipmaster's window (`openShipyard`, `scenes/shipyardHost.js` over the
  Fleet's host) and the stair (`climbLighthouse`); the town map, the talk directory and the Overworld's marks are
  handed its sites, and the docks' mark is the quay pool's. Its per-frame work is the host's own functions (`portFrame`,
  `portLightsInto`, `portBodies`, `portBatchesInto`, `portGlows`), never inline in `frame`: PERF-V8's budget
  (`test/scenes/perfv8.test.js` - an inline loop, try or spread put the frame's registers past r123, where every operand goes
  wide; the frame stands at main's register count).
- `scenes/worldModes.js` - WIRED: the street's one ray reaches them (`portTargets`), the `port:` arm (the too-far
  refusal, the plaque's lit row); a sold ship's cabin (`cabinHolds`, `cabinSold`). Its interiors stand no port.
- `scenes/exterior.js` - FLAGGED: the single-town bench stands no port; the streaming host is where its towns are played.
- `scenes/dungeonContext.js` - stands no street: nothing here reaches it.

Nothing is saved or sent: where a place stands is the town's layout, who keeps it its map id, the day's roster the
day's; a ship bought or sold, a hand signed on or paid off, are the Fleet's, the sea fight's and Come Sail Away's own
save data, as they were - a hand carrying his roster id and the spirits he lifted (`hall`, `lift`), the Fleet's slot the
ships realm customs crossed (`crossed`).

## Not seen

This container holds no ARENA2, so no real port was laid out here: the places are proven on synthetic grounds and
seas (`test/world/shipyards1_place.test.js`) and the models in a software render of their own geometry - the shipyard, the
lighthouse and the overhauled quay - never in a Daggerfall town. Where a port's places fall is for the owner's eyes; a
port that finds no room logs it.

## Tests

`test/systems/shipyards1.test.js` - the places, the towns, the keys, the keepers and names, the rows, the stock, the price, no
loop online, what the shipyard takes back, the shelves, the hall's roster, the fees, signing on and paying off.
`test/systems/shipyards1_host.test.js` - the host's pages, buying, the fleet page and selling, the Fleet's acts, the crew hall,
the window's words, the window mounted, the door. `test/world/shipyards1_place.test.js` - the footprints, backing onto the
sea, the bearing, the town's own sea, no room, the models, the art, the pool, the hold-back, the press, the stair and its
page, the plaques, the lamp, the Overworld's marks. `test/systems/shipyards1_found.test.js` - the Where-is page, the answer, the town map,
the docks on the Overworld, the glyphs, the four hosts, the lamp reaching the renderer (`test/yardLightRig.mjs`, the host's
own light composition), the tutorial's pages. `test/systems/naval/piers1.test.js` - the pier's dress. `test/systems/shipyards1_audit.test.js` and
`test/systems/shipyards1_audit_port.test.js` - AUDIT SHIPYARDS's pins (below). `test/world/beacontower.test.js` - BEACON-TOWER's (above).
`test/systems/naval/fb1014_inlandports.test.js` - INLAND-PORTS's: the open sea, the ring, the towns, the host's (and on the real map,
the 106 and the 49). Mutants: `tools/mutants/shipyards1.json` (76), `tools/mutants/shipyards1_audit.json` (72),
`tools/mutants/beacontower.json` (21) and `tools/mutants/fb1014_inlandports.json` (14), every one dead.

## AUDIT SHIPYARDS (2026-10-11, Mac: "Audit everything")

**Method.** Seven cold lanes read the change on a frozen snapshot (`f11716ee7`, a worktree no fix touched while they
read - DO NOT FIX WHILE THE VERIFIER IS READING): the shipmaster's trade (L1), the crew hall (L2), where the places stand
and how they are found (L3), the pool, the frame and the stair (L4), the models, the art and the piers (L5), the record -
every pin and mutant against the code (L6), and the player's journey through it (L7). Every finding was checked by hand -
the HIGHs by their own probes run again (the ghost loop's +189,062 gold a cycle, the light three cells off the yard, the
classic climb over the railing and a 19.68 m fall, the z-fights' areas) - each claim CONFIRMED, PARTIAL or REFUTED, each
proposal ADOPTED, ADAPTED or DECLINED. Every fix is pinned so that the pin fails without it (A PIN MUST FAIL), and the
pins are mutation-checked: `tools/mutants/shipyards1_audit.json` (73), every one dead; `shipyards1.json`'s records the
fixes moved re-aimed by content (12), `quays.json`'s QUAY-pool-lights-far and `csa_placing.json`'s CSA-C-click-no-delay
with them, and every list with a record in a file the audit changed run again (the crew hall's and the placing's regions
of `navalHost.js` and `comeSailAway.js`, every record of the rest): 469 dead. What the rerun found unwatched is pinned -
`csa_items` CSA-H-group-always (L6-11), `audit0928_save` S4-reset-keeps-latch (the shelf rows' retirement had taken its
observable; the latch is read through the mod's effect kind now), `shipyards1` SHIPYARDS-the-deck-unread (a plan handed
her named hands behind her deck refuses) and SHIPYARDS-a-hand-unpaid (re-aimed at the hire's payment, the swap's its own
record). Three ARENA2-TRIAGE-4 records (`townTalk.js`'s question count) survive on main too: main's own, left as they
are.

**The findings and what became of each.**

| Finding | Verdict | Resolution (and its pin) |
|---|---|---|
| L1-1 HIGH: a ship sold while Come Sail Away's placing is armed with her is placed again by the click and sold again - unbounded gold, online too | CONFIRMED | the sale lets the placing go; the placing click places nothing whose item left its collection (`holdsItem`); a summons lets an armed placing go (L1-9). `shipyards1_audit` THE SHIPMASTER'S GUARDS, `csa_placing` |
| L1-2 HIGH: offline buy-and-sell pays; ships cross customs uncounted and sell online for realm gold; a worth past a few millions turns the 32-bit haggle's offer negative | PARTIAL - ADAPTED | the offline profit is Daggerfall's own haggle at every counter (documented, kept); customs enters every crossing ship in the Fleet's `crossed`, and the shipmaster buys none ("She stays yours"); worth capped at her hull's price, the offer never below 0; the INT5 budget is in measure mode, so the judge needs nothing. CUSTOMS CROSSES THE FLEET, NO LOOP ONLINE OVER THE SHIPYARD'S OWN PRICES |
| L1-3 MEDIUM: a galley's price paid as 160 kg of coin | CONFIRMED | `sellProceeds`: a letter of credit past the purse's carrying |
| L1-4 MEDIUM: the Rowboat's parts into a pack that cannot take them | CONFIRMED | the carry gate's dry run before a coin is paid (`SHIPYARD_TEXT.heavy`) |
| L1-5 MEDIUM: a double click buys two ships | CONFIRMED | a purchase asks a second press, the first `CONFIRM_MS` of it ignored (THE WINDOW MOUNTED) |
| L1-6 MEDIUM: the hands-ashore refusal and forgetting the boat skipped for a packed ship or with Naval Combat off | CONFIRMED | by her number wherever she lies; forgotten whatever runs |
| L1-9 LOW: a second Bring her here while a placing is armed does nothing | CONFIRMED | with L1-1 |
| L2-1 HIGH: a pay-off on a deck at its cap minted a stranger | CONFIRMED | the man who steps up is named; the last man is refused (PAID OFF OVER THE REAL SEA) |
| L2-2 MEDIUM: a hire raised eleven men for a six-man fee | CONFIRMED | `hireCharge`: the fee or the raise at the shipwright's price, the more (A HIRE'S PRICE) |
| L2-3 MEDIUM: the crew page's ashore flag read by name off a list of indices | CONFIRMED | by index |
| L2-4 LOW: hire and pay-off pumped her spirits past the port's cap | CONFIRMED | the lift kept on the hand, taken back as he leaves |
| L2-5 LOW: a hire's crew-only repair refloated a wreck | CONFIRMED | `muster`: no state |
| L2-6 MEDIUM: nothing drove the real `enlistHand`/`releaseHand` | CONFIRMED | pins over the real sea fight (`test/navalSea.mjs`) |
| L2-7 LOW: a Bard's posts, the hands drawn over the hall's header, "Small Ship 'I''s Deckhand" | CONFIRMED | the Fleet's own post line; the order; "signs on to X as her Y" |
| L2-8 LOW: a day turned mid-visit said "signed on elsewhere" | CONFIRMED | "a new day's roster" |
| L2-9 LOW: a name hid another man | CONFIRMED (0.3% of days) | the hand carries the recruit's id; a same-ship name clash refused |
| L2-10, L7-8 LOW: online, a hire is the hiring client's | CONFIRMED | FLAGGED (below) |
| L2-11 LOW: hire and pay-off while she fights | CONFIRMED | refused, as a sale is |
| L3-1 HIGH: on a bearing the light stood beside the yard | CONFIRMED | `LIGHT_APART_K` 0.5 (THE LIGHT STANDS OFF THE YARD ON A BEARING: 30+ cells, was 14.5) |
| L3-2 LOW: the docks row waited on the shipyard's test | CONFIRMED | the harbour book's own (`csaIsPortTown`) |
| L3-3 LOW: `townPlacesFor` asked twice a port town's build | CONFIRMED | once |
| L3-4 LOW: three comment slips | CONFIRMED | mended |
| L3-5, L6-10 MEDIUM: the rows, the port byte and the stair's law pinned by world.js's text alone | CONFIRMED | pure helpers, executed (`portPlaceRows`, `sceneToLocationXZ`, `portTownByData`, `stairRefusal`, `stairFeetY`) |
| U2: a lake inland read as the sea | ADOPTED | a body against the map's bearing is no sea (NO POND IS THE SEA AGAINST THE MAP) |
| L4-1 HIGH: the classic climb, a boosted jump and the enhanced climb went over the railing | CONFIRMED - ADAPTED | the lane's closed corridor, lidded - stood only while the feet are on the gallery under its lid, since the lid standing always was a floor to a body coming down (THE GALLERY HOLDS, over the real collider and motor; THE GUARD IS NO FLOOR) |
| L4-2 MEDIUM: ~16 KB a frame a lit lighthouse, 2.2 KB the frame | CONFIRMED | records in place, arrays cut to their count (`length = 0` trimmed and regrew them), no Set a frame, no `Math.hypot` (three arguments allocate in V8), keys and sizes read as an idle frame turns (A NIGHT FRAME ALLOCATES NOTHING HERE: 16, 13 and 0.1 bytes a call, a control at 96) |
| L4-3 LOW: the window over a re-anchor | PARTIAL (a load was main's DUPE-LOAD's) | `closeShipyard()` in `navalClear` |
| L4-4 LOW: the way down stood the player in the door's step | CONFIRMED | `STEP_CLEAR` (THE WAY DOWN CLEAR OF THE STEP) |
| L4-5 LOW: a body levitating in the hollow tower sealed in | CONFIRMED - ADAPTED | held back to half a metre under the gallery, and in the lantern room to its dome's top - the lane's line alone popped the body into the glass (THE HOLLOW TOWER HOLDS NOBODY; BEACON-TOWER: in the open lantern to its roof's point) |
| L4-6 LOW: a dead `eye`; each client its own sweep | CONFIRMED | dropped; the wall clock (THE BEAMS TURN ON ONE CLOCK) |
| L5-1 MEDIUM: the gables in their roofs' planes | CONFIRMED | under the roofs - and the hall's eaves beam, the scaffold's inner posts, the hatch's lid, found by the pin (NO Z-FIGHT) |
| L5-2 MEDIUM: the lamp's glass and lens shadowed its own light | CONFIRMED | a mesh of their own, drawn `noShadow`, still collided (BEACON-TOWER: the beacon's flames are that mesh now - drawn `noShadow` in the lanterns' hours alone, never collided; THE BEACON'S FLAMES CAST NOTHING) |
| L5-3 LOW: props through props | CONFIRMED | each - and the capstan's bars through the scaffold's posts, found by the pin (PROPS CLEAR OF PROPS, THE LIGHTHOUSE'S PROPS) |
| L5-4 LOW: PIER_SALT's claim unpinned | CONFIRMED (true over 18 berths) | a berth's cargo is main's, number for number |
| L5-5 LOW: the art at once; the whole dressed quay collided; the lanterns made every night frame | CONFIRMED | a few pictures a frame; the collider the solid part; the lights a berth's, made as it moves - and off its live place, since the plan's was stale after a recentre (THE ART A FEW PICTURES A FRAME; THE PIER'S COLLIDER IS ITS SOLID PART) |
| L5-6 LOW: a stale comment; the lantern's point a literal; a fender's body in the lane | CONFIRMED | `SHIPYARD.lantern`; a piece's body out of the lane, the coils' too |
| L6-2 HIGH: a sale let go what lay on her cabin's floor | CONFIRMED | counted, refused |
| L6-4 MEDIUM: "no loop online" never ran the shipyard's own path | CONFIRMED | pinned over `shipBuyPrice`/`shipSalePrice` with the page online |
| L6-5 MEDIUM: the roster's tables weakly pinned | CONFIRMED | deepEqual'd; every trade and grade seen over 300 days |
| L6-6, L6-7, L6-8 MEDIUM: the host's guards, three pages and the keeper's climb unpinned | CONFIRMED | each driven through `act`, mounted, climbed |
| L6-9 MEDIUM: the pier's numbers read back off its own constants; the yard-alone case never ran | CONFIRMED | counted off the model's faces; a ground that fits the yard alone; the road's pull |
| L6-11 MEDIUM: CSA-H-group-always survived (the switch feeds one effect kind now) | CONFIRMED | WaterWalkingSilent's kind pinned off, on and latched off (`csa_items`) |
| L6-12, L6-13, L6-14 LOW: the patch notes' and this page's words | CONFIRMED | mended (shingle, stands, BRACE_LOW's 1.1, the shelves in the past, the lamp's hours, the full circle) |
| L7-1 HIGH: the empty Fleet and the mod's setting sent the player to a general store | CONFIRMED | the shipyard (THE WORDS SEND THE PLAYER TO THE SHIPYARD) |
| L7-2 HIGH: a ship as bought has a full deck - every recruit refused | CONFIRMED | the swap (THE CREW HALL OVER THE REAL SEA) |
| L7-4 MEDIUM: "she waits for you" - she is laid up | CONFIRMED | the window turns to Your fleet with her chosen; the Sailing page says so |
| L7-5 MEDIUM: "let me mark it on your map" for places no map letters | CONFIRMED | the way there (NO MARK THAT MARKS NOTHING) |
| L7-6 MEDIUM: "every port town has a shipyard" | CONFIRMED | "Port towns have"; what fits stands |
| L7-9, L7-10, L7-11 LOW: the hand's pronoun, "parts is", "turn it on" without a reload | CONFIRMED | mended |
| L7-12: a puff flashed past the gallery's eye each sweep | ADAPTED | puffs fade as the eye comes into them |

**Open flags.** Online hires are the hiring client's (L2-10, L7-8): a peer draws the hall's deck off the seed for the
player's ship and two players may sign one named sailor - the wire carries no hall; a fix sends a hire as a ship's own
record. Quays and the port's places (U1): a harbour's quay might be laid across a shipyard's ground - unseen without
ARENA2; a fix closes the berths' plans on the port's sites. Adjacent ports' harbours (U3): the harbour book sounds the
port near the player's pixel and its neighbours' (`navalHarbourNear`) - as it was, noted only.

FIELD BUGS 2026-10-16b YARD-ROWS: the fleet page's rows stood a ship's words a word a line - the presses' track was `auto`;
it is `fit-content(40%)` now, and a fleet row carries her presses on a line of their own under her words, as the
Holdings card does. The record: `01-Overview/bugs/Field-Bugs-2026-10-16b.md`.
