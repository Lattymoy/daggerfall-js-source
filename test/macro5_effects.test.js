// MACRO-5 (2026-09-22, the macro audit): THE EFFECT IS THE SOURCE.
// DaggerfallSpellBookWindow.ShowEffectPopup (:651-660) hands the effect
// itself to MacroHelper as the box's source, and every description record
// (1202-1305) is built of its eleven settings rows - %bdr %adr %cld, %bch
// %ach %clc, %1bm %2bm %1am %2am %clm. The port walked the popup with the
// book's TRADE source, which answers none of them, so every effect box
// printed "Duration: %bdr + %adr per %cld level(s)".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { classicEffectSettings, effectMacroSource, SPELLBOOK_DESCRIPTION_IDS } from '../src/systems/spellEffects.js';
import { expandRowValues, sourceValues, setMacroWorld } from '../src/systems/quest/questMacros.js';
import { SpellbookWindow } from '../src/ui/spellbookWindow.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const damageHealth = { type: 4, subType: 0,
  durationBase: 0, durationMod: 0, durationPerLevel: 0, chanceBase: 0, chanceMod: 0, chancePerLevel: 0,
  magnitudeBaseLow: 5, magnitudeBaseHigh: 10, magnitudeLevelBase: 2, magnitudeLevelHigh: 4, magnitudePerLevel: 0 };
// TEXT.RSC 1212, the header rows verbatim
const RECORD_1212 = [
  { text: 'Damage -- Health', center: true },
  { text: 'Duration: %bdr + %adr per %cld level(s)', center: true },
  { text: 'Chance: %bch + %ach per %clc level(s)', center: true },
  { text: 'Magnitude: %1bm - %2bm + %1am - %2am', center: true },
  { text: 'per %clm level(s)', center: true },
];

test('MACRO-5: ClassicEffectRecordToEffectSettings - a supported component off the record, divisor floored at 1; the rest DefaultEffectSettings', () => {
  assert.deepEqual(classicEffectSettings(damageHealth), {
    durationBase: 1, durationPlus: 1, durationPerLevel: 1,   // Damage has no duration: the defaults, not the record's zeros
    chanceBase: 1, chancePlus: 1, chancePerLevel: 1,         // nor a chance
    magnitudeBaseMin: 5, magnitudeBaseMax: 10, magnitudePlusMin: 2, magnitudePlusMax: 4,
    magnitudePerLevel: 1,                                    // Math.Max(0, 1)
  });
  // Paralyze: duration and chance, no magnitude; subType -1 (a SPELLS.STD signed byte) is 255
  const para = classicEffectSettings({ type: 0, subType: -1, durationBase: 3, durationMod: 2, durationPerLevel: 4,
    chanceBase: 40, chanceMod: 5, chancePerLevel: 0, magnitudeBaseLow: 9 });
  assert.equal(para.durationBase, 3); assert.equal(para.durationPlus, 2); assert.equal(para.durationPerLevel, 4);
  assert.equal(para.chanceBase, 40); assert.equal(para.chancePlus, 5); assert.equal(para.chancePerLevel, 1);
  assert.equal(para.magnitudeBaseMin, 1, 'Paralyze has no magnitude');
});

test('MACRO-5: the effect’s source answers the whole record - the numbers DFU prints', () => {
  const out = expandRowValues(RECORD_1212, sourceValues(effectMacroSource(damageHealth)));
  assert.deepEqual(out.map((r) => r.text), [
    'Damage -- Health',
    'Duration: 1 + 1 per 1 level(s)',
    'Chance: 1 + 1 per 1 level(s)',
    'Magnitude: 5 - 10 + 2 - 4',
    'per 1 level(s)',
  ]);
  assert.ok(out.every((r) => r.center), 'each row keeps its alignment');
});

test('MACRO-5: sourceValues - a row the source cannot answer falls to the world, and an unknown stays verbatim', () => {
  const values = sourceValues(effectMacroSource(damageHealth));
  setMacroWorld(() => ({ nowSeconds: () => 0, hooks: { playerName: () => 'Aldric Vane' } }));
  try {
    assert.equal(expandRowValues(['%pcn: %1bm to %2bm. %zzz'], values)[0], 'Aldric Vane: 5 to 10. %zzz');
  } finally { setMacroWorld(null); }
  assert.equal(expandRowValues(['%pcn: %bdr'], values)[0], '%pcn: 1', 'no world: the effect still answers its own rows');
  const broken = sourceValues({ durationBase: () => { throw new Error('effect gone'); } });
  assert.equal(expandRowValues(['Duration: %bdr'], broken)[0], 'Duration: %bdr', 'a source that throws costs its token, never the box');
});

test('MACRO-5: every description record the book can open is answered - no token left', () => {
  // the eleven rows are the whole of what these records carry; each key's
  // own effect answers them
  const tokens = ['%bdr', '%adr', '%cld', '%bch', '%ach', '%clc', '%1bm', '%2bm', '%1am', '%2am', '%clm'];
  const text = tokens.join(' ');
  for (const key of SPELLBOOK_DESCRIPTION_IDS.keys()) {
    const [type, subType] = key.split(',').map(Number);
    const out = expandRowValues([text], sourceValues(effectMacroSource({ type, subType })))[0];
    assert.doesNotMatch(out, /%\w/, `${key}: ${out}`);
  }
});

test('MACRO-5: the spellbook’s effect popup walks its record with the EFFECT as the source', () => {
  const spell = { name: 'Bolt', rangeType: 0, element: 4, icon: 1, effects: [damageHealth] };
  const asked = [];
  const win = new SpellbookWindow({
    spells: () => [spell], entity: { magicka: 100, name: 'Aldric Vane' }, castCost: () => 5,
    rows: (id) => { asked.push(id); return id === 1212 ? RECORD_1212 : []; },
  });
  const rows = win._effectDescription(0);
  assert.deepEqual(asked, [1212]);
  assert.equal(rows[1].text, 'Duration: 1 + 1 per 1 level(s)');
  assert.equal(rows[3].text, 'Magnitude: 5 - 10 + 2 - 4');
  assert.match(read('src/ui/spellbookWindow.js'),
    /const rows = expandRowValues\(this\.deps\.rows\?\.\(id\) \?\? \[\], sourceValues\(effectMacroSource\(e\)\)\);/);
});
