// PVP-GUARD (the PvP rework, 2026-10-28, "Real health + armour"): a player's blow on a player is taken through the struck
// player's armour - the overhaul's reduction (combat/pcaao.js) for the blow's kind, averaged over the body parts - before
// PVP-HIT's cap. The struck player reports the shares (`g` on the vit frame); the referee bounds them. PVP-WARD: its
// resistances the same way for a player's spell, by the spell's element (`w`, and the cast's `el`).

import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { EQUIP_SLOTS, equipTableOf } from '../../src/systems/equip.js';
import { pvpArmorKept, pvpWardKept } from '../../src/combat/pvpGuard.js';
import { pvpSpellElement, pvpCastFrame } from '../../src/combat/siegeCombat.js';
import { duelAttackerOf, resolveDuelStrike, duelStandIn } from '../../src/combat/duelCombat.js';
import { PVP_GUARD, PVP_WARD, guardedBlow, wardedCast, takeHealthReport, HEALTH_SHARE_WHOLE } from '../../src/net/siege/refereeHealthShare.js';
import { SIEGE_HIT, SIEGE_UNITS_PER_M, newFighter, refereeBlow, refereeCast, pvpBlowKind } from '../../src/net/siege/siegeRef.js';
import { savingLands } from '../../src/systems/spellcast.js';
import { PVP_TRIANGLE, pvpArrowScale, pvpSpellScale } from '../../src/combat/pvpTriangle.js';
import { pvpShielded } from '../../src/combat/pvpGuard.js';
import { PVP_SHIELD, shieldedBlow } from '../../src/net/siege/refereeHealthShare.js';
import { PVP_HIT } from '../../src/net/siege/siegeRef.js';
import { validVitIn, validDuelData, validSiegeIn, VIT_GUARD_MAX, PVP_ELEMENTS } from '../../src/net/wire.js';
import { createRefereeHealthMirror, createPlayerHealthMirror } from '../../src/net/siege/refereeHealthMirror.js';
import { PVP_POTION_MS, pvpPotionKind, pvpPotionRefusal, pvpPotionDrunk, pvpPotionBundle, playerInPvpFight, resetPvpPotions } from '../../src/combat/pvpPotions.js';
import { POTION_RECIPES, potionRecipeKey } from '../../src/systems/potionRecipes.js';
import { useItem } from '../../src/systems/useItem.js';
import { TEMPLATES } from '../../src/systems/item/itemKinds.js';
import { PVP_ARMOUR_CAST, pvpArmourCast } from '../../src/combat/pvpArmourCasting.js';
import { calculateCastCost } from '../../src/systems/spellcost.js';
import { castRate } from '../../src/systems/castSpeed.js';
import { buildCustomSpell } from '../../src/systems/spell/spellMaker.js';
import { setPvpFight } from '../../src/combat/pvpPotions.js';
import { pvpSpellCrit, pvpCritHarm } from '../../src/combat/pvpSpellCrit.js';
import { SKILLS as SK } from '../../src/systems/skills.js';
import { PVP_BUFF_ROUNDS, capPvpBuffs } from '../../src/combat/pvpBuffs.js';

const stats = (v) => ({ strength: v, intelligence: 50, willpower: v, agility: 50, endurance: v, personality: 50, speed: 50, luck: 50 });
const body = (v = 50) => ({ isPlayer: true, level: 5, stats: stats(v), skills: {}, items: [], health: 50, maxHealth: 60 });
const PIECES = [[102, 'ChestArmor'], [103, 'LegsArmor'], [107, 'Head'], [104, 'LeftArm'], [105, 'RightArm'], [106, 'Gloves'], [108, 'Feet']];
const suit = (e, material, condition = 1000) => {
  const t = equipTableOf(e);
  for (const [templateIndex, slot] of PIECES) t[EQUIP_SLOTS[slot]] = { group: 'Armor', templateIndex, material, maxCondition: 1000, currentCondition: condition };
  return e;
};
const at = (m) => ({ x: m * SIEGE_UNITS_PER_M, y: 0, z: 0 });

