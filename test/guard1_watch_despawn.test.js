// GUARD1 - THE WATCH THAT VANISHED (2026-09-15, relayed by Mac from a
// player: "after a while of chasing me around the villages they
// disappeared. And then i was free to go on a killing spree").
//
// THE DEFECT WAS A DROPPED CLAUSE. EnemyEntity.Update (:184-191)
// despawns the city watch on FOUR terms:
//
//     entityType == EnemyClass && careerIndex == Knight_CityWatch
//       && PlayerEntity.CrimeCommitted == Crimes.None
//       && !PlayerEffectManager.IsTransformedLycanthrope()
//
// and `scenes/cityGuards.js` carried three. The fourth is not
// decoration. This port also carries LycanthropyEffect.SuppressCrime
// (:121-124) - `court.js`'s one setter resolves EVERY crime write to
// None while the player is transformed - so the two laws compose:
// three clauses are true on every frame a werewolf is out, the whole
// watch is deleted, and no crime can ever summon another. DFU's
// fourth clause exists precisely to hold the watch standing through
// that window.
//
// WHY NO PIN CAUGHT IT. `test/cityguards.test.js`, the pool's own
// suite, is ARENA2-gated end to end, so CI has never run one line of
// the watch's behaviour. It does not need to be: the pool's records
// are its public `guards` array (roadg_pools.test.js's own technique)
// and the despawn arm runs before anything that wants art. These pins
// take no ARENA2 and run everywhere.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCityGuards, GUARD_MOBILE_TYPE, MAX_ACTIVE_GUARD_SPAWNS } from '../src/scenes/cityGuards.js';
import { setCrimeCommitted, CRIMES } from '../src/systems/court.js';
import { CRIMES as LEAF_CRIMES } from '../src/systems/crimes.js';
import { pickpocket } from '../src/systems/talk.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (rel) => readFileSync(join(root, rel), 'utf8');

const stubTex = { getFrameCount: () => 1, getSize: () => ({ width: 1, height: 1 }), getScale: () => ({ width: 0, height: 0 }) };

/** The pool with every seam stubbed and a spawn chain that THROWS, so
 *  "did the gate let this through" is observable with no ARENA2
 *  (AUDIT 62 F13's technique). */
function pool(playerEntity) {
  const freed = { n: 0 };
  const g = createCityGuards({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => { freed.n++; }, textures: new Map() },
    collider: { heightAt: () => 0, raycast: () => Infinity, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false },
    fetchBytes: async () => { throw new Error('SPAWNED'); },
    getTexture: async () => stubTex,
    uploadRecordFrame: () => {}, currentMinute: () => 0,
    playerEntity, audio: null, onPlayerHurt: () => {}, rand: () => 0.9,
  });
  return { g, freed };
}

let nextId = 0;
/** A live watchman in the shape the pool's own spawn builds - enough
 *  of one for update() to drive it for a frame. */
const watchman = () => ({
  id: ++nextId, dead: false, batch: {}, mobileType: GUARD_MOBILE_TYPE,
  _swingSeq: 0, _mout: null, archive: 399, tex: stubTex,
  entity: { health: 40, maxHealth: 40, activeEffects: [], items: [] },
  mobile: { update: () => ({ record: 0, frame: 0, flip: false }) },
  ai: {
    isHostile: true, feet: [1, 0, 1], yaw: 0, detected: true, inSight: true,
    _dist: 3, height: 1.8, moving: false, target: null, giveUpTimer: 200,
    update() {}, _centre: () => [1, 0.9, 1],
  },
  attack: { machine: { state: 'Idle' }, swingSeq: 0, update() {} },
  sounds: { tick: () => null },
  concealment: () => 0,
});

const frame = (g) => g.update(0.016, [0, 0, 0], [0, 1.7, 0]);

/** A transformed lycanthrope, in the shape systems/lycanthropy.js
 *  reads: a live, unended racialOverride effect flagged transformed. */
const werewolf = () => ({
  level: 1, reflexes: 2, crimeCommitted: 0,
  activeEffects: [{ kind: 'racialOverride', racial: 'lycanthropy', isTransformed: true }],
});

// ═══ (a) the three clauses that were there ════════════════════════
test('GUARD1: an ACTIVE crime keeps the watch, and clearing it walks them away', () => {
  const pe = { level: 1, reflexes: 2, crimeCommitted: CRIMES.Murder };
  const { g, freed } = pool(pe);
  for (let i = 0; i < 3; i++) g.guards.push(watchman());

  frame(g);
  assert.equal(g.activeCount(), 3, 'a live crime keeps every watchman standing');
  assert.equal(freed.n, 0, 'and frees no batch');

  pe.crimeCommitted = CRIMES.None;
  frame(g);
  assert.equal(g.activeCount(), 0, 'crime None despawns the watch (EnemyEntity.cs:184-191)');
  assert.equal(g.guards.length, 0, 'and the prune takes the records - they carry no corpse');
  assert.equal(freed.n, 3, 'every walk-away frees its billboard batch');
});

