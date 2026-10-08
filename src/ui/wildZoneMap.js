// @ts-check
// ═══════════════════════════════════════════════════════════════════
// WILD2 (2026-10-07, bible/11-Multiplayer/Wild-Zone.md section 6) - THE ZONE'S RINGS ON THE MAPS, AND ITS OWN MAP.
//
// The owner: "give the zone 4 levels from the outerside to the inside ... this needs to be also shown on the world map
// when clicking on this zone it opens its own extremely well made map same layout as the worldmap only wrothgarian
// mountain enlarged with its higher tiered loot zones".
//
// Two faces of one ink, both over the held map's world sheet (ui/heldMap.js):
//
//   ON THE WORLD MAP - the rings are three thin dashed lines inside the zone's red one (where each deeper ring begins,
//   systems/wildZone.js wildRingChains) and, once zoomed past the far band, each ring's bonus in a small red tag on the
//   column north from the heart (wildRingAnchors). The fog stays the zone's (ui/wildMapInk.js).
//
//   THE ZONE MAP - the same sheet, the same paper, the same marks, held to the Wrothgarian Mountains: the rest of the bay
//   sunk under a dark wash, each ring filled in its own tone (amber at the foothills to dried blood at the heart, the
//   paper's grain through it), its lines inked heavy, a plaque on each ring with its numeral, its name and its bonus,
//   the zone's places named, and a legend panel beside it in the held map's own plaque language (enhancedStyle.js
//   .hmwild): the rings, where I stand, and the zone's laws.
//
// Built once a mask, on a canvas of its own (as the fog is); nothing is computed per frame but the plaques' places.
// ═══════════════════════════════════════════════════════════════════
import {
  WILD_RINGS, WILD_NAME, wildRingAt, wildRingChains, wildRingAnchors, wildRingName, wildRingBonus, wildEdgeChains,
} from '../systems/wildZone.js';

/** Canvas pixels a map pixel in the rings' own canvas (the fog's own resolution). */
export const RING_RES = 6;
/** Each ring's inks, the foothills first: its fill (RGB), the fill's alpha on the zone map, its line and its tag. */
export const RING_INK = Object.freeze([
  // a graded ladder of old-map pigments - weathered gold, amber, rust, wine - kept soft so the paper reads through
  Object.freeze({ fill: [190, 164, 96], alpha: 0.30, line: 'rgba(104,80,36,0.9)', tag: '#7a5c24' }),
  Object.freeze({ fill: [206, 134, 64], alpha: 0.32, line: 'rgba(122,64,28,0.92)', tag: '#8a4a1e' }),
  Object.freeze({ fill: [170, 74, 54], alpha: 0.36, line: 'rgba(98,34,26,0.95)', tag: '#7a2a1e' }),
  Object.freeze({ fill: [96, 30, 52], alpha: 0.46, line: 'rgba(48,12,26,0.98)', tag: '#4a1426' }),
]);
export const RING_NUMERALS = Object.freeze(['I', 'II', 'III', 'IV']);
/** The wash over the rest of the bay on the zone map. */
export const ZONE_WASH = 'rgba(18,13,10,0.4)';
/** The legend panel's width on the paper (the view's fit leaves it this much room on the right). */
export const ZONE_LEGEND_W = 300;

/** A stable hash for the paper's grain, 0..1. */
function grain(x, y) {
  let h = (x * 73856093) ^ (y * 19349663);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/**
 * THE RINGS' PIXELS for a zone mask: `{ data, w, h, x0, y0 }` over the zone's box, RING_RES canvas pixels a map pixel -
 * each zone pixel its ring's fill at its ring's alpha, with a fine grain so the paper reads through. Pure (no canvas).
 */
export function ringPixels(mask, res = RING_RES) {
  if (!mask?.box) return null;
  const { x0, y0, x1, y1 } = mask.box;
  const mw = x1 - x0 + 1, mh = y1 - y0 + 1;
  const w = mw * res, h = mh * res;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let my = 0; my < mh; my++) {
    for (let mx = 0; mx < mw; mx++) {
      const ring = wildRingAt(x0 + mx, y0 + my, mask);
      if (!ring) continue;
      const ink = RING_INK[ring - 1];
      for (let sy = 0; sy < res; sy++) {
        for (let sx = 0; sx < res; sx++) {
          const px = mx * res + sx, py = my * res + sy;
          const g = grain(px, py) - 0.5;
          const o = (py * w + px) * 4;
          data[o] = ink.fill[0] + g * 18; data[o + 1] = ink.fill[1] + g * 14; data[o + 2] = ink.fill[2] + g * 10;
          data[o + 3] = Math.round(255 * Math.max(0, Math.min(1, ink.alpha + g * 0.08)));
        }
      }
    }
  }
  return { data, w, h, x0, y0 };
}

