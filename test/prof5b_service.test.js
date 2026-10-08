// PROF5b (2026-09-29, Mac: "Go") - TIMED AUCTIONS FOR MASTERWORKS AS THE SERVICE KEEPS THEM: a Masterwork posted at
// an opening bid for 24 hours, the fee burnt; each bid 5% over the standing one, escrowed with its courier; the
// standing bid outbid and its escrow back on its bidder's read; a bid in the last two minutes adding two; the auction
// closed by anyone's read - the winner's piece theirs, the seller paid the bid less its tax, the escrow emptied; unsold,
// cancelled and removed; the refusals, the repeats, the thirty. Driven through the real Worker over node:sqlite with
// every migration applied (test/accountDb.mjs). bible/06-Systems/Professions-Arc.md 27.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService, T0 } from './accountDb.mjs';
import { MARKS_MAX } from '../src/net/marksLaw.js';
import { runCron, CRON_MINUTE } from '../server-account/src/cron.js';
import { SETTLE_MAX } from '../server-account/src/market.js';
import {
  AUCTION_S, AUCTION_ADD_S, MARKET_LISTINGS_MAX, listingFee, saleTax, courierFee, courierSeconds, roadPixels, auctionNext,
} from '../src/net/marketLaw.js';

let _now = T0;
const realNow = Date.now;
const clock = (s) => { _now = s; Date.now = () => _now * 1000; };
test.after(() => { Date.now = realNow; });
clock(T0);
let _rid = 0;
const rid = () => `auc-${String(++_rid).padStart(6, '0')}`;
const DF = 17, WR = 23;
const HUBS = { [DF]: [207, 212], [WR]: [590, 166] };
const ROAD = roadPixels({ x: 207, y: 212 }, { x: 590, y: 166 });
const P = (n) => n.toString(16).padStart(16, '0');

async function stand(extra = {}) {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on', DEVELOPER_HANDLES: 'Mac', MODERATOR_HANDLES: 'Asynian', ...extra });
  const raw = s.env.DB._raw;
  const balance = (who) => Number(raw.prepare('SELECT balance FROM marks WHERE account = ?').get(who.id)?.balance ?? 0);
  const fund = (who, marks) => raw.prepare('INSERT INTO marks (account, balance) VALUES (?, ?) ON CONFLICT (account) DO UPDATE SET balance = excluded.balance').run(who.id, marks);
  /** A crafted piece this account owns, as the anvil writes it - a Masterwork unless said. */
  const piece = (who, provenance, { recipe = 'longsword:mithril', quality = 4 } = {}) => raw.prepare(`INSERT INTO products
    (provenance, owner, char_id, maker, recipe, template, material, quality, seed, record, made_at) VALUES (?, ?, ?, 'Silverthorn', ?, 120, 5, ?, 4242, 'p1.x', ?)`)
    .run(provenance, who.id, who.character, recipe, quality, _now);
  const owner = (p) => raw.prepare('SELECT owner, listed FROM products WHERE provenance = ?').get(p);
  const read = (who, view, extra = {}) => s.call('/v1/market/read', { character: who.character, region: DF, view, hubs: HUBS, ...extra }, who.secret);
  const post = (who, provenance, opening, extra = {}) => s.call('/v1/market/auction', { character: who.character, region: DF, provenance, wear: 900, opening, hubs: HUBS, rid: rid(), ...extra }, who.secret);
  const bid = (who, auction, amount, extra = {}) => s.call('/v1/market/bid', { character: who.character, region: DF, auction, amount, hubs: HUBS, rid: rid(), ...extra }, who.secret);
  /** The escrow the standing and unreturned bids hold, against the ledger's escrow end (in less out). */
  const escrowHeld = () => Number(raw.prepare(`SELECT COALESCE(SUM(amount + courier), 0) AS s FROM market_bids WHERE state = 'high' OR (state IN ('outbid', 'void') AND returned = 0)`).get().s);
  const escrowLedger = () => {
    const r = raw.prepare(`SELECT COALESCE(SUM(CASE WHEN dst_kind = 'escrow' THEN amount END), 0) AS i, COALESCE(SUM(CASE WHEN src_kind = 'escrow' THEN amount END), 0) AS o
      FROM marks_ledger WHERE kind IN ('bid-escrow', 'bid-return', 'auction-sale') OR (src_kind = 'escrow' AND kind IN ('market-tax', 'courier'))`).get();
    return Number(r.i) - Number(r.o);
  };
  return { ...s, raw, balance, fund, piece, owner, read, post, bid, escrowHeld, escrowLedger };
}

