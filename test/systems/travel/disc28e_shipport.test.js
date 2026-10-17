// SHIP-PORT (2026-09-28, Discord through Mac: "a player is at a port but unable to set sail"). The map's ship passage
// asks Travel Options' IsNotAtPort of the player's location. On their own ship that location is "Your Ship" (2,2 or
// 5,5), which is in neither port list (the mod's 378 harbours; the MAPS byte's 343, every one of them among the 378),
// while every trip from the deck is reckoned from the port the ship was boarded at (playerTravelOrigin,
// TravelTimeCalculator.GetPlayerTravelPosition). So the passage was refused from the deck ("since there's no port")
// and By land walked out onto the sea. Now, on the ship, the ship laws read the boarding port. Two more on the same
// road: the enhanced map's card re-bills a trip whose ship its guard knocked off (it showed By land over the ship's
// fare, and Begin gold-checked that fare). SHIP-SAIL (Mac, of the Overworld taking the map's passage itself: "Shouldn't
// it already function as such?"): where the Overworld refuses a place across the water and the map's passage sails
// there, the Overworld OFFERS the passage and takes it, priced by the map's own popup headless (partyTripFare) - with
// Come Sail Away on or off (AUDIT 28e: it was offered only with the mod on). Every place below is the retail MAPS.BSA's
// own (its region, its index, its pixel, its id); the source pins read CODE (test/codeOnly.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { playerTravelPosition, calculateTravelTime, travelDays } from '../../../src/systems/travel/travel.js';
import { shipTransition, shipMemory, isOnShip } from '../../../src/systems/ship.js';
import { assignShipToPlayer, SHIP_TYPES, SHIP_COORDS } from '../../../src/systems/banking.js';
import { shipTravelRefusal, isPlayerControlledTravel, TravelPopUpWindow } from '../../../src/ui/travel/travelPopUp.js';
import { readTravelOptionsSettings } from '../../../src/systems/travel/travelOptions.js';
import { hasPort } from '../../../src/systems/travel/travelPorts.js';
import { HeldMapWindow } from '../../../src/ui/heldMap.js';
import { setTravelMapPopUpState } from '../../../src/systems/travel/travelMapState.js';
import { TRAVEL_VIEW_TEXT, shipPassageRows } from '../../../src/scenes/travelView.js';
import { fareText } from '../../../src/systems/party/partyTravelLaw.js';
import { YesNoBoxWindow } from '../../../src/ui/yesNoBox.js';
import { CLIMATES } from '../../../src/formats/mapsFile.js';
import { codeHasOnce, codeOnly } from '../../codeOnly.mjs';

const WORLD = readFileSync(new URL('../../../src/scenes/world.js', import.meta.url), 'utf8');
/** A two-space-indented function of world.js's host, whole. */
const fnOf = (head) => {
  const i = WORLD.indexOf(head);
  assert.ok(i >= 0, head);
  return WORLD.slice(i, WORLD.indexOf('\n  }\n', i) + 4);
};
const hostSeam = fnOf('  function playerTravelOrigin() {') + fnOf('  function travelOriginMapId() {');
const mountSeam = (d) => new Function('d', `const { playerEntity, playerTravelPixel, playerTravelPosition, _musicLoc, locationIndex } = d;\n${hostSeam}\nreturn travelOriginMapId;`)(d);

// The retail MAPS.BSA's own places: its region and index, its pixel, its MapId (masked).
const DAGGERFALL = { pixel: { x: 207, y: 213 }, name: 'Daggerfall', mapId: 213207, regionIndex: 17, locationIndex: 1231 };   // a harbour
const WAYREST = { pixel: { x: 859, y: 244 }, name: 'Wayrest', mapId: 244859, regionIndex: 23, locationIndex: 601 };   // a harbour across the Bay
const MOUSE_AND_GOBLIN = { pixel: { x: 222, y: 5 }, name: 'The Mouse and Goblin Tavern', mapId: 5222, regionIndex: 32, locationIndex: 10 };   // a harbour on the large ship's row
const CHARTALE = { pixel: { x: 209, y: 204 }, name: 'Chartale', mapId: 204209, regionIndex: 17, locationIndex: 1077 };   // inland, no harbour
const ALDINGHOPE = { pixel: { x: 214, y: 203 }, name: 'Aldinghope Garden', mapId: 203214, regionIndex: 17, locationIndex: 1064 };   // no harbour
const loc = (p) => ({ name: p.name, mapTableData: { mapId: p.mapId } });
const key = (px) => `${px.x},${px.y}`;
const deckOf = (type) => SHIP_COORDS[type];
const yourShip = (type) => ({ name: 'Your Ship', mapTableData: { mapId: deckOf(type).y * 1000 + deckOf(type).x } });

