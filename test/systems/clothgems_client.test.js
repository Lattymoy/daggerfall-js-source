// CLOTH-GEMS (2026-10-25; the player SaberGGaming's "Profession oversights", the owner: "No band aids") - THE LOOM'S PAGE.
// The loom lists its Linen weaves and Wool spins beside its cures where the Stores or the pack hold their goods, and says
// where Linen and Wool come from where they hold none; a box of a garment wholly of cloth says its first's share and
// when it pays. bible/06-Systems/Professions-Arc.md 50. WOVEN-PAYS (FIELD BUGS 2026-10-26b) and AUDIT WOVEN-PAYS: PIN
// MOVED - the wall is silver, and counted: the box reads the cloth's silver count (ui/professions/profPages.js silverOf -
// the book's silver: the bolts bought with silver not yet used), never the units' origins.
import '../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { xpForRank } from '../../src/net/professionLaw.js';
import { recipeById } from '../../src/net/recipeLaw.js';
import { setProfessionsPages, drawStoresPage, resetProfPages, silverOf } from '../../src/ui/professions/profPages.js';
import { craftXpText } from '../../src/ui/craftXpWords.js';
import { setPref } from '../../src/systems/uiPrefs.js';

const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const kit = { el, divider: (w) => el('h3', null, w), meter: () => el('div') };

/** A book whose Stores hold `stores` ({ key: { own, bought, loose } }), whose bag carries `carried` ({ key: { own, bought } })
 *  and whose cloth's silver counts are `silver` ({ key: n }) - net/profBook.js silver's shape. */
function bookOf(stores = {}, carried = {}, silver = {}) {
  const tracks = new Map([['outfitting', { profession: 'outfitting', xp: xpForRank(10), rank: 10, specs: { 50: null, 100: null } }]]);
  const s = (k) => ({ material: k, own: 0, bought: 0, ...(stores[k] ?? {}) });
  return {
    state: { open: true, day: 1, character: 'c', account: 'a', readAt: Date.now(), stores: new Map(), tracks, today: {}, caps: {}, hunt: { hides: 0, high: 0 } },
    stale: () => false, refresh: async () => ({ ok: true }),
    store: s, carried: (k) => ({ material: k, own: 0, bought: 0, ...(carried[k] ?? {}) }),
    held: (k) => s(k).own + s(k).bought, workable: (k) => s(k).own + s(k).bought + (s(k).loose ?? 0), silver: (k) => silver[k] ?? 0,
    track: (p) => tracks.get(p) ?? { profession: p, xp: 0, rank: 0, specs: { 50: null, 100: null } }, pendingWithdrawals: 0, pendingCrafts: 0,
  };
}

test('AUDIT WOVEN-PAYS silverOf: what keeps a craft from its first is its cloth\'s silver count - the most of its inputs\', whatever the Stores\' or the bag\'s origins (mutants: the count unread; a book without it read as walled)', () => {
  const straps = recipeById('garment-141:linen'), rug = recipeById('rug-237:wool');
  assert.equal(silverOf(bookOf({ 'cloth:linen': { own: 3 } }), straps), 0);
  assert.equal(silverOf(bookOf({ 'cloth:linen': { own: 3, bought: 2, loose: 1 } }, { 'cloth:linen': { bought: 1 } }), straps), 0, 'PIN MOVED (AUDIT WOVEN-PAYS): a bought unit is no silver - the loom\'s own cloth of bought goods, a guildmate\'s');
  assert.equal(silverOf(bookOf({}, {}, { 'cloth:linen': 2 }), straps), 2, 'two bolts bought with silver not yet used - wherever they went');
  assert.equal(silverOf(bookOf({}, {}, { 'cloth:linen': 2 }), rug), 0, 'another cloth\'s count');
  assert.equal(silverOf({ store: () => ({ own: 0, bought: 5 }) }, straps), 0, 'a book without the count reads none');
  assert.equal(silverOf(bookOf(), null), 0);
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
    // a garment wholly of Linen: the share and its condition while no silver count stands, the count said once one does
    buttons().find((b) => b.textContent === 'Clothing').onclick();
    buttons().find((b) => b.textContent.startsWith('Straps')).onclick();
    assert.match(text(), /20 Outfitting experience, and 518 more the first time you make this piece at this grade from cloth not bought with silver\./);   // PIN MOVED (WOVEN-PAYS): the wall named silver   // PIN MOVED (FIRST-BUDGET, Professions-Arc 52): Outfitting's first-make share
    use(bookOf({ 'cloth:linen': { own: 4, bought: 1 } }));
    draw();
    assert.match(text(), /from cloth not bought with silver\./, 'PIN MOVED (AUDIT WOVEN-PAYS): a bought unit is no silver');
    use(bookOf({ 'cloth:linen': { own: 4, bought: 1 } }, {}, { 'cloth:linen': 3 }));
    draw();
    assert.match(text(), /20 Outfitting experience\. Bolts of this cloth bought with silver and not yet used: 3\. Until you have used that many, no piece of it earns a first-time bonus\./);   // PIN MOVED (WOVEN-PAYS)
  } finally {
    setProfessionsPages(null);
    root?.remove?.();
  }
  // the craft's word reads the service's answer: a judged recipe's first paid, or not
  assert.equal(craftXpText(recipeById('garment-141:linen'), { xp: 520, first: true, firstPaid: true }, 'Outfitting'), '(+520 Outfitting experience, with the first-time bonus)');
  // PIN MOVED (WOVEN-PAYS): the wall named silver, and the first still owed
  assert.equal(craftXpText(recipeById('garment-141:linen'), { xp: 20, first: true, firstPaid: false }, 'Outfitting'), '(+20 Outfitting experience. Cloth bought with silver earns no first-time bonus, so this piece\'s is still yours to earn)');
  assert.equal(craftXpText(recipeById('garment-141:linen'), { xp: 20, first: true }, 'Outfitting'), '(+20 Outfitting experience. Cloth bought with silver earns no first-time bonus, so this piece\'s is still yours to earn)', 'an older service: by the recipe');
  assert.equal(craftXpText(recipeById('garment-149:linen'), { xp: 520, first: true }, 'Outfitting'), '(+520 Outfitting experience, with the first-time bonus)');
});
