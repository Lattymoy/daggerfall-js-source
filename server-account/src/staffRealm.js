// @ts-check
// ═══════════════════════════════════════════════════════════════════
// STAFF-PANEL3-REALM (2026-10-22, design doc "DFO Staff Panel: design", build step 3 - "Trade freezes", "Built on the save
// judge", "Remove items", the profile's Roll back and Fix account, the census's Unexplained line; its weak spots "Freeze
// and trade holds" and "Items, census and economy") - THE PANEL'S TRADE HOLDS, ROLLBACKS, FIXES, GAINS AND REMOVALS.
// Admins alone (mob, 03:03Z: "Freeze, trade holds, rollbacks" are the Admin's), every door; OFFLINE ONLY until mob tries
// it live.
//
// NOTHING NEW IS JUDGED (mob, 09:22Z: "use the validators the server already has"). The holds, findings, clear, hold,
// rollback, repair and mend are review.js's own acts (reviewAct, the developers' /v1/mod/realm-* doors a script reached),
// made as this Admin - a developer, as titles.js isDeveloper reads the same list - so a panel act lands in the character's
// findings exactly as a script's did. What the panel adds is the audit row, a required note where the design asks one, a
// preview before an act that cannot be taken back, and the weak spots' fixes:
//   - "Freeze" names two acts: this one is the TRADE HOLD everywhere, and Unhold says what it also does - the judge's
//     finding excused and the allowance refilled (review.js `clear`).
//   - "A trade hold covers one character": a hold can name the account, and holds every living character of it.
//   - Roll back keeps staff holds through it (review.js), is refused while a staff Remove from that character is kept
//     (`staff-remove-pending` - roll back first, then remove), and its preview says what it will not undo: the Stores,
//     the Drakes and the market purse live outside the save.
//   - "Unexplained gold and XP" is WEALTH PAST THE ALLOWANCE (verdict.js's `measure`/`budget` findings), the gold apart from
//     the goods (the finding's `goods`, the rest of that wealth its gold), XP read from the progression's hours
//     (progress.js) - most urgent first, paged, kept GAINS_KEEP_MS so the panel never re-reads it on every open (design
//     doc "Server load").
//   - Remove from a player takes the piece on a path of its own (realm.js prepareRealmRecord `take`): the repair path
//     refuses copied pieces, which are what staff remove. The record moves one save on with its seat taken, so the
//     player's game's next save is refused; the piece goes to the 30-day store (staff_evidence, migration 0152) and its
//     ledger row is marked taken by staff (ledger.js SEIZED), so a save that shows it again is charged as a copy. A piece
//     the ledger contests (another holds it, or copies are known) needs `trail: true` - the design's "require a trail
//     check before Remove" - and the preview names the trail; a copy written down on the character itself needs its
//     trail check recorded first (staffCensus.js /v1/staff/contested/trail).
//   - Remove from market is market.js marketRemove `keep`: the listing ends and its goods are kept, not returned. A listed
//     piece the ledger contests asks the same trail check as Remove from a player.
//   - Every removal names a reason and a note, and Put back undoes it within 30 days - the piece back as exactly what it
//     was: the ledger row the removal took given back, any other left as it stands, and a copy mark where it was found.
//
// EVERY LIST PAGES (mob, 19:25Z: "put inf scroll in anything that pull lists"): `from` the offset of the next page,
// answered as `next` while more stand.
import { displayName, mintId } from './accounts.js';
import { reviewAct, staffFinding, NOTE_MAX } from './review.js';
import { findAccount } from './sanctions.js';
import { REALM_ID_RE, REALM_PLAYING_S, realmSaveTextOf, seizeRealmRecord, dropIfUnnamed, dropObjects, mustChange } from './realm.js';
import { marketRemove } from './market.js';
import { balanceOf } from './marks.js';
import { possessedItemLists, ledgerKeyOf, ledgerPrintOf, wealthOf } from './judge.js';
import { SEIZED } from './ledger.js';
import { budgetConfig, bandOf } from './budget.js';
import { progressConfig } from './progress.js';
import { DB_ROOT } from './service.js';
import { itemWorth } from '../../src/systems/item/itemLaw.js';

/** Rows one page answers. */
export const REALM_PAGE = 25;
/** The held and flagged characters one read ranks at most - the ranking is the whole list's. */
export const HOLDS_RANKED_MAX = 1000;
/** The characters with wealth past the allowance, and the accounts with XP past the line, one read ranks at most. */
export const GAINS_RANKED_MAX = 1000;
/** The gains' window: its days by default, and at most (the findings are kept 90, the hours 30). */
export const GAINS_DAYS = 7;
export const GAINS_DAYS_MAX = 30;
/** How long one isolate keeps a gains read (design doc "Server load": "Cache them for 5-10 minutes"). */
export const GAINS_KEEP_MS = 5 * 60 * 1000;
/** The progression streams that are XP (progress.js PROGRESS_LINE: Renown's and the professions'). */
export const XP_STREAMS = Object.freeze(['renown', 'prof']);
/** How many allowances (a band's cap, a stream's) past make a gain high, and medium - starting numbers to tune. */
export const GAINS_HIGH = 3;
export const GAINS_MEDIUM = 1;
/** How long a removal is kept for Put back, and then deleted (cron.js staff-evidence). */
export const EVIDENCE_KEEP_S = 30 * 24 * 60 * 60;
/** A removal's reasons (design doc "Remove items": duplicated item, bought with duped gold, bug reward, other). */
export const REMOVE_REASONS = Object.freeze(['duplicated', 'duped-gold', 'bug-reward', 'other']);
/** A read of one view is written once in this, a member and a view (staff.js STAFF_READ_ROW_S's reason). */
const READ_ROW_S = 10 * 60;

export const REALM_ROUTES = Object.freeze(['/v1/staff/trade-holds', '/v1/staff/findings', '/v1/staff/trade-hold', '/v1/staff/trade-unhold',
  '/v1/staff/rollback', '/v1/staff/fix/repair', '/v1/staff/fix/mend', '/v1/staff/gains', '/v1/staff/market/pull', '/v1/staff/market/remove',
  '/v1/staff/item/take', '/v1/staff/evidence', '/v1/staff/evidence/return']);

