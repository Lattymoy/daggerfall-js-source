// FIELD BUGS 2026-10-18f CRAFT-LIMIT-SAID (the Discord's #bug-reports, CC/Astro, "Smithing stuck at 50": "I am unsure if
// its meant to stop here or if I am missing something but I have been stuck at level 50 smithing for about 3 days now.
// it is literally 1xp off of levelling up but everything I craft gives me 0xp") - THE CRAFTER'S LIMIT, SAID WHERE IT
// ACTS. PROF0 3.2 (DECIDED; Mac kept it at CAP-OFF, Professions-Arc 40): a character raises two crafts past Journeyman,
// and every other craft stops one XP short of rank 51 - the account service credits MAX(0, MIN(earned, cap - held))
// (server-account/src/professions.js craftAtAnvil and its four kin, cap professionLaw craftXpCap). The anvil read the
// craft's own law alone and promised "60 Smithing XP, and 500 more"; the Worker paid none; nothing in the game said why.
// Driven through the real Worker (test/accountDb.mjs), the real book (net/profBook.js), the real pages
// (ui/professions/profPages.js) and the words (ui/craftXpWords.js), against the law both ends read (net/professionLaw.js
// craftLimit, craftLimitOf, creditedXp). The new law is read through its namespaces, so on the code before the fix
// every test here runs and fails on what it says, not on an import.
// bible/01-Overview/bugs/Field-Bugs-2026-10-18f.md CRAFT-LIMIT-SAID; bible/06-Systems/Professions-Arc.md 41.10.
import '../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { standService, T0, sessionStorageOf, d1 } from '../accountDb.mjs';
import { craftCapSql } from '../../server-account/src/professions.js';   // AUDIT FB1018f L5-1: the decisions' ceiling, in SQL
import { accountProf, SESSION_KEY } from '../../src/net/accountClient.js';
import { createProfBook } from '../../src/net/profBook.js';
import * as law from '../../src/net/professionLaw.js';
import { recipeById, craftXp, cookXp, masonXp, workFirstXp, firstCraftXp } from '../../src/net/recipeLaw.js';
/** FIRST-BUDGET (Professions-Arc 52): a Smithing piece's first, Smithing's first-make share - the 500 it always was. */
const FIRST_CRAFT_XP = 500;
import { potionById, brewXp, disenchantXp } from '../../src/net/alchemyLaw.js';   // AUDIT FB1018f L5-6: the stations' own laws
import { temperXp } from '../../src/net/temperLaw.js';
import * as tm from '../../src/systems/textManager.js';   // AUDIT FB1018f L5-8: the rows in the player's language
import * as words from '../../src/ui/craftXpWords.js';
import * as pages from '../../src/ui/professions/profPages.js';
import { setPref } from '../../src/systems/uiPrefs.js';
import { utcDay } from '../../src/net/marksLaw.js';
import { mintPieces } from '../../src/systems/smithItems.js';
import { FIRM_NODES } from '../../src/net/firmament/firmamentTree.js';
import { packTree, pathTo, treeStats, xpPct, scaleXp } from '../../src/net/firmament/firmamentLaw.js';
import { setFirmamentTree, setFirmamentOnline, _resetFirmamentLiveForTests } from '../../src/systems/firmamentLive.js';
import { hostText } from '../hostText.mjs';
import { layRecord } from '../realmSeat.mjs';   // AUDIT FB1018f L5-1: a seated character's record, the disenchant's piece in it

const { xpForRank, PROF_XP_MAX } = law;
const NOON = utcDay(T0) * 86_400 + 12 * 3600;
/** The crafter's limit's ceiling: one XP short of rank 51 - the report's "1xp off of levelling up". */
const HELD = xpForRank(51) - 1;
const noWait = () => Promise.resolve();
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const kit = { el, divider: (w) => el('h3', null, w), meter: () => el('div') };
const LIMIT = (room, prof, crafts) => `${room === 0 ? `No ${prof} experience` : `At most ${room} ${prof} experience`}: ${crafts} are past Journeyman, so the crafter's limit holds ${prof} at rank 50.`;   // PIN MOVED (VOICE2): experience, not XP; no dash aside (the craft-limit lines in the voice)
const FIRST = (xp, prof) => `${xp} ${prof} experience, and 500 more the first time you make this piece at this grade.`;   // PIN MOVED (VOICE2): experience in a sentence, a crafting tier a grade (Voice.md rule 3)

/** A character on the real Worker, its tracks and Stores written as the service keeps them, and a book reading it. */
async function standBook(env = {}) {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on', ...env });
  const raw = s.env.DB._raw;
  const mac = await s.seated('Mac');
  const give = (m, qty) => raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, 'own', ?)
    ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = excluded.qty`).run(mac.id, mac.character, m, qty);
  const track = (prof, xp) => raw.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, updated_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (player, char_id, profession) DO UPDATE SET xp = excluded.xp`).run(mac.id, mac.character, prof, xp, NOON);
  const xpOf = (prof) => Number(raw.prepare('SELECT xp FROM prof_tracks WHERE player = ? AND char_id = ? AND profession = ?').get(mac.id, mac.character, prof)?.xp ?? 0);
  const door = accountProf({ fetch: s.fetch, storage: sessionStorageOf(SESSION_KEY, mac) });
  // AUDIT FB1018f L5-1: a second book of the same character - a second tab, its acts its own (one craft at a time a book)
  const mk = () => createProfBook({ door, storage: memStorage(), character: () => mac.character, now: () => NOON * 1000, sleep: noWait });
  const book = mk();
  return { s, raw, mac, give, track, xpOf, book, mk };
}

/** AUDIT FB1018f L5-1: ACTS DECIDED AT ONCE - every act's batch (its decision, `INSERT OR IGNORE INTO prof_crafts` and its
 *  kin) held until `n` have reached theirs, so each act read the character's tracks before any wrote: the Worker's requests
 *  interleave at every await, and this makes the worst of it the case, whatever an act awaits on its way. Their batches
 *  then run in the order they came, or (`last`) the last first - so each act is, in one run or the other, the one
 *  decided second. */
function decideTogether(db, n, last = false) {
  const prepare = db.prepare, batch = db.batch;
  db.prepare = (sql) => Object.assign(prepare.call(db, sql), { act: /INSERT OR IGNORE INTO prof_(crafts|smelts|tempers|brews|disenchants)\b/.test(sql) });
  let held = [];
  db.batch = (list) => (!list.some((st) => st.act) ? batch.call(db, list) : new Promise((resolve, reject) => {
    held.push(() => batch.call(db, list).then(resolve, reject));
    if (held.length < n) return;
    const go = held;
    held = [];
    db.prepare = prepare;
    db.batch = batch;
    for (const f of last ? go.reverse() : go) f();
  }));
}

