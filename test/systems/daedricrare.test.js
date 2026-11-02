// DAEDRIC-RARE (FIELD FEEDBACK 2026-10-31; Sammy, Discord #feature-feedback: "Daedric is way too common, I think it
// should drop but very rarely.") - online Unleveled Loot is the room's, and its AddDaedric was the game's Daedric: a
// Daedra's corpse grants a drop at the mod's own rate, and METAL-RAMP made every granted drop Daedric from level 20 up.
// Now a granted drop that would be Daedric is Daedric on DAEDRIC_KEEP of its draws, at any level, and Ebony on the rest
// (systems/unleveledLoot.js daedricKept) - one draw more on the drop's own stream, after the ramp's. Whether a Daedra
// drops, and the Orcs, stay as they were. bible/06-Systems/Unleveled-Loot.md, Departures.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DAEDRIC_KEEP, METAL_RAMP_FULL, addDaedric, addOrcish, unlevelDroppedLoot, _resetUnleveledLoot, setUnleveledLootWorld, _worldReader } from '../../src/systems/unleveledLoot.js';
import { ENEMY_BASICS } from '../../src/characters/enemy/enemyBasics.js';
import { makeEnemyEntity } from '../../src/characters/enemy/enemyEntity.js';
import { setModSetting, _resetModSettings } from '../../src/systems/modSettings.js';
import { seededRng } from '../../src/systems/wind/wind.js';

const seq = (...vs) => { let i = 0; return () => vs[i++ % vs.length]; };
const counted = (...vs) => { const f = seq(...vs); const g = () => { g.n++; return f(); }; g.n = 0; return g; };
const draw = (n, of) => (n + 0.5) / of;   // Range(0, of) answers n
const saved = _worldReader();
const world = (level) => setUnleveledLootWorld({
  playerEntity: () => ({ level, stats: { luck: 50 }, gender: 'male', raceId: 1 }),
  insideOpenShop: () => false, buildingQuality: () => 0, insideDungeon: () => true, regionIndex: () => 17, locationDungeonType: () => 7,
});
const LORD = 31, SEDUCER = 29, WARLORD = 24;
const career = () => ({ strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50, attackModifierFlags: 0 });
/** A Daedra Lord's granted weapon at `level`: the mod's 100, the ramp's draw under 20, the keep draw, a weapon. */
const lordWeapon = (level, keep) => {
  const loot = [];
  addDaedric(loot, LORD, seq(0.999, ...(level < METAL_RAMP_FULL ? [0] : []), keep, 0.999, 0.5, 0.5), level);
  return loot[0];
};

test('DAEDRIC-RARE the law: a granted drop that would be Daedric keeps it on a draw under DAEDRIC_KEEP, a tenth, and is Ebony on the rest - at 20 and up, and under 20 where the ramp grants it; weapons and plate alike (mutants: the share moved; the comparison turned; the keep unasked; the step-down to Orcish)', () => {
  _resetUnleveledLoot();
  assert.equal(DAEDRIC_KEEP, 0.1);
  for (const level of [1, 10, 20, 45]) {
    assert.equal(lordWeapon(level, 0.0999).material, 9, `level ${level}: under the share, Daedric`);
    assert.equal(lordWeapon(level, 0.1).material, 7, `level ${level}: at the share, Ebony`);
    assert.equal(lordWeapon(level, 0.999).material, 7, `level ${level}: over it, Ebony`);
  }
  const plate = (keep) => { const loot = []; addDaedric(loot, LORD, seq(0.999, keep, 0, 0.5, 0.2, 0.999, 0.999), 30); return loot[0]; };
  assert.deepEqual([plate(0).group, plate(0).material, plate(0.5).material], ['Armor', 0x0209, 0x0207], 'plate of the metal kept');
  const seducer = []; addDaedric(seducer, SEDUCER, seq(0.85, 0.5, 0, 0.5, 0.5), 30);
  assert.deepEqual([seducer[0].group, seducer[0].material], ['Weapons', 7], 'the Seducer\'s weapon, Ebony on the rest');
});

test('DAEDRIC-RARE the draws: one more only where the metal is Daedric - none where the ramp withholds it, none for a refused drop, none for an Orc; an Orc\'s granted drop at 20 and up still Orcish (mutants: the draw taken always; the Orcs stepped down)', () => {
  _resetUnleveledLoot();
  const withheld = counted(0.999, 0.999, 0.999, 0.5, 0.5); const w = []; addDaedric(w, LORD, withheld, 10);
  const granted = counted(0.999, 0, 0, 0.999, 0.5, 0.5); const g = []; addDaedric(g, LORD, granted, 10);
  assert.equal(w[0].material, 5, 'level 10, the ramp withholds: Mithril');
  assert.equal(g[0].material, 9);
  assert.equal(granted.n, withheld.n + 1, 'the keep draw, beside the ramp\'s');
  const refused = counted(0.5); addDaedric([], LORD, refused, 30);
  assert.equal(refused.n, 1, 'a refused drop draws the mod\'s one roll alone');
  for (const level of [20, 45]) {
    const orc = counted(0.999, 0.999, 0.5, 0.5); const o = []; addOrcish(o, WARLORD, orc, level);
    const lord = counted(0.999, 0.999, 0.999, 0.5, 0.5); const l = []; addDaedric(l, LORD, lord, level);
    assert.equal(o[0].material, 8, `level ${level}: an Orc's drop is Orcish, as the mod's`);
    assert.equal(lord.n, orc.n + 1, 'the Daedra\'s keep draw is its one more');
  }
});

test('DAEDRIC-RARE the share, measured on a seeded stream: of 30,000 Daedra Lords at level 30 about three in ten drop (the mod\'s rate, unchanged), and a tenth of the drops are Daedric, the rest Ebony; the step-down goes through the Mods pane\'s Ebony switch (mutants: the share moved; the drop rate moved; the switch ignored)', () => {
  _resetUnleveledLoot(); world(30);
  const rolls = seededRng(0x5eed);
  let drops = 0, daedric = 0, ebony = 0;
  const KILLS = 30000;
  for (let i = 0; i < KILLS; i++) {
    const lord = makeEnemyEntity(LORD, ENEMY_BASICS[LORD], career(), 30, () => 0.5); lord.items = [];
    unlevelDroppedLoot(lord, { rolls, luck: 50, level: 30 });   // Luck 50: the mod's own over-70, three in ten
    if (!lord.items.length) continue;
    drops++;
    const m = lord.items[0].group === 'Armor' ? lord.items[0].material - 0x0200 : lord.items[0].material;
    if (m === 9) daedric++; else if (m === 7) ebony++;
  }
  assert.equal(daedric + ebony, drops, 'Daedric or Ebony, nothing else');
  assert.ok(drops / KILLS > 0.28 && drops / KILLS < 0.31, `the mod's rate: ${drops} of ${KILLS}`);
  assert.ok(daedric / drops > 0.085 && daedric / drops < 0.115, `a tenth Daedric: ${daedric} of ${drops}`);
  _resetUnleveledLoot();
  try {
    setModSetting('unleveledLoot', 'Ebony', 6);
    assert.equal(lordWeapon(30, 0.5).material, 6, 'the Mods pane\'s Ebony switched to Adamantium: the step-down is Adamantium');
  } finally { _resetModSettings(); setUnleveledLootWorld(saved); _resetUnleveledLoot(); }
});
