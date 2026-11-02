// RPT1026-PROGRESS (private reports, 2026-10-26): the progression and spell readers the batch's reports found wrong.
// Each test names its report by what it was, never by who sent it. The record is the batch's Field-Bugs page.
//
// Driven on the producers: a chargen'd character (systems/chargen.js createCharacter over a real custom career),
// its uses counted through skills.js tallySkill, mastered through masterSkills.js, raised by advancement.js
// raiseSkills; the wards cast through effects.js applySpell, each through its own door.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SKILLS, tallySkill } from '../../src/systems/skills.js';
import { createCharacter } from '../../src/systems/chargen.js';
import { buildCustomCareer } from '../../src/systems/customClass.js';
import { masterSkill, setMasterSkills, isMasteredSkill } from '../../src/systems/masterSkills.js';
import { raiseSkills, SKILL_RAISE_CHECK_INTERVAL } from '../../src/systems/advancement.js';
import { playerEntity } from '../../src/characters/playerEntity.js';

const LB = SKILLS.LongBlade;
const STATS = { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 };
const career = buildCustomCareer({
  name: 'Blade', hp: 12, stats: STATS,
  skills: [SKILLS.LongBlade, SKILLS.Archery, SKILLS.Destruction, SKILLS.Dodging, SKILLS.Running, SKILLS.Jumping,
    SKILLS.ShortBlade, SKILLS.Medical, SKILLS.Etiquette, SKILLS.Streetwise, SKILLS.Lockpicking, SKILLS.Stealth],
});

/** A level-20 character with Long Blade at 100, NOT mastered - online (Master Skills always in force) or offline with
 *  the switch as given. */
function fighter({ online = true, masterOn = false } = {}) {
  const p = structuredClone(playerEntity);
  createCharacter(p, career, -1, { rolls: () => 0.5 });
  p.chargenDone = true;
  p.level = 20;
  p._online = online;
  if (!online) p.masterSkills = masterOn;
  p.skills[LB] = 100;
  return p;
}
/** The rests after it: one raiseSkills pass each, the 360-minute gate cleared every time. */
function rest(p, passes = 1) {
  let at = p.lastSkillCheckTime ?? 0;
  for (let i = 0; i < passes; i++) { at += SKILL_RAISE_CHECK_INTERVAL + 1; raiseSkills(p, at, () => 0.5, () => {}); }
}
/** 20,000 blows on a weak foe, without a rest - each counted whole (no challenge recorded). */
const grind = (p) => { for (let i = 0; i < 20000; i++) tallySkill(p, LB, 1); };

test('RPT1026-PROGRESS (practice banked at 100, then mastered): a skill held at 100 and practised to the clamp, then mastered, keeps none of that practice - the rests after it raise nothing; mastered at once, its practice counts as ever (mutants: the counter kept at the mastery)', () => {
  const held = fighter();
  grind(held);
  assert.equal(held.skillUses[LB], 20000, 'the plain rule counted every use whole at 100 (DFU\'s TallySkill and its clamp)');
  assert.equal(masterSkill(held, LB).ok, true);
  assert.equal(isMasteredSkill(held, LB), true);
  assert.equal(held.skillUses[LB], 0, 'the mastery dropped the practice the plain rule counted');
  rest(held, 30);
  assert.equal(held.skills[LB], 100, 'thirty rests after the mastery raise nothing: no use was ever weighed against a tough foe');
  // the control: the same mastered skill, practised AFTER the mastery - its uses are the tough-foe rule's (none of these
  // weak blows counts past 100), so it holds at 100 too, and nothing was taken from it that it had earned
  const after = fighter();
  assert.equal(masterSkill(after, LB).ok, true);
  grind(after);
  assert.equal(after.skillUses[LB], 0, 'past 100 a weak foe teaches a mastered skill nothing (skillSoftcap.js overcapTallyWeight)');
});

