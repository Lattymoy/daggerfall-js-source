// FB1020h ESSENCE-LOOSE (FIELD BUGS 2026-10-20h, report 5 - the Discord's #bug-reports, "the Arcana Essence marked
// 'bought with gold'"; bible/01-Overview/bugs/Field-Bugs-2026-10-20h.md ESSENCE-LOOSE). A piece crafted at a station with
// any unit the service never handed out - a looted, traded or shop-bought stack, put in LOOSE by the station's own put-in
// (AUDIT BAG-CRAFT A1, bagLaw.js LOOSE_ORIGIN) - is walled to gold on its products row (`bought_with` 'gold': it lists
// for gold alone, as a pack's piece does). The disenchant read that column as the piece's last purchase (migration 0041's
// word for it) and put the piece's Arcane Essence into the Stores as GOLD's: "21 bought with gold" on the Stores page,
// "Bought with gold. It can go to your pack..." under it, and the Reforge with Essence - a station - refused it. Now the
// piece says what walled it (`products.loose`, migration 0142), its Essence is LOOSE - a station's, as a smelt's products
// of loose goods are - and the Reforge spends it as a station spends, loose first. A piece bought with gold still gives
// gold's Essence (Professions-Arc 10.8's wall and section 37's law). Driven through the real Worker over node:sqlite
// with every migration applied (test/accountDb.mjs), the client's own book over it, and the Stores page it draws.
import '../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import '../../src/systems/professions/profTemplates.js';
import { standService, sessionStorageOf, T0 } from '../accountDb.mjs';
import { layRecord, holdPieces } from '../realmSeat.mjs';
import { xpForRank, ARCANE_ESSENCE } from '../../src/net/professionLaw.js';
import { recipeById } from '../../src/net/recipeLaw.js';
import { utcDay } from '../../src/net/marksLaw.js';
import { accountProf, SESSION_KEY } from '../../src/net/accountClient.js';
import { createProfBook } from '../../src/net/profBook.js';
import { heldOf, roomFor, mintCarried, takeCarried, giveCarried, bagTakesOf } from '../../src/systems/materialsBag.js';
import { setItemFields } from '../../src/systems/item/itemTemplates.js';
import { BAG_TEMPLATE } from '../../src/net/bagLaw.js';
import { weaponOfMaterial } from '../../src/combat/enemyEquipment.js';
import { applyRarity } from '../../src/systems/loot/lootRarity.js';
import { seededRng } from '../../src/systems/wind/wind.js';
import { mintPiece } from '../../src/systems/smithItems.js';

const DAY = 86_400;
const _now = utcDay(T0) * DAY + 43_200;
const realNow = Date.now;
Date.now = () => _now * 1000;
test.after(() => { Date.now = realNow; });
let _rid = 0;
const rid = () => `ess-${String(++_rid).padStart(6, '0')}`;
const ESS = ARCANE_ESSENCE.key;
const RING = 'ring:gold:ruby';   // 2,160 points: 21 Arcane Essence (prof12_service's ring)
const DF = 17;
const HUBS = { [DF]: [207, 212] };
const migration = () => readFileSync(new URL('../../server-account/migrations/0142_essence_loose.sql', import.meta.url), 'utf8');

