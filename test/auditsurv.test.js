import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  survivalMinute, runSurvivalMinutes, alignSurvival, newSurvival, survivalOf, survivalStatMods, applySurvivalMods, clearSurvivalMods, NEED, DRAIN, SURVIVAL_TEXT,
} from '../src/systems/survival/needs.js';
import { rotFoodDay, TEMPLATE, FOOD } from '../src/systems/survival/food.js';
import { createSurvivalItem, isSurvivalItem } from '../src/systems/survival/items.js';
import { temperatureWord, clothingWarmth, HOOD_SHADE } from '../src/systems/survival/temperature.js';
import { placeCampItem, CAMP_TEXT } from '../src/systems/survival/camp.js';
import { survivalHudChips } from '../src/systems/survival/status.js';
import { tavernMenu, TAVERN_MENU_TEXT, breakfastHours } from '../src/systems/survival/tavernMenu.js';
import { installSurvivalGate, uninstallSurvivalGate } from '../src/systems/survival/env.js';
import { REST_TEXT_SURVIVAL } from '../src/systems/survival/rest.js';
import { registerPreventRestCondition, unregisterPreventRestCondition, getPreventedRestMessage, clearPreventRestConditions } from '../src/systems/restSession.js';
import { createPlayerTicker } from '../src/scenes/shared.js';
import { setWorldMinutes } from '../src/systems/worldTick.js';
import { setPref, _resetForTests } from '../src/systems/uiPrefs.js';
import { SKILLS } from '../src/systems/skills.js';
import { RACES } from '../src/systems/races.js';
import { EQUIP_SLOTS } from '../src/systems/equip.js';
import { HuntWindow, HUNT_PHASE, BUSY_DOTS } from '../src/ui/huntWindow.js';
import { createHunting } from '../src/scenes/hunting.js';
import { TavernWindow } from '../src/ui/tavernWindow.js';
import { itemLine, localPrimaryAct } from '../src/ui/enhancedInventory.js';
import { usableItem } from '../src/systems/useItem.js';
import { ENHANCED_CSS } from '../src/ui/enhancedStyle.js';
import { survivalInfoTokens } from '../src/systems/itemInfo.js';
import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';
import { MOBILE_TYPES } from '../src/characters/mobileTypes.js';
import { assignStartingGear } from '../src/systems/startingGear.js';

// ═══ AUDIT SURV (2026-09-18): five lenses over SURV1-SURV7 ════════
//
// Mac: "Let's audit everything so far". Five opus agents read the arc
// - the pure laws, the wiring walk, the player-facing surfaces, the
// tests and records, a runtime probe - and the confirmed findings are
// fixed and pinned here, one test a lens.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };
const STATS = { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 };
const player = () => ({
  isPlayer: true, level: 3, health: 30, maxHealth: 40, magicka: 10, maxMagicka: 20, fatigue: 20 * 64, raceId: RACES.Breton,
  stats: { ...STATS }, skills: 20, career: {}, skillUses: { [SKILLS.Medical]: 0 }, activeEffects: [], items: [], equip: { slots: new Array(27).fill(null) },
});
const NOON = { climateIndex: 232, month: 6, hour: 12, weather: 'sunny', inSunlight: false, insideBuilding: true };
const sinksOf = (log) => ({ drainFatigue: (n) => log.push(['fatigue', n]), hurt: (n) => log.push(['hurt', n]), restoreFatigue: (n) => log.push(['restore', n]), say: (t) => log.push(['say', t]) });

