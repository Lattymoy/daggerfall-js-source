// GROWTH (bible/10-UI/Growth.md) - THE GROWTH TAB, in a real browser, over its lab (growth.html, src/tools/growthLab.js).
//
// PROVEN HERE - each of the tab's four pages draws at a wide screen and a phone with no page error and no sideways
// scroll; on a wide screen the Ascension, the Firmament and the captain's stars stand IN the pane (their `embed` roots,
// the stage's size), and on a phone each page is its door, which opens the face over the whole screen and Escape puts
// it back; the guide opens a path's detail; full screen moves a face over the window and back; and the window's
// Escape asks a face first - unaccepted stars hold the first press, the second resumes.
//
// NOT PROVEN HERE - a living game's hosts (no ARENA2: the lab's character, book and captain are made up), which the
// source pins hold (test/ui/growth/growth1_tab.test.js).
//
//     npx vite --port 5199 &
//     node tools/growthProbe.mjs [shots-dir]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.PROBE_BASE ?? 'http://127.0.0.1:5199';
const SHOTS = process.argv[2] ?? null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`); };
const browser = await chromium.launch();

async function open(at, { w = 1280, h = 720, extra = '' } = {}) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${BASE}/growth.html?at=${encodeURIComponent(at)}${extra}`);
  await page.waitForSelector('.px-tabs', { timeout: 15000 });
  return { page, errors };
}
/** A phone's face page: its door (no stage in the pane), the face over the whole screen, and Escape back to the page. */
async function phoneDoor(page, rootSel, name, shotName) {
  const noStage = await page.evaluate(() => !document.querySelector('.gr-stage') && !!document.querySelector('.gr-stagecard .act'));
  await page.locator('.gr-stagecard .act').click();
  await page.waitForSelector(`.gr-fullbox ${rootSel}`, { timeout: 15000 }).catch(() => {});
  const over = await page.evaluate((sel) => { const r = document.querySelector(`.gr-fullbox ${sel}`); return !!r && r.getBoundingClientRect().width >= innerWidth - 4; }, rootSel);
  await shot(page, shotName);
  await page.keyboard.down('Escape'); await page.keyboard.up('Escape');
  await page.waitForTimeout(100);
  const back = await page.evaluate(() => !document.querySelector('.gr-fullbox') && !!document.querySelector('.gr-stagecard'));
  check(name, noStage && over && back, `door ${noStage}, over ${over}, back ${back}`);
}
const overflowOf = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };

