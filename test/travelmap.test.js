// F-slice: the travel WINDOW + the world-host arrival wiring.
// The laws are travel.test.js's; these pin the choice-collection
// (DaggerfallTravelPopUp's toggles), the gold gate, and the host's
// performFastTravel order.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TravelMapWindow } from '../src/ui/travelMap.js';
import { CLIMATES } from '../src/formats/mapsFile.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const mk = (over = {}) => {
  const traveled = [];
  const index = [
    { name: 'Wayrest', region: 'Wayrest', pixel: { x: 10, y: 0 }, type: 0 , mapId: 3145729, discovered: true },
    { name: 'Waycrest Manor', region: 'Daggerfall', pixel: { x: 2, y: 0 }, type: 8 , mapId: 3145730, discovered: true },
    { name: 'Gothway Garden', region: 'Daggerfall', pixel: { x: 3, y: 1 }, type: 2 , mapId: 3145731, discovered: true },
  ];
  const w = new TravelMapWindow(index, {
    getPlayerPixel: () => ({ x: 0, y: 0 }),
    getClimateIndex: () => CLIMATES.Woodlands,
    gold: () => 1000,
    onTravel: (pick, opts, computed) => traveled.push({ pick, opts, computed }),
    ...over,
  });
  return { w, traveled };
};
const type = (w, str) => { for (const c of str) w.input('char:' + c); };

test('travelmap: typeahead over the directory, Enter picks, the popup defaults hold', () => {
  const { w } = mk();
  type(w, 'way');
  assert.equal(w.matches.length, 2, 'the classic find matches from the START of the name');
  assert.deepEqual(w.matches.map((m) => m.name), ['Wayrest', 'Waycrest Manor']);
  w.input('down');
  w.input('confirm');
  assert.equal(w.mode, 'options');
  assert.equal(w.pick.name, 'Waycrest Manor');
  // DaggerfallTravelPopUp defaults: cautious, inns, no ship
  assert.equal(w.speedCautious, true);
  assert.equal(w.sleepModeInn, true);
  assert.equal(w.travelShip, false);
  // Escape returns to the search, not out of the window
  w.input('back');
  assert.equal(w.mode, 'search');
  assert.equal(w.done, false);
  w.input('back');
  assert.equal(w.done, true);
});

test('travelmap: the toggles change the computed numbers and Enter hands the host the whole choice', () => {
  const { w, traveled } = mk();
  type(w, 'wayrest');
  w.input('confirm');
  const cautiousInn = w._compute();
  assert.equal(cautiousInn.minutes, 1040, '10 woodlands pixels, cautious + inn');
  w.input('char:t');   // camp out
  assert.equal(w._compute().minutes, 1210);
  w.input('char:r');   // reckless
  assert.equal(w._compute().minutes, 605);
  w.input('char:c'); w.input('char:i');
  assert.equal(w._compute().minutes, 1040, 'the toggles go both ways');
  w.input('confirm');
  assert.equal(traveled.length, 1, 'Enter travels');
  assert.equal(traveled[0].pick.name, 'Wayrest');
  assert.deepEqual(traveled[0].opts, { speedCautious: true, sleepModeInn: true, travelShip: false });
  assert.equal(traveled[0].computed.minutes, 1040);
  assert.equal(traveled[0].computed.totalCost, 5, 'one inn stay');
  assert.equal(w.done, true, 'the window closes on departure');
});

test('travelmap: the gold gate refuses without closing; ship costs flow through', () => {
  const { w, traveled } = mk({ gold: () => 3, getClimateIndex: () => CLIMATES.Ocean });
  type(w, 'wayrest');
  w.input('confirm');
  w.input('char:s');   // rent the ship across 10 ocean pixels: 25
  const t = w._compute();
  assert.equal(t.oceanPixels, 10);
  assert.equal(t.totalCost, 30, '25 ship + 5 inn');
  w.input('confirm');
  assert.equal(traveled.length, 0, '3 gold cannot pay 30');
  assert.ok(w.notice, 'the refusal speaks');
  assert.equal(w.done, false, 'and the window stays');
});

test('travelmap: the world host wires V, the arrival order, and the ONE-clock advance', () => {
  const src = readFileSync(join(root, 'src/scenes/world.js'), 'utf8');
  assert.ok(src.includes("e.code === 'KeyV' && !townTalk.overlayActive"), 'V opens the map (InputManager:1028)');
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
  assert.ok(src.includes('buildTravelIndex(maps, longitudeLatitudeToMapPixel)'), 'the whole directory feeds the search');
  const k = src.indexOf('async function _teleportToPixel');
  assert.ok(k > 0, 'the shared teleport core exists');
  const core = src.slice(k, k + 900);
  for (const needle of ['destroyPixel(bx, by)', 'state.init(px, py)', 'buildPixel(first.px']) {
    assert.ok(core.includes(needle), `the core carries ${needle}`);
  }
});
