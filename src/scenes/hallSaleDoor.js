// @ts-check
// ═══════════════════════════════════════════════════════════════════
// GUILD-HALL-SALE (2026-10-06, asked: "Guild houses should be able to be
// sold, like regular houses") - A HALL SOLD AT ITS DOOR, AS A HOME IS
// (systems/online/onlineHomes.js hallSellable; bible/06-Systems/
// Online-Arc.md GUILD-HALL-SALE). The hall's sale stood on the Guild tab
// alone; its door lists "Sell it" to whom the service lets sell it
// (`hallSell` - its guildmaster), on the plaque and in Info's menu as an
// owner's home lists it, asks first at what it pays the treasury, and
// sells THIS building (net/guild/guildBook.js sellHall's door - the
// service refuses a hall standing anywhere else). No purse moves: the
// treasury takes the sale.
//
// HOST-SPLIT (bible/01-Overview/Host-Split.md, THE HOSTS DO NOT GROW):
// the interior host (scenes/worldModes.js createWorldModes) builds this
// once and its door calls the two windows; the plaque's press and Info's
// prompt stay at the door with the home's own. The other three hosts
// stand no online home's door: scenes/world.js hands the guild book's
// sale over (`guildHall.sell`); scenes/exterior.js and
// scenes/dungeonContext.js open no online door, so no hall is sold there.
// ═══════════════════════════════════════════════════════════════════
import { ChoiceWindow } from '../ui/talkWindow.js';
import { accountRefusalText } from '../net/accountClient.js';
import { hallEntryTurnable, hallSellable, hallOwnerLines, hallSaleLines, hallSoldLine, hallYourGuild } from '../systems/online/onlineHomes.js';
import { t } from '../systems/textManager.js';

/**
 * THE HALL'S SALE AT ITS DOOR - `{ openHallMenu, openHallSale }`, each as the service lets this character.
 * @param {{ host: any, townTalk: any, homeOnward: (hit: any, entries: any) => () => void,
 *   turnHallEntry: (bd: any, home: any) => void, homeIdOf: (bd: any) => string, homeTownOf: (bd: any) => number }} deps
 *   `host` the interior host's (its `guildHall` and `onlineHomes`), the rest the door's own helpers
 */
export function createHallSaleDoor({ host, townTalk, homeOnward, turnHallEntry, homeIdOf, homeTownOf }) {
  /** THE HALL'S MENU at its door (Info): go in, who may enter, sell it - each as the service lets this character. */
  function openHallMenu(bd, home, hit, entries) {
    townTalk?.showOverlay?.(new ChoiceWindow({
      lines: hallOwnerLines(home),
      options: [
        { code: 'KeyG', label: t('home.hallMenu.goIn', 'G - go in'), action: homeOnward(hit, entries) },
        ...(hallEntryTurnable(home) ? [{ code: 'KeyW', label: t('home.hallMenu.entry', 'W - who may enter'), action: () => turnHallEntry(bd, home) }] : []),
        ...(hallSellable(home) ? [{ code: 'KeyS', label: t('home.hallMenu.sell', 'S - sell it'), action: () => openHallSale(bd, home) }] : []),
        { code: 'Escape', label: 'Esc - close', action: () => {} },
      ],
    }));
  }
  /** Sell it back - asked first, at what the sale pays the treasury (the service's own sum, its pieces' half in words). */
  function openHallSale(bd, home) {
    townTalk?.showOverlay?.(new ChoiceWindow({
      lines: hallSaleLines(home),
      options: [
        { code: 'KeyY', label: 'Y - yes', action: () => sellHallAt(bd, home) },
        { code: 'KeyN', label: 'N - no', action: () => {} },
      ],
    }));
  }
  /** The halls whose sale is out - one at a time a house (AUDIT GUILD1d A8's law for the buy); the first answer speaks. */
  const _hallSelling = new Set();
  /** THE SALE: this building, from the treasury's side of the service (halls.js sellHall); the town read again. */
  function sellHallAt(bd, home) {
    const id = homeIdOf(bd);
    if (_hallSelling.has(id)) return;
    _hallSelling.add(id);
    const mapId = homeTownOf(bd);
    const name = home?.hall?.name ?? hallYourGuild();
    Promise.resolve(host.guildHall?.sell?.({ mapId, buildingKey: bd.buildingKey }) ?? { ok: false, error: 'no-guild' })
      .then((r) => {
        if (r?.ok || r?.error === 'guild-hall-moved' || r?.error === 'guild-hall-none') host.onlineHomes?.ensure?.(mapId, { force: true });   // sold - or not this guild's hall as the door had it: the door reads it again
        townTalk?.say?.(r?.ok ? hallSoldLine(name, r.data?.back) : accountRefusalText(r?.error ?? 'server'));
      })
      .catch((e) => console.error(e))
      .finally(() => { _hallSelling.delete(id); });
  }
  return { openHallMenu, openHallSale };
}
