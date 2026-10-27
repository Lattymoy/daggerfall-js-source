// CRAFT-HALL (2026-10-26; a player's feedback, handed on by the owner: crafting "is hidden behind 2 tabs. There's a lack
// of necessary information on the page regarding your level, what gives progress, progression bars, what gives a first
// time crafting bonus (or what already has)"; the owner: "No exceptions and no band aids") - THE CRAFTER'S PAGE.
// The service says what a character has made (server-account/src/professions.js profState's `made`), the book keeps it
// and notes every act it answers (net/profBook.js), recipeLaw firstMakesSpent keys it as the first-make decisions do,
// and the pages say it: the Crafting page beside the Professions page (each craft's bar and its first-time bonuses over
// the stations), every station's header, the patterns' shows and their first-time marks, the box's line owed or spent,
// Craft x N, what raises a track, and the Professions key landing at the station. Built from the producers: the real
// Worker over node:sqlite (test/accountDb.mjs), a book that reads it, and the pages drawn for real.
// bible/06-Systems/Professions-Arc.md section 56.
import '../../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService, T0, sessionStorageOf } from '../../accountDb.mjs';
import { accountProf, SESSION_KEY } from '../../../src/net/accountClient.js';
import { createProfBook } from '../../../src/net/profBook.js';
import {
  RECIPES, recipeById, firstMakesOf, firstMakesSpent, firstCraftKey, FIRST_MAKE_SHARE, craftXp, cookXp, masonXp, CRAFT_XP_PER_TIER,
} from '../../../src/net/recipeLaw.js';
import { xpForRank, harvestXp, smeltXp, writXp, topTierOf, MASON_RECIPES, PROFESSIONS, trackOf, HIDES } from '../../../src/net/professionLaw.js';
import { material, VEIN_TABLES, DUNGEON_VEINS, WOOD_TABLES, RARE_WOODS, regionWritTable } from '../../../src/net/nodeLaw.js';
import { CLIMATES, REGION_NAMES } from '../../../src/formats/mapsTables.js';
import { seatRealm } from '../../realmSeat.mjs';
import { POTIONS, brewXp, DISENCHANT_XP } from '../../../src/net/alchemyLaw.js';
import { craftWritXp } from '../../../src/net/craftWritLaw.js';
import {
  STATION_TRACKS, CRAFT_TRACKS, trackBar, toNextWords, firstStanding, firstOwed, recipeFirstOwed, workFirstOwed, brewFirstOwed, owedOpenFirsts,
  owedName, OWED_KINDS_MAX, xpSources, gradeNote, firstsLine, firstBadge, GATHER_TOPS, benchTop, madeShown,
} from '../../../src/ui/professions/craftHall.js';
import { craftXpLine, dishFirstLine, masonWorksFirstLine } from '../../../src/ui/craftXpWords.js';
import {
  setProfessionsPages, drawProfessionsPage, drawCraftingPage, drawStoresPage, resetProfPages, PROF_PAGE_SECTIONS, PROF_STATS_PAGES, professionsKeyAt,
  stationDoorAt, stationHere, selectProfession, craftsHeld, CRAFT_TIMES_MAX, PATTERN_SHOWS, patternFirst, OWED_SHOWN, madeOf, stationActLabel,
} from '../../../src/ui/professions/profPages.js';
import { profPageAt } from '../../../src/ui/pauseDoor.js';
import { setPref } from '../../../src/systems/uiPrefs.js';
import { utcDay } from '../../../src/net/marksLaw.js';
import { hostText } from '../../hostText.mjs';

const noWait = () => Promise.resolve();
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
const NOON = utcDay(T0) * 86_400 + 12 * 3600;
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const meters = [];
const kit = { el, divider: (w) => el('h3', null, w), meter: (now, max) => { meters.push([now, max]); return el('div', 'px-meter'); } };

/** A character on the real Worker, its Stores and tracks written as the service keeps them, and a book reading it. */
async function standBook() {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on' });
  const raw = s.env.DB._raw;
  const mac = await s.seated('Mac');
  const give = (m, origin, qty) => raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = excluded.qty`).run(mac.id, mac.character, m, origin, qty);
  const track = (prof, xp) => raw.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, spec50, spec100, updated_at) VALUES (?, ?, ?, ?, NULL, NULL, ?)
    ON CONFLICT (player, char_id, profession) DO UPDATE SET xp = excluded.xp`).run(mac.id, mac.character, prof, xp, NOON);
  const door = accountProf({ fetch: s.fetch, storage: sessionStorageOf(SESSION_KEY, mac) });
  const book = createProfBook({ door, storage: memStorage(), character: () => mac.character, now: () => NOON * 1000, sleep: noWait });
  return { s, raw, mac, give, track, book };
}

// ─── THE SERVICE SAYS WHAT WAS MADE, AND THE LAW KEYS IT AS THE DECISIONS DO ───

