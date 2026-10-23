// WB14a (2026-10-19, Mac: "More diabolical boss movesets", then "This is all yours to take on"): THE WARDEN'S NEW
// ARSENAL - six attacks more he chooses, each with a cooldown of its own: Chains of the Warden, Dagon's Brand, Shared
// Torment, the Scything Wheel, the Burning Gaze and the Unmaking.
//
//   the brain            net/gate/gateBrain.js ATTACKS 11-16, attacksFor's `ctx`, begin's marked (`pk`), the Chains' hold
//                        and its Slam, the Unmaking's second cast
//   the strike law       net/gate/gateStrike.js wheelStrikes, inWedges, markedAt, brandOn, tormentShare, chainHolds,
//                        chainPull, gazeHolds, markedVerdict
//   the relay's judge    net/bossRef.js judgeGate - the Wheel down its turn, the Unmaking's wedges; never the Chains, never
//                        the Gaze
//   the wire             net/wire.js gateAtk's `pk` and GATE_ATK_ID_MAX
//   the ground           render/gate/gateTelegraph.js - the chain a path, the rings where they are seen, the blades
//                        turning, the wedges a kind of their own (the shader's and telegraphField's one reading)
//   the screen           scenes/gate/gateArsenal.js - the marked blows and the Gaze judged on my feet and my camera, the
//                        order under the crosshair (ui/gate/gateGroundView.js), the Gaze's white
//
// Design: bible/11-Multiplayer/Breach-Portents.md sections 3, 6 and 10.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ATTACKS, ATTACK_BY_ID, BASE_PROFILE, COURTS, COURT_R, BOSS_R, POSE_SLACK, PHASE3_WINDUP, FAVOURED_PHASE, CHAIN_HOLD_M, CHAIN_PULL_TO_M,
  CHAIN_PULL_MAX_M, GAZE_HALF_DEG, GAZE_RANGE_M, GAZE_BLIND_MS, OPENING_MS, attacksFor, windupOf, stepBrain, newFight, joinFight, fightProfile,
  brandCountFor, screenJudged, atkFrame, TURN_BREATH_MS,
} from '../../../src/net/gate/gateBrain.js';
import {
  wheelSpin, wheelAngle, wheelBlades, wheelStrikes, inWedges, inAttack, strikeVerdict, markedOf, markedAt, markedMe, chainHolds, chainPull,
  brandOn, tormentShare, gazeHolds, markedVerdict, isMarkedBlow, STRIKE_LATE_MS,
} from '../../../src/net/gate/gateStrike.js';
import { judgeGate } from '../../../src/net/bossRef.js';
import { validGateOut, GATE_ATK_ID_MAX } from '../../../src/net/wire.js';
import { foldGate, GATE_STATE_EMPTY } from '../../../src/net/gate/gateLink.js';
import { telegraphShape, telegraphField, TELEGRAPH_KIND, TELEGRAPH_POOL, TELEGRAPH_FS, TELEGRAPH_CHAIN_HALF_W, TORMENT_COLOR, TELEGRAPH_EDGE_SAFE } from '../../../src/render/gate/gateTelegraph.js';
import { createGateArsenal, arsenalSeams, ARSENAL_TEXT, GAZE_COLOR } from '../../../src/scenes/gate/gateArsenal.js';
import { orderPeril } from '../../../src/scenes/gate/gateCourt.js';
import { groundViewModel, BLIND_PEAK } from '../../../src/ui/gate/gateGroundView.js';
import { BOSS_CUES, ATTACK_COLORS } from '../../../src/world/gate/gateBoss.js';
import { BLOW_PUSH_DECAY } from '../../../src/player/motor.js';

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const T0 = 1_000_000, WRATH = T0 + 3_600_000, RUN = 7.6;
const NEW = ['chains', 'brand', 'torment', 'wheel', 'gaze', 'unmake'];
const seeded = (s) => () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
const body = (sub, x, z, extra = {}) => ({ sub, id: `peer-${sub}`, x, z, dead: false, ...extra });
/** A fight woken, `n` fighters seated, in phase `ph`, ready to choose. */
function fightOf(n, ph = 1) {
  const f = newFight(7, T0, WRATH, 'ruhn');
  for (let i = 0; i < n; i++) joinFight(f, `s${i}`, `F${i}`, 10, T0, true);
  f.phase = ph; f.openUntil = 0; f.nextAt = T0; f.lastTickAt = T0;
  return f;
}
/** The first attack word of a beat. */
const atkOf = (out) => out.find((o) => o.k === 'atk') ?? null;
/** An atk word as the wire carries it, `a` an attack. */
const word = (A, over = {}) => ({ i: 7, a: A.id, at: T0, x: 0, z: 0, yw: 0, tg: [], ...over });

// ═══ THE TABLE ═══════════════════════════════════════════════════════════════════════════════════════════════════════

