// FIELD BUGS 2026-10-15e - a player on the Gauntlets of the Rose: "Do gauntlets of the rose actually work? 'Fists land
// again for half' I haven't noticed any difference in damage or anything proccing while using them" and "Does having a
// shield equipped make them not work?". SHIELD-FIST: they work, shield or none - DFU's UpdateHands forces the right hand
// when a shield is in the left (WeaponManager.cs:656), an empty right hand is the bare fist, and every landed fist strikes
// again for half. ROSE-SEEN: the second blow lands through the struck foe's door, which runs no formula, so HN1's numbers
// - a readout of the formula - showed the first blow alone and the Rose looked like nothing. It raises its own number now,
// the power's name its tag. bible/01-Overview/bugs/Field-Bugs-2026-10-15e.md.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setPref, _resetForTests } from '../../src/systems/uiPrefs.js';
import * as LR from '../../src/systems/loot/lootRarity.js';
import * as LP from '../../src/systems/loot/lootPowers.js';
import { _resetSetPowersForTests } from '../../src/systems/sigil/sigilSetPowers.js';
import { setPlayerDoor, takeOwed } from '../../src/systems/playerDoor.js';
import { equipItem, equipTableOf, EQUIP_SLOTS } from '../../src/systems/equip.js';
import { mintCondition } from '../../src/systems/item/itemTemplates.js';
import { createWeapon } from '../../src/combat/enemyEquipment.js';
import { ARMOR_MATERIAL } from '../../src/systems/armorMaterials.js';
import { PlayerWeapon } from '../../src/combat/playerWeapon.js';
import { calculateAttackDamage } from '../../src/combat/formulas.js';
import { mountHitNumbers, unmountHitNumbers, showFollowUp } from '../../src/ui/hitNumbers.js';

const fresh = () => { _resetForTests(); setPref('lootRarity', true); LP._resetLootPowersForTests(); _resetSetPowersForTests(); setPlayerDoor(null); };
const lcg = (seed) => () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >>> 8) / 0x800000; };
const stats = () => ({ strength: 70, intelligence: 50, willpower: 50, agility: 70, endurance: 50, personality: 50, speed: 50, luck: 50 });
const player = () => ({ isPlayer: true, items: [], stats: stats(), skills: new Array(35).fill(60), level: 20, career: {}, activeEffects: [], health: 100, maxHealth: 100, magicka: 0, maxMagicka: 100 });
const foe = () => ({ careerIndex: 7, career: {}, health: 5000, maxHealth: 5000, stats: stats(), skills: new Array(35).fill(10), level: 1, items: [], activeEffects: [], armorValues: new Array(7).fill(60) });
const wear = (e, it) => { e.items.push(it); equipItem(e, it); return it; };
const legendary = (id, material) => {
  const rec = LR.legendaryById(id);
  const it = LR.applyRarity(mintCondition({ group: rec.group, templateIndex: rec.templates[0], material, flags: 0 }), 'legendary', lcg(1), [rec]);
  it.isIdentified = true;
  return it;
};
const KITE_SHIELD = 111;
/** The weapon rig's hands off the equip table, as weaponRig.js feeds them (UpdateHands, then ApplyWeapon) - on the left
 *  hand, as a player who last pressed the switch: the shield must take the right back. */
const hands = (e) => { const s = equipTableOf(e); const pw = new PlayerWeapon(); pw.usingRightHand = false; pw.updateHands(s[EQUIP_SLOTS.RightHand] ?? null, s[EQUIP_SLOTS.LeftHand] ?? null); pw.applyWeapon(); return pw; };
const doorOn = (e, mob, hurts) => setPlayerDoor({ foes: () => [{ entity: mob, ai: { feet: [0, 0, 0] }, dead: false }], feet: () => [0, 0, 0], hurtFoe: (f, n) => hurts.push(n), castOnPlayer: () => {}, player: () => e });

