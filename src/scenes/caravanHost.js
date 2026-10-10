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
import { counterOf, keepsCounter, reportAt, yields, escortOffer, escortPay, escortNear, FRIEND_DISCOUNT, ESCORT_KEEP_M, ESCORT_LOST_MIN, ESCORT_FIGHT, WARE_KEY } from '../systems/livingWorld/caravanDoor.js';
import { partyAt, membersAt, NATIVE_PER_M, WALK_TO_H } from '../systems/livingWorld/trips.js';
import { firstNameOf } from '../systems/livingWorld/lines.js';
import { mintResident } from '../systems/livingWorld/census.js';
import { placeKeyOf } from '../systems/livingWorld/lives.js';
import { CRIMES } from '../systems/crimes.js';

/** The words of the door and the deeds. */
export const CARAVAN_LINES = Object.freeze({
  ask: (name) => `${name}: "What'll it be, traveller?"`,
  hired: (name, pay) => `${name}: "Good. ${pay} gold when we're in, more for every fight we win. Keep up."`,
  noCoin: (name) => `${name}: "I've no more coin this trip."`,
  bandTook: (name) => `${name}: "Coin? The outlaws took every septim we had, and half the goods besides."`,   // LW12
  yield: (name) => `${name}: "Take it! Take what you want - just let us be!"`,
  paid: (name, gold) => `${name}: "We're in, and in one piece. ${gold} gold, as agreed."`,
  broken: (name) => `${name} hired you to keep up. The contract is broken.`,
  turned: (name) => `${name}'s caravan turned back. There is no pay for a road not finished.`,
  fell: (name) => `${name} did not live to pay you.`,
});

/** LW12: whether a band held the trip up by minute `t` (trouble.js `robbed`, `by` the band) - its purse and half its
 *  goods gone. @param {any} trip @param {number} t */
export const bandTook = (trip, t) => trip?.robbed?.by != null && t >= trip.robbed.t;

/** A traveller's id: `L<map>.t<slot>`, a newcomer's `~<gen>` after it (census.js mintResident). */
const TRAVELLER_ID = /^L(\d+)\.t\d+(?:~(\d+))?/;
/**
 * A TRAVELLER BY ID - the census's own, or the NEWCOMER holding their place (`~<gen>`), minted as the lives mint them
 * (world.js livingPlaceOf). AUDIT LW-II C1: the roster holds the census's ids alone, and at the game's epoch nearly every
 * place is a newcomer's - looked up by id, nobody was found: every report void ("no living witness"), every escort
 * dropped the second after it was made. `townOf(mapId)` a town; `rosterOf(town)` its travellers.
 * @param {string} id @param {(mapId: number) => any} townOf @param {(town: any) => any[]} rosterOf
 */
export function travellerOf(id, townOf, rosterOf) {
  const m = TRAVELLER_ID.exec(String(id ?? ''));
  const town = m ? townOf(Number(m[1]) >>> 0) : null;
  if (!m || !town) return null;
  const key = placeKeyOf({ id });
  const place = rosterOf(town).find((r) => r.id === key) ?? null;
  if (!place || m[2] == null) return place;
  return mintResident(town, place.roll ?? 't', place.slot, place.job, { gen: Number(m[2]), home: place.home, work: place.work, faction: place.faction });
}
/**
 * A TRIP BY ID (`<leader>:<cycle>`) among its leader's town's trips about minute `t` - null none, undefined while they
 * wait on their ways (asked again: AUDIT LW-II C1, a contract dropped while the roads were planned). `tripsOf(town, t)`
 * the town's trips (trips.js townTrips).
 * @param {string} id @param {number} t @param {(mapId: number) => any} townOf @param {(town: any, t: number) => (any[] | undefined)} tripsOf
 */
export function tripOfId(id, t, townOf, tripsOf) {
  const m = TRAVELLER_ID.exec(String(id ?? ''));
  const town = m ? townOf(Number(m[1]) >>> 0) : null;
  if (!town) return null;
  const trips = tripsOf(town, t);
  return trips === undefined ? undefined : trips.find((tr) => tr.id === id) ?? null;
}

