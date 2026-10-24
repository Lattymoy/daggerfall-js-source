// THE DWARVEN PISTOLET IN THE REAL GAME (PISTOLET, 2026-10-21; bible/05-Combat/Dwarven-Pistolet.md) - a pair of them in
// the player's two hands, through the equip law, in the world host with the player's own ARENA2.
//
// What no pin can claim: the two pistols are drawn as the pair (each through the gun's frame, the left one in the mirror),
// a pull fires the lead hand and the next pull the other, each shot spends a Pellet, and nothing on the page throws.
// Every state is photographed (to the directory named, never public/ - AUDIT 21's law: these frames hold ARENA2's world).
//
//     ARENA2_PATH=<the freeware data, tools/fetch-data.sh> node tools/pistoletGameProbe.mjs <shots-dir>
//
// The world host because it is the one with both the headless character (`class`) and the probe's entity
// (`window.__playerEntity`). Waits are FRAMES, never time (Home.md: SwiftShader draws the world at seconds a frame).
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const OUT = process.argv[2] || 'scratch/pistolet-game';
mkdirSync(OUT, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => { results.push(!!ok); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`); };

const server = await createServer({ server: { port: 5196, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://localhost:5196/play/?shot&world&play&tod=12:00&class=16&nofoes');
await page.waitForFunction(() => window.__shotReady === true && !!window.__playerEntity, null, { timeout: 1200000 });
const waitFrames = async (n) => {
  const f = await page.evaluate(() => window.__frame);
  await page.waitForFunction(([f0, k]) => window.__frame > f0 + k, [f, n], { timeout: 600000 });
};

const worn = await page.evaluate(async () => {
  const P = await import('/src/systems/pistolet.js');
  const T = await import('/src/systems/thunderlock.js');
  const { equipItem } = await import('/src/systems/equip.js');
  const e = window.__playerEntity;
  const a = P.createPistolet(), b = P.createPistolet();
  e.items.push(a, b, T.createPellets(30));
  equipItem(e, a); equipItem(e, b);
  return Object.values(e.equip?.slots ?? {}).filter((v) => v?.templateIndex === 562).length;
});
check('two Pistolets worn, one in each hand, through the equip law', worn === 2, `${worn} worn`);
await waitFrames(20);
await page.screenshot({ path: `${OUT}/pair-rest.png` });

const pellets = () => page.evaluate(() => window.__playerEntity.items.filter((i) => i.templateIndex === 561).reduce((n, i) => n + i.stackCount, 0));
const p0 = await pellets();
const pull = async () => { await page.mouse.move(640, 400); await page.mouse.down({ button: 'right' }); await waitFrames(3); await page.mouse.up({ button: 'right' }); };
await pull();
await page.screenshot({ path: `${OUT}/shot-right.png` });
await waitFrames(8);
await pull();
await page.screenshot({ path: `${OUT}/shot-left.png` });
await waitFrames(10);
await page.screenshot({ path: `${OUT}/reloading.png` });
const p1 = await pellets();
check('each shot spends a Pellet', p0 - p1 === 2, `${p0} -> ${p1}`);
check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close(); await server.close();
console.log(`${results.filter(Boolean).length}/${results.length} ok - shots in ${OUT}/`);
process.exit(results.every(Boolean) ? 0 : 1);
