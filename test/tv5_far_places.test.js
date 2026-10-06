// TV5 (2026-09-28, bible/06-Systems/Travel-View.md, Mac choosing between the horizon's town shapes and these: "Edge
// markers") and PERF-TV (Mac: "I also want to ensure performance is golden").
//
// TV5: the discovered settlements past the streamed grid, the nearest within reach, held at the view's edge with their
// distance - a click a journey there by the roads (systems/travelFarPlaces.js, scenes/world.js). PERF-TV: the readout's
// marks are DRAWN on one canvas (ui/travelViewHud.js), a click on a plate found by where it landed, the screen's size
// read once a frame, and a picture that did not change never drawn again; the world host keeps the marks' scene
// points, the route's far legs and the cap's count between the ground's changes. The browser's own measure is
// tools/travelViewPerf.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  TV_FAR_RANGE, TV_FAR_MAX, TV_FAR_TYPES, PIXEL_KM, farDistanceText, settlementPixels, farPlaces,
} from '../src/systems/travelFarPlaces.js';
import { LOCATION_TYPES } from '../src/formats/mapsFile.js';
import { curtainsOf, CURTAINS_MAX, CURTAIN_FOOT_SAMPLES, CURTAIN_MEMO_M } from '../src/render/rainCurtains.js';
import { cellOf } from '../src/render/volumetricClouds.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

// ── TV5: THE FAR PLACES ─────────────────────────────────────────────────────────────────────────────────────────────

test('TV5 law: the settlements are DFU\'s town trio - a city, a town, a village; a pixel is 0.8192 km; distances in tenths under ten kilometres, whole ones past', () => {
  assert.deepEqual([...TV_FAR_TYPES].sort(), [LOCATION_TYPES.TownCity, LOCATION_TYPES.TownHamlet, LOCATION_TYPES.TownVillage].sort());
  assert.equal(PIXEL_KM, 0.8192);
  assert.deepEqual([TV_FAR_RANGE, TV_FAR_MAX], [24, 10]);
  assert.equal(farDistanceText(6.44), '6.4 km');
  assert.equal(farDistanceText(9.96), '10.0 km');
  assert.equal(farDistanceText(12.6), '13 km');
  assert.equal(farDistanceText(-1), '');
  assert.equal(farDistanceText(NaN), '');
  const index = new Map([
    ['10,20', { name: 'Ripwych', mapTableData: { locationType: LOCATION_TYPES.TownHamlet } }],
    ['11,20', { name: 'Old Keep', mapTableData: { locationType: LOCATION_TYPES.DungeonKeep } }],
    ['12,20', { name: 'Chapel', mapTableData: { locationType: LOCATION_TYPES.ReligionTemple } }],
    ['13,20', { name: 'Daggerfall', mapTableData: { locationType: LOCATION_TYPES.TownCity } }],
    ['14,20', { name: '', mapTableData: { locationType: LOCATION_TYPES.TownVillage } }],
  ]);
  assert.deepEqual(settlementPixels(index).map((s) => [s.x, s.y, s.loc.name]), [[10, 20, 'Ripwych'], [13, 20, 'Daggerfall']], 'a dungeon, a temple and a nameless row are not destinations the edge speaks for');
});

test('TV5 law: the far places start where the grid ends and stop at the range, discovered only, the nearest first and at most TV_FAR_MAX', () => {
  const at = { x: 500, y: 250 };
  const settlements = [];
  for (let d = 1; d <= 30; d++) settlements.push({ x: 500 + d, y: 250 }, { x: 500, y: 250 - d });
  const discovered = (x, y) => (y === 250 && x % 2 === 1 ? null : { mapId: x * 1000 + y, name: `P${x},${y}` });   // every other place east unfound
  const list = farPlaces({ at, near: 3, settlements, summaryOf: discovered });
  assert.equal(list.length, TV_FAR_MAX);
  assert.ok(list.every((f) => Math.max(Math.abs(f.x - at.x), Math.abs(f.y - at.y)) > 3), 'the grid\'s own places wear plates on the land');
  assert.ok(list.every((f) => f.summary), 'discovered only - DFU\'s own law');
  assert.ok(list.every((f, i) => i === 0 || list[i - 1].d <= f.d), 'nearest first');
  assert.equal(list[0].d, 4, 'the first past the grid');
  assert.match(list[0].key, /^far:\d+$/);
  const all = farPlaces({ at, near: 3, settlements, summaryOf: discovered, max: 100 });
  assert.ok(all.every((f) => Math.max(Math.abs(f.x - at.x), Math.abs(f.y - at.y)) <= TV_FAR_RANGE), `none past ${TV_FAR_RANGE} pixels`);
  assert.ok(!all.some((f) => f.y === 250 && f.x % 2 === 1), 'an undiscovered place is never marked');
  // AUDIT DEEP2 F8: the range is a CIRCLE - a town on the diagonal 17 pixels each way (19.7 km along an axis, 24 px out) is
  // past it; its square's corner was 28 km off and read so on its plate
  const diag = farPlaces({ at, near: 3, settlements: [{ x: 517, y: 267 }, { x: 516, y: 266 }], summaryOf: () => ({ mapId: 1, name: 'D' }) });
  assert.deepEqual(diag.map((f) => [f.x, f.y]), [[516, 266]], `within ${TV_FAR_RANGE} pixels straight-line, not a square's corner`);
  assert.ok(diag.every((f) => f.d * PIXEL_KM <= 20), 'about 20 km every way');
});

test('TV5 host wiring: the far places are rebuilt on a pixel (or a reach) change from the world\'s settlements gathered once; each a pickable plate held at the edge, its distance under its name; a click on one is the same journey as a place\'s; a load forgets them', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /let tvFar = \{ at: null, near: -1, list: \[\] \};/);
  assert.ok(((i, j) => i >= 0 && j >= 0 && i < j)(w.indexOf('let tvFar = { at: null, near: -1, list: [] };'), w.indexOf('tvFar = { at: null, near: -1, list: [] };   // TV5: nor the far places')), 'BOOT-TDZ: declared above the load that clears it');
  assert.match(w, /if \(tvFar\.at && tvFar\.at\.x === at\.x && tvFar\.at\.y === at\.y && tvFar\.near === near && tvFar\.dg === dg\) return tvFar\.list;/);
  assert.match(w, /farPlaces\(\{ at, near, settlements: \(_tvSettlements \?\?= settlementPixels\(locationIndex\)\), summaryOf: tvPlaceSummary \}\)/);
  assert.match(w, /marks\.push\(\{ key: f\.key, at: tvSceneKept\(f, f\.x, f\.z, TV_PLACE_LIFT\), label: f\.summary\.name, sub: farDistanceText\(km\), kind: 'far', pick: true, edge: true, hub: carriageTown\(f\.summary\.mapId\), tip: seatTipAt\(f\.summary\.mapId\) \}\);/);   // PIN MOVED (FIELD BUGS 2026-10-04e OW-HUBS, SEAT-TIP)
  assert.match(w, /const farEnd = endKey \? `far:\$\{tvTrip\.plan\.summary\.mapId\}` : null;/, 'the journey\'s own end is the flag\'s, not a plate at the edge');
  assert.match(w, /for \(const f of travelViewFarPlaces\(\)\) \{\n\s*if \(f\.key === farEnd\) continue;/);
  assert.match(w, /const plate = tvPlates\.list\.find\(\(p\) => p\.key === key\) \?\? tvFar\.list\.find\(\(p\) => p\.key === key\)( \?\? tvDng\.list\.find\(\(p\) => p\.key === key && p\.summary\))?;/);   // TV6: and a found dungeon's
  // PIN MOVED (AUDIT OW5 D1): the find's own list emptied beside the dungeons'
  assert.match(w, /tvFar = \{ at: null, near: -1, list: \[\] \};   \/\/ TV5: nor the far places\n\s*(tvDng = \{ at: null, dg: -1, list: \[\] \};   \/\/ TV6: nor the dungeons\n\s*tvFind = \{ at: null, dg: -1, n: -1, list: \[\] \};[^\n]*\n\s*)?(tvBandSeen = [^\n]*\n\s*)?travelView\?\.exit\('load', true\);/);
});

