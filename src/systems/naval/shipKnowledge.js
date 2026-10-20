// @ts-check
// SPYGLASS (2026-10-11, the owner: "Removing observable names from ships and instead implementing a spyglass option where
// you can aim and view to observe other ships, their allegiance, cargo, etc." - bible/03-World/Captains-Sea.md) - WHAT A
// CAPTAIN KNOWS OF A SHIP, AND HOW. A sail on the horizon is a hull and a rig - "a galleon", "a sloop" - and nothing more:
// no name hangs over her, no colour on her bar says friend or foe. Knowledge is earned, ship by ship, and kept while she
// is in the sea:
//
//   KNOW.hull      what the eye sees at any range - her hull's kind, her way, her smoke
//   KNOW.colours   her colours (the flag she flies), her name and her trade - read by the naked eye within NAKED_EYE_M,
//                  called by a Lookout aboard within LOOKOUT_ID_M (his worth further - shipCrew.js crewWorth `sight`), or
//                  made out through the glass within GLASS_FAR_M held on her GLASS_STUDY_S
//   KNOW.studied   her guns, her hands, her hurts, her hold, a bounty on her - made out through the glass within
//                  GLASS_NEAR_M held on her GLASS_STUDY_NEAR_S; and everything once she strikes, is boarded or is taken
//
// By night the glass reaches no farther than shipWatch.js nightSight lets a lookout: a lit ship far, a dark one close -
// and the naked eye reads a dark ship's colours closer still (NAKED_EYE_DARK_M). What
// a ship DOES tells too: her guns run out on me (`revealed` - hostile), a crown's ship come to my aid, a boarding.
//
// FALSE COLOURS. DECEIT_SHARE of the wary pirates (never a flagship, never a raider of Warm Ashes', never a hand-launched
// foe) fly a merchant's colours - a crown's, by their seed on its own stream: read from afar they are merchantmen, with
// a merchantman's friendly bar. The glass held close (KNOW.studied) sees through them - too many gunports for a trader -
// and so does her own first broadside: she runs up the black flag.
//
// Pure: the host (scenes/naval/navalHost.js) keeps a ship's knowledge on her entry and asks this module what it has become
// and what to say; the glass's window is ui/spyglassView.js.

import { mulberry32 } from '../../combat/blood/bloodArt.js';
import { CROWNS, HULL, batteriesOf, GUNS, SHIP_CLASSES } from './navalShips.js';
import { nightSight } from './shipWatch.js';

export const KNOW = Object.freeze({ hull: 0, colours: 1, studied: 2 });
/** The naked eye reads her colours and the name on her transom this close (m) - by night a dark ship's only within
 *  NAKED_EYE_DARK_M (her lanterns light them to the day's reach). */
export const NAKED_EYE_M = 220;
export const NAKED_EYE_DARK_M = 100;
/** A Lookout aboard calls her colours this close (m), times his worth (shipCrew.js crewWorth `sight`). */
export const LOOKOUT_ID_M = 320;
/** Through the glass by day: her colours this far, her guns, hands and hold this close (m) - times her Lookout's worth.
 *  The far reach is inside navalDirector.js DESPAWN_BEYOND (1,900 m): a sail the glass can find is one the sea still holds. */
export const GLASS_FAR_M = 1800;
export const GLASS_NEAR_M = 900;
/** The glass held on her this long (s, the glass's own clock) for her colours, and this long for the rest. */
export const GLASS_STUDY_S = 0.6;
export const GLASS_STUDY_NEAR_S = 1.4;
/** The glass's magnification: what it first opens at (AUDIT CAPTAIN'S SEA S23: after, the one it was last turned to - the
 *  captain's own, kept between raises), and the least and most the wheel turns it to. */
export const GLASS_ZOOM = 4;
export const GLASS_ZOOM_MIN = 2;
export const GLASS_ZOOM_MAX = 8;
/** The reticle's half-width at no magnification (degrees) - a ship within it, or her hull wider than it, is held. */
export const RETICLE_DEG = 4;
/** False colours: the share of wary pirates that fly a merchant's, and their own stream's salt. */
export const DECEIT_SHARE = 0.35;
export const DECEIT_SALT = 0xfa15e;
/** Knots a metre a second (the sea's own measure, on the card). */
export const KNOTS = 1.944;