test('CRAFT-HALL the service\'s state says what the character has made - its crafts, the works whose first pays and its brews - and the law keys it as the first-make decisions do: an Ebony Longsword spends tier 6\'s Longsword first, so an Adamantium one after it is no first on the service and none in the law; a cut spends the cut\'s; the book notes each act it is answered at once (mutants: the state without `made`; a work that pays no first listed; the kin read as the recipe; the book\'s note gone)', async (t) => {
  t.mock.method(Date, 'now', () => NOON * 1000);
  const { raw, mac, give, track, book } = await standBook();
  track('smithing', xpForRank(70));
  track('building', 0);
  for (const [m, n] of [['ingot:ebony', 6], ['ingot:adamantium', 6], ['metal:copper', 4], ['leather:cured', 4], ['ingot:iron', 4], ['metal:tin', 4], ['stone:rough', 6]]) give(m, 'own', n);
  assert.equal((await book.refresh()).ok, true);
  assert.deepEqual(book.state.made && [...book.state.made.crafts], [], 'nothing made yet - and the state says so, not null');
  assert.equal(firstOwed(book.state.made, 'longsword@6', 'smithing'), true);
  const first = async (id) => { const r = await book.craft(id, { clean: false, name: 'Mac' }, () => {}); assert.equal(r.ok, true, JSON.stringify(r)); return r.data.first; };
  assert.equal(await first('longsword:ebony'), true, 'the service\'s first');
  assert.deepEqual([...firstMakesSpent(book.state.made, 'smithing')], ['longsword@6'], 'noted at once, by the answer');
  assert.equal(recipeFirstOwed(book.state.made, recipeById('longsword:adamantium')), false, 'its kin\'s first is spent too - one pattern at one grade');
  assert.equal(await first('longsword:adamantium'), false, 'and the service agrees: no first');
  assert.equal(recipeFirstOwed(book.state.made, recipeById('dagger:iron')), true);
  const smelt = await book.smelt('cut:stone', 1, { clean: false });
  assert.equal(smelt.ok, true, JSON.stringify(smelt));
  assert.equal(workFirstOwed(book.state.made, MASON_RECIPES[0]), false, 'the cut\'s first spent, noted');
  assert.equal(workFirstOwed(book.state.made, MASON_RECIPES[1]), true, 'the mix\'s still owed');
  // a brew's row, as the station writes it (alchemy.js brewAtStation's own table) - read back by the next state
  raw.prepare(`INSERT INTO prof_brews (player, rid, char_id, potion, keys, count, potent, unbruised, steps, xp, first, at, n, witnessed)
    VALUES (?, 'brew-1', ?, 'healing', '[]', 1, 0, 0, 0, 0, 1, ?, 'n1', 1)`).run(mac.id, mac.character, NOON);
  raw.prepare(`INSERT INTO prof_smelts (player, rid, char_id, recipe, count, xp, first, at, n, own, bought)
    VALUES (?, 'smelt-9', ?, 'ingot:iron', 1, 0, 0, ?, 'n9', 1, 0)`).run(mac.id, mac.character, NOON);
  assert.equal((await book.refresh({ force: true })).ok, true);
  assert.deepEqual([[...book.state.made.crafts].sort(), [...book.state.made.works], [...book.state.made.brews]],
    [['longsword:adamantium', 'longsword:ebony'], ['cut:stone'], ['healing']], 'every craft by its recipe, the cut (never the iron smelt - it pays no first), the brew by its potion');
  assert.equal(brewFirstOwed(book.state.made, POTIONS.find((p) => p.id === 'healing')), false);
  assert.equal(firstStanding(book.state.made, 'provisioning').spent, 1, 'the brew counts on Provisioning');
  assert.equal(firstStanding(book.state.made, 'building').spent, 1, 'the cut on Building');
  assert.deepEqual(firstStanding(book.state.made, 'smithing'), { all: firstMakesOf('smithing').length, spent: 1, share: 500, closed: false });   // PIN MOVED (AUDIT HORIZONTAL A2): the standing says whether its craft is closed
});

test('CRAFT-HALL the law alone: a made set unknown says nothing (null), never "all owed"; a key of another track is none of this one\'s; Enchanting has no first-makes; every first-make of a craft track is a key the service decides by (mutants: null read as empty; the track\'s filter gone)', () => {
  assert.equal(firstMakesSpent(null, 'smithing'), null);
  assert.equal(firstStanding(null, 'smithing'), null);
  assert.equal(recipeFirstOwed(null, recipeById('dagger:iron')), null);
  assert.deepEqual(firstStanding(null, 'enchanting'), { all: 0, spent: 0, share: 0, closed: false });   // PIN MOVED (AUDIT HORIZONTAL A2)
  const made = { crafts: new Set(['dagger:iron', 'stew:north']), works: new Set(['cut:stone', 'ingot:iron']), brews: new Set(['healing']) };
  assert.deepEqual([...firstMakesSpent(made, 'smithing')], ['dagger@1']);
  assert.deepEqual([...firstMakesSpent(made, 'building')], ['cut:stone']);
  assert.deepEqual([...firstMakesSpent(made, 'provisioning')].sort(), ['healing', 'stew@1']);
  assert.equal(firstOwed(made, 'dagger@1', 'building'), null, 'Smithing\'s key on Building\'s track is none of it');
  for (const tr of CRAFT_TRACKS) for (const k of firstMakesOf(tr)) assert.ok(RECIPES.some((r) => firstCraftKey(r) === k) || MASON_RECIPES.some((w) => w.id === k) || POTIONS.some((p) => p.id === k), `${tr} ${k}`);
});

// ─── WHAT RAISES A TRACK, AND ITS BAR ────────────────────────────────