// ─── THE DONE-WHEN ───────────────────────────────────────────────────

test('PROF5b DONE WHEN: a Masterwork posted in Daggerfall is bid on from Wayrest and from Daggerfall - the Wayrest bid outbid and its escrow back on its bidder\'s read, a bid in the last two minutes adding two - and at its end the Daggerfall bidder\'s piece is theirs, the seller paid the bid less its tax; disenchanted after, its auction and bids still in "My listings" (AUDIT PROF-541 R2-S4)', async () => {
  clock(T0);
  const s = await stand();
  const mac = await s.registered('Mac'), ann = await s.registered('Ann'), bob = await s.registered('Bob');
  for (const w of [mac, ann, bob]) s.fund(w, 100_000);
  const PV = P(0xa1);
  s.piece(mac, PV);
  const posted = await s.post(mac, PV, 1000);
  assert.equal(posted.status, 200, JSON.stringify(posted.body));
  const a = posted.body.auction;
  assert.deepEqual([a.opening, a.high, a.bids, a.next, a.endsAt - a.at, a.mine], [1000, null, 0, 1000, AUCTION_S, true]);
  assert.deepEqual([s.balance(mac), { ...s.owner(PV) }], [100_000 - listingFee(1000), { owner: mac.id, listed: 1 }], 'the fee burnt, the piece off the save');
  // Ann bids from Wayrest: the bid and its courier held
  const c = courierFee(1, ROAD);
  const b1 = await s.bid(ann, a.id, 1000, { region: WR });
  assert.equal(b1.status, 200, JSON.stringify(b1.body));
  assert.deepEqual([b1.body.bid.amount, b1.body.bid.courier, b1.body.bid.state, s.balance(ann)], [1000, c, 'high', 100_000 - 1000 - c]);
  // Bob bids from Daggerfall, 5% over: Ann outbid - her escrow back on her own read
  assert.equal(auctionNext(1000, 1000), 1050);
  const b2 = await s.bid(bob, a.id, 1050);
  assert.equal(b2.status, 200, JSON.stringify(b2.body));
  assert.deepEqual([b2.body.bid.courier, b2.body.auction.high, b2.body.auction.bids, b2.body.auction.leading], [0, 1050, 2, true]);
  assert.equal(s.balance(ann), 100_000 - 1000 - c, 'held until her read');
  const annRead = await s.read(ann, 'mine');
  assert.equal(s.balance(ann), 100_000, 'back');
  assert.deepEqual(annRead.body.bids.map((x) => [x.amount, x.state, x.returned]), [[1000, 'outbid', true]]);
  assert.equal(s.escrowHeld(), s.escrowLedger());
  // two minutes from the end, Ann bids again from Wayrest: the end moves two minutes on
  const end = b2.body.auction.endsAt;
  clock(end - 60);
  const b3 = await s.bid(ann, a.id, auctionNext(1050, 1000), { region: WR });
  assert.equal(b3.status, 200, JSON.stringify(b3.body));
  assert.equal(b3.body.auction.endsAt, end + AUCTION_ADD_S, 'a bid in the last 2 minutes adds 2');
  // Bob answers in the new last two minutes: two more
  clock(end + 30);
  const b4 = await s.bid(bob, a.id, auctionNext(b3.body.auction.high, 1000));
  assert.equal(b4.status, 200, JSON.stringify(b4.body));
  assert.equal(b4.body.auction.endsAt, end + 2 * AUCTION_ADD_S);
  const win = b4.body.auction.high;
  // past its end: anyone's read closes it
  clock(end + 2 * AUCTION_ADD_S);
  const macBefore = s.balance(mac);
  await s.read(ann, 'auctions');
  assert.deepEqual({ ...s.raw.prepare('SELECT state, returned FROM market_auctions WHERE id = ?').get(a.id) }, { state: 'sold', returned: 1 });
  assert.equal(s.balance(mac), macBefore + win - saleTax(win), 'the bid less its tax');
  assert.equal(s.owner(PV).owner, bob.id);
  // Bob collects it here, at once (no courier from his own region)
  const road = (await s.read(bob, 'mine')).body.road.filter((d) => d.kind === 'piece');
  assert.deepEqual(road.map((d) => [d.why, d.ready, d.piece.provenance]), [['bought', true, PV]]);
  const got = await s.call('/v1/market/collect', { character: bob.character, delivery: road[0].id, rid: rid() }, bob.secret);
  assert.deepEqual([got.status, got.body.piece.provenance, got.body.piece.quality, got.body.piece.wear], [200, PV, 4, 900]);
  assert.equal(s.balance(bob), 100_000 - win, 'the winner paid his bid');
  await s.read(ann, 'mine');
  assert.equal(s.balance(ann), 100_000, 'the loser whole');
  assert.equal(s.escrowHeld(), 0);
  assert.equal(s.escrowLedger(), 0, 'every Mark held came out');
  // "Your trades": the Marks each moved
  const trades = (await s.read(mac, 'history')).body.trades;
  assert.deepEqual(trades.filter((t) => t.side === 'auctioned').map((t) => t.total), [win - saleTax(win)]);
  assert.deepEqual((await s.read(bob, 'history')).body.trades.filter((t) => t.side === 'won').map((t) => t.total), [win]);
  // AUDIT PROF-541 R2-S4: Bob disenchants it (its products row gone) - the auction and his bids stay in "My listings",
  // named by the disenchant's recipe
  const gone = await s.call('/v1/prof/disenchant', { character: bob.character, provenance: PV, rid: rid() }, bob.secret);
  assert.equal(gone.status, 200, JSON.stringify(gone.body));
  assert.equal(s.owner(PV), undefined, 'the row gone');
  const macMine = (await s.read(mac, 'mine')).body.auctions.filter((x) => x.id === a.id);
  assert.deepEqual(macMine.map((x) => [x.state, x.piece.provenance, x.piece.recipe]), [['sold', PV, 'longsword:mithril']], 'the seller\'s auction kept');
  const bobBids = (await s.read(bob, 'mine')).body.bids.filter((x) => x.auction === a.id);
  assert.deepEqual(bobBids.map((x) => [x.piece.provenance, x.piece.recipe]), [[PV, 'longsword:mithril'], [PV, 'longsword:mithril']], 'the winner\'s bids kept');
});