test('PVP-GUARD: the shares a body reports - bare is whole, Daedric plate keeps the overhaul\'s rows, the natural resistance on top (mutants: a kind\'s row swapped; the resistance unread)', () => {
  assert.deepEqual(pvpArmorKept(body(50)), [100, 100, 100], 'bare, at 50s');
  assert.deepEqual(pvpArmorKept(body(100)), [80, 80, 80], 'bare, at 100s: the resistance alone');
  assert.deepEqual(pvpArmorKept(suit(body(50), 0x209)), [34, 40, 30], 'Daedric: edged, blunt, unarmed');
  assert.deepEqual(pvpArmorKept(suit(body(100), 0x209)), [14, 20, 10], 'Daedric at 100s');
  assert.deepEqual(pvpArmorKept(suit(body(50), 0)), [88, 72, 90], 'leather');
  const worn = pvpArmorKept(suit(body(50), 0x209, 100));
  assert.ok(worn[0] > 34, 'a worn suit keeps less off');
});

test('PVP-GUARD: the kind of a blow, and the referee takes the reported share before PVP-HIT (mutants: the guard unread; blunt read as edged)', () => {
  assert.deepEqual([pvpBlowKind(-1), pvpBlowKind(124), pvpBlowKind(115), pvpBlowKind(120), pvpBlowKind(130)], ['unarmed', 'blunt', 'blunt', 'edged', 'edged']);
  const now = 1_000_000;
  const a = newFighter(10, now);
  const b = newFighter(50, now); b.max = 1000; b.hp = 1000;
  assert.equal(guardedBlow(b, 'edged', 200), 200, 'unreported: nothing worn');
  assert.equal(takeHealthReport(b, { report: 1, share: HEALTH_SHARE_WHOLE, seen: [], max: 1000, guard: [34, 40, 30] }, now), true);
  assert.deepEqual(b.share.guard, [34, 40, 30]);
  const blow = (w, d, t) => refereeBlow(a, b, { from: at(0), at: at(2), held: { w, m: 0 }, d, r: SIEGE_HIT.Melee }, t);
  assert.equal(blow(120, 200, now).dealt, 68, 'a longsword: 34%');
  assert.equal(blow(124, 200, now + 1000).dealt, 80, 'a mace: 40%');
  assert.equal(blow(-1, 200, now + 2000).dealt, 60, 'a fist: 30%');
  assert.equal(blow(120, 2000, now + 3000).dealt, 340, 'the armour first, then the 34% cap');
  assert.equal(guardedBlow(b, 'edged', 1), 1, 'a blow that lands takes at least 1');
  assert.equal(guardedBlow(b, 'edged', 0), 0);
});

test('PVP-GUARD: the referee bounds a claim - never under PVP_GUARD.min, never over its max; the wire takes three shares or none (mutants: the floor unread)', () => {
  assert.deepEqual(PVP_GUARD, { min: 10, max: 150, bare: 100 });
  const now = 1_000_000;
  const b = newFighter(50, now); b.max = 1000; b.hp = 1000;
  takeHealthReport(b, { report: 1, share: HEALTH_SHARE_WHOLE, seen: [], guard: [0, 3, 150] }, now);
  assert.deepEqual(b.share.guard, [10, 10, 150]);
  const base = { n: 1, s: 5000, seen: [] };
  assert.deepEqual(validVitIn({ ...base, g: [34, 40, 30] })?.guard, [34, 40, 30]);
  assert.equal(validVitIn({ ...base }).guard, undefined);
  assert.equal(validVitIn({ ...base, g: [34, 40] }), null, 'three or none');
  assert.equal(validVitIn({ ...base, g: [34, 40, VIT_GUARD_MAX + 1] }), null);
  assert.equal(validVitIn({ ...base, g: [34, 40, 1.5] }), null);
});

test('PVP-GUARD: the mirror sends my shares and reports again when my armour changes (mutants: the change unseen)', () => {
  let t = 0, g = [100, 100, 100];
  const sent = [];
  const me = { health: 50, maxHealth: 100 };
  const m = createRefereeHealthMirror({ read: () => me, write: (h) => { me.health = h; }, send: (r) => { sent.push(r); return true; }, now: () => t, guard: () => g });
  m.frame(true);
  assert.deepEqual(sent.at(-1).g, [100, 100, 100]);
  t += 1000; m.frame(true);
  assert.equal(sent.length, 1, 'nothing moved, nothing sent');
  g = [34, 40, 30]; t += 1000; m.frame(true);
  assert.equal(sent.length, 2);
  assert.deepEqual(sent.at(-1).g, [34, 40, 30]);
});

