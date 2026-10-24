// BAL9 - DESTRUCTION'S CHANNELS (2026-10-12; bible/05-Combat/Balance-Arc.md section 15). The owner: "I think destruction
// needs a buff. A lot of players saying its lack luster. I want to also introduce some new magic/mage perks to the rarity
// loot pool since weve done a lot of needing but still dont make it overpowered". The measurement found a Destruction
// spell's damage had no channel but its caster's level (EntityEffect.GetMagnitude) - the school's skill prices it alone:
//   - A SPELL NEVER ANSWERED ITS FOE. Only a weapon blow noted the fight's foe (formulas.js), so past 100 a school's casts
//     at an Ancient Lich tallied at the quarter a light in an empty room does. A spell that reaches a foe notes it now,
//     and a foe's spell on me (BAL9a).
//   - THE SCHOOL PAST 100 BOUGHT ONLY ITS PRICE. Online SPELL-COST-PAST prices those points at 100 / skill while the same
//     mastery raises the foes (a Destruction at 200: x0.58 the price, a Crypt's foes x1.30 health). Each effective point
//     past 100 is 1% more damage now, to x1.4 - CLIMB-PAST's law (BAL9b).
//   - THE LADDER PAID A CASTER ONLY IN PRICE AND TEMPO. The potency and wellspring lines, and the arcane three, capped as
//     every line is (BAL9c).
// Pinned by execution through the real cast engine's doors (scenes/hostMagic.js), the real applySpell (systems/
// effects.js), the real mint (systems/loot/lootRarity.js), the item law (systems/item/itemLaw.js) and the powers' hooks
// (systems/loot/lootPowers.js).
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setPref, _resetForTests } from '../../src/systems/uiPrefs.js';
import * as LR from '../../src/systems/loot/lootRarity.js';
import * as LP from '../../src/systems/loot/lootPowers.js';
import * as SP from '../../src/systems/spell/spellPower.js';
import { _resetSetPowersForTests } from '../../src/systems/sigil/sigilSetPowers.js';
import { setPlayerDoor } from '../../src/systems/playerDoor.js';
import { equipItem } from '../../src/systems/equip.js';
import { mintCondition } from '../../src/systems/item/itemTemplates.js';
import { createWeapon } from '../../src/combat/enemyEquipment.js';
import { validLootItem } from '../../src/systems/loot/loot.js';
import { itemFindings } from '../../src/systems/item/itemLaw.js';
import { applySpell } from '../../src/systems/effects.js';
import { savingChance, EFFECT_FLAGS } from '../../src/systems/spellcast.js';
import { SKILLS, skillValue } from '../../src/systems/skills.js';
import { overcapTallyWeight, challengeTier, UNCHALLENGED_MAGIC_WEIGHT } from '../../src/systems/skillSoftcap.js';
import { createCharacter } from '../../src/systems/chargen.js';
import { buildCustomCareer } from '../../src/systems/customClass.js';
import { masterSkill } from '../../src/systems/masterSkills.js';
import { playerEntity } from '../../src/characters/playerEntity.js';
import { createPlayerMagic } from '../../src/scenes/hostMagic.js';
import { SPECIAL_ABILITY } from '../../src/systems/rest/rest.js';

const D = SKILLS.Destruction;
const on = () => { _resetForTests(); setPref('lootRarity', true); LP._resetLootPowersForTests(); _resetSetPowersForTests(); setPlayerDoor(null); };
const off = () => { _resetForTests(); setPref('lootRarity', false); };
const lcg = (seed) => () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >>> 8) / 0x800000; };
const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };
/** The page's own switch (onlineLane.js isOnlinePage), for the doors that read it themselves. */
function page(online, fn) {
  const had = Object.hasOwn(globalThis, 'location') ? globalThis.location : undefined;
  globalThis.location = { search: online ? '?online' : '' };
  try { return fn(); } finally { if (had === undefined) delete globalThis.location; else globalThis.location = had; }
}
const STATS = { strength: 50, intelligence: 80, willpower: 60, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 };
const career = buildCustomCareer({ name: 'Mage', hp: 8, stats: STATS,
  skills: [D, SKILLS.Restoration, SKILLS.Alteration, SKILLS.Mysticism, SKILLS.Illusion, SKILLS.Thaumaturgy,
    SKILLS.ShortBlade, SKILLS.Archery, SKILLS.Medical, SKILLS.Etiquette, SKILLS.Streetwise, SKILLS.Lockpicking] });
