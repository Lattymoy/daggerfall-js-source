// PROF10 (2026-10-02) - JEWELCRAFTING AS THE SERVICE KEEPS IT: a piece of jewellery on the craft route (/v1/prof/craft) -
// its metal and its gem out of the Stores (bought first), a quality rolled on the margin and a clean facet's step, a piece
// with its signed record, Jewelcrafting's XP (20 x the piece's tier, the first time's 500), its rank asked; the jeweller's
// hand at 50 (a Goldsmith's Silver, a Gemcutter's gem) signed into the record (`f`) and kept on the piece (0069's
// `products.hand`) and answered; a Lapidary's Siege-cracked Gem set as the piece's gem, and refused to all others
// (`prof-lapidary`); a Master Jeweller's Masterwork points; the market's Crafted view among the Jewellery with the hand.
// Driven through the real Worker over node:sqlite with every migration applied (test/accountDb.mjs).
// bible/06-Systems/Professions-Arc.md 3.3, 9.2, 9.3, 36.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService, T0 } from './accountDb.mjs';
import { xpForRank, PROF_XP_MAX } from '../src/net/professionLaw.js';
import { FIRST_CRAFT_XP, recipeById } from '../src/net/recipeLaw.js';
import { readProductRecord, verifyProductRecord } from '../src/net/productRecord.js';
import { ACCOUNT_VERSION } from '../server-account/src/service.js';

let _now = T0;
const realNow = Date.now;
const clock = (s) => { _now = s; Date.now = () => _now * 1000; };
test.after(() => { Date.now = realNow; });
clock(T0);
let _rid = 0;
const rid = () => `jewel-${String(++_rid).padStart(6, '0')}`;
const DF = 17;
const HUBS = { [DF]: [207, 212], 23: [590, 166] };
const realRandom = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
/** The service's dice steered: every four-byte draw (a unit's - professions.js dice) all `b` while `fn` runs. */
async function steered(b, fn) {
  globalThis.crypto.getRandomValues = (arr) => (arr.byteLength === 4 ? (new Uint8Array(arr.buffer, arr.byteOffset, 4).fill(b), arr) : realRandom(arr));
  try { return await fn(); } finally { globalThis.crypto.getRandomValues = realRandom; }
}

