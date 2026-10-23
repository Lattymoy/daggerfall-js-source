// FB1020c ONE-SAVE (FIELD BUGS 2026-10-20c, the Discord: "storing your goods makes the buttons get stuck for a long
// time"). A put-in waits for the save holding its take to land before it is asked (AUDIT2 BAG1 K3/K7/H2,
// bible/06-Systems/Materials-Bag.md section 7) - a checkpoint of the whole game, a realm PUT. The Stores page's Put
// everything in asked a put-in a material, each its own checkpoint, in series, every button held at "Sending..." the
// while; a craft's shortfalls the same, one an input. Now the take and its save live once (net/profBook.js depositMany):
// every take of a batch stamped, ONE checkpoint, then each asked - `deposit` a batch of one, `ensureInStores` and the page
// a batch of all; H2's order kept, every guard and word deposit answered kept.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import '../../../src/systems/professions/profTemplates.js';
import { setItemFields } from '../../../src/systems/item/itemTemplates.js';
import { BAG_TEMPLATE, BAG_KG_LIMIT, DEPOSIT_MAX } from '../../../src/net/bagLaw.js';
import { createProfBook } from '../../../src/net/profBook.js';
import { heldOf, roomFor, mintCarried, takeCarried, giveCarried, bagTakesOf, bagWeight, heldKeysOf } from '../../../src/systems/materialsBag.js';
import { BAG_PAGE_WORDS, setProfessionsPages, drawStoresPage, resetProfPages } from '../../../src/ui/professions/profPages.js';
import { withDom } from '../../invdrag.mjs';

const OAK = 'log:oak', HERB = 'p1:9', IRON = 'metal:iron', TIN = 'metal:tin';
const KEYS = [OAK, HERB, IRON, TIN];
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
const noWait = () => Promise.resolve();
const body = () => ({ stats: { strength: 50 }, items: [setItemFields({ group: 'UselessItems2', templateIndex: BAG_TEMPLATE })], bagItems: [], goldPieces: 0 });
const landed = (m, q) => ({ ok: true, data: { store: { material: m, own: q, bought: 0 }, carried: { material: m, own: 0, bought: 0 } } });

/** The world host's hands (scenes/world.js carryHands) on an entity, with its checkpoint watched: `ev` the flushes - and
 *  the stamps the save each one landed held - and the asks, in order; `flush` answers `saved`. */
function rigged({ saved = true, answer = (m, q) => landed(m, q), carry = true, character = 'c' } = {}) {
  const e = body();
  for (const k of KEYS) mintCarried(e, k, 3);
  const ev = [], takes = [];
  const hands = {
    held: (k) => heldOf(e, k), room: (k) => roomFor(e, k), mint: (k, n) => mintCarried(e, k, n), give: (k, n) => giveCarried(e, k, n),
    take: (k, n, id, order, counter) => { takes.push([k, n, order, counter]); return takeCarried(e, k, n, id, order, { counter }); },
    stamped: (id) => Object.hasOwn(bagTakesOf(e), id), unstamp: (id) => { delete e.bagTakes?.[id]; },
    stamps: () => Object.entries(bagTakesOf(e)).map(([id, t]) => ({ id, ...t })),
    flush: async () => { ev.push(['flush', Object.keys(bagTakesOf(e)).sort()]); return typeof saved === 'function' ? saved() : saved; },
  };
  const door = {
    account: () => 'a',
    state: async () => ({ ok: true, data: { carried: KEYS.map((k) => ({ material: k, own: 3, bought: 0 })) } }),
    deposit: async (c, m, q, held, order, rid) => { ev.push(['ask', rid, m, q, order]); return answer(m, q); },
  };
  const book = createProfBook({ door, storage: memStorage(), character: () => character, sleep: noWait, ...(carry ? { carry: hands } : {}) });
  return { e, ev, takes, book };
}
const flushes = (ev) => ev.filter((x) => x[0] === 'flush');
const asks = (ev) => ev.filter((x) => x[0] === 'ask');

test('ONE-SAVE THE BATCH: every take stamped, ONE checkpoint that holds every stamp, then each put-in asked - never a checkpoint a put-in (mutants: a checkpoint each again; the asks before the checkpoint)', async () => {
  const { e, ev, book } = rigged();
  await book.refresh({ force: true });
  const out = await book.depositMany(KEYS.map((k) => ({ material: k, qty: 3, order: 'all' })));
  assert.deepEqual(out.map((r) => r.ok), [true, true, true, true]);
  assert.equal(flushes(ev).length, 1, 'one save');
  assert.equal(ev[0][0], 'flush', 'the save first - H2: the take saved before the ask');
  assert.equal(asks(ev).length, 4);
  assert.ok(asks(ev).every(([, rid]) => flushes(ev)[0][1].includes(rid)), 'every put-in asked was in the save that landed');
  assert.deepEqual([KEYS.map((k) => heldOf(e, k)), Object.keys(bagTakesOf(e)).length, book.pendingDeposits], [[0, 0, 0, 0], 0, 0]);
});