/** Chaikin's corner cutting on a closed chain of points, `n` times - a ring's line is a contour, not a pixel's edge. */
export function smoothChain(chain, n = 3) {
  let pts = chain.map((p) => ({ x: p.x, y: p.y }));
  if (pts.length > 1 && pts[0].x === pts.at(-1).x && pts[0].y === pts.at(-1).y) pts.pop();
  for (let k = 0; k < n && pts.length > 2; k++) {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      out.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 }, { x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
    }
    pts = out;
  }
  if (pts.length) pts.push({ ...pts[0] });
  return pts;
}

/**
 * SMOOTHZONE (the owner: "the zone how it is cut out right now smooth it better"): a ring's or the edge's contour as a
 * pen would draw it, not a pixel's staircase - the chain resampled to a fine, even step, relaxed (each point drawn toward
 * its neighbours' middle, which rounds every stair), then corner-cut. Closed chains only; anything shorter is kept.
 */
export function smoothContour(chain, { step = 0.6, relax = 10, cuts = 1 } = {}) {
  let pts = chain.map((p) => ({ x: p.x, y: p.y }));
  if (pts.length > 1 && pts[0].x === pts.at(-1).x && pts[0].y === pts.at(-1).y) pts.pop();
  if (pts.length < 4) return smoothChain(chain, 3);
  const dense = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const n = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / step));
    for (let k = 0; k < n; k++) dense.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n });
  }
  pts = dense;
  const N = pts.length;
  // TAUBIN's two steps a pass (a shrink by λ, a swell by μ): the staircase rounds away and the contour keeps its size - a
  // plain average pulls every convex run inward, and the red line crept off the zone's own edge
  const step2 = (k) => {
    const next = new Array(N);
    for (let i = 0; i < N; i++) {
      const a = pts[(i + N - 1) % N], b = pts[i], c = pts[(i + 1) % N];
      next[i] = { x: b.x + k * ((a.x + c.x) / 2 - b.x), y: b.y + k * ((a.y + c.y) / 2 - b.y) };
    }
    pts = next;
  };
  for (let pass = 0; pass < relax * 3; pass++) { step2(0.6); step2(-0.63); }
  const out = smoothChain([...pts, { ...pts[0] }], cuts);
  return out;
}

const _cache = new WeakMap();
/** The rings as a canvas, each deeper ring's line, the zone's edge and the plaques' anchors - built once a mask. */
export function zoneMapInk(mask, doc = globalThis.document) {
  if (!mask?.box) return null;
  const had = _cache.get(mask);
  if (had) return had;
  const px = ringPixels(mask);
  let canvas = null;
  if (px && doc?.createElement) {
    canvas = doc.createElement('canvas');
    canvas.width = px.w; canvas.height = px.h;
    const c = canvas.getContext('2d');
    if (c && typeof ImageData === 'function') c.putImageData(new ImageData(px.data, px.w, px.h), 0, 0);
  }
  const lines = {};
  for (let r = 2; r <= WILD_RINGS; r++) lines[r] = wildRingChains(mask, r).map((c) => smoothContour(c));
  const ink = {
    canvas, x0: mask.box.x0, y0: mask.box.y0, w: mask.box.x1 - mask.box.x0 + 1, h: mask.box.y1 - mask.box.y0 + 1,
    lines, edge: wildEdgeChains(mask).map((c) => smoothContour(c)), anchors: wildRingAnchors(mask),
  };
  _cache.set(mask, ink);
  return ink;
}

