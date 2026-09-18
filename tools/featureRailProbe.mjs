// FT15 (2026-09-15): THE READING RAIL, MEASURED AND JUDGED.
//
// Mac's complaint - "reduce the overexplanation wall of text within
// featured categories" - is about a length, so it needs a number the
// browser agrees with rather than a character count. The rail GROWS to
// fit its note (nothing is ever clipped), so the defect was never an
// overflow: it was HEIGHT. This points at every tile in turn, reports
// the rendered height of what the rail says, and fails if one has grown
// back into a wall.
//
// Run against a dev server with NO arena2 on disk:
//     npx vite --port 5199 &
//     node tools/featureRailProbe.mjs
//
// Measured at the FT15 trim: tallest note 619px -> 300px, with nothing
// over 300 where five rows had been over 350. The ceiling below is the
// same guard test/features.test.js holds in characters, in the unit the
// player actually sees.
import { chromium } from 'playwright';
import { FEATURES } from '../src/systems/features.js';

const BASE = process.env.PROBE_BASE ?? 'http://127.0.0.1:5199';
const SHOTS = process.env.PROBE_SHOTS ?? '/tmp';
const MAX_NOTE_PX = 340;   // FT15: the trim's worst case is 300; this is the drift guard
// AUDIT FT15 F7: this was a hardcoded 28 - the same enumerated-count
// anti-pattern this very commit range removed from HT1's "160 modules".
// A 29th feature would have failed the probe for existing. Derived.
const TILES = FEATURES.length;

const bad = [];
const check = (name, ok, detail = '') => {
  if (!ok) bad.push(`${name}${detail ? ` - ${detail}` : ''}`);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

await page.goto(`${BASE}/play/?nointro`, { waitUntil: 'networkidle' });
await page.waitForSelector('.px-menu button');
await page.locator('.px-menu button').filter({ hasText: /Features/ }).first().click();
await page.waitForSelector('.ft-tile');

const tiles = await page.locator('.ft-tile').count();
const rows = [];
for (let i = 0; i < tiles; i++) {
  await page.locator('.ft-tile').nth(i).hover();
  await page.waitForTimeout(40);
  rows.push(await page.evaluate(() => {
    const rail = document.querySelector('.ft-rail');
    const note = rail?.querySelector('.ft-rail-note');
    const head = rail?.querySelector('h3, .ft-rail-title, strong');
    return {
      title: head?.textContent?.trim() ?? '',
      chars: note?.textContent?.length ?? 0,
      px: note ? Math.round(note.getBoundingClientRect().height) : 0,
    };
  }));
}
await page.locator('.ft-tile').nth(0).hover();
await page.screenshot({ path: `${SHOTS}/feature-rail.png` });

rows.sort((a, b) => b.px - a.px);
for (const r of rows) console.log(`${String(r.px).padStart(4)}px ${String(r.chars).padStart(4)}ch  ${r.title}`);
const tall = rows.filter((r) => r.px > MAX_NOTE_PX);
const total = rows.reduce((n, r) => n + r.chars, 0);
console.log(`\n${tiles} tiles, ${total} characters of note, tallest ${rows[0]?.px ?? 0}px (${rows[0]?.title ?? '-'})`);

check('every tile in the registry drew a tile', tiles === TILES, `${tiles} of ${TILES}`);
check('every tile answered the rail', rows.every((r) => r.title && r.chars > 0),
  rows.filter((r) => !r.title || !r.chars).map((r) => r.title || '(no title)').join(', '));
check(`no note is taller than ${MAX_NOTE_PX}px`, tall.length === 0,
  tall.map((r) => `${r.title} ${r.px}px`).join('; '));
check('the panel raised no page error', errors.length === 0, errors.join(' | '));
if (bad.length) throw new Error(`the reading rail failed ${bad.length} check(s): ${bad.join(' | ')}`);
await browser.close();
