// AUDIT EG V (2026-10-15, the Elite Gates arc; bible/11-Multiplayer/Elite-Gates.md sections 8.5, 8.6, 13.2, 13.3, 13.4, 14, 18 and
// 19) - FIX GROUP B, THE LORDS: lane 1's findings L1-1 to L1-18 and L1-22 to L1-30, and lane 9's L9-7, each pinned on fights the
// real producers stand (net/eliteGates/egLaw.js egHallOf; net/eliteGates/egBrain.js egBreachNew, egEnter, egStep, egBlow, egCount, egFall; net/eliteGates/egLords.js
// egLordsNew, egLordsWake, egLordsStep; net/eliteGates/egBodies.js; the wire's validEgOut and the link's foldEg):
//   L1-1  a duel is its lord's: Garoth's Clan Muster beside THE OLD MASTERS' Armsmaster is never ended by the Armsmaster's kit, and
//         his fall is won;
//   L1-2  each lord its own aspect; L1-3 the Markynaz's decree folded, never erased by a lord stood after him;
//   L1-4, L1-5, L1-6, L1-16  the signatures on their own lord's state - the Colossus's own Breakdown, Ilthys's banners, the Twins'
//         own falls, the Armsmaster's Challenge met at n = 1;
//   L1-7  the Kynreeve's facing on the wire; L1-8 Morvayn's chain dropped at a fall; L1-9 a named failure blow counted on whom it
//         names; L1-10 the lords' place in THE UNION FLOOR; L1-11 the Kynmarcher's standards at his wake; L1-12 the Night-Stalker's
//         true umbra unread until it glints; L1-15 a snap's clock a link; L1-17 the fight's end; L1-18 a chained shape's dim
//         outline; L1-23 Paired Hearts the Colossus's own; L1-25 the Twins' touch the census's; L1-26 the Haven Nova over a floor of
//         many pieces; L1-29 each lord's own mirrors; L1-30 a told bridge scorches no one; L9-7 a champion's ring on no floor;
//   L1-24, L1-27, L1-28  the page said as built - the Clan Muster's duel at his third phase's turn, the Night-Stalker's Blood
//         Thrall its own kind, the Armsmaster's two challenged in the one ring.
// The screen's halves (L1-7's draw, L1-12's glint, L1-13, L1-14, L1-18's outline, L1-22) are pinned in egaudit5_b_client.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { egHallOf, egOnFight, EG_SEALED_MS, EG_DECREE_BY_KEY, EG_LORDS } from '../../../src/net/eliteGates/egLaw.js';
import { egBreachNew, egEnter, egStep, egBlow, egCount, egFall, egStateOf, egStrataSecond, champRing, EG_CHAMP_RING_M, EG_CHAMP_RING_MIN_M } from '../../../src/net/eliteGates/egBrain.js';
import { egLordsNew, egLordsWake, egLordsStep, egLordsOf, egLordsAwake, egLordsFell, egLordHit, egLordHitX, egLordAspect, egObjsOf, egObjBroken, egChainShared, egHavenRouteM, egHavenFloor,
  zoneOut, EG_HAVENS_MAX, EG_ZONE_FIGHT_MS, EG_UMBRA_MS, EG_UMBRA_GLINT_MS } from '../../../src/net/eliteGates/egLords.js';
import { egFightNew, egHas, EG_FL, EG_ROLE, egBlowsStep, egAim, egBodyWire, egYawOf, egFightState, egPlace, egWalk, egStop, egSetFl } from '../../../src/net/eliteGates/egBodies.js';
import { egErrandMs, egInShape, shDisc, shLane, egChainGapMs, egBlowOutlineFrom, EG_ESCAPE_MPS, EG_OUTLINE_MAX_MS } from '../../../src/net/eliteGates/egShape.js';
import { egUnionHolds, egZoneLandings, egFloorLess } from '../../../src/net/eliteGates/egFloor.js';
import { egFightView } from '../../../src/net/eliteGates/egWalkGraph.js';
import { egFromFront, egFromBehind, egLegionRaise, egLegionStep, EG_KIND } from '../../../src/net/eliteGates/egLegion.js';
import { egFeatBits } from '../../../src/net/eliteGates/egFeats.js';

import { HIT_KINDS, dpsRef, PHASE_AT } from '../../../src/net/gate/gateBrain.js';
import { gateAspectOf } from '../../../src/net/gate/gateMods.js';
import { validEgOut, EG_YAW_WIRE_MAX, EG_OUTLINE_WIRE_MAX } from '../../../src/net/wire.js';
import { foldEg, EG_STATE_EMPTY } from '../../../src/net/eliteGates/egLink.js';
import { egChainMates } from '../../../src/scenes/eliteGates/egFight.js';
import { judgeShapes } from '../../../src/net/bossRef.js';
import { egGive8Hall } from '../../egGive8.mjs';

// PIN MOVED (THE ASCENT - THE ROOMS, LAW 9 - 2026-10-16): these pins were written on spec law 8's ground (its courts and its
// lords, its courses along +z from the plate, where law 8 lays them) and stand on it still - a finder scans law 8's halls by
// name, and a breach stands in a circle given at law 8 as a breach of law 8's is given to a client (test/egGive8.mjs
// egGive8Hall); LAW 9's own ground is test/net/eliteGates/law9_height.test.js's and test/net/eliteGates/law9_rooms.test.js's

const T0 = 1_800_000_000_000;
const SITE = { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 };
const LINE = { depth: 1, perS: 0.05 };
const MIN = 60_000;
const seeded = (seed) => { let s = seed; return () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; }; };
/** The first hall of a seed (from `from`) whose spec passes `ok` - `[seed, h, spec]`. */
function hallWhere(ok, { seeds = 400, from = 1, to = 200, step = 1 } = {}) {
  for (let seed = 1; seed <= seeds; seed++) for (let h = from; h <= to; h += step) { const s = egHallOf(seed, h, 0, 8); if (ok(s)) return [seed, h, s]; }
  throw new Error('no hall found');
}
/** A lord's fight stood and woken as the director stands it, `n` members at level 40; `step(here)` beats it in the director's
 *  order (the lords, then the blows' words), every frame kept, the words said counted. */
function court(seed, h, key, { n = 2, rng = seeded(seed), decrees = {} } = {}) {
  const spec = egGive8Hall(seed, h, 0);
  const subs = Array.from({ length: n }, (_, i) => `acct-${i}`);
  const F = egFightNew(spec, T0, subs.map(() => 40), subs), frames = [], view = egFightView(spec), said = {};
  egLordsNew(F, spec, key, T0, frames, { decrees, n });
  egLordsWake(F, spec, T0, frames, { n });
  let now = T0;
  const step = (here, ctx = {}) => {
    now += 250;
    const out = [];
    egLordsStep(F, spec, now, here, rng, out, { decrees, n, ...ctx });
    egBlowsStep(F, view, now, here, out);
    for (const f of out) if (f.k === 'esay') said[f.w] = (said[f.w] ?? 0) + 1;
    frames.push(...out);
    return out;
  };
  return { spec, F, L: egLordsOf(F)[0], subs, frames, said, step, now: () => now, view, f: spec.fl?.find((q) => q.t === 'd') ?? { x: 0, z: 0, r: 18 } };
}
/**
 * A breach of `n` at hall `h` of `seed` (its Proclamation cleared), woken with the company on the arrival plate: `at` stands a
 * member (the hall's frame), `step` beats the room as the room does - THE CENSUS over each member's trail first (egCount, its
 * trail the poses this test stood it at), then the director (egStep) - its frames kept; `blow` strikes a body from where a member
 * stands.
 */
function breachAt(seed, h, { n = 1, strata = [], tide = null, dc = [], wake = true, census = true } = {}) {
  const rng = seeded(seed);
  const co = Array.from({ length: n }, (_, i) => [`acct-${i}`, `M${i}`, i + 1]);
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'M0', ew: 0, rh: 0, seed, op: T0, co, site: SITE, wg: [] });
  B.pr = '';
  let now = T0 + EG_SEALED_MS + 100;
  for (const [sub] of co) egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 40, now);
  B.strata = [...strata]; B.tide = tide; B.dc = dc;
  const spec = egGive8Hall(seed, h, 0);
  B.h = h; B.sg = 'arrive'; B.wk = now; B.cnt = { left: 30 * MIN, at: now }; B.pulledAt = now; B.su = now + 30_000;
  const pos = Object.fromEntries(co.map(([sub], i) => [sub, { sx: spec.x0 + spec.arrive.x + i * 0.5, z: spec.arrive.z }]));
  const trails = Object.fromEntries(co.map(([sub]) => [sub, []])), frames = [];
  const step = (ms = 250) => {
    now += ms;
    if (census && B.sg === 'trial') {
      for (const [sub] of co) { trails[sub].push([now, pos[sub].sx - spec.x0, 0, pos[sub].z, B.h]); if (trails[sub].length > 64) trails[sub].shift(); }
      frames.push(...egCount(B, now, co.map(([sub]) => ({ sub, tr: trails[sub] })), LINE, false));
    }
    const o = egStep(B, now, co.map(([sub]) => ({ sub, ...pos[sub], dead: false, at: now })), rng);
    frames.push(...o);
    return o;
  };
  const at = (sub, x, z) => { pos[sub] = { sx: spec.x0 + x, z }; };
  const blow = (sub, i, d, r, [x, z], q, y = 0) => { now += 50; return egBlow(B, sub, { k: 'hit', i, q, d, r }, { sx: spec.x0 + x, y, z }, now); };
  for (let k = 0; k < 120 && wake && B.sg !== 'trial'; k++) step();
  if (wake) assert.equal(B.sg, 'trial', `hall ${h} woke`);
  return { B, spec, pos, frames, step, at, blow, subs: co.map(([sub]) => sub), now: () => now, here: () => co.map(([sub]) => ({ sub, x: pos[sub].sx - spec.x0, z: pos[sub].z })) };
}
/** The Court's lords woken by the company standing in its wake ring. */
function wakeCourt(S) {
  for (const sub of S.subs) S.at(sub, S.spec.ring.x, S.spec.ring.z);
  for (let k = 0; k < 40 && !egLordsAwake(S.B.F); k++) S.step();
  assert.ok(egLordsAwake(S.B.F), 'the lords woke');
}
let q = 1;
/** A blow of `d` on body `L` by `sub` from beside it (the hall's frame), its ward lifted when `unward`. */
function strike(S, L, sub, d, { unward = false } = {}) {
  if (unward) { L.ward = 0; L.fl &= ~EG_FL.ward; }
  const pose = [L.x + 1.5, L.z];
  S.at(sub, ...pose);
  return S.blow(sub, L.i, d, HIT_KINDS.Shaft, pose, q++);
}
/** A lord felled where it stands by a member's arrow from beside it (its ward lifted). */
function fellLord(S, L, sub = 'acct-0') { L.hp = 1; return strike(S, L, sub, 500, { unward: true }); }
const words = (frames, from = 0) => frames.slice(from).filter((f) => f.k === 'esay').map((f) => f.w);
const wFt = (S) => S.B.owe.filter((o) => o.claims.q === 'w').map((o) => [o.claims.lk, o.claims.ft]);

