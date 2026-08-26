import assert from 'node:assert/strict';
import { buildNeutralBody, ARM_X } from '../src/characters/neutralBody.js';
import { buildPaperdollPayload } from '../src/characters/paperdollPayload.js';

const ramps = {
  skin: [[48,38,30],[96,72,54],[160,120,88],[220,180,140]],
  boot: [[30,24,20],[80,60,44],[130,100,72]],
};
const base = buildNeutralBody(ramps);
assert.equal(base.length, 2136, 'shoulder closure must preserve the 2136-face UV topology');

// The highest arm vertices are the deltoid end rings. They used to have a
// ~0.07 radius open circle; they must now be a near-point cap while preserving
// the same faces.
for (const [group, cx] of [['armL', -ARM_X], ['armR', ARM_X]]) {
  const fs = base.filter((f) => f.g === group);
  const maxY = Math.max(...fs.flatMap((f) => [f.p[1],f.p[4],f.p[7],f.p[10]]));
  const top = [];
  for (const f of fs) for (let i = 0; i < 4; i++) {
    const x = f.p[i*3], y = f.p[i*3+1], z = f.p[i*3+2];
    if (Math.abs(y - maxY) < 1e-7) top.push(Math.hypot(x - cx, z));
  }
  assert.ok(top.length > 0, `${group} must have a top ring`);
  assert.ok(Math.max(...top) < 0.02, `${group} shoulder top must be pinched closed`);
}

const D = buildPaperdollPayload(null, null, null);
assert.equal(D.n, base.length);
for (const c of D.clothing.filter((x) => x.kind === 'body')) {
  assert.ok(c.idx.length > 0, `${c.name} must own at least one body face`);
  for (let k = 0; k < c.idx.length; k++) {
    const f = c.idx[k];
    assert.notEqual(base[f].g, 'head', `${c.name} must never own a head face`);
    let moved = false;
    for (let j = 0; j < 12; j++) {
      if (Math.round(base[f].p[j] * 1000) !== c.P[k*12 + j]) { moved = true; break; }
    }
    assert.ok(moved, `${c.name} face ${f} must be a geometric garment face, not AO-only colour collateral`);
  }
}
console.log('voxel clothing regression probe: PASS');
