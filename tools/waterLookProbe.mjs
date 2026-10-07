// WATER-NEXT (2026-10-07): THE REAL WORLD'S WATER, PHOTOGRAPHED - THE REVERT's lesson (bible/07-Rendering/Water-Arc.md:
// "a look change wants a shot from the real game before it lands, not a probe number"). Boots the streaming world
// (`?world`) headless on SwiftShader at a one-square view radius, as tools/grassLookProbe.mjs does, waits for the shot
// flag and the stream, then takes one photograph per SHOTS entry from the one boot - each an expression run in the
// page first (shot mode's hooks: `__findTiles`, `__pose`, `__look`, `__move`). Fails on any page error or a shader that
// would not build.
//
// Needs ARENA2_PATH (the game's data, which never enters this tree) and the provisioned Chromium. Renders of game data
// are game data (Port-Doctrine) - write them outside the tree.
//
//   ARENA2_PATH=... SHOTS='[{"name":"pond","eval":"__look(0,-0.35)"}]' node tools/waterLookProbe.mjs /tmp/shots/water
//
// Env: Q the page query (default the Daggerfall streaming boot at noon, sunny); PREFS a JSON of uiPrefs to boot with;
// SETUP an expression run once after the boot (a pose); SHOTS a JSON array of {name, eval?, frames?}; KEYS the intro's
// keys (default `Enter,n,n`); W/H; PORT (5202).
import { createServer } from 'vite';
import { chromium } from 'playwright';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const out = process.argv[2];
if (!out) { console.error('usage: node tools/waterLookProbe.mjs out-prefix'); process.exit(2); }
const port = Number(process.env.PORT || 5202);
const query = process.env.Q || 'shot&world&class=0&season=summer&tod=12:00&weather=sunny';
const prefs = JSON.parse(process.env.PREFS || '{}');
const shots = JSON.parse(process.env.SHOTS || '[{"name":"view"}]');
const server = await createServer({ root: process.cwd(), configFile: process.cwd() + '/vite.config.js', server: { port, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'] });
const page = await browser.newPage({ viewport: { width: Number(process.env.W || 960), height: Number(process.env.H || 600) } });
const faults = [];
page.on('pageerror', (e) => { faults.push(e.message); console.log('[pageerror]', e.message); });
page.on('console', (m) => {
  const t = m.text();
  if (/shader|compile|link|GL_INVALID|INVALID_OPERATION|water/i.test(t) && (m.type() === 'error' || m.type() === 'warning')) { faults.push(t); console.log(`[page:${m.type()}]`, t.slice(0, 600)); }
});
await page.addInitScript((p) => {
  localStorage.setItem('dagger.ui.v1', JSON.stringify({ landViewDistance: 1, ...p }));
  localStorage.setItem('dagger.settings.v1', JSON.stringify({ Experimental: { TerrainDistance: '1' } }));
}, prefs);
/** wait until the page has drawn `n` more frames (shot mode's counter - never a sleep) */
const frames = async (n) => { const f = await page.evaluate(() => window.__frame); await page.waitForFunction(([f0, k]) => window.__frame >= f0 + k, [f, n], { timeout: 600000, polling: 1000 }); };
const idle = () => page.waitForFunction(() => !window.__streamIdle || window.__streamIdle() === true, null, { timeout: 900000, polling: 2000 });
const t0 = Date.now();
await page.goto(`http://localhost:${port}/play/?${query}`);
await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 900000, polling: 2000 });
console.log('ready in', ((Date.now() - t0) / 1000).toFixed(0), 's');
for (const k of (process.env.KEYS || 'Enter,n,n').split(',').filter(Boolean)) { await page.keyboard.press(k); await page.waitForTimeout(700); }
if (process.env.SETUP) console.log('setup ->', JSON.stringify(await page.evaluate(process.env.SETUP)));
await idle();
await frames(4);
for (const s of shots) {
  if (s.eval) console.log(s.name, '->', JSON.stringify(await page.evaluate(s.eval)));
  await frames(s.frames ?? 3);
  const file = `${out}_${s.name}.png`;
  await page.screenshot({ path: file, timeout: 300000 });
  console.log('shot', file);
}
if (faults.length) { console.error('FAIL', faults.length, 'fault(s):', faults[0].slice(0, 400)); process.exitCode = 1; }
await browser.close(); await server.close();
