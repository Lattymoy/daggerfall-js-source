// GRIM1 (2026-10-09, Discord "This usually happens when someho", CLEM: "Grimoir UI is almost amazing ... Sadly GrimUI
// doesn't allow me pick up tents ... No Hotbar ... I want some of the features of enhanced+ just not the overall look of
// it"; Skibbster: "More support for grimoire and classic UI in general"; Dudey: "Keep the style and soul of Grimoir UI
// and make it offer everything enhanced plus has") - THE DFO GRIMOIRE DRESS'S PICTURES.
//
// GRIM3 (2026-10-10, Dudey: "the scroll bar looks cheap the tab bar looks cheap ... the background in the main menue
// looks blurry same for the board where to book looks in ... it needs to stay pixelated and keep the soul of grimoire
// ui but it needs to be EXTREMELY HIGH QUALITY") - ONE PIXEL GRID. Every picture the dress paints with is brought back
// to Daggerfall's own grid (the pack draws at 3x the game's 320 x 200: three of its pixels are one of the game's), lightly
// sharpened there so a soft painting reads as pixel art rather than as a smear, and drawn at ONE whole-number scale for
// the whole screen (`--gp`, the CSS size of one of the game's pixels; `--gq` its half, for the small presses). Nothing is
// ever drawn at 1.4 of a pixel beside 1.5 of another: every surface's pixels are the same squares. Where a picture
// repeats, its seam is crossed by an ordered dither (each pixel is the picture's or its shifted twin's, never a blend of
// the two), so a repeat is as hard-edged as the picture itself.
//
// DFO Grimoire is the enhanced skin (every Plus window and feature: the hotbar, the camps and their tents, the rest, the
// sounds) dressed in GrimoireUI's own parchment, wood and red - and those materials are the PACK'S, cut at run time out
// of the very pictures it shipped (public/art/grimoire-ui/, vendor/grimoire-ui/). Nothing new is committed: no raster
// of ours, no re-saved crop - a crop table here, a canvas in the browser, and data URLs on the page's root as custom
// properties the dress (ui/grimoireDress.js) paints with. Until the pictures land (or where a canvas is refused) the
// dress stands in the same tones as flat colour.
//
// THE CROPS name their source picture and its pixel box in the pack's 3x pixels (960 x 600 for a whole screen), every
// box on the 3-pixel grid so each of the game's pixels is cut whole:
//   page      the cream page the talk window writes on (TALK01I0's right-hand page, inside its torn edge)
//   scroll    the tan scroll of the logbook (LGBK00I0, inside its rods and torn sides)
//   wood      the dark planked desk the spellmaker stands on (INFO01I0's clean top left)
//   tear      the same talk page WITH its torn edge, cut off its board by its own brightness - laid on the wood it
//             becomes the window frame: a torn page pinned on a board
//   stone     the grey marble the inventory stands the paper doll on (INVE00I0's middle)
//   book      the open book on the Biography desk (BIOG00I0), its thin leather edge with it - cut down its spine into the
//             two pages every book-shaped window is drawn as (bookL, bookR), each a 9-slice of the PAINTING: its
//             corners as painted, its page edges and the gutter's curve into the spine drawn at the grid, so the
//             book keeps the pack's own depth however big the window is
//   desk      the whole Biography desk, the front door's ground
//   exit      the inventory's red Exit press, its frame read as a 9-slice round the word (its own EXIT left out)
//   plate     the inventory's own tab plate ("WEAPONS & ARMOR"), its lettering lifted off it - every tab is one. The pack
//             drew it at its own 3x (one-pixel outlines), so it is kept at the pack's pixels and drawn at --gk
//   spbk      GrimoireUI's own spellbook (SPBK00I0), whole - for the card's "GrimoireUI's own" spellbook: its title, its
//             spine's arrows, its right page's three boxes and ruled bands and its red EXIT kept, its painted foot words
//             wiped with its own paper (SPBK_WIPES), so the book's real presses are written there
//   rule      the spellbook's ruled line - a hand-drawn ink stroke with its dotted ends - under every heading on a page
//   compBox / compass  the HUD's compass - its gilded dome in its box, and its strip of N, E, S, W - on the game's grid,
//             so it stands at Daggerfall's own size
//   cubby     one of the inventory's wooden shelf boxes (INVE00I0) - the socket an item or a hotbar slot sits in
//   sideScroll the small scroll the pack's choice windows are written on (REPR01I0), its rods down the sides - its own
//             words wiped off it with the list picker's clean parchment (scrollMid); its two rods cut free (rodL, rodR)
//             roll it open
//   pick      the list picker's scroll (PICK00I0) with its two rods - the frame of a question or a list
//   vials     the HUD's three glass vials (MAIN03I0-05I0, green, red, blue): upright for the corner, on their side for
//             the row, each with a drained twin; and cut into a cork and a seamless length of tube, so a bar of any
//             length is the vial at its own pixels, never stretched
import { UI_PACKS, packUrl } from '../systems/uiPack.js';
import { APP_ROOT } from '../systems/appRoot.js';
/** GRIM6: a dial symbol shipped as its own file under public/art (the chest), served beside the app. */
export const dialFileUrl = (file, doc = globalThis.document) => new URL(`art/${file}`, APP_ROOT ?? doc?.baseURI ?? 'http://localhost/').href;

const G = UI_PACKS.grimoire;
/** The served URL of one of the pack's pictures, by its IMG name. */
export const grimoireImg = (name) => packUrl(G, `Img/${name}.IMG.png`);
/** DESK-HD (2026-10-10, Mac: "the background is still blurry as hell ... use this one"): the front door's desk as an
 *  earlier build drew it - the detailed painting (the candle's drips, the inkwell's glass, the quill), 1515 x 947, its
 *  room's edges falling into the dark as that build lit them. The pack's own BIOG00I0 is a 960 x 600 copy of a
 *  320 x 200 picture, blocks at any size; this one is lifted from Mac's screenshot of that build, its doors' words
 *  and the wordmark taken off (public/art/grimoire-desk.jpg; its doctrine row in test/tooling/doctrine.test.js). */
export const GRIMOIRE_DESK_FILE = 'grimoire-desk.jpg';
export const grimoireDeskUrl = (doc = globalThis.document) => dialFileUrl(GRIMOIRE_DESK_FILE, doc);
/** The pack's lettering - FONT0003-SDF.ttf, the Alagard face GrimoireUI draws every word in. */
export const grimoireFontUrl = () => packUrl(G, 'Fonts/FONT0003-SDF.ttf');

/** The pack draws at 3x Daggerfall's 320 x 200: three of its pixels are one of the game's. */
export const NATIVE = 3;

/** Every crop the dress cuts, by name: the picture, the box [x, y, w, h] in the pack's pixels, and what is done to it.
 *  `crisp: false` keeps a picture as the pack drew it (the vials are pixel art already: sharpened they would ring);
 *  `clarity` (passes of [radius, amount, threshold]) and `contrast` work a painting the default would leave soft - the desk and
 *  its book, the pack's softest, drawn biggest: GRIM3, Dudey: "the main screen background looks like i have not glasses
 *  on". */
