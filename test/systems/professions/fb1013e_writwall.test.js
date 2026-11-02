// FIELD BUGS 2026-10-13e - WRIT-WALL, the Discord's "Cant turn in writs": "Have the materials literally on hand. They
// don't accept them. Doesn't really seem to matter if they're in the 'stores' part of your character. Or in the bag."
// The screenshots: "Chapter writ - Wanted: 40 Iron, for the Mages Guild in Alik'r Desert - Pays 48 silver, 75 Renown ...
// [Take] 0 held", and the inventory's "Iron - 100 of them".
//
// The item and the count are right (`metal:iron`, 100 held). A writ counts what law 3 lets it spend - the Stores' own and
// bought, and the units the service handed out and still counts (net/profBook.js held; the service's spendableSql) - so
// Iron bought at an Alchemist's shelf, looted, traded or bought with gold reads 0. BY DESIGN, and kept: law 3 and
// GOLD-MARKET's wall. THE DEFECT was the card: "0 held", Take shut, and a hover that said "Not enough - your Stores,
// Materials Bag and pack together" - false beside a pack of 100, and a phone has no hover. The card names now, on the
// card and on Take's title, what is held and walled and why (profBook.js walled, workTab.js writWalledText); a guild
// writ's card the same; the service's gold refusal no longer sends the reader to withdraw what withdrawn is walled still.
// Driven through the real Worker over node:sqlite (test/accountDb.mjs), the real books and the real board.
// `01-Overview/bugs/Field-Bugs-2026-10-13e.md` WRIT-WALL; `06-Systems/Materials-Bag.md` section 4.
import '../../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import '../../../src/systems/professions/profTemplates.js';
import { byClass } from '../../chargenDom.mjs';
import { standService, T0, sessionStorageOf } from '../../accountDb.mjs';
import { seatRealm } from '../../realmSeat.mjs';
import { accountProf, accountWrits, accountRefusalText, SESSION_KEY } from '../../../src/net/accountClient.js';
import { createProfBook } from '../../../src/net/profBook.js';
import { createWritBook } from '../../../src/net/writBook.js';
import { BAG_TEMPLATE } from '../../../src/net/bagLaw.js';
import { mountNoticeBoard } from '../../../src/ui/noticeWindow.js';
import { writWalledText } from '../../../src/ui/workTab.js';
import { materialCountLabel } from '../../../src/systems/professions/profItems.js';
import { heldOf, roomFor, mintCarried, takeCarried, giveCarried, bagTakesOf, materialKeyOfItem } from '../../../src/systems/materialsBag.js';
import { setItemFields } from '../../../src/systems/item/itemTemplates.js';
import { stockShopShelf } from '../../../src/systems/shopStock.js';
import { BUILDING_TYPES } from '../../../src/world/buildingNames.js';
import { GUILD_FACTION_IDS } from '../../../src/systems/guild/guildFactions.js';

let _now = T0;
const realNow = Date.now;
Date.now = () => _now * 1000;
test.after(() => { Date.now = realNow; });
let _rid = 0;
const rid = () => `wall-${String(++_rid).padStart(6, '0')}`;
const IRON = 'metal:iron';
const ALIKR = 0;   // REGION_NAMES[0], the report's region
const DF = 17;
const HUBS = { [DF]: [207, 212] };
const tick = () => new Promise((r) => setImmediate(r));
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
/** THE REPORT'S WORDS, written out - the helper's English pinned apart from the helper. */
const SAID = (n) => `${n} Iron you hold can't fill a writ. Only what you gathered or bought with silver counts.`;

