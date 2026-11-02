// DISC28-C (2026-09-28, Discord screenshot: the shop's Yes/No box with a column of row markers drawn over it).
//
// The confirm box is a scrim appended inside the counter window after the lists (ui/enhanced/enhancedTrade.js boxScrim), at
// position absolute and z-index auto. The rows' furniture climbs out of auto - the wear bar at 1 (WEAR-UI), the sigil
// rune and the padlock at 2 - and nothing between the lists and the scrim makes a stacking context, so every positive
// layer painted over the modal whatever the DOM order. Every shell that raises an .sb-ask box now stands it at a layer
// above anything its rows declare. Read over the real shipped stylesheets, the classic face's and Plus's both: every
// rule under a shell that declares a z-index is found and the box must stand above it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENHANCED_CSS } from '../../../src/ui/enhanced/enhancedStyle.js';
import { PLUS_CSS } from '../../../src/ui/enhanced/enhancedPlusStyle.js';

/** Every innermost rule of a stylesheet as [selectors[], declarations]. */
function rules(css) {
  const out = [];
  const flat = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of flat.matchAll(/([^{}]+)\{([^{}]*)\}/g)) out.push([m[1].split(',').map((x) => x.trim()), m[2]]);
  return out;
}
const zOf = (decls) => { const m = /(?:^|;|\s)z-index:\s*(-?\d+)/.exec(decls); return m ? Number(m[1]) : null; };

const SHEETS = rules(`${ENHANCED_CSS}\n${PLUS_CSS}`);

for (const shell of ['.trade-shell', '.sb-shell', '.tavern-shell']) {
  test(`DISC28-C: ${shell}'s confirm box stands above every layer its rows declare`, () => {
    let box = null;
    let top = 0;
    let highest = '';
    for (const [sels, decls] of SHEETS) {
      const z = zOf(decls);
      if (z === null) continue;
      for (const sel of sels) {
        if (!sel.startsWith(`${shell} `)) continue;
        if (sel === `${shell} .sb-ask`) { box = z; continue; }
        if (sel.includes('.sb-ask')) continue;   // the box's own inside
        if (z > top) { top = z; highest = sel; }
      }
    }
    assert.notEqual(box, null, `${shell} .sb-ask declares its layer`);
    assert.ok(box > top, `the box (${box}) stands above ${highest || 'nothing'} (${top})`);
  });
}

test('DISC28-C: the shop\'s rows do carry layers - the wear bar and the rune are what the box must clear', () => {
  const trade = SHEETS.filter(([sels, d]) => zOf(d) > 0 && sels.some((s) => s.startsWith('.trade-shell ') && !s.includes('.sb-ask')));
  assert.ok(trade.some(([sels]) => sels.includes('.trade-shell .wear')), 'the wear bar');
  assert.ok(trade.some(([sels]) => sels.some((s) => s.includes('[data-sigil]'))), 'the rune');
});
