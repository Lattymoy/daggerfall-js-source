// @ts-check
// ═══════════════════════════════════════════════════════════════════
// ACC1e — THE ACCOUNT SERVICE, AS THE CLIENT SEES IT.
//
// Mac (2026-09-21), asked whether to build the account creation screen
// before ACC1d: "Yes, please be detailed".
//
// One home for three things the screen must not each own a copy of:
// WHERE the service is, WHAT its routes are, and WHAT ITS REFUSALS
// MEAN. The screen renders; this decides nothing about pixels and
// everything about the wire.
//
// ═══ PURE, THE SAME WAY identityToken.js IS PURE ═══════════════════
//
// `fetch` and the storage are ARGUMENTS. Nothing here reads
// globalThis, no clock, no DOM. That is not tidiness: it is the only
// reason a node test can drive the whole sign-in ladder without a
// browser, and ACC1a already paid for the lesson that a law verified
// against a stub is a law about the stub. The pins drive this against
// a fetch that answers the REAL service's shapes.
//
// ═══ THE CREDENTIAL GOES IN A HEADER, AND ONLY IN A HEADER ═════════
//
// AUDIT-ACC F13 moved the session secret out of the query string
// because a URL is written into Cloudflare's request logs, into any
// Referer the page emits, and into browser history. The service now
// pins that door shut. This side must not reopen it, so `call` below
// has exactly one way to send a secret - `Authorization: Bearer` - and
// no parameter that could put one anywhere else. A pin holds it.
//
// ═══ THE RECOVERY CODE IS READABLE ONCE, AND THIS FILE NEVER KEEPS IT
//
// `register` and `recover` are the only two answers that carry one,
// and it is never written to storage here. The screen shows it and the
// player writes it down; a copy in localStorage would be a copy in the
// one place a stolen device reads first, and it would make "shown
// once" a sentence rather than a fact.
// ═══════════════════════════════════════════════════════════════════

import { HANDLE_RE } from './handleShape.js';
import { AURAS } from './identityToken.js';   // WB9g: the auras that exist - a stored one is one of them, or none
import { LETTER_SUBJECT_MAX, LETTER_BODY_MAX, LETTER_LINES_MAX, LETTERS_SENT_MAX, LETTERS_PAIR_MAX } from './letterLaw.js';   // MAIL1: the letter's bounds, in the refusals' own sentences
import { MUTE_RANGE_TEXT } from './moderation.js';   // AUDIT 68 S14-mute-range-text-duplicated: the mute's bound in the refusal's sentence, from its home
import { HOME_CAP, RENT_ROOMS_MAX, RENT_HELD_MAX, RENT_DAYS_MAX } from './homeLaw.js';   // HOME1: the cap a refusal names; HOME-RENT: and the rooms'
import { DECOR_CAP, DECOR_YARD_CAP } from './decorLaw.js';   // DECOR1: the cap its refusal names; HOME-YARD: a yard's
import { MARKS_MAX, MARKS_BANK, MARKS_MOVE_MAX } from './marksLaw.js';   // MARKS1: the bounds its refusals name
import { NOTES_LIVE_MAX, NOTE_DAYS, NOTICE_DAYS_MAX } from './boardLaw.js';   // NOTICE1: the bounds its refusals name
import { SIGN_WHY, SIEGE_WHY, ROYAL_WHY, FEALTY_WHY, SELLSWORD_FEE_MAX } from './townSeatLaw.js';   // SEAT2a: the rosters' refusals in the board's own words; the fee's bound
import {
  HARVESTS_PER_DAY, HARVESTS_PER_ACCOUNT_DAY, DEEP_UNCONFIRMED_PER_DAY, STORES_MAX, WITHDRAW_MAX, COURT_WRITS_PER_DAY, RESPEC,
  HIDES_PER_DAY, HIGH_HIDES_PER_DAY, HAULS_PER_DAY,
} from './professionLaw.js';   // PROF1: the bounds its refusals name; PROF7: Hunting's day
import {
  GUILD_FOUND_RENOWN, GUILD_MEMBERS_MAX, GUILD_NAME_MIN, GUILD_NAME_MAX, GUILD_RANK_NAME_MAX, GUILD_MOVE_MAX,
} from './guildLaw.js';   // GUILD1: the bounds its refusals name
import { MARKET_PRICE_MAX, MARKET_UNITS_MAX, MARKET_LISTINGS_MAX, MARKET_ORDERS_MAX, AUCTION_BID_MAX } from './marketLaw.js';   // PROF5: the bounds its refusals name
import { GUILD_WRITS_MAX, GUILD_STORES_MAX, COMMISSIONS_MAX, COMMISSIONS_FOR_MAX, WRIT_POSTS_MAX, WRIT_OPS_MAX } from './writLaw.js';   // PROF6: the bounds its refusals name
import { RENOWN_TRACKS_MAX } from './renown.js';   // RENOWN1: the tracks' bound, in its refusal's own sentence (RENOWN-CHAR: back with the tracks)
import { HERALDRY_CHANGE_DRAKES } from './heraldryLaw.js';   // GUILD1d: a change's cost, in its refusal's own sentence
import { ARENA_TEXT } from '../systems/arenaText.js';   // ARENA4b: the arena's refusals, in its own frozen table

/** WHERE THE SERVICE IS. Its own constant beside the relay's
 *  DEFAULT_SERVER (net/online.js), because they are two Workers and
 *  ACC0's whole argument is that they deploy apart - a player pointing
 *  at a test relay has not moved their account. */
export const DEFAULT_ACCOUNT_SERVICE = 'https://daggerfall-accounts.mackcothran.workers.dev';

/** The bounds the SERVICE enforces, restated here for the field caps
 *  alone. `password.js` PASSWORD_MIN/MAX and `guestName.js` HANDLE_RE
 *  are the law; a pin reads both and fails if these drift, because a
 *  field that lets a player type what the service will refuse is a
 *  refusal the player meets after pressing rather than before. */
export const PASSWORD_MIN_LEN = 8;
export const PASSWORD_MAX_LEN = 200;
export const HANDLE_MAX_LEN = 24;

/** The storage keys this arc owns. DELIBERATELY NOT the SOC1 pair
 *  (`dagger.online.account` / `dagger.online.accountSecret`), which the
 *  HUB mints and matches. ACC1b settled that the account service cannot
 *  adopt the hub's pair - the hub is the only thing holding both
 *  credentials at once, so the merge belongs there - and two different
 *  credentials under one key is how a player gets signed out of both. */
export const SESSION_KEY = 'dagger.account.session';
export const SERVICE_KEY = 'dagger.account.service';

/**
 * WHAT A REFUSAL MEANS, IN WORDS A PLAYER CAN ACT ON.
 *
 * The service answers a machine word (`handle-taken`, `bad-login`,
 * `password-short`). A screen that renders those has told the player
 * nothing; a screen that invents its own sentences per call site has
 * three of them for the same word by Friday. So the translation lives
 * HERE, once, keyed by exactly the words `server-account/src/` emits.
 *
 * AND `bad-login` IS DELIBERATELY VAGUE, because the service is. It is
 * the same word for a handle nobody holds and a password that is wrong,
 * and the two cost the same time besides - so a sentence here naming
 * which one would hand back the enumeration the service spent a
 * derivation to deny.
 */