async function stand() {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on', CHAPTERS_OPEN: 'on' });
  const raw = s.env.DB._raw;
  const stores = (who, m = IRON) => raw.prepare('SELECT origin, qty FROM prof_stores WHERE player = ? AND char_id = ? AND material = ? AND qty > 0 ORDER BY origin')
    .all(who.id, who.character, m).map((r) => [r.origin, Number(r.qty)]);
  const carried = (who, m = IRON) => raw.prepare('SELECT origin, qty FROM prof_carried WHERE player = ? AND char_id = ? AND material = ? AND qty > 0 ORDER BY origin')
    .all(who.id, who.character, m).map((r) => [r.origin, Number(r.qty)]);
  const give = (who, origin, qty, m = IRON) => raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = excluded.qty`).run(who.id, who.character, m, origin, qty);
  const count = (who, origin, qty, m = IRON) => raw.prepare(`INSERT INTO prof_carried (player, char_id, material, origin, qty) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = excluded.qty`).run(who.id, who.character, m, origin, qty);
  /** A registered account playing a realm character - a gold buyer's or seller's (GOLD-MARKET: a realm character's alone). */
  const seated = async (handle, save) => {
    const who = await s.registered(handle);
    const R = await seatRealm(s.env, who.secret, handle, { name: handle, level: 5, items: [], ...save });
    who.character = R.id;
    who.at = R.at;
    return who;
  };
  /** The report's writ: a Mages Guild chapter's in the Alik'r Desert, 40 Iron for 48 silver and 75 Renown - posted today. */
  const day = Math.floor(_now / 86_400);
  raw.prepare(`INSERT INTO writs (id, kind, day, region, faction, slot, material, tier, qty, pay, renown, expires_at)
    VALUES (?, 'hall', ?, ?, ?, 0, ?, 1, 40, 48, 75, ?)`).run(`h:${day}:${ALIKR}:40:0`, day, ALIKR, GUILD_FACTION_IDS.MagesGuild, IRON, _now + 3600);
  return { ...s, raw, stores, carried, give, count, seated };
}

/** The host's hands on an entity, as scenes/world.js builds them (test/systems/bag1_client.test.js's). */
const hands = (e) => ({
  held: (k) => heldOf(e, k), room: (k) => roomFor(e, k), mint: (k, n) => mintCarried(e, k, n),
  take: (k, n, id, order) => takeCarried(e, k, n, id, order), give: (k, n) => giveCarried(e, k, n),
  stamped: (id) => Object.hasOwn(bagTakesOf(e), id), unstamp: (id) => { delete e.bagTakes?.[id]; },
  stamps: () => Object.entries(bagTakesOf(e)).map(([id, t]) => ({ id, ...t })),
});
/** A character of strength 50 with a Materials Bag on its back. */
const body = () => ({ stats: { strength: 50 }, items: [setItemFields({ group: 'UselessItems2', templateIndex: BAG_TEMPLATE })], bagItems: [], wagonItems: [], goldPieces: 0 });
const bookOf = (s, who, e) => createProfBook({ door: accountProf({ fetch: s.fetch, storage: sessionStorageOf(SESSION_KEY, who) }), storage: memStorage(),
  character: () => who.character, sleep: () => Promise.resolve(), carry: e ? hands(e) : null });
const writBookOf = (s, who) => createWritBook({ door: accountWrits({ fetch: s.fetch, storage: sessionStorageOf(SESSION_KEY, who) }), storage: memStorage(),
  character: () => who.character, sleep: () => Promise.resolve() });

/** THE PRODUCER: Iron off an Alchemist's shelf (DFU's StockShopShelf - the MetalIngredients group, template 71), a stack of
 *  `n` as a purchase of that many moves it - the very item a vein's mint makes, never counted. */
function shopIron(n) {
  const shelf = stockShopShelf({ buildingType: BUILDING_TYPES.Alchemist, quality: 20 }, {}, { rolls: () => 0, torchesFromItems: false, shelfIndex: 1 });
  const iron = shelf.find((it) => it.group === 'MetalIngredients' && it.templateIndex === 71);
  assert.ok(iron, 'the Alchemist shelves Iron');
  assert.equal(materialKeyOfItem(iron), IRON, 'one item in the pack whoever minted it (Materials-Bag.md 5)');
  return { ...structuredClone(iron), stackCount: n };
}

/** CRAFT-WRITS: a wait on the real Worker's read by the clock, not a count of turns - the list's read does more since the
 *  crafting writs ride it, and 400 turns ran out under a loaded suite. */
async function until(done, ms = 20_000) {
  const end = performance.now() + ms;   // never Date.now: this file holds it still
  while (!done() && performance.now() < end) await tick();
}
/** The real board's Work tab, read off the real books - the Court's and the chapters' writs, and the guild writs beside them. */
async function workTab(book, writs = null) {
  const notices = { seenAt: () => null, read: async () => ({ board: { notes: [], notices: [], me: {} } }), markSeen() {}, cached: () => null, draft: () => ({ subject: '', body: '', days: 7, button: '' }), noticeDraft: () => ({ subject: '', body: '', days: 3 }) };
  const host = document.createElement('div');
  const v = mountNoticeBoard(host, { town: { name: 'Sentinel', mapId: 5 }, book: notices, work: { book, region: ALIKR, regionName: "Alik'r Desert", countName: (k, n) => materialCountLabel(k, n, false),
    ...(writs ? { writs, regionNameOf: () => 'another region', pieces: () => [] } : {}) } });
  await tick();
  byClass(host, 'notice-tab').find((t) => t.textContent.startsWith('Work')).click();
  await until(() => byClass(host, 'notice-writ').some((c) => byClass(c, 'writ-kind')[0]?.textContent === 'Chapter writ'));
  const card = (kind) => byClass(host, 'notice-writ').find((c) => byClass(c, 'writ-kind')[0]?.textContent === kind);
  return { host, v, card };
}
const walledOf = (card) => byClass(card, 'writ-walled').map((p) => p.textContent);
const takeOf = (card) => byClass(card, 'notice-take')[0];

test('WRIT-WALL the report: Iron off an Alchemist\'s shelf in the bag, then Iron bought with gold in the Stores and withdrawn - the chapter writ\'s card reads 0 held, Take shut, and SAYS so: how many it holds that no writ takes, and why, on the card and on Take\'s title; a guild writ\'s card the same, never "You have none" (mutants: walled unread; the card\'s line suppressed; Take\'s title the old words; the guild card\'s line suppressed, unwired, or saying "none"; gold or the carried excess dropped; the gold refusal sending the reader to withdraw)', async () => {
  const s = await stand();
  // the market's gold: Eve lists her own Iron for gold, Tom buys it - GOLD-MARKET's producer of `gold` units
  const eve = await s.seated('Eve', { goldPieces: 0 });
  const tom = await s.seated('Tom', { goldPieces: 10_000 });
  s.give(eve, 'own', 200);
  const list = await s.call('/v1/market/list', { character: eve.character, region: DF, kind: 'material', material: IRON, units: 100, price: 2, hubs: HUBS, rid: rid(), currency: 'gold' }, eve.secret);
  assert.equal(list.status, 200, JSON.stringify(list.body));
  // a guild's writ in the region, 100 Iron wanted (PROF6) - posted as goldmarket_service's guild writ is
  const gm = await s.registered('Aldric', { renown: 10 });
  s.seedMarks(gm, 100_000, 'gm');
  assert.ok((await s.found(gm, { name: 'The Gilded', tag: 'GLD' })).body.guild?.id);
  assert.equal((await s.call('/v1/marks/guild/deposit', { character: gm.character, marks: 1000, rid: rid() }, gm.secret)).status, 200);
  const post = await s.call('/v1/writs/post', { character: gm.character, region: ALIKR, material: IRON, units: 100, pay: 1, rid: rid() }, gm.secret);
  assert.equal(post.status, 200, JSON.stringify(post.body));

  // 1. THE BAG: 100 Iron off the shelf - "Iron - 100 of them"
  const e = body();
  e.bagItems.push(shopIron(100));
  assert.equal(heldOf(e, IRON), 100);
  const book = bookOf(s, tom, e);
  assert.equal((await book.refresh()).ok, true);
  assert.deepEqual([book.held(IRON), book.walled(IRON)], [0, 100], 'law 3 kept: none of it a writ\'s - and all of it named');
  let b = await workTab(book, writBookOf(s, tom));
  let card = b.card('Chapter writ');
  assert.ok(card, 'the report\'s writ on the board');
  assert.equal(byClass(card, 'writ-need')[0].textContent, 'Wanted: 40 Iron, for the Mages Guild in Alik\'r Desert');
  assert.match(card.textContent, /Pays 48 silver, 75 Renown/);
  assert.match(byClass(card, 'writ-take')[0].textContent, /0 held$/, 'the count is law 3\'s, as it was');
  assert.equal(takeOf(card).disabled, true, 'nothing a writ may spend: Take shut, as it was');
  assert.deepEqual(walledOf(card), [SAID(100)], 'ON THE CARD - a phone has no hover');
  assert.equal(walledOf(card)[0], writWalledText(100, 'Iron'));
  assert.equal(takeOf(card).title, SAID(100), 'and Take\'s title the same - never "Not enough, even counting your Stores, Materials Bag and pack together"');
  let guild = b.card('Guild writ');
  assert.ok(guild, 'the guild writ beside it');
  assert.deepEqual(walledOf(guild), [SAID(100)], 'a guild writ\'s card names them too');
  assert.doesNotMatch(guild.textContent, /You have none/, 'never "You have none" beside a bag of 100');
  assert.equal(byClass(guild, 'work-deliver').length, 0, 'and offers no Deliver of them');
  b.v.unmount();

  // 2. THE STORES: 100 more bought with gold (the screenshot's other half: "Doesn't really seem to matter if they're in
  // the 'stores' part") - then 30 of them withdrawn into the bag, gold's still (GOLD-MARKET: a unit keeps its origin)
  const listing = list.body.listing;
  const buy = await s.call('/v1/market/buy', { character: tom.character, region: DF, listing: listing.id, units: 100, max: 100 * listing.price, hubs: HUBS, rid: rid(), realm: tom.at() }, tom.secret);
  assert.equal(buy.status, 200, JSON.stringify(buy.body));
  assert.deepEqual(s.stores(tom), [['gold', 100]], 'into the Stores as gold\'s');
  await book.refresh({ force: true });
  assert.deepEqual([book.held(IRON), book.walled(IRON)], [0, 200], 'the Stores\' gold walled with the bag\'s');
  const w = await book.withdraw(IRON, 30, (k, n) => giveCarried(e, k, n));
  assert.equal(w.ok, true, JSON.stringify(w));
  assert.deepEqual([s.stores(tom), s.carried(tom), heldOf(e, IRON)], [[['gold', 70]], [['gold', 30]], 130], 'withdrawn: counted carried, as gold');
  assert.deepEqual([book.held(IRON), book.walled(IRON)], [0, 200], 'withdrawn, gold\'s units are walled still - 70 in the Stores, 130 carried past the count');
  b = await workTab(book, writBookOf(s, tom));
  card = b.card('Chapter writ');
  assert.match(byClass(card, 'writ-take')[0].textContent, /0 held$/);
  assert.equal(takeOf(card).disabled, true);
  assert.deepEqual(walledOf(card), [SAID(200)]);
  assert.equal(takeOf(card).title, SAID(200));
  assert.deepEqual(walledOf(b.card('Guild writ')), [SAID(200)]);
  b.v.unmount();
  // the service's own word for it, asked straight: gold's units are short of the writ - and the words no longer send the
  // reader to withdraw them (withdrawn, they stay gold's: no writ, station or guild Stores takes them from the pack either)
  const asked = await s.call('/v1/writs/deliver', { character: tom.character, id: `h:${Math.floor(_now / 86_400)}:${ALIKR}:40:0`, rid: rid() }, tom.secret);
  assert.deepEqual(asked.body, { error: 'stores-gold' });
  assert.equal(accountRefusalText('stores-gold'), 'What you bought with gold is not used there, in your Stores or out of them: it goes to your pack or back on the market for gold.');
  assert.doesNotMatch(accountRefusalText('stores-gold'), /[Ww]ithdraw/, '"Withdraw it to your pack" (its words before WRIT-WALL) promised what withdrawing never gives');
});

test('WRIT-WALL mined Iron, counted: no walled line, Take open and delivering from the bag; a mix - counted short of the writ, the rest looted - names only the rest; counted enough beside the walled says nothing of them; short with nothing walled says what it always said (mutants: walled unread; the line where nothing is walled; said where the writ fills)', async () => {
  const s = await stand();
  // a harvest into the Stores is `own` (the older door: Materials-Bag.md 3), withdrawn into the bag counted carried
  // PIN MOVED (INT16, Integrity-Arc section 7): a writ's delivery is a progression claim, asked of the account's SEATED
  // realm character (progress.js progressRefusal) - Ann plays one (stand's `seated`), where an offline id is refused
  // 'progress-seat' before the writ is read
  const ann = await s.seated('Ann');
  s.give(ann, 'own', 60);
  const e = body();
  const book = bookOf(s, ann, e);
  assert.equal((await book.refresh()).ok, true);
  assert.equal((await book.withdraw(IRON, 60, (k, n) => giveCarried(e, k, n))).ok, true);
  assert.deepEqual([s.stores(ann), s.carried(ann), heldOf(e, IRON)], [[], [['own', 60]], 60]);
  assert.deepEqual([book.held(IRON), book.walled(IRON)], [60, 0], 'every unit counted, none walled');
  let b = await workTab(book);
  let card = b.card('Chapter writ');
  assert.match(byClass(card, 'writ-take')[0].textContent, /60 held$/);
  assert.equal(takeOf(card).disabled, false, 'Take open');
  assert.ok(!takeOf(card).title, 'and no title');
  assert.deepEqual(walledOf(card), [], 'nothing walled: no line');
  takeOf(card).click();
  await until(() => /Taken by you/.test(b.card('Chapter writ')?.textContent ?? ''));
  assert.match(b.card('Chapter writ').textContent, /Taken by you/, 'delivered: the writ is the reader\'s');
  assert.deepEqual([s.stores(ann), s.carried(ann), heldOf(e, IRON)], [[], [['own', 20]], 20], 'its 40 put in from the bag and spent');
  b.v.unmount();

  // a mix: 20 counted left of the 60 and, beside them, 100 from the Alchemist - short of a 40-unit writ, and the 100 named
  _now += 86_400;
  const day = Math.floor(_now / 86_400);
  s.raw.prepare(`INSERT INTO writs (id, kind, day, region, faction, slot, material, tier, qty, pay, renown, expires_at)
    VALUES (?, 'hall', ?, ?, ?, 0, ?, 1, 40, 48, 75, ?)`).run(`h:${day}:${ALIKR}:40:0`, day, ALIKR, GUILD_FACTION_IDS.MagesGuild, IRON, _now + 3600);
  e.items.push(shopIron(100));
  await book.refresh({ force: true });
  assert.deepEqual([book.held(IRON), book.walled(IRON)], [20, 100]);
  b = await workTab(book);
  card = b.card('Chapter writ');
  assert.match(byClass(card, 'writ-take')[0].textContent, /20 held$/);
  assert.equal(takeOf(card).disabled, true);
  assert.deepEqual(walledOf(card), [SAID(100)], 'the 100 named, the 20 counted not');
  assert.equal(takeOf(card).title, SAID(100));
  b.v.unmount();
  // and enough counted beside them (30 more own in the Stores): the writ fills - the walled 100 are no reason, unsaid
  s.give(ann, 'own', 30);
  await book.refresh({ force: true });
  assert.deepEqual([book.held(IRON), book.walled(IRON)], [50, 100]);
  b = await workTab(book);
  card = b.card('Chapter writ');
  assert.equal(takeOf(card).disabled, false);
  assert.deepEqual(walledOf(card), [], 'said only where it is why the writ cannot be filled');
  assert.ok(!takeOf(card).title);
  b.v.unmount();
  s.give(ann, 'own', 0);

  // short with nothing walled: the old words, and no line
  e.items.pop();
  await book.refresh({ force: true });
  assert.deepEqual([book.held(IRON), book.walled(IRON)], [20, 0]);
  b = await workTab(book);
  card = b.card('Chapter writ');
  assert.equal(takeOf(card).disabled, true);
  assert.deepEqual(walledOf(card), []);
  assert.equal(takeOf(card).title, 'Not enough in your Stores, Materials Bag and pack together');
  b.v.unmount();
});

test('WRIT-WALL the book\'s walled, case by case over the service\'s own answer: the Stores\' gold and loose units, the carried count\'s gold, every unit held past the count, and a mix with some counted; never what `held` counts; a book that carries nothing reads the Stores alone (mutants: gold dropped; loose dropped; the carried excess dropped; read as UNCOUNTED\'s, the carried gold left out)', async () => {
  const s = await stand();
  const cases = [
    // [name, Stores { origin: n }, carried { origin: n }, held in the bag, held, walled]
    ['the Stores\' gold alone', { gold: 5 }, {}, 0, 0, 5],
    ['the Stores\' loose alone (a station\'s put-in from the pack)', { loose: 7 }, {}, 0, 0, 7],
    ['looted in the bag, nothing counted', {}, {}, 9, 0, 9],
    ['carried gold, held', {}, { gold: 3 }, 3, 0, 3],
    ['carried own, and more held past it', {}, { own: 4 }, 10, 4, 6],
    ['a mix with some counted', { own: 2, bought: 1, gold: 5, loose: 7 }, { own: 4, gold: 3 }, 20, 7, 28],
    ['the pack under the count: gold\'s cut first, the rest walled is the gold still held', {}, { own: 4, gold: 3 }, 5, 4, 1],
    ['all counted', { own: 6, bought: 2 }, { own: 4, bought: 1 }, 5, 13, 0],
  ];
  let i = 0;
  for (const [name, st, ca, bag, held, walled] of cases) {
    const who = await s.registered(`Wall${++i}`);
    for (const [o, n] of Object.entries(st)) s.give(who, o, n);
    for (const [o, n] of Object.entries(ca)) s.count(who, o, n);
    const e = body();
    if (bag > 0) e.bagItems.push(shopIron(bag));
    const book = bookOf(s, who, e);
    assert.equal((await book.refresh()).ok, true, name);
    assert.deepEqual([book.held(IRON), book.walled(IRON)], [held, walled], name);
    assert.equal(book.held(IRON) + book.walled(IRON), (st.own ?? 0) + (st.bought ?? 0) + (st.gold ?? 0) + (st.loose ?? 0) + bag, `${name}: every unit held is counted or walled, never both`);
  }
  // a book with no hands (no bag, no pack to read): the Stores' walled origins alone
  const who = await s.registered('Plain');
  s.give(who, 'gold', 5); s.give(who, 'loose', 2); s.give(who, 'own', 1);
  const plain = bookOf(s, who, null);
  assert.equal((await plain.refresh()).ok, true);
  assert.deepEqual([plain.held(IRON), plain.walled(IRON)], [1, 7]);
});
