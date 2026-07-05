import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCloth, stepCloth, makeCoreFn, articulatedCapsules } from '../src/characters/clothSim.js';
import { drapedGrid, BODY_CORE } from '../src/characters/pieces/draped.js';

const core = makeCoreFn(BODY_CORE);
const SO = 0.030;

function simulate(name, steps, wind) {
  const cloth = buildCloth(drapedGrid(name));
  for (let s = 0; s < steps; s++) {
    const gait = Math.sin(s * 0.2);
    stepCloth(cloth, 1/60, { gy: -7, gx: wind ? 0.4*gait : 0, gz: wind ? -1.6 : 0, pinDY: 0.02*Math.sin(s*0.4) }, core);
  }
  return cloth;
}

test('cloth sim is stable (no NaN, bounded) for skirt, robe, cape', () => {
  for (const name of ['Long Skirt', 'Plain Robes', 'Casual Cloak']) {
    const c = simulate(name, 400, true);
    for (let i = 0; i < c.V*3; i++) {
      assert.ok(Number.isFinite(c.pos[i]), `${name}: non-finite at ${i}`);
      assert.ok(Math.abs(c.pos[i]) < 5, `${name}: exploded at ${i} = ${c.pos[i]}`);
    }
  }
});

test('no clipping: every free particle stays outside the body collider', () => {
  for (const name of ['Long Skirt', 'Plain Robes', 'Casual Cloak', 'Short Skirt']) {
    const c = simulate(name, 500, true);
    let worst = Infinity;
    for (let i = 0; i < c.V; i++) {
      if (c.pinned[i]) continue;
      const y = c.pos[i*3+1], px = c.pos[i*3], pz = c.pos[i*3+2];
      const [hx, hz] = core(y); const A = hx + SO, C = hz + SO;
      const e = (px*px)/(A*A) + (pz*pz)/(C*C); // >=1 means outside the standoff ellipse
      worst = Math.min(worst, e);
    }
    // allow a hair of numerical slack below the standoff shell, but never
    // inside the actual body (e >= (hx/(hx+SO))^2 ~ 0.9)
    assert.ok(worst > 0.9, `${name}: a particle clipped into the body (worst e=${worst.toFixed(3)})`);
  }
});

// Articulated limb collider for a gait phase (mirrors the viewer).
const GEOM = { legX: 0.082, hipY: 0.90, kneeY: 0.52, ankleY: 0.10, legR: [0.115, 0.10, 0.075] };
function capsFor(phase) {
  const sA = 0.44, kA = 0.9;
  return articulatedCapsules(GEOM, {
    legL: { sw: -sA*Math.sin(phase),         bd: kA*Math.max(0, Math.sin(phase+1.2)) },
    legR: { sw: -sA*Math.sin(phase+Math.PI), bd: kA*Math.max(0, Math.sin(phase+Math.PI+1.2)) },
  });
}
function capsuleDist(px, py, pz, C) {
  const p0 = C.p0, p1 = C.p1, abx=p1[0]-p0[0], aby=p1[1]-p0[1], abz=p1[2]-p0[2];
  const l2 = abx*abx+aby*aby+abz*abz || 1e-9;
  let t = ((px-p0[0])*abx + (py-p0[1])*aby + (pz-p0[2])*abz)/l2; t = Math.max(0, Math.min(1, t));
  const cx=p0[0]+abx*t, cy=p0[1]+aby*t, cz=p0[2]+abz*t, r = C.r0 + (C.r1-C.r0)*t;
  return Math.hypot(px-cx, py-cy, pz-cz) - r;   // TRUE 3D distance to the capsule surface; >0 outside
}

test('no clipping during WALKING: cloth stays out of the bent legs (arms hang outside)', () => {
  for (const name of ['Long Skirt', 'Plain Robes', 'Casual Cloak']) {
    const c = buildCloth(drapedGrid(name));
    let phase = 0;
    for (let s = 0; s < 700; s++) { phase += 0.11; const bob = 0.02*Math.sin(phase*2);
      stepCloth(c, 1/60, { gy: -7, gz: -1.6, pinDY: bob, capsules: capsFor(phase) }, core); }
    const caps = capsFor(phase);
    for (let i = 0; i < c.V; i++) {
      if (c.pinned[i]) continue;
      const px = c.pos[i*3], py = c.pos[i*3+1], pz = c.pos[i*3+2];
      for (const C of caps) assert.ok(capsuleDist(px, py, pz, C) > -0.004, `${name}: particle clipped into a leg (3D)`);
      if (py >= 0.80 && py <= 1.56) { const [hx, hz] = core(py); const A = hx+0.03, C2 = hz+0.03; const e = (px*px)/(A*A)+(pz*pz)/(C2*C2); assert.ok(e > 0.9, `${name}: particle inside the torso`); }
    }
  }
});
