// ── THE BOOK (journal-ui slice 5, MAC): one journal, many pages ───────────────────────
// The UI is a physical book. It opens by flipping its cover; content lives on a two-page
// spread; leaves TURN -- an animated flip about the spine with the leaf's curl highlight,
// its shadow sweeping the page beneath, and the closed pages' fore-edge stack drawn under
// everything. Separate floating panels retire as their systems move in.
//
// Architecture: a page REGISTRY (paint callbacks) + pure spread navigation (tested) +
// the painterly layer (probed). Pages render to offscreen canvases per spread so the
// flip scales pixels, not repaints.
import { drawPaperPanel, PAPER } from './paper.js';
// PORT (EB1): Raum's hand-drawn journal face is not this book's. Every
// inscription the book makes - the cover's title and subtitle, a page
// number, BLANK - goes through BOOK.inscribe, which the port points at
// its own glyph painter (Daggerfall's FNT faces); the faces below are
// the names the calls keep. Without a painter the book is mute, never
// broken.
const TITLE = 'title', HEADER = 'header', BODY = 'body';
const drawJournal = (ctx, str, x, y, opts = {}) => BOOK.inscribe?.(ctx, str, x, y, opts);

const css = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
export const BOOK = {
  pageW: 104, pageH: 168, // one leaf, logical px -- RECOMPUTED from the screen by layoutBook (MAC: larger)
  flipMs: 380, coverMs: 420,
  board: [82, 54, 38], boardEdge: [116, 82, 56], boardDark: [58, 38, 27], // the cover's leather-board tones
  stack: [196, 180, 148], stackLine: [160, 142, 112], // the fore-edge page stack
  thread: [214, 196, 158], // the spine stitching
  // PORT (EB1): the cover's words and the inscription seam - see drawJournal above.
  cover: { title: 'RAUM', subtitle: 'FIELD JOURNAL' },
  inscribe: null,
  // PORT (EB2): the PAPER SCALE. The port paints the book in device pixels
  // so its type can be a real face, anti-aliased; the paper, the board and
  // the stack are still drawn at Raum's pixel size and scaled up by this
  // integer, smoothing off, so the pixel look survives. 1 = Raum's own.
  paperScale: 1,
};
/** PORT (EB2): paint `draw` at 1/paperScale and blit it up, pixel-crisp. */
const pixelLayer = (ctx, w, h, draw) => {
  const ps = Math.max(1, BOOK.paperScale | 0);
  if (ps === 1) { draw(ctx, w, h); return; }
  const t = document.createElement('canvas');
  t.width = Math.max(1, Math.round(w / ps)); t.height = Math.max(1, Math.round(h / ps));
  draw(t.getContext('2d'), t.width, t.height);
  ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(t, 0, 0, t.width, t.height, 0, 0, w, h); ctx.restore();
};
/** Size the book to the screen: the object should command the view (MAC's eye). */
const WIDTH_ENVELOPE_AR = 192 / 101; // preserve the pre-tune width at every viewport, including capped landscape
const PAGE_AR = 168 / 101; // MAC: shorter book; only height changes against the preserved width envelope

export function layoutBook(book, uiW, uiH) {
  // DESKTOP UI PARITY (MAC 2026-07-14): the leaf was sized off uiW, so the page SHAPE followed the
  // viewport's aspect -- portrait mobile got a book leaf (101x192, ar 1.90) but a landscape desktop
  // got a squat wide slab (193x140, ar 0.73) and the uiH*0.4 height collapsed onto its 140 floor.
  // Size off the SHORT edge instead (the same reference UIK keys off, so the whole UI shares one
  // scale). WIDTH_ENVELOPE_AR keeps the exact pre-tune width contract; PAGE_AR shortens only height.
  // This matters in landscape, where the old 0.85*uiH cap used to participate in the width result.
  const short = Math.min(uiW, uiH);
  const base = Math.max(96, Math.floor((short - 14) / 2));
  const widthEnvelopeH = Math.max(140, Math.min(Math.round(base * WIDTH_ENVELOPE_AR), Math.floor(uiH * 0.85)));
  const pw = Math.max(96, Math.round(widthEnvelopeH / WIDTH_ENVELOPE_AR));
  const ph = Math.max(140, Math.min(Math.round(pw * PAGE_AR), Math.floor(uiH * 0.85)));
  if (pw !== BOOK.pageW || ph !== BOOK.pageH) { BOOK.pageW = pw; BOOK.pageH = ph; coverCanvas = null; if (book) invalidateSpread(book); }
}

