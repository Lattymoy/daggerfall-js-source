// @ts-check
// SD2c (2026-10-06, the Super Dungeons arc - Mac: "Super dungeons are random finds on the world map"; bible/11-Multiplayer/
// Super-Dungeons.md section 4): THE HOLLOW SEEN AND HEARD OF - what the world shows one player of a Super dungeon.
//
// BEFORE IT IS FOUND IT IS A FIND: no ring, no compass mark, no row - a column of brass-gold light over its pixel, seen
// from SD_OMEN_PX map pixels round (the gate's beacon pass, its colours its own: render/sdOmenPass.js), and a word in
// the taverns of the city it stands by. ONCE FOUND IT IS NEWS, until it is gone: a ring on the held map, a mark on the
// compass inside SD_COMPASS_M of its door, a row in the Timers window (systems/eventTimers.js) and a note under the red
// seal on every notice board.
//
// PURE: the hub's record (net/sdLaw.js) and the Hollow the world host stood (scenes/sdHost.js hollow()) in, the relay's
// clock handed - every client holding the same record says the same thing at the same moment. Nothing is sent or saved.
//
// Not a DFU member: Daggerfall has no world events. Ledger A (SUPER-DUNGEONS).
import { sdPhase, sdStands, sdMarked, SD_COLLAPSE_MS } from '../net/sdLaw.js';
import { timerText } from './eventTimers.js';
import { pixelOfLoc } from './sdSite.js';
import { MAX_ANSWERS_TELL_ME_ABOUT_OR_RUMORS } from './rumorMill.js';

/** How far the column is seen, map pixels (Chebyshev) - section 4's twelve. */
export const SD_OMEN_PX = 12;
/** The column kindles over this long from the rise, and goes out over this long before the Hollow is gone, real ms. */
export const SD_OMEN_KINDLE_MS = 20_000;
export const SD_OMEN_FADE_MS = 20_000;
/** The ring on the held map once it is found, map pixels: the pixel itself and a little round it - it is a place now,
 *  not an area. */
export const SD_RING_R = 1.25;
/** The compass carries it inside this many metres of its door (section 4's kilometre). */
export const SD_COMPASS_M = 1000;
/** How often "Any news?" in its city is answered with it while it stands. */
export const SD_RUMOR_CHANCE = 0.5;

const clamp01 = (v) => (v <= 0 ? 0 : v >= 1 ? 1 : v);

/**
 * The column's light at `now`, 0..1: kindled from the rise over SD_OMEN_KINDLE_MS, whole while the Hollow stands, out
 * over SD_OMEN_FADE_MS before it is gone - its collapse's end after the kill, its time's end unbeaten.
 * @param {import('../net/wire.js').SdRecord|null|undefined} rec
 * @param {number} now relay clock
 */
export function sdOmenLight(rec, now) {
  if (!rec || !sdStands(sdPhase(rec, now))) return 0;
  const end = rec.fellAt != null ? rec.fellAt + SD_COLLAPSE_MS : rec.until;
  return Math.min(clamp01((now - rec.at) / SD_OMEN_KINDLE_MS), clamp01((end - now) / SD_OMEN_FADE_MS));
}

/** Is the column seen from map pixel (x, y)? Within SD_OMEN_PX of the Hollow's pixel, either way. */
export const sdOmenSeen = (site, x, y) => !!site && Math.max(Math.abs(x - site.px), Math.abs(y - site.py)) <= SD_OMEN_PX;

/** The state in words, for the ring's label, the note and the tip: "fades in 1d 04h", "collapsing". */
export function sdStateWords(rec, now) {
  const phase = sdPhase(rec, now);
  if (phase === 'fell') return 'collapsing';
  if (phase === 'found' || phase === 'risen') return `fades in ${timerText(rec.until - now)}`;
  return '';
}

/**
 * The held map's mark while it is news (found, or collapsing after the kill): its ring round its pixel, its name and
 * its state, its card - the gate's mark's shape (ui/gateMapMark.js readGateMark), the slot in place of the gate's day.
 * @param {import('../net/wire.js').SdRecord|null|undefined} rec
 * @param {{ s:number, site?:any, loc?:any }|null|undefined} hollow
 * @param {number} now
 */
export function sdMapMark(rec, hollow, now) {
  const phase = sdPhase(rec, now);
  if (!rec || !sdMarked(phase) || !hollow?.site || hollow.s !== rec.s) return null;
  const name = String(hollow.loc?.name ?? 'An Abyss Dungeon');
  const words = sdStateWords(rec, now);
  const lines = [`Near ${hollow.site.cityName || 'the Iliac Bay'}`, ...(rec.fb ? [`Found by ${rec.fb}`] : []), ...(words ? [words[0].toUpperCase() + words.slice(1)] : [])];
  return { day: rec.s, cx: hollow.site.px + 0.5, cy: hollow.site.py + 0.5, r: SD_RING_R, label: words ? `${name} - ${words}` : name, phase, tip: { title: `${name}, an Abyss Dungeon`, lines } };
}

/** The note under the red seal on every notice board while it is news - the ring's own words. */
export function sdNoticeCard(mark, cityName) {
  if (!mark) return null;
  const [name, words] = String(mark.label).split(' - ');
  const where = cityName ? `${name}, near ${cityName}.` : `${name}.`;
  return { subject: 'Abyss Dungeon', body: words ? `${where} ${words[0].toUpperCase()}${words.slice(1)}.` : where };
}

/** The taverns' word of it (section 4). */
export const sdRumorLine = (city) => `They say the air goes brass-coloured past the walls of ${city} at dusk, and a bell rings where there is no bell.`;

/**
 * "Any news?" asked in the city a standing Hollow stands by (`here` my map pixel), while it has risen or been found -
 * one time in SD_RUMOR_CHANCE, answered with the taverns' word of it. It spends the person's one answer as the mill's
 * own does (the mill's gate first: a person with no news left has none of this either). Answers the words, or null -
 * the next teller's turn.
 * @param {import('../net/wire.js').SdRecord|null|undefined} rec
 * @param {{ s:number, site?:any }|null|undefined} hollow
 * @param {number} now
 * @param {{ px:number, py:number }|null} here
 * @param {any} session the talk session (numAnswersGivenTellMeAboutOrRumors, isSpyMaster)
 * @param {{ rolls?: () => number }} [o]
 */
export function sdRumor(rec, hollow, now, here, session, { rolls = Math.random } = {}) {
  const phase = sdPhase(rec, now);
  if (!rec || (phase !== 'risen' && phase !== 'found') || !hollow?.site?.city || hollow.s !== rec.s || !here || !session) return null;
  const c = pixelOfLoc(hollow.site.city);
  if (here.px !== c.px || here.py !== c.py) return null;
  if (!((session.numAnswersGivenTellMeAboutOrRumors | 0) < MAX_ANSWERS_TELL_ME_ABOUT_OR_RUMORS || session.isSpyMaster)) return null;
  if (!(rolls() < SD_RUMOR_CHANCE)) return null;
  session.numAnswersGivenTellMeAboutOrRumors = (session.numAnswersGivenTellMeAboutOrRumors | 0) + 1;
  return sdRumorLine(hollow.site.cityName || 'the city');
}
