// @ts-check
// THE SPIRE LAB'S MAP (THE ASCENT - LAW 9, 2026-10-16, Mac: "I want it to feel like you're actually traverversing corridors,
// different rooms, etc."; bible/11-Multiplayer/Elite-Gates-Ascent.md section 8 - "The lab (spire.html) gains a MAP view - the
// hall from above with its route drawn - and views inside each room"): a spec law 9 hall's ROUTE drawn over the lab's frame
// (src/tools/spireLab.js) on a 2D canvas laid over it, each point projected by the frame's own camera - so in the MAP view
// (the hall straight down, in plan) and in any other the way stands where its floors do. Links coloured by their KIND (a walk,
// a stair, a climb, a drop, a span course, a bridge), drawn by their ROAD (the main way thick, its other road dashed, a side
// way dotted); the main way's nodes ringed; the plate and the door marked; each room named at its middle; each climb's face
// and each void's plan drawn. A law 4-8 hall (no route) draws its course's line along +z.
//
// A tool's own (the lab's page): no game data, nothing the game imports. Ledger A (ELITE-GATES).
import { EG_ROOM_NAMES } from '../net/eliteGates/egRoomLaw.js';

/** Each link kind's colour on the map (CSS). */
export const EG_MAP_KIND_COLORS = Object.freeze({ walk: '#f2efe6', stair: '#f5c542', climb: '#ff5a4f', drop: '#d264ff', span: '#3fd3ff', bridge: '#62e07a' });
/** Each road's stroke on the map: its width (px) and its dash. */
export const EG_MAP_ROAD_STROKES = Object.freeze({ 0: Object.freeze({ w: 3.5, dash: Object.freeze([]) }), 1: Object.freeze({ w: 2.5, dash: Object.freeze([9, 6]) }), 2: Object.freeze({ w: 2, dash: Object.freeze([2, 5]) }) });

/**
 * The route of hall `spec` as the map draws it, in the hall's frame (metres): `{ links: [{ a, b, kind, road, main }], nodes,
 * plate, door, rooms: [{ name, at }], climbs: [[a, b]], voids: [poly] }`. A law 4-8 hall: its course's line, plate to door.
 * Pure.
 * @param {any} spec
 */
export function egMapOf(spec) {
  const R = spec?.route;
  if (!R?.nodes?.length) {
    const len = spec?.len ?? 0;
    return { nodes: [[0, 0, 0], [0, 0, len]], links: [{ a: [0, 0, 0], b: [0, 0, len], kind: 'walk', road: 0, main: true }], plate: [0, 0, 0], door: [0, 0, len], rooms: [], climbs: [], voids: [] };
  }
  const onMain = new Set();
  for (let i = 0; i + 1 < R.main.length; i++) onMain.add(`${R.main[i]}:${R.main[i + 1]}`).add(`${R.main[i + 1]}:${R.main[i]}`);
  const links = R.links.map((l) => ({ a: R.nodes[l.a], b: R.nodes[l.b], kind: l.kind, road: l.road, main: onMain.has(`${l.a}:${l.b}`) }));
  const rooms = (spec.rooms ?? []).map((q) => { const H = spec.heroes?.[q.h]; return H ? { name: EG_ROOM_NAMES[q.k] ?? q.k, at: [(H.box[0] + H.box[3]) / 2, H.y, (H.box[2] + H.box[5]) / 2] } : null; }).filter(Boolean);
  const climbs = (spec.climbs ?? []).map((c) => [[c.x0, c.y0, c.z0], [c.x1, c.y1, c.z1]]);
  const voids = (spec.voids ?? []).map((v) => v.poly.map((p) => [p[0], v.y1, p[1]]));
  return { nodes: R.nodes, links, plate: R.nodes[R.main[0]], door: R.nodes[R.main[R.main.length - 1]], rooms, climbs, voids, mainSet: new Set(R.main) };
}

/**
 * THE ROUTE DRAWN onto 2D context `ctx` (a canvas `w` x `h` px laid over the frame): `project(x, y, z)` the hall-frame point's
 * place on it (`[px, py]`, null behind the eye). With a legend in its corner (`legend` true).
 * @param {CanvasRenderingContext2D} ctx @param {any} spec @param {(x: number, y: number, z: number) => (number[]|null)} project
 * @param {number} w @param {number} h @param {{ legend?: boolean, labels?: boolean }} [opts]
 */
