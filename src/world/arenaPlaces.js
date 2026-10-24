// @ts-check
// ═══════════════════════════════════════════════════════════════════
// TESA1 (2026-10-12, bible/03-World/Arena-Provinces.md) - THE PLACES PAST THE BAY, STOOD ON THE BAY'S PIXELS.
//
// TESA1 to TESA6 read these places from the player's own copy of The Elder Scrolls: Arena (CITYDATA.65 and A.EXE's list
// of coastal cities). TESA12 (2026-10-13, the owner: "I want to make it where attaching the arena file isn't needed";
// asked, "Canon + generated" and "Remove it") retired that: the places are the port's own (world/tamrielPlaces.js
// makeTamrielPlaces - TAMRIEL1's lore cities and the towns and villages made beside them), made on the trace from the
// player's Daggerfall files, the same Tamriel on every client, online and off. Nothing of Arena is read. The module's
// names keep TESA's (`arena...`): a save's and a discovery's ids, and the host's seams, are the same lane.
//
// ON THE TRACE ONLY. The places stand on the picture's land (world/tamriel/tamrielLand.js); with the authored shape
// (`?tamrieltrace=off`, or the few hundred milliseconds before the trace lands) none do, and the ink draws TAMRIEL1's
// cities as it always did.
// ═══════════════════════════════════════════════════════════════════
import { tamrielTrace, tamrielLandVersion } from './tamriel/tamrielLand.js';
import { pictureToBay, bayToPicture, inBay, tamrielFit } from './tamriel/tamrielFrame.js';
import { makeTamrielPlaces, provinceLand } from './tamrielPlaces.js';   // TESA12: the port's own places
import { capitalPin, capitalOnPixel } from './tamrielCapitals.js';   // TESA10: a capital's place stands on the capital; TESA11: and no other on any of its pixels

// ── TESA2: THE PIXEL A PLACE STANDS ON ──────────────────────────

/** How far, Bay pixels, a place may stand from its own point when the pixel under it is not its province's land or a
 *  place before it took it. */
export const PIXEL_REACH = 3;
/** TESA6: how far, Bay pixels, a port looks for its province's shore. TESA12: a port is a lore city TAMRIEL1 sets on the
 *  sea, and its point is the port's own reading of the lore map, so the shore is near it or the picture has none there -
 *  on the freeware's trace every port but Anvil (17 picture pixels inland) and Leyawiin (10) is within six. */
export const SHORE_REACH = 100;
const RING8 = Object.freeze([[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]);
/** TESA6: is a Bay pixel the picture's sea - its centre off the trace's land, or off the picture (the ground's own law
 *  past the Bay, world/tamriel/tamrielGround.js: the trace's sea is water). */
export function pictureSea(trace, x, y) {
  const [px, py] = bayToPicture(x + 0.5, y + 0.5);
  const ix = Math.floor(px), iy = Math.floor(py);
  return !(ix >= 0 && iy >= 0 && ix < trace.w && iy < trace.h && trace.land[iy * trace.w + ix]);
}
/** TESA6: a province's COAST CELLS - its land's picture pixels with the sea (pictureSea's: off the land, or off the
 *  picture) among their eight - as a predicate over picture points; a Bay pixel beside the sea lies in one of them. */
function coastCells(trace, own) {
  const { w, h, land } = trace;
  const mask = new Uint8Array(w * h), cells = [];
  const sea = (x, y) => x < 0 || y < 0 || x >= w || y >= h || !land[y * w + x];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (own(x + 0.5, y + 0.5) && RING8.some(([dx, dy]) => sea(x + dx, y + dy))) { mask[y * w + x] = 1; cells.push([x, y]); }
  const has = (px, py) => { const x = Math.floor(px), y = Math.floor(py); return x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x] === 1; };
  /** The ring (Chebyshev, Bay pixels from (fx, fy)) no nearer than which a coast cell's Bay pixels lie - where to start. */
  const ringFrom = (fx, fy) => {
    let r = Infinity;
    for (const [cx, cy] of cells) {
      const [ax, ay] = pictureToBay(cx, cy), [bx, by] = pictureToBay(cx + 1, cy + 1);
      r = Math.min(r, Math.max(0, Math.floor(ax) - fx, fx - Math.ceil(bx), Math.floor(ay) - fy, fy - Math.ceil(by)));
    }
    return r;
  };
  return { has, ringFrom };
}
/** The nearest pixel to (x, y) `ok` takes, ring by ring from ring `from` out to `reach` and in each ring the nearest
 *  centre, or null. */
