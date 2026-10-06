// @ts-check
// LEGACY5 (2026-10-05, bible/06-Systems/Legacy-Arc.md section 8; Mac: "Surnames, Marriage, Children. Live through the
// world of Daggerfall, passing down your legacy, and continuing your adventures through your bloodline."): COURTING,
// THE WEDDING AND CHILDREN - the law, pure. The host (scenes/legacyHost.js) asks it from a conversation's Tell me about
// page, a temple's door and its slow tick; the Living World's census and regard are read through its deps.
//
//  - COURTING: a Living World resident who counts the one played a FRIEND (relations.js FRIEND_AT) and is no one's in
//    the house. "Courtship" on the Tell me about page, once a day: affection by Personality, Etiquette and the
//    question's tone, a roll on it. At AFFECTION_MAX the resident hears a proposal ("Marriage").
//  - THE WEDDING: a proposal taken, the two are wed at the temple of the resident's town - its door asks, once a visit.
//    The spouse is a person of the house (`kind: 'resident'`), keeping their own name, face and day for life (the
//    Living World's law: a resident's identity is for life).
//  - CHILDREN: while both live, every CHILD_DAYS days of the world's clock, CHILD_CHANCE of a child, at most
//    CHILDREN_MAX - each a member of the house, a minor until the mantle passes to them (they come of age in the
//    telling, section 10's departure), born through family.js addChild from both parents.
import { FRIEND_AT } from '../livingWorld/relations.js';
import { RACE_KEYS } from '../races.js';
import { personOf, isAlive, touch, newPerson, addChild, fullNameOf } from './family.js';
import { readHouse } from '../../net/houseLaw.js';   // LEGACY7 part three: the other player's house, held to its law

export const AFFECTION_MAX = 100;
/** A day's courtship: the base, a point per twenty of Personality and of Etiquette, the tone's (Polite, Normal, Blunt). */
export const COURT_BASE = 6;
export const COURT_TONE = Object.freeze([3, 0, -3]);
export const CHILD_DAYS = 30;
export const CHILD_CHANCE = 0.25;
export const CHILDREN_MAX = 6;
export const DAY_MINUTES = 1440;

export const TOPIC = Object.freeze({ court: 'court', propose: 'propose', wedding: 'wedding', family: 'family' });
const LABEL = Object.freeze({ court: 'Courtship', propose: 'Marriage', wedding: 'Our wedding', family: 'Our family' });

/** The world's day of a clock reading (minutes). */
export const dayOf = (minutes) => Math.floor((Number(minutes) || 0) / DAY_MINUTES);

/** A resident's given name and the rest - "Ysolde Hlaalu" -> ['Ysolde', 'Hlaalu']. */
export function splitName(name) {
  const words = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  return [words[0] ?? 'Someone', words.slice(1).join(' ')];
}

/** The member's courtships, minted on first use: `{ [residentId]: { name, mapId, town, affection, day, betrothed } }`. */
const courtsOf = (member) => (member.courting ??= {});

/** Who may be courted: a townsperson of a household (the census's `h` roll - never one of the watch, a traveller on
 *  the roads, a visitor or one of the line). Every census resident is an adult (census.js mintResident). */
export const courtable = (res) => !!res && res.roll === 'h' && !res.guard && !res.legacy;

/** Is this resident one of the house already - a member's spouse? */
export const residentInHouse = (family, residentId) => (family?.people ?? []).some((p) => p.kind === 'resident' && p.residentId === residentId);

/** The member's living spouse, or null. */
export function spouseOf(family, member) {
  const s = member?.spouse != null ? personOf(family, member.spouse) : null;
  return s && isAlive(s) ? s : null;
}

/**
 * THE TOPICS a resident offers the one played, in order (none at all when there is nothing between them):
 * their spouse's "Our family"; a betrothed's "Our wedding"; "Marriage" once affection is full; "Courtship" for a friend
 * or a courtship already begun. Never while the member is wed to another, never for a resident another member wed.
 * @param {any} family @param {any} member @param {{ id: string, name: string }} res @param {number} regard
 */
export function topicsFor(family, member, res, regard) {
  if (!family || !member || !isAlive(member) || !res?.id) return [];
  if (!courtable(res) && !residentInHouse(family, res.id)) return [];
  const spouse = spouseOf(family, member);
  if (spouse) return spouse.residentId === res.id ? [TOPIC.family] : [];
  if (residentInHouse(family, res.id)) return [];
  const c = member.courting?.[res.id];
  if (c?.betrothed) return [TOPIC.wedding];
  if (c && c.affection >= AFFECTION_MAX) return [TOPIC.propose];
  if (c || regard >= FRIEND_AT) return [TOPIC.court];
  return [];
}
export const topicLabel = (t) => LABEL[t] ?? t;

