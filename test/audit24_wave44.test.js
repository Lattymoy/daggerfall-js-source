// AUDIT 24, wave 44: ShowMagicSparkles - and a wave-39 reading that
// was wrong.
//
// Wave 39 ported EnemyBlood.ShowBloodSplash and CUT ShowMagicSparkles,
// on the reading that its CasterOnly arm needed the player's feet and
// createPlayerMagic is handed an eye. That reading was wrong twice
// over, and the source says so plainly:
//
//   - the ONE call site is inside `EnemyCastReadySpell()`, whose own
//     comment reads "For enemies this is equivalent to
//     PlayerSpellCasting_OnReleaseFrame()". There is no sparkle on the
//     player's release path at all, so no player position is needed.
//   - and the position is the CASTER'S, not the target's:
//     `entityBehaviour` is the manager's own entity (:158), and an
//     EntityEffectManager sits on the caster.
//
// So it is the enemy blooming on itself, which every pool has had the
// position for since it had a foe.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHitEffects, bloodCentre, SPARKLES_RECORD, BLOOD_ARCHIVE } from '../src/scenes/hitEffects.js';
import { castEnemySpell } from '../src/characters/enemyCasting.js';

const rd = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const tick = () => new Promise((r) => setImmediate(r));

// Mutation campaign: 13 reintroductions, 13 killed. The record; the
// one-shot made to loop; the gate loosened either way, inverted, and
// dropped entirely; the bloom moved to the feet and moved to the
// target; the sparkles fired after the bundle instead of before; the
// executor's dep removed; each pool's hand-over removed; and
// showMagicSparkles unexported again.
// Two corrections, and one of them is the THIRD time:
//   - the dungeon's hand-over survived, because the pin scanned the
//     whole FILE for a `hitEffects,` line and dungeonContext also
//     exposes one on its returned object. Scoped to the
//     castEnemySpell CALL now.
//   - a regex over the gate's spelling false-killed
//     `f.ai.height` -> `f.ai.height ?? 1.8`, which is the same program
//     for every foe that has a height. That is the same false kill as
//     wave 42's and wave 43's, three waves running. The regex is gone;
//     the gate is pinned by behaviour over all five rangeTypes, in
//     both directions, which is what was doing the work anyway.

function rig() {
  const built = [];
  return {
    built,
    renderer: {
      createBillboardBatch: (archive, record, size, centres) => {
        const b = { archive, record, size, centres, frame: null }; built.push(b); return b;
      },
      destroyBillboardBatch: () => {},
    },
    getTexture: async () => ({
      recordCount: 8, getFrameCount: () => 4,
      getSize: () => ({ width: 16, height: 16 }), getScale: () => ({ width: 0, height: 0 }),
    }),
    uploadRecordFrame: () => {},
  };
}

/** The minimum a foe needs to be cast from. */
const foe = (height = 1.8) => ({
  ai: { feet: [4, 0, -2], height },
  entity: { level: 3, magicka: 100, spells: [] },
  _castPending: false,
});
const castDeps = (hitEffects, over = {}) => ({
  playerEntity: { level: 3 },
  applySpell: () => {},
  foeSinks: () => ({}),
  calculateCastCost: () => ({ sp: 0 }),
  silenceBlocksCast: () => false,
  explodeAt: () => {},
  fireMissile: () => {},
  hitEffects,
  ...over,
});

test('audit24 wave44: sparkles are record 3 of the SAME archive as blood', () => {
  // EnemyBlood.cs:23-24 - one archive, two records; :52 pins the same
  // ten frames a second as the splash.
  assert.equal(SPARKLES_RECORD, 3);
  assert.equal(BLOOD_ARCHIVE, 380);
});

test('audit24 wave44: the pool shows them, and they are a one-shot like the splash', async () => {
  const r = rig();
  const fx = createHitEffects({ renderer: r.renderer, getTexture: r.getTexture, uploadRecordFrame: () => {} });
  fx.showMagicSparkles([1, 2, 3]);
  await tick();
  assert.equal(r.built.length, 1);
  assert.equal(r.built[0].archive, 380);
  assert.equal(r.built[0].record, SPARKLES_RECORD);
  assert.deepEqual(r.built[0].centres[0], [1, 2, 3]);
  // it ends, like every other one-shot in the pool
  for (let i = 0; i < 6; i++) fx.tick(1 / 10);
  assert.equal(fx.batches().length, 0, 'a splash that never ends is a leak');
});

