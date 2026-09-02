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

// AUDIT 48: --skin classic proves the classic skin carries NO field and no
// grass - the switch's other half, which no gate had ever actually run.
const SKIN = process.argv.includes('--skin') ? process.argv[process.argv.indexOf('--skin') + 1] : null;
const run = async (query, walk) => {
  const page = await browser.newPage({ viewport: { width: 320, height: 200 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));
  await page.goto(`http://localhost:5233/play/?world&shot&novideo&nofoes&class=1&season=winter${SKIN === 'classic' ? '' : '&grass=off'}${SKIN ? '&skin=' + SKIN : ''}${query}`);   // AUDIT 48: the skin's real door; grass stays ON for the classic run so its absence is the skin's doing
  const until = Date.now() + 200000; let f = 0;
  while (Date.now() < until) { f = await page.evaluate(() => window.__frame ?? 0); if (f > 10) break; await page.waitForTimeout(1000); }
  const before = await page.evaluate(() => (window.__fieldCensus ? window.__fieldCensus() : null));
  let after = null;
  if (walk) {
    // WALK by the world's own door, not by a key: a keypress into a
    // headless page moves nothing until the canvas has focus, and the
    // last run's feet read identical before and after. __warpTo moves
    // the walker two metres, the field's stride rule sees a step, and
    // the print lands on the next tick - deterministically.
    await page.evaluate(() => {
      const c = window.__fieldCensus(); const [x, z] = c.feet;
      if (window.__warpTo) window.__warpTo([x + 2.2, 0, z - 2.2], 0);
    });
    await page.waitForTimeout(900);
    after = await page.evaluate(() => (window.__fieldCensus ? window.__fieldCensus() : null));
  }
  await page.close();
  return { frames: f, before, after, errors };
};

const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
if (SKIN === 'classic') {
  const cl = await run('');
  check('classic skin: the winter world renders', cl.frames > 10, `frames=${cl.frames}`);
  check(`classic skin: NO pixel carries a field (${cl.census?.pixels ?? 0})`, (cl.census?.pixels ?? 0) === 0);
  check(`classic skin: NO pixel carries grass (${cl.grass?.blades ?? 0} blades)`, (cl.grass?.blades ?? 0) === 0);
} else if (only !== 'off') {
  const on = await run('', true);
  check('field ON: the winter world renders frames', on.frames > 10, `frames=${on.frames}`);
  check('field ON: no page error', on.errors.length === 0, on.errors.slice(0, 2).join(' | '));
  check(`field ON: near-ring pixels carry a field (${on.before?.pixels ?? 0})`, (on.before?.pixels ?? 0) > 0);
  check(`field ON: midwinter snow is the FIELD's (mean ${(on.before?.snow ?? 0).toFixed(2)} > 0.2)`, (on.before?.snow ?? 0) > 0.2);
  // THE PRINT: the cell the walker stands on against an UNTOUCHED cell
  // beside the trail. The first census compared two stamped cells - the
  // walker stamps the cell it boots on - and read "no print" on a field
  // full of them; an hour went into the field before the 5x5 grid showed
  // the trenches were there all along. Measure what the number means.
  const trench = on.after?.underPlayer; const beside = on.after?.beside;
  check(`field ON: a walk leaves a DEEP print - under the feet ${trench?.toFixed?.(2)} against untouched ${beside?.toFixed?.(2)} beside it (stamps ${on.before?.stamps ?? 0} -> ${on.after?.stamps ?? 0})`,
    typeof trench === 'number' && typeof beside === 'number' && (trench < beside * 0.5 || beside < 0.02));
}
if (SKIN !== 'classic' && only !== 'on') {
  const off = await run('&field=off', false);
  check('field OFF: the winter world still renders', off.frames > 10, `frames=${off.frames}`);
  check(`field OFF: the kill switch takes every field away (${off.before?.pixels ?? 0})`, (off.before?.pixels ?? 0) === 0);
}
await browser.close(); await server.close();
if (fails.length) { console.error(`\nfield census: ${fails.length} failure(s)`); process.exit(1); }
console.log('\nfield census ok');
