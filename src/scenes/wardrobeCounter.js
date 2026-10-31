// @ts-check
// APPEARANCES (2026-10-27; bible/04-Characters/Wardrobe.md): THE WARDROBE AT THE COUNTER - the row a Clothing Store's, an
// Armorer's or a Weaponsmith's keeper puts on their popup (either skin's: ui/merchant/merchantServiceWindow.js shopRowRect,
// the Enhanced Plus panel's press), the window it opens (ui/wardrobe/wardrobeDoor.js), and the wear and the clear it asks
// for - the law's (systems/appearances.js), on the player's own worn pieces and purse.
// HOST-SPLIT: built once by the shop popups' rows (scenes/shopRows.js), which the interior host (scenes/worldModes.js) builds.
// THE FOUR HOSTS: scenes/worldModes.js WIRED (its interiors are the streaming world's, scenes/world.js, and the fixed
// city's, scenes/exterior.js - both build it); scenes/dungeonContext.js stands no shop and no keeper, so no wardrobe.
import { createWardrobeOverlay } from '../ui/wardrobe/wardrobeDoor.js';
import { isWardrobeShop, wearAppearance, clearAppearance, noteHeldLooks } from '../systems/appearances.js';
import { playerEntity, surfacePlayer } from '../characters/playerEntity.js';
import { itemLongName } from '../systems/item/itemInfo.js';
import { refreshPaperDoll } from '../ui/paperDoll.js';
import { audio } from '../systems/audio.js';
import { SOUND } from '../systems/soundClips.js';
import { t } from '../systems/textManager.js';

/** The row's word, read when drawn. */
export const WARDROBE_ROW = () => t('wardrobe.row', 'Wardrobe');

/**
 * THE WARDROBE'S COUNTER - `{ row, open, wear, clear }`.
 * @param {{ mount: (w: any) => any, entity?: any, onDressed?: (entity: any) => void }} deps
 *   `mount` the host's overlay slot's door (the interior's mountServiceWindow), `entity` the wearer (the player's own,
 *   by default), `onDressed` told after a look is worn or cleared (the doll recomposed, by default)
 */
export function createWardrobeCounter({
  mount,
  entity = playerEntity,
  onDressed = (e) => {
    Promise.resolve()
      .then(() => refreshPaperDoll(e))
      .catch(() => {
        /* the doll composes at its next open */
      });
  },
}) {
  /** The popup's row in a building of `buildingType` - `{ label, onOpen }` at the three shops, undefined elsewhere. */
  const row = (/** @type {unknown} */ buildingType) =>
    isWardrobeShop(buildingType) ? { label: WARDROBE_ROW(), onOpen: () => open() } : undefined;
  /** The window, the pack's looks read first (a piece bought a moment ago is a look already). Answers the overlay. */
  function open() {
    noteHeldLooks(entity);
    const o = createWardrobeOverlay({ entity, wear, clear, nameOf: (/** @type {any} */ it) => itemLongName(it) });
    return o ? mount(o) : null;
  }
  /** A look laid over a worn piece, its fee paid - the law's answer. */
  function wear(/** @type {any} */ item, /** @type {any} */ look) {
    const done = wearAppearance(entity, item, look);
    if (done.ok) {
      audio.playOneShot(SOUND.GoldPieces, 1);
      dressed();
    }
    return done;
  }
  /** A worn piece's own look back, for nothing. */
  function clear(/** @type {any} */ item) {
    const done = clearAppearance(entity, item);
    if (done.ok) dressed();
    return done;
  }
  const dressed = () => {
    surfacePlayer();
    onDressed(entity);
  };
  return { row, open, wear, clear };
}
