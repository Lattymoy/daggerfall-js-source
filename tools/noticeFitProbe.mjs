// NOTICE-FIT, SEEN - the enhanced notice panels drawn in a real
// browser against the real sheet, measured and photographed.
//
// kurkku asked for "the sizing of the boxes to properly adjust for the
// text instead of always being wide", and WIDTH is a thing about
// pixels: a pin can assert that the rule says `max-width` and still
// not tell you that "You are healthy." now hugs its line while a
// four-paragraph quest box still wraps at the cap. So this builds the
// panels through `drawEnhancedNotice` itself - the same entry every
// box and every toast goes through - over the real ENHANCED_CSS, and
// reports the measured border-box width of each.
//
// The QUICK-LOOT-STATS probe's lesson, at a second surface: a harness
// that writes its own markup measures its own artefact.
//
//     node tools/noticeFitProbe.mjs            -> shots + a report
//     SHOT_DIR=/tmp/x node tools/noticeFitProbe.mjs
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
import { join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENHANCED_CSS, ENHANCED_TOKENS } from '../src/ui/enhancedStyle.js';

const ROOT = normalize(join(fileURLToPath(import.meta.url), '..', '..'));
async function serveRepo(page) {
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== 'probe.local') return route.continue();
    try {
      if (url.pathname === '/') return route.fulfill({ status: 200, contentType: 'text/html', body: PAGE });
      const body = readFileSync(join(ROOT, url.pathname.replace(/^\/+/, '')), 'utf8');
      const type = url.pathname.endsWith('.js') || url.pathname.endsWith('.mjs') ? 'text/javascript'
        : url.pathname.endsWith('.json') ? 'application/json'
        : url.pathname.endsWith('.css') ? 'text/css' : 'text/html';
      route.fulfill({ status: 200, contentType: type, body });
    } catch { route.fulfill({ status: 404, body: 'no' }); }
  });
}

const OUT = process.env.SHOT_DIR ?? 'tools/shots';
mkdirSync(OUT, { recursive: true });

const PAGE = `<!doctype html><html><head><meta charset="utf-8">
<style>${ENHANCED_TOKENS}${ENHANCED_CSS}
 html,body{margin:0;height:100%;background:#1b1a17;overflow:hidden}
 .floor{position:fixed;inset:0;background:
   repeating-linear-gradient(45deg,#2a2721 0 14px,#231f1a 14px 28px)}
</style></head><body><div class="floor"></div></body></html>`;

// The four shapes the stack really carries: a one-line notice, the
// status readout (STATUS-LIVE's own rows, its caption and all), a long
// quest box that MUST still wrap at the cap, and a toast.
const CASES = [
  ['short', { rows: ['You are healthy.'] }],
  ['status', { rows: [
    { text: 'You are in Daggerfall.', center: true },
    { text: 'It is 13:30 on Morndas, 11 Last Seed, 3E 405.', center: true },
    { text: 'In the eyes of the law of Daggerfall,', center: true },
    { text: 'you are an outlaw.', center: true },
    '',
    { text: 'You have contracted the Plague.', center: true },
  ], hint: 'press I or ESC to close' }],
  ['long', { rows: [
    'The Blades have long memories, and a longer reach. You will go to the tomb',
    'beneath the moors, and you will bring back what was left there, and you will',
    'not ask whose it was.',
  ] }],
  ['toast', { rows: ['Your Long Blade skill has increased.'], toast: true }],
];

const b = await chromium.launch();
const rows = [];
for (const [W, H, label] of [[1280, 720, 'desktop'], [1024, 640, 'narrow'], [420, 780, 'phone']]) {
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.error('PAGEERR', String(e).slice(0, 300)));
  await serveRepo(p);
  await p.goto('http://probe.local/', { waitUntil: 'load' });
  const measured = await p.evaluate(async (cases) => {
    const en = await import('/src/ui/enhancedNotice.js');
    const sk = await import('/src/systems/uiSkin.js');
    sk.setUiSkin('enhanced');
    en.destroyEnhancedNotice();
    const out = [];
    for (const [name, frame] of cases) {
      const host = en.drawEnhancedNotice(frame, document, name);
      out.push({ name, host, frame });
    }
    // THE PANEL IS KEPT ALIVE THE WAY A BOX KEEPS IT ALIVE: by
    // drawing, every frame. Measured the first time this ran and a
    // panel came back 46px off the right edge with a live transform -
    // NOTICE_WATCHDOG_MS had fired at 400ms (no draws arrived, so the
    // module correctly decided the box was gone) and what the picture
    // showed was a slide-OUT halfway done. A harness that does not do
    // what the host does measures its own artefact.
    const until = performance.now() + 520;   // past the 260ms slide, with the watchdog fed throughout
    await new Promise((done) => {
      const pump = () => {
        for (const { name, frame } of out) en.drawEnhancedNotice(frame, document, name);
        if (performance.now() < until) requestAnimationFrame(pump); else done();
      };
      requestAnimationFrame(pump);
    });
    return out.map(({ name, host }) => {
      const r = host.getBoundingClientRect();
      return { name, w: Math.round(r.width), right: Math.round(r.right), vw: window.innerWidth, resting: getComputedStyle(host).transform };
    });
  }, CASES);
  const name = `${OUT}/noticefit-${label}.png`;
  await p.screenshot({ path: name });
  for (const m of measured) rows.push({ label, W, ...m, shot: name });
  await ctx.close();
}
await b.close();
for (const r of rows) {
  console.log(`${r.label.padEnd(8)} vp ${String(r.W).padStart(5)}  ${r.name.padEnd(8)} ${String(r.w).padStart(5)}px  right ${String(r.right).padStart(5)} of ${r.vw}  ${r.resting}`);
}
console.log('\nshots:', [...new Set(rows.map((r) => r.shot))].join(' '));
