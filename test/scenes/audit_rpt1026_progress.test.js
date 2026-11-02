// AUDIT RPT1026 (lane F, PROGRESS - an audit of FIELD BUGS 2026-10-26r's progression, spell and item fixes): the findings
// the audit proved, each pinned on the producers the game runs. The record is bible/01-Overview/bugs/Field-Bugs-2026-10-26r.md
// (the RPT1026-PROGRESS section's AUDIT RPT1026 lines). Each test failed on the batch's head (2dc8f31a2) and passes with
// its fix:
//   F1  Master Skills switched off and on again dropped the tough-foe practice a mastered skill had earned since its last
//       rest (masterSkills.js setMasterSkills, PRACTICE-KEPT's drop) - the switch's own line promises it is kept.
//   F2  a piece carrying Cast When Used AND worn worth (armour, a power that works only worn) could no longer be put on
//       from its hotbar slot - every press cast it (quickslots.js, JEWEL-USED).
//   F3  a self-cast destruction spell at a full pool was never absorbed once a cost modifier discounted it: the cast made
//       room for what it PAID, the absorb asked room for the undiscounted price (absorption.js tryAbsorption) - the
//       batch's AS DESIGNED answer to the absorption report.
//   F4  an artifact's summon restored from a save stood unmarked - its death's finds lay on its body (exteriorFoes.js
//       snapshotWorld/restoreWorld, SUMMON-BARE's left item); and the end-to-end pin of the death's finds emptied.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { SKILLS, tallySkill } from '../../src/systems/skills.js';
import { createCharacter } from '../../src/systems/chargen.js';
import { buildCustomCareer } from '../../src/systems/customClass.js';
import { masterSkill, setMasterSkills } from '../../src/systems/masterSkills.js';
import { raiseSkills, SKILL_RAISE_CHECK_INTERVAL } from '../../src/systems/advancement.js';
import { noteSkillChallenge } from '../../src/systems/skillSoftcap.js';
import { snapshotPlayer, restorePlayer } from '../../src/systems/save/save.js';
import { playerEntity as PLAYER } from '../../src/characters/playerEntity.js';
import { createPlayerMagic } from '../../src/scenes/hostMagic.js';
import { buildCustomSpell, blankEffectSettings } from '../../src/systems/spell/spellMaker.js';
import { calculateCastCost, registerSpellCostMod } from '../../src/systems/spellcost.js';
import { createExteriorFoes } from '../../src/scenes/exteriorFoes.js';
import { createEnchantCtx } from '../../src/scenes/hostEnchant.js';
import { doItemEnchantmentPayloads, PAYLOAD, ENCHANTMENT_TYPES as T, setDefaultEnchantCtx } from '../../src/systems/enchantments.js';
import { ARTIFACTS } from '../../src/systems/artifactEffects.js';
import { createArtifact } from '../../src/systems/loot/loot.js';
import { MOBILE_TYPES } from '../../src/characters/mobile/mobileTypes.js';
import { installSurvivalLoot, uninstallSurvivalLoot } from '../../src/systems/survival/loot.js';
import { corpseFoodOn } from '../../src/systems/survival/switch.js';
import { fakeMagicTemplates } from '../honestItems.mjs';   // DFU's own MAGIC.DEF table (dfuMagicItems.mjs)

const STATS = { strength: 50, intelligence: 100, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 };

// ─── F1: Master Skills off and on again ───────────────────────────────────────────────────────────────────────────

const LB = SKILLS.LongBlade;
const blade = buildCustomCareer({ name: 'Blade', hp: 12, stats: STATS,
  skills: [SKILLS.LongBlade, SKILLS.Archery, SKILLS.Destruction, SKILLS.Dodging, SKILLS.Running, SKILLS.Jumping,
    SKILLS.ShortBlade, SKILLS.Medical, SKILLS.Etiquette, SKILLS.Streetwise, SKILLS.Lockpicking, SKILLS.Stealth] });