function nearestPixel(x, y, reach, ok, from = 0) {
  const fx = Math.floor(x), fy = Math.floor(y);
  if (from <= 0 && ok(fx, fy)) return [fx, fy];
  for (let r = Math.max(1, from); r <= reach; r++) {
    let at = null, bd = Infinity;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;   // the ring alone - the ones inside it were asked
        const d = Math.hypot(fx + dx + 0.5 - x, fy + dy + 0.5 - y);
        if (d < bd && ok(fx + dx, fy + dy)) { bd = d; at = [fx + dx, fy + dy]; }
      }
    }
    if (at) return at;
  }
  return null;
}

/**
 * TESA2: THE BAY PIXEL EACH NAMED PLACE BEYOND THE BAY STANDS ON - the pixel under its point (the live fit's
 * pictureToBay) where that pixel's centre is its own province's land and no place before it (the model's order:
 * province, then id) stood there; else the nearest such pixel within PIXEL_REACH, ring by ring and in each ring the
 * nearest centre; else none (`unstood`). The Bay's own ground stands none, and a nameless place stands nowhere. Answers { stood: [place & { bx, by }], unstood, byPixel: Map<'bx,by', place> }.
 *
 * TESA6: A PORT STANDS ON ITS SHORE. A place the model calls a port (`port`: TESA12, a lore city TAMRIEL1 sets on the
 * sea) stands on the nearest pixel of its own province's land beside the picture's sea (`pictureSea`, one of its eight
 * neighbours, never the Bay's), within SHORE_REACH, ring by ring as above - and is a PORT (`port: true`). One with no
 * shore in reach stands as any place does, no port.
 *
 * TESA10: A CAPITAL'S PLACE STANDS ON THE CAPITAL. A place `pinned` names a pixel for (world/tamrielCapitals.js
 * capitalPin: the capital the port builds of its name) stands on that pixel exactly, before any other place takes it
 * (`pinned: true`) - so its roads, its ink and a portal's end lead to the city the port built there; a port pinned beside
 * the picture's sea a port still (TESA10b). TESA11: no other place stands on a pixel `reserved` says a
 * capital stands on (the rest of a capital over several pixels - its pin the centre's).
 * @param {ReturnType<typeof makeTamrielPlaces>} model @param {import('./tamriel/tamrielLand.js').TamrielTrace} trace
 * @param {((place: any) => ({ px: number, py: number } | null)) | null} [pinned]
 * @param {((bx: number, by: number) => boolean) | null} [reserved]
 */
