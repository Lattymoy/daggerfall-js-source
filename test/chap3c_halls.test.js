// CHAP3c (2026-10-08, Mac: "Continue", on "Keep going with the arc/slices") - THE BANDS ON THE HALLS: online, a guild
// hall's training, a spell bought and a spell made cost a quarter more where its chapter is Failing and a tenth less
// where it is Thriving or Ascendant, and its shelf is stocked as a hall four qualities poorer or richer - DFU's own price
// and stock laws the base, the band laid over them; offline, and for a chapter the sheet does not name, DFU's own.
// bible/11-Multiplayer/Chapters-Arc.md 5.2 and 5.3 (CHAP3c).
//
// The law against literals; the sheet the playing tab holds, over a fake door; DFU's training, spellbook and spellmaker
// with the factor and without; the shelf's count; the hosts' wiring.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  CHAPTER_BANDS, chapterPriceFactor, chapterPriced, chapterShelfQuality, HALL_QUALITY_MIN, HALL_QUALITY_MAX,
} from '../src/net/npcChapterLaw.js';
import { createChapterSheet, SHEET_KEPT_MS, SHEET_STOPS } from '../src/net/chapterSheet.js';
import { trainingOffer, canAffordTraining } from '../src/systems/guildServiceActions.js';
import { buildTrainingFlow, buildRefinedTrainingFlow } from '../src/ui/guildServiceWindows.js';
import { SpellbookWindow } from '../src/ui/spellbookWindow.js';
import { SpellMakerWindow } from '../src/ui/spellMakerWindow.js';
import { SPELL_MAKER_EFFECTS } from '../src/systems/spellEffects.js';
import { SPELLBOOK_TEMPLATE_INDEX } from '../src/systems/spellMaker.js';
import { calculateTradePrice, stockGuildPotions } from '../src/systems/shopStock.js';
import { GUILDS } from '../src/systems/guilds.js';
import { SKILLS } from '../src/systems/skills.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const tick = () => new Promise((r) => setImmediate(r));

// ── THE LAW ─────────────────────────────────────────────────────────

test('CHAP3c a hall\'s factor by its chapter\'s band - a quarter more Failing, a tenth less Thriving and Ascendant, DFU\'s own Steady and where no Strength is known (mutants: each band, the unknown)', () => {
  assert.deepEqual([0, 19, 20, 69, 70, 89, 90, 100].map(chapterPriceFactor), [1.25, 1.25, 1, 1, 0.9, 0.9, 0.9, 0.9]);
  assert.deepEqual([null, undefined, NaN, '80', Infinity].map(chapterPriceFactor), [1, 1, 1, 1, 1]);
  assert.deepEqual(CHAPTER_BANDS.map((b) => b.shelf), [-4, 0, 4, 4]);
});

test('CHAP3c a price laid over: rounded, never under one for a price that was some; DFU\'s own at 1, and nothing at nothing (mutants: the rounding, the floor, the identity)', () => {
  assert.deepEqual([[300, 1.25], [300, 0.9], [3, 0.9], [1, 0.9], [5, 1.25], [7, 1], [0, 1.25], [-4, 0.9], [2, 0.9]].map(([p, f]) => chapterPriced(p, f)),
    [375, 270, 3, 1, 6, 7, 0, -4, 2]);
});

test('CHAP3c the shelf\'s quality: four poorer Failing, four richer Thriving and Ascendant, inside DFU\'s 1-20; the hall\'s own with no Strength or no quality (mutants: the step, the bounds, the unknown)', () => {
  assert.deepEqual([HALL_QUALITY_MIN, HALL_QUALITY_MAX], [1, 20]);
  assert.deepEqual([[10, 10], [10, 50], [10, 75], [10, 95], [2, 5], [18, 80], [20, 99], [1, 0]].map(([q, s]) => chapterShelfQuality(q, s)),
    [6, 10, 14, 14, 1, 20, 20, 1]);
  assert.deepEqual([[10, null], [10, NaN], [0, 80], [10, '80']].map(([q, s]) => chapterShelfQuality(q, s)), [10, 10, 0, 10]);
  // DFU's own stock law reads it: a Thriving Mages Guild of quality 10 shelves 15 potions, a Failing one 7
  assert.deepEqual([10, 50, 80].map((s) => stockGuildPotions({ quality: chapterShelfQuality(10, s), gameMinutes: 0 }).length), [7, 11, 15]);
});

// ── THE SHEET THE TAB HOLDS ─────────────────────────────────────────

