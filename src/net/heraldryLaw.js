// @ts-check
// ═══════════════════════════════════════════════════════════════════
// GUILD1d (2026-09-30, Mac: "Lets do this") — A GUILD'S HERALDRY: TWO
// COLOURS AND A DEVICE (bible/11-Multiplayer/Seats-Arc.md 8.1).
//
// The record's decision, Mac's instruction ("I want you to make the
// decisions"): two colours from a fixed palette of sixteen, readable
// on the map at its smallest band, and one device of twenty-four drawn
// charges - the port's own art (ui/heraldryArt.js), never a sprite of
// Daggerfall's. The FIELD is the first colour and the BORDER the
// second; they differ. Ash is the unheld seat's ring (Seats-Arc 3.4),
// so a guild wears it only as its border.
//
// Chosen by the guildmaster on the Guild tab: the FIRST choice is free
// (a guild founded before GUILD1d has none, and a guild is not charged
// for its first banner); every change after it burns
// HERALDRY_CHANGE_DRAKES from the guild's Drake treasury - a sink, as
// the market's tax is. The record's "refused in a siege week" is the
// service's (AUDIT-SEATS S10, server-account/src/halls.js setHeraldry):
// a change, while the guild is a side of a battle for a seat that week
// (SEAT2a's sieges and Tourneys) - `heraldry-siege`.
//
// The shapes BOTH ends read - the account service
// (server-account/src/halls.js), which keeps each guild's, and the
// client, which draws them. Pure: no clock, no DOM, no network.
// ═══════════════════════════════════════════════════════════════════

/** The sixteen colours, in the record's order: a key (what the service keeps), the name a player reads, the colour. */
export const HERALDRY_COLOURS = Object.freeze([
  Object.freeze({ key: 'azure', name: 'Azure', hex: '#3b6fd8' }),
  Object.freeze({ key: 'crimson', name: 'Crimson', hex: '#b3262e' }),
  Object.freeze({ key: 'gold', name: 'Gold', hex: '#d4a017' }),
  Object.freeze({ key: 'argent', name: 'Argent', hex: '#e6e6e6' }),
  Object.freeze({ key: 'sable', name: 'Sable', hex: '#1d1d1d' }),
  Object.freeze({ key: 'vert', name: 'Vert', hex: '#2f8f4e' }),
  Object.freeze({ key: 'purpure', name: 'Purpure', hex: '#7a3fa0' }),
  Object.freeze({ key: 'tenne', name: 'Tenné', hex: '#c46a1b' }),
  Object.freeze({ key: 'sanguine', name: 'Sanguine', hex: '#7d1f1f' }),
  Object.freeze({ key: 'celeste', name: 'Celeste', hex: '#7fb3e6' }),
  Object.freeze({ key: 'murrey', name: 'Murrey', hex: '#8c2f5a' }),
  Object.freeze({ key: 'ochre', name: 'Ochre', hex: '#b88a2e' }),
  Object.freeze({ key: 'teal', name: 'Teal', hex: '#1f7f7f' }),
  Object.freeze({ key: 'rose', name: 'Rose', hex: '#d98aa0' }),
  Object.freeze({ key: 'ash', name: 'Ash', hex: '#8a8a8a' }),
  Object.freeze({ key: 'umber', name: 'Umber', hex: '#5a3e22' }),
]);
/** The unheld ring's colour (Seats-Arc 3.4): a guild's border only, never its field. */
export const HERALDRY_UNHELD = 'ash';
/** The devices, in the record's order - each a silhouette of ui/heraldryArt.js: GUILD1d's twenty-four, then GUILD2c's
 *  sixteen (bible/11-Multiplayer/Guild-Overhaul.md) - the guilds' own trades and creeds: the thieves' key and dagger, the
 *  sailors' anchor and ship, the mages' book and flame, the knights' horse and crossed swords, the smiths' anvil. */
