// RENOWN4b (2026-09-25, Mac: "ensure the new xp bar doesnt overlap anything"; asked how, "CSS math only" - no browser
// probe): THE RENOWN ROW, MODELLED FROM THE SHEET'S OWN NUMBERS. The HUD's bottom column is a centred flex column
// scaled from its bottom edge; the quickslot block is a corner anchored at a fixed height; a touch screen's buttons
// hold the bottom-right. The model below is those rules as arithmetic - and the pins under it hold the sheet to every
// number the model reads, so the two cannot drift apart. Over every width, scale, dress (Enhanced, Plus), pointer
// (mouse, touch), safe area and status row, it asks: the Renown row never meets the quickslot block or the touch
// buttons, and never pushes the vitals into the block where they did not already meet it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** Every box, y measured UP from the viewport's bottom edge, x from its left. `row` the Renown row lit; `chips` a
 *  status row of chips (24px) under the vitals; `stick` the touch stick's corner taken (the block's `stickclear`). */
function layout({ W, s, plus, touch, row, chips = false, safe = 0, stick = false }) {
  const phone = W <= 860;
  const B = phone ? 12 : 22;                                  // .hud-bottom's bottom (phone rule: 12px)
  const g = phone ? 8 : 10;                                   // .hud-bottom's gap (phone rule: 8px)
  const tw = plus ? Math.min(190, 0.23 * W) : phone ? 0.26 * W : Math.min(190, 0.23 * W);   // the vital's track
  const bg = plus ? 16 : phone ? 10 : 14;                     // .hud-bars' gap (Plus: 16 at every width)
  const VW = 3 * tw + 2 * bg, VH = 20;
  const RW = plus ? 3 * Math.min(190, 0.23 * W) + 32 : phone ? 0.78 * W + 20 : 3 * Math.min(190, 0.23 * W) + 28;
  const RH = 22;
  // the status row under the vitals: plain Enhanced always stands its (empty) effects row, whose gap counts; Plus's
  // one status row is gone when empty
  const status = chips ? 24 : plus ? null : 0;
  const m = !touch ? 0 : phone ? Math.max(0, (56 + safe) / s - 28) : Math.max(0, (46 + safe) / s - 30);
  // bottom -> top
  const items = [];
  if (status !== null) items.push({ k: 'status', h: status });
  if (touch) { items.push({ k: 'vitals', h: VH }); if (row) items.push({ k: 'renown', h: RH, mb: m }); }
  else { if (row) items.push({ k: 'renown', h: RH }); items.push({ k: 'vitals', h: VH }); }
  const at = {};
  let y = B, first = true;
  for (const it of items) {
    if (!first) y += g * s;
    y += (it.mb ?? 0) * s;
    at[it.k] = { y0: y, y1: y + it.h * s };
    y += it.h * s;
    first = false;
  }
  const box = (w, k) => (at[k] ? { x0: W / 2 - (w * s) / 2, x1: W / 2 + (w * s) / 2, ...at[k] } : null);
  const vitals = box(VW, 'vitals');
  const renown = box(RW, 'renown');
  // the quickslot block: its corner, its width (padding, box, padding) and its bottom edge
  const left = stick ? (phone ? 160 : 156) : (phone ? 14 : 24);
  const bw = phone ? 24 + 124 + 24 : 30 + 172 + 30;
  let qb;
  if (row && touch && chips) qb = phone ? Math.max(14 + 82 * s, 70 + 54 * s) : Math.max(24 + 86 * s, 70 + 56 * s);
  else if (row && touch) qb = phone ? Math.max(14 + 58 * s, 70 + 30 * s) : Math.max(24 + 62 * s, 70 + 32 * s);
  else if (row) qb = phone ? 46 + 60 * s : 22 + 64 * s;
  else qb = phone ? 76 + 30 * (s - 1) : 22 + 32 * s;
  const quick = { x0: left, x1: left + bw * s, y0: qb + safe };
  const buttons = touch ? { x0: W - 280, x1: W - 16, y0: 16 + safe, y1: 64 + safe } : null;
  return { vitals, renown, quick, buttons };
}
const xMeet = (a, b) => a.x0 < b.x1 && b.x0 < a.x1;
const under = (a, q) => !xMeet(a, q) || a.y1 <= q.y0 + 1e-9;   // a row is clear of the block when it stands below its bottom
const apart = (a, b) => !(xMeet(a, b) && a.y0 < b.y1 && b.y0 < a.y1);

const WIDTHS = [360, 390, 430, 600, 768, 844, 860, 1024, 1280, 1366, 1440, 1920, 2560];
const SCALES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

