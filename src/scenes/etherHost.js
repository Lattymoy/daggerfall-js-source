// @ts-check
// ETHER-SEA (2026-10-11, the owner: "The etheric sea is a infinite procedural oceanscape with procedural islands with
// towns, dungeons, exotic resources, deadly legendary ships, and whatever more you can add to give meaning to the etheric
// sea"; bible/03-World/Eltheric-Ocean.md) - THE ELTHERIC OCEAN'S HOST: what a captain finds past the Veil and what it is worth,
// stood over the captain's ledger (systems/naval/captainLedger.js, its `ether` record) for the world host and the naval
// host. Pure in its deps: the law is world/ethericSea.js's and systems/naval/etherShips.js's.
//
//   THE WATERS (`waters`): the band, the depth in leagues, the legend whose haunt they are - the naval host's `where`
//   reads them (its traffic, its plate), and the deepest a captain has gone is the log's.
//   CHARTING (`sight`): an isle comes onto the captain's charts when the ship comes within SIGHT_PX of it - the first
//   time said, the log's `islands` counted; a port's harbourmaster sells a chart of its waters (`buyChart`: every isle
//   within CHART_BUY_PX), and a corsair's papers sometimes hold one of hers (`papers`).
//   THE STRANDS (`sites`, `gather`): a wild isle's good - ether-amber, starglass, voidsilk - lies on its strand; a ship
//   that comes within HARVEST_REACH_PX of it sends a boat in, and the naval host floats HARVEST_CASKS casks of it out
//   beside her (a site, as a contract's wreck's), each STRAND_YIELD of the good by the band; gathered, the strand is bare
//   HARVEST_DAYS.
//   THE LEGENDS (`legendHere`, `legendEnded`, `rumours`): the legend whose haunt the captain sails, if she sails now (not
//   ended these LEGEND_RISE_DAYS, and abroad at this hour); her end paid her purse and remembered; a harbourmaster's
//   rumours of each.
//
// deps = {
//   ledger                 the captain's ledger
//   day() -> number        the world's day
//   credit(n)              the purse
//   say(text, s) / mid(text, s)
//   gold() / pay(n)        the purse, for a chart of the waters
// }

import { islesNear, isleByKey, etherDepthAt, etherBandOf, BANDS, LEAGUE_PX, KIND_WORDS, inEther, inVeil, ETHER_SEA_NAME, ETHER_SEA_TITLE } from '../world/ethericSea.js';
import { ETHER_CHARTED_MAX } from '../systems/naval/captainLedger.js';   // AUDIT CAPTAIN'S SEA X5: the charts' room
import { LEGENDS, legendAt, legendSails, legendAbroad, legendById, rumourOf } from '../systems/naval/etherShips.js';
import { mintGood, goodById } from '../systems/naval/tradeGoods.js';
import { mulberry32 } from '../combat/blood/bloodArt.js';

/** An isle comes onto the captain's charts within this many map pixels of the ship (Chebyshev) - its shore half a league
 *  to two leagues off. */
export const SIGHT_PX = 3;
/** A wild isle's strand is worked from within this many map pixels of its centre; its casks; the good a cask holds by
 *  the band (Shallows, Reaches, Deep Aether, Abyss); a strand gathered is bare this many days. */
export const HARVEST_REACH_PX = 1;
export const HARVEST_CASKS = 3;
export const STRAND_YIELD = Object.freeze([2, 3, 4, 6]);
export const HARVEST_DAYS = 7;
/** A strand's site id: `strand:<isle key>` (the naval host's cask lot `site:strand:...`). */
export const STRAND_SITE = 'strand:';
/** A chart of a port's waters: every isle within this many pixels of it, at this price and this more a band deeper. */
export const CHART_BUY_PX = 40;
export const CHART_BUY_PRICE = Object.freeze({ base: 150, band: 75 });
/** A corsair's papers hold a chart of her waters on this share (her seed's own stream): every isle within this. */
export const PAPERS_CHANCE = 0.25;
export const PAPERS_PX = 30;
export const PAPERS_SALT = 0x9a9e;

const gold = (n) => `${Math.round(n).toLocaleString('en-US')} gold`;
const bandIndex = (id) => Math.max(0, BANDS.findIndex((b) => b.id === id));

