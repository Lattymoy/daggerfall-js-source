// @ts-check
// SHIP-COLOURS (2026-10-17, the owner: "Finally, a fully customizable flag with the option to use your guild insignia";
// bible/03-World/Naval-Refit.md SHIP-COLOURS) - A SHIP'S FLAG. The port's own; pure.
//
// Come Sail Away's boats fly a PENNANT: their FlagObject's particle system streams small cubes downwind off her masthead
// (vendor/come-sail-away, the prefab's FlagEmitter; scenes/world.js csaParticleLists draws them, a sea ship's tinted her
// faction's). A captain could not choose it. Now each ship of a player's may fly a FLAG of the captain's own design -
// cloth, flown from her masthead downwind (render/shipFlagPass.js), drawn from the guild heraldry's own art
// (ui/flagArt.js over ui/heraldryArt.js) so a guild's arms and a ship's flag are one hand:
//
//   shape     - FLAG_SHAPES: a flag (square to the fly), a swallowtail, a long pennant, a burgee (a short triangle)
//   field     - one of the heraldry's sixteen colours (net/heraldryLaw.js HERALDRY_COLOURS), divided or not by one of its
//               eight divisions (HERALDRY_DIVISIONS) into `field2`
//   border    - its edge in a colour of its own, or none
//   device    - one of the heraldry's forty devices (HERALDRY_DEVICES), or none; `charge` its colour
//   guild     - FLY MY GUILD'S ARMS: while the captain's guild has heraldry, the flag flies it - its field, its division,
//               its border, its device in its ink - in the flag's own shape, and follows the guild's arms when they change;
//               a guild with none (or none at all) flies the flag's own colours (`flownFlag`)
//
// The flag is the ship's: kept on her record in the Fleet's ledger (systems/fleet.js `colours`), so a ship sold takes
// hers with her. A ship with no flag set flies the mod's pennant, as she always did. The flag FLOWN rides the room's word
// beside her boat (systems/comeSailAway/comeSailAwayWire.js `f`, `flagCode`), so every player sees the colours she flies.

import { HERALDRY_COLOURS, HERALDRY_DEVICES, HERALDRY_DIVISIONS, heraldryOf, heraldryInk } from '../../net/heraldryLaw.js';

/** The flag's shapes, in their wire order. */
export const FLAG_SHAPES = Object.freeze(['flag', 'swallowtail', 'pennant', 'burgee']);
const COLOURS = /** @type {string[]} */ (HERALDRY_COLOURS.map((c) => c.key));
const isColour = (k) => typeof k === 'string' && COLOURS.includes(k);

/** A flag a new design starts from: Azure bordered Gold, a Gold anchor. */
export const FLAG_DEFAULT = Object.freeze({ shape: 'flag', field: 'azure', division: 'plain', field2: null, border: 'gold', device: 'anchor', charge: 'gold', guild: false });

/**
 * A FLAG, through its door: `{ shape, field, division, field2, border, device, charge, guild }` - or null for anything
 * that is no flag. A field of any colour; a division of the heraldry's with a second colour not the field's (none for a
 * plain field); a border none or not the field's; a device none or the heraldry's, its charge a colour that lies on
 * neither part of the field (a device with none is given the border's, else the first of Argent, Sable and Gold that does).
 */
export function shipFlagOf(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = /** @type {any} */ (raw);
  const shape = r.shape ?? 'flag';
  if (!FLAG_SHAPES.includes(shape) || !isColour(r.field)) return null;
  const division = r.division ?? 'plain';
  if (!HERALDRY_DIVISIONS.includes(division)) return null;
  const parted = division !== 'plain';
  if (parted ? !isColour(r.field2) || r.field2 === r.field : r.field2 != null) return null;
  const border = r.border ?? null;
  if (border != null && (!isColour(border) || border === r.field)) return null;
  const device = r.device ?? null;
  if (device != null && !HERALDRY_DEVICES.includes(device)) return null;
  let charge = device ? r.charge ?? null : null;
  if (!device && r.charge != null) return null;
  if (device && charge == null) charge = [border, 'argent', 'sable', 'gold'].find((c) => c && c !== r.field && c !== r.field2) ?? null;
  if (charge != null && (!isColour(charge) || charge === r.field || (parted && charge === r.field2))) return null;
  if (r.guild != null && typeof r.guild !== 'boolean') return null;
  return Object.freeze({ shape, field: r.field, division, field2: parted ? r.field2 : null, border, device, charge, guild: !!r.guild });
}

