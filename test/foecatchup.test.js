// FOE-CATCHUP (2026-09-26, SquidKamer on the Discord: "you drop to 1 fps for a few seconds and get jumped by
// everyone"; Mac, asked: "Yes, add the cap"). A foe's body steps at FIXED_DT for whatever time the frame hands it, and a
// step is the port's dearest work (the path check's capsule casts, the sight rays - measured, 84% of a crowd's ray time
// is ClearPathToPosition's). At 10 fps each foe ran six steps a frame, so under a crowd a hitch made the next frame
// dearer and that one dearer still. The pools now hand their foes at most three steps' worth a frame
// (characters/enemyMotor.js foeFrameDt): from 20 fps up nothing changes; below it foes move a little slower than the
// world instead of the world stopping. The motor's own contract (update(dt) advances dt) is unchanged.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EnemyAI, foeFrameDt, FOE_MAX_FRAME_DT } from '../src/characters/enemyMotor.js';
import { FIXED_DT, MAX_FRAME_DT } from '../src/player/motor.js';

const clearCollider = () => ({ raycast: () => Infinity, capsuleCast: () => ({ dist: Infinity, key: null }), move: () => ({ grounded: true }) });
/** An EnemyAI whose fixed steps are counted. */
function counted() {
  const ai = new EnemyAI(clearCollider(), [0, 0, 0], 0);
  let steps = 0;
  const step = ai._step.bind(ai);
  ai._step = (...a) => { steps++; return step(...a); };
  return { ai, steps: () => steps };
}

test('FOE-CATCHUP: a pool\'s foe steps as before down to 20 fps, and never more than three steps a frame below it', () => {
  assert.equal(FOE_MAX_FRAME_DT, 3 * FIXED_DT);
  for (const [fps, want] of [[60, 1], [30, 2], [20, 3], [10, 3], [4, 3]]) {
    const { ai, steps } = counted();
    for (let i = 0; i < 12; i++) ai.update(foeFrameDt(1 / fps), [0, 0, 30]);
    assert.equal(steps(), 12 * want, `${fps} fps: ${want} step(s) a frame`);
  }
});

test('FOE-CATCHUP: the motor\'s own contract stands - handed 0.1 it still steps 0.1; the cap is the pools\', not the body\'s', () => {
  const { ai, steps } = counted();
  ai.update(0.1, [0, 0, 30]);
  assert.equal(steps(), 6, 'six steps for a tenth of a second, as every motor pin assumes');
  assert.equal(MAX_FRAME_DT, 0.25, 'the player\'s jank clamp is untouched');
  // a hitch: a crowd of forty at a 0.1 s frame costs 120 foe-steps where it cost 240
  const pool = Array.from({ length: 40 }, counted);
  for (const f of pool) f.ai.update(foeFrameDt(0.1), [0, 0, 30]);
  assert.equal(pool.reduce((n, f) => n + f.steps(), 0), 120);
});

test('FOE-CATCHUP by source: every pool hands its foes foeFrameDt - the street\'s, the watch\'s and the dungeon\'s', () => {
  const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
  assert.match(rd('src/scenes/exteriorFoes.js'), /f\.ai\.update\(foeFrameDt\(dt\), playerFeet, _armed\(f, senses\), _fParalyzed, _fPaused\);/);
  assert.match(rd('src/scenes/cityGuards.js'), /g\.ai\.update\(foeFrameDt\(dt\), playerFeet, _armed\(g, senses\), _gParalyzed\);/);
  assert.match(rd('src/scenes/dungeonContext.js'), /f\.ai\.update\(foeFrameDt\(dt\), _pf, _armed\(f, _senses, _roomFoe\), _fParalyzed, _fPaused\);/);
  for (const p of ['src/scenes/exteriorFoes.js', 'src/scenes/cityGuards.js', 'src/scenes/dungeonContext.js']) {
    assert.doesNotMatch(rd(p), /\.ai\.update\(dt,/, `${p}: no foe body is handed the raw frame`);
  }
});

test('AUDIT pre-merge P5 + P6 by source: the attack, the cast and the seducer step on the same capped clock as the motor in every pool (a hitch no longer swings at once while the body crawls); offline, the quest\'s box holds an arrow in flight with its archer', () => {
  const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
  const x = rd('src/scenes/exteriorFoes.js'), g = rd('src/scenes/cityGuards.js'), d = rd('src/scenes/dungeonContext.js'), w = rd('src/scenes/world.js');
  assert.match(x, /f\.attack\.update\(foeFrameDt\(dt\), f\.ai, _tgt, _fPaused\)/);
  assert.match(x, /f\.caster\.update\(foeFrameDt\(dt\), f\.ai, f\.attack, _tgt, _castTargetEntity\)/);
  assert.match(x, /f\.seducer\?\.update\(foeFrameDt\(dt\), /);
  assert.match(g, /g\.attack\.update\(foeFrameDt\(dt\), g\.ai, _tgt\)/);
  assert.match(d, /f\.attack\.update\(foeFrameDt\(dt\), f\.ai, _tgt, _fPaused\)/);
  assert.match(d, /f\.caster\.update\(foeFrameDt\(dt\), f\.ai, f\.attack, _tgt, _castEnt\)/);
  assert.match(d, /f\.seducer\?\.update\(foeFrameDt\(dt\), /);
  for (const [name, t] of [['street', x], ['watch', g], ['dungeon', d]]) assert.doesNotMatch(t, /\.(?:attack|caster|seducer\??)\.update\(dt,/, `${name}: no machine left on the frame's own clock`);
  assert.match(w, /const foeDt = _questBoxHoldsFoes\(\) \? 0 : dt;[\s\S]*?arrows\.update\(foeDt, \{/, 'the arrows on the held clock');
});
