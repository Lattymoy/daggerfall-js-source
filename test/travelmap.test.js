// U41 (was F-slice): the TRAVEL POPUP and the world-host arrival
// wiring. The laws are travel.test.js's; the window's own geometry
// and flow are travelmapwindow.test.js's. These pin the popup's
// choice collection (DaggerfallTravelPopUp's toggles, its assign-on-
// click / toggle-on-key split), the gold and disease gates, the day
// countdown, and the host's performFastTravel order.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TravelPopUpWindow, POPUP_RECTS, TOGGLE_POS, TOGGLE_SIZE, TRAVEL_TOGGLE_COLOR, LABEL_POS, COUNTDOWN_TICK } from '../src/ui/travelPopUp.js';
import { CLIMATES } from '../src/formats/mapsFile.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const mk = (over = {}) => {
  const traveled = [];
  const w = new TravelPopUpWindow({ x: 10, y: 0 }, {
    getPlayerPixel: () => ({ x: 0, y: 0 }),
    getClimateIndex: () => CLIMATES.Woodlands,
    gold: () => 1000,
    diseaseCount: () => 0,
    onTravel: (endPos, opts, computed) => traveled.push({ endPos, opts, computed }),
    ...over,
  });
  return { w, traveled };
};
const clickRect = (w, key) => {
  const [x, y, rw, rh] = POPUP_RECTS[key];
  return w.click(x + rw / 2, y + rh / 2);
};

test('U41 popup: the layout is DFU\'s and the defaults are cautious / SHIP / inns', () => {
  assert.deepEqual(POPUP_RECTS.native, [49, 28, 223, 97]);
  assert.deepEqual(POPUP_RECTS.begin, [222, 98, 48, 10]);
  assert.deepEqual(POPUP_RECTS.exit, [222, 112, 48, 10]);
  assert.deepEqual(POPUP_RECTS.cautious, [50, 51, 108, 9]);
  assert.deepEqual(POPUP_RECTS.reckless, [50, 61, 108, 9]);
  assert.deepEqual(POPUP_RECTS.footHorse, [163, 51, 108, 9]);
  assert.deepEqual(POPUP_RECTS.ship, [163, 61, 108, 9]);
  assert.deepEqual(POPUP_RECTS.inns, [50, 83, 108, 9]);
  assert.deepEqual(POPUP_RECTS.campout, [163, 83, 108, 9]);
  assert.deepEqual(TOGGLE_POS.cautious, [52.25, 53]);
  assert.deepEqual(TOGGLE_POS.reckless, [52.25, 63.25]);
  assert.deepEqual(TOGGLE_POS.inn, [52.25, 85.5]);
  assert.deepEqual(TOGGLE_POS.campout, [165, 85.5]);
  assert.deepEqual(TOGGLE_POS.foot, [165, 53]);
  assert.deepEqual(TOGGLE_POS.ship, [165, 63.25]);
  assert.equal(TOGGLE_SIZE, 4.75);
  assert.deepEqual(TRAVEL_TOGGLE_COLOR.map((c) => Math.round(c * 255)), [85, 117, 48, 255]);
  assert.deepEqual(LABEL_POS.gold, [148, 97]);
  assert.deepEqual(LABEL_POS.cost, [117, 107]);
  assert.deepEqual(LABEL_POS.time, [129, 117]);
  assert.equal(COUNTDOWN_TICK, 0.05);
  const { w } = mk();
  assert.equal(w.speedCautious, true);
  assert.equal(w.travelShip, true, 'DFU\'s field is TRUE - the F-slice window had it false');
  assert.equal(w.sleepModeInn, true);
});

test('U41 popup: a click ASSIGNS its own option, a hotkey TOGGLES the pair', () => {
  const { w } = mk();
  assert.equal(w.trip.minutes, 1040, '10 woodlands pixels, cautious + inn');
  clickRect(w, 'campout');
  assert.equal(w.sleepModeInn, false);
  assert.equal(w.trip.minutes, 1210, 'camping is slower');
  clickRect(w, 'campout');
  assert.equal(w.sleepModeInn, false, 'a click on the LIVE option is not a toggle');
  w.input('KeyN');
  assert.equal(w.sleepModeInn, true, 'the hotkey flips it');
  clickRect(w, 'reckless');
  assert.equal(w.speedCautious, false);
  assert.equal(w.trip.minutes, 520, 'reckless is exactly the halving');
  clickRect(w, 'reckless');
  assert.equal(w.speedCautious, false, 'the second click on the live option is still not a toggle');
  w.input('KeyS');
  assert.equal(w.speedCautious, true);
  clickRect(w, 'footHorse');
  assert.equal(w.travelShip, false);
  w.input('KeyT');
  assert.equal(w.travelShip, true);
  assert.equal(w.trip.totalCost, 5, 'one inn stay over dry land');
});

