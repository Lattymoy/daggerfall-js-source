// @ts-check
// ═══════════════════════════════════════════════════════════════════
// LW11 (2026-10-09, bible/06-Systems/Living-World-II.md "LW11"): THE CARAVAN'S DOOR, HOSTED - the windows a party on the
// road opens to the player and the deeds against it, over the pure law (systems/livingWorld/caravanDoor.js) and the
// character's own records (relations.js `wares`, `reports`, `escort`). Mac: "caravans ... that can be assaulted,
// protected or traded with".
//
//  - THE DOOR (`offers`): one who keeps a counter on the road (a caravan's merchant, a pedlar, a carter) or offers the
//    road (a merchant setting out) asks what the player wants before the words - Trade, Hire on, Travel on with them,
//    Talk, Goodbye. The talk's own door (townTalk.js `livingTalk.offers`).
//  - THE COUNTER: the trip's seeded roll on the host's trade window, what the character bought or took gone from it for
//    good, the purse paying out for what the player sells it until it is spent; a friend's prices FRIEND_DISCOUNT off;
//    a hand caught in its goods (the window's own steal) the road's crime. Robbed, its goods and its purse lie open.
//  - THE DEEDS: a traveller struck down, a hand caught in a purse or the goods, a party robbed - each REPORTED, charged to
//    the region the road runs through when a witness reaches a town (`reportAt`), void if none lives to.
//  - THE HOLD-UP: a party whose armed are all down while its leader stands yields - "Take it!" - its goods and purse the
//    player's, its cargo a quarter (LW10), the character's own robbery.
//  - THE ESCORT: hired on, kept by staying near, paid at the town it was bound for (ESCORT_FIGHT a foe of each fight won
//    beside it), broken by falling behind. Offline the escort may travel on with the caravan to its next stop: the
//    clock moved as a journey moves it (the host's `travelWith`).
import { counterOf, keepsCounter, reportAt, yields, escortOffer, escortPay, FRIEND_DISCOUNT, ESCORT_KEEP_M, ESCORT_LOST_MIN, ESCORT_FIGHT, WARE_KEY } from '../systems/livingWorld/caravanDoor.js';
import { partyAt, membersAt, NATIVE_PER_M, WALK_TO_H } from '../systems/livingWorld/trips.js';
import { firstNameOf } from '../systems/livingWorld/lines.js';
import { CRIMES } from '../systems/crimes.js';

/** The words of the door and the deeds. */
export const CARAVAN_LINES = Object.freeze({
  ask: (name) => `${name}: "What'll it be, traveller?"`,
  hired: (name, pay) => `${name}: "Good. ${pay} gold when we're in, more for every fight we win. Keep up."`,
  noCoin: (name) => `${name}: "I've no more coin this trip."`,
  yield: (name) => `${name}: "Take it! Take what you want - just let us be!"`,
  paid: (name, gold) => `${name}: "We're in, and in one piece. ${gold} gold, as agreed."`,
  broken: (name) => `${name} hired you to keep up. The contract is broken.`,
  turned: (name) => `${name}'s caravan turned back. There is no pay for a road not finished.`,
  fell: (name) => `${name} did not live to pay you.`,
});

/**
 * @param {{
 *   relations: () => any, clock: () => number, day: (t: number) => number, roads: () => any,
 *   findTrip: (res: any, t: number) => any, tripById: (id: string, t: number) => any, resOf: (id: string) => any,
 *   stock: (counter: any, trip: any) => any[], openTrade: (o: any) => boolean, openLoot: (o: any) => boolean,
 *   choose: (lines: string[], options: { code: string, label: string, action: () => void }[]) => void, say: (text: string) => void,
 *   regionAt: (x: number, z: number) => number, charge: (region: number, crime: number) => void, deadAt: (res: any, t: number) => boolean,
 *   here: () => ({ x: number, z: number } | null), level: () => number, pay: (gold: number) => void, goldItem: (n: number) => any,
 *   online: () => boolean, travelWith?: (trip: any, until: number) => boolean,
 * }} deps
 */
