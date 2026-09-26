// @ts-check
// ═══════════════════════════════════════════════════════════════════
// DISC24-B — A MODEL, BAKED INTO AN ITEM PICTURE.
//
// kurkku on Discord ("Horse and Wagon don't have sprites in GrimoireUI"
// - "presumably applies to the normal vanilla UI as well"). The Small
// Cart has no inventory art anywhere in ARENA2: its template's player
// texture (213/1) is the Wine Rack's world sprite (MAC-D2's tomato), and
// no TEXTURE archive carries a cart. What the game DOES carry is the
// cart itself - classic model 41214, the wagon Horse Cart and Cargo
// trails behind the player (systems/horseCartLaw.js WAGON_MODEL_ID). So
// the cart's picture is that model, drawn once: textured, three-quarter
// on, lit from the upper left, at item-picture size.
//
// A CPU RASTERISER, NOT A GPU PASS, for the reason ui/meshStamp.js gives
// for its own: the list is a CPU composition and this picture is made
// ONCE. A GPU bake would borrow the main program's camera, lights, fog,
// clusters and shadow recorder mid-frame and hand every one back - the
// exact class of leak AUDIT 26 F034 and AUDIT 65 RS-2 paid for.
//
// THE OUTPUT IS color32 (formats/color32Order.js: RGBA bytes, row 0 the
// picture's BOTTOM), the shape every TEXTURE record reaches the GL in, so
// the classic list uploads it and draws it through the one V-flipped quad
// it draws every item with (ui/itemScroller.js), and the DOM lists turn
// it into a canvas the way they turn a replacement PNG (bitmapCanvas.js
// color32Canvas).
//
// ONE DOOR FOR BOTH SKINS, and it loads its own data - the model out of
// ARCH3D.BSA and its textures out of the TEXTURE archives, through the
// same data seam and the same texture reader the DOM icons use
// (ui/textureCanvas.js) - so no scene has to hand a list its pipeline and
// an icon never waits on which world is loaded.
// ═══════════════════════════════════════════════════════════════════

import { color32Canvas } from './bitmapCanvas.js';

/** The view: a quarter turn off the model's side and a look down onto it - the angle an item picture is drawn at. */
export const ICON_YAW = -0.6;
export const ICON_PITCH = 0.42;
/** The key light, in VIEW space (x right, y up, z toward the viewer): from the upper left and in front. */
export const ICON_LIGHT = Object.freeze([-0.45, 0.7, 0.55]);
/** The light's floor - the far side is shaded, never black. */
export const ICON_AMBIENT = 0.45;
/** The bake's square, before the crop: a classic item picture's scale (a list cell is 50x38 inside a 2px margin). */
export const ICON_SIZE = 44;

/**
 * Bake `model` (meshReader's dfMeshToModel record: positions, uvs, indices, subMeshes [{textureArchive,
 * textureRecord, startIndex, primitiveCount}]) into a picture no bigger than `size` square, cropped to what it drew.
 * `texels(archive, record)` answers the record's color32 (`{width, height, colors}`, RGBA, bottom row first) or null.
 * Pixels no triangle covers are transparent. Answers null for a model with nothing to draw.
 * @param {{positions: ArrayLike<number>, uvs?: ArrayLike<number>, indices: ArrayLike<number>,
 *          subMeshes?: Array<{textureArchive:number, textureRecord:number, startIndex:number, primitiveCount:number}>}} model
 * @param {(archive:number, record:number) => ({width:number, height:number, colors:ArrayLike<number>}|null)} texels
 * @param {{size?: number, pad?: number, yaw?: number, pitch?: number}} [opts]
 * @returns {{width:number, height:number, colors:Uint8ClampedArray}|null}
 */