// ── L1-1: A DUEL IS ITS LORD'S ────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L1-1 THE CLAN MUSTER BESIDE THE OLD MASTERS (sections 13.2, 13.4 and 18): Garoth at an even Redoubt with the Last Armsmaster beside him - his duel is called at his turn and is his alone: the Armsmaster\'s kit never ends it the beat it rises, a challenged member\'s blows on the Armsmaster count nothing to it, the Armsmaster\'s fall leaves it standing; it ends by its own clock and frees his held line; the Armsmaster\'s ring standing when Garoth\'s duel falls due holds Garoth warded until his is called, and falls with its lord; both felled within the window, the Court is won (mutants: the duel ownerless; the tally any lord\'s; a fall ending another\'s duel; no ward while it waits; a fallen lord\'s ring left standing)', () => {
  // the duel called and ended by Garoth alone
  const S = breachAt(7, 150, { n: 2, strata: ['oldmasters'] });
  wakeCourt(S);
  const F = S.B.F, ls = egLordsOf(F), G = ls.find((x) => x.key === 'garoth'), A = ls.find((x) => x.key === 'armsmaster');
  assert.ok(G && A, 'Garoth and the Last Armsmaster');
  G.hp = Math.floor(G.max * 0.65);
  const f0 = S.frames.length, o = S.step();
  assert.deepEqual([G.ph, words(o).includes('challenge'), words(o).includes('challengewon'), words(o).includes('challengeend')], [2, true, false, false], 'his turn: a duel called, never ended in the beat it rose');
  const ch = F.mem.challenge;
  assert.ok(ch && ch.by === G.i && G.hpFloor > 0, 'his own, his next threshold held');
  const [sub] = ch.subs, out = [];
  egLordHit(F, S.spec, A, sub, 'M', G.max, { x: A.x + 1, z: A.z }, S.now(), S.here(), out);   // a tenth of Garoth's health and more, on the Armsmaster
  assert.ok(F.mem.challenge === ch && ch.dealt === 0, 'the challenged member\'s blows on another lord count nothing to his duel');
  A.hp = 0;   // the purse took the last of it (net/eliteGates/egBodies.js egHitBody): the lord's law sees the fall
  egLordHit(F, S.spec, A, 'acct-0', 'M', 5, { x: A.x + 1, z: A.z }, S.now(), S.here(), out);
  assert.ok(!(A.hp > 0) && F.mem.challenge === ch, 'the Armsmaster felled: Garoth\'s duel stands');
  const fell = S.now();
  while (F.mem.challenge) S.step();
  assert.equal(S.now() - (ch.until - 15_000) <= 15_250, true, 'it ends by its own 15 s');
  assert.deepEqual([words(S.frames, f0).filter((w) => /^challenge/.test(w)), G.hpFloor], [['challenge', 'challengeend'], null], 'lasted: its end said once, his line free');
  assert.ok(S.now() - fell <= 15_000, 'inside the pair\'s window');
  fellLord(S, G);
  S.step();
  assert.ok(egLordsFell(F), 'both fallen within the window: the Court is won');
  // the Armsmaster's ring standing when Garoth's duel falls due
  const T = breachAt(7, 150, { n: 2, strata: ['oldmasters'] });
  wakeCourt(T);
  const TF = T.B.F, TG = egLordsOf(TF).find((x) => x.key === 'garoth'), TA = egLordsOf(TF).find((x) => x.key === 'armsmaster');
  for (let k = 0; k < 4 * 20 && !TF.mem.challenge; k++) T.step();
  assert.equal(TF.mem.challenge?.by, TA.i, 'the Armsmaster\'s Challenge, 15 s after the wake');
  TG.hp = Math.floor(TG.max * 0.65);
  T.step();
  assert.equal(TG.ph, 2, 'Garoth turns');
  for (let k = 0; k < 16; k++) T.step();   // past his turn's 3 s shield
  assert.equal(TF.mem.challenge?.by, TA.i, 'the Armsmaster\'s ring still stands');
  assert.equal(egLordHitX(TF, TG, 'acct-0', { x: TG.x + 1, z: TG.z }, HIT_KINDS.Melee, T.now()), 0, 'Garoth warded while his duel waits to be called');
  fellLord(T, TA);
  assert.equal(TF.mem.challenge, null, 'the Armsmaster felled: his ring falls with him');
  T.step();
  assert.equal(TF.mem.challenge?.by, TG.i, 'and Garoth\'s duel is called');
});

// ── L1-2, L1-3: A LORD'S OWN ASPECT; THE MARKYNAZ'S DECREE FOLDED ──────────────────────────────────────────────────────
/** Every elemental blow each lord of a breach's Court threw over `secs` with a member just outside each lord's body: by
 *  `key:pt`, the set of `name|element`. */
function thrown(S, secs) {
  const ls = egLordsOf(S.B.F).filter((L) => !egHas(L, EG_FL.mirror)), by = {};
  for (let k = 0; k < 4 * secs; k++) {
    S.subs.forEach((sub, j) => { const L = ls[j % ls.length]; S.at(sub, L.x + L.r + 1.5, L.z); });
    for (const f of S.step()) if (f.k === 'eb' && f.el) { const L = ls.find((x) => x.i === f.o); if (L) (by[`${L.key}:${L.pt}`] ??= new Set()).add(`${f.nm}|${f.el}`); }
  }
  return Object.fromEntries(Object.entries(by).map(([k, v]) => [k, [...v].sort()]));
}
test('AUDIT EG V L1-2 EACH LORD ITS OWN ASPECT (sections 13.3 and 13.4: "the Twin Lords keep their clans\' fire and frost"): THE TWIN COURT\'s second stood beside Garoth at Redoubt 25 leaves him Rime-Wrought - every element he throws frost - while the Cairn-Keeper beside him burns, re-aspected to the Wellhead; the Twin Lords under THE OLD MASTERS keep fire and frost while the Spellmaster beside them burns (mutants: the aspect the fight\'s, the last lord\'s overwriting; the twins re-aspected)', () => {
  const S = breachAt(7, 125, { n: 2, strata: ['twincourt'] });
  wakeCourt(S);
  const [G, K] = egLordsOf(S.B.F);
  assert.deepEqual([G.key, G.asp, K.key, K.asp], ['garoth', 'rime', 'cairnkeeper', egLordAspect('cairnkeeper', S.spec.c).id], 'each its own aspect');
  assert.equal(K.asp, 'burning');
  const by = thrown(S, 60), frost = gateAspectOf('rime').el, fire = gateAspectOf('burning').el;
  assert.ok(by['garoth:0']?.length && by['garoth:0'].every((x) => x.endsWith(`|${frost}`)), `Garoth's every element frost (${by['garoth:0']})`);
  assert.ok(by['cairnkeeper:0']?.length && by['cairnkeeper:0'].every((x) => x.endsWith(`|${fire}`)), `the Cairn-Keeper's fire (${by['cairnkeeper:0']})`);
  const T = breachAt(1, 215, { n: 3, strata: ['oldmasters'] });
  wakeCourt(T);
  assert.deepEqual(egLordsOf(T.B.F).map((L) => [L.key, L.asp ?? null]), [['twins', null], ['twins', null], ['spellmaster', 'burning']]);
  const tb = thrown(T, 40);
  assert.ok(tb['twins:0']?.length && tb['twins:0'].every((x) => x.endsWith('|fire')), `Vael's fire (${tb['twins:0']})`);
  assert.ok(tb['twins:1']?.length && tb['twins:1'].every((x) => x.endsWith('|frost')), `Isk's frost (${tb['twins:1']})`);
});
test('AUDIT EG V L1-3 THE GRAND DUKE\'S DECREE FOLDED, NEVER ERASED (section 8.5: "It folds with the circle\'s lord decrees through the fight\'s profile ... never in their place"): Clan Feud\'s Markynaz beside the Wellhead Wyrm lays Unyielding on the fight; a Twin Court second stood after him keeps it in the one law - ward x2, blows on it x0.85 - as it stands alone (mutants: the law written fresh for each lord)', () => {
  const lawOf = (strata) => { const S = breachAt(1, 105, { n: 2, strata, tide: 'feud' }); return [egLordsOf(S.B.F).map((L) => L.key), egLordsOf(S.B.F).find((L) => L.key === 'markynaz')?.decree, S.B.F.mem.law]; };
  const [k0, d0, law0] = lawOf([]), [k1, d1, law1] = lawOf(['twincourt']);
  assert.deepEqual([k0, d0], [['wyrm', 'markynaz'], 'unyielding']);
  assert.deepEqual([k1, d1], [['wyrm', 'markynaz', 'hound'], 'unyielding'], 'a second lord stood after him');
  assert.deepEqual([law0.shieldX, law0.hitX, law1.shieldX, law1.hitX], [2, 0.85, 2, 0.85], 'his decree in the fight\'s one law, the second stood or not');
  assert.deepEqual(law1, law0);
});