test('CHAP3c the sheet: nothing known until its read lands, then each chapter\'s Strength; asked once at a time, again only once old; a refusal that is the account\'s stops it, a failed read is asked again (mutants: the key, the beat, the busy, the stops)', async () => {
  let t = 0;
  const calls = [];
  let answer = { ok: true, data: { week: 3, chapters: [{ f: 41, region: 21, strength: 74, band: 'thriving' }, { f: 'x', region: 21, strength: 9 }, { f: 40, region: 17, strength: 12 }] } };
  const door = { list: async () => { calls.push(t); return answer; } };
  const sheet = createChapterSheet({ door, nowMs: () => t });
  assert.equal(sheet.strengthOf(41, 21), null, 'nothing before the read lands');
  assert.equal(sheet.strengthOf(41, 21), null);
  assert.equal(calls.length, 0, 'asked on the next turn');
  await tick();
  assert.equal(calls.length, 1, 'one read, however many asked');
  await tick();
  assert.deepEqual([sheet.strengthOf(41, 21), sheet.strengthOf(40, 17), sheet.strengthOf(41, 17), sheet.strengthOf(40, 21)], [74, 12, null, null]);
  assert.equal(sheet.strengthOf('x', 21), null, 'a row that names no guild is none');
  assert.equal(SHEET_KEPT_MS, 600_000);
  t = SHEET_KEPT_MS - 1;
  assert.equal(sheet.refresh(), false, 'not yet old');
  t = SHEET_KEPT_MS;
  answer = { ok: false, error: 'server' };
  assert.equal(sheet.refresh(), true);
  await tick(); await tick();
  assert.equal(sheet.strengthOf(41, 21), 74, 'a failed read keeps the last');
  t = 2 * SHEET_KEPT_MS;
  answer = { ok: false, error: 'chapters-closed' };
  sheet.refresh();
  await tick(); await tick();
  assert.equal(sheet.stopped, true);
  t = 9 * SHEET_KEPT_MS;
  assert.equal(sheet.refresh(), false, 'stopped for the page');
  assert.deepEqual([...SHEET_STOPS], ['chapters-closed', 'no-session', 'auth']);
  // a door that throws is a failed read, asked again at the next beat
  let n = 0;
  const flaky = createChapterSheet({ door: { list: async () => { n++; throw new Error('offline'); } }, nowMs: () => t });
  flaky.refresh();
  await tick(); await tick();
  assert.equal(flaky.stopped, false);
  t += SHEET_KEPT_MS;
  assert.equal(flaky.refresh(), true);
  await tick();
  assert.equal(n, 2);
});

// ── DFU'S SERVICES WITH THE BAND ────────────────────────────────────

const player = (over = {}) => ({
  name: 'Bob', isPlayer: true, level: 2, health: 30, maxHealth: 30, goldPieces: 5000, items: [],
  skills: Object.fromEntries(Object.values(SKILLS).map((s) => [s, 20])),
  skillUses: Object.fromEntries(Object.values(SKILLS).map((s) => [s, 0])),
  stats: { personality: 50 }, activeEffects: [], fatigue: 3200, timeOfLastSkillTraining: 0, ...over,
});
const rows = (id) => [{ text: `rsc:${id}`, center: true }];
const member = { guild: 'FightersGuild', rank: 0 };

test('CHAP3c training: the offer and its gold check by the hall\'s factor - DFU\'s own at 1 (mutants: the offer, the check)', () => {
  const e = player({ level: 3 });
  assert.equal(trainingOffer(e, GUILDS.FightersGuild, member, 100000).price, 300);
  assert.equal(trainingOffer(e, GUILDS.FightersGuild, member, 100000, 1.25).price, 375);
  assert.equal(trainingOffer(e, GUILDS.FightersGuild, member, 100000, 0.9).price, 270);
  assert.equal(trainingOffer(e, GUILDS.FightersGuild, member, 100000, 1.111).price, 333, 'rounded, as the law\'s chapterPriced');
  const poor = player({ level: 3, goldPieces: 300 });
  assert.deepEqual([canAffordTraining(poor, member), canAffordTraining(poor, member, 1.25), canAffordTraining(poor, member, 0.9)], [true, false, true]);
});

test('CHAP3c training\'s windows: DFU\'s chain and RefinedTraining\'s both pay the factored price; a Failing hall\'s quarter more is refused a purse that DFU\'s price fits (mutants: the flows\' factor)', () => {
  const paid = [];
  const f = buildTrainingFlow(player({ level: 2 }), GUILDS.FightersGuild, member, {
    rows, now: () => 100000, rolls: () => 0, priceFactor: 0.9, applyTraining: (r, price) => paid.push(price),
  });
  f.input('KeyY');
  f.input('Enter');
  assert.deepEqual(paid, [180]);
  const short = buildTrainingFlow(player({ level: 2, goldPieces: 200 }), GUILDS.FightersGuild, member, {
    rows, now: () => 100000, rolls: () => 0, priceFactor: 1.25, applyTraining: (r, price) => paid.push(price),
  });
  short.input('KeyY');
  assert.equal(short.top.picker, undefined, 'the picker never opens');
  assert.deepEqual(paid, [180]);
  const refined = buildRefinedTrainingFlow(player({ level: 2 }), GUILDS.FightersGuild, member, {
    rows, now: () => 100000, rolls: () => 0, priceFactor: 1.25, variablePrice: false, applyTraining: (r, price) => paid.push(price),
  });
  refined.input('Enter');
  refined.input('KeyY');
  assert.deepEqual(paid, [180, 250]);
});

