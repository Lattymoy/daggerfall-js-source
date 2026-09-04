// AUDIT 58 - THE TWO TARGET-ICON PANELS of the classic inventory and
// trade windows (DaggerfallInventoryWindow.SetupTargetIconPanels
// :424-439, UpdateLocalTargetIcon :857-863, UpdateRemoteTargetIcon
// :865-890; DaggerfallTradeWindow's overrides :630-647).
//
// Both windows carry a 55x34 panel over each list - local (165,12),
// remote (263,12) - whose BACKGROUND is a container picture cut from
// INVE16I0.CIF (ItemHelper.cs:47, GetContainerImage :673-686, indexed
// by InventoryContainerImages) laid out ScaleToFit, and whose LABEL is
// a default shadowed label at panel-relative (1,2) in
// DaggerfallUnityDefaultToolTipTextColor.
//
// The label is the only encumbrance readout either screen has: the
// local one is `GetCarriedWeight() / PlayerEntity.MaxEncumbrance`, the
// remote one is empty except in wagon mode, where it is
// `PlayerEntity.WagonWeight / ItemHelper.WagonKgLimit`. The port drew
// neither panel, so the classic inventory and trade screens showed no
// container picture and no carried/max at all while the enhanced skin
// showed both (enhancedInventory.js's `encumbrance`).
//
// The format is DFU's conditional one, the same law U47's gold panel
// already carries: `String.Format(weight % 1 == 0 ? "{0:F0} / {1}" :
// "{0:F2} / {1}", weight, max)` - a whole number of kilograms prints
// no decimals and anything else prints exactly two.

import { drawImgCrop, shadowText } from './nativePanel.js';
import { DEFAULT_TOOLTIP_TEXT_FG } from './toolTip.js';
import { CifRciFile } from '../formats/cifRciFile.js';
import { TextureFile, texName } from '../formats/textureFile.js';   // G5: the drop icon is a WORLD FLAT's record
import { bitmapToColor32 } from './hud.js';

/** InventoryContainerImages (DaggerfallUnityEnums.cs:540-553) - the
 *  record index into INVE16I0.CIF, in the enum's own order. */
export const CONTAINER_IMAGES = Object.freeze({
  Corpse1: 0, Corpse2: 1, Ground: 2, Wagon: 3, Shelves: 4,
  Chest: 5, Merchant: 6, Anvil: 7, Magic: 8, Backpack: 9, Corpse3: 10,
});
/** ItemHelper.containerIconsFilename (:47). */
export const CONTAINER_ICONS_FILE = 'INVE16I0.CIF';

/** localTargetIconRect / remoteTargetIconRect (:49-50). */
export const LOCAL_TARGET_ICON_RECT = Object.freeze([165, 12, 55, 34]);
export const REMOTE_TARGET_ICON_RECT = Object.freeze([263, 12, 55, 34]);
/** AddDefaultShadowedTextLabel(new Vector2(1, 2), panel) (:428, :435) -
 *  the label's Position inside the panel. */
export const TARGET_ICON_LABEL_POS = Object.freeze([1, 2]);

/** UpdateLocalTargetIcon (:861) / UpdateRemoteTargetIcon (:872), the
 *  conditional format both share. `max` prints as C#'s default float
 *  ToString, which for the two integral limits in play (MaxEncumbrance
 *  and WagonKgLimit 750) is the plain number. */
export function targetIconWeightText(weight, max) {
  const w = Number(weight) || 0;
  return `${w % 1 === 0 ? w.toFixed(0) : w.toFixed(2)} / ${max}`;
}

let _icons = null;      // record -> { tex, w, h }
let _warned = false;
let _deps = null;       // G5: kept for the TEXTURE.### reader below

/** Warm INVE16I0.CIF. A missing CIF is NOT fatal - the panels simply
 *  keep the base INVE00I0 art under them, exactly as a missing
 *  INVE06I0 leaves the scroller's arrows (itemScroller.js). */
