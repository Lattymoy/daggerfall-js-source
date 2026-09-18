// MAP-FIELD2 (2026-09-18): THE HELD SPRITE, MEASURED OFF THE PICTURE.
//
// Mac: "the sprite I gave to hold the map isnt positioned correctly and
// is full screen with a black background. Its meant to act like any
// other sprite and be positioned at the bottom of the screen" - and,
// after the first fix, "there's still a gap at the bottom of the arms,
// any way you can author the gap?"
//
// Three numbers in `src/ui/heldMap.js` answer those, and all three are
// MEASUREMENTS of `art/held-map.png` rather than taste:
//
//   MATTE_LUM / MATTE_EDGE   where the painted black ends and the art
//                            begins, so the key takes the matte off
//                            without eating the gauntlets
//   SPRITE_ART_FOOT          how far down the FILE the painting's own
//                            content reaches - the rest is matte, and
//                            anchoring the file rather than the art is
//                            the gap Mac saw the first time
//   extendCuffs's premise    that the forearms do not all end on the
//                            same row - a minority of columns stop well
//                            short, so carrying the sprite further down
//                            only moves the notches, and the missing
//                            pixels have to be authored
//
// The pins cite this probe for those numbers. It needs the real file,
// so it runs the art through a browser rather than through node:
//
//     node tools/heldMapArtProbe.mjs
//
// It fails on: the file not loading; the matte key eating gauntlet or
// paper; SPRITE_ART_FOOT disagreeing with the picture; and every arm
// column already reaching the screen's bottom edge - which would mean
// extendCuffs is inventing pixels for a gap the bite had closed.
import { createServer } from 'vite';
import { chromium } from 'playwright';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`); };

const server = await createServer({ server: { port: 5287, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e.message)));
// /play/, not the root - MAP-FIELD's own lesson, and `landing.test.js`'s
// U60 pin. Nothing here presses a button, but `HELD_MAP_URL` is resolved
// off the module's own root, so the page the module is imported from is
// the page that decides where the art is looked for.
await page.goto('http://127.0.0.1:5287/play/', { waitUntil: 'domcontentloaded' });

const out = await page.evaluate(async () => {
  const { HELD_MAP_URL, SPRITE, PAPER, SPRITE_ART_FOOT, HELD_MAP_HEIGHT, HELD_MAP_BITE, MATTE_LUM, MATTE_EDGE, keyMattePixels } = await import('/src/ui/heldMap.js');
  const img = new Image();
  const loaded = await new Promise((r) => { img.onload = () => r(true); img.onerror = () => r(false); img.src = HELD_MAP_URL; });
  if (!loaded) return { loaded: false };
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0);
  const raw = x.getImageData(0, 0, c.width, c.height).data;
  const at = (px, py) => { const i = ((py * c.width) + px) * 4; return [raw[i], raw[i + 1], raw[i + 2], raw[i + 3]]; };

  // 1. THE MATTE. How much of the file is black, and where the gauntlet
  // pixels actually sit, so the key's threshold can be a measurement.
  let opaque = 0, matte = 0;
  for (let i = 0; i < raw.length; i += 4) {
    if (raw[i + 3] === 255) opaque++;
    if (Math.max(raw[i], raw[i + 1], raw[i + 2]) <= MATTE_LUM) matte++;
  }
  const gaunt = [];
  for (const [bx0, bx1] of [[0.17, 0.33], [0.67, 0.83]])
    for (let px = Math.round(c.width * bx0); px < c.width * bx1; px += 2)
      for (let py = Math.round(c.height * 0.50); py < c.height * 0.98; py += 2) {
        const p = at(px, py), l = Math.max(p[0], p[1], p[2]);
        if (l > MATTE_LUM) gaunt.push(l);
      }
  gaunt.sort((a, b) => a - b);

  // 2. THE ART'S FOOT, read off the keyed image: the lowest row of the
  // file with any content left in it once the matte has gone.
  const keyed = x.getImageData(0, 0, c.width, c.height);
  keyMattePixels(keyed.data);
  const k = keyed.data;
  const on = (px, py) => k[((py * c.width) + px) * 4 + 3] > 8;
  let lastRow = 0;
  for (let y = 0; y < c.height; y++) { let n = 0; for (let px = 0; px < c.width; px++) if (on(px, y)) n++; if (n / c.width > 0.002) lastRow = y; }

  // 3. THE CUFFS, column by column - and specifically the population
  // `extendCuffs` works on: the columns OUTSIDE the paper's rectangle,
  // which is where the two forearms show past the parchment's sides.
  const low = [];
  for (let px = 0; px < c.width; px++) { let last = -1; for (let y = c.height - 1; y >= 0; y--) if (on(px, y)) { last = y; break; } low.push(last / c.height); }
  const cx0 = Math.floor(PAPER.x0 * c.width), cx1 = Math.ceil(PAPER.x1 * c.width);
  const outside = [], paperCols = [];
  for (let px = 0; px < c.width; px++) (px >= cx0 && px < cx1 ? paperCols : outside).push(low[px]);
  outside.sort((a, b) => a - b);
  // ...and where each of those columns ENDS on a screen, which is the
  // question that matters: the bite already carries the sprite past the
  // bottom edge, so only the columns that still fall short are a gap.
  const vh = 900, sh = vh * HELD_MAP_HEIGHT / SPRITE_ART_FOOT, sy = vh - (SPRITE_ART_FOOT - HELD_MAP_BITE) * sh;
  const short = outside.map((f) => vh - (sy + f * sh)).filter((d) => d > 0.5).sort((a, b) => b - a);

  return {
    loaded: true, size: [c.width, c.height], spriteConst: SPRITE,
    opaqueFrac: +(opaque / (raw.length / 4)).toFixed(4),
    matteFrac: +(matte / (raw.length / 4)).toFixed(4),
    gauntletN: gaunt.length,
    gauntletMedian: gaunt[Math.floor(gaunt.length * 0.5)],
    gauntletInRamp: gaunt.filter((v) => v < MATTE_EDGE).length,
    lastInkedRowFrac: +(lastRow / c.height).toFixed(4),
    artFootConst: SPRITE_ART_FOOT,
    outsideCols: outside.length,
    outsideLowMin: +outside[0].toFixed(4), outsideLowMedian: +outside[Math.floor(outside.length / 2)].toFixed(4), outsideLowMax: +outside[outside.length - 1].toFixed(4),
    colsShortOfBottom: short.length, worstShortfallPx: +(short[0] ?? 0).toFixed(1), screenHeight: vh,
    paperLowMax: +Math.max(...paperCols).toFixed(4),
  };
});

check('the art loads at all', out.loaded === true && pageErrors.length === 0, pageErrors.join(' | '));
if (!out.loaded) { await browser.close(); await server.close(); process.exit(1); }
console.log(`  ${out.size[0]}x${out.size[1]}  matte ${(out.matteFrac * 100).toFixed(1)}%  opaque ${(out.opaqueFrac * 100).toFixed(1)}%  art foot ${out.lastInkedRowFrac}`);
console.log(`  outside the paper: ${out.outsideCols} columns ending ${out.outsideLowMin}..${out.outsideLowMax} (median ${out.outsideLowMedian}); ${out.colsShortOfBottom} of them still stop short of a ${out.screenHeight}px screen, by up to ${out.worstShortfallPx}px`);

check('SPRITE matches the file the port actually ships', out.size[0] === out.spriteConst.w && out.size[1] === out.spriteConst.h, `${out.size} vs ${out.spriteConst.w}x${out.spriteConst.h}`);
// THE MATTE IS PAINTED, NOT ALPHA. This is why there is a key at all: a
// transparent PNG would have needed none of it.
check('the file is OPAQUE and its background is painted black - which is why a key is needed', out.opaqueFrac > 0.99 && out.matteFrac > 0.30, `opaque ${out.opaqueFrac}, matte ${out.matteFrac}`);
check('MATTE_EDGE clears the gauntlets - the key takes the background, not the arms', out.gauntletInRamp / out.gauntletN < 0.01, `${out.gauntletInRamp} of ${out.gauntletN} gauntlet pixels under the ramp, median ${out.gauntletMedian}`);
// THE FIRST GAP. Anchor the FILE's foot and this much of the screen is
// blank under the arms.
check('SPRITE_ART_FOOT is the PAINTING\'s foot, measured', Math.abs(out.artFootConst - out.lastInkedRowFrac) < 0.01, `const ${out.artFootConst} against measured ${out.lastInkedRowFrac}`);
check('...and it is well short of the file\'s own foot, which is the gap anchoring the file would leave', out.artFootConst < 0.9, `${((1 - out.artFootConst) * 100).toFixed(1)}% of the file below the art`);
// THE SECOND GAP, and the whole reason for extendCuffs. MOST of the
// forearm columns do reach the art's foot, and the bite carries those
// off the bottom of the screen on its own - which is why the first fix
// looked right and Mac still saw a gap. The ones that DON'T are the
// outer edges of the cuffs, and they leave notches bitten out of the
// silhouette that no amount of further crop can close: pushing the
// sprite down far enough to bury them would take the paper with it.
check('a MINORITY of the arm columns stop short of the bottom edge - the notches Mac saw, which no crop closes', out.colsShortOfBottom > 0 && out.colsShortOfBottom < out.outsideCols / 2, `${out.colsShortOfBottom} of ${out.outsideCols} columns, worst ${out.worstShortfallPx}px on a ${out.screenHeight}px screen`);
check('...and the worst of them is a notch worth seeing, not a rounding error', out.worstShortfallPx > 8, `${out.worstShortfallPx}px`);
check('the paper\'s own foot is ABOVE the arms\', so extendCuffs\' skipped span cannot smear the parchment', out.paperLowMax < out.outsideLowMax, `paper ${out.paperLowMax}, arms to ${out.outsideLowMax}`);

await browser.close();
await server.close();
const failed = results.filter((x) => !x.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