const paper = (view, x, y) => [(x - view.ox) * view.scale, (y - view.oy) * view.scale];
function tracePath(ctx, view, chains) {
  for (const c of chains) {
    for (let i = 0; i < c.length; i++) {
      const [x, y] = paper(view, c[i].x, c[i].y);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }
}

/** A tag or a plaque: a rounded box at paper (x, y), centred, with its lines. */
function plaque(ctx, x, y, lines, { fill = 'rgba(244,234,210,0.94)', edge = '#5e0c08', pad = 6, gap = 2 } = {}) {
  let w = 0, h = pad * 2 - gap;
  for (const l of lines) { ctx.font = l.font; w = Math.max(w, ctx.measureText(l.text).width); h += l.size + gap; }
  w += pad * 2;
  const bx = Math.round(x - w / 2), by = Math.round(y - h / 2), r = 3;
  ctx.beginPath();
  ctx.moveTo(bx + r, by); ctx.lineTo(bx + w - r, by); ctx.quadraticCurveTo(bx + w, by, bx + w, by + r);
  ctx.lineTo(bx + w, by + h - r); ctx.quadraticCurveTo(bx + w, by + h, bx + w - r, by + h);
  ctx.lineTo(bx + r, by + h); ctx.quadraticCurveTo(bx, by + h, bx, by + h - r);
  ctx.lineTo(bx, by + r); ctx.quadraticCurveTo(bx, by, bx + r, by);
  ctx.closePath();
  ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 1;
  ctx.fillStyle = fill; ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  ctx.lineWidth = 1.5; ctx.strokeStyle = edge; ctx.stroke();
  let ty = by + pad;
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  for (const l of lines) { ctx.font = l.font; ctx.fillStyle = l.color; ctx.fillText(l.text, x, ty); ty += l.size + gap; }
  return { x: bx, y: by, w, h };
}

/**
 * THE RINGS ON THE WORLD MAP: each deeper ring's line, dashed, inside the red one; past the far band each ring's bonus
 * in a small tag. In paper pixels (the sheet's dpr transform already set). Nothing when the zone is off the paper.
 */
export function paintWildRings(ctx, view, ink, { paperW, paperH, far = false }) {
  if (!ink || !view) return;
  const [ax, ay] = paper(view, ink.x0, ink.y0);
  if (ax > paperW || ay > paperH || ax + ink.w * view.scale < 0 || ay + ink.h * view.scale < 0) return;
  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  for (let r = 2; r <= WILD_RINGS; r++) {
    ctx.beginPath(); tracePath(ctx, view, ink.lines[r] ?? []);
    ctx.setLineDash([Math.max(2, view.scale * 0.5), Math.max(2, view.scale * 0.45)]);
    ctx.strokeStyle = RING_INK[r - 1].line; ctx.lineWidth = Math.max(0.8, Math.min(2, view.scale * 0.2)); ctx.stroke();
  }
  ctx.setLineDash([]);
  // PVPDUNGEONS (the owner: "The 25%,50,75,100% marker shown on the world map when not clicking on the zone have to be
  // removed"): the rings' lines alone here - the zone map and its legend name each ring and its bonus
  ctx.restore();
}

/**
 * THE ZONE MAP'S STATIC INK, in two parts round the world sheet's own (heldMap.js): `under` the marks - the rings'
 * fills and their lines, heavy (the zone's fog and red line follow, ui/wildMapInk.js); `over` them - the wash over
 * everything outside the zone (its marks sunk with it), then the zone's places named. `places` are `{ x, y, name, kind }`
 * in map pixels (inkMap.js markKind's kinds), the zone's own (the caller filters).
 */
export function paintZoneMapStatic(ctx, view, ink, { paperW, paperH, places = [], part = 'under', zoom = 1 }) {
  if (!ink || !view) return;
  ctx.save();
  if (part === 'under') {
    // ZONEINK2 (the owner: "The tier colors when zoomed in on the zone map are overwriting the map too much make it look
    // waaaay more high quality and take care of the performance"): the tiers are a WASH, not paint - a light watercolour
    // tint per tier, laid with `multiply` so the sheet's own relief, roads and grain read straight through it, each tier a
    // touch deeper toward the heart with a soft shade inside its border. All of it is drawn ONCE a mask into a canvas of
    // its own (tierWash); a frame is one drawImage and the tiers' thin lines.
    const wash = tierWash(ink);
    if (wash) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.imageSmoothingEnabled = true;
      try { ctx.imageSmoothingQuality = 'high'; } catch { /* an older canvas */ }
      const [ax, ay] = paper(view, ink.x0 - wash.pad, ink.y0 - wash.pad);
      ctx.drawImage(wash.canvas, ax, ay, (wash.canvas.width / wash.res) * view.scale, (wash.canvas.height / wash.res) * view.scale);
      ctx.globalCompositeOperation = 'source-over';
    }
    // the tiers' borders: a soft dark rule with a parchment hairline beside it - an engraver's line, never a marker's
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (let r = 2; r <= WILD_RINGS; r++) {
      ctx.beginPath(); tracePath(ctx, view, ink.lines[r] ?? []);
      ctx.strokeStyle = 'rgba(250,242,222,0.55)'; ctx.lineWidth = Math.max(1.6, Math.min(3, view.scale * 0.22)); ctx.stroke();
      ctx.strokeStyle = RING_INK[r - 1].line; ctx.lineWidth = Math.max(0.8, Math.min(1.5, view.scale * 0.1));
      ctx.setLineDash([Math.max(6, view.scale * 1.1), Math.max(3, view.scale * 0.45)]); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
    return;
  }
  // the bay sunk: the paper's rectangle with the zone cut out of it
  ctx.beginPath();
  ctx.rect(0, 0, paperW, paperH);
  tracePath(ctx, view, ink.edge);
  ctx.fillStyle = ZONE_WASH;
  ctx.fill('evenodd');
  // the zone's places, haloed, and never one over another
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  // the plaques' room first (paintZoneMapPlaques stands them at the anchors), so no name runs under one
  const taken = [];   // ZONEINK2: the rings' plaques are gone from the zone map (its legend names each ring)
  const townish = (k) => k === 'city' || k === 'village' || k === 'hamlet';
  // ZONEINK2 (the owner: "dont show all location names from the beginning when you zoom in"): the names come in with the
  // zoom - the cities at the zone's own fit, the towns from half again, every other place from twice it
  const shownAt = (k) => (k === 'city' ? 0 : townish(k) ? ZONE_NAMES_TOWNS : ZONE_NAMES_ALL);
  const vis = places.filter((p) => zoom >= shownAt(p.kind));
  const big = vis.filter((p) => p.kind === 'city').concat(vis.filter((p) => p.kind !== 'city' && townish(p.kind)), vis.filter((p) => !townish(p.kind)));
  for (const p of big) {
    const [x, y] = paper(view, p.x, p.y);
    if (x < 0 || y < 0 || x > paperW || y > paperH || !p.name) continue;
    const size = p.kind === 'city' ? 14 : townish(p.kind) ? 12 : 11;
    ctx.font = `${p.kind === 'dungeon' ? 'italic ' : ''}600 ${size}px 'Cormorant', Georgia, serif`;
    const w = ctx.measureText(p.name).width;
    const box = { x: x + 7, y: y - size / 2, w, h: size };
    if (taken.some((t) => box.x < t.x + t.w + 4 && t.x < box.x + box.w + 4 && box.y < t.y + t.h + 2 && t.y < box.y + box.h + 2)) continue;
    taken.push(box);
    ctx.lineJoin = 'round'; ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(244,234,210,0.88)'; ctx.strokeText(p.name, box.x, y);
    ctx.fillStyle = p.kind === 'dungeon' ? '#4a1410' : '#2a1c12'; ctx.fillText(p.name, box.x, y);
  }
  ctx.restore();
}

/** THE ZONE MAP'S PLAQUES (the overlay: they stand over every mark) - a numeral, a name and a bonus on each ring;
 *  the ring I stand in edged in gold. */
export function paintZoneMapPlaques(ctx, view, ink, { paperW, paperH, mine = 0 }) {
  if (!ink || !view) return;
  ctx.save();
  const pts = ink.anchors.map((a) => ({ a, p: paper(view, a.x, a.y) }));
  // the plaques' room: the nearest two anchors apart on the paper - a small sheet (a phone's) names each ring on one line,
  // a smaller one in a tag, so no plaque stands over another
  let gap = Infinity;
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) gap = Math.min(gap, Math.abs(pts[i].p[1] - pts[j].p[1]) + Math.abs(pts[i].p[0] - pts[j].p[0]) * 0.25);
  const size = gap >= 46 ? 'full' : gap >= 22 ? 'line' : 'tag';
  for (const { a, p: [x, y] } of pts) {
    if (x < -80 || y < -40 || x > paperW + 80 || y > paperH + 40) continue;
    const i = a.ring - 1;
    const edge = a.ring === mine ? '#c08a3e' : RING_INK[i].tag;
    if (size === 'full') {
      plaque(ctx, x, y, [
        { text: `${RING_NUMERALS[i]} · ${wildRingName(a.ring).toUpperCase()}`, font: "700 11px 'Cormorant', Georgia, serif", size: 11, color: '#2a1c12' },
        { text: wildRingBonus(a.ring), font: "700 13px 'Cormorant', Georgia, serif", size: 13, color: RING_INK[i].tag },
      ], { edge, pad: 6 });
    } else {
      const text = size === 'line' ? `${RING_NUMERALS[i]} · ${wildRingBonus(a.ring)}` : wildRingBonus(a.ring).replace(' loot', '');
      plaque(ctx, x, y, [{ text, font: `700 ${size === 'line' ? 11 : 10}px 'Cormorant', Georgia, serif`, size: size === 'line' ? 11 : 10, color: RING_INK[i].tag }], { edge, pad: size === 'line' ? 4 : 3, gap: 0 });
    }
  }
  ctx.restore();
}

