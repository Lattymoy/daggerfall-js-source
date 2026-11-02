// EG5 (2026-10-12, the Elite Gates arc; bible/11-Multiplayer/Elite-Gates.md section 14, "The merge" and "The profile"):
// THE FIGHT'S PROFILE (net/eliteGates/egLaw.js egFightProfile, validEgDecrees, egLawFold) - the lord family's four decrees, the gate's
// boss-general trials recast as X-keyed laws in thousandths and folded as the Hour's marks fold (a key ending in X
// multiplies, any other the last that names it); its validator; its cache, keyed by the sorted decree string and bounded
// (LRU 256); net/eliteGates/egLords.js egLordLaw reading it; and every law on a lord in a real fight the director stands - Colossal's
// health and radii (the Slam 8.4 m at its 1.71 s floor), Unyielding's ward and its blows, Vengeful's shares within the one
// 1.5 cap, Grudge-Bearer's threat that never forgets.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EG_DECREES, EG_DECREE_BY_KEY, EG_DECREES_MAX, EG_LAW_UNIT, EG_LAW_X_KEYS, EG_PROFILE_CACHE_MAX, validEgDecrees, egLawFold, egFightProfile, egProfilesKept,
  egHallOf, EG_SEALED_MS } from '../../../src/net/eliteGates/egLaw.js';
import { egLordLaw, egLordsOf, egTtkRef } from '../../../src/net/eliteGates/egLords.js';
import { egShareX, EG_SHARE_X_MAX } from '../../../src/net/eliteGates/egBodies.js';
import { egBreachNew, egEnter, egStep } from '../../../src/net/eliteGates/egBrain.js';
import { egDecreesAsk, egDecreesChosen, egDecreesInForce } from '../../../src/net/eliteGates/egRun.js';
import { egWindupFloorMs, shDisc } from '../../../src/net/eliteGates/egShape.js';
import { GATE_TRIALS, gateTrialOf } from '../../../src/net/gate/gateMods.js';
import { SHIELD_MS, THREAT_PICK, THREAT_DECAY } from '../../../src/net/gate/gateBrain.js';
import { SD_OMENS } from '../../../src/net/superDungeon/sdMarks.js';

const T0 = 1_800_000_000_000;
const SITE = { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 };
const id = (key) => EG_DECREE_BY_KEY[key].id;
/** Section 14's table, as the page writes it: each lord decree's law at rank I and rank II. */
const PAGE = Object.freeze({
  colossal: [{ sizeX: 1.25, hpX: 1.25, radiusX: 1.2 }, { sizeX: 1.4, hpX: 1.4, radiusX: 1.3 }],
  unyielding: [{ shieldX: 2, hitX: 0.85 }, { shieldX: 3, hitX: 0.75 }],
  vengeful: [{ dmgX: 1.25 }, { dmgX: 1.4 }],
  grudge: [{ threatPick: 0.85, threatDecay: 0 }, { threatPick: 0.95, threatDecay: 0 }],
});
const ONE = Object.freeze({ sizeX: 1, hpX: 1, radiusX: 1, shieldX: 1, hitX: 1, dmgX: 1 });

/**
 * A breach of `n` at hall `h` of `seed` under decrees `dc` (`[[id, rank]]` - the circle's drawn), its trial woken with the
 * company on the arrival plate: `at(sub, x, z)` stands a member (the hall's frame), `step(ms)` beats the director.
 */