// ─── THE REFUSALS ────────────────────────────────────────────────────

test('PROF5b service: only a Masterwork of a listable family, its owner\'s, on no other sale; the seller never bids, the leader never again, a bid under the next refused; the thirty count auctions; an auctioned piece is no listing', async () => {
  clock(T0);
  const s = await stand();
  const mac = await s.registered('Mac'), ann = await s.registered('Ann');
  s.fund(mac, 100_000); s.fund(ann, 5_000);
  s.piece(mac, P(1), { quality: 3 });
  assert.equal((await s.post(mac, P(1), 100)).body.error, 'auction-not-masterwork');
  s.piece(mac, P(2), { recipe: 'arrows:north' });
  assert.equal((await s.post(mac, P(2), 100)).body.error, 'market-not-listable');
  s.piece(ann, P(3));
  assert.equal((await s.post(mac, P(3), 100)).body.error, 'market-not-yours');
  assert.equal((await s.post(mac, P(4), 100)).body.error, 'market-no-record', 'no such piece (AUDIT 31 H1: its own word)');
  s.piece(mac, P(5));
  const listed = await s.call('/v1/market/list', { character: mac.character, region: DF, kind: 'piece', provenance: P(5), wear: 1000, price: 50, hubs: HUBS, rid: rid() }, mac.secret);
  assert.equal(listed.status, 200);
  assert.equal((await s.post(mac, P(5), 100)).body.error, 'market-listed', 'a listed piece is no auction');
  // a piece whose listing expired but is not back yet (its seller has not read since) is still on that sale
  s.piece(mac, P(7));
  assert.equal((await s.call('/v1/market/list', { character: mac.character, region: DF, kind: 'piece', provenance: P(7), wear: 1000, price: 50, hubs: HUBS, rid: rid() }, mac.secret)).status, 200);
  clock(T0 + 72 * 3600);
  s.raw.prepare(`UPDATE market_listings SET state = 'expired', closed_at = ? WHERE provenance = ?`).run(_now, P(7));
  // MARKET-AUDIT (PIN MOVED: `market-listed`): an auction posted settles first, as a listing does - the listing past its hours
  // is closed and its piece a delivery to collect, said so; refused either way, never two of it
  assert.equal((await s.post(mac, P(7), 100)).body.error, 'market-uncollected', 'auctioned while its return was still to come - two of it');
  clock(T0);
  s.piece(mac, P(6));
  const a = (await s.post(mac, P(6), 100)).body.auction;
  const again = await s.call('/v1/market/list', { character: mac.character, region: DF, kind: 'piece', provenance: P(6), wear: 1000, price: 50, hubs: HUBS, rid: rid() }, mac.secret);
  assert.equal(again.body.error, 'market-listed', 'an auctioned piece is no listing');
  assert.equal((await s.bid(mac, a.id, 100)).body.error, 'market-own');
  assert.equal((await s.bid(ann, a.id, 99)).body.error, 'auction-low');
  assert.equal((await s.bid(ann, a.id, 6000)).body.error, 'marks-short');
  assert.equal((await s.bid(ann, a.id, 100)).status, 200);
  assert.equal((await s.bid(ann, a.id, 200)).body.error, 'auction-leading');
  assert.equal((await s.bid(mac, 'nosuchauction', 100)).body.error, 'market-gone');
  clock(T0 + AUCTION_S);
  const late = await s.registered('Late');
  s.fund(late, 10_000);
  assert.equal((await s.bid(late, a.id, 1000)).body.error, 'market-gone', 'ended, though no read has closed it');
  // the thirty: 28 listings and the auction; one more of either and no more
  clock(T0);
  const t = await stand();
  const ten = await t.registered('Ten');
  t.fund(ten, 1_000_000);
  for (let i = 0; i < MARKET_LISTINGS_MAX - 1; i++) {
    t.piece(ten, P(0x100 + i), { quality: 2 });
    assert.equal((await t.call('/v1/market/list', { character: ten.character, region: DF, kind: 'piece', provenance: P(0x100 + i), wear: 1000, price: 5, hubs: HUBS, rid: rid() }, ten.secret)).status, 200);
  }
  t.piece(ten, P(0x200)); t.piece(ten, P(0x201)); t.piece(ten, P(0x202), { quality: 2 });
  assert.equal((await t.post(ten, P(0x200), 10)).status, 200, 'the thirtieth');
  assert.equal((await t.post(ten, P(0x201), 10)).body.error, 'market-listings-max');
  assert.equal((await t.call('/v1/market/list', { character: ten.character, region: DF, kind: 'piece', provenance: P(0x202), wear: 1000, price: 5, hubs: HUBS, rid: rid() }, ten.secret)).body.error,
    'market-listings-max', 'an auction is among the thirty');
  const counts = (await t.read(ten, 'mine')).body.counts;
  assert.equal(counts.listings, MARKET_LISTINGS_MAX);
});

