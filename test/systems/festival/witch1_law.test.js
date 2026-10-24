// WITCH1 (2026-10-20, bible/06-Systems/Witches-Festival.md): THE WITCHES' FESTIVAL'S LAW, the one home both ends read
// (src/net/festivalLaw.js) - its days, its nights, the finds' odds, the offerings' bounds and the Wyrd Sister's wares - and
// the token's vocabulary it grows (src/net/identityToken.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FESTIVALS, festivalAt, festivalOpen, festivalNext, FESTIVAL_NIGHTS, festivalNight, festivalEve, deadWalk, FIND_NIGHT_MULT,
  SOUL_CAKE_TEMPLATE, HEARTH_OFFERING_TEMPLATE, FIND_SOURCES, isFindSource, findCount, FIND_ASKS_PER_DAY, FIND_CAKES_PER_DAY,
  OFFERING_STOCK_MAX, OFFERING_FILL, OFFERING_TAKE, HEARTHKEEPER_GIVEN, SOULCAKE_TAKEN, WYRD_PIECE_IDS, FESTIVAL_CARD_IDS,
  FESTIVAL_ICONS, FESTIVAL_WARES, wareById, accountWare, festivalWaresHeld, SALE_RID_RE,
} from '../../../src/net/festivalLaw.js';
import { HOLIDAYS, holidayDayOfYear } from '../../../src/systems/holidayTables.js';
import * as holidays from '../../../src/systems/holidays.js';
import { TITLES, AURAS, ICONS, claimsValid } from '../../../src/net/identityToken.js';
import { readIcon } from '../../../src/net/wire.js';
import { lastDayText } from '../../../src/systems/festival/festivalWords.js';
import { OnlineSession } from '../../../src/net/online.js';
import { fakeSocketClass } from '../../fakeSocket.mjs';
import { readFileSync } from 'node:fs';

test('WITCH1 THE DAYS: 20 October to the end of 7 November 2026, a week past Halloween, on the real calendar', () => {
  assert.deepEqual(FESTIVALS.map((f) => [f.id, new Date(f.fromMs).toISOString(), new Date(f.toMs).toISOString()]),
    [['witches-2026', '2026-10-20T00:00:00.000Z', '2026-11-08T00:00:00.000Z']]);
  assert.equal(festivalOpen(Date.UTC(2026, 9, 19, 23, 59, 59)), false);
  assert.equal(festivalOpen(Date.UTC(2026, 9, 20)), true);
  assert.equal(festivalOpen(Date.UTC(2026, 9, 31, 23)), true, 'Halloween');
  assert.equal(festivalOpen(Date.UTC(2026, 10, 7, 23, 59, 59)), true, 'the last day');
  assert.equal(festivalOpen(Date.UTC(2026, 10, 8)), false, 'its end is not inside');
  assert.equal(festivalAt(NaN), null);
  assert.equal(festivalNext(Date.UTC(2026, 0, 1))?.id, 'witches-2026', 'the next to come');
  assert.equal(festivalNext(Date.UTC(2027, 0, 1)), null);
  assert.match(lastDayText(FESTIVALS[0]), /^(7 November|November 7)$/, 'the day before its end, in the player\'s language');
  assert.equal(lastDayText(null), '');
});