export const GRIMOIRE_CROPS = Object.freeze({
  page: Object.freeze({ img: 'TALK01I0', box: [576, 207, 354, 369], make: 'tile' }),
  scroll: Object.freeze({ img: 'LGBK00I0', box: [72, 93, 816, 414], make: 'tile' }),
  wood: Object.freeze({ img: 'INFO01I0', box: [0, 0, 618, 420], make: 'tile' }),
  tear: Object.freeze({ img: 'TALK01I0', box: [552, 177, 399, 420], make: 'tear' }),
  cubby: Object.freeze({ img: 'INVE00I0', box: [513, 144, 156, 117], make: 'plain' }),
  stone: Object.freeze({ img: 'INVE00I0', box: [159, 39, 312, 540], make: 'tile' }),
  exit: Object.freeze({ img: 'INVE00I0', box: [666, 534, 117, 66], make: 'plain' }),
  book: Object.freeze({ img: 'BIOG00I0', box: [63, 195, 777, 402], make: 'plain', clarity: Object.freeze([[1.0, 0.9, 7], [0.6, 0.45, 6]]), contrast: 1.03 }),
  desk: Object.freeze({ img: 'BIOG00I0', box: [0, 0, 960, 600], make: 'plain', clarity: Object.freeze([[1.0, 1.2, 7], [0.6, 0.6, 6]]), contrast: 1.05 }),
  pick: Object.freeze({ img: 'PICK00I0', box: [33, 33, 495, 318], make: 'plain' }),
  plate: Object.freeze({ img: 'INVE00I0', box: [0, 0, 275, 28], make: 'plate', crisp: false }),
  rule: Object.freeze({ img: 'SPBK00I0', box: [426, 117, 312, 7], make: 'pack', crisp: false }),
  compBox: Object.freeze({ img: 'COMPBOX', box: [0, 0, 207, 51], make: 'plain', crisp: false }),
  compass: Object.freeze({ img: 'COMPASS', box: [0, 0, 966, 42], make: 'plain', crisp: false }),
  spbk: Object.freeze({ img: 'SPBK00I0', box: [0, 0, 777, 492], make: 'spbk', crisp: false }),
  sideScroll: Object.freeze({ img: 'REPR01I0', box: [0, 0, 390, 153], make: 'plain' }),
  scrollMid: Object.freeze({ img: 'PICK00I0', box: [120, 99, 360, 180], make: 'plain' }),
  vialFatigue: Object.freeze({ img: 'MAIN03I0', box: [0, 0, 32, 256], make: 'vial', crisp: false }),
  vialHealth: Object.freeze({ img: 'MAIN04I0', box: [0, 0, 32, 256], make: 'vial', crisp: false }),
  vialMagicka: Object.freeze({ img: 'MAIN05I0', box: [0, 0, 32, 256], make: 'vial', crisp: false }),
});
/** The picture sizes the boxes are cut from (the pack's own, read once off the files - pinned by test). */
export const GRIMOIRE_SIZES = Object.freeze({
  TALK01I0: [960, 600], LGBK00I0: [960, 600], INFO01I0: [960, 600], INVE00I0: [960, 600], PICK00I0: [600, 384],
  MAIN03I0: [32, 256], MAIN04I0: [32, 256], MAIN05I0: [32, 256], COMPBOX: [207, 51], COMPASS: [966, 42], BIOG00I0: [960, 600], REPR01I0: [390, 153], SPBK00I0: [777, 492],
  MAP100I0: [1200, 750], OPTN00I0: [572, 322],
});
/** A crop's size on the game's grid - what the dress multiplies by `--gp`. */
/** WOOD-HD (2026-10-10, Mac: "can every board wood background in DFO Grimoire UI in ALL windows and frames look like
 *  this that has that blurred wood?"): the boards' wood is the Ascend's own soft desk wood - even planks, no pixel
 *  blocks - cut from Mac's screenshot of that sheet, its light flattened and made seamless (public/art/grimoire-wood.jpg,
 *  301 x 567; its doctrine row in test/tooling/doctrine.test.js). On the game's grid it is 100 x 189: at the usual three screen
 *  pixels to one, the size it was painted at. The INFO01I0 cut stands in only if the file cannot load. */
export const GRIMOIRE_WOOD_FILE = 'grimoire-wood.jpg';
export const WOOD_TILE = Object.freeze([100, 189]);
export const nativeSize = (name) => { if (name === 'wood') return [...WOOD_TILE]; const b = GRIMOIRE_CROPS[name].box; return [Math.ceil(b[2] / NATIVE), Math.ceil(b[3] / NATIVE)]; };

/** The window frame's picture, on the game's grid: the board's margin round the torn page, and the 9-slice band. */
export const FRAME_ART = Object.freeze({ margin: 4, band: 13 });
/** The tear's threshold: brightness under it is the board the page lay on (clear), over it the page - one hard edge,
 *  never a feathered one. `lo`..`hi` is where the pack's own edge falls; the cut is at their middle. */
export const TEAR_LUMA = Object.freeze({ lo: 70, hi: 120 });
/** How hard a painting is sharpened on the game's grid (an unsharp mask, 0 = as cut). */
export const SHARPEN = 0.55;

/** THE BOOK'S 9-SLICE, in the game's pixels of the painted pages (BIOG00I0's book, cut down its spine at BOOK_SPINE_AT):
 *  the leather and the page edge at the outer sides, top and foot, and the gutter's curve down into the spine - wide,
 *  so the page's depth is the painting's own. */
export const BOOK_SLICE = Object.freeze({ top: 8, bottom: 8, outer: 8, gutter: 26 });
/** Where the painted book's spine falls, in the game's pixels of the cut book (its darkest column). */
export const BOOK_SPINE_AT = 130;
/** THE TAB PLATE's 9-slice, in the pack's own pixels: its lit lip and black outline top and foot, its capped ends. */
export const PLATE_SLICE = Object.freeze({ top: 4, side: 5, bottom: 4 });

/** THE SPELLBOOK'S WIPES, in its own pixels: each a box [x, y, w, h] painted over with the page's own paper from the
 *  rows `from` (a band of clean page beside it, reflected back and forth so no seam repeats), feathered into the
 *  painting at its edges: the foot's DELETE / UP / SORT and DOWN either side of the spine. The spine itself (its
 *  arrows), the right page and the EXIT are never touched. */
export const SPBK_WIPES = Object.freeze([
  Object.freeze({ box: [10, 444, 340, 38], from: [404, 442] }),
  Object.freeze({ box: [400, 444, 240, 38], from: [404, 442] }),
]);
/** THE DESK'S WIPE, on the game's grid: its painted "Biography" title, lifted off with the grain beneath it - the front
 *  door writes its own words, and on a big screen the title stood out either side of the wordmark. */