test('WB14a the arsenal: six attacks more, ids 11 to 16, each a cooldown of its own (none of the eleven before has one) - the Brand asks a court of two, the Torment (AUDIT WB14 PLAY-3) three; the Chains and the Gaze are the struck screen\'s alone (mutants: an id moved; a cooldown dropped; the Gaze counted by the relay; the Torment between two)', () => {
  assert.deepEqual(NEW.map((k) => ATTACKS[k].id), [11, 12, 13, 14, 15, 16]);
  assert.deepEqual(ATTACK_BY_ID.map((a) => a.id), [...Array(19).keys()]);   // PIN MOVED (WB14d): and the Sundering and the Rejoining, 17 and 18
  assert.deepEqual(NEW.map((k) => ATTACKS[k].cd), [22_000, 28_000, 28_000, 30_000, 35_000, 45_000]);
  for (const A of ATTACK_BY_ID) if (!NEW.includes(A.key)) assert.equal(A.cd, undefined, `${A.key} keeps none`);
  assert.deepEqual(NEW.map((k) => ATTACKS[k].nMin ?? 1), [1, 2, 3, 1, 1, 1]);   // AUDIT WB14 (PLAY-3): the Torment three - between two it was half a fighter's health each
  assert.deepEqual(NEW.filter((k) => screenJudged(ATTACKS[k])), ['chains', 'gaze']);
  assert.deepEqual(NEW.map((k) => ATTACKS[k].phase), [1, 2, 2, 3, 3, 3], 'the Warden\'s blade, the Burning Court\'s fire, Dagon\'s Champion\'s');
  assert.deepEqual([FAVOURED_PHASE.brand, FAVOURED_PHASE.torment], [1, 1], 'Dagon\'s Favoured brings the fire\'s own questions a phase early');
  assert.equal(fightProfile(['burning', 'favoured']).atk.brand.phase, 1);
  assert.deepEqual(NEW.map((k) => ATTACKS[k].el), [null, 'fire', 'fire', null, null, null]);
  assert.equal(fightProfile(['rime']).atk.brand.el, 'frost', 'his element\'s, under his aspect');
  assert.equal(GATE_ATK_ID_MAX, 31);
});

test('WB14a every new wind-up outruns its shape at the player\'s 7.6 m/s from its worst spot, phase three\'s a fifth shorter (AUDIT WB14 PLAY-5: never the Chains\') - the chain\'s hold from his feet, the brand\'s and the torment\'s rings, half a blade, a lit wedge\'s middle at its rim - and the Gaze alone answered by turning (mutants: a wind-up shortened past escape; the Chains shortened in phase three)', () => {
  const need = { chains: CHAIN_HOLD_M, brand: ATTACKS.brand.r, torment: ATTACKS.torment.r, wheel: ATTACKS.wheel.width / 2, unmake: COURT_R * Math.sin(Math.PI / ATTACKS.unmake.n) };
  for (const [k, m] of Object.entries(need)) {
    assert.equal(windupOf(ATTACKS[k], 3), k === 'chains' ? ATTACKS.chains.windup : Math.round(ATTACKS[k].windup * PHASE3_WINDUP));
    assert.ok((windupOf(ATTACKS[k], 3) / 1000) * RUN >= m, `${k}: ${m.toFixed(1)} m in ${windupOf(ATTACKS[k], 3)} ms`);
  }
  // AUDIT WB14 (PLAY-5): the Chains begun at a fighter at the rim behind him at the rune ring need 17.45 m - with a
  // reaction's 400 ms in phase three too
  assert.ok(((windupOf(ATTACKS.chains, 3) - 400) / 1000) * RUN >= 17.45);
  // the Wheel's tips under a run: a fighter ahead of a blade keeps ahead of it
  assert.ok(ATTACKS.wheel.spin * ATTACKS.wheel.len < RUN, `${(ATTACKS.wheel.spin * ATTACKS.wheel.len).toFixed(2)} m/s at its tips`);
  assert.ok(Math.abs(ATTACKS.wheel.spin * ATTACKS.wheel.active / 1000 - 2.16) < 1e-9, 'each blade sweeps 124 degrees');
  assert.equal(ATTACKS.gaze.shape, 'gaze');
  assert.deepEqual([GAZE_HALF_DEG, GAZE_RANGE_M, GAZE_BLIND_MS], [50, 60, 2000]);
});

// ═══ THE CHOICE ══════════════════════════════════════════════════════════════════════════════════════════════════════

test('WB14a his choice: without the fight\'s word attacksFor offers none of the six (every older pin\'s answer holds); with it, each once its cooldown has passed since its last use and a court of nMin stands - and the beat stamps its use (mutants: a cooldown never read; the court\'s count ignored; the use never stamped)', () => {
  assert.ok(!attacksFor(3, 5, 2).some((a) => NEW.includes(a.key)), 'no word, none');
  assert.deepEqual(attacksFor(1, 1, 0).map((a) => a.key), ['cleave'], 'WB3\'s pin holds');
  const ctx = (used = {}, n = 3) => ({ now: T0, used, n });
  assert.deepEqual(attacksFor(1, 5, 0, -1, BASE_PROFILE, 1, ctx()).map((a) => a.key), ['cleave', 'charge', 'chains'].filter((k) => ATTACKS[k].range >= 5 && (ATTACKS[k].minGap ?? 0) <= 5));
  assert.ok(attacksFor(1, 5, 0, -1, BASE_PROFILE, 1, ctx()).includes(ATTACKS.chains));
  assert.ok(!attacksFor(1, 15, 0, -1, BASE_PROFILE, 1, ctx()).includes(ATTACKS.chains), 'past 14 m of his body, no chain');
  assert.ok(!attacksFor(1, 5, 0, -1, BASE_PROFILE, 1, ctx({ chains: T0 - 21_999 })).includes(ATTACKS.chains), 'its cooldown still running');
  assert.ok(attacksFor(1, 5, 0, -1, BASE_PROFILE, 1, ctx({ chains: T0 - 22_000 })).includes(ATTACKS.chains));
  assert.ok(!attacksFor(2, 5, 0, -1, BASE_PROFILE, 1, ctx({}, 1)).some((a) => a === ATTACKS.brand || a === ATTACKS.torment), 'one fighter: no brand, no torment');
  assert.ok(attacksFor(2, 5, 0, -1, BASE_PROFILE, 1, ctx({}, 2)).includes(ATTACKS.brand));
  const p3 = attacksFor(3, 5, 0, -1, BASE_PROFILE, 1, ctx()).map((a) => a.key);
  for (const k of ['wheel', 'gaze', 'unmake']) assert.ok(p3.includes(k), k);
  assert.ok(!attacksFor(2, 5, 0, -1, BASE_PROFILE, 1, ctx()).some((a) => ['wheel', 'gaze', 'unmake'].includes(a.key)), 'Dagon\'s Champion\'s alone');
  // the beat: a fight that chooses the chains says it, and stamps it
  const f = fightOf(1, 1);
  const rng = seeded(3);
  let saw = null;
  for (let t = T0; t < T0 + 60_000 && !saw; t += 500) {
    const a = atkOf(stepBrain(f, t, [body('s0', 0, 6)], rng));
    if (a && a.a === ATTACKS.chains.id) saw = { a, t };
    if (f.atk) { f.atk.until = Math.min(f.atk.until, t + 100); }
  }
  assert.ok(saw, 'he throws the chain in time');
  assert.equal(f.used.chains, saw.t);
  assert.ok(saw.t >= T0 + OPENING_MS + ATTACKS.chains.cd, 'never before its cooldown has run from his wake - he never opens on one');
});