test('ONE-SAVE A SAVE REFUSED: nothing is asked and every take is given back whole - its units in the bag, no stamp, nothing kept; each put-in says so (mutants: the takes kept; one given back)', async () => {
  const { e, ev, book } = rigged({ saved: false });
  await book.refresh({ force: true });
  const out = await book.depositMany(KEYS.map((k) => ({ material: k, qty: 3, order: 'all' })));
  assert.deepEqual(out.map((r) => r.error), ['deposit-unsaved', 'deposit-unsaved', 'deposit-unsaved', 'deposit-unsaved']);
  assert.deepEqual([asks(ev).length, KEYS.map((k) => heldOf(e, k)), Object.keys(bagTakesOf(e)).length, book.pendingDeposits], [0, [3, 3, 3, 3], 0, 0]);
});

test('ONE-SAVE THE COUNTING-HOUSE SILENT: the first unanswered put-in leaves the rest unasked and kept - their takes in the landed save - and the next settle asks them (mutants: the rest asked into the silence; the rest given back)', async () => {
  let answer = (m, q) => (m === HERB ? { ok: false, error: 'offline' } : landed(m, q));
  const { e, ev, book } = rigged({ answer: (m, q) => answer(m, q) });
  await book.refresh({ force: true });
  const out = await book.depositMany(KEYS.map((k) => ({ material: k, qty: 3, order: 'all' })));
  assert.deepEqual(out.map((r) => [r.ok, r.error ?? null, r.kept === true]), [[true, null, false], [false, 'offline', true], [false, 'deposit-kept', true], [false, 'deposit-kept', true]]);
  assert.equal(new Set(asks(ev).map((a) => a[2])).size, 2, 'asked up to the silence - the herb its own tries');
  assert.deepEqual([book.pendingDeposits, KEYS.map((k) => heldOf(e, k))], [3, [0, 0, 0, 0]], 'three on their way, out of the bag');
  answer = (m, q) => landed(m, q);
  await book.settle(() => {});
  assert.deepEqual([book.pendingDeposits, Object.keys(bagTakesOf(e)).length], [0, 0], 'asked at the settle, by their own ids');
  assert.deepEqual(KEYS.map((k) => heldOf(e, k)), [0, 0, 0, 0]);
});

test('ONE-SAVE A BATCH OF ONE: deposit is depositMany\'s one - every guard and word it answered: bad-held, no-session, bad-qty (said while busy too), deposit-busy, carried-short, deposit-unsaved, deposit-kept, and a counter\'s pieces for a station\'s `work` put-in alone (mutants: busy said over bad-qty; the counter on any order)', async () => {
  assert.deepEqual(await rigged({ carry: false }).book.deposit(OAK, 1), { ok: false, error: 'bad-held' });
  assert.deepEqual(await rigged({ character: null }).book.deposit(OAK, 1), { ok: false, error: 'no-session' });
  const r = rigged();
  for (const q of [0, DEPOSIT_MAX + 1, 1.5]) assert.deepEqual(await r.book.deposit(OAK, q), { ok: false, error: 'bad-qty' });
  assert.deepEqual(await r.book.deposit(OAK, 4), { ok: false, error: 'carried-short' });
  assert.equal(heldOf(r.e, OAK), 3, 'a short take given back');
  let release;
  const gate = new Promise((res) => { release = res; });
  const busy = rigged({ saved: () => gate.then(() => true) });
  const first = busy.book.deposit(OAK, 1);
  assert.deepEqual(await busy.book.deposit(HERB, 1), { ok: false, error: 'deposit-busy' });
  assert.deepEqual(await busy.book.deposit(HERB, 0), { ok: false, error: 'bad-qty' }, 'a bad count is said as such, busy or not');
  release();
  assert.equal((await first).ok, true);
  assert.equal((await rigged({ saved: false }).book.deposit(OAK, 1)).error, 'deposit-unsaved');
  const kept = await rigged({ answer: () => ({ ok: false, error: 'offline' }) }).book.deposit(OAK, 1);
  assert.deepEqual([kept.ok, kept.kept], [false, true]);
  const c = rigged();
  await c.book.deposit(IRON, 1, { order: 'work', counter: true });
  await c.book.deposit(TIN, 1, { order: 'all', counter: true });
  assert.deepEqual(c.takes.map((t) => t[3]), [true, false], 'a counter\'s pieces for a station\'s `work` alone');
});