/** PORT (EB1): size the leaf from OUTSIDE - the port sizes it off the view's
 *  height (a book is tall) where Raum's layoutBook keys off the short edge -
 *  and clear the cover with it, as layoutBook does. */
export function resizeBook(book, pw, ph) {
  if (pw === BOOK.pageW && ph === BOOK.pageH) return;
  BOOK.pageW = pw; BOOK.pageH = ph; coverCanvas = null; if (book) invalidateSpread(book);
}

// ── pure navigation (tested) ──────────────────────────────────────────────────────────
export const spreadCount = (pages) => Math.max(1, Math.ceil(pages.length / 2));
export const clampSpread = (i, pages) => Math.max(0, Math.min(spreadCount(pages) - 1, i));
export const spreadPages = (pages, i) => [pages[i * 2] || null, pages[i * 2 + 1] || null];

// ── the book object ───────────────────────────────────────────────────────────────────
export function createBook(pages) {
  return {
    pages, open: false, spread: 0,
    phase: 'closed', // 'closed' | 'slide-in' | 'opening' | 'idle' | 'flip' | 'slide-out'
    t: 0, dir: 1, from: 0, to: 0, t0: 0,
    slide: 0, // 0 = parked below the screen, 1 = seated
    _lastNow: 0,
    cache: new Map(), // spreadIndex -> [leftCanvas, rightCanvas]
  };
}
const easeOutCubic = (t) => 1 - (1 - t) ** 3;
const easeInCubic = (t) => t * t * t;
BOOK.slideInMs = 260; BOOK.slideOutMs = 220;

const pageCanvas = (book, pageIdx, runRef) => {
  const c = document.createElement('canvas');
  c.width = BOOK.pageW; c.height = BOOK.pageH;
  const ctx = c.getContext('2d');
  const side = pageIdx % 2; // 0 = a left page (spine on its right), 1 = a right page (spine on its left)
  pixelLayer(ctx, BOOK.pageW, BOOK.pageH, (x, w, h) => { // PORT (EB2): the sheet at Raum's pixel size
    // the leaf itself: a quieter sheet than the floating panels -- shallow tears, no tape
    drawPaperPanel(x, 0, 0, w, h, { seed: 900 + pageIdx * 7, tape: false, shadow: false, rule: false, creases: pageIdx % 3 === 0 });
    // the gutter's curvature: the page bows into the spine, so its inner edge falls into shade
    for (let i = 0; i < 10; i++) {
      x.fillStyle = `rgba(60,44,30,${0.16 * (1 - i / 10)})`;
      x.fillRect(side ? i : w - 1 - i, 2, 1, h - 4);
    }
  });
  const page = book.pages[pageIdx];
  if (page) page.paint(ctx, side ? 12 : 8, 10, BOOK.pageW - 20, BOOK.pageH - 24, runRef);
  else { drawJournal(ctx, 'BLANK', (BOOK.pageW >> 1) - 16, BOOK.pageH >> 1, { face: BODY, color: css(PAPER.inkFaded, 0.6) }); }
  // the page number, inked at the outer bottom corner
  drawJournal(ctx, String(pageIdx + 1), side ? BOOK.pageW - 14 : 8, BOOK.pageH - 11, { face: BODY, color: css(PAPER.inkFaded, 0.8) });
  return c;
};
const spreadCanvases = (book, i, runRef) => {
  if (!book.cache.has(i)) book.cache.set(i, [pageCanvas(book, i * 2, runRef), pageCanvas(book, i * 2 + 1, runRef)]);
  return book.cache.get(i);
};
export const invalidateSpread = (book, i = null) => { if (i === null) book.cache.clear(); else book.cache.delete(i); };