// ═══ THE MARKED ══════════════════════════════════════════════════════════════════════════════════════════════════════

test('WB14a the marked: the chained and the tormented his target, the branded brandCountFor of the living by the dice - each where they stood (`tg`) and by peer id (`pk`), on the wire too; a relay that cannot name them all names none (mutants: the ids dropped; the count off)', () => {
  assert.deepEqual([1, 2, 3, 5, 6, 8, 20].map(brandCountFor), [1, 1, 2, 2, 3, 3, 3]);
  const f = fightOf(6, 2);
  f.used = { chains: T0, torment: T0, wheel: T0, gaze: T0, unmake: T0 };   // the brand alone open
  const bodies = [0, 1, 2, 3, 4, 5].map((i) => body(`s${i}`, -10 + i * 4, 6));
  let w = null;
  for (let t = T0; t < T0 + 120_000 && !w; t += 400) { const a = atkOf(stepBrain(f, t, bodies, seeded(t))); if (a?.a === ATTACKS.brand.id) w = a; if (f.atk && f.atk.a !== ATTACKS.brand.id) f.atk.until = t; }
  assert.ok(w, 'the brand called');
  assert.equal(w.pk.length, 3);
  assert.equal(w.tg.length, 3);
  for (let k = 0; k < 3; k++) { const b = bodies.find((x) => x.id === w.pk[k]); assert.deepEqual(w.tg[k], [b.x, b.z]); }
  assert.equal(new Set(w.pk).size, 3);
  const st = validGateOut({ k: 'atk', ...w });
  assert.deepEqual(st.pk ?? st.atk?.pk ?? null, w.pk, 'the wire keeps them');
  // no ids, no pk
  assert.equal(atkFrame({ i: 1, a: 12, at: 1, x: 0, z: 0, yw: 0, tg: [[1, 2]] }).pk, undefined);
  // and every screen keeps them - the word folded, and the state that carries it
  const live = { ...GATE_STATE_EMPTY, day: 7, boss: 'ruhn', hp: 900, max: 1000 };
  const folded = foldGate(live, validGateOut({ k: 'atk', ...w }), T0);
  assert.deepEqual(folded.atk.pk, w.pk, 'the fold keeps who is marked');
  assert.equal(foldGate(live, validGateOut({ k: 'atk', ...w, pk: undefined }), T0).atk.pk, undefined);
});

test('WB14a the wire: an atk word\'s `pk` - one valid peer id for each of its targets, or none - and any id to GATE_ATK_ID_MAX; anything else refuses the word (mutants: a pk of the wrong length taken; a twelfth id refused)', () => {
  const base = { k: 'atk', i: 3, a: ATTACKS.torment.id, at: T0, x: 1, z: 2, yw: 0.5, tg: [[3, 4]] };
  assert.ok(validGateOut(base), 'no pk: kept');
  const pk = (v) => validGateOut({ ...base, pk: v });
  assert.ok(pk(['peer-abc1']));
  for (const bad of [[], ['peer-abc1', 'peer-abc2'], ['x'], [5], 'peer-abc1', ['bad id!']]) assert.equal(pk(bad), null, JSON.stringify(bad));
  assert.ok(validGateOut({ ...base, a: 16 }) && validGateOut({ ...base, a: 31 }));
  assert.equal(validGateOut({ ...base, a: 32 }), null);
});

// ═══ THE CHAINS ══════════════════════════════════════════════════════════════════════════════════════════════════════

