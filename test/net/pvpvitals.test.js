// PVP-VITALS (2026-10-30): a flagged fighter's health rises, magicka and fatigue are the relay's (net/wild/pvpVitals.js). Pinned: a
// frozen or set bar buys nothing, an honest one is never refused, and the client tells what it drank and cast.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { VITAL_WHOLE, KIT_COSTS, KIT_ORDER, KIT_COST_BY_TYPE, PVP_VITALS, DECLARE, vitalsOf, vitalsReport, castPaid, shaftPaid, swingPaid, bowFastCut, RELAY_BOW_FAST, BOW_FAST_WITHIN, payFatigue, runPaid, healCredit, spendCredit, healthCapAt, shieldPaid, kitLanded, vitalsCarry, absorbLanded } from '../../src/net/wild/pvpVitals.js';
import { HEALTH_SHARE_WHOLE, takeHealthReport, PVP_HEALTH_MAX } from '../../src/net/siege/refereeHealthShare.js';
import { newWildRef, wildZone, wildBlow, wildCarry, wildCarryOf, WILD_GRACE } from '../../src/net/wild/wildRef.js';
import { SIEGE_UNITS_PER_M, SIEGE_HIT, newFighter } from '../../src/net/siege/siegeRef.js';
import { KIT_SPELLS, KIT_IDS } from '../../src/systems/wild/pvpKit.js';
import { PVP_POTION_MS } from '../../src/combat/pvpPotions.js';
import { validVitIn, validWildData } from '../../src/net/wire.js';
import { createRefereeHealthMirror } from '../../src/net/siege/refereeHealthMirror.js';
import { BOW_NUM_FRAMES, CLASSIC_UPDATE_INTERVAL, MELEE_NUM_FRAMES, SWING_FRAME_MIN } from '../../src/characters/weaponStates.js';
import { BOW_FAST, BOW_KINDS, whileShaftLands } from '../../src/combat/bowBloom.js';
import { resolveDuelStrike, duelStandIn } from '../../src/combat/duelCombat.js';
import { declarePotion, declareKitSelf, pendingDeclares, resetPvpDeclares } from '../../src/combat/pvpDeclare.js';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const M = SIEGE_UNITS_PER_M;
const at = (x) => ({ x: 1000 * M + x * M, y: 0, z: 1000 * M });
const FIST = { w: -1, m: 0 };
function zone(now = 10_000) {
  const st = newWildRef();
  wildZone(st, 'acct-a', { id: 'peer-a', lv: 10 }, true, at(-1), now - WILD_GRACE.ms);
  wildZone(st, 'acct-b', { id: 'peer-b', lv: 10 }, true, at(1), now - WILD_GRACE.ms);
  wildZone(st, 'acct-c', { id: 'peer-c', lv: 10 }, true, at(2), now - WILD_GRACE.ms);
  return st;
}

test('PVP-VITALS the numbers pinned to their homes: the bar\'s prices, the potion clock, the share\'s whole (mutants: a price, the clock)', () => {
  assert.deepEqual(KIT_ORDER, KIT_IDS);
  for (const id of KIT_IDS) assert.equal(KIT_COSTS[id], KIT_SPELLS[id].cost, id);
  assert.equal(PVP_VITALS.potionMs, PVP_POTION_MS);
  assert.equal(VITAL_WHOLE, HEALTH_SHARE_WHOLE);
  assert.equal(KIT_COST_BY_TYPE[9], Math.min(KIT_COSTS.fortify, KIT_COSTS.speed), 'Fortify and Speed share a type: the cheaper');
});