export const REFUSALS = Object.freeze({
  'handle-shape': `A username is one word, 3 to ${HANDLE_MAX_LEN} characters, starting with a letter, and no spaces.`,
  'handle-refused': 'That username is not allowed. Pick another.',
  'handle-taken': 'Somebody already has that username.',
  'password-shape': 'That password cannot be used.',
  'password-short': `A password is at least ${PASSWORD_MIN_LEN} characters.`,
  'password-long': `A password is at most ${PASSWORD_MAX_LEN} characters.`,
  'already-registered': 'This account already has a username.',
  'not-registered': 'This account has no password yet.',
  // TERMS1: the two routes that make an account refuse a request that has not ticked the documents they hold
  'terms-unaccepted': 'Tick both boxes to agree to the Terms of Service and the Privacy Policy.',
  'terms-stale': 'The Terms of Service or the Privacy Policy has changed. Reload the game (or update the app) to read the current version, then tick the boxes again.',   // AUDIT PRE-MERGE 0929 T1: a reload brings the desktop app's own bundled copy back - the app is updated
  'no-account': 'That account no longer exists.',
  'bad-login': 'That username and password do not match.',
  'bad-code': 'That username and recovery code do not match.',
  email: 'That does not look like an email address.',
  rate: 'Too many attempts. Wait a few minutes and try again.',
  auth: 'You have been signed out. Sign in again.',
  'no-signing-key': 'The account service cannot vouch for accounts right now.',
  body: 'The account service could not read that request.',
  method: 'The account service refused that request.',
  // The two the ROUTER refuses with, before any account is looked at.
  // Found by the pin that walks the service's own source rather than by
  // anybody remembering them: a player meeting a 404 or a cold database
  // deserves a sentence as much as one who mistyped a password.
  'not-found': 'The account service does not know that request. The game may need updating.',
  'no-database': 'The account service is starting up. Try again in a moment.',
  // ACC2, the cloud saves. Every one of these is a sentence a player
  // can act on, which is the whole rule of this table - "too-large" is
  // not a thing to read and "that save is too big to back up" is.
  'saves-need-account': 'Cloud saves need a username and a password. Give this account one and your saves can follow you.',
  'too-many-saves': 'Your cloud backup is full. Delete a save there to make room.',
  'too-large': 'That save is too big to back up.',
  'no-slot': 'That save is not in your cloud backup.',
  'no-data': 'That backup is incomplete - it was interrupted. Back it up again.',
  'no-storage': 'Cloud saves are unavailable right now. Try again later.',
  // ACC3, the titles. `not-held` is the one a player can actually
  // meet - a title lapses (a developer taken off the list) between the
  // card being drawn and the button being pressed - so it says what
  // happened rather than blaming them. `no-title` is a build that has
  // fallen behind the service's vocabulary, which is a different thing
  // and gets a different sentence.
  'not-held': 'That title is not yours to wear any more.',
  'no-title': 'The account service does not know that title. The game may need updating.',
  // WB9g, the Broker's insignia (server-account/src/accounts.js buyInsignia, equipAura)
  'no-aura': 'The account service does not know that aura. The game may need updating.',
  'no-glyph': 'The account service does not know that glyph. The game may need updating.',   // GLYPH-WEAR
  'no-insignia': 'The Broker does not sell that any more. The game may need updating.',
  owned: 'Your account already owns that.',
  short: 'Your account has too few embers for that.',   // WB12a; WB13b: the card says the rule; AUDIT WB12d (A4): a rite's ember counts, and is no breach closed
  guest: 'Insignia need a registered account. Add a username and password first.',
  // ARENA4, the banners (server-account/src/arena.js arenaTeam)
  'bad-banner': 'The arena knows only the Red Banner and the Blue. The game may need updating.',
  joined: 'You already fight under a banner. Quit it at its own recruiter first.',
  season: 'You quit the other banner this season. You may join it when the next season opens.',
  // PATREON-LINK, a patron's own Patreon (server-account/src/patreon.js). `signature` is the webhook's, met by Patreon
  // and never a player; it has a sentence because every word the service says does.
  'patreon-closed': 'Linking Patreon is not switched on yet.',
  'patreon-down': 'Patreon did not answer. Try linking again in a minute.',
  'patreon-needs-account': 'Linking Patreon needs a username and a password. Give this account one first.',
  signature: 'The account service could not check who sent that request.',
  // MOD1, moderation. A moderator reads these in chat, beside the
  // command they just typed.
  'not-moderator': 'Only moderators can do that.',
  protected: 'Moderators cannot be muted.',
  'no-player': 'That player could not be found.',
  // DUEL1: the duelling record - a loss named against oneself (two tabs of one account duelling)
  self: 'A duel against your own account does not count.',
  'bad-minutes': MUTE_RANGE_TEXT,
  // MAIL1, letters. The words are the service's (server-account/src/letters.js) and the letter's law's
  // (net/letterLaw.js, which the service returns verbatim); every one says what to do next.
  'mail-needs-account': 'Letters need a username and a password. Give this account one and you can send and receive them.',
  muted: 'You are muted, so you cannot send letters or pin notes until the mute ends.',
  'no-reader': 'No registered player has that username.',
  'to-self': 'A letter goes to another player.',
  'inbox-full': 'Their letterbox is full. They have to throw letters away before another fits.',
  'no-letter': 'That letter is not in your letterbox any more.',
  'mail-rate': `You have sent a lot of letters. At most ${LETTERS_SENT_MAX} an hour, and ${LETTERS_PAIR_MAX} to one player.`,
  'no-subject': 'A letter needs a subject.',
  'subject-long': `A subject is at most ${LETTER_SUBJECT_MAX} characters.`,
  'no-body': 'A letter needs some words.',
  'body-long': `A letter is at most ${LETTER_BODY_MAX} characters.`,
  'body-lines': `A letter is at most ${LETTER_LINES_MAX} lines.`,
  // RENOWN1, Renown. Each is a build or a device the service does not believe, never a player's mistake:
  // the words say what happened, since there is nothing to retype. (RENOWN-CHAR: all three are this service's again.)
  'renown-character': 'The account service could not tell which character earned that.',
  'renown-xp': 'The account service refused that experience report.',
  'renown-full': `This account already has Renown for ${RENOWN_TRACKS_MAX} characters, the most it keeps.`,
  // HOME1, the online homes (server-account/src/homes.js). A player meets these at a front door, beside the price.
  'homes-need-account': 'Owning a home needs a username and a password. Give this account one and you can buy one.',
  'home-taken': 'Somebody else owns this home now.',
  'home-update': 'This game is out of date. Reload it to buy a home.',   // WD3 (AUDIT WD3 B2): a build from before the town mods
  'home-towns': 'The towns could not be loaded as the other players here see them. Reload the game to buy a home.',   // WD3 (AUDIT WD3 B1): a town mod's pack did not load
  'home-layout': 'The town records here are still being read. Try again in a moment.',   // WD3: the town is built again as the room's (scenes/world.js hearHomeLayouts)
  'home-cap': `A character can own at most ${HOME_CAP} homes. Sell one to buy another.`,
  'home-rate': 'You have bought and sold a lot of homes this hour. Try again later.',
  'no-home': 'That home is not yours any more.',
  'bad-home': 'The account service could not tell which building that is.',
  'home-character': 'The account service could not tell which character this is for.',
  'bad-entry': 'The account service does not know that setting. The game may need updating.',
  'no-session': 'You are not signed in to an account.',
  // HOME-RENT: a home's rooms, rented (server-account/src/rent.js) - met at a door, or in the owner's decorator
  'rent-taken': 'Somebody else is renting that room now.',
  'rent-held': `You already rent ${RENT_HELD_MAX} rooms. Let one run out before you rent another.`,
  'rent-rooms': `A home can offer at most ${RENT_ROOMS_MAX} rooms to rent.`,
  'rent-none': 'There is no rent waiting to be collected.',
  'rent-own': 'You cannot rent a room in your own home.',
  'rent-price': 'The owner has changed the price of that room. Look again.',
  'rent-rate': 'You have changed a great deal about rooms this hour. Try again later.',
  'rent-long': `A room can be rented at most ${RENT_DAYS_MAX} days ahead.`,
  'no-rent-room': 'That room is not offered to rent any more.',
  'bad-room': 'The account service could not read that room.',
  'home-tenants': 'Somebody is renting a room in your home. It cannot be sold or deleted until their days run out.',
  'home-rent-due': 'Rent is waiting to be collected at your home. Collect it first.',
  // ARENA4b: a home the arena displaced (homes.js arenaMoveHome), and a house of its block an old build would buy
  'home-arena': ARENA_TEXT.homeMove.arena,
  'home-unmoved': ARENA_TEXT.homeMove.unmoved,
  'home-changed': ARENA_TEXT.homeMove.changed,
  // HOME-LOOK: an online home's outside (server-account/src/homes.js setHomeLook)
  'bad-look': 'The account service could not read that look. The game may need updating.',
  // DECOR1: an online home's decor (server-account/src/decor.js)
  'decor-cap': `A home holds at most ${DECOR_CAP} pieces. Remove one to place another.`,
  'yard-cap': `A yard holds at most ${DECOR_YARD_CAP} pieces. Remove one to place another.`,   // HOME-YARD
  'decor-taken': 'Another piece already stands under that name. Place it again.',
  'decor-rate': 'You have placed and moved a great deal this hour. Try again later.',
  'no-decor': 'That piece is not in your home any more.',
  'bad-decor': 'The account service could not read that piece.',
  // GUILD1: the guilds (server-account/src/guilds.js)
  'guilds-need-account': 'Guilds need a username and a password. Give this account one and you can found or join one.',
  'guild-character': 'The account service could not tell which character that is.',
  'bad-guild': `A guild's name is ${GUILD_NAME_MIN} to ${GUILD_NAME_MAX} letters, digits, spaces, apostrophes or hyphens, and its tag 2 to 4 capitals or digits.`,
  'guild-rate': 'You have changed a great deal in your guild this hour. Try again later.',
  'guild-renown': `Founding a guild takes Renown ${GUILD_FOUND_RENOWN}.`,
  'guild-already': 'This character already belongs to a guild.',
  'guild-name-taken': 'Another guild already bears that name.',
  'guild-tag-taken': 'Another guild already bears that tag.',
  'no-guild': 'This character belongs to no guild.',
  'guild-rank': 'Your rank in the guild cannot do that.',
  'guild-full': `The guild already holds ${GUILD_MEMBERS_MAX} members.`,
  'no-invite': 'That invitation is no longer open.',
  'guild-master-leaves': 'Hand the guild on to another member before you leave it.',
  'guild-treasury': 'Take the gold out of the treasury first.',
  'realm-market-open': 'This character still has business on the market - a listing, an auction, a bid, a buy order, a commission, or goods on the way or waiting to be collected. Settle it first.',   // PROF-DELETE   // AUDIT 28 M3: the Marks go to the guildmaster with the guild
  'no-member': 'That member is no longer in the guild.',
  'bad-ranks': `Each rank needs a name of its own, 1 to ${GUILD_RANK_NAME_MAX} letters, digits, spaces, apostrophes or hyphens.`,
  'bad-gold': `Gold goes in or out 1 to ${GUILD_MOVE_MAX} at a time.`,
  'guild-treasury-full': 'The treasury can hold no more.',
  'guild-treasury-short': 'The treasury does not hold that much.',
  // AUDIT REALM L1-F3: a realm withdrawal takes from what realm records paid in alone (guilds.js `realm_gold`). GUILD-LETTER
  // (FIELD BUGS 2026-09-30): the words say that rule. They named only "before the realm" - but the old lane's deposits
  // made since are held the same - and never said what a realm character may still take out
  'guild-treasury-old': 'A realm character takes out only the gold realm characters put in, and not that much of theirs is left. The rest came in before the realm or from a character outside it - it stays in the treasury.',
  // WB5b: a gate's kill receipt carried to the service. net/gateClaims.js says nothing of these to the player - it keeps
  // what they do not settle and lets go of what they do - but a word the service can say is a word with a sentence.
  'no-gate-key': 'The account service cannot check a gate\'s receipt right now. It is kept and tried again.',
  receipt: 'That gate\'s receipt was not signed by the gate, or it has run out.',
  'not-yours': 'That gate\'s receipt names another account.',
  // MARKS1: Marks, the server's currency (server-account/src/marks.js)
  'marks-need-account': 'Silver is kept by registered accounts. Add a username to hold it.',
  'marks-closed': 'The counting-houses are not striking silver yet.',
  'marks-rid': 'That request could not be read. Try again.',
  'bad-marks': `Silver moves 1 to ${MARKS_MOVE_MAX.toLocaleString('en-US')} at a time, and the Bank buys at most ${MARKS_BANK.perDay} a day.`,
  'marks-short': 'You do not hold that much silver.',
  'marks-bank-cap': `The Bank buys at most ${MARKS_BANK.perDay} silver from you a day.`,
  'marks-full': `An account holds at most ${MARKS_MAX.toLocaleString('en-US')} silver.`,
  'guild-marks-short': 'The treasury does not hold that much silver.',
  'guild-marks-full': `A guild's treasury holds at most ${MARKS_MAX.toLocaleString('en-US')} silver.`,
  'marks-rate': 'You have moved a great deal of silver this hour. Try again later.',
  'not-developer': 'Only a developer may do that.',   // MARKS1's report, NOTICE1's notices, CUSTOMS-PASS's grant
  // SEAT1a: the seats' registry (server-account/src/townSeats.js)
  'seats-need-account': 'The seats are witnessed by registered accounts. Add a username to witness one.',
  'seats-closed': 'The seats are not open yet.',
  'bad-seat': 'That seat could not be read.',
  'seats-rate': 'You have reported a great many seats this hour. Try again later.',
  'seat-struck': 'That seat was struck from the registry.',
  // SEAT1b: influence (server-account/src/seatInfluence.js)
  'seat-unconfirmed': 'That seat is not confirmed yet. Seats are confirmed once enough players have seen them.',
  'seat-reckoning': 'Pledges are locked until the Turning, Sunday 18:00 UTC.',
  'seat-pledges-full': 'Your guild has pledged in five regions this week. Take one pledge down first.',
  'seat-no-pledge': 'Your guild is not pledged to that seat this week.',
  'seat-tribute-cap': 'Tribute is at most a fifth of your guild\'s week at a seat. Earn more influence there first.',
  'bad-tribute': 'Tribute is paid in multiples of 10 silver.',
  'bad-watch': 'Those watch receipts could not be read.',
  // SEAT1c: the Charters
  'seat-not-held': 'Your guild does not hold that Charter.',
  'seat-held-here': 'Your guild holds a Charter in this region, and is pledged to it.',
  // SEAT1d: the holder's levers
  'bad-tithe': 'A Tithe is a whole percent, at most the seat\'s cap: 10% at a palace and 15% at a crown, a point more for each tier of its Market Hall.',   // AUDIT SEATS-3 C6: the Market Hall raises the cap (fortLaw.js marketHallTitheCap)
  'tithe-this-week': 'The Tithe has been set this week already. It may change again after the Turning.',
  'bad-edict': 'There is no such Edict.',
  'edict-twice': 'That Edict rules this week, and only Market Day may be proclaimed two weeks running.',
  'edict-tier': 'Only a crown may proclaim that Edict.',
  'seat-no-edict': 'No Edict is proclaimed for next week.',
  'bad-bounty': 'A Bounty sets aside at least 20 silver, and at most 100,000.',
  'bad-orc-camp': 'That camp is not one the Orc Raids count.',   // SEASON1 part two
  // SEAT2a: the battles' week - the window, the rosters, the Sellswords (the board's own words: townSeatLaw.js SIGN_WHY)
  'bad-window': 'A window is a day from Wednesday to Saturday and a start from 16:00 to 02:00 UTC.',
  'bad-fee': `A Sellsword's fee is a whole amount of silver, at most ${SELLSWORD_FEE_MAX.toLocaleString('en-US')}.`,
  'bad-handle': 'Name the account by its username.',
  'no-such-account': 'There is no account by that name.',
  'hire-none': 'That Sellsword has no contract to withdraw.',
  'hire-twice': 'That account has a contract here already.',
  ...SIGN_WHY,
  ...SIEGE_WHY,   // SEAT2a part three: the pass and the Honours
  ...ROYAL_WHY,   // CROWN1 part two: the Royal Tourney's pass and bouts
  ...FEALTY_WHY,   // CROWN2: fealty and Pacts
  // NOTICE1: the Notice Board (server-account/src/board.js)
  'board-need-account': 'Notes are pinned by registered accounts. Add a username to pin one.',
  'board-closed': 'The notice board is not open yet.',
  'bad-board': 'That board could not be read.',
  'board-rid': 'That request could not be read. Try again.',
  'bad-note-days': `A note stands for ${NOTE_DAYS.join(', ').replace(/, (\d+)$/, ' or $1')} days.`,
  'bad-note-button': 'That note cannot carry that button.',
  'bad-notice-days': `A notice stands for 1 to ${NOTICE_DAYS_MAX} days.`,
  'notes-full': `You have ${NOTES_LIVE_MAX} notes up already. Take one down first.`,
  'note-no-guild': 'Your character is in no guild to recruit for.',
  'no-note': 'That note is no longer on the board.',
  'no-notice': 'That notice is no longer on the board.',
  'own-note': 'That note is your own.',
  'bad-act': 'That could not be done.',
  'board-rate': 'You have pinned a great many notes this hour. Try again later.',
  'board-ops-rate': 'You have done a great deal at the boards this hour. Try again later.',   // AUDIT 28 N14: a take-down's and a report's
  // PROF1: the professions (server-account/src/professions.js)
  'prof-need-account': 'The Stores are kept for registered accounts. Add a username to gather.',
  'prof-closed': 'The guilds of the trades are not open yet.',
  'prof-character': 'This character could not be named to the counting-houses.',
  'prof-rid': 'That request could not be read. Try again.',
  'bad-node': 'There is nothing here to gather.',
  'prof-kind': 'There is nothing here to gather.',
  'prof-pixel': 'The land here is known otherwise to the counting-houses.',
  'prof-day': 'The day that gathering belonged to has ended.',
  'prof-late': 'That gathering reached the counting-houses too late to count.',
  'prof-night': 'You need daylight to gather effectively!',   // ANY-HOUR: the service says it no more - kept for one not yet redeployed
  'prof-rank': 'Your craft is not yet skilled enough for that.',
  'prof-cap': `You have gathered all a day allows (${HARVESTS_PER_DAY}).`,
  // AUDIT 29
  'prof-account-cap': `Your account has gathered all a day allows in this craft (${HARVESTS_PER_ACCOUNT_DAY}, across your characters).`,
  'prof-deep-cap': `Dungeons nobody has vouched for give you ${DEEP_UNCONFIRMED_PER_DAY} veins a day.`,
  'prof-spec-stale': 'Your specialisation changed elsewhere. Look again before you choose.',
  'prof-spec-taken': 'A specialisation was chosen there already. Look again.',
  'stores-full': `Your Stores hold ${STORES_MAX.toLocaleString('en-US')} of that already.`,
  'stores-short': 'Your Stores do not hold that many.',
  'node-taken': 'You have already gathered here today.',
  'bad-material': 'The Stores do not keep that.',
  'bad-recipe': 'The forge knows no such work.',   // PROF2
  'prof-no-pack-form': 'That stays in the Stores - it never goes to the pack.',   // PROF3: the smith's stock; now a siege work and (AUDIT PROF12 E1) Arcane Essence
  // PROF3: one craft at a time; AUDIT PROF-541 R2-C2: one latch for every craft and brew (profBook.js _craftBusy) - the
  // anvil's word named the wrong work at the fire, the loom and the cauldron, so the words name none
  'prof-busy': 'Your hands are busy with another craft.',
  'prof-later': 'That is made when the sieges come.',   // PROF4: the Ram Kit (PROF0 25)
  // PROF7: Hunting's day - the account's, every character's together (PROF0 6)
  'prof-hunt-cap': `Your account has taken all the hides a day allows (${HIDES_PER_DAY}, across your characters).`,
  'prof-fish-cap': `Your account has hauled all the nets a day allows (${HAULS_PER_DAY}, across your characters). The water rests until midnight UTC.`,   // PROF8
  'prof-hunt-high': `Your account has taken all the rare hides a day allows (${HIGH_HIDES_PER_DAY}, across your characters).`,
  'prof-foe': 'No knife takes a hide from that body.',
  'prof-dye': 'That cannot be dyed so.',
  'prof-sculptor': 'Only a Sculptor carves stone decor - Masonry\'s choice at 100.',   // PROF11
  'prof-lapidary': 'Only a Lapidary sets a Siege-cracked Gem as a piece\'s gem - Jewelcrafting\'s choice at 100.',   // PROF10
  // PROF12: the alchemy station's and the enchanter's refusals
  'prof-transmuter': 'Only a Transmuter turns one metal into the next - Alchemy\'s choice at 100.',
  'bad-brew': 'That cauldron makes no such potion.',
  'bad-piece': 'That is no crafted piece.',
  'prof-no-piece': 'The counting-house knows no such crafted piece - only a piece a crafter made online can be disenchanted.',
  'prof-not-yours': 'That piece is not yours to disenchant.',
  'prof-piece-busy': 'That piece is listed on the market, on its way to you, or set down in a home - it cannot be disenchanted now.',
  'prof-piece-gone': 'Your character\'s record does not hold that piece loose in the pack - it cannot be disenchanted.',   // AUDIT PROF-541 B2
  'prof-no-essence': 'That piece carries too little enchantment to give any Arcane Essence.',
  'bad-qty': `Take 1 to ${WITHDRAW_MAX} at a time.`,
  'bad-pixels': 'That land could not be read.',
  'bad-region': 'That region could not be read.',
  'no-writ': 'That writ is no longer posted.',
  'writ-taken': 'Another has already filled that writ.',
  'writ-expired': 'That writ has run out.',
  'writ-cap': `You have filled ${COURT_WRITS_PER_DAY} Court writs today - the most a day allows.`,
  'prof-spec': 'That specialisation is not one this craft offers.',
  'prof-respec-pending': `A change of specialisation is already on its way (${RESPEC.days} days).`,
  'prof-rate': 'You have done a great deal at your crafts this hour. Try again later.',
  // PROF5: the market (server-account/src/market.js)
  'market-closed': 'The market is not open yet.',
  'bad-price': `A price is 1 to ${MARKET_PRICE_MAX.toLocaleString('en-US')} silver.`,
  'bad-units': `A number of units is 1 to ${MARKET_UNITS_MAX.toLocaleString('en-US')} at a time.`,   // AUDIT 31 L6: a listing's, an order's, a writ's, a guild Stores move's
  'bad-provenance': 'Only a crafted piece, with its maker\'s record, lists on the market.',
  'bad-wear': 'That piece could not be weighed for the market.',
  'bad-listing': 'That listing could not be read.',
  'bad-order': 'That order could not be read.',
  'bad-delivery': 'That delivery could not be read.',
  'market-rate': 'You have done a great deal at the market this hour. Try again later.',
  'market-gone': 'That is no longer on the market.',
  'market-own': 'That is your own. Cancel it from My listings instead.',
  'market-short': 'There are not that many left.',
  'market-no-road': 'The couriers do not know the road there yet.',
  'market-price-moved': 'The market has moved since you looked. Look again.',
  'market-seller-full': 'The seller cannot hold any more silver just now.',
  'market-listings-max': `You have as many listings up as this board allows (${MARKET_LISTINGS_MAX}, more in a town with a Market Hall). Cancel one first.`,   // AUDIT SEATS-3 D2: a Market Hall's town lists more
  'market-orders-max': `You have ${MARKET_ORDERS_MAX} buy orders up already. Withdraw one first.`,
  // MARKET-KEEP: the piece stays with its holder - said so, and where it may still go
  'market-not-yours': 'That piece\'s maker\'s record names another owner, so only they can sell it at the counting-house. It stays in your pack - a piece from your pack sells for gold.',
  'market-listed': 'That piece is on the market already.',
  'market-order-full': 'The buyer\'s Stores cannot hold that many more.',
  'market-elsewhere': 'That order is filled at the boards of its own region.',
  'market-other-character': 'That is on its way to another of your characters.',
  'market-on-road': 'The courier has not arrived yet.',
  // AUDIT 30
  'market-not-listable': 'That is not sold on the market - arrows go in a quiver, not on a board.',
  'market-uncollected': 'That piece is still on its way to you. Collect it first.',
  'market-standing': 'That piece stands in a home. Take it up first.',
  'market-unyielded': 'Nothing yields that yet, so no one could fill an order for it.',
  'market-busy': 'The counting-house is still settling your last business.',
  // GOLD-MARKET: gold is a realm character's, and what gold bought stays gold's (Professions-Arc 10.8)
  'market-gold-realm': 'Gold changes hands on the market only between characters of the online realm.',
  'market-currency': 'That listing is priced in the other currency. Look again.',
  'market-gold-goods': 'What you bought with gold goes to your pack or back on the market for gold - never for silver, to a station, a craft or a writ.',
  // AUDIT PROF-541 R2-S3 (Mac: B7's wider wall kept, its word made plain): a piece made of goods a counter sold for silver is silver's
  'market-drakes-goods': 'Goods bought with silver, and pieces made with them, sell only for silver. What you gathered, or made of your own or gold-bought goods, sells for gold.',
  'market-gold-none': 'Your sales hold no gold for you just now.',
  'market-gold-full': 'The seller cannot hold any more gold from the market just now.',
  // MARKET-ANY: a piece from the pack
  'market-not-good': 'That piece cannot be sold on the market.',
  'market-good-gone': 'The realm does not hold that piece where your pack had it. Nothing was listed.',
  'market-piece-route': 'That piece\'s maker\'s record is yours: list it as a crafted piece.',
  'market-goods-gold': 'A piece from your pack sells for gold alone.',
  'stores-gold': 'What you bought with gold is not used there. Withdraw it to your pack, or sell it again for gold.',
  // PROF5b: the auctions
  'auction-not-masterwork': 'Only a Masterwork is sold at auction. List it at a price instead.',
  'auction-low': 'Another bid came first. The next bid is higher now.',
  'auction-leading': 'Your bid already leads.',
  'auction-bid-standing': 'A bid stands on it, so it cannot be taken back now.',
  // AUDIT 31
  'auction-moved': 'Another bid landed as yours was weighed. The auction has been read again - bid again if you still would.',
  'bad-bid': `A bid is 1 to ${AUCTION_BID_MAX.toLocaleString('en-US')} silver.`,
  'market-no-record': 'The counting-house has no record of that piece, so it cannot be sold or handed over.',
  'piece-kept': 'The counting-house is still settling another business with that piece. It answers that first.',
  'other-character': 'That was begun by another of your characters. It settles when they next open the board.',
  'piece-held': 'That piece cannot leave your pack now - take it off, or unlock it, first.',   // AUDIT 31 H8
  // PROF6: guild writs, commissions and the guild Stores
  'writs-closed': 'Guild writs and commissions are not open to this account.',
  'writ-pay': 'A guild writ pays at most half again the material\'s worth a unit.',
  'writ-budget': 'That is past the Officers\' writ budget for this week. The Guildmaster sets it on the Guild tab.',
  'writ-gone': 'That writ is no longer posted.',
  'writ-elsewhere': 'That writ is delivered at the boards of the region that posted it.',
  'writ-short': 'That writ wants fewer than that now.',
  'writ-moved': 'Another delivered first. The writ has been read again.',
  // SEAT2b: a seat writ and a fortification project
  'seat-not-pledged': 'Your guild neither holds that seat nor is pledged to it this week.',
  'bad-work': 'There is no such work.',
  'fort-not-here': 'That work cannot be raised at this seat.',
  'fort-building': 'That work is being raised already.',
  'fort-max': 'That work stands at its last tier.',
  'seat-treasury': 'The guild\'s treasury does not hold the silver that project asks.',
  'bad-rid': 'That request was malformed. Try again.',
  'writ-rate': `You have done as much with writs and commissions as an hour allows (${WRIT_POSTS_MAX} posted, ${WRIT_OPS_MAX} other acts). Try again later.`,
  'writ-busy': 'The counting-house is still settling your last writ.',
  'guild-writs-max': `A guild may have ${GUILD_WRITS_MAX} writs posted at once.`,
  'guild-stores-full': `The guild Stores hold at most ${GUILD_STORES_MAX.toLocaleString('en-US')} of a material.`,
  'guild-stores-short': 'The guild Stores do not hold that many.',
  'guild-stores': 'Empty the guild Stores first.',
  'guild-writs': 'Withdraw the guild\'s writs first.',
  'guild-writ-escrow': 'A withdrawn writ\'s pay is still waiting to go back to the silver treasury, which is full. Take silver out of the treasury first.',   // AUDIT 31 A15
  // GUILD1d (Seats-Arc 8): the guild hall and the heraldry (server-account/src/halls.js)
  'guild-hall-have': 'Your guild already has a hall. Sell it first to buy another.',
  'guild-hall-none': 'Your guild has no hall.',
  'guild-hall-moved': 'The hall changed while you were selling it - a piece placed or moved, or the guild handed on. Look again.',
  'guild-hall': 'Sell the guild\'s hall first.',
  'guild-seat': 'Give up the guild\'s Charters first, at each seat\'s Notice Board.',   // SEAT1c
  'guild-battle': 'The guild is named in a siege or a Tourney this week. It cannot go until the battle is over.',   // SEAT1c
  'hall-item': 'A guild hall holds furniture from the catalogue alone - your own things stay yours.',
  'hall-yard': 'A palace\'s grounds cannot be furnished - only its Charter Room.',   // GUILD-YARD: a guild hall's yard is its keepers'; a palace's grounds stand none
  'bad-heraldry': 'Choose two different colours - Ash only as the border - and one device.',
  'heraldry-same': 'That is already your guild\'s heraldry.',
  'heraldry-moved': 'The guild\'s heraldry changed meanwhile. Look again.',
  'heraldry-drakes': `Changing the heraldry costs ${HERALDRY_CHANGE_DRAKES} silver from the guild's silver treasury, and it holds less.`,
  'writ-own-guild': 'Your guild\'s Officers and Guildmaster take its Stores out, so they do not deliver to its writs.',   // AUDIT 31 S6
  'guild-stores-mine': 'A member takes out only what they put in of their own. The Officers and the Guildmaster take the rest.',   // AUDIT 31 R1
  'bad-budget': `A writ budget is 0 to ${MARKS_MAX.toLocaleString('en-US')} silver.`,
  'bad-quality': 'Ask a quality from Crude to Masterwork - or none, for a piece that takes none.',
  'bad-pay': `A commission pays 1 to ${MARKET_PRICE_MAX.toLocaleString('en-US')} silver.`,
  'commission-recipe': 'Only a piece the market lists may be commissioned - never arrows or siege works.',
  'commission-crafter': 'There is no crafter by that name.',
  'commission-self': 'You cannot commission yourself.',
  'commissions-max': `You may have ${COMMISSIONS_MAX} commissions posted at once.`,
  'commissions-crafter-max': `That crafter has ${COMMISSIONS_FOR_MAX} commissions waiting already - the most one crafter may be sent.`,
  'commission-unyielded': 'Nothing yields what that piece is made of yet, so no one could make it.',   // AUDIT 31 L2
  'commission-elsewhere': 'That commission is filled at the boards of its own region.',   // AUDIT 31 L6
  'commission-not-yours': 'That commission names another crafter.',
  'commission-piece': 'That piece is not what the commission asks.',
  'commission-not-made': 'A commission is filled with a piece of your own make.',
  'commission-worn': 'A commission is new work: that piece is worn.',
  // HOME-CROSSED (FIELD BUGS 2026-09-30): a home customs carried in - RESTORE's words for a crossed deed
  // (systems/onlineHomes.js HOME_CROSSED_LINES, pinned equal), and a realm act asked while the last is still out
  'home-crossed': 'That came into the realm through customs. The bank of the Empire does not buy it back. It stays your home.',
  busy: 'Your last dealing with the realm is still being settled. Try again in a moment.',
  server: 'The account service had a problem. Try again.',
  offline: 'Could not reach the account service. Check your connection.',
  maintenance: 'The account service is being looked after for a minute. Try again shortly.',   // RESTORE: the history restore's minute
  // REALM P1: the realm's characters (server-account/src/realm.js) - an online character's save, held by the service.
  'too-many-characters': 'You have as many online characters as an account may hold. Delete one to make room.',
  'no-realm-character': 'That online character is not on this account.',
  lease: 'This character is being played somewhere else now - another tab or device took it.',
  seq: 'This character was saved from somewhere else in the meantime. Rejoin to carry on.',
  // CUSTOMS-CARRY (2026-09-29): the census is every trace the realm has from before it began (migration 0022) - said as
  // what counts, since "played online" read false to a player who had and never killed there
  // CUSTOMS-PASS (2026-09-29): and the one way past it, a developer's pass - named for the case it exists for, a character
  // played online on an older version of the game after the realm opened (which the relay admitted until REALM-DOOR)
  // CUSTOMS-ELSEWHERE (FIELD BUGS 2026-09-30): counted, but on the account it went online with
  'customs-other-account': 'The realm knows this character from another account - the one you played it online with. Sign in with that account to bring it in.',
  'customs-never-online': 'The realm has no record of this character from before it opened - no Renown, online home, guild place, raid or cloud backup - so it cannot come in. Make a new online character instead. If you played it online on an older version of the game after the realm opened, ask the developers on the Discord.',
  'customs-already': 'That character has already been brought into the realm.',
  // AUDIT REALM2 S1: a first save the realm reads - a new character's, or customs' own
  'realm-birth': 'The realm takes a new character only as character creation makes one. Delete it and make it again.',
  'customs-allowance': 'That character carries more gold than customs lets in. Bring it online again.',
  // AUDIT REALM2 S2: the online acts that cost gold are a realm character's
  'realm-only': 'Only an online character of the realm can do that.',
  // REALM P2.1: a trade's sid another pair settled (server-account/src/realmTrade.js)
  'trade-spent': 'That trade has already ended - nothing was traded.',
  // REALM P2.2: an act that moves a realm character's gold on its record (server-account/src/realm.js)
  'realm-needed': 'This online character must be playing in the realm to do that. Rejoin and try again.',
  'realm-gold': 'The realm holds less gold for this character than that costs.',
  // CUSTOMS-PASS: the developer's route (server-account/src/realm.js grantCustomsPass), said by tools/customsPass.mjs - its
  // `not-developer` is MARKS1's one word above (MERGE 2: both sides wrote it; the one refusal says both routes)
  ambiguous: 'More than one account goes by that name - name the account by its id instead.',
});