export function standArenaPixels(model, trace, pinned = null, reserved = null) {
  const stood = [], unstood = [], byPixel = new Map(), lands = new Map();
  const pins = new Map();
  for (const p of pinned ? model.places : []) {
    const at = p.name ? pinned(p) : null;
    if (!at || inBay(at.px, at.py) || byPixel.has(`${at.px},${at.py}`)) continue;
    // TESA10b: a port pinned beside the sea is a port still (Solitude's docks)
    const port = !!p.port && RING8.some(([dx, dy]) => !inBay(at.px + dx, at.py + dy) && pictureSea(trace, at.px + dx, at.py + dy));
    const { port: _lore, ...rest } = p;   // TESA12: the model's `port` is the lore's word - a port is one beside the sea
    const placed = { ...rest, bx: at.px, by: at.py, pinned: true, ...(port ? { port: true } : {}) };
    pins.set(p, placed);
    byPixel.set(`${at.px},${at.py}`, placed);
  }
  for (const p of model.places) {
    if (!p.name) continue;
    if (pins.has(p)) { stood.push(pins.get(p)); continue; }
    const [x, y] = pictureToBay(p.px, p.py);
    if (inBay(x, y)) continue;
    let own = lands.get(p.province);
    if (!own) lands.set(p.province, own = provinceLand(trace, p.province));
    const free = (bx, by) => !inBay(bx, by) && !byPixel.has(`${bx},${by}`) && !reserved?.(bx, by) && own(...bayToPicture(bx + 0.5, by + 0.5));   // TESA11: never on a capital's pixel
    const port = !!p.port;
    let shores = port ? lands.get(`${p.province}:shore`) : null;
    if (port && !shores) lands.set(`${p.province}:shore`, shores = coastCells(trace, own));
    // a shore pixel's picture pixel is a coast cell (its province's land beside the sea) - asked first, it spares the rest
    const shore = (bx, by) => { const [qx, qy] = bayToPicture(bx + 0.5, by + 0.5); return shores.has(qx, qy) && free(bx, by) && RING8.some(([dx, dy]) => !inBay(bx + dx, by + dy) && pictureSea(trace, bx + dx, by + dy)); };
    const onShore = port ? nearestPixel(x, y, SHORE_REACH, shore, shores.ringFrom(Math.floor(x), Math.floor(y))) : null;
    const at = onShore ?? nearestPixel(x, y, PIXEL_REACH, free);
    if (!at) { unstood.push(p); continue; }
    const { port: _lore, ...rest } = p;   // TESA12: the lore's word - a port only on its shore
    const placed = { ...rest, bx: at[0], by: at[1], ...(onShore ? { port: true } : {}) };
    stood.push(placed);
    byPixel.set(`${at[0]},${at[1]}`, placed);
  }
  return { stood, unstood, byPixel };
}

// ── THE INSTALLED SET ───────────────────────────────────────────

let _version = 0;
let _model = null;   // { land, fit, model, pixels }
let _standing = false;

/** Moves when a host's standing changes - the ink and the held map's static key read it beside the land's. */
export const arenaPlacesVersion = () => _version;

/** TESA12: the places on the trace as it stands now (world/tamrielPlaces.js makeTamrielPlaces - remade when the land
 *  module's version or the fit moves: the trace lands after the boot), or null with no trace to stand them on. */
export function arenaPlaces() {
  const trace = tamrielTrace();
  if (!trace) return null;
  const land = tamrielLandVersion(), fit = tamrielFit();
  if (!_model || _model.land !== land || _model.fit !== fit) _model = { land, fit, model: makeTamrielPlaces(trace), pixels: null };
  return _model.model;
}

/** TESA2: the places' pixels (standArenaPixels) on the trace and the Bay's fit as they stand now - remade when either
 *  moves - or null with no trace. */
export function arenaPixels() {
  const model = arenaPlaces();
  if (!model) return null;
  if (!_model.pixels) _model.pixels = standArenaPixels(model, /** @type {any} */ (tamrielTrace()), capitalPin, (bx, by) => !!capitalOnPixel(bx, by));   // TESA10: the capitals' places on the capitals; TESA11: no other on them
  return _model.pixels;
}
/** TESA2: the place standing on a Bay pixel, or null. */
export const arenaPlaceOnPixel = (bx, by) => arenaPixels()?.byPixel.get(`${bx},${by}`) ?? null;

/** TESA2: does a host stand the places - the world host, with the land beyond the Bay streamed (its boot says so). The
 *  map's portal ends at a place read it; a change moves the version, so the ink is made again. */
export function setArenaStanding(on) {
  if (!!on === _standing) return;
  _standing = !!on;
  _version++;
}
export const arenaStanding = () => _standing;
