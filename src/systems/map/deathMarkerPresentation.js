import { getPref } from "../uiPrefs.js";
import { deathLabelFocused } from "../../ui/deathMarkerLabel.js";
const point = (v) => v?.length >= 3 && [v[0], v[1], v[2]].every(Number.isFinite);
function layoutDeathEdgeMarkers(rows, rect) {
  const result = rows.map((r) => r.edge ? { ...r } : r), groups = /* @__PURE__ */ new Map();
  for (const row of result) {
    if (!row.edge) continue;
    const dx = (row.x - rect.left - rect.width / 2) / rect.width, dy = (row.y - rect.top - rect.height / 2) / rect.height;
    const side = Math.abs(dx) >= Math.abs(dy) ? dx < 0 ? "left" : "right" : dy < 0 ? "top" : "bottom";
    if (!groups.has(side)) groups.set(side, []);
    groups.get(side).push(row);
  }
  for (const [side, group] of groups) {
    const axis = side === "left" || side === "right" ? "y" : "x", start = axis === "y" ? rect.top : rect.left, size = axis === "y" ? rect.height : rect.width;
    const pad = Math.min(40, size / 4), lo = start + pad, hi = start + size - pad, gap = Math.min(32, (hi - lo) / Math.max(1, group.length - 1));
    group.sort((a, b) => a[axis] - b[axis] || (a.slot ?? 9) - (b.slot ?? 9));
    for (let i = 0; i < group.length; i++) group[i][axis] = Math.max(lo, Math.min(hi, group[i][axis]), i ? group[i - 1][axis] + gap : lo);
    for (let i = group.length - 1; i >= 0; i--) group[i][axis] = Math.min(group[i][axis], i === group.length - 1 ? hi : group[i + 1][axis] - gap);
  }
  return result;
}
function projectDeathMarker(at, proj, view, rect, pad = 24) {
  if (!point(at) || !proj || !view || !(rect?.width > 0) || !(rect?.height > 0)) return null;
  const v = [0, 0, 0, 0], c = [0, 0, 0, 0];
  for (let i = 0; i < 4; i++) v[i] = view[i] * at[0] + view[i + 4] * at[1] + view[i + 8] * at[2] + view[i + 12];
  for (let i = 0; i < 4; i++) c[i] = proj[i] * v[0] + proj[i + 4] * v[1] + proj[i + 8] * v[2] + proj[i + 12] * v[3];
  if (!c.every(Number.isFinite)) return null;
  const front = c[3] > 1e-5;
  let dx = c[0] / Math.max(Math.abs(c[3]), 1e-5) * rect.width / 2;
  let dy = -c[1] / Math.max(Math.abs(c[3]), 1e-5) * rect.height / 2;
  const rx = Math.max(1, rect.width / 2 - pad), ry = Math.max(1, rect.height / 2 - pad);
  const edge = !front || Math.abs(dx) > rx || Math.abs(dy) > ry;
  if (edge) {
    if (Math.abs(dx) + Math.abs(dy) < 1e-3) dy = ry;
    // Exactly behind: a stable downward turn cue.
    const scale = 1 / Math.max(Math.abs(dx) / rx, Math.abs(dy) / ry);
    dx *= scale;
    dy *= scale;
  }
  return {
    x: rect.left + rect.width / 2 + dx,
    y: rect.top + rect.height / 2 + dy,
    edge,
    angle: Math.atan2(dy, dx) * 180 / Math.PI
  };
}
function deathNumber(key, fallback, min, max) {
  const value = getPref(key);
  return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
}
function deathColor(key, fallback) {
  const value = getPref(key);
  return typeof value === "string" && /^#[\da-f]{6}$/i.test(value) ? value : fallback;
}
const colorRGB = (color) => [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16) / 255);
function deathBeamStyle(distance, { height = 100, opacity = 0.6, exterior = true } = {}) {
  const t = Math.max(0, Math.min(1, (distance - 15) / 185));
  const smooth = t * t * (3 - 2 * t), maximum = Math.max(5, Math.min(100, height));
  return {
    height: exterior ? Math.min(maximum, 5 + (maximum - 5) * smooth) : 6,
    opacity: Math.max(0.1, Math.min(0.6, opacity)) * (0.55 + 0.45 * smooth),
    throughWalls: false
  };
}
function createMarkerDwell() {
  let key = null, since = 0;
  return {
    update(rows, rect, { distance = 40, delay = 300, radius = 12, now = performance.now() } = {}) {
      let best = null, score = Infinity;
      for (const row of rows) {
        if (!Number.isFinite(row.metres) || row.metres < 0 || row.metres > distance || !deathLabelFocused(row, rect, radius)) continue;
        const d = (row.x - rect.left - rect.width / 2) ** 2 + (row.y - rect.top - rect.height / 2) ** 2;
        if (d < score) {
          best = row;
          score = d;
        }
      }
      if (!best) {
        key = null;
        return null;
      }
      if (best.acct !== key) {
        key = best.acct;
        since = now;
      }
      return now - since >= delay ? best : null;
    },
    reset() {
      key = null;
    }
  };
}
export {
  colorRGB,
  createMarkerDwell,
  deathBeamStyle,
  deathColor,
  deathNumber,
  layoutDeathEdgeMarkers,
  projectDeathMarker
};
