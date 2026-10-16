// LOOT1 - THE LOOT ARC'S FIRST SLICE (2026-10-01; bible/06-Systems/Loot-Arc.md, Mac: "Do you wanna turn this into an
// arc and do all of the above?"): A SKILL AFFIX LEANS TO THE ITEM'S OWN SKILLS. AUDIT-LR's second note to Mac - "a
// warhammer can roll +20 Impish ... a weighting toward the group's own combat skills would be a tuning slice, not a
// fix" - is that slice. The laws pinned here:
//   - A WEAPON'S LEANS TO THE HAND: half the time its own weapon skill (the skill that swings it - weaponSkillUsed,
//     a bow's Archery, a staff's Blunt Weapon), then the strike's kin (Critical Strike, Backstabbing, Dodging) - 85
//     times in a hundred in all.
//   - ARMOUR'S TO THE BODY, JEWELLERY'S TO THE MIND, 85 times in a hundred.
//   - A WEIGHTING, NEVER A FENCE: the rest of the time any skill, a language among them (9 in 35 before; about 1 in 30).
//   - NEVER EMPTY, NEVER A REPEAT: a step with no free skill gives way to the next.
//   - THE LEGENDARIES' SKILLS ARE THEIR RECORDS' - no roll moves them.

import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setPref, _resetForTests } from '../../src/systems/uiPrefs.js';
import * as LR from '../../src/systems/loot/lootRarity.js';
import { createWeapon } from '../../src/combat/enemyEquipment.js';
import { mintCondition } from '../../src/systems/item/itemTemplates.js';
import { SKILLS, MAGIC_SKILLS } from '../../src/systems/skills.js';

const on = () => { _resetForTests(); setPref('lootRarity', true); };
const lcg = (seed) => () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >>> 8) / 0x800000; };
const armour = (t = 102) => mintCondition({ group: 'Armor', templateIndex: t, material: 0x0200 + 1, name: 'Cuirass', flags: 0 });
const jewel = (t = 135) => mintCondition({ group: 'Jewellery', templateIndex: t, name: 'Ring', flags: 0 });
const LANGUAGES = [SKILLS.Orcish, SKILLS.Harpy, SKILLS.Giantish, SKILLS.Dragonish, SKILLS.Nymph, SKILLS.Daedric, SKILLS.Spriggan,
  SKILLS.Centaurian, SKILLS.Impish];

/** Every skill affix a tier mints over many rolls of one base - or, `first`, each piece's first (a second skill affix on
 *  one piece can never be the first's skill, so its own share is the first draw's). */
function skillDraws(make, tier, n, seed, { first = false } = {}) {
  const rolls = lcg(seed);
  const out = [];
  for (let i = 0; i < n; i++) {
    const skills = LR.rollAffixes(make(), tier, rolls).filter((a) => a.id === 'skill').map((a) => a.param);
    out.push(...(first ? skills.slice(0, 1) : skills));
  }
  return out;
}
const share = (list, pred) => list.filter(pred).length / list.length;

