// PROF5b (2026-09-29, Mac: "Go") - THE AUCTIONS' LAW (src/net/marketLaw.js, marksLaw.js): 24 hours; the next bid the
// opening while none stands, else the standing bid and its 5% rounded up, at least a Mark; a bid in the last two
// minutes adds two; a Masterwork of a listable family alone; a bid a balance's worth at most; the ledger's three new
// kinds, each a move. bible/06-Systems/Professions-Arc.md 10.2, 27.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  AUCTION_S, AUCTION_RAISE_PCT, AUCTION_LATE_S, AUCTION_ADD_S, AUCTION_BID_MAX, bidOk, auctionNext, auctionEnd, auctionable, MARKET_VIEWS,
} from '../../src/net/marketLaw.js';
import { MARKS_MAX, MARKS_KINDS } from '../../src/net/marksLaw.js';
import { MASTERWORK } from '../../src/net/recipeLaw.js';

test('PROF5b law: an auction stands 24 hours; each bid 5% over the standing one, rounded up, at least a Mark - the opening while none stands', () => {
  assert.deepEqual([AUCTION_S, AUCTION_RAISE_PCT, AUCTION_LATE_S, AUCTION_ADD_S, AUCTION_BID_MAX], [86_400, 5, 120, 120, MARKS_MAX]);
  assert.equal(auctionNext(null, 750), 750, 'the opening');
  assert.equal(auctionNext(1000, 50), 1050);
  assert.equal(auctionNext(1001, 50), 1001 + 51, 'rounded up');
  assert.equal(auctionNext(10, 5), 11, '5% of 10 is half a Mark: a whole one');
  assert.equal(auctionNext(1, 1), 2, 'at least a Mark');
  for (const h of [1, 7, 19, 20, 21, 99, 12345, 999_999]) assert.ok(auctionNext(h, 1) - h >= Math.max(1, (h * 5) / 100), String(h));
});

test('PROF5b law: a bid in the last two minutes adds two - strictly inside them, as often as bids come', () => {
  const end = 1_000_000;
  assert.equal(auctionEnd(end, end - 121), end, 'two minutes and a second before: no');
  assert.equal(auctionEnd(end, end - 120), end, 'exactly two minutes before: no');
  assert.equal(auctionEnd(end, end - 119), end + 120);
  assert.equal(auctionEnd(end, end - 1), end + 120);
  let e = end;
  for (let i = 0; i < 3; i++) e = auctionEnd(e, e - 30);
  assert.equal(e, end + 360, 'three late bids, six minutes');
});

test('PROF5b law: a Masterwork of a listable family alone is auctioned; a bid is a whole number of Marks up to a balance\'s most; the Auctions view beside Crafted; the ledger\'s new kinds each a move', () => {
  assert.equal(auctionable('longsword:mithril', MASTERWORK), true);
  assert.equal(auctionable('table-small:oak', MASTERWORK), true, 'a Masterwork table');
  assert.equal(auctionable('longsword:mithril', MASTERWORK - 1), false, 'an Exceptional one');
  assert.equal(auctionable('arrows:north', MASTERWORK), false, 'no arrows');
  assert.equal(auctionable('no-such', MASTERWORK), false);
  for (const [n, ok] of [[1, true], [MARKS_MAX, true], [0, false], [MARKS_MAX + 1, false], [1.5, false], ['5', false], [-3, false]]) assert.equal(bidOk(n), ok, String(n));
  assert.deepEqual(MARKET_VIEWS.map(([v]) => v).slice(0, 3), ['materials', 'crafted', 'auctions']);
  assert.deepEqual(['bid-escrow', 'bid-return', 'auction-sale'].map((k) => MARKS_KINDS[k]), ['move', 'move', 'move'], 'no Mark made or burnt by a bid');
});
