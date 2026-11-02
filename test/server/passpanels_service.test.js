// PASS-PANELS (2026-10-30, the owner: "a free panel track and a premium panel track using our new currency to both unlock
// tracks and buy the items"; bible/06-Systems/Battle-Pass.md). The service's half on the real Worker over node:sqlite:
// the premium track opened for Aurum, an item on an open panel bought for Aurum and worn, every refusal, and the guards
// that keep a balance from being spent twice.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService } from '../accountDb.mjs';
import { SHOP_WARES } from '../../src/net/shopLaw.js';
import { PASS_PREMIUM_AURUM, passSeasonById, passItemOf } from '../../src/net/battlePassLaw.js';
import { unlockPass, buyPass, BATTLE_PASS_STATUS } from '../../server-account/src/battlePass.js';

const S1 = passSeasonById('s1');
const NOW = S1.fromMs + 5 * 86_400_000;
const ON = { SHOP_ON_SALE: SHOP_WARES.filter((w) => w.alone).map((w) => w.id).join(','), PASS_OPEN: 'on', AURUM_OPEN: 'on' };

async function stand(env = ON) {
  const s = await standService(env);
  const raw = s.env.DB._raw;
  const ask = (who, path, body) => s.fetch(`https://accounts.invalid${path}`, body === undefined
    ? { headers: { authorization: `Bearer ${who.secret}` } }
    : { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${who.secret}` }, body: JSON.stringify(body) })
    .then(async (r) => ({ status: r.status, body: await r.json() }));
  const give = (who, aurum) => raw.prepare("INSERT INTO aurum_ledger (account, kind, ref, amount, day, at) VALUES (?, 'cache', ?, ?, 0, 0)").run(who.id, `t${Math.random()}`, aurum);
  const lines = (who) => raw.prepare("SELECT kind, ref, amount FROM aurum_ledger WHERE account = ? AND kind IN ('track', 'panel') ORDER BY at, ref").all(who.id).map((l) => ({ ...l }));
  const items = (who) => raw.prepare('SELECT pass_items FROM players WHERE id = ?').get(who.id).pass_items;
  const unlock = (who, season = 's1') => ask(who, '/v1/pass/unlock', { season });
  const buy = (who, grant, season = 's1') => ask(who, '/v1/pass/buy', { season, grant });
  return { ...s, raw, ask, give, lines, items, unlock, buy };
}

test('PASS-PANELS the free track end to end: an item on the first panel bought for its Aurum and worn at once; the next panel shut until its track has had enough spent, then open; the answer the wardrobe, the Aurum\'s card and the pass\'s (mutants: the price never spent; the item never written; a shut panel sold)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: NOW });
  const s = await stand();
  const me = await s.registered('Buyer');
  s.give(me, 1000);
  const shut = await s.buy(me, 'title:tremorborn');
  assert.deepEqual([shut.status, shut.body.error], [409, 'pass-panel'], 'nothing spent on the free track yet');
  const cog = await s.buy(me, 'glyph:cog');
  assert.equal(cog.status, 200, JSON.stringify(cog.body));
  assert.deepEqual([cog.body.ok, cog.body.season, cog.body.grant, cog.body.spent], [true, 's1', 'glyph:cog', 200]);
  assert.equal(cog.body.row, undefined, 'never the row');
  assert.equal(cog.body.aurum.balance, 800);
  assert.deepEqual(cog.body.pass.bought, ['glyph:cog']);
  assert.ok(cog.body.glyphs.includes('cog'), 'the glyph held');
  assert.equal((await s.buy(me, 'title:tremorborn')).body.error, 'pass-panel', '200 of 300');
  assert.equal((await s.buy(me, 'icon:aetherium')).status, 200);
  const title = await s.buy(me, 'title:tremorborn');
  assert.equal(title.status, 200, 'the second panel opened by 500 spent');
  assert.ok(title.body.titles.includes('tremorborn'), 'the title held');
  assert.equal((await s.ask(me, '/v1/account/title', { title: 'tremorborn' })).status, 200, 'and worn');
  assert.deepEqual(s.lines(me).map((l) => [l.ref, l.amount]), [['s1:glyph:cog', -200], ['s1:icon:aetherium', -300], ['s1:title:tremorborn', -400]]);
  assert.equal(s.items(me), 'glyph:cog icon:aetherium title:tremorborn');
  assert.equal((await s.ask(me, '/v1/account')).body.aurum.balance, 100);
  const held = await s.buy(me, 'glyph:cog');
  assert.deepEqual([held.status, held.body.error], [409, 'pass-held']);
  const short = await s.buy(me, 'portal:brass');
  assert.deepEqual([short.status, short.body], [409, { error: 'pass-short', balance: 100 }]);
  assert.equal(s.lines(me).length, 3, 'nothing more spent');
});

test('PASS-PANELS the premium track end to end: shut until opened for its Aurum - once, the second open refused; then its first panel sells and its later ones open by its own spending alone (mutants: a premium item sold on a shut track; the open free; the open taken twice; the free track\'s spending opening a premium panel)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: NOW });
  const s = await stand();
  const me = await s.registered('Patron');
  s.give(me, 5000);
  assert.equal((await s.buy(me, 'glyph:tonalfork')).body.error, 'pass-track');
  for (const g of ['glyph:cog', 'icon:aetherium', 'title:tremorborn']) assert.equal((await s.buy(me, g)).status, 200, g);
  const open = await s.unlock(me);
  assert.equal(open.status, 200, JSON.stringify(open.body));
  assert.deepEqual([open.body.ok, open.body.spent, open.body.pass.tracks.premium, open.body.aurum.balance], [true, PASS_PREMIUM_AURUM.s1, true, 5000 - 900 - 1000]);
  assert.ok(Array.isArray(open.body.titles), 'the wardrobe on the answer, as a buy\'s');
  assert.deepEqual([(await s.unlock(me)).status, (await s.unlock(me)).body.error], [409, 'pass-held']);
  assert.equal(s.lines(me).filter((l) => l.kind === 'track').length, 1, 'opened once');
  assert.equal((await s.buy(me, 'title:heartwaker')).body.error, 'pass-panel', 'the free track\'s 900 opens nothing here');
  assert.equal((await s.buy(me, 'aura:aetherium')).status, 200);
  const heart = await s.buy(me, 'title:heartwaker');
  assert.equal(heart.status, 200);
  assert.ok(heart.body.titles.includes('heartwaker'));
  assert.ok((await s.buy(me, 'aura:gildedcoil')).body.auras.includes('gildedcoil'), 'an aura held');
  assert.equal((await s.buy(me, 'mount:automaton')).body.error, 'pass-short', `${passItemOf('s1', 'mount:automaton').aurum} wanted, too little left`);
});

test('PASS-PANELS every refusal and its status: a guest, the switch off or dev for another, a season the law lacks, before its first instant, an item no track sells, a short balance; and a year past the season the tracks still sell (the owner: "Never expire") (mutants: a guest served; dev open to all; the tracks shut with the season)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: S1.tracksFromMs - 86_400_000 });
  const s = await stand({ ...ON, PASS_OPEN: 'dev', DEVELOPER_HANDLES: 'Maker' });
  const dev = await s.registered('Maker'), other = await s.registered('Other');
  s.give(dev, 2000); s.give(other, 2000);
  const ctx = () => ({ db: s.env.DB, nowS: Math.floor(Date.now() / 1000) });
  assert.deepEqual(await unlockPass(ctx(), { id: 'g', handle: null }, { season: 's1' }, ON), { error: 'pass-guest' });
  assert.deepEqual(await buyPass(ctx(), { id: 'g', handle: null }, { season: 's1', grant: 'glyph:cog' }, ON), { error: 'pass-guest' });
  assert.equal((await s.buy(other, 'glyph:cog')).body.error, 'pass-closed', 'dev: another account shut');
  assert.equal((await s.buy(dev, 'glyph:cog')).body.error, 'pass-soon', 'dev: the developer reaches the season\'s own word');
  assert.equal((await s.unlock(dev)).body.error, 'pass-soon');
  const poor = await s.registered('Poor');
  assert.deepEqual((await s.unlock(poor)).body, { error: 'pass-closed' }, 'dev: shut to a stranger before the balance is read');
  t.mock.timers.setTime(S1.toMs + 365 * 86_400_000);
  s.env.PASS_OPEN = 'on';   // PIN MOVED (ADMIN-ALL): a developer holds every item and is sold none, so a year on is read by an account on no list, the switch on
  const late = await s.registered('Later');   // a session a year on (the first one's has lapsed)
  s.give(late, 2000);
  assert.equal((await s.buy(late, 'nope:x')).body.error, 'pass-item');
  assert.equal((await s.buy(late, 'kill:pyre')).body.error, 'pass-item', 'a shop ware is no track\'s');
  assert.equal((await s.buy(late, 'glyph:cog', 's9')).body.error, 'pass-season');
  assert.equal((await s.unlock(late, 's9')).body.error, 'pass-season');
  assert.equal((await s.buy(late, 'glyph:cog')).status, 200, 'a year past the season');
  assert.equal((await s.unlock(late)).status, 200);
  assert.deepEqual((await s.buy(late, 'mount:automaton')).body.error, 'pass-panel');
  for (const [e, st] of [['pass-guest', 403], ['pass-closed', 409], ['pass-season', 400], ['pass-item', 400], ['pass-soon', 409], ['pass-held', 409], ['pass-track', 409], ['pass-panel', 409], ['pass-short', 409], ['pass-busy', 503]]) assert.equal(BATTLE_PASS_STATUS[e], st, e);
});

test('PASS-PANELS the guards: a balance spent elsewhere between the read and the write refuses the buy and the open (the ledger\'s sum, in SQL); a row moved meanwhile is read again and the item bought once; a twin open lands once (mutants: the balance guard dropped from a line\'s INSERT; the row guard dropped from the UPDATE)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: NOW });
  const s = await stand();
  const me = await s.registered('Raced');
  s.give(me, 1200);
  const player = { id: me.id, handle: me.handle }, db = s.env.DB, nowS = NOW / 1000;
  const once = (fn) => { let first = true; return { ...db, prepare: (q) => db.prepare(q), batch: (l) => { if (first) { first = false; fn(); } return db.batch(l); } }; };
  const spend = (n) => () => s.raw.prepare("INSERT INTO aurum_ledger (account, kind, ref, amount, day, at) VALUES (?, 'buy', ?, ?, 0, 0)").run(me.id, `x${n}`, -n);
  // the open: 1,200 read, 300 spent elsewhere before the batch - 900 left, short of 1,000
  assert.deepEqual(await unlockPass({ db: once(spend(300)), nowS }, player, { season: 's1' }, ON), { error: 'pass-short', balance: 900 });
  assert.equal(s.lines(me).length, 0, 'never opened');
  // a buy: 900 read, 800 spent elsewhere - 100 left, short of the cog's 200
  assert.deepEqual(await buyPass({ db: once(spend(800)), nowS }, player, { season: 's1', grant: 'glyph:cog' }, ON), { error: 'pass-short', balance: 100 });
  assert.equal(s.lines(me).length, 0, 'never spent');
  s.raw.prepare("DELETE FROM aurum_ledger WHERE ref LIKE 'x%'").run();
  // the row moved meanwhile (another item written): read again, bought once, the other kept
  const moved = once(() => s.raw.prepare("UPDATE players SET pass_items = 'icon:aetherium' WHERE id = ?").run(me.id));
  const r = await buyPass({ db: moved, nowS }, player, { season: 's1', grant: 'glyph:cog' }, ON);
  assert.equal(r.ok, true);
  assert.equal(s.items(me), 'icon:aetherium glyph:cog');
  assert.equal(s.lines(me).filter((l) => l.ref === 's1:glyph:cog').length, 1);
  // twin opens: one lands, the other answers held
  s.give(me, 2000);
  const both = await Promise.all([unlockPass({ db, nowS }, player, { season: 's1' }, ON), unlockPass({ db, nowS }, player, { season: 's1' }, ON)]);
  assert.deepEqual(both.map((x) => x.ok === true || x.error).sort(), [true, 'pass-held'].sort());
  assert.equal(s.lines(me).filter((l) => l.kind === 'track').length, 1);
});
