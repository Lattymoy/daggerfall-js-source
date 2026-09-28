// ═══════════════════════════════════════════════════════════════════
// U54 — A TEXTURE ARCHIVE RECORD, AS SOMETHING THE DOM CAN SHOW.
//
// The port has had TWO halves of this since U50 and never the middle:
// `formats/textureFile.js` reads TEXTURE.### into DFBitmaps, and
// `ui/bitmapCanvas.js` turns a DFBitmap into a canvas. What was
// missing is the part that fetches an archive, keeps it, and hands a
// screen the one record it asked for - which is why U53's pack drew
// two-letter initials where the classic window draws the real icon.
//
// ── WHY IT IS A DATA URL AND NOT A CANVAS ────────────────────────
//
// A canvas is a NODE, and a node lives in exactly one place. These
// screens rebuild their whole DOM on every repaint and the same item
// icon can appear in several rows at once (two daggers, a stack, the
// same helm in a list and in a detail panel), so handing out one
// canvas would move it from row to row and leave the others blank.
// A data URL is a VALUE: any number of `<img>` elements can carry it,
// the browser decodes it once, and a repaint costs nothing.
//
// ── IT NEVER TRAPS AND NEVER RETRIES FOREVER ─────────────────────
//
// Every failure - no ARENA2, a missing archive, a record past the end,
// a palette that would not load - is cached as a MISS. The caller gets
// null and shows whatever it shows without one, and the archive is not
// fetched again on the next repaint. A screen that asked 40 times a
// second for a file that does not exist is the shape this guards
// against.
//
// The GL path is untouched: `scenes/dataPipeline.js` still owns
// getTexture/uploadRecord for the classic windows and the world. This
// is the DOM's own door to the same bytes, and both read through
// `scenes/dataSource.js`, which is the port's one data door.
// ═══════════════════════════════════════════════════════════════════

import { bitmapCanvas, color32Canvas, fitCanvas } from './bitmapCanvas.js';
import { clampDpr, ICON_CAP } from './iconFit.js';   // UI1: the fit law's numbers, for requestFittedPicture's key
// SURV-ART: the DOM door needs the VENDOR arm the GL door already has
// (scenes/dataPipeline.js getTexture). A vendored archive has no
// TEXTURE.### to fetch, so `getArchive` below cached it as a miss and
// every DOM screen drew initials where the mod's art should be.
import { isVendorArchive, vendorRecordCount, hasTextureReplacement, preloadTextureRecord } from '../systems/textureReplacement.js';
import { dyeToken, changeDyeBitmap } from '../characters/dyes.js';   // DW3: the dye is part of the ask, so it is part of the key; DYE-ICON: and the classic arm dyes by it
// The name rule lives with the READER (U54 moved it there): both this
// module and scenes/shared.js need it, and neither can import the
// other without dragging in what the other is for.
import { texName } from '../formats/textureFile.js'; import { changeMask } from '../formats/baseImageFile.js';   // HM1: GetInventoryImage's removeMask - the helm's 0xFF halo is a cutout, not a black box

export { texName };

const archives = new Map();   // archive -> Promise<TextureFile|null>
const icons = new Map();      // `${archive}_${record}_${scale}` -> dataURL | null
const waiting = new Map();    // UI1: the same key -> the screens waiting on it, while it is in flight
const settling = new Map();   // DECOR-MODFLATS: the same key -> a promise kept while it is in flight, settled as it lands or misses
let palettePromise = null;

/** UI1: THE SCREENS WAITING ON ONE PICTURE - each told once when it lands. A Set, so a screen asking on every repaint
 *  with the same `onReady` is one entry; and bounded, so a door handed a fresh closure a repaint keeps a handful. */
const WAKE_MAX = 8;
function hear(list, onReady) { if (onReady && list && list.size < WAKE_MAX) list.add(onReady); }
function wakeAll(list) {
  for (const f of list) {
    try { f(); } catch (e) { console.warn('[icons] a screen would not repaint', e); }
  }
}

/** ART_PAL.COL, once. The same palette scenes/world.js hands the
 *  pipeline, and the same one every TEXTURE archive is drawn with. */
function getPalette() {
  palettePromise ??= (async () => {
    try {
      const [{ DFPalette }, { getBytes }] = await Promise.all([
        import('../formats/dfPalette.js'),
        import('../scenes/dataSource.js'),
      ]);
      const pal = new DFPalette();
      pal.load(await getBytes('ART_PAL.COL'), 'ART_PAL.COL');
      return pal;
    } catch (e) {
      console.warn('[icons] ART_PAL.COL unavailable; the DOM screens keep their fallbacks', e);
      return null;
    }
  })();
  return palettePromise;
}

