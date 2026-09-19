// MAP-FIELD2/3/4: THE HELD SPRITE, MEASURED OFF THE PICTURE.
//
// Mac: "the sprite I gave to hold the map isnt positioned correctly and
// is full screen with a black background"; then "there's still a gap at
// the bottom of the arms, any way you can author the gap?"; then "the
// ingame map on the map appears going off the edge"; then, with a third
// painting, "Try this instead".
//
// Every constant in `src/ui/heldMap.js` that this probe cites is a
// MEASUREMENT of `art/held-map.png` rather than taste:
//
//   SPRITE            the file's own pixels
//   SPRITE_ART_FOOT   how far down the FILE the painting reaches - the
//                     rest is empty, and anchoring the file rather than
//                     the art is the gap Mac saw at MAP-FIELD2
//   extendCuffs       that the forearms stop short of the file's foot,
//                     so the missing pixels have to be authored; and
//                     that they run on BELOW the sheet, which is how a
//                     column is told from the parchment's torn edge
//   PAPER             the largest upright rectangle lying WHOLLY on the
//                     sheet. Larger, and the ink prints over the torn
//                     edge and out onto the sky - the bug Mac named,
//                     which predated this painting
//   HAND_CHROMA       that red-minus-blue parts steel from parchment on
//                     this art, and that brightness does not
//
// MAP-FIELD4 retired two pins this file used to carry, because the art
// they described is gone: the painting now has a real ALPHA CHANNEL, so
// there is no black matte to key and no MATTE_LUM/MATTE_EDGE to check.
// The pin that the file is opaque is replaced by its opposite.
//
// It needs the real file, so it runs the art through a browser:
//
//     node tools/heldMapArtProbe.mjs
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
  const { HELD_MAP_URL, SPRITE, PAPER, THUMB_ZONES, HAND_CHROMA, SPRITE_ART_FOOT, CUFF_BAND,
    HELD_MAP_HEIGHT, HELD_MAP_BITE, extendCuffs, keyThumbPixels } = await import('/src/ui/heldMap.js');
  const img = new Image();
  const loaded = await new Promise((r) => { img.onload = () => r(true); img.onerror = () => r(false); img.src = HELD_MAP_URL; });
  if (!loaded) return { loaded: false };
  const W = img.naturalWidth, H = img.naturalHeight;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0);
  const raw = x.getImageData(0, 0, W, H).data;
  const A = (px, py) => raw[(((py * W) + px) * 4) + 3];
  const RB = (px, py) => { const i = ((py * W) + px) * 4; return raw[i] - raw[i + 2]; };
  const LUM = (px, py) => { const i = ((py * W) + px) * 4; return (0.299 * raw[i]) + (0.587 * raw[i + 1]) + (0.114 * raw[i + 2]); };

  // 1. THE ALPHA. MAP-FIELD4's premise: the painting states its own
  // silhouette, so nothing here has to guess it from brightness.
  let clear = 0, solid = 0;
  for (let i = 3; i < raw.length; i += 4) { if (raw[i] === 0) clear++; else if (raw[i] > 200) solid++; }

  // 2. THE ART'S FOOT, off the alpha: the lowest row with content.
  let lastRow = 0;
  for (let y = 0; y < H; y++) { let n = 0; for (let px = 0; px < W; px++) if (A(px, y) > 8) n++; if (n / W > 0.002) lastRow = y; }

  // 3. THE SHEET. Its sides are read off the rows ABOVE the thumbs,
  // where the sheet is the only opaque thing on the row; its top and
  // bottom down the middle columns, for the same reason.
  const rowL = new Int32Array(H).fill(-1), rowR = new Int32Array(H).fill(-1);
  const colT = new Int32Array(W).fill(-1), colB = new Int32Array(W).fill(-1);
  // 128 - MORE THAN HALF OPAQUE - is the same line extendCuffs draws,
  // and the two must agree or this file measures a different picture
  // from the one the module works on.
  for (let y = 0; y < H; y++) { for (let px = 0; px < W; px++) if (A(px, y) > 128) { rowL[y] = px; break; }
    for (let px = W - 1; px >= 0; px--) if (A(px, y) > 128) { rowR[y] = px; break; } }
  for (let px = 0; px < W; px++) { for (let y = 0; y < H; y++) if (A(px, y) > 128) { colT[px] = y; break; }
    for (let y = H - 1; y >= 0; y--) if (A(px, y) > 128) { colB[px] = y; break; } }
  const thumbTop = Math.round(Math.min(...THUMB_ZONES.map((z) => z.y0)) * H);
  let sheetL = 0, sheetR = W - 1, sheetT = 0, sheetB = H - 1;
  for (let y = Math.max(0, colT[Math.round(W / 2)]) + 4; y < thumbTop; y++) {
    if (rowL[y] > sheetL) sheetL = rowL[y]; if (rowR[y] >= 0 && rowR[y] < sheetR) sheetR = rowR[y]; }
  for (let px = Math.round(W * 0.29); px <= Math.round(W * 0.69); px++) {
    if (colT[px] > sheetT) sheetT = colT[px]; if (colB[px] >= 0 && colB[px] < sheetB) sheetB = colB[px]; }
  // ...and how far PAPER overhangs it, which must be nowhere
  const px0 = Math.round(PAPER.x0 * W), px1 = Math.round(PAPER.x1 * W);
  const py0 = Math.round(PAPER.y0 * H), py1 = Math.round(PAPER.y1 * H);
  let overhang = 0;
  for (let y = py0; y <= py1; y++) for (const px of [px0, px1]) if (A(px, y) <= 128) overhang++;
  for (let px = px0; px <= px1; px++) for (const y of [py0, py1]) if (A(px, y) <= 128) overhang++;

  // 4. THE COLOUR LINE. Every sheet pixel against every glove pixel:
  // the claim is that HAND_CHROMA separates them with no false call on
  // the sheet at all, border included, and that no BRIGHTNESS does.
  const box = (bx0, bx1, by0, by1, f) => { for (let y = by0; y < by1; y++) for (let bx = bx0; bx < bx1; bx++) if (A(bx, y) > 128) f(bx, y); };
  let gN = 0, gUnder = 0, gLumMax = 0;
  for (const [a, b, d2, e] of [[Math.round(W * 0.207), Math.round(W * 0.262), 520, 620],
    [Math.round(W * 0.753), Math.round(W * 0.808), 520, 620]])
    box(a, b, d2, e, (bx, by) => { gN++; if (RB(bx, by) < HAND_CHROMA) gUnder++; const l = LUM(bx, by); if (l > gLumMax) gLumMax = l; });
  let sN = 0, sUnder = 0, sLumMin = 255;
  // the sheet: its burnt border all round, and its middle
  for (const [a, b, d2, e] of [[sheetL + 1, sheetL + 49, sheetT + 30, thumbTop - 20],
    [sheetR - 48, sheetR, sheetT + 30, thumbTop - 20],
    [Math.round(W * 0.28), Math.round(W * 0.69), sheetT + 4, sheetT + 39],
    [Math.round(W * 0.28), Math.round(W * 0.69), sheetB - 30, sheetB],
    [Math.round(W * 0.28), Math.round(W * 0.72), sheetT + 50, sheetB - 60]])
    box(a, b, d2, e, (bx, by) => { sN++; if (RB(bx, by) < HAND_CHROMA) sUnder++; const l = LUM(bx, by); if (l < sLumMin) sLumMin = l; });

  // 5. THE KEY ITSELF, run on the real art: what each thumb zone keeps.
  const zones = THUMB_ZONES.map((z) => {
    const zx = Math.floor(z.x0 * W), zy = Math.floor(z.y0 * H);
    const zw = Math.ceil((z.x1 - z.x0) * W), zh = Math.ceil((z.y1 - z.y0) * H);
    const d2 = x.getImageData(zx, zy, zw, zh);
    keyThumbPixels(d2.data, zw, zh, z.side);
    let kept = 0, keptOnPaper = 0, onPaper = 0, warmKept = 0;
    for (let yy = 0; yy < zh; yy++) for (let xx = 0; xx < zw; xx++) {
      const i = ((yy * zw) + xx) * 4;
      const inPaper = zx + xx >= px0 && zx + xx <= px1 && zy + yy >= py0 && zy + yy <= py1;
      if (inPaper) onPaper++;
      if (d2.data[i + 3] > 128) { kept++; if (inPaper) { keptOnPaper++; if (RB(zx + xx, zy + yy) >= HAND_CHROMA + 20) warmKept++; } }
    }
    return { side: z.side, kept, keptOnPaper, onPaper, warmKept,
      keptFrac: +(keptOnPaper / onPaper).toFixed(4), warmFrac: +(warmKept / Math.max(1, keptOnPaper)).toFixed(4) };
  });

  // 6. THE CUFFS. extendCuffs carries a column the FRAME CUT, and the
  // band it tests is only safe because the file separates: the columns
  // under the sheet all end high, the cut cuffs all end low, and
  // nothing ends in between. Measure that gap, it is the whole premise.
  const band = CUFF_BAND * H;
  const armCols = [], sheetCols = [], between = [];
  let underSheetLowest = 0, cuffHighest = H;
  for (let px = 0; px < W; px++) { const last = colB[px]; if (last < 0) continue;
    const underSheet = px >= sheetL && px <= sheetR;
    if (underSheet) { sheetCols.push(last / H); if (last > underSheetLowest) underSheetLowest = last; }
    if (last >= band) { armCols.push(last / H); if (last < cuffHighest) cuffHighest = last; }
    else if (!underSheet && last / H > 0.75) between.push(last / H); }
  armCols.sort((a, b) => a - b);
  const vh = 900, sh = vh * HELD_MAP_HEIGHT / SPRITE_ART_FOOT, sy = vh - ((SPRITE_ART_FOOT - HELD_MAP_BITE) * sh);
  const short = armCols.map((f) => vh - (sy + (f * sh))).filter((v) => v > 0.5).sort((a, b) => b - a);
  // ...and that the fix reaches them: after extendCuffs none stops short
  const ext = x.getImageData(0, 0, W, H);
  extendCuffs(ext.data, W, H);
  let armColsLeftShort = 0;
  for (let px = 0; px < W; px++) { if (colB[px] < band) continue;
    if (ext.data[((((H - 1) * W) + px) * 4) + 3] <= 8) armColsLeftShort++; }
  // the parchment must NOT have been smeared, nor the hand's own
  // silhouette: only a cut column may be carried down
  let sheetColsTouched = 0, silhouetteTouched = 0;
  for (let px = 0; px < W; px++) { const last = colB[px]; if (last < 0 || last >= band) continue;
    if (ext.data[((((H - 1) * W) + px) * 4) + 3] <= 8) continue;
    if (px >= sheetL && px <= sheetR) sheetColsTouched++; else silhouetteTouched++; }

  return { loaded: true, size: [W, H], spriteConst: SPRITE,
    clearFrac: +(clear / (raw.length / 4)).toFixed(4), solidFrac: +(solid / (raw.length / 4)).toFixed(4),
    artFootConst: SPRITE_ART_FOOT, lastInkedRowFrac: +((lastRow + 1) / H).toFixed(4),
    sheet: [sheetL, sheetT, sheetR, sheetB],
    sheetFrac: [+(sheetL / W).toFixed(4), +(sheetT / H).toFixed(4), +((sheetR + 1) / W).toFixed(4), +((sheetB + 1) / H).toFixed(4)],
    paperConst: [PAPER.x0, PAPER.y0, PAPER.x1, PAPER.y1], overhang,
    chromaConst: HAND_CHROMA, gN, gUnderFrac: +(gUnder / gN).toFixed(4), gLumMax: Math.round(gLumMax),
    sN, sUnder, sUnderFrac: +(sUnder / sN).toFixed(6), sLumMin: Math.round(sLumMin),
    zones,
    armCols: armCols.length, sheetCols: sheetCols.length, between: between.length,
    bandConst: CUFF_BAND, underSheetLowest: +(underSheetLowest / H).toFixed(4), cuffHighest: +(cuffHighest / H).toFixed(4),
    armLowMin: +armCols[0].toFixed(4), armLowMax: +armCols[armCols.length - 1].toFixed(4),
    colsShortOfBottom: short.length, worstShortfallPx: +(short[0] ?? 0).toFixed(1), screenHeight: vh,
    cuffClearancePx: +Math.min(...armCols.map((f) => (sy + (f * sh)) - vh)).toFixed(1),
    armColsLeftShort, sheetColsTouched, silhouetteTouched };
});

