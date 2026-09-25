// WB3 (2026-09-25, Mac: "a gate of oblivion which takes place in a large boss arena with an oversized enemy with
// telegraphed attacks (like wind ups, etc)", and Option B: the relay's Durable Object is the authority over the boss):
// THE GATE'S BOSS ROOM, DRIVEN. The brain as pure law over a seeded rng and a fake clock (net/gateBrain.js: the
// numbers a claim sets, the join, every refusal a blow can meet, the walk, the attacks and their shapes, the phases,
// the wrath, who earned it, the checkpoint); the kill's receipt (net/gateReceipt.js: the relay's first signature, the
// identity token's ladder rung for rung, never mistaken for one); the `gate` frame both ways (net/wire.js); and the
// relay over the real Room (server/src/index.js: the window at the Worker and at the hello, the join, the beat, the
// blows, the kill said once, the receipts, the hub's line, a wake, the day's end).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  newFight, joinFight, applyHit, stepBrain, stateOf, earned, earnedBy, topDealers, pickTarget, attacksFor, chooseAttack, windupOf,
  keepInCourt, dpsRef, clampLv, COURT_CENTRE, COURT_R, BOSS_R, BOSS_REACH_R, BOSS_SPEED, BRAIN_TICK_MS, CHECKPOINT_MS, OPENING_MS,
  STATE_SEND_MS, HP_SEND_MS, SHIELD_MS, PHASE_AT, PHASE3_WINDUP, BOSS_TTK_S, BUCKET_RATE_X, BUCKET_DEPTH_X, HIT_CAP_X,
  GATE_HIT_HZ_MAX, MELEE_REACH, POSE_SLACK, HIT_KINDS, ATTACKS, ATTACK_BY_ID, THREAT_PICK, RECEIPT_SHARE, STOOD_SHARE,
  GATE_FIGHTERS_MAX, LV_MAX, TARGET_HOLD_MS,
} from '../src/net/gateBrain.js';
import { mintReceipt, verifyReceipt, readReceipt, receiptValid, importReceiptKey, RECEIPT_V, RECEIPT_MAX, RECEIPT_TTL_S } from '../src/net/gateReceipt.js';
import { mintToken, verifyToken, _b64url } from '../src/net/identityToken.js';
import {
  parseClient, validGateIn, validGateOut, relaySupportsGate, gateGate, GATE_RELAY_MIN, GATE_HZ_MAX, GATE_KINDS, GATE_OUT_KINDS,
  GATE_NO_WORDS, GATE_RECEIPT_MAX, GATE_DMG_WIRE_MAX, GATE_LV_WIRE_MAX, RELAY_VERSION, DROP_STRIKES_MAX, SOCIAL_ROOM,
} from '../src/net/wire.js';
import { gateTimes, gateRoomKey, gateBossOf, GATE_COLLAPSE_MS } from '../src/net/gateLaw.js';
import { relayVersionAtLeast } from './relayVersion.mjs';
import worker from '../server/src/index.js';
import { fakeRoom, fakeRooms } from './fakeRoom.mjs';
import { OnlineSession } from '../src/net/online.js';
import { fakeSocketClass } from './fakeSocket.mjs';

const subtle = globalThis.crypto.subtle;
/** A seeded [0,1) source (mulberry32) - the pins' own dice, so every draw is the same every run. */
function seeded(seed = 1) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const T0 = 1_000_000;
const WRATH = T0 + 3_600_000;
/** A fight with fighters at levels `lvs` (subs s1, s2, ...), the clock at T0. */
function fightOf(lvs = [10]) {
  const f = newFight(7, T0, WRATH, 'ruhn');
  lvs.forEach((lv, i) => assert.ok(joinFight(f, `s${i + 1}`, `P${i + 1}`, lv, T0, true)));
  return f;
}
const body = (sub, x, z, dead = false) => ({ sub, x, z, dead });

// ═══ THE BRAIN ══════════════════════════════════════════════════════════════════════════════════════════════════

test('WB3 brain: the numbers a claim sets - the health a player brings and the bucket that bounds them grow together, so NO claim buys a faster kill: one player at the cap kills their own share in (BOSS_TTK_S - BUCKET_DEPTH_X) / BUCKET_RATE_X seconds at every level (mutants: the share off the claim; the bucket rate off the claim; the one-blow cap lifted)', () => {
  assert.equal(dpsRef(1), 6); assert.equal(dpsRef(20), 25); assert.equal(dpsRef(999), 5 + LV_MAX, 'a claim past the ceiling is the ceiling');
  assert.equal(clampLv(0), 1); assert.equal(clampLv(NaN), 1); assert.equal(clampLv(12.9), 12);
  const fastest = (BOSS_TTK_S - BUCKET_DEPTH_X) / BUCKET_RATE_X;
  assert.equal(fastest, 75, 'seventy-five seconds of one player at the cap - the burst the bucket holds, then its rate');
  for (const lv of [1, 10, 30, 60]) {
    const f = fightOf([lv]);
    assert.equal(f.max, BOSS_TTK_S * dpsRef(lv));
    let now = T0, blows = 0;
    // the most a modified client could claim, as often as the blow rate lets it land
    while (!f.fell && blows < 100000) { applyHit(f, 's1', GATE_DMG_WIRE_MAX, HIT_KINDS.Shaft, { x: 0, z: 8 }, now); now += 1000 / GATE_HIT_HZ_MAX; blows++; }
    const took = (f.fell.at - T0) / 1000;
    assert.ok(took >= fastest - 0.3 && took <= fastest + 0.6, `level ${lv}: the kill took ${took}s`);
    assert.ok(f.players.s1.clipped > 0, 'and what was claimed past the bucket was counted, not believed');
  }
});

test('WB3 brain: the join - a newcomer brings its share at the boss\'s CURRENT fraction (a late arrival heals nothing), a second `in` keeps the first claim, nobody new while the gate is not open or once the fight is over, and the court holds GATE_FIGHTERS_MAX (mutants: a late share added whole; a re-claim raising the cap; the admits ignored)', () => {
  const f = fightOf([10]);
  f.hp = f.max / 2;
  assert.ok(joinFight(f, 's2', 'P2', 30, T0 + 1000, true));
  assert.equal(f.max, BOSS_TTK_S * (dpsRef(10) + dpsRef(30)));
  assert.ok(Math.abs(f.hp / f.max - 0.5) < 1e-9, 'half before, half after');
  assert.ok(joinFight(f, 's2', 'Renamed', 60, T0 + 2000, false), 'a fighter is in whatever the window says');
  assert.equal(f.players.s2.lv, 30, 'the first claim stands');
  assert.equal(f.players.s2.name, 'Renamed');
  assert.equal(joinFight(f, 's3', 'P3', 10, T0, false), false, 'a stranger while the gate is not open');
  f.fell = { at: T0, top: [], n: 2 };
  assert.equal(joinFight(f, 's3', 'P3', 10, T0, true), false, 'a stranger once the boss has fallen');
  const full = newFight(7, T0, WRATH, 'ruhn');
  for (let i = 0; i < GATE_FIGHTERS_MAX; i++) assert.ok(joinFight(full, `x${i}`, 'X', 1, T0, true));
  assert.equal(joinFight(full, 'late', 'L', 1, T0, true), false, 'the checkpoint\'s bound');
});

