// ARMORY placement audit (2026-10-28, the owner: "The arm effects on the sprite aren't positioned correctly";
// bible/04-Characters/Aura-Armory.md section 10) - EVERY ON-FOOT SPRITE'S POSE, ON ITS PICTURE: the standing front frame
// each body is drawn in (the sixteen Eye of the Beholder sets, the class skins, Layered Gearing in both bodies), its
// armory pose (render/armoryPose.js poseFromFigure over its marks) dotted over it where the stage and the world stand
// it - shoulders, elbows and wrists, the hips, knees and feet, the head and the crown. A contact sheet to
// tools/shots/sprite_arms.png (or SHOT_DIR); ONLY=<a|b> the bodies named so, ZOOM=<n> their size, VIEW=<0-7> the idle table's orientation.
//
//     node tools/spriteArmsSheet.mjs
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = process.env.SHOT_DIR ?? 'tools/shots';
mkdirSync(OUT, { recursive: true });
const BLANK = { name: 'arms-sheet-page', configureServer(s) { s.middlewares.use('/armssheet/', (_q, res) => { res.setHeader('content-type', 'text/html'); res.end('<!doctype html><meta charset="utf-8"><body style="margin:0;background:#111"></body>'); }); } };
const server = await createServer({ server: { port: 5245, strictPort: true }, logLevel: 'silent', plugins: [BLANK] });
await server.listen();
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
try {
  const page = await browser.newPage({ viewport: { width: 1800, height: 1200 } });
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto('http://localhost:5245/armssheet/');
  const out = await page.evaluate(async ({ zoom, only, view }) => {
    const { spriteBodyOf } = await import('/src/ui/profileBody.js');
    const { FOOT_SKIN_COUNT, classSkinOf, classSkinLabel } = await import('/src/player/classSkins.js');
    const { newPose, poseFromFigure, spriteMarks, spriteArmsSeen, poseWorld, POSE_AT } = await import('/src/render/armoryPose.js');
    const looks = [];
    for (let i = 0; i < FOOT_SKIN_COUNT; i++) looks.push({ name: classSkinOf(i) ? classSkinLabel(classSkinOf(i)) : `EOTB set ${i}`, look: { onFoot: i, wornArmour: false } });
    looks.push({ name: 'Layered (male, plate)', look: { onFoot: 0, wornArmour: true, gender: 'male', outfit: 'p6p6p6' } });
    looks.push({ name: 'Layered (female, plate)', look: { onFoot: 0, wornArmour: true, gender: 'female', outfit: 'p6p6p6' } });
    looks.push({ name: 'Layered (female, leather)', look: { onFoot: 0, wornArmour: true, gender: 'female', outfit: 'lll' } });
    const cells = [], report = [];
    for (const { name, look } of looks.filter((l) => !only.length || only.some((o) => l.name.includes(o)))) {
      const b = await spriteBodyOf(look, { view }).catch(() => null);
      if (!b) { report.push({ name, missing: true }); continue; }
      const pose = newPose(), marks = spriteMarks(b.colors, b.width, b.height, { arms: spriteArmsSeen(b.view) });
      poseFromFigure({ base: b.base, mpp: b.mpp, beast: false, marks, shift: b.shift }, pose);
      const c = document.createElement('canvas'); c.width = b.width * zoom; c.height = b.height * zoom + 16;
      const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
      const img = new ImageData(b.width, b.height);
      for (let y = 0; y < b.height; y++) for (let x = 0; x < b.width; x++) {   // the colours' rows bottom first, as the card draws them
        const v = b.colors[(b.height - 1 - y) * b.width + x], i = (y * b.width + x) * 4;
        img.data[i] = v & 255; img.data[i + 1] = (v >>> 8) & 255; img.data[i + 2] = (v >>> 16) & 255; img.data[i + 3] = (v >>> 24) & 255;
      }
      const tmp = document.createElement('canvas'); tmp.width = b.width; tmp.height = b.height; tmp.getContext('2d').putImageData(img, 0, 0);
      g.fillStyle = '#2a2a33'; g.fillRect(0, 0, c.width, c.height - 16);
      g.drawImage(tmp, 0, 0, b.width * zoom, b.height * zoom);
      // a pose point on the card, in its picture's pixels: across from the card's middle (the offset), up from its foot (the base)
      const px = (n) => { const p = poseWorld(pose, n, [0, 0, 0], (view * Math.PI) / 4, [0, 0, 0], 0, [1, 0, 0]); return [((p[0] - b.shift) / b.mpp + b.width / 2) * zoom, (b.height - (p[1] - b.base) / b.mpp) * zoom]; };
      const dot = (n, col) => { const [x, y] = px(n); g.fillStyle = col; g.beginPath(); g.arc(x, y, Math.max(2, zoom * 0.9), 0, Math.PI * 2); g.fill(); return [x, y]; };
      const line = (a, z, col) => { const [x0, y0] = px(a), [x1, y1] = px(z); g.strokeStyle = col; g.lineWidth = Math.max(1, zoom * 0.6); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };
      for (const S of ['L', 'R']) { line(`sh${S}`, `el${S}`, '#ff5a2a'); line(`el${S}`, `wa${S}`, '#ffd02a'); line(`hip${S}`, `kn${S}`, '#3ad0ff'); line(`kn${S}`, `ft${S}`, '#3a8cff'); }
      for (const n of ['shL', 'shR', 'elL', 'elR', 'waL', 'waR']) dot(n, '#ff2a2a');
      for (const n of ['hipL', 'hipR', 'knL', 'knR', 'ftL', 'ftR']) dot(n, '#2adfff');
      for (const n of ['head', 'neck', 'chest', 'pelvis']) dot(n, '#7dff5a');
      dot('crown', '#ffffff');
      g.fillStyle = '#ddd'; g.font = '11px monospace'; g.fillText(name.slice(0, Math.floor(c.width / 6.6)), 2, c.height - 4);
      cells.push(c);
      report.push({ name, w: b.width, h: b.height, mpp: +b.mpp.toFixed(4), base: +b.base.toFixed(3), shift: +b.shift.toFixed(3), marks });
    }
    // the sheet: cells in rows, each its own size
    const W = 1780; let x = 0, y = 0, rowH = 0; const at = [];
    for (const c of cells) { if (x + c.width > W) { x = 0; y += rowH + 6; rowH = 0; } at.push([x, y]); x += c.width + 6; rowH = Math.max(rowH, c.height); }
    const sheet = document.createElement('canvas'); sheet.width = W; sheet.height = y + rowH;
    const sg = sheet.getContext('2d'); sg.fillStyle = '#111'; sg.fillRect(0, 0, sheet.width, sheet.height);
    cells.forEach((c, i) => sg.drawImage(c, at[i][0], at[i][1]));
    return { png: sheet.toDataURL('image/png'), report };
  }, { zoom: Number(process.env.ZOOM ?? 2), only: (process.env.ONLY ?? '').split('|').filter(Boolean), view: Number(process.env.VIEW ?? 0) });
  const tag = `${process.env.ONLY ? '_some' : ''}${process.env.VIEW ? `_v${process.env.VIEW}` : ''}`;
  writeFileSync(`${OUT}/sprite_arms${tag}.png`, Buffer.from(out.png.split(',')[1], 'base64'));
  writeFileSync(`${OUT}/sprite_arms${tag}.json`, JSON.stringify(out.report, null, 1));
  console.log(`${out.report.length} bodies, ${out.report.filter((r) => r.missing).length} with no picture - ${OUT}/sprite_arms.png`);
} finally {
  await browser.close();
  await server.close();
}