test('PVP-VITALS MAGICKA: a flagged caster pays the bar\'s Damage from the relay\'s ledger - a frozen bar runs dry after twelve casts and its thirteenth lands nothing; one cast\'s area on two targets pays once, the same target twice pays twice; an Absorb takes a landed cast\'s price back (mutants: no charge; the area charged per target; the ledger refilled by report)', () => {
  const st = zone();
  const a = st.fighters.get('acct-a');
  let now = 10_000, n = 0;
  vitalsReport(a.f, { mp: VITAL_WHOLE, fp: VITAL_WHOLE }, now, { flagged: true });
  const casts = Math.floor(VITAL_WHOLE / (KIT_COSTS.damage * 100));
  for (; n < casts; n++) {
    now += 600;
    const r = wildBlow(st, 'acct-a', 'acct-b', { d: 5, r: SIEGE_HIT.Spell, rid: `aaaaaaaaaa${String(n).padStart(2, '0')}`, c: n + 1 }, now);
    assert.equal(r.why === 'magicka', false, `cast ${n + 1}`);
    vitalsReport(a.f, { mp: VITAL_WHOLE, fp: VITAL_WHOLE, use: [] }, now, { flagged: true });   // the frozen bar's word: full
  }
  now += 600;
  assert.equal(wildBlow(st, 'acct-a', 'acct-b', { d: 5, r: SIEGE_HIT.Spell, rid: 'aaaaaaaaaaff', c: 99 }, now).why, 'magicka', 'a frozen bar casts no more');
  // the area: one price for two targets; the same target again pays
  const f = newFighter(10, 0);
  vitalsReport(f, { mp: 2000 }, 0, { flagged: true });
  assert.equal(castPaid(f, 7, 'b', 100), true);
  assert.equal(castPaid(f, 7, 'c', 200), true);
  assert.ok(Math.abs(vitalsOf(f, 200).mp - (2000 - 800)) < 3, 'one price for the area');
  assert.equal(castPaid(f, 7, 'b', 300), true);
  assert.ok(Math.abs(vitalsOf(f, 300).mp - (2000 - 1600)) < 3, 'the same target again is a new cast');
  assert.equal(castPaid(f, 8, 'b', 400), false, 'a cast it cannot pay');
  kitLanded(f, 'absorb', 500);
  absorbLanded(f, 600);
  assert.ok(vitalsOf(f, 600).mp >= 400 + 800 - 1);
});

test('PVP-VITALS THE LEDGERS: unflagged, the game\'s word anchors them; flagged, the word moves nothing; a magicka potion refills once a potion clock; a cell crossed carries them (mutants: anchored by a flagged word; the clock unread; the carry dropped)', () => {
  const f = newFighter(10, 0);
  vitalsReport(f, { mp: 3000, fp: 4000 }, 0, { flagged: false });
  assert.equal(vitalsOf(f, 0).mp, 3000);
  vitalsReport(f, { mp: VITAL_WHOLE, fp: VITAL_WHOLE }, 1000, { flagged: true });
  assert.ok(vitalsOf(f, 1000).mp < 3100 && vitalsOf(f, 1000).fp === 4000, 'a flagged word lifts nothing');
  vitalsReport(f, { use: [DECLARE.mpPotion] }, 2000, { flagged: true });
  const one = vitalsOf(f, 2000).mp;
  assert.ok(one > 3000 + PVP_VITALS.mpPotion - 10);
  vitalsReport(f, { use: [DECLARE.mpPotion] }, 3000, { flagged: true });
  assert.ok(vitalsOf(f, 3000).mp < one + 50, 'a second potion inside the clock buys nothing');
  vitalsReport(f, { use: [DECLARE.mpPotion] }, 2000 + PVP_POTION_MS, { flagged: true });
  assert.equal(vitalsOf(f, 2000 + PVP_POTION_MS).mp, VITAL_WHOLE);
  // the carry
  const st = zone();
  const b = st.fighters.get('acct-b');
  vitalsReport(b.f, { mp: 1234, fp: 2345 }, 10_000, { flagged: false });
  const c = wildCarryOf(JSON.parse(JSON.stringify(wildCarry(st, 'acct-b', 10_100))));
  assert.deepEqual([c.mp, c.fp], [1234, 2345]);
  const next = newWildRef();
  wildZone(next, 'acct-b', { id: 'peer-b', lv: 10, carry: c }, true, at(1), 10_200);
  assert.ok(Math.abs(vitalsOf(next.fighters.get('acct-b').f, 10_200).mp - 1234) < 2);
  assert.deepEqual(vitalsCarry(newFighter(1, 0)), null, 'nothing heard, nothing carried');
});

test('PVP-VITALS FATIGUE: a swing pays from the relay\'s fatigue and an empty ledger swings nothing; a run past the fastest walk drains it, a walk does not (mutants: no swing price; the walk charged)', () => {
  const st = zone();
  const a = st.fighters.get('acct-a');
  vitalsReport(a.f, { mp: VITAL_WHOLE, fp: PVP_VITALS.swing }, 10_000, { flagged: false });
  assert.notEqual(wildBlow(st, 'acct-a', 'acct-b', { d: 5, held: FIST, rid: 'bbbbbbbbbb01' }, 10_000).why, 'tired');
  assert.equal(wildBlow(st, 'acct-a', 'acct-b', { d: 5, held: FIST, rid: 'bbbbbbbbbb02' }, 11_000).why, 'tired');
  const f = newFighter(10, 0);
  vitalsReport(f, { fp: 5000 }, 0);
  runPaid(f, 5, 1000, 1000);
  assert.equal(vitalsOf(f, 1000).fp, 5000, 'a walk is free');
  runPaid(f, 12, 1000, 2000);
  assert.equal(vitalsOf(f, 2000).fp, 5000 - PVP_VITALS.runPerS);
  assert.equal(payFatigue(f, 99_999, 3000), false);
});