/** ZONEINK2: the zoom (the view's scale over the zone map's own fit) at which the towns' names come in, and every place's. */
export const ZONE_NAMES_TOWNS = 1.5;
export const ZONE_NAMES_ALL = 2.2;
/** ZONEINK2: each tier's wash, a light pigment laid with `multiply` (white leaves the sheet as it is) - aged ochre, amber,
 *  madder, and a muted wine at the heart - and the deeper shade inside its border. */
export const TIER_WASH = Object.freeze([
  // TIER-SWATCH (the owner: "the tiered colors in the legend look way too similiar"): four pigments apart from each
  // other on the map and in the legend alike - sand, amber, madder rose and plum, each deeper than the last
  Object.freeze({ fill: [250, 238, 200], shade: [214, 188, 122] }),
  Object.freeze({ fill: [250, 212, 156], shade: [214, 150, 84] }),
  Object.freeze({ fill: [242, 172, 156], shade: [196, 104, 92] }),
  Object.freeze({ fill: [204, 160, 214], shade: [140, 88, 150] }),
]);
const WASH_PX_MAX = 3_000_000;
/** The parchment the wash is laid on (ui/inkMap.js PARCHMENT_RGB). */
const WASH_PAPER = Object.freeze([238, 222, 190]);
/** TIER-SWATCH: a tier's colour as the map shows it - `{ fill, edge }` CSS colours, the wash and its shade multiplied on
 *  the parchment. */