/** A chargen'd mage whose Destruction is mastered and stands at `raw` - Master Skills in force, as online it always is. */
function mage(raw) {
  const p = structuredClone(playerEntity);
  createCharacter(p, career, -1, { rolls: () => 0.5 });
  p._online = true; p.level = 20;
  p.skills[D] = 100;
  assert.equal(masterSkill(p, D).ok, true);
  p.skills[D] = raw;
  return p;
}
const plain = (over = {}) => ({ isPlayer: true, items: [], stats: { ...STATS }, skills: new Array(35).fill(50), level: 20, career: {}, activeEffects: [], health: 100, maxHealth: 100, magicka: 200, maxMagicka: 200, ...over });
const ring = (affixes, templateIndex = 135) => Object.assign(mintCondition({ group: 'Jewellery', templateIndex, name: 'Ring', flags: 0 }), { rarity: 'rare', affixes });
const wear = (e, it) => { e.items.push(it); equipItem(e, it); return it; };
function legendary(id) {
  const rec = LR.legendaryById(id);
  const t = rec.templates[0];
  const base = rec.group === 'Weapons' ? createWeapon(t, 1, () => 0.5) : mintCondition({ group: rec.group, templateIndex: t, name: 'X', flags: 0 });
  const it = LR.applyRarity(base, 'legendary', lcg(1), [rec]);
  it.isIdentified = true;
  return it;
}
/** A foe that saves at 50 + its Willpower's tenth: Willpower 0 is 50, which a roll of 100 always fails. */
const foe = (over = {}) => ({ isPlayer: false, career: {}, stats: { willpower: 0 }, activeEffects: [], level: 21, ...over });
const fx = (type, lo, hi = lo) => ({ type, subType: 0, durationBase: 1, durationMod: 0, durationPerLevel: 1, chanceBase: 0, chanceMod: 0, chancePerLevel: 1,
  magnitudeBaseLow: lo, magnitudeBaseHigh: hi, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1 });
const BOLT = (n) => ({ name: 'Bolt', rangeType: 2, element: 0, effects: [fx(4, n)] });   // Damage Health, fire, at range
const BURN = (n) => ({ name: 'Burn', rangeType: 2, element: 0, effects: [fx(1, n)] });   // Continuous Damage Health
/** What a spell lands on `target` from `caster` through the real applySpell (a roll of 100 fails every save). */
function lands(sp, caster, target = foe(), rolls = () => 0.999) {
  let d = 0;
  applySpell(sp, 20, target, { hurt: (n) => { d += n; } }, rolls, caster ? { entity: caster } : null);
  return d;
}

