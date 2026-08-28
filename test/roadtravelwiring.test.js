// R4W — TRAVELLING BY ROAD, WIRED. R4 shipped a router, a pricing
// path and 297 lines of tests, and nothing in src/ imported it: the
// map still walked the classic line twice, once for the bill and once
// for the flight. Wiring it first meant fixing two things inside it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { planJourney, walkRoadPath } from '../src/systems/roadTravel.js';
import { calculateTravelTime } from '../src/systems/travel.js';
import { createNetwork, linkPixels } from '../src/systems/roads.js';
import { CLIMATES, LOCATION_TYPES } from '../src/formats/mapsFile.js';
import { OverworldMapWindow } from '../src/ui/overworldMap.js';
import { setUiSkin } from '../src/systems/uiSkin.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (f) => readFileSync(join(root, f), 'utf8');

// A world with a LAKE that can be walked around, and a trunk road
// along row 5. The lake matters: a ship prices an ocean pixel at 51
// against a foot traveller's ~204, so a least-cost search will sail
// across it unless it is told not to.
const W = 60, H = 40;
const clim = new Uint8Array(W * H);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    clim[y * W + x] = (y >= 15 && y <= 25 && x >= 20 && x <= 40)
      ? CLIMATES.Ocean : (CLIMATES.Ocean + 1 + ((x * y) % 8));
  }
}
const climateAt = (x, y) => clim[y * W + x];
const net = createNetwork(W, H);
for (let x = 1; x < W - 1; x++) linkPixels(net.trunkExits, W, x, 5, x + 1, 5);
const calc = (s, e, o) => calculateTravelTime(s, e, o, climateAt);
const journey = (a, b, opts, network = net) => planJourney(a, b, {
  enabled: Boolean(network), width: W, height: H, climateAt, network, opts, calculate: calc,
});

test('R4W: a road route stays on LAND - it will not sail across an avoidable lake', () => {
  // Both endpoints sit NORTH of the lake, so any ocean pixel on the
  // path is a DETOUR into it. Measured before the fix: 6 of 300
  // journeys detoured with a ship on foot, 0 with a horse (which makes
  // the land term cheap enough to win on its own).
  let detoured = 0, tested = 0;
  for (let i = 0; i < 300; i++) {
    const a = { x: 2 + (i * 7) % 16, y: 2 + (i * 3) % 10 };
    const b = { x: 44 + (i * 5) % 14, y: 2 + (i * 11) % 10 };
    const j = journey(a, b, { travelShip: true, speedCautious: true });
    tested++;
    if (j.path.some((p) => climateAt(p.x, p.y) === CLIMATES.Ocean)) detoured++;
  }
  assert.equal(tested, 300);
  assert.equal(detoured, 0, 'no road journey detours into water it could walk around');
});

test('R4W: but SEA travel is not lost - an unavoidable crossing still sails', () => {
  // A band of ocean the whole width of the map. The router can find no
  // land route at all, so planJourney falls back to classic's walk -
  // which is exactly the crossing a ship is for.
  const band = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      band[y * W + x] = (y >= 18 && y <= 22) ? CLIMATES.Ocean : (CLIMATES.Ocean + 2);
    }
  }
  const seaAt = (x, y) => band[y * W + x];
  const j = planJourney({ x: 5, y: 5 }, { x: 50, y: 34 }, {
    enabled: true, width: W, height: H, climateAt: seaAt, network: net,
    opts: { travelShip: true, speedCautious: true },
    calculate: (s, e, o) => calculateTravelTime(s, e, o, seaAt),
  });
  assert.ok(j.path.length > 0, 'the journey still happens');
  assert.ok(j.path.some((p) => seaAt(p.x, p.y) === CLIMATES.Ocean), 'and it crosses the water');
  assert.equal(j.byRoad, false, 'honestly reported as not a road journey');
});

test('R4W: the guarantee is STRUCTURAL - a road journey never costs more than classic', () => {
  // The header argued this from classic's walk being a member of the
  // searched graph. That held when measured (0 of 900), and then the
  // land-only rule removed some of classic's walks from that graph -
  // so planJourney prices BOTH and takes the cheaper, and the property
  // survives the router changing again.
  for (const opts of [
    { travelShip: true, speedCautious: true },
    { travelShip: false, speedCautious: true },
    { travelShip: true, hasHorse: true, speedCautious: true },
    { travelShip: true, sleepModeInn: true, hasCart: true },
  ]) {
    let worse = 0;
    for (let i = 0; i < 200; i++) {
      const a = { x: 2 + (i * 7) % 25, y: 2 + (i * 3) % 12 };
      const b = { x: 30 + (i * 5) % 28, y: 26 + (i * 11) % 12 };
      const road = journey(a, b, opts);
      const classic = calc(a, b, opts);
      if (road.minutes > classic.minutes) worse++;
    }
    assert.equal(worse, 0, `a road journey costs more than classic under ${JSON.stringify(opts)}`);
  }
});