test('AUDIT SURV A: the laws - a rough nap never raises the debt, wet armour rusts the real field, food ages from its own day, the drink is a small friend, the fed hour is an hour, spent gear refuses, a hood shades to nothing, the notes speak the strip\'s words', () => {
  // the rough floor holds from above and never lifts from below
  let e = player(); survivalOf(e, 1000).sleepDebt = 0;
  survivalMinute(e, 1001, { ...NOON, sleeping: 'rough', resting: true }, { sinks: sinksOf([]) });
  assert.equal(e.survival.sleepDebt, 0, 'a rested player napping rough stays rested');
  e.survival.sleepDebt = 10;
  for (let m = 0; m < 12 * 60; m++) survivalMinute(e, 2000 + m, { ...NOON, sleeping: 'rough', resting: true }, { sinks: sinksOf([]) });
  assert.equal(e.survival.sleepDebt, NEED.SLEEP_TIRED, 'a rough night pays down to tired and no further');
  // rust: the port's field, not a phantom
  e = player(); const cuirass = { name: 'Chain Cuirass', group: 'Armor', material: 0x0200, maxCondition: 100, currentCondition: 100 };
  const worn = new Array(27).fill(null); worn[EQUIP_SLOTS.ChestArmor ?? 18] = cuirass;
  survivalOf(e, 3000).wet = NEED.WET_WET;
  survivalMinute(e, 3001, { ...NOON, weather: 'rain', insideBuilding: false }, { worn, sinks: sinksOf([]), rolls: seq(0.01, 0) });
  assert.equal(cuirass.currentCondition, 99, 'the rust takes the condition the repairer reads');
  assert.equal(cuirass.condition, undefined, 'no phantom field');
  // rot: an item ages from the day it was first seen, not from the world's first day
  const bread = createSurvivalItem(TEMPLATE.Bread);
  assert.equal(rotFoodDay([[bread]], 200, seq(0.5)), 0, 'fresh bread on rot-day 200 keeps (roll 51 vs 95)');
  assert.equal(bread.rotDay, 200, 'stamped with its first day');
  assert.equal(rotFoodDay([[bread]], 200 + 2 * (FOOD[TEMPLATE.Bread].keeps + 10), seq(0.0)), 1, 'old enough, it turns even on the best roll');
  // the drink: a small friend that grows with the drink, never a +20
  const s = newSurvival(0); s.drunk = 30;
  assert.equal(survivalStatMods(s, { felt: 0, abs: 0 }, 0, { endurance: 50 }).personality, 1, 'just past half: +1');
  s.drunk = 80;
  const m80 = survivalStatMods(s, { felt: 0, abs: 0 }, 0, { endurance: 50 });
  assert.equal(m80.personality, 5, 'capped at five'); assert.equal(m80.agility, -5, 'and the drains still bite');
  // the fed hour: one point an hour of sitting fed, in minutes - not a burst of twenty
  e = player(); let log = [];
  survivalOf(e, 5000).lastAte = 4990;
  for (let m = 1; m <= 120; m++) survivalMinute(e, 5000 + m, NOON, { sinks: sinksOf(log) });
  assert.deepEqual(log.filter((l) => l[0] === 'restore'), [['restore', DRAIN.wellFed], ['restore', DRAIN.wellFed]], 'two hours fed: two points');
  // ...and a vampire banks nothing
  e = player(); e.survival = newSurvival(6000);
  for (let m = 1; m <= 30; m++) survivalMinute(e, 6000 + m, NOON, { sinks: sinksOf([]), ctx: { vampire: true } });
  assert.equal(e.survival.fed, 0, 'no negative tally on the record');
  // spent gear refuses the pitch
  const gear = createSurvivalItem(TEMPLATE.CampingEquipment, { condition: 1 });
  const flat = (o, d, m) => (d[1] < 0 && m >= o[1] ? o[1] : null);   // a floor at y = 0 under every probe (surv3's)
  const ctx = { now: 500, owner: 'p1', feet: [0, 1, 0], yaw: 0, probe: flat, place: {}, standing: 0, id: 'p1:1' };
  const first = placeCampItem(gear, [gear], ctx);
  assert.equal(first.ok, true); assert.equal(gear.currentCondition, 0);
  const again = placeCampItem(gear, [gear], { ...ctx, id: 'p1:2' });
  assert.equal(again.ok, false); assert.equal(again.text, CAMP_TEXT.wornOut, 'the fiftieth pitch was the last');
  // a drenched hood in strong sun shades to nothing, never below
  const hoodWorn = new Array(27).fill(null); hoodWorn[EQUIP_SLOTS.Cloak1] = { templateIndex: 154, variant: 2, group: 'MensClothing' };
  assert.ok(clothingWarmth(hoodWorn, { wet: 300, natural: 40, inSunlight: true }).warmth >= 0, 'never below nothing');
  assert.equal(HOOD_SHADE, 10);
  // bare feet cost fatigue, not blood; the harms that can kill come once every ten minutes and never in your sleep
  e = player(); log = [];
  const dressed = new Array(27).fill(null); dressed[17] = { templateIndex: 158, group: 'MensClothing' }; dressed[24] = { templateIndex: 151, group: 'MensClothing' };
  const desert = { ...NOON, climateIndex: 224, insideBuilding: false, inSunlight: false };
  survivalMinute(e, 7001, desert, { worn: dressed, sinks: sinksOf(log) });   // 7001: not a harm tick
  assert.ok(Math.abs(e.survival.felt) > 50, `a dressed desert noon is past DAMAGE_AT (${e.survival.felt})`);
  assert.equal(log.filter((l) => l[0] === 'hurt').length, 0, 'no blood between the harm ticks');
  assert.ok(log.some((l) => l[0] === 'fatigue' && l[1] === DRAIN.bareFeet), 'the bare feet drain fatigue');
  log = [];
  survivalMinute(e, 7010, desert, { worn: dressed, sinks: sinksOf(log) });   // a harm tick
  assert.ok(log.some((l) => l[0] === 'hurt'), 'the tenth minute hurts');
  log = [];
  survivalMinute(e, 7020, { ...desert, resting: true, sleeping: 'rough' }, { worn: dressed, sinks: sinksOf(log) });
  assert.equal(log.filter((l) => l[0] === 'hurt').length, 0, 'never in your sleep');
  assert.equal(log.some((l) => l[0] === 'fatigue' && l[1] === DRAIN.bareFeet), false, 'the bedroll covers the feet');
  // the temperature notes say the strip's words, keyed a word each
  e = player(); log = [];
  survivalMinute(e, 7000, { ...NOON, climateIndex: 224, month: 6, hour: 12, insideBuilding: false, inSunlight: true }, { worn: new Array(27).fill(null), sinks: sinksOf(log) });
  const word = temperatureWord(e.survival.felt);
  assert.ok(['hot', 'scorching'].includes(word), `a naked desert noon reads ${word}`);
  assert.ok(log.some((l) => l[1] === SURVIVAL_TEXT[word]), 'the note is the word\'s');
  assert.ok(Object.keys(e.survival.notes).some((k) => k === `temp:${word}`), 'keyed by the word, so an escalation speaks at once');
});

