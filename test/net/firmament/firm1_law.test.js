// FIRM1 (2026-10-13) - THE FIRMAMENT'S SKY AND LAW (src/net/firmament/firmamentTree.js, src/net/firmament/firmamentLaw.js): the sky's shape
// PoE's (seven starts, every star reachable, none crowding another, its keys persisted data), the two purses, the life
// ring paid by Craft and never a fight, the law's whole-tree judgement, the path preview and the refund's cascade, and
// THE BUDGET - however the whole sky is spent, no channel past its cap. bible/06-Systems/Firmament.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import { FIRM_NODES, FIRM_EDGES, FIRM_ADJ, START_KEYS, SIGNS, firmNode } from '../../../src/net/firmament/firmamentTree.js';
import {
  starsFor, craftPointsFor, FIRM_RENOWN_MAX, CRAFT_RANK_MAX, GATHERING, CRAFTING, ATTRIBUTES, COMBAT_SKILLS, LIFE_SKILLS,
  statDef, statWords, firmCostOf, fits, pointsLeft, treeFault, pathTo, refundTakes, treeDiff, refundSilver, totals, capped,
  treeStats, blowPct, castCostPct, BLOW_CAP, BLOW_TOTAL_CAP, CAST_COST_CAP, packTree, unpackTree, cleanKeys, scaleQty,
  scaleXp, REFUND_FREE_BELOW_RENOWN, REFUND_SILVER_PER_STAR, overCap, allocatable,
  buildCode, treeOfCode, SKY_TAG, BUILD_CODE_RE,
} from '../../../src/net/firmament/firmamentLaw.js';
import { RENOWN_MAX } from '../../../src/net/identityToken.js';
import { PROFESSIONS, PROF_RANK_MAX } from '../../../src/net/professionLaw.js';
import { STAT_KEYS_ORDER } from '../../../src/systems/statMods.js';
import { SKILLS } from '../../../src/systems/skills.js';

/** A tree walked from `start` to each of `targets` in turn, by the law's own shortest path. */
function walk(start, ...targets) {
  const tree = { start, keys: [] };
  for (const t of targets) tree.keys.push(...pathTo(tree, t));
  return tree;
}
const ALL = [...FIRM_NODES.values()];

test('FIRM1 sky: PoE\'s shape - seven starts (six signs on the inner ring, the Serpent in the middle), every star reachable from the middle, every line between two stars the sky has', () => {
  assert.deepEqual(START_KEYS, ['sp.start', 'mg.start', 'sh.start', 'th.start', 'st.start', 'wr.start', 'rt.start']);
  assert.equal(SIGNS.length, 6);
  for (const k of START_KEYS) assert.equal(firmNode(k)?.kind, 'start', k);
  assert.deepEqual([firmNode('sp.start').x, firmNode('sp.start').y], [0, 0]);
  const seen = new Set(['sp.start']), q = ['sp.start'];
  while (q.length) for (const n of FIRM_ADJ.get(q.pop())) if (!seen.has(n)) { seen.add(n); q.push(n); }
  assert.equal(seen.size, FIRM_NODES.size, 'one sky');
  for (const e of FIRM_EDGES) assert.ok(FIRM_NODES.has(e.a) && FIRM_NODES.has(e.b) && e.a !== e.b, `${e.a}|${e.b}`);
  // each sign: one combat keystone and one life keystone, and named notables
  for (const s of SIGNS) {
    assert.equal(ALL.filter((n) => n.sector === s.id && n.kind === 'keystone' && n.ring === 'combat').length, 1, s.id);
    assert.equal(ALL.filter((n) => n.sector === s.id && n.kind === 'keystone' && n.ring === 'life').length, 1, s.id);
    assert.ok(ALL.filter((n) => n.sector === s.id && n.kind === 'notable').length >= 15, s.id);
  }
});

test('FIRM1 sky: no star crowds another (38 units apart at the least - a star\'s own ring and a hover\'s), and a keystone ends its road', () => {
  let least = Infinity;
  for (let i = 0; i < ALL.length; i++) for (let j = i + 1; j < ALL.length; j++) least = Math.min(least, Math.hypot(ALL[i].x - ALL[j].x, ALL[i].y - ALL[j].y));
  assert.ok(least >= 38, `the closest two stars are ${least.toFixed(1)} apart`);
  for (const n of ALL.filter((x) => x.kind === 'keystone')) assert.equal(FIRM_ADJ.get(n.key).length, 1, `${n.key} is a road's end`);
});