test('SHIELD-FIST a shield in the left hand leaves the bare fist the striking hand, and the Rose strikes again for half on every fist that lands - the same blows, shield or none (mutants: a shield that strikes; Open Hand off with a shield; the whole blow again)', () => {
  const runs = [];
  for (const shield of [false, true]) {
    fresh();
    const me = player();
    wear(me, legendary('gauntlets-of-the-rose', ARMOR_MATERIAL.Leather));
    if (shield) wear(me, mintCondition({ group: 'Armor', templateIndex: KITE_SHIELD, material: ARMOR_MATERIAL.Iron, flags: 0 }));
    const pw = hands(me);
    assert.equal(pw.holdingShield, shield);
    assert.equal(pw.strikingWeapon, null, 'the right hand is forced and empty: the bare fist');
    const mob = foe();
    const hurts = [];
    doorOn(me, mob, hurts);
    const roll = lcg(7);
    const first = [];
    for (let i = 0; i < 200; i++) { const d = calculateAttackDamage(me, mob, { weapon: pw.strikingWeapon, rolls: roll }); if (d > 0) first.push(d); }
    assert.ok(first.length > 150, 'the fists land');
    assert.deepEqual(hurts, first.map((d) => Math.max(1, Math.round(d / 2))), 'every landed fist, again, for half');
    runs.push({ first, hurts });
  }
  assert.deepEqual(runs[1], runs[0], 'the shield changes nothing');
});

test('ROSE-SEEN the second blow raises its own number, tagged with the power\'s name - on a fist that lands, Many Endings\' echo too; none for a weapon\'s blow, a dead foe, the warded Warden, or the classic skin (mutants: no number; the whole blow\'s; untagged; a number for a dead foe; drawn unmounted)', () => {
  const nodes = [];
  const fakeEl = (tag) => {
    const el = { tag, children: [], style: { setProperty(k, v) { this[k] = v; } }, dataset: {}, className: '', textContent: '', listeners: {},
      append(...c) { this.children.push(...c); for (const x of c) x.parent = this; }, isConnected: true,
      addEventListener(n, f) { this.listeners[n] = f; }, remove() { this.isConnected = false; }, setAttribute() {} };
    nodes.push(el); return el;
  };
  globalThis.document = { createElement: fakeEl, getElementById: () => null, body: fakeEl('body') };
  const raised = () => nodes.filter((n) => n.className?.startsWith('hitnum ')).map((n) => [n.textContent, n.children[0]?.textContent ?? null]);
  try {
    fresh();
    const me = player();
    wear(me, legendary('gauntlets-of-the-rose', ARMOR_MATERIAL.Leather));
    const mob = foe();
    const hurts = [];
    doorOn(me, mob, hurts);
    LP.lootStrike(me, mob, 84, null);
    assert.deepEqual(raised(), [], 'the classic skin draws nothing');
    assert.deepEqual(hurts, [42], 'and the blow still lands');
    mountHitNumbers();
    LP.lootStrike(me, mob, 84, null);
    assert.deepEqual(raised(), [['42', 'Open Hand']], 'its number, half the blow, the power named');
    LP.lootStrike(me, mob, 84, createWeapon(120, 0, () => 0.5));
    assert.equal(raised().length, 1, 'a weapon\'s blow is no fist\'s');
    const warden = { ...foe(), warded: true };
    LP.lootStrike(me, warden, 84, null);
    assert.equal(raised().length, 1, 'a blow into the ward lands nothing and says nothing more');
    takeOwed(warden);
    setPlayerDoor({ foes: () => [{ entity: mob, ai: { feet: [0, 0, 0] }, dead: true }], feet: () => [0, 0, 0], hurtFoe: (f, n) => hurts.push(n), castOnPlayer: () => {}, player: () => me });
    LP.lootStrike(me, mob, 84, null);
    assert.equal(raised().length, 1, 'a dead foe takes none');
    // the full blow through the formula: the formula's number, then the follow-up's beside it
    doorOn(me, mob, hurts);
    const roll = lcg(3);
    let d = 0;
    for (let i = 0; i < 40 && !(d > 0); i++) d = calculateAttackDamage(me, mob, { rolls: roll });
    assert.ok(d > 0);
    assert.deepEqual(raised().slice(-2), [[String(Math.max(1, Math.round(d / 2))), 'Open Hand'], [String(d), null]], 'two numbers for one landed fist');
    // Many Endings rides the same door
    fresh(); mountHitNumbers();
    const me2 = player();
    const edge = wear(me2, legendary('warp-edge', 0));
    doorOn(me2, mob, hurts);
    const before = raised().length;
    LP._setLootPowersRandForTests(() => 0.99);
    LP.lootStrike(me2, mob, 30, edge);
    assert.equal(raised().length, before, 'no echo, no number');
    LP._setLootPowersRandForTests(() => 0);
    LP.lootStrike(me2, mob, 30, edge);
    assert.deepEqual(raised().slice(before), [['30', 'Many Endings']], 'an echo raises its number, the whole blow');
    assert.equal(showFollowUp(0, 'x'), null, 'nothing for nothing');
  } finally { LP._setLootPowersRandForTests(null); unmountHitNumbers(); delete globalThis.document; }
});