function breachAt(seed, h, dc = [], { n = 1 } = {}) {
  let s = seed;
  const rng = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
  const co = Array.from({ length: n }, (_, i) => [`acct-${i}`, `M${i}`, i + 1]);
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'M0', ew: 0, rh: 0, seed, op: T0, co, site: SITE, wg: [], pr: 'rally' });
  B.dc = dc.map((p) => [...p]);
  let now = T0 + EG_SEALED_MS + 100;
  for (const [sub] of co) egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 40, now);
  const spec = egHallOf(seed, h, 0);
  B.h = h; B.sg = 'arrive'; B.wk = now; B.cnt = { left: 1_800_000, at: now }; B.pulledAt = now; B.su = now + 30_000;
  const pos = Object.fromEntries(co.map(([sub], i) => [sub, { sx: spec.x0 + spec.arrive.x + i * 0.5, z: spec.arrive.z }]));
  const frames = [];
  const step = (ms = 250) => { now += ms; const o = egStep(B, now, co.map(([sub]) => ({ sub, ...pos[sub], dead: false, at: now })), rng); frames.push(...o); return o; };
  const at = (sub, x, z) => { pos[sub] = { sx: spec.x0 + x, z }; };
  for (let k = 0; k < 60 && B.sg !== 'trial'; k++) step();
  assert.equal(B.sg, 'trial', `hall ${h} woke`);
  return { B, spec, frames, step, at, now: () => now };
}
/** A Court's lord woken: the company stood in its wake ring. */
function courtAwake(seed, h, dc) {
  const S = breachAt(seed, h, dc);
  S.at('acct-0', S.spec.ring.x, S.spec.ring.z);
  for (let k = 0; k < 8 && !egLordsOf(S.B.F).some((L) => L.up2); k++) S.step();
  const L = egLordsOf(S.B.F)[0];
  assert.ok(L?.up2, 'the lord woke');
  return { ...S, L };
}
/** The first blow a body threw (`eb`), from frame `from` on. */
const firstBlow = (frames, i, nm = null) => frames.find((f) => f.k === 'eb' && f.o === i && (!nm || f.nm === nm)) ?? null;

test('EG5 THE MERGE (section 14): the lord family\'s four are the gate\'s boss-general trials recast as X-keyed laws, as the page writes them - Colossal (sizeX 1.25, hpX 1.25, radiusX 1.2; II 1.4, 1.4, 1.3), Unyielding (shieldX 2 in place of the trial\'s 6 s ward, hitX 0.85; II 3, 0.75), Vengeful (dmgX 1.25; II 1.4), Grudge-Bearer (threatPick 0.85, threatDecay 0; II 0.95) - rank I\'s numbers the gate\'s own trials\' (gateMods.js GATE_TRIALS, imported, never copied), each in thousandths; no other family carries a law, the Warden\'s own four and Legion-Lord are not drawn, and no other decree takes a trial\'s or an omen\'s name (mutants: any law number moved; a law on another family; a rank I copied off the trials)', () => {
  assert.equal(EG_LAW_UNIT, 1000);
  for (const [key, ranks] of Object.entries(PAGE)) {
    for (const r of [1, 2]) assert.deepEqual({ ...egFightProfile([[id(key), r]]).law }, { ...ONE, ...ranks[r - 1] }, `${key} at rank ${r}`);
    for (const L of EG_DECREE_BY_KEY[key].law) for (const v of Object.values(L)) assert.ok(Number.isInteger(v), `${key}'s law decides in integers`);
  }
  // the recast: rank I's numbers are the gate's own trials'
  const T = (k) => gateTrialOf(k);
  assert.deepEqual([PAGE.colossal[0].sizeX, PAGE.colossal[0].hpX], [T('colossal').size, T('colossal').hp]);
  assert.deepEqual([PAGE.unyielding[0].shieldX, PAGE.unyielding[0].hitX], [T('unyielding').shieldMs / SHIELD_MS, T('unyielding').hit]);
  assert.equal(PAGE.vengeful[0].dmgX, T('vengeful').dmg);
  assert.deepEqual([PAGE.grudge[0].threatPick, PAGE.grudge[0].threatDecay], [T('grudge').threatPick, T('grudge').threatDecay]);
  const src = readFileSync(new URL('../../../src/net/eliteGates/egLaw.js', import.meta.url), 'utf8');
  for (const read of ["milli(trial('colossal').size)", "milli(trial('colossal').hp)", "milli(trial('unyielding').hit)", "milli(trial('vengeful').dmg)", "milli(trial('grudge').threatPick)", "milli(trial('grudge').threatDecay)"]) assert.ok(src.includes(read), `rank I read off the gate's trial: ${read}`);
  // the lord family alone carries a law: every other decree is the fight with none
  for (const D of EG_DECREES) if (D.fam !== 'lord') assert.deepEqual({ ...egFightProfile([[D.id, 2]]).law }, ONE, `${D.key} carries no law`);
  assert.deepEqual([...EG_LAW_X_KEYS], ['sizeX', 'hpX', 'radiusX', 'shieldX', 'hitX', 'dmgX']);
  // the four drawn are the boss-general trials; the Warden's own and Legion-Lord are not; no new decree takes a trial's or an omen's name
  const lord = EG_DECREES.filter((D) => D.fam === 'lord');
  assert.deepEqual(lord.map((D) => D.name), ['colossal', 'unyielding', 'vengeful', 'grudge'].map((k) => T(k).name));
  for (const k of ['scarring', 'favoured', 'echoing', 'soulhungry', 'legion']) assert.ok(!EG_DECREES.some((D) => D.name === T(k).name), `${T(k).name} is not drawn`);
  const taken = new Set([...GATE_TRIALS.map((t) => t.name), ...SD_OMENS.map((o) => o.name)]);
  // PIN MOVED (AUDIT EG V, a1: L2-10 built THE FRAYING - section 14's "the Hour's decree The Fraying", the Hour's own omen carried
  // whole, its name the omen's; every other decree but the lord family's is still the Spire's own)
  for (const D of EG_DECREES) if (D.fam !== 'lord' && D.key !== 'fraying') assert.ok(!taken.has(D.name), `${D.name} is the Spire's own`);
  assert.equal(EG_DECREE_BY_KEY.fraying.name, SD_OMENS.find((o) => o.id === 'fraying').name, 'The Fraying is the Hour\'s');
});

