// @ts-check
// SHIPYARDS (2026-10-11; asked how the crew recruitment station works, Mac chose "Pick named recruits - a recruiter
// keeps a daily roster of named sailors - class, trade (Gunner, Carpenter, Lookout...), green or seasoned, a signing fee.
// You choose who joins which ship and at what post"): THE CREW HALL - THE LAW. Its hall stands inside a port town's
// shipyard (systems/portPlaces.js, world/shipyardModel.js); its window is the shipmaster's (ui/shipyardWindow.js, Crew
// Hall). Not a DFU member - Daggerfall has no ships and Come Sail Away's crew is a count. Ledger A (SHIPYARDS).
//
// THE ROSTER (`recruitsOf`): RECRUITS_A_DAY sailors at a town's hall each day of the world's clock, drawn off a seed of
// the town's map id and the day (every client in the town meets the same hall the same day): each a NAME on the
// region's bank (NameHelper.FullName - DFU's stream put back, as every keeper's), a sex, a CLASS of the crews' own
// (crewLife.js PLAYER_CREW - the one her deck stands each hand as), a GRADE - green, able, seasoned or veteran - and the
// fights and boardings he has stood, and a TRADE: the post he signs on for (shipCrew.js CREW_ROLES; a Bard keeps his
// calling). A First Mate is seasoned at the least and a Bosun able. His SIGNING FEE is his grade's, times his trade's
// premium: never under a shipwright's hand (REPAIR_PRICE.crew a man's share of her crew, CREW_PER_HAND of it), and a
// hire that raises her crew by more men than that pays the shipwright's price for every man it raises (`hireCharge`), so
// no recruit is the cheaper way to fill her. A recruit already serving a ship of the player's is not on the roster (the
// host hands their hall ids - AUDIT SHIPYARDS L2-9: by id, never by name, so a hand who merely shares a recruit's name
// hides nobody); paid off, he is back at the hall.
//
// SIGNING ON (`enlistPlan`): a crewed hull's NAMED hands are the men her deck stands (crewLife.js playerCrewCount: a man
// a CREW_PER_HAND of her crew, CREW_SHOWN at most), so a recruit takes a place on her deck: her crew raised to the share
// that stands one more man, and never past her whole. A ship whose deck stands every man her whole crew can - a Small
// Ship's four, a Carrack's five, a Large Galley's eight, and so every ship as she is bought - is FULL (AUDIT SHIPYARDS
// L7-2): a recruit signs on IN PLACE OF a hand the player names, who is paid off - one man for another, her crew as it
// was. He joins at his trade's post (a First Mate: the one she had stands down to Deckhand - shipCrew.js assign's law),
// his record with him, and a seasoned man steadies a crew (`lift`, her spirits - given back when he leaves).
//
// PAID OFF (`releasePlan`): a named hand leaves her - not one ashore at the player's side - and her crew falls by a man's
// share. No fee comes back. Where her crew still stands as many on her deck (a galley's sixty stand eight), another of
// her men steps up into the place, and the hall says who (AUDIT SHIPYARDS L2-1). The last of her crew is never paid off:
// a ship with nobody aboard strikes (navalDamage.js `unmanned`).
//
// Pure: no DOM, no clock (the host hands the day). Its seeds its own (mulberry32 on hash32), the global stream put back.
import { hash32 } from '../world/spawnedDungeons.js';
import { mulberry32 } from '../combat/blood/bloodArt.js';
import { residentName } from './livingWorld/census.js';
import { getNameBankOfRegion, GENDERS } from '../characters/nameHelper.js';
import { PLAYER_CREW, playerCrewCount, CREW_SHOWN } from './naval/crewLife.js';
import { CREW_PER_HAND, MOBILE } from './naval/navalBoarding.js';
import { CREW_ROLES, FIRST_MATE } from './naval/shipCrew.js';
import { REPAIR_PRICE } from './naval/navalDamage.js';

