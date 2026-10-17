// TOAST-SPLIT (2026-09-29, Mac: "So it seems like the enhanced plus UI regressed. The notifications arent enhanced plus
// anymore"; bible/10-UI/UI-Arc.md TOAST-SPLIT): THE TOASTS AND THE NOTICE BOARD SHARE NO CLASS. The Notice
// Board (NOTICE1) drew its cork in `.notice-body` and its small italic lines in `.notice-hint` - the HUD toast stack's own
// two classes (ui/enhanced/enhancedNotice.js, ui/enhanced/enhancedInputBox.js, ui/yesNoBox.js) - so the board's sheet (NOTICE_CSS, in the
// Enhanced Plus sheet since MERGE 2, and laid on the classic skin when a board opens) put the cork behind every toast's
// words and its brown italic on every hint, and the toasts' sheet put its capitals and rule on the board's lines. The
// board's are `.notice-cork` and `.notice-tip` now, and the sheet a board lays on the classic skin takes the kit's rules
// for the board's own window only (`.notice-shell`, `.notice-win`, `.notice-head`) - never the toast's `.notice` dress.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { NOTICE_CSS, PROF_CSS, BOUNTY_CSS } from '../../src/ui/enhanced/enhancedPlusStyle.js';
import { ENHANCED_CSS } from '../../src/ui/enhanced/enhancedStyle.js';
import { noticeSkinCss } from '../../src/ui/noticeWindow.js';
import { scopeRules } from '../../src/ui/brokerWindow.js';
import { frameCss } from '../../src/ui/enhanced/enhancedFrame.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

/** Every selector a sheet writes, its @media blocks' included. */
const selectors = (css) => { const out = []; scopeRules(css, (s) => { out.push(s); return false; }); return out; };
/** The classes one selector names. */
const classesOf = (sel) => [...sel.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]);
/** The classes a source hands its elements: el(tag, 'a b'), button('a', ...), className = 'a' (each side of a choice),
 *  classList.add('a'), querySelector('.a'). */
