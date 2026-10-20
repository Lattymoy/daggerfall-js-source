// @ts-check
// ═══════════════════════════════════════════════════════════════════
// HOME-VOTE (2026-10-10) — A TOWN'S WORD ON A PLAYER'S HOUSE.
//
// The owner: "I want to implement a house voting system within vicinity
// of player houses. If the house votes run negative, the exterior
// decorations/interior decorations should not be shown to other players".
//
// A VOTE is one registered account's word on one online home (a guild's
// hall among them): up (+1) or down (-1), changed or taken back (0) at
// will, never more than one standing an account. A home's SCORE is its
// votes summed; while it runs down to HOME_SHUN_AT (-5 - HOME-SHUN) the home is SHUNNED, and what its
// owner chose to show stands for its insiders alone - every other player
// walks into the room Daggerfall furnished (no placed piece but a hired
// trader with goods on sale, nothing taken out - AUDIT HOME-VOTE B2, II
// A1), past a yard with nothing in it and a house in its town's own
// paint (homeDecorShown). Nothing is deleted: a vote turned round shows it
// all again, and the owner never stops seeing their own.
//
// Cast at the house itself - its door's plaque (scenes/worldModes.js), so
// a vote is the word of somebody standing at it; kept on the account
// service (server-account/src/homeVotes.js, migration 0108), which reads it
// out with the town's homes. Pure: no clock, no DOM, no network.
// ═══════════════════════════════════════════════════════════════════
import { WITNESS } from './nodeLaw.js';   // AUDIT HOME-VOTE A1: an account a week registered, as a witness is

/** The votes an account may stand on a home - down and up; 0, sent, takes its vote back. */
export const HOME_VOTE_DOWN = -1;
export const HOME_VOTE_UP = 1;
/** Whether `v` is a vote the service takes: -1, +1, or 0 (withdrawn). */
export const homeVoteOk = (v) => v === HOME_VOTE_DOWN || v === HOME_VOTE_UP || v === 0;
/** How many votes an account may cast an hour - a walk down a street of houses, never a script (AUDIT HOME-VOTE A1:
 *  30, where it was 120 - one account's whole town an hour, and a few hundred accounts' every town). */
export const HOME_VOTES_MAX = 30;
export const HOME_VOTES_WINDOW_S = 3600;
/** AUDIT HOME-VOTE A1: HOW OLD AN ACCOUNT MUST BE TO VOTE - registered a week (WITNESS.ageS, the seats' and the
 *  market's witness's own bar). A registered account is two calls from a fresh browser, and one down-vote hides a home
 *  nobody has voted up: sixty accounts an address a quarter-hour, each with its votes, hid every home in every town. */
export const HOME_VOTE_AGE_S = WITNESS.ageS;
/** AUDIT HOME-VOTE II A4: WHOSE HOUSE A VOTE MEANT - the door's `owner` as the town answered it (a home's owner, a hall's
 *  guild), sent with every vote cast: it lands only while that is who holds the house, never on the next owner's after a
 *  sale the reader's door had not heard of yet. */
export const HOME_VOTE_OWNER_MAX = 64;
export const homeVoteOwnerOk = (o) => typeof o === 'string' && o.length > 0 && o.length <= HOME_VOTE_OWNER_MAX;

/** A home's score as the service answers it (its votes summed), 0 for none or a word that is no number. */
export const homeScoreOf = (raw) => (Number.isSafeInteger(raw) ? raw : 0);
/** An account's own vote on a home as the service answers it - -1, +1, or 0 for none. */
export const homeMyVoteOf = (raw) => (raw === HOME_VOTE_DOWN || raw === HOME_VOTE_UP ? raw : 0);
/** HOME-SHUN (2026-10-12, from play: "-1 is a bit crazy since you START at 0 when you buy a house... hide placements
 *  from everyone starting at like -5, -10"): THE SCORE AT WHICH A HOME IS SHUNNED - five votes down, net. One account's
 *  down-vote on a new house nobody had seen yet hid it, and a hidden house is one nobody sees to vote up; a home now
 *  hides only when the town's word against it outweighs it by five. */
export const HOME_SHUN_AT = -5;
/** THE LAW: a home whose votes run down to HOME_SHUN_AT is shunned. */
export const homeShunned = (score) => homeScoreOf(score) <= HOME_SHUN_AT;

/**
 * WHETHER A HOME'S DECOR STANDS FOR THE PLAYER LOOKING - its placed pieces inside and out, the furniture its owner took
 * out, and the paint on its outside. Always for its INSIDERS: the owner's own account (`mine` - any of its characters)
 * and, for a guild's hall, an account with any character in its guild (`insider` - AUDIT A5: the service's own line, the
 * account's as `mine` is; `member`, the playing character's, is one of them); for everyone else, unless the home is
 * shunned. `home` is the client's registry row (systems/online/onlineHomes.js homeAt); none - not an online home - shows what
 * stands.
 */
export function homeDecorShown(home) {
  if (!home) return true;
  if (home.mine === true || home.member === true || home.insider === true) return true;
  return !homeShunned(home.score);
}

/** AUDIT HOME-VOTE B2: WHAT OF A SHUNNED HOME STILL STANDS for everyone - its hired trader (HOME-VENDOR's `vendor`
 *  station): a shop, never a decoration. Hidden, its goods stood listed on the town's Vendors board, a Waypoint led to an
 *  empty room, and the town's patrons (LW15) bought at a trader nobody could see. The service hands it out (decor.js
 *  decorOf - AUDIT HOME-VOTE II A1: only a trader with goods on sale at it; any piece may be made one, and a licence
 *  bought for a statue kept it standing) and the room stands what it is handed (worldModes.js loadHomeDecor). */
export const decorStaysShunned = (piece) => piece?.station === 'vendor';

/** The score as the plaque says it: +3, 0, -2. */
export const homeScoreText = (score) => {
  const n = homeScoreOf(score);
  return n > 0 ? `+${n}` : String(n);
};
/** The door's line under a voted home, to anyone who may vote on it: its score, and the reader's own vote. */
export const homeVotesLine = (score, mine = 0) => `Votes: ${homeScoreText(score)}${mine === HOME_VOTE_UP ? ' (you voted up)' : mine === HOME_VOTE_DOWN ? ' (you voted down)' : ''}`;
/** What a shunned home's insiders are told at its door - its decor hidden from everyone else until its score climbs. */
export const homeShunnedInsiderLine = (score, hall = false) => `Votes: ${homeScoreText(score)}. ${hall ? "Your hall's" : "Your home's"} decorations are hidden from other players.`;
/** What a visitor is told at a shunned home's door. */
export const HOME_SHUNNED_LINE = 'Its decorations are hidden: the town has voted it down.';
/** A vote refused in its own words where the home door's would mislead - a guest's (the route's wall says owning a home
 *  needs an account), a home nobody holds now (the door's word is "not yours any more") - else null. */
export const homeVoteRefusalLine = (error) => (error === 'homes-need-account' ? 'Voting on homes needs a username and password. Add them to this account to vote.'
  : error === 'no-home' ? HOME_VOTE_GONE_LINE : null);
/** A vote on a home nobody owns now. */
export const HOME_VOTE_GONE_LINE = 'Nobody owns that home any more.';
/** A vote landed, in words. */
export const homeVotedLine = (vote, score) => (vote === HOME_VOTE_UP ? `You voted this home up. Its votes: ${homeScoreText(score)}.`
  : vote === HOME_VOTE_DOWN ? `You voted this home down. Its votes: ${homeScoreText(score)}.`
    : `You took your vote back. Its votes: ${homeScoreText(score)}.`);
