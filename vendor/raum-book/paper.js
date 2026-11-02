// ── THE JOURNAL PAPER (MAC 2026-07-13): the UI's redesign foundation ─────────────────
// Panels open like ripped, stained paper -- a scruffed field journal carried through
// Raum. Maximum detail, all of it SEEDED + deterministic: the same panel tears the same
// way every open. Pure geometry generators feed ctx painters; the pure layer is tested,
// the painted layer is probed. Everything integer-snapped for the pixel world.
//
// The world is paper (CONCEPT, LOCKED) -- so the interface is the journal.
import { mix32 } from './rng.js';   // PORT: the hash beside this file (project-raum's engine/core/rng.js)
// (journalFont is no longer imported here: drawJournal + BODY served only drawInkText, and the
// bare `export { measureJournal }` re-export served nobody — both retired 2026-07-14. Anything
// needing journal text or metrics imports journalFont directly, as book.js and main.js already do.)

const h32 = (seed, k) => mix32((seed >>> 0) ^ Math.imul(k | 0, 2654435761));
const rnd = (seed, k) => h32(seed, k) / 4294967296; // 0..1
// 1D value noise, smooth-stepped between seeded lattice points
const noise1 = (seed, x, cell = 6) => {
  const i = Math.floor(x / cell), f = x / cell - i;
  const a = rnd(seed, i), b = rnd(seed, i + 1), t = f * f * (3 - 2 * f);
  return a + (b - a) * t;
};

// ── the journal's inks + papers (the panel body reads from here; PALETTE keeps the
//    chrome keys) ──
export const PAPER = {
  base: [216, 201, 168], // warm parchment
  fiber: [188, 170, 136], // darker flecks in the pulp
  bright: [232, 220, 194], // torn-fiber highlight along a fresh rip
  shadowIn: [156, 138, 108], // the tear's inner shadow
  stain: [150, 118, 74], // sepia wash
  stainRim: [116, 86, 50], // the coffee-ring's darker rim
  ink: [42, 32, 24], // the journal's ink
  inkFaded: [92, 76, 58],
  crease: [172, 154, 122],
  creaseLight: [230, 217, 190],
  dropShadow: 'rgba(8,6,4,0.45)',
  tape: [225, 214, 176], // aged tape strips
};
const css = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

// ── PURE GENERATORS (tested) ─────────────────────────────────────────────────────────

// the torn boundary: for each step along an edge of length `len`, the inward
// displacement in px -- a coarse wander + fine chatter + occasional deep bites
export function tearPath(seed, len, depth = 4) {
  const out = new Array(len);
  for (let x = 0; x < len; x++) {
    const coarse = noise1(seed, x, 9) * depth;
    const fine = noise1(seed ^ 0x9e37, x, 2.3) * 1.6;
    let d = coarse + fine;
    // deep bites: sparse seeded spots where a chunk ripped away
    const bite = rnd(seed ^ 0x51ab, Math.floor(x / 14));
    if (bite > 0.86) {
      const c = Math.floor(x / 14) * 14 + 7, r = 7;
      const dx = Math.abs(x - c);
      if (dx < r) d += (1 - dx / r) * depth * (0.8 + bite);
    }
    out[x] = Math.max(0, Math.round(d));
  }
  return out;
}

// stain placements: n seeded blotches within (w, h), each { x, y, r, kind, a }
export function stainSpots(seed, n, w, h) {
  const spots = [];
  for (let i = 0; i < n; i++) {
    const kind = rnd(seed, i * 7 + 3) < 0.45 ? 'ring' : rnd(seed, i * 7 + 4) < 0.6 ? 'blotch' : 'splatter';
    spots.push({
      x: Math.round(6 + rnd(seed, i * 7) * (w - 12)),
      y: Math.round(6 + rnd(seed, i * 7 + 1) * (h - 12)),
      r: Math.round(4 + rnd(seed, i * 7 + 2) * Math.min(w, h) * 0.16),
      kind,
      a: 0.16 + rnd(seed, i * 7 + 5) * 0.2,
    });
  }
  return spots;
}

// crease lines: 1-2 folds, each { axis: 'v'|'h', at } in local px
export function creaseLines(seed, w, h) {
  const n = 1 + (h32(seed, 77) & 1);
  const out = [];
  for (let i = 0; i < n; i++) {
    const axis = rnd(seed, 90 + i) < 0.6 ? 'v' : 'h';
    const span = axis === 'v' ? w : h;
    out.push({ axis, at: Math.round(span * (0.3 + rnd(seed, 95 + i) * 0.4)) });
  }
  return out;
}

// ── PAINTERS (probed) ────────────────────────────────────────────────────────────────