test('CRAFT-HALL what raises a track is reckoned by the laws the service credits by, at the rank: a harvest\'s 15 a grade and half again clean, a craft\'s 20, a smelt\'s 10, a cut\'s and a dish\'s, a brew\'s, a disenchant\'s 5 an Essence a grade, each track\'s first-time share, the works that pay none, a writ twice its pay; the Firmament said where it adds; the grade\'s note (mutants: a figure typed; the clean act unread; a share another track\'s)', () => {
  const rank = 34, top = topTierOf(rank);
  const rows = (id, opts) => new Map(xpSources(id, rank, opts));
  assert.equal(rows('mining').get('Mining a vein or boulder'), `${harvestXp(top, rank, false)} XP at grade ${top}, ${harvestXp(top, rank, true)} for clean work`);
  assert.equal(rows('smithing').get('A piece at the anvil or jeweler\'s bench'), `${craftXp(top, rank)} XP at grade ${top}`);
  assert.equal(rows('smithing').get('Smelting an ingot'), `${smeltXp(top, 1, rank)} XP at grade ${top}`);
  assert.equal(rows('smithing').get('Your first piece at each grade'), '+500 XP, once each');
  assert.equal(rows('building').get('Your first piece at each grade, first cut and first mix'), `+${FIRST_MAKE_SHARE.building.toLocaleString('en')} XP, once each`);
  assert.equal(rows('building').get('A cut or mix at the mason\'s bench'), `${masonXp(1, rank)} XP each, ${masonXp(1, rank, { clean: true })} for clean work`);
  assert.equal(rows('building').get('Sawing planks'), 'No XP');
  assert.equal(rows('outfitting').get('Curing, weaving and spinning'), 'No XP');
  assert.equal(rows('provisioning').get('Cooking a dish'), `${cookXp(rank)} XP, ${cookXp(rank, { clean: true })} with every pan on time`);
  const best = POTIONS.filter((p) => rank >= p.rank).sort((a, b) => b.tier - a.tier)[0];
  assert.equal(rows('provisioning').get('Brewing a potion'), `${brewXp(best, rank)} XP at grade ${best.tier}`);
  assert.equal(rows('enchanting').get('Disenchanting a crafted piece'), `${DISENCHANT_XP} XP per Essence per grade (${DISENCHANT_XP * top} at grade ${top})`);
  for (let pay = 0; pay < 400; pay += 7) assert.equal(writXp(pay), craftWritXp(pay), 'one writ law - the row says it once');
  assert.equal(rows('herbalism').get('Court writ for herbs'), 'Twice its pay');
  assert.equal(rows('smithing', { pct: 6 }).get('Your Firmament stars'), '+6%, not on writs or first-time bonuses');   // PIN MOVED (AUDIT HORIZONTAL A1): the service scales no writ's XP
  assert.equal(rows('smithing').has('Your Firmament stars'), false);
  assert.equal(gradeNote('smithing', rank), `Each grade is worth ${CRAFT_XP_PER_TIER} experience a piece and ${smeltXp(1, 1)} an ingot. Work more than two grades below your best (grade ${top}) earns a quarter.`);   // PIN MOVED (AUDIT HORIZONTAL A1): a smelt pays 10 a grade
  assert.equal(gradeNote('building', rank), `Each grade is worth ${CRAFT_XP_PER_TIER} experience. Work more than two grades below your best (grade ${top}) earns a quarter.`);
  assert.equal(gradeNote('fishing', rank), '', 'a haul is worked at the rank\'s own grade');
  for (const p of PROFESSIONS) assert.ok(xpSources(p.id, 0).length >= 1, `${p.id} says what raises it`);
});

test('CRAFT-HALL the bar: the rank\'s floor to the next, full at Master and where the crafter\'s limit holds the track at its rank - never crawling toward a rank the service never pays; what is left to the next rank said, none at either end (mutants: the floor read as nought; the limit unread)', () => {
  assert.deepEqual(trackBar({ xp: 11_900, rank: 34 }), { now: 11_900 - xpForRank(34), max: xpForRank(35) - xpForRank(34) });
  assert.equal(toNextWords({ xp: 11_900, rank: 34 }), `${xpForRank(35) - 11_900} XP to rank 35`);
  assert.deepEqual(trackBar({ xp: 100_000, rank: 100 }), { now: 1, max: 1 });
  assert.equal(toNextWords({ xp: 100_000, rank: 100 }), '');
  const held = { cap: xpForRank(51) - 1, by: ['building', 'provisioning'], rank: 50 };
  assert.deepEqual(trackBar({ xp: xpForRank(51) - 1, rank: 50 }, held), { now: 1, max: 1 });
  assert.equal(toNextWords({ xp: xpForRank(51) - 1, rank: 50 }, held), '');
  assert.deepEqual(trackBar({ xp: xpForRank(10), rank: 10 }, held), { now: 0, max: xpForRank(11) - xpForRank(10) }, 'a third craft at 10 climbs to 11 as ever');
});

test('CRAFT-HALL the owed first-makes a rank opens: still owed and makeable, the highest grade first, a jewel\'s every gem said as a count past four kinds; the stations\' tracks the service credits (mutants: a spent one listed; a locked one listed; the order)', () => {
  const made = { crafts: new Set(['longsword:ebony']), works: new Set(), brews: new Set() };
  const owed = owedOpenFirsts(made, 'smithing', 70);
  assert.ok(!owed.some((f) => f.key === 'longsword@6'), 'spent');
  assert.ok(!owed.some((f) => f.tier === 7), 'grade 7 asks rank 90');
  assert.ok(owed.length > 0 && owed.every((f, i) => i === 0 || owed[i - 1].tier >= f.tier), 'the highest grade first');
  assert.equal(owed[0].tier, 6);
  const sword = owedOpenFirsts({ crafts: new Set(), works: new Set(), brews: new Set() }, 'smithing', 70).find((f) => f.key === 'longsword@6');
  assert.equal(owedName(sword), 'Longsword, grade 6 (Adamantium, Ebony, Orcish, or Warforged)');
  const amulet = owed.find((f) => f.kinds.length > OWED_KINDS_MAX);
  assert.match(owedName(amulet), /^[A-Za-z ]+, grade \d \(any of \d+ kinds\)$/);
  assert.deepEqual(owedOpenFirsts(null, 'smithing', 70), []);
  assert.deepEqual(Object.fromEntries(Object.entries(STATION_TRACKS)), {
    forge: 'smithing', anvil: 'smithing', 'temper-anvil': 'smithing', jeweller: 'smithing', workbench: 'building', mason: 'building',
    loom: 'outfitting', 'temper-loom': 'outfitting', fire: 'provisioning', alchemy: 'provisioning', enchant: 'enchanting',
  });
  assert.deepEqual([...CRAFT_TRACKS], PROFESSIONS.filter((p) => p.kind === 'crafting').map((p) => p.id));
  assert.equal(firstsLine({ all: 221, spent: 12, share: 500 }), 'First-time bonuses: 12 of 221 made (+500 XP each)');
  assert.equal(firstsLine(null), '');
  assert.deepEqual([firstBadge(true), firstBadge(false), firstBadge(null)], ['First-time bonus', 'Made before', '']);
});

