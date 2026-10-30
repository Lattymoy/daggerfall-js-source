// @ts-check
// ═══════════════════════════════════════════════════════════════════
// FAR-FLORA (2026-10-26, the owner: "on top of distant view, no flora/trees show. Its just a plain green flat texture.
// No band aids for any of this"; bible/06-Systems/Travel-View.md FAR-FLORA): THE CANOPY'S ART - the colour and the size
// of a climate's Trees as the game draws them near, read off the player's own pictures, for the far views' woods.
//
// A climate's Trees are its summer nature archive's Tree records (world/terrain/terrainNature.js TREE_RECORDS - the
// records FOREST1 stands in the woods and Logging fells). Their colour is the mean of their opaque texels - the picture
// that is drawn near: a replacement's where one is decoded (systems/textureReplacement.js decodedTexture: Vanilla
// Enhanced's, a season's), else the classic record's (the pipeline's classicRgba) - and their size the classic record's
// billboard (world/rmbFlats.js scaledBillboardSize: MeshReader.GetScaledBillboardSize). Read once an archive, off the
// frame (the pipeline's own reads, awaited); until an archive's art is in, its woods are not drawn (the ground stands
// bare, as before), and `version` moves when it lands so the far views are built again with it.
//
// THE QUALITY KNOB: the woods stand with Land View FLORA_MIN_LAND_VIEW and up (the Graphics preset's Medium, High and
// Ultra); Low's 3 keeps the far views' cost and look of before. `?farflora=off` stands them down. TESA-LANDS: a zone's own.
// ═══════════════════════════════════════════════════════════════════

import { TREE_RECORDS } from '../world/terrain/terrainNature.js';
import { floraSpec } from '../world/terrain/floraCover.js';
import { getWorldClimateSettings, CLIMATE_BASE_TYPES } from '../formats/mapsFile.js';
import { scaledBillboardSize } from '../world/rmbFlats.js';
import { textureDeriveContext, decodedTexture, decodedTextureTopDown } from '../systems/textureReplacement.js';
import { landsFloraSpec, landsTreePicks } from '../world/terrain/floraCover.js'; // TESA-LANDS: a zone's own woods, and its Trees
import { LANDS, landKeyAt } from '../world/tamriel/tamrielLands.js';
import { compileDress, setPrototypes, dressRecord, landLuminance, DRESS_DIALS } from '../world/tamriel/groundDress.js';

/** The least Land View the far woods stand at (systems/graphicsPresets.js: Low 3, Medium 4, High 5, Ultra 6). */
export const FLORA_MIN_LAND_VIEW = 4;

/** ?farflora=off - the far woods' kill door (the far views' ground stands bare, as before). */
export function floraDisabled(search = globalThis.location?.search) {
  try {
    return /[?&]farflora=off\b/.test(search ?? '');
  } catch {
    return false;
  }
}

/** The mean colour of a picture's opaque texels (rgba, alpha over 0; every texel with `all` - a ground tile is opaque
 *  whatever its index 0) - [r, g, b, count]. Pure. */
export function opaqueMean(data, all = false) {
  let r = 0,
    g = 0,
    b = 0,
    n = 0;
  for (let i = 0; i + 3 < data.length; i += 4) {
    if (!all && !data[i + 3]) continue;
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    n++;
  }
  return n ? [r / n, g / n, b / n, n] : [0, 0, 0, 0];
}

/**
 * An archive's Trees as the far views draw them: `{ rgb, h, w }` - the opaque texels' mean over every Tree record (each
 * picture's texels counted, so a big tree weighs as it shows), and their billboards' mean height and width (world units)
 * - or null where the archive has no Tree table or none of its pictures reads. `read` the pictures: `rgba(archive,
 * record)` a drawn picture ({ data: rgba }), `size(archive, record)` its billboard ({ w, h }).
 * @param {number} archive @param {{ rgba: (a: number, r: number) => Promise<?{ data: ArrayLike<number> }>, size: (a: number, r: number) => Promise<?{ w: number, h: number }> }} read
 */
export async function treeArt(archive, read) {
  const records = TREE_RECORDS[archive];
  if (!records) return null;
  let r = 0,
    g = 0,
    b = 0,
    n = 0,
    h = 0,
    w = 0,
    sized = 0;
  for (const record of records) {
    const pic = await read.rgba(archive, record).catch(() => null);
    if (pic?.data) {
      const m = opaqueMean(pic.data);
      r += m[0] * m[3];
      g += m[1] * m[3];
      b += m[2] * m[3];
      n += m[3];
    }
    const s = await read.size(archive, record).catch(() => null);
    if (s?.h > 0) {
      h += s.h;
      w += s.w;
      sized++;
    }
  }
  if (!n || !sized) return null;
  return Object.freeze({ rgb: Object.freeze([r / n, g / n, b / n]), h: h / sized, w: w / sized });
}

