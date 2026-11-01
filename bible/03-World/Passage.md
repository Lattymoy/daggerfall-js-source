# Passage Under Sail

A player can pay a friendly ship moored at any port and ride her to a port they know. The voyage is sailed by her
master on the Overworld, never jumped. The player meets it by looking at a harbour ship at her berth: "The Fair Silk
lies at her berth - Activate to book passage."

## How it works

- **The ship** (`src/scenes/naval/passageBerths.js` `passageShip`). One of the harbour's own merchantmen or crown's
  ships lying moored at a berth today: never a packet on her timetable, a prize, a fading ship or one under way. She
  must be friendly (a lawful master, no crown hunting the player), of a hull that carries a passenger
  (`src/systems/naval/passage.js` `PASSAGE_HULLS`: Large Boat, Small Ship, Carrack), and able to cross a sea under the
  current helm handling. The look's ray must strike her hull within `PASSAGE_RAY_M` (8 m). The player's own gangway
  stays the first press at a quay. No ship moored, no passage.
- **The booking** (`src/scenes/naval/passageHost.js`). Activate lists every port the player has discovered
  (`passageDestinations`), never the one they stand at or one within the landfall reach, nearest first, each with its
  wind and fare. The fare (`passageFare`) is Daggerfall's ship fare (`src/systems/travel/travel.js`
  `calculateTripCost`, travelShip arm) with every pixel of the voyage counted as sea. No inn is paid. Booking is all or
  nothing: purse, the journey's gate, her boat chartered at her berth (Come Sail Away's boat of her hull, from a deed
  minted for the voyage), her helm taken and the journey begun. Only then is she let go from the sea and the fare paid.
  A refused journey puts everything back.
- **A voyage is sailed.** From a booked ship's helm the route planner brings her ashore only within the port's
  roadstead (`VOYAGE_LANDFALL_PX`), and a plan that never sails is refused.
- **The voyage.** The Overworld's crossing moves her by Come Sail Away's sailing. While under way her rudder, oars,
  sails and trim answer her master alone (`src/scenes/naval/passageHelm.js`); the passenger may step from the helm and
  use the time dial. When the voyage halts (a foe near, aground, between tries) the helm is the passenger's. Sailed legs
  aim where the built ground floats her (`src/systems/travel/seaMark.js`). A stopped voyage is sailed on every
  `PASSAGE_RESUME_S` (20 s) for as long as the player is aboard; after `PASSAGE_RESUMES` failed tries he says so and
  tries at `PASSAGE_SLOW` times the pace. He never gives her up while a passenger is aboard, and holds his course for
  her port whatever journey the passenger asks.
- **Clear of other ships.** Her master's hand treats every hull afloat (the sea's ships, other players' boats, the
  player's other boats) as land, `HULL_CLEAR_M` off her side, and looks for a ship under way where her way carries her
  (`src/systems/naval/seaClearance.js`). A booked ship never rams: her stem deals and takes nothing.
- **Her port's quay** (`src/scenes/naval/passageQuay.js`). Within `BRING_IN_M` (700 m) of her port's harbour mouth
  with a free berth, her crew warp her along a water path clear past her beam to the berth at `TOW_WAY` (4 m/s), and
  the passenger takes the gangway ashore. A still hull or land ahead for `TOW_FOUL_S` (40 s), or `TOW_WAIT_S` (120 s)
  in all, gives the quay up and she makes a landfall instead.
- **The end.** Stepping off her ends the passage: off her hull's reach by `PASSAGE_LEAVE_M` (20 m) for
  `PASSAGE_OFF_S` (1.5 s). Her hold comes into the pack, her record is forgotten and she stands out to sea.
- **The writ.** A province start's commission is the crown's writ of passage to Daggerfall: while its quest runs with
  the seal broken, the city of Daggerfall is listed "by writ" at no fare (`src/scenes/startsHost.js` `writ`). From a
  port past the Bay the voyage is planned by the sea lanes.
- **Pace.** The journey's leads are sized by the traveller's own pace, the boat's way where it is more
  (`travellerPace`), so a fast hull does not outrun the streamed pixels.

## Rules

- Buy and ride a friendly boat, if one is docked, at any port, choosing where to sail: a new form of immersive travel
  (the owner). The voyage is sailed, never jumped.
- She is her master's ship, never the player's: not in the Fleet's ledger, never packed into parts, never boarded by
  another journey, never the bank ship's cabin. Her voyage is saved (`Charter` in Come Sail Away's save data).
- Online a harbour ship another player stands can be booked and is taken over at the booking. Her letting go rides
  the naval word, so no player stands her at her berth again that day.
- Tamriel: every port the player knows is a destination, past the Bay included.
- Every word is the text core's (`passage.*`).

## Daggerfall Unity

DFU's ship passage is a fast travel priced by `TravelTimeCalculator.CalculateTripCost`. Departures (PASSAGE): the voyage
is sailed; the fare counts every pixel as sea, where DFU pays only for ocean crossed; and a passage is paid whatever
ships the passenger owns, where DFU's ship arm is free to a ship owner.

## Code and tests

- `src/systems/naval/passage.js` - hulls, fare, destinations, words
- `src/scenes/naval/passageHost.js`, `passageBerths.js`, `passageHelm.js`, `passageQuay.js` - booking, berths,
  helm, tow
- `test/systems/naval/passage.test.js` - the law and the planner's voyage
- `test/scenes/naval/passagehost.test.js`, `test/scenes/naval/passagesea.test.js` - booking, voyage, end, two rooms
- `test/scenes/naval/fb1021d_passage.test.js` - her master's hand alone
- `test/scenes/naval/passagequay.test.js` - the tow to the quay
- `test/systems/naval/ferryclear.test.js`, `test/systems/auditships_sail.test.js` - clear of other ships
- `test/systems/comeSailAway/passage_csa.test.js`, `test/scenes/naval/passageaudit.test.js` - save, pack and cabins
- `tools/mutants/passage.json` - the mutants

## Open

- A ship crossing her course still meets her on a few legs of a hundred.
- A quay or pier is neither shore nor hull to the hand.
- Another ship's ram can still strike a booked ship, and a passenger can still fire her guns. Whether a passage takes
  them is the owner's call.
