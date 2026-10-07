// AUDIT SEATS-3 (2026-10-02, Mac: "Audit everything") - THE CLIENT'S LANE: the claims
// signed by the receipt's own account (C1), a palace's Charter Room never cached as the save's when its hall lapses
// mid-visit (C2), a battle's sweeps reading the room's bodies once (C3), the frame's banner and tower lists kept (C4), a
// failed first seats read asked again (C5), the Tithe's cap words (C6), a board's own listings cap (D2), the Tithe named
// in the listing's words (D3), a crown's Saturday slot in place of the window lever (D6). `06-Systems/Online-Arc.md`
// AUDIT SEATS-3.
import './chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { byClass } from './chargenDom.mjs';
import { createTownSeatBook, SEAT_LIST_RETRY_MS, SEAT_RED_READ_MS, SEAT_LIST_CACHE_MS } from '../src/net/townSeatBook.js';
import { createHallBanners } from '../src/scenes/hallBanners.js';
import { REFUSALS, accountRefusalText } from '../src/net/accountClient.js';
import { boardTithePct, seatTitheCap, CROWN_SIEGE_SLOT } from '../src/net/townSeatLaw.js';
import { createMarketBook } from '../src/net/marketBook.js';
import { createMarketTab } from '../src/ui/marketTab.js';
import { MARKET_LISTINGS_MAX, sellerGets, saleTax } from '../src/net/marketLaw.js';
import { WEAVERS_STOCK } from '../src/net/professionLaw.js';
import { mountNoticeBoard } from '../src/ui/noticeWindow.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const tick = (n = 4) => new Promise((r) => { let i = 0; const go = () => (++i >= n ? r() : setTimeout(go, 0)); setTimeout(go, 0); });
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };

