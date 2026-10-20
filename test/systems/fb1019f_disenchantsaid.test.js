// FIELD BUGS 2026-10-19f (DISENCHANT-SAID) - a player's private report: crafted greaves and pauldrons could not be
// disenchanted. PROF12 (bible/06-Systems/Professions-Arc.md 9.3, 37) gives a piece its DFU template's enchantment points,
// one Arcane Essence a hundred: Greaves 50, either Pauldron 40 - none at any metal (net/alchemyLaw.js piecePoints,
// essenceOf), and the service refuses them (server-account/src/alchemy.js, prof-no-essence). The Enchanting Station's
// list dropped them in the host (scenes/world.js, `essence > 0`), and the page explained only a list with nothing on it,
// so the greaves vanished without a word. The owner (2026-10-19): "List them greyed with the reason" - no change to the
// law or the service. HOST-SPLIT: the list is made by the page's own module (ui/professions/profPages.js
// disenchantableOf) and the host keeps one wiring line. Every piece the real producer's (systems/smithItems.js mintPiece).
import '../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mintPiece } from '../../src/systems/smithItems.js';
import { RECIPES } from '../../src/net/recipeLaw.js';
import { equipItem } from '../../src/systems/equip.js';
import { setLocked } from '../../src/systems/item/itemLock.js';
import { xpForRank, trackOf, ENCHANT_FEE } from '../../src/net/professionLaw.js';
import { DISENCHANTER, ESSENCE_POINTS } from '../../src/net/alchemyLaw.js';
import { setProfessionsPages, drawStoresPage, resetProfPages, disenchantableOf, ENCHANT_UNDER_LINE } from '../../src/ui/professions/profPages.js';
import { hostText } from '../hostText.mjs';

let n = 0;
/** A crafted piece of `recipe`, as the anvil's craft mints it (its provenance the service's id). */
const piece = (recipe) => mintPiece({ recipe, quality: 1, seed: ++n, maker: 'Ysolde' }, (0xa0 + n).toString(16).padStart(16, '0'));
/** The Professions book as profBook's: its Enchanting track at `rank`, its spec at 50. */
const bookOf = ({ rank = 0, spec50 = null } = {}) => {
  const tracks = new Map([['enchanting', { profession: 'enchanting', xp: xpForRank(rank), rank, specs: { 50: spec50, 100: null } }]]);
  return {
    state: { open: true, day: 1, character: 'c', account: 'a', readAt: Date.now(), stores: new Map(), tracks, today: {}, caps: {}, hunt: { hides: 0, high: 0 } },
    stale: () => false, refresh: async () => ({ ok: true }), held: () => 0, pendingWithdrawals: 0, pendingCrafts: 0, choose: async () => ({ ok: true }),
    track: (p) => tracks.get(trackOf(p)) ?? { profession: trackOf(p), xp: 0, rank: 0, specs: { 50: null, 100: null } },
  };
};
const el = (tag, cls, text) => { const x = document.createElement(tag); if (cls) x.className = cls; if (text != null) x.textContent = text; return x; };
const kit = { el, divider: (w) => el('h3', null, w), meter: () => el('div') };
/** The Stores page at a Mages Guild hall's enchanting station, its list the real list of `pack`; the disenchants it asks, kept. */
function station(pack, book = bookOf()) {
  resetProfPages();
  const calls = [];
  setProfessionsPages({
    book, name: (k) => k, withdraw: async () => ({ ok: true, text: '' }), purse: () => 1000,
    enchanter: () => ({ kind: 'shop', fee: ENCHANT_FEE }),
    disenchantable: () => disenchantableOf(pack, { book }),
    disenchant: async (pv) => { calls.push(pv); return { ok: true, text: 'apart' }; },
  });
  let root = null;
  const draw = () => { root?.remove?.(); root = el('div'); document.body.append(root); drawStoresPage(root, draw, kit); };
  draw();
  const rows = () => [...root.querySelectorAll('div')].filter((d) => /\bprof-smelt\b/.test(d.className) && d.querySelector('b'));
  return {
    calls, text: () => root.textContent,
    row: (name) => rows().find((d) => d.querySelector('b').textContent === name) ?? null,
    names: () => rows().map((d) => d.querySelector('b').textContent),
    done() { root?.remove?.(); setProfessionsPages(null); },
  };
}
const NONE = 'No crafted piece in your pack has enough enchantment to give Essence.';   // PIN MOVED (the merges of main): VOICE2's words, then PLAIN-SWEEP's

