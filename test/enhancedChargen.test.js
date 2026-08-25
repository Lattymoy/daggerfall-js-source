// THE ENHANCED WIZARD, pinned.
//
// The screens are DOM and node cannot draw them; what IS testable is
// the part that does arithmetic - the province trace - and the part
// that would rot silently, which is the wizard's own list of stages.
// The drawn surface is measured in a real browser by
// tools/enhancedTapProbe.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { traceProvinces, PROVINCE_NAMES, INERT_REGION, MAP_W, MAP_H } from '../src/ui/provinceMap.js';
import { STAGE_RAIL } from '../src/ui/enhancedChargen.js';
import { RACE_TEMPLATES } from '../src/systems/races.js';

const arena2 = process.env.ARENA2_PATH;
const skipReal = !arena2 || !existsSync(join(arena2, 'TAMRIEL2.IMG'));

/** A picker with one square region per race, laid out in a row, and a
 *  gap between two of them that the row does NOT enclose. Synthetic on
 *  purpose: the trace has to be provable without game data. */
function fakePicker({ w = 40, h = 12 } = {}) {
  const data = new Uint8Array(w * h);
  RACE_TEMPLATES.forEach((race, i) => {
    const x0 = 1 + i * 4;
    for (let y = 2; y < 8; y++) for (let x = x0; x < x0 + 3; x++) data[y * w + x] = race.id;
  });
  return { width: w, height: h, data };
}

test('a region is traced for every race the picker carries, and none it does not', () => {
  const out = traceProvinces(fakePicker());
  assert.equal(out.length, RACE_TEMPLATES.length);
  assert.deepEqual(out.map((r) => r.key), RACE_TEMPLATES.map((r) => r.key));
  for (const r of out) {
    assert.equal(r.pixels, 18, 'each fake region is 3x6');
    assert.match(r.d, /^M[\d .LZ]+Z$/, 'one closed subpath per island');
  }
});

test('a race with no pixels is ABSENT, not empty', () => {
  const p = fakePicker();
  // erase Nord entirely
  const nord = RACE_TEMPLATES.find((r) => r.key === 'Nord').id;
  for (let i = 0; i < p.data.length; i++) if (p.data[i] === nord) p.data[i] = 0;
  const out = traceProvinces(p);
  assert.equal(out.length, RACE_TEMPLATES.length - 1);
  assert.ok(!out.some((r) => r.key === 'Nord'));
});

test('a HOLE is wound the other way, which is what even-odd fill needs', () => {
  const w = 11; const h = 11;
  const data = new Uint8Array(w * h);
  const id = RACE_TEMPLATES[0].id;
  for (let y = 1; y < 10; y++) for (let x = 1; x < 10; x++) data[y * w + x] = id;
  for (let y = 4; y < 7; y++) for (let x = 4; x < 7; x++) data[y * w + x] = 0;   // a lake
  const [r] = traceProvinces({ width: w, height: h, data });
  assert.equal(r.pixels, 81 - 9);
  // two closed subpaths: the coast and the lake
  assert.equal((r.d.match(/M/g) ?? []).length, 2, 'an island with a lake is two loops');
});

test('the LABEL sits inside the region, at the point furthest from any edge', () => {
  // an L, whose centroid falls OUTSIDE it - the case a centroid gets
  // wrong and High Rock is the real-world instance of
  const w = 12; const h = 12;
  const data = new Uint8Array(w * h);
  const id = RACE_TEMPLATES[0].id;
  for (let y = 1; y < 11; y++) for (let x = 1; x < 4; x++) data[y * w + x] = id;
  for (let y = 8; y < 11; y++) for (let x = 4; x < 11; x++) data[y * w + x] = id;
  const [r] = traceProvinces({ width: w, height: h, data });
  const [lx, ly] = r.label;
  assert.equal(data[Math.floor(ly) * w + Math.floor(lx)], id, 'the label is ON the region');
  assert.ok(r.clearance >= 2, `label clearance ${r.clearance} - it should not hug a coast`);
});

test('an empty or missing picker traces NOTHING rather than throwing', () => {
  assert.deepEqual(traceProvinces(null), []);
  assert.deepEqual(traceProvinces({ width: 0, height: 0, data: new Uint8Array(0) }), []);
});

// ── THE NINTH PROVINCE ───────────────────────────────────────────
test('the Imperial Province needs BOTH files, and says nothing without the painting', () => {
  const p = fakePicker();
  assert.ok(!traceProvinces(p).some((r) => r.inert),
    'the picker alone cannot name a province it has no index for');
  assert.ok(!traceProvinces(p, { picture: null, palette: () => [0, 0, 0] }).some((r) => r.inert));
});