test('audit24 wave44: the gate is the TARGET TYPE - ranged casts do not sparkle', () => {
  // :2056-2058 - `TargetType != SingleTargetAtRange && != AreaAtRange`.
  // rangeType 2 and 4 are the two ranged ones; their visual is the
  // missile, which is why DFU leaves them out.
  const seen = [];
  const hitEffects = { showMagicSparkles: (p) => seen.push(p), showBloodSplash: () => {} };

  for (const [rangeType, label] of [[0, 'CasterOnly'], [1, 'Touch'], [3, 'AreaAroundCaster']]) {
    seen.length = 0;
    castEnemySpell(foe(), { rangeType, element: 0 }, castDeps(hitEffects));
    assert.equal(seen.length, 1, `${label} (rangeType ${rangeType}) sparkles`);
  }
  for (const [rangeType, label] of [[2, 'SingleTargetAtRange'], [4, 'AreaAtRange']]) {
    seen.length = 0;
    castEnemySpell(foe(), { rangeType, element: 0 }, castDeps(hitEffects));
    assert.equal(seen.length, 0, `${label} (rangeType ${rangeType}) does NOT - the missile is its visual`);
  }
});

test('audit24 wave44: they bloom on the CASTER, at its own five-eighths point', () => {
  // `entityBehaviour.transform.position + controller.center`, then
  // `y += height/8` - and entityBehaviour is the MANAGER'S OWN entity
  // (:158), so this is the caster, not whatever it is casting at.
  const seen = [];
  const hitEffects = { showMagicSparkles: (p) => seen.push(p), showBloodSplash: () => {} };
  const f = foe(1.8);
  castEnemySpell(f, { rangeType: 0, element: 0 }, castDeps(hitEffects, { playerFeet: [100, 0, 100] }));
  assert.equal(seen.length, 1);
  assert.deepEqual(seen[0], bloodCentre(f.ai.feet, f.ai.height), 'the same centre+height/8 point the splash uses');
  assert.deepEqual(seen[0], [4, 0 + 0.9 + 0.225, -2]);
  // emphatically NOT the player, who is a hundred metres away
  assert.notDeepEqual(seen[0], [100, 0, 100]);

  // a taller caster blooms higher - the point scales with the capsule
  const tall = foe(8);
  seen.length = 0;
  castEnemySpell(tall, { rangeType: 3, element: 0 }, castDeps(hitEffects));
  assert.deepEqual(seen[0], [4, 5, -2]);
});

test('audit24 wave44: it fires BEFORE the bundle lands, and a host without a pool is fine', () => {
  // :2050-2068 - the cast sound, then the sparkles, then the bundle.
  // The order matters because a CasterOnly spell that kills its caster
  // must still have sparkled.
  const order = [];
  const hitEffects = { showMagicSparkles: () => order.push('sparkles'), showBloodSplash: () => {} };
  castEnemySpell(foe(), { rangeType: 0, element: 0 }, castDeps(hitEffects, {
    playCastSound: () => order.push('sound'),
    applySpell: () => order.push('bundle'),
  }));
  assert.deepEqual(order, ['sound', 'sparkles', 'bundle']);

  // area-around-caster: sound, sparkles, then the explosion
  order.length = 0;
  castEnemySpell(foe(), { rangeType: 3, element: 0 }, castDeps(hitEffects, {
    playCastSound: () => order.push('sound'),
    explodeAt: () => order.push('explode'),
  }));
  assert.deepEqual(order, ['sound', 'sparkles', 'explode']);

  // no pool at all (a headless rig, a degraded host): no throw
  assert.doesNotThrow(() => castEnemySpell(foe(), { rangeType: 0, element: 0 }, castDeps(null)));
  assert.doesNotThrow(() => castEnemySpell(foe(), { rangeType: 1, element: 0 }, castDeps(undefined)));
});

test('audit24 wave44: both casting pools hand their blood pool to the executor', () => {
  // Scoped to the castEnemySpell CALL, not the file: dungeonContext
  // also exposes a `hitEffects,` on its returned object, and a bare
  // line-scan was satisfied by that one after the cast dep was
  // deleted. The pool has to reach the EXECUTOR.
  for (const f of ['src/scenes/dungeonContext.js', 'src/scenes/exteriorFoes.js']) {
    const src = rd(f);
    const i = src.indexOf('castEnemySpell(f, spell, {');
    assert.ok(i > 0, `${f}: calls the executor`);
    const call = src.slice(i, src.indexOf('});', i));
    assert.ok(/(^|\n)\s*hitEffects,/.test(call), `${f}: hands its pool to castEnemySpell`);
  }
  // the executor asks for it by NAME rather than importing a
  // module-level singleton - one pool per host, as the blood is
  assert.match(rd('src/characters/enemyCasting.js'), /hitEffects = null,/);
  // NOTE deliberately no regex over the gate's spelling. The gate is
  // pinned by BEHAVIOUR above (five rangeTypes, both directions), and
  // a regex here has already false-killed an equivalent rewrite three
  // waves running. A pin asserts what a line does.
  assert.match(rd('src/characters/enemyCasting.js'), /showMagicSparkles\(/, 'the executor is the caller');
});