test('RENOWN4b the model: over every width, HUD scale, dress, pointer, safe area and status row, the lit Renown row never meets the quickslot block or the touch buttons, never runs past the vitals\' own span (they are the widest row, and where they run off a narrow screen at a large scale, so does everything under them), and never pushes the vitals into the block where they stood clear without it (mutants: the block not lifted on a desk; on a phone; on a touch screen; the row left under the vitals on a touch screen; its margin unscaled)', () => {
  let cases = 0;
  for (const W of WIDTHS) for (const s of SCALES) for (const plus of [false, true]) for (const touch of [false, true])
    for (const chips of [false, true]) for (const safe of touch ? [0, 34] : [0]) for (const stick of touch ? [false, true] : [false]) {
      const on = layout({ W, s, plus, touch, row: true, chips, safe, stick });
      const off = layout({ W, s, plus, touch, row: false, chips, safe, stick });
      const tag = `${W}px x${s} ${plus ? 'Plus' : 'Enhanced'} ${touch ? 'touch' : 'mouse'}${chips ? ' chips' : ''}${safe ? ` safe${safe}` : ''}${stick ? ' stick' : ''}`;
      assert.ok(under(on.renown, on.quick), `${tag}: the Renown row meets the quickslot block`);
      if (on.buttons) assert.ok(apart(on.renown, on.buttons), `${tag}: the Renown row meets the touch buttons`);
      assert.ok(on.renown.x0 >= on.vitals.x0 - 1e-9 && on.renown.x1 <= on.vitals.x1 + 1e-9, `${tag}: the Renown row runs past the vitals' own span`);
      if (under(off.vitals, off.quick)) assert.ok(under(on.vitals, on.quick), `${tag}: the Renown row pushed the vitals into the block`);
      cases++;
    }
  assert.ok(cases > 1000, `${cases} cases`);
  // THE FINDING, in the model's own terms: without the lift a 1024px desk at scale 1 put the magicka bar in the diamond
  const was = layout({ W: 1024, s: 1, plus: false, touch: false, row: true });
  was.quick.y0 = 22 + 32;
  assert.equal(under(was.vitals, was.quick), false, 'the bug this fixes');
});

