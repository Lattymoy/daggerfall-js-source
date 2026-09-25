// @ts-check
// ═══════════════════════════════════════════════════════════════════
// GUILD1 (2026-09-25) — A GUILD: WHO FOUNDS ONE, WHO BELONGS, WHAT EACH
// RANK MAY DO, AND WHAT THE TREASURY HOLDS.
//
// Mac, of the holdings: "future ownership for online guilds"; asked,
// founding a guild takes "Gold and Renown", a guild is joined "Per
// character", its ranks are "Four, renamed by the guildmaster", and
// the treasury is the "Guildmaster only" to take from - any member may
// put gold in, and every movement is written down.
//
// The shapes and bounds BOTH ends read - the account service
// (server-account/src/guilds.js), which keeps every guild so every
// client sees the same roster and the same treasury, and the client.
// Pure: no clock, no DOM, no network.
//
// FOUR RANKS, highest first: the GUILDMASTER (0), OFFICERS (1),
// MEMBERS (2) and RECRUITS (3). What each may do is fixed here; what
// each is CALLED is the guildmaster's to choose. A rank acts only on
// ranks below its own: an officer invites, removes a member or a
// recruit, and moves one between those two; the guildmaster does all
// of that to officers too, renames the ranks, takes from the treasury,
// hands the guild on, and disbands it.
// ═══════════════════════════════════════════════════════════════════

/** What founding costs: gold (the purse, then the bank - a fee, the treasury starts empty) and the founder's Renown. */
export const GUILD_FOUND_GOLD = 10_000;
export const GUILD_FOUND_RENOWN = 10;
/** How many characters one guild holds. */
export const GUILD_MEMBERS_MAX = 50;
/** A guild's name: 3 to 32 of letters, digits, spaces, apostrophes and hyphens; its tag 2 to 4 capitals or digits. */
export const GUILD_NAME_MIN = 3;
export const GUILD_NAME_MAX = 32;
export const GUILD_TAG_RE = /^[A-Z0-9]{2,4}$/;
/** The four ranks, highest first, and what each is called until the guildmaster says otherwise. */
export const GUILD_RANK_MASTER = 0;
export const GUILD_RANK_OFFICER = 1;
export const GUILD_RANK_MEMBER = 2;
export const GUILD_RANK_RECRUIT = 3;
export const GUILD_RANK_NAMES = Object.freeze(['Guildmaster', 'Officer', 'Member', 'Recruit']);
export const GUILD_RANK_NAME_MAX = 20;
/** What each rank may do (the ranks that may). */
export const GUILD_POWERS = Object.freeze({
  invite: Object.freeze([0, 1]),
  remove: Object.freeze([0, 1]),
  promote: Object.freeze([0, 1]),
  deposit: Object.freeze([0, 1, 2, 3]),
  withdraw: Object.freeze([0]),        // Mac: "Guildmaster only"
  renameRanks: Object.freeze([0]),
  handOver: Object.freeze([0]),
  disband: Object.freeze([0]),
});
/** One deposit or withdrawal, and the most a treasury holds. */
export const GUILD_MOVE_MAX = 1_000_000;
export const GUILD_TREASURY_MAX = 1_000_000_000;
/** The ledger's latest entries a roster shows. */
export const GUILD_LEDGER_SHOWN = 50;
/** Writes an account may make an hour to its guilds (an invite, a move, a deposit each count). */
export const GUILD_OPS_MAX = 300;
export const GUILD_OPS_WINDOW_S = 3600;
/** How long an invitation stands, seconds. */
export const GUILD_INVITE_TTL_S = 7 * 24 * 3600;

/** A guild's id (the service mints it) and a member's (the roster's handle on one character - never its save's id). */
export const GUILD_ID_RE = /^g[0-9a-z]{10}$/;
export const GUILD_MEMBER_RE = /^m[0-9]{1,15}$/;

const RANKS = [GUILD_RANK_MASTER, GUILD_RANK_OFFICER, GUILD_RANK_MEMBER, GUILD_RANK_RECRUIT];
export const guildRankOk = (r) => RANKS.includes(r);

/** Whether a rank may do a thing. */
export const guildMay = (rank, power) => (GUILD_POWERS[power] ?? []).includes(rank);

/** Whether an actor of rank `actor` may act on a member of rank `target` - only ever a rank below its own. */
export const guildOutranks = (actor, target) => guildRankOk(actor) && guildRankOk(target) && actor < target;

/**
 * Whether an actor may move a member from rank `from` to rank `to`: it may promote or demote, the member is below it
 * both before and after, and the move changes something. Handing the guild on (a new guildmaster) is its own act.
 */
export function guildMayMove(actor, from, to) {
  if (!guildMay(actor, 'promote') || !guildRankOk(from) || !guildRankOk(to) || from === to) return false;
  return guildOutranks(actor, from) && guildOutranks(actor, to);
}

/** A guild's name, tidied (spaces collapsed, ends trimmed), or null. */
export function guildNameOf(raw) {
  if (typeof raw !== 'string') return null;
  const s = raw.replace(/\s+/g, ' ').trim();
  if (s.length < GUILD_NAME_MIN || s.length > GUILD_NAME_MAX) return null;
  return /^[A-Za-z0-9][A-Za-z0-9 '\-]*[A-Za-z0-9]$/.test(s) ? s : null;
}
/** The key two names are the same guild by - the case and the spaces aside. */
export const guildNameKey = (name) => String(name ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** A guild's tag, upper-cased, or null. */
export function guildTagOf(raw) {
  if (typeof raw !== 'string') return null;
  const t = raw.trim().toUpperCase();
  return GUILD_TAG_RE.test(t) ? t : null;
}

/** The four rank names, each tidied - or null when any is empty, too long, or not plain words. */
export function guildRankNamesOf(raw) {
  if (!Array.isArray(raw) || raw.length !== RANKS.length) return null;
  const out = raw.map((n) => (typeof n === 'string' ? n.replace(/\s+/g, ' ').trim() : ''));
  const ok = out.every((n) => n.length >= 1 && n.length <= GUILD_RANK_NAME_MAX && /^[A-Za-z0-9 '\-]+$/.test(n));
  return ok && new Set(out.map((n) => n.toLowerCase())).size === out.length ? out : null;
}

/** A treasury movement: a whole number of gold, at least one, at most GUILD_MOVE_MAX. */
export const guildGoldOk = (n) => Number.isSafeInteger(n) && n >= 1 && n <= GUILD_MOVE_MAX;
