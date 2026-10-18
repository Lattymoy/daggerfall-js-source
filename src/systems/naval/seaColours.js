// @ts-check
// SEA-COLOURS (2026-10-17, the owner: "enemies and merchants should have their own unique liveries, flags hosted, etc";
// bible/03-World/Naval-Refit.md SEA-COLOURS) - EVERY SHIP OF THE SEA IN HER OWN COLOURS: her paint (SHIP-LIVERY's law,
// systems/naval/shipLivery.js) and a flag of cloth at her masthead (SHIP-COLOURS' law, systems/naval/shipFlag.js), as the
// player's own ships wear and fly them - where the sea's ships sailed as built under the mod's pennant, tinted by their
// faction alone (navalShips.js NAVAL_FACTIONS `flag`). The port's own: Daggerfall has no sea. Pure.
//
// WHO SHE IS decides it, and nothing else - her class (its faction and hull), her seed, the crown whose colours she flies
// (navalShips.js flagOf: a navy's own, a merchantman's home port's most of the time, the Isles' past the Veil -
// etherShips.js ISLES_FLAG), her legend's, and the crown she passes for under false colours (shipKnowledge.js
// falseFlagOf). Every client that stands her has all of it (the naval word says her class and seed; the colours are
// drawn off them as her names are), so every player sees the same ship and nothing new rides the wire.
//
//   A NAVY'S SHIP wears her crown's livery and flies its royal ensign: Daggerfall's azure and its dagger, Wayrest's
//          crimson and its rose, Sentinel's gold and its sun (the crowns' own metals - net/townSeatLaw.js
//          KINGDOM_BANNER_COLOURS - and the charges the Iliac Bay's crowns are told by, the card table's suits'), under
//          white canvas.
//   A MERCHANTMAN is one of MERCHANT_HOUSES' - drawn off her seed - in its house paint, flying her crown's merchant
//          colours: the crown's field parted with the house's colour, the house's device on it, a swallowtail.
//   A PIRATE is one of PIRATE_CREWS' in its crew's dark paint under its black flag; one that sails under false colours
//          (a wary captain's, shipKnowledge.js falseFlagOf) is painted as the merchant house she passes for - her hull
//          gives her away no sooner than her flag - and flies that house's colours until the black flag goes up.
//   A LEGEND wears and flies her own (LEGEND_COLOURS), whatever her class's faction.
//
// Her flag comes down with her colours: none struck, sinking or gone down (`seaFlagOf`'s `colours`, the host's - navalHost.js
// poseShip `e.colours`); a prize flies the captor's pennant as before.
import { SHIP_PAINTS, liveryOf } from './shipLivery.js';
import { fitFlag } from './shipFlag.js';

const P = (id) => SHIP_PAINTS.findIndex((p) => p?.id === id);
/** A livery written by its paints' names (0, as built, for a part left out). */
const paints = (strake, accent, sail, stain = strake) => Object.freeze({ strake: P(strake), accent: P(accent), sail: sail ? P(sail) : 0, stain: P(stain) });

/** The crowns' colours by the name her flag says (navalShips.js CROWNS' `name`; etherShips.js ISLES_FLAG's 'the Isles'):
 *  the field, the border and the device of the royal ensign, and the crown's paint for her strake and trim. */