async function stand() {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on' });
  const raw = s.env.DB._raw;
  const stores = (who, m = ESS) => raw.prepare('SELECT origin, qty FROM prof_stores WHERE player = ? AND char_id = ? AND material = ? AND qty > 0 ORDER BY origin')
    .all(who.id, who.character, m).map((r) => [r.origin, Number(r.qty)]);
  const add = (who, m, origin, qty) => raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = prof_stores.qty + excluded.qty`).run(who.id, who.character, m, origin, qty);
  const rank = (who, prof, r) => raw.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, updated_at) VALUES (?, ?, ?, ?, 1)
    ON CONFLICT (player, char_id, profession) DO UPDATE SET xp = excluded.xp`).run(who.id, who.character, prof, xpForRank(r));
  const product = (pv) => { const p = raw.prepare('SELECT owner, bought_with, loose FROM products WHERE provenance = ?').get(pv); return p ? { ...p } : null; };
  const ask = (who, path, body) => s.call(path, { character: who.character, rid: rid(), ...body }, who.secret);
  const seated = (handle, gold = 0) => s.seated(handle, { save: { name: handle, level: 5, items: [], goldPieces: gold } });
  /** THE PRODUCER OF LOOSE UNITS: a station's put-in (`work`) of units the carried count does not hold - what a book's
   *  ensureInStores sends of a looted, traded or shop-bought stack before a craft (and the Stores page's Put in of them). */
  const loose = async (who, m, n) => {
    const r = await ask(who, '/v1/stores/deposit', { material: m, qty: n, held: n, order: 'work' });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.loose, n, 'every unit loose');
  };
  /** A piece through the real craft route: its inputs the Stores' own, but `pack` of them put in from the pack first. */
  const craft = async (who, recipe, pack = {}) => {
    for (const { key, n } of recipeById(recipe).inputs) {
      if (n - (pack[key] ?? 0) > 0) add(who, key, 'own', n - (pack[key] ?? 0));
      if (pack[key]) await loose(who, key, pack[key]);
    }
    const r = await ask(who, '/v1/prof/craft', { recipe, clean: false, name: 'Mac' });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return r.body.pieces[0].provenance;
  };
  /** INT16: a disenchant is the seated character's, its piece out of its RECORD - the pack holds the piece it takes apart
   *  (laid there as the client's save after its craft or its purchase carries it; prof12_service's `packed`). */
  const disenchant = (who, pv) => {
    const p = raw.prepare('SELECT template, recipe FROM products WHERE provenance = ?').get(pv);
    const save = JSON.parse(new TextDecoder().decode(s.env.SAVES._map.get(raw.prepare('SELECT obj FROM realm_characters WHERE id = ?').get(who.character).obj)));
    if (!(save.items ?? []).some((it) => it?.provenance === pv)) layRecord(s.env, who.character, { ...save, items: [...(save.items ?? []), { templateIndex: Number(p.template), provenance: pv, recipe: p.recipe, name: p.recipe }] });
    return ask(who, '/v1/prof/disenchant', { provenance: pv, realm: who.at() });
  };
  const reforge = (who, tier) => ask(who, '/v1/prof/reforge', { tier });
  /** GOLD-MARKET: a piece listed for gold by its maker (out of its record - INT19) and bought by `buyer` off its record. */
  const soldForGold = async (seller, buyer, pv, price = 5000) => {
    holdPieces(s.env, seller.character, [{ provenance: pv }]);
    const l = await ask(seller, '/v1/market/list', { region: DF, kind: 'piece', provenance: pv, wear: 1000, price, hubs: HUBS, currency: 'gold' });
    assert.equal(l.status, 200, JSON.stringify(l.body));
    const b = await ask(buyer, '/v1/market/buy', { region: DF, listing: l.body.listing.id, units: 1, max: price, hubs: HUBS, realm: buyer.at() });
    assert.equal(b.status, 200, JSON.stringify(b.body));
  };
  return { ...s, raw, stores, add, rank, product, ask, seated, loose, craft, disenchant, reforge, soldForGold };
}

// ─── THE REPORT ──────────────────────────────────────────────────────

