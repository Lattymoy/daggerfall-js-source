// @ts-check
// ETHER-SHIPS (2026-10-11, the owner: "The etheric sea is a infinite procedural oceanscape with procedural islands with
// towns, dungeons, exotic resources, deadly legendary ships"; bible/03-World/Eltheric-Ocean.md ETHER-SHIPS, ETHER-LEGENDS) -
// THE ELTHERIC OCEAN'S SHIPS. Pure: the naval host and its director read them (scenes/naval/navalHost.js, navalDirector.js).
//
// ITS TRAFFIC: corsairs and the isles' traders - the Bay's own classes under the Eltheric Ocean's names (`etherShipNames`,
// her captain the Bay's own law's) and the Isles' colours on a trader, the black flag on a corsair; no crown's navy sails
// past the Veil. The deeper the band, the likelier a corsair (world/ethericSea.js BANDS `pirate`) and the bigger every
// class (`level`); a port's waters keep the traders' peace (ETHER_PORT_WEIGHTS).
//
// ITS LEGENDS: six named ships, each her own class (navalShips.js ETHER-LEGENDS - never drawn by level), her own band and
// HAUNT (`hauntOf`: a reach of HAUNT_PX pixels about a centre in her band's depths, off her own hash - the same sea on
// every client), her own terror (`trait`: the swiftest hull afloat; a hull the aether mends; a galley packed with
// boarders; a ship of the night that shows no light; gunners who do not miss; sails the glass cannot hold), and her own
// purse. Sailing her haunt, a captain may meet her (LEGEND_CHANCE of a roll there, one legend at sea at a time); ended,
// she is gone LEGEND_RISE_DAYS - then the aether raises her again. The harbourmasters of the isles say where each was
// last seen (`rumourOf`).

import { mulberry32 } from '../../combat/blood/bloodArt.js';
import { classById, shipNames } from './navalShips.js';
import { BANDS, LEAGUE_PX, VEIL_X, veilhaven, etherHash, etherRng, inEther, compassPoint } from '../../world/ethericSea.js';

/** A trader of the isles flies their colours (the spyglass reads "the Isles' merchant colours"). */
export const ISLES_FLAG = 'the Isles';
/** The Eltheric Ocean's ship names - its corsairs' and its traders', ours: two words a name, a first and a last of each
 *  trade's own (AUDIT CAPTAIN'S SEA D20 - sixteen names a trade moored two ships of one harbour under the same name;
 *  these are 256 a trade, drawn as the sixteen were). */
const PIRATE_FIRSTS = ['Gloam', 'Void', 'Starving', 'Pale', 'Ashen', 'Hollow', 'Black', 'Sable', 'Crooked', 'Mourning', 'Weeping', 'Amber', 'Drowned', 'Grim', 'Red', 'Last'];
const PIRATE_LASTS = ['Reaver', 'Cutter', 'Tide', 'Lantern', 'Gull', 'Wind', 'Fang', 'Blade', 'Aurora', 'Wraith', 'Psalm', 'Comet', 'Star', 'Tern', 'Mercy', 'Shard'];
const MERCHANT_FIRSTS = ['Amber', 'Starglass', 'Patient', 'Silver', 'Quiet', 'Dawn', 'Voidsilk', 'Faithful', 'Morning', 'Gentle', 'Far', 'Willow', 'Golden', 'Lucky', 'Bright', 'Steady'];
const MERCHANT_LASTS = ['Wind', 'Maiden', 'Tide', 'Wanderer', 'Swan', 'Fortune', 'Trader', 'Rose', 'Shoal', 'Glass', 'Aether', 'Harbour', 'Lantern', 'Heron', 'Promise', 'Gull'];
const twoWords = (firsts, lasts) => Object.freeze(firsts.flatMap((a) => lasts.map((b) => `${a} ${b}`)));
export const ETHER_PIRATE_NAMES = twoWords(PIRATE_FIRSTS, PIRATE_LASTS);
export const ETHER_MERCHANT_NAMES = twoWords(MERCHANT_FIRSTS, MERCHANT_LASTS);
/** The names' own stream's salt (her captain's and every other draw stay the ones they were). */
export const ETHER_NAME_SALT = 0xe7a3e;
/**
 * A ship of the Eltheric Ocean's names: `{ name, captain, crown: null }` - her name the Eltheric Ocean's by her trade, her
 * captain the Bay's own law's (shipNames, the Breton bank), no crown. A legend's are her own.
 * @param {any} cls @param {number} seed
 */
