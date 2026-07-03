import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { buildBody, BARE_PLUGS } from '../src/characters/rewrite/body.js';

// Characters C4: the vendored Rewrite rig must stay byte-identical to
// project-final's canonical copy - 16 bare-humanoid cases (loco x hold
// + plug-free specials) hashed exactly like Voxlight's 78-case gate,
// baseline captured from rewrite/rig at vendor time.
const H = (o) => createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0, 16);
const BASE = JSON.parse(readFileSync(new URL('./fixtures/bare-body-parity.json', import.meta.url), 'utf8'));

test('rig: vendored bare humanoid matches the canonical baseline', () => {
  for (const loco of ['stand', 'walk', 'run', 'crouch', 'strafe'])
    for (const hold of ['idle', 'aimed'])
      assert.equal(H(buildBody({ loco, hold, phase: 0.37 }, BARE_PLUGS)), BASE[`${loco}/${hold}`], `${loco}/${hold}`);
  for (const [k, extra] of [['jump', { jumpU: 0.5 }], ['death', { deathU: 0.5 }],
    ['aimpitch', { aimPitch: 0.4 }], ['movedir', { moveDir: [0.7, 0.714] }],
    ['stride', { strideAmp: 0.5, liftAmp: 0.4, swayAmp: 0.3 }], ['landdip', { landDip: 0.5 }]])
    assert.equal(H(buildBody({ loco: 'walk', hold: 'aimed', phase: 0.37, ...extra }, BARE_PLUGS)), BASE[`sp/${k}`], `sp/${k}`);
});

test('rig: bare humanoid face count + shape', () => {
  const faces = buildBody({ loco: 'stand', hold: 'idle', phase: 0 }, BARE_PLUGS);
  assert.equal(faces.length, BASE.__bareFaceCount);
  assert.equal(faces.length, 710);
  for (const f of faces.slice(0, 20)) {
    assert.ok(f.p.length % 3 === 0 && f.p.length >= 9);
    assert.equal(f.n.length, 3);
    assert.equal(f.c.length, 3);
  }
});