test('WB14a the Chains: the relay reads the chained fighter as it lands - inside CHAIN_HOLD_M (and the pose\'s slack) a Ground Slam follows at his feet a recovery and a breath later; past it, nothing; my screen reels me to CHAIN_PULL_TO_M of him against the motor\'s own decay (mutants: the slam after a broken chain; the pull too short)', () => {
  const run = (z) => {
    const f = fightOf(1, 1);
    f.used = { chains: T0 };
    const out = [];
    let t = T0;
    f.pos = [0, 0];
    // call the chain at once
    const bodies = [body('s0', 0, 6)];
    f.atk = { i: ++f.seq, a: ATTACKS.chains.id, at: t + ATTACKS.chains.windup, x: 0, z: 0, yw: 0, tg: [[0, 6]], pk: ['peer-s0'], who: 's0', until: t + ATTACKS.chains.windup + ATTACKS.chains.active + ATTACKS.chains.recover };
    bodies[0].z = z;
    for (t = T0; t < T0 + 8000; t += 100) out.push(...stepBrain(f, t, bodies, seeded(1)));
    return out.filter((o) => o.k === 'atk').map((o) => ATTACK_BY_ID[o.a].key);
  };
  assert.equal(run(10)[0], 'slam', 'held: the Slam at his feet');
  assert.equal(run(CHAIN_HOLD_M + POSE_SLACK - 0.1)[0], 'slam', 'the pose\'s slack, in the court\'s favour of the Slam (it lands at his feet, never theirs)');
  assert.ok(!run(CHAIN_HOLD_M + POSE_SLACK + 0.5).includes('slam'), 'broken: no Slam');
  // the screen's law
  const a = word(ATTACKS.chains, { tg: [[0, 10]], pk: ['me'] });
  assert.equal(chainHolds(a, 0, CHAIN_HOLD_M), true);
  assert.equal(chainHolds(a, 0, CHAIN_HOLD_M + 0.01), false);
  const v = chainPull(a, 0, 10, BLOW_PUSH_DECAY);
  assert.ok(v[0] === 0 && v[1] < 0, 'toward him');
  assert.ok(Math.abs((v[1] * v[1]) / (2 * BLOW_PUSH_DECAY) - (10 - CHAIN_PULL_TO_M)) < 1e-9, 'the motor\'s decay carries me to CHAIN_PULL_TO_M of him');
  const far = chainPull(a, 0, CHAIN_HOLD_M, BLOW_PUSH_DECAY);
  assert.ok(Math.abs((far[1] * far[1]) / (2 * BLOW_PUSH_DECAY) - CHAIN_PULL_MAX_M) < 1e-9, 'CHAIN_PULL_MAX_M at most');
  assert.equal(chainPull(a, 0, 3, BLOW_PUSH_DECAY), null, 'already that near');
});

// ═══ THE BRAND AND THE TORMENT ═══════════════════════════════════════════════════════════════════════════════════════

test('WB14a Dagon\'s Brand on my feet: branded, its own share; within its reach of ANOTHER branded fighter where my screen sees them, its burst - never my own ring; Shared Torment shared among everyone inside its ring as my screen sees them (mutants: the brand bursting on its own; the torment shared among the court)', () => {
  const places = new Map([['ann', [10, 0]], ['bran', [20, 0]]]);
  const placeOf = (id) => places.get(id) ?? null;
  const b = word(ATTACKS.brand, { tg: [[0, 0], [12, 0]], pk: ['me', 'ann'] });
  assert.deepEqual(markedOf(b), ['me', 'ann']);
  assert.ok(markedMe(b, 'me') && !markedMe(b, 'bran'));
  assert.deepEqual(markedAt(b, 1, 'me', [1, 1], placeOf), [10, 0], 'where I see Ann now, not where she stood');
  assert.deepEqual(markedAt(b, 0, 'me', [1, 1], placeOf), [1, 1], 'me: my feet');
  assert.deepEqual(markedAt(b, 1, 'me', null, () => null), [12, 0], 'one I cannot see: where they stood');
  assert.deepEqual(brandOn(b, 'me', 0, 0, placeOf), { self: true, burst: false }, 'my own ring is mine');
  assert.deepEqual(brandOn(b, 'me', 6, 0, placeOf), { self: true, burst: true }, 'and Ann\'s, 4 m off');
  assert.deepEqual(brandOn(b, 'bran', 14, 0, placeOf), { self: false, burst: true }, 'Bran by Ann');
  assert.deepEqual(brandOn(b, 'bran', 20, 0, placeOf), { self: false, burst: false });
  const tm = word(ATTACKS.torment, { tg: [[0, 0]], pk: ['ann'] });
  assert.equal(tormentShare(tm, 'me', 30, 0, placeOf, [[10, 0], [20, 0]]), 0, 'outside it');
  assert.equal(tormentShare(tm, 'me', 11, 0, placeOf, [[10, 0], [20, 0]]), 2, 'me and Ann');
  assert.equal(tormentShare(tm, 'me', 11, 0, placeOf, [[10, 0], [12, 1], [20, 0]]), 3);
  const mine = word(ATTACKS.torment, { tg: [[5, 5]], pk: ['me'] });
  assert.equal(tormentShare(mine, 'me', 0, 0, placeOf, [[2, 0], [9, 0]]), 2, 'mine where I stand');
});

// ═══ THE WHEEL AND THE UNMAKING ══════════════════════════════════════════════════════════════════════════════════════