/** An offline level-20 character, Master Skills on, Long Blade mastered and trained to 110. */
function master() {
  const p = structuredClone(PLAYER);
  createCharacter(p, blade, -1, { rolls: () => 0.5 });
  p.chargenDone = true; p.level = 20; p._online = false; p.masterSkills = true;
  p.skills[LB] = 100;
  assert.equal(masterSkill(p, LB).ok, true);
  p.skills[LB] = 110;
  return p;
}
/** Blows on a foe tough for the skill (a level-30 foe: tier 180 against 110), each one noted as the fight's. */
const toughBlows = (p, n) => { for (let i = 0; i < n; i++) { noteSkillChallenge(p, { level: 30 }); tallySkill(p, LB, 1); } };
/** A rest's skill pass, its 360-minute gate cleared. */
const restPass = (p) => raiseSkills(p, (p.lastSkillCheckTime ?? 0) + SKILL_RAISE_CHECK_INTERVAL + 1, () => 0.5, () => {});

test('AUDIT RPT1026 F1 (Master Skills off and on): the tough-foe practice a mastered skill earned since its last rest is kept across the switch - held aside off, given back on; the plain uses counted while off are still dropped (mutants: nothing held; nothing given back; the plain uses kept)', () => {
  const p = master();
  toughBlows(p, 200);
  const earned = p.skillUses[LB];
  assert.ok(earned > 20, `a tough foe taught it ${earned} uses past 100`);
  assert.equal(setMasterSkills(p, false).ok, true);
  for (let i = 0; i < 5000; i++) tallySkill(p, LB, 1);   // off, a mastered skill past 100 counts every weak blow whole
  assert.equal(setMasterSkills(p, true).ok, true);
  assert.equal(p.skillUses[LB], earned, '"Your progress is kept": the tough blows are back, and none of the plain ones');
  // and they are progress: the rest after it banks exactly them (MOVE-BANK) - a twin that never switched banks the same
  const twin = master();
  toughBlows(twin, 200);
  assert.equal(twin.skillUses[LB], earned, 'the twin earned the same');
  restPass(p); restPass(twin);
  assert.ok(p.skillProgress[LB] > 0);
  assert.equal(p.skillProgress[LB], twin.skillProgress[LB], 'the switched character banked what the twin banked');
});

test('AUDIT RPT1026 F1: the held practice rides a save made while the switch is off, and a switch pressed off twice holds nothing twice (mutants: the save drops it)', () => {
  const p = master();
  toughBlows(p, 200);
  const earned = p.skillUses[LB];
  setMasterSkills(p, false);
  setMasterSkills(p, false);   // an unmoved switch
  const snap = JSON.parse(JSON.stringify(snapshotPlayer(p)));
  const back = structuredClone(PLAYER);
  restorePlayer(back, snap);
  back._online = false;
  setMasterSkills(back, true);
  assert.equal(back.skillUses[LB], earned, 'loaded and switched on: the tough blows are back');
  assert.equal(back.masterPracticeHeld ?? null, null, 'and nothing is left held');
});

// ─── F2: a worn piece with Cast When Used on the hotbar ───────────────────────────────────────────────────────────