test('BAL9a A SPELL ANSWERS ITS FOE: my spell that reaches a foe, and a foe\'s that reaches me, is the fight\'s - past 100 a school learns by that foe, as a weapon does, and never under the quarter a cast at a wall takes; never my ally, never a peer\'s stand-in (mutants: the landing forgets; an ally counts; a peer\'s counts; a foe\'s spell forgets; the floor dropped)', () => {
  const p = plain({ health: 50, skills: new Array(35).fill(150) });
  const magic = createPlayerMagic({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch() {} },
    audio: { playOneShot() {}, playOneShotId() {}, play3d() {}, play3dId() {} },
    getTexture: async () => ({ getSize: () => [16, 16], getScale: () => [0, 0] }), uploadRecord() {}, uploadRecordFrame() {},
    collider: { raycast: () => Infinity }, playerEntity: p,
    playerSinks: { hurt() {}, heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {}, say() {} },
    say() {}, surfacePlayer() {}, foes: () => [], foeSinks: () => ({ hurt() {}, heal() {} }), absorbCtx: () => ({ inside: true, day: false }),
    rolls: () => 0.999, startCastAnim: null,
  });
  const lich = foe({ level: 21 });
  // the root: before any spell, a cast past 100 counts the quarter a light in an empty room does
  assert.equal(p._skillChallenge, undefined);
  assert.equal(overcapTallyWeight(p, D, 1, 120), UNCHALLENGED_MAGIC_WEIGHT);
  magic.applySpellToFoe(BOLT(10), 20, { entity: lich });
  assert.deepEqual(p._skillChallenge?.tier, challengeTier(lich), 'my fireball at the Ancient Lich is the fight\'s foe');
  assert.equal(challengeTier(lich), 135);
  assert.equal(overcapTallyWeight(p, D, 1, 120), 1.125, 'a foe tough for the school teaches it whole and more (135 / 120)');
  // a weak foe never takes a cast under the quarter - a cast at a rat teaches what a cast at a wall does, never less
  delete p._skillChallenge; delete p._skillSpam;
  magic.applySpellToFoe(BOLT(10), 20, { entity: foe({ level: 1 }) });
  assert.equal(p._skillChallenge?.tier, 35, 'the rat is the fight\'s');
  assert.equal(overcapTallyWeight(p, D, 1, 150), UNCHALLENGED_MAGIC_WEIGHT, 'a rat at 150: the floor');
  // my own ally is no fight; a peer's stand-in's spell is not mine
  delete p._skillChallenge;
  magic.applySpellToFoe(BOLT(10), 20, { entity: foe({ team: 'PlayerAlly' }) });
  assert.equal(p._skillChallenge, undefined, 'an ally is not the fight\'s foe');
  magic.applySpellToFoe(BOLT(10), 20, { entity: lich }, { entity: { level: 20 } }, { peerCaster: 'peer-0002' });
  assert.equal(p._skillChallenge, undefined, 'a peer\'s strike spell on my foe is the peer\'s fight');
  // both directions, as the blow's: a foe's spell on me
  magic.applySpellToPlayer(BOLT(1), 21, { entity: lich });
  assert.equal(p._skillChallenge?.tier, 135, 'the Lich that burned me is the fight\'s');
});

test('BAL9b THE SCHOOL PAST 100 IS ITS POTENCY: online, 1% a point of Destruction\'s climb past 100 to x1.4, instant and per round; offline, at a player, a peer\'s or a foe\'s cast, a resisted spell, a worn line, while mentoring - nothing more (mutants: offline too; 2% a point; at a player; a peer\'s; the seam skipped; a resisted spell made one; the worn line strikes; while mentoring)', () => {
  off();
  const at = (raw, online, sp = BOLT(50), target = foe()) => page(online, () => lands(sp, mage(raw), target));
  // DFU's own to 100, and offline where Daggerfall's price term already pays the points past it
  assert.deepEqual([100, 150, 200].map((r) => at(r, false)), [50, 50, 50]);
  assert.deepEqual([100, 150, 200].map((r) => page(true, () => skillValue(mage(r), D))), [100, 117, 140]);
  assert.deepEqual([100, 150, 200].map((r) => at(r, true)), [50, 59, 70], 'x1, x1.17, x1.4');
  assert.deepEqual([100, 150, 200].map((r) => page(true, () => SP.schoolPotency(mage(r)))), [1, 1.17, 1.4]);
  assert.equal(at(200, true, BURN(50)), 70, 'a damage over time\'s first round too (the round\'s own door)');
  // never at a player (a refereed fight's stand-in is one), never a peer's stand-in, never a foe's spell
  assert.equal(at(200, true, BOLT(50), foe({ isPlayer: true, peer: true })), 50, 'a duel\'s stand-in');
  assert.equal(page(true, () => lands(BOLT(50), { ...mage(200), peer: true })), 50, 'a peer\'s');
  assert.equal(page(true, () => lands(BOLT(50), foe({ skills: 200 }))), 50, 'a foe\'s');
  // a spell the throw turned whole stays nothing
  assert.equal(at(200, true, BOLT(50), foe({ career: { immunityFlags: EFFECT_FLAGS.Fire } })), 0);
  // the climb alone - what the foes' edge reads: a worn Destruction line prices the spell (the live value) and strikes
  // no harder, and nothing lifts the climb past its effective cap
  on();
  const lifted = mage(100);
  wear(lifted, legendary('eye-of-magnus'));   // +25 Destruction
  assert.equal(page(true, () => skillValue(lifted, D)), 125, 'the live value the price reads');
  assert.equal(page(true, () => lands(BOLT(100), lifted)), 100, 'a school lifted past 100 by a worn line strikes as at 100');
  const capped = mage(200);
  wear(capped, legendary('eye-of-magnus'));
  assert.equal(page(true, () => skillValue(capped, D)), 165);
  assert.equal(page(true, () => lands(BOLT(100), capped)), 140, 'x1.4, whatever is worn');
  off();
  // mentoring reads none, as the edge reads none
  assert.equal(page(true, () => SP.schoolPotency({ ...mage(200), _mentor: { level: 5 } })), 1);
});

