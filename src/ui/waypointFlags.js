// @ts-check
// WAYPOINTS (2026-10-06, the player: "They can be small flags with different colors"): THE FLAG, ONE PAINTER FOR BOTH
// MAPS - the Overworld's canvas (ui/travelViewHud.js drawMarks) and the held map's overlay (ui/heldMap.js). A pole from
// the point up, a swallow-tailed pennant off its top in the waypoint's colour, a dark edge so it reads on the land and
// on the parchment alike; a party's flag wears a small pip, a guild's a bar, so the kind is never told by colour alone.
// A followed waypoint's flag stands on a ring.
//
// Not a DFU member.
import { waypointCss } from '../systems/mapWaypoints.js';

/** The flag's size, px: the pole's height and the pennant's length. */
export const FLAG_POLE_PX = 19;
export const FLAG_CLOTH_PX = 13;
/** How far from the flag's foot a click still takes it, px. */
export const FLAG_HIT_PX = 12;

/**
 * Paint one flag with its foot at (x, y).
 * @param {CanvasRenderingContext2D} g
 * @param {number} x @param {number} y
 * @param {{ color: string, kind?: string, followed?: boolean, hover?: boolean, scale?: number }} w
 */
export function paintWaypointFlag(g, x, y, { color, kind = 'personal', followed = false, hover = false, scale = 1 }) {
  const css = color?.startsWith?.('#') ? color : waypointCss(color);
  const P = FLAG_POLE_PX * scale, C = FLAG_CLOTH_PX * scale;
  g.save();
  g.setLineDash?.([]);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  if (followed) {   // the followed: a ring at its foot
    g.beginPath(); g.ellipse?.(x, y, 7 * scale, 3.5 * scale, 0, 0, Math.PI * 2);
    g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.7)'; g.stroke();
    g.lineWidth = 1.5; g.strokeStyle = css; g.stroke();
  }
  // the pole
  g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - P);
  g.lineWidth = 3.2; g.strokeStyle = 'rgba(0,0,0,0.8)'; g.stroke();
  g.lineWidth = 1.6; g.strokeStyle = '#e9e4d9'; g.stroke();
  // the pennant - a swallow tail
  const top = y - P, h = 9 * scale;
  g.beginPath();
  g.moveTo(x + 0.5, top);
  g.lineTo(x + C, top);
  g.lineTo(x + C * 0.68, top + h / 2);
  g.lineTo(x + C, top + h);
  g.lineTo(x + 0.5, top + h);
  g.closePath();
  g.fillStyle = css; g.fill();
  g.lineWidth = hover ? 2 : 1.2; g.strokeStyle = hover ? '#f3ef2c' : 'rgba(0,0,0,0.85)'; g.stroke();
  // the kind's own sign on the cloth: a party's pip, a guild's bar
  if (kind === 'party') {
    g.beginPath(); g.arc(x + C * 0.38, top + h / 2, 1.6 * scale, 0, Math.PI * 2); g.fillStyle = 'rgba(0,0,0,0.75)'; g.fill();
  } else if (kind === 'guild') {
    g.fillStyle = 'rgba(0,0,0,0.75)'; g.fillRect(x + C * 0.18, top + h / 2 - 1 * scale, C * 0.42, 2 * scale);
  }
  // the foot
  g.beginPath(); g.arc(x, y, 1.8 * scale, 0, Math.PI * 2); g.fillStyle = '#000'; g.fill();
  g.restore();
}

/** A flag's click box around its foot (it stands up from it). */
export function flagBox(x, y, scale = 1) {
  return { x0: x - FLAG_HIT_PX * 0.6, x1: x + FLAG_CLOTH_PX * scale + 4, y0: y - FLAG_POLE_PX * scale - 4, y1: y + 6 };
}
