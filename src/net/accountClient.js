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
// `register` and `recover` are the only two answers that carry one -
// RECOVERY-SET: and `newRecoveryCodes`, the profile's new set - and it
// is never written to storage here. The screen shows it and the
// player writes it down; a copy in localStorage would be a copy in the
// one place a stolen device reads first, and it would make "shown
// once" a sentence rather than a fact.
// ═══════════════════════════════════════════════════════════════════

import { HANDLE_RE } from './handleShape.js';
import { SESSION_PASS_HEADER } from './sessionPassLaw.js';   // SESSION-SIGN: the pass's one name on the wire
import { AURAS, ICONS } from './identityToken.js';   // WB9g: the auras that exist - a stored one is one of them, or none; WITCH1: and the icons
import { NAME_MAX } from './wire.js';   // NAME-AS: the wire's bound on a name, in the sentence that says a character's is past it
import { LETTER_SUBJECT_MAX, LETTER_BODY_MAX, LETTER_LINES_MAX, LETTERS_SENT_MAX, LETTERS_PAIR_MAX } from './letterLaw.js';   // MAIL1: the letter's bounds, in the refusals' own sentences
import { banRangeText, bannedText } from './safety/safetyLaw.js';   // SAFE4: a ban's bound in its refusal's sentence, from its home; AUDIT SAFE CLIENT-2: and the ban itself
import { muteRangeText } from './moderation.js';   // AUDIT 68 S14-mute-range-text-duplicated: the mute's bound in the refusal's sentence, from its home (L10N4: its reader)
import { HOME_CAP, RENT_ROOMS_MAX, RENT_HELD_MAX, RENT_DAYS_MAX } from './homeLaw.js';   // HOME1: the cap a refusal names; HOME-RENT: and the rooms'
import { DECOR_CAP, DECOR_YARD_CAP, DECOR_YARD_HIGH_WHY } from './decorLaw.js';   // DECOR1: the cap its refusal names; HOME-YARD: a yard's
import { MARKS_MAX, MARKS_BANK, MARKS_MOVE_MAX, MARKS_FAUCETS } from './marksLaw.js';   // MARKS1: the bounds its refusals name; CRAFT-WRITS: a crafting writ's day
import { NOTES_LIVE_MAX, NOTE_DAYS, NOTICE_DAYS_MAX } from './boardLaw.js';   // NOTICE1: the bounds its refusals name
import { SIGN_WHY, SIEGE_WHY, ROYAL_WHY, FEALTY_WHY, SELLSWORD_FEE_MAX } from './townSeatLaw.js';   // SEAT2a: the rosters' refusals in the board's own words; the fee's bound
import {
  DEEP_UNCONFIRMED_PER_DAY, STORES_MAX, WITHDRAW_MAX, COURT_WRITS_PER_DAY, RESPEC, HIGH_HIDES_PER_DAY,
} from './professionLaw.js';   // PROF1: the bounds its refusals name; PROF7: Hunting's rare hides (CAP-OFF: no day's cap)
import {
  GUILD_FOUND_RENOWN, GUILD_MEMBERS_MAX, GUILD_NAME_MIN, GUILD_NAME_MAX, GUILD_RANK_NAME_MAX, GUILD_MOVE_MAX,
  GUILD_RENAME_GOLD,
} from './guild/guildLaw.js';   // GUILD1: the bounds its refusals name; GUILD2a: a new name's price
import { GUILD_VAULT_SLOTS, GUILD_VAULT_HALL_SLOTS } from './guild/guildVaultLaw.js';   // GUILD2b: the vault's shelf, in its refusal's own sentence
import { MARKET_PRICE_MAX, MARKET_UNITS_MAX, MARKET_LISTINGS_MAX, MARKET_ORDERS_MAX, AUCTION_BID_MAX } from './marketLaw.js';   // PROF5: the bounds its refusals name
import { GUILD_WRITS_MAX, GUILD_STORES_MAX, COMMISSIONS_MAX, COMMISSIONS_FOR_MAX, WRIT_POSTS_MAX, WRIT_OPS_MAX, GUILD_CONTRACTS_MAX, CONTRACT_PAY_MAX, CONTRACT_DEEDS_MAX } from './writLaw.js';   // PROF6: the bounds its refusals name; SILVER-WAYS: a contract's
import { RENOWN_TRACKS_MAX } from './renown.js';   // RENOWN1: the tracks' bound, in its refusal's own sentence (RENOWN-CHAR: back with the tracks)
import { SERPENT_EMBERS } from './serpent/serpentHoardLaw.js';   // AUDIT 625 P4: the embers this build's serpent hoard mints, said with its claim
import { HERALDRY_CHANGE_DRAKES } from './heraldryLaw.js';   // GUILD1d: a change's cost, in its refusal's own sentence
import { t, localizedTable } from '../systems/textManager.js';   // L10N4: the refusals in the player's language, each read when it is said
import { VENDOR_REFUSAL_WORDS } from './vendorLaw.js';   // HOME-VENDOR: a trader's refusals
import { SEA_BOUNTY_MIN, SEA_BOUNTY_MAX } from './sea/seaBountyLaw.js';   // SEA-BOUNTY: a post's bounds, in its refusal
import { busyRead, busyAnswer, busyWaitMs, retryAfterMs, BUSY_HOLD_MS } from './busyLaw.js';   // BUSY-GATE: the reads that stand back while the service is overloaded
import { ARENA_TEXT } from '../systems/arena/arenaText.js';   // ARENA4b: the arena's refusals, in its own frozen table
import { cardById } from './iliac/iliacCards.js';   // AUDIT CARDS-6 D7: the card a short deck lacks, said by its name
import { jittered } from './backoff.js';   // STORM-SHED: a failed mint's hold, jittered as every book's wait is

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
 *
 * L10N4: AND IN THE PLAYER'S LANGUAGE. Each sentence is a getter
 * through `t('account.refusal.<word>', English, bounds)`, read at the
 * moment it is said - never at module load, which runs before the boot
 * chooses the language. The machine words stay the keys, and English
 * reads exactly as it did. The seat board's own tables (townSeatLaw.js)
 * - and a trader's (vendorLaw.js), the arena's (arenaText.js) and the
 * yard's height (decorLaw.js) - are read through their own home, entry
 * by entry, as they are said.
 * REFUSALS is the frozen table of getters over these (localizedTable).
 */