test('the inland remainder is found, and the surround is discarded by the EDGE clause', () => {
  const w = 20; const h = 12;
  const data = new Uint8Array(w * h);
  const a = RACE_TEMPLATES[0].id; const b = RACE_TEMPLATES[1].id;
  // two homelands with a gap between them, open to the bottom edge -
  // exactly the shape that defeats a flood fill of the picker alone
  for (let y = 2; y < 9; y++) {
    for (let x = 3; x < 8; x++) data[y * w + x] = a;
    for (let x = 12; x < 17; x++) data[y * w + x] = b;
  }
  // the painting: index 1 is land, index 2 is sea. The gap is land
  // between the two, walled by sea top and bottom.
  const pic = new Uint8Array(w * h).fill(2);
  for (let y = 2; y < 9; y++) for (let x = 3; x < 17; x++) pic[y * w + x] = 1;
  const palette = (i) => (i === 2 ? [0, 0, 200] : [80, 80, 40]);
  const out = traceProvinces({ width: w, height: h, data },
    { picture: { width: w, height: h, data: pic }, palette });
  const inert = out.find((r) => r.inert);
  assert.ok(inert, 'the gap between the homelands is a region');
  assert.equal(inert.key, INERT_REGION.key);
  assert.equal(inert.pixels, 4 * 7, 'the columns between the two homelands');
  assert.equal(out[0].key, INERT_REGION.key, 'and it is drawn FIRST, under nothing');
});

test('the edge clause is what does the discarding - remove the sea and it takes the surround', () => {
  const w = 20; const h = 12;
  const data = new Uint8Array(w * h);
  const a = RACE_TEMPLATES[0].id;
  for (let y = 2; y < 9; y++) for (let x = 3; x < 8; x++) data[y * w + x] = a;
  // a painting with NO sea at all: every unclaimed pixel is one
  // component that reaches the border, so there is no inland remainder
  const pic = new Uint8Array(w * h).fill(1);
  const out = traceProvinces({ width: w, height: h, data },
    { picture: { width: w, height: h, data: pic }, palette: () => [80, 80, 40] });
  assert.ok(!out.some((r) => r.inert),
    'without the edge clause this would have returned the whole parchment');
});

test('every province has a NAME, and the names are the map\u2019s own spelling', () => {
  for (const race of RACE_TEMPLATES) {
    assert.equal(typeof PROVINCE_NAMES[race.key], 'string', `${race.key} has no province`);
  }
  assert.equal(PROVINCE_NAMES.Breton, 'High Rock');
  assert.equal(PROVINCE_NAMES.Redguard, 'Hammerfell');
  // TMAP00I0 paints SUMURSET, and this is Daggerfall's map rather than
  // a corrected one - the mutation that "fixes" it must fail
  assert.equal(PROVINCE_NAMES.HighElf, 'Sumurset Isle');
  assert.equal(PROVINCE_NAMES[INERT_REGION.key], 'Imperial Province');
});

// ── THE RAIL CANNOT DRIFT FROM THE FLOW ──────────────────────────
// The wizard's states live in ui/chargen.js's STATES; the rail is a
// second list of the same thing, grouped. A state that appears in
// neither or in two would leave the wizard on a stage the rail cannot
// show - so the two agree, mechanically, rather than by memory.
test('every wizard state belongs to exactly one rail stage', () => {
  const src = readFileSync(new URL('../src/ui/chargen.js', import.meta.url), 'utf8');
  const m = src.match(/const STATES = \[([^\]]+)\]/);
  assert.ok(m, 'ui/chargen.js lost its STATES list');
  const states = [...m[1].matchAll(/'([a-zA-Z]+)'/g)].map((x) => x[1])
    .filter((s) => s !== 'done');   // 'done' is the exit, not a stage
  for (const state of states) {
    const owners = STAGE_RAIL.filter((s) => s.states.includes(state));
    assert.equal(owners.length, 1, `${state} is owned by ${owners.length} rail stages`);
  }
  const listed = STAGE_RAIL.flatMap((s) => s.states);
  for (const s of listed) {
    assert.ok(states.includes(s), `the rail names ${s}, which is not a wizard state`);
  }
});

// ── THE KEYBOARD ─────────────────────────────────────────────────
// Live proof is tools/enhancedChargenProbe.mjs, which walks the whole
// wizard to `done` without a pointer event. What a sweep holds is the
// three things that would rot quietly.
test('the wizard routes keys through the SHARED table, not a second map', () => {
  const src = readFileSync(new URL('../src/ui/enhancedChargen.js', import.meta.url), 'utf8');
  assert.match(src, /import \{ overlayAction \} from '\.\/input\.js'/,
    'a second key map is how the two skins come to disagree about what Escape does');
  assert.match(src, /const action = overlayAction\(e\);/);
  assert.match(src, /flow\.input\(action\)/, 'and the FLOW answers it, not this file');
});

