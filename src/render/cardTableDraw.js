// @ts-check
// CARDS3 (2026-10-07, bible/11-Multiplayer/Tavern-Cards.md section 3): THE CARDS' BODIES ON THE GL. A card is a thin
// plate - a face, a back and an edge - and a chip a short drum; both drawn through the renderer's own path (createMesh,
// uploadTexture, drawMesh), one mesh per card face (the atlas's cell in its UVs) and one per chip value, made once when
// the table opens and freed when it closes (EVERY ALLOCATION HAS AN OWNER - the host's closeCardGame).
//
// THE ART IS OURS. No pixel here comes from ARENA2 (Port-Doctrine: A RENDER OF GAME DATA IS GAME DATA): the atlas is
// PAINTED on a canvas when the table opens - each face its rank and suit in its corners and its suit in its middle, the
// back a red lattice, the edge plain card stock, each chip value its own colour with a stock-white edge band.
//
// THE LAYOUT AND THE MESHES ARE PURE (atlasCell, cardModel, chipModel, cardMatrix): pinned by test/cards3_draw.test.js;
// only the painting needs a page.
//
// Not a DFU member: Daggerfall Unity has no card games. Ledger A row (TAVERN CARDS).
import { RANKS, rankOf, suitOf, isCard } from '../net/cardLaw.js';
import { CARD_W, CARD_L, CARD_T, CHIP_R, CHIP_T, CHIP_VALUES } from '../world/cardMotion.js';
import { trs } from '../world/mat4.js';
import { toColor32 } from '../formats/color32Order.js';
import { SUIT_GLYPHS } from '../ui/cardTableHud.js';   // the suits' one home - the panel's and the cloth's alike

/** The atlas's archive and record - a string archive (no mips by the renderer's own rule for string keys). */
export const CARD_ARCHIVE = 'cards';
export const CARD_RECORD = 'atlas';
/** The atlas: 13 columns (the ranks) by 5 rows (the four suits, and a row of the back, the stock and the chips). */
export const CARD_CELL_W = 64;
export const CARD_CELL_H = 90;
export const CARD_ATLAS_COLS = 13;
export const CARD_ATLAS_ROWS = 5;
export const ATLAS_W = CARD_CELL_W * CARD_ATLAS_COLS;
export const ATLAS_H = CARD_CELL_H * CARD_ATLAS_ROWS;
/** The fifth row's cells: the back, the stock (an edge's plain card), then one per chip value. */
export const CELL_BACK = Object.freeze([0, 4]);
export const CELL_STOCK = Object.freeze([1, 4]);
export const chipCell = (i) => [2 + i, 4];
/** MEASURE (CARDS3): the chips' colours by value - CHIP_VALUES' order (500, 100, 25, 5, 1). */
export const CHIP_COLOURS = Object.freeze(['#6a2c8a', '#1a1a1a', '#1d6b2a', '#a51c1c', '#e8e2d0']);
/** MEASURE (CARDS3): the faces' suit colours: clubs, diamonds, hearts, spades (cardLaw's order). */
export const SUIT_COLOURS = Object.freeze(['#161616', '#b01818', '#b01818', '#161616']);

/** A card's atlas cell `[col, row]` - its rank's column and its suit's row; the back for a card nobody may see. */
export const atlasCell = (c) => (isCard(c) ? [rankOf(c), suitOf(c)] : CELL_BACK.slice());

/** A cell's UV rectangle, inset half a texel against bleeding: `[u0, v0, u1, v1]` with v up (row 0 at the atlas's top;
 *  the upload's color32 order puts the picture's top at v = 1). */
/** @param {readonly number[]} cell */
export function cellUv(cell) {
  const [col, row] = cell;
  const u0 = (col * CARD_CELL_W + 0.5) / ATLAS_W, u1 = ((col + 1) * CARD_CELL_W - 0.5) / ATLAS_W;
  const v1 = 1 - (row * CARD_CELL_H + 0.5) / ATLAS_H, v0 = 1 - ((row + 1) * CARD_CELL_H - 0.5) / ATLAS_H;
  return [u0, v0, u1, v1];
}