test('ONE-SAVE A CRAFT\'S SHORTFALLS: ensureInStores puts every input in under one save - and a later input refused leaves the earlier in the Stores, said by `moved` (mutants: a save an input again; moved lost)', async () => {
  const { ev, book } = rigged();
  await book.refresh({ force: true });
  const ok = await book.ensureInStores([{ key: OAK, n: 2 }, { key: HERB, n: 3 }, { key: IRON, n: 1 }], { work: true });
  assert.deepEqual(ok, { ok: true, moved: 6 });
  assert.equal(flushes(ev).length, 1, 'one save for three inputs');
  assert.deepEqual(asks(ev).map((a) => [a[2], a[3], a[4]]), [[OAK, 2, 'work'], [HERB, 3, 'work'], [IRON, 1, 'work']]);
  const refused = rigged({ answer: (m, q) => (m === TIN ? { ok: false, error: 'stores-full' } : landed(m, q)) });
  await refused.book.refresh({ force: true });
  const r = await refused.book.ensureInStores([{ key: IRON, n: 3 }, { key: TIN, n: 2 }]);
  assert.deepEqual(r, { ok: false, error: 'stores-full', material: TIN, kept: false, moved: 3 }, 'the iron in, the tin refused');
  assert.deepEqual([flushes(refused.ev).length, heldOf(refused.e, TIN)], [1, 3], 'one save; the refused tin given back');
});

test('ONE-SAVE THE PAGE: Put everything in and Put in each hand the provider ONE plan - the world host\'s deposit is the book\'s batch, worded a put-in each - so a press waits on one save, whatever it moves (mutants: a provider call a material; the host\'s plan not the batch)', async () => {
  const { e, ev, book } = rigged();
  await book.refresh({ force: true });
  mintCarried(e, OAK, 2);   // two logs past the service's count - loose, put in by `work` after the three counted
  const calls = [];
  await withDom(async (dom) => {
    resetProfPages();
    const kit = { el: (tag, cls, text) => { const n = dom.mk(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }, divider: (w) => { const n = dom.mk('h3'); n.textContent = w; return n; }, meter: () => dom.mk('div') };
    setProfessionsPages({
      book, name: (k) => k, withdraw: async () => ({ ok: true, text: '' }), inTown: () => true, room: (k) => roomFor(e, k), carriedHeld: (k) => heldOf(e, k), heldKeys: () => heldKeysOf(e),
      bag: () => ({ has: true, kg: bagWeight(e), max: BAG_KG_LIMIT, count: e.bagItems.length }),
      deposit: async (plan) => { calls.push(plan.length); return (await book.depositMany(plan)).map((r) => ({ ok: r.ok, kept: r.kept === true, text: r.ok ? 'in' : r.error })); },
    });
    let root = null;
    const draw = () => { root = dom.mk('div'); drawStoresPage(root, draw, kit); };
    draw();
    root.querySelectorAll('button').find((b) => b.className.startsWith('prof-mat') && b.querySelector('b')?.textContent === OAK).onclick();
    const qty = root.querySelectorAll('input').find((i) => i.className === 'prof-qty');
    qty.value = '5';
    qty.oninput();
    await root.querySelectorAll('button').find((b) => b.textContent === 'Put in').onclick();
    assert.deepEqual([calls, flushes(ev).length, heldOf(e, OAK)], [[2], 1, 0], 'Put in: the counted and the loose, one plan, one save');
    assert.deepEqual(asks(ev).map((a) => [a[2], a[3], a[4]]), [[OAK, 3, 'all'], [OAK, 2, 'work']]);
    assert.ok(root.querySelectorAll('p').map((n) => n.textContent).join(' ').includes(BAG_PAGE_WORDS.allInDone(5)));
    await root.querySelectorAll('button').find((b) => b.textContent === BAG_PAGE_WORDS.allIn).onclick();
    assert.deepEqual([calls, flushes(ev).length, asks(ev).length], [[2, 3], 2, 5], 'Put everything in: one plan of the other three, one save');
    assert.ok(root.querySelectorAll('p').map((n) => n.textContent).join(' ').includes(BAG_PAGE_WORDS.allInDone(9)));
    assert.equal(root.querySelectorAll('button').some((b) => b.textContent === 'Sending...'), false, 'the buttons back');
  });
  setProfessionsPages(null);
  const w = readFileSync(new URL('../../../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(w, /deposit: async \(plan\) => \(await profBook\.depositMany\(plan\)\)\.map\(\(r, i\) => /, 'the host\'s deposit is the batch');
  assert.match(w, /const BAG_DEPOSIT_KEPT_TEXT = BAG_PAGE_WORDS\.kept;/, 'the kept words\' one home');
});