export const DESK_WIPES = Object.freeze([Object.freeze({ box: [118, 2, 86, 20], from: [22, 42] })]);
function wipeWith(doc, src, wipes) {
  const g = ctx(src), d = g.getImageData(0, 0, src.width, src.height), p = d.data, w = src.width, o = new Uint8ClampedArray(p);
  for (const { box: [x0, y0, bw, bh], from: [f0, f1] } of wipes) {
    const band = f1 - f0;
    for (let y = y0; y < y0 + bh; y++) {
      const k = (y - y0) % (2 * band), sy = f0 + (k < band ? k : 2 * band - 1 - k);
      for (let x = x0; x < x0 + bw; x++) {
        const m = Math.min(1, Math.min(x - x0, x0 + bw - 1 - x) / 6, Math.min(y - y0, y0 + bh - 1 - y) / 4);
        const a = (y * w + x) * 4, b = (sy * w + x) * 4;
        for (let ch = 0; ch < 3; ch++) p[a + ch] = Math.round(o[b + ch] * m + o[a + ch] * (1 - m));
      }
    }
  }
  g.putImageData(d, 0, 0);
  return src;
}

/** The custom properties the dress reads, by crop: `--grim-<name>` (a url()), and the vials' drained twins. */
export const artVar = (name) => `--grim-${name}`;

// ---- the grid: how big one of the game's pixels is on this screen ---------------------------------------------------
/** The scales, in DEVICE pixels per game pixel, for a screen `w` x `h` device pixels at `dpr` device pixels to a CSS
 *  one. A WINDOW is a fixed size in CSS pixels (the pause window is 920 of them on any screen), so what is drawn in one
 *  is drawn at a fixed scale too - `gp` three CSS pixels to a game pixel (the pack's own 1:1), `gq` two (the small
 *  presses, the bars), `gk` one (the pack's own pixel) - each rounded to whole device pixels: a window looks the same
 *  on every screen, its book's edges, its tabs and its bars never thicker on a bigger one (GRIM3, Dudey: "the healt
 *  staming and mana bar in the stats screen a pretty thick we cant let those inconsistencies happen"). A FULL SCREEN
 *  (the Ascend) scales with the screen: `gs`, the screen read as 480 x 300 of the game's pixels, rounded, 2..8.
 *  `cover` is the scale that fills the screen with the whole 320 x 200 desk
 *  (rounded up: a full screen's picture is cropped by a few of its pixels, never scaled by a part); `fit` the biggest
 *  whole scale the WHOLE desk fits at (the front door: its candle, its inkwell and its quill all on the screen, each of
 *  its pixels the smaller square). */
export function grimoireGrid(w, h, dpr = 1) {
  const gs = Math.max(2, Math.min(8, Math.round(Math.min(w / 480, h / 300))));
  const gp = Math.max(2, Math.round(3 * dpr)), gq = Math.max(1, Math.round(2 * dpr)), gk = Math.max(1, Math.round(dpr));
  const cover = Math.max(2, Math.ceil(Math.max(w / 320, h / 200)));
  const fit = Math.max(2, Math.floor(Math.min(w / 320, h / 200)));
  return { gp, gq, gk, gs, cover, fit };
}
/** DESK-FILL (2026-10-10, Mac, of the front door as an earlier build drew it: "it looks way better use this one"): the
 *  desk's scale in CSS pixels - the WHOLE 320 x 200 desk as big as the screen holds it (its candle, inkwell and quill all
 *  on it, the book filling the middle), never rounded down to a whole number. GRIM3 rounded it so the picture's pixels
 *  stayed square; since GRIM6 the desk is drawn smooth at its own resolution, and rounding only shrank it into a dark
 *  room (at 1985 x 947: four screen pixels to each of its own, 800 tall, where 4.7 fills the screen). */
export const deskScale = (w, h) => Math.max(1, Math.min(w / 320, h / 200));
let _gridOn = null;
/** Lay the grid on the root (`--gp`, `--gq`, `--gk` - the pack's own pixel, a third of the game's - `--gc`, in CSS pixels that are whole device pixels) and keep it as the
 *  window is resized or moved to another screen. */
export function layGrimoireGrid(doc = globalThis.document) {
  const win = doc?.defaultView, root = doc?.documentElement;
  if (!win || !root?.style) return null;
  const lay = () => {
    const dpr = win.devicePixelRatio || 1;
    const g = grimoireGrid(win.innerWidth * dpr, win.innerHeight * dpr, dpr);
    root.style.setProperty('--gp', `${g.gp / dpr}px`);
    root.style.setProperty('--gq', `${g.gq / dpr}px`);
    root.style.setProperty('--gk', `${g.gk / dpr}px`);
    root.style.setProperty('--gs', `${g.gs / dpr}px`);
    root.style.setProperty('--gc', `${g.cover / dpr}px`);
    root.style.setProperty('--gd', `${deskScale(win.innerWidth, win.innerHeight)}px`);   // DESK-FILL: the desk as big as the screen holds it
    root.dataset.grimGp = String(g.gp);
    return g;
  };
  if (!_gridOn) { _gridOn = lay; win.addEventListener?.('resize', lay); }
  return lay();
}

// ---- the canvas half (browser only) ---------------------------------------------------------------------------------
const canvas = (doc, w, h) => { const c = doc.createElement('canvas'); c.width = w; c.height = h; return c; };
const ctx = (c) => c.getContext('2d', { willReadFrequently: true });
const pixels = (c) => ctx(c).getImageData(0, 0, c.width, c.height);
function load(doc, url) {
  return new Promise((ok, no) => {
    const img = new (doc.defaultView?.Image ?? globalThis.Image)();
    img.decoding = 'async';
    img.onload = () => ok(img);
    img.onerror = () => no(new Error(`grimoire art: ${url}`));
    img.src = url;
  });
}
function cut(doc, img, [x, y, w, h]) {
  const c = canvas(doc, w, h);
  ctx(c).drawImage(img, x, y, w, h, 0, 0, w, h);
  return c;
}
/** The pack's 3x picture back on the game's grid: each 3 x 3 of its pixels one pixel, the mean of what is there
 *  (alpha-weighted, so a clear pixel never greys its neighbour). On a picture the pack drew at 3x that is exactly its
 *  pixel; on a finer painting, the honest downsample. */