test('BAL9c THE LINES: potency and wellspring - a caster\'s, banded, worth focus\'s, worded, never past their ceilings; the last pass lands them on their groups alone, lawful on the wire and to the law (mutants: wellspring on a blade)', () => {
  on();
  assert.deepEqual(LR.AFFIX_IDS.slice(-3), ['castSpeed', 'potency', 'wellspring'], 'after every kind before them');
  const pot = LR.AFFIX_KINDS.potency, well = LR.AFFIX_KINDS.wellspring;
  assert.deepEqual([...pot.groups], ['Jewellery', 'Weapons']);
  assert.deepEqual([...well.groups], ['Jewellery']);
  assert.equal(pot.proc, true); assert.equal(well.proc, true);
  assert.equal(pot.params, null); assert.equal(well.params, null);
  assert.deepEqual(LR.AFFIX_RANGES.potency, { magic: [3, 6], rare: [6, 10], legendary: [10, 15] });
  assert.deepEqual(LR.AFFIX_RANGES.wellspring, { magic: [2, 4], rare: [4, 7], legendary: [7, 10] });
  assert.equal(LR.AFFIX_WORTH.potency, 60); assert.equal(LR.AFFIX_WORTH.wellspring, 60);
  assert.equal(LR.affixLabel({ id: 'potency', value: 8 }), '+8% spell damage');
  assert.equal(LR.affixLabel({ id: 'wellspring', value: 5 }), '5% magicka on a kill');
  assert.deepEqual(['magic', 'rare', 'legendary'].map((t) => LR.affixWord({ id: 'potency', value: 3 }, t)), ["Evoker's", "Battlemage's", "Warlock's"]);
  assert.deepEqual(['magic', 'rare', 'legendary'].map((t) => LR.affixWord({ id: 'wellspring', value: 3 }, t)), ['of the Spring', 'of the Wellspring', 'of the Font']);
  assert.equal(LR.validAffix({ id: 'potency', value: 16 }), false);
  assert.equal(LR.validAffix({ id: 'wellspring', value: 11 }), false);
  assert.equal(LR.validAffix({ id: 'potency', param: 'fire', value: 5 }), false, 'no param');
  // the last pass: a jewel's four (focus, castSpeed, potency, wellspring), a blade's five (... castSpeed, potency), armour none
  const jewel = () => ring([]);
  const blade = () => Object.assign(createWeapon(120, 1), { rarity: 'rare', affixes: [] });
  assert.equal(LR.addProcLine(jewel(), () => 0.6).id, 'potency');
  assert.equal(LR.addProcLine(jewel(), () => 0.999).id, 'wellspring');
  assert.equal(LR.addProcLine(blade(), () => 0.999).id, 'potency');
  const cuirass = Object.assign(mintCondition({ group: 'Armor', templateIndex: 102, material: 0x0200 + 1, name: 'Cuirass', flags: 0 }), { rarity: 'rare', affixes: [] });
  assert.equal(LR.addProcLine(cuirass, () => 0.999).id, 'thorns', 'armour carries neither');
  // a minted Rare carrying either is a lawful loot item - on the wire and to the law the account service judges by
  for (const [make, roll] of [[jewel, 0.6], [jewel, 0.999], [blade, 0.999]]) {
    const it = LR.applyRarity(make(), 'rare', lcg(7));
    it.affixes = it.affixes.filter((a) => !LR.isProcAffix(a));
    const line = LR.addProcLine(it, () => roll);
    assert.ok(['potency', 'wellspring'].includes(line.id));
    assert.ok(validLootItem(it), `${line.id} rides the wire`);
    assert.deepEqual(itemFindings(it), [], `${line.id}: lawful`);
  }
  off();
});