/** The words a hull is called by before her colours are read. */
// AUDIT CAPTAIN'S SEA S22: the small ship's hull is a brigantine, a galleon and a cutter by her class - her kind from afar
// is what all three are, a two-master ("Unknown galleon" made out a Pirate Brigantine)
export const HULL_WORDS = Object.freeze({ [HULL.Rowboat]: 'rowboat', [HULL.LargeBoat]: 'sloop', [HULL.SmallShip]: 'two-master', [HULL.LargeGalley]: 'galley', [HULL.Carrack]: 'carrack' });
export const hullWord = (hull) => HULL_WORDS[hull] ?? 'ship';
/** "a galleon" / "an unknown galleon". */
export const aHull = (hull) => `${/^[aeiou]/.test(hullWord(hull)) ? 'an' : 'a'} ${hullWord(hull)}`;
export const unknownName = (hull) => `Unknown ${hullWord(hull)}`;

/** AUDIT CAPTAIN'S SEA S5: the trader a disguised pirate passes for - the merchant class of her own hull (a sloop a
 *  Coasting Trader, a brigantine a Merchant Galleon) - or null: a galley has no merchant sister, and never disguises. */
export const merchantOfHull = (hull) => SHIP_CLASSES.find((c) => c.faction === 'merchant' && c.hull === hull) ?? null;
/**
 * A pirate's false colours: the crown whose merchant flag she flies - DECEIT_SHARE of wary pirates, by their seed on
 * DECEIT_SALT's stream (the same on every client) - or null. Never a flagship, a bold pirate (she has no need to hide),
 * nor a ship the host marks plain (`plain`: a raider, a hand-launched foe), nor a hull no trader sails (a galley).
 * @param {{ faction: string, flagship?: boolean, hull?: number }} cls @param {number} seed @param {string} temper @param {{ plain?: boolean }} [o]
 */
export function falseFlagOf(cls, seed, temper, { plain = false } = {}) {
  if (!cls || cls.faction !== 'pirate' || cls.flagship || temper !== 'wary' || plain || !merchantOfHull(cls.hull)) return null;
  const r = mulberry32(((seed >>> 0) ^ DECEIT_SALT) >>> 0);
  if (!(r() < DECEIT_SHARE)) return null;
  return CROWNS[Math.floor(r() * CROWNS.length) % CROWNS.length].name;
}

/**
 * How far the glass and the eye reach her: `far` (her colours), `near` (the rest), `eye` (the naked eye's colours) and
 * `lookout` (a Lookout's call, 0 with none aboard) - by day as they are, by night as nightSight lets each (a lit ship far,
 * a dark one close), each times `sight` (her Lookout's worth).
 * @param {{ night?: boolean, lit?: boolean, sight?: number, lookout?: boolean }} o
 */
export function glassReach({ night = false, lit = false, sight = 1, lookout = false } = {}) {
  const k = Math.max(1, Number(sight) || 1);
  const at = (m) => nightSight(m * k, { night, lit });
  return { far: at(GLASS_FAR_M), near: at(GLASS_NEAR_M), eye: night && !lit ? NAKED_EYE_DARK_M : NAKED_EYE_M, lookout: lookout ? at(LOOKOUT_ID_M) : 0 };
}

/**
 * THE KNOWLEDGE A FRAME EARNS: her knowledge now (`known`, KNOW's), raised by what reaches her this frame - the naked eye
 * or a Lookout within their reach (colours), the glass held on her `held` seconds within its reach (colours past
 * GLASS_STUDY_S, studied past GLASS_STUDY_NEAR_S within `near`), her own acts (`revealed`: colours; `struck`: studied).
 * Never lowered. Answers the new level.
 * @param {number} known @param {{ dist: number, reach: ReturnType<typeof glassReach>, held?: number, revealed?: boolean, struck?: boolean }} o
 */
