// WB13f (2026-10-01, Mac: "just overall bring more AAA grade polish to what is already developed"): THE RHYTHM - no
// attack more than twice running (with the fighters spread, phase one was the Charge in 36 of 50 attacks, 28 back to
// back: now he walks in, and a walk-in of six seconds breaks the run, so one who keeps away is charged again), and his
// heaviest blows recover longer, in a spent pose a fighter can punish - slower, never
// faster (Mac, WBX: "I dont think making mechanics faster is the play") (bible/11-Multiplayer/World-Bosses.md section
// 20, WB13f).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ATTACKS, ATTACK_BY_ID, attacksFor, REPEAT_MAX, REPEAT_WALK_MS, newFight, joinFight, stepBrain, OPENING_MS, BASE_PROFILE } from '../../../src/net/gate/gateBrain.js';
import { GATE_STATE_EMPTY } from '../../../src/net/gate/gateLink.js';
import { bossAct, SPENT_ON, SPENT_FRAME, CAST_LOOSE_FRAME } from '../../../src/world/gate/gateBoss.js';

const W = (key, over = {}) => ({ i: 1, a: ATTACKS[key].id, at: 10000, x: 0, z: 0, yw: 0, tg: [], ...over });
const state = (over = {}) => ({ ...GATE_STATE_EMPTY, day: 700, boss: 'ruhn', hp: 900, max: 1000, fighters: 3, wrathAt: 10_000_000, ...over });
/** A seeded generator (mulberry32), so a fight steps the same every run. */
const seeded = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

test('WB13f never thrice running: the last attack is left out while anything else is open, may be forced once more, and then nothing - he walks at his target (mutants: the cap gone; the cap at one)', () => {
  assert.equal(REPEAT_MAX, 2);
  // a far target in phase one: the Charge alone is open
  const far = attacksFor(1, 20, 0, -1, BASE_PROFILE, 0).map((a) => a.key);
  assert.deepEqual(far, ['charge'], 'only the Charge reaches');
  assert.deepEqual(attacksFor(1, 20, 0, ATTACKS.charge.id, BASE_PROFILE, 1).map((a) => a.key), ['charge'], 'once more, forced');
  assert.deepEqual(attacksFor(1, 20, 0, ATTACKS.charge.id, BASE_PROFILE, 2), [], 'a third time: nothing');
  // anything else open: the last is left out whatever its run
  assert.ok(!attacksFor(1, 1, 1, ATTACKS.cleave.id, BASE_PROFILE, 1).some((a) => a === ATTACKS.cleave));
});

/** Every attack a fight begins over `ms` from its opening, stepped every 250 ms: its id, when it was begun and when its
 *  recovery ends. `bodies` is called each step with the fight. */
function attacksOver(f, ms, bodies, rng) {
  const seq = [];
  for (let t = OPENING_MS; t < OPENING_MS + ms; t += 250) {
    for (const w of stepBrain(f, t, bodies(f), rng)) if (w.k === 'atk') { const A = ATTACK_BY_ID[w.a]; seq.push({ a: w.a, t, end: w.at + A.active + A.recover }); }
  }
  return seq;
}

test('WB13f the brain: a court of fighters spread past his reach never sees one attack three times running - a run is broken only by another attack or a walk-in of REPEAT_WALK_MS (mutants: the run never counted; the run never passed; the walk-in never timed)', () => {
  const f = newFight(700, 0, 10_000_000, 'ruhn');
  for (const s of ['s1', 's2', 's3']) joinFight(f, s, s.toUpperCase(), 20, 0, true);
  f.shieldUntil = 0;
  const rng = seeded(7);
  const bodies = [{ sub: 's1', x: 18, z: 0, dead: false }, { sub: 's2', x: -18, z: 2, dead: false }, { sub: 's3', x: 0, z: 19, dead: false }];
  const seq = attacksOver(f, 120_000, () => bodies, rng);
  assert.ok(seq.length >= 8, `${seq.length} attacks`);
  let run = 0;
  for (let k = 0; k < seq.length; k++) {
    run = k > 0 && seq[k].a === seq[k - 1].a && seq[k].t - seq[k - 1].end < REPEAT_WALK_MS ? run + 1 : 1;
    assert.ok(run <= REPEAT_MAX, `${run} running at ${k}: ${seq.map((x) => x.a).join(',')}`);
  }
});