const LEVELS = Object.freeze(['low', 'medium', 'high']);
const parse = (/** @type {unknown} */ t) => { try { return typeof t === 'string' ? JSON.parse(t) : null; } catch { return null; } };
const fromOf = (/** @type {unknown} */ v) => (Number.isSafeInteger(v) && /** @type {number} */ (v) > 0 ? /** @type {number} */ (v) : 0);
/** A note the design requires: said, trimmed, bounded - or null. */
const noteOf = (/** @type {unknown} */ v) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, NOTE_MAX) : null);
/** A page of `all` from `from`, with the offset of the next. */
const pageOf = (/** @type {any[]} */ all, /** @type {number} */ from) => ({ next: from + REALM_PAGE < all.length ? from + REALM_PAGE : null, total: all.length, page: all.slice(from, from + REALM_PAGE) });
const accountOf = (/** @type {any} */ r) => ({ id: r.player, name: displayName(r) });
const levelBy = (/** @type {number} */ score) => (score >= GAINS_HIGH ? 'high' : score >= GAINS_MEDIUM ? 'medium' : 'low');

/** A character's row with its account's name, by its id - or null. */
const charRow = (/** @type {any} */ db, /** @type {unknown} */ id) => (typeof id === 'string' && REALM_ID_RE.test(id)
  ? db.prepare('SELECT c.*, p.handle, p.guest_name FROM realm_characters c LEFT JOIN players p ON p.id = c.player WHERE c.id = ?1').bind(id).first()
  : Promise.resolve(null));
/** A removal from this character's save still kept - Roll back waits on it (design doc weak spots: "Run Roll back before
 *  Remove"). */
const removalKept = (/** @type {any} */ db, /** @type {string} */ charId, /** @type {number} */ nowS) => db.prepare(
  "SELECT id FROM staff_evidence WHERE char_id = ?1 AND kind = 'player' AND state = 'kept' AND until > ?2 LIMIT 1",
).bind(charId, nowS).first();
/** THE LEDGER'S TRAIL of a piece's key (design doc weak spots: "Copies found ... can blame an innocent player ... require a
 *  trail check before Remove"): who holds it and since when, a claim on it, and every copy written down. Remove from a
 *  player and Remove from market both ask it. */
const trailOf = async (/** @type {any} */ db, /** @type {string} */ key) => {
  const [uid, copies] = await Promise.all([
    db.prepare('SELECT char_id, player, state, at, claim_char, claim_at FROM item_uids WHERE uid = ?1').bind(key).first(),
    db.prepare('SELECT char_id, at, trail_at FROM item_dupes WHERE uid = ?1 ORDER BY at LIMIT 20').bind(key).all(),
  ]);
  return { uid, dupes: /** @type {any[]} */ (copies?.results ?? []) };
};
/** The ledger row's columns, as Put back finds them and leaves them (a row its removal did not take). */
const UID_COLS = Object.freeze(['player', 'char_id', 'seen_seq', 'state', 'fp', 'claim_char', 'claim_at', 'at']);

/**
 * A TRADE HOLD'S LEVEL, and why - from what the judge already wrote on the row (verdict.js) and its newest finding.
 * Starting numbers to tune: wealth past the allowance and copies found are the economy's damage (high), the law's own
 * hold medium, staff's own hold and the cutover's flag low (a person already looked).
 * @param {any} c the row, with `finding` (`{ kind, detail }` - its newest of the judge's) and `staff` (its newest staff act)
 * @returns {{ level: 'high'|'medium'|'low', why: string[] }}
 */
export function holdUrgency(c) {
  const why = [];
  let rank = 0;
  const f = c.finding;
  if (c.held === 'budget') { rank = 2; why.push(`wealth ${c.wealth ?? '?'} against allowance ${c.allowance ?? '?'}`); }
  if (c.held === 'law') {
    rank = Math.max(rank, 1);
    const codes = f?.kind === 'law' && Array.isArray(f.detail?.findings) ? [...new Set(f.detail.findings.map((/** @type {any} */ x) => x?.code))].slice(0, 5) : [];
    why.push(codes.length ? `judge finding: ${codes.join(', ')}` : 'judge finding');
  }
  if (c.held === 'staff') why.push(c.staff?.note ? `staff note: ${c.staff.note}` : 'staff hold, no note');
  if (Number(c.dupes) > 0) { rank = 2; why.push(`${c.dupes} cop${Number(c.dupes) === 1 ? 'y' : 'ies'} found`); }
  if (Number(c.strikes) > 0) why.push(`${c.strikes} strike${Number(c.strikes) === 1 ? '' : 's'}`);
  if (Number(c.law_holds) > 0) why.push(`${c.law_holds} law hold${Number(c.law_holds) === 1 ? '' : 's'} served`);
  if (c.review === 'outlier') why.push('wealth far past its level when first judged');
  return { level: /** @type {'high'|'medium'|'low'} */ (LEVELS[rank]), why };
}

/** @type {WeakMap<object, Map<number, { at: number, rows: any[] }>>} the gains reads this isolate keeps, by the binding */
const gainsKept = new WeakMap();

/**
 * WEALTH PAST THE ALLOWANCE AND XP PAST THE LINE over the last `days`, ranked - every character the budget found gaining
 * past its bucket (verdict.js `measure`/`budget` findings: how far past, how often, its gold and goods as last judged) and
 * every account whose XP streams went past their line (progress_hours `over`), each scored in allowances past (its band's
 * cap - budget.js; a stream's cap - progress.js) and leveled by GAINS_HIGH and GAINS_MEDIUM. Kept GAINS_KEEP_MS.
 * @param {any} db @param {number} nowS @param {number} days
 */
