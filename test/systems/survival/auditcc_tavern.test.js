import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  tavernMenu, tavernEat, tavernOrder, tavernDrink, blackout, blackoutWaking, mealHunger, regionMenuDay, menuKeyFor, menuTier,
  MENU_KEY_BY_REGION, MENU_KEY_BY_CLIMATE, TAVERN_DISHES, FOOD_MENUS, BREAKFAST_MENUS, TAVERN_DRINKS, DRINK_MENUS, DRINK_ALCOHOL, MEAL_WORTH,
  TAVERN_MENU_TEXT,
} from '../../../src/systems/survival/tavernMenu.js';
import { newSurvival, hungerStage } from '../../../src/systems/survival/needs.js';
import { SURVIVAL_RULES } from '../../../src/systems/survival/difficulty.js';
import { SURVIVAL_PREF } from '../../../src/systems/survival/switch.js';
import { STIFF_HOURS } from '../../../src/systems/survival/rest.js';
import { applyCharacter } from '../../../src/systems/chargen.js';
import { liveStat } from '../../../src/systems/statMods.js';
import { createPlayerTicker } from '../../../src/scenes/shared.js';
import { setSharedClock, setWorldMinutes, setOwnMinutes, ownMinutes, skyMinutes, alignEntityClocks, resetMagicRoundMarker } from '../../../src/systems/worldTick.js';
import { TavernWindow } from '../../../src/ui/tavernWindow.js';
import { mountEnhancedTavern } from '../../../src/ui/enhanced/enhancedTavern.js';
import { setPref, _resetForTests } from '../../../src/systems/uiPrefs.js';
import { CLIMATES, REGION_NAMES } from '../../../src/formats/mapsFile.js';
import { withDom } from '../../invdrag.mjs';

// ═══ AUDIT C&C (2026-10-12): THE TAVERN - I3, I4, I6, I8 ═══
//
// The owner: "Make the best decisions. DO a comprehensive audit on everything ensuring perfection". Lens I (the items,
// the food, the camps, the fires and the tavern) read the tavern against the mod's own source (Ralzar's Climates &
// Calories, TavernWindow.cs - public, every revision to 1.7.0; SURV5 had read 1.7.1's IL):
//   I3 - a "too full" meal was read BEFORE its half hour: charged, its half hour taken, nothing fed (Hard), and the
//        kitchen refused (Casual, Boons) meals the mod serves whole. TavernFood passes the half hour first.
//   I4 - online the blackout's night ran to six on the CHARACTER's clock (LIVED1 split it from the world's), and said
//        "at dawn" under any sky. It runs to the SKY's six now, and says dawn only under a dawn sky.
//   I6 - "The drink fortifies you." was said for every drink under half the endurance, milk included, and nothing was
//        fortified. TavernDrink's alcohol is fatigue and magicka now; a soft drink refreshes, five fatigue.
//   I8 - the menus were the mod's dishes sorted into a structure the mod does not have. The decision: its own -
//        regionMenuDay (the region, then its climate fallback), DoFood (breakfast by tier), DoDrinks, the quality bands,
//        every meal worth 240, the drinks' alcohol by place and the holidays' free drinks.
// Every pin drives the real producers - the law, both tavern windows on a character the chargen mints, and for the
// night the real clocks (worldTick) and ticker wired as worldModes.js openTavern wires them. The numbers are LITERALS
// (A PIN MUST FAIL).

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
afterEach(() => { _resetForTests(); setSharedClock(null); setWorldMinutes(0); });

const STATS = Object.freeze({ strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 });
const CAREER = Object.freeze({
  name: 'Spellsword', hitPointsPerLevel: 10, advancementMultiplier: 1, ...STATS, abilityFlagsAndSpellPointsBitfield: 0x1000,
  primarySkills: [], majorSkills: [], minorSkills: [],
});
/** A character the chargen mints (applyCharacter: maxMagicka 50 off Intelligence 50, the pool (50 + 50) x 64 = 6400),
 *  with a purse of 100, a pack, and a record standing at `now`. */
const guest = (now, extra = {}) => Object.assign(
  applyCharacter({ isPlayer: true, activeEffects: [], items: [], rentedRooms: [] }, CAREER, 0, { stats: { ...STATS }, skills: new Array(35).fill(30), rolls: () => 0.5 }),
  { goldPieces: 100, lastTimePlayerAteOrDrankAtTavern: 0, survival: newSurvival(now) }, extra,
);
/** The tavern's hooks as worldModes.js openTavern wires them - the room's and the needs' clock the character's own
 *  (`now`), the calendar's, the kitchen's and the night's the sky's (`worldNow`), PlayerGPS's region and climate, this
 *  host's minutes, the live endurance. */