test('AUDIT SURV A/B: the minute marker - a span run under a rest is not run again by the frame; an alignment resets it; the mod off clears the stat entry', () => {
  const e = player(); const env = { ...NOON, insideBuilding: false, insideDungeon: true };
  runSurvivalMinutes(e, 1000, 1060, { ...env, sleeping: 'camp', resting: true }, { sinks: sinksOf([]) });
  assert.equal(e.survival.lastMinute, 1060, 'the record knows the last minute it paid');
  const thirst = e.survival.thirst;
  assert.equal(runSurvivalMinutes(e, 1000, 1060, env, { sinks: sinksOf([]) }), null, 'the same span again runs nothing');
  assert.equal(e.survival.thirst, thirst);
  runSurvivalMinutes(e, 1000, 1070, env, { sinks: sinksOf([]) });
  assert.equal(e.survival.lastMinute, 1070, 'and only the ten new minutes ran');
  alignSurvival(e, 5000, null);
  assert.equal(e.survival.lastMinute, 5000, 'an alignment restarts the marker at now');
  e.survival.lastMinute = 99999;
  runSurvivalMinutes(e, 5000, 5010, env, { sinks: sinksOf([]) });
  assert.equal(e.survival.lastMinute, 5010, 'a marker from a clock ahead of this one is re-anchored, not waited on');
  // the entry
  _resetForTests(); clearPreventRestConditions();
  const p = player();
  applySurvivalMods(p, { strength: -12 });
  assert.ok(p.activeEffects.some((a) => a.kind === 'survival'));
  clearSurvivalMods(p);
  assert.equal(p.activeEffects.some((a) => a.kind === 'survival'), false);
  applySurvivalMods(p, { strength: -12 });
  setPref('survival', false);
  setWorldMinutes(3 * 1440);
  createPlayerTicker(p, { say: () => {}, isInside: () => false, survivalEnv: () => NOON }).advance(10);
  assert.equal(p.activeEffects.some((a) => a.kind === 'survival'), false, 'the tick with no feed drops the drains the mod left');
  _resetForTests(); clearPreventRestConditions();
});

