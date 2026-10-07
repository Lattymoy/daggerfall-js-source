// CRAFT3 (2026-10-07, Mac: "How could we enhance the profession element of the game while reducing complexity and
// making crafting more viable"; then "Lets do it") - FIVE CRAFTS, NOT EIGHT: Smithing with Jewelcrafting, Building of
// Carpentry and Masonry, Outfitting, Provisioning of Alchemy and Cooking, Enchanting. The disciplines stay - a Ring is
// Jewelcrafting's, the Gemcutter its choice - and the TRACK is the craft's (net/professionLaw.js trackOf); 0088 merges
// the eight tracks a character held (the higher's XP, its choices, the lost one's change free). The done-when: a Ring and
// a Dagger raise one Smithing through the real Worker; the merge as 0088 writes it. bible/06-Systems/Professions-Arc.md 41.
import './chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import { standService, sessionStorageOf } from './accountDb.mjs';
import { accountProf, SESSION_KEY } from '../src/net/accountClient.js';
import { createProfBook } from '../src/net/profBook.js';
import {
  PROFESSIONS, DISCIPLINES, SPECIALISATIONS, SPEC_RANKS, trackOf, disciplinesOf, disciplineName, specDiscipline, specOk, specOf,
  professionName, isProfession, isGathering, craftXpCap, xpForRank, PROF_XP_MAX, smeltRecipe,
} from '../src/net/professionLaw.js';
import { RECIPES, masterworkSpec, recipeById, FIRST_CRAFT_XP, craftXp, cookXp } from '../src/net/recipeLaw.js';
import { mintPieces } from '../src/systems/smithItems.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const noWait = () => Promise.resolve();
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
const MIGRATIONS = readdirSync(new URL('../server-account/migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
const FUTURE = 4_000_000_000;

// ─── THE DONE-WHEN ───────────────────────────────────────────────────

test('CRAFT3 DONE WHEN: a Silver Ring and an Iron Dagger raise one Smithing track through the real Worker - each answered as Smithing\'s, each its first\'s 500; the state ten tracks, no Jewelcrafting', async () => {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on' });
  const raw = s.env.DB._raw;
  const mac = await s.registered('Mac');
  for (const [m, n] of [['metal:silver', 1], ['ingot:iron', 1], ['metal:tin', 1]]) raw.prepare('INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, \'own\', ?)').run(mac.id, mac.character, m, n);
  const door = accountProf({ fetch: s.fetch, storage: sessionStorageOf(SESSION_KEY, mac) });
  const book = createProfBook({ door, storage: memStorage(), character: () => mac.character, sleep: noWait });
  assert.equal((await book.refresh()).ok, true);
  assert.deepEqual([...book.state.tracks.keys()], PROFESSIONS.map((p) => p.id), 'the ten');
  const made = [];
  for (const id of ['ring:silver', 'dagger:iron']) {
    const r = await book.craft(id, { clean: false, name: 'Mac' }, (data) => mintPieces(data));
    assert.equal(r.ok, true, `${id}: ${JSON.stringify(r)}`);
    made.push([id, r.data.track.profession, r.data.xp]);
  }
  const each = craftXp(1, 0, false) + FIRST_CRAFT_XP;
  assert.deepEqual(made, [['ring:silver', 'smithing', each], ['dagger:iron', 'smithing', each]]);
  assert.equal(book.track('smithing').xp, 2 * each);
  assert.equal(book.track('jewelcrafting'), book.track('smithing'), 'a discipline\'s track its craft\'s');
  assert.deepEqual(raw.prepare('SELECT profession, xp FROM prof_tracks WHERE player = ?').all(mac.id).map((t) => [t.profession, t.xp]), [['smithing', 2 * each]], 'one row, the craft\'s');
});

// ─── THE MERGE (0088) ────────────────────────────────────────────────

/** Every migration before 0088 applied, `rows` written as the eight tracks stood, then 0088: the tracks as it leaves them. */
function merged(rows) {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = OFF');   // the tracks alone - no account rows to stand behind them
  for (const f of MIGRATIONS.filter((m) => m < '0088')) db.exec(src(`server-account/migrations/${f}`));
  const put = db.prepare('INSERT INTO prof_tracks (player, char_id, profession, xp, spec50, spec100, respec_rank, respec_to, respec_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  for (const r of rows) put.run(r.p ?? 'a', r.c, r.prof, r.xp, r.s50 ?? null, r.s100 ?? null, r.rr ?? null, r.rt ?? null, r.ra ?? null, r.up ?? 1);
  db.exec(src('server-account/migrations/0088_five_crafts.sql'));
  const out = {};
  for (const t of db.prepare('SELECT * FROM prof_tracks ORDER BY char_id, profession').all()) {
    out[`${t.char_id}|${t.profession}`] = [t.xp, t.spec50, t.spec100, t.respec_rank, t.respec_to, t.respec_at, t.free_respec];
  }
  assert.deepEqual(db.prepare("SELECT name FROM sqlite_master WHERE name LIKE 'craft3_%'").all(), [], 'its work tables dropped');
  return out;
}

test('CRAFT3 merge (0088): the higher parent\'s XP; a rank\'s choice the higher\'s, else the lower\'s; both chosen, the higher\'s kept and the rank free once; equal XP the first named; a lone parent as it stood; the other tracks untouched', () => {
  const x = (r) => xpForRank(r);
  const out = merged([
    // c1: both chose at 50 - the Jeweller's (higher) kept, 50 free; its 100 kept (the Smith chose none there)
    { c: 'c1', prof: 'smithing', xp: x(60), s50: 'weaponsmith' }, { c: 'c1', prof: 'jewelcrafting', xp: x(100), s50: 'gemcutter', s100: 'lapidary', up: 9 },
    // c2: the Mason higher, its Quarryman kept; the Carpenter chose nothing
    { c: 'c2', prof: 'carpentry', xp: x(20) }, { c: 'c2', prof: 'masonry', xp: x(55), s50: 'quarryman' },
    // c3: equal XP - the Carpenter (named first) is the higher
    { c: 'c3', prof: 'carpentry', xp: x(50), s50: 'joiner' }, { c: 'c3', prof: 'masonry', xp: x(50), s50: 'builder' },
    // c4: a lone Alchemist, as it stood
    { c: 'c4', prof: 'alchemy', xp: x(70), s50: 'brewer' },
    // c6: the higher (Smithing) chose nothing - the Jeweller's Goldsmith kept, nothing free
    { c: 'c6', prof: 'smithing', xp: x(70) }, { c: 'c6', prof: 'jewelcrafting', xp: x(40), s50: 'goldsmith' },
    // c5: untouched - a gatherer, a tailor, an enchanter
    { c: 'c5', prof: 'mining', xp: x(30), s50: 'prospector' }, { c: 'c5', prof: 'outfitting', xp: x(40) }, { c: 'c5', prof: 'enchanting', xp: x(75), s50: 'efficient' },
  ]);
  assert.deepEqual(out, {
    'c1|smithing': [x(100), 'gemcutter', 'lapidary', null, null, null, 1],
    'c2|building': [x(55), 'quarryman', null, null, null, null, 0],
    'c3|building': [x(50), 'joiner', null, null, null, null, 1],
    'c4|provisioning': [x(70), 'brewer', null, null, null, null, 0],
    'c5|enchanting': [x(75), 'efficient', null, null, null, null, 0],
    'c5|mining': [x(30), 'prospector', null, null, null, null, 0],
    'c5|outfitting': [x(40), null, null, null, null, null, 0],
    'c6|smithing': [x(70), 'goldsmith', null, null, null, null, 0],
  });
});

test('CRAFT3 merge (0088): a change on its way - the higher\'s kept; the lower\'s kept where its rank\'s choice is, else dropped and that rank free; a change already in effect folded first', () => {
  const x = (r) => xpForRank(r);
  const out = merged([
    // d1: the higher (Alchemy) has a change on its way at 50 - kept; the Cook's at 100 dropped (the Alchemist chose there), 100 free
    { c: 'd1', prof: 'alchemy', xp: x(100), s50: 'brewer', s100: 'transmuter', rr: 50, rt: 'distiller', ra: FUTURE },
    { c: 'd1', prof: 'cooking', xp: x(100) - 1, s50: 'cook', s100: 'chef', rr: 100, rt: 'provisioner', ra: FUTURE },
    // d2: the higher (Masonry) chose nothing at 100; the Carpenter's 100 and its change on its way kept, nothing free
    { c: 'd2', prof: 'carpentry', xp: x(90), s100: 'siegewright', rr: 100, rt: 'master-joiner', ra: FUTURE },
    { c: 'd2', prof: 'masonry', xp: PROF_XP_MAX },
    // d3: the lower's change at 100 dropped though its choice there is kept - the higher's own change at 50 stands; 100 free
    { c: 'd3', prof: 'smithing', xp: x(100), s50: 'armoursmith', rr: 50, rt: 'weaponsmith', ra: FUTURE },
    { c: 'd3', prof: 'jewelcrafting', xp: x(100) - 5, s100: 'master-jeweller', rr: 100, rt: 'lapidary', ra: FUTURE },
    // d4: a change already in effect (its day passed) is the choice, folded before the merge - so both chose at 50, 50 free
    { c: 'd4', prof: 'cooking', xp: x(80), s50: 'cook', rr: 50, rt: 'field-cook', ra: 1 },
    { c: 'd4', prof: 'alchemy', xp: x(60), s50: 'brewer' },
  ]);
  assert.deepEqual(out, {
    'd1|provisioning': [x(100), 'brewer', 'transmuter', 50, 'distiller', FUTURE, 2 | 1],
    'd2|building': [PROF_XP_MAX, null, 'siegewright', 100, 'master-joiner', FUTURE, 0],   // the lower's change kept
    'd3|smithing': [x(100), 'armoursmith', 'master-jeweller', 50, 'weaponsmith', FUTURE, 2],
    'd4|provisioning': [x(80), 'field-cook', null, null, null, null, 1],
  });
});

test('CRAFT3 merge (0088): the crafter\'s limit holds after it - a merged track is past Journeyman only where a parent was, so no character stands past it in three', () => {
  const x = (r) => xpForRank(r);
  const out = merged([
    { c: 'e1', prof: 'smithing', xp: x(70) }, { c: 'e1', prof: 'jewelcrafting', xp: x(60) },
    { c: 'e1', prof: 'carpentry', xp: x(50) }, { c: 'e1', prof: 'masonry', xp: x(50) },
    { c: 'e1', prof: 'alchemy', xp: x(30) }, { c: 'e1', prof: 'cooking', xp: x(50) },
  ]);
  const past = Object.entries(out).filter(([, v]) => v[0] > x(50)).map(([k]) => k);
  assert.deepEqual(past, ['e1|smithing'], 'two parents past it are one craft past it');
});

// ─── THE LAW ─────────────────────────────────────────────────────────

test('CRAFT3 law: ten tracks - the five that gather, the five that craft; eight disciplines, each its craft\'s; a merged craft\'s choices its two disciplines\' four a rank, each named its own; a discipline asked is its craft', () => {
  assert.deepEqual(PROFESSIONS.map((p) => [p.id, p.name, p.kind]), [
    ['mining', 'Mining', 'gathering'], ['logging', 'Logging', 'gathering'], ['herbalism', 'Herbalism', 'gathering'], ['hunting', 'Hunting', 'gathering'], ['fishing', 'Fishing', 'gathering'],
    ['smithing', 'Smithing', 'crafting'], ['building', 'Building', 'crafting'], ['outfitting', 'Outfitting', 'crafting'], ['provisioning', 'Provisioning', 'crafting'], ['enchanting', 'Enchanting', 'crafting'],
  ]);
  assert.deepEqual(DISCIPLINES.map((d) => [d.id, d.craft]), [
    ['smithing', 'smithing'], ['jewelcrafting', 'smithing'], ['carpentry', 'building'], ['masonry', 'building'],
    ['outfitting', 'outfitting'], ['alchemy', 'provisioning'], ['cooking', 'provisioning'], ['enchanting', 'enchanting'],
  ]);
  assert.deepEqual(['jewelcrafting', 'masonry', 'cooking', 'mining', 'building', 'nothing'].map(trackOf), ['smithing', 'building', 'provisioning', 'mining', 'building', 'nothing']);
  assert.deepEqual([disciplinesOf('building'), disciplinesOf('outfitting'), disciplinesOf('mining')], [['carpentry', 'masonry'], ['outfitting'], []]);
  assert.deepEqual([professionName('jewelcrafting'), professionName('provisioning'), disciplineName('jewelcrafting'), disciplineName('mining'), disciplineName('x')], ['Smithing', 'Provisioning', 'Jewelcrafting', 'Mining', '']);
  assert.deepEqual([isProfession('building'), isProfession('masonry'), isGathering('cooking'), isGathering('fishing')], [true, false, false, true]);
  const ids = (p, r) => SPECIALISATIONS[p][r].map((s) => s.id);
  assert.deepEqual(Object.keys(SPECIALISATIONS), PROFESSIONS.map((p) => p.id));
  assert.deepEqual([ids('smithing', 50), ids('smithing', 100)], [['weaponsmith', 'armoursmith', 'gemcutter', 'goldsmith'], ['masterwright', 'quartermaster', 'master-jeweller', 'lapidary']]);
  assert.deepEqual([ids('building', 50), ids('building', 100)], [['bowyer', 'joiner', 'quarryman', 'builder'], ['siegewright', 'master-joiner', 'fortifier', 'sculptor']]);
  assert.deepEqual([ids('provisioning', 50), ids('provisioning', 100)], [['brewer', 'distiller', 'cook', 'field-cook'], ['master-alchemist', 'transmuter', 'chef', 'provisioner']]);
  assert.deepEqual([ids('outfitting', 50), ids('enchanting', 100), ids('mining', 50)], [['tailor', 'leatherworker'], ['soulbinder', 'runecaster'], ['prospector', 'deep-delver']]);
  assert.deepEqual(['gemcutter', 'sculptor', 'chef', 'tailor', 'prospector', 'nobody'].map(specDiscipline), ['jewelcrafting', 'masonry', 'cooking', 'outfitting', 'mining', null]);
  assert.deepEqual([specOk('jewelcrafting', 50, 'weaponsmith'), specOk('smithing', 100, 'lapidary'), specOk('building', 50, 'sculptor'), specOf('masonry', 100, 'sculptor')?.name], [true, true, false, 'Sculptor']);
  // a choice whose slice is to come is named, never chosen (AUDIT 29 A17) - the Trophy Hunter, the Couturier, the Saddler
  assert.deepEqual([specOk('hunting', 100, 'trophy-hunter'), specOk('outfitting', 100, 'couturier'), specOk('outfitting', 100, 'saddler'), specOk('hunting', 100, 'butcher')], [false, false, false, true]);
  for (const p of PROFESSIONS) for (const r of SPEC_RANKS) assert.equal(SPECIALISATIONS[p.id][r].length, disciplinesOf(p.id).length > 1 ? 4 : 2, `${p.id} ${r}`);
});

test('CRAFT3 law: the crafter\'s limit two of five - a third craft past Journeyman stops at 50, a gathering track no craft, a discipline asked its craft\'s (a Ring held by Smithing\'s own rank never)', () => {
  const held = xpForRank(51) - 1;
  assert.equal(craftXpCap('provisioning', { smithing: 60, building: 51 }), held);
  assert.equal(craftXpCap('cooking', { smithing: 60, building: 51 }), held, 'a discipline its craft\'s');
  assert.equal(craftXpCap('jewelcrafting', { smithing: 60, building: 51 }), PROF_XP_MAX, 'its own craft never counted against it');
  assert.equal(craftXpCap('provisioning', { smithing: 60, building: 50, mining: 90 }), PROF_XP_MAX, 'a gathering track no craft; 50 not past');
  assert.equal(craftXpCap('enchanting', { jewelcrafting: 90, masonry: 90 }), PROF_XP_MAX, 'ranks are the tracks\' own - a discipline\'s key none');
});

test('CRAFT3 law: each choice acts on its own discipline\'s work - a Master Jeweller\'s Masterwork points on a jewel alone, a Masterwright\'s on the smith\'s; every recipe and work keeps its discipline', () => {
  const ring = recipeById('ring:gold:ruby'), sword = recipeById('longsword:steel');
  assert.deepEqual([masterworkSpec('master-jeweller', ring), masterworkSpec('master-jeweller', sword), masterworkSpec('masterwright', sword), masterworkSpec('masterwright', ring), masterworkSpec('masterwright')], [true, false, true, false, true]);
  assert.deepEqual([...new Set(RECIPES.map((r) => r.profession))].sort(), ['carpentry', 'cooking', 'jewelcrafting', 'masonry', 'outfitting', 'smithing']);
  assert.deepEqual([smeltRecipe('cut:stone').xp, smeltRecipe('transmute:tin').spec.profession], ['masonry', 'alchemy'], 'the works their discipline\'s');
});

// ─── THE SERVICE ─────────────────────────────────────────────────────

test('CRAFT3 service: the merge\'s free change - no Marks, in effect at once, answered `free`, once (the next a paid one); a discipline named is its craft (an older client\'s); the crafter\'s limit holds a dish at 50 behind Smithing and Building', async () => {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on' });
  const raw = s.env.DB._raw;
  const mac = await s.registered('Mac');
  raw.prepare('INSERT INTO prof_tracks (player, char_id, profession, xp, spec50, updated_at, free_respec) VALUES (?, ?, \'smithing\', ?, \'gemcutter\', 1, 1)').run(mac.id, mac.character, PROF_XP_MAX);
  raw.prepare('INSERT INTO prof_tracks (player, char_id, profession, xp, updated_at) VALUES (?, ?, \'building\', ?, 1)').run(mac.id, mac.character, xpForRank(60));
  raw.prepare('INSERT INTO prof_tracks (player, char_id, profession, xp, updated_at) VALUES (?, ?, \'provisioning\', ?, 1)').run(mac.id, mac.character, xpForRank(51) - 101);   // rank 50, 100 short of the cap
  for (const [m, n] of [['food:meat', 2], ['food:mushroom', 1], ['p1:13', 1]]) raw.prepare('INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, \'own\', ?)').run(mac.id, mac.character, m, n);
  const door = accountProf({ fetch: s.fetch, storage: sessionStorageOf(SESSION_KEY, mac) });
  const book = createProfBook({ door, storage: memStorage(), character: () => mac.character, sleep: noWait });
  assert.equal((await book.refresh()).ok, true);
  assert.deepEqual([book.track('smithing').specs[50], book.track('smithing').free], ['gemcutter', [50]], 'the free change said');
  const free = await book.choose('jewelcrafting', 50, 'weaponsmith');
  assert.equal(free.ok, true, JSON.stringify(free));
  assert.deepEqual([free.data.free, free.data.track.profession, free.data.track.specs[50], free.data.track.respec, free.data.track.free], [true, 'smithing', 'weaponsmith', null, undefined], 'in effect at once, the bit spent');
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM marks_ledger WHERE actor = ?').get(mac.id).n, 0, 'no Marks');
  const paid = await book.choose('smithing', 50, 'goldsmith');
  assert.equal(paid.ok, false);
  assert.equal(paid.error, 'marks-short', 'the next change a paid one');
  // an older client asks the discipline's name - the service answers it as its craft's track
  const old = await door.spec(mac.character, 'jewelcrafting', 100, 'lapidary', null, 'craft3-old-client');
  assert.equal(old.ok, true, JSON.stringify(old));
  assert.deepEqual([old.data.track.profession, old.data.track.specs[100]], ['smithing', 'lapidary']);
  const dish = await book.craft('stew:north', { clean: false, name: 'Mac' }, (data) => mintPieces(data));
  assert.equal(dish.ok, true, JSON.stringify(dish));
  assert.deepEqual([dish.data.track.profession, dish.data.xp, dish.data.track.xp], ['provisioning', 100, xpForRank(51) - 1], 'held one short of 51');
  assert.ok(cookXp(50) + FIRST_CRAFT_XP > dish.data.xp, 'the cap is what held it');
});

test('CRAFT3 service source: every track read and credit is the craft\'s - the craft, the smelt, the brew, the seats\' choices; a free change its own row (source pins)', () => {
  const svc = src('server-account/src/professions.js');
  assert.match(svc, /db\.prepare\('SELECT \* FROM prof_tracks WHERE player = \?1 AND char_id = \?2 AND profession = \?3'\)\.bind\(player, character, trackOf\(profession\)\)\.first\(\);/);
  assert.match(svc, /const craft = trackOf\(prof\);/);
  assert.match(svc, /\.bind\(player\.id, character, rid, cap, nowS, nonce, trackOf\(r\.xp\)\)\] : \[\]\),/);
  assert.match(svc, /const profession = trackOf\(asked\);/);
  assert.match(src('server-account/src/alchemy.js'), /SELECT \?1, \?2, '\$\{trackOf\('alchemy'\)\}', MIN\(\?4, xp\), \?5 FROM prof_brews/);
  const forts = src('server-account/src/seatForts.js');
  assert.match(forts, /t\.profession = '\$\{trackOf\('masonry'\)\}'/);
  assert.match(forts, /t\.profession = '\$\{trackOf\('carpentry'\)\}'/);
});

// ─── THE PAGE ────────────────────────────────────────────────────────

test('CRAFT3 page: the Professions tab lists the ten; Building\'s four cards a rank, each its discipline\'s name, a free change said "free, once"; its unlocks both disciplines\', each named; the limit "of 2"', async () => {
  const { setProfessionsPages, drawProfessionsPage, resetProfPages, unlocksOf } = await import('../src/ui/profPages.js');
  resetProfPages();
  const tracks = new Map(PROFESSIONS.map((p) => [p.id, { profession: p.id, xp: 0, rank: 0, specs: { 50: null, 100: null }, respec: null }]));
  tracks.set('building', { profession: 'building', xp: xpForRank(60), rank: 60, specs: { 50: 'quarryman', 100: null }, respec: null, free: [50] });
  const book = {
    state: { open: true, day: 1, character: 'c', account: 'a', readAt: Date.now(), stores: new Map(), tracks, today: {}, caps: null }, stale: () => false, refresh: async () => ({ ok: true }),
    track: (p) => tracks.get(trackOf(p)), choose: async () => ({ ok: true }),
  };
  setProfessionsPages({ book, name: (k) => k });
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const kit = { el, divider: (w) => el('h3', null, w), meter: () => el('div') };
  let root = null;
  const draw = () => { root?.remove?.(); root = el('div'); document.body.append(root); drawProfessionsPage(root, draw, kit); };
  try {
    draw();
    const rows = [...root.querySelectorAll('button')].filter((b) => b.className.includes('prof-row'));
    assert.deepEqual(rows.map((b) => b.querySelector('.prof-name').textContent), PROFESSIONS.map((p) => p.name));
    rows.find((b) => b.textContent.startsWith('Building')).onclick();
    const cards = [...root.querySelectorAll('button')].filter((b) => b.className.includes('prof-spec'));
    assert.deepEqual(cards.map((c) => [c.querySelector('b').textContent, c.querySelector('.prof-of')?.textContent]), [
      ['Bowyer', 'Carpentry'], ['Joiner', 'Carpentry'], ['Quarryman', 'Masonry'], ['Builder', 'Masonry'],
      ['Siegewright', 'Carpentry'], ['Master Joiner', 'Carpentry'], ['Fortifier', 'Masonry'], ['Sculptor', 'Masonry'],
    ]);
    assert.deepEqual(cards.slice(0, 4).map((c) => c.querySelector('.prof-cost')?.textContent ?? null), ['Change: free, once', 'Change: free, once', null, 'Change: free, once']);
    assert.match(root.textContent, /Masonry: Cut Stone, from Rough Stone/);
    assert.match(root.textContent, /Carpentry: Pine: staves, bows, arrows, the Basket, a plain single bed/);
    assert.match(root.textContent, /Crafts above Journeyman: 1 of 2/);
    assert.deepEqual(unlocksOf('building').map(([w, t]) => [w.split(':')[0], t]), [
      ['Carpentry', 1], ['Masonry', 1], ['Carpentry', 2], ['Masonry', 2], ['Carpentry', 3], ['Carpentry', 4], ['Carpentry', 5], ['Carpentry', 6],
    ], 'by tier, a tier\'s first discipline first');
    assert.deepEqual([unlocksOf('outfitting')?.[0]?.[0], unlocksOf('enchanting')], ['Linen clothing; the Rat\'s skins; the Fishing-Net', null], 'one discipline its own lines');
    cards[0].onclick(); draw();
    const armed = [...root.querySelectorAll('button')].filter((b) => b.className.includes('prof-spec'))[0];
    assert.equal(armed.querySelector('.prof-cost').textContent, 'Press again: free, in effect at once');
  } finally { setProfessionsPages(null); resetProfPages(); root?.remove(); }
});