// ─── THE WORDS AT A STATION ──────────────────────────────────────────

test('CRAFT-HALL a station\'s line says the first owed or spent where it is known, the rule where it is not: a piece, a dish, the mason\'s two works and a brew (mutants: the spent line on an owed first; the owed line where unknown)', () => {
  const dagger = recipeById('dagger:iron');
  assert.equal(craftXpLine(dagger, 0, 'Smithing'), '20 Smithing experience, and 500 more the first time you make this piece at this grade.', 'unknown: the rule, as it always was');
  assert.equal(craftXpLine(dagger, 0, 'Smithing', {}, false, true), '20 Smithing experience, plus a 500 first-time bonus.');
  assert.equal(craftXpLine(dagger, 0, 'Smithing', {}, false, false), '20 Smithing experience. You have made this before, so no first-time bonus.');
  const stew = recipeById('stew:north');
  assert.equal(dishFirstLine(stew, 'Provisioning', {}, 30, false), 'You have cooked this before, so no first-time bonus.');
  assert.equal(dishFirstLine(stew, 'Provisioning', {}, 30, true), `First time cooking this: ${FIRST_MAKE_SHARE.provisioning.toLocaleString('en')} more Provisioning experience.`);
  assert.equal(masonWorksFirstLine(0, 'Building', {}, { cut: false, mix: true }), `First-time bonus, ${FIRST_MAKE_SHARE.building.toLocaleString('en')} Building experience each: first cut made, first mix still to earn.`);
  assert.equal(masonWorksFirstLine(0, 'Building', {}, null), `Your first cut and your first mix each earn ${FIRST_MAKE_SHARE.building.toLocaleString('en')} more Building experience.`);
});

// ─── THE PAGES ───────────────────────────────────────────────────────

function standIn(book, at = {}) {
  const crafts = [];
  const craft = async (id, opts) => { crafts.push([id, opts]); return crafts.length > (at.refuseAfter ?? Infinity) ? { ok: false, text: 'Refused.' } : { ok: true, text: `Made ${id}.` }; };
  const station = (k) => () => (at[k] ? { kind: 'home', fee: 0 } : null);
  setProfessionsPages({
    book, name: (k) => k, withdraw: craft, smelt: craft, craft, brew: craft, stock: craft, clothing: () => 'MensClothing', purse: () => 1e9,
    forge: station('forge'), workbench: station('workbench'), loom: station('loom'), mason: station('mason'), fire: station('fire'),
    jeweller: station('jeweller'), alchemy: station('alchemy'), enchanter: station('enchanter'), disenchantable: () => [], disenchant: craft,
  });
  return crafts;
}

