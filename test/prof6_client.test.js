// PROF6 (2026-09-29, Mac: "continue") - GUILD WRITS, THE GUILD STORES AND COMMISSIONS, THE CLIENT: the books through the
// real Worker (a guild writ posted and supplied, the guild Stores read and withdrawn, a commission filled out of the
// crafter's pack and collected into the poster's by the market's book); the writs' book's kept fill (put back on a
// refusal, asked again with its own id, dropped from the save on a late yes), its ids, its one act at a time and what
// its answers tell the other books; the Work tab's guild writs, commissions, "Yours" and forms, and the note's button;
// the Guild tab's Stores and budget; the wiring, and the Court writ's word (FOUND). bible/06-Systems/Professions-Arc.md 28.
import './chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { byClass } from './chargenDom.mjs';
import { standService, sessionStorageOf, T0 } from './accountDb.mjs';
import { accountWrits, accountMarket, SESSION_KEY, REFUSALS } from '../src/net/accountClient.js';
import { createWritBook, WRIT_KEPT_TEXT } from '../src/net/writBook.js';
import { createMarketBook } from '../src/net/marketBook.js';
import { saleTax, wearOf } from '../src/net/marketLaw.js';
import { materialCountLabel } from '../src/systems/profItems.js';
import { mintPiece, pieceOfRecipe } from '../src/systems/smithItems.js';
import { mountNoticeBoard } from '../src/ui/noticeWindow.js';
import { commissionPieceText, writLeftText } from '../src/ui/workTab.js';
import { GuildBook } from '../src/net/guildBook.js';
import { createSocialPanel } from '../src/ui/socialPanel.js';
import { SocialState } from '../src/net/social.js';
import { GUILD_RANK_NAMES } from '../src/net/guildLaw.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const noWait = () => Promise.resolve();
const tick = () => new Promise((r) => setTimeout(r, 0));
const ticks = async (n = 4) => { for (let i = 0; i < n; i++) await tick(); };
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
let _now = T0;
const realNow = Date.now;
const clock = (s) => { _now = s; Date.now = () => _now * 1000; };
test.after(() => { Date.now = realNow; });
const DF = 17, WR = 23;
const OAK = 'log:oak';
const PV = 'c0ffee00c0ffee01';