let coverCanvas = null;
const getCover = () => {
  if (coverCanvas) return coverCanvas;
  const c = document.createElement('canvas');
  c.width = BOOK.pageW; c.height = BOOK.pageH;
  const x0 = c.getContext('2d');
  pixelLayer(x0, c.width, c.height, (x, cw, ch) => { // PORT (EB2): the board at Raum's pixel size
  const c = { width: cw, height: ch };
  x.fillStyle = css(BOOK.board); x.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 260; i++) { // the board's grain
    const gx = (i * 37) % c.width, gy = (i * 53) % c.height;
    x.fillStyle = css(i % 3 ? BOOK.boardDark : BOOK.boardEdge, 0.18);
    x.fillRect(gx, gy, 1 + (i % 2), 1);
  }
  // deep two-scale leather grain over the flat noise
  for (let i = 0; i < 90; i++) {
    const gx = (i * 89) % (c.width - 6) + 3, gy = (i * 131) % (c.height - 6) + 3;
    x.fillStyle = css(BOOK.boardDark, 0.3); x.fillRect(gx, gy, 2 + (i % 3), 1);
    x.fillStyle = css(BOOK.boardEdge, 0.22); x.fillRect(gx, gy + 1, 2, 1);
  }
  x.fillStyle = css(BOOK.boardEdge); x.fillRect(0, 0, c.width, 2); x.fillRect(0, c.height - 2, c.width, 2); x.fillRect(0, 0, 2, c.height); x.fillRect(c.width - 2, 0, 2, c.height);
  // the embossed frame: a double tooled line with corner squares
  x.fillStyle = css(BOOK.boardDark, 0.9);
  x.fillRect(5, 5, c.width - 10, 1); x.fillRect(5, c.height - 6, c.width - 10, 1); x.fillRect(5, 5, 1, c.height - 10); x.fillRect(c.width - 6, 5, 1, c.height - 10);
  x.fillStyle = css(BOOK.boardEdge, 0.55);
  x.fillRect(6, 6, c.width - 12, 1); x.fillRect(6, c.height - 7, c.width - 12, 1); x.fillRect(6, 6, 1, c.height - 12); x.fillRect(c.width - 7, 6, 1, c.height - 12);
  for (const [cx2, cy2] of [[8, 8], [c.width - 12, 8], [8, c.height - 12], [c.width - 12, c.height - 12]]) { x.fillStyle = css(BOOK.boardDark); x.fillRect(cx2, cy2, 4, 4); x.fillStyle = css(BOOK.boardEdge, 0.6); x.fillRect(cx2, cy2, 4, 1); }
  // the clasp's remnant on the fore edge
  const clY = (c.height >> 1) - 5;
  x.fillStyle = css([120, 112, 96]); x.fillRect(c.width - 7, clY, 7, 10);
  x.fillStyle = css([164, 156, 136]); x.fillRect(c.width - 7, clY, 7, 2);
  x.fillStyle = css(BOOK.boardDark); x.fillRect(c.width - 5, clY + 4, 2, 2);
  });
  const x = x0;
  // the title, embossed: dark inset under, lit face over
  const tx = 18, ty = Math.max(30, (c.height >> 2) - 8);
  drawJournal(x, BOOK.cover.title, tx + 1, ty + 1, { face: TITLE, color: css(BOOK.boardDark), w: c.width - tx * 2 });   // PORT: the book's own title
  drawJournal(x, BOOK.cover.title, tx, ty, { face: TITLE, color: css([214, 186, 132]), w: c.width - tx * 2 });
  drawJournal(x, BOOK.cover.subtitle, tx - 4, ty + 34, { face: BODY, color: css([190, 160, 110]), w: c.width - (tx - 4) * 2 });
  coverCanvas = c;
  return c;
};

// ── the paint ─────────────────────────────────────────────────────────────────────────
// origin = the SPINE's top point; pages sit left/right of it.
export function bookOrigin(uiW, uiH) { return [uiW >> 1, (uiH - BOOK.pageH) >> 1]; }

const drawStack = (ctx, sx, sy, sides = 3) => { // the closed pages' fore-edges; sides: 1 = left, 2 = right, 3 = both
  const d = 4 * Math.max(1, BOOK.paperScale | 0); // stack thickness (PORT (EB2): in paper pixels)
  ctx.fillStyle = css(BOOK.stack);
  if (sides & 1) ctx.fillRect(sx - BOOK.pageW - d, sy + 3, BOOK.pageW + d, BOOK.pageH + d);
  if (sides & 2) ctx.fillRect(sx, sy + 3, BOOK.pageW + d, BOOK.pageH + d);
  ctx.fillStyle = css(BOOK.stackLine, 0.8);
  for (let i = 1; i <= d; i++) { // individual sheet lines in the stack
    if (sides & 1) { ctx.fillRect(sx - BOOK.pageW - d + (d - i), sy + 3 + i, 1, BOOK.pageH); ctx.fillRect(sx - BOOK.pageW - d + (d - i), sy + 2 + BOOK.pageH + i, BOOK.pageW + d, 1); }
    if (sides & 2) { ctx.fillRect(sx + BOOK.pageW + i - 1, sy + 3 + i, 1, BOOK.pageH); ctx.fillRect(sx, sy + 2 + BOOK.pageH + i, BOOK.pageW + d - i, 1); }
  }
  ctx.fillStyle = css(BOOK.boardDark); // the spine's shadow well
  ctx.fillRect(sx - 1, sy + 2, 2, BOOK.pageH + d + 2);
};

