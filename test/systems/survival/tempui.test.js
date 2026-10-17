import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  naturalTemperature, naturalParts, hourTemperature, hourBand, feltTemperature, temperatureWord, temperatureBreakdown, signedDegrees,
  CLIMATE_TEMP, MONTH_TEMP, WEATHER_TEMP, CLIMATE_NAMES, WEATHER_NAMES, HOUR_NAMES, NAKED_OFFSET, WATER_COOLS, FLAG_FROST, FLAG_FIRE, wardrobeCtx,
} from '../../../src/systems/survival/temperature.js';
import { newSurvival, survivalMinute, feltCtx, survivalOf } from '../../../src/systems/survival/needs.js';
import { dungeonTemperature, resistTemperature } from '../../../src/systems/survival/temperature.js';
import { survivalFeed, feltNow, feltBreakdownNow, lastSurvivalFeed } from '../../../src/systems/survival/env.js';
import { HUD_NEED_WORDS, STATUS_TEXT, TEMP_SCALE, survivalHudChips, survivalStatusLines, temperatureReadout } from '../../../src/systems/survival/status.js';
import { SURVIVAL_PREF } from '../../../src/systems/survival/switch.js';
import { STATUS_GLYPHS, statusGlyphSvg, statusGlyphSrc } from '../../../src/ui/hud/hudStatus.js';
import { COMFORT, discomfort, packTemperature, breakdownLines, temperaturePlaque, temperatureWear, temperatureCompareBlock, temperatureStatRows } from '../../../src/ui/temperatureCard.js';
import { wearComparison } from '../../../src/ui/armourCard.js';
import { FRAME_ROLES } from '../../../src/ui/enhanced/enhancedFrame.js';
import { FEATURES, FEATURE_PREF_DEFAULTS } from '../../../src/systems/features.js';
import { onlineForcedPref } from '../../../src/systems/online/onlineLane.js';
import { setPref, _resetForTests } from '../../../src/systems/uiPrefs.js';
import { createEquipTable } from '../../../src/characters/equipTable.js';
import { equipItem } from '../../../src/systems/equip.js';
import { mintCondition } from '../../../src/systems/item/itemTemplates.js';
import { createSurvivalItem } from '../../../src/systems/survival/items.js';
import { TEMPLATE } from '../../../src/systems/survival/food.js';
import { monthNames } from '../../../src/systems/gameDate.js';   // L10N3e: the month names, read in the player's language
import { CLIMATES } from '../../../src/formats/mapsFile.js';
import { RACES, raceById } from '../../../src/systems/races.js';
import { EQUIP_SLOTS } from '../../../src/characters/paperdoll/paperdoll.js';
import { withDom } from '../../invdrag.mjs';

// ═══ TEMP-UI (2026-10-12): THE TEMPERATURE, SHOWN ═══════════════════════
//
// The owner: "We also need to add a tempurature widget to the UI including allowing players to see their personal
// tempurature in their inventory." These pins hold: the breakdown ADDS UP to the felt temperature (the natural
// temperature's parts to naturalTemperature, the hour's band to hourTemperature, every row to `felt`); the pack's live
// reading IS the minute law's (one construction seam); the HUD plate wears the strip's own level; the status page says
// the number in plain characters; and the plate, the plaque, the card's comparison and the Stats side's rows, driven.

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const STATS = Object.freeze({ strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 });
const player = (extra = {}) => ({ isPlayer: true, career: {}, skills: new Array(35).fill(30), level: 5, stats: { ...STATS }, raceId: RACES.Breton, items: [], activeEffects: [], health: 40, maxHealth: 40, fatigue: 6400, equip: createEquipTable(), ...extra });
const garment = (templateIndex, extra = {}) => mintCondition({ group: templateIndex >= 182 ? 'WomensClothing' : 'MensClothing', templateIndex, name: 'garment', flags: 0, variant: 0, ...extra });
const plate = (templateIndex = 102) => mintCondition({ group: 'Armor', templateIndex, material: 0x0200, name: 'Plate', flags: 0, variant: 0 });   // AUDIT C&C T10: the cuirass by default, each piece the template its slot holds
const BLIZZARD = Object.freeze({ climateIndex: CLIMATES.Mountain, month: 0, hour: 2, weather: 'snow' });
const DESERT_NOON = Object.freeze({ climateIndex: CLIMATES.Desert2, month: 6, hour: 12, weather: 'sunny', inSunlight: true });
const WEATHERS = Object.keys(WEATHER_TEMP);
/** Stand `e` in `env` for one minute through the real feed and the real law, as a host's ticker does. */
const stand = (e, env, minute = 1) => { const f = survivalFeed(e, env); survivalMinute(e, minute, f.env, { ...f.deps, autoDrink: false, autoEat: false, rolls: () => 0.5 }); return f; };

afterEach(() => { _resetForTests(); });