const hooksFor = (entity, { region = -1, climate = CLIMATES.Woodlands, quality = 10, now, worldNow, advance }) => ({
  entity, rows: (id) => [{ text: `r${id}`, center: true }], now, worldNow, mapId: () => 1, buildingKey: () => 2, buildingName: () => 'The Lamp',
  quality: () => quality, bedCount: () => 2, freeRooms: () => false, skills: () => ({ mercantile: 50, personality: 50 }),
  heal: () => {}, rolls: () => 0.5, regionIndex: () => region, climateIndex: () => climate, advanceMinutes: advance,
  endurance: () => liveStat(entity, 'endurance'), onTalk: () => {}, onClose: () => {},
});
/** Offline, the one clock - a stand-in whose minutes the window's advances move (the needs left to their own pins). */
const oneClock = (at) => {
  const c = { t: at, passed: [] };
  return { c, now: () => c.t, worldNow: () => c.t, advance: (n) => { c.passed.push(n); c.t += n; } };
};
/** The REAL clocks and ticker: offline the one world clock; online the world's (the sky) and the character's own. */
const realClocks = (entity, { own, sky = null }) => {
  if (sky == null) { setSharedClock(null); setWorldMinutes(own); } else { setSharedClock(() => sky); setOwnMinutes(own); alignEntityClocks(entity, sky); }
  entity.lastGameMinutes = own;
  resetMagicRoundMarker(own);
  const ticker = createPlayerTicker(entity, { say: () => {}, isInside: () => true });
  return { now: () => Math.floor(ownMinutes()), worldNow: () => Math.floor(skyMinutes()), advance: (n) => ticker.advance(n) };
};
/** The classic window's survival picker: its rows, and what one pick says (before six the kitchen's words come first,
 *  dismissed, and the drinks follow them - AUDIT SURV C/D). */
const classicPick = (hooks, pick) => {
  const w = new TavernWindow(hooks);
  w._food();
  if (!w.flow.top.picker) w.flow.input('Enter');
  const picker = w.flow.top.picker;
  const i = picker.findIndex((t) => pick.test(t));
  assert.ok(i >= 0, `the picker offers ${pick}`);
  return { picker, said: w.flow.top.onPick(i)?.[0]?.rows?.map((r) => r.text) };
};
/** The enhanced window, driven through a fake document: its rows' names, and the words a pick says. */
const enhancedPick = (hooks, name) => {
  const hadLoc = Object.hasOwn(globalThis, 'location'), loc = globalThis.location;
  globalThis.location = { search: '?skin=classic' };   // the CARD arm: the said line lands in the document (AUDIT ENH-NOTICE3 B19)
  try {
    return withDom((dom) => {
      const host = dom.mk('div'); dom.body.append(host);
      const view = mountEnhancedTavern(host, { ...hooks, onExit: () => {} });
      const text = (n) => (n.textContent || '') + n.children.map(text).join(' ');
      dom.doc.querySelectorAll('.tavern-act').find((b) => b.textContent === 'Food & drink').onclick();
      const rows = dom.doc.querySelectorAll('.tavern-row').map(text);
      const row = dom.doc.querySelectorAll('.tavern-row').find((r) => text(r).includes(name));
      assert.ok(row, `the enhanced menu offers ${name}`);
      row.onclick();
      const said = dom.doc.querySelectorAll('.px-note').map((n) => n.textContent);
      view?.unmount?.();
      return { rows, said };
    });
  } finally {
    if (hadLoc) globalThis.location = loc; else delete globalThis.location;
  }
};
const NOON = 1440 * 10 + 13 * 60;   // a day's 13:00 - the kitchen open, no breakfast
const DAGGERFALL = REGION_NAMES.indexOf('Daggerfall'), SENTINEL = REGION_NAMES.indexOf('Sentinel'), BALFIERA = REGION_NAMES.indexOf('Isle of Balfiera'), ORSINIUM = REGION_NAMES.indexOf('Orsinium Area');
const food = (m) => m.rows.filter((r) => r.kind === 'food').map((r) => `${r.name} ${r.price}`);
const drinks = (m) => m.rows.filter((r) => r.kind === 'drink').map((r) => `${r.name} ${r.price}/${r.strength}`);

