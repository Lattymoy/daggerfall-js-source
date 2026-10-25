// AUDIT 31 (2026-09-29, Mac: "let's first do a comprehensive audit and ensure everything so far is perfect") - THE
// AUCTIONS' AND THE WRITS' LAW, AUDITED (src/net/marketLaw.js, writLaw.js): a won auction's grace for its seller's cap
// (S3); no kit a Masterwork (L9); nothing commissioned that nothing yields the stuff of (L2); a power's own name
// (L9); a member takes back their own deposit (R1); the ranks that take the guild Stores out deliver to none of its
// writs (S6); the seat week's first Sunday the online epoch's own (L8); the Tithe nought until SEAT1 writes its line
// (L5). bible/06-Systems/Online-Arc.md "AUDIT 31"; bible/06-Systems/Professions-Arc.md 18, 27, 28.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { AUCTION_S, AUCTION_GRACE_S, MARKET_TITHE_PCT, UNYIELDED, auctionable, pieceListable } from '../../src/net/marketLaw.js';
import { RECIPES, MASTERWORK } from '../../src/net/recipeLaw.js';
import { looseOnly } from '../../src/net/professionLaw.js';   // CLOTH-GEMS: the loose door's materials
import {
  SEAT_WEEK_ZERO_S, WRIT_POWERS, commissionable, commissionUnyielded, writMay, guildTakeMay, writDeliverMay,
} from '../../src/net/writLaw.js';
import { ONLINE_EPOCH_MS } from '../../src/net/wire.js';
import { GUILD_POWERS } from '../../src/net/guild/guildLaw.js';

test('AUDIT 31 S3, L9: a won auction waits seven days past its end for its seller\'s cap; no kit is a Masterwork, so none is auctioned', () => {
  assert.equal(AUCTION_GRACE_S, 7 * 86_400);
  assert.ok(AUCTION_GRACE_S > AUCTION_S);
  assert.deepEqual([auctionable('longsword:mithril', MASTERWORK), auctionable('kit:iron', MASTERWORK), auctionable('table-small:oak', MASTERWORK)], [true, false, true]);
});

test('AUDIT 31 L2: a listable piece of a material nothing yields yet - every Daedric piece, 27 - is never commissioned; every other listable piece is', () => {
  const listable = RECIPES.filter((r) => pieceListable(r.id));
  const unmade = listable.filter((r) => commissionUnyielded(r.id));
  // PIN MOVED (CLOTH-GEMS, Professions-Arc 50): and every jewel of a graded gem - the loose door's alone, so its piece fills
  // no Drakes commission (32 gems in twelve gemmed pieces and bases: 384)
  assert.equal(unmade.length, 27 + 384);   // PIN MOVED (AUDIT-SEATS): the sieges' Spoils yield the Warforged ingot (26 pieces) and Standard-bearer's Silk (76 garments) now
  assert.deepEqual([...new Set(unmade.filter((r) => r.kind !== 'jewel').map((r) => r.id.split(':')[1]))].sort(), ['daedric']);
  assert.ok(unmade.filter((r) => r.kind === 'jewel').every((r) => looseOnly(r.gem)) && unmade.filter((r) => r.kind === 'jewel').length === 384);
  assert.equal(listable.filter((r) => /:(warforged|standard)$/.test(r.id) && !commissionUnyielded(r.id)).length, 26 + 76, 'the Spoils\' pieces are commissioned');
  for (const r of unmade) assert.equal(commissionable(r.id), false, r.id);
  for (const r of listable.filter((x) => !commissionUnyielded(x.id))) assert.equal(commissionable(r.id), true, r.id);
  assert.ok(unmade.every((r) => r.inputs.some((i) => UNYIELDED.includes(i.key) || looseOnly(i.key))));
  assert.equal(commissionUnyielded('no-such'), false);
});

test('AUDIT 31 L9, R1, S6: a power by its own name; any member takes back their own deposit, the Officers and the Guildmaster any; those two ranks deliver to none of their guild\'s writs', () => {
  assert.deepEqual(['toString', 'constructor', '__proto__', 'hasOwnProperty'].map((k) => writMay(0, k)), [false, false, false, false]);
  assert.deepEqual([writMay(0, 'storesWithdraw'), writMay(1, 'storesWithdraw'), writMay(2, 'storesWithdraw')], [true, true, false]);
  // a Member and a Recruit: their own deposit, no more
  assert.deepEqual([guildTakeMay(2, 10, 10), guildTakeMay(2, 11, 10), guildTakeMay(3, 1, 0), guildTakeMay(3, 1, 1)], [true, false, false, true]);
  // an Officer, the Guildmaster: any
  assert.deepEqual([guildTakeMay(1, 5_000, 0), guildTakeMay(0, 5_000, 0)], [true, true]);
  assert.deepEqual([guildTakeMay(null, 1, 5), guildTakeMay(2, 1, null)], [false, false], 'no rank, no reading of a deposit');
  // deliveries: no rank in the writ's guild, or one that takes no guild Stores out
  assert.deepEqual([null, 0, 1, 2, 3].map(writDeliverMay), [true, false, false, true, true]);
  assert.deepEqual([...WRIT_POWERS.storesWithdraw], [0, 1]);
  assert.deepEqual([...GUILD_POWERS.withdraw], [0], 'the Marks treasury the Guildmaster\'s alone (GUILD1) - a writ delivered to by a taker would make it the Officers\'');
});

test('AUDIT 31 L8: the seat week\'s first Sunday 18:00 UTC is the online epoch\'s own - six days and eighteen hours on (Seats-Arc 3), never a second date', () => {
  assert.equal(SEAT_WEEK_ZERO_S * 1000, ONLINE_EPOCH_MS + (6 * 24 + 18) * 3_600_000);
});

test('AUDIT 31 L5: the Tithe is nought until SEAT1 - a sale and an auction\'s close write no Tithe line yet, so a Tithe above nought would leave Marks in no account (Professions-Arc 18, OPEN)', () => {
  assert.equal(MARKET_TITHE_PCT, 0, 'the default where no seat holds the bailiwick - SEAT1d takes a buy\'s and an auction\'s close\'s rate from its seat, beside its own line (test/net/seat1d_service.test.js); a writ and a commission pay none (Seats-Arc 7.2: "a writ has no fee")');
});