test('WB14a the Wheel: two blades from where he stood, turning `spin` a second over its span, one way or the other by its number - it strikes as a blade passes, between the frame before and this one, a slow frame sweeping all it missed; ahead of a blade is safe until it comes (mutants: the blades still; a slow frame\'s sweep missed)', () => {
  const W = ATTACKS.wheel;
  const a = word(W, { i: 3, yw: 0 }), b = word(W, { i: 4, yw: 0 });
  assert.deepEqual([wheelSpin(a), wheelSpin(b)], [1, -1]);
  assert.equal(wheelAngle(a, T0 - 500), 0, 'still before it lands');
  assert.ok(Math.abs(wheelAngle(a, T0 + 1000) - W.spin) < 1e-12);
  assert.ok(Math.abs(wheelAngle(b, T0 + W.active + 5000) + W.spin * W.active / 1000) < 1e-12, 'and after it');
  assert.equal(wheelBlades(a, T0).length, 2);
  // a fighter 10 m out at 30 degrees ahead of the first blade (the way it turns): safe until it comes
  const px = 10 * Math.sin(0.5), pz = 10 * Math.cos(0.5);
  assert.equal(wheelStrikes(a, px, pz, T0 + 200, T0), false);
  const due = T0 + (0.5 / W.spin) * 1000;
  assert.equal(wheelStrikes(a, px, pz, due + 50, due - 50), true, 'the blade passes over');
  assert.equal(wheelStrikes(a, px, pz, T0 + 5000, T0), true, 'a slow frame sweeps what it missed');
  assert.equal(wheelStrikes(b, px, pz, T0 + 1500, T0), false, 'the other way round, it turns away');
  assert.equal(wheelStrikes(a, 0, W.len + 2, T0 + 100, T0), false, 'past its reach');
  assert.equal(wheelStrikes(a, 0, 1, T0 + 100, T0 + 50), true, 'at his feet');
  assert.equal(strikeVerdict(a, 0, -8, T0 + 100, T0), 'hit', 'the second blade');
  assert.equal(strikeVerdict(a, -8, 0, T0 + 100, T0), 'wait', 'not yet come');
  assert.equal(strikeVerdict(a, -30, 0, T0 + W.active + 10, T0 + W.active - 10), 'miss', 'its turn over');
  assert.ok(inAttack(a, 0.5, 8) && !inAttack(a, 8, 0), 'its ground at the landing');
});

