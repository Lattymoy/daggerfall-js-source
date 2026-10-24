// @ts-check
// CAPT-BOARD (2026-10-11, the owner: "giving a reason to players to experience it"; bible/03-World/Captains-Sea.md
// CAPT-BOARD) - THE HARBOUR OFFICE: the harbourmaster's board, the contracts a captain holds, and the crown's favours a
// captain's rank buys, stood over the captain's ledger (systems/naval/captainLedger.js) for the world host. The yard's
// window draws it as its Harbourmaster tab (ui/naval/navalYardWindow.js); the naval host tells it what happened at sea
// (`event`) and asks it where the held contracts' waters are (`sites`); the world steps its clock (`tick`).
//
// deps = {
//   ledger                     the captain's ledger
//   now() -> minutes           the captain's own clock (playerTicker ownMinutes)
//   day() -> number            the world's day (the boards' - the same for every client)
//   level() -> number          the captain's level
//   gold() / pay(n) / credit(n)  the purse
//   say(text, s) / mid(text, s)  the HUD's line and the screen's middle
//   notorietyOf(crown)         a crown's notoriety against the captain in its waters (navalHost.js)
//   port() -> port | null      the port the captain lies at: { key, name, px, py, region, crown }
//   ports() -> port[]          every port of the map (its towns - FIELD BUGS 2026-10-13c PORT-TOWNS)
//   seaAt(px, py) -> bool      a map pixel of open sea (a site's water; the sea beside a port a cargo goes to)
//   waters() -> crown | null   the crown of the waters the captain sails
//   carrack(price, port) -> bool  the Admiralty's carrack's title to the Fleet's book (systems/fleet.js titleDeed)
//   stow(hold, item)           an item into a ship's hold (CAPT-TRADE)
//   etherGoods() -> bool       whether the captain may sail for the Eltheric Ocean's goods (AUDIT CAPTAIN'S SEA B16)
//   town                       SEA-TRADE: the town economy (scenes/townEconHost.js) - `exchangeAt(port)` the port town's
//                              exchange factors (null offline, or no town economy), `seaDeal(port)` a dealing made there
// }
//
// CAPT-TRADE: THE EXCHANGE (systems/naval/tradeGoods.js) - the port's goods at the day's prices, bought into the hold of
// the boat at the quay and sold out of it, as much as the exchange deals in today (the ledger keeps the day's dealing).
// SEA-TRADE (bible/06-Systems/Town-Economy-Arc.md section 8): online, at its port town's economy's prices, every
// dealing told to the town economy (a sea act of the players' share), and a good bought carrying what it cost and the
// counter's mark (tradeModes.js markCounterBought: LAW-3; AUDIT LW-II-2 S1 - no patron takes it, as no shop buys it, B2).
//
// CREW-TRADE (bible/03-World/Captains-Sea.md CREW-TRADE): and the port's CREW, a row of its own - men signed on to the ship
// at the quay and signed off her by the head (systems/naval/crewTrade.js; her side scenes/naval/crewDeal.js, which the
// shipwright's window's model carries as `crewDeal`), at the port's price for a man, a gold under the shipwright's at
// most, as many as the exchange deals in today.
//
// CAPT-CHARTS: TREASURE CHARTS (systems/naval/treasureCharts.js) - one among a pirate's papers (`chartFor`), read and
// marked (`readChart`), its cache a site of the naval host's, raised and paid (`raiseCache`).

import { boardFor, takeContract, contractLine, contractSites, marqueOffer, admiraltyOffer, deliveryPort, CONTRACTS_MAX, STANDING_ABANDONED } from '../systems/naval/harbourBoard.js';
import { MINUTES_PER_DAY } from '../systems/gameDate.js';
import { perksOf, PERKS_REFUSED_AT, LEAGUE_M } from '../systems/naval/captainLedger.js';
import { exchangeOf, goodById, goodIn, takeGood, mintGood, goodsWeight, CREW } from '../systems/naval/tradeGoods.js';
import { crewRowOf, CREW_TRADE_TEXT, handsNamed } from '../systems/naval/crewTrade.js';   // CREW-TRADE: crew at the exchange
import { markCounterBought } from '../systems/tradeModes.js';   // SEA-TRADE: a good bought of the exchange carries what it cost (LAW-3)
import { chartAboard, chartSite, mintChart, cacheGold, CHART_SITE } from '../systems/naval/treasureCharts.js';
import { t } from '../systems/textManager.js';   // FIELD BUGS 2026-10-13c PORT-TOWNS: a cargo voided, in the player's language
import { noteAct } from '../systems/questlines/qlActs.js';   // QL11: the features' acts, heard by the running quests