test('WITCH1 THE NIGHTS THE DEAD WALK: the sky\'s Witches\' Festival (13 Frostfall) and Tales and Tallows (3 Hearth Fire), each a find twice', () => {
  assert.deepEqual(FESTIVAL_NIGHTS, [HOLIDAYS.Witches_Festival, HOLIDAYS.Tales_and_Tallow]);
  assert.deepEqual(FESTIVAL_NIGHTS.map(holidayDayOfYear), [283, 243]);
  assert.equal(festivalNight(283), true);
  assert.equal(festivalNight(243), true);
  assert.equal(festivalNight(284), false);
  assert.equal(FIND_NIGHT_MULT, 2);
  assert.equal(findCount('endgame', 283), 8);
  assert.equal(findCount('endgame', 100), 4);
  assert.equal(findCount('gold', 283), 0);
  // and the festival's own night on the real calendar: 31 October, its whole UTC day (B6 - a sky's night is a real hour)
  assert.deepEqual([FESTIVALS[0].eveFromMs, FESTIVALS[0].eveToMs], [Date.UTC(2026, 9, 31), Date.UTC(2026, 10, 1)]);
  assert.deepEqual([festivalEve(Date.UTC(2026, 9, 31)), festivalEve(Date.UTC(2026, 9, 31, 23, 59)), festivalEve(Date.UTC(2026, 10, 1)), festivalEve(Date.UTC(2026, 9, 30, 23))], [true, true, false, false]);
  assert.equal(findCount('endgame', 100, Date.UTC(2026, 9, 31, 12)), 8);
  assert.equal(findCount('endgame', 283, Date.UTC(2026, 9, 31, 12)), 8, 'twice, never four times');
  assert.equal(deadWalk(100, Date.UTC(2026, 9, 25)), false);
  // the tables moved out of holidays.js are the same tables it hands on (a leaf the service can read)
  assert.equal(holidays.HOLIDAYS, HOLIDAYS);
  assert.equal(holidays.holidayDayOfYear, holidayDayOfYear);
});

test('WITCH1 THE FINDS: each source\'s odds and count, the day\'s bounds', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(FIND_SOURCES)), {
    foe: { p: 0.25, n: 1 }, undead: { p: 0.5, n: 1 }, daedra: { p: 0.5, n: 1 }, elite: { p: 1, n: 2 },
    gather: { p: 0.2, n: 1 }, make: { p: 0.3, n: 1 }, loot: { p: 0.3, n: 1 }, tavern: { p: 1, n: 2 },
    sea: { p: 0.5, n: 2 }, world: { p: 1, n: 2 }, endgame: { p: 1, n: 4 },
  });
  assert.equal(isFindSource('foe'), true);
  assert.equal(isFindSource('toString'), false, 'an own key alone');
  assert.equal(FIND_ASKS_PER_DAY, 1500);
  assert.equal(FIND_CAKES_PER_DAY, 120);
  assert.deepEqual([SOUL_CAKE_TEMPLATE, HEARTH_OFFERING_TEMPLATE], [2000, 2001]);
  assert.deepEqual([OFFERING_STOCK_MAX, OFFERING_FILL, OFFERING_TAKE, HEARTHKEEPER_GIVEN, SOULCAKE_TAKEN], [60, 10, 1, 25, 10]);
});

test('WITCH1 THE WARES: every one in the window\'s order and its price; the account\'s are a title, an aura and the icons', () => {
  assert.deepEqual(FESTIVAL_WARES.map((w) => `${w.id}=${w.price}`), [
    'title:witchwarden=60', 'aura:witchfire=150', 'icon:tallowskull=40', 'icon:twinmoons=40', 'icon:wyrdcauldron=40', 'item:offering=5',
    'piece:wyrd-hood=40', 'piece:wyrd-right-mantle=40', 'piece:wyrd-left-mantle=40', 'piece:wyrd-robe=50', 'piece:wyrd-gloves=40',
    'piece:wyrd-greaves=40', 'piece:wyrd-boots=40', 'piece:wyrd-hearthward=40', 'piece:wyrd-athame=60',
    'card:warlock=20', 'card:thaumaturge=20', 'card:glenmoril-witch=20', 'card:demonologist=20', 'card:tales-and-tallows=20', 'card:spectre-of-lysandus=45',
  ]);
  assert.equal(WYRD_PIECE_IDS.length, 9);
  assert.equal(FESTIVAL_CARD_IDS.length, 6);
  assert.deepEqual(FESTIVAL_WARES.filter(accountWare).map((w) => w.id), ['title:witchwarden', 'aura:witchfire', 'icon:tallowskull', 'icon:twinmoons', 'icon:wyrdcauldron']);
  assert.equal(wareById('piece:wyrd-athame')?.price, 60);
  assert.equal(wareById('nothing'), null);
  assert.equal(wareById(7), null);
  assert.deepEqual(festivalWaresHeld('title:witchwarden card:warlock icon:twinmoons bogus'), ['title:witchwarden', 'icon:twinmoons'], 'account wares alone, known ones alone');
  assert.deepEqual(festivalWaresHeld(null), []);
  assert.ok(SALE_RID_RE.test('0123456789ab'));
  assert.ok(!SALE_RID_RE.test('0123456789aB'));
  assert.ok(!SALE_RID_RE.test('0123456789a'));
});