// ── THE CLOTH FOLD (MAC: pages fold like fabric) ──────────────────────────────────────
// The leaf is sliced into vertical strips; the spine-side leads the turn and the free
// edge DRAGS behind (drag D), so the sheet bends and rolls instead of turning as a
// board. Each strip carries a belly lift (the sheet bows), rolling shade (angled-away
// strips darken), and the curl's bright front where the fold crests. The cover uses a
// low drag -- boards flex barely; paper flows.
const drawClothLeaf = (ctx, frontC, backC, spineX, y, dir, t, drag) => {
  // THE SIGNED CHAIN (the inversion fix, MAC's eye): the leaf is a chain of strips
  // hinged at the spine. Each strip's horizontal reach is SW*cos(theta) -- SIGNED, so
  // once a strip folds past vertical its reach goes negative and the chain walks across
  // the spine. The free edge travels the full arc: far side -> crest -> lands a whole
  // page-width over. dir=+1 turns the right leaf leftward; dir=-1 mirrors.
  const N = 16, SW = BOOK.pageW / N;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  let chain = 0; // signed reach from the spine, in the leaf's ORIGIN direction (dir)
  let crestX = null;
  for (let s2 = 0; s2 < N; s2++) {
    const u = (s2 + 0.5) / N;
    const th = Math.PI * Math.max(0, Math.min(1, t * (1 + drag) - drag * u));
    const c = Math.cos(th);
    const reach = SW * c; // signed
    const x0 = spineX + dir * chain, x1 = spineX + dir * (chain + reach);
    const dstX = Math.min(x0, x1), w = Math.max(0.4, Math.abs(x1 - x0));
    const showBack = c < 0;
    const src = showBack ? backC : frontC;
    // source column of this physical strip: the lifting page reads outward from the
    // spine; its back (the incoming page) mirrors
    const frontU = dir > 0 ? u : 1 - u;
    const backU = dir > 0 ? 1 - u : u;
    const sxc = Math.round((showBack ? backU : frontU) * BOOK.pageW - SW / 2);
    const belly = Math.sin(th) * Math.sin(u * Math.PI) * Math.max(3, BOOK.pageH * 0.02) * (showBack ? 0.5 : 1);
    ctx.drawImage(src, Math.max(0, Math.min(BOOK.pageW - Math.ceil(SW), sxc)), 0, Math.ceil(SW), BOOK.pageH, dstX, y - belly, w, BOOK.pageH + belly * 0.6);
    const shade = 0.38 * Math.sin(th);
    if (shade > 0.02) { ctx.fillStyle = `rgba(24,18,12,${shade})`; ctx.fillRect(dstX, y - belly, w, BOOK.pageH + belly * 0.6); }
    if (crestX === null && th > Math.PI / 2) crestX = x0; // the fold's standing line
    chain += reach;
  }
  if (crestX !== null) { ctx.fillStyle = css(PAPER.bright, 0.95); ctx.fillRect(Math.round(crestX), y - 2, 1, BOOK.pageH + 4); } // the crest catches the light
  ctx.restore();
};
export const bookSettled = (book) => book.phase === 'idle';

const drawSpineStitch = (ctx, sx, sy) => { // thread dashes down the gutter, tied at both ends
  ctx.fillStyle = css(BOOK.thread, 0.9);
  for (let py = 6; py < BOOK.pageH - 6; py += 9) { ctx.fillRect(sx - 1, sy + py, 2, 4); }
  ctx.fillStyle = css(BOOK.thread);
  ctx.fillRect(sx - 3, sy + 2, 6, 2); ctx.fillRect(sx - 3, sy + BOOK.pageH - 4, 6, 2);
};