function getArchive(archive) {
  if (archives.has(archive)) return archives.get(archive);
  const p = (async () => {
    try {
      const [{ TextureFile }, { getBytes }] = await Promise.all([
        import('../formats/textureFile.js'),
        import('../scenes/dataSource.js'),
      ]);
      const pal = await getPalette();
      if (!pal) return null;
      const name = texName(archive);
      const t = new TextureFile();
      t.load(await getBytes(name), name, pal);
      return { file: t, palette: pal };
    } catch (e) {
      console.warn(`[icons] ${texName(archive)} unavailable`, e);
      return null;   // cached as a miss - never fetched again
    }
  })();
  archives.set(archive, p);
  return p;
}

/** DISC24-B: the same archive, for a door that reads records as color32 rather than drawing them here - the item
 *  picture a model bakes into (ui/modelIcon.js). One reader, one cache: `{file, palette}` or null, never throws. */
export const textureArchive = (archive) => getArchive(archive);

/** DYE-ICON: an icon's cache key - its record, its scale, its dye's name, and the dye and swatch the classic arm
 *  changes where it does (by number: 18 prints no name, yet a silver blade's picture is not an artifact's). */
const iconKey = (archive, record, scale, dye, dyeTarget) => {
  const token = dyeToken(dye);
  const dyed = dyeTarget != null && dye != null && dye !== '';
  return `${archive}_${record}_${scale}${token ? `_${token}` : ''}${dyed ? `_t${dyeTarget}d${dye}` : ''}`;
};

/**
 * The record as a data URL, or null while it is not here yet.
 *
 * SYNCHRONOUS ON PURPOSE: a screen that rebuilds its DOM cannot await
 * inside a render. It gets what is cached, and `onReady` fires ONCE
 * when a cold record lands so the screen can repaint itself. A record
 * that is already cached fires nothing, so a repaint cannot loop.
 */
