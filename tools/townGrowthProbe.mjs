// /usr/bin/env node
// A TOWN'S OUTSKIRTS IN THE RUNNING GAME. Boots the streaming world in
// shot mode at a town (`?region=&loc=`), waits for the settlement host to stand its outskirts (window.__settlementView),
// judges they stood with every mesh, and shoots them from the air. Needs ARENA2 (the dev server's /arena2). The shots are
// of the player's own ground: they stay in scratch/.
//  ARENA2_PATH=... node tools/townGrowthProbe.mjs [region] [town] [--out scratch/town-growth] [--season summer]
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const out = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : 'scratch/town-growth';
const SEASON = process.argv.includes('--season') ? process.argv[process.argv.indexOf('--season') + 1] : null;   // summer, rain or winter (shared.js seasonOverride)
const named = process.argv.slice(2).filter((arg, i, all) => !arg.startsWith('--') && all[i - 1] !== '--out' && all[i - 1] !== '--season');   // a flag's value is no town
const [REGION = 'Daggerfall', TOWN = 'Arkbridge'] = named;
mkdirSync(out, { recursive: true });
const server = await createServer({ server: { port: 5242, strictPort: true }, logLevel: 'error' });
await server.listen();
const exe = process.env.CHROMIUM ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const browser = await chromium.launch({ headless: true, ...(exe ? { executablePath: exe } : {}), args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message)));
page.on('console', (m) => { const t = m.text(); if (m.type() === 'error' && !/status of 404/.test(t)) errors.push(`[console] ${t}`); if (/\[settlements\]/.test(t)) errors.push(`[warn] ${t}`); });
const frameNow = () => page.evaluate(() => window.__frame ?? 0).catch(() => 0);
const frames = async (n, cap = 60000) => {
  const f0 = await frameNow(), t0 = Date.now();
  while (Date.now() - t0 < cap) { await page.waitForTimeout(200); if (await frameNow() >= f0 + n) break; }
};
const until = async (fn, cap = 240000, arg = undefined) => { const t0 = Date.now(); for (;;) { const v = await page.evaluate(fn, arg).catch(() => null); if (v) return v; if (Date.now() - t0 > cap) return null; await frames(1, 10000); } };
/** A verdict against the game: said, and the exit code set. */
const fail = (why) => { console.log('FAIL:', why); process.exitCode = 1; };
try {
  await page.goto(`http://localhost:5242/play/?world&nomenu&class=0&novideo&shot&play&tod=12:00&region=${encodeURIComponent(REGION)}&loc=${encodeURIComponent(TOWN)}${SEASON ? `&season=${SEASON}` : ''}`);
  const view = await until((name) => { const v = window.__settlementView?.() ?? []; const s = v.find((x) => x.name === name); return s && s.ready >= s.meshes ? s : null; }, 600000, TOWN);
  if (!view) throw new Error(`no outskirts stood round ${TOWN}: ${await page.evaluate(() => JSON.stringify(window.__settlementView?.() ?? null)).catch((e) => e.message)}`);
  console.log(JSON.stringify({ town: view.name, buildings: view.buildings, meshes: `${view.ready}/${view.meshes}`, mid: view.mid.map((v) => +v.toFixed(1)) }));
  if (view.buildings < 3) fail(`${TOWN} grew ${view.buildings} buildings`);
  const shoot = async (name, x, y, z, yaw, pitch) => {
    await page.evaluate(([a, b, c, d, e]) => window.__pose(a, b, c, d, e), [x, y, z, yaw, pitch]);
    await frames(12); await page.screenshot({ path: join(out, `${name}.png`), timeout: 120000 });
  };
  await shoot('air', view.mid[0], view.mid[1] + 160, view.mid[2] - 260, 0, -0.55);
  await shoot('air-west', view.mid[0] - 260, view.mid[1] + 140, view.mid[2], Math.PI / 2, -0.5);
  const d = view.doors[0];
  if (d) {
    const r = (d.facing * Math.PI) / 180, back = [Math.sin(r), Math.cos(r)];
    await shoot('street', d.at[0] + back[0] * 10, d.at[1] + 1.7, d.at[2] + back[1] * 10, Math.atan2(-back[0], -back[1]), -0.05);
  }
} catch (e) { fail(e.message); }
if (errors.length) fail(`page errors:\n${errors.slice(0, 12).join('\n')}`);
else console.log('no page errors');
await browser.close(); await server.close();
