// PACE-DIALS (2026-10-06, the player: "Revert back to the overworld timer multiplier for ppl to set to 60x and 100x on
// roads and the nearby enemy timer to set to 60x max ... speed settings should be 5x 10x 20x 30x 40x 60x and 100x should be
// only setable when on a road and it has to go to 60 instantly again when leaving the road. Same for enemies nearby
// multiplier and same rules"; bible/01-Overview/Waypoints-And-Pace.md). Two dials on one ladder - the journey's Speed and
// the Near enemies floor - read by every reader through systems/travelPace.js: RATE-LAW's x100 and x60 are the dial's two
// ceilings now, x100 a road's alone, and leaving a road takes a dial at x100 to x60 at once, never climbing back.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PACE_STEPS, ROAD_PACE_MAX, OPEN_PACE_MAX, TRAVEL_PACE_DEFAULT, TRAVEL_PACE_DIALS, TRAVEL_PACE_STORE_KEY, clampPace,
  travelPace, setTravelPace, stepTravelPace, setPaceGround, paceNow, paceRateOn, paceCanRise, paceOnRoad, onTravelPace,
  _resetTravelPace,
} from '../src/systems/travelPace.js';
import { MAX_TIME_SCALE, TRAVEL_ROAD_RATE, TRAVEL_OPEN_RATE, travelRateOf } from '../src/systems/timeScale.js';
import { foePaced, JOURNEY_FOE_PACE } from '../src/systems/travelThreat.js';
import { buildPaceControls } from '../src/ui/travelPaceControls.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const fresh = () => { delete globalThis.localStorage; _resetTravelPace(); };

test('PACE-DIALS: one ladder, two dials, the two ceilings RATE-LAW named - declared once, the road\'s the clamp\'s', () => {
  fresh();
  assert.deepEqual([...PACE_STEPS], [5, 10, 20, 30, 40, 60, 100], 'the player\'s own ladder');
  assert.deepEqual([...TRAVEL_PACE_DIALS], ['speed', 'foe']);
  assert.equal(ROAD_PACE_MAX, MAX_TIME_SCALE, 'the road\'s top is the mod\'s own AccelerationLimit, never past the clamp');
  assert.deepEqual([TRAVEL_ROAD_RATE, TRAVEL_OPEN_RATE], [ROAD_PACE_MAX, OPEN_PACE_MAX], 'RATE-LAW\'s two rates are the dial\'s ceilings');
  assert.deepEqual([ROAD_PACE_MAX, OPEN_PACE_MAX], [100, 60]);
  assert.deepEqual({ ...TRAVEL_PACE_DEFAULT }, { speed: 60, foe: JOURNEY_FOE_PACE }, 'the journey at the open ground\'s top, the foes at ENEMY-PACE\'s x5');
  assert.deepEqual({ ...travelPace() }, { speed: 60, foe: 5 });
  // onto the ladder, rounded down, under the ground's top
  assert.equal(clampPace(45), 40); assert.equal(clampPace(100), 60, 'off a road the ladder ends at x60');
  assert.equal(clampPace(100, true), 100); assert.equal(clampPace(99, true), 60); assert.equal(clampPace(3), 5); assert.equal(clampPace('x'), 5);
});

test('PACE-DIALS: x100 is chosen on a road alone - refused off it - and the journey\'s rate is the dial under the ground\'s top', () => {
  fresh();
  assert.equal(paceOnRoad(), false);
  assert.equal(setTravelPace('speed', 100), 60, 'off a road: x60, the most');
  assert.equal(travelRateOf(true), 60, 'the default on a road is x60 - x100 is the player\'s');
  assert.equal(travelRateOf(false), 60);
  setPaceGround(true);
  assert.equal(setTravelPace('speed', 100), 100);
  assert.equal(travelRateOf(true), 100, 'chosen on the road: x100 there');
  assert.equal(travelRateOf(false), 60, 'and x60 off it, whatever the dial');
  assert.equal(paceRateOn(true), 100);
  setTravelPace('speed', 20);
  assert.equal(travelRateOf(true), 20, 'a slower dial is slower on the road too');
  assert.equal(setTravelPace('nonsense', 10), null);
});

test('PACE-DIALS: THE ROAD RULE - leaving a road takes every dial at x100 to x60 at once, and it never climbs back by itself; the panels are told either way', () => {
  fresh();
  const heard = [];
  onTravelPace((p, why) => heard.push([why, p.speed, p.foe]));
  setPaceGround(true);
  assert.deepEqual(heard.pop(), ['ground', 60, 5], 'the ground moved and no dial did: the + is told (x100 offered now)');
  setTravelPace('speed', 100); setTravelPace('foe', 100);
  assert.deepEqual({ ...travelPace() }, { speed: 100, foe: 100 });
  setPaceGround(false);
  assert.deepEqual({ ...travelPace() }, { speed: 60, foe: 60 }, 'off the road: x60 at once, both dials');
  assert.deepEqual(heard.pop(), ['ground', 60, 60]);
  setPaceGround(true);
  assert.deepEqual({ ...travelPace() }, { speed: 60, foe: 60 }, 'the next road does not lift it back - x100 is chosen again there');
  assert.deepEqual(heard.at(-1), ['ground', 60, 60], 'the + is told it may rise again');
  const told = heard.length;
  setPaceGround(true);
  assert.equal(heard.length, told, 'the same ground again says nothing');
  setTravelPace('speed', 40); setPaceGround(false);
  assert.equal(travelPace().speed, 40, 'a dial under x60 is left where it is');
});