/** The Stores page over a book, at the stations `here` names, and its readers. */
function standPage(book, here = {}) {
  resetPages();
  const home = () => ({ kind: 'home', fee: 0 });
  const stub = async () => ({ ok: true, text: '' });
  const at = Object.fromEntries(Object.entries(here).map(([k, v]) => [k, typeof v === 'function' ? v : home]));
  pages.setProfessionsPages({ book, name: (k) => k, withdraw: stub, smelt: stub, craft: stub, brew: stub, stock: stub, temper: stub, disenchant: stub, clothing: () => 'MensClothing', heatBand: () => 1, stitchBand: () => 1, ...at });
  let root = null;
  const draw = () => { root?.remove?.(); root = el('div'); document.body.append(root); pages.drawStoresPage(root, draw, kit); };
  draw();
  const station = (title) => {
    const s = [...root.querySelectorAll('.prof-station')].find((x) => x.querySelector('h3')?.textContent === title);
    assert.ok(s, `the station ${title}`);
    return s;
  };
  const press = (title, label, exact = false) => {
    const b = [...station(title).querySelectorAll('button')].find((x) => (exact ? x.textContent === label : x.textContent.startsWith(label)));
    assert.ok(b, `${title}: ${label}`);
    b.onclick();
  };
  const notes = (title) => [...station(title).querySelectorAll('p')].map((p) => p.textContent);
  /** the picked pattern's box at a station: its head and its notes */
  const box = (title) => {
    const b = station(title).querySelector('.prof-craft');
    assert.ok(b, `${title}: a box`);
    return [b.children[0].textContent, [...b.querySelectorAll('p')].map((p) => p.textContent)];
  };
  return { draw, station, press, notes, box, text: (title) => station(title).textContent, done: () => { pages.setProfessionsPages(null); root?.remove?.(); } };
}
const resetPages = () => { pages.resetProfPages(); setPref('gentleActs', false); };

/** The Professions tab over a book, `sel` chosen: its XP line, its limit's two lines. */
function tabOf(book, sel) {
  resetPages();
  pages.setProfessionsPages({ book, name: (k) => k });
  let root = el('div');
  document.body.append(root);
  pages.drawProfessionsPage(root, () => {}, kit);
  [...root.querySelectorAll('button')].find((b) => b.className.includes('prof-row') && b.textContent.startsWith(law.professionName(sel))).onclick();
  root.remove();
  root = el('div');
  document.body.append(root);
  pages.drawProfessionsPage(root, () => {}, kit);
  const lim = root.querySelector('.prof-limit');
  const sib = lim?.parentNode?.children ?? [];
  const out = { xp: root.querySelector('.prof-xp')?.textContent, limit: lim?.textContent, rule: sib[sib.indexOf(lim) + 1]?.textContent };
  root.remove();
  pages.setProfessionsPages(null);
  return out;
}

// ─── THE REPORT ──────────────────────────────────────────────────────

test('CRAFT-LIMIT-SAID THE REPORT, end to end: Smithing 50 one XP short of 51 behind Building and Provisioning past Journeyman - the anvil\'s Silver Dagger box as the screenshot read it, but its XP line the limit\'s ("No Smithing XP") where it promised 60 and 500; the Worker credits none, the first\'s 500 too; the craft\'s word says the limit, never "with the first-time bonus"; the tab says the ceiling and the two; the limit is the cause - one of the two at 50 and the same box says 60 and the Worker pays it (mutants: the box\'s pay unread; the word\'s limit dropped; the tab\'s ceiling and rule)', async (t) => {
  t.mock.method(Date, 'now', () => NOON * 1000);
  const { track, give, xpOf, book } = await standBook();
  track('smithing', HELD);
  track('building', xpForRank(60));
  track('provisioning', xpForRank(55));
  give('ingot:silver', 40);
  give('metal:tin', 233);
  assert.equal((await book.refresh()).ok, true);
  const page = standPage(book, { forge: true });
  try {
    page.press('The Anvil', 'Dagger');
    page.press('The Anvil', 'Silver', true);
    const [head, lines] = page.box('The Anvil');
    assert.equal(head, 'Silver Dagger - rank 25');
    assert.equal(lines[0], 'Quality chances: Standard 20% | Fine 50% | Superior 28% | Masterwork 2%. They get better the further your rank (50) is above the recipe\'s (25). Land every strike while the glow is in the band to raise the result one quality.', 'the screenshot\'s odds line');   // PIN MOVED (PLAIN-ODDS): the odds said in plain words
    assert.equal(lines[1], LIMIT(0, 'Smithing', 'Building and Provisioning'), 'where the screenshot read "60 Smithing XP, and 500 more the first time you make this piece at this tier."');
    // the Worker: the craft made, its XP none - the first's 500 eaten by the cap as well
    const r = await book.craft('dagger:silver', { clean: false, name: 'Mac' }, (data) => mintPieces(data));
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.deepEqual([r.data.xp, r.data.first, r.data.track.xp, r.data.track.rank, xpOf('smithing')], [0, true, HELD, 50, HELD]);
    // the craft's word, as world.js says it (one call, the book's limit handed in)
    const word = words.craftXpText(recipeById('dagger:silver'), r.data, 'Smithing', book.limit?.('smithing') ?? null);
    assert.equal(word, '(+0 Smithing experience. Building and Provisioning are past Journeyman, so the crafter\'s limit holds Smithing at rank 50)');   // PIN MOVED (VOICE2): experience, not XP; no dash aside (the craft-limit lines in the voice)
    assert.doesNotMatch(word, /first-time bonus/, 'a bonus the limit ate is never said as paid');
  } finally { page.done(); }
  // the Professions tab: the ceiling, not "26,009 / 26,010 XP"; the two named, and that it is for good
  assert.deepEqual(tabOf(book, 'smithing'), {
    xp: '26,009 / 26,009 XP - the crafter\'s limit holds it at rank 50',
    limit: 'Crafts above Journeyman: 2 of 2',
    rule: 'Only 2 crafts can rise past Journeyman. Yours are Building and Provisioning, so your other crafts stop at rank 50. A craft never loses rank.',
  });
  // THE CAUSE: one of the two at 50 (not past it), and the same craft's box says 60 - and a new pattern pays its 60 and 500
  track('provisioning', xpForRank(50));
  assert.equal((await book.refresh({ force: true })).ok, true);
  const again = standPage(book, { forge: true });
  try {
    again.press('The Anvil', 'Tanto');
    again.press('The Anvil', 'Silver', true);
    assert.equal(again.box('The Anvil')[1].at(-1), FIRST(60, 'Smithing'));
    const r = await book.craft('tanto:silver', { clean: false, name: 'Mac' }, (data) => mintPieces(data));
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.deepEqual([r.data.xp, r.data.first, xpOf('smithing')], [60 + FIRST_CRAFT_XP, true, HELD + 60 + FIRST_CRAFT_XP]);
    assert.equal(words.craftXpText(recipeById('tanto:silver'), r.data, 'Smithing', book.limit?.('smithing') ?? null), '(+560 Smithing experience, with the first-time bonus)');   // PIN MOVED (VOICE2)
  } finally { again.done(); }
  assert.equal(tabOf(book, 'smithing').xp, '26,569 / 27,040 XP', 'past 51 now: the next rank\'s line');
});

// ─── ONE LAW ─────────────────────────────────────────────────────────

