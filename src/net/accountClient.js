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
import { LETTER_SUBJECT_MAX, LETTER_BODY_MAX, LETTER_LINES_MAX, LETTERS_SENT_MAX, LETTERS_PAIR_MAX } from './letterLaw.js';   // MAIL1: the letter's bounds, in the refusals' own sentences
import { MUTE_RANGE_TEXT } from './moderation.js';   // AUDIT 68 S14-mute-range-text-duplicated: the mute's bound in the refusal's sentence, from its home

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
  muted: 'You are muted, so you cannot send letters until the mute ends.',
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
  // WB5b: a gate's kill receipt carried to the service. net/gateClaims.js says nothing of these to the player - it keeps
  // what they do not settle and lets go of what they do - but a word the service can say is a word with a sentence.
  'no-gate-key': 'The account service cannot check a gate\'s receipt right now. It is kept and tried again.',
  receipt: 'That gate\'s receipt was not signed by the gate, or it has run out.',
  'not-yours': 'That gate\'s receipt names another account.',
  server: 'The account service had a problem. Try again.',
  offline: 'Could not reach the account service. Check your connection.',
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
 * @param {string} path  a `/v1/...` route
 * @param {object|null} [body]  POST body, or null for a GET
 * @returns {Promise<{ok: boolean, data?: any, error?: string, status?: number}>}
 */
export async function call({ fetch, base = DEFAULT_ACCOUNT_SERVICE, secret = null }, path, body = null) {
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
    return { ok: false, error: typeof data?.error === 'string' ? data.error : 'server', status: res.status };
  }
  return { ok: true, data, status: res.status };
}

// ── THE LADDER, ROUTE BY ROUTE ──────────────────────────────────────
//
// Each one is the thinnest possible wrapper: the route's name, its
// body's shape, and nothing else. They exist so the screen never spells
// a path, because a path spelled at a call site is a path that outlives
// a rename.

/** A guest row and the session that owns it. `{ id, name, kind,
 *  sessionId, secret }`. */
export const openGuest = (io, label = null) => call(io, '/v1/auth/guest', { label });

/** Fill in a handle and a password on the guest row THIS SESSION
 *  already owns - an upgrade in place, never a new account. Answers
 *  `{ recoveryCode, handle }`, and that code is readable exactly once. */
export const register = (io, handle, password) => call(io, '/v1/auth/register', { handle, password });

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
export const mintIdentity = (io) => call(io, '/v1/auth/token', {});

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
export function keepSession(storage, { id, name, kind, sessionId, secret }) {
  try {
    storage?.setItem?.(SESSION_KEY, JSON.stringify({ id, name, kind, sessionId, secret }));
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
 * @param {any} storage
 * @param {{ name?: string, kind?: string }} [who]
 */
export function adoptIdentity(storage, { name, kind } = {}) {
  const was = storedSession(storage);
  if (!was) return false;
  const next = { ...was };
  if (typeof name === 'string' && name) next.name = name;
  if (kind === 'guest' || kind === 'linked') next.kind = kind;
  if (next.name === was.name && next.kind === was.kind) return false;   // nothing to write, and a write is a storage event every open tab hears
  return keepSession(storage, next);
}

/** Forget it. Called on a deliberate sign-out AND whenever the service
 *  answers `auth`, because a secret the far end has stopped honouring
 *  is not a session - keeping it would make every later call fail the
 *  same way with nothing on screen explaining why. */
export function forgetSession(storage) {
  try { storage?.removeItem?.(SESSION_KEY); return true; } catch { return false; }
}

/**
 * ACC1d: ONE FRESH TOKEN FOR ONE RELAY CONNECTION.
 *
 * This is what `OnlineSession({ mintToken })` (net/online.js) calls on
 * every socket open, and its answer is the hello's `tok`. The relay
 * spends a token once (bible ACC1d D4), so there is no caching here and
 * there must not be: a token held over and sent twice is the exact frame
 * the relay refuses, and a player who reconnected would be refused their
 * own name.
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
 * @param {object} io
 * @param {(url: string, init: object) => Promise<any>} io.fetch
 * @param {any} io.storage  appStorage() in the app, a Map in a test
 * @param {((who: {name: string, kind: string, title: string|null, glyphs: string[]}) => void)|null} [io.onIssued]
 * @returns {() => Promise<string|null>}
 */
export function accountTokenMinter({ fetch, storage, onIssued = null }) {
  return async () => {
    const session = storedSession(storage);
    if (!session) return null;
    const answer = await mintIdentity({ fetch, base: serviceBase(storage), secret: session.secret });
    if (answer.ok) {
      const token = typeof answer.data?.token === 'string' ? answer.data.token : null;
      if (token) {
        const who = { name: answer.data.name, kind: answer.data.kind, title: answer.data.title ?? null, glyphs: Array.isArray(answer.data.glyphs) ? answer.data.glyphs : [] };
        adoptIdentity(storage, who);
        // A THROW HERE IS THE HOST'S AND IS NOT THE PLAYER'S. The token
        // is good and the connection is the thing that matters; a
        // display seam that breaks must not cost the hello its word.
        try { onIssued?.(who); } catch { /* the token still goes */ }
      }
      return token;
    }
    // A SECRET THE SERVICE HAS STOPPED HONOURING IS NOT A SESSION, and
    // `forgetSession`'s own note says why keeping one is worse than
    // dropping it. ONLY `auth`: every other refusal is the service
    // having a bad minute, and signing a player out over a 503 or a
    // rate limit would make an outage permanent.
    if (answer.error === 'auth') forgetSession(storage);
    return null;
  };
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
export const claimGateReceipt = (io, receipt) => call(io, '/v1/gate/claim', { receipt });

/**
 * WB5b: THE GATES' ONE CALL, bound to this device's stored session (read
 * at each call, as the duels' are). With no session there is no account
 * to claim for: `{ ok: false, error: 'no-session' }`, never a knock - and
 * net/gateClaims.js keeps the receipt for when there is one.
 */
export function accountGates({ fetch, storage }) {
  const io = () => { const s = storedSession(storage); return s ? { fetch, base: serviceBase(storage), secret: s.secret } : null; };
  return {
    claim: async (receipt) => { const i = io(); return i ? claimGateReceipt(i, receipt) : { ok: false, error: 'no-session' }; },
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