test('AUDIT C&C I3: THE MEAL IS EATEN AT ITS END - TavernFood passes the half hour first: a meal 239 minutes after the last is served whole, a too-full one is charged and wasted and the eater leaves fed, and the kitchen of the tiers that refuse asks the same moment - through both windows (mutants: the hunger read before the half hour; the meal ends at the order; the too-full eater leaves hungry; the kitchen reads the order\'s minute)', () => {
  const ago = (n) => ({ ...newSurvival(1000), lastAte: 1000 - n });
  assert.equal(mealHunger(ago(209), 1000), 239);
  assert.equal(mealHunger(ago(210), 1000), 240);
  let s = ago(239);
  assert.deepEqual(tavernEat(s, 1000, 240), { ok: true, text: TAVERN_MENU_TEXT.invigorated, minutes: 30 });
  assert.equal(s.lastAte, 1001, 'served whole: 269 at the meal\'s end, the worth banked - 29 left at 1030');
  s = ago(100);
  assert.deepEqual(tavernEat(s, 1000, 240), { ok: false, text: TAVERN_MENU_TEXT.tooFull, minutes: 30 });
  assert.equal(s.lastAte, 1030, 'too full: the rest goes to waste, and the eater leaves fed - the marker at the meal\'s end');
  s = ago(600);
  tavernEat(s, 1000, 240);
  assert.equal(s.lastAte, 1030, 'past worth + 240: four hours back of the meal\'s end, the worth banked');
  // the classic window, Hard, 13:00 - a North high table's 22-gold Salmon Steak Supreme (worth 240), the audit's case
  setPref(SURVIVAL_PREF, 'hard');
  for (const [after, said, hunger] of [[239, TAVERN_MENU_TEXT.invigorated, 29], [100, TAVERN_MENU_TEXT.tooFull, 0]]) {
    const e = guest(NOON); e.survival.lastAte = NOON - after;
    const clock = oneClock(NOON);
    assert.deepEqual(classicPick(hooksFor(e, { region: DAGGERFALL, quality: 15, ...clock }), /Salmon Steak Supreme/).said, [said]);
    assert.deepEqual([e.goldPieces, clock.c.passed, clock.c.t - e.survival.lastAte], [78, [30], hunger], `${after} minutes after a meal`);
    assert.equal(hungerStage(clock.c.t - e.survival.lastAte), 'fed', 'the eater leaves fed (it left Peckish at 269)');
  }
  // Casual and Boons: the kitchen asks the meal's end too - at 210 the mod's meal is served whole, at 209 refused before the coin
  for (const tier of ['casual', 'boons']) {
    setPref(SURVIVAL_PREF, tier);
    for (const [after, said, gold, passed] of [[210, TAVERN_MENU_TEXT.invigorated, 78, [30]], [209, TAVERN_MENU_TEXT.fullForMeal, 100, []]]) {
      const e = guest(NOON); e.survival.lastAte = NOON - after;
      const clock = oneClock(NOON);
      assert.deepEqual(classicPick(hooksFor(e, { region: DAGGERFALL, quality: 15, ...clock }), /Salmon Steak Supreme/).said, [said], `${tier}, ${after}`);
      assert.deepEqual([e.goldPieces, clock.c.passed], [gold, passed], `${tier}, ${after}: the coin and the half hour`);
    }
    assert.deepEqual(tavernOrder(ago(209), 1000, { kind: 'food', worth: 240, price: 22 }, { rules: SURVIVAL_RULES[tier] }), { ok: false, text: TAVERN_MENU_TEXT.fullForMeal });
    assert.deepEqual(tavernOrder(ago(210), 1000, { kind: 'food', worth: 240, price: 22 }, { rules: SURVIVAL_RULES[tier] }), { ok: true });
  }
  // the enhanced window: the same law, Hard and Casual
  setPref(SURVIVAL_PREF, 'hard');
  {
    const e = guest(NOON); e.survival.lastAte = NOON - 100;
    const clock = oneClock(NOON);
    assert.ok(enhancedPick(hooksFor(e, { region: DAGGERFALL, quality: 15, ...clock }), 'Salmon Steak Supreme').said.includes(TAVERN_MENU_TEXT.tooFull));
    assert.deepEqual([e.goldPieces, clock.c.passed, clock.c.t - e.survival.lastAte], [78, [30], 0], 'the enhanced too-full meal leaves the eater fed');
  }
  setPref(SURVIVAL_PREF, 'casual');
  {
    const e = guest(NOON); e.survival.lastAte = NOON - 210;
    const clock = oneClock(NOON);
    assert.ok(enhancedPick(hooksFor(e, { region: DAGGERFALL, quality: 15, ...clock }), 'Salmon Steak Supreme').said.includes(TAVERN_MENU_TEXT.invigorated));
    assert.deepEqual([e.goldPieces, clock.c.passed, clock.c.t - e.survival.lastAte], [78, [30], 0], 'Casual\'s enhanced kitchen serves 210 whole');
  }
});