test('WB3 brain: a blow - refused from a stranger, while he is shielded, past the account\'s blow rate, with no pose, from off the court, and a swing from past his reach (a shaft from the same spot lands); a blow past the one-blow cap or the bucket is CLIPPED and counted (mutants: each refusal removed; the cap and the bucket swapped)', () => {
  const f = fightOf([10]);
  const ref = dpsRef(10), near = { x: 0, z: BOSS_R + 1 };
  assert.equal(applyHit(f, 'nobody', 10, 0, near, T0), 0, 'a stranger');
  f.shieldUntil = T0 + 100;
  assert.equal(applyHit(f, 's1', 10, 0, near, T0), 0, 'shielded');
  f.shieldUntil = 0;
  let t = T0 + 1000;
  const landed = [0, 1, 2, 3, 4].map(() => applyHit(f, 's1', 1, 0, near, t));
  assert.deepEqual(landed.map((x) => x > 0), [true, true, true, true, false], 'GATE_HIT_HZ_MAX blows in one instant, not a fifth');
  t += 1000;
  assert.equal(applyHit(f, 's1', 5, 0, null, t), 0, 'no pose, no blow');
  assert.equal(applyHit(f, 's1', 5, HIT_KINDS.Shaft, { x: 0, z: COURT_R + POSE_SLACK + 0.5 }, t), 0, 'nobody strikes the court from off it');
  const far = { x: 0, z: BOSS_R + MELEE_REACH + POSE_SLACK + 0.5 };
  assert.equal(applyHit(f, 's1', 5, HIT_KINDS.Melee, far, t), 0, 'a swing from past his reach');
  assert.equal(applyHit(f, 's1', 5, HIT_KINDS.Spell, far, t), 5, 'a spell from the same spot lands');
  const g = fightOf([10]);
  assert.equal(applyHit(g, 's1', 1e6, HIT_KINDS.Melee, near, T0 + 10), HIT_CAP_X * ref, 'one blow: the cap');
  assert.equal(g.players.s1.clipped, 1e6 - HIT_CAP_X * ref);
  const burst = applyHit(g, 's1', 1e6, HIT_KINDS.Melee, near, T0 + 20);
  assert.ok(burst < HIT_CAP_X * ref && burst > 0, `the bucket's rest: ${burst}`);
  assert.ok(Math.abs(burst - (BUCKET_DEPTH_X - HIT_CAP_X) * ref - 0.01 * BUCKET_RATE_X * ref) < 1e-6, 'what the bucket held and refilled in 10 ms');
  assert.equal(g.threat.s1, g.players.s1.dealt, 'what landed is the threat');
});

test('WB3 brain: the kill - at zero the fight stamps its fall once (when, the three who dealt most, how many fought), and nothing moves it after: no blow lands, no beat speaks, no newcomer joins (mutants: the top unordered; a blow after the fall landing)', () => {
  const f = fightOf([10, 10, 10, 10]);
  const near = { x: 0, z: 2 };
  let t = T0;
  const deal = (sub, times) => { for (let i = 0; i < times; i++) { t += 300; applyHit(f, sub, 50, 0, near, t); } };
  deal('s2', 30); deal('s4', 20); deal('s1', 10);
  assert.deepEqual(topDealers(f, 3), ['P2', 'P4', 'P1']);
  f.hp = 1;
  t += 300;
  applyHit(f, 's3', 50, 0, near, t);
  assert.deepEqual(f.fell, { at: t, top: ['P2', 'P4', 'P1'], n: 4 });
  assert.equal(f.hp, 0);
  assert.equal(applyHit(f, 's1', 50, 0, near, t + 500), 0, 'a blow on the fallen');
  assert.equal(f.fell.at, t, 'and the fall is stamped once');
  assert.deepEqual(stepBrain(f, t + 1000, [body('s1', 0, 3)], seeded()), [], 'the beat says nothing more');
});

test('WB3 brain: the first beats - he stands OPENING_MS, then walks at a far target at BOSS_SPEED stopping short of it, and says the walk again only when its goal moved or a second passed; a near target is attacked, a Charge only past its minimum gap (mutants: no opening; the walk said every beat; the charge at any gap)', () => {
  const f = fightOf([10]);
  const rng = seeded(3);
  assert.deepEqual(stepBrain(f, T0 + 250, [body('s1', 0, 7)], rng).filter((o) => o.k === 'atk' || o.k === 'mv'), [], 'the opening');
  // phase one, a target 7 m off (gap 5.2): in a Cleave's reach
  const out = stepBrain(f, T0 + OPENING_MS, [body('s1', 0, 7)], rng);
  const atk = out.find((o) => o.k === 'atk');
  assert.ok(atk, 'attacked');
  assert.ok([ATTACKS.cleave.id].includes(atk.a), `a Cleave at 5.2 m (no one inside the Slam, too near for a Charge): ${atk.a}`);
  assert.equal(atk.at, T0 + OPENING_MS + ATTACKS.cleave.windup);
  assert.equal(atk.yw, 0, 'turned at the target, due south');
  // a target 12 m off in phase one: past the Cleave, inside the Charge's minimum? gap 10.2 >= 8 - a Charge
  const g = fightOf([10]);
  const c = stepBrain(g, T0 + OPENING_MS, [body('s1', 12, 0)], seeded(4)).find((o) => o.k === 'atk');
  assert.equal(c.a, ATTACKS.charge.id);
  assert.deepEqual(c.tg, [[BOSS_REACH_R, 0]], 'the lane runs toward the target and is kept inside his disc');
  // between the Cleave's reach and the Charge's minimum: he walks
  const h = fightOf([10]);
  const w = stepBrain(h, T0 + OPENING_MS, [body('s1', 0, 9)], seeded(5));
  const mv = w.find((o) => o.k === 'mv');
  assert.ok(mv && !w.some((o) => o.k === 'atk'), 'gap 7.2: too far to cleave, too near to charge - he walks');
  assert.equal(mv.v, BOSS_SPEED);
  assert.ok(Math.abs(mv.tz - (9 - BOSS_R - 1)) < 0.01 && mv.tx === 0, 'stopping short of the target by his body and a metre');
  assert.equal(stepBrain(h, T0 + OPENING_MS + BRAIN_TICK_MS, [body('s1', 0.2, 9)], seeded(6)).filter((o) => o.k === 'mv').length, 0, 'a goal that barely moved is not said again');
  assert.ok(Math.abs(h.pos[1] - BOSS_SPEED * BRAIN_TICK_MS / 1000) < 1e-9, 'and he walked a beat\'s worth');
});

