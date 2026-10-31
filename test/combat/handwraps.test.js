// HAND-WRAPS (2026-10-29, the owner: "allow players using hand combat to recieve the outlines others recieve when a weapon
// is enchanted? Maybe a new weapon type like hand wraps?", then "Carry lines only"; bible/05-Combat/Hand-Wraps.md). Held
// here: the row and its mint (cloth, no metal, known to the item law, on the weapons' shelves); the fists' art, skill and
// both fists up; the fists' damage with the wraps' lines over it in both cores, their Strikes payload, the listeners;
// the glow on the classic fists, the Morrowind hands and a peer's; the Stats page; no doll layer, no Damage row.
import '../modsOff.js';
import { test } from 'node:test';
import { SESSION_KEY } from '../../src/net/accountClient.js';   // WRAPS-AURA: the weapon aura read off the stored session
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setPref, _resetForTests } from '../../src/systems/uiPrefs.js';
import * as LR from '../../src/systems/loot/lootRarity.js';
import * as WG from '../../src/systems/weaponGlow.js';
import { HAND_WRAPS_TEMPLATE, isHandWraps, createHandWraps } from '../../src/systems/handWraps.js';
import { templateByIndex, customItemsForGroup, setItemFields } from '../../src/systems/item/itemTemplates.js';
import { itemFindings, CUSTOM_TEMPLATE_GROUPS } from '../../src/systems/item/itemLaw.js';
import { itemLongName, itemDamageLine } from '../../src/systems/item/itemInfo.js';
import { createWeapon, weaponOfMaterial } from '../../src/combat/enemyEquipment.js';
import { WEAPON_TYPES, weaponTypeForItem } from '../../src/combat/fpsWeapon.js';
import { weaponSkillUsed } from '../../src/characters/weapons.js';
import { getItemHands, ITEM_HANDS } from '../../src/characters/equipTable.js';
import { HANDS_MODE, handsModeOf } from '../../src/combat/twoHands/handsLaw.js';
import { PlayerWeapon, handDesc } from '../../src/combat/playerWeapon.js';
import { SKILLS } from '../../src/systems/skills.js';
import { calculateAttackDamage, registerPlayerStrikeListener } from '../../src/combat/formulas.js';
import { pcaaoAttackDamage } from '../../src/combat/pcaao.js';
import { registerWeaponBlowMod, registerWeaponDamageMod } from '../../src/systems/entityMods.js';
import { lootBlow } from '../../src/systems/loot/lootPowers.js';
import { computeCombatStats } from '../../src/combat/combatStats.js';
import { createFpArm, fpWeaponKey } from '../../src/combat/fpArm.js';
import { inGlowSlot } from '../../src/render/renderer.js';
import { PeerBodies, peerWeaponOf, peerBuildOpts, peerWrapsGlow } from '../../src/net/peer/peerBodies.js';
import { paperdollItemImage } from '../../src/ui/paperDoll.js';
import { EQUIP_SLOTS } from '../../src/systems/equip.js';
import { fixtureBodyDeps, countingRenderer } from '../fixtures/mw/bodyRig.mjs';
import { applyEnchantments } from '../../src/systems/enchanting.js';
import { ENCHANTMENT_TYPES } from '../../src/formats/magicDef.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const on = () => { _resetForTests(); setPref('lootRarity', true); };
const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };
const lcg = (seed) => () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >>> 8) / 0x800000; };
/** A Magic pair with a fire line at its band's top - the producer's own shape (applyRarity, then addProcLine). */
function fireWraps() {
  const it = createHandWraps();
  LR.applyRarity(it, 'magic', lcg(7));
  LR.addProcLine(it, seq(0, 0.99, 0));
  return it;
}
const player = () => ({ level: 1, skills: 35, stats: { strength: 50, agility: 50, luck: 50, speed: 50 }, attackModifierFlags: null, isPlayer: true });
const foe = () => ({ affinity: 'Human', careerIndex: 0, career: {}, isClass: true, armor: 0, skills: 0, stats: { strength: 50, agility: 50, luck: 50 }, health: 100, maxHealth: 100, level: 1 });