export function requestIcon(archive, record, { scale = 2, onReady = null, dye = null, dyeTarget = null } = {}) {
  if (!Number.isInteger(archive) || !Number.isInteger(record) || record < 0) return null;
  const token = dyeToken(dye);
  const key = iconKey(archive, record, scale, dye, dyeTarget);
  // UI1: EVERY SCREEN THAT ASKS WHILE IT IS IN FLIGHT HEARS IT LAND, not the first alone. A slot's fitted picture is
  // made from this record at scale 1 (requestFittedPicture below), which the world's loot billboard asks for too
  // (ui/itemIconColor32.js): the second ask's onReady was dropped, and its screen kept its initials until some other
  // repaint. A landed record or a miss has no list, so it hears nothing - a repaint still cannot loop.
  if (icons.has(key)) { hear(waiting.get(key), onReady); return icons.get(key); }
  // IN FLIGHT. Without this the next repaint finds nothing cached and
  // starts a SECOND decode of the same record, and the one after that
  // a third - measured at exactly double the repaints for a three-item
  // pack. It does not loop forever, because the first decode to land
  // caches the answer and every later call is a hit; what it wastes is
  // one decode per repaint until then, which on a list of thirty items
  // is thirty. Bounded waste, not a hang - said precisely, because the
  // first draft of this comment claimed a loop it cannot cause.
  icons.set(key, null);
  const wake = new Set(onReady ? [onReady] : []);
  waiting.set(key, wake);
  /** @type {() => void} */ let settle = () => {};
  settling.set(key, new Promise((res) => { settle = res; }));   // DECOR-MODFLATS: what loadIcon waits on
  const landed = (url) => { icons.set(key, url); waiting.delete(key); settling.delete(key); settle(); wakeAll(wake); };
  const missed = () => { waiting.delete(key); settling.delete(key); settle(); };   // a miss is cached as the null above, and wakes no one
  // SURV-ART: THE VENDOR ARM, FIRST. An archive that exists only as the
  // port's own art (Climates & Calories' 532-539) has no file behind
  // `texName`, so the classic arm below fetched nothing, warned, and
  // cached a permanent miss - the waterskin, the raw meat and every
  // spoiled food drew their two-letter initials forever. The bytes were
  // registered and decoded all along; this is the door they were
  // missing. It takes `decodedTexture`'s color32 shape straight to a
  // canvas rather than through the palette, because a PNG has no index.
  if (isVendorArchive(archive)) {
    if (record >= vendorRecordCount(archive)) { console.warn(`[icons] vendored archive ${archive} has no record ${record}`); missed(); return null; }
    // DISC22-D: THIS record, by the item's dye - the ask GetItemImage makes (ItemHelper.cs:458). The whole-archive
    // preload skips a LAZY entry (Roleplay Realism Items' 514-526), and the bare read asked for the undyed name no
    // metal file answers, so the Steel Light Flail cached a miss and drew its initials.
    preloadTextureRecord(archive, record, 0, 'Albedo', dye).then((img) => {
      if (!img) { console.warn(`[icons] vendored ${archive}_${record}-0${token ? `_${token}` : ''} would not decode`); missed(); return; }
      const canvas = color32Canvas(img, { scale });
      if (!canvas) { missed(); return; }
      landed(canvas.toDataURL('image/png'));
    }).catch((e) => { missed(); console.warn(`[icons] vendored ${archive}_${record}-0 would not load`, e); });
    return null;
  }
  // DW3: A REPLACEMENT OF A REAL ARCHIVE'S RECORD, BY THE ITEM'S DYE -
  // GetItemImage's first arm (ItemHelper.cs:458: TryImportTexture by
  // item.dyeColor, the imported texture drawn as it is, no mask strip,
  // no ChangeDye). Diverse Weapons' icons (233/234 in every metal)
  // enter here; so does a pack's `233_5-0_Iron`. The archive's
  // replacements decode where the GL door decodes them (getTexture ->
  // preloadTextureArchive), and a name that will not decode falls to
  // the classic arm below, as DFU's failed import does.
  const swap = hasTextureReplacement(archive, record, 0, 'Albedo', dye)
    ? preloadTextureRecord(archive, record, 0, 'Albedo', dye).catch(() => null)   // AUDIT-DW F1: this record alone, when it is drawn
    : Promise.resolve(null);
  swap.then((img) => {
    if (img) {
      const canvas = color32Canvas(img, { scale });
      if (!canvas) { missed(); return; }
      landed(canvas.toDataURL('image/png'));
      return;
    }
    return getArchive(archive).then((got) => {
    if (!got) { missed(); return; }
    try {
      if (record >= got.file.recordCount) {
        console.warn(`[icons] ${texName(archive)} has no record ${record}`);
        missed();
        return;
      }
      // HM1: ItemHelper.cs GetInventoryImage -> GetItemImage(item, removeMask: true); DYE-ICON: then ChangeDye by the
      // item's dye on the swatch it names (:473-476) - the classic arm drew every metal as the base one
      const bmp = changeDyeBitmap(changeMask(got.file.getDFBitmap(record, 0)), dye, dyeTarget);
      const rgb = (i) => { const c = got.palette.get(i); return [c.r, c.g, c.b]; };
      const canvas = bitmapCanvas(bmp, rgb, { scale });
      if (!canvas) { missed(); return; }
      landed(canvas.toDataURL('image/png'));
    } catch (e) {
      missed();
      console.warn(`[icons] ${texName(archive)} record ${record} would not draw`, e);
    }
    });
  }).catch((e) => { missed(); console.warn(`[icons] ${archive}_${record} would not draw`, e); });   // DECOR-MODFLATS: a throw settles it too
  return null;
}

// ── UI1: THE PICTURE FITTED TO ITS SLOT ──────────────────────────
//
// requestIcon draws a record at a whole-number scale, and the sheet then SHRANK what it drew into a 30px cap: a
// longsword's 176px canvas at 30, a gem's 22 at 22 in a 56px slot (bible/10-UI/Slots-Hotbar-Status.md UI0). This is
// the door a slot asks instead: the picture at its own size (scale 1, through the door above - its vendored arm, its
// replacement by the dye, its classic record with the mask stripped - or a model's bake), fitted to the slot's BOX by
// the law in ui/iconFit.js and made at exactly the device size it is drawn at (bitmapCanvas.js fitCanvas), so the
// page resamples nothing. Cached by the picture, the box, the device pixel ratio and the cap.

const fitted = new Map();      // `${picture}@${box}x${dpr}c${cap}` -> { src, w, h, smooth } | null
const fitWaiting = new Map();  // the same key -> the screens waiting on it, while it is made
/** AUDIT UI A4: how many fitted pictures are kept - every zoom and every HUD scale is a new set, and a picture that never
 *  comes held its waiters for good. Past this the OLDEST asked goes, and its waiters with it (a picture on screen keeps
 *  its source; asked again, it is made again). */
export const FIT_CACHE_MAX = 600;