export async function gainsRanked(db, nowS, days) {
  const root = db?.[DB_ROOT] ?? db;
  const mine = gainsKept.get(root) ?? new Map();
  gainsKept.set(root, mine);
  const had = mine.get(days);
  if (had && Date.now() - had.at < GAINS_KEEP_MS) return had.rows;
  const since = nowS - days * 24 * 3600;
  // STAFF-PANEL-SPEED: the configs, the characters and the accounts' XP asked together - none waits on another's answer
  const [config, line, charsRead, xpRead] = await Promise.all([budgetConfig(db), progressConfig(db), db.prepare(`SELECT f.char_id AS id, c.name, c.player, p.handle, p.guest_name, c.held, c.level_seen, COUNT(*) AS n,
      SUM(CAST(json_extract(f.detail, '$.over') AS INTEGER)) AS past, SUM(CAST(json_extract(f.detail, '$.gain') AS INTEGER)) AS gained, MAX(f.at) AS last,
      (SELECT g.detail FROM realm_findings g WHERE g.char_id = f.char_id AND g.kind IN ('measure', 'budget') ORDER BY g.id DESC LIMIT 1) AS latest
    FROM realm_findings f JOIN realm_characters c ON c.id = f.char_id LEFT JOIN players p ON p.id = c.player
    WHERE f.at >= ?1 AND f.kind IN ('measure', 'budget') GROUP BY f.char_id ORDER BY past DESC LIMIT ?2`).bind(since, GAINS_RANKED_MAX).all(),
    db.prepare(`SELECT h.player, p.handle, p.guest_name, h.stream, SUM(h.over) AS over, SUM(h.amount) AS amount, MAX(h.hour) AS last
    FROM progress_hours h LEFT JOIN players p ON p.id = h.player
    WHERE h.stream IN (${XP_STREAMS.map((_, i) => `?${i + 2}`).join(', ')}) AND h.hour >= ?1 AND h.over > 0
    GROUP BY h.player, h.stream ORDER BY over DESC LIMIT ${GAINS_RANKED_MAX}`).bind(since, ...XP_STREAMS).all()]);
  const chars = charsRead?.results ?? [];
  const xp = xpRead?.results ?? [];
  /** @type {Map<string, any>} the accounts' XP past the line, by stream */
  const xpOf = new Map();
  for (const x of xp) {
    const a = xpOf.get(x.player) ?? { account: accountOf(x), streams: {}, score: 0, last: 0 };
    a.streams[x.stream] = { over: Number(x.over), amount: Number(x.amount) };
    a.score = Math.max(a.score, Number(x.over) / Math.max(1, Number(line.streams?.[x.stream]?.cap) || 1));
    a.last = Math.max(a.last, Number(x.last));
    xpOf.set(x.player, a);
  }
  const xpWhy = (/** @type {any} */ a) => Object.entries(a.streams).map(([s, v]) => `${s === 'renown' ? 'Renown' : 'profession'} XP ${/** @type {any} */ (v).over} past the line`);
  const rows = chars.map((c) => {
    const d = parse(c.latest) ?? {};
    const cap = Math.max(1, Number(bandOf(config, Number(d.level ?? c.level_seen ?? 1)).cap) || 1);
    const past = Number(c.past) || 0;
    const a = xpOf.get(c.player) ?? null;
    const score = Math.max(past / cap, a?.score ?? 0);
    // the goods the verdict wrote (judge.js goodsOf, wealthOf's own worth), and the gold the rest of that same wealth - the
    // debt off it (FLAW REVIEW: gold read by customs' measure, the loan never off it, made the goods short, even below nothing)
    const wealth = Number.isSafeInteger(d.wealth) ? d.wealth : null;
    const goods = Number.isSafeInteger(d.goods) ? d.goods : null;
    const gold = wealth != null && goods != null ? wealth - goods : null;
    const why = [`wealth ${past} past the allowance in ${c.n} gain${Number(c.n) === 1 ? '' : 's'}`];
    if (gold != null) why.push(`as last judged: gold ${gold}, items ${goods}`);
    if (c.held) why.push(`trade held (${c.held})`);
    if (a) why.push(...xpWhy(a));
    return {
      char: { id: c.id, name: c.name }, account: accountOf(c), level: levelBy(score), why, score, last: Math.max(Number(c.last), a?.last ?? 0),
      wealth: { past, gained: Number(c.gained) || 0, times: Number(c.n), now: wealth, gold, items: goods, held: c.held ?? null },
      xp: a ? a.streams : null,
    };
  });
  const withChars = new Set(chars.map((c) => c.player));
  for (const [player, a] of xpOf) {
    if (withChars.has(player)) continue;
    rows.push({ char: null, account: a.account, level: levelBy(a.score), why: xpWhy(a), score: a.score, last: a.last, wealth: null, xp: a.streams });
  }
  rows.sort((x, y) => LEVELS.indexOf(y.level) - LEVELS.indexOf(x.level) || y.score - x.score || y.last - x.last);
  mine.set(days, { at: Date.now(), rows });
  return rows;
}

/** The Home screen's roll-up (the status build's registry): the gains' most urgent, an account each line. */
export const HOME_WATCH = Object.freeze({
  id: 'gains', label: 'Wealth past the allowance', role: 'admin',
  /** @param {any} ctx @param {any} env @param {any} who @param {number} n */
  top: async (ctx, env, who, n) => {
    const all = await gainsRanked(ctx.db, ctx.nowS, GAINS_DAYS);
    return { items: all.slice(0, n).map((r) => ({ level: r.level, why: r.why, sub: r.account.id, name: r.char?.name ?? r.account.name })), high: all.filter((r) => r.level === 'high').length, total: all.length };
  },
});

/** A piece taken out of `node` where it lies, by identity (the record is parsed JSON - no piece stands twice): spliced from
 *  its list, or its key deleted (a room's set-out piece, a companion's kit - possessedItemLists hands those on in a list
 *  of their own). Answers whether it was found. @param {any} node @param {any} piece */
export function takeOut(node, piece) {
  if (Array.isArray(node)) {
    const i = node.indexOf(piece);
    if (i >= 0) { node.splice(i, 1); return true; }
    return node.some((x) => x && typeof x === 'object' && takeOut(x, piece));
  }
  for (const [k, v] of Object.entries(node)) {
    if (v === piece) { delete node[k]; return true; }
    if (v && typeof v === 'object' && takeOut(v, piece)) return true;
  }
  return false;
}

/**
 * THE PANEL'S TRADE HOLD, ROLLBACK, FIX, GAINS AND REMOVAL DOORS - Admins alone. Answers the route's body, or `{ error }`
 * (staff.js STAFF_STATUS its status).
 * @param {any} ctx @param {any} env @param {string} path @param {any} body
 * @param {{ player: any, role: string }} who
 * @param {(act: string, target?: string|null, detail?: object|null, how?: object) => any} audit
 */