export function tierSwatch(r) {
  const t = TIER_WASH[Math.max(1, Math.min(WILD_RINGS, r | 0 || 1)) - 1];
  const mul = (c) => `rgb(${c.map((v, i) => Math.round((v * WASH_PAPER[i]) / 255)).join(',')})`;
  return { fill: mul(t.fill), edge: mul(t.shade) };
}
/** The tiers' wash, drawn once a mask (kept on the ink): `{ canvas, res, pad }`, or null without a document. */
export function tierWash(ink, doc = globalThis.document) {
  if (ink._wash !== undefined) return ink._wash;
  ink._wash = null;
  if (!doc?.createElement) return null;
  const pad = 2;
  let res = 12;
  while (res > 3 && (ink.w + pad * 2) * (ink.h + pad * 2) * res * res > WASH_PX_MAX) res -= 1;
  const canvas = doc.createElement('canvas');
  canvas.width = Math.ceil((ink.w + pad * 2) * res); canvas.height = Math.ceil((ink.h + pad * 2) * res);
  const c = canvas.getContext('2d');
  if (!c) return null;
  const v = { ox: ink.x0 - pad, oy: ink.y0 - pad, scale: res };
  const ring = (r) => (r === 1 ? ink.edge : (ink.lines[r] ?? []));
  for (let r = 1; r <= WILD_RINGS; r++) {
    const t = TIER_WASH[r - 1];
    c.beginPath(); tracePath(c, v, ring(r));
    c.fillStyle = `rgb(${t.fill.join(',')})`; c.fill('evenodd');
  }
  // the shade inside each tier's border: its own contour stroked through a wide blur, clipped to the tier, once
  for (let r = 1; r <= WILD_RINGS; r++) {
    const t = TIER_WASH[r - 1];
    c.save();
    c.beginPath(); tracePath(c, v, ring(r)); c.clip('evenodd');
    c.beginPath(); tracePath(c, v, ring(r));
    c.shadowColor = `rgba(${t.shade.join(',')},0.9)`; c.shadowBlur = res * 1.6;
    c.strokeStyle = `rgba(${t.shade.join(',')},0.55)`; c.lineWidth = res * 0.35;
    c.lineJoin = 'round'; c.stroke();
    c.restore();
  }
  // a fine paper tooth through the whole wash (a pigment pools in the grain), off the same stable hash as the fog's
  const img = c.getImageData(0, 0, canvas.width, canvas.height), d = img.data;
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const i = (y * canvas.width + x) * 4;
      if (d[i + 3] === 0) continue;
      const g = (grain(x >> 1, y >> 1) - 0.5) * 10;
      d[i] = Math.max(0, Math.min(255, d[i] + g)); d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + g)); d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + g));
    }
  }
  c.putImageData(img, 0, 0);
  ink._wash = { canvas, res, pad };
  return ink._wash;
}

