// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PORTAL-BULK (2026-10-24; the players, +7: "I hate that I have to buy portal shards one by one; it would be better to
// be able to bulk buy them" - the owner: "No band aids"; bible/06-Systems/Portal-Stone.md, The counter) - THE PORTAL
// STONE'S COUNTER: the question a shop keeper's Portal Stone row asks, and the sale its Yes makes.
//
//   THE COUNT. A press of the row (either skin's popup - ui/merchant/merchantServiceWindow.js and
//   merchantRepairWindow.js `portal.onBuy`, the Enhanced Plus panels' button the same hook) asks HOW MANY: a numeric
//   field labelled with DFU's own howManyItems (systems/item/itemTransfer.js HOW_MANY_ITEMS - the split popup's
//   words, DaggerfallInventoryWindow.cs:1523-1536), read by its parse (parseSplitAmount: a whole number from 1 to the
//   most, else nothing at all, as SplitStackPopup_OnGotUserInput moves nothing), up to the most the purse and the stack
//   allow (systems/portalStone.js portalStoneMax). SEEDED WITH 1, never with the most - a departure from the split
//   popup, which seeds its max: a stray Return there moves a stack the player still owns, here it would spend a purse.
//   One is the tavern's day count's seed (ui/tavernWindow.js DAYS_FIELD, DaggerfallTavernWindow.cs:166-168).
//   THE OFFER. Then "Buy N Portal Stones for 5N Welkynd Shards? You carry M." - DFU's Yes/No box; Yes is the sale, No
//   and Escape take nothing (as Escape on the field does). With only one stone to be had the field is skipped and the
//   offer is the one-stone question PORTAL1 asked; with none, the counter says why at once (a short purse, its locked
//   and worn shards named; or a full stack) and raises nothing.
//   THE CHAIN. The tavern's room rental's (DaggerfallTavernWindow.RoomButton_OnMouseClick: field -> YesNo): U24's
//   ServiceFlowWindow (ui/guildServiceWindows.js), whose field box is THE ONE DaggerfallInputMessageBox
//   (ui/inputMessageBox.js) and whose Yes/No is DFU's message box - each in the skin's own face (the enhanced field,
//   ui/enhanced/enhancedInputBox.js; the enhanced dialog, ui/enhanced/enhancedDialog.js), so both skins take the count
//   from the one window. THE SALE is the law's: buyPortalStones, all of it or none of it.
//
// Not a DFU member - DFU sells no such item; the counter is the port's own (Ledger A, PORTAL1).
//
// HOST-SPLIT (bible/01-Overview/Host-Split.md, THE HOSTS DO NOT GROW): the interior host (scenes/worldModes.js
// createWorldModes) builds this once and its popups' row calls `ask`. THE FOUR HOSTS: scenes/worldModes.js WIRED (its
// interiors are the streaming world's, scenes/world.js, and the fixed city's, scenes/exterior.js - both build it);
// scenes/dungeonContext.js stands no shop and no keeper, so no counter.
// ═══════════════════════════════════════════════════════════════════
import { ServiceFlowWindow } from '../ui/guildServiceWindows.js';
import { HOW_MANY_ITEMS, SPLIT_INPUT_MAX, parseSplitAmount } from '../systems/item/itemTransfer.js';
import { buyPortalStones, portalStoneMax, portalStoneRefusal, portalStoneRefusalText, PORTAL_TEXT } from '../systems/portalStone.js';
import { shardsHeld } from '../systems/reforge.js';
import { playerEntity, surfacePlayer } from '../characters/playerEntity.js';
import { audio } from '../systems/audio.js';
import { SOUND } from '../systems/soundClips.js';

/** The count's field: the split popup's (numeric, SPLIT_INPUT_MAX characters, labelled howManyItems with the most),
 *  seeded with ONE - never the most. */
export const portalCountField = (max) => ({ numeric: true, maxCharacters: SPLIT_INPUT_MAX, initial: '1', label: HOW_MANY_ITEMS(max) });

/**
 * THE PORTAL STONE'S COUNTER - `{ ask, buy }`.
 * @param {{ say: (line: string) => void, mount: (w: any) => void, entity?: any }} deps
 *   `say` the host's line, `mount` its overlay slot's door (the interior's mountInterior), `entity` the buyer (the
 *   player's own, by default)
 */
export function createPortalCounter({ say, mount, entity = playerEntity }) {
  const pack = () => entity.items ?? [];
  /** THE OFFER: `n` stones at `n` prices, the shards the purse may spend said - Yes the sale, No and Escape nothing. */
  const offer = (n) => ({
    rows: [{ text: PORTAL_TEXT.ask(n, shardsHeld(pack())), center: true }],
    buttons: 'YesNo',
    onYes: () => { buy(n); return null; },
    onNo: () => null,
  });
  /** THE COUNT: up to `max`; an answer the parse refuses ("0", past the most, "3x") ends the chain with nothing taken. */
  const count = (max) => ({
    rows: [],
    field: portalCountField(max),
    onInput: (text) => { const n = parseSplitAmount(text, max); return n == null ? null : [offer(n)]; },
  });
  /** The row's press: the question, or - with nothing to be had - why, at once. Answers the window raised, or null. */
  function ask() {
    const max = portalStoneMax(pack());
    if (max < 1) { say(portalStoneRefusalText(pack(), portalStoneRefusal(pack(), 1))); return null; }
    const flow = new ServiceFlowWindow([max === 1 ? offer(1) : count(max)]);
    mount(flow);
    return flow;
  }
  /** THE SALE: `n` stones in, their shards out (always in stock - nothing is kept to run out); refused in words,
   *  nothing taken. Answers whether it sold. */
  function buy(n) {
    entity.items = entity.items || [];
    const sale = buyPortalStones(entity.items, n);
    if (!sale.ok) { say(portalStoneRefusalText(entity.items, sale.reason)); return false; }
    audio.playOneShot(SOUND.GoldPieces, 1);
    surfacePlayer();
    say(PORTAL_TEXT.bought(n));
    return true;
  }
  return { ask, buy };
}