check('the art loads at all', out.loaded === true && pageErrors.length === 0, pageErrors.join(' | '));
if (!out.loaded) { await browser.close(); await server.close(); process.exit(1); }
console.log(`  ${out.size[0]}x${out.size[1]}  clear ${(out.clearFrac * 100).toFixed(1)}%  art foot ${out.lastInkedRowFrac}`);
console.log(`  sheet ${JSON.stringify(out.sheetFrac)}  PAPER ${JSON.stringify(out.paperConst)}  overhang ${out.overhang}px`);
console.log(`  r-b < ${out.chromaConst}: ${(out.gUnderFrac * 100).toFixed(1)}% of ${out.gN} glove px, ${out.sUnder} of ${out.sN} sheet px`);
console.log(`  cut cuffs: ${out.armCols} columns ending ${out.armLowMin}..${out.armLowMax}; ${out.colsShortOfBottom} stop short of a ${out.screenHeight}px screen, by up to ${out.worstShortfallPx}px`);
console.log(`  sheet columns end by ${out.underSheetLowest}, cut cuffs from ${out.cuffHighest}, CUFF_BAND ${out.bandConst}`);
out.zones.forEach((z) => console.log(`  thumb ${z.side}: keeps ${(z.keptFrac * 100).toFixed(1)}% of its box inside PAPER, ${(z.warmFrac * 100).toFixed(1)}% of that warm`));