/** The sentence for a refusal, never `undefined` and never the raw
 *  machine word: a word this table has not met is still a refusal, and
 *  a player staring at `handle-frobnicated` has been told nothing. */
export const accountRefusalText = (error) => REFUSALS[error] ?? REFUSALS.server;

/** Is this a handle the service will accept the SHAPE of? Asked of the
 *  service's own regex rather than a second copy, so the field and the
 *  far end cannot disagree. The service still has the last word - it
 *  also runs the name filter and the UNIQUE index. */
export const handleShapeOk = (handle) => typeof handle === 'string' && HANDLE_RE.test(handle);

/**
 * ONE DOOR TO THE SERVICE.
 *
 * @param {object} io
 * @param {(url: string, init: object) => Promise<any>} io.fetch  the fetch to use
 * @param {string} [io.base]  the service's origin
 * @param {string|null} [io.secret]  the session secret, if there is one
 * @param {boolean} [io.keepalive]  AUDIT RENOWN1 GAME-8: finish the call after the page is gone (the pagehide report)
 * @param {string} path  a `/v1/...` route
 * @param {object|null} [body]  POST body, or null for a GET
 * @returns {Promise<{ok: boolean, data?: any, error?: string, status?: number}>}
 */
export async function call({ fetch, base = DEFAULT_ACCOUNT_SERVICE, secret = null, keepalive = false }, path, body = null) {
  const headers = { accept: 'application/json' };
  if (body) headers['content-type'] = 'application/json';
  // THE ONE PLACE A CREDENTIAL IS SENT. There is no `?secret=` branch
  // to reach and no argument that could add one - AUDIT-ACC F13 shut
  // that door on the service and this side does not get to reopen it.
  if (secret) headers.authorization = `Bearer ${secret}`;

  let res;
  try {
    res = await fetch(`${base}${path}`, {
      method: body ? 'POST' : 'GET',
      headers,
      body: body ? JSON.stringify(body) : undefined,
      // AUDIT RENOWN1 GAME-8: a call made as the page goes (the Renown report on pagehide) asks the browser to finish
      // it after the page is gone - through this one door, so the credential still rides the header and nowhere else
      ...(keepalive ? { keepalive: true } : {}),
    });
  } catch {
    // A NETWORK FAILURE IS A REFUSAL, NOT A THROW. ONCRASH1's law on
    // this side too: a throw out of a button handler ends more than the
    // button. Every arm of this function returns the same shape.
    return { ok: false, error: 'offline' };
  }

  let data = null;
  try { data = await res.json(); } catch { data = null; }

  if (!res.ok) {
    // The service says `{ error: '<word>' }`. A proxy, a 502 or an
    // HTML error page says nothing we can read, and `server` is the
    // honest answer for that rather than a guess at which word it meant.
    return { ok: false, error: typeof data?.error === 'string' ? data.error : 'server', ...(typeof data?.why === 'string' ? { why: data.why } : {}), ...(Number.isSafeInteger(data?.seq) ? { seq: data.seq } : {}), status: res.status };   // AUDIT WB A5: and the rung, where the service names one; REALM P2.2: and a realm record's sequence
  }
  return { ok: true, data, status: res.status };
}