/** A guild's spellbook in buy mode, as the spellbook's own pins make one. */
function shop(over = {}) {
  const entity = { name: 'Nyra', magicka: 20, maxMagicka: 40, spells: [], stats: { personality: 50 }, goldPieces: 5000,
    items: [{ group: 'MiscItems', templateIndex: SPELLBOOK_TEMPLATE_INDEX }] };
  const spell = { name: 'Arc Bolt', cost: 20, index: 1, icon: 3, element: 0, rangeType: 2, effects: [{ type: 4, subType: 0 }, { type: -1, subType: -1 }, { type: -1, subType: -1 }] };
  return new SpellbookWindow({
    spells: () => entity.spells, entity, castCost: (sp) => sp.cost, offered: () => [spell], buildingQuality: () => 10,
    shopName: () => 'The Mages Guild', skills: () => ({ mercantile: 30, personality: 50 }), classicMinutes: () => 0,
    rows: (id) => [{ text: `[${id}] %a gold, %pct.`, center: true }], ...over,
  }, { buyMode: true });
}

test('CHAP3c a spell bought: DFU\'s trade price with the hall\'s factor laid over it - the price shown is the price charged (mutants: the factor unread)', () => {
  const dfu = calculateTradePrice(80, 10, { mercantile: 30, personality: 50 }, false);
  assert.equal(shop().tradePrice(), dfu);
  assert.equal(shop({ priceFactor: () => 1 }).tradePrice(), dfu);
  assert.equal(shop({ priceFactor: () => 1.25 }).tradePrice(), Math.max(1, Math.round(dfu * 1.25)));
  assert.equal(shop({ priceFactor: () => 0.9 }).tradePrice(), Math.max(1, Math.round(dfu * 0.9)));
  assert.notEqual(shop({ priceFactor: () => 1.25 }).tradePrice(), dfu);
});

test('CHAP3c a spell made: the maker\'s gold cost with the hall\'s factor laid over it, its spell points DFU\'s (mutants: the factor unread, laid on the points)', () => {
  const entity = () => ({ name: 'S', level: 1, stats: {}, skills: [50], maxMagicka: 40, goldPieces: 100000,
    items: [{ group: 'MiscItems', templateIndex: SPELLBOOK_TEMPLATE_INDEX }], spells: [] });
  const made = (priceFactor) => {
    const w = new SpellMakerWindow({ entity: entity(), priceFactor });
    w._addAndEditSlot(SPELL_MAKER_EFFECTS[0]);
    w._updateSpellCosts();
    return w;
  };
  const dfu = made(null);
  assert.ok(dfu.totalGoldCost > 0);
  assert.equal(made(() => 1).totalGoldCost, dfu.totalGoldCost);
  assert.equal(made(() => 1.25).totalGoldCost, Math.max(1, Math.round(dfu.totalGoldCost * 1.25)));
  assert.equal(made(() => 0.9).totalGoldCost, Math.max(1, Math.round(dfu.totalGoldCost * 0.9)));
  assert.equal(made(() => 1.25).totalSpellPointCost, dfu.totalSpellPointCost);
});

// ── THE HOSTS ───────────────────────────────────────────────────────

test('CHAP3c the wiring: the hall\'s chapter read off its guild and region; training, the spellbook and the maker given its factor, the three shelves its quality; the sheet built online, asked at a town\'s entry, handed to the interiors (mutants: each seam)', () => {
  const modes = src('src/scenes/worldModes.js');
  assert.match(modes, /const chapterStrength = \(\) => host\.chapterStrength\?\.\(guild\?\.factionId \?\? null, b\?\.regionIndex \?\? null\) \?\? null;/);
  assert.match(modes, /const chapterFactor = \(\) => chapterPriceFactor\(chapterStrength\(\)\);/);
  assert.match(modes, /const shelfQuality = \(\) => chapterShelfQuality\(b\?\.quality \?\? 0, chapterStrength\(\)\);/);
  assert.match(modes, /priceFactor: chapterFactor\(\),   \/\/ CHAP3c: the hall's chapter's band on the training's price/);
  assert.match(modes, /priceFactor: chapterFactor,   \/\/ CHAP3c: the hall's chapter's band on a spell's price/);
  assert.match(modes, /priceFactor: chapterFactor,   \/\/ CHAP3c: the hall's chapter's band on a spell's making/);
  assert.equal((modes.match(/quality: shelfQuality\(\)/g) ?? []).length, 3, 'soul gems, potions and magic items');
  const world = src('src/scenes/world.js');
  assert.match(world, /const chapterSheet = hallDoor \? createChapterSheet\(\{ door: hallDoor \}\) : null;/);
  assert.match(world, /chapterStrength: \(faction, region\) => chapterSheet\?\.strengthOf\(faction, region\) \?\? null,/);
  assert.match(world, /const revealMemberGuildHalls = \(\{ witness = false \} = \{\}\) => \{\n\s+if \(witness\) chapterSheet\?\.refresh\(\);/);
  assert.match(src('src/net/accountClient.js'), /list: \(\) => post\('\/v1\/chapters\/list', \{\}\),/);
  // offline there is no door, so no sheet: every hall DFU's own
  assert.match(world, /const hallDoor = params\.has\('online'\) \?/);
});