export function etherShipNames(cls, seed) {
  const legend = legendOfClass(cls?.id);
  if (legend) return { name: legend.name, captain: legend.captain, crown: null };
  const captain = shipNames(cls, seed, { regionIndex: 17 }).captain;
  const list = cls?.faction === 'merchant' ? ETHER_MERCHANT_NAMES : ETHER_PIRATE_NAMES;
  const r = mulberry32(((seed >>> 0) ^ ETHER_NAME_SALT) >>> 0);
  return { name: list[Math.floor(r() * list.length) % list.length], captain, crown: null };
}
/** Her colours: a trader the Isles', a corsair and a legend none (the black flag). */
export const etherFlagOf = (cls) => (cls?.faction === 'merchant' ? ISLES_FLAG : null);

/** THE TRAFFIC'S WEIGHTS: corsairs and traders - the band's `pirate` on the corsairs; a port's waters the traders'. */
export const ETHER_FACTION_WEIGHTS = Object.freeze({ pirate: 30, merchant: 45 });
export const ETHER_PORT_WEIGHTS = Object.freeze({ merchant: 30, pirateK: 0.5 });
/** The factions' weights in a band's waters (`band` a BANDS row; `nearPort` within a port isle's reach). */
export function etherFactionWeights(band, { nearPort = false } = {}) {
  const w = { pirate: ETHER_FACTION_WEIGHTS.pirate * (band?.pirate ?? 1), merchant: ETHER_FACTION_WEIGHTS.merchant };
  if (nearPort) { w.merchant += ETHER_PORT_WEIGHTS.merchant; w.pirate *= ETHER_PORT_WEIGHTS.pirateK; }
  return w;
}

// ── the legends ──────────────────────────────────────────────────────────────────────────────────────────────────────
/** @typedef {{ id: string, name: string, captain: string, classId: string, band: string, trait: string, purse: number, lore: string }} Legend */
/** THE LEGENDS: two to a band past the Shallows, the deeper the deadlier and the richer. @type {readonly Legend[]} */
export const LEGENDS = Object.freeze([
  Object.freeze({ id: 'wake', name: "Sorrow's Wake", captain: 'Ysolde the Unmourned', classId: 'legendWake', band: 'reaches', trait: 'swift', purse: 2500, lore: 'The fastest hull afloat. It runs down whatever it hunts and runs from nothing.' }),
  Object.freeze({ id: 'queen', name: 'The Drowned Queen', captain: 'Maraveth, Thrice Drowned', classId: 'legendQueen', band: 'reaches', trait: 'mends', purse: 3000, lore: 'Sunk and raised by the aether three times. Its timbers repair themselves between broadsides.' }),
  Object.freeze({ id: 'hunger', name: 'Ninefold Hunger', captain: 'Ghorvak Ninefold', classId: 'legendHunger', band: 'deep', trait: 'boarders', purse: 5000, lore: 'A galley packed rail to rail with hands who board, and board again.' }),
  Object.freeze({ id: 'lantern', name: 'The Lantern-Eater', captain: 'the Hooded Pilot', classId: 'legendLantern', band: 'deep', trait: 'night', purse: 5500, lore: 'It sails only at night, shows no light, and hunts ships that do.' }),
  Object.freeze({ id: 'regent', name: 'The Pale Regent', captain: 'Lord Aumbrel the Pale', classId: 'legendRegent', band: 'abyss', trait: 'gunnery', purse: 9000, lore: 'Its gunners have not missed in a hundred years.' }),
  Object.freeze({ id: 'starless', name: 'The Starless', captain: 'no one living', classId: 'legendStarless', band: 'abyss', trait: 'veiled', purse: 12000, lore: 'Black sails under a black sky. Even a spyglass can\'t find it until it is right on top of you.' }),
]);
/** The traits' numbers: a `mends` legend's hull knits this share of its whole a second while no ball has struck her for
 *  LEGEND_MEND_QUIET_S; a `gunnery` legend's guns load this much quicker; a `veiled` one is made out at this share of
 *  every reach (the naked eye, the lookout, the glass); a `night` one sails between dusk and dawn alone. */
export const LEGEND_MEND_PER_S = 0.004;
export const LEGEND_MEND_QUIET_S = 8;
export const LEGEND_RELOAD_K = 0.7;
export const LEGEND_VEIL_K = 0.35;
/** A legend ended is gone this many days; then the aether raises her again. */
export const LEGEND_RISE_DAYS = 30;
/** A roll of the sea's traffic in a legend's haunt launches her on this share (the draw on her own stream). */
export const LEGEND_CHANCE = 0.3;
export const LEGEND_SALT = 0x1e6e;
/** A haunt's reach about its centre (pixels, Chebyshev), and how far north or south of Veilhaven's row a band's haunts
 *  may lie; a band's depths a haunt stands in - from its `from` to the next band's (the Abyss's ABYSS_HAUNT_LEAGUES more). */