// ── THE LADDER, ROUTE BY ROUTE ──────────────────────────────────────
//
// Each one is the thinnest possible wrapper: the route's name, its
// body's shape, and nothing else. They exist so the screen never spells
// a path, because a path spelled at a call site is a path that outlives
// a rename.

/** TERMS1: the two fields a request that makes an account carries - the
 *  Terms of Service and Privacy Policy versions its player ticked
 *  (net/legalLaw.js ACCEPTED) - or none, which the service refuses. */
const legalFields = (accepted) => (accepted ? { terms: accepted.terms, privacy: accepted.privacy } : {});

/** A guest row and the session that owns it. `{ id, name, kind,
 *  sessionId, secret }`. TERMS1: the service opens no row for a player
 *  who has not ticked the documents, so `accepted` rides the request. */
export const openGuest = (io, label = null, accepted = null) => call(io, '/v1/auth/guest', { label, ...legalFields(accepted) });

/** Fill in a handle and a password on the guest row THIS SESSION
 *  already owns - an upgrade in place, never a new account. Answers
 *  `{ recoveryCode, handle }`, and that code is readable exactly once.
 *  TERMS1: with the versions ticked on the form that names it. */
export const register = (io, handle, password, accepted = null) =>
  call(io, '/v1/auth/register', { handle, password, ...legalFields(accepted) });

/** `{ id, name, kind, sessionId, secret }` for a new device. */
export const login = (io, handle, password, label = null) => call(io, '/v1/auth/login', { handle, password, label });

/** Spend the recovery code: a new password, a NEW code, and every
 *  device signed out including this one. */
export const recover = (io, handle, code, password) => call(io, '/v1/auth/recover', { handle, code, password });

/** `{ account, devices }`. A GET, so the secret rides the header and
 *  there is no body at all. */
export const readAccount = (io) => call(io, '/v1/account');

/** The old password is required even from inside a live session, so a
 *  stolen device cannot lock its owner out. Signs out every OTHER
 *  device; this one stays. */
export const changePassword = (io, oldPassword, password) =>
  call(io, '/v1/account/password', { oldPassword, password });

/** Completely optional, and `null` takes it off again. */
export const setEmail = (io, email) => call(io, '/v1/account/email', { email: email || null });

