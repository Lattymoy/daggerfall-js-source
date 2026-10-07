// GATHER-OW (2026-10-02, Mac: "increase all profession nodes and also allow them to appear in the overworld without
// being overwhelming, maybe a glyph marker showing where a group of them are"; asked, "Groups nearby").
//
// The Overworld marks each profession's group of nodes on the land near the player: one glyph a profession a stood
// pixel, at its nodes' middle, in its compass colour - a diamond, a gem's - with its count today ("Mining ×6"), the
// nearest GROUP_MAX within GROUP_M, and a switch of its own (Gathering) among the view's filters. A node worked today
// leaves the count; the professions shut or underground, none. The real gathering host with its herb, mine and tree kinds
// over stood pixels of the producers' own (test/fb1001_anyhour.test.js's), the real filters, the real HUD over a stub
// canvas, and the world host's line read off its source.
import './chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createGatherHost, GROUP_M, GROUP_MAX, GROUP_REFRESH_MS, GROUP_LIFT_M, groupLabel } from '../src/scenes/gatherHost.js';
import { herbKind } from '../src/scenes/herbHost.js';
import { mineKind } from '../src/scenes/mineHost.js';
import { treeKind } from '../src/scenes/treeHost.js';
import { setForagingHost } from '../src/systems/foragingInstall.js';
import { CLIMATES, LOCATION_TYPES } from '../src/formats/mapsFile.js';
import { trees, veins, boulders, utcDayOfMs } from '../src/net/nodeLaw.js';
import { groundAt } from '../src/world/terrainNature.js';
import { HEIGHTMAP_DIMENSION, TERRAIN_SIZE } from '../src/world/terrainSampler.js';
import { nodeMarkCss } from '../src/ui/nodeMarks.js';
import { TV_FILTER_GROUPS, TV_FILTER_TEXT, markGroup, markShown, countGroups } from '../src/systems/travelViewFilters.js';
import * as hud from '../src/ui/travelViewHud.js';

const WOODS = CLIMATES.Woodlands, GLENUMBRA = 59;
const NOON_MS = (20500 * 86_400 + 43_200) * 1000;
const DAY = utcDayOfMs(NOON_MS);
const tick = () => new Promise((r) => setImmediate(r));
const WILD = Object.freeze({ inside: false, insideDungeon: false, insideCastle: false, locationType: LOCATION_TYPES.None, inLocationRect: false,
  hour: 12, climate: WOODS, region: GLENUMBRA, enemiesNear: false, carriedWeight: 0, maxEncumbrance: 100, swimming: false, exteriorWater: 'None' });

/** A Woodlands pixel on flat grass: a rock piece by every vein and boulder, the forest's flats by the law's trees. */
function pixelEntry(px, py) {
  const samples = new Float32Array(HEIGHTMAP_DIMENSION * HEIGHTMAP_DIMENSION).fill(0.5);
  const rocks = veins({ x: px, y: py, day: DAY, climate: WOODS, region: GLENUMBRA }).map((v) => [v.u * TERRAIN_SIZE - 2, 0, v.v * TERRAIN_SIZE + 4, v.u * TERRAIN_SIZE + 2, 6, v.v * TERRAIN_SIZE + 8]);
  for (const b of boulders({ x: px, y: py, day: DAY, climate: WOODS })) {
    const x = b.u * TERRAIN_SIZE, z = b.v * TERRAIN_SIZE, g = groundAt(samples, x, z);
    rocks.push([x - 1.5, g - 1, z + 1, x + 1.5, g + 4, z + 4]);
  }
  const flats = trees({ x: px, y: py, day: DAY, climate: WOODS }).map((t, i) => ({ id: i, group: '504_12', i, x: t.u * TERRAIN_SIZE + 1, y: 0, z: t.v * TERRAIN_SIZE }));
  const batch = { archive: 504, record: 12, size: { w: 4, h: 8 } };
  const forest = { base: 504, archive: 504, trees: flats, groups: new Map([['504_12', { batch, centers: flats.map((f) => [f.x, f.y, f.z]), size: batch.size }]]) };
  return { px, py, samples, tilemap: new Uint8Array(128 * 128).fill(2), locationRect: null, batches: [], rocks, forest };
}