// ── PERF-TV: THE READOUT, DRAWN ─────────────────────────────────────────────────────────────────────────────────────

/** A document just real enough for the readout: elements, a canvas whose 2D context records what it is told, and a
 *  window whose size is COUNTED when read (a read after a write is a forced layout in a browser). `rects` stands the
 *  HUD's furniture up: `bar` the view's own bar's box, `others` what the page's query finds - each box read COUNTED. */
function fakeDoc({ rects = null, w = 1280, h = 720 } = {}) {
  const calls = [], draws = [], texts = [], fills = [], strokes = [], moves = [];
  const ctx = new Proxy({ calls }, {
    // AUDIT NAMES N1-9: a gradient is a thing with stops, and a fill and a stroke say what they painted in
    get: (t, k) => (k in t ? t[k] : k === 'measureText' ? (s) => ({ width: String(s).length * 7 }) : k === 'createLinearGradient' ? () => ({ gradient: true, addColorStop() {} }) : (...a) => {
      calls.push(k);
      if (k === 'drawImage') draws.push(a);
      if (k === 'translate') moves.push(a);
      if (k === 'fillText') texts.push([String(a[0]), t.fillStyle, t.font, t.shadowBlur]);
      if (k === 'fill') fills.push([t.fillStyle, a[0]?.d ?? null]);
      if (k === 'stroke') strokes.push([t.strokeStyle, t.lineWidth, t.lineJoin, a[0]?.d ?? null]);
    }),
    set: (t, k, v) => { t[k] = v; return true; },
  });
  const reads = { n: 0 };
  const win = { devicePixelRatio: 1, addEventListener() {}, removeEventListener() {} };
  Object.defineProperty(win, 'innerWidth', { get() { reads.n++; return w; } });
  Object.defineProperty(win, 'innerHeight', { get() { reads.n++; return h; } });
  const doc = { defaultView: win, fonts: null };
  const rectReads = { n: 0 };
  const box = (r) => { rectReads.n++; return r ?? { width: 0, height: 0 }; };
  // These lightweight boxes model only the furniture query. Returning them for the HUD
  // editor's unrelated selectors caused a timing-dependent crash when its sweep became due.
  if (rects) doc.querySelectorAll = (selector) => selector === '.hud-top, .hud-bottom, .hud-quick, .travelpanel-bar, .travelpanel-junction, .dftouch-btn, .qtrack'
    ? (rects.others ?? []).map((r) => ({ getBoundingClientRect: () => box(r) })) : [];
  const mk = (tag) => {
    const n = {
      tagName: tag.toUpperCase(), className: '', textContent: '', id: '', children: [], style: { setProperty() {} }, ownerDocument: doc,
      attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k]; },
      append(...c) { this.children.push(...c); }, remove() {}, addEventListener() {}, isConnected: true,
      width: 0, height: 0, getBoundingClientRect() { return box(this.className === 'tview-bar' ? rects?.bar : this.className === 'tview-back' ? rects?.back : null); },
    };
    if (tag === 'canvas') n.getContext = () => ctx;
    return n;
  };
  Object.assign(doc, {
    createElement: mk, createElementNS: (_, tag) => mk(tag), getElementById: () => null,
    head: mk('head'), body: mk('body'),
  });
  const find = (cls, n = doc.body) => (n.className === cls ? n : (n.children ?? []).map((c) => find(cls, c)).find(Boolean) ?? null);
  return { doc, win, calls, draws, texts, fills, strokes, moves, reads, rectReads, find, ctx };
}

test('PERF-TV readout: every mark on the one canvas; the screen read ONCE a frame however many marks are held at its edge; a picture that did not change is not drawn again; a moved one is', async () => {
  const hud = await import('../src/ui/travelViewHud.js');
  const { doc, calls, reads } = fakeDoc();
  hud.showTravelViewHud({}, doc);
  try {
    const marks = [];
    // PIN MOVED (OW-CROWD): forty marks held at one edge - a band's each, never folded (forty travellers there are one
    // crowd's arrow now, test/owcrowd.test.js)
    for (let i = 0; i < 40; i++) marks.push({ key: `band:${i}`, x: 3000 + i, y: 100, front: false, label: `Rider ${i}`, kind: 'band', edge: true });   // all held at the edge
    marks.push({ key: 'place:1', x: 600, y: 300, front: true, label: 'Ripwych', kind: 'place', pick: true });
    const frame = { feet: { x: 640, y: 360, front: true }, heading: 0, yaw: 0, where: 'w', marks };
    reads.n = 0;
    hud.updateTravelViewHud(frame);
    assert.equal(reads.n, 2, `the screen read once a frame - its width and its height - not once a mark (${reads.n} reads for 41 marks)`);
    const drew = calls.filter((c) => c === 'drawImage').length;
    assert.ok(drew >= 41, `every label drawn (${drew})`);
    assert.deepEqual(hud.travelViewHudState().marks.length, 41);
    calls.length = 0;
    hud.updateTravelViewHud(frame);
    assert.equal(calls.filter((c) => c === 'clearRect' || c === 'drawImage').length, 0, 'at rest: the canvas already shows it');
    hud.updateTravelViewHud({ ...frame, marks: marks.map((m, i) => (i === 40 ? { ...m, x: m.x + 3 } : m)) });
    assert.ok(calls.includes('clearRect') && calls.includes('drawImage'), 'a plate moved: drawn again');
  } finally { hud.disposeTravelViewHud(); }
});

test('PERF-TV readout: a click on a drawn plate is found where it landed (the one on top); beside it, and on a mark that takes none, nothing; hidden, nothing', async () => {
  const hud = await import('../src/ui/travelViewHud.js');
  const { doc } = fakeDoc();
  hud.showTravelViewHud({}, doc);
  try {
    hud.updateTravelViewHud({ feet: null, heading: null, yaw: 0, where: '', marks: [
      { key: 'place:1', x: 600, y: 300, front: true, label: 'Ripwych', kind: 'place', pick: true },
      { key: 'trav:a', x: 900, y: 300, front: true, label: 'Rider', kind: 'traveller' },
      { key: 'far:9', x: 5000, y: 300, front: true, label: 'Daggerfall', sub: '12 km', kind: 'far', pick: true, edge: true },
    ] });
    const hits = hud.travelViewHudState().hits;
    assert.deepEqual(hits.map((h) => h.key), ['place:1', 'far:9'], 'the pickable ones, and only they');
    assert.equal(hud.travelViewHudPickAt(600, 290), 'place:1', 'on the plate over the town');
    assert.equal(hud.travelViewHudPickAt(600, 340), null, 'well below it: the ground');
    assert.equal(hud.travelViewHudPickAt(900, 305), null, 'a traveller takes no click');
    const far = hits.find((h) => h.key === 'far:9');
    assert.ok(far.x1 <= 1280 && far.x0 > 1000, `the far place held at the right edge, its plate kept on the screen (${far.x0}..${far.x1})`);
    assert.equal(hud.travelViewHudPickAt((far.x0 + far.x1) / 2, (far.y0 + far.y1) / 2), 'far:9');
    hud.updateTravelViewHud({ feet: null, heading: null, yaw: 0, where: '', marks: [
      { key: 'place:1', x: 600, y: 300, front: true, label: 'Ripwych', kind: 'place', pick: true },
      { key: 'place:2', x: 610, y: 302, front: true, label: 'Ripwych Hollow', kind: 'place', pick: true },
    ] });
    assert.equal(hud.travelViewHudPickAt(605, 290), 'place:2', 'two plates overlapping: the one drawn on top takes it');
    hud.hideTravelViewHud();
    assert.equal(hud.travelViewHudPickAt(600, 290), null, 'hidden: nothing takes a click');
  } finally { hud.disposeTravelViewHud(); }
});

