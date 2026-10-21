// @ts-check
// STAR2 (2026-10-20): THE WITCHES' NIGHT - the night of the sky's own 13th of Frostfall, when the night's third star is the
// Heart-Star. Design: bible/11-Multiplayer/Starfall.md section 1.
//
// Canon, and two tables that never meant to agree: the Witches' Festival is day 283 of the year (systems/holidays.js,
// DFU's holidayDaysOfYear, its id 43 - TEXT.RSC 8349 + 43, "Today is the 13th of Frostfall, known throughout Tamriel as
// the Witches' Festival"), and day 283 is Mephala's summoning day (systems/daedraSummoning.js, DFU's
// DaedraSummoningService table). The night of the festival is the night whose dusk falls on it - "Most wise men choose not
// to wander this night." It reads the SKY (net/skyLaw.js), so it is the client's alone; the relay neither knows nor needs
// it (a Heart-Star's receipt is any star's, and what it gives more is rolled on the device - section 6).
//
// Not a DFU member. Ledger A (STARFALL).
import { skyClassicMinutes } from '../../net/skyLaw.js';
import { STAR_HOUR_MS, STAR_FALLS_MS, STAR_PER_NIGHT } from '../../net/starfall/starfallLaw.js';
import { dayOfYearFromMinutes } from '../gameDate.js';
import { HOLIDAYS, holidayDayOfYear } from '../holidays.js';

/** The festival's day of the year - the holiday table's own row (one home: systems/holidays.js). */
export const WITCHES_FESTIVAL_DAY = /** @type {number} */ (holidayDayOfYear(HOLIDAYS.Witches_Festival));
/** The star that is the Heart-Star on the Witches' Night: the night's last. */
export const HEART_STAR = STAR_PER_NIGHT - 1;

/** The sky's day of the year at night `n`'s dusk (its first star's landing). */
export const nightDayOfYear = (n) => dayOfYearFromMinutes(Math.floor(skyClassicMinutes(n * STAR_HOUR_MS + STAR_FALLS_MS[0])));
/** Whether night `n` is the Witches' Night - its dusk on the festival's day. */
export const witchesNight = (n) => nightDayOfYear(n) === WITCHES_FESTIVAL_DAY;
/** Whether star (n, k) is the Heart-Star. */
export const heartStar = (n, k) => k === HEART_STAR && witchesNight(n);
