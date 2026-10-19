// @ts-check
// ═════════════════════════════════════════════════════════════════════
// TOWN-ECON TE1 (2026-10-16, bible/06-Systems/Town-Economy-Arc.md 3) - A
// TOWN'S ECONOMY AS THIS CLIENT READS IT: the Prosperity of a town by its
// map id (net/townEconLaw.js townProsperity), the factor its counters
// apply (townShopFactor, a seat's folded in), and its card for the Held
// Map's and the Overworld's hover (townTipOf).
//
// Online only (TE0 decision 4): offline a counter prices as DFU's does and
// no town shows a card. What it reads comes from its host - the town's own
// row (its pixel, region and type), the seat book's dressed seats, the
// raids running, the relay's clock (AUDIT TOWN-ECON LAW-2) - and nothing here asks the service
// itself. TE2's players' share is the host's `players` by the town's map
// id (net/townEconBook.js shareOf), 0 where none is read.
// ═════════════════════════════════════════════════════════════════════
import { isEconTown, townKeyOf, townProsperity, townShopFactor, townTipOf, townDayOf, townBandOf, townExchangeFactors, TOWN_SALE_MODES } from '../../net/townEconLaw.js';
import { bailiwickOf, seatTipOf } from '../../net/townSeatLaw.js';   // TE0 decision 5: the area's seat (the Tithe's own rule); AUDIT TOWN-ECON CLI-3: a seat's own card where its place has no economy

/**
 * @param {{ online: () => boolean, townOf: (mapId: number) => ({ name: string, px: number, py: number, region: number, type: number }|null|undefined),
 *   seatAt: (mapId: number) => any, seats: () => (any[]|null), raidedAt: (px: number, py: number) => boolean, nowMs?: () => number,
 *   players?: (mapId: number) => number, patronsIn?: (region: number) => any[], lanesAt?: (px: number, py: number) => number }} host
 *   `townOf` a town's row by its map id; `seatAt` its own seat, dressed (null where none); `seats` every seat known here,
 *   dressed - null where the seats are not known (closed, unread); `raidedAt` whether a raid runs at a pixel now;
 *   `players` TE2's share at a town by its map id; `patronsIn` TE3's chapters' patrons of a region; `lanesAt` SEA-TRADE's
 *   sea lanes of the port town at a map pixel
 */
export function createTownEcon(host) {
  const nowMs = host.nowMs ?? (() => Date.now());
  /** The town's reading today, or null (offline, no such town, not a town with an economy). @param {unknown} mapId */
  const readingOf = (mapId) => {
    if (!host.online() || mapId == null || !Number.isFinite(Number(mapId))) return null;
    const id = Number(mapId) >>> 0;
    const town = host.townOf(id);
    if (!town || !isEconTown(town.type)) return null;
    const key = townKeyOf(town.px, town.py);
    const seat = host.seatAt(id) ?? null;
    const raided = host.raidedAt(town.px, town.py) === true;
    const players = host.players?.(id) ?? 0;   // TE2: the service keys a town by its map id
    const lanes = host.lanesAt?.(town.px, town.py) ?? 0;   // SEA-TRADE: a port town's sea lanes
    const day = townDayOf(nowMs());
    const at = (d) => townProsperity({ key, type: town.type, day: d, seat, raided, players, lanes });
    return { id, town, key, seat, raided, players, lanes, p: at(day), prevOf: () => at(day - 1) };   // yesterday's for the card alone - a counter asks once an item
  };
  /** @type {Map<number, () => any>} */
  const tipFns = new Map();
  return {
    /** The town's Prosperity today, or null. @param {unknown} mapId */
    prosperityOf: (mapId) => readingOf(mapId)?.p ?? null,
    /** TOWN-ECON TE3: the town's band today (townEconLaw.js townBandOf), or null - what the living world reads. @param {unknown} mapId */
    bandOf(mapId) { const r = readingOf(mapId); return r ? townBandOf(r.p) : null; },
    /** SEA-TRADE: a port town's exchange factors today (townEconLaw.js townExchangeFactors), or null. @param {unknown} mapId */
    exchangeOf(mapId) { const r = readingOf(mapId); return r ? townExchangeFactors(r.p) : null; },
    /** A COUNTER'S FACTOR (TE0 decision 4): what the counter in building `b` (its town `b.townMapId`) applies for
     *  `mode`, the seat's `seatFactor` folded in - where the town has no economy, or offline, the seat's alone (AUDIT
     *  TOWN-ECON CLI-3: SEAT1d's own law - it handed the seat's discount to a sale of magic), and what it pays never
     *  above what it asks this player (SEAT-LOOP: the seat's essentials round trip, closed where no town reads too). */
    shopFactor(/** @type {any} */ b, /** @type {string} */ mode, seatFactor = 1) {
      const r = readingOf(b?.townMapId);
      if (r) return townShopFactor(r.p, mode, seatFactor);
      if (TOWN_SALE_MODES.includes(mode)) return Math.min(1, seatFactor);
      return mode === 'Buy' || mode === 'Repair' ? seatFactor : 1;
    },
    /** A TOWN'S CARD (TE0 decision 6), or null - AUDIT TOWN-ECON CLI-3: a seat whose place has no economy (a Palace
     *  outside MAPS' three town types) keeps SEAT-TIP's own card. @param {unknown} mapId */
    tipAt(mapId) {
      const r = readingOf(mapId);
      if (!r) {
        const seat = host.online() && mapId != null && Number.isFinite(Number(mapId)) ? host.seatAt(Number(mapId) >>> 0) : null;
        return seat ? seatTipOf(seat, nowMs()) : null;
      }
      const seats = host.seats();
      const area = r.seat || seats == null ? undefined : bailiwickOf(seats, r.town.region, [r.town.px, r.town.py]);
      return townTipOf({ name: r.town.name, p: r.p, prev: r.prevOf(), raided: r.raided, players: r.players, seat: r.seat, area, patrons: host.patronsIn?.(r.town.region) ?? [], lanes: r.lanes }, nowMs());   // TE3: the area's chapters' patrons; SEA-TRADE: its harbour
    },
    /** ...as a function the Overworld's readout asks only of the plate under the pointer (travelViewHud.js showMarkTip),
     *  one kept a town - or null where no card could stand (offline; neither a town with an economy nor a seat).
     *  @param {unknown} mapId */
    tipFnAt(mapId) {
      if (!host.online() || mapId == null || !Number.isFinite(Number(mapId))) return null;
      const id = Number(mapId) >>> 0;
      if (!isEconTown(host.townOf(id)?.type) && !host.seatAt(id)) return null;
      let f = tipFns.get(id);
      if (!f) tipFns.set(id, (f = () => this.tipAt(id)));
      return f;
    },
  };
}
