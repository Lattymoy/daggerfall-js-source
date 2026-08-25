// THE PROVINCE MAP, VECTORISED.
//
// The enhanced race screen draws Tamriel as scalable outlines instead
// of a 320x200 bitmap - and the outlines are not drawn by hand. They
// are TRACED AT RUNTIME from TAMRIEL2.IMG, the player's own file, so
// the geography is Bethesda's to the pixel and only the rendering is
// ours.
//
// ── WHAT THESE SHAPES ARE, EXACTLY ───────────────────────────────
//
// They are Daggerfall's own CLICK REGIONS, not its coastlines.
// Overlaying the picker on TMAP00I0 shows the eight masks running
// generously past the painted coast - they are targets sized for a
// mouse in 1996, and the sea between Sumurset Isle and Valenwood is
// claimed by whichever province is nearer. So the map reads as
// Tamriel because the regions ARE the provinces, but a coastline here
// is a region boundary and the module should not pretend otherwise.
//
// ── WHY TAMRIEL2 AND NOT THE PICTURE ─────────────────────────────
//
// The classic screen draws TMAP00I0.IMG and hit-tests TAMRIEL2.IMG,
// a second bitmap the player never sees whose PALETTE INDEX IS THE
// RACE ID (CreateCharRaceSelect.cs:30-31,64 - a click on Hammerfell
// reads index 2 and lands on Redguard). That picker is therefore an
// exact eight-way region map of the homelands, already authored, and
// tracing its boundaries gives the same eight shapes as vectors.
//
// Measured on the shipping file: 64000 bytes, 320x200, indices 1..8
// with 0 as the surround - one index per playable race and nothing
// else in it.
//
// ── THE HIT TEST DOES NOT MOVE ───────────────────────────────────
//
// These paths are FOR DISPLAY ONLY. A click still resolves through
// raceAtPickerPoint, the same byte lookup the classic screen uses, so
// the vector map and the classic map cannot disagree about which
// province is under a finger - not because they are checked against
// each other, but because there is only one of them. A traced polygon
// that had to be kept in step with a bitmap would be a second source
// of truth, which is the shape this project keeps finding bugs in.
//
// ── NO SMOOTHING, DELIBERATELY ───────────────────────────────────
//
// The trace follows pixel edges exactly. Simplifying the coastline
// would look tidier and would move the Iliac Bay, and at the scales
// this draws at the stepped outline reads as a woodcut rather than as
// an artefact - which is the right register for a map of Tamriel
// anyway. Any smoothing here would be an invented geography.
import { RACE_TEMPLATES } from '../systems/races.js';

/** The picker's own dimensions. Named MAP_ and not PICKER_: the
 *  one-home sweep caught PICKER_W already declared in ui/listPicker.js
 *  as 200, which is a list's width and has nothing to do with
 *  Tamriel - two different numbers under one name in one folder. */
export const MAP_W = 320;
export const MAP_H = 200;

/** THE NINTH REGION. Tamriel has nine provinces and the picker names
 *  eight: the IMPERIAL PROVINCE is not a playable homeland, so it has
 *  no index in TAMRIEL2 at all - which left a hole in the middle of
 *  the continent, and a map of Tamriel with Cyrodiil missing is not a
 *  map of Tamriel.
 *
 *  IT CANNOT BE RECOVERED FROM THE PICKER. The first attempt read it
 *  as the gap the eight masks enclose, and they do not enclose it:
 *  overlaying the picker on the painting shows the masks are generous
 *  CLICK BLOBS that never meet in the middle, so the centre is open to
 *  the outside on both flanks and no flood fill can isolate it. Nor
 *  can the painting be split by colour - the parchment surround and
 *  the land share palette indices, and a learned classifier takes the
 *  border and the title banner with it.
 *
 *  What does bound it is the two together: the eight masks on its
 *  landward sides and the painting's BLUE COAST on its seaward ones.
 *  So the region is the largest patch of ground that is claimed by no
 *  homeland, painted in no sea colour, and TOUCHES NO EDGE of the
 *  bitmap - the last clause being what discards the parchment
 *  surround without needing to know what parchment looks like. No
 *  seed point, no threshold on position, and nothing hand-drawn.
 *  Measured on the shipping files: 5,549 pixels, one component, and
 *  the next largest inner patch is 268. */
export const INERT_REGION = Object.freeze({
  id: 0, key: 'Imperial', name: 'Imperial Province', inert: true,
});

