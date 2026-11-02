// AUDIT HAND-WRAPS, lane B (bible/05-Combat/Hand-Wraps.md): a fist in the Hand Wraps is a bare fist to every reader of
// the weapon - the siege's and a duel's blow, a boss's hide, a foe's read of the blow, the swing's and the hit's sound,
// the Stats page's hand - while the wraps' own lines, powers and sigil ride its blow as a weapon's ride a weapon's.
import '../modsOff.js';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { setPref, _resetForTests } from '../../src/systems/uiPrefs.js';
import * as LR from '../../src/systems/loot/lootRarity.js';
import * as LP from '../../src/systems/loot/lootPowers.js';
import { _resetSetPowersForTests } from '../../src/systems/sigil/sigilSetPowers.js';
import { setPlayerDoor } from '../../src/systems/playerDoor.js';
import { equipItem, EQUIP_SLOTS } from '../../src/systems/equip.js';
import { createHandWraps } from '../../src/systems/handWraps.js';
import { createWeapon } from '../../src/combat/enemyEquipment.js';
import { duelWeaponOf } from '../../src/combat/duelCombat.js';
import { bossStrike } from '../../src/systems/bossTraits.js';
import { blowK, TELL } from '../../src/ai/tells.js';
import { SOUND, swingSoundFor, hitSoundFor } from '../../src/systems/soundClips.js';
import { strikingWeaponOf, computeCombatStats } from '../../src/combat/combatStats.js';
import { pcaaoAttackDamage } from '../../src/combat/pcaao.js';
import { registerWeaponBlowMod, registerWeaponDamageMod } from '../../src/systems/entityMods.js';
import { sigilBlow, setSigilOnline, setSigilRenown, _resetSigilForTests } from '../../src/systems/sigil/sigil.js';
import { calculateAttackDamage } from '../../src/combat/formulas.js';
import { applyEnchantments } from '../../src/systems/enchanting.js';
import { ENCHANTMENT_TYPES } from '../../src/formats/magicDef.js';

const fresh = () => { _resetForTests(); setPref('lootRarity', true); LP._resetLootPowersForTests(); _resetSetPowersForTests(); setPlayerDoor(null); };
const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };
const stats = () => ({ strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 });
const player = () => ({ isPlayer: true, items: [], stats: stats(), skills: new Array(35).fill(30), level: 20, career: {}, activeEffects: [], health: 50, maxHealth: 100, magicka: 0, maxMagicka: 100, attackModifierFlags: null });
const foe = () => ({ affinity: 'Human', careerIndex: 0, career: {}, isClass: true, armor: 0, skills: 0, stats: { strength: 50, agility: 50, luck: 50 }, health: 100, maxHealth: 100, level: 1 });
const wear = (e, it) => { e.items.push(it); equipItem(e, it); return it; };

test('HAND-WRAPS AUDIT B: a fist in the wraps is the bare hand to the duel\'s blow, a boss\'s hide, a foe\'s read of the blow and the sounds (mutants: each reader taking them for a weapon)', () => {
  const w = createHandWraps(), blade = createWeapon(113, 0);
  assert.equal(duelWeaponOf(w), null, 'a duel\'s and the siege\'s blow: the fist');
  assert.notEqual(duelWeaponOf(blade), null);
  const stone = { bossTraits: ['stoneskin'] }, turning = { bossTraits: ['bladeturning'] };
  assert.equal(bossStrike(stone, 100, { weapon: w }).damage, bossStrike(stone, 100, { weapon: null }).damage, 'stoneskin turns a fist in them');
  assert.ok(bossStrike(stone, 100, { weapon: w }).damage < 100);
  assert.equal(bossStrike(turning, 100, { weapon: w }).damage, 100, 'bladeturning never does');
  assert.equal(blowK({ weapon: w }), TELL.K_HANDS, 'a foe weighs it a fist');
  assert.equal(swingSoundFor(w), SOUND.SwingHighPitch);
  for (const r of [0, 0.5, 0.99]) assert.equal(hitSoundFor(w, () => r), hitSoundFor(null, () => r), `the fist's hit at ${r}`);
});

test('HAND-WRAPS AUDIT B10: the Stats page\'s hand - an empty fist beside the wraps wears them, bare hands none; its estimate tells the blow modifiers the wraps (mutants: the other hand unread; the estimate untold)', () => {
  const me = player(), w = wear(me, createHandWraps());
  const side = w.equipSlot === EQUIP_SLOTS.RightHand;
  assert.equal(strikingWeaponOf(me, side), w);
  assert.equal(strikingWeaponOf(me, !side), w, 'the empty fist');
  const bare = player();
  assert.equal(strikingWeaponOf(bare, true), null);
  const seen = [];
  registerWeaponBlowMod('handwraps-audit', (weapon, d, a, t, info) => { if (info?.estimate) seen.push([weapon, info.wraps ?? null]); return d; });
  try { computeCombatStats(me, { weapon: w, core: 'classic' }); } finally { registerWeaponBlowMod('handwraps-audit', null); }
  assert.deepEqual(seen.at(-1), [null, w]);
});