// per-pixel parchment: grain + low-freq mottle + fiber flecks, into an ImageData region
function paintPulp(ctx, x, y, w, h, seed) {
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const i = (py * w + px) * 4;
      const g = (h32(seed, px * 73856093 ^ py * 19349663) % 11) - 5; // grain ±5
      const mot = (noise1(seed ^ 0xa11, px + py * 0.7, 23) - 0.5) * 14; // slow mottle
      let r = PAPER.base[0] + g + mot, gr = PAPER.base[1] + g + mot, b = PAPER.base[2] + g + mot * 0.8;
      if (rnd(seed ^ 0xf1b, px * 31 + py * 57) > 0.986) { r = PAPER.fiber[0]; gr = PAPER.fiber[1]; b = PAPER.fiber[2]; } // pulp flecks
      d[i] = r; d[i + 1] = gr; d[i + 2] = b; d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, x, y);
}

// carve the torn silhouette out of a painted rect + lay the fiber highlight and inner
// shadow along every edge. Returns the per-edge tear paths (the border rule insets by them).
function carveTears(ctx, x, y, w, h, seed) {
  const top = tearPath(seed ^ 1, w), bot = tearPath(seed ^ 2, w), lef = tearPath(seed ^ 3, h), rig = tearPath(seed ^ 4, h);
  ctx.save();
  // carve: clear outside the torn boundary
  for (let px = 0; px < w; px++) {
    if (top[px]) ctx.clearRect(x + px, y, 1, top[px]);
    if (bot[px]) ctx.clearRect(x + px, y + h - bot[px], 1, bot[px]);
  }
  for (let py = 0; py < h; py++) {
    if (lef[py]) ctx.clearRect(x, y + py, lef[py], 1);
    if (rig[py]) ctx.clearRect(x + w - rig[py], y + py, rig[py], 1);
  }
  // the torn fiber highlight (the fresh white of a rip) + the inner shadow line
  for (let px = 0; px < w; px++) {
    ctx.fillStyle = css(PAPER.bright); ctx.fillRect(x + px, y + top[px], 1, 1);
    ctx.fillStyle = css(PAPER.shadowIn, 0.55); ctx.fillRect(x + px, y + top[px] + 1, 1, 1);
    ctx.fillStyle = css(PAPER.bright); ctx.fillRect(x + px, y + h - bot[px] - 1, 1, 1);
    ctx.fillStyle = css(PAPER.shadowIn, 0.4); ctx.fillRect(x + px, y + h - bot[px] - 2, 1, 1);
  }
  for (let py = 0; py < h; py++) {
    ctx.fillStyle = css(PAPER.bright); ctx.fillRect(x + lef[py], y + py, 1, 1);
    ctx.fillStyle = css(PAPER.shadowIn, 0.5); ctx.fillRect(x + lef[py] + 1, y + py, 1, 1);
    ctx.fillStyle = css(PAPER.bright); ctx.fillRect(x + w - rig[py] - 1, y + py, 1, 1);
    ctx.fillStyle = css(PAPER.shadowIn, 0.4); ctx.fillRect(x + w - rig[py] - 2, y + py, 1, 1);
  }
  ctx.restore();
  return { top, bot, lef, rig };
}