/** A player who bought a ship of `type` and boarded it at `at` - through the bank's and the ship's own mints. */
function boarded(type, at) {
  const p = { items: [] };
  assignShipToPlayer(p, type);
  const t = shipTransition(p, { boardShipPosition: null, mapPixel: at.pixel, position: shipMemory({ mapPixel: at.pixel, pos: [10, 5, 10], yaw: 0 }, 0) });
  p.boardShipPosition = t.boardShipPosition;
  assert.deepEqual(t.go, deckOf(type), 'boarding goes to the ship\'s own pixel');
  return p;
}

test('SHIP-PORT: on the deck, the ship laws read the port the ship was boarded at - the passage sails, as the trip is reckoned from there', () => {
  const settings = readTravelOptionsSettings();
  assert.equal(settings.shipTravelPortsOnly, true, 'the mod ships its ports rule on');
  for (const p of [DAGGERFALL, WAYREST, MOUSE_AND_GOBLIN]) assert.ok(hasPort(p.mapId), `${p.name} is a harbour`);
  for (const t of [SHIP_TYPES.Small, SHIP_TYPES.Large]) assert.ok(!hasPort(yourShip(t).mapTableData.mapId), 'a deck is none');
  const locationIndex = new Map([DAGGERFALL, MOUSE_AND_GOBLIN, CHARTALE].map((p) => [key(p.pixel), loc(p)]));
  const ask = (currentLocationMapId) => shipTravelRefusal({ settings, currentLocationMapId, isOnShip: true, destinationMapId: WAYREST.mapId, oceanPixels: 40 });
  // The small ship, boarded in Daggerfall's harbour; and the large one, boarded at a harbour on its deck's own ROW -
  // a deck and its port can share a row, and must still be told apart. (No harbour shares a deck's column: x=2 and
  // x=5 are open sea from pole to pole.)
  for (const [type, port] of [[SHIP_TYPES.Small, DAGGERFALL], [SHIP_TYPES.Large, MOUSE_AND_GOBLIN]]) {
    const p = boarded(type, port);
    const deck = deckOf(type);
    const onDeck = mountSeam({ playerEntity: p, playerTravelPixel: () => deck, playerTravelPosition, _musicLoc: yourShip(type), locationIndex });
    assert.ok(isOnShip(p, p.boardShipPosition, deck));
    assert.equal(onDeck(), port.mapId, `on the deck at ${key(deck)}: ${port.name}, not "Your Ship"`);
    assert.equal(ask(onDeck()), null, 'the passage sails from the deck');
    assert.equal(ask(yourShip(type).mapTableData.mapId), 'noport', 'the deck\'s own pixel is what refused it');
  }
  // Ashore it is PlayerGPS.CurrentLocation, as before: the harbour sails, the wilderness does not.
  const ashore = { items: [] };
  assert.equal(mountSeam({ playerEntity: ashore, playerTravelPixel: () => DAGGERFALL.pixel, playerTravelPosition, _musicLoc: loc(DAGGERFALL), locationIndex })(), DAGGERFALL.mapId);
  assert.equal(mountSeam({ playerEntity: ashore, playerTravelPixel: () => ({ x: 300, y: 300 }), playerTravelPosition, _musicLoc: null, locationIndex })(), null);
  // Boarded, then saved and loaded elsewhere: not on the ship (IsOnShip wants the ship's pixel), so where they stand.
  const p = boarded(SHIP_TYPES.Small, DAGGERFALL);
  assert.equal(mountSeam({ playerEntity: p, playerTravelPixel: () => CHARTALE.pixel, playerTravelPosition, _musicLoc: loc(CHARTALE), locationIndex })(), CHARTALE.mapId);
});

test('SHIP-PORT by source: the one dep bag both maps (and a party\'s fare) read hands the ship laws the travel origin\'s place', () => {
  const bag = fnOf('  function travelFareDeps() {');
  codeHasOnce(bag, /currentLocationMapId: \(\) => travelOriginMapId\(\),/);
  assert.doesNotMatch(codeOnly(bag), /currentLocationMapId:[^\n]*_musicLoc/, 'never the pixel stood in, on a deck');
  const map = codeOnly(fnOf('  function buildTravelMapWindow('));
  assert.match(map, /getPlayerPixel: playerTravelOrigin,[\s\S]*\.\.\.travelFareDeps\(\),/, 'the map reckons its trip from the same place and spreads the bag');
});