// ── L1-4, L1-5, L1-6, L1-16: THE SIGNATURES ON THEIR OWN LORD ───────────────────────────────────────────────────────────
/** Turn lord `L` to its phase at `frac` of its health (the next beats run its turn). */
const turnTo = (S, L, frac) => { L.hp = Math.floor(L.max * frac); for (let k = 0; k < 16; k++) S.step(); };
test('AUDIT EG V L1-4 HEARTS STILLED IS THE COLOSSUS\'S OWN BREAKDOWN (section 19: "into its Breakdown with no heart relit"): under THE OLD MASTERS the master beside it turns to its third phase while the Colossus is felled from its second - no signature; felled from its own Breakdown, the signature (mutants: any lord\'s phase words counted)', () => {
  const run = (deep) => {
    const S = breachAt(1, 130, { n: 2, strata: ['oldmasters'] });
    wakeCourt(S);
    const ls = egLordsOf(S.B.F), C = ls.find((x) => x.key === 'colossus'), M = ls.find((x) => x.key !== 'colossus');
    turnTo(S, M, 0.6); turnTo(S, M, 0.3);
    turnTo(S, C, 0.6); if (deep) turnTo(S, C, 0.3);
    assert.deepEqual([M.ph, C.ph], [3, deep ? 3 : 2]);
    fellLord(S, M); fellLord(S, C); S.step();
    return wFt(S);
  };
  assert.deepEqual(run(false), [['colossus', 3]], 'felled from its second phase: Unbroken and Swift, never Hearts Stilled');
  assert.deepEqual(run(true), [['colossus', 7]], 'felled from its own Breakdown: its signature');
});
test('AUDIT EG V L1-5 NO GROUND CONCEDED COUNTS HER BANNERS (section 19: "three of her banners broken"): three Wellhead Sparks broken under their decree, every banner standing - no signature; three banners broken - the signature (mutants: every broken object counted)', () => {
  const run = (kind) => {
    const S = breachAt(7, 25, { n: 2, dc: [[EG_DECREE_BY_KEY.sparks.id, 1]] });
    assert.equal(S.spec.lord, 'ilthys');
    wakeCourt(S);
    const I = egLordsOf(S.B.F)[0];
    if (kind === 'banner') I.hp = I.max * 0.6;   // EG-PERFECT (PIN MOVED): the Conquest is her second phase's - turned at 0.66 (the Sparks' run fights her first, no banner stood)
    let broken = 0;
    for (let k = 0; k < 4 * 90 && broken < 3; k++) {
      S.step();
      for (const o of egObjsOf(S.B.F, kind)) { if (broken >= 3) break; o.hp = 1; S.at('acct-0', o.x + 1, o.z); S.blow('acct-0', o.i, 50, HIT_KINDS.Melee, [o.x + 1, o.z], q++, o.y); if (!(o.hp > 0)) broken++; }   // a banner from its balcony
    }
    assert.equal(broken, 3, `three ${kind}s broken`);
    S.step();   // EG-PERFECT (PIN MOVED): the Conquest's round over at the next beat, her held line freed
    fellLord(S, I); S.step();
    return wFt(S);
  };
  assert.deepEqual(run('spark'), [['ilthys', 3]], 'three Sparks: no ground was hers to concede');
  assert.deepEqual(run('banner'), [['ilthys', 7]], 'three of her banners: the signature');
});
test('AUDIT EG V L1-6 TOGETHER IS THE TWINS\' OWN FALLS (section 19: "the Twin Lords falling within 3 s of each other"): under Clan Feud the twins fall 0.75 s apart and the Markynaz twenty seconds later - the signature; 3.5 s apart, none (mutants: the Redoubt\'s beat measured against the first fall)', () => {
  const run = (gap) => {
    const S = breachAt(1, 215, { n: 3, tide: 'feud' });
    wakeCourt(S);
    const ls = egLordsOf(S.B.F), [a, b] = ls.filter((x) => x.key === 'twins'), ch = ls.find((x) => x.champ);
    fellLord(S, a); for (let t = 0; t < gap; t += 250) S.step(); fellLord(S, b);
    for (let k = 0; k < 80; k++) S.step();
    fellLord(S, ch); S.step();
    return wFt(S);
  };
  assert.deepEqual(run(750), [['twins', 7]], 'the twins together, the champion last: Together');
  assert.deepEqual(run(3500), [['twins', 3]], 'three and a half seconds apart: not together');
});
test('AUDIT EG V L1-16 EVERY CHALLENGE MET BY A COMPANY OF ONE (sections 13.2, "a party of one is a company", and 13.3, "n = 1: no ring; he duels in the open"): alone with the Last Armsmaster, his Challenge is the open duel - the member marked, no ring, no braziers, the lord unmoved - met by a tenth of his health dealt within its 15 s; two met and he is felled: his signature (mutants: no Challenge at n = 1; a ring or braziers at n = 1; the open duel ended by its missing braziers)', () => {
  const S = breachAt(1, 10, { n: 1 });
  assert.equal(S.spec.lord, 'armsmaster');
  wakeCourt(S);
  const F = S.B.F, A = egLordsOf(F)[0];
  let met = 0;
  for (let round = 0; round < 2; round++) {
    for (let k = 0; k < 4 * 45 && !F.mem.challenge; k++) S.step();
    const ch = F.mem.challenge, at = [A.x, A.z];
    assert.ok(ch && ch.subs[0] === 'acct-0', `Challenge ${round + 1}: the lone member marked`);
    assert.deepEqual([F.pg.ring ?? null, egObjsOf(F, 'brazier').length, [A.x, A.z]], [null, 0, at], 'no ring, no braziers, the lord where he stood');
    const f0 = S.frames.length;
    S.step();
    assert.ok(F.mem.challenge === ch, 'it stands with no braziers to break');
    const hp0 = A.hp;
    for (let k = 0; k < 4 * 14 && F.mem.challenge; k++) { S.frames.push(...(strike(S, A, 'acct-0', 3 * dpsRef(40), { unward: true }) ?? [])); S.step(); }
    assert.ok(!F.mem.challenge && words(S.frames, f0).includes('challengewon') && hp0 - A.hp >= A.max / 10, 'a tenth of his health dealt inside its 15 s: met');
    met++;
  }
  assert.equal(met, 2);
  fellLord(S, A); S.step();
  assert.deepEqual(wFt(S), [['armsmaster', 7]], 'two Challenges met: Every Challenge Met, alone');
});

// ── L1-7: THE KYNREEVE'S FACING ON THE WIRE ────────────────────────────────────────────────────────────────────────────
const wire = (f) => { const { to: _to, ...rest } = f; const v = validEgOut(JSON.parse(JSON.stringify(rest))); assert.ok(v, `the wire refuses ${f.k}`); return v; };
test('AUDIT EG V L1-7 THE SHIELD-WALL ON THE FACING EVERY SCREEN DRAWS (sections 8.5, "he turns to the top of threat, so one member holds him while the others flank", and 21): the Kynreeve turned to his target says it - a body\'s row and each walk carry its facing (`yw`) - so the screen that heard the room holds him facing the way the relay judges a flank by: from the front it draws, a blow x0.25; from behind, x1.3 (mutants: the turn unsaid; the facing off the row; the walk\'s facing unread)', () => {
  const [seed, h, spec] = hallWhere((s) => s.kind === 'proving' && s.champ === 'kynreeve');
  const S = breachAt(seed, h, { n: 2 }), F = S.B.F, K = egLordsOf(F)[0];
  assert.equal(K.key, 'kynreeve');
  const ring = champRing(spec);
  for (const sub of S.subs) S.at(sub, ring.x, ring.z);
  for (let k = 0; k < 40 && !K.up2; k++) S.step();
  assert.ok(K.up2, 'he wakes');
  // the screen that held him facing pi, then heard every word since
  let J = foldEg(EG_STATE_EMPTY, wire(egStateOf(S.B, S.now())), S.now());
  const fs0 = egFightState(F, S.now());
  J = foldEg(J, wire({ ...fs0, b: fs0.b.map((t) => [...t.slice(0, 18), Math.PI]) }), S.now());
  const f0 = S.frames.length;
  // members off his side - he turns to one as he strikes
  S.at('acct-0', K.x + K.r + 3, K.z + 1); S.at('acct-1', K.x + K.r + 3, K.z - 1);
  for (let k = 0; k < 4 * 12 && !S.frames.slice(f0).some((f) => f.k === 'eb' && f.o === K.i); k++) S.step();
  assert.ok(S.frames.slice(f0).some((f) => f.k === 'eb' && f.o === K.i), 'he struck');
  assert.ok(Math.abs(K.yaw - Math.PI) > 0.5, `he turned (${K.yaw})`);
  const seen = (E) => E.fight.bodies.find((b) => b.i === K.i);
  for (const f of S.frames.slice(f0)) if (f.k === 'emv') J = foldEg(J, wire(f), S.now());
  assert.equal(seen(J).yaw, egYawOf(K), 'the turn said as a walk: the screen holds his facing');
  let E = foldEg(EG_STATE_EMPTY, wire(egStateOf(S.B, S.now())), S.now());
  E = foldEg(E, wire(egFightState(F, S.now())), S.now());
  assert.equal(seen(E).yaw, egYawOf(K), 'and the whole fight says it (a joiner\'s)');
  // a blow from where the screen draws his front, and from where it draws his back
  const y = seen(J).yaw, front = { x: K.x + Math.sin(y) * 2, z: K.z + Math.cos(y) * 2 }, back = { x: K.x - Math.sin(y) * 2, z: K.z - Math.cos(y) * 2 };
  const plain = egLordHitX(F, K, 'acct-0', null, HIT_KINDS.Melee, S.now());
  assert.ok(plain > 0);
  assert.deepEqual([egLordHitX(F, K, 'acct-0', front, HIT_KINDS.Melee, S.now()), egLordHitX(F, K, 'acct-0', back, HIT_KINDS.Melee, S.now())], [plain * 0.25, plain * 1.3], 'his Shield-Wall on the facing drawn');
  // every walk and stand says it: a place, a walk's own way, a stop
  egPlace(F, K, K.x, K.z, S.now());
  assert.equal(F.moves.at(-1)[9], egYawOf(K), 'a place says its facing');
  egWalk(F, K, K.x + 5, K.z, 0, 3, S.now(), S.spec);
  const w = F.moves.at(-1);
  assert.deepEqual([w[9], egYawOf(K)], [Math.round(Math.atan2(5, 0) * 100) / 100, Math.round(Math.atan2(5, 0) * 100) / 100], 'a walk faces its way');
  egStop(F, K, S.now());
  assert.equal(F.moves.at(-1)[9], egYawOf(K), 'a stop says its facing');
  assert.equal(validEgOut({ k: 'emv', m: [[...w.slice(0, 9), EG_YAW_WIRE_MAX + 1]] }), null, 'a walk\'s facing past its bound');
  // the wire's bounds
  const row = egBodyWire(K);
  assert.equal(row.length, 19);
  assert.ok(validEgOut({ k: 'ead', a: [row], at: S.now() }));
  for (const bad of [EG_YAW_WIRE_MAX + 0.01, -EG_YAW_WIRE_MAX - 0.01, NaN, '1']) assert.equal(validEgOut({ k: 'ead', a: [[...row.slice(0, 18), bad]], at: S.now() }), null, `a facing of ${bad}`);
  assert.equal(EG_YAW_WIRE_MAX, 7);
});

