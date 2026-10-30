// AURUM (2026-10-29, the owner: "Implement a currency that can be earned ingame and through the past + purchased to be
// used to purchase a selection of rotating items daily"; bible/06-Systems/Aurum.md). The service's half, on the real
// Worker over node:sqlite: the balance counted at every ask (the paid packs and the ledger's lines), the week's deeds
// struck by the receipts' own rows, the day's wares bought in one batch, and every refusal.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { standService } from '../accountDb.mjs';
import { SHOP_WARES, shopHeldIds, shopWareById } from '../../src/net/shopLaw.js';
import { AURUM_DEEDS, AURUM_DAILY, aurumDailyOf, aurumWeekOf } from '../../src/net/aurumLaw.js';
import { buyWare } from '../../server-account/src/aurum.js';   // PIN MOVED (AURUM-ONLY): buyDaily was the daily wares' alone
import { utcDay } from '../../src/net/marksLaw.js';

const NOW = Date.UTC(2026, 10, 18, 12);   // a Wednesday in Season One
const ON = { SHOP_ON_SALE: SHOP_WARES.filter((w) => w.alone).map((w) => w.id).join(','), PASS_OPEN: 'on', AURUM_OPEN: 'on' };
const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

async function stand(env = ON) {
  const s = await standService(env);
  const raw = s.env.DB._raw;
  const ask = (who, path, body) => s.fetch(`https://accounts.invalid${path}`, body === undefined
    ? { headers: { authorization: `Bearer ${who.secret}` } }
    : { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${who.secret}` }, body: JSON.stringify(body) })
    .then(async (r) => ({ status: r.status, body: await r.json() }));
  const card = async (who) => (await ask(who, '/v1/account')).body.aurum;
  const buy = (who, ware, price) => ask(who, '/v1/aurum/buy', { ware, ...(price === undefined ? {} : { price }) });
  const pack = (who, id, aurum, status = 'paid') => raw.prepare("INSERT INTO shop_orders (id, player, ware, cents, currency, status, created_at, expires_at, aurum) VALUES (?, ?, ?, 1, 'usd', ?, ?, ?, ?)")
    .run(`${who.id}${id}`.replace(/[^0-9a-z]/gi, '').slice(-20).padStart(24, '0'), who.id, id, status, NOW / 1000, NOW / 1000 + 60, aurum);
  const lines = (who) => raw.prepare('SELECT kind, ref, amount FROM aurum_ledger WHERE account = ? ORDER BY kind, ref').all(who.id).map((l) => ({ ...l }));
  return { ...s, raw, ask, card, buy, pack, lines };
}
const today = () => aurumDailyOf(utcDay(NOW / 1000), () => true);

test('AURUM the card: a guest has none; a registered account reads it open, its balance, the day\'s wares in slot order with what it holds, the week\'s deeds and when each turns (mutants: a guest given a card; the day\'s wares not the law\'s)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: NOW });
  const s = await stand();
  const g = await s.guest();
  assert.equal((await s.ask(g, '/v1/account')).body.aurum, null, 'a guest: no card');
  const me = await s.registered('Holder');
  const c = await s.card(me);
  assert.equal(c.open, true);
  assert.equal(c.balance, 0);
  assert.deepEqual(c.daily.wares.map((w) => w.id), today());
  assert.deepEqual(c.daily.wares.map((w) => AURUM_DAILY.find((d) => d.id === w.id).slot), ['effect', 'effect', 'name', 'icon', 'icon']);
  assert.ok(c.daily.wares.every((w) => w.held === false));
  assert.equal(c.daily.until, (utcDay(NOW / 1000) + 1) * 86_400_000, 'the next midnight, UTC');
  assert.deepEqual(c.week.deeds, {}, 'no deed struck yet');
  assert.equal(new Date(c.week.until).getUTCDay(), 1, 'a week turns on a Monday');
  const off = await stand({ ...ON, AURUM_OPEN: 'off' });
  const shut = await off.registered('Shut');
  assert.equal((await off.card(shut)).open, false, 'off: the card says so');
});

test('AURUM the week\'s deeds: each witnessed receipt strikes its kind\'s Aurum once a week - a gate closed by a rite and a Redoubt the week did not pay strike none - and the next week again; the migration\'s amounts are the law\'s (mutants: a second gate paid in the week; a rite paid; a trigger\'s amount drifting from AURUM_DEEDS)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: NOW });
  const s = await stand();
  const me = await s.registered('Deedful');
  const at = NOW / 1000, wk = aurumWeekOf(at);
  s.raw.prepare("INSERT INTO gate_kills (day, account, boss, earned, at) VALUES (1, ?, 'b', 'rite', ?)").run(me.id, at);
  assert.equal((await s.card(me)).balance, 0, 'a rite is no fight');
  s.raw.prepare("INSERT INTO gate_kills (day, account, boss, earned, at) VALUES (2, ?, 'b', 'x', ?)").run(me.id, at);
  s.raw.prepare("INSERT INTO gate_kills (day, account, boss, earned, at) VALUES (3, ?, 'b', 'x', ?)").run(me.id, at + 60);
  s.raw.prepare("INSERT INTO eg_redoubts (b, account, w, h, t, at, paid) VALUES ('b1', ?, 1, 0, 0, ?, 0)").run(me.id, at);
  s.raw.prepare("INSERT INTO eg_redoubts (b, account, w, h, t, at, paid) VALUES ('b1', ?, 2, 0, 0, ?, 1)").run(me.id, at);
  s.raw.prepare("INSERT INTO serpent_kills (day, account, boss, hull, char_id, xp, nonce, at) VALUES (1, ?, 's', 0, 'c', 0, 'n', ?)").run(me.id, at);
  s.raw.prepare("INSERT INTO stars_held (star, account, day, char_id, xp, nonce, at) VALUES ('st', ?, 1, 'c', 0, 'n', ?)").run(me.id, at);
  s.raw.prepare("INSERT INTO raid_cleanses (raid, account, day, party, char_id, xp, nonce, at) VALUES ('r', ?, 1, 1, 'c', 0, 'n', ?)").run(me.id, at);
  const c = await s.card(me);
  assert.deepEqual(c.week.deeds, { ...AURUM_DEEDS });
  assert.equal(c.balance, Object.values(AURUM_DEEDS).reduce((a, n) => a + n, 0), 'each kind once');
  assert.deepEqual(s.lines(me).map((l) => l.ref), Object.keys(AURUM_DEEDS).map((k) => `${k}:${wk}`).sort());
  s.raw.prepare("INSERT INTO gate_kills (day, account, boss, earned, at) VALUES (9, ?, 'b', 'x', ?)").run(me.id, at + 7 * 86_400);
  assert.equal(s.lines(me).filter((l) => l.ref.startsWith('gate:')).length, 2, 'the next week, again');
  // the migration's amounts, each its kind's in the law
  const sql = rd('server-account/migrations/0201_storefront.sql');
  for (const [k, n] of Object.entries(AURUM_DEEDS)) assert.match(sql, new RegExp(`'deed', '${k}:' \\|\\| \\(\\(NEW\\.at / 86400 \\+ 3\\) / 7\\), ${n},`), k);
});

test('AURUM the balance: the paid packs and every ledger line - a find\'s day, a challenge, a cache, a deed - less what the daily wares and the pass took; a pack not paid counts nothing, and nothing is stored (mutants: a line\'s kind left out of the sum; an unpaid pack counted)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: NOW });
  const s = await stand();
  const me = await s.registered('Counter');
  assert.equal((await s.card(me)).balance, 0);
  s.pack(me, 'aurum:500', 500);
  s.pack(me, 'aurum:1100', 1100, 'refunded');
  const line = s.raw.prepare('INSERT INTO aurum_ledger (account, kind, ref, amount, day, at) VALUES (?, ?, ?, ?, 0, 0)');
  for (const [kind, ref, amount] of [['find', '20410', 80], ['challenge', 's1:tremor-gather', 60], ['cache', 'c1', 25], ['deed', `gate:${aurumWeekOf(NOW / 1000)}`, 30], ['buy', 'icon:aurbis', -400], ['track', 's1:premium', -1000], ['panel', 's1:glyph:cog', -200]]) line.run(me.id, kind, ref, amount);
  assert.equal((await s.card(me)).balance, 500 + 80 + 60 + 25 + 30 - 400 - 1000 - 200);
  assert.deepEqual(Object.keys(s.raw.prepare('SELECT * FROM players WHERE id = ?').get(me.id)).filter((k) => /aurum|balance/.test(k)), [], 'no balance on the row');
});

test('AURUM a ware bought (PIN MOVED, AURUM-ONLY: any ware but a pack, a deal at its deal price, any other at its own): one batch spends its price and puts it on the account; then held; a ware not on sale, a price the page showed that moved, an unknown one, a pack, a short balance, a guest and a closed shop each refused - nothing spent (mutants: the price never spent; the ware never given; a ware off the day sold)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: NOW });
  const s = await stand();
  const me = await s.registered('Spender');
  s.pack(me, 'aurum:2400', 2400);
  const [first] = today();
  const price = AURUM_DAILY.find((d) => d.id === first).aurum;
  const r = await s.buy(me, first);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.ok, true);
  assert.equal(r.body.spent, price);
  assert.equal(r.body.aurum.balance, 2400 - price);
  assert.ok(r.body.aurum.daily.wares.find((w) => w.id === first).held, 'the card says it is held');
  const [slot, key] = first.split(':');
  assert.ok((slot === 'title' ? r.body.titles : slot === 'icon' ? r.body.icons : r.body.effectsHeld[slot]).includes(key), 'the wardrobe holds it');
  assert.deepEqual(s.lines(me), [{ kind: 'buy', ref: first, amount: -price }]);
  assert.deepEqual((await s.buy(me, first)).body, { error: 'aurum-held' });
  // PIN MOVED (AURUM-ONLY): a ware not among today's deals is sold all the same, at its own price - never the deal's
  const off = AURUM_DAILY.filter((d) => !today().includes(d.id)).sort((a, b) => a.aurum - b.aurum)[0], list = shopWareById(off.id).price;
  assert.deepEqual((await s.buy(me, off.id, off.aurum)).body, { error: 'aurum-price', price: list }, 'the deal\'s price asked off its day: told the price, nothing spent');
  const full = await s.buy(me, off.id, list);
  assert.equal(full.status, 200, JSON.stringify(full.body));
  assert.equal(full.body.spent, list, 'off its deal day, its own price');
  assert.deepEqual(s.lines(me), [{ kind: 'buy', ref: first, amount: -price }, { kind: 'buy', ref: off.id, amount: -list }].sort((a, b) => (a.ref < b.ref ? -1 : 1)));
  assert.equal((await s.buy(me, 'icon:nope')).status, 400);
  assert.deepEqual((await s.buy(me, 'aurum:500')).body, { error: 'aurum-ware' }, 'a pack is bought with money alone');
  assert.deepEqual((await s.buy(me, 'glyph:oblivion')).body, { error: 'aurum-ware' }, 'a ware a bundle alone gives');
  const narrow = await stand({ ...ON, SHOP_ON_SALE: SHOP_WARES.filter((w) => w.alone && w.id !== off.id).map((w) => w.id).join(',') });
  const n = await narrow.registered('Narrow');
  narrow.pack(n, 'aurum:2400', 2400);
  assert.deepEqual((await narrow.buy(n, off.id)).body, { error: 'aurum-sale' }, 'a ware the sale does not name');
  const dear = today().filter((id) => id !== first).sort((a, b) => AURUM_DAILY.find((d) => d.id === b).aurum - AURUM_DAILY.find((d) => d.id === a).aurum)[0];
  s.raw.prepare("UPDATE shop_orders SET status = 'refunded' WHERE player = ?").run(me.id);
  const short = await s.buy(me, dear);
  assert.equal(short.status, 409);
  assert.deepEqual(short.body, { error: 'aurum-short', balance: -price - list }, 'the pack taken back: the balance below nothing');
  assert.equal(s.lines(me).length, 2, 'nothing more spent');
  const closed = await stand({ ...ON, AURUM_OPEN: 'off' });
  const c = await closed.registered('Closed');
  assert.equal((await closed.buy(c, today()[0])).body.error, 'aurum-closed');
});

test('AURUM the batch\'s guards: a balance spent elsewhere between the read and the write refuses the buy (the ledger\'s own sum, in SQL); a row moved meanwhile is read again and the buy lands once (mutants: the balance guard dropped from the INSERT; the row guard dropped from the UPDATE)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: NOW });
  const s = await stand();
  const me = await s.registered('Raced');
  s.pack(me, 'aurum:2400', 2400);
  const [ware] = today(), price = AURUM_DAILY.find((d) => d.id === ware).aurum;
  const player = { id: me.id, handle: me.handle };
  const nowS = NOW / 1000, db = s.env.DB;
  // another buy spends all but a coin while this one is between its read and its batch
  let once = true;
  const spentMeanwhile = { ...db, prepare: (q) => db.prepare(q), batch: (l) => { if (once) { once = false; s.raw.prepare("INSERT INTO aurum_ledger (account, kind, ref, amount, day, at) VALUES (?, 'buy', 'x', ?, 0, 0)").run(me.id, -(2400 - price + 1)); } return db.batch(l); } };
  const r = await buyWare({ db: spentMeanwhile, nowS }, player, { ware }, ON);
  assert.deepEqual(r, { error: 'aurum-short', balance: price - 1 }, 'read again: short');
  assert.equal(s.lines(me).filter((l) => l.ref === ware).length, 0, 'never spent');
  s.raw.prepare("DELETE FROM aurum_ledger WHERE ref = 'x'").run();
  // a grant lands on the row between the read and the batch: the batch refused whole, read again, bought once
  const granted = SHOP_WARES.find((w) => w.alone && !w.bit && w.kind === 'bundle').id;
  let first = true;
  const moved = { ...db, prepare: (q) => db.prepare(q), batch: (l) => { if (first) { first = false; s.raw.prepare('UPDATE players SET shop_held = ? WHERE id = ?').run(granted, me.id); } return db.batch(l); } };
  const ok = await buyWare({ db: moved, nowS }, player, { ware }, ON);
  assert.equal(ok.ok, true);
  assert.equal(s.lines(me).filter((l) => l.ref === ware).length, 1, 'one line');
  assert.ok(shopHeldIds(s.raw.prepare('SELECT * FROM players WHERE id = ?').get(me.id)).includes(granted), 'the grant kept');
});

test('AURUM AURUM_OPEN \'dev\': the developers alone (mutants: dev open to every account)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: NOW });
  const s = await stand({ ...ON, AURUM_OPEN: 'dev', DEVELOPER_HANDLES: 'Maker' });
  const dev = await s.registered('Maker'), other = await s.registered('Other');
  assert.equal((await s.card(dev)).open, true);
  assert.equal((await s.card(other)).open, false);
  assert.equal((await s.buy(other, today()[0])).body.error, 'aurum-closed');
});