test('AUDIT C&C I4: THE BLACKOUT\'S NIGHT IS THE SKY\'S - online it ran to six on the character\'s own clock and said dawn under a noon sky; it runs to the sky\'s next six and says dawn only under a dawn sky, on the real clocks; offline exactly as it was (mutants: the night on the character\'s clock, both windows; dawn said under any sky, both windows; the waking line never changes; six o\'clock itself not a whole night)', () => {
  const D = 1440 * 50;
  assert.deepEqual([23 * 60, 5 * 60 + 30, 6 * 60, 6 * 60 + 15, 12 * 60].map((m) => blackout({}, D + m, { endurance: 50 }).minutes), [420, 30, 1440, 1425, 1080], 'the minutes from the sky\'s minute to its next six');
  const s = { drunk: 60 };
  blackout(s, D, { endurance: 50 });
  assert.equal(s.drunk, 12, 'and the hangover\'s worth, as ever');
  assert.deepEqual([6 * 60, 6 * 60 + 59, 5 * 60 + 59, 7 * 60, 12 * 60].map((m) => blackoutWaking(D + m)),
    [TAVERN_MENU_TEXT.woke, TAVERN_MENU_TEXT.woke, TAVERN_MENU_TEXT.wokeNoDawn, TAVERN_MENU_TEXT.wokeNoDawn, TAVERN_MENU_TEXT.wokeNoDawn]);
  setPref(SURVIVAL_PREF, 'hard');
  const SKY = D + 12 * 60;   // the world's sky at noon
  // ONLINE, the classic window: whatever the character's own clock reads, the night is the noon sky's - eighteen hours -
  // and they wake under a noon sky (at their own 11:45 the own clock alone would have read six at the waking)
  for (const own of [5 * 60 + 30, 6 * 60 + 15, 11 * 60 + 45, 23 * 60]) {
    const own0 = 1440 * 10 + own;
    const e = guest(own0); e.survival.drunk = 30;
    const clocks = realClocks(e, { own: own0, sky: SKY });
    assert.deepEqual(classicPick(hooksFor(e, { quality: 10, ...clocks }), /Rye Liquor/).said, [TAVERN_MENU_TEXT.blackout, TAVERN_MENU_TEXT.wokeNoDawn], `own ${own}`);
    assert.equal(Math.floor(ownMinutes()) - own0, 15 + 1080, `own ${own}: the quarter hour and the noon sky's night (it had passed 30, 1425 and 420)`);
    assert.equal(Math.floor(skyMinutes()), SKY, 'the sky stood');
    assert.equal(e.survival.stiffUntil, own0 + 15 + 1080 + STIFF_HOURS * 60, 'the rough morning, on the character\'s own clock');
  }
  // online under a dawn sky (06:20 - the night to the next six), the waking is at dawn
  {
    const own0 = 1440 * 10 + 23 * 60, sky = D + 6 * 60 + 20;
    const e = guest(own0); e.survival.drunk = 30;
    const clocks = realClocks(e, { own: own0, sky });
    assert.deepEqual(classicPick(hooksFor(e, { quality: 10, ...clocks }), /Rye Liquor/).said, [TAVERN_MENU_TEXT.blackout, TAVERN_MENU_TEXT.woke]);
    assert.equal(Math.floor(ownMinutes()) - own0, 15 + 1420);
  }
  // OFFLINE, exactly as it was: the one clock, the quarter hour on it, the night to six, at dawn
  {
    const at = 1440 * 10 + 23 * 60;
    const e = guest(at); e.survival.drunk = 30;
    const clocks = realClocks(e, { own: at });
    assert.deepEqual(classicPick(hooksFor(e, { quality: 10, ...clocks }), /Rye Liquor/).said, [TAVERN_MENU_TEXT.blackout, TAVERN_MENU_TEXT.woke]);
    assert.deepEqual([Math.floor(ownMinutes()), Math.floor(skyMinutes())], [1440 * 11 + 6 * 60, 1440 * 11 + 6 * 60], 'to six the next morning');
    assert.equal(e.survival.stiffUntil, 1440 * 11 + 6 * 60 + STIFF_HOURS * 60);
  }
  // and a fall at the sky's six on the dot sleeps the whole day round to the next, offline
  {
    const at = 1440 * 10 + 5 * 60 + 45;   // the drink's quarter hour lands on six
    const e = guest(at); e.survival.drunk = 30;
    const clocks = realClocks(e, { own: at });
    classicPick(hooksFor(e, { quality: 10, ...clocks }), /Rye Liquor/);
    assert.equal(Math.floor(ownMinutes()), 1440 * 11 + 6 * 60);
  }
  // ONLINE, the enhanced window: the same night, the same words
  for (const own of [11 * 60 + 45, 23 * 60]) {
    const own0 = 1440 * 10 + own;
    const e = guest(own0); e.survival.drunk = 30;
    const clocks = realClocks(e, { own: own0, sky: SKY });
    const { said } = enhancedPick(hooksFor(e, { quality: 10, ...clocks }), 'Rye Liquor');
    assert.ok(said.includes(TAVERN_MENU_TEXT.wokeNoDawn) && !said.includes(TAVERN_MENU_TEXT.woke), `the enhanced waking under a noon sky (own ${own})`);
    assert.equal(Math.floor(ownMinutes()) - own0, 15 + 1080);
  }
});

test('AUDIT C&C I6: THE DRINK DOES WHAT IT SAYS - under half the endurance a drink with alcohol fortifies (its alcohol in fatigue points and in magicka) and a soft one refreshes (five fatigue), up to each pool, in every tier and both windows; past half it only makes you drunk (mutants: the milk fortifies; the soft drink gives nothing; the fatigue in the pool\'s raw units; no magicka; either past its pool; the drink fortifies nothing, both windows; the drink before its quarter hour, both windows)', () => {
  assert.deepEqual(tavernDrink({ ...newSurvival(0), drunk: 0 }, 0, { endurance: 50 }), { text: TAVERN_MENU_TEXT.refreshed, blackout: false, minutes: 15, fatigue: 5, magicka: 0 });
  assert.deepEqual(tavernDrink({ ...newSurvival(0), drunk: 0 }, 10, { endurance: 50 }), { text: TAVERN_MENU_TEXT.fortified, blackout: false, minutes: 15, fatigue: 10, magicka: 10 });
  assert.deepEqual(tavernDrink({ ...newSurvival(0), drunk: 20 }, 10, { endurance: 50 }), { text: TAVERN_MENU_TEXT.gettingDrunk, blackout: false, minutes: 15 }, 'past half the endurance: drunk, and nothing fortified');
  assert.equal(TAVERN_MENU_TEXT.refreshed, 'The drink refreshes you.');
  // the classic window, every tier: a North mid table at 13:00 pours Cows Milk (0), Ale (10) and Red Wine (20)
  for (const tier of ['boons', 'casual', 'hard']) {
    setPref(SURVIVAL_PREF, tier);
    for (const [drink, said, fatigue, magicka] of [[/Cows Milk/, TAVERN_MENU_TEXT.refreshed, 1320, 5], [/ Ale$/, TAVERN_MENU_TEXT.fortified, 1640, 15], [/Red Wine/, TAVERN_MENU_TEXT.fortified, 2280, 25]]) {
      const e = guest(NOON, { fatigue: 1000, magicka: 5 });
      assert.deepEqual(classicPick(hooksFor(e, { region: DAGGERFALL, quality: 10, ...oneClock(NOON) }), drink).said, [said], `${tier} ${drink}`);
      assert.deepEqual([e.fatigue, e.magicka], [fatigue, magicka], `${tier} ${drink}: the fatigue and the magicka`);
    }
  }
  // the pools are the ceiling: 6400 fatigue and 50 magicka for this character
  setPref(SURVIVAL_PREF, 'hard');
  {
    const e = guest(NOON, { fatigue: 6300, magicka: 45 });
    classicPick(hooksFor(e, { region: DAGGERFALL, quality: 10, ...oneClock(NOON) }), /Red Wine/);
    assert.deepEqual([e.fatigue, e.magicka], [6400, 50]);
  }
  // after the quarter hour, as TavernDrink passes it first: on the real ticker the quarter hour drains a minute's 8 from
  // a full pool, and the milk's 320 tops it up again - before the quarter hour it would stand 8 short
  for (const pick of [(h) => classicPick(h, /Cows Milk/), (h) => enhancedPick(h, 'Cows Milk')]) {
    const e = guest(NOON);
    pick(hooksFor(e, { region: DAGGERFALL, quality: 10, ...realClocks(e, { own: NOON }) }));
    assert.equal(e.fatigue, 6400, 'the quarter hour, then the drink');
  }
  // past half the endurance the drink only makes you drunk
  {
    const e = guest(NOON, { fatigue: 1000, magicka: 5 }); e.survival.drunk = 20;
    assert.deepEqual(classicPick(hooksFor(e, { region: DAGGERFALL, quality: 10, ...oneClock(NOON) }), / Ale$/).said, [TAVERN_MENU_TEXT.gettingDrunk]);
    assert.deepEqual([e.fatigue, e.magicka], [1000, 5]);
  }
  // the enhanced window gives the same
  for (const [name, said, fatigue, magicka] of [['Cows Milk', TAVERN_MENU_TEXT.refreshed, 1320, 5], ['Red Wine', TAVERN_MENU_TEXT.fortified, 2280, 25]]) {
    const e = guest(NOON, { fatigue: 1000, magicka: 5 });
    assert.ok(enhancedPick(hooksFor(e, { region: DAGGERFALL, quality: 10, ...oneClock(NOON) }), name).said.includes(said), name);
    assert.deepEqual([e.fatigue, e.magicka], [fatigue, magicka], `enhanced ${name}`);
  }
});