/** The near ground's tile records the far views' ground is mixed of (world/terrain/terrainTiles.js: DIRT 1, GRASS 2,
 *  STONE 3 - GenerateTileDataJob's classes, the records AssignTiles' lookup lays whole). */
export const GROUND_RECORDS = Object.freeze({ dirt: 1, grass: 2, stone: 3 });

/**
 * A ground archive's tiles as the far views mix them: `{ dirt, grass, stone }`, each record's mean colour - the picture
 * the near ground draws (a replacement's, else the classic record's) - or null where one does not read. `read` as
 * treeArt's.
 * @param {number} archive @param {{ rgba: (a: number, r: number) => Promise<?{ data: ArrayLike<number> }> }} read
 */
export async function groundArt(archive, read) {
  const out = {};
  for (const [k, record] of Object.entries(GROUND_RECORDS)) {
    const pic = await read.rgba(archive, record).catch(() => null);
    if (!pic?.data) return null;
    const m = opaqueMean(pic.data, true);
    if (!m[3]) return null;
    out[k] = Object.freeze([m[0], m[1], m[2]]);
  }
  return Object.freeze(out);
}

/**
 * TESA-LANDS: A ZONE'S TREES AS THE FAR VIEWS DRAW THEM - treeArt's answer over its recipe's Trees (world/terrain/
 * floraCover.js landsTreePicks: its `trees`' and its `cover`'s picks that are TREE_RECORDS', any climate's - treeArt's own
 * kind: a stump or a snag among them is a flat, no canopy - each weighed by its share of the Trees its ground stands),
 * each picture's texels counted by its weight (so a tree drawn twice as often weighs twice), its billboards' size by the
 * same weights; null where none reads.
 * @param {any} recipe @param {Parameters<typeof treeArt>[1]} read
 */
export async function landTreeArt(recipe, read) {
  let r = 0,
    g = 0,
    b = 0,
    n = 0,
    h = 0,
    w = 0,
    sized = 0;
  for (const [archive, record, weight] of landsTreePicks(recipe)) {
    const pic = await read.rgba(archive, record).catch(() => null);
    if (pic?.data) {
      const m = opaqueMean(pic.data);
      r += m[0] * m[3] * weight;
      g += m[1] * m[3] * weight;
      b += m[2] * m[3] * weight;
      n += m[3] * weight;
    }
    const s = await read.size(archive, record).catch(() => null);
    if (s?.h > 0) {
      h += s.h * weight;
      w += s.w * weight;
      sized += weight;
    }
  }
  if (!n || !sized) return null;
  return Object.freeze({ rgb: Object.freeze([r / n, g / n, b / n]), h: h / sized, w: w / sized });
}

/** A picture read as a ground layer (square: a ground tile's). */
const asLayer = (pic) => {
  const side = Math.round(Math.sqrt(pic.data.length / 4));
  return { width: pic.width ?? side, height: pic.height ?? side, colors: pic.data };
};
/** A macrotask's wait: the page draws a frame between a far zone's records (AUDIT: eight zones asked at once dressed
 *  theirs back to back, a 120 ms task). */
const frameBack = () => new Promise((go) => setTimeout(go, 0));
/**
 * TESA-LANDS: A ZONE'S GROUND AS THE FAR VIEWS MIX IT - groundArt's answer for `archive`'s tiles in the zone's `dress`
 * (world/tamriel/groundDress.js dressRecord, each solid record its own class): the drawn picture dressed at the albedo
 * and the pack's exposure (the drawn tiles' land against the classic's, groundDress.js setExposure's - `read.classic` the
 * classic record; 1 where it has none), as scenes/groundSets.js dresses the near ground, a record a task; null where one
 * does not read.
 * @param {any} dress LANDS' `ground` @param {number} archive @param {{ rgba: (a: number, r: number) => Promise<any>, classic?: (a: number, r: number) => Promise<any> }} read
 */
export async function landGroundArt(dress, archive, read) {
  const drawn = [],
    classic = [];
  for (const record of Object.values(GROUND_RECORDS)) {
    const pic = await read.rgba(archive, record).catch(() => null);
    if (!pic?.data) return null;
    drawn[record] = asLayer(pic);
    const c = read.classic ? await read.classic(archive, record).catch(() => null) : null;
    if (c?.data) classic[record] = asLayer(c);
  }
  const protos = setPrototypes(drawn),
    mats = compileDress(dress),
    a = landLuminance(protos),
    b = classic.length ? landLuminance(setPrototypes(classic)) : 0;
  const light = DRESS_DIALS.albedo * (a > 0 && b > 0 ? a / b : 1);
  const out = {};
  for (const [k, record] of Object.entries(GROUND_RECORDS)) {
    await frameBack();
    const m = opaqueMean(dressRecord(drawn[record], record, mats, protos, light).colors, true);
    if (!m[3]) return null;
    out[k] = Object.freeze([m[0], m[1], m[2]]);
  }
  return Object.freeze(out);
}

