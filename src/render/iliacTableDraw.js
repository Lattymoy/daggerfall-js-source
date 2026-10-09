// @ts-check
// CARDS10 (2026-10-08, bible/11-Multiplayer/Tavern-Cards.md section 33): ILIAC HAND ON THE CLOTH - the collectible game's
// cards as bodies on the tavern table, the Hold'em deck's own plate (render/cardTableDraw.js plateModel: a face, a back,
// an edge, the poker size), drawn through the renderer's own path (createMesh, uploadTexture, drawMesh) in the room's pass
// after the decor, made once when the game opens and freed when it closes (EVERY ALLOCATION HAS AN OWNER - the host's
// close).
//
// THE ART IS OURS (section 6.2, "Painted in code"): the atlas is painted on a canvas when the game opens - every card of
// the first set and every holding in its tile (render/iliacCardFaces.js paintIliacCard, the grid's own face: the emblem,
// the gem, the shield, the name), the back the Bay's compass rose (paintIliacBack). No pixel comes from ARENA2.
//
// THE LAYOUT IS PURE (iliacAtlasCell, iliacCellUv): pinned by test/cards10_table.test.js; only the painting needs a page.
//
// Not a DFU member: Daggerfall Unity has no card games. Ledger A row (TAVERN CARDS).
import { ILIAC_CARDS, ILIAC_LOCATIONS, cardById } from '../net/iliacCards.js';
import { plateModel, cardMatrix } from './cardTableDraw.js';
import { paintIliacCard, paintIliacBack } from './iliacCardFaces.js';
import { toColor32 } from '../formats/color32Order.js';

/** The atlas's archive and record - a string archive (no mips by the renderer's own rule for string keys). */
export const ILIAC_ARCHIVE = 'iliac-cards';
export const ILIAC_RECORD = 'atlas';
/** MEASURE (CARDS10): a cell - the grid's tile (iliacCardFaces.js ILIAC_TILE_MAX_H: its emblem large, its name, no rules
 *  box - the panel carries the words), the card's own shape. */
export const ILIAC_CELL_W = 100;
export const ILIAC_CELL_H = 140;
/** Every card the cloth may show, in the atlas's order: the set's cards, then its holdings. */
export const ILIAC_CLOTH_CARDS = Object.freeze([...ILIAC_CARDS.map((c) => c.id), ...ILIAC_LOCATIONS.map((c) => c.id)]);
export const ILIAC_ATLAS_COLS = 10;
/** The rows: the cards', then one for the back and the stock. */
export const ILIAC_ATLAS_ROWS = Math.ceil(ILIAC_CLOTH_CARDS.length / ILIAC_ATLAS_COLS) + 1;
export const ILIAC_ATLAS_W = ILIAC_CELL_W * ILIAC_ATLAS_COLS;
export const ILIAC_ATLAS_H = ILIAC_CELL_H * ILIAC_ATLAS_ROWS;
const LAST_ROW = ILIAC_ATLAS_ROWS - 1;
export const ILIAC_CELL_BACK = Object.freeze([0, LAST_ROW]);
export const ILIAC_CELL_STOCK = Object.freeze([1, LAST_ROW]);
const INDEX = new Map(ILIAC_CLOTH_CARDS.map((id, i) => [id, i]));

/** A card's cell `[col, row]` - its place in ILIAC_CLOTH_CARDS; the back for a card nobody may see (null, unknown). */
export function iliacAtlasCell(/** @type {any} */ id) {
  const i = INDEX.get(id);
  return i === undefined ? ILIAC_CELL_BACK.slice() : [i % ILIAC_ATLAS_COLS, Math.floor(i / ILIAC_ATLAS_COLS)];
}
/** A cell's UV rectangle `[u0, v0, u1, v1]`, inset half a texel, v up (row 0 at the atlas's top). */
export function iliacCellUv(/** @type {readonly number[]} */ [col, row]) {
  const u0 = (col * ILIAC_CELL_W + 0.5) / ILIAC_ATLAS_W, u1 = ((col + 1) * ILIAC_CELL_W - 0.5) / ILIAC_ATLAS_W;
  const v1 = 1 - (row * ILIAC_CELL_H + 0.5) / ILIAC_ATLAS_H, v0 = 1 - ((row + 1) * ILIAC_CELL_H - 0.5) / ILIAC_ATLAS_H;
  return [u0, v0, u1, v1];
}
const onAtlas = (indices) => [{ textureArchive: ILIAC_ARCHIVE, textureRecord: ILIAC_RECORD, startIndex: 0, primitiveCount: indices.length / 3 }];
/** A card's plate on the Iliac atlas: its face's cell, the back's, the stock's. */
export const iliacCardModel = (/** @type {readonly number[]} */ cell) => plateModel(iliacCellUv(cell), iliacCellUv(ILIAC_CELL_BACK), iliacCellUv(ILIAC_CELL_STOCK), onAtlas);