test('AUDIT C&C I8: THE MOD\'S OWN STRUCTURE - regionMenuDay\'s region switch first and its own climate fallback after; DoFood\'s lists by tier and key, breakfast by the tier alone; DoDrinks\' lists; the quality bands; every meal worth 240; the alcohol by place - the tables to the literal, and the audit\'s cases through the menu (mutants: the region asked not; a key\'s regions moved; the quality band at 6; breakfast by the key; the Royal plate at every tier; Balfiera\'s high table the NorthEast\'s; the Orcs\' mid table the NorthEast\'s; the North\'s low table another\'s; the swamp drinks Morrowind\'s; the Orcs\' high drinks the North\'s; an alcohol moved; every row soft; a meal worth 120)', () => {
  assert.deepEqual(MENU_KEY_BY_REGION, {
    0: 's', 1: 's', 5: 'n', 9: 'b', 11: 's', 16: 'o', 17: 'n', 18: 'n', 19: 'n', 20: 's', 21: 'n', 22: 'se', 23: 'ne', 26: 'o',
    32: 'n', 33: 'ne', 34: 'ne', 35: 'ne', 36: 'n', 37: 'n', 38: 'n', 39: 'n', 40: 'n', 41: 'n', 42: 'n', 43: 's', 44: 's', 45: 's',
    46: 's', 47: 's', 48: 's', 49: 'se', 50: 'se', 51: 'se', 52: 'se', 53: 's', 54: 's', 55: 's', 56: 's', 57: 'ne', 58: 'n', 59: 'n',
    60: 'n', 61: 's',
  }, 'the mod\'s Regions, by their own indices');
  assert.deepEqual(MENU_KEY_BY_CLIMATE, { 224: 's', 225: 's', 226: 'n', 227: 'se', 228: 'se', 229: 's', 230: 'n', 231: 'n', 232: 'n' });
  assert.equal(menuKeyFor(223), 'n', 'the Ocean, which the switch names not, is its default');
  assert.equal(regionMenuDay(20, 231), 's', 'Sentinel in a wood: the region first');
  assert.equal(regionMenuDay(9, 224), 'b', 'Balfiera in a desert');
  assert.equal(regionMenuDay(2, 228), 'se', 'a region the mod names not (the Glenpoint Foothills): the climate\'s');
  assert.equal(regionMenuDay(-1, 226), 'n', 'no region: the climate\'s');
  assert.deepEqual([1, 4, 5, 12, 13, 20].map(menuTier), ['low', 'low', 'mid', 'mid', 'high', 'high']);
  assert.deepEqual(FOOD_MENUS, {
    low: { n: 'nLow', ne: 'neLow', se: 'seLow', s: 'sLow', b: 'neLow', o: 'neLow' },
    mid: { n: 'nMid', ne: 'neMid', se: 'seMid', s: 'sMid', b: 'neMid', o: 'woMid' },
    high: { n: 'nHigh', ne: 'neHigh', se: 'seHigh', s: 'sHigh', b: 'balHigh', o: 'neHigh' },
  });
  assert.deepEqual(BREAKFAST_MENUS, { low: 'breakLow', mid: 'breakMid', high: 'breakHigh' });
  assert.deepEqual(DRINK_MENUS, {
    low: { n: 'nLow', ne: 'neLow', se: 'sLow', s: 'sLow', b: 'neLow', o: 'woLow' },
    mid: { n: 'nMid', ne: 'neMid', se: 'sMid', s: 'sMid', b: 'neMid', o: 'woMid' },
    high: { n: 'nHigh', ne: 'neHigh', se: 'sHigh', s: 'sHigh', b: 'neHigh', o: 'neHigh' },
  });
  assert.deepEqual(DRINK_ALCOHOL, { low: [0, 0, 10, 12, 25], mid: [0, 0, 10, 12, 15, 20, 30], high: [0, 0, 0, 10, 12, 15, 20, 20, 40] });
  assert.equal(MEAL_WORTH, 240);
  const pairs = (t) => Object.fromEntries(Object.entries(t).map(([k, l]) => [k, l.map((x) => `${x.name} ${x.price}`)]));
  assert.deepEqual(pairs(TAVERN_DISHES), {
    breakLow: ['Leftovers 1'],
    breakMid: ['Gruel 2', 'Bread and Cheese 5'],
    breakHigh: ['Oatmeal with Berries 5', 'Artisinal Pastries 8', 'Royal Breakfast Plate 10'],
    nLow: ['Baked Apples 6', 'Mystery Sausage 8', 'Grilled Hare 10'],
    nMid: ['Breton Pork Sausage 7', 'Cheese Pork Schnitzel 10', 'Hare in Garlic Sauce 12', 'Highland Rabbit Stew 15'],
    nHigh: ['Gorapple Cheesecake 10', 'Apple Cobbler Supreme 13', 'Peacock Pie 15', 'Rabbit Gnocchi Ragu 18', 'Salmon Steak Supreme 22'],
    neLow: ['Velothis Cabbage Soup 6', 'Beetle-Cheese Poutine 8', 'Eidar Radish Salad 10'],
    neMid: ['Cabbage Biscuits 7', 'Potato Porridge 10', 'Dunmeri Jerked Horse Haunch 12', 'Solstheim Elk and Scuttle 15'],
    neHigh: ['Indoril Radish Tartlets 10', 'Vvardenfell Ash Yam Loaf 13', 'Kwama Egg Quiche 15', 'Millet-Stuffed Pork Loin 18', 'Akaviri Pork Fried Rice 22'],
    sLow: ['Cantaloupe Bread 6', 'Fishy Stick 8', 'Roasted Corn 10'],
    sMid: ['Beets With Goat Cheese 7', 'Venison Pie 10', 'Antelope Stew 12', 'Parmesan Eels in Watermelon 15'],
    sHigh: ['Roast Anteloupe 10', 'Melon-Chevre Salad 13', 'Pork Fried Rice 15', 'Chili Cheese Corn 18', 'Supreme Jambalaya 22'],
    seLow: ['Banana Surprise 6', 'Green Bananas With Garlic 8', 'Banana Cornbread 10'],
    seMid: ['Banana Millet Muffin 7', 'Baked Sole With Bananas 10', 'Chicken-and-Coconut Fried Rice 12', 'Mistral Banana-Bunny Hash 15'],
    seHigh: ['Clan Mother\'s Banana Pilaf 10', 'Stuffed Banana Leaves 13', 'Jungle Snake Curry 15', 'Banana-Radish Vichyssoise 18', 'Spicy Grilled Lizard 22'],
    balHigh: ['Summerset Rainbow Pie 10', 'Old Aldmeri Gruel 13', 'Pickled Fish Bowl 25', 'Direnni Rabbit Bisque 18', 'Lillandril Summer Sausage 22'],
    woMid: ['Potato Porridge 7', 'Orcish Bratwurst On Bun 10', 'Jerall Carrot Cake 12', 'Bruma Jugged Rabbit 15'],
  });
  assert.deepEqual(pairs(TAVERN_DRINKS), {
    nLow: ['Goats Milk 1', 'Spruce Tea 2', 'Apple Cider 2', 'Ale 3', 'Moonshine 4'],
    nMid: ['Cows Milk 2', 'Herbal Tea 4', 'Ale 4', 'Bitter 6', 'Mulled Wine 8', 'Red Wine 12', 'Rye Liquor 14'],
    nHigh: ['Berry Juice 3', 'Herbal Tea 6', 'Mint Tea 6', 'Ale 9', 'Bitter 12', 'Port 18', 'Mulled Wine 21', 'Red Wine 24', 'Nereid Wine 30'],
    neLow: ['Goats Milk 1', 'Berry Juice 2', 'Pear Cider 2', 'Ale 3', 'Morrowind Mazte 4'],
    neMid: ['Fruit Juice 2', 'Mint Tea 4', 'Ale 4', 'Weat Beer 6', 'Bitter 8', 'Acai Mazte 12', 'Vvrdenfell Flin 14'],
    neHigh: ['Fruit Juice 3', 'Herbal Tea 6', 'Mint Tea 6', 'Golden Ale 9', 'Stout 12', 'Mulled Wine 18', 'Port Wine 21', 'Nereid Wine 24', 'Cyrodiil Brandy 30'],
    sLow: ['Camel Milk 1', 'Coffee 2', 'Beer 2', 'Stout 3', 'Rum 4'],
    sMid: ['Fruit Juice 2', 'Coffee 4', 'Beer 4', 'Stout 6', 'Bitter 8', 'Wine 12', 'Rum 14'],
    sHigh: ['Fruit Juice 3', 'Coffee 6', 'Chai Tea 6', 'Weat Beer 9', 'Beer 12', 'Stout 18', 'Bitter 21', 'Wine 24', 'Summerset Wine 30'],
    woLow: ['Goats Milk 1', 'Berry Juice 2', 'Ale 2', 'Mead 3', 'Orc Grog 4'],
    woMid: ['Berry Juice 2', 'Mint Tea 4', 'Ale 4', 'Mead 6', 'Mulled Wine 18', 'Red Wine 12', 'Pine Rye 14'],
  });
  // the audit's cases, through the menu both windows read
  const at = (o) => tavernMenu({ climateIndex: CLIMATES.Woodlands, regionIndex: -1, quality: 10, hour: 12, ...o });
  assert.deepEqual(food(at({ quality: 3 })), ['Baked Apples 6', 'Mystery Sausage 8', 'Grilled Hare 10'], 'a Woodlands low table at noon: the mod\'s nLow (it served Leftovers, Gruel, Bread and Cheese)');
  assert.deepEqual(food(at({ quality: 3, hour: 8 })), ['Leftovers 1'], 'breakfast by the tier: a low table\'s is Leftovers (it served the Royal plate\'s list)');
  assert.deepEqual(food(at({ quality: 10, hour: 8 })), ['Gruel 2', 'Bread and Cheese 5']);
  assert.deepEqual(food(at({ quality: 15, hour: 8, regionIndex: SENTINEL })), ['Oatmeal with Berries 5', 'Artisinal Pastries 8', 'Royal Breakfast Plate 10'], 'every key eats its tier\'s breakfast - Sentinel\'s high table too');
  assert.deepEqual(food(at({ quality: 5 })), ['Breton Pork Sausage 7', 'Cheese Pork Schnitzel 10', 'Hare in Garlic Sauce 12', 'Highland Rabbit Stew 15'], 'quality 5 is a mid table');
  assert.deepEqual(food(at({ quality: 15, climateIndex: CLIMATES.Swamp })), ['Clan Mother\'s Banana Pilaf 10', 'Stuffed Banana Leaves 13', 'Jungle Snake Curry 15', 'Banana-Radish Vichyssoise 18', 'Spicy Grilled Lizard 22'], 'the swamp\'s high table: bananas and lizard (it served Dunmer dishes)');
  assert.deepEqual(food(at({ quality: 15, regionIndex: BALFIERA })), ['Summerset Rainbow Pie 10', 'Old Aldmeri Gruel 13', 'Pickled Fish Bowl 25', 'Direnni Rabbit Bisque 18', 'Lillandril Summer Sausage 22'], 'Balfiera\'s high table');
  assert.deepEqual(food(at({ quality: 10, regionIndex: BALFIERA })), ['Cabbage Biscuits 7', 'Potato Porridge 10', 'Dunmeri Jerked Horse Haunch 12', 'Solstheim Elk and Scuttle 15'], 'and its mid one the NorthEast\'s');
  assert.deepEqual(food(at({ quality: 10, regionIndex: ORSINIUM })), ['Potato Porridge 7', 'Orcish Bratwurst On Bun 10', 'Jerall Carrot Cake 12', 'Bruma Jugged Rabbit 15'], 'the Orcs\' mid table');
  assert.deepEqual(drinks(at({ quality: 10, regionIndex: ORSINIUM })), ['Berry Juice 2/0', 'Mint Tea 4/0', 'Ale 4/10', 'Mead 6/12', 'Mulled Wine 18/15', 'Red Wine 12/20', 'Pine Rye 14/30'], 'the Orcs\' mid drinks, each its place\'s alcohol');
  assert.deepEqual(drinks(at({ quality: 15, regionIndex: ORSINIUM })), ['Fruit Juice 3/0', 'Herbal Tea 6/0', 'Mint Tea 6/0', 'Golden Ale 9/10', 'Stout 12/12', 'Mulled Wine 18/15', 'Port Wine 21/20', 'Nereid Wine 24/20', 'Cyrodiil Brandy 30/40'], 'their high drinks the NorthEast\'s');
  assert.deepEqual(drinks(at({ climateIndex: CLIMATES.Swamp })), ['Fruit Juice 2/0', 'Coffee 4/0', 'Beer 4/10', 'Stout 6/12', 'Bitter 8/15', 'Wine 12/20', 'Rum 14/30'], 'the swamp drinks the South\'s (it poured Morrowind\'s)');
  assert.deepEqual(drinks(at({ climateIndex: CLIMATES.Mountain })), ['Cows Milk 2/0', 'Herbal Tea 4/0', 'Ale 4/10', 'Bitter 6/12', 'Mulled Wine 8/15', 'Red Wine 12/20', 'Rye Liquor 14/30'], 'the mountain the North\'s (it poured the Orcs\')');
  assert.deepEqual(drinks(at({ quality: 3, regionIndex: BALFIERA })), ['Goats Milk 1/0', 'Berry Juice 2/0', 'Pear Cider 2/10', 'Ale 3/12', 'Morrowind Mazte 4/25'], 'Balfiera drinks the NorthEast\'s');
  assert.deepEqual(at({ quality: 3, climateIndex: CLIMATES.Ocean }).key, 'n', 'the Ocean keys the North (it keyed the bay\'s bananas)');
  // every meal the mod serves is worth 240, at every key, tier and hour
  for (const region of [-1, ...Object.keys(MENU_KEY_BY_REGION).map(Number)]) for (const quality of [1, 5, 13]) for (const hour of [6, 12]) {
    for (const r of tavernMenu({ climateIndex: CLIMATES.Woodlands, regionIndex: region, quality, hour }).rows.filter((x) => x.kind === 'food')) assert.equal(r.worth, 240, `${region}/${quality}/${hour}: ${r.name}`);
  }
});