test('PVP-WARD: what of a player\'s spell lands on a body - its Resist effects first, then its own saving throw: race, Willpower and gear, as a monster\'s spell meets it (mutants: the throw unread; an element\'s chance read for another)', () => {
  assert.equal(PVP_ELEMENTS, 5);
  assert.deepEqual([5, 50, 60, 95].map(savingLands), [99.5, 60.5, 50.5, 15.5], 'the throw\'s dice, summed');
  assert.deepEqual(pvpWardKept(body()), [56, 56, 56, 56, 56], 'Willpower 50: a saving chance of 55');
  assert.deepEqual(pvpWardKept(body(100)), [51, 51, 51, 51, 51], 'Willpower 100: 60');
  assert.deepEqual(pvpWardKept({ ...body(100), raceId: 1 }), [51, 51, 51, 51, 21], 'a Breton: +30 against magic');
  assert.deepEqual(pvpWardKept({ ...body(100), raceId: 3 }), [51, 21, 51, 51, 51], 'a Nord: against frost');
  const warded = { ...body(), activeEffects: [{ kind: 'elementalResistance', element: 0, chance: 60 }, { kind: 'elementalResistance', element: 3, chance: 200 }] };
  assert.deepEqual(pvpWardKept(warded), [22, 56, 56, 0, 56], 'a Resist effect first: fire 60%, shock past whole');
  assert.deepEqual(pvpWardKept({ ...body(), _mods: { resist: { frost: 25, magic: 15 } } }), [56, 31, 56, 56, 41], 'the gear\'s resistance, on the throw');
  assert.deepEqual([pvpSpellElement({ element: 0 }), pvpSpellElement({ element: 3 }), pvpSpellElement({}), pvpSpellElement({ element: 9 })], [0, 3, 4, 4]);
  assert.deepEqual(pvpCastFrame([1, 2, 3], 50.4, { element: 1 }), { p: [1, 2, 3], d: 50, el: 1 });
});

test('PVP-WARD: the referee takes the share of the spell\'s element, never under 15 ("85% resist"), before PVP-HIT (mutants: the ward unread; the floor unread)', () => {
  assert.deepEqual(PVP_WARD, { min: 15, max: 100, elements: 5 });
  const now = 1_000_000;
  const a = newFighter(10, now);
  const b = newFighter(50, now); b.max = 1000; b.hp = 1000;
  assert.equal(wardedCast(b, 0, 200), 200, 'unreported: whole');
  takeHealthReport(b, { report: 1, share: HEALTH_SHARE_WHOLE, seen: [], ward: [40, 100, 100, 0, 50] }, now);
  assert.deepEqual(b.share.ward, [40, 100, 100, 15, 50]);
  const cast = (el, d, t) => refereeCast(a, b, { from: at(0), at: at(10), d, el }, t);
  assert.equal(cast(0, 200, now).dealt, 80, 'fire, 40% through');
  assert.equal(cast(3, 200, now + 100).dealt, 30, 'shock, the floor of 15');
  assert.equal(cast(null, 200, now + 200).dealt, 100, 'unnamed: magic');
  assert.equal(cast(1, 2000, now + 300).dealt, 340, 'then the 34% cap');
});

test('PVP-WARD: the wire carries the element on a duel\'s, the zone\'s and a siege\'s cast, and five shares on the report, or refuses the frame', () => {
  const P = [100000, 10.5, 200000], S = 'abc123def0';
  const spell = (o) => validDuelData({ to: 'peer-0002', k: 'spell', s: S, n: 2, p: P, d: 40, ...o });
  assert.equal(spell({ el: 3 })?.el, 3);
  assert.equal(spell({}).el, undefined);
  assert.equal(spell({ el: 5 }), null);
  assert.equal(validSiegeIn({ k: 'cast', to: 'peer-0002', d: 40, h: 0, el: 2 })?.el, 2);
  assert.equal(validSiegeIn({ k: 'cast', to: 'peer-0002', d: 40, h: 0, el: 7 })?.el, undefined, 'a siege cast without a good element is magic');
  const base = { n: 1, s: 5000, seen: [] };
  assert.deepEqual(validVitIn({ ...base, w: [40, 100, 100, 0, 50] })?.ward, [40, 100, 100, 0, 50]);
  assert.equal(validVitIn({ ...base, w: [40, 100, 100, 0] }), null);
  assert.equal(validVitIn({ ...base, w: [40, 100, 100, 0, 101] }), null);
});

