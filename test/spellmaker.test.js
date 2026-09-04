// S1: THE SPELL MAKER's core - the settings law
// (DaggerfallEffectSettingsEditorWindow), the record builder's
// classic shape, the purchase ladder in DFU's exact order
// (DaggerfallSpellMakerWindow:740-803), and the save round trip that
// a made spell needs (the envelope stored bare SPELLS.STD indexes,
// which a spell with no file index cannot use).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MAX_EFFECTS_PER_SPELL, SPINNER_RANGES, SPELL_ICON_COUNT,
  blankEffectSettings, clampSetting, applyPairRules, stepSetting,
  buildCustomSpell, spellMakerCost, validateSpellPurchase, purchaseSpell,
  seedCustomSpellIndex, _resetCustomIndexForTests,
  NO_SPELLBOOK_ID, SPELLMAKER_NOT_ENOUGH_GOLD_ID, MUST_CHOOSE_NAME_ID, NO_EFFECTS_TEXT,
  SPELLBOOK_TEMPLATE_INDEX,
} from '../src/systems/spellMaker.js';
import { calculateCastCost } from '../src/systems/spellcost.js';
import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(join(ROOT, p), 'utf8');

const player = (gold = 1000, withBook = true) => ({
  name: 'S', health: 10, maxHealth: 10, level: 1, stats: {}, skills: [50], skillUses: [],
  goldPieces: gold,   // E4: PlayerEntity.GoldPieces
  items: [...(withBook ? [{ group: 'MiscItems', templateIndex: SPELLBOOK_TEMPLATE_INDEX }] : [])],
  spells: [],
});
// Damage Health (4,0) - magnitude only; Paralyze (0,255) - duration + chance
const DAMAGE_HEALTH = { type: 4, subType: 0 };
const PARALYZE = { type: 0, subType: 255 };

test('S1 settings: every spinner starts at 1 and clamps to the editor ranges', () => {
  const s = blankEffectSettings();
  assert.equal(Object.keys(s).length, 11);
  assert.ok(Object.values(s).every((v) => v === 1), 'the editor opens every spinner at its minimum');
  assert.deepEqual(SPINNER_RANGES.durationBase, [1, 60]);
  assert.deepEqual(SPINNER_RANGES.chanceBase, [1, 100]);
  assert.deepEqual(SPINNER_RANGES.magnitudePerLevel, [1, 20]);
  assert.equal(clampSetting('durationBase', 999), 60);
  assert.equal(clampSetting('durationBase', 0), 1, 'zero clamps UP - there is no 0 setting');
  assert.equal(clampSetting('chancePerLevel', 21), 20);
  assert.equal(clampSetting('nonsense', 999), 999, 'an unknown field is left alone');
});

test('S1 settings: the magnitude pair rule drags its partner, per pair, both directions', () => {
  let s = { ...blankEffectSettings(), magnitudeBaseLow: 1, magnitudeBaseHigh: 10 };
  s = applyPairRules({ ...s, magnitudeBaseLow: 40 }, 'magnitudeBaseLow');
  assert.equal(s.magnitudeBaseHigh, 40, 'raising the min drags the max up');
  s = applyPairRules({ ...s, magnitudeBaseHigh: 5 }, 'magnitudeBaseHigh');
  assert.equal(s.magnitudeBaseLow, 5, 'lowering the max drags the min down');
  // the PLUS pair is independent of the BASE pair
  let t = { ...blankEffectSettings(), magnitudeLevelBase: 1, magnitudeLevelHigh: 3 };
  t = applyPairRules({ ...t, magnitudeLevelBase: 9 }, 'magnitudeLevelBase');
  assert.equal(t.magnitudeLevelHigh, 9);
  assert.equal(t.magnitudeBaseHigh, 1, 'the base pair never moved');
  // one step at a time, clamped, then the pair rule
  const u = stepSetting({ ...blankEffectSettings(), magnitudeBaseLow: 100, magnitudeBaseHigh: 100 }, 'magnitudeBaseHigh', -1);
  assert.equal(u.magnitudeBaseHigh, 99);
  assert.equal(u.magnitudeBaseLow, 99, 'the step drags too');
  assert.equal(stepSetting(blankEffectSettings(), 'durationBase', -5).durationBase, 1, 'stepping below the floor clamps');
});