test('FB1020h ESSENCE-LOOSE the report: a Gold Ruby Ring made of a Gold Bar put in from the pack is walled to gold for the market (never Drakes) and says its goods walled it; taken apart, its 21 Arcane Essence go into the Stores LOOSE - never "bought with gold" - and the answer says so (mutants: the disenchant reads bought_with alone; the craft never marks the wall its goods\')', async () => {
  const s = await stand();
  const mac = await s.seated('Mac');
  s.rank(mac, 'smithing', 25);
  const ring = await s.craft(mac, RING, { 'metal:gold': 1 });
  const d = await s.disenchant(mac, ring);
  assert.equal(d.status, 200, JSON.stringify(d.body));
  assert.deepEqual([d.body.essence, d.body.origin, d.body.store], [21, 'loose', { material: ESS, own: 0, bought: 0, loose: 21 }], 'the field\'s Essence: never gold\'s');
  assert.deepEqual(s.stores(mac), [['loose', 21]], 'a station\'s Essence, not gold\'s');
  assert.equal(s.raw.prepare('SELECT origin FROM prof_disenchants WHERE provenance = ?').get(ring).origin, 'loose', 'its row says it, and a repeat answers it');
  // the piece itself: walled to gold for the market, as AUDIT BAG-CRAFT A1 walls it - and saying its goods walled it
  const another = await s.craft(mac, RING, { 'metal:gold': 1 });
  assert.deepEqual(s.product(another), { owner: mac.id, bought_with: 'gold', loose: 1 }, 'walled to gold by its goods, and saying so');
  s.raw.prepare('INSERT INTO marks (account, balance) VALUES (?, 1000)').run(mac.id);
  holdPieces(s.env, mac.character, [{ provenance: another }]);
  assert.deepEqual((await s.ask(mac, '/v1/market/list', { region: DF, kind: 'piece', provenance: another, wear: 1000, price: 50, hubs: HUBS, currency: 'marks' })).body,
    { error: 'market-gold-goods' }, 'AUDIT BAG-CRAFT A1\'s wall stands: never for Drakes');
  // the same ring made of the character's own goods: own Essence, as ever
  const own = await s.craft(mac, RING);
  assert.deepEqual(s.product(own), { owner: mac.id, bought_with: null, loose: 0 });
  assert.equal((await s.disenchant(mac, own)).body.origin, 'own');
  assert.equal((await s.disenchant(mac, another)).body.origin, 'loose');
  assert.deepEqual(s.stores(mac), [['loose', 42], ['own', 21]]);
});

test('FB1020h ESSENCE-LOOSE the Reforge with Essence is a station\'s spend: the loose Essence spent first, then bought, then own - never gold\'s; short of all but gold\'s it says so; a disenchant past the room the loose Essence fills says the Stores are full (mutants: the decision reads own and bought alone; the spend takes nothing; the refusal counts no loose; the room\'s word counts no loose)', async () => {
  const s = await stand();
  const mac = await s.seated('Mac');
  s.rank(mac, 'smithing', 25);
  s.rank(mac, 'enchanting', 50);
  await s.disenchant(mac, await s.craft(mac, RING, { 'gem:ruby': 1 }));
  assert.deepEqual(s.stores(mac), [['loose', 21]]);
  const r = await s.reforge(mac, 'rare');
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.essence, r.body.store], [5, { material: ESS, own: 0, bought: 0, loose: 16 }]);
  // the order: 1 loose, 3 bought, 2 own - a Rare's 5 takes the loose, the bought, then one own
  s.raw.prepare('DELETE FROM prof_stores WHERE player = ? AND material = ?').run(mac.id, ESS);
  s.add(mac, ESS, 'loose', 1); s.add(mac, ESS, 'bought', 3); s.add(mac, ESS, 'own', 2); s.add(mac, ESS, 'gold', 9);
  assert.equal((await s.reforge(mac, 'rare')).status, 200);
  assert.deepEqual(s.stores(mac), [['gold', 9], ['own', 1]], 'loose first, then bought, then own; gold\'s untouched');
  assert.deepEqual((await s.reforge(mac, 'magic')).body, { error: 'stores-gold' }, 'one own and nine gold\'s: short only of what gold walls');
  s.raw.prepare("UPDATE prof_stores SET qty = 1 WHERE player = ? AND material = ? AND origin = 'gold'").run(mac.id, ESS);
  s.add(mac, ESS, 'loose', 3);
  assert.deepEqual((await s.reforge(mac, 'rare')).body, { error: 'stores-gold' }, 'three loose, one own and one gold\'s: a Rare\'s 5 short only of what gold walls');
  s.raw.prepare("UPDATE prof_stores SET qty = 2 WHERE player = ? AND material = ? AND origin = 'loose'").run(mac.id, ESS);
  assert.deepEqual((await s.reforge(mac, 'rare')).body, { error: 'stores-short' }, 'two loose, one own and one gold\'s: short whatever gold walls');
  assert.deepEqual(s.stores(mac), [['gold', 1], ['loose', 2], ['own', 1]], 'nothing spent by a refusal');
  // the Stores' room: every origin fills the 5,000 - a ring's 21 past it is refused, and said so
  s.add(mac, ESS, 'loose', 4980);
  const full = await s.disenchant(mac, await s.craft(mac, RING));
  assert.deepEqual([full.status, full.body], [409, { error: 'stores-full' }], '4,984 held, every origin: no room for 21');
});