test('PVP-TRIANGLE: an arrow at a player 1.28x, 1.67x from level 40; a harmful spell 0.96x, 0.81x from 40; one hit at most 34% (mutants: the late step unread; arrow and spell swapped)', () => {
  assert.deepEqual(PVP_TRIANGLE, { late: 40, arrow: 1.28, arrowLate: 1.67, spell: 0.96, spellLate: 0.81 });
  assert.deepEqual([39, 40, 45].map(pvpArrowScale), [1.28, 1.67, 1.67]);
  assert.deepEqual([39, 40, 45].map(pvpSpellScale), [0.96, 0.81, 0.81]);
  assert.equal(PVP_HIT.share, 0.34);
  // the striker's sheet carries its real level (`pl`), and only a shaft is scaled
  const strike = (level, by) => resolveDuelStrike({ by, a: duelAttackerOf({ ...body(80), level }), w: { t: 130, m: 0, c: 100 } }, duelStandIn(), { rolls: () => 0.01 }).dmg;
  const [a39, a40, m39, m40] = [strike(39, 'arrow'), strike(40, 'arrow'), strike(39, 'melee'), strike(40, 'melee')];
  assert.ok(a39 > 0 && m39 > 0);
  assert.equal(Math.floor(a40 / 1.67), Math.floor(a39 / 1.28), 'the same draw, its late number');
  assert.equal(m40, m39, 'a swing is not an arrow');
});

test('PVP-SHIELD: a live Shield on a player is reported (`sh`), and the referee takes 25% off a swing and 35% off a shaft; no Shield, nothing (mutants: the report unread; the shaft read as a swing)', () => {
  assert.deepEqual(PVP_SHIELD, { melee: 75, shaft: 65, min: 10, max: 25 });
  assert.equal(pvpShielded(body()), false);
  assert.equal(pvpShielded({ ...body(), activeEffects: [{ kind: 'shield', shieldRemaining: 30 }] }), true);
  assert.equal(pvpShielded({ ...body(), activeEffects: [{ kind: 'shield', shieldRemaining: 0 }, { kind: 'shield', shieldRemaining: 9, ended: true }] }), false, 'a spent or ended pool');
  const base = { n: 1, s: 5000, seen: [] };
  assert.equal(validVitIn({ ...base, sh: 1 })?.shield, 25, 'an older client\'s Shield: the strongest');
  assert.equal(validVitIn({ ...base, sh: 0 })?.shield, 0);
  assert.equal(validVitIn({ ...base, sh: 10 })?.shield, 10, 'PVP-KIT: a share');
  assert.equal(validVitIn({ ...base, sh: 26 }), null);
  assert.equal(validVitIn({ ...base }).shield, undefined);
  assert.equal(validVitIn({ ...base, sh: 2 }), null);
  const now = 1_000_000;
  const a = newFighter(10, now);
  const b = newFighter(50, now); b.max = 1000; b.hp = 1000;
  assert.equal(shieldedBlow(b, false, 200), 200, 'unreported: no Shield');
  takeHealthReport(b, { report: 1, share: HEALTH_SHARE_WHOLE, seen: [], shield: 25 }, now);
  const blow = (w, r, t) => refereeBlow(a, b, { from: at(0), at: at(2), held: { w, m: 0 }, d: 200, r }, t);
  assert.equal(blow(120, SIEGE_HIT.Melee, now).dealt, 150, 'a longsword: 75%');
  assert.equal(blow(130, SIEGE_HIT.Shaft, now + 1000).dealt, 130, 'an arrow: 65%');
  takeHealthReport(b, { report: 2, share: HEALTH_SHARE_WHOLE, seen: [], shield: 0 }, now + 2000);
  assert.equal(blow(120, SIEGE_HIT.Melee, now + 3000).dealt, 200, 'the Shield gone');
  let sh = false, t = 0; const sent = [];
  const m = createRefereeHealthMirror({ read: () => ({ health: 50, maxHealth: 100 }), write: () => {}, send: (r) => { sent.push(r); return true; }, now: () => t, shield: () => sh });
  m.frame(true); sh = true; t += 1000; m.frame(true);
  assert.deepEqual(sent.map((r) => r.sh), [0, 1], 'a Shield cast is reported at once');
});

