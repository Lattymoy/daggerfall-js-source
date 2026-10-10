// FIELD BUGS 2026-10-10 (bible/01-Overview/Field-Bugs-2026-10-10.md), FIND-FIRST - the Discord's "make 'Find me' the
// standard functionality on the world map when I first open it": the player's own world map (the held map, ui/heldMap.js)
// opens as a press of Find me does - the glide to my pixel and the red cross - unless the open was for somewhere else.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { HeldMapWindow } from '../src/ui/heldMap.js';
import { CLIMATES } from '../src/formats/mapsFile.js';
import { resetTravelMapState } from '../src/systems/travelMapState.js';
import { MOD_SETTINGS } from '../src/systems/modSettings.js';
import { readImmersiveTravelSettings, IT_POPUP, IMMERSIVE_TRAVEL_VENDOR } from '../src/systems/immersiveTravel.js';

function fakeDocument() {
  const node = () => {
    const n = {
      children: [], style: {}, dataset: {}, classList: { toggle() {}, add() {}, remove() {} },
      append(...k) { n.children.push(...k); }, remove() { n.removed = true; },
      addEventListener() {}, removeEventListener() {}, setPointerCapture() {}, querySelectorAll: () => [],
      className: '', textContent: '', id: '', attrs: {}, setAttribute(k, v) { n.attrs[k] = v; },
      set innerHTML(v) { n.children = []; }, get innerHTML() { return ''; },
    };
    return n;
  };
  return { createElement: () => node(), getElementById: () => null, head: node(), body: node(), addEventListener() {}, removeEventListener() {} };
}
function withDocument(fn) {
  resetTravelMapState();
  globalThis.document = fakeDocument();
  globalThis.innerWidth = 1600; globalThis.innerHeight = 900;
  try { return fn(globalThis.document); } finally { delete globalThis.document; }
}
/** A bay big enough that a view on my pixel is not the rest view (on a sheet that holds the bay whole, the clamp centres
 *  the bay whatever is asked), and me well off its middle. */
const ME = { x: 700, y: 300 };
const mkWin = ({ findMeFirst = false, ...extra } = {}) => {
  const win = new HeldMapWindow({
    getPlayerPixel: () => ME, getClimateIndex: () => CLIMATES.Woodlands,
    woods: { heightMapBuffer: new Uint8Array(500000).fill(10) }, mapSize: { width: 1000, height: 500 },
    gold: () => 10000, goldPieces: () => 10000, hasHorse: false, hasCart: false, hasShip: false,
    diseaseCount: () => 0, poisonCount: () => 0,
    ...extra,
  });
  if (findMeFirst) win.openOnMe();   // the host's word, as world.js's toggleTravelMap says it
  return win;
};
const journey = (mod) => () => ({ settings: {}, destinationName: 'Wayrest', isTravelActive: false, ...mod });
/** Where my pixel sits off the paper's middle, in paper pixels - [0, 0] on me. */
const offMiddle = (w) => { const v = w._view; return [Math.round((ME.x + 0.5 - (v.ox + w._paper.w / (2 * v.scale))) * v.scale), Math.round((ME.y + 0.5 - (v.oy + w._paper.h / (2 * v.scale))) * v.scale)]; };
/** MAP3's Morrowind arm, ready to take the sheet from tick `readyAt` - its four corners on the screen's middle. */
const armFrom = (readyAt) => { let t = 0; return { tick() { t++; }, available: () => t >= readyAt, hold: () => true, release() {}, corners: () => [[400, 150], [1200, 150], [1200, 750], [400, 750]] }; };

test('FIND-FIRST: the player\'s own world map opens as a press of Find me - the same glide to my pixel, the same red cross', () => withDocument(() => {
  const first = mkWin({ findMeFirst: true });
  first.tick(0.05);
  const pressed = mkWin();
  pressed.tick(0.05);
  const rest = { ...pressed._view };
  assert.deepEqual(pressed._goal, rest, 'without the host\'s word the map rests on the bay, as it did');
  assert.ok(!(pressed._findMeT > 0), '...and no cross');
  pressed._findMe();   // what the Find me button does (its onclick, in the map's phase)
  assert.deepEqual(first._goal, pressed._goal, 'the open is the press');
  assert.notDeepEqual(first._goal, rest, 'and the press moves the view - the pin is not a no-op on this bay');
  assert.equal(first._findMeT, 3, 'the cross blinks its three seconds from the open');
  for (let i = 0; i < 40; i++) first.tick(0.05);
  assert.ok(Math.abs(first._view.scale - first._goal.scale) < 1e-3 && Math.abs(first._view.ox - first._goal.ox) < 1e-2, 'the sheet arrives on me');
  first.dispose(); pressed.dispose();
}));