export function toGameGrid(doc, src, k = NATIVE) {
  const w = Math.ceil(src.width / k), h = Math.ceil(src.height / k), s = pixels(src).data, sw = src.width, sh = src.height;
  const c = canvas(doc, w, h), d = ctx(c).createImageData(w, h), p = d.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let r = 0, g = 0, b = 0, a = 0, n = 0;
    for (let j = y * k; j < Math.min(sh, y * k + k); j++) for (let i = x * k; i < Math.min(sw, x * k + k); i++) {
      const o = (j * sw + i) * 4, al = s[o + 3];
      r += s[o] * al; g += s[o + 1] * al; b += s[o + 2] * al; a += al; n++;
    }
    const o = (y * w + x) * 4;
    if (a > 0) { p[o] = Math.round(r / a); p[o + 1] = Math.round(g / a); p[o + 2] = Math.round(b / a); }
    p[o + 3] = Math.round(a / n);
  }
  ctx(c).putImageData(d, 0, 0);
  return c;
}
/** An unsharp mask on the game's grid: each pixel pushed away from the mean of its eight neighbours by `amount`. */
function sharpen(doc, src, amount = SHARPEN) {
  if (!(amount > 0)) return src;
  const w = src.width, h = src.height, s = pixels(src).data;
  const c = canvas(doc, w, h), d = ctx(c).createImageData(w, h), p = d.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = (y * w + x) * 4;
    for (let ch = 0; ch < 3; ch++) {
      let sum = 0, n = 0;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        if (!i && !j) continue;
        const xx = Math.min(w - 1, Math.max(0, x + i)), yy = Math.min(h - 1, Math.max(0, y + j));
        sum += s[(yy * w + xx) * 4 + ch]; n++;
      }
      p[o + ch] = Math.max(0, Math.min(255, Math.round(s[o + ch] + amount * (s[o + ch] - sum / n))));
    }
    p[o + 3] = s[o + 3];
  }
  ctx(c).putImageData(d, 0, 0);
  return c;
}
/** A gaussian blur of a canvas's pixels (separable, edges clamped), as a Float32Array of RGB. */
function gauss(data, w, h, sigma) {
  const r = Math.max(1, Math.ceil(sigma * 3)), k = [];
  let sum = 0;
  for (let i = -r; i <= r; i++) { const v = Math.exp(-(i * i) / (2 * sigma * sigma)); k.push(v); sum += v; }
  for (let i = 0; i < k.length; i++) k[i] /= sum;
  const tmp = new Float32Array(w * h * 3), out = new Float32Array(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let ch = 0; ch < 3; ch++) {
    let a = 0;
    for (let i = -r; i <= r; i++) a += data[(y * w + Math.min(w - 1, Math.max(0, x + i))) * 4 + ch] * k[i + r];
    tmp[(y * w + x) * 3 + ch] = a;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let ch = 0; ch < 3; ch++) {
    let a = 0;
    for (let i = -r; i <= r; i++) a += tmp[(Math.min(h - 1, Math.max(0, y + i)) * w + x) * 3 + ch] * k[i + r];
    out[(y * w + x) * 3 + ch] = a;
  }
  return out;
}
/** CLARITY: unsharp passes at two radii on the game's grid (the broad one gives the grain and the brass their edges, the
 *  fine one each pixel its own), each with a THRESHOLD - a pixel that differs from its surround by less than it (the
 *  smooth paper, the soft glow) is left exactly as painted, one that differs by twice it gets the whole pass, with a soft
 *  knee between - then a slight lift of contrast round the middle grey. The edges come up; the paper never goes blotchy
 *  (GRIM3, Dudey: "cause of all the filter ... the book looks worse now"). */
function clarify(doc, src, passes, contrast = 1) {
  const w = src.width, h = src.height, g = ctx(src), d = g.getImageData(0, 0, w, h), p = d.data;
  for (const [radius, amount, thr = 0] of passes) {
    const b = gauss(p, w, h, radius);
    for (let i = 0, j = 0; i < p.length; i += 4, j += 3) {
      const dr = p[i] - b[j], dg = p[i + 1] - b[j + 1], db = p[i + 2] - b[j + 2];
      const mag = Math.max(Math.abs(dr), Math.abs(dg), Math.abs(db));
      const k = thr > 0 ? Math.max(0, Math.min(1, (mag - thr) / thr)) : 1;
      if (!k) continue;
      p[i] = Math.max(0, Math.min(255, Math.round(p[i] + amount * k * dr)));
      p[i + 1] = Math.max(0, Math.min(255, Math.round(p[i + 1] + amount * k * dg)));
      p[i + 2] = Math.max(0, Math.min(255, Math.round(p[i + 2] + amount * k * db)));
    }
  }
  if (contrast !== 1) for (let i = 0; i < p.length; i += 4) for (let ch = 0; ch < 3; ch++) p[i + ch] = Math.max(0, Math.min(255, Math.round((p[i + ch] - 128) * contrast + 128)));
  g.putImageData(d, 0, 0);
  return src;
}
// ---- GRIM4: the dial's four symbols -----------------------------------------------------------------------------------
/** THE DIAL'S SYMBOLS (Dudey: "instead of words give this fitting symbols, all in the style of grimoire"; and of a drawn
 *  set, "not suiting at all ... this is not a happy pixel game"): each door of the Tab dial is a piece of the pack's own
 *  painting, cut along its outline - SKILLS the Empire's helm off the world map's banner, MAGIC the spellmaker's glowing
 *  spellbook off its desk, MAP the painted map of Tamriel itself, ITEMS the chest off the Options window's Save Game
 *  plate (the pack draws no pack; "the brown background button look has to go"). Three ways of cutting, by what the
 *  picture is ("PIXEL PERFECT please, not room for mistakes"):
 *    `poly`   a painting finer than the game's grid (the helm, the chest): its outline in the picture's own pixels, cut
 *             antialiased at the size it is drawn; `inset` pulls the cut that far inside it where the ground it was
 *             painted on bleeds into its edge (the chest's brown plate)
 *    `cells`  pixel art on the game's grid (the spellbook - INFO01I0 is exactly 3 of its pixels to one of the game's):
 *             the box [x, y, w, h] in GAME pixels, and `rows`, the book's spans along each row of it - each pixel wholly
 *             in or wholly out, the book drawn at one CSS pixel to each of the game's (crisp at any whole density)
 *    neither  the whole picture, its torn edge already clear (the map)
 *  `h` is the symbol's height in CSS pixels on the dial (a `cells` symbol is its own height). The chest is the pack's
 *  smallest painting - about 35 of its pixels - so it is brought up to the dial's size in sharpened doublings (`lift`),
 *  never one blurred stretch (Dudey: "the image quality of the chest must be the same as the other 3"). */