/** The view that holds the whole zone on the paper, its box padded, centred in the room the legend leaves. */
export function zoneMapView(mask, { paperW, paperH, legendW = ZONE_LEGEND_W }) {
  if (!mask?.box) return null;
  const { x0, y0, x1, y1 } = mask.box;
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1, pad = 3;
  const room = Math.max(paperW * 0.5, paperW - (paperW > 720 ? legendW : 0));
  const scale = Math.min(room / (bw + pad * 2), paperH / (bh + pad * 2));
  const cx = x0 + bw / 2, cy = y0 + bh / 2;
  return { ox: cx - room / (2 * scale), oy: cy - paperH / (2 * scale), scale };
}
/** The zone map's limits for the window's clamp (ui/inkMap.js clampView): its box with a band of the bay round it. */
export function zoneMapLimits(mask, { paperW, paperH, legendW = ZONE_LEGEND_W }) {
  if (!mask?.box) return null;
  const { x0, y0, x1, y1 } = mask.box;
  const pad = 6;
  const room = Math.max(paperW * 0.5, paperW - (paperW > 720 ? legendW : 0));
  return { mapW: (x1 - x0 + 1 + pad * 2) * (paperW / room), mapH: y1 - y0 + 1 + pad * 2, paperW, paperH, pan: { x0: x0 - pad, y0: y0 - pad, x1: x1 + 1 + pad, y1: y1 + 1 + pad } };
}

/** The zone's laws, as the legend states them. */
export const ZONE_RULES = Object.freeze([
  'Other players may attack you - only your party and your guild are shown to you here.',
  'Foes are four times as strong - elites and champions too.',
  'Two Greater Giants roam every tier - each shown on the map where it walks.',
  'A death drops what you carry for ten minutes; potions, torches and the camp kit are kept.',
  'Carriages run inside the zone at increased prices, once every ten minutes.',
  'No fast travel into or out of the zone - walk or ride (the Overworld map excepted).',
  'Travel here is slower: at most 20x in the wilds, 40x on the roads.',
]);

