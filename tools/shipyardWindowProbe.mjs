// FIELD BUGS 2026-10-16b YARD-ROWS, MEASURED (the Discord: "Shipyard formatting is cooked" - "The text here may need a bit
// of work, as you can see!"): THE SHIPYARD WINDOW (ui/shipyardWindow.js) drawn in Chromium over a fleet like the
// reporter's - a Large Boat and a Carrack laid up at Aldwall Rock, her refits named - and the Refits and Crew Hall pages
// (a recruit's swap picker among them), at a desktop's width, a narrow window's, 600 and a phone's. A row's words (its
// middle cell) must stand at least 100 px wide - the shipped `auto` acts track left them 0-38 px, a word a line, 400-700
// px tall - and nothing may spill sideways. test/ui/fb1016b_yardrows.test.js holds the CSS's law; this measures what a fake
// page cannot. Photographs the fleet to SHOT_DIR (default tools/shots/, ignored).
//
//     node tools/shipyardWindowProbe.mjs
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SHOT_DIR = process.env.SHOT_DIR ?? join(ROOT, 'tools', 'shots');
mkdirSync(SHOT_DIR, { recursive: true });
const server = await createServer({ root: ROOT, server: { port: 5298, strictPort: true }, logLevel: 'silent' });
await server.listen();
const browser = await chromium.launch({ headless: true });
let fails = 0;
try {
  // 561: the widest the phone's one column is not - where the swap picker's long option held the presses' track (the audit)
  for (const [W, H] of [[1440, 900], [800, 600], [600, 760], [561, 760], [390, 760]]) for (const pageId of ['fleet', 'refits', 'crew']) {
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    await page.goto('http://localhost:5298/play/?skin=enhanced&touch=off', { waitUntil: 'load', timeout: 60000 });
    let ready = false;
    for (let i = 0; i < 10 && !ready; i++) { try { ready = await page.evaluate(async () => !!(await import('/src/ui/shipyardWindow.js')).mountShipyardWindow); } catch { await page.waitForTimeout(1000); } }
    // vite may reload the page once while it optimises a dependency it found late: measure again then
    const measure = () => page.evaluate(async ({ pageId }) => {
      const { mountShipyardWindow } = await import('/src/ui/shipyardWindow.js');
      document.body.innerHTML = '';
      document.body.style.cssText = 'margin:0;background:#2a2721;height:100vh';
      const fleet = [
        { uid: 801, label: 'Boat', name: 'Boat', hullName: 'Large Boat', where: 'laidup', port: 'Aldwall Rock', worth: 3546, offer: 431, upgrades: {}, sell: null, can: { summon: null, away: 'She is laid up already' } },
        { uid: 802, label: 'Borrowed Wings', name: 'Borrowed Wings', hullName: 'Carrack', where: 'laidup', port: 'Aldwall Rock', worth: 65500, offer: 23002, upgrades: { hold: 3, rigging: 2, hull: 1, guns: 1 }, sell: null, can: { summon: null, away: 'She is laid up already' } },
      ];
      const refit = { why: null, rows: ['hold', 'rigging', 'hull', 'guns'].map((id, i) => ({ id, label: id[0].toUpperCase() + id.slice(1), tier: i % 3, what: 'Her hold carries more', per: 0.1, afford: true,
        next: { gold: 1200 * (i + 1), mats: [{ n: 4, label: 'timber', have: 2 }, { n: 2, label: 'iron', have: 0 }, { n: 1, label: 'pitch', have: 5 }] } })) };
      // YARD-ROWS' audit: a long hand's name, so the swap picker's longest option is a long one
      const hands = [{ name: 'Bram Holloway', role: 'Bosun', fights: 3, boardings: 1 }, { name: 'Charlotte Montclair', role: 'First Mate', fights: 1, boardings: 0, gender: 'female' }];
      const recruits = [{ id: 'r1', name: 'Senna Varo', gradeLabel: 'Seasoned', trade: 'Gunner', className: 'Archer', sex: 'female', fights: 4, boardings: 2, line: 'Twelve years on the Iliac, and never a ship lost under me.', fee: 500, why: null },
        { id: 'r2', name: 'Peristair Kingfield', gradeLabel: 'Green', trade: 'Cook', className: 'Monk', sex: 'male', fights: 0, boardings: 0, line: 'I can cook.', fee: 180, swap: true, why: null }];
      const host = document.createElement('div');
      document.body.append(host);
      mountShipyardWindow(host, {
        page: pageId,
        model: () => ({ page: pageId, uid: 802, title: "Woodsly's Shipyard", keeper: 'Odwolyn Woodsly', gold: 11235, crewName: "Ashcroft's Crew Hall", crewmaster: 'Ashcroft',
          fleet, refit, ship: { label: 'Borrowed Wings' }, choices: [{ uid: 801, label: 'Boat' }, { uid: 802, label: 'Borrowed Wings' }],
          hands, room: { ok: true }, recruits }),
        act: () => ({ ok: true, text: '' }),
      });
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const win = document.querySelector('.dfnaval-win').getBoundingClientRect();
      const sideways = document.documentElement.scrollWidth > innerWidth || [...document.querySelectorAll('.dfnaval-win *')].some((n) => n.getBoundingClientRect().right > win.right + 0.5);
      return { sideways, rows: [...document.querySelectorAll('.dfyard-row')].map((row) => {
        const kids = [...row.children].map((c) => c.getBoundingClientRect());
        return { h: Math.round(row.getBoundingClientRect().height), mid: Math.round(kids[1].width) };
      }) };
    }, { pageId });
    let out;
    for (let i = 0; !out; i++) { try { out = await measure(); } catch (e) { if (i >= 2) throw e; await page.waitForLoadState('load'); await page.waitForTimeout(1000); } }
    const bad = out.rows.some((r) => r.mid < 100) || out.sideways;
    if (bad) fails++;
    console.log(`${bad ? 'BAD' : 'ok '} ${String(W).padStart(4)} ${pageId.padEnd(6)} rows h [${out.rows.map((r) => r.h)}] words w [${out.rows.map((r) => r.mid)}]${out.sideways ? ' SIDEWAYS' : ''}`);
    if (pageId === 'fleet') await page.screenshot({ path: join(SHOT_DIR, `shipyard-fleet-${W}.png`) });
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}
console.log(fails ? `${fails} page(s) with a row's words under 100 px or spilling sideways` : 'every page: every row\'s words stand, nothing sideways');
process.exitCode = fails ? 1 : 0;