test('HAND-WRAPS the row: a Weapons template of its own (563), cloth - every mint material 0 and its name no metal, whatever a shelf rolls - known to the item law, on the weapons\' shelves and the random weapon roll (mutants: a metal kept; the metal in the name; the law\'s group)', () => {
  assert.equal(HAND_WRAPS_TEMPLATE, 563);
  assert.equal(templateByIndex(563)?.name, 'Hand Wraps');
  assert.ok(CUSTOM_TEMPLATE_GROUPS.Weapons.includes(563));
  assert.ok(customItemsForGroup('Weapons').includes(563), 'shelved and rolled');
  const w = createHandWraps();
  assert.equal(w.material, 0);
  assert.equal(isHandWraps(w), true);
  assert.deepEqual(itemFindings(w), [], 'an honest pair is lawful');
  for (const it of [weaponOfMaterial(563, 9), createWeapon(563, 7), setItemFields({ group: 'Weapons', templateIndex: 563, material: 9 })]) {
    assert.equal(it.material, 0, 'cloth, whatever the roll');
    assert.equal(itemLongName({ ...it, isIdentified: true }), 'Hand Wraps', 'no metal in its name');
  }
  assert.equal(itemDamageLine(w), null, 'no Damage row: the fists\' damage');
  assert.equal(paperdollItemImage({ ...w, equipSlot: EQUIP_SLOTS.RightHand }), null, 'no doll layer');
});

test('HAND-WRAPS the fists: the bare hands\' art and swing, the Hand-to-Hand skill, either hand, and both fists up; the weapon a fist in them strikes with is none - the wraps named beside it, an empty hand beside them striking with them too (mutants: the art a weapon\'s; the skill unmapped; the hand None; the mode Single; the wraps the weapon; the empty fist bare)', () => {
  const w = createHandWraps();
  assert.equal(weaponTypeForItem(w), WEAPON_TYPES.Melee);
  assert.equal(weaponSkillUsed(563), SKILLS.HandToHand);
  assert.equal(getItemHands(w), ITEM_HANDS.Either);
  assert.equal(handsModeOf({ right: handDesc(w), left: null }), HANDS_MODE.Fists);
  assert.equal(handsModeOf({ right: null, left: handDesc(w) }), HANDS_MODE.Fists);
  assert.equal(handsModeOf({ right: handDesc(createWeapon(113, 0)), left: handDesc(w) }), HANDS_MODE.Single, 'a blade in the other hand: one hand');
  const pw = new PlayerWeapon();
  pw.updateHands(w, null); pw.applyWeapon();
  assert.equal(pw.handsMode, HANDS_MODE.Fists);
  assert.equal(pw.handItem('R'), null, 'a fist in them is a bare fist to every reader of the weapon');
  assert.equal(pw.weapon, null);
  assert.equal(pw.strikingWeapon, null);
  assert.equal(pw.wrapsOf('R'), w);
  assert.equal(pw.wrapsOf('L'), w, 'the empty fist wears them');
  assert.equal(pw.wraps, w);
  const a = createHandWraps(), b = createHandWraps();
  pw.updateHands(a, b); pw.applyWeapon();
  assert.deepEqual([pw.wrapsOf('R'), pw.wrapsOf('L')], [a, b], 'two pairs: each fist its own');
  const blade = createWeapon(113, 0);
  pw.updateHands(blade, w); pw.applyWeapon();
  assert.equal(pw.wrapsOf('R'), null, 'a blade\'s hand wears none');
  pw.updateHands(null, null); pw.applyWeapon();
  assert.deepEqual([pw.wrapsOf('R'), pw.wrapsOf('L'), pw.wraps], [null, null, null], 'bare hands stay bare');
});

test('HAND-WRAPS the blow: the fists\' damage in the stock core, the wraps\' lines over it - their weapon mods over the fists\' roll, the blow modifiers and the strike listeners told the wraps beside a weaponless blow - and an elemental line sears (mutants: the wraps kept as the weapon; the lines unread; the listeners untold)', () => {
  on();
  const w = createHandWraps(), A = player(), T = foe();
  const bare = calculateAttackDamage(A, T, { weapon: null, rolls: seq(0) });
  assert.ok(bare > 0);
  assert.equal(calculateAttackDamage(A, T, { weapon: w, rolls: seq(0) }), bare, 'a plain pair: the fists\' blow');
  const blows = [], strikes = [];
  registerWeaponBlowMod('handwraps-test', (weapon, d, a, t, info) => { blows.push([weapon, info?.wraps ?? null]); return d; });
  registerWeaponDamageMod('handwraps-test', (weapon, d) => (weapon === w ? d + 5 : d));
  registerPlayerStrikeListener('handwraps-test', (a, t, d, weapon, info) => strikes.push([weapon, info?.wraps ?? null]));
  try {
    assert.equal(calculateAttackDamage(A, T, { weapon: w, rolls: seq(0) }), bare + 5, 'the wraps\' own mod over the fists\' roll');
    assert.deepEqual(blows.at(-1), [null, w], 'a weaponless blow, the wraps beside it');
    assert.deepEqual(strikes.at(-1), [null, w]);
    calculateAttackDamage(A, T, { weapon: null, rolls: seq(0) });
    assert.deepEqual(blows.at(-1), [null, null], 'bare hands carry none');
  } finally {
    registerWeaponBlowMod('handwraps-test', null); registerWeaponDamageMod('handwraps-test', null); registerPlayerStrikeListener('handwraps-test', null);
  }
  const f = fireWraps(), line = f.affixes.find((a) => a.id === 'elemental');
  assert.equal(line?.param, 'fire');
  assert.equal(lootBlow(null, 10, A, T, { wraps: f }), 10 + line.value, 'its fire on a fist\'s blow');
  assert.equal(lootBlow(null, 10, A, T, {}), 10, 'none without it');
});