test('TEMP-UI: the natural temperature\'s parts sum to naturalTemperature exactly - every climate, month, hour (a fractional one too), weather, and outdoors, indoors, underground and both; the roof\'s share only indoors, the hour and the sky never underground; and the hour\'s band is hourTemperature\'s over every minute of the day', () => {
  let n = 0;
  for (const climateIndex of [...Object.values(CLIMATES), 999]) for (let month = 0; month < 12; month++) for (const hour of [0, 3.5, 4, 7.99, 8, 12, 15.5, 16, 19.99, 20, 23]) for (const weather of [...WEATHERS, 'nonsense']) {
    for (const [insideBuilding, insideDungeon] of [[false, false], [true, false], [false, true], [true, true]]) {
      const env = { climateIndex, month, hour, weather, insideBuilding, insideDungeon };
      const p = naturalParts(env);
      assert.equal(p.climate + p.season + p.hour + p.weather + p.roof, naturalTemperature(env), JSON.stringify(env));
      assert.equal(p.natural, naturalTemperature(env));
      assert.equal(p.climate, CLIMATE_TEMP[climateIndex] ?? 0); assert.equal(p.season, MONTH_TEMP[month]);
      if (!insideBuilding) assert.equal(p.roof, 0, 'no roof out of doors');
      if (insideDungeon && !insideBuilding) assert.deepEqual([p.hour, p.weather], [0, 0], 'underground has no hour and no sky');
      n++;
    }
  }
  assert.ok(n > 20000);
  // a desert inn at night: the roof's half (ROOF-SHELTER) - a mountain inn keeps it; a cellar keeps the street's
  const inn = naturalParts({ climateIndex: CLIMATES.Desert, month: 6, hour: 23, weather: 'sunny', insideBuilding: true });
  assert.deepEqual({ ...inn }, { climate: 40, season: 20, hour: -60, weather: 0, roof: 0, natural: 0 }, 'the street is the milder: no roof row');
  const noon = naturalParts({ climateIndex: CLIMATES.Desert, month: 6, hour: 12, weather: 'sunny', insideBuilding: true });
  assert.deepEqual({ ...noon }, { climate: 40, season: 20, hour: 0, weather: 0, roof: -30, natural: 30 }, 'the roof halves the noon');
  const BAND = { day: 0, evening: -10, dawn: -10, night: -20 };
  for (const climateIndex of Object.values(CLIMATES)) for (let m = 0; m < 1440; m++) {
    const h = m / 60;
    const mult = hourTemperature(12, climateIndex) === 0 ? hourTemperature(23, climateIndex) / -20 : 1;
    assert.equal(hourTemperature(h, climateIndex), BAND[hourBand(h)] * mult, `${climateIndex} at ${h}`);
  }
  assert.deepEqual(Object.keys(HOUR_NAMES), ['day', 'evening', 'dawn', 'night']);
});

test('TEMP-UI: the breakdown adds up to the felt temperature, to the degree - over every climate and weather, both ends of the day and the year, naked, in the starting clothes, a formal cloak, wet plate in the sun and in the cold, by a fire, with a drink to hand in the heat, a frost-resistant race, a Legendary garment\'s degrees and underground', () => {
  const shirt = garment(165), pants = garment(151), shoes = garment(148), cloak = garment(155);
  const kits = {
    naked: [],
    starting: [[EQUIP_SLOTS.ChestClothes, shirt], [EQUIP_SLOTS.LegsClothes, pants], [EQUIP_SLOTS.Feet, shoes]],
    cloaked: [[EQUIP_SLOTS.ChestClothes, shirt], [EQUIP_SLOTS.LegsClothes, pants], [EQUIP_SLOTS.Cloak1, cloak]],
    plate: [[EQUIP_SLOTS.ChestArmor, plate()], [EQUIP_SLOTS.LegsArmor, plate(104)]],
  };
  const ctxs = [
    { raceId: RACES.Breton },
    { raceId: RACES.Nord, raceTemplate: raceById(RACES.Nord), wet: 150 },
    { raceId: RACES.Argonian, hasWater: true, frostResist: 30, fireResist: 20 },
    { raceId: RACES.DarkElf, raceTemplate: { resistanceFlags: FLAG_FIRE, lowToleranceFlags: FLAG_FROST }, coldDegrees: 12, heatDegrees: 9, gearWarmth: 6 },
    { raceId: RACES.Khajiit, vampire: true, lycanthrope: true, hasWater: true },
  ];
  let n = 0;
  for (const climateIndex of Object.values(CLIMATES)) for (const month of [0, 6]) for (const hour of [2, 12]) for (const weather of WEATHERS) {
    for (const [insideBuilding, insideDungeon, byFire, inSunlight] of [[false, false, false, true], [true, false, true, false], [false, true, false, false], [false, false, true, false]]) {
      const env = { climateIndex, month, hour, weather, insideBuilding, insideDungeon, byFire, inSunlight };
      for (const kit of Object.values(kits)) for (const ctx of ctxs) {
        const worn = []; for (const [slot, it] of kit) worn[slot] = it;
        const t = feltTemperature(env, worn, ctx);
        const rows = temperatureBreakdown(env, t);
        assert.equal(rows.reduce((a, r) => a + r.value, 0), t.felt, `${JSON.stringify(env)} ${JSON.stringify(ctx)}`);
        assert.equal(rows[0].key, 'climate', 'the land first, always');
        assert.ok(rows.slice(1).every((r) => r.value !== 0), 'no row that moved nothing');
        n++;
      }
    }
  }
  assert.ok(n > 10000);
  // the rows, named, on a wet cloaked Breton in a mountain blizzard by a fire, and the notes
  const worn = []; worn[EQUIP_SLOTS.Cloak1] = cloak; worn[EQUIP_SLOTS.ChestArmor] = plate();
  const env = { ...BLIZZARD, byFire: true };
  const t = feltTemperature(env, worn, { raceId: RACES.Breton, wet: 4 });
  assert.deepEqual(temperatureBreakdown(env, t), [
    { key: 'climate', label: 'Mountains', value: CLIMATE_TEMP[CLIMATES.Mountain] },
    { key: 'season', label: 'Morning Star', value: MONTH_TEMP[0] },
    { key: 'hour', label: 'Night', value: -40 },
    { key: 'weather', label: 'Snow', value: WEATHER_TEMP.snow },
    { key: 'race', label: 'Your race', value: 5 },
    { key: 'clothes', label: 'Clothing', value: 8, note: '+12° dry' },
    { key: 'armour', label: 'Armour', value: t.armour, note: 'cold metal' },
    { key: 'fire', label: 'A fire', value: 15 },
    { key: 'skin', label: 'Heat loss', value: NAKED_OFFSET },
  ]);
  assert.ok(t.armour < 0, 'the plate\'s cold outweighs its warmth on a mountain night');
  const hot = feltTemperature(DESERT_NOON, [], { raceId: RACES.Breton, hasWater: true });
  assert.ok(temperatureBreakdown(DESERT_NOON, hot).some((r) => r.key === 'drink' && r.value === -WATER_COOLS), 'the drink to hand, in the heat');
  assert.equal(temperatureBreakdown({}, null).length, 0);
  assert.equal(CLIMATE_NAMES[CLIMATES.Desert2], 'Deep desert'); assert.equal(WEATHER_NAMES.thunder, 'Thunderstorm');
  assert.equal(monthNames().length, 12);
});

