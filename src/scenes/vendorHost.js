// HOST-SPLIT: moved verbatim out of src/scenes/world.js's bootWorld (bible/01-Overview/Host-Split.md) by tools/hostMove.mjs.
// The host constructs it where the code stood. What it reads of the host's scope comes through `host`: the
// settled names by value at construction, every live one (a `let` someone writes, a `const` made below) read at its
// use as `host.<name>` - as the code read them where it was.
import { accountRefusalText } from '../net/accountClient.js';
import { clearVendorWaypoint, isVendorWaypoint, setVendorWaypoint, vendorWaypointKey } from '../systems/vendorWaypoint.js';
import { isEnchanted } from '../systems/inventory.js';
import { itemIsIdentified } from '../systems/tradeModes.js';
import { itemPicture } from '../ui/menu/menuPicture.js';
import { itemStatRows } from '../systems/item/itemInfo.js';
import { lootRarityOn, rarityLines } from '../systems/loot/lootRarity.js';
import { magicPowersLines } from '../systems/item/itemPowers.js';
import { REGION_NAMES } from '../formats/mapsFile.js';
import { homeMayEnter as vendorDoorOpen } from '../net/homeLaw.js';
import { goldText as vendorGoldText } from '../net/marketLaw.js';

/** @param {any} host */
export function createVendorHost(host) {
  const {
    _townOfMapId, maps, marketBook, marketDrop, marketGoods, marketHubs, marketMint, marketPutBack, marksBook,
    noticeBook, playerTravelPixel, profBook, showNoticeWindow, townTalk
  } = host;
  // ═══ HOME-VENDOR (net/vendorLaw.js): THE TRADERS - a home's stall, the board's Vendors tab, the Vendor page ═══
  /** The region the player stands in (the purse's and the page's), or null. */
  const vendorRegionHere = () => { const p = playerTravelPixel(); try { const r = p ? maps.getRegionIndexAt(p.x, p.y) : null; return Number.isInteger(r) && r >= 0 ? r : null; } catch { return null; } };
  const vendorTownOf = (map) => _townOfMapId.get(Number(map) >>> 0)?.name || 'a town';
  const vendorNameOf = (it) => { try { return marketGoods.goodName(it); } catch { return 'a piece'; } };
  /** A trader's piece LOOKED AT - `{ rows, magic }`: the look panel's own stat rows (systems/item/itemInfo.js itemStatRows -
   *  damage, armour, hands, material, condition, weight), and its magic as the trade window says it (its tier with its
   *  affixes and set, and an enchanted piece's powers - or "powers unknown" unidentified). Null for no piece. */
  const vendorItemStats = (it) => {
    if (!it || typeof it !== 'object') return null;
    let rows = [], magic = [];
    try { rows = itemStatRows(it).map((r) => (r.label ? `${r.label}: ${r.text}` : r.text)); } catch { rows = []; }
    try { magic = rarityLines(it, { sigil: true, set: true, lore: false }); } catch { magic = []; }
    try {
      if (!(it.rarity && lootRarityOn()) && isEnchanted(it)) {
        for (const t of magicPowersLines(it, { identified: itemIsIdentified(it) })) if (t && !magic.includes(t)) magic.push(t);
      }
    } catch { /* a piece whose powers cannot be read says none */ }
    return { rows, magic };
  };
  const vendorSaid = (r, ok) => (r?.ok ? { ok: true, text: ok } : { ok: false, text: accountRefusalText(r?.error) });
  /** A trader's piece BOUGHT at its stall: off the purse at its own price, its delivery collected into the pack at once. */
  const vendorBuy = async (vendor, row) => {
    const hub = marketHubs[row.region];
    const r = await marketBook.buy({ region: row.region, listing: row.id, units: 1, max: row.price, hubs: hub ? { [row.region]: hub } : {}, currency: 'gold', vendor }, marketMint);
    if (r?.ok && r.data?.delivery?.id) await marketBook.collectGood(r.data.delivery.id);
    return vendorSaid(r, `Bought ${vendorNameOf(row.item)} for ${vendorGoldText(row.price)}.`);
  };
  /** A piece TAKEN BACK off my trader: the listing cancelled, the piece collected back into the pack at once. */
  const vendorTake = async (row) => {
    const r = await marketBook.cancel(row.id, marketMint);
    if (r?.ok && r.data?.delivery?.id) await marketBook.collectGood(r.data.delivery.id);
    return vendorSaid(r, `${vendorNameOf(row.item)} is back in your pack.`);
  };
  /** A piece from my pack PUT UP at my trader, for gold, for the trader's thirty days. */
  const vendorPut = async (vendor, item, price) => {
    const g = marketGoods.good(item);
    if (!g?.offered || !(g.pick >= 0)) return { ok: false, text: accountRefusalText('market-good-gone') };
    const region = vendorRegionHere() ?? 0;
    const r = await marketBook.list({ region, kind: 'item', item: g.offered, pick: g.pick, price, hubs: {}, currency: 'gold', vendor }, null, g);
    return vendorSaid(r, `${vendorNameOf(item)} is up for sale at ${vendorGoldText(price)}.`);
  };
  /** A row's waypoint SET on its trader's house. */
  const vendorWaypointOn = (row) => {
    const ok = setVendorWaypoint({ map: row.map, buildingKey: row.buildingKey, owner: row.owner ?? '', town: vendorTownOf(row.map) });
    if (ok) townTalk.say(`Waypoint set: ${row.owner ?? 'a trader'}'s house in ${vendorTownOf(row.map)}. A gold coin marks it on your world map.`);
    return ok;
  };
  /** THE TRADERS THIS PLAYER MAY REACH (Mac: "Show only traders whose house a given player can actually enter"): the
   *  region's directory kept to the houses whose door lets this character in - the door's own law (net/homeLaw.js
   *  homeMayEnter: theirs, public, their party's owner, their guild's, a room they rent); the service says each door, the
   *  party's names are the relay's. A row with no door said is kept (an older service). */
  const vendorReachable = async (region) => {
    const r = await marketBook.vendors(region);
    if (!r?.ok) return r;
    const partyNames = (host.social?.others?.() ?? []).map((m) => m.name).filter((n) => typeof n === 'string' && n.length > 0);
    const rows = (r.data?.rows ?? []).filter((row) => !row.home || vendorDoorOpen(row.home, { partyNames }));
    return { ...r, data: { ...r.data, rows } };
  };
  const vendorMarketOpen = () => !!marketBook && profBook?.state.open === true && marksBook?.state?.open !== false;
  /** The board's Vendors tab: the region's traders, read fresh. */
  const vendorBoardHost = (region) => ({
    mode: 'board', region, regionName: REGION_NAMES[region] ?? 'the region',
    read: () => vendorReachable(region), nameOf: vendorNameOf, townOf: vendorTownOf, stats: vendorItemStats,
    picture: (it, wake) => itemPicture(it, { onReady: wake }),   // MENU-ORDER: a piece's picture on its row
    waypoint: vendorWaypointOn, waypointKey: () => vendorWaypointKey(), clearWaypoint: () => clearVendorWaypoint(),
  });
  /** A TRADER PRESSED in its home (worldModes.js openHomeVendor): its stall, in the Notice Board's window - the owner
   *  stocking it, a visitor buying. False where the market is not this account's (worldModes says so). */
  const openHomeVendorWindow = ({ vendor, own = false, owner = '' } = {}) => {
    if (!vendorMarketOpen() || !noticeBook || !vendor) return false;
    const who = own ? 'Your trader' : `${owner || 'A'}'s trader`;
    return showNoticeWindow({
      town: { name: who, mapId: 0 },
      traderOnly: { title: who, sub: own ? 'What you have put up for sale here. Visitors buy it at this stall.' : 'Goods for sale, paid from your purse.' },
      vendors: {
        mode: 'stall', own, owner,
        read: async () => {
          const r = await marketBook.vendorStock(vendor);
          const v = r?.ok ? r.data?.vendor : null;
          if (v && isVendorWaypoint(v.map, v.buildingKey)) clearVendorWaypoint();   // the trader reached: the waypoint's work is done
          return r;
        },
        nameOf: vendorNameOf, stats: vendorItemStats, purse: () => marketBook.purse(vendorRegionHere() ?? 0),
        picture: (it, wake) => itemPicture(it, { onReady: wake }),   // MENU-ORDER
        buy: (row) => vendorBuy(vendor, row), take: (row) => vendorTake(row),
        goods: () => marketGoods.goods(), put: (item, price) => vendorPut(vendor, item, price),
        settle: () => marketBook.settle(marketMint, marketPutBack, marketDrop),   // VENDOR-LOST: a kept buy's piece collected as the stall opens
      },
    });
  };
  return { openHomeVendorWindow, vendorBoardHost, vendorItemStats, vendorMarketOpen, vendorNameOf, vendorReachable, vendorRegionHere, vendorSaid, vendorTake, vendorTownOf, vendorWaypointOn };
}