/** L10N4: another table's sentences, each read from it when it is read here, so a table routed in its own home stays routed. */
const readEach = (table) => Object.fromEntries(Object.keys(table).map((k) => [k, () => table[k]]));
const REFUSAL_WORDS = {
  'handle-shape': () => t('account.refusal.handleShape', 'A username is one word, 3 to {max} characters, starting with a letter, and no spaces.', { max: HANDLE_MAX_LEN }),
  'handle-refused': () => t('account.refusal.handleRefused', 'That username is not allowed. Pick another.'),
  'handle-email': () => t('account.refusal.handleEmail', 'A username cannot be an email address, because other players see it. Pick another name.'),   // HANDLE-EMAIL
  'handle-taken': () => t('account.refusal.handleTaken', 'Somebody already has that username. Pick another.'),
  'password-shape': () => t('account.refusal.passwordShape', 'That password cannot be used. Choose another.'),
  'password-short': () => t('account.refusal.passwordShort', 'A password is at least {min} characters.', { min: PASSWORD_MIN_LEN }),
  'password-long': () => t('account.refusal.passwordLong', 'A password is at most {max} characters.', { max: PASSWORD_MAX_LEN }),
  'already-registered': () => t('account.refusal.alreadyRegistered', 'This account already has a username.'),
  'not-registered': () => t('account.refusal.notRegistered', 'This account has no password yet.'),
  // TERMS1: the two routes that make an account refuse a request that has not ticked the documents they hold
  'terms-unaccepted': () => t('account.refusal.termsUnaccepted', 'Tick both boxes to agree to the Terms of Service and the Privacy Policy.'),
  'terms-stale': () => t('account.refusal.termsStale', 'The Terms of Service or the Privacy Policy has changed. Reload the game (or update the app) to read the current version, then tick the boxes again.'),   // AUDIT PRE-MERGE 0929 T1: a reload brings the desktop app's own bundled copy back - the app is updated
  'no-account': () => t('account.refusal.noAccount', 'That account no longer exists.'),
  'bad-login': () => t('account.refusal.badLogin', 'That username and password do not match.'),
  'bad-code': () => t('account.refusal.badCode', 'That username and recovery code do not match.'),
  'codes-moved': () => t('account.refusal.codesMoved', 'Your recovery codes changed in the meantime. Try again.'),   // RECOVERY-SET: two presses raced (accounts.js newRecoveryCodes)
  // POI-1: the POI store's refusals (server-account/src/poi.js) - the editor's, said to a builder or an approver
  'poi-not-builder': () => t('account.refusal.poiNotBuilder', 'Only builders can do that. Ask a developer to add your username to the builders.'),
  'poi-not-approver': () => t('account.refusal.poiNotApprover', 'Only an approver can decide what goes into the world.'),
  'poi-not-author': () => t('account.refusal.poiNotAuthor', 'Only the builder who made that draft can do that.'),
  'poi-sha': () => t('account.refusal.poiSha', 'That upload had the wrong file name. Reload the editor and try again.'),
  'poi-sha-mismatch': () => t('account.refusal.poiShaMismatch', 'That upload arrived damaged. Try again.'),
  'poi-kind': () => t('account.refusal.poiKind', 'That file is not the type it was sent as. Upload it again.'),
  'poi-bad-mesh': () => t('account.refusal.poiBadMesh', 'That model could not be read. Import it again.'),
  'poi-bad-texture': () => t('account.refusal.poiBadTexture', 'A texture must be a PNG, JPEG or WebP image no larger than 4096 pixels on a side.'),
  'poi-quota': () => t('account.refusal.poiQuota', 'You have uploaded all you can today. Try again tomorrow.'),
  'poi-doc': () => t('account.refusal.poiDoc', 'This place has problems to fix first. The editor lists them.'),
  'poi-state': () => t('account.refusal.poiState', 'That revision has changed since you opened it. Refresh and try again.'),
  'poi-not-live': () => t('account.refusal.poiNotLive', 'That POI is not in the world, so it cannot be retired.'),
  'poi-pending': () => t('account.refusal.poiPending', 'A retirement of that POI is already waiting for approval.'),
  // AUDIT POI: the store's newer words - a submission changed under the approver's look (S1), a builder's holdings full
  // (S10: a full shelf had been told a full day's uploads), and an entry taken off the shelf (U13: it had been told the
  // service does not know the request)
  'poi-changed': () => t('account.refusal.poiChanged', 'That submission has changed since you looked at it. Look at it again before you decide.'),
  'poi-drafts-full': () => t('account.refusal.poiDraftsFull', 'You have the most drafts and submissions a builder can have open. Send a draft, or wait for an approver to decide on one, before you start another.'),
  'poi-shelf-full': () => t('account.refusal.poiShelfFull', 'Your library shelf is full. Remove entries you no longer need to make room.'),
  'poi-shelf-spent': () => t('account.refusal.poiShelfSpent', 'You have added the most library entries a builder can, counting ones you removed. Ask a developer to make room.'),
  'poi-gone': () => t('account.refusal.poiGone', 'That library entry has been removed.'),
  email: () => t('account.refusal.email', 'That does not look like an email address.'),
  rate: () => t('account.refusal.rate', 'Too many attempts. Wait a few minutes and try again.'),
  auth: () => t('account.refusal.auth', 'You have been signed out. Sign in again.'),
  'no-signing-key': () => t('account.refusal.noSigningKey', 'The account service cannot confirm accounts right now. Try again later.'),
  // EG-PLAY: an Elite Breach's refusals (server-account/src/eg.js)
  rq: () => t('account.refusal.rq', 'The Spire could not read that request. Try again.'),
  unproven: () => t('account.refusal.unproven', 'The Spire opens only to those who have closed a Dagon\'s Breach.'),
  live: () => t('account.refusal.live', 'You hold a breach already.'),
  rehearsed: () => t('account.refusal.rehearsed', 'You have rehearsed the Spire today. A Weir Key opens it again.'),
  spent: () => t('account.refusal.spent', 'That breach is spent.'),
  breach: () => t('account.refusal.breach', 'That breach is not one the Spire knows.'),
  none: () => t('account.refusal.none', 'The Spire took no key for that.'),   // AUDIT EG IV (lane3 #1): an open asked again (`again`) whose ask never reached it
  // EG-E3: a dungeon elite's find (server-account/src/eg.js findEg)
  tier: () => t('account.refusal.tier', 'That is no dungeon the Spire knows.'),
  capped: () => t('account.refusal.capped', 'The dungeons have given all they will today. Come back tomorrow.'),
  bits: () => t('account.refusal.bits', 'The Spire could not read those lines.'),   // EG-ZF: the first-time lines' bits (server-account/src/eg.js egFirstSay)
  // EG-F: the start window's refusals (server-account/src/eg.js, egStarts.js)
  start: () => t('account.refusal.start', 'You may not start a breach that deep this season.'),
  wager: () => t('account.refusal.wager', 'The Spire could not read that Wager.'),
  subs: () => t('account.refusal.subs', 'The Spire could not read that company.'),
  body: () => t('account.refusal.body', 'The account service could not read that request.'),
  method: () => t('account.refusal.method', 'The account service refused that request.'),
  // The two the ROUTER refuses with, before any account is looked at.
  // Found by the pin that walks the service's own source rather than by
  // anybody remembering them: a player meeting a 404 or a cold database
  // deserves a sentence as much as one who mistyped a password.
  'not-found': () => t('account.refusal.notFound', 'The account service does not know that request. The game may need updating.'),
  'no-database': () => t('account.refusal.noDatabase', 'The account service is starting up. Try again in a moment.'),
  queue: () => t('account.refusal.queue', 'Many players are signing in at once, so you are in line. Try again in a few seconds.'),   // ADMIT-LINE (server-account/src/admit.js): the sign-in line
  // ACC2, the cloud saves. Every one of these is a sentence a player
  // can act on, which is the whole rule of this table - "too-large" is
  // not a thing to read and "that save is too big to back up" is.
  'saves-need-account': () => t('account.refusal.savesNeedAccount', 'Cloud saves need a username and a password. Give this account one and your saves can follow you.'),
  'too-many-saves': () => t('account.refusal.tooManySaves', 'Your cloud backup is full. Delete a save there to make room.'),
  'too-large': () => t('account.refusal.tooLarge', 'That save is too big to back up.'),
  'no-slot': () => t('account.refusal.noSlot', 'That save is not in your cloud backup.'),
  'no-data': () => t('account.refusal.noData', 'That backup was interrupted and is incomplete. Back it up again.'),
  'no-storage': () => t('account.refusal.noStorage', 'Cloud saves are unavailable right now. Try again later.'),
  // ACC3, the titles. `not-held` is the one a player can actually
  // meet - a title lapses (a developer taken off the list) between the
  // card being drawn and the button being pressed - so it says what
  // happened rather than blaming them. `no-title` is a build that has
  // fallen behind the service's vocabulary, which is a different thing
  // and gets a different sentence.
  'not-held': () => t('account.refusal.notHeld', 'That title is not yours to wear any more.'),
  'no-title': () => t('account.refusal.noTitle', 'The account service does not know that title. The game may need updating.'),
  // WB9g, the Broker's insignia (server-account/src/accounts.js buyInsignia, equipAura)
  'no-aura': () => t('account.refusal.noAura', 'The account service does not know that aura. The game may need updating.'),
  'no-glyph': () => t('account.refusal.noGlyph', 'The account service does not know that glyph. The game may need updating.'),   // GLYPH-WEAR
  // WITCH1, the Witches' Festival (server-account/src/festival.js) - the festival's own words, its keys shared with
  // systems/festival/festivalWords.js so the sentence is one in every language
  'no-icon': () => t('account.refusal.noIcon', 'The account service does not know that icon. The game may need updating.'),
  source: () => t('account.refusal.source', 'The account service does not know that. The game may need updating.'),
  rid: () => t('account.refusal.rid', 'That request could not be read. Try again.'),
  ware: () => t('festival.refusal.ware', 'The Wyrd Sister has no such thing.'),
  cakes: () => t('festival.refusal.cakes', 'You need more Soul Cakes.'),
  home: () => t('festival.refusal.home', 'Set it out at your own home.'),
  set: () => t('festival.refusal.set', 'An offering already stands here.'),
  full: () => t('festival.refusal.full', 'The bowl is full.'),
  own: () => t('festival.refusal.own', 'This offering is your own.'),
  item: () => t('festival.refusal.item', 'You have no Hearth Offering.'),
  'no-name-as': () => t('account.refusal.noNameAs', 'The account service does not know that choice of name. The game may need updating.'),   // NAME-AS
  'no-insignia': () => t('account.refusal.noInsignia', 'The Broker does not sell that any more. The game may need updating.'),
  owned: () => t('account.refusal.owned', 'Your account already owns that.'),
  bought: () => t('account.refusal.bought', 'You have bought from the Panoply this week. Come back next week.'),   // EG-E1: the Broker's Panoply sink, once a week (server-account/src/egEconomy.js egSink)
  piece: () => t('account.refusal.piece', 'The Broker does not sell that piece. The game may need updating.'),
  short: () => t('account.refusal.short', 'Your account has too few embers for that.'),   // WB12a; WB13b: the card says the rule; AUDIT WB12d (A4): a rite's ember counts, and is no breach closed
  guest: () => t('account.refusal.guest', 'Insignia need a registered account. Add a username and password first.'),
  // ARENA4, the banners (server-account/src/arena.js arenaTeam)
  'bad-banner': () => t('account.refusal.badBanner', 'The arena knows only the Red Banner and the Blue. The game may need updating.'),
  // AUDIT ARENA-LADDER, a ladder attempt's ticket (arena.js arenaAttempt): a bout that is not the climb's next, and a
  // tier or bout out of the ladder's
  'order': () => t('account.refusal.order', 'That is not your next ladder bout. Open the Arena window to see where you stand.'),
  'bad-bout': () => t('account.refusal.badBout', 'The arena has no such ladder bout. The game may need updating.'),
  'ladder-needs-account': () => t('account.refusal.ladderNeedsAccount', 'The ladder online needs a username and a password. Give this account one and your climb is kept.'),   // AUDIT ARENA-LADDER 2: a guest climbs nothing online
  joined: () => t('account.refusal.joined', 'You already fight under a banner. Leave it at its recruiter first.'),
  season: () => t('account.refusal.season', 'You left that banner this season. You can rejoin it next season.'),
  // PATREON-LINK, a patron's own Patreon (server-account/src/patreon.js). `signature` is the webhook's, met by Patreon
  // and never a player; it has a sentence because every word the service says does.
  'patreon-closed': () => t('account.refusal.patreonClosed', 'Patreon linking is not available yet.'),
  'patreon-down': () => t('account.refusal.patreonDown', 'Patreon did not answer. Try linking again in a minute.'),
  'patreon-needs-account': () => t('account.refusal.patreonNeedsAccount', 'Linking Patreon needs a username and a password. Give this account one first.'),
  signature: () => t('account.refusal.signature', 'The account service could not check who sent that request.'),
  // MOD1, moderation. A moderator reads these in chat, beside the
  // command they just typed.
  'not-moderator': () => t('account.refusal.notModerator', 'Only moderators can do that.'),
  protected: () => t('account.refusal.protected', 'Moderators cannot be muted.'),
  'no-player': () => t('account.refusal.noPlayer', 'That player could not be found.'),
  // DUEL1: the duelling record - a loss named against oneself (two tabs of one account duelling)
  self: () => t('account.refusal.self', 'A duel against your own account does not count.'),
  'bad-minutes': muteRangeText,
  // MAIL1, letters. The words are the service's (server-account/src/letters.js) and the letter's law's
  // (net/letterLaw.js, which the service returns verbatim); every one says what to do next.
  'mail-needs-account': () => t('account.refusal.mailNeedsAccount', 'Letters need a username and a password. Give this account one and you can send and receive them.'),
  // SERVER-POST, the server's post (server-account/src/post.js): the developers' messages, and the items in them
  'post-needs-account': () => t('account.refusal.postNeedsAccount', 'The mailbox needs a username and a password. Give this account one and the developers can send you post.'),
  'no-post': () => t('account.refusal.noPost', 'That message is not in your mailbox any more.'),
  'post-no-item': () => t('account.refusal.postNoItem', 'That message holds no item to claim.'),
  'post-claimed': () => t('account.refusal.postClaimed', 'That item has already been claimed.'),
  'post-unclaimed': () => t('account.refusal.postUnclaimed', 'Claim the item in that message before you throw it away.'),
  // LOST-SPOILS: the Lost and Found's (server-account/src/lostSpoils.js) - the spoils pool turns each into its own line, but
  // every word the service can say has a sentence
  'lost-pieces': () => t('account.refusal.lostPieces', 'The Lost and Found could not take those spoils.'),
  'lost-item': () => t('account.refusal.lostItem', 'The Lost and Found will not keep a piece no fight could have dropped.'),
  'lost-no-kill': () => t('account.refusal.lostNoKill', 'The Lost and Found has no word of that fight yet.'),
  'lost-spent': () => t('account.refusal.lostSpent', 'Those spoils were left too long ago for the Lost and Found to take.'),
  'lost-full': () => t('account.refusal.lostFull', 'Your mailbox holds too many unclaimed spoils. Claim some first.'),
  // PRIVATE-REPORT, a player's private report to the developers (server-account/src/reports.js, net/reportLaw.js)
  'report-needs-account': () => t('account.refusal.reportNeedsAccount', 'Private reports need a username and a password, so the developers can follow up with you. Give this account one, then send it.'),
  'report-kind': () => t('account.refusal.reportKind', 'Choose what kind of problem this is.'),
  'report-subject': () => t('account.refusal.reportSubject', 'Give the report a short title, 3 to 80 characters.'),
  'report-body': () => t('account.refusal.reportBody', 'Describe the problem in 10 to 3,000 characters: what happens, and the steps that make it happen.'),
  'report-rid': () => t('account.refusal.reportRid', 'That report could not be sent. Try again.'),
  'report-rate': () => t('account.refusal.reportRate', 'You have sent several reports in the last hour. Wait a while, then send this one.'),
  'report-full': () => t('account.refusal.reportFull', 'You have 20 reports the developers have not closed yet. Wait for them to be looked at before you send more.'),
  'no-report': () => t('account.refusal.noReport', 'That report is not there any more.'),
  'not-report-reader': () => t('account.refusal.notReportReader', 'Only the developers who read private reports can open them.'),
  'report-state': () => t('account.refusal.reportState', 'That is not a way to close a report.'),
  muted: () => t('account.refusal.muted', 'You are muted, so you cannot send letters or pin notes until the mute ends.'),
  'no-reader': () => t('account.refusal.noReader', 'No registered player has that username.'),
  // NAME-AS: a friend's letter goes to their ACCOUNT (server-account/src/letters.js `toAccount`), so a friend with no
  // username yet is told apart from a username nobody has
  'reader-guest': () => t('account.refusal.readerGuest', 'They have no username yet, so they cannot get letters.'),
  'to-self': () => t('account.refusal.toSelf', 'You cannot send a letter to yourself.'),
  'inbox-full': () => t('account.refusal.inboxFull', 'Their letterbox is full until they throw some letters away.'),
  'no-letter': () => t('account.refusal.noLetter', 'That letter is not in your letterbox any more.'),
  'mail-rate': () => t('account.refusal.mailRate', 'You have sent too many letters. You can send {perHour} an hour, and {perPlayer} to one player.', { perHour: LETTERS_SENT_MAX, perPlayer: LETTERS_PAIR_MAX }),
  'no-subject': () => t('account.refusal.noSubject', 'A letter needs a subject.'),
  'subject-long': () => t('account.refusal.subjectLong', 'A subject is at most {max} characters.', { max: LETTER_SUBJECT_MAX }),
  'no-body': () => t('account.refusal.noBody', 'A letter needs some words.'),
  'body-long': () => t('account.refusal.bodyLong', 'A letter is at most {max} characters.', { max: LETTER_BODY_MAX }),
  'body-lines': () => t('account.refusal.bodyLines', 'A letter is at most {max} lines.', { max: LETTER_LINES_MAX }),
  // RENOWN1, Renown. Each is a build or a device the service does not believe, never a player's mistake:
  // the words say what happened, since there is nothing to retype. (RENOWN-CHAR: all three are this service's again.)
  'renown-character': () => t('account.refusal.renownCharacter', 'The account service could not tell which character earned that.'),
  'renown-xp': () => t('account.refusal.renownXp', 'The account service refused that experience report.'),
  'renown-full': () => t('account.refusal.renownFull', 'This account already has Renown for {max} characters, the most it keeps.', { max: RENOWN_TRACKS_MAX }),
  // HOME1, the online homes (server-account/src/homes.js). A player meets these at a front door, beside the price.
  'homes-need-account': () => t('account.refusal.homesNeedAccount', 'Owning a home needs a username and a password. Give this account one and you can buy one.'),
  'home-taken': () => t('account.refusal.homeTaken', 'Somebody else owns this home now.'),
  'no-deed': () => t('account.refusal.noDeed', 'Your house\'s deed is not in your saved game yet. It will be kept for you once the game has saved.'),   // FIELD BUGS 2026-10-04d KNIGHT-HOUSE: the hold reads the deed off the realm record
  'home-update': () => t('account.refusal.homeUpdate', 'This game is out of date. Reload it to buy a home.'),   // WD3 (AUDIT WD3 B2): a build from before the town mods
  'home-towns': () => t('account.refusal.homeTowns', 'This town did not load the way other players see it. Reload the game to buy a home.'),   // WD3 (AUDIT WD3 B1): a town mod's pack did not load
  'home-layout': () => t('account.refusal.homeLayout', 'This town is still loading. Try again in a moment.'),   // WD3: the town is built again as the room's (scenes/world.js hearHomeLayouts)
  'home-cap': () => t('account.refusal.homeCap', 'A character can own at most {max} homes. Sell one to buy another.', { max: HOME_CAP }),
  'home-rate': () => t('account.refusal.homeRate', 'You have bought and sold a lot of homes this hour. Try again later.'),
  'no-home': () => t('account.refusal.noHome', 'That home is not yours any more.'),
  'not-heir': () => t('account.refusal.notHeir', 'Only a living character of the same line as its fallen owner can take up that home.'),   // PERMADEATH-HOUSES: server-account/src/homes.js inheritHome
  'bad-home': () => t('account.refusal.badHome', 'The account service could not tell which building that is.'),
  'home-character': () => t('account.refusal.homeCharacter', 'The account service could not tell which character this is for.'),
  'bad-entry': () => t('account.refusal.badEntry', 'The account service does not know that setting. The game may need updating.'),
  'no-session': () => t('account.refusal.noSession', 'You are not signed in to an account.'),
  // HOME-RENT: a home's rooms, rented (server-account/src/rent.js) - met at a door, or in the owner's decorator
  'rent-taken': () => t('account.refusal.rentTaken', 'Somebody else is renting that room now.'),
  'rent-held': () => t('account.refusal.rentHeld', 'You already rent {max} rooms. Let one run out before you rent another.', { max: RENT_HELD_MAX }),
  'rent-rooms': () => t('account.refusal.rentRooms', 'A home can offer at most {max} rooms to rent.', { max: RENT_ROOMS_MAX }),
  'rent-none': () => t('account.refusal.rentNone', 'There is no rent waiting to be collected.'),
  'rent-own': () => t('account.refusal.rentOwn', 'You cannot rent a room in your own home.'),
  'rent-price': () => t('account.refusal.rentPrice', 'The owner has changed the price of that room. Look again.'),
  'rent-rate': () => t('account.refusal.rentRate', 'You have changed your rooms too often this hour. Try again later.'),
  'rent-long': () => t('account.refusal.rentLong', 'A room can be rented at most {max} days ahead.', { max: RENT_DAYS_MAX }),
  'no-rent-room': () => t('account.refusal.noRentRoom', 'That room is not offered to rent any more.'),
  'bad-room': () => t('account.refusal.badRoom', 'The account service could not read that room.'),
  'home-tenants': () => t('account.refusal.homeTenants', 'Somebody is renting a room in your home. It cannot be sold or deleted until their days run out.'),
  'home-rent-due': () => t('account.refusal.homeRentDue', 'Rent is waiting to be collected at your home. Collect it first.'),
  // ARENA4b: a home the arena displaced (homes.js arenaMoveHome), and a house of its block an old build would buy
  'home-arena': () => ARENA_TEXT.homeMove.arena,
  'home-unmoved': () => ARENA_TEXT.homeMove.unmoved,
  'home-changed': () => ARENA_TEXT.homeMove.changed,
  // HOME-VOTE: a town's word on a player's house (server-account/src/homeVotes.js) - met at its door
  'vote-own': () => t('account.refusal.voteOwn', 'You cannot vote on your own home, or on the hall of your own guild.'),
  'vote-rate': () => t('account.refusal.voteRate', 'You have voted on too many homes this hour. Try again later.'),
  'vote-young': () => t('account.refusal.voteYoung', 'An account must have had its username and password for a week to vote on homes.'),   // AUDIT HOME-VOTE A1: HOME_VOTE_AGE_S (II A7: a week REGISTERED - a guest played a year is no older for it)
  'bad-vote': () => t('account.refusal.badVote', 'The account service could not read that vote. The game may need updating.'),
  // HOME-LOOK: an online home's outside (server-account/src/homes.js setHomeLook)
  'bad-look': () => t('account.refusal.badLook', 'The account service could not read that look. The game may need updating.'),
  // DECOR1: an online home's decor (server-account/src/decor.js)
  'decor-cap': () => t('account.refusal.decorCap', 'A home holds at most {max} pieces. Remove one to place another.', { max: DECOR_CAP }),
  'yard-cap': () => t('account.refusal.yardCap', 'A yard holds at most {max} pieces. Remove one to place another.', { max: DECOR_YARD_CAP }),   // HOME-YARD
  'yard-high': () => DECOR_YARD_HIGH_WHY,   // YARD-HEIGHT (AUDIT Y3): the decorator's own sentence
  'decor-taken': () => t('account.refusal.decorTaken', 'Another piece already stands under that name. Place it again.'),
  'decor-rate': () => t('account.refusal.decorRate', 'You have placed and moved pieces too often this hour. Try again later.'),
  'no-decor': () => t('account.refusal.noDecor', 'That piece is not in your home any more.'),
  'bad-decor': () => t('account.refusal.badDecor', 'The account service could not read that piece.'),
  'decor-figure': () => t('account.refusal.decorFigure', 'That figure has been set back to its normal size. Look at the room again.'),   // AUDIT HOME-VOTE II C2: a stale copy of a figure grown before DECOR-FIGURE
  // GUILD1: the guilds (server-account/src/guilds.js)
  'guilds-need-account': () => t('account.refusal.guildsNeedAccount', 'Guilds need a username and a password. Give this account one and you can found or join one.'),
  'guild-character': () => t('account.refusal.guildCharacter', 'The account service could not tell which character that is.'),
  'bad-guild': () => t('account.refusal.badGuild', 'A guild\'s name is {min} to {max} letters, digits, spaces, apostrophes or hyphens, and its tag 2 to 4 capitals or digits.', { min: GUILD_NAME_MIN, max: GUILD_NAME_MAX }),
  'guild-rate': () => t('account.refusal.guildRate', 'You have changed your guild too often this hour. Try again later.'),
  'guild-renown': () => t('account.refusal.guildRenown', 'Founding a guild takes Renown {renown}.', { renown: GUILD_FOUND_RENOWN }),
  'guild-already': () => t('account.refusal.guildAlready', 'This character already belongs to a guild.'),
  'guild-name-taken': () => t('account.refusal.guildNameTaken', 'Another guild already bears that name.'),
  'guild-tag-taken': () => t('account.refusal.guildTagTaken', 'Another guild already bears that tag.'),
  'no-guild': () => t('account.refusal.noGuild', 'This character belongs to no guild.'),
  'guild-rank': () => t('account.refusal.guildRank', 'Your rank in the guild cannot do that.'),
  'guild-full': () => t('account.refusal.guildFull', 'The guild already holds {max} members.', { max: GUILD_MEMBERS_MAX }),
  'no-invite': () => t('account.refusal.noInvite', 'That invitation is no longer open.'),
  'guild-master-leaves': () => t('account.refusal.guildMasterLeaves', 'Hand the guild on to another member before you leave it.'),
  'guild-treasury': () => t('account.refusal.guildTreasury', 'Take the gold out of the treasury first.'),
  'realm-market-open': () => t('account.refusal.realmMarketOpen', 'This character still has business on the market: a listing, an auction, a bid, a buy order, a commission, or goods on the way or waiting to be collected. Settle it first.'),   // PROF-DELETE   // AUDIT 28 M3: the Marks go to the guildmaster with the guild
  'no-member': () => t('account.refusal.noMember', 'That member is no longer in the guild.'),
  'bad-ranks': () => t('account.refusal.badRanks', 'Each rank needs a name of its own, 1 to {max} letters, digits, spaces, apostrophes or hyphens.', { max: GUILD_RANK_NAME_MAX }),
  'bad-gold': () => t('account.refusal.badGold', 'Gold goes in or out 1 to {max} at a time.', { max: GUILD_MOVE_MAX }),
  'guild-treasury-full': () => t('account.refusal.guildTreasuryFull', 'The treasury can hold no more.'),
  'guild-treasury-short': () => t('account.refusal.guildTreasuryShort', 'The treasury does not hold that much.'),
  // AUDIT REALM L1-F3: a realm withdrawal takes from what realm records paid in alone (guilds.js `realm_gold`). GUILD-LETTER
  // (FIELD BUGS 2026-09-30): the words say that rule. They named only "before the realm" - but the old lane's deposits
  // made since are held the same - and never said what a realm character may still take out
  'guild-treasury-old': () => t('account.refusal.guildTreasuryOld', 'Realm characters can only take out gold that realm characters put in, and there is not that much left. The rest came in before the realm or from a character outside it, so it stays in the treasury.'),
  // WB5b: a gate's kill receipt carried to the service. net/gate/gateClaims.js says nothing of these to the player - it keeps
  // what they do not settle and lets go of what they do - but a word the service can say is a word with a sentence.
  'no-gate-key': () => t('account.refusal.noGateKey', 'The account service cannot check your gate result right now. It will try again.'),
  'no-relay-key': () => t('account.refusal.noRelayKey', 'The account service cannot check other players\' fights right now. It will try again.'),   // GRANT3 (Spawn-Grants.md section 13): /v1/relaykey, a reader's key
  receipt: () => t('account.refusal.receipt', 'That gate result could not be verified, or it has expired.'),
  'not-yours': () => t('account.refusal.notYours', 'That gate result belongs to another account.'),
  // INT8: DUEL1's loser's own report, retired - a duel's result is the relay's receipt now
  retired: () => t('account.refusal.retired', 'Duels are now recorded by the referee. The game may need updating.'),
  // INT9: a death in the open zone's drop (server-account/src/wild.js) - the fallen's own tab has the first half minute
  grace: () => t('account.refusal.grace', 'The fallen player still has a moment to settle their own death. This will be tried again shortly.'),
  nonce: () => t('account.refusal.nonce', 'That fall could not be read. Try again.'),
  room: () => t('account.refusal.room', 'That death gave no place for the remains. Try again.'),
  // PVP-ESCROW (FIELD BUGS 2026-10-14, the two-phase handoff - server-account/src/wild.js wildCollect, wildReclaim,
  // wildEscrows): the world host's collect and reclaim say nothing of these to the player - it keeps what they do not
  // settle and lets go of what they do - but a word the service can say is a word with a sentence (ACC1e)
  'no-escrow': () => t('account.refusal.noEscrow', 'That piece is not held for this character.'),
  'escrow-moved': () => t('account.refusal.escrowMoved', 'That piece moved in the meantime. Look again.'),
  'escrow-collected': () => t('account.refusal.escrowCollected', 'That piece has already been collected.'),
  'escrow-returned': () => t('account.refusal.escrowReturned', 'That piece has already gone back to the one who fell.'),
  'escrow-late': () => t('account.refusal.escrowLate', 'That piece was collected too late and goes back to the one who fell.'),
  'escrow-wait': () => t('account.refusal.escrowWait', 'That piece is still held for its killer. It comes back to you shortly.'),
  // MARKS1: Marks, the server's currency (server-account/src/marks.js)
  'marks-need-account': () => t('account.refusal.marksNeedAccount', 'Silver is kept by registered accounts. Add a username to hold it.'),
  'marks-closed': () => t('account.refusal.marksClosed', 'Silver is not available yet.'),
  'marks-rid': () => t('account.refusal.marksRid', 'That request could not be read. Try again.'),
  'bad-marks': () => t('account.refusal.badMarks', 'Silver moves 1 to {max, number} at a time, and the Bank buys at most {perDay} a day.', { max: MARKS_MOVE_MAX, perDay: MARKS_BANK.perDay }),
  'marks-short': () => t('account.refusal.marksShort', 'You do not hold that much silver.'),
  'marks-bank-cap': () => t('account.refusal.marksBankCap', 'The Bank buys at most {perDay} silver from you a day.', { perDay: MARKS_BANK.perDay }),
  'marks-full': () => t('account.refusal.marksFull', 'An account holds at most {max, number} silver.', { max: MARKS_MAX }),
  'guild-marks-short': () => t('account.refusal.guildMarksShort', 'The treasury does not hold that much silver.'),
  'guild-marks-full': () => t('account.refusal.guildMarksFull', 'A guild\'s treasury holds at most {max, number} silver.', { max: MARKS_MAX }),
  'marks-rate': () => t('account.refusal.marksRate', 'You have moved too much silver this hour. Try again later.'),
  'bad-find': () => t('account.refusal.badFind', 'That find could not be read.'),   // SILVER-FINDS: a loot find of no kind the service knows
  'marks-young': () => t('account.refusal.marksYoung', 'Silver turns up in finds and gathering once your account is a week old.'),   // AUDIT 625 S1: the witnesses' own age
  'not-developer': () => t('account.refusal.notDeveloper', 'Only a developer may do that.'),   // MARKS1's report, NOTICE1's notices, CUSTOMS-PASS's grant
  // SEAT1a: the seats' registry (server-account/src/townSeats.js)
  'seats-need-account': () => t('account.refusal.seatsNeedAccount', 'The seats are witnessed by registered accounts. Add a username to witness one.'),
  'seats-closed': () => t('account.refusal.seatsClosed', 'The seats are not open yet.'),
  'seats-settling': () => t('account.refusal.seatsSettling', 'The week is turning at the seats. Try again in a moment.'),   // SEAT-LEASE: another request settles the Turning
  'bad-seat': () => t('account.refusal.badSeat', 'That seat could not be read.'),
  'seats-rate': () => t('account.refusal.seatsRate', 'You have reported too many seats this hour. Try again later.'),
  'seat-struck': () => t('account.refusal.seatStruck', 'That seat was struck from the registry.'),
  // SEAT1b: influence (server-account/src/seatInfluence.js)
  'seat-unconfirmed': () => t('account.refusal.seatUnconfirmed', 'That seat is not confirmed yet. Seats are confirmed once enough players have seen them.'),
  'seat-reckoning': () => t('account.refusal.seatReckoning', 'Pledges are locked until the Turning, Sunday 18:00 UTC.'),
  'seat-pledges-full': () => t('account.refusal.seatPledgesFull', 'Your guild has pledged in five regions this week. Take one pledge down first.'),
  'seat-no-pledge': () => t('account.refusal.seatNoPledge', 'Your guild is not pledged to that seat this week.'),
  'seat-tribute-cap': () => t('account.refusal.seatTributeCap', 'Tribute is at most a fifth of your guild\'s week at a seat. Earn more influence there first.'),
  'bad-tribute': () => t('account.refusal.badTribute', 'Tribute is paid in multiples of 10 silver.'),
  'bad-watch': () => t('account.refusal.badWatch', 'Those watch records could not be read.'),
  // SEAT1c: the Charters
  'seat-not-held': () => t('account.refusal.seatNotHeld', 'Your guild does not hold that Charter.'),
  'seat-held-here': () => t('account.refusal.seatHeldHere', 'Your guild holds a Charter in this region, and is pledged to it.'),
  // SEAT1d: the holder's levers
  'bad-tithe': () => t('account.refusal.badTithe', 'A Tithe is a whole percent, no more than the seat allows: 10% at a palace and 15% at a crown, and a point more for each stage of its Market Hall.'),   // AUDIT SEATS-3 C6: the Market Hall raises the cap (fortLaw.js marketHallTitheCap)
  'tithe-this-week': () => t('account.refusal.titheThisWeek', 'The Tithe has been set this week already. It may change again after the Turning.'),
  'bad-edict': () => t('account.refusal.badEdict', 'There is no such Edict.'),
  'edict-twice': () => t('account.refusal.edictTwice', 'That Edict rules this week, and only Market Day may be proclaimed two weeks running.'),
  'edict-tier': () => t('account.refusal.edictTier', 'Only a crown may proclaim that Edict.'),
  'seat-no-edict': () => t('account.refusal.seatNoEdict', 'No Edict is proclaimed for next week.'),
  'bad-bounty': () => t('account.refusal.badBounty', 'A Bounty sets aside at least 20 silver, and at most 100,000.'),
  'bad-orc-camp': () => t('account.refusal.badOrcCamp', 'That camp is not one the Orc Raids count.'),   // SEASON1 part two
  // SEAT2a: the battles' week - the window, the rosters, the Sellswords (the board's own words: townSeatLaw.js SIGN_WHY)
  'bad-window': () => t('account.refusal.badWindow', 'A window is a day from Wednesday to Saturday and a start from 16:00 to 02:00 UTC.'),
  'bad-fee': () => t('account.refusal.badFee', 'A Sellsword\'s fee is a whole amount of silver, at most {max, number}.', { max: SELLSWORD_FEE_MAX }),
  'bad-handle': () => t('account.refusal.badHandle', 'Name the account by its username.'),
  'no-such-account': () => t('account.refusal.noSuchAccount', 'There is no account by that name.'),
  'hire-none': () => t('account.refusal.hireNone', 'That Sellsword has no contract to withdraw.'),
  'hire-twice': () => t('account.refusal.hireTwice', 'That account has a contract here already.'),
  ...readEach(SIGN_WHY),
  ...readEach(SIEGE_WHY),   // SEAT2a part three: the pass and the Honours
  ...readEach(ROYAL_WHY),   // CROWN1 part two: the Royal Tourney's pass and bouts
  ...readEach(FEALTY_WHY),   // CROWN2: fealty and Pacts
  ...readEach(VENDOR_REFUSAL_WORDS),   // HOME-VENDOR
  // NOTICE1: the Notice Board (server-account/src/board.js)
  'board-need-account': () => t('account.refusal.boardNeedAccount', 'Only registered accounts can pin notes. Add a username to pin one.'),
  'board-closed': () => t('account.refusal.boardClosed', 'The notice board is not open yet.'),
  'bad-board': () => t('account.refusal.badBoard', 'That board could not be read.'),
  'board-rid': () => t('account.refusal.boardRid', 'That request could not be read. Try again.'),
  'bad-note-days': () => t('account.refusal.badNoteDays', 'A note stands for {list} or {last} days.', { list: NOTE_DAYS.slice(0, -1).join(', '), last: NOTE_DAYS[NOTE_DAYS.length - 1] }),
  'bad-note-button': () => t('account.refusal.badNoteButton', 'That note cannot carry that button.'),
  'bad-notice-days': () => t('account.refusal.badNoticeDays', 'A notice stands for 1 to {max} days.', { max: NOTICE_DAYS_MAX }),
  'notes-full': () => t('account.refusal.notesFull', 'You have {max} notes up already. Take one down first.', { max: NOTES_LIVE_MAX }),
  'note-no-guild': () => t('account.refusal.noteNoGuild', 'Your character is not in a guild to recruit for.'),
  'no-note': () => t('account.refusal.noNote', 'That note is no longer on the board.'),
  'no-notice': () => t('account.refusal.noNotice', 'That notice is no longer on the board.'),
  'own-note': () => t('account.refusal.ownNote', 'That note is your own.'),
  'bad-act': () => t('account.refusal.badAct', 'That could not be done.'),
  'board-rate': () => t('account.refusal.boardRate', 'You have pinned too many notes this hour. Try again later.'),
  'board-ops-rate': () => t('account.refusal.boardOpsRate', 'You have done too much at the boards this hour. Try again later.'),   // AUDIT 28 N14: a take-down's and a report's
  // PROF1: the professions (server-account/src/professions.js)
  'prof-need-account': () => t('account.refusal.profNeedAccount', 'The Stores are kept for registered accounts. Add a username to gather.'),
  'prof-closed': () => t('account.refusal.profClosed', 'Professions are not open yet.'),
  'prof-character': () => t('account.refusal.profCharacter', 'This character could not be found for professions. Try again.'),
  'prof-rid': () => t('account.refusal.profRid', 'That request could not be read. Try again.'),
  'bad-node': () => t('account.refusal.badNode', 'There is nothing here to gather.'),
  'prof-kind': () => t('account.refusal.profKind', 'There is nothing here to gather.'),
  'prof-pixel': () => t('account.refusal.profPixel', 'The land here does not match the server\'s map. The game may need updating.'),
  'prof-day': () => t('account.refusal.profDay', 'The day that gathering belonged to has ended.'),
  'prof-late': () => t('account.refusal.profLate', 'That gathering arrived too late to count.'),
  'prof-night': () => t('account.refusal.profNight', 'You need daylight to gather.'),   // ANY-HOUR: the service says it no more - kept for one not yet redeployed
  'prof-rank': () => t('account.refusal.profRank', 'Your craft is not yet skilled enough for that.'),
  // CAP-OFF (2026-10-07): the day's cap's four - this one, `prof-account-cap`, `prof-hunt-cap` and `prof-fish-cap` - the
  // service says no more; kept, without the numbers it no longer holds, for one not yet redeployed
  'prof-cap': () => t('account.refusal.profCap', 'You have gathered all a day allows.'),
  // AUDIT 29
  'prof-account-cap': () => t('account.refusal.profAccountCap', 'Your account has gathered all a day allows in this craft, across your characters.'),
  'prof-deep-cap': () => t('account.refusal.profDeepCap', 'Dungeons not yet confirmed by other players give you {max} veins a day.', { max: DEEP_UNCONFIRMED_PER_DAY }),
  'prof-spec-stale': () => t('account.refusal.profSpecStale', 'Your specialization changed elsewhere. Look again before you choose.'),
  'prof-spec-taken': () => t('account.refusal.profSpecTaken', 'A specialization was chosen there already. Look again.'),
  'stores-full': () => t('account.refusal.storesFull', 'Your Stores hold {max, number} of that already.', { max: STORES_MAX }),
  'stores-short': () => t('account.refusal.storesShort', 'Your Stores do not hold that many.'),
  // BAG1: what is carried - the service's count of it at its bound, or a pack and bag holding fewer than a deposit asks
  'carried-full': () => t('account.refusal.carriedFull', 'You already carry {max, number} of that. Put some in your Stores first.', { max: STORES_MAX }),
  'carried-short': () => t('account.refusal.carriedShort', 'You do not carry that many that you gathered or took from your Stores.'),
  'bad-held': () => t('account.refusal.badHeld', 'Your pack could not be counted. Try again.'),
  'materials-short': () => t('account.refusal.materialsShort', 'You do not have that many in your Stores, Materials Bag and pack together.'),
  'deposit-kept': () => t('account.refusal.depositKept', 'Your materials are still on their way into your Stores. Try again in a moment.'),   // AUDIT BAG1 B8
  'deposit-busy': () => t('account.refusal.depositBusy', 'Your last deposit is still being counted. Try again in a moment.'),   // AUDIT2 BAG1 K12: one deposit at a time
  'deposit-unsaved': () => t('account.refusal.depositUnsaved', 'Your game could not be saved just now, so nothing went into your Stores. Try again in a moment.'),   // AUDIT2 BAG1 H2: the take saved before the ask
  'deposit-unsent': () => t('account.refusal.depositUnsent', 'Those materials were never sent. They are still with you.'),   // AUDIT2 BAG1 K7: a kept deposit whose take the save never saw (askDeposit)
  'bad-deposit-order': () => t('account.refusal.badDepositOrder', 'That cannot be put in the Stores that way.'),
  'node-taken': () => t('account.refusal.nodeTaken', 'You have already gathered here today.'),
  'bad-material': () => t('account.refusal.badMaterial', 'The Stores do not keep that.'),
  'bad-recipe': () => t('account.refusal.badRecipe', 'The forge knows no such work.'),   // PROF2
  'prof-no-pack-form': () => t('account.refusal.profNoPackForm', 'That stays in the Stores and cannot go in your pack.'),   // PROF3: the smith's stock; now a siege work and (AUDIT PROF12 E1) Arcane Essence
  // PROF3: one craft at a time; AUDIT PROF-541 R2-C2: one latch for every craft and brew (profBook.js _craftBusy) - the
  // anvil's word named the wrong work at the fire, the loom and the cauldron, so the words name none
  'prof-busy': () => t('account.refusal.profBusy', 'Your hands are busy with another craft.'),
  'prof-later': () => t('account.refusal.profLater', 'That is made when the sieges come.'),   // PROF4: the Ram Kit (PROF0 25)
  // PROF7: Hunting's day - the account's, every character's together (PROF0 6)
  'prof-hunt-cap': () => t('account.refusal.profHuntCap', 'Your account has taken all the hides a day allows, across your characters.'),   // CAP-OFF: kept for one not yet redeployed
  'prof-fish-cap': () => t('account.refusal.profFishCap', 'Your account has hauled all the nets a day allows, across your characters. The water rests until midnight UTC.'),   // PROF8; CAP-OFF: kept, as above
  'prof-hunt-high': () => t('account.refusal.profHuntHigh', 'Your account has taken all the rare hides a day allows ({max}, across your characters).', { max: HIGH_HIDES_PER_DAY }),
  'prof-foe': () => t('account.refusal.profFoe', 'That body cannot be skinned.'),
  'prof-dye': () => t('account.refusal.profDye', 'That cannot be dyed that way.'),
  'prof-sculptor': () => t('account.refusal.profSculptor', 'Only a Sculptor can carve stone decor. Choose it at Masonry 100, under Building.'),   // PROF11; CRAFT3: the craft's
  'prof-lapidary': () => t('account.refusal.profLapidary', 'Only a Lapidary can set a Siege-cracked Gem in a piece. Choose it at Jewelcrafting 100, under Smithing.'),   // PROF10; CRAFT3
  // PROF12: the alchemy station's and the enchanter's refusals
  'prof-transmuter': () => t('account.refusal.profTransmuter', 'Only a Transmuter can turn one metal into the next. Choose it at Alchemy 100, under Provisioning.'),   // CRAFT3
  'bad-brew': () => t('account.refusal.badBrew', 'That cauldron makes no such potion.'),
  'bad-piece': () => t('account.refusal.badPiece', 'That is no crafted piece.'),
  'prof-no-piece': () => t('account.refusal.profNoPiece', 'Only a piece a crafter made online can be disenchanted.'),
  'prof-not-yours': () => t('account.refusal.profNotYours', 'That piece is not yours to disenchant.'),
  'prof-piece-busy': () => t('account.refusal.profPieceBusy', 'That piece is listed on the market, on its way to you, or placed in a home, so it cannot be disenchanted now.'),
  'prof-piece-gone': () => t('account.refusal.profPieceGone', 'That piece is not loose in your pack, so it cannot be disenchanted.'),   // AUDIT PROF-541 B2
  // CRAFT4: the temper's and the Reforge with Essence's refusals
  'prof-temper': () => t('account.refusal.profTemper', 'That piece cannot be tempered. Smiths temper weapons and metal armor, and tailors temper leather and cloth.'),
  'prof-temper-top': () => t('account.refusal.profTemperTop', 'That piece cannot be tempered any further. Tempering stops at Superior, and a Masterwork cannot be tempered.'),
  'prof-temper-stale': () => t('account.refusal.profTemperStale', 'That piece\'s quality has changed. Check your Stores again.'),
  'prof-reforge': () => t('account.refusal.profReforge', 'Arcane Essence can reforge a line on a Magic or Rare piece, but never on a Legendary, Aetheric or artifact piece.'),
  'prof-no-essence': () => t('account.refusal.profNoEssence', 'That piece carries too little enchantment to give any Arcane Essence.'),
  'bad-qty': () => t('account.refusal.badQty', 'Take 1 to {max} at a time.', { max: WITHDRAW_MAX }),
  'bad-pixels': () => t('account.refusal.badPixels', 'That land could not be read.'),
  'bad-region': () => t('account.refusal.badRegion', 'That region could not be read.'),
  'no-writ': () => t('account.refusal.noWrit', 'That writ is no longer posted.'),
  'writ-taken': () => t('account.refusal.writTaken', 'Someone else has already filled that writ.'),
  'writ-expired': () => t('account.refusal.writExpired', 'That writ has run out.'),
  'writ-cap': () => t('account.refusal.writCap', 'You have filled {max} writs today, the most a day allows.', { max: COURT_WRITS_PER_DAY }),   // CHAP2a: the Court's and the halls' one allowance
  // CRAFT-WRITS (bible/06-Systems/Professions-Arc.md section 49): a crafting writ's own refusals
  'craft-writ-cap': () => t('account.refusal.craftWritCap', 'You have filled {max} crafting writs today, the most a day allows.', { max: MARKS_FAUCETS.craftWrit.perDay }),
  'craft-writ-filled': () => t('account.refusal.craftWritFilled', 'You have already filled this crafting writ.'),   // AUDIT CRAFT-WRITS S4
  'craft-unbrewed': () => t('account.refusal.craftUnbrewed', 'You have not brewed enough of that potion yourself. Bottles you found or bought do not count - brew them at an alchemy station.'),
  'craft-pieces': () => t('account.refusal.craftPieces', 'Only pieces you made yourself and never sold can fill this writ, and you need all of them.'),
  'craft-goods-gone': () => t('account.refusal.craftGoodsGone', 'Your pack does not hold enough of what this writ asks.'),
  'prof-spec': () => t('account.refusal.profSpec', 'That specialization is not one this craft offers.'),
  'prof-respec-pending': () => t('account.refusal.profRespecPending', 'A change of specialization is already on its way ({days} days).', { days: RESPEC.days }),
  'prof-rate': () => t('account.refusal.profRate', 'You have done too much crafting this hour. Try again later.'),
  // PROF5: the market (server-account/src/market.js)
  'market-closed': () => t('account.refusal.marketClosed', 'The market is not open yet.'),
  'bad-price': () => t('account.refusal.badPrice', 'A price is 1 to {max, number} silver.', { max: MARKET_PRICE_MAX }),
  'bad-units': () => t('account.refusal.badUnits', 'A number of units is 1 to {max, number} at a time.', { max: MARKET_UNITS_MAX }),   // AUDIT 31 L6: a listing's, an order's, a writ's, a guild Stores move's
  'bad-provenance': () => t('account.refusal.badProvenance', 'Only crafted pieces with a maker\'s record can be listed on the market.'),
  'bad-wear': () => t('account.refusal.badWear', 'That piece\'s wear could not be checked for the market.'),
  'bad-listing': () => t('account.refusal.badListing', 'That listing could not be read.'),
  'bad-order': () => t('account.refusal.badOrder', 'That order could not be read.'),
  'bad-delivery': () => t('account.refusal.badDelivery', 'That delivery could not be read.'),
  'market-rate': () => t('account.refusal.marketRate', 'You have done too much at the market this hour. Try again later.'),
  'market-gone': () => t('account.refusal.marketGone', 'That is no longer on the market.'),
  'market-own': () => t('account.refusal.marketOwn', 'That is your own. Cancel it from My listings instead.'),
  'market-short': () => t('account.refusal.marketShort', 'There are not that many left.'),
  'market-no-road': () => t('account.refusal.marketNoRoad', 'The couriers do not know the road there yet.'),
  'market-price-moved': () => t('account.refusal.marketPriceMoved', 'Prices have changed since you looked. Look again.'),
  'market-seller-full': () => t('account.refusal.marketSellerFull', 'The seller cannot hold any more silver just now.'),
  'market-listings-max': () => t('account.refusal.marketListingsMax', 'You have as many listings up as this board allows ({max}, more in a town with a Market Hall). Cancel one first.', { max: MARKET_LISTINGS_MAX }),   // AUDIT SEATS-3 D2: a Market Hall's town lists more
  'market-orders-max': () => t('account.refusal.marketOrdersMax', 'You have {max} buy orders up already. Withdraw one first.', { max: MARKET_ORDERS_MAX }),
  // MARKET-KEEP: the piece stays with its holder - said so, and where it may still go
  'market-not-yours': () => t('account.refusal.marketNotYours', 'That piece\'s maker\'s record names another owner, so only they can list it as a crafted piece. It stays in your pack, where it sells for gold.'),
  'market-listed': () => t('account.refusal.marketListed', 'That piece is on the market already.'),
  'market-order-full': () => t('account.refusal.marketOrderFull', 'The buyer\'s Stores cannot hold that many more.'),
  'market-elsewhere': () => t('account.refusal.marketElsewhere', 'That order can only be filled at its own region\'s boards.'),
  'market-courier-dear': () => t('account.refusal.marketCourierDear', 'The courier to that order\'s region would cost all it pays. Fill it nearer, or fill more at once.'),   // GLOBAL-MARKET
  'market-taxed-out': () => t('account.refusal.marketTaxedOut', 'Filled alone, that would pay you nothing once the tax is taken. Fill more at once.'),   // MARKET-AUDIT S2
  'market-other-character': () => t('account.refusal.marketOtherCharacter', 'That is on its way to another of your characters.'),
  'market-on-road': () => t('account.refusal.marketOnRoad', 'The courier has not arrived yet.'),
  // AUDIT 30
  'market-not-listable': () => t('account.refusal.marketNotListable', 'That cannot be sold on the market. Arrows go in a quiver.'),
  'market-uncollected': () => t('account.refusal.marketUncollected', 'That piece is still on its way to you. Collect it first.'),
  'market-standing': () => t('account.refusal.marketStanding', 'That piece is placed in a home. Pick it up first.'),
  'market-unyielded': () => t('account.refusal.marketUnyielded', 'Nothing produces that yet, so no one could fill an order for it.'),
  'market-busy': () => t('account.refusal.marketBusy', 'Your last market action is still being settled. Try again in a moment.'),
  // GOLD-MARKET: gold is a realm character's, and what gold bought stays gold's (Professions-Arc 10.8)
  'market-gold-realm': () => t('account.refusal.marketGoldRealm', 'Gold changes hands on the market only between characters of the online realm.'),
  'market-currency': () => t('account.refusal.marketCurrency', 'That listing is priced in the other currency. Look again.'),
  'market-gold-goods': () => t('account.refusal.marketGoldGoods', 'Goods you bought with gold, or made from goods that did not come from your Stores, can only go to your pack or back on the market for gold. They cannot be sold for silver or used at a station, in a craft or for a writ.'),   // AUDIT BAG-CRAFT A1: a piece of loose goods is walled to gold
  // AUDIT PROF-541 R2-S3 (Mac: B7's wider wall kept, its word made plain): a piece made of goods a counter sold for silver is silver's
  'market-drakes-goods': () => t('account.refusal.marketDrakesGoods', 'Goods bought with silver, and pieces made with them, sell only for silver. What you gathered, or made of your own or gold-bought goods, sells for gold.'),
  'market-gold-none': () => t('account.refusal.marketGoldNone', 'Your sales hold no gold for you just now.'),
  'market-gold-full': () => t('account.refusal.marketGoldFull', 'The seller cannot hold any more gold from the market just now.'),
  // MARKET-ANY: a piece from the pack
  'market-not-good': () => t('account.refusal.marketNotGood', 'That piece cannot be sold on the market.'),
  'market-good-gone': () => t('account.refusal.marketGoodGone', 'The realm does not hold that piece where your pack had it. Nothing was listed.'),
  'market-piece-gone': () => t('account.refusal.marketPieceGone', 'That crafted piece is not loose in your pack or your home. Nothing was traded.'),   // INT19
  'market-piece-route': () => t('account.refusal.marketPieceRoute', 'That piece\'s maker\'s record is yours: list it as a crafted piece.'),
  'market-goods-gold': () => t('account.refusal.marketGoodsGold', 'A piece from your pack sells only for gold.'),
  // WRIT-WALL (FIELD BUGS 2026-10-13e): it sent the reader to withdraw it - and withdrawn it stays gold's, which no writ,
  // station or guild Stores takes from the pack either (bagLaw.js carriedUsable, carriedWorkable)
  'stores-gold': () => t('account.refusal.storesGold', 'What you bought with gold is not used there, in your Stores or out of them: it goes to your pack or back on the market for gold.'),
  // PROF5b: the auctions
  'auction-not-masterwork': () => t('account.refusal.auctionNotMasterwork', 'Only a Masterwork is sold at auction. List it at a price instead.'),
  'auction-low': () => t('account.refusal.auctionLow', 'Another bid came first. The next bid is higher now.'),
  'auction-leading': () => t('account.refusal.auctionLeading', 'Your bid already leads.'),
  'auction-bid-standing': () => t('account.refusal.auctionBidStanding', 'It already has a bid, so it cannot be withdrawn now.'),
  // AUDIT 31
  'auction-moved': () => t('account.refusal.auctionMoved', 'Another bid came in at the same time as yours. Check the auction and bid again if you still want it.'),
  'bad-bid': () => t('account.refusal.badBid', 'A bid is 1 to {max, number} silver.', { max: AUCTION_BID_MAX }),
  'market-no-record': () => t('account.refusal.marketNoRecord', 'There is no record of that piece, so it cannot be sold or traded.'),
  'piece-kept': () => t('account.refusal.pieceKept', 'That piece is still in another trade. Try again in a moment.'),
  'other-character': () => t('account.refusal.otherCharacter', 'That was begun by another of your characters. It settles when they next open the board.'),
  'piece-held': () => t('account.refusal.pieceHeld', 'That piece cannot leave your pack now. Take it off or unlock it first.'),   // AUDIT 31 H8
  // PROF6: guild writs, commissions and the guild Stores
  'writs-closed': () => t('account.refusal.writsClosed', 'Guild writs and commissions are not open to this account.'),
  'writ-pay': () => t('account.refusal.writPay', 'A guild writ can pay at most 1.5 times the material\'s worth per unit.'),
  'writ-budget': () => t('account.refusal.writBudget', 'That is past the Officers\' writ budget for this week. The Guildmaster sets it on the Guild tab.'),
  'writ-gone': () => t('account.refusal.writGone', 'That writ is no longer posted.'),
  'writ-elsewhere': () => t('account.refusal.writElsewhere', 'That writ is delivered at the boards of the region that posted it.'),
  'writ-short': () => t('account.refusal.writShort', 'That writ needs fewer than that now.'),
  'writ-moved': () => t('account.refusal.writMoved', 'Someone else delivered first. Check the writ again.'),
  // SEAT2b: a seat writ and a fortification project
  'seat-not-pledged': () => t('account.refusal.seatNotPledged', 'Your guild neither holds that seat nor is pledged to it this week.'),
  'bad-work': () => t('account.refusal.badWork', 'There is no such work.'),
  'fort-not-here': () => t('account.refusal.fortNotHere', 'That work cannot be raised at this seat.'),
  'fort-building': () => t('account.refusal.fortBuilding', 'That work is being raised already.'),
  'fort-max': () => t('account.refusal.fortMax', 'That work has reached its final stage.'),
  'seat-treasury': () => t('account.refusal.seatTreasury', 'The guild\'s treasury does not hold the silver that project asks.'),
  'bad-rid': () => t('account.refusal.badRid', 'That request could not be read. Try again.'),
  'writ-rate': () => t('account.refusal.writRate', 'You have reached the hourly limit for writs and commissions ({posts} posted, {acts} other actions). Try again later.', { posts: WRIT_POSTS_MAX, acts: WRIT_OPS_MAX }),
  'writ-busy': () => t('account.refusal.writBusy', 'Your last writ is still being settled. Try again in a moment.'),
  'guild-writs-max': () => t('account.refusal.guildWritsMax', 'A guild may have {max} writs posted at once.', { max: GUILD_WRITS_MAX }),
  'guild-stores-full': () => t('account.refusal.guildStoresFull', 'The guild Stores hold at most {max, number} of a material.', { max: GUILD_STORES_MAX }),
  'guild-stores-short': () => t('account.refusal.guildStoresShort', 'The guild Stores do not hold that many.'),
  'guild-stores': () => t('account.refusal.guildStores', 'Empty the guild Stores first.'),
  'guild-writs': () => t('account.refusal.guildWrits', 'Withdraw the guild\'s writs first.'),
  'guild-writ-escrow': () => t('account.refusal.guildWritEscrow', 'A withdrawn writ\'s or contract\'s pay is still waiting to go back to the silver treasury, which is full. Take silver out of the treasury first.'),   // AUDIT 31 A15; SILVER-WAYS: or a contract's
  // PROF2b: a Motherlode's strike
  'motherlode-closed': () => t('account.refusal.motherlodeClosed', 'There is no Motherlode right now. It has not appeared yet, or it is gone.'),
  'motherlode-watch': () => t('account.refusal.motherlodeWatch', 'The Watch did not see you on the Motherlode\'s ground. Stand on it a moment and strike again.'),
  'motherlode-found': () => t('account.refusal.motherlodeFound', 'You have found your Motherlode today. Another breaks ground tomorrow.'),
  'motherlode-full': () => t('account.refusal.motherlodeFull', 'Its twenty miners have struck it. The Motherlode is spent.'),
  // SILVER-WAYS: guild contracts
  'guild-contracts': () => t('account.refusal.guildContracts', 'Withdraw the guild\'s contracts first.'),
  'guild-contracts-max': () => t('account.refusal.guildContractsMax', 'A guild may have {max} contracts posted at once.', { max: GUILD_CONTRACTS_MAX }),
  'contract-kind': () => t('account.refusal.contractKind', 'A guild contract pays for towns defended.'),
  'contract-pay': () => t('account.refusal.contractPay', 'A contract pays 1 to {max} silver a defender.', { max: CONTRACT_PAY_MAX }),
  'contract-deeds': () => t('account.refusal.contractDeeds', 'A contract pays 1 to {max} defenders.', { max: CONTRACT_DEEDS_MAX }),
  'contract-gone': () => t('account.refusal.contractGone', 'That contract is no longer posted.'),
  'no-contract': () => t('account.refusal.noContract', 'There is no such contract.'),
  // GUILD1d (Seats-Arc 8): the guild hall and the heraldry (server-account/src/halls.js)
  'guild-hall-have': () => t('account.refusal.guildHallHave', 'Your guild already has a hall. Sell it first to buy another.'),
  'guild-hall-none': () => t('account.refusal.guildHallNone', 'Your guild has no hall.'),
  'guild-hall-moved': () => t('account.refusal.guildHallMoved', 'The hall changed while you were selling it. Look again.'),
  'guild-hall': () => t('account.refusal.guildHall', 'Sell the guild\'s hall first.'),
  'guild-seat': () => t('account.refusal.guildSeat', 'Give up the guild\'s Charters first, at each seat\'s Notice Board.'),   // SEAT1c
  'guild-battle': () => t('account.refusal.guildBattle', 'The guild is in a siege or a Tourney this week. It cannot be disbanded until the battle is over.'),   // SEAT1c
  'guild-patron': () => t('account.refusal.guildPatron', 'The guild has bid for a chapter\'s patronage. It cannot be disbanded until the Season opens and the bid is decided.'),   // AUDIT CHAP5 E4
  'hall-item': () => t('account.refusal.hallItem', 'A guild hall can only hold furniture from the catalog. Your own things stay with you.'),
  'hall-yard': () => t('account.refusal.hallYard', 'A palace\'s grounds cannot be furnished, only its Charter Room.'),   // GUILD-YARD: a guild hall's yard is its keepers'; a palace's grounds stand none
  'bad-heraldry': () => t('account.refusal.badHeraldry', 'Those arms are not allowed. Use a field and a border of different colors (Ash only as the border), one device that stands out from the field, and for a divided field a second color unlike the first and the border.'),   // AUDIT2 GUILD2 G5: GUILD2c's divisions and device colour
  // GUILD2a (bible/11-Multiplayer/Guild-Overhaul.md): a new name for a price (server-account/src/guilds.js renameGuild)
  'guild-rename-same': () => t('account.refusal.guildRenameSame', 'That is already the guild\'s name and tag.'),
  'guild-name-word': () => t('account.refusal.guildNameWord', 'A guild\'s name and tag cannot contain a word that is not allowed in names.'),
  'guild-rank-word': () => t('account.refusal.guildRankWord', 'A rank\'s name cannot contain a word that is not allowed in names.'),   // TEXT-F1
  'guild-rename-soon': () => t('account.refusal.guildRenameSoon', 'The guild was renamed too recently. It can be renamed again 2 weeks after the last time.'),
  'guild-rename-siege': () => t('account.refusal.guildRenameSiege', 'The guild is in a siege or a Tourney this week. It cannot be renamed until the battle is over.'),
  'guild-rename-gold': () => t('account.refusal.guildRenameGold', 'A new name costs {cost, number} gold, paid from gold that realm characters put in the treasury, and there is not that much.', { cost: GUILD_RENAME_GOLD }),
  'guild-rename-moved': () => t('account.refusal.guildRenameMoved', 'The guild changed while it was being renamed. Nothing was paid. Look again.'),
  // GUILD2b: the vault (server-account/src/guildVault.js)
  'guild-vault-rank': () => t('account.refusal.guildVaultRank', 'The guildmaster has not given you that permission at the guild vault.'),
  'guild-vault-limit': () => t('account.refusal.guildVaultLimit', 'You have taken as many pieces from the vault today as the guildmaster allows. Try again tomorrow.'),
  'guild-vault-full': () => t('account.refusal.guildVaultFull', 'The guild\'s vault is full. It holds {slots} pieces, and {hallSlots} more with a guild hall.', { slots: GUILD_VAULT_SLOTS, hallSlots: GUILD_VAULT_HALL_SLOTS }),
  'guild-vault-empty': () => t('account.refusal.guildVaultEmpty', 'That piece is no longer in the vault.'),
  'guild-vault-moved': () => t('account.refusal.guildVaultMoved', 'The vault or your pack changed while you were using it. Nothing moved. Look again.'),
  'guild-vault': () => t('account.refusal.guildVault', 'Empty the guild\'s vault first.'),
  'vault-goods': () => t('account.refusal.vaultGoods', 'That piece cannot go in the vault. It is no longer in your pack, or it has to stay with its owner (a quest item, a summoned item or the Materials Bag).'),
  'bad-vault-item': () => t('account.refusal.badVaultItem', 'The account service could not read that piece.'),
  'bad-vault-count': () => t('account.refusal.badVaultCount', 'That is more than the stack holds.'),
  'bad-vault-slot': () => t('account.refusal.badVaultSlot', 'The account service could not tell which piece that is.'),
  'bad-vault-grant': () => t('account.refusal.badVaultGrant', 'The account service could not read that grant.'),
  'heraldry-same': () => t('account.refusal.heraldrySame', 'That is already your guild\'s heraldry.'),
  'heraldry-moved': () => t('account.refusal.heraldryMoved', 'The guild\'s heraldry changed meanwhile. Look again.'),
  'heraldry-drakes': () => t('account.refusal.heraldryDrakes', 'Changing the heraldry costs {cost} silver from the guild\'s silver treasury, and it holds less.', { cost: HERALDRY_CHANGE_DRAKES }),
  'writ-own-guild': () => t('account.refusal.writOwnGuild', 'Officers and the Guildmaster can take from the guild Stores, so they cannot deliver to the guild\'s own writs.'),   // AUDIT 31 S6
  'guild-stores-mine': () => t('account.refusal.guildStoresMine', 'A member can only take out what they put in. The Officers and the Guildmaster can take the rest.'),   // AUDIT 31 R1
  'bad-budget': () => t('account.refusal.badBudget', 'A writ budget is 0 to {max, number} silver.', { max: MARKS_MAX }),
  'bad-quality': () => t('account.refusal.badQuality', 'Choose a quality from Crude to Masterwork, or none for a piece without quality.'),
  'bad-pay': () => t('account.refusal.badPay', 'A commission pays 1 to {max, number} silver.', { max: MARKET_PRICE_MAX }),
  'commission-recipe': () => t('account.refusal.commissionRecipe', 'Only pieces the market lists may be commissioned. Arrows and siege works cannot.'),
  'commission-crafter': () => t('account.refusal.commissionCrafter', 'There is no crafter by that name.'),
  'commission-self': () => t('account.refusal.commissionSelf', 'You cannot commission yourself.'),
  'commissions-max': () => t('account.refusal.commissionsMax', 'You may have {max} commissions posted at once.', { max: COMMISSIONS_MAX }),
  'commissions-crafter-max': () => t('account.refusal.commissionsCrafterMax', 'That crafter already has {max} commissions waiting, the most one crafter can have.', { max: COMMISSIONS_FOR_MAX }),
  'commission-unyielded': () => t('account.refusal.commissionUnyielded', 'Nothing produces what that piece is made of yet, so no one could make it.'),   // AUDIT 31 L2
  'commission-elsewhere': () => t('account.refusal.commissionElsewhere', 'That commission is filled at the boards of its own region.'),   // AUDIT 31 L6
  'commission-not-yours': () => t('account.refusal.commissionNotYours', 'That commission names another crafter.'),
  'commission-piece': () => t('account.refusal.commissionPiece', 'That piece is not what the commission asks.'),
  'commission-not-made': () => t('account.refusal.commissionNotMade', 'A commission must be filled with a piece you made.'),
  'commission-worn': () => t('account.refusal.commissionWorn', 'That piece is worn. A commission needs a new piece.'),
  // HOME-CROSSED (FIELD BUGS 2026-09-30): a home customs carried in - RESTORE's words for a crossed deed
  // (systems/online/onlineHomes.js HOME_CROSSED_LINES, pinned equal), and a realm act asked while the last is still out
  'home-crossed': () => t('account.refusal.homeCrossed', 'That came into the realm through customs. The bank of the Empire does not buy it back. It stays your home.'),
  busy: () => t('account.refusal.busy', 'Your last dealing with the realm is still being settled. Try again in a moment.'),
  server: () => t('account.refusal.server', 'The account service had a problem. Try again.'),
  offline: () => t('account.refusal.offline', 'Could not reach the account service. Check your connection.'),
  maintenance: () => t('account.refusal.maintenance', 'The account service is under maintenance for a minute. Try again shortly.'),   // RESTORE: the history restore's minute
  // REALM P1: the realm's characters (server-account/src/realm.js) - an online character's save, held by the service.
  'too-many-characters': () => t('account.refusal.tooManyCharacters', 'You have as many online characters as an account may hold. Delete one to make room.'),
  'no-realm-character': () => t('account.refusal.noRealmCharacter', 'That online character is not on this account.'),
  lease: () => t('account.refusal.lease', 'This character is now being played in another tab or on another device.'),
  seq: () => t('account.refusal.seq', 'This character was saved from somewhere else in the meantime. Rejoin to carry on.'),
  // CUSTOMS-CARRY (2026-09-29): the census is every trace the realm has from before it began (migration 0022) - said as
  // what counts, since "played online" read false to a player who had and never killed there
  // CUSTOMS-PASS (2026-09-29): and the one way past it, a developer's pass - named for the case it exists for, a character
  // played online on an older version of the game after the realm opened (which the relay admitted until REALM-DOOR)
  // CUSTOMS-ELSEWHERE (FIELD BUGS 2026-09-30): counted, but on the account it went online with
  'customs-other-account': () => t('account.refusal.customsOtherAccount', 'This character belongs to another account, the one you played it online with. Sign in with that account to bring it in.'),
  'customs-never-online': () => t('account.refusal.customsNeverOnline', 'The realm has no record of this character from before it opened (no Renown, online home, guild place, raid or cloud backup), so it cannot come in. Make a new online character instead. If you played it online on an older version of the game after the realm opened, ask the developers on Discord.'),
  'customs-already': () => t('account.refusal.customsAlready', 'That character has already been brought into the realm.'),
  // AUDIT REALM2 S1: a first save the realm reads - a new character's, or customs' own
  'realm-birth': () => t('account.refusal.realmBirth', 'The realm only accepts characters made in character creation. Delete this one and create it again.'),
  'customs-allowance': () => t('account.refusal.customsAllowance', 'That character carries more gold than customs lets in. Bring it online again.'),
  'customs-cards': () => t('account.refusal.customsCards', 'That character carries more cards than customs lets in. Bring it online again.'),   // CARDS9: the cards' customs
  'ranked-needs-account': () => t('account.refusal.rankedNeedsAccount', 'Ranked games need a registered account.'),   // CARDS10: a ranked seat's deck order (server-account/src/iliac.js)
  'bad-deck': () => t('account.refusal.badDeck', 'The table will not take that deck.'),
  'deck-short': () => t('account.refusal.deckShort', 'Your realm character does not hold every card of that deck.'),
  // LEGACY7: Project Legacy online (server-account/src/legacy.js) - a fallen character's tombstone, and a member's birth
  dead: () => t('account.refusal.dead', 'That character has died for good. Their house carries on: play one of its living members.'),
  'no-lineage': () => t('account.refusal.noLineage', 'The realm does not hold that family yet. Save once, then try again.'),
  'lineage-person': () => t('account.refusal.lineagePerson', 'That member of the family cannot take up the line. They have died, retired, married into it, or are still a child.'),
  'lineage-played': () => t('account.refusal.lineagePlayed', 'That member of the family already has a character in the realm.'),
  'lineage-model': () => t('account.refusal.lineageModel', 'A family keeps the way of death it was founded with.'),
  'too-many-lineages': () => t('account.refusal.tooManyLineages', 'You have as many families as an account may hold online.'),
  'lineage-stale': () => t('account.refusal.lineageStale', 'Your family was changed on another device. This one takes those changes in and saves again.'),
  'wed-no-line': () => t('account.refusal.wedNoLine', 'Only a character of a house (Project Legacy) can be wed in the realm.'),
  'wed-already': () => t('account.refusal.wedAlready', 'You are wed already.'),
  'wed-partner': () => t('account.refusal.wedPartner', 'They cannot marry now. They are already married, belong to no house, or are no longer the one who stood with you.'),   // AUDIT LEGACY III O1
  'lineage-too-large': () => t('account.refusal.lineageTooLarge', 'Your family\'s record has grown past what the realm keeps for one family.'),   // AUDIT LEGACY III O2/P1
  'wed-spent': () => t('account.refusal.wedSpent', 'That wedding was not yours to answer.'),
  // REZ-BLOODLINE AUDIT R1 (server-account/src/legacy.js realmRaise): a party's Resurrect the realm will not take back
  'not-dead': () => t('account.refusal.notDead', 'The realm holds no death of that character to take back.'),
  'raise-late': () => t('account.refusal.raiseLate', 'It is too late. That death is final now.'),
  'raise-no-line': () => t('account.refusal.raiseNoLine', 'Only a character of a house (Project Legacy) is held for a Resurrect.'),
  // AUDIT REALM2 S2: the online acts that cost gold are a realm character's
  'realm-only': () => t('account.refusal.realmOnly', 'Only an online character of the realm can do that.'),
  // REALM P2.1: a trade's sid another pair settled (server-account/src/realmTrade.js)
  'trade-spent': () => t('account.refusal.tradeSpent', 'That trade has already ended. Nothing changed hands.'),
  // REALM P2.2: an act that moves a realm character's gold on its record (server-account/src/realm.js)
  'realm-needed': () => t('account.refusal.realmNeeded', 'This online character must be playing in the realm to do that. Rejoin and try again.'),
  'realm-gold': () => t('account.refusal.realmGold', 'The realm holds less gold for this character than that costs.'),
  // MARKET-AUDIT (P6): a realm act's own words (systems/realmSaves.js realmGoldAct), as the market's tab and the stall read
  // them - said "The account service had a problem" (realmRefusalText says the realm door's own)
  'held': () => t('account.refusal.held', 'A trade or purchase is being settled. Try again in a moment.'),
  'left': () => t('account.refusal.left', 'You left the realm.'),
  'unknown': () => t('account.refusal.unknown', 'The realm did not answer. Join again to see how it ended.'),
  // CUSTOMS-PASS: the developer's route (server-account/src/realm.js grantCustomsPass), said by tools/customsPass.mjs - its
  // `not-developer` is MARKS1's one word above (MERGE 2: both sides wrote it; the one refusal says both routes)
  ambiguous: () => t('account.refusal.ambiguous', 'More than one account has that name. Use the account\'s id instead.'),
  // CHAP1: the Roll (server-account/src/npcRoll.js) - said only where a player would read one; the tracker keeps
  // the save's standing quietly while the Roll is shut (net/npcRollTracker.js)
  'chapters-closed': () => t('account.refusal.chaptersClosed', 'The guilds do not keep your standing on the realm yet.'),
  'roll-seed': () => t('account.refusal.rollSeed', 'Your standing with the guilds could not be read. The game may need updating.'),
  'roll-claim': () => t('account.refusal.rollClaim', 'Your standing with the guilds could not be sent. The game may need updating.'),
  'roll-unseeded': () => t('account.refusal.rollUnseeded', 'The realm has not read your standing with the guilds yet. It will try again.'),
  'roll-busy': () => t('account.refusal.rollBusy', 'Your standing with the guilds was being written. It will try again.'),
  // CHAP2a: a town's guild halls, witnessed (server-account/src/npcHalls.js) - asked quietly, said only if ever shown
  'halls-need-account': () => t('account.refusal.hallsNeedAccount', 'Only registered accounts can report a town\'s guild halls.'),
  // TOWN-ECON TE2 (server-account/src/townEcon.js): the towns' registry and their footsteps
  'towns-need-account': () => t('account.refusal.townsNeedAccount', 'Only registered accounts can report towns and their visits.'),
  'bad-town': () => t('account.refusal.badTown', 'That town could not be read.'),
  'towns-rate': () => t('account.refusal.townsRate', 'You have reported too many towns this hour. Try again later.'),
  'towns-closed': () => t('account.refusal.townsClosed', 'The towns\' economy is closed for now.'),   // AUDIT TOWN-ECON 2 SVC-7: the service's switch
  'town-unwalked': () => t('account.refusal.townUnwalked', 'Walk a town\'s streets before you report it.'),   // SVC-1: no tick of yours at its pixel
  'bad-hall': () => t('account.refusal.badHall', 'That town\'s guild halls could not be read. The game may need updating.'),
  'halls-rate': () => t('account.refusal.hallsRate', 'You have reported enough towns this hour.'),
  // AUDIT CHAP2: the claims' hour; a town a developer struck
  'roll-rate': () => t('account.refusal.rollRate', 'Your standing with the guilds has been sent often this hour. It will be sent again later.'),
  'hall-struck': () => t('account.refusal.hallStruck', 'That town\'s guild halls were struck from the record.'),
  // CHAP4d: a chapter's Focus - set by its Master alone, to a family its guild's own
  'not-master': () => t('account.refusal.notMaster', 'Only the chapter\'s Master sets its Focus.'),
  'no-focus': () => t('account.refusal.noFocus', 'The guild asks for no such thing.'),
  // CHAP6b: a backing in a chapter's Season - its Schism's side, its Succession's candidate
  'no-event': () => t('account.refusal.noEvent', 'The chapter has nothing this Season to back.'),
  'no-side': () => t('account.refusal.noSide', 'There is no such side to back.'),
  closed: () => t('account.refusal.closed', 'That has already been decided.'),
  'not-member': () => t('account.refusal.notMember', 'Only an active member of the guild may back its chapter.'),
  // CHAP7a: a guild's bid for a chapter's patronage - for the Season after this one, the guildmaster's, more than it stood at
  'no-season': () => t('account.refusal.noSeason', 'No Season is counted yet, so there is no patronage to bid for.'),
  'no-chapter': () => t('account.refusal.noChapter', 'There is no chapter there whose patronage a guild may bid for.'),
  'patron-low': () => t('account.refusal.patronLow', 'A bid for a patronage is at least 1,000 silver, and more than your guild bid before.'),
  // CARDS6: a gold card table's stake and its cash-out (server-account/src/cards.js)
  'cards-realm': () => t('account.refusal.cardsRealm', 'Only an online character of the realm can play a card table for gold.'),
  // SEA-BOUNTY (server-account/src/seaBounty.js): a freeport's bounty board
  'sea-bounty-realm': () => t('account.refusal.seaBountyRealm', 'Only an online character of the realm can post or collect a bounty.'),
  'sea-bounty-gold': () => t('account.refusal.seaBountyGold', 'A bounty is between {min} and {max} gold.', { min: SEA_BOUNTY_MIN.toLocaleString('en-US'), max: SEA_BOUNTY_MAX.toLocaleString('en-US') }),
  'sea-bounty-target': () => t('account.refusal.seaBountyTarget', 'There is no such captain on the board.'),
  'sea-bounty-self': () => t('account.refusal.seaBountySelf', 'You cannot put a bounty on your own head, or on a character of your own account.'),
  'sea-bounty-not-wanted': () => t('account.refusal.seaBountyNotWanted', 'That captain is no longer wanted.'),
  'sea-bounty-failed': () => t('account.refusal.seaBountyFailed', 'The harbormaster could not record that. Try again in a moment.'),
  // SHIP-PVP (server-account/src/seaWreck.js): a wreck's prizes
  'sea-prize-realm': () => t('account.refusal.seaPrizeRealm', 'Only an online character of the realm can take a prize from a wreck.'),
  'sea-prize-moved': () => t('account.refusal.seaPrizeMoved', 'Those goods were already taken. Look at the board again.'),
  'cards-closed': () => t('account.refusal.cardsClosed', 'The realm is not holding stakes for card tables right now. Try again later.'),
  'cards-stake-paid': () => t('account.refusal.cardsStakePaid', 'That stake has already been settled.'),
  'bad-table': () => t('account.refusal.badTable', 'The account service could not read that card table.'),
  'bad-stakes': () => t('account.refusal.badStakes', 'That table does not play at those stakes.'),
  'bad-buy-in': () => t('account.refusal.badBuyIn', 'A buy-in at that table must be between 20 and 100 big blinds.'),
  'cards-stake-failed': () => t('account.refusal.cardsStakeFailed', 'The stake could not be held. Try again.'),
  'cards-receipt': () => t('account.refusal.cardsReceipt', 'The table\'s cash-out could not be read.'),
  'cards-not-yours': () => t('account.refusal.cardsNotYours', 'That cash-out belongs to another account.'),
  'cards-no-stake': () => t('account.refusal.cardsNoStake', 'The realm holds no stake for that cash-out.'),
  'cards-other-character': () => t('account.refusal.cardsOtherCharacter', 'That cash-out belongs to another of your characters. It is paid to the one who staked it.'),
  'cards-cashout-failed': () => t('account.refusal.cardsCashoutFailed', 'The cash-out could not be paid. Try again.'),
  'cards-held': () => t('account.refusal.cardsHeld', 'This character has gold staked at a card table. Collect it before the character is deleted.'),
  'sea-held': () => t('account.refusal.seaHeld', 'Bounties, prizes or hold goods are waiting for this character at a freeport. Collect them before the character is deleted.'),   // AUDIT SEA VENTURES B4
  // INT3/INT4 (bible/06-Systems/Integrity-Arc.md): the judge's own (server-account/src/realm.js holdRefusal,
  // prepareRealmRecord)
  'trade-held': () => t('account.refusal.tradeHeld', 'This character\'s trading is frozen. The notice shown when it froze says why, and until when.'),   // AUDIT AUTO-HOLD: no review comes - a hold lifts on its own, or with the piece
  'record-unjudged': () => t('account.refusal.recordUnjudged', 'The realm has not checked this character\'s latest save yet. Play a moment and try again.'),
  // INT16-INT17 (bible/06-Systems/Integrity-Arc.md section 7): a progression claim's seat, and the play that pays for it
  // (server-account/src/progress.js)
  'progress-seat': () => t('account.refusal.progressSeat', 'Only the realm character you are playing earns that, and it is now open on another device. Open it here again to keep earning.'),
  'lineage-law': () => t('account.refusal.lineageLaw', 'The realm refused that copy of your family record because it breaks the family\'s rules. The realm keeps its own copy.'),   // INT18 (server-account/src/legacy.js putLineage)
  'progress-play': () => t('account.refusal.progressPlay', 'You have earned all that your play so far allows. Keep playing and it comes back.'),
  'piece-dupe': () => t('account.refusal.pieceDupe', 'Copies of that piece were found in the realm. It cannot be traded, sold or stored for others.'),
  'piece-claimed': () => t('account.refusal.pieceClaimed', 'Another character in the realm shows that piece too. Wait a few minutes while the realm settles whose it is.'),
  'piece-legacy': () => t('account.refusal.pieceLegacy', 'That came into the realm from a classic save through customs. It stays yours, and the realm does not trade it.'),
  'service-moved': () => t('account.refusal.serviceMoved', 'That character\'s record changed after its last clean save, so it cannot be rolled back.'),   // INT6: staff's
  'no-clean': () => t('account.refusal.noClean', 'That character has no save the realm judged clean to roll back to.'),   // INT6: the review's rollback (tools/realmReview.mjs)
  // FIRM1 (bible/06-Systems/Firmament.md): the Firmament's own (server-account/src/firmament.js)
  'firm-closed': () => t('account.refusal.firmClosed', 'The Firmament isn\'t available to you right now.'),
  'ql-closed': () => t('account.refusal.qlClosed', 'The questlines\' rewards are not available to you right now.'),   // QL12: QUESTLINES_OPEN shut (AUDIT QUESTLINES VOICE-QL: "are not", the voice's plain word - Voice.md)
  'ql-body': () => t('account.refusal.qlBody', 'That questline step could not be claimed.'),   // QL12: a claim the shared law refuses
  'firm-character': () => t('account.refusal.firmCharacter', 'This character could not be found for the Firmament. Try again.'),
  'firm-rid': () => t('account.refusal.firmRid', 'That request could not be read. Try again.'),
  'firm-key': () => t('account.refusal.firmKey', 'One of those stars is unknown.'),
  'firm-start': () => t('account.refusal.firmStart', 'Choose a birthsign first.'),
  'firm-path': () => t('account.refusal.firmPath', 'A star has no path back to your birthsign.'),
  'firm-points': () => t('account.refusal.firmPoints', 'Not enough points.'),
  'firm-rate': () => t('account.refusal.firmRate', 'Too many changes this hour. Try again later.'),
  'firm-stale': () => t('account.refusal.firmStale', 'Your stars changed in another session. Check them and try again.'),
  'firm-respec-empty': () => t('account.refusal.firmRespecEmpty', 'Nothing is learned yet.'),
  'repair-no-faction': () => t('account.refusal.repairNoFaction', 'That character\'s record holds no such faction, so nothing was repaired.'),   // SUMMON-REPAIR: the review's repair (tools/realmReview.mjs)
  'repair-not-set': () => t('account.refusal.repairNotSet', 'That faction does not have that flag on this character, so nothing was repaired. Check that it is the right character.'),   // SUMMON-REPAIR: a repair aimed at the wrong character mends nothing
  'mend-not-negative': () => t('account.refusal.mendNotNegative', 'That character\'s gold is not below zero, so nothing was mended. Check that it is the right character.'),   // PURSE-MEND: the review's mend (tools/realmReview.mjs)
  'mend-moved': () => t('account.refusal.mendMoved', 'That character\'s gold has changed since its findings were read, so nothing was mended. Read the findings again and try again.'),   // PURSE-MEND: played since, or the wrong character
  'repair-ticket': () => t('account.refusal.repairTicket', 'That ticket is already used for another fix on this character, so nothing was done. Use a new ticket.'),   // PURSE-MEND: a ticket names one act, a repair or a mend
  // SAFE1-SAFE7 (bible/11-Multiplayer/Chat-Safety-Arc.md): the chat's safety - a block, a report, the code of conduct, a ban
  'block-self': () => t('account.refusal.blockSelf', 'You cannot block yourself.'),
  'blocks-full': () => t('account.refusal.blocksFull', 'Your block list is full. Unblock someone first.'),
  'conduct-stale': () => t('account.refusal.conductStale', 'The Code of Conduct has changed. Read it again.'),
  'report-self': () => t('account.refusal.reportSelf', 'You cannot report yourself.'),
  'report-closed': () => t('account.refusal.reportClosed', 'Reports are not open on this server yet.'),
  'report-unwitnessed': () => t('account.refusal.reportUnwitnessed', 'Those lines could not be matched to what was said in chat, so nothing was sent.'),
  'report-shape': () => t('account.refusal.reportShape', 'That report could not be read.'),
  'report-reason': () => t('account.refusal.reportReason', 'Choose why you are reporting them.'),
  'report-stale': () => t('account.refusal.reportStale', 'Those lines are too old to report.'),
  'report-no-line': () => t('account.refusal.reportNoLine', 'There is nothing they said here to report. You can only report lines you saw while you were online.'),
  'bad-days': banRangeText,
  // AUDIT SAFE CLIENT-2: the ban as the service said it last - its end and the moderator's reason (`call` keeps them off
  // the 403: the account card's sign-in and recovery say it whole, through this one word, as every other door does)
  banned: () => (_banHeard ? bannedText(_banHeard.until, _banHeard.reason) : t('account.refusal.banned', 'This account is banned.')),
  // AUDIT SAFE DOC-4: a moderator's look at a case, and an unban of an account no ban holds
  'no-case': () => t('account.refusal.noCase', 'That player has no open case.'),
  'not-banned': () => t('account.refusal.notBanned', 'That account is not banned.'),
  // STAFF-PANEL2-FIX (server-account/src/safety.js modAct, every moderator's door): a case another staff member holds in
  // the staff panel, a case another act already took or closed, a sanction an Admin set, and a press of the wrong shape
  'staff-claimed': () => t('account.refusal.staffClaimed', 'Another staff member has taken that case in the staff panel.'),
  'case-acted': () => t('account.refusal.caseActed', 'Another moderator is acting on that case right now.'),
  'case-closed': () => t('account.refusal.caseClosed', 'That case is already closed.'),
  'admin-sanction': () => t('account.refusal.adminSanction', 'An Admin set this. Only an Admin can lift or shorten it.'),
  'bad-click': () => t('account.refusal.badClick', 'That request was not sent properly. Try again.'),
  // STAFF-PANEL5-FREEZE (server-account/src/staffFreeze.js): a staff freeze - every door but signing out, the account, the
  // realm's loads, the token and the staff chat; a frozen seller's goods; a fall naming a frozen player; the Staff tab's own
  frozen: () => t('account.refusal.frozen', 'Your account is frozen by staff. You can still talk to staff in the Staff tab.'),
  'market-seller-frozen': () => t('account.refusal.marketSellerFrozen', 'That seller\'s goods are on hold for now.'),
  'fallen-frozen': () => t('account.refusal.fallenFrozen', 'That player is held by staff. Nothing can be taken from them.'),
  'bad-text': () => t('account.refusal.badText', 'Write something to send.'),
  'no-thread': () => t('account.refusal.noThread', 'There is no staff chat open for you right now.'),
};
/** AUDIT SAFE CLIENT-2 (2026-10-17): THE SERVICE'S LAST WORD ON A BAN - `{ until, reason }` off the newest `banned`
 *  refusal any door answered (`call`), or null. The service refuses a banned account on every door but signing out
 *  (login and recovery included, 403 `{ error: 'banned', until, reason }`), and the screens that show a refusal show its
 *  word alone (`accountRefusalText(r.error)` - ui/accountFlow.js); kept here, the word 'banned' reads as the ban itself.
 *  Each `banned` answer replaces it, so it is never another account's. */