test('CRAFT-LIMIT-SAID one law: at every room the limit leaves - none, one, short of the plain craft, the plain craft exactly, short of the first, the first exactly, ample - the anvil\'s line is what the Worker credits (the service\'s MAX(0, MIN(...)) and professionLaw creditedXp), each a new pattern\'s first (mutants: the room unread; "At most" for "No"; creditedXp unclamped either way)', async (t) => {
  t.mock.method(Date, 'now', () => NOON * 1000);
  const { track, give, xpOf, book } = await standBook();
  track('building', xpForRank(60));
  track('provisioning', xpForRank(55));
  for (const [m, n] of [['ingot:silver', 400], ['metal:tin', 100], ['metal:copper', 100], ['leather:cured', 100]]) give(m, n);
  const earned = craftXp(3, 50) + firstCraftXp(recipeById('dagger:silver'));   // 560: a Silver piece's 60 at Smithing 50, and its first
  const rooms = [0, 1, 59, 60, 559, 560, 5000];
  const patterns = ['dagger', 'tanto', 'shortsword', 'wakizashi', 'broadsword', 'saber', 'longsword'];
  const seen = [];
  for (const [i, room] of rooms.entries()) {
    track('smithing', HELD - room);
    assert.equal((await book.refresh({ force: true })).ok, true);
    const pay = pages.craftPayOf?.(book, 'smithing') ?? {};
    const r0 = recipeById(`${patterns[i]}:silver`);
    const line = words.craftXpLine(r0, 50, 'Smithing', pay);
    const r = await book.craft(r0.id, { clean: false, name: 'Mac' }, (data) => mintPieces(data));
    assert.equal(r.ok, true, JSON.stringify(r));
    // and the craft's word after it: the limit's where the craft left the track no room, the first's where it did
    seen.push([room, line, r.data.xp, r.data.first, xpOf('smithing'), words.craftXpText(r0, r.data, 'Smithing', book.limit?.('smithing') ?? null)]);
  }
  assert.deepEqual(seen, rooms.map((room) => {
    const paid = Math.min(earned, room);
    const word = room - paid === 0 ? `(+${paid} Smithing experience. Building and Provisioning are past Journeyman, so the crafter's limit holds Smithing at rank 50)` : `(+${paid} Smithing experience, with the first-time bonus)`;   // PIN MOVED (VOICE2): the first's word; the limit's keeps its own
    return [room, room >= earned ? FIRST(60, 'Smithing') : LIMIT(room, 'Smithing', 'Building and Provisioning'), paid, true, HELD - room + paid, word];
  }));
  // the law the line and the Worker share
  assert.deepEqual([0, 1, 559, 560, 561].map((room) => law.creditedXp?.(earned, room)), [0, 1, 559, 560, 560]);
  assert.deepEqual([law.creditedXp?.(-5, 10), law.creditedXp?.(60, Infinity), law.creditedXp?.(Number.NaN, 10)], [0, 60, 0], 'never below none, no bound unread');
});

test('CRAFT-LIMIT-SAID the Firmament\'s hand: a tree to Anvil\'s Song in force, the anvil\'s line says the 60 with its Smithing percent on it (scaleXp) and the 500 whole, as the Worker pays it - the line said 60; the jeweller\'s Ring its craft\'s percent; the anvil\'s temper its percent, as the Worker pays it (mutants: the percent unread; the 500 scaled; a discipline\'s percent its own; a temper\'s figure unscaled)', async (t) => {
  t.mock.method(Date, 'now', () => NOON * 1000);
  _resetFirmamentLiveForTests();
  const { raw, mac, track, give, book } = await standBook({ FIRMAMENT_OPEN: 'on' });
  // the law's own shortest walk from the Warrior's start to Anvil's Song (+8% Smithing experience)
  const song = [...FIRM_NODES.values()].find((n) => n.name === 'Anvil\'s Song');
  const tree = { start: 'wr.start', keys: [] };
  tree.keys.push(...pathTo(tree, song.key));
  const pct = xpPct(treeStats(tree), 'smithing');
  assert.ok(pct >= 8, `the stars' Smithing experience (${pct}%)`);
  raw.prepare('INSERT INTO firmament (player, char_id, tree, updated_at) VALUES (?, ?, ?, ?)').run(mac.id, mac.character, packTree(tree), NOON);
  setFirmamentOnline(true);
  setFirmamentTree(tree);
  track('smithing', xpForRank(30));
  for (const [m, n] of [['ingot:silver', 10], ['metal:tin', 10], ['metal:silver', 5], ['ingot:steel', 10]]) give(m, n);
  assert.equal((await book.refresh()).ok, true);
  const page = standPage(book, {
    forge: true, jeweller: true,
    temperable: (where) => (where === 'anvil' ? [{ item: {}, name: 'Steel Longsword', recipe: 'longsword:steel', quality: 1, provenance: null }] : []),
  });
  const xp = scaleXp(craftXp(3, 30), pct), temper = scaleXp(craftXp(2, 30), pct);
  try {
    page.press('The Anvil', 'Dagger');
    page.press('The Anvil', 'Silver', true);
    assert.ok(xp > 60, `the percent moves it (${pct}%)`);
    assert.equal(page.box('The Anvil')[1].at(-1), FIRST(xp, 'Smithing'));
    page.press('The Jeweler\'s Bench', 'Silver Ring');   // PIN MOVED (VOICE2): American spelling (Voice.md rule 8)
    assert.equal(page.box('The Jeweler\'s Bench')[1].at(-1), FIRST(scaleXp(craftXp(1, 30), pct), 'Smithing'), 'a Ring is Smithing\'s, its percent the craft\'s');
    assert.match(page.text('Temper at the Anvil'), new RegExp(`Steel Longsword.*Standard to Fine - 2 ingot:steel, \\+${temper} Smithing XP`));
    const r = await book.craft('dagger:silver', { clean: false, name: 'Mac' }, (data) => mintPieces(data));
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.deepEqual([r.data.xp, r.data.first], [xp + FIRST_CRAFT_XP, true], 'the Worker\'s: the percent on the 60, the 500 whole');
    const tr = await book.temper('longsword:steel', 1, null);
    assert.equal(tr.ok, true, JSON.stringify(tr));
    assert.equal(tr.data.xp, temper, 'the Worker\'s temper: the row\'s figure');
  } finally { page.done(); _resetFirmamentLiveForTests(); }
});

// ─── EVERY STATION ───────────────────────────────────────────────────