/** @param {any} deps */
export function createEtherHost(deps) {
  const L = deps.ledger;
  const day = () => Math.floor(Number(deps.day?.()) || 0);

  /** THE WATERS at a map pixel: `{ band, bandName, depth (leagues), veil }` - `veil` the Veil itself (no league past it
   *  yet) - or null off the sea. AUDIT CAPTAIN'S SEA D18: the haunt's legend was reckoned every frame and read nowhere -
   *  the naval host asks `legendHere`. */
  function waters(px, py) {
    if (!inEther(px, py)) return null;
    const depth = etherDepthAt(px);
    const band = etherBandOf(depth);
    return { band: band.id, bandName: band.name, depth, veil: inVeil(px, py) };
  }

  /** CHARTING: every isle within SIGHT_PX of the ship charted - the first time said (a port and a ruin by name and
   *  kind) - and the deepest the captain has gone kept. Answers the isles newly charted. */
  function sight(px, py) {
    if (!inEther(px, py)) return [];
    L.deepest?.(etherDepthAt(px));
    const fresh = islesNear(px, py, SIGHT_PX).filter((i) => L.chartIsle(i.key));
    for (const i of fresh) deps.say?.(`Land ho! ${i.name.replace(/^./, (c) => c.toUpperCase())}${i.kind === 'port' || i.kind === 'ruin' ? ` - ${KIND_WORDS[i.kind]}` : ''}. It is on your charts.`, 4);   // AUDIT CAPTAIN'S SEA X17: "the Sepulchre" opening a sentence
    return fresh;
  }

  /** Is a wild isle's strand bare (gathered within HARVEST_DAYS)? */
  const bare = (key) => { const d = L.gatheredDay(key); return d != null && day() - d < HARVEST_DAYS; };
  /** THE STRANDS within reach: the naval host's sites - `{ id, kind: 'strand', px, py, seed, n }` - a wild isle's whose
   *  strand is not bare. */
  function sites(px, py) {
    if (!inEther(px, py)) return [];
    return islesNear(px, py, HARVEST_REACH_PX).filter((i) => i.kind === 'wild' && i.good && !bare(i.key))
      .map((i) => ({ id: `${STRAND_SITE}${i.key}`, kind: 'strand', px: i.px, py: i.py, seed: i.seed, n: HARVEST_CASKS }));
  }
  /** A strand's cask hauled: its good (STRAND_YIELD by the isle's band) minted - the strand bare from today. Answers
   *  `{ items, text }`. */
  function gather(siteId) {
    const key = String(siteId ?? '').startsWith(STRAND_SITE) ? String(siteId).slice(STRAND_SITE.length) : null;
    const isle = key ? isleByKey(key) : null;
    if (!isle?.good) return { items: [], text: '' };
    if (!bare(isle.key)) L.gathered(isle.key, day());   // AUDIT CAPTAIN'S SEA D1: bare from its FIRST cask hauled - a later one never pushes it on
    const n = STRAND_YIELD[bandIndex(isle.band)] ?? STRAND_YIELD[0];
    const g = goodById(isle.good);
    return { items: [mintGood(isle.good, n)], text: `${n} ${n === 1 ? g?.unit : g?.units} of ${g?.name.toLowerCase()} from the strand of ${isle.name}.` };
  }

  /** THE LEGEND who may come to the captain here and now: the haunt's, if she sails (not ended within her
   *  LEGEND_RISE_DAYS) and is abroad at this hour - or null. */
  function legendHere(px, py, { night = false } = {}) {
    const l = inEther(px, py) ? legendAt(px, py) : null;
    if (!l || !legendSails(L.legendDay(l.id), day()) || !legendAbroad(l, { night })) return null;
    return l;
  }
  /** A legend ended (`act` 'sink' or 'board'): her purse paid, her end remembered (the aether raises her LEGEND_RISE_DAYS
   *  on), said. Answers the purse - none for a legend this captain's own ledger has ended and the aether not yet raised
   *  (AUDIT CAPTAIN'S SEA D6: another's copy of her paid her purse again, and pushed her rise back). */
  function legendEnded(id, act) {
    const l = legendById(id);
    if (!l || !legendSails(L.legendDay(l.id), day())) return 0;
    L.endLegend(l.id, day());
    deps.credit?.(l.purse);
    deps.mid?.(`${l.name} is ${act === 'board' ? 'taken' : 'sunk'}! ${ETHER_SEA_TITLE} will speak of this. ${gold(l.purse)} from the captain's hoard.`, 6);
    return l.purse;
  }
  /** A harbourmaster's rumours of the legends from a port's pixel: each one's line. */
  const rumours = (port) => LEGENDS.map((l) => rumourOf(l, port, { endedDay: L.legendDay(l.id), day: day() }));

  /** A chart of a port's waters: its price (the band's), and the isles it would add - AUDIT CAPTAIN'S SEA X5: as many as
   *  the captain's charts have room for (ETHER_CHARTED_MAX); full, none is sold (the gold was taken for nothing). */
  function chartOffer(port) {
    const price = CHART_BUY_PRICE.base + CHART_BUY_PRICE.band * bandIndex(etherBandOf(etherDepthAt(port.px)).id);
    const isles = islesNear(port.px, port.py, CHART_BUY_PX).filter((i) => !L.isCharted(i.key));
    const room = Math.max(0, ETHER_CHARTED_MAX - L.charted().length);
    const fresh = Math.min(isles.length, room);
    const purse = Number(deps.gold?.()) || 0;
    return { price, fresh, can: fresh > 0 && purse >= price, why: !isles.length ? 'Every isle in these waters is already on your charts.' : !room ? 'Your charts can hold no more isles.' : purse < price ? `You need ${gold(price)}.` : '' };
  }
  /** A chart of a port's waters bought: every isle within CHART_BUY_PX charted. */
  function buyChart(port) {
    const o = chartOffer(port);
    if (!o.can) return { ok: false, text: o.why };
    deps.pay?.(o.price);
    const n = islesNear(port.px, port.py, CHART_BUY_PX).filter((i) => L.chartIsle(i.key)).length;
    return { ok: true, text: `The harbormaster unrolls a chart of these waters: ${n} ${n === 1 ? 'isle' : 'isles'} marked on yours.` };
  }
  /** A corsair's papers (her class and seed, where she was ended): on PAPERS_CHANCE of her seed's own stream, a chart of
   *  her waters - every isle within PAPERS_PX charted. Answers how many were new. */
  function papers(cls, seed, px, py) {
    if (cls?.faction !== 'pirate' || !inEther(px, py)) return 0;
    const r = mulberry32(((seed >>> 0) ^ PAPERS_SALT) >>> 0);
    if (!(r() < PAPERS_CHANCE)) return 0;
    const n = islesNear(px, py, PAPERS_PX).filter((i) => L.chartIsle(i.key)).length;
    if (n) deps.say?.(`Among the ship's papers is a chart of these waters: ${n} ${n === 1 ? 'isle' : 'isles'} marked on yours.`, 5);
    return n;
  }

  /** THE ELTHERIC HARBOURMASTER'S TAB (ui/naval/navalYardWindow.js): the port, its waters, the legends' rumours, the chart -
   *  and `hear`, the quay's talk heard (every legend's haunt on the captain's charts) when the tab is shown: AUDIT CAPTAIN'S
   *  SEA X11 - the window reads this model on every render, and the shipwright's tab heard every legend. */
  function office(port) {
    if (!port?.ether) return null;
    const depth = etherDepthAt(port.px);
    return {
      ether: true, port: port.name, waters: `${etherBandOf(depth).name}, ${Math.round(depth)} leagues past the Veil`,
      rumours: rumours(port), charted: L.charted().length, chart: chartOffer(port),
      hear: () => { for (const l of LEGENDS) L.hearLegend?.(l.id); },
    };
  }

  /** THE CHART'S WORD (ui/etherChartWindow.js): the ship's pixel and heading, the isles charted, the legends heard of -
   *  each with her haunt and whether she sails - and the log's Eltheric counts. */
  function chart(px, py, yaw) {
    const log = L.log ?? {};
    return {
      px, py, yaw, charted: L.charted(), day: day(),
      legends: (L.heard?.() ?? []).map((id) => legendById(id)).filter(Boolean).map((l) => ({ id: l.id, name: l.name, trait: l.trait, sails: legendSails(L.legendDay(l.id), day()) })),
      stats: { charted: L.charted().length, deepest: log.deepest ?? 0, crossings: L.crossings ?? 0, legends: (log.legends ?? []).length },
    };
  }

  return { waters, sight, sites, gather, legendHere, legendEnded, rumours, chartOffer, buyChart, papers, office, chart, seaName: ETHER_SEA_NAME, leaguePx: LEAGUE_PX };
}
