// @ts-check
// APPEARANCES (2026-10-27; bible/04-Characters/Wardrobe.md): THE SHOP POPUPS' OWN ROWS, one door - the Portal Stone's
// (PORTAL1: every shop's keeper, its counter scenes/portalCounter.js) and the Wardrobe's (a Clothing Store's, an
// Armorer's or a Weaponsmith's keeper, scenes/wardrobeCounter.js) - as the hooks both popups take (the port's rows under
// DFU's art, ui/merchant/merchantServiceWindow.js shopRowRect; the Enhanced Plus panel's presses). In a building and
// nowhere else: outside one the host holds no building. HOST-SPLIT: the interior host (scenes/worldModes.js
// createWorldModes) builds this once and spreads `of` into both popups' hooks - the Portal Stone's row and counter moved
// here with the Wardrobe's, the host 4 logical lines down where the Wardrobe alone would have grown it by 6.
import { createPortalCounter } from './portalCounter.js';
import { createWardrobeCounter } from './wardrobeCounter.js';
import { isShop } from '../systems/shopStock.js';
import { PORTAL_TEXT } from '../systems/portalStone.js';

/**
 * THE ROWS - `{ of, portalCounter, wardrobeCounter }`.
 * @param {{ say: (line: string) => void, mountInterior: (w: any) => any, mountService: (w: any) => any }} deps
 *   `say` the host's line; `mountInterior` the interior's window stack (the Portal Stone's question goes over the popup);
 *   `mountService` the host's overlay slot (the Wardrobe's window, as the Reforge's)
 */
export function createShopRows({ say, mountInterior, mountService }) {
  const portalCounter = createPortalCounter({ say, mount: mountInterior });
  const wardrobeCounter = createWardrobeCounter({ mount: mountService });
  /** A popup's rows in a building of `buildingType`: `portal` at every shop (isShop's nine kinds), `wardrobe` at the
   *  three - each absent where it is not, so a bank's teller and a street's driver have neither. */
  function of(/** @type {unknown} */ buildingType) {
    const wardrobe = wardrobeCounter.row(buildingType);
    return {
      ...(isShop(/** @type {number} */ (buildingType))
        ? { portal: { label: PORTAL_TEXT.row, onBuy: () => portalCounter.ask() } }
        : {}),
      ...(wardrobe ? { wardrobe } : {}),
    };
  }
  return { of, portalCounter, wardrobeCounter };
}