// ─── UNSOLD, CANCELLED, REMOVED ──────────────────────────────────────

test('PROF5b service: an auction with no bid closes unsold and its piece comes back on its seller\'s read; cancelled while none stands (the fee kept), never after; a moderator\'s removal voids the standing bid and returns the piece', async () => {
  clock(T0);
  const s = await stand();
  const mac = await s.registered('Mac'), ann = await s.registered('Ann'), mod = await s.registered('Asynian');
  s.fund(mac, 10_000); s.fund(ann, 10_000); s.fund(mod, 10);
  s.piece(mac, P(10)); s.piece(mac, P(11)); s.piece(mac, P(12));
  const unsold = (await s.post(mac, P(10), 100)).body.auction;
  // cancel: while none stands, the piece answered back, the fee kept
  const c = (await s.post(mac, P(11), 500)).body.auction;
  const crid = rid();
  const cancelled = await s.call('/v1/market/cancel', { character: mac.character, listing: c.id, rid: crid }, mac.secret);
  assert.deepEqual([cancelled.status, cancelled.body.piece?.provenance, cancelled.body.auction?.state], [200, P(11), 'cancelled']);
  assert.deepEqual({ ...s.owner(P(11)) }, { owner: mac.id, listed: 0 });
  const twice = await s.call('/v1/market/cancel', { character: mac.character, listing: c.id, rid: crid }, mac.secret);
  assert.deepEqual([twice.body.repeat, twice.body.piece?.provenance], [true, P(11)], 'asked twice, one');
  const r = (await s.post(mac, P(12), 200)).body.auction;
  assert.equal((await s.bid(ann, r.id, 200)).status, 200);
  assert.equal((await s.call('/v1/market/cancel', { character: mac.character, listing: r.id, rid: rid() }, mac.secret)).body.error, 'auction-bid-standing');
  // a moderator removes it: the bid void, its escrow back on Ann's read; the piece back on Mac's
  assert.equal((await s.call('/v1/market/report', { listing: r.id }, ann.secret)).status, 200);
  const view = await s.read(mod, 'auctions');
  assert.equal(view.body.rows.find((x) => x.id === r.id).reports, 1, 'counted for the moderators');
  assert.equal((await s.call('/v1/market/remove', { listing: r.id }, mod.secret)).status, 200);
  assert.equal(s.balance(ann), 10_000 - 200);
  await s.read(ann, 'mine');
  assert.equal(s.balance(ann), 10_000, 'the voided bid returned');
  // the unsold one past its end
  clock(T0 + AUCTION_S);
  const mine = await s.read(mac, 'mine');
  const back = mine.body.road.filter((d) => d.kind === 'piece').map((d) => [d.why, d.piece.provenance]).sort();
  assert.deepEqual(back, [['returned', P(10)], ['returned', P(12)]]);
  assert.deepEqual(mine.body.auctions.filter((x) => x.id === unsold.id).map((x) => x.state), ['unsold']);
  assert.equal(s.escrowHeld(), s.escrowLedger());
});

