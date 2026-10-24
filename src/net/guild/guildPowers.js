// @ts-check
// ═══════════════════════════════════════════════════════════════════
// GUILD3c (2026-10-11, the owner: "simplifying the player guild and npc guild system from being too overcomplicated.
// Keeping depth, but making it easier to understand"; bible/11-Multiplayer/Guilds-Made-Plain.md, EVERY RULE BEFORE THE
// PRESS) - WHAT EACH RANK OF A PLAYER'S GUILD MAY DO, IN WORDS.
//
// The powers live in four tables, each beside the law that asks it - guildLaw.js GUILD_POWERS (guildMay), hallLaw.js
// HALL_POWERS (hallMay), writLaw.js WRIT_POWERS (writMay), townSeatLaw.js SEAT_POWERS (seatMay) and SEAT_LEVER_RANKS -
// and the service asks them there, so they stay where they are. No page said any of them: a member learnt what its rank
// could do by the buttons it could not press. This module composes them into one list in words, each line's ranks read
// off its own table AT THE CALL - a table moved moves the page - and test/net/guild3_plain.test.js sweeps every key of the
// four tables against it, so a power added with no words fails the suite.
//
// AUDIT GUILD3 (bible/01-Overview/audits/Audit-Guild3.md): W3/C6 - what a rank may NOT do is a rank's too (an Officer fills no
// writ of its own guild's and is paid by none of its contracts: writLaw.js writDeliverMay, contractPaidMay), so "Everything
// a Member may" was false; W4/C6 - the acts the service gives the guildmaster by rank alone (a Sellsword hired, any writ
// withdrawn) and the town board's call for members were unworded; C4 - the writ budget binds the Officers alone; C5 - the
// vault is its own line, so a rank's place there is said whatever its gold; C7 - a rank is named as its guild wrote it,
// never with an article guessed for it.
//
// Pure: no DOM, no clock, no network.
// ═══════════════════════════════════════════════════════════════════

import { GUILD_POWERS, GUILD_RANK_MASTER, GUILD_RANK_OFFICER, GUILD_RANK_MEMBER, GUILD_RANK_RECRUIT, GUILD_RANK_NAMES } from './guildLaw.js';
import { HALL_POWERS } from '../hallLaw.js';
import { WRIT_POWERS, writDeliverMay, contractPaidMay } from '../writLaw.js';
import { SEAT_POWERS, SEAT_LEVER_RANKS } from '../townSeatLaw.js';
import { VAULT_RANK_DEFAULTS } from './guildVaultLaw.js';

/** The four tables by the name a row gives them; `levers` the seat's levers (SEAT_LEVER_RANKS, one list of ranks). */
const TABLES = Object.freeze({ guild: GUILD_POWERS, hall: HALL_POWERS, writ: WRIT_POWERS, seat: SEAT_POWERS });
/** AUDIT GUILD3 W3: the acts the writs' law gives a rank by a rule, not a table - read off the rule at the call. */
const RULES = Object.freeze({ deliver: writDeliverMay, paid: contractPaidMay });
const RANKS = Object.freeze([GUILD_RANK_MASTER, GUILD_RANK_OFFICER, GUILD_RANK_MEMBER, GUILD_RANK_RECRUIT]);

/** EVERY RANK'S ACTS, in the order a member meets them - `{ table, power, words }`; `{ any: true, words }` for what every
 *  member may do whatever the tables say (pin a note: guildBoard.js; put materials into the guild Stores and take one's
 *  own back: writLaw.js guildTakeMay); `{ rule, words }` an act a writ law's rule gives (RULES); `{ master: true, words }`
 *  an act the service gives the guildmaster by rank alone (a Charter given up: seatTurning.js relinquishSeat; a Sellsword
 *  hired: seatBattles.js hireSellsword; any writ or contract withdrawn: writs.js and contracts.js mayWithdraw); and
 *  `{ vault: true }` the rank's place at the vault by default (VAULT_RANK_DEFAULTS - its own words, guildVaultActsOf). */