export const CROWN_COLOURS = Object.freeze({
  Daggerfall: Object.freeze({ field: 'azure', border: 'gold', device: 'dagger', charge: 'gold', livery: paints('navy', 'gold', 'white') }),
  Wayrest: Object.freeze({ field: 'crimson', border: 'gold', device: 'rose', charge: 'gold', livery: paints('crimson', 'gold', 'white') }),
  Sentinel: Object.freeze({ field: 'gold', border: 'crimson', device: 'sun', charge: 'crimson', livery: paints('ochre', 'black', 'white') }),
  'the Isles': Object.freeze({ field: 'teal', border: 'argent', device: 'star', charge: 'argent', livery: paints('teal', 'white', 'white') }),
});
/** THE MERCHANT HOUSES: each its house paint, the colour its flag parts the crown's field with, and its device. */
export const MERCHANT_HOUSES = Object.freeze([
  Object.freeze({ id: 'tanners', livery: paints('tan', 'white', 'tan'), colour: 'umber', division: 'fess', device: 'scales' }),
  Object.freeze({ id: 'greens', livery: paints('sea', 'gold', null), colour: 'vert', division: 'pale', device: 'ship' }),
  Object.freeze({ id: 'ochres', livery: paints('ochre', 'black', 'tan'), colour: 'ochre', division: 'bend', device: 'key' }),
  Object.freeze({ id: 'bays', livery: paints('bay', 'white', null), colour: 'celeste', division: 'fess', device: 'anchor' }),
  Object.freeze({ id: 'forests', livery: paints('forest', 'ochre', 'tan'), colour: 'vert', division: 'chevron', device: 'tree' }),
  Object.freeze({ id: 'oxbloods', livery: paints('oxblood', 'white', null), colour: 'sanguine', division: 'pale', device: 'chalice' }),
  Object.freeze({ id: 'greys', livery: paints('grey', 'gold', 'white'), colour: 'ash', division: 'quarterly', device: 'tower' }),
  Object.freeze({ id: 'whites', livery: paints('white', 'navy', null), colour: 'argent', division: 'bend-sinister', device: 'fish' }),
]);
/** THE PIRATE CREWS: each its dark paint and its black flag. */
export const PIRATE_CREWS = Object.freeze([
  Object.freeze({ id: 'bones', livery: paints('black', 'crimson', 'grey'), flag: Object.freeze({ shape: 'flag', field: 'sable', device: 'skull', charge: 'argent' }) }),
  Object.freeze({ id: 'blades', livery: paints('oxblood', 'black', 'tan'), flag: Object.freeze({ shape: 'flag', field: 'sable', device: 'swords', charge: 'argent' }) }),
  Object.freeze({ id: 'serpents', livery: paints('forest', 'black', 'grey'), flag: Object.freeze({ shape: 'swallowtail', field: 'sable', device: 'serpent', charge: 'vert' }) }),
  Object.freeze({ id: 'reds', livery: paints('black', 'gold', 'oxblood'), flag: Object.freeze({ shape: 'flag', field: 'sanguine', device: 'skull', charge: 'argent' }) }),
  Object.freeze({ id: 'knives', livery: paints('grey', 'crimson', null), flag: Object.freeze({ shape: 'swallowtail', field: 'sable', device: 'dagger', charge: 'crimson' }) }),
  Object.freeze({ id: 'bats', livery: paints('black', 'grey', 'black'), flag: Object.freeze({ shape: 'flag', field: 'sable', device: 'bat', charge: 'ash' }) }),
]);
/** THE LEGENDS' OWN (etherShips.js LEGENDS' ids): each her paint and her flag. */
export const LEGEND_COLOURS = Object.freeze({
  wake: Object.freeze({ livery: paints('grey', 'white', 'black'), flag: Object.freeze({ shape: 'swallowtail', field: 'ash', border: 'sable', device: 'raven', charge: 'sable' }) }),
  queen: Object.freeze({ livery: paints('sea', 'teal', 'grey'), flag: Object.freeze({ shape: 'flag', field: 'teal', border: 'argent', device: 'crown', charge: 'argent' }) }),
  hunger: Object.freeze({ livery: paints('crimson', 'black', 'oxblood'), flag: Object.freeze({ shape: 'flag', field: 'sanguine', border: 'sable', device: 'wolf', charge: 'gold' }) }),
  lantern: Object.freeze({ livery: paints('black', 'gold', 'ochre'), flag: Object.freeze({ shape: 'pennant', field: 'sable', border: 'gold', device: 'flame', charge: 'gold' }) }),
  regent: Object.freeze({ livery: paints('purple', 'gold', 'white'), flag: Object.freeze({ shape: 'flag', field: 'purpure', border: 'gold', device: 'crown', charge: 'gold' }) }),
  starless: Object.freeze({ livery: paints('black', 'black', 'black'), flag: Object.freeze({ shape: 'swallowtail', field: 'sable', device: 'star', charge: 'ash' }) }),
});
/** The streams her colours are drawn off (her seed's own, apart from her names' and her temper's). */
export const HOUSE_SALT = 0x5ea1;
export const CREW_SALT = 0xc7e3;

/** A seed's pick of `n` on its own stream - the same on every machine that knows her seed. */
export function seaPick(seed, salt, n) {
  let h = Math.imul(((seed >>> 0) ^ salt) >>> 0, 0x9e3779b1) >>> 0;
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0; h ^= h >>> 13;
  return n > 0 ? (h >>> 0) % n : 0;
}

