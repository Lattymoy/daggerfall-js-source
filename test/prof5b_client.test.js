// PROF5b (2026-09-29, Mac: "Go") - THE AUCTIONS' CLIENT: the books through the real Worker (a Masterwork posted out of
// its seller's pack, bid on from two regions, the outbid bidder's escrow back on a read, the winner's piece collected
// into their pack at its wear); the book's kept post (put back on a refusal, asked again with its own route) and its bid
// (one id a press asked again); the Market tab's Auctions view, its bar, the List form's auction and the held Marks.
// bible/06-Systems/Professions-Arc.md 27.
import './chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService, sessionStorageOf, T0 } from './accountDb.mjs';
import { accountMarket, SESSION_KEY } from '../src/net/accountClient.js';
import { createMarketBook, MARKET_KEPT_TEXT } from '../src/net/marketBook.js';
import { courierFee, roadPixels, wearOf, wearCondition, auctionNext, saleTax, AUCTION_S, listingFee } from '../src/net/marketLaw.js';
import { WEAVERS_STOCK } from '../src/net/professionLaw.js';
import { mintPiece } from '../src/systems/smithItems.js';
import { createMarketTab } from '../src/ui/marketTab.js';
import { PROF_CSS } from '../src/ui/enhancedPlusStyle.js';
import { readFileSync } from 'node:fs';

const noWait = () => Promise.resolve();
const tick = () => new Promise((r) => setTimeout(r, 0));
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
let _now = T0;
const realNow = Date.now;
const clock = (s) => { _now = s; Date.now = () => _now * 1000; };
test.after(() => { Date.now = realNow; });
const DF = 17, WR = 23;
const HUBS = { [DF]: [207, 212], [WR]: [590, 166] };
const ROAD = roadPixels({ x: 207, y: 212 }, { x: 590, y: 166 });
const PV = 'a0b1c2d3e4f5a6b7';

test('PROF5b DONE WHEN (the books): a Masterwork auctioned out of its seller\'s pack, bid on from Wayrest and outbid from Daggerfall, the outbid Marks back on a read and a late bid adding two; at its end the winner\'s book collects DFU\'s own piece at its wear', async () => {
  clock(T0);
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on' });
  const raw = s.env.DB._raw;
  const mac = await s.registered('Mac'), ann = await s.registered('Ann'), bob = await s.registered('Bob');
  s.seedMarks(mac, 100); s.seedMarks(ann, 5000); s.seedMarks(bob, 5000);
  raw.prepare(`INSERT INTO products (provenance, owner, char_id, maker, recipe, template, material, quality, seed, record, made_at)
    VALUES (?, ?, ?, 'Silverthorn', 'longsword:mithril', 120, 5, 4, 77, 'p1.x', ?)`).run(PV, mac.id, mac.character, T0);
  const sword = mintPiece({ recipe: 'longsword:mithril', quality: 4, seed: 77, maker: 'Silverthorn' }, PV);
  sword.currentCondition = Math.round(sword.maxCondition * 0.8);
  const pack = [sword];
  const bookOf = (who) => createMarketBook({ door: accountMarket({ fetch: s.fetch, storage: sessionStorageOf(SESSION_KEY, who) }), storage: memStorage(), character: () => who.character, sleep: noWait });
  const macBook = bookOf(mac), annBook = bookOf(ann), bobBook = bookOf(bob);
  const posted = await macBook.auction({ region: DF, provenance: PV, wear: wearOf(sword), opening: 500, hubs: HUBS },
    { item: sword, where: 'pack', take: () => { pack.splice(pack.indexOf(sword), 1); return true; }, putBack: (it) => pack.push(it) });
  assert.equal(posted.ok, true, JSON.stringify(posted));
  assert.deepEqual([pack.length, posted.data.auction.wear, macBook.state.balance], [0, 800, 100 - listingFee(500)], 'out of the save, its wear, the fee');
  const id = posted.data.auction.id;
  // Ann bids from Wayrest: its courier held with it
  const rows = (await annBook.read('auctions', { region: WR, hubs: HUBS })).data.rows;
  assert.deepEqual(rows.map((r) => [r.id, r.next, r.road.courier]), [[id, 500, courierFee(1, ROAD)]]);
  assert.equal((await annBook.bid({ region: WR, auction: id, amount: 500, hubs: HUBS })).ok, true);
  assert.equal(annBook.state.balance, 5000 - 500 - courierFee(1, ROAD));
  // Bob outbids from Daggerfall; Ann's next read has her Marks back
  const b = await bobBook.bid({ region: DF, auction: id, amount: auctionNext(500, 500), hubs: HUBS });
  assert.equal(b.ok, true, JSON.stringify(b));
  await annBook.read('mine', { region: WR, hubs: HUBS }, { force: true });
  assert.deepEqual([annBook.state.balance, annBook.state.held], [5000, 0]);
  await bobBook.read('mine', { region: DF, hubs: HUBS }, { force: true });
  assert.deepEqual([bobBook.state.held, bobBook.state.counts.bids], [525, 1], 'what his bid holds');
  // a late bid from Ann adds two minutes; Bob answers; the end passes
  clock(b.data.auction.endsAt - 30);
  const late = await annBook.bid({ region: WR, auction: id, amount: auctionNext(525, 500), hubs: HUBS });
  assert.equal(late.data.auction.endsAt, b.data.auction.endsAt + 120);
  const last = await bobBook.bid({ region: DF, auction: id, amount: auctionNext(late.data.auction.high, 500), hubs: HUBS });
  assert.equal(last.ok, true, JSON.stringify(last));
  clock(last.data.auction.endsAt);
  // Bob's tab settles: the piece arrived (here, at once) and is minted into his pack at its wear
  const bobPack = [];
  const mint = (piece) => { const it = mintPiece(piece, piece.provenance); it.currentCondition = wearCondition(it.maxCondition, piece.wear); bobPack.push(it); };
  await bobBook.read('auctions', { region: DF, hubs: HUBS }, { force: true });
  assert.equal((await bobBook.settle(mint, () => {})).settled, 1);
  const [got] = bobPack;
  assert.deepEqual([got.provenance, got.quality, got.maker, got.currentCondition], [PV, 4, 'Silverthorn', wearCondition(got.maxCondition, 800)]);
  assert.equal(raw.prepare('SELECT owner FROM products WHERE provenance = ?').get(PV).owner, bob.id);
  const win = last.data.auction.high;
  await macBook.read('mine', { region: DF, hubs: HUBS }, { force: true });
  assert.equal(macBook.state.balance, 100 - listingFee(500) + win - saleTax(win), 'the seller paid the bid less its tax');
  clock(T0);
});