// ── L1-8, L1-15: MORVAYN'S CHAINS ──────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L1-8 A FALLEN MEMBER UNCHAINED (section 13.4, the Chaining: "a blow on one is shared with the other"): four members bound in two pairs, one falls - its chain and its tether drop at the fall (the seam\'s join), and the census and the struck screen count the same part of a blow on its survivor: the whole; a chain of three that loses its first member is re-linked between the two left, each half; a mate the census does not hold counted none, the struck its own part; an odd member\'s Wraith link gone with its fall (mutants: the chain kept past the fall; the tether kept; the three left unlinked; the census\'s mates by the living alone)', () => {
  const S = breachAt(7, 50, { n: 4 });
  wakeCourt(S);
  const F = S.B.F, M = egLordsOf(F)[0];
  assert.equal(M.key, 'morvayn');
  M.hp = M.max * 0.6;   // EG-PERFECT (PIN MOVED): the Chaining is her second phase's - turned at 0.66
  for (let k = 0; k < 4 * 20 && !(F.mem.chains ?? []).length; k++) S.step();
  assert.equal(F.mem.chains.length, 2, 'two pairs');
  const [[a, b], [c, d]] = F.mem.chains;
  const f0 = S.frames.length;
  egFall(S.B, b, S.now(), S.frames);
  S.step();
  assert.deepEqual(F.mem.chains, [[c, d]], 'its chain gone with it');
  assert.deepEqual(F.tethers.filter((t) => t[2] === 2), [[c, d, 2, 800]], 'and its tether');
  const tx = S.frames.slice(f0).filter((f) => f.k === 'etx').at(-1);
  assert.ok(tx && !tx.t.some((t) => t.includes(b)), 'said to every screen');
  assert.ok(!F.marks.some((m) => m[1] === 4 && (m[0] === a || m[0] === b)), 'neither the fallen nor its mate marked chained');
  /** A 0.4 blow of Morvayn's landed on `sub` alone, counted by the census over the trails of `live`: each member's thousandths. */
  const census = (sub, live) => {
    F.blows.length = 0; F.pend = []; F.held = [];
    const at = S.now() + 10_000, p = S.pos[sub], x = p.sx - S.spec.x0;
    assert.ok(egAim(F, S.spec, { o: M.i, s: [shDisc(x, p.z, 2)], at, wu: 1500, p: 0.4, b: 0, el: null, nm: 'Test Blow' }, [], at - 1500, []));
    const cs0 = Object.fromEntries(S.subs.map((s) => [s, S.B.mem[s].cs?.[3] ?? 0]));
    const bodies = live.map((s) => ({ sub: s, tr: [at - 1200, at - 800, at - 400, at + 100].map((t) => [t, S.pos[s].sx - S.spec.x0, 0, S.pos[s].z, S.B.h]) }));
    egCount(S.B, at + 900, bodies, LINE, false);
    return Object.fromEntries(S.subs.map((s) => [s, (S.B.mem[s].cs?.[3] ?? 0) - cs0[s]]));
  };
  const cr = S.spec.fl.find((f) => f.t === 'd');
  S.subs.forEach((s, j) => S.at(s, cr.x - 6 + 4 * j, cr.z));   // apart, on a crypt's floor
  const screen = (sub) => 400 / (egChainMates(F.tethers.map((t) => [...t]), sub).length + 1);
  assert.deepEqual([census(a, [a, c, d])[a], screen(a)], [400, 400], 'the fallen\'s mate: the whole, by the census and by its screen');
  assert.deepEqual([census(c, [a, c, d])[c], screen(c)], [200, 200], 'a pair standing: halves');
  assert.deepEqual(census(c, [a, c]), { [a]: 0, [b]: 0, [c]: 200, [d]: 0 }, 'a mate the census does not hold: none of its part, the struck its own');
  // a chain of three (the Last Rites') that loses its first member: the two left re-linked
  F.mem.chains = [[a, c, d]]; F.tethers = [...F.tethers.filter((t) => t[2] !== 2), [a, c, 2, 800], [a, d, 2, 800]];
  egFall(S.B, a, S.now(), S.frames);
  S.step();
  assert.deepEqual([F.mem.chains, F.tethers.filter((t) => t[2] === 2)], [[[c, d]], [[c, d, 2, 800]]], 'its first fallen: the three\'s two left chained to each other');
  assert.deepEqual([census(d, [c, d])[d], screen(d)], [200, 200]);
  // an odd member chained to a Wraith falls: its link goes with it
  const T = breachAt(7, 50, { n: 3 });
  wakeCourt(T);
  for (const L of egLordsOf(T.B.F)) L.hp = L.max * 0.6;   // EG-PERFECT (PIN MOVED): the Chaining is her second phase's
  for (let k = 0; k < 4 * 20 && !(T.B.F.mem.chains ?? []).length; k++) T.step();
  const odd = T.subs.find((x) => !T.B.F.mem.chains.flat().includes(x));
  assert.ok(T.B.F.tethers.some((t) => t[2] === 2 && typeof t[0] === 'number' && t[1] === odd), 'the odd member chained to a Wraith');
  egFall(T.B, odd, T.now(), T.frames);
  assert.ok(!T.B.F.tethers.some((t) => t[1] === odd || t[0] === odd), 'fallen: its Wraith\'s link gone');
});
test('AUDIT EG V L1-15 EACH LINK ITS OWN SNAP (section 13.4: "A pair stretched past 8 m both take 30% (a CHECK)"): two pairs held 12 m apart for 6 s - each snaps every 3 s on its own clock, neither keeping the other from its CHECK (mutants: one clock for every chain)', () => {
  const C = court(7, 50, 'morvayn', { n: 4 });
  C.L.hp = C.L.max * 0.6;   // EG-PERFECT (PIN MOVED): the Chaining is her second phase's - turned at 0.66
  const here = C.subs.map((sub, j) => ({ sub, x: C.f.x + (j % 2 ? 6 : -6), z: C.f.z + (j < 2 ? 4 : -4) }));
  for (let k = 0; k < 4 * 20 && !(C.F.mem.chains ?? []).length; k++) C.step(here);
  const chains = C.F.mem.chains;
  assert.equal(chains.length, 2);
  const at = Object.fromEntries(chains.map((c) => [c.join('|'), c]));
  for (const h of here) { const c = chains.find((q) => q.includes(h.sub)), j = c.indexOf(h.sub); h.x = C.f.x + (j ? 6 : -6); h.z = C.f.z + (c === chains[0] ? 4 : -4); }
  const f0 = C.frames.length;
  for (let k = 0; k < 24; k++) C.step(here);
  const snaps = C.frames.slice(f0).filter((f) => f.k === 'eb' && f.nm === 'The Chain Snaps').map((f) => f.on.join('|'));
  for (const key of Object.keys(at)) assert.equal(snaps.filter((s) => s === key).length, 2, `the pair ${key} snaps twice in 6 s`);
});