export const DIAL_ICONS = Object.freeze({
  skills: Object.freeze({ img: 'MAP100I0', h: 96, poly: Object.freeze([[603, 6], [607, 6], [608, 11], [620, 12], [632, 14], [641, 19], [648, 27], [652, 36], [655, 46], [659, 56], [660, 75], [659, 95], [657, 108], [653, 121], [647, 132], [638, 142], [626, 150], [614, 155], [600, 155], [588, 149], [576, 141], [566, 131], [558, 121], [553, 111], [552, 95], [552, 52], [555, 42], [560, 32], [566, 24], [573, 18], [584, 14], [596, 12], [602, 11]]) }),
  // the spellbook is the pack's pixel art (INFO01I0 at exactly 3 of its pixels to the game's): cut on its own grid, each
  // pixel in or out - `cells` is the game-pixel box [x, y, w, h] and `rows` the book's spans in each row of it
  magic: Object.freeze({ img: 'INFO01I0', cells: Object.freeze([207, 0, 112, 72]), rows: Object.freeze([
    '29-30', '29-35 51-53', '28-61', '27-63', '26-65 72-83', '27-66 70-87',
    '26-67 68-95', '25-102', '25-103', '24-104', '24-106', '23-112',
    '23-112', '23-112', '22-112', '22-112', '21-112', '20-112',
    '20-112', '20-111', '19-109', '19-111', '18-110', '18-110',
    '17-109', '17-108', '17-107', '16-106', '15-105', '15-105',
    '14-106', '14-107', '14-107', '13-107', '13-106', '12-106',
    '11-106', '11-106', '11-105', '10-105', '10-104', '9-104',
    '8-104', '8-104', '8-104', '8-104', '6-103', '5-102',
    '4-102', '4-102', '3-107', '3-109', '3-110', '1-112',
    '1-112', '0-98 102-111', '0-99 105-109', '1-99', '3-99', '8-98',
    '13-97', '21-97', '27-97', '35-96', '36-96', '36-96',
    '43-96', '49-95', '62-95', '70-95', '77-94', '85-93',
  ]) }),
  map: Object.freeze({ img: 'MAP100I0', h: 84, poly: null }),
  // GRIM6 (Dudey: "the chest is still not fitting and looks too blurry and also badly cutout ... looks at this drawn style
  // of the book and helmet it must match"); GRIM7: the chest Dudey supplied ("here this chest chatgpt made is great make
  // sure it fits the other symbols"), cut from its dark ground along its outline once and shipped
  // (public/art/grimoire-dial-chest.png; its doctrine row in test/tooling/doctrine.test.js) - drawn DOWN to the dial's size here,
  // as the helm and the book are
  items: Object.freeze({ file: 'grimoire-dial-chest.png', size: Object.freeze([130, 132]), h: 80 }),
});
/** The box a symbol is cut from, in its picture's pixels: its outline's bounds (whole pixels), its cells' box, or the
 *  whole picture. */
export function dialIconBox(name) {
  const c = DIAL_ICONS[name];
  if (c.file) return [0, 0, ...c.size];
  if (c.cells) return c.cells.map((v) => v * NATIVE);
  if (!c.poly) return [0, 0, ...GRIMOIRE_SIZES[c.img]];
  const xs = c.poly.map((p) => p[0]), ys = c.poly.map((p) => p[1]);
  const x = Math.floor(Math.min(...xs)), y = Math.floor(Math.min(...ys));
  return [x, y, Math.ceil(Math.max(...xs)) - x, Math.ceil(Math.max(...ys)) - y];
}
/** A symbol's size on the dial, in CSS pixels [w, h]: a `cells` symbol one CSS pixel to each of its game pixels, any
 *  other its height and its own proportions. */
export function dialIconSize(name) {
  const c = DIAL_ICONS[name];
  if (c.cells) return [c.cells[2], c.cells[3]];
  const [, , w, h] = dialIconBox(name);
  return [Math.round((c.h * w) / h), c.h];
}
/** A `cells` symbol's spans, read: each row's [from, to) pairs. */
export const dialRows = (name) => DIAL_ICONS[name].rows.map((r) => (r ? r.split(' ').map((sp) => sp.split('-').map(Number)) : []));
/** THE CHEST'S LIFT: each doubling a smooth one, sharpened at two radii above a threshold (the grain and the iron bands
 *  get their edges back, the flat wood is left as painted); the last step a fine pass and a touch of contrast. */
export const DIAL_LIFT = Object.freeze({ pass: Object.freeze([[1.4, 1.1, 2], [0.7, 0.5, 2]]), finish: Object.freeze([[0.6, 0.6, 1]]), contrast: 1.08 });
/** A canvas drawn at another size: halved in smooth steps while it is more than twice too big (one smooth draw from far
 *  away skips pixels), then drawn once more at the size. */
function resample(doc, src, w, h) {
  let cur = src;
  while (cur.width / 2 >= w && cur.height / 2 >= h) {
    const c = canvas(doc, Math.ceil(cur.width / 2), Math.ceil(cur.height / 2)), g = ctx(c);
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(cur, 0, 0, c.width, c.height);
    cur = c;
  }
  const c = canvas(doc, w, h), g = ctx(c);
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.drawImage(cur, 0, 0, w, h);
  return c;
}
/** One symbol, cut. A `cells` symbol: its box brought to the game's grid (each 3 x 3 of the pack's pixels is one there,
 *  exactly) and every pixel outside its rows made clear - drawn by the dress at one CSS pixel to each, never resampled.
 *  Any other: its box out of the picture WITH what is round it (so a sharpening never meets a clear edge and rings),
 *  brought to `scale` device pixels to one of the picture's, then cut along its outline - an antialiased edge at the
 *  final size, pulled in by its `inset`. */
function dialIcon(doc, img, name, scale) {
  const c0 = DIAL_ICONS[name], [bx, by, bw, bh] = dialIconBox(name);
  if (c0.cells) {
    const pic = toGameGrid(doc, cut(doc, img, [bx, by, bw, bh])), g = ctx(pic), d = g.getImageData(0, 0, pic.width, pic.height), p = d.data;
    dialRows(name).forEach((spans, y) => {
      for (let x = 0; x < pic.width; x++) if (!spans.some(([a, b]) => x >= a && x < b)) p[(y * pic.width + x) * 4 + 3] = 0;
    });
    g.putImageData(d, 0, 0);
    return pic;
  }
  let pic = cut(doc, img, [bx, by, bw, bh]);
  if (c0.lift) {
    while (pic.width * 1.5 < bw * scale) pic = clarify(doc, resample(doc, pic, pic.width * 2, pic.height * 2), DIAL_LIFT.pass);
  }
  const w = Math.max(1, Math.round(bw * scale)), h = Math.max(1, Math.round(bh * scale));
  pic = resample(doc, pic, w, h);
  if (c0.lift) pic = clarify(doc, pic, DIAL_LIFT.finish, DIAL_LIFT.contrast);
  if (!c0.poly) return pic;
  const out = canvas(doc, w, h), g = ctx(out);
  const path = () => {
    g.beginPath();
    c0.poly.forEach(([x, y], i) => { const px = (x - bx) * scale, py = (y - by) * scale; if (i) g.lineTo(px, py); else g.moveTo(px, py); });
    g.closePath();
  };
  g.save(); path(); g.clip(); g.drawImage(pic, 0, 0); g.restore();
  if (c0.inset) {   // the band just inside the outline, taken off: what the painting's ground left on its edge
    g.globalCompositeOperation = 'destination-out'; g.lineJoin = 'round'; g.lineWidth = 2 * c0.inset * scale;
    path(); g.stroke();
    g.globalCompositeOperation = 'source-over';
  }
  return out;
}
/** The dial's names on the root: `--grim-dial<Name>`, each cut at the screen's own density (a symbol is drawn at its
 *  device pixels, never stretched by the browser). */