test('WB3 brain: the attacks\' tables - every attack\'s wind-up long enough to run clear of it from its middle at the player\'s 7.6 m/s, phase three a fifth shorter (the wrath\'s never), a Slam only with someone inside it, the last attack left out while another is open, each chosen by its weight (mutants: a wind-up shortened past escape; phase three\'s cut on the wrath)', () => {
  const RUN = 7.6;
  // from the middle of each shape to its nearest edge: half a Cleave's length, a Slam's whole radius (its middle is his
  // feet), half a lane's width, a Hellfire's radius (it is laid under the player), half the Nova's band
  const escape = { cleave: ATTACKS.cleave.r / 2, slam: ATTACKS.slam.r, charge: ATTACKS.charge.width / 2, hellfire: ATTACKS.hellfire.r, nova: (ATTACKS.nova.r1 - ATTACKS.nova.r0) / 2 };
  for (const [k, need] of Object.entries(escape)) {
    const a = ATTACKS[k];
    assert.ok(windupOf(a, 3) / 1000 * RUN >= need, `${a.name}: ${windupOf(a, 3)} ms outruns ${need} m even in phase three`);
    assert.equal(windupOf(a, 3), Math.round(a.windup * PHASE3_WINDUP));
    assert.equal(windupOf(a, 2), a.windup);
  }
  assert.equal(windupOf(ATTACKS.wrath, 3), ATTACKS.wrath.windup);
  assert.deepEqual(ATTACK_BY_ID.map((a) => a.id), [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(attacksFor(1, 1, 0).map((a) => a.key), ['cleave'], 'phase one, close, nobody inside the slam');
  assert.deepEqual(attacksFor(1, -1, 1).map((a) => a.key), ['cleave', 'slam'], 'a player inside his body is in reach of everything close');
  assert.deepEqual(attacksFor(1, 1, 1).map((a) => a.key), ['cleave', 'slam']);
  assert.deepEqual(attacksFor(1, 1, 1, ATTACKS.cleave.id).map((a) => a.key), ['slam'], 'not the same twice');
  assert.deepEqual(attacksFor(1, 1, 0, ATTACKS.cleave.id).map((a) => a.key), ['cleave'], 'unless nothing else is open');
  assert.deepEqual(attacksFor(2, 20, 0).map((a) => a.key), ['charge', 'hellfire', 'nova']);
  const counts = new Map();
  const rng = seeded(9);
  const can = attacksFor(2, 1, 2);
  for (let i = 0; i < 9000; i++) { const a = chooseAttack(can, rng); counts.set(a.key, (counts.get(a.key) ?? 0) + 1); }
  const total = can.reduce((s, a) => s + a.w, 0);
  for (const a of can) assert.ok(Math.abs(counts.get(a.key) / 9000 - a.w / total) < 0.03, `${a.key} by its weight`);
});

test('WB3 brain: the phases - at 66% and 33% he roars (`ph`), stands shielded SHIELD_MS (blows glance) and a Flame Nova comes with the roar; phase three\'s Hellfire lays a second, scattered volley (mutants: a phase threshold off; no shield; the nova not begun)', () => {
  const f = fightOf([10, 10, 10]);
  const bodies = [body('s1', 0, 3), body('s2', 5, 5), body('s3', -6, 2)];
  f.nextAt = T0;
  f.hp = f.max * (PHASE_AT[0] + 0.001);
  assert.ok(!stepBrain(f, T0 + 100, bodies, seeded(1)).some((o) => o.k === 'ph'), 'above the line');
  f.atk = null;
  f.hp = f.max * PHASE_AT[0];
  const out = stepBrain(f, T0 + 5000, bodies, seeded(1));
  assert.deepEqual(out.find((o) => o.k === 'ph'), { k: 'ph', n: 2, until: T0 + 5000 + SHIELD_MS });
  assert.equal(out.find((o) => o.k === 'atk').a, ATTACKS.nova.id, 'a nova with the roar');
  assert.equal(applyHit(f, 's1', 10, 0, { x: 0, z: 3 }, T0 + 5000 + SHIELD_MS - 1), 0, 'blows glance');
  assert.ok(applyHit(f, 's1', 10, 0, { x: 0, z: 3 }, T0 + 5000 + SHIELD_MS) > 0, 'and land again');
  f.atk = null; f.hp = f.max * PHASE_AT[1];
  stepBrain(f, T0 + 20000, bodies, seeded(1));
  assert.equal(f.phase, 3);
  // phase three's Hellfire over three living players: five points at most a volley, two volleys
  const g = fightOf([10, 10, 10]);
  g.phase = 3; g.nextAt = T0; g.lastA = -1;
  let hell = null;
  for (let s = 1; s < 200 && !hell; s++) {
    const h = fightOf([10, 10, 10]); h.phase = 3; h.nextAt = T0;
    const a = stepBrain(h, T0 + 1, [body('s1', 0, 30 - 10), body('s2', 12, 12), body('s3', -12, 10)], seeded(s)).find((o) => o.k === 'atk');
    if (a?.a === ATTACKS.hellfire.id) hell = a;
  }
  assert.ok(hell, 'a Hellfire among the draws');
  assert.equal(hell.tg.length, 6, 'three feet, twice');
  for (const p of hell.tg) assert.ok(Math.hypot(p[0], p[1]) <= COURT_R + 1e-9, 'every disc on the floor');
});

test('WB3 brain: the Charge runs its lane over its active span AFTER the wind-up and ends at the lane\'s end; the wrath lands on the gate\'s midnight - begun its wind-up before - and ends the fight (mutants: the dash during the wind-up; the wrath begun at midnight)', () => {
  const f = fightOf([10]);
  f.nextAt = T0;
  const c = stepBrain(f, T0 + 1, [body('s1', 12, 0)], seeded(4)).find((o) => o.k === 'atk');
  assert.equal(c.a, ATTACKS.charge.id);
  stepBrain(f, c.at - 1, [body('s1', 12, 0)], seeded(4));
  assert.deepEqual(f.pos, [0, 0], 'still through the wind-up');
  stepBrain(f, c.at + ATTACKS.charge.active / 2, [body('s1', 12, 0)], seeded(4));
  assert.ok(Math.abs(f.pos[0] - BOSS_REACH_R / 2) < 1e-6, `half way at half the run: ${f.pos}`);
  stepBrain(f, c.at + ATTACKS.charge.active + ATTACKS.charge.recover + 1, [body('s1', 12, 0)], seeded(4));
  assert.deepEqual(f.pos.map((v) => Math.round(v * 1e6) / 1e6), [BOSS_REACH_R, 0]);
  const w = fightOf([10]);
  const quiet = stepBrain(w, WRATH - ATTACKS.wrath.windup - 1, [], seeded());
  assert.ok(!quiet.some((o) => o.k === 'atk' && o.a === ATTACKS.wrath.id));
  const begun = stepBrain(w, WRATH - ATTACKS.wrath.windup, [], seeded()).find((o) => o.k === 'atk');
  assert.equal(begun.a, ATTACKS.wrath.id);
  assert.equal(begun.at, WRATH, 'it lands on the midnight the gate collapses at');
  assert.deepEqual(stepBrain(w, WRATH - 1, [], seeded()), []);
  assert.deepEqual(stepBrain(w, WRATH, [], seeded()), [{ k: 'wrath', at: WRATH }]);
  assert.deepEqual(w.wrath, { at: WRATH });
  assert.equal(applyHit(w, 's1', 10, 0, { x: 0, z: 2 }, WRATH + 1), 0, 'nothing lands after it');
  const late = fightOf([10]);
  const b = stepBrain(late, WRATH - 10, [], seeded()).find((o) => o.k === 'atk');
  assert.equal(b.at, WRATH - 10 + 1000, 'a room woken late gives a second\'s warning at least');
});

test('WB3 brain: targets - THREAT_PICK of the choices go to the living player who dealt most lately, the rest to any living one; the dead are never targets, and a kept target is dropped the beat it dies (mutants: the threat pick removed; a dead body picked)', () => {
  const f = fightOf([10, 10, 10]);
  f.threat = { s2: 500, s3: 10 };
  const bodies = [body('s1', 0, 5), body('s2', 5, 0), body('s3', -5, 0)];
  const rng = seeded(11);
  let top = 0;
  for (let i = 0; i < 4000; i++) if (pickTarget(f, bodies, rng).sub === 's2') top++;
  const want = THREAT_PICK + (1 - THREAT_PICK) / 3;
  assert.ok(Math.abs(top / 4000 - want) < 0.03, `the threat's share: ${top / 4000} vs ${want}`);
  assert.equal(pickTarget(f, [body('s2', 5, 0, true), body('s1', 0, 5)], seeded(2)).sub, 's1', 'the dead are not targets');
  assert.equal(pickTarget(f, [body('s2', 5, 0, true)], seeded(2)), null);
  const g = fightOf([10, 10]);
  g.nextAt = T0; g.target = 's1'; g.targetAt = T0;
  stepBrain(g, T0 + 1, [body('s1', 0, 9, true), body('s2', 9, 0)], seeded(3));
  assert.equal(g.target, 's2', 'a target that died is dropped at once');
  assert.ok(TARGET_HOLD_MS > STATE_SEND_MS / 2);
});

test('WB3 brain: who earned it - dealt RECEIPT_SHARE of the health their own claim brought, or stood alive in the court STOOD_SHARE of the fight; nobody before the fall; standing is credited only to the living, and a beat after a long sleep credits at most a second (mutants: the share of the boss\'s whole health; the dead standing; the sleep credited whole)', () => {
  const f = fightOf([10, 30, 10]);
  assert.equal(earned(f, 's1'), false, 'no receipt before the fall');
  const near = { x: 0, z: 2 };
  let t = T0;
  while (f.players.s1.dealt < RECEIPT_SHARE * f.players.s1.share) { t += 300; applyHit(f, 's1', 40, 0, near, t); }
  for (let i = 0; i < 40; i++) stepBrain(f, T0 + i * 250, [body('s3', 0, 20), body('s2', 3, 3, true)], seeded(i));
  const stood = f.players.s3.stoodMs;
  assert.equal(f.players.s2.stoodMs, 0, 'the dead stand nothing');
  f.fell = { at: T0 + Math.ceil(stood / STOOD_SHARE), top: [], n: 3 };
  assert.equal(earned(f, 's1'), true); assert.equal(earnedBy(f, 's1'), 'dealt');
  assert.equal(earned(f, 's3'), true, 'stood half the fight'); assert.equal(earnedBy(f, 's3'), 'stood');
  assert.equal(earned(f, 's2'), false);
  f.fell = { at: T0 + Math.ceil(stood / STOOD_SHARE) + 1000, top: [], n: 3 };
  assert.equal(earned(f, 's3'), false, 'a moment less than half');
  const g = fightOf([10]);
  stepBrain(g, T0 + 600_000, [body('s1', 0, 20)], seeded());
  assert.equal(g.players.s1.stoodMs, 1000, 'ten minutes asleep stand one second');
});

test('WB3 brain: the checkpoint - the fight is plain numbers and strings, so the state that went to storage steps exactly as the one that did not; the `st` frame says every field a joiner needs (mutants: a field the state frame drops)', () => {
  const f = fightOf([10, 20]);
  const bodies = [body('s1', 0, 6), body('s2', 8, -3)];
  for (let t = T0; t < T0 + 20000; t += 250) stepBrain(f, t, bodies, seeded(t));
  const copy = JSON.parse(JSON.stringify(f));
  assert.deepEqual(copy, f);
  for (let t = T0 + 20000; t < T0 + 40000; t += 250) assert.deepEqual(stepBrain(copy, t, bodies, seeded(t)), stepBrain(f, t, bodies, seeded(t)));
  const st = stateOf(f);
  assert.deepEqual(Object.keys(st).sort(), ['atk', 'b', 'd', 'fell', 'h', 'k', 'm', 'mv', 'n', 'ph', 'sh', 'wr', 'wrath', 'x', 'yw', 'z']);
  assert.deepEqual(validGateOut(st), { ...st }, 'and the wire takes it whole');
  assert.ok(keepInCourt(100, 0)[0] === BOSS_REACH_R);
  assert.equal(HP_SEND_MS, BRAIN_TICK_MS, 'the health at most once a beat');
  assert.ok(CHECKPOINT_MS >= BRAIN_TICK_MS * 4);
  assert.deepEqual(COURT_CENTRE, [25.6, 0, 25.6]);
});

// ═══ THE RECEIPT ═════════════════════════════════════════════════════════════════════════════════════════════════

async function keypair() { return subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']); }
const WHAT = { d: 200, b: 'ruhn', s: 'acct-peer-0001', c: 0xdeadbeef, x: 'dealt' };

test('WB3 receipt: minted by the relay, verified by its public half - the day, the boss, the account, the seed and how it was earned, a week to carry it; every rung of the identity token\'s ladder refuses as it does (mutants: the signature over the wrong bytes; an expired receipt honoured; the version read after the signature)', async () => {
  const kp = await keypair();
  const nowS = 1_800_000_000;
  const r = await mintReceipt(WHAT, kp.privateKey, { subtle, nowS });
  assert.ok(r.startsWith(`${RECEIPT_V}.`) && r.length <= RECEIPT_MAX);
  const ok = await verifyReceipt(r, kp.publicKey, { subtle, nowS: nowS + 60 });
  assert.deepEqual(ok, { ok: true, claims: { ...WHAT, i: nowS, e: nowS + RECEIPT_TTL_S } });
  const why = async (x, opts = {}) => (await verifyReceipt(x, opts.key ?? kp.publicKey, { subtle, nowS: opts.nowS ?? nowS + 60 })).why;
  const [v, b, sig] = r.split('.');
  assert.equal(await why(`v1.${b}.${sig}`), 'version');
  assert.equal(await why(`${v}.${b}`), 'shape');
  assert.equal(await why('x'.repeat(RECEIPT_MAX + 1)), 'shape');
  assert.equal(await why(`${v}.${b}.AAAA`), 'sig-shape');
  assert.equal(await why(r, { key: (await keypair()).publicKey }), 'signature', 'another key');
  const forged = _b64url.encode(new TextEncoder().encode(JSON.stringify({ ...WHAT, c: 1, i: nowS, e: nowS + RECEIPT_TTL_S })));
  assert.equal(await why(`${v}.${forged}.${sig}`), 'signature', 'a seed swapped under the signature');
  assert.equal(await why(r, { nowS: nowS + RECEIPT_TTL_S }), 'expired');
  assert.equal(await why(r, { nowS: nowS - 3600 }), 'future');
  await assert.rejects(mintReceipt({ ...WHAT, x: 'watched' }, kp.privateKey, { subtle, nowS }), /refused/);
  await assert.rejects(mintReceipt({ ...WHAT, s: 'x' }, kp.privateKey, { subtle, nowS }), /refused/);
});

test('WB3 receipt: UNSIGNED is a real answer - a relay with no key mints `r1.<body>.`, the client reads its seed the same, and the account service declines it; a receipt is never an identity and an identity is never a receipt, whichever verifier is asked (mutants: an unsigned receipt verified; the claim shapes overlapping)', async () => {
  const nowS = 1_800_000_000;
  const bare = await mintReceipt(WHAT, null, { subtle, nowS });
  assert.ok(bare.endsWith('.'));
  assert.deepEqual(readReceipt(bare), { ...WHAT, i: nowS, e: nowS + RECEIPT_TTL_S, signed: false });
  const kp = await keypair();
  assert.equal((await verifyReceipt(bare, kp.publicKey, { subtle, nowS })).why, 'unsigned');
  const signed = await mintReceipt(WHAT, kp.privateKey, { subtle, nowS });
  assert.equal(readReceipt(signed).signed, true);
  assert.equal(readReceipt('r1.@@@.'), null);
  assert.equal(readReceipt(42), null);
  const tok = await mintToken({ s: 'acct-peer-0001', n: 'Peer', k: 'guest' }, kp.privateKey, { subtle, nowS });
  assert.equal((await verifyReceipt(tok, kp.publicKey, { subtle, nowS })).why, 'version', 'an identity, one key signing both');
  assert.equal((await verifyToken(signed, kp.publicKey, { subtle, nowS })).why, 'version', 'a receipt at the relay\'s door');
  for (const extra of [{ n: 'Peer' }, { k: 'guest' }, { o: 'mute' }]) assert.equal(receiptValid({ ...WHAT, i: nowS, e: nowS + 10, ...extra }), false, JSON.stringify(extra));
  assert.equal(receiptValid({ ...WHAT, i: nowS, e: nowS + RECEIPT_TTL_S + 1 }), false, 'a week at most');
  assert.equal(RECEIPT_MAX, GATE_RECEIPT_MAX, 'the wire\'s bound is the law\'s');
  assert.ok(validGateOut({ k: 'rcpt', r: signed }) && validGateOut({ k: 'rcpt', r: bare }), 'the wire carries both');
});

test('WB3 receipt: the relay\'s key from its secret - PKCS8 in base64 (the account service\'s shape), imported sign-only and never extractable; nothing, or anything else, is no key rather than a throw (mutants: an extractable key; a throw on a bad secret)', async () => {
  const kp = await keypair();
  const pkcs8 = Buffer.from(await subtle.exportKey('pkcs8', kp.privateKey)).toString('base64');
  const key = await importReceiptKey(pkcs8, { subtle });
  assert.ok(key);
  assert.equal(key.extractable, false);
  assert.deepEqual(key.usages, ['sign']);
  const r = await mintReceipt(WHAT, key, { subtle, nowS: 1_800_000_000 });
  assert.equal((await verifyReceipt(r, kp.publicKey, { subtle, nowS: 1_800_000_000 })).ok, true);
  for (const bad of [undefined, '', 'not base64!', Buffer.from('nope').toString('base64')]) assert.equal(await importReceiptKey(bad, { subtle }), null);
});

// ═══ THE WIRE ════════════════════════════════════════════════════════════════════════════════════════════════════

test('WB3 wire: the client says two things - `in` with a level claim, `hit` with a sequence, a damage and a kind - projected field by field, after a hello alone; the room says its closed list of kinds, each bounded; the first relay that runs a boss room is GATE_RELAY_MIN (mutants: an extra field carried; a damage past the wire\'s bound; a refusal word invented)', () => {
  assert.deepEqual(GATE_KINDS, ['in', 'hit']);
  assert.deepEqual(GATE_OUT_KINDS, ['st', 'mv', 'atk', 'hp', 'ph', 'wrath', 'fell', 'rcpt', 'no']);
  assert.deepEqual(validGateIn({ k: 'in', lv: 12, x: 1 }), { k: 'in', lv: 12 });
  assert.deepEqual(validGateIn({ k: 'hit', q: 3, d: 12.5, r: 2, extra: true }), { k: 'hit', q: 3, d: 12.5, r: 2 });
  for (const bad of [{ k: 'in' }, { k: 'in', lv: 0 }, { k: 'in', lv: GATE_LV_WIRE_MAX + 1 }, { k: 'in', lv: 1.5 }, { k: 'hit', q: -1, d: 1, r: 0 }, { k: 'hit', q: 1, d: 0, r: 0 },
    { k: 'hit', q: 1, d: GATE_DMG_WIRE_MAX + 1, r: 0 }, { k: 'hit', q: 1, d: NaN, r: 0 }, { k: 'hit', q: 1, d: 1, r: 3 }, { k: 'fell' }, null]) assert.equal(validGateIn(bad), null, JSON.stringify(bad));
  assert.deepEqual(parseClient(JSON.stringify({ t: 'gate', k: 'in', lv: 5 }), { hasHello: true }), { t: 'gate', k: 'in', lv: 5 });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'gate', k: 'in', lv: 5 })), { error: 'gate before hello' });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'gate', k: 'boo' }), { hasHello: true }), { error: 'bad gate' });
  assert.deepEqual(validGateOut({ k: 'no', m: 'the gate is sealed' }), { k: 'no', m: 'the gate is sealed' });
  assert.equal(validGateOut({ k: 'no', m: 'go away' }), null);
  for (const m of GATE_NO_WORDS) assert.ok(validGateOut({ k: 'no', m }));
  assert.deepEqual(validGateOut({ k: 'hp', h: 5, m: 10, z: 1 }), { k: 'hp', h: 5, m: 10 });
  assert.equal(validGateOut({ k: 'hp', h: 11, m: 10 }), null, 'health past its maximum');
  assert.deepEqual(validGateOut({ k: 'atk', i: 1, a: 3, at: 5000, x: 0, z: 0, yw: 0, tg: [[1, 2]] }).tg, [[1, 2]]);
  assert.equal(validGateOut({ k: 'atk', i: 1, a: 3, at: 5000, x: 0, z: 0, yw: 0, tg: Array.from({ length: 11 }, () => [0, 0]) }), null);
  assert.equal(validGateOut({ k: 'mv', x: 0, z: 0, tx: 99, tz: 0, v: 3.2, at: 5 }), null, 'off the court');
  assert.deepEqual(validGateOut({ k: 'fell', at: 9, top: ['A', 'B', 'C', 'D'], n: 4, d: 3 }), { k: 'fell', at: 9, top: ['A', 'B', 'C'], n: 4, d: 3 });
  assert.equal(validGateOut({ k: 'rcpt', r: 'v1.abc.def' }), null);
  assert.equal(relaySupportsGate('world109'), false);
  assert.equal(relaySupportsGate('world112'), false, 'main\'s PARTY-TRAVEL, the last relay without a fight (WB3 was world110 on its branch)');
  assert.equal(relaySupportsGate(`world${GATE_RELAY_MIN}`), true);
  assert.ok(relayVersionAtLeast(GATE_RELAY_MIN), 'the relay this tree builds runs it');
  assert.equal(RELAY_VERSION === 'world109', false);
  let b = null; let pass = 0;
  for (let i = 0; i < GATE_HZ_MAX * 2; i++) { const g = gateGate(b, 1000); b = g.bucket; if (g.pass) pass++; }
  assert.equal(pass, GATE_HZ_MAX, 'the bucket\'s depth');
  assert.ok(GATE_HZ_MAX >= GATE_HIT_HZ_MAX + 2, 'the meter never refuses a blow the brain would take');
});

