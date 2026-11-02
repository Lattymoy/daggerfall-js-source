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
// (ONLINE_TRAVEL_LINE). Offline the toggle still decides whether the trip
// is WALKED or instant; online (TRAVEL-ONLINE, 2026-10-03) the room holds
// Travel Options' Inns dial, so a trip over land is walked either way and
// the toggle decides the road's nights alone.
//
// This pin exists so that stays true by execution. If a later slice
// makes the online trip spend time, the offline rows here will not
// move and the online rows will - which is the signal to come back and
// decide what an inn means when the nights belong to everyone.
//
// LIVED1 (2026-09-29) IS THAT SLICE, and the answer is the character's
// own time: the nights belong to the traveller. The trip's days pass on
// their own clock (world.js advances them online too), so an inn is a
// bed they sleep in and camping out is the slower road again - the
// toggle is fully live online, as offline. The offline rows did not
// move; the online rows did, and now read the same.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TravelPopUpWindow, isPlayerControlledTravel, ONLINE_TRAVEL_LINE } from '../../../src/ui/travel/travelPopUp.js';
import { ONLINE_ROOM_MOD_KEYS } from '../../../src/systems/online/onlineLane.js';   // TRAVEL-ONLINE: the room's Travel Options dials

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

test('TRAVEL-INN (LIVED1): online the toggle is live again - the days pass on the traveller\'s own clock, so camping out is the slower road and free, an inn is faster and costs gold, exactly as offline', () => {
  const inn = trip(true, true);
  const camp = trip(true, false);
  assert.ok(inn.days > 0 && camp.days >= inn.days, `the days are counted online: ${inn.days} by inns, ${camp.days} camping`);
  assert.ok(camp.minutes > inn.minutes, 'camping out is the slower road online too');
  // TRAVEL-FARE (2026-09-22, kurkku: "really long trips ... don't cost anything") stands: the fare is the price of
  // the journey - and now the nights it pays for are really slept, on the character's own clock
  assert.ok(inn.cost > 0, 'the inn is billed online');
  assert.equal(camp.cost, 0, 'and camping out is still free, online as offline');
  // the player is TOLD whose days they are, in both skins
  assert.match(ONLINE_TRAVEL_LINE, /the trip's days pass only for you/);
  // ...and offline the toggle still forks the journey (the mod's rule, with its Inns dial off)...
  const settings = { cautiousTravel: true, stopAtInnsTravel: false };
  assert.equal(isPlayerControlledTravel(settings, { speedCautious: true, sleepModeInn: true, travelShip: false }), false,
    'Inns, with the mod not owning inn trips, is vanilla fast travel');
  assert.equal(isPlayerControlledTravel(settings, { speedCautious: true, sleepModeInn: false, travelShip: false }), true,
    'Camp out is the walked trip - the choice still forks the journey');
  // ...while online the room holds the dials (TRAVEL-ONLINE), so the walk is the trip by inns and by camp alike
  const room = ONLINE_ROOM_MOD_KEYS['travel-options'];
  const online = { cautiousTravel: room['CautiousTravel.PlayerControlledCautiousTravel'], stopAtInnsTravel: room['StopAtInnsTravel.PlayerControlledInnsTravel'] };
  for (const sleepModeInn of [true, false]) assert.equal(isPlayerControlledTravel(online, { speedCautious: true, sleepModeInn, travelShip: false }), true, `online, ${sleepModeInn ? 'Inns' : 'Camp out'}: walked`);
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
  assert.equal(onInn.days, offInn.days, 'LIVED1: online too - on the traveller\'s own clock');
  assert.equal(onCamp.days, offCamp.days);
});
