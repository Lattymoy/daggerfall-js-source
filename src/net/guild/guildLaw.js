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

import { HALL_POWERS } from '../hallLaw.js'; // GUILD-RANKS: the hall's powers among a guild's own

/** What founding costs: gold (the purse, then the bank - a fee, the treasury starts empty) and the founder's Renown. */
export const GUILD_FOUND_GOLD = 10_000;
export const GUILD_FOUND_RENOWN = 10;
/** How many characters one guild holds - 75 since GUILD-CAP (the Discord, 2026-10-21: "75 would be a great start"; it was 50).
 *  The hub's who-is-online list (hubShards.js HUB_GUILD_WHO_MAX) must hold a full guild but its asker. */
export const GUILD_MEMBERS_MAX = 75;
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
  withdraw: Object.freeze([0]), // Mac: "Guildmaster only"
  renameRanks: Object.freeze([0]),
  handOver: Object.freeze([0]),
  disband: Object.freeze([0]),
  rename: Object.freeze([0]), // GUILD2a: the guild's own name and tag - the guildmaster's, for a price
  vaultGrant: Object.freeze([0]), // GUILD2b: who may put in and take out of the guild's vault - the leader's to grant and revoke
  shop: Object.freeze([0]), // GUILD-SHOP: the hall's furniture bought from the silver treasury
  logo: Object.freeze([0]), // GUILD-LOGO: the guild's own picture sent for review, its fee from the silver treasury
});
// ─── GUILD-RANKS (2026-10-30, the owner: "More guild ranks plus rank permission edits"; bible/11-Multiplayer/Guild-Shop.md
// section 13): four to eight ranks, added or taken at the bottom; a new member joins at the lowest. The guildmaster sets
// which ranks hold each EDITABLE power (the guild's own `powers`); the guildmaster holds all, and the rest stay theirs.
// Seats, castles, writs and contracts keep their own laws.
/** The fewest and the most ranks a guild keeps. */
export const GUILD_RANKS_MIN = 4;
export const GUILD_RANKS_MAX = 8;
/** The powers a guildmaster may give to ranks - the guild's own, and its hall's (hallLaw.js HALL_POWERS). */
export const GUILD_POWERS_EDITABLE = Object.freeze([
  'invite',
  'remove',
  'promote',
  'deposit',
  'withdraw',
  'vaultGrant',
  'shop',
  'logo',
  'hallEntry',
  'decorate',
  'notes',
]);
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
/** GUILD-REQUESTS (2026-10-30, the owner: "Player guild join requests"): a character asks a guild by its tag; a rank that
 *  invites answers. A request stands as long as an invitation, a character holds a few at once, a guild hears a few dozen. */
export const GUILD_REQUEST_TTL_S = GUILD_INVITE_TTL_S;
export const GUILD_REQUESTS_MAX = 3;
export const GUILD_REQUESTS_GUILD_MAX = 30;

/** A guild's id (the service mints it) and a member's (the roster's handle on one character - never its save's id). */
export const GUILD_ID_RE = /^g[0-9a-z]{10}$/;
export const GUILD_MEMBER_RE = /^m[0-9]{1,15}$/;
/** GUILD-REQUESTS: a join request's handle. */
export const GUILD_REQUEST_RE = /^q[0-9]{1,15}$/;

/** GUILD-RANKS: whether `r` is a rank of a guild of `n` ranks (any guild's, unnamed). */
export const guildRankOk = (r, n = GUILD_RANKS_MAX) =>
  Number.isInteger(r) && r >= 0 && r < Math.min(GUILD_RANKS_MAX, n);
/** GUILD-RANKS: how many ranks a guild's names (its `ranks` row, JSON or a list) say it keeps - four where they say none. */
export function guildRankCount(raw) {
  let list = raw;
  if (typeof raw === 'string') {
    try {
      list = JSON.parse(raw);
    } catch {
      list = null;
    }
  }
  return Array.isArray(list) && list.length >= GUILD_RANKS_MIN && list.length <= GUILD_RANKS_MAX
    ? list.length
    : GUILD_RANKS_MIN;
}
/**
 * GUILD-RANKS: A GUILD'S POWERS, WHOLE - each power the ranks that hold it, for a guild of `n` ranks: an editable power as
 * the guild set it (`raw`, its `powers` row - JSON or an object: a power, the ranks beside the guildmaster), else at its
 * default; the guildmaster in every one. A deposit's default is every rank. Pure.
 * @param {unknown} raw @param {number} [n]
 * @returns {Readonly<Record<string, readonly number[]>>}
 */
export function guildPowersOf(raw, n = GUILD_RANKS_MIN) {
  let set = raw;
  if (typeof raw === 'string') {
    try {
      set = JSON.parse(raw);
    } catch {
      set = null;
    }
  }
  const k = Math.max(GUILD_RANKS_MIN, Math.min(GUILD_RANKS_MAX, Number(n) || GUILD_RANKS_MIN));
  /** @type {Record<string, readonly number[]>} */
  const out = {};
  for (const [p, def] of Object.entries({ ...HALL_POWERS, ...GUILD_POWERS })) {
    const given =
      GUILD_POWERS_EDITABLE.includes(p) && set && typeof set === 'object' ? /** @type {any} */ (set)[p] : undefined;
    const ranks = Array.isArray(given)
      ? given.filter((r) => guildRankOk(r, k))
      : p === 'deposit'
        ? [...Array(k).keys()]
        : def.filter((r) => r < k);
    out[p] = Object.freeze([...new Set([0, ...ranks])].sort((a, b) => a - b));
  }
  return Object.freeze(out);
}
/** GUILD-RANKS: a guildmaster's edit, as the guild keeps it - each editable power's ranks beside the guildmaster, within
 *  `n` ranks - or null for anything else. */