/** The gathering host over `pixels` (each [px, py], laid out east of the first), its clock the test's. */
async function stage(pixels = [[405, 150]]) {
  const S = { now: NOON_MS, taken: new Set(), open: true, shift: [0, 0, 0] };
  const book = {
    state: { open: true, today: {}, caps: { stores: 5000 } },
    stale: () => false, refresh: async () => ({ ok: true }), pixel: () => ({ state: 'none' }), askPixels: async () => [], pump: () => {},
    dungeon: () => null, askDungeon: async () => false, held: () => 0, taken: (key) => S.taken.has(key), counting: () => false,
    track: () => ({ rank: 100, specs: { 50: null, 100: null } }), harvest: () => new Promise(() => {}),
  };
  S.book = book;
  const renderer = { createBillboardBatch: () => ({}), destroyBatch: () => {}, moveBillboardBatch: () => true };
  const [x0, y0] = pixels[0];
  const built = new Map(pixels.map(([px, py]) => [`${px},${py}`, pixelEntry(px, py)]));
  S.host = createGatherHost({
    book, kinds: [herbKind({ book }), mineKind({ book }), treeKind({ book, renderer })],
    hud: { setPrompt: () => {}, setMeter: () => {}, toast: () => {}, banner: () => {}, setChip: () => {}, frame: () => {}, dispose: () => {} },
    renderer, getTexture: async () => ({ recordCount: 999 }), uploadRecord: () => {}, billboardSize: () => ({ w: 0.3, h: 0.3 }), flatBatchAabb: () => [0, 0, 0, 0, 0, 0],
    built: () => built, pixelTranslation: (x, y, out) => { out[0] = (x - x0) * TERRAIN_SIZE + S.shift[0]; out[1] = S.shift[1]; out[2] = (y0 - y) * TERRAIN_SIZE + S.shift[2]; return out; },   // `shift`: the floating origin's
    pixelInfo: () => ({ climate: WOODS, region: GLENUMBRA }), nowMs: () => S.now,
    eye: () => ({ pos: [0, 1.6, 0], dir: [0, 0, 1] }), view: () => ({ yaw: 0, pitch: 0 }), feet: () => [0, 0, 0], entity: () => ({ items: [] }),
    keyLabel: () => 'E', input: () => ({ held: false, attack: false, choice: false }), active: () => true, activeDungeon: () => false,
  });
  setForagingHost({ world: () => WILD, monthValue: () => 5, entity: () => null, startQuest: () => true, professionsOpen: () => true, keyLabel: () => 'E', professionUse: () => false });
  for (const e of built.values()) S.host.onBuilt(e);
  S.built = built;
  await tick(); await tick();
  S.nodes = (px, py, kind) => S.host.nodesOf(px, py).filter((n) => n.kind === kind);
  S.later = () => { S.now += GROUP_REFRESH_MS + 1; };
  S.done = () => { S.host.dispose(); setForagingHost(null); };
  return S;
}

test('GATHER-OW groups: one mark a profession a stood pixel on the node nearest their middle (AUDIT: the middle itself was dry land between two schools, open ground in a forest), in its colour, with its count - a node worked today leaves it; read again after GROUP_REFRESH_MS, not before (mutants: the worked node counted; the list never read again; the middle the first node)', async () => {
  const s = await stage();
  try {
    const mid = [TERRAIN_SIZE / 2, 0, TERRAIN_SIZE / 2];
    const g = s.host.overworldGroups(mid);
    const want = { herbalism: s.nodes(405, 150, 'herb'), mining: s.nodes(405, 150, 'mine'), logging: s.nodes(405, 150, 'tree') };
    assert.deepEqual(g.map((m) => m.kind).sort(), ['gather herbalism', 'gather logging', 'gather mining']);
    for (const m of g) {
      const p = m.kind.split(' ')[1], nodes = want[p];
      assert.ok(nodes.length >= 3, `${p}: ${nodes.length} nodes`);
      assert.equal(m.label, groupLabel(p, nodes.length));
      assert.equal(m.color, nodeMarkCss(p));
      assert.equal(m.key, `gather:405,150:${p}`);
      const c = [0, 2].map((i) => nodes.reduce((a, n) => a + n.local[i], 0) / nodes.length);
      const off = (n) => Math.hypot(n.local[0] - c[0], n.local[2] - c[1]);
      const nearest = nodes.reduce((b, n) => (off(n) < off(b) ? n : b));
      assert.deepEqual(m.at, [nearest.local[0], nearest.local[1] + GROUP_LIFT_M, nearest.local[2]], `${p}: on the node nearest its nodes' middle`);
      assert.equal(m.pick, undefined, 'no click of its own - a click there walks to the ground under it');
    }
    assert.equal(groupLabel('mining', 6), 'Mining ×6');
    // a vein worked today: the same list until the refresh, then one fewer
    const vein = want.mining.find((n) => n.what === 'vein');
    s.taken.add(vein.key);
    const labels = (l) => l.map((m) => m.label);
    assert.deepEqual(labels(s.host.overworldGroups(mid)), labels(g), 'within GROUP_REFRESH_MS, the list as read');
    s.later();
    const after = s.host.overworldGroups(mid).find((m) => m.kind === 'gather mining');
    assert.equal(after.label, groupLabel('mining', want.mining.length - 1), 'the worked vein left the count');
    // every node of a profession worked: no group of it
    for (const n of want.logging) s.taken.add(n.key);
    s.later();
    assert.ok(!s.host.overworldGroups(mid).some((m) => m.kind === 'gather logging'), 'a forest worked out: no glyph');
  } finally { s.done(); }
});