/** The player's side of each topic, by tone (Polite, Normal, Blunt). */
export function topicQuestion(t, tone = 1) {
  const i = Math.max(0, Math.min(2, tone | 0));
  if (t === TOPIC.court) return ['Would you let me court you?', 'I would like to spend some time with you.', 'You and me - what do you say?'][i];
  if (t === TOPIC.propose) return ['Will you do me the honour of marrying me?', 'Will you marry me?', 'Marry me.'][i];
  if (t === TOPIC.wedding) return 'When shall we be wed?';
  return 'How is our family?';
}

/** A day's affection: the base, Personality and Etiquette, the tone - on a roll from three quarters to five quarters. */
export function courtGain({ personality = 50, etiquette = 0, tone = 1, roll = 0.5 } = {}) {
  const base = COURT_BASE + Math.floor(Math.max(0, personality) / 20) + Math.floor(Math.max(0, etiquette) / 20) + COURT_TONE[Math.max(0, Math.min(2, tone | 0))];
  return Math.max(1, Math.round(base * (0.75 + 0.5 * Math.max(0, Math.min(1, roll)))));
}

/**
 * COURTSHIP: once a day, the day's affection. Answers `{ gained, affection, again }` - `again` when this day's was
 * already given (nothing gained).
 * @param {any} member @param {{ id: string, name: string, town: number, sex?: string, race?: string, face?: number }} res
 * @param {{ day: number, townName?: string, personality?: number, etiquette?: number, tone?: number, roll?: number }} o
 */
export function court(member, res, o) {
  const courts = courtsOf(member);
  // the resident as they are - their identity is for life (the Living World's law), so the wedding needs no town loaded
  const c = (courts[res.id] ??= { name: String(res.name), mapId: res.town | 0, town: String(o.townName ?? ''), affection: 0, day: -1, betrothed: false,
    sex: res.sex === 'female' ? 'female' : 'male', race: String(res.race ?? ''), face: res.face | 0 });
  if (c.day === o.day) return { gained: 0, affection: c.affection, again: true };
  const gained = Math.min(AFFECTION_MAX - c.affection, courtGain(o));
  c.affection += gained;
  c.day = o.day;
  return { gained, affection: c.affection, again: false };
}

/** A PROPOSAL, heard at full affection: the two are betrothed. Answers whether it was taken. */
export function propose(member, residentId) {
  const c = member?.courting?.[residentId];
  if (!c || c.affection < AFFECTION_MAX || c.betrothed) return false;
  c.betrothed = true;
  return true;
}

/** The member's betrothal standing, or null: `[residentId, courtship]`. */
export function betrothalOf(member) {
  for (const [id, c] of Object.entries(member?.courting ?? {})) if (c?.betrothed) return [id, c];
  return null;
}

/** A resident's death ends what was between them - the courtship forgotten, a betrothal with it. */
export function forgetCourtship(member, residentId) {
  if (member?.courting?.[residentId]) delete member.courting[residentId];
}

/**
 * THE WEDDING: the resident made a person of the house (`kind: 'resident'`, their census id, their own name and face
 * for life), wed to the member; every other courtship of the member ends. Answers the spouse.
 * @param {any} family @param {any} member
 * @param {{ id: string, name: string, sex?: string, race?: string, face?: number, mapId?: number, town?: number }} res @param {number} at
 */
export function wed(family, member, res, at, { takeName = false } = {}) {
  const s = newPerson(family.nextId++);
  const [given, own] = splitName(res.name);
  const surname = takeName ? family.surname : own;
  s.kind = 'resident';
  s.residentId = String(res.id);
  s.given = given;
  s.surname = surname;
  s.gender = res.sex === 'female' ? 'female' : 'male';
  s.race = RACE_KEYS.includes(/** @type {any} */ (res.race)) ? res.race : 'Breton';
  s.residentFace = res.face ?? null;
  s.gen = member.gen | 0;
  s.born = at;
  s.spouse = member.id;
  s.wedAt = at;
  member.spouse = s.id;
  member.wedAt = at;
  member.courting = {};
  s.mapId = res.mapId ?? res.town ?? 0;   // the town they live in - their census house is there, and their day
  family.people.push(s);
  touch(family);
  return s;
}

// ═══ LEGACY7 part three: TWO PLAYERS WED ═══════════════════════════════════════════════════════════════════════════
//
// Online, a member may wed ANOTHER PLAYER'S realm character of a house (net/wedSession.js; the account service makes
// the union - server-account/src/legacy.js realmWed). Each house records the other's member as the spouse
// (`kind: 'player'`): their own name and house for life - the union names them, it does not take them in - and their
// sex, race and face off their own line (the service's card). Never played here, never carrying the mantle, never
// standing in this house's world (they walk their own); children come on the member's own clock while they live, as
// with any spouse (childStep).

