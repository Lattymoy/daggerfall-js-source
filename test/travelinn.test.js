// TRAVEL-INN (2026-09-22) - WHAT THE INNS/CAMP OUT TOGGLE ACTUALLY DOES,
// MEASURED ON BOTH SIDES.
//
// DragynDance on Discord: "when you use instant travel the game ignores
// the option to camp or rest at an inn". Mac: "there's a toggle to rest
// at inns and stuff during travel. Why doesn't it work?"
//
// It works OFFLINE and it is inert ONLINE, and neither half was written
// down anywhere an execution could check. The numbers below are driven
// out of the real popup rather than argued from the source, because the
// chain is four modules long - the popup's refresh, travel.js's
// per-pixel charge, the trip cost, and the host's arrival minute - and
// a reading of any one of them proves nothing about the other three.
//
// OFFLINE the toggle is fully live: camping out is SLOWER (travel.js
// charges `(300 * thisMove) >> 8` per pixel when you are not paying for
// a bed, classic-verbatim) and free, staying at inns is faster and
// costs gold.
//
// ONLINE both consequences collapse to nothing. WORLD5 makes the clock
// the world's, so the trip takes no world time (world.js's arrival is
// `sharedClockOn() ? worldMinutes() : worldMinutes() + computed.minutes`)
// and OL2 pays no inn night because there are no nights. The day
// countdown reads 0 and the fare reads 0 whichever way the toggle is
// set - so on the instant path the player's choice really is ignored,
// exactly as reported. The window says so in both skins
// (ONLINE_TRAVEL_LINE), and what is left live online is the one thing
// the toggle still decides: whether the trip is WALKED or instant.
//
// This pin exists so that stays true by execution. If a later slice
// makes the online trip spend time, the offline rows here will not
// move and the online rows will - which is the signal to come back and
// decide what an inn means when the nights belong to everyone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TravelPopUpWindow, isPlayerControlledTravel, ONLINE_TRAVEL_LINE } from '../src/ui/travelPopUp.js';

const popup = (online) => new TravelPopUpWindow({ x: 60, y: 60 }, {
  getPlayerPixel: () => ({ x: 40, y: 40 }),
  getClimateIndex: () => 231,
  playerEntity: () => ({ items: [], stats: {} }),
  noWorldTime: () => online,
  hasHorse: false, hasCart: false, hasShip: false,
});

/** The trip as the window computes it, with the toggle one way or the other. */
function trip(online, sleepModeInn) {
  const w = popup(online);
  w.sleepModeInn = sleepModeInn;
  w.travelShip = false;
  w.speedCautious = true;
  w.refresh();
  return { minutes: w.travelTimeTotalMins, days: w.countdownValueTravelTimeDays,
    cost: w.trip.totalCost, pieces: w.trip.piecesCost };
}

test('TRAVEL-INN: offline the toggle is live - camping out is slower and free, an inn is faster and costs gold', () => {
  const inn = trip(false, true);
  const camp = trip(false, false);

  assert.ok(camp.minutes > inn.minutes,
    `camping out is the slower road (${camp.minutes} vs ${inn.minutes})`);
  // travel.js: `if (!sleepModeInn) thisMove = (300 * thisMove) >> 8` per
  // pixel - about a sixth longer, and it must be a REAL difference
  // rather than a rounding one.
  assert.ok(camp.minutes - inn.minutes > 100, 'and by a real margin, not a rounding');

  assert.ok(inn.cost > 0, 'a bed is paid for');
  assert.equal(camp.cost, 0, 'a camp is not');
  assert.equal(inn.pieces, inn.cost, 'and taverns take coin (the inn nights are the pieces half)');
});

test('TRAVEL-INN: online BOTH consequences collapse - the instant trip really does ignore the choice', () => {
  const inn = trip(true, true);
  const camp = trip(true, false);

  // WORLD5/OL2: no world time, so no nights, so no inn.
  assert.equal(inn.days, 0, 'the arrival is now');
  assert.equal(camp.days, 0, 'either way');
  // TRAVEL-FARE (2026-09-22, kurkku: "really long trips ... don't cost
  // anything when player-controlled cautious travel is disabled").
  // THIS PIN MEASURED THE BUG AND CALLED IT THE LAW, which is the
  // lesson worth keeping: it was written a day ago and it recorded
  // 0 gold online as correct because OL2 said so. It was correct about
  // the DAYS and wrong about the gold - DFU bills the trip's HOURS,
  // and the journey has a length online even though the clock will not
  // advance over it. A player found it in a day, exactly where this
  // pin was looking.
  assert.ok(inn.cost > 0, 'the inn IS billed online - the fare is the price of the journey');
  assert.equal(camp.cost, 0, 'and camping out is still free, online as offline');
  assert.ok(inn.cost > camp.cost, 'so the choice has a consequence again, which is the whole of the report');

  // The player is TOLD, which is the difference between this and a
  // silent no-op: the window carries the line in both skins.
  assert.match(ONLINE_TRAVEL_LINE, /the journey is still paid for/);   // TRAVEL-FARE: the line moved with the law

  // ...and the toggle is not DEAD online - it still decides the one
  // thing that has a consequence when no time passes: whether the trip
  // is walked or instant. Greying it out would take a working control
  // away, which is why this pin says what is live rather than only
  // what is not.
  const settings = { cautiousTravel: true, stopAtInnsTravel: false };
  assert.equal(isPlayerControlledTravel(settings, { speedCautious: true, sleepModeInn: true, travelShip: false }), false,
    'Inns, with the mod not owning inn trips, is vanilla fast travel');
  assert.equal(isPlayerControlledTravel(settings, { speedCautious: true, sleepModeInn: false, travelShip: false }), true,
    'Camp out is the walked trip - the choice still forks the journey');
});

test('TRAVEL-INN: the offline rows are the guard - they must not move when the online law changes', () => {
  // The two sides are measured from ONE window so a change to the
  // shared arithmetic cannot move one and not the other unnoticed.
  const offInn = trip(false, true), offCamp = trip(false, false);
  const onInn = trip(true, true), onCamp = trip(true, false);

  // The MINUTES are the same arithmetic on both sides - it is what is
  // DONE with them that differs - so a slice that changes the charge
  // itself reddens here first.
  assert.equal(onInn.minutes, offInn.minutes, 'the charge does not know about the shared clock');
  assert.equal(onCamp.minutes, offCamp.minutes, '...for either setting');
  assert.ok(offInn.days > 0, 'offline the days are spent');
  assert.equal(onInn.days, 0, 'online they are not');
});