// a tall window: the Ascension drawn in the pane, its figure whole and Ascend in the stage (AUDIT GROWTH LANE2-8)
{
  const { page, errors } = await open('level', { w: 1920, h: 1080, extra: '&owed=1' });
  await page.waitForSelector('.lv-sky.lv-embed', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(400);
  const m = await page.evaluate(() => {
    const r = document.querySelector('.lv-sky.lv-embed'), s = document.querySelector('.gr-stage'), f = document.querySelector('.lv-figure'), ok = document.querySelector('.lv-ok');
    const sr = s?.getBoundingClientRect(), or = ok?.getBoundingClientRect();
    return { inPane: !!r && !!s && s.contains(r) && getComputedStyle(r).position === 'absolute', fig: Math.round(f?.getBoundingClientRect().height ?? 0), okIn: !!sr && !!or && or.bottom <= sr.bottom && or.top >= sr.top };
  });
  check('tall: the Level page draws the Ascension in the pane, its figure whole and Ascend in the stage', m.inPane && m.fig >= 150 && m.okIn, JSON.stringify(m));
  check('tall: the Level page - no page error', !errors.length, errors.join(' | '));
  await shot(page, 'tall-level');
  await page.close();
}

for (const [w, h, tag] of [[1280, 720, 'wide'], [360, 740, 'phone']]) {
  // the Level page: a level owed - a door to the Ascension full screen where the pane cannot hold it (a window under
  // 1000 px tall - AUDIT GROWTH LANE2-8: in the pane its figure flattened and Ascend fell off), as a phone's
  {
    const { page, errors } = await open('level', { w, h, extra: '&owed=1' });
    await phoneDoor(page, '.lv-sky.lv-embed', `${tag}: the Level page's door opens the Ascension over the screen`, `${tag}-level-open`);
    check(`${tag}: the Level page - no sideways scroll`, (await overflowOf(page)) <= 0);
    check(`${tag}: the Level page - no page error`, !errors.length, errors.join(' | '));
    await shot(page, `${tag}-level`);
    await page.close();
  }
  // the guide: a family's landing, a path opened
  {
    const { page, errors } = await open('specs:martial', { w, h });
    await page.locator('.gr-pathbar').first().click();
    const detail = await page.locator('.gr-detail').first().innerText().catch(() => '');
    check(`${tag}: the guide opens a path - what opens it, its passive, its signature, how it is used`, /Requirements/i.test(detail) && /Passive/i.test(detail) && /Signature technique/i.test(detail) && /Weapon Technique key/.test(detail), detail.slice(0, 80));
    check(`${tag}: the guide - no sideways scroll`, (await overflowOf(page)) <= 0);
    check(`${tag}: the guide - no page error`, !errors.length, errors.join(' | '));
    await shot(page, `${tag}-specs`);
    await page.locator('.gr-fam').first().click();
    await shot(page, `${tag}-specs-arcane`);
    await page.close();
  }
  // the two skies
  for (const at of ['firmament', 'captain']) {
    const { page, errors } = await open(at, { w, h });
    if (tag === 'phone') await phoneDoor(page, '.fmt-root.fmt-embed', `${tag}: the ${at} page's door opens the sky over the screen`, `${tag}-${at}-open`);
    else {
      await page.waitForSelector('.fmt-root.fmt-embed', { timeout: 15000 }).catch(() => {});
      const inPane = await page.evaluate(() => { const r = document.querySelector('.fmt-root.fmt-embed'); const s = document.querySelector('.gr-stage'); return !!r && !!s && s.contains(r) && Math.abs(r.getBoundingClientRect().width - s.getBoundingClientRect().width) < 8; });
      check(`${tag}: the ${at} sky stands in the pane at the stage's size`, inPane);
    }
    check(`${tag}: the ${at} page - no sideways scroll`, (await overflowOf(page)) <= 0);
    check(`${tag}: the ${at} page - no page error`, !errors.length, errors.join(' | '));
    await shot(page, `${tag}-${at}`);
    if (tag === 'wide') {
      // full screen and back
      await page.locator('.gr-stagebar .act').click();
      const full = await page.evaluate(() => { const b = document.querySelector('.gr-fullbox'); const r = document.querySelector('.fmt-root.fmt-embed'); return !!b && !!r && b.contains(r) && r.getBoundingClientRect().width >= innerWidth - 4; });
      check(`${tag}: the ${at} sky goes full screen`, full);
      await shot(page, `${tag}-${at}-full`);
      await page.keyboard.down('Escape'); await page.keyboard.up('Escape');
      const back = await page.evaluate(() => !document.querySelector('.gr-fullbox') && !!document.querySelector('.gr-stage .fmt-root.fmt-embed'));
      check(`${tag}: Escape leaves full screen, the sky back in the pane`, back);
    }
    await page.close();
  }
}

// THE ESCAPE: unaccepted stars hold the first press (said), the second resumes the game
{
  const { page } = await open('captain');
  await page.waitForSelector('.fmt-root.fmt-embed', { timeout: 15000 });
  const logs = [];
  page.on('console', (m) => logs.push(m.text()));
  // a star taken through the window's own seam (the lab's handle on the stage's face), as a click would
  const taken = await page.evaluate(() => { const f = globalThis.growthFace(); f?.take?.(globalThis.growthStarIds[1]); return f?.model?.().changes; });
  check('a star taken on the stage is pending', !!(taken?.added), JSON.stringify(taken));
  await page.keyboard.down('Escape'); await page.keyboard.up('Escape');
  await page.waitForTimeout(150);
  const held = !logs.some((l) => /resume/.test(l));
  const said = await page.locator('.fmt-say').innerText().catch(() => '');
  check('a pending star: the first Escape is the sky\'s (asked), the window stands', held, said.slice(0, 70));
  await page.keyboard.down('Escape'); await page.keyboard.up('Escape');
  await page.waitForTimeout(150);
  check('...and the second resumes', logs.some((l) => /resume/.test(l)));
  await page.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed} of ${results.length} passed`);
process.exit(failed ? 1 : 0);