test('PROF6 DONE WHEN (the books): a Guildmaster\'s writ posted and an outsider\'s delivery paid, the logs in the guild Stores and withdrawn bought; a commission filled out of the crafter\'s pack and collected into the poster\'s, DFU\'s own piece, its owner moved', async () => {
  clock(T0);
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on' });
  const raw = s.env.DB._raw;
  const gm = await s.registered('Aldric', { renown: 10 }), out = await s.registered('Oswin');
  s.seedMarks(gm, 10_000);
  const g = (await s.found(gm, { name: 'The Hound', tag: 'HND' })).body.guild;
  assert.equal((await s.call('/v1/marks/guild/deposit', { character: gm.character, marks: 1_000, rid: 'seedrid-0001' }, gm.secret)).status, 200);
  raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, 'own', 40)`).run(out.id, out.character, OAK);
  const told = { marks: [], stores: [] };
  const bookOf = (who) => createWritBook({ door: accountWrits({ fetch: s.fetch, storage: sessionStorageOf(SESSION_KEY, who) }), storage: memStorage(),
    character: () => who.character, sleep: noWait, marks: { set: (n) => told.marks.push([who.handle, n]) }, stores: { apply: (st) => told.stores.push([who.handle, st]) } });
  const gmBook = bookOf(gm), outBook = bookOf(out);
  const p = await gmBook.post({ region: DF, material: OAK, units: 40, pay: 3 });
  assert.equal(p.ok, true, JSON.stringify(p));
  const d = await outBook.supply({ region: DF, writ: p.data.writ.id, units: 40 });
  assert.equal(d.ok, true, JSON.stringify(d));
  assert.deepEqual(told.marks.at(-1), ['Oswin', 120 - saleTax(120)], 'the Drakes book told the balance');
  assert.deepEqual(told.stores.at(-1), ['Oswin', { material: OAK, own: 0, bought: 0 }], 'the professions\' book told the Stores');
  assert.equal((await gmBook.guildStores()).ok, true);
  assert.deepEqual(gmBook.state.guildStores.rows, [{ material: OAK, qty: 40, mine: 0 }]);
  assert.equal((await gmBook.budget(90)).ok, true);
  assert.deepEqual(gmBook.state.writBudget, { budget: 90, spent: 0, left: 90 });
  const w = await gmBook.withdrawStores(OAK, 40);
  assert.deepEqual([w.ok, told.stores.at(-1)], [true, ['Aldric', { material: OAK, own: 0, bought: 40 }]]);
  assert.deepEqual(gmBook.state.guildStores.rows, [], 'the answer\'s Stores, emptied');
  // THE COMMISSION
  const smith = await s.registered('Silverthorn'), ann = await s.registered('Ann');
  s.seedMarks(ann, 2_000);
  raw.prepare(`INSERT INTO products (provenance, owner, char_id, maker, recipe, template, material, quality, seed, record, made_at)
    VALUES (?, ?, ?, 'Silverthorn', 'longsword:mithril', 120, 5, 3, 77, 'p1.x', ?)`).run(PV, smith.id, smith.character, T0);
  raw.prepare(`INSERT INTO prof_crafts (player, rid, char_id, recipe, quality, count, provenance, seed, xp, first, at, n)
    VALUES (?, 'craft-00000001', ?, 'longsword:mithril', 3, 1, ?, 77, 10, 0, ?, 'n')`).run(smith.id, smith.character, PV, T0);
  const annBook = bookOf(ann), smithBook = bookOf(smith);
  const c = await annBook.commission({ region: DF, crafter: 'Silverthorn', recipe: 'longsword:mithril', quality: 2, pay: 900 });
  assert.equal(c.ok, true, JSON.stringify(c));
  const sword = mintPiece({ recipe: 'longsword:mithril', quality: 3, seed: 77, maker: 'Silverthorn' }, PV);
  const pack = [sword];
  const f = await smithBook.fulfil({ region: DF, commission: c.data.commission.id, provenance: PV, wear: wearOf(sword) },
    { item: sword, where: 'pack', take: () => { pack.splice(0, 1); return true; }, putBack: (it) => pack.push(it) });
  assert.equal(f.ok, true, JSON.stringify(f));
  assert.deepEqual([pack.length, smithBook.pending, told.marks.at(-1)], [0, 0, ['Silverthorn', 900 - saleTax(900)]]);
  // Ann's market book collects it into her pack
  const annMarket = createMarketBook({ door: accountMarket({ fetch: s.fetch, storage: sessionStorageOf(SESSION_KEY, ann) }), storage: memStorage(), character: () => ann.character, sleep: noWait });
  await annMarket.read('mine', { region: DF, hubs: {} });
  const annPack = [];
  assert.equal((await annMarket.settle((piece) => annPack.push(mintPiece(piece, piece.provenance)), () => {})).settled, 1);
  assert.deepEqual([annPack[0].provenance, annPack[0].quality, annPack[0].maker], [PV, 3, 'Silverthorn']);
  assert.equal(raw.prepare('SELECT owner FROM products WHERE provenance = ?').get(PV).owner, ann.id);
});

test('PROF6 the writs\' book: a fill keeps its piece out of the save until answered - put back on a refusal, asked again with its own id on silence, dropped from the save on a late yes; every other act\'s id kept for a press asked again; one act at a time', async () => {
  const calls = [];
  let answer = { ok: false, error: 'offline' };
  const door = {
    account: () => 'acct',
    fulfil: async (body) => { calls.push(['fulfil', body.rid, body.commission]); return answer; },
    supply: async (body) => { calls.push(['supply', body.rid]); return answer; },
    post: async () => new Promise(() => {}),   // never answers
  };
  const storage = memStorage();
  const book = createWritBook({ door, storage, character: () => 'char-a', sleep: noWait });
  const pack = [{ provenance: PV }];
  const piece = { item: pack[0], where: 'pack', take: () => { pack.splice(0, 1); return true; }, putBack: (it) => pack.push(it) };
  const r = await book.fulfil({ region: DF, commission: 'K1', provenance: PV, wear: 1000 }, piece);
  assert.deepEqual([r.kept, r.text, pack.length, book.pending], [true, WRIT_KEPT_TEXT, 0, 1], 'silence: kept, out of the save');
  const rid = book._kept()[0].rid;
  // a refusal on the ask itself: straight back into the pack
  const pack2 = [{ provenance: 'c0ffee00c0ffee02' }];
  answer = { ok: false, error: 'commission-worn' };
  const no = await book.fulfil({ region: DF, commission: 'K9', provenance: pack2[0].provenance, wear: 1000 },
    { item: pack2[0], where: 'pack', take: () => { pack2.splice(0, 1); return true; }, putBack: (it) => pack2.push(it) });
  assert.deepEqual([no.error, pack2.length, book.pending], ['commission-worn', 1, 1], 'put back; the first still kept');
  answer = { ok: false, error: 'offline' };
  assert.equal(book.ridOk(rid), true);
  // a refusal on the settle: put back
  answer = { ok: false, error: 'commission-piece' };
  const back = [];
  assert.equal((await book.settle((it) => back.push(it))).settled, 1);
  assert.deepEqual([back.length, book.pending], [1, 0]);
  assert.equal(calls.filter((c) => c[0] === 'fulfil' && c[2] === 'K1').every((c) => c[1] === rid), true, 'one id throughout');
  // a late yes: the piece dropped from the save (it may have been kept since it was taken)
  pack.push({ provenance: PV });
  answer = { ok: false, error: 'offline' };
  await book.fulfil({ region: DF, commission: 'K2', provenance: PV, wear: 1000 }, { ...piece, item: pack[0] });
  answer = { ok: true, data: { commission: { id: 'K2' } } };
  const dropped = [];
  await book.settle(() => {}, (it) => dropped.push(it.provenance));
  assert.deepEqual([dropped, book.pending], [[PV], 0]);
  // a supply lost on the wire, pressed again: the same id; answered, a new one next time
  answer = { ok: false, error: 'offline' };
  await book.supply({ region: DF, writ: 'W1', units: 5 });
  answer = { ok: true, data: {} };
  await book.supply({ region: DF, writ: 'W1', units: 5 });
  await book.supply({ region: DF, writ: 'W1', units: 5 });
  const ids = calls.filter((c) => c[0] === 'supply').map((c) => c[1]);
  assert.equal(new Set(ids.slice(0, 4)).size, 1, 'the silence and its re-press one id');
  assert.notEqual(ids.at(-1), ids[0], 'a new press after an answer is a new act');
  // one act at a time
  const hung = book.post({ region: DF, material: OAK, units: 1, pay: 1 });
  assert.deepEqual(await book.supply({ region: DF, writ: 'W2', units: 1 }), { ok: false, error: 'writ-busy' });
  assert.equal(REFUSALS['writ-busy'].length > 0, true);
  void hung;
});

// ─── THE WORK TAB ────────────────────────────────────────────────────

const noticesStub = (notes = []) => ({
  seenAt: () => null, read: async () => ({ board: { notes, notices: [], me: { canPin: true } } }), markSeen() {}, cached: () => null,
  draft: () => ({ subject: '', body: '', days: 7, button: '' }), noticeDraft: () => ({ subject: '', body: '', days: 3 }),
});
function workRig({ data, pieces = [], notes = [] } = {}) {
  const calls = [];
  let reads = 0;
  const profBook = {
    state: { open: true, writs: { today: 0, max: 3 } }, held: (k) => (k === OAK ? 50 : 0),
    writs: async () => { reads++; return { data, error: null, stale: false }; },
  };
  const writs = {
    busy: false,
    supply: async (req) => { calls.push(['supply', req]); return { ok: true, data: { fill: { pay: 114, tax: 6 } } }; },
    withdraw: async (id) => { calls.push(['withdraw', id]); return { ok: true, data: {} }; },
    decline: async (id) => { calls.push(['decline', id]); return { ok: true, data: {} }; },
    cancel: async (id) => { calls.push(['cancel', id]); return { ok: true, data: {} }; },
    post: async (req) => { calls.push(['post', req]); return { ok: true, data: {} }; },
    commission: async (req) => { calls.push(['commission', req]); return { ok: true, data: {} }; },
    fulfil: async (req, piece) => { calls.push(['fulfil', req, piece.name]); return { ok: true, data: {} }; },
    settle: async () => ({ ok: true, settled: 0 }),
  };
  const host = document.createElement('div');
  const v = mountNoticeBoard(host, {
    town: { name: 'Daggerfall', mapId: 5 }, book: noticesStub(notes), answer: () => ({ ok: true }),
    work: {
      book: profBook, region: DF, regionName: 'Daggerfall', countName: (k, n) => materialCountLabel(k, n), writs,
      regionNameOf: (r) => ({ 17: 'Daggerfall', 23: 'Wayrest' })[r], pieces: () => pieces, settle: () => writs.settle(),
    },
  });
  return { host, v, calls, reads: () => reads };
}
const DAY = 86_400;
const boardData = () => ({
  writs: [], today: { filled: 0, max: 3 },
  guildWrits: [
    { id: 'W1', kind: 'guild', guild: { id: 'g1', name: 'The Silver Hand', tag: 'SH' }, region: DF, material: OAK, units: 800, left: 280, pay: 3, escrow: 840, at: 0, expiresAt: T0 + 5 * DAY, state: 'open', mine: false, may: true },
    { id: 'W2', kind: 'guild', guild: { id: 'g2', name: 'The Hound', tag: 'HND' }, region: DF, material: OAK, units: 10, left: 10, pay: 1, escrow: 10, at: 0, expiresAt: T0 + 2 * DAY, state: 'open', mine: false, may: false },
  ],
  commissions: [
    { id: 'K1', kind: 'commission', region: DF, recipe: 'longsword:mithril', quality: 2, pay: 900, poster: 'Ann', crafter: 'Silverthorn', at: 0, expiresAt: T0 + 5 * DAY, state: 'open', mine: false, forMe: true, returned: false },
    { id: 'K2', kind: 'commission', region: DF, recipe: 'kit:iron', quality: null, pay: 40, poster: 'Me', crafter: 'Bran', at: 0, expiresAt: T0 + 6 * DAY, state: 'open', mine: true, forMe: false, returned: false },
  ],
  yours: {
    commissions: [
      { id: 'K3', kind: 'commission', region: WR, recipe: 'table-small:oak', quality: 1, pay: 60, poster: 'Me', crafter: 'Joiner', at: 0, expiresAt: T0 + DAY, state: 'withdrawn', mine: true, forMe: false, returned: true },
    ],
    guildWrits: [{ id: 'W9', kind: 'guild', guild: { id: 'g1', name: 'The Silver Hand', tag: 'SH' }, region: WR, material: OAK, units: 50, left: 50, pay: 2, escrow: 100, at: 0, expiresAt: T0 + 3 * DAY, state: 'open', mine: true, may: true }],
  },
  guild: { id: 'g1', name: 'The Silver Hand', tag: 'SH', rank: 1, mayPost: true, marks: 5_000, budget: 500, spent: 120, left: 380 },
  balance: 1_234,
  writsOpen: true, me: 'Me',   // AUDIT 31 U5, U10: the service's word that they are this account's, and its name
});

test('PROF6 the Work tab: this region\'s guild writs under the guild blue (Deliver a number typed with no redraw, Withdraw where the rank may) and commissions under the green (the crafter\'s Fill with a piece of their make, and Decline; the poster\'s Withdraw); "Yours" every region; a press reads the list again', async () => {
  clock(T0);
  const sword = { item: { provenance: PV, quality: 3 }, where: 'pack', name: 'Silverthorn\'s Mithril Longsword', take: () => true, putBack() {} };
  // AUDIT 31 S6: the reader of another guild than the writs' - a guild's own Officers deliver to none of its writs
  const { host, v, calls, reads } = workRig({ data: { ...boardData(), guild: { ...boardData().guild, id: 'g3' } }, pieces: [sword] });
  await ticks();
  byClass(host, 'notice-tab')[1].click();
  await ticks();
  const cards = byClass(host, 'notice-writ');
  assert.deepEqual(cards.map((c) => c.className.match(/seal-\w+/)[0]), ['seal-guild', 'seal-guild', 'seal-commission', 'seal-commission']);
  assert.match(cards[0].textContent, /Guild writThe Silver Hand \[SH\] needs 280 more Oak Logs/);
  assert.match(cards[0].textContent, /Pays 3 silver each - 520 \/ 800 delivered/);
  assert.match(cards[0].textContent, /5 days left/);
  assert.match(cards[0].textContent, /50 in your Stores/);
  assert.equal(byClass(cards[1], 'work-withdraw').length, 0, 'another guild\'s: no Withdraw');
  // Deliver a typed number: its words move, no redraw
  const n = cards[0].querySelectorAll('input').find((i) => i.getAttribute('data-focus') === 'supply|W1');
  n.value = '40'; n.oninput();
  const go = byClass(cards[0], 'work-deliver')[0];
  assert.equal(go.textContent, 'Deliver 40');
  const before = reads();
  go.click();
  await ticks();
  // BAG1 (PIN MOVED): and the writ's material, so the host puts in what the Stores lack of it from the bag and the pack first
  assert.deepEqual(calls.at(-1), ['supply', { region: DF, writ: 'W1', units: 40, material: 'log:oak' }]);
  assert.ok(reads() > before, 'the list read again');
  assert.match(host.textContent, /Delivered 40 Oak Logs: 114 silver struck to your account \(6 silver tax taken\)\./, 'AUDIT 31 U13: never "114 less 6"');
  // the commission for me: Fill with the piece picked, and Decline
  const mineCard = byClass(host, 'notice-writ')[2];
  assert.match(mineCard.textContent, /For Silverthorn only: a Mithril Longsword, Fine or better/);
  assert.match(mineCard.textContent, /Pays 900 silver - from Ann/);
  byClass(mineCard, 'work-fill')[0].click();
  await ticks();
  assert.deepEqual(calls.at(-1), ['fulfil', { region: DF, commission: 'K1', provenance: PV, wear: 1000 }, 'Silverthorn\'s Mithril Longsword']);
  byClass(byClass(host, 'notice-writ')[2], 'work-decline')[0].click();   // AUDIT 31 U11: armed by the first press
  await ticks();
  assert.notDeepEqual(calls.at(-1), ['decline', 'K1']);
  byClass(byClass(host, 'notice-writ')[2], 'work-decline')[0].click();
  await ticks();
  assert.deepEqual(calls.at(-1), ['decline', 'K1']);
  // my own commission: Withdraw; a kit asks no quality
  const kit = byClass(host, 'notice-writ')[3];
  assert.match(kit.textContent, /For Bran only: an Iron Repair Kit/);
  assert.doesNotMatch(kit.textContent, /or better/);
  byClass(kit, 'work-withdraw')[0].click();
  await ticks();
  assert.deepEqual(calls.at(-1), ['cancel', 'K2']);
  // Yours, every region
  const yours = byClass(host, 'work-yours')[0];
  assert.match(yours.textContent, /You commissioned Joiner: a Small Oak Table, Standard or better, 60 silver/);
  assert.match(yours.textContent, /Wayrest · withdrawn - silver back/);
  assert.match(yours.textContent, /The Silver Hand \[SH\]: 50 more Oak Logs, 2 silver each/);
  v.unmount();
  // a commission naming me elsewhere: in Yours, filled at its own region's boards (AUDIT 31 U4 - a card is always this
  // region's); no piece of my make: said so
  const d2 = boardData();
  d2.yours.commissions.push({ ...d2.commissions[0], region: WR });
  d2.commissions.shift();
  const r2 = workRig({ data: d2, pieces: [] });
  await ticks(); byClass(r2.host, 'notice-tab')[1].click(); await ticks();
  assert.match(byClass(r2.host, 'work-yours')[0].textContent, /Ann commissioned you: a Mithril Longsword, Fine or better, 900 silverWayrest · 5 days leftFilled at the boards of Wayrest\./);
  r2.v.unmount();
  const r3 = workRig({ data: boardData(), pieces: [] });
  await ticks(); byClass(r3.host, 'notice-tab')[1].click(); await ticks();
  assert.match(byClass(r3.host, 'notice-writ')[2].textContent, /You carry no unworn piece of your own make for it\./);   // BOARD-UI (PIN MOVED)
  r3.v.unmount();
});

test('PROF6 the Work tab\'s forms: an Officer\'s guild writ - the escrow, the pay\'s most, the budget left said, Post past them not offered; Commission a piece - the family\'s recipes, the least quality where one is taken; the note\'s "Commission a piece" opens it with its author named', async () => {
  clock(T0);
  const { host, v, calls } = workRig({ data: boardData() });
  await ticks();
  byClass(host, 'notice-tab')[1].click();
  await ticks();
  const open = (label) => byClass(host, 'work-open').find((b) => b.textContent === label);
  open('Post a guild writ').click();
  const form = () => byClass(host, 'work-form')[0];
  assert.match(form().textContent, /Post a guild writ - The Silver Hand \[SH\]/);
  const field = (key) => form().querySelectorAll('input').find((i) => i.getAttribute('data-focus') === key);
  field('writ|units').value = '100'; field('writ|units').oninput();
  field('writ|pay').value = '3'; field('writ|pay').oninput();
  assert.match(form().textContent, /Holds 300 silver of the treasury's 5,000 silver for up to 7 days\./);   // BOARD-UI (PIN MOVED): the terms one line
  assert.match(form().textContent, /At most 3 silver each\./);
  assert.match(form().textContent, /Your writ budget this week: 380 silver of 500 silver left\./);
  field('writ|units').value = '200'; field('writ|units').oninput();
  assert.equal(byClass(form(), 'work-post')[0].disabled, true, '600 is past the 380 left');
  field('writ|units').value = '100'; field('writ|units').oninput();
  byClass(form(), 'work-post')[0].click();
  await ticks();
  assert.deepEqual(calls.at(-1), ['post', { region: DF, material: OAK, units: 100, pay: 3 }]);
  // Commission a piece
  open('Commission a piece').click();
  assert.match(form().textContent, /Commission a piece/);
  const selects = () => form().querySelectorAll('select');
  assert.ok(selects()[1].children.some((o) => o.value === 'longsword:mithril'), 'the weapons');
  assert.equal(selects()[1].children.some((o) => o.value.startsWith('arrows')), false, 'never arrows');
  const who = field('comm|crafter');
  assert.equal(byClass(form(), 'work-post')[0].disabled, true, 'no crafter, no commission');
  who.value = 'Silverthorn'; who.oninput();
  field('comm|pay').value = '900'; field('comm|pay').oninput();
  assert.match(form().textContent, /The crafter gets it, less 45 silver tax, for an unworn piece they made\./);   // BOARD-UI (PIN MOVED)
  byClass(form(), 'work-post')[0].click();
  await ticks();
  assert.deepEqual(calls.at(-1), ['commission', { region: DF, crafter: 'Silverthorn', recipe: 'dagger:iron', quality: 2, pay: 900 }]);
  // a kit takes no quality: none asked, none sent
  open('Commission a piece').click();
  const fam = selects()[0];
  fam.value = 'kits'; fam.onchange();
  assert.equal(selects().length, 2, 'the family and the piece - no quality');
  assert.equal(selects()[1].children.find((o) => o.selected).value, 'kit:iron');
  field('comm|crafter').value = 'Bran'; field('comm|crafter').oninput();
  byClass(form(), 'work-post')[0].click();
  await ticks();
  assert.deepEqual(calls.at(-1), ['commission', { region: DF, crafter: 'Bran', recipe: 'kit:iron', quality: null, pay: 900 }]);
  v.unmount();
  // the note's button
  const note = { id: 'n1', from: 'Silverthorn', subject: 'Blades made', body: 'Mithril, to order.', button: 'commission', at: 1, expiresAt: T0 + DAY, mine: false };
  const r = workRig({ data: boardData(), notes: [note] });
  await ticks();
  byClass(r.host, 'notice-card')[0].click();
  await ticks();
  byClass(r.host, 'notice-answer')[0].click();
  await ticks();
  assert.equal(byClass(r.host, 'notice-tab').find((t) => t.className.includes('on')).textContent.replace(/\d+$/, ''), 'Work');   // BOARD-UI: beside its count of writs open
  const crafter = byClass(r.host, 'work-form')[0].querySelectorAll('input').find((i) => i.getAttribute('data-focus') === 'comm|crafter');
  assert.equal(crafter.value, 'Silverthorn', 'its author named');
  r.v.unmount();
});

test('PROF6 words: a commission\'s piece in words, a writ\'s time left; a piece is of a recipe by its template and material (the Work tab\'s Fill offers only those)', () => {
  assert.equal(commissionPieceText({ recipe: 'longsword:mithril', quality: 4 }), 'a Mithril Longsword, Masterwork or better');
  assert.equal(commissionPieceText({ recipe: 'kit:iron', quality: null }), 'an Iron Repair Kit');
  assert.deepEqual([writLeftText(T0 + 3 * DAY + 5, T0), writLeftText(T0 + 7_300, T0), writLeftText(T0 + 60, T0), writLeftText(T0, T0)],
    ['3 days left', '2 hours left', 'under an hour left', 'ended']);
  const a = mintPiece({ recipe: 'longsword:mithril', quality: 3, seed: 1 }, PV);
  assert.deepEqual([pieceOfRecipe(a, 'longsword:mithril'), pieceOfRecipe(a, 'longsword:steel'), pieceOfRecipe(a, 'dagger:mithril'), pieceOfRecipe(null, 'longsword:mithril')],
    [true, false, false, false]);
  const kit = mintPiece({ recipe: 'kit:steel', quality: 0, seed: 1 }, PV);
  assert.deepEqual([pieceOfRecipe(kit, 'kit:steel'), pieceOfRecipe(kit, 'kit:iron')], [true, false]);
});

// ─── THE GUILD TAB ───────────────────────────────────────────────────

test('PROF6 the Guild tab: the guild Stores read once, each material\'s count and the reader\'s own; Put in from the character\'s Stores, Take out an Officer\'s; the moves; the Guildmaster\'s writ budget', async () => {
  const calls = [];
  const view = { id: 'g0123456789', name: 'The Hound', tag: 'HND', ranks: [...GUILD_RANK_NAMES], treasury: 0, foundedAt: 1, rank: 0,
    members: [{ member: 'm1', name: 'Aldric', rank: 0, joinedAt: 1, you: true }], invites: [], ledger: [] };
  const door = {
    mine: async () => ({ ok: true, data: { guild: view } }), invites: async () => ({ ok: true, data: { invites: [] } }),
  };
  const writs = {
    busy: false, state: { guildStores: null, writBudget: null },
    guildStores: async () => { calls.push(['read']); writs.state.guildStores = { rows: [{ material: OAK, qty: 120, mine: 20 }], moves: [{ material: OAK, delta: 20, who: 'Aldric', at: 1 }], mayWithdraw: true }; writs.state.writBudget = { budget: 500, spent: 0, left: 500 }; return { ok: true }; },
    deposit: async (k, n) => { calls.push(['deposit', k, n]); return { ok: true }; },
    withdrawStores: async (k, n) => { calls.push(['withdraw', k, n]); return { ok: true }; },
    budget: async (n) => { calls.push(['budget', n]); return { ok: true }; },
  };
  const mine = new Map([[OAK, { material: OAK, own: 30, bought: 5 }]]);
  const book = new GuildBook({ door, character: () => 'char-a', wallet: () => ({ gold: () => 0, pay() {}, credit() {} }),
    profStores: { writs, open: () => true, mine: () => mine, name: (k, n) => materialCountLabel(k, n) } });
  // the fake DOM's nodes with the `dataset` the panel keeps its tabs in
  const doc = { ...document, createElement: (t) => Object.assign(document.createElement(t), { dataset: {} }) };
  doc.head.dataset ??= {}; doc.body.dataset ??= {};
  const panel = createSocialPanel({ social: new SocialState({ acct: 'acct-a' }), guild: book, doc, win: { addEventListener() {}, removeEventListener() {} }, overlay: () => false, touch: false });
  panel.openGuild('stores');   // GUILD2 (PIN MOVED): the guild Stores are the Guild tab's Stores page
  await ticks(6); panel.render(); await ticks(6); panel.render();
  const t = panel.root.textContent;
  assert.match(t, /Guild Stores/);
  assert.match(t, /120 Oak Logs20 of them yours/);
  assert.match(t, /Aldric put in 20 Oak Logs/);
  assert.match(t, /Writ budget/);
  assert.equal(calls.filter((c) => c[0] === 'read').length, 1, 'read once');
  const fields = byClass(panel.root, 'dfsocial-field');
  const units = fields.find((f) => f.getAttribute('aria-label') === 'Units');
  units.value = '15'; units.dispatch('input', {});
  const btn = (label) => byClass(panel.root, 'dfsocial-btn').find((b) => b.textContent.startsWith(label));
  btn('Put in').click();
  await ticks();
  assert.deepEqual(calls.at(-1), ['deposit', OAK, 15]);
  panel.render();
  const units2 = byClass(panel.root, 'dfsocial-field').find((f) => f.getAttribute('aria-label') === 'Units');
  units2.value = '10'; units2.dispatch('input', {});
  btn('Take out').click();
  await ticks();
  assert.deepEqual(calls.at(-1), ['withdraw', OAK, 10]);
  panel.render();
  const budget = byClass(panel.root, 'dfsocial-field').find((f) => f.getAttribute('aria-label') === 'Silver a week');
  budget.value = '750'; budget.dispatch('input', {});
  btn('Set').click();
  await ticks();
  assert.deepEqual(calls.at(-1), ['budget', 750]);
});

// ─── THE WIRING ──────────────────────────────────────────────────────

test('PROF6 wiring: the routes behind a session and in the Worker\'s table with their statuses; the door\'s calls; every refusal a sentence; the host\'s books and the board\'s and guild\'s hand-offs; the styles; the deploy carries the law; the Court writ\'s word names its profession (FOUND: it said Herbalism for every writ)', () => {
  const service = src('server-account/src/service.js'), idx = src('server-account/src/index.js');
  const routes = ['/v1/writs/post', '/v1/writs/supply', '/v1/writs/withdraw', '/v1/writs/budget', '/v1/writs/commission', '/v1/writs/fulfil',
    '/v1/writs/cancel', '/v1/writs/decline', '/v1/stores/guild', '/v1/stores/guild-deposit', '/v1/stores/guild-withdraw'];
  for (const r of routes) { assert.ok(service.includes(`'${r}'`), r); assert.ok(idx.includes(`'${r}':`), r); }
  assert.match(idx, /'writ-gone': 409, 'writ-elsewhere': 409/);
  assert.match(idx, /'guild-stores': 409, 'guild-writs': 409/);
  const door = src('src/net/accountClient.js');
  for (const r of routes) assert.ok(door.includes(`'${r}'`), r);
  const words = [...src('server-account/src/writs.js').matchAll(/error: '([a-z-]+)'/g)].map((m) => m[1]);
  for (const w of new Set(words)) assert.ok(REFUSALS[w], `a sentence for ${w}`);
  const world = src('src/scenes/world.js');
  assert.match(world, /const writBook = params\.has\('online'\)\n\s+\? createWritBook\(\{ door: accountWrits/);
  assert.match(world, /writs: writBook, regionNameOf: \(r\) => REGION_NAMES\[r\] \?\? 'another region', pieces: commissionPieces,/);
  assert.match(world, /settle: \(\) => writBook\.settle\(marketPutBack, marketDrop\)/);
  assert.match(world, /profStores: writBook \? \{\n\s*writs: writBook, open: \(\) => profBook\?\.state\.open === true/);
  assert.match(world, /\(!named \|\| named\.has\(it\.provenance\)\)\n\s*&& commissionFilledBy\(c, \{ recipe: pieceOfRecipe\(it, c\.recipe\) \? c\.recipe : null, quality: it\.quality \?\? null \}\) && wearOf\(it\) === WEAR_WHOLE/);
  assert.match(world, /const prof = professionName\(d\.track\?\.profession\) \|\| 'profession';/);
  assert.doesNotMatch(world, /Herbalism XP\./, 'the XP its writ\'s own profession\'s');
  const css = src('src/ui/enhancedPlusStyle.js');
  assert.match(css, /\.notice-card\.seal-commission, \.notice-read\.seal-commission \{ --seal: #3f7a3a; \}/);
  assert.match(css, /\.work-row \{ display: flex; flex-wrap: wrap;/);
  assert.match(src('.github/workflows/account-deploy.yml'), /- "src\/net\/writLaw\.js"/);
});