// ═══ THE RELAY ═══════════════════════════════════════════════════════════════════════════════════════════════════

const DAY = 200;
const TT = gateTimes(DAY);
const KEY = gateRoomKey(DAY);
const at = (x, z, extra = {}) => ({ x: COURT_CENTRE[0] + x, y: 0, z: COURT_CENTRE[2] + z, yaw: 0, pitch: 0, ...extra });
const gates = (ws, k) => ws.sent.filter((m) => m.t === 'gate' && (!k || m.k === k));
async function withGate(fn, { start = TT.openAt + 1000 } = {}) {
  const realNow = Date.now; let clock = start; Date.now = () => clock;
  const world = fakeRooms({ now: () => clock });
  const r = world.room(KEY);
  const tick = async (n = 1) => { for (let i = 0; i < n; i++) { clock += BRAIN_TICK_MS; if (r.alarm.at != null && clock >= r.alarm.at) await r.fire(); } };
  const say = (ws, o) => r.raw(ws, JSON.stringify({ t: 'gate', ...o }));
  try { await fn({ world, r, tick, say, now: () => clock, set: (t) => { clock = t; } }); } finally { Date.now = realNow; }
}
const upgrade = (path) => new Request(`https://relay.test${path}`, { headers: { Upgrade: 'websocket' } });