export function createCaravanHost(deps) {
  /** The counters this session: a trip's shelf, its first roll's items each with its place (`WARE_KEY`). @type {Map<string, { items: any[], all: any[] }>} */
  const shelves = new Map();
  /** The parties already seen to yield this session (their robbery written), and the escort's last minute near. */
  const yielded = new Set();
  let lostSince = /** @type {number|null} */ (null);
  /** The character's records; another character's (a load, a new game) forgets the session's counters. */
  let known = null;
  const rel = () => {
    const r = deps.relations();
    if (r !== known) { known = r; shelves.clear(); yielded.clear(); lostSince = null; }
    return r;
  };

  /** A trip's counter as this character left it: its roll, less what is gone. */
  function shelfOf(trip, counter) {
    const w = rel()?.wares?.(trip.id);   // first: another character's records forget this session's shelves
    let s = shelves.get(trip.id);
    if (!s) {
      const all = deps.stock(counter, trip).map((it, i) => { it[WARE_KEY] = i; return it; });
      s = { all, items: all.filter((it) => !w?.gone?.has(it[WARE_KEY])) };
      if (shelves.size > 64) shelves.delete(/** @type {string} */ (shelves.keys().next().value));
      shelves.set(trip.id, s);
    }
    return s;
  }
  /** The goods gone from a counter - its first roll's places no longer on it - written into the character's record. */
  function keep(trip, extraCoin = 0, robbed = undefined) {
    const s = shelves.get(trip.id);
    const w = rel()?.wares?.(trip.id) ?? null;
    const gone = s ? s.all.filter((it) => !s.items.includes(it)).map((it) => it[WARE_KEY]) : [...(w?.gone ?? [])];
    rel()?.setWares?.(trip.id, gone, (w?.coin ?? 0) + extraCoin, robbed === undefined ? (w?.robbed ?? null) : robbed);
  }

  /** A deed's report: the region where the party is, carried by those of it still standing. */
  function report(trip, t, crime, who = '') {
    const at = partyAt(trip, t);
    if (at.x == null) return false;
    const witnesses = membersAt(trip, t).filter((m) => !deps.deadAt(m, t)).map((m) => m.id);
    if (!witnesses.length) return false;
    return rel()?.report?.({ crime, region: deps.regionAt(/** @type {number} */ (at.x), /** @type {number} */ (at.z)), at: reportAt(trip, t), who, witnesses }) ?? false;
  }
  /** The party a resident is one of, among the roads' read. */
  const partyOf = (res) => deps.roads()?.parties?.().find((p) => p.trip.party.some((m) => m.id === res?.id))?.trip ?? null;

  function openCounter(trip, res, t, mode = 'Buy') {
    const counter = counterOf(trip);
    if (!counter) return false;
    const s = shelfOf(trip, counter);
    const w = rel()?.wares?.(trip.id) ?? null;
    const name = firstNameOf(res.name);
    if (w?.robbed != null) {
      // robbed: its goods and what is left of its purse lie open
      const left = Math.max(0, counter.purse - (w.coin ?? 0));
      if (left > 0) { s.items.push(deps.goldItem(left)); keep(trip, left); }
      return deps.openLoot({ items: s.items, title: counter.name });
    }
    const at = partyAt(trip, t);
    const friend = rel()?.standing?.(res.id, deps.day(t)) === 'friend';
    const b = { buildingType: counter.buildingType, quality: counter.quality, name: counter.name, buildingKey: null,
      regionIndex: deps.regionAt(/** @type {number} */ (at.x ?? 0), /** @type {number} */ (at.z ?? 0)), roadDiscount: friend ? FRIEND_DISCOUNT : 0 };
    return deps.openTrade({
      shelf: s, b, mode,
      /** before a deal is done: a sale past the purse refused (the goods go back to the pack) */
      allow: (mode, staged, price) => {
        if ((mode === 'Sell' || mode === 'SellMagic') && (rel()?.wares?.(trip.id)?.coin ?? 0) + price > counter.purse) { deps.say(CARAVAN_LINES.noCoin(name)); return false; }
        return true;
      },
      /** a deal done: the goods gone (or sold to it), the coin it paid out */
      done: (mode, staged, price) => keep(trip, mode === 'Sell' || mode === 'SellMagic' ? price : 0),
      /** the window's steal caught: the road's crime - the party's regard, and a report */
      caught: () => {
        const day = deps.day(deps.clock());
        for (const m of membersAt(trip, deps.clock())) rel()?.note?.(m.id, 'crime', day);
        report(trip, deps.clock(), CRIMES.Theft, '');
      },
    });
  }

  function hire(trip, res, t) {
    const pay = escortPay(trip, deps.level(), 0);
    rel()?.setEscort?.({ trip: trip.id, t, pay, fights: 0, leader: res.id, to: trip.to?.mapId ?? 0 });
    lostSince = null;
    deps.say(CARAVAN_LINES.hired(firstNameOf(res.name), pay));
  }

  /** The escort's next stop - the trouble ahead, the night's camp, the town - for the offline journey with them. */
  function nextStop(trip, t) {
    const stops = [trip.outT1];
    if (trip.enc && trip.enc.t0 > t && trip.enc.t0 < trip.outT1) stops.push(trip.enc.t0 - 1);
    const dusk = Math.floor(t / 1440) * 1440 + WALK_TO_H * 60;
    stops.push(dusk > t ? dusk : dusk + 1440);
    return Math.min(...stops);
  }

  return {
    /**
     * THE DOOR: one of the road's people who keeps a counter or offers the road asks first. Answers whether a choice was
     * opened (the talk waits behind it as the Talk choice).
     * @param {any} person @param {() => void} talk
     */
    offers(person, talk) {
      const res = person?.living?.res;
      if (!res) return false;
      const t = deps.clock();
      const trip = deps.findTrip(res, t);
      if (!trip || trip.leader?.id !== res.id) return false;
      const options = [];
      const name = firstNameOf(res.name);
      const contract = rel()?.escort?.() ?? null;
      if (keepsCounter(trip, res, t)) {
        if (rel()?.wares?.(trip.id)?.robbed != null) options.push({ code: 'KeyT', label: 'T - take', action: () => openCounter(trip, res, t) });
        else {
          options.push({ code: 'KeyB', label: 'B - buy', action: () => openCounter(trip, res, t, 'Buy') });
          options.push({ code: 'KeyS', label: 'S - sell', action: () => openCounter(trip, res, t, 'Sell') });
        }
      }
      if (!contract && escortOffer(trip, t)) options.push({ code: 'KeyH', label: `H - hire on (${escortPay(trip, deps.level(), 0)} gold)`, action: () => hire(trip, res, t) });
      if (contract?.trip === trip.id && !deps.online() && deps.travelWith && t < trip.outT1) options.push({ code: 'KeyR', label: 'R - travel on with them', action: () => deps.travelWith?.(trip, nextStop(trip, t)) });
      if (!options.length) return false;
      options.push({ code: 'KeyA', label: 'A - talk', action: () => talk() });
      options.push({ code: 'Escape', label: 'Esc - goodbye', action: () => {} });
      deps.choose([CARAVAN_LINES.ask(name)], options);
      return true;
    },
    /** A traveller struck down by the player: a murder, reported. @param {any} res @param {number} t */
    slain(res, t) { const trip = partyOf(res); return trip ? report(trip, t, CRIMES.Murder, res.name) : false; },
    /** A hand caught in a traveller's purse: a pickpocketing, reported. @param {any} res @param {number} t */
    caught(res, t) { const trip = partyOf(res); return trip ? report(trip, t, CRIMES.Pickpocketing, '') : false; },
    /** The minute the character robbed a trip (its cargo a quarter), or null. @param {string} tripId */
    robbed: (tripId) => rel()?.wares?.(tripId)?.robbed ?? null,
    /**
     * Once a second: the hold-ups (a party near yielding), the reports a witness has carried in, the escort.
     */
    step() {
      const t = deps.clock();
      const r = rel();
      if (!r) return;
      // THE COUNTERS: what left a shelf this session (bought, stolen, taken) kept in the character's record
      for (const [id, sh] of shelves) {
        const gone = sh.all.filter((it) => !sh.items.includes(it)).map((it) => it[WARE_KEY]);
        const w = r.wares?.(id);
        if (gone.length !== (w?.gone?.size ?? 0) || gone.some((i) => !w?.gone?.has(i))) r.setWares?.(id, gone, w?.coin ?? 0, w?.robbed ?? null);
      }
      // THE HOLD-UP
      for (const p of deps.roads()?.parties?.() ?? []) {
        const trip = p.trip;
        if (yielded.has(trip.id) || !counterOf(trip) || r.wares?.(trip.id)?.robbed != null) continue;
        if (!yields(trip, t, (m) => deps.deadAt(m, t))) continue;
        yielded.add(trip.id);
        keep(trip, 0, t);
        report(trip, t, CRIMES.Theft, '');
        deps.say(CARAVAN_LINES.yield(firstNameOf(trip.leader.name)));
      }
      // THE REPORTS carried in - charged, or void when nobody lived to carry them
      for (const rep of [...(r.reports?.() ?? [])]) {
        if (t < rep.at) continue;
        const alive = rep.witnesses.some((id) => { const w = deps.resOf(id); return w && !deps.deadAt(w, rep.at); });
        if (alive) deps.charge(rep.region, rep.crime);
        r.dropReport(rep);
      }
      // THE ESCORT
      const c = r.escort?.();
      if (!c) { lostSince = null; return; }
      const trip = deps.tripById(c.trip, t);
      const leader = deps.resOf(c.leader);
      const name = firstNameOf(leader?.name ?? '');
      if (!trip) { r.setEscort(null); return; }
      if (leader && deps.deadAt(leader, t)) { deps.say(CARAVAN_LINES.fell(name)); r.setEscort(null); return; }
      if (trip.enc && r.turns?.().won?.has(trip.enc.id) && !c.fights) r.setEscort({ ...c, fights: trip.enc.foes?.length ?? 1 });
      if (trip.turned && t >= (trip.enc?.t1 ?? trip.outT1)) { deps.say(CARAVAN_LINES.turned(name)); r.setEscort(null); return; }
      if (t >= trip.outT1) {
        const gold = c.pay + ESCORT_FIGHT * (r.escort()?.fights ?? 0);
        deps.pay(gold);
        for (const m of membersAt(trip, t)) r.note(m.id, 'helped', deps.day(t));
        deps.say(CARAVAN_LINES.paid(name, gold));
        r.setEscort(null);
        lostSince = null;
        return;
      }
      if (t < trip.outT0) return;   // not yet out
      const at = partyAt(trip, t), here = deps.here();
      const far = !here || at.x == null || Math.hypot(here.x - /** @type {number} */ (at.x), here.z - /** @type {number} */ (at.z)) / NATIVE_PER_M > ESCORT_KEEP_M;
      if (!far) { lostSince = null; return; }
      lostSince ??= t;
      if (t - lostSince > ESCORT_LOST_MIN) {
        deps.say(CARAVAN_LINES.broken(name));
        if (leader) r.note(leader.id, 'insulted', deps.day(t));
        r.setEscort(null);
        lostSince = null;
      }
    },
    /** A trip's counter as this session holds it (the probes; the pins). @param {any} trip */
    shelfOf: (trip) => { const c = counterOf(trip); return c ? shelfOf(trip, c) : null; },
    /** The session forgotten (a load: the records are the character's, read again). */
    reset() { shelves.clear(); yielded.clear(); lostSince = null; },
  };
}