// ── L1-9: A NAMED FAILURE BLOW COUNTED ON WHOM IT NAMES ────────────────────────────────────────────────────────────────
test('AUDIT EG V L1-9 THE CHAIN SNAPS COUNTED ON THE PAIR IT NAMES, BY THE CENSUS (section 13.2\'s CHECK class: "lands on them wherever they stand, never on another"): three members, a pair chained by Morvayn\'s own tick stretched 12 m - its snap (`on` the pair) said; the pair runs 6 m clear before it lands and the odd member steps into its marks: the director\'s census (egCount over the trails) counts the snap on each of the pair and never on the odd member (mutants: the census by the marks - egInBlow for a named blow; a named member counted off its trail)', () => {
  const S = breachAt(7, 50, { n: 3 });
  wakeCourt(S);
  const F = S.B.F, cr = S.spec.fl.find((f) => f.t === 'd');
  for (const M of egLordsOf(F)) M.hp = M.max * 0.6;   // EG-PERFECT (PIN MOVED): the Chaining is her second phase's - turned at 0.66
  S.subs.forEach((s, j) => S.at(s, cr.x - 2 + 2 * j, cr.z));
  for (let k = 0; k < 4 * 20 && !(F.mem.chains ?? []).length; k++) S.step();
  const [pa, pb] = F.mem.chains[0], odd = S.subs.find((s) => s !== pa && s !== pb);
  F.tethers = F.tethers.filter((t) => t[2] !== 2 || typeof t[0] === 'string');   // EG-PERFECT: the odd member's Wraith chain let go - it snaps on its own member (egperfect_lords #15), never in this pin's census
  S.at(pa, cr.x - 6, cr.z); S.at(pb, cr.x + 6, cr.z); S.at(odd, cr.x, cr.z - 9);
  let snap = null;
  for (let k = 0; k < 12 && !snap; k++) snap = S.step().find((f) => f.k === 'eb' && f.nm === 'The Chain Snaps') ?? null;
  assert.ok(snap && [...snap.on].sort().join() === [pa, pb].sort().join(), 'the snap names the pair');
  const cs0 = Object.fromEntries(S.subs.map((s) => [s, S.B.mem[s].cs?.[0] ?? 0]));   // blows struck (the snap bears Morvayn's venom: seen, its share the member's own save)
  const [mx, mz] = [snap.s[0][1], snap.s[0][2]];
  S.at(pa, cr.x - 6, cr.z + 6); S.at(pb, cr.x + 6, cr.z + 6); S.at(odd, mx, mz);   // the pair clear of its marks, the odd member in one
  for (let k = 0; k < 8; k++) S.step();
  const got = Object.fromEntries(S.subs.map((s) => [s, (S.B.mem[s].cs?.[0] ?? 0) - cs0[s]]));
  assert.ok(got[pa] >= 1 && got[pb] >= 1, `the pair, wherever they ran (${JSON.stringify(got)})`);
  assert.equal(got[odd], 0, 'never the member standing in its marks it does not name');
  assert.ok((F.cg?.['The Chain Snaps'] ?? []).sort().join() === [pa, pb].sort().join(), 'its catch the pair\'s');
  // the time law kept: a named member with no pose sent near the landing is not counted
  const at = S.now() + 5000, b2 = egAim(F, S.spec, { o: snap.o, s: snap.s, at, wu: 400, p: 0.3, b: 0, el: null, nm: 'Test Snap', ch: 1, on: [pa, pb] }, [], at - 400, []);
  const tr = (s, dts) => ({ sub: s, tr: dts.map((dt) => [at + dt, S.pos[s].sx - S.spec.x0, 0, S.pos[s].z, S.B.h]) });
  const hits = judgeShapes(F, [tr(pa, [-3000, 3000]), tr(pb, [-100, 100]), tr(odd, [-100, 100])], at + 3100, egFightView(S.spec)).filter((x) => x.i === b2.i);
  assert.deepEqual(hits.map((x) => x.sub), [pb], 'the one whose pose stood near its landing, of those it names');
});

// ── L1-10: THE LORDS' PLACE IN THE UNION FLOOR ─────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L1-10 THE LORDS\' PLACE IN THE UNION FLOOR (section 13.2: "Pendulums, vents and the place\'s hazards are tested in the same set"): Grath\'s burning bridge and Ilthys\'s falling floor are the place\'s own, no CHECK - each a landing in the set; a fallen island (a void) is no ground to flee to - a blow that would leave a member on a bridge only the void is held; a told burn lands in the set at its onset; and a set its landings empty without the new blow holds nothing more (mutants: the bridge a CHECK again; the void ground; the zones out of the set; held whatever empties it)', () => {
  // the place's blows said as landings, never CHECKs, by the kits themselves
  const C = court(1, 5, 'hound', { n: 2 }), here = C.subs.map((sub, j) => ({ sub, x: C.f.x + 3 + j, z: C.f.z }));
  C.L.hp = C.L.max * 0.6;
  let bridge = null;
  for (let k = 0; k < 4 * 20 && !bridge; k++) bridge = C.step(here).find((f) => f.k === 'eb' && f.nm === 'Burning Bridge') ?? null;
  assert.ok(bridge && bridge.ch === 0 && bridge.sp === 12_000, 'the bridge burns, the place\'s own fire - no CHECK');
  const I = court(1, 25, 'ilthys', { n: 2 }), ih = I.subs.map((sub, j) => ({ sub, x: I.f.x + 3 + j, z: I.f.z }));
  I.L.hp = I.L.max * 0.3;
  let falls = null;
  for (let k = 0; k < 4 * 12 && !falls; k++) falls = I.step(ih).find((f) => f.k === 'eb' && f.nm === 'The Floor Falls') ?? null;
  assert.ok(falls && falls.ch === 0, 'the Last Charge\'s third: no CHECK');
  // a member mid-bridge between two islands; a disc over the whole bridge 3 s on
  const G = court(1, 5, 'hound', { n: 1 }), spec = G.spec, F = G.F, now = G.now();
  const br = spec.fl.find((f) => f.t === 'l'), isles = spec.fl.filter((f) => f.t === 'd');
  const mx = (br.ax + br.bx) / 2, mz = (br.az + br.bz) / 2, ends = isles.filter((d) => Math.hypot(d.x - br.ax, d.z - br.az) < d.r + 1 || Math.hypot(d.x - br.bx, d.z - br.bz) < d.r + 1);
  assert.equal(ends.length, 2, 'the bridge joins two islands');
  const me = [{ sub: 'acct-0', x: mx, z: mz }], disc = () => ({ o: G.L.i, s: [shDisc(mx, mz, 13)], at: G.now() + 3000, wu: 3000, p: 0.3, b: 0, el: null, nm: 'Test Slam' });
  F.blows.length = 0; F.held = []; F.zones = [];
  assert.ok(egAim(F, spec, disc(), me, now, []), 'both islands standing: there is ground to flee to - said');
  F.blows.length = 0; F.held = [];
  const out = [];
  for (const d of ends) zoneOut(F, 'void', shDisc(d.x, d.z, d.r), now - 1000, now + 15_000, out);
  assert.equal(egAim(F, spec, disc(), me, now, []), null, 'both its islands fallen: only the void beyond - held');
  assert.equal(F.held.length, 1);
  F.blows.length = 0; F.held = []; F.zones = [];
  for (const d of ends) zoneOut(F, 'void', shDisc(d.x, d.z, d.r), now + 1000, now + 16_000, out);
  assert.equal(egAim(F, spec, disc(), me, now, []), null, 'its islands falling before it lands (a crack told): held too');
  // both islands told to burn before it lands: their onsets in the set - only the bridge left, under the disc: held
  F.blows.length = 0; F.held = []; F.zones = [];
  for (const d of ends) zoneOut(F, 'burn', shDisc(d.x, d.z, d.r), now + 2500, now + 30_000, out);
  assert.equal(egAim(F, spec, disc(), me, now, []), null, 'its islands told to burn as it lands: held');
  // a told burn lands in the set at its onset; a court burning whole holds nothing more
  F.blows.length = 0; F.held = []; F.zones = [];
  const z = zoneOut(F, 'burn', shDisc(mx, mz, 40), now + 1500, now + 60_000, out);
  assert.deepEqual(egZoneLandings(F.zones, now, now + 3000).map((l) => [l.at, l.s[0]]), [[z.from, z.s]], 'its onset a landing in the window');
  assert.deepEqual(egZoneLandings(F.zones, now, now + 1000), [], 'none past the window');
  assert.ok(egAim(F, spec, { ...disc(), s: [shDisc(mx, mz, 2)] }, me, now, []), 'the whole floor burning at its onset: the new blow empties nothing more - said');
  const onFloor = (x, zz) => egOnFight(spec, x, zz);
  F.zones = [];
  zoneOut(F, 'void', shDisc(ends[0].x, ends[0].z, ends[0].r), now, now + 15_000, out);
  const less = egFloorLess(onFloor, F.zones, now, now + 3000);
  assert.deepEqual([onFloor(ends[0].x, ends[0].z), less(ends[0].x, ends[0].z), less(mx, mz)], [true, false, true], 'the fallen island no floor, the bridge floor');
  assert.equal(egFloorLess(onFloor, F.zones, now + 20_000, now + 23_000), onFloor, 'risen again: the floor whole');
});