test('CRAFT-LIMIT-SAID every station says it, read off the real book - Building and Provisioning past: the jeweller\'s Silver Ring on Smithing, the loom\'s Boots on Outfitting, the loom\'s temper and the enchanting station each piece +0 and the limit once; Smithing and Outfitting past: the workbench\'s Staff and the mason\'s works on Building, the fire (no pans\' XP) and the alchemy station on Provisioning; a little room "At most"; and the Worker pays the fire none (mutants: each station\'s pay unread; the fire\'s pans\' XP said at none; the temper\'s and the disenchant\'s figure and line)', async (t) => {
  t.mock.method(Date, 'now', () => NOON * 1000);
  const A = await standBook();
  A.track('building', xpForRank(60));
  A.track('provisioning', xpForRank(55));
  for (const p of ['smithing', 'outfitting', 'enchanting']) A.track(p, HELD);
  for (const [m, n] of [['metal:silver', 5], ['cloth:linen', 5], ['leather:cured', 5]]) A.give(m, n);
  assert.equal((await A.book.refresh()).ok, true);
  const BP = 'Building and Provisioning';
  let page = standPage(A.book, {
    jeweller: true, loom: true, enchanter: true,
    disenchantable: () => [{ provenance: 'aaaaaaaaaaaaaaaa', name: 'Gold Ruby Ring', points: 2160, essence: 21, recipe: 'ring:gold:ruby' }],
    temperable: (where) => (where === 'loom' ? [{ item: {}, name: 'Leather Cuirass', recipe: 'leather-cuirass:cured', quality: 1, provenance: null }] : []),
  });
  try {
    page.press('The Jeweler\'s Bench', 'Silver Ring');   // PIN MOVED (VOICE2): American spelling (Voice.md rule 8)
    assert.equal(page.box('The Jeweler\'s Bench')[1].at(-1), LIMIT(0, 'Smithing', BP), 'a jewel raises Smithing');
    page.press('The Loom', 'Clothing', true);
    page.press('The Loom', 'Boots');
    assert.equal(page.box('The Loom')[1].at(-1), LIMIT(0, 'Outfitting', BP));
    assert.ok(page.notes('Temper at the Loom').includes(LIMIT(0, 'Outfitting', BP)), page.notes('Temper at the Loom').join('|'));
    assert.match(page.text('Temper at the Loom'), /Leather Cuirass.*Standard to Fine - .*, \+0 Outfitting XP/);
    assert.ok(page.notes('The Enchanting Station').includes(LIMIT(0, 'Enchanting', BP)), page.notes('The Enchanting Station').join('|'));
    assert.match(page.text('The Enchanting Station'), /Gold Ruby Ring2,160 points: 21 Arcane Essence, \+0 Enchanting experience/);   // PIN MOVED (VOICE2): a colon for the dash, experience for XP
  } finally { page.done(); }
  const B = await standBook();
  B.track('smithing', xpForRank(60));
  B.track('outfitting', xpForRank(60));
  for (const p of ['building', 'provisioning']) B.track(p, HELD);
  for (const [m, n] of [['plank:pine', 9], ['stone:rough', 9], ['food:meat', 9], ['food:mushroom', 9], ['p1:13', 9]]) B.give(m, n);
  assert.equal((await B.book.refresh()).ok, true);
  const SO = 'Smithing and Outfitting';
  page = standPage(B.book, { workbench: true, mason: true, fire: true, alchemy: true });
  try {
    page.press('The Workbench', 'Staff');
    assert.equal(page.box('The Workbench')[1].at(-1), LIMIT(0, 'Building', SO));
    assert.ok(page.notes('The Mason\'s Bench').includes(LIMIT(0, 'Building', SO)), 'the works\' first: none');
    page.press('The Fire', 'Hunter\'s Stew');
    const fire = page.box('The Fire')[1];
    assert.deepEqual(fire.slice(-2), ['One serving, into your pack. 3 pans.', LIMIT(0, 'Provisioning', SO)], 'no pans\' XP said where none is paid');
    page.press('The Alchemy Station', 'Water Breathing');
    assert.match(page.box('The Alchemy Station')[1].join('|'), new RegExp(`\\.( |\\|)${LIMIT(0, 'Provisioning', SO).replace(/[.()]/g, '\\$&')}`));
  } finally { page.done(); }
  // a little room: the alchemy station says what is left of it, and the Worker pays the fire what the line said - none
  B.track('provisioning', HELD - 10);
  assert.equal((await B.book.refresh({ force: true })).ok, true);
  page = standPage(B.book, { fire: true, alchemy: true });
  try {
    page.press('The Alchemy Station', 'Water Breathing');
    assert.match(page.box('The Alchemy Station')[1].join('|'), /At most 10 Provisioning experience: Smithing and Outfitting are past Journeyman/);   // PIN MOVED (VOICE2): experience, not XP; no dash aside (the craft-limit lines in the voice)
    page.press('The Fire', 'Hunter\'s Stew');
    assert.equal(page.box('The Fire')[1].at(-1), LIMIT(10, 'Provisioning', SO));
    assert.match(page.box('The Fire')[1].at(-2), /half as much again as its 80 Provisioning experience\.$/, 'PIN MOVED (VOICE2): room left: the pans\' XP said, the limit after it');
  } finally { page.done(); }
  B.track('provisioning', HELD);
  assert.equal((await B.book.refresh({ force: true })).ok, true);
  const dish = await B.book.craft('stew:north', { clean: true, name: 'Mac' }, (data) => mintPieces(data));
  assert.equal(dish.ok, true, JSON.stringify(dish));
  assert.deepEqual([dish.data.xp, dish.data.first, B.xpOf('provisioning')], [0, true, HELD], 'the fire\'s none: a clean pan\'s and a first\'s, the cap took them');
  assert.equal(cookXp(50, { clean: true }), 120, 'what the clean pan earned');
});

// ─── AUDIT FB1018f L5-1: THE LIMIT IS ONE DECISION ───────────────────

test('AUDIT FB1018f L5-1 the limit is one decision: two acts at once on two tracks at 50, one other craft past - the anvil\'s Silver Dagger beside the workbench\'s Staff, the mason\'s Cut Stone, the alchemy station\'s Healing, the enchanting station\'s Ring and the loom\'s temper, each decided before the other wrote, in either order - one crosses and the other is held at 26,009, its answer what it was credited; never three past (fails on the cap read before the batch and bound in as a literal: both crossed, and every one of the three froze at 26,009 for good) - and the two past still raise after it (mutants: each decision\'s cap the stale one; the count\'s bound, its threshold, its crafts)', async (t) => {
  t.mock.method(Date, 'now', () => NOON * 1000);
  const CRAFTS = ['smithing', 'outfitting', 'building', 'provisioning', 'enchanting'];
  const ring = 'f00dfeedc0ffee01';
  const races = [
    ['the workbench', 'building', 'provisioning', (b) => b.craft('staff:pine', { clean: false, name: 'Mac' }, (d) => mintPieces(d))],
    ['the mason\'s bench', 'building', 'provisioning', (b) => b.smelt('cut:stone', 1, { clean: true })],
    ['the alchemy station', 'provisioning', 'building', (b) => b.brew('healing', ['p1:16', 'reagent:troll-blood', 'reagent:elixir-vitae', 'metal:mercury'], {}, () => {})],
    ['the enchanting station', 'enchanting', 'building', (b, mac) => b.disenchant(ring, mac.at())],
    ['the loom\'s temper', 'outfitting', 'building', (b) => b.temper('leather-cuirass:cured', 1, null)],
  ];
  for (const [where, other, past, act] of races) for (const last of [false, true]) {
    const { s, raw, mac, give, track, xpOf, book, mk } = await standBook();
    track(past, xpForRank(55));
    track('smithing', HELD - 5);
    track(other, HELD - 5);
    for (const [m, n] of [['ingot:silver', 40], ['metal:tin', 233], ['plank:pine', 40], ['stone:rough', 9], ['p1:16', 9], ['reagent:troll-blood', 9], ['reagent:elixir-vitae', 9], ['metal:mercury', 9], ['leather:cured', 9]]) give(m, n);
    const r = recipeById('ring:gold:ruby');
    raw.prepare(`INSERT INTO products (provenance, owner, char_id, maker, recipe, template, material, quality, seed, record, made_at)
      VALUES (?, ?, ?, 'Mac', ?, ?, ?, 1, 7, 'x', 1)`).run(ring, mac.id, mac.character, r.id, r.templateIndex, r.material ?? 0);
    // the Ring in the seated character's pack, as its save after the craft carries it (prof12_service.test.js's way)
    const save = JSON.parse(new TextDecoder().decode(s.env.SAVES._map.get(raw.prepare('SELECT obj FROM realm_characters WHERE id = ?').get(mac.character).obj)));
    layRecord(s.env, mac.character, { ...save, items: [...(save.items ?? []), { templateIndex: r.templateIndex, provenance: ring, recipe: r.id, name: r.id }] });
    const b2 = mk();
    assert.equal((await book.refresh()).ok, true);
    assert.equal((await b2.refresh()).ok, true);
    decideTogether(s.env.DB, 2, last);
    const [a, b] = await Promise.all([book.craft('dagger:silver', { clean: false, name: 'Mac' }, (d) => mintPieces(d)), act(b2, mac)]);
    assert.equal(a.ok, true, `${where}: the anvil ${JSON.stringify(a)}`);
    assert.equal(b.ok, true, `${where}: ${JSON.stringify(b)}`);
    const pastNow = CRAFTS.filter((p) => xpOf(p) > HELD);
    assert.equal(pastNow.length, 2, `${where}: two crafts past Journeyman, never three (${pastNow.join(', ')})`);
    const [held, heldAnswer] = xpOf('smithing') > HELD ? [other, b] : ['smithing', a];
    assert.deepEqual([xpOf(held), Number(heldAnswer.data?.xp)], [HELD, 5], `${where}: the one decided second held at the limit, answered what it was credited`);
  }
  // after it: the two past raise on, and the one held stays held
  const { s, give, track, xpOf, book, mk } = await standBook();
  track('provisioning', xpForRank(55));
  track('smithing', HELD - 5);
  track('building', HELD - 5);
  for (const [m, n] of [['ingot:silver', 40], ['metal:tin', 233], ['plank:pine', 40]]) give(m, n);
  const b2 = mk();
  assert.equal((await book.refresh()).ok, true);
  assert.equal((await b2.refresh()).ok, true);
  decideTogether(s.env.DB, 2);
  await Promise.all([book.craft('dagger:silver', { clean: false, name: 'Mac' }, (d) => mintPieces(d)), b2.craft('staff:pine', { clean: false, name: 'Mac' }, (d) => mintPieces(d))]);
  const [up, held] = xpOf('smithing') > HELD ? ['smithing', 'building'] : ['building', 'smithing'];
  assert.equal(xpOf(held), HELD);
  const before = xpOf(up);
  assert.equal((await book.refresh({ force: true })).ok, true);
  const more = await book.craft(up === 'smithing' ? 'tanto:silver' : 'staff:pine', { clean: false, name: 'Mac' }, (d) => mintPieces(d));
  assert.equal(more.ok, true, JSON.stringify(more));
  assert.ok(Number(more.data.xp) > 0 && xpOf(up) === before + Number(more.data.xp), `${up}, one of the two, raises on`);
  const none = await book.craft(held === 'smithing' ? 'tanto:silver' : 'staff:pine', { clean: false, name: 'Mac' }, (d) => mintPieces(d));
  assert.equal(none.ok, true, JSON.stringify(none));
  assert.deepEqual([Number(none.data.xp), xpOf(held)], [0, HELD], `${held}, the third, stays held`);
});

