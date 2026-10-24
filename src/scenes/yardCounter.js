// HOST-SPLIT: moved verbatim out of src/scenes/worldModes.js's createWorldModes (bible/01-Overview/Host-Split.md) by tools/hostMove.mjs.
// The host constructs it where the code stood. What it reads of the host's scope comes through `host`: the
// settled names by value at construction, every live one (a `let` someone writes, a `const` made below) read at its
// use as `host.<name>` - as the code read them where it was.
import { horseCareRules } from '../systems/upkeep/upkeepSwitch.js';
import { isEnhanced } from '../systems/uiSkin.js';
import { isOnlinePage } from '../systems/online/onlineLane.js';
import { playerEntity } from '../characters/playerEntity.js';
import { setMidScreenText } from '../ui/midScreenText.js';
import { tradeDoorReady } from '../ui/tradeDoor.js';
import { validYardKind, YARD_TEXT, yardCounter, yardStock } from '../systems/merchantYards.js';
import { worldMinutes } from '../systems/worldTick.js';

/** @param {any} host */
export function createYardCounter(host) {
  const {
    ensureShopFont, mountServiceWindow, openTradeWindow, townTalk
  } = host;
  /** MERCHANT-YARDS: A YARD'S COUNTER (systems/merchantYards.js) - the Stable's or the Wagon Yard's, opened from the
   *  street (scenes/merchantYardsHost.js): Buy over the yard's whole stock, minted fresh (a yard never sells out - a custom
   *  merchant's openBuy, RR3's door), or Sell into a basket of its own, the yard buying what yardBuysItem says and nothing
   *  else; priced by the counter's one law at YARD_QUALITY. The counter's art and font come in first, the press waiting
   *  for them (ASYNC NEVER DROPS) - once: a game folder that will not give them opens nothing, and says so. Answers
   *  whether the press was handled. `name` the yard's (merchantYards.js yardName), over the window.
   *  AUDIT MERCHANT-YARDS Y3: ONE press waits - the latest, coalesced (two presses during the load opened two
   *  windows) - and when the art comes in it opens only where it was pressed: the street, its slot still free. A door
   *  gone through or a talk opened meanwhile makes the press the player's past, and nothing opens (a window opened
   *  then took the interior's slot over whatever stood there, or the talk's in the street). */
  let _yardWait = null;
  function openYardTrade(kind, regionIndex, tradeMode = 'Buy', name = '', mapId = 0) {
    if (!validYardKind(kind) || host.mode !== 'exterior') return false;
    if (!tradeDoorReady() || (!isEnhanced() && !host._shopFont)) {
      const first = !_yardWait;
      _yardWait = { kind, regionIndex, tradeMode, name, mapId };
      if (first) {
        ensureShopFont().then(() => {
          const w = _yardWait;
          _yardWait = null;
          if (!w || host.mode !== 'exterior' || townTalk?.overlay) return;
          if (!tradeDoorReady() || (!isEnhanced() && !host._shopFont)) { setMidScreenText(YARD_TEXT.shut); return; }
          openYardCounter(w.kind, w.regionIndex, w.tradeMode, w.name, w.mapId);
        });
      }
      return true;
    }
    return openYardCounter(kind, regionIndex, tradeMode, name, mapId);
  }
  /** The yard's counter itself, its art and font in. STEED1/WAGONS4: the stock of the town (`mapId`) on the world's day -
   *  the Stable's three horses, none the player owns, priced by what they are while horses are cared for; the oats and
   *  the kits where they may be sold (merchantYards.js yardStock). */
  function openYardCounter(kind, regionIndex, tradeMode, name, mapId = 0) {
    const b = yardCounter(kind, regionIndex, name);
    const stock = () => yardStock(kind, {
      mapId, day: Math.floor(worldMinutes() / 1440), online: isOnlinePage(), priced: !!horseCareRules(),
      owned: (playerEntity.items ?? []).map((it) => it?.horseSeed).filter(Number.isInteger),
    });
    const win = openTradeWindow({ items: tradeMode === 'Sell' ? [] : stock() }, b, tradeMode === 'Sell' ? 'Sell' : 'Buy');
    if (!win) return true;   // DISC10-E L3: the trade door refused the beast (and said so) - handled, nothing to mount
    mountServiceWindow(win);   // the street's slot (townTalk's) - the interior's is never drawn outdoors
    return true;
  }
  return { openYardTrade };
}
