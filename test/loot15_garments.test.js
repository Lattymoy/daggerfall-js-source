// LOOT15 - SIX LEGENDARY GARMENTS (2026-10-07; bible/06-Systems/Loot-II-Arc.md section 7; Mac: "Lets go all in").
//
// The wardrobe's own records, beside the first arc's thirty and in a table of their own (WARDROBE_LEGENDARIES), so the
// thirty - and every pin and seed that reads them: the Sigil Broker's day, the gate's spoils, a town's thanks - stand as
// they were. Each lands on its garments of EITHER cut (the record group `Clothing`, recordFitsGroup), carries the
// wardrobe's lines at the Legendary band, a priced DFU enchantment that is no held spell, where it is found and a POWER
// felt on the road and at court through seams that already ran: the felt temperature's degrees, the cast price by a
// spell's school, the fatigue drain and a fall, DRESS1's standing, and the hood's Stealth.
//
// Pinned by execution: the records' law; a door's roll; every power through its own reader, once however many pieces
// carry it, never another's, off nothing; survival Off said; the codex, the imprint (of either cut, a hood power on a
// hooded piece alone) and the wire.

import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setPref, _resetForTests } from '../src/systems/uiPrefs.js';
import * as LR from '../src/systems/lootRarity.js';
import '../src/systems/lootPowers.js';   // the kit registers its folds and seams at import
import { wardrobeFold, spellOfSchool } from '../src/systems/lootPowers.js';
import { GROUP_TEMPLATE_INDICES } from '../src/systems/itemTemplatesData.js';
import { mintCondition } from '../src/systems/itemTemplates.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { equipItem, equipTableOf } from '../src/systems/equip.js';
import { computeEntityMods } from '../src/systems/entityMods.js';
import { enchantmentCost } from '../src/systems/enchantmentCatalogue.js';
import { ENCHANTMENT_TYPES } from '../src/formats/magicDef.js';
import { ARTIFACT_SUB_TYPE_NAMES, validLootItem } from '../src/systems/loot.js';
import { dressStanding, DRESS_GROUP, GEAR_STANDING_CAP } from '../src/systems/clothingStanding.js';
import { feltTemperature, wardrobeCtx, hoodUp } from '../src/systems/survival/temperature.js';
import { survivalMinute, survivalOf } from '../src/systems/survival/needs.js';
import { calculateCastCost } from '../src/systems/spellcost.js';
import { skillValue, SKILLS } from '../src/systems/skills.js';
import { fatigueLossMultiplierFor, applyFallLanding, WARDROBE_FALL_MOST, WARDROBE_FATIGUE_MOST } from '../src/scenes/shared.js';
import { FALL_DAMAGE_THRESHOLD, FALL_HP_PER_METRE } from '../src/player/motor.js';
import { CLIMATES } from '../src/formats/mapsFile.js';
import { codexRows, imprintChoices, FAMILY_HINT, noteFind, _resetCodexForTests } from '../src/systems/lootCodex.js';

const on = () => { _resetForTests(); setPref('lootRarity', true); };
const off = () => { _resetForTests(); setPref('lootRarity', false); };
const lcg = (seed) => () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >>> 8) / 0x800000; };
const garment = (templateIndex, extra = {}) => ({
  ...mintCondition({ group: templateIndex >= 182 ? 'WomensClothing' : 'MensClothing', templateIndex, name: 'garment', flags: 0, variant: 0 }), ...extra,
});
const player = () => ({ isPlayer: true, items: [], stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 }, skills: new Array(35).fill(30), level: 5, career: {}, activeEffects: [], reactionMods: [0, 0, 0, 0, 0], health: 100, maxHealth: 100, magicka: 100, maxMagicka: 100 });
const wear = (e, ...pieces) => { for (const p of pieces) { e.items.push(p); equipItem(e, p); } computeEntityMods(e); return e; };
const recOf = (id) => LR.WARDROBE_LEGENDARIES.find((r) => r.id === id);
const legendary = (id, templateIndex = null) => LR.applyRarity(garment(templateIndex ?? recOf(id).templates[0]), 'legendary', () => 0, [recOf(id)]);
const CLOTHING = new Set([...GROUP_TEMPLATE_INDICES.MensClothing, ...GROUP_TEMPLATE_INDICES.WomensClothing]);
const POOL = new Set(['standing', 'warmth', 'dry', 'skill', 'stat']);