test('SHIP-PORT: the enhanced map re-bills a trip whose ship its guard knocked off - By land is a walk, never the ship\'s fare', () => {
  const settings = { ...readTravelOptionsSettings(), shipTravelPortsOnly: true, stopAtInnsTravel: true, cautiousTravel: true };
  setTravelMapPopUpState({ speedCautious: true, sleepModeInn: true, travelShip: true });
  const ocean = (x) => (x > 400 && x < 420 ? CLIMATES.Ocean : 231);   // water on the way from Chartale to Wayrest
  const w = Object.create(HeldMapWindow.prototype);
  w.deps = {
    getPlayerPixel: () => CHARTALE.pixel, getClimateIndex: (x) => ocean(x),
    currentLocationMapId: () => CHARTALE.mapId, isOnShip: () => false,   // inland: no port
    travelOptions: () => ({ settings }), gold: () => 0, goldPieces: () => 0,
  };
  w._selected = { summary: { id: WAYREST.pixel.y * 1000 + WAYREST.pixel.x, mapID: WAYREST.mapId } };
  w._renderCard = () => {};
  w._openPanel('travel');
  const st = w._panelState;
  assert.equal(st.opts.travelShip, false, 'no port here: the guard knocked the ship off');
  assert.ok(isPlayerControlledTravel(settings, st.opts), 'the trip is now a walk');
  assert.equal(st.trip.walked, true, 'and the card bills it as one');
  const bill = { ...st.trip };
  w._refreshTrip();
  assert.deepEqual(st.trip, bill, 'the card\'s bill is the trip it would bill afresh');
  assert.ok(calculateTravelTime(CHARTALE.pixel, WAYREST.pixel, { travelShip: false }, ocean).oceanPixels > 0, 'the fixture crosses water');
});

