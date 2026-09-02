// ═══════════════════════════════════════════════════════════════════
// EE7: THE GRASS CENSUS. A probe cannot see a blade in a 320px frame
// under a software rasteriser, and a full-size world frame with a
// quarter of a million blades takes that rasteriser most of an hour.
// What a probe CAN see is the world's own count: how many pixels carry
// grass and how many blades stand in them, and that the kill switch
// takes them to zero. This boots the WORLD host in summer - a lawn to
// stand on - on the smallest frame that renders, and reads both.
//
//   ARENA2_PATH=... node tools/grassCensusProbe.mjs [--only on|off]
//
// Two world boots back to back outrun a five-minute harness; --only
// runs one half, and the two halves together are the gate.
import { createServer } from 'vite';
import { chromium } from 'playwright';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const fails = [];
const check = (name, ok, detail = '') => {
  if (ok) console.log(`  ok   ${name}`); else { console.error(`  FAIL ${name}${detail ? ` - ${detail}` : ''}`); fails.push(name); }
};
const server = await createServer({ server: { port: 5231, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });

const run = async (query) => {
  const page = await browser.newPage({ viewport: { width: 320, height: 200 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));
  await page.goto(`http://localhost:5231/play/?world&shot&novideo&nofoes&season=summer${query}`);
  const until = Date.now() + 200000; let f = 0;
  while (Date.now() < until) { f = await page.evaluate(() => window.__frame ?? 0); if (f > 10) break; await page.waitForTimeout(1000); }
  const census = await page.evaluate(() => (window.__grassCensus ? window.__grassCensus() : null));
  await page.close();
  return { frames: f, census, errors };
};

const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
if (only !== 'off') {
  const on = await run('');
  check('grass ON: the world renders frames', on.frames > 10, `frames=${on.frames}`);
  check('grass ON: no page error', on.errors.length === 0, on.errors.slice(0, 2).join(' | '));
  check(`grass ON: pixels carry blades (${on.census?.pixels ?? 0} pixels, ${on.census?.blades ?? 0} blades)`,
    (on.census?.pixels ?? 0) > 0 && (on.census?.blades ?? 0) > 1000);
}
if (only !== 'on') {
  const off = await run('&grass=off');
  check('grass OFF: the world still renders', off.frames > 10, `frames=${off.frames}`);
  check(`grass OFF: the kill switch takes every blade away (${off.census?.blades ?? 0})`, (off.census?.blades ?? 0) === 0);
}

await browser.close(); await server.close();
if (fails.length) { console.error(`\ngrass census: ${fails.length} failure(s)`); process.exit(1); }
console.log('\ngrass census ok');