test('BAL9c POTENCY: what I wear, summed under 30, the loot\'s all under 50, through the real damage door; Arcane Surge above three quarters of my magicka; never at a player, a peer\'s, with the switch off (mutants: the cap at 40; the whole at 60; the surge always)', () => {
  on();
  const me = plain();
  assert.equal(lands(BOLT(100), me), 100);
  wear(me, ring([{ id: 'potency', value: 10 }], 135));
  wear(me, ring([{ id: 'potency', value: 15 }], 133));
  assert.equal(LP.lootSpellPower(me, foe()), 25);
  assert.equal(lands(BOLT(100), me), 125);
  wear(me, ring([{ id: 'potency', value: 15 }], 136));
  assert.equal(LP.POTENCY_CAP, 30);
  assert.equal(LP.lootSpellPower(me, foe()), 30, 'the lines, never past their cap');
  assert.equal(lands(BOLT(100), me), 130);
  // Shalidor's Brand wielded: +25 while my magicka stands above three quarters - and the loot's whole is at most 50
  wear(me, legendary('shalidors-brand'));
  me.magicka = 160;
  assert.equal(LP.SPELL_POWER_MOST, 50);
  assert.equal(LP.lootSpellPower(me, foe()), 50);
  assert.equal(lands(BOLT(100), me), 150);
  me.magicka = 150;   // three quarters exactly: not above
  assert.equal(lands(BOLT(100), me), 130);
  // never at a player, never a peer's, nothing with the switch off
  assert.equal(lands(BOLT(100), me, foe({ isPlayer: true, peer: true })), 100);
  assert.equal(LP.lootSpellPower({ ...me, peer: true }, foe()), 0);
  off();
  assert.equal(lands(BOLT(100), me), 100);
});

