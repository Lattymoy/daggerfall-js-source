// KETCH-LOOK KL3 (bible/11-Multiplayer/Sky-Ketch-Look.md "The shared kit", "The state language"): EVERY INSTRUMENT IN ONE
// INSTANCED DRAW (render/ketch/ktGaugePass.js). Each kind read at its shares through the fragment shader's own text (test/
// glsl.mjs runs it) and its JS twin, point for point: the dial's needle falls through its 270 degrees to its red pin, the
// glass fills from its foot, the lamps light from the left, the ring fills clockwise from the top, the pulse runs along
// its segment. The meaning rides the kind; a face is 12 floats. tools/mutants/ketch_look_law.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { glslFunctions } from '../../glsl.mjs';
import {
  ktGaugeAt, ktGaugePut, KT_GAUGE_FS, KT_GAUGE_KIND as K, KT_GAUGE_MEANING as M, KT_GAUGE_MEANING_STRIDE, KT_GAUGE_PART as P,
  KT_GAUGE_FLOATS, KT_GAUGE_MAX, KT_DIAL, KT_GAUGE_LOOK,
} from '../../../src/render/ketch/ktGaugePass.js';

const fs = glslFunctions(KT_GAUGE_FS, {}, { fp32: false });
const at = (kind, a, b, u, v) => ktGaugeAt(kind, a, b, u, v);
/** The share of a kind's lit signal over a fine grid of its face (the needle's hub and blade aside). */
function lit(kind, a, b = 0, n = 64) {
  let s = 0, all = 0;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const p = at(kind, a, b, -1 + (2 * i + 1) / n, -1 + (2 * j + 1) / n);
    if (p === P.signal) s++;
    if (p === P.signal || p === P.dark) all++;
  }
  return all ? s / all : 0;
}

test('KETCH-LOOK KL3 THE GAUGE\'S FRAGMENT IS ITS TWIN: every kind, at every share, at every point of a 41-point grid, the part the shader\'s own partAt answers is the one ktGaugeAt does (mutants: a kind\'s edge moved in one and not the other)', () => {
  let checked = 0;
  for (const kind of Object.values(K)) for (const a of [0, 0.13, 0.5, 0.77, 1]) for (const b of [1, 3, 5, 8]) {
    for (let j = 0; j <= 40; j++) for (let i = 0; i <= 40; i++) {
      const u = -1 + i / 20, v = -1 + j / 20;
      assert.equal(fs.partAt(kind, a, b, u, v), at(kind, a, b, u, v), `kind ${kind} a ${a} b ${b} at (${u}, ${v})`);
      checked++;
    }
  }
  assert.equal(checked, 5 * 5 * 4 * 41 * 41);
});

test('KETCH-LOOK KL3 THE DIAL IS TIME LEFT: its needle at the lower right when full, falling clockwise-back through 270 degrees to the lower left when spent, its red sector at the empty end; a ring of bezel, a hub lit (mutants: the needle the other way; the red sector at the full end)', () => {
  const tip = (a) => { const th = KT_DIAL.from + KT_DIAL.sweep * a; return [0.6 * Math.sin(th), 0.6 * Math.cos(th)]; };
  for (const a of [0, 0.25, 0.5, 0.75, 1]) { const [u, v] = tip(a); assert.equal(at(K.dial, a, 0, u, v), P.signal, `the needle at ${a}`); }
  const [fu, fv] = tip(1), [eu, ev] = tip(0);
  assert.ok(fu > 0 && fv < 0, 'full at the lower right'); assert.ok(eu < 0 && ev < 0, 'spent at the lower left');
  assert.equal(at(K.dial, 0.5, 0, fu, fv), P.face, 'the needle not where it is not');
  const red = KT_DIAL.from + KT_DIAL.red / 2, far = KT_DIAL.from + KT_DIAL.sweep - KT_DIAL.red / 2;
  assert.equal(at(K.dial, 1, 0, 0.76 * Math.sin(red), 0.76 * Math.cos(red)), P.red, 'red at the empty end');
  assert.equal(at(K.dial, 0, 0, 0.76 * Math.sin(far), 0.76 * Math.cos(far)), P.face, 'none at the full end');
  assert.equal(at(K.dial, 0.5, 0, 0, 0.93), P.bezel); assert.equal(at(K.dial, 0.5, 0, 0, 0), P.signal); assert.equal(at(K.dial, 0.5, 0, 0.9, 0.9), P.none);
});