function paintStains(ctx, x, y, w, h, seed) {
  for (const s of stainSpots(seed ^ 0xcafe, 2 + (h32(seed, 5) % 3), w, h)) {
    if (s.kind === 'ring') {
      // the coffee ring: a broken darker annulus + a faint interior wash
      for (let a = 0; a < Math.PI * 2; a += 0.05) {
        if (noise1(seed ^ 0x51f, a * 40, 5) < 0.3) continue; // gaps in the ring
        const rr = s.r * (0.94 + noise1(seed ^ 0x33, a * 30, 4) * 0.12);
        ctx.fillStyle = css(PAPER.stainRim, s.a + 0.12);
        ctx.fillRect(x + Math.round(s.x + Math.cos(a) * rr), y + Math.round(s.y + Math.sin(a) * rr * 0.8), 1, 1);
      }
      ctx.fillStyle = css(PAPER.stain, s.a * 0.4);
      ctx.beginPath(); ctx.ellipse(x + s.x, y + s.y, s.r * 0.9, s.r * 0.72, 0, 0, Math.PI * 2); ctx.fill();
    } else if (s.kind === 'blotch') {
      // an irregular soaked blotch: stacked offset ellipses
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = css(PAPER.stain, s.a * (0.5 - i * 0.09));
        ctx.beginPath();
        ctx.ellipse(x + s.x + (rnd(seed, s.x + i) - 0.5) * s.r * 0.8, y + s.y + (rnd(seed, s.y + i) - 0.5) * s.r * 0.6,
          s.r * (1 - i * 0.18), s.r * (0.8 - i * 0.14), rnd(seed, i) * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // ink splatter: a tight cluster of dark dots + one flick
      for (let i = 0; i < 10; i++) {
        const dx = (rnd(seed, s.x * 3 + i) - 0.5) * s.r * 1.6, dy = (rnd(seed, s.y * 3 + i) - 0.5) * s.r * 1.2;
        const dr = rnd(seed, i * 11) < 0.2 ? 2 : 1;
        ctx.fillStyle = css(PAPER.ink, 0.35 + rnd(seed, i) * 0.3);
        ctx.fillRect(x + Math.round(s.x + dx), y + Math.round(s.y + dy), dr, dr);
      }
    }
  }
}

function paintCreases(ctx, x, y, w, h, seed) {
  for (const c of creaseLines(seed ^ 0xbeef, w, h)) {
    if (c.axis === 'v') {
      for (let py = 3; py < h - 3; py++) {
        const wob = Math.round((noise1(seed ^ 0x71, py, 12) - 0.5) * 2);
        ctx.fillStyle = css(PAPER.crease, 0.5); ctx.fillRect(x + c.at + wob, y + py, 1, 1);
        ctx.fillStyle = css(PAPER.creaseLight, 0.4); ctx.fillRect(x + c.at + wob + 1, y + py, 1, 1);
      }
    } else {
      for (let px = 3; px < w - 3; px++) {
        const wob = Math.round((noise1(seed ^ 0x72, px, 12) - 0.5) * 2);
        ctx.fillStyle = css(PAPER.crease, 0.5); ctx.fillRect(x + px, y + c.at + wob, 1, 1);
        ctx.fillStyle = css(PAPER.creaseLight, 0.4); ctx.fillRect(x + px, y + c.at + wob + 1, 1, 1);
      }
    }
  }
}

// the hand-wobbled ink border rule, inset past the tears
function paintInkRule(ctx, x, y, w, h, tears, seed, inset = 6) {
  ctx.fillStyle = css(PAPER.ink, 0.8);
  for (let px = inset; px < w - inset; px++) {
    const wobT = Math.round((noise1(seed ^ 0xa1, px, 7) - 0.5) * 2);
    const wobB = Math.round((noise1(seed ^ 0xa2, px, 7) - 0.5) * 2);
    if (noise1(seed ^ 0xa3, px, 30) > 0.12) ctx.fillRect(x + px, y + tears.top[px] + inset + wobT, 1, 1); // occasional gaps: a dry nib
    if (noise1(seed ^ 0xa4, px, 30) > 0.12) ctx.fillRect(x + px, y + h - tears.bot[px] - inset + wobB, 1, 1);
  }
  for (let py = inset; py < h - inset; py++) {
    const wobL = Math.round((noise1(seed ^ 0xa5, py, 7) - 0.5) * 2);
    const wobR = Math.round((noise1(seed ^ 0xa6, py, 7) - 0.5) * 2);
    if (noise1(seed ^ 0xa7, py, 30) > 0.12) ctx.fillRect(x + tears.lef[py] + inset + wobL, y + py, 1, 1);
    if (noise1(seed ^ 0xa8, py, 30) > 0.12) ctx.fillRect(x + w - tears.rig[py] - inset + wobR, y + py, 1, 1);
  }
}

function paintTape(ctx, x, y, w, seed, tears) {
  // two aged tape strips over the top corners, torn ends
  for (const side of [0, 1]) {
    const tw = 16 + (h32(seed, 200 + side) % 8), tx = side ? x + w - tw - 6 : x + 6;
    const ty = y + tears.top[side ? w - 10 : 10] - 3;
    ctx.fillStyle = css(PAPER.tape, 0.6);
    for (let px = 0; px < tw; px++) {
      const ragT = px < 2 || px > tw - 3 ? (h32(seed, px + side * 99) % 2) : 0;
      ctx.fillRect(tx + px, ty + ragT, 1, 8 - ragT * 2);
    }
    ctx.fillStyle = css(PAPER.bright, 0.35); ctx.fillRect(tx, ty, tw, 1); // the tape's sheen
  }
}

/**
 * The panel: a ripped, stained journal sheet. Everything derives from `seed`.
 * opts: { seed, stains=true, creases=true, rule=true, tape=false, shadow=true }
 */
export function drawPaperPanel(ctx, x, y, w, h, opts = {}) {
  const seed = (opts.seed ?? 7) >>> 0;
  x |= 0; y |= 0; w |= 0; h |= 0;
  if (opts.shadow !== false) { ctx.fillStyle = PAPER.dropShadow; ctx.fillRect(x + 3, y + 4, w, h); } // the sheet floats over the world
  paintPulp(ctx, x, y, w, h, seed);
  const tears = carveTears(ctx, x, y, w, h, seed);
  if (opts.stains !== false) paintStains(ctx, x, y, w, h, seed);
  if (opts.creases !== false) paintCreases(ctx, x, y, w, h, seed);
  if (opts.rule !== false) paintInkRule(ctx, x, y, w, h, tears, seed);
  if (opts.tape) paintTape(ctx, x, y, w, seed, tears);
  return tears; // callers lay content inside the tear insets
}