/** A picture's data URL as the fitted picture, or null (a page with no Image or no 2D canvas - node, the pins). */
async function fitUrl(url, opts) {
  if (typeof Image === 'undefined' || typeof document === 'undefined') return null;
  const pic = new Image();
  pic.src = url;
  await pic.decode();
  const src = document.createElement('canvas');
  src.width = pic.naturalWidth;
  src.height = pic.naturalHeight;
  const ctx = src.getContext('2d');
  if (!ctx || !(src.width > 0) || !(src.height > 0)) return null;
  ctx.drawImage(pic, 0, 0);
  const out = fitCanvas(src, opts);
  return out ? { src: out.canvas.toDataURL('image/png'), w: out.cssW, h: out.cssH, smooth: out.smooth } : null;
}

/**
 * The picture `name` names, fitted to a `box` CSS pixels a side at `dpr`: `{ src, w, h, smooth }` (w and h its CSS
 * size), or null while it is made - `onReady` fires once when it lands, as requestIcon's - and for a picture that
 * never comes. `ask(onReady)` is the picture's own door at scale 1 (a data URL, or null while it loads).
 * SYNCHRONOUS for requestIcon's reason: a screen that rebuilds its DOM cannot await inside a render.
 * `trim: false` (UI2) fits the whole picture, margin and all - a spell icon's square.
 * @param {string} name @param {(onReady: (() => void)|null) => string|null} ask
 * @param {{ box: number, dpr?: number, cap?: number, trim?: boolean, onReady?: (() => void)|null }} opts
 */
export function requestFittedPicture(name, ask, { box, dpr = 1, cap = ICON_CAP, trim = true, onReady = null } = /** @type {any} */ ({})) {
  if (!(box > 0) || typeof ask !== 'function') return null;
  const r = clampDpr(dpr);
  const key = `${name}@${box}x${r}c${cap}${trim ? '' : 'w'}`;
  if (fitted.has(key)) { hear(fitWaiting.get(key), onReady); return fitted.get(key); }
  fitted.set(key, null);
  while (fitted.size > FIT_CACHE_MAX) {
    const oldest = fitted.keys().next().value;
    fitted.delete(oldest);
    fitWaiting.delete(oldest);
  }
  const wake = new Set(onReady ? [onReady] : []);
  fitWaiting.set(key, wake);
  const make = () => {
    const url = ask(null);
    if (!url) { fitWaiting.delete(key); return; }
    fitUrl(url, { box, dpr: r, cap, trim }).then((pic) => {
      fitWaiting.delete(key);
      if (!pic) return;
      fitted.set(key, pic);
      wakeAll(wake);
    }, (e) => { fitWaiting.delete(key); console.warn(`[icons] ${name} would not fit its slot`, e); });
  };
  if (ask(make)) make();
  return null;
}

/** Test seam: the fitted pictures asked for so far, by key (made, in flight, or never coming). */
export const _fittedKeys = () => [...fitted.keys()];

/** A record's picture's name - its archive, its record and the dye it is drawn in, and (DYE-ICON) the swatch the classic
 *  arm dyes by it: what makes two pictures one. MERGE (UI1 x DYE-ICON): requestIcon's own key law, less the scale - a
 *  silver blade (18, a dye with no name) and the base one are two pictures here too, where the name alone made them one. */
export function iconName(archive, record, dye = null, dyeTarget = null) {
  const token = dyeToken(dye);
  const dyed = dyeTarget != null && dye != null && dye !== '';
  return `${archive}_${record}${token ? `_${token}` : ''}${dyed ? `_t${dyeTarget}d${dye}` : ''}`;
}

/** A texture record fitted to its slot - requestFittedPicture over requestIcon at scale 1, by the item's dye and the
 *  swatch it changes (DYE-ICON's `dyeTarget`, systems/itemDye.js itemDyeTarget). */
export function requestFittedIcon(archive, record, { box, dpr = 1, cap = ICON_CAP, dye = null, dyeTarget = null, onReady = null } = /** @type {any} */ ({})) {
  if (!Number.isInteger(archive) || !Number.isInteger(record) || record < 0) return null;
  return requestFittedPicture(iconName(archive, record, dye, dyeTarget),
    (wake) => requestIcon(archive, record, { scale: 1, dye, dyeTarget, onReady: wake }), { box, dpr, cap, onReady });
}

/** UI1: A FITTED PICTURE AS ITS ELEMENT. Its own CSS size - the device size it was made at, so the page resamples
 *  nothing and its pixels are the ones the law drew (whole ones, `.fit`; resampled ones, `.fit.smooth`) - and never
 *  past its box: a slot the page draws smaller shrinks it whole (`object-fit`). It is drawn pixelated (the sheets'
 *  `img.fit` since AUDIT UI A1 - lossless at 1:1 wherever it lands); the one slot the page shrinks it into on purpose, a
 *  phone's accessory socket, smooths it by its own rule. Never the browser's own image drag (HB1b): a pane's drag lives
 *  under it. */