test('EG5 THE FOLD (section 14, "The merge"): net/superDungeon/sdMarks.js sdMarksLaw\'s rule over the laws in thousandths - a key ending in X multiplies (rounded to the thousandth), any other is the last that names it; the profile folds the decrees in their numbers\' order (mutants: an X key overridden; the thousandth floored; the first naming kept; the fold out of order)', () => {
  const law = (key, r) => EG_DECREE_BY_KEY[key].law[r - 1];
  const base = Object.fromEntries(EG_LAW_X_KEYS.map((k) => [k, EG_LAW_UNIT]));
  assert.deepEqual(egLawFold([]), base, 'nothing named: x1 each');
  assert.deepEqual(egLawFold([law('colossal', 1), law('colossal', 2)]), { ...base, sizeX: 1750, hpX: 1750, radiusX: 1560 }, 'X keys multiply');
  assert.equal(egLawFold([law('unyielding', 1), law('unyielding', 2)]).hitX, 638, '850 x 750 = 637.5, to the thousandth');
  assert.deepEqual(egLawFold([law('grudge', 1), law('grudge', 2)]), { ...base, threatPick: 950, threatDecay: 0 }, 'the last that names it');
  assert.deepEqual(egLawFold([law('grudge', 2), law('grudge', 1)]), { ...base, threatPick: 850, threatDecay: 0 });
  assert.deepEqual(egLawFold([law('vengeful', 2), undefined, law('colossal', 1)]), { ...base, dmgX: 1400, sizeX: 1250, hpX: 1250, radiusX: 1200 }, 'a decree with no law folds nothing');
  // the profile: two decrees of disjoint keys, given out of order, fold to the page's numbers
  const P = egFightProfile([[id('grudge'), 2], [id('pack'), 1], [id('colossal'), 2]]);
  assert.deepEqual({ ...P.law }, { ...ONE, sizeX: 1.4, hpX: 1.4, radiusX: 1.3, threatPick: 0.95, threatDecay: 0 });
  assert.deepEqual(P.dc, [[id('pack'), 1], [id('colossal'), 2], [id('grudge'), 2]], 'sorted by number');
});