test('HAND-WRAPS AUDIT B: PCAAO\'s fists take the wraps\' weapon mods over their roll, as the stock core\'s (mutant: the PCAAO fists\' mods unread)', () => {
  const w = createHandWraps(), A = player(), T = foe();
  const bare = pcaaoAttackDamage(A, T, { weapon: null, rolls: seq(0) });
  registerWeaponDamageMod('handwraps-pcaao-mod', (weapon, d) => (weapon === w ? d + 4 : d));
  try {
    assert.equal(pcaaoAttackDamage(A, T, { weapon: null, wraps: w, rolls: seq(0) }), bare + 4);
    assert.equal(pcaaoAttackDamage(A, T, { weapon: null, rolls: seq(0) }), bare, 'bare hands: none');
  } finally { registerWeaponDamageMod('handwraps-pcaao-mod', null); }
});

test('HAND-WRAPS AUDIT B: the wraps\' leech, their own power and their sigil ride a fist\'s blow, never a bare one (mutants: the leech unread; the power off the wraps; the sigil unread)', () => {
  fresh();
  const me = player(), struck = foe(), other = foe();
  const w = wear(me, Object.assign(createHandWraps(), { rarity: 'rare', affixes: [{ id: 'leech', value: 10 }], imprint: 'orsiniums-anvil' }));
  assert.equal(LR.validImprint(w), true, 'Earthshaker fits a melee piece');
  const hurts = [];
  setPlayerDoor({ foes: () => [{ name: 'struck', entity: struck, ai: { feet: [0, 0, 0] }, dead: false }, { name: 'other', entity: other, ai: { feet: [1, 0, 0] }, dead: false }], feet: () => [0, 0, 0], hurtFoe: (f, n) => hurts.push([f.name, n]), castOnPlayer: () => {}, player: () => me });
  LP.lootStrike(me, struck, 100, null, { wraps: w });
  assert.equal(me.health, 60, 'its leech: a tenth of the blow');
  assert.deepEqual(hurts, [['other', 25]], 'its Earthshaker');
  LP.lootStrike(me, struck, 100, null, {});
  assert.equal(hurts.length, 1, 'a bare blow carries none of it');
  fresh(); setPlayerDoor(null);
  _resetSigilForTests(); setSigilOnline(true); setSigilRenown(40);
  try {
    const sig = Object.assign(createHandWraps(), { sigil: { power: 12, party: 1, xp: 37500 } });
    assert.ok(sigilBlow(null, 1000, { isPlayer: true }, { careerIndex: 0 }, { wraps: sig }) > 1000, 'its sigil');
    assert.equal(sigilBlow(null, 1000, { isPlayer: true }, { careerIndex: 0 }, null), 1000);
  } finally { _resetSigilForTests(); }
});

test('HAND-WRAPS AUDIT B11: the item law knows the wraps headless - its own import, so the account\'s judge, which loads the law alone, finds an honest pair lawful (mutant: the import dropped)', () => {
  const law = new URL('../../src/systems/item/itemLaw.js', import.meta.url).href;
  const out = execFileSync(process.execPath, ['--input-type=module', '-e', `const L = await import(${JSON.stringify(law)}); console.log(JSON.stringify(L.itemFindings({ group: 'Weapons', templateIndex: 563, material: 0, currentCondition: 400, maxCondition: 400, value: 30, weightInKg: 0.5, flags: 0 }).map((f) => f.rule ?? f)))`], { encoding: 'utf8' });
  assert.ok(!/template|unknown/i.test(out), `the law reads the row: ${out}`);
});

test('HAND-WRAPS AUDIT C5: the running hands - the wraps leave the hands empty, and the running fists wear their glow (mutants: the wraps a held item; the run drawn without the glow)', () => {
  const rig = readFileSync(new URL('../../src/combat/weapon/weaponRig.js', import.meta.url), 'utf8');
  assert.ok(rig.includes('const held = (s) => slots?.[s] && !isHandWraps(slots[s]);'));
  assert.ok(rig.includes('twoHands.drawRun(renderer, c, artFor(null), { ...(pairUp() && shown() ? o : { ...o, shown: false }), glowFor: handGlowOf });'));
  const two = readFileSync(new URL('../../src/combat/twoHands/twoHands.js', import.meta.url), 'utf8');
  assert.ok(two.includes("if (glow)\n          renderer.drawScreenQuadGlow?.(q.tex, rect, uv, glow, {\n            art: [q.rec.width, q.rec.height],\n            view: [canvas.width, canvas.height],\n          }); // HAND-WRAPS"), 'the run\'s swap');
  assert.ok(two.includes('if (h.glow)\n        renderer.drawScreenQuadGlow?.(h.tex, h.rect, h.uv, h.glow, { art: h.art, view: [canvas.width, canvas.height] });'), 'the run\'s pump');
});

test('HAND-WRAPS AUDIT D3: the wraps\' Strikes payload strikes with the fist - Potent Vs Humanoid adds its 5 on a fist\'s hit, handed as the weapon or beside it (mutant: HANDWRAPS-strikes, the payload a weapon\'s alone)', () => {
  const human = () => ({ ...foe(), mobileType: 128 });
  const plain = createHandWraps(), potent = createHandWraps();
  applyEnchantments(potent, [{ type: ENCHANTMENT_TYPES.PotentVs, param: 2 }]);
  const bare = calculateAttackDamage(player(), human(), { weapon: plain, rolls: seq(0) });
  assert.ok(bare > 0);
  assert.equal(calculateAttackDamage(player(), human(), { weapon: potent, rolls: seq(0) }), bare + 5);
  assert.equal(calculateAttackDamage(player(), human(), { weapon: null, wraps: potent, rolls: seq(0) }), bare + 5, 'beside the weaponless blow, as the rig hands it');
});