/** @type {readonly Readonly<{ table?: string, power?: string, any?: boolean, master?: boolean, rule?: string, vault?: boolean, words?: string }>[]} */
export const GUILD_RANK_ACTS = Object.freeze([
  Object.freeze({ table: 'guild', power: 'deposit', words: 'put gold and silver into the treasuries' }),
  Object.freeze({ vault: true }),
  Object.freeze({ any: true, words: 'pin notes on the guild\'s board' }),
  Object.freeze({ any: true, words: 'put materials into the guild Stores, and take their own back out' }),
  Object.freeze({ rule: 'deliver', words: 'fill the guild\'s own writs for their pay' }),
  Object.freeze({ rule: 'paid', words: 'be paid by the guild\'s own contracts' }),
  Object.freeze({ table: 'guild', power: 'invite', words: 'invite new members, and pin the guild\'s call for them on a town\'s Notice Board' }),
  Object.freeze({ table: 'guild', power: 'promote', words: 'promote and demote the ranks below their own' }),
  Object.freeze({ table: 'guild', power: 'remove', words: 'remove a member of a lower rank' }),
  Object.freeze({ table: 'hall', power: 'hallEntry', words: 'choose who may enter the hall' }),
  Object.freeze({ table: 'hall', power: 'decorate', words: 'decorate the hall, its yard and its outside' }),
  Object.freeze({ table: 'hall', power: 'notes', words: 'take down anyone\'s note on the guild\'s board' }),
  Object.freeze({ table: 'writ', power: 'postWrit', words: 'post guild writs and contracts (Officers within the weekly budget the guildmaster sets) and withdraw the ones they posted' }),
  Object.freeze({ table: 'writ', power: 'storesWithdraw', words: 'take any materials out of the guild Stores' }),
  Object.freeze({ table: 'seat', power: 'pledge', words: 'pledge the guild to a seat in the Muster' }),
  Object.freeze({ table: 'levers', power: 'levers', words: 'run a held seat: its Tithe, Edict, battle window, Works, fealty and Pacts' }),
  Object.freeze({ table: 'guild', power: 'withdraw', words: 'take gold and silver out of the treasuries' }),
  Object.freeze({ table: 'writ', power: 'writBudget', words: 'set the Officers\' weekly silver budget for guild writs and contracts' }),
  Object.freeze({ master: true, words: 'withdraw any guild writ or contract' }),
  Object.freeze({ table: 'seat', power: 'tribute', words: 'pay Tribute at the seat the guild pledged' }),
  Object.freeze({ master: true, words: 'hire Sellswords for the guild\'s battles' }),
  Object.freeze({ master: true, words: 'give a held Charter up' }),
  Object.freeze({ table: 'hall', power: 'hall', words: 'buy and sell the hall' }),
  Object.freeze({ table: 'hall', power: 'heraldry', words: 'choose the guild\'s arms' }),
  Object.freeze({ table: 'guild', power: 'vaultGrant', words: 'grant or take back each member\'s use of the vault' }),
  Object.freeze({ table: 'guild', power: 'renameRanks', words: 'rename the ranks' }),
  Object.freeze({ table: 'guild', power: 'rename', words: 'give the guild a new name, for a price' }),
  Object.freeze({ table: 'guild', power: 'handOver', words: 'hand the guild on' }),
  Object.freeze({ table: 'guild', power: 'disband', words: 'disband it' }),
]);

/** The ranks a row's act is a rank's, off its own table or rule at the call (the vault's row: every rank with a place). */
export function guildActRanks(/** @type {any} */ row) {
  if (row?.any) return [...RANKS];
  if (row?.master) return [GUILD_RANK_MASTER];
  if (row?.vault) return RANKS.filter((r) => guildVaultActsOf(r).length > 0);
  if (typeof row?.rule === 'string') { const may = /** @type {any} */ (RULES)[row.rule]; return typeof may === 'function' ? RANKS.filter((r) => may(r)) : []; }
  if (row?.table === 'levers') return [...SEAT_LEVER_RANKS];
  const table = /** @type {Record<string, readonly number[]>} */ (/** @type {any} */ (TABLES)[row?.table] ?? {});
  return Object.hasOwn(table, row?.power) ? [...table[row.power]] : [];
}

/** A rank's place at the vault by default (VAULT_RANK_DEFAULTS), `{ level, limit }`, or null. */
const vaultDefaultOf = (/** @type {number} */ rank) => /** @type {Record<number, { level: string, limit: number }>} */ (VAULT_RANK_DEFAULTS)[rank] ?? null;
/** A take's limit in words: "10 a day", "as many as they like" (0, none). */
const takeWords = (/** @type {number} */ limit) => (limit > 0 ? `${limit} a day` : 'any number');   // AUDIT GUILD3 W11: the vault grant's own words (guildVaultLaw.js vaultStandingText)
/** @typedef {{ key: string, words: string, limit?: number }} Act */
/** A RANK'S PLACE AT THE VAULT BY DEFAULT, as acts: `put pieces into the vault` where it puts in or takes out, and `take
 *  pieces out of the vault, 10 a day` where it takes out - none for a rank with no place (C5: said on its own line, so a
 *  rank that puts no gold in still has its vault said). */