test('CRAFT-HALL the rails: the Crafting page beside the Professions page on the Stats rail, the Stores the Holdings rail\'s; every one a professions landing; the Professions key lands on the Crafting page at the station the player stands at (its section focused, a forge\'s the anvil\'s) and on the Professions page anywhere else; a station\'s own door the Crafting page; the pause door asks the key\'s landing, and every host door names it (mutants: the key\'s landing unread; the forge\'s focus; a host\'s old Stores landing)', async (t) => {
  t.mock.method(Date, 'now', () => NOON * 1000);
  assert.deepEqual(PROF_PAGE_SECTIONS.map(([id]) => id), ['professions', 'crafting', 'stores']);
  assert.deepEqual([...PROF_STATS_PAGES], ['professions', 'crafting']);
  assert.deepEqual(PROF_PAGE_SECTIONS.map(([id]) => profPageAt(id)), [true, true, true]);
  const { book } = await standBook();
  await book.refresh();
  standIn(book, {});
  assert.equal(stationHere(), null);
  assert.equal(professionsKeyAt(), 'professions');
  standIn(book, { forge: true });
  assert.equal(stationHere(), 'anvil');
  assert.equal(professionsKeyAt(), 'crafting');
  standIn(book, { fire: true });
  assert.equal(stationHere(), 'fire');
  assert.equal(stationDoorAt('loom'), 'crafting');
  setProfessionsPages(null);
  const door = hostText('src/ui/pauseDoor.js');
  assert.match(door, /enhancedPauseOverlay\(show, hooks\.at === 'professions' \? \{ \.\.\.hooks, at: professionsKeyAt\(\) \} : hooks\)/);
  const modes = hostText('src/scenes/worldModes.js'), world = hostText('src/scenes/world.js');
  assert.match(modes, /interiorKeyCtx\.togglePause\(\{ at: stationDoorAt\('fire'\) \}\)/);
  assert.match(modes, /interiorKeyCtx\.togglePause\(\{ at: stationDoorAt\(piece\.station\) \}\)/);
  assert.match(modes, /label: stationActLabel\(kind\), action: \(\) => \{ leave\(\); interiorKeyCtx\.togglePause\(\{ at: stationDoorAt\(kind\) \}\); \}/);   // PIN MOVED (AUDIT HORIZONTAL A7): the option's words profPages.js's, through t()
  assert.match(world, /hudCtx\.togglePause\(\{ at: stationDoorAt\('workbench'\) \}\);/);
  assert.doesNotMatch(modes + world, /togglePause\(\{ at: 'stores' \}\)/, 'no station door lands under the goods any more');
  const menu = hostText('src/ui/enhanced/enhancedMenu.js');
  assert.match(menu, /crafting: \(d\) => drawCraftingPage\(d, render, profKit\)/);
  assert.match(menu, /const profKit = \{ el, divider: pxDivider, meter: pxMeter, go: profGo, keyName: /);
});

test('CRAFT-HALL the Crafting page: the five crafts\' headers - each its rank, its bar from the rank\'s floor, its XP and what is left, its first-time bonuses made - pressed to open the Professions page on it; the crafter\'s rule; where no station stands here, where they are and the bound key; the stations tiled, the one here drawn with its own header; a door to the Stores (mutants: a header gone; the press\'s track; the key unread)', async (t) => {
  t.mock.method(Date, 'now', () => NOON * 1000);
  resetProfPages();
  setPref('gentleActs', false);
  const { track, book } = await standBook();
  track('smithing', xpForRank(34) + 100);
  await book.refresh();
  standIn(book, {});
  const went = [];
  const pageKit = { ...kit, go: (p) => went.push(p), keyName: () => 'P' };
  try {
    let root = el('div');
    meters.length = 0;
    drawCraftingPage(root, () => {}, pageKit);
    const heads = [...root.querySelectorAll('.prof-track')];
    assert.deepEqual(heads.map((h) => h.querySelector('b').textContent), CRAFT_TRACKS.map((id) => PROFESSIONS.find((p) => p.id === id).name));
    assert.equal(heads[0].querySelector('.prof-rank').textContent, 'Apprentice 34');
    assert.equal(heads[0].querySelector('.prof-track-xp').textContent, `${(xpForRank(34) + 100).toLocaleString('en')} / ${xpForRank(35).toLocaleString('en')} XP · ${(xpForRank(35) - xpForRank(34) - 100).toLocaleString('en')} XP to rank 35`);
    assert.equal(heads[0].querySelector('.prof-track-firsts').textContent, `First-time bonuses: 0 of ${firstMakesOf('smithing').length} made (+500 XP each)`);
    assert.equal(heads[4].querySelector('.prof-track-firsts').textContent, 'No first-time bonuses', 'Enchanting has none');
    assert.deepEqual(meters[0], [100, xpForRank(35) - xpForRank(34)]);
    heads[2].onclick();
    assert.deepEqual(went, ['professions']);
    root = el('div');
    drawProfessionsPage(root, () => {}, pageKit);
    assert.equal(root.querySelector('.prof-title').querySelector('h3').textContent, PROFESSIONS.find((p) => p.id === CRAFT_TRACKS[2]).name, 'the pressed craft is the page\'s');
    root = el('div');
    drawCraftingPage(root, () => {}, pageKit);
    assert.match(root.textContent, /Press P there to open this page on it\./);
    assert.match(root.textContent, /Only 2 crafts can rise past Journeyman/);
    assert.ok(root.querySelector('.prof-stations'), 'the stations tiled');
    [...root.querySelector('.prof-doors').querySelectorAll('button')].find((b) => b.textContent === 'Your Stores').onclick();
    assert.deepEqual(went, ['professions', 'stores']);
    standIn(book, { forge: true });
    root = el('div');
    drawCraftingPage(root, () => {}, pageKit);
    assert.doesNotMatch(root.textContent, /Press P there/, 'at a station the line is gone');
    const anvil = [...root.querySelectorAll('.prof-station')].find((s) => s.querySelector('h3')?.textContent === 'The Anvil');
    assert.equal(anvil.querySelector('.prof-track').querySelector('b').textContent, 'Smithing', 'the station worked here carries its track\'s header');
    assert.equal(anvil.querySelector('h3').id, 'prof-station-anvil', 'the key\'s landing');
  } finally {
    setProfessionsPages(null);
  }
});

test('CRAFT-HALL the Professions page: the chosen track\'s bar under its name, its XP and what is left; what raises it, row by row; a craft\'s first-time bonuses - made of all, a meter, the owed ones its rank opens (eight, then all on a press), a door to the Crafting page; a gatherer none (mutants: the bar gone; the owed list\'s cut; the show-all press)', async (t) => {
  t.mock.method(Date, 'now', () => NOON * 1000);
  resetProfPages();
  const { track, book } = await standBook();
  track('smithing', xpForRank(70));
  await book.refresh();
  standIn(book, {});
  let redraws = 0;
  const went = [];
  const draw = () => { const root = el('div'); meters.length = 0; drawProfessionsPage(root, () => { redraws++; }, { ...kit, go: (p) => went.push(p) }); return root; };
  try {
    selectProfession('smithing');
    let root = draw();
    const rows = new Map([...root.querySelectorAll('.prof-raise')].map((r) => [r.querySelector('.k').textContent, r.querySelector('.v').textContent]));
    assert.deepEqual([...rows.keys()], xpSources('smithing', 70).map(([k]) => k));
    assert.equal(rows.get('A piece at the anvil or jeweler\'s bench'), `${craftXp(6, 70)} XP at grade 6`);
    assert.equal(root.querySelector('.prof-firsts').textContent, `First-time bonuses: 0 of ${firstMakesOf('smithing').length} made (+500 XP each)`);
    const owed = owedOpenFirsts(book.state.made, 'smithing', 70);
    assert.match(root.textContent, new RegExp(`Still to earn at your rank: ${owed.length}\\.`));
    assert.equal(root.querySelectorAll('.prof-owed-row').length, OWED_SHOWN);
    const more = [...root.querySelectorAll('button')].find((b) => b.textContent === `Show all ${owed.length}`);
    more.onclick();
    assert.equal(redraws, 1);
    root = draw();
    assert.equal(root.querySelectorAll('.prof-owed-row').length, owed.length);
    [...root.querySelectorAll('button')].find((b) => b.textContent === 'Open the Crafting page').onclick();
    assert.deepEqual(went, ['crafting']);
    selectProfession('mining');
    root = draw();
    assert.equal(root.querySelector('.prof-firsts'), null, 'a gatherer has no first-time bonuses');
    assert.ok(root.querySelectorAll('.prof-raise').length >= 2);
  } finally {
    setProfessionsPages(null);
    resetProfPages();
  }
});

test('CRAFT-HALL the anvil: the show row (All, Can make now, First-time bonus - the last only where the made are known), each card its first-time bonus owed or made, a metal\'s star, the box\'s line owed or spent, Craft x N offered where two or more are held and run quick craft after quick craft until one is refused - "Made 2 of 3." (mutants: the show unread; a made card starred; the repeat not stopping; the count past the held)', async (t) => {
  t.mock.method(Date, 'now', () => NOON * 1000);
  resetProfPages();
  setPref('gentleActs', false);
  const { track, give, book } = await standBook();
  track('smithing', xpForRank(10));
  give('ingot:iron', 'own', 3); give('metal:tin', 'own', 3);
  await book.refresh();
  book.state.made.crafts.add('dagger:iron');
  const crafts = standIn(book, { forge: true, refuseAfter: 2 });
  let root;
  const draw = () => { root?.remove?.(); root = el('div'); document.body.append(root); drawStoresPage(root, draw, kit); };
  const anvil = () => [...root.querySelectorAll('.prof-station')].find((s) => s.querySelector('h3')?.textContent === 'The Anvil');
  try {
    draw();
    assert.deepEqual([...anvil().querySelectorAll('.prof-show')].map((b) => b.textContent), PATTERN_SHOWS.map(([, w]) => w));
    const card = (name) => [...anvil().querySelectorAll('.prof-recipe')].find((c) => c.querySelector('b').textContent === name);
    assert.equal(card('Dagger').querySelector('.prof-first').textContent, 'First-time bonus', 'grade 2 still owed at rank 10');
    assert.equal(card('Dagger').querySelector('.prof-first').className, 'prof-first');
    [...anvil().querySelectorAll('.prof-show')].find((b) => b.textContent === 'First-time bonus').onclick();
    assert.ok(card('Dagger'), 'a pattern with a grade owed stays');
    [...anvil().querySelectorAll('.prof-show')].find((b) => b.textContent === 'Can make now').onclick();
    assert.ok(anvil().querySelectorAll('.prof-recipe').length >= 1);
    assert.ok([...anvil().querySelectorAll('.prof-recipe')].every((c) => !c.className.includes('prof-locked')), 'only what the held goods make');
    card('Dagger').onclick();
    // the iron the held goods make - the box its metal's
    const made = () => [...anvil().querySelector('.prof-made').querySelectorAll('.prof-family')];
    made().find((b) => b.textContent.startsWith('Iron')).onclick();
    const metals = made().map((b) => b.textContent);
    assert.ok(metals.includes('Iron'), 'iron made before: no star');
    assert.ok(metals.some((m) => m === 'Steel ★'), 'steel owed and open: starred');
    const notes = [...anvil().querySelector('.prof-craft').querySelectorAll('p')].map((p) => p.textContent);
    assert.ok(notes.includes(`${craftXp(1, 10)} Smithing experience. You have made this before, so no first-time bonus.`), notes.join(' | '));
    assert.equal(craftsHeld(recipeById('dagger:iron').inputs, book), 3);
    assert.equal(CRAFT_TIMES_MAX, 10);
    const times = anvil().querySelector('.prof-times');
    assert.ok(times, 'Craft x N where three are held');
    assert.equal(times.querySelector('button').textContent, 'Craft x2');
    times.querySelector('input').value = '3';
    times.querySelector('input').oninput();
    assert.equal(times.querySelector('button').textContent, 'Craft x3', 'AUDIT HORIZONTAL A4: the button says the count typed');
    await times.querySelector('button').onclick();
    assert.deepEqual(crafts.map(([id]) => id), ['dagger:iron', 'dagger:iron', 'dagger:iron'], 'quick crafts, one after another, the third refused');
    assert.ok(crafts.every(([, o]) => o.clean === false));
    assert.match(root.textContent, /Made 2 of 3\. Refused\./);
  } finally {
    setProfessionsPages(null);
    resetProfPages();
  }
});

test('CRAFT-HALL patternFirst: a pattern\'s open grades say its first-time bonus - owed where any is, made where all are, nothing where none is open or nothing is known (mutants: a locked grade read; null read as made)', () => {
  const pt = { recipes: [recipeById('dagger:iron'), recipeById('dagger:steel')] };
  const open = (r) => ({ open: r.rank <= 10, can: true, raw: false, share: 1 });
  const made = { crafts: new Set(['dagger:iron']), works: new Set(), brews: new Set() };
  assert.equal(patternFirst(pt, open, (r) => recipeFirstOwed(made, r)), 'owed');
  made.crafts.add('dagger:steel');
  assert.equal(patternFirst(pt, open, (r) => recipeFirstOwed(made, r)), 'made');
  assert.equal(patternFirst(pt, () => ({ open: false }), (r) => recipeFirstOwed(made, r)), null);
  assert.equal(patternFirst(pt, open, (r) => recipeFirstOwed(null, r)), null);
  assert.equal(patternFirst(pt, open, null), null);
  assert.equal(trackOf('jewelcrafting'), STATION_TRACKS.jeweller);
});

// ─── AUDIT HORIZONTAL (2026-10-27, the owner: "Audit this") ─────────

test('CRAFT-HALL AUDIT HORIZONTAL A1: what raises a track names a grade its act is worked at, at every rank - no vein, tree or hide past 6, the loom\'s pieces to 5, the workbench\'s to 6, the anvil\'s Daedric 7; a common herb no clean pick; a Court writ never a gem (mutants: a row at the rank\'s top; the patterns\' rank unread; the clean herb below 10)', () => {
  const tierOf = (k) => material(k)?.tier ?? 0;
  assert.equal(Math.max(...[...Object.values(VEIN_TABLES).flat(), ...DUNGEON_VEINS, 'ore:moonstone', 'ore:mithril', 'ore:ebony', 'ore:orichalcum', 'ore:adamantium'].map(tierOf)), 6, 'the ores and metals any vein stands');
  assert.equal(Math.max(...[...Object.values(WOOD_TABLES).flat(), ...Object.values(RARE_WOODS)].map(tierOf)), 6);
  assert.equal(Math.max(...HIDES.map((h) => h.tier)), 6);
  assert.deepEqual({ ...GATHER_TOPS }, { mining: 6, logging: 6, hunting: 6 });
  const grade = (txt) => Number(/at grade (\d)/.exec(txt)?.[1]);
  const best = (profs, rank) => Math.max(...RECIPES.filter((r) => profs.includes(r.profession) && r.rank <= rank).map((r) => r.tier));
  for (let rank = 0; rank <= 100; rank++) {
    const top = topTierOf(rank), row = (id, k) => new Map(xpSources(id, rank)).get(k);
    for (const [id, k] of [['mining', 'Mining a vein or boulder'], ['logging', 'Felling a tree'], ['hunting', 'Skinning a kill']]) {
      const g = Math.min(top, 6);
      assert.equal(row(id, k), `${harvestXp(g, rank, false)} XP at grade ${g}, ${harvestXp(g, rank, true)} for clean work`, `${id} at ${rank}`);
    }
    for (const [id, k, profs] of [['outfitting', 'A piece at the loom', ['outfitting']], ['building', 'A piece at the workbench', ['carpentry']], ['smithing', 'A piece at the anvil or jeweler\'s bench', ['smithing', 'jewelcrafting']]]) {
      assert.equal(grade(row(id, k)), best(profs, rank), `${id} at ${rank}`);
      assert.equal(benchTop(profs, rank), best(profs, rank));
    }
    assert.equal(/clean work/.test(row('herbalism', 'Picking herbs')), rank >= 10, `herbs at ${rank}: only an uncommon herb is picked clean`);
  }
  const at90 = (id, k) => new Map(xpSources(id, 90)).get(k);
  assert.equal(at90('outfitting', 'A piece at the loom'), '100 XP at grade 5', 'it said 140 at grade 7');
  assert.equal(at90('building', 'A piece at the workbench'), '120 XP at grade 6');
  assert.equal(at90('smithing', 'A piece at the anvil or jeweler\'s bench'), '140 XP at grade 7', 'a Daedric piece is made at 90');
  assert.equal(at90('mining', 'Mining a vein or boulder'), '90 XP at grade 6, 135 for clean work', 'it said 105 at grade 7');
  assert.equal(new Map(xpSources('herbalism', 5)).get('Picking herbs'), `${harvestXp(1, 5, false)} XP at grade 1`);
  assert.equal(new Map(xpSources('mining', 34)).get('Court writ for ore or stone'), 'Twice its pay');
  const ground = Object.values(CLIMATES).map((climate) => ({ climate, confirmed: true }));
  assert.ok(REGION_NAMES.every((_, r) => regionWritTable(r, ground, 0).every((w) => !w.material.startsWith('gem:'))), 'no Court asks a gem');
});

test('CRAFT-HALL AUDIT HORIZONTAL A2: a craft that takes no more XP - held by the crafter\'s limit, or at Master - offers no first-time bonus: no owed list, no badge, no show, its line says they pay nothing, and its list row\'s bar is full as its header\'s; a craft with room left is not closed (mutants: the closed craft unread; the owed note shown; the row\'s bar unlimited; the room misread)', async (t) => {
  t.mock.method(Date, 'now', () => NOON * 1000);
  resetProfPages();
  setPref('gentleActs', false);
  const { track, give, book } = await standBook();
  track('building', xpForRank(60)); track('provisioning', xpForRank(60)); track('smithing', xpForRank(51) - 1);
  give('ingot:iron', 'own', 6); give('metal:tin', 'own', 6);
  await book.refresh();
  const made = madeOf(book), dagger = recipeById('dagger:iron');
  assert.deepEqual(made.closed, ['smithing']);
  assert.equal(recipeFirstOwed(book.state.made, dagger), true, 'the book\'s facts: never made');
  assert.equal(recipeFirstOwed(made, dagger), null, 'as the pages read it: none offered');
  assert.deepEqual(owedOpenFirsts(made, 'smithing', 50), []);
  assert.equal(firstsLine(firstStanding(made, 'smithing')), `First-time bonuses: 0 of ${firstMakesOf('smithing').length} made. This craft can rise no further, so they pay nothing.`);
  standIn(book, { forge: true });
  try {
    selectProfession('smithing');
    meters.length = 0;
    let root = el('div');
    drawProfessionsPage(root, () => {}, kit);
    assert.doesNotMatch(root.textContent, /Still to earn|All made at your rank/, 'it said "Still to earn at your rank: 133."');
    assert.equal(root.querySelectorAll('.prof-owed-row').length, 0);
    assert.match(root.querySelector('.prof-firsts').textContent, /can rise no further/);
    const order = [...PROFESSIONS.filter((p) => p.kind === 'gathering'), ...PROFESSIONS.filter((p) => p.kind === 'crafting')].map((p) => p.id);
    assert.deepEqual(meters[order.indexOf('smithing')], [1, 1], 'the list row full, as the header');
    root = el('div');
    document.body.append(root);
    drawStoresPage(root, () => {}, kit);
    const anvil = [...root.querySelectorAll('.prof-station')].find((x) => x.querySelector('h3')?.textContent === 'The Anvil');
    assert.deepEqual([...anvil.querySelectorAll('.prof-show')].map((b) => b.textContent), ['All', 'Can make now'], 'no First-time bonus show');
    assert.equal(anvil.querySelectorAll('.prof-first').length, 0, 'no card marked');
    root.remove();
  } finally {
    setProfessionsPages(null);
    resetProfPages();
  }
  // THE SERVICE'S RULE, RECORDED (Professions-Arc 56.5): a first on a held track is spent at no XP - unearnable either way
  const r = await book.craft('dagger:iron', { clean: false, name: 'Mac' }, () => {});
  assert.deepEqual([r.ok, r.data.xp, r.data.first, r.data.firstPaid], [true, 0, true, true]);
  const none = { crafts: new Set(), works: new Set(), brews: new Set() };
  assert.deepEqual(madeShown(none, [{ profession: 'smithing', xp: xpForRank(100) }]).closed, ['smithing'], 'Master: closed');
  assert.deepEqual(madeShown(none, [{ profession: 'building', xp: xpForRank(60) }, { profession: 'provisioning', xp: xpForRank(60) }, { profession: 'smithing', xp: xpForRank(10) }]).closed, [], 'a third craft at 10 still climbs to 50');
  assert.deepEqual(madeShown(none, [{ profession: 'smithing', xp: xpForRank(100) - 1 }]).closed, [], 'one XP short of Master');
  assert.equal(madeShown(null, []), null);
});

test('CRAFT-HALL AUDIT HORIZONTAL A3: `made` is one character\'s - a second character of the same account crafts a dagger, cuts stone and brews, through the real Worker, and the first\'s state lists none of it (mutants: the crafts\', the works\' and the brews\' character unread)', async (t) => {
  t.mock.method(Date, 'now', () => NOON * 1000);
  const { s, raw, mac, book } = await standBook();
  const alt = await seatRealm(s.env, mac.secret, 'Macalt');
  for (const [p, xp] of [['smithing', xpForRank(10)], ['building', 0]]) {
    raw.prepare('INSERT INTO prof_tracks (player, char_id, profession, xp, spec50, spec100, updated_at) VALUES (?, ?, ?, ?, NULL, NULL, ?)').run(mac.id, alt.id, p, xp, NOON);
  }
  for (const m of ['ingot:iron', 'metal:tin', 'stone:rough']) raw.prepare('INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, \'own\', 6)').run(mac.id, alt.id, m);
  const altBook = createProfBook({ door: accountProf({ fetch: s.fetch, storage: sessionStorageOf(SESSION_KEY, mac) }), storage: memStorage(), character: () => alt.id, now: () => NOON * 1000, sleep: noWait });
  assert.equal((await altBook.refresh()).ok, true);
  assert.equal((await altBook.craft('dagger:iron', { clean: false, name: 'Macalt' }, () => {})).ok, true);
  assert.equal((await altBook.smelt('cut:stone', 1, { clean: false })).ok, true);
  // a brew's row, as the station writes it (alchemy.js brewAtStation's own table)
  raw.prepare(`INSERT INTO prof_brews (player, rid, char_id, potion, keys, count, potent, unbruised, steps, xp, first, at, n, witnessed)
    VALUES (?, 'brew-alt', ?, 'healing', '[]', 1, 0, 0, 0, 0, 1, ?, 'n-alt', 1)`).run(mac.id, alt.id, NOON);
  assert.equal((await altBook.refresh({ force: true })).ok, true);
  assert.deepEqual([[...altBook.state.made.crafts], [...altBook.state.made.works], [...altBook.state.made.brews]], [['dagger:iron'], ['cut:stone'], ['healing']], 'the maker\'s own');
  assert.equal((await book.refresh()).ok, true);
  assert.deepEqual([[...book.state.made.crafts], [...book.state.made.works], [...book.state.made.brews]], [[], [], []], 'none of it the first character\'s');
  assert.equal(recipeFirstOwed(book.state.made, recipeById('dagger:iron')), true, 'its dagger\'s first still owed');
});

test('CRAFT-HALL AUDIT HORIZONTAL (the lane\'s suspected read): a state read answered before a craft and heard after it is read again - the craft\'s first, its spent goods and its XP stand (mutant: the overtaken read applied)', async (t) => {
  t.mock.method(Date, 'now', () => NOON * 1000);
  const { s, mac, track, give, raw } = await standBook();
  track('smithing', xpForRank(10));
  give('ingot:iron', 'own', 6); give('metal:tin', 'own', 6);
  const real = accountProf({ fetch: s.fetch, storage: sessionStorageOf(SESSION_KEY, mac) });
  let hold = null, reads = 0;
  const door = { ...real, state: async (c) => { reads++; const r = await real.state(c); if (hold) await hold; return r; } };
  const book = createProfBook({ door, storage: memStorage(), character: () => mac.character, now: () => NOON * 1000, sleep: noWait });
  assert.equal((await book.refresh()).ok, true);
  let release;
  hold = new Promise((res) => { release = res; });
  const reading = book.refresh({ force: true });   // answered now, before the craft - heard after it
  await new Promise((res) => setTimeout(res, 20));
  assert.equal((await book.craft('dagger:iron', { clean: false, name: 'Mac' }, () => {})).ok, true);
  const after = [[...book.state.made.crafts], book.store('ingot:iron').own, book.track('smithing').xp];
  hold = null;
  release();
  assert.equal((await reading).ok, true);
  assert.deepEqual([[...book.state.made.crafts], book.store('ingot:iron').own, book.track('smithing').xp], after, 'the craft stands');
  const xp = Number(raw.prepare('SELECT xp FROM prof_tracks WHERE player = ? AND char_id = ? AND profession = \'smithing\'').get(mac.id, mac.character).xp);
  assert.deepEqual(after, [['dagger:iron'], 5, xp]);
  assert.equal(reads, 3, 'the overtaken read asked again, once');
});

test('CRAFT-HALL AUDIT HORIZONTAL A7: the chooser at an alchemy or enchanting station offers its act through t(), and the Professions key\'s row says where it lands (mutant: the option\'s words glued in the host)', () => {
  assert.deepEqual(['alchemy', 'enchant', 'forge'].map(stationActLabel), ['2 - Brew (Crafting page)', '2 - Disenchant (Crafting page)', '']);
  assert.doesNotMatch(hostText('src/scenes/worldModes.js'), /\(Crafting page\)`/, 'no English glued in the host');
});