test('EG5 THE PROFILE\'S VALIDATOR AND ITS CACHE (section 14, "The profile"): a circle\'s decrees as the state says them (net/eliteGates/egRun.js egDecreesInForce - the drawn, the Proclamation, the Wager) pass whole as a fresh copy; more than EG_DECREES_MAX (9), an unknown decree, a rank but 1 or 2, a decree twice or a pair misshapen is none, and the fight with none; the profile is kept by the sorted decree string (order-free, frozen) in a cache bounded at EG_PROFILE_CACHE_MAX (256) that drops the least recently asked (mutants: ten passed; a rank 3 passed; a decree twice; the copy shared; the order kept in the key; the cache unbounded; the oldest asked dropped though asked again)', () => {
  // the producer's own: a breach's Wager and Proclamation standing, the next circle's families asked and chosen
  let s = 7;
  const rng = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'M0', ew: 0, rh: 0, seed: 7, op: T0, co: [['acct-0', 'M0', 1]], site: SITE, wg: [0, 15, 13], pr: 'rally' });
  B.dc = egDecreesChosen(B, egDecreesAsk(B, 12, rng, T0, []));
  const dc = egDecreesInForce(B);
  assert.ok(dc.length >= 5 && dc.length <= EG_DECREES_MAX, `${dc.length} decrees in force`);
  const v = validEgDecrees(dc);
  assert.deepEqual(v, dc, 'the state\'s decrees pass whole');
  assert.notEqual(v, dc); assert.notEqual(v[0], dc[0]);
  assert.equal(EG_DECREES_MAX, 9);
  const nine = Array.from({ length: 9 }, (_, i) => [i, 1]);
  assert.deepEqual(validEgDecrees(nine), nine);
  // PIN MOVED (AUDIT EG V, a1: L2-10's The Fraying is decree 19 - the unknown decree is the one past the table)
  for (const bad of [null, 'x', {}, [...nine, [9, 1]], [[EG_DECREES.length, 1]], [[-1, 1]], [[1.5, 1]], [[3, 0]], [[3, 3]], [[3, 1], [3, 2]], [[3]], [[3, 1, 0]], ['3:1'], [['1', 1]]]) assert.equal(validEgDecrees(bad), null, JSON.stringify(bad));
  // the cache: by the sorted string, order-free; an invalid list is the fight with none
  const a = egFightProfile([[17, 1], [15, 2]]);
  assert.equal(egFightProfile([[15, 2], [17, 1]]), a, 'the same profile, whatever the order');
  assert.equal(a.key, '15:2,17:1');
  assert.ok(Object.isFrozen(a) && Object.isFrozen(a.law) && Object.isFrozen(a.dc) && Object.isFrozen(a.dc[0]));
  const none = egFightProfile([]);
  assert.deepEqual([none.key, none.dc, { ...none.law }], ['', null, ONE]);
  for (const bad of [[[3, 3]], [[99, 1]], null]) assert.equal(egFightProfile(bad), none, 'an invalid list: no decree');
  // bounded, least recently asked dropped first
  assert.equal(EG_PROFILE_CACHE_MAX, 256);
  const pairs = [];
  for (let i = 0; i < 19 && pairs.length < 400; i++) for (let j = i + 1; j < 19 && pairs.length < 400; j++) for (const r of [1, 2]) pairs.push([[i, r], [j, 1]]);
  const made = pairs.slice(0, EG_PROFILE_CACHE_MAX).map((p) => egFightProfile(p));   // the cache holds these, and nothing older
  assert.equal(egProfilesKept(), EG_PROFILE_CACHE_MAX, 'full');
  assert.equal(egFightProfile(pairs[0]), made[0], 'the oldest asked again: kept, and now the most recent');
  egFightProfile(pairs[EG_PROFILE_CACHE_MAX]);   // one more: the least recently asked goes - the second, not the first
  assert.equal(egProfilesKept(), EG_PROFILE_CACHE_MAX, 'never past its bound');
  assert.equal(egFightProfile(pairs[0]), made[0], 'the one asked again stays');
  const again = egFightProfile(pairs[1]);
  assert.notEqual(again, made[1], 'the least recently asked was dropped (made again)');
  assert.deepEqual(again, made[1], 'and made the same');
  for (let k = 0; k < 400; k++) egFightProfile(pairs[k]);
  assert.equal(egProfilesKept(), EG_PROFILE_CACHE_MAX);
  // the law decides in integers: no transcendental in the profile's block (section 9's sweep)
  const src = readFileSync(new URL('../../../src/net/eliteGates/egLaw.js', import.meta.url), 'utf8');
  const block = src.slice(src.indexOf('export const EG_LAW_UNIT'), src.indexOf('export const egProfilesKept'));
  assert.ok(block.length > 3000, 'the profile found');
  for (const bad of ['Math.sin', 'Math.cos', 'Math.tan', 'Math.atan', 'Math.random', 'Math.sqrt', 'Math.hypot', 'Math.pow', 'Math.exp', 'Math.log', 'Math.cbrt', 'Date.now']) assert.ok(!block.includes(bad), `the profile calls ${bad}`);
});