// ── L1-11, L1-12: NOTHING OF AN ERRAND BEFORE ITS TIME ──────────────────────────────────────────────────────────────────
test('AUDIT EG V L1-11 THE CITADEL PLANTED AS HE WAKES (sections 8.5 and 8.6: "asleep, it takes no blow"): a Proving Walk\'s Kynmarcher stands no standard while he sleeps - nothing of his errand to break before his ring wakes him - and plants three as he wakes, each 20% off his blows (mutants: the standards stood with him)', () => {
  const [seed, h, spec] = hallWhere((s) => s.kind === 'proving' && s.champ === 'kynmarcher');
  const S = breachAt(seed, h, { n: 2 }), F = S.B.F, K = egLordsOf(F)[0];
  assert.equal(K.key, 'kynmarcher');
  for (let k = 0; k < 8; k++) S.step();
  assert.deepEqual([K.up2, egObjsOf(F, 'standard').length], [false, 0], 'asleep: no standard');
  const ring = champRing(spec);
  for (const sub of S.subs) S.at(sub, ring.x, ring.z);
  for (let k = 0; k < 40 && !K.up2; k++) S.step();
  assert.deepEqual([K.up2, egObjsOf(F, 'standard').length], [true, 3], 'awake: three planted');
  const plain = { ...K, key: 'kynreeve' };
  assert.ok(Math.abs(egLordHitX(F, K, 'acct-0', null, HIT_KINDS.Melee, S.now() + 4000) - egLordHitX(F, plain, 'acct-0', null, HIT_KINDS.Melee, S.now() + 4000) * 0.4) < 1e-9, 'three standing: x0.4');
});
test('AUDIT EG V L1-12 THE THREE SHADOWS READ ONLY BY THEIR GLINT (section 13.2, "Tells only the engine can give"; section 13.3: "the true one glints with its WIND"): in its second phase the Night-Stalker vanishes - three umbral discs said alike (no part, no state), its own row left where it vanished; EG_UMBRA_GLINT_MS before it rises the true one\'s state is said (1, its glint); it rises on it (mutants: the true disc\'s part said; its row set on it at once; no glint said; the glint said at once)', () => {
  const C = court(1, 55, 'stalker', { n: 2 }), here = C.subs.map((sub, j) => ({ sub, x: C.f.x + 3 + j, z: C.f.z }));
  C.L.hp = C.L.max * 0.6;
  let f0 = 0;
  for (let k = 0; k < 4 * 40; k++) { const n = C.frames.length; const o = C.step(here); if (o.some((f) => f.k === 'esay' && f.w === 'vanish') && C.L.ph === 2) { f0 = n; break; } }
  assert.ok(f0 > 0 && egHas(C.L, EG_FL.hidden), 'vanished in his second phase');
  const at = [C.L.x, C.L.z], rows = C.frames.slice(f0).filter((f) => f.k === 'ead').flatMap((f) => f.a).filter((t) => t[2] === 22);
  assert.equal(rows.length, 3, 'three umbral discs');
  assert.deepEqual(rows.map((t) => [t[3], t[15], t[16]]), [[0, 0, 0], [0, 0, 0], [0, 0, 0]], 'said alike: no part, no state');
  const umbras = egObjsOf(C.F, 'umbra'), real = umbras.find((u) => u.real);
  assert.ok(real && Math.hypot(at[0] - real.x, at[1] - real.z) > 0.01 || umbras.length === 3, 'its row where it vanished');
  assert.ok(!C.frames.slice(f0).some((f) => f.k === 'emv' && f.m.some((t) => t[0] === C.L.i && Math.hypot(t[1] - real.x, t[2] - real.z) < 0.01)), 'never set on the true disc while he hides');
  const t0 = C.now();
  let glint = null, still = true;
  while (!glint && C.now() < t0 + EG_UMBRA_MS) { glint = C.step(here).find((f) => f.k === 'eob' && f.st === 1) ?? null; still &&= C.L.x === at[0] && C.L.z === at[1]; }
  assert.ok(still && Math.hypot(at[0] - real.x, at[1] - real.z) > 0.01, 'every beat it hides, its row where it vanished - never on the true disc');
  assert.ok(glint && glint.i === real.i, 'the true one glints');
  assert.ok(glint.at - (t0 - 250) >= EG_UMBRA_MS - EG_UMBRA_GLINT_MS - 250, `${EG_UMBRA_GLINT_MS} ms before it rises, never sooner`);
  while (egHas(C.L, EG_FL.hidden) && C.now() < t0 + EG_UMBRA_MS + 1000) C.step(here);
  assert.ok(!egHas(C.L, EG_FL.hidden) && Math.hypot(C.L.x - real.x, C.L.z - real.z) < 0.01, 'it rises on it');
  assert.deepEqual([EG_UMBRA_MS, EG_UMBRA_GLINT_MS], [6000, 2000]);
});

// ── L1-17: TO THE FIGHT'S END ──────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L1-17 "FOR THE REST OF THE FIGHT" IS THE FIGHT\'S END (sections 13.3 and 13.4): Both Courts Burn and the Long Night stand EG_ZONE_FIGHT_MS (an hour), never ten minutes (mutants: 600 s kept)', () => {
  const T = court(1, 35, 'twins', { n: 4 }), th = T.subs.map((sub, j) => ({ sub, x: T.f.x + 3 + j, z: T.f.z }));
  for (const L of egLordsOf(T.F)) L.hp = L.max * 0.3;
  const o = T.step(th), burns = o.filter((f) => f.k === 'ez' && f.kind === 'burn');
  assert.equal(burns.length, 2, 'both courts');
  for (const z of burns) assert.equal(z.until - T.now(), EG_ZONE_FIGHT_MS);
  const S = court(1, 75, 'seyth', { n: 2 }), sh = S.subs.map((sub, j) => ({ sub, x: S.f.x + 3 + j, z: S.f.z }));
  S.L.hp = S.L.max * 0.3;
  const dark = S.step(sh).find((f) => f.k === 'edark');
  assert.equal(dark?.until - S.now(), EG_ZONE_FIGHT_MS, 'the Long Night');
  assert.equal(EG_ZONE_FIGHT_MS, 3_600_000);
});

// ── L1-18: A CHAINED SHAPE'S DIM OUTLINE ───────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L1-18 A CHAINED SHAPE\'S FILL STARTS WHEN THE FIRST LANDS (sections 13.2 and 14: "The second shape\'s dim outline appears with the first shape\'s ... its fill starts when the first lands"): Grath in fury\'s second step, alone - each chained shape is said with the first (its outline from the first\'s word, `ol`), its fill (`wu`) THE CHAINED GAP from the first\'s landing; the wire carries `ol` within its bound (mutants: the fill from the first\'s word; the outline\'s lead unsaid; the bound)', () => {
  const C = court(12345, 5, 'hound', { n: 1 });
  const pairs = [];
  for (let k = 0; k < 4 * 120 && pairs.length < 2; k++) {
    const o = C.step([{ sub: 'acct-0', x: C.L.x + C.L.r + 1, z: C.L.z }], { covenant: 1 });
    for (const f of o.filter((x) => x.k === 'eb' && x.nm.endsWith('(fury)'))) { const first = o.find((x) => x.k === 'eb' && x.o === f.o && `${x.nm} (fury)` === f.nm); if (first) pairs.push([first, f]); }   // said with the first, in its beat
  }
  assert.ok(pairs.length >= 1, 'fury\'s chain thrown');
  for (const [first, ch] of pairs) {
    assert.equal(ch.wu, egChainGapMs(first.wu, first.s), 'its fill the chained gap');
    assert.equal(ch.at - ch.wu, first.at, 'its fill from the first\'s landing');
    assert.equal(egBlowOutlineFrom(ch), first.at - first.wu, 'its dim outline from the first\'s word');
    assert.ok(validEgOut(JSON.parse(JSON.stringify(ch)))?.ol === ch.ol, 'the wire carries it');
  }
  assert.equal(EG_OUTLINE_MAX_MS, EG_OUTLINE_WIRE_MAX, 'one bound, pinned equal (wire.js imports no law of the Spire\'s)');
  const [, ch] = pairs[0];
  assert.equal(validEgOut({ ...JSON.parse(JSON.stringify(ch)), ol: EG_OUTLINE_WIRE_MAX + 1 }), null, 'past its bound');
});