test('SHIP-SAIL: where the walk is refused and the passage sails, the Overworld offers it and takes it as the map does', () => {
  const said = [], shown = [], journeys = [], asked = [], closers = [], log = [];
  let fare = null, refusal = null, proposed = false, online = false, csa = true, route = { pixels: [] }, offerPending = false;
  const view = { state: 'up', enter: () => { log.push('view up'); view.state = 'rising'; } };
  const d = {
    csaRuntime: {}, csaOn: () => csa, planRoute: () => route, tvRouteGround: () => ({ peakAt: () => false }),   // OW-WOD-PATH: the spot's peak test is the ground's own
    townTalk: { showOverlay: (w, onClosed) => { shown.push(w); closers.push(onClosed); } }, TRAVEL_VIEW_TEXT,
    tvSay: (t) => said.push(t),   // the Overworld's own say (a line held as long at x10 as at x1)
    travelView: view, travelOptions: { clearTravelDestination: () => log.push('journey cleared') },
    giveOffer: () => { if (!offerPending) return false; offerPending = false; log.push('offer handed over'); return true; },
    partyTripFare: (to, opts) => { asked.push({ to, opts }); return fare; },
    travelMapPopUpState: () => ({ speedCautious: false, sleepModeInn: true, travelShip: false }),
    partyTravelRefusal: () => refusal, fareText, sharedClockOn: () => online, travelDays,
    YesNoBoxWindow, shipPassageRows,
    partyTravel: { propose: () => { log.push('party asked'); return proposed; } }, partyTravelJourney: (pick, opts, computed) => { log.push('sailed'); journeys.push({ pick, opts, computed }); },
  };
  const src = fnOf('  function tvOfferPassage(') + fnOf('  function tvSeaNoWay(');
  const noWay = new Function('d', `const { ${Object.keys(d).join(', ')} } = d;\n${src}\nreturn tvSeaNoWay;`)(d);
  const place = WAYREST;
  const priced = (over = {}) => ({ opts: { speedCautious: false, sleepModeInn: true, travelShip: true }, computed: { minutes: 3 * 1440 - 5, totalCost: 150, piecesCost: 50 }, afford: true, unwell: false, ...over });
  const reset = () => { said.length = 0; shown.length = 0; journeys.length = 0; asked.length = 0; closers.length = 0; log.length = 0; view.state = 'up'; };
  /** The box answered, then dropped from the slot (townTalk's dropOverlay: the answer's arm, then the close callback). */
  const answer = (yes) => { shown[0].answer(yes); closers[0]?.(); };
  const ask = () => noWay(DAGGERFALL.pixel, place.pixel, null, null, 'land', place);
  // At a port, the passage sails and the purse holds it: asked, with the map's own words and days - then taken.
  fare = priced();
  ask();
  assert.deepEqual(asked, [{ to: place.pixel, opts: { speedCautious: false, sleepModeInn: true, travelShip: true } }], 'priced by the ship, over my own toggles');
  assert.deepEqual(said, []);
  assert.equal(shown.length, 1);
  assert.ok(shown[0] instanceof YesNoBoxWindow);
  assert.deepEqual(shown[0].rows, ['There is no way to Wayrest by land. Sail there by ship?', 'The journey costs 150 gold.', 'The voyage takes 3 days.']);
  answer(true);
  assert.deepEqual(journeys, [{ pick: { ...place }, opts: fare.opts, computed: fare.computed }]);
  // AUDIT 28e: Yes ENDS the journey on the ground first - it drove on from the far shore back into the sea - and the
  // view stays down for the fade.
  assert.deepEqual(log, ['journey cleared', 'party asked', 'sailed']);
  // A day's voyage says so.
  reset(); fare = priced({ computed: { minutes: 600, totalCost: 40, piecesCost: 0 } });
  ask();
  assert.equal(shown[0].rows[2], 'The voyage takes 1 day.');
  // Come Sail Away off: the passage is Daggerfall's, offered all the same (AUDIT 28e).
  reset(); csa = false; fare = priced();
  ask();
  assert.equal(shown.length, 1, 'offered with the boat mod off');
  csa = true;
  // A party gathered is asked first, as the map's Begin asks it; No leaves me where I stand.
  reset(); proposed = true;
  ask();
  answer(true);
  assert.deepEqual(journeys, [], 'the party round took it');
  reset(); proposed = false;
  ask();
  view.state = 'off';   // the box cut the view down
  answer(false);
  assert.deepEqual(journeys, []);
  assert.deepEqual(log, ['view up'], 'No keeps the journey, and raises the Overworld the box cut down (AUDIT 28e)');
  reset(); view.state = 'off';
  ask();
  answer(false);
  assert.deepEqual(log, [], 'asked from the map, with no Overworld up, No raises none');
  // A pending quest offer is handed over first and spends the press, as at the map's door (GiveOffer, AUDIT 28e).
  reset(); offerPending = true;
  ask();
  assert.deepEqual([log, shown.length, said], [['offer handed over'], 0, []]);
  // Online the days are the traveller's own (MERGE with LIVED1: fastTravelTo's advance bills them to the character's
  // clock, and the map says "N days of your time") - and the popup's warning rides the question.
  reset(); online = true; fare = priced({ unwell: true });
  ask();
  assert.deepEqual(shown[0].rows, ['There is no way to Wayrest by land. Sail there by ship?', 'The journey costs 150 gold.', 'The voyage takes 3 days of your time.', 'You are diseased or poisoned.']);
  online = false;
  // The purse cannot hold it: said, and not asked.
  reset(); fare = priced({ afford: false });
  ask();
  assert.deepEqual([said, shown.length], [['There is no way there by land. You cannot afford the journey (150 gold).'], 0]);
  // ...and where the purse holds the fare but not the coin the inns want, it says the coin (AUDIT 28e).
  reset(); fare = priced({ afford: false, coinsShort: true });
  ask();
  assert.deepEqual(said, ['There is no way there by land. You cannot afford the journey (50 gold in coin for the inns).']);
  // The map door's own rungs refuse it (foes near, the sun): in their words.
  reset(); fare = priced(); refusal = 'You cannot travel with enemies nearby.';
  ask();
  assert.deepEqual([said, shown.length], [[refusal], 0]);
  refusal = null;
  // The passage's own law refuses the place (no port here): the boat's line stands - or, with no boats in the game,
  // the plain refusal. A spot is never offered one.
  reset(); fare = priced({ opts: { speedCautious: false, sleepModeInn: true, travelShip: false } });
  ask();
  noWay(DAGGERFALL.pixel, place.pixel, null, null, 'land');
  csa = false;
  ask();
  csa = true;
  assert.deepEqual([said, shown.length], [[TRAVEL_VIEW_TEXT.needBoat, TRAVEL_VIEW_TEXT.needBoat, TRAVEL_VIEW_TEXT.noWay], 0]);
  // No way even by water (the peaks all round): nothing to offer, and nothing priced.
  reset(); fare = priced(); route = null;
  ask();
  assert.deepEqual([said, shown.length, asked.length], [[TRAVEL_VIEW_TEXT.noWay], 0, 0]);
  route = { pixels: [] };
  // ...and the route planner hands it the place it was asked for.
  codeHasOnce(fnOf('  function travelViewRouteTo('), /if \(!plan\) \{ tvSeaNoWay\(from, summary\.pixel, means, net, 'land', summary\); return false; \}/);
  // A passage from the DECK caches the deck's scene first, as performFastTravel does (:330-332) - after the pre-travel
  // event, before the teleport (AUDIT 28e: SHIP-PORT opened this door and the step was never carried).
  const fast = fnOf('  async function fastTravelTo(pick, opts, computed) {');
  codeHasOnce(fast, /if \(isOnShip\(playerEntity, playerEntity\.boardShipPosition \?\? null, playerTravelPixel\(\)\)\) cacheExteriorScene\(playerTravelPixel\(\)\);/);
  const code = codeOnly(fast);
  assert.ok(code.indexOf('warmAshesPreTravel(') < code.indexOf('cacheExteriorScene(') && code.indexOf('cacheExteriorScene(') < code.indexOf('await _teleportToPixel(pick.pixel.x'), 'after the pre-travel event, before the teleport');
});