test('U41 popup: the ship costs, the gold gate refuses without closing', () => {
  const { w, traveled } = mk({ getClimateIndex: () => CLIMATES.Ocean, gold: () => 3 });
  assert.equal(w.trip.oceanPixels, 10);
  assert.equal(w.trip.totalCost, 30, '25 ship rental + 5 inn');
  w.input('KeyB');
  assert.equal(w.top, 'gold', 'TEXT.RSC 454 refuses');
  assert.equal(w.doFastTravel, false);
  assert.equal(traveled.length, 0);
  assert.equal(w.done, false, 'and the popup stays');
  w.input('Enter');   // click-anywhere-to-close
  assert.equal(w.top, null);
});

test('U41 popup: a disease warns first, and Yes runs the gold check behind it', () => {
  const { w, traveled } = mk({ diseaseCount: () => 1 });
  w.input('KeyB');
  assert.equal(w.top, 'diseased');
  assert.equal(w.doFastTravel, false);
  w.input('KeyN');
  assert.equal(w.top, null, 'No returns to the popup, nothing booked');
  assert.equal(w.doFastTravel, false);
  w.input('KeyB');
  w.input('KeyY');
  assert.equal(w.top, null);
  assert.equal(w.doFastTravel, true, 'Yes falls through to the gold check');
  assert.equal(traveled.length, 0, 'and still nothing has moved');
});

test('U41 popup: the day countdown empties before the trip runs', () => {
  const { w, traveled } = mk();
  w.input('KeyB');
  const days = w.countdownValueTravelTimeDays;
  assert.equal(days, 1, '1040 minutes rounds up to one day');
  w.tick(0.06);
  assert.equal(w.countdownValueTravelTimeDays, 0);
  assert.equal(traveled.length, 0, 'the trip waits for the counter to empty');
  w.tick(0.06);
  assert.equal(traveled.length, 1);
  assert.deepEqual(traveled[0].endPos, { x: 10, y: 0 });
  assert.deepEqual(traveled[0].opts, { speedCautious: true, sleepModeInn: true, travelShip: true });
  assert.equal(traveled[0].computed.minutes, 1040);
  assert.equal(traveled[0].computed.totalCost, 5);
  assert.equal(w.done, true);
});

test('U41 popup: EXIT closes without travelling, and Escape is the same door', () => {
  const { w, traveled } = mk();
  let exits = 0;
  w.deps.onExit = () => { exits++; };
  clickRect(w, 'exit');
  assert.equal(w.done, true);
  assert.equal(exits, 1);
  assert.equal(traveled.length, 0);
  const b = mk().w;
  b.deps.onExit = () => { exits++; };
  b.input('Escape');
  assert.equal(b.done, true);
  assert.equal(exits, 2);
});

test('U41: the world host mounts the art window and keeps performFastTravel\'s order', () => {
  const src = readFileSync(join(root, 'src/scenes/world.js'), 'utf8');
  assert.ok(src.includes("act === 'TravelMap' && !townTalk.overlayActive"),
    'the TravelMap action opens the map (I2; V is its registry default, InputManager:1028)');
  const i = src.indexOf('async function fastTravelTo');
  assert.ok(i > 0);
  const fn = src.slice(i, src.indexOf('const toggleTravelMap', i));
  // P-slice: the teardown/build core extracted to _teleportToPixel
  // (the quickload shares it); the travel order pins the CALL, the
  // core's own content pins below.
  const order = ['deductGold(playerEntity', 'await _teleportToPixel(pick.pixel.x',
    'opts.speedCautious', 'maxFatigue(playerEntity)', 'SPECIAL_ABILITY.NoRegenSpellPoints)',
    'playerTicker.advance(computed.minutes)', 'arrivalClampMinutes(playerTicker.classicMinutes'];
  let at = -1;
  for (const needle of order) {
    const j = fn.indexOf(needle);
    assert.ok(j > at, `performFastTravel order: ${needle}`);
    at = j;
  }
  // U41: the map reads ContentReader's dictionary, and the door is
  // gated on the classic art rather than opening a blank window.
  assert.ok(src.includes('buildMapDict(maps)'), 'the map dict feeds the window');
  assert.ok(src.includes('preloadTravelMapArt({ renderer, fetchBytes, palette })'), 'the art warms at boot');
  assert.ok(src.includes('if (!travelMapArtLoaded())'), 'no art, no window');
  assert.ok(src.includes('new TravelMapWindow({\n      maps, mapDict,'), 'the window gets the maps and the dict');
  assert.ok(!src.includes('buildTravelIndex'), 'the keyed typeahead\'s directory is retired');
  const k = src.indexOf('async function _teleportToPixel');
  assert.ok(k > 0, 'the shared teleport core exists');
  const core = src.slice(k, k + 900);
  for (const needle of ['destroyPixel(bx, by)', 'state.init(px, py)', 'buildPixel(first.px']) {
    assert.ok(core.includes(needle), `the core carries ${needle}`);
  }
});
