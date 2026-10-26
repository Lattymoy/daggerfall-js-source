// @ts-check
// SUMMON-REPAIR (FIELD BUGS 2026-10-14, bible/01-Overview/bugs/Field-Bugs-2026-10-14.md SUMMON-OFFER; Mac, asked how to mend
// the reporter's save: "Operator tool"): A STAFF REPAIR OF ONE REALM CHARACTER - ITS LAW, the one file the account
// service's review act (server-account/src/review.js `repair`) and the operator's tool (tools/realmReview.mjs) read.
//
// Before SUMMON-OFFER a Daedra summoning whose quest could not be made in the player's region took the gold and set the
// prince's Summoned flag (FactionFile.Flags) and offered nothing - and with the flag set he never offers his quest again.
// Nothing in a save tells that flag from one a refused offer set, so no load can mend it: staff mend the one character,
// by hand. A repair names a faction and one of FactionFile's flag bits to clear on it, the gold to give back, and the
// operator's ticket - its name for this one act, so the same repair asked twice mends once.
//
// THE GOLD COMES BACK AS THE GAME'S OWN LETTER OF CREDIT (net/realm/realmGoldLaw.js creditSave's `letter`, GUILD-LETTER's way):
// a summoning's price is paid as deductGold pays it - in letters when the coins do not cover it - and 100,000 gold in
// coin is 250 kg in the pack. A letter weighs nothing and spends as gold.
//
// PURSE-MEND (FIELD BUGS 2026-10-19f; a player's private report - a purse read -8,000,000 after a sale of a lot worth
// over 18 million, the carry weight -19,995 kg): A PURSE A WRAPPED SALE LEFT BELOW NOTHING, MENDED. TRADE-WRAP (FIELD BUGS
// 2026-10-18b) stopped CalculateTradePrice wrapping int32, so no sale pays below nothing again - but a record it already
// paid that way carries the purse as it is, the judge holds its trade on it (server-account/src/judge.js, the `gold`
// finding), and every payment after it spends the letters first (court.js deductGold: the coins never cover a price).
// No load can tell what the purse should have been, so staff reckon it from the lot and mend the one character: the
// purse set to nothing, and what it is owed given as ONE LETTER OF CREDIT - the trade window's own payment for a sum the
// pack cannot carry (systems/tradeModes.js sellProceeds; DaggerfallTradeWindow's sell arm), which is how the honest sale of
// a lot that big pays. Never a purse of coin: a million coins weigh 2,500 kg (inventory.js GOLD_PIECE_WEIGHT_KG).
//
// STAFF-SET-BANK (2026-10-23, mob: "we need a set bank setting"; asked before, "how to i adjust a lpayers bank?", and
// nothing could): A REALM CHARACTER'S BANK, SET BY STAFF. Online a character keeps ONE account, the Empire's, at
// Daggerfall's index (systems/banking.js EMPIRE-ACCOUNT; realm/realmGoldLaw.js REALM_EMPIRE_ACCOUNT), and the Staff
// Panel's profile says the bank as one number - every account's gold together (server-account/src/staffPlayers.js
// saveViewOf `banks`, which reads it by bankTotalOf below). Staff set that number: the record's bank, still the total
// they read (played since, or the wrong character, otherwise), becomes the Empire account holding `gold` and every other
// branch holding none - foldEmpireAccounts' own rule, every branch's gold moved into the Empire's whatever its sign, then
// the Empire's set (and a count of no number, which no fold moves and the profile counts as none, at nothing too: a set
// leaves the bank the profile says and nothing beside it). A loan stays where it stands, as the fold leaves it.
//
// GUILD-LETTER-FIX (2026-10-25, mob: a player's level 10 vampire never had the Dark Brotherhood's letter - its tally at
// InviteSent, no letter pending, The Acceptance Test nowhere in the save; "do it"): A CRIME GUILD'S LETTER, SENT AGAIN OR
// CALLED OFF BY STAFF. DFU parks the tally before the quest starts (systems/crimeGuilds.js DB-LETTER), so a letter whose
// quest could not be made spent the invitation for good, and nothing in a save tells that from a test the player failed:
// staff send the one character's letter again. `send` sets the tally at the guild's target and the letter due, so the
// game's own handleStartingCrimeGuildQuests sends it the next minute the player is outside (the short wait online) - never
// to a member of the guild, a character whose initiation quest the save still holds, or one with a letter on its way.
// `cancel` calls a letter off: the tally parked at InviteSent with none pending, so that guild's letter never comes until
// staff send it (a player who never wanted it).