check('SPRITE matches the file the port actually ships', out.size[0] === out.spriteConst.w && out.size[1] === out.spriteConst.h, `${out.size} vs ${out.spriteConst.w}x${out.spriteConst.h}`);
// MAP-FIELD4 INVERTED THE OLD PIN. The first painting was opaque with a
// painted black matte, and this file used to pin exactly that, because
// it is why a key existed. This painting carries alpha, so the key is
// gone - and the pin that would have caught its return is this one.
check('the file carries a REAL ALPHA CHANNEL, which is why there is no matte key any more', out.clearFrac > 0.3 && out.solidFrac > 0.3, `clear ${out.clearFrac}, solid ${out.solidFrac}`);
check('SPRITE_ART_FOOT is the PAINTING\'s foot, measured', Math.abs(out.artFootConst - out.lastInkedRowFrac) < 0.01, `const ${out.artFootConst} against measured ${out.lastInkedRowFrac}`);
check('...and it is short of the file\'s own foot, which is the gap anchoring the file would leave', out.artFootConst < 0.95, `${((1 - out.artFootConst) * 100).toFixed(1)}% of the file below the art`);

// MAP-FIELD3, THE BUG MAC NAMED. The ink canvas is laid EXACTLY on
// PAPER, so a single pixel of its border off the sheet is ink on the
// sky. This is the pin that would have caught it on the original art.
check('PAPER lies WHOLLY on the sheet - no edge of the ink hangs over the torn border', out.overhang === 0, `${out.overhang} border pixels off the sheet`);
check('...and it is not needlessly small - it spans most of the sheet it sits in',
  (out.paperConst[2] - out.paperConst[0]) > (out.sheetFrac[2] - out.sheetFrac[0]) * 0.9
  && (out.paperConst[3] - out.paperConst[1]) > (out.sheetFrac[3] - out.sheetFrac[1]) * 0.85,
  `paper ${(out.paperConst[2] - out.paperConst[0]).toFixed(3)}x${(out.paperConst[3] - out.paperConst[1]).toFixed(3)} in sheet ${(out.sheetFrac[2] - out.sheetFrac[0]).toFixed(3)}x${(out.sheetFrac[3] - out.sheetFrac[1]).toFixed(3)}`);

