// STORES-AT-BENCH (2026-10-29, its_WiKeD: "when you open up a bench you need to scroll all the way down, click stores, then
// scroll all the way up top just to store stuff"): the Crafting page at a station offers Put everything in and the Stores'
// door over the station worked here, and a press lands on them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../../../src/systems/professions/profTemplates.js';
import { createProfBook } from '../../../src/net/profBook.js';
import { withDom } from '../../invdrag.mjs';
import { BAG_PAGE_WORDS, setProfessionsPages, drawCraftingPage, resetProfPages, professionsKeyAt } from '../../../src/ui/professions/profPages.js';
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