export async function preloadContainerIconArt(deps) {
  // G5: the deps are registered BEFORE the early return, or a second
  // host's preload would leave the drop-icon reader without a renderer
  // (paintingImage's setPaintingArtDeps shape, one door earlier).
  if (deps?.renderer && deps?.fetchBytes && deps?.palette) _deps = deps;
  if (_icons) return;
  try {
    const cif = new CifRciFile();
    cif.load(await deps.fetchBytes(CONTAINER_ICONS_FILE), CONTAINER_ICONS_FILE, deps.palette);
    const icons = new Map();
    for (let r = 0; r < cif.recordCount; r++) {
      const bmp = cif.getDFBitmap(r, 0);
      icons.set(r, {
        tex: deps.renderer.uploadTexture('cif', `${CONTAINER_ICONS_FILE}#${r}`, bitmapToColor32(bmp, deps.palette)),
        w: bmp.width, h: bmp.height,
      });
    }
    _icons = icons;
  } catch (e) {
    if (!_warned) { _warned = true; console.warn('[inventory] INVE16I0 unavailable; the target icons keep the background art:', e?.message ?? e); }
  }
}
export const containerIconArtLoaded = () => !!_icons;
/** The test seam, and the door a fresh renderer closes. */
export function _setContainerIconsForTests(icons) { _icons = icons; _warned = false; }

// ── G5: THE DROP ICON'S PICTURE ──────────────────────────────────
// UpdateRemoteTargetIcon's two flat arms (:875-884) do NOT read
// INVE16I0 at all - they read a WORLD FLAT:
//
//     string filename = TextureFile.IndexToFileName(dropIconArchive);
//     containerImage = ImageReader.GetImageData(filename,
//         dropIconIdxs[dropIconArchive][dropIconTexture], 0, true);
//
// so the panel needs a second picture source. The cache-in-front
// shape is paintingImage.js's, for the same reason: the draw pass asks
// every frame, the first ask starts the load, and every failure is
// cached as a MISS so a missing archive is asked for once.
const _flats = new Map();      // `${archive}:${record}` -> { tex, w, h } | null
const _flatsPending = new Set();
export function _resetDropIconsForTests() { _flats.clear(); _flatsPending.clear(); _deps = null; }
/** The test seam for a picture that is already "loaded". */
export function _setDropIconForTests(archive, record, image) { _flats.set(`${archive}:${record}`, image); }

/**
 * One TEXTURE.### record as the panel's background, or null while it
 * is still coming (or if it never will). SYNCHRONOUS by design - the
 * draw pass asks every frame. Frame 0, as GetImageData's third
 * argument says.
 */
export function dropIconImage(archive, record) {
  if (!(archive > 0) || !(record >= 0)) return null;
  const key = `${archive}:${record}`;
  if (_flats.has(key)) return _flats.get(key);
  if (!_deps || _flatsPending.has(key)) return null;
  _flatsPending.add(key);
  (async () => {
    try {
      const name = texName(archive);
      const t = new TextureFile();
      t.load(await _deps.fetchBytes(name), name, _deps.palette);
      const bmp = t.getDFBitmap(record, 0);
      if (!bmp?.width) throw new Error(`record ${record} is empty`);
      _flats.set(key, {
        tex: _deps.renderer.uploadTexture('img', `dropicon:${key}`, bitmapToColor32(bmp, _deps.palette)),
        w: bmp.width, h: bmp.height,
      });
    } catch (e) {
      console.warn(`[inventory] drop icon ${archive}.${record} unavailable:`, e?.message ?? e);
      _flats.set(key, null);   // asked and answered - never retried
    } finally { _flatsPending.delete(key); }
  })();
  return null;
}

/**
 * One target-icon panel: the container picture ScaleToFit into the
 * rect, then the shadowed label at panel-relative (1,2).
 *
 * ScaleToFit is Unity's ScaleMode.ScaleToFit (BaseScreenComponent.cs
 * :803-805) - aspect preserved, centered, and it scales UP as well as
 * down (the accessory buttons' MaxAutoScale 1 cap is theirs, not
 * this panel's).
 */
export function drawTargetIconPanel(renderer, m, font, rect, containerType, labelText, image = null) {
  const [rx, ry, rw, rh] = rect;
  // G5: `image` is UpdateRemoteTargetIcon's flat arms (:875-884) - the
  // SAME BackgroundTexture assignment on the SAME ScaleToFit panel, so
  // it lays out through this one path rather than a second drawer.
  const icon = image ?? _icons?.get(containerType) ?? null;
  if (icon && icon.w > 0 && icon.h > 0) {
    const fit = Math.min(rw / icon.w, rh / icon.h);
    const w = icon.w * fit, h = icon.h * fit;
    drawImgCrop(renderer, icon, m, [0, 0, icon.w, icon.h],
      [rx + (rw - w) / 2, ry + (rh - h) / 2, w, h]);
  }
  if (labelText && font) {
    shadowText(renderer, font, labelText, m,
      rx + TARGET_ICON_LABEL_POS[0], ry + TARGET_ICON_LABEL_POS[1],
      { color: DEFAULT_TOOLTIP_TEXT_FG });
  }
  return !!icon;
}