// AUDIT SCALE (its mutation run over market.js: PROF5b-svc-listed-auctioned survived on the audited head). The clock
// closes an unbid auction while its seller is away (SCALE4b), and the piece stays on that sale - `listed` - until a read
// of the seller's brings it back, SETTLE_MAX a read. An open listing and an open auction each have a guard of their own
// in the post's decision; a piece still owed back has `listed = 0` alone, and the one pin of it posted a listed piece.
// Without it the piece went up again while its return was owed - sold, and back to its seller as well: two of it.
test('PROF5b service: a piece whose auction closed unsold is on that sale until it is back - with more returns owed than a read makes (SETTLE_MAX), the one still owed is refused another auction (`market-listed`) and no second auction stands; once back, it is a delivery to collect (AUDIT SCALE; mutant: the decision\'s `listed = 0` dropped)', async () => {
  clock(T0);
  const s = await stand();
  const mac = await s.registered('Mac');
  s.fund(mac, 100_000);
  const pv = (i) => P(0x300 + i);
  for (let i = 0; i < SETTLE_MAX; i++) {
    s.piece(mac, pv(i));
    assert.equal((await s.post(mac, pv(i), 100)).status, 200);
  }
  // the last an hour after the rest, so the clock closes it after them
  const last = pv(SETTLE_MAX);
  clock(T0 + 3600);
  s.piece(mac, last);
  assert.equal((await s.post(mac, last, 100)).status, 200);
  // nobody bids; the clock closes every one while Mac is away, the last a minute past its own end
  for (let k = 1; k <= 10; k++) await runCron(s.env, { cron: CRON_MINUTE, nowS: T0 + AUCTION_S + 60 * k });
  await runCron(s.env, { cron: CRON_MINUTE, nowS: T0 + 3600 + AUCTION_S + 60 });
  const owed = () => s.raw.prepare("SELECT provenance FROM market_auctions WHERE seller = ? AND state = 'unsold' AND returned = 0 ORDER BY provenance").all(mac.id).map((r) => r.provenance);
  assert.equal(owed().length, SETTLE_MAX + 1, 'all closed unsold, none back yet');
  assert.ok(s.raw.prepare("SELECT MAX(closed_at) AS m FROM market_auctions WHERE provenance != ?").get(last).m
    < s.raw.prepare('SELECT closed_at FROM market_auctions WHERE provenance = ?').get(last).closed_at, 'the last closed last');
  // Mac posts the last again: the post's own settle brings back the twenty closed first, and the last is still owed
  clock(T0 + 3600 + AUCTION_S + 120);
  assert.equal((await s.post(mac, last, 100)).body.error, 'market-listed', 'still on the sale that closed');
  assert.deepEqual(owed(), [last]);
  assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM market_auctions WHERE provenance = ? AND state = 'open'").get(last).n, 0, 'no second auction of it');
  assert.equal(s.owner(last).listed, 1);
  // Mac's next read brings it back: a delivery to collect, refused an auction as one
  await s.read(mac, 'mine');
  assert.deepEqual(owed(), []);
  assert.equal(s.owner(last).listed, 0);
  assert.equal((await s.post(mac, last, 100)).body.error, 'market-uncollected');
});