test('AUDIT SEATS-3 C1 by source: the siege\'s and the Royal Tourney\'s claims are signed by the seats\' own account (the receipt\'s `s`), never the hub\'s device id (mutants: either door back on accountId)', () => {
  const w = src('src/scenes/world.js');
  assert.match(w, /siegeClaims = createSiegeClaims\(\{ claim: \(r\) => seatBook\.claimSiege\(r\), me: \(\) => _seatDoor\?\.me\(\) \?\? null, storage: appStorage\(\),/);
  assert.match(w, /royalClaims = createRoyalClaims\(\{ claim: \(r\) => seatBook\.claimRoyal\(r\), me: \(\) => _seatDoor\?\.me\(\) \?\? null, storage: appStorage\(\),/);
  assert.doesNotMatch(w, /create(?:Siege|Royal)Claims\(\{[^\n]*me: \(\) => accountId\(\)/);
});

test('AUDIT SEATS-3 C2: a palace\'s hall lost mid-visit (the seat lapsed, the list shut) leaves the save\'s own record as it came - never the Charter Room\'s pieces or hidden list cached as the save\'s; the latch begun at the door and cleared at both teardowns (mutants: the lines back on interiorSeatHall; a latch the lapse clears)', () => {
  const m = src('src/scenes/worldModes.js');
  const halls = m.slice(m.indexOf('  function seatHallsFrame(nowMs) {'), m.indexOf('  /** CROWN-HALL: the crown seat this dungeon'));
  const decorLine = m.match(/\n(\s*const decor = interiorHome \|\| _seatHallVisit \? interiorDecor\.kept\(\) : interiorDecor\.list\(\);)/)[1];
  const hiddenLine = m.match(/\n(\s*const hiddenBase = interiorHome \|\| _seatHallVisit \? \[\.\.\._keptHidden\] : \(ctx\.base\?\.hidden\(\) \?\? \[\]\);)/)[1];
  const restoreLine = m.match(/\n(\s*if \(interiorHome \|\| _seatHallVisit\) interiorDecor\.keep\(placed\); else interiorDecor\.set\(placed\);)/)[1];
  const make = new Function('S', `
    let { mode, interiorBuilding, interiorHome, interiorSeatHall, _seatHallVisit, _hallsReadAt, host, BUILDING_TYPES, homeTownOf, loadHomeDecor, interiorDecor, _keptHidden, ctx } = S;
    let _crownTried = null, dungeonCtx = null, dungeonLoc = null; const crownHere = () => null;
    ${halls}
    return {
      frame: (t) => seatHallsFrame(t),
      enter(h) { interiorSeatHall = h; _seatHallVisit = !!interiorSeatHall; },
      get hall() { return interiorSeatHall; },
      state() { ${decorLine} ${hiddenLine} return { decor, hiddenBase }; },
      restore(placed) { ${restoreLine} },
    };`);
  let holder = { key: 1, name: 'SH', member: true, keeper: false };
  let kept = [], standing = [];
  const interiorDecor = { keep: (p) => { kept = [...p]; }, kept: () => kept, set: (p) => { standing = [...p]; }, list: () => standing };
  const S = { mode: 'interior', interiorBuilding: { buildingType: 13 }, interiorHome: null, interiorSeatHall: null, _seatHallVisit: false, _hallsReadAt: -Infinity,
    host: { seatHall: { here: () => holder } }, BUILDING_TYPES: { Palace: 13 }, homeTownOf: () => 5, loadHomeDecor: () => { standing = [{ id: 'svc-throne-rug' }]; },
    interiorDecor, _keptHidden: ['save-hidden-3'], ctx: { base: { hidden: () => ['svc-hidden-17'] } } };
  const v = make(S);
  v.enter(holder); v.restore([{ id: 'save-own' }]); standing = [{ id: 'svc-throne-rug' }];
  assert.deepEqual(v.state(), { decor: [{ id: 'save-own' }], hiddenBase: ['save-hidden-3'] }, 'while a hall: the save\'s own record back');
  holder = null;
  v.frame(10_000);
  assert.equal(v.hall, null, 'the hall read again as none');
  assert.deepEqual(v.state(), { decor: [{ id: 'save-own' }], hiddenBase: ['save-hidden-3'] }, 'lapsed mid-visit: still the save\'s own, never the service\'s pieces');
  // a restore within the same visit (a load) keeps the record, unstood
  standing = [{ id: 'svc-throne-rug' }];
  v.restore([{ id: 'save-own' }]);
  assert.deepEqual(standing, [{ id: 'svc-throne-rug' }], 'the Charter Room\'s pieces not swapped for the save\'s mid-visit');
  // a visit whose palace is known late latches it too
  const late = make({ ...S, interiorSeatHall: null, _seatHallVisit: false });
  holder = { key: 1, name: 'SH', member: false, keeper: false };
  late.frame(20_000);
  holder = null; late.frame(30_000);
  kept = [{ id: 'k' }];
  assert.deepEqual(late.state().decor, [{ id: 'k' }], 'known late, then lost: the kept record');
  // the latch: begun at the door, cleared at both teardowns
  assert.match(m, /interiorSeatHall = building\?\.buildingType === BUILDING_TYPES\.Palace \? \(host\.seatHall\?\.here\?\.\(homeTownOf\(building\)\) \?\? null\) : null;[^\n]*\n      _seatHallVisit = !!interiorSeatHall;/);
  assert.match(m, /    interiorSeatHall = null;   \/\/ SEAT-HALL\n    _seatHallVisit = false;/);
  assert.match(m, /interiorHome = null; interiorSeatHall = null; interiorOverlay = null; exteriorDoor = null; _seatHallVisit = false;/);
  assert.match(halls, /if \(h\) _seatHallVisit = true;/);
  assert.doesNotMatch(halls, /_seatHallVisit = false/, 'a lapse never unlatches it');
  assert.equal((m.match(/interiorHome \|\| interiorSeatHall\) (?:interiorDecor\.keep|_keptHidden)/g) ?? []).length, 0);
});

test('AUDIT SEATS-3 C3: a battle\'s foes\' bodies read the room once a sweep - one peersNear() for twenty foes, the same bodies as one read per foe (mutants: duelBody per foe; the relay-run fighters dropped)', () => {
  const w = src('src/scenes/world.js');
  const grab = (start, end) => w.slice(w.indexOf(start), w.indexOf(end, w.indexOf(start)));
  const duelBodySrc = w.match(/\n  (const duelBody = [^\n]*)/)[1];
  const duelBodyInSrc = w.match(/\n  (const duelBodyIn = [^\n]*)/)[1];
  const bodiesSrc = grab('  const NO_BODIES = Object.freeze([]);', '  /** My opponent');
  const arrowSrc = grab('  const duelArrowTargets = () => {', '  /** AUDIT-SEATS G5: a siege');
  let calls = 0;
  const peers = Array.from({ length: 39 }, (_, i) => `p${i}`);
  const S = {
    peersNear: () => { calls++; return peers.map((id) => ({ id, feet: [id.length, 0, 0], height: 1.8 })); },
    siegeNpcs: { body: (id) => (id === 'npc-guard' ? { id, feet: [9, 0, 9], height: 1.7, name: 'a guard' } : null) }, duelMgr: { fighting: false }, royalSession: { active: () => false }, CAPSULE_HEIGHT: 1.8,
    siegeSession: { active: () => true, foes: () => [...peers.slice(0, 19), 'npc-guard', 'gone'] },
  };
  const f = new Function('S', `const { peersNear, siegeNpcs, duelMgr, royalSession, siegeSession, CAPSULE_HEIGHT } = S; ${duelBodySrc}\n${duelBodyInSrc}\n${bodiesSrc}\n${arrowSrc}\n return { duelArrowTargets, duelBody };`)(S);
  const t = f.duelArrowTargets();
  assert.equal(calls, 1, 'one read of the room for the frame\'s arrows');
  assert.equal(t.length, 20, 'nineteen peers and the relay\'s guard; the gone one none');
  calls = 0;
  const oracle = S.siegeSession.foes().map((id) => f.duelBody(id)).filter(Boolean);
  assert.deepEqual(t.map((x) => x.ref.id), oracle.map((b) => b.id), 'the same bodies, in the same order');
  assert.deepEqual(t.map((x) => x.feet), oracle.map((b) => b.feet));
  // the melee sweep reads it once too
  const melee = grab('  const siegeMeleeHit = (eye, inViewFn) => {', '  /** SEAT2b part two (b)');
  assert.match(melee, /const near = peersNear\(\);[^\n]*\n    for \(const id of foes\) \{\n      const b = duelBodyIn\(near, id\);/);
  assert.doesNotMatch(melee + bodiesSrc, /duelBody\(id\)/);
});

test('AUDIT SEATS-3 C4: the Watchtowers\' seats filtered once a list read and guild, not each frame; the halls\' banners one kept list, refilled in place; the frame\'s banners one kept list (mutants: a filter a frame; a fresh list or banner a frame; the merge or the nearest lost)', async () => {
  let filters = 0;
  const seats = Array.from({ length: 120 }, (_, i) => ({ key: i + 1, state: 'confirmed', holder: i === 7 ? { guild: { id: 'g-mine' } } : null, forts: i === 7 ? { watchtowers: 1 } : undefined }));
  const origFilter = seats.filter.bind(seats);
  seats.filter = (...a) => { filters++; return origFilter(...a); };
  let t = 1e9;
  const book = createTownSeatBook({ door: { list: async () => ({ ok: true, data: { seats } }) }, nowMs: () => t });
  await book.read();
  for (let fr = 0; fr < 600; fr++) book.towersDue('g-mine');
  assert.equal(filters, 1, 'one filter for the read and the guild');
  assert.equal(book.towersDue('g-mine'), true);
  assert.equal(book.towersDue('g-other'), false);
  assert.equal(filters, 2, 'another guild asked: filtered again');
  t += SEAT_LIST_CACHE_MS; await book.read();
  book.towersDue('g-other');
  assert.equal(filters, 3, 'a new read: filtered again');

  const frame = { box: [0, 0, 0, 10, 5, 10], door: { a: [4, 0, 10], b: [6, 0, 10] } };
  const built = new Map([['k', { px: 1, py: 1, homeTown: 7, homeFrames: new Map([[3, frame]]) }]]);
  let tr = [0, 0, 0];
  const h = createHallBanners({ built: () => built, homes: { homeAt: () => ({ hall: { heraldry: { field: 'azure', border: 'gold', device: 'wolf' } } }), version: () => 1 }, translation: () => tr, now: () => 0 });
  const a = h.list();
  const top0 = [...a[0].top];
  tr = [100, 0, 0];
  const b = h.list();
  assert.equal(a, b, 'one kept list');
  assert.equal(a[0], b[0], 'one kept banner');
  assert.equal(b[0].top[0], top0[0] + 100, 'its top where the scene has it now');

  const w = src('src/scenes/world.js');
  const hungSrc = w.slice(w.indexOf('  const _hung = [];'), w.indexOf('  const yards = homeDecor'));
  const mk = (n, x) => Array.from({ length: n }, (_, i) => ({ id: `${x}${i}`, top: [i * (x === 'h' ? 1 : 2), 0, 0] }));
  let halls = mk(2, 'h'), seatsB = mk(1, 's');
  const run = new Function('S', `const { BANNERS_MAX, cam } = S; const hallBanners = { list: () => S.halls() }; const seatBanners = { list: () => S.seats() };\n${hungSrc}\n return bannersHung;`);
  const hung = run({ BANNERS_MAX: 4, cam: { pos: [0, 0, 0] }, halls: () => halls, seats: () => seatsB });
  const x = hung();
  assert.deepEqual(x.map((o) => o.id), ['h0', 'h1', 's0']);
  halls = mk(5, 'h'); seatsB = mk(3, 's');
  const y = hung();
  assert.equal(x, y, 'one kept list');
  assert.deepEqual(y.map((o) => o.id), ['h0', 's0', 'h1', 'h2'], 'the nearest four');
  assert.doesNotMatch(hungSrc, /\[\.\.\.|\.slice\(/);
});

test('AUDIT SEATS-3 C5: a seats\' list read that failed (a timeout, offline, the service\'s fault) is asked again by the frame every SEAT_LIST_RETRY_MS until one answers; a refusal is not; an open list still every SEAT_RED_READ_MS (mutants: only while open; no backoff)', async () => {
  let t = 1_000_000, calls = 0, answer = 'timeout';
  const door = { list: async () => { calls++; return answer === 'ok' ? { ok: true, data: { seats: [] } } : { ok: false, error: answer }; } };
  const book = createTownSeatBook({ door, nowMs: () => t });
  await book.read();
  assert.equal(SEAT_LIST_RETRY_MS, 60_000);
  t += SEAT_LIST_RETRY_MS - 1; book.redTick(); await tick();
  assert.equal(calls, 1, 'not before its backoff');
  t += 1; book.redTick(); await tick();
  assert.equal(calls, 2, 'its minute up: asked again');
  answer = 'ok';
  t += SEAT_LIST_RETRY_MS; book.redTick(); await tick();
  assert.equal(calls, 3); assert.equal(book.open, true, 'the seats open once one answers');
  t += SEAT_LIST_RETRY_MS; book.redTick(); await tick();
  assert.equal(calls, 3, 'open: the red lines\' own minutes again');
  t += SEAT_RED_READ_MS; book.redTick(); await tick();
  assert.equal(calls, 4);
  // a refusal shuts it - not asked by the frame
  let c2 = 0;
  const shut = createTownSeatBook({ door: { list: async () => { c2++; return { ok: false, error: 'seats-closed' }; } }, nowMs: () => t });
  await shut.read();
  t += 10 * SEAT_LIST_RETRY_MS; shut.redTick(); await tick();
  assert.equal(c2, 1);
  assert.equal(shut.open, false);
});

test('AUDIT SEATS-3 C6: the Tithe refused says the cap the Market Hall raises - never a bare 10% and 15% (mutant: the old words)', () => {
  const t = REFUSALS['bad-tithe'];
  assert.equal(accountRefusalText('bad-tithe'), t);
  assert.doesNotMatch(t, /at most 10% at a palace seat, 15% at a crown\.$/);
  assert.match(t, /10% at a palace and 15% at a crown, a point more for each tier of its Market Hall/);
  assert.equal(seatTitheCap({ tier: 'palace', forts: { market: 3 } }), 13);
  assert.equal(seatTitheCap({ tier: 'crown', forts: { market: 3 } }), 18);
});

const tabOver = (data, over = {}) => {
  const calls = [];
  let root = null;
  const book = {
    state: { open: true, balance: 1000, road: [], counts: {} }, pending: 0, busy: false, cached: () => null,
    read: async (view, q, o) => { calls.push(['read', view, q, o?.force === true]); return { ok: true, data: data[view] }; },
    list: async (req) => { calls.push(['list', req]); return { ok: true, data: {} }; },
    settle: async () => ({ ok: true, settled: 0 }),
    ...over.book,
  };
  const m = {
    book, stores: () => new Map([['ore:iron', { material: 'ore:iron', own: 12, bought: 3 }]]), region: 17, regionName: 'Daggerfall',
    regionNameOf: (r) => ({ 17: 'Daggerfall' })[r], hubs: {}, name: (k) => k, countName: (k) => k, pieces: () => [], take: () => true, putBack: () => {}, mint: () => {},
    pieceName: () => 'a piece', weavers: WEAVERS_STOCK, stock: async () => ({ ok: true, text: '' }), board: [205, 120], ...over.m,
  };
  const tab = createMarketTab(m, { busy: () => false, run: async (start) => { await start(); }, rerender: () => draw(), nowS: () => 0, alive: () => true });
  function draw() { root?.remove?.(); root = tab.body(); document.body.append(root); }
  return { tab, calls, book, get root() { return root; } };
};
const buttons = (root) => [...root.querySelectorAll('button')];
/** The "My listings" view drawn afresh (by way of another view). */
const mine = async (t) => {
  buttons(t.root).find((b) => b.textContent === 'Orders').onclick(); await tick();
  buttons(t.root).find((b) => b.textContent === 'My listings').onclick(); await tick();
};

test('AUDIT SEATS-3 D2: the market read names its board, the book keeps the listings its board allows (`listingsMax`, beside the counts), and the List refused and worded at that cap - the old thirty where the service says none (mutants: the static cap; the board unsent; a bad answer kept)', async () => {
  const reads = [];
  const door = { account: () => 'acct-1', read: async (b) => { reads.push(b); return { ok: true, data: { rows: [], counts: { listings: 31, orders: 0, bids: 0 }, listingsMax: reads.length === 1 ? 37 : -4 } }; } };
  const mb = createMarketBook({ door, storage: memStorage(), character: () => 'c', sleep: () => Promise.resolve() });
  assert.equal(mb.state.listingsMax, null);
  await mb.read('mine', { region: 17, board: [205, 120] });
  assert.deepEqual(reads[0].board, [205, 120]);
  assert.equal(mb.state.listingsMax, 37);
  await mb.read('mine', { region: 17, board: [206, 121] });
  assert.equal(reads.length, 2, 'another board is another read (its own cap)');
  assert.equal(mb.state.listingsMax, 37, 'a bad cap is not kept');

  const t = tabOver({ mine: { rows: [], orders: [] } });
  await t.tab.open();
  assert.deepEqual(t.calls.find((c) => c[0] === 'read')[2].board, [205, 120], 'the tab\'s read names its board');
  t.book.state.counts = { listings: 31, orders: 0 };
  t.book.state.listingsMax = 37;
  await mine(t);
  assert.doesNotMatch(t.root.textContent, /listings up - the most allowed/, 'thirty-one of a Market Hall\'s thirty-seven: not full');   // BOARD-UI (PIN MOVED): the words cut
  assert.match(t.root.textContent, /Fee \d+ silver, kept if you cancel\./);
  t.book.state.counts = { listings: 37, orders: 0 };
  await mine(t);
  assert.equal(buttons(t.root).find((b) => b.textContent === 'List').disabled, true);
  assert.match(t.root.textContent, /You have 37 listings up - the most allowed here\./);   // AUDIT 657 D7: BOARD-UI (PIN MOVED): the words cut
  t.book.state.listingsMax = null;
  t.book.state.counts = { listings: MARKET_LISTINGS_MAX, orders: 0 };
  await mine(t);
  assert.match(t.root.textContent, new RegExp(`You have ${MARKET_LISTINGS_MAX} listings up`), 'a service that says none: the old cap');   // AUDIT 657 D7: BOARD-UI (PIN MOVED): the words cut
  assert.match(accountRefusalText('market-listings-max'), /as many listings up as this board allows/);
});

test('AUDIT SEATS-3 D3: a board\'s Tithe as the seats\' list says it (its bailiwick\'s holder\'s rate, under its cap; 0 unheld; another region\'s none), and the listing\'s words name it - its rate and what the seller gets where known, the Tithe said where the list is unread (mutants: the words of 5% alone; the cap; the bailiwick)', async () => {
  const seats = [
    { key: 1, region: 17, pixel: [200, 120], tier: 'palace', holder: { guild: { id: 'g' }, tithe: 8 } },
    { key: 2, region: 17, pixel: [260, 160], tier: 'palace', holder: null },
    { key: 3, region: 23, pixel: [500, 100], tier: 'palace', holder: { guild: { id: 'h' }, tithe: 14 } },
  ];
  assert.equal(boardTithePct(seats, 17, [205, 120]), 8, 'the nearest seat of its region: held at 8%');
  assert.equal(boardTithePct(seats, 17, [258, 161]), 0, 'the unheld seat\'s bailiwick');
  assert.equal(boardTithePct(seats, 23, [500, 100]), 10, 'never over the palace\'s cap');
  assert.equal(boardTithePct([{ ...seats[2], forts: { market: 3 } }], 23, null), 13, 'a Market Hall\'s cap');
  assert.equal(boardTithePct(seats, 40, [0, 0]), 0, 'a region with no seat');
  assert.equal(boardTithePct(null, 17, null), 0);

  // BOARD-UI (PIN MOVED): the terms one line - what reaches the seller, after the tax and the Tithe where its rate is known
  for (const [pct, want] of [[8, `you get ${sellerGets(1, 8)} silver, after ${saleTax(100)}% tax and the 8% Tithe\\.`],
    [0, `you get \\d+ silver, after ${saleTax(100)}% tax\\.`], [null, 'you get \\d+ silver, after 5% tax, before any Tithe\\.']]) {
    const t = tabOver({ mine: { rows: [], orders: [] } }, { m: { tithe: () => pct } });
    await t.tab.open();
    buttons(t.root).find((b) => b.textContent === 'My listings').onclick();
    await tick();
    assert.match(t.root.textContent, new RegExp(`If it all sells ${want}`), String(pct));
  }
  const w = src('src/scenes/world.js');
  assert.match(w, /tithe: \(\) => \(seatBook\?\.open === true \? boardTithePct\(seatBook\.data\?\.seats \?\? \[\], region, \[town\.px, town\.py\]\) : null\),/);
  assert.match(src('src/ui/marketTab.js'), /You get the top bid, less \$\{less\}\$\{pct == null \? ' and any Tithe' : ''\}\./);   // AUDIT 657 D7: BOARD-UI (PIN MOVED): the terms one line
});

test('AUDIT SEATS-3 D6: at a crown the holder\'s Officer is told its Saturday slot, whatever the window, and offered no window lever; a palace\'s lever as ever (mutants: the default\'s Wednesday at a crown; the lever shown)', async () => {
  const noticeBook = { seenAt: () => null, read: async () => ({ board: { notes: [], notices: [], me: {} } }), markSeen: () => {}, cached: () => null, draft: () => ({ subject: '', body: '', days: 7, button: '' }), noticeDraft: () => ({ subject: '', body: '', days: 3 }), readGuild: async () => ({ data: null, error: 'no-guild' }) };
  const now = 1_800_000_000;
  const SH = { id: 'g1', name: 'The Silver Hand', tag: 'SH', heraldry: null };
  const mount = (seat) => {
    const host = document.createElement('div');
    const data = {
      seat, week: 6, phase: 'muster', reckoningAt: now + 3600, turningAt: now + 86400, defence: 4500,
      holder: { guild: SH, since: 3, standing: 55, tithe: 6, edict: null }, battle: null, standings: [], chronicle: [],
      mine: { guild: 'g1', rank: 1, seasoned: true, bound: 'g1', pledges: [], influence: 0, tributeRoom: 0 },
    };
    const seatBook = { open: true, standings: async () => ({ data, error: null }), window: async () => ({ ok: true, text: 'set' }) };
    mountNoticeBoard(host, { town: { name: seat.name, mapId: seat.key }, book: noticeBook, nowS: () => now, seat: { seat, book: seatBook } });
    byClass(host, 'notice-tab')[1].onclick();
    return host;
  };
  const crowns = [[{ key: 1001, name: 'Daggerfall', region: 17, tier: 'crown', pixel: [205, 120] }, 'Saturday 20:00 UTC'],
    [{ key: 1002, name: 'Wayrest', region: 23, tier: 'crown', pixel: [500, 100] }, 'Saturday 21:00 UTC'],
    [{ key: 1003, name: 'Sentinel', region: 20, tier: 'crown', pixel: [300, 300] }, 'Saturday 22:00 UTC']];
  assert.equal(CROWN_SIEGE_SLOT.wayrest.hour, 21);
  for (const [seat, when] of crowns) {
    const host = mount(seat);
    await tick();
    assert.match(host.textContent, new RegExp(`Sieges here are fought on the crown's Saturday slot, ${when}, whatever the holder's window\\.`), seat.name);
    assert.doesNotMatch(host.textContent, /Battles here are fought from Wednesday/);
    assert.equal(byClass(host, 'notice-seat-window-set').length, 0, 'no lever at a crown');
    assert.equal(byClass(host, 'notice-seat-window-day').length, 0);
  }
  const palace = mount({ key: 3021, name: 'Anticlere', region: 21, tier: 'palace', pixel: [402, 151] });
  await tick();
  assert.match(palace.textContent, /Battles here are fought from Wednesday 20:00 UTC \(the default\)\./);
  assert.equal(byClass(palace, 'notice-seat-window-set').length, 1);
});
