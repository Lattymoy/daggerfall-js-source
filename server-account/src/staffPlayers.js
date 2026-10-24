// @ts-check
// ═══════════════════════════════════════════════════════════════════
// STAFF-PANEL3-PLAYERS (2026-10-22, mob: "do all 6"; design doc "DFO Staff Panel: design", build step 3, "Players and
// nameplates") - THE PANEL'S PLAYERS: a search over every account, online or not, by handle or character name (mob,
// 03:23Z); one account's profile, read tab by tab; its devices and Sign out everywhere; and the rename of an offensive
// handle or character name (the last was done by hand, migration 0134). Admins alone: Moderators have no profile screen
// (mob, 03:03Z: Moderators get "only chat report notifications with Mute and Ban").
//
// NOTHING NEW IS JUDGED (design doc, "Built on the save judge"; mob, 09:22Z: "use the validators the server already has").
// Every flag a profile shows is one the judge stored at a checkpoint - the law finding standing on a character's row
// (`law_sig`, verdict.js), the copies and claims the ledger keeps (item_dupes, item_uids, ledger.js), the gains past the
// bucket (`measure` and `budget` findings, review.js's gains) - never a check of this module's own. A save is opened with
// the service's own codec (realm.js realmSaveTextOf) and its pieces walked as the judge walks them (possessedItemLists,
// systems/item/possessedItems.js). A save answer names its sequence and when it landed: it is what the player's game
// last wrote, not live truth (design doc, Weak spots: "Profiles show the player's last save").
//
// WHAT GOES FIRST (design doc: "A player's profile shows a count badge on each tab that has something open, and opens on
// the most urgent tab"): profileBadges - each tab's count of what is open, a level and the words that say why, and the tab
// the profile opens on. The weights are starting numbers to tune, not measured ones.
//
// EVERY READ IS WRITTEN DOWN (design doc, Weak spots: "A 'view' is opening a profile tab or screen, logged once per open"):
// a search, a tab, a device list - once in READ_ONCE_S a member, a player and a view. Every act with its outcome; a refused
// or failed one `failed`, with its word.
//
// SERVER LOAD (design doc, "Server load"): the search reads by index - the handle's, a character's name's (migration
// 0151) and the last play beat's (players.played_at) - a profile's facts are one batch, a save is opened once a write
// (`kept`: by its object's key, and every write is a new object, so a kept view never goes stale), the trades read by
// migration 0151's indexes, and every list pages (`from`, answered `next`).
import { displayName, devicesOf, closeAllSessions, handleRefusal, wornNameRefusal, isMuted } from './accounts.js';
import { findAccount, strikesOf, isBanned } from './sanctions.js';
import { canModerate, handleList } from './titles.js';
import { REALM_ID_RE, REALM_PLAYING_S, realmSaveTextOf, realmNameOf, mustChange } from './realm.js';
import { possessedItemLists, ledgerKeyOf } from './judge.js';
import { receiptOf } from './review.js';
import { REALM_TRADE_KEEP_S } from './realmTrade.js';
import { itemWorth } from '../../src/systems/item/itemLaw.js';
import { liquidWorthOf, REALM_LETTER_TEMPLATE } from '../../src/net/realm/realmGoldLaw.js';
import { bankTotalOf } from '../../src/net/repairLaw.js';   // STAFF-SET-BANK: the profile's bank, the one sum a bank set reads
import { STAT_KEYS_ORDER } from '../../src/systems/statMods.js';
import { PLAY_GRACE_S } from '../../src/net/playClock.js';
import { BAN_FOREVER } from '../../src/net/safety/safetyLaw.js';
import { isHandleShaped } from '../../src/net/handleShape.js';
import { ID_RE } from '../../src/net/identityToken.js';

export const PLAYER_ROUTES = Object.freeze(['/v1/staff/players', '/v1/staff/player', '/v1/staff/player/devices', '/v1/staff/player/signout',
  '/v1/staff/player/rename']);
/** A profile's tabs, in their usual order - a tie on urgency goes to the earlier. */
export const PLAYER_TABS = Object.freeze(['overview', 'skills', 'equipment', 'inventories', 'market', 'trades', 'economy', 'history']);
/** STAFF-BANNED: the search's ban filter - the first the default (mob: "player that are banned need to be taken out of
 *  staff panel list of players"). */
export const BAN_FILTERS = Object.freeze(['not-banned', 'banned', 'all']);
/** Rows one page of a list answers; an inventory's, ITEMS_PAGE. */
export const PLAYERS_PAGE = 25;
export const ITEMS_PAGE = 50;
/** A read of one view of one player is written once in this, whatever its pages. */
export const READ_ONCE_S = 10 * 60;
/** The findings a tab counts as open - the gains, the history - are this recent. */
export const OPEN_WINDOW_S = 7 * 24 * 3600;
/** The most days the Economy tab's wealth by the hour reads (design doc, Server load: "cap the day range"). */
export const ECONOMY_DAYS_MAX = 30;
/** Saves' views kept in the isolate, by object key. */
export const SAVES_KEPT = 8;
/** The places a piece is answered in: the save's own lists (the pack, the Materials Bag, the wagon, the furnisher's and the
 *  repairer's, a home's chests and storage and what is set out there, and `other` - a boat's hold, a companion's pack), and
 *  the service's (the profession Stores, a guild vault's deposits, the market's escrow and deliveries, gold at the market).
 *  `letters` filters the letters of credit wherever they lie. */
export const ITEM_PLACES = Object.freeze(['carried', 'bag', 'wagon', 'furnisher', 'repairer', 'home', 'other', 'stores', 'vault', 'escrow', 'deliveries', 'market-gold', 'letters']);
/** MIGRATION 0134'S COPIES OF A HANDLE: every column that keeps an account's name as it was, which a rename writes anew
 *  (pinned to the migration's list by test/server/staffpanel3players.test.js). The moderation record (mod_*,
 *  private_reports, players.muted_by) and the panel's own audit keep what was said and done as it was.
 *  STAFF-PANEL3-PLAYERS FIX (flaw review, "Handle rename rewrites other accounts' rows"): each is `[table, column, scope]`,
 *  `scope` the row's own account column (?3, the renamed account's id) wherever the table keeps one beside the name, so a
 *  copy is this account's and no other's. A copy with no scope keeps no account id beside the name; it holds only
 *  displayName (a handle, unique, or a guest's name, which a handle never matches). 0134 also named six columns that hold
 *  no handle at all, left out here: renown_tracks.name (a character's name, as the client sends it), guild_writs and
 *  guild_contracts' closed_by (an account's id), guild_fealty's offered_by and broken_by and guild_pacts.offered_by (a
 *  guild's id). */