export const HERALDRY_DEVICES = Object.freeze([
  'wolf',
  'bear',
  'boar',
  'stag',
  'lion',
  'eagle',
  'raven',
  'dragon',
  'serpent',
  'fish',
  'tower',
  'gate',
  'crown',
  'sword',
  'axe',
  'hammer',
  'bow',
  'shield',
  'sun',
  'moon',
  'star',
  'eye',
  'rose',
  'tree',
  'skull',
  'key',
  'anchor',
  'ship',
  'horse',
  'spider',
  'hand',
  'flame',
  'scales',
  'book',
  'chalice',
  'dagger',
  'owl',
  'bat',
  'swords',
  'anvil',
]);
/** GUILD2c: THE FIELD'S DIVISIONS - plain (one colour, GUILD1d's every banner), or parted in two by a line: down the
 *  middle (per pale), across it (per fess), corner to corner (per bend, per bend sinister), in four (quarterly), by an
 *  inverted V (per chevron) or an X (per saltire). A divided field's second colour is `field2`. */
export const HERALDRY_DIVISIONS = Object.freeze([
  'plain',
  'pale',
  'fess',
  'bend',
  'bend-sinister',
  'quarterly',
  'chevron',
  'saltire',
]);
/** Each division's words. */
export const HERALDRY_DIVISION_NAMES = Object.freeze({
  plain: 'Plain',
  pale: 'Per pale',
  fess: 'Per fess',
  bend: 'Per bend',
  'bend-sinister': 'Per bend sinister',
  quarterly: 'Quarterly',
  chevron: 'Per chevron',
  saltire: 'Per saltire',
});
/** What a change after the first costs, in Drakes from the guild's Drake treasury - burnt. */
export const HERALDRY_CHANGE_DRAKES = 500;

/** @type {Map<string, {key: string, name: string, hex: string}>} */
const COLOUR = new Map(HERALDRY_COLOURS.map((c) => [c.key, c]));
/** @type {Set<string>} */
const DEVICE = new Set(HERALDRY_DEVICES);
/** @type {Set<string>} */
const DIVISION = new Set(HERALDRY_DIVISIONS);

/** A colour's record by its key, or null. */
export const heraldryColourOf = (key) => (typeof key === 'string' ? (COLOUR.get(key) ?? null) : null);

/**
 * A HERALDRY, projected: `{ field, border, device }` - the field any colour but Ash, the border any colour but the
 * field's, the device one of the devices - or null for anything else. What the service keeps and every face draws.
 * GUILD2c: and, where the arms carry them, `division` (not plain) with its second colour `field2` (any but Ash and the
 * field's), and `charge` - the device's own colour where it is not the border's (GUILD1d's device wears the border's).
 * The device must stand out from every colour of the field it lies on: never the field's, never a divided field's
 * second. Arms that carry neither are exactly GUILD1d's three keys - every stored heraldry, banner and pin unmoved.
 */
export function heraldryOf(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const { field, border, device, division = 'plain', field2 = null, charge = null } = /** @type {any} */ (raw);
  if (!heraldryColourOf(field) || !heraldryColourOf(border) || typeof device !== 'string' || !DEVICE.has(device))
    return null;
  if (field === HERALDRY_UNHELD || field === border) return null;
  if (typeof division !== 'string' || !DIVISION.has(division)) return null;
  const parted = division !== 'plain';
  if (parted ? !heraldryColourOf(field2) || field2 === HERALDRY_UNHELD || field2 === field : field2 != null)
    return null;
  // AUDIT GUILD2 G13: nor the border's - a border is the field's edge (`field === border` refused above), and one of the
  // second colour ran into that half of the field, the cloth's edge gone along it
  if (parted && field2 === border) return null;
  if (charge != null && (!heraldryColourOf(charge) || charge === field)) return null;
  const ink = charge ?? border;
  if (ink === field || (parted && ink === field2)) return null;
  const out = /** @type {any} */ ({ field, border, device });
  if (parted) {
    out.division = division;
    out.field2 = field2;
  }
  if (charge != null && charge !== border) out.charge = charge;
  return Object.freeze(out);
}
/** GUILD2c: the device's colour - its `charge`, else the border's. */
export const heraldryInk = (h) => h?.charge ?? h?.border ?? null;

/** Whether two heraldries are the same (null is none). */
export const heraldrySame = (a, b) => {
  const x = heraldryOf(a),
    y = heraldryOf(b);
  return !!x && !!y
    ? x.field === y.field &&
        x.border === y.border &&
        x.device === y.device &&
        (x.division ?? 'plain') === (y.division ?? 'plain') &&
        (x.field2 ?? null) === (y.field2 ?? null) &&
        (x.charge ?? null) === (y.charge ?? null)
    : !x && !y;
};