test('WB3 relay: THE WINDOW - the Worker mints no object for a gate the clock did not raise (before it opens, after its wrath\'s end, a key the clock would not mint); the hello admits a newcomer while it is open, a fighter until the wrath\'s end, and refuses the rest in words (mutants: the Worker\'s check removed; the hello\'s newcomer check removed; a fighter refused after the seal)', async () => {
  const realNow = Date.now;
  let minted = 0;
  const env = { ROOMS: { idFromName: () => { minted++; return 'id'; }, get: () => ({ fetch: async () => new Response('ok') }) } };
  try {
    Date.now = () => TT.openAt - 1;
    assert.equal((await worker.fetch(upgrade(`/room/${KEY}`), env)).status, 404, 'before the opening');
    Date.now = () => TT.openAt;
    assert.equal((await worker.fetch(upgrade(`/room/${KEY}`), env)).status, 200);
    assert.equal((await worker.fetch(upgrade(`/room/gate:0${DAY}`), env)).status, 404, 'a key the clock does not mint');
    Date.now = () => TT.wrathAt + GATE_COLLAPSE_MS - 1;
    assert.equal((await worker.fetch(upgrade(`/room/${KEY}`), env)).status, 200, 'a fighter may still come back');
    Date.now = () => TT.wrathAt + GATE_COLLAPSE_MS;
    assert.equal((await worker.fetch(upgrade(`/room/${KEY}`), env)).status, 404, 'after the wrath\'s end');
    assert.equal(minted, 2, 'no object minted for any refusal');
  } finally { Date.now = realNow; }
  await withGate(async ({ r, say, set }) => {
    const a = r.connect(); await r.hello(a, 'peer-0001', at(0, 20));
    assert.equal(a.sent[0].t, 'welcome');
    await say(a, { k: 'in', lv: 10 });
    set(TT.sealAt);
    const late = r.connect(); await r.hello(late, 'peer-0002', at(0, 20));
    assert.deepEqual(late.sent, [{ t: 'error', m: 'the gate is sealed' }]);
    assert.ok(late.closed);
    // (a reconnect ten minutes on names itself afresh in its token - the harness's signer walks one identity's
    // issued-at DOWN, which a clock that moved past MAX_TTL_S would outrun; the account is the same)
    const back = r.connect(); await r.hello(back, 'peer-0001', at(0, 20), { name: 'peer-0001b' });
    assert.equal(back.sent[0].t, 'welcome', 'a fighter comes back after the seal');
    set(TT.wrathAt + GATE_COLLAPSE_MS);
    const gone = r.connect(); await r.hello(gone, 'peer-0001', at(0, 20), { name: 'peer-0001c' });
    assert.deepEqual(gone.sent, [{ t: 'error', m: 'the gate is closed' }], 'the object\'s own word past the end');
  });
});

