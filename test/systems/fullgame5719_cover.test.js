import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setPref } from '../../src/systems/uiPrefs.js';
import { Collider } from '../../src/player/collider.js';
import { createCoverIndex, coverProxy } from '../../src/ai/cover.js';
import { ArrowFlight } from '../../src/combat/arrowFlight.js';

test('FG-04: dungeon centering preserves person exemptions while ordinary decor still stops arrows', () => {
  setPref('enhancedAI', true);
  const source = readFileSync(new URL('../../src/scenes/dungeonContext.js', import.meta.url), 'utf8');
  const expression = source.match(/const based = ([^;]+);/)[1];
  const center = new Function('centers', 'size', `return ${expression};`);
  for (const exempt of [true, false]) for (const fromPlayer of [true, false]) {
    const points = center([Object.assign([0, 0.9, 5], { noCover: exempt })], { w: 1, h: 1.8 });
    const c = new Collider(() => 0); c.cover = createCoverIndex();
    c.cover.add('test', points.map((p) => coverProxy(p, { w: 1, h: 1.8 })));
    const f = new ArrowFlight({ getGpuMesh: () => null, collider: c });
    f.fire([0, 1, 0], [0, 0, 1], fromPlayer ? { fromPlayer: true } : { enemy: true });
    let hits = 0;
    const foe = { ai: { height: 1.8 }, entity: { health: 50 } };
    for (let i = 0; i < 40 && !f.arrows[0].dead; i++) f.update(1 / 60, fromPlayer
      ? { foeTargets: [{ feet: [0, 0, 9], ref: foe }], onPlayerArrowHitFoe: () => hits++ }
      : { playerFeet: [0, 0, 9], onPlayerHit: () => hits++ });
    assert.equal(c.cover.size(), exempt ? 0 : 1);
    assert.equal(hits, exempt ? 1 : 0);
  }
});
