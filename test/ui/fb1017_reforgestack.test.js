// REFORGE-STACK (FIELD BUGS 2026-10-17, bible/01-Overview/bugs/Field-Bugs-2026-10-17.md; the Discord, "Interface of
// enchanting workbench": "As you can see, buttons are on on another"). The enchanting station's Reforge with Essence drew
// a press a reforgeable line, every one of them a child of the piece's `.prof-smelt` row - and PROF_CSS places a row's
// `.act` in one cell (`grid-column: 3; grid-row: 1`, AUDIT 32 P7), so the presses drew on one another and the button
// track squeezed the piece's name to nothing (measured in Chromium at 260 and 428 px: every press of a row at one box,
// the name 0 px wide). The presses stand in a block of their own under the piece, and a row's short word spans the row.
import { byClass } from '../chargenDom.mjs';   // the suite's minimal DOM (its side effect: the globals)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROF_CSS } from '../../src/ui/enhanced/enhancedPlusStyle.js';
import { setProfessionsPages, drawStoresPage } from '../../src/ui/professions/profPages.js';
import { xpForRank, ARCANE_ESSENCE } from '../../src/net/professionLaw.js';
import { applyRarity, reforgeableLines, affixLine } from '../../src/systems/loot/lootRarity.js';
import { weaponOfMaterial } from '../../src/combat/enemyEquipment.js';
import { seededRng } from '../../src/systems/wind/wind.js';

/** A CSS rule's body by its exact selector, a rule that opens its own line (never one inside an @media's), or null. */
const ruleOf = (css, selector) => new RegExp(`^${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`, 'm').exec(css)?.[1] ?? null;

test('REFORGE-STACK: PROF_CSS - the presses\' block spans the row, a press a line down it; a row\'s short word spans the row, never the count\'s track', () => {
  assert.match(ruleOf(PROF_CSS, '.prof-smelt > .prof-lines') ?? '', /^ grid-column: 1 \/ -1; display: flex; flex-direction: column; gap: 4px; $/);
  assert.match(ruleOf(PROF_CSS, '.prof-smelt > .prof-short') ?? '', /^ grid-column: 1 \/ -1; $/);
  // the row's button track is one cell (AUDIT 32 P7's placement, unchanged): what spans the row is what keeps a press out of it
  assert.match(PROF_CSS, /\.prof-smelt \.act \{ grid-column: 3; grid-row: 1; \}/);
});

test('REFORGE-STACK: the station drawn off the game\'s own pieces - each piece\'s presses in one block of the row, none in its button track; Essence short, the word a row\'s own', () => {
  const held = new Map([[ARCANE_ESSENCE.key, 30]]);
  const book = {
    state: { open: true, day: 1, character: 'c', account: 'a', readAt: Date.now(), stores: new Map(), tracks: new Map(), today: {}, caps: null }, stale: () => false, refresh: async () => ({ ok: true }),
    held: (k) => held.get(k) ?? 0, store: (k) => ({ material: k, own: held.get(k) ?? 0, bought: 0, gold: 0 }),
    track: (p) => ({ profession: p, xp: xpForRank(p === 'enchanting' ? 60 : 0), rank: p === 'enchanting' ? 60 : 0, specs: { 50: null, 100: null } }), materials: () => [],
    pendingWithdrawals: 0, pendingCrafts: 0,
  };
  // the host's own offer (scenes/world.js reforgeable): a line a reforgeable affix, its words affixLine's
  const pieces = ['magic', 'rare'].map((tier, i) => {
    const it = weaponOfMaterial(120, 1);
    applyRarity(it, tier, seededRng(11 + i));
    it.isIdentified = true;
    return { item: it, name: `Amulet ${i}`, tier, lines: reforgeableLines(it).map((index) => ({ index, text: affixLine(it, index) })) };
  });
  assert.deepEqual(pieces.map((p) => p.lines.length), [2, 3], 'the report\'s case: more than one line a piece');
  const home = () => ({ kind: 'home', fee: 0 });
  setProfessionsPages({
    book, name: (k) => k, withdraw: async () => ({ ok: true, text: '' }), enchanter: home, disenchant: async () => ({ ok: true, text: '' }), disenchantable: () => [],
    reforgeable: () => pieces, essenceReforge: async () => ({ ok: true, text: 'Reforged.' }),
  });
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const root = el('div');
  const draw = () => { root.textContent = ''; drawStoresPage(root, draw, { el, divider: (w) => el('h3', null, w), meter: () => el('div') }); };
  try {
    draw();
    const rows = () => byClass(root, 'prof-smelt').filter((r) => /Arcane Essence a line/.test(r.textContent));
    assert.equal(rows().length, 2);
    rows().forEach((row, i) => {
      assert.equal(row.children.filter((c) => c.tagName === 'BUTTON').length, 0, 'no press in the row\'s button track');
      const blocks = row.children.filter((c) => c.className === 'prof-lines');
      assert.equal(blocks.length, 1, 'one block of presses, a child of the row');
      assert.deepEqual(blocks[0].children.map((b) => [b.tagName, b.className, b.textContent, b.disabled]),
        pieces[i].lines.map((l) => ['BUTTON', 'act', `Reforge: ${l.text}`, false]), 'a press a line, in the line\'s order');
      assert.equal(row.children.at(-1), blocks[0], 'the presses under the piece\'s words');
    });
    held.set(ARCANE_ESSENCE.key, 1);
    draw();
    for (const row of rows()) {
      const short = row.children.filter((c) => c.className === 'prof-short');
      assert.equal(short.length, 1, 'the Essence short, said');
      assert.match(short[0].textContent, /^Needs \d Arcane Essence; your Stores hold 1\.$/);
      assert.ok(row.children.indexOf(short[0]) < row.children.indexOf(byClass(row, 'prof-lines')[0]), 'said above the presses');
      assert.ok(byClass(row, 'act').every((b) => b.disabled), 'and none pressed');
    }
  } finally { setProfessionsPages(null); }
});
