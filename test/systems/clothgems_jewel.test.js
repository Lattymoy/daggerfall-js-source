// CLOTH-GEMS (2026-10-25; the player SaberGGaming's "Profession oversights", the owner: "No band aids") - EVERY GEM'S
// GRADE AT THE JEWELLER'S BENCH, AS THE CLIENT HOLDS AND DRAWS IT. A graded gem looted into the pack IS its material
// (systems/materialsBag.js materialKeyOfItem - it mapped every one of them to none), counted as held, so a jeweller's
// bench works it and the station's shortfall puts it in by the loose door; a graded gem stays a pack piece the market
// lists from the pack (marketLaw storesForm). The bench shows the gems a grade at a time (ui/professions/profPages.js
// jewelRecipes, gemGradeWord), each recipe's points its grade's. bible/06-Systems/Professions-Arc.md 50.
import '../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { mintGem } from '../../src/systems/gems.js';
import { materialKeyOfItem, heldOf } from '../../src/systems/materialsBag.js';
import { mintMaterialItem } from '../../src/systems/professions/profItems.js';
import { storesForm } from '../../src/net/marketLaw.js';
import { GRADED_GEMS, xpForRank } from '../../src/net/professionLaw.js';
import { recipeById } from '../../src/net/recipeLaw.js';
import { setProfessionsPages, drawStoresPage, resetProfPages, jewelRecipes, jewelPointsLine, gemGradeWord } from '../../src/ui/professions/profPages.js';
import { setPref } from '../../src/systems/uiPrefs.js';

const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const kit = { el, divider: (w) => el('h3', null, w), meter: () => el('div') };

test('CLOTH-GEMS a graded gem in the pack IS its material - minted and read back on its own row, counted as held, a pack piece the market still lists from the pack; DFU\'s own gem as it was (mutants: the graded keys left out of the bag\'s map)', () => {
  for (const g of GRADED_GEMS) {
    const it = mintGem(g.key.slice('gem:'.length));
    assert.deepEqual([it.group, it.templateIndex, materialKeyOfItem(it)], ['Gems', g.templateIndex, g.key], g.key);
    assert.deepEqual([mintMaterialItem(g.key).group, mintMaterialItem(g.key).templateIndex], ['Gems', g.templateIndex], `${g.key}: withdrawn, the gem it came in as`);
    assert.equal(storesForm(it), false, `${g.key}: lists from the pack`);
  }
  const ruby = mintGem('ruby');
  assert.deepEqual([materialKeyOfItem(ruby), storesForm(ruby)], ['gem:ruby', true], 'DFU\'s Ruby, the veins\' material');
  const player = { items: [mintGem('flawless-ruby'), { ...mintGem('flawless-ruby'), stackCount: 2 }, mintGem('perfect-ruby')] };
  assert.deepEqual([heldOf(player, 'gem:flawless-ruby'), heldOf(player, 'gem:perfect-ruby'), heldOf(player, 'gem:ruby')], [3, 1, 0]);
});

test('CLOTH-GEMS the jeweller\'s bench: the gems a grade at a time - the plain grade first shown (DFU\'s eight, the Pearl, the gemless Ring), each grade its eight; a graded gem held in the pack is workable; its points line its grade\'s; a piece that sets no gem shows no grade (mutants: the grade row gone, the list unfiltered)', () => {
  resetProfPages();
  setPref('gentleActs', false);
  assert.deepEqual(['chipped', 'flawed', 'plain', 'flawless', 'perfect'].map(gemGradeWord), ['Chipped', 'Flawed', 'Plain gems', 'Flawless', 'Perfect']);
  assert.deepEqual(jewelRecipes('ring', 'silver').map((r) => r.id), ['ring:silver', ...['ruby', 'emerald', 'sapphire', 'diamond', 'jade', 'turquoise', 'malachite', 'amber', 'pearl'].map((g) => `ring:silver:${g}`)]);
  assert.deepEqual(jewelRecipes('ring', 'gold', 'flawless').map((r) => r.id), ['ruby', 'emerald', 'sapphire', 'diamond', 'jade', 'turquoise', 'malachite', 'amber'].map((g) => `ring:gold:flawless-${g}`));
  assert.deepEqual(jewelRecipes('bracelet', 'gold', 'flawless'), [], 'a bracelet sets none');
  assert.equal(jewelPointsLine(recipeById('ring:gold:chipped-ruby')), '2,025 enchantment points (+12.5%)');
  assert.equal(jewelPointsLine(recipeById('ring:gold:perfect-ruby')), '2,700 enchantment points (+50%)');
  // the bench, a graded gem in the pack: the book's workable (the bag and the pack, counted or not)
  const held = new Map([['metal:silver', 3], ['gem:flawless-ruby', 1]]);
  const tracks = new Map([['smithing', { profession: 'smithing', xp: xpForRank(30), rank: 30, specs: { 50: null, 100: null } }]]);
  const book = {
    state: { open: true, day: 1, character: 'c', account: 'a', readAt: Date.now(), stores: new Map(), tracks, today: {}, caps: {}, hunt: { hides: 0, high: 0 } },
    stale: () => false, refresh: async () => ({ ok: true }), store: (k) => ({ material: k, own: 0, bought: 0 }), carried: (k) => ({ material: k, own: 0, bought: 0 }),
    held: () => 0, workable: (k) => held.get(k) ?? 0,
    track: (p) => tracks.get(p === 'jewelcrafting' ? 'smithing' : p) ?? { profession: p, xp: 0, rank: 0, specs: { 50: null, 100: null } }, pendingWithdrawals: 0, pendingCrafts: 0,
  };
  setProfessionsPages({ book, name: (k) => recipeById(`ring:silver:${k.slice(4)}`)?.madeOf.replace(/^Silver /, '') ?? k, withdraw: async () => ({ ok: true, text: '' }), jeweller: () => ({ kind: 'home', fee: 0 }), craft: async () => ({ ok: true, text: 'made' }) });
  let root = null;
  const draw = () => { root?.remove?.(); root = el('div'); document.body.append(root); drawStoresPage(root, draw, kit); };
  const bench = () => [...root.querySelectorAll('.prof-station')].find((x) => x.querySelector('h3')?.textContent === 'The Jeweler\'s Bench');
  const buttons = () => [...bench().querySelectorAll('button')];
  const rows = () => buttons().filter((b) => b.className.includes('prof-recipe')).map((b) => b.textContent);
  const family = (w) => buttons().find((b) => b.className.includes('prof-family') && b.textContent === w);
  try {
    draw();
    assert.ok(family('Plain gems').className.includes(' on'), 'the plain grade shown first');
    assert.deepEqual(rows().slice(0, 2), ['Silver Ringcan make now', 'Silver Ruby Ringneeds materials']);
    family('Flawless').onclick();
    assert.deepEqual(rows().slice(0, 2), ['Silver Flawless Ruby Ringcan make now', 'Silver Flawless Emerald Ringneeds materials'], 'the pack\'s Flawless Ruby, workable');
    assert.equal(rows().length, 8);
    buttons().find((b) => b.textContent.startsWith('Silver Flawless Ruby Ring')).onclick();
    assert.match(bench().textContent, /Silver Flawless Ruby Ring - rank 0/);
    assert.match(bench().textContent, /2,160 enchantment points \(\+20%\)/, 'Silver\'s none and a Flawless stone\'s 20');
    family('Bracelet').onclick();
    assert.equal(family('Flawless'), undefined, 'no grade where no gem is set');
  } finally {
    setProfessionsPages(null);
    root?.remove?.();
  }
});