let _banHeard = /** @type {{ until: number, reason: string|null } | null} */ (null);
export const REFUSALS = /** @type {Readonly<Record<string, string>>} */ (localizedTable(REFUSAL_WORDS));

/** The sentence for a refusal, never `undefined` and never the raw
 *  machine word: a word this table has not met is still a refusal, and
 *  a player staring at `handle-frobnicated` has been told nothing. */
export const accountRefusalText = (error) => REFUSALS[error] ?? REFUSALS.server;

/** NAME-AS (2026-10-12): WHY MY CHARACTER'S NAME STOOD ASIDE, in words - a sentence for each reason the mint can give
 *  (server-account/src/accounts.js wornNameRefusal, and wornNameOf's `taken`). The filter's names the word it caught where
 *  the mint says one (nameWhyText - NAME-F: a refusal names it, so a player whose real name was caught can say so). */
export const NAME_WHY_TEXT = Object.freeze({
  email: 'it looks like an email address, which is never shown to other players',
  long: `it is longer than ${NAME_MAX} characters`,
  letters: 'it uses characters an online name cannot have (only plain letters, digits, spaces and punctuation)',
  refused: 'the name filter blocks it',
  taken: 'it is another player\'s username',
});
/** NAME-AS: the line the chat says ONCE (scenes/world.js adoptIssued) when a mint signed my account's name where I chose
 *  my character's - or null where it did not. `who` is the minter's answer (accountTokenMinter's `onIssued`): its `name`
 *  is the one the room reads, which is the account's wherever a reason is given - that is what the reason is for. */