test('RPT1026-PROGRESS (practice banked at 100, then mastered): offline, practice counted while Master Skills was off is dropped when it is switched on, for every skill mastered at 100; a skill below 100 keeps its uses (mutants: the switch keeps the counter; every skill dropped)', () => {
  const p = fighter({ online: false, masterOn: true });
  assert.equal(masterSkill(p, LB).ok, true);
  assert.equal(setMasterSkills(p, false).ok, true);
  grind(p);
  assert.equal(p.skillUses[LB], 20000, 'off, the skill mastered at the cap counted every weak blow whole');
  const below = SKILLS.Dodging;
  p.skills[below] = 60;
  for (let i = 0; i < 50; i++) tallySkill(p, below, 1);
  assert.equal(setMasterSkills(p, true).ok, true);
  assert.equal(p.skillUses[LB], 0, 'switched on: the plain practice of a skill that may now pass 100 is gone');
  assert.equal(p.skillUses[below], 50, 'a skill below 100 counts by the plain rule either way and keeps its uses');
  // switched on while already on, nothing moves
  p.skillUses[LB] = 7;
  assert.equal(setMasterSkills(p, true).ok, true);
  assert.equal(p.skillUses[LB], 7, 'a switch that did not move drops nothing');
  p.skillUses[LB] = 0;
  rest(p, 30);
  assert.equal(p.skills[LB], 100, 'and no rest turns the dropped practice into points');
});

// ─── #267: Blademaster's Flowing Steel, said on the HUD ───────────────────────────────────────────────────────────

test('RPT1026-PROGRESS (Blademaster\'s passive unseen): Flowing Steel builds on real blows through the formula and the HUD is told - a chip with its stacks and its seconds, gone when they run out; none for a fighter of another path (mutants: the chip never made; the stacks unsaid)', async () => {
  const MP = await import('../../src/systems/martialPaths.js');
  const POW = await import('../../src/systems/martialPowers.js');
  const { calculateAttackDamage } = await import('../../src/combat/formulas.js');
  const { makeEnemyEntity } = await import('../../src/characters/enemy/enemyEntity.js');
  const { ENEMY_BASICS } = await import('../../src/characters/enemy/enemyBasics.js');
  const { mintCondition, setItemFields } = await import('../../src/systems/item/itemTemplates.js');
  const { WEAPONS } = await import('../../src/characters/weapons.js');
  const { EQUIP_SLOTS, equipTableOf } = await import('../../src/systems/equip.js');
  const { readFileSync } = await import('node:fs');
  let clock = 100;
  POW._resetMartialPowersForTests(); POW._setMartialPowersClockForTests(() => clock);
  try {
    const path = (id) => {
      const p = fighter();
      for (const s of MP.MARTIAL_BY_ID[id].skills) { p.skills[s] = 100; assert.equal(masterSkill(p, s).ok, true); p.skills[s] = 120; }
      assert.equal(MP.chooseMartialPath(p, id).ok, true);
      return p;
    };
    const me = path('blademaster');
    const blade = mintCondition(setItemFields({ group: 'Weapons', templateIndex: WEAPONS.Shortsword, material: 0 }));
    me.items = [blade]; equipTableOf(me)[EQUIP_SLOTS.RightHand] = blade;
    const orc = () => Object.assign(makeEnemyEntity(7, ENEMY_BASICS[7], { hitPointsPerLevel: 8, strength: 50, intelligence: 50, willpower: 0, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 }, 21, () => 0.5), { activeEffects: [] });
    assert.deepEqual(POW.martialHudChips(me), [], 'no stack yet: no chip');
    for (let i = 0; i < 3; i++) calculateAttackDamage(me, orc(), { weapon: blade, rolls: () => 0.3 });
    assert.deepEqual(POW.martialHudChips(me), [{ key: 'flowing-steel', set: 'martial', name: 'Flowing Steel 3', text: '4s', state: 'active' }]);
    clock += 2.5;
    assert.equal(POW.martialHudChips(me)[0].text, '2s', 'its seconds run down');
    clock += 2;
    assert.deepEqual(POW.martialHudChips(me), [], 'and it is gone with the stacks');
    const other = path('ranger');
    for (let i = 0; i < 3; i++) calculateAttackDamage(other, orc(), { weapon: blade, rolls: () => 0.3 });
    assert.deepEqual(POW.martialHudChips(other), [], 'another path\'s passive builds no Flowing Steel');
    // the host that mounts the HUD hands it on beside the sets' and the Legendaries'
    const w = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');
    assert.ok(w.includes('setHudSetChips((e) => [...setHudChips(e), ...lootHudChips(e), ...martialHudChips(e)]);'));
  } finally { POW._resetMartialPowersForTests(); }
});