test('WB3 relay: THE JOIN - `in` answers the whole state to the one who said it, credits the VERIFIED account (the token\'s sub, not the frame), keeps the first claim, and arms the beat; the beat fans the brain\'s words to everyone in the court (mutants: the state fanned to all; the frame\'s name credited; the beat never armed)', async () => {
  await withGate(async ({ r, tick, say, now }) => {
    const a = r.connect(), b = r.connect();
    await r.hello(a, 'peer-0001', at(0, 4)); await r.hello(b, 'peer-0002', at(3, 4));
    await say(a, { k: 'in', lv: 10 });
    const st = gates(a, 'st')[0];
    assert.equal(st.d, DAY); assert.equal(st.b, gateBossOf(DAY).id); assert.equal(st.n, 1); assert.equal(st.m, BOSS_TTK_S * dpsRef(10));
    assert.equal(gates(b).length, 0, 'the state went to its asker alone');
    assert.equal(r.alarm.at, now() + BRAIN_TICK_MS);
    assert.ok(r.room._fight.players['acct-peer-0001'], 'the fight knows the account the token verified');
    await say(b, { k: 'in', lv: 30 });
    await say(b, { k: 'in', lv: 60 });
    assert.equal(r.room._fight.players['acct-peer-0002'].lv, 30, 'a second `in` keeps the first claim');
    await tick(Math.ceil(OPENING_MS / BRAIN_TICK_MS) + 2);
    const atkA = gates(a, 'atk'), atkB = gates(b, 'atk');
    assert.ok(atkA.length >= 1, 'he acted');
    assert.deepEqual(atkA, atkB, 'and everyone in the court heard the same word');
    assert.equal(r.alarm.at, now() + BRAIN_TICK_MS, 'the beat goes on while the fight lives');
  });
});