/** AUDIT GUILD2 G14: the devices named as no single word says them - "a Swords" read as no heraldry does. */
const DEVICE_NAMES = Object.freeze({ swords: 'Pair of Swords', scales: 'Pair of Scales' });
/** A device's name in words - "Wolf", "Pair of Swords". */
export const heraldryDeviceName = (device) =>
  typeof device === 'string' && DEVICE.has(device)
    ? (DEVICE_NAMES[device] ?? device[0].toUpperCase() + device.slice(1))
    : '';

/** A heraldry in words: "Azure bordered Gold, a Wolf" - or '' for none. GUILD2c: a divided field first ("Per pale Azure
 *  and Gold, bordered Sable, a Wolf"), a device's own colour after it ("a Wolf Argent"). */
export function heraldryText(raw) {
  const h = heraldryOf(raw);
  if (!h) return '';
  const device = heraldryDeviceName(h.device);
  const name = (k) => heraldryColourOf(k)?.name;
  const charged = `${/^[AEIOU]/.test(device) ? 'an' : 'a'} ${device}${h.charge ? ` ${name(h.charge)}` : ''}`;
  if (h.division)
    return `${HERALDRY_DIVISION_NAMES[h.division]} ${name(h.field)} and ${name(h.field2)}, bordered ${name(h.border)}, ${charged}`;
  return `${name(h.field)} bordered ${name(h.border)}, ${charged}`;
}
/** GUILD2c: a heraldry's one spelling as a key - a banner's texture, a draft's identity: GUILD1d's `field|border|device`
 *  for plain arms (every texture already cached keeps its key), the division, the second colour and the charge after. */
export function heraldryKey(raw) {
  const h = heraldryOf(raw);
  if (!h) return '';
  const base = `${h.field}|${h.border}|${h.device}`;
  return h.division || h.charge ? `${base}|${h.division ?? 'plain'}|${h.field2 ?? ''}|${h.charge ?? ''}` : base;
}

// ─── SEASON1 part two (2026-10-01, Mac: "Finish the seats"; "Continue"; "Hurry up"): THE BANNER RIBBON ─────────────
// Seats-Arc 9.1: "a thin band in the guild's colours under their name tag for the next Season". The token carries it as
// two indexes of HERALDRY_COLOURS - [field, border] - so it costs a few bytes and every face reads it off the signature.

/** A ribbon for a guild that has chosen no heraldry: Argent bordered Ash. */
export const RIBBON_PLAIN = Object.freeze({ field: 'argent', border: 'ash' });
/** A guild's heraldry as a ribbon's claim: [field, border], each an index of HERALDRY_COLOURS - Argent bordered Ash for
 *  none. */
export function ribbonClaimOf(raw) {
  const h = heraldryOf(raw) ?? RIBBON_PLAIN;
  return [HERALDRY_COLOURS.findIndex((c) => c.key === h.field), HERALDRY_COLOURS.findIndex((c) => c.key === h.border)];
}
/** Whether `rb` is a ribbon's claim: two different whole indexes of HERALDRY_COLOURS. */
export function ribbonClaimOk(rb) {
  if (!Array.isArray(rb) || rb.length !== 2) return false;
  const [f, b] = rb;
  return (
    Number.isInteger(f) &&
    Number.isInteger(b) &&
    f !== b &&
    f >= 0 &&
    b >= 0 &&
    f < HERALDRY_COLOURS.length &&
    b < HERALDRY_COLOURS.length
  );
}
/** A ribbon's claim read back as its two colours - `{ field, border }`, hexes - or null for anything but a claim. */
export const ribbonColours = (rb) =>
  ribbonClaimOk(rb) ? { field: HERALDRY_COLOURS[rb[0]].hex, border: HERALDRY_COLOURS[rb[1]].hex } : null;
const rgbaOf = (hex) => [
  parseInt(hex.slice(1, 3), 16) / 255,
  parseInt(hex.slice(3, 5), 16) / 255,
  parseInt(hex.slice(5, 7), 16) / 255,
  1,
];
/** A ribbon's claim as the bitmap face's two tints - `{ field, border }`, each RGBA from 0 to 1 - or null. */
export const ribbonRgba = (rb) => {
  const c = ribbonColours(rb);
  return c ? { field: rgbaOf(c.field), border: rgbaOf(c.border) } : null;
};