test('WB13f one who keeps away is charged again: twice running, a walk-in, and after REPEAT_WALK_MS of it the Charge again - never left untouched at range (mutants: the walk-in without end)', () => {
  assert.equal(REPEAT_WALK_MS, 6000);   // 19 m of his walk: across most of a court, so a walk-in mostly ends at its target
  const f = newFight(700, 0, 10_000_000, 'ruhn');
  joinFight(f, 'k1', 'K1', 20, 0, true);
  // always across the court from him, 20 m or more: the Charge alone reaches, and he never closes
  const seq = attacksOver(f, 60_000, (g) => [{ sub: 'k1', x: g.pos[0] >= 0 ? -20 : 20, z: 0, dead: false }], seeded(11));
  assert.ok(seq.every((x) => x.a === ATTACKS.charge.id), 'the Charge alone');
  assert.ok(seq.length >= 6, `${seq.length} charges in a minute`);
  const gaps = seq.slice(1).map((x, k) => x.t - seq[k].end);
  for (let k = 1; k < gaps.length; k++) assert.ok(gaps[k] >= REPEAT_WALK_MS || gaps[k - 1] >= REPEAT_WALK_MS, `three running: ${gaps.join(',')}`);
  assert.ok(gaps.some((g) => g >= REPEAT_WALK_MS) && gaps.every((g) => g < REPEAT_WALK_MS + 1000), `he walks in, and not for long: ${gaps.join(',')}`);
});

test('WB13f his heaviest blows recover longer - Slam 1.7 s, Leap 1.5 s, Nova 1.9 s - and every recovery is as long as it was or longer (mutants: the old Slam; the old Leap; the old Nova)', () => {
  assert.deepEqual([ATTACKS.slam.recover, ATTACKS.leap.recover, ATTACKS.nova.recover], [1700, 1500, 1900]);
  const was = { cleave: 900, slam: 1100, charge: 1200, hellfire: 900, nova: 1300, wrath: 0, leap: 900, meteor: 700, spokes: 500, cross: 600, reckon: 1800 };
  for (const [k, ms] of Object.entries(was)) assert.ok(ATTACKS[k].recover >= ms, `${k}: slower, never faster`);
});

test('WB13f spent: after the landing his heaviest blows leave him in their last frame until his recovery ends - his blade\'s swing, his fire\'s loosing - and then he moves again; a light blow none (mutants: never spent; spent for ever; spent on every blow; the fire swung; the frame not the swing\'s last)', () => {
  assert.deepEqual([...SPENT_ON], ['slam', 'leap', 'nova']);
  const slam = state({ atk: W('slam') }), end = 10000 + ATTACKS.slam.active + ATTACKS.slam.recover;
  assert.equal(bossAct(slam, 10000 + 900).act, 'spent');
  assert.equal(bossAct(slam, 10000 + 900).frame, SPENT_FRAME);
  assert.equal(bossAct(slam, 10000 + 200).frame, SPENT_FRAME, 'his swing\'s last frame, held');
  assert.equal(bossAct(slam, end - 1).act, 'spent');
  assert.notEqual(bossAct(slam, end).act, 'spent', 'his recovery over');
  const nova = state({ phase: 2, atk: W('nova') });
  assert.deepEqual([bossAct(nova, 10000 + 900).act, bossAct(nova, 10000 + 900).frame], ['spent', CAST_LOOSE_FRAME], 'his fire loosed, held');
  const cleave = state({ atk: W('cleave') });
  assert.notEqual(bossAct(cleave, 10000 + 900).act, 'spent', 'a light blow is not spent');
});
