// @ts-check
// UNION-CHILDREN (FIELD BUGS 2026-10-29b; the owner: "Show on both trees"; bible/06-Systems/Legacy-Arc.md section 9a): a
// child of two players' union is of the house that bore them. The other house sees them through the marriage, as a
// person of kind 'union' under the couple: never played there, never carrying its mantle, never standing in its world.
import { personOf, newPerson, touch, fullNameOf } from './family.js';
import { kinCard, UNION_KIN_MAX } from './unionKinLaw.js';
import { stampRevived, revivedOf, dropRevived } from './revived.js'; // AUDIT FB1029 E-S1: the bearer's revival, heard
import { houseWord } from './houseName.js';
import { RACES, RACE_KEYS } from '../races.js';
import { t } from '../textManager.js';

/** The children of union `sid` this house has heard of. */
export const unionKinOf = (/** @type {any} */ family, /** @type {string} */ sid) =>
  (family?.people ?? []).filter((/** @type {any} */ p) => p.kind === 'union' && p.union?.sid === sid);

/** The card's word on a recorded child. A death is added, and taken back only by the bearer's own revival stamp (the
 *  card's `revived`, dropped by dropRevived - the realm's law takes it on a union child alone). */
function takeCard(/** @type {any} */ p, /** @type {import('./unionKinLaw.js').KinCard} */ c) {
  const race = RACE_KEYS.includes(/** @type {any} */ (c.race)) ? /** @type {string} */ (c.race) : p.race;
  const next = {
    given: c.given || p.given,
    surname: c.surname || p.surname,
    gender: c.gender,
    race,
    raceId: RACES[race] ?? p.raceId,
    face: c.face,
    minor: c.minor,
  };
  let changed = false;
  for (const [k, v] of Object.entries(next))
    if (p[k] !== v) {
      p[k] = v;
      changed = true;
    }
  if (c.house && p.union.house !== c.house) {
    p.union.house = c.house;
    changed = true;
  }
  for (const at of c.revived)
    if (!revivedOf(p).includes(at)) {
      stampRevived(p, at);
      changed = true;
    }
  if (c.died && !p.died && !revivedOf(p).includes(c.died.at)) {
    p.died = { at: c.died.at, cause: c.died.cause, place: null, by: null };
    changed = true;
  }
  return changed;
}

/**
 * The union's children as the realm says them (`cards`, server-account/src/legacy.js unionKinOf), under the member and
 * `spouse` - the other player's character, kind 'player'. A child is recorded once a union by their id on the other's
 * line (`union.key`) and never dropped. Answers `{ added, changed }`.
 * @param {any} family @param {any} spouse @param {unknown} cards
 */
export function unionKinHeard(family, spouse, cards) {
  /** @type {{ added: any[], changed: boolean }} */
  const out = { added: [], changed: false };
  const member = spouse?.realm?.sid ? personOf(family, spouse.spouse) : null;
  if (!member || !Array.isArray(cards)) return out;
  const sid = spouse.realm.sid;
  for (const raw of cards.slice(0, UNION_KIN_MAX)) {
    const c = kinCard(raw);
    if (!c) continue;
    let p = unionKinOf(family, sid).find((x) => x.union.key === c.key);
    if (!p) {
      p = newPerson(family.nextId++);
      Object.assign(p, {
        kind: 'union',
        union: { sid, key: c.key, house: c.house },
        gen: (member.gen | 0) + 1,
        parents: [member.id, spouse.id],
        born: c.born,
      });
      family.people.push(p);
      for (const par of [member, spouse]) if (!par.children.includes(p.id)) par.children.push(p.id);
      out.added.push(p);
    }
    if (takeCard(p, c)) out.changed = true;
  }
  if (dropRevived(family)) out.changed = true;
  if (out.added.length || out.changed) touch(family);
  return out;
}

/** The card's chip: the house that raises them. */
export function raisedWord(/** @type {any} */ p) {
  const house = houseWord(p?.union?.house);
  return house
    ? t('legacy.union.raised', 'Raised in the house of {house}', { house })
    : t('legacy.union.raisedAway', 'Raised in another house');
}
/** The HUD's word when this house first hears of such a child. */
export const kinBornLine = (/** @type {any} */ child, /** @type {any} */ spouse) =>
  t('legacy.union.born', 'Word reaches you: {child} is born to you and {spouse}.', {
    child: fullNameOf(child.given, child.surname),
    spouse: spouse.given,
  });