test('EG5 THE LORDS\' LAW READS THE PROFILE (net/eliteGates/egLords.js egLordLaw): under every rank of the four (0, I, II - 81 sets) and words that are no decree (the Wellhead\'s feud) beside them, the law each lord runs by is section 14\'s numbers, with the gate\'s own threat (THREAT_PICK, THREAT_DECAY) where no decree names it - fresh each call (mutants: rank II read as I; the gate\'s threat lost; a word that is no decree folded)', () => {
  let n = 0;
  for (const c of [0, 1, 2]) for (const u of [0, 1, 2]) for (const v of [0, 1, 2]) for (const g of [0, 1, 2]) {
    const want = { ...ONE, threatPick: THREAT_PICK, threatDecay: THREAT_DECAY, ...(c ? PAGE.colossal[c - 1] : {}), ...(u ? PAGE.unyielding[u - 1] : {}), ...(v ? PAGE.vengeful[v - 1] : {}), ...(g ? PAGE.grudge[g - 1] : {}) };
    const got = egLordLaw({ colossal: c, unyielding: u, vengeful: v, grudge: g, feud: 1, pack: 2 });
    assert.deepEqual(got, want, `colossal ${c}, unyielding ${u}, vengeful ${v}, grudge ${g}`);
    n++;
  }
  assert.equal(n, 81);
  assert.deepEqual(egLordLaw(), { ...ONE, threatPick: THREAT_PICK, threatDecay: THREAT_DECAY });
  assert.notEqual(egLordLaw(), egLordLaw(), 'fresh: a fight keeps its own');
  assert.deepEqual(egLordLaw({ colossal: 3 }), egLordLaw({ colossal: 2 }), 'past II is II');
});