test('AUDIT C&C I8: Drinks_OnItemPicked\'s holidays - on New Life and Harvest\'s End a row from the sixth on that costs over ten gold is free (a mid table\'s last two, a high one\'s last four, a low one\'s none), on the world\'s calendar, through both windows (mutants: Harvest\'s End forgotten; New Life forgotten; free from the fifth; free over twelve; the holiday never read; the windows hand no calendar)', () => {
  const day = (d, hour = 20) => 405 * 518400 + (d - 1) * 1440 + hour * 60;   // the classic day of the year, the evening
  const priced = (o) => tavernMenu({ climateIndex: CLIMATES.Woodlands, regionIndex: DAGGERFALL, hour: 20, ...o }).rows.filter((r) => r.kind === 'drink').map((r) => r.price);
  assert.deepEqual(priced({ quality: 10, minutes: day(1) }), [2, 4, 4, 6, 8, 0, 0], 'New Life (day 1): the mid table\'s Red Wine and Rye Liquor');
  assert.deepEqual(priced({ quality: 15, minutes: day(237) }), [3, 6, 6, 9, 12, 0, 0, 0, 0], 'Harvest\'s End (day 237): the high table\'s last four');
  assert.deepEqual(priced({ quality: 3, minutes: day(1) }), [1, 2, 2, 3, 4], 'a low table has no sixth row');
  assert.deepEqual(priced({ quality: 10, minutes: day(2) }), [2, 4, 4, 6, 8, 12, 14], 'another day pays');
  assert.deepEqual(priced({ quality: 10 }), [2, 4, 4, 6, 8, 12, 14], 'no calendar handed, no holiday');
  const free = tavernMenu({ climateIndex: CLIMATES.Woodlands, regionIndex: DAGGERFALL, quality: 10, hour: 20, minutes: day(1) }).rows.find((r) => r.name === 'Red Wine');
  assert.equal(free.text, ' 0 gold   Red Wine', 'the row says what it costs');
  // through the windows, Hard: a New Life Red Wine costs nothing - the WORLD's calendar (worldNow), not the character's
  setPref(SURVIVAL_PREF, 'hard');
  const own = 1440 * 10 + 20 * 60;   // the character's own day 11: no holiday
  {
    const e = guest(own);
    const c = { t: own };
    const said = classicPick(hooksFor(e, { region: DAGGERFALL, quality: 10, now: () => c.t, worldNow: () => day(1), advance: (n) => { c.t += n; } }), /Red Wine/).said;
    assert.deepEqual([said, e.goldPieces, e.survival.drunk], [[TAVERN_MENU_TEXT.fortified], 100, 20], 'the classic window pours it free');
  }
  {
    const e = guest(own);
    const c = { t: own };
    enhancedPick(hooksFor(e, { region: DAGGERFALL, quality: 10, now: () => c.t, worldNow: () => day(1), advance: (n) => { c.t += n; } }), 'Red Wine');
    assert.deepEqual([e.goldPieces, e.survival.drunk], [100, 20], 'and the enhanced one');
  }
  {
    const e = guest(own);
    const c = { t: own };
    classicPick(hooksFor(e, { region: DAGGERFALL, quality: 10, now: () => c.t, worldNow: () => day(2), advance: (n) => { c.t += n; } }), /Red Wine/);
    assert.equal(e.goldPieces, 88, 'on another day of the world\'s it costs its twelve');
  }
});