import { FACTION_FLAGS } from '../formats/factionFile.js';
import { POST_BATCH_RE } from './postLaw.js';
import { creditSave, REALM_EMPIRE_ACCOUNT } from './realm/realmGoldLaw.js';   // STAFF-SET-BANK: and the Empire's account
import { GOLD_INT_MAX } from '../systems/item/itemLaw.js';   // PURSE-MEND: one letter's worth is one int, as the law reads it
import { INVITE_SENT, THIEVES_GUILD_TALLY_TARGET, DARK_BROTHERHOOD_TALLY_TARGET, THIEVES_GUILD_INITIATION_QUEST, DARK_BROTHERHOOD_INITIATION_QUEST, THIEVES_GUILD_FACTION_ID, DARK_BROTHERHOOD_FACTION_ID } from '../systems/crimeGuilds.js';   // GUILD-LETTER-FIX: the letters' own law

/** The bits a repair may clear: FactionFile.Flags, every one, and nothing else. @type {readonly number[]} */
export const REPAIR_FLAGS = Object.freeze(Object.values(FACTION_FLAGS));
/** The most gold one repair gives back. The dearest price this repair exists for is a summoning at the summoner's worst
 *  regard (daedraSummoning.js summoningCost(-100), 300,000); a refund past a million is no repair a ticket names. */
export const REPAIR_GOLD_MAX = 1_000_000;
/** A FACTION.TXT id's bound - the file's ids are small positive numbers; whether this one exists is the record's to say. */
export const REPAIR_FACTION_MAX = 0xffff;
/** An operator's ticket - the repair's name, once a character (lower-case words and hyphens, a post's send's shape:
 *  `fb1014-summon-offer`). */
export const REPAIR_TICKET_RE = POST_BATCH_RE;

/**
 * A REPAIR AS ASKED, checked - `{ ticket, faction, flag, gold }`, or null: a ticket of the shape, a faction id, one of
 * REPAIR_FLAGS, and 0 to REPAIR_GOLD_MAX gold (0: no gold back, the flag alone). Whether the faction is the record's and
 * carries the bit is the record's to say (applyRepair).
 * @param {any} v
 * @returns {{ ticket: string, faction: number, flag: number, gold: number } | null}
 */
export function repairOf(v) {
  if (!v || typeof v !== 'object') return null;
  const { ticket, faction, flag, gold } = v;
  if (typeof ticket !== 'string' || !REPAIR_TICKET_RE.test(ticket)) return null;
  if (!Number.isSafeInteger(faction) || faction < 1 || faction > REPAIR_FACTION_MAX) return null;
  if (!REPAIR_FLAGS.includes(flag)) return null;
  if (!Number.isSafeInteger(gold) || gold < 0 || gold > REPAIR_GOLD_MAX) return null;
  return { ticket, faction, flag, gold };
}

/**
 * THE REPAIR ON A SAVE, in place (a realm record, server-account/src/realm.js prepareRealmRecord's `change`): the flag
 * cleared on the faction's row of the save's faction store (save.js snapshotFactionRep: `ids`, `flags` beside them) and
 * the gold given back as a letter of credit at the front of the pack. Answers `{ was }` - the faction's flags before -
 * or the refusal's word, nothing changed: 'repair-no-faction', the save holds no such faction; 'repair-not-set', its
 * faction does not carry the bit - a repair undoes a flag that stands, so one aimed at the wrong character (an account
 * holds up to six) mends nothing and gives nothing.
 * @param {any} save @param {{ faction: number, flag: number, gold: number }} repair
 * @returns {{ was: number } | 'repair-no-faction' | 'repair-not-set'}
 */