test('S1 record: a made spell IS a classic record - three slots, the -1 sentinel, the icon modulo', () => {
  _resetCustomIndexForTests();
  const sp = buildCustomSpell({
    slots: [{ ...DAMAGE_HEALTH, settings: { ...blankEffectSettings(), magnitudeBaseLow: 5, magnitudeBaseHigh: 9 } }],
    rangeType: 2, element: 0, name: 'Fireball', icon: 70,
  });
  assert.equal(sp.effects.length, MAX_EFFECTS_PER_SPELL);
  assert.equal(sp.effects[0].type, 4);
  assert.equal(sp.effects[0].magnitudeBaseHigh, 9);
  assert.equal(sp.effects[1].type, -1, 'unused slots carry the file sentinel every consumer skips');
  assert.equal(sp.effects[2].type, -1);
  assert.equal(sp.rangeType, 2);
  assert.equal(sp.element, 0);
  assert.equal(sp.name, 'Fireball');
  assert.equal(sp.icon, 70 % SPELL_ICON_COUNT, 'SetIcon takes index % 69');
  assert.equal(sp.custom, true);
  assert.ok(sp.index < 0, 'a made spell takes a NEGATIVE index - no SPELLS.STD collision');
  // indexes are unique per mint, and gaps/nulls in the slot list compact
  const sp2 = buildCustomSpell({ slots: [null, PARALYZE, undefined, DAMAGE_HEALTH] });
  assert.notEqual(sp2.index, sp.index);
  assert.equal(sp2.effects[0].type, 0, 'the gap compacted - Paralyze took slot 0');
  assert.equal(sp2.effects[1].type, 4);
  assert.equal(sp2.effects[2].type, -1);
  // never more than three, whatever is offered
  const sp3 = buildCustomSpell({ slots: [DAMAGE_HEALTH, PARALYZE, DAMAGE_HEALTH, PARALYZE] });
  assert.equal(sp3.effects.filter((e) => e.type >= 0).length, 3);
});

test('S1 cost: a made spell prices through the ONE cost home, target multiplier and all', () => {
  const e = player();
  const settings = { ...blankEffectSettings(), magnitudeBaseLow: 10, magnitudeBaseHigh: 10 };
  const near = buildCustomSpell({ slots: [{ ...DAMAGE_HEALTH, settings }], rangeType: 0 });
  const far = buildCustomSpell({ slots: [{ ...DAMAGE_HEALTH, settings }], rangeType: 4 });
  const cNear = spellMakerCost(near, e), cFar = spellMakerCost(far, e);
  assert.deepEqual(cNear, calculateCastCost(near, e), 'the maker adds no second formula');
  assert.ok(cNear.gold > 0 && cNear.sp >= 5, 'the 5-point floor holds');
  // AreaAtRange is x2.5 against CasterOnly x1.0 (ApplyTargetCostMultiplier)
  assert.equal(cFar.gold, Math.trunc(cNear.gold * 2.5));
  // more magnitude costs more
  const big = buildCustomSpell({ slots: [{ ...DAMAGE_HEALTH, settings: { ...settings, magnitudeBaseLow: 90, magnitudeBaseHigh: 90 } }] });
  assert.ok(spellMakerCost(big, e).gold > cNear.gold);
  // two effects cost more than one
  const two = buildCustomSpell({ slots: [{ ...DAMAGE_HEALTH, settings }, PARALYZE] });
  assert.ok(spellMakerCost(two, e).gold > cNear.gold);
});

test('S1 purchase: the refusal ladder in DFU ORDER - book, effects, gold, then the name LAST', () => {
  const slots = [{ ...DAMAGE_HEALTH, settings: blankEffectSettings() }];
  // no spellbook wins over everything else being wrong too
  assert.deepEqual(
    validateSpellPurchase({ entity: player(0, false), slots: [], goldCost: 999, name: '' }),
    { ok: false, textId: NO_SPELLBOOK_ID });
  // then effects - still ahead of the gold and name failures
  assert.deepEqual(
    validateSpellPurchase({ entity: player(0), slots: [], goldCost: 999, name: '' }),
    { ok: false, text: NO_EFFECTS_TEXT });
  // then gold - ahead of the missing name
  assert.deepEqual(
    validateSpellPurchase({ entity: player(10), slots, goldCost: 999, name: '' }),
    { ok: false, textId: SPELLMAKER_NOT_ENOUGH_GOLD_ID });
  // the name is checked LAST on purpose ("only bother the player if
  // everything else is correct")
  assert.deepEqual(
    validateSpellPurchase({ entity: player(1000), slots, goldCost: 100, name: '   ' }),
    { ok: false, textId: MUST_CHOOSE_NAME_ID }, 'whitespace is not a name');
  assert.deepEqual(validateSpellPurchase({ entity: player(1000), slots, goldCost: 100, name: 'Zap' }), { ok: true });
  // exact gold affords it (the test is <, not <=)
  assert.equal(validateSpellPurchase({ entity: player(100), slots, goldCost: 100, name: 'Zap' }).ok, true);
});