// ═══ (b) THE DROPPED CLAUSE ═══════════════════════════════════════
test('GUARD1: a TRANSFORMED lycanthrope does NOT despawn the watch, though the crime reads None', () => {
  // This is the whole finding. SuppressCrime holds crimeCommitted at
  // None for the entire transformation, so the first three clauses are
  // permanently true; only DFU's fourth keeps the watch alive.
  const pe = werewolf();
  assert.equal(setCrimeCommitted(pe, CRIMES.Murder), CRIMES.None,
    'SuppressCrime: a transformed lycanthrope is never tagged with a crime (LycanthropyEffect.cs:121-124)');

  const { g, freed } = pool(pe);
  for (let i = 0; i < 3; i++) g.guards.push(watchman());
  for (let i = 0; i < 5; i++) frame(g);
  assert.equal(g.activeCount(), 3, 'the watch keeps hunting the beast - EnemyEntity.cs:188');
  assert.equal(freed.n, 0, 'and nothing was freed');

  // ...and the term is the TRANSFORMATION, not the lycanthropy: the
  // same player back in human shape is an ordinary crime-free citizen
  // and the watch stands down as it does for anyone.
  pe.activeEffects[0].isTransformed = false;
  frame(g);
  assert.equal(g.activeCount(), 0, 'back in human shape the three-clause despawn applies again');
});

test('GUARD1: an ordinary mortal is untouched by the new term', () => {
  const pe = { level: 1, reflexes: 2, crimeCommitted: CRIMES.None, activeEffects: [] };
  const { g } = pool(pe);
  g.guards.push(watchman());
  frame(g);
  assert.equal(g.activeCount(), 0, 'no lycanthropy, no exemption');
});

// ═══ (c) the spawn gate still answers after a walk-away ═══════════
test('GUARD1: a fresh crime after a walk-away reaches the spawn chain', async () => {
  // The other half of the report - "then i was free to go on a killing
  // spree" - would also follow from a pool that refused to spawn again
  // after a despawn. It does not: the prune empties `guards`, so the
  // cap gate (PlayerEntity.cs:625) is open on the next crime.
  const pe = { level: 1, reflexes: 2, crimeCommitted: CRIMES.None, activeEffects: [] };
  const { g } = pool(pe);
  for (let i = 0; i < 3; i++) g.guards.push(watchman());
  frame(g);
  assert.equal(g.activeCount(), 0, 'the walk-away emptied the pool');

  pe.crimeCommitted = CRIMES.Murder;
  await assert.rejects(
    g.spawnCityGuards(true, { playerFeet: [0, 0, 0], playerFwd: [0, 0, 1], pool: [] }),
    /SPAWNED/, 'the ring fallback is reached again');
});

test('GUARD1: the cap is DFU\'s `<= maxActiveGuardSpawns`, on both sides of the edge', async () => {
  const pe = { level: 1, reflexes: 2, crimeCommitted: CRIMES.Murder, activeEffects: [] };
  for (const [n, through] of [[MAX_ACTIVE_GUARD_SPAWNS, true], [MAX_ACTIVE_GUARD_SPAWNS + 1, false]]) {
    const { g } = pool(pe);
    for (let i = 0; i < n; i++) g.guards.push(watchman());
    let reached = false;
    try { await g.spawnCityGuards(true, { playerFeet: [0, 0, 0], playerFwd: [0, 0, 1], pool: [] }); }
    catch (e) { reached = e.message === 'SPAWNED'; }
    assert.equal(reached, through, `${n} standing: the gate is \`activeCount() > ${MAX_ACTIVE_GUARD_SPAWNS}\``);
  }
});

// ═══ (d) crimeCommitted is a NUMBER, from one enum ════════════════
test('GUARD1: the pickpocket crime is the enum id, not a string', () => {
  // PlayerActivate.cs:1657 - `player.CrimeCommitted = Crimes.Pickpocketing`.
  const player = {
    level: 1, activeEffects: [], skills: {}, stats: {},
    items: [], skillUses: {},
  };
  // force the failure arm: chance is a Dice100 roll, so a roll of 100
  // fails for any skill this character could have
  pickpocket(player, { rolls: () => 0.999 });
  assert.equal(player.crimeCommitted, CRIMES.Pickpocketing, 'the id the court, the save and the watch all read');
  assert.equal(typeof player.crimeCommitted, 'number', 'one representation of crimeCommitted, not two');
});

test('GUARD1: the CRIMES enum has ONE home, and court.js re-exports the leaf', () => {
  assert.equal(CRIMES, LEAF_CRIMES, 'court.js re-exports systems/crimes.js - not a second copy');
  // ...and nothing declares a rival table. The enum is a leaf so that
  // the court/talk cycle cannot force a second representation again.
  const declarers = ['src/systems/court.js', 'src/systems/talk.js', 'src/systems/crimes.js']
    .filter((f) => /export const CRIMES = /.test(src(f)));
  assert.deepEqual(declarers, ['src/systems/crimes.js'], 'exactly one module declares CRIMES');
  assert.equal(/from '\.\/court\.js'/.test(src('src/systems/talk.js')), false,
    'talk.js still cannot import court.js - the cycle is real, which is why the enum moved');
});