test('DISENCHANT-SAID: the station\'s list keeps a piece under one Essence - the Greaves (50) and Pauldrons (40), at every metal and of chain and leather, Essence 0; a Cuirass 4 and Boots 1 as before; a Disenchanter\'s twice; a form with no points (a dish, a tool), loot, a worn, a locked and a kept piece left off (mutants: the essence filter back; a form with none listed; the Disenchanter unread)', () => {
  const [greaves, lp, rp, cuirass, boots, chain, leather, stew, pick, worn, locked, kept] = ['greaves:iron', 'lpauldron:iron', 'rpauldron:silver', 'cuirass:iron',
    'boots:iron', 'chain-greaves:steel', 'leather-greaves:cured', 'stew:north', 'pickaxe:iron', 'greaves:steel', 'cuirass:steel', 'greaves:daedric'].map(piece);
  const player = { items: [] };
  player.items.push(worn);
  equipItem(player, worn);
  assert.notEqual(worn.equipSlot, undefined, 'the worn greaves are worn');
  setLocked(locked, true);
  const loot = { ...greaves, provenance: undefined, recipe: undefined };
  const pack = [greaves, lp, rp, cuirass, boots, chain, leather, stew, pick, worn, locked, kept, loot];
  const listed = disenchantableOf(pack, { kept: (pv) => pv === kept.provenance });
  assert.deepEqual(listed.map((x) => [x.name, x.points, x.essence, x.recipe]), [
    ['Iron Greaves', 50, 0, 'greaves:iron'], ['Iron Left Pauldron', 40, 0, 'lpauldron:iron'], ['Silver Right Pauldron', 40, 0, 'rpauldron:silver'],
    ['Iron Cuirass', 400, 4, 'cuirass:iron'], ['Iron Boots', 175, 1, 'boots:iron'], ['Chain Greaves', 50, 0, 'chain-greaves:steel'], ['Leather Greaves', 50, 0, 'leather-greaves:cured'],
  ]);
  assert.deepEqual(listed[0], { provenance: greaves.provenance, name: 'Iron Greaves', points: 50, essence: 0, recipe: 'greaves:iron' }, 'its provenance, the one the service is asked by');
  // a Disenchanter's twice - and twice nothing is nothing
  const twice = disenchantableOf(pack, { kept: (pv) => pv === kept.provenance, book: bookOf({ rank: 50, spec50: DISENCHANTER }) });
  assert.deepEqual(twice.map((x) => x.essence), [0, 0, 0, 8, 2, 0, 0]);
  // every recipe's Greaves and Pauldrons - each metal's plate, the chain, the leather - listed under one: the law's (a
  // hundred points an Essence), 50 and 40
  const legs = RECIPES.filter((r) => /^(chain-|leather-)?(greaves|lpauldron|rpauldron):/.test(r.id)).map((r) => piece(r.id));
  assert.equal(legs.length, 42, 'eleven metals\' plate, the chain\'s and the leather\'s two');
  assert.deepEqual(disenchantableOf(legs).map((x) => [x.recipe, x.points, x.essence]), legs.map((x) => [x.recipe, /greaves/.test(x.recipe) ? 50 : 40, 0]));
  assert.equal(ESSENCE_POINTS, 100);
});

test('DISENCHANT-SAID: the page lists the Greaves and Pauldrons greyed with the reason, and refuses them - their Disenchant disabled and never asked; the Cuirass and the Boots listed as before and taken apart; nothing that gives Essence, the station still says so (mutants: the greyed row drawn as any other; its button live; the reason unsaid; the none line read off the length)', async () => {
  const [greaves, lp, cuirass, boots] = ['greaves:iron', 'lpauldron:iron', 'cuirass:iron', 'boots:iron'].map(piece);
  let page = station([greaves, lp, cuirass, boots]);
  try {
    assert.deepEqual(page.names(), ['Iron Greaves', 'Iron Left Pauldron', 'Iron Cuirass', 'Iron Boots'], 'every crafted piece listed, in the pack\'s order');
    for (const [name, points] of [['Iron Greaves', 50], ['Iron Left Pauldron', 40]]) {
      const r = page.row(name);
      assert.equal(r.className, 'prof-smelt prof-locked', `${name}: greyed`);
      assert.equal(r.textContent, `${name}${points} points. One Arcane Essence needs 100.${'Disenchant'}`, `${name}: the reason`);
      assert.equal(ENCHANT_UNDER_LINE(points), `${points} points. One Arcane Essence needs 100.`);
      const b = r.querySelector('button');
      assert.deepEqual([b.textContent, b.disabled, b.onclick ?? null], ['Disenchant', true, null], `${name}: never pressed`);
    }
    assert.equal(page.row('Iron Cuirass').className, 'prof-smelt');
    assert.match(page.row('Iron Cuirass').textContent, /^Iron Cuirass400 points: 4 Arcane Essence, \+\d+ Enchanting experienceDisenchant$/);
    assert.match(page.row('Iron Boots').textContent, /^Iron Boots175 points: 1 Arcane Essence, \+\d+ Enchanting experienceDisenchant$/, 'one Essence is one: listed as before');
    assert.equal(page.text().includes(NONE), false, 'a piece gives Essence: no none line');
    const go = page.row('Iron Cuirass').querySelector('button');
    assert.equal(go.disabled, false);
    go.onclick();
    page.row('Iron Cuirass').querySelector('button').onclick();
    for (let i = 0; i < 20 && !page.calls.length; i++) await new Promise((r) => setTimeout(r, 5));
    assert.deepEqual(page.calls, [cuirass.provenance], 'the cuirass, pressed twice, asked once');
  } finally { page.done(); }
  // the Greaves and Pauldrons alone: the station says nothing gives Essence, and each row why
  page = station([greaves, lp]);
  try {
    assert.ok(page.text().includes(NONE));
    assert.deepEqual(page.names(), ['Iron Greaves', 'Iron Left Pauldron']);
    assert.equal(page.row('Iron Greaves').className, 'prof-smelt prof-locked');
  } finally { page.done(); }
  // the Boots alone (one Essence): no none line
  page = station([boots]);
  try { assert.equal(page.text().includes(NONE), false); } finally { page.done(); }
});

test('DISENCHANT-SAID: the host wires the list and makes none of it - one line, no filter of its own (HOST-SPLIT)', () => {
  const w = hostText('src/scenes/world.js');
  assert.match(w, /\n\s*disenchantable: \(\) => disenchantableOf\(playerEntity\.items, \{ kept: pieceKept, book: profBook \}\),\n/);
  assert.equal(/x\.essence > 0/.test(w), false, 'the host\'s filter gone');
  assert.equal(/essenceOf\(|piecePoints\(/.test(w), false, 'no Essence reckoned in the host');
});