test('LOOT15: six garments, a table beside the thirty - each on its garments of either cut, the wardrobe\'s lines at the Legendary band, a priced enchantment that is no held spell, found among a family, a power, its lore; never an artifact\'s name', () => {
  on();
  assert.equal(LR.LEGENDARIES.length, 30, 'the thirty stand as they were');
  assert.equal(LR.WARDROBE_LEGENDARIES.length, 6);
  assert.deepEqual(LR.allLegendaries().slice(30, 36).map((r) => r.id), LR.WARDROBE_LEGENDARIES.map((r) => r.id), 'after the thirty, before a mod\'s');
  const names = LR.WARDROBE_LEGENDARIES.map((r) => r.name);
  assert.equal(new Set(names).size, 6);
  assert.equal(new Set(LR.WARDROBE_LEGENDARIES.map((r) => r.id)).size, 6);
  const all = LR.allLegendaries().map((r) => r.name);
  assert.equal(new Set(all).size, all.length, 'no name another record\'s');
  for (const n of names) assert.ok(!Object.values(ARTIFACT_SUB_TYPE_NAMES).includes(n), `${n} is no artifact`);
  const T = ENCHANTMENT_TYPES;
  const typeKey = (t) => Object.keys(T).find((k) => T[k] === t);
  const families = new Set();
  for (const rec of LR.WARDROBE_LEGENDARIES) {
    assert.equal(rec.group, LR.GARMENT_RECORD_GROUP);
    assert.ok(rec.templates.length && rec.templates.every((t) => CLOTHING.has(t)), `${rec.id}: garments`);
    assert.ok(rec.templates.some((t) => t < 182) && rec.templates.some((t) => t >= 182), `${rec.id}: of either cut`);
    for (const t of rec.templates) assert.ok(LR.legendariesFor(garment(t)).includes(rec), `${rec.id} lands on template ${t}`);
    assert.ok(rec.affixes.length >= 3, `${rec.id}: three lines or more`);
    for (const a of rec.affixes) {
      assert.ok(POOL.has(a.id), `${rec.id}: ${a.id} is the wardrobe's`);
      assert.ok(LR.validAffix(a));
      const [lo, hi] = LR.AFFIX_RANGES[a.id].legendary;
      assert.ok(a.value >= lo && a.value <= hi, `${rec.id}: ${a.id} ${a.value} at the Legendary band`);
      if (a.id === 'stat') assert.equal(a.param, 'personality');
    }
    const key = typeKey(rec.enchantment.type);
    assert.ok(enchantmentCost(key, rec.enchantment.param) > 0, `${rec.id}: ${key} priced`);
    assert.ok(![T.CastWhenHeld, T.FeatherWeight, T.ExtraWeight, T.IncreasedWeightAllowance].includes(rec.enchantment.type), `${rec.id}: no held spell, no item-maker payload, no capacity`);
    assert.ok(LR.FAMILY_IDS.includes(rec.found) && LR.foundAmong(rec.id) === rec.found, `${rec.id}: found among a family`);
    families.add(rec.found);
    const p = LR.powerOf(rec.id);
    assert.ok(p?.name && p.text && p.kind, `${rec.id}: a power`);
    assert.ok(p.brief.length <= 32, `${rec.id}: its brief inside CARD-FIT's 32 (${p.brief.length})`);
    assert.ok(rec.lore.length > 20);
  }
  assert.equal(families.size, 6, 'six families, one a garment');
  // a door's roll: a Legendary on a garment is a record of its own; a garment no record names is a Rare
  const robe = LR.applyRarity(garment(200), 'legendary', lcg(4), null, { family: 'beast' });
  assert.equal(robe.legendary, 'alikr-robes', 'the Plain Robes\' record, either cut');
  assert.equal(robe.name, "The Alik'r Wayfarer's Robes");
  assert.equal(robe.enchantments.length, 1);
  const pants = LR.applyRarity(garment(151), 'legendary', lcg(4));
  assert.equal(pants.rarity, 'rare', 'Casual Pants carry no record: the tier below');
  // the thirty never land on a garment, and a garment's record never on a weapon
  for (const t of CLOTHING) assert.ok(LR.legendariesFor(garment(t)).every((r) => r.group === LR.GARMENT_RECORD_GROUP));
  assert.ok(LR.legendariesFor(createWeapon(120, 1)).every((r) => r.group === 'Weapons'));
});

