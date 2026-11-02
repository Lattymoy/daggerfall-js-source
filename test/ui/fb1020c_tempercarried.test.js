// FB1020c TEMPER-CARRIED (found tracing FIELD BUGS 2026-10-20c's "the crafting station ... dont have any craft buttons"):
// CRAFT4's Temper at the Anvil and Temper at the Loom (bible/06-Systems/Professions-Arc.md 41.7) stood in the Stores
// page's station list for a book that carries nothing - and every live book carries (BAG1: scenes/world.js hands the book
// its carry), whose page (ui/professions/profPages.js drawCarryStores) listed no temper. A smith's or a tailor's temper
// was drawn nowhere in the game. The carrying page lists both, beside the anvil and the loom.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../../src/systems/professions/profTemplates.js';
import { RECIPES } from '../../src/net/recipeLaw.js';
import { temperableRecipe } from '../../src/net/temperLaw.js';
import { xpForRank, trackOf } from '../../src/net/professionLaw.js';
import { setProfessionsPages, drawStoresPage, resetProfPages } from '../../src/ui/professions/profPages.js';
import { withDom } from '../invdrag.mjs';

/** A book that carries, as every live one does, its smith and tailor at rank 60. */
const carryingBook = () => {
  const tracks = new Map([['smithing', { profession: 'smithing', xp: xpForRank(60), rank: 60, specs: { 50: null, 100: null } }], ['outfitting', { profession: 'outfitting', xp: xpForRank(60), rank: 60, specs: { 50: null, 100: null } }]]);
  return {
    state: { open: true, day: 1, character: 'c', account: 'a', readAt: Date.now(), stores: new Map(), tracks, today: {}, caps: null, carried: new Map() },
    stale: () => false, refresh: async () => ({ ok: true }), held: () => 0, store: (k) => ({ material: k, own: 0, bought: 0 }), carried: () => null,
    track: (p) => tracks.get(trackOf(p)) ?? { profession: trackOf(p), xp: 0, rank: 0, specs: { 50: null, 100: null } }, materials: () => [],
    pendingWithdrawals: 0, pendingCrafts: 0, pendingDeposits: 0, choose: async () => ({ ok: true }), carrying: () => true,
  };
};
/** Every text the page drew, and its buttons' words. */
const texts = (node, out = []) => { if (node?.textContent && !node.children?.length) out.push(node.textContent); for (const c of node?.children ?? []) texts(c, out); return out; };

for (const [where, profession, heading, station] of [['anvil', 'smithing', 'Temper at the Anvil', 'forge'], ['loom', 'outfitting', 'Temper at the Loom', 'loom']]) {
  test(`TEMPER-CARRIED: a carrying book's Stores page at a ${station} draws ${heading} - its piece and its Temper press - and its tile reads Here (mutants: the ${where}'s row dropped)`, () => {
    const r = RECIPES.find((x) => x.profession === profession && temperableRecipe(x) && x.rank <= 60);
    assert.ok(r, `a temperable ${profession} recipe`);
    withDom((dom) => {
      resetProfPages();
      setProfessionsPages({
        book: carryingBook(), name: (k) => k, withdraw: async () => ({ ok: true, text: '' }),
        forge: () => (station === 'forge' ? { kind: 'shop', fee: 50 } : null), loom: () => (station === 'loom' ? { kind: 'shop', fee: 50 } : null),
        workbench: () => null, smelt: async () => ({ ok: true, text: '' }), craft: async () => ({ ok: true, text: '' }), stock: async () => ({ ok: true, text: '' }),
        heatBand: () => 1, planeBand: () => 1, stitchBand: () => 1, clothing: () => 'MensClothing', purse: () => 10_000,
        inTown: () => true, room: () => 0, carriedHeld: () => 0, heldKeys: () => [], bag: () => ({ has: true, kg: 0, max: 300, count: 0 }), deposit: async () => [],
        temperable: (w) => (w === where ? [{ item: {}, recipe: r.id, name: r.name, quality: 1 }] : []), temper: async () => ({ ok: true, text: '' }),
      });
      const el = (tag, cls, t) => { const n = dom.mk(tag); if (cls) n.className = cls; if (t != null) n.textContent = t; return n; };
      const root = el('div');
      drawStoresPage(root, () => {}, { el, divider: (w) => el('h3', null, w), meter: () => el('div') });
      const said = texts(root);
      assert.ok(said.includes(heading), `${heading} drawn`);
      assert.ok(said.includes(r.name), 'its piece listed');
      assert.ok(root.querySelectorAll('button').some((b) => b.textContent === 'Temper'), 'its press');
      const tile = root.querySelectorAll('.prof-stile').find((t) => t.attrs['data-station'] === `temper-${where}`);
      assert.ok(tile?.className.includes('here'), 'its tile reads Here');
    });
    setProfessionsPages(null);
  });
}
