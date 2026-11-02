// @ts-check
// ═══════════════════════════════════════════════════════════════════
// RPT1026-ITEMS HELD-OUT (2026-10-26; three private reports of gear lost around an Identify at the Mages Guild - one
// of them Legendaries identified there and missing once the client had restarted for a new version):
// THE PLAYER'S GOODS A WINDOW HOLDS OUT OF THE PACK ARE STILL THE PLAYER'S, AND EVERY SAVE SAYS SO.
//
// A trade counter stages the player's own pieces OUT of the pack (DaggerfallTradeWindow.TransferItem, :795 - D7 made the
// move real, ui/enhanced/enhancedTrade.js and ui/native/nativeTrade.js): an Identify's lot, a sale's, until the window
// closes and OnPop's ClearSelectedItems puts back what is still staged. DFU never saves under that window. The port
// does - online every ONLINE_CHECKPOINT_MS, as a page hides, and at a title exit (systems/online/onlineCheckpoint.js) -
// and the save read `entity.items` alone, so a checkpoint that fell while the lot stood on the counter wrote the
// character without it. A session that ended before the next one (the app closed or restarted to update, a crash, a
// join on another device) came back to that record: the identified pieces were gone.
//
// A window that holds such goods registers them here while it stands (`holdOut`), and the save's composer adds them to
// the pack it writes (systems/save/save.js snapshotPlayer, heldOutOf) - at the pack's end, so no index a save keys into
// the pack moves. A Buy's basket is the shop's, never the player's, and a repair's lot is the repairer's list (saved on
// its own, `otherItems`): neither is held here.
//
// A leaf: no import. Not a DFU member - DFU saves no window's selection because it saves under none.
// ═══════════════════════════════════════════════════════════════════

/** @type {Set<{ entity: any, items: () => any }>} */
const _held = new Set();

/** A window holding `entity`'s goods out of its pack: `items()` answers them as they stand now. Answers the release, for
 *  the window's teardown (called twice, it lets go once). */
export function holdOut(/** @type {any} */ entity, /** @type {() => any} */ items) {
  if (!entity || typeof items !== 'function') return () => {};
  const h = { entity, items };
  _held.add(h);
  return () => {
    _held.delete(h);
  };
}

/** The goods every standing window holds out of `entity`'s pack, each once, and none the pack holds itself. */
export function heldOutOf(/** @type {any} */ entity) {
  /** @type {any[]} */
  const out = [];
  if (!entity) return out;
  const pack = Array.isArray(entity.items) ? entity.items : [];
  for (const h of _held) {
    if (h.entity !== entity) continue;
    let list = null;
    try {
      list = h.items();
    } catch {
      list = null;
    } // a window's reader is never the save's problem
    for (const it of Array.isArray(list) ? list : [])
      if (it && typeof it === 'object' && !pack.includes(it) && !out.includes(it)) out.push(it);
  }
  return out;
}