export async function staffRealm(ctx, env, path, body, who, audit) {
  const { db, nowS, rand } = ctx;
  if (who.role !== 'admin') {
    await audit('refused', null, { path, need: 'admin' }, { outcome: 'denied' }).run();
    return { error: 'staff-admin' };
  }
  const c = { ...ctx, bucket: env?.SAVES ?? ctx.bucket ?? null };   // the realm's records (R2), as the review's door hands them
  const me = who.player;
  const by = me.handle;
  const playing = (/** @type {any} */ r) => !!r.lease && nowS - Number(r.lease_at ?? 0) < REALM_PLAYING_S;
  /** An act's audit row with its outcome - a refusal 'failed' with its word - and its answer handed back. */
  const said = async (/** @type {string} */ act, /** @type {string|null} */ target, /** @type {any} */ detail, /** @type {any} */ r) => {
    await (r?.error ? audit(act, target, { ...detail, error: r.error }, { outcome: 'failed' }) : audit(act, target, detail)).run();
    return r;
  };
  /** A CONTESTED PIECE (trailOf) is removed only with `trail: true` - and a copy written down on `charId`, the character it
   *  is taken from, only once its trail check is recorded (STAFF-PANEL4-CENSUS's contract: staffCensus.js
   *  /v1/staff/contested/trail, item_dupes.trail_at) - a confirm in the preview is not that check. */
  const trailRefused = (/** @type {boolean} */ contested, /** @type {any[]} */ dupes, /** @type {string|null} */ charId) =>
    contested && (body.trail !== true || dupes.some((d) => d.char_id === charId && d.trail_at == null));

  if (path === '/v1/staff/trade-holds') {
    const sort = body.sort === 'newest' ? 'newest' : 'urgent';
    const from = fromOf(body.from);
    // STAFF-PANEL-SPEED: the read and its audit row in one batch; 0162's index walks the holds newest first, a tie as its old scan gave it
    const [read] = await db.batch([db.prepare(`SELECT c.id, c.name, c.player, p.handle, p.guest_name, c.held, c.held_at, c.held_until, c.strikes, c.law_holds, c.dupes, c.review,
        c.wealth, c.allowance, c.lease, c.lease_at, c.dead_at,
        (SELECT json_object('kind', f.kind, 'at', f.at, 'detail', json(f.detail)) FROM realm_findings f WHERE f.char_id = c.id AND f.kind != 'staff' ORDER BY f.id DESC LIMIT 1) AS finding,
        (SELECT json_object('at', f.at, 'detail', json(f.detail)) FROM realm_findings f WHERE f.char_id = c.id AND f.kind = 'staff' AND json_extract(f.detail, '$.act') = 'hold' ORDER BY f.id DESC LIMIT 1) AS staff
      FROM realm_characters c LEFT JOIN players p ON p.id = c.player
      WHERE c.held IS NOT NULL OR c.review IS NOT NULL ORDER BY c.held_at DESC LIMIT ?1`).bind(HOLDS_RANKED_MAX),
    audit('trade-holds-read', null, { sort }, { onceIn: READ_ROW_S })]);
    const rows = read?.results ?? [];
    const ranked = rows.map((r) => {
      const finding = parse(r.finding);
      const s = parse(r.staff);
      const staff = s ? { act: s.detail?.act ?? null, by: s.detail?.by ?? null, note: s.detail?.note ?? null, at: s.at } : null;
      const u = holdUrgency({ ...r, finding, staff });
      return {
        id: r.id, name: r.name, account: accountOf(r), held: r.held, since: r.held_at ?? null, until: r.held_until ?? null, strikes: r.strikes, lawHolds: r.law_holds ?? 0,
        copies: r.dupes ?? 0, wealth: r.wealth, allowance: r.allowance, review: r.review, finding, staffNote: staff, level: u.level, why: u.why,
        playing: playing(r), dead: r.dead_at != null,
      };
    });
    if (sort === 'urgent') ranked.sort((x, y) => LEVELS.indexOf(y.level) - LEVELS.indexOf(x.level) || Number(y.since ?? 0) - Number(x.since ?? 0));
    const { page, next, total } = pageOf(ranked, from);
    return { characters: page, next, total };
  }

  if (path === '/v1/staff/gains') {
    const days = Number.isSafeInteger(body.days) && body.days >= 1 && body.days <= GAINS_DAYS_MAX ? body.days : GAINS_DAYS;
    const sort = body.sort === 'newest' ? 'newest' : 'urgent';
    // STAFF-PANEL-SPEED: the audit row with the gains' reads, one trip
    const [all] = await Promise.all([gainsRanked(db, nowS, days), audit('gains-read', null, { days, sort }, { onceIn: READ_ROW_S }).run()]);
    const list = sort === 'newest' ? [...all].sort((x, y) => y.last - x.last) : all;
    const { page, next, total } = pageOf(list, fromOf(body.from));
    return { days, gains: page, next, total };
  }

  if (path === '/v1/staff/evidence') {
    const filter = body.target !== undefined || body.name !== undefined ? await findAccount(db, { target: body.target, name: body.name }) : null;
    if (filter && 'error' in filter) return filter;
    const from = fromOf(body.from);
    const rows = (await db.prepare(`SELECT e.*, p.handle, p.guest_name, c.name AS char_name FROM staff_evidence e LEFT JOIN players p ON p.id = e.player
      LEFT JOIN realm_characters c ON c.id = e.char_id WHERE (?1 IS NULL OR e.player = ?1) ORDER BY e.at DESC, e.id LIMIT ?2 OFFSET ?3`)
      .bind(filter?.id ?? null, REALM_PAGE + 1, from).all())?.results ?? [];
    await audit('evidence-read', filter?.id ?? null, null, { onceIn: READ_ROW_S }).run();
    return {
      evidence: rows.slice(0, REALM_PAGE).map((e) => ({
        id: e.id, kind: e.kind, account: accountOf(e), char: e.char_id ? { id: e.char_id, name: e.char_name ?? null } : null, source: e.source, item: parse(e.item),
        key: e.key, detail: parse(e.detail), reason: e.reason, note: e.note, by: { id: e.by_id, name: e.by_name }, at: e.at, until: e.until, state: e.state,
        returnedAt: e.returned_at ?? null, returnedBy: e.returned_by ?? null, canPutBack: e.state === 'kept' && e.until > nowS,
      })),
      next: rows.length > REALM_PAGE ? from + REALM_PAGE : null,
    };
  }

  // ═══ THE MARKET'S REMOVALS (design doc "Remove items") - a listing or an auction, by its id ═══
  if (path === '/v1/staff/market/pull' || path === '/v1/staff/market/remove') {
    const act = path === '/v1/staff/market/pull' ? 'market-pull' : 'market-remove';
    const reason = REMOVE_REASONS.includes(body.reason) ? body.reason : null;
    const note = noteOf(body.note);
    const id = typeof body.listing === 'string' ? body.listing : '';
    const escrowed = (/** @type {string} */ t) => `SELECT x.*, (SELECT e.item FROM piece_escrow e WHERE e.provenance = x.provenance) AS escrowed FROM ${t} x WHERE x.id = ?1`;
    const l = id ? await db.prepare(escrowed('market_listings')).bind(id).first() : null;
    const a = id && !l ? await db.prepare(escrowed('market_auctions')).bind(id).first() : null;
    const row = l ?? a;
    const detail = { listing: id.slice(0, 40), reason, note, char: row?.char_id ?? null };
    if (!reason) return said(act, row?.seller ?? null, detail, { error: 'staff-reason' });
    if (!note) return said(act, row?.seller ?? null, detail, { error: 'staff-note' });
    // from here the act's ONE audit row is written by the shared act itself, in its own batch, with its outcome (market.js
    // marketRemove `audit` - FLAW REVIEW: the game's door wrote none), never a second one here
    const inside = (/** @type {object} */ extra) => (/** @type {{ target: string|null, okIf?: any, error?: string }} */ how) =>
      audit(act, how.target, { ...detail, ...extra, ...(how.error ? { error: how.error, evidence: undefined } : {}) }, how.okIf ? { okIf: how.okIf } : { outcome: 'failed' });
    if (act === 'market-pull') {
      // Pull: the listing ends and its goods go back to the seller on their next read (market.js marketRemove)
      return marketRemove(c, me, env, { listing: id }, { audit: inside({}) });
    }
    // Remove: the goods kept here 30 days instead, and the piece's ledger row marked taken (ledger.js SEIZED)
    const item = row ? (l?.item ?? row.escrowed ?? null) : null;
    const key = row ? (l?.kind === 'item' ? ledgerKeyOf(parse(l.item)) : row.provenance ?? null) : null;
    if (key) {
      // THE TRAIL CHECK Remove from a player asks (FLAW REVIEW: a contested piece was seized here unasked): copies of the
      // piece written down, or its row not the market's own unclaimed hold (another holds it, a claim on it)
      const { uid, dupes } = await trailOf(db, key);
      const contested = dupes.length > 0 || (!!uid && (uid.state !== 'escrow' || uid.char_id !== '' || uid.claim_char != null));
      if (trailRefused(contested, dupes, row?.char_id ?? null)) return said(act, row?.seller ?? null, { ...detail, key }, { error: 'staff-trail' });
    }
    const eid = mintId(rand);
    const table = l ? 'listing' : 'auction';
    const also = (/** @type {string} */ nonce, /** @type {string} */ t) => (t !== table ? [] : [
      db.prepare(`INSERT INTO staff_evidence (id, kind, player, char_id, source, item, key, detail, reason, note, by_id, by_name, at, until)
        SELECT ?1, ?2, seller, char_id, id, ?3, ?4, json_object('kind', ${l ? "kind, 'material', material, 'units', own + bought, 'price', price, 'currency', currency" : "'auction', 'opening', opening, 'high', high"},
          'provenance', provenance, 'wear', wear, 'region', region, 'rn', rn), ?5, ?6, ?7, ?8, ?9, ?10
        FROM ${l ? 'market_listings' : 'market_auctions'} WHERE id = ?11 AND rn = ?12 AND state = 'removed'`)
        .bind(eid, table, item, key, reason, note, me.id, displayName(me), nowS, nowS + EVIDENCE_KEEP_S, id, nonce),
      ...(key ? [db.prepare(`UPDATE item_uids SET char_id = ?2, claim_char = NULL, claim_at = NULL, at = ?3 WHERE uid = ?1 AND state = 'escrow' AND char_id = ''
        AND EXISTS (SELECT 1 FROM staff_evidence WHERE id = ?4)`).bind(key, SEIZED, nowS, eid)] : []),
    ]);
    const r = await marketRemove(c, me, env, { listing: id }, { keep: true, also, audit: inside({ evidence: eid, key }) });
    return r.error ? r : { ok: true, evidence: eid, until: nowS + EVIDENCE_KEEP_S };
  }

  if (path === '/v1/staff/evidence/return') {
    const note = noteOf(body.note);
    const ev = typeof body.id === 'string' ? await db.prepare('SELECT * FROM staff_evidence WHERE id = ?1').bind(body.id).first() : null;
    if (!ev) return { error: 'staff-evidence' };
    const detail = { evidence: ev.id, kind: ev.kind, char: ev.char_id, note };
    if (!note) return said('evidence-return', ev.player, detail, { error: 'staff-note' });
    if (ev.state !== 'kept' || ev.until <= nowS) return said('evidence-return', ev.player, detail, { error: 'staff-evidence-gone' });
    const back = db.prepare("UPDATE staff_evidence SET state = 'returned', returned_at = ?2, returned_by = ?3 WHERE id = ?1 AND state = 'kept' AND until > ?2").bind(ev.id, nowS, me.id);
    if (ev.kind !== 'player') {
      // the market's: its mark cleared, so the seller's next read settles the goods back as any removal's (market.js settle)
      const t = ev.kind === 'listing' ? 'market_listings' : 'market_auctions';
      try {
        await db.batch([
          back, mustChange(db),
          db.prepare(`UPDATE ${t} SET returned = 0, rn = NULL WHERE id = ?1 AND state = 'removed' AND returned = 1 AND rn = json_extract(?2, '$.rn')`).bind(ev.source, ev.detail),
          mustChange(db),
          ...(ev.key ? [db.prepare("UPDATE item_uids SET char_id = '' WHERE uid = ?1 AND state = 'escrow' AND char_id = ?2").bind(ev.key, SEIZED)] : []),
        ]);
      } catch {
        return said('evidence-return', ev.player, detail, { error: 'staff-evidence-gone' });
      }
      return said('evidence-return', ev.player, detail, { ok: true, evidence: ev.id, kind: ev.kind });
    }
    // a player's: the piece back into the pack of the record as it stands, one save on (the take's way, run back) - a
    // record that already shows the piece again gets no second one (`shown`) - and THE LEDGER AS THE REMOVAL FOUND IT
    // (FLAW REVIEW: Put back handed the row to the record a copy was taken from, off its real holder, and cleared the copy
    // mark): the row the removal took (`seized`, still taken) the record's again; any other row - another record's piece,
    // the market's, one taken from another record - left exactly as it stands, over what ledgerMoves' `entered` writes; and
    // the record's own copy mark kept where the removal found one (`copy`), else cleared - a save that showed the taken
    // piece again was written a copy of a row staff held. The batch is refused if that row moves meanwhile.
    const row = await charRow(db, ev.char_id);
    if (!row) return said('evidence-return', ev.player, detail, { error: 'no-realm-character' });
    if (row.dead_at != null) return said('evidence-return', ev.player, detail, { error: 'dead' });
    const took = parse(ev.detail) ?? {};
    const [uidNow, copyNow] = ev.key ? await Promise.all([
      db.prepare(`SELECT ${UID_COLS.join(', ')} FROM item_uids WHERE uid = ?1`).bind(ev.key).first(),
      db.prepare('SELECT * FROM item_dupes WHERE uid = ?1 AND char_id = ?2').bind(ev.key, row.id).first(),
    ]) : [null, null];
    const mine = took.seized === true && uidNow?.state === 'escrow' && uidNow.char_id === SEIZED;
    const uidVals = uidNow ? UID_COLS.map((k) => uidNow[k]) : [];
    const copyCols = copyNow && (!mine || took.copy === true) ? Object.keys(copyNow) : [];
    const piece = parse(ev.item);
    let shown = false;
    const prep = await seizeRealmRecord(c, row.player, row.id, (save) => {
      if (!piece || typeof piece !== 'object') return 'staff-no-piece';
      shown = !!ev.key && possessedItemLists(save).some((l) => l.some((it) => ledgerKeyOf(it) === ev.key));
      if (shown) return null;
      if (!Array.isArray(save.items)) save.items = [];
      save.items.push(piece);
      return null;
    }, { escrow: false });
    if ('error' in prep) return said('evidence-return', ev.player, detail, { error: prep.error });
    try {
      await db.batch([
        back, mustChange(db),
        ...(uidNow ? [db.prepare(`UPDATE item_uids SET at = at WHERE uid = ?1 AND ${UID_COLS.map((k, i) => `${k} IS ?${i + 2}`).join(' AND ')}`).bind(ev.key, ...uidVals), mustChange(db)] : []),
        ...prep.steps,
        ...(ev.key ? [
          ...(mine ? [db.prepare(`UPDATE item_uids SET player = ?3, char_id = ?4, seen_seq = ?5, state = 'held', claim_char = NULL, claim_at = NULL, at = ?6
            WHERE uid = ?1 AND state = 'escrow' AND char_id = ?2`).bind(ev.key, SEIZED, row.player, row.id, prep.seq, nowS)]
            : uidNow ? [db.prepare(`UPDATE item_uids SET ${UID_COLS.map((k, i) => `${k} = ?${i + 2}`).join(', ')} WHERE uid = ?1`).bind(ev.key, ...uidVals)] : []),
          db.prepare('DELETE FROM item_dupes WHERE uid = ?1 AND char_id = ?2').bind(ev.key, row.id),
          ...(copyCols.length ? [db.prepare(`INSERT INTO item_dupes (${copyCols.join(', ')}) VALUES (${copyCols.map((_, i) => `?${i + 1}`).join(', ')})`).bind(...copyCols.map((k) => copyNow[k]))] : []),
        ] : []),
        staffFinding(db, row, nowS, { act: 'put-back', by, note, evidence: ev.id, key: ev.key ?? null, from: row.seq, to: prep.seq, shown }),
      ]);
    } catch {
      await dropIfUnnamed(db, c.bucket, row.player, row.id, prep.key);
      return said('evidence-return', ev.player, detail, { error: 'seq' });
    }
    await dropObjects(c.bucket, [prep.prev]);
    return said('evidence-return', ev.player, { ...detail, shown }, { ok: true, evidence: ev.id, kind: ev.kind, seq: prep.seq, shown, playing: playing(row) });
  }

  // ═══ ONE ACCOUNT'S EVERY CHARACTER HELD (design doc weak spots: "Offer 'hold every character on this account'") ═══
  if (path === '/v1/staff/trade-hold' && body.id === undefined) {
    const account = await findAccount(db, { target: body.target, name: body.name });
    const note = noteOf(body.note);
    // an account the lookup cannot name is a failed hold, written down (FLAW REVIEW: it left no row)
    if ('error' in account) return said('trade-hold', null, { all: true, asked: String(body.target ?? body.name ?? '').slice(0, 64), note }, account);
    const chars = (await db.prepare('SELECT id, name FROM realm_characters WHERE player = ?1 AND dead_at IS NULL ORDER BY created_at').bind(account.id).all())?.results ?? [];
    const held = [];
    for (const ch of chars) {
      const r = await reviewAct(c, me, env, 'hold', { id: ch.id, note });
      if (!r.error) held.push({ id: ch.id, name: ch.name });
    }
    return said('trade-hold', account.id, { all: true, chars: held.map((h) => h.id), note }, held.length ? { ok: true, held } : { error: 'no-realm-character' });
  }

  // ═══ ONE CHARACTER'S DOORS, by its id ═══
  const row = await charRow(db, body.id);
  if (!row) return typeof body.id === 'string' ? { error: 'no-realm-character' } : { error: 'body' };
  const ch = { char: row.id, name: row.name };

  if (path === '/v1/staff/findings') {
    const r = await reviewAct(c, me, env, 'findings', { id: row.id });
    if (r.error) return r;
    const kept = await removalKept(db, row.id, nowS);
    await audit('findings-read', row.player, ch, { onceIn: READ_ROW_S }).run();
    return { ...r, account: accountOf(row), playing: playing(row), removalKept: kept?.id ?? null };
  }

  if (path === '/v1/staff/trade-hold') {
    const note = noteOf(body.note);
    const r = await reviewAct(c, me, env, 'hold', { id: row.id, note });
    return said('trade-hold', row.player, { ...ch, note }, r.error ? r : { ok: true, held: [{ id: row.id, name: row.name }] });
  }

  if (path === '/v1/staff/trade-unhold') {
    // review.js `clear`: the hold lifted with its strikes and timed holds, the standing finding EXCUSED (the same signature
    // holds nothing again) and the allowance refilled - the answer says all of it (design doc weak spots: "Unfreeze trade
    // also excuses the finding and refills the allowance, so its button says so")
    const note = noteOf(body.note);
    const r = await reviewAct(c, me, env, 'clear', { id: row.id, note });
    return said('trade-unhold', row.player, { ...ch, note, was: row.held }, r.error ? r : {
      ok: true, lifted: row.held ?? null, excused: row.law_sig ?? null, allowanceRefilled: true, strikesCleared: Number(row.strikes) || 0, lawHoldsCleared: Number(row.law_holds) || 0,
    });
  }

  if (path === '/v1/staff/rollback') {
    // what Roll back moves, and what it leaves - the Stores, the Drakes and the market purse live outside the save (design
    // doc weak spots: "show what a rollback will not undo ... before staff confirm")
    const kept = await removalKept(db, row.id, nowS);
    const blocked = row.dead_at != null ? 'dead' : !row.clean_obj ? 'no-clean' : row.svc_seq != null && row.svc_seq > (row.clean_seq ?? 0) ? 'service-moved' : kept ? 'staff-remove-pending' : null;
    if (body.confirm === true) {
      if (blocked) return said('rollback', row.player, ch, { error: blocked });
      const note = noteOf(body.note);
      const r = await reviewAct(c, me, env, 'rollback', { id: row.id, note });
      // the hold it leaves: staff's own stands through it (review.js), any other is lifted with what made it
      return said('rollback', row.player, { ...ch, note, from: row.seq, to: row.clean_seq }, r.error ? r : { ...r, held: row.held === 'staff' ? 'staff' : null });
    }
    let clean = null;
    let cleanAt = null;
    if (row.clean_obj && c.bucket) {
      const object = await c.bucket.get(row.clean_obj);
      clean = parse(await realmSaveTextOf(object));
      const up = object?.uploaded instanceof Date ? object.uploaded.getTime() : null;
      cleanAt = up != null ? Math.floor(up / 1000) : null;
    }
    const [stores, deposits, purse, drakes] = await Promise.all([
      db.prepare('SELECT COALESCE(SUM(qty), 0) AS units, COUNT(DISTINCT material) AS kinds FROM prof_stores WHERE player = ?1 AND char_id = ?2').bind(row.player, row.id).first(),
      cleanAt != null ? db.prepare('SELECT COALESCE(SUM(qty), 0) AS units, COUNT(*) AS n FROM prof_deposits WHERE player = ?1 AND char_id = ?2 AND at >= ?3').bind(row.player, row.id, cleanAt).first() : null,
      db.prepare('SELECT gold FROM market_gold WHERE player = ?1 AND char_id = ?2').bind(row.player, row.id).first(),
      balanceOf(db, row.player),
    ]);
    await audit('rollback-check', row.player, ch, { onceIn: READ_ROW_S }).run();
    return {
      character: { id: row.id, name: row.name, account: accountOf(row) }, from: row.seq, to: row.clean_seq ?? null, cleanAt, blocked, removalKept: kept?.id ?? null,
      playing: playing(row), held: row.held ?? null, keepsStaffHold: row.held === 'staff',
      wealth: { now: row.wealth ?? null, then: clean ? wealthOf(clean) : null },
      notUndone: {
        stores: { units: Number(stores?.units ?? 0), materials: Number(stores?.kinds ?? 0), sinceClean: deposits ? { units: Number(deposits.units), deposits: Number(deposits.n) } : null },
        drakes, marketPurse: Number(purse?.gold ?? 0),
      },
    };
  }

  if (path === '/v1/staff/fix/repair' || path === '/v1/staff/fix/mend') {
    // review.js `repair` and `mend`, as buttons with a note instead of scripts (design doc "Fix account")
    const act = path === '/v1/staff/fix/repair' ? 'repair' : 'mend';
    const note = noteOf(body.note);
    if (!note) return said(`fix-${act}`, row.player, ch, { error: 'staff-note' });
    const { ticket, faction, flag, gold, was } = body;
    const r = await reviewAct(c, me, env, act, act === 'repair' ? { id: row.id, note, ticket, faction, flag, gold } : { id: row.id, note, ticket, was, gold });
    const detail = { ...ch, note, ticket: typeof ticket === 'string' ? ticket.slice(0, 64) : null, gold: Number.isSafeInteger(gold) ? gold : null, ...(act === 'repair' ? { faction, flag } : { was }) };
    return said(`fix-${act}`, row.player, detail, r.error ? r : { ...r, playing: playing(row) });
  }

  if (path === '/v1/staff/item/take') return takeAct();
  return { error: 'not-found' };

  /**
   * REMOVE FROM A PLAYER (design doc "Remove items"): the piece the panel names - `at: [list, index]` in the record's
   * possessedItemLists at `seq`, or its ledger `key` - shown first (no `confirm`: the piece, its worth, the ledger's trail,
   * whether they are playing), then, `confirm: true` with a reason and a note, taken: the record one save on with its seat
   * taken (realm.js seizeRealmRecord `take`), the piece kept 30 days, its ledger row marked taken (SEIZED), all in one batch.
   */
  async function takeAct() {
    let at = Array.isArray(body.at) && body.at.length === 2 && body.at.every(Number.isSafeInteger) ? /** @type {[number, number]} */ (body.at) : null;
    // a confirmed removal refused before its piece is read is written down failed as any other (FLAW REVIEW: it left no row)
    const early = (/** @type {string} */ error) => (body.confirm === true
      ? said('item-take', row.player, { ...ch, key: typeof body.key === 'string' ? body.key.slice(0, 40) : null, at }, { error }) : { error });
    if (row.dead_at != null) return early('dead');
    if (!c.bucket || !row.obj) return early('no-data');
    const save = parse(await realmSaveTextOf(await c.bucket.get(row.obj)));
    if (!save || typeof save !== 'object') return early('no-data');
    const lists = possessedItemLists(save);
    if (!at && typeof body.key === 'string') {
      for (let li = 0; li < lists.length && !at; li++) { const ii = lists[li].findIndex((it) => ledgerKeyOf(it) === body.key); if (ii >= 0) at = [li, ii]; }
    }
    const piece = at ? lists[at[0]]?.[at[1]] : null;
    if (!at || !piece || typeof piece !== 'object' || (typeof body.key === 'string' && ledgerKeyOf(piece) !== body.key)) return early('staff-no-piece');
    const key = ledgerKeyOf(piece);
    // THE LEDGER'S TRAIL (trailOf), and whether this record carries a copy mark of its own on the key (Put back keeps one)
    const [{ uid, dupes }, own] = key ? await Promise.all([
      trailOf(db, key),
      db.prepare('SELECT 1 AS y FROM item_dupes WHERE uid = ?1 AND char_id = ?2').bind(key, row.id).first(),
    ]) : [{ uid: null, dupes: [] }, null];
    const twice = key ? lists.flat().filter((it) => ledgerKeyOf(it) === key).length > 1 : false;
    const contested = !!key && (twice || dupes.length > 0 || (!!uid && (uid.char_id !== row.id || uid.state !== 'held' || uid.claim_char != null)));
    const trail = key ? {
      holder: uid ? { char: uid.char_id || null, account: uid.player, state: uid.char_id === SEIZED ? 'taken by staff' : uid.state, since: uid.at } : null,
      claim: uid?.claim_char ? { char: uid.claim_char, at: uid.claim_at } : null, copies: dupes, twiceHere: twice,
    } : null;
    if (body.confirm !== true) {
      await audit('take-check', row.player, { ...ch, key }, { onceIn: READ_ROW_S }).run();
      let worth = null;
      try { worth = itemWorth(piece); } catch { worth = null; }
      return { character: { id: row.id, name: row.name, account: accountOf(row) }, seq: row.seq, at, piece, key, worth, contested, trail, playing: playing(row) };
    }
    const reason = REMOVE_REASONS.includes(body.reason) ? body.reason : null;
    const note = noteOf(body.note);
    const detail = { ...ch, key, reason, note, at };
    if (!reason) return said('item-take', row.player, detail, { error: 'staff-reason' });
    if (!note) return said('item-take', row.player, detail, { error: 'staff-note' });
    if (body.seq !== row.seq) return said('item-take', row.player, detail, { error: 'seq' });   // the record moved since staff looked
    if (trailRefused(contested, dupes, row.id)) return said('item-take', row.player, detail, { error: 'staff-trail' });
    const want = JSON.stringify(piece);
    const where = /** @type {[number, number]} */ (at);
    const prep = await seizeRealmRecord(c, row.player, row.id, (s) => {
      const got = possessedItemLists(s)[where[0]]?.[where[1]];
      if (!got || JSON.stringify(got) !== want) return 'seq';   // not the save staff looked at
      return takeOut(s, got) ? null : 'staff-no-piece';
    }, { escrow: false, take: true });
    if ('error' in prep) return said('item-take', row.player, detail, { error: prep.error });
    const eid = mintId(rand);
    try {
      await db.batch([
        ...prep.steps,
        // the piece's ledger row, taken by staff - whether this record held it (its row let go just above, or kept `gone`
        // for a known copy) or the ledger had never heard of it; a row another record holds stays theirs (this one's was a
        // copy), and this record's claim on it is withdrawn
        ...(key ? [
          db.prepare('UPDATE item_uids SET claim_char = NULL, claim_at = NULL WHERE uid = ?1 AND claim_char = ?2').bind(key, row.id),
          db.prepare(`INSERT INTO item_uids (uid, player, char_id, seen_seq, state, fp, at) VALUES (?1, ?2, ?3, ?4, 'escrow', ?5, ?6)
            ON CONFLICT (uid) DO UPDATE SET state = 'escrow', char_id = ?3, claim_char = NULL, claim_at = NULL, at = excluded.at
            WHERE item_uids.state = 'gone' AND item_uids.char_id = ?7`).bind(key, row.player, SEIZED, prep.seq, ledgerPrintOf(piece), nowS, row.id),
        ] : []),
        db.prepare(`INSERT INTO staff_evidence (id, kind, player, char_id, source, item, key, detail, reason, note, by_id, by_name, at, until)
          VALUES (?1, 'player', ?2, ?3, NULL, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`)
          // `seized`: the row this take marks taken - the record's own, or none the ledger knew (the upsert above); `copy`:
          // the record's own copy mark it found - what Put back gives back, and keeps
          .bind(eid, row.player, row.id, want, key, JSON.stringify({ at, from: row.seq, to: prep.seq, seized: !uid || uid.char_id === row.id, copy: !!own }), reason, note, me.id, displayName(me), nowS, nowS + EVIDENCE_KEEP_S),
        staffFinding(db, row, nowS, { act: 'take', by, note, reason, evidence: eid, key, from: row.seq, to: prep.seq }),
      ]);
    } catch {
      await dropIfUnnamed(db, c.bucket, row.player, row.id, prep.key);
      return said('item-take', row.player, detail, { error: 'seq' });
    }
    await dropObjects(c.bucket, [prep.prev]);
    return said('item-take', row.player, { ...detail, evidence: eid }, { ok: true, evidence: eid, until: nowS + EVIDENCE_KEEP_S, seq: prep.seq, playing: playing(row) });
  }
}