export function applyRepair(save, { faction, flag, gold }) {
  const store = save?.factionRep;
  const at = Array.isArray(store?.ids) && Array.isArray(store?.flags) ? store.ids.indexOf(faction) : -1;
  if (at < 0 || !Number.isSafeInteger(store.flags[at])) return 'repair-no-faction';
  const was = store.flags[at];
  if ((was & flag) === 0) return 'repair-not-set';
  store.flags[at] = was & ~flag;
  if (gold > 0) creditSave(save, gold, { letter: true });
  return { was };
}

/**
 * PURSE-MEND: A MEND AS ASKED, checked - `{ ticket, was, gold }`, or null: a ticket of the repair's shape, `was` the purse
 * the staff reckoned from - a whole number below nothing, the only purse there is to mend - and `gold`, what the character
 * is owed, 0 to GOLD_INT_MAX (one letter's worth; 0: the purse set to nothing, no letter). Whether the record's purse is
 * still that one is the record's to say (applyPurseMend).
 * @param {any} v
 * @returns {{ ticket: string, was: number, gold: number } | null}
 */
export function purseMendOf(v) {
  if (!v || typeof v !== 'object') return null;
  const { ticket, was, gold } = v;
  if (typeof ticket !== 'string' || !REPAIR_TICKET_RE.test(ticket)) return null;
  if (!Number.isSafeInteger(was) || was >= 0) return null;
  if (!Number.isSafeInteger(gold) || gold < 0 || gold > GOLD_INT_MAX) return null;
  return { ticket, was, gold };
}

/**
 * PURSE-MEND ON A SAVE, in place (a realm record, applyRepair's way): the purse below nothing set to nothing, and the gold
 * owed given as one letter of credit at the front of the pack - SET, never added to what the purse holds (a purse of
 * -8,000,000 given 8,000,000 is nothing, and the letters it spent stay spent). Answers `{ was }` - the purse before - or
 * the refusal's word, nothing changed: 'mend-not-negative', the record's purse is not below nothing (mended already, or
 * the wrong character); 'mend-moved', it is below nothing but not the purse the mend was reckoned from (played since, or
 * the wrong character - read it again).
 * @param {any} save @param {{ was: number, gold: number }} mend
 * @returns {{ was: number } | 'mend-not-negative' | 'mend-moved'}
 */
export function applyPurseMend(save, { was, gold }) {
  const purse = save?.goldPieces;
  if (!Number.isSafeInteger(purse) || purse >= 0) return 'mend-not-negative';
  if (purse !== was) return 'mend-moved';
  save.goldPieces = 0;
  if (gold > 0) creditSave(save, gold, { letter: true });
  return { was: purse };
}

/**
 * STAFF-SET-BANK: THE BANK AS THE STAFF PANEL SAYS IT - every account's gold together, a count that is no finite number
 * counted none (server-account/src/staffPlayers.js saveViewOf `banks` reads it here, so the total staff read and the one
 * a set is checked against are one sum). A branch below nothing counts below nothing. REVIEW (2026-10-23): the sum held
 * to the safe integers, as judge.js wealthOf holds the wealth - a bank a modified client wrote past them, or summed past
 * every number (1e308 twice is Infinity, which JSON sends as null), is said at the bound: a total the profile can send,
 * staff can name and the act's row can hold (an int64 past them reads back as no JavaScript number). Two banks past the
 * bound read alike, so a set over either is the one staff asked.
 * @param {any} save
 */
export const bankTotalOf = (save) => Math.min(Number.MAX_SAFE_INTEGER, Math.max(-Number.MAX_SAFE_INTEGER, (Array.isArray(save?.bankAccounts) ? save.bankAccounts : [])
  .reduce((/** @type {number} */ s, /** @type {any} */ a) => s + (typeof a?.accountGold === 'number' && Number.isFinite(a.accountGold) ? a.accountGold : 0), 0)));

