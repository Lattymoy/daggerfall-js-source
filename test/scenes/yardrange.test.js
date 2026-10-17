// YARD-RANGE (2026-10-11, a player: "browser version for me is unplayable nowadays I get like 20-40 fps in cities" -
// 19 fps, 1,523 draws, 61 ms of script; the owner: "look into limiting and improving performance with player's exterior
// decor items"). Other players' yards are drawn only as far as the Other players card says (net/yardRange.js, `yardRange`
// - Off stands none of them at all), one's own always; a yard's flats are cut by that distance as its models are (they
// had no cut: every standing yard's every flat, the whole streamed grid's); a piece too small to see is skipped
// (decorRoom.js decorPieceSeen); and the half-second sync no longer writes out every piece of every town to learn nothing
// changed. Every pin walks the REAL yard: scenes/homeYards.js createHomeYards over the real pool (scenes/decor/decorRoom.js).
// Each pin failed on the build before it. tools/mutants/yardrange.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createHomeYards, YARD_MIN_ANGLE, YARD_DRAW_M } from '../../src/scenes/homeYards.js';
import { YARD_RANGE_TIERS, YARD_RANGE_DEFAULT, yardRangeOf } from '../../src/net/yardRange.js';
import { decorPieceSeen, decorBoxSeen } from '../../src/scenes/decor/decorRoom.js';
import { PREF_DEFAULTS } from '../../src/systems/uiPrefs.js';
import { fakeDoc, fakeWin, settle } from '../decorFakes.mjs';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const box = (x0, y0, z0, x1, y1, z1) => ({ positions: new Float32Array([x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1]), indices: new Uint32Array([0, 1, 2]) });
const CRATE = 41000, CUP = 41001, BARN = 41002, FLAT = 200;
const model = (id, m, x = 8) => ({ id, model: m, flat: null, pos: [x, 0, 2], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 120 });
const flat = (id, x = 8) => ({ id, model: null, flat: [FLAT, 0], pos: [x, 0, 2], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 40 });

/** A town of four homes along x - mine at the eye, a stranger's 60 m off, another's 200 m off - each yard a crate (a
 *  metre cube), a cup (ten centimetres) and a flat (1.6 m); the eye at `eye`, the choice `range`; and a fourth's barn, 400 m off. */
function town({ range = () => undefined, eye = [0, 1.6, 10] } = {}) {
  const homeFrames = new Map([[300, { at: [0, 0, 10], box: [-4, 0, 7, 4, 6, 13] }], [301, { at: [60, 0, 10], box: [56, 0, 7, 64, 6, 13] }], [302, { at: [200, 0, 10], box: [196, 0, 7, 204, 6, 13] }], [303, { at: [400, 0, 10], box: [396, 0, 7, 404, 6, 13] }]]);
  const built = new Map([['0,0', { px: 0, py: 0, homeTown: 7, homeFrames, homeRegion: 17 }]]);
  const yard = (k) => [model(`c${k}`, CRATE), model(`u${k}`, CUP), flat(`f${k}`)];
  // 303: a barn eight metres across, 400 m off - big enough to see from there, past YARD_DRAW_M all the same
  const answer = { ok: true, data: { yards: [...[300, 301, 302].map((buildingKey) => ({ buildingKey, pieces: yard(buildingKey) })), { buildingKey: 303, pieces: [model('b303', BARN)] }] } };
  const drawn = [];
  const cpuModels = new Map([[CRATE, box(-0.5, 0, -0.5, 0.5, 1, 0.5)], [CUP, box(-0.05, 0, -0.05, 0.05, 0.1, 0.05)], [BARN, box(-4, 0, -4, 4, 6, 4)]]);
  const tex = { recordCount: 6, getSize: () => ({ width: 64, height: 64 }), getScale: () => ({ width: 0, height: 0 }) };
  const yards = createHomeYards({
    api: { yards: async () => answer },
    homes: { homeAt: (m, k) => (k === 300 ? { owner: 'Olga', own: true, mine: true } : { owner: 'Tomas', own: false }) },
    built: () => built, translation: () => [0, 0, 0], feet: () => [0, 0, 30], outside: () => true, eye: () => eye,
    range,
    collider: () => ({ addMesh() {}, removeBucket() {}, surfaceHit: () => null }),
    meshes: { getGpuMesh: async (id) => id, cpuModels },
    renderer: { drawMesh: (gpu, m) => drawn.push([gpu, m[12]]), recordShadowMesh() {}, createBillboardBatch: (a, r, size, at) => ({ a, r, size, at, origin: [0, 0, 0] }), destroyBillboardBatch() {} },
    getTexture: async () => tex, uploadRecord() {},
    doc: fakeDoc(), win: fakeWin(), canvas: null, touch: false, actionOf: () => null, locked: () => true, cursorOff() {}, stick: () => null,
    say() {}, refusal: (w) => w, openSlot() {}, now: () => 0,
  });
  const cam = { pos: eye, yaw: 0, pitch: 0 };
  const frames = async (n = 4) => { for (let i = 0; i < n; i++) { yards.frame({ dt: 1, cam, overlayUp: false }); await settle(); await settle(); } };
  const draw = () => { drawn.length = 0; yards.draw(); return drawn.map(([g, x]) => `${g === CRATE ? 'crate' : g === BARN ? 'barn' : 'cup'}@${Math.round(x)}`).sort(); };
  const flats = () => yards.batches().map((b) => Math.round(b.at[0][0])).sort((a, b) => a - b);
  return { yards, frames, draw, flats };
}