test('KETCH-LOOK KL3 THE GLASS, THE LAMPS, THE RING, THE PULSE AT THEIR SHARES: the glass filled to its share from the foot, the lamps lit `a` of `b` from the left, the ring filled clockwise from the top to its share, the pulse at its share along the segment; nothing past 0..1 (mutants: the glass from the top; the lamps from the right; the ring counter-clockwise; a share unclamped)', () => {
  for (const a of [0, 0.25, 0.5, 0.75, 1]) {
    assert.ok(Math.abs(lit(K.glass, a) - a) < 0.04, `the glass at ${a}`);
    assert.ok(Math.abs(lit(K.ring, a) - a) < 0.04, `the ring at ${a}`);
  }
  assert.equal(at(K.glass, 0.3, 0, 0, -0.85), P.signal, 'the glass from its foot'); assert.equal(at(K.glass, 0.3, 0, 0, 0.85), P.dark);
  assert.equal(at(K.glass, 1.4, 0, 0, 0.9), P.signal); assert.equal(at(K.glass, -0.4, 0, 0, -0.9), P.dark);
  for (let n = 1; n <= 8; n++) for (let on = 0; on <= n; on++) {
    for (let i = 0; i < n; i++) assert.equal(at(K.lamps, on / n, n, -1 + (2 * i + 1) / n, 0), i < on ? P.signal : P.dark, `${on} of ${n}, stud ${i}`);
  }
  assert.equal(at(K.ring, 0.25, 0, 0.53, 0.53), P.signal, 'a quarter clockwise from the top'); assert.equal(at(K.ring, 0.25, 0, -0.53, 0.53), P.dark);
  assert.equal(at(K.ring, 0.5, 0, 0, 0), P.face); assert.equal(at(K.ring, 0.5, 0, 0, 0.95), P.bezel);
  for (const a of [0, 0.5, 1]) assert.equal(at(K.pulse, a, 0, -1 + 2 * a, 0), P.signal, `the pulse at ${a}`);
  assert.equal(at(K.pulse, 0, 0, 0.5, 0), P.dark); assert.equal(at(K.pulse, 0.5, 0, 0, 0.5), P.none); assert.equal(at(K.pulse, 0.5, 0, 0, 0.25), P.bezel);
  // past 0..1 a share is held at its end: the pulse at the segment's end, the needle at full
  assert.equal(at(K.pulse, 1.4, 0, 0.98, 0), P.signal, 'the pulse held at its end');
  const th = KT_DIAL.from + KT_DIAL.sweep;
  assert.equal(at(K.dial, 1.5, 0, 0.6 * Math.sin(th), 0.6 * Math.cos(th)), P.signal, 'the needle held at full');
});

test('KETCH-LOOK KL3 A FACE IS TWELVE FLOATS AND ITS MEANING RIDES ITS KIND: centre, right, up, kind plus stride times meaning, a, b; the kind read back whatever its meaning; four meanings, each a signal colour of its own (mutants: the meaning lost to the kind; a field off its slot)', () => {
  assert.equal(KT_GAUGE_FLOATS, 12); assert.ok(KT_GAUGE_MAX >= 64);
  const out = new Float32Array(2 * KT_GAUGE_FLOATS);
  assert.equal(ktGaugePut(out, 1, [1, 2, 3], [0.1, 0, 0], [0, 0.2, 0], K.lamps, M.ember, 0.5, 6), 2);
  assert.deepEqual([...out.slice(12)], [1, 2, 3, Math.fround(0.1), 0, 0, 0, Math.fround(0.2), 0, K.lamps + KT_GAUGE_MEANING_STRIDE * M.ember, 0.5, 6]);
  assert.deepEqual([...out.slice(0, 12)], new Array(12).fill(0), 'the face before untouched');
  for (const m of Object.values(M)) for (const kind of Object.values(K)) assert.equal(at(kind + KT_GAUGE_MEANING_STRIDE * m, 0.5, 4, 0, 0), at(kind, 0.5, 4, 0, 0), `kind ${kind} under meaning ${m}`);
  assert.equal(KT_GAUGE_LOOK.signal.length, Object.keys(M).length);
  assert.equal(new Set(KT_GAUGE_LOOK.signal.map(String)).size, Object.keys(M).length, 'each meaning its own colour');
  assert.ok(Object.values(K).every((k) => k < KT_GAUGE_MEANING_STRIDE));
});
