// @ts-check
// WB1 (2026-09-25, Mac: "a large area would be shown on the map"): THE GATE'S RING ON BOTH MAPS.
//
// The host hands the maps a FUNCTION (`gate: () => mark|null`, beside SOC6's `party`) and neither map learns what a
// gate is: the mark is a ring in map pixels - `{day, cx, cy, r, label, phase}` from systems/gateOmen.js mapMark() -
// read on each window's own poll. The held map draws it in ink over the bay (ui/inkMap.js paintGateRing); the classic
// region page writes its edge into the page's texels, on the open province's own pixels only (SOC6's rule: a mark
// does not bleed onto a neighbour's sheet).
//
// The ring is the AREA, not the spot (bible World-Bosses.md section 2): its centre is pulled off the gate by the
// day's roll, and the land's beacon says the rest.
//
// Not a DFU member. Ledger A (WB).

/** The ring's ink, the fill under it, and the classic page's texel - a burning red, apart from the party's green and
 *  every location dot's colour. */
export const GATE_RING_CSS = '#ff5a2a';
export const GATE_FILL_CSS = 'rgba(255, 70, 30, 0.13)';
export const GATE_DOT_RGB = Object.freeze([255, 82, 36]);
export const GATE_LEGEND_TEXT = 'Oblivion Gate';

/**
 * The host's mark, read and checked - null for none, a throw, or anything a map could not place.
 * @param {(() => any) | undefined} fn
 * @param {{width:number, height:number}} size the map, in pixels
 */
export function readGateMark(fn, size) {
  let m = null;
  try { m = typeof fn === 'function' ? fn() : null; } catch { return null; }
  if (!m || typeof m !== 'object') return null;
  const { cx, cy, r } = m;
  if (![cx, cy, r].every(Number.isFinite) || !(r > 0)) return null;
  if (cx + r < 0 || cy + r < 0 || cx - r > size.width || cy - r > size.height) return null;
  return { day: Number.isFinite(m.day) ? m.day : 0, cx, cy, r, label: String(m.label ?? GATE_LEGEND_TEXT).slice(0, 80), phase: String(m.phase ?? '') };
}

/** What the held map repaints on: the ring AND its words (the countdown ticks each second). */
export const gateMarkKey = (m) => (m ? `${m.day}|${m.cx.toFixed(3)}|${m.cy.toFixed(3)}|${m.r}|${m.phase}|${m.label}` : '');
/** What the classic page repaints on: the ring alone - it draws no words, and a whole-page rebuild a second for a
 *  countdown it does not show would be the repaint-forever SOC6 refused. */
export const gateRingKey = (m) => (m ? `${m.day}|${m.cx.toFixed(3)}|${m.cy.toFixed(3)}|${m.r}` : '');

/** How wide the classic page's ring band is, map pixels: a whole pixel, so the edge never breaks into dots - at the
 *  omen's two-pixel radius that is eight to twelve texels round wherever the centre falls (0.75 left as few as four). */
export const GATE_RING_BAND = 1;

/**
 * The classic page's texels for the ring: every map pixel in the page's rectangle whose centre lies on the ring's
 * edge band - as [x, y] in PAGE coordinates (origin-relative, y down as the map's pixels run).
 * @param {{cx:number, cy:number, r:number}} m
 * @param {number} originX @param {number} originY @param {number} width @param {number} height
 */
export function gateRingTexels(m, originX, originY, width, height) {
  const out = [];
  if (!m) return out;
  const x0 = Math.max(originX, Math.floor(m.cx - m.r - 1)), x1 = Math.min(originX + width - 1, Math.ceil(m.cx + m.r + 1));
  const y0 = Math.max(originY, Math.floor(m.cy - m.r - 1)), y1 = Math.min(originY + height - 1, Math.ceil(m.cy + m.r + 1));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d = Math.hypot(x + 0.5 - m.cx, y + 0.5 - m.cy);
      if (d <= m.r && d >= m.r - GATE_RING_BAND) out.push([x - originX, y - originY]);
    }
  }
  return out;
}