export function knowledgeOf(known, { dist, reach, held = 0, revealed = false, struck = false }) {
  let k = Math.max(KNOW.hull, Math.min(KNOW.studied, known | 0));
  if (struck) return KNOW.studied;
  if (revealed || dist <= reach.eye || dist <= reach.lookout) k = Math.max(k, KNOW.colours);
  if (held >= GLASS_STUDY_S && dist <= reach.far) k = Math.max(k, KNOW.colours);
  if (held >= GLASS_STUDY_NEAR_S && dist <= reach.near) k = KNOW.studied;
  return k;
}

/**
 * Whether the glass holds her: the look's angle off her (radians) within her extent at her range (`half`, m: her hull as
 * she lies to the look - the host's), or within the reticle's at the glass's magnification - whichever is wider - and
 * AUDIT CAPTAIN'S SEA S19 never past the glass's own circle (`field`, radians: the tube's radius at the lens drawn).
 * @param {number} angle @param {number} dist @param {number} half (m) @param {number} zoom @param {number} [field]
 */
export const glassHolds = (angle, dist, half, zoom, field = Math.PI) => angle <= Math.min(field, Math.max(Math.atan2(Math.max(1, half), Math.max(1, dist)), (RETICLE_DEG * Math.PI / 180) / Math.max(1, zoom)));

/** Her colours in words, as the card says them - the flag seen, false or true. */
export function coloursWords(faction, flag) {
  if (faction === 'pirate' && !flag) return 'the black flag';
  if (faction === 'navy') return `${own(flag ?? 'a crown')} royal ensign`;
  return `${own(flag ?? 'a trader')} merchant colors`;   // ETHER-SEA: "the Isles' merchant colours"
}
/** A name's possessive: "Wayrest's", "the Isles'". */
const own = (name) => (/s$/.test(name) ? `${name}'` : `${name}'s`);
/** How she rides, by her hold's worth (1-4: her class's cargo and the tiers her waters add, clamped) - AUDIT CAPTAIN'S
 *  SEA S20: 0 (or less) a hold emptied. */
export function cargoWords(cargo) {
  if (!(cargo > 0)) return 'riding high - hold empty';
  const c = Math.max(1, Math.min(4, cargo | 0));
  return ['riding high, a light hold', 'riding easy - some cargo', 'riding low, a full hold', 'riding deep, a rich hold'][c - 1];
}
/** Her guns in words, off her hull's batteries: "10 long guns, 2 chain chasers, fire barrels astern". */
export function gunsWords(hull) {
  const bats = batteriesOf(hull);
  if (!bats.length) return 'no guns';
  const broad = bats.filter((b) => b.side === 'starboard' || b.side === 'port').reduce((n, b) => n + b.muzzles.length, 0);
  const parts = [];
  const g0 = bats.find((b) => b.side === 'starboard' || b.side === 'port');
  if (broad) parts.push(`${broad} ${GUN_WORDS[g0.gun]?.[broad === 1 ? 0 : 1] ?? 'guns'}`);
  const bow = bats.find((b) => b.side === 'bow');
  const kind = (g) => (g === 'chain' ? 'chain' : g === 'heavy' ? 'great' : g);
  if (bow) parts.push(bow.muzzles.length === 1 ? `${/^[aeiou]/.test(kind(bow.gun)) ? 'an' : 'a'} ${kind(bow.gun)} gun forward` : `${bow.muzzles.length} ${kind(bow.gun)} guns forward`);
  const stern = bats.find((b) => b.side === 'stern');
  if (stern) parts.push(stern.gun === 'barrel' ? 'fire barrels astern' : `${stern.muzzles.length} stern ${stern.muzzles.length === 1 ? 'gun' : 'guns'}`);
  return parts.join(', ');
}
const GUN_WORDS = Object.freeze({ long: ['long gun', 'long guns'], swivel: ['swivel', 'swivels'], heavy: ['great gun', 'great guns'], chain: ['chain gun', 'chain guns'] });
/** About how many hands she carries (to the nearest five, the least one). */
export const handsWords = (crew) => (crew <= 0 ? 'no hands' : crew < 1.5 ? 'a hand' : crew < 2.5 ? 'a hand or two' : `about ${Math.round(crew / 5) * 5} hands`);   // AUDIT CAPTAIN'S SEA S18: never "about 1 hands"
/** What she is about, in words: her stance to me and her temper. */
export function mindWords({ hostile = false, faction = null, temper = null, mode = null, bound = '' } = {}) {
  if (hostile) return mode === 'board' ? 'Closing to board you!' : 'Heading straight for you!';
  if (faction === 'pirate') return temper === 'bold' ? 'Bold. Attacks any target' : 'Wary. Picks its targets carefully';
  if (bound) return `${bound[0].toUpperCase()}${bound.slice(1)}`;
  return faction === 'navy' ? 'On the crown\'s business' : 'Holding course';
}