export function egMapDraw(ctx, spec, project, w, h, { legend = true, labels = true } = {}) {
  const M = egMapOf(spec);
  ctx.clearRect(0, 0, w, h);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // the voids: where a fall skips ahead along the way, under the leg above
  ctx.fillStyle = 'rgba(255, 70, 70, 0.10)'; ctx.strokeStyle = 'rgba(255, 90, 90, 0.35)'; ctx.lineWidth = 1; ctx.setLineDash([]);
  for (const poly of M.voids) {
    const ps = poly.map((p) => project(p[0], p[1], p[2]));
    if (ps.some((p) => !p)) continue;
    ctx.beginPath(); ps.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  // the links, the side ways first and the main way over them
  const order = [...M.links].sort((a, b) => (b.road - a.road) || (a.main === b.main ? 0 : a.main ? 1 : -1));
  for (const l of order) {
    const a = project(l.a[0], l.a[1], l.a[2]), b = project(l.b[0], l.b[1], l.b[2]);
    if (!a || !b) continue;
    const S = EG_MAP_ROAD_STROKES[l.road] ?? EG_MAP_ROAD_STROKES[2];
    ctx.setLineDash([...S.dash]);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)'; ctx.lineWidth = S.w + 2.5;
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    ctx.strokeStyle = EG_MAP_KIND_COLORS[l.kind] ?? '#ffffff'; ctx.lineWidth = l.main ? S.w + 1 : S.w;
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  }
  ctx.setLineDash([]);
  // the climbs' faces
  ctx.strokeStyle = EG_MAP_KIND_COLORS.climb; ctx.lineWidth = 5;
  for (const [p, q] of M.climbs) { const a = project(p[0], p[1], p[2]), b = project(q[0], p[1], q[2]); if (a && b) { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); } }
  // the nodes: the main way's ringed
  for (const [i, n] of M.nodes.entries()) {
    const p = project(n[0], n[1], n[2]);
    if (!p) continue;
    const main = M.mainSet?.has(i) ?? true;
    ctx.fillStyle = main ? '#ffffff' : '#9aa3ad'; ctx.strokeStyle = '#000000'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(p[0], p[1], main ? 3.5 : 2.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  // the plate and the door
  const mark = (n, fill, text) => {
    const p = n && project(n[0], n[1], n[2]);
    if (!p) return;
    ctx.fillStyle = fill; ctx.strokeStyle = '#000000'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p[0], p[1], 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (labels) label(ctx, text, p[0] + 11, p[1] + 4, fill);
  };
  mark(M.plate, '#62e07a', `plate (${(M.plate?.[1] ?? 0).toFixed(1)} m)`);
  mark(M.door, '#ffd25a', `${spec?.route ? 'door' : 'end'} (${(M.door?.[1] ?? 0).toFixed(1)} m)`);
  // the rooms named
  if (labels) for (const r of M.rooms) { const p = project(r.at[0], r.at[1], r.at[2]); if (p) label(ctx, `${r.name} (${r.at[1].toFixed(1)} m)`, p[0] - 30, p[1], '#ffe8b0'); }
  if (legend) {
    const kinds = Object.keys(EG_MAP_KIND_COLORS), x0 = 10, y0 = h - 16 - (kinds.length + 3) * 17;
    ctx.fillStyle = 'rgba(10, 12, 15, 0.82)'; ctx.fillRect(x0 - 6, y0 - 16, 168, (kinds.length + 3) * 17 + 14);
    kinds.forEach((k, i) => { ctx.strokeStyle = EG_MAP_KIND_COLORS[k]; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x0, y0 + i * 17 - 4); ctx.lineTo(x0 + 26, y0 + i * 17 - 4); ctx.stroke(); label(ctx, k, x0 + 34, y0 + i * 17, '#e9e4d9'); });
    [[0, 'road 0: the main way'], [1, 'road 1: the other road'], [2, 'road 2: a side way']].forEach(([r, t], i) => {
      const S = EG_MAP_ROAD_STROKES[r], y = y0 + (kinds.length + i) * 17 - 4;
      ctx.setLineDash([...S.dash]); ctx.strokeStyle = '#e9e4d9'; ctx.lineWidth = S.w; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + 26, y); ctx.stroke(); ctx.setLineDash([]);
      label(ctx, String(t), x0 + 34, y + 4, '#e9e4d9');
    });
  }
  return M;
}
/** A word on the map, dark-edged so it reads over any ground. */
function label(ctx, text, x, y, color) {
  ctx.font = '12px system-ui, sans-serif';
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)'; ctx.strokeText(text, x, y);
  ctx.fillStyle = color; ctx.fillText(text, x, y);
}

/**
 * THE ROOMS' VIEWS (section 8's "views inside each room"): of the circle's halls `specs`, each room (spec law 9's `rooms`) a
 * camera at its mouth's socket - a body's eyes, a step inside - looking in along the way it is entered by, and one from over
 * its middle looking down across it. `[{ name, spec, k, at, yaw, pitch, over }]`, hall by hall. Pure.
 * @param {any[]} specs
 */
export function egRoomViews(specs) {
  const out = [];
  for (const spec of specs) for (const q of spec.rooms ?? []) {
    const H = spec.heroes?.[q.h];
    if (!H) continue;
    const s = H.sockets.in, cx = (H.box[0] + H.box[3]) / 2, cz = (H.box[2] + H.box[5]) / 2;
    const dx = cx - s.x, dz = cz - s.z, d = Math.hypot(dx, dz) || 1, yaw = (Math.atan2(dx, dz) * 180) / Math.PI;
    out.push({ name: q.k, spec, k: q.k, at: [s.x + (dx / d) * 1.2, s.y + 1.7, s.z + (dz / d) * 1.2], yaw, pitch: 4 });
    out.push({ name: `${q.k}-over`, spec, k: q.k, at: [cx - (dx / d) * 14, Math.max(H.box[4], s.y + 8) + 6, cz - (dz / d) * 14], yaw, pitch: -38 });
  }
  return out;
}