export function nameWhyText(who) {
  const why = who?.nameWhy;
  if (typeof why !== 'string' || !why) return null;
  const reason = why === 'refused' && typeof who.nameWord === 'string' && who.nameWord ? `the name filter reads it as "${who.nameWord}"` : (NAME_WHY_TEXT[why] ?? 'it cannot be used online');
  return `Your character's name cannot be shown online: ${reason}. Others see you as ${who.name}.`;
}

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
 * @returns {Promise<{ok: boolean, data?: any, error?: string, status?: number, unknown?: boolean}>}
 */
/** SCALE4g (2026-10-10, Mac: "really future proof our archetecture"; bible/11-Multiplayer/Scale-Arc.md SCALE4g): THE
 *  PAGE'S D1 BOOKMARK - the newest position in the account database any answer to this session has said it saw. Sent
 *  back on every call (`x-d1-bookmark`), so a read route the service answers off a read replica answers no older than
 *  everything this tab has seen and written there. It belongs to the session secret it was earned under: a sign-in, a
 *  new guest or another account starts with none (the service then starts at the primary), so a session made a moment
 *  ago is never looked for on a replica that has not heard of it yet. Kept in memory only - a new page starts fresh. */
export const D1_BOOKMARK_RE = /^[0-9A-Za-z][0-9A-Za-z-]{0,159}$/;
/** AUDIT SCALE II A-2/A-6/C-7 (2026-10-11, the audit of SCALE4d-SCALE5d; Mac: "Lets do an audit on everything. Ensure
 *  perfection"): THE SERVICE'S BOOKMARK READS - the routes it answers on a D1 session started from the bookmark a call
 *  carries, by route and method (server-account/src/service.js REPLICA_ROUTES, which a pin holds this equal to). Only
 *  these carry the page's bookmark, and only their answers move it.
 *  EVERY OTHER CALL FORGETS IT, before it is sent and again when it is answered: a bookmark is a position the tab has SEEN,
 *  and no write route answers one - so a write left the bookmark behind it, and the next read, started from there, could
 *  be served by a replica that had not heard the write. A Sigil Broker sale whose answer was lost asked the account view
 *  whether it had landed, off a replica from before it, read "no", and handed the Sigil Stones back while the service
 *  kept the sale. With the bookmark forgotten, the read after a write starts at the primary (the service's own law for
 *  a call that carries none) - and an answer to a read sent BEFORE a forget is never kept after it (`_d1Era`), since it
 *  may have been served before the write landed. The mint is among the reads: it starts at the primary whatever it
 *  carries (service.js PRIMARY_FIRST_ROUTES, A-1), so its answer is a position no older than the tab's last write.
 *  AND A CALL THAT COULD NOT BE MADE FORGETS IT (`offline`), and so does a read answered with none (C-7): a service rolled
 *  back to before SCALE4g (acct111) says no bookmark, and its preflight refuses the header - kept, every call after it
 *  failed `offline` until the page was reloaded. */