/**
 * THE GLASS'S CARD: what is known of her, as the glass's window says it - `{ title, sub, rows: [[label, text]], tone,
 * study }`. At KNOW.hull her hull and her way; at KNOW.colours her name, her colours (her false ones, while they hold),
 * her class's line and her mind; at KNOW.studied her guns, hands, hurts and hold, a bounty, false colours seen through.
 * `study` the share of the glass's study done (0..1) while she is being made out; `within` (m) the range the next lesson
 * wants, while she lies past it - said as the card's `hint`.
 * @param {any} f - her facts: { hull, name, classLine, faction, flag, falseFlag, temper, mode, hostile, friendly, bound,
 *   distance, speed, crew, hullShare, sailShare, fire, cargo, bounty, lore }
 * @param {number} known @param {{ study?: number, within?: number|null }} [o]
 */
export function glassCard(f, known, { study = 0, within = null } = {}) {
  const hint = within != null && known < KNOW.studied ? `Close within ${Math.round(within)} m to make out ${known < KNOW.colours ? 'its colours' : 'its guns and hold'}` : '';
  const rows = [];
  const way = f.speed > 0.4 ? `making ${Math.round(f.speed * KNOTS)} knots` : 'lying still';
  if (known <= KNOW.hull) {
    rows.push(['Range', `${Math.round(f.distance)} m`], ['Way', way]);
    return { title: unknownName(f.hull), sub: 'Colors not yet identified', rows, tone: 'unknown', study, hint };   // AUDIT CAPTAIN'S SEA S11: nothing of her stance - not even a red title
  }
  const disguised = !!f.falseFlag && known < KNOW.studied && !f.hostile;
  const faction = disguised ? 'merchant' : f.faction;
  const colours = coloursWords(faction, disguised ? f.falseFlag : f.flag);
  rows.push(['Colours', colours], ['Range', `${Math.round(f.distance)} m - ${way}`], ['Bearing', mindWords({ hostile: f.hostile, faction, temper: f.temper, mode: f.mode, bound: disguised ? '' : f.bound })]);
  if (known >= KNOW.studied) {
    if (f.falseFlag) rows.unshift(['False colors', 'Too many gunports for a trader. This is a pirate']);
    rows.push(['Guns', gunsWords(f.hull)], ['Hands', handsWords(f.crew)], ['Hurts', `hull ${Math.round(f.hullShare * 100)}%${f.sailShare != null ? `, canvas ${Math.round(f.sailShare * 100)}%` : ''}${f.fire ? ' - burning' : ''}`], ['Hold', cargoWords(f.cargo)]);
    if (f.bounty) rows.push(['Wanted', f.bounty]);
    if (f.lore) rows.push(['Lore', f.lore]);
  }
  const name = disguised ? f.falseName ?? `A merchantman of ${f.falseFlag}` : f.name;   // AUDIT CAPTAIN'S SEA S5: the trader she passes for
  return { title: name, sub: disguised ? f.falseLine ?? 'Merchantman' : f.classLine, rows, tone: f.hostile ? 'hostile' : faction === 'pirate' ? 'pirate' : f.friendly || disguised ? 'friendly' : 'neutral', study: known >= KNOW.studied ? 1 : study, hint };
}