test('BAL9c THE CASTER\'S MAGICKA AND ITS THROW: wellspring on a kill under 10; the Wellspring of Artaeum 1% a round, 2% under half, never offline to a career that cannot regenerate; Magnus\'s Gaze 15 off a foe\'s throw, after its immunity (mutants: wellspring uncapped; the ring\'s low arm; the career ignored; the pierce dropped)', () => {
  on();
  const me = plain({ magicka: 0, maxMagicka: 200 });
  setPlayerDoor({ foes: () => [], player: () => me, castOnPlayer: () => {} });
  wear(me, ring([{ id: 'wellspring', value: 7 }], 135));
  LP.lootKill(foe());
  assert.equal(me.magicka, 14, '7% of 200');
  wear(me, ring([{ id: 'wellspring', value: 7 }], 133));
  assert.equal(LP.WELLSPRING_CAP, 10);
  LP.lootKill(foe());
  assert.equal(me.magicka, 34, 'never past 10% a kill (20 of 200)');
  LP.lootKill(foe({ team: 'PlayerAlly' }));
  assert.equal(me.magicka, 34, 'my ally\'s death pays nothing');
  // the Ring of Artaeum, each magic round
  const r = plain({ magicka: 150, maxMagicka: 200 });
  wear(r, legendary('ring-of-artaeum'));
  page(false, () => LP.lootRound(r));
  assert.equal(r.magicka, 152, '1% over half');
  r.magicka = 60;
  page(false, () => LP.lootRound(r));
  assert.equal(r.magicka, 64, '2% under half');
  r.magicka = 200;
  page(false, () => LP.lootRound(r));
  assert.equal(r.magicka, 200, 'never past the full');
  const sorcerer = plain({ magicka: 50, maxMagicka: 200, career: { abilityFlagsAndSpellPointsBitfield: SPECIAL_ABILITY.NoRegenSpellPoints } });
  wear(sorcerer, legendary('ring-of-artaeum'));
  page(false, () => LP.lootRound(sorcerer));
  assert.equal(sorcerer.magicka, 50, 'offline, a career that cannot regenerate magicka does not');
  page(true, () => LP.lootRound(sorcerer));
  assert.equal(sorcerer.magicka, 54, 'online every career\'s comes back (REST-MANA1)');
  // the Eye of Magnus: 15 off a foe's throw against my damage spell - after its immunity
  const eye = plain();
  wear(eye, legendary('eye-of-magnus'));
  const lich = foe({ stats: { willpower: 50 } });
  assert.equal(SP.spellPierce(eye, lich), 15);
  assert.equal(SP.spellPierce(eye, foe({ isPlayer: true, peer: true })), 0, 'never at a player');
  assert.equal(savingChance(0, EFFECT_FLAGS.Fire, lich).chance, 55);
  assert.equal(savingChance(0, EFFECT_FLAGS.Fire, lich, 0, 15).chance, 40);
  assert.deepEqual(savingChance(0, EFFECT_FLAGS.Fire, foe({ career: { immunityFlags: EFFECT_FLAGS.Fire } }), 0, 15), { immune: true, chance: 100 });
  // by execution: a roll of 30 is a whole save at 55 (more than 20 under it) and half a hit at 40
  const thirty = () => seq(0.5, 0.5, 0.295);
  assert.equal(lands(BOLT(100), plain(), lich, thirty()), 0);
  assert.equal(lands(BOLT(100), eye, lich, thirty()), 50);
  off();
});

test('BAL9c THE ARCANE THREE: the Eye of Magnus, the Ring of Artaeum and Shalidor\'s Brand - three Legendary lines, one DFU enchantment, found among casters, a power each on the record, after the wardrobe\'s six; minted lawful and named whole, in their groups\' pools', () => {
  on();
  assert.deepEqual(LR.ARCANE_LEGENDARIES.map((r) => r.id), ['eye-of-magnus', 'ring-of-artaeum', 'shalidors-brand']);
  const all = LR.allLegendaries().map((r) => r.id);
  assert.deepEqual(all.slice(LR.LEGENDARIES.length + LR.WARDROBE_LEGENDARIES.length, LR.LEGENDARIES.length + LR.WARDROBE_LEGENDARIES.length + 3), ['eye-of-magnus', 'ring-of-artaeum', 'shalidors-brand'], 'after the thirty and the six');
  assert.deepEqual(LR.ARCANE_LEGENDARIES.map((r) => [r.power.kind, LR.powerOf(r.id).name]), [['pierce', "Magnus's Gaze"], ['attune', 'Wellspring of Artaeum'], ['surge', 'Arcane Surge']]);
  for (const rec of LR.ARCANE_LEGENDARIES) {
    assert.equal(LR.foundAmong(rec.id), 'caster');
    assert.ok(rec.power.brief.length <= 32, `${rec.id}: the card's 32`);
    assert.ok(rec.affixes.length >= 3);
    for (const a of rec.affixes) {
      const [lo, hi] = LR.AFFIX_RANGES[a.id].legendary;
      assert.ok(a.value >= lo && a.value <= hi, `${rec.id} ${a.id}: the Legendary band`);
    }
    const it = legendary(rec.id);
    assert.equal(it.name, rec.name);
    assert.deepEqual(itemFindings(it), [], `${rec.id}: lawful`);
    assert.ok(validLootItem(it));
    assert.ok(LR.legendariesFor(it).some((r) => r.id === rec.id), `${rec.id}: in its pool`);
  }
  off();
});