export const D1_BOOKMARK_READS = new Map([
  ['/v1/auth/token', 'POST'],
  ['/v1/heartbeat', 'POST'],
  ['/v1/account', 'GET'],
  ['/v1/realm', 'GET'],
  ['/v1/prof/state', 'POST'],
  ['/v1/prof/motherlodes', 'POST'],
  // DISPLAY-REPLICA (2026-10-13; server-account/src/service.js REPLICA_ROUTES): and the display reads
  ['/v1/homes/town', 'POST'],
  ['/v1/homes/mine', 'POST'],
  ['/v1/homes/rooms', 'POST'],
  ['/v1/homes/decor', 'POST'],
  ['/v1/prof/pixels', 'POST'],
  ['/v1/market/vendors', 'POST'],
  ['/v1/marks/balance', 'POST'],
  ['/v1/guilds/invites', 'POST'],
  ['/v1/realm/lineages', 'POST'],
  ['/v1/realm/unions', 'POST'],
  ['/v1/saves', 'GET'],
  ['/v1/arena/board', 'POST'],
  ['/v1/festival/town', 'POST'],   // WITCH1: a town's Hearth Offerings
]);
let _d1Mark = { secret: null, mark: null };
/** AUDIT SCALE II A-2: how many times the page's bookmark has been forgotten - a read's answer is kept only under the
 *  era it was sent in. */
let _d1Era = 0;
/** D1's own shape - fixed-width hex positions first - orders by its first 26 characters; another shape is taken as newest. */
const D1_POSITION_RE = /^[0-9a-f]{8}-[0-9a-f]{8}-[0-9a-f]{8}-/;
const newerMark = (/** @type {string} */ a, /** @type {string} */ b) => !(D1_POSITION_RE.test(a) && D1_POSITION_RE.test(b)) || a.slice(0, 26) >= b.slice(0, 26);
/** The bookmark to send with a call under `secret` - null for none, or for another session's. */
export function d1BookmarkFor(/** @type {string|null} */ secret) { return secret && _d1Mark.secret === secret ? _d1Mark.mark : null; }
/** An answer under `secret` said `mark`: kept if it is the session's first or no older than the one kept. */
export function noteD1Bookmark(/** @type {string|null} */ secret, /** @type {unknown} */ mark) {
  if (!secret || typeof mark !== 'string' || !D1_BOOKMARK_RE.test(mark)) return;
  if (_d1Mark.secret !== secret || !_d1Mark.mark || newerMark(mark, _d1Mark.mark)) _d1Mark = { secret, mark };
}
/** Forget the page's bookmark: the next read starts at the primary, and no read already on the wire keeps its answer's
 *  (AUDIT SCALE II A-2). Every door that writes to the service outside `call` asks it before and after its write
 *  (systems/realmSaves.js realmAsk, systems/cloudSaves.js ask). */
export function forgetD1Bookmark() { _d1Mark = { secret: null, mark: null }; _d1Era += 1; }

/** SESSION-SIGN (server-account/src/sessionPass.js; bible/11-Multiplayer/Scale-Arc.md SESSION-SIGN): THE SESSION'S PASS -
 *  who the service's lookup found, signed for five minutes and bound to the secret it was minted for, which a hot route
 *  believes without asking the database. The page keeps the one an answer last handed it, with that secret, and sends it
 *  with that secret's calls alone - so a service from before SESSION-SIGN, whose preflight lets no such header through,
 *  is never sent one: it never handed one. */
let _pass = { secret: /** @type {string|null} */ (null), pass: /** @type {string|null} */ (null) };
/** The pass to send with a call under `secret` - null for none, or for another session's. */
export function sessionPassFor(/** @type {string|null} */ secret) { return secret && _pass.secret === secret ? _pass.pass : null; }
/** An answer under `secret` (`res`, a fetch Response) handed a pass: kept. An answer with none keeps the one held. */
export function noteSessionPass(/** @type {string|null} */ secret, /** @type {any} */ res) {
  let p = null;
  try { p = res?.headers?.get?.(SESSION_PASS_HEADER) ?? null; } catch { p = null; }   // a fake answer with no headers hands none
  if (secret && typeof p === 'string' && p) _pass = { secret, pass: p };
}
/** Forget the pass: a sign-out, a refusal of the session (`auth`), a call that could not be made (a preflight refusing the
 *  header - a service rolled back past SESSION-SIGN), and an answer to a call that changes the account a pass names under
 *  its secret (PASS_MOVES) - the next call asks without one. */
export function forgetSessionPass() { _pass = { secret: null, pass: null }; }
/** AUDIT PLAN-1000 E2: the calls whose answer moves what a pass says - a guest registered under the same secret is a pass's
 *  handle changed (a guest's pass answered `mail-needs-account` for four minutes), and a sign-in, a recovery, a new guest,
 *  a sign-out or a password changed move the session itself. */
const PASS_MOVES = new Set(['/v1/auth/register', '/v1/auth/login', '/v1/auth/recover', '/v1/auth/guest', '/v1/auth/logout', '/v1/account/password']);
/** AUDIT PLAN-1000 E7: a call that timed out or was aborted reached a service that let its header through - the pass stays
 *  (the heartbeat's own timeout, under the very overload the pass is for, would otherwise cost the next call its lookup). */
export const passKeptThrough = (/** @type {any} */ e) => e?.name === 'TimeoutError' || e?.name === 'AbortError';

/** BUSY-GATE (net/busyLaw.js): the page's word from the service on its load - the overload answers in a row (`n`) and
 *  the moment the reads may be asked again (`until`, ms). One for the page: the database is one, whichever book asked. */
