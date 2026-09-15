// THE CHAT LIST HOLDS ITS ROWS, MEASURED.
//
// CHAT2 (2026-09-15, Mac relaying a player): "The chat UI when
// accumulating messages scrunched together and makes history
// unreadable and after some time, chat history disappears
// altogether."
//
// Both halves were one bug and it is a LAYOUT bug, which is why no
// pin in `test/chat1.test.js` could see it: node has no layout engine,
// so the whole suite drives a fake DOM whose boxes are whatever the
// fake says they are. `.dfchat-list` is a fixed-height flex COLUMN
// (`height: min(220px, 34vh)`) and `.dfchat-line` carried
// `overflow: hidden`. Per CSS Flexbox 4.5, a flex item's automatic
// minimum size applies only while its overflow is `visible`; with
// `overflow: hidden` the item's `min-height: auto` resolves to ZERO,
// so the default `flex-shrink: 1` was free to compress every row
// toward nothing instead of overflowing into the scroll. Measured on
// this file's first run:
//
//     10 rows -> 18.3px each     40 rows -> 3.55px
//     20 rows -> 9.09px          80 rows -> 0.78px    200 rows -> 0px
//
// and `scrollHeight === clientHeight` throughout, so the list never
// scrolled: there was nothing to scroll, the content had been squeezed
// to fit. That is "scrunched together", and at the end of the ramp it
// is "disappears altogether" - the same rows, still in the DOM, still
// in the log, drawn zero pixels tall.
//
// A pin that reads the rule back is not proof; the rule had a reason
// and the bug was in what the reason DID. So this measures, like
// tools/enhancedTapProbe.mjs measures a thumb. It needs no dev server
// and no game data - the panel's own sheet is the subject.
//
//     node tools/chatLayoutProbe.mjs
import { chromium } from 'playwright';
import { CHAT_CSS } from '../src/ui/chatPanel.js';

/** The row heights and the scroll, for a list of `count` lines. */
const MEASURE = (count) => {
  document.body.innerHTML = '';
  const el = (t, c, x) => { const e = document.createElement(t); e.className = c; if (x != null) e.textContent = x; return e; };
  const root = el('div', 'dfchat');
  root.dataset.state = 'open';
  const box = el('div', 'dfchat-box');
  const list = el('div', 'dfchat-list');
  for (let i = 0; i < count; i++) {
    const line = el('div', 'dfchat-line');
    line.append(el('span', 'dfchat-time', '12:34'), el('span', 'dfchat-name', 'Mac'),
      el('span', 'dfchat-tag', '#ab12'), el('span', 'dfchat-text', `message number ${i}`));
    list.append(line);
  }
  box.append(list);
  root.append(box);
  document.body.append(root);
  const rows = [...list.children].map((c) => c.getBoundingClientRect().height);
  return { min: Math.min(...rows), max: Math.max(...rows), listH: list.clientHeight, scrollH: list.scrollHeight };
};

/** The peek over the world has no fixed height, so it must never shrink either - and must not have been
 *  "fixed" into a scroller by the same hand that fixes the list. */
const MEASURE_PEEK = (count) => {
  document.body.innerHTML = '';
  const el = (t, c, x) => { const e = document.createElement(t); e.className = c; if (x != null) e.textContent = x; return e; };
  const root = el('div', 'dfchat');
  root.dataset.state = 'closed';
  const peek = el('div', 'dfchat-peek');
  for (let i = 0; i < count; i++) {
    const line = el('div', 'dfchat-line');
    line.append(el('span', 'dfchat-name', 'Mac'), el('span', 'dfchat-text', `message number ${i}`));
    peek.append(line);
  }
  root.append(peek);
  document.body.append(root);
  return { min: Math.min(...[...peek.children].map((c) => c.getBoundingClientRect().height)) };
};

const COUNTS = [5, 10, 20, 40, 80, 200];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.setContent('<!doctype html><html><head></head><body></body></html>');
await page.addStyleTag({ content: CHAT_CSS });

const fails = [];
let baseline = null;
for (const n of COUNTS) {
  const m = await page.evaluate(MEASURE, n);
  baseline ??= m.min;
  const scrolls = m.scrollH > m.listH + 1;
  const overflows = n * baseline > m.listH;
  console.log(`  ${String(n).padStart(3)} rows: ${m.min.toFixed(2)}-${m.max.toFixed(2)}px  list ${m.listH}px  scroll ${m.scrollH}px`);
  // A ROW NEVER SHRINKS. One row's height is the same at 200 as at 5.
  if (Math.abs(m.min - baseline) > 0.5) fails.push(`${n} rows: a row is ${m.min.toFixed(2)}px where 5 rows made it ${baseline.toFixed(2)}px - the rows are being squeezed`);
  // ...and once they do not fit, the LIST scrolls rather than absorbing them.
  if (overflows && !scrolls) fails.push(`${n} rows: ${n} x ${baseline.toFixed(2)}px does not fit ${m.listH}px and scrollHeight is still ${m.scrollH} - nothing to scroll`);
}
const peek = await page.evaluate(MEASURE_PEEK, 5);
console.log(`  peek: ${peek.min.toFixed(2)}px`);
if (Math.abs(peek.min - baseline) > 0.5) fails.push(`the closed peek's row is ${peek.min.toFixed(2)}px, not ${baseline.toFixed(2)}px`);
await browser.close();

if (fails.length) {
  console.error('\nFAILED:');
  for (const f of fails) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`\nPASS: a chat row is ${baseline.toFixed(2)}px at every count up to ${COUNTS[COUNTS.length - 1]}, and the list scrolls once they do not fit.`);
