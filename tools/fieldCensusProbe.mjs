// ═══════════════════════════════════════════════════════════════════
// EE9: THE FIELD CENSUS. The gate the design named for the surface
// field: boot the WORLD host in WINTER, read the field's own numbers,
// and prove what a screenshot cannot - that the snow on the ground is
// the FIELD's (mean depth well above zero in winter), that the ground
// under the player's feet reads a print (lower after a walk than
// before), and that ?field=off takes every field away.
//
//   ARENA2_PATH=... node tools/fieldCensusProbe.mjs [--only on|off]
import { createServer } from 'vite';
import { chromium } from 'playwright';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const fails = [];
const check = (name, ok, detail = '') => {
  if (ok) console.log(`  ok   ${name}`); else { console.error(`  FAIL ${name}${detail ? ` - ${detail}` : ''}`); fails.push(name); }
};
const server = await createServer({ server: { port: 5233, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });

const run = async (query, walk) => {
  const page = await browser.newPage({ viewport: { width: 320, height: 200 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));
  await page.goto(`http://localhost:5233/play/?world&shot&novideo&nofoes&class=1&season=winter&grass=off${query}`);
  const until = Date.now() + 200000; let f = 0;
  while (Date.now() < until) { f = await page.evaluate(() => window.__frame ?? 0); if (f > 10) break; await page.waitForTimeout(1000); }
  const before = await page.evaluate(() => (window.__fieldCensus ? window.__fieldCensus() : null));
  let after = null;
  if (walk) {
    // walk forward for a few seconds, then read the depth under the feet
    await page.keyboard.down('w'); await page.waitForTimeout(4000); await page.keyboard.up('w');
    await page.waitForTimeout(600);
    after = await page.evaluate(() => (window.__fieldCensus ? window.__fieldCensus() : null));
  }
  await page.close();
  return { frames: f, before, after, errors };
};

const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
if (only !== 'off') {
  const on = await run('', true);
  check('field ON: the winter world renders frames', on.frames > 10, `frames=${on.frames}`);
  check('field ON: no page error', on.errors.length === 0, on.errors.slice(0, 2).join(' | '));
  check(`field ON: near-ring pixels carry a field (${on.before?.pixels ?? 0})`, (on.before?.pixels ?? 0) > 0);
  check(`field ON: midwinter snow is the FIELD's (mean ${(on.before?.snow ?? 0).toFixed(2)} > 0.2)`, (on.before?.snow ?? 0) > 0.2);
  const b = on.before?.underPlayer; const a = on.after?.underPlayer;
  check(`field ON: a walk leaves a print under the feet (${b?.toFixed?.(2)} -> ${a?.toFixed?.(2)})`,
    typeof b === 'number' && typeof a === 'number' && (a < b * 0.9 || b < 0.02));
}
if (only !== 'on') {
  const off = await run('&field=off', false);
  check('field OFF: the winter world still renders', off.frames > 10, `frames=${off.frames}`);
  check(`field OFF: the kill switch takes every field away (${off.before?.pixels ?? 0})`, (off.before?.pixels ?? 0) === 0);
}
await browser.close(); await server.close();
if (fails.length) { console.error(`\nfield census: ${fails.length} failure(s)`); process.exit(1); }
console.log('\nfield census ok');
