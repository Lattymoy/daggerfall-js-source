// INVIS-SWING (FIELD BUGS 2026-10-15f, a Discord report: "True Invisibility works properly in the overworld, but inside
// dungeons, monsters still spot and attack me immediately while the spell is active"). The senses were right - an
// Invisibility blinds every foe but DFU's thirteen seers (EnemySenses.BlockedByIllusionEffect) - but the melee START
// faced the target's live feet, where DFU's MeleeAnimation faces senses.LastKnownTargetPos (EnemyAttack.cs:155), which
// only a detection writes. A foe a corridor put in front of an invisible player swung, and the blow landed. And the
// wild gate's notice roll (WILD-ALERT) ran the stealth formula with no illusion gate at all.
// bible/01-Overview/bugs/Field-Bugs-2026-10-15f.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EnemyAI, MELEE_DISTANCE } from '../../../src/characters/enemy/enemyMotor.js';
import { EnemyAttack } from '../../../src/characters/enemy/enemyAttack.js';
import { runTargetMachine } from '../../../src/characters/enemy/enemyTargets.js';
import { sensesContext } from '../../../src/scenes/shared.js';
import { applySpell, isInvisible, concealmentFlags } from '../../../src/systems/effects.js';
import { noticeRoll, noticeChance, createWildAlert, WILD_ROLL_S } from '../../../src/systems/wild/wildAlert.js';
import { setSeed } from '../../../src/formats/dfRandom.js';

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };

/** A player who cast a True Invisibility on themselves through the one spell door (concealment.test.js's), or not. */
const caster = (invisible) => {
  const p = { stats: { willpower: 50 }, career: {}, health: 100, maxHealth: 100, level: 10, reflexes: 2, skills: {}, activeEffects: [] };
  if (invisible) applySpell({ element: 4, rangeType: 0, effects: [{ type: 13, subType: 1, durationBase: 60, durationMod: 1, durationPerLevel: 1 }] }, 2, p, {}, seq(0));
  return p;
};
/** An open floor: every ray clear, the ground at nought. */
const floor = () => ({
  raycast: () => Infinity, heightAt: () => 0, capsuleCast: () => ({ dist: Infinity, key: null }),
  move(feet, dx, dy, dz) { feet[0] += dx; feet[1] += dy; feet[2] += dz; if (feet[1] <= 0) { feet[1] = 0; return { grounded: true }; } return { grounded: false }; },
});
/** A dungeon foe in a corridor, 1.5 m from the player and facing them, its motor and its attack run as the dungeon host
 *  runs them (the armed targeting over the pool, then EnemyAttack.update at the target's feet) for twenty seconds. */
const corridor = (player, { seesThroughInvisibility = false } = {}) => {
  setSeed(7);
  const ai = new EnemyAI(floor(), [0, 0, 1.5], Math.PI, { liveSpeed: 50, seesThroughInvisibility, rolls: () => 0.5 });
  const attack = new EnemyAttack({ liveSpeed: () => 50, playerLevel: () => 10, reflexes: 2, rolls: () => 0.5 });
  const rec = { ai, attack, entity: { team: 'PlayerEnemy', health: 10 } };
  let swings = 0, minutes = 0;
  for (let i = 0; i < 60 * 20; i++) {
    const s = sensesContext(player, minutes, { movingLessThanHalfSpeed: true, candidates: () => [rec] });
    ai.update(1 / 60, [0, 0, 0], { ...s, rolls: () => 0.5, targeting: (_a, pf, cdt) => runTargetMachine(rec, [rec], pf, cdt, { playerEntity: player }) });
    const before = attack.swingSeq;
    if (ai.target) attack.update(1 / 60, ai, [0, 0, 0]);
    if (attack.swingSeq !== before) swings++;
    if (i % 60 === 0) minutes++;
  }
  return { swings, ai };
};

