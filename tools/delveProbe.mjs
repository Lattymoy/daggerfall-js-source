#!/usr/bin/env node
// DELVE II (DLV2) PROBE: a dungeon's encounters in the real game, on the freeware's data - the dungeon bench
// (scenes/dungeon.js, `?dungeon=`) in a real browser, each site walked into and won by the probe's hand (a Hold's foes
// struck down through the real damage door, a Litany's plates stepped in its order), its vault pressed, the frame's cost
// of the encounters measured, every page error a failure. Pictures at each stage when a folder is given.
//
//   node tools/delveProbe.mjs [region] [dungeon] [shots-dir]      e.g.  Daggerfall "Bedard Laboratory" /tmp/delve
//
// Exits 1 on a page error, a site never stood, or a site never won.
import { mkdirSync } from 'node:fs';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { litanyPlates } from '../src/net/delve/delveLaw.js';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const [region = 'Daggerfall', name = 'Bedard Laboratory', shots = null] = process.argv.slice(2);
if (shots) mkdirSync(shots, { recursive: true });
const server = await createServer({ server: { port: 5231, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message)));
const fail = async (why) => { console.log(`FAIL: ${why}`); await browser.close(); await server.close(); process.exit(1); };

const q = new URLSearchParams({ region, dungeon: name });
await page.goto(`http://localhost:5231/play/?shot&play&nomenu&novideo&class=1&${q}`);   // class=1: the headless character (no wizard)
await page.waitForFunction(() => window.__frame > 10, null, { timeout: 240000 });
const frames = async (n) => {
  const f0 = await page.evaluate(() => window.__frame);
  await page.waitForFunction(([a, k]) => window.__frame > a + k, [f0, n], { timeout: 120000 });
};
// the windows a first visit opens (the dungeons' tutorial box): closed, so the frame runs
for (let k = 0; k < 12; k++) {
  const ov = JSON.parse(await page.evaluate(() => window.__overlay?.() ?? 'null') ?? 'null');
  if (!ov) break;
  await page.waitForTimeout(700);   // a tutorial page takes no press until it has stood 400 ms (ui/tutorialPopup.js INPUT_GRACE_MS)
  await page.keyboard.press('Space');
  await frames(3);
}
const say = () => page.evaluate(async () => (await import('/src/ui/midScreenText.js')).midScreenText.text);
const state = () => page.evaluate(() => window.__delve()?.state() ?? null);
const heal = () => page.evaluate(() => { const p = window.__playerEntity; if (p) p.health = p.maxHealth; });
const shot = async (tag) => { if (shots) await page.screenshot({ path: `${shots}/${tag}.png` }); };
// THE COST: the host's frame and its marks' pass, timed in the page
await page.evaluate(() => {
  const h = window.__delve();
  if (!h) return;
  window.__delveCost = { frame: 0, draw: 0, n: 0, max: 0 };
  const C = window.__delveCost, f = h.frame.bind(h), d = h.drawPass.bind(h);
  h.frame = (...a) => { const t = performance.now(); f(...a); const ms = performance.now() - t; C.frame += ms; C.n++; C.max = Math.max(C.max, ms); };
  h.drawPass = (...a) => { const t = performance.now(); const r = d(...a); C.draw += performance.now() - t; return r; };
});
const sites = await page.evaluate(() => window.__delve()?.sites ?? null);
if (!sites) await fail('no encounter host on the context');
console.log(`${region} / ${name}: ${sites.length} site(s)`);
if (!sites.length) await fail('the plan stood no site');

for (const s of sites) {
  console.log(`site ${s.i}: ${s.kind} at [${s.x}, ${s.y}, ${s.z}] r ${s.r}, vault [${s.vault.join(', ')}]`);
  const at = (p) => page.evaluate(([x, y, z]) => window.__player.warp(x, y + 0.05, z), p);
  // the vantage: inside the ward on its +x side, looking back at the heart and down at the floor
  const look = async () => { await at([s.x + s.r + 1, s.y, s.z]); await page.evaluate((p) => window.__pose(...p, -Math.PI / 2, -0.5), [s.x + s.r + 1, s.y + 1.6, s.z]); };
  // near, then in
  await at([s.x + s.r + 5, s.y, s.z]); await frames(6);
  console.log(`  near: "${await say()}"`);
  await shot(`site${s.i}-near`);
  await at([s.x, s.y, s.z]); await frames(4);
  console.log(`  in: "${await say()}"  ${JSON.stringify((await state())[s.i])}`);
  await look(); await frames(4);
  await shot(`site${s.i}-in`);
  const t0 = Date.now();
  if (s.kind === 'hold') {
    let shotWave = false;
    while (!(await state())[s.i].won && Date.now() - t0 < 600_000) {
      await heal();
      const killed = await page.evaluate((i) => {
        let k = 0;
        for (const [j, f] of window.__delve() ? Object.entries(JSON.parse(window.__foes())) : []) {
          const r = window.__foeRecord(Number(j));
          if (r && r._delve === i && !r.dead && r.entity) { window.__damageFoe(Number(j), r.entity.health + 999); k++; }
          void f;
        }
        return k;
      }, s.i);
      const st = (await state())[s.i];
      if (killed && !shotWave) { shotWave = true; await shot(`site${s.i}-wave`); }
      if (killed) console.log(`  wave ${st.w} (phase ${st.p}): struck ${killed}, "${await say()}"`);
      await look();
      await frames(10);
    }
  } else {
    await frames(4);
    const deadline = Date.now() + 120_000;
    await look();
    let shown = false;
    while ((await state())[s.i].p !== 6 && Date.now() < deadline) { await frames(5); if (!shown) { shown = true; await shot(`site${s.i}-show`); } }
    await shot(`site${s.i}-show-done`);
    const { order } = (await state())[s.i];
    const plates = litanyPlates(s);
    console.log(`  the order: ${order.join(' ')}`);
    for (const j of order) { await at([s.x, s.y, s.z]); await frames(3); await at(plates[j]); await frames(3); console.log(`  plate ${j}: next ${(await state())[s.i].next}`); }
  }
  await look(); await frames(4);
  const st = (await state())[s.i];
  console.log(`  ${st.won ? 'WON' : 'NOT WON'} in ${((Date.now() - t0) / 1000).toFixed(0)} s: "${await say()}", vault ${st.vault} item(s)`);
  await shot(`site${s.i}-won`);
  if (!st.won) await fail(`site ${s.i} never won`);
  const opened = await page.evaluate((i) => { window.__delve().press(`delve:vault:${i}`); return window.__overlay(); }, s.i);
  console.log(`  the vault: ${JSON.parse(opened ?? 'null')?.kind ?? 'no window'}`);
  await shot(`site${s.i}-vault`);
  await page.evaluate(() => window.__overlayKey?.('Escape'));
  await frames(4);
}
const cost = await page.evaluate(() => window.__delveCost);
if (cost?.n) console.log(`cost: frame ${(cost.frame / cost.n).toFixed(3)} ms mean, ${cost.max.toFixed(2)} ms worst; marks ${(cost.draw / cost.n).toFixed(3)} ms mean over ${cost.n} frames`);
if (errors.length) await fail(`page errors:\n  ${errors.join('\n  ')}`);
console.log('OK');
await browser.close();
await server.close();
