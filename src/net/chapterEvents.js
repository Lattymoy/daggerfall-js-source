// @ts-check
// ═══════════════════════════════════════════════════════════════════
// CHAP6c (2026-10-09, Mac: "continue"; bible/11-Multiplayer/Chapters-Arc.md 7 and 9) — A CHAPTER'S SEASON IN WORDS:
// the lines the board, the hall's roll and the backing say of a chapter's Season's event (net/npcChapterLaw.js
// chapterSeasonOf reads it off the sheet or the board), and the names of its candidates.
//
// THE CANDIDATES ARE NAMED BY THE EVENT'S ROLL. A Schism's two and a Succession's three are "residents of the hall,
// drawn from the census by the event's roll, and known to every player by the same name" (section 9): each name is
// DFU's own FullName on the region's name bank (MapsFile.RegionRaces), on a seed the Season, the chapter and the
// candidate's place make - the census's own residentName, so DFU's global stream is put back as it stood. NARROWED:
// named, not yet walking the hall's streets (the living world's census keeps its own residents).
//
// Client-only: the name banks are the client's (the service holds a candidate by its index alone). Worded without
// gender. Not a DFU member: Daggerfall's guilds have no Seasons. Ledger A row.
// ═══════════════════════════════════════════════════════════════════

import { gateHash } from './gateLaw.js';
import { chapterTitleKey, chapterSeasonOf, chapterDoctrineWords, hallPosterName, hallHidden, isRollFaction, SUCCESSION_CANDIDATES } from './npcChapterLaw.js';
import { residentName } from '../systems/livingWorld/census.js';
import { getNameBankOfRegion, GENDERS } from '../characters/nameHelper.js';

/** The candidates' own salt. */
export const CHAPTER_CANDIDATE_SALT = 0xca7d;

/** CANDIDATE `index` of chapter `faction` of `region` in Season `season` - a Schism's side (0, 1) or a Succession's
 *  candidate (0 to 2): a full name on the region's bank, the same for every reader. */
export function chapterCandidateName(/** @type {number} */ season, /** @type {number} */ faction, /** @type {number} */ region, /** @type {number} */ index) {
  const h = gateHash(CHAPTER_CANDIDATE_SALT, season, chapterTitleKey(faction, region), index);
  return residentName(h, getNameBankOfRegion(region), (h >>> 16) & 1 ? GENDERS.Female : GENDERS.Male);
}

/** A rival named: "the Thieves Guild" - "a rival in the shadows" for a hidden guild, "a rival chapter" for none known. */
const rivalOf = (/** @type {number | null} */ f) => (f === null ? 'a rival chapter' : isRollFaction(f) && !hallHidden(f) ? `the ${hallPosterName(f)}` : 'a rival in the shadows');
const listed = (/** @type {string[]} */ n) => (n.length < 2 ? n.join('') : `${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}`);

/**
 * THE SEASON'S LINES of chapter `faction` of `region` as `c` says it (the sheet's chapter or the board's line): the
 * event's, the doctrine holding, its halls shut - each a sentence, none for Calm. A Schism names its two and their
 * doctrines; a Succession its three, or its heir once named.
 * @param {number} faction @param {number} region @param {any} c
 */
export function chapterSeasonLines(faction, region, c) {
  const s = chapterSeasonOf(c);
  const name = (/** @type {number} */ i) => (s.season === null ? null : chapterCandidateName(s.season, faction, region, i));
  /** @type {string[]} */
  const out = [];
  if (s.event === 'schism') {
    const [a, b] = [name(0), name(1)];
    out.push(s.sides && a && b ? `The chapter is split this Season: ${a} stands for ${chapterDoctrineWords(s.sides[0])}, ${b} for ${chapterDoctrineWords(s.sides[1])}.`
      : 'The chapter is split this Season.');
  } else if (s.event === 'succession') {
    const names = Array.from({ length: SUCCESSION_CANDIDATES }, (_, i) => name(i));
    if (s.heir !== null && names[s.heir]) out.push(`${names[s.heir]} is the hall's new head.`);
    else out.push(names.every(Boolean) ? `The hall's head steps down this Season: ${listed(/** @type {string[]} */ (names))} stand to follow.` : 'The hall\'s head steps down this Season.');
  } else if (s.event === 'crackdown') out.push('The watch hunts the chapter this Season: its members\' own writs earn half again Merit.');   // AUDIT CHAP5 E1
  else if (s.event === 'rivalry') out.push(`The chapter races ${rivalOf(s.rival)} for Merit this Season.`);
  else if (s.event === 'decline') out.push('The chapter is in decline this Season: it loses Strength each week its Merit falls short of twice the target.');
  else if (s.event === 'ascendancy') out.push('The chapter is ascendant this Season.');
  if (s.doctrine) out.push(`The chapter holds to ${chapterDoctrineWords(s.doctrine)} this Season.`);
  if (s.shut) out.push('The chapter\'s halls are shut this Season, by the watch\'s order.');
  return out;
}

/**
 * THE CHOICES a member may back in chapter `faction` of `region` this Season - `[{ side, label }]`: a Schism's two
 * ("Alda Foo, for cheaper training"), a Succession's three until its heir is named; none for any other event, nor where
 * the candidates cannot be named.
 * @param {number} faction @param {number} region @param {any} c
 */
export function chapterBackChoices(faction, region, c) {
  const s = chapterSeasonOf(c);
  if (s.season === null) return [];
  if (s.event === 'schism' && s.sides) return s.sides.map((d, side) => ({ side, label: `${chapterCandidateName(/** @type {number} */ (s.season), faction, region, side)}, for ${chapterDoctrineWords(d)}` }));
  if (s.event === 'succession' && s.heir === null) return Array.from({ length: SUCCESSION_CANDIDATES }, (_, side) => ({ side, label: chapterCandidateName(/** @type {number} */ (s.season), faction, region, side) }));
  return [];
}

/** What a backing says once it lands: "You back Alda Foo, for cheaper training." / "You name Alda Foo to follow as the
 *  hall's head." - null for a choice that is none. @param {number} faction @param {number} region @param {any} c @param {number} side */
export function chapterBackedLine(faction, region, c, side) {
  const choice = chapterBackChoices(faction, region, c).find((x) => x.side === side);
  if (!choice) return null;
  return chapterSeasonOf(c).event === 'schism' ? `You back ${choice.label}.` : `You name ${choice.label} to follow as the hall's head.`;
}