/** THE NAMES ARE THE MAP'S OWN. TMAP00I0 paints a label on every
 *  province, so a map of Tamriel can say where these places are
 *  instead of who comes from them - and the words are transcribed off
 *  the picture rather than chosen. SUMURSET is the game's spelling and
 *  is kept: this is Daggerfall's map, not a corrected one. */
export const PROVINCE_NAMES = Object.freeze({
  Breton: 'High Rock', Redguard: 'Hammerfell', Nord: 'Skyrim',
  DarkElf: 'Morrowind', HighElf: 'Sumurset Isle', WoodElf: 'Valenwood',
  Khajiit: 'Elsweyr', Argonian: 'Black Marsh', Imperial: 'Imperial Province',
});

const key = (x, y) => `${x},${y}`;

/**
 * The boundary loops of one region, as SVG path data.
 *
 * Marching the pixel edges rather than the pixel centres: for every
 * inside pixel, each of its four sides whose neighbour is outside
 * becomes a directed unit segment wound so the inside is always on
 * the same hand. Chaining those segments end to end yields one closed
 * loop per island - and any HOLE comes out wound the other way, which
 * is why the path is filled even-odd rather than nonzero. An island in
 * a lake in an island is free.
 */
function traceMask(inside, w, h) {
  /** @type {Map<string, [number, number]>} start point -> end point */
  const edges = new Map();
  const push = (x1, y1, x2, y2) => {
    // A shared corner can carry two outgoing edges (two regions
    // touching diagonally). Keep both: the second lands in an overflow
    // list the walk drains, rather than silently overwriting the first
    // and truncating a loop.
    const k = key(x1, y1);
    if (!edges.has(k)) edges.set(k, []);
    edges.get(k).push([x2, y2]);
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!inside[y * w + x]) continue;
      if (y === 0 || !inside[(y - 1) * w + x]) push(x + 1, y, x, y);
      if (x === 0 || !inside[y * w + x - 1]) push(x, y, x, y + 1);
      if (y === h - 1 || !inside[(y + 1) * w + x]) push(x, y + 1, x + 1, y + 1);
      if (x === w - 1 || !inside[y * w + x + 1]) push(x + 1, y + 1, x + 1, y);
    }
  }

  const parts = [];
  for (const [start, outs] of edges) {
    while (outs.length) {
      const loop = [start.split(',').map(Number)];
      let cur = outs.pop();
      // Walk until the loop closes. It always does: every vertex has
      // as many outgoing edges as incoming ones, so the walk cannot
      // dead-end, and the grid is finite.
      for (let guard = 0; guard < w * h * 4; guard++) {
        loop.push(cur);
        if (key(cur[0], cur[1]) === start) break;
        const next = edges.get(key(cur[0], cur[1]));
        if (!next || !next.length) break;
        cur = next.pop();
      }
      parts.push(loop);
    }
  }

  // Collinear runs collapse to their endpoints. This is NOT smoothing
  // - not one point moves - it just stops a straight coastline being
  // three hundred separate line segments, which matters when eight of
  // these live in a DOM node.
  const d = [];
  for (const loop of parts) {
    if (loop.length < 4) continue;
    const pts = [loop[0]];
    for (let i = 1; i < loop.length - 1; i++) {
      const [px, py] = pts[pts.length - 1];
      const [cx, cy] = loop[i];
      const [nx, ny] = loop[i + 1];
      const straight = (px === cx && cx === nx) || (py === cy && cy === ny);
      if (!straight) pts.push([cx, cy]);
    }
    d.push(`M${pts.map(([x, y]) => `${x} ${y}`).join('L')}Z`);
  }
  return d.join('');
}

/** The point a region's NAME is hung on: the inside pixel furthest
 *  from any outside pixel, which is the one place a label sits clear
 *  of every coastline. A centroid would land in the Iliac Bay for
 *  High Rock, whose provinces wrap around it. */
function labelPoint(inside, w, h) {
  // one chebyshev pass out from the edge, then one back - cheap, and
  // exact enough for a label
  const dist = new Int32Array(w * h);
  const BIG = 1 << 20;
  for (let i = 0; i < dist.length; i++) dist[i] = inside[i] ? BIG : 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!dist[i]) continue;
      let best = dist[i];
      if (y > 0) best = Math.min(best, dist[i - w] + 1);
      if (x > 0) best = Math.min(best, dist[i - 1] + 1);
      if (y > 0 && x > 0) best = Math.min(best, dist[i - w - 1] + 1);
      if (y > 0 && x < w - 1) best = Math.min(best, dist[i - w + 1] + 1);
      dist[i] = best;
    }
  }
  let bx = 0; let by = 0; let bd = -1;
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (!dist[i]) continue;
      let best = dist[i];
      if (y < h - 1) best = Math.min(best, dist[i + w] + 1);
      if (x < w - 1) best = Math.min(best, dist[i + 1] + 1);
      if (y < h - 1 && x < w - 1) best = Math.min(best, dist[i + w + 1] + 1);
      if (y < h - 1 && x > 0) best = Math.min(best, dist[i + w - 1] + 1);
      dist[i] = best;
      if (best > bd) { bd = best; bx = x; by = y; }
    }
  }
  return [bx + 0.5, by + 0.5, bd];
}

