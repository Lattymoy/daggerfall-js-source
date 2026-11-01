// AUDIT FB1031 III I2 (bible/01-Overview/audits/Audit-FB1031.md, lane III): STORES-AT-BENCH's bar in a German game -
// its Put everything in, its busy word and its answer line were English in every language, outside the catalog.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import '../../src/systems/professions/profTemplates.js';
import * as tm from '../../src/systems/textManager.js';
import { createProfBook } from '../../src/net/profBook.js';
import { withDom } from '../invdrag.mjs';
import { setProfessionsPages, drawCraftingPage, resetProfPages } from '../../src/ui/professions/profPages.js';
import { setItemFields } from '../../src/systems/item/itemTemplates.js';
import { BAG_TEMPLATE } from '../../src/net/bagLaw.js';
import { heldOf, roomFor, mintCarried, takeCarried, giveCarried, bagTakesOf } from '../../src/systems/materialsBag.js';
const OAK = 'log:oak';
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
const body = () => ({ stats: { strength: 50 }, items: [setItemFields({ group: 'UselessItems2', templateIndex: BAG_TEMPLATE })], bagItems: [], goldPieces: 0 });
const hands = (e) => ({ held: (k) => heldOf(e, k), room: (k) => roomFor(e, k), mint: (k, n) => mintCarried(e, k, n), take: (k, n, id, order) => takeCarried(e, k, n, id, order), give: (k, n) => giveCarried(e, k, n),
  stamped: (id) => Object.hasOwn(bagTakesOf(e), id), unstamp: (id) => { delete e.bagTakes?.[id]; }, stamps: () => Object.entries(bagTakesOf(e)).map(([id, t]) => ({ id, ...t })) });
test('AUDIT FB1031 III I2: the bench bar\'s words are the catalog\'s - in German its two buttons and its answer line (mutants: Put everything in a literal; the answer line a literal)', async () => {
  tm.registerLocale({ code: 'de' });
  tm.patchLocaleTable('de', tm.runtimeCollectionName(tm.TextCollections.Port), tm.parseStringTableCsv(readFileSync(new URL('../../locales/de/Port_Strings.csv', import.meta.url), 'utf8')));
  tm.setLocale('de');
  const e = body(); mintCarried(e, OAK, 10);
  const book = createProfBook({ door: { account: () => 'a', state: async () => ({ ok: true, data: { stores: [], carried: [{ material: OAK, own: 10, bought: 0 }] } }) }, storage: memStorage(), character: () => 'c', sleep: () => Promise.resolve(), carry: hands(e) });
  await book.refresh({ force: true });
  let bar = null;
  withDom((dom) => {
    resetProfPages();
    globalThis.requestAnimationFrame = (fn) => { fn(); return 0; };
    const kit = { el: (tag, cls, text) => { const n = dom.mk(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }, divider: (w) => { const n = dom.mk('h3'); n.textContent = w; return n; }, meter: () => dom.mk('div'), go: () => {} };
    setProfessionsPages({ book, name: (k) => k, withdraw: async () => ({ ok: true }), inTown: () => true, workbench: () => ({ kind: 'home' }), craft: async () => ({ ok: true }), smelt: async () => ({ ok: true }),
      carriedHeld: (k) => heldOf(e, k), room: (k) => roomFor(e, k), deposit: async (plan) => plan.map(() => ({ ok: true, text: '' })) });
    const root = dom.mk('div');
    drawCraftingPage(root, () => {}, kit);
    bar = root.children.find((c) => c.className === 'prof-benchstores-wrap');
    assert.deepEqual(bar.querySelectorAll('button').map((b) => b.textContent), ['Alles einlagern', 'Dein Lager']);
  });
  const { BAG_PAGE_WORDS } = await import('../../src/ui/professions/profPages.js');
  assert.equal(BAG_PAGE_WORDS.allInDone(1234, [{ name: 'Eiche' }]), '1.234 ins Lager gelegt. Eiche: nicht eingelagert.');
  tm.setLocale('en');
  assert.equal(BAG_PAGE_WORDS.allInDone(1234), '1,234 put in the Stores.', 'and the English as it was');
});
