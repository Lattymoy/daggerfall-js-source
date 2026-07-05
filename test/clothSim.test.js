import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCloth, stepCloth, makeCoreFn } from '../src/characters/clothSim.js';
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

// leg capsules for a gait phase (matches the viewer's leg model)
function legsAt(phase, strideAmp, bob) {
  const hipY = 0.86 + bob, ankleY = 0.06, legLen = hipY - ankleY, legX = 0.085, r = 0.10;
  const mk = (sgn, ph) => { const sang = -strideAmp*Math.sin(phase+ph); return { p0:[sgn*legX, hipY, 0], p1:[sgn*legX, hipY - Math.cos(sang)*legLen, Math.sin(sang)*legLen], r }; };
  return [mk(-1, 0), mk(1, Math.PI)];
}

test('no clipping during WALKING: cloth stays out of the swinging legs', () => {
  for (const name of ['Long Skirt', 'Plain Robes']) {
    const c = buildCloth(drapedGrid(name));
    let phase = 0;
    for (let s = 0; s < 600; s++) { phase += 0.12; const bob = 0.02*Math.sin(phase*2);
      stepCloth(c, 1/60, { gy: -7, gz: -1.6, pinDY: bob }, core, legsAt(phase, 0.44, bob)); }
    const legs = legsAt(phase, 0.44, 0);
    for (let i = 0; i < c.V; i++) {
      if (c.pinned[i]) continue;
      const y = c.pos[i*3+1], px = c.pos[i*3], pz = c.pos[i*3+2];
      if (y < 0.82) {
        for (const L of legs) { const t = Math.max(0, Math.min(1, (y-L.p0[1])/((L.p1[1]-L.p0[1])||1e-6)));
          const cx = L.p0[0]+(L.p1[0]-L.p0[0])*t, cz = L.p0[2]+(L.p1[2]-L.p0[2])*t;
          const d = Math.hypot(px-cx, pz-cz);
          assert.ok(d > L.r - 0.006, `${name}: particle inside a swinging leg (d=${d.toFixed(3)}, r=${L.r})`); }
      } else {
        const [hx, hz] = core(y); const A = hx+0.03, C = hz+0.03; const e = (px*px)/(A*A)+(pz*pz)/(C*C);
        assert.ok(e > 0.9, `${name}: particle inside the torso`);
      }
    }
  }
});
