// @ts-check
// A copy's items held to what this build knows (ui/enhanced/enhancedMenu.js copyToOffline). Every module that adds an item
// template is loaded first - a template not yet registered must never read as unknown, or a real piece would be lost -
// and test/systems/known_items_only.test.js holds this list to every module that registers one.
import '../ayleidStones.js';
import '../comeSailAway/comeSailAwayItems.js';
import '../deepWater/deepWatersFishItems.js';
import '../dragon/dragonMount.js';
import '../eliteGates/weirKey.js';
import '../festival/soulCake.js';
import '../foraging/foragingInstall.js';
import '../gate/gateSpoils.js';
import '../gems.js';
import '../handWraps.js';
import '../iliac/iliacItems.js';
import '../legacy/heirloom.js';
import '../livingWorld/keepsake.js';
import '../lockpick/lockpickItem.js';
import '../musicSheetRow.js';
import '../naval/navalStores.js';
import '../naval/tradeGoods.js';
import '../naval/treasureCharts.js';
import '../pistolet.js';
import '../professions/profTemplates.js';
import '../rest/restItems.js';
import '../starfall/starglass.js';
import '../survival/items.js';
import '../thunderlock.js';
import '../upkeep/upkeepItemRows.js';
import '../walletItem.js';
import { RRI_TEMPLATES } from '../roleplayRealismItems/rriItems.js';
import { templateByIndex } from './itemTemplates.js';
import { savedItemLists } from '../save/save.js';

const RRI_INDEXES = new Set(RRI_TEMPLATES.map((t) => /** @type {{ index: number }} */ (t).index));   // the mod's rows count as known, registered or not (rriInstall.js)

/**
 * Takes out of every item list a save holds the items whose template this build does not have: a character from a
 * newer realm, copied into an older build (a private server's pinned one), never holds a piece that build cannot read.
 * The pack's lit light keeps its item. Answers how many went.
 * shortcut: items alone; a newer spell, power or quest the build lacks stays in the save - add it if one breaks a load.
 * @param {any} snap
 */
export function dropUnknownItems(snap) {
  const lit = Array.isArray(snap?.items) ? (snap.items[snap.lightSourceIndex ?? -1] ?? null) : null;
  let gone = 0;
  for (const list of savedItemLists(snap)) {
    for (let i = list.length - 1; i >= 0; i--) {
      const it = list[i];
      if (it && typeof it === 'object' && Number.isInteger(it.templateIndex) && !templateByIndex(it.templateIndex) && !RRI_INDEXES.has(it.templateIndex)) {
        list.splice(i, 1);
        gone++;
      }
    }
  }
  if (gone && Array.isArray(snap.items)) snap.lightSourceIndex = lit ? snap.items.indexOf(lit) : -1;
  return gone;
}