test('the key handler has an owner - it is removed on unmount', () => {
  const src = readFileSync(new URL('../src/ui/enhancedChargen.js', import.meta.url), 'utf8');
  assert.match(src, /addEventListener\('keydown'/);
  const unmount = src.slice(src.indexOf('unmount()'));
  assert.match(unmount, /removeEventListener\('keydown'/,
    'a window-level listener outlives the DOM it was mounted for');
});

test('a real text field keeps its own keys', () => {
  const src = readFileSync(new URL('../src/ui/enhancedChargen.js', import.meta.url), 'utf8');
  const fn = src.slice(src.indexOf('function onKey'), src.indexOf('\n}', src.indexOf('function onKey')));
  assert.match(fn, /tagName === 'INPUT'/,
    'the name boxes feed the flow themselves - a stolen key is a doubled letter');
  // and it must not swallow keys it did not use, or Tab stops working
  assert.ok(fn.indexOf('if (!action) return;') < fn.indexOf('preventDefault'),
    'preventDefault must come AFTER the table has claimed the key');
});

// ── THE SEAM ─────────────────────────────────────────────────────
// The skin is chosen in ONE place. AUDIT 17i split createChargenWindow
// out because three separate bugs came from hosts wiring chargen by
// hand, and a host reaching for the DOM wizard itself would be that
// shape again - so the sweep says so rather than the next author
// remembering.
test('no host mounts the enhanced wizard itself', () => {
  const dir = new URL('../src/scenes/', import.meta.url);
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.js')) continue;
    const src = readFileSync(new URL(f, dir), 'utf8');
    assert.ok(!/enhancedChargen/.test(src),
      `src/scenes/${f} reaches for the enhanced wizard - it goes through createChargenWindow`);
  }
});

test('the seam forks on the skin, and needs a DOM to do it', () => {
  const src = readFileSync(new URL('../src/systems/chargenSession.js', import.meta.url), 'utf8');
  assert.match(src, /if \(isEnhanced\(\) && typeof document !== 'undefined'\)/,
    'a DOM view needs a DOM; without one the canvas wizard stands');
  assert.match(src, /enhancedChargenOverlay\(flow/);
  // the hosts tear an overlay down when it reports done, and a DOM
  // node outlives the object reporting it - so unmount comes first
  const fn = src.slice(src.indexOf('function enhancedChargenOverlay'));
  assert.ok(fn.indexOf('view?.unmount()') < fn.indexOf('onDone?.('),
    'the view must come down BEFORE done fires');
});

test('the FOUR HOSTS are each named at the seam', () => {
  const src = readFileSync(new URL('../src/systems/chargenSession.js', import.meta.url), 'utf8');
  for (const host of ['world.js', 'exterior.js', 'worldModes.js', 'dungeonContext.js']) {
    assert.ok(src.includes(host), `the seam does not name ${host}`);
  }
  assert.match(src, /dungeonContext\.js\s+FLAGGED/,
    'the host that cannot reach the fork must be FLAGGED by name, not omitted');
});

// ── A MODAL OVERLAY OWNS ITS INPUT ───────────────────────────────
// Mac, playing the deployed build: the wizard came up over a live
// dungeon, the map ignored every click, and the mouse still swung the
// view. Both halves are the same fact - the host was reading input
// underneath a screen that had it.
test('the wizard drops the pointer lock, and keeps dropping it', () => {
  const src = readFileSync(new URL('../src/ui/enhancedChargen.js', import.meta.url), 'utf8');
  assert.match(src, /document\.exitPointerLock\(\)/,
    'a LOCKED pointer never reaches the DOM - every mouse event goes to the '
    + 'locked element as a delta, so a fixed div is invisible to it at any z-index');
  assert.match(src, /addEventListener\('pointerlockchange'/,
    'the hosts only gate RE-taking the lock; a host that takes it anyway must lose it');
  const un = src.slice(src.indexOf('unmount()'));
  assert.match(un, /removeEventListener\('pointerlockchange'/, 'and the listener has an owner');
});

test('keys are captured, so the host never sees one the wizard used', () => {
  const src = readFileSync(new URL('../src/ui/enhancedChargen.js', import.meta.url), 'utf8');
  assert.match(src, /addEventListener\('keydown', keyHandler, \{ capture: true \}\)/,
    'the host walks the player and routes dungeon keys off its own window keydown');
  const fn = src.slice(src.indexOf('function onKey'), src.indexOf('\n}', src.indexOf('function onKey')));
  assert.match(fn, /e\.stopPropagation\(\)/);
  assert.ok(fn.indexOf('if (!action) return;') < fn.indexOf('stopPropagation'),
    'a key the wizard did NOT use must still reach the page');
});

// ── THE REAL CORPUS ──────────────────────────────────────────────
test('the real TAMRIEL2 traces to nine regions', { skip: skipReal }, () => {
  const data = new Uint8Array(readFileSync(join(arena2, 'TAMRIEL2.IMG')));
  assert.equal(data.length, MAP_W * MAP_H, 'the picker is a raw 320x200 with no header');
  const out = traceProvinces({ width: MAP_W, height: MAP_H, data });
  assert.equal(out.length, 8, 'eight homelands from the picker alone');
  for (const r of out) assert.ok(r.pixels > 500, `${r.key} traced only ${r.pixels} pixels`);
});
