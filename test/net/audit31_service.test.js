// AUDIT 31 (2026-09-29, Mac: "let's first do a comprehensive audit and ensure everything so far is perfect") - PROF5b
// AND PROF6 AS THE SERVICE KEEPS THEM, AUDITED: an auction whose leading bidder's account is gone closes unsold and
// every read still answers (S1); a won auction its seller's Marks cap cannot take is void after seven days (S3); a bid
// another bid overtook is refused in its own word (S4); a commission's fill says why a piece is held (S5); a rank that
// takes the guild Stores out does not deliver to its guild's writs (S6); a guild keeping writs, Stores or Marks is
// never reclaimed with no one in it (S7); the caps count only what still stands (L1); nothing unmakeable is
// commissioned (L2); a member takes back their own deposit (R1); a writ is posted only with the guild Stores' room for
// it (L9); a writ's escrow waiting on a full treasury says so (A15); the last two minutes' edge (L4); the early words
// PROF5b recorded as equivalent (R5); the room and the eligible pieces the Work tab reads (U10, U7). Driven through
// the real Worker over node:sqlite with every migration applied (test/accountDb.mjs).
// bible/06-Systems/Online-Arc.md "AUDIT 31"; bible/06-Systems/Professions-Arc.md 18, 27, 28.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService, T0 } from '../accountDb.mjs';
import { holdPieces, recordOf, layRecord } from '../realmSeat.mjs';   // INT19: a crafted piece in its seller's realm record
import { MARKS_MAX } from '../../src/net/marksLaw.js';
import { AUCTION_S, AUCTION_LATE_S, AUCTION_ADD_S, AUCTION_GRACE_S, MARKET_LISTINGS_MAX, MARKET_LISTING_S, auctionNext } from '../../src/net/marketLaw.js';
import { GUILD_WRITS_MAX, GUILD_STORES_MAX, COMMISSIONS_FOR_MAX, WRIT_S, WRIT_OPS_MAX, writPayMax } from '../../src/net/writLaw.js';

let _now = T0;
const realNow = Date.now;
const clock = (s) => { _now = s; Date.now = () => _now * 1000; };
test.after(() => { Date.now = realNow; });
clock(T0);
let _rid = 0;
const rid = () => `a31-${String(++_rid).padStart(6, '0')}`;
const DF = 17, WR = 23;
const HUBS = { [DF]: [207, 212], [WR]: [590, 166] };
const P = (n) => n.toString(16).padStart(16, '0');
const OAK = 'log:oak';

