// @ts-check
// ═══════════════════════════════════════════════════════════════════
// GUILD2b (2026-10-03) — THE GUILD'S VAULT: ITEMS THE GUILD KEEPS, AND WHO
// MAY PUT IN AND TAKE OUT (bible/11-Multiplayer/Guild-Overhaul.md).
//
// Asked: "guild item storage with the leader able to grant and revoke
// perms". The vault is a guild's shelf of items - any piece a trade
// could carry (net/realm/realmTradeLaw.js tradeableRecord) - held on the
// account service, never in a save: a piece put in leaves the
// depositor's realm record in the same batch that writes it to the vault,
// and one taken out enters the taker's record the same way (server-
// account/src/guildVault.js), so a vault is never a copy of anyone's pack.
//
// WHO MAY: each member stands at a level - NONE, DEPOSIT (put in) or
// WITHDRAW (put in and take out) - with, for a withdrawer, the most takes
// they may make a UTC day. A rank sets the default (VAULT_RANK_DEFAULTS);
// the GUILDMASTER grants any member another level and limit, and revokes it
// back to the rank's (`null` - the rank's default). The guildmaster's own is
// WITHDRAW, unlimited, and is no one's to change.
//
// The shapes and bounds BOTH ends read. Pure: no clock, no DOM, no network.
// ═══════════════════════════════════════════════════════════════════
import { GUILD_RANK_MASTER, GUILD_RANK_OFFICER, GUILD_RANK_MEMBER, GUILD_RANK_RECRUIT, guildRankOk } from './guildLaw.js';

/** A vault's shelves: this many slots, and this many more while the guild holds a hall (its cupboards, Seats-Arc 8.2). */
export const GUILD_VAULT_SLOTS = 50;
export const GUILD_VAULT_HALL_SLOTS = 50;
export const guildVaultSlots = (hasHall) => GUILD_VAULT_SLOTS + (hasHall ? GUILD_VAULT_HALL_SLOTS : 0);
/** The vault's lines a member's view shows. */
export const GUILD_VAULT_LOG_SHOWN = 40;

/** The three levels, lowest first. */
export const VAULT_LEVELS = Object.freeze(['none', 'deposit', 'withdraw']);
export const vaultLevelOk = (l) => VAULT_LEVELS.includes(l);
/** A withdrawer's limit a UTC day: 1 to VAULT_LIMIT_MAX takes (a take is one press - a stack or one of it), or 0 - no
 *  limit. */
export const VAULT_LIMIT_MAX = 100;
export const vaultLimitOk = (n) => Number.isSafeInteger(n) && n >= 0 && n <= VAULT_LIMIT_MAX;
/** The choices a guildmaster picks a limit from (the Members page), 0 the unlimited. */
export const VAULT_LIMIT_CHOICES = Object.freeze([1, 3, 5, 10, 25, 0]);

/** What each rank stands at until the guildmaster says otherwise: officers withdraw, ten a day; members and recruits put in. */
export const VAULT_RANK_DEFAULTS = Object.freeze({
  [GUILD_RANK_MASTER]: Object.freeze({ level: 'withdraw', limit: 0 }),
  [GUILD_RANK_OFFICER]: Object.freeze({ level: 'withdraw', limit: 10 }),
  [GUILD_RANK_MEMBER]: Object.freeze({ level: 'deposit', limit: 0 }),
  [GUILD_RANK_RECRUIT]: Object.freeze({ level: 'deposit', limit: 0 }),
});

/**
 * A MEMBER'S STANDING AT THE VAULT: the grant the guildmaster made (`level`, `limit` - or null for none, the rank's
 * default), read through the rank. The guildmaster is always WITHDRAW, unlimited - a grant on that row is never read.
 * `{ level, limit, granted }` - `granted` whether it is the guildmaster's word rather than the rank's.
 * @param {number} rank @param {{ level?: string|null, limit?: number|null }|null} [grant]
 */
export function vaultStanding(rank, grant = null) {
  const def = VAULT_RANK_DEFAULTS[guildRankOk(rank) ? rank : GUILD_RANK_RECRUIT];
  if (rank === GUILD_RANK_MASTER || !grant || !vaultLevelOk(grant.level)) return { level: def.level, limit: def.limit, granted: false };
  return { level: grant.level, limit: grant.level === 'withdraw' && vaultLimitOk(grant.limit) ? grant.limit : 0, granted: true };
}
/** Whether a standing may put a piece in. */
export const vaultMayPut = (s) => s?.level === 'deposit' || s?.level === 'withdraw';
/** Whether a standing may take one out, having taken `takenToday` today. */
export const vaultMayTake = (s, takenToday = 0) => s?.level === 'withdraw' && (s.limit === 0 || (takenToday | 0) < s.limit);

/** AUDIT2 GUILD2 S6: a withdrawer's limit where the grant names none - an officer's ten (never "no limit", which is the
 *  guildmaster's to choose: 0). */
export const VAULT_GRANT_LIMIT = VAULT_RANK_DEFAULTS[GUILD_RANK_OFFICER].limit;
/** A grant the guildmaster asks: a level and a limit, or `level: null` - revoked, back to the rank's. Null for a bad shape.
 *  A withdrawer's grant that names no limit (absent or null) stands at VAULT_GRANT_LIMIT. */
export function vaultGrantOf(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const { level = null, limit: asked = null } = /** @type {any} */ (raw);
  if (level === null) return { level: null, limit: 0 };
  const limit = asked == null ? (level === 'withdraw' ? VAULT_GRANT_LIMIT : 0) : asked;
  if (!vaultLevelOk(level) || !vaultLimitOk(limit)) return null;
  return { level, limit: level === 'withdraw' ? limit : 0 };
}

/** A standing in words: "Takes out, 10 a day" - the Members page's line and the Vault page's. */
export function vaultStandingText(s) {
  if (s?.level === 'withdraw') return s.limit > 0 ? `Takes out, ${s.limit} a day` : 'Takes out, any number';
  if (s?.level === 'deposit') return 'Puts in';
  return 'No access';
}