test('PROF5b book: an auction post is kept - out of the pack before it is asked, put back on a refusal, asked again by the settle on its own route; a bid\'s id kept for a press asked again; a bid another overtook forgets the view', async () => {
  const storage = memStorage();
  let online = false, answer = 'ok';
  const routes = [], bidIds = [];
  const door = {
    account: () => 'acct-1',
    auction: async (b) => { routes.push(['auction', b.rid]); return !online ? { ok: false, error: 'offline' } : answer === 'ok' ? { ok: true, data: { auction: { id: 'A1' } } } : { ok: false, error: answer }; },
    list: async (b) => { routes.push(['list', b.rid]); return { ok: true, data: {} }; },
    bid: async (b) => { bidIds.push(b.rid); return online ? { ok: true, data: { bid: { id: 'B' } } } : { ok: false, error: 'offline' }; },
    read: async () => { routes.push(['read']); return { ok: true, data: { rows: [] } }; },
  };
  const book = createMarketBook({ door, storage, character: () => 'c', sleep: noWait });
  const pack = [{ provenance: PV }];
  const item = pack[0];
  const piece = { item, where: 'pack', take: () => { pack.splice(0, 1); return true; }, putBack: (it) => pack.push(it) };
  const r = await book.auction({ region: DF, provenance: PV, wear: 900, opening: 5 }, piece);
  assert.deepEqual([r.kept, r.text, pack.length, book.pending], [true, MARKET_KEPT_TEXT, 0, 1]);
  online = true; answer = 'auction-not-masterwork';
  await book.settle(() => {}, (it) => pack.push(it));
  assert.deepEqual([pack.length, book.pending], [1, 0], 'refused: back in the pack');
  assert.deepEqual(routes.filter((x) => x[0] !== 'read').map((x) => x[0]), ['auction', 'auction', 'auction', 'auction'], 'its own route, never a listing\'s');
  // a bid lost on the wire, pressed again: the same id
  online = false;
  await book.bid({ region: DF, auction: 'A1', amount: 50 });
  online = true;
  await book.bid({ region: DF, auction: 'A1', amount: 50 });
  assert.equal(new Set(bidIds).size, 1, 'one id');
  // a bid another overtook: the minute's cache let go
  await book.read('auctions', { region: DF, hubs: {} });
  const reads = routes.filter((x) => x[0] === 'read').length;
  door.bid = async () => ({ ok: false, error: 'auction-low' });
  await book.bid({ region: DF, auction: 'A1', amount: 60 });
  await book.read('auctions', { region: DF, hubs: {} });
  assert.equal(routes.filter((x) => x[0] === 'read').length, reads + 1, 'read again at once');
});

