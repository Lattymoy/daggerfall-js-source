// @ts-check
// THE NEW ERA'S WHITE CANVAS ON THE PAGE: a canvas of its own over the game's, as the gate's veil (ui/gate/gateVeil.js),
// drawn by the show's host each frame. It lies over every pass of the frame: a blast's flash, the picture cracking,
// its shards peeling to white, the white held, the voice's words, and the world coming back through it. Over the
// world and its HUD, under the chat, no pointer. It hides itself when no frame has drawn it for a moment, so a step
// indoors, whose frames never reach the show, never leaves the picture white.
import { NEWERA_PAPER, NEWERA_PAPER_FOLD, NEWERA_INK, newEraShards, newEraPeelOf } from '../world/newEraEvent.js';

/** The canvas's place on the page: over the world and its HUD, under the chat (the veil's layer). */
export const NEWERA_CANVAS_CSS = 'position:fixed;left:0;top:0;width:100%;height:100%;z-index:4;pointer-events:none;';
/** Milliseconds without a frame's drawing before the canvas hides itself. */
export const NEWERA_CANVAS_IDLE_MS = 300;
/** The canvas is at most this many pixels wide: what it draws is flat and soft. */
export const NEWERA_CANVAS_MAX_W = 1600;
/** How far a peeling shard's flap reaches past its fold, against the part already peeled. */
export const NEWERA_FLAP = 0.55;
/** The share of the screen's cracking an edge of a shard takes to crack across. */
export const NEWERA_EDGE_S = 0.4;

const rgb = (colour, alpha = 1) =>
  `rgba(${colour.map((part) => Math.round(part * 255)).join(', ')}, ${Math.max(0, Math.min(1, alpha))})`;

/** Keep the part of a convex polygon where its points' projection on `way` is below `cut` (or above it, `above`). */
function keepSide(poly, way, cut, above) {
  const out = [];
  const side = (point) => (point[0] * way[0] + point[1] * way[1] - cut) * (above ? -1 : 1);
  for (let i = 0; i < poly.length; i++) {
    const here = poly[i],
      next = poly[(i + 1) % poly.length];
    const sideHere = side(here),
      sideNext = side(next);
    if (sideHere <= 0) out.push(here);
    if (sideHere <= 0 !== sideNext <= 0) {
      const k = sideHere / (sideHere - sideNext);
      out.push([here[0] + (next[0] - here[0]) * k, here[1] + (next[1] - here[1]) * k]);
    }
  }
  return out;
}

/**
 * HOW ONE SHARD LIES at a peel of `k` (0..1), its polygon `poly` in pixels and its fold travelling along the unit `way`:
 * `{ revealed, flap, fold }` - `revealed` the part already peeled off (white shows there), `flap` that part folded back
 * over the rest and curled short (NEWERA_FLAP), and `fold` the fold line's projection on `way`. Pure.
 * @param {number[][]} poly @param {number[]} way @param {number} k
 */
export function newEraPeelShape(poly, way, k) {
  const along = poly.map((point) => point[0] * way[0] + point[1] * way[1]);
  const low = Math.min(...along),
    high = Math.max(...along);
  const fold = low + (high - low) * Math.max(0, Math.min(1, k));
  const revealed = keepSide(poly, way, fold, false);
  const flap = revealed.map((point) => {
    const back = (fold - (point[0] * way[0] + point[1] * way[1])) * (1 + NEWERA_FLAP);
    return [point[0] + way[0] * back, point[1] + way[1] * back];
  });
  return { revealed, flap, fold };
}

/**
 * The New Era's canvas. `opts.doc` / `opts.win` / the timers stand in for the page's under a test.
 * @param {{ doc?: any, win?: any, setTimer?: (fn: () => void, delay: number) => any, clearTimer?: (id: any) => void }} [opts]
 */
