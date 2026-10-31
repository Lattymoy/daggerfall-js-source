// @ts-check
// FRONTS (bible/03-World/World-Wide.md FRONTS): the fronts in the player's words, so a route can be planned - the Timers
// window's rows (today's two provinces and the next two days') and the travel map card's line for a place past the Bay.
// Off net/frontLaw.js and the shared clock alone. Not a DFU member.
import {
  frontLanes,
  frontStands,
  frontNextDay,
  frontDayOfMinute,
  FRONT_DAY_MINUTES,
  FRONT_PROVINCES,
} from '../net/frontLaw.js';
import { sharedClassicMinutes, wallMsForClassicMinutes } from '../net/wire.js';
import { regionOfTheatre, REGION_NAMES } from '../formats/mapsTables.js';
import { t, getLocalizedRegionName } from './textManager.js';

/** A front province's name in the player's language. @param {number} lane */
const provinceName = (lane) => {
  const r = regionOfTheatre(lane);
  return getLocalizedRegionName(r, () => REGION_NAMES[r] ?? '');
};
/** The two provinces of a day, as the words take them. @param {number} day */
const pairOf = (day) => {
  const [a = '', b = ''] = frontLanes(day).map(provinceName);
  return { a, b };
};
/** The game day a relay-clock instant stands in. @param {number} now */
export const frontDayAt = (now) => frontDayOfMinute(sharedClassicMinutes(now));
/** The relay-clock instant game day `day` begins at. @param {number} day */
export const frontDayStartMs = (day) => Math.round(wallMsForClassicMinutes(day * FRONT_DAY_MINUTES));

/**
 * THE TIMERS' ROWS: today's fronts, live to the day's end, and the next two days', coming - eventTimerRows' shape. A
 * schedule, not an event (`sched` - AUDIT FRONTS B4: never counted as under way).
 * @param {number} now relay clock
 * @returns {Array<{id: string, kind: string, title: string, where: string|null, detail: string|null, live: boolean, sched: boolean, at: number, until: number|null}>}
 */
export function frontTimerRows(now) {
  if (!Number.isFinite(now)) return [];
  const day = frontDayAt(now),
    end = frontDayStartMs(day + 1);
  return [
    {
      id: `front:${day}`,
      kind: 'front',
      title: t('fronts.timers.now', 'Past the Bay: {a} and {b}', pairOf(day)),
      where: null,
      detail: t(
        'fronts.timers.nowSub',
        'Only these provinces start gates, raids, stars and Abyss Dungeons until this runs out',
      ),
      live: true,
      sched: true,
      at: end,
      until: end,
    },
    {
      id: `front:${day + 1}`,
      kind: 'front',
      title: t('fronts.timers.next', 'Next: {a} and {b}', pairOf(day + 1)),
      where: null,
      detail: null,
      live: false,
      sched: true,
      at: end,
      until: null,
    },
    {
      id: `front:${day + 2}`,
      kind: 'front',
      title: t('fronts.timers.then', 'Then: {a} and {b}', pairOf(day + 2)),
      where: null,
      detail: null,
      live: false,
      sched: true,
      at: frontDayStartMs(day + 2),
      until: null,
    },
  ];
}

/**
 * THE MAP CARD'S LINE for a place in front province `lane`: its turn now, or when it comes in the player's own clock
 * (`whenText`, a relay-clock instant to words). Null for a place outside the fronts - the Bay's, the open zone's.
 * @param {number} now relay clock @param {number} lane @param {(ms: number) => string} whenText
 */
export function frontCardLine(now, lane, whenText) {
  if (!Number.isFinite(now) || !FRONT_PROVINCES.includes(lane)) return null;
  const day = frontDayAt(now);
  if (frontStands(day, lane)) return t('fronts.card.now', 'Gates, raids, stars and Abyss Dungeons start here now');
  return t('fronts.card.next', 'Gates, raids, stars and Abyss Dungeons start here from {when}', {
    when: whenText(frontDayStartMs(frontNextDay(day, lane))),
  });
}