async function stand(extra = {}) {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on', ...extra });
  const raw = s.env.DB._raw;
  const stores = (who, m) => raw.prepare('SELECT origin, qty FROM prof_stores WHERE player = ? AND char_id = ? AND material = ? ORDER BY origin').all(who.id, who.character, m).map((r) => [r.origin, Number(r.qty)]);
  const give = (who, m, origin, qty) => raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = excluded.qty`).run(who.id, who.character, m, origin, qty);
  /** `times` of a recipe's inputs ADDED to what the Stores hold. */
  const stock = (who, recipe, times = 1, origin = 'own') => {
    for (const { key, n } of recipeById(recipe).inputs) raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = prof_stores.qty + excluded.qty`).run(who.id, who.character, key, origin, n * times);
  };
  const xpOf = (who) => Number(raw.prepare('SELECT xp FROM prof_tracks WHERE player = ? AND char_id = ? AND profession = ?').get(who.id, who.character, 'jewelcrafting')?.xp ?? 0);
  const setXp = (who, xp, { spec50 = null, spec100 = null } = {}) => raw.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, spec50, spec100, updated_at) VALUES (?, ?, 'jewelcrafting', ?, ?, ?, ?)
    ON CONFLICT (player, char_id, profession) DO UPDATE SET xp = excluded.xp, spec50 = excluded.spec50, spec100 = excluded.spec100`)
    .run(who.id, who.character, xp, spec50, spec100, _now);
  const cut = (who, recipe, extra2 = {}) => s.call('/v1/prof/craft', { character: who.character, recipe, clean: false, name: 'Silverthorn', rid: rid(), ...extra2 }, who.secret);
  const product = (p) => raw.prepare('SELECT * FROM products WHERE provenance = ?').get(p);
  const fund = (who, marks) => raw.prepare('INSERT INTO marks (account, balance) VALUES (?, ?) ON CONFLICT (account) DO UPDATE SET balance = excluded.balance').run(who.id, marks);
  return { ...s, raw, stores, give, stock, xpOf, setXp, cut, product, fund };
}

// ─── A PIECE (9.3) ───────────────────────────────────────────────────

test('PROF10 service: a Silver Ruby Ring at the jeweller\'s bench - its Silver and its Ruby out of the Stores (bought first), one piece of DFU\'s Ring with its signed record, a quality, its maker; Jewelcrafting XP 20 at rank 0 and the first time\'s 500, credited; asked twice one, nothing moved; the next no 500; the Ruby gone, short', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.stock(mac, 'ring:silver:ruby', 2);
  s.give(mac, 'metal:silver', 'bought', 1);
  const ask = { character: mac.character, recipe: 'ring:silver:ruby', clean: false, name: 'Silverthorn', rid: rid() };
  const r = await steered(0x80, () => s.call('/v1/prof/craft', ask, mac.secret));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.recipe, r.body.quality, r.body.count, r.body.maker, r.body.marked, r.body.first, r.body.xp, r.body.hand], ['ring:silver:ruby', 1, 1, 'Silverthorn', false, true, 20 + FIRST_CRAFT_XP, null], 'margin 0 at the middle: Standard');
  assert.deepEqual([r.body.track.profession, r.body.track.xp], ['jewelcrafting', 520]);
  const p = r.body.pieces[0];
  const v = await verifyProductRecord(p.record, s.identityPublic, { subtle: globalThis.crypto.subtle });
  assert.deepEqual([v.ok, v.claims?.r, v.claims?.q, v.claims?.m, v.claims?.f], [true, 'ring:silver:ruby', 1, 'Silverthorn', undefined], 'signed; no hand');
  const row = s.product(p.provenance);
  assert.deepEqual([row.owner, row.char_id, row.recipe, row.template, row.material, row.quality, row.hand], [mac.id, mac.character, 'ring:silver:ruby', 135, 0, 1, null]);
  assert.deepEqual([s.stores(mac, 'metal:silver'), s.stores(mac, 'gem:ruby')], [[['own', 2]], [['own', 1]]], 'the bought Silver spent first');
  assert.deepEqual(r.body.stores.map((st) => st.material).sort(), ['gem:ruby', 'gem:siege', 'metal:silver'], 'what it spent, and the Siege-cracked Gems a Lapidary\'s could have');
  const again = await s.call('/v1/prof/craft', ask, mac.secret);
  assert.deepEqual([again.body.repeat, again.body.xp, again.body.pieces[0].provenance], [true, 520, p.provenance], 'asked twice: the row\'s answer');
  assert.deepEqual([s.stores(mac, 'gem:ruby'), s.xpOf(mac)], [[['own', 1]], 520], 'nothing moved twice');
  const second = await s.cut(mac, 'ring:silver:ruby');
  assert.deepEqual([second.status, second.body.first, second.body.xp], [200, false, 20], 'the second: no 500');
  assert.deepEqual((await s.cut(mac, 'ring:silver:ruby')).body, { error: 'stores-short' });
  assert.deepEqual((await s.cut(mac, 'ring:silver:emerald')).body, { error: 'stores-short' }, 'every gem its own');
  assert.equal(s.xpOf(mac), 540);
  assert.match(ACCOUNT_VERSION, /^acct72$/   /* PIN MOVED (PROF12, AUDIT PROF-541, SILVER-WAYS' acct71, the arena merge's acct72): the live version */);
});

test('AUDIT PROF-541 J7 service: the first time\'s 500 once a piece and base - a Silver Ruby Ring\'s, then a Silver Emerald Ring and a plain Silver Ring none; a Silver Mark and a Gold Ruby Ring each their own', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.setXp(mac, xpForRank(25));
  for (const r of ['ring:silver:ruby', 'ring:silver:emerald', 'ring:silver', 'mark:silver:ruby', 'ring:gold:ruby']) s.stock(mac, r);
  const firsts = [];
  for (const r of ['ring:silver:ruby', 'ring:silver:emerald', 'ring:silver', 'mark:silver:ruby', 'ring:gold:ruby']) {
    const a = await s.cut(mac, r);
    assert.equal(a.status, 200, JSON.stringify(a.body));
    firsts.push(a.body.first);
  }
  assert.deepEqual(firsts, [true, false, false, true, true]);
});

test('PROF10 service: the jeweller\'s ladder asked - Gold at 25, Platinum at 55, the Wand at 70 (refused below, nothing spent); the quality on the margin with a clean facet\'s step; a Wand\'s Heartwood its step; a Master\'s full track credits none', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.stock(mac, 'ring:gold');
  const below = await s.cut(mac, 'ring:gold');
  assert.deepEqual([below.status, below.body], [403, { error: 'prof-rank' }]);
  assert.deepEqual([s.stores(mac, 'metal:gold'), s.raw.prepare('SELECT COUNT(*) AS n FROM prof_crafts').get().n], [[['own', 1]], 0], 'refused before anything moved');
  s.setXp(mac, xpForRank(25));
  const gold = await steered(0x00, () => s.cut(mac, 'ring:gold', { clean: true }));
  assert.deepEqual([gold.status, gold.body.quality, gold.body.xp], [200, 1, 60 + FIRST_CRAFT_XP], 'margin 0\'s bottom (Crude) and a clean facet\'s step: Standard; tier 3\'s 60');
  s.stock(mac, 'torc:platinum');
  s.setXp(mac, xpForRank(54));
  assert.deepEqual((await s.cut(mac, 'torc:platinum')).body, { error: 'prof-rank' });
  s.setXp(mac, xpForRank(55));
  assert.equal((await s.cut(mac, 'torc:platinum')).body.xp, 100 + FIRST_CRAFT_XP);
  s.stock(mac, 'wand:ironwood:jade');
  s.give(mac, 'wood:heartwood', 'own', 1);
  s.setXp(mac, xpForRank(69));
  assert.deepEqual((await s.cut(mac, 'wand:ironwood:jade')).body, { error: 'prof-rank' });
  s.setXp(mac, xpForRank(70));
  const wand = await steered(0x00, () => s.cut(mac, 'wand:ironwood:jade', { heartwood: true }));
  assert.deepEqual([wand.status, wand.body.quality, wand.body.heartwood], [200, 1, true], 'margin 0\'s Crude and the Heartwood\'s step');
  assert.deepEqual([s.stores(mac, 'plank:ironwood'), s.stores(mac, 'wood:heartwood'), s.stores(mac, 'gem:jade')], [[['own', 1]], [], []]);
  s.setXp(mac, PROF_XP_MAX);
  s.stock(mac, 'bracelet:silver');
  const full = await s.cut(mac, 'bracelet:silver');
  assert.deepEqual([full.status, full.body.xp, s.xpOf(mac)], [200, 0, PROF_XP_MAX]);
});

// ─── THE CHOICES (3.3) ───────────────────────────────────────────────

test('PROF10 service: the jeweller\'s hand at 50 - a Goldsmith\'s Silver piece carries hand 1 (record and piece), a Goldsmith\'s Gold none; a Gemcutter\'s gemmed piece hand 2, a Gemcutter\'s plain piece none; answered on a repeat', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.setXp(mac, xpForRank(50), { spec50: 'goldsmith' });
  s.stock(mac, 'ring:silver');
  s.stock(mac, 'ring:gold');
  const silver = await s.cut(mac, 'ring:silver');
  assert.equal(silver.status, 200, JSON.stringify(silver.body));
  assert.deepEqual([silver.body.hand, readProductRecord(silver.body.pieces[0].record).f, s.product(silver.body.pieces[0].provenance).hand], [1, 1, 1]);
  const gold = await s.cut(mac, 'ring:gold');
  assert.deepEqual([gold.body.hand, readProductRecord(gold.body.pieces[0].record).f, s.product(gold.body.pieces[0].provenance).hand], [null, undefined, null]);
  s.setXp(mac, xpForRank(50), { spec50: 'gemcutter' });
  s.stock(mac, 'amulet:gold:pearl');
  s.stock(mac, 'torc:gold');
  const ask = { character: mac.character, recipe: 'amulet:gold:pearl', clean: false, name: 'Silverthorn', rid: rid() };
  const pearl = await s.call('/v1/prof/craft', ask, mac.secret);
  assert.deepEqual([pearl.body.hand, readProductRecord(pearl.body.pieces[0].record).f, s.product(pearl.body.pieces[0].provenance).hand], [2, 2, 2]);
  assert.deepEqual([(await s.call('/v1/prof/craft', ask, mac.secret)).body.hand], [2], 'the row\'s piece answers its hand again');
  const torc = await s.cut(mac, 'torc:gold');
  assert.deepEqual([torc.body.hand, s.product(torc.body.pieces[0].provenance).hand], [null, null]);
});

test('PROF10 service: a Lapidary\'s Siege-cracked Gem set as the piece\'s gem - the cracked one spent, the gem kept, the piece the recipe\'s; refused to all but a Lapidary and in a piece that sets no gem (403, nothing spent); short of cracked gems, short', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.give(mac, 'metal:gold', 'own', 5);
  s.give(mac, 'gem:diamond', 'own', 1);
  s.give(mac, 'gem:siege', 'own', 1);
  s.setXp(mac, xpForRank(100), { spec100: 'master-jeweller' });
  const not = await s.cut(mac, 'ring:gold:diamond', { cracked: true });
  assert.deepEqual([not.status, not.body], [403, { error: 'prof-lapidary' }]);
  s.setXp(mac, xpForRank(100), { spec100: 'lapidary' });
  const plain = await s.cut(mac, 'ring:gold', { cracked: true });
  assert.deepEqual([plain.status, plain.body], [403, { error: 'prof-lapidary' }], 'a plain ring sets no gem');
  assert.deepEqual([s.stores(mac, 'metal:gold'), s.stores(mac, 'gem:siege'), s.raw.prepare('SELECT COUNT(*) AS n FROM prof_crafts').get().n], [[['own', 5]], [['own', 1]], 0], 'nothing spent');
  const r = await s.cut(mac, 'ring:gold:diamond', { cracked: true });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.recipe, readProductRecord(r.body.pieces[0].record).r, s.product(r.body.pieces[0].provenance).recipe], ['ring:gold:diamond', 'ring:gold:diamond', 'ring:gold:diamond'], 'a Diamond Ring');
  assert.deepEqual([s.stores(mac, 'gem:siege'), s.stores(mac, 'gem:diamond'), s.stores(mac, 'metal:gold')], [[], [['own', 1]], [['own', 4]]], 'the cracked gem spent, the Diamond kept');
  assert.deepEqual(r.body.stores.find((st) => st.material === 'gem:siege'), { material: 'gem:siege', own: 0, bought: 0 }, 'the cracked gem\'s Stores answered');
  assert.deepEqual((await s.cut(mac, 'ring:gold:diamond', { cracked: true })).body, { error: 'stores-short' }, 'no cracked gem left');
  assert.equal((await s.cut(mac, 'ring:gold:diamond', { cracked: 'yes' })).status, 200, 'only a cracked gem asked as true: the Diamond spent');
  assert.deepEqual(s.stores(mac, 'gem:diamond'), []);
});

test('PROF10 service: a Master Jeweller\'s Masterwork points (3.3: "+5%") - the roll at 90 of 100 a Masterwork, a Lapidary\'s the same roll Superior; a Masterwork carries the maker\'s mark', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.stock(mac, 'ring:silver', 2);
  s.setXp(mac, xpForRank(100), { spec100: 'lapidary' });
  const plain = await steered(0xe6, () => s.cut(mac, 'ring:silver'));
  assert.deepEqual([plain.body.quality, plain.body.marked], [3, false], 'margin 100: Fine 40, Superior 52 - at 90, Superior');
  s.setXp(mac, xpForRank(100), { spec100: 'master-jeweller' });
  const mj = await steered(0xe6, () => s.cut(mac, 'ring:silver'));
  assert.deepEqual([mj.body.quality, mj.body.marked, readProductRecord(mj.body.pieces[0].record).a], [4, true, 1], 'a Master Jeweller\'s: Fine 35, Superior 52, Masterwork 13 - at 90, a Masterwork, marked');
});

test('PROF10 service: a Gemcutter\'s piece lists on the market among the Jewellery and is read with its hand - the Crafted view filtered and the lister\'s own', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.setXp(mac, xpForRank(50), { spec50: 'gemcutter' });
  s.stock(mac, 'mark:silver:amber');
  const made = await s.cut(mac, 'mark:silver:amber');
  const provenance = made.body.pieces[0].provenance;
  s.fund(mac, 100);
  const l = await s.call('/v1/market/list', { character: mac.character, region: DF, kind: 'piece', provenance, wear: 1000, price: 25, hubs: HUBS, rid: rid() }, mac.secret);
  assert.equal(l.status, 200, JSON.stringify(l.body));
  const mine = await s.call('/v1/market/read', { character: mac.character, region: DF, view: 'mine', hubs: HUBS }, mac.secret);
  const row = mine.body.rows.find((x) => x.piece?.provenance === provenance);
  assert.deepEqual([row?.piece?.recipe, row?.piece?.hand, row?.piece?.template], ['mark:silver:amber', 2, 137]);
  const crafted = await s.call('/v1/market/read', { character: mac.character, region: DF, view: 'crafted', family: 'jewellery', hubs: HUBS }, mac.secret);
  assert.equal(crafted.status, 200, JSON.stringify(crafted.body));
  assert.equal(crafted.body.rows.find((x) => x.piece?.provenance === provenance)?.piece?.hand, 2);
  const weapons = await s.call('/v1/market/read', { character: mac.character, region: DF, view: 'crafted', family: 'weapons', hubs: HUBS }, mac.secret);
  assert.equal(weapons.body.rows.some((x) => x.piece?.provenance === provenance), false, 'among the Jewellery alone');
});