/** The pipeline's reads (scenes/dataPipeline.js setTextureDeriveContext): a decoded replacement first (the picture drawn
 *  near), else the classic record; the classic record's billboard size; TESA-LANDS the classic record itself (a zone's
 *  dress's exposure). Null while no pipeline is up. */
export function pipelineRead() {
  const ctx = textureDeriveContext();
  if (!ctx) return null;
  return {
    rgba: async (a, r) => {
      const swap = decodedTexture(a, r, 0);
      if (swap?.colors) return { data: swap.colors };
      return ctx.classicRgba(a, r, 0);
    },
    classic: (a, r) => ctx.classicRgba(a, r, 0),
    size: async (a, r) => {
      const [pic, scale] = await Promise.all([ctx.classicRgba(a, r, 0), ctx.classicScale(a, r)]);
      return pic?.width && scale ? scaledBillboardSize({ width: pic.width, height: pic.height }, scale) : null;
    },
  };
}

/** FAR-TREES: the pipeline's pictures as the band's atlas lays them - `picture(archive, record)` top-down rgba ({ width,
 *  height, data }: a decoded replacement's, else the classic record's) and `size(archive, record)` its billboard - or null
 *  while no pipeline is up. */
export function pipelinePictures() {
  const ctx = textureDeriveContext();
  if (!ctx) return null;
  const read = /** @type {NonNullable<ReturnType<typeof pipelineRead>>} */ (pipelineRead());
  return {
    picture: async (a, r) => {
      const swap = decodedTextureTopDown(a, r, 0);
      return swap?.rgba ? { width: swap.width, height: swap.height, data: swap.rgba } : ctx.classicRgba(a, r, 0);
    },
    size: read.size,
  };
}

/**
 * THE BOOK: a climate's flora as the far views build it - `floraOf(climate)`: `{ spec, art, ground }` (world/terrain/
 * floraCover.js floraSpec on its summer nature archive, treeArt's answer for that archive and groundArt's for its ground
 * archive - each null until it is read, the read asked then, once). `version` counts the archives read, so a far view
 * built before one landed is built again. TESA-LANDS: with `lands`, `floraOf(climate, x, y)` past the Bay answers its zone's.
 * @param {{ read?: () => ?ReturnType<typeof pipelineRead>, forests?: () => boolean, lands?: boolean }} [o]
 */
export function createFloraArt({ read = pipelineRead, forests = () => true, lands = false } = {}) {
  const arts = new Map(),
    grounds = new Map(),
    specs = new Map();
  let version = 0;
  const ask = (book, archive, how) => {
    const r = read();
    if (!r) return; // no pipeline yet: asked again on the next build
    book.set(archive, null);
    how(archive, r).then(
      (art) => {
        book.set(archive, art);
        if (art) version++;
      },
      () => book.delete(archive),
    );
  };
  return {
    get version() {
      return version;
    },
    /** The Real forests switch the book reads its climates by (FAR-TREES: the band's layout asks it too). */
    get forests() {
      return !!forests();
    },
    /** TESA-LANDS: the lands' row the book reads its zones by (FAR-TREES: the band's layout asks it too). */
    get lands() {
      return !!lands;
    },
    /** @param {number} climate a CLIMATE.PAK value @param {number} [x] @param {number} [y] the map pixel (TESA-LANDS) */
    floraOf(climate, x, y) {
      let s = specs.get(climate);
      if (!s) {
        const c = getWorldClimateSettings(climate);
        s = {
          archive: c.natureArchive,
          groundArchive: c.groundArchive,
          spec: floraSpec(c.natureArchive, c.climateType === CLIMATE_BASE_TYPES.Desert, forests()),
        };
        specs.set(climate, s);
      }
      // TESA-LANDS: a zone's own woods, Trees and ground where it names them - its climate's where it does not
      const zone = lands && x != null && y != null ? landKeyAt(Math.floor(x), Math.floor(y)) : null,
        land = zone ? /** @type {any} */ (LANDS)[zone] : null;
      const recipe = land?.flora && forests() ? land.flora : null,
        dress = land?.ground ?? null;
      const spec = recipe ? landsFloraSpec(recipe) : s.spec;
      const artKey = recipe ? `lands:${zone}` : s.archive,
        groundArchive = dress ? (dress.base ?? s.groundArchive) : s.groundArchive;
      const groundKey = dress ? `lands:${zone}:${groundArchive}` : s.groundArchive;
      if (!arts.has(artKey) && (spec.treeShare > 0 || spec.coverShare > 0))
        ask(arts, artKey, recipe ? (_, r) => landTreeArt(recipe, r) : treeArt);
      if (!grounds.has(groundKey))
        ask(grounds, groundKey, dress ? (_, r) => landGroundArt(dress, groundArchive, r) : groundArt);
      return { spec, art: arts.get(artKey) ?? null, ground: grounds.get(groundKey) ?? null };
    },
  };
}