test('FIRM1 sky: THE TRADES TAKE NOTHING AWAY - no life star carries a negative; a battle keystone\'s price is small', () => {
  for (const n of FIRM_NODES.values()) {
    for (const [k, v] of Object.entries(n.stats ?? {})) {
      if (n.ring === 'life') assert.ok(v >= 0, `${n.key} ${k} ${v}`);
      else if (n.kind === 'keystone' && v < 0) assert.ok(v >= -5, `${n.key} ${k} ${v}`);
    }
  }
});

test('FIRM1 sky: PERSISTED DATA - the keys a tree is stored by are pinned whole (a key never changes once shipped; new stars take new keys)', () => {
  const keys = [...FIRM_NODES.keys()].sort();
  assert.equal(keys.length, 518);
  assert.ok(keys.every((k) => /^(sp|mg|sh|th|st|wr|rt)\.[a-z0-9]+(\.[0-9]+)?$/.test(k)), 'every key in its shape');
  assert.equal(createHash('sha256').update(keys.join(',')).digest('hex').slice(0, 16), '9181ce67bbbb4867');
});

test('FIRM1 law: the restated bounds equal their homes - Renown\'s cap, a track\'s rank, the professions, the attributes and skills', () => {
  assert.equal(FIRM_RENOWN_MAX, RENOWN_MAX);
  assert.equal(CRAFT_RANK_MAX, PROF_RANK_MAX);
  assert.deepEqual([...GATHERING, ...CRAFTING].sort(), PROFESSIONS.map((p) => p.id).sort());
  assert.deepEqual([...ATTRIBUTES], [...STAT_KEYS_ORDER]);
  for (const n of [...COMBAT_SKILLS, ...LIFE_SKILLS]) assert.ok(Number.isInteger(SKILLS[n]), n);
  assert.equal(new Set([...COMBAT_SKILLS, ...LIFE_SKILLS]).size, COMBAT_SKILLS.length + LIFE_SKILLS.length);
});

test('FIRM1 law: every stat a star carries is a channel - and a LIFE star carries life channels alone, a combat star combat ones (the Craft purse never reaches a fight)', () => {
  for (const n of ALL) {
    for (const [k, v] of Object.entries(n.stats)) {
      const d = statDef(k);
      assert.ok(d, `${n.key}: ${k} is no channel`);
      assert.ok(Number.isFinite(v) && v !== 0, `${n.key}: ${k}`);
      if (n.ring === 'life') assert.equal(d.kind, 'life', `${n.key} (life) carries ${k}`);
      else if (n.kind !== 'start') assert.equal(d.kind, 'combat', `${n.key} (combat) carries ${k}`);
      assert.ok(typeof statWords(k, v) === 'string' && !statWords(k, v).includes('undefined'), `${k} says itself`);
    }
  }
  assert.equal(statDef('skill.Mercantile').kind, 'life');
  assert.equal(statDef('skill.LongBlade').kind, 'combat');
  assert.equal(statDef('personality').kind, 'life');
  assert.equal(statDef('strength').kind, 'combat');
  assert.equal(statDef('yield.smithing'), null, 'a craft has no yield');
  assert.equal(statDef('skill.Nonsense'), null);
});

test('FIRM1 law: the purses - 2 Stars a Renown level past the first (98 at 50, never past it), 1 Craft point per 8 ranks (125 at ten Masters)', () => {
  assert.deepEqual([starsFor(1), starsFor(2), starsFor(10), starsFor(50), starsFor(99), starsFor(-3), starsFor(null)], [0, 2, 18, 98, 98, 0, 0]);
  assert.deepEqual([craftPointsFor([]), craftPointsFor([7]), craftPointsFor([8]), craftPointsFor([50, 30]), craftPointsFor(new Array(10).fill(100)), craftPointsFor([400])], [0, 0, 1, 10, 125, 12]);
});