test('BOW-RATE: an arrow comes no sooner than the fastest honest bow (its loose, no reload), two may bunch, a third that soon lands nothing; a refused arrow costs no fatigue (mutants: no bucket; the bucket deeper)', () => {
  assert.equal(PVP_VITALS.shaftMs, Math.round(BOW_NUM_FRAMES.StrikeUp * CLASSIC_UPDATE_INTERVAL * 1000));
  const f = newFighter(10, 0);
  assert.deepEqual([shaftPaid(f, 1000), shaftPaid(f, 1010), shaftPaid(f, 1020)], [true, true, false]);
  assert.equal(shaftPaid(f, 1020 + PVP_VITALS.shaftMs), true, 'one more after a loose');
  let t = 20_000, ok = 0;
  for (let i = 0; i < 40; i++) if (shaftPaid(f, t += PVP_VITALS.shaftMs)) ok++;
  assert.equal(ok, 40, 'an honest archer at the floor is never refused');
  const st = zone();
  const a = st.fighters.get('acct-a');
  const shot = (n, now) => wildBlow(st, 'acct-a', 'acct-b', { d: 5, r: SIEGE_HIT.Shaft, held: FIST, rid: `cccccccccc${n}` }, now).why;
  shot('01', 10_000); shot('02', 10_050);
  const fp = vitalsOf(a.f, 10_100).fp;
  assert.equal(shot('03', 10_100), 'rate');
  assert.equal(vitalsOf(a.f, 10_100).fp, fp);
});

test('BOW-FAST: the relay cuts a judged shaft landing within a second of the last by a fifth a stack, four at most, at least 1 kept; a second apart takes none (mutants: no stacks; the stacks unbounded)', () => {
  assert.deepEqual(RELAY_BOW_FAST, { cut: 20, most: 4, within: 1 });
  const f = newFighter(10, 0);
  const cuts = [0, 300, 600, 900, 1200, 1500].map((t) => bowFastCut(f, 100, 1000 + t));
  assert.deepEqual(cuts, [100, 80, 60, 40, 20, 20]);
  assert.equal(bowFastCut(f, 100, 2500 + 1000), 100, 'a second apart');
  assert.equal(bowFastCut(f, 1, 3600), 1, 'at least 1 kept');
  assert.deepEqual(BOW_FAST_WITHIN, { 129: 0.75, 130: 1.25 });
  const s = newFighter(10, 0), l = newFighter(10, 0);
  assert.deepEqual([bowFastCut(s, 100, 1000, 129), bowFastCut(s, 100, 1800, 129)], [100, 100], 'a Short Bow rests sooner');
  assert.deepEqual([bowFastCut(l, 100, 1000, 130), bowFastCut(l, 100, 2200, 130)], [100, 80], 'a Long Bow later');
});

