// @ts-check
// ═══════════════════════════════════════════════════════════════════
// DECOR1 (2026-09-25) — THE CATALOGUE: EVERYTHING DAGGERFALL FURNISHES.
//
// Mac, asked what the decorator's catalogue holds: "Everything
// Daggerfall furnishes" - every piece of furniture and decor Daggerfall
// itself places inside its buildings, found in the game data, browsed
// with a turning preview, named where the game names them; and the
// panel "an intuitive scrolling menu with filters".
//
// THE SOURCE is BLOCKS.BSA's own town blocks (RMB): every building
// interior's PROP models - the object type Daggerfall lays out as a
// room's furniture (world/interiorLayout.js PROP_MODEL_TYPE) - and its
// flats, the editor's markers (TEXTURE.199) excepted. A piece is in the
// catalogue because Daggerfall put it in a room; nothing is invented and
// nothing is carried over from a mod. The ladder is left out: placed, it
// would stand in the room and not be climbed (the climb reads the
// room's own ladders, found at build).
//
// THE NAMES are the game's where it has them - the house containers
// World Tooltips names (worldTooltips.js HOUSE_CONTAINER_NAMES), the
// beds, the shop shelves, the lights of TEXTURE.210 as Daggerfall
// Unity's own light table calls them - and otherwise the piece's kind
// with a number, stable for the same game data (numbered in id order
// within its name).
//
// Pure: the blocks are an argument; the host scans BLOCKS.BSA and
// measures each piece's size (the price is by size, net/decorLaw.js).
// ═══════════════════════════════════════════════════════════════════

import { PROP_MODEL_TYPE } from '../world/interiorLayout.js';
import { EDITOR_FLATS_ARCHIVE } from '../world/rmbFlats.js';
import { LADDER_MODEL_ID } from '../player/enterExit.js';
import { BED_MODELS } from './rrRealism.js';
import { isHouseContainerModel } from './containers.js';
import { isShopShelfModel } from './shopStock.js';
import { HOUSE_CONTAINER_NAMES } from './worldTooltips.js';
import { interiorLightProperties } from '../world/interiorLights.js';
import { decorPrice } from '../net/decorLaw.js';

/** A piece's KIND - the panel's filter - and what it reads as. */
export const DECOR_KINDS = Object.freeze({
  bed: 'Beds', storage: 'Storage', shelf: 'Shelves', furniture: 'Furniture',
  light: 'Lights', clothing: 'Clothing', boxes: 'Boxes and bottles', arms: 'Arms and armour',
  books: 'Books and scrolls', misc: 'Odds and ends', treasure: 'Treasure', decor: 'Decorations',
});
/** A kind's own word for one piece of it, where the game gives none. */
const KIND_ONE = Object.freeze({
  bed: 'Bed', storage: 'Cupboard', shelf: 'Shelves', furniture: 'Furniture', light: 'Light', clothing: 'Clothing',
  boxes: 'Box', arms: 'Arms', books: 'Books', misc: 'Odds and ends', treasure: 'Treasure', decor: 'Decoration',
});
/** The flat archives Daggerfall files its interior dressing under (lootDataTables.js DROP_ICON_ARCHIVES names five of
 *  them for the inventory's drop icons; 210 is the lights, 216 the treasure piles). Any other is a decoration. */
const FLAT_ARCHIVE_KIND = Object.freeze({ 204: 'clothing', 205: 'boxes', 207: 'arms', 209: 'books', 210: 'light', 211: 'misc', 216: 'treasure' });
export const LIGHTS_ARCHIVE = 210;
/** TEXTURE.210's records as Daggerfall Unity's own light table names them (world/interiorLights.js). */
const LIGHT_NAMES = Object.freeze({
  0: 'Bowl with fire', 2: 'Skull candle', 3: 'Candle', 4: 'Candle with base', 5: 'Candleholder with three candles',
  6: 'Skull torch', 8: 'Turquoise lamp', 9: 'Chandelier with candles', 11: 'Candle in lamp', 13: 'Round lamp',
  17: 'Mounted torch', 20: 'Brazier torch', 21: 'Standing candle', 22: 'Round lantern', 24: 'Lantern with long chain',
  25: 'Lantern with medium chain', 26: 'Lantern with short chain', 27: 'Lantern',
});

/** A model's kind. */
export function modelKind(model) {
  if (BED_MODELS.includes(model)) return 'bed';
  if (isShopShelfModel(model)) return 'shelf';
  if (isHouseContainerModel(model)) return 'storage';
  return 'furniture';
}
/** A flat's kind, by its archive. */
export const flatKind = (archive) => FLAT_ARCHIVE_KIND[archive] ?? 'decor';

/** The key a catalogue entry and a placed piece share: `m41000`, `f210.4`. */
export const decorKey = (what) => (what.model != null ? `m${what.model}` : `f${what.flat[0]}.${what.flat[1]}`);

/**
 * EVERY PIECE DAGGERFALL PUTS IN A ROOM, over `dfBlocks` (parsed RMB blocks, blocksFile.js's shape): each interior's
 * prop models and its flats, the editor's markers and the ladder left out. Answers a Map key -> `{ model, flat, count }`,
 * `count` how many times Daggerfall places it (the panel's "most common first"). `into` is a Map to add to - the scan
 * (systems/decorScan.js) reads the blocks a few at a time into one.
 * @param {Iterable<any>} dfBlocks
 * @param {Map<string, {model: number|null, flat: number[]|null, count: number}>} [into]
 */