// ─── THE WALL STANDS ─────────────────────────────────────────────────

test('FB1020h ESSENCE-LOOSE a piece BOUGHT WITH GOLD still gives gold\'s Essence (Professions-Arc 10.8\'s wall, section 37\'s law) - one made of loose goods and then sold for gold too: the purchase walls it now, never its maker\'s goods; the Reforge takes none of it (mutants: the gold purchase leaves the loose mark)', async () => {
  const s = await stand();
  const ann = await s.seated('Ann');
  const tom = await s.seated('Tom', 100_000);
  s.rank(ann, 'smithing', 25);
  s.rank(tom, 'enchanting', 50);
  const walled = await s.craft(ann, RING, { 'metal:gold': 1 });
  const plain = await s.craft(ann, RING);
  assert.deepEqual([s.product(walled).loose, s.product(plain).loose], [1, 0]);
  await s.soldForGold(ann, tom, walled);
  await s.soldForGold(ann, tom, plain);
  assert.deepEqual([s.product(walled), s.product(plain)], [{ owner: tom.id, bought_with: 'gold', loose: 0 }, { owner: tom.id, bought_with: 'gold', loose: 0 }]);
  assert.equal((await s.disenchant(tom, walled)).body.origin, 'gold', 'bought with gold: gold\'s, whatever its maker made it of');
  assert.equal((await s.disenchant(tom, plain)).body.origin, 'gold');
  assert.deepEqual(s.stores(tom), [['gold', 42]]);
  assert.deepEqual((await s.reforge(tom, 'magic')).body, { error: 'stores-gold' }, 'no station takes gold\'s Essence');
});

test('FB1020h ESSENCE-LOOSE a temper with a loose ingot walls a made piece by its goods (its Essence loose); a piece bought with gold and tempered so stays gold\'s (mutants: the temper never marks it; the temper marks a gold-bought piece its goods\')', async () => {
  const s = await stand();
  const ann = await s.seated('Ann');
  const mac = await s.seated('Mac', 100_000);
  for (const who of [ann, mac]) s.rank(who, 'smithing', 0);
  const temper = async (who, pv) => {
    await s.loose(who, 'ingot:iron', 2);
    const q = Number(s.raw.prepare('SELECT quality FROM products WHERE provenance = ?').get(pv).quality);
    const t = await s.ask(who, '/v1/prof/temper', { recipe: 'longsword:iron', quality: q, provenance: pv });
    assert.equal(t.status, 200, JSON.stringify(t.body));
  };
  const mine = await s.craft(mac, 'longsword:iron');
  assert.deepEqual(s.product(mine), { owner: mac.id, bought_with: null, loose: 0 });
  await temper(mac, mine);
  assert.deepEqual(s.product(mine), { owner: mac.id, bought_with: 'gold', loose: 1 }, 'raised with goods the service never handed out');
  assert.deepEqual([(await s.disenchant(mac, mine)).body.origin, s.stores(mac)], ['loose', [['loose', 6]]]);
  const bought = await s.craft(ann, 'longsword:iron');
  await s.soldForGold(ann, mac, bought, 300);
  await temper(mac, bought);
  assert.deepEqual(s.product(bought), { owner: mac.id, bought_with: 'gold', loose: 0 }, 'bought with gold first - the purchase walls it');
  assert.deepEqual([(await s.disenchant(mac, bought)).body.origin, s.stores(mac)], ['gold', [['gold', 6], ['loose', 6]]]);
});

// ─── THE PAGE ────────────────────────────────────────────────────────