test('FIND-FIRST: an open for somewhere else is left as it was - a journal\'s place, a teleport\'s pick, a journey Travel Options centres or asks to resume', () => withDocument(() => {
  const place = mkWin({ findMeFirst: true });
  place.gotoPlace({ siteDetails: { regionName: 'Nowhere', locationName: 'Nothing' } });
  place.tick(0.05);
  assert.ok(!(place._findMeT > 0), 'a journal\'s place: not on me');
  const port = mkWin({ findMeFirst: true });
  port.activateTeleportationTravel();
  port.tick(0.05);
  assert.ok(!(port._findMeT > 0), 'a teleport\'s pick: the whole bay');
  assert.deepEqual(port._goal, port._view);
  const going = mkWin({ findMeFirst: true, travelOptions: journey({ isTravelActive: true }) });
  going.tick(0.05);
  assert.ok(!(going._findMeT > 0), 'a journey under way: MAP2\'s own centring (TravelOptionsMapWindow), at the open\'s zoom');
  assert.equal(going._goal.scale, going._bayFit(), 'not the find\'s zoom');
  const resume = mkWin({ findMeFirst: true, travelOptions: journey() });
  resume.tick(0.05);
  assert.equal(resume._top, 'resume');
  assert.ok(!(resume._findMeT > 0), 'a journey to resume: the mod\'s question, over the bay');
  for (const w of [place, port, going, resume]) w.dispose();
}));

test('FIND-FIRST (AUDIT FB1010 B1): a paper that changes size under the open keeps me in its middle - the Morrowind arm taking the sheet a few ticks late, or giving it back unfitted - as a press of Find me lands', () => withDocument(() => {
  for (const readyAt of [0, 2, 5]) {
    const arm = armFrom(readyAt);
    const w = mkWin({ findMeFirst: true, holder: arm });
    for (let i = 0; i < 80; i++) { arm.tick(); w.tick(1 / 60); }
    assert.equal(w._lane, 'hands', 'the arm holds it');
    assert.deepEqual(offMiddle(w), [0, 0], `the arm ready at tick ${readyAt}: on me`);
    w.dispose();
  }
  // MAP-FIT1: the arm takes the sheet, its corners run off the screen on the next tick, and it is given back
  let t = 0;
  const misfit = { available: () => true, hold: () => true, release() {}, corners: () => (t < 2 ? null : [[-200, 300], [1800, 300], [1800, 1200], [-200, 1200]]) };
  const w = mkWin({ findMeFirst: true, holder: misfit });
  for (let i = 0; i < 80; i++) { t++; w.tick(1 / 60); }
  assert.equal(w._lane, 'sprite', 'given back');
  assert.deepEqual(offMiddle(w), [0, 0], 'the painted sheet: on me');
  w.dispose();
}));

test('FIND-FIRST (AUDIT FB1010 B2): a driver\'s map opens on the Bay even when asked - the carriage\'s and the ship\'s are the driver\'s routes', () => withDocument(() => {
  const all = Object.fromEntries(Object.entries(MOD_SETTINGS[IMMERSIVE_TRAVEL_VENDOR].keys).map(([k, d]) => [k, d.default]));
  const settings = readImmersiveTravelSettings((v, k) => all[k]);
  const driver = mkWin({ findMeFirst: true, immersive: { kind: IT_POPUP.carriage, settings } });
  driver.tick(0.05);
  assert.ok(!(driver._findMeT > 0), 'no cross');
  assert.deepEqual(driver._goal, driver._view, 'the Bay at rest');
  driver.dispose();
}));

test('FIND-FIRST: the world host asks it of the player\'s own map alone - the key and the journal, never a teleport, a portal stone or a driver\'s map', () => {
  const w = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  const door = w.slice(w.indexOf('const toggleTravelMap = (gotoPlace = null) => {'), w.indexOf('townTalk.showOverlay(_travelMap);'));
  assert.ok(door.indexOf('_travelMap.openOnMe?.();') > door.indexOf('_travelMap = buildTravelMapWindow('), 'toggleTravelMap\'s open, on the window it built');
  assert.equal(w.match(/\.openOnMe\b/g).length, 1, 'and no other door');
});