export function collectDecor(dfBlocks, into = new Map()) {
  const out = into;
  const add = (what) => {
    const key = decorKey(what);
    const had = out.get(key);
    if (had) had.count++;
    else out.set(key, { ...what, count: 1 });
  };
  for (const b of dfBlocks ?? []) {
    for (const sub of b?.rmbBlock?.subRecords ?? []) {
      const interior = sub?.interior;
      for (const m of interior?.block3dObjectRecords ?? []) {
        if (m?.objectType !== PROP_MODEL_TYPE) continue;
        const id = m.modelIdNum;
        if (!Number.isSafeInteger(id) || id <= 0 || id === LADDER_MODEL_ID) continue;
        add({ model: id, flat: null });
      }
      for (const f of interior?.blockFlatObjectRecords ?? []) {
        const a = f?.textureArchive;
        const r = f?.textureRecord;
        if (!Number.isSafeInteger(a) || !Number.isSafeInteger(r) || a === EDITOR_FLATS_ARCHIVE || r < 0) continue;
        add({ model: null, flat: [a, r] });
      }
    }
  }
  return out;
}

/**
 * THE CATALOGUE over `collectDecor`'s Map: each piece with its kind, its name, whether it holds things by default (a
 * house container does), the light it carries by default (a TEXTURE.210 light does, with Daggerfall's own settings),
 * and `radius` null until the host measures it. Ordered by kind, then most common first.
 */
/** The light a flat carries by default - a TEXTURE.210 light's, with Daggerfall's own settings, within the piece
 *  law's bounds - or null (any other flat). DECOR2a: a candle of the player's own is lit as the catalogue's is. */
export function decorFlatLight(flat) {
  if (!Array.isArray(flat) || flat[0] !== LIGHTS_ARCHIVE) return null;
  const p = interiorLightProperties(flat[1]);
  return {
    color: (p.color ?? [1, 0.95, 0.8]).map((v) => Math.min(1, Math.max(0, v))),
    range: Math.min(30, Math.max(1, p.range)),
    intensity: Math.min(4, Math.max(0.05, p.intensity)),
  };
}

export function decorCatalogue(collected) {
  const entries = [];
  for (const [key, c] of collected ?? []) {
    const kind = c.model != null ? modelKind(c.model) : flatKind(c.flat[0]);
    const light = c.flat ? decorFlatLight(c.flat) : null;
    const own = c.model != null
      ? (kind === 'storage' ? HOUSE_CONTAINER_NAMES[c.model] : kind === 'bed' ? 'Bed' : null)
      : (kind === 'light' ? LIGHT_NAMES[c.flat[1]] : null);
    entries.push({ key, model: c.model, flat: c.flat, kind, base: own ?? KIND_ONE[kind], count: c.count, storage: kind === 'storage', light, radius: null });
  }
  // a name shared is numbered, in id order (stable for the same game data)
  const byBase = new Map();
  for (const e of entries) {
    const list = byBase.get(e.base) ?? [];
    list.push(e);
    byBase.set(e.base, list);
  }
  const idOrder = (e) => (e.model != null ? e.model : e.flat[0] * 1000 + e.flat[1]);
  for (const list of byBase.values()) {
    list.sort((a, b) => idOrder(a) - idOrder(b));
    list.forEach((e, i) => { e.name = list.length > 1 ? `${e.base} ${i + 1}` : e.base; });
  }
  const kindOrder = Object.keys(DECOR_KINDS);
  entries.sort((a, b) => kindOrder.indexOf(a.kind) - kindOrder.indexOf(b.kind) || b.count - a.count || idOrder(a) - idOrder(b));
  return entries.map((e) => Object.freeze({
    key: e.key, model: e.model, flat: e.flat ? Object.freeze([...e.flat]) : null, kind: e.kind, name: e.name,
    count: e.count, storage: e.storage, light: e.light ? Object.freeze({ ...e.light, color: Object.freeze([...e.light.color]) }) : null,
  }));
}

/** A piece's SIZE band, by its radius in metres - the panel's size filter. */
export const DECOR_SIZES = Object.freeze({ small: 'Small', medium: 'Medium', large: 'Large' });
export function decorSize(radiusMetres) {
  if (!(radiusMetres > 0)) return null;
  if (radiusMetres < 0.5) return 'small';
  if (radiusMetres < 1.25) return 'medium';
  return 'large';
}

/**
 * THE PANEL'S FILTERS over the catalogue: kinds (any of), words (every word found in the name or the kind), a size
 * band, holds-things, gives-light; sorted most common first, by price, or by name. `radiusOf(entry)` is the host's
 * measure (null while unmeasured: such an entry passes no size filter and sorts last by price).
 * @param {readonly any[]} entries
 * @param {{ kinds?: Iterable<string>|null, text?: string, size?: string|null, storage?: boolean|null,
 *   light?: boolean|null, sort?: string, radiusOf?: (entry: any) => (number|null) }} [opts]
 */
export function filterDecor(entries, {
  kinds = null, text = '', size = null, storage = null, light = null, sort = 'common', radiusOf = () => null,
} = {}) {
  const want = kinds && [...kinds].length ? new Set(kinds) : null;
  const words = String(text ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  const out = (entries ?? []).filter((e) => {
    if (want && !want.has(e.kind)) return false;
    if (storage !== null && e.storage !== storage) return false;
    if (light !== null && (e.light !== null) !== light) return false;
    if (size !== null && decorSize(radiusOf(e)) !== size) return false;
    if (words.length) {
      const hay = `${e.name} ${DECOR_KINDS[e.kind]}`.toLowerCase();
      if (!words.every((w) => hay.includes(w))) return false;
    }
    return true;
  });
  if (sort === 'name') out.sort((a, b) => a.name.localeCompare(b.name));
  else if (sort === 'price') {
    const p = (e) => decorPrice(radiusOf(e) ?? 0) || Infinity;
    out.sort((a, b) => p(a) - p(b) || a.name.localeCompare(b.name));
  }
  return out;
}