export function guildVaultActsOf(/** @type {number} */ rank) {
  const d = vaultDefaultOf(rank);
  /** @type {Act[]} */
  const out = [];
  if (d?.level === 'deposit' || d?.level === 'withdraw') out.push({ key: 'vault-in', words: 'put pieces into the vault' });
  if (d?.level === 'withdraw') out.push({ key: 'vault-out', words: `take pieces out of the vault, ${takeWords(d.limit)}`, limit: d.limit });
  return out;
}

/** EVERY ACT RANK `rank` MAY DO, `[{ key, words }]` in GUILD_RANK_ACTS' order. */
function actsOf(/** @type {number} */ rank) {
  /** @type {Act[]} */
  const out = [];
  GUILD_RANK_ACTS.forEach((row, i) => {
    if (row.vault) { out.push(...guildVaultActsOf(rank)); return; }
    if (guildActRanks(row).includes(rank)) out.push({ key: `act-${i}`, words: /** @type {string} */ (row.words) });
  });
  return out;
}
/** Every act rank `rank` may do, in words, in GUILD_RANK_ACTS' order. */
export const guildRankActsOf = (/** @type {number} */ rank) => actsOf(rank).map((a) => a.words);

/** A rank's acts as one sentence: "Put gold and silver into the treasuries; put pieces into the vault; ...". */
export function guildRankActsText(/** @type {number} */ rank) {
  const acts = guildRankActsOf(rank);
  if (!acts.length) return 'Nothing yet.';
  const said = acts.join('; ');
  return `${said.charAt(0).toUpperCase()}${said.slice(1)}.`;
}

/** Whether act `a` holds all of act `b`: the same act - a vault's take with no smaller a day's limit. */
const covers = (/** @type {Act} */ a, /** @type {Act} */ b) => a.key === b.key
  && (a.key !== 'vault-out' || a.limit === 0 || (b.limit !== 0 && Number(a.limit) >= Number(b.limit)));
/** A rank by its guild's own name for it - "the Officer", "The Unsworn" as written (C7: no article guessed). */
const theRank = (/** @type {string} */ name) => (/^the\s/i.test(name) ? name : `the ${name}`);
/** The most a line says "except ..." before it says its rank's whole list. */
const EXCEPT_MAX = 2;
/**
 * THE LINES OVER ANY ACTS (`acts(rank)` - `[{ key, words, limit? }]`): each rank's said ON TOP OF the rank below it -
 * "Everything the Officer may, and: take gold and silver out ..."; where it lacks one or two of that rank's, "Everything the
 * Member may except fill the guild's own writs for their pay or be paid by the guild's own contracts, and: ..." (W3); "The
 * same as the Recruit." where it holds the same; its whole list where it lacks more. A vault's take with a greater limit
 * holds a lesser. Pure over its acts, so test/net/audit_guild3.test.js fuzzes it (C5).
 * @param {(rank: number) => Act[]} acts @param {readonly string[]} [names]
 */
export function rankLinesOf(acts, names = GUILD_RANK_NAMES) {
  const nameOf = (/** @type {number} */ r) => String(names?.[r] ?? GUILD_RANK_NAMES[r]);
  return RANKS.map((rank, i) => {
    const all = acts(rank).map((a) => a.words);
    let text = all.length ? `${all.join('; ').charAt(0).toUpperCase()}${all.join('; ').slice(1)}.` : 'Nothing yet.';
    const below = i + 1 < RANKS.length ? RANKS[i + 1] : null;
    if (below !== null) {
      const mine = acts(rank), theirs = acts(below);
      const more = mine.filter((a) => !theirs.some((t) => t.key === a.key && t.words === a.words)).map((a) => a.words);
      const less = theirs.filter((t) => !mine.some((a) => covers(a, t))).map((t) => t.words);
      const them = theRank(nameOf(below));
      if (!less.length) text = more.length ? `Everything ${them} may, and: ${more.join('; ')}.` : `The same as ${them}.`;
      else if (less.length <= EXCEPT_MAX && more.length) text = `Everything ${them} may except ${less.join(' or ')}, and: ${more.join('; ')}.`;
    }
    return { rank, name: nameOf(rank), text };
  });
}
/** THE MEMBERS PAGE'S LIST: `[{ rank, name, text }]`, the guildmaster first, over the guild's own acts (rankLinesOf).
 *  `names` the guild's rank names (GUILD_RANK_NAMES where it has none). @param {readonly string[]} [names] */
export const guildRankLines = (names = GUILD_RANK_NAMES) => rankLinesOf(actsOf, names);

/** What the list closes on: a member's vault place is the guildmaster's to change, member by member. */
export const GUILD_RANK_ACTS_NOTE = 'The guildmaster can grant or remove each member\'s vault access on this page.';