// ── L1-23, L1-25, L1-29, L1-30: EACH LORD'S OWN ────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L1-23 PAIRED HEARTS IN THE COLOSSUS\'S OWN SECOND PHASE (section 13.3): THE TWIN COURT stands the Colossus second - a heart broken while the Court\'s lord has turned and the Colossus has not is no pair\'s break; in the Colossus\'s second phase it is (mutants: the first lord\'s phase read)', () => {
  const [seed, h] = hallWhere((s) => s.kind === 'court' && s.c >= 21 && s.lord !== 'colossus' && !EG_LORDS[s.lord]?.valk && egStrataSecond(['twincourt'], s.lord, s.c) === 'colossus', { from: 105, to: 600, step: 5, seeds: 40 });
  const S = breachAt(seed, h, { n: 2, strata: ['twincourt'] });
  assert.ok(S, 'a Twin Court with the Colossus second');
  wakeCourt(S);
  const F = S.B.F, [L0] = egLordsOf(F), Co = egLordsOf(F).find((L) => L.key === 'colossus');
  turnTo(S, L0, 0.6);
  assert.deepEqual([L0.ph, Co.ph], [2, 1]);
  const breakOne = () => { const hs = egObjsOf(F, 'heart'), hrt = hs.find((x) => hs.some((y) => y !== x && y.pair === x.pair)); egObjBroken(F, S.spec, hrt, 'M0', S.now(), []); return hrt.pair; };   // one of a pair standing whole
  const p1 = breakOne();
  assert.equal(F.mem.pairBroke?.[p1], undefined, 'the Court\'s lord turned, the Colossus not: no pair\'s break');
  turnTo(S, Co, 0.6);
  const p2 = breakOne();
  assert.ok(F.mem.pairBroke?.[p2] > 0, 'its own second phase: the pair\'s five seconds');
});
test('AUDIT EG V L1-25 THE TWINS\' TOUCH BY THE CENSUS\'S RECKONING AT THE LANDING (section 13.3: "A blow struck them when the relay\'s reckoning of the poses finds them in it as it lands (the census\'s)"): a Vael blow lands - the member the census finds in it at its landing (its last pose before and its first after, both in) is Fire-touched; one who steps in only as it lands, or out as it lands, is not, whatever the beat\'s poses say (mutants: the touch by the beat\'s poses)', () => {
  const S = breachAt(1, 35, { n: 3 });
  wakeCourt(S);
  const F = S.B.F, vael = egLordsOf(F).find((L) => L.key === 'twins' && L.pt === 0), cr = S.spec.fl.find((f) => f.t === 'd');
  const [inn, late, leaver] = S.subs, x = cr.x + 3, z = cr.z + 3;
  S.at(inn, x, z); S.at(late, x + 9, z); S.at(leaver, x + 1, z);
  F.blows.length = 0; F.pend = []; F.held = [];
  const at = S.now() + 1700;
  assert.ok(egAim(F, S.spec, { o: vael.i, s: [shDisc(x, z, 3)], at, wu: 1500, p: 0.3, b: 0, el: 'fire', nm: 'Clan Bolt' }, [], at - 1500, []));
  while (S.now() + 250 < at) S.step();
  S.at(late, x, z - 1); S.at(leaver, x + 9, z);   // as it lands: one steps in, one out
  for (let k = 0; k < 6; k++) S.step();
  const fire = (s) => !!F.marks.find((m) => m[0] === s && m[1] === 2 && m[2] === at + 12_000);
  assert.deepEqual([fire(inn), fire(late), fire(leaver)], [true, false, false], 'the touch where the census found them as it landed');
});
test('AUDIT EG V L1-29 EACH LORD COUNTS ITS OWN MIRRORS (section 18, THE OLD MASTERS): at Redoubt 25 Garoth\'s borrowed Mirrorcourt beside the Last Spellmaster - his two mirrors rise while the Spellmaster\'s images stand, and the Spellmaster\'s images while his mirrors stand, each its own and of its own lord\'s aspect (L1-2) (mutants: every mirror counted by both; a mirror\'s aspect not its lord\'s)', () => {
  const S = breachAt(7, 125, { n: 2, strata: ['oldmasters'] });
  wakeCourt(S);
  const F = S.B.F, G = egLordsOf(F).find((L) => L.key === 'garoth'), M = egLordsOf(F).find((L) => L.key === 'spellmaster');
  assert.ok(G && M, 'Garoth and the Last Spellmaster');
  G.hp = G.max * 0.3; M.hp = M.max * 0.7;
  const mine = (L) => egLordsOf(F).filter((x) => egHas(x, EG_FL.mirror) && x.by === L.i);
  let both = false;
  for (let k = 0; k < 4 * 90 && !both; k++) {
    S.subs.forEach((sub, j) => { const L = j ? M : G; S.at(sub, L.x + L.r + 2, L.z); });
    S.step();
    both = mine(G).length === 2 && mine(M).length === 3;
  }
  assert.ok(both, `his two mirrors and its three images stand together (${mine(G).length}, ${mine(M).length})`);
  assert.ok(mine(G).every((x) => x.key === 'garoth') && mine(M).every((x) => x.key === 'spellmaster' && x.image), 'each its own lord\'s');
  // and each its lord's aspect (L1-2): Garoth's mirrors Rime-Wrought, the Spellmaster's images Burning
  assert.ok(mine(G).every((x) => x.asp === G.asp && G.asp === 'rime') && mine(M).every((x) => x.asp === M.asp && M.asp === 'burning'), 'its lord\'s aspect');
  const els = new Set();
  // (PIN MOVED, EG-PERFECT's audit: a minute - their blows are drawn at random beside the Spellmaster's, whose Lattice now holds its
  // cooldown past its sweep, moving the draws: in 20 s his mirrors drew Cleaves and Slams alone)
  for (let k = 0; k < 4 * 60; k++) { for (const f of S.step()) if (f.k === 'eb' && f.el && mine(G).some((x) => x.i === f.o)) els.add(f.el); S.subs.forEach((sub, j) => { const L = j ? M : G; S.at(sub, L.x + L.r + 2, L.z); }); }
  assert.ok(els.size && [...els].every((e) => e === 'frost'), `his mirrors throw his frost (${[...els]})`);
});
test('AUDIT EG V L1-30 SCORCHED ONLY ON A BRIDGE THAT BURNS (section 13.3: "Leading Grath onto a burning bridge ... leaves him Scorched"): a bridge told and not yet burning scorches no one; burning, it does (mutants: the tell\'s three seconds counted as burning)', () => {
  const C = court(1, 5, 'hound', { n: 2 }), F = C.F, G = C.L, far = { sub: 'acct-1', x: C.f.x, z: C.f.z - 8 };
  G.hp = G.max * 0.6;
  let told = null;
  for (let k = 0; k < 4 * 20 && !told; k++) told = C.step([{ sub: 'acct-0', x: C.f.x + 4, z: C.f.z }, far]).find((f) => f.k === 'eb' && f.nm === 'Burning Bridge') ?? null;
  assert.ok(told, 'a bridge told');
  const [, ax, az, bx, bz] = told.s[0], mid = [(ax + bx) / 2, (az + bz) / 2];
  const hunt = () => { F.mem.scent = [{ sub: 'acct-1', until: C.now() + 8000 }]; G.atk = null; G.stunUntil = 0; egPlace(F, G, mid[0], mid[1], C.now()); };
  hunt();
  C.step([{ sub: 'acct-0', x: C.f.x + 4, z: C.f.z }, far]);
  assert.ok(!(G.scorchUntil > C.now()), 'told, not burning: not scorched');
  while (C.now() < told.at) C.step([{ sub: 'acct-0', x: C.f.x + 4, z: C.f.z }, far]);
  hunt();
  C.step([{ sub: 'acct-0', x: C.f.x + 4, z: C.f.z }, far]);
  assert.ok(G.scorchUntil > C.now(), 'burning: Scorched');
});

// ── L1-26: THE HAVEN NOVA OVER ANOTHER LORD'S GROUND ──────────────────────────────────────────────────────────────────
test('AUDIT EG V L1-26 THE HAVEN NOVA OVER A FLOOR OF MANY PIECES (sections 13.2, THE ERRAND FLOOR, and 18, THE OLD MASTERS): the Last Spellmaster beside Grath on his islands and beside the Twin Lords on their courts lays his havens over the whole floor - every island and court a haven - and his Nova\'s wind-up is the errand floor of the route WALKED over it (egHavenFloor), at least the straight-line route from the farthest floor point; his own court of one disc keeps its measure (mutants: the route over the first disc alone; havens on the first disc alone; the walk across the magma)', () => {
  for (const key of ['hound', 'twins']) {
    const [seed, h, spec] = hallWhere((s) => s.kind === 'court' && s.lord === key && s.band === 3 && s.c % 2 === 1, { from: 105, to: 600, step: 5 });
    const S = breachAt(seed, h, { n: 4, strata: ['oldmasters'] });
    wakeCourt(S);
    const F = S.B.F, M = egLordsOf(F).find((L) => L.key === 'spellmaster');
    assert.ok(M, `${key}: the Spellmaster beside`);
    const hearts = spec.fl.map((f) => (f.t === 'd' ? [f.x, f.z] : [(f.ax + f.bx) / 2, (f.az + f.bz) / 2]));
    let nova = null;
    for (let k = 0; k < 4 * 120 && !nova; k++) { S.subs.forEach((sub, j) => S.at(sub, ...hearts[j % hearts.length])); nova = S.step().find((f) => f.k === 'eb' && f.nm === 'Haven Nova') ?? null; }
    assert.ok(nova, `${key}: the Nova`);
    const havens = []; for (let i = 1; i + 2 < nova.s[0].length; i += 3) havens.push([nova.s[0][i], nova.s[0][i + 1], nova.s[0][i + 2]]);
    assert.ok(havens.length <= EG_HAVENS_MAX, 'within its stamp');
    for (const d of spec.fl.filter((f) => f.t === 'd')) assert.ok(havens.some(([x, z]) => Math.hypot(x - d.x, z - d.z) <= d.r), `${key}: a haven on every island and court`);
    // the farthest floor point, straight to the nearest haven's edge - the route walked is never under it
    let far = 0;
    for (const f of spec.fl) {
      const R = f.t === 'd' ? f.r : Math.hypot(f.bx - f.ax, f.bz - f.az) / 2 + f.hw, cx = f.t === 'd' ? f.x : (f.ax + f.bx) / 2, cz = f.t === 'd' ? f.z : (f.az + f.bz) / 2;
      for (let x = cx - R; x <= cx + R; x += 0.5) for (let z = cz - R; z <= cz + R; z += 0.5) if (egOnFight(spec, x, z)) { let d = Infinity; for (const [hx, hz, hr] of havens) d = Math.min(d, Math.max(0, Math.hypot(x - hx, z - hz) - hr)); far = Math.max(far, d); }
    }
    assert.ok(nova.wu >= egErrandMs(far), `${key}: its wind-up ${nova.wu} ms, the straight route's floor ${egErrandMs(far)} ms`);
    // PIN MOVED (AUDIT EG V, h - B NEW-3): the court a single court's havens are measured on is the master's own (the island or
    // court the first three stand on, net/eliteGates/egLords.js mainDisc), never the ground's first
    const own = spec.fl.find((f) => f.t === 'd' && Math.hypot(havens[0][0] - f.x, havens[0][1] - f.z) <= f.r);
    const base = havens.slice(0, 3), H = egHavenFloor(spec, base, egHavenRouteM(base, own));   // four members: three havens a court would lay, then the floor's
    assert.deepEqual([nova.wu, havens], [egErrandMs(H.routeM), H.havens], `${key}: the walked route's errand floor`);
  }
  // the route WALKED: two courts 20 m apart joined only by a road round three sides (the fight floor's own pieces' shapes)
  const U = { fl: [{ t: 'd', x: 0, z: 0, r: 5, y: 0 }, { t: 'd', x: 0, z: 20, r: 5, y: 0 }, { t: 'l', ax: 0, az: 0, bx: 30, bz: 0, hw: 2, y: 0 }, { t: 'l', ax: 30, az: 0, bx: 30, bz: 20, hw: 2, y: 0 }, { t: 'l', ax: 30, az: 20, bx: 0, bz: 20, hw: 2, y: 0 }] };
  const walked = egHavenFloor(U, [[0, 0, 3]], Infinity);
  assert.ok(walked.routeM > 60 && walked.havens.length === 1, `round the road (some 75 m), never across (some 22 m) (${walked.routeM.toFixed(1)} m)`);
  const near = egHavenFloor(U, [[0, 0, 3]], 30);
  assert.ok(near.havens.length > 1 && near.routeM <= 30 + 0.5, 'havens added until the route is a court\'s');
});