export const HAUNT_PX = 36;
export const HAUNT_SPREAD = Object.freeze({ reaches: 60, deep: 160, abyss: 320 });
export const ABYSS_HAUNT_LEAGUES = 120;

export const legendById = (id) => LEGENDS.find((l) => l.id === id) ?? null;
export const legendOfClass = (classId) => LEGENDS.find((l) => l.classId === classId) ?? null;
/** Every legend's class is one of navalShips.js's, flagged `legend`. */
export const legendClass = (legend) => classById(legend?.classId);

/** @type {Map<string, { px: number, py: number }>} */
const _haunts = new Map();
/**
 * A LEGEND'S HAUNT: its centre `{ px, py }` - in her band's depths (leagues west of the Veil, between the band's `from`
 * and the next band's), within HAUNT_SPREAD of Veilhaven's row - off her own hash. The same on every client.
 * @param {Legend} legend
 */
export function hauntOf(legend) {
  const hit = _haunts.get(legend.id);
  if (hit) return hit;
  const i = BANDS.findIndex((b) => b.id === legend.band);
  const band = BANDS[Math.max(0, i)];
  const next = BANDS[i + 1];
  const from = band.from + HAUNT_PX / LEAGUE_PX, to = (next ? next.from : band.from + ABYSS_HAUNT_LEAGUES) - HAUNT_PX / LEAGUE_PX;
  const r = etherRng(etherHash(LEGEND_SALT, LEGENDS.indexOf(legend), 3));
  const leagues = from + (Math.max(from, to) - from) * r();
  const spread = HAUNT_SPREAD[legend.band] ?? HAUNT_SPREAD.reaches;
  const at = { px: Math.round(VEIL_X - leagues * LEAGUE_PX), py: Math.round(veilhaven().py + (r() * 2 - 1) * spread) };
  _haunts.set(legend.id, at);
  return at;
}
/** Does a legend sail (her end `endedDay`, the day she was ended, or null) on `day`? */
export const legendSails = (endedDay, day) => !Number.isFinite(endedDay) || (day | 0) - (endedDay | 0) >= LEGEND_RISE_DAYS;
/** The legend whose haunt holds a pixel, or null - the nearest haunt's, where two reach it. */
export function legendAt(px, py) {
  if (!inEther(px, py)) return null;
  let best = null, bd = Infinity;
  for (const l of LEGENDS) {
    const h = hauntOf(l);
    const d = Math.max(Math.abs(h.px - px), Math.abs(h.py - py));
    if (d <= HAUNT_PX && d < bd) { bd = d; best = l; }
  }
  return best;
}
/** Is a legend abroad in this hour - a `night` one between dusk and dawn alone? */
export const legendAbroad = (legend, { night = false } = {}) => legend?.trait !== 'night' || !!night;

/**
 * A HARBOURMASTER'S RUMOUR of a legend from a port's pixel: "The Drowned Queen has been seen some 40 leagues
 * west-south-west of here" - or, ended and not yet risen, "...went down N days ago; they say the aether will raise her".
 * @param {Legend} legend @param {{ px: number, py: number }} from @param {{ endedDay?: number|null, day?: number }} [o]
 */
export function rumourOf(legend, from, { endedDay = null, day = 0 } = {}) {
  if (!legendSails(endedDay, day)) {
    const ago = Math.max(0, (day | 0) - (endedDay | 0));
    return `${legend.name} went down ${ago === 0 ? 'today' : ago === 1 ? 'yesterday' : `${ago} days ago`}; they say the aether will raise it again.`;
  }
  const h = hauntOf(legend);
  const dx = h.px - from.px, dy = h.py - from.py;
  const far = Math.hypot(dx, dy) / LEAGUE_PX;
  const night = legend.trait === 'night' ? ' By night.' : '';
  // AUDIT CAPTAIN'S SEA G12/D21: a haunt under half a league off is "hereabouts" (a freeport on her haunt was told "some
  // 1 leagues south" of it), and one league is a league
  if (far < 0.5) return `${legend.name} has been seen hereabouts.${night}`;
  const leagues = Math.max(1, Math.round(far));
  return `${legend.name} has been seen some ${leagues} ${leagues === 1 ? 'league' : 'leagues'} ${compassPoint(dx, dy)} of here.${night}`;
}