/**
 * @param {{
 *   relations: () => any, clock: () => number, day: (t: number) => number, roads: () => any,
 *   findTrip: (res: any, t: number) => any, tripById: (id: string, t: number) => any, resOf: (id: string) => any, slainAt: (res: any, t: number) => boolean,
 *   stock: (counter: any, trip: any) => any[], openTrade: (o: any) => boolean, openLoot: (o: any) => boolean,
 *   choose: (lines: string[], options: { code: string, label: string, action: () => void }[]) => void, say: (text: string) => void,
 *   regionAt: (x: number, z: number) => number, charge: (region: number, crime: number) => void, deadAt: (res: any, t: number) => boolean,
 *   here: () => ({ x: number, z: number } | null), level: () => number, pay: (gold: number) => void, goldItem: (n: number) => any,
 *   online: () => boolean, travelWith?: (trip: any, until: number) => boolean,
 * }} deps - `tripById(id, t)` undefined while the trips wait on their ways; AUDIT LW-II C4 `slainAt(res, t)` whether the
 *   player's own hand struck `res` down by `t` (relations.js `slain`)
 */
export function createCaravanHost(deps) {
  /** The counters this session: a trip's shelf, its first roll's items each with its place (`WARE_KEY`); LW12 `lost` the
   *  places a band took (never the character's); AUDIT LW-II C7 the coin its purse paid out and the minute the character
   *  robbed it, as this session knows them (written back as they are - never a forgotten record's nothing), and `sig` the
   *  shelf as last written. @type {Map<string, { items: any[], all: any[], lost: Set<number>, coin: number, robbed: number | null, sig: string }>} */
  const shelves = new Map();
  /** The parties already seen to yield this session (their robbery written). */
  const yielded = new Set();
  /** The character's records; another character's (a load, a new game) forgets the session's counters. */
  let known = null;
  const rel = () => {
    const r = deps.relations();
    if (r !== known) { known = r; shelves.clear(); yielded.clear(); }
    return r;
  };
  /** The minute the character robbed a trip, or null: the session's shelf first (AUDIT LW-II C7: its record may have
   *  left the book), then the record. @param {string} tripId */
  const robbedOf = (tripId) => { const r = rel(); return shelves.get(tripId)?.robbed ?? r?.wares?.(tripId)?.robbed ?? null; };
  /** The places gone from a shelf - its first roll's, no longer on it (the band's never the character's). @param {any} s */
  const goneOf = (s) => s.all.filter((/** @type {any} */ it) => !s.items.includes(it) && !s.lost.has(it[WARE_KEY])).map((/** @type {any} */ it) => it[WARE_KEY]);
  /** A shelf as its record holds it - its gone, its coin, its robbery. @param {any} s */
  const sigOf = (s) => `${goneOf(s).join(',')}|${s.coin}|${s.robbed}`;

  /** A trip's counter as this character left it: its roll, less what is gone. */
  function shelfOf(trip, counter, t = deps.clock()) {
    const w = rel()?.wares?.(trip.id);   // first: another character's records forget this session's shelves
    let s = shelves.get(trip.id);
    if (!s) {
      const all = deps.stock(counter, trip).map((it, i) => { it[WARE_KEY] = i; return it; });
      // LW12: a band's hold-up took half the goods (every other place) - the band's, never the character's
      const lost = new Set(bandTook(trip, t) ? all.filter((it) => it[WARE_KEY] % 2 === 1).map((it) => it[WARE_KEY]) : []);
      s = { all, lost, items: all.filter((it) => !w?.gone?.has(it[WARE_KEY]) && !lost.has(it[WARE_KEY])), coin: w?.coin ?? 0, robbed: w?.robbed ?? null, sig: '' };
      s.sig = sigOf(s);
      if (shelves.size > 64) shelves.delete(/** @type {string} */ (shelves.keys().next().value));
      shelves.set(trip.id, s);
    }
    return s;
  }
  /** The goods gone from a counter - its first roll's places no longer on it - written into the character's record, with
   *  the coin it paid out and its robbery (AUDIT LW-II C7: the session's shelf's, where it stands). */
  function keep(trip, extraCoin = 0, robbed = undefined) {
    const s = shelves.get(trip.id);
    const w = rel()?.wares?.(trip.id) ?? null;
    const gone = s ? goneOf(s) : [...(w?.gone ?? [])];
    const coin = (s ? s.coin : (w?.coin ?? 0)) + extraCoin;
    const was = robbed === undefined ? (s ? s.robbed : (w?.robbed ?? null)) : robbed;
    if (s) { s.coin = coin; s.robbed = was; s.sig = sigOf(s); }
    rel()?.setWares?.(trip.id, gone, coin, was);
  }

  /** A deed's report: the region where the party is, carried by those of it still standing (AUDIT LW-II C10: the trip
   *  named, so the dice's own deaths on the way are read at the town). */
  function report(trip, t, crime, who = '') {
    const at = partyAt(trip, t);
    if (at.x == null) return false;
    const witnesses = membersAt(trip, t).filter((m) => !deps.deadAt(m, t)).map((m) => m.id);
    if (!witnesses.length) return false;
    return rel()?.report?.({ crime, region: deps.regionAt(/** @type {number} */ (at.x), /** @type {number} */ (at.z)), at: reportAt(trip, t), who, witnesses, trip: trip.id }) ?? false;
  }
  /** The party a resident is one of, among the roads' read. */
  const partyOf = (res) => deps.roads()?.parties?.().find((p) => p.trip.party.some((m) => m.id === res?.id))?.trip ?? null;

  function openCounter(trip, res, t, mode = 'Buy') {
    const counter = counterOf(trip);
    if (!counter) return false;
    const s = shelfOf(trip, counter);
    const name = firstNameOf(res.name);
    if (s.robbed != null) {
      // robbed: its goods and what is left of its purse lie open - AUDIT LW-II C6: none, where a band took every septim first
      const left = bandTook(trip, deps.clock()) ? 0 : Math.max(0, counter.purse - s.coin);
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
        if ((mode === 'Sell' || mode === 'SellMagic') && bandTook(trip, deps.clock())) { deps.say(CARAVAN_LINES.bandTook(name)); return false; }   // LW12: its purse the band's
        if ((mode === 'Sell' || mode === 'SellMagic') && s.coin + price > counter.purse) { deps.say(CARAVAN_LINES.noCoin(name)); return false; }
        return true;
      },
      /** a deal done: the goods gone (or sold to it), the coin it paid out */
      done: (mode, staged, price) => keep(trip, mode === 'Sell' || mode === 'SellMagic' ? price : 0),
      /** the window's steal caught: the road's crime - the party's regard, and a report */
      caught: () => {
        const day = deps.day(deps.clock());
        for (const m of membersAt(trip, deps.clock())) rel()?.note?.(m.id, 'crime', day);
        report(trip, deps.clock(), CRIMES.Theft, trip.leader?.name ?? '');   // LW16: the one robbed, for the tale
      },
    });
  }

  function hire(trip, res, t) {
    const pay = escortPay(trip, deps.level(), 0, t);   // AUDIT LW-II C5a: the walk still ahead
    rel()?.setEscort?.({ trip: trip.id, t, pay, fights: 0, leader: res.id, to: trip.to?.mapId ?? 0, near: t });
    deps.say(CARAVAN_LINES.hired(firstNameOf(res.name), pay));
  }
  /** Offline, travelled on with them to `until`: the player set down beside the party - with it the while (AUDIT LW-II
   *  C5b: the clock's jump is no stretch behind). */
  function travel(trip, until) {
    if (!deps.travelWith?.(trip, until)) return;
    const c = rel()?.escort?.();
    if (c?.trip === trip.id) rel().setEscort({ ...c, near: Math.max(c.near ?? until, until) });
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
      const robbed = robbedOf(trip.id) != null;
      if (keepsCounter(trip, res, t)) {
        if (robbed) options.push({ code: 'KeyT', label: 'T - take', action: () => openCounter(trip, res, t) });
        else {
          options.push({ code: 'KeyB', label: 'B - buy', action: () => openCounter(trip, res, t, 'Buy') });
          options.push({ code: 'KeyS', label: 'S - sell', action: () => openCounter(trip, res, t, 'Sell') });
        }
      }
      // AUDIT LW-II C5e: never the road of a party the character robbed
      if (!contract && !robbed && escortOffer(trip, t)) options.push({ code: 'KeyH', label: `H - hire on (${escortPay(trip, deps.level(), 0, t)} gold)`, action: () => hire(trip, res, t) });
      if (contract?.trip === trip.id && !deps.online() && deps.travelWith && t < trip.outT1) options.push({ code: 'KeyR', label: 'R - travel on with them', action: () => travel(trip, nextStop(trip, t)) });
      if (!options.length) return false;
      options.push({ code: 'KeyA', label: 'A - talk', action: () => talk() });
      options.push({ code: 'Escape', label: 'Esc - goodbye', action: () => {} });
      deps.choose([CARAVAN_LINES.ask(name)], options);
      return true;
    },
    /** A traveller struck down by the player: a murder, reported. @param {any} res @param {number} t */
    slain(res, t) { const trip = partyOf(res); return trip ? report(trip, t, CRIMES.Murder, res.name) : false; },
    /** A hand caught in a traveller's purse: a pickpocketing, reported. @param {any} res @param {number} t */
    caught(res, t) { const trip = partyOf(res); return trip ? report(trip, t, CRIMES.Pickpocketing, res.name ?? '') : false; },   // LW16: the one robbed, for the tale
    /** The minute the character robbed a trip (its cargo a quarter), or null. @param {string} tripId */
    robbed: (tripId) => robbedOf(tripId),
    /**
     * Once a second: the hold-ups (a party near yielding), the reports a witness has carried in, the escort.
     */
    step() {
      const t = deps.clock();
      const r = rel();
      if (!r) return;
      // THE COUNTERS: what left a shelf this session (bought, stolen, taken) kept in the character's record - AUDIT LW-II
      // C7: with the session's own coin and robbery, never a forgotten record's nothing (a robbed counter's record pushed
      // out of the book came back unrobbed, its purse whole); one gone from the book is written again while it is robbed
      for (const [id, sh] of shelves) {
        const sig = sigOf(sh);
        if (sig === sh.sig && (sh.robbed == null || r.wares?.(id))) continue;
        sh.sig = sig;
        r.setWares?.(id, goneOf(sh), sh.coin, sh.robbed);
      }
      // THE HOLD-UP - AUDIT LW-II C4: the party's armed beaten by the player's own hand, the player there (it yielded to
      // whoever was within the roads' read when its guards fell to the dice, or died fighting beside the player)
      const here = deps.here();
      for (const p of deps.roads()?.parties?.() ?? []) {
        const trip = p.trip;
        if (yielded.has(trip.id) || !counterOf(trip) || robbedOf(trip.id) != null) continue;
        const at = partyAt(trip, t);
        if (!here || at.x == null || Math.hypot(here.x - /** @type {number} */ (at.x), here.z - /** @type {number} */ (at.z)) / NATIVE_PER_M > ESCORT_KEEP_M) continue;
        if (!yields(trip, t, (m) => deps.slainAt(m, t))) continue;
        yielded.add(trip.id);
        keep(trip, 0, t);
        report(trip, t, CRIMES.Theft, trip.leader?.name ?? '');   // LW16: the one robbed, for the tale
        deps.say(CARAVAN_LINES.yield(firstNameOf(trip.leader.name)));
      }
      // THE REPORTS carried in - charged, or void when nobody lived to carry them (AUDIT LW-II C10: nor one the road took
      // on the way - its trip's own fallen, which the hand deaths never read)
      for (const rep of [...(r.reports?.() ?? [])]) {
        if (t < rep.at) continue;
        const trip = rep.trip ? deps.tripById(rep.trip, rep.at) : null;
        if (trip === undefined) continue;   // its trips wait on their ways: asked again
        const stood = trip ? new Set(membersAt(trip, rep.at).map((m) => m.id)) : null;
        const alive = rep.witnesses.some((id) => { const w = deps.resOf(id); return w && (!stood || stood.has(id)) && !deps.deadAt(w, rep.at); });
        if (alive) deps.charge(rep.region, rep.crime);
        // LW16: a robbery charged is a tale its region's towns tell (relations.js TALE_KINDS `held`) - the word travels
        if (alive && rep.crime !== CRIMES.Murder && rep.who && rep.region >= 0) r.turn('held', `R${rep.region >>> 0}.${rep.at}~${rep.crime}`, { t: rep.at, who: rep.who });
        r.dropReport(rep);
      }
      // THE ESCORT - AUDIT LW-II C5: judged to the town however the clock came past it (a rest, a wait, a load, indoors -
      // the step runs there too), from the minute the escort was last with the party (the contract's `near`)
      let c = r.escort?.();
      if (!c) return;
      const trip = deps.tripById(c.trip, c.t);   // the trip as hired - found about its hire, however long ago
      if (trip === undefined) return;   // its trips wait on their ways: asked again
      if (!trip) { r.setEscort(null); return; }
      const lead = c.leader;
      const leader = deps.resOf(lead);
      const name = firstNameOf(leader?.name ?? '');
      const end = Math.min(t, trip.outT1);
      // the leader fallen - a hand's death, or (AUDIT LW-II C5d) the road's own, which the hand deaths never read
      if ((leader && deps.deadAt(leader, end)) || !membersAt(trip, end).some((m) => m.id === lead)) { deps.say(CARAVAN_LINES.fell(name)); r.setEscort(null); return; }
      // AUDIT LW-II C5c: turned back at its trouble - its way out ends there (`outT1` the trouble's minute), unpaid; it paid
      // through the halt (a leader falling in it did not live to pay)
      if (trip.turned && t >= trip.outT1) { deps.say(trip.fallen?.some((f) => f.res?.id === lead) ? CARAVAN_LINES.fell(name) : CARAVAN_LINES.turned(name)); r.setEscort(null); return; }
      // AUDIT LW-II C5e: a fight won before the hire is none of the escort's
      if (trip.enc && trip.enc.t0 >= c.t && r.turns?.().won?.has(trip.enc.id) && !c.fights) { c = { ...c, fights: trip.enc.foes?.length ?? 1 }; r.setEscort(c); }
      if (t < trip.outT0) return;   // not yet out
      const was = Math.max(c.near ?? c.t, c.t, trip.outT0);
      const near = escortNear(trip, here, was, end);
      if (end - near > ESCORT_LOST_MIN) {
        deps.say(CARAVAN_LINES.broken(name));
        if (leader) r.note(leader.id, 'insulted', deps.day(t));
        r.setEscort(null);
        return;
      }
      if (near !== c.near) { c = { ...c, near }; r.setEscort(c); }
      if (t >= trip.outT1) {
        const gold = c.pay + ESCORT_FIGHT * c.fights;
        deps.pay(gold);
        for (const m of membersAt(trip, end)) r.note(m.id, 'helped', deps.day(t));
        deps.say(CARAVAN_LINES.paid(name, gold));
        r.setEscort(null);
      }
    },
    /** A trip's counter as this session holds it (the probes; the pins). @param {any} trip */
    shelfOf: (trip) => { const c = counterOf(trip); return c ? shelfOf(trip, c) : null; },
    /** The session forgotten (a load: the records are the character's, read again). */
    reset() { shelves.clear(); yielded.clear(); },
  };
}