// ─── #66: a jewel's Cast When Used on the hotbar ───────────────────────────────────────────────────────────────────

test('RPT1026-PROGRESS (a jewel on the hotbar): a piece the item maker gave Cast When Used is USED by its hotbar slot - its spell readied, the piece neither put on nor taken off; a Cast When Held jewel is still worn; a slot saved as worn before the fix casts too (mutants: the kind unchanged; the saved slot worn)', async () => {
  const QS = await import('../../src/systems/quickslots.js');
  const { applyEnchantments } = await import('../../src/systems/enchanting.js');
  const { enchantmentSettings } = await import('../../src/systems/enchantmentCatalogue.js');
  const { setDefaultEnchantCtx } = await import('../../src/systems/enchantments.js');
  const { isEnchanted } = await import('../../src/systems/inventory.js');
  const { isEquipped } = await import('../../src/systems/equip.js');
  const { mintCondition, setItemFields } = await import('../../src/systems/item/itemTemplates.js');
  const me = fighter();
  const amulet = (type, param) => {
    const it = mintCondition(setItemFields({ group: 'Jewellery', templateIndex: 133, material: 0, flags: 0, variant: 0, message: 0, stackCount: 1 }));
    applyEnchantments(it, [enchantmentSettings(type, param)], { owner: me });   // the item maker's SetEnchantments
    return it;
  };
  const used = amulet('CastWhenUsed', 31), held = amulet('CastWhenHeld', 41);   // Lightning; Water Walking (each effect's own list)
  const { ENCHANTMENT_TYPES: ET } = await import('../../src/formats/magicDef.js');
  assert.deepEqual([used.enchantments.map((e) => [e.type, e.param]), held.enchantments.map((e) => [e.type, e.param])], [[[ET.CastWhenUsed, 31]], [[ET.CastWhenHeld, 41]]], 'each amulet carries its power');
  me.items = [used, held];
  const readied = [];
  setDefaultEnchantCtx({ spellsByIndex: () => new Map([[31, { name: 'Lightning', rangeType: 2, effects: [] }]]), setReadySpell: (r) => readied.push(r.name) });
  const doors = { quickUse: (n) => { QS.useQuickslot(n === 1 ? 'c1' : 'c2', { entity: me, items: me.items, hooks: { isEnchanted } }); return true; } };
  try {
    assert.equal(QS.hotbarKindOf(used), 'use', 'a power to use: used');
    assert.equal(QS.hotbarKindOf(held), 'wear', 'a power held: worn');
    QS.setHotbarSlot(0, QS.hotbarEntryForItem(used));
    QS.hotbarPress(0, { entity: me, doors, say: () => {} });
    assert.deepEqual(readied, ['Lightning'], 'its spell readied (CastWhenUsed.cs)');
    assert.equal(isEquipped(used), false, 'and the amulet neither put on nor taken off');
    // a slot a save kept from before, as worn
    QS.setHotbarSlot(1, { ...QS.hotbarEntryForItem(used), kind: 'wear' });
    QS.hotbarPress(1, { entity: me, doors, say: () => {} });
    assert.deepEqual(readied, ['Lightning', 'Lightning'], 'the saved slot casts as well');
    assert.equal(isEquipped(used), false);
    QS.setHotbarSlot(2, QS.hotbarEntryForItem(held));
    QS.hotbarPress(2, { entity: me, doors, say: () => {} });
    assert.equal(isEquipped(held), true, 'the Cast When Held amulet is put on, as UI2 has it');
    assert.equal(readied.length, 2);
  } finally { setDefaultEnchantCtx(null); QS.clearQuickslots(); }
});