const gold = (n) => `${Math.round(n).toLocaleString('en-US')} gold`;
const days = (n) => `${n} ${n === 1 ? 'day' : 'days'}`;
/** FIELD BUGS 2026-10-13c PORT-TOWNS: a cargo voided - held for a place that is no port a cargo goes to (`unported`). */
const cargoVoidWords = (c) => t('sea.board.cargoVoid', 'Contract void - {title}. No ship can make port there.', { title: c.title });
/** A held contract's progress, as the HUD says it when it moves. */
const movedWords = (c) => (c.kind === 'hunt' ? `${c.done} of ${c.need} pirate ships ended` : c.kind === 'survey' ? `${c.done} of ${c.need} ships studied`
  : c.kind === 'salvage' ? `${c.done} of ${c.need} casks raised` : '');

/** QL11: A PORT REACHED UNDER SAIL - a berth (the naval host's: her way under YARD_SPEED in a port's waters, said every
 *  second she is there) at another port than the one she sailed from, with at least this much way made at the helm since
 *  she lay there (m, the captain's log's own count): a quarter league.
 *  FIELD BUGS 2026-10-21b VOYAGE-HOLD: SHE SAILED FROM WHERE SHE LAST LAY STILL. The voyage was counted from the LAST berth
 *  heard, and a boat making 2.5 m/s or less (YARD_SPEED) berths every second she is in a port's waters - a Rowboat
 *  (2 m/s) always, a Large Boat in a light wind - so her departure followed her out to the edge of the port's waters and
 *  the quarter league had to lie between the two ports' waters: 26 pairs of ports lie closer than that. Now the
 *  departure is the port she last lay STILL in (`still`: her own way under navalBerth.js BERTH_STILL, or the helm let
 *  go), kept while she moves on; a berth elsewhere a quarter league on is the port reached, and she lies there from then.
 *  One drifting where two ports' waters meet lies still in each in turn, so never makes the quarter league between them.
 *  The departure is the log's own (captainLedger.js newLog `departed`): a load between two ports keeps the voyage. */
export const PORT_VOYAGE_M = LEAGUE_M / 4;