export const dialArtName = (name) => `dial${name[0].toUpperCase()}${name.slice(1)}`;

/** A tile with no edge where it repeats, and no mirror's symmetry either: the crop over a copy of itself shifted half a
 *  tile (whose edges are the crop's own middle, continuous round the wrap), the crop fading out toward its edges so the
 *  shifted copy is all that meets its neighbour. The fade is worked on the game's grid, so each pixel of the tile is
 *  still one whole square - a blend of the two pictures' pixels, never a smear across them. */
export const SEAM_FEATHER = 0.28;
function seamless(doc, src, axes = 'xy') {
  const w = src.width, h = src.height, s = pixels(src).data, hw = Math.floor(w / 2), hh = Math.floor(h / 2);
  const c = canvas(doc, w, h), d = ctx(c).createImageData(w, h), p = d.data;
  const fx = w * SEAM_FEATHER, fy = h * SEAM_FEATHER;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const mx = axes.includes('x') ? Math.min(1, Math.min(x, w - 1 - x) / fx) : 1;
    const my = axes.includes('y') ? Math.min(1, Math.min(y, h - 1 - y) / fy) : 1;
    let m = mx * my; m = m * m * (3 - 2 * m);
    const a = (y * w + x) * 4, b = ((axes.includes('y') ? (y + hh) % h : y) * w + (axes.includes('x') ? (x + hw) % w : x)) * 4;
    const o = (y * w + x) * 4;
    for (let ch = 0; ch < 4; ch++) p[o + ch] = Math.round(s[a + ch] * m + s[b + ch] * (1 - m));
  }
  ctx(c).putImageData(d, 0, 0);
  return c;
}
/** The page off its board: brightness under the threshold goes clear, over it stays - one hard pixel edge. */
function tear(doc, src) {
  const g = ctx(src), d = g.getImageData(0, 0, src.width, src.height), p = d.data, cutAt = (TEAR_LUMA.lo + TEAR_LUMA.hi) / 2;
  for (let i = 0; i < p.length; i += 4) {
    const l = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
    p[i + 3] = p[i + 3] > 0 && l >= cutAt ? 255 : 0;
  }
  g.putImageData(d, 0, 0);
  return src;
}
/** The window frame: the board (the wood, lit along its top and left, shaded along its foot), the torn page laid on it
 *  with a hard one-pixel shadow under it - a pixel shadow, never a blurred one. */
function frame(doc, wood, page) {
  const { margin: m } = FRAME_ART;
  const w = page.width + m * 2, h = page.height + m * 2, c = canvas(doc, w, h), g = ctx(c);
  g.imageSmoothingEnabled = false;
  // the board is the wood REPEATED - the frame is taller than one cut of it, and a board that ran out of grain left a
  // flat strip along the window's foot (GRIM3, Dudey: "the inventory has a not textured line on the bottom")
  g.fillStyle = g.createPattern(wood, 'repeat'); g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(255,214,150,0.32)'; g.fillRect(1, 1, w - 2, 1); g.fillRect(1, 1, 1, h - 2);
  g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(1, h - 2, w - 2, 1); g.fillRect(w - 2, 1, 1, h - 2);
  g.fillStyle = '#120a04'; g.fillRect(0, 0, w, 1); g.fillRect(0, h - 1, w, 1); g.fillRect(0, 0, 1, h); g.fillRect(w - 1, 0, 1, h);
  // the page's shadow: its own silhouette, one pixel down and right, half dark
  const sh = canvas(doc, page.width, page.height), sg = ctx(sh);
  sg.drawImage(page, 0, 0); sg.globalCompositeOperation = 'source-in'; sg.fillStyle = 'rgba(10,5,2,0.6)'; sg.fillRect(0, 0, sh.width, sh.height);
  g.drawImage(sh, m + 1, m + 1);
  g.drawImage(page, m, m);
  return c;
}
/** The choice scroll with its own words wiped: the clean parchment laid over everything between the rods and the torn
 *  edges, thinned into the scroll's own shading at its sides by the dither, so no seam shows. (Its box is in the game's
 *  pixels, on the scroll as cut.) */
export const WIPE_BOX = Object.freeze([15, 3, 100, 43]);
function wipe(doc, scroll, clean) {
  const [x, y, w, h] = WIPE_BOX;
  const t = canvas(doc, w, h), tg = ctx(t);
  tg.imageSmoothingEnabled = false;
  tg.drawImage(clean, 0, 0, clean.width, clean.height, 0, 0, w, h);
  const d = tg.getImageData(0, 0, w, h), p = d.data, f = 4;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const m = Math.min(1, Math.min(i, w - 1 - i) / f, Math.min(j, h - 1 - j) / 2);
    p[(j * w + i) * 4 + 3] = Math.round(255 * m);
  }
  tg.putImageData(d, 0, 0);
  const c = canvas(doc, scroll.width, scroll.height), g = ctx(c);
  g.drawImage(scroll, 0, 0);
  g.drawImage(t, x, y);
  return c;
}
/** A vertical strip of a picture, `x` to `x + w`. */
function strip(doc, src, x, w) {
  const c = canvas(doc, w, src.height);
  ctx(c).drawImage(src, x, 0, w, src.height, 0, 0, w, src.height);
  return c;
}
/** The glass with the liquid gone: its own pixels greyed and darkened (the cork's own `cork` columns kept). */
function drain(doc, src, cork, corkAtLeft) {
  const e = canvas(doc, src.width, src.height), ge = ctx(e);
  ge.drawImage(src, 0, 0);
  const d = ge.getImageData(0, 0, e.width, e.height), p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    const x = (i / 4) % e.width;
    if (corkAtLeft ? x < cork : x >= e.width - cork) continue;
    const l = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
    p[i] = Math.round(l * 0.42 + p[i] * 0.1 + 22); p[i + 1] = Math.round(l * 0.4 + p[i + 1] * 0.1 + 20); p[i + 2] = Math.round(l * 0.4 + p[i + 2] * 0.1 + 22);
  }
  ge.putImageData(d, 0, 0);
  return e;
}
/** The vial turned: `cw` false lays it cork to the LEFT (the bars), true cork to the RIGHT (the upright vials: the
 *  dress turns the bar back up, so the cork stands on top as the pack draws it). */
function turn(doc, src, cw) {
  const c = canvas(doc, src.height, src.width), g = ctx(c);
  g.imageSmoothingEnabled = false;
  if (cw) { g.translate(src.height, 0); g.rotate(Math.PI / 2); } else { g.translate(0, src.width); g.rotate(-Math.PI / 2); }
  g.drawImage(src, 0, 0);
  return c;
}
/** A length of the vial's tube that repeats with no seam and no pattern: each row across the tube is that row's own
 *  median along the vial's body (its glass, its liquid, its highlight - the vial's own tones, line by line), with a few
 *  of the liquid's bubbles left in it, lighter by a step. */
