// X3-slice: exterior enemy CASTING - the ONE cast executor
// (characters/enemyCasting.js) + the pool/engine wiring.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { castEnemySpell } from '../src/characters/enemyCasting.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (f) => readFileSync(join(root, f), 'utf8');

const mkFoe = () => ({ entity: { level: 4, magicka: 30, health: 20, maxHealth: 20 }, ai: { feet: [10, 5, 20] } });
const mkDeps = (over = {}) => {
  const calls = { applied: [], exploded: [], fired: [], sounds: [] };
  const deps = {
    playerEntity: { level: 9, skills: [] },
    playerFeet: [0, 0, 0],
    applySpell: (spell, lvl, target, sinks, rolls, caster) => calls.applied.push({ spell, lvl, target, caster }),
    foeSinks: (f) => ({ tag: 'sinks-of', f }),
    calculateCastCost: (spell, who) => { calls.pricedOff = who; return { sp: 12 }; },
    silenceBlocksCast: () => false,
    playCastSound: (element, from) => calls.sounds.push({ element, from }),
    explodeAt: (...a) => calls.exploded.push(a),
    fireMissile: (...a) => calls.fired.push(a),
    ...over,
  };
  return { deps, calls };
};

test('x3 executor: the gates - silence blocks, the free rider bypasses, the cost prices off the PLAYER', () => {
  // silenced: nothing spends, nothing rings
  const f1 = mkFoe();
  const { deps: d1, calls: c1 } = mkDeps({ silenceBlocksCast: () => true });
  assert.equal(castEnemySpell(f1, { rangeType: 0, element: 4, effects: [] }, d1), false);
  assert.equal(f1.entity.magicka, 30);
  assert.equal(c1.sounds.length, 0);
  // the free rider bypasses the silence AND the cost
  const f2 = mkFoe();
  const { deps: d2, calls: c2 } = mkDeps({ silenceBlocksCast: () => true });
  assert.equal(castEnemySpell(f2, { rangeType: 0, element: 4, effects: [] }, { ...d2, noSpellPointCost: true }), true);
  assert.equal(f2.entity.magicka, 30, 'free = no spend');
  assert.equal(c2.applied.length, 1);
  // an ordinary cast prices off the PLAYER entity and floors at 0
  const f3 = mkFoe();
  f3.entity.magicka = 5;
  const { deps: d3, calls: c3 } = mkDeps();
  castEnemySpell(f3, { rangeType: 0, element: 4, effects: [] }, d3);
  assert.equal(c3.pricedOff, d3.playerEntity, 'EntityEffectManager :322-327: the null-caster cost reads the player');
  assert.equal(f3.entity.magicka, 0, '5 - 12 floors at 0 (DFU casts even past the pool)');
});

test('x3 executor: the three release arms - self, at-caster AoC excluding the caster, the missile', () => {
  // CasterOnly assigns to SELF through the caster wrapper
  const f1 = mkFoe();
  const { deps: d1, calls: c1 } = mkDeps();
  castEnemySpell(f1, { rangeType: 0, element: 2, effects: [] }, d1);
  assert.equal(c1.applied.length, 1);
  assert.equal(c1.applied[0].target, f1.entity);
  assert.equal(c1.applied[0].caster.entity, f1.entity, 'self-casts carry the caster wrapper');
  assert.equal(c1.sounds[0].element, 2, 'the element cast sound rings');
  assert.ok(f1._castPending, 'the sprite Spell one-shot arms');
  // AreaAroundCaster: instant at the caster MID-CAPSULE, caster excluded
  const f2 = mkFoe();
  const { deps: d2, calls: c2 } = mkDeps();
  castEnemySpell(f2, { rangeType: 3, element: 0, effects: [] }, d2);
  assert.equal(c2.exploded.length, 1);
  const [pos, , lvl, feet, wrapper, opts] = c2.exploded[0];
  assert.deepEqual(pos, [10, 5.9, 20], 'caster transform = mid-capsule');
  assert.equal(lvl, 4);
  assert.deepEqual(feet, [0, 0, 0]);
  assert.equal(wrapper.entity, f2.entity);
  assert.equal(opts.excludeFoe, f2, 'DoAreaOfEffect ignoreCaster');
  assert.equal(c2.fired.length, 0, 'no flight for AoC');
  // SingleTargetAtRange looses a missile from feet + 1.2
  const f3 = mkFoe();
  const { deps: d3, calls: c3 } = mkDeps();
  castEnemySpell(f3, { rangeType: 2, element: 3, effects: [] }, d3);
  assert.equal(c3.fired.length, 1);
  assert.deepEqual(c3.fired[0][0], [10, 6.2, 20], 'the loose point');
  assert.equal(c3.fired[0][2], 4, 'the caster level rides the missile');
});

test('x3 wiring: the pool spawns casters, the decision drives the shared executor, the engine flies enemy missiles', () => {
  const xf = src('src/scenes/exteriorFoes.js');
  assert.ok(xf.includes('assignEnemySpells(entity, sbi)'), 'exterior spawns assign the S16 lists');
  assert.ok(xf.includes('new EnemyCaster(entity, rolls)'), 'a listed caster gets the shared decision driver');
  assert.ok(xf.includes('f.caster.update(dt, f.ai, f.attack, playerFeet, playerEntity)'), 'the decision rides beside the attack machine');
  assert.ok(xf.includes('castEnemySpell(f, dec.spell, {'), 'and releases through the ONE executor');
  assert.ok(xf.includes('casting: !!f._castPending'), 'the sprite Spell one-shot rides the cast edge');
  const w = src('src/scenes/world.js');
  assert.ok(w.includes('spellsByIndex: () => spellsByIndex'), 'the world hands the SPELLS.STD map');
  assert.ok(w.includes('magic.fireEnemyMissile(from,'), 'enemy missiles release through the engine');
  const hm = src('src/scenes/hostMagic.js');
  assert.ok(hm.includes('fireEnemyMissile(from, dir, spell, casterLevel, casterFoe)'), 'the engine grew the enemy fire seam');
  const i = hm.indexOf('if (m.fromPlayer === false)');
  assert.ok(i > 0, 'the engine flies enemy missiles');
  const arm = hm.slice(i, i + 700);
  assert.ok(arm.includes('applySpellToPlayer(m.spell, m.casterLevel'), 'the impact applies at the CASTER level');
  assert.ok(arm.includes('foeSinks(m.casterFoe)'), 'the caster wrapper carries the transfer heal-back sinks');
});