/**
 * STAFF-SET-BANK: A BANK SET AS ASKED, checked - `{ ticket, was, gold }`, or null: a ticket of the repair's shape, `was`
 * the bank total staff read (bankTotalOf - any finite number: a branch below nothing makes it less than nothing, and a
 * bank a modified client wrote past every safe integer, the one staff most need to set, is said at the bound), and `gold`
 * the bank it is to hold, 0 to GOLD_INT_MAX (DFU's `int accountGold`, one int's worth). Whether the record's bank is still
 * that total is the record's to say (applyBankSet).
 * @param {any} v
 * @returns {{ ticket: string, was: number, gold: number } | null}
 */
export function bankSetOf(v) {
  if (!v || typeof v !== 'object') return null;
  const { ticket, was, gold } = v;
  if (typeof ticket !== 'string' || !REPAIR_TICKET_RE.test(ticket)) return null;
  if (typeof was !== 'number' || !Number.isFinite(was)) return null;
  if (!(Number.isSafeInteger(gold) && gold >= 0 && gold <= GOLD_INT_MAX)) return null;
  return { ticket, was, gold };
}

/**
 * STAFF-SET-BANK ON A SAVE, in place (a realm record, applyRepair's way): every branch's gold folded into the Empire's
 * account (banking.js foldEmpireAccounts' rule - the Worker does not bundle banking.js - and a branch's count of no number
 * set at nothing beside it) and the Empire's account SET to `gold`, so the bank's total is `gold`; every loan, its due
 * date and its default where they stand. Answers `{ was }` - the total before - or the refusal's word, nothing changed:
 * 'bank-none', the record keeps no Empire account (a save written before its accounts were minted, or a short
 * table: the game mints the accounts as a character loads - save.js restorePlayer, createBankAccounts - and its next
 * checkpoint carries them, so play once, then set; the service never invents the table's shape); 'bank-moved', its total
 * is not the one staff read (played since, or the wrong character - read it again).
 * @param {any} save @param {{ was: number, gold: number }} set
 * @returns {{ was: number } | 'bank-none' | 'bank-moved'}
 */
export function applyBankSet(save, { was, gold }) {
  const accounts = Array.isArray(save?.bankAccounts) ? save.bankAccounts : null;
  const empire = accounts?.[REALM_EMPIRE_ACCOUNT];
  if (!empire || typeof empire !== 'object') return 'bank-none';
  const total = bankTotalOf(save);
  if (total !== was) return 'bank-moved';
  // the fold's moves, whose sum the set below takes the place of: every other branch at nothing - a count of no number too
  accounts.forEach((/** @type {any} */ a, /** @type {number} */ i) => {
    if (i !== REALM_EMPIRE_ACCOUNT && a && typeof a === 'object' && a.accountGold != null && a.accountGold !== 0) a.accountGold = 0;
  });
  empire.accountGold = gold;
  return { was: total };
}

/** GUILD-LETTER-FIX: the two letters a fix names - each guild's tally and clock in the save (save.js snapshotPlayer, CG2),
 *  its target, its initiation quest, its faction and its guild's name as a membership row keeps it (guilds.js joinGuild). */
export const GUILD_LETTERS = Object.freeze({
  db: Object.freeze({ tally: 'darkBrotherhoodRequirementTally', clock: 'timeForDarkBrotherhoodLetter', target: DARK_BROTHERHOOD_TALLY_TARGET, quest: DARK_BROTHERHOOD_INITIATION_QUEST, faction: DARK_BROTHERHOOD_FACTION_ID, guild: 'DarkBrotherhood' }),
  tg: Object.freeze({ tally: 'thievesGuildRequirementTally', clock: 'timeForThievesGuildLetter', target: THIEVES_GUILD_TALLY_TARGET, quest: THIEVES_GUILD_INITIATION_QUEST, faction: THIEVES_GUILD_FACTION_ID, guild: 'ThievesGuild' }),
});
/** The two acts, as the row's `flag` keeps them. */
export const GUILD_LETTER_OPS = Object.freeze({ send: 1, cancel: 2 });

/**
 * GUILD-LETTER-FIX: A LETTER FIX AS ASKED, checked - `{ ticket, guild, op }`, or null: a ticket of the repair's shape, a
 * guild of GUILD_LETTERS (`db`, `tg`) and an act of GUILD_LETTER_OPS (`send`, `cancel`).
 * @param {any} v
 * @returns {{ ticket: string, guild: 'db' | 'tg', op: 'send' | 'cancel' } | null}
 */