test('AUDIT RPT1026 F2 (the hotbar): a piece carrying Cast When Used beside a power that works only worn is put on by its slot, then cast once it is on; a Cast When Used cuirass is put on; a jewel of Cast When Used alone is still cast unworn (mutants: worn worth never asked; asked of every piece; the worn state never asked)', async () => {
  const QS = await import('../../src/systems/quickslots.js');
  const { applyEnchantments } = await import('../../src/systems/enchanting.js');
  const { enchantmentSettings } = await import('../../src/systems/enchantmentCatalogue.js');
  const { isEnchanted } = await import('../../src/systems/inventory.js');
  const { isEquipped } = await import('../../src/systems/equip.js');
  const { mintCondition, setItemFields } = await import('../../src/systems/item/itemTemplates.js');
  const me = structuredClone(PLAYER);
  createCharacter(me, blade, -1, { rolls: () => 0.5 });
  const made = (fields, rows) => {
    const it = mintCondition(setItemFields({ material: 0, flags: 0, variant: 0, message: 0, stackCount: 1, ...fields }));
    applyEnchantments(it, rows.map(([type, param]) => enchantmentSettings(type, param)), { owner: me });   // the item maker's SetEnchantments
    return it;
  };
  const both = made({ group: 'Jewellery', templateIndex: 133 }, [['CastWhenUsed', 31], ['CastWhenHeld', 41]]);   // Lightning; Water Walking
  const plate = made({ group: 'Armor', templateIndex: 102, material: 0 }, [['CastWhenUsed', 31]]);   // a leather cuirass
  // a ring of Cast When Used, made light (Feather Weight: the piece's weight wherever it lies) and cheap (a side effect's cost)
  const used = made({ group: 'Jewellery', templateIndex: 135 }, [['CastWhenUsed', 31], ['FeatherWeight', undefined], ['ItemDeteriorates', 2]]);
  me.items = [both, plate, used];
  const readied = [];
  setDefaultEnchantCtx({ spellsByIndex: () => new Map([[31, { name: 'Lightning', rangeType: 2, effects: [] }]]), setReadySpell: (r) => readied.push(r.name) });
  const doors = { quickUse: (n) => { QS.useQuickslot(n === 1 ? 'c1' : 'c2', { entity: me, items: me.items, hooks: { isEnchanted } }); return true; } };
  const press = (i) => QS.hotbarPress(i, { entity: me, doors, say: () => {} });
  try {
    assert.deepEqual([QS.hotbarKindOf(both), QS.hotbarKindOf(plate), QS.hotbarKindOf(used)], ['wear', 'wear', 'use']);
    QS.setHotbarSlot(0, QS.hotbarEntryForItem(both));
    press(0);
    assert.deepEqual([isEquipped(both), readied.length], [true, 0], 'the first press puts the amulet on - its Water Walking works only worn');
    press(0);
    assert.deepEqual([isEquipped(both), readied], [true, ['Lightning']], 'on, the press casts its Lightning and leaves it on');
    QS.setHotbarSlot(1, QS.hotbarEntryForItem(plate));
    press(1);
    assert.deepEqual([isEquipped(plate), readied.length], [true, 1], 'a cuirass is put on - its armour is worn');
    QS.setHotbarSlot(2, QS.hotbarEntryForItem(used));
    press(2);
    assert.deepEqual([isEquipped(used), readied.length], [false, 2], 'a ring of Cast When Used and no worn power is cast unworn, as JEWEL-USED has it');
    QS.setHotbarSlot(3, { ...QS.hotbarEntryForItem(used), kind: 'wear' });   // a slot saved as worn before JEWEL-USED
    press(3);
    assert.deepEqual([isEquipped(used), readied.length], [false, 3], 'and its old worn slot casts it too');
    // and a piece of Cast When Held alone is UI2's to the letter: on, then off - never used
    const held = made({ group: 'Jewellery', templateIndex: 133 }, [['CastWhenHeld', 41]]);
    me.items.push(held);
    QS.setHotbarSlot(4, QS.hotbarEntryForItem(held));
    press(4);
    assert.deepEqual([isEquipped(held), readied.length], [true, 3], 'a Cast When Held amulet is put on');
    press(4);
    assert.deepEqual([isEquipped(held), readied.length], [false, 3], 'and taken off again');
  } finally { setDefaultEnchantCtx(null); QS.clearQuickslots(); }
});

// ─── F3: absorbing my own spell at a full pool ─────────────────────────────────────────────────────────────────────

const absorber = { ...buildCustomCareer({ name: 'Absorber', hp: 8, stats: STATS,
  skills: [SKILLS.Destruction, SKILLS.Mysticism, SKILLS.Thaumaturgy, SKILLS.Alteration, SKILLS.Restoration, SKILLS.Illusion,
    SKILLS.Medical, SKILLS.Etiquette, SKILLS.Streetwise, SKILLS.Lockpicking, SKILLS.Stealth, SKILLS.Dodging] }),
  abilityFlagsAndSpellPointsBitfield: 0, spellAbsorptionFlags: 4 };   // Spell Absorption: Always (the Sorcerer's advantage)
