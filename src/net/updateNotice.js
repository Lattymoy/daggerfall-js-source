// @ts-check
// SRV-N (2026-09-17, Mac: "One thing I want to add is a server restart
// notice whenever we push server updates. Like a notice that pushes in
// the chat window").
//
// ═══ "SERVER" IS TWO THINGS, AND ONLY ONE OF THEM IS THE SERVER ═══
//
// This port pushes two different things at a player, on two completely
// different rhythms, and a notice that knew only one of them would be
// wrong about the other:
//
//   THE RELAY (`server/`, a Cloudflare Worker + Durable Objects). Since
//   SRV-N/CI it is deployed by `.github/workflows/relay-deploy.yml` on
//   every push to main, but only when RELAY_VERSION has moved - so it
//   moves rarely, on the merges that change the relay's own law. When
//   it does, every Durable Object restarts and every socket in the game
//   drops at once. That is a SERVER RESTART in
//   the most literal sense: peers vanish, chat goes quiet, and the
//   player currently has no idea why. This is the half Mac's words name.
//
//   THE BUILD (the client, on GitHub Pages). It is deployed by CI on
//   every merge to main - several times a day. Nothing restarts and
//   nothing drops; the player simply keeps running code we have
//   replaced. This is the half that actually happens "whenever we push",
//   and it is the half with a known failure at the end of it:
//   `systems/staleChunk.js` exists because a tab held open across a
//   deploy eventually asks for a hashed chunk that has been DELETED, and
//   the game breaks in their hands with no warning.
//
// So both, through one presenter. Told once, in the chat window, in
// words that say what happened rather than what to blame.
//
// ═══ WHY THE TWO DETECTORS ARE NOT THE SAME SHAPE ═════════════════
//
// They are asked different questions, and pretending otherwise would
// have made one of them lie:
//
//   The relay's version is a name we have NEVER SEEN BEFORE at the
//   moment we first hear it. There is no "correct" value to compare
//   against, so the first one heard is only a baseline - it is the
//   SECOND, different one that is news. Hence a ladder.
//
//   The build's tag is one we already know: `buildTag.js` BUILD_TAG is
//   stamped into this very bundle, and vite stamps the same sha into
//   every built page's <meta name="build-tag">. So the live page's tag
//   is compared against our own directly, with no baseline to learn.
//
// ═══ AND WHY BOTH REMEMBER IN A SET ═══════════════════════════════
//
// THE ARMS ARE PLURAL HERE TOO. A player in the enhanced skin holds a
// PRESENCE session plus one chat-channel session per tab, and a relay
// deploy drops and re-welcomes all of them. Each welcome carries the
// version; a single "last seen" slot would have said "changed" once per
// socket and pushed the same notice two, three, four times in a row.
// The same argument the unload guard's `_arms` makes (MAC-L3), reached
// from the other direction: MANY ARMS, ONE ANSWER.
//
// A Set rather than a slot has a second property that a slot cannot
// have: a FLIP-FLOP CANNOT DOUBLE-NOTIFY. Two relay versions live at
// once - a rollback, or an edge still serving the old Worker while
// another serves the new - would otherwise ping-pong a notice on every
// reconnect for as long as the disagreement lasted.
//
// Not a DFU member: Daggerfall Unity is not deployed to anybody.
// Ledger A row (ONLINE).
import { relayVersionOf } from './wire.js';

/** What a relay restart says. Deliberately about the RELAY and not the
 *  game: nothing the player has is lost, and a notice that sounds like
 *  it might be is worse than no notice. */
export const RELAY_RESTART_TEXT = 'The server was updated and restarted. Players nearby and chat will come back on their own in a moment.';
/** What a new client build says. It does NOT reload for them - a reload
 *  mid-dungeon costs whatever is not saved, and that is the player's
 *  call to make, not ours. It says what to do first. */
export const BUILD_UPDATE_TEXT = 'A new version of the game has been released. Save your game, then reload the page to pick it up.';

/** The most deploy names the page remembers, and the least time between
 *  two restart notices (AUDIT-SRVN F2/F3).
 *
 *  A Set that never forgets is an unbounded accumulator fed by the wire,
 *  and this was the only one SRV-N added: the chat log caps at
 *  CHAT_KEEP, `online.js`'s `_threwKinds` caps at THREW_KINDS_MAX and
 *  CLEARS, and this held every name it was ever handed. A relay that
 *  mints a fresh name per welcome grew it for ever - driven, on ONE open
 *  socket, because a welcome is not once per connection.
 *
 *  The bound is the same shape `_threwKinds` uses and for the same
 *  reason, and the clear is deliberately how it fails: an emptied set
 *  re-baselines, and a re-baseline is SILENCE. Losing a notice is the
 *  correct way for this to break.
 *
 *  The interval is the other half, and it is not really a rate limit -
 *  it is the physical fact. A relay cannot restart twice in half a
 *  minute, so a second "it restarted" inside one is not news about the
 *  world, whoever sent it. */
export const RELAY_SEEN_MAX = 32;
export const RELAY_NOTICE_MIN_MS = 30_000;

/** How often a running tab asks the site which build it is serving, ms.
 *  Long on purpose: the answer changes a few times a day at most, the
 *  cost of being late is a stale tab and not a broken one, and a shorter
 *  poll would put every open tab on the CDN for nothing. */
export const BUILD_POLL_MS = 10 * 60 * 1000;

/** How long the build poll waits for the site before giving up, ms. A
 *  request that never settles used to disable the poll for the whole
 *  session (AUDIT-SRVN F3, the other half). */
