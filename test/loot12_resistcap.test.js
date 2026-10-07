// LOOT12 - HONEST RESISTANCE (2026-10-07; bible/06-Systems/Loot-II-Arc.md section 4; Mac: "We also have a great solid
// loot foundation, but what could we do to make it even more amazing, while also balancing everyrhing?", then "Lets go
// all in").
//
// A rolled resistance line adds its points to the saving throw's 50, and 100 there is immunity before Willpower is read
// (spellcast.js savingThrow, FormulaHelper.SavingThrow's own law). Measured through the real fold and the real throw, two
// Rares of one element at +25 turned every cast of it away whole - the line said "+25%". The ladder's ROLLED lines now
// count together to RESIST_CAP (45) an element; an Aetheric piece's lines and a spell's resistance are their own.
//
// Pinned by execution: the fold over real equipped pieces (two Rares, a third, another element, an Aetheric piece, off),
// every Legendary record's own line whole on its own and an Exalted's held, and the saving throw itself over thousands
// of seeded casts - never immune by rolled gear alone, a spell's resistance untouched.

import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setPref, _resetForTests } from '../src/systems/uiPrefs.js';
import * as LR from '../src/systems/lootRarity.js';
import { AETHERIC_RECORDS, mintAetheric } from '../src/systems/aetheric.js';
import { mintCondition } from '../src/systems/itemTemplates.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { equipItem } from '../src/systems/equip.js';
import { computeEntityMods, entityResistMod } from '../src/systems/entityMods.js';
import { savingThrow, ELEMENTS, EFFECT_FLAGS } from '../src/systems/spellcast.js';

const on = () => { _resetForTests(); setPref('lootRarity', true); };
const off = () => { _resetForTests(); setPref('lootRarity', false); };
const lcg = (seed) => () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >>> 8) / 0x800000; };
const entityOf = () => ({ isPlayer: true, items: [], stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 }, skills: new Array(35).fill(30), level: 5, career: {}, activeEffects: [] });
const jewel = (templateIndex, rarity, affixes) => ({ ...mintCondition({ group: 'Jewellery', templateIndex, name: 'Jewel', flags: 0 }), rarity, affixes });
const wear = (e, ...pieces) => { for (const p of pieces) { e.items.push(p); equipItem(e, p); } return e; };
const fire = (value) => ({ id: 'resist', param: 'fire', value });

test('LOOT12: the rolled lines count to 45 an element - two Rares at +25 are 45 and not 50, a third adds nothing, another element is its own, an Aetheric piece rides whole and the rolled fill to the cap beside it (AUDIT LOOT II A8), off is nothing', () => {
  on();
  try {
    assert.equal(LR.RESIST_CAP, 45);
    const e = wear(entityOf(), jewel(135, 'rare', [fire(25)]), jewel(135, 'rare', [fire(25)]));
    assert.equal(entityResistMod(e, ['fire']), 45, 'two Rares at +25: 45, never the 50 that made a body immune');
    assert.deepEqual(LR.rolledResistOf(e, 'fire'), { worn: 50, counts: 45 }, 'the card can say what is worn and what counts');
    wear(e, jewel(133, 'magic', [fire(15), { id: 'resist', param: 'frost', value: 20 }]));
    assert.equal(entityResistMod(e, ['fire']), 45, 'a third piece adds nothing past the cap');
    assert.deepEqual(LR.rolledResistOf(e, 'fire'), { worn: 65, counts: 45 });
    assert.equal(entityResistMod(e, ['frost']), 20, 'another element counts on its own');
    assert.equal(entityResistMod(e, ['fire', 'frost']), 65, 'a spell of both elements meets both, each held to its own cap');
    // an Aetheric piece is its own design (the Regalia's fire, +10 a piece - its set's tier takes a whole set past immunity)
    const crown = AETHERIC_RECORDS.find((r) => r.affixes?.some((a) => a.id === 'resist' && a.param === 'fire'));
    assert.ok(crown, 'an Aetheric record with the gate\'s fire');
    const piece = mintAetheric(crown);
    assert.equal(piece.rarity, 'aetheric');
    wear(e, piece);
    const line = crown.affixes.find((a) => a.id === 'resist' && a.param === 'fire').value;
    // PIN MOVED (AUDIT LOOT II A8): the Aetheric line rides whole and the rolled ones fill to the cap BESIDE it - the cap
    // is the gear's whole (45 + its line made the Oathkeeper's Helm and a Rare ring a body immune to Magic)
    assert.equal(entityResistMod(e, ['fire']), 45, 'the Aetheric line whole, the rolled ones to the cap beside it');
    assert.deepEqual(LR.rolledResistOf(e, 'fire'), { worn: 65, counts: 45 - line }, 'and is never counted as a rolled line');
    off();
    computeEntityMods(e);
    assert.equal(entityResistMod(e, ['fire']), 0, 'off: the fold folds nothing');
    assert.deepEqual(LR.rolledResistOf(e, 'fire'), { worn: 0, counts: 0 });
  } finally { on(); }
});