async function stand(extra = {}) {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on', DEVELOPER_HANDLES: 'Mac', MODERATOR_HANDLES: 'Asynian', ...extra });
  const raw = s.env.DB._raw;
  const call = s.call;
  const balance = (who) => Number(raw.prepare('SELECT balance FROM marks WHERE account = ?').get(who.id)?.balance ?? 0);
  const fund = (who, marks) => raw.prepare('INSERT INTO marks (account, balance) VALUES (?, ?) ON CONFLICT (account) DO UPDATE SET balance = excluded.balance').run(who.id, marks);
  const give = (who, key, origin, qty, character = who.character) => raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = excluded.qty`).run(who.id, character, key, origin, qty);
  const held = (who, key) => Object.fromEntries(raw.prepare('SELECT origin, qty FROM prof_stores WHERE player = ? AND char_id = ? AND material = ?')
    .all(who.id, who.character, key).map((r) => [r.origin, Number(r.qty)]));
  const guildMarks = (g) => Number(raw.prepare('SELECT balance FROM guild_marks WHERE guild_id = ?').get(g)?.balance ?? 0);
  /** A crafted piece this account owns - of its own make (a craft row names it) unless said. PIN MOVED (INT19, Integrity-Arc
   *  section 7): an auction, a listing and a fill take the piece out of the realm record, so a realm character's piece
   *  stands there too. */
  const piece = (who, provenance, { recipe = 'longsword:mithril', quality = 4, made = true } = {}) => {
    raw.prepare(`INSERT INTO products (provenance, owner, char_id, maker, recipe, template, material, quality, seed, record, made_at)
      VALUES (?, ?, ?, 'Silverthorn', ?, 120, 5, ?, 4242, 'p1.x', ?)`).run(provenance, who.id, who.character, recipe, quality, _now);
    if (who.at) holdPieces(s.env, who.character, [{ provenance, quality }]);
    if (made) {
      raw.prepare(`INSERT INTO prof_crafts (player, rid, char_id, recipe, quality, count, provenance, seed, xp, first, at, n)
        VALUES (?, ?, ?, ?, ?, 1, ?, 4242, 10, 0, ?, 'n')`).run(who.id, `craft-${provenance}`, who.character, recipe, quality, provenance, _now);
    }
  };
  const read = (who, view, extra = {}) => call('/v1/market/read', { character: who.character, region: DF, view, hubs: HUBS, ...extra }, who.secret);
  const post = (who, provenance, opening, extra = {}) => call('/v1/market/auction', { character: who.character, region: DF, provenance, wear: 900, opening, hubs: HUBS, rid: rid(), ...extra }, who.secret);
  const bid = (who, auction, amount, extra = {}) => call('/v1/market/bid', { character: who.character, region: DF, auction, amount, hubs: HUBS, rid: rid(), ...extra }, who.secret);
  const auction = (id) => raw.prepare('SELECT state, high, high_bid, ends_at, returned FROM market_auctions WHERE id = ?').get(id);
  const list = (who, region = DF) => call('/v1/writs/list', { character: who.character, region }, who.secret);
  const wpost = (who, extra = {}) => call('/v1/writs/post', { character: who.character, region: DF, material: OAK, units: 100, pay: 3, rid: rid(), ...extra }, who.secret);
  const supply = (who, writ, units, extra = {}) => call('/v1/writs/supply', { character: who.character, region: DF, writ, units, rid: rid(), ...extra }, who.secret);
  const commission = (who, crafter, extra = {}) => call('/v1/writs/commission', {
    character: who.character, region: DF, crafter, recipe: 'longsword:mithril', quality: 2, pay: 900, rid: rid(), ...extra,
  }, who.secret);
  const fulfil = (who, id, provenance, extra = {}) => call('/v1/writs/fulfil', { character: who.character, region: DF, commission: id, provenance, wear: 1000, rid: rid(), ...extra }, who.secret);
  const stores = (who, kind, key, units, extra = {}) => call(`/v1/stores/guild-${kind}`, { character: who.character, material: key, units, rid: rid(), ...extra }, who.secret);
  const guild = async (marks = 20_000, { name = 'The Hound', tag = 'HND' } = {}) => {
    const gm = await s.registered('Aldric', { renown: 10 });
    s.seedMarks(gm, 100_000, 'gm');
    const g = (await s.found(gm, { name: name, tag: tag })).body.guild;
    const join = async (handle) => {
      const w = await s.registered(handle, { renown: 1 });
      await call('/v1/guilds/invite', { character: gm.character, handle }, gm.secret);
      await call('/v1/guilds/answer', { character: w.character, guild: g.id, accept: true }, w.secret);
      return w;
    };
    const officer = await join('Mara'), member = await join('Bran'), recruit = await join('Cass');
    const roster = async () => (await call('/v1/guilds/mine', { character: gm.character }, gm.secret)).body.guild.members;
    const rank = async (who, r) => {
      const m = (await roster()).find((x) => x.name === who.handle).member;
      const res = await call('/v1/guilds/rank', { character: gm.character, member: m, rank: r }, gm.secret);
      assert.equal(res.status, 200, JSON.stringify(res.body));
    };
    await rank(officer, 1);
    await rank(member, 2);
    if (marks) assert.equal((await call('/v1/marks/guild/deposit', { character: gm.character, marks, rid: rid() }, gm.secret)).status, 200);
    return { gm, officer, member, recruit, g };
  };
  /** Run `other` whole just before the next batch whose SQL matches `re` - a race the one-request harness cannot make. */
  const stage = (re, other) => {
    const prep = s.env.DB.prepare.bind(s.env.DB), batch = s.env.DB.batch.bind(s.env.DB);
    let go = other;
    s.env.DB.prepare = (sql) => Object.assign(prep(sql), { _sql: sql });
    s.env.DB.batch = async (lst) => {
      if (go && lst.some((st) => re.test(st._sql ?? ''))) { const g = go; go = null; await g(); }
      return batch(lst);
    };
    return () => { s.env.DB.prepare = prep; s.env.DB.batch = batch; };
  };
  return { ...s, raw, balance, fund, give, held, guildMarks, piece, read, post, bid, auction, list, wpost, supply, commission, fulfil, stores, guild, stage };
}

// ─── THE AUCTIONS (PROF5b) ───────────────────────────────────────────

test('AUDIT 31 S1: an auction whose leading bidder\'s account is gone closes unsold at its end - every market read still answers, the piece its seller\'s and back to them, no owner lost', async () => {
  clock(T0);
  const s = await stand();
  const mac = await s.seated('Mac'), bob = await s.registered('Bob'), ann = await s.registered('Ann');
  for (const w of [mac, bob, ann]) s.fund(w, 100_000);
  s.piece(mac, P(2));
  const a = (await s.post(mac, P(2), 1000)).body.auction;
  assert.equal((await s.bid(bob, a.id, 1000)).status, 200);
  s.raw.prepare('DELETE FROM players WHERE id = ?').run(bob.id);   // no route does this today (Professions-Arc 18: OPEN) - the latent row
  assert.equal(s.auction(a.id).high_bid != null, true, 'the auction still names the gone bid');
  clock(T0 + AUCTION_S + 1);
  const anyone = await s.read(ann, 'auctions');
  assert.equal(anyone.status, 200, JSON.stringify(anyone.body));
  assert.equal(s.auction(a.id).state, 'unsold');
  assert.equal(s.raw.prepare('SELECT owner FROM products WHERE provenance = ?').get(P(2)).owner, mac.id, 'never an owner of NULL');
  const seller = await s.read(mac, 'mine');
  assert.equal(seller.status, 200);
  // PIN MOVED (INT19): back as the record that left, a delivery its seller's record collects
  assert.deepEqual({ ...s.raw.prepare("SELECT why, player FROM market_deliveries WHERE json_extract(item, '$.provenance') = ?").get(P(2)) }, { why: 'returned', player: mac.id });
});

test('AUDIT 31 S3: a won auction its seller\'s Marks cap cannot take waits seven days past its end, then the winning bid is void - its escrow back on its bidder\'s read, the piece back to its seller, unsold', async () => {
  clock(T0);
  const s = await stand();
  const mac = await s.seated('Mac'), bob = await s.registered('Bob');
  s.fund(mac, 100_000); s.fund(bob, 100_000);
  s.piece(mac, P(5));
  const a = (await s.post(mac, P(5), 1000)).body.auction;
  assert.equal((await s.bid(bob, a.id, 5000)).status, 200);
  const bobHeld = s.balance(bob);
  s.fund(mac, MARKS_MAX);
  clock(T0 + AUCTION_S + AUCTION_GRACE_S - 1);
  await s.read(bob, 'mine');
  assert.deepEqual([s.auction(a.id).state, s.balance(bob)], ['open', bobHeld], 'within the grace, it waits for the seller');
  clock(T0 + AUCTION_S + AUCTION_GRACE_S);
  const r = await s.read(bob, 'mine');
  assert.equal(r.status, 200);
  assert.equal(s.auction(a.id).state, 'unsold');
  assert.equal(s.balance(bob), 100_000, 'the bid and its courier back');
  assert.deepEqual(r.body.bids.map((b) => [b.state, b.returned]), [['void', true]]);
  await s.read(mac, 'mine');
  assert.equal(s.balance(mac), MARKS_MAX, 'the seller paid nothing past the cap');
  assert.deepEqual({ ...s.raw.prepare('SELECT owner, listed FROM products WHERE provenance = ?').get(P(5)) }, { owner: mac.id, listed: 0 });
  assert.equal(s.raw.prepare("SELECT why FROM market_deliveries WHERE json_extract(item, '$.provenance') = ?").get(P(5)).why, 'returned');   // PIN MOVED (INT19): as its record
});

test('AUDIT 31 S4: a bid another bid overtook between its read and its decision is refused `auction-moved` (a 409 the tab reads again), never "no longer on the market" while it stands', async () => {
  clock(T0);
  const s = await stand();
  const mac = await s.seated('Mac'), bob = await s.registered('Bob'), cid = await s.registered('Cid');
  for (const w of [mac, bob, cid]) s.fund(w, 100_000);
  s.piece(mac, P(1));
  const a = (await s.post(mac, P(1), 1000)).body.auction;
  let cids;
  const undo = s.stage(/UPDATE market_auctions SET high/, async () => { cids = await s.bid(cid, a.id, 1000); });
  const bobs = await s.bid(bob, a.id, 5000);
  undo();
  assert.equal(cids.status, 200);
  assert.deepEqual([bobs.status, bobs.body.error], [409, 'auction-moved']);
  assert.deepEqual([s.auction(a.id).state, s.auction(a.id).high], ['open', 1000]);
});

test('AUDIT 31 L4: the last two minutes\' edge - a bid with exactly 120 s left leaves the end where it was; with 119 s left it moves it 120 s on', async () => {
  clock(T0);
  const s = await stand();
  const mac = await s.seated('Mac'), bob = await s.registered('Bob'), ann = await s.registered('Ann');
  for (const w of [mac, bob, ann]) s.fund(w, 100_000);
  s.piece(mac, P(7));
  const a = (await s.post(mac, P(7), 1000)).body.auction;
  const end = a.endsAt;
  clock(end - AUCTION_LATE_S);
  assert.equal((await s.bid(bob, a.id, 1000)).body.auction.endsAt, end, '120 s left: not in the last two minutes');
  clock(end - AUCTION_LATE_S + 1);
  assert.equal((await s.bid(ann, a.id, auctionNext(1000, 1000))).body.auction.endsAt, end + AUCTION_ADD_S, '119 s left: two more');
});

test('AUDIT 31 R5: the bid\'s early words decide - the standing bidder bidding under the next is told they lead, and a bid under the next from a board with no known road is told it is low, not that the road is unknown', async () => {
  clock(T0);
  const s = await stand();
  const mac = await s.seated('Mac'), ann = await s.registered('Ann'), bob = await s.registered('Bob');
  for (const w of [mac, ann, bob]) s.fund(w, 100_000);
  s.piece(mac, P(8));
  const a = (await s.post(mac, P(8), 100)).body.auction;
  assert.equal((await s.bid(ann, a.id, 100)).status, 200);
  assert.equal((await s.bid(ann, a.id, 100)).body.error, 'auction-leading', 'under the next, and leading: the lead is the word');
  const low = await s.bid(bob, a.id, 104, { region: 40, hubs: {} });
  assert.equal(low.body.error, 'auction-low', 'no road known from region 40, and low: low is the word');
  // AUDIT 31 L6: a bid's bound is its own (the Marks cap), never a price's word
  assert.deepEqual([(await s.bid(bob, a.id, 0)).body.error, (await s.bid(bob, a.id, MARKS_MAX + 1)).body.error], ['bad-bid', 'bad-bid']);
});

test('AUDIT 31 L1: an auction past its end - a won one its seller\'s cap holds - is not among its seller\'s thirty', async () => {
  clock(T0);
  const s = await stand();
  const mac = await s.seated('Mac'), bob = await s.registered('Bob');
  s.fund(mac, 100_000); s.fund(bob, 100_000);
  s.piece(mac, P(0x100));
  const stuck = (await s.post(mac, P(0x100), 1000)).body.auction;
  assert.equal((await s.bid(bob, stuck.id, 5000)).status, 200);
  s.fund(mac, MARKS_MAX - 1_000);
  clock(T0 + AUCTION_S - 60);
  for (let i = 1; i < MARKET_LISTINGS_MAX; i++) {
    s.piece(mac, P(0x100 + i));
    assert.equal((await s.post(mac, P(0x100 + i), 1000)).status, 200, `auction ${i}`);
  }
  s.piece(mac, P(0x200));
  assert.equal((await s.post(mac, P(0x200), 1000)).body.error, 'market-listings-max', 'thirty stand');
  clock(T0 + AUCTION_S + 1);
  const r = await s.post(mac, P(0x200), 1000);
  assert.equal(r.status, 200, `the ended one is not among them: ${JSON.stringify(r.body)}`);
});

test('AUDIT 31 R9: an auction posted twice under one id is one - the fee burnt once, the same auction answered', async () => {
  clock(T0);
  const s = await stand();
  const mac = await s.seated('Mac');
  s.fund(mac, 100_000);
  s.piece(mac, P(0x31));
  const R = rid();
  const one = await s.post(mac, P(0x31), 1000, { rid: R });
  const paid = s.balance(mac);
  const two = await s.post(mac, P(0x31), 1000, { rid: R });
  assert.deepEqual([one.status, two.status, two.body.repeat, two.body.auction.id, s.balance(mac)], [200, 200, true, one.body.auction.id, paid]);
});

// ─── GUILD WRITS AND THE GUILD STORES (PROF6) ────────────────────────

test('AUDIT 31 S6: a rank that takes the guild Stores out - an Officer, the Guildmaster, on any of the account\'s characters - does not deliver to its guild\'s writs; a Member and an outsider do', async () => {
  clock(T0);
  const s = await stand();
  const { gm, officer, member, g } = await s.guild(50_000);
  const pay = writPayMax(OAK);
  assert.equal((await s.call('/v1/writs/budget', { character: gm.character, marks: 1000 }, gm.secret)).status, 200);
  const w = (await s.wpost(officer, { units: 100, pay })).body.writ;
  s.give(officer, OAK, 'own', 100);
  const t0 = s.guildMarks(g.id);
  const own = await s.supply(officer, w.id, 100);
  assert.deepEqual([own.status, own.body.error], [403, 'writ-own-guild'], 'deliver, take it out, deliver again: the budget the Officer\'s Marks');
  s.give(officer, OAK, 'own', 10, 'char-mara-2');
  assert.equal((await s.supply({ ...officer, character: 'char-mara-2' }, w.id, 10)).body.error, 'writ-own-guild', 'nor from another of the account\'s characters');
  s.give(gm, OAK, 'own', 10);
  assert.equal((await s.supply(gm, w.id, 10)).body.error, 'writ-own-guild');
  assert.equal(s.guildMarks(g.id), t0, 'nothing paid');
  s.give(member, OAK, 'own', 10);
  assert.equal((await s.supply(member, w.id, 10)).status, 200, 'a Member takes no guild Stores out but their own');
  const outsider = await s.registered('Oswin');
  s.give(outsider, OAK, 'own', 10);
  assert.equal((await s.supply(outsider, w.id, 10)).status, 200);
  // one statement decides: made an Officer between the read and the decision, the delivery is refused
  s.give(member, OAK, 'own', 10);
  const roster = (await s.call('/v1/guilds/mine', { character: gm.character }, gm.secret)).body.guild.members;
  const m = roster.find((x) => x.name === member.handle).member;
  const undo = s.stage(/INSERT OR IGNORE INTO guild_writ_fills/, async () => {
    assert.equal((await s.call('/v1/guilds/rank', { character: gm.character, member: m, rank: 1 }, gm.secret)).status, 200);
  });
  const raced = await s.supply(member, w.id, 10);
  undo();
  assert.deepEqual([raced.status, raced.body.error, s.held(member, OAK)], [403, 'writ-own-guild', { own: 10 }]);
});

test('AUDIT 31 R1: any member takes back what they put in of their own, as own; past it, only an Officer or the Guildmaster - the rest of the guild Stores\' goods are theirs to take', async () => {
  clock(T0);
  const s = await stand();
  const { officer, member, recruit, g } = await s.guild(0);
  s.give(member, OAK, 'own', 30);
  s.give(member, OAK, 'bought', 5);
  assert.equal((await s.stores(member, 'deposit', OAK, 35)).status, 200);   // the bought 5 the guild's, the own 30 kept under Bran
  const back = await s.stores(member, 'withdraw', OAK, 20);
  assert.equal(back.status, 200, JSON.stringify(back.body));
  assert.deepEqual([back.body.move.own, s.held(member, OAK)], [20, { own: 20 }]);
  assert.deepEqual([back.body.mayWithdraw, back.body.rows.find((r) => r.material === OAK).mine], [false, 10], 'the tab reads what is still theirs');
  const past = await s.stores(member, 'withdraw', OAK, 11);
  assert.deepEqual([past.status, past.body.error], [403, 'guild-stores-mine']);
  assert.equal((await s.stores(recruit, 'withdraw', OAK, 1)).body.error, 'guild-stores-mine', 'nothing of theirs there');
  const off = await s.stores(officer, 'withdraw', OAK, 15);
  assert.deepEqual([off.status, off.body.move.own, s.held(officer, OAK)], [200, 0, { bought: 15 }], 'the guild\'s 5 then Bran\'s 10, bought');
  assert.equal(s.raw.prepare('SELECT COALESCE(SUM(qty), 0) AS n FROM guild_prof_stores WHERE guild_id = ?').get(g.id).n, 0);
  // one statement decides: Bran's own deposit taken by an Officer between the read and the decision - Bran takes no
  // one else's (another member's deposit sorts after Bran's, so the Officer's take reaches Bran's first)
  s.give(member, OAK, 'own', 20);
  assert.equal((await s.stores(member, 'deposit', OAK, 20)).status, 200);
  s.raw.prepare(`INSERT INTO guild_prof_stores (guild_id, material, dep_player, dep_char, qty, moved_by, moved_at) VALUES (?, ?, 'zzzzzzzzzzzzzzzz', 'char-z', 40, 'Zed', 1)`)
    .run(g.id, OAK);
  const undo = s.stage(/INSERT OR IGNORE INTO guild_store_moves[\s\S]*'withdraw'/, async () => {
    assert.equal((await s.stores(officer, 'withdraw', OAK, 20)).status, 200);
  });
  const raced = await s.stores(member, 'withdraw', OAK, 20);
  undo();
  assert.deepEqual([raced.status, raced.body.error], [403, 'guild-stores-mine']);
  assert.equal(s.raw.prepare(`SELECT qty FROM guild_prof_stores WHERE guild_id = ? AND dep_player = 'zzzzzzzzzzzzzzzz'`).get(g.id).qty, 40, 'another\'s deposit untouched');
  // refused before the act: the hour's count is spent by acts, never by asking past one's own (the acts' 120 intact)
  for (let i = 0; i < WRIT_OPS_MAX; i++) assert.equal((await s.stores(recruit, 'withdraw', OAK, 1)).body.error, 'guild-stores-mine', `ask ${i}`);
  s.give(recruit, OAK, 'own', 1);
  assert.equal((await s.stores(recruit, 'deposit', OAK, 1)).status, 200, 'the hour\'s acts untouched by the refusals');
});

test('AUDIT 31 L1: the guild\'s twenty count the writs that stand - twenty past their seventh day, unswept, leave room for the next', async () => {
  clock(T0);
  const s = await stand();
  const { gm } = await s.guild(10_000);
  for (let i = 0; i < GUILD_WRITS_MAX; i++) {
    if (i === 10) clock(T0 + 3_601);
    assert.equal((await s.wpost(gm, { units: 10, pay: 1 })).status, 200);
  }
  assert.equal((await s.wpost(gm, { units: 10, pay: 1 })).body.error, 'guild-writs-max');
  clock(T0 + 3_601 + WRIT_S + 1);
  const r = await s.wpost(gm, { units: 10, pay: 1 });
  assert.equal(r.status, 200, `no Work read between: ${JSON.stringify(r.body)}`);
});

test('AUDIT 31 L9: a guild writ is posted only with the guild Stores\' room for it - what they hold and what the standing writs of the material still want', async () => {
  clock(T0);
  const s = await stand();
  const { gm, g } = await s.guild(20_000);
  s.raw.prepare(`INSERT INTO guild_prof_stores (guild_id, material, dep_player, dep_char, qty, moved_by, moved_at) VALUES (?, ?, '', '', ?, 'x', 1)`)
    .run(g.id, OAK, GUILD_STORES_MAX - 1_000);
  assert.deepEqual([(await s.wpost(gm, { units: 1_001, pay: 1 })).status, (await s.wpost(gm, { units: 1_001, pay: 1 })).body.error], [409, 'guild-stores-full']);
  const w = await s.wpost(gm, { units: 1_000, pay: 1 });
  assert.equal(w.status, 200);
  assert.equal(w.body.writ.room, 1_000, 'the writ carries the guild Stores\' room for its material');
  assert.equal((await s.wpost(gm, { units: 1, pay: 1 })).body.error, 'guild-stores-full', 'the standing writ wants the rest');
  assert.equal((await s.wpost(gm, { material: 'log:pine', units: 1, pay: 1 })).status, 200, 'another material\'s room is its own');
});

test('AUDIT 31 A15: a guild whose closed writ\'s escrow waits on a full treasury is refused its going in that word - the writ is not standing', async () => {
  clock(T0);
  const s = await stand();
  const { gm, g } = await s.guild(20_000);
  const w = (await s.wpost(gm)).body.writ;
  s.raw.prepare('UPDATE guild_marks SET balance = ? WHERE guild_id = ?').run(MARKS_MAX, g.id);
  assert.equal((await s.call('/v1/writs/withdraw', { character: gm.character, writ: w.id, rid: rid() }, gm.secret)).status, 200);
  const d = await s.call('/v1/guilds/disband', { character: gm.character }, gm.secret);
  assert.equal(d.body.error, 'guild-writ-escrow');
});

test('AUDIT 31 S7: a guild no one is left in is reclaimed for its name and tag only while it keeps nothing - never one with a writ, its Stores or its Marks', async () => {
  clock(T0);
  const s = await stand();
  const { gm, officer, member, recruit, g } = await s.guild(20_000);
  assert.equal((await s.wpost(gm)).status, 200);
  for (const p of [gm, officer, member, recruit]) s.raw.prepare('DELETE FROM players WHERE id = ?').run(p.id);   // latent: no route deletes an account
  const zed = await s.registered('Zed', { renown: 10 });
  const f = await s.found(zed, { name: 'The Hound', tag: 'HND' });
  assert.equal(f.body.error, 'guild-name-taken');
  assert.deepEqual([s.raw.prepare('SELECT COUNT(*) AS n FROM guilds WHERE id = ?').get(g.id).n, s.raw.prepare('SELECT COUNT(*) AS n FROM guild_writs WHERE guild_id = ?').get(g.id).n], [1, 1]);
  // an empty one still goes for the next founder (GUILD1's own)
  const yan = await s.registered('Yan', { renown: 10 });
  const e = (await s.found(yan, { name: 'The Empty', tag: 'EMP' })).body.guild;
  s.raw.prepare('DELETE FROM players WHERE id = ?').run(yan.id);
  const xia = await s.registered('Xia', { renown: 10 });
  const again = await s.found(xia, { name: 'The Empty', tag: 'EMP' });
  assert.deepEqual([again.status, s.raw.prepare('SELECT COUNT(*) AS n FROM guilds WHERE id = ?').get(e.id).n], [200, 0]);
});

// ─── COMMISSIONS (PROF6) ─────────────────────────────────────────────

test('AUDIT 31 L1: a crafter\'s twenty count the commissions that stand - twenty past their seventh day leave room, and the crafter\'s own Work read shows them run out', async () => {
  clock(T0);
  const s = await stand();
  const smith = await s.registered('Silverthorn');
  for (const h of ['Dora', 'Elias', 'Fenwick', 'Gilda']) {
    const w = await s.registered(h);
    s.seedMarks(w, 100);
    for (let i = 0; i < COMMISSIONS_FOR_MAX / 4; i++) assert.equal((await s.commission(w, 'Silverthorn', { pay: 1 })).status, 200);
  }
  const hollis = await s.registered('Hollis');
  s.seedMarks(hollis, 100);
  assert.equal((await s.commission(hollis, 'Silverthorn', { pay: 1 })).body.error, 'commissions-crafter-max');
  clock(T0 + WRIT_S + 1);
  const r = await s.commission(hollis, 'Silverthorn', { pay: 1 });
  assert.equal(r.status, 200, `none of the twenty stands: ${JSON.stringify(r.body)}`);
  const board = await s.list(smith);
  const states = board.body.yours.commissions.reduce((m, c) => ({ ...m, [c.state]: (m[c.state] ?? 0) + 1 }), {});
  assert.deepEqual(states, { open: 1, expired: COMMISSIONS_FOR_MAX }, 'the crafter\'s read closes what ran out');
});

test('AUDIT 31 L2: a piece of a material nothing yields yet is never commissioned - DAEDRIC-SMELT: a Daedric one is now, the forge smelting its ingot, as a Warforged one is, the sieges yielding it; CLOTH-GEMS: a graded gem\'s jewel is refused in the refusal\'s own word', async () => {
  clock(T0);
  const s = await stand();
  await s.registered('Silverthorn');
  const pia = await s.registered('Pia');
  s.seedMarks(pia, 10_000);
  // PIN MOVED (DAEDRIC-SMELT, Professions-Arc.md section 53): the Daedric Longsword was refused `commission-unyielded` - the
  // forge smelts its ingot now, and nothing waits on a yield (UNYIELDED stands empty; the heart is the loose door's)
  const r = await s.commission(pia, 'Silverthorn', { recipe: 'longsword:daedric' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  // CLOTH-GEMS: the refusal's own word stands for a piece of the loose door's - a graded gem's jewel (writLaw.js
  // commissionUnyielded), a piece no crafter could be sure of making
  const gem = await s.commission(pia, 'Silverthorn', { recipe: 'ring:silver:chipped-sapphire' });
  assert.deepEqual([gem.status, gem.body.error], [409, 'commission-unyielded']);
  assert.notEqual((await s.commission(pia, 'Silverthorn', { recipe: 'cuirass:warforged' })).body.error, 'commission-unyielded');   // PIN MOVED (AUDIT-SEATS): a siege's Spoils yield the ingot
});

test('AUDIT 31 S5: a commission\'s fill says why the piece is held - on its way to the crafter still, listed, or standing in a home', async () => {
  clock(T0);
  const s = await stand();
  const smith = await s.seated('Silverthorn'), pia = await s.registered('Pia');   // PIN MOVED (INT19): the crafter a realm character
  s.fund(smith, 10_000); s.seedMarks(pia, 10_000);
  s.piece(smith, P(9), { quality: 3 });
  const l = await s.call('/v1/market/list', { character: smith.character, region: DF, kind: 'piece', provenance: P(9), wear: 1000, price: 50, hubs: HUBS, rid: rid() }, smith.secret);
  assert.equal(l.status, 200);
  const c = (await s.commission(pia, 'Silverthorn')).body.commission;
  assert.equal((await s.fulfil(smith, c.id, P(9))).body.error, 'market-listed');
  clock(T0 + MARKET_LISTING_S + 5);
  await s.read(smith, 'mine');   // the listing's piece back as a delivery, not yet collected
  const f = await s.fulfil(smith, c.id, P(9));
  assert.deepEqual([f.status, f.body.error], [409, 'market-uncollected']);
  // INT19: and one coming to its crafter by courier (a piece of their make bought back, on the road) - a provenance
  // delivery - said the same, before the record is asked for it
  s.piece(smith, P(10), { quality: 3 });
  s.raw.prepare(`INSERT INTO market_deliveries (id, player, char_id, provenance, wear, why, from_region, arrives_at, at) VALUES ('a31roaddelivery1', ?, ?, ?, 1000, 'bought', ?, ?, ?)`)
    .run(smith.id, smith.character, P(10), DF, _now + 3600, _now);
  const save = recordOf(s.env, smith.character);
  layRecord(s.env, smith.character, { ...save, items: (save.items ?? []).filter((it) => it.provenance !== P(10)) });   // the pack holds none yet
  const g = await s.fulfil(smith, c.id, P(10));
  assert.deepEqual([g.status, g.body.error], [409, 'market-uncollected']);
});

test('AUDIT 31 U7: a commission naming this crafter carries the pieces of their make that would fill it - the recipe, at least the quality, on no sale - best-fitting (least quality) first', async () => {
  clock(T0);
  const s = await stand();
  const smith = await s.registered('Silverthorn'), pia = await s.registered('Pia');
  s.seedMarks(pia, 10_000);
  s.piece(smith, P(0x41), { quality: 4 });
  s.piece(smith, P(0x42), { quality: 2 });
  s.piece(smith, P(0x43), { quality: 1 });                          // under the quality asked
  s.piece(smith, P(0x44), { quality: 3, made: false });             // bought, not made
  s.piece(smith, P(0x45), { quality: 3, recipe: 'longsword:steel' });   // another recipe
  const c = (await s.commission(pia, 'Silverthorn')).body.commission;
  const read = (await s.list(smith)).body;
  const mine = read.commissions.find((x) => x.id === c.id);
  assert.deepEqual(mine.eligible, [{ provenance: P(0x42), quality: 2 }, { provenance: P(0x41), quality: 4 }]);
  assert.deepEqual([read.writsOpen, read.me], [true, 'Silverthorn'], 'U5, U10: the forms offered, and the reader\'s own name');
  assert.equal((await s.list(pia)).body.commissions.find((x) => x.id === c.id).eligible, undefined, 'the poster is told nothing of the crafter\'s pack');
});