test('PERF-TV by source: the view asks the readout before it picks; the host keeps the marks\' scene points between the ground\'s changes (the route\'s far legs and the cap\'s count are tv2\'s pins)', () => {
  const v = rd('src/scenes/travelView.js');
  assert.match(v, /const key = deps\.hud\?\.pickAt\?\.\(e\.clientX, e\.clientY\) \?\? null;\n\s*if \(key\) deps\.onMark\?\.\(key, e\); else deps\.onPick\?\.\(e\.clientX, e\.clientY, e\);/);
  const w = rd('src/scenes/world.js');
  assert.match(w, /hud: \{ show: showTravelViewHud, hide: hideTravelViewHud, update: updateTravelViewHud, pickAt: travelViewHudPickAt \},/);
  assert.match(w, /if \(k\[0\] !== built\.size \|\| k\[1\] !== state\.mapOrigin\.x \|\| k\[2\] !== state\.mapOrigin\.y \|\| k\[3\] !== c\[0\] \|\| k\[4\] !== c\[1\] \|\| k\[5\] !== c\[2\] \|\| t - k\[6\] > 500\) \{/, 'the ground moves on a build, a drop, a re-anchor - and every half second besides');
  assert.match(w, /if \(holder\._tvGen !== gen \|\| holder\._tvNx !== nx \|\| holder\._tvNz !== nz( \|\| holder\._tvSea !== onSea)?\) \{/);   // OWS1: and the sea's top asked
  for (const re of [/at: tvSceneKept\(p, p\.x, p\.z, TV_PLACE_LIFT\)/, /at: tvSceneKept\(e, e\.x, e\.z, place \? TV_PLACE_LIFT : 0\)/, /at: tvSceneKept\(t, w\.x, w\.z, 2(, ship)?\)/]) assert.match(w, re);   // OWS1: a traveller at sea's on the sea's top
  const h = rd('src/ui/travelViewHud.js');
  assert.match(h, /const vw = win\?\.innerWidth \?\? 0, vh = win\?\.innerHeight \?\? 0, dpr = win\?\.devicePixelRatio \|\| 1;   \/\/ read ONCE, before any write/);
  assert.match(h, /if \(sig\.length === canvasSig\.length && sig\.every\(\(v, i\) => v === canvasSig\[i\]\)\) return;/);
  assert.match(h, /doc\.fonts\?\.addEventListener\?\.\('loadingdone', \(\) => \{ dropSprites\(\); canvasSig = \[\]; \}\);/, 'a label drawn before the plates\' face arrived is drawn again');
  assert.match(h, /function dropSprites\(\) \{ sprites\.clear\(\); spritePixels = 0; \}/);
});

test('PERF-TV curtains: the lowest land asked only under the veils kept (CURTAINS_MAX of many), and a host\'s memo keeps it while a veil drifts within CURTAIN_MEMO_M - the same veils, not one sample more', () => {
  let asked = 0;
  const groundAt = (x, z) => { asked += 1; return 100 - Math.abs(Math.sin(x * 0.001 + z * 0.002)) * 40; };
  const cells = Array.from({ length: 24 }, (_, i) => cellOf('rain', CURTAIN_MEMO_M * (25 + i * 5), CURTAIN_MEMO_M * (19 + (i % 5) * 6), 600));   // on the memo's own steps
  const at = { focus: [0, 101.7, 0], eye: [0, 400, -300], ground: 100, groundAt };
  const bare = curtainsOf(cells, at);
  assert.equal(bare.length, CURTAINS_MAX, 'more cells than slots');
  const each = 1 + 2 * CURTAIN_FOOT_SAMPLES;
  assert.equal(asked, CURTAINS_MAX * each, 'a veil not kept asks the land nothing');
  const memo = new Map();
  asked = 0;
  assert.deepEqual(curtainsOf(cells, { ...at, memo }), bare, 'the memo changes no veil');
  assert.equal(asked, CURTAINS_MAX * each);
  asked = 0;
  const drift = CURTAIN_MEMO_M * 0.2;
  const moved = cells.map((c) => ({ ...c, x: c.x + drift }));
  const again = curtainsOf(moved, { ...at, memo });
  assert.equal(asked, 0, 'drifted within the memo\'s step, the land is not asked again');
  assert.equal(again.length, CURTAINS_MAX);
  asked = 0;
  curtainsOf(cells.map((c) => ({ ...c, x: c.x + CURTAIN_MEMO_M * 3 })), { ...at, memo });
  assert.equal(asked, CURTAINS_MAX * each, 'drifted a veil\'s step and more, asked afresh');
});

test('EDGE-DECLUTTER: marks held at one edge in much the same direction slide apart - down a side, along the top - in their own order, each still taking its own click; a rider parts a town\'s plate too; an edge too crowded spaces them evenly on the screen', async () => {
  const hud = await import('../src/ui/travelViewHud.js');
  const { doc } = fakeDoc();   // 1280 x 720
  hud.showTravelViewHud({}, doc);
  const far = (key, x, y, extra = {}) => ({ key, x, y, front: true, label: key, sub: '12 km', kind: 'far', pick: true, edge: true, ...extra });
  const frame = (marks) => { hud.updateTravelViewHud({ feet: null, heading: null, yaw: 0, where: '', marks }); return hud.travelViewHudState().hits; };
  const apart = (a, b, lo, hi) => a[hi] <= b[lo] || b[hi] <= a[lo];
  try {
    // two towns off the right edge, ten pixels apart in the projection - held a pixel apart; listed lower first
    let hits = frame([far('far:low', 5000, 310), far('far:high', 5000, 300)]);
    let [hi, lo] = ['far:high', 'far:low'].map((k) => hits.find((h) => h.key === k));
    assert.ok(apart(hi, lo, 'y0', 'y1'), `their boxes part (${hi.y0}..${hi.y1} / ${lo.y0}..${lo.y1})`);
    assert.ok(hi.y0 < lo.y0, 'the one higher in the world stays the higher');
    assert.ok(hi.y0 + 24 < 352 && lo.y0 + 24 > 353, `the pair centred on where they would stand (352, 353): ${hi.y0 + 24}, ${lo.y0 + 24}`);
    assert.ok(hi.x1 <= 1280 && lo.x1 <= 1280, 'both on the screen');
    assert.equal(hud.travelViewHudPickAt((lo.x0 + lo.x1) / 2, (lo.y0 + lo.y1) / 2), 'far:low');
    assert.equal(hud.travelViewHudPickAt((hi.x0 + hi.x1) / 2, (hi.y0 + hi.y1) / 2), 'far:high');
    // along the top: they part sideways, not down
    hits = frame([far('far:b', 620, -5000), far('far:a', 600, -5000)]);
    const [a, b] = ['far:a', 'far:b'].map((k) => hits.find((h) => h.key === k));
    assert.ok(apart(a, b, 'x0', 'x1'), `side by side (${a.x0}..${a.x1} / ${b.x0}..${b.x1})`);
    assert.ok(a.x0 < b.x0, 'in their own order');
    assert.equal(a.y0, b.y0, 'both on the top edge');
    // a rider (no click of its own) held where a town is: the town's plate is moved off the rider's label
    const alone = frame([far('far:t', 5000, 310)])[0];
    hits = frame([{ key: 'trav:r', x: 5000, y: 300, front: true, label: 'Rider', kind: 'traveller', edge: true }, far('far:t', 5000, 310)]);
    const t = hits.find((h) => h.key === 'far:t');
    assert.ok(t.y0 >= alone.y0 + 20, `the town moved down off the rider's label (${alone.y0} alone, ${t.y0} beside it)`);
    // twenty in one direction: more than the side holds - spaced evenly down it, in order, none off the screen
    hits = frame(Array.from({ length: 20 }, (_, i) => far(`far:${String(i).padStart(2, '0')}`, 5000, 300 + i * 0.1)));
    const mids = hits.map((h) => (h.y0 + h.y1) / 2);
    assert.equal(hits.length, 20);
    for (let i = 1; i < 20; i++) assert.ok(mids[i] > mids[i - 1], `in order down the edge (${mids[i - 1]} < ${mids[i]})`);
    assert.ok(hits[0].y0 >= 0 && hits[19].y0 < 720, `on the screen (${hits[0].y0} .. ${hits[19].y0})`);
  } finally { hud.disposeTravelViewHud(); }
});

test('EDGE-FURNITURE law: a point under the top\'s or the foot\'s furniture is held at its edge, as one off the screen is; straight behind lands on the foot\'s edge, not under the bar', async () => {
  const { edgeHold } = await import('../src/ui/travelViewHud.js');
  const W = 1280, H = 720, M = 28;
  const under = edgeHold({ x: 640, y: 700, front: true }, W, H, M, M, 100);
  assert.ok(under && Math.abs(under.y - 620) < 1e-9 && Math.abs(under.angle - 180) < 1e-9, `under the bar: held on its edge, pointing down (${JSON.stringify(under)})`);
  assert.equal(edgeHold({ x: 640, y: 600, front: true }, W, H, M, M, 100), null, 'above it: in the picture');
  assert.equal(edgeHold({ x: 640, y: 360, front: false }, W, H, M, M, 100).y, 620, 'straight behind: on the foot\'s edge');
  assert.equal(edgeHold({ x: 640, y: 50, front: true }, W, H, M, 120, M).y, 120, 'under the compass or the panel: held below it');
  assert.equal(edgeHold({ x: 640, y: 700, front: true }, W, H).y, H - M, 'no furniture given: the margin, as before');
});

test('EDGE-FURNITURE readout: marks behind the camera stand ABOVE the bar with their names over their arrows; ahead, below the compass and a journey\'s panel; a side\'s mark keeps its label off the bar; the furniture measured twice a second, not every frame', async () => {
  const hud = await import('../src/ui/travelViewHud.js');
  const bar = { left: 336, right: 944, top: 638, bottom: 702, width: 608, height: 64 };
  const compass = { left: 490, right: 790, top: 18, bottom: 48, width: 300, height: 30 };
  const panel = { left: 276, right: 1004, top: 60, bottom: 124, width: 728, height: 64 };
  const { doc, rectReads, draws } = fakeDoc({ rects: { bar, others: [compass, panel] } });
  hud.showTravelViewHud({}, doc);
  const far = (key, x, y, front) => ({ key, x, y, front, label: key, sub: '12 km', kind: 'far', pick: true, edge: true });
  const f = { feet: null, heading: null, yaw: 0, where: '', marks: [
    far('far:behind-a', 700, 200, false), far('far:behind-b', 560, 100, false),   // behind: the foot
    far('far:ahead', 640, -5000, true),                                            // ahead, off the top
    far('far:side', 1500, 700, true),                                              // off the right, low - by the bar
  ] };
  try {
    hud.updateTravelViewHud(f); hud.updateTravelViewHud(f);   // the first frame's words change the bar: measured again on the second
    const settled = rectReads.n;
    for (let i = 0; i < 28; i++) hud.updateTravelViewHud(f);
    const hits = hud.travelViewHudState().hits, at = (k) => hits.find((h) => h.key === k);
    const over = (x0, y0, x1, y1, r) => x1 > r.left && x0 < r.right && y1 > r.top && y0 < r.bottom;
    const low = draws.filter(([, x, y, w, h]) => over(x, y, x + w, y + h, bar));
    assert.deepEqual(low.map(([, x, y]) => [x, y]), [], 'no name or distance drawn into the bar');
    for (const k of ['far:behind-a', 'far:behind-b']) {
      const h = at(k);
      assert.ok(h.y1 <= bar.top, `${k}: above the bar (${h.y0}..${h.y1}, the bar from ${bar.top})`);
      assert.ok(h.y1 - h.y0 > 40 && h.y1 - 10 > h.y0 + 30, `${k}: its name and distance over its arrow (${h.y0}..${h.y1})`);
    }
    assert.ok(at('far:ahead').y0 + 24 >= panel.bottom + 12, `ahead: its arrow below the panel (${at('far:ahead').y0 + 24})`);
    const side = at('far:side');
    assert.ok(!over(side.x0, side.y0, side.x1, side.y1, bar), `the side's low mark keeps its label off the bar (${JSON.stringify(side)})`);
    // FILTERS-LEFT (2026-10-06): a measure reads the filters' own block too - five boxes where it read four
    assert.ok(settled > 0 && settled <= 10 && rectReads.n === settled, `thirty frames: measured on the first two, then not again (${settled}, then ${rectReads.n} box reads)`);
    hud.updateTravelViewHud({ ...f, trip: 'To Ripwych, by the road' }); hud.updateTravelViewHud({ ...f, trip: 'To Ripwych, by the road' });
    assert.equal(rectReads.n - settled, 5, 'a journey\'s line in the bar (a taller bar): measured again the next frame');
    hud.hideTravelViewHud(); hud.showTravelViewHud({}, doc);
    const before = rectReads.n;
    hud.updateTravelViewHud(f);
    assert.equal(rectReads.n - before, 5, 'shown again: measured again at once - the bar, its Return, the two pieces and the filters\' block');
  } finally { hud.disposeTravelViewHud(); }
  // the pieces it measures are the HUD's own - a class renamed in the style sheet would leave a mark under it unseen
  const h = rd('src/ui/travelViewHud.js'), css = rd('src/ui/enhancedStyle.js');
  const sel = h.match(/const FURNITURE = '([^']+)';/);
  assert.ok(sel, 'the furniture named in one place');
  assert.deepEqual(sel[1].split(', '), ['.hud-top', '.hud-bottom', '.hud-quick', '.travelpanel-bar', '.travelpanel-junction', '.dftouch-btn', '.qtrack'],
    'the compass, the vitals and hotbar, the quick-slot block, a journey\'s panel and its junction disc, a phone\'s buttons, the quest card (AUDIT GUIDE T1/D1)');
  const touch = rd('src/ui/touch.js');
  for (const c of sel[1].split(', ')) {
    const styled = new RegExp(`^\\${c} \\{`, 'm').test(css), named = touch.includes(`className = '${c.slice(1)}'`);
    assert.ok(styled || named, `${c} is a class the style sheet stands up, or the touch layer names`);
  }
});

test('AUDIT DEEP2 E1/E2 readout: the Overworld bar LIFTS clear of what stands under it - the HUD\'s vitals, a phone\'s buttons - and the marks behind the camera stand over the lifted bar', async () => {
  const hud = await import('../src/ui/travelViewHud.js');
  const bar = { left: 336, right: 944, top: 638, bottom: 702, width: 608, height: 64 };
  const vitals = { left: 339, right: 941, top: 678, bottom: 698, width: 602, height: 20 };
  const back = { left: 860, right: 930, top: 655, bottom: 685, width: 70, height: 30 };
  const btn = { left: 900, right: 964, top: 650, bottom: 698, width: 64, height: 48 };   // a phone's button, over the bar's Return
  const quick = { left: 24, right: 360, top: 560, bottom: 700, width: 336, height: 140 };   // a corner block its far end reaches
  const { doc, find } = fakeDoc({ rects: { bar, back, others: [vitals, btn, quick] } });
  hud.showTravelViewHud({}, doc);
  try {
    hud.updateTravelViewHud({ feet: null, heading: null, yaw: 0, where: '', marks: [
      { key: 'far:behind', x: 640, y: 200, front: false, label: 'Glenpoint', sub: '18 km', kind: 'far', pick: true, edge: true }] });
    const foot = Number.parseFloat(find('tview-bar').style.bottom);
    assert.equal(foot, 720 - btn.top + 8, `lifted over the vitals and the button under its Return - not the corner block (${foot})`);
    const barTop = 720 - foot - bar.height;
    const h = hud.travelViewHudState().hits[0];
    assert.ok(h.y1 <= barTop, `the mark behind stands over the lifted bar (${h.y1} <= ${barTop})`);
  } finally { hud.disposeTravelViewHud(); }
});

test('AUDIT DEEP2 E3/E4/E8 readout: two marks low on a side part inside its stretch; marks either side of a corner part; the end marks along the foot keep their boxes on the screen apart', async () => {
  const hud = await import('../src/ui/travelViewHud.js');
  const { doc, moves } = fakeDoc();   // 1280 x 720, no furniture
  hud.showTravelViewHud({}, doc);
  const far = (key, x, y, front = true) => ({ key, x, y, front, label: key, sub: '12 km', kind: 'far', pick: true, edge: true });
  const frame = (marks) => { hud.updateTravelViewHud({ feet: null, heading: null, yaw: 0, where: '', marks }); return hud.travelViewHudState().hits; };
  const apart = (a, b) => a.x1 <= b.x0 || b.x1 <= a.x0 || a.y1 <= b.y0 || b.y1 <= a.y0;
  try {
    // E3: held at y 610 and 690 on the right (x 5000 projects k = 612/4360) - the lower one clamped into the other before
    let hits = frame([far('far:a', 5000, 2141), far('far:b', 5000, 2711)]);
    assert.equal(hits.length, 2);
    assert.ok(apart(hits[0], hits[1]), `low on a side, apart (${JSON.stringify(hits)})`);
    for (const h of hits) assert.ok(h.y1 <= 720 && h.y0 >= 0, 'on the screen');
    // E4: one just before the top-right corner (held on the top at x 1238), one just round it (on the right at y 38)
    moves.length = 0;
    hits = frame([far('far:top', 2440, -640), far('far:right', 2540, -640)]);
    assert.ok(apart(hits[0], hits[1]), `either side of a corner, apart (${JSON.stringify(hits)})`);
    assert.equal(moves[0][0], 1280 - 28, 'the one whose plate would not fit along the top goes round the corner - its arrow on the right edge');
    // E8: two behind and down-left, held on the foot at x 75 and 80 - near its end, not round the corner
    hits = frame([far('far:p', 1218.6, 20, false), far('far:q', 1213.5, 20, false)]);
    assert.ok(apart(hits[0], hits[1]), `along the foot's end, apart (${JSON.stringify(hits)})`);
    for (const h of hits) assert.ok(h.x0 >= 0 && h.x1 <= 1280);
  } finally { hud.disposeTravelViewHud(); }
});

test('AUDIT DEEP2 E6/E7 readout: a corner piece stops the marks along its edge short of it and keeps its side\'s marks over it; a phone\'s tall bands shrink together, never past a quarter of the screen clear', async () => {
  const hud = await import('../src/ui/travelViewHud.js');
  const bar = { left: 336, right: 944, top: 638, bottom: 702, width: 608, height: 64 };
  const quick = { left: 24, right: 250, top: 420, bottom: 666, width: 226, height: 246 };   // the quick-slot block, bottom-left
  const { doc } = fakeDoc({ rects: { bar, others: [quick] } });
  hud.showTravelViewHud({}, doc);
  const far = (key, x, y, front = true) => ({ key, x, y, front, label: key, sub: '12 km', kind: 'far', pick: true, edge: true });
  try {
    // behind and down-left: held on the foot at x 150, inside the block's span; off the left at y 397, over the block's top
    hud.updateTravelViewHud({ feet: null, heading: null, yaw: 0, where: '', marks: [far('far:foot', 1192.6, 60, false), far('far:left', -5000, 700)] });
    const hits = hud.travelViewHudState().hits, at = (k) => hits.find((h) => h.key === k);
    // OW-EDGES: the foot is a notch where a piece stands, not a band across it - a mark behind and down-left may reach the
    // left edge first; either way it stands clear of the corner piece (along the foot past it, or down the left over it)
    { const q = at('far:foot'); assert.ok(q.x0 >= quick.right || q.y1 <= quick.top, `clear of the block (${JSON.stringify(q)})`); }
    assert.ok(at('far:left').y1 <= quick.top, `down the left, over it (${JSON.stringify(at('far:left'))})`);
  } finally { hud.disposeTravelViewHud(); }
  // a landscape phone on a journey: the panel's foot at 147, the bar and the buttons under - the room kept
  const phoneBar = { left: 30, right: 637, top: 300, bottom: 364, width: 607, height: 64 };
  const panel = { left: 27, right: 640, top: 66, bottom: 147, width: 613, height: 81 };
  const p = fakeDoc({ rects: { bar: phoneBar, others: [panel] }, w: 667, h: 375 });
  hud.showTravelViewHud({}, p.doc);
  try {
    hud.updateTravelViewHud({ feet: null, heading: null, yaw: 0, where: '', marks: [far('far:ahead', 333, -3000)] });
    const h = hud.travelViewHudState().hits[0];
    assert.ok(h.y0 + 24 >= panel.bottom + 12 - 1, `ahead: below the panel, not inside it (${h.y0 + 24})`);
  } finally { hud.disposeTravelViewHud(); }
});

test('AUDIT OW5 R3: the places are said again at once when the SET changes, a distance alone at most every TV_SAID_DISTANCE_MS - a journey\'s ticking tenths rebuilt the hidden list on a third of the frames at speed', async () => {
  const hud = await import('../src/ui/travelViewHud.js');
  const { doc } = fakeDoc();
  hud.showTravelViewHud({}, doc);
  const at = (sub, extra = []) => hud.updateTravelViewHud({ feet: null, heading: null, yaw: 0, where: '', marks: [
    { key: 'far:in', x: 640, y: 400, front: true, label: 'Ripwych', sub, kind: 'far', pick: true }, ...extra] });
  try {
    at('6.4 km');
    assert.equal(hud.travelViewHudState().said, 'Ripwych, 6.4 km\n');
    at('6.3 km');
    assert.equal(hud.travelViewHudState().said, 'Ripwych, 6.4 km\n', 'a distance alone: it waits its turn');
    at('6.2 km', [{ key: 'far:b', x: 700, y: 420, front: true, label: 'Bhoriane', sub: '8.0 km', kind: 'far', pick: true }]);
    assert.match(hud.travelViewHudState().said, /Bhoriane, 8\.0 km/, 'a new place: said at once');
    assert.match(hud.travelViewHudState().said, /Ripwych, 6\.2 km/, '...with the distances as they are');
  } finally { hud.disposeTravelViewHud(); }
  assert.equal(hud.TV_SAID_DISTANCE_MS, 5000);
});

test('AUDIT DEEP2 E5/E9/E11/E15 readout: the held arrow is notched; a far place in the picture wears its distance above its dot; the labels wear the enhanced face; the places are said in words; a NaN mark spoils nothing', async () => {
  const hud = await import('../src/ui/travelViewHud.js');
  const { doc, calls, draws, ctx } = fakeDoc();
  hud.showTravelViewHud({}, doc);
  try {
    calls.length = 0;
    hud.updateTravelViewHud({ feet: null, heading: null, yaw: 0, where: '', marks: [{ key: 'trav:r', x: 5000, y: 360, front: true, label: 'Rider', kind: 'traveller', edge: true }] });
    assert.equal(calls.filter((k) => k === 'lineTo').length, 3, 'three lines from the tip: the notched head');
    assert.match(String(ctx.font), /Barlow Semi Condensed/, 'a rider\'s name in the --data face');
    draws.length = 0;
    hud.updateTravelViewHud({ feet: null, heading: null, yaw: 0, where: '', marks: [
      { key: 'far:in', x: 640, y: 400, front: true, label: 'Ripwych', sub: '6.4 km', kind: 'far', pick: true },
      { key: 'far:nan', x: NaN, y: 300, front: true, label: 'Nowhere', kind: 'far', pick: true, edge: true }] });
    assert.ok(draws.every(([, , y, , h]) => y + h <= 400 - 4), `plate and distance both above the dot (${draws.map(([, , y, , h]) => y + h)})`);
    assert.deepEqual(hud.travelViewHudState().hits.map((h) => h.key), ['far:in'], 'the NaN mark placed nowhere');
    assert.equal(hud.travelViewHudState().said, 'Ripwych, 6.4 km\n', 'the places in words');
  } finally { hud.disposeTravelViewHud(); }
  const css = rd('src/ui/enhancedStyle.js');
  assert.match(css, /\.tview-bar \{[^}]*pointer-events: auto;/, 'E13: the bar takes its own clicks');
  const h = rd('src/ui/travelViewHud.js');
  assert.match(h, /if \(sp\) \{ sprites\.delete\(key\); sprites\.set\(key, sp\); return sp; \}/, 'E12: the sprites kept newest-last');
  assert.match(h, /while \(sprites\.size && \(sprites\.size >= SPRITES_MAX \|\| spritePixels \+ px > SPRITE_PIXELS_MAX\)\) \{\n\s*const k = sprites\.keys\(\)\.next\(\)\.value, old = sprites\.get\(k\);\n\s*sprites\.delete\(k\);/, 'and the oldest one goes (AUDIT NAMES N1-8: past the count or the pixels)');
  assert.match(h, /const onPointerUpHud = \(e\) => \{ if \(e\.pointerType === 'touch'\) pointer = null; \};/, 'E10: a lifted finger leaves no hover');
});

test('AUDIT DEEP2 B-1/B-3 by source: the journey\'s end is held at the edge with its distance and takes a click (its journey again); the place caches are keyed on what is discovered', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /marks\.push\(\{ key: 'dest', at: tvSceneKept\(e, e\.x, e\.z, place \? TV_PLACE_LIFT : 0\), label: e\.label, kind: e\.kind, edge: true, \.\.\.\(place \? \{ pick: true, sub: farDistanceText\(km\) \} : \{\}\) \}\);/);
  assert.match(w, /if \(key === 'dest'\) \{ const summary = tvTripLive\(\) \? tvTrip\.plan\?\.summary : null; if \(summary && travelViewCanGo\(\)\) travelViewRouteTo\(summary\); return; \}/);
  assert.match(w, /tvPlates\.dg === dg\) return tvPlates\.list;/);
  assert.match(w, /tvFar = \{ at, near, dg, list \};/);
});