test('AUDIT FB1018f L5-1 one law: the decisions\' SQL ceiling (professions.js craftCapSql) is craftXpCap\'s, over every craft and discipline and every standing of the other four crafts at rank 50\'s last XP or 51\'s first - its own track and the gathering tracks past it never counted (mutants: the count\'s bound, its threshold, its crafts, the ceiling\'s figure)', () => {
  const db = d1();
  db._raw.exec('PRAGMA foreign_keys = OFF');   // a character's tracks alone - no account row is read
  const crafts = law.PROFESSIONS.filter((p) => p.kind === 'crafting').map((p) => p.id);
  const set = db._raw.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, updated_at) VALUES ('p', 'c', ?, ?, 0)
    ON CONFLICT (player, char_id, profession) DO UPDATE SET xp = excluded.xp`);
  let n = 0;
  for (const p of [...crafts, ...law.DISCIPLINES.map((d) => d.id)]) {
    const own = law.trackOf(p), others = crafts.filter((x) => x !== own);
    const sql = db._raw.prepare(`SELECT ${craftCapSql('?1', '?2', p)} AS cap`);
    for (let mask = 0; mask < 1 << others.length; mask++) {
      const xp = Object.fromEntries(others.map((x, i) => [x, mask & (1 << i) ? HELD + 1 : HELD]));
      for (const [x, v] of Object.entries({ ...xp, [own]: xpForRank(90), mining: xpForRank(90), fishing: xpForRank(90) })) set.run(x, v);
      const ranks = Object.fromEntries(Object.entries(xp).map(([x, v]) => [x, law.rankOfXp(v)]));
      assert.equal(Number(sql.get('p', 'c').cap), law.craftXpCap(p, { ...ranks, [own]: 90, mining: 90, fishing: 90 }), `${p}: ${JSON.stringify(ranks)}`);
      n++;
    }
  }
  assert.equal(n, 13 * 16, 'every craft and discipline, every standing of the others');
});

// ─── THE TAB, MASTER, THE LAW ────────────────────────────────────────

test('CRAFT-LIMIT-SAID the tab before the choice and the top: none past - the rule says what a second past 50 does, for good; a gathering track is never held, however many crafts stand past; a Master\'s station line says none (the service credits none at PROF_XP_MAX) and one short of it "At most" (mutants: the rule\'s two arms; the gathering guard; Master\'s arm)', async (t) => {
  t.mock.method(Date, 'now', () => NOON * 1000);
  const { track, book } = await standBook();
  track('smithing', xpForRank(40));
  assert.equal((await book.refresh()).ok, true);
  assert.deepEqual(tabOf(book, 'smithing'), {
    xp: '16,000 / 16,810 XP',
    limit: 'Crafts above Journeyman: 0 of 2',
    rule: 'Only 2 crafts can rise past Journeyman. Once 2 of yours pass rank 50, the others stop there. A craft never loses rank.',
  });
  track('building', xpForRank(70));
  track('enchanting', xpForRank(51));
  track('mining', xpForRank(51) - 1);
  assert.equal((await book.refresh({ force: true })).ok, true);
  assert.equal(tabOf(book, 'mining').xp, '26,009 / 26,010 XP', 'Gathering is unlimited (3.2): never the ceiling\'s line');
  assert.deepEqual(book.limit?.('mining'), { cap: PROF_XP_MAX, room: PROF_XP_MAX - HELD, by: [], rank: 100 });
  assert.deepEqual(book.limit?.('jewelcrafting'), { cap: HELD, room: HELD - xpForRank(40), by: ['building', 'enchanting'], rank: 50 }, 'a discipline its craft\'s');
  // a Master: the service's MIN(earned, PROF_XP_MAX - held) is none
  const dagger = recipeById('dagger:iron');
  assert.equal(words.craftXpLine(dagger, 100, 'Smithing', { limit: law.craftLimit?.('smithing', { smithing: 100 }, PROF_XP_MAX) }), 'No Smithing experience: Smithing is at Master.');   // PIN MOVED (VOICE2): experience, not XP; no dash aside (the craft-limit lines in the voice)
  assert.equal(words.craftXpLine(dagger, 99, 'Smithing', { limit: law.craftLimit?.('smithing', { smithing: 99 }, PROF_XP_MAX - 3) }), 'At most 3 Smithing experience: Smithing stops at Master.');   // PIN MOVED (VOICE2): experience, not XP; no dash aside (the craft-limit lines in the voice)
  assert.equal(words.craftXpLine(dagger, 99, 'Smithing', { limit: law.craftLimit?.('smithing', { smithing: 99 }, PROF_XP_MAX - 505) }), FIRST(5, 'Smithing'), 'room for it all: the line as ever');
});

test('CRAFT-LIMIT-SAID the law: craftLimit is craftXpCap\'s ceiling with its room and the crafts that hold it, in the tab\'s order - two others past 50 hold a craft, one does not, its own rank never, a discipline its craft\'s, a gathering track never; craftLimitOf reads it off the service\'s track views by their XP; the host hands the craft\'s word the book\'s limit in its one call (mutants: the order; the room\'s floor; the views\' ranks off their XP)', () => {
  const L = (p, ranks, xp) => law.craftLimit?.(p, ranks, xp);
  assert.deepEqual(L('smithing', { provisioning: 55, building: 60 }, HELD), { cap: HELD, room: 0, by: ['building', 'provisioning'], rank: 50 }, 'the tab\'s order, not the ranks\'');
  assert.deepEqual(L('smithing', { provisioning: 55, building: 60 }, HELD + 40), { cap: HELD, room: 0, by: ['building', 'provisioning'], rank: 51 }, 'never a room below none - and held at its own 51 (AUDIT FB1018f L5-2)');
  assert.deepEqual(L('smithing', { provisioning: 55, building: 50 }, HELD), { cap: PROF_XP_MAX, room: PROF_XP_MAX - HELD, by: [], rank: 100 }, '50 is not past');
  assert.deepEqual(L('smithing', { smithing: 90, building: 60 }, xpForRank(90)), { cap: PROF_XP_MAX, room: PROF_XP_MAX - xpForRank(90), by: [], rank: 100 }, 'its own rank never counted');
  assert.deepEqual(L('cooking', { smithing: 60, building: 51, outfitting: 70 }, 100), { cap: HELD, room: HELD - 100, by: ['smithing', 'building', 'outfitting'], rank: 50 }, 'a discipline its craft\'s; three past, all named');
  // AUDIT FB1018f L5-2: three past (two crafts that crossed at once before L5-1 - players stand there, and nothing lowers a
  // track): the others hold it, never itself, AT ITS OWN RANK - its words were "holds Smithing at rank 50" at rank 60
  const three = L('smithing', { smithing: 60, building: 60, provisioning: 60 }, xpForRank(60));
  assert.deepEqual(three, { cap: HELD, room: 0, by: ['building', 'provisioning'], rank: 60 }, 'three past: held where it stands');
  const AT60 = 'Building and Provisioning are past Journeyman, so the crafter\'s limit holds Smithing at rank 60';
  assert.equal(words.capLine('Smithing', { limit: three }, 60), `No Smithing experience: ${AT60}.`, 'the station\'s line');   // PIN MOVED (VOICE2): experience, not XP; no dash aside (the craft-limit lines in the voice)
  assert.equal(words.craftXpText(recipeById('dagger:silver'), { xp: 0, first: true }, 'Smithing', three), `(+0 Smithing experience. ${AT60})`, 'the craft\'s word');   // PIN MOVED (VOICE2): experience, not XP; no dash aside (the craft-limit lines in the voice)
  assert.equal(pages.xpLine({ xp: xpForRank(60), rank: 60 }, three), '36,000 / 36,000 XP - the crafter\'s limit holds it at rank 60', 'the tab: its own XP its ceiling, never "36,000 / 26,009 XP - ... at rank 50"');
  assert.deepEqual(L('herbalism', { smithing: 60, building: 60 }, 5), { cap: PROF_XP_MAX, room: PROF_XP_MAX - 5, by: [], rank: 100 }, 'a gathering track never held');
  for (const [p, ranks] of [['smithing', { provisioning: 55, building: 60 }], ['enchanting', { smithing: 51, building: 50 }], ['masonry', { smithing: 60, provisioning: 70 }]]) {
    assert.equal(L(p, ranks, 0)?.cap, law.craftXpCap(p, ranks), `${p}: craftXpCap's ceiling, the one the service binds`);
  }
  const views = [{ profession: 'building', xp: xpForRank(60), rank: 0 }, { profession: 'provisioning', xp: xpForRank(51), rank: 0 }, { profession: 'smithing', xp: HELD - 7, rank: 0 }, null];
  assert.deepEqual(law.craftLimitOf?.(views, 'jewelcrafting'), { cap: HELD, room: 7, by: ['building', 'provisioning'], rank: 50 }, 'ranks the service\'s own, off the XP');
  assert.deepEqual(law.craftLimitOf?.([], 'smithing'), { cap: PROF_XP_MAX, room: PROF_XP_MAX, by: [], rank: 100 }, 'no tracks read: no limit');
  // THE HOSTS DO NOT GROW: world.js's craft word hands the book's limit in, in its one call
  assert.match(hostText('src/scenes/world.js'), /\$\{made\} \$\{craftXpText\(rec, r\.data, st\.xp, profBook\.limit\(rec\?\.profession\)\)\}\$\{paid \?/);
});