// ─── #117: a journey's run and jumps, at the real clock ────────────────────────────────────────────────────────────

test('RPT1026-PROGRESS (the movement tallies on a journey): one real second of a journey at x60 - sixty-four frames, each nearly a scaled second with a jump landed - tallies Running 4 and Jumping 1, as a real second on foot does; at x1 the laws are DFU\'s (4 a second, one a jump) (mutants: the run at the scaled clock; every jump a whole use)', async () => {
  const { tickPlayerMinutes } = await import('../../src/systems/worldTick.js');
  const { setTimeScale, resetTimeScale } = await import('../../src/systems/timeScale.js');
  const sinks = () => ({ drainFatigue() {}, restoreFatigue() {}, hurt() {}, heal() {}, drainMagicka() {}, restoreMagicka() {} });
  const second = (scale) => {
    const p = fighter();
    p.skills[SKILLS.Running] = 40; p.skills[SKILLS.Jumping] = 40;
    p.skillUses[SKILLS.Running] = 0; p.skillUses[SKILLS.Jumping] = 0;
    setTimeScale(scale);
    let minutes = 0;
    for (let f = 0; f < 64; f++) {
      const dt = (1 / 64) * scale;   // world.js: the frame's dt times the journey's scale (a 64th of a second: exact in binary)
      tickPlayerMinutes({ entity: p, classicMinutes: minutes, dt, sinks: sinks(), activity: { runningTally: true, jumped: true }, rolls: () => 0.5 });
      minutes += dt / 5;
    }
    return [p.skillUses[SKILLS.Running], p.skillUses[SKILLS.Jumping]];
  };
  try {
    assert.deepEqual(second(1), [4, 64], 'on foot: four Running uses a second, one Jumping use a jump');
    assert.deepEqual(second(60), [4, 1], 'on an x60 journey the same real second trains as walking does - not 240 and 64');
    assert.deepEqual(second(100), [4, 0], 'x100 on the road: a jump in a hundred');
  } finally { resetTimeScale(); }
});

// ─── #288: the Goldsmith's words ────────────────────────────────────────────────────────────────────────────────────

test('RPT1026-PROGRESS (the Goldsmith\'s card, "Silver counts as Gold"): it works - a Goldsmith\'s Silver Ring, as the service\'s record mints it (hand 1), holds a Gold Ring\'s enchantment points in the item maker; its card says so in words that promise no Silver in a Gold recipe (mutants: the old words)', async () => {
  const { SPECIALISATIONS } = await import('../../src/net/professionLaw.js');
  const { mintPiece } = await import('../../src/systems/smithItems.js');
  const { itemEnchantmentPower } = await import('../../src/systems/enchanting.js');
  const { JEWEL_HAND_GOLDSMITH } = await import('../../src/net/recipeLaw.js');
  const goldsmith = Object.values(SPECIALISATIONS).flatMap((r) => [...(r[50] ?? []), ...(r[100] ?? [])]).find((s) => s.id === 'goldsmith');
  assert.equal(goldsmith.text, 'Silver jewelry you make has the enchantment points and worth of Gold.');
  const PROV = '0123456789abcdef';
  const ring = (recipe, hand = null) => mintPiece({ recipe, quality: 0, seed: 1, maker: 'X', hand }, PROV);
  const silver = ring('ring:silver'), gold = ring('ring:gold'), goldsmiths = ring('ring:silver', JEWEL_HAND_GOLDSMITH);
  assert.ok(itemEnchantmentPower(silver) < itemEnchantmentPower(gold), 'a plain Silver Ring holds fewer points than a Gold one');
  assert.equal(itemEnchantmentPower(goldsmiths), itemEnchantmentPower(gold), 'a Goldsmith\'s Silver Ring holds a Gold Ring\'s');
  assert.ok(goldsmiths.value > silver.value, 'and is worth more than a plain Silver Ring');
});