export function createNewEraCanvas({
  doc = globalThis.document,
  win = globalThis.window,
  setTimer = (fn, delay) => setTimeout(fn, delay),
  clearTimer = (id) => clearTimeout(id),
} = {}) {
  /** @type {any} */
  let canvas = null,
    ctx = null;
  let idle = null;
  let shards = null,
    shardSeed = NaN;
  let visible = false;

  const hide = () => {
    if (idle !== null) clearTimer(idle);
    idle = null;
    if (canvas && visible) canvas.style.display = 'none';
    visible = false;
  };
  const make = () => {
    if (canvas || !doc?.createElement) return !!canvas;
    try {
      canvas = doc.createElement('canvas');
      canvas.style.cssText = NEWERA_CANVAS_CSS;
      canvas.setAttribute?.('aria-hidden', 'true');
      doc.body?.appendChild?.(canvas);
      ctx = canvas.getContext?.('2d') ?? null;
    } catch {
      canvas = null;
      ctx = null;
    }
    return !!ctx;
  };
  const fit = () => {
    const cssW = Math.max(1, win?.innerWidth ?? 1280),
      cssH = Math.max(1, win?.innerHeight ?? 720);
    const scale = Math.min(1, NEWERA_CANVAS_MAX_W / cssW);
    const width = Math.round(cssW * scale),
      height = Math.round(cssH * scale);
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    return [width, height];
  };
  const path = (poly) => {
    ctx.beginPath();
    poly.forEach((point, i) => (i ? ctx.lineTo(point[0], point[1]) : ctx.moveTo(point[0], point[1])));
    ctx.closePath();
  };

  /** The shards: each its pixels, its way in pixels and how far it has peeled. */
  const drawShards = (state, width, height) => {
    if (shardSeed !== state.seed || !shards) {
      shards = newEraShards(state.seed);
      shardSeed = state.seed;
    }
    const cracks = [];
    for (const shard of shards) {
      const poly = shard.poly.map((point) => [point[0] * width, point[1] * height]);
      const k = newEraPeelOf(shard, state.peel);
      if (k >= 1) {
        path(poly);
        ctx.fillStyle = '#fff';
        ctx.fill();
        continue;
      }
      if (state.screenCrack > 0)
        cracks.push({ poly, open: Math.min(1, (state.screenCrack - shard.delay) / NEWERA_EDGE_S) });
      if (k <= 0) continue;
      const wayX = shard.way[0] * width,
        wayY = shard.way[1] * height,
        len = Math.hypot(wayX, wayY) || 1;
      const way = [wayX / len, wayY / len];
      const shape = newEraPeelShape(poly, way, k);
      if (shape.revealed.length >= 3) {
        path(shape.revealed);
        ctx.fillStyle = '#fff';
        ctx.fill();
        const reach = Math.max(1, ...shape.flap.map((point) => point[0] * way[0] + point[1] * way[1] - shape.fold));
        const foldAt = [way[0] * shape.fold, way[1] * shape.fold];
        const paper = ctx.createLinearGradient(
          foldAt[0],
          foldAt[1],
          foldAt[0] + way[0] * reach,
          foldAt[1] + way[1] * reach,
        );
        paper.addColorStop(0, rgb(NEWERA_PAPER_FOLD));
        paper.addColorStop(0.35, rgb(NEWERA_PAPER));
        paper.addColorStop(1, rgb(NEWERA_PAPER.map((part) => part * 0.96)));
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
        ctx.shadowBlur = 10;
        path(shape.flap);
        ctx.fillStyle = paper;
        ctx.fill();
        ctx.restore();
      }
    }
    if (!cracks.length) return;
    const edges = new CrackLines(ctx);
    for (const { poly, open } of cracks) {
      if (open <= 0) continue;
      for (let i = 0; i < poly.length; i++) {
        const from = poly[i],
          to = poly[(i + 1) % poly.length];
        const onBorder = (axis, edge) => Math.abs(from[axis] - edge) < 0.5 && Math.abs(to[axis] - edge) < 0.5;
        if (onBorder(0, 0) || onBorder(0, width) || onBorder(1, 0) || onBorder(1, height)) continue;
        edges.line(from, [from[0] + (to[0] - from[0]) * open, from[1] + (to[1] - from[1]) * open]);
      }
    }
    edges.stroke('rgba(10, 8, 6, 0.6)', 3.2);
    edges.stroke('rgba(255, 255, 255, 0.95)', 1.2);
  };

  /** The white held, and in the dawn the world coming back through it from the middle out. */
  const drawWhite = (white, width, height) => {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    if (white >= 1) return;
    const diag = Math.hypot(width, height),
      hole = (1 - white) * diag * 0.8,
      edge = diag * 0.25;
    const gone = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, hole + edge);
    gone.addColorStop(0, 'rgba(0, 0, 0, 1)');
    gone.addColorStop(hole / (hole + edge), 'rgba(0, 0, 0, 1)');
    gone.addColorStop(1, `rgba(0, 0, 0, ${1 - white})`);
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = gone;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  };

  /** The voice's phrases, one a line, in the middle of the canvas. */
  const drawWords = (caption, width, height) => {
    const size = Math.round(Math.min(width, height) * 0.075);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(size * 0.12)}px`;
    caption.forEach((phrase, i) => {
      if (!(phrase.alpha > 0.001) || !phrase.text) return;
      const grown = Math.round(size * (1.06 - 0.06 * phrase.alpha));
      ctx.font = `600 ${grown}px "Times New Roman", Georgia, serif`;
      ctx.fillStyle = rgb(NEWERA_INK, phrase.alpha);
      ctx.fillText(phrase.text, width / 2, height * (0.44 + 0.13 * i));
    });
    ctx.restore();
  };

  return {
    /**
     * Draw a frame: `state` `{ weight, flash, screenCrack, peel, white, caption: [{ text, alpha }], seed }`, each 0..1
     * but the seed. True when it drew; nothing to draw, it hides. The host calls it every frame the show is framed.
     */
    draw(state) {
      const weight = Math.max(0, Math.min(1, state?.weight ?? 0));
      const caption = state?.caption ?? [];
      const any =
        (state?.flash ?? 0) > 0.002 ||
        (state?.screenCrack ?? 0) > 0 ||
        (state?.peel ?? 0) > 0 ||
        (state?.white ?? 0) > 0.002 ||
        caption.some((phrase) => phrase.alpha > 0.001);
      if (!(weight > 0.001) || !any) {
        hide();
        return false;
      }
      if (!make()) return false;
      const [width, height] = fit();
      if (!visible) canvas.style.display = '';
      visible = true;
      if (idle !== null) clearTimer(idle);
      idle = setTimer(hide, NEWERA_CANVAS_IDLE_MS);
      ctx.clearRect(0, 0, width, height);
      ctx.globalAlpha = weight;
      if (state.white > 0.002) drawWhite(state.white, width, height);
      else if (state.peel > 0 || state.screenCrack > 0) drawShards(state, width, height);
      if (caption.length) drawWords(caption, width, height);
      if (state.flash > 0.002) {
        ctx.globalAlpha = weight * Math.min(1, state.flash);
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, width, height);
      }
      ctx.globalAlpha = 1;
      return true;
    },
    hide,
    /** The page's canvas, once made (null before). */
    get element() {
      return canvas;
    },
    get visible() {
      return visible;
    },
    /** EVERY ALLOCATION HAS AN OWNER: the canvas off the page, its timer let go. */
    dispose() {
      hide();
      canvas?.remove?.();
      canvas = null;
      ctx = null;
    },
  };
}

/** Many line segments in one path, stroked as one: the cracks of every shard at once. */
class CrackLines {
  constructor(ctx) {
    this.ctx = ctx;
    this.segments = [];
  }
  line(from, to) {
    this.segments.push(from, to);
  }
  stroke(style, width) {
    const ctx = this.ctx;
    ctx.beginPath();
    for (let i = 0; i < this.segments.length; i += 2) {
      ctx.moveTo(this.segments[i][0], this.segments[i][1]);
      ctx.lineTo(this.segments[i + 1][0], this.segments[i + 1][1]);
    }
    ctx.strokeStyle = style;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.stroke();
  }
}