// ─── AUDIT FB1018f L5: THE WORDS AT THE EDGES ────────────────────────

test('AUDIT FB1018f L5-3 the tab: a third craft below the rank it is held at keeps its next rank\'s figure - at 10 "1,005 / 1,210 XP" (fails today: "1,005 / 26,009 XP - the crafter\'s limit holds it at rank 50"), at 49 its 50\'s; at 50 the ceiling\'s line, room left or none; L5-2: one past its cap (two that crossed at once) its own XP and rank (mutants: the line below its rank; the line only at the cap; the cap\'s figure past it; the rank Journeyman\'s)', async (t) => {
  t.mock.method(Date, 'now', () => NOON * 1000);
  const { track, book } = await standBook();
  track('building', xpForRank(60));
  track('provisioning', xpForRank(55));
  const at = async (xp) => {
    track('smithing', xp);
    assert.equal((await book.refresh({ force: true })).ok, true);
    return [pages.xpLine(book.track('smithing'), book.limit('smithing')), tabOf(book, 'smithing').xp];
  };
  const HELD_AT = (xp, cap, rank) => `${xp} / ${cap} XP - the crafter's limit holds it at rank ${rank}`;
  assert.deepEqual(await at(xpForRank(10) + 5), ['1,005 / 1,210 XP', '1,005 / 1,210 XP'], 'rank 10: its 11\'s figure');
  assert.deepEqual(await at(xpForRank(49) + 9), ['24,019 / 25,000 XP', '24,019 / 25,000 XP'], 'rank 49: its 50 is still to reach');
  assert.deepEqual(await at(xpForRank(50) + 500), Array(2).fill(HELD_AT('25,500', '26,009', 50)), 'rank 50, room left: 51 is past its ceiling');
  assert.deepEqual(await at(HELD), Array(2).fill(HELD_AT('26,009', '26,009', 50)), 'at the ceiling');
  assert.deepEqual(await at(xpForRank(60)), Array(2).fill(HELD_AT('36,000', '36,000', 60)), 'past its cap: never "36,000 / 26,009 XP - ... at rank 50"');
});