export function guildLetterOf(v) {
  if (!v || typeof v !== 'object') return null;
  const { ticket, guild, op } = v;
  if (typeof ticket !== 'string' || !REPAIR_TICKET_RE.test(ticket)) return null;
  if (typeof guild !== 'string' || !Object.hasOwn(GUILD_LETTERS, guild)) return null;
  if (typeof op !== 'string' || !Object.hasOwn(GUILD_LETTER_OPS, op)) return null;
  return { ticket, guild: /** @type {'db' | 'tg'} */ (guild), op: /** @type {'send' | 'cancel'} */ (op) };
}

/** Whether the save's guild memberships hold `guild` - the mortal book, the vampire's, or a book from before the two
 *  (guilds.js membershipsFor): a vampire's guilds are the vampire book's, and a member in either is a member. */
const memberOf = (/** @type {any} */ save, /** @type {string} */ guild) => {
  const store = save?.guildMemberships;
  if (!store || typeof store !== 'object') return false;
  const books = Object.hasOwn(store, 'mortal') || Object.hasOwn(store, 'vampire') ? [store.mortal, store.vampire] : [store];
  return books.some((b) => b && typeof b === 'object' && Object.values(b).some((m) => m && typeof m === 'object' && m.guild === guild));
};
/** Whether the save's quest machine holds the quest by name - running, ended and not yet dropped, or waiting to start. */
const questHeld = (/** @type {any} */ save, /** @type {string} */ name) => {
  const m = save?.quest?.machine;
  return [m?.quests, m?.toInvoke].some((list) => Array.isArray(list) && list.some((q) => String(q?.questName ?? '').toUpperCase() === name));
};

/**
 * GUILD-LETTER-FIX ON A SAVE, in place (applyRepair's way). `send`: the tally set at the guild's target and the letter
 * due (its clock at 1 - every minute after the epoch is past it, so the game's next outside minute sends it). `cancel`:
 * the tally parked at InviteSent and no letter pending. Answers `{ was }` - the tally before - or the refusal's word,
 * nothing changed: 'letter-member', the character is in the guild already (either book); 'letter-quest', the save still
 * holds the initiation quest (running, or ended and kept); 'letter-pending', a letter is already on its way (a send);
 * 'letter-none', no letter is coming and none can (a cancel of a tally already parked with none pending).
 * @param {any} save @param {{ guild: 'db' | 'tg', op: 'send' | 'cancel' }} fix
 * @returns {{ was: number } | 'letter-member' | 'letter-quest' | 'letter-pending' | 'letter-none'}
 */
export function applyGuildLetter(save, { guild, op }) {
  const g = GUILD_LETTERS[guild];
  const was = Number.isSafeInteger(save?.[g.tally]) ? save[g.tally] : 0;
  const pending = Number.isSafeInteger(save?.[g.clock]) && save[g.clock] > 0;
  if (op === 'send') {
    if (memberOf(save, g.guild)) return 'letter-member';
    if (questHeld(save, g.quest)) return 'letter-quest';
    if (pending) return 'letter-pending';
    save[g.tally] = g.target;
    save[g.clock] = 1;
    return { was };
  }
  if (was === INVITE_SENT && !pending) return 'letter-none';
  save[g.tally] = INVITE_SENT;
  save[g.clock] = 0;
  return { was };
}

/**
 * A FLAG AS AN OPERATOR TYPES IT - `0x40`, `64` or its FactionFile name (`Summoned`) - as its number, or null.
 * @param {unknown} raw
 */
export function repairFlagOf(raw) {
  const s = String(raw ?? '').trim();
  if (Object.hasOwn(FACTION_FLAGS, s)) return FACTION_FLAGS[/** @type {keyof typeof FACTION_FLAGS} */ (s)];
  const n = /^0x[0-9a-f]+$/i.test(s) ? parseInt(s, 16) : /^[0-9]+$/.test(s) ? Number(s) : NaN;
  return REPAIR_FLAGS.includes(n) ? n : null;
}