// ─── THE LEDGER'S LINES, THE REPEATS, THE CAP ────────────────────────

test('PROF5b service: a bid asked twice is one; an auction\'s fee is `:afee`, never a listing\'s `:fee` under the same id; two bids at once, one stands; a sale the seller\'s cap cannot take waits', async () => {
  clock(T0);
  const s = await stand();
  const mac = await s.registered('Mac'), ann = await s.registered('Ann'), bob = await s.registered('Bob');
  s.fund(mac, 10_000); s.fund(ann, 10_000); s.fund(bob, 10_000);
  s.piece(mac, P(20)); s.piece(mac, P(21), { quality: 2 });
  const R = rid();
  const l = await s.call('/v1/market/list', { character: mac.character, region: DF, kind: 'piece', provenance: P(21), wear: 1000, price: 50, hubs: HUBS, rid: R }, mac.secret);
  assert.equal(l.status, 200);
  const a = await s.post(mac, P(20), 1000, { rid: R });
  assert.equal(a.status, 200, `one id, two sales' fees: ${JSON.stringify(a.body)}`);
  const id = a.body.auction.id;
  const B = rid();
  const first = await s.bid(ann, id, 1000, { rid: B });
  const second = await s.bid(ann, id, 1000, { rid: B });
  assert.deepEqual([second.body.repeat, second.body.bid.id], [true, first.body.bid.id]);
  assert.equal(s.balance(ann), 9_000, 'held once');
  const cid = await s.registered('Cid');
  s.fund(cid, 10_000);
  // two bids of the same next at once: each read the same standing bid; the first to decide stands, the other is refused.
  // Staged, not hoped for: Bob's decision waits while Cid's whole bid lands, so Bob decides on the standing bid he read.
  const prep = s.env.DB.prepare.bind(s.env.DB), batch = s.env.DB.batch.bind(s.env.DB);
  let cidFirst = null;
  s.env.DB.prepare = (sql) => Object.assign(prep(sql), { _sql: sql });
  s.env.DB.batch = async (list) => {
    if (cidFirst && list.some((st) => /UPDATE market_auctions SET high/.test(st._sql ?? ''))) { const go = cidFirst; cidFirst = null; await go(); }
    return batch(list);
  };
  let y;
  cidFirst = async () => { y = await s.bid(cid, id, 1050); };
  const x = await s.bid(bob, id, 1050);
  s.env.DB.prepare = prep; s.env.DB.batch = batch;
  assert.deepEqual([y.status, x.status], [200, 409], JSON.stringify([y.body, x.body]));
  assert.equal(x.body.error, 'auction-low');
  assert.equal((await s.read(bob, 'auctions')).body.rows.find((r) => r.id === id).next, 1050 + 53, 'Bob\'s re-read: the next bid now');
  assert.equal(s.raw.prepare('SELECT high FROM market_auctions WHERE id = ?').get(id).high, 1050);
  assert.equal(s.balance(bob), 10_000, 'nothing of Bob\'s held');
  assert.equal(Number(s.raw.prepare(`SELECT COUNT(*) AS n FROM market_bids WHERE auction = ? AND state = 'high'`).get(id).n), 1);
  // the seller's cap: the close waits until there is room
  s.fund(mac, MARKS_MAX);
  clock(T0 + AUCTION_S + 1);
  await s.read(ann, 'auctions');
  assert.equal(s.raw.prepare('SELECT state FROM market_auctions WHERE id = ?').get(id).state, 'open', 'the seller could not take it');
  s.fund(mac, 0);
  await s.read(ann, 'auctions');
  assert.equal(s.raw.prepare('SELECT state FROM market_auctions WHERE id = ?').get(id).state, 'sold');
  assert.equal(s.balance(mac), 1050 - saleTax(1050));
});

