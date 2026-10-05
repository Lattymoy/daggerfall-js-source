// @ts-check
// LW7c (2026-10-05, bible/06-Systems/Living-World.md "LW7c"): THE PEOPLE WHO KNOW YOU - the character's regards
// (relations.js) as a page of the chronicle: each resident the player has met, by NAME and TOWN, their standing, and how
// long since they were last seen - or that they are dead by the player's hand or at their side. Mac: "make friends or
// enemies"; a friendship nobody can see is not one the player can keep.
//
// NOTHING NEW IS SAVED. A resident's id names their town, their roll, their slot and their generation
// (census.js: `L<map>.<slot>` a household's, `L<map>.t<slot>` a traveller's, `L<map>.w<slot>` the watch's, `~<gen>` a
// newcomer's), and the census's mint is a pure function of those - a name reads the seed, the region's bank and the
// sex, and the sex reads no trade but the watch's - so the page mints each one again (`residentOfId`). The dead are the
// character's own hand deaths (relations.js HAND_KINDS), told by their place and the name they bore.
import { mintResident } from './census.js';
import { regardStanding } from './relations.js';
import { placeKeyOf } from './lives.js';

/** A resident's id, read: the town's map id, the roll, the slot and the generation (null: the census's own). */
export const RESIDENT_ID = /^L(\d+)\.([tw]?)(\d+)(?:~(\d+))?$/;
/** The most of each standing the page shows (the warmest friends, the bitterest enemies, the latest seen). */
export const PEOPLE_MAX = 60;

/**
 * The resident an id names, minted again from their town (`townOf(mapId)` the host's MAPS-row record, null for one it
 * does not know) - null for an id that is not a resident's, or of a town not known.
 * @param {string} id @param {(mapId: number) => any} townOf
 */
export function residentOfId(id, townOf) {
  const m = RESIDENT_ID.exec(String(id ?? ''));
  if (!m) return null;
  const town = townOf(Number(m[1]));
  if (!town) return null;
  const roll = /** @type {'h'|'t'|'w'} */ (m[2] || 'h');
  return mintResident(town, roll, Number(m[3]), roll === 'w' ? 'guard' : 'resident', { gen: m[4] != null ? Number(m[4]) : null });
}

/**
 * THE PAGE: everyone the character knows, as three lists - FRIENDS (the warmest first), ENEMIES (the hostile and the
 * enemies, the bitterest first) and the KNOWN (the latest seen first) - each to PEOPLE_MAX. Each row: `id`, `name`,
 * `town` (its name, '' unknown), `standing`, `regard` (on `day`, eased), `days` since last seen, `fate` - 'slain' by
 * the player's hand, 'died' at their side, null - and the `words` the page says of them (`personWords`).
 * @param {{ entries: () => { id: string, seen: number }[], regard: (id: string, day: number) => number, turns: () => any }} rel
 * @param {number} day @param {(mapId: number) => any} townOf
 * @returns {{ friends: any[], enemies: any[], known: any[] }}
 */
export function peoplePage(rel, day, townOf) {
  const t = rel.turns?.() ?? {};
  /** @type {Map<string, 'slain'|'died'>} the hand deaths, by `place|name` */
  const fates = new Map();
  for (const kind of /** @type {const} */ (['died', 'slain'])) {
    for (const [key, h] of t[kind] ?? []) if (h?.who) fates.set(`${key.slice(0, key.lastIndexOf('@'))}|${h.who}`, kind);
  }
  const rows = [];
  for (const e of rel.entries()) {
    const res = residentOfId(e.id, townOf);
    if (!res) continue;
    const r = rel.regard(e.id, day);
    const town = townOf(res.town);
    const row = { id: e.id, name: res.name, town: town?.name ?? '', standing: regardStanding(r), regard: Math.round(r), days: Math.max(0, day - e.seen),
      fate: fates.get(`${placeKeyOf(res)}|${res.name}`) ?? null, words: '' };
    row.words = personWords(row);
    rows.push(row);
  }
  const friends = rows.filter((p) => p.standing === 'friend').sort((a, b) => b.regard - a.regard || a.days - b.days);
  const enemies = rows.filter((p) => p.standing === 'enemy' || p.standing === 'hostile').sort((a, b) => a.regard - b.regard || a.days - b.days);
  const known = rows.filter((p) => p.standing === 'neutral').sort((a, b) => a.days - b.days || (a.name < b.name ? -1 : 1));
  return { friends: friends.slice(0, PEOPLE_MAX), enemies: enemies.slice(0, PEOPLE_MAX), known: known.slice(0, PEOPLE_MAX) };
}

/** What the page says of one: their fate, else what their standing means to the player, and when they were last seen. */
export function personWords(p) {
  if (p.fate === 'slain') return 'Slain by your hand.';
  if (p.fate === 'died') return 'Fell fighting at your side.';
  const said = p.standing === 'friend' ? 'A friend.' : p.standing === 'hostile' ? 'Hostile - they mean you harm.'
    : p.standing === 'enemy' ? 'An enemy - they will not speak to you.' : 'Knows you.';
  const seen = p.days === 0 ? 'Seen today.' : p.days === 1 ? 'Last seen yesterday.' : `Last seen ${p.days} days ago.`;
  return `${said} ${seen}`;
}