function tubeOf(doc, side) {
  const { tubeFrom: x0, tubeLen: n } = VIAL_CUT, h = side.height, s0 = pixels(side).data, w = side.width;
  const c = canvas(doc, n, h), d = ctx(c).createImageData(n, h), p = d.data;
  for (let y = 0; y < h; y++) {
    const ch = [0, 1, 2, 3].map((k) => { const v = []; for (let x = x0; x < Math.min(w, x0 + 48); x++) v.push(s0[(y * w + x) * 4 + k]); v.sort((a, b) => a - b); return v[v.length >> 1]; });
    for (let x = 0; x < n; x++) { const o = (y * n + x) * 4; p[o] = ch[0]; p[o + 1] = ch[1]; p[o + 2] = ch[2]; p[o + 3] = ch[3]; }
  }
  for (const [bx, by] of [[5, 3], [17, 6], [26, 4], [11, 7]]) {
    if (by >= h) continue;
    const o = (by * n + bx) * 4;
    for (let k = 0; k < 3; k++) p[o + k] = Math.min(255, Math.round(p[o + k] * 1.25 + 14));
  }
  ctx(c).putImageData(d, 0, 0);
  return c;
}
/** GRIM5: THE VIAL'S BODY DRAWN OUT - `bodyLen` of the game's pixels of glass that run from the shoulder to the foot as the
 *  vial's own do: each row's course along the body (its light by the cork falling to the dark by the foot, smoothed) laid
 *  over the whole length, with the row's own grain - its bubbles, what the smoothing took - laid back over it at the
 *  vial's own spacing. So a long bar darkens toward its foot as the HUD's vial does, and never meets its foot as a block. */
function longBody(doc, side) {
  const { tubeFrom: x0, footFrom: x1, bodyLen: n } = VIAL_CUT, w = side.width, h = side.height, s0 = pixels(side).data, len = x1 - x0;
  const c = canvas(doc, n, h), d = ctx(c).createImageData(n, h), p = d.data;
  for (let y = 0; y < h; y++) for (let ch = 0; ch < 4; ch++) {
    const row = []; for (let x = x0; x < x1; x++) row.push(s0[(y * w + x) * 4 + ch]);
    const sm = row.map((_, i) => { let a = 0, k = 0; for (let j = Math.max(0, i - 4); j <= Math.min(len - 1, i + 4); j++) { a += row[j]; k++; } return a / k; });
    for (let X = 0; X < n; X++) {
      const t = (X / (n - 1)) * (len - 1), i = Math.floor(t), f = t - i, g = sm[i] * (1 - f) + sm[Math.min(len - 1, i + 1)] * f;
      const r = X % len, grain = ch === 3 ? 0 : row[r] - sm[r];
      p[(y * n + X) * 4 + ch] = Math.max(0, Math.min(255, Math.round(g + grain)));
    }
  }
  ctx(c).putImageData(d, 0, 0);
  return c;
}
/** The vial's pieces: on its side both ways with drained twins, and its cork and a seamless run of its tube - so any
 *  bar is drawn at the vial's own pixels, the tube repeated, never one vial stretched along it. */
/** GRIM5: and the vial's own HEAD (its cork and its lit shoulder, up to `tubeFrom`) and FOOT (from `footFrom` to its end),
 *  so a long bar is the HUD's vial drawn out - its own head, its glass, its own foot - never a run of tube that simply
 *  stops (Dudey: "the vial bars are toooshort in the stat screen"). */
export const VIAL_CUT = Object.freeze({ cork: 6, tubeFrom: 28, tubeLen: 32, footFrom: 76, bodyLen: 240 });
/** A piece turned half round - the lying vial's piece as the UPRIGHT vial's track holds it (cork at the right, so the
 *  dress's quarter turn stands it on top). */
function halfTurn(doc, src) {
  const c = canvas(doc, src.width, src.height), g = ctx(c);
  g.imageSmoothingEnabled = false;
  g.translate(src.width, src.height); g.rotate(Math.PI);
  g.drawImage(src, 0, 0);
  return c;
}
function vial(doc, src) {
  const cork = Math.max(2, Math.round(src.height * 0.05));
  const side = turn(doc, src, false), up = turn(doc, src, true);
  const tube = tubeOf(doc, side);
  const corkPiece = strip(doc, side, 0, VIAL_CUT.cork);
  const empty = drain(doc, side, cork, true);
  const footLen = side.width - VIAL_CUT.footFrom;
  const v = {
    full: side, empty, up, upEmpty: drain(doc, up, cork, false),
    tube, tubeEmpty: drain(doc, tube, 0, true), cork: corkPiece,
    head: strip(doc, side, 0, VIAL_CUT.tubeFrom), headEmpty: strip(doc, empty, 0, VIAL_CUT.tubeFrom),
    body: longBody(doc, side), bodyEmpty: longBody(doc, empty),
    foot: strip(doc, side, VIAL_CUT.footFrom, footLen), footEmpty: strip(doc, empty, VIAL_CUT.footFrom, footLen),
  };
  // VIAL-LONG (2026-10-11: "when i use alt + u and try to make the bar ... longer it bugs out"): the UPRIGHT vial drawn out
  // too - its head, its glass and its foot, each the lying one's turned half round, so a taller vial stands as the HUD's
  // own does: the cork on top, the foot on the floor, the glass drawn out between
  return Object.assign(v, {
    upHead: halfTurn(doc, v.head), upHeadEmpty: halfTurn(doc, v.headEmpty), upFoot: halfTurn(doc, v.foot), upFootEmpty: halfTurn(doc, v.footEmpty),
    upBody: halfTurn(doc, v.body), upBodyEmpty: halfTurn(doc, v.bodyEmpty) });
}

/** THE TAB PLATE with its lettering lifted off: inside its outline, a pixel much darker than its row's own wood is a
 *  letter's, and takes the row's median - the plate's own grain and shading stand everywhere else. */
function liftLetters(doc, src) {
  const { top: T, side: S, bottom: B } = PLATE_SLICE, w = src.width, h = src.height, g = ctx(src), d = g.getImageData(0, 0, w, h), p = d.data;
  const lum = (o) => 0.299 * p[o] + 0.587 * p[o + 1] + 0.114 * p[o + 2];
  for (let y = T; y < h - B; y++) {
    const row = [];
    for (let x = S; x < w - S; x++) row.push((y * w + x) * 4);
    const sorted = row.map(lum).sort((a, b) => a - b), med = sorted[Math.floor(sorted.length * 0.7)];
    const keep = row.filter((o) => lum(o) >= med - 10);
    const mean = [0, 1, 2].map((ch) => keep.reduce((s2, o) => s2 + p[o + ch], 0) / Math.max(1, keep.length));
    for (const o of row) if (lum(o) < med - 10) { p[o] = Math.round(mean[0]); p[o + 1] = Math.round(mean[1]); p[o + 2] = Math.round(mean[2]); }
  }
  g.putImageData(d, 0, 0);
  return src;
}
/** The open tab: the same plate, lit and warmed toward the page it opens (its outline kept). */
function litPlate(doc, src) {
  const c = canvas(doc, src.width, src.height), g = ctx(c);
  g.drawImage(src, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height), p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    const l = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
    if (l < 30) continue;
    p[i] = Math.min(255, Math.round(p[i] * 1.32 + 18)); p[i + 1] = Math.min(255, Math.round(p[i + 1] * 1.3 + 12)); p[i + 2] = Math.min(255, Math.round(p[i + 2] * 1.22 + 2));
  }
  g.putImageData(d, 0, 0);
  return c;
}
const urlOf = (c) => `url("${c.toDataURL('image/png')}")`;