/** One sub-mesh over every triangle of a model, on the atlas. */
const onAtlas = (indices) => [{ textureArchive: CARD_ARCHIVE, textureRecord: CARD_RECORD, startIndex: 0, primitiveCount: indices.length / 3 }];

/**
 * A card's plate: its face (+Y) on `face`'s cell, its back (-Y) on the back's, its four edges on the stock - width
 * along X, length along Z, centred on its middle. The face reads the right way up looking down +Y with the card's top
 * toward +Z.
 * @param {readonly number[]} face  the face's cell (atlasCell)
 */
export function cardModel(face) {
  const w = CARD_W / 2, l = CARD_L / 2, t = CARD_T / 2;
  const positions = [], normals = [], uvs = [], indices = [];
  const quad = (corners, n, uv) => {
    const base = positions.length / 3;
    corners.forEach((c, i) => { positions.push(...c); normals.push(...n); uvs.push(...uv[i]); });
    indices.push(base, base + 2, base + 1, base, base + 3, base + 2);   // counter-clockwise about its normal (the right hand's) - the renderer's front, as every model's
  };
  const [fu0, fv0, fu1, fv1] = cellUv(face), [bu0, bv0, bu1, bv1] = cellUv(CELL_BACK), [su0, sv0, su1, sv1] = cellUv(CELL_STOCK);
  // the face, +Y: the cell's top edge (v1) at +Z and its left edge (u0) at -X - the world is Daggerfall's (Unity's
  // left-handed axes, drawn through mirrorProjectionX), so seen from above with +Z away, +X runs to the RIGHT
  quad([[-w, t, -l], [w, t, -l], [w, t, l], [-w, t, l]], [0, 1, 0], [[fu0, fv0], [fu1, fv0], [fu1, fv1], [fu0, fv1]]);
  // the back, -Y
  quad([[-w, -t, l], [w, -t, l], [w, -t, -l], [-w, -t, -l]], [0, -1, 0], [[bu0, bv1], [bu1, bv1], [bu1, bv0], [bu0, bv0]]);
  // the four edges, on the stock
  const s = [[su0, sv0], [su1, sv0], [su1, sv1], [su0, sv1]];
  quad([[w, -t, -l], [w, -t, l], [w, t, l], [w, t, -l]], [1, 0, 0], s);
  quad([[-w, -t, l], [-w, -t, -l], [-w, t, -l], [-w, t, l]], [-1, 0, 0], s);
  quad([[-w, -t, l], [-w, t, l], [w, t, l], [w, -t, l]], [0, 0, 1], s);
  quad([[w, -t, -l], [w, t, -l], [-w, t, -l], [-w, -t, -l]], [0, 0, -1], s);
  return { positions: new Float32Array(positions), normals: new Float32Array(normals), uvs: new Float32Array(uvs), indices: new Uint32Array(indices), subMeshes: onAtlas(indices) };
}

/** MEASURE (CARDS3): a chip's sides. */
export const CHIP_SIDES = 16;

/**
 * A chip: a drum CHIP_R round and CHIP_T tall, centred on its middle, every face on its value's cell (the cell's top
 * band the edge's stock-white, its body the colour - painted so).
 * @param {number} valueIndex  CHIP_VALUES' index
 */