test('TEMP-UI: signedDegrees - signed, rounded, the degree sign; no sign on nought', () => {
  assert.deepEqual([-14, 3, 0, -0.4, 2.6, 'x', -116].map(signedDegrees), ['-14°', '+3°', '0°', '0°', '+3°', '0°', '-116°']);
});

test('TEMP-UI: the HUD plate\'s reading wears the strip\'s own level - every reading from -120 to +120, with and without a lit fire\'s warmth and a rewarding tier\'s record: the same amber and red as the temperature chip, comfortable \'ok\', its side, its scale clamped', () => {
  assert.equal(temperatureReadout({}), null); assert.equal(temperatureReadout({ survival: newSurvival(0) }), null, 'no reading before the first minute');
  for (let felt = -120; felt <= 120; felt++) for (const warmed of [false, true]) for (const boons of [undefined, []]) {
    const s = { ...newSurvival(0), felt, ...(warmed ? { warmed: true } : {}), ...(boons ? { boons } : {}) };
    const e = { survival: s };
    const r = temperatureReadout(e);
    const word = temperatureWord(felt);
    const chip = survivalHudChips(e, 0).find((c) => c.key === 'temp');
    assert.equal(r.level, chip ? chip.level : 'ok', `${felt} warmed:${warmed} boons:${!!boons}`);
    assert.equal(r.label, chip ? chip.text : 'Comfortable');
    assert.equal(r.word, word);
    assert.equal(r.side, ['cold', 'freezing', 'deadly cold'].includes(word) ? 'cold' : word === 'comfortable' ? 'mild' : 'hot');
    assert.equal(r.text, signedDegrees(felt));
    assert.equal(r.at, Math.min(1, Math.max(0, (felt - TEMP_SCALE.min) / (TEMP_SCALE.max - TEMP_SCALE.min))));
  }
  assert.deepEqual(TEMP_SCALE, { min: -60, max: 60 });
  assert.equal(temperatureReadout({ survival: { ...newSurvival(0), felt: -40 } }, 5).label, 'Comfortable', 'a live reading handed in is read, not the record\'s');
  assert.ok(Object.hasOwn(STATUS_GLYPHS, 'thermo') && statusGlyphSvg('thermo'), 'the thermometer draws');
});

test('TEMP-UI: the status page says the number under the word, in plain characters every font the box is drawn in carries (no degree sign), with the band it is read against', () => {
  const e = { survival: { ...newSurvival(0), felt: -14 } };
  const lines = survivalStatusLines(e, 0);
  const at = lines.indexOf(STATUS_TEXT.temp('cold'));
  assert.ok(at >= 0);
  assert.equal(lines[at + 1], 'Felt temperature: -14 (comfortable from -10 to +10).');
  assert.equal(STATUS_TEXT.felt(7), 'Felt temperature: +7 (comfortable from -10 to +10).');
  assert.equal(STATUS_TEXT.felt(0), 'Felt temperature: 0 (comfortable from -10 to +10).');
  assert.ok(lines.every((l) => /^[\x20-\x7e]*$/.test(l)), 'ASCII only');
  const warm = { survival: { ...newSurvival(0), felt: -40, warmed: true } };
  assert.ok(survivalStatusLines(warm, 0).includes('Felt temperature: -40 (comfortable from -10 to +10).'), 'beside the fire\'s line too');
  assert.equal(survivalStatusLines({ survival: newSurvival(0) }, 0).some((l) => l.startsWith('Felt temperature')), false, 'no reading, no number');
});

test('TEMP-UI: the pack\'s live reading IS the minute law\'s - feltNow over the feed the host last built gives the felt temperature the next minute writes, through the one context (needs.js feltCtx); another table reads another; nothing of it rides the entity', () => {
  setPref(SURVIVAL_PREF, 'casual');
  const e = player();
  assert.equal(feltNow(e), null, 'no feed, no reading');
  assert.deepEqual(feltBreakdownNow(e), []);
  const keys = Object.keys(e).sort();
  for (const env of [BLIZZARD, DESERT_NOON, { ...BLIZZARD, byFire: true, insideBuilding: true }]) {
    stand(e, env);
    assert.equal(feltNow(e).felt, e.survival.felt, `the live reading is the minute's own in ${JSON.stringify(env)}`);
    assert.deepEqual(feltNow(e).env, lastSurvivalFeed(e).env);
  }
  assert.deepEqual(Object.keys(e).filter((k) => k !== 'survival' && k !== '_mods').sort(), keys.filter((k) => k !== '_mods'), 'the feed is held weakly, not on the entity');
  stand(e, BLIZZARD);
  const cloak = garment(155);
  const worn = [...e.equip.slots]; worn[EQUIP_SLOTS.Cloak1] = cloak;
  assert.ok(feltNow(e, { worn }).felt > feltNow(e).felt, 'a cloak warms the live reading');
  // the minute after the cloak goes on writes what the live reading said
  e.items.push(cloak); equipItem(e, cloak);
  const live = feltNow(e).felt;
  stand(e, BLIZZARD, 2);
  assert.equal(e.survival.felt, live, 'the next minute charges what the pack showed');
  assert.deepEqual(feltCtx(e, e.survival, lastSurvivalFeed(e).ctx).raceId, RACES.Breton);
  assert.match(read('src/systems/survival/needs.js'), /const ctx = feltCtx\(entity, s, deps\.ctx\);/, 'the law builds its context through the seam');
});