test('FB1020h ESSENCE-LOOSE the client: the book hears the loose Essence and the Stores page says it - "21 made from pack goods", the stations\' wall under it, never "bought with gold" nor "it can go to your pack"; the enchanting station\'s Reforge counts it and is pressed, the book\'s Stores moving with the answer; gold\'s Essence says it cannot go to the pack (mutants: the split says "from your pack"; the line says the pack; the Reforge counts no loose; the gold line says the pack)', async () => {
  const s = await stand();
  const mac = await s.seated('Mac');
  s.rank(mac, 'smithing', 25);
  s.rank(mac, 'enchanting', 50);
  const e = { stats: { strength: 50 }, items: [setItemFields({ group: 'UselessItems2', templateIndex: BAG_TEMPLATE })], bagItems: [], goldPieces: 0 };
  const hands = {
    held: (k) => heldOf(e, k), room: (k) => roomFor(e, k), mint: (k, n) => mintCarried(e, k, n),
    take: (k, n, id, order) => takeCarried(e, k, n, id, order), give: (k, n) => giveCarried(e, k, n),
    stamped: (id) => Object.hasOwn(bagTakesOf(e), id), unstamp: (id) => { delete e.bagTakes?.[id]; },
    stamps: () => Object.entries(bagTakesOf(e)).map(([id, t]) => ({ id, ...t })),
  };
  const mem = new Map();
  const book = createProfBook({ door: accountProf({ fetch: s.fetch, storage: sessionStorageOf(SESSION_KEY, mac) }), storage: { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)) },
    character: () => mac.character, sleep: () => Promise.resolve(), carry: hands });
  assert.equal((await book.refresh()).ok, true);
  // THE PLAYER'S WAY: a Gold Bar in the bag the service never handed out (looted, traded, bought at a counter) - the
  // station's own put-in moves it loose, and the ring is made of it
  mintCarried(e, 'metal:gold', 1);
  assert.deepEqual(await book.ensureInStores([{ key: 'metal:gold', n: 1 }], { work: true }), { ok: true, moved: 1 });
  s.add(mac, 'gem:ruby', 'own', 1);
  const c = await s.ask(mac, '/v1/prof/craft', { recipe: RING, clean: false, name: 'Mac' });
  assert.equal(c.status, 200, JSON.stringify(c.body));
  assert.equal((await s.disenchant(mac, c.body.pieces[0].provenance)).status, 200);
  assert.equal((await book.refresh({ force: true })).ok, true);
  assert.deepEqual(book.store(ESS), { material: ESS, own: 0, bought: 0, loose: 21 }, 'the book\'s mirror: loose');
  const P = await import('../../src/ui/professions/profPages.js');
  const magic = weaponOfMaterial(120, 1);
  applyRarity(magic, 'magic', seededRng(3));
  magic.isIdentified = true;
  const asked = [];
  const pack = [];   // the enchanting station's pieces: a crafted ring, as the anvil mints it (smithItems mintPiece)
  P.resetProfPages();
  P.setProfessionsPages({ book, name: (k) => (k === ESS ? 'Arcane Essence' : k), withdraw: async () => ({ ok: true, text: '' }), inTown: () => true,
    carriedHeld: (k) => heldOf(e, k), room: (k) => roomFor(e, k), bag: () => ({ has: true, kg: 0, max: 300, count: e.bagItems.length }),
    enchanter: () => ({ kind: 'home', fee: 0 }), disenchant: async () => ({ ok: true, text: '' }), disenchantable: () => P.disenchantableOf(pack, { book }),
    reforgeable: () => [{ item: magic, name: 'Magic Longsword', tier: 'magic', lines: [{ index: 0, text: 'the line' }] }],
    essenceReforge: async (offer) => { const r = await book.reforge(offer.tier); asked.push(r?.ok); return { ok: !!r?.ok, text: r?.ok ? 'Reforged.' : String(r?.error) }; },
  });
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const kit = { el, divider: (word) => el('h3', null, word), meter: () => el('div') };
  let root = null;
  const draw = () => { root?.remove?.(); root = el('div'); document.body.append(root); P.drawStoresPage(root, draw, kit); };
  try {
    draw();
    const card = [...root.querySelectorAll('button')].find((b) => b.className.includes('prof-mat') && b.textContent.includes('Arcane Essence'));
    assert.ok(card, 'the Essence has its card');
    assert.ok(card.textContent.includes('21 made from pack goods'), `its split: ${card.textContent}`);
    assert.ok(!card.textContent.includes('bought with gold') && !card.textContent.includes('from your pack'), card.textContent);
    card.onclick();
    assert.ok(root.textContent.includes(P.LOOSE_MADE_LINE), 'the stations\' wall said, plainly');
    for (const wrong of [P.GOLD_GOODS_LINE, P.GOLD_STAYS_LINE, P.LOOSE_GOODS_LINE]) assert.ok(!root.textContent.includes(wrong), wrong);
    assert.ok(!root.textContent.includes('Needs 2 Arcane Essence'), 'the Reforge counts the loose Essence');
    const press = [...root.querySelectorAll('button')].find((b) => b.textContent === 'Reforge: the line');
    assert.equal(press.disabled, false, 'pressed');
    await press.onclick();
    assert.deepEqual(asked, [true]);
    assert.deepEqual(book.store(ESS), { material: ESS, own: 0, bought: 0, loose: 19 }, 'the book\'s Stores moved with the answer');
    // gold's Essence (a piece bought with gold): its line says the market, never the pack - Essence has no pack form
    s.add(mac, ESS, 'gold', 4);
    assert.equal((await book.refresh({ force: true })).ok, true);
    draw();
    const gold = [...root.querySelectorAll('button')].find((b) => b.className.includes('prof-mat') && b.textContent.includes('Arcane Essence'));
    assert.ok(gold.textContent.includes('4 bought with gold'), gold.textContent);
    gold.onclick();
    assert.ok(root.textContent.includes(P.GOLD_STAYS_LINE) && !root.textContent.includes(P.GOLD_GOODS_LINE), 'no pack offered');
    // the station's room: every origin fills the 5,000 - with 4,983 held (4,979 of them loose), a ring's 21 has no room
    s.add(mac, ESS, 'loose', 4960);
    pack.push(mintPiece({ recipe: RING, quality: 1, seed: 7, maker: 'Mac' }, 'a1b2c3d4e5f60718'));
    assert.equal((await book.refresh({ force: true })).ok, true);
    draw();
    assert.ok(root.textContent.includes(P.ENCHANT_FULL_LINE(17)), 'the room the loose Essence leaves, said');
    assert.equal([...root.querySelectorAll('button')].find((b) => b.textContent === 'Disenchant').disabled, true, 'never pressed past the room');
    // a material with a pack form keeps its words
    assert.deepEqual([P.storesSplit({ material: 'metal:iron', own: 0, bought: 0, loose: 3 }), P.storesSplit({ material: ESS, own: 1, bought: 0, loose: 3 })],
      ['3 from your pack', '1 own · 3 made from pack goods']);
  } finally { P.setProfessionsPages(null); P.resetProfPages(); root?.remove(); }
});

