// @ts-check
// UNION-CHILDREN (FIELD BUGS 2026-10-29b; bible/06-Systems/Legacy-Arc.md section 9a): a child of two players' union, as
// the other house hears of them - the card's law, which the account service writes (server-account/src/legacy.js
// unionKinOf) and the client reads (systems/legacy/unionKin.js). A leaf: the Worker reads it without the family's dice.
import { houseNameOk } from '../../net/houseLaw.js';

/** The children a house rolls with one spouse (marriage.js CHILDREN_MAX, restated here and pinned equal). */
export const UNION_KIN_MAX = 6;
export const KIN_NAME_MAX = 40;
export const KIN_FACE_MAX = 999;
/** How a life ends on a card; any other word reads 'unknown'. */
export const KIN_CAUSES = Object.freeze(['fell', 'slain', 'years', 'gone']);
/** The deaths taken back a card carries (revived.js stamps) - the latest, at most. */
export const KIN_REVIVED_MAX = 8;
const SID_RE = /^[A-Za-z0-9]{6,16}$/;

/**
 * @typedef {{ key:number, given:string, surname:string, house:string|null, gender:'male'|'female', race:string|null,
 *   face:number, born:number, died:{ at:number, cause:string }|null, revived:number[], minor:boolean }} KinCard
 */

const nameOf = (/** @type {unknown} */ s) => {
  const v = String(s ?? '').trim();
  return v.length <= KIN_NAME_MAX ? v : '';
};

/** A card held to its shape, or null. @param {any} c @returns {KinCard|null} */
export function kinCard(c) {
  if (!c || typeof c !== 'object' || !Number.isSafeInteger(c.key) || c.key < 0) return null;
  const died =
    c.died && typeof c.died === 'object' && Number.isFinite(c.died.at)
      ? { at: Number(c.died.at), cause: KIN_CAUSES.includes(c.died.cause) ? String(c.died.cause) : 'unknown' }
      : null;
  return {
    key: c.key,
    given: nameOf(c.given),
    surname: nameOf(c.surname),
    house: houseNameOk(c.house) ? c.house : null,
    gender: c.gender === 'female' ? 'female' : 'male',
    race: typeof c.race === 'string' && /^[A-Za-z][A-Za-z ]{0,23}$/.test(c.race) ? c.race : null,
    face: Number.isSafeInteger(c.face) && c.face >= 0 && c.face <= KIN_FACE_MAX ? c.face : 0,
    born: Number.isFinite(c.born) && c.born >= 0 ? Math.floor(c.born) : 0,
    died,
    minor: c.minor === true,
    revived: Array.isArray(c.revived)
      ? c.revived
          .filter((/** @type {unknown} */ n) => Number.isFinite(n))
          .map(Number)
          .slice(-KIN_REVIVED_MAX)
      : [], // AUDIT FB1029 E-S1
  };
}

/** A union child's link on the record - the union's sid, their id on the other's line, that house's name - or null. */
export function readUnionKin(/** @type {any} */ u) {
  if (
    !u ||
    typeof u !== 'object' ||
    typeof u.sid !== 'string' ||
    !SID_RE.test(u.sid) ||
    !Number.isSafeInteger(u.key) ||
    u.key < 0
  )
    return null;
  return { sid: u.sid, key: u.key, house: houseNameOk(u.house) ? u.house : null };
}