/** How many sailors a hall has each day. */
export const RECRUITS_A_DAY = 6;
/** The roster's own salt on the town and the day. */
export const CREW_HALL_SALT = 0xc4e7;
/** A man's share of her crew at the shipwright's (gold) - the least a recruit's fee comes to. */
export const HAND_PRICE = REPAIR_PRICE.crew * CREW_PER_HAND;

/**
 * The grades, greenest first: `fee` a signing fee's ground (gold), `fights` and `boardings` the range of his record,
 * `lift` what his signing on lifts her crew's spirits by, `weight` how often a hall has one.
 */
export const RECRUIT_GRADES = Object.freeze([
  Object.freeze({ key: 'green', label: 'Green', fee: 180, fights: Object.freeze([0, 0]), boardings: Object.freeze([0, 0]), lift: 0, weight: 4 }),
  Object.freeze({ key: 'able', label: 'Able', fee: 260, fights: Object.freeze([1, 4]), boardings: Object.freeze([0, 2]), lift: 2, weight: 4 }),
  Object.freeze({ key: 'seasoned', label: 'Seasoned', fee: 420, fights: Object.freeze([5, 12]), boardings: Object.freeze([2, 5]), lift: 4, weight: 2 }),
  Object.freeze({ key: 'veteran', label: 'Veteran', fee: 700, fights: Object.freeze([13, 30]), boardings: Object.freeze([6, 14]), lift: 6, weight: 1 }),
]);
/** A grade by its key, or null. */
export const gradeOf = (key) => RECRUIT_GRADES.find((g) => g.key === key) ?? null;
/** Each trade's premium on the grade's fee, and the least grade that takes it (its index in RECRUIT_GRADES). */
export const RECRUIT_TRADES = Object.freeze({
  [FIRST_MATE]: Object.freeze({ premium: 1.6, least: 2, weight: 1 }),
  Bosun: Object.freeze({ premium: 1.3, least: 1, weight: 1 }),
  Gunner: Object.freeze({ premium: 1.2, least: 0, weight: 3 }),
  Carpenter: Object.freeze({ premium: 1.2, least: 0, weight: 2 }),
  Lookout: Object.freeze({ premium: 1, least: 0, weight: 2 }),
  Cook: Object.freeze({ premium: 1, least: 0, weight: 1 }),
  Deckhand: Object.freeze({ premium: 1, least: 0, weight: 3 }),
  Bard: Object.freeze({ premium: 1.1, least: 0, weight: 0 }),
});
/** The crews' classes in words (crewLife.js PLAYER_CREW's). */
export const CLASS_WORDS = Object.freeze({
  [MOBILE.Warrior]: 'Warrior', [MOBILE.Barbarian]: 'Barbarian', [MOBILE.Bard]: 'Bard', [MOBILE.Archer]: 'Archer',
  [MOBILE.Monk]: 'Monk', [MOBILE.Rogue]: 'Rogue',
});

/** What a recruit says of himself, by his grade (one of each set, off his own draw). */
export const RECRUIT_LINES = Object.freeze({
  green: Object.freeze(['Never been to sea, but I learn quick.', 'I can haul a line as well as any man.', 'My da fished the bay. I want more than nets.', 'Give me a chance, Captain.']),
  able: Object.freeze(['A few voyages behind me, and no complaints.', 'I know my knots and I keep my watch.', 'Served on a coaster out of Wayrest.', 'Steady hands, steady stomach.']),
  seasoned: Object.freeze(['Twelve years before the mast.', 'I\'ve stood off pirates more than once.', 'Name the port, I\'ve weathered it.', 'I know what a ship needs before the captain does.']),
  veteran: Object.freeze(['I sailed with the Sentinel fleet in the war.', 'Boarded more decks than you\'ve walked, Captain.', 'Old salt, but there\'s a fight in me yet.', 'Every storm on the Iliac Bay knows my name.']),
});