/** Paint the atlas on a 2D context: every card's tile, the back, the stock. */
export function paintIliacAtlas(/** @type {CanvasRenderingContext2D} */ ctx) {
  ctx.clearRect(0, 0, ILIAC_ATLAS_W, ILIAC_ATLAS_H);
  const cell = (/** @type {readonly number[]} */ [col, row], /** @type {() => void} */ paint) => { ctx.save(); ctx.translate(col * ILIAC_CELL_W, row * ILIAC_CELL_H); paint(); ctx.restore(); };
  ILIAC_CLOTH_CARDS.forEach((id) => cell(iliacAtlasCell(id), () => paintIliacCard(ctx, cardById(id), ILIAC_CELL_W, ILIAC_CELL_H)));
  cell(ILIAC_CELL_BACK, () => paintIliacBack(ctx, ILIAC_CELL_W, ILIAC_CELL_H));
  cell(ILIAC_CELL_STOCK, () => { ctx.fillStyle = '#efe6cf'; ctx.fillRect(0, 0, ILIAC_CELL_W, ILIAC_CELL_H); });
}

/**
 * The game's cards on this renderer. `draw(cards)` draws `[{card, pos, yaw, roll?}]` (world/iliacCloth.js poses - `card`
 * a catalog id, or null for a back); `destroy()` frees every mesh and the atlas, once. A renderer without the path (a
 * test's) draws nothing and throws nothing. A plate is made the first time its card is drawn.
 * @param {any} renderer @param {{doc?: any}} [opts]
 */
export function createIliacTableDraw(renderer, { doc = globalThis.document } = {}) {
  let ready = false, alive = true, back = null;
  const meshes = new Map();
  const build = () => {
    if (ready || !renderer?.createMesh || !doc?.createElement) return;
    const canvas = doc.createElement('canvas');
    canvas.width = ILIAC_ATLAS_W; canvas.height = ILIAC_ATLAS_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    paintIliacAtlas(ctx);
    const img = ctx.getImageData(0, 0, ILIAC_ATLAS_W, ILIAC_ATLAS_H);
    renderer.uploadTexture(ILIAC_ARCHIVE, ILIAC_RECORD, toColor32({ width: ILIAC_ATLAS_W, height: ILIAC_ATLAS_H, data: new Uint8Array(img.data.buffer) }));
    back = renderer.createMesh(iliacCardModel(ILIAC_CELL_BACK));
    ready = true;
  };
  const meshOf = (id) => {
    if (!INDEX.has(id)) return back;
    let m = meshes.get(id);
    if (!m) { m = renderer.createMesh(iliacCardModel(iliacAtlasCell(id))); meshes.set(id, m); }
    return m;
  };
  return {
    draw(/** @type {any[]} */ cards = []) {
      if (!alive) return;
      build();
      if (!ready) return;
      for (const c of cards) renderer.drawMesh(meshOf(c.card), cardMatrix(c.pos, c.yaw, c.roll ?? 0), null, { noShadow: true });
    },
    /** How many plates it holds (the back's among them) - a test's look at its allocations. */
    meshCount: () => meshes.size + (back ? 1 : 0),
    destroy() {
      if (!alive) return;
      alive = false;
      if (!ready) return;
      for (const m of [...meshes.values(), back]) renderer.destroyMesh?.(m);
      renderer.releaseTexture?.(ILIAC_ARCHIVE, ILIAC_RECORD);
      meshes.clear();
      back = null;
      ready = false;
    },
  };
}
