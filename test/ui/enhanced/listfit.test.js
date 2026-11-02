// LIST-FIT (2026-09-27, kurkku on Discord: "Equipment sprites too big for the boxes" - a shop list whose pauldrons and
// dai-katana hung out of their framed boxes into the rows beneath, the spellbook's plain one fitting). The base tile
// is a GRID (enhancedStyle.js), and a grid's auto row gives a picture's `max-height: 100%` - the tier frame's cap
// (AUDIT MERGE-PLUS D2) - nothing to resolve against: only the width was held. The loot window's tile has been a flex
// room since UI1 and held both; the shop's and a player trade's are too now. Measured in Chromium over the injected
// sheets (a pauldron, a dai-katana, a staff, a spellbook; fitted, Morrowind-square, grid-sized and raw 2x pictures):
// eight tiered trade rows overflowed before, none after.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PLUS_CSS } from '../../../src/ui/enhanced/enhancedPlusStyle.js';
import { ENHANCED_CSS } from '../../../src/ui/enhanced/enhancedStyle.js';

const rules = (css) => [...css.replace(/\/\*[^]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .map((m) => ({ sels: m[1].split(',').map((s) => s.trim()), body: m[2] }));
/** The LAST rule naming `sel` whose body says `prop`, or null (auditmergeplus_ui.test.js's reader). */
const ruleFor = (list, sel, prop) => list.filter((r) => r.sels.includes(sel) && new RegExp(`(?:^|[\\s;])${prop}:`).test(r.body)).at(-1) ?? null;
const valueOf = (rule, prop) => new RegExp(`(?:^|[\\s;])${prop}:\\s*([^;]+);`).exec(rule?.body ?? '')?.[1]?.trim() ?? null;

test('LIST-FIT: a list tile whose tiered picture is capped at 100% is a FLEX room, centred - the grid held only the width', () => {
  const base = rules(ENHANCED_CSS), plus = rules(PLUS_CSS);
  assert.equal(valueOf(ruleFor(base, '.tile', 'display'), 'display'), 'grid', 'the base tile is the grid the cap could not resolve in');
  for (const sel of ['.trade-shell .itemrow[data-rarity] .tile img', '.pack-shell .loot-win .itemrow[data-rarity] .tile img']) {
    assert.equal(valueOf(ruleFor(plus, sel, 'max-height'), 'max-height'), '100%', `${sel}: the tier frame's percentage cap`);
  }
  for (const tile of ['.trade-shell .itemrow .tile', '.pack-shell .itemrow .tile']) {
    const sheet = tile.startsWith('.trade') ? plus : base;
    assert.equal(valueOf(ruleFor(sheet, tile, 'display'), 'display'), 'flex', `${tile}: a flex room, where 100% of its height is its height`);
    assert.equal(valueOf(ruleFor(sheet, tile, 'align-items'), 'align-items'), 'center', `${tile}: centred down`);
    assert.equal(valueOf(ruleFor(sheet, tile, 'justify-content'), 'justify-content'), 'center', `${tile}: and across`);
    assert.ok(!ruleFor(sheet, tile, 'overflow'), `${tile}: never clipped instead - the sigil rune and the padlock stand past its edge`);
  }
  // a player trade is a trade-shell too, so the one rule holds it
  assert.match(readFileSync(new URL('../../../src/ui/enhanced/enhancedPlayerTrade.js', import.meta.url), 'utf8'), /el\('div', 'px-home px-over trade-shell ptrade-shell'\)/);
});