export function chipModel(valueIndex) {
  const [u0, v0, u1, v1] = cellUv(chipCell(valueIndex));
  const um = (u0 + u1) / 2, vBody = v0 + (v1 - v0) * 0.35, vBand = v0 + (v1 - v0) * 0.9;
  const positions = [], normals = [], uvs = [], indices = [];
  const h = CHIP_T / 2;
  const ring = (k) => [Math.cos((k / CHIP_SIDES) * 2 * Math.PI), Math.sin((k / CHIP_SIDES) * 2 * Math.PI)];
  for (const [y, ny] of [[h, 1], [-h, -1]]) {   // the caps: a fan about the middle
    const c = positions.length / 3;
    positions.push(0, y, 0); normals.push(0, ny, 0); uvs.push(um, vBody);
    for (let k = 0; k < CHIP_SIDES; k++) { const [x, z] = ring(k); positions.push(x * CHIP_R, y, z * CHIP_R); normals.push(0, ny, 0); uvs.push(um + (u1 - um) * 0.6 * x, vBody); }
    for (let k = 0; k < CHIP_SIDES; k++) {
      const a = c + 1 + k, b = c + 1 + ((k + 1) % CHIP_SIDES);
      if (ny > 0) indices.push(c, b, a); else indices.push(c, a, b);
    }
  }
  for (let k = 0; k < CHIP_SIDES; k++) {   // the side: the stock-white band
    const [x0, z0] = ring(k), [x1, z1] = ring(k + 1);
    const base = positions.length / 3;
    positions.push(x0 * CHIP_R, -h, z0 * CHIP_R, x1 * CHIP_R, -h, z1 * CHIP_R, x1 * CHIP_R, h, z1 * CHIP_R, x0 * CHIP_R, h, z0 * CHIP_R);
    normals.push(x0, 0, z0, x1, 0, z1, x1, 0, z1, x0, 0, z0);
    uvs.push(u0, vBand, u1, vBand, u1, v1, u0, v1);
    indices.push(base, base + 2, base + 1, base, base + 3, base + 2);   // the plate's winding
  }
  return { positions: new Float32Array(positions), normals: new Float32Array(normals), uvs: new Float32Array(uvs), indices: new Uint32Array(indices), subMeshes: onAtlas(indices) };
}

/** A card's (or a chip's) matrix: at `pos`, turned `yaw` about the vertical and `roll` about its own length. */
export const cardMatrix = (pos, yaw, roll = 0) => trs(pos[0], pos[1], pos[2], 0, (yaw * 180) / Math.PI, (roll * 180) / Math.PI);

/**
 * Paint the atlas on a 2D context (the page's canvas): the 52 faces, the back, the stock, the chips.
 * @param {CanvasRenderingContext2D} ctx
 */
export function paintAtlas(ctx) {
  ctx.clearRect(0, 0, ATLAS_W, ATLAS_H);
  const cell = (col, row, paint) => { ctx.save(); ctx.translate(col * CARD_CELL_W, row * CARD_CELL_H); paint(); ctx.restore(); };
  const stock = () => { ctx.fillStyle = '#f6efdc'; ctx.fillRect(0, 0, CARD_CELL_W, CARD_CELL_H); };
  for (let s = 0; s < 4; s++) for (let r = 0; r < 13; r++) {
    cell(r, s, () => {
      stock();
      ctx.strokeStyle = '#b8ab88'; ctx.lineWidth = 2; ctx.strokeRect(1, 1, CARD_CELL_W - 2, CARD_CELL_H - 2);
      ctx.fillStyle = SUIT_COLOURS[s];
      const rank = RANKS[r] === 'T' ? '10' : RANKS[r];
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = 'bold 15px Georgia, serif'; ctx.fillText(rank, 11, 11);
      ctx.font = '13px Georgia, serif'; ctx.fillText(SUIT_GLYPHS[s], 11, 25);
      ctx.save(); ctx.translate(CARD_CELL_W - 11, CARD_CELL_H - 11); ctx.rotate(Math.PI);
      ctx.font = 'bold 15px Georgia, serif'; ctx.fillText(rank, 0, 0);
      ctx.font = '13px Georgia, serif'; ctx.fillText(SUIT_GLYPHS[s], 0, -14);
      ctx.restore();
      ctx.font = `${r >= 9 ? 30 : 36}px Georgia, serif`;
      ctx.fillText(r >= 9 ? `${rank}${SUIT_GLYPHS[s]}` : SUIT_GLYPHS[s], CARD_CELL_W / 2, CARD_CELL_H / 2 + 2);
    });
  }
  cell(CELL_BACK[0], CELL_BACK[1], () => {
    ctx.fillStyle = '#f6efdc'; ctx.fillRect(0, 0, CARD_CELL_W, CARD_CELL_H);
    ctx.fillStyle = '#7a1f1f'; ctx.fillRect(4, 4, CARD_CELL_W - 8, CARD_CELL_H - 8);
    ctx.strokeStyle = '#c9a24a'; ctx.lineWidth = 1;
    for (let k = -CARD_CELL_H; k < CARD_CELL_W + CARD_CELL_H; k += 8) { ctx.beginPath(); ctx.moveTo(k, 4); ctx.lineTo(k + CARD_CELL_H, CARD_CELL_H); ctx.stroke(); ctx.beginPath(); ctx.moveTo(k + CARD_CELL_H, 4); ctx.lineTo(k, CARD_CELL_H); ctx.stroke(); }
    ctx.strokeStyle = '#f6efdc'; ctx.lineWidth = 4; ctx.strokeRect(2, 2, CARD_CELL_W - 4, CARD_CELL_H - 4);
  });
  cell(CELL_STOCK[0], CELL_STOCK[1], stock);
  CHIP_VALUES.forEach((_, i) => {
    const [c, r] = chipCell(i);
    cell(c, r, () => {
      ctx.fillStyle = CHIP_COLOURS[i]; ctx.fillRect(0, 0, CARD_CELL_W, CARD_CELL_H);
      ctx.fillStyle = '#f2ead6'; ctx.fillRect(0, 0, CARD_CELL_W, CARD_CELL_H * 0.2);   // the edge's band (the top of the cell, v high)
      for (let k = 0; k < 4; k++) ctx.fillRect(k * 16 + 4, 0, 6, CARD_CELL_H * 0.2 + 2);
    });
  });
}