test('AUDIT FB1018f L5-4 Master\'s word: a Master\'s craft says "(+0 Smithing XP: Smithing is at Master)", first or not, never "with the first-time bonus" nor the crafter\'s limit\'s (fails today: a Master\'s limit names no crafts and fell through to the first\'s word); at 99,800 the Worker pays a new pattern 200 of what it earns and the word is the top\'s, the first the top ate never said as paid (mutants: the top\'s word unsaid; a Master\'s word the limit\'s)', async (t) => {
  t.mock.method(Date, 'now', () => NOON * 1000);
  const master = law.craftLimit('smithing', { smithing: 100 }, PROF_XP_MAX);
  for (const data of [{ xp: 0, first: true }, { xp: 0, first: false }]) {
    const w = words.craftXpText(recipeById('dagger:iron'), data, 'Smithing', master);
    assert.equal(w, '(+0 Smithing experience. Smithing is at Master)', JSON.stringify(data));   // PIN MOVED (VOICE2): experience, not XP; no dash aside (the craft-limit lines in the voice)
    assert.doesNotMatch(w, /past Journeyman|first-time bonus/);
  }
  const { track, give, xpOf, book } = await standBook();
  track('smithing', PROF_XP_MAX - 200);
  give('ingot:silver', 40);
  give('metal:tin', 233);
  assert.equal((await book.refresh()).ok, true);
  const earned = craftXp(3, 99) + FIRST_CRAFT_XP;
  assert.ok(earned > 200, `a new Silver pattern earns ${earned}`);
  assert.equal(words.craftXpLine(recipeById('dagger:silver'), 99, 'Smithing', pages.craftPayOf(book, 'smithing')), 'At most 200 Smithing experience: Smithing stops at Master.');   // PIN MOVED (VOICE2): experience, not XP; no dash aside (the craft-limit lines in the voice)
  const r = await book.craft('dagger:silver', { clean: false, name: 'Mac' }, (d) => mintPieces(d));
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual([r.data.xp, r.data.first, xpOf('smithing')], [200, true, PROF_XP_MAX], 'the top took the rest of the first');
  assert.equal(words.craftXpText(recipeById('dagger:silver'), r.data, 'Smithing', book.limit('smithing')), '(+200 Smithing experience. Smithing is at Master)');   // PIN MOVED (VOICE2): experience, not XP; no dash aside (the craft-limit lines in the voice)
  const top = await book.craft('tanto:silver', { clean: false, name: 'Mac' }, (d) => mintPieces(d));
  assert.equal(top.ok, true, JSON.stringify(top));
  assert.deepEqual([top.data.xp, top.data.first], [0, true]);
  assert.equal(words.craftXpText(recipeById('tanto:silver'), top.data, 'Smithing', book.limit('smithing')), '(+0 Smithing experience. Smithing is at Master)');   // PIN MOVED (VOICE2): experience, not XP; no dash aside (the craft-limit lines in the voice)
});

test('AUDIT FB1018f L5-7 the rooms between an act\'s own XP and its first\'s 500: the fire\'s Hunter\'s Stew, the alchemy station\'s Healing and the mason\'s works say "At most N" where the track has more room than the act\'s own XP and less than its first\'s - and the Worker pays the fire N (mutants: the fire\'s most without its first or without its clean pan; the works\' most without their own XP, a plain chisel\'s, unscaled; the brew\'s most without its first)', async (t) => {
  t.mock.method(Date, 'now', () => NOON * 1000);
  const B = await standBook();
  B.track('smithing', xpForRank(60));
  B.track('outfitting', xpForRank(60));
  for (const [m, n] of [['stone:rough', 9], ['food:meat', 9], ['food:mushroom', 9], ['p1:13', 9], ['p1:16', 9], ['reagent:troll-blood', 9], ['reagent:elixir-vitae', 9], ['metal:mercury', 9]]) B.give(m, n);
  // PIN MOVED (FIRST-BUDGET): the rooms between an act's own XP and its first's - Provisioning's share (Healing's 5 and
  // 3,155, the Stew's clean 120 and 3,155) - and the works' one short of theirs (Building's 1,823)
  const SO = 'Smithing and Outfitting', works = masonXp(1, 50, { clean: true }) + workFirstXp(law.MASON_RECIPES[0]) - 1;
  for (const room of [300, 3200]) {
    B.track('provisioning', HELD - room);
    B.track('building', HELD - works);
    assert.equal((await B.book.refresh({ force: true })).ok, true);
    const page = standPage(B.book, { fire: true, alchemy: true, mason: true });
    try {
      page.press('The Fire', 'Hunter\'s Stew');
      assert.equal(page.box('The Fire')[1].at(-1), LIMIT(room, 'Provisioning', SO), `the fire at room ${room}`);
      page.press('The Alchemy Station', 'Healing');
      if (room < 5 + 3155) assert.match(page.box('The Alchemy Station')[1].join('|'), new RegExp(`At most ${room} Provisioning experience`), 'Healing\'s first pays');   // PIN MOVED (VOICE2): experience, not XP; no dash aside (the craft-limit lines in the voice)
      else assert.match(page.box('The Alchemy Station')[1].join('|'), /5 Provisioning experience, and 3,155 the first time/);   // PIN MOVED (VOICE2); PIN MOVED (FIRST-BUDGET)
      assert.ok(page.notes('The Mason\'s Bench').includes(LIMIT(works, 'Building', SO)), page.notes('The Mason\'s Bench').join('|'));
    } finally { page.done(); }
  }
  const dish = await B.book.craft('stew:north', { clean: true, name: 'Mac' }, (d) => mintPieces(d));
  assert.deepEqual([dish.ok, dish.data?.xp, dish.data?.first], [true, 3200, true], 'the Worker pays the fire what "At most 3200" said');   // PIN MOVED (FIRST-BUDGET)
});

/** The law's shortest walks from the Warrior's start to four stars that each raise a craft's experience. */
const craftSky = () => {
  const tree = { start: 'wr.start', keys: [] };
  for (const n of ['Anvil\'s Song', 'Master Builder', 'Master Brewer', 'Runic Fluency']) tree.keys.push(...pathTo(tree, [...FIRM_NODES.values()].find((x) => x.name === n).key));
  return tree;
};
const RING = { provenance: 'aaaaaaaaaaaaaaaa', name: 'Gold Ruby Ring', points: 2160, essence: 21, recipe: 'ring:gold:ruby' };