// ─── THE MIGRATION ───────────────────────────────────────────────────

test('FB1020h ESSENCE-LOOSE migration 0142 over the rows the old service wrote: a piece walled by its goods marked so and a gold-bought one not; a disenchant already made of a walled piece named loose, a gold-bought one\'s gold; the misnamed Essence moved to loose as far as the Stores still hold gold\'s, the rest of gold\'s kept; another character untouched (mutants: the pieces unmarked; a disenchant left gold; the Essence left gold; more moved than held)', async () => {
  const s = await stand();
  const ann = await s.seated('Ann');
  const mac = await s.seated('Mac', 100_000);
  const eve = await s.seated('Eve');
  for (const who of [ann, mac, eve]) s.rank(who, 'smithing', 25);
  // the live database's rows, minted by the real routes: Mac's ring of a loose Gold Bar (taken apart, and one standing),
  // a ring Mac bought with gold (taken apart), and Eve's ring of a loose Gold Bar taken apart, 15 of its Essence since
  // sold for gold (gold's Essence leaves the Stores by a gold listing alone)
  const macWalled = await s.craft(mac, RING, { 'metal:gold': 1 });
  const macStanding = await s.craft(mac, RING, { 'metal:gold': 1 });
  const annRing = await s.craft(ann, RING);
  await s.soldForGold(ann, mac, annRing);
  const annKept = await s.craft(ann, RING, { 'metal:gold': 1 });   // walled by Ann's goods, then bought by Mac with gold: kept
  await s.soldForGold(ann, mac, annKept);
  await s.disenchant(mac, macWalled);
  await s.disenchant(mac, annRing);
  const eveWalled = await s.craft(eve, RING, { 'metal:gold': 1 });
  await s.disenchant(eve, eveWalled);
  // ...as the service before acct166 wrote them: no `loose` column, a disenchant's origin gold, its Essence gold's
  const raw = s.raw;
  raw.exec(`ALTER TABLE products DROP COLUMN loose;
    CREATE TABLE prof_disenchants_old AS SELECT * FROM prof_disenchants; DROP TABLE prof_disenchants;
    CREATE TABLE prof_disenchants (player TEXT NOT NULL, rid TEXT NOT NULL, char_id TEXT NOT NULL, provenance TEXT NOT NULL UNIQUE CHECK (length(provenance) = 16),
      recipe TEXT NOT NULL, points INTEGER NOT NULL CHECK (points >= 0), essence INTEGER NOT NULL CHECK (essence >= 1),
      origin TEXT NOT NULL CHECK (origin IN ('own', 'bought', 'gold')), xp INTEGER NOT NULL CHECK (xp >= 0), at INTEGER NOT NULL, n TEXT NOT NULL,
      PRIMARY KEY (player, rid), FOREIGN KEY (player) REFERENCES players(id) ON DELETE CASCADE);
    INSERT INTO prof_disenchants SELECT player, rid, char_id, provenance, recipe, points, essence, CASE origin WHEN 'loose' THEN 'gold' ELSE origin END, xp, at, n FROM prof_disenchants_old;
    DROP TABLE prof_disenchants_old;
    DELETE FROM prof_stores WHERE material = '${ESS}';`);
  raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, '${ESS}', 'gold', 42), (?, ?, '${ESS}', 'gold', 6), (?, ?, '${ESS}', 'own', 3)`)
    .run(mac.id, mac.character, eve.id, eve.character, eve.id, eve.character);
  raw.exec(migration());   // as the deploy applies it, once
  assert.deepEqual([s.product(macStanding), s.product(annKept), s.product(annRing), s.product(eveWalled)],
    [{ owner: mac.id, bought_with: 'gold', loose: 1 }, { owner: mac.id, bought_with: 'gold', loose: 0 }, null, null], 'the standing walled ring marked, the one bought with gold not; the others taken apart');
  const origins = Object.fromEntries(raw.prepare('SELECT provenance, origin FROM prof_disenchants').all().map((r) => [r.provenance, r.origin]));
  assert.deepEqual([origins[macWalled], origins[annRing], origins[eveWalled]], ['loose', 'gold', 'loose']);
  assert.deepEqual(s.stores(mac), [['gold', 21], ['loose', 21]], 'Mac: the walled ring\'s 21 loose, the bought ring\'s 21 gold\'s');
  assert.deepEqual(s.stores(eve), [['loose', 6], ['own', 3]], 'Eve: 21 misnamed, 6 still held - those move, and nothing more');
  assert.deepEqual(s.stores(ann), []);
  // and the service reads what it wrote: Mac's loose Essence reforges, the gold's stays walled
  s.rank(mac, 'enchanting', 50);
  assert.equal((await s.reforge(mac, 'rare')).status, 200);
  assert.deepEqual(s.stores(mac), [['gold', 21], ['loose', 16]]);
  assert.equal((await s.disenchant(mac, macStanding)).body.origin, 'loose', 'the standing ring, once taken apart, loose');
});