export const BUILD_FETCH_TIMEOUT_MS = 15_000;

/** @type {Set<string>} every relay version this page has been told. */
const _relaySeen = new Set();
/** @type {number} when the last restart notice was earned. */
let _relayToldAt = -Infinity;
/** @type {Set<string>} every foreign build tag already announced. */
const _buildTold = new Set();

/**
 * The relay named a version on a welcome. Answers what to do about it:
 *
 *   'unknown' - the welcome carried no version, or nothing the wire's
 *               law admits as one. The live relay before this slice is
 *               exactly the first case, and it must be SILENT rather
 *               than guessed at.
 *   'first'   - the baseline. Nothing to say; we have simply learned
 *               which relay this page has been talking to all along.
 *   'same'    - a version already known. Another socket's welcome, or a
 *               reconnect: not news.
 *   'flood'   - news too soon after the last news (AUDIT-SRVN F2). A
 *               separate word from 'same' because they are different
 *               facts and a reader of this function should not have to
 *               guess which one happened; both are silent.
 *   'changed' - a version never seen on this page. The relay moved
 *               under us. SAY SO.
 *
 * The clock is injected rather than read, so the interval is a pinned
 * fact and not a sleep in a test.
 *
 * @param {unknown} v
 * @param {number} [now]
 * @returns {'unknown'|'first'|'same'|'flood'|'changed'}
 */
export function relayVersionSeen(v, now = Date.now()) {
  // The wire's law, not this file's idea of one: `relayVersionOf` is what
  // `online.js` admits, so the detector cannot be reached with a name the
  // session would have refused, nor refuse one it accepted.
  const s = relayVersionOf(typeof v === 'string' ? v.trim() : v);
  if (!s) return 'unknown';
  if (_relaySeen.has(s)) return 'same';
  if (_relaySeen.size === 0) { _relaySeen.add(s); return 'first'; }
  // Bounded, and it fails towards silence: an emptied set re-baselines.
  if (_relaySeen.size >= RELAY_SEEN_MAX) _relaySeen.clear();
  _relaySeen.add(s);
  if (now - _relayToldAt < RELAY_NOTICE_MIN_MS) return 'flood';
  _relayToldAt = now;
  return 'changed';
}

/**
 * The commit a built page was stamped with, or null on a page built
 * before the stamp existed. `vite.config.js` writes the tag into every
 * built page as <meta name="build-tag">; attribute order is not assumed.
 *
 * ONE HOME. `tools/verify-deploy.mjs` asks this same question of the
 * same tag from node, and used to carry its own copy of the regex. Two
 * spellings of one rule is two chances to disagree about what a deploy
 * is, which is precisely the shape half of this month's findings had.
 *
 * @param {unknown} html
 * @returns {string|null}
 */
export function buildTagOf(html) {
  const tag = String(html ?? '').match(/<meta[^>]*\sname="build-tag"[^>]*>/i)?.[0];
  return tag?.match(/\scontent="([^"]*)"/i)?.[1] || null;
}

/**
 * The site is serving `liveTag`; this bundle is `mine`. Answers:
 *
 *   'unknown' - one side has no tag. A dev server's page is unstamped,
 *               and so is a fetch that failed. Silent.
 *   'current' - the site is serving us. The ordinary answer.
 *   'told'    - a newer build, already announced once. The poll keeps
 *               running (the next deploy is a different tag again) and
 *               keeps quiet.
 *   'changed' - a build we have not announced. SAY SO, once.
 *
 * @param {unknown} liveTag
 * @param {unknown} mine
 * @returns {'unknown'|'current'|'told'|'changed'}
 */
export function buildUpdateSeen(liveTag, mine) {
  const live = String(liveTag ?? '').trim();
  const own = String(mine ?? '').trim();
  if (!live || !own) return 'unknown';
  if (live === own) return 'current';
  if (_buildTold.has(live)) return 'told';
  _buildTold.add(live);
  return 'changed';
}

/**
 * Ask the site which build it is serving. Answers null for every way
 * this can fail - offline, a 404, a body that is not a built page - and
 * `buildUpdateSeen` reads null as 'unknown', so a flaky network is
 * quiet rather than alarming.
 *
 * `cache: 'no-store'` is the whole point of the call: the page in the
 * tab came OUT of the browser's cache, and a cached answer here would
 * hand back the very tag we are trying to compare against.
 *
 * @param {string} url
 * @param {((url: string, init?: any) => Promise<any>)|null} [fetchImpl]
 * @returns {Promise<string|null>}
 */
export async function fetchLiveBuildTag(url, fetchImpl = null, timeoutMs = BUILD_FETCH_TIMEOUT_MS) {
  const f = fetchImpl ?? (typeof globalThis !== 'undefined' ? globalThis.fetch : null);
  if (typeof f !== 'function' || !url) return null;
  try {
    // AUDIT-SRVN F3: a request that never settles is a promise that never
    // settles. The caller's own re-entry gate is what makes that
    // survivable, but leaking one socket per poll is not, so the request
    // is CANCELLED rather than abandoned. Guarded because a host without
    // `AbortSignal.timeout` should poll, not throw.
    const signal = typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
      ? AbortSignal.timeout(timeoutMs) : undefined;
    const res = await f(url, { cache: 'no-store', signal });
    if (!res?.ok) return null;
    return buildTagOf(await res.text());
  } catch { return null; }
}

/** The tests drive a fresh page per case. */
export function resetUpdateNotice() {
  _relaySeen.clear();
  _buildTold.clear();
  _relayToldAt = -Infinity;
}