test('WITCH1 THE TOKEN\'S VOCABULARY: Witchwarden and Hearthkeeper last among the titles, Witchfire last among the auras, the four icons; a claim naming an icon it does not hold is refused whole', () => {
  assert.deepEqual(TITLES.slice(-3, -1), ['witchwarden', 'hearthkeeper']);   // PIN MOVED (KETCH): the Skyfarer joined the list after them
  assert.equal(AURAS.at(-1), 'witchfire');
  assert.deepEqual(ICONS, ['tallowskull', 'twinmoons', 'wyrdcauldron', 'soulcake']);
  assert.deepEqual(FESTIVAL_ICONS, ICONS);
  const nowS = Math.floor(Date.now() / 1000);
  const base = { s: 'acct-alice', n: 'Alice', k: 'linked', i: nowS, e: nowS + 60 };
  assert.equal(claimsValid(base), true);
  assert.equal(claimsValid({ ...base, pi: 'twinmoons' }), true);
  assert.equal(claimsValid({ ...base, pi: 'pumpkin' }), false);
  assert.equal(readIcon({ pi: 'soulcake' }), 'soulcake');
  assert.equal(readIcon({ pi: 'pumpkin' }), null);
  assert.equal(readIcon(null), null);
});

test('WITCH1 THE ICON ON THE WIRE: the relay reads it off the verified token and stamps it on the introduction; my own adopted through the wire\'s reader; a peer\'s off its introduction and its newest hello, remembered across a blip', async () => {
  const relay = readFileSync(new URL('../../../server/src/index.js', import.meta.url), 'utf8');
  assert.match(relay, /glyphs: c\.g, gx: c\.gx, au: c\.au, pi: c\.pi, rb: c\.rb,/, 'the verified identity carries it');
  assert.match(relay, /au: who\.au, \.\.\.\(who\.pi \? \{ pi: who\.pi \} : \{\}\),/, 'the attached row stamps it, absent for none');
  const { FakeWS, sockets } = fakeSocketClass();
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Alice', id: 'alice-0001', secret: 'secret-of-alice-0001', WebSocketImpl: FakeWS, now: () => 1000 });
  assert.equal(s.iconOf('alice-0001'), null);
  assert.equal(s.adoptIdentity({ name: 'Alice', icon: 'twinmoons' }), true);
  assert.equal(s.iconOf('alice-0001'), 'twinmoons');
  assert.equal(s.adoptIdentity({ name: 'Alice', icon: 'pumpkin' }), true);
  assert.equal(s.pi, null, 'a word the vocabulary does not hold is none');
  const pose = { x: 1, y: 2, z: 3, yaw: 0, pitch: 0, mv: 0 };
  s.join('world:2,12', pose); sockets[0].open();
  sockets[0].receive({ t: 'welcome', id: 'alice-0001', peers: [{ id: 'peer-0002', name: 'Bobby', pi: 'tallowskull', pose }], host: null, world: null });
  assert.equal(s.iconOf('peer-0002'), 'tallowskull', 'off the introduction');
  sockets[0].receive({ t: 'join', id: 'peer-0002', name: 'Bobby', pose });
  assert.equal(s.iconOf('peer-0002'), null, 'the newest hello\'s, including none');
  sockets[0].receive({ t: 'join', id: 'peer-0002', name: 'Bobby', pi: 'soulcake', pose });
  sockets[0].receive({ t: 'leave', id: 'peer-0002' });
  assert.equal(s.iconOf('peer-0002'), 'soulcake', 'kept as a fact about an id');
  sockets[0].receive({ t: 'pose', id: 'peer-0002', p: { ...pose, x: 4 } });
  assert.equal(s.peers.get('peer-0002')?.pi, 'soulcake', 'carried onto the re-stood peer');
});