// MAP-FIELD4's MEASUREMENT, and the reason the key is a colour and not
// a brightness. Both halves matter: the line must catch the glove, and
// it must not touch the sheet ANYWHERE - the burnt border included.
check('HAND_CHROMA calls a third of the THUMB steel - enough to seed a blob through', out.gUnderFrac > 0.25, `${(out.gUnderFrac * 100).toFixed(1)}% of ${out.gN} thumb pixels`);
// The sheet's side of the line is what matters most, and it is not
// quite zero: a handful of pixels in 340,000 fall under it. They are
// specks in the parchment's cracks, and keyThumbPixels drops them
// because a speck is an island the flood cannot reach - which is why
// the pin that they are RARE is the honest one, not a pin that they do
// not exist. An earlier draft of this comment claimed zero, on a
// narrower sample that happened to miss them.
check('...and almost none of the sheet, its burnt border included', out.sUnderFrac < 0.0005, `${out.sUnder} of ${out.sN} sheet pixels under the line`);
check('...where a BRIGHTNESS cut could not: the glove out-shines the sheet\'s own border', out.gLumMax > out.sLumMin, `glove reaches luma ${out.gLumMax}, the sheet falls to ${out.sLumMin}`);

// THE KEY, RUN ON THE REAL ART. A thumb covers part of its box and no
// more: keep too little and the map shows through the glove, keep too
// much - which every brightness key did - and slabs of parchment land
// on top of the map.
for (const z of out.zones) {
  check(`the ${z.side} thumb covers a THUMB'S worth of its box on the paper`, z.keptFrac > 0.05 && z.keptFrac < 0.55, `${(z.keptFrac * 100).toFixed(1)}%`);
  check(`...and what it keeps there is steel, not parchment`, z.warmFrac < 0.12, `${(z.warmFrac * 100).toFixed(1)}% of it as warm as the sheet`);
}