export const NAME_COPIES = Object.freeze([
  ['letters', 'from_name', 'from_id = ?3'], ['homes', 'owner_name', 'player = ?3 AND guild_id IS NULL'], ['home_rooms', 'tenant_name', 'tenant = ?3'],
  ['board_notes', 'author_name', 'author = ?3'], ['board_notices', 'author_name', 'author = ?3'], ['guilds', 'moved_by'], ['guild_members', 'name', 'player = ?3'],
  ['guild_invites', 'by_name'], ['guild_ledger', 'who'], ['guild_notes', 'author_name', 'author = ?3'], ['guild_renames', 'who'],
  ['guild_vault', 'dep_name', 'dep_player = ?3'], ['guild_vault_log', 'who'], ['guild_writ_budgets', 'set_by'], ['guild_prof_stores', 'moved_by'],
  ['guild_store_ledger', 'who'],
  // shortcut: a line's `who` is a name only on some kinds (a material's, a product's, a character's on others), so the
  // account's own line naming a material spelled as its old handle is renamed too; name the kinds if that ever matters
  ['marks_ledger', 'who', 'actor = ?3'],
  ['town_seat_pledges', 'set_by'], ['town_seat_windows', 'set_by'], ['town_seat_hires', 'by_name'], ['town_seat_edicts', 'set_by'],
  ['poi_revs', 'author_name', 'author = ?3'], ['poi_revs', 'reviewer_name', 'reviewer = ?3'], ['poi_shelf', 'by_name', 'by = ?3'], ['poi_shelf', 'updated_by'],
  ['poi_shelf', 'gone_by'],
]);
/** A character list read at most this many (D1 binds 100 a statement). */
const CHARS_READ_MAX = 90;