/**
 * Who a ship of the sea is, as her colours read it: `cls` her class (navalShips.js SHIP_CLASSES' - `faction`, `hull`),
 * `seed`, `crown` the colours her flag says (a crown's name, 'the Isles', or null - navalShips.js flagOf, etherShips.js
 * etherFlagOf), `legend` her legend's id (or null) and `disguise` the colours she passes for (or null).
 * @typedef {{ cls: { faction: string, hull: number }, seed: number, crown?: string | null, legend?: string | null, disguise?: string | null }} SeaWho
 */

/** A merchant house a ship is of - hers, or (a pirate under false colours) the one she passes for. */
export const houseOf = (/** @type {SeaWho} */ who) => MERCHANT_HOUSES[seaPick(who.seed, HOUSE_SALT, MERCHANT_HOUSES.length)];
/** A pirate's crew. */
export const crewOf = (/** @type {SeaWho} */ who) => PIRATE_CREWS[seaPick(who.seed, CREW_SALT, PIRATE_CREWS.length)];

/** Her paint - SHIP-LIVERY's livery on her hull (shipLivery.js liveryOf: the parts her hull takes), or null as built. */
export function seaLiveryOf(/** @type {SeaWho} */ who) {
  if (!who?.cls) return null;
  const legend = who.legend ? LEGEND_COLOURS[who.legend] : null;
  const f = who.cls.faction;
  const raw = legend ? legend.livery
    : f === 'navy' ? CROWN_COLOURS[who.crown ?? '']?.livery ?? null
    : f === 'merchant' ? houseOf(who).livery
    : f === 'pirate' ? (who.disguise ? houseOf(who).livery : crewOf(who).livery)
    : null;
  return raw ? liveryOf(raw, who.cls.hull) : null;
}

/** A crown's merchant colours over a house's: the crown's field parted with the house's colour (fitFlag parts it with
 *  Argent were the two one colour), the house's device. */
function merchantFlag(crown, house) {
  const c = CROWN_COLOURS[crown ?? ''];
  return c ? fitFlag({ shape: 'swallowtail', field: c.field, division: house.division, field2: house.colour, border: null, device: house.device, charge: null }) : null;
}

/**
 * The flag she flies, by her colours as they stand (`colours`, navalHost.js poseShip's: 'hers', 'false', 'taken',
 * 'struck') - her own while she flies hers, the house she passes for under false colours, none once struck or taken
 * (a prize flies her captor's pennant). Null for none.
 */
export function seaFlagOf(/** @type {SeaWho} */ who, colours = 'hers') {
  if (!who?.cls) return null;
  if (colours === 'false') return who.disguise ? merchantFlag(who.disguise, houseOf(who)) : null;
  if (colours !== 'hers') return null;
  const legend = who.legend ? LEGEND_COLOURS[who.legend] : null;
  if (legend) return fitFlag({ division: 'plain', border: null, ...legend.flag });
  const f = who.cls.faction;
  if (f === 'navy') {
    const c = CROWN_COLOURS[who.crown ?? ''];
    return c ? fitFlag({ shape: 'flag', field: c.field, division: 'plain', border: c.border, device: c.device, charge: c.charge }) : null;
  }
  if (f === 'merchant') return merchantFlag(who.crown, houseOf(who));
  if (f === 'pirate') return fitFlag({ division: 'plain', border: null, ...crewOf(who).flag });
  return null;
}

/** How far off a ship's flag is drawn (m): past it the cloth is a speck, and the pass's budget the nearer ships'. */
export const SEA_FLAG_M = 450;

/**
 * THE SEA'S FLAGS THIS FRAME: of `entries` (the naval host's - `{ boat, ship, colours }`), each ship standing whose
 * colours fly (seaFlagOf's), within SEA_FLAG_M of `at`, the nearest first - `{ boat, flag, phase }` (her seed's
 * wave). `whoOf(entry)` who she is.
 * @param {Iterable<any>} entries @param {number[]} at @param {(e: any) => SeaWho} whoOf
 */
export function seaFlagsOf(entries, at, whoOf) {
  const out = [];
  for (const e of entries) {
    const b = e?.boat;
    if (!b || b.GameObject?.activeSelf === false) continue;
    const p = b.GameObject?.position ?? e.ship?.pos;
    if (!Array.isArray(p) || !Array.isArray(at)) continue;
    const d = Math.hypot(p[0] - at[0], p[2] - at[2]);
    if (!(d <= SEA_FLAG_M)) continue;
    const flag = seaFlagOf(whoOf(e), e.colours);
    if (flag) out.push({ boat: b, flag, phase: e.ship?.seed ?? 0, d });
  }
  out.sort((a, b) => a.d - b.d);
  return out;
}
