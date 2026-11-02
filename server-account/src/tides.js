// @ts-check
// SEASON1 part two (2026-10-01, Mac: "Finish the seats"; "Continue"; "Hurry up"): THE TIDE AT A REGION NOW, as the service
// reckons it (bible/11-Multiplayer/Seats-Arc.md 9.3) - the seat week's Tide at the region's land, while a Season is
// counted (the service's SEASON_ZERO_WEEK); Calm before. The roll is src/net/tideLaw.js's; the professions' yields and the
// market's couriers ask it here.
import { seatWeekOf, seasonOf, seasonZeroOf } from '../../src/net/townSeatLaw.js';
import { tideAt } from '../../src/net/tideLaw.js';

/** The Tide at `region` at `nowS` - a Tide's id, 'calm' where no Season is counted. */
export function tideNow(env, nowS, region) {
  const week = seatWeekOf(nowS * 1000);
  return tideAt(week, region, !!seasonOf(week, seasonZeroOf(env?.SEASON_ZERO_WEEK)));
}