/** The cast engine every host builds (scenes/hostMagic.js createPlayerMagic), a wall 0.4 m ahead of the hands. */
function caster(p) {
  const parked = [];
  const magic = createPlayerMagic({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch() {} },
    audio: { playOneShot() {}, playOneShotId() {}, play3d() {}, play3dId() {} },
    getTexture: async () => ({ getSize: () => [16, 16], getScale: () => [0, 0] }),
    uploadRecord() {}, uploadRecordFrame() {},
    collider: { raycast: () => 0.4 },
    playerEntity: p,
    playerSinks: { hurt(n) { p.health -= n; }, heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {}, say() {} },
    say() {}, surfacePlayer() {},
    foes: () => [],
    foeSinks: () => ({}),
    absorbCtx: () => ({ inside: true, day: false }),
    rolls: () => 0.5,
    startCastAnim: (_sp, release) => { parked.push(release); return true; },
  });
  magic.firePending([0, 0.9, 0], [0, 0, 1]);
  return { magic, release: () => parked.splice(0).forEach((fn) => fn()) };
}
/** An Area at Range Shock Damage Health (the report's: a blast that catches its caster). */
const BLAST = buildCustomSpell({ slots: [{ type: 4, subType: 0, settings: { ...blankEffectSettings(), magnitudeBaseLow: 10, magnitudeBaseHigh: 10 } }], rangeType: 4, element: 3, name: 'Blast' });
/** Rested (a full pool), ready the blast and loose it into the wall in front: the hurt it did and the magicka after. */
function blastAtFullPool(discount) {
  const p = structuredClone(PLAYER);
  createCharacter(p, absorber, -1, { rolls: () => 0.5 });
  p.chargenDone = true; p.level = 20; p.skills[SKILLS.Destruction] = 80;
  p.magicka = p.maxMagicka; p.health = p.maxHealth;
  if (discount) registerSpellCostMod('audit-rpt1026-f3', (_e, sp) => sp * 0.7);
  try {
    const paid = calculateCastCost(BLAST, p).sp;
    const r = caster(p);
    const hp = p.health;
    assert.equal(r.magic.readySpell(BLAST), true);
    assert.equal(r.magic.interceptAttack(true, { cast: true }), true);
    r.magic.firePending([0, 0.9, 0], [0, 0, 1]);
    r.release();
    assert.equal(p.maxMagicka - p.magicka, paid, `the cast spent ${paid}, the room it made`);
    for (let i = 0; i < 5; i++) r.magic.update(0.05, [0, 0, 0], [0, 0, 1]);
    return { paid, hurt: hp - p.health, magicka: p.magicka, max: p.maxMagicka };
  } finally { registerSpellCostMod('audit-rpt1026-f3', null); }
}

test('AUDIT RPT1026 F3 (absorbing my own blast after a rest): at a full pool the cast makes room for what it paid, and that is room enough - with a 30% discount the blast is absorbed, as it is without one; the gain never passes what it spent (mutants: the undiscounted price asked of the room; every caster\'s payment read)', () => {
  const plain = blastAtFullPool(false);
  assert.equal(plain.hurt, 0, 'undiscounted, the absorber drinks its own blast (DFU\'s TryAbsorption: the room is the price)');
  const cheap = blastAtFullPool(true);
  assert.ok(cheap.paid < plain.paid, `the discount: ${cheap.paid} for ${plain.paid}`);
  assert.equal(cheap.hurt, 0, 'discounted, it is drunk too - it was the discount that left too little room');
  assert.ok(cheap.magicka < cheap.max, 'and nothing is made of it: the refund is half of what was spent (ABSORB-NERF, the self-cast cap)');
});