/**
 * THE LEGEND PANEL - `doc`'s element, in the held map's plaque language (enhancedStyle.js .hmwild*): the zone's name,
 * its four rings (swatch, numeral, name, bonus; mine marked), where I stand, its laws, and the way back. `onBack` the
 * Back button's act. Pure DOM: the window mounts it and takes it away.
 */
export function buildZoneLegend(doc, { ring = 0, onBack = null, names = true, onNames = null, canBegin = false, onBegin = null } = {}) {
  const el = (tag, cls, text) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const root = el('div', 'hmwild');
  root.addEventListener?.('pointerdown', (e) => e.stopPropagation?.());
  root.addEventListener?.('wheel', (e) => e.stopPropagation?.());
  const head = el('div', 'hmwild-head');
  head.append(el('div', 'hmwild-kicker', 'Open PvP zone'), el('div', 'hmwild-title', WILD_NAME));
  root.append(head);
  const where = el('div', `hmwild-where${ring ? ' in' : ''}`, ring ? `You stand in ${RING_NUMERALS[ring - 1]} · ${wildRingName(ring)} - ${wildRingBonus(ring)}` : 'You stand outside the zone');
  root.append(where);
  const list = el('ol', 'hmwild-rings');
  for (let r = 1; r <= WILD_RINGS; r++) {
    const li = el('li', `hmwild-ring${r === ring ? ' mine' : ''}`);
    const sw = el('span', 'hmwild-sw');
    // TIER-SWATCH (2026-10-08, the owner: "change the tier colors accordingly to the map in the legend"): the swatch is
    // the tier AS THE MAP SHOWS IT - its wash laid with multiply on the parchment, its border the shade inside its edge
    const sw2 = tierSwatch(r);
    sw.style.background = sw2.fill;
    sw.style.borderColor = sw2.edge;
    const name = el('span', 'hmwild-rname');
    name.append(el('b', null, RING_NUMERALS[r - 1]), doc.createTextNode(` ${wildRingName(r)}`));
    const depth = el('span', 'hmwild-depth', r === 1 ? 'the outer quarter' : r === WILD_RINGS ? 'the heart' : `${r === 2 ? 'second' : 'third'} quarter in`);
    li.append(sw, name, el('span', 'hmwild-bonus', wildRingBonus(r)), depth);
    list.append(li);
  }
  root.append(list);
  // LEGEND-FIT (the owner: "now i have to scroll down in the legend for begin journy make it so that i dont have to do
  // that"): the laws scroll in their own box, the buttons stand in a foot that is always in view - Begin journey first
  const rules = el('ul', `hmwild-rules${canBegin ? ' trip' : ''}`);
  for (const t of ZONE_RULES) rules.append(el('li', null, t));
  root.append(rules);
  const foot = el('div', 'hmwild-foot');
  root.append(foot);
  // PVPJOURNEY: a press on the zone's ground gives the Begin journey button - at the top of the foot, always in view
  if (canBegin) {
    const go = el('button', 'act hmwild-back hmwild-go', 'Begin journey');
    go.type = 'button'; go.tabIndex = -1;
    go.onpointerdown = (e) => e.preventDefault?.();
    go.onclick = () => onBegin?.();
    foot.append(go);
  }
  const nm = el('button', 'act hmwild-back', names ? 'Hide place names' : 'Show place names');
  nm.type = 'button'; nm.tabIndex = -1;
  nm.onpointerdown = (e) => e.preventDefault?.();
  nm.onclick = () => onNames?.();
  foot.append(nm);
  const back = el('button', 'act hmwild-back', 'World map');
  back.type = 'button'; back.tabIndex = -1;
  back.onpointerdown = (e) => e.preventDefault?.();
  back.onclick = () => onBack?.();
  foot.append(back);
  return root;
}
