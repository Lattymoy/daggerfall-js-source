# Passage under sail (PASSAGE)

THE PORT'S OWN (2026-10-19). The owner: *"Add the ability to buy and ride a friendly boat (if one is docked) at any
port. You can have the ability to choose where you want to sail. A new form of immersive travel."*

Daggerfall's ship passage is a fast travel: the travel map's "By ship", a fare, the days counted down, and the player
set down at the far port (DaggerfallTravelPopUp, priced by TravelTimeCalculator.CalculateTripCost; the port's
`ui/travel/travelPopUp.js` and the Overworld's SHIP-SAIL offer, `06-Systems/Travel-View.md`). Immersive Travel's ship
captain is the same jump from a docks-only map, and no block the mod ships stands one (`06-Systems/Immersive-Travel.md`).
The port already had every other piece: friendly ships moored at every port's quays (SHIP-LIFE, `navalHost.js`
harbourFrame), Come Sail Away boats a journey can sail (OWS2, `06-Systems/Travel-View.md` "OWS2 - the crossing"), and
the Overworld that carries a journey across the map at its own pace. Nothing let a player pay one of those ships and
ride her. PASSAGE is that link: **the voyage is sailed, never jumped.**

## The ship

A harbour's OWN ship (`passageBerths.js` passageShip - the sea's half, a module the naval host wires): one of the
merchantmen and crown's ships the port stands at its berths each day, lying moored there - never a packet on her lane
(she keeps her timetable), a prize, a ship fading out of the sea or one already under way. Moored is her own errand's
berth when I stand the port; when another player stands it, her copy carries no errand on the wire, so she is found
lying still at a berth of a harbour I know (`mooredAt`; AUDIT PASSAGE B5). She must be friendly (`stanceOf`: a lawful
master, and no crown's hunt on me - a captain the navy is chasing finds no navy ship to carry them), and of a hull that
carries a passenger (`passage.js` PASSAGE_HULLS: the Large Boat, the Small Ship, the Carrack - never the Rowboat, whose
lone rower tires a kilometre out, and the galley never moors) and crosses a sea under this helm (the naval host's
`passageCrosses`, OWS2's own law: a Carrack under the Classic handling makes no way, AUDIT PASSAGE B7). The look's ray
must strike HER HULL within PASSAGE_RAY_M (8 m) of the eye (AUDIT PASSAGE B6: a cone 60 degrees wide took the quay's
presses meant for its people, nodes and wagons from 18 m); then she says so once ("The Fair Silk lies at her berth -
Activate to book passage.") and Activate is hers - after my own ship's gangway, which stays the first press at a quay.

No ship moored, no passage: the ask's own "if one is docked".

## The booking

Activate asks her master's ports (`passageHost.js` offer) - a list picker of every port the player knows
(`passage.js` passageDestinations: the travel map's own law, a place never discovered has no name to sail for), never
the port they stand at nor one within VOYAGE_LANDFALL_PX of them (she would set them ashore there at once - it is
walked to), nearest first and then by name, each with the wind it lies on and its fare
("Sentinel - east, 50 gold"). A port picked asks once more, the fare beside the purse, and says the rule
("Her master sails you there. Step off her and the passage ends."). Nothing is paid until she sails.

THE FARE (`passage.js` passageFare) is Daggerfall's ship - CalculateTripCost's travelShip arm, 25 gold for every 24
ocean pixels and 25 more (`travel.js` calculateTripCost, the one copy) - with every pixel of the voyage counted as sea,
the longest axis as Daggerfall's travel walk counts it. The departure, named: DFU pays the ship only for the ocean its
straight line crosses (a voyage round a headland pays little), and this passage sails the whole way; and DFU's arm is
free to a player who owns a ship (`hasShip`), where a passage on another's ship is paid whatever ships the passenger
owns. No inn is paid: a passenger sleeps aboard.

Yes (`passageHost.js` book) makes the passage ALL OF IT OR NONE OF IT: the purse, the journey's own gate
(`travelViewCanGo` - no foe near, no wall underfoot, not another's passenger), then her boat (`navalHost.js` charter:
Come Sail Away's boat of HER hull placed at HER berth as she lies, from a deed minted for the voyage and never put in the
pack or the Fleet's book; the voyage's record written on it), her helm taken, and the journey begun to the port
(`travelViewRouteTo` with `voyage`). Only then is she let go from the sea (`passageBerths.js` charterSailed - her boat
stands in her place, she is taken over first if another player stood her, and she is not stood at her berth again
today) and the fare paid (`court.js` deductGold: coins, then letters of credit). A journey refused puts everything back:
her boat gone, the player where they stood and riding as they rode (the helm puts a rider on foot), no journey left
aimed at her, nothing paid, she still at her berth (AUDIT PASSAGE A7).

A VOYAGE IS SAILED (AUDIT PASSAGE A1). The planner prices a road step under a sea step, so from her helm the cheapest
way to a port on a coast road was to come ashore at once and walk - the passenger was set down at the quay they paid
to leave. Asked for a voyage (`travelRoute.js` `sea.voyage` - every journey from a booked ship's helm asks one,
`world.js` tvSeaMeans), the planner brings her ashore only within VOYAGE_LANDFALL_PX (3 map pixels, SEA-LANES'
ROADSTEAD_PX - a port's roadstead) of the port, and a booking's plan that never sails is refused ("Her master knows no
way there by sea from here.").

## The voyage

The voyage is the Overworld's crossing (OWS2), unchanged: the journey's hand on her helm - the rudder, the sails, her
crew's oars - and Come Sail Away's own sailing moves her. THAT HAND ALONE (PASSAGE-HANDS, `01-Overview/bugs/Field-Bugs-2026-10-21d.md`):
while her boat carries a charter and the voyage is under way, her rudder, oars, sails and trim answer her master's hand
and nothing the passenger presses - keys, the helm panel or the pad (`scenes/naval/passageHelm.js` passengerHelm, the
host's seam wrapped) - and her lantern stays as it was lit; the passenger keeps stepping from her helm and the time dial,
and her panel is a passenger's card ("The Fair Silk, bound for Wayrest - her master steers") with those two on it, as the
pad's prompts say them. When the voyage halts - a foe near, aground, the twenty seconds between her master's tries - her
helm is the passenger's until he takes her up again (AUDIT FB1021d PS-2), so a raider met on the way is met as any ship
of mine meets one. A sailed leg is aimed where the built ground floats her (`systems/travel/seaMark.js`): a pixel built
dry is passed for the next leg, and one not built when its leg begins is aimed again once it is (AUDIT FB1021d PS-1);
from her own port's roadstead her master's resume runs her in (`passage.js` voyageSails - PASSAGE-IN). On the enhanced interface the Overworld is raised over it as
over every journey; under First Person Travel it is sailed from her helm. Her hands are aboard (a fresh crew state,
every hand), so a raider met on the way is met as any ship of mine meets one. Time passes as the journey's does.

A voyage stopped with the player still aboard - a foe near, a raider's chase, a load that put them back at her helm -
is SAILED ON by her master (`passageHost.js` frame), for as long as they stand aboard: each PASSAGE_RESUME_S (20 s),
and after PASSAGE_FIRST_S the first time a host meets her boat - a load, a boot (AUDIT PASSAGE A4: the clock is her
boat's, never the last voyage's). A foe near spends no try - it is what she waits out (A3). PASSAGE_RESUMES tries in a
row that find no way and he says so once ("he will try again. Step ashore to end the passage") and tries on at
PASSAGE_SLOW (3) times the pace; a way found, the count starts again. He never gives her up while a passenger stands
aboard (AUDIT PASSAGE B3: three resumes and he stood down, and a fare of 25 gold kept a crewed ship with her guns for
good). On her deck away from the helm he asks for it, once ("her master steers from there").

HER MASTER HOLDS HIS COURSE (AUDIT PASSAGE B3): a journey begun from her helm to anywhere but her port - another place,
a spot on the Overworld - is stopped ("Her master holds his course for Sentinel.") and he sails on for her port soon
after.

THE ARRIVAL is OWS2's landfall: she runs in on her oars, the helm is left, the player is set on the first dry ground
by her bow, and the land legs are walked on into the port. OWS2's "left moored" is not said of her - she is not mine to
leave.

## The end

Step off her and the passage is over (`passageHost.js` end): not aboard, past PASSAGE_LEAVE_M (20 m) beyond her hull's
own reach from her root (`hullReach` - a Carrack's helm stands 19.5 m aft of it), for PASSAGE_OFF_S (1.5 s) together -
ashore at the far port, over the side, through a door, by a jump. Aboard is her helm, her deck underfoot, or the naval
host's `boatInPlay` - the boat I boarded another ship from while I fight on that one's deck (AUDIT PASSAGE A2/B2: a
jump on her forecastle, or a boarding fight 16 m off her, laid her up under the player at sea); and nothing is judged
through a world's move. Come Sail Away lays her boat up first (her hold moved under her number, as every ship's is),
then her hold comes into the pack ("What you put in her hold is carried off her.") and her number's hold and sea-fight
record are forgotten, and she stands out to sea. While another player stands aboard her, she waits for them - and
nothing has moved (AUDIT PASSAGE A5).

## What she is not

She is her master's ship, never the player's:

- Never the Fleet's (`fleetHost.js` placed): no ledger record, so the shipmaster neither lists nor buys her
  (`03-World/Shipyards.md`).
- Never packed into parts (`comeSailAway.js` PackBoat refuses her, and her boat never packs - `navalHost.js` charter,
  and the passage's frame after a load - so the crossing never plans a second launch of her).
- Never boarded by another journey as "mine moored within reach" (`world.js` tvSeaMeans) - only her booking boards her.
- Never the DFU bank ship's cabin (`boatCabinOwnership.js` bankCabinCandidates: she was the one candidate, the furnished
  cabin moved into her and was lost when she sailed on - AUDIT PASSAGE B1), and no sailing cabin of mine
  (`sailingCabin.js` hasSailingCabin - what was put in it went with her, B4).
- Saved with her voyage (`comeSailAway.js` getSaveData's `Charter`, read back by its restore), so a load mid-voyage
  finds her at her helm and her master sails on; a record that reads as nothing (`passage.js` charterRecord) sails
  nowhere and ends when the player is off her - never laid up under them (A6).

Online: a harbour ship another player stands is booked too (found by her berth), and taken over at the booking, as a
boarding takes her; her boat is a boat of mine on the wire, so another player may ride her as a passenger (CSA-K).
HER LETTING GO IS EVERY PLAYER'S (AUDIT PASSAGE B5): her seed rides the naval word (`navalWire.js` `q`, the last
NAVAL_WIRE_GONE, said on by every reader - `passageBerths.js` noteGone): the copy lying at her berth on another screen
fades out as her boat stands in her place, and no player stands her there again that day, takes her over there while
she fades or keeps a copy of her, whoever stood her and whoever booked her. Before, her letting go was the booker's
alone: the next player to stand the port stood her at her berth again, bookable a second time. A player who never
hears a word that says her (the booker gone from the room before they came, and nobody since who heard it) may still
stand her - as a spent packet (AUDIT BAY A18).

## Clear of other ships (FERRY-CLEAR, 2026-10-24)

Discord, "Ferrys still unstable": *"Had several issues with the ferry ramming a neighbour ship till it broke, or running
ashore."* Read in the code, the ramming was two faults together:

- **Her master's hand saw only water.** The crossing's hand (OWS2, `world.js` tvSeaSail over `systems/seaHelm.js`) looked
  for land along her bow, her beam and the mark's lane, and nothing else. A booked ship lies along the shore's line,
  and the next berth's ship can lie on it a quarter of a hull's length past her stem (`shipLife.js` BERTH_SPACING, 1.25
  lengths centre to centre); a first mark along the coast sent her straight into it. Now a ship's hull is as land to the hand: each of those looks stops at the
  first hull of the sea's ships afloat, HULL_CLEAR_M (6 m) off her side (`systems/naval/seaClearance.js` hullAlong,
  handed the sea's ships by the naval host - `navalHost.js` `hullAlong`), and the hand turns off it to the freer hand
  and holds clear of it as it does an islet (AUDIT SHIPS A2's law, unchanged). Her centreline's look stays land's alone:
  the landfall's "shore ahead" is the shore, never a ship lying off it. A look that starts within a ship's clearance
  (alongside her) stops at her side and lets a look away from her go. Every crossing's hand has it - a booked ship's and
  the traveller's own boat's.
- **Her stem rammed as a boat of mine does.** The naval host's ram (`checkRams`, AUDIT NAV1 H11) counts the boat at the
  player's helm, and a booked ship's boat is that boat: a ram's damage every RAM_COOLDOWN_S of the sea's clock, 0.6 of it
  back on her, the other ship fouled - and the passenger charged with piracy for it. A booked ship's master never rams
  now: her stem in another's side deals nothing and takes nothing back (Come Sail Away's collider still stops her there).

Running ashore, as read and left: THE ARRIVAL is the landfall by design (The voyage, above) - she runs in on her oars
anywhere within VOYAGE_LANDFALL_PX of her port, never to a quay there; berthing her at her port's quay is its own
slice. Between the marks the hand's look is the only thing keeping her off land (the marks float; the run between them
is not traced), and once beached Come Sail Away holds her where she lies - PASSAGE-PACE's ground outrun at x60
(`01-Overview/bugs/Field-Bugs-2026-10-21d.md`) is still the next slice's. The x60 is RATE-LAW's, the owner's.

Pinned by `test/systems/auditships_sail.test.js` FERRY-CLEAR (world.js's own hand lifted over Come Sail Away's real
runtime: a ship moored dead ahead on her line, one across her leg and one off her bow, a galleon and a Carrack in three
winds - eighteen arrivals, none of her ever inside either ship) and `test/systems/naval/ferryclear.test.js` (the real
naval host: a booked ship's stem rams nothing, a boat of mine still does; the sea's ships handed to the hand);
`tools/mutants/ferryclear.json` (8, all dead). Not a DFU member; Ledger A (PASSAGE).

### AUDIT FERRY-CLEAR (2026-10-25)

The owner: *"Audit"*. A cold lane on a frozen snapshot of the branch, given the ask and the files and never this
record, lifted world.js's own hand over Come Sail Away's real runtime where FERRY-CLEAR's test had not gone - a
landfall, a departure from a berth, ships under way - and measured. Each finding below failed on the snapshot and
passes now. The lane's own measures (Come Sail Away's collider answering the ships' boxes), rerun on the final tree:
a landfall past a ship moored off its shore lands, 8 of 8; a departure from a berth with the shore beside her and the
next berth's ship off her line arrives clear, 16 of 16, and from a row of berths along the shore, 32 of 32; a ship met
head on or overtaken, 24 of 24 clear; a ship crossing her course overlaps her on 3 legs of 108 (38 on the snapshot),
and one more stopped for no way.

- **F1 - a landfall rowed in through a ship moored off its shore.** The landfall's line was never looked along, and its
  "shore ahead" let her run in to whatever stood there. The hand keeps the land and the hulls apart now: a hull close
  ahead (`hullAhead`, `systems/seaHelm.js`) turns her off on every leg, a landfall's too, and a landfall's line to its
  mark is read for its hulls alone (`world.js` tvSeaLandAlong's `'only'`) - the land a landfall runs in to is its
  shore, a ship lying off it never is. The hulls are looked for from her bow and either beam (her middle's look is her
  bow's, behind it - measured the same on every leg, so it is not kept).
- **F2 - a departure froze beside the shore.** With the shore under a node of hers, Come Sail Away will not raise her
  sails (`CanSail`), and the hand asked for sails and no oar: she held a heading under neither, and nothing woke her.
  Sails wanted that cannot be raised are the oars' now (`seaHelmStep`'s `row`). And the freer side was asked of the
  land alone, so she turned for the shore-free side into the next berth's ship: a ship's side is no freer water.
- **F3 - a boat of mine or a peer's at the next berth was water.** The hand saw the sea's ships alone. The hulls about
  her (`seaClearance.js` createSeaHulls, the naval host's one list) are the sea's ships afloat, other players' boats at
  their helms and my own other boats - never a sunk one, never the boat at my helm.
- **F4 - a ship under way was looked for where she stood.** A ship crossing her course met her hull where the hand had
  seen water. The hand's looks find a ship under way, and a peer's boat, where her way carries her too: her box and
  its copies HULL_LEAD_STEP_S (2 s) apart out to HULL_LEAD_S (8 s), while she makes HULL_LEAD_MIN_MPS (0.5 m/s) or
  more (`ledHulls`). The aim camera's ships alongside are the same list as they stand (Naval-Combat AIM-ENDS A5).
- **The pins themselves.** F2's oars row her off an edge she runs onto, so "she arrived" stopped telling whether her
  beam was looked along at all: AUDIT SHIPS A2's islet legs now hold that no node of hers is ever over the islet (her
  beam unlooked: 24 of 72 legs touched it), and FERRY-CLEAR's ships and F1's landfalls that every node of hers keeps
  HULL_CLEAR_M off a ship's hull (her beam hull-blind passed 2.3 m off; a landfall's line unread, 2.7-5.4 m).

Left, each with its reason: the three crossings of 108 that still meet her and the one that stopped - a ship
crossing her course: the hand looks for her where her way carries her (F4) and these legs meet her still - why each
does is the next slice's to measure, not this audit's to guess. A quay or a pier is neither water's edge nor a hull to the hand (the terrain's water test
reads the ground; a pier is a model) - berthing her at a quay is the passage's own next slice, above; another ship's
ram (a galley's, `checkShipRams`) can still strike a booked ship - the sea's fights are not the passage's to switch
off; and a passenger can still lay and fire her guns while her master sails her - whether a passage takes them is the
owner's call, not an audit's.

Pinned by `test/systems/auditships_sail.test.js` AUDIT FERRY-CLEAR (F1, F2, F4 on the lifted hand) and the tightened A2
and FERRY-CLEAR pins, and `test/systems/naval/ferryclear.test.js` AUDIT FERRY-CLEAR F3/F4 (the hulls about her);
`tools/mutants/ferryclear.json` (17, all dead) and the re-aimed records of `auditships_sail.json` and `hostsplit.json`.

## The words

Every word the passage says is the text core's (`t('passage.*')`, L10N4 - the eight winds of a port's row too),
drafted in-session for the thirteen whole languages (`locales/README.md`).

## The four hosts

`scenes/world.js` wires it (the passage host built once beside the shipyard's, its frame at the head of the sea's frame
whatever the sea fight's switch says, the sea's door to it) - the world's own doors handed as they are and the purse and
the pack the player entity's own (`passageHost.js` reads `court.js` itself): at main's merge of 2026-10-19 LEGIBLE's
logical-line ceiling found bootWorld 31 over with the first wiring, and the trim took it back under
(`01-Overview/Host-Split.md`, PASSAGE's merge); `scenes/naval/navalHost.js` wires the sea's half
(`passageBerths.js` - AUDIT PASSAGE D-M1: it grew createNavalHost's own scope, and moved out to its wiring; B5's word
read and said, its roll and take-over asked, are lines of that wiring). `scenes/exterior.js`, the fixed-city bench, stands no
harbour ships - no passage there. `scenes/worldModes.js` (interiors) and `scenes/dungeonContext.js` stand no sea.

## Pins

`test/scenes/naval/fb1021d_passage.test.js` (FIELD BUGS 2026-10-21d: her master's hand alone, the passenger's card, the roadstead, the sea's marks on the real map, the ship's plate under the journey's controls), `test/systems/naval/passage.test.js` (the law, and the planner's voyage), `test/scenes/naval/passagehost.test.js` (the
booking, the voyage's life, the end, the wiring), `test/scenes/naval/passagesea.test.js` (the ship at her berth, her
boat, her letting go - the real naval host and pool, two players' rooms), `test/systems/comeSailAway/passage_csa.test.js` (the save and the
pack, the real runtime), `test/scenes/naval/passageaudit.test.js` (the cabins, the world's audit doors);
`tools/mutants/passage.json` (93: 91 dead, 2 recorded equivalent). FERRY-CLEAR's are in its section above. The audit: `01-Overview/audits/Audit-Passage-Batch-Salvage.md`.

Not a DFU member. Ledger A (PASSAGE).