// a twin of a record's piece: the very lines, no record - so a reading's difference is the power's alone
const twin = (id) => ({ ...legendary(id), legendary: null });

test('LOOT15: the powers through their own readers - the degrees in the felt temperature, the standing, the hood\'s Stealth, the fatigue and the fall; once however many carry one; never another\'s; off nothing', () => {
  on();
  const felt = (env, e, ctx = {}) => feltTemperature(env, e.equip.slots, { ...ctx, ...wardrobeCtx(ctx, e._mods) }).felt;
  // PIN MOVED (AUDIT LOOT II A2, Loot-II-Arc.md section 15): the degrees come off the felt number itself, toward
  // comfortable and never past it, on their own side alone - laid on the fire resistance, the robes' twenty resisted
  // the outfit's own warmth too, and a cold night was colder in them
  // Desert-Born: the heat felt twenty less
  const desert = { climateIndex: CLIMATES.Desert, month: 6, hour: 13, weather: 'sunny', insideBuilding: false, inSunlight: true };
  const robed = wear(player(), legendary('alikr-robes'));
  const robedTwin = wear(player(), twin('alikr-robes'));
  assert.deepEqual([robed._mods.heatDegrees, robed._mods.coldDegrees, robedTwin._mods.heatDegrees], [20, 0, 0]);
  assert.ok(felt(desert, robedTwin) > 30, `the desert at noon is hot (${felt(desert, robedTwin)})`);
  assert.equal(felt(desert, robed), felt(desert, robedTwin) - 20, 'twenty degrees less - the twenty it says');
  assert.equal(felt(desert, robed, { fireResist: 15 }), felt(desert, robedTwin, { fireResist: 15 }) - 20, 'beside a spell\'s, never on it');
  // ...and the minute of the needs lays them so (survival/needs.js survivalMinute)
  const QUIET = { drainFatigue() {}, restoreFatigue() {}, hurt() {}, say() {} };
  const minuteFelt = (who, ctx) => { survivalOf(who, 3000).wet = 0; return survivalMinute(who, 3001, desert, { worn: equipTableOf(who), ctx, sinks: QUIET }).felt; };
  assert.equal(minuteFelt(robed, { fireResist: 10 }), minuteFelt(robedTwin, { fireResist: 10 }) - 20, 'the minute: the robes\' twenty beside a spell\'s ten');
  // Mountain-Born: the cold felt twenty less
  const pass = { climateIndex: CLIMATES.Mountain, month: 0, hour: 2, weather: 'snow', insideBuilding: false };
  const mantled = wear(player(), legendary('wrothgar-mantle'));
  const mantleTwin = wear(player(), twin('wrothgar-mantle'));
  assert.deepEqual([mantled._mods.coldDegrees, mantled._mods.heatDegrees], [20, 0]);
  assert.ok(felt(pass, mantleTwin) < -20, `a mountain pass at night is cold (${felt(pass, mantleTwin)})`);
  assert.equal(felt(pass, mantled) - felt(pass, mantleTwin), 20);
  assert.equal(felt(pass, mantled, { frostResist: 10 }), felt(pass, mantleTwin, { frostResist: 10 }) + 20, 'beside a spell\'s');
  // each on its own side alone: the robes on the pass, the mantle in the desert, nothing
  assert.equal(felt(pass, wear(player(), legendary('alikr-robes'))), felt(pass, wear(player(), twin('alikr-robes'))), 'the robes never chill a cold night');
  assert.equal(felt(desert, mantled), felt(desert, mantleTwin), 'the mantle never cools the noon');
  // and never past comfortable: a heat under twenty is felt as none
  const mild = { climateIndex: CLIMATES.Desert, month: 3, hour: 10, weather: 'sunny', insideBuilding: false, inSunlight: true };
  if (felt(mild, robedTwin) > 0 && felt(mild, robedTwin) < 20) assert.equal(felt(mild, robed), 0);
  // Royal Bearing: five with every group, laid with the silks' own nobility line under the gear's cap
  const court = wear(player(), legendary('barenziah-silks'));
  const silksTwin = wear(player(), twin('barenziah-silks'));
  assert.equal(court._mods.standing[DRESS_GROUP.Nobility], 5 + 8, 'the bearing and the silks\' own line');
  const dc = dressStanding(court).groups, dt = dressStanding(silksTwin).groups;
  for (const g of [DRESS_GROUP.Commoners, DRESS_GROUP.Merchants, DRESS_GROUP.Scholars, DRESS_GROUP.Underworld]) {
    assert.equal(dc[g] - dt[g], 5, `group ${g}: five`);
  }
  assert.equal(dc[DRESS_GROUP.Nobility] - dt[DRESS_GROUP.Nobility], GEAR_STANDING_CAP - 8, 'the nobility: to the gear\'s cap');
  // Unseen: the hood up, twenty-five Stealth; down, none
  const cowl = legendary('shades-cowl');
  cowl.variant = 1;   // the casual cloak's hooded variant (temperature.js HOODED_CLOAK_VARIANTS)
  assert.equal(hoodUp(cowl), true);
  const hooded = wear(player(), cowl);
  assert.equal(skillValue(hooded, SKILLS.Stealth) - 30, 25 + 25, 'the cowl\'s Stealth line and the hood\'s 25');
  cowl.variant = 0;
  computeEntityMods(hooded);
  assert.equal(skillValue(hooded, SKILLS.Stealth) - 30, 25, 'the hood down: its line alone');
  // The Long Road: a quarter slower to tire, a fall half
  const pilgrim = wear(player(), legendary('pilgrims-sandals'));
  const walker = wear(player(), twin('pilgrims-sandals'));
  assert.ok(fatigueLossMultiplierFor(walker) > 0);
  assert.ok(Math.abs(fatigueLossMultiplierFor(pilgrim) - 0.75 * fatigueLossMultiplierFor(walker)) < 1e-9, 'a quarter less of the minute\'s drain');
  const hurt = (e, metres) => { let n = 0; applyFallLanding(e, metres, { hurt: (d) => { n += d; }, sound: () => {} }); return n; };
  const fall = FALL_DAMAGE_THRESHOLD + 6;
  assert.equal(hurt(walker, fall), Math.trunc(FALL_HP_PER_METRE * 6));
  assert.equal(hurt(pilgrim, fall), Math.trunc(FALL_HP_PER_METRE * 6 * 0.5), 'a fall hurts half');
  assert.equal(hurt(pilgrim, FALL_DAMAGE_THRESHOLD), 0, 'and a safe drop stays safe');
  // the caps: a mod's road power never makes a fall free nor a minute tireless, and a negative one adds nothing
  const folded = (m) => ({ ...player(), _mods: { ...m } });
  assert.deepEqual([WARDROBE_FALL_MOST, WARDROBE_FATIGUE_MOST], [75, 50]);
  assert.equal(hurt(folded({ fallLess: 400 }), fall), Math.trunc(FALL_HP_PER_METRE * 6 * 0.25), 'three quarters off a fall at the most');
  assert.equal(hurt(folded({ fallLess: -50 }), fall), Math.trunc(FALL_HP_PER_METRE * 6), 'a negative adds nothing');
  assert.ok(Math.abs(fatigueLossMultiplierFor(folded({ fatigueLess: 400 })) - 0.5 * fatigueLossMultiplierFor(player())) < 1e-9, 'half off the drain at the most');
  assert.equal(fatigueLossMultiplierFor(folded({ fatigueLess: -50 })), fatigueLossMultiplierFor(player()), 'a negative adds nothing');
  // a power counts once: the sandals and a Rare gown imprinted with their power
  const gown = LR.applyRarity(garment(195), 'rare', lcg(2));
  gown.imprint = 'pilgrims-sandals';
  assert.deepEqual([wear(player(), gown)._mods.fallLess, wear(player(), gown)._mods.fatigueLess], [50, 25], 'an imprinted gown carries it');
  const twice = wear(player(), legendary('pilgrims-sandals'), gown);
  assert.deepEqual([twice._mods.fallLess, twice._mods.fatigueLess], [50, 25], 'once');
  // never another's: a peer's copy and a foe fold nothing of the wardrobe's powers
  const peer = wear({ ...player(), peer: true }, legendary('pilgrims-sandals'));
  assert.equal(wardrobeFold(peer).fallLess, 0);
  assert.equal(peer._mods.fallLess, 0, 'a peer\'s copy');
  const foe = wear({ ...player(), isPlayer: false }, legendary('wrothgar-mantle'));
  assert.equal(foe._mods.coldDegrees, 0, 'a foe');
  off();
  computeEntityMods(pilgrim);
  assert.deepEqual([pilgrim._mods.fallLess, pilgrim._mods.fatigueLess], [0, 0], 'off: nothing');
  assert.equal(hurt(pilgrim, fall), Math.trunc(FALL_HP_PER_METRE * 6), 'off: the fall DFU\'s');
});