test('PROF5b tab: Auctions - each Masterwork\'s standing bid, bids and end, where and its courier; the picked row\'s Bid at the next bid (a typed amount pressed, no redraw), the leader\'s word, the seller\'s Cancel; the List form\'s auction of Masterworks alone, its terms; My listings\' auctions and bids; the held Marks', async () => {
  const piece = (q) => ({ provenance: PV, recipe: 'longsword:mithril', quality: q, seed: 1, maker: 'Silverthorn', marked: q === 4, wear: 900 });
  const data = {
    auctions: { rows: [
      { id: 'A', kind: 'auction', region: DF, opening: 500, high: null, bids: 0, next: 500, endsAt: 7200, at: 0, state: 'open', mine: false, leading: false, road: { courier: 0, seconds: 0, road: 0 }, piece: piece(4) },
      { id: 'B', kind: 'auction', region: WR, opening: 100, high: 300, bids: 3, next: 315, endsAt: 90_000, at: 0, state: 'open', mine: false, leading: true, road: { courier: 17, seconds: 3300, road: 386 }, piece: piece(4) },
      { id: 'C', kind: 'auction', region: DF, opening: 50, high: null, bids: 0, next: 50, endsAt: 600, at: 0, state: 'open', mine: true, leading: false, road: { courier: 0, seconds: 0, road: 0 }, piece: piece(4) },
    ] },
    mine: { rows: [], orders: [],
      auctions: [{ id: 'C', kind: 'auction', region: DF, opening: 50, high: null, bids: 0, next: 50, endsAt: 600, state: 'open', mine: true, piece: piece(4) },
        { id: 'D', kind: 'auction', region: DF, opening: 50, high: 900, bids: 4, next: 945, endsAt: 0, state: 'sold', mine: true, piece: piece(4) }],
      bids: [{ id: 'b1', auction: 'B', amount: 300, courier: 17, state: 'high', returned: false, auctionState: 'open', endsAt: 90_000, piece: piece(4) },
        { id: 'b2', auction: 'E', amount: 80, courier: 0, state: 'outbid', returned: false, auctionState: 'open', endsAt: 9_000, piece: piece(4) }] },
  };
  const calls = [], reads = [];
  let root = null, redraws = 0;
  const book = {
    state: { open: true, balance: 1000, road: [], counts: {}, held: 397 }, pending: 0, busy: false, cached: () => null,
    read: async (view) => { reads.push(view); return { ok: true, data: data[view] ?? { rows: [] } }; },
    bid: async (req) => { calls.push(['bid', req]); return { ok: true, data: {} }; },
    cancel: async (id) => { calls.push(['cancel', id]); return { ok: true, data: {} }; },
    auction: async (req) => { calls.push(['auction', req]); return { ok: true, data: {} }; },
    settle: async () => ({ ok: true, settled: 0 }),
  };
  const masterwork = { provenance: PV, quality: 4, name: 'x' }, plain = { provenance: 'ffffffffffffffff', quality: 2 };
  const m = {
    book, stores: () => new Map(), region: DF, regionName: 'Daggerfall', regionNameOf: (r) => ({ 17: 'Daggerfall', 23: 'Wayrest' })[r], hubs: {},
    name: (k) => k, countName: (k) => k, pieces: () => [{ item: plain, where: 'pack', name: 'Fine Sword' }, { item: masterwork, where: 'pack', name: 'Silverthorn\'s Mithril Longsword' }],
    take: () => true, putBack: () => {}, mint: () => {}, pieceName: () => 'Silverthorn\'s Mithril Longsword', weavers: WEAVERS_STOCK, stock: async () => ({ ok: true }),
  };
  const words = [];
  const tab = createMarketTab(m, { busy: () => false, run: async (start) => { const r = await start(); words.push(r?.text); }, rerender: () => { redraws++; draw(); }, nowS: () => 0, alive: () => true });
  function draw() { root?.remove?.(); root = tab.body(); document.body.append(root); }
  await tab.open();
  const buttons = () => [...root.querySelectorAll('button')];
  buttons().find((b) => b.textContent === 'Auctions').onclick();
  await tick();
  const text = () => root.textContent;
  assert.match(text(), /Silverthorn's Mithril LongswordMasterwork · made by Silverthorn · worn to 90%opening 500 silver - no bids yethere · ends in 2 hours/);
  assert.match(text(), /300 silver \(3 bids\)Wayrest \+17 courier, \d+ minutes · ends in 25 hoursyour bid leads/);
  // the first: Bid at the next, a typed amount pressed with no redraw
  buttons().find((b) => b.textContent.includes('no bids yet')).onclick();
  assert.match(text(), /Bid 500 silver\? At least 500 silver\./);
  const n = [...root.querySelectorAll('input')].find((i) => i.getAttribute('data-focus') === 'bid|A');
  const before = redraws;
  n.value = '640'; n.oninput();
  assert.equal(redraws, before);
  assert.match(text(), /Bid 640 silver\?/);
  await buttons().find((b) => b.textContent === 'Bid').onclick();
  assert.deepEqual(calls.at(-1), ['bid', { region: DF, auction: 'A', amount: 640, hubs: {} }]);
  assert.match(words.at(-1), /Your bid of 640 silver leads/);
  // another bid came first: its word, and the view read again at once - the new next on the row
  book.bid = async (req) => { calls.push(['bid', req]); return { ok: false, error: 'auction-low' }; };
  data.auctions.rows[0] = { ...data.auctions.rows[0], high: 520, bids: 1, next: 546 };
  buttons().find((b) => b.textContent.includes('no bids yet')).onclick();
  const readsBefore = reads.length;
  await buttons().find((b) => b.textContent === 'Bid').onclick();
  await tick();
  assert.equal(reads.length, readsBefore + 1, 'read again');
  assert.match(words.at(-1), /Another bid came first\. The next bid is higher now\./);
  assert.match(text(), /520 silver \(1 bid\)/);
  book.bid = async (req) => { calls.push(['bid', req]); return { ok: true, data: {} }; };
  // the leader's word; the seller's Cancel while no bid stands
  buttons().find((b) => b.textContent.includes('your bid leads')).onclick();
  assert.match(text(), /Your bid of 300 silver leads\. It is held until you are outbid or the auction ends\./);
  assert.equal(buttons().some((b) => b.textContent === 'Bid'), false);
  buttons().find((b) => b.textContent.includes('opening 50 silver')).onclick();
  await buttons().find((b) => b.textContent === 'Cancel').onclick();
  assert.deepEqual(calls.at(-1), ['cancel', 'C']);
  // My listings: the auction form offers the Masterwork alone; the auctions and the bids
  buttons().find((b) => b.textContent === 'My listings').onclick();
  await tick();
  const kind = [...root.querySelectorAll('select')].find((x) => x.getAttribute('aria-label') === 'What to list');
  kind.value = 'auction'; kind.onchange();
  const pick = [...root.querySelectorAll('select')].find((x) => x.getAttribute('aria-label') === 'Crafted piece');
  assert.deepEqual([...pick.querySelectorAll('option')].map((o) => o.textContent), ['Silverthorn\'s Mithril Longsword']);
  assert.match(text(), new RegExp(`Runs ${AUCTION_S / 3600} hours on every board; each bid beats the last by 5%, and a bid in the last 2 minutes adds 2\\.`));   // AUDIT 31 L4, L7: strictly less, the add its own number; BOARD-UI (PIN MOVED)
  await buttons().find((b) => b.textContent === 'List').onclick();
  assert.deepEqual(calls.at(-1)[0], 'auction');
  assert.equal(calls.at(-1)[1].provenance, PV);
  assert.match(text(), /Your auctionsSilverthorn's Mithril Longswordopening 50 silver - no bids yetends in 10 minutes/);
  assert.match(text(), /900 silver \(4 bids\)sold for 900 silver/);
  assert.match(text(), /Your bidsSilverthorn's Mithril Longsword - 300 silver \+ 17 courier - leading - ends in 25 hours/);
  assert.match(text(), /80 silver - outbid - your silver comes back at the next look/);   // AUDIT 31 U13
  assert.match(text(), /Your silver: 1,000 silver \(397 silver held in bids\)/);
});

test('PROF5b wiring: the two routes behind a session and in the Worker\'s table, their refusals\' statuses; the door\'s two calls; the auction row dressed', () => {
  const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
  assert.match(src('server-account/src/service.js'), /'\/v1\/market\/remove', '\/v1\/market\/auction', '\/v1\/market\/bid',/);
  const idx = src('server-account/src/index.js');
  assert.match(idx, /'\/v1\/market\/auction': \(\) => marketAuction\(ctx, who\.player, env, body\)/);
  assert.match(idx, /'\/v1\/market\/bid': \(\) => marketBid\(ctx, who\.player, env, body\)/);
  assert.match(idx, /'auction-not-masterwork': 409, 'auction-low': 409, 'auction-leading': 409, 'auction-bid-standing': 409/);
  const door = accountMarket({ fetch: async () => ({}), storage: memStorage() });
  assert.deepEqual([typeof door.auction, typeof door.bid], ['function', 'function']);
  assert.match(PROF_CSS, /\.market-auction \{ grid-template-columns: minmax\(0, 1\.6fr\) minmax\(0, 1\.2fr\) auto; \}/);
  assert.match(PROF_CSS, /\.market-auction \.market-where \{ grid-column: 1 \/ -1; \}/);
});
