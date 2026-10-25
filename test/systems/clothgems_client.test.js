// CLOTH-GEMS (2026-10-25; the player SaberGGaming's "Profession oversights", the owner: "No band aids") - THE LOOM'S PAGE.
// The loom lists its Linen weaves and Wool spins beside its cures where the Stores or the pack hold their goods, and says
// where Linen and Wool come from where they hold none; a box of a garment wholly of cloth says the made cloth's 500 only
// where the units it would spend are the character's own (ui/professions/profPages.js ownSpend) - bought or loose units
// in the Stores, or bought ones carried, go first and pay none. bible/06-Systems/Professions-Arc.md 50.
import '../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { xpForRank } from '../../src/net/professionLaw.js';
import { recipeById } from '../../src/net/recipeLaw.js';
import { setProfessionsPages, drawStoresPage, resetProfPages, ownSpend } from '../../src/ui/professions/profPages.js';
import { craftXpText } from '../../src/ui/craftXpWords.js';
import { setPref } from '../../src/systems/uiPrefs.js';

const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const kit = { el, divider: (w) => el('h3', null, w), meter: () => el('div') };

/** A book whose Stores hold `stores` ({ key: { own, bought, loose } }) and whose bag carries `carried` ({ key: { own, bought } }). */
function bookOf(stores = {}, carried = {}) {
  const tracks = new Map([['outfitting', { profession: 'outfitting', xp: xpForRank(10), rank: 10, specs: { 50: null, 100: null } }]]);
  const s = (k) => ({ material: k, own: 0, bought: 0, ...(stores[k] ?? {}) });
  return {
    state: { open: true, day: 1, character: 'c', account: 'a', readAt: Date.now(), stores: new Map(), tracks, today: {}, caps: {}, hunt: { hides: 0, high: 0 } },
    stale: () => false, refresh: async () => ({ ok: true }),
    store: s, carried: (k) => ({ material: k, own: 0, bought: 0, ...(carried[k] ?? {}) }),
    held: (k) => s(k).own + s(k).bought, workable: (k) => s(k).own + s(k).bought + (s(k).loose ?? 0),
    track: (p) => tracks.get(p) ?? { profession: p, xp: 0, rank: 0, specs: { 50: null, 100: null } }, pendingWithdrawals: 0, pendingCrafts: 0,
  };
}

test('CLOTH-GEMS ownSpend: a craft spends the character\'s own units alone only where the Stores hold no bought and no loose unit of any input, and the bag carries no bought one (mutants: each origin unread)', () => {
  const straps = recipeById('garment-141:linen');
  assert.equal(ownSpend(bookOf({ 'cloth:linen': { own: 3 } }), straps), true);
  assert.equal(ownSpend(bookOf({}), straps), true, 'nothing held - what the loom makes of the character\'s own goods');
  assert.equal(ownSpend(bookOf({ 'cloth:linen': { own: 3, bought: 1 } }), straps), false, 'a bought bolt goes first');
  assert.equal(ownSpend(bookOf({ 'cloth:linen': { own: 3, loose: 1 } }), straps), false, 'a loose bolt goes first');
  assert.equal(ownSpend(bookOf({}, { 'cloth:linen': { bought: 1 } }), straps), false, 'a bought bolt carried goes in first');
  assert.equal(ownSpend(bookOf({}, { 'cloth:linen': { own: 2 } }), straps), true);
  assert.equal(ownSpend(bookOf({ 'leather:cured': { bought: 1 } }), recipeById('garment-149:linen')), false, 'every input read');
  assert.equal(ownSpend(bookOf(), null), false);
});

test('CLOTH-GEMS the loom\'s page: Spin and Weave rows for the furs and Root Tendrils held, the no-cloth note where none are, and the box\'s first-time line by the units (mutants: the spin rows unlisted, the note unsaid, the own read unpassed)', async () => {
  resetProfPages();
  setPref('gentleActs', false);
  const works = [];
  const use = (book) => setProfessionsPages({
    book, name: (k) => k, withdraw: async () => ({ ok: true, text: '' }), loom: () => ({ kind: 'home', fee: 0 }), clothing: () => 'MensClothing',
    smelt: async (r, n) => { works.push([r, n]); return { ok: true, text: 'worked' }; }, craft: async () => ({ ok: true, text: 'made' }), stock: async () => ({ ok: true, text: '' }),
  });
  use(bookOf({ 'hide:wolf': { own: 2 }, 'p2:12': { own: 2 } }));
  let root = null;
  const draw = () => { root?.remove?.(); root = el('div'); document.body.append(root); drawStoresPage(root, draw, kit); };
  const loom = () => [...root.querySelectorAll('.prof-station')].find((x) => x.querySelector('h3')?.textContent === 'The Loom');
  const text = () => loom().textContent;
  const buttons = () => [...loom().querySelectorAll('button')];
  const NOTE = 'Two Root Tendrils weave into a Linen Bolt here, and two furs - a Rat, Wolf or Tiger Pelt, a Boar or Bear Hide - spin into a Wool Bolt.';
  try {
    draw();
    await buttons().find((b) => b.textContent === 'Spin').onclick();
    assert.deepEqual(works.at(-1), ['spin:wolf', 1]);
    await buttons().find((b) => b.textContent === 'Weave').onclick();
    assert.deepEqual(works.at(-1), ['weave:linen-south', 1]);
    assert.ok(!text().includes(NOTE), 'goods held: the rows, no note');
    use(bookOf({}));
    draw();
    assert.ok(text().includes(NOTE), 'none held: where Linen and Wool come from');
    assert.ok(!buttons().some((b) => b.textContent === 'Spin'));
    // a garment wholly of Linen: the made cloth's 500 while no bought bolt stands, none said once one does
    buttons().find((b) => b.textContent === 'Clothing').onclick();
    buttons().find((b) => b.textContent.startsWith('Straps')).onclick();
    assert.match(text(), /20 Outfitting experience, and 511 more the first time you make this piece at this grade from cloth you wove or spun yourself\./);   // PIN MOVED (FIRST-BUDGET, Professions-Arc 52): Outfitting's first-make share
    use(bookOf({ 'cloth:linen': { own: 4, bought: 1 } }));
    draw();
    assert.match(text(), /20 Outfitting experience\. Cloth you did not weave or spin yourself is used first, and earns no first-time bonus\./);
  } finally {
    setProfessionsPages(null);
    root?.remove?.();
  }
  // the craft's word reads the service's answer: a judged recipe's first paid, or not
  assert.equal(craftXpText(recipeById('garment-141:linen'), { xp: 520, first: true, firstPaid: true }, 'Outfitting'), '(+520 Outfitting experience, with the first-time bonus)');
  assert.equal(craftXpText(recipeById('garment-141:linen'), { xp: 20, first: true, firstPaid: false }, 'Outfitting'), '(+20 Outfitting experience. Your first, but only cloth you wove or spun yourself earns the first-time bonus)');
  assert.equal(craftXpText(recipeById('garment-141:linen'), { xp: 20, first: true }, 'Outfitting'), '(+20 Outfitting experience. Your first, but only cloth you wove or spun yourself earns the first-time bonus)', 'an older service: by the recipe');
  assert.equal(craftXpText(recipeById('garment-149:linen'), { xp: 520, first: true }, 'Outfitting'), '(+520 Outfitting experience, with the first-time bonus)');
});