/** @param {any} deps */
export function createHarbourOffice(deps) {
  const L = deps.ledger;   // CAPTAIN-TREE: and her stars - `trade` the exchange's spread her dealing closes (tradeGoods.js exchangeOf)
  const now = () => Math.floor(Number(deps.now?.()) || 0);
  /** A crown's favours for the captain now - none while its navy hunts them. */
  const perksAt = (crown) => (crown ? perksOf(L.rank(crown).rank, deps.notorietyOf?.(crown) ?? 0) : perksOf(0));
  /** The port the captain lies at, or null. */
  const portHere = () => deps.port?.() ?? null;
  /** SEA-TRADE: the port town's exchange factors, or null (offline, an isle, no town economy). */
  const townAt = (port) => deps.town?.exchangeAt?.(port) ?? null;
  /** The favours of the waters the captain sails (the yard's, the hands'): their crown's rank's. */
  const perksHere = () => perksAt(portHere()?.crown ?? deps.waters?.() ?? null);

  /** QL11 / VOYAGE-HOLD: a berth on the voyage's count (PORT_VOYAGE_M) - the port reached, or where she lies now. A berth
   *  that does not say `still` lies still (the old shape: every berth its own departure). */
  function berthed(ev) {
    const log = L.log;
    if (!log) return;
    const sailed = Number(log.sailed) || 0, from = log.departed ?? null;
    if (from && from.port !== ev.port && sailed - from.sailed >= PORT_VOYAGE_M) { noteAct('port-reached'); log.departed = { port: ev.port, sailed }; return; }   // QL11: a port reached under sail
    if (!from || ev.still !== false) log.departed = { port: ev.port, sailed };
  }
  /** What happened at sea, to the contracts held: each done paid and said, each failed said, each come further said. */
  function event(ev) {
    if (ev?.type === 'berth' && typeof ev.port === 'string') berthed(ev);
    const r = L.contractEvent(ev);
    for (const c of r.done) { deps.credit?.(c.pay); deps.mid?.(`Contract done - ${c.title}. ${gold(c.pay)} paid by ${c.port?.name ?? c.crown}'s harbormaster.`, 5); }
    for (const c of r.done) if (c.kind === 'delivery') noteAct('cargo-delivered');   // QL11: a cargo delivered - its port's harbormaster paid it
    for (const c of r.failed) deps.mid?.(`Contract failed - ${c.title}.${c.kind === 'delivery' ? ' The cargo went down with the ship.' : ''}`, 5);
    for (const c of r.moved) deps.say?.(`${c.title}: ${movedWords(c)}.`, 3);
    for (const c of r.voided ?? []) deps.mid?.(c.kind === 'delivery' ? cargoVoidWords(c) : `Bounty void - ${c.title}. Someone else sank it.`, 5);   // AUDIT CAPTAIN'S SEA B4; FIELD BUGS 2026-10-13c PORT-TOWNS
    return r;
  }
  /** The clock's step: every contract whose term is out failed, and said. FIELD BUGS 2026-10-13c PORT-TOWNS: and every
   *  cargo held for a place that is no port a cargo goes to - none of the map's ports (`deps.ports`, its towns), or one
   *  with no sea beside it (harbourBoard.js deliveryPort) - void, no regard lost, and said: a board that read Travel
   *  Options' every place a ship may put in at as a port posted cargoes to tombs, farms and inland capitals, which no
   *  ship can lie at. Asked once the map's ports and the sea stand. */
  function tick() {
    const failed = L.expireContracts(now());
    for (const c of failed) deps.mid?.(`Contract failed - ${c.title}. Its term ran out.`, 5);
    const ports = deps.ports?.() ?? [];
    if (ports.length && typeof deps.seaAt === 'function') {
      for (const c of L.contracts()) {
        if (c.kind !== 'delivery' || (ports.some((p) => p.key === c.to?.key) && deliveryPort(c.to, deps.seaAt))) continue;
        event({ type: 'unported', port: c.to?.key });
      }
    }
    return failed;
  }
  /** The board of the port the captain lies at, today - its offers not yet taken. */
  function board(port = portHere()) {
    if (!port?.crown) return [];
    return boardFor({ port, crown: port.crown, day: deps.day?.() ?? 0, level: deps.level?.() ?? 1, perks: perksAt(port.crown), ports: deps.ports?.() ?? [], seaAt: deps.seaAt ?? null, regionIndex: port.region ?? 17, taken: L.taken() });
  }
  /** An offer off this port's board taken on - a delivery into `boat`'s hold. Answers `{ ok, text }`. */
  function take(id, boat = null) {
    const o = board().find((x) => x.id === id);
    if (!o) return { ok: false, text: 'That contract is no longer on the board.' };
    if (L.contracts().length >= CONTRACTS_MAX) return { ok: false, text: `You hold ${CONTRACTS_MAX} contracts already.` };
    if (o.kind === 'delivery' && boat?.uid == null) return { ok: false, text: 'A cargo needs a ship of your own to carry it.' };
    const c = takeContract(o, { now: now(), boat: o.kind === 'delivery' ? boat.uid : null });
    if (!L.holdContract(c)) return { ok: false, text: 'The harbormaster will not give it to you.' };
    return { ok: true, text: o.kind === 'delivery' ? `The cargo is stowed in your hold. ${days(o.days)} to ${o.to.name}.` : `Taken: ${o.title}. ${days(o.days)}.` };
  }
  /** A held contract given up. */
  function abandon(id) {
    const c = L.abandonContract(id);
    return c ? { ok: true, text: `You give up ${c.title}. ${c.crown} thinks the less of you (${STANDING_ABANDONED}).` } : { ok: false, text: '' };
  }
  /** The letter of marque bought of this port's crown. */
  function buyMarque() {
    const port = portHere();
    if (!port?.crown) return { ok: false, text: '' };
    const o = marqueOffer({ crown: port.crown, perks: perksAt(port.crown), gold: deps.gold?.() ?? 0, held: L.marque(now()) });
    if (!o.can) return { ok: false, text: o.why };
    deps.pay?.(o.price);
    L.setMarque(port.crown, now() + o.days * MINUTES_PER_DAY);
    return { ok: true, text: `${port.crown}'s letter of marque is yours for ${days(o.days)}. ${port.crown} counts its rivals' ships as fair prizes, but their own crowns still call it piracy.` };   // AUDIT CAPTAIN'S SEA L14
  }
  /** The Admiralty's carrack bought of this port's crown - her title to the Fleet's book. */
  function buyCarrack() {
    const port = portHere();
    if (!port?.crown) return { ok: false, text: '' };
    const o = admiraltyOffer({ crown: port.crown, perks: perksAt(port.crown), gold: deps.gold?.() ?? 0 });
    if (!o.can) return { ok: false, text: o.why };
    if (!deps.carrack?.(o.price, port)) return { ok: false, text: 'The Admiralty\'s yard has no carrack to give today.' };
    deps.pay?.(o.price);
    return { ok: true, text: `The Admiralty's carrack is yours. It is waiting at ${port.name}. See Holdings > Fleet.` };
  }

  /**
   * THE HARBOURMASTER'S TAB (ui/naval/navalYardWindow.js): the port, the captain's rank with its crown, today's board, the
   * contracts held, and the letters - each press its `{ ok, text }`.
   * @param {any} boat - the boat at the helm, lying to the quay (a delivery's hold)
   */
  function model(boat = null) {
    const port = portHere();
    if (!port?.crown) return null;
    const rank = L.rank(port.crown), perks = perksAt(port.crown), t = now();
    const held = L.contracts();
    const full = held.length >= CONTRACTS_MAX;
    const hunted = (deps.notorietyOf?.(port.crown) ?? 0) >= PERKS_REFUSED_AT;   // its navy hunts the captain: no favours
    const mq = marqueOffer({ crown: port.crown, perks, gold: deps.gold?.() ?? 0, held: L.marque(t) });
    const ad = admiraltyOffer({ crown: port.crown, perks, gold: deps.gold?.() ?? 0 });
    return {
      port: port.name, crown: port.crown, rank: rank.title, standing: L.standing(port.crown), hunted,
      board: board(port).map((o) => ({
        id: o.id, kind: o.kind, title: o.title, words: o.words, pay: gold(o.pay), term: days(o.days), standing: `+${o.standing} with ${o.crown}`,
        can: !full && (o.kind !== 'delivery' || boat?.uid != null), why: full ? `You hold ${CONTRACTS_MAX} contracts already.` : o.kind === 'delivery' && boat?.uid == null ? 'A cargo needs a ship of your own.' : '',
      })),
      held: held.map((c) => ({ id: c.id, ...contractLine(c, t) })),
      marque: { price: gold(mq.price), days: days(mq.days), can: mq.can, why: mq.why, held: L.marque(t) },
      admiralty: { price: gold(ad.price), can: ad.can, why: ad.why, open: !!perks.admiralty },
      take: (id) => take(id, boat), abandon, buyMarque, buyCarrack,
    };
  }

  // ── CAPT-TRADE: the exchange ──
  const units = (r, n) => `${n} ${n === 1 ? r.unit : r.units} of ${r.name}`;
  /** A press's count: `n` whole (Infinity: all there is), at least one. */
  const asked = (n) => Math.max(1, Number.isFinite(n) ? Math.floor(n) : Number.MAX_SAFE_INTEGER);
  /** AUDIT CAPTAIN'S SEA B11: how many of a good (`kg` each) her room takes before she would lie dead in the water (Come
   *  Sail Away's cargo rule - `room` her `{ load, stops }`), or Infinity where her room is not known. */
  const roomFor = (room, kg) => (room && Number.isFinite(room.stops) && Number.isFinite(room.load) ? Math.max(0, Math.floor((room.stops - room.load - 1e-6) / Math.max(1e-6, kg))) : Infinity);
  /** `n` of a good bought into `hold` - as many as the exchange sells today, the purse pays for and her room takes. */
  function buyGood(port, day, hold, id, n, room = null) {
    if (!hold) return { ok: false, text: 'Goods go in a ship\'s hold. Trade at the exchange from the helm.' };
    const r = exchangeOf(port, day, L.dealtAt(port.key, day), L.stats?.().trade, townAt(port)).find((x) => x.id === id);
    if (!r || r.sells <= 0) return { ok: false, text: r?.exotic ? `${r.name} is not sold here.` : `The exchange sells no more ${goodById(id)?.name ?? 'of that'} today.` };
    const fit = roomFor(room?.(), r.kg);
    if (fit <= 0) return { ok: false, text: 'The ship can\'t carry any more.' };
    const k = Math.min(asked(n), r.sells, Math.floor((deps.gold?.() ?? 0) / r.sell), fit);
    if (k <= 0) return { ok: false, text: `Not enough gold - ${gold(r.sell)} a ${r.unit}.` };
    deps.pay?.(k * r.sell);
    const goods = mintGood(id, k);
    markCounterBought([goods], { price: k * r.sell });   // SEA-TRADE: online, what it cost rides it (before a stack's merge takes it)
    deps.stow?.(hold, goods);
    L.deal(port.key, day, id, k, 'bought');
    deps.town?.seaDeal?.(port);   // SEA-TRADE: a dealing at the port's exchange
    return { ok: true, text: `Bought ${units(r, k)} for ${gold(k * r.sell)}.` };
  }
  /** `n` of a good sold out of `hold` - as many as she carries and the exchange buys today. */
  function sellGood(port, day, hold, id, n) {
    if (!hold) return { ok: false, text: 'Goods are sold from a ship\'s hold. Trade at the exchange from the helm.' };
    const r = exchangeOf(port, day, L.dealtAt(port.key, day), L.stats?.().trade, townAt(port)).find((x) => x.id === id);
    const have = goodIn(hold, id);
    if (!r || have <= 0) return { ok: false, text: `You carry no ${goodById(id)?.name ?? 'such goods'}.` };
    if (r.buys <= 0) return { ok: false, text: `The exchange will take no more ${r.name} today.` };
    const k = takeGood(hold, id, Math.min(asked(n), have, r.buys));
    deps.credit?.(k * r.buy);
    L.deal(port.key, day, id, k, 'sold');
    L.note('traded', k * r.buy);
    deps.town?.seaDeal?.(port);   // SEA-TRADE: a dealing at the port's exchange
    return { ok: true, text: `Sold ${units(r, k)} for ${gold(k * r.buy)}.` };
  }
  // ── CREW-TRADE: crew at the exchange ──
  /** Crew's row at `port` today, at the captain's dealing, stars and yard discount (the shipwright's own, perksHere). */
  const crewRow = (port, day) => crewRowOf(port, day, { dealt: L.dealtAt(port.key, day), edge: L.stats?.().trade, town: townAt(port), discount: perksHere().yard });
  /** Why the exchange cannot deal in her crew at all, or null: no crew to her (a Rowboat, a Large Boat), a booked
   *  passage's boat (AUDIT CREW-TRADE E1), a fight. */
  const crewRefused = (s) => (!s?.crewed ? CREW_TRADE_TEXT.noCrew : s.charter ? CREW_TRADE_TEXT.charter : s.fighting ? CREW_TRADE_TEXT.fighting : null);
  /** `n` men signed on to the ship at the quay - as many as the exchange signs on today, the purse pays for and her whole
   *  takes. `deal` the window's model's (scenes/naval/crewDeal.js). */
  function buyCrew(port, day, deal, n) {
    const s = deal?.stands?.() ?? null;
    const no = crewRefused(s);
    if (no) return { ok: false, text: no };
    const r = crewRow(port, day);
    if (r.sells <= 0) return { ok: false, text: CREW_TRADE_TEXT.noneToday };
    if (s.room <= 0) return { ok: false, text: CREW_TRADE_TEXT.full };
    const k = Math.min(asked(n), r.sells, Math.floor((deps.gold?.() ?? 0) / r.sell));
    if (k <= 0) return { ok: false, text: CREW_TRADE_TEXT.short(r.sell) };
    const on = deal.signOn(k), got = on.n;   // her whole the most she takes
    deps.pay?.(got * r.sell);
    L.deal(port.key, day, CREW.id, got, 'bought');
    deps.town?.seaDeal?.(port);   // SEA-TRADE: a dealing at the port's exchange
    return { ok: true, text: [CREW_TRADE_TEXT.bought(got, got * r.sell), on.joined.length ? CREW_TRADE_TEXT.signedOn(handsNamed(on.joined)) : ''].filter(Boolean).join(' ') };   // AUDIT CREW-TRADE H3: who joined her
  }
  /** `n` men signed off the ship at the quay - as many as may leave her (crewTrade.js crewSpare) and the exchange takes
   *  today. */
  function sellCrew(port, day, deal, n) {
    const s = deal?.stands?.() ?? null;
    const no = crewRefused(s);
    if (no) return { ok: false, text: no };
    if (s.spare <= 0) return { ok: false, text: s.why };
    const r = crewRow(port, day);
    if (r.buys <= 0) return { ok: false, text: CREW_TRADE_TEXT.noneWanted };
    const off = deal.signOff(Math.min(asked(n), r.buys)), gone = off.n;   // as many as may leave her the most who go
    deps.credit?.(gone * r.buy);
    L.deal(port.key, day, CREW.id, gone, 'sold');
    L.note('traded', gone * r.buy);
    deps.town?.seaDeal?.(port);   // SEA-TRADE: a dealing at the port's exchange
    return { ok: true, text: [CREW_TRADE_TEXT.sold(gone, gone * r.buy), off.left.length ? CREW_TRADE_TEXT.paidOff(handsNamed(off.left)) : ''].filter(Boolean).join(' ') };   // AUDIT CREW-TRADE H1: who left her
  }
  /**
   * THE EXCHANGE'S TAB (ui/naval/navalYardWindow.js): the port's goods at today's prices, what the boat at the quay carries
   * of each, her goods' weight and her room (AUDIT CAPTAIN'S SEA B11: the kg more she carries before she lies dead in the
   * water - she was sold to a standstill unsaid) - and the presses. The other sea's goods only where the captain may
   * sail for them (`deps.etherGoods`) or carries some (AUDIT CAPTAIN'S SEA B16). CREW-TRADE: `boat` the shipwright's
   * window's model itself (navalHost.js yardModel - her hold `cargo()` asked as the tab draws), or a hold as it stands;
   * a crewed ship's model's `crewDeal` lists crew first - `have` her crew aboard, `whole` her whole, `room` the men more she
   * takes, `spare` the men who may leave her.
   * @param {{ uid?: any, cargo?: any[] | (() => any[] | null) | null, room?: () => ({ load: number, slows: number, stops: number } | null), crewDeal?: any } | null} boat
   */
  function exchange(boat = null) {
    const port = portHere();
    if (!port) return null;
    const day = deps.day?.() ?? 0, hold = (typeof boat?.cargo === 'function' ? boat.cargo() : boat?.cargo) ?? null, room = typeof boat?.room === 'function' ? boat.room : null;
    const others = deps.etherGoods?.() !== false;
    const deal = boat?.crewDeal ?? null, hands = deal?.stands?.() ?? null;
    const rows = exchangeOf(port, day, L.dealtAt(port.key, day), L.stats?.().trade, townAt(port)).map((r) => ({ ...r, have: goodIn(hold, r.id) })).filter((r) => others || !r.exotic || r.have > 0);
    if (hands?.crewed && !hands.charter) rows.unshift({ ...crewRow(port, day), name: CREW_TRADE_TEXT.title, have: hands.crew, whole: hands.maxCrew, room: hands.room, spare: hands.spare, why: hands.why });   // AUDIT CREW-TRADE E1: never a booked passage's; O1: why none may leave her
    const rm = room?.();
    return {
      port: port.name, ether: !!port.ether, gold: deps.gold?.() ?? 0, weight: hold ? goodsWeight(hold) : null, rows,
      band: deps.town?.bandAt?.(port) ?? null,   // SEA-TRADE: the port town's economy, said in the tab's lede
      room: rm && Number.isFinite(rm.stops) && Number.isFinite(rm.load) ? Math.max(0, Math.floor(rm.stops - rm.load)) : null,
      buy: (id, n) => (id === CREW.id ? buyCrew(port, day, deal, n) : buyGood(port, day, hold, id, n, room)),
      sell: (id, n) => (id === CREW.id ? sellCrew(port, day, deal, n) : sellGood(port, day, hold, id, n)),   // CREW-TRADE
    };
  }

  // ── CAPT-CHARTS ──
  /** A chart among the papers of a pirate the captain ended (sunk or taken), or null. */
  function chartFor(cls, seed, deep = false) {
    const c = chartAboard(cls, seed, { deep });
    return c == null ? null : mintChart(c);
  }
  /** A chart read: its cache marked on the captain's charts. Answers `{ ok, text }` - ok, and the chart is spent. */
  function readChart(item) {
    const site = chartSite(item?.message ?? 0, deps.ports?.() ?? [], deps.seaAt ?? (() => false));
    if (!site) return { ok: false, text: 'The chart\'s ink has run. You know no coast on it.' };
    if (L.charts().some((c) => c.id === site.id)) return { ok: true, text: `You have marked this cache already: ${site.words}.` };
    if (L.wasRaised?.(site.id)) return { ok: true, text: `This cache was raised long ago. The chart is worth no more than its parchment.` };   // AUDIT CAPTAIN'S SEA B8: the same chart, read again, paid again
    if (!L.markChart(site)) return { ok: false, text: 'Your charts are full of marks. Raise a cache first.' };
    return { ok: true, text: `You mark the chart's cache on your own charts: ${site.words}. Sail there and your lookout will find it.` };
  }
  /** A cache raised (its site's id): off the charts, its gold paid. Answers the gold, or 0 for none. */
  function raiseCache(id) {
    const c = L.raiseChart(id);
    if (!c) return 0;
    const g = cacheGold(c.seed, deps.level?.() ?? 1);
    deps.credit?.(g);
    return g;
  }

  return {
    event, tick, board, take, abandon, buyMarque, buyCarrack, model, exchange, chartFor, readChart, raiseCache,
    /** The held contracts' waters and the marked charts' caches, for the naval host (harbourBoard.js contractSites). */
    sites: () => [...contractSites(L.contracts()), ...L.charts().map((c) => ({ id: c.id, kind: 'cache', px: c.px, py: c.py, seed: c.seed, n: 1 }))],
    /** The Captain page's charts. */
    pageCharts: () => L.charts().map((c) => ({ title: `A cache ${c.words}`, line: c.id.startsWith(CHART_SITE) ? 'Marked from a pirate\'s chart' : '' })),
    /** A bounty's words on the glass's card: her purse and the port that posted her. */
    bountyWords: (id) => { const c = L.contracts().find((x) => x.id === id); return c ? `${gold(c.pay)} - posted at ${c.port?.name ?? c.crown}` : null; },
    perksHere,
    /** A crown's favours (the relief's). */
    perksAt,
    /** The Captain page's contracts. */
    pageContracts: () => L.contracts().map((c) => { const l = contractLine(c, now()); return { title: c.title, state: l.left, done: false, line: [l.progress, l.pay].filter(Boolean).join(' - ') }; }),
  };
}