test('WB14a the Unmaking: every other one of eight wedges about his court\'s heart, the first on his facing; at its end a second cast turns a wedge on - the other half - and never a third (mutants: the wedges about his feet; the second cast the same wedges; a third)', () => {
  const U = ATTACKS.unmake, heart = [COURTS[1][0], COURTS[1][1]];   // the second court: no Reckoning armed there
  const a = word(U, { x: heart[0] + 5, z: heart[1], tg: [heart], yw: 0 });
  const at = (deg, r = 10) => [heart[0] + r * Math.sin((deg * Math.PI) / 180), heart[1] + r * Math.cos((deg * Math.PI) / 180)];
  for (const [deg, lit] of [[0, true], [20, true], [25, false], [45, false], [60, false], [70, true], [90, true], [180, true], [135, false], [-90, true]]) assert.equal(inWedges(a, ...at(deg)), lit, `${deg} degrees`);
  assert.equal(inWedges(a, ...at(0, U.r + 0.1)), false, 'past its reach');
  assert.equal(strikeVerdict(a, ...at(0), T0, T0 - 16), 'hit');
  // the brain: the first cast queues the second, turned one wedge; the second queues nothing
  const f = fightOf(3, 3);
  f.court = 1; f.pos = [heart[0] + 5, heart[1]];   // off its heart: the wedges are the court's, never his feet's
  f.used = { chains: T0, brand: T0, torment: T0, wheel: T0, gaze: T0 };
  const bodies = [body('s0', heart[0], heart[1] + 6), body('s1', heart[0] + 6, heart[1]), body('s2', heart[0], heart[1] - 6)];
  const seen = [];
  let t = T0;
  for (; t < T0 + 200_000 && seen.length < 2; t += 100) {
    const w = atkOf(stepBrain(f, t, bodies, seeded(t)));
    if (w?.a === U.id) seen.push(w);
    else if (w && f.atk && f.atk.a !== U.id) f.atk.until = t;
  }
  assert.equal(seen.length, 2);
  assert.deepEqual(seen[0].tg, [heart], 'about the heart of the court he fights in');
  assert.ok(Math.hypot(seen[0].x - heart[0], seen[0].z - heart[1]) > 1, 'wherever he stands');
  const turn = (((seen[1].yw - seen[0].yw) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  assert.ok(Math.abs(turn - Math.PI / 4) < 2e-2, `turned one wedge: ${turn}`);
  assert.ok(seen[1].at - seen[0].at >= U.active + U.recover + TURN_BREATH_MS + windupOf(U, 3) - 150, 'a recovery and a breath, then its own wind-up');
  assert.ok(!f.queue.some((e) => e.a === 'unmake'), 'no third');
  for (; f.atk && f.atk.a === U.id; t += 100) stepBrain(f, t, bodies, seeded(t));
  assert.ok(!f.queue.some((e) => e.a === 'unmake') && f.pending?.a !== 'unmake', 'and none after the second');
});

// ═══ THE GAZE ════════════════════════════════════════════════════════════════════════════════════════════════════════

test('WB14a the Burning Gaze: on whoever\'s view holds him as it lands - within GAZE_HALF_DEG of the camera\'s heading and GAZE_RANGE_M of him; turned away, nothing; no camera, nothing (mutants: the angle off; the range ignored)', () => {
  // me at the origin facing +z (yaw 0); him ahead
  assert.equal(gazeHolds(0, 20, 0, 0, 0), true);
  assert.equal(gazeHolds(20 * Math.sin(0.86), 20 * Math.cos(0.86), 0, 0, 0), true, '49 degrees off');
  assert.equal(gazeHolds(20 * Math.sin(0.89), 20 * Math.cos(0.89), 0, 0, 0), false, '51 off');
  assert.equal(gazeHolds(0, 20, 0, 0, Math.PI), false, 'turned away');
  assert.equal(gazeHolds(0, GAZE_RANGE_M + 1, 0, 0, 0), false);
  assert.equal(gazeHolds(0, 20, 0, 0, null), false);
  assert.equal(strikeVerdict(word(ATTACKS.gaze), 0, 0, T0, T0 - 16), 'miss', 'never the ground\'s');
  assert.ok(isMarkedBlow(ATTACKS.gaze) && isMarkedBlow(ATTACKS.chains) && isMarkedBlow(ATTACKS.brand) && isMarkedBlow(ATTACKS.torment) && !isMarkedBlow(ATTACKS.wheel));
  assert.deepEqual([markedVerdict(word(ATTACKS.gaze), T0 - 1), markedVerdict(word(ATTACKS.gaze), T0), markedVerdict(word(ATTACKS.gaze), T0 + ATTACKS.gaze.active + STRIKE_LATE_MS + 1)], ['wait', 'judge', 'miss']);
});

// ═══ THE RELAY'S JUDGE ═══════════════════════════════════════════════════════════════════════════════════════════════

test('WB14a the relay counts what its poses can show: the Wheel down its turn and the Unmaking\'s wedges, as plain blows; never the Chains (a pull), never the Gaze (a camera), never the Brand nor the Torment (his element, a count it does not hold) (mutants: the Gaze counted; the Wheel judged once at its landing)', () => {
  const f = fightOf(2, 3);
  const live = (x, z) => [{ sub: 's0', x, z, dead: false, tr: null }];
  const judge = (atk, x, z, times) => { f.atk = { ...atk }; f.bjAt = undefined; let out = []; for (const t of times) out = out.concat(judgeGate(f, live(x, z), t)); return out; };
  const W = ATTACKS.wheel;
  const px = 10 * Math.sin(1), pz = 10 * Math.cos(1), due = T0 + (1 / W.spin) * 1000;
  assert.equal(judge(word(W, { i: 3 }), px, pz, [T0 + 200]).length, 0, 'not yet come');
  assert.ok(judge(word(W, { i: 3 }), px, pz, [T0 + 200, due - 400, due + 400]).length >= 1, 'the blade passed over the pose');
  for (const A of [ATTACKS.chains, ATTACKS.gaze, ATTACKS.brand, ATTACKS.torment]) assert.equal(judge(word(A, { tg: [[0, 1]], pk: ['peer-s0'] }), 0, 1, [T0 + 1000, T0 + 2000]).length, 0, A.key);
  const heart = [COURTS[0][0], COURTS[0][1]];
  assert.ok(judge(word(ATTACKS.unmake, { tg: [heart] }), heart[0], heart[1] + 10, [T0 + 1000, T0 + 2000]).length >= 1, 'a lit wedge');
  assert.equal(judge(word(ATTACKS.unmake, { tg: [heart] }), heart[0] + 10 * Math.sin(Math.PI / 4), heart[1] + 10 * Math.cos(Math.PI / 4), [T0 + 1000, T0 + 2000]).length, 0, 'a dark one');
  assert.match(read('server/src/index.js'), /return \{ sub: b\.sub, id: b\.id, x: c\.x, z: c\.z,/, 'the relay\'s bodies carry their peer id');
});

// ═══ THE GROUND ══════════════════════════════════════════════════════════════════════════════════════════════════════

test('WB14a the ground shows what lands: the chain a path from him to the chained where my screen sees them, his colour inside its hold and the safe edge past it; the brand\'s and the torment\'s rings where their fighters are seen (the torment in gold); the wheel the Spokes\' lanes, turning and lit through their turn; the Unmaking its own kind; the Gaze none (mutants: the ring left where they stood; the chain\'s colour fixed)', () => {
  const P = BASE_PROFILE;
  const ch = word(ATTACKS.chains, { at: T0 + 1000, tg: [[0, 8]], pk: ['ann'] });
  const near = telegraphShape(ch, 1, T0, P, () => [0, 10]), far = telegraphShape(ch, 1, T0, P, () => [0, 30]);
  assert.equal(near.kind, TELEGRAPH_KIND.lane);
  assert.equal(near.pool, TELEGRAPH_POOL.path);
  assert.equal(near.halfW, TELEGRAPH_CHAIN_HALF_W);
  assert.deepEqual(near.end, [0, 10]);
  assert.deepEqual(near.color, ATTACK_COLORS.chains);
  assert.deepEqual(far.color, TELEGRAPH_EDGE_SAFE);
  assert.deepEqual(telegraphShape(ch, 1, T0, P).end, [0, 8], 'one not seen: where they stood');
  const br = word(ATTACKS.brand, { at: T0 + 1000, tg: [[1, 1], [5, 5]], pk: ['a1', 'a2'] });
  const sh = telegraphShape(br, 2, T0, P, (k) => (k === 1 ? [6, 6] : null));
  assert.equal(sh.kind, TELEGRAPH_KIND.discs);
  assert.deepEqual(sh.points, [[1, 1], [6, 6]]);
  assert.equal(sh.r, ATTACKS.brand.r);
  assert.deepEqual(telegraphShape(word(ATTACKS.torment, { at: T0 + 1000, tg: [[2, 2]] }), 2, T0, P).color, TORMENT_COLOR);
  const wh = word(ATTACKS.wheel, { i: 3, at: T0 });
  const w0 = telegraphShape(wh, 3, T0 - 500, P), w1 = telegraphShape(wh, 3, T0 + 2000, P);
  assert.equal(w0.kind, TELEGRAPH_KIND.spokes);
  assert.equal(w0.n, 2);
  assert.ok(Math.abs(w1.yaw - 2 * ATTACKS.wheel.spin) < 1e-9, 'turning');
  assert.deepEqual([w1.flash, w1.after], [0, -1], 'lit through its turn');
  assert.equal(telegraphShape(wh, 3, T0 + ATTACKS.wheel.active + 100, P).flash, 1, 'its landing\'s flash at its end');
  assert.equal(telegraphShape(word(ATTACKS.gaze, { at: T0 + 1000 }), 3, T0, P), null);
  // the Unmaking: the shader's reading in JS, point for point the strike's
  const heart = [COURTS[1][0], COURTS[1][1]];
  const un = word(ATTACKS.unmake, { at: T0 + 1000, tg: [heart], yw: 0.3 });
  const us = telegraphShape(un, 3, T0, P);
  assert.equal(us.kind, TELEGRAPH_KIND.wedges);
  assert.deepEqual([us.n, us.origin], [4, heart]);
  for (let i = 0; i < 400; i++) {
    const r = (i * 7.31) % (COURT_R + 3), ang = i * 0.731;
    const x = heart[0] + r * Math.sin(ang), z = heart[1] + r * Math.cos(ang);
    assert.equal(telegraphField(us, x, z).inside, inWedges(un, x, z), `point ${i}`);
  }
  assert.match(TELEGRAPH_FS, /\} else if \(uKind == 8\) \{/);
  assert.match(read('src/render/gate/gateTelegraph.js'), /shape\.kind === TELEGRAPH_KIND\.spokes \|\| shape\.kind === TELEGRAPH_KIND\.wedges \? \(shape\.n \?\? 0\)/);
});

// ═══ MY SCREEN ═══════════════════════════════════════════════════════════════════════════════════════════════════════

test('WB14a my screen judges the marked blows on my feet once each: chained inside the hold - struck and reeled; branded - its own share, and the burst by another; the Torment\'s share by who stands in it; the Gaze while I look at him - struck and blinded; and none of it on a fallen body or after its late bound (mutants: judged twice; the pull never sent; the share unshared)', () => {
  const P = BASE_PROFILE;
  const landed = [], pulled = [];
  let places = new Map(), others = [];
  const A = createGateArsenal({ me: () => 'me', placeOf: (id) => places.get(id) ?? null, others: () => others, land: (atk, PP, so) => landed.push([ATTACK_BY_ID[atk.a].key, so.pct, so.base]), pull: (vx, vz) => pulled.push([vx, vz]), pullDecay: BLOW_PUSH_DECAY });
  const st = (atk, over = {}) => ({ day: 7, phase: 3, atk, fell: null, wrath: null, ...over });
  const chain = word(ATTACKS.chains, { i: 1, tg: [[0, 10]], pk: ['me'] });
  A.judge(st(chain), T0 - 10, P, [0, 10], 0, true);
  assert.deepEqual(landed, [], 'not yet');
  A.judge(st(chain), T0 + 5, P, [0, 10], 0, true);
  A.judge(st(chain), T0 + 50, P, [0, 10], 0, true);
  assert.deepEqual(landed, [['chains', ATTACKS.chains.pct, ATTACKS.chains.base]], 'once');
  assert.equal(pulled.length, 1);
  landed.length = 0; pulled.length = 0;
  A.judge(st(word(ATTACKS.chains, { i: 2, tg: [[0, 30]], pk: ['me'] })), T0 + 5, P, [0, 30], 0, true);
  assert.deepEqual([landed, pulled], [[], []], 'past the hold, the chain broke');
  places = new Map([['ann', [3, 0]]]);
  A.judge(st(word(ATTACKS.brand, { i: 3, tg: [[0, 0], [3, 0]], pk: ['me', 'ann'] })), T0 + 5, P, [0, 0], 0, true);
  assert.deepEqual(landed.map((x) => x[0]), ['brand', 'brand'], 'my own share, and Ann\'s burst');
  assert.ok(Math.abs(landed[0][1] - ATTACKS.brand.selfPct) < 1e-12 && Math.abs(landed[1][1] - ATTACKS.brand.pct) < 1e-12);
  landed.length = 0;
  others = [[1, 0], [0, 1], [30, 30]];
  A.judge(st(word(ATTACKS.torment, { i: 4, tg: [[0, 0]], pk: ['me'] })), T0 + 5, P, [0, 0], 0, true);
  assert.ok(Math.abs(landed[0][1] - ATTACKS.torment.pct / 3) < 1e-12 && Math.abs(landed[0][2] - ATTACKS.torment.base / 3) < 1e-12, 'among three');
  landed.length = 0;
  A.judge(st(word(ATTACKS.gaze, { i: 5, x: 0, z: 20 })), T0 + 5, P, [0, 0], 0, true);
  assert.deepEqual(landed.map((x) => x[0]), ['gaze']);
  assert.equal(A.blindAt(), T0 + 5);
  landed.length = 0;
  A.judge(st(word(ATTACKS.gaze, { i: 6, x: 0, z: 20 })), T0 + 5, P, [0, 0], Math.PI, true);
  assert.deepEqual(landed, [], 'looked away');
  A.judge(st(word(ATTACKS.gaze, { i: 7, x: 0, z: 20 })), T0 + 5, P, [0, 0], 0, false);
  A.judge(st(word(ATTACKS.gaze, { i: 8, x: 0, z: 20 })), T0 + ATTACKS.gaze.active + STRIKE_LATE_MS + 5, P, [0, 0], 0, true);
  assert.deepEqual(landed, [], 'dead, or met too late');
});

test('WB14a the order under the crosshair, while it winds up: chained - run from him; branded - keep clear of the others; the Torment - gather, or stand with the marked by name; the Gaze - look away, the way to turn while I face him; the ground view says it in the warning\'s place and washes the screen white as the Gaze lands (mutants: the order the default "- move!"; the arrow the wrong way; the white never fading)', () => {
  const P = BASE_PROFILE, stung = [];
  const A = createGateArsenal({ me: () => 'me', placeOf: (id) => (id === 'ann' ? [4, 0] : null), nameOf: (id) => (id === 'ann' ? 'Ann' : null), others: () => [[4, 0]], land: () => {}, sting: (atk) => stung.push(atk.i) });
  const st = (atk) => ({ day: 7, phase: 2, atk, fell: null, wrath: null });
  const at = T0 + 1000;   // inside every wind-up
  const ch = A.order(st(word(ATTACKS.chains, { i: 1, at, tg: [[0, 10]], pk: ['me'] })), T0, P, [0, 10], 0);
  assert.equal(ch.order, ARSENAL_TEXT.chained());
  assert.deepEqual(ch.dir, [0, 10], 'away from him');
  assert.equal(A.order(st(word(ATTACKS.chains, { i: 1, at, tg: [[0, 10]], pk: ['ann'] })), T0, P, [0, 10], 0), null, 'not me');
  assert.equal(A.order(st(word(ATTACKS.brand, { i: 2, at, tg: [[0, 0]], pk: ['me'] })), T0, P, [0, 0], 0).order, ARSENAL_TEXT.branded());
  assert.equal(A.order(st(word(ATTACKS.torment, { i: 3, at, tg: [[0, 0]], pk: ['me'] })), T0, P, [0, 0], 0).order, ARSENAL_TEXT.tormentMe());
  const tw = A.order(st(word(ATTACKS.torment, { i: 4, at, tg: [[4, 0]], pk: ['ann'] })), T0, P, [-6, 0], 0);
  assert.equal(tw.order, 'Shared Torment! Stand with Ann!');
  assert.deepEqual(tw.dir, [10, 0], 'toward her');
  const gz = A.order(st(word(ATTACKS.gaze, { i: 5, at, x: 0, z: 20 })), T0, P, [0, 0], 0);
  assert.equal(gz.order, ARSENAL_TEXT.gaze());
  assert.deepEqual(gz.color, GAZE_COLOR);
  assert.deepEqual(gz.dir, [0, -20], 'turn from him');
  assert.equal(A.order(st(word(ATTACKS.gaze, { i: 5, at, x: 0, z: 20 })), T0, P, [0, 0], Math.PI).dir, null, 'already turned');
  assert.deepEqual(stung, [1, 2, 3], 'a sting for each that names me, once');
  const pr = orderPeril(ch, 0);
  assert.equal(pr.order, ARSENAL_TEXT.chained());
  assert.ok(Math.abs(pr.arrow) < 1e-9, 'away from him, ahead as I face away');   // AUDIT WB14 (RECORD-5): either way passed - the arrow the wrong way survived
  assert.ok(Math.abs(Math.abs(orderPeril(ch, Math.PI).arrow) - 180) < 1e-9, 'behind me as I face him');
  const g = groundViewModel({ now: T0, peril: pr });
  assert.equal(g.warn, ARSENAL_TEXT.chained(), 'its own order');
  assert.equal(groundViewModel({ now: T0, peril: { name: 'Cleave', t: 0.5, color: [1, 0, 0] } }).warn, 'Cleave - move!', 'the rest as they were');
  const b0 = groundViewModel({ now: T0, blindAt: T0 }), b1 = groundViewModel({ now: T0 + GAZE_BLIND_MS / 2, blindAt: T0 });
  assert.ok(Math.abs(b0.blind - BLIND_PEAK) < 0.05 && b1.blind < b0.blind && b1.blind > 0);
  assert.equal(groundViewModel({ now: T0 + GAZE_BLIND_MS, blindAt: T0 }), null, 'gone');
});

test('WB14a the court wires it: the arsenal judged beside his own blows, the rings drawn where my screen sees their fighters, the others\' places from the online frame each frame, a marked blow\'s order over the ground\'s, the Gaze\'s white; the host hands my peer id and my body\'s push; each new attack heard and coloured (mutants: the places never filled; the push never wired)', () => {
  const gc = read('src/scenes/gate/gateCourt.js');
  assert.match(gc, /arsenal\.judge\(s, t, P, /);
  assert.match(gc, /telegraphShape\(s\.atk, s\.phase, t, P, \(k\) => arsenal\.at\(s\.atk, k, mine\)\)/);
  assert.match(gc, /_places\.set\(d\.id, c\); _others\.push\(c\);/);
  assert.match(gc, /peril: order \?\? onMe, blindAt: arsenal\.blindAt\(\)/);   // PIN MOVED (WB14d): the blow on my feet his or his Flame's (onMe)
  assert.match(gc, /pull: \(vx, vz\) => !watching\(\) && pull\(vx, vz\)/, 'a watcher is never reeled');
  const w = read('src/scenes/world.js');
  assert.match(w, /\.\.\.arsenalSeams\(player, \(\) => online, BLOW_PUSH_DECAY\),/);   // PIN MOVED (HOST-SPLIT, at the merge of QUESTLINES): the three seams in one entry, made in the arsenal's module
  let on = null;
  const pushed = [];
  const S = arsenalSeams({ blowPush: (vx, vz) => pushed.push([vx, vz]) }, () => on, 12);
  assert.equal(S.myId(), null, 'offline');
  on = { id: 'p7' };
  assert.equal(S.myId(), 'p7', 'read at each ask - the link is made after the court');
  S.pull(3, -4);
  assert.deepEqual(pushed, [[3, -4]], 'the motor\'s blow push');
  assert.equal(S.pullDecay, 12);
  for (const k of NEW) {
    assert.ok(BOSS_CUES.windup[k] && BOSS_CUES.release[k] && BOSS_CUES.land[k], `${k} heard`);
    assert.ok(ATTACK_COLORS[k], `${k} coloured`);
  }
});