test('INVIS-SWING: a foe facing an invisible player within reach never starts a swing - it never detected them; seen, it swings; a seer swings at the invisible (mutant: the live feet\'s bearing)', () => {
  const hidden = caster(true);
  assert.equal(isInvisible(hidden), true, 'the spell took');
  const blind = corridor(hidden);
  assert.equal(blind.ai.inSight, true, 'in its line of sight, the ray clear');
  assert.equal(blind.ai.detected, false, 'and never detected - the illusion blocks it');
  assert.equal(blind.ai.lastKnownTargetPos, null, 'so no sense ever wrote where I stand');
  assert.equal(blind.swings, 0, 'twenty seconds a step and a half off: no swing');
  assert.ok(corridor(caster(false)).swings >= 1, 'the same foe, the player seen: it swings');
  assert.ok(corridor(hidden, { seesThroughInvisibility: true }).swings >= 1, 'a seer (a Lich, a Vampire, a Daedra) swings at the invisible');
});

test('INVIS-SWING: the start faces where the foe last knew the target stood - a target standing before it whom it knows to be behind it draws no swing; with nothing known, none (mutants: the known spot unread, the null let through)', () => {
  const run = (known) => {
    const a = new EnemyAttack({ liveSpeed: 200, playerLevel: 1, reflexes: 2, rolls: () => 0.0 });
    a.meleeTimer = 0;
    const ai = { _dist: 1.0, feet: [0, 0, 0], yaw: 0, inSight: true, detected: true, giveUpTimer: 200, lastKnownTargetPos: known };
    setSeed(3);   // the classic byte's stream (audit24 characters-3c's)
    for (let i = 0; i < 60; i++) a.update(1 / 15, ai, [0, 0, 1]);
    return a.swingSeq > 0;   // the start count the hosts read (AUDIT 68 S04)
  };
  assert.equal(run([0, 0, 1]), true, 'known ahead, standing ahead: it swings');
  assert.equal(run([0, 0, -1]), false, 'known behind it: it faces no one it knows of');
  assert.equal(run(null), false, 'never known: DFU\'s ResetPlayerPos passes no yaw test');
  assert.ok(1.0 <= MELEE_DISTANCE);
});

test('INVIS-SWING: the wild gate\'s notice is blinded by an Invisibility as the senses are - never noticed, the stealth die never drawn; a seer rolls as before (mutants: the illusion unread, the seer blinded)', () => {
  const hid = concealmentFlags(caster(true));
  let draws = 0;
  const die = () => { draws++; return 0; };
  for (let i = 0; i < 50; i++) assert.equal(noticeRoll(1, 60, 0, { concealment: hid, rng: die }), false);
  assert.equal(draws, 0, 'an Invisibility blocks without a die');
  assert.ok(noticeChance(1, 60, 0) > 90, 'and the same check, seen, is near certain');
  assert.equal(noticeRoll(1, 60, 0, { concealment: hid, seesThrough: true, rng: () => 0 }), true, 'a seer notices');
  assert.equal(noticeRoll(1, 60, 0, { concealment: concealmentFlags(caster(false)), rng: () => 0 }), true, 'unconcealed: the stealth check alone');
  // the gate's own step, a classic minute a check
  const gate = createWildAlert({ rng: () => 0 });
  for (let i = 0; i < 20; i++) gate.step('band', { distM: 1, reachM: 60, stealth: 0, scaledDt: WILD_ROLL_S, concealment: hid });
  assert.equal(gate.alerted('band'), false, 'twenty checks beside an invisible traveller: unaware');
  gate.step('seer', { distM: 1, reachM: 60, stealth: 0, scaledDt: WILD_ROLL_S, concealment: hid, seesThrough: true });
  assert.equal(gate.alerted('seer'), true);
});

test('INVIS-SWING by source: world.js hands both wild checks the traveller\'s concealment and the enemy\'s sight through it (mutants: either dropped)', () => {
  const w = read('src/scenes/world.js');
  assert.match(w, /const noticed = !fast \|\| noticeRoll\([^\n]*\{ seesThrough: !!ENEMY_BASICS\[hit\.mobileType\]\?\.seesThroughInvisibility, concealment: concealmentFlags\(playerEntity\), rng: Math\.random \}\);/);
  assert.match(w, /const fx = player\.feetAt\(\), stealth = wildStealth\(\), hid = concealmentFlags\(playerEntity\),/);
  assert.match(w, /wildFoes\.step\(f, \{[^\n]*seesThrough: !!f\.ai\.seesThroughInvisibility, concealment: hid \}\);/);
});