test('LOOT15: Stendarr\'s Mercy - a Restoration spell costs a quarter less, a spell of any other school or a mixed one not; survival Off said on a climate power\'s line', () => {
  on();
  const fx = (type, subType) => ({ type, subType, durationBase: 1, durationMod: 1, durationPerLevel: 1, chanceBase: 20, chanceMod: 5, chancePerLevel: 1, magnitudeBaseLow: 10, magnitudeBaseHigh: 20, magnitudeLevelBase: 1, magnitudeLevelHigh: 2, magnitudePerLevel: 1 });
  const cure = { rangeType: 0, effects: [fx(3, 0), fx(3, 1)] };        // Cure Disease, Cure Poison - Restoration
  const burn = { rangeType: 0, effects: [fx(4, 0)] };                  // Damage Health - Destruction
  const both = { rangeType: 0, effects: [fx(3, 0), fx(4, 0)] };
  const slotted = { rangeType: 0, effects: [fx(3, 0), { type: -1, subType: -1 }] };   // a record's empty effect slot is no school
  assert.ok(spellOfSchool(cure, SKILLS.Restoration) && !spellOfSchool(burn, SKILLS.Restoration) && !spellOfSchool(both, SKILLS.Restoration));
  assert.ok(!spellOfSchool(null, SKILLS.Restoration) && !spellOfSchool({ effects: [] }, SKILLS.Restoration), 'no spell, no school');
  assert.ok(spellOfSchool(slotted, SKILLS.Restoration), 'an empty slot reads nothing');
  const priest = wear(player(), legendary('stendarr-vestments'));
  const acolyte = wear(player(), twin('stendarr-vestments'));   // the vestments' lines - the same Restoration - no power
  const sp = (spell, e) => calculateCastCost(spell, e).sp;
  assert.ok(sp(cure, acolyte) > 20);
  assert.equal(sp(cure, priest), Math.max(1, Math.round(sp(cure, acolyte) * 0.75)), 'a Restoration spell, a quarter less');
  assert.equal(sp(burn, priest), sp(burn, acolyte), 'a Destruction spell, its own price');
  assert.equal(sp(both, priest), sp(both, acolyte), 'a mixed spell is no Restoration spell');
  assert.equal(calculateCastCost(cure, priest, { portMods: false }).sp, sp(cure, acolyte), 'the ported price unmodded');
  // survival Off: the climate powers' lines say so; the others never
  const robes = legendary('alikr-robes');
  robes.isIdentified = true;
  const line = () => LR.rarityLines(robes).find((l) => l.startsWith('Desert-Born'));
  assert.ok(line() && !line().endsWith(LR.SURVIVAL_OFF_NOTE), line());
  setPref('survival', false);   // SURVIVAL_STORED.off
  assert.ok(line().endsWith(LR.SURVIVAL_OFF_NOTE), 'survival off: the line says so');
  const silks = legendary('barenziah-silks');
  silks.isIdentified = true;
  assert.ok(LR.rarityLines(silks).some((l) => l.startsWith('Royal Bearing') && !l.endsWith(LR.SURVIVAL_OFF_NOTE)), 'DRESS1\'s power never sleeps');
  _resetForTests();
});