test('TEMP-UI: the HUD plate, executed - UI-CALM: in the bottom-left corner\'s caption, first; hidden with the arc Off, with its part switched off, and before a reading; shown with the number, the word, the way it runs, the strip\'s level and the mark on the scale; written only when what it says changes', async () => {
  const mk = (tag = 'div') => ({
    tag, className: '', textContent: '', src: '', alt: '', children: [], dataset: {}, attrs: {},
    style: { setProperty(k, v) { this[k] = v; }, removeProperty(k) { delete this[k]; } },
    classList: { _s: new Set(), add(...c) { c.forEach((x) => this._s.add(x)); }, remove(...c) { c.forEach((x) => this._s.delete(x)); }, toggle(c, on) { if (on) this._s.add(c); else this._s.delete(c); }, contains(c) { return this._s.has(c); } },
    setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return this.attrs[k]; }, removeAttribute(a) { delete this.attrs[a]; }, remove() {},
    append(...c) { this.children.push(...c); }, appendChild(c) { this.children.push(c); return c; }, replaceChildren(...c) { this.children = c; }, addEventListener() {},
  });
  const find = (node, cls) => {
    if (String(node.className ?? '').split(/\s+/).includes(cls)) return node;
    for (const c of node.children ?? []) { const got = find(c, cls); if (got) return got; }
    return null;
  };
  const prev = globalThis.document;
  globalThis.document = { createElement: (t) => mk(t), createElementNS: () => mk(), getElementById: () => null, head: mk(), body: mk(), querySelector: () => null, querySelectorAll: () => [] };
  const { drawEnhancedHud, destroyEnhancedHud, TEMP_HUD_PREF } = await import('../../../src/ui/enhanced/enhancedHud.js');
  try {
    const entity = { health: 40, maxHealth: 80, magicka: 0, maxMagicka: 10, fatigue: 100, items: [], equip: createEquipTable(), lightSource: null, activeEffects: [], survival: newSurvival(0) };   // PIN MOVED (AUDIT C&C R7): the equip table the game mints
    setPref(SURVIVAL_PREF, 'casual');
    drawEnhancedHud(entity, 0, 0, {});
    const root = document.body.children.find((n) => n.className === 'hud');
    const cap = find(root, 'hud-qcap');   // UI-CALM: the corner's caption, the mode's word beside it
    const plate = cap.children[0];
    assert.ok(plate && plate.className === 'hud-temp', 'the plate is the corner caption\'s first word');
    assert.equal(plate.style.display, 'none', 'no reading yet: hidden');
    entity.survival.felt = -34;
    drawEnhancedHud(entity, 0, 0, {});
    assert.equal(plate.style.display, '');
    assert.deepEqual([find(plate, 'hud-tempnum').textContent, find(plate, 'hud-tempword').textContent], ['-34°', 'Freezing']);
    assert.deepEqual({ ...plate.dataset }, { side: 'cold', level: 'danger' });
    assert.equal(find(plate, 'hud-tempglyph').src, statusGlyphSrc('cold'), 'the snowflake');
    assert.equal(find(plate, 'hud-tempmark').style.left, `${((-34 + 60) / 120 * 100).toFixed(1)}%`);
    // written only on change: a stranger's hand on the text stays until the reading moves
    find(plate, 'hud-tempnum').textContent = 'x';
    drawEnhancedHud(entity, 0, 0, {});
    assert.equal(find(plate, 'hud-tempnum').textContent, 'x', 'an unchanged reading writes nothing');
    entity.survival.felt = 4;
    drawEnhancedHud(entity, 0, 0, {});
    assert.deepEqual([find(plate, 'hud-tempnum').textContent, find(plate, 'hud-tempword').textContent, plate.dataset.side, plate.dataset.level], ['+4°', 'Comfortable', 'mild', 'ok']);
    assert.equal(find(plate, 'hud-tempglyph').src, statusGlyphSrc('thermo'), 'comfortable: the thermometer');
    entity.survival.felt = 40;
    drawEnhancedHud(entity, 0, 0, {});
    assert.equal(find(plate, 'hud-tempglyph').src, statusGlyphSrc('hot'), 'hot: the sun');
    entity.survival.felt = 4;
    setPref(SURVIVAL_PREF, 'boons'); entity.survival.felt = -60;   // PIN MOVED (AUDIT C&C R7): the tier turned, the record not rewritten - the plate reads the live tier
    drawEnhancedHud(entity, 0, 0, {});
    assert.equal(plate.dataset.level, 'warn', 'Boons: nothing costs, nothing red');
    setPref(TEMP_HUD_PREF, false);
    drawEnhancedHud(entity, 0, 0, {});
    assert.equal(plate.style.display, 'none', 'its part off');
    setPref(TEMP_HUD_PREF, true); setPref(SURVIVAL_PREF, false);
    drawEnhancedHud(entity, 0, 0, {});
    assert.equal(plate.style.display, 'none', 'the arc Off');
  } finally {
    destroyEnhancedHud();
    globalThis.document = prev;
  }
  // the sheet and the kit
  const css = read('src/ui/enhanced/enhancedStyle.js');
  // UI-CALM: in the caption's flow, not hung off the compass; comfortable, the glyph and the number alone
  const calm = read('src/ui/uiCalmStyle.js');
  assert.match(calm, /\.hud \.hud-qcap \.hud-temp \{ position: relative; left: auto; top: auto; right: auto; transform: none;/);
  assert.match(calm, /\.hud \.hud-temp\[data-level="ok"\] \.hud-tempword, \.hud \.hud-temp\[data-level="ok"\] \.hud-tempscale \{ display: none; \}/);
  assert.match(css, /\.hud-temp \.hud-tempword, \.hud-temp \.hud-tempscale \{ display: none; \}/, 'a phone keeps the glyph and the number');
  assert.ok(FRAME_ROLES.chip.includes('.hud-temp'), 'a chip of the kit, so every dress paints it');
});

