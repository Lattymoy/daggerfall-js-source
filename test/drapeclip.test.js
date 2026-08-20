// NO DRAPE CLIPS THROUGH A BODY PART.
//
// A garment is an ellipse of rx by rz at each of its rows. A body point
// at (x, z) is inside it when (x/rx)^2 + (z/rz)^2 < 1. This walks every
// drape-wearing design, every row of its garment, and every body vertex
// near that row's height, and requires all of them to be inside.
//
// IT CHECKS THE TRUNK, AND THAT IS THE WHOLE LESSON HERE.
//
// The first version of this checked every group, found 669 clipping rows
// — every one of them an arm — and the fix sized each garment to contain
// its wearer's arms. That is arithmetically correct and visually awful:
// a garment cut to swallow a limb that hangs outside it is three sizes
// too big, and every robe came out a tent. Mac's words were "oversized
// and ugly" and "so much worse", and he was right.
//
// A ROBE IS CUT FOR A TORSO. Arms hang at the sides of one and always
// have; bone arms beside a lich's robe are what a lich looks like. What
// must never happen is cloth through a CHEST or a HIP, and that is what
// this measures.
//
// The lesson is not about drapes. A real fault, measured precisely and
// fixed thoroughly, can still leave the thing worse than it was — and
// the check that finds a fault is not automatically the check that
// should define the fix.
import test from 'node:test';
import assert from 'node:assert';
import { drapedGrid } from '../src/characters/pieces/draped.js';
import { buildNeutralBody } from '../src/characters/neutralBody.js';
import { buildPaperdollPayload } from '../src/characters/paperdollPayload.js';
import { UNDEAD_DESIGNS, undeadOpts } from '../src/characters/undeadBody.js';
import { CLASS_DESIGNS, classOpts } from '../src/characters/humanClasses.js';
import { DAEDRA_DESIGNS, daedraOpts } from '../src/characters/daedra.js';

const pal = { get: (i) => ({ r: (i * 7) & 255, g: (i * 5) & 255, b: (i * 3) & 255 }) };
const PAYLOAD = buildPaperdollPayload(null, null, null);

/** The fit that actually SHIPS, not a second copy of the maths. */
const shipped = new Map();
for (const line of [PAYLOAD.undead, PAYLOAD.classes, PAYLOAD.daedra, PAYLOAD.beasts, PAYLOAD.villagers]) {
  for (const d of line || []) if (d.drape) shipped.set(d.name, d.drape.fit);
}

function rowsOf(name) {
  const g = drapedGrid(name);
  if (!g) return [];
  const rows = [];
  for (let r = 0; r < g.rows; r++) {
    let y = 0;
    let rx = 0;
    let rz = 0;
    for (let c = 0; c < g.cols; c++) {
      const i = (r * g.cols + c) * 3;
      y = g.pos[i + 1];
      rx = Math.max(rx, Math.abs(g.pos[i]));
      rz = Math.max(rz, Math.abs(g.pos[i + 2]));
    }
    if (rx > 1e-6 && rz > 1e-6) rows.push({ y, rx, rz });
  }
  return rows;
}

const LINES = [
  [UNDEAD_DESIGNS, undeadOpts],
  [CLASS_DESIGNS, classOpts],
  [DAEDRA_DESIGNS, daedraOpts],
];

test('no drape clips through a body part', () => {
  const offences = [];
  for (const [designs, opts] of LINES) {
    for (const d of designs) {
      if (!d.drape) continue;
      const fit = shipped.get(d.name);
      assert.ok(fit, `${d.name} ships no drape fit at all`);
      // The viewer applies the widest row uniformly, because the cloth is
      // simulated and its constraints hold the rest shape.
      const k = Array.isArray(fit) ? Math.max(...fit) : fit;
      const { ramps, opts: o } = opts(d, pal);
      const faces = buildNeutralBody(ramps, o);
      for (const r of rowsOf(d.drape.name)) {
        for (const f of faces) {
          if (f.g !== 'body') continue; // the trunk, not the limbs
          for (let i = 0; i < 4; i++) {
            if (Math.abs(f.p[i * 3 + 1] - r.y) > 0.045) continue;
            const nx = Math.abs(f.p[i * 3]) / (r.rx * k);
            const nz = Math.abs(f.p[i * 3 + 2]) / (r.rz * k);
            if (Math.hypot(nx, nz) > 1) {
              offences.push(`${d.name}'s ${f.g} through ${d.drape.name} at y ${r.y.toFixed(2)}`);
            }
          }
        }
      }
    }
  }
  assert.deepEqual(offences.slice(0, 5), [], `${offences.length} clipping rows`);
});

test('the fit is measured per row, not one guessed number', () => {
  // Per-row is strictly more information than a single scale, and it is
  // what the cloth will use the day it is rebuilt per design rather than
  // scaled. If this collapses back to a scalar, the guess is back.
  for (const [name, fit] of shipped) {
    assert.ok(Array.isArray(fit), `${name}'s fit is a single number again`);
    assert.ok(fit.length > 1, `${name}'s fit has one row`);
    assert.ok(fit.every((k) => k >= 1), `${name} has a row narrower than the garment was cut`);
  }
});

test('no garment is scaled up beyond recognition', () => {
  // The guard against my own over-correction. A drape that has to grow
  // by half again is not being fitted, it is being inflated, and the
  // result is a tent — which is exactly what sizing them to contain arms
  // produced.
  for (const [name, fit] of shipped) {
    const k = Math.max(...fit);
    assert.ok(k < 1.35, `${name}'s garment is scaled to ${k.toFixed(2)} — that is a tent, not a fit`);
  }
});
