// @ts-check
// LEGACY7 part two (2026-10-06, bible/06-Systems/Legacy-Arc.md section 9; Mac: "online integration with permadeath
// (Bloodline) or non-permadeath (Enduring)"): A HOUSE NAME ONLINE - the law both ends share. The account service reads
// the house off the realm character's line (server-account/src/legacy.js realmHouseOf) and signs it into the identity
// token beside the guild's tag (identityToken.js claimsValid): `hn` the house, `hc` the member's given name, `hb` 1 for a
// Bloodline, `hg` the generation's numeral when two of the house have borne that name. The relay stamps it on every row
// as it stamps the Renown (wire.js badged); a client reads it back (`readHouse`) and draws one line under a name -
// "☠ Ysolde II of House Hlaalu" - over the head, on the inspect card and on the roster's tile.

export const HOUSE_NAME_MAX = 24;
export const HOUSE_GIVEN_MAX = 20;
export const HOUSE_GEN_MAX = 20;
/** A Bloodline's mark beside the house: a small skull. */
export const BLOODLINE_MARK = '☠';

/** A name a house or a member may carry on the wire: letters (any script), apostrophes, hyphens and single spaces. */
const nameOk = (s, max) => typeof s === 'string' && s.length > 0 && s.length <= max && /^[\p{L}][\p{L}'\- ]*$/u.test(s) && !/ {2}|[ '-]$/.test(s);
export const houseNameOk = (s) => nameOk(s, HOUSE_NAME_MAX);
export const houseGivenOk = (s) => nameOk(s, HOUSE_GIVEN_MAX);

/** The claims' own law: `hn` absent and the rest with it; present, each of the rest absent or of its shape. */
export function houseClaimOk(c) {
  if (c?.hn === undefined) return c?.hc === undefined && c?.hb === undefined && c?.hg === undefined;
  if (!houseNameOk(c.hn)) return false;
  if (c.hc !== undefined && !houseGivenOk(c.hc)) return false;
  if (c.hb !== undefined && c.hb !== 1) return false;
  if (c.hg !== undefined && !(Number.isSafeInteger(c.hg) && c.hg >= 2 && c.hg <= HOUSE_GEN_MAX)) return false;
  return true;
}

/** A row's house, as a client reads it back - `{ hn, hc?, hb?, hg? }` - or null (none, or a stranger's word that does not
 *  fit the law). */
export function readHouse(row) {
  if (!row || row.hn === undefined || row.hn === null) return null;
  const h = { hn: row.hn, ...(row.hc !== undefined ? { hc: row.hc } : {}), ...(row.hb !== undefined ? { hb: row.hb } : {}), ...(row.hg !== undefined ? { hg: row.hg } : {}) };
  return houseClaimOk(h) ? h : null;
}

/** @type {ReadonlyArray<[number, string]>} */
const ROMAN = Object.freeze([[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]);
/** The generation's numeral, 1-20 ("II", "XIV"). */
export function romanOf(n) {
  let left = Math.max(1, Math.min(HOUSE_GEN_MAX, Math.floor(n)));
  let out = '';
  for (const [v, s] of ROMAN) while (left >= v) { out += s; left -= v; }
  return out;
}

/** The line drawn under a name: "☠ Ysolde II of House Hlaalu" - a seat's house ("of Sentinel") reads as itself. */
export function houseLine(h) {
  if (!h || !houseNameOk(h.hn)) return null;
  const who = h.hc ? `${h.hc}${h.hg ? ` ${romanOf(h.hg)}` : ''} ` : '';
  const house = /^of /i.test(h.hn) ? h.hn : `of House ${h.hn}`;
  return `${h.hb === 1 ? `${BLOODLINE_MARK} ` : ''}${who}${house}`;
}

/**
 * THE HOUSE OF A LINE'S MEMBER - what the service signs, off the family's record: its surname, the member's given name,
 * the Bloodline's mark, and the generation's numeral (one more than the members before them of that given name, said
 * from the second). Null when it cannot be said, or would not fit the law.
 * @param {any} record - the family's record (src/systems/legacy/family.js) @param {number} personId
 */
export function houseOfRecord(record, personId) {
  const people = Array.isArray(record?.people) ? record.people : [];
  const p = people.find((x) => x?.id === personId);
  if (!p) return null;
  const hn = String(record.surname ?? '').trim();
  if (!houseNameOk(hn)) return null;
  const given = String(p.given ?? '').trim();
  const before = people.filter((x) => x && x.id < p.id && (x.kind ?? 'member') === 'member' && String(x.given ?? '').trim() === given).length;
  const h = { hn, ...(houseGivenOk(given) ? { hc: given } : {}), ...(record.model === 'bloodline' ? { hb: 1 } : {}), ...(before > 0 && houseGivenOk(given) ? { hg: Math.min(HOUSE_GEN_MAX, before + 1) } : {}) };
  return houseClaimOk(h) ? h : null;
}