test('S1 purchase: buying deducts the gold and inscribes into the book', () => {
  const e = player(500);
  const sp = buildCustomSpell({ slots: [DAMAGE_HEALTH], name: 'Zap' });
  purchaseSpell(e, sp, 120);
  assert.equal(e.goldPieces, 380);   // E4: DeductGoldAmount on the counter
  assert.equal(e.spells.length, 1);
  assert.equal(e.spells[0], sp, 'AddSpell is a plain push - the record itself lands in the book');
});

test('S1 save: a made spell survives the round trip; stock spells still travel as indexes', () => {
  _resetCustomIndexForTests();
  const e = player();
  const stock = { index: 7, name: 'Stock', effects: [], element: 0, rangeType: 0 };
  const made = buildCustomSpell({ slots: [{ ...DAMAGE_HEALTH, settings: { ...blankEffectSettings(), magnitudeBaseLow: 7 } }], name: 'Mine', rangeType: 2 });
  e.spells = [stock, made];
  const snap = JSON.parse(JSON.stringify(snapshotPlayer(e, { classicMinutes: 0 })));
  assert.equal(snap.spells[0], 7, 'a stock spell is still just its file index');
  assert.equal(typeof snap.spells[1], 'object', 'a made spell carries its whole record');
  assert.equal(snap.spells[1].name, 'Mine');
  const back = { ...player() };
  restorePlayer(back, snap, new Map([[7, stock]]));
  assert.equal(back.spells.length, 2);
  assert.equal(back.spells[0], stock, 'the stock spell resolved against SPELLS.STD');
  assert.equal(back.spells[1].name, 'Mine');
  assert.equal(back.spells[1].custom, true);
  assert.equal(back.spells[1].effects[0].magnitudeBaseLow, 7, 'every setting came back');
  assert.equal(back.spells[1].rangeType, 2);
  // a spell made AFTER the load cannot collide with the restored one
  const next = buildCustomSpell({ slots: [DAMAGE_HEALTH] });
  assert.notEqual(next.index, back.spells[1].index);
  assert.ok(next.index < back.spells[1].index, 'the mint re-seeded below what the save carried');
});

test('S1 save: a pre-S1 envelope (bare indexes) still loads, and a table-less host keeps made spells', () => {
  _resetCustomIndexForTests();
  const stock = { index: 3, name: 'Old' };
  // a REAL envelope with the pre-S1 spells shape (bare indexes)
  const pre = JSON.parse(JSON.stringify(snapshotPlayer(player(), { classicMinutes: 0 })));
  pre.spells = [3];
  const e = player();
  restorePlayer(e, pre, new Map([[3, stock]]));
  assert.deepEqual(e.spells, [stock]);
  // no spellsByIndex at all: stock entries drop (as they always did),
  // made ones survive because they carry themselves
  const made = buildCustomSpell({ slots: [DAMAGE_HEALTH], name: 'Mine' });
  const mixed = JSON.parse(JSON.stringify(snapshotPlayer(player(), { classicMinutes: 0 })));
  mixed.spells = [3, JSON.parse(JSON.stringify(made))];
  const e2 = player();
  restorePlayer(e2, mixed, null);
  assert.equal(e2.spells.length, 1);
  assert.equal(e2.spells[0].name, 'Mine');
  // seeding is idempotent and ignores stock indexes
  seedCustomSpellIndex([{ index: 88 }, { index: -5 }]);
  assert.ok(buildCustomSpell({ slots: [DAMAGE_HEALTH] }).index < -5);
});

test('S1 wiring pins: the readied MADE spell restores through the player book', () => {
  // setReadiedByIndex could only ask SPELLS.STD, so a custom spell
  // readied at save time came back unreadied
  assert.match(src('src/scenes/hostMagic.js'),
    /playerEntity\?\.spells \?\? \[\]\)\.find\(\(sp\) => sp\?\.index === index\)/,
    'the player book answers for indexes the file table cannot');
  assert.match(src('src/systems/save.js'), /sp\?\.custom \? JSON\.parse\(JSON\.stringify\(sp\)\) : sp\.index/);
});