export function fittedImg(pic) {
  const img = document.createElement('img');
  img.alt = '';
  img.draggable = false;
  return showFitted(img, pic);
}

/** UI2: a fitted picture put into an `<img>` that already stands (the hotbar's slots keep theirs across their items):
 *  its source, its size and its marks, as fittedImg makes them. Answers the element. */
export function showFitted(img, pic) {
  img.classList.add('fit');
  img.classList.toggle('smooth', !!pic.smooth);
  img.src = pic.src;
  // AUDIT UI A1: NO INLINE 'auto'. A picture made at its device size and drawn at it is copied pixel for pixel only under
  // nearest neighbour: centred in its slot it lands between device pixels, and 'auto' blended every one of them (13 of
  // 13 at 1.25x, 1.5x, 1.75x and a phone's 2.625x). The sheets say `pixelated` (`img.fit`), lossless at 1:1 whatever
  // the offset; the one picture the page shrinks on purpose - a phone's accessory socket - is smoothed by its own rule.
  Object.assign(img.style, {
    width: `${pic.w}px`, height: `${pic.h}px`, maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', imageRendering: '',
  });
  return img;
}

/** Test seam, and the door a host would use to warm a list up front.
 *  Resolves to the data URL or null - never throws.
 *
 *  DECOR-MODFLATS (2026-09-27, Discord: "Above #49 decorations stopped working. Most sprites decorations are invisable
 *  above this number"): IT WAITS FOR THE PICTURE, landed or missed. It waited for the classic archive's read and four
 *  turns after it - time enough for a classic record, whose drawing is synchronous once the file is read, and for a
 *  replacement already decoded. A MOD's picture (Detailed Ships' 1210 and 1230, the port's DET stand-ins past 10000)
 *  has no classic file, whose read fails at once, and decodes in its own time - so the answer was read before it
 *  landed, the decorate panel kept "none to be had" for it, and the catalogue's decorations past its classic ones
 *  stood without pictures. */
export async function loadIcon(archive, record, { scale = 2, dye = null, dyeTarget = null } = {}) {
  const already = requestIcon(archive, record, { scale, dye, dyeTarget });
  if (already) return already;
  const key = iconKey(archive, record, scale, dye, dyeTarget);
  await settling.get(key);   // in flight: until it lands or misses; a miss already known: at once
  return icons.get(key) ?? null;
}

// ── U59: THE PAPERDOLL, FOR A SCREEN MADE OF NODES ───────────────
//
// The same problem the icons had, one layer up. `ui/paperDoll.js`
// composites the avatar CPU-side into an RGBA buffer and uploads it as
// a GL texture; a DOM screen cannot use a GL texture, and re-reading
// PaperDollRenderer's layer order, dye bands and offsets to build a
// second doll is how a port ends up with two that disagree. So the
// compositor keeps its buffer and this turns it into a value.
//
// CACHED BY VERSION, not by identity: `refreshPaperDoll` bumps the
// version on every recompose, so wearing a helm invalidates this and
// nothing else does. A repaint with the same version is free.

let dollCache = null;   // { version, scale, url }

/**
 * The live paperdoll as a data URL, or null when there is no doll -
 * no ARENA2, or a compose that has not finished.
 *
 * Synchronous for `requestIcon`'s reason: a screen that rebuilds its
 * DOM cannot await inside a render. Unlike an icon there is nothing to
 * fetch, so there is no `onReady` and no in-flight marker - the pixels
 * are either composed or they are not, and the caller asks again on
 * its next repaint.
 */
export function paperDollDataUrl(pixels, { scale = 3 } = {}) {
  if (!pixels?.rgba) return null;
  if (dollCache && dollCache.version === pixels.version && dollCache.scale === scale) return dollCache.url;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = pixels.width * scale;
    canvas.height = pixels.height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    // The buffer is ALREADY RGBA at the panel's own 110x184, so this
    // is a blit and a nearest-neighbour scale rather than a redraw -
    // and the scale must not smooth, or a 1-bit Daggerfall sprite
    // turns to soup.
    const src = document.createElement('canvas');
    src.width = pixels.width;
    src.height = pixels.height;
    const sctx = src.getContext('2d');
    if (!sctx) return null;
    sctx.putImageData(new ImageData(new Uint8ClampedArray(pixels.rgba), pixels.width, pixels.height), 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
    const url = canvas.toDataURL('image/png');
    dollCache = { version: pixels.version, scale, url };
    return url;
  } catch (e) {
    console.warn('[paperdoll] the composite would not draw', e);
    return null;
  }
}
