// STORES-AT-BENCH (2026-10-29, its_WiKeD: "when you open up a bench you need to scroll all the way down, click stores, then
// scroll all the way up top just to store stuff"): the Crafting page at a station offers Put everything in and the Stores'
// door over the station worked here, and a press lands on them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../../../src/systems/professions/profTemplates.js';
import { createProfBook } from '../../../src/net/profBook.js';
import { withDom } from '../../invdrag.mjs';
import { BAG_PAGE_WORDS, setProfessionsPages, drawCraftingPage, drawStoresPage, resetProfPages, professionsKeyAt, stationDoorAt } from '../../../src/ui/professions/profPages.js';
import { setItemFields } from '../../../src/systems/item/itemTemplates.js';
import { BAG_TEMPLATE } from '../../../src/net/bagLaw.js';
import { heldOf, roomFor, mintCarried, takeCarried, giveCarried, bagTakesOf } from '../../../src/systems/materialsBag.js';

const OAK = 'log:oak';
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
const body = () => ({ stats: { strength: 50 }, items: [setItemFields({ group: 'UselessItems2', templateIndex: BAG_TEMPLATE })], bagItems: [], goldPieces: 0 });
const hands = (e) => ({
  held: (k) => heldOf(e, k), room: (k) => roomFor(e, k), mint: (k, n) => mintCarried(e, k, n),
  take: (k, n, id, order) => takeCarried(e, k, n, id, order), give: (k, n) => giveCarried(e, k, n),
  stamped: (id) => Object.hasOwn(bagTakesOf(e), id), unstamp: (id) => { delete e.bagTakes?.[id]; },
  stamps: () => Object.entries(bagTakesOf(e)).map(([id, t]) => ({ id, ...t })),
});

