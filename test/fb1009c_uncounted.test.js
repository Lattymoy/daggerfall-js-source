// FIELD BUGS 2026-10-09c - UNCOUNTED, the Discord's "Some ingredients won't let you store them": "I got some
// ingredients like troll's blood or orc's blood on a dungeon and it won't let me store them for crafting even though I
// have them in my inventory, also if you trade ingredients that you can store to a friend he won't be able to store
// them, I don't know if this is intended or not."
//
// Intended: law 3 (bible/06-Systems/Professions-Arc.md 1, restated in Materials-Bag.md 5) - the Stores take back only
// what the service handed to this character; a looted unit, a shop's and a traded one are held and never counted. The
// fault was the page's silence: the Stores page built its rows from the counted materials alone, so a pack full of
// Troll's Blood showed nothing, and nothing said why. It names them now - "N unstorable" on the card, and the law in the
// player's words on the picked bar - and Put in still moves only what is counted. `01-Overview/Field-Bugs-2026-10-09c.md`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import '../src/systems/profTemplates.js';
import { createProfBook } from '../src/net/profBook.js';
import { BAG_TEMPLATE } from '../src/net/bagLaw.js';
import { withDom } from './invdrag.mjs';
import { BAG_PAGE_WORDS, setProfessionsPages, drawStoresPage, resetProfPages, carryRows } from '../src/ui/profPages.js';
import { heldOf, heldKeysOf, materialKeyOfItem, roomFor, mintCarried, bagWeight } from '../src/systems/materialsBag.js';
import { setItemFields } from '../src/systems/itemTemplates.js';
import { generateRandomLoot } from '../src/systems/loot.js';

const noWait = () => Promise.resolve();
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
const body = () => ({ stats: { strength: 50 }, items: [setItemFields({ group: 'UselessItems2', templateIndex: BAG_TEMPLATE })], bagItems: [], wagonItems: [], goldPieces: 0 });
const TROLL = 'reagent:troll-blood', HERB = 'p1:9';

/** Troll's Blood as a dungeon's corpse gives it - DFU's loot roll (systems/loot.js generateRandomLoot), the C1 arm alone,
 *  its pick landing on template 42 (CreatureIngredients1's seventh of fifteen). */
function lootedTrollsBlood() {
  const matrix = { MinGold: 0, MaxGold: 0, WP: 0, AM: 0, C1: 100, C2: 0, C3: 0, P1: 0, P2: 0, M1: 0, AI: 0, CL: 0, BK: 0, M2: 0, RI: 0, RL: 0 };
  const got = generateRandomLoot(matrix, { level: 1 }, () => 6.5 / 15).filter((it) => it.group === 'CreatureIngredients1');
  assert.ok(got.length > 0 && got.every((it) => it.templateIndex === 42), 'the loot roll minted Troll\'s Blood');
  return got;
}

test('UNCOUNTED: a looted Troll\'s Blood is the material - the same item the mint makes - held, and never counted: the rows name it "unstorable", apart from what is carried (mutants: the held keys unread; the uncounted as carried)', async () => {
  const e = body();
  const loot = lootedTrollsBlood();
  assert.equal(materialKeyOfItem(loot[0]), TROLL, 'one item in the pack whoever minted it (Materials-Bag.md 5)');
  e.items.push(...loot);
  mintCarried(e, HERB, 4);   // and four herbs gathered - counted
  const n = heldOf(e, TROLL);
  assert.deepEqual(heldKeysOf(e).sort(), [HERB, TROLL].sort(), 'every material held, counted or not');
  const book = createProfBook({ door: { account: () => 'a', state: async () => ({ ok: true, data: { stores: [], carried: [{ material: HERB, own: 4, bought: 0 }] } }) }, storage: memStorage(), character: () => 'c', sleep: noWait, carry: { held: (k) => heldOf(e, k), room: (k) => roomFor(e, k) } });
  await book.refresh({ force: true });
  const held = (k) => heldOf(e, k);
  assert.equal(carryRows(book, held).has(TROLL), false, 'without the held keys the page sees only what is counted (as it did)');
  const rows = carryRows(book, held, () => heldKeysOf(e));
  assert.deepEqual({ ...rows.get(TROLL) }, { material: TROLL, own: 0, bought: 0, carried: 0, uncounted: n });
  assert.equal(rows.get(HERB).carried, 4);
  assert.equal(rows.get(HERB).uncounted, undefined, 'a gathered herb is all counted');
  // a friend's trade: the same items, and no count - the same row
  const friend = body();
  friend.items.push(...structuredClone(loot));
  const fb = createProfBook({ door: { account: () => 'b', state: async () => ({ ok: true, data: { stores: [], carried: [] } }) }, storage: memStorage(), character: () => 'd', sleep: noWait, carry: { held: (k) => heldOf(friend, k), room: (k) => roomFor(friend, k) } });
  await fb.refresh({ force: true });
  assert.equal(carryRows(fb, (k) => heldOf(friend, k), () => heldKeysOf(friend)).get(TROLL).uncounted, n);
});