test('GATHER-OW groups: within GROUP_M alone, the nearest GROUP_MAX; none with the professions shut, nor underground (mutants: the reach unasked; the cap unasked; the shut professions asked nothing)', async () => {
  // a row of six pixels east, the player on the third: all eighteen groups within GROUP_M - the nearest twelve
  const row = Array.from({ length: 6 }, (_, i) => [405 + i, 150]);
  const s = await stage(row);
  try {
    const feet = [2.5 * TERRAIN_SIZE, 0, TERRAIN_SIZE / 2];
    const g = s.host.overworldGroups(feet);
    assert.equal(g.length, GROUP_MAX, 'the nearest twelve of eighteen');
    const d = (m) => Math.hypot(m.at[0] - feet[0], m.at[2] - feet[2]);
    assert.ok(g.every((m, i) => i === 0 || d(g[i - 1]) <= d(m)), 'nearest first');
    assert.ok(g.every((m) => d(m) <= GROUP_M));
    assert.ok(!g.some((m) => m.key.startsWith('gather:410,150')), 'the farthest pixel\'s cut by the cap');
    // far off: none
    s.later();
    assert.deepEqual(s.host.overworldGroups([feet[0] - 10 * TERRAIN_SIZE, 0, feet[2]]), [], 'none past GROUP_M');
    // the professions shut: none
    s.book.state.open = false;
    s.later();
    assert.deepEqual(s.host.overworldGroups(feet), []);
    s.book.state.open = true;
    // underground: none
    s.host.enterDungeon({ id: 77, climate: WOODS, region: GLENUMBRA, wall: () => null, stand: async () => null, drop: () => {} });
    s.later();
    assert.deepEqual(s.host.overworldGroups(feet), [], 'underground');
    s.host.leaveDungeon();
    s.later();
    assert.equal(s.host.overworldGroups(feet).length, GROUP_MAX, 'back out: the groups again');
  } finally { s.done(); }
  // a pixel four squares east: its ground within GROUP_M, its groups' middles past it - none of them (the cap far off)
  const two = await stage([[405, 150], [409, 150]]);
  try {
    const feet = [TERRAIN_SIZE / 2, 0, TERRAIN_SIZE / 2];
    const g = two.host.overworldGroups(feet);
    assert.ok(g.length === 3 && g.every((m) => m.key.startsWith('gather:405,150')), `the near pixel's alone (${g.map((m) => m.key)})`);
    assert.equal(two.nodes(409, 150, 'tree').length > 0, true, 'the far pixel stands its nodes');
  } finally { two.done(); }
});

test('GATHER-OW (AUDIT): a group stands where its land stands NOW - a recentre of the floating origin moves it at once, never after the next read; a pixel torn down takes its groups with it at once (mutants: placed from the read; a torn-down pixel\'s kept)', async () => {
  const s = await stage();
  try {
    const mid = [TERRAIN_SIZE / 2, 0, TERRAIN_SIZE / 2];
    const before = s.host.overworldGroups(mid).map((m) => [...m.at]);
    s.shift = [-TERRAIN_SIZE, 0, 0];   // the player crossed east: the scene recentred under the cache
    const after = s.host.overworldGroups(mid).map((m) => [...m.at]);
    assert.ok(before.length >= 3);
    assert.equal(after.length, before.length);
    after.forEach((a, i) => assert.deepEqual(a, [before[i][0] - TERRAIN_SIZE, before[i][1], before[i][2]], 'moved with its land, in the same read'));
    s.host.onDestroyed(s.built.get('405,150'));
    assert.deepEqual(s.host.overworldGroups(mid), [], 'its pixel gone: none, before the next read');
  } finally { s.done(); }
});