/**
 * The table's bodies on this renderer. `draw(poses)` draws `{cards, chips}` (world/cardScene.js poses); `destroy()`
 * frees every mesh and the atlas, once. A renderer without the path (a test's) draws nothing and throws nothing.
 * @param {any} renderer
 * @param {{doc?: any}} [opts]
 */
export function createCardTableDraw(renderer, { doc = globalThis.document } = {}) {
  let faces = null, back = null, chips = null, alive = true;
  const build = () => {
    if (faces || !renderer?.createMesh || !doc?.createElement) return;
    const canvas = doc.createElement('canvas');
    canvas.width = ATLAS_W; canvas.height = ATLAS_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    paintAtlas(ctx);
    const img = ctx.getImageData(0, 0, ATLAS_W, ATLAS_H);
    renderer.uploadTexture(CARD_ARCHIVE, CARD_RECORD, toColor32({ width: ATLAS_W, height: ATLAS_H, data: new Uint8Array(img.data.buffer) }));
    faces = Array.from({ length: 52 }, (_, c) => renderer.createMesh(cardModel(atlasCell(c))));
    back = renderer.createMesh(cardModel(CELL_BACK));
    chips = CHIP_VALUES.map((_, i) => renderer.createMesh(chipModel(i)));
  };
  return {
    draw({ cards = [], chips: discs = [] } = {}) {
      if (!alive) return;
      build();
      if (!faces) return;
      for (const c of cards) renderer.drawMesh(isCard(c.card) ? faces[c.card] : back, c.matrix ?? cardMatrix(c.pos, c.yaw, c.roll), null, { noShadow: true });   // CARDS3b: a held card brings its own matrix
      for (const d of discs) { const i = CHIP_VALUES.indexOf(d.value); if (i >= 0) renderer.drawMesh(chips[i], cardMatrix(d.pos, 0), null, { noShadow: true }); }
    },
    destroy() {
      if (!alive) return;
      alive = false;
      if (!faces) return;
      for (const m of [...faces, back, ...chips]) renderer.destroyMesh?.(m);
      renderer.releaseTexture?.(CARD_ARCHIVE, CARD_RECORD);
      faces = back = chips = null;
    },
  };
}