/** THIS device by default. `all` is a separate, explicit act. */
export const logout = (io, all = false) => call(io, '/v1/auth/logout', { all });

/** ACC3c: WEAR ONE OF THE TITLES THIS ACCOUNT HOLDS, or none.
 *  Mac: "tap the account icon to equip 1 feature along with signing
 *  out." `null` takes it off and is always allowed.
 *
 *  THIS SIDE DOES NOT GET TO SAY WHAT IS HELD. It asks; the service
 *  derives the grant and refuses `not-held`. A client that decided for
 *  itself would be a client that can wear anything, which is the hole
 *  ACC1g shut one field over. `{ ok, titles, title, glyphs }`. */
export const equipTitle = (io, title) => call(io, '/v1/account/title', { title: title ?? null });
/** WB9g: wear one of the Broker's auras, or none - `{ ok, titles, title, glyphs, auras, aura, insignia }`, the wardrobe
 *  after the write. */
export const equipAura = (io, aura) => call(io, '/v1/account/aura', { aura: aura ?? null });
/** GLYPH-WEAR (2026-10-02, Mac: "players can also equip/unequip their glyphs"): show one glyph (`on` true) or hide it -
 *  the wardrobe after the write (`glyphs` still all that is true, `glyphsOff` the ones taken off). The service refuses
 *  `not-held` for a glyph that is not true of this account. */
export const equipGlyph = (io, glyph, on) => call(io, '/v1/account/glyph', { glyph, on: !!on });
/** WB9g: buy a piece of the Broker's insignia (net/insignia.js INSIGNIA) for this account - the wardrobe after the sale and
 *  the `purse` its closed gates can still pay, or a refusal (`owned`, `short` with `purse` and `price`, `guest`). */
export const buyInsignia = (io, item) => call(io, '/v1/account/insignia', { item });
/** PATREON-LINK: take this account's Patreon off it - `{ ok, titles, title, glyphs, auras, aura, insignia, patreon }`,
 *  the wardrobe after it and the card's Patreon row. Linking has no call here: the account read carries the link, and
 *  the player follows it in a browser (server-account/src/patreon.js says why). */
export const unlinkPatreon = (io) => call(io, '/v1/patreon/unlink', {});

/** ACC4: ONE BEAT OF TIME PLAYED. It carries no number - the service
 *  credits the gap by its own clock (net/playClock.js says why), and
 *  answers the running total. `{ playedS }`. */
export const beatPlay = (io) => call(io, '/v1/account/played', {});

/** MOD1: MUTE AN ACCOUNT for `minutes` (0 lifts it). The service
 *  decides whether this player may; the answer carries an `order` the
 *  service signed, which the caller carries to every room it holds so
 *  the mute lands now rather than on the target's next reconnect.
 *  `{ ok, target, name, until, order }`. */
export const muteAccount = (io, target, minutes) => call(io, '/v1/mod/mute', { target, minutes });

/** ACC1d: A SIGNED WORD THE RELAY CAN CHECK, for one connection.
 *  `{ token, name, kind, expiresAt }`. The service signs the name it
 *  holds - this side does not get to say what goes in it, which is the
 *  whole point of the seam. A service with no signing pair answers
 *  `no-signing-key` rather than minting something the relay refuses. */
export const mintIdentity = (io, character = null) => call(io, '/v1/auth/token', character ? { character, guild: true } : {});   // RENOWN1: naming the character brought online signs its Renown in; AUDIT MERGE-PLUS A6: and this build knows the guild's channel, so it asks for the guild

// ── THE SESSION ON THIS DEVICE ──────────────────────────────────────

/**
 * Read the stored session. Storage is an ARGUMENT (systems/appStorage
 * in the app, a Map in a test) and every read is guarded: appStorage
 * can throw in a private window, and a sign-in screen that throws
 * while deciding whether to show itself is a menu that will not open.
 */