test('WB3 relay: A BLOW - believed as far as the brain allows from where the socket\'s own pose stands: from off the court, from a dead pose or before `in` it lands nothing (a blow before `in` is junk); the health goes out on the next beat; a gate frame outside a gate room is junk, and a flood of them is struck out (mutants: the frame trusted for where it stood; the dead striking; the meter removed)', async () => {
  await withGate(async ({ r, tick, say }) => {
    const a = r.connect(); await r.hello(a, 'peer-0001', at(0, 3));
    await say(a, { k: 'hit', q: 1, d: 10, r: 0 });
    assert.equal(a.meters.junk, 1, 'a blow before `in`');
    await say(a, { k: 'in', lv: 10 });
    const f = r.room._fight, full = f.hp;
    await r.pose(a, at(0, COURT_R + POSE_SLACK + 1));
    await say(a, { k: 'hit', q: 2, d: 10, r: HIT_KINDS.Shaft });
    assert.equal(f.hp, full, 'from off the court');
    await r.pose(a, at(0, 3, { dd: 1 }));
    await say(a, { k: 'hit', q: 3, d: 10, r: 0 });
    assert.equal(f.hp, full, 'from the dead');
    await r.pose(a, at(0, 3));
    await say(a, { k: 'hit', q: 4, d: 10, r: 0 });
    assert.equal(f.hp, full - 10);
    await tick(1);
    assert.deepEqual(gates(a, 'hp').at(-1), { t: 'gate', k: 'hp', h: full - 10, m: f.max });
    // a flood of frames that are not junk - the meter's own strikes close it
    for (let i = 0; i < GATE_HZ_MAX + DROP_STRIKES_MAX + 2; i++) await say(a, { k: 'in', lv: 10 });
    assert.ok(a.closed, 'a flood of `in` is struck out by the gate meter');
  });
  await withGate(async ({ world }) => {
    const place = world.room('dungeon:m123456');
    const x = place.connect(); await place.hello(x, 'peer-0003', { x: 1, y: 0, z: 1, yaw: 0, pitch: 0 });
    await place.raw(x, JSON.stringify({ t: 'gate', k: 'in', lv: 5 }));
    assert.equal(x.meters.junk, 1, 'no boss room here');
    for (let i = 0; i < GATE_HZ_MAX + DROP_STRIKES_MAX + 2; i++) await place.raw(x, JSON.stringify({ t: 'gate', k: 'in', lv: 5 }));
    assert.ok(x.closed, 'a flood is struck out');
  });
});

test('WB3 relay: THE KILL - said once to everyone in the court, a receipt to exactly the accounts that earned one (signed by GATE_SIGNING_KEY, which its public half verifies), the fight checkpointed with them, and the hub\'s world line: everyone online hears the fall, a fighter outside the court is handed their receipt there, a later hello hears it while the gate still holds (mutants: a receipt to one who did not earn it; the hub told nothing; the fall said twice)', async () => {
  const kp = await keypair();
  const pkcs8 = Buffer.from(await subtle.exportKey('pkcs8', kp.privateKey)).toString('base64');
  await withGate(async ({ world, r, tick, say, now }) => {
    r.env.GATE_SIGNING_KEY = pkcs8;
    const hub = world.room(SOCIAL_ROOM);
    const h1 = hub.connect(), h3 = hub.connect(), h9 = hub.connect();
    await hub.hello(h1, 'peer-0001'); await hub.hello(h3, 'peer-0003'); await hub.hello(h9, 'peer-0009');
    const a = r.connect(), c = r.connect();
    await r.hello(a, 'peer-0001', at(0, 3)); await r.hello(c, 'peer-0003', at(3, 3));
    for (const ws of [a, c]) await say(ws, { k: 'in', lv: 10 });
    // peer-0003 deals its share and leaves the court (cast out, say); peer-0002 walks in at the very end and does nothing
    // (a moment's standing is not half the fight); peer-0001 finishes him
    const f = r.room._fight;
    for (let i = 0; i < 40; i++) { await say(c, { k: 'hit', q: i, d: 40, r: HIT_KINDS.Spell }); await tick(2); }   // spells: wherever his charges take him
    await r.drop(c);
    const idle = r.connect(); await r.hello(idle, 'peer-0002', at(0, 20)); await say(idle, { k: 'in', lv: 10 });
    await tick(1);
    f.hp = 5;
    await say(a, { k: 'hit', q: 99, d: 40, r: HIT_KINDS.Spell });
    const fell = gates(a, 'fell');
    assert.equal(fell.length, 1);
    assert.deepEqual(gates(idle, 'fell'), fell, 'everyone in the court');
    assert.equal(fell[0].at, now());
    const mine = gates(a, 'rcpt');
    assert.equal(mine.length, 1);
    assert.equal(gates(idle, 'rcpt').length, 0, 'the idle account earned nothing');
    const ok = await verifyReceipt(mine[0].r, kp.publicKey, { subtle, nowS: Math.floor(now() / 1000) });
    assert.equal(ok.ok, true);
    assert.equal(ok.claims.s, 'acct-peer-0001'); assert.equal(ok.claims.d, DAY);
    assert.equal(ok.claims.x, 'stood', 'the finishing blow was five points - peer-0001 earned it by standing the fight');
    assert.equal(readReceipt(f.rc['acct-peer-0003']).x, 'dealt', 'and peer-0003 by what it dealt');
    assert.deepEqual(Object.keys(f.rc).sort(), ['acct-peer-0001', 'acct-peer-0003']);
    assert.equal(r.store.get('gatefight').said, true, 'checkpointed with the kill');
    // the hub
    const hubFell = gates(h9, 'fell');
    assert.deepEqual(hubFell, [{ t: 'gate', k: 'fell', at: fell[0].at, top: fell[0].top, n: 3, d: DAY }], 'everyone online, the day with it');
    assert.equal(gates(h9, 'rcpt').length, 0);
    assert.deepEqual(gates(h3, 'rcpt').map((m) => m.r), [f.rc['acct-peer-0003']], 'the fighter outside the court is handed theirs');
    assert.equal(gates(h1, 'rcpt').length, 1);
    await tick(4);
    assert.equal(gates(a, 'fell').length, 1, 'said once');
    const later = hub.connect(); await hub.hello(later, 'peer-0007');
    assert.deepEqual(gates(later, 'fell'), hubFell, 'a hello while the gate still holds hears it');
    // a fighter back in the court after the kill is handed theirs again
    const back = r.connect(); await r.hello(back, 'peer-0003', at(0, 10));
    await say(back, { k: 'in', lv: 10 });
    assert.deepEqual(gates(back, 'rcpt').map((m) => m.r), [f.rc['acct-peer-0003']]);
    const stranger = r.connect(); await r.hello(stranger, 'peer-0008', at(0, 10));
    assert.deepEqual(stranger.sent, [{ t: 'error', m: 'the gate is closing' }]);
  });
});