let _built = null;
/** Cut every crop once and lay them on the root as `--grim-*` (a second call answers the first's promise), with the
 *  grid they are drawn on. Resolves to the names laid, or [] where the page has no canvas or a picture would not load
 *  - the flat tones stand then. */
export function buildGrimoireArt(doc = globalThis.document) {
  if (_built) return _built;
  const root = doc?.documentElement;
  if (!root?.style || typeof doc.createElement !== 'function' || !doc.createElement('canvas').getContext?.('2d')) return (_built = Promise.resolve([]));
  layGrimoireGrid(doc);
  _built = (async () => {
    const names = [...new Set([...Object.values(GRIMOIRE_CROPS), ...Object.values(DIAL_ICONS)].map((c) => c.img).filter(Boolean))];
    const imgs = Object.fromEntries(await Promise.all(names.map(async (n) => [n, await load(doc, grimoireImg(n))])));
    const out = {};
    for (const [name, c] of Object.entries(GRIMOIRE_CROPS)) {
      let piece = c.make === 'plate' || c.make === 'spbk' || c.make === 'pack' ? cut(doc, imgs[c.img], c.box) : toGameGrid(doc, cut(doc, imgs[c.img], c.box));
      if (name === 'desk') piece = wipeWith(doc, piece, DESK_WIPES);
      if (c.clarity) piece = clarify(doc, piece, c.clarity, c.contrast ?? 1);
      else if (c.crisp !== false && c.make !== 'tear') piece = sharpen(doc, piece);
      if (c.make === 'tile') out[name] = seamless(doc, piece);
      else if (c.make === 'tear') out[name] = tear(doc, piece);
      else if (c.make === 'spbk') out[name] = wipeWith(doc, piece, SPBK_WIPES);
      else if (c.make === 'plate') { out[name] = liftLetters(doc, piece); out[`${name}On`] = litPlate(doc, out[name]); }
      else if (c.make === 'vial') {
        const v = vial(doc, piece);
        Object.assign(out, { [name]: v.full, [`${name}Empty`]: v.empty, [`${name}Up`]: v.up, [`${name}UpEmpty`]: v.upEmpty,
          [`${name}Tube`]: v.tube, [`${name}TubeEmpty`]: v.tubeEmpty,
          [`${name}Head`]: v.head, [`${name}HeadEmpty`]: v.headEmpty, [`${name}Foot`]: v.foot, [`${name}FootEmpty`]: v.footEmpty,
          [`${name}Body`]: v.body, [`${name}BodyEmpty`]: v.bodyEmpty,
          [`${name}UpHead`]: v.upHead, [`${name}UpHeadEmpty`]: v.upHeadEmpty, [`${name}UpFoot`]: v.upFoot, [`${name}UpFootEmpty`]: v.upFootEmpty,
          [`${name}UpBody`]: v.upBody, [`${name}UpBodyEmpty`]: v.upBodyEmpty });
        out.vialCork ??= v.cork;
      }
      else out[name] = piece;
    }
    // WOOD-HD: the soft desk wood for every board - drawn at the screen's own device pixels (the grid's --gp: whole
    // device pixels to one of the game's), so the kit's pixelated drawing lays it one to one and it stays smooth; the
    // window frame's thin rim takes it at the game's own size, as the frame is built
    const woodPic = await load(doc, dialFileUrl(GRIMOIRE_WOOD_FILE, doc)).catch(() => null);
    let frameWood = out.wood;
    if (woodPic) {
      const gpx = Math.max(2, Math.round(3 * (doc.defaultView?.devicePixelRatio || 1)));   // grimoireGrid's own gp
      out.wood = resample(doc, cut(doc, woodPic, [0, 0, woodPic.width, woodPic.height]), WOOD_TILE[0] * gpx, WOOD_TILE[1] * gpx);
      frameWood = resample(doc, cut(doc, woodPic, [0, 0, woodPic.width, woodPic.height]), WOOD_TILE[0], WOOD_TILE[1]);
    }
    out.frame = frame(doc, frameWood, out.tear);
    out.sideScroll = wipe(doc, out.sideScroll, out.scrollMid);
    const rod = Math.round(out.sideScroll.width * 0.115);
    out.rodL = strip(doc, out.sideScroll, 0, rod);
    out.rodR = strip(doc, out.sideScroll, out.sideScroll.width - rod, rod);
    out.bookL = strip(doc, out.book, 0, BOOK_SPINE_AT);
    out.bookR = strip(doc, out.book, BOOK_SPINE_AT, out.book.width - BOOK_SPINE_AT);
    // GRIM4: the dial's symbols, at the screen's density (a phone or a 4K screen draws each at its own device pixels)
    const dpr = Math.min(3, Math.max(1, doc.defaultView?.devicePixelRatio || 1));
    for (const name of Object.keys(DIAL_ICONS)) {
      const [, , , bh] = dialIconBox(name), [, h] = dialIconSize(name);
      const c = DIAL_ICONS[name];
      const pic = c.file ? await load(doc, dialFileUrl(c.file, doc)).catch(() => null) : imgs[c.img];
      if (!pic) continue;   // its file not served: the door keeps its word
      out[dialArtName(name)] = c.file ? resample(doc, cut(doc, pic, [0, 0, ...c.size]), Math.round((h * dpr * c.size[0]) / c.size[1]), Math.round(h * dpr))
        : dialIcon(doc, pic, name, (h * dpr) / bh);   // (a `cells` symbol is its own size)
    }
    const laid = [];
    for (const [name, c] of Object.entries(out)) {
      if (name === 'tear') continue;
      root.style.setProperty(artVar(name), urlOf(c));
      laid.push(name);
    }
    root.style.setProperty(artVar('compbox'), `url("${grimoireImg('COMPBOX')}")`);
    root.dataset.grimArt = 'ready';
    return laid;
  })().catch((e) => { console.warn('[grimoire] the dress keeps its flat tones -', e?.message ?? e); return []; });
  return _built;
}
/** Tests: forget the cut, so a fresh document cuts again. */
export function _resetGrimoireArtForTests() { _built = null; _gridOn = null; }