/** Paint the whole book for the current phase. Advances animation clocks off `now`. */
export function paintBook(ctx, book, uiW, uiH, runRef, now) {
  const dt = book._lastNow ? Math.min(50, now - book._lastNow) : 16; book._lastNow = now;
  let [sx, sy] = bookOrigin(uiW, uiH);
  // THE SLIDE (MAC): the book rides up from below the screen and sinks away on close
  if (book.phase === 'slide-in') {
    const t = Math.min(1, (now - book.t0) / BOOK.slideInMs);
    book.slide = easeOutCubic(t);
    if (t >= 1) { book.phase = 'opening'; book.t0 = now; }
  } else if (book.phase === 'slide-out') {
    const t = Math.min(1, (now - book.t0) / BOOK.slideOutMs);
    book.slide = 1 - easeInCubic(t);
    if (t >= 1) { book.phase = 'closed'; book.open = false; book.spread = 0; book.slide = 0; invalidateSpread(book); return false; }
  }
  // no full-screen wash: the book opens over the LIVE world, not over a takeover (MAC --
  // "only the book, not the entire screen"); the capture div still swallows world input
  sy += Math.round((1 - book.slide) * (uiH - sy + 12)); // parked just below the screen at slide 0
  if (book.phase === 'slide-in' || book.phase === 'slide-out' || book.phase === 'closed') {
    drawStack(ctx, sx, sy, 2);
    ctx.drawImage(getCover(), sx, sy); // the journal travels CLOSED both ways (MAC: close, then slide down)
    return book.phase !== 'closed';
  }
  if (book.phase === 'closing') { // the opening in reverse: the left side lifts and the cover falls shut over the right, board-stiff
    const t = Math.min(1, (now - book.t0) / BOOK.coverMs);
    drawStack(ctx, sx, sy, 2);
    if (t >= 1) { // shut: the seated cover paints THIS frame too -- a bare right page
      // flashed here for one frame between the shut and the drop (MAC's flicker)
      ctx.drawImage(getCover(), sx, sy);
      book.phase = 'slide-out'; book.t0 = now;
      return true;
    }
    const [cL, cR] = spreadCanvases(book, book.spread, runRef);
    ctx.drawImage(cR, sx, sy); // being covered
    ctx.fillStyle = `rgba(8,6,4,${0.35 * Math.sin(Math.PI * t)})`; // the hover-shadow rises and DIES by landing (a full-dark end flashed bright at the handoff)
    ctx.fillRect(sx, sy, Math.round(BOOK.pageW * Math.max(0, Math.sin(Math.PI * 0.5 * t)) * 0.9) + 6, BOOK.pageH);
    drawClothLeaf(ctx, cL, getCover(), sx, sy, -1, t, 0.16); // the left leaf (front = the page) rises and falls shut over the right (back = the cover)
    return true;
  }
  drawStack(ctx, sx, sy, book.phase === 'opening' ? 2 : 3); // a still-opening book has NOTHING on its left (MAC's eye: the phantom blank page)
  const [curL, curR] = spreadCanvases(book, book.phase === 'flip' ? book.from : book.spread, runRef);
  if (book.phase === 'opening') {
    const t = Math.min(1, (now - book.t0) / BOOK.coverMs);
    const [p0L, p0R] = spreadCanvases(book, 0, runRef);
    ctx.drawImage(p0R, sx, sy); // revealed under the lifting cover
    // shadow sweeping off the revealed page
    ctx.fillStyle = `rgba(8,6,4,${0.35 * Math.sin(Math.PI * t)})`;
    ctx.fillRect(sx, sy, Math.round(BOOK.pageW * Math.max(0, Math.cos(Math.PI * t)) * 0.9) + 6, BOOK.pageH);
    if (t < 1) { drawClothLeaf(ctx, getCover(), p0L, sx, sy, +1, t, 0.16); return true; } // the cover: a board barely flexes
    book.phase = 'idle'; book.spread = 0;
    drawStack(ctx, sx, sy, 1); // the LEFT stack was masked all opening; the landing frame must complete the anatomy before the idle spread paints over it (audit F8 -- the handoff-frame family)
    // landed: FALL THROUGH to the idle draw -- the
    // final frame must paint the settled spread (stitch/dog-ears), not linger on
    // the last animation frame (the invisible-ribbon lesson)
  }
  if (book.phase === 'flip') {
    const t = Math.min(1, (now - book.t0) / BOOK.flipMs);
    const [nxtL, nxtR] = spreadCanvases(book, book.to, runRef);
    // base: the settled sides during the turn
    ctx.drawImage(book.dir > 0 ? curL : nxtL, sx - BOOK.pageW, sy);
    ctx.drawImage(book.dir > 0 ? nxtR : curR, sx, sy);
    // the leaf's shadow on whichever base it hangs over
    const sh = Math.sin(Math.PI * t), sc = Math.cos(Math.PI * t);
    ctx.fillStyle = `rgba(8,6,4,${0.3 * sh})`;
    if (sc > 0) ctx.fillRect(book.dir > 0 ? sx : sx - Math.round(BOOK.pageW * 0.9), sy, Math.round(BOOK.pageW * 0.9 * sc) + 4, BOOK.pageH);
    if (t < 1) { drawClothLeaf(ctx, book.dir > 0 ? curR : curL, book.dir > 0 ? nxtL : nxtR, sx, sy, book.dir, t, 0.6); return true; } // paper flows
    book.spread = book.to; book.phase = 'idle'; // landed: fall through to the idle draw
  }
  // idle spread (keeps animating while the bookmark settles)
  const [idlL, idlR] = spreadCanvases(book, book.spread, runRef);
  ctx.drawImage(idlL, sx - BOOK.pageW, sy);
  ctx.drawImage(idlR, sx, sy);
  ctx.fillStyle = css(BOOK.boardDark, 0.35); ctx.fillRect(sx - 3, sy, 6, BOOK.pageH); // the gutter's shade
  drawSpineStitch(ctx, sx, sy);
  // corner dog-ears: the flip affordances
  ctx.fillStyle = css(PAPER.shadowIn, 0.9);
  if (book.spread > 0) { ctx.fillRect(sx - BOOK.pageW + 2, sy + BOOK.pageH - 8, 7, 7); ctx.fillStyle = css(PAPER.bright); ctx.fillRect(sx - BOOK.pageW + 2, sy + BOOK.pageH - 8, 6, 1); }
  ctx.fillStyle = css(PAPER.shadowIn, 0.9);
  if (book.spread < spreadCount(book.pages) - 1) { ctx.fillRect(sx + BOOK.pageW - 9, sy + BOOK.pageH - 8, 7, 7); ctx.fillStyle = css(PAPER.bright); ctx.fillRect(sx + BOOK.pageW - 8 + 3, sy + BOOK.pageH - 8, 6, 1); }
  return !bookSettled(book); // frames keep flowing while the bookmark springs upright
}