test('SHIP-SAIL: the passage is priced by the map\'s own popup, which prices itself as it is built - its guard sees the water', () => {
  // partyTripFare's steps over the real popup: built (its constructor prices the trip), toggled, guarded, priced.
  // The pin for a correction, not a fix: this held before the batch too (the batch's first record said otherwise).
  const settings = readTravelOptionsSettings();
  const fareOf = (dest, climate) => {
    const pop = new TravelPopUpWindow(dest.pixel, {
      getPlayerPixel: () => DAGGERFALL.pixel, getClimateIndex: (x) => climate(x),
      travelOptions: () => ({ settings }), currentLocationMapId: () => DAGGERFALL.mapId, isOnShip: () => false,
      locationSummary: () => ({ mapID: dest.mapId }), gold: () => 1000, goldPieces: () => 1000,
    });
    pop.speedCautious = true; pop.sleepModeInn = true; pop.travelShip = true;
    pop.enforceShipRestriction();
    pop.refresh();
    return pop;
  };
  const strait = (x) => (x > 209 && x < 213 ? CLIMATES.Ocean : 231);   // water between Daggerfall and Aldinghope Garden
  const across = fareOf(ALDINGHOPE, strait);
  assert.equal(across.travelShip, true, 'a place with no harbour across the water: the ship stays (the mod\'s HasNoOceanTravel, TravelOptionsPopUp.cs:93-96, refuses a trip with no water, off the ship, to no harbour)');
  assert.ok(across.trip.oceanPixels > 0 && across.trip.totalCost > 0);
  const dry = fareOf(ALDINGHOPE, () => 231);
  assert.equal(dry.travelShip, false, 'no water between and no harbour there: "a ship is not needed" - no passage to offer');
  codeHasOnce(fnOf('  function partyTripFare(to, opts) {'), /pop\.enforceShipRestriction\(\);\s*pop\.refresh\(\);/, 'the same steps the offer prices by');
  // partyTripFare itself, mounted over the real popup: the gate's two halves told apart (AUDIT 28e) - coins short of the
  // inns' nights while the purse holds the fare, or the purse short of the fare.
  const purse = { gold: 1000, pieces: 1000 };
  const tripFare = new Function('d', `const { TravelPopUpWindow, travelFareDeps, playerTravelOrigin, maps, travelLocationSummaryAt, mapDict, guildFastTravel, playerEntity, diseaseCount, poisonCount } = d;\n${fnOf('  function partyTripFare(to, opts) {')}\nreturn partyTripFare;`)({
    TravelPopUpWindow, playerTravelOrigin: () => DAGGERFALL.pixel, maps: { getClimateIndex: (x) => strait(x) }, mapDict: null,
    travelLocationSummaryAt: () => ({ mapID: ALDINGHOPE.mapId }), guildFastTravel: (_, m) => m, playerEntity: {}, diseaseCount: () => 0, poisonCount: () => 0,
    travelFareDeps: () => ({ travelOptions: () => ({ settings }), currentLocationMapId: () => DAGGERFALL.mapId, isOnShip: () => false, gold: () => purse.gold, goldPieces: () => purse.pieces }),
  });
  const inns = { speedCautious: true, sleepModeInn: true, travelShip: false };
  const whole = tripFare(ALDINGHOPE.pixel, inns);
  assert.ok(whole.computed.piecesCost > 0 && whole.afford && !whole.coinsShort, 'a night at an inn on the way, paid');
  purse.pieces = whole.computed.piecesCost - 1;
  assert.deepEqual([tripFare(ALDINGHOPE.pixel, inns).afford, tripFare(ALDINGHOPE.pixel, inns).coinsShort], [false, true], 'the coins short of the inns');
  purse.gold = whole.computed.totalCost - 1;
  assert.deepEqual([tripFare(ALDINGHOPE.pixel, inns).afford, tripFare(ALDINGHOPE.pixel, inns).coinsShort], [false, false], 'the purse short of the fare');
});