export function guildPowersEditOf(raw, n) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  /** @type {Record<string, number[]>} */
  const out = {};
  for (const [p, ranks] of Object.entries(raw)) {
    if (!GUILD_POWERS_EDITABLE.includes(p) || !Array.isArray(ranks) || ranks.length > GUILD_RANKS_MAX) return null;
    if (!ranks.every((r) => guildRankOk(r, n) && r > 0)) return null;
    out[p] = [...new Set(ranks)].sort((a, b) => a - b);
  }
  return out;
}
/** The table a law asked without a guild's own reads. */
const DEFAULT_POWERS = guildPowersOf(null, GUILD_RANKS_MAX);

/** Whether a rank may do a thing - GUILD-RANKS: in its guild's own powers (`table`, guildPowersOf), else the defaults. */
export const guildMay = (rank, power, table = null) =>
  ((table ?? DEFAULT_POWERS)[power] ?? GUILD_POWERS[power] ?? []).includes(rank);
/** GUILD-RANKS: the ranks that hold `power` by the law's defaults (`table` null) or a guild's own table. */
export const guildPowerRanks = (power, table = null) => [...((table ?? DEFAULT_POWERS)[power] ?? [0])];

/** Whether an actor of rank `actor` may act on a member of rank `target` - only ever a rank below its own. */
export const guildOutranks = (actor, target) => guildRankOk(actor) && guildRankOk(target) && actor < target;

/**
 * Whether an actor may move a member from rank `from` to rank `to`: it may promote or demote, the member is below it
 * both before and after, and the move changes something. Handing the guild on (a new guildmaster) is its own act.
 * GUILD-RANKS: in a guild of `n` ranks, by its own powers (`table`).
 */
export function guildMayMove(actor, from, to, table = null, n = GUILD_RANKS_MAX) {
  if (!guildMay(actor, 'promote', table) || !guildRankOk(from, n) || !guildRankOk(to, n) || from === to) return false;
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
export const guildNameKey = (name) =>
  String(name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

/** A guild's tag, upper-cased, or null. */
export function guildTagOf(raw) {
  if (typeof raw !== 'string') return null;
  const t = raw.trim().toUpperCase();
  return GUILD_TAG_RE.test(t) ? t : null;
}

/** GUILD1c: a guild's tag as a name wears it - "<HND>", the tag's own mark (the Renown's is a box) - or null for none
 *  and for anything the law's shape does not admit, never upper-cased on the way: a tag drawn is the one signed. One
 *  spelling for every face that draws it: the name over a head (both faces), a chat line, the profile card. */
export const guildTagText = (tag) => (typeof tag === 'string' && GUILD_TAG_RE.test(tag) ? `<${tag}>` : null);

/** The rank names, each tidied - four to eight (GUILD-RANKS) - or null when any is empty, too long, or not plain words. */
export function guildRankNamesOf(raw) {
  if (!Array.isArray(raw) || raw.length < GUILD_RANKS_MIN || raw.length > GUILD_RANKS_MAX) return null;
  const out = raw.map((n) => (typeof n === 'string' ? n.replace(/\s+/g, ' ').trim() : ''));
  const ok = out.every((n) => n.length >= 1 && n.length <= GUILD_RANK_NAME_MAX && /^[A-Za-z0-9 '\-]+$/.test(n));
  return ok && new Set(out.map((n) => n.toLowerCase())).size === out.length ? out : null;
}

// ─── GUILD2a (2026-10-03): A NEW NAME, FOR A PRICE ─────────────────────────────────────────────────────────────────
// Asked: "A way to change your guild name for a price." The guildmaster renames the guild - its name, its tag, or both -
// never sooner than GUILD_RENAME_COOLDOWN_S after the last, so a name is not a costume changed by the hour; the old one is
// free at once for any founder. GUILD-SHOP: the price is silver from the guild's treasury (guildShopLaw.js
// GUILD_RENAME_SILVER), no longer the realm's gold. bible/11-Multiplayer/Guild-Overhaul.md, Guild-Shop.md.

/** How long a guild keeps a name before it may change it again, in seconds - a fortnight. */
export const GUILD_RENAME_COOLDOWN_S = 14 * 24 * 3600;
/** When a guild renamed at `renamedAt` (epoch seconds, or null for never) may rename again - null for now. */
export const guildRenameAt = (renamedAt) =>
  Number.isSafeInteger(renamedAt) && renamedAt > 0 ? renamedAt + GUILD_RENAME_COOLDOWN_S : null;
/** Whether a guild renamed at `renamedAt` may rename at `nowS`. */
export const guildRenameOpen = (renamedAt, nowS) => {
  const at = guildRenameAt(renamedAt);
  return at === null || nowS >= at;
};

/** A treasury movement: a whole number of gold, at least one, at most GUILD_MOVE_MAX. */
export const guildGoldOk = (n) => Number.isSafeInteger(n) && n >= 1 && n <= GUILD_MOVE_MAX;