/**
 * A DESIGN MADE A FLAG (the designer's draft, ui/fleetPage.js): `raw` over FLAG_DEFAULT, every choice that clashes with
 * one made before it put right in the order a captain chooses them - the shape and the field first; a divided field's
 * second colour, if it is the field's or none, the first of Argent, Sable, Gold and Azure that is not; a border on the
 * field's colour, none; a device's colour on either part of the field, the first of the border's, Argent, Sable and
 * Gold that lies on neither. Always a flag.
 */
export function fitFlag(raw) {
  const d = { ...FLAG_DEFAULT, ...(raw && typeof raw === 'object' ? raw : {}) };
  const shape = FLAG_SHAPES.includes(d.shape) ? d.shape : 'flag';
  const field = isColour(d.field) ? d.field : FLAG_DEFAULT.field;
  const division = HERALDRY_DIVISIONS.includes(d.division) ? d.division : 'plain';
  const field2 = division === 'plain' ? null : isColour(d.field2) && d.field2 !== field ? d.field2 : ['argent', 'sable', 'gold', 'azure'].find((c) => c !== field);
  const border = isColour(d.border) && d.border !== field ? d.border : null;
  const device = HERALDRY_DEVICES.includes(d.device) ? d.device : null;
  const ok = (c) => isColour(c) && c !== field && c !== field2;
  const charge = device ? (ok(d.charge) ? d.charge : [border, 'argent', 'sable', 'gold'].find(ok)) : null;
  return /** @type {any} */ (shipFlagOf({ shape, field, division, field2, border, device, charge, guild: d.guild === true }));
}

/**
 * THE FLAG FLOWN: `flag` (shipFlagOf's) - and while it is the guild's (`guild`) and the guild has heraldry (`arms`,
 * heraldryLaw.js's), the guild's arms in the flag's shape. Null for no flag.
 */
export function flownFlag(flag, arms = null) {
  const f = shipFlagOf(flag);
  if (!f) return null;
  const h = f.guild ? heraldryOf(arms) : null;
  if (!h) return f;
  return Object.freeze({ shape: f.shape, field: h.field, division: h.division ?? 'plain', field2: h.field2 ?? null, border: h.border, device: h.device, charge: heraldryInk(h), guild: true });
}

/** A flag's one spelling - its texture's key. '' for none. */
export function flagKey(flag) {
  const f = shipFlagOf(flag);
  return f ? [f.shape, f.field, f.division, f.field2 ?? '', f.border ?? '', f.device ?? '', f.charge ?? ''].join('|') : '';
}

/** THE WIRE: a flag as seven whole numbers - its shape, field, division, second colour, border, device and charge by
 *  their lists' places (-1 for none) - or 0 for no flag. The guild's arms are said as the colours they fly. */
export function flagCode(flag) {
  const f = shipFlagOf(flag);
  if (!f) return 0;
  const at = (list, v) => (v == null ? -1 : list.indexOf(v));
  return [FLAG_SHAPES.indexOf(f.shape), COLOURS.indexOf(f.field), HERALDRY_DIVISIONS.indexOf(f.division), at(COLOURS, f.field2),
    at(COLOURS, f.border), at(HERALDRY_DEVICES, f.device), at(COLOURS, f.charge)];
}
/** A flag read back from its code - through the door - or null (0, or anything that is no flag's code). */
export function flagOfCode(code) {
  if (!Array.isArray(code) || code.length !== 7 || !code.every((n) => Number.isInteger(n) && n >= -1 && n < 64)) return null;
  const pick = (list, i) => (i === -1 ? null : list[i] ?? undefined);
  const [shape, field, division, field2, border, device, charge] = [pick(FLAG_SHAPES, code[0]), pick(COLOURS, code[1]), pick(HERALDRY_DIVISIONS, code[2]),
    pick(COLOURS, code[3]), pick(COLOURS, code[4]), pick(HERALDRY_DEVICES, code[5]), pick(COLOURS, code[6])];
  if ([shape, field, division, field2, border, device, charge].includes(undefined) || shape == null || field == null || division == null) return null;
  if (device == null && charge != null) return null;
  if (device != null && charge == null) return null;   // a coded device always says its colour
  return shipFlagOf({ shape, field, division, field2, border, device, charge });
}

/**
 * Her flag's cloth by hull (systems/comeSailAway/comeSailAwayBoat.js HULL_NAMES' order): `[fly, hoist]`, metres - a Large
 * Boat's a man's arm, a Carrack's a sail of its own. The Rowboat flies none (her prefab has no FlagObject).
 */
export const FLAG_SIZES = Object.freeze([null, Object.freeze([1.2, 0.8]), Object.freeze([2.4, 1.6]), Object.freeze([2.7, 1.8]), Object.freeze([3, 2])]);
/** A hull's flag cloth `[fly, hoist]`, or null where she flies none. */
export const flagSizeOf = (hull) => FLAG_SIZES[hull] ?? null;