test('RENOWN4b the sheet: every number the model reads is the sheet\'s - the column, the vitals, the row, the block and its lifts, the touch order and margins, Plus\'s widths (mutants: any of them moved without the model)', async () => {
  const { ENHANCED_CSS } = await import('../src/ui/enhancedStyle.js');
  const { PLUS_CSS } = await import('../src/ui/enhancedPlusStyle.js');
  const C = ENHANCED_CSS;
  // the column and the vitals (desk and phone)
  assert.match(C, /\.hud-bottom \{ position: absolute; left: 50%; bottom: 22px;\n\s*transform: translateX\(-50%\) scale\(var\(--hud-scale\)\); transform-origin: bottom center;\n\s*display: flex; flex-direction: column; align-items: center; gap: 10px; \}/);
  assert.match(C, /\.hud-bottom \{ bottom: 12px; gap: 8px; \}/);
  assert.match(C, /\.hud-bars \{ display: flex; align-items: center; gap: 14px; \}/);
  assert.match(C, /\.hud-bars \{ gap: 10px; \}/);
  assert.match(C, /\.hud-vital \.hud-track \{ width: min\(190px, 23vw\); height: 20px;/);
  assert.match(C, /\.hud-vital \.hud-track \{ width: 26vw; \}/);
  assert.match(C, /\.hud-effects \{ display: flex; flex-wrap: wrap;/);
  assert.doesNotMatch(C, /\.hud-effects:empty/, 'plain Enhanced keeps its empty effects row, and its gap (the model counts it)');
  // the row
  assert.match(C, /\.hud-renown \{ display: none; align-items: center; gap: 8px; height: 22px; width: calc\(3 \* min\(190px, 23vw\) \+ 28px\); \}/);
  assert.match(C, /\.hud-renown \{ width: calc\(78vw \+ 20px\); \}/);
  // the block and its lifts
  assert.match(C, /bottom: calc\(22px \+ 32px \* var\(--hud-scale\) \+ env\(safe-area-inset-bottom, 0px\)\);\n\s*transform: scale\(var\(--hud-scale\)\); transform-origin: bottom left;\n(?:\s*\/\*[^\n]*\*\/\n)?\s*padding: 0 30px 22px;[^\n]*\n\s*--qs-cell: 84px; --qs-box: 172px; \}/);
  assert.match(C, /\.hud-quick \{ position: absolute;\n\s*left: calc\(24px \+ env\(safe-area-inset-left, 0px\)\);/);
  assert.match(C, /\.hud-quick \{ --qs-cell: 60px; --qs-box: 124px; padding: 0 24px 22px;\n\s*left: calc\(14px \+ env\(safe-area-inset-left, 0px\)\);/);
  assert.match(C, /bottom: calc\(76px \+ 30px \* \(var\(--hud-scale\) - 1\) \+ env\(safe-area-inset-bottom, 0px\)\); \}/);
  assert.match(C, /\.hud-quick\.stickclear \{ left: calc\(156px \+ env\(safe-area-inset-left, 0px\)\); \}/);
  assert.match(C, /\.hud-quick\.stickclear \{ left: calc\(160px \+ env\(safe-area-inset-left, 0px\)\); \}/);
  assert.match(C, /\n\.hud:has\(\.hud-renown\.on\) \.hud-quick \{ bottom: calc\(22px \+ 64px \* var\(--hud-scale\) \+ env\(safe-area-inset-bottom, 0px\)\); \}/);
  assert.match(C, /\n {2}\.hud:has\(\.hud-renown\.on\) \.hud-quick \{ bottom: calc\(46px \+ 60px \* var\(--hud-scale\) \+ env\(safe-area-inset-bottom, 0px\)\); \}/);
  // touch: the order, the margins and the block, the phone's after the tablet's so it wins there
  const touch = C.slice(C.indexOf('@media (pointer: coarse) and (hover: none) {\n  .hud-bars { order: 1; }'));
  assert.match(touch, /^@media \(pointer: coarse\) and \(hover: none\) \{\n {2}\.hud-bars \{ order: 1; \}\n {2}\.hud-effects, \.hud-needs, \.hud-status \{ order: 2; \}\n {2}\.hud-renown \{ margin-bottom: max\(0px, calc\(\(46px \+ env\(safe-area-inset-bottom, 0px\)\) \/ var\(--hud-scale\) - 30px\)\); \}\n {2}\.hud:has\(\.hud-renown\.on\) \.hud-quick \{ bottom: calc\(max\(24px \+ 62px \* var\(--hud-scale\), 70px \+ 32px \* var\(--hud-scale\)\) \+ env\(safe-area-inset-bottom, 0px\)\); \}\n {2}\.hud:has\(\.hud-renown\.on\):has\(\.hud-eff, \.hud-need\) \.hud-quick \{ bottom: calc\(max\(24px \+ 86px \* var\(--hud-scale\), 70px \+ 56px \* var\(--hud-scale\)\) \+ env\(safe-area-inset-bottom, 0px\)\); \}\n\}\n@media \(pointer: coarse\) and \(hover: none\) and \(max-width: 860px\) \{\n {2}\.hud-renown \{ margin-bottom: max\(0px, calc\(\(56px \+ env\(safe-area-inset-bottom, 0px\)\) \/ var\(--hud-scale\) - 28px\)\); \}\n {2}\.hud:has\(\.hud-renown\.on\) \.hud-quick \{ bottom: calc\(max\(14px \+ 58px \* var\(--hud-scale\), 70px \+ 30px \* var\(--hud-scale\)\) \+ env\(safe-area-inset-bottom, 0px\)\); \}\n {2}\.hud:has\(\.hud-renown\.on\):has\(\.hud-eff, \.hud-need\) \.hud-quick \{ bottom: calc\(max\(14px \+ 82px \* var\(--hud-scale\), 70px \+ 54px \* var\(--hud-scale\)\) \+ env\(safe-area-inset-bottom, 0px\)\); \}\n\}/);
  assert.ok(C.indexOf('@media (pointer: coarse) and (hover: none) {\n  .hud-bars { order: 1; }') > C.indexOf('  .hud:has(.hud-renown.on) .hud-quick { bottom: calc(46px'), 'the touch rules come after the phone\'s, or the phone\'s lift would stand on a touch phone');
  // the touch layer's buttons the model keeps clear of
  const T = src('src/ui/touch.js');
  assert.match(T, /button\('↑↑', edge\('right', 16\), edge\('bottom', 16\), 64,/);
  assert.match(T, /if \(hooks\.socialInteract\) button\('☺', edge\('right', hooks\.cycleMode \? 232 : 160\), edge\('bottom', 16\), 48,/);
  assert.match(T, /height:48px;/);
  // Plus
  assert.match(PLUS_CSS, /\.hud-bars \{ display: flex; align-items: center; gap: 16px; \}/);
  assert.match(PLUS_CSS, /\.hud-vital \.hud-track \{ width: min\(190px, 23vw\); height: 20px;/);
  assert.match(PLUS_CSS, /\.hud-status:not\(:has\(> :not\(:empty\)\)\) \{ display: none; \}/);
  assert.match(PLUS_CSS, /\n\.hud-renown \{ width: calc\(3 \* min\(190px, 23vw\) \+ 32px\); \}/);
});