test('HAND-WRAPS the blow under PCAAO: its core takes the wraps and hands them to the fists\' blow modifiers (mutant: the core\'s fists untold)', () => {
  const w = createHandWraps(), seen = [];
  registerWeaponBlowMod('handwraps-pcaao', (weapon, d, a, t, info) => { seen.push(info?.wraps ?? null); return d; });
  try {
    pcaaoAttackDamage(player(), foe(), { weapon: null, wraps: w, rolls: seq(0) });
    assert.equal(seen.at(-1), w);
  } finally { registerWeaponBlowMod('handwraps-pcaao', null); }
  const src = read('src/combat/formulas.js');
  assert.ok(src.includes('core(attacker, target, { weapon, wraps, damageMod,'), 'the registered core is handed them');
  assert.ok(src.includes('const charged = weapon ?? wraps;') && src.includes('doItemEnchantmentPayloads(PAYLOAD.Strikes, charged, {'), 'their Strikes payload strikes with the fist');
});

test('HAND-WRAPS the Stats page: a plain pair reads as the fists, and the wraps\' weapon mod over their roll', () => {
  const w = createHandWraps(), A = player();
  const bare = computeCombatStats(A, { weapon: null, core: 'classic' }).head.byFoe[0].dmg;
  const worn = computeCombatStats(A, { weapon: w, core: 'classic' });
  assert.equal(worn.skillId, SKILLS.HandToHand);
  assert.deepEqual(worn.head.byFoe[0].dmg.parts.roll, bare.parts.roll);
  registerWeaponDamageMod('handwraps-stats', (weapon, d) => (weapon === w ? d + 2 : d));
  try { assert.deepEqual(computeCombatStats(A, { weapon: w, core: 'classic' }).head.byFoe[0].dmg.parts.roll, bare.parts.roll.map((r) => r + 2)); } finally { registerWeaponDamageMod('handwraps-stats', null); }
});

test('HAND-WRAPS the glow, WRAPS-AURA (as the owner asked): wraps glow by the weapon aura alone - no element, no arcane outline - and a blade\'s classic outline is unmoved (mutants: the aura rule dropped; arcane for every classic hand)', () => {
  on();
  const f = fireWraps();
  assert.equal(WG.spriteGlow(f, { on: true }), null, 'an element line: none');
  assert.equal(WG.meshGlow(f, { on: true }), null);
  const ench = createHandWraps(), blade = createWeapon(120, 0);
  for (const it of [ench, blade]) applyEnchantments(it, [{ type: ENCHANTMENT_TYPES.CastWhenStrikes, param: 14 }]);   // the item maker's own
  assert.equal(WG.spriteGlow(ench, { on: true }), null, 'enchanted: none');
  assert.equal(WG.meshGlow(ench, { on: true }), null);
  assert.equal(WG.spriteGlow(blade, { on: true }), null, 'a blade\'s is its WEAPO1xx sheet');
  assert.deepEqual(WG.meshGlow(blade, { on: true }), WG.glowSpec('arcane', WG.ARCANE_LEVEL), 'a blade\'s Morrowind hand keeps the arcane look');
  assert.equal(WG.spriteGlow(createHandWraps(), { on: true }), null, 'a plain pair: none');
  const was = globalThis.localStorage, m = new Map();
  globalThis.localStorage = /** @type {any} */ ({ getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), key: () => null, get length() { return m.size; } });
  try {
    m.set(SESSION_KEY, JSON.stringify({ id: 'u1', name: 'Me', kind: 'linked', sessionId: 's1', secret: 'x', glyphs: [], armory: 'b000b' }));
    assert.deepEqual(WG.spriteGlow(ench, { on: true }), WG.glowSpec('edge', WG.ARMORY_LEVEL), 'the weapon aura on: its look');
    assert.deepEqual(WG.meshGlow(f, { on: true }), WG.glowSpec('edge', WG.ARMORY_LEVEL));
  } finally { globalThis.localStorage = was; }
});