test('FIRM1 law: what fits - a combat star is Stars\' alone, a life star Craft first and then Stars; what is left in each', () => {
  const combat = walk('wr.start', 'wr.r1');   // s1 s2 g r1
  const life = walk('wr.start', 'wr.lr1');    // the Wayfarer's Road out
  assert.deepEqual(firmCostOf(combat.keys), { combat: 4, life: 0 });
  assert.equal(firmCostOf(life.keys).combat, 0);
  const L = firmCostOf(life.keys).life;
  assert.ok(fits(combat.keys, 4, 0) && !fits(combat.keys, 3, 100), 'Craft never pays a combat star');
  assert.ok(fits(life.keys, 0, L) && fits(life.keys, L, 0) && !fits(life.keys, 0, L - 1) && fits(life.keys, 1, L - 1));
  assert.deepEqual(pointsLeft(life.keys, 10, 3), { stars: 10 - (L - 3), craft: 0 });
  assert.deepEqual(pointsLeft([...combat.keys, ...life.keys], 10, 50), { stars: 6, craft: 50 - L });
});

test('FIRM1 law: a tree judged whole - a start, its stars joined to it through stars held, within the purses; a keystone ends a road; another sign\'s start is no road', () => {
  const t = walk('mg.start', 'mg.k');
  assert.equal(treeFault(t, 98, 0), null);
  assert.equal(treeFault({ start: null, keys: [] }, 0, 0), null, 'no sky at all is whole');
  assert.equal(treeFault({ start: null, keys: ['mg.s1'] }, 98, 0), 'firm-start');
  assert.equal(treeFault({ start: 'nope.start', keys: [] }, 98, 0), 'firm-start');
  assert.equal(treeFault({ start: 'mg.start', keys: ['mg.s2'] }, 98, 0), 'firm-path');
  assert.equal(treeFault({ start: 'mg.start', keys: ['mg.s1', 'mg.s1'] }, 98, 0), 'firm-key');
  assert.equal(treeFault({ start: 'mg.start', keys: ['mg.s1', 'wr.start'] }, 98, 0), 'firm-key');
  assert.equal(treeFault({ start: 'mg.start', keys: ['mg.s1', 'no.such'] }, 98, 0), 'firm-key');
  assert.equal(treeFault(t, t.keys.length - 1, 0), 'firm-points');
  // a keystone is a road's end: a star beyond it (none in the sky) could never be walked to through it
  for (const n of ALL.filter((x) => x.kind === 'keystone')) assert.ok(FIRM_ADJ.get(n.key).every((nb) => firmNode(nb).kind !== 'keystone'));
  // another sign's start is never walked through: from the Mage, the Shadow's spoke is reached round the inner ring's crossing
  const p = pathTo({ start: 'mg.start', keys: [] }, 'sh.s1');
  assert.ok(p.length && !p.includes('sh.start'), p.join(' '));
});

test('FIRM1 law: the path preview is the SHORTEST way from what is held, nearest first, the target last; a star held, a start, or none chosen - no way', () => {
  const t = { start: 'th.start', keys: [] };
  assert.deepEqual(pathTo(t, 'th.s1'), ['th.s1']);
  assert.deepEqual(pathTo(t, 'th.g'), ['th.s1', 'th.s2', 'th.g']);
  assert.ok(allocatable(t, 'th.s1') && !allocatable(t, 'th.s2'));
  const held = { start: 'th.start', keys: ['th.s1', 'th.s2', 'th.g'] };
  assert.deepEqual(pathTo(held, 'th.r1'), ['th.r1'], 'from the nearest star held');
  assert.deepEqual(pathTo(held, 'th.g'), []);
  assert.deepEqual(pathTo(held, 'mg.start'), []);
  assert.deepEqual(pathTo({ start: null, keys: [] }, 'th.s1'), []);
  // every star of the sky is reachable from every sign
  for (const s of START_KEYS) for (const k of ['mg.k', 'wr.lk', 'st.l4.4', 'sh.c7.2']) assert.ok(pathTo({ start: s, keys: [] }, k).length > 0, `${s} -> ${k}`);
});