/** A grade drawn by weight. @param {() => number} r */
function drawGrade(r) {
  const total = RECRUIT_GRADES.reduce((n, g) => n + g.weight, 0);
  let x = r() * total;
  for (const g of RECRUIT_GRADES) { x -= g.weight; if (x < 0) return g; }
  return RECRUIT_GRADES[0];
}
/** A trade drawn by weight among those his grade takes. @param {() => number} r @param {number} gradeIndex */
function drawTrade(r, gradeIndex) {
  const open = Object.entries(RECRUIT_TRADES).filter(([, t]) => t.weight > 0 && t.least <= gradeIndex);
  const total = open.reduce((n, [, t]) => n + t.weight, 0);
  let x = r() * total;
  for (const [k, t] of open) { x -= t.weight; if (x < 0) return k; }
  return 'Deckhand';
}
/** A whole number in [lo, hi]. @param {() => number} r @param {readonly number[]} range */
const between = (r, [lo, hi]) => lo + Math.floor(r() * (hi - lo + 1));

/** What a hire costs (gold): his fee, or the shipwright's price for the men it raises her crew by when that is more -
 *  `raise` enlistPlan's (none for a hand signed in another's place). AUDIT SHIPYARDS L2-2. */
export const hireCharge = (fee, raise = 0) => Math.max(Math.max(0, fee | 0), Math.max(0, raise | 0) * REPAIR_PRICE.crew);
/** The day a recruit's id was drawn for, or NaN. */
export const recruitDay = (id) => Number(String(id ?? '').split(':')[1] ?? NaN);

/** A recruit's signing fee (gold): his grade's ground times his trade's premium, to ten gold, never under HAND_PRICE. */
export function recruitFee(grade, trade) {
  const g = typeof grade === 'string' ? gradeOf(grade) : grade;
  const p = RECRUIT_TRADES[trade]?.premium ?? 1;
  return Math.max(HAND_PRICE, Math.round(((g?.fee ?? HAND_PRICE) * p) / 10) * 10);
}

/**
 * A TOWN'S HALL ON A DAY: its RECRUITS_A_DAY sailors, the same on every client - `{ id, name, gender, sex, mobile,
 * className, grade, gradeLabel, trade, fights, boardings, fee, lift, line }` each. `serving` the hall ids of the recruits
 * already signed on a ship of the player's (none of them is offered). Pure (DFU's global stream put back by the name's
 * draw).
 * @param {{ mapId: number, day: number, regionIndex?: number, serving?: Iterable<string>|null }} o
 */
export function recruitsOf({ mapId, day, regionIndex = -1, serving = null }) {
  const r = mulberry32(hash32(mapId >>> 0, Math.max(0, Math.floor(Number(day) || 0)) >>> 0, CREW_HALL_SALT));
  const bank = getNameBankOfRegion(Number.isInteger(regionIndex) ? regionIndex : -1);
  const taken = new Set(serving ?? []);
  const out = [];
  for (let i = 0; i < RECRUITS_A_DAY; i++) {
    const mobile = PLAYER_CREW[Math.floor(r() * PLAYER_CREW.length)];
    const female = r() < 0.35;
    const gi = RECRUIT_GRADES.indexOf(drawGrade(r));
    const grade = RECRUIT_GRADES[gi];
    const trade = mobile === MOBILE.Bard ? 'Bard' : drawTrade(r, gi);
    const name = residentName(Math.floor(r() * 0xffffffff) >>> 0, bank, female ? GENDERS.Female : GENDERS.Male);
    const lines = RECRUIT_LINES[grade.key];
    const rec = {
      id: `${mapId >>> 0}:${Math.floor(Number(day) || 0)}:${i}`, name, gender: female ? GENDERS.Female : GENDERS.Male, sex: female ? 'female' : 'male', mobile,
      className: CLASS_WORDS[mobile] ?? 'Sailor', grade: grade.key, gradeLabel: grade.label, trade,
      fights: between(r, grade.fights), boardings: between(r, grade.boardings), fee: recruitFee(grade, trade), lift: grade.lift,
      line: lines[Math.floor(r() * lines.length)],
    };
    if (!taken.has(rec.id)) out.push(rec);
  }
  return out;
}