// ── L9-7: A CHAMPION'S RING ON NO FLOOR; NEW-1: A MEMBER INSIDE A LORD ─────────────────────────────────────────────────
test('AUDIT EG V L9-7 A CHAMPION\'S RING WHERE NO FLOOR HOLDS ITS SPOT (sections 8.5 and 8.6): a proving court\'s champion stood off every floor wakes at a ring of EG_CHAMP_RING_M (13 m) about its spot, never under EG_CHAMP_RING_MIN_M (mutants: the constant; the no-floor edge\'s metre)', () => {
  assert.deepEqual([EG_CHAMP_RING_M, EG_CHAMP_RING_MIN_M], [13, 4]);
  const [, , spec] = hallWhere((s) => s.kind === 'proving');
  const off = { ...spec, foe: { x: spec.foe.x + 500, z: spec.foe.z + 500 } };
  assert.ok(!(spec.fl ?? []).some((f) => egOnFight({ fl: [f] }, off.foe.x, off.foe.z)), 'no floor holds it');
  assert.deepEqual(champRing(off), { x: off.foe.x, z: off.foe.z, r: EG_CHAMP_RING_M });
});
test('AUDIT EG V NEW-1 A MEMBER INSIDE A LORD\'S BODY NEVER FREEZES IT (section 13.2): with the company standing within Garoth\'s body radius he still strikes - a member there is at no gap, never past every blow\'s reach; before, every blow\'s least gap refused and no walk came (mutants: the gap below nought kept)', () => {
  const S = breachAt(7, 125, { n: 2 });
  wakeCourt(S);
  const G = egLordsOf(S.B.F)[0], f0 = S.frames.length;
  for (let k = 0; k < 4 * 20; k++) { S.at('acct-0', G.x + G.r * 0.6, G.z); S.at('acct-1', G.x - G.r * 0.6, G.z); S.step(); }
  assert.ok(S.frames.slice(f0).filter((f) => f.k === 'eb' && f.o === G.i).length >= 3, 'he strikes the members inside him');
});

// ── L1-7 and L1-18, THE LEGION'S HALVES ───────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L1-7 and L1-18 THE LEGION\'S HALVES (sections 8.7, 13.2 and 14): an add turned to strike says its facing (a Shielded elite\'s back is judged by it); Chained Blows\' second shape is said with the first, its dim outline from the word, its fill THE CHAINED GAP from the first\'s landing (mutants: the add\'s turn unsaid; the chained fill from the word)', () => {
  const spec = egHallOf(1, 1, 0, 8), view = egFightView(spec);
  const F = egFightNew(spec, T0, [40]), out = [];
  const [a] = egLegionRaise(F, [EG_KIND.breaker], [[spec.fight.x, spec.fight.z]], T0 - 5000, []);
  a.up = 0;
  F.moves.length = 0;
  egLegionStep(F, view, T0, [{ sub: 'm', x: a.x + 3, z: a.z }], seeded(3), out, { decrees: { chained: 1 } });
  const [first, ch] = out.filter((f) => f.k === 'eb');
  assert.ok(first && ch && ch.nm.endsWith('(chained)'), 'a Breaker\'s blow and its chained shape');
  assert.deepEqual([ch.at - ch.wu, egBlowOutlineFrom(ch), ch.wu], [first.at, first.at - first.wu, egChainGapMs(first.wu, ch.s)], 'its outline from the word, its fill from the first\'s landing');
  const turn = F.moves.filter((t) => t[0] === a.i).at(-1);
  assert.ok(turn && turn[9] === egYawOf(a) && Math.abs(a.yaw - Math.PI / 2) < 0.05, 'its turn said with its facing');
});

// ── L1-24, L1-27, L1-28: THE PAGE SAID AS BUILT ───────────────────────────────────────────────────────────
const page = readFileSync(new URL('../../../bible/11-Multiplayer/Elite-Gates.md', import.meta.url), 'utf8');
/** A stretch of the page from heading `a` to the next `b`, its whitespace one space. */
const pageFrom = (a, b) => { const i = page.indexOf(a); assert.ok(i >= 0, `the page has ${a}`); return page.slice(i, page.indexOf(b, i + a.length)).replace(/\s+/g, ' '); };
test('AUDIT EG V L1-24, L1-27 and L1-28 THE PAGE SAID AS BUILT (sections 13.2 and 13.3): Garoth\'s Clan Muster calls a duel at each of his two phase turns, the one at his third phase\'s turn holding his fall (never a "third duel"); the Night-Stalker\'s lone member is bound to a Blood Thrall, its own kind (never a Harrier body); the Armsmaster\'s second phase at n >= 4 challenges two members into the one ring with clamp(n - 2, 1, 3) braziers (never two Challenges) - the page says each as the producers stand it (its old words fail it)', () => {
  const s132 = pageFrom('### 13.2 The law every lord keeps', '\n### '), s133 = pageFrom('### 13.3 The roster', '\n### ');
  // L1-24: two duels, at his two turns - the second holds his fall
  const [gs, gh] = hallWhere((s) => s.kind === 'court' && s.lord === 'garoth');
  const G = court(gs, gh, 'garoth', { n: 2 }), duels = [];
  const gHere = () => G.subs.map((sub, j) => ({ sub, x: G.L.x + 2 + j, z: G.L.z }));
  for (const frac of [0.6, 0.3]) {
    G.L.hp = Math.floor(G.L.max * frac);
    const o = G.step(gHere());
    assert.ok(words(o).includes('challenge'), `a duel called at his turn (phase ${G.L.ph})`);
    // FB1018D DUEL-RING (AUDIT FB1018D L3-M1): his honour duel is a ring's whatever the company - no braziers keep it, and it
    // is never said as the open duel, called or ended
    assert.equal(o.find((f) => f.k === 'esay' && f.w === 'challenge')?.t, undefined, 'his duel called as a ring\'s');
    duels.push([G.L.ph, G.L.hold]);
    for (let k = 0; k < 80 && G.F.mem.challenge; k++) { const e = G.step(gHere()).find((f) => f.k === 'esay' && (f.w === 'challengeend' || f.w === 'challengewon')); if (e) assert.equal(e.t, undefined, 'and ended as one'); }
    assert.equal(G.F.mem.challenge, null, 'it ends by its own 15 s');
  }
  assert.deepEqual(duels, [[2, PHASE_AT[1]], [3, 0]], 'two duels, at his two turns - the one at his third phase\'s turn holds his fall');
  assert.ok(s132.includes('Muster\'s duel at his third phase\'s turn holds his fall') && !/third duel/.test(s132), '13.2: the duel at his third phase\'s turn');
  // L1-27: alone, a Blood Thrall - its own kind - bound to the member
  const N = court(1, 55, 'stalker', { n: 1 }), lone = () => [{ sub: N.subs[0], x: N.f.x + 3, z: N.f.z }];
  let th = null;
  for (let k = 0; k < 160 && !th; k++) { N.step(lone()); th = N.F.tethers.map((t) => N.F.bodies.find((b) => b.i === t[0])).find(Boolean) ?? null; }
  assert.ok(th && th.role === EG_ROLE.add, 'alone: a body bound to the member');
  assert.equal(egBodyWire(th)[2], EG_KIND.thrall, 'a Blood Thrall, never a Harrier');
  const stalker = s133.slice(s133.indexOf('9. **The Night-Stalker'), s133.indexOf('10. **Valkynaz Seyth'));
  assert.ok(stalker.includes('binds a Blood Thrall 4 m away') && !/Harrier body/.test(stalker), '13.3: a Blood Thrall, its own kind');
  // L1-28: at n = 4, his second phase's Challenge: two members marked into the one ring
  const A = court(1, 10, 'armsmaster', { n: 4 }), four = () => A.subs.map((sub, j) => ({ sub, x: A.L.x + 2 + j, z: A.L.z + 1 }));
  A.L.hp = Math.floor(A.L.max * 0.6);
  A.step(four());
  assert.equal(A.L.ph, 2, 'his second phase');
  for (let k = 0; k < 80 && !A.F.mem.challenge; k++) A.step(four());
  const ch = A.F.mem.challenge;
  assert.ok(ch && ch.by === A.L.i, 'his Challenge');
  assert.deepEqual([ch.subs.length, ch.r, A.F.pg.ring?.[2], egObjsOf(A.F, 'brazier').length], [2, 6, 6, 2], 'two challenged into the one ring of r 6, its braziers clamp(n - 2, 1, 3)');
  const second = s133.slice(s133.indexOf('*the second challenge*'), s133.indexOf('**the Last Lesson**'));
  assert.ok(second.includes('two members challenged at once into the one ring') && !/two Challenges at once/.test(second) && second.includes('`clamp(n - 2, 1, 3)`'), '13.3: two challenged into the one ring');
});