test('LOOT1: the kin - a weapon\'s own skill and the strike\'s three, the body\'s twelve, the mind\'s thirteen', () => {
  assert.deepEqual(LR.skillKin(createWeapon(120, 1)), { own: SKILLS.LongBlade, kin: [SKILLS.CriticalStrike, SKILLS.Backstabbing, SKILLS.Dodging] }, 'a longsword');
  assert.equal(LR.skillKin(createWeapon(113, 1)).own, SKILLS.ShortBlade, 'a dagger');
  assert.equal(LR.skillKin(createWeapon(115, 1)).own, SKILLS.BluntWeapon, 'a staff is swung as a blunt weapon');
  assert.equal(LR.skillKin(createWeapon(127, 1)).own, SKILLS.Axe, 'a battle axe');
  assert.equal(LR.skillKin(createWeapon(130, 1)).own, SKILLS.Archery, 'a long bow');
  const body = LR.skillKin(armour()).kin;
  assert.equal(LR.skillKin(armour()).own, null, 'armour swings nothing');
  for (const s of [SKILLS.ShortBlade, SKILLS.LongBlade, SKILLS.HandToHand, SKILLS.Axe, SKILLS.BluntWeapon, SKILLS.Archery, SKILLS.CriticalStrike,
    SKILLS.Dodging, SKILLS.Running, SKILLS.Jumping, SKILLS.Climbing, SKILLS.Swimming]) assert.ok(body.includes(s), `the body's: ${s}`);
  assert.equal(body.length, 12);
  const mind = LR.skillKin(jewel()).kin;
  for (const s of [...MAGIC_SKILLS, SKILLS.Etiquette, SKILLS.Streetwise, SKILLS.Mercantile, SKILLS.Lockpicking, SKILLS.Pickpocket, SKILLS.Stealth,
    SKILLS.Medical]) assert.ok(mind.includes(s), `the mind's: ${s}`);
  assert.equal(mind.length, 13);
  for (const k of [body, mind]) for (const s of LANGUAGES) assert.ok(!k.includes(s), 'no language is anyone\'s kin');
  assert.deepEqual(LR.skillKin({ group: 'Books' }), { own: null, kin: [] }, 'nothing else leans');
});

test('LOOT1: a weapon\'s skill affix is its own half the time and the hand\'s 85 in a hundred; a language about one in 30', () => {
  on();
  const draws = skillDraws(() => createWeapon(126, 1), 'rare', 1500, 11);   // a warhammer - AUDIT-LR's own example
  assert.ok(draws.length > 400, `enough draws (${draws.length})`);
  const firsts = skillDraws(() => createWeapon(126, 1), 'rare', 1500, 11, { first: true });
  const own = share(firsts, (s) => s === SKILLS.BluntWeapon);
  const hand = share(draws, (s) => [SKILLS.BluntWeapon, SKILLS.CriticalStrike, SKILLS.Backstabbing, SKILLS.Dodging].includes(s));
  const tongue = share(draws, (s) => LANGUAGES.includes(s));
  assert.ok(own > 0.42 && own < 0.62, `its own skill about half the time (${own.toFixed(3)})`);
  assert.ok(hand > 0.82, `the hand's 85 times in a hundred or so (${hand.toFixed(3)})`);
  assert.ok(tongue < 0.06, `a language rarely (${tongue.toFixed(3)}) - it was 9 in 35 before`);
  assert.ok(draws.some((s) => LANGUAGES.includes(s)), 'but never fenced off: a weighting');
});

test('LOOT1: armour leans to the body and jewellery to the mind, 85 times in a hundred', () => {
  on();
  const body = LR.skillKin(armour()).kin, mind = LR.skillKin(jewel()).kin;
  const a = skillDraws(() => armour(104), 'rare', 1200, 21);
  const j = skillDraws(() => jewel(133), 'rare', 1200, 31);
  const as = share(a, (s) => body.includes(s)), js = share(j, (s) => mind.includes(s));
  assert.ok(as > 0.82 && as < 0.97, `armour: the body's (${as.toFixed(3)})`);
  assert.ok(js > 0.82 && js < 0.97, `jewellery: the mind's (${js.toFixed(3)})`);
  assert.ok(a.some((s) => !body.includes(s)) && j.some((s) => !mind.includes(s)), 'the open quarter reaches the rest');
});

