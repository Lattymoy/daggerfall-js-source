// Local DOM validation of the real HudText/toast surface used by townTalk.say.
import { chromium } from 'playwright';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENHANCED_CSS, ENHANCED_TOKENS } from '../src/ui/enhanced/enhancedStyle.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = resolve(process.env.PARTY_PROBE_OUT ?? 'tools/shots/party-arrival');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
  for (const [width, height] of [[360, 800], [390, 844], [800, 360], [1280, 720], [1920, 1080]]) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, hasTouch: width < 900 });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('requestfailed', (r) => console.error('REQUEST', r.url(), r.failure()));
    page.on('console', (m) => { if (m.type() === 'error') console.error(m.text()); });
    await page.route('http://probe.local/**', (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body:
        `<!doctype html><html><head><meta charset="utf-8"><style>${ENHANCED_TOKENS}${ENHANCED_CSS}html,body{margin:0;background:#24282d;height:100%;overflow:hidden}</style></head><body></body></html>` });
      const path = resolve(root, '.' + url.pathname);
      if (!path.startsWith(root)) return route.abort();
      try { return route.fulfill({ body: readFileSync(path), contentType: ['.js', '.mjs'].includes(extname(path)) ? 'text/javascript' : extname(path) === '.json' ? 'application/json' : 'application/octet-stream' }); }
      catch { return route.fulfill({ status: 404, body: '' }); }
    });
    await page.goto('http://probe.local/');
    const checks = await page.evaluate(async () => {
      const { HudText } = await import('/src/ui/hud/hudText.js');
      const { PARTY_ARRIVAL_TEXT } = await import('/src/systems/party/partyArrival.js');
      const hud = new HudText('town');
      for (const text of Object.values(PARTY_ARRIVAL_TEXT)) hud.add(text);
      hud.draw(null, null, null);
      await new Promise((resolve) => setTimeout(resolve, 320));
      const texts = [...document.querySelectorAll('.notice-body')];
      const rows = texts.map((e) => {
        const r = e.getBoundingClientRect(), css = getComputedStyle(e);
        const range = document.createRange(); range.selectNodeContents(e.querySelector('.notice-row'));
        const lines = [...range.getClientRects()].map((r) => ({ left: r.left, right: r.right }));
        return { text: e.textContent, visible: r.width > 0 && r.height > 0,
          fits: lines.every((r) => r.left >= 0 && r.right <= innerWidth + 1), lines,
          color: css.color, fontSize: css.fontSize };
      });
      return { rows, messagesPresent: Object.values(PARTY_ARRIVAL_TEXT).every((t) => rows.some((r) => r.text === t)),
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth };
    });
    await page.screenshot({ path: resolve(out, `party-arrival-${width}x${height}.png`) });
    const ok = errors.length === 0 && checks.messagesPresent && !checks.horizontalOverflow
      && checks.rows.every((r) => r.visible && r.fits);
    results.push({ width, height, ok, errors, ...checks });
    await context.close();
  }
} finally { await browser.close(); }
writeFileSync(resolve(out, 'results.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
if (results.some((r) => !r.ok)) process.exitCode = 1;