test('STORES-AT-BENCH: at a workbench the Crafting page puts Put everything in and Your Stores over the station, and the press lands on them', async () => {
  const e = body();
  mintCarried(e, OAK, 10);
  const book = createProfBook({ door: { account: () => 'a', state: async () => ({ ok: true, data: { stores: [], carried: [{ material: OAK, own: 10, bought: 0 }] } }) }, storage: memStorage(), character: () => 'c', sleep: () => Promise.resolve(), carry: hands(e) });
  await book.refresh({ force: true });
  const deposits = [], went = [], landed = [];
  withDom((dom) => {
    resetProfPages();
    globalThis.requestAnimationFrame = (fn) => { fn(); return 0; };
    const kit = { el: (tag, cls, text) => { const n = dom.mk(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }, divider: (w) => { const n = dom.mk('h3'); n.textContent = w; return n; }, meter: () => dom.mk('div'), go: (id) => went.push(id) };
    setProfessionsPages({
      book, name: (k) => k, withdraw: async () => ({ ok: true, text: '' }), inTown: () => true, workbench: () => ({ kind: 'home' }), craft: async () => ({ ok: true, text: '' }), smelt: async () => ({ ok: true, text: '' }),
      carriedHeld: (k) => heldOf(e, k), room: (k) => roomFor(e, k),
      deposit: async (plan) => { deposits.push(...plan.map((d) => [d.material, d.qty])); return plan.map(() => ({ ok: true, text: '' })); },
    });
    assert.equal(professionsKeyAt(), 'crafting');
    const getById = dom.doc.getElementById?.bind(dom.doc);
    dom.doc.getElementById = (id) => { const n = getById?.(id) ?? { scrollIntoView() {} }; return { scrollIntoView: () => landed.push(id), n }; };
    const root = dom.mk('div');
    drawCraftingPage(root, () => {}, kit);
    const kids = root.children;
    const barAt = kids.findIndex((c) => c.className === 'prof-benchstores-wrap');
    assert.ok(barAt >= 0, 'the bar is drawn');
    assert.ok(kids[barAt + 1]?.className === 'prof-station', 'right over the station worked here');
    const btns = kids[barAt].querySelectorAll('button').map((b) => b.textContent);
    assert.deepEqual(btns, [BAG_PAGE_WORDS.allIn, 'Your Stores']);
    assert.equal(landed.at(-1), 'prof-bench-stores', 'the press lands on the bar');
    kids[barAt].querySelectorAll('button')[1].onclick();
    assert.deepEqual(went, ['stores']);
    kids[barAt].querySelectorAll('button')[0].onclick();
  });
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(deposits, [[OAK, 10]], 'everything carried goes in');
});

// AUDIT FB1031 P1-P2: a forge's press lands on the Anvil, the second station worked there, and the bar's own put-in
// repaints the page; the bar stayed over the Forge after that, out of view. Its answer was lost to a player who
// followed Your Stores mid-flight, and a fresh visit read the last put-in's line.
const words = (n) => (n?.querySelectorAll('p') ?? []).filter((p) => p.className === 'prof-word').map((p) => p.textContent);
const stationsAt = (root) => root.children.map((c) => (c.className === 'prof-benchstores-wrap' ? 'BAR' : c.className === 'prof-station' ? c.children[0]?.textContent : null)).filter(Boolean);
test('AUDIT FB1031 P1-P2: at a forge the bar stays over the Anvil through its own repaint; the answer reads on the Stores page too, and a fresh visit shows no old one (mutants: the bar over the first station, the answer the bench\'s alone, benchWord kept by a reset)', async () => {
  const e = body();
  mintCarried(e, OAK, 10);
  const book = createProfBook({ door: { account: () => 'a', state: async () => ({ ok: true, data: { stores: [{ material: 'ore:iron', own: 30, bought: 0 }], carried: [{ material: OAK, own: 10, bought: 0 }] } }) }, storage: memStorage(), character: () => 'c', sleep: () => Promise.resolve(), carry: hands(e) });
  await book.refresh({ force: true });
  let release, kit;
  const mkKit = (dom) => ({ el: (tag, cls, text) => { const n = dom.mk(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }, divider: (w) => { const n = dom.mk('h3'); n.textContent = w; return n; }, meter: () => dom.mk('div'), go: () => {} });
  withDom((dom) => {
    resetProfPages();
    globalThis.requestAnimationFrame = () => 0;
    kit = mkKit(dom);
    setProfessionsPages({
      book, name: (k) => k, withdraw: async () => ({ ok: true, text: '' }), inTown: () => true, forge: () => ({ kind: 'shop', fee: 50 }), workbench: () => null,
      smelt: async () => ({ ok: true, text: '' }), craft: async () => ({ ok: true, text: '' }), stock: async () => ({ ok: true, text: '' }), heatBand: () => 1, planeBand: () => 1,
      carriedHeld: (k) => heldOf(e, k), room: (k) => roomFor(e, k),
      deposit: (plan) => new Promise((r) => { release = () => r(plan.map(() => ({ ok: true, text: '' }))); }),
    });
    stationDoorAt('forge');
    let root;
    const draw = () => { root = dom.mk('div'); drawCraftingPage(root, draw, kit); };
    draw();
    const first = stationsAt(root);
    const at = first.indexOf('BAR');
    assert.ok(at > 0 && /Anvil/.test(first[at + 1]), `the press lands over the Anvil: ${first.join(' | ')}`);
    root.children.find((c) => c.className === 'prof-benchstores-wrap').querySelectorAll('button')[0].onclick();   // busy: a repaint
    assert.deepEqual(stationsAt(root), first, 'the repaint keeps the bar where the press landed');
    const st = dom.mk('div'); drawStoresPage(st, () => {}, kit);   // Your Stores, mid-flight
  });
  release();
  await new Promise((r) => setTimeout(r, 0));
  withDom((dom) => {
    kit = mkKit(dom);
    const st = dom.mk('div'); drawStoresPage(st, () => {}, kit);
    assert.deepEqual(words(st), [BAG_PAGE_WORDS.allInDone(10, [], null)], 'the answer reads on the Stores page the player followed to');
    const bench = () => { const r = dom.mk('div'); drawCraftingPage(r, () => {}, kit); return words(r.children.find((c) => c.className === 'prof-benchstores-wrap')); };
    assert.deepEqual(bench(), [BAG_PAGE_WORDS.allInDone(10, [], null)], 'back at the bench, the bar reads its answer');
    mintCarried(e, OAK, 3);
    resetProfPages();
    assert.deepEqual(bench(), [], 'a fresh visit reads no old answer');
    const fresh = dom.mk('div'); drawCraftingPage(fresh, () => {}, kit);
    assert.equal(stationsAt(fresh)[0], 'BAR', 'AUDIT FB1031 II R9: a fresh visit forgets the last press\'s station - the bar over the first');
    const r = dom.mk('div'); drawCraftingPage(r, () => {}, kit);
    r.children.find((c) => c.className === 'prof-benchstores-wrap').querySelectorAll('button')[0].onclick();   // a second put-in
  });
  release();
  await new Promise((r) => setTimeout(r, 0));
  withDom((dom) => {
    kit = mkKit(dom);
    const bench = () => { const r = dom.mk('div'); drawCraftingPage(r, () => {}, kit); return words(r.children.find((c) => c.className === 'prof-benchstores-wrap')); };
    assert.equal(bench().length, 1, 'the second put-in\'s answer');
    stationDoorAt('forge');
    assert.deepEqual(bench(), [], 'a new press spends the old line');
  });
});