/** Which palette entries the painting uses for water. Blue-dominant
 *  by a clear margin, so a brown river bank does not qualify - the
 *  test is on the PALETTE, once, not on 64,000 pixels. */
function seaIndices(palette) {
  const sea = new Uint8Array(256);
  if (!palette) return sea;
  for (let i = 0; i < 256; i++) {
    const [r, g, b] = palette(i);
    if (b > r + 8 && b > g + 8) sea[i] = 1;
  }
  return sea;
}

/**
 * The largest inland patch that belongs to no homeland - see
 * INERT_REGION for why it takes both files.
 *
 * @param picture TMAP00I0's DFBitmap, or null.
 * @param palette (index) => [r,g,b] for that bitmap's palette.
 */
function inlandRemainder(data, w, h, picture, palette) {
  if (!picture?.data?.length || picture.data.length !== data.length) return null;
  const sea = seaIndices(palette);
  const open = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) open[i] = (!data[i] && !sea[picture.data[i]]) ? 1 : 0;

  const seen = new Uint8Array(w * h);
  let best = null;
  for (let start = 0; start < w * h; start++) {
    if (!open[start] || seen[start]) continue;
    const stack = [start];
    const cells = [];
    seen[start] = 1;
    let touchesEdge = false;
    while (stack.length) {
      const i = stack.pop();
      cells.push(i);
      const x = i % w; const y = (i / w) | 0;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) touchesEdge = true;
      for (const k of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1,
        y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
        if (k >= 0 && open[k] && !seen[k]) { seen[k] = 1; stack.push(k); }
      }
    }
    // THE EDGE CLAUSE IS THE WHOLE TRICK: the parchment the map is
    // painted on runs to the border, so it is discarded without this
    // module ever having to recognise parchment.
    if (touchesEdge || (best && cells.length <= best.length)) continue;
    best = cells;
  }
  if (!best) return null;
  const mask = new Uint8Array(w * h);
  for (const i of best) mask[i] = 1;
  return { mask, pixels: best.length };
}

/**
 * Trace every playable homeland out of the picker bitmap.
 *
 * @param {{width:number,height:number,data:Uint8Array}} bmp
 *        ImgFile.getDFBitmap's shape, as raceAtPickerPoint takes.
 * @returns {Array<{id,key,name,d,label,pixels}>} in RACE_TEMPLATES
 *        order, skipping any race with no pixels in this file.
 */
export function traceProvinces(bmp, { picture = null, palette = null } = {}) {
  if (!bmp?.data?.length) return [];
  const { width: w, height: h, data } = bmp;
  const out = [];
  for (const race of RACE_TEMPLATES) {
    const inside = new Uint8Array(w * h);
    let pixels = 0;
    for (let i = 0; i < data.length; i++) {
      if (data[i] === race.id) { inside[i] = 1; pixels++; }
    }
    if (!pixels) continue;   // a file that does not carry this race says so
    const [lx, ly, clearance] = labelPoint(inside, w, h);
    out.push({
      id: race.id, key: race.key,
      name: PROVINCE_NAMES[race.key] ?? race.name,   // the place
      people: race.name,                             // and who is from it

      d: traceMask(inside, w, h),
      label: [lx, ly], clearance, pixels,
    });
  }

  // The Imperial Province, INERT: it is not a homeland and cannot be
  // chosen, and a map that omitted it would show a continent with a
  // hole in the middle. Absent the painting it is simply not there -
  // one region short is honest; an invented coastline is not.
  const inland = inlandRemainder(data, w, h, picture, palette);
  if (inland) {
    const [lx, ly, clearance] = labelPoint(inland.mask, w, h);
    out.unshift({
      ...INERT_REGION, d: traceMask(inland.mask, w, h),
      label: [lx, ly], clearance, pixels: inland.pixels,
    });
  }
  return out;
}