// THE GAP MAC SAW AT MAP-FIELD2, which is what all of this is for: no
// arm may end in mid-air above the screen's edge. On the first painting
// a minority of columns did, and extendCuffs was the only thing that
// could close them. On this one the cut cuffs are nearly level and
// HELD_MAP_BITE carries every one of them past the edge on its own - by
// half a pixel at the bite MAP-FIELD2 set, and comfortably at the lower
// one MAP-FIELD5 asked for. So the pin is the LAW (no column short),
// not the margin, which is a number Mac moves whenever the sheet should
// sit higher or lower. extendCuffs is what keeps the law true when he
// does: raise the bite far enough and the margin goes back to nothing.
check('no cut cuff is left short of the screen\'s bottom edge - the gap Mac saw', out.worstShortfallPx <= 0, `${out.colsShortOfBottom} of ${out.armCols} cut columns short; the highest clears by ${out.cuffClearancePx.toFixed(1)}px on a ${out.screenHeight}px screen`);
check('extendCuffs closes ALL of them - no cut column is left ending in mid-air', out.armColsLeftShort === 0, `${out.armColsLeftShort} still short`);
// MAP-FIELD4: the test is where the column ENDS, not where it sits. The
// right forearm crosses UNDER the sheet in this painting, so the old
// x-range test would have left a notch bitten out of it.
check('...and it smears no parchment: the sheet\'s own columns are untouched', out.sheetColsTouched === 0, `${out.sheetColsTouched} sheet columns streaked to the foot`);
check('...nor the hand\'s own silhouette, which is DRAWN to end where it ends', out.silhouetteTouched === 0, `${out.silhouetteTouched} silhouette columns streaked to the foot`);
// THE PREMISE OF THE BAND, and the reason the other two tests failed.
check('CUFF_BAND falls in a gap the painting really leaves - nothing ends between the sheet and the cut cuffs',
  out.underSheetLowest < out.bandConst && out.cuffHighest > out.bandConst,
  `sheet columns end by ${out.underSheetLowest}, cut cuffs from ${out.cuffHighest}, band at ${out.bandConst}`);

await browser.close();
await server.close();
const failed = results.filter((x) => !x.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