test('GATHER-OW (AUDIT) the colour reaches the readout through the travel view\'s own copy of the marks - every diamond was brass (mutant: the colour dropped)', async () => {
  const { createTravelView } = await import('../src/scenes/travelView.js');
  const { forwardOf } = await import('../src/player/travelCamera.js');
  const log = {};
  const tv = createTravelView({
    canvas: { contains: () => false }, win: { addEventListener() {}, removeEventListener() {} },
    feet: () => [0, 0, 0], headView: () => ({ eye: [0, 1.7, 0], fwd: forwardOf(0.3, 0) }),
    yaw: () => 0.3, setYaw: () => {}, heightAt: () => 0, cloudBase: () => null,
    allowed: () => ({ ok: true }), windowUp: () => false, danger: () => false,
    actionsOf: () => [], movementHeld: () => false, autopilot: () => false,
    holdBody: () => true, freeCursor: () => {}, where: () => '',
    project: (p) => ({ x: 400 + p[0], y: 300 - p[2], front: true }),
    hud: { show() {}, hide() {}, update: (f) => { log.last = f; } }, say() {}, alive: () => true,
    schedule: () => ({}), cancel() {},
    marks: () => [{ key: 'gather:1,1:mining', at: [10, 2, 10], label: groupLabel('mining', 6), kind: 'gather mining', color: nodeMarkCss('mining') }, { key: 'place:1', at: [0, 0, 0], label: 'Ripwych', kind: 'place', pick: true }],
  });
  tv.enter();
  for (let i = 0; i < 200; i++) tv.frame(1 / 60);
  tv.drawHud();
  const [g, place] = log.last.marks;
  assert.equal(g.color, nodeMarkCss('mining'), 'the group\'s copper');
  assert.equal('color' in place, false, 'a mark with none, none');
});

test('GATHER-OW the filter: a switch of its own, Gathering - its marks counted under it and hidden when it is off (mutant: the gathering marks never filtered)', () => {
  assert.ok(TV_FILTER_GROUPS.includes('gathering'));
  assert.equal(TV_FILTER_TEXT.gathering, 'Gathering');
  assert.equal(markGroup('gather mining'), 'gathering');
  assert.equal(markGroup('gather herbalism'), 'gathering');
  const m = { kind: 'gather logging' };
  assert.equal(markShown(m, { gathering: true }), true);
  assert.equal(markShown(m, { gathering: false }), false);
  assert.equal(countGroups([m, { kind: 'gather mining' }, { kind: 'camp' }]).gathering, 2);
  const css = readFileSync(new URL('../src/ui/enhancedStyle.js', import.meta.url), 'utf8');
  assert.match(css, /\.tview-fdot-gathering \{ background: [^}]+\}/, 'its switch\'s dot');
});

test('GATHER-OW the glyph: the HUD draws a group as a diamond in its own colour - never a dot (mutants: the dot; the brass)', () => {
  const calls = [], fills = [];
  const ctx = new Proxy({}, {
    get: (t, k) => (k in t ? t[k] : k === 'measureText' ? (str) => ({ width: String(str).length * 7 }) : (...a) => { calls.push([k, ...a]); if (k === 'fill' || k === 'fillText') fills.push([k, t.fillStyle]); }),
    set: (t, k, v) => { t[k] = v; return true; },
  });
  const win = { devicePixelRatio: 1, innerWidth: 1280, innerHeight: 720, addEventListener() {}, removeEventListener() {} };
  const doc = { defaultView: win, fonts: null };
  const mk = (tag) => {
    const n = { tagName: tag.toUpperCase(), className: '', children: [], style: { setProperty() {} }, ownerDocument: doc, attrs: {}, dataset: {}, setAttribute(k, v) { this.attrs[k] = v; }, append(...c) { this.children.push(...c); }, remove() {}, addEventListener() {}, isConnected: true, width: 0, height: 0, getBoundingClientRect() { return { width: 0, height: 0 }; } };
    if (tag === 'canvas') n.getContext = () => ctx;
    return n;
  };
  Object.assign(doc, { createElement: mk, createElementNS: (_, tag) => mk(tag), getElementById: () => null, querySelectorAll: () => [], head: mk('head'), body: mk('body') });
  hud.showTravelViewHud({}, doc);
  try {
    hud.updateTravelViewHud({ feet: null, heading: null, yaw: 0, where: '', marks: [{ key: 'gather:405,150:mining', x: 300, y: 300, front: true, label: groupLabel('mining', 5), kind: 'gather mining', color: nodeMarkCss('mining') }] });
  } finally { hud.disposeTravelViewHud(); }
  assert.equal(calls.filter((c) => c[0] === 'arc').length, 0, 'a diamond, not a dot');
  assert.equal(calls.filter((c) => c[0] === 'lineTo').length, 3, 'its four corners');
  assert.deepEqual(fills.filter(([k]) => k === 'fill').map(([, c]) => c), [nodeMarkCss('mining')], 'in Mining\'s copper');
});

test('GATHER-OW the world host: the Overworld\'s marks take the gathering host\'s groups at the player\'s feet, beside the camps (by source)', () => {
  const w = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(w, /for \(const c of travelViewCamps\(\)\) marks\.push\(\{[^\n]*\}\); for \(const g of gatherHost\?\.overworldGroups\(walkMode \? player\.pos : cam\.pos\) \?\? \[\]\) marks\.push\(g\);/);
});