test('AUDIT DEEP2 B-3 law: the discovered set\'s generation moves on a discovery and on a restore - never on a place found twice', async () => {
  const d = await import('../src/systems/discovery.js');
  const g0 = d.discoveryGeneration();
  assert.equal(d.discoverLocation(0x7ff12, { locationName: 'Glenpoint' }), true);
  const g1 = d.discoveryGeneration();
  assert.ok(g1 > g0);
  assert.equal(d.discoverLocation(0x7ff12, { locationName: 'Glenpoint' }), false);
  assert.equal(d.discoveryGeneration(), g1, 'found twice: nothing new');
  d.restoreDiscovery(null);
  assert.ok(d.discoveryGeneration() > g1, 'a load');
});

test('OVERWORLD NAMES readout: a player\'s marker is their name as it reads in play - the title its own line above in its colour, the Renown boxed left, the name in my party\'s green, the guild\'s tag in steel; a stranger\'s name the bone; the box grows with the title', async () => {
  const hud = await import('../src/ui/travelViewHud.js');
  const { TITLE_RGBA, cssRgba } = await import('../src/ui/playerBadge.js');
  const { doc, texts, calls } = fakeDoc();
  hud.showTravelViewHud({}, doc);
  const N = hud.TRAVEL_VIEW_NAME_COLORS;
  try {
    hud.updateTravelViewHud({ feet: null, heading: null, yaw: 0, where: '', marks: [
      { key: 'peer:a', x: 500, y: 300, front: true, label: 'Mack', kind: 'party', edge: true, badge: { title: 'founder', glyphs: ['dev'], lv: 12, gt: 'HND' } },
      { key: 'peer:b', x: 800, y: 300, front: true, label: 'Stranger', kind: 'traveller', edge: true, badge: { title: null, glyphs: [], lv: null, gt: null } },
    ] });
    const said = (t) => texts.find(([x]) => x === t);
    assert.ok(said('Founder'), 'the title, its own line');
    assert.equal(said('Founder')[1], cssRgba(TITLE_RGBA.founder), 'in its own colour');
    assert.notEqual(said('Founder')[1], N.party, 'never the party\'s green (ACC3)');
    assert.equal(said('12')?.[1], N.renown, 'the Renown, amber');
    assert.equal(said('Mack')?.[1], N.party, 'my party\'s name in its green');
    assert.equal(said('<HND>')?.[1], N.guild, 'the guild\'s tag in steel');
    assert.equal(said('Stranger')?.[1], N.name, 'a stranger\'s name the bone');
    assert.ok(texts.findIndex(([x]) => x === 'Founder') < texts.findIndex(([x]) => x === 'Mack'), 'the title drawn first - above');
    assert.equal(N.party, '#73ff73', 'net/social.js PARTY_GREEN_CSS, the green of names in play');
    // at rest, a badge that changes (a title won) is drawn again - the picture's signature carries it
    texts.length = 0; calls.length = 0;
    hud.updateTravelViewHud({ feet: null, heading: null, yaw: 0, where: '', marks: [
      { key: 'peer:a', x: 500, y: 300, front: true, label: 'Mack', kind: 'party', edge: true, badge: { title: 'developer', glyphs: ['dev'], lv: 12, gt: 'HND' } },
      { key: 'peer:b', x: 800, y: 300, front: true, label: 'Stranger', kind: 'traveller', edge: true, badge: { title: null, glyphs: [], lv: null, gt: null } },
    ] });
    assert.ok(texts.some(([x]) => x === 'Developer'), `the new title made (${texts.map(([x]) => x)})`);
    assert.ok(calls.includes('clearRect'), 'and the picture drawn again, wearing it');
  } finally { hud.disposeTravelViewHud(); }
});

