// EG-PLUS (2026-10-19, bible/11-Multiplayer/Elite-Gates.md section 31, EG-PLUS): THE ELITE BREACH'S WINDOWS, SEEN. Serves one bare
// page through the dev server, lays the skin the URL names (Enhanced Plus, its Stone colour, the classic skin, the DFO
// Grimoire dress), and draws each window through its REAL painter and model - the breach's panel at a rest (a Vestige offer,
// a decree's choice and a respite open), its recap, the boards, the start window in a company of three, and the call's
// tracker - at a desktop and an upright phone, and reads what a fake document cannot:
//   - the FACE: every window's words in the game's pixel face (the dress's own under DFO Grimoire), never the serif the
//     breach's sheets wrote before;
//   - the KIT: each window's carved frame (the kit's border-image) on Plus and on the classic skin;
//   - the FIT: each window on the screen, nothing in it wider than it;
//   - THE FINGER: on the phone every press and tile 44 px tall.
//     node tools/egPlusProbe.mjs          (writes $PROBE_SHOTS or /tmp/egplus-*.png)
// The fonts: the probe's browser has no route to Google Fonts, so it lays the launcher's own copy of Pixelify Sans
// (app/launcher/fonts) and opens the page with ?nofonts - the card panels' probe's way (tools/cardPanelsProbe.mjs).
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const shots = process.env.PROBE_SHOTS ?? '/tmp';
const PIX = readFileSync(new URL('../app/launcher/fonts/PixelifySans-latin.woff2', import.meta.url)).toString('base64');
const FONT_CSS = `@font-face { font-family: 'Pixelify Sans'; font-weight: 400 700; font-display: block; src: url(data:font/woff2;base64,${PIX}) format('woff2'); }`;
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>${FONT_CSS} html, body { margin: 0; height: 100%; } body { background: radial-gradient(circle at 30% 20%, #4a3a2a, #12100e 70%); }</style></head><body></body></html>`;
const server = await createServer({
  server: { port: 5244, strictPort: true, watch: null }, logLevel: 'error',   // no watcher: a file saved mid-run never invalidates an import in flight
  // the page is served by the plugin below, so the optimiser is told the scenes' modules up front - a dependency found on
  // a dynamic import mid-run re-optimises and answers the imports in flight "outdated"
  optimizeDeps: { entries: ['src/ui/eliteGates/*.js', 'src/ui/enhanced/enhancedStyle.js', 'src/ui/grimoireDress.js'] },
  plugins: [{ name: 'eg-probe-page', configureServer(s) { s.middlewares.use((req, res, next) => { if (!req.url?.startsWith('/egprobe.html')) return next(); res.setHeader('Content-Type', 'text/html'); res.end(PAGE); }); } }],
});
await server.listen();
const BASE = 'http://127.0.0.1:5244';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
let failed = 0, checks = 0;
const check = (ok, what) => { checks++; if (!ok) { failed++; console.log(`FAIL ${what}`); } };

/** Lay the skin and draw one scene's window through its real painter. Answers the window's selector. */
async function mount(page, scene, look) {
  return page.evaluate(async ({ scene, look }) => {
    const { injectEnhancedStyle, injectEnhancedFonts } = await import('/src/ui/enhanced/enhancedStyle.js');
    const { isEnhancedPlus } = await import('/src/systems/uiSkin.js');
    if (isEnhancedPlus()) injectEnhancedStyle(document);
    injectEnhancedFonts(document);
    if (look === 'stone') document.documentElement.setAttribute('data-plus-theme', 'stone');
    if (look === 'grimoire') { const g = await import('/src/ui/grimoireDress.js'); g.mountGrimoireDress(document); }
    const hud = await import('/src/ui/eliteGates/egHud.js');
    const { EG_PRES_TEXT } = await import('/src/ui/eliteGates/egBeats.js');
    if (scene === 'offer') {
      const ask = (q, o, left, mine = null) => ({ q, ...hud.egAskText(q, o), left, mine, tally: [] });
      hud.drawEgPanel({
        offer: { n: 1, surplus: 2, cards: [
          { key: 1, card: 3, name: 'Searing Edge I', line: 'Your blows burn for 6 fire damage.', completes: '', accord: '' },
          { key: 2, card: 9, name: 'Stoneskin II', line: 'Take 12% less damage from blows.', completes: 'Completes Stone: Rooted. You cannot be knocked down.', accord: '' },
          { key: 3, card: 14, name: "Hunter's Mark I", line: 'The lord takes 8% more from your arrows.', completes: '', accord: "Takes an Accord with Mira's Kindled Steel." },
        ] },
        asks: [ask('dec:ground', [10, 11], 8000, 1), ask('respite', [0, 1], 6000)],
      }, { doc: document, focus: 0 });
      return '.eg-panel';
    }
    if (scene === 'recap') {
      const recap = { b: 'x', title: 'Hall 23 - Redoubt 4 - The Soul Cairn', time: '1:12:40', why: 'home', whyText: 'You walk home.', depth: { h: 23, rd: 4, band: 'The Soul Cairn' },
        strip: [{ c: 1, glyphs: ['Y', 'S', 'C', 'R', 'A'], lord: 'Grath', falls: 0 }, { c: 2, glyphs: ['S', 'Y', 'A', 'C', 'R'], lord: 'Seyth', falls: 1 }],
        members: [{ numeral: 'I', name: 'Mac', falls: 0, recall: 'held', left: 'home', share: '41%', healed: 1200 }, { numeral: 'II', name: 'Mira', falls: 1, recall: 'spent', left: 'standing', share: '33%', healed: 0 }, { numeral: 'III', name: 'Tor', falls: 0, recall: 'held', left: 'home', share: '26%', healed: 300 }],
        vestiges: ['Searing Edge II', 'Stoneskin I'], capstones: ['Rooted'], accords: ['Kindled Steel'], opened: 4, reliquaries: 4, board: 'The Descent, the Few: 14th', circles: [], company: '' };
      hud.drawEgPanel(null, { doc: document, recap, relShown: 4, words: EG_PRES_TEXT });
      return '.eg-panel';
    }
    if (scene === 'board') {
      const { openEgBoard } = await import('/src/ui/eliteGates/egBoardWindow.js');
      const desc = { rows: [{ rank: 1, names: ['Mara', 'Ann', 'Tor'], h: 47, t: 6252, flame: true, pr: 'Tide of Ash' }, { rank: 2, names: ['Edda', 'Ivo'], h: 41, t: 6990 }, { rank: 3, names: ['Mac'], h: 38, t: 5400, you: true }], pinned: null };
      openEgBoard({ doc: document, fetchBoard: async () => ({ ok: true, data: { season: { n: 3, day: 12 }, descent: { alone: desc, few: desc, company: desc },
        depths: { rows: [{ rank: 1, name: 'Dare', h: 80, ew: 4, wg: [0, 4, 9] }], pinned: { rank: 18, name: 'Mac', h: 22, you: true } }, deepest: { rows: [{ rank: 1, name: 'Edda', w: 19, at: 1800000000 }] },
        proclamation: { name: 'Tide of Ash', line: 'Ashfall on every court.' }, best: { h: 38, t: 5400 } } }) });
      await new Promise((r) => setTimeout(r, 50));
      return '.eg-board';
    }
    if (scene === 'start') {
      const { openEgStartPanel } = await import('/src/ui/eliteGates/egStartPanel.js');
      openEgStartPanel({ doc: document, keys: 3, me: 'a', members: [{ sub: 'a', name: 'Mac' }, { sub: 'b', name: 'Mira' }, { sub: 'c', name: 'Tor' }],
        starts: { a: [12, 8, 4, 0], b: [8, 4, 0], c: [12, 8, 4, 0] }, rehearsal: true, questDue: true, board: () => null,
        mount: () => true, unmount: () => {}, ask: () => {}, onChoose: () => {}, onCancel: () => {} });
      document.querySelector('.eg-start .eg-k-tile[data-ew="8"]')?.click();
      [...document.querySelectorAll('.eg-start .eg-k-sechead .eg-k-btn')].at(-1)?.click();   // the Wager opened
      document.querySelector('.eg-start .eg-k-tile[data-decree="9"]')?.click();
      return '.eg-start';
    }
    hud.drawEgHud({ kicker: 'Elite Breach', title: 'Mara opens an Elite Breach.', count: '', countCls: '', line: 'Answer the call - 4:12', sub: 'Answer the call to step through.', company: 'Company of 3', run: '', dec: '', mark: '' }, { doc: document });
    return '.eg-hud';
  }, { scene, look });
}

/** A cold dev server optimises the page's dependencies on its first imports and answers the ones in flight "outdated":
 *  every module the scenes import is asked for once, until it answers, before any scene is drawn. */
async function warm() {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.on('response', (r) => { if (r.status() >= 400) console.log(`warm: HTTP ${r.status()} ${r.url()}`); });
  page.on('console', (m) => { if (m.type() === 'error') console.log(`warm: ${m.text().slice(0, 300)}`); });
  page.on('requestfailed', (r) => console.log(`warm: failed ${r.url()} ${r.failure()?.errorText}`));
  for (let i = 0; i < 5; i++) {
    await page.goto(`${BASE}/egprobe.html?nofonts`, { waitUntil: 'load', timeout: 120000 });
    const ok = await page.evaluate(async () => {
      try {
        await Promise.all(['/src/ui/enhanced/enhancedStyle.js', '/src/ui/grimoireDress.js', '/src/ui/eliteGates/egHud.js', '/src/ui/eliteGates/egBeats.js',
          '/src/ui/eliteGates/egBoardWindow.js', '/src/ui/eliteGates/egStartPanel.js', '/src/systems/uiSkin.js'].map((m) => import(m)));
        return true;
      } catch { return false; }
    });
    if (ok) break;
    await page.waitForTimeout(2000);
  }
  await ctx.close();
}
await warm();

const LOOKS = [['plus', 'skin=enhanced&dress=none'], ['stone', 'skin=enhanced&dress=none'], ['classic', 'skin=classic&dress=none'], ['grimoire', 'skin=enhanced&dress=grimoire']];
const SIZES = [['desk', { width: 1280, height: 800 }, false], ['phone', { width: 390, height: 844 }, true]];
for (const [look, q] of LOOKS) {
  for (const [size, viewport, touch] of SIZES) {
    for (const scene of ['offer', 'recap', 'board', 'start', 'tracker']) {
      const ctx = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(`${look}/${size}/${scene}: ${e.message}`));
      page.on('response', (r) => { if (r.status() >= 400) errors.push(`${look}/${size}/${scene}: HTTP ${r.status()} ${r.url()}`); });
      await page.goto(`${BASE}/egprobe.html?nofonts&${q}`, { waitUntil: 'load', timeout: 120000 });
      const tag = `${look}/${size}/${scene}`;
      let sel = null;
      for (let i = 0; i < 3 && !sel; i++) {
        try { sel = await mount(page, scene, look); } catch (e) { if (i === 2) throw e; await page.goto(`${BASE}/egprobe.html?nofonts&${q}`, { waitUntil: 'load', timeout: 120000 }); }
      }
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(150);
      const m = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
        const wide = [...el.querySelectorAll('*')].filter((n) => n.getBoundingClientRect().right > r.right + 1 && getComputedStyle(n).position !== 'fixed').map((n) => n.className).slice(0, 3);
        const presses = [...el.querySelectorAll('button')].map((b) => b.getBoundingClientRect().height);
        const words = [...el.querySelectorAll('.eg-k-line, .eg-k-tname, .eg-k-btn, .eg-hud-line')].map((n) => getComputedStyle(n).fontFamily);
        return { box: [r.left, r.top, r.right, r.bottom], vw: innerWidth, vh: innerHeight, frame: cs.borderImageSource, face: cs.fontFamily, words, wide, presses };
      }, sel);
      check(!!m, `${tag}: drawn`);
      if (m) {
        check(m.box[0] >= 0 && m.box[2] <= m.vw + 0.5 && m.box[1] >= 0 && m.box[3] <= m.vh + 0.5, `${tag}: on the screen - ${m.box.map(Math.round)} in ${m.vw}x${m.vh}`);
        check(!m.wide.length, `${tag}: nothing wider than the window - ${m.wide.join(', ')}`);
        const face = look === 'grimoire' ? /Alagard/ : /Pixelify/;
        check(face.test(m.face) && m.words.every((f) => face.test(f)), `${tag}: the game's face - ${m.face}`);
        check(!/Cormorant|Georgia/.test(m.face) || look === 'grimoire', `${tag}: no serif of its own`);
        if (look !== 'grimoire' && sel !== '.eg-hud') check(/svg/.test(m.frame), `${tag}: the kit's carved frame - ${String(m.frame).slice(0, 40)}`);
        if (touch) check(m.presses.every((h) => h >= 43.5), `${tag}: every press 44 px under a finger - ${m.presses.map(Math.round).join(',')}`);
      }
      await page.screenshot({ path: `${shots}/egplus-${look}-${size}-${scene}.png` });
      await ctx.close();
    }
  }
}
await browser.close();
await server.close();
for (const e of errors) console.log(`PAGE ERROR ${e}`);
console.log(`${checks - failed}/${checks} checks passed${errors.length ? `, ${errors.length} page errors` : ''}`);
process.exit(failed || errors.length ? 1 : 0);
