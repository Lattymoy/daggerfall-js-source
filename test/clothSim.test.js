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