test('AUDIT NAMES N2-4/N1-7 readout: a party side by side (their heads a few pixels apart from the view\'s height) wears names that never print one over another - each stands clear, above the one before; a player\'s name stands over their head, never across the body it names', async () => {
  const hud = await import('../src/ui/travelViewHud.js');
  const { doc, draws } = fakeDoc();
  hud.showTravelViewHud({}, doc);
  const boxes = () => draws.map(([, x, y, w, h]) => ({ x0: x, x1: x + w, y0: y, y1: y + h }));
  const crossed = (B) => B.some((a, i) => B.some((b, j) => i < j && a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0));
  try {
    const party = ['Mack', 'Bran', 'Isolde', 'Tam'].map((n, i) => ({ key: `peer:${i}`, x: 600 + i * 4, y: 300 + (i % 2), front: true, label: n, kind: 'party', edge: true, badge: { title: i === 1 ? 'founder' : null, glyphs: [], lv: 3 + i, gt: null } }));
    hud.updateTravelViewHud({ feet: null, heading: null, yaw: 0, where: '', marks: party });
    const B = boxes();
    assert.equal(B.length, 4, 'four names drawn');
    assert.equal(crossed(B), false, 'no name over another');
    assert.equal(B[0].y1, 300 - 8, 'the first where a lone name stands - its foot 8 px over the head (N1-7)');
    assert.ok(B.slice(1).every((b, i) => b.y1 <= B[i].y0), 'each after it above the one before');
    // apart on the screen, nothing moves
    draws.length = 0;
    hud.updateTravelViewHud({ feet: null, heading: null, yaw: 0, where: '', marks: [{ ...party[0], x: 200 }, { ...party[1], x: 900 }] });
    assert.deepEqual(boxes().map((b) => b.y1), [292, 293], 'names apart keep their place, each over its own head');
  } finally { hud.disposeTravelViewHud(); }
});

