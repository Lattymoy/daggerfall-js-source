// INT11-INT15 (2026-10-10, the INTEGRITY arc's lane 3 - bible/06-Systems/Integrity-Arc.md section 6; Mac: "I want to do
// everything and do it properly", and of the healing the relay cannot see: "Measure, then enforce"): THE BODY COUNTED, AS
// LAW. A boss's blow was judged on the struck player's machine alone, so a client that took none stood every fight out
// and could carry one. Pinned here: the relay's count of a body or a hull (net/bossBody.js - the line, a blow, the
// client's word as a mend out of a budget, the census, the measure a receipt carries, the margin, the client's pace) and
// the relay's judge of each fight's blows (net/bossRef.js - the gate's, the Abyss Dungeon's, the serpent's), each in the
// struck player's favour. The relay over the real Room and the service over the real Worker: test/int12_body_relay.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  BODY_DEFAULT, BODY_MARGIN, BODY_AFTER_MS, BODY_RISE_MS, BODY_LINE_MAX, HULL_REFLOAT, BODY_SAY_MS, BODY_SAY_KEEP_MS, BODY_SAY_WHOLE, BODY_MEASURE_MAX,
  bodyConfig, newBody, bodyStruck, bodySaid, bodyLife, bodyCensus, bodyDown, bodyOut, bodyMeasure, bodyMeasureValid, deepIn, bodySayer,
} from '../src/net/bossBody.js';
import { judgeGate, judgeRemnant, judgeSerpent, posAt, posAfter } from '../src/net/bossRef.js';
import { newFight, joinFight, profileOf, ATTACKS, HOST_BLOWS, hostBlowUnder } from '../src/net/gateBrain.js';
import { newRemnantFight, joinRemnant, SD_BLOWS, SD_PILLARS, SD_RESET_PCT, SD_END_PCT, pulsePctOf } from '../src/net/sdRemnant.js';
import { SERPENT_ATTACK_TABLE, GRIP, CRUSH, MAEL_GRIND, MAEL_EYE_R, RAM_V } from '../src/net/serpentBrain.js';
import { FIELD_REFLOAT, SEA_REPAIR_PER_S, SEA_REPAIR_UNDER_FIRE, FIELD_MEND_PER_S } from '../src/systems/naval/navalYard.js';
import { BODY_WORD_MAX } from '../src/net/wire.js';