// ── interactions (pure decisions; the host wires pointers) ────────────────────────────
export function openBook(book, now) { if (book.phase !== 'closed') return; book.open = true; book.phase = 'slide-in'; book.slide = 0; book.t0 = now; book._lastNow = 0; }
export function closeBook(book, now) { if (!book.open || book.phase === 'slide-out' || book.phase === 'slide-in' || book.phase === 'closing') return; finishFlip(book); book.phase = 'closing'; book.t0 = now; } // the cover flips shut FIRST (MAC), then the closed book slides down
/** Instant hard close -- no ceremony. Death and fresh runs trump the book (audit F16/F5). */
export function resetBook(book) { book.open = false; book.phase = 'closed'; book.slide = 0; book.spread = 0; invalidateSpread(book); }
/** Snap a mid-flight flip to its landing (tap-to-fast-forward: touch must never feel dead). */
export function finishFlip(book) {
  if (book.phase === 'flip') { book.spread = book.to; book.phase = 'idle'; }
  else if (book.phase === 'opening') { book.phase = 'idle'; book.spread = 0; }
  // 'closing' is not snapped: the shut must play (MAC's ceremony)
}
export function flipBook(book, dir, now) {
  if (book.phase !== 'idle') return false;
  const to = clampSpread(book.spread + dir, book.pages);
  if (to === book.spread) return false;
  book.phase = 'flip'; book.dir = dir; book.from = book.spread; book.to = to; book.t0 = now;
  return true;
}
/** Hit-test a pointer in book coords: 'cover-travel-outside' | { page, side, x, y } | 'outside' | null (the flip bands retired for tap-anywhere) */
export function bookHit(book, uiW, uiH, lx, ly) {
  const [sx, sy] = bookOrigin(uiW, uiH);
  if (book.phase === 'closed' || book.phase === 'slide-in' || book.phase === 'slide-out' || book.phase === 'closing') return 'outside'; // taps during travel only ever close
  if (lx < sx - BOOK.pageW - 6 || lx > sx + BOOK.pageW + 6 || ly < sy - 4 || ly > sy + BOOK.pageH + 8) return 'outside';
  // TAP ANYWHERE FLIPS (MAC): the host decides -- a tap on an item selects, any other
  // tap on a page turns it (left back, right forward). Reported in every open phase so a
  // mid-flight tap can fast-forward + chain.
  const side = lx < sx ? 0 : 1;
  const px = side ? lx - sx : lx - (sx - BOOK.pageW);
  return { page: book.spread * 2 + side, side, x: px - 8, y: ly - sy - 10 };
}