test('PACE-DIALS: Near enemies - the foes\' floor is the player\'s dial (5..60, x100 on a road), ENEMY-PACE\'s x5 its default, never over the ask', () => {
  fresh();
  assert.equal(foePaced(1, 60), 5, 'the default floor: x5');
  setTravelPace('foe', 30);
  assert.equal(foePaced(1, 60), 30, 'the dial is the floor');
  assert.equal(foePaced(45, 60), 45, 'a farther foe holds less');
  assert.equal(foePaced(1, 20), 20, 'never over the journey\'s own ask');
  assert.equal(setTravelPace('foe', 100), 60, 'x100 off a road refused');
  setPaceGround(true); setTravelPace('foe', 100);
  assert.equal(paceNow('foe'), 100);
  assert.equal(foePaced(1, 100), 100);
});

test('PACE-DIALS: the steps walk the ladder and stop at the ground\'s top; a + says why it stops off a road', () => {
  fresh();
  setTravelPace('speed', 5);
  assert.equal(stepTravelPace('speed', -1), 5, 'the bottom holds');
  const up = [];
  for (let i = 0; i < 8; i++) up.push(stepTravelPace('speed', 1));
  assert.deepEqual(up, [10, 20, 30, 40, 60, 60, 60, 60], 'off a road the steps stop at x60');
  assert.equal(paceCanRise('speed'), false);
  setPaceGround(true);
  assert.equal(paceCanRise('speed'), true);
  assert.equal(stepTravelPace('speed', 1), 100, 'on a road the last step is x100');
  assert.equal(paceCanRise('speed'), false);
  assert.equal(stepTravelPace('speed', -1), 60);
});

test('PACE-DIALS: the dials are the device\'s - kept through the storage seam, read back on the open ground\'s ladder (a boot is on no known road)', () => {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  try {
    _resetTravelPace();
    setPaceGround(true); setTravelPace('speed', 100); setTravelPace('foe', 20);
    assert.deepEqual(JSON.parse(store.get(TRAVEL_PACE_STORE_KEY)), { speed: 100, foe: 20 });
    _resetTravelPace();
    assert.deepEqual({ ...travelPace() }, { speed: 60, foe: 20 }, 'x100 is chosen again on a road');
    store.set(TRAVEL_PACE_STORE_KEY, 'not json');
    _resetTravelPace();
    assert.deepEqual({ ...travelPace() }, { speed: 60, foe: 5 }, 'a bad word: the defaults');
  } finally { fresh(); }
});

/** A document enough for the steppers: elements with classes, text, children and handlers. */
function fakeDoc() {
  const mk = (tag) => {
    const n = { tag, className: '', textContent: '', title: '', disabled: false, children: [], attrs: {}, listeners: {}, style: {} };
    n.setAttribute = (k, v) => { n.attrs[k] = v; };
    n.append = (...c) => { n.children.push(...c); };
    n.addEventListener = (t, fn) => { n.listeners[t] = fn; };
    return n;
  };
  return { createElement: mk };
}

test('PACE-DIALS: the steppers - every skin\'s one builder - show the dial in force, refuse the + at x60 off a road with the reason, and press through the rule', () => {
  fresh();
  const c = buildPaceControls(fakeDoc(), 'tview');
  try {
    const rows = c.root.children.filter((n) => n.className === 'tview-pace-row');
    assert.equal(rows.length, 2, 'Speed and Near enemies');
    const [speed] = rows;
    const [word, down, num, up] = speed.children;
    assert.equal(word.textContent, 'Speed');
    assert.equal(num.textContent, '×60');
    assert.equal(up.disabled, true, 'x60 off a road: no higher');
    assert.equal(up.title, '×100 only on a road');
    assert.equal(up.tabIndex, -1, 'never the focus - Space is the world\'s');
    setPaceGround(true);
    assert.equal(up.disabled, false, 'on a road the + is offered');
    up.onclick({ preventDefault() {}, stopPropagation() {} });
    assert.equal(num.textContent, '×100');
    setPaceGround(false);
    assert.equal(num.textContent, '×60', 'leaving the road: x60 at once on the panel too');
    down.onclick({ preventDefault() {}, stopPropagation() {} });
    assert.equal(num.textContent, '×40');
  } finally { c.dispose(); fresh(); }
});

test('PACE-DIALS host: the world tells the rule its ground every frame a journey or the Overworld runs, a dial turned under a journey asks the clock again, and every other skin wears the pace box', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /if \(travelControlUI\?\.isShowing\) setPaceGround\(!!travelControlUI\.onRoad\);\n\s*else if \(travelView\?\.state === 'up'\) setPaceGround\(travellerOnRoad\(\)\);/, 'the journey\'s own ground, else the feet\'s under the view');
  assert.match(w, /const _stopPace = onTravelPace\(\(\) => \{ if \(!frameAlive\(_frameToken\)\) \{ _stopPace\(\); return; \} travelOptions\?\.reapplyRate\?\.\(\); \}\);/);
  assert.match(w, /if \(travelControlUI\?\.isShowing && typeof document !== 'undefined'\) showPaceBox\(\); else hidePaceBox\(\);/, 'the classic strip and GrimoireUI: the dials\' own box while a journey runs');
  assert.match(rd('src/systems/travelOptions.js'), /reapplyRate: \(\) => \{ if \(st\.autopilot && ui\?\.isShowing\) applyRate\(true\); \},/);
  assert.match(rd('src/systems/timeScale.js'), /export const travelRateOf = \(onRoad\) => paceRateOn\(onRoad\);/);
});