test('YARD-RANGE the law: the Other players card offers Off, 75 m, 150 m and 300 m - the default the distance every yard was drawn at, the shelf\'s own; a stored value that is no choice stands for the default; the card\'s row reads the law (mutants: the default, the tiers)', () => {
  assert.deepEqual(YARD_RANGE_TIERS, [0, 75, 150, 300]);
  assert.equal(YARD_RANGE_DEFAULT, YARD_DRAW_M);
  assert.equal(YARD_DRAW_M, 300, 'AUDIT\'s distance, unchanged');
  assert.equal(PREF_DEFAULTS.yardRange, YARD_RANGE_DEFAULT, 'the prefs shelf carries the law\'s own default');
  for (const v of YARD_RANGE_TIERS) assert.equal(yardRangeOf(v), v, `${v} is a choice`);
  for (const v of [undefined, null, 7, -300, '300', 301, true, Infinity, NaN]) assert.equal(yardRangeOf(v), YARD_RANGE_DEFAULT, `${String(v)} is no choice`);
  assert.match(src('src/ui/enhanced/enhancedMenu.js'), /choiceRow\('yardRange', t\('menu\.peers\.yards', 'Yard decorations'\),\n\s*t\('menu\.peers\.yardsNote', '[^']*Your own yard always shows\.[^']*'\),\n\s*YARD_RANGE_TIERS\.map\(\(m\) => \[m, m \? t\('menu\.peers\.metres', '\{m\} m', \{ m \}\) : t\('menu\.toggle\.off', 'Off'\)\]\), \{ home: true, read: \(\) => yardRangeOf\(getPref\('yardRange'\)\) \}\)\);/);
  assert.match(src('src/scenes/world.js'), /\n {4}range: \(\) => getPref\('yardRange'\),/, 'the streaming host reads the choice every frame');
});

test('YARD-RANGE the size: a piece is drawn while half its size over its distance is at least YARD_MIN_ANGLE (1/300) - a metre across to 150 m, a cup to 15 m; a box from its middle (mutants: the angle, the comparison)', () => {
  assert.equal(YARD_MIN_ANGLE, 1 / 300);
  assert.equal(decorPieceSeen(0.5, 150, 0, 0, YARD_MIN_ANGLE), true, 'a metre across, at 150 m');
  assert.equal(decorPieceSeen(0.5, 151, 0, 0, YARD_MIN_ANGLE), false, 'past it');
  assert.equal(decorPieceSeen(0.05, 0, 8.9, 12, YARD_MIN_ANGLE), true, 'a cup within 15 m');
  assert.equal(decorPieceSeen(0.05, 0, 9, 12.1, YARD_MIN_ANGLE), false, 'past it');
  assert.equal(decorPieceSeen(0.01, 1e6, 0, 0, 0), true, 'no angle: every one');
  assert.equal(decorBoxSeen([99, -1, -1, 101, 1, 1], [0, 0, 0], 1 / 60), true, 'half the diagonal, sqrt(3), at 100 m');
  assert.equal(decorBoxSeen([99, -1, -1, 101, 1, 1], [0, 0, 0], 1 / 50), false);
});

test('YARD-RANGE the draw: at the default every yard within 300 m stands its crate and its flat, the cup only near the eye; at 75 m a stranger\'s yard 200 m off draws nothing, flats and models alike; my own yard always (mutants: the flats uncut, the stranger\'s range unread, the size uncut, my own yard cut, HOME-YARD\'s YARD_DRAW_M unasked)', async () => {
  let range;
  const t = town({ range: () => range });
  await t.frames();
  assert.deepEqual(t.draw(), ['crate@208', 'crate@68', 'crate@8', 'cup@8'], 'the default: the cup too small to see past 15 m, the barn past YARD_DRAW_M');
  assert.deepEqual(t.flats(), [8, 68, 208]);
  range = 75;
  assert.deepEqual(t.draw(), ['crate@68', 'crate@8', 'cup@8'], 'the far stranger\'s yard: past the choice');
  assert.deepEqual(t.flats(), [8, 68], 'its flat with it');
  range = 0;
  await t.frames();
  assert.deepEqual(t.draw(), ['crate@8', 'cup@8'], 'Off: mine alone');
  assert.deepEqual(t.flats(), [8]);
  assert.deepEqual(t.yards.yards().map((y) => y.bk), [300], 'Off: no stranger\'s yard stands at all - nothing solid, no lamp');
  range = 300;
  await t.frames();
  assert.deepEqual(t.yards.yards().map((y) => y.bk).sort(), [300, 301, 302, 303], 'and stands again the moment it is chosen');
  t.yards.destroy();
});

test('YARD-RANGE my own yard far off: a home of mine 200 m away is drawn to YARD_DRAW_M whatever the choice (mutants: my own yard cut)', async () => {
  const t = town({ range: () => 75, eye: [200, 1.6, 10] });
  await t.frames();
  assert.deepEqual(t.draw(), ['crate@208', 'crate@8', 'cup@208'], 'mine, 200 m away; the far stranger\'s, now the near one');
  t.yards.destroy();
});

test('YARD-RANGE the sync: the town\'s answer is written out once a new answer lands, never at every half-second sync of an unchanged town (mutants: the signature remade every sync)', async (t) => {
  const yt = town();
  await yt.frames(2);
  let n = 0;
  const stringify = JSON.stringify;
  t.mock.method(JSON, 'stringify', (...a) => { n++; return stringify(...a); });
  await yt.frames(6);
  assert.equal(n, 0, 'six syncs of an unchanged town: nothing written out');
  assert.deepEqual(yt.draw(), ['crate@208', 'crate@68', 'crate@8', 'cup@8'], 'and every yard still stands');
  yt.yards.destroy();
});