test('HAND-WRAPS the Morrowind hands: the wraps key as the empty hand; the fists\' ranges are the skin\'s hands and a glove\'s hand parts; the arm lays the glow while the fists are up - never sheathed or casting - and the rig and a peer\'s body say it, a peer\'s under my switch (mutants: keyed as a weapon; the ranges a weapon\'s; the glow while sheathed; the rig untold; the switch unread)', async () => {
  const w = createHandWraps();
  assert.equal(fpWeaponKey(w, false), fpWeaponKey(null, false));
  assert.equal(inGlowSlot({ slot: 'hand' }, 'hands'), true);
  for (const slot of ['right hand (daggerfall_steel_gauntlets)', 'left hand (gauntlet_01)', 'right hand']) assert.equal(inGlowSlot({ slot }, 'hands'), true, slot);
  for (const slot of ['right wrist (gauntlet_01)', 'handle', 'left forearm']) assert.equal(inGlowSlot({ slot }, 'hands'), false, slot);
  assert.equal(inGlowSlot({ slot: 'forearm' }, 'hands'), false);
  assert.equal(inGlowSlot({ slot: 'weapon' }, 'hands'), false);
  assert.equal(inGlowSlot({ slot: 'weapon' }, 'weapon'), true);
  const cam = () => ({ pos: [0, 0, 0], yaw: 0, pitch: 0, move: { forward: 0, speed: 0, grounded: true } });
  const rig = createFpArm(); rig.attach(countingRenderer(), cam);
  assert.equal((await rig.build({ race: 'fprace', deps: fixtureBodyDeps(), weapon: w })).ok, true);
  const run = () => { for (let i = 0; i < 200; i++) rig.update(0.05); };
  const spec = WG.glowSpec('frost', 2);
  rig.setHandGlow(spec);
  assert.equal(rig.handGlow(), null, 'built sheathed');
  rig.setSheathed(false); run();
  assert.equal(rig.handGlow(), spec, 'the fists up');
  rig.readySpell(true); run();
  assert.equal(rig.handGlow(), null, 'a spell in the hands');
  rig.readySpell(false); rig.setSheathed(true); run();
  assert.equal(rig.handGlow(), null, 'put away');
  const rigText = read('src/combat/weapon/weaponRig.js');
  assert.ok(rigText.includes('fpArm.setHandGlow?.(wrapsMeshGlow() ?? (armItem ? null : fistGlow()));'));   // PIN MOVED (ARMORY-FISTS): bare fists wear the kit's weapon piece
  assert.ok(rigText.includes("const wrapsMeshGlow = () => { for (const h of ['R', 'L']) { const w = playerWeapon.wrapsOf(h); const g = w ? meshGlow(w) : null; if (g) return g; } return null; };"), 'either fist\'s pair, the first that glows');
  assert.ok(read('src/render/renderer.js').includes("if (mesh.handGlow) this._drawWeaponGlow(mesh, modelMatrix, skin, charge, 'hands', mesh.handGlow);"));
  on();
  const worn = { templateIndex: 563, group: 'Weapons', material: 0, equipSlot: EQUIP_SLOTS.RightHand, glow: 'fire2' };
  const LOOK = { race: 'Breton', gender: 'male', faceIndex: 0, items: [worn] };
  const said = [];
  const pb = new PeerBodies({ renderer: {}, createRig: () => ({}), buildOpts: peerBuildOpts });
  const prig = { setSheathed() {}, readySpell() {}, release() {}, upperBodyReady: () => true, setWeapon: () => true, setWeaponGlow() {}, setHandGlow: (spec) => said.push(spec) };
  pb._arm({ weapon: peerWeaponOf(LOOK), ammo: 0, held: false, swing: null, cast: null, rig: prig }, { wd: 1, an: 0, cn: 0 }, LOOK);
  assert.deepEqual(said.at(-1), WG.glowSpec('fire', 2), 'a peer\'s fists in their wraps\' word');
  pb._arm({ weapon: null, ammo: 0, held: false, swing: null, cast: null, rig: prig }, { wd: 1, an: 0, cn: 0 }, { ...LOOK, items: [{ ...worn, templateIndex: 120 }] });
  assert.equal(said.at(-1), null, 'a blade: none on the fists');
  setPref('weaponGlow', false);
  pb._arm({ weapon: peerWeaponOf(LOOK), ammo: 0, held: false, swing: null, cast: null, rig: prig }, { wd: 1, an: 0, cn: 0 }, LOOK);
  assert.equal(said.at(-1), null, 'my glow switch off: none');
  setPref('weaponGlow', true);
  assert.deepEqual(peerWrapsGlow({ ...LOOK, items: [{ ...worn, equipSlot: EQUIP_SLOTS.LeftHand }] }), WG.glowSpec('fire', 2), 'in the left hand');
  assert.deepEqual(peerWrapsGlow({ ...LOOK, items: [{ ...worn, glow: undefined }, { ...worn, equipSlot: EQUIP_SLOTS.LeftHand, glow: 'frost3' }] }), WG.glowSpec('frost', 3), 'two pairs: the one that glows');
});
