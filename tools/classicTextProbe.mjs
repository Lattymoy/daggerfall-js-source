// L10N2 (2026-09-27): THE CLASSIC TEXT PATH, IN A REAL BROWSER, IN EVERY SCRIPT THE PORT OFFERS.
//
// test/l10n2.test.js runs the face over a fake canvas; what only a browser can show is the real one: the system's
// fonts rasterised through OffscreenCanvas, the pages uploaded to a real WebGL renderer, and ui/text.js's drawText
// putting ink where each line should be. It needs no ARENA2: the classic font here is a stand-in FNT with blank
// glyphs, so English (which keeps Daggerfall's own glyphs) draws nothing, and every other language draws only through
// its face - lit pixels are the face's, and nothing else's.
//
// Run against a dev server:
//     npx vite --port 5199 &
//     node tools/classicTextProbe.mjs            (PROBE_SHOTS=dir to keep the picture)
import { chromium } from 'playwright';

const BASE = process.env.PROBE_BASE ?? 'http://127.0.0.1:5199';
const shots = process.env.PROBE_SHOTS ?? null;

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
};

const LINES = [
  ['en', 'New Game'],
  ['fr', 'Nouvelle partie - à bientôt, chevalier'],
  ['de', 'Größe, Übung, Straße'],
  ['pl', 'Zażółć gęślą jaźń'],
  ['vi', 'Tiếng Việt có dấu'],
  ['ru', 'Новая игра - Даггерфолл'],
  ['el', 'Νέο παιχνίδι'],
  ['ja', 'はじめから・ダガーフォール'],
  ['zh-Hans', '新游戏 丹格尔佛'],
  ['zh-Hant', '新遊戲 丹格爾佛'],
  ['ko', '새 게임 대거폴'],
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1000, height: 760 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${BASE}/play/?nointro`, { waitUntil: 'networkidle' });
await page.waitForSelector('.px-menu button', { timeout: 20000 });

const out = await page.evaluate(async (lines) => {
  const { Renderer } = await import('/src/render/renderer.js');
  const text = await import('/src/ui/text.js');
  const tm = await import('/src/systems/textManager.js');
  const faces = await import('/src/ui/localeFaces.js');
  const canvas = document.createElement('canvas');
  canvas.width = 960; canvas.height = 720;
  canvas.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;background:#000';
  document.body.append(canvas);
  const renderer = new Renderer(canvas);
  const gl = renderer.gl;
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
  // a stand-in FONT0003: blank glyphs, Daggerfall's metrics
  const fnt = { fixedHeight: 9, fixedWidth: 6, glyphWidth: () => 5, getGlyphPixels: () => new Uint8Array(256) };
  const font = text.makeFont(renderer, fnt, 'FONT0003');
  const was = tm.currentLocale();
  const res = [];
  lines.forEach(([code, line], i) => {
    faces.installLocaleFaces(code);
    tm.setLocale(code);
    const y = 16 + i * 60;
    const face = text.sdfOf(fnt);
    const w = text.measureText(fnt, line);
    const drawn = text.drawText(renderer, font, line, 16, y, 4, [1, 0.9, 0.7, 1]);
    const px = new Uint8Array(canvas.width * 44 * 4);
    gl.readPixels(0, canvas.height - (y + 44), canvas.width, 44, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let lit = 0, right = 0;
    for (let p = 0; p < px.length; p += 4) if (px[p] > 60) { lit++; right = Math.max(right, (p / 4) % canvas.width); }
    res.push({ code, line, face: face ? face.family : null, glyphs: face ? face.glyphs.size : 0, pages: face ? face.pages.length : 0, width: w, drawn, lit, right });
  });
  tm.setLocale(was);
  const shot = canvas.toDataURL('image/png');
  canvas.remove();
  return { res, shot, fontName: fnt.fontName };
}, LINES);

check('makeFont names the font as DFU does', out.fontName === 'FONT0003');
for (const r of out.res) {
  if (r.code === 'en') {
    check('en: no face - Daggerfall\'s own glyphs (blank in the stand-in), nothing drawn from a face', r.face === null && r.lit === 0, `lit ${r.lit}`);
    continue;
  }
  const chars = [...r.line].filter((c) => c !== ' ').length;
  check(`${r.code}: a face over its script's fonts`, !!r.face, r.face ?? 'none');
  check(`${r.code}: every character a glyph, grown on demand`, r.glyphs >= new Set([...r.line]).size, `${r.glyphs} glyphs, ${r.pages} page(s)`);
  check(`${r.code}: ink drawn where the line is`, r.lit > chars * 20, `${r.lit} lit px for ${chars} characters`);
  check(`${r.code}: the ink ends where the measured advance does`, Math.abs(16 + r.drawn - r.right) <= 24 && Math.abs(r.drawn - r.width * 4) < 0.5, `drawn ${r.drawn.toFixed(1)}, measured x4 ${(r.width * 4).toFixed(1)}, last ink at ${r.right}`);
}
const ja = out.res.find((r) => r.code === 'ja'), fr = out.res.find((r) => r.code === 'fr');
check('Han by region: Japanese and Chinese name different fonts first', ja.face !== out.res.find((r) => r.code === 'zh-Hans').face);
check('a full-width character advances about one GlyphHeight, a Latin letter about half', ja.width / [...ja.line].length > 7 && fr.width / [...fr.line].length < 6, `ja ${(ja.width / [...ja.line].length).toFixed(2)}, fr ${(fr.width / [...fr.line].length).toFixed(2)} per character`);
check('no page errors', errors.length === 0, errors.join(' | '));
if (shots) {
  const { writeFileSync } = await import('node:fs');
  writeFileSync(`${shots}/classic-text.png`, Buffer.from(out.shot.split(',')[1], 'base64'));
  console.log(`shot: ${shots}/classic-text.png`);
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
