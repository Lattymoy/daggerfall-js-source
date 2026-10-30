// HOST-SPLIT: moved verbatim out of src/scenes/world.js's bootWorld (bible/01-Overview/Host-Split.md) by tools/hostMove.mjs.
// The host constructs it where the code stood. What it reads of the host's scope comes through `host`: the
// settled names by value at construction, every live one (a `let` someone writes, a `const` made below) read at its
// use as `host.<name>` - as the code read them where it was.
import { accountRefusalText } from '../net/accountClient.js';
import { clearVendorWaypoint, isVendorWaypoint, setVendorWaypoint, vendorWaypointKey } from '../systems/vendorWaypoint.js';
import { itemPicture } from '../ui/menu/menuPicture.js';
import { itemLookRows } from '../systems/item/itemLook.js';   // PACK-PICK: the look the Market's List form reads too
import { REGION_NAMES } from '../formats/mapsFile.js';
import { homeMayEnter as vendorDoorOpen } from '../net/homeLaw.js';
import { goldText as vendorGoldText } from '../net/marketLaw.js';
import { createMarketArrivals } from '../net/marketArrivals.js';   // RPT1026-MARKET ARRIVE: what the market sends reaches the pack on its own
import { t } from '../systems/textManager.js';
import { registerVendorHouseReader } from '../systems/vendorHouses.js';   // VENDOR-HOUSES: the town map's blue traders

/** @param {any} host */
export function createVendorHost(host) {
  const {
    _townOfMapId, maps, marketBook, marketDrop, marketGoods, marketHubs, marketMint, marketPutBack, marksBook,
    noticeBook, playerTravelPixel, profBook, showNoticeWindow, townTalk, checkpointGateOpen
  } = host;
  // RPT1026-MARKET ARRIVE (net/marketArrivals.js): the road read and the book settled as the character's session stands -
  // once the checkpoint's own gate is open (the character spawned, its save the realm's, no duel) and the page is seen -
  // at a courier's arrival, after a press whose own collect did not land, and as a trader's stall opens. A host that hands
  // no gate (a test's) starts no clock.
  const arrivals = createMarketArrivals({
    book: marketBook, settle: () => marketBook.settle(marketMint, marketPutBack, marketDrop),
    ready: () => checkpointGateOpen?.() === true && globalThis.document?.visibilityState !== 'hidden',
  });
  if (marketBook && typeof checkpointGateOpen === 'function') arrivals.start();
  // ═══ HOME-VENDOR (net/vendorLaw.js): THE TRADERS - a home's stall, the board's Vendors tab, the Vendor page ═══
  /** The region the player stands in (the purse's and the page's), or null. */
  const vendorRegionHere = () => { const p = playerTravelPixel(); try { const r = p ? maps.getRegionIndexAt(p.x, p.y) : null; return Number.isInteger(r) && r >= 0 ? r : null; } catch { return null; } };
  const vendorTownOf = (map) => _townOfMapId.get(Number(map) >>> 0)?.name || 'a town';
  const vendorNameOf = (it) => { try { return marketGoods.goodName(it); } catch { return 'a piece'; } };
  /** A trader's piece LOOKED AT - `{ rows, magic, stolen }` (systems/item/itemLook.js itemLookRows: the look panel's stat rows,
   *  the trade window's magic and RPT1026-LEDGERLAW a stolen piece's card line); PACK-PICK moved it there, so the Market's
   *  List form reads the same. Null for no piece. */
  const vendorItemStats = itemLookRows;
  const vendorSaid = (r, ok) => (r?.ok ? { ok: true, text: ok } : { ok: false, text: accountRefusalText(r?.error) });
  /** RPT1026-MARKET ARRIVE: a press's own collect that did not land (another act of the record under way, a checkpoint
   *  still waiting, its answer lost) - the piece is a delivery the sweep collects shortly (`soon`), and the press says so.
   *  It said "Bought" and the piece waited on the service for good. `market-gone` is a collect another door made first:
   *  the piece is in the pack, and the press's own words stand. */
  const collectedAtPress = async (delivery) => {
    const c = await marketBook.collectGood(delivery);
    if (c?.ok || c?.error === 'market-gone') return true;
    arrivals.soon();
    return false;
  };
  /** A trader's piece BOUGHT at its stall: off the purse at its own price, its delivery collected into the pack at once. */
  const vendorBuy = async (vendor, row) => {
    const hub = marketHubs()[row.region];   // BAY-LEFT-SEA: the hubs as they stand now (systems/region/marketHubs.js)
    const r = await marketBook.buy({ region: row.region, listing: row.id, units: 1, max: row.price, hubs: hub ? { [row.region]: hub } : {}, currency: 'gold', vendor }, marketMint);
    if (r?.ok && r.data?.delivery?.id && !(await collectedAtPress(r.data.delivery.id))) {
      return { ok: true, text: t('vendor.buy.onWay', 'Bought {name} for {price}. It is on its way to your pack and will reach it on its own.', { name: vendorNameOf(row.item), price: vendorGoldText(row.price) }) };
    }
    return vendorSaid(r, `Bought ${vendorNameOf(row.item)} for ${vendorGoldText(row.price)}.`);
  };
  /** A piece TAKEN BACK off my trader: the listing cancelled, the piece collected back into the pack at once. */
  const vendorTake = async (row) => {
    const r = await marketBook.cancel(row.id, marketMint);
    if (r?.ok && r.data?.delivery?.id && !(await collectedAtPress(r.data.delivery.id))) {
      return { ok: true, text: t('vendor.take.onWay', '{name} is on its way back to your pack and will reach it on its own.', { name: vendorNameOf(row.item) }) };
    }
    return vendorSaid(r, `${vendorNameOf(row.item)} is back in your pack.`);
  };
  /** GOLD-MARKET: a trader's takings COLLECTED into the account of the region the player stands in (the Vendor page's
   *  Collect) - moved out of bootWorld's setVendorPage by RPT1026-MARKET, beside the stall's other acts, its two lines into
   *  the player's language on the way. */
  const vendorCollectGold = async () => {
    const region = vendorRegionHere();
    if (region == null) return { ok: false, text: t('vendor.collect.noBank', 'You can only collect your takings in a region with a bank.') };
    const r = await marketBook.collectGold(region);
    return vendorSaid(r, t('vendor.collect.done', 'Your takings are in your account in {region}.', { region: REGION_NAMES[region] ?? t('vendor.collect.thisRegion', 'this region') }));
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
  registerVendorHouseReader((region) => (vendorMarketOpen() ? vendorReachable(region) : null), { open: vendorMarketOpen });   // VENDOR-HOUSES: the houses the town map inks blue
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
        picture: (it, wake, box) => itemPicture(it, { onReady: wake, box }),   // MENU-ORDER; PACK-PICK: at the picker's box
        buy: (row) => vendorBuy(vendor, row), take: (row) => vendorTake(row),
        goods: () => marketGoods.goods(), put: (item, price) => vendorPut(vendor, item, price),
        settle: () => arrivals.sweep(),   // VENDOR-LOST: a kept buy's piece collected as the stall opens; RPT1026-MARKET ARRIVE: the road read first, so every piece arrived for this character is collected
      },
    });
  };
  return { openHomeVendorWindow, vendorBoardHost, vendorCollectGold, vendorItemStats, vendorMarketOpen, vendorNameOf, vendorReachable, vendorRegionHere, vendorSaid, vendorTake, vendorTownOf, vendorWaypointOn };
}