test('AUDIT C&C I8: the windows hand the region as they hand the climate - PlayerGPS.CurrentRegionIndex, the host\'s own - and the region keys before the climate in both (mutants: the classic window hands no region; the enhanced window hands no region; the host hands the tavern no region)', () => {
  setPref(SURVIVAL_PREF, 'hard');
  // Sentinel's tavern in a wood: the region's South, not the climate's North
  const { picker } = classicPick(hooksFor(guest(NOON), { region: SENTINEL, climate: CLIMATES.Woodlands, quality: 10, ...oneClock(NOON) }), /Antelope Stew/);
  assert.deepEqual(picker.slice(0, 4).map((t) => t.trim()), ['7 gold   Beets With Goat Cheese', '10 gold   Venison Pie', '12 gold   Antelope Stew', '15 gold   Parmesan Eels in Watermelon']);
  const { rows } = enhancedPick(hooksFor(guest(NOON), { region: SENTINEL, climate: CLIMATES.Woodlands, quality: 10, ...oneClock(NOON) }), 'Antelope Stew');
  assert.ok(rows.some((r) => r.includes('Venison Pie')) && !rows.some((r) => r.includes('Breton Pork Sausage')), 'the enhanced list keys the region too');
  // the host: the region beside the climate, read off the parent's PlayerGPS seam the way the climate is
  assert.match(read('src/scenes/worldModes.js'), /\n\s*regionIndex: \(\) => host\.currentRegionIndex\?\.\(\) \?\? -1,\n\s*climateIndex: \(\) => host\.climateIndex\?\.\(\) \?\? 232,\n\s*advanceMinutes: \(n\) => interiorTicker\.advance\(n\),/);
});