test('R4W: byRoad means the path actually touches road, not that a router ran', () => {
  // A journey in open country far from the row-5 trunk is routed, and
  // costs what classic costs - calling that "by road" would be a lie
  // on the card.
  const far = journey({ x: 3, y: 30 }, { x: 12, y: 34 }, { speedCautious: true });
  assert.equal(far.byRoad, false, 'open country is not a road journey');
  // ...while one that runs along the trunk is
  const along = journey({ x: 3, y: 5 }, { x: 50, y: 5 }, { speedCautious: true });
  assert.equal(along.byRoad, true, 'a journey down the trunk is');
});

test('R4W: with no network at all the answer is classic\'s, exactly', () => {
  const opts = { travelShip: true, speedCautious: true };
  const a = { x: 4, y: 4 }, b = { x: 40, y: 30 };
  const off = journey(a, b, opts, null);
  const classic = calc(a, b, opts);
  assert.equal(off.byRoad, false);
  assert.equal(off.minutes, classic.minutes, 'the enhanced slice charges nothing extra when it is off');
  assert.equal(off.oceanPixels, classic.oceanPixels);
});

test('R4W: walkRoadPath refuses a water goal rather than routing to it', () => {
  const into = walkRoadPath({ x: 5, y: 5 }, { x: 30, y: 20 }, {
    width: W, height: H, climateAt, network: net, opts: { travelShip: true },
  });
  assert.equal(into, null, 'a pixel in the lake is not reachable by road');
});

// ── the wiring itself ────────────────────────────────────────────
test('R4W: the map runs ONE journey for the bill, the line and the flight', () => {
  const map = src('src/ui/overworldMap.js');
  assert.match(map, /import \{ planJourney \} from '\.\.\/systems\/roadTravel\.js'/, 'the view imports the slice');
  assert.match(map, /_journey\(dest, opts\) \{/, 'and holds one journey');
  assert.match(map, /const time = this\._journey\(dest, \{/, 'the CARD bills from it');
  assert.match(map, /\}\)\.path;/, 'and the FLIGHT flies the same path');
  // the second walk is gone: the view no longer computes a path of
  // its own for the camera.
  assert.equal(/walkTravelPath\(/.test(map), false, 'no second walk in the view');
  // memoised, or the card would re-route on every re-render
  assert.match(map, /if \(this\._journeyKey === key\) return this\._journeyVal;/);
  // and the host supplies the network the router searches
  assert.match(src('src/scenes/world.js'), /roadNetwork: \(\) => roadNetwork,/);
});

test('R4W: the Switches row promises only what is reachable', () => {
  const menu = src('src/ui/enhancedMenu.js');
  const row = menu.slice(menu.indexOf("prefRow('roads'"), menu.indexOf("prefRow('roads'") + 500);
  assert.match(row, /drawn on the ground and on the travel map/, 'both draw claims');
  assert.match(row, /travel follows them/, 'and the travel claim, now that it is true');
});


// ── the view actually ROUTES, not merely holds a helper ──────────
/** The window needs a document; node drives these hosts headless. */
function withDocument(fn) {
  const had = typeof globalThis.document !== 'undefined';
  if (!had) {
    const mk = () => ({
      style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {} },
      children: [], appendChild(c) { this.children.push(c); return c; }, append(...c) { this.children.push(...c); },
      addEventListener() {}, removeEventListener() {}, remove() {}, setAttribute() {}, focus() {},
      querySelector: () => null, querySelectorAll: () => [], insertBefore(c) { this.children.push(c); return c; },
      get firstChild() { return this.children[0] ?? null; }, removeChild() {}, contains: () => false,
    });
    globalThis.document = {
      createElement: mk, createTextNode: mk, body: mk(), head: mk(),
      getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
      addEventListener() {}, removeEventListener() {},
    };
  }
  try { return fn(); } finally { if (!had) delete globalThis.document; }
}

test('R4W: the WINDOW routes by road when the host gives it a network', () => {
  // The source pins above would all pass with `enabled` hard-wired
  // false at the view - the router present, held, memoised and never
  // consulted. This drives the window itself.
  setUiSkin('enhanced');
  withDocument(() => {
    const deps = {
      getPlayerPixel: () => ({ x: 3, y: 5 }),
      getClimateIndex: (x, y) => climateAt(x, y),
      woods: { heightMapBuffer: new Uint8Array(W * H).fill(10) },
      mapSize: { width: W, height: H },
      gold: () => 10000, goldPieces: () => 10000,
      hasHorse: false, hasCart: false, hasShip: false,
      diseaseCount: () => 0, poisonCount: () => 0,
      roadNetwork: () => net,
    };
    const win = new OverworldMapWindow(deps);
    // a destination straight down the row-5 trunk
    const j = win._journey({ x: 50, y: 5 }, { speedCautious: true });
    assert.equal(j.byRoad, true, 'the view routed along the trunk');
    // ...and the same call twice is the SAME object - one journey
    assert.equal(win._journey({ x: 50, y: 5 }, { speedCautious: true }), j,
      'memoised, so the card and the flight cannot disagree');
    win.dispose?.();
  });
});
