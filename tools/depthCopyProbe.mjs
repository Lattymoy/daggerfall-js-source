// CACHE-COPY (2026-10-07): THE SHADOW CACHE'S COPY CHECK, HEADLESS. Opens tools/fixtures/depth-copy-check.html
// (src/tools/depthCopyCheck.js) through the real page on SwiftShader and holds the draw copy exact - every texel of
// every layer, every round. The old blit is reported, not held: SwiftShader (ANGLE over Vulkan) copies it right, and
// the machines it failed on are Direct3D's - which is what the page is for, opened in the browser that flickered.
//
// Usage: node tools/depthCopyProbe.mjs [size=128] [layers=72] [rounds=4]
import { createServer } from 'vite';
import { chromium } from 'playwright';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const [size = '128', layers = '72', rounds = '4'] = process.argv.slice(2);
let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`); if (!ok) fails++; };

const server = await createServer({ server: { port: 5214, strictPort: true }, logLevel: 'silent' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e.message)));
await page.goto(`http://localhost:5214/tools/fixtures/depth-copy-check.html?size=${size}&layers=${layers}&rounds=${rounds}`);
await page.waitForFunction(() => window.depthCopyResult, null, { timeout: 600000 });
const r = await page.evaluate(() => window.depthCopyResult);
console.log(`GPU: ${r.gpu}`);
console.log(`old depth blit: ${r.blit?.wrong} of ${r.texels} wrong (${r.blit?.byRound?.join(', ')})`);
console.log(`draw copy:      ${r.draw?.wrong} of ${r.texels} wrong (${r.draw?.byRound?.join(', ')})`);
console.log(`verdict: ${r.verdict}`);
check('the check ran, with no GL error', !r.error && r.texels === Number(size) ** 2 * Number(layers) * Number(rounds), String(r.error ?? ''));
check('the draw copy is exact - every texel of every layer, every round', r.draw?.wrong === 0, JSON.stringify(r.draw?.firstWrong));
check('and the check sees a wrong copy: its control, one layer off, wrong in every texel as another layer\'s value', r.control?.wrong === r.texels && r.control?.otherLayer === r.texels, `${r.control?.wrong} / ${r.control?.otherLayer} of ${r.texels}`);
if (pageErrors.length) { console.log('pageerrors:', pageErrors.join(' | ')); fails++; }
await browser.close(); await server.close();
console.log(fails === 0 ? 'DEPTH COPY PROBE: ALL GREEN' : `DEPTH COPY PROBE: ${fails} FAILURE(S)`);
process.exit(fails === 0 ? 0 : 1);