test('WB3 relay: NO KEY - the fight and its receipts run the same, unsigned (the client still rolls its spoils); A WAKE resumes the fight from its checkpoint; THE DAY\'S END forgets it and the beat stops (mutants: no receipt without a key; the wake starting a fresh fight; the storage kept for ever)', async () => {
  await withGate(async ({ r, tick, say, set }) => {
    const a = r.connect(); await r.hello(a, 'peer-0001', at(0, 3));
    await say(a, { k: 'in', lv: 10 });
    await tick(20);
    const hp = r.room._fight.hp - 10;
    await say(a, { k: 'hit', q: 1, d: 10, r: 0 });
    await tick(Math.ceil(CHECKPOINT_MS / BRAIN_TICK_MS) + 1);
    r.wake();
    assert.equal(r.room._fight, undefined, 'a woken object has read nothing');
    await tick(1);
    assert.equal(r.room._fight.hp, hp, 'the fight resumed from storage');
    r.room._fight.hp = 1;
    await say(a, { k: 'hit', q: 2, d: 10, r: 0 });
    const rc = gates(a, 'rcpt')[0];
    assert.ok(rc && rc.r.endsWith('.'), 'unsigned');
    assert.equal(readReceipt(rc.r).s, 'acct-peer-0001');
    set(TT.wrathAt + GATE_COLLAPSE_MS);
    await r.fire();
    assert.equal(r.store.has('gatefight'), false, 'the day is over and so is its fight');
    assert.equal(r.room._fight, null);
  });
  await withGate(async ({ r, tick, say, now }) => {
    const a = r.connect(); await r.hello(a, 'peer-0001', at(0, 3));
    await say(a, { k: 'in', lv: 10 });
    await r.drop(a);
    await tick(1);
    assert.equal(r.alarm.at, TT.wrathAt + GATE_COLLAPSE_MS, 'nobody in the court: the beat sleeps until the day\'s end');
    const b = r.connect(); await r.hello(b, 'peer-0001', at(0, 3));
    await say(b, { k: 'in', lv: 10 });
    assert.equal(r.alarm.at, now() + BRAIN_TICK_MS, 'and an `in` wakes it');
  });
});

// ═══ THE SESSION ═════════════════════════════════════════════════════════════════════════════════════════════════

const quiet = (fn) => { const info = console.info, warn = console.warn; console.info = () => {}; console.warn = () => {}; try { return fn(); } finally { console.info = info; console.warn = warn; } };
function gateRig(room, relayV = RELAY_VERSION) {
  const { FakeWS, sockets } = fakeSocketClass();
  let t = 1000;
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'a', id: 'aaaa-0001', secret: 'secret-of-aaaa-0001', WebSocketImpl: FakeWS, now: () => t });
  const got = []; s.onGate = (g, r) => got.push({ g, r });
  quiet(() => s.join(room, { x: 25.6, y: 0, z: 45, yaw: 0 }));
  const ws = sockets[0]; ws.open();
  quiet(() => ws.receive({ t: 'welcome', id: 'aaaa-0001', peers: [], host: 'aaaa-0001', world: null, v: relayV }));
  const out = () => ws.sent.map((x) => JSON.parse(x)).filter((x) => x.t === 'gate');
  return { s, ws, got, out, tick: (ms) => { t += ms; } };
}

test('WB3 session: a gate frame goes only to a relay that runs a boss room, only from a gate room, through the wire\'s projection, GATE_HZ_MAX a second; the room\'s word comes in projected and is handed to the arena, junk dropped (mutants: the version door dropped; a gate frame sent from a cell; the inbound projection skipped)', () => {
  const old = gateRig(KEY, 'world109');
  assert.equal(old.s.gateOk, false);
  assert.equal(old.s.sendGate({ k: 'in', lv: 10 }), false);
  assert.equal(old.out().length, 0, 'nothing on the wire of a relay that would close the socket for it');
  const cell = gateRig('world:3,12');
  assert.equal(cell.s.sendGate({ k: 'in', lv: 10 }), false, 'no boss stands in a cell');
  const { s, ws, got, out, tick } = gateRig(KEY);
  assert.equal(s.gateOk, true);
  assert.equal(s.sendGate({ k: 'in', lv: 10, name: 'Mac' }), true);
  assert.deepEqual(out().at(-1), { t: 'gate', k: 'in', lv: 10 }, 'the projection, not the caller\'s object');
  assert.equal(s.sendGate({ k: 'hit', q: 1, d: -5, r: 0 }), false, 'the wire\'s own law first');
  for (let i = 1; i < GATE_HZ_MAX; i++) assert.equal(s.sendGate({ k: 'hit', q: i, d: 5, r: 0 }), true);
  assert.equal(s.sendGate({ k: 'hit', q: 99, d: 5, r: 0 }), false, 'GATE_HZ_MAX a second');
  tick(1000);
  assert.equal(s.sendGate({ k: 'hit', q: 100, d: 5, r: 0 }), true);
  ws.receive({ t: 'gate', k: 'hp', h: 50, m: 100, junk: 1 });
  ws.receive({ t: 'gate', k: 'hp', h: 500, m: 100 });
  ws.receive({ t: 'gate', k: 'dance' });
  assert.deepEqual(got, [{ g: { k: 'hp', h: 50, m: 100 }, r: KEY }]);
  const hub = gateRig(SOCIAL_ROOM);
  hub.ws.receive({ t: 'gate', k: 'fell', at: 5, top: ['Mac'], n: 2, d: DAY });
  assert.deepEqual(hub.got, [{ g: { k: 'fell', at: 5, top: ['Mac'], n: 2, d: DAY }, r: SOCIAL_ROOM }], 'the hub\'s word of a kill');
});