test('AUDIT SURV B/C: the rest gate - a host that does not own the mode answers nothing, a torn-down host leaves the seam, the dungeon unregisters its pair and the interior reader is the interior\'s', () => {
  clearPreventRestConditions();
  _resetForTests(); setPref('survival', 'hard');   // SURV-TIERS: the gate is Hard's
  const p = player(); p.survival = newSurvival(0); p.survival.felt = -100;
  let env = null;
  const pair = installSurvivalGate(registerPreventRestCondition, () => p, () => env);
  assert.equal(getPreventedRestMessage(), null, 'no env: this host does not own the mode');
  env = { byFire: false, insideBuilding: false };
  assert.equal(getPreventedRestMessage(), REST_TEXT_SURVIVAL.tooCold);
  uninstallSurvivalGate(pair, unregisterPreventRestCondition);
  assert.equal(getPreventedRestMessage(), null, 'gone with the host');
  const dc = read('src/scenes/dungeonContext.js'), modes = read('src/scenes/worldModes.js'), rest = read('src/systems/survival/rest.js');
  assert.match(dc, /const _survivalGate = installSurvivalGate\(registerPreventRestCondition, \(\) => playerEntity, survivalEnvNow\);/);
  assert.match(dc, /uninstallSurvivalGate\(_survivalGate, unregisterPreventRestCondition\);/, 'the teardown takes the pair off the seam');
  assert.match(modes, /survivalEnv: \(\) => \(mode === 'interior' && host\.survivalEnv \? \{ \.\.\.host\.survivalEnv\(\), insideBuilding: true/, 'the interior reader answers in the interior alone');
  assert.match(rest, /const e = readEnv\?\.\(\);\n\s+if \(!e \|\| !enabled\(\)\) return null;/, 'the gate reads null as silence');
  clearPreventRestConditions(); _resetForTests();
});

test('AUDIT SURV C: the hunt window - dropped from under, it closes without a search; Escape abandons the busy page; the result page is a click-anywhere box; the last dot is drawn; the beast stands only after a search', () => {
  _resetForTests();
  let closed = [], searched = 0;
  let w = new HuntWindow({ prompt: ['A?'], seconds: 2, onSearched: () => { searched++; return ['x']; }, onClosed: (s) => closed.push(s) });
  assert.equal(w.isChoiceWindow, true, 'the Yes/No page takes raw keys');
  w.input('KeyY'); w.tick(0.5);
  w.dispose();
  assert.equal(w.done, true); assert.deepEqual(closed, [false]); assert.equal(searched, 0, 'a death screen over the search: no search, no beast');
  closed = [];
  w = new HuntWindow({ prompt: ['A?'], seconds: 2, onSearched: () => { searched++; return ['x']; }, onClosed: (s) => closed.push(s) });
  w.input('KeyY'); w.tick(1); w.input('Escape');
  assert.equal(w.done, true); assert.deepEqual(closed, [false]); assert.equal(searched, 0, 'Escape walks away from the search, nothing charged');
  closed = [];
  w = new HuntWindow({ prompt: ['A?'], seconds: 1, onSearched: () => { searched++; return ['x']; }, onClosed: (s) => closed.push(s) });
  w.input('KeyY'); w.tick(1);
  assert.equal(w.phase, HUNT_PHASE.Result); assert.equal(w.isChoiceWindow, false, 'the result page goes through the action route like every click-anywhere box');
  assert.equal(searched, 1);
  w.click(0, 0); assert.deepEqual(closed, [true]);
  // the dots
  w = new HuntWindow({ prompt: ['A?'], seconds: 10, onSearched: () => [] });
  w.input('KeyY'); w.tick(9.99);
  assert.equal(w.dots.length, BUSY_DOTS, 'the row fills before the page turns');
  w = new HuntWindow({ prompt: ['A?'], seconds: 10, onSearched: () => [] });
  w.input('KeyY'); w.tick(5);
  assert.equal(w.dots.length, BUSY_DOTS / 2 + 1, 'halfway: the seventh dot is being drawn, not the sixth finished');
  w = new HuntWindow({ prompt: ['A?'], seconds: 10, onSearched: () => [] });
  w.input('KeyY'); w.tick(0.01);
  assert.equal(w.dots.length, 1);
  // composed: an external drop frees the slot for the next minute's roll; the beast only after a search
  const p = player(); const spawned = [], shown = [];
  const e = { minute: 600, luck: 50, winter: false, outdoors: true, inLocationRect: false, night: false, enemiesNear: false, resting: false, climateIndex: 232, hasBow: false, skills: {} };
  const h = createHunting({ entity: p, env: () => e, rolls: () => 0, showOverlay: (x) => shown.push(x), spawnBeast: (b) => spawned.push(b) });
  const w1 = h.tick(); assert.ok(w1);
  w1.input('KeyY'); w1.dispose();
  assert.equal(h.window, null, 'the slot is free'); assert.deepEqual(spawned, [], 'no search, no beast');
  p.survival.huntAt = 0; e.minute += 1;
  assert.ok(h.tick(), 'the next minute rolls again');
});

test('AUDIT SURV C/D: the tavern - the divider keeps the picker; before six the kitchen refuses in the mod\'s two words and the drinks still pour; breakfast runs to ten', () => {
  assert.equal(breakfastHours(10), true, 'ten is breakfast (the mod\'s hour <= 10)');
  assert.equal(breakfastHours(11), false);
  let m = tavernMenu({ climateIndex: 232, quality: 5, hour: 5 });
  assert.equal(m.closed, true); assert.equal(m.closedText, TAVERN_MENU_TEXT.closed, 'five: breakfast starts at dawn');
  assert.equal(m.rows.filter((r) => r.kind === 'food').length, 0); assert.ok(m.rows.some((r) => r.kind === 'drink'), 'the drinks stand');
  m = tavernMenu({ climateIndex: 232, quality: 5, hour: 2 });
  assert.equal(m.closed, true); assert.equal(m.closedText, TAVERN_MENU_TEXT.closedNight, 'two: the kitchen is closed for the night');
  assert.equal(m.rows.filter((r) => r.kind === 'food').length, 0);
  assert.equal(tavernMenu({ climateIndex: 232, quality: 5, hour: 6 }).closed, false);
  const mk = (now) => {
    const entity = { name: 'Mac', goldPieces: 500, health: 20, maxHealth: 40, stats: { endurance: 50 }, rentedRooms: [], items: [], activeEffects: [], lastTimePlayerAteOrDrankAtTavern: 0, survival: newSurvival(now - 600) };
    const w = new TavernWindow({
      entity, rows: (id) => [{ text: `r${id}`, center: true }], now: () => now, mapId: () => 1, buildingKey: () => 2, buildingName: () => 'The Lamp',
      quality: () => 10, bedCount: () => 2, freeRooms: () => false, skills: () => ({ mercantile: 50, personality: 50 }),
      heal: () => {}, onTalk: () => {}, onClose: () => {}, rolls: () => 0.5, climateIndex: () => 232, advanceMinutes: () => {}, endurance: () => 50,
    });
    return { w, entity };
  };
  let t = mk(3 * 1440 + 12 * 60);
  t.w._food();
  const items = t.w.flow.top.picker; const header = items.indexOf(TAVERN_MENU_TEXT.drinksHeader);
  assert.ok(header > 0);
  t.w.flow.top.onPick(header);
  assert.equal(t.w.flow.done, false, 'the divider is not a door out'); assert.ok(t.w.flow.top?.picker, 'the picker stands');
  assert.equal(t.entity.goldPieces, 500, 'and charges nothing');
  t = mk(3 * 1440 + 5 * 60);
  t.w._food();
  assert.deepEqual(t.w.flow.top.rows, [{ text: TAVERN_MENU_TEXT.closed, center: true }], 'the refusal first');
  t.w.flow.input('Enter');
  assert.ok(t.w.flow.top?.picker, 'then the drinks');
  assert.equal(t.w.flow.top.picker.some((x) => /Cheesecake|Stew|Bread/.test(x)), false, 'no dish before six');
});

test('AUDIT SURV C: what the player is told - a vampire\'s strip has no hunger or sleep chip, the drunk chip keeps the page\'s bands, the enhanced card carries the survival tokens, an empty strip costs no room, the weight word is DFU\'s', () => {
  const e = player(); e.survival = newSurvival(0); e.survival.lastAte = -100000; e.survival.sleepDebt = 20; e.survival.thirst = 50;
  const now = 0;
  const plain = survivalHudChips(e, now).map((c) => c.key);
  assert.ok(plain.includes('hunger') && plain.includes('sleep') && plain.includes('thirst'));
  const vamp = survivalHudChips(e, now, { vampire: true }).map((c) => c.key);
  assert.ok(!vamp.includes('hunger') && !vamp.includes('sleep'), 'no need for food or sleep'); assert.ok(vamp.includes('thirst'));
  e.survival.drunk = 10;
  assert.equal(survivalHudChips(e, now, { endurance: 50 }).find((c) => c.key === 'drunk'), undefined, 'one ale at endurance 50 is no chip - the page says nothing either');
  e.survival.drunk = 30;
  assert.equal(survivalHudChips(e, now, { endurance: 50 }).find((c) => c.key === 'drunk').text, 'Drunk');
  assert.equal(survivalHudChips(e, now, { endurance: 90 }).find((c) => c.key === 'drunk'), undefined, 'endurance 90 holds thirty');
  e.survival.drunk = 46;
  assert.equal(survivalHudChips(e, now, { endurance: 50 }).find((c) => c.key === 'drunk').text, 'Very drunk');
  assert.equal(survivalHudChips(e, now, { endurance: 90 }).find((c) => c.key === 'drunk').text, 'Drunk', 'endurance 90: past half, not past eighty');
  // the enhanced card
  const skin = createSurvivalItem(TEMPLATE.Waterskin, { water: 1.5 });
  const line = itemLine(skin);
  assert.ok(Array.isArray(line.survival) && line.survival.some((t) => /1\.5/.test(t)), 'the card carries the skin\'s water');
  assert.equal(itemLine({ templateIndex: 1, group: 0, name: 'Dagger' }).survival, null, 'and nothing on a dagger');
  assert.match(survivalInfoTokens(skin).map((r) => r.text).join('\n'), /Weight: [0-9.]+ kilograms/, 'DFU\'s word, shortened by the panel alone');
  assert.equal(isSurvivalItem(skin), true);
  assert.match(ENHANCED_CSS, /\.hud-needs:empty\s*\{\s*display:\s*none;?\s*\}/, 'no gap for an empty strip');
  const hud = read('src/ui/enhancedHud.js');
  assert.match(hud, /survivalHudChips\(vitals, Math\.floor\(worldMinutes\(\)\), \{ vampire: !!liveVampirism\(vitals\), endurance: liveStat\(vitals, 'endurance'\) \}\)/);
  // Mac (review): "Hide wear for non wearables. Same for use for non-usables"
  const wearer = { equip: null, activeEffects: [] };
  assert.equal(localPrimaryAct(skin, wearer), null, 'no slot takes a waterskin: no Wear');
  assert.equal(localPrimaryAct(createSurvivalItem(TEMPLATE.RawMeat), null), null, 'nor a raw meat, wearer or none');
  assert.deepEqual(localPrimaryAct({ group: 'Weapons', templateIndex: 113, name: 'Dagger' }, wearer), { kind: 'wear', label: 'Wear' }, 'a dagger is worn');
  assert.deepEqual(localPrimaryAct({ group: 'MensClothing', templateIndex: 158 }, null), { kind: 'wear', label: 'Wear' }, 'a shirt is worn');
  assert.equal(usableItem(skin), true); assert.equal(usableItem(createSurvivalItem(TEMPLATE.Rations)), true);
  assert.equal(usableItem({ group: 'Books', templateIndex: 0 }), true); assert.equal(usableItem({ group: 'Drugs', templateIndex: 0 }), true, 'a drug');
  assert.equal(usableItem({ group: 'Weapons', templateIndex: 113 }), false, 'a dagger has no use arm');
  assert.equal(usableItem({ group: 'Armor', templateIndex: 102 }), false); assert.equal(usableItem({ group: 'Gems', templateIndex: 0 }), false);
  assert.equal(usableItem({ group: 'Weapons', templateIndex: 113, questItem: true }), true, 'a quest item is watched');
  assert.equal(usableItem(null), false);
  const invSrc = read('src/ui/enhancedInventory.js');
  assert.match(invSrc, /if \(getEquipSlot\(entity \?\? \{\}, item\) === EQUIP_SLOTS\.None\) return null;/, 'the card asks the equip table');
  assert.match(invSrc, /if \(act\) \{   \/\/ null: nothing would wear it/, 'no button without an act');
  assert.match(invSrc, /if \(usableItem\(picked\)\) \{\n\s+u\.onclick/, 'Use only where the law has an arm');
});

test('AUDIT SURV B: the camps - the sweep spares them and the scene cache carries none, an empty word reaches the cell, a restore merges by id, Off keeps them, sees only another player\'s and uses none; the dungeon rest pays its night asleep; the clock correction re-aligns', async () => {
  const world = read('src/scenes/world.js'), dc = read('src/scenes/dungeonContext.js'), campsSrc = read('src/scenes/camps.js');
  assert.doesNotMatch(world, /camps\.collectPixel\(key\)/, 'a placed camp is not a dropped pile: the streaming sweep leaves it');
  assert.doesNotMatch(world, /camps: camps\.snapshot\(\(pos\) => \{ const wc = state\.worldCoords\(pos\); return \[wc\.x, pos\[1\] - state\.compensation\[1\], wc\.z\]; \}\),   \/\/ SURV3: my camps, in natives\n\s+\}\);\n\s+\}\n\s+function restoreExteriorScene|camps\.restore\(arrived\.camps/, 'the scene cache carries no camps - the pool is the truth');
  assert.match(world, /if \(cell && full\) frame\.c = camps\.wireRecords\(campToWire\);/, 'an empty list says "none stand"');
  assert.match(world, /if \(Math\.abs\(offsetMs - was\) > 1000\) \{ onlineArrival\(\); alignSurvival\(playerEntity, Math\.floor\(worldMinutes\(\)\), Math\.floor\(worldMinutes\(\)\)\); \}/, 'a clock correction re-aligns the needs');
  assert.match(dc, /const feed = survivalFeed\(playerEntity, survivalEnvNow\(\), \{ say: \(msg\) => hudText\.add\(msg\) \}\);\n\s+if \(feed\) runSurvivalMinutes\(playerEntity, start, Math\.floor\(end\), feed\.env, \{ \.\.\.feed\.deps, sinks: playerSinks, rolls: Math\.random \}\);/, 'the dungeon rest pays its night asleep, under the window');
  // AUDIT SURV-TIERS: the pool REFUSED a restore and a peer's word with the arc off, so a save made Off lost every
  // camp and an Off host dropped its peers' camps from the room it passes on. Off hides; it does not burn.
  assert.doesNotMatch(campsSrc, /if \(!survivalOn\(\)\) return null;/, 'Off refuses no record');
  // the merge
  const { createCamps, FIRE_LIGHT_UP } = await import('../src/scenes/camps.js');
  const { TENT_MODEL, FIRE_LIGHT_RANGE } = await import('../src/systems/survival/camp.js');
  const entity = player(); const renderer = { gl: null };
  const pool = createCamps({
    renderer, getTexture: async () => ({ getFrameCount: () => 3, getSize: () => ({ width: 40, height: 40 }) }), uploadRecordFrame: () => {},
    meshes: { getGpuMesh: async () => ({ gpu: true }), cpuModels: new Map([[TENT_MODEL, { positions: [-1, 0, -1, 1, 2, 1] }]]) }, entity,
    camera: () => ({ feet: [0, 0, 0], yaw: 0 }), collider: () => null, place: () => ({}), pixelKeyAt: () => 'px', say: () => {}, selfId: () => 'me',
  });
  const list = [{ id: 'me:1', kind: 'fire', pos: [1, 0, 1], yaw: 0, litUntil: 500, wear: 0, placedAt: 0 }, { id: 'me:2', kind: 'tent', pos: [5, 0, 1], yaw: 0, litUntil: 500, wear: 3, placedAt: 0 }];
  pool.restore(list); pool.restore(list);
  assert.equal(pool.camps.length, 2, 'a second restore of the same records stands no twins');
  pool.restore([{ id: 'me:3', kind: 'fire', pos: [9, 0, 1], yaw: 0, litUntil: 500, wear: 0, placedAt: 0 }]);
  assert.equal(pool.camps.length, 3, 'and a new record joins the standing ones');
  setWorldMinutes(100);
  await new Promise((r) => setTimeout(r, 0));   // the tent's mesh is up
  const tents = () => pool.draw({ drawMesh: () => {} });
  assert.deepEqual([pool.byFire([1, 0, 1]), tents()], [true, 1], 'on, the fire warms and the tent stands');
  _resetForTests(); setPref('survival', false);
  pool.restore([{ id: 'me:4', kind: 'fire', pos: [9, 0, 9], yaw: 0, litUntil: 500, wear: 0, placedAt: 0 }]);
  assert.equal(pool.camps.length, 4, 'Off: the save\'s camp is kept');
  assert.equal(pool.snapshot().length, 4, '...and the next save still carries it');
  assert.equal(pool.applyOwner('peer', [{ i: 'p:1', k: 1, p: [20, 0, 20], y: 0, u: 500, w: 0 }]), true, 'a peer\'s word lands too');
  assert.equal(pool.camps.length, 5);
  // SURV-OFFSIGHT (Mac: "really only being able to see other people's campfires makes sense"): Off SEES another
  // player's camp and uses none of any; its own stay out of sight
  assert.deepEqual([pool.targets(), pool.lights(), pool.batches(), tents()], [[], [{ x: 20, y: FIRE_LIGHT_UP, z: 20, range: FIRE_LIGHT_RANGE }], [], 0],
    'no ray; of the lights, the peer\'s fire\'s alone - its own fires and its own tent are out of sight (this pool mounts no flame)');
  assert.deepEqual([pool.byFire([1, 0, 1]), pool.byFire([20, 0, 20])], [false, false], 'no warmth and no camp\'s rest for this player, by its own fire or the peer\'s');
  assert.deepEqual([pool.hoverName('camp:me:1'), pool.hoverName('camp:p:1')], [null, null], 'no name');
  assert.deepEqual([pool.activate('camp:me:1', 'info'), pool.activate('camp:p:1', 'info')], [false, false], 'no menu');
  assert.equal(pool.fireNear([1, 0, 1]), true, 'the world still has the fire - the rest\'s PLACE reads it (shared.js createRestDeps)');
  const said = [];
  const off = createCamps({ entity, camera: () => ({ feet: [0, 0, 0], yaw: 0 }), say: (l) => said.push(l) });
  assert.equal(off.placeItem(createSurvivalItem(TEMPLATE.Campfire), [createSurvivalItem(TEMPLATE.Campfire)]), false, 'Off stands no new camp');
  assert.deepEqual([said, off.camps.length], [[CAMP_TEXT.arcOff], 0], '...and says what would change that (CAMP-SILENT)');
  _resetForTests();
  assert.deepEqual([pool.byFire([1, 0, 1]), pool.byFire([20, 0, 20]), tents()], [true, true, 1], 'on again, every kept camp is back where it was');
  setWorldMinutes(0);
});

test('AUDIT SURV D: the save carries the record - the markers and the cooldown round-trip, the notes do not', () => {
  const e = { ...player(), skillUses: [] }; e.survival = { ...newSurvival(1000), lastAte: 900, thirst: 33, huntAt: 4321, notes: { 'hunger:peckish': 'on' } };
  const snap = snapshotPlayer(e, { classicMinutes: 1000 });
  assert.equal(snap.survival.lastAte, 900); assert.equal(snap.survival.huntAt, 4321); assert.equal(snap.survival.notes, undefined);
  const back = { ...player(), skillUses: [] };
  restorePlayer(back, JSON.parse(JSON.stringify(snap)));
  assert.equal(back.survival.lastAte, 900); assert.equal(back.survival.thirst, 33); assert.equal(back.survival.huntAt, 4321);
  assert.deepEqual(back.survival.notes, {});
  const none = { ...player(), skillUses: [] }; restorePlayer(none, JSON.parse(JSON.stringify(snapshotPlayer({ ...player(), skillUses: [] }, { classicMinutes: 1 }))));
  assert.equal(none.survival, null, 'a pre-arc save starts fresh at the first tick');
  // AUDIT SURV E: the kit reaches the character chargen makes
  _resetForTests();
  const born = { items: [], gender: 'male', stats: { ...STATS }, career: {}, activeEffects: [] };
  assignStartingGear(born, { classIndex: 0, rolls: () => 0.5 });
  assert.ok(born.items.some((i) => isSurvivalItem(i) && i.templateIndex === TEMPLATE.Waterskin), 'a waterskin in the chargen kit');
  assert.ok(born.items.some((i) => i.templateIndex === TEMPLATE.Rations) && born.items.some((i) => i.templateIndex === TEMPLATE.Campfire), 'rations and a fire kit');
  setPref('survival', false);
  const bare = { items: [], gender: 'male', stats: { ...STATS }, career: {}, activeEffects: [] };
  assignStartingGear(bare, { classIndex: 0, rolls: () => 0.5 });
  assert.equal(bare.items.some((i) => isSurvivalItem(i)), false, 'the mod off: DFU\'s kit alone');
  _resetForTests();
  assert.equal(MOBILE_TYPES.GrizzlyBear, 4);
});