let _busy = { n: 0, until: 0 };
/** BUSY-GATE: the page's busy word let go (a test's fresh page). */
export function _resetBusyForTests() { _busy = { n: 0, until: 0 }; }
/** BUSY-GATE: the moment the reads may be asked again (ms; 0 when the service has said nothing). */
export const busyUntil = () => _busy.until;
const holdFor = (/** @type {number} */ ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
/** AUDIT LEAN-READS: whether an overload's word on a call that left at `sentAt` is a new one - the call left after the last
 *  hold ran out. One left before it is the stall or the burst that hold already answered. */
const busyAgain = (/** @type {number} */ sentAt) => sentAt >= _busy.until;

/** QUEST-HOME: the page's ears for a home that moved (onHomeOrders). */
const _homeOrderEars = new Set();
/**
 * FIELD BUGS 2026-10-14 QUEST-HOME (Mac, 2026-10-15: "Close both"): THE PAGE'S EAR FOR A HOME THAT MOVED. An answer of
 * the service's that says a home was bought, held or given up carries its signed orders (`homeOrders`,
 * server-account/src/index.js homeOrdersOf) - and each is handed to every ear here, whichever book made the act (a
 * door's claim, a bank's deed sold, a guild's hall, an arena move, a character deleted), to be carried to the hub, whose
 * fan reaches every page online (scenes/world.js). One door, so no act can forget to say it. Answers the ear's removal.
 * @param {(order: string) => void} ear
 */
export function onHomeOrders(ear) { _homeOrderEars.add(ear); return () => { _homeOrderEars.delete(ear); }; }
/** QUEST-HOME: an answer's home orders handed to every ear - an ear's fault is never the call's. */
function heardHomeOrders(/** @type {any} */ data) {
  if (!Array.isArray(data?.homeOrders)) return;
  for (const order of data.homeOrders) {
    if (typeof order !== 'string' || !order) continue;
    for (const ear of [..._homeOrderEars]) { try { ear(order); } catch { /* an ear's fault is never the call's */ } }
  }
}

export async function call({ fetch, base = DEFAULT_ACCOUNT_SERVICE, secret = null, keepalive = false, now = Date.now, rand = Math.random, hold = holdFor }, path, body = null) {
  const headers = { accept: 'application/json' };
  if (body) headers['content-type'] = 'application/json';
  // THE ONE PLACE A CREDENTIAL IS SENT. There is no `?secret=` branch
  // to reach and no argument that could add one - AUDIT-ACC F13 shut
  // that door on the service and this side does not get to reopen it.
  if (secret) headers.authorization = `Bearer ${secret}`;
  const method = body ? 'POST' : 'GET';
  // BUSY-GATE: WHILE THE SERVICE SAYS IT IS OVERLOADED, ITS READS ARE NOT ASKED. A held read is answered as the service
  // itself answers one then - `server`, 503, which every book asks again on its own schedule - without the request, and
  // never at once (BUSY_HOLD_MS). Only the reads busyLaw.js names: a write, a sign-in or an act always goes.
  if (busyRead(path, method) && now() < _busy.until) {
    await hold(BUSY_HOLD_MS);
    return { ok: false, error: 'server', status: 503, busy: true };
  }
  // AUDIT SCALE II A-2: a bookmark read carries the page's bookmark; any other call forgets it, now and once answered
  const read = D1_BOOKMARK_READS.get(path) === method;
  if (!read) forgetD1Bookmark();
  const era = _d1Era;
  const mark = d1BookmarkFor(secret);   // SCALE4g: the session's newest D1 position, for a read a replica serves
  if (mark) headers['x-d1-bookmark'] = mark;
  const pass = sessionPassFor(secret);   // SESSION-SIGN: the session's pass, for a hot route
  if (pass) headers[SESSION_PASS_HEADER] = pass;

  let res;
  // AUDIT LEAN-READS: when this call left - an overload's word (a timeout, a 503) on a call that left before the last hold
  // ran out is the stall that hold answered, never a second word on it (busyAgain)
  const sentAt = now();
  try {
    res = await fetch(`${base}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      // AUDIT RENOWN1 GAME-8: a call made as the page goes (the Renown report on pagehide) asks the browser to finish
      // it after the page is gone - through this one door, so the credential still rides the header and nowhere else
      ...(keepalive ? { keepalive: true } : {}),
    });
  } catch (e) {
    // A NETWORK FAILURE IS A REFUSAL, NOT A THROW. ONCRASH1's law on
    // this side too: a throw out of a button handler ends more than the
    // button. Every arm of this function returns the same shape.
    forgetD1Bookmark();   // AUDIT SCALE II A-6: a call that could not be made - a preflight refusing the header among them
    if (!passKeptThrough(e)) forgetSessionPass();   // SESSION-SIGN: the same, for the pass's - but a timeout's (E7)
    // SLOW-SHED (bible/11-Multiplayer/Scale-Arc.md SLOW-SHED): A READ THE SERVICE WAS TOO SLOW TO ANSWER IS ITS OVERLOAD'S
    // WORD - its reads stand back as an overload answer stands them back. In the 18:05 overload the database answered
    // slowly and refused almost nothing: each tab's read timed out, was `offline` to the gate, and was asked again, and
    // the region's traders were asked four times as often. A write, a sign-in or an act that times out holds nothing.
    // AUDIT LEAN-READS C3: ONE STALL IS ONE WORD - the reads out together when the line stalls all time out together, and
    // counted each they held the page a minute for one stall; a timeout of a call that left before the last hold ran out
    // counts nothing (a read waits 15 s to time out, past the first hold's 2.5-5 s), so a stall holds the first wait
    // (BUSY_BASE_MS's), and the wait doubles only while reads sent after it keep timing out.
    if (e?.name === 'TimeoutError' && busyRead(path, method) && busyAgain(sentAt)) {
      const n = _busy.n + 1;
      _busy = { n, until: now() + busyWaitMs(n, rand()) };
    }
    return { ok: false, error: 'offline' };
  }
  if (PASS_MOVES.has(path)) forgetSessionPass(); else noteSessionPass(secret, res);   // SESSION-SIGN E2

  // SCALE4g: a read's answer says its session's newest position. AUDIT SCALE II: kept only in the era it was sent in (A-2);
  // a read answered with none lets the page's go (C-7); any other call forgets it again, now that it is answered (A-2)
  let said = null;
  try { said = res.headers?.get?.('x-d1-bookmark') ?? null; } catch { said = null; }   // a fake answer with no headers says none
  if (!read) forgetD1Bookmark();
  else if (era === _d1Era) {
    if (said == null) { if (_d1Mark.secret === secret) forgetD1Bookmark(); } else noteD1Bookmark(secret, said);
  }
  let data = null, parsed = false;
  try { data = await res.json(); parsed = true; } catch { data = null; }

  if (!res.ok) {
    if (data?.error === 'auth') forgetSessionPass();   // SESSION-SIGN: a session refused is no pass's
    // BUSY-GATE: the service says it is overloaded - its reads stand back, the wait doubling with each such answer in a
    // row, never shorter than the answer's own Retry-After
    if (busyAnswer(res.status, typeof data?.error === 'string' ? data.error : 'server')) {
      let after = null;
      try { after = res.headers?.get?.('retry-after') ?? null; } catch { after = null; }
      // AUDIT LEAN-READS: and ONE BURST IS ONE WORD - the reads out together when the shed opens are all answered 503, and
      // counted each they held the page up to a minute; the answer's own Retry-After stands either way
      const again = busyAgain(sentAt);
      const n = again ? _busy.n + 1 : _busy.n;
      _busy = { n, until: Math.max(_busy.until, now() + Math.max(again ? busyWaitMs(n, rand()) : 0, retryAfterMs(after))) };
    }
    // The service says `{ error: '<word>' }`. A proxy, a 502 or an
    // HTML error page says nothing we can read, and `server` is the
    // honest answer for that rather than a guess at which word it meant.
    return { ok: false, error: typeof data?.error === 'string' ? data.error : 'server', ...(typeof data?.why === 'string' ? { why: data.why } : {}), ...(Number.isSafeInteger(data?.seq) ? { seq: data.seq } : {}), ...(Number.isSafeInteger(data?.at) ? { at: data.at } : {}), ...(typeof data?.card === 'string' ? { card: data.card } : {}),   // AUDIT WB A5: and the rung, where the service names one; REALM P2.2: and a realm record's sequence; AUDIT2 GUILD2 S7: and when a refused act may come again; AUDIT CARDS-6 D7: and the card a short deck lacks
      ...(Number.isSafeInteger(data?.position) ? { position: data.position } : {}), ...(Number.isSafeInteger(data?.wait) ? { wait: data.wait } : {}),   // AUDIT SCALE II L4a: the sign-in line's place and its wait (ADMIT-LINE's `queue`)
      ...(Array.isArray(data?.keeps) ? { keeps: data.keeps.filter((k) => typeof k === 'string').slice(0, 16) } : {}),   // GUILD3c: and everything that holds a guild that would go
      ...(Number.isSafeInteger(data?.cakes) ? { cakes: data.cakes } : {}), ...(Number.isSafeInteger(data?.bowls) ? { bowls: data.bowls } : {}),   // WITCH1: a festival refusal's counts, the pack's faces
      ...(data?.error === 'banned' ? heardBan(data) : {}),   // AUDIT SAFE CLIENT-2: a ban's end and its reason
      status: res.status };
  }
  // MARKET-AUDIT (P1): every JSON route answers a body, so a 2xx whose body never came (the door's wait ended mid-body, a
  // dropped connection) is no word on the act - `offline`, as a request that never left: an act is kept and asked again
  // with its own id (the service's `repeat` answers one that landed), a read shows the last good view. As `ok` with no
  // data it let a kept purchase go unminted and cached a blank market for a minute. A 204 says it has nothing to say.
  if (!parsed && res.status !== 204) { forgetD1Bookmark(); return { ok: false, error: 'offline', unknown: true, status: res.status }; }   // AUDIT SCALE II A-6: `offline`, as one never made
  _busy = { n: 0, until: _busy.until };   // BUSY-GATE: an answer starts the count again; a hold already running runs out
  heardHomeOrders(data);   // QUEST-HOME: a home bought, held or given up, said to every page online
  return { ok: true, data, status: res.status };
}

/** AUDIT SAFE CLIENT-2: a `banned` refusal's end and reason, kept as the service's last word on a ban (`_banHeard`) and
 *  answered for the caller's refusal - an end that is not a time is none, a reason past a line is cut. @param {any} data */
function heardBan(data) {
  const until = Number.isSafeInteger(data?.until) && data.until > 0 ? data.until : 0;
  const reason = typeof data?.reason === 'string' && data.reason.trim() ? data.reason.trim().slice(0, 200) : null;
  _banHeard = until ? { until, reason } : null;
  return until ? { until, ...(reason ? { reason } : {}) } : {};
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
 *  `{ recoveryCodes, handle }` - RECOVERY-SET: this build asks for the
 *  set (`set: true`; a service before acct131 answers `{ recoveryCode }`
 *  and ignores the ask) - and they are readable exactly once.
 *  TERMS1: with the versions ticked on the form that names it. */
export const register = (io, handle, password, accepted = null) =>
  call(io, '/v1/auth/register', { handle, password, ...legalFields(accepted), set: true });

/** `{ id, name, kind, sessionId, secret }` for a new device. */
export const login = (io, handle, password, label = null) => call(io, '/v1/auth/login', { handle, password, label });

/** Spend a recovery code: a new password, and every device signed out
 *  including this one. RECOVERY-SET: this build asks for the set
 *  (`set: true`); the answer's `codesLeft` counts the set's others, and a
 *  single code, or the last, answers a fresh set (`recoveryCodes`). */
export const recover = (io, handle, code, password) => call(io, '/v1/auth/recover', { handle, code, password, set: true });

/** `{ account, devices }`. A GET, so the secret rides the header and
 *  there is no body at all. */
export const readAccount = (io) => call(io, '/v1/account');

/** The old password is required even from inside a live session, so a
 *  stolen device cannot lock its owner out. Signs out every OTHER
 *  device; this one stays. */
export const changePassword = (io, oldPassword, password) =>
  call(io, '/v1/account/password', { oldPassword, password });

/** RECOVERY-SET: a NEW set of recovery codes, behind the password and
 *  one current code (AUDIT RECOVERY-SET A1) - `{ recoveryCodes,
 *  codesLeft }`, readable exactly once, the old set dead with it. */
export const newRecoveryCodes = (io, password, code) => call(io, '/v1/account/recovery-codes', { password, code });

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
/** WITCH1: wear one profile icon, or none (null: the character's face) - the wardrobe after the write. The service refuses
 *  `not-held` for an icon this account does not hold. */
export const equipIcon = (io, icon) => call(io, '/v1/account/icon', { icon: icon ?? null });
/** GLYPH-WEAR (2026-10-02, Mac: "players can also equip/unequip their glyphs"): show one glyph (`on` true) or hide it -
 *  the wardrobe after the write (`glyphs` still all that is true, `glyphsOff` the ones taken off). The service refuses
 *  `not-held` for a glyph that is not true of this account. */
export const equipGlyph = (io, glyph, on) => call(io, '/v1/account/glyph', { glyph, on: !!on });
/** NAME-AS (2026-10-12, Mac: "toggle to use their account name or character name for ingame use"): which name the room
 *  reads - 'account' or 'character' (server-account/src/accounts.js NAME_AS) - `{ ok, nameAs }`, the choice the row now
 *  holds. It asks; the service keeps it, and every later mint signs it (a character's name where it can be worn). */
export const chooseNameAs = (io, as) => call(io, '/v1/account/name', { as });
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

/** SAFE1 (bible/11-Multiplayer/Chat-Safety-Arc.md): MY BLOCK LIST - `{ ok, blocks: [{ sub, name, at }] }`, and the same
 *  answered by a block or an unblock. */
export const safetyBlocks = (io) => call(io, '/v1/safety/blocks', {});
export const safetyBlock = (io, target) => call(io, '/v1/safety/block', { target });
export const safetyUnblock = (io, target) => call(io, '/v1/safety/unblock', { target });
/** SAFE3: A REPORT - the account, a reason, a note and the stamped lines as heard (net/chat.js reportLines).
 *  `{ ok, case, repeat?, muted?, order? }` - an `order` the caller carries to every room it holds (MOD1's carrier). */
export const safetyReport = (io, { target, reason, note = '', lines }) => call(io, '/v1/safety/report', { target, reason, note, lines });
/** SAFE7: THE CODE OF CONDUCT AGREED - the version the player read. `{ ok, conduct }`. */
export const safetyConduct = (io, v) => call(io, '/v1/safety/conduct', { v });
/** SAFE4: A MODERATOR'S BAN (`days` 0 for good), UNBAN AND LOOK - by `{ target }` (an account) or `{ name }`. A ban's and
 *  an unban's answer carries an `order` to carry to every room, as a mute's does. AUDIT SAFE SERVICE-10: a ban's
 *  `reason`, the moderator's words its player is shown - sent only when there are some. */
export const modBan = (io, who, days, reason = '') => call(io, '/v1/mod/ban', { ...who, days, ...(reason ? { reason } : {}) });
export const modUnban = (io, who) => call(io, '/v1/mod/unban', { ...who });
export const modStrikes = (io, who) => call(io, '/v1/mod/strikes', { ...who });
/** AUDIT SAFE DOC-4 (2026-10-17): THE REPORTS' QUEUE, READ IN THE GAME - a moderator's (`not-moderator` for anyone else).
 *  `modCases` the open cases, the most reporters who count first (`{ ok, cases: [{ id, target, name, reports, credible,
 *  reasons, ai, auto, openedAt, updatedAt }] }`); `modCase` one account's open case, its lines, reasons, notes and the
 *  reviewer's verdict with the line it flagged (`no-case` when none is open); `modDismiss` closes it with no action -
 *  its answer's `order`, an unmute when an automatic mute it caused was still running, carried as a mute's is. */
export const modCases = (io) => call(io, '/v1/mod/cases', {});
export const modCase = (io, who) => call(io, '/v1/mod/case', { ...who });
export const modDismiss = (io, who) => call(io, '/v1/mod/dismiss', { ...who });

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

/** Keep the session this device signed in with. The RECOVERY CODES ARE
 *  NEVER PART OF THIS - `register`, `recover` and `newRecoveryCodes`
 *  hand them back and they are the screen's to show and the player's to
 *  write down. */
export function keepSession(storage, { id, name, kind, sessionId, secret, glyphs, aura, icon, nameAsAt }) {
  try {
    storage?.setItem?.(SESSION_KEY, JSON.stringify({ id, name, kind, sessionId, secret, glyphs, aura, icon, nameAsAt }));   // SHADOW-FANG: `glyphs` when the service has stated them (adoptIdentity) - JSON leaves it out otherwise; WB9g: `aura` likewise; WITCH1: `icon` likewise; NAME-AS: `nameAsAt` likewise
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
 * NAME-AS (2026-10-12): `name` HERE IS THE ACCOUNT'S. The stored session is the account's picture (the profile mark reads
 * its name as the account's), and since NAME-AS the room may read a character's name instead - so the minter hands this
 * door the answer's `accountName` and the live sessions its `name` (accountTokenMinter, below). And `nameAsAt`: the
 * moment the service took a choice of name made on this device (ui/accountFlow.js chooseName), stamped and never
 * guessed - the world host says hello again when it moves (scenes/world.js nameAsFrame), so the room reads the new name
 * now. Only ever forward: an older stamp is no news.
 *
 * WITCH1 (2026-10-20): AND THE PROFILE ICON WORN (`icon`, null for the character's face), by the aura's law - the
 * profile mark and the account card read it here (systems/ownGlyphs.js ownIcon).
 *
 * @param {any} storage
 * @param {{ name?: string, kind?: string, glyphs?: string[], glyphsOff?: string[], aura?: string|null, icon?: string|null, nameAsAt?: number, secret?: string }} [who]
 */
export function adoptIdentity(storage, { name, kind, glyphs, glyphsOff, aura, icon, nameAsAt, secret } = {}) {
  const was = storedSession(storage);
  if (!was) return false;
  if (typeof secret === 'string' && was.secret !== secret) return false;
  const next = { ...was };
  if (typeof name === 'string' && name) next.name = name;
  if (kind === 'guest' || kind === 'linked') next.kind = kind;
  const off = Array.isArray(glyphsOff) ? glyphsOff : [];   // GLYPH-WEAR
  if (Array.isArray(glyphs)) next.glyphs = glyphs.filter((g) => typeof g === 'string' && g.length <= 24 && !off.includes(g)).slice(0, 16);
  if (aura !== undefined) next.aura = typeof aura === 'string' && AURAS.includes(aura) ? aura : null;   // WB9g: one that exists, or none
  if (icon !== undefined) next.icon = typeof icon === 'string' && ICONS.includes(icon) ? icon : null;   // WITCH1: likewise
  if (Number.isSafeInteger(nameAsAt) && nameAsAt > 0 && !(Number.isSafeInteger(was.nameAsAt) && was.nameAsAt >= nameAsAt)) next.nameAsAt = nameAsAt;   // NAME-AS: forward only
  const sameGlyphs = (next.glyphs ?? []).join('+') === (was.glyphs ?? []).join('+');
  const sameAura = (next.aura ?? null) === (was.aura ?? null) && (next.icon ?? null) === (was.icon ?? null);   // WITCH1: and the icon
  if (next.name === was.name && next.kind === was.kind && sameGlyphs && sameAura && next.nameAsAt === was.nameAsAt) return false;   // nothing to write, and a write is a storage event every open tab hears
  return keepSession(storage, next);
}

/** Forget it. Called on a deliberate sign-out AND whenever the service
 *  answers `auth`, because a secret the far end has stopped honouring
 *  is not a session - keeping it would make every later call fail the
 *  same way with nothing on screen explaining why. */
export function forgetSession(storage) {
  forgetSessionPass();   // SESSION-SIGN: the session's pass with it
  try { storage?.removeItem?.(SESSION_KEY); return true; } catch { return false; }
}

/** SCALE2 (2026-09-30, the scaling audit): how long a minted token is handed to OTHER rooms before a fresh one is
 *  minted. A relay room spends a token once - in THAT room (server/src/index.js `_spent`, one set a room) - so the one
 *  token may open the cell, its halos, the hub and the region channel of one connect. A minute covers a connect's
 *  burst (and a deploy's reconnect wave) and keeps what the token signs - the level, the title, the guild - no older
 *  than that in any room it opens; the token itself lives MAX_TTL_S (five minutes). */
export const TOKEN_REUSE_MS = 60_000;

/** STORM-SHED (2026-10-06 evening, the account service overloaded a second time - "D1 DB is overloaded"; decorations
 *  missing): A FAILED MINT HOLDS THE PAGE'S NEXT ONE OFF. A room whose hello the relay refused for want of a token asks
 *  again within BACKOFF_MAX_MS (net/online.js) - right for a busy room, ruinous for a busy service: every room of every
 *  tab (the cell, its halos, the hub, the region channel) minted afresh every few seconds while the service failed, and
 *  a mint is a dozen statements. A reconnect wave at 20:10 was 3,658 mints in five minutes where 470 is the pace, most of
 *  them failed, and the failures asking again held the database down. So a failure holds the next mint off MINT_COOL_MS,
 *  doubling with each failure in a row to MINT_COOL_MAX_MS, jittered (net/backoff.js) - a room asking meanwhile is
 *  answered null at once with the failure's word - and a token lets it go. */
export const MINT_COOL_MS = 2_000;
export const MINT_COOL_MAX_MS = 60_000;

/** AUDIT SCALE II L4a (2026-10-11; Mac: "Lets do an audit on everything. Ensure perfection"): A PLACE IN THE SIGN-IN LINE
 *  IS NOT A FAILURE. ADMIT-LINE answers a mint it holds back 503 `queue` with the place and the wait before asking again
 *  (server-account/src/admit.js), and the minter read it as any failure: MINT_COOL_MS doubling to MINT_COOL_MAX_MS. A
 *  player whose turn came mid-cool waited up to a minute past it, and a cool doubled past ADMIT_KEEP_MS lost the place
 *  for good. So a `queue` holds the next mint for the line's own wait - within the line's own bounds, ADMIT_WAIT_MIN_MS
 *  and ADMIT_WAIT_MAX_MS (a pin holds these two equal to them: the client never imports the service), never shorter
 *  than told (asked sooner, the line answers the same place), and stretched by at most MINT_LINE_JITTER of itself so a
 *  wave told one wait does not ask again in one instant. It does not double and is no failure in a row; every other
 *  failure keeps STORM-SHED's law. */
export const MINT_LINE_WAIT_MIN_MS = 1_000;
export const MINT_LINE_WAIT_MAX_MS = 30_000;
export const MINT_LINE_JITTER = 0.1;
/** The hold a `queue` answer telling `wait` puts on the next mint, ms. `rand` is Math.random's shape. */
export const lineHoldMs = (/** @type {unknown} */ wait, rand = Math.random) => {
  const told = Math.min(MINT_LINE_WAIT_MAX_MS, Math.max(MINT_LINE_WAIT_MIN_MS, typeof wait === 'number' && Number.isFinite(wait) ? wait : MINT_LINE_WAIT_MIN_MS));
  return Math.min(MINT_LINE_WAIT_MAX_MS, Math.round(told * (1 + MINT_LINE_JITTER * rand())));
};

/**
 * ACC1d: ONE TOKEN FOR ONE RELAY CONNECTION - NEVER TWICE INTO ONE ROOM.
 *
 * This is what `OnlineSession({ mintToken })` (net/online.js) calls on
 * every socket open, with the ROOM it opens, and its answer is the
 * hello's `tok`. The relay spends a token once IN A ROOM (bible ACC1d
 * D4): a token held over and sent twice into one room is the exact frame
 * the relay refuses, and a player who reconnected would be refused their
 * own name - so a room this token has opened never gets it again.
 * STORM-SHED: OPENED BY A HELLO, NEVER BY THE MINT - the session says so
 * (`minter.opened(room, token)`) as its hello carries the token. A mint
 * slower than the session's TOKEN_WAIT_MS sent its room's hello without
 * one, yet the token was marked as that room's: the room's retry minted
 * again, slower again under the load, and each client minted hundreds an
 * hour while the database queued.
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
 * NAME-AS: AND THE TWO NAMES ARE TWO NOW. The answer's `name` is the
 * token's - the name the ROOM reads, my character's where I chose it -
 * and `accountName` the account's own: the store keeps the account's (the
 * profile mark is the account's picture), the host is handed the room's.
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
 * STORM-SHED: a mint that failed holds the next one off (MINT_COOL_MS, doubling to MINT_COOL_MAX_MS, jittered) - every
 * room asking meanwhile answered null at once with the failure's word, and `minter.coolMs()` how long it still holds, so
 * a session's next hello waits for it (net/online.js). A token lets it go; another sign-in is never held by this one's.
 * AUDIT SCALE II L4a: a place in the sign-in line (`queue`) holds it the line's own wait instead (lineHoldMs), and is
 * no failure in a row.
 *
 * @param {object} io
 * @param {(url: string, init: object) => Promise<any>} io.fetch
 * @param {any} io.storage  appStorage() in the app, a Map in a test
 * @param {((who: {name: string, kind: string, title: string|null, glyphs: string[], level: number|null, xp: number|null, guild?: string|null, accountName?: string, nameAs?: string, nameWhy?: string, nameWord?: string, conduct?: boolean}) => void)|null} [io.onIssued]
 * @param {(() => string|null)|null} [io.character]
 * @param {(() => number)} [io.now]
 * @param {(() => number)} [io.rand]  Math.random's shape - the cooldown's jitter
 * SCALE5a: a hello the relay refused BEFORE it read the token (a busy room's hello gate - the close's reason says so, wire.js
 * BUSY_TOKEN_UNREAD) did not spend it there: the session says so (`minter.unopened(room, token)`), and that room may be
 * handed the token again within TOKEN_REUSE_MS - the retry mints nothing. A relay deploy's reconnect wave was a mint a
 * player and another a busy refusal; it is a mint a player.
 *
 * DOOR-TOKEN (FIELD BUGS 2026-10-16b, the Discord: "Partied players popping in and out randomly after leaving tombs at
 * graveyard ... also partied players inside tombs are invisible for a time"): A TOKEN MINTED AHEAD OF THE DOOR. A place
 * change opens a new room, and its socket asked for its token only as it opened - a mint on the wire (seconds, for a
 * player: TOKEN-WAIT) between the door and the hello, the player invisible to the party on both sides of it. The host
 * says a place change is coming and when the next room's socket will ask (`minter.ahead(room, withinMs)` -
 * scenes/doorTokenHost.js, each door its own margin), and a mint goes then only when the token held could not open that
 * room by then: none held, spent there, or its reuse minute out within `withinMs`. AUDIT (2026-10-16, A2): the margin was
 * one 20 s (TOKEN_AHEAD_MS) at every door, though the next socket asks within a frame or a build: a door with the held
 * token 40-60 s old minted though that token would still have opened the room - twice the mints at a 40-55 s door gap.
 * `minter.holds(room)` says whether a room would be handed one now, nothing on the wire.
 *
 * @returns {((room?: string|null) => Promise<string|null>) & { lastWhy: string|null, coolMs: () => number, opened: (room: string|null, token: string) => void, unopened: (room: string|null, token: string) => void, ahead: (room?: string|null, withinMs?: number) => boolean, holds: (room: string|null) => boolean, forget: () => void }}
 */
export function accountTokenMinter({ fetch, storage, onIssued = null, character = null, now = () => Date.now(), rand = Math.random }) {
  /** @type {{ token: string, secret: string, character: string|null, at: number, rooms: Set<string> } | null} */
  let held = null;
  /** @type {Promise<string|null> | null} */
  let minting = null;
  /** STORM-SHED: the mints held off after a failure - one sign-in's (its secret), until `until` on now()'s clock, the
   *  failures in a row counted and the last one's word kept to answer with. */
  let cool = { secret: /** @type {string|null} */ (null), fails: 0, until: -Infinity, why: /** @type {string|null} */ (null) };
  const reuse = (/** @type {string|null} */ room, /** @type {string} */ secret, /** @type {string|null} */ named) => {
    if (!held || room == null || held.rooms.has(room) || held.secret !== secret || held.character !== named) return null;
    if (!(now() - held.at < TOKEN_REUSE_MS)) return null;
    return held.token;
  };
  /** The character the next mint names (RENOWN1) - read at each ask; a seam that throws costs the level, never the hello. */
  const namedNow = () => {
    let named = null;
    try { named = character?.() ?? null; } catch { named = null; }
    return typeof named === 'string' && named ? named : null;
  };
  /** One mint on the wire for this sign-in, shared by every room asking while it flies (`minting`), its answer held or
   *  its failure's hold set (STORM-SHED) - the one door the minter and DOOR-TOKEN's `ahead` both mint through. */
  const start = (/** @type {any} */ session, /** @type {string|null} */ named) => {
    const p = mintFresh(session, named).then((token) => {
      if (token) {
        held = { token, secret: session.secret, character: named, at: now(), rooms: new Set() };   // STORM-SHED: opened by a hello (`opened`), never by the mint
        cool = { secret: null, fails: 0, until: -Infinity, why: null };
      } else if (minter.lastWhy === 'queue') {
        // AUDIT SCALE II L4a: the line's own wait, its failures in a row left where they stood
        cool = { secret: session.secret, fails: cool.secret === session.secret ? cool.fails : 0, until: now() + lineHoldMs(lineWait, rand), why: 'queue' };
      } else {
        // AUDIT SAFE CLIENT-2: a ban - the service will mint this account nothing, and the token it minted a moment before
        // is handed to no other room either (TOKEN_REUSE_MS opened every channel a rejoin asked for on it)
        if (minter.lastWhy === 'banned') held = null;
        const fails = cool.secret === session.secret ? cool.fails + 1 : 1;
        cool = { secret: session.secret, fails, until: now() + jittered(Math.min(MINT_COOL_MAX_MS, MINT_COOL_MS * 2 ** (fails - 1)), rand), why: minter.lastWhy };
      }
      return token;
    });
    minting = p;
    const done = () => { if (minting === p) minting = null; };
    p.then(done, done);
    return p;
  };
  const minter = Object.assign(async (/** @type {string|null} */ room = null) => {
    const session = storedSession(storage);
    if (!session) { minter.lastWhy = 'no-session'; console.warn('[account] no identity token: no sign-in stored on this device'); return null; }   // TOKEN-WAIT
    const named = namedNow();
    const again = reuse(room, session.secret, named);
    if (again) { minter.lastWhy = null; return again; }
    // a mint already on the wire (the sockets of one connect open together): its token, if this room has not had it
    if (minting) {
      await minting.catch(() => null);
      const shared = reuse(room, session.secret, named);
      if (shared) { minter.lastWhy = null; return shared; }
    }
    // STORM-SHED: a failure's hold, while it runs, answers every room at once with its word - nothing on the wire
    if (cool.secret === session.secret && now() < cool.until) { minter.lastWhy = cool.why; return null; }
    return start(session, named);
  }, {
    lastWhy: /** @type {string|null} */ (null),
    /** STORM-SHED: a hello carried `token` into `room` (net/online.js) - the relay spends it there, so that room is minted
     *  afresh from now on. Until a hello carries it, the room may be handed it again: a token that came after the
     *  session's wait opened nothing, and marking it spent at the mint made that room's every retry mint again. */
    opened: (/** @type {string|null} */ room, /** @type {string} */ token) => {
      if (held && room != null && held.token === token) held.rooms.add(room);
    },
    /** SCALE5a: the relay refused the hello that carried `token` into `room` before reading it (wire.js
     *  BUSY_TOKEN_UNREAD) - unspent there, so the room may be handed it again. Only the token this minter holds: an
     *  older one is past its reuse already. */
    unopened: (/** @type {string|null} */ room, /** @type {string} */ token) => {
      if (held && room != null && held.token === token) held.rooms.delete(room);
    },
    /** STORM-SHED: how long this sign-in's next mint is still held off, ms (0 for none). */
    coolMs: () => {
      const session = storedSession(storage);
      return session && cool.secret === session.secret ? Math.max(0, cool.until - now()) : 0;
    },
    /** DOOR-TOKEN: a place change is coming, into `room` when the host knows it (null: a room no token has opened yet),
     *  its socket asking within `withinMs` - a mint goes NOW when the token held could not open it by then, so the socket
     *  finds one held. Never a second mint while one flies, never through a failure's hold (STORM-SHED), never without a
     *  sign-in. True when a mint went. */
    ahead: (/** @type {string|null} */ room = null, withinMs = 0) => {
      const session = storedSession(storage);
      if (!session || minting) return false;
      if (cool.secret === session.secret && now() < cool.until) return false;
      const named = namedNow();
      const by = now() + Math.max(0, Number(withinMs) || 0);   // AUDIT A2: when its socket asks - the door's own margin
      const opens = !!held && held.secret === session.secret && held.character === named && by - held.at < TOKEN_REUSE_MS && !(room != null && held.rooms.has(room));
      if (opens) return false;
      start(session, named);
      return true;
    },
    /** AUDIT SAFE CLIENT-2 (2026-10-17): THE HELD TOKEN LET GO - the relay said this account is banned
     *  (scenes/chatSafetyHost.js), and a token minted a moment before the ban opened every room a rejoin asked within
     *  TOKEN_REUSE_MS. The next room mints, and the service refuses it. */
    forget: () => { held = null; },
    /** DOOR-TOKEN: does this minter hold a token `room` would be handed now, nothing on the wire (the reuse law) - a
     *  session whose hello went without one asks again the moment it does (net/online.js). */
    holds: (/** @type {string|null} */ room) => {
      const session = storedSession(storage);
      return !!session && reuse(room, session.secret, namedNow()) != null;
    },
  });

  /** AUDIT SCALE II L4a: the wait the sign-in line told the last mint it held back. */
  let lineWait = /** @type {unknown} */ (null);
  /** One mint on the wire - the identity adopted, or null with `lastWhy` said. */
  async function mintFresh(/** @type {any} */ session, /** @type {string|null} */ named) {
    const answer = await mintIdentity({ fetch, base: serviceBase(storage), secret: session.secret }, named);
    lineWait = answer.ok ? null : /** @type {any} */ (answer).wait;
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
          // WITCH1: the profile icon I wear (null for the face) - absent from a service before acct165, which says nothing
          ...('icon' in answer.data ? { icon: typeof answer.data.icon === 'string' ? answer.data.icon : null } : {}),
          // SEASON1 part two: a Season's banner ribbon under my own name (null for none) - absent from a service before acct58
          ...('ribbon' in answer.data ? { ribbon: Array.isArray(answer.data.ribbon) ? answer.data.ribbon : null } : {}),
          // LEGACY7: the house my realm character wears (null for none) - absent from a service before acct87
          ...('house' in answer.data ? { house: answer.data.house && typeof answer.data.house === 'object' ? answer.data.house : null } : {}),
          // NAME-AS: `name` above is the ROOM's - my character's where I chose it - and these say the account's own, the
          // choice, and why a chosen character's name stood aside (`nameWhy`, `nameWord`); each absent from a service
          // before acct122, whose `name` was the account's
          ...(typeof answer.data.accountName === 'string' && answer.data.accountName ? { accountName: answer.data.accountName } : {}),
          ...(answer.data.nameAs === 'account' || answer.data.nameAs === 'character' ? { nameAs: answer.data.nameAs } : {}),
          ...(typeof answer.data.nameWhy === 'string' && answer.data.nameWhy ? { nameWhy: answer.data.nameWhy, ...(typeof answer.data.nameWord === 'string' ? { nameWord: answer.data.nameWord } : {}) } : {}),
          // AUDIT SAFE CLIENT-1 (2026-10-17): SAFE7's word - whether this account has agreed to the code of conduct as it
          // stands. Built field by field, `who` dropped it, so the code's card never stood for anyone: every first line
          // went unread-code. Absent from a service before acct150, which says nothing (heard as yes - chatSafetyHost adopt)
          ...('conduct' in answer.data ? { conduct: answer.data.conduct === true } : {}) };
        // AUDIT B4: into the session that asked. NAME-AS: the stored session is the ACCOUNT's picture (the profile mark's
        // name), so it keeps the account's name - the room's, which may be my character's, goes to the live sessions
        adoptIdentity(storage, { ...who, name: who.accountName ?? who.name, secret: session.secret });
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
 * ACC4: THE BEAT, bound to this device's stored session - /v1/account/played's own door. SCALE4c: the world host knocks
 * through the tab's heartbeat now (net/heartbeat.js, /v1/heartbeat's `beat` part, credited by the same creditPlay); this
 * stands for the route, which stands for the doors that ask it alone (AUDIT SCALE B8: this said the world host hands it
 * to `startPlayClock`).
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

/** INT8: a duel's result, the relay's signed receipt (net/duel/duelReceipt.js
 *  `d1`) carried by either of its fighters - `{ recorded, wins, losses }`
 *  (or `{ recorded: false, why }`). DUEL1's loser's own report retired. */
export const claimDuelReceipt = (io, receipt) => call(io, '/v1/duel/claim', { receipt });
/** DUEL1: any account's duelling record, `{ id, wins, losses }`. */
export const readDuelRecord = (io, id) => call(io, '/v1/duel/record', { id });

/**
 * DUEL1: THE DUELLING RECORD'S TWO CALLS, bound to this device's stored
 * session (read at each call, as the beat reads it). With no session
 * there is no account to claim with or to ask as: `{ ok: false, error:
 * 'no-session' }`, never a knock. INT8: a bout's receipt claimed, never
 * a loss reported.
 */
export function accountDuels({ fetch, storage }) {
  const io = () => { const s = storedSession(storage); return s ? { fetch, base: serviceBase(storage), secret: s.secret } : null; };
  return {
    claim: async (receipt) => { const i = io(); return i ? claimDuelReceipt(i, receipt) : { ok: false, error: 'no-session' }; },
    record: async (id) => { const i = io(); return i ? readDuelRecord(i, id) : { ok: false, error: 'no-session' }; },
  };
}

/** STAFF-PANEL5-FREEZE (net/staffChat.js; server-account/src/staffFreeze.js playerStaffChat): MY STAFF CHAT THREAD'S TWO
 *  CALLS, bound to this device's stored session as the duels' are - `read(after)` answers `{ open, frozen: { until, reason }
 *  | null, lines: [{ id, at, staff, text }], invite }` (lines past `after`), `send(text)` `{ ok, line: { id, at, staff, text } }`. */
export function accountStaffChat({ fetch, storage }) {
  const io = () => { const s = storedSession(storage); return s ? { fetch, base: serviceBase(storage), secret: s.secret } : null; };
  return {
    read: async (/** @type {number} */ after = 0) => { const i = io(); return i ? call(i, '/v1/staff-chat/read', { after }) : { ok: false, error: 'no-session' }; },
    send: async (/** @type {string} */ text) => { const i = io(); return i ? call(i, '/v1/staff-chat/send', { text }) : { ok: false, error: 'no-session' }; },
  };
}

/** INT9: A DEATH IN THE OPEN ZONE'S DROP, taken off the realm record by the service (server-account/src/wild.js) - `body`
 *  `{ receipt, realm, room }` (the fallen's, its record's `at`), `{ receipt, room }` (the killer's, after the grace) or
 *  `{ n, realm, room }` (a death to a foe: the tab's nonce) - `room` where the remains will lie (AUDIT INT9: the order names
 *  it). Answers `{ r, order, items, kept, took, gold, wi, burnt?, realm? }`. */
export const wildFallAsk = (io, body) => call(io, '/v1/wild/fall', body);
/** MAC (2026-10-14, the two-phase handoff - server-account/src/wild.js): the killer's collect of its piece in escrow
 *  (`{ receipt, realm }` - the room's `g1`, the killer's record's `at`), the fallen's taking it back (`{ r, realm }`), and
 *  the fallen character's pieces still held (`{ character }`). */
export const wildCollectAsk = (io, body) => call(io, '/v1/wild/collect', body);
export const wildReclaimAsk = (io, body) => call(io, '/v1/wild/reclaim', body);
export const wildEscrowsAsk = (io, body) => call(io, '/v1/wild/escrows', body);
/** INT9: the zone's calls, bound to this device's stored session (the duels' way). */
export function accountWild({ fetch, storage }) {
  const io = () => { const s = storedSession(storage); return s ? { fetch, base: serviceBase(storage), secret: s.secret } : null; };
  const on = (/** @type {(io: any, body: any) => Promise<any>} */ ask) => async (/** @type {any} */ body) => { const i = io(); return i ? ask(i, body) : { ok: false, error: 'no-session' }; };
  return { fall: on(wildFallAsk), collect: on(wildCollectAsk), reclaim: on(wildReclaimAsk), escrows: on(wildEscrowsAsk) };
}

/** WB5b: the kill receipt the relay signed for this account, carried to
 *  the service - `{ recorded, closed }`, or `{ recorded: false, why }`
 *  (`claimed`, `guest`). */
export const claimGateReceipt = (io, receipt, extra = null) => call(io, '/v1/gate/claim', { receipt, ...(extra ?? {}) });   // SEAT1b: `extra` the kill's `region` and the claiming `character`

/**
 * WB5b: THE GATES' ONE CALL, bound to this device's stored session (read
 * at each call, as the duels' are). With no session there is no account
 * to claim for: `{ ok: false, error: 'no-session' }`, never a knock - and
 * net/gate/gateClaims.js keeps the receipt for when there is one.
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
 * no account to claim for: `{ ok: false, error: 'no-session' }`, never a knock - and net/raid/raidClaims.js keeps the
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

/** SERPENT1: a sea serpent's receipt the relay signed for this account, carried to the service with the character that
 *  fought it and this device's claim id (the hoard's key) - `{ recorded, slain, renown, spoils, order }` (SERPENT5: and
 *  `title`, `aura`, `titleNew`, `auraNew` - the Old Coil's grants on its first write, acct135), or
 *  `{ recorded: false, why }` (`claimed`, `guest`). */
// AUDIT 625 P4: and the embers this build's hoard mints (systems/serpent/serpentSpoils.js serpentEmbers) - the row counts what the
// claim says, so a build from before them, saying none, is counted none
export const claimSerpentReceipt = (io, receipt, character, name = null, cid = null) => call(io, '/v1/serpent/claim', { receipt, character, name, ...(cid ? { cid } : {}), stones: SERPENT_EMBERS });

/**
 * SERPENT1: THE SERPENTS' ONE CALL, bound to this device's stored session (the raids' own shape). With no session there
 * is no account to claim for: `{ ok: false, error: 'no-session' }`, never a knock - and net/serpent/serpentClaims.js keeps the
 * receipt for when there is one.
 */
export function accountSerpents({ fetch, storage }) {
  const io = () => { const s = storedSession(storage); return s ? { fetch, base: serviceBase(storage), secret: s.secret } : null; };
  return {
    claim: async (receipt, character, name = null, cid = null) => { const i = io(); return i ? claimSerpentReceipt(i, receipt, character, name, cid) : { ok: false, error: 'no-session' }; },
    me: () => storedSession(storage)?.id ?? null,
  };
}

/** STAR7: a fallen star's receipt the relay signed for this account, carried to the service with the character that held
 *  it and this device's claim id (the spoils' key) - `{ recorded, held, renown, spoils, marks, order }`, or
 *  `{ recorded: false, why, held, spoils }` (`claimed`, `guest`, `day-full`). */
export const claimStarReceipt = (io, receipt, character, name = null, cid = null) => call(io, '/v1/star/claim', { receipt, character, name, ...(cid ? { cid } : {}) });

/**
 * STAR7: THE STARS' ONE CALL, bound to this device's stored session (the serpents' own shape). With no session there is no
 * account to claim for: `{ ok: false, error: 'no-session' }`, never a knock - and net/starfall/starClaims.js keeps the
 * receipt for when there is one.
 */
export function accountStars({ fetch, storage }) {
  const io = () => { const s = storedSession(storage); return s ? { fetch, base: serviceBase(storage), secret: s.secret } : null; };
  return {
    claim: async (receipt, character, name = null, cid = null) => { const i = io(); return i ? claimStarReceipt(i, receipt, character, name, cid) : { ok: false, error: 'no-session' }; },
    me: () => storedSession(storage)?.id ?? null,
  };
}

/** SD9b: a Brass Remnant's receipt the relay signed for this account, carried to the service - `{ recorded, slot, title,
 *  aura, broken }`, or `{ recorded: false, why }` (`claimed`, `guest`). */
export const claimSdReceipt = (io, receipt) => call(io, '/v1/sd/claim', { receipt });

/**
 * SD9b: THE HOURS' ONE CALL, bound to this device's stored session (the gates' own shape). With no session there is no
 * account to claim for: `{ ok: false, error: 'no-session' }`, never a knock - and net/superDungeon/sdClaims.js keeps the receipt for
 * when there is one.
 */
export function accountSds({ fetch, storage }) {
  const io = () => { const s = storedSession(storage); return s ? { fetch, base: serviceBase(storage), secret: s.secret } : null; };
  return {
    claim: async (receipt) => { const i = io(); return i ? claimSdReceipt(i, receipt) : { ok: false, error: 'no-session' }; },
    /** The signed-in account's id - the receipts this device may offer are its alone (AUDIT WB A9's law). */
    me: () => storedSession(storage)?.id ?? null,
  };
}

/** LAMP-KEEPER II (2026-10-14): THE LAMP'S TITLE (server-account/src/lamp.js) through the one door - `claim()` a lamp
 *  keeper spoken to, `{ ok, data: { granted, why? } }`; no session is `no-session`, never a throw. */
export function accountLamp({ fetch, storage, waitMs = ACCOUNT_ACT_WAIT_MS }) {
  const post = waitedPost({ fetch, storage }, waitMs);
  return {
    // AUDIT FIVE-ASKS D3: a secret the service stopped honouring is not a session (forgetSession's law)
    claim: async () => { const r = await post('/v1/lamp/claim', {}); if (r?.error === 'auth') forgetSession(storage); return r; },
    account: () => storedSession(storage)?.id ?? null,   // AUDIT FIVE-ASKS D2: whose the lamp's answer is
  };
}

/** QL12 (2026-10-19; bible/06-Systems/Questlines-Arc.md section 5.3): THE QUESTLINES' CLAIM (server-account/src/
 *  questlines.js) through the one door - `claim({ line, step, phase, choice? })` a questline's step opened or ended,
 *  `{ ok, data: { opened?, witnessed?, title?, key?, keys?, keyHeld?, why? } }`; no session is `no-session`, never a
 *  throw. `guest()` whether the signed-in account is a guest's. */
export function accountQuestlines({ fetch, storage, waitMs = ACCOUNT_ACT_WAIT_MS }) {
  const post = waitedPost({ fetch, storage }, waitMs);
  return {
    claim: async (body) => { const a = await post('/v1/ql/claim', body); if (a?.error === 'auth') forgetSession(storage); return a; },
    account: () => storedSession(storage)?.id ?? null,   // whose the line's pay is: none signed in, none asked
    guest: () => (storedSession(storage)?.kind ?? null) === 'guest',   // AUDIT QUESTLINES LINES-2: a guest's witnessed deed is never recorded
  };
}

/**
 * EG-PLAY: THE ELITE BREACH (server-account/src/eg.js) through the one door - the Weir Keys the account holds and its live
 * breach (`keys`), the open that stakes one (`open` - idempotent on its request id `rq`; `rh` the day's Rehearsal, no
 * key), a member's admission (`admit`) and a receipt the relay signed (`claim` - EG-E1: with the claiming character, its
 * guild's deed). EG-E1: the Broker's Panoply piece (`sink` - one of EG_PANOPLY_IDS, once an account an arena week; the
 * week's sale rides `keys`' `sink`); EG-E2: the three boards (`board` - the Descent's brackets, the Depths, the Deepest
 * Redoubts: ui/eliteGates/egBoardWindow.js reads it). Every answer is `call`'s shape, waited for ACCOUNT_ACT_WAIT_MS at most; no session
 * is `no-session`, never a throw. `me()` the signed-in account's id - the receipts this device may offer are its alone
 * (AUDIT WB A9's law); `guest()` whether it is a guest's.
 */
export function accountEg({ fetch, storage, waitMs = ACCOUNT_ACT_WAIT_MS }) {
  const post = waitedPost({ fetch, storage }, waitMs);
  return {
    keys: () => post('/v1/eg/keys', {}),
    // EG-F: the open carries the start window's choice - its start Redoubt `ew` and its Wager `wg` (none: Hall 1, no Wager)
    // AUDIT EG IV (lane3 #1): `again` - an open whose answer was lost, asked by its own request id for the stake it took alone
    open: (rq, rh = false, { ew = 0, wg = [], again = false } = {}) => post('/v1/eg/open', { rq, ...(rh ? { rh: 1 } : {}), ...(ew > 0 ? { ew } : {}), ...(wg?.length ? { wg: [...wg] } : {}), ...(again ? { again: 1 } : {}) }),
    /** EG-F: the start window's preflight - which starts each member of my party (`subs`) may make. */
    starts: (subs) => post('/v1/eg/starts', { subs: [...subs] }),
    admit: (b) => post('/v1/eg/admit', { b }),
    board: () => post('/v1/eg/board', {}),   // EG-E2: the three boards (server-account/src/egHonours.js egBoardOf)
    claim: (receipt, character = null) => post('/v1/eg/claim', { receipt, ...(typeof character === 'string' && character ? { character } : {}) }),   // EG-E1: the claiming character - its guild's deed
    sink: (piece) => post('/v1/eg/sink', { piece }),   // EG-E1: the Broker's Panoply piece, once a week
    find: (tier) => post('/v1/eg/find', { tier }),   // EG-E3: a dungeon elite's find (section 5) - `{ found, keys, asks }`
    first: (bits) => post('/v1/eg/first', { bits }),   // EG-ZF: the first-time lines shown, kept once an account (section 27.7) - `{ first }`
    me: () => storedSession(storage)?.id ?? null,
    guest: () => (storedSession(storage)?.kind ?? null) === 'guest',
  };
}

/**
 * WITCH1 (bible/06-Systems/Witches-Festival.md): THE WITCHES' FESTIVAL (server-account/src/festival.js) through the one
 * door - the account's cakes and what they bought, a find, a sale by its request id, a town's Hearth Offerings and the
 * four moves on one. Every answer is `call`'s shape, waited for ACCOUNT_ACT_WAIT_MS at most; no session is `no-session`,
 * never a throw.
 */
export function accountFestival({ fetch, storage, waitMs = ACCOUNT_ACT_WAIT_MS }) {
  const post = waitedPost({ fetch, storage }, waitMs);
  return {
    mine: () => post('/v1/festival/mine', {}),
    find: (source) => post('/v1/festival/find', { source }),
    buy: (ware, rid) => post('/v1/festival/buy', { ware, rid }),
    town: (mapId) => post('/v1/festival/town', { mapId }),
    set: ({ mapId, buildingKey, character }) => post('/v1/festival/offering/set', { mapId, buildingKey, character }),
    fill: ({ mapId, buildingKey, character }) => post('/v1/festival/offering/fill', { mapId, buildingKey, character }),
    takeIn: ({ mapId, buildingKey, character }) => post('/v1/festival/offering/take-in', { mapId, buildingKey, character }),
    take: ({ mapId, buildingKey }) => post('/v1/festival/offering/take', { mapId, buildingKey }),
    me: () => storedSession(storage)?.id ?? null,
    guest: () => (storedSession(storage)?.kind ?? null) === 'guest',
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
    // AUDIT ARENA-LADDER: an attempt at the account's next ladder bout - its ticket, which the relay opens the bout for
    attempt: (tier, bout, room) => post('/v1/arena/attempt', { tier, bout, room }),   // AUDIT ARENA-LADDER 2: for the room it is fought in
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
  // AUDIT 625 S4: `as` - an act asked for ONE account (a find owed to it) goes under that account's session or not at
  // all: the session is read once, and its account checked and its secret sent off that one reading, so another tab's
  // sign-in can never send it under the account signed in since (`no-session`, and the act waits for its own)
  return async (path, body, as = null) => {
    const s = storedSession(storage);
    return s && (as == null || s.id === as) ? call({ fetch, base: serviceBase(storage), secret: s.secret }, path, body) : { ok: false, error: 'no-session' };
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
    // HOME-VOTE: this account's word on another's home - up (1), down (-1), or taken back (0)
    vote: ({ mapId, buildingKey, vote, owner }) => post('/v1/homes/vote', { mapId, buildingKey, vote, owner }),   // AUDIT HOME-VOTE II A4: the owner the door read
    // ARENA4b: a home the arena displaced, moved to the house this client picked (its record named when the pieces' refund
    // comes onto it); the moves this character has not read; and one read
    arenaMove: ({ mapId, from, to, character, realm = null }) => post('/v1/homes/arena-move', { mapId, from, to, character, ...(realm ? { realm } : {}) }),
    arenaMoves: (character) => post('/v1/homes/arena-moves', { character }),
    arenaSeen: (mapId, from) => post('/v1/homes/arena-seen', { mapId, from }),
    // FIELD BUGS 2026-10-04d KNIGHT-HOUSE: the building a deed the realm gave names (a Knightly Order's house), held off the
    // character's record from anyone else's claim; and that hold given up as the deed sells at the bank
    deed: ({ mapId, buildingKey, region, character, layout = null }) => post('/v1/homes/deed', { mapId, buildingKey, region, character, layout: layout || null }),
    releaseDeed: (mapId, buildingKey) => post('/v1/homes/release', { mapId, buildingKey, deed: true }),
    // PERMADEATH-HOUSES: a fallen member's home (`from`, their tombstoned realm character) taken up by the living realm
    // character of their line who carries it on (`character`) - server-account/src/homes.js inheritHome
    inherit: ({ mapId, buildingKey, character, from }) => post('/v1/homes/inherit', { mapId, buildingKey, character, from }),
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
    // AUDIT PRE-MERGE 1003 WD1: a hall is a home - the layout its town stands in, always said (null: Daggerfall's), as a claim
    hallBuy: ({ character, mapId, buildingKey, region, price, layout = null }) => post('/v1/guilds/hall/buy', { character, mapId, buildingKey, region, price, layout: layout || null }),
    hallSell: (character) => post('/v1/guilds/hall/sell', { character }),
    hallEntry: (character, entry) => post('/v1/guilds/hall/entry', { character, entry }),
    heraldry: (character, heraldry, rid = null) => post('/v1/guilds/heraldry', { character, heraldry, ...(rid ? { rid } : {}) }),
    // GUILD2 (bible/11-Multiplayer/Guild-Overhaul.md): a new name for a price; the vault - read, a piece put in and taken
    // out on the realm record where it stands (`realm`), the guildmaster's grants
    rename: (character, name, tag) => post('/v1/guilds/rename', { character, ...(name ? { name } : {}), ...(tag ? { tag } : {}) }),
    vault: (character) => post('/v1/guilds/vault', { character }),
    vaultPut: ({ character, realm, pick, item, count }) => post('/v1/guilds/vault/put', { character, realm, pick, item, count }),
    vaultTake: ({ character, realm, slot, count = null, at = null }) => post('/v1/guilds/vault/take', { character, realm, slot, ...(count == null ? {} : { count }), ...(at == null ? {} : { at }) }),
    vaultGrant: (character, member, level, limit = null) => post('/v1/guilds/vault/grant', { character, member, level, limit }),   // AUDIT2 GUILD2 S6: none named - the law's ten
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
 * never the other way), a guild's Marks treasury, the developers' report and (SILVER-FINDS) a loot find. Every act
 * carries its own request id, so an answer lost and asked again is answered again, never charged twice. Every answer is
 * `call`'s shape; each is waited for ACCOUNT_ACT_WAIT_MS at most. `account()` is the account this device is signed in as (AUDIT 28 M2: a kept sale is
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
    find: (kind, rid, account = null) => post('/v1/marks/find', { kind, rid }, account),   // SILVER-FINDS: a loot find the device rolled - AUDIT 625 S4: under the account it was found by
  };
}

/**
 * CHAP1: THE ROLL (server-account/src/npcRoll.js) through the one door - a realm character's standing with Daggerfall's
 * guilds read (and seeded, the first time), and what moved claimed, each under the playing tab's lease. Every answer is
 * `call`'s shape; each is waited for ACCOUNT_ACT_WAIT_MS at most.
 */
export function accountRoll({ fetch, storage, waitMs = ACCOUNT_ACT_WAIT_MS }) {
  const post = waitedPost({ fetch, storage }, waitMs);
  // AUDIT CHAP C1/T1: no claim as the page goes - the realm session gives its lease up first and the service clears it,
  // so one never landed; what was not claimed rides the save to the next page (net/npcRollTracker.js)
  return {
    read: (character, lease, seed = null) => post('/v1/chapters/roll', { character, lease, ...(seed ? { seed } : {}) }),
    claim: (character, lease, rid, deltas, members) => post('/v1/chapters/claim', { character, lease, rid, deltas, members }),
    /** CHAP2a: the town this client stands in, its guild halls read off its own buildings (npcHallBook.js) */
    witness: (hall) => post('/v1/chapters/witness', { hall }),
    /** AUDIT CHAP2 E1: a developer's - a region's towns and the audit list, and a false town struck */
    halls: (region) => post('/v1/chapters/halls', { region }),
    strike: (key) => post('/v1/chapters/strike', { key }),
    /** CHAP3b: the chapter sheet - every chapter's Strength and band (the halls' prices read it, CHAP3c) */
    list: () => post('/v1/chapters/list', {}),
    /** CHAP4d: a chapter's Master names its Focus this week; and a region's Chronicle of its chapters' seats */
    focus: (character, faction, region, focus) => post('/v1/chapters/focus', { character, faction, region, focus }),
    history: (region) => post('/v1/chapters/history', { region }),
    /** CHAP6b: a member backs a side of its chapter's Schism, or names a candidate of its Succession (CHAP6c's board) */
    back: (character, faction, region, side) => post('/v1/chapters/back', { character, faction, region, side }),
    /** CHAP7a: a guild's guildmaster bids its treasury's silver for a chapter's patronage in the Season after (CHAP7b's board) */
    patron: (character, faction, region, marks, rid) => post('/v1/chapters/patron', { character, faction, region, marks, rid }),
  };
}

/**
 * TOWN-ECON TE2 (bible/06-Systems/Town-Economy-Arc.md section 4): THE TOWNS' ECONOMY (server-account/src/townEcon.js)
 * through the one door - every town's players' share read, the town this client stands in witnessed, the Watch's ticks
 * walked in a town claimed (net/townEconBook.js). Every answer is `call`'s shape; each is waited for ACCOUNT_ACT_WAIT_MS
 * at most.
 */
export function accountTowns({ fetch, storage, waitMs = ACCOUNT_ACT_WAIT_MS }) {
  const post = waitedPost({ fetch, storage }, waitMs);
  return {
    econ: () => post('/v1/towns/econ', {}),
    witness: (town, receipt) => post('/v1/towns/witness', { town, receipt }),   // AUDIT TOWN-ECON 2 SVC-1: a walk's tick
    strike: (map) => post('/v1/towns/strike', { map }),   // SVC-1: a developer's
    audit: (region) => post('/v1/towns/audit', { region }),
    /** SEA-TRADE: `sea` the indices of the receipts that vouch a dealing at a port's exchange (none sent, none) */
    watch: (receipts, sea = []) => post('/v1/towns/watch', sea.length ? { receipts, sea } : { receipts }),
    /** the signed-in account - whose ticks are kept */
    me: () => storedSession(storage)?.id ?? null,
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
    // BAG1: `carry` - the units counted as carried, into the bag or the pack - with what the client holds of it (`held`)
    // AUDIT BAG1 B2: and `seen`, the count as the client last heard it - the service cuts to `held` only against its own
    withdraw: (character, material, qty, rid, carry = null) => post('/v1/stores/withdraw', { character, material, qty, rid, ...(carry ? { carry: true, held: carry.held, ...(carry.seen == null ? {} : { seen: carry.seen }) } : {}) }),
    deposit: (character, material, qty, held, order, rid, seen = null) => post('/v1/stores/deposit', { character, material, qty, held, order, rid, ...(seen == null ? {} : { seen }) }),   // BAG1: carried units into the Stores
    smelt: (character, recipe, count, rid, clean = false) => post('/v1/prof/smelt', { character, recipe, count, rid, ...(clean === true ? { clean: true } : {}) }),   // PROF2: the forge; PROF11: the mason's bench, `clean` the chisel's report
    craft: (character, recipe, clean, name, rid, heartwood = false, dye = null, seat = null, cracked = false) => post('/v1/prof/craft', { character, recipe, clean, name, rid, heartwood, ...(dye == null ? {} : { dye }), ...(seat == null ? {} : { seat }), ...(cracked === true ? { cracked: true } : {}) }),   // SEAT2b part two: `seat` the held town the station stands in   // PROF3: the anvil - `clean` the act's report, `name` the maker's mark; PROF4: the workbench, `heartwood` for a plank; PROF7: the loom, a garment's `dye`; PROF10: the jeweller's bench, `cracked` a Lapidary's Siege-cracked Gem for the gem
    stock: (character, material, qty, rid) => post('/v1/prof/stock', { character, material, qty, rid }),   // PROF3: the smith's stock
    brew: (character, potion, keys, rid, seat = null) => post('/v1/prof/brew', { character, potion, keys, rid, ...(seat == null ? {} : { seat }) }),   // PROF12: the alchemy station's brew - `keys` the cauldron as the Stores hold it, `seat` the held town it stands in
    temper: (character, recipe, quality, provenance, rid) => post('/v1/prof/temper', { character, recipe, quality, rid, ...(provenance ? { provenance } : {}) }),   // CRAFT4: a piece a quality step better
    reforge: (character, tier, rid) => post('/v1/prof/reforge', { character, tier, rid }),   // CRAFT4: an Enchanter's Reforge for Arcane Essence - the seed its line is rolled with
    disenchant: (character, provenance, rid, realm = null) => post('/v1/prof/disenchant', { character, provenance, rid, ...(realm ? { realm } : {}) }),   // PROF12: a crafted piece into Arcane Essence; AUDIT PROF-541 B2: a realm character's record where it stands
    writs: (character, region) => post('/v1/writs/list', { character, region }),
    deliver: (character, id, rid) => post('/v1/writs/deliver', { character, id, rid }),
    craftWrit: (character, id, rid, realm, pieces = null) => post('/v1/writs/craft', { character, id, rid, realm, ...(pieces ? { pieces } : {}) }),   // CRAFT-WRITS: a crafting writ filled - its goods out of the realm record where it stands
    motherlodes: (character) => post('/v1/prof/motherlodes', { character }),   // PROF2b: today's three (a strike rides `harvest`)
  };
}

/** FIRM1: THE FIRMAMENT'S DOOR (server-account/src/firmament.js) - a character's tree and purses read, and the whole tree
 *  it wants asked under its own id. Every answer is `call`'s shape; each is waited for ACCOUNT_ACT_WAIT_MS at most. */
export function accountFirmament({ fetch, storage, waitMs = ACCOUNT_ACT_WAIT_MS }) {
  const post = waitedPost({ fetch, storage }, waitMs);
  return {
    account: () => storedSession(storage)?.id ?? null,
    state: (character) => post('/v1/firmament/state', { character }),
    set: (character, tree, rid) => post('/v1/firmament/set', { character, tree, rid }),
    respec: (character, rid, realm = null, region = null) => post('/v1/firmament/respec', { character, rid, ...(realm ? { realm } : {}), ...(Number.isSafeInteger(region) ? { region } : {}) }),   // the whole sky back for gold
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
    // HOME-VENDOR: a home's trader's stock, and the region's traders
    vendor: (vendor) => post('/v1/market/vendor', { vendor }),
    vendors: (region, character = null) => post('/v1/market/vendors', { region, ...(character ? { character } : {}) }),   // HOME-VENDOR: each house's door, for this character
    myVendors: (character) => post('/v1/market/myvendors', { character }),
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

/** CARDS6: a card table's stakes' door (server-account/src/cards.js) - a realm character's buy-in held against the
 *  service's order, and the relay's cash-out receipt paid back into its record. */
export function accountCards({ fetch, storage, waitMs = ACCOUNT_ACT_WAIT_MS }) {
  const post = waitedPost({ fetch, storage }, waitMs);
  return {
    stake: (req) => post('/v1/cards/stake', req),
    cashout: (req) => post('/v1/cards/cashout', req),
  };
}

/** SEA-BOUNTY: A FREEPORT'S BOUNTY BOARD'S DOOR (server-account/src/seaBounty.js) - the wanted captains and what is owed the
 *  asking character (`board`: `{ character }`), gold posted on a wanted head (`post`: `{ character, realm, region, target,
 *  gold, rid }`) and the owed collected (`collect`: `{ character, realm, region }`). Every answer is `call`'s shape. */
export function accountSeaBounty({ fetch, storage, waitMs = ACCOUNT_ACT_WAIT_MS }) {
  const post = waitedPost({ fetch, storage }, waitMs);
  return {
    board: (req) => post('/v1/sea/bounty/board', req),
    post: (req) => post('/v1/sea/bounty/post', req),
    collect: (req) => post('/v1/sea/bounty/collect', req),
  };
}

/** SHIP-PVP: A WRECK AT SEA'S DOOR (server-account/src/seaWreck.js) - a wreck's signed receipt carried (`wreck`: `{ receipt,
 *  realm? }` - the wrecked captain's own act with where its record stands, its killer's without), and a wreck's prizes
 *  collected by its killer's character or reclaimed by its captain's (`collect`, `reclaim`: `{ character, realm }`). Every
 *  answer is `call`'s shape. */
export function accountSeaWreck({ fetch, storage, waitMs = ACCOUNT_ACT_WAIT_MS }) {
  const post = waitedPost({ fetch, storage }, waitMs);
  return {
    wreck: (req) => post('/v1/sea/wreck', req),
    collect: (req) => post('/v1/sea/prize/collect', req),
    reclaim: (req) => post('/v1/sea/prize/reclaim', req),
  };
}

/** SEA-SEASON: THE SEA'S SEASON BOARDS' DOOR (server-account/src/seaSeason.js) - the season's deepest voyages and legends
 *  ended, and the asking character's rank each way (`board`: `{ character }`). Its answer is `call`'s shape. */
export function accountSeaSeason({ fetch, storage, waitMs = ACCOUNT_ACT_WAIT_MS }) {
  const post = waitedPost({ fetch, storage }, waitMs);
  return { board: (req) => post('/v1/sea/season/board', req) };
}

/** CARDS10: ILIAC HAND'S DOOR (server-account/src/iliac.js) - a ranked seat's deck vouched for (`deck`: `{ character,
 *  realm, deck }` - the service's order the relay seats it ranked on), a ranked game's receipt the relay signed, carried
 *  here by an account it names (`claim`), and the season board (`board`). Every answer is `call`'s shape. */
export function accountIliac({ fetch, storage, waitMs = ACCOUNT_ACT_WAIT_MS }) {
  const post = waitedPost({ fetch, storage }, waitMs);
  return {
    deck: (req) => post('/v1/cards/deck', req),
    claim: (receipt) => post('/v1/iliac/claim', { receipt }),
    board: () => post('/v1/iliac/board', {}),
    me: () => storedSession(storage)?.id ?? null,
    guest: () => storedSession(storage)?.kind === 'guest',   // AUDIT CARDS-6 E14: a guest's account plays no ranked game (iliac.js deckOrderOf)
  };
}

/** KG6 (bible/11-Multiplayer/Kings-Gambit.md section 19): THE KING'S GAMBIT'S SEASON - its rated results carried to the
 *  service (server-account/src/gambit.js claimGambit) and its board read (gambitBoardOf). */
export function accountGambit({ fetch, storage, waitMs = ACCOUNT_ACT_WAIT_MS }) {
  const post = waitedPost({ fetch, storage }, waitMs);
  return {
    claim: (receipt) => post('/v1/gambit/claim', { receipt }),
    board: () => post('/v1/gambit/board', {}),
    me: () => storedSession(storage)?.id ?? null,
  };
}

/** AUDIT CARDS-6 D8/E14: ILIAC HAND'S REFUSALS, IN ITS OWN WORDS. The deck order's and the claim's words are shared with
 *  other doors - the gold tables' (`cards-realm`, `cards-closed`), a backup's (`no-data`), the gate's (`receipt`,
 *  `not-yours`) - whose sentences in REFUSALS name a card table for gold, its stakes, a backup and a gate's receipt; and
 *  the vouch said "The realm could not vouch for that deck." over every one of them, a guest's and the service's without
 *  its key alike. A word not here is REFUSALS' own (iliacRefusalText). */
export const ILIAC_REFUSALS = Object.freeze({
  // L10N4: REFUSALS' own words read when said, never copied at load (they are the player's language's)
  get 'ranked-needs-account'() { return REFUSALS['ranked-needs-account']; },
  'cards-realm': 'Ranked games need a realm character, because the realm keeps its cards.',
  'cards-closed': 'The realm cannot check decks right now. Try again later.',
  get 'bad-deck'() { return REFUSALS['bad-deck']; },
  get 'deck-short'() { return REFUSALS['deck-short']; },
  'no-data': 'The realm could not read this character\'s record. Save, then try again.',
  receipt: 'That game\'s result could not be verified, or it has expired.',
  'not-yours': 'That game\'s result belongs to another account.',
  offline: 'The realm is not answering. Try again.',
  busy: 'The realm is busy with something else. Try again in a moment.',
});
/** The sentence for an Iliac Hand refusal - `deck-short` with the card it lacks, by name (D7: the service names it). */
export function iliacRefusalText(error, card = null) {
  const said = ILIAC_REFUSALS[error] ?? accountRefusalText(error);
  if (error !== 'deck-short' || typeof card !== 'string' || !card) return said;
  return `${said.replace(/\.$/, '')} (${cardById(card)?.name ?? card}).`;
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
    contract: (req) => post('/v1/writs/contract', req),   // SILVER-WAYS: a guild contract posted, and withdrawn
    withdrawContract: (req) => post('/v1/writs/contract-withdraw', req),
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