test('LOOT15: the codex lists the six by their families\' hints; the imprint offers a Rare garment the wardrobe\'s found powers of either cut (Unseen on a hooded piece alone) and a sword none; the wire takes them so and refuses another', () => {
  on();
  _resetCodexForTests?.();
  const rows = codexRows();
  for (const rec of LR.WARDROBE_LEGENDARIES) {
    const row = rows.find((r) => r.id === rec.id);
    assert.ok(row, `${rec.id} in the codex`);
    assert.equal(row.hint, FAMILY_HINT[rec.found], 'its family\'s hint');
    assert.equal(row.group, 'Clothing');
  }
  for (const id of ['pilgrims-sandals', 'shades-cowl', 'barenziah-silks']) noteFind(legendary(id), { quiet: true });
  const shirt = LR.applyRarity(garment(165), 'rare', lcg(5));
  const gown = LR.applyRarity(garment(195), 'rare', lcg(6));
  const casualCloak = LR.applyRarity(garment(191), 'rare', lcg(7));
  const choice = (it) => imprintChoices(it).map((r) => r.id).sort();
  assert.deepEqual(choice(shirt), ['barenziah-silks', 'pilgrims-sandals'], 'a man\'s shirt: the found garments\' powers - Unseen never, it has no hood');
  assert.deepEqual(choice(gown), ['barenziah-silks', 'pilgrims-sandals'], 'a woman\'s gown, the same - either cut');
  assert.deepEqual(choice(casualCloak), ['barenziah-silks', 'pilgrims-sandals', 'shades-cowl'], 'a hooded cloak takes Unseen');
  const sword = LR.applyRarity(createWeapon(120, 1), 'rare', lcg(8));
  assert.ok(imprintChoices(sword).every((r) => r.group === 'Weapons'), 'a sword is offered no garment');
  // the wire
  const imprinted = { ...gown, imprint: 'pilgrims-sandals' };
  assert.ok(validLootItem(JSON.parse(JSON.stringify(imprinted))), 'a gown imprinted with the sandals\' power');
  assert.equal(validLootItem({ ...shirt, imprint: 'shades-cowl' }), null, 'Unseen on a shirt with no hood');
  assert.equal(validLootItem({ ...sword, imprint: 'pilgrims-sandals' }), null, 'a garment\'s power on a sword');
  assert.equal(validLootItem({ ...gown, imprint: 'wyrmbane' }), null, 'a sword\'s power on a gown');
});