test('PVP-BUFFS: in a fight my own buffs run a minute at most - a worn item\'s effect and a foe\'s harm left whole, and nothing cut outside a fight (mutants: the cap unread; a worn item cut; harm cut; cut outside a fight)', () => {
  assert.equal(PVP_BUFF_ROUNDS, 12);
  const effects = () => [
    { kind: 'fortifyAttribute', roundsRemaining: 300 },
    { kind: 'shield', roundsRemaining: 8 },
    { kind: 'elementalResistance', roundsRemaining: 90, heldItem: { id: 1 } },
    { kind: 'continuousDamage', roundsRemaining: 40 },
    { kind: 'regenerate', roundsRemaining: 60, ended: true },
  ];
  const e = { ...body(), activeEffects: effects() };
  assert.equal(capPvpBuffs(e), 1);
  assert.deepEqual(e.activeEffects.map((a) => a.roundsRemaining), [12, 8, 90, 40, 60]);
  const me = { ...body(), health: 50, maxHealth: 100, activeEffects: effects() };
  const m = createPlayerHealthMirror(me, () => ({ sendVit: () => true }));
  m.frame(false);
  assert.equal(me.activeEffects[0].roundsRemaining, 300, 'out of a fight: whole');
  m.frame(true);
  assert.equal(me.activeEffects[0].roundsRemaining, 12, 'in a fight: a minute');
});