test('AUDIT FB1018f L5-6 the Firmament\'s hand at the fire, the alchemy station and the enchanting station, as the Worker pays the fire and the brew - and on the held lines of the temper, the disenchant and the mason\'s works, a room between the unscaled figure and the scaled one saying "At most" (mutants: the fire\'s clean and plain pans, the brew, the disenchant\'s row and line, the temper\'s line and the works\' most each unscaled)', async (t) => {
  t.mock.method(Date, 'now', () => NOON * 1000);
  _resetFirmamentLiveForTests();
  const tree = craftSky(), st = treeStats(tree);
  const pP = xpPct(st, 'provisioning'), pE = xpPct(st, 'enchanting'), pB = xpPct(st, 'building'), pS = xpPct(st, 'smithing');
  assert.ok(pP > 0 && pE > 0 && pB > 0 && pS > 0, 'every craft its percent');
  try {
    const A = await standBook({ FIRMAMENT_OPEN: 'on' });
    A.raw.prepare('INSERT INTO firmament (player, char_id, tree, updated_at) VALUES (?, ?, ?, ?)').run(A.mac.id, A.mac.character, packTree(tree), NOON);
    setFirmamentOnline(true);
    setFirmamentTree(tree);
    A.track('provisioning', xpForRank(30));
    A.track('enchanting', xpForRank(30));
    for (const [m, n] of [['food:meat', 9], ['food:mushroom', 9], ['p1:13', 9], ['p1:16', 9], ['reagent:troll-blood', 9], ['reagent:elixir-vitae', 9], ['metal:mercury', 9]]) A.give(m, n);
    assert.equal((await A.book.refresh()).ok, true);
    const ring = recipeById(RING.recipe);
    let page = standPage(A.book, { fire: true, alchemy: true, enchanter: true, disenchantable: () => [RING] });
    const clean = scaleXp(cookXp(30, { clean: true }), pP), brew = scaleXp(brewXp(potionById('healing'), 30), pP);
    try {
      page.press('The Fire', 'Hunter\'s Stew');
      assert.match(page.box('The Fire')[1].join('|'), new RegExp(`half as much again as its ${scaleXp(cookXp(30), pP)} Provisioning experience`));   // PIN MOVED (VOICE2)
      page.press('The Alchemy Station', 'Healing');
      assert.match(page.box('The Alchemy Station')[1].join('|'), new RegExp(`${brew} Provisioning experience, and 3,155 the first time`));   // PIN MOVED (VOICE2); PIN MOVED (FIRST-BUDGET): Provisioning's share
      assert.match(page.text('The Enchanting Station'), new RegExp(`\\+${scaleXp(disenchantXp(ring, 30, 21), pE)} Enchanting experience`));   // PIN MOVED (VOICE2)
    } finally { page.done(); }
    const dish = await A.book.craft('stew:north', { clean: true, name: 'Mac' }, (d) => mintPieces(d));
    assert.deepEqual([dish.data?.xp, dish.data?.first], [clean + firstCraftXp(recipeById('stew:north')), true], 'the Worker\'s clean pan: the percent on it, its first whole');   // PIN MOVED (FIRST-BUDGET)
    const b = await A.book.brew('healing', ['p1:16', 'reagent:troll-blood', 'reagent:elixir-vitae', 'metal:mercury'], {}, () => {});
    assert.deepEqual([b.ok, b.data?.xp], [true, brew + 3155], JSON.stringify(b));   // PIN MOVED (FIRST-BUDGET): Provisioning's share
    // the held lines: a room between the unscaled figure and the scaled one says "At most"
    const H = await standBook({ FIRMAMENT_OPEN: 'on' });
    H.track('building', xpForRank(60));
    H.track('provisioning', xpForRank(55));
    const tS = scaleXp(temperXp(recipeById('longsword:steel'), 50), pS), dE = scaleXp(disenchantXp(ring, 50, 21), pE);
    H.track('smithing', HELD - (tS - 1));
    H.track('enchanting', HELD - (dE - 1));
    H.give('ingot:steel', 9);
    assert.equal((await H.book.refresh()).ok, true);
    page = standPage(H.book, {
      forge: true, enchanter: true, disenchantable: () => [RING],
      temperable: (w) => (w === 'anvil' ? [{ item: {}, name: 'Steel Longsword', recipe: 'longsword:steel', quality: 1, provenance: null }] : []),
    });
    const BP = 'Building and Provisioning';
    try {
      assert.ok(page.notes('Temper at the Anvil').includes(LIMIT(tS - 1, 'Smithing', BP)), page.notes('Temper at the Anvil').join('|'));
      assert.ok(page.notes('The Enchanting Station').includes(LIMIT(dE - 1, 'Enchanting', BP)), page.notes('The Enchanting Station').join('|'));
    } finally { page.done(); }
    const M = await standBook({ FIRMAMENT_OPEN: 'on' });
    M.track('smithing', xpForRank(60));
    M.track('outfitting', xpForRank(60));
    const most = scaleXp(masonXp(1, 50, { clean: true }), pB) + workFirstXp(law.MASON_RECIPES[0]);   // PIN MOVED (FIRST-BUDGET)
    M.track('building', HELD - (most - 1));
    assert.equal((await M.book.refresh()).ok, true);
    page = standPage(M.book, { mason: true });
    try {
      assert.ok(page.notes('The Mason\'s Bench').includes(LIMIT(most - 1, 'Building', 'Smithing and Outfitting')), page.notes('The Mason\'s Bench').join('|'));
    } finally { page.done(); }
    // the fire's clean pan with the town's step, the percent on it, as the Worker pays it
    const S = await standBook({ FIRMAMENT_OPEN: 'on' });
    S.raw.prepare('INSERT INTO firmament (player, char_id, tree, updated_at) VALUES (?, ?, ?, ?)').run(S.mac.id, S.mac.character, packTree(tree), NOON);
    S.track('provisioning', xpForRank(30));
    assert.equal((await S.book.refresh()).ok, true);
    page = standPage(S.book, { fire: true, cookSteps: () => 1 });
    try {
      page.press('The Fire', 'Hunter\'s Stew');
      assert.match(page.box('The Fire')[1].join('|'), new RegExp(`${scaleXp(cookXp(30, { clean: true, steps: 1 }), pP)} Provisioning experience instead of ${scaleXp(cookXp(30, { steps: 1 }), pP)}`));   // PIN MOVED (VOICE2)
    } finally { page.done(); }
  } finally { _resetFirmamentLiveForTests(); }
});

test('AUDIT FB1018f L5-8 the limit\'s rows in the player\'s language: German\'s and Russian\'s crafts joined with their own "und" and "и", the rule\'s two arms (Russian\'s named crafts at two past, its before-the-choice arm at one), the tab\'s ceiling and Master\'s word - each the table\'s row as formatMessage reads it (mutants: the crafts joined in English; Russian\'s arms swapped)', () => {
  const two = law.craftLimit('smithing', { building: 60, provisioning: 55 }, HELD);
  try {
    for (const [lang, joined] of [['de', 'Building und Provisioning'], ['ru', 'Building и Provisioning']]) {
      const rows = tm.parseStringTableCsv(readFileSync(new URL(`../../locales/${lang}/Port_Strings.csv`, import.meta.url), 'utf8'));
      const row = new Map(rows);
      tm.patchLocaleTable(lang, 'Port_Strings', rows);
      tm.setLocale(lang);
      const say = (key, args) => tm.formatMessage(row.get(key), args);
      assert.equal(words.capLine('Smithing', { limit: two }, 60), say('prof.page.craft.xpLimit', { room: 0, profession: 'Smithing', crafts: joined, rank: 50 }), `${lang}: the station's line`);
      assert.equal(words.craftXpText(recipeById('dagger:silver'), { xp: 0, first: true }, 'Smithing', two), say('prof.craft.xpLimit', { xp: 0, profession: 'Smithing', crafts: joined, rank: 50 }), `${lang}: the craft's word`);
      assert.equal(words.limitRuleLine(['building', 'provisioning']), say('prof.page.limit.rule', { max: 2, full: 'yes', crafts: joined, rank: 50 }), `${lang}: the rule, two past`);
      assert.equal(words.limitRuleLine(['building']), say('prof.page.limit.rule', { max: 2, full: 'no', crafts: 'Building', rank: 50 }), `${lang}: the rule, one past`);
      assert.ok(words.limitRuleLine(['building', 'provisioning']).includes(joined) && !words.limitRuleLine(['building']).includes('Building'), `${lang}: the crafts named at two past alone`);
      assert.equal(words.craftXpText(recipeById('dagger:iron'), { xp: 0, first: true }, 'Smithing', law.craftLimit('smithing', { smithing: 100 }, PROF_XP_MAX)), say('prof.craft.xpTop', { xp: 0, profession: 'Smithing' }), `${lang}: Master's word`);
      assert.equal(pages.xpLine({ xp: HELD, rank: 50 }, two), say('prof.page.xpHeld', { xp: HELD, cap: HELD, rank: 50 }), `${lang}: the tab's ceiling`);
    }
    assert.match(words.limitRuleLine(['building', 'provisioning']), /^Выше Подмастерья могут подняться только 2 ремесла\. Ваши — Building и Provisioning, поэтому остальные ваши ремёсла/);   // PLAIN-SWEEP: the row redrafted from the plain English
    assert.match(words.limitRuleLine(['building']), /только 2 ремесла\. Как только 2 из ваших пройдут ранг 50/);
  } finally { tm.setLocale('en'); }
});