export function storedSession(storage) {
  try {
    const raw = storage?.getItem?.(SESSION_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    // A SHAPE, NOT A TRUTH. This says the value is one we wrote, not
    // that the service still honours it - only a call can say that, and
    // `auth` is what it says when the answer is no.
    return typeof v?.secret === 'string' && v.secret ? v : null;
  } catch { return null; }
}

/** Keep the session this device signed in with. The RECOVERY CODE IS
 *  NEVER PART OF THIS - `register` and `recover` hand one back and it
 *  is the screen's to show and the player's to write down. */
export function keepSession(storage, { id, name, kind, sessionId, secret, glyphs, aura }) {
  try {
    storage?.setItem?.(SESSION_KEY, JSON.stringify({ id, name, kind, sessionId, secret, glyphs, aura }));   // SHADOW-FANG: `glyphs` when the service has stated them (adoptIdentity) - JSON leaves it out otherwise; WB9g: `aura` likewise
    return true;
  } catch { return false; }
}

/**
 * ═══ NAME-ADOPT: THE CLIENT LEARNS WHO IT IS FROM THE SERVICE ══════
 *
 * Mac (2026-09-22), the first hour the arc was live: "The top right
 * corner button doesnt update with name" and "Ingame your name shows
 * for other people but you still see your character name in the chat
 * menu".
 *
 * ONE CAUSE, TWO SYMPTOMS. The service ISSUES a name - the handle, or
 * the guest name - and the relay takes it out of the token for
 * everybody ELSE. But this device never took it in for ITSELF: the
 * stored session kept whatever name it was written with (a guest's,
 * when a guest registers - `register` answers the handle and not a
 * session), and the online session was built from the CHARACTER'S
 * name. So everybody in the room read `Lattymoy` and the one person
 * who did not was Lattymoy.
 *
 * THE LAW: the issued identity is the service's answer, and this
 * device adopts it wherever the service states it - `/v1/account` and
 * every `/v1/auth/token`. This is the one door that writes it back.
 *
 * IT NEVER CREATES A SESSION and never touches the secret or the id:
 * it corrects the name and kind of a session that already exists, so
 * an answer arriving after a sign-out cannot resurrect one.
 *
 * SHADOW-FANG (2026-09-26): AND THE GLYPHS, when the answer states them - what is TRUE of this account (a token's
 * `glyphs`, a wardrobe's). The relay reads a player's glyphs off the signature for everybody else; this device keeps
 * the service's last word for its own player, so what dresses them on their own screen (their werewolf's skin,
 * characters/werewolfSkin.js) is there offline too. Strings only, a bounded list; a list that did not change is not
 * written.
 *
 * AUDIT B4 (2026-09-26): AND ONLY INTO THE SESSION THAT ASKED. `secret` is
 * the credential the answer was asked with; a session signed out and
 * another signed in while it was in flight is not the one it describes -
 * adopted, one account's name and glyphs landed on another's device (and
 * dressed its werewolf in a skin it does not hold).
 *
 * WB9g (2026-09-30): AND THE AURA WORN (`aura`, null for none), when the answer states it - a token's, a wardrobe's
 * after any wear (the account card's, the Broker's) - so this device's own player sees the fire at their feet the moment
 * any door changes it (systems/ownGlyphs.js ownAura). The room sees it from their next hello, off the signature.
 *
 * GLYPH-WEAR (2026-10-02): LESS THE GLYPHS TAKEN OFF (`glyphsOff`), when the answer states them - what dresses my own
 * player on my own screen is what the room is shown, so a Shadow Fang hidden is a wolf in no skin here as it is there.
 *
 * @param {any} storage
 * @param {{ name?: string, kind?: string, glyphs?: string[], glyphsOff?: string[], aura?: string|null, secret?: string }} [who]
 */
export function adoptIdentity(storage, { name, kind, glyphs, glyphsOff, aura, secret } = {}) {
  const was = storedSession(storage);
  if (!was) return false;
  if (typeof secret === 'string' && was.secret !== secret) return false;
  const next = { ...was };
  if (typeof name === 'string' && name) next.name = name;
  if (kind === 'guest' || kind === 'linked') next.kind = kind;
  const off = Array.isArray(glyphsOff) ? glyphsOff : [];   // GLYPH-WEAR
  if (Array.isArray(glyphs)) next.glyphs = glyphs.filter((g) => typeof g === 'string' && g.length <= 24 && !off.includes(g)).slice(0, 16);
  if (aura !== undefined) next.aura = typeof aura === 'string' && AURAS.includes(aura) ? aura : null;   // WB9g: one that exists, or none
  const sameGlyphs = (next.glyphs ?? []).join('+') === (was.glyphs ?? []).join('+');
  const sameAura = (next.aura ?? null) === (was.aura ?? null);
  if (next.name === was.name && next.kind === was.kind && sameGlyphs && sameAura) return false;   // nothing to write, and a write is a storage event every open tab hears
  return keepSession(storage, next);
}

/** Forget it. Called on a deliberate sign-out AND whenever the service
 *  answers `auth`, because a secret the far end has stopped honouring
 *  is not a session - keeping it would make every later call fail the
 *  same way with nothing on screen explaining why. */
export function forgetSession(storage) {
  try { storage?.removeItem?.(SESSION_KEY); return true; } catch { return false; }
}

/** SCALE2 (2026-09-30, the scaling audit): how long a minted token is handed to OTHER rooms before a fresh one is
 *  minted. A relay room spends a token once - in THAT room (server/src/index.js `_spent`, one set a room) - so the one
 *  token may open the cell, its halos, the hub and the region channel of one connect. A minute covers a connect's
 *  burst (and a deploy's reconnect wave) and keeps what the token signs - the level, the title, the guild - no older
 *  than that in any room it opens; the token itself lives MAX_TTL_S (five minutes). */
export const TOKEN_REUSE_MS = 60_000;

/**
 * ACC1d: ONE TOKEN FOR ONE RELAY CONNECTION - NEVER TWICE INTO ONE ROOM.
 *
 * This is what `OnlineSession({ mintToken })` (net/online.js) calls on
 * every socket open, with the ROOM it opens, and its answer is the
 * hello's `tok`. The relay spends a token once IN A ROOM (bible ACC1d
 * D4): a token held over and sent twice into one room is the exact frame
 * the relay refuses, and a player who reconnected would be refused their
 * own name - so a room this token has opened never gets it again.
 *
 * SCALE2: AND ONE MINT A CONNECT, NOT ONE A SOCKET. Every socket minted
 * its own - the cell, up to three halos, the hub and the region channel,
 * three to six at once, each ~8 D1 statements and a signature - and a
 * relay deploy reconnects every player in the same second: the storm
 * that is what breaks first at five hundred players (bible
 * 11-Multiplayer/Scale-Arc.md). A token is now handed to every OTHER
 * room asked within TOKEN_REUSE_MS of its mint, under the same session
 * and character; sockets opening together share the one mint in flight.
 * A call that names no room is minted fresh, as before.
 *
 * IT ANSWERS `null` FOR EVERY REASON A PLAYER MIGHT HAVE NO TOKEN - no
 * session on this device, a service that is down, a rate limit, a secret
 * the service has stopped honouring. Never a throw.
 *
 * (This paragraph used to end "ACC1d D1 admits an unverified hello
 * exactly as every build before this slice did", which ACC1g made false:
 * the relay REFUSES a tokenless hello now. What a null costs today is
 * the connection - the player is told to sign in - and that is the
 * wall working, not the minter failing.)
 *
 * NAME-ADOPT: THE ANSWER CARRIES WHO THIS DEVICE IS, and it used to be
 * thrown away - the token kept, and `name`, `kind`, `title` and
 * `glyphs` dropped on the floor beside it. That is half of why a
 * player saw their character's name while everybody else saw their
 * handle. So every successful mint ADOPTS the issued identity into the
 * stored session, and hands it to `onIssued` for the live sessions.
 * The return stays the token alone: the session's contract with this
 * function is a string, and a pin holds it.
 *
 * RENOWN1: `character` answers the id of the character being brought
 * online (systems/characterId.js), read at EACH mint - the service signs
 * that character's Renown into the token, and `who.level`
 * carries it back - RENOWN4: and `who.xp` the track's total, which the
 * answer carries beside the token and never in it. GUILD1c: and
 * `who.guild` the character's guild's tag, signed into the token beside
 * the level. A getter that answers nothing mints as before.
 *
 * SCALE2: the minter says WHY it answered null (`minter.lastWhy`: 'no-session', or the service's refusal word -
 * 'auth', 'rate', 'server', 'offline'...; null after a token), so a session can tell "sign in" from "try again".
 *
 * @param {object} io
 * @param {(url: string, init: object) => Promise<any>} io.fetch
 * @param {any} io.storage  appStorage() in the app, a Map in a test
 * @param {((who: {name: string, kind: string, title: string|null, glyphs: string[], level: number|null, xp: number|null, guild?: string|null}) => void)|null} [io.onIssued]
 * @param {(() => string|null)|null} [io.character]
 * @param {(() => number)} [io.now]
 * @returns {((room?: string|null) => Promise<string|null>) & { lastWhy: string|null }}
 */
export function accountTokenMinter({ fetch, storage, onIssued = null, character = null, now = () => Date.now() }) {
  /** @type {{ token: string, secret: string, character: string|null, at: number, rooms: Set<string> } | null} */
  let held = null;
  /** @type {Promise<string|null> | null} */
  let minting = null;
  const reuse = (/** @type {string|null} */ room, /** @type {string} */ secret, /** @type {string|null} */ named) => {
    if (!held || room == null || held.rooms.has(room) || held.secret !== secret || held.character !== named) return null;
    if (!(now() - held.at < TOKEN_REUSE_MS)) return null;
    held.rooms.add(room);
    return held.token;
  };
  const minter = Object.assign(async (/** @type {string|null} */ room = null) => {
    const session = storedSession(storage);
    if (!session) { minter.lastWhy = 'no-session'; console.warn('[account] no identity token: no sign-in stored on this device'); return null; }   // TOKEN-WAIT
    let named = null;
    try { named = character?.() ?? null; } catch { named = null; }   // a seam that throws costs the level, never the hello
    named = typeof named === 'string' && named ? named : null;
    const again = reuse(room, session.secret, named);
    if (again) { minter.lastWhy = null; return again; }
    // a mint already on the wire (the sockets of one connect open together): its token, if this room has not had it
    if (minting) {
      await minting.catch(() => null);
      const shared = reuse(room, session.secret, named);
      if (shared) { minter.lastWhy = null; return shared; }
    }
    const p = mintFresh(session, named).then((token) => {
      if (token) held = { token, secret: session.secret, character: named, at: now(), rooms: new Set(room != null ? [room] : []) };
      return token;
    });
    minting = p;
    try { return await p; } finally { if (minting === p) minting = null; }
  }, { lastWhy: /** @type {string|null} */ (null) });

  /** One mint on the wire - the identity adopted, or null with `lastWhy` said. */
  async function mintFresh(/** @type {any} */ session, /** @type {string|null} */ named) {
    const answer = await mintIdentity({ fetch, base: serviceBase(storage), secret: session.secret }, named);
    if (answer.ok) {
      const token = typeof answer.data?.token === 'string' ? answer.data.token : null;
      if (token) {
        const who = { name: answer.data.name, kind: answer.data.kind, title: answer.data.title ?? null, ts: Array.isArray(answer.data.ts) ? answer.data.ts : null, glyphs: Array.isArray(answer.data.glyphs) ? answer.data.glyphs : [], level: Number.isSafeInteger(answer.data.level) ? answer.data.level : null,   // SEAT1c: `ts` a seat title's claim
          xp: Number.isSafeInteger(answer.data.xp) && answer.data.xp >= 0 ? answer.data.xp : null,   // RENOWN4: the track's total, for the page's own bar - none from a service before acct13
          // GUILD1c: the tag my character's guild wears (null for none) - absent from a service before acct13, which says nothing
          ...('guild' in answer.data ? { guild: typeof answer.data.guild === 'string' ? answer.data.guild : null } : {}),
          // GLYPH-WEAR: the glyphs my own name leaves out - `glyphs` stays all that is true (the staff rights read it)
          ...(Array.isArray(answer.data.glyphsOff) ? { glyphsOff: answer.data.glyphsOff } : {}),   // absent for none
          // WB9g: the aura at my own feet (null for none) - absent from a service before acct38, which says nothing
          ...('aura' in answer.data ? { aura: typeof answer.data.aura === 'string' ? answer.data.aura : null } : {}),
          // SEASON1 part two: a Season's banner ribbon under my own name (null for none) - absent from a service before acct58
          ...('ribbon' in answer.data ? { ribbon: Array.isArray(answer.data.ribbon) ? answer.data.ribbon : null } : {}) };
        adoptIdentity(storage, { ...who, secret: session.secret });   // AUDIT B4: into the session that asked
        // A THROW HERE IS THE HOST'S AND IS NOT THE PLAYER'S. The token
        // is good and the connection is the thing that matters; a
        // display seam that breaks must not cost the hello its word.
        try { onIssued?.(who); } catch { /* the token still goes */ }
      }
      minter.lastWhy = token ? null : 'refused';
      return token;
    }
    // A SECRET THE SERVICE HAS STOPPED HONOURING IS NOT A SESSION, and
    // `forgetSession`'s own note says why keeping one is worse than
    // dropping it. ONLY `auth`: every other refusal is the service
    // having a bad minute, and signing a player out over a 503 or a
    // rate limit would make an outage permanent.
    if (answer.error === 'auth') forgetSession(storage);
    minter.lastWhy = answer.error ?? 'refused';
    // FIELD BUGS 29h (TOKEN-WAIT): the refusal said where a player can read it - without a token the relay refuses the
    // hello as "sign in to play online", which is all the World line can show, whatever the service's own answer was
    console.warn(`[account] no identity token: ${answer.error ?? 'refused'}${answer.status ? ` (${answer.status})` : ''}`);
    return null;
  }
  return minter;
}

/**
 * ACC4: THE BEAT, bound to this device's stored session. The world host
 * hands this to `startPlayClock` (net/playClock.js), which calls it
 * every PLAY_BEAT_S while the page is visible.
 *
 * A DEVICE WITH NO SESSION DOES NOT KNOCK, and the session is read at
 * EACH beat rather than captured: a player who signs in mid-sitting
 * starts counting at the next beat, and one who signs out stops.
 *
 * AN `auth` ANSWER IS LEFT ALONE HERE. Forgetting a dead session is the
 * minter's and the card's job, each of which can say so to the player;
 * a background counter signing somebody out with nothing on screen to
 * explain it would be a sign-out out of nowhere.
 */
export function accountPlayBeat({ fetch, storage }) {
  return async () => {
    const session = storedSession(storage);
    if (!session) return null;
    return beatPlay({ fetch, base: serviceBase(storage), secret: session.secret });
  };
}

/** DUEL1: the LOSER's own report of a duel - `winner` the account the
 *  relay stamped on the winner's frames. `{ recorded, wins, losses }`. */
export const reportDuelLoss = (io, winner) => call(io, '/v1/duel/loss', { winner });
/** DUEL1: any account's duelling record, `{ id, wins, losses }`. */
export const readDuelRecord = (io, id) => call(io, '/v1/duel/record', { id });

/**
 * DUEL1: THE DUELLING RECORD'S TWO CALLS, bound to this device's stored
 * session (read at each call, as the beat reads it). With no session
 * there is no account to lose with or to ask as: `{ ok: false, error:
 * 'no-session' }`, never a knock.
 */
export function accountDuels({ fetch, storage }) {
  const io = () => { const s = storedSession(storage); return s ? { fetch, base: serviceBase(storage), secret: s.secret } : null; };
  return {
    lost: async (winner) => { const i = io(); return i ? reportDuelLoss(i, winner) : { ok: false, error: 'no-session' }; },
    record: async (id) => { const i = io(); return i ? readDuelRecord(i, id) : { ok: false, error: 'no-session' }; },
  };
}

/** WB5b: the kill receipt the relay signed for this account, carried to
 *  the service - `{ recorded, closed }`, or `{ recorded: false, why }`
 *  (`claimed`, `guest`). */
export const claimGateReceipt = (io, receipt, extra = null) => call(io, '/v1/gate/claim', { receipt, ...(extra ?? {}) });   // SEAT1b: `extra` the kill's `region` and the claiming `character`

/**
 * WB5b: THE GATES' ONE CALL, bound to this device's stored session (read
 * at each call, as the duels' are). With no session there is no account
 * to claim for: `{ ok: false, error: 'no-session' }`, never a knock - and
 * net/gateClaims.js keeps the receipt for when there is one.
 */
export function accountGates({ fetch, storage }) {
  const io = () => { const s = storedSession(storage); return s ? { fetch, base: serviceBase(storage), secret: s.secret } : null; };
  return {
    claim: async (receipt, extra = null) => { const i = io(); return i ? claimGateReceipt(i, receipt, extra) : { ok: false, error: 'no-session' }; },
    /** AUDIT WB A9: the signed-in account's id - the receipts this device may offer are its alone. */
    me: () => storedSession(storage)?.id ?? null,
  };
}

/** RAID4: a town raid's receipt the relay signed for this account, carried to the service with the character that
 *  fought it - `{ recorded, defended, renown, order }`, or `{ recorded: false, why }` (`claimed`, `guest`, `day-full`). */
export const claimRaidReceipt = (io, receipt, character, name = null, cid = null) => call(io, '/v1/raid/claim', { receipt, character, name, ...(cid ? { cid } : {}) });   // AUDIT RAID R4: `cid` this device's claim of it - the thanks' key

/**
 * RAID4: THE TOWNS' ONE CALL, bound to this device's stored session (the gates' own shape). With no session there is
 * no account to claim for: `{ ok: false, error: 'no-session' }`, never a knock - and net/raidClaims.js keeps the
 * receipt for when there is one.
 */
export function accountRaids({ fetch, storage }) {
  const io = () => { const s = storedSession(storage); return s ? { fetch, base: serviceBase(storage), secret: s.secret } : null; };
  return {
    claim: async (receipt, character, name = null, cid = null) => { const i = io(); return i ? claimRaidReceipt(i, receipt, character, name, cid) : { ok: false, error: 'no-session' }; },
    /** The signed-in account's id - the receipts this device may offer are its alone (AUDIT WB A9's law). */
    me: () => storedSession(storage)?.id ?? null,
  };
}

/**
 * ARENA4: THE ARENA (server-account/src/arena.js) through the one door - a bout's receipt the relay signed, carried here
 * by an account it names (`claim`); the boards, counted from the rows (`board` - the season's ratings, the climb, the
 * banners, the Hall of Champions, and this account's own); a banner joined or quit (`team` - 'red', 'blue' or null).
 * Every answer is `call`'s shape, waited for ACCOUNT_ACT_WAIT_MS at most; no session is `no-session`, never a throw.
 * `me()` the signed-in account's id - the receipts this device may offer are its alone (AUDIT WB A9's law).
 */
export function accountArena({ fetch, storage, waitMs = ACCOUNT_ACT_WAIT_MS }) {
  const post = waitedPost({ fetch, storage }, waitMs);
  return {
    // ARENA4b: and the character that fought it (its `name` for the track) - a won bout's Renown is that character's
    claim: (receipt, character = null, name = null) => post('/v1/arena/claim', { receipt, ...(character ? { character } : {}), ...(name ? { name } : {}) }),
    board: () => post('/v1/arena/board', {}),
    team: (banner) => post('/v1/arena/team', { banner: banner ?? null }),
    me: () => storedSession(storage)?.id ?? null,
  };
}

/** RENOWN1: what one of this account's characters earned online - `{ character, xp, level, credited, rose, order }`. */
export const reportRenownXp = (io, character, xp, name = null, rid = null, region = null) => call(io, '/v1/renown/xp', { character, xp, name, ...(rid ? { rid } : {}), ...(region != null ? { region } : {}) });   // AUDIT RENOWN1 DATA-4: `rid` the report's own id; SEAT1b: `region` where it was earned

/**
 * RENOWN1: THE RENOWN'S REPORT, bound to this device's stored
 * session (read at each call, as the beat reads it). With no session
 * there is no account to earn for: `{ ok: false, error: 'no-session' }`,
 * never a knock.
 */
export function accountRenown({ fetch, storage }) {
  const report = async (character, xp, name = null, rid = null, keepalive = false, region = null) => {
    const s = storedSession(storage);
    return s ? reportRenownXp({ fetch, base: serviceBase(storage), secret: s.secret, keepalive }, character, xp, name, rid, region) : { ok: false, error: 'no-session' };
  };
  return {
    report: (character, xp, name = null, rid = null, region = null) => report(character, xp, name, rid, false, region),
    /** AUDIT RENOWN1 GAME-8: the same report as the page goes - `keepalive`, so the browser finishes it after the page. */
    leave: (character, xp, name = null, rid = null, region = null) => report(character, xp, name, rid, true, region),
  };
}

/** A POST through `call` on this device's stored session - `no-session` when there is none, never a throw. The homes'
 *  and the decor's doors (HOME1, DECOR1) both speak through it. */
function sessionPost({ fetch, storage }) {
  return async (path, body) => {
    const s = storedSession(storage);
    return s ? call({ fetch, base: serviceBase(storage), secret: s.secret }, path, body) : { ok: false, error: 'no-session' };
  };
}

/**
 * HOME1: THE ONLINE HOMES (server-account/src/homes.js) through the one door - a town's homes, the caller's own, and
 * the three that change one. Every answer is `call`'s shape; no session is `no-session`, never a throw.
 */
export function accountHomes({ fetch, storage }) {
  const post = sessionPost({ fetch, storage });
  return {
    town: (mapId, character = null) => post('/v1/homes/town', { mapId, ...(character ? { character } : {}) }),   // HOME-RENT: the playing character's own tenancies
    mine: () => post('/v1/homes/mine', {}),
    claim: ({ mapId, buildingKey, region, character, price, realm = null, layout = null }) => post('/v1/homes/claim', { mapId, buildingKey, region, character, price, ...(realm ? { realm } : {}), layout: layout || null }),   // REALM P2.2b: a realm character's record pays; WD3: the layout the town stands in, always said (null: Daggerfall's - AUDIT WD3 B2)
    layouts: () => post('/v1/homes/layouts', {}),   // WD3: every town holding a home, and the layout it keeps
    release: (mapId, buildingKey, realm = null) => post('/v1/homes/release', { mapId, buildingKey, ...(realm ? { realm } : {}) }),
    entry: (mapId, buildingKey, entry) => post('/v1/homes/entry', { mapId, buildingKey, entry }),
    // HOME-RENT: a home's rooms (server-account/src/rent.js) - read at its door, offered and withdrawn by its owner, rented
    // by another player's realm character on its record, and the rent collected by the owner on theirs
    rooms: (mapId, buildingKey, character = null) => post('/v1/homes/rooms', { mapId, buildingKey, ...(character ? { character } : {}) }),   // the character: whose tenancy is `yours`
    offerRoom: ({ mapId, buildingKey, character, room, anchor, price }) => post('/v1/homes/rooms/offer', { mapId, buildingKey, character, room, anchor, price }),
    withdrawRoom: ({ mapId, buildingKey, character, room }) => post('/v1/homes/rooms/withdraw', { mapId, buildingKey, character, room }),
    rentRoom: ({ mapId, buildingKey, character, room, days, price, realm = null }) => post('/v1/homes/rooms/rent', { mapId, buildingKey, character, room, days, price, ...(realm ? { realm } : {}) }),
    collectRent: ({ mapId, buildingKey, character, realm = null }) => post('/v1/homes/rooms/collect', { mapId, buildingKey, character, ...(realm ? { realm } : {}) }),
    // HOME-LOOK: how a home looks outside, painted by its owner (null: the town's own)
    look: ({ mapId, buildingKey, character, look = null }) => post('/v1/homes/look', { mapId, buildingKey, character, look }),
    // ARENA4b: a home the arena displaced, moved to the house this client picked (its record named when the pieces' refund
    // comes onto it); the moves this character has not read; and one read
    arenaMove: ({ mapId, from, to, character, realm = null }) => post('/v1/homes/arena-move', { mapId, from, to, character, ...(realm ? { realm } : {}) }),
    arenaMoves: (character) => post('/v1/homes/arena-moves', { character }),
    arenaSeen: (mapId, from) => post('/v1/homes/arena-seen', { mapId, from }),
  };
}

/** AUDIT DECOR-SHELL 2: how long an online home's list is waited for before it is given up. */
export const DECOR_LIST_WAIT_MS = 10_000;

/**
 * DECOR1: AN ONLINE HOME'S DECOR (server-account/src/decor.js) through the one door - the pieces standing in a home,
 * and the three writes, one piece each, that change them. Every answer is `call`'s shape; no session is `no-session`,
 * never a throw. AUDIT DECOR-SHELL 2: the list is waited for `listWaitMs` at most - a request that stalled held the
 * room's decorator shut for the whole visit (the host opens it on the list's answer); given up, it is aborted and
 * answered 'offline', as a request that never reached the service is, and the host asks again.
 */
export function accountDecor({ fetch, storage, listWaitMs = DECOR_LIST_WAIT_MS }) {
  const post = sessionPost({ fetch, storage });
  const waited = waitedPost({ fetch, storage }, listWaitMs);
  return {
    list: (mapId, buildingKey, seat = false) => waited('/v1/homes/decor', { mapId, buildingKey, ...(seat ? { seat: true } : {}) }),   // SEAT-HALL: a palace's Charter Room
    place: ({ mapId, buildingKey, character, piece, realm = null, yard = false, seat = false }) => post('/v1/homes/decor/place', { mapId, buildingKey, character, piece, ...(realm ? { realm } : {}), ...(yard ? { yard: true } : {}), ...(seat ? { seat: true } : {}) }),   // REALM P2.2b: and its gold on the record; HOME-YARD: outside
    yards: (mapId) => waited('/v1/homes/yards', { mapId }),   // HOME-YARD: every yard of a town
    move: ({ mapId, buildingKey, character, id, place, realm = null, seat = false }) => post('/v1/homes/decor/move', { mapId, buildingKey, character, id, place, ...(realm ? { realm } : {}), ...(seat ? { seat: true } : {}) }),
    remove: ({ mapId, buildingKey, character, id, realm = null, seat = false }) => post('/v1/homes/decor/remove', { mapId, buildingKey, character, id, ...(realm ? { realm } : {}), ...(seat ? { seat: true } : {}) }),
    // BASE-HIDE: the room's own furniture taken out - the whole list, written by the owner
    hidden: ({ mapId, buildingKey, character, keys }) => post('/v1/homes/decor/hidden', { mapId, buildingKey, character, keys }),
  };
}

/**
 * GUILD1: THE GUILDS (server-account/src/guilds.js) through the one door - the character's guild, the account's
 * invitations, and every change to one. Every answer is `call`'s shape; no session is `no-session`, never a throw.
 */
export function accountGuilds({ fetch, storage }) {
  const post = sessionPost({ fetch, storage });
  return {
    mine: (character) => post('/v1/guilds/mine', { character }),
    invites: () => post('/v1/guilds/invites', {}),
    found: ({ character, name, tag, realm = null, region = null }) => post('/v1/guilds/found', { character, name, tag, ...(realm ? { realm, region } : {}) }),   // REALM P2.2: a realm character's record pays
    invite: (character, handle) => post('/v1/guilds/invite', { character, handle }),
    answer: ({ character, guild, accept }) => post('/v1/guilds/answer', { character, guild, accept }),
    leave: (character) => post('/v1/guilds/leave', { character }),
    remove: (character, member) => post('/v1/guilds/remove', { character, member }),
    rank: (character, member, rank) => post('/v1/guilds/rank', { character, member, rank }),
    ranks: (character, ranks) => post('/v1/guilds/ranks', { character, ranks }),
    deposit: (character, gold, realm = null, region = null) => post('/v1/guilds/deposit', { character, gold, ...(realm ? { realm, region } : {}) }),   // REALM P2.2
    // GUILD-LETTER (FIELD BUGS 2026-09-30): `letter`, the record takes it as a letter of credit - the pack cannot carry it
    withdraw: (character, gold, realm = null, letter = false) => post('/v1/guilds/withdraw', { character, gold, ...(realm ? { realm, letter: letter === true } : {}) }),
    handOver: (character, member) => post('/v1/guilds/handover', { character, member }),
    disband: (character) => post('/v1/guilds/disband', { character }),
    // GUILD1d (Seats-Arc 8): the hall bought and sold from the treasury, who may walk in, and the heraldry (`rid`: a change
    // after the first burns Drakes, and a change asked twice is one line)
    hallBuy: ({ character, mapId, buildingKey, region, price }) => post('/v1/guilds/hall/buy', { character, mapId, buildingKey, region, price }),
    hallSell: (character) => post('/v1/guilds/hall/sell', { character }),
    hallEntry: (character, entry) => post('/v1/guilds/hall/entry', { character, entry }),
    heraldry: (character, heraldry, rid = null) => post('/v1/guilds/heraldry', { character, heraldry, ...(rid ? { rid } : {}) }),
  };
}

/** AUDIT 28 M6 / N6: how long one Marks or Notice Board request is waited for before it is given up as `offline` - a
 *  line that stayed open with nothing coming back held the Bank's counting box (and a board's read) until the browser
 *  gave up, minutes a try. Given up, the act is asked again with the SAME request id, or kept. */
export const ACCOUNT_ACT_WAIT_MS = 15_000;
/** A session POST that gives up after `ms` (AbortSignal.timeout - an abort is `call`'s `offline`). */
function waitedPost({ fetch, storage }, ms) {
  const wait = () => (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(ms) : undefined);
  return sessionPost({ fetch: (url, init) => fetch(url, { ...init, signal: wait() }), storage });
}

/**
 * MARKS1: MARKS (server-account/src/marks.js) through the one door - the balance, the Bank's exchange (Marks for gold,
 * never the other way), a guild's Marks treasury and the developers' report. Every act carries its own request id, so an
 * answer lost and asked again is answered again, never charged twice. Every answer is `call`'s shape; each is waited
 * for ACCOUNT_ACT_WAIT_MS at most. `account()` is the account this device is signed in as (AUDIT 28 M2: a kept sale is
 * asked again only under the account that made it).
 */
export function accountMarks({ fetch, storage, waitMs = ACCOUNT_ACT_WAIT_MS }) {
  const post = waitedPost({ fetch, storage }, waitMs);
  return {
    account: () => storedSession(storage)?.id ?? null,
    balance: () => post('/v1/marks/balance', {}),
    exchange: (marks, rid) => post('/v1/marks/exchange', { marks, rid }),
    guildDeposit: (character, marks, rid) => post('/v1/marks/guild/deposit', { character, marks, rid }),
    guildWithdraw: (character, marks, rid) => post('/v1/marks/guild/withdraw', { character, marks, rid }),
    report: () => post('/v1/marks/report', {}),
  };
}

/**
 * NOTICE1: THE NOTICE BOARD (server-account/src/board.js) through the one door - a town's board read, a note pinned
 * (with its own request id, so a pin asked again is the note it made), taken down and reported; a moderator's remove
 * and restore; a developer's notice. Every answer is `call`'s shape.
 */
export function accountBoard({ fetch, storage, waitMs = ACCOUNT_ACT_WAIT_MS }) {
  const post = waitedPost({ fetch, storage }, waitMs);   // AUDIT 28 N6: a read or a pin that hangs is given up, never wedged
  return {
    read: (map) => post('/v1/board/read', { map }),
    pin: ({ map, subject, body, days, button = null, character = null }, rid) => post('/v1/board/pin', { map, subject, body, days, button, character, rid }),
    takeDown: (id) => post('/v1/board/take-down', { id }),
    report: (id) => post('/v1/board/report', { id }),
    modRemove: (id) => post('/v1/board/mod/remove', { id }),
    modRestore: (id) => post('/v1/board/mod/restore', { id }),
    notice: ({ subject, body, days }, rid) => post('/v1/board/notice', { subject, body, days, rid }),
    noticeRemove: (id) => post('/v1/board/notice/remove', { id }),
    // GUILD1e: the guild's own board - its members', named by the character (server-account/src/guildBoard.js)
    guildRead: (character) => post('/v1/guilds/board', { character }),
    guildPin: ({ character, subject, body, days }, rid) => post('/v1/guilds/board/pin', { character, subject, body, days, rid }),
    guildTakeDown: (character, id) => post('/v1/guilds/board/take-down', { character, id }),
  };
}

/** SEAT1a: THE SEATS' REGISTRY (server-account/src/townSeats.js) through the one door - the seats the witnesses confirmed,
 *  a seat this client stands in reported, and a developer's strike (VOID: and a moderator's void of a battle). Each waited
 *  for ACCOUNT_ACT_WAIT_MS at most. */
export function accountSeats({ fetch, storage, waitMs = ACCOUNT_ACT_WAIT_MS }) {
  const post = waitedPost({ fetch, storage }, waitMs);
  return {
    /** SEAT1b: the account this device is signed in as - the Watch's receipts it may claim are its alone. */
    me: () => storedSession(storage)?.id ?? null,
    list: () => post('/v1/seats/list', {}),
    witness: (seat) => post('/v1/seats/witness', { seat }),
    strike: (key) => post('/v1/seats/strike', { key }),
    voidSiege: (key) => post('/v1/seats/siege/void', { key }),   // VOID (Seats-Arc 18): a moderator's `/siege void <key>`
    // SEAT1b: influence - the standings at a seat (with the reader's own guild), a pledge set or taken down, the Watch's
    // receipts claimed, Tribute paid under its own request id
    standings: (key, character) => post('/v1/seats/standings', { key, character }),
    records: (key) => post('/v1/seats/records', { key }),   // SEASON1 part three: a seat's Hall of Records
    pledge: (character, key, region = null) => post('/v1/seats/pledge', { character, key, ...(region != null ? { region } : {}) }),
    watch: (character, receipts) => post('/v1/seats/watch', { character, receipts }),
    tribute: (character, key, marks, rid) => post('/v1/seats/tribute', { character, key, marks, rid }),
    relinquish: (character, key) => post('/v1/seats/relinquish', { character, key }),   // SEAT1c
    // SEAT1d: the holder's levers at its board - the Tithe, the coming week's Edict (null takes it back); a Bounty's camp
    tithe: (character, key, pct) => post('/v1/seats/tithe', { character, key, pct }),
    edict: (character, key, edict, setAside = 0) => post('/v1/seats/edict', { character, key, edict, ...(edict === 'bounty' ? { setAside } : {}) }),
    bounty: (character, site, region) => post('/v1/seats/bounty', { character, site, region }),
    // SEAT2a: the battles' week - the holder's window; a side signed and unsigned; a Sellsword hired and withdrawn
    window: (character, key, day, hour) => post('/v1/seats/window', { character, key, day, hour }),
    sign: (character, key) => post('/v1/seats/siege/sign', { character, key }),
    unsign: (key) => post('/v1/seats/siege/unsign', { key }),
    hire: (character, key, handle, fee = 0) => post('/v1/seats/siege/hire', { character, key, handle, fee }),
    withdrawHire: (character, key, handle) => post('/v1/seats/siege/withdraw', { character, key, handle }),
    // SEAT2a part three: a battle's pass (the field this game derived from the town); a fighter's receipt claimed
    pass: (key, field) => post('/v1/seats/siege/pass', { key, ...(field ? { field } : {}) }),
    claimSiege: (receipt, character) => post('/v1/seats/siege/claim', { receipt, character }),
    // CROWN1 part two: a Royal Tourney's pass (a contender's ring, or a spectator's); a bout's receipt claimed
    royalPass: (key, field, watch) => post('/v1/seats/royal/pass', { key, ...(field ? { field } : {}), ...(watch ? { watch: true } : {}) }),
    claimRoyal: (receipt) => post('/v1/seats/royal/claim', { receipt }),
    // CROWN2: fealty offered (`as` 'vassal' or 'liege'), accepted, broken or withdrawn; a Pact offered or signed, broken
    // SEAT2b: a seat's works read; a project begun (`port`: DFU names the town a port - a Harbour's ask)
    forts: (key) => post('/v1/seats/forts', { key }),
    fortFund: (character, key, work, rid, port = false) => post('/v1/seats/fort/fund', { character, key, work, rid, ...(port ? { port: true } : {}) }),
    fealty: (character, tag, as) => post('/v1/seats/fealty', { character, tag, as }),
    fealtyAccept: (character, tag) => post('/v1/seats/fealty/accept', { character, tag }),
    fealtyBreak: (character, tag) => post('/v1/seats/fealty/break', { character, ...(tag ? { tag } : {}) }),
    pact: (character, tag) => post('/v1/seats/pact', { character, tag }),
    pactBreak: (character, tag) => post('/v1/seats/pact/break', { character, tag }),
    // SEASON1 part two: an Orc Raid's camp cleared
    orcCamp: (character, site, region) => post('/v1/seats/orc-camp', { character, site, region }),
  };
}

/**
 * PROF1: THE PROFESSIONS (server-account/src/professions.js) through the one door - a character's state, its streamed
 * pixels' states, a harvest, a specialisation, a withdrawal to the pack, a region's Court writs and a delivery. Every
 * act carries its own request id, so an answer lost and asked again is answered again, never credited twice. Every
 * answer is `call`'s shape; each is waited for ACCOUNT_ACT_WAIT_MS at most. `account()` - the account this device is
 * signed in as (a kept act is asked again only under the account that made it).
 */
export function accountProf({ fetch, storage, waitMs = ACCOUNT_ACT_WAIT_MS }) {
  const post = waitedPost({ fetch, storage }, waitMs);   // every ask given up after the wait, never wedged (AUDIT 28 M6's law)
  return {
    account: () => storedSession(storage)?.id ?? null,
    state: (character) => post('/v1/prof/state', { character }),
    pixels: (character, pixels, dungeons = []) => post('/v1/prof/pixels', { character, pixels, dungeons }),   // PROF2: the dungeon stood in
    harvest: (req) => post('/v1/prof/harvest', req),
    spec: (character, profession, rank, spec, from, rid) => post('/v1/prof/spec', { character, profession, rank, spec, from, rid }),   // AUDIT 29 A15: `from`, the choice the client saw standing
    withdraw: (character, material, qty, rid) => post('/v1/stores/withdraw', { character, material, qty, rid }),
    smelt: (character, recipe, count, rid, clean = false) => post('/v1/prof/smelt', { character, recipe, count, rid, ...(clean === true ? { clean: true } : {}) }),   // PROF2: the forge; PROF11: the mason's bench, `clean` the chisel's report
    craft: (character, recipe, clean, name, rid, heartwood = false, dye = null, seat = null, cracked = false) => post('/v1/prof/craft', { character, recipe, clean, name, rid, heartwood, ...(dye == null ? {} : { dye }), ...(seat == null ? {} : { seat }), ...(cracked === true ? { cracked: true } : {}) }),   // SEAT2b part two: `seat` the held town the station stands in   // PROF3: the anvil - `clean` the act's report, `name` the maker's mark; PROF4: the workbench, `heartwood` for a plank; PROF7: the loom, a garment's `dye`; PROF10: the jeweller's bench, `cracked` a Lapidary's Siege-cracked Gem for the gem
    stock: (character, material, qty, rid) => post('/v1/prof/stock', { character, material, qty, rid }),   // PROF3: the smith's stock
    brew: (character, potion, keys, rid, seat = null) => post('/v1/prof/brew', { character, potion, keys, rid, ...(seat == null ? {} : { seat }) }),   // PROF12: the alchemy station's brew - `keys` the cauldron as the Stores hold it, `seat` the held town it stands in
    disenchant: (character, provenance, rid, realm = null) => post('/v1/prof/disenchant', { character, provenance, rid, ...(realm ? { realm } : {}) }),   // PROF12: a crafted piece into Arcane Essence; AUDIT PROF-541 B2: a realm character's record where it stands
    writs: (character, region) => post('/v1/writs/list', { character, region }),
    deliver: (character, id, rid) => post('/v1/writs/deliver', { character, id, rid }),
  };
}

/** PROF5: the market's door (server-account/src/market.js) - the Market tab's views and every act, each with the
 *  board's region and the hubs this client derived (the courier's road, witnessed - PROF0 26). */
export function accountMarket({ fetch, storage, waitMs = ACCOUNT_ACT_WAIT_MS }) {
  const post = waitedPost({ fetch, storage }, waitMs);
  return {
    account: () => storedSession(storage)?.id ?? null,
    read: (req) => post('/v1/market/read', req),
    list: (req) => post('/v1/market/list', req),
    buy: (req) => post('/v1/market/buy', req),
    cancel: (character, listing, rid) => post('/v1/market/cancel', { character, listing, rid }),
    order: (req) => post('/v1/market/order', req),
    fill: (req) => post('/v1/market/fill', req),
    unorder: (order, rid) => post('/v1/market/unorder', { order, rid }),
    // MARKET-ANY: a piece from a pack goes into the record - where it stands (`realm`) with it
    collect: (character, delivery, rid, realm = null) => post('/v1/market/collect', { character, delivery, rid, ...(realm ? { realm } : {}) }),
    report: (listing) => post('/v1/market/report', { listing }),
    remove: (listing) => post('/v1/market/remove', { listing }),
    // PROF5b: an auction posted (a Masterwork at its opening bid), and a bid on one
    auction: (req) => post('/v1/market/auction', req),
    bid: (req) => post('/v1/market/bid', req),
    // GOLD-MARKET: a realm character's gold its sales hold, collected into its record (`{ character, realm, region }`)
    gold: (req) => post('/v1/market/gold', req),
  };
}

/** PROF6: the writs' door beside the Court's (server-account/src/writs.js) - a guild writ posted, supplied, withdrawn,
 *  the Officers' budget; a commission posted, fulfilled, cancelled, declined; the guild Stores read and moved. */
export function accountWrits({ fetch, storage, waitMs = ACCOUNT_ACT_WAIT_MS }) {
  const post = waitedPost({ fetch, storage }, waitMs);
  return {
    account: () => storedSession(storage)?.id ?? null,
    post: (req) => post('/v1/writs/post', req),
    supply: (req) => post('/v1/writs/supply', req),
    withdraw: (req) => post('/v1/writs/withdraw', req),
    budget: (req) => post('/v1/writs/budget', req),
    commission: (req) => post('/v1/writs/commission', req),
    fulfil: (req) => post('/v1/writs/fulfil', req),
    cancel: (commission, rid) => post('/v1/writs/cancel', { commission, rid }),
    decline: (commission, rid) => post('/v1/writs/decline', { commission, rid }),
    stores: (character) => post('/v1/stores/guild', { character }),
    deposit: (req) => post('/v1/stores/guild-deposit', req),
    withdrawStores: (req) => post('/v1/stores/guild-withdraw', req),
  };
}

/** The service this device talks to. Overridable the same way the
 *  relay is, so a test deployment can be pointed at without a build. */
export function serviceBase(storage) {
  try {
    const v = storage?.getItem?.(SERVICE_KEY);
    return (typeof v === 'string' && /^https:\/\/\S+$/.test(v)) ? v : DEFAULT_ACCOUNT_SERVICE;
  } catch { return DEFAULT_ACCOUNT_SERVICE; }
}