test('PROF5b service: the Auctions view - every open auction ending soonest first, its courier to this board, the next bid, whether this reader leads; the courier\'s time on a won piece from another region', async () => {
  clock(T0);
  const s = await stand();
  const mac = await s.registered('Mac'), ann = await s.registered('Ann');
  s.fund(mac, 10_000); s.fund(ann, 10_000);
  s.piece(mac, P(30)); s.piece(mac, P(31));
  const far = (await s.post(mac, P(30), 300, { region: WR })).body.auction;
  clock(T0 - 3600);
  const near = (await s.post(mac, P(31), 200)).body.auction;
  clock(T0);
  assert.equal((await s.bid(ann, far.id, 300)).status, 200);
  const rows = (await s.read(ann, 'auctions')).body.rows;
  assert.deepEqual(rows.map((r) => [r.id, r.region, r.road.courier, r.next, r.leading, r.mine]), [
    [near.id, DF, 0, 200, false, false], [far.id, WR, courierFee(1, ROAD), auctionNext(300, 300), true, false]]);
  assert.equal(rows[1].piece.quality, 4);
  clock(T0 + AUCTION_S);
  await s.read(mac, 'auctions');
  const road = (await s.read(ann, 'mine')).body.road.filter((d) => d.kind === 'piece');
  assert.deepEqual(road.map((d) => [d.why, d.ready, d.arrivesAt - (T0 + AUCTION_S), d.from]), [['bought', false, courierSeconds(ROAD), WR]]);
  assert.equal(Number(s.raw.prepare("SELECT amount FROM marks_ledger WHERE kind = 'courier' AND src_kind = 'escrow'").get()?.amount), courierFee(1, ROAD), 'the courier burnt from the escrow');
  assert.deepEqual([s.escrowHeld(), s.escrowLedger()], [0, 0]);
});