/**
 * THE OTHER PLAYER'S CHARACTER, wed to the member: a person of this house's record of `kind: 'player'`, `realm` the
 * union (its sid, the other's account and realm character, their house as the service read it). Every courtship of the
 * member ends, as at any wedding. Answers the spouse.
 * @param {any} family @param {any} member
 * @param {{ player: string, char: string, name?: string, house?: any, gender?: string, race?: string|null, face?: number }} card
 * @param {string} sid @param {number} at
 */
export function wedPlayer(family, member, card, sid, at) {
  const s = newPerson(family.nextId++);
  const [given, own] = splitName(card.name);
  const house = readHouse(card.house);
  s.kind = 'player';
  s.given = house?.hc ?? given;
  s.surname = house?.hn ?? own;
  s.gender = card.gender === 'female' ? 'female' : 'male';
  s.race = RACE_KEYS.includes(/** @type {any} */ (card.race)) ? /** @type {string} */ (card.race) : 'Breton';
  s.face = Number.isInteger(card.face) && /** @type {number} */ (card.face) >= 0 ? /** @type {number} */ (card.face) : 0;
  s.gen = member.gen | 0;
  s.born = at;
  s.spouse = member.id;
  s.wedAt = at;
  s.realm = { sid: String(sid), player: String(card.player ?? ''), char: String(card.char ?? ''), house };
  member.spouse = s.id;
  member.wedAt = at;
  member.courting = {};
  family.people.push(s);
  touch(family);
  return s;
}

/** The person of this house a union (by its sid) recorded, or null. */
export const unionSpouse = (family, sid) => (family?.people ?? []).find((p) => p.kind === 'player' && p.realm?.sid === sid) ?? null;

/** A union the realm ended - the other player's character dead ('died', cause 'fell') or gone from the realm ('gone',
 *  deleted): in this house's record they are dead, and the member may wed again. Answers whether it changed anything. */
export function playerSpouseLost(family, spouse, at, why) {
  if (!spouse || spouse.kind !== 'player' || spouse.died) return false;
  spouse.died = { at, cause: why === 'gone' ? 'gone' : 'fell', place: null, by: null };
  touch(family);
  return true;
}

/** The children the two have had together. */
export const childrenTogether = (family, member, spouse) => (family?.people ?? []).filter((p) => p.parents.includes(member.id) && p.parents.includes(spouse.id)).length;

/**
 * A CHILD, perhaps: every CHILD_DAYS days since the wedding (or the last child's day), CHILD_CHANCE of one while both
 * live, at most CHILDREN_MAX. Answers the child, or null. The child is a minor member - never played until the mantle.
 * @param {any} family @param {any} member @param {{ day: number, rng: () => number, at: number, settings?: any }} o
 */
export function childStep(family, member, { day, rng, at, settings = {} }) {
  const spouse = spouseOf(family, member);
  if (!spouse || !isAlive(member)) return null;
  const from = member.childDay ?? dayOf(member.wedAt ?? 0);
  if (day - from < CHILD_DAYS) return null;
  member.childDay = from + CHILD_DAYS * Math.floor((day - from) / CHILD_DAYS);
  touch(family);
  if (childrenTogether(family, member, spouse) >= CHILDREN_MAX || !(rng() < CHILD_CHANCE)) return null;
  const { person } = addChild(family, member.id, { rng, at, settings });
  person.minor = true;
  return person;
}

/** The lines a resident answers with. */
export const MARRIAGE_TEXT = Object.freeze({
  courted: (name, affection) => (affection >= AFFECTION_MAX
    ? `${name} takes your hand. "If you have a question for me, ask it."`
    : affection >= 67 ? `${name} laughs, and walks with you a while. "Come back tomorrow."`
      : affection >= 34 ? `${name} smiles. "I like your company. Come and find me again."`
        : `${name} looks at you a long moment. "You're kind. We'll see."`),
  again: (name) => `${name} smiles. "You've had my day already. Tomorrow."`,
  accepted: (name, town) => `${name} says yes. "Ask the priest at the temple${town ? ` in ${town}` : ''}, and we'll be wed."`,
  wedding: (town) => `"The priest at the temple${town ? ` in ${town}` : ''} is waiting on us."`,
  family: (n) => (n ? `"The ${n === 1 ? 'little one is' : `${n} children are`} well. Come home when you can."` : '"All is well at home. Come back to me safe."'),
  ask: (name) => `Be wed to ${name} here, before the gods?`,
  wed: (name, house) => `You and ${name} are wed. ${name} is of the house of ${house} now.`,
  child: (name, spouse) => `A child is born to you and ${spouse}: ${name}.`,
  lost: (name) => `Word reaches you: ${name} is dead.`,
  // LEGACY7 part three: two players wed
  wedPlayer: (name) => `You and ${name} are wed, before the gods. Each of you keeps your own house.`,
  gone: (name) => `Word reaches you: ${name} has gone from the realm.`,
});

/** The child's announcement, by the family's names. */
export const childLine = (child, spouse) => MARRIAGE_TEXT.child(fullNameOf(child.given, child.surname), spouse.given);