test('AUDIT NAMES N1-1/N1-5 readout: a busy first frame makes BADGE_BUILDS_PER_FRAME badges and no more (the rest their bare name, the picture drawn again till all are made); a held player\'s box is the badge drawn - a titled one ahead on a phone stays ahead', async () => {
  const hud = await import('../src/ui/travelViewHud.js');
  const { doc, texts, calls } = fakeDoc();
  hud.showTravelViewHud({}, doc);
  const N = hud.TRAVEL_VIEW_NAME_COLORS, B = hud.BADGE_BUILDS_PER_FRAME;
  try {
    const marks = [];
    for (let i = 0; i < 40; i++) marks.push({ key: `peer:c${i}`, x: 40 + i * 30, y: 400, front: true, label: `Cold${i}`, kind: 'party', badge: { title: null, glyphs: [], lv: 5, gt: null } });
    const frame = { feet: null, heading: null, yaw: 0, where: '', marks };
    const made = () => texts.filter(([t, f]) => f === N.party && t.startsWith('Cold')).length;
    hud.updateTravelViewHud(frame);
    assert.equal(B, 16);
    assert.equal(made(), B, 'the first frame makes its budget, no more (a 256-player region\'s first frame was a 70-175 ms stall)');
    assert.ok(texts.some(([t, f]) => t === 'Cold39' && f !== N.party), 'the rest wear their bare name meanwhile');
    calls.length = 0;
    hud.updateTravelViewHud(frame);
    assert.equal(made(), 2 * B, 'the next are made');
    assert.ok(calls.includes('clearRect'), 'and the same picture is drawn again, wearing them');
    hud.updateTravelViewHud(frame);
    assert.equal(made(), 40);
    hud.updateTravelViewHud(frame);
    calls.length = 0;
    hud.updateTravelViewHud(frame);
    assert.equal(calls.filter((c) => c === 'clearRect').length, 0, 'every badge made: at rest again');
  } finally { hud.disposeTravelViewHud(); }
  // N1-5: on a 390 px phone a long-named, titled, tagged player straight ahead is held at the TOP, centred - the estimate
  // ran wide of the badge drawn and sent them to the left side
  const P = fakeDoc({ w: 390, h: 844 });
  hud.showTravelViewHud({}, P.doc);
  try {
    hud.updateTravelViewHud({ feet: null, heading: null, yaw: 0, where: '', marks: [
      // PIN MOVED (OW-CROWD): an arrow at the edge wears a badge only for my party now - the held badge's box asked of one
      { key: 'peer:long', x: 195, y: -3000, front: true, label: 'Aldric Stormcrown Vellan', kind: 'party', edge: true, badge: { title: 'dungeonmaster', glyphs: ['dm', 'dev', 'mod', 'sprout'], lv: 40, gt: 'DAGR' } },
    ] });
    const [, x, , w] = P.draws.at(-1);
    assert.ok(Math.abs(x + w / 2 - 195) <= 1, `held ahead, centred (${x + w / 2})`);
  } finally { hud.disposeTravelViewHud(); }
});