const T = 2_000_000;
const LINE = Object.freeze({ depth: 1, perS: 0.05 });
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg ?? ''} ${a} !~ ${b}`);

// ═══ THE LINE ═══════════════════════════════════════════════════════════════════

test('INT11 THE LINE: the relay\'s BOSS_BODY var read whole or not at all - empty, unreadable, a wrong type or a number past BODY_LINE_MAX is the DEFAULT, which ENFORCES NOTHING (measure first); a part left out is the default\'s; the default\'s hull line is the sea\'s own repairs under fire twice over, and a ship floats again where the sea says (mutants: a typo enforcing; a part dropped; the refloat the relay\'s own guess)', () => {
  assert.equal(BODY_DEFAULT.enforce, false, 'MEASURE FIRST: nothing enforced until staff say so');
  for (const raw of [undefined, null, '', 'nonsense', '[]', '7', '{"enforce":"yes"}', '{"body":{"depth":-1,"perS":0.05}}', `{"hull":{"depth":1,"perS":${BODY_LINE_MAX + 1}}}`, '{"body":{"depth":1}}']) {
    assert.equal(bodyConfig(raw), BODY_DEFAULT, `read as the default: ${raw}`);
  }
  const on = bodyConfig('{"enforce":true}');
  assert.deepEqual(on, { enforce: true, body: { ...BODY_DEFAULT.body }, hull: { ...BODY_DEFAULT.hull } }, 'the line\'s parts the default\'s where left out');
  const set = bodyConfig({ enforce: true, body: { depth: 2, perS: 0.1 }, hull: { depth: 0.2, perS: 0.02 } });
  assert.deepEqual(set, { enforce: true, body: { depth: 2, perS: 0.1 }, hull: { depth: 0.2, perS: 0.02 } });
  assert.ok(Object.isFrozen(set) && Object.isFrozen(set.body));
  near(BODY_DEFAULT.hull.perS, 2 * (SEA_REPAIR_PER_S * SEA_REPAIR_UNDER_FIRE + FIELD_MEND_PER_S), 'the sea\'s repairs under fire and the free mending, twice over');
  assert.equal(HULL_REFLOAT, FIELD_REFLOAT, 'a wreck floats again where the sea says (the relay does not bundle the yard)');
  assert.equal(BODY_SAY_WHOLE, BODY_WORD_MAX, 'the client\'s word and the wire\'s bound, one whole');
});

// ═══ THE COUNT ══════════════════════════════════════════════════════════════════

test('INT11 THE COUNT: a blow the relay judged takes its share off the count; the blow that takes it to nothing is the count\'s FALL (one more, the first\'s stood time and damage kept for the receipt); a fallen count takes nothing more; nothing for no share (mutants: the fall never counted; the first fall\'s numbers overwritten; a fallen body struck again)', () => {
  const p = { stoodMs: 5000, dealt: 300 };
  assert.equal(bodyStruck(p, 0.45, T, LINE), false);
  near(p.bd.v, 0.55); near(p.bd.t, 0.45);
  assert.equal(bodyDown(p), false);
  assert.equal(bodyStruck(p, 0, T, LINE), false); assert.equal(bodyStruck(p, -1, T, LINE), false); assert.equal(bodyStruck(p, NaN, T, LINE), false);
  near(p.bd.t, 0.45, 'no share, nothing counted');
  assert.equal(bodyStruck(p, 0.6, T, LINE), true, 'the count falls');
  assert.equal(p.bd.v, 0); assert.equal(p.bd.w, 1); assert.equal(bodyDown(p), true);
  assert.deepEqual([p.bd.fs, p.bd.fd], [5000, 300], 'the first fall\'s stood time and damage');
  p.stoodMs = 9000; p.dealt = 900;
  assert.equal(bodyStruck(p, 0.3, T, LINE), false, 'a fallen count takes nothing');
  near(p.bd.t, 1.05);
  bodySaid(p, 1, T + 100_000, LINE);   // unenforced: it stands again on a mend
  assert.equal(bodyDown(p), false);
  assert.equal(bodyStruck(p, 1, T + 100_000, LINE), true, 'and falls again');
  assert.deepEqual([p.bd.w, p.bd.fs, p.bd.fd], [2, 5000, 300], 'the first fall\'s numbers stand');
  assert.equal(bodyStruck(null, 1, T, LINE), false);
});

test('INT11 THE WORD: the client\'s body\'s share - LESS than the count claims nothing and lowers nothing (a blow it took and said before the relay judged it would be taken twice); MORE claims the difference as a MEND, believed out of a budget that fills `perS` a second to `depth`, and what is left unmet is claimed PAST THE LINE once however often the same word comes again; enforced, a fallen BODY mends no more, a fallen HULL mends and floats again past HULL_REFLOAT; a word marks the count as said (mutants: an admission lowering the count; the budget unbounded or never refilled; the unmet claim counted every word; a fallen body mended under enforcement; a hull afloat below the line)', () => {
  const p = {};
  bodyStruck(p, 0.5, T, LINE);
  assert.equal(p.bd.sd, false, 'no word said yet');
  assert.equal(bodySaid(p, 0.3, T, LINE), false);
  near(p.bd.v, 0.5, 'an admission lowers nothing'); assert.equal(p.bd.h, 0); assert.equal(p.bd.o, 0);
  assert.equal(p.bd.sd, true, 'its game says its body');
  assert.equal(bodySaid(p, 0.9, T, LINE), true);
  near(p.bd.v, 0.9); near(p.bd.h, 0.4); near(p.bd.m, 0.6);
  bodyStruck(p, 0.5, T, LINE);
  bodySaid(p, 1, T, LINE);
  near(p.bd.v, 1); near(p.bd.m, 0); near(p.bd.h, 1);
  bodyStruck(p, 0.5, T, LINE);
  assert.equal(bodySaid(p, 1, T, LINE), false, 'an empty budget believes nothing');
  near(p.bd.v, 0.5); near(p.bd.o, 0.5, 'claimed past the line');
  bodySaid(p, 1, T, LINE); bodySaid(p, 1, T, LINE);
  near(p.bd.o, 0.5, 'the same claim, counted once');
  bodySaid(p, 1, T + 4000, LINE);   // four seconds fill 0.2
  near(p.bd.v, 0.7); near(p.bd.h, 1.2); near(p.bd.u, 0.3); near(p.bd.o, 0.5);
  bodyStruck(p, 0.3, T + 4000, LINE);
  bodySaid(p, 1, T + 4000, LINE);
  near(p.bd.o, 0.8, 'a new shortfall past the old unmet one is claimed again');
  bodySaid(p, 0.2, T + 4000, LINE);
  assert.equal(p.bd.u, 0, 'a word at or under the count leaves nothing unmet');
  bodySaid(p, 1, T + 1e9, LINE);
  near(p.bd.m, LINE.depth - (1 - 0.4), 'the budget fills to its depth, never past it');
  // over the whole: a word past one is the whole
  const q = {}; bodyStruck(q, 0.5, T, LINE); bodySaid(q, 7, T, LINE); near(q.bd.v, 1);
  assert.equal(bodySaid(q, NaN, T, LINE), false); assert.equal(bodySaid(q, '1', T, LINE), false); assert.equal(bodySaid(null, 1, T, LINE), false);
  // enforced: a fallen body mends no more
  const e = {}; bodyStruck(e, 1, T, LINE);
  assert.equal(bodySaid(e, 1, T + 60_000, LINE, { enforce: true }), false);
  assert.equal(e.bd.v, 0); assert.equal(bodyDown(e), true);
  // a hull: mends, and floats again past HULL_REFLOAT
  const HL = BODY_DEFAULT.hull, h = {};
  bodyStruck(h, 1, T, HL);
  bodySaid(h, 0.1, T, HL, { enforce: true, up: HULL_REFLOAT, hull: true });
  near(h.bd.v, 0.1); assert.equal(bodyDown(h), true, 'patched, still below the line');
  const struck = h.bd.t;
  assert.equal(bodyStruck(h, 0.05, T, HL), false, 'a wreck below the line is struck no more');
  assert.equal(h.bd.t, struck);
  bodySaid(h, 0.2, T + 10_000, HL, { enforce: true, up: HULL_REFLOAT, hull: true });
  assert.ok(h.bd.v > HULL_REFLOAT); assert.equal(bodyDown(h), false, 'afloat again past the line');
});

test('INT11 THE CENSUS: a death the fight saw noted on the count; alive again is a NEW LIFE (whole, its budget full, its measure kept) - at once while unenforced, only BODY_RISE_MS after the death once enforced and dead until then; enforced, a body the count has fallen is dead; the Abyss Dungeon\'s one life never rises; out of the fight (bodyOut) only under enforcement (mutants: the rise at once under enforcement; the count\'s fall ignored; the measure reset by a new life; a second life in the Hour)', () => {
  const f = { players: { a: {}, b: {}, c: {} } };
  const at = (dead) => [{ sub: 'a', dead: false }, { sub: 'b', dead }, { sub: 'x', dead: false }];
  assert.deepEqual(bodyCensus(f, at(false), T, LINE, false).map((b) => b.dead), [false, false, false]);
  bodyStruck(f.players.b, 0.4, T, LINE);
  assert.deepEqual(bodyCensus(f, at(true), T, LINE, true).map((b) => b.dead), [false, true, false]);
  assert.equal(f.players.b.bd.dd, T, 'the death noted');
  assert.equal(bodyOut(f.players.b, true), true); assert.equal(bodyOut(f.players.b, false), false);
  assert.equal(bodyCensus(f, at(false), T + BODY_RISE_MS - 1, LINE, true)[1].dead, true, 'no rise yet');
  assert.equal(bodyCensus(f, at(false), T + BODY_RISE_MS, LINE, true)[1].dead, false, 'risen');
  assert.deepEqual([f.players.b.bd.v, f.players.b.bd.m, f.players.b.bd.dd], [1, LINE.depth, null], 'whole, the budget full');
  near(f.players.b.bd.t, 0.4, 'the measure kept');
  // unenforced: a new life at once
  bodyCensus(f, at(true), T + 50_000, LINE, false);
  bodyStruck(f.players.b, 0.3, T + 50_000, LINE);
  assert.equal(bodyCensus(f, at(false), T + 50_001, LINE, false)[1].dead, false);
  assert.equal(f.players.b.bd.v, 1, 'risen at once');
  // the count's fall: dead while enforced
  bodyStruck(f.players.a, 1, T, LINE);
  assert.equal(bodyCensus(f, at(false), T, LINE, true)[0].dead, true);
  assert.equal(bodyCensus(f, at(false), T, LINE, false)[0].dead, false, 'only measured');
  // one life: the Hour's
  const g = { players: { a: {} } };
  bodyCensus(g, [{ sub: 'a', dead: true }], T, LINE, true, { lives: false });
  assert.equal(bodyCensus(g, [{ sub: 'a', dead: false }], T + 10 * BODY_RISE_MS, LINE, true, { lives: false })[0].dead, true);
  assert.equal(g.players.a.bd.dd, T, 'never a new life');
  assert.equal(bodyCensus(g, [{ sub: 'a', dead: false }], T + 10 * BODY_RISE_MS, LINE, false, { lives: false })[0].dead, false, 'unenforced, the census as it was');
  // bodyLife
  const l = { stoodMs: 1 }; bodyStruck(l, 1, T, LINE); bodyLife(l, T + 5, LINE);
  assert.deepEqual([l.bd.v, l.bd.dn, l.bd.w], [1, false, 1]);
});

test('INT14 THE MEASURE: a receipt\'s `m` - [counted, believed, past the line] in thousandths, the count\'s falls, whether the receipt would have stood had the first fall been a fall (the fight\'s own earning law asked of the fighter as it stood then), the seconds stood; none for a fighter the count never saw or whose game never said its body; each number bounded (mutants: a silent fighter measured; `kept` asked of the fighter as it stands at the kill; the bound dropped)', () => {
  assert.equal(bodyMeasure({}, () => true), null);
  const silent = { stoodMs: 1000 }; bodyStruck(silent, 1, T, LINE);
  assert.equal(bodyMeasure(silent, () => true), null, 'a tab that never said its body measures nothing');
  const p = { stoodMs: 20_000, dealt: 50 };
  bodyStruck(p, 0.6, T, LINE); bodySaid(p, 1, T, LINE);
  assert.deepEqual(bodyMeasure(p, () => { throw new Error('not asked without a fall'); }), [600, 600, 0, 0, 1, 20]);
  bodyStruck(p, 1, T, LINE);   // falls with 0.4 left in the budget
  bodySaid(p, 1, T, LINE);
  p.stoodMs = 90_000; p.dealt = 500;
  const asked = [];
  const m = bodyMeasure(p, (q) => { asked.push([q.stoodMs, q.dealt]); return q.stoodMs >= 60_000; });
  assert.deepEqual(asked, [[20_000, 50]], 'the fighter as it stood at the first fall');
  assert.deepEqual(m, [1600, 1000, 600, 1, 0, 90], 'the receipt the first fall would have cost');
  assert.ok(bodyMeasureValid(m));
  for (const bad of [null, [], [1, 2, 3, 4, 1], [1, 2, 3, 4, 2, 6], [1, 2, 3, 4, 1, -1], [1.5, 2, 3, 4, 1, 6], [BODY_MEASURE_MAX + 1, 0, 0, 0, 1, 0], '1,2,3,4,1,6']) assert.equal(bodyMeasureValid(bad), false, JSON.stringify(bad));
  const big = { stoodMs: 1e12 }; bodyStruck(big, 0.5, T, LINE); bodySaid(big, 1, T, LINE); big.bd.t = 1e9;
  assert.ok(bodyMeasureValid(bodyMeasure(big, () => true)), 'bounded, whatever a fight ran to');
});

test('INT11 THE MARGIN: a body is in a shape only BODY_MARGIN deep - every point that far round it inside too (the struck player\'s favour, eight ways round); nowhere is not a place (mutants: the centre alone; the margin dropped)', () => {
  const disc = (x, z) => Math.hypot(x, z) <= 3;
  assert.equal(deepIn(disc, 0, 0), true);
  assert.equal(deepIn(disc, 3 - BODY_MARGIN, 0), true);
  assert.equal(deepIn(disc, 3 - BODY_MARGIN + 0.01, 0), false, 'inside, but too near the edge');
  assert.equal(deepIn(disc, 0, -(3 - BODY_MARGIN + 0.01)), false, 'every way round');
  assert.equal(deepIn(disc, NaN, 0), false);
  assert.equal(deepIn(disc, 2, 0, 0), true, 'no margin, the point alone');
});

test('INT15 THE SAYING: the client\'s word at most every BODY_SAY_MS, at once when its body moves a thousandth, every BODY_SAY_KEEP_MS however still; a word the socket would not take is said again; the share bounded to the whole (mutants: the pace dropped; the keep-alive dropped; a refused word remembered as said)', () => {
  const sent = [];
  let take = true;
  const say = bodySayer((v) => { if (take) sent.push(v); return take; });
  assert.equal(say(0.5, 0), true);
  assert.equal(say(0.6, BODY_SAY_MS - 1), false, 'the pace');
  assert.equal(say(0.6, BODY_SAY_MS), true);
  assert.equal(say(0.6, 2 * BODY_SAY_MS), false, 'unchanged');
  assert.equal(say(0.6, BODY_SAY_MS + BODY_SAY_KEEP_MS), true, 'the keep-alive');
  take = false;
  assert.equal(say(0.7, 5 * BODY_SAY_KEEP_MS), false);
  take = true;
  assert.equal(say(0.7, 5 * BODY_SAY_KEEP_MS + 1), true, 'said again');
  assert.equal(say(3, 10 * BODY_SAY_KEEP_MS), true); assert.equal(say(-1, 11 * BODY_SAY_KEEP_MS), true);
  assert.equal(say(NaN, 12 * BODY_SAY_KEEP_MS), false);
  assert.deepEqual(sent, [500, 600, 600, 700, BODY_SAY_WHOLE, 0]);
});

// ═══ THE JUDGE ══════════════════════════════════════════════════════════════════

const W = T + 3_600_000;
function gateFight(n = 3) {
  const f = newFight(7, T, W, 'ruhn');
  for (let i = 0; i < n; i++) assert.ok(joinFight(f, `s${i + 1}`, `P${i + 1}`, 10, T, true));
  return f;
}
const at0 = T + 10_000;
const bd = (sub, x, z, extra = {}) => ({ sub, x, z, dead: false, ...extra });

test('INT11 THE GATE JUDGED: his plain blow at its landing on each living body deep in its shape - never before the first pose after it can have come (BODY_AFTER_MS), each blow once; a body that stepped out as it landed, or in after, is not struck (its trail, before and after); an element\'s blow is the client\'s; Dagon\'s whole court at once; his charge down its lane each beat of its run, each body once; his host\'s plain Bite; nothing once he has fallen (mutants: judged at the beat it lands; the after pose not read; an element counted; a blow judged twice; the charge struck twice)', () => {
  const f = gateFight(), P = profileOf(f), slam = P.atk.slam;
  f.atk = { i: 1, a: ATTACKS.slam.id, at: at0, x: 0, z: 0, yw: 0, tg: [], until: at0 + 2000 };
  const bodies = [bd('s1', 0, 0), bd('s2', slam.r - BODY_MARGIN + 0.2, 0), bd('s3', slam.r + 5, 0), bd('nobody', 0, 0), bd('s1', 1, 1, { dead: true })];
  assert.deepEqual(judgeGate(f, bodies, at0 + 100), [], 'the first pose after it may not have come');
  const got = judgeGate(f, bodies, at0 + BODY_AFTER_MS);
  assert.deepEqual(got, [{ sub: 's1', share: Math.min(1, ATTACKS.slam.pct * P.dmgX) }], 'the one deep in it - not the one at its edge, outside, a stranger, the dead');
  assert.equal(f.atk.bj, true);
  assert.deepEqual(judgeGate(f, bodies, at0 + 2 * BODY_AFTER_MS), [], 'once');
  // the trail: out as it landed, in after
  f.atk = { i: 2, a: ATTACKS.slam.id, at: at0 + 5000, x: 0, z: 0, yw: 0, tg: [], until: at0 + 7000 };
  const t1 = at0 + 5000;
  const moving = [
    bd('s1', 20, 0, { tr: [[t1 - 60, 0, 0], [t1 + 40, 20, 0]] }),
    bd('s2', 0, 0, { tr: [[t1 - 60, 20, 0], [t1 + 40, 0, 0]] }),
    bd('s3', 0, 0, { tr: [[t1 - 60, 0, 0], [t1 + 40, 0.5, 0]] }),
  ];
  assert.deepEqual(posAt(moving[0], t1), [0, 0]); assert.deepEqual(posAfter(moving[0], t1), [20, 0]);
  assert.deepEqual(posAt(bd('q', 5, 6), t1), [5, 6], 'no trail: where it stands');
  assert.deepEqual(posAt(bd('q', 5, 6, { tr: [[t1 + 1, 1, 1]] }), t1), [1, 1], 'all after: its first');
  assert.deepEqual(judgeGate(f, moving, t1 + BODY_AFTER_MS).map((h) => h.sub), ['s3'], 'only the one in it before and after');
  // an element's blow is the client's
  f.atk = { i: 3, a: ATTACKS.nova.id, at: at0 + 9000, x: 0, z: 0, yw: 0, tg: [], until: at0 + 12000 };
  assert.deepEqual(judgeGate(f, [bd('s1', 10, 0)], at0 + 9000 + BODY_AFTER_MS), []);
  assert.equal(f.atk.bj, true);
  // Dagon's: the whole court, at once, whole
  f.atk = { i: 4, a: ATTACKS.reckon.id, at: at0 + 20_000, x: 0, z: 0, yw: 0, tg: [], until: at0 + 23_000 };
  assert.deepEqual(judgeGate(f, [bd('s1', 30, 0), bd('s2', -5, 9)], at0 + 20_000), [{ sub: 's1', share: 1 }, { sub: 's2', share: 1 }]);
  // the charge, down its lane each beat of its run
  const C = ATTACKS.charge, c0 = at0 + 30_000;
  f.atk = { i: 5, a: C.id, at: c0, x: 0, z: 0, yw: 0, tg: [[0, 22]], until: c0 + C.active + C.recover };
  // s3 off the lane as the beat began and on it as it ended - stepped in as the head passed: not struck (both ends)
  const lane = [bd('s1', 0, 11), bd('s2', 0, 30), bd('s3', 0, 11, { tr: [[c0 + 250, 9, 11], [c0 + 500, 0, 11]] })];
  assert.deepEqual(judgeGate(f, lane, c0 + 250), [], 'the head not yet at it');
  assert.deepEqual(judgeGate(f, lane, c0 + 500), [{ sub: 's1', share: Math.min(1, C.pct * P.dmgX) }], 'its run passed over it');
  assert.deepEqual(judgeGate(f, lane, c0 + 750), [], 'once');
  assert.equal(f.atk.bj, undefined, 'still running');
  judgeGate(f, lane, c0 + C.active + 1);
  assert.equal(f.atk.bj, true, 'done at its run\'s end');
  // his host's plain Bite (the Legion-Lord's), and a Pulse in his aspect is the client's
  const B = hostBlowUnder(0, P);
  f.atk = null;
  f.lg = { ads: [{ i: 1, k: 0, x: 5, z: 5, atk: { at: at0 + 40_000, x: 5, z: 5, until: at0 + 42_000 } }, { i: 2, k: 2, x: -5, z: -5, atk: { at: at0 + 40_000, x: -5, z: -5, until: at0 + 42_000 } }] };
  assert.equal(HOST_BLOWS[0].el, null);
  assert.ok(B.r >= BODY_MARGIN, 'a Bite reaches past the margin');
  assert.deepEqual(judgeGate(f, [bd('s1', 5, 5), bd('s2', -5, -5)], at0 + 40_000 + BODY_AFTER_MS), [{ sub: 's1', share: Math.min(1, B.pct) }]);
  assert.equal(f.lg.ads[1].atk.bj, true, 'the Pulse is marked, never counted');
  // he has fallen
  f.atk = { i: 9, a: ATTACKS.slam.id, at: at0 + 50_000, x: 0, z: 0, yw: 0, tg: [], until: at0 + 52_000 };
  f.fell = { at: at0 + 49_000 };
  assert.deepEqual(judgeGate(f, [bd('s1', 0, 0)], at0 + 51_000), []);
});

function sdFight(n = 2) {
  const f = newRemnantFight(5, 1, T, null);
  for (let i = 0; i < n; i++) assert.ok(joinRemnant(f, `s${i + 1}`, `P${i + 1}`, 10, T));
  return f;
}

test('INT12 THE ABYSS DUNGEON JUDGED: the Stomp\'s disc at its landing (never its rolling ring), the Gear Volley\'s marks, the Hour-Hand over its sweep each body once - a pillar\'s shade spares it; the Hour\'s own over the whole arena at once - the Reset only while its Hearts stand; an Echo\'s blows as the Remnant\'s; a blow its Hollow\'s marks gave an element is the client\'s; nothing once it is fallen or lost (mutants: the ring counted; the shade ignored; the Reset counted with its Hearts broken; an element counted; the clock\'s blow skipped)', () => {
  const f = sdFight(3);
  const S = SD_BLOWS.stomp;
  f.rem.atk = { i: 1, a: S.id, at: at0, x: 0, z: 0, yw: 0, tg: [], until: at0 + 5000 };
  const ring = (S.r + S.r1) / 2;
  assert.deepEqual(judgeRemnant(f, [bd('s1', 0, 0), bd('s2', ring, 0)], at0 + BODY_AFTER_MS), [{ sub: 's1', share: S.pct }], 'the disc, never the ring');
  // the Volley
  const V = SD_BLOWS.volley;
  f.rem.atk = { i: 2, a: V.id, at: at0 + 5000, x: 0, z: 0, yw: 0, tg: [[10, 0], [-10, 0]], until: at0 + 7000 };
  assert.deepEqual(judgeRemnant(f, [bd('s1', 10, 0), bd('s2', 0, 10), bd('s3', -10, 0)], at0 + 5000 + BODY_AFTER_MS).map((h) => h.sub), ['s1', 's3']);
  // the Hour-Hand, its shade
  const H = SD_BLOWS.hand, h0 = at0 + 10_000;
  f.rem.atk = { i: 3, a: H.id, at: h0, x: 0, z: 0, yw: 0, sw: 1, tg: [], until: h0 + H.active + H.recover };
  const [px, pz] = SD_PILLARS[0], k = Math.hypot(px, pz);
  const behind = [px * (1 + 4 / k), pz * (1 + 4 / k)];
  const hand = [bd('s1', 0, 10), bd('s2', behind[0], behind[1])];
  const got = [];
  for (let t = h0; t <= h0 + H.active + 250; t += 250) got.push(...judgeRemnant(f, hand, t));
  assert.deepEqual(got, [{ sub: 's1', share: H.pct }], 'swept once; the one behind a pillar spared');
  assert.equal(f.rem.atk.bj, true);
  // the Hour's own: the Pulse, the End - the whole arena at once
  f.rem.atk = null;
  f.clock = { i: 4, a: SD_BLOWS.pulse.id, at: at0 + 20_000, x: 0, z: 0, yw: 0, tg: [], until: at0 + 20_300, n: 3 };
  assert.deepEqual(judgeRemnant(f, [bd('s1', 0, 0), bd('s2', 500, 0)], at0 + 20_000), [{ sub: 's1', share: pulsePctOf(f.clock) }], 'in the arena alone - never the Steps');
  f.clock = { i: 5, a: SD_BLOWS.end.id, at: at0 + 21_000, x: 0, z: 0, yw: 0, tg: [], until: at0 + 21_000 };
  assert.deepEqual(judgeRemnant(f, [bd('s1', 0, 0)], at0 + 21_000), [{ sub: 's1', share: SD_END_PCT }]);
  // the Reset: its Hearts standing at its landing, else nothing
  f.clock = null;
  f.rem.atk = { i: 6, a: SD_BLOWS.reset.id, at: at0 + 30_000, x: 0, z: 0, yw: 0, tg: [], until: at0 + 33_000 };
  f.cx = { i: 6, m: 20, c: [{ x: 5, z: 5, h: 20 }] };
  assert.deepEqual(judgeRemnant(f, [bd('s1', 0, 0)], at0 + 30_000), [{ sub: 's1', share: SD_RESET_PCT }]);
  f.rem.atk = { i: 7, a: SD_BLOWS.reset.id, at: at0 + 40_000, x: 0, z: 0, yw: 0, tg: [], until: at0 + 43_000 };
  f.cx = null;
  assert.deepEqual(judgeRemnant(f, [bd('s1', 0, 0)], at0 + 40_000), [], 'its Hearts broken');
  // an Echo's Stomp, and one its Hollow made fire
  f.rem.atk = null;
  f.ec = [{ e: 0, h: 10, m: 10, up: 0, downAt: null, body: { atk: { i: 8, a: S.id, at: at0 + 50_000, x: 0, z: 0, yw: 0, tg: [], until: at0 + 53_000 } } },
    { e: 1, h: 10, m: 10, up: 0, downAt: null, body: { atk: { i: 9, a: S.id, at: at0 + 50_000, x: 20, z: 0, yw: 0, tg: [], until: at0 + 53_000, sh: { el: 'fire' } } } }];
  assert.deepEqual(judgeRemnant(f, [bd('s1', 0, 0), bd('s2', 20, 0)], at0 + 50_000 + BODY_AFTER_MS), [{ sub: 's1', share: S.pct }]);
  assert.equal(f.ec[1].body.atk.bj, true, 'the element\'s, marked and never counted');
  f.ec = null;
  f.rem.atk = { i: 10, a: S.id, at: at0 + 60_000, x: 0, z: 0, yw: 0, tg: [], until: at0 + 63_000 };
  f.lost = { at: at0 + 59_000 };
  assert.deepEqual(judgeRemnant(f, [bd('s1', 0, 0)], at0 + 61_000), []);
});

function serpentFight() {
  return {
    players: {
      a: { on: 2, hl: 2, share: 10 }, b: { on: 2, hl: 2, share: 10 }, hand: { on: -1, hl: 2, share: 0 }, w: { on: 2, hl: 2, share: 0, wreck: true },
    },
    ships: 1, atk: null, coil: null, mael: null,
  };
}

test('INT13 THE SERPENT JUDGED, ON HER HULL: its blow at its landing on each ship of her own afloat - her captain\'s place deep in its shape (never a hand on another\'s deck, a wreck, the dead), at the fleet\'s share; its ram down its lane each beat of its run; its coil\'s grip each second on the ship it closed about (deep in its ring as it landed - her `esc` is her word, the ring the relay\'s) and its crush as it lets her go crushed; the Maelstrom\'s eye grinding her; nothing once it is slain or gone (mutants: a hand\'s ship counted; the pair\'s share dropped; the grip without its ring; the crush twice)', () => {
  const f = serpentFight(), L = SERPENT_ATTACK_TABLE.lash;
  f.atk = { i: 1, a: L.id, at: at0, x: 0, z: 0, yw: 0, tg: [[0, 0]], until: at0 + 2000 };
  const ships = [bd('a', 0, 40), bd('b', 0, -40), bd('hand', 0, 40), bd('w', 0, 40), bd('a', 0, 40, { dead: true })];
  assert.deepEqual(judgeSerpent(f, ships, at0 + BODY_AFTER_MS), [{ sub: 'a', share: L.hull }], 'in its sweep; behind it, a hand, a wreck - nothing');
  f.ships = 2;
  f.atk = { i: 2, a: L.id, at: at0 + 5000, x: 0, z: 0, yw: 0, tg: [[0, 0]], until: at0 + 7000 };
  near(judgeSerpent(f, [bd('a', 0, 40)], at0 + 5000 + BODY_AFTER_MS)[0].share, L.hull * 2 / 3, 'a pair\'s share');
  f.ships = 1;
  // the ram, down its lane over its run
  const R = SERPENT_ATTACK_TABLE.ram, r0 = at0 + 10_000;
  f.atk = { i: 3, a: R.id, at: r0, x: 0, z: 0, yw: 0, tg: [[0, 0], [0, 150]], until: r0 + R.active + R.recover };
  const lane = [bd('a', 0, RAM_V), bd('b', 0, 140)];
  assert.deepEqual(judgeSerpent(f, lane, r0 + 1000), [], 'not yet past it by the margin');
  assert.deepEqual(judgeSerpent(f, lane, r0 + 1250), [{ sub: 'a', share: R.hull }]);
  assert.deepEqual(judgeSerpent(f, lane, r0 + 1500), [], 'once');
  // the coil: its ring as it landed, its grip each second it holds, its crush once
  f.atk = null;
  const c0 = at0 + 20_000;
  f.coil = { i: 4, s: 'a', x: 0, z: 0, at: c0, off: 0, why: null };
  const coiled = [bd('a', 3, 3), bd('b', 0, 0)];
  assert.deepEqual(judgeSerpent(f, coiled, c0 + 100), [], 'its ring not yet judged');
  const grip = judgeSerpent(f, coiled, c0 + 1100);
  assert.equal(f.coil.bg, true); assert.deepEqual(grip.map((h) => h.sub), ['a']);
  near(grip[0].share, GRIP.hull * 1.0, 'a second of its grip');
  f.coil.off = c0 + 5000; f.coil.why = 'crushed';
  const crush = judgeSerpent(f, coiled, c0 + 6000);
  assert.deepEqual(crush, [{ sub: 'a', share: CRUSH.hull }], 'its crush, and no grip once it lets go');
  assert.deepEqual(judgeSerpent(f, coiled, c0 + 7000), [], 'crushed once');
  const free = serpentFight();
  free.coil = { i: 5, s: 'a', x: 0, z: 0, at: c0, off: 0, why: null };
  judgeSerpent(free, [bd('a', 100, 0)], c0 + 1000);
  assert.equal(free.coil.bg, false, 'outside its ring as it landed: never held');
  free.coil.off = c0 + 2000; free.coil.why = 'crushed';
  assert.deepEqual(judgeSerpent(free, [bd('a', 100, 0)], c0 + 3000), []);
  // the Maelstrom's eye
  f.coil = null;
  f.mael = { at: at0 + 30_000, x: 0, z: 0 };
  judgeSerpent(f, [bd('a', 0, 0)], at0 + 30_000);
  const eye = judgeSerpent(f, [bd('a', 0, 0), bd('b', MAEL_EYE_R + 10, 0)], at0 + 31_000);
  assert.deepEqual(eye.map((h) => h.sub), ['a']); near(eye[0].share, MAEL_GRIND.hull * 1.0);
  f.fell = { at: at0 + 40_000 };
  assert.deepEqual(judgeSerpent(f, [bd('a', 0, 0)], at0 + 41_000), []);
});

test('INT11 the default line\'s numbers hold together: a whole body every 20 s and one held, past the margin and the pace (mutants: a depth of nothing)', () => {
  assert.ok(BODY_DEFAULT.body.depth > 0 && BODY_DEFAULT.body.perS > 0 && BODY_DEFAULT.hull.depth > 0);
  assert.ok(BODY_AFTER_MS > BODY_SAY_MS, 'a landing waits longer than the word\'s pace');
  assert.equal(newBody(T, LINE).v, 1);
});