test('BOW-FAST, the split: the relay numbers are the game ones; a shaft the zone referee judges leaves the game uncut by its stacks, its pull kept, so it is cut once (mutants: the skip unread; the zone host unmarked)', () => {
  assert.deepEqual(RELAY_BOW_FAST, BOW_FAST);
  assert.deepEqual(BOW_FAST_WITHIN, { 129: BOW_KINDS[129].within, 130: BOW_KINDS[130].within });
  const a = { lv: 1, r: 0, st: [50, 50, 50, 50, 50, 50, 50, 50], sk: [30, 0, 0, 0], cf: [0, 0, 0], h: [100, 100] };
  const seq = () => { const v = [0, 0.99, 0.05, 0.999, 0.99]; let i = 0; return () => v[i++ % v.length]; };
  const roll = (shaft, relayCut) => whileShaftLands(shaft, () => resolveDuelStrike({ by: 'arrow', a, w: { t: 130, m: 4, c: 100 }, sw: 'StrikeDown', ...(relayCut ? { relayCut } : {}) }, duelStandIn(), { rolls: seq() }).dmg);
  const raw = roll({ fast: 0, pull: 1 }, false);
  assert.ok(raw > 4);
  assert.ok(roll({ fast: 2, pull: 1 }, false) < raw, 'PvE and duels: the game cuts');
  assert.equal(roll({ fast: 2, pull: 1 }, true), raw, 'the zone: the relay cuts');
  assert.equal(roll({ fast: 2, pull: 1.5 }, true), roll({ fast: 0, pull: 1.5 }, false), 'the pull kept');
  assert.ok(/const wildStrikeOut = [\s\S]{0,400}const at = \{ relayCut: true/.test(rd('src/scenes/world.js')), 'the zone host marks its strike');
});

test('SWING-RATE: a melee blow on one player comes no sooner than the quickest swing, two may bunch; a Cleave lands on each player in its arc (mutants: no bucket; one bucket for all targets)', () => {
  assert.equal(PVP_VITALS.swingMs, Math.round(MELEE_NUM_FRAMES.StrikeDown * SWING_FRAME_MIN * 1000));
  const f = newFighter(10, 0);
  assert.deepEqual([swingPaid(f, 'b', 1000), swingPaid(f, 'b', 1010), swingPaid(f, 'b', 1020)], [true, true, false]);
  assert.deepEqual([swingPaid(f, 'c', 1020), swingPaid(f, 'd', 1020)], [true, true], 'a Cleave');
  let t = 20_000, ok = 0;
  for (let i = 0; i < 40; i++) if (swingPaid(f, 'b', t += PVP_VITALS.swingMs)) ok++;
  assert.equal(ok, 40, 'an honest swing at the floor is never refused');
  const st = zone();
  const hit = (n, now) => wildBlow(st, 'acct-a', 'acct-b', { d: 5, held: FIST, rid: `dddddddddd${n}` }, now).why;
  hit('01', 10_000); hit('02', 10_050);
  assert.equal(hit('03', 10_100), 'rate');
});

test('PVP-VITALS HEALTH: flagged, a frozen bar\'s word heals only the regen it banked; a declared health potion or a paid self heal credits a rise, an unpaid heal none; a Shield counts only paid, for a minute; the whole is held to the signed level\'s (mutants: the rise unsourced; the heal unpaid; the Shield believed; the level unread)', () => {
  const f = newFighter(10, 0);
  f.max = 1000; f.hp = 1000;
  vitalsReport(f, { mp: 0 }, 0, { flagged: false });
  takeHealthReport(f, { report: 1, share: HEALTH_SHARE_WHOLE, seen: [] }, 0, { sourced: true });
  f.hp = 400;
  const t = 60_000;
  takeHealthReport(f, { report: 2, share: HEALTH_SHARE_WHOLE, seen: [] }, t, { sourced: true });
  assert.equal(f.hp, 400 + Math.floor(1000 * PVP_VITALS.regenBank), 'the regen bank, no more');
  vitalsReport(f, { mp: 0, use: [DECLARE.kit + KIT_ORDER.indexOf('heal')] }, t + 1, { flagged: true });
  assert.ok(healCredit(f, t + 1) < 5, 'a heal it cannot pay credits nothing');
  vitalsReport(f, { use: [DECLARE.hpPotion] }, t + 2, { flagged: true, cl: 30 });
  takeHealthReport(f, { report: 3, share: HEALTH_SHARE_WHOLE, seen: [] }, t + 3, { sourced: true });
  assert.equal(f.hp, 1000, 'a potion heals');
  // the Shield
  const g = newFighter(10, 0);
  takeHealthReport(g, { report: 1, share: HEALTH_SHARE_WHOLE, seen: [], shield: 25 }, 0, { sourced: true });
  assert.equal(g.share.shield, 0, 'an unpaid Shield is none');
  kitLanded(g, 'shield', 10);
  assert.equal(shieldPaid(g, 10 + PVP_VITALS.buffMs - 1), true);
  takeHealthReport(g, { report: 2, share: HEALTH_SHARE_WHOLE, seen: [], shield: 25 }, 20, { sourced: true });
  assert.equal(g.share.shield, 25);
  takeHealthReport(g, { report: 1, share: HEALTH_SHARE_WHOLE, seen: [], shield: 25 }, 0, { sourced: false });
  // the level
  assert.equal(healthCapAt(45), PVP_HEALTH_MAX);
  assert.ok(healthCapAt(30) < PVP_HEALTH_MAX && healthCapAt(30) > 1595 * 30 / 45);
  const h = newFighter(10, 0);
  takeHealthReport(h, { report: 1, share: HEALTH_SHARE_WHOLE, seen: [], max: PVP_HEALTH_MAX }, 0, { cl: 30 });
  assert.equal(h.max, healthCapAt(30), 'a level-30 claim of the cap held to its level\'s');
});

test('PVP-VITALS THE WIRE AND THE CLIENT: a report carries magicka, fatigue and its declarations, a cast its number; the mirror sends what was drunk and cast once, and says a moved magicka (mutants: a declaration out of range; the queue resent; the number dropped)', () => {
  assert.deepEqual(validVitIn({ n: 1, s: 5000, seen: [], m: 10, f: 20, u: [1, 10] }), { report: 1, share: 5000, seen: [], mp: 10, fp: 20, use: [1, 10] });
  assert.equal(validVitIn({ n: 1, s: 5000, seen: [], u: [99] }), null);
  assert.equal(validVitIn({ n: 1, s: 5000, seen: [], m: 10_001 }), null);
  assert.equal(validWildData({ k: 'spell', to: 'peer-0002', n: 1, p: [1, 2, 3], d: 5, c: 4 })?.c, 4);
  resetPvpDeclares();
  declarePotion('health'); declareKitSelf('heal'); declareKitSelf('damage');
  assert.deepEqual(pendingDeclares(), [DECLARE.hpPotion, DECLARE.kit + KIT_ORDER.indexOf('heal')]);
  const sent = [];
  let mp = 1, clock = 0;
  const mirror = createRefereeHealthMirror({ read: () => ({ health: 50, maxHealth: 100 }), write: () => {}, send: (r) => { sent.push(r); return true; }, now: () => clock, spends: () => ({ m: mp * 1000, f: 5000 }) });
  clock += 1000; mirror.frame(true);
  assert.deepEqual(sent[0].u, [1, DECLARE.kit + KIT_ORDER.indexOf('heal')]);
  assert.equal(sent[0].m, 1000);
  clock += 1000; mirror.frame(true);
  assert.equal(sent.length, 1, 'nothing moved, nothing sent');
  mp = 2;
  clock += 1000; mirror.frame(true);
  assert.equal(sent.length, 2);
  assert.equal(sent[1].u, undefined, 'a declaration goes once');
  // the seams
  assert.match(rd('src/combat/siegeCombat.js'), /\.\.\.\(pvpCastNo\(\) > 0 \? \{ c: pvpCastNo\(\) \} : \{\}\)/);
  assert.match(rd('src/combat/pvpPotions.js'), /for \(const k of kinds\) last\.set\(k, now\);\n  if \(fight\) declarePotion\(kinds\[0\]\);/);   // PIN MOVED (POTION-CLOCK): the clock also runs in an Elite Breach, where no referee is told; PIN MOVED (AUDIT POTION-MIGHT C1): every kind a bottle is starts its clock, a fight's its first effect's alone
  assert.match(rd('src/scenes/hostMagic.js'), /if \(sp\.pvpKit\) declareKitSelf\(sp\.pvpKit\);/);
  const relay = rd('server/src/index.js');
  assert.match(relay, /!\(await this\._wildCastPaid\(a, target\[1\], m\.data, now\)\)/, 'a flagged caster\'s gift is paid for');
  assert.match(relay, /sourced: pool\.flagged === true, cl: a\.cl \?\? null/);
});

test('PVP-KIT-REGEN THE RELAY: a declared Regenerate costs the bar\'s 10% and banks health credit for its minute at the kit\'s top share a second - none before, none after (mutants: the price Cure\'s; the rounds uncounted; the minute unended)', () => {
  const st = zone();
  const a = st.fighters.get('acct-a');
  vitalsReport(a.f, { mp: VITAL_WHOLE, fp: VITAL_WHOLE }, 10_000, { flagged: true });
  const before = healCredit(a.f, 10_000);
  vitalsReport(a.f, { mp: VITAL_WHOLE, fp: VITAL_WHOLE, use: [DECLARE.kit + KIT_ORDER.indexOf('regen')] }, 10_000, { flagged: true });
  assert.equal(vitalsOf(a.f, 10_000).mp, VITAL_WHOLE - (KIT_COSTS.regen * VITAL_WHOLE) / 100, 'the bar\'s price');
  assert.equal(KIT_COSTS.regen, KIT_SPELLS.regen.cost);
  const after2 = healCredit(a.f, 12_000);
  assert.ok(after2 - before >= (2 * PVP_VITALS.regenKit * a.f.max) / 100 - 1, 'two seconds of rounds banked');
  spendAll(a.f, 12_000);
  healCredit(a.f, 200_000);
  spendAll(a.f, 200_000);
  assert.ok(healCredit(a.f, 205_000) <= a.f.max * PVP_VITALS.regenBank + 1, 'past its minute, only the slow regen');
});
function spendAll(f, now) { spendCredit(f, healCredit(f, now), now); }