test('PVP-POTIONS: in a fight each potion kind (health, magicka, other) waits 15 s and lands its first effect alone; out of a fight nothing waits (mutants: the clock, the kinds, the first effect, the fight)', () => {
  resetPvpPotions();
  const bottle = (name) => ({ group: 'UselessItems1', templateIndex: TEMPLATES.Glass_Bottle, potionRecipeKey: potionRecipeKey(POTION_RECIPES.find((r) => r.name === name).ingredients) });
  const [heal, power, pure] = ['healing', 'restorePower', 'purification'].map(bottle);
  assert.deepEqual([heal, power, pure].map(pvpPotionKind), ['health', 'magicka', 'other']);
  pvpPotionDrunk(heal, 0);
  assert.equal(pvpPotionRefusal(heal, 1000), null, 'out of a fight: no clock');
  const me = { ...body(), health: 50, maxHealth: 100, activeEffects: [] };
  const mirror = createPlayerHealthMirror(me, () => ({ sendVit: () => true }));
  mirror.frame(true);
  assert.equal(playerInPvpFight(), true, 'the mirror says when a fight may hold the player');
  pvpPotionDrunk(heal, 1000);
  assert.equal(pvpPotionRefusal(heal, 1000 + PVP_POTION_MS - 1), 'You can drink another health potion in 1 s.');
  assert.equal(pvpPotionRefusal(heal, 1000 + PVP_POTION_MS), null, '15 s on: free');
  assert.equal(pvpPotionRefusal(power, 2000), null, 'magicka keeps its own clock');
  assert.equal(pvpPotionRefusal(pure, 2000), null, 'other keeps its own clock');
  const drank = [];
  pvpPotionDrunk(heal);
  const used = useItem(heal, [heal], { drinkPotion: (k) => { drank.push(k); return 'Healing'; } });
  assert.equal(used.kind, 'refused', 'the bottle is kept');
  assert.deepEqual(drank, []);
  assert.equal(useItem(power, [power], { drinkPotion: (k) => { drank.push(k); return 'Restore Power'; } }).kind, 'potion');
  assert.match(pvpPotionRefusal(power), /another magicka potion in 15 s/, 'a drink through the item use starts its clock');
  const bundle = { name: 'Purification', effects: [{ type: 3 }, { type: 10, subType: 8 }, { type: 13 }] };
  assert.deepEqual(pvpPotionBundle(bundle).effects, [{ type: 3 }], 'in a fight: the first effect alone');
  mirror.frame(false);
  assert.equal(pvpPotionRefusal(power), null, 'the fight over: no wait');
  resetPvpPotions();
  assert.equal(pvpPotionBundle(bundle), bundle, 'out of a fight: whole');
  const magic = readFileSync(new URL('../../src/scenes/hostMagic.js', import.meta.url), 'utf8');
  assert.match(magic, /applySpellToPlayer\(pvpPotionBundle\(bundle\), castingLevel\(playerEntity\)/, 'the drink lands the trimmed bundle');
});

test('PVP-ARMOUR-CAST: in a fight with a player a plate piece costs a spell 6% more and casts it 3% slower, chain half, leather and the RRI light set nothing; out of a fight nothing (mutants: the plate, the chain, the slow, the fight, a piece unread)', () => {
  resetPvpPotions();
  const SLOTS = [[102, 'ChestArmor'], [103, 'LegsArmor'], [107, 'Head'], [104, 'LeftArm'], [105, 'RightArm'], [106, 'Gloves'], [108, 'Feet']];
  const worn = (material, templates = SLOTS) => {
    const e = { isPlayer: true, stats: { ...body().stats, speed: 50 }, skills: {}, items: [] };
    const t = equipTableOf(e);
    for (const [templateIndex, slot] of templates) t[EQUIP_SLOTS[slot]] = { group: 'Armor', templateIndex, material, maxCondition: 100, currentCondition: 100 };
    return e;
  };
  const plate = worn(0x0200), chain = worn(0x0100), leather = worn(0x0000), light = worn(0x0209, [[522, 'Head']]);
  assert.deepEqual([plate, chain, leather, light].map(pvpArmourCast), [{ cost: 42, slow: 21 }, { cost: 21, slow: 10.5 }, { cost: 0, slow: 0 }, { cost: 0, slow: 0 }]);
  assert.deepEqual(PVP_ARMOUR_CAST.cost, [0, 3, 6]);
  const bolt = buildCustomSpell({ slots: [{ type: 4, subType: 0, settings: { magnitudeBaseLow: 20, magnitudeBaseHigh: 20, magnitudePerLevel: 20 } }], rangeType: 1, element: 0, name: 'Bolt' });
  const cost = (e) => calculateCastCost(bolt, e, { online: true }).sp;
  const bare = worn(0x0000, []);
  const [base, out] = [cost(bare), cost(plate)];
  assert.equal(out, base, 'out of a fight: plate costs nothing more');
  assert.equal(castRate(plate), 1, 'out of a fight: no slower');
  setPvpFight(true);
  assert.equal(cost(plate), Math.round(base * 1.42), 'full plate: +42%');
  assert.equal(cost(chain), Math.round(base * 1.21), 'full chain: +21%');
  assert.equal(cost(leather), base);
  assert.equal(castRate(plate), 0.79, 'full plate: 21% slower');
  assert.equal(castRate(bare), 1);
  resetPvpPotions();
  assert.match(readFileSync(new URL('../../src/net/siege/refereeHealthMirror.js', import.meta.url), 'utf8'), /^import '\.\.\/\.\.\/combat\/pvpArmourCasting\.js';/m, 'the doors load with the fight flag');
});

test('PVP-SPELL-CRIT: a spell at a player crits as a blow does - Critical Strike / (4 - the Luck term) per cent, x(1 + 5% each 5 points); none for no caster or no harm (mutants: the chance, the luck, the size, the roll)', () => {
  const caster = (crit, luck) => ({ isPlayer: true, stats: { ...body().stats, luck }, skills: { [SK.CriticalStrike]: crit }, items: [] });
  assert.deepEqual(pvpSpellCrit(caster(100, 50)), { chance: 0.25, mult: 2 });
  assert.deepEqual(pvpSpellCrit(caster(100, 100)), { chance: 0.5, mult: 2 });
  assert.deepEqual(pvpSpellCrit(caster(40, 50)), { chance: 0.1, mult: 1.4 });
  assert.equal(pvpCritHarm(100, caster(100, 50), () => 0.24), 200, 'a crit');
  assert.equal(pvpCritHarm(100, caster(100, 50), () => 0.25), 100, 'no crit');
  assert.equal(pvpCritHarm(0, caster(100, 50), () => 0), 0);
  assert.equal(pvpCritHarm(100, null, () => 0), 100);
});
