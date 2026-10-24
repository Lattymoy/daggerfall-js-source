// @ts-check
// HOME-VENDOR (Mac: "is there a worldmap vendor waypoint" - "yeah that would be great"): THE TRADER'S WAYPOINT, ON BOTH
// WORLD MAPS - its own mark, apart from the map's one yellow mark (a town the player marked stays marked).
//
// The host hands the maps a FUNCTION (`vendor: () => mark|null`, beside BOUNTY1's `bounties`) and neither map learns
// what a trader is: a mark is a map pixel and its words - `{ px, py, label, town }` (systems/vendorWaypoint.js, the town
// found by its map id). The held map (ink) draws a gold COIN on a pin above the town, the trader's house named beside it
// (paintVendorMark); the classic region page writes a gold ring round the town into its texels (vendorRingTexels -
// the gate's ring's own law, as the bounties' is), on the open province's pixels only.
//
// Not a DFU member.
import { gateRingTexels } from '../gate/gateMapMark.js';

/** The coin's gold, its rim, the classic page's texel and the legend's words. Gold: the quests' diamond is a darker
 *  amber and the bounty's ring black; this is the brightest thing on the sheet, and it is money. */
export const VENDOR_MARK_CSS = '#f0c75a';
export const VENDOR_RIM_CSS = '#5a3a0e';
export const VENDOR_DOT_RGB = Object.freeze([240, 199, 90]);
export const VENDOR_LEGEND_TEXT = 'Trader waypoint';
/** The classic page's ring, map pixels - a pixel wider than a bounty's, so the two never read as one. */
export const VENDOR_RING_R = 2.5;
/** How far over its town the coin stands, paper pixels (over a quest's diamond, which stands at 17). */
export const VENDOR_MARK_LIFT = 34;
/** The coin's radius, paper pixels. */
export const VENDOR_COIN_R = 10;
const LABEL_MAX = 48;

/**
 * The host's mark, read and checked - null for none, a throw, or a pixel the map could not place.
 * @param {(() => any) | undefined} fn
 * @param {{width:number, height:number}} size the map, in pixels
 * @returns {{ key: string, px: number, py: number, x: number, y: number, cx: number, cy: number, r: number, label: string, town: string }|null}
 */
export function readVendorMark(fn, size) {
  let m = null;
  try { m = typeof fn === 'function' ? fn() : null; } catch { return null; }
  if (!m || typeof m !== 'object') return null;
  const { px, py } = m;
  if (!Number.isInteger(px) || !Number.isInteger(py) || px < 0 || py < 0 || px >= size.width || py >= size.height) return null;
  const label = String(m.label ?? VENDOR_LEGEND_TEXT).slice(0, LABEL_MAX);
  const town = String(m.town ?? '').slice(0, LABEL_MAX);
  return { key: `${px},${py}|${label}|${town}`, px, py, x: px + 0.5, y: py + 0.5, cx: px + 0.5, cy: py + 0.5, r: VENDOR_RING_R, label, town };
}

/** What a map repaints on: the mark's pixel and its words. */
export const vendorMarkKey = (m) => m?.key ?? '';

/** The classic page's texels - the gold ring's band round the town (its own dot left standing in the middle). */
export function vendorRingTexels(m, originX, originY, width, height) {
  return m ? gateRingTexels(m, originX, originY, width, height) : [];
}

/**
 * The held map's coin: a pin from the town up to a gold coin (a dark rim, a struck inner ring, a pale glint), the
 * trader's name under the town on the parchment's own halo, and the town's ring in gold. `toPaper` the sheet's own.
 * @param {CanvasRenderingContext2D} ctx @param {any} view @param {any} m @param {(view: any, x: number, y: number) => number[]} toPaper
 * @param {{ halo?: string, name?: string }} [pen]
 */
export function paintVendorMark(ctx, view, m, toPaper, pen = {}) {
  const [x, y] = toPaper(view, m.x, m.y);
  const r = VENDOR_COIN_R;
  const cy = y - VENDOR_MARK_LIFT;
  ctx.save();
  ctx.setLineDash([]);
  // the town ringed - the waypoint's own place, apart from the map's yellow mark
  ctx.strokeStyle = VENDOR_RIM_CSS; ctx.lineWidth = 3.2;
  ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = VENDOR_MARK_CSS; ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.stroke();
  // the pin
  ctx.strokeStyle = VENDOR_RIM_CSS; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x, y - 8); ctx.lineTo(x, cy + r); ctx.stroke();
  // the coin, on a soft gold glow so it reads at every zoom
  ctx.fillStyle = 'rgba(240, 199, 90, 0.30)';
  ctx.beginPath(); ctx.arc(x, cy, r + 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = VENDOR_MARK_CSS;
  ctx.beginPath(); ctx.arc(x, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = VENDOR_RIM_CSS; ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(90, 58, 14, 0.75)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(x, cy, r - 3, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = 'rgba(255, 246, 214, 0.85)';
  ctx.beginPath(); ctx.arc(x - 3.4, cy - 3.4, 1.8, 0, Math.PI * 2); ctx.fill();
  // the coin's face: a trader's scales, struck in the rim's brown
  ctx.strokeStyle = VENDOR_RIM_CSS; ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(x, cy - 4); ctx.lineTo(x, cy + 4);   // the post
  ctx.moveTo(x - 4.5, cy - 2.5); ctx.lineTo(x + 4.5, cy - 2.5);   // the beam
  ctx.moveTo(x - 4.5, cy - 2.5); ctx.lineTo(x - 5.5, cy + 1); ctx.lineTo(x - 3.5, cy + 1); ctx.closePath();
  ctx.moveTo(x + 4.5, cy - 2.5); ctx.lineTo(x + 3.5, cy + 1); ctx.lineTo(x + 5.5, cy + 1); ctx.closePath();
  ctx.moveTo(x - 2.5, cy + 4); ctx.lineTo(x + 2.5, cy + 4);   // the foot
  ctx.stroke();
  // the words, beside the coin on the parchment's halo - the trader's house (the sheet names the town itself)
  const lines = [m.label].filter(Boolean);
  if (lines.length) {
    ctx.font = 'bold 11px Georgia, "Times New Roman", serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    let ty = cy;
    for (const [i, t] of lines.entries()) {
      if (i === 1) ctx.font = 'italic 10px Georgia, "Times New Roman", serif';
      ctx.lineWidth = 3.5; ctx.strokeStyle = pen.halo ?? 'rgba(236, 222, 190, 0.85)';
      ctx.strokeText(t, x + r + 6, ty);
      ctx.fillStyle = i === 0 ? '#6b4310' : (pen.name ?? 'rgba(46, 32, 18, 0.95)');
      ctx.fillText(t, x + r + 6, ty);
      ty += 13;
    }
  }
  ctx.restore();
}