test('TEMP-UI: the plate\'s part on the Climates & Calories row - on by default, each player\'s own online, a part of the drawer', () => {
  const row = FEATURES.find((f) => f.id === 'mod-climates-calories');
  assert.deepEqual(row.control.also, [{ store: 'prefs', key: 'survivalTempHud', initial: true, online: 'player' }]);
  assert.deepEqual(row.control.parts, [{ key: 'survivalTempHud', label: 'Temperature on the HUD' }]);
  assert.equal(FEATURE_PREF_DEFAULTS.survivalTempHud, true);
  assert.equal(onlineForcedPref('survivalTempHud', '?online=1'), undefined);
});

test('TEMP-UI: the pack - the plaque says the live felt temperature, its word in its title with every row of the sum; a cloak\'s card says what wearing it would do and a worn one\'s what taking it off would, green toward the comfortable band and red away; a ring moves nothing and says nothing; the Stats side\'s rows add up; nothing with the arc Off', () => {
  setPref(SURVIVAL_PREF, 'casual');
  const e = player();
  withDom(() => {
    assert.equal(packTemperature(e), null, 'no reading at all yet');
    e.survival = { ...newSurvival(0), felt: -20 };
    assert.equal(packTemperature(e).live, false, 'the record\'s last minute, with no parts, before the needs run');
    stand(e, BLIZZARD);
    const r = packTemperature(e);
    assert.equal(r.live, true); assert.equal(r.felt, e.survival.felt);
    const p = temperaturePlaque(e);
    assert.equal(p.className, 'worntemp-total');
    assert.deepEqual(p.children.map((c) => c.textContent), ['Felt', signedDegrees(r.felt)]);
    assert.deepEqual({ ...p.dataset }, { side: 'cold', level: 'danger' });
    assert.equal(p.title, `Felt temperature ${signedDegrees(r.felt)}: deadly cold - it costs you (comfortable from -10° to +10°)\n${breakdownLines(r.rows).join('\n')}`);   // PIN MOVED (AUDIT C&C S14): and that it costs, in words
    const rows = temperatureStatRows(e);
    assert.deepEqual(rows.at(-1).slice(0, 2), ['= Felt (deadly cold)', signedDegrees(r.felt)]);
    assert.equal(rows.length, r.rows.length + 1);
    // the cloak, not worn: wearing it - on a body dried off (a minute in the snow wet it; the live reading reads the wet now)
    e.survival.wet = 0;
    const cloak = garment(155);
    e.items.push(cloak);
    const wear = wearComparison(e, cloak);
    assert.ok(Array.isArray(wear.worn) && wear.worn[wear.slot]?.templateIndex === 155, 'the table the wear would leave (an unidentified piece as its stripped copy - armourCard.js)');
    const w = temperatureWear(e, cloak, wear);
    assert.equal(w.label, 'Wearing it');
    assert.equal(Math.round(w.after.felt - w.before.felt), 12, 'a formal cloak is twelve degrees dry, and the record is dry');
    const block = temperatureCompareBlock(e, cloak, wear);
    assert.equal(block.className, 'cmp tcmp');
    const dd = block.children[1].children[0].children[1];
    assert.equal(dd.children[0].textContent, `${signedDegrees(w.before.felt)} Deadly cold → ${signedDegrees(w.after.felt)} ${temperatureReadout(e, w.after.felt).label}`);
    assert.deepEqual([dd.children[1].className, dd.children[1].textContent], ['cmp-d up', '+12°'], 'warmer in the cold is better');
    // worn: without it
    equipItem(e, cloak);
    const off = temperatureWear(e, cloak, null);
    assert.equal(off.label, 'Without it'); assert.equal(Math.round(off.after.felt - off.before.felt), -12);
    assert.equal(temperatureCompareBlock(e, cloak, null).children[1].children[0].children[1].children[1].className, 'cmp-d down');
    // in the deep desert's noon the same cloak OFF is the way back toward comfortable: cooler is better, green
    stand(e, DESERT_NOON, 3);
    const noonOff = temperatureWear(e, cloak, null);
    assert.ok(noonOff.after.felt < noonOff.before.felt && noonOff.before.felt > COMFORT.high, 'off, it is cooler in the heat');
    const noon = temperatureCompareBlock(e, cloak, null).children[1].children[0].children[1].children[1];
    assert.deepEqual([noon.className, noon.textContent], ['cmp-d up', signedDegrees(Math.round(noonOff.after.felt) - Math.round(noonOff.before.felt))]);
    // a ring: no warmth, no line
    const ring = mintCondition({ group: 'Jewellery', templateIndex: 133, name: 'Ring', flags: 0, variant: 0 });
    e.items.push(ring);
    assert.equal(temperatureCompareBlock(e, ring, wearComparison(e, ring)), null, 'a wear that moves nothing says nothing');
    assert.equal(temperatureCompareBlock(e, createSurvivalItem(TEMPLATE.Bread), null), null, 'nor a loaf');
    // Off
    setPref(SURVIVAL_PREF, false);
    assert.equal(temperaturePlaque(e), null); assert.equal(temperatureCompareBlock(e, cloak, null), null); assert.deepEqual(temperatureStatRows(e), []);
  });
  assert.deepEqual(COMFORT, { low: -10, high: 10 });
  assert.deepEqual([-25, -10, 0, 10, 31].map(discomfort), [15, 0, 0, 0, 21]);
  // wired where the pack draws: the plaque in the figure's head cell, the block under the card's comparisons, the section on the Stats side
  const inv = read('src/ui/enhanced/enhancedInventory.js');
  assert.match(inv, /plaques\.style\.gridArea = '1 \/ 2 \/ 2 \/ 3';\n {2}plaques\.append\(armourPlaque\(deps\.entity\)\);\n {2}const temp = temperaturePlaque\(deps\.entity\);\n {2}if \(temp\) plaques\.append\(temp\);/);   // PIN MOVED (AUDIT C&C S1): the two in one row on the figure's first cell named whole
  assert.match(inv, /const tc = temperatureCompareBlock\(deps\.entity, picked, wear\); if \(tc\) into\.append\(tc\);/);
  assert.match(read('src/ui/statsCard.js'), /const tempRows = temperatureStatRows\(entity\);\n {2}if \(tempRows\.length\) \{\n {4}const tp = section\('Temperature', 13\);/);
  assert.match(read('src/ui/enhanced/enhancedPlusStyle.js'), /\.pack-shell \.wornmap \.wornplaques \{ position: absolute; left: 4px; right: 4px; top: 4px; z-index: 2; display: flex; flex-wrap: wrap;\n {2}justify-content: space-between;/, 'the Armour plaque\'s twin, at the other end of their row');   // PIN MOVED (AUDIT C&C S1): the row's, wrapping under on a narrow figure
  assert.match(read('src/ui/grimoireDress.js'), /\$\{G\} \.statflip-btn, \$\{G\} \.wornac-total, \$\{G\} \.worntemp-total \{ background:/, 'the Grimoire dress paints it as the Armour plaque');
});

test('TEMP-UI: the Stats side carries the Temperature section with the arc on - a row each part and the total - and none with it Off', async () => {
  const { buildStatsPage } = await import('../../../src/ui/statsCard.js');
  const e = player({ raceId: RACES.Breton, health: 50, maxHealth: 60, armorValues: new Array(7).fill(100), reflexes: 2, biographyAvoidHitMod: 0, career: { weaponArmorShieldsBitfield: 0, abilityFlagsAndSpellPointsBitfield: 0 } });
  const sectionTitles = (page) => page.children.filter((c) => String(c.className).includes('sf-sec')).map((c) => c.children[0].textContent);
  withDom(() => {
    setPref(SURVIVAL_PREF, 'casual');
    stand(e, BLIZZARD);
    const page = buildStatsPage(e, () => {});
    assert.ok(sectionTitles(page).includes('Temperature'));
    const sec = page.children.find((c) => String(c.className).includes('sf-sec') && c.children[0].textContent === 'Temperature');
    const rows = sec.children.slice(1).map((r) => r.children.map((x) => x.textContent));
    assert.deepEqual(rows, temperatureStatRows(e).map(([k, v]) => [k, v]));
    setPref(SURVIVAL_PREF, false);
    assert.equal(sectionTitles(buildStatsPage(e, () => {})).includes('Temperature'), false);
  });
});

// ═══ AUDIT TEMP-UI - THE LAW UNDER THE NUMBER ═══════════════════════════
// The temperature lens (lens E) read the law a widget would now put a number on, and a number shows every jump the
// words had hidden. Each fix, pinned against the case that found it.

test('AUDIT TEMP-UI E1: the body\'s own warmth is not resisted - a Resist Fire no longer makes a blizzard colder, nor a Resist Frost a desert hotter; a resistance turns the WORLD\'s cold or heat toward nothing, and nothing more', () => {
  const cloak = garment(155, { variant: 1 }), shirt = garment(165), pants = garment(151);
  const worn = []; worn[EQUIP_SLOTS.Cloak1] = cloak; worn[EQUIP_SLOTS.ChestClothes] = shirt; worn[EQUIP_SLOTS.LegsClothes] = pants;
  const env = { ...BLIZZARD, byFire: true };
  const base = feltTemperature(env, worn, { raceId: RACES.Breton });
  for (const fireResist of [25, 50, 100]) {
    assert.equal(feltTemperature(env, worn, { raceId: RACES.Breton, fireResist }).felt, base.felt, `Resist Fire ${fireResist}% leaves the blizzard as it was (it read ${base.felt - fireResist} and colder)`);
  }
  assert.equal(feltTemperature(env, worn, { raceId: RACES.Breton, frostResist: 30 }).felt, base.felt + 30, 'Resist Frost raises the world\'s cold by its degrees');
  assert.equal(base.own, base.race + base.clothes + base.armour + base.fire - base.water + NAKED_OFFSET, 'the body\'s own sum, unresisted');
  const hot = feltTemperature(DESERT_NOON, [], { raceId: RACES.Argonian });
  assert.equal(feltTemperature(DESERT_NOON, [], { raceId: RACES.Argonian, frostResist: 50 }).felt, hot.felt, 'a Resist Frost in the desert sun changes nothing');
  assert.equal(feltTemperature(DESERT_NOON, [], { raceId: RACES.Argonian, fireResist: 20 }).felt, hot.felt - 20, 'a Resist Fire takes its degrees off the world\'s heat');
  assert.equal(resistTemperature(-40, { frostResist: 50 }), 0, 'and never past nothing (the law kept)');
  // ...and a Legendary garment's degrees stay the FELT reading's (AUDIT LOOT II A2), not a resistance: since the body is
  // no longer resisted, the case that told the two apart is a warm reading in a cold world - wrapped up by a fire on a
  // winter noon, the heat's degrees take the warmth off the felt reading, where a fire resistance on a cold world could not
  const winter = { climateIndex: CLIMATES.Woodlands, month: 0, hour: 12, weather: 'sunny', byFire: true };
  const warm = feltTemperature(winter, worn, { raceId: RACES.Breton });
  assert.ok(warm.natTemp < 0 && warm.felt > 0, `a cold world (${warm.natTemp}), a warm body (${warm.felt})`);
  const robe = { raceId: RACES.Breton, ...wardrobeCtx({ heatDegrees: 9 }) };   // the wardrobe's fold, as the minute law reads it
  assert.equal(feltTemperature(winter, worn, robe).felt, Math.max(warm.felt - 9, 0), 'the heat\'s degrees off the warm reading');
  assert.equal(feltTemperature(winter, worn, { raceId: RACES.Breton, fireResist: 9 }).felt, warm.felt, 'where a fire resistance moves nothing');
});

test('AUDIT TEMP-UI E2: a swimmer is in the water - and, AUDIT C&C (lens T D3), as the mod has it: a swim on the surface wades (fifty a minute), only a head under the water is submerged (the whole three hundred at once); a reader that says either is believed; and the dungeon\'s swim and its head under are its own', () => {
  setPref(SURVIVAL_PREF, 'casual');
  const RIVER = { climateIndex: CLIMATES.Woodlands, month: 6, hour: 12, weather: 'sunny' };   // a summer river: no weather to soak, nothing to dry while in it
  const e = player();
  stand(e, { ...RIVER, swimming: true }, 1);
  assert.equal(e.survival.wet, 50, 'a minute on the surface: fifty (it was the whole three hundred, Drenched for five hours)');
  for (let m = 2; m <= 3; m++) stand(e, { ...RIVER, swimming: true }, m);
  assert.equal(e.survival.wet, 150, 'three minutes\' swim');
  const d = player();
  stand(d, { ...RIVER, swimming: true, submerged: true }, 1);
  assert.equal(d.survival.wet, 300, 'the head under: soaked at once');
  assert.deepEqual(['wading', 'submerged'].map((k) => survivalFeed(e, { ...BLIZZARD, swimming: true }).env[k]), [true, false], 'a swim wades');
  assert.equal(survivalFeed(e, { ...BLIZZARD, swimming: true, wading: false }).env.wading, false, 'a host that knows better says so');
  assert.equal(survivalFeed(e, { ...BLIZZARD, swimming: true, submerged: true }).env.wading, false, 'under the water is no wade');
  assert.deepEqual(['wading', 'submerged'].map((k) => survivalFeed(e, BLIZZARD).env[k]), [false, false], 'on land, nothing');
  assert.match(read('src/scenes/dungeonContext.js'), /insideBuilding: false, insideDungeon: true, inSunlight: false, swimming: !!_activity\.swimming, transport: false,\n\s*submerged: _submergedNow,/);
  assert.match(read('src/scenes/world.js'), /submerged: m === 'exterior' && !!dwPlayer\?\.submerged,/);
});

test('AUDIT TEMP-UI E3: underground, the clothes, the armour\'s metal and the food read the dungeon\'s air - a desert dungeon reads the starting kit as every other dungeon does, and the food spoils at the dungeon\'s pace', () => {
  const kit = []; kit[EQUIP_SLOTS.ChestClothes] = garment(165); kit[EQUIP_SLOTS.LegsClothes] = garment(151); kit[EQUIP_SLOTS.Feet] = garment(148);
  const under = (climateIndex) => feltTemperature({ climateIndex, month: 0, hour: 12, weather: 'sunny', insideDungeon: true }, kit, { raceId: RACES.Breton });
  const desert = under(CLIMATES.Desert), woods = under(CLIMATES.Woodlands);
  assert.equal(desert.air, dungeonTemperature(naturalTemperature({ climateIndex: CLIMATES.Desert, month: 0, hour: 12, insideDungeon: true })));
  assert.equal(desert.clothes, woods.clothes, 'the cloth whole in both - it was halved for the sand above the desert one');
  assert.equal(desert.felt, woods.felt, 'one dungeon air, one reading');
  assert.equal(temperatureWord(desert.felt), 'comfortable');
  const outside = feltTemperature({ climateIndex: CLIMATES.Desert, month: 0, hour: 12, weather: 'sunny' }, kit, { raceId: RACES.Breton });
  assert.equal(outside.air, outside.natural, 'out of doors the air is the world\'s');
  assert.match(read('src/systems/survival/needs.js'), /s\.rotMinutes \+= rotWeight\(temp\.air\);/, 'the rot reads the air the food is carried in');
});

test('AUDIT TEMP-UI E8: a drink to hand cools a warm reading to nine at the coolest - a warmer day never reads cooler (10 fell to 0, 19 to 9)', () => {
  for (const climateIndex of [CLIMATES.Swamp, CLIMATES.Subtropical, CLIMATES.Desert]) {
    for (let month = 0; month < 12; month++) {
      const t = feltTemperature({ climateIndex, month, hour: 12, weather: 'sunny', insideBuilding: true }, [], { raceId: RACES.Breton, hasWater: true });
      const dry = feltTemperature({ climateIndex, month, hour: 12, weather: 'sunny', insideBuilding: true }, [], { raceId: RACES.Breton });
      if (dry.felt > 9) assert.equal(t.felt, Math.max(dry.felt - WATER_COOLS, 9), `${climateIndex}/${month}: ${dry.felt} cools to ${t.felt}`);
      else assert.equal(t.felt, dry.felt, 'nine and under: untouched');
    }
  }
  // and through the minute law, as a host feeds it: a skin with water in it cools the desert noon's reading
  setPref(SURVIVAL_PREF, 'casual');
  const carrying = player({ items: [createSurvivalItem(TEMPLATE.Waterskin, { water: 2 })] });
  const bare = player();
  stand(carrying, DESERT_NOON); stand(bare, DESERT_NOON);
  assert.equal(carrying.survival.felt, Math.max(bare.survival.felt - WATER_COOLS, 9), 'the one context carries the drink to hand');
  assert.ok(bare.survival.felt > 9);
  // the monotone law itself: a warmer reading, cooled, never under a cooler one cooled
  const cool = (f) => (f > 9 ? Math.max(f - WATER_COOLS, 9) : f);
  for (let f = 0; f < 40; f++) assert.ok(cool(f + 1) >= cool(f), `${f + 1} cools no lower than ${f}`);
  assert.match(read('src/systems/survival/temperature.js'), /if \(felt > 9 && ctx\.hasWater && !ctx\.vampire\) felt = Math\.max\(felt - WATER_COOLS, 9\);/);
});

test('AUDIT TEMP-UI E11, E12: the needs feel the weather the land wears (the Sun Baby\'s clear day too); a record whose counters are no numbers is mended, not left reading NaN', () => {
  assert.match(read('src/scenes/world.js'), /const survivalEnvNow = \(\) => \{[\s\S]{0,300}?const weather = shownWeather\(\);/);
  const e = { survival: { lastAte: 0, thirst: 0, awakeSince: 0, sleepDebt: 0 } };
  const s = survivalOf(e, 100);
  assert.deepEqual([s.wet, s.exposure, s.fed, s.drunk, s.rotMinutes, s.rotDays], [0, 0, 0, 0, 0, 0], 'the missing counters, the fresh record\'s');
  assert.equal(s.lastAte, 0, 'and what was there, kept');
  const n = { survival: { ...newSurvival(0), wet: NaN, thirst: null } };
  survivalOf(n, 5);
  assert.deepEqual([n.survival.wet, n.survival.thirst], [0, 0]);
  const t = feltTemperature(BLIZZARD, [], feltCtx(n, n.survival, { raceId: RACES.Breton }));
  assert.ok(Number.isFinite(t.felt), 'a reading, not NaN');
});

test('TEMP-UI: the HUD plate reads LIVE where the needs have run (AUDIT TEMP-UI E9: the record waits a game minute, so a door read the street\'s for five seconds), and (UI-CALM) stands in the corner, where no edge can meet it - TEMP-UI\'s fit retired with the place it measured', async () => {
  const mk = (tag = 'div') => ({
    tag, className: '', textContent: '', src: '', alt: '', children: [], dataset: {}, attrs: {},
    style: { setProperty(k, v) { this[k] = v; }, removeProperty(k) { delete this[k]; } },
    classList: { _s: new Set(), add(...c) { c.forEach((x) => this._s.add(x)); }, remove(...c) { c.forEach((x) => this._s.delete(x)); }, toggle(c, on) { if (on) this._s.add(c); else this._s.delete(c); }, contains(c) { return this._s.has(c); } },
    setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return this.attrs[k]; }, removeAttribute(a) { delete this.attrs[a]; }, remove() {},
    append(...c) { this.children.push(...c); }, appendChild(c) { this.children.push(c); return c; }, replaceChildren(...c) { this.children = c; }, addEventListener() {},
  });
  const find = (node, cls) => {
    if (String(node.className ?? '').split(/\s+/).includes(cls)) return node;
    for (const c of node.children ?? []) { const got = find(c, cls); if (got) return got; }
    return null;
  };
  const prev = globalThis.document, prevW = globalThis.innerWidth;
  globalThis.document = { createElement: (t) => mk(t), createElementNS: () => mk(), getElementById: () => null, head: mk(), body: mk(), querySelector: () => null, querySelectorAll: () => [] };
  globalThis.innerWidth = 1440;
  const { drawEnhancedHud, destroyEnhancedHud } = await import('../../../src/ui/enhanced/enhancedHud.js');
  try {
    setPref(SURVIVAL_PREF, 'casual');
    const e = player({ health: 40, maxHealth: 80, magicka: 0, maxMagicka: 10, lightSource: null });
    stand(e, BLIZZARD);
    const recorded = e.survival.felt;
    // walk in through a door: the feed's next frame reads the roof before any minute passes
    survivalFeed(e, { ...BLIZZARD, insideBuilding: true });
    drawEnhancedHud(e, 0, 0, {});
    const root = document.body.children.find((n) => n.className === 'hud');
    const plate = find(root, 'hud-temp');
    assert.equal(find(plate, 'hud-tempnum').textContent, signedDegrees(feltNow(e).felt), 'the live reading');
    assert.notEqual(feltNow(e).felt, recorded, 'which is not the record\'s last minute');
    // UI-CALM: no fit to make in the corner - the plate is never stepped down, however it measures
    plate.getBoundingClientRect = () => ({ left: 1200, right: 1500, width: 300 });
    for (let i = 0; i < 31; i++) drawEnhancedHud(e, 0, 0, {});
    assert.equal(plate.classList.contains('compact'), false, 'never compact in the corner');
  } finally {
    destroyEnhancedHud();
    globalThis.document = prev; globalThis.innerWidth = prevW;
  }
  // PIN MOVED (AUDIT UICALM-FIRM1 L5 M10): the compass's plate, its compact and hung kinds, are gone from every sheet
  for (const f of ['src/ui/enhanced/enhancedStyle.js', 'src/ui/grimoireDress.js', 'src/ui/uiCalmStyle.js']) assert.doesNotMatch(read(f), /hud-temp\.compact|temp-hung|temp-aside|\.hud-temp \{[^}]*calc\(100% \+/, f);
});