test('AUDIT RPT1026 F3: drunk in the room it made, my own spell gives back less than it spent - a CasterOnly blast at a 60% discount, after a dearer cast (the cap DFU reads is the LAST cast\'s), leaves the pool lower than it found it (mutants: the whole price drunk)', () => {
  const p = structuredClone(PLAYER);
  createCharacter(p, absorber, -1, { rolls: () => 0.5 });
  p.chargenDone = true; p.level = 20; p.skills[SKILLS.Destruction] = 80;
  p.magicka = p.maxMagicka; p.health = p.maxHealth;
  const self = (m, name) => buildCustomSpell({ slots: [{ type: 4, subType: 0, settings: { ...blankEffectSettings(), magnitudeBaseLow: m, magnitudeBaseHigh: m } }], rangeType: 0, element: 3, name });
  registerSpellCostMod('audit-rpt1026-f3', (_e, sp) => sp * 0.4);
  try {
    const r = caster(p);
    assert.equal(r.magic.readySpell(self(60, 'Dear')), true); r.release();   // the dearer cast before it
    p.magicka = p.maxMagicka; p.health = p.maxHealth;   // a rest
    const cheap = self(10, 'Cheap');
    const paid = calculateCastCost(cheap, p).sp;
    assert.equal(r.magic.readySpell(cheap), true); r.release();
    assert.equal(p.health, p.maxHealth, 'drunk: the blast did no harm');
    assert.ok(p.magicka < p.maxMagicka, `it spent ${paid} and gave back less - no magicka made of my own blast`);
  } finally { registerSpellCostMod('audit-rpt1026-f3', null); }
});

test('AUDIT RPT1026 F3: the rule is the caster\'s own spell alone - another\'s discounted blast still needs room for its whole price (mutants: every caster\'s payment read)', async () => {
  const { applySpell } = await import('../../src/systems/effects.js');
  const { effectCastingCost } = await import('../../src/systems/absorption.js');
  const body = () => {
    const e = structuredClone(PLAYER);
    createCharacter(e, absorber, -1, { rolls: () => 0.5 });
    e.chargenDone = true; e.level = 20; e.health = e.maxHealth;
    return e;
  };
  const me = body(), mate = body();
  const price = effectCastingCost(BLAST.effects[0], 4, mate);
  const paid = Math.floor(price * 0.7);
  // a release's caster as the engine mints it (hostMagic.js playerCaster: { entity, sinks, cast: { cost } })
  const castBy = (entity) => ({ entity, sinks: {}, cast: { cost: paid } });
  const land = (target, by) => {
    target.magicka = target.maxMagicka - paid;   // room for what the blast paid, short of its price
    return applySpell(BLAST, 20, target, { hurt(n) { target.health -= n; } }, () => 0.5, castBy(by), { inside: true, day: false, selfCastCost: paid });
  };
  assert.ok(land(me, me).absorbed > 0, 'my own blast, landing on me, is drunk in the room it made');
  assert.equal(land(mate, me).absorbed ?? 0, 0, 'my blast landing on another absorber asks their room for its whole price, as ever');
});

// ─── F4: a summon restored from a save ─────────────────────────────────────────────────────────────────────────────

const ARENA2 = process.env.ARENA2_PATH ?? '';
const SKIP = existsSync(join(ARENA2, 'MONSTER.BSA')) ? false : 'no ARENA2 - run tools/fetch-data.sh and set ARENA2_PATH';
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 1 };
const settle = () => new Promise((r) => setTimeout(r, 0));
const streetPlayer = () => ({ isPlayer: true, level: 20, reflexes: 2, health: 500, maxHealth: 500, skills: new Array(40).fill(50), skillUses: new Array(40).fill(0), items: [], goldPieces: 0, activeEffects: [], gender: 'male', stats: { ...STATS, intelligence: 50 }, armorValues: new Array(7).fill(60) });
/** The street's pool (scenes/exteriorFoes.js - a building's too) on the freeware's MONSTER.BSA, and the ONE enchant ctx
 *  the hosts mount over it, its stand the street host's own door (a loose stand, the alliance passed through). */