function drawnClasses(file) {
  const s = src(file).replace(/\$\{[^}]*\}/g, ' ');
  const out = new Set();
  const add = (list) => { for (const c of list.split(/\s+/)) if (c) out.add(c); };
  for (const m of s.matchAll(/\bel\(\s*['`"][\w-]+['`"]\s*,\s*['`"]([^'`"]*)['`"]/g)) add(m[1]);
  for (const m of s.matchAll(/\bbutton\(\s*['`"]([^'`"]*)['`"]/g)) add(m[1]);
  for (const m of s.matchAll(/className\s*=\s*([^;\n]*)/g)) for (const q of m[1].matchAll(/['`"]([^'`"]*)['`"]/g)) add(q[1]);
  for (const m of s.matchAll(/classList\.(?:add|toggle|remove)\(\s*['`"]([^'`"]*)['`"]/g)) out.add(m[1]);
  for (const m of s.matchAll(/querySelector(?:All)?\?*\.?\(\s*['`"]([^'`"]*)['`"]/g)) for (const c of classesOf(m[1])) out.add(c);
  return out;
}

/** The toast stack's classes: what its three drawers hand their elements. */
const TOAST_FILES = ['src/ui/enhanced/enhancedNotice.js', 'src/ui/enhanced/enhancedInputBox.js', 'src/ui/yesNoBox.js'];
const TOAST = new Set(TOAST_FILES.flatMap((f) => [...drawnClasses(f)]).filter((c) => /^notice(-|$)/.test(c)));
/** The board's windows: the Notice Board and its three tabs. */
const BOARD_FILES = ['src/ui/noticeWindow.js', 'src/ui/marketTab.js', 'src/ui/workTab.js'];

test('TOAST-SPLIT the toast stack\'s classes, as its drawers hand them (the set every other pin here reads)', () => {
  for (const c of ['notice', 'notice-stack', 'notice-toast', 'notice-body', 'notice-hint', 'notice-row', 'notice-cell']) assert.ok(TOAST.has(c), c);
  assert.ok(selectors(ENHANCED_CSS).some((s) => /^\.notice-body$/.test(s)), 'the toast\'s body is its sheet\'s');
  assert.ok(selectors(ENHANCED_CSS).some((s) => /^\.notice-hint$/.test(s)), 'and its hint');
});

test('TOAST-SPLIT the board draws none of the toast\'s classes, and finds its cork by its own (mutants: a window, a tab or the scroll keeper back on .notice-body or .notice-hint)', () => {
  for (const f of BOARD_FILES) {
    const drawn = drawnClasses(f);
    assert.ok(drawn.size > 5, `${f} read`);
    const shared = [...drawn].filter((c) => TOAST.has(c));
    assert.deepEqual(shared, [], `${f} draws a toast's class`);
  }
  const w = drawnClasses('src/ui/noticeWindow.js');
  for (const c of ['notice-cork', 'notice-tip']) assert.ok(w.has(c), `the board's ${c}`);
  assert.ok(drawnClasses('src/ui/marketTab.js').has('notice-cork') && drawnClasses('src/ui/marketTab.js').has('notice-tip'), 'the Market tab\'s');
  assert.match(src('src/ui/marketTab.js'), /el\('div', 'notice-cork market-body'\)/, 'the market on the cork');
});

test('TOAST-SPLIT no board sheet names a toast\'s class - the board\'s, the professions\', the bounty board\'s, nor the sheet a board lays on the other skins (mutants: .notice-body or .notice-hint back in NOTICE_CSS or PROF_CSS; the skin sheet\'s kit cut back to every selector naming "notice")', () => {
  const sheets = { NOTICE_CSS, PROF_CSS, BOUNTY_CSS, noticeSkinCss: noticeSkinCss() };
  for (const [name, css] of Object.entries(sheets)) {
    const hits = selectors(css).filter((s) => classesOf(s).some((c) => TOAST.has(c)));
    assert.deepEqual(hits, [], `${name} dresses a toast`);
  }
  const kit = selectors(noticeSkinCss()).filter((s) => !selectors(NOTICE_CSS).includes(s) && !selectors(PROF_CSS).includes(s));
  assert.ok(kit.length >= 5, 'the kit\'s window, header and presses are still laid on');
  for (const s of kit) assert.match(s, /\.notice-(?:shell|win|head)\b/, `the kit cut to the board's window: ${s}`);
  for (const s of selectors(frameCss()).filter((x) => /\.notice-(?:shell|win|head)\b/.test(x))) assert.ok(kit.includes(s), `and every rule of it kept: ${s}`);
  for (const s of ['body .notice-win', 'body .notice-shell .act', 'body .notice-shell .act.primary', 'body .notice-head']) assert.ok(kit.includes(s), s);
  assert.match(NOTICE_CSS, /\n\.notice-cork \{ padding: 14px 16px 16px; min-height: 0; overflow: auto;\n {2}background: radial-gradient/, 'the cork');
  assert.match(NOTICE_CSS, /\n\.notice-tip \{ margin: 0; font-size: 12px; color: #5a4630; font-style: italic; \}/, 'the italic line');
  assert.match(NOTICE_CSS, /@media \(max-width: 720px\) \{\n {2}\.notice-shell \{ padding: 8px; \}\n {2}\.notice-cork \{ padding: 10px; \}/, 'the phone\'s cork');
  assert.match(PROF_CSS, /\.market-body \.notice-tip, \.market-body \.notice-label \{ color: #cdbd9f; \}/, 'the market\'s ink');
});

test('TOAST-SPLIT the toasts\' sheet names none of the board\'s classes (mutants: a board class dressed by the toast\'s rules)', () => {
  const board = new Set(BOARD_FILES.flatMap((f) => [...drawnClasses(f)]).filter((c) => /^(notice|market|work)-/.test(c) && !TOAST.has(c)));
  assert.ok(board.has('notice-cork') && board.has('notice-tip'));
  const hits = selectors(ENHANCED_CSS).filter((s) => classesOf(s).some((c) => board.has(c)));
  assert.deepEqual(hits, [], 'the toasts\' sheet dresses the board');
});
