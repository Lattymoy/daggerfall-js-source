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
import { sdPhase, sdStands, sdMarked, sdNameIn, sdWhere, SD_COLLAPSE_MS } from '../net/sdLaw.js';
import { timerText } from './eventTimers.js';
import { pixelOfLoc } from './sdSite.js';
import { MAX_ANSWERS_TELL_ME_ABOUT_OR_RUMORS } from './rumorMill.js';
import { sdMarksOf, sdEndingOf, sdOmensOf } from '../net/sdMarks.js';   // SD18c: the Ending a Hollow keeps, by its slot

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
  const E = sdEndingOf(sdMarksOf(rec.s));   // SD18c: the Ending it keeps, on its card
  const lines = [`Near ${hollow.site.cityName || 'the Iliac Bay'}`, ...(E ? [`It keeps the Ending of ${E.stone}`] : []), ...(rec.fb ? [`Found by ${rec.fb}`] : []), ...(words ? [words[0].toUpperCase() + words.slice(1)] : [])];
  return { day: rec.s, cx: hollow.site.px + 0.5, cy: hollow.site.py + 0.5, r: SD_RING_R, label: words ? `${name} - ${words}` : name, phase, tip: { title: `${name}, an Abyss Dungeon`, lines } };
}

/** The note under the red seal on every notice board while it is news - the ring's own words. */
export function sdNoticeCard(mark, cityName) {
  if (!mark) return null;
  const [name, words] = String(mark.label).split(' - ');
  const where = cityName ? `${name}, near ${cityName}.` : `${name}.`;
  return { subject: 'Abyss Dungeon', body: words ? `${where} ${words[0].toUpperCase()}${words.slice(1)}.` : where };
}

// ── SD19: THE HOLLOW'S PRESENCE (2026-10-07, Mac: "The detail needs to exceed that of the oblivion gates") ────────────
// The gate's sky burns over its region, a banner counts it down at its fire, and the chat speaks of it eight ways
// (systems/gateOmen.js); the Hollow had its column alone, three lines and a row once found. Now:
//   THE BRASS AIR: the land's haze and light lean to brass near a standing Hollow (the taverns have always said so - "the
//     air goes brass-coloured ... at dusk"), by its column's own light, the eye's distance (whole within SD_AIR.fullM,
//     gone at SD_AIR.edgeM) and the hour - strongest at dusk (sdAirWeight, sdBrassGrade, sdBrassLight).
//   THE BANNER at its door, beside its marks on the gate's own card (sdBannerText - the world's frame).
//   THE WORDS: its marks said with its find (sdMarksLine), and a found Hollow's last hour said to the realm (sdHourLine).
/** The brass air: whole within fullM metres, gone by edgeM; its most; its dusk (minute of the day, half a window,
 *  what of it stands outside the window). */
export const SD_AIR = Object.freeze({ fullM: 1000, edgeM: 8000, max: 0.55, duskAt: 1170, duskHalf: 150, base: 0.45 });
const smooth = (a, b, x) => { const k = clamp01((x - a) / (b - a)); return k * k * (3 - 2 * k); };
/** How much of the brass air reaches `d` metres from the Hollow. Pure. */
export const sdAirNear = (d) => (Number.isFinite(d) ? 1 - smooth(SD_AIR.fullM, SD_AIR.edgeM, d) : 0);
/** How much of it the hour gives - SD_AIR.base all day, whole at dusk. Pure. */
export function sdAirDusk(minute) {
  const m = ((Number(minute) || 0) % 1440 + 1440) % 1440, dm = Math.abs(((m - SD_AIR.duskAt + 720) % 1440 + 1440) % 1440 - 720);
  const k = dm >= SD_AIR.duskHalf ? 0 : 0.5 + 0.5 * Math.cos((Math.PI * dm) / SD_AIR.duskHalf);
  return SD_AIR.base + (1 - SD_AIR.base) * k;
}
/** THE BRASS AIR'S WEIGHT, 0..SD_AIR.max: the column's light (sdOmenLight), the distance's and the hour's. Pure. */
export const sdAirWeight = (light, d, minute) => SD_AIR.max * clamp01(light) * sdAirNear(d) * sdAirDusk(minute);
/** The brass the haze leans to by its own brightness, and the grade toward it - world/sdBrassSky.js since AUDIT SD III
 *  (V8), whose GLSL grades the sky the same. */
export { SD_BRASS_RAMP, sdBrassGrade } from '../world/sdBrassSky.js';
/** The light under it - each channel toward SD_BRASS_TINT by `w`; a fresh Float32Array (the renderer's light) - `rgb`
 *  itself where there is no brass and it is one already (AUDIT SD III, V15: none made every outdoor frame for nothing).
 *  Pure. */
export const SD_BRASS_TINT = Object.freeze([1.1, 0.92, 0.62]);
export const sdBrassLight = (rgb, w) => (!(w > 0) && rgb instanceof Float32Array ? rgb : new Float32Array([0, 1, 2].map((i) => rgb[i] * (1 + (SD_BRASS_TINT[i] - 1) * clamp01(w || 0)))));
/** The banner at its door: within this many metres of its centre. */
export const SD_BANNER_M = 60;
/** The banner's words: its name and its state ("fades in 1d 04h", "collapsing") - AUDIT SD III (T1): what it is is the
 *  card's beside it, and with it a long name ran the banner off both sides of a phone. */
export const sdBannerText = (name, rec, now) => { const w = sdStateWords(rec, now); return `${name || 'An Abyss Dungeon'}${w ? ` - ${w}` : ''}`; };
/** Its marks in a line, said with its find: "The Stopped Bell keeps the Ending of Sentinel - the Sunfall - under the
 *  Brazen Hide and the Short Hour." AUDIT SD III (T11): each mark's article small inside the line (net/sdLaw.js sdNameIn)
 *  - it read "under The Brazen Hide and The Short Hour". */
export function sdMarksLine({ name, s }) {
  const mk = sdMarksOf(s), E = sdEndingOf(mk), O = sdOmensOf(mk);
  return E ? `${name || 'The Abyss Dungeon'} keeps the Ending of ${E.stone} - ${sdNameIn(E.sig)} - under ${O.map((o) => sdNameIn(o.name)).join(' and ')}.` : '';
}
/** A found Hollow's last hour, said to the realm once. */
export const SD_HOUR_LEFT_MS = 60 * 60 * 1000;
export const sdHourLine = ({ name, near, region }) => `${name || 'The Abyss Dungeon'} ${sdWhere(near, region)} will fade within the hour.`;   // AUDIT SD III (T19): where, as the find's line says it

/** SD18c: what the taverns say of a Hollow by the Ending it keeps - the omen that goes with it. */
export const SD_ENDING_RUMOR = Object.freeze({
  daggerfall: 'a lion roars where there is no lion',
  sentinel: 'the sun goes down twice',
  wayrest: 'the tide comes in where there is no sea',
  orsinium: 'something heavy walks just under the earth',
  underking: 'the dead in their barrows turn their heads toward the walls',   // AUDIT SD III (T12): "toward it" - toward the air, the walls, the city?
  blades: 'a dragon\'s shadow crosses where no dragon flies',
});
/** The taverns' word of it (section 4) - SD18c: the omen its Ending sends, else the bell where there is no bell. */
export const sdRumorLine = (city, ending = null) => `They say the air goes brass-coloured past the walls of ${city} at dusk, and ${SD_ENDING_RUMOR[ending] ?? 'a bell rings where there is no bell'}.`;

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
  return sdRumorLine(hollow.site.cityName || 'the city', sdMarksOf(rec.s)[0]);
}