test('FIRM1 law: a refund takes the star and every star that only reached the sign through it; a ring\'s other way keeps what it still reaches', () => {
  const t = walk('wr.start', 'wr.k');
  assert.deepEqual(refundTakes(t, 'wr.r1'), ['wr.k', 'wr.k1', 'wr.r1', 'wr.r2']);
  assert.deepEqual(refundTakes(t, 'wr.k'), ['wr.k']);
  assert.deepEqual(refundTakes(t, 'mg.s1'), []);
  // a wheel walked both ways round: one star taken leaves the rest held by the other way
  const wheel = walk('wr.start', ...['wr.c1.0', 'wr.c1.1', 'wr.c1.2', 'wr.c1.3', 'wr.c1.4', 'wr.c1.5', 'wr.c1.6']);
  assert.deepEqual(refundTakes(wheel, 'wr.c1.3'), ['wr.c1.3']);
});

test('FIRM1 law: a change\'s diff, and the refund\'s silver - free below Renown 10, then 10 a star', () => {
  const a = walk('st.start', 'st.r1'), b = walk('st.start', 'st.s2');
  assert.deepEqual(treeDiff(a, b), { added: [], removed: ['st.g', 'st.r1'], startChanged: false });
  assert.deepEqual(treeDiff(a, { start: 'mg.start', keys: [] }).removed.length, a.keys.length, 'a new sign takes every star back');
  assert.deepEqual([refundSilver(5, 1), refundSilver(5, REFUND_FREE_BELOW_RENOWN - 1), refundSilver(5, REFUND_FREE_BELOW_RENOWN), refundSilver(0, 50)],
    [0, 0, 5 * REFUND_SILVER_PER_STAR, 0]);
});

test('FIRM1 law: THE BUDGET - the whole sky allocated at once holds every channel to its cap, and the blow, the spell\'s price and the hurt taken to their groups', () => {
  const everything = { start: 'wr.start', keys: cleanKeys([...FIRM_NODES.keys()]) };
  const raw = totals(everything);
  const c = treeStats(everything);
  assert.ok(overCap(raw).length > 10, 'the whole sky is far past the budget - which is the point of one');
  for (const [k, v] of Object.entries(c)) { const d = statDef(k); assert.ok(v <= d.max && v >= d.min, `${k} ${v}`); }
  // the blow: the general channels capped as a group, the conditions after, the whole capped again
  for (const skill of ['ShortBlade', 'LongBlade', 'Axe', 'BluntWeapon', 'Archery', 'HandToHand', null]) {
    for (const group of ['undead', 'daedra', 'animal', 'humanoid', null]) {
      assert.ok(blowPct(c, { skill, group }) <= BLOW_CAP);
      assert.ok(blowPct(c, { skill, group, unaware: true, wounded: true }) <= BLOW_TOTAL_CAP);
    }
  }
  assert.equal(blowPct({ weaponDmg: 25, meleeDmg: 25, axeDmg: 25 }, { skill: 'Axe' }), BLOW_CAP);
  assert.equal(blowPct({ weaponDmg: 10, bowDmg: 10, meleeDmg: 99 }, { skill: 'Archery' }), 20, 'a bow is no melee weapon');
  assert.equal(blowPct({ unawareDmg: 40, weaponDmg: -10 }, { skill: 'ShortBlade' }), -10, 'the keystone\'s price in an open fight');
  assert.equal(blowPct({ unawareDmg: 40, weaponDmg: 30 }, { skill: 'ShortBlade', unaware: true }), BLOW_TOTAL_CAP);
  assert.equal(castCostPct({ castCost: 20, 'castCost.Destruction': 20 }, ['Destruction']), CAST_COST_CAP);
  assert.equal(castCostPct({ castCost: 5, 'castCost.Destruction': 8 }, ['Destruction', 'Restoration']), 5, 'a school\'s own only where every effect is its');
  assert.ok(c.blowTaken >= -15 && c.spellTaken >= -15);
  assert.deepEqual(capped({ strength: 99, hp: -5, nonsense: 3, spellPower: 0 }), { strength: 15, hp: 0 });
});