test('AUDIT NAMES N1-8 readout: the kept images are capped by their pixels as well as their count - at a phone\'s dpr 3 the oldest badge goes long before 512 are kept', async () => {
  const hud = await import('../src/ui/travelViewHud.js');
  const { doc, win, texts } = fakeDoc();
  win.devicePixelRatio = 3;
  hud.showTravelViewHud({}, doc);
  try {
    const mark = (i) => ({ key: `peer:px${i}`, x: 100 + (i % 20) * 50, y: 200 + Math.floor(i / 20) * 40, front: true, label: `Pixelsworth the ${i}`, kind: 'traveller', badge: { title: 'founder', glyphs: ['dev'], lv: 12, gt: 'HND' } });
    // PIN MOVED (OW-CROWD): the six nearest wear a badge a frame now - fed six at a time, every one of them made
    const step = Math.min(hud.BADGE_BUILDS_PER_FRAME, hud.TV_BADGES_MAX);
    for (let i = 0; i < 300; i += step) {
      const marks = [];
      for (let k = i; k < Math.min(300, i + step); k++) marks.push(mark(k));
      hud.updateTravelViewHud({ feet: null, heading: null, yaw: 0, where: '', marks });
    }
    texts.length = 0;
    hud.updateTravelViewHud({ feet: null, heading: null, yaw: 0, where: '', marks: [mark(0)] });
    assert.ok(texts.some(([t]) => t === 'Pixelsworth the 0'), 'the first badge made was let go (300 kept would be ~50 M pixels) - and is made again');
    texts.length = 0;
    hud.updateTravelViewHud({ feet: null, heading: null, yaw: 0, where: '', marks: [mark(299)] });
    assert.ok(!texts.some(([t]) => t === 'Pixelsworth the 299'), 'the newest is kept');
  } finally { hud.disposeTravelViewHud(); }
});

