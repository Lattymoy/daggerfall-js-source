// GRASS-LIT (2026-10-01): THE REAL WORLD'S GRASS, PHOTOGRAPHED. Boots the streaming world (`?world`) headless on
// SwiftShader at a ONE-square view radius (the shelf's land view and DFU's TerrainDistance, set before the page
// loads - the default radius streams 121 squares and a software rasteriser never finishes), waits for the shot
// flag, runs `EVAL` (shot mode's hooks: `__grassSpot(r, skip)` finds a field, `__pose` stands the camera on it),
// waits for the stream to idle, presses `KEYS` (the intro's popups) and photographs it - or, with `VARIANTS`, one
// photograph per grass palette (`__grassTones`) or per expression, from the one boot.
//
// Needs ARENA2_PATH (the game's data, which never enters this tree) and the provisioned Chromium. The frames are a
// picture, not a frame rate: SwiftShader's milliseconds are nobody's. Renders of game data are game data
// (Port-Doctrine) - write them outside the tree.
//
//   ARENA2_PATH=... Q='shot&world&class=0&season=summer&tod=12:00&weather=sunny' \
//     EVAL='(()=>{const s=__grassSpot(3,1); __pose(s.feet[0], s.feet[1]+1.7, s.feet[2], s.yaw, -0.22); return s;})()' \
//     node tools/grassLookProbe.mjs /tmp/field.png
//
// Env: Q the page query (keep `shot&world`; `class=0` skips character creation, `season=summer` grows the grass);
// PREFS a JSON of uiPrefs to boot with (`{"grassStyle":"smooth"}`, `{"enhancedLighting":false}`); EVAL; KEYS
// (comma-separated, default `Enter,n,n`); VARIANTS a JSON array of `{ name, tones?, classic?, eval? }` - a palette
// paints the lane booted (`classic` the classic lane's, by default when PREFS turn Enhanced Lighting off); W/H the
// viewport; PORT the dev server's (5201); DEBUG every console line. KEYS=',' presses none (an empty KEYS is the default's).
// UNTIL an expression the page is waited on before the first shot (BANTHA2: `__grassStats().floor.cells >= 340` - a field
// placed whole, its ~355 cells inside the 300 m range; SwiftShader's frames take seconds, and a field places two cells a
// frame). The judgement counts the jungle floor's tufts with the meadow's: deep in the jungle the floor is the only grass
// (03-World/Bantha-Jungle.md).
import { createServer } from 'vite';
import { chromium } from 'playwright';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const out = process.argv[2];
if (!out) { console.error('usage: node tools/grassLookProbe.mjs out.png'); process.exit(2); }
const port = Number(process.env.PORT || 5201);
// GRASS-LIT2: `__pose` DOES NOT MOVE THE EYE ACROSS THE GROUND. It turns the view; the eye's x and z, read off the
// terrain program's uView and `__renderer._camPos`, stay at the pixel's origin corner. `__pose` writes `cam.pos` alike
// with `&fly` or without (shot mode never walks); what takes it back is not run down (AUDIT GRASS-LIT2: this said FIX-C
// and `&fly`, and the code says neither). Photograph what stands in view of that corner.
const query = process.env.Q || 'shot&world&class=0&season=summer&tod=12:00&weather=sunny';
const prefs = JSON.parse(process.env.PREFS || '{}');
const server = await createServer({ root: process.cwd(), configFile: process.cwd() + '/vite.config.js', server: { port, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'] });
const page = await browser.newPage({ viewport: { width: Number(process.env.W || 960), height: Number(process.env.H || 600) } });
const pageErrors = [];
page.on('pageerror', (e) => { pageErrors.push(e.message); console.log('[pageerror]', e.message); });
page.on('console', (m) => { const t = m.text(); if ((process.env.DEBUG || m.type() === 'error' || m.type() === 'warning' || /grass|spot/i.test(t)) && !/404|cursor|CERT|GL Driver/.test(t)) console.log(`[page:${m.type()}]`, t.slice(0, 400)); });
await page.addInitScript((p) => {
  localStorage.setItem('dagger.ui.v1', JSON.stringify({ landViewDistance: 1, ...p }));
  localStorage.setItem('dagger.settings.v1', JSON.stringify({ Experimental: { TerrainDistance: '1' } }));
}, prefs);
/** wait until the page has drawn `n` more frames (shot mode's counter - never a sleep) */
const frames = async (n) => { const f = await page.evaluate(() => window.__frame); await page.waitForFunction(([f0, k]) => window.__frame >= f0 + k, [f, n], { timeout: 600000, polling: 1000 }); };
const fail = (why) => { console.error('FAIL', why); process.exitCode = 1; };
const t0 = Date.now();
await page.goto(`http://localhost:${port}/play/?${query}`);
await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 900000, polling: 2000 });
console.log('ready in', ((Date.now() - t0) / 1000).toFixed(0), 's');
let posed = null;
if (process.env.EVAL) {
  posed = await page.evaluate(process.env.EVAL);
  console.log('eval ->', JSON.stringify(posed));
  await page.waitForFunction(() => !window.__streamIdle || window.__streamIdle() === true, null, { timeout: 900000, polling: 2000 });
  await frames(4);
}
for (const k of (process.env.KEYS || 'Enter,n,n').split(',').filter(Boolean)) { await page.keyboard.press(k); await page.waitForTimeout(700); }
await frames(3);
if (process.env.UNTIL) { await page.waitForFunction(process.env.UNTIL, null, { timeout: 1800000, polling: 5000 }); await frames(3); }
const variants = process.env.VARIANTS ? JSON.parse(process.env.VARIANTS) : null;
if (!variants) { await page.screenshot({ path: out, timeout: 300000 }); console.log('shot', out); }
else for (const v of variants) {
  // AUDIT GRASS-LIT2: a palette paints the lane that is shot - the classic lane's tones are its own (`classic` forces it)
  await page.evaluate((x) => { if (x.tones !== undefined) window.__grassTones?.(x.tones, x.classic); if (x.eval) (0, eval)(x.eval); }, { ...v, classic: v.classic ?? prefs.enhancedLighting === false });
  await frames(3);
  const file = out.replace(/\.png$/, `_${v.name}.png`);
  await page.screenshot({ path: file, timeout: 300000 }); console.log('shot', file);
}
// THE JUDGEMENT: the page drew without a fault, the field was found where one was asked for, and the grass stood in it
const grass = await page.evaluate(() => window.__grassStats?.() ?? null);
console.log('grass ->', JSON.stringify(grass && { blades: grass.blades, drawn: grass.drawn?.blades, cells: grass.cells, floor: grass.floor?.drawn?.blades }));
if (pageErrors.length) fail(`${pageErrors.length} page error(s): ${pageErrors[0]}`);
if (process.env.EVAL && posed == null) fail('no field to stand on (EVAL answered nothing)');
if (process.env.EVAL && !((grass?.drawn?.blades ?? 0) + (grass?.floor?.drawn?.blades ?? 0) > 0)) fail('the grass drew no blades');
await browser.close(); await server.close();