test('EG5 THE LAWS ON A LORD, IN A REAL FIGHT (sections 13.2 and 14): the director stands a Court\'s lord under the circle\'s decrees - Colossal: its health a quarter more and every aimed shape 1.2 times as wide, a champion\'s Slam 8.4 m at its 1.71 s floor; Unyielding: a phase\'s ward twice SHIELD_MS; Vengeful: a quarter more of each share, and depth, fury and Vengeful together never past EG_SHARE_X_MAX (1.5); Grudge-Bearer: its threat never forgets (mutants: Colossal\'s health off; its radii off; the ward unlengthened; the cap taken apart; the decay kept)', () => {
  const C = 12345, H = 5;   // the first circle's Court: Grath
  const plain = courtAwake(C, H, []), col = courtAwake(C, H, [[id('colossal'), 1]]);
  assert.equal(plain.L.key, 'hound');
  assert.equal(plain.L.max, Math.max(1, Math.round(egTtkRef(plain.B.F.c) * plain.B.F.team)));
  assert.equal(col.L.max, Math.max(1, Math.round(egTtkRef(col.B.F.c) * col.B.F.team * 1.25)), 'Colossal: a quarter more health');
  for (let k = 0; k < 40; k++) { plain.step(); col.step(); }
  const pb = firstBlow(plain.frames, plain.L.i), cb = firstBlow(col.frames, col.L.i);
  assert.ok(pb && cb && pb.nm === cb.nm, `the same first blow (${pb?.nm})`);
  const R = { d: 3, c: 4, l: 5 };
  pb.s.forEach((s, j) => assert.equal(cb.s[j][R[s[0]]], Math.round(s[R[s[0]]] * 1.2 * 100) / 100, `${pb.nm}: its ${s[0]} 1.2 times as wide`));
  // a champion's Slam under Colossal: 8.4 m, its wind-up the floor's 1.71 s (the Proving Walk of seed 1's fifth circle)
  const P = breachAt(1, 23, [[id('colossal'), 1]]), champ = egLordsOf(P.B.F)[0];
  assert.equal(champ.champ, 1);
  let slam = null;
  for (let k = 0; k < 240 && !slam; k++) { P.at('acct-0', champ.x + 1.5, champ.z + 1.5); P.step(); slam = firstBlow(P.frames, champ.i, 'Ground Slam'); }
  assert.ok(slam, 'the champion slams');
  assert.deepEqual([slam.s[0][3], slam.wu], [8.4, 1710]);
  assert.equal(egWindupFloorMs(shDisc(0, 0, 8.4)), 1710, 'the floor lengthens the wind-up it widens');
  // Unyielding: a phase's turn wards it twice SHIELD_MS
  for (const [dc, x] of [[[], 1], [[[id('unyielding'), 1]], 2], [[[id('unyielding'), 2]], 3]]) {
    const U = courtAwake(C, H, dc);
    U.L.hp = Math.floor(U.L.max * 0.6);
    const o = U.step();
    assert.ok(o.some((f) => f.k === 'eph' && f.i === U.L.i && f.ph === 2), 'its second phase');
    assert.equal(U.L.ward - U.now(), SHIELD_MS * x, `the ward x${x}`);
  }
  // Vengeful: a quarter more of the share, and the cap together with depth and fury
  const ven = courtAwake(C, H, [[id('vengeful'), 1]]), furious = courtAwake(C, H, [[id('vengeful'), 1]]);
  furious.B.F.mem.furyX = 1.5;
  for (let k = 0; k < 40; k++) { ven.step(); furious.step(); }
  const vb = firstBlow(ven.frames, ven.L.i), fb = firstBlow(furious.frames, furious.L.i);
  assert.equal(vb.nm, pb.nm);
  assert.equal(vb.p, pb.p * 1.25, 'Vengeful: a quarter more of the share (depth x1 at circle 1)');
  assert.equal(fb.p, pb.p * EG_SHARE_X_MAX, 'Vengeful and fury x1.5 together: capped at 1.5, not 1.875');
  assert.equal(egShareX(26, 1.25 * 1.5), EG_SHARE_X_MAX);
  assert.equal(egShareX(1, 1.25 * 1.1), 1.25 * 1.1);
  // Grudge-Bearer: the top of threat 0.85 of the time, and threat never forgotten
  const gp = courtAwake(C, H, []), gg = courtAwake(C, H, [[id('grudge'), 1]]);
  assert.deepEqual([gg.B.F.mem.law.threatPick, gg.B.F.mem.law.threatDecay], [0.85, 0]);
  for (const S of [gp, gg]) { S.L.threat['acct-0'] = 100; S.L.thAt = S.now(); for (let k = 0; k < 8; k++) S.step(); }
  assert.equal(gg.L.threat['acct-0'], 100, 'Grudge-Bearer forgets nothing');
  let left = 100;
  for (let k = 0; k < 8; k++) left *= Math.max(0, 1 - THREAT_DECAY * 0.25);
  assert.equal(gp.L.threat['acct-0'], left, 'the gate\'s decay forgets, THREAT_DECAY a second');
});