test('AUDIT NAMES N1-6 readout: a titled player held at the top near a corner and one held on that side never cross - the side\'s run starts under the top\'s labels', async () => {
  const hud = await import('../src/ui/travelViewHud.js');
  const { doc, draws } = fakeDoc({ w: 1366, h: 768 });
  hud.showTravelViewHud({}, doc);
  try {
    hud.updateTravelViewHud({ feet: null, heading: null, yaw: 0, where: '', marks: [
      // PIN MOVED (OW-CROWD): held badges are my party's alone now - two of them
      { key: 'peer:top', x: -5047, y: -3176, front: true, label: 'Mack', kind: 'party', edge: true, badge: { title: 'developer', glyphs: ['dev'], lv: 40, gt: 'DAGR' } },
      { key: 'peer:left', x: -5867, y: -3056, front: true, label: 'Aldric the Grey', kind: 'party', edge: true, badge: { title: 'founder', glyphs: ['sprout', 'dev'], lv: 12, gt: 'HND' } },
    ] });
    const [a, b] = draws.map(([, x, y, w, h]) => ({ x0: x, x1: x + w, y0: y, y1: y + h }));
    assert.ok(a && b, 'both drawn');
    assert.ok(!(a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0), `apart: ${JSON.stringify([a, b])}`);
  } finally { hud.disposeTravelViewHud(); }
});

test('AUDIT NAMES N1-2/N1-3/N1-4/N1-9 readout: the badge painted as the in-play face paints it - the gradient title over an edge of its own colour and black with no blurred shadow, each glyph in its colour at the name face\'s stroke, the wolf\'s red eye, the Renown under the row\'s shadow, the name in the pixel face; a badge redrawn for my party and for a new dpr', async () => {
  const hud = await import('../src/ui/travelViewHud.js');
  const { TITLE_RGBA, GLYPH_RGBA, GLYPH_PATH, GLYPH_DETAIL, GLYPH_EDGE_W, cssRgba } = await import('../src/ui/playerBadge.js');
  const { PIXEL_STACK } = await import('../src/ui/pixelifyFive.js');
  const had = globalThis.Path2D;
  globalThis.Path2D = class { constructor(d) { this.d = d; } };
  const { doc, win, texts, fills, strokes, draws } = fakeDoc();
  hud.showTravelViewHud({}, doc);
  const N = hud.TRAVEL_VIEW_NAME_COLORS;
  try {
    const wolf = { key: 'peer:wolf', x: 500, y: 300, front: true, label: 'SirMcMobdon', kind: 'traveller', badge: { title: 'shadowfang', glyphs: ['shadowfang', 'dev'], lv: 50, gt: 'WOLF' } };
    hud.updateTravelViewHud({ feet: null, heading: null, yaw: 0, where: '', marks: [wolf] });
    const title = texts.filter(([t]) => t === 'Shadow Fang');
    const edge = cssRgba(TITLE_RGBA.shadowfang);
    assert.deepEqual(title.map(([, f]) => (f?.gradient ? 'gradient' : f)), ['#000', edge, edge, 'gradient'], 'black under, its colour right and below, the gradient over');
    assert.ok(title.every(([, , , blur]) => blur === 0), 'no blurred shadow drowning the black half (AUDIT A4/A5)');
    assert.ok(fills.some(([f, d]) => f === cssRgba(GLYPH_DETAIL.shadowfang.rgba) && d === GLYPH_DETAIL.shadowfang.path), 'the wolf\'s red eye');
    assert.ok(strokes.some(([c, w, j, d]) => c === cssRgba(GLYPH_RGBA.shadowfang) && w === GLYPH_EDGE_W && j === 'round' && d === GLYPH_PATH.shadowfang), 'the gradient glyph\'s edge, round');
    assert.ok(strokes.some(([c, w, j, d]) => c === cssRgba(GLYPH_RGBA.dev) && w === 1.6 && j === 'round' && d === GLYPH_PATH.dev), 'a stroked glyph in its own colour at the name face\'s 1.6');
    assert.equal(texts.find(([t]) => t === '50')?.[3], 3, 'the Renown under the row\'s shadow');
    const name = texts.find(([t]) => t === 'SirMcMobdon');
    assert.equal(name[1], N.name);
    assert.ok(String(name[2]).includes(PIXEL_STACK), 'the face names wear in play');
    // the same player, of my party now: made again, green
    texts.length = 0;
    hud.updateTravelViewHud({ feet: null, heading: null, yaw: 0, where: '', marks: [{ ...wolf, kind: 'party' }] });
    assert.equal(texts.find(([t]) => t === 'SirMcMobdon')?.[1], N.party, 'the party\'s green - its own image, not the stranger\'s');
    // a new dpr: made again at its pixels
    win.devicePixelRatio = 2;
    hud.updateTravelViewHud({ feet: null, heading: null, yaw: 0, where: '', marks: [{ ...wolf, kind: 'party' }] });
    const [c, , , w] = draws.at(-1);
    assert.equal(c.width, 2 * w, 'the image at the new dpr');
  } finally {
    hud.disposeTravelViewHud();
    if (had) globalThis.Path2D = had; else delete globalThis.Path2D;
  }
});


test('OW-THEME (Mac: "The overworld ui needs to follow enhanced ui theme"): the bar, its Return and its compass wear the Enhanced Plus theme\'s roles, and the plates the theme\'s own stone (its --slate), read at each open', async () => {
  const { FRAME_ROLES, PLUS_THEMES } = await import('../src/ui/enhancedFrame.js');
  assert.ok(FRAME_ROLES.window.includes('.tview-bar'), 'the bar: the journey bar\'s carved stone');
  assert.ok(FRAME_ROLES.button.includes('.tview-back'), 'Return: a stone button');
  assert.ok(FRAME_ROLES.well.includes('.tview-compass'), 'the compass: sunk in a socket');
  const hud = await import('../src/ui/travelViewHud.js');
  const docWith = (slate) => ({ documentElement: {}, defaultView: { getComputedStyle: () => ({ getPropertyValue: (k) => (k === '--slate' ? slate : '') }) } });
  const ember = PLUS_THEMES.ember.slate;
  const n = parseInt(ember.slice(1), 16);
  assert.equal(hud.themePlate(docWith(` ${ember}`)), `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, 0.78)`, 'Ember\'s stone');
  assert.equal(hud.themePlate(docWith('')), hud.TRAVEL_VIEW_MARK_COLORS.plate, 'no theme named: the kit\'s plate');
  assert.equal(hud.themePlate(null), hud.TRAVEL_VIEW_MARK_COLORS.plate);
  // at each open, and a new stone lets the old plates go
  const P = fakeDoc();
  P.win.getComputedStyle = () => ({ getPropertyValue: (k) => (k === '--slate' ? ember : '') });
  P.doc.documentElement = {};
  hud.showTravelViewHud({}, P.doc);
  try {
    hud.updateTravelViewHud({ feet: null, heading: null, yaw: 0, where: '', marks: [{ key: 'place:t', x: 400, y: 300, front: true, label: 'Themeton', kind: 'place', pick: true }] });
    assert.ok(P.calls.includes('fillRect'), 'a plate drawn');
    const src = readFileSync(new URL('../src/ui/travelViewHud.js', import.meta.url), 'utf8');
    assert.match(src, /x\.fillStyle = plateFill; x\.fillRect\(0\.5, 0\.5, w - 1, h - 1\);/);
    assert.match(src, /if \(pf !== plateFill\) \{ plateFill = pf; dropSprites\(\); canvasSig = \[\]; \}/);
  } finally { hud.disposeTravelViewHud(); }
});