function street() {
  const pe = streetPlayer();
  const foes = createExteriorFoes({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
    collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false, capsuleCast: () => ({ dist: Infinity, key: null }), sphereCast: () => ({ dist: Infinity, key: null }), move: (feet, mx, my, mz) => { feet[0] += mx; feet[2] += mz; return { grounded: true, hitCeiling: false, groundKey: 'floor' }; } },
    fetchBytes: async (n) => new Uint8Array(readFileSync(join(ARENA2, n))), getTexture: async () => stubTex, uploadRecordFrame: () => {},
    currentMinute: () => 0, currentPixelKey: () => '3,12', playerEntity: pe, audio: null, onPlayerHurt: () => {}, rolls: () => 0.3, rand: () => 0.3, spellsByIndex: () => null, say: () => {},
  });
  const ctx = createEnchantCtx({
    playerEntity: pe, spellsByIndex: () => new Map(), now: () => 0, sinks: {}, magic: null,
    foes: () => foes.foes, foeSinks: () => ({}), feet: () => [0, 0, 0],
    standLooseFoe: (mt, o = {}) => foes.spawnFoe(mt, [4, 0, 4], { yaw: 0, allied: o.allied, loose: true, feetGiven: true }),
  });
  return { pe, foes, ctx };
}
function skull() {
  const magic = fakeMagicTemplates();
  for (let i = 0; i < 64; i++) {
    let it;
    try { it = createArtifact(magic, i); } catch { break; }
    if ((it.enchantments ?? []).some((e) => e.type === T.SpecialArtifactEffect && e.param === ARTIFACTS.SkullOfCorruption)) return it;
  }
  throw new Error('no Skull of Corruption in the table');
}
const toNative = (feet) => ({ x: feet[0], z: feet[2] });
const fromNative = (x, z) => [x, z];

test('AUDIT RPT1026 F4 (a summon after a load): the Skull\'s copy of a bear dies bare, its meat thrown away (the death\'s finds emptied, end to end); saved alive and loaded, it is still a summon - bare, and its death lays nothing on it (mutants: the mark unsaved; the mark not restored; the death\'s finds kept)', { skip: SKIP }, async () => {
  uninstallSurvivalLoot(); installSurvivalLoot({ enabled: () => true });   // the corpse's food, a death handler every game installs (worldTick.js; on here whatever the switch says)
  try {
    const a = street();
    const bear = await a.foes.spawnFoe(MOBILE_TYPES.GrizzlyBear, [6, 0, 6], { yaw: 0, feetGiven: true });
    assert.ok(bear?.entity);
    const item = skull();
    doItemEnchantmentPayloads(PAYLOAD.Used, item, { entity: a.pe, ctx: a.ctx, collection: a.pe.items });
    await settle(); await settle();
    const first = a.foes.foes.find((f) => f !== bear && f.entity?.team === 'PlayerAlly');
    assert.equal(first?.entity?.summoned, true, 'the Skull stood a summon');
    a.foes.damageFoe(first, 1e6, [0, 0, 0]);
    assert.deepEqual(first.entity.items, [], 'its death laid its meat on it, and the cap threw it away');
    // a second copy, saved alive - and the save loaded into a fresh street
    doItemEnchantmentPayloads(PAYLOAD.Used, item, { entity: a.pe, ctx: a.ctx, collection: a.pe.items });
    await settle(); await settle();
    const saved = a.foes.snapshotWorld(toNative);
    assert.equal(saved.filter((sf) => sf.team === 'PlayerAlly').length, 1, 'the living summon is in the save');
    const b = street();
    b.foes.restoreWorld(saved, fromNative);
    await settle(); await settle(); await settle();
    const back = b.foes.foes.find((f) => f.entity?.team === 'PlayerAlly');
    assert.ok(back, 'the summon stands again');
    assert.deepEqual([back.entity.summoned, back.entity.items], [true, []], 'still a summon, carrying nothing');
    b.foes.damageFoe(back, 1e6, [0, 0, 0]);
    assert.deepEqual(back.entity.items, [], 'and its death leaves nothing - no meat, no card');
    const plain = b.foes.foes.find((f) => f.mobileType === MOBILE_TYPES.GrizzlyBear && f.entity?.team !== 'PlayerAlly');
    b.foes.damageFoe(plain, 1e6, [0, 0, 0]);
    assert.ok(plain.entity.items.length > 0, 'the bear it fought, loaded beside it, is a bear\'s body as ever');
  } finally { uninstallSurvivalLoot(); installSurvivalLoot({ enabled: corpseFoodOn }); }   // the game's own install back
});