test('UNCOUNTED: the Stores page lists the looted blood, says why it stays out, and offers no Put in for it - Put everything in moves the counted alone (mutants: the card silent; the why unsaid)', async () => {
  const e = body();
  e.items.push(...lootedTrollsBlood());
  mintCarried(e, HERB, 4);
  const n = heldOf(e, TROLL);
  const book = createProfBook({ door: { account: () => 'a', state: async () => ({ ok: true, data: { stores: [], carried: [{ material: HERB, own: 4, bought: 0 }] } }) }, storage: memStorage(), character: () => 'c', sleep: noWait, carry: { held: (k) => heldOf(e, k), room: (k) => roomFor(e, k) } });
  await book.refresh({ force: true });
  const deposits = [];
  await withDom(async (dom) => {
    resetProfPages();
    const kit = { el: (tag, cls, text) => { const x = dom.mk(tag); if (cls) x.className = cls; if (text != null) x.textContent = text; return x; }, divider: (w) => { const x = dom.mk('h3'); x.textContent = w; return x; }, meter: () => dom.mk('div') };
    setProfessionsPages({
      book, name: (k) => k, withdraw: async () => ({ ok: true, text: '' }), inTown: () => true, room: (k) => roomFor(e, k),
      carriedHeld: (k) => heldOf(e, k), heldKeys: () => heldKeysOf(e),
      bag: () => ({ has: true, kg: bagWeight(e), max: 300, count: e.bagItems.length }),
      deposit: async (k, q) => { deposits.push([k, q]); return { ok: true, text: '' }; },
    });
    let root = null;
    const draw = () => { root = dom.mk('div'); drawStoresPage(root, draw, kit); };
    draw();
    const card = root.querySelectorAll('button').find((b) => b.className.startsWith('prof-mat') && b.querySelector('b')?.textContent === TROLL);
    assert.ok(card, 'the looted blood has its card');
    assert.equal(card.querySelector('.prof-split').textContent, BAG_PAGE_WORDS.uncountedSplit(n));
    card.onclick();
    const said = root.querySelectorAll('p').map((x) => x.textContent).join(' ');
    assert.ok(said.includes(BAG_PAGE_WORDS.uncounted), 'the why, drawn');
    const put = root.querySelectorAll('button').find((b) => b.textContent === 'Put in');
    assert.equal(put.disabled, true, 'nothing counted: Put in is shut');
    await root.querySelectorAll('button').find((b) => b.textContent === BAG_PAGE_WORDS.allIn).onclick();
    assert.deepEqual(deposits, [[HERB, 4]], 'Put everything in: the gathered herbs, never the blood');
  });
  setProfessionsPages(null);
  assert.match(BAG_PAGE_WORDS.uncounted, /^Looted, bought at a shop or given by another player, a material stays an item in your pack: only what you gathered, or took out of your Stores, goes back in\./);
});

test('UNCOUNTED wired: the world host hands the page every material held', () => {
  const w = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(w, /carriedHeld: \(k\) => bagHeldOf\(playerEntity, k\),\n\s+heldKeys: \(\) => bagHeldKeysOf\(playerEntity\),/);
});