export function bakeModelIcon(model, texels, { size = ICON_SIZE, pad = 1, yaw = ICON_YAW, pitch = ICON_PITCH } = {}) {
  const pos = model?.positions, idx = model?.indices;
  if (!pos || !idx || idx.length < 3) return null;
  const n = Math.trunc(pos.length / 3);
  // the model turned into view space: yaw about y, then pitch about x
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const vx = new Float32Array(n), vy = new Float32Array(n), vz = new Float32Array(n);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < n; i++) {
    const px = pos[i * 3], py = pos[i * 3 + 1], pz = pos[i * 3 + 2];
    const rx = px * cy + pz * sy, rz = -px * sy + pz * cy;
    const ry = py * cp - rz * sp, rz2 = py * sp + rz * cp;
    vx[i] = rx; vy[i] = ry; vz[i] = rz2;
    if (rx < x0) x0 = rx;
    if (rx > x1) x1 = rx;
    if (ry < y0) y0 = ry;
    if (ry > y1) y1 = ry;
  }
  const span = Math.max(x1 - x0, y1 - y0);
  if (!(span > 0)) return null;
  const w = Math.max(1, Math.trunc(size));
  const k = (w - 2 * pad) / span;
  const ox = pad + ((w - 2 * pad) - (x1 - x0) * k) / 2, oy = pad + ((w - 2 * pad) - (y1 - y0) * k) / 2;
  // screen space, y DOWN (row 0 the top) while rasterising; flipped into color32 order at the end
  const sx = (i) => ox + (vx[i] - x0) * k;
  const sy2 = (i) => w - (oy + (vy[i] - y0) * k);
  const rgba = new Uint8ClampedArray(w * w * 4);
  const depth = new Float32Array(w * w).fill(-Infinity);
  const L = ICON_LIGHT, ll = Math.hypot(L[0], L[1], L[2]);
  const subs = model.subMeshes?.length ? model.subMeshes
    : [{ textureArchive: -1, textureRecord: -1, startIndex: 0, primitiveCount: Math.trunc(idx.length / 3) }];
  const uvs = model.uvs ?? null;
  let drew = false, bx0 = w, bx1 = -1, by0 = w, by1 = -1;
  for (const sm of subs) {
    const tex = texels(sm.textureArchive, sm.textureRecord);
    const end = Math.min(idx.length, sm.startIndex + sm.primitiveCount * 3);
    for (let t = sm.startIndex; t + 2 < end; t += 3) {
      const a = idx[t], b = idx[t + 1], c = idx[t + 2];
      // the face's own facing, in view space: lit by the key light, both sides (a picture has no back)
      const ux = vx[b] - vx[a], uy = vy[b] - vy[a], uz = vz[b] - vz[a];
      const wx = vx[c] - vx[a], wy = vy[c] - vy[a], wz = vz[c] - vz[a];
      const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
      const nl = Math.hypot(nx, ny, nz);
      if (!(nl > 0)) continue;
      const shade = ICON_AMBIENT + (1 - ICON_AMBIENT) * Math.abs((nx * L[0] + ny * L[1] + nz * L[2]) / (nl * ll));
      const ax = sx(a), ay = sy2(a), bx = sx(b), by = sy2(b), cx = sx(c), cyy = sy2(c);
      const area = (bx - ax) * (cyy - ay) - (by - ay) * (cx - ax);
      if (Math.abs(area) < 1e-9) continue;
      const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx))), maxX = Math.min(w - 1, Math.ceil(Math.max(ax, bx, cx)));
      const minY = Math.max(0, Math.floor(Math.min(ay, by, cyy))), maxY = Math.min(w - 1, Math.ceil(Math.max(ay, by, cyy)));
      for (let py = minY; py <= maxY; py++) {
        for (let px = minX; px <= maxX; px++) {
          const qx = px + 0.5, qy = py + 0.5;
          const w0 = ((bx - qx) * (cyy - qy) - (by - qy) * (cx - qx)) / area;
          const w1 = ((cx - qx) * (ay - qy) - (cyy - qy) * (ax - qx)) / area;
          const w2 = 1 - w0 - w1;
          if (w0 < 0 || w1 < 0 || w2 < 0) continue;
          const z = w0 * vz[a] + w1 * vz[b] + w2 * vz[c];
          const o = py * w + px;
          if (z <= depth[o]) continue;   // the nearer face wins: z grows toward the viewer
          depth[o] = z;
          let r = 150, g = 120, bl = 90;   // an unreadable texture draws the wood it most likely is, never a hole
          if (tex && uvs && tex.width > 0 && tex.height > 0) {
            const u = w0 * uvs[a * 2] + w1 * uvs[b * 2] + w2 * uvs[c * 2];
            const v = -(w0 * uvs[a * 2 + 1] + w1 * uvs[b * 2 + 1] + w2 * uvs[c * 2 + 1]);   // meshReader stores -(V / height)
            const col = Math.min(tex.width - 1, Math.floor((u - Math.floor(u)) * tex.width));
            const rowTop = Math.min(tex.height - 1, Math.floor((v - Math.floor(v)) * tex.height));
            const ti = ((tex.height - 1 - rowTop) * tex.width + col) * 4;   // color32: row 0 is the texture's bottom
            r = tex.colors[ti]; g = tex.colors[ti + 1]; bl = tex.colors[ti + 2];
          }
          const p = o * 4;
          rgba[p] = r * shade; rgba[p + 1] = g * shade; rgba[p + 2] = bl * shade; rgba[p + 3] = 255;
          drew = true;
          if (px < bx0) bx0 = px;
          if (px > bx1) bx1 = px;
          if (py < by0) by0 = py;
          if (py > by1) by1 = py;
        }
      }
    }
  }
  if (!drew) return null;
  // cropped to what was drawn, so the list fits the picture by its real shape; into color32 order (row 0 the bottom)
  const cw = bx1 - bx0 + 1, ch = by1 - by0 + 1;
  const colors = new Uint8ClampedArray(cw * ch * 4);
  for (let y = 0; y < ch; y++) {
    const from = ((by0 + y) * w + bx0) * 4;
    colors.set(rgba.subarray(from, from + cw * 4), (ch - 1 - y) * cw * 4);
  }
  return { width: cw, height: ch, colors };
}

// ── THE DOOR: a model id in, its picture out, loaded once ─────────────────────────────────────────────────────────

