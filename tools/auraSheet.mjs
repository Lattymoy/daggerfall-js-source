// AURA DETAIL (2026-10-28, the owner: "do another detailed pass on the auras themselves as I think we can push this
// further") - EVERY AURA ON ONE SHEET: each look worn by a sprite on the profile's own stage (render/characterStage.js,
// the world's own aura pass), from the profile's angle and from above, at two moments of its clock - so a pass on the
// looks is judged by what a player sees. A contact sheet to tools/shots/aura_sheet.png (or SHOT_DIR); ONLY=<a|b> the
// looks named so, larger (ZOOM).
//
//     node tools/auraSheet.mjs
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = process.env.SHOT_DIR ?? 'tools/shots';
mkdirSync(OUT, { recursive: true });
const BLANK = { name: 'aura-sheet-page', configureServer(s) { s.middlewares.use('/aurasheet/', (_q, res) => { res.setHeader('content-type', 'text/html'); res.end('<!doctype html><meta charset="utf-8"><body style="margin:0;background:#111"></body>'); }); } };
const server = await createServer({ server: { port: 5248, strictPort: true }, logLevel: 'silent', plugins: [BLANK] });
await server.listen();
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
try {
  const zoom = Number(process.env.ZOOM ?? 1);
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('console', m.type(), m.text().slice(0, 1500)); });
  await page.goto('http://localhost:5248/aurasheet/');
  const out = await page.evaluate(async ({ only, zoom }) => {
    const { startCharacterStage } = await import('/src/render/characterStage.js');
    const { spriteBodyOf } = await import('/src/ui/profileBody.js');
    const { AURA_LOOK } = await import('/src/render/auraRing.js');
    const body = await spriteBodyOf({ onFoot: 0, wornArmour: false });
    const keys = Object.keys(AURA_LOOK).filter((k) => !only.length || only.includes(k));
    const W = Math.round(240 * zoom), H = Math.round(320 * zoom);
    const shots = [];
    for (const key of keys) {
      for (const pitch of [0.2, 0.75]) {
        for (const at of [7.3, 11.9]) {
          const c = document.createElement('canvas');
          c.style.cssText = `width:${W}px;height:${H}px;display:block`;
          document.body.append(c);
          let T = 0;
          const stage = startCharacterStage(c, { body, aura: key, now: () => T, pitch });
          await new Promise((r) => requestAnimationFrame(() => r(0)));
          T = at;
          stage.step();
          shots.push({ key, pitch, at, url: c.toDataURL('image/png') });
          stage.stop();
          c.remove();
        }
      }
    }
    return { shots, W, H };
  }, { only: (process.env.ONLY ?? '').split('|').filter(Boolean), zoom });
  // the sheet: a row a look, its four frames across, its name under them
  const { PNG } = await import('pngjs');
  const imgs = out.shots.map((s) => ({ ...s, png: PNG.sync.read(Buffer.from(s.url.split(',')[1], 'base64')) }));
  const fw = imgs[0].png.width, fh = imgs[0].png.height, per = 4, gap = 6;
  const rows = Math.ceil(imgs.length / per), cols = 2;
  const sheetRows = Math.ceil(rows / cols);
  const sheet = new PNG({ width: cols * (per * (fw + gap) + 24), height: sheetRows * (fh + gap) });
  sheet.data.fill(17);
  imgs.forEach((im, i) => {
    const row = Math.floor(i / per), col = i % per;
    const ox = (row % cols) * (per * (fw + gap) + 24) + col * (fw + gap), oy = Math.floor(row / cols) * (fh + gap);
    for (let y = 0; y < fh; y++) im.png.data.copy(sheet.data, ((oy + y) * sheet.width + ox) * 4, y * fw * 4, (y + 1) * fw * 4);
  });
  const tag = process.env.ONLY ? '_some' : '';
  writeFileSync(`${OUT}/aura_sheet${tag}.png`, PNG.sync.write(sheet));
  console.log(`${out.shots.length / per} looks, ${per} frames each (two angles, two moments) - ${OUT}/aura_sheet${tag}.png; rows in order: ${[...new Set(out.shots.map((s) => s.key))].join(', ')}`);
} finally {
  await browser.close();
  await server.close();
}