test('LOOT12: every Legendary record\'s own resistance line is whole on its own; an Exalted line at the band\'s top is held to the cap', () => {
  on();
  let seen = 0;
  for (const rec of LR.LEGENDARIES) {
    const lines = rec.affixes.filter((a) => a.id === 'resist');
    if (!lines.length) continue;
    const t = rec.templates?.[0] ?? (rec.group === 'Weapons' ? 120 : rec.group === 'Armor' ? 102 : 133);
    const base = rec.group === 'Weapons' ? createWeapon(t, 1)
      : mintCondition({ group: rec.group, templateIndex: t, material: rec.group === 'Armor' ? 0x0200 + 1 : 0, name: rec.name, flags: 0 });
    const it = LR.applyRarity(base, 'legendary', () => 0, [rec]);
    assert.equal(it.legendary, rec.id);
    const e = wear(entityOf(), it);
    for (const a of lines) {
      assert.ok(a.value <= LR.RESIST_CAP, `${rec.id}: its own ${a.param} line (${a.value}) is inside the cap`);
      assert.equal(entityResistMod(e, [a.param]), a.value, `${rec.id}: its ${a.param} line whole`);
      seen++;
    }
  }
  assert.ok(seen >= 8, `every record with a resistance line read (${seen})`);
  // an Exalted Legendary's extra line is the top half of the Legendary band (35-50): at 50 alone it is held to 45
  const ex = jewel(133, 'legendary', [{ id: 'stat', param: 'willpower', value: 12 }, fire(50)]);
  ex.exalted = true;
  assert.equal(entityResistMod(wear(entityOf(), ex), ['fire']), 45);
});

test('LOOT12: through the real saving throw - two Rares at +25 no longer turn every cast away (three in four whole, the rest land), and a spell\'s own resistance is untouched', () => {
  on();
  const e = wear(entityOf(), jewel(135, 'rare', [fire(25)]), jewel(135, 'rare', [fire(25)]));
  const rolls = lcg(12);
  const N = 4000;
  let whole = 0, landed = 0, sum = 0;
  for (let i = 0; i < N; i++) {
    const p = savingThrow(ELEMENTS.Fire, EFFECT_FLAGS.Fire, e, 0, rolls);
    if (p === 0) whole++; else landed++;
    sum += p;
  }
  assert.ok(landed > 0, 'never immune by rolled gear alone - some casts land');
  assert.ok(whole / N > 0.7 && whole / N < 0.8, `three in four turned whole (${(whole / N).toFixed(3)})`);
  assert.ok(sum / N > 5 && sum / N < 25, `the mean that lands is small (${(sum / N).toFixed(1)}%)`);
  // the body's own stays the body's: a spell's Elemental Resistance at 100 turns every cast whatever the gear
  e.activeEffects = [{ kind: 'elementalResistance', element: ELEMENTS.Fire, chance: 100 }];
  for (let i = 0; i < 200; i++) assert.equal(savingThrow(ELEMENTS.Fire, EFFECT_FLAGS.Fire, e, 0, rolls), 0);
  // and a bare body is the base 50: about a third whole
  const bare = entityOf();
  computeEntityMods(bare);
  let bareWhole = 0;
  for (let i = 0; i < N; i++) if (savingThrow(ELEMENTS.Fire, EFFECT_FLAGS.Fire, bare, 0, rolls) === 0) bareWhole++;
  assert.ok(bareWhole / N > 0.3 && bareWhole / N < 0.4, `a bare body's third (${(bareWhole / N).toFixed(3)})`);
});