// PIN MOVED (AUDIT UICALM-FIRM1 L5 L3): the build spent 35 of the 98 its title promised, and its trim never ran - it
// now walks the sky from the Warrior's sign star by star, nearest first (its own 49 first, then on), until the Renown 50
// purse is spent
test('FIRM1 law: the PvE budget a real build reaches - a whole Renown 50 purse spent from the Warrior\'s sign adds no more than the caps to a blow and never a channel past one', () => {
  const t = walk('wr.start', 'wr.k');
  const stars = starsFor(50);
  for (;;) {
    const next = [...FIRM_NODES.values()].filter((n) => n.ring !== 'life' && n.kind !== 'start' && !t.keys.includes(n.key))
      .map((n) => pathTo(t, n.key)).filter((p) => p.length && treeFault({ start: t.start, keys: [...t.keys, ...p] }, stars, 0) === null).sort((a, b) => a.length - b.length)[0];
    if (!next) break;
    t.keys.push(...next);
  }
  const spent = firmCostOf(t.keys).combat + firmCostOf(t.keys).life;
  assert.ok(spent >= stars - 2, `spent ${spent} of ${stars}`);
  assert.equal(treeFault(t, stars, 0), null);
  const c = treeStats(t);
  assert.ok(blowPct(c, { skill: 'Axe', group: 'undead', wounded: true }) <= BLOW_TOTAL_CAP);
  assert.ok((c.hp ?? 0) <= 75 && (c.blowTaken ?? 0) >= -15);
});

test('FIRM1 law: the row - packed and unpacked, cleaned (a star taken out of the sky is dropped, which is its refund); the service\'s yield and XP', () => {
  const t = walk('rt.start', 'rt.r2');
  assert.equal(packTree(t), `rt.start|${[...t.keys].sort().join(',')}`);
  assert.deepEqual(unpackTree(packTree(t)), { start: 'rt.start', keys: [...t.keys].sort() });
  assert.deepEqual(unpackTree(''), { start: null, keys: [] });
  assert.deepEqual(unpackTree('zz.start|rt.s1'), { start: null, keys: [] });
  assert.deepEqual(unpackTree('rt.start|rt.s1,gone.star,rt.s1'), { start: 'rt.start', keys: ['rt.s1'] });
  assert.equal(packTree({ start: null, keys: ['rt.s1'] }), '');
  assert.deepEqual([scaleQty(2, 50, 0.99), scaleQty(2, 50, 0), scaleQty(3, 10, 0.29), scaleQty(3, 10, 0.31), scaleQty(1, -50, 0.9), scaleQty(0, 30, 0), scaleQty(4, 0, 0)], [3, 3, 4, 3, 1, 0, 4]);
  assert.deepEqual([scaleXp(15, 10), scaleXp(15, 0), scaleXp(100, -20), scaleXp(75, 35)], [16, 15, 80, 101]);
});

test('FIRM1 law: THE BUILD CODE - a tree as a short line to paste in Discord and load back, whole; another sky\'s code, a stranger\'s text, a code with no sign, each refused', () => {
  const t = { start: 'th.start', keys: [] };
  for (const k of ['th.k', 'th.lk']) t.keys.push(...pathTo(t, k));
  const code = buildCode(t);
  assert.match(code, BUILD_CODE_RE);
  assert.ok(code.length < 40, code);
  assert.ok(!code.includes('_') && !code.includes('*'), 'nothing Discord reads as markup');
  assert.deepEqual(treeOfCode(`  ${code} `).tree, { start: 'th.start', keys: cleanKeys(t.keys) });
  const all = [...FIRM_NODES.keys()].filter((k) => !START_KEYS.includes(k));
  const every = { start: 'sp.start', keys: cleanKeys(all) };
  assert.deepEqual(treeOfCode(buildCode(every)).tree, every, 'the whole sky round-trips');
  assert.equal(buildCode({ start: null, keys: [] }), null);
  assert.deepEqual(treeOfCode(code.replace(SKY_TAG, SKY_TAG === '0000' ? '0001' : '0000')), { error: 'build-sky' });
  assert.deepEqual(treeOfCode('mg.start|mg.s1'), { error: 'build-code' });
  assert.deepEqual(treeOfCode(`FIRM-${SKY_TAG}-.A`), { error: 'build-start' });
});