/** id -> the picture, or null for a model that will not draw (cached, never asked again). */
const _pictures = new Map();
/** id -> the repaints waiting on a picture in flight. */
const _waiting = new Map();
/** `${id}_${scale}` -> data URL */
const _urls = new Map();
let _source = null;

/** The game's own data, read through the seams the DOM icons read: ARCH3D.BSA through the data source, each
 *  submesh's TEXTURE archive through textureCanvas's reader, a user replacement of a record first (M-TEX - the
 *  world's wagon wears it, so its picture does). Answers `{model, texels}` or null. */
function arena2Source() {
  let arch = null;
  return async (id) => {
    const [{ getBytes }, { Arch3dFile }, { dfMeshToModel }, { textureArchive }, repl] = await Promise.all([
      import('../scenes/dataSource.js'),
      import('../formats/arch3dFile.js'),
      import('../world/meshReader.js'),
      import('./textureCanvas.js'),
      import('../systems/textureReplacement.js'),
    ]);
    arch ??= getBytes('ARCH3D.BSA').then((bytes) => { const a = new Arch3dFile(); return a.load(bytes) ? a : null; });
    const a = await arch;
    const index = a ? a.getRecordIndex(id) : -1;
    if (index < 0) return null;
    const dfMesh = a.getMesh(index);
    const files = new Map();
    for (const sm of dfMesh.subMeshes) {
      if (!files.has(sm.textureArchive)) files.set(sm.textureArchive, (await textureArchive(sm.textureArchive))?.file ?? null);
    }
    const has = (arc, rec) => { const f = files.get(arc); return f && rec >= 0 && rec < f.recordCount ? f : null; };
    const model = dfMeshToModel(dfMesh, (arc, rec) => {
      const f = has(arc, rec);
      return f ? { width: f.getWidth(rec), height: f.getHeight(rec) } : { width: 64, height: 64 };
    });
    const tex = new Map();
    for (const sm of model.subMeshes) {
      const key = `${sm.textureArchive}_${sm.textureRecord}`;
      if (tex.has(key)) continue;
      const swap = repl.hasTextureReplacement(sm.textureArchive, sm.textureRecord, 0, 'Albedo')
        ? await repl.preloadTextureRecord(sm.textureArchive, sm.textureRecord, 0, 'Albedo').catch(() => null)
        : null;
      const f = has(sm.textureArchive, sm.textureRecord);
      // a MODEL texture is opaque (MaterialReader's alphaIndex -1 - scenes/dataPipeline.js uploadRecord's `opaque`)
      tex.set(key, swap ?? (f ? f.getColor32(f.getDFBitmap(sm.textureRecord, 0), -1) : null));
    }
    return { model, texels: (arc, rec) => tex.get(`${arc}_${rec}`) ?? null };
  };
}

/**
 * The picture of model `id`, or null while it is not here yet (or never will be).
 * SYNCHRONOUS, like textureCanvas.requestIcon: a list that draws every frame, or rebuilds its DOM, cannot await.
 * The first ask starts the one load; every `onReady` handed while it is in flight fires once when it lands.
 * `source` is a test's seam - `(id) => Promise<{model, texels}|null>`.
 * @param {number} id
 * @param {{onReady?: (() => void)|null, source?: ((id:number) => Promise<any>)|null}} [opts]
 * @returns {{width:number, height:number, colors:Uint8ClampedArray}|null}
 */
export function requestModelIcon(id, { onReady = null, source = null } = {}) {
  if (!Number.isInteger(id) || id <= 0) return null;
  if (_pictures.has(id)) return _pictures.get(id);
  const waiting = _waiting.get(id);
  if (waiting) { if (onReady) waiting.push(onReady); return null; }
  const wake = onReady ? [onReady] : [];
  _waiting.set(id, wake);
  const load = source ?? (_source ??= arena2Source());
  Promise.resolve().then(() => load(id)).then((got) => {
    const pic = got ? bakeModelIcon(got.model, got.texels) : null;
    if (!pic) console.warn(`[icons] model ${id} would not draw`);
    _pictures.set(id, pic);
  }, (e) => {
    console.warn(`[icons] model ${id} would not load`, e);
    _pictures.set(id, null);
  }).finally(() => {
    _waiting.delete(id);
    for (const f of wake) { try { f(); } catch { /* a repaint's own fault is its own */ } }
  });
  return null;
}

/** The picture as a data URL, for the DOM lists (the enhanced skin's tiles), scaled as textureCanvas scales a
 *  record. Null while it loads; `onReady` as requestModelIcon's. */
export function requestModelIconUrl(id, { scale = 2, onReady = null, source = null } = {}) {
  const key = `${id}_${scale}`;
  if (_urls.has(key)) return _urls.get(key);
  const pic = requestModelIcon(id, { onReady, source });
  if (!pic || typeof document === 'undefined') return null;
  const cv = color32Canvas(pic, { scale });
  if (!cv) return null;
  const url = cv.toDataURL('image/png');
  _urls.set(key, url);
  return url;
}

/** Test seam: forget every picture. */
export function _resetModelIcons() { _pictures.clear(); _waiting.clear(); _urls.clear(); _source = null; }