/**
 * WHETHER A SHIP HAS A PLACE FOR ANOTHER NAMED HAND, and her crew once he is aboard: `hull` hers, `crew` and `maxCrew`
 * her crew now and whole, `hands` her named hands now. Answers `{ ok: true, crew, raise, full: false }` (her crew raised
 * to the share that stands one more man - never past her whole - `raise` the men it adds) or `{ ok: false, why, full }`:
 * `full` when her deck already stands every man her whole crew can (a recruit then signs on in a hand's place). Pure.
 * @param {{ hull: number, crew: number, maxCrew: number, hands: number }} o
 */
export function enlistPlan({ hull, crew, maxCrew, hands }) {
  if (!((CREW_SHOWN[hull] ?? 0) > 0) || !(maxCrew > 0)) return { ok: false, full: false, why: CREW_HALL_TEXT.noCrew };
  const n = Math.max(0, hands | 0);
  if (n >= playerCrewCount(hull, maxCrew)) return { ok: false, full: true, why: CREW_HALL_TEXT.full };
  const now = Math.max(0, Number(crew) || 0);
  const next = Math.min(maxCrew, Math.max(now, (n + 1) * CREW_PER_HAND));
  if (playerCrewCount(hull, next) !== n + 1) return { ok: false, full: false, why: CREW_HALL_TEXT.noPlace };
  return { ok: true, full: false, crew: next, raise: next - now };
}
/**
 * A named hand paid off: her crew once he is gone - a man's share less. The last of her crew is not paid off (a ship
 * with nobody aboard strikes). Answers `{ ok, crew, why? }`. Pure.
 * @param {{ crew: number }} o
 */
export const releasePlan = ({ crew }) => (crew > CREW_PER_HAND ? { ok: true, crew: crew - CREW_PER_HAND } : { ok: false, crew: Math.max(0, crew), why: CREW_HALL_TEXT.lastMan });

/** A trade the hall signs a man on for (shipCrew.js CREW_ROLES, and a Bard's calling). */
export const isRecruitTrade = (t) => /** @type {readonly string[]} */ (CREW_ROLES).includes(t) || t === 'Bard';

/** The hall's words: a hire, a refusal, a pay-off. */
export const CREW_HALL_TEXT = Object.freeze({
  signed: (who, trade, ship) => `${who} signs on to ${ship} as ${trade}.`,
  swapped: (who, trade, ship, out) => `${who} signs on to ${ship} as ${trade}, replacing ${out}. ${out} is paid off.`,
  short: (fee) => `Hiring costs ${fee.toLocaleString('en-US')} gold. You don't have enough.`,
  gone: 'That sailor has signed on elsewhere.',
  newDay: 'The crewmaster has a new day\'s roster.',
  paidOff: (who, ship) => `${who} is paid off and leaves ${ship}.`,
  steppedUp: (who, ship, next) => `${who} is paid off and leaves ${ship}. ${next} takes the open place on deck.`,
  lastMan: 'That\'s your last crew member. The ship would have nobody aboard.',
  full: 'The crew is full. Sign a recruit on in place of someone already aboard.',
  noPlace: 'There\'s no room on deck for another named crew member.',
  noCrew: 'This ship has no crew to sign anyone on to.',
  sameName: (who) => `The crew already has someone named ${who}.`,
  fighting: 'Not while the ship is in combat.',
  ashore: (who) => `${who} is ashore with you. Send them back aboard first.`,
  noShip: 'You have no crewed ship here. Bring it to this port, or lay it up.',
  noSea: 'Turn on Naval Combat to hire crew at the crew halls.',
});
