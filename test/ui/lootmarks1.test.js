// LOOT-MARKS (2026-10-12, a player's video: "seeing rarity in the quickloot is quite hard can you make em more visible"):
// each rolled row of the quick loot's plaque carries its tier as a gem of the tier's own colour before its name and a
// wash of it under the row, on Plus's stone and on Grimoire's page (ui/lootTierMarks.js). TAB-WHEEL (Mac: "if there are
// too many you cant click em aynmore and they get cut off hovering over the bars and scrolling would help, dont add a
// scrollbar up there"): the chat's tab strip turns under the mouse wheel, no bar, its cut edges faded. Both looked at in
// Chromium at the change (the plaque with all six tiers under both looks; the strip at rest, turned and at its end).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TIER_MARKS, tierMarkCss, TIER_GEM_PX } from '../../src/ui/lootTierMarks.js';
import { RARITIES } from '../../src/systems/loot/lootRarity.js';
import { ENHANCED_CSS } from '../../src/ui/enhanced/enhancedStyle.js';
import { kitCss, G, RARITY_INK } from '../../src/ui/grimoireDress.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

test('LOOT-MARKS the gem is each tier\'s own colour - the rarity table\'s, every rolled tier and no common (mutant: a colour drifted from the table)', () => {
  assert.deepEqual(Object.keys(TIER_MARKS), Object.keys(RARITIES).filter((k) => k !== 'common'));
  for (const [k, c] of Object.entries(TIER_MARKS)) assert.equal(c, RARITIES[k].colour, k);
  const css = tierMarkCss({ wash: (k) => TIER_MARKS[k], washAlpha: 0.2, edge: '#000' });
  assert.match(css, new RegExp(`\\.wplaque-row\\[data-rarity\\] > span:first-child::before \\{ content: ''; display: inline-block; width: ${TIER_GEM_PX}px;`));
  for (const [k, c] of Object.entries(TIER_MARKS)) {
    assert.ok(css.includes(`.wplaque-row[data-rarity="${k}"] > span:first-child::before { background: ${c}; }`), `${k}: its gem`);
    assert.match(css, new RegExp(`\\.wplaque-row\\[data-rarity="${k}"\\] \\{ background: linear-gradient\\(90deg, rgba\\(`), `${k}: its wash`);
  }
  assert.match(css, /\.wplaque-row\[data-rarity="gilded"\] > span:first-child::before \{ box-shadow: inset 0 0 0 2px #f6c945/, 'the Gilded\'s gem is set - its crimson in the crown\'s gold');   // PIN MOVED (GILDED-RED): the leaf's pale rim was there so the gold gem never read as the Rare's; the crimson stone is set in the crown's gold - test/ui/gildedred.test.js
  assert.doesNotMatch(css, /data-rarity="common"/);
});

test('LOOT-MARKS worn on both looks: Plus\'s stone washes in the tier\'s own colour and keeps the lit row\'s band under it; the page washes in the tier\'s ink, over the ink pass (mutants: a sheet without the marks; the page\'s wash in the pale colour)', () => {
  assert.ok(ENHANCED_CSS.includes(tierMarkCss({ wash: (k) => TIER_MARKS[k], washAlpha: 0.2, edge: '#0b0805', selGround: 'rgba(125,116,96,0.28)' })), 'Plus');
  const page = tierMarkCss({ scope: G, wash: (k) => RARITY_INK[k], washAlpha: 0.3, edge: '#140b04', bang: true });
  assert.ok(kitCss().includes(page), 'Grimoire');
  assert.match(page, /\.wplaque-row\[data-rarity="magic"\] \{ background: linear-gradient\(90deg, rgba\(31, 79, 158, 0\.3\)/, 'the page\'s wash is the tier\'s ink (#1f4f9e)');
});

test('TAB-WHEEL the strip turns under the wheel with no bar, the page held while it can turn; a cut edge fades; a tab chosen comes wholly in (mutants: the wheel left to the page; a bar shown; no fade)', () => {
  const p = src('src/ui/chatPanel.js');
  assert.match(p, /\.dfchat-tablist \{[^}]*overflow-x: auto; scrollbar-width: none; \}/, 'no bar');
  assert.match(p, /\.dfchat-tablist::-webkit-scrollbar \{ display: none; \}/);
  assert.match(p, /tabList\.addEventListener\('wheel', \(e\) => \{\n\s*const over = [^\n]*\n\s*if \(!\(over > 1\)\) return;\n\s*const d = \(Math\.abs\(e\.deltaX\) > Math\.abs\(e\.deltaY\) \? e\.deltaX : e\.deltaY\)[^\n]*\n\s*if \(!d\) return;\n\s*const was = tabList\.scrollLeft;\n\s*tabList\.scrollLeft = Math\.max\(0, Math\.min\(over, was \+ d\)\);\n\s*if \(tabList\.scrollLeft !== was\) e\.preventDefault\(\);/);
  assert.match(p, /\}, \{ passive: false \}\);\n\s*tabList\.addEventListener\('scroll', tabEdges\);/, 'not passive: it may hold the page');
  for (const side of ['right', 'left', 'both']) assert.match(p, new RegExp(`\\.dfchat-tablist\\[data-more="${side}"\\] \\{ -webkit-mask-image: linear-gradient`), side);
  assert.match(p, /b\.scrollIntoView\?\.\(\{ block: 'nearest', inline: 'nearest' \}\); \}\);/);
});