const LEVELS = Object.freeze(['low', 'medium', 'high']);
const str = (/** @type {unknown} */ v, n = 64) => (typeof v === 'string' ? v.slice(0, n) : null);
const num = (/** @type {unknown} */ v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const parse = (/** @type {unknown} */ t) => { try { return JSON.parse(String(t)); } catch { return null; } };
const arrayOf = (/** @type {unknown} */ x) => (Array.isArray(x) ? x : []);
const objectOf = (/** @type {unknown} */ x) => (x && typeof x === 'object' ? /** @type {Record<string, unknown>} */ (x) : {});
const marks = (/** @type {number} */ n, from = 1) => (n ? Array.from({ length: n }, (_, i) => `?${from + i}`).join(', ') : 'NULL');
const fromOf = (/** @type {unknown} */ v) => (Number.isSafeInteger(v) && /** @type {number} */ (v) > 0 ? /** @type {number} */ (v) : 0);
const plural = (/** @type {number} */ n, /** @type {string} */ one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Online now: a tab of the account beat within the play clock's grace (accounts.js creditPlay) - the service's word; the
 *  relay's own list is the live one. @param {any} p @param {number} nowS */
export const onlineNow = (p, nowS) => Number.isSafeInteger(p?.played_at) && nowS - p.played_at <= PLAY_GRACE_S;
/** A character's law finding stands: found, and not the one staff excused (verdict.js). @param {any} c */
const lawStands = (c) => c?.law_sig != null && c.law_sig !== c.law_excused;
/** A stored law finding that names a piece - the item law's (its list and place), a craft's or a forged id's - is the
 *  Equipment tab's; the rest (the level, attributes, skills, gold: judge.js characterFindings) the Skills tab's. @param {any} f */
export const isPieceFinding = (f) => f?.list != null || f?.code === 'provenance' || f?.code === 'uid';

/** EVERY HANDLE A ROLE OR TITLE LIST NAMES - any `*_HANDLES` the config holds (titles.js, staff.js OWNER_HANDLES), and the
 *  handles DISCORD_MODERATORS and OWNER_KEYS bind - folded as the lists fold them (design doc, Weak spots: "Rename can hand
 *  out power, because role lists are handles"). @param {any} env */
export function listedHandles(env) {
  const out = new Set();
  for (const [k, v] of Object.entries(env ?? {})) {
    if (k.endsWith('_HANDLES')) for (const h of handleList(v)) out.add(h);
    if (k === 'DISCORD_MODERATORS' || k === 'OWNER_KEYS') {
      for (const pair of String(v ?? '').split(',')) {
        const h = pair.split(':')[k === 'OWNER_KEYS' ? 0 : 1]?.trim().toLowerCase();
        if (h) out.add(h);
      }
    }
  }
  return out;
}

/**
 * WHAT GOES FIRST ON A PROFILE - each tab's count of what is open, its level and the words that say why, and `first`, the
 * tab it opens on: the highest level, then the most open, then the usual order; Overview when nothing is open.
 * @param {{ openCases: number, banned: boolean, muted: boolean, frozen: boolean, holds: number, charLaw: number, pieceLaw: number,
 *   copies: number, claims: number, reported: number, refusedHeld: number, budget: number, measure: number, findings: number }} f
 */
export function profileBadges(f) {
  const tab = (/** @type {number} */ count, /** @type {'low'|'medium'|'high'} */ level, /** @type {unknown[]} */ why) =>
    ({ count, level: count > 0 ? level : 'low', why: count > 0 ? /** @type {string[]} */ (why.filter(Boolean)) : [] });
  /** @type {Record<string, { count: number, level: string, why: string[] }>} */
  const tabs = {
    overview: tab(f.openCases + f.holds + (f.banned ? 1 : 0) + (f.frozen ? 1 : 0) + (f.muted ? 1 : 0),
      f.openCases || f.holds || f.banned || f.frozen ? 'high' : 'medium',
      [f.openCases && plural(f.openCases, 'open case'), f.holds && `${plural(f.holds, 'character')} held`, f.banned && 'banned', f.frozen && 'frozen', f.muted && 'muted']),
    skills: tab(f.charLaw, 'high', [`${plural(f.charLaw, 'law finding')} on the character`]),
    equipment: tab(f.pieceLaw, 'high', [`${plural(f.pieceLaw, 'law finding')} on pieces`]),
    inventories: tab(f.copies + f.claims, f.copies ? 'high' : 'medium', [f.copies && plural(f.copies, 'locked copy', 'locked copies'), f.claims && plural(f.claims, 'pending claim')]),
    market: tab(f.reported, 'medium', [plural(f.reported, 'reported listing')]),
    trades: tab(f.refusedHeld, 'medium', [`${plural(f.refusedHeld, 'trade')} refused on their hold`]),
    economy: tab(f.budget + f.measure, f.budget ? 'high' : 'medium', [f.budget && `${plural(f.budget, 'gain')} past the budget, held`, f.measure && `${plural(f.measure, 'gain')} past the budget, measured`]),
    history: tab(f.findings, 'low', [`${plural(f.findings, 'finding')} this week`]),
  };
  let first = 'overview';
  for (const t of PLAYER_TABS) {
    const b = tabs[t], a = tabs[first];
    const lb = LEVELS.indexOf(b.level), la = LEVELS.indexOf(a.level);
    if (b.count && (!a.count || lb > la || (lb === la && b.count > a.count))) first = t;
  }
  return { tabs, first };
}

/** ONE PIECE AS A ROW: where it lies, which list and place (`li`, `i`: the judge's own address for it), and what it is. */
function itemRow(/** @type {any} */ it, /** @type {string} */ where, /** @type {number} */ li, /** @type {number} */ i) {
  const o = it && typeof it === 'object' ? it : {};
  let worth = 0, key = null;
  try { worth = liquidWorthOf(o) || itemWorth(o); key = ledgerKeyOf(o); } catch { /* a piece of no shape the game writes: the judge's own finding names it */ }
  return {
    where, li, i, name: str(o.name), t: num(o.templateIndex), group: str(o.group ?? o.itemGroup, 32), material: num(o.material), quality: num(o.quality),
    count: Number.isSafeInteger(o.stackCount) && o.stackCount > 1 ? o.stackCount : 1, worth: Number.isSafeInteger(worth) ? worth : 0,
    slot: typeof o.equipSlot === 'number' || typeof o.equipSlot === 'string' ? o.equipSlot : null, key, letter: o.templateIndex === REALM_LETTER_TEMPLATE,
    ...itemMore(o),
  };
}
/** How many enchantments a row carries at most. */
const ITEM_ENCH_MAX = 12;
/** INV-HOVER (mob 2026-10-24: "hover for item here with descriptons", "so i can see what enchants and amounts of gold on
 *  parchment are"): what a piece's hover in the profile says beyond its row - its enchantments ([type, param], the
 *  game's EnchantmentTypes; the maker's own rows left out), its condition, the gold written on it (`value`: a letter's,
 *  or any piece's that carries one), its message number and whether a quest owns it. Only what the piece has.
 *  @param {any} o */
function itemMore(o) {
  const ench = (Array.isArray(o.enchantments) ? o.enchantments : [])
    .filter((/** @type {any} */ e) => e && typeof e === 'object' && e.enchantCost === undefined && Number.isSafeInteger(e.type) && e.type >= 0)
    .slice(0, ITEM_ENCH_MAX).map((/** @type {any} */ e) => [e.type, Number.isSafeInteger(e.param) ? e.param : -1]);
  const cur = num(o.currentCondition), max = num(o.maxCondition);
  return {
    ...(ench.length ? { ench } : {}),
    ...(cur != null && max != null && max > 0 ? { cond: [cur, max] } : {}),
    ...(Number.isSafeInteger(o.value) && o.value > 0 ? { value: o.value } : {}),
    ...(Number.isSafeInteger(o.message) && o.message > 0 ? { msg: o.message } : {}),
    ...(o.questItem ? { quest: true } : {}),
  };
}

/**
 * WHAT A PROFILE READS OF ONE SAVE - its level, attributes and skills as the save writes them, its purse and banks, and every
 * piece it holds as possessedItemLists walks them (the judge's walk), each with where it lies: the five lists by name, a
 * piece of the scene cache's (a home's chests, its storage, what is set out) `home`, the rest (a boat, a companion) `other`.
 * @param {any} save
 */
export function saveViewOf(save) {
  const named = new Map([[save.items, 'carried'], [save.bagItems, 'bag'], [save.wagonItems, 'wagon'], [save.furnishings, 'furnisher'], [save.otherItems, 'repairer']]);
  const home = new Set();
  for (const sc of arrayOf(save.sceneCache?.scenes)) {
    for (const piece of Object.values(objectOf(sc?.decorOwn))) home.add(piece);
    for (const held of Object.values(objectOf(sc?.decorItems))) for (const it of arrayOf(held)) home.add(it);
    for (const box of arrayOf(sc?.lootContainers)) for (const it of arrayOf(box?.items)) home.add(it);
  }
  /** @type {ReturnType<typeof itemRow>[]} */
  const items = [];
  possessedItemLists(save).forEach((list, li) => {
    const where = named.get(list) ?? (home.has(list[0]) ? 'home' : 'other');
    list.forEach((/** @type {any} */ it, /** @type {number} */ i) => items.push(itemRow(it, where, li, i)));
  });
  const stats = objectOf(save.stats);
  return {
    level: num(save.level), name: str(save.name), purse: num(save.goldPieces),
    banks: bankTotalOf(save),   // STAFF-SET-BANK: the sum a bank set is checked against (net/repairLaw.js), one with it
    stats: Object.fromEntries(STAT_KEYS_ORDER.map((k) => [k, num(stats[k])])),
    skills: arrayOf(save.skills).slice(0, 64).map(num),
    items,
  };
}

/** Saves' views by their object's key, oldest first - a key is one write's, so what is kept is never stale. */
const kept = new Map();
/** The view of the save a character's row names now, or null (none written, no storage, not a save). @param {any} bucket @param {any} c */
async function viewOf(bucket, c) {
  if (!bucket || !c?.obj) return null;
  let view = kept.get(c.obj);
  if (!view) {
    const save = parse(await realmSaveTextOf(await bucket.get(c.obj)) ?? '');
    if (!save || typeof save !== 'object' || Array.isArray(save)) return null;
    view = saveViewOf(save);
    kept.set(c.obj, view);
    if (kept.size > SAVES_KEPT) kept.delete(kept.keys().next().value);
  }
  return view;
}

/** The law finding standing on a character - the last the judge wrote (one is written as its signature comes or changes,
 *  verdict.js) - as `{ seq, findings }`, or null. @param {any} db @param {any} c */
async function lawOf(db, c) {
  if (!lawStands(c)) return null;
  const f = await db.prepare("SELECT seq, detail FROM realm_findings WHERE char_id = ?1 AND kind = 'law' ORDER BY at DESC, id DESC LIMIT 1").bind(c.id).first();
  const d = parse(f?.detail);
  return d ? { seq: f.seq, findings: arrayOf(d.findings) } : null;
}

/** The judge's piece findings laid on the rows they name - only when the finding was made of this very save (its list and
 *  place are that save's), never by a guess. And the pieces the ledger locked as copies, by their key. */
function flagged(/** @type {any[]} */ rows, /** @type {{ seq: number, findings: any[] } | null} */ law, /** @type {number} */ seq, /** @type {Set<string>} */ locked) {
  const at = new Map();
  if (law && law.seq === seq) for (const f of law.findings) if (f?.list != null) at.set(`${f.list}:${f.at}`, [...(at.get(`${f.list}:${f.at}`) ?? []), f.code]);
  return rows.map((r) => {
    const flags = at.get(`${r.li}:${r.i}`);
    return flags || (r.key && locked.has(r.key)) ? { ...r, ...(flags ? { flags } : {}), ...(r.key && locked.has(r.key) ? { locked: true } : {}) } : r;
  });
}

/** A character as a profile lists it. @param {any} c @param {number} nowS */
function charView(c, nowS) {
  const s = parse(c.summary ?? 'null');
  return {
    id: c.id, name: c.name, level: num(s?.level) ?? c.level_seen ?? null, className: str(s?.className, 40), race: str(s?.race, 24),
    playing: !!c.lease && nowS - c.lease_at < REALM_PLAYING_S, dead: c.dead_at != null, held: c.held ?? null, heldUntil: c.held_until ?? null,
    lawStrikes: c.strikes ?? 0, wealth: c.wealth ?? null, review: c.review ?? null, seq: c.seq, savedAt: c.updated_at,
  };
}
/** The character a tab reads: the one asked for, or the one played last that lives. @param {any[]} chars @param {unknown} id */
const chosen = (chars, id) => chars.find((c) => c.id === id) ?? chars.find((c) => c.dead_at == null) ?? chars[0] ?? null;

const CHARS_SQL = `SELECT id, name, summary, seq, lease, lease_at, obj, dead_at, held, held_at, held_until, strikes, law_sig, law_excused, review,
  wealth, allowance, witnessed, judged_seq, level_seen, created_at, updated_at FROM realm_characters WHERE player = ?1 ORDER BY updated_at DESC LIMIT ${CHARS_READ_MAX}`;

/**
 * A PROFILE'S FACTS, one batch: the open case, the judge's findings standing and this week's, the ledger's copies and claims,
 * the reported listings, the trades refused on a hold - and the card's newest flag.
 * @param {any} db @param {any} p @param {any[]} chars @param {number} nowS
 */
async function factsOf(db, p, chars, nowS) {
  const ids = chars.map((c) => c.id);
  const standing = chars.filter(lawStands);
  const q = (/** @type {string} */ sql, /** @type {unknown[]} */ ...a) => db.prepare(sql).bind(...a);
  /** @type {[string, any][]} */
  const reads = [
    // one open case a kind (migration 0156: a chat case and a spawn case may stand together)
    ['case', q("SELECT COUNT(*) AS n FROM mod_cases WHERE target = ?1 AND status = 'open'", p.id)],
    ['reported', q(`SELECT COUNT(DISTINCT x) AS n FROM (SELECT r.listing AS x FROM market_reports r JOIN market_listings l ON l.id = r.listing WHERE l.seller = ?1 AND l.state = 'open'
      UNION ALL SELECT r.auction FROM market_auction_reports r JOIN market_auctions a ON a.id = r.auction WHERE a.seller = ?1 AND a.state = 'open')`, p.id)],
    // a hold's refusal is kept with the side it held (realmTrade.js, FIELD BUGS 2026-10-11g HELD-SIDE): this account's own
    ['refused', q("SELECT COUNT(*) AS n FROM realm_trades WHERE (a_player = ?1 AND why = 'trade-held:a') OR (b_player = ?1 AND why = 'trade-held:b')", p.id)],
  ];
  if (ids.length) {
    const inIds = marks(ids.length);
    reads.push(
      ['copies', q(`SELECT COUNT(*) AS n FROM item_dupes WHERE char_id IN (${inIds})`, ...ids)],
      ['claims', q(`SELECT (SELECT COUNT(*) FROM item_uids WHERE claim_char IN (${inIds}) AND claim_char IS NOT NULL)
        + (SELECT COUNT(*) FROM item_uids WHERE char_id IN (${inIds}) AND claim_char IS NOT NULL) AS n`, ...ids)],
      ['kinds', q(`SELECT kind, COUNT(*) AS n FROM realm_findings WHERE char_id IN (${inIds}) AND at >= ?${ids.length + 1} GROUP BY kind`, ...ids, nowS - OPEN_WINDOW_S)],
      ['newest', q(`SELECT char_id, kind, at, detail FROM realm_findings WHERE char_id IN (${inIds}) AND kind != 'staff' ORDER BY at DESC, id DESC LIMIT 1`, ...ids)],
      ...standing.map((c) => /** @type {[string, any]} */ ([`law:${c.id}`, q("SELECT seq, detail FROM realm_findings WHERE char_id = ?1 AND kind = 'law' ORDER BY at DESC, id DESC LIMIT 1", c.id)])),
    );
  }
  const got = await db.batch(reads.map(([, s]) => s));
  /** @type {Record<string, any[]>} */
  const r = Object.fromEntries(reads.map(([k], i) => [k, got[i]?.results ?? []]));
  const n = (/** @type {string} */ k) => Number(r[k]?.[0]?.n ?? 0);
  const law = standing.flatMap((c) => arrayOf(parse(r[`law:${c.id}`]?.[0]?.detail)?.findings));
  /** @type {Record<string, number>} */
  const kinds = Object.fromEntries((r.kinds ?? []).map((k) => [k.kind, Number(k.n)]));
  return {
    facts: {
      openCases: n('case'), banned: isBanned(p, nowS), muted: isMuted(p, nowS), frozen: Number(p.frozen_until) > nowS,
      holds: chars.filter((c) => c.held && c.dead_at == null).length, charLaw: law.filter((f) => !isPieceFinding(f)).length,
      pieceLaw: law.filter(isPieceFinding).length, copies: n('copies'), claims: n('claims'), reported: n('reported'), refusedHeld: n('refused'),
      budget: kinds.budget ?? 0, measure: kinds.measure ?? 0,
      findings: Object.entries(kinds).reduce((s, [k, v]) => s + (k === 'staff' ? 0 : v), 0),
    },
    newest: r.newest?.[0] ?? null,
  };
}

/** A list's statements, paged: every section from its start, or the one asked (`section`) from `from` - one batch, the
 *  read's audit row (`row`) last in it. @param {any} db @param {Record<string, [string, unknown[]]>} defs @param {any} body
 *  @param {any} row @param {(row: any) => any} [map] */
async function sectionsOf(db, defs, body, row, map = (x) => x) {
  const one = typeof body.section === 'string' && Object.hasOwn(defs, body.section) ? body.section : null;
  const names = one ? [one] : Object.keys(defs);
  const from = one ? fromOf(body.from) : 0;
  const got = await db.batch([...names.map((k) => db.prepare(`${defs[k][0]} LIMIT ${PLAYERS_PAGE + 1} OFFSET ${from}`).bind(...defs[k][1])), row]);
  return Object.fromEntries(names.map((k, i) => {
    const rows = got[i]?.results ?? [];
    return [k, { rows: rows.slice(0, PLAYERS_PAGE).map(map), next: rows.length > PLAYERS_PAGE ? from + PLAYERS_PAGE : null }];
  }));
}

/** A stored item record (a listing's, a delivery's, a vault slot's, an escrow's) as its name and template. @param {unknown} rec */
const recOf = (rec) => { const o = objectOf(parse(rec)); return { name: str(o.name), t: num(o.templateIndex) }; };
/** A market row with its item record read. @param {any} r */
const marketRow = (r) => (r.item ? { ...r, item: recOf(r.item) } : r);

/**
 * ONE TAB OF A PROFILE. @param {any} ctx @param {any} env @param {string} tab @param {any} p the account's row
 * @param {any[]} chars its realm characters, the one played last first @param {any} body
 * @param {any} row the read's audit row - STAFF-PANEL-SPEED: written in the tab's own batch, never a trip after it
 */
async function tabOf(ctx, env, tab, p, chars, body, row) {
  const { db, nowS } = ctx;
  const bucket = ctx.bucket ?? env.SAVES;
  const ids = chars.map((c) => c.id);

  if (tab === 'overview') {
    const [[guilds, renown, devices, open], strikes] = await Promise.all([db.batch([
      db.prepare('SELECT m.char_id, m.rank, g.id, g.name, g.tag FROM guild_members m JOIN guilds g ON g.id = m.guild_id WHERE m.player = ?1').bind(p.id),
      db.prepare('SELECT char_id, xp FROM renown_tracks WHERE player = ?1').bind(p.id),
      db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE player_id = ?1').bind(p.id),
      // every open case - one a kind, a chat case and a spawn case at once (migration 0156)
      db.prepare("SELECT id, kind, opened_at, reports, claimed_by FROM mod_cases WHERE target = ?1 AND status = 'open' ORDER BY kind").bind(p.id),
      row,
    ]), strikesOf(db, p.id, nowS)]);
    const guildOf = new Map((guilds.results ?? []).map((/** @type {any} */ g) => [g.char_id, { id: g.id, name: g.name, tag: g.tag, rank: g.rank }]));
    const xpOf = new Map((renown.results ?? []).map((/** @type {any} */ t) => [t.char_id, t.xp]));
    return {
      account: {
        id: p.id, handle: p.handle ?? null, guestName: p.guest_name, createdAt: p.created_at, registeredAt: p.registered_at ?? null,
        playedS: p.played_s ?? 0, playedAt: p.played_at ?? null, online: onlineNow(p, nowS), nameAs: p.name_as === 'character' ? 'character' : 'account',
      },
      sanctions: {
        strikes, mutedUntil: isMuted(p, nowS) ? p.muted_until : 0, bannedUntil: isBanned(p, nowS) ? p.banned_until : 0,
        banReason: isBanned(p, nowS) ? p.ban_reason ?? null : null, frozenUntil: Number(p.frozen_until) > nowS ? p.frozen_until : 0,
      },
      openCases: (open.results ?? []).map((/** @type {any} */ c) => ({ id: c.id, kind: c.kind, openedAt: c.opened_at, reports: c.reports, claimedBy: c.claimed_by ?? null })),
      devices: Number(devices.results?.[0]?.n ?? 0),
      characters: chars.map((ch) => ({ ...charView(ch, nowS), guild: guildOf.get(ch.id) ?? null, renownXp: xpOf.get(ch.id) ?? 0 })),
    };
  }

  if (tab === 'skills' || tab === 'equipment' || tab === 'inventories') {
    const c = chosen(chars, body.char);
    if (!c) { await row.run(); return { character: null }; }
    // STAFF-PANEL-SPEED: the save, its law finding, the locked copies and what the service holds, all at once, the row with them
    const service = tab === 'inventories' ? [
      db.prepare('SELECT char_id, material, origin, qty FROM prof_stores WHERE player = ?1 AND qty > 0').bind(p.id),
      // a guild's vault, by its own key: the account's guilds' deposits (one it left keeps them as the guild's)
      db.prepare(`SELECT v.guild_id, g.name AS guild, v.slot, v.rec, v.name, v.count, v.dep_char FROM guild_vault v JOIN guilds g ON g.id = v.guild_id
        WHERE v.guild_id IN (SELECT guild_id FROM guild_members WHERE player = ?1) AND v.dep_player = ?1`).bind(p.id),
      db.prepare(`SELECT l.id, l.char_id, l.kind, l.material, l.provenance, l.item, l.units, l.bought, l.price, l.currency, e.item AS piece
        FROM market_listings l LEFT JOIN piece_escrow e ON e.provenance = l.provenance WHERE l.seller = ?1 AND l.state = 'open'`).bind(p.id),
      db.prepare(`SELECT a.id, a.char_id, a.provenance, a.opening, a.high, e.item AS piece FROM market_auctions a LEFT JOIN piece_escrow e ON e.provenance = a.provenance
        WHERE a.seller = ?1 AND a.state = 'open'`).bind(p.id),
      db.prepare("SELECT id, char_id, material, left_units, escrow FROM market_orders WHERE poster = ?1 AND state = 'open'").bind(p.id),
      db.prepare("SELECT id, char_id, auction, amount, courier FROM market_bids WHERE bidder = ?1 AND state = 'high'").bind(p.id),
      db.prepare('SELECT id, char_id, provenance, item, why, arrives_at FROM market_deliveries WHERE player = ?1 AND collected = 0').bind(p.id),
      db.prepare('SELECT char_id, gold FROM market_gold WHERE player = ?1 AND gold > 0').bind(p.id),
      db.prepare(`SELECT r, char_id, rec, until_s FROM wild_escrow WHERE char_id IN (${marks(ids.length)}) AND state = 'held'`).bind(...ids),
    ] : [];
    const [view, law, got] = await Promise.all([viewOf(bucket, c), lawOf(db, c),
      db.batch([...(tab === 'skills' ? [] : [db.prepare('SELECT uid FROM item_dupes WHERE char_id = ?1').bind(c.id)]), ...service, row])]);
    const head = { character: charView(c, nowS), seq: c.seq, savedAt: c.updated_at, judgedSeq: c.judged_seq ?? null, saved: !!view };
    if (tab === 'skills') {
      return { ...head, trustedLevel: c.level_seen ?? null, save: view && { level: view.level, name: view.name, stats: view.stats, skills: view.skills },
        findings: (law?.findings ?? []).filter((f) => !isPieceFinding(f)) };
    }
    const locked = new Set((got[0]?.results ?? []).map((/** @type {any} */ d) => d.uid));
    const rows = flagged(view?.items ?? [], law, c.seq, locked);
    if (tab === 'equipment') return { ...head, worn: rows.filter((r) => r.where === 'carried' && r.slot != null), findings: (law?.findings ?? []).filter(isPieceFinding) };
    // INVENTORIES, EVERYWHERE: the save's own lists (this character's), and what the service holds for the account
    const [stores, vault, listings, auctions, orders, bids, deliveries, gold, wild] = got.slice(1);
    const res = (/** @type {any} */ x) => /** @type {any[]} */ (x?.results ?? []);
    const held = [
      ...res(stores).map((s) => ({ where: 'stores', char: s.char_id, name: s.material, origin: s.origin, count: s.qty, worth: null })),
      ...res(vault).map((v) => ({ where: 'vault', char: v.dep_char, guild: { id: v.guild_id, name: v.guild }, slot: v.slot, name: str(v.name) ?? recOf(v.rec).name, t: recOf(v.rec).t, count: v.count, worth: null })),
      ...res(listings).map((l) => ({ where: 'escrow', char: l.char_id, listing: l.id, name: l.material ?? recOf(l.item ?? l.piece).name ?? l.provenance, count: l.units - l.bought, price: l.price, currency: l.currency, worth: null })),
      ...res(auctions).map((a) => ({ where: 'escrow', char: a.char_id, auction: a.id, name: recOf(a.piece).name ?? a.provenance, count: 1, price: a.high ?? a.opening, worth: null })),
      ...res(orders).map((o) => ({ where: 'escrow', char: o.char_id, order: o.id, name: `gold for ${o.left_units} ${o.material}`, count: 1, worth: o.escrow })),
      ...res(bids).map((b) => ({ where: 'escrow', char: b.char_id, auction: b.auction, name: 'gold for a high bid', count: 1, worth: b.amount + b.courier })),
      ...res(deliveries).map((d) => ({ where: 'deliveries', char: d.char_id, delivery: d.id, name: recOf(d.item).name ?? d.provenance, why: d.why, arrivesAt: d.arrives_at, count: 1, worth: null })),
      ...res(gold).map((g) => ({ where: 'market-gold', char: g.char_id, name: 'gold held at the market', count: 1, worth: g.gold })),
      ...res(wild).map((w) => ({ where: 'escrow', char: w.char_id, wild: w.r, name: recOf(w.rec).name, until: w.until_s, count: 1, worth: null })),
    ];
    const where = ITEM_PLACES.includes(body.where) ? body.where : null;
    const q = typeof body.q === 'string' ? body.q.trim().toLowerCase().slice(0, 32) : '';
    const type = typeof body.type === 'string' ? body.type.toLowerCase().slice(0, 32) : '';
    const min = Number.isSafeInteger(body.min) && body.min > 0 ? body.min : 0;
    const quality = Number.isSafeInteger(body.quality) && body.quality > 0 ? body.quality : 0;
    const all = [...rows.map((r) => ({ ...r, char: c.id })), ...held].filter((/** @type {any} */ r) => (!where || (where === 'letters' ? r.letter === true : r.where === where))
      && (!q || String(r.name ?? '').toLowerCase().includes(q)) && (!type || String(r.group ?? '').toLowerCase() === type)
      && (!min || (r.worth ?? 0) >= min) && (!quality || (r.quality ?? 0) >= quality));
    const from = fromOf(body.from);
    return {
      ...head, purse: view?.purse ?? null, banks: view?.banks ?? null, items: all.slice(from, from + ITEMS_PAGE),
      next: from + ITEMS_PAGE < all.length ? from + ITEMS_PAGE : null, total: all.length, findings: (law?.findings ?? []).filter(isPieceFinding),
    };
  }

  if (tab === 'market') {
    const party = (/** @type {string} */ col) => `LEFT JOIN players x ON x.id = s.${col}`;
    return sectionsOf(db, {
      listings: [`SELECT l.id, l.char_id AS char, l.kind, l.material, l.provenance, l.item, l.units, l.bought, l.price, l.currency, l.state, l.region, l.at,
        l.expires_at AS expiresAt, l.closed_at AS closedAt, (SELECT COUNT(*) FROM market_reports r WHERE r.listing = l.id) AS reports
        FROM market_listings l WHERE l.seller = ?1 ORDER BY l.at DESC, l.id DESC`, [p.id]],
      sales: [`SELECT s.listing, s.buyer AS other, x.handle AS otherHandle, s.char_id AS char, s.kind, s.material, s.provenance, s.units, s.price, s.total,
        s.currency, s.at FROM market_sales s ${party('buyer')} WHERE s.seller = ?1 ORDER BY s.at DESC, s.rid DESC`, [p.id]],
      purchases: [`SELECT s.listing, s.seller AS other, x.handle AS otherHandle, s.char_id AS char, s.kind, s.material, s.provenance, s.units, s.price, s.total,
        s.currency, s.at FROM market_sales s ${party('seller')} WHERE s.buyer = ?1 ORDER BY s.at DESC, s.rid DESC`, [p.id]],
      auctions: [`SELECT a.id, a.char_id AS char, a.provenance, a.opening, a.high, a.bids, a.state, a.at, a.ends_at AS endsAt,
        (SELECT COUNT(*) FROM market_auction_reports r WHERE r.auction = a.id) AS reports FROM market_auctions a WHERE a.seller = ?1 ORDER BY a.at DESC, a.id DESC`, [p.id]],
      bids: ['SELECT b.id, b.auction, b.char_id AS char, b.amount, b.state, b.at FROM market_bids b WHERE b.bidder = ?1 ORDER BY b.at DESC, b.id DESC', [p.id]],
      orders: [`SELECT o.id, o.char_id AS char, o.material, o.units, o.left_units AS leftUnits, o.price, o.escrow, o.state, o.at FROM market_orders o
        WHERE o.poster = ?1 ORDER BY o.at DESC, o.id DESC`, [p.id]],
      fills: ['SELECT f.order_id AS orderId, f.poster AS other, f.char_id AS char, f.material, f.units, f.price, f.pay, f.at FROM market_fills f WHERE f.filler = ?1 ORDER BY f.at DESC, f.rid DESC', [p.id]],
    }, body, row, marketRow);
  }

  if (tab === 'trades') {
    // both sides, by migration 0151's indexes; the service keeps a trade REALM_TRADE_KEEP_S (realmTrade.js), so this is the last week's
    const from = fromOf(body.from);
    const [found] = await db.batch([db.prepare(`SELECT t.sid, t.created_at AS at, t.state, t.why, t.result, t.a_player, t.a_char, t.b_player, t.b_char,
        ca.name AS a_name, cb.name AS b_name, pa.handle AS a_handle, pb.handle AS b_handle
      FROM realm_trades t LEFT JOIN realm_characters ca ON ca.id = t.a_char LEFT JOIN realm_characters cb ON cb.id = t.b_char
        LEFT JOIN players pa ON pa.id = t.a_player LEFT JOIN players pb ON pb.id = t.b_player
      WHERE t.a_player = ?1 OR t.b_player = ?1 ORDER BY t.created_at DESC, t.sid DESC LIMIT ${PLAYERS_PAGE + 1} OFFSET ${from}`).bind(p.id), row]);
    const rows = found?.results ?? [];
    return {
      keptDays: REALM_TRADE_KEEP_S / 86400, next: rows.length > PLAYERS_PAGE ? from + PLAYERS_PAGE : null,
      trades: rows.slice(0, PLAYERS_PAGE).map((/** @type {any} */ t) => {
        const mine = t.a_player === p.id ? 'a' : 'b', theirs = mine === 'a' ? 'b' : 'a';
        const r = t.state === 'done' ? parse(t.result) ?? {} : null;
        const side = /^(trade-held|record-unjudged):([ab])$/.exec(t.why ?? '');
        // the row keeps what each side RECEIVED, so what this side gave is what the other got (review.js tradesOf)
        return {
          sid: t.sid, at: t.at, state: t.state, why: side ? side[1] : t.why ?? null, held: side ? (side[2] === mine ? 'mine' : 'theirs') : null, char: t[`${mine}_char`],
          with: { id: t[`${theirs}_char`] ?? null, name: t[`${theirs}_name`] ?? null, player: t[`${theirs}_player`] ?? null, handle: t[`${theirs}_handle`] ?? null },
          gave: r ? receiptOf(r[theirs]) : null, got: r ? receiptOf(r[mine]) : null,
        };
      }),
    };
  }

  if (tab === 'economy') {
    const days = Number.isSafeInteger(body.days) && body.days >= 1 && body.days <= ECONOMY_DAYS_MAX ? body.days : 7;
    const since = nowS - days * 86400;
    const c = chosen(chars, body.char);
    // the gains page from `from`, answered `next` (STAFF-PANEL3-PLAYERS FIX, flaw review: a farmer's month is past any one cut)
    const from = fromOf(body.from);
    const [hours, gains] = await db.batch([
      db.prepare('SELECT hour, level, gain, loss, played_s AS playedS, checkpoints FROM realm_wealth_hours WHERE char_id = ?1 AND hour >= ?2 ORDER BY hour DESC').bind(c?.id ?? null, since),
      db.prepare(`SELECT char_id AS char, at, kind, detail FROM realm_findings WHERE char_id IN (${marks(ids.length)}) AND kind IN ('measure', 'budget') AND at >= ?${ids.length + 1}
        ORDER BY at DESC, id DESC LIMIT ${PLAYERS_PAGE + 1} OFFSET ${from}`).bind(...ids, since),
      row,
    ]);
    const rows = gains.results ?? [];
    return {
      days, char: c?.id ?? null, hours: hours.results ?? [], gains: rows.slice(0, PLAYERS_PAGE).map((/** @type {any} */ g) => ({ ...g, detail: parse(g.detail) })),
      next: rows.length > PLAYERS_PAGE ? from + PLAYERS_PAGE : null,
      characters: chars.map((ch) => ({ id: ch.id, name: ch.name, wealth: ch.wealth ?? null, allowance: ch.allowance ?? null, witnessed: ch.witnessed ?? 0, held: ch.held ?? null, review: ch.review ?? null })),
    };
  }

  // HISTORY: the judge's findings (staff's realm acts among them, `staff`), the strike record, and the reports against the
  // account and by it - a report's reason, never its words
  return sectionsOf(db, {
    findings: [`SELECT id, char_id AS char, seq, at, kind, detail FROM realm_findings WHERE char_id IN (${marks(ids.length)}) ORDER BY at DESC, id DESC`, ids],
    acts: ['SELECT id, kind, until, reason, actor_name AS actorName, case_id AS caseId, at, void_at AS voidAt FROM mod_actions WHERE target = ?1 ORDER BY at DESC, id DESC', [p.id]],
    against: [`SELECT id, source, status, opened_at AS openedAt, reports, ai_category AS aiCategory, ai_severity AS aiSeverity, resolution, resolved_by AS resolvedBy,
      resolved_at AS resolvedAt FROM mod_cases WHERE target = ?1 ORDER BY opened_at DESC, id DESC`, [p.id]],
    filed: [`SELECT r.case_id AS caseId, r.reason, r.at, r.counted, c.target, x.handle AS targetHandle, c.status FROM mod_reports r JOIN mod_cases c ON c.id = r.case_id
      LEFT JOIN players x ON x.id = c.target WHERE r.reporter = ?1 ORDER BY r.at DESC, r.case_id DESC`, [p.id]],
  }, body, row, (r) => (r.detail ? { ...r, detail: parse(r.detail) } : r));
}

/**
 * THE PANEL'S PLAYER DOORS. Answers the route's body, or `{ error }` (staff.js STAFF_STATUS its status).
 * @param {any} ctx @param {any} env @param {string} path @param {any} body
 * @param {{ player: any, role: string }} who
 * @param {(act: string, target?: string|null, detail?: object|null, how?: object) => any} audit
 */
export async function staffPlayers(ctx, env, path, body, who, audit) {
  const { db, nowS } = ctx;
  if (who.role !== 'admin') {
    await audit('refused', null, { path, need: 'admin' }, { outcome: 'denied' }).run();
    return { error: 'staff-admin' };
  }

  // /v1/staff/players { q?, online?, ban?, from? } - every account with a handle whose handle, or a character's name, starts
  // with `q` (any case), `online` those a tab of which beat inside the play clock's grace; by handle, `from` the last one
  // STAFF-BANNED (2026-10-23, mob: "player that are banned need to be taken out of staff panel list of players we need a
  // tab for banned players as well", "add a ban status as well to player list", "so we can filter them"): `ban` is
  // 'not-banned' (the default, so a banned account is out of the list unless asked for), 'banned' or 'all' (BAN_FILTERS),
  // judged in the statement against banned_until and the clock, as sanctions.js isBanned judges it (a lapsed ban is none).
  // The page is cut after the filter, so its cursor - the last handle of the filtered page - goes on from there: no row
  // skipped, none read twice. Each row says its ban (`bannedUntil`, 0 for none; `banForever` for BAN_FOREVER). The Banned
  // tab itself is staffCases.js /v1/staff/banned, a Moderator's too, as Unban is.
  if (path === '/v1/staff/players') {
    const q = typeof body.q === 'string' ? body.q.trim().slice(0, 32) : '';
    const online = body.online === true;
    const ban = BAN_FILTERS.includes(body.ban) ? body.ban : 'not-banned';
    const after = typeof body.from === 'string' ? body.from.slice(0, 64) : '';
    const top = (/** @type {string} */ s) => `${s}\u{10FFFF}`;   // past every name the prefix starts
    const args = [after, PLAYERS_PAGE + 1, ...(q ? [q.toLowerCase(), top(q.toLowerCase()), q, top(q)] : [])];
    // STAFF-BANNED: the banned read by migration 0164's index, as the online one is by the play beat's; the clock bound
    // before the online filter's, whose clause reads the last bound
    const banSql = ban === 'banned' ? `AND id IN (SELECT id FROM players WHERE banned_until > ?${args.push(nowS)}) `
      : ban === 'not-banned' ? `AND (banned_until IS NULL OR banned_until <= ?${args.push(nowS)}) ` : '';
    if (online) args.push(nowS - PLAY_GRACE_S);
    // the online read by the last play beat's index (idx_players_played) and only they sorted: a plain `played_at >=` beside
    // the handle's range let the planner walk every handle for the ORDER BY (STAFF-PANEL3-PLAYERS FIX, flaw review)
    // STAFF-PANEL-SPEED (mob: "slow when moving in menus"): the cut page's characters ride its read as one JSON column, its audit row the same batch - one trip, was three
    const sql = `SELECT x.*, (SELECT json_group_array(json_array(c.id, c.name, c.lease, c.lease_at, c.dead_at, c.held)) FROM (SELECT id, name, lease, lease_at, dead_at, held
        FROM realm_characters WHERE player = x.id ORDER BY updated_at DESC) c) AS chars
      FROM (SELECT id, handle, handle_lc, created_at, played_at, muted_until, banned_until FROM players WHERE ${q ? `id IN (
        SELECT id FROM players WHERE handle_lc >= ?3 AND handle_lc < ?4
        UNION SELECT player FROM realm_characters WHERE name >= ?5 COLLATE NOCASE AND name < ?6 COLLATE NOCASE) AND ` : ''}handle IS NOT NULL AND handle_lc > ?1
      ${banSql}${online ? `AND id IN (SELECT id FROM players WHERE handle IS NOT NULL AND played_at >= ?${args.length})` : ''} ORDER BY handle_lc LIMIT ?2) x ORDER BY x.handle_lc`;
    const [found] = await db.batch([db.prepare(sql).bind(...args), audit('players-search', null, { q, online, ban }, { onceIn: READ_ONCE_S })]);
    const rows = found?.results ?? [];
    const page = rows.slice(0, PLAYERS_PAGE);
    return {
      players: page.map((r) => ({
        id: r.id, handle: r.handle, online: onlineNow(r, nowS), playedAt: r.played_at ?? null, createdAt: r.created_at, banned: isBanned(r, nowS), muted: isMuted(r, nowS),
        bannedUntil: isBanned(r, nowS) ? r.banned_until : 0, banForever: isBanned(r, nowS) && r.banned_until >= BAN_FOREVER,   // STAFF-BANNED: the ban status
        characters: arrayOf(parse(r.chars)).map(([id, name, lease, leaseAt, deadAt, held]) => ({ id, name, playing: !!lease && nowS - leaseAt < REALM_PLAYING_S, dead: deadAt != null, held: held ?? null })),
      })),
      next: rows.length > PLAYERS_PAGE ? page[page.length - 1].handle_lc : null,
    };
  }

  // an act names the account by its id, never a name (design doc, Weak spots: "Act by account id ... never by name"); a read
  // may name it either way (sanctions.js findAccount)
  const acting = path === '/v1/staff/player/signout' || path === '/v1/staff/player/rename';
  // STAFF-PANEL-SPEED: a profile asked by the account's id (findAccount's own test) reads its characters beside the account
  const byId = path === '/v1/staff/player' && typeof body.target === 'string' && ID_RE.test(body.target);
  const [p, early] = await Promise.all([findAccount(db, acting ? { target: body.target } : { target: body.target, name: body.name }),
    byId ? db.prepare(CHARS_SQL).bind(body.target).all() : null]);
  if ('error' in p) return p;

  // /v1/staff/player { target | name, tab?, char?, section?, from?, where?, q?, type?, quality?, min?, days? } - opened (no
  // tab): the summary card, each tab's badge, the tab it opens on and that tab; a tab named: that tab alone. `where`, `q`,
  // `type`, `quality` and `min` filter the Inventories (ITEM_PLACES; a name; a group; a quality and a worth at least);
  // `days` the Economy's range (1 to ECONOMY_DAYS_MAX, a week else)
  if (path === '/v1/staff/player') {
    const chars = (early ?? await db.prepare(CHARS_SQL).bind(p.id).all())?.results ?? [];
    const asked = PLAYER_TABS.includes(body.tab) ? body.tab : null;
    /** @type {any} */
    let head = {};
    if (!asked) {
      const [strikes, x] = await Promise.all([strikesOf(db, p.id, nowS), factsOf(db, p, chars, nowS)]);
      const living = chars.filter((c) => c.dead_at == null);
      const last = living[0] ?? null;
      const { tabs, first } = profileBadges(x.facts);
      head = {
        card: {
          id: p.id, handle: p.handle ?? null, name: displayName(p), online: onlineNow(p, nowS), level: last ? charView(last, nowS).level : null,
          hours: Math.floor((p.played_s ?? 0) / 3600), wealth: living.reduce((s, c) => s + (Number(c.wealth) || 0), 0), strikes,
          holds: living.filter((c) => c.held).map((c) => ({ char: c.id, name: c.name, held: c.held, at: c.held_at, until: c.held_until ?? null })),
          flag: x.newest ? { char: x.newest.char_id, kind: x.newest.kind, at: x.newest.at, detail: parse(x.newest.detail) } : null,
          banned: x.facts.banned, muted: x.facts.muted, frozen: x.facts.frozen,
        },
        badges: tabs, first,
      };
    }
    const tab = asked ?? head.first;
    const data = await tabOf(ctx, env, tab, p, chars, body, audit('player-read', p.id, { tab }, { onceIn: READ_ONCE_S }));
    return { ...head, target: p.id, tab, data };
  }

  // /v1/staff/player/devices { target | name } - the devices the account signed in on (accounts.js devicesOf, the player's own list)
  if (path === '/v1/staff/player/devices') {
    // STAFF-PANEL-SPEED: the row with the list's read, one trip (devicesOf is the player's own list, accounts.js's statement)
    const [devices] = await Promise.all([devicesOf(ctx, p.id), audit('devices-read', p.id, null, { onceIn: READ_ONCE_S }).run()]);
    return { target: p.id, name: displayName(p), devices };
  }

  // /v1/staff/player/signout { target } - every game session ended (accounts.js closeAllSessions, the player's own "everywhere")
  if (path === '/v1/staff/player/signout') {
    // STAFF-PANEL3-PLAYERS FIX (flaw review, "Sign out everywhere on a guest account locks the player out for good"): a
    // guest has no handle or password, so its sessions are its only way in (accounts.js createGuest) - never all ended
    if (!p.handle) {
      await audit('signout-all', p.id, { name: displayName(p), error: 'no-handle' }, { outcome: 'failed' }).run();
      return { error: 'no-handle' };
    }
    let r;
    try { r = await closeAllSessions(ctx, p.id); } catch (e) {
      await audit('signout-all', p.id, { error: String(/** @type {any} */ (e)?.message ?? e).slice(0, 120) }, { outcome: 'failed' }).run();
      throw e;
    }
    await audit('signout-all', p.id, { name: displayName(p), revoked: r.revoked }).run();
    return { ok: true, target: p.id, revoked: r.revoked };
  }

  // /v1/staff/player/rename { target, to, char? } - the account's handle, or (with `char`) one of its characters' names.
  // Never to or from a name a role or title list holds (design doc, Weak spots: "Rename refuses any handle on a role or
  // title list"), so a rename hands no power out and takes none away - a staff member's name is the config's to change.
  const to = typeof body.to === 'string' ? body.to : '';
  const listed = listedHandles(env);
  const fail = async (/** @type {string} */ error, /** @type {object} */ detail) => {
    await audit('rename', p.id, { ...detail, to: to.slice(0, 64), error }, { outcome: 'failed' }).run();
    return { error };
  };
  if (body.char !== undefined) {
    const c = typeof body.char === 'string' && REALM_ID_RE.test(body.char)
      ? await db.prepare('SELECT id, name FROM realm_characters WHERE id = ?1 AND player = ?2').bind(body.char, p.id).first() : null;
    if (!c) return fail('no-character', { char: str(body.char, 40) });
    const detail = { char: c.id, from: c.name };
    // a name the realm keeps (realm.js realmNameOf) and the wire carries as it stands (accounts.js wornNameRefusal: the name
    // filter's law), never another account's handle (wornNameOf's own refusal)
    if (realmNameOf(to) !== to || wornNameRefusal(to)) return fail('rename-bad', detail);
    if (to === c.name) return fail('rename-same', detail);
    if (listed.has(to.toLowerCase())) return fail('rename-listed', detail);
    if (isHandleShaped(to) && await db.prepare('SELECT 1 AS taken FROM players WHERE handle_lc = ?1 AND id != ?2').bind(to.toLowerCase(), p.id).first()) return fail('rename-taken', detail);
    try {
      await db.batch([
        audit('rename', p.id, { ...detail, to }),
        db.prepare('UPDATE realm_characters SET name = ?1 WHERE id = ?2 AND player = ?3 AND name = ?4').bind(to, c.id, p.id, c.name),
        mustChange(db),
      ]);
    } catch { return fail('rename-moved', detail); }
    return { ok: true, target: p.id, char: c.id, from: c.name, to };
  }
  if (!p.handle) return fail('no-handle', { from: displayName(p) });
  const detail = { from: p.handle };
  const why = handleRefusal(to);
  if (why) return fail('rename-bad', { ...detail, why });
  if (to === p.handle) return fail('rename-same', detail);
  if (canModerate(p, env) || listed.has(p.handle_lc) || listed.has(to.toLowerCase())) return fail('rename-listed', detail);
  if (await db.prepare('SELECT 1 AS taken FROM players WHERE handle_lc = ?1 AND id != ?2').bind(to.toLowerCase(), p.id).first()) return fail('rename-taken', detail);
  // migration 0134's way, in one batch: the handle (the unique index the authority on a name taken), and every copy of it
  // matched on the old one - on this account's own rows wherever the table names the account (NAME_COPIES).
  // shortcut: each copy is matched by a scan of its table, as 0134's were - a staff act done rarely; give a table an index
  // on its name column if one grows past what a scan reads quickly.
  try {
    await db.batch([
      audit('rename', p.id, { ...detail, to }),
      db.prepare('UPDATE players SET handle = ?1, handle_lc = ?2 WHERE id = ?3 AND handle = ?4').bind(to, to.toLowerCase(), p.id, p.handle),
      mustChange(db),
      ...NAME_COPIES.map(([table, col, scope]) => db.prepare(`UPDATE ${table} SET ${col} = ?1 WHERE lower(${col}) = lower(?2)${scope ? ` AND ${scope}` : ''}`)
        .bind(to, p.handle, ...(scope ? [p.id] : []))),
    ]);
  } catch (e) {
    return fail(/UNIQUE/i.test(String(/** @type {any} */ (e)?.message ?? e)) ? 'rename-taken' : 'rename-moved', detail);
  }
  return { ok: true, target: p.id, from: p.handle, to };
}