test('LOOT1: never empty, never a repeat - a step with no free skill gives way to the next', () => {
  on();
  // a Rare can carry two skill affixes only when no other kind is free; force the case: every draw a skill
  const sword = createWeapon(120, 1);
  const rolls = lcg(7);
  for (let i = 0; i < 400; i++) {
    const out = LR.rollAffixes(sword, 'rare', rolls);
    const skills = out.filter((a) => a.id === 'skill').map((a) => a.param);
    assert.equal(new Set(skills).size, skills.length, 'a skill never twice on one piece');
    for (const a of out) assert.ok(LR.validAffix(a), JSON.stringify(a));
  }
  // the draw itself: own taken, kin taken - any free skill, never undefined
  const only = [SKILLS.Medical];
  const k = LR.AFFIX_KINDS.skill;
  assert.ok(k.params.includes(SKILLS.Medical));
  const pick = LR._pickSkillForTests(createWeapon(120, 1), only, () => 0.1);
  assert.equal(pick, SKILLS.Medical, 'the own skill and the kin gone, the last free one');
  assert.equal(LR._pickSkillForTests(createWeapon(120, 1), [SKILLS.LongBlade, SKILLS.Medical], () => 0.1), SKILLS.LongBlade, 'under the own share: its own');
  assert.equal(LR._pickSkillForTests(createWeapon(120, 1), [SKILLS.CriticalStrike, SKILLS.Medical], () => 0.1), SKILLS.CriticalStrike, 'its own taken: the kin');
  assert.equal(LR._pickSkillForTests(createWeapon(120, 1), [SKILLS.LongBlade, SKILLS.Medical], () => 0.99), SKILLS.Medical, 'past the kin share: any - the open draw');
  assert.equal(LR._pickSkillForTests(createWeapon(120, 1), [SKILLS.CriticalStrike, SKILLS.Medical], () => 0.8), SKILLS.CriticalStrike, 'under 85: still the kin');
  assert.equal(LR._pickSkillForTests(createWeapon(120, 1), [SKILLS.CriticalStrike, SKILLS.Medical], () => 0.99), SKILLS.Medical, 'over 85: the open draw, over every free skill');
  assert.equal(LR._pickSkillForTests(createWeapon(120, 1), [SKILLS.CriticalStrike, SKILLS.Medical], () => 0.86), SKILLS.CriticalStrike, 'the open draw may land on a kin skill too');
});

test('LOOT1: one roll, as the draw it replaced took - every seeded mint draws as many rolls as it did', () => {
  on();
  for (const make of [() => createWeapon(126, 1), () => armour(104), () => jewel(133)]) {
    for (let seed = 1; seed < 400; seed++) {
      let n = 0;
      const base = lcg(seed);
      const counted = () => { n++; return base(); };
      const free = [...Array(35).keys()].filter((s) => (s * seed) % 3 !== 0);
      LR._pickSkillForTests(make(), free, counted);
      assert.equal(n, 1, 'one roll a skill');
    }
  }
  // and each step's interval spread over its whole list: every kin skill and every free skill reachable
  const sword = createWeapon(120, 1);
  const free = [...Array(35).keys()];
  const seen = new Set();
  for (let i = 0; i < 2000; i++) seen.add(LR._pickSkillForTests(sword, free, () => i / 2000));
  assert.equal(seen.size, 35, 'every skill a weapon may draw');
  for (const s of [SKILLS.CriticalStrike, SKILLS.Backstabbing, SKILLS.Dodging]) assert.ok(seen.has(s));
  // the kin's interval (the own skill free: [0.5, 0.85)) spread evenly over its three
  const kinCount = new Map();
  for (let i = 0; i < 3500; i++) { const k = LR._pickSkillForTests(sword, free, () => 0.5 + (0.35 * i) / 3500); kinCount.set(k, (kinCount.get(k) ?? 0) + 1); }
  for (const s of [SKILLS.CriticalStrike, SKILLS.Backstabbing, SKILLS.Dodging]) assert.ok(Math.abs(kinCount.get(s) / 3500 - 1 / 3) < 0.01, `the kin even: ${s}`);
});

test('LOOT1: the Legendaries\' skills are their records\' - a roll moves none', () => {
  on();
  for (const rec of LR.LEGENDARIES) {
    const base = rec.group === 'Weapons' ? createWeapon(rec.templates?.[0] ?? 120, 1) : rec.group === 'Armor' ? armour(rec.templates?.[0] ?? 102) : jewel(rec.templates?.[0] ?? 135);
    const l = LR.applyRarity(base, 'legendary', lcg(3), [rec]);
    assert.deepEqual(l.affixes.filter((a) => a.id === 'skill'), rec.affixes.filter((a) => a.id === 'skill'), rec.id);
  }
});
