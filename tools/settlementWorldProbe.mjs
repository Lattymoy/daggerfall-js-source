#!/usr/bin/env node
// RMB-CONTRACTS RMBC4 (bible/03-World/RMB-Contracts.md): A SETTLEMENT IN THE RUNNING GAME. Boots the streaming world in shot
// mode, jumps to a settlement's pixel (window.__tesaJump), waits for its host to stand it (window.__settlementView), and
// shoots it from the air and from a street; then walks to a door and presses it, and says whether the rooms opened.
// Needs ARENA2 (the dev server's /arena2). The shots are of the player's own ground: they stay in scratch/.
//   ARENA2_PATH=... node tools/settlementWorldProbe.mjs [px py] [--out scratch/settlement-world]
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const [px, py] = [Number(process.argv[2] ?? 1084), Number(process.argv[3] ?? 241)];
const out = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : 'scratch/settlement-world';
mkdirSync(out, { recursive: true });
const server = await createServer({ server: { port: 5241, strictPort: true }, logLevel: 'error' });
await server.listen();
const exe = process.env.CHROMIUM ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const browser = await chromium.launch({ headless: true, ...(exe ? { executablePath: exe } : {}), args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message)));
page.on('console', (m) => { const t = m.text(); if (m.type() === 'error' && !/status of 404/.test(t)) errors.push(`[console] ${t}`); if (/\[settlements\]/.test(t)) errors.push(`[warn] ${t}`); });
// a frame count read through a navigation (the boot may reload once): a destroyed context answers 0 and the wait goes on
const frameNow = () => page.evaluate(() => window.__frame ?? 0).catch(() => 0);
const frames = async (n, cap = 60000) => {
  const f0 = await frameNow(), t0 = Date.now();
  while (Date.now() - t0 < cap) { await page.waitForTimeout(200); if (await frameNow() >= f0 + n) break; }
};
const until = async (fn, cap = 240000) => { const t0 = Date.now(); for (;;) { const v = await page.evaluate(fn).catch(() => null); if (v) return v; if (Date.now() - t0 > cap) return null; await frames(1, 10000); } };
try {
  await page.goto('http://localhost:5241/play/?world&nomenu&class=0&novideo&shot&play&tod=12:00');
  await until(() => (window.__frame ?? 0) > 5 && typeof window.__tesaJump === 'function', 300000);
  await page.mouse.click(640, 400);
  for (let i = 0; i < 20; i++) { await page.keyboard.press('Escape'); await frames(2); }
  console.log('booted; jumping to', px, py);
  await page.evaluate(([x, y]) => window.__tesaJump(x, y), [px, py]);
  const view = await until(() => { const v = window.__settlementView?.(); return v?.length && v[0].ready >= v[0].meshes * 0.9 ? v : null; }, 600000);
  if (!view) throw new Error('no settlement stood on the pixel');
  const s = view[0];
  console.log(JSON.stringify({ name: s.name, buildings: s.buildings, meshes: `${s.ready}/${s.meshes}`, mid: s.mid.map((v) => +v.toFixed(1)) }));
  const shoot = async (name, x, y, z, yaw, pitch) => {
    await page.evaluate(([a, b, c, d, e]) => window.__pose(a, b, c, d, e), [x, y, z, yaw, pitch]);
    await frames(12); await page.screenshot({ path: join(out, `${name}.png`) });
  };
  await shoot('air', s.mid[0], s.mid[1] + 70, s.mid[2] - 110, 0, -0.5);
  await shoot('air-west', s.mid[0] - 110, s.mid[1] + 60, s.mid[2], Math.PI / 2, -0.45);
  const d = s.doors[0];
  const r = (d.facing * Math.PI) / 180, back = [Math.sin(r), Math.cos(r)];
  await shoot('street', d.at[0] + back[0] * 9, d.at[1] + 1.7, d.at[2] + back[1] * 9, Math.atan2(-back[0], -back[1]), -0.05);
  // to the door, facing it, and press it
  await page.evaluate(([a, b, c, yaw]) => window.__pose(a, b, c, yaw, 0), [d.at[0] + back[0] * 1.6, d.at[1] + 0.1, d.at[2] + back[1] * 1.6, Math.atan2(-back[0], -back[1])]);
  await frames(10);
  const before = await page.evaluate(() => window.__mode?.() ?? null);
  await page.mouse.click(640, 400); await frames(30);
  for (let i = 0; i < 3; i++) { await page.keyboard.press('Enter'); await frames(10); }
  const after = await page.evaluate(() => window.__mode?.() ?? null);
  await page.screenshot({ path: join(out, 'door.png') });
  console.log(JSON.stringify({ door: d.type, modeBefore: before, modeAfter: after }));
} catch (e) { console.log('FAIL:', e.message); }
console.log(errors.length ? `errors:\n${errors.slice(0, 12).join('\n')}` : 'no page errors');
await browser.close(); await server.close();
