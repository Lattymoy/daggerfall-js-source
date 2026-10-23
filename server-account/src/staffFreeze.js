// @ts-check
// ═══════════════════════════════════════════════════════════════════
// STAFF-PANEL5-FREEZE (2026-10-22; design doc "DFO Staff Panel: design", Freeze player, and its weak spots) - FREEZE PLAYER
// AND THE STAFF CHAT, the account service's half.
//
// A FREEZE IS A SANCTION OF ITS OWN, beside the mute and the ban (mob, 03:05Z: "the player can only look around"): an Admin's
// act with a reason and a duration, Admins alone both ways, kept on the account's row with who made it
// (`players.frozen_until`, `frozen_reason`, `frozen_by` - migration 0160). Every relay token minted while it stands carries
// it (`fz`, identityToken.js), so a reload never sheds it (Weak spots: "A reload sheds a freeze"); its own order kind
// (`freeze`, mintFreezeOrder) goes to the relay's law door, where the hub keeps it in a stored book of its own, as a ban's
// (server/src/staffFreeze.js), and every room learns it from the lease (net/roomLease.js) or the token.
//
// A FAILED PUSH IS SAID, AND TRIED AGAIN (Weak spots: "A failed push leaves a freeze or unfreeze unapplied"): each act
// counts a revision (`freeze_rev`) and is `freeze_live` 0 until the relay's door took its order - the panel shows "saved,
// not live yet" - and the minute's clock (cron.js freeze-push) pushes a FRESH order for each act still waiting, as does the
// panel's own button (/v1/staff/freeze-push). A push marks only its own revision live, never a newer act's - and one that
// finds its revision moved on while its order went pushes the row as it stands after it (STAFF-PANEL5-FREEZE-FIX, a review:
// a retry read before a newer act landed after that act's order, and the hub held the stale word while the panel said live).
//
// ONE FREEZE GATE beside the ban gate (index.js; Weak spots: "Freeze blocks only some routes, and checkpoints still save"):
// a frozen account is answered `frozen` on every door behind a session but a short list - signing out, its own account,
// the realm doors that load the character it looks around as, the relay token and the staff chat (`freezeRefusal`). The
// checkpoint asks the freeze in its own read and the beat in its own write (realm.js checkpointRealm, accounts.js
// creditPlay), since a hot route believes a pass minted before the freeze. A fall that names a frozen account is refused
// (wild.js wildFall: a killer filing the fall of a frozen player), and a market buy or bid on a frozen seller's goods
// (market.js) - a frozen account's listings sell nothing (Weak spots: "A banned, frozen or held player's market listings
// keep selling").
//
// THE STAFF CHAT (mob, 03:18Z, 04:23Z: "while frozen they can only talk to staff"; Weak spots: "Staff chat members and
// threads are undefined", "Freeze chat and Message on screen have nowhere to be stored"): ONE THREAD A PLAYER, keyed on the
// account id. A freeze opens it with the player in it; Talk opens one outside a freeze, and the player joins on the first
// staff line. Every line is stored HERE FIRST and written in the audit log by its id and length - never its words, the log
// keeps no chat text (Weak spots: "Audit rows never copy chat text") - and the relay carries only a nudge: a staff line's
// signed `staffline` order to the thread's members online (the player, and staff sockets a staff session minted), a
// player's line its game's `staff` chat frame (net/wire.js CHAT_LINE_CHANNELS). Staff read and answer from the panel, Admins
// and Moderators both. The thread closes with the unfreeze (a Talk thread by staff); its lines are kept STAFF_LINES_KEEP_S.
//
// THE DISCORD INVITE the frozen player's Staff tab shows is a setting (DISCORD_INVITE_URL, server-account/wrangler.toml),
// so it changes without a game update (mob, 03:22Z: https://discord.gg/QADbZYQ73j). Unset, the tab shows none.
//
// OFFLINE ONLY until mob tries it live.
// ═══════════════════════════════════════════════════════════════════

import { displayName, overRate } from './accounts.js';
import { canModerate } from './titles.js';
import { findAccount, pushLaw, reasonOf } from './sanctions.js';
import { signingKey } from './signing.js';
import { mintFreezeOrder, mintStaffLineOrder } from '../../src/net/identityToken.js';
import { sanitizeChat } from '../../src/net/wire.js';

/** The longest freeze an Admin may set, minutes - a week (a starting number to tune: a freeze holds a player while staff
 *  look, and a longer hold is a ban's decision). */
export const FREEZE_MINUTES_MAX = 7 * 24 * 60;
/** Frozen accounts one page of the panel's list answers. */
export const FREEZES_PAGE = 50;
/** Staff chat lines one read answers, and open threads one page lists. */
export const CHAT_PAGE = 50;
export const CHATS_PAGE = 25;
/** How long a staff chat line is kept (the privacy policy's word on case messages: 90 days). */
export const STAFF_LINES_KEEP_S = 90 * 24 * 60 * 60;
/** A player's own lines in their thread, at most this many in PLAYER_LINES_WINDOW_S. */
export const PLAYER_LINES_MAX = 20;
export const PLAYER_LINES_WINDOW_S = 10 * 60;
/** The minute's clock pushes again an act this old at least (its own push had its chance), this many a firing. */
export const PUSH_RETRY_AFTER_S = 30;
export const PUSH_RETRY_MAX = 20;
/** A panel read is written in the audit log once in this long (staff.js STAFF_READ_ROW_S's law). */
const READ_ROW_S = 10 * 60;

/** The panel's doors (staff.js): freeze and unfreeze, the frozen list and a push again - Admins alone; Talk, a thread
 *  read, a line sent, a thread closed and the open threads - Admins and Moderators. */
export const FREEZE_ROUTES = Object.freeze(['/v1/staff/freeze', '/v1/staff/unfreeze', '/v1/staff/freezes', '/v1/staff/freeze-push',
  '/v1/staff/talk', '/v1/staff/chat', '/v1/staff/chat-send', '/v1/staff/chat-close', '/v1/staff/chats']);
const ADMIN_ROUTES = new Set(['/v1/staff/freeze', '/v1/staff/unfreeze', '/v1/staff/freezes', '/v1/staff/freeze-push']);
/** The player's own doors to their thread, behind the game's session (index.js). */
export const STAFF_CHAT_ROUTES = Object.freeze(['/v1/staff-chat/read', '/v1/staff-chat/send']);
/** The doors a frozen account still opens: signing out, its own account, the realm doors that load the character it looks
 *  around as, the relay token (which carries the freeze), the staff chat, and a staff Message on screen read and OK'd
 *  (STAFF-PANEL5-MESSAGE: staff talking to them, as the chat is). A realm record's own read (GET) is asked beside these
 *  (`freezeRefusal`). */
export const FREEZE_ALLOWED = Object.freeze(['/v1/auth/logout', '/v1/auth/token', '/v1/account', '/v1/realm', '/v1/realm/join', '/v1/realm/leave', ...STAFF_CHAT_ROUTES,
  '/v1/safety/staff-messages', '/v1/safety/staff-message-ok']);
const ALLOWED = new Set(FREEZE_ALLOWED);

/** The panel's refusal words and their status (staff.js STAFF_STATUS takes them in) - and `frozen`, the gate's own (403). */
/** This act's own revision landed: ?1 the player, ?2 now, ?3 the Admin, ?4 the new revision, ?5 the new end. */
const LANDED = 'EXISTS (SELECT 1 FROM players WHERE id = ?1 AND freeze_rev = ?4 AND frozen_by = ?3 AND frozen_at = ?2 AND frozen_until IS ?5)';

export const FREEZE_STATUS = Object.freeze({ frozen: 403, 'bad-reason': 400, 'bad-text': 400, 'not-frozen': 409, 'no-thread': 404, 'freeze-thread': 409, 'freeze-moved': 409 });
/** The player's doors' refusal words and their status. */
export const STAFF_CHAT_STATUS = Object.freeze({ 'bad-text': 400, 'no-thread': 404, rate: 429 });

/** Until when the account is frozen: 0 for not. @param {any} row */
export const frozenUntil = (row) => (Number.isSafeInteger(row?.frozen_until) ? row.frozen_until : 0);
/** Whether the account is frozen now. @param {any} row @param {number} nowS */
export const isFrozen = (row, nowS) => frozenUntil(row) > nowS;
/** The gate's answer to a frozen account (bannedAnswer's shape). @param {any} row */
export const frozenAnswer = (row) => ({ error: 'frozen', until: frozenUntil(row), reason: typeof row?.frozen_reason === 'string' ? row.frozen_reason : null });

/**
 * THE FREEZE GATE, beside the ban gate: null where a frozen account may pass (or the account is not frozen), else the
 * refusal. `readsRecord` the request is a realm record's own read (GET /v1/realm/<id> - the save the look-around loads).
 * @param {string} path @param {boolean} readsRecord @param {any} player @param {number} nowS
 */
export function freezeRefusal(path, readsRecord, player, nowS) {
  if (!isFrozen(player, nowS) || ALLOWED.has(path) || readsRecord) return null;
  return frozenAnswer(player);
}

/** The Discord invite the Staff tab shows, from the setting - an https address, or null for none. @param {any} env */
export function discordInvite(env) {
  const u = env?.DISCORD_INVITE_URL;
  return typeof u === 'string' && /^https:\/\/[\w.-]+\/[\w/-]+$/.test(u.trim()) ? u.trim() : null;
}

/**
 * A FREEZE ACT'S ORDER, PUSHED: a fresh `freeze` order for the row as it stands (its end, or 0 lifted) to the relay's law
 * door, and the act marked live when the door took it - its own revision alone. Answers whether it went.
 * STAFF-PANEL5-FREEZE-FIX (a review): the hub keeps the newest order by its time, and a tie by the later arrival. So the
 * order's time is its mint's (the request's second, or the clock firing's, can be older than another act committed
 * before this mint), and a push whose revision moved on while it went - a newer act committed, whose own order may have
 * landed first - reads the row again and pushes it as it stands, after its own (`tries` such pushes at most; one that
 * fails leaves that act waiting for the minute's clock).
 * @param {{ db: any, nowS: number, subtle: SubtleCrypto }} ctx @param {any} env @param {{ id: string, frozen_until: any, freeze_rev: any }} row @param {number} [tries]
 */
export async function pushFreeze({ db, nowS, subtle }, env, row, tries = 3) {
  const key = await signingKey(env, subtle);
  if (!key) return false;
  const at = Math.max(nowS, Math.floor(Date.now() / 1000));
  const fz = frozenUntil(row) > at ? frozenUntil(row) : 0;
  const order = await mintFreezeOrder({ s: row.id, fz }, key, { subtle, nowS: at });
  if (!(await pushLaw(env, (u, i) => globalThis.fetch(u, i), order))) return false;
  const set = await db.prepare('UPDATE players SET freeze_live = 1 WHERE id = ?1 AND freeze_rev = ?2 AND freeze_live = 0').bind(row.id, Number(row.freeze_rev)).run();
  if (set.meta.changes || tries < 1) return true;
  const cur = await db.prepare('SELECT id, frozen_until, freeze_rev FROM players WHERE id = ?1').bind(row.id).first();
  if (!cur || Number(cur.freeze_rev) === Number(row.freeze_rev)) return true;   // live already, by another push of this revision
  if (!(await pushFreeze({ db, nowS: at, subtle }, env, cur, tries - 1))) await db.prepare('UPDATE players SET freeze_live = 0 WHERE id = ?1 AND freeze_rev = ?2').bind(cur.id, Number(cur.freeze_rev)).run();
  return true;
}

/** A staff line's nudge pushed to the relay's door - whether it went. @param {{ nowS: number, subtle: SubtleCrypto }} ctx @param {any} env @param {string} player @param {number} line */
async function pushLine({ nowS, subtle }, env, player, line) {
  const key = await signingKey(env, subtle);
  if (!key) return false;
  return pushLaw(env, (u, i) => globalThis.fetch(u, i), await mintStaffLineOrder({ s: player, sl: line }, key, { subtle, nowS }));
}

/** Whether a thread row is open to its player now: not closed, and a freeze's only while the freeze stands (it closes with
 *  the unfreeze, or the freeze's own end). @param {any} t @param {any} player @param {number} nowS */
const threadOpen = (t, player, nowS) => !!t && t.closed_at == null && (t.why === 'talk' || isFrozen(player, nowS));

/** A line as the panel reads it. @param {any} l */
const lineView = (l) => ({ id: l.id, at: l.at, staff: l.staff === 1, text: l.text, ...(l.staff === 1 ? { by: l.author_handle ?? null } : {}) });

/**
 * THE PANEL'S FREEZE AND STAFF CHAT DOORS. Answers the route's body, or `{ error }` (FREEZE_STATUS / staff.js STAFF_STATUS).
 * @param {any} ctx @param {any} env @param {string} path @param {any} body
 * @param {{ player: any, role: string }} who
 * @param {(act: string, target?: string|null, detail?: object|null, how?: object) => any} audit
 */
export async function staffFreeze(ctx, env, path, body, who, audit) {
  const { db, nowS } = ctx;
  const me = who.player;
  if (ADMIN_ROUTES.has(path) && who.role !== 'admin') {
    await audit('refused', null, { path, need: 'admin' }, { outcome: 'denied' }).run();
    return { error: 'staff-admin' };
  }

  if (path === '/v1/staff/freezes') {
    const from = Number.isSafeInteger(body.from) && body.from > 0 ? body.from : 0;
    // the frozen and the acts not yet live, each by its own index - never a walk of every account
    const rows = (await db.prepare(`SELECT p.id, p.handle, p.guest_name, p.frozen_until, p.frozen_reason, p.frozen_at, p.freeze_live, b.handle AS by_handle,
        t.closed_at, t.last_at, t.last_staff, t.why
      FROM players p LEFT JOIN players b ON b.id = p.frozen_by LEFT JOIN staff_chat_threads t ON t.player = p.id
      WHERE p.id IN (SELECT id FROM players WHERE frozen_until > ?1 UNION SELECT id FROM players WHERE freeze_live = 0)
      ORDER BY p.freeze_live = 0 DESC, (t.closed_at IS NULL AND t.last_staff = 0) DESC, p.frozen_at DESC LIMIT ?2 OFFSET ?3`).bind(nowS, FREEZES_PAGE + 1, from).all())?.results ?? [];
    await audit('freezes-read', null, null, { onceIn: READ_ROW_S }).run();
    return {
      freezes: rows.slice(0, FREEZES_PAGE).map((r) => ({
        target: r.id, name: displayName(r), frozen: isFrozen(r, nowS), until: isFrozen(r, nowS) ? r.frozen_until : 0, reason: r.frozen_reason ?? null,
        by: r.by_handle ?? null, at: r.frozen_at ?? null, live: r.freeze_live !== 0,
        chat: r.why ? { open: threadOpen(r, r, nowS), lastAt: r.last_at, waiting: r.closed_at == null && r.last_staff === 0 } : null,
      })),
      next: rows.length > FREEZES_PAGE ? from + FREEZES_PAGE : null,
    };
  }

  if (path === '/v1/staff/chats') {
    const from = Number.isSafeInteger(body.from) && body.from > 0 ? body.from : 0;
    // open: not closed, and a freeze's only while its freeze stands (`threadOpen`)
    const rows = (await db.prepare(`SELECT t.*, p.handle, p.guest_name, p.frozen_until FROM staff_chat_threads t JOIN players p ON p.id = t.player
      WHERE t.closed_at IS NULL AND (t.why = 'talk' OR p.frozen_until > ?3) ORDER BY t.last_staff = 0 DESC, t.last_at DESC LIMIT ?1 OFFSET ?2`).bind(CHATS_PAGE + 1, from, nowS).all())?.results ?? [];
    await audit('chats-read', null, null, { onceIn: READ_ROW_S }).run();
    return {
      chats: rows.slice(0, CHATS_PAGE).map((t) => ({
        target: t.player, name: displayName(t), why: t.why, playerIn: t.player_in === 1, frozen: isFrozen(t, nowS), lastAt: t.last_at, waiting: t.last_staff === 0,
      })),
      next: rows.length > CHATS_PAGE ? from + CHATS_PAGE : null,
    };
  }

  // every other door names one account: by its id, or a name (sanctions.js findAccount)
  const row = await findAccount(db, { target: body.target, name: body.name });
  if ('error' in row) return row;
  const name = displayName(row);
  const act = path.slice('/v1/staff/'.length);
  /** A refusal written down as failed, and answered. */
  const failed = async (/** @type {string} */ error, /** @type {object} */ detail = {}) => {
    await audit(act, row.id, { name, ...detail, error }, { outcome: 'failed' }).run();
    return { error };
  };

  if (path === '/v1/staff/freeze' || path === '/v1/staff/unfreeze') {
    const freeze = path === '/v1/staff/freeze';
    const minutes = body.minutes;
    const reason = reasonOf(body.reason);
    if (freeze && (!Number.isSafeInteger(minutes) || minutes < 1 || minutes > FREEZE_MINUTES_MAX)) return failed('bad-minutes', { minutes });
    if (freeze && !reason) return failed('bad-reason');
    // staff are never frozen, as they are never muted or banned (MOD1's `protected`), nor is the Admin who asks
    if (freeze && row.id === me.id) return failed('staff-self');
    if (freeze && canModerate(row, env)) return failed('protected');
    if (!freeze && !isFrozen(row, nowS)) return failed('not-frozen');
    const until = freeze ? nowS + /** @type {number} */ (minutes) * 60 : null;
    const rev = Number(row.freeze_rev) || 0;
    const detail = freeze ? { name, minutes, reason } : { name };
    // the act, its thread and its audit row in one batch, keyed on the revision it was read at - two Admins at once land one,
    // and the thread follows only the act that landed (a lost unfreeze never closes the winning freeze's thread)
    const [, set] = await db.batch([
      audit(act, row.id, detail, { okIf: { sql: 'EXISTS (SELECT 1 FROM players WHERE id = ? AND freeze_rev = ?)', args: [row.id, rev] } }),
      db.prepare(`UPDATE players SET frozen_until = ?2, frozen_reason = ?3, frozen_by = ?4, frozen_at = ?5, freeze_rev = ?6 + 1, freeze_live = 0
        WHERE id = ?1 AND freeze_rev = ?6`).bind(row.id, until, freeze ? reason : null, me.id, nowS, rev),
      freeze
        // A FREEZE OPENS THE THREAD, the player in it at once - the Staff tab is the one place a frozen player can type
        ? db.prepare(`INSERT INTO staff_chat_threads (player, why, opened_at, opened_by, player_in, last_at, last_staff) SELECT ?1, 'freeze', ?2, ?3, 1, ?2, 1 WHERE ${LANDED}
            ON CONFLICT(player) DO UPDATE SET why = 'freeze', player_in = 1, opened_at = CASE WHEN closed_at IS NULL THEN opened_at ELSE ?2 END,
            opened_by = CASE WHEN closed_at IS NULL THEN opened_by ELSE ?3 END, closed_at = NULL`).bind(row.id, nowS, me.id, rev + 1, until)
        // and the unfreeze closes it (design doc: "The chat closes when the player is unfrozen")
        : db.prepare(`UPDATE staff_chat_threads SET closed_at = ?2, player_in = 0 WHERE player = ?1 AND closed_at IS NULL AND ${LANDED}`).bind(row.id, nowS, me.id, rev + 1, until),
    ]);
    if (!set.meta.changes) return { error: 'freeze-moved' };
    const live = await pushFreeze(ctx, env, { id: row.id, frozen_until: until, freeze_rev: rev + 1 });
    return { ok: true, target: row.id, name, until: until ?? 0, reason: freeze ? reason : null, live };
  }

  if (path === '/v1/staff/freeze-push') {
    if (row.freeze_live !== 0) return { ok: true, target: row.id, name, live: true };
    const live = await pushFreeze(ctx, env, row);
    await audit(act, row.id, { name, rev: Number(row.freeze_rev) }, { outcome: live ? 'ok' : 'failed' }).run();
    return { ok: true, target: row.id, name, live };
  }

  const thread = await db.prepare('SELECT * FROM staff_chat_threads WHERE player = ?1').bind(row.id).first();
  const open = threadOpen(thread, row, nowS);

  if (path === '/v1/staff/talk') {
    // TALK OPENS A THREAD OUTSIDE A FREEZE; the player joins on the first staff line (in a freeze they are in already)
    if (row.id === me.id) return failed('staff-self');
    if (!open) {
      await db.batch([
        db.prepare(`INSERT INTO staff_chat_threads (player, why, opened_at, opened_by, player_in, last_at, last_staff) VALUES (?1, 'talk', ?2, ?3, ?4, ?2, 1)
          ON CONFLICT(player) DO UPDATE SET why = 'talk', opened_at = ?2, opened_by = ?3, player_in = ?4, closed_at = NULL, last_at = ?2, last_staff = 1`)
          .bind(row.id, nowS, me.id, isFrozen(row, nowS) ? 1 : 0),
        audit('chat-open', row.id, { name }),
      ]);
    }
    return { ok: true, target: row.id, name, why: open ? thread.why : 'talk', playerIn: open ? thread.player_in === 1 : isFrozen(row, nowS) };
  }

  if (path === '/v1/staff/chat') {
    const before = Number.isSafeInteger(body.before) && body.before > 0 ? body.before : Number.MAX_SAFE_INTEGER;
    const lines = (await db.prepare(`SELECT l.id, l.at, l.staff, l.text, a.handle AS author_handle FROM staff_chat_lines l LEFT JOIN players a ON a.id = l.author
      WHERE l.player = ?1 AND l.id < ?2 ORDER BY l.id DESC LIMIT ?3`).bind(row.id, before, CHAT_PAGE).all())?.results ?? [];
    await audit('chat-read', row.id, { name }, { onceIn: READ_ROW_S }).run();
    return {
      target: row.id, name, open, why: thread?.why ?? null, playerIn: open && thread.player_in === 1,
      frozen: isFrozen(row, nowS) ? { until: row.frozen_until, reason: row.frozen_reason ?? null } : null,
      lines: lines.map(lineView), next: lines.length === CHAT_PAGE ? lines[lines.length - 1].id : null,
    };
  }

  if (path === '/v1/staff/chat-send') {
    const text = typeof body.text === 'string' ? sanitizeChat(body.text) : '';
    if (!text) return failed('bad-text');
    if (!open) return failed('no-thread');
    const line = await db.prepare('INSERT INTO staff_chat_lines (player, at, author, staff, text) VALUES (?1, ?2, ?3, 1, ?4) RETURNING id').bind(row.id, nowS, me.id, text).first();
    await db.batch([
      // THE PLAYER JOINS ON THE FIRST STAFF LINE
      db.prepare('UPDATE staff_chat_threads SET player_in = 1, last_at = ?2, last_staff = 1 WHERE player = ?1').bind(row.id, nowS),
      audit('chat-line', row.id, { name, line: line.id, len: text.length }),
    ]);
    const live = await pushLine(ctx, env, row.id, line.id);
    return { ok: true, target: row.id, line: { id: line.id, at: nowS, staff: true, text, by: me.handle ?? null }, live };
  }

  if (path === '/v1/staff/chat-close') {
    if (!open) return failed('no-thread');
    if (thread.why === 'freeze') return failed('freeze-thread');   // a freeze's thread closes with its unfreeze
    await db.batch([
      audit(act, row.id, { name }),
      db.prepare('UPDATE staff_chat_threads SET closed_at = ?2, player_in = 0 WHERE player = ?1 AND closed_at IS NULL').bind(row.id, nowS),
    ]);
    return { ok: true, target: row.id };
  }
  return { error: 'not-found' };
}

/**
 * THE PLAYER'S OWN THREAD, behind the game's session: `/v1/staff-chat/read` `{ after? }` - whether it is open to them, their
 * freeze, its lines after `after` (oldest first, CHAT_PAGE at most, only while they are in it) and the Discord invite;
 * `/v1/staff-chat/send` `{ text }` - a line of theirs in an open thread they are in. A mute does not shut it (Weak spots: "A
 * muted and frozen player can't talk to staff").
 * @param {any} ctx @param {any} env @param {string} path @param {any} body @param {any} player the session's account, read whole
 * @param {(db: any, nowS: number, row: any) => any} auditStatement staff.js's audit row (handed in: staff.js imports this module)
 */
export async function playerStaffChat(ctx, env, path, body, player, auditStatement) {
  const { db, nowS } = ctx;
  const thread = await db.prepare('SELECT * FROM staff_chat_threads WHERE player = ?1').bind(player.id).first();
  const open = threadOpen(thread, player, nowS) && thread.player_in === 1;
  if (path === '/v1/staff-chat/read') {
    const after = Number.isSafeInteger(body?.after) && body.after > 0 ? body.after : 0;
    const lines = open ? (await db.prepare(`SELECT id, at, staff, text FROM staff_chat_lines WHERE player = ?1 AND id > ?2
      ORDER BY id DESC LIMIT ?3`).bind(player.id, after, CHAT_PAGE).all())?.results ?? [] : [];
    return {
      open, frozen: isFrozen(player, nowS) ? { until: player.frozen_until, reason: player.frozen_reason ?? null } : null,
      lines: lines.reverse().map((l) => ({ id: l.id, at: l.at, staff: l.staff === 1, text: l.text })), invite: discordInvite(env),
    };
  }
  const text = typeof body?.text === 'string' ? sanitizeChat(body.text) : '';
  if (!text) return { error: 'bad-text' };
  if (!open) return { error: 'no-thread' };
  if (await overRate(ctx, `staffchat:${player.id}`, PLAYER_LINES_MAX, PLAYER_LINES_WINDOW_S)) return { error: 'rate' };
  const [ins] = await db.batch([
    db.prepare('INSERT INTO staff_chat_lines (player, at, author, staff, text) VALUES (?1, ?2, ?1, 0, ?3) RETURNING id').bind(player.id, nowS, text),
    db.prepare('UPDATE staff_chat_threads SET last_at = ?2, last_staff = 0 WHERE player = ?1').bind(player.id, nowS),
  ]);
  const id = ins.results?.[0]?.id ?? null;
  // every line in the audit log, the player's too (design doc: "Every line is kept with the case and in the audit log") -
  // by its id and length, never its words
  await auditStatement(db, nowS, { actor: player, role: 'player', act: 'chat-line', target: player.id, detail: { line: id, len: text.length } }).run();
  return { ok: true, line: { id, at: nowS, staff: false, text } };
}

/**
 * THE MINUTE'S CLOCK (cron.js freeze-push): every act not yet live and at least PUSH_RETRY_AFTER_S old, pushed again with a
 * fresh order - PUSH_RETRY_MAX a firing. Answers how many went live.
 * @param {{ db: any, nowS: number }} ctx @param {any} env
 */
export async function retryFreezePushes({ db, nowS }, env) {
  if (typeof env?.RELAY_LAW_URL !== 'string') return 0;   // no door to push to: nothing waits on this clock
  const rows = (await db.prepare('SELECT id, frozen_until, freeze_rev FROM players WHERE freeze_live = 0 AND frozen_at <= ?1 ORDER BY frozen_at LIMIT ?2')
    .bind(nowS - PUSH_RETRY_AFTER_S, PUSH_RETRY_MAX).all())?.results ?? [];
  let n = 0;
  for (const { id } of rows) {
    const r = await db.prepare('SELECT id, frozen_until, freeze_rev FROM players WHERE id = ?1 AND freeze_live = 0').bind(id).first();   // STAFF-PANEL5-FREEZE-FIX: the row as it stands at its own push, never as the firing's read found it
    if (r && await pushFreeze({ db, nowS, subtle: crypto.subtle }, env, r)) n++;
  }
  return n;
}

/**
 * THE HOUR'S SWEEP (cron.js staff-chat): a freeze's thread whose freeze ran out is closed, and the lines past
 * STAFF_LINES_KEEP_S deleted, `page` at a time. Answers the rows it moved.
 * @param {any} db @param {number} nowS @param {number} page
 */
export async function sweepStaffChat(db, nowS, page) {
  const [closed, gone] = await db.batch([
    db.prepare(`UPDATE staff_chat_threads SET closed_at = ?1, player_in = 0 WHERE player IN (SELECT t.player FROM staff_chat_threads t JOIN players p ON p.id = t.player
      WHERE t.closed_at IS NULL AND t.why = 'freeze' AND COALESCE(p.frozen_until, 0) <= ?1 LIMIT ?2)`).bind(nowS, page),
    db.prepare('DELETE FROM staff_chat_lines WHERE id IN (SELECT id FROM staff_chat_lines WHERE at < ?1 LIMIT ?2)').bind(nowS - STAFF_LINES_KEEP_S, page),
  ]);
  return Number(closed?.meta?.changes ?? 0) + Number(gone?.meta?.changes ?? 0);
}

/** THE HOME ROLL-UP (the status builder's registry): a freeze or unfreeze not live yet is high, an unanswered player line
 *  medium - Admins alone, as the freeze list is. */
export const HOME_WATCH = Object.freeze({
  id: 'freeze', label: 'Freeze player', role: 'admin',
  /** @param {any} ctx @param {any} _env @param {any} _who @param {number} n */
  async top(ctx, _env, _who, n) {
    const { db, nowS } = ctx;
    const rows = (await db.prepare(`SELECT p.id, p.handle, p.guest_name, p.frozen_until, p.freeze_live, t.closed_at, t.last_staff, t.why
      FROM players p LEFT JOIN staff_chat_threads t ON t.player = p.id
      WHERE p.id IN (SELECT id FROM players WHERE frozen_until > ?1 UNION SELECT id FROM players WHERE freeze_live = 0) LIMIT 500`).bind(nowS).all())?.results ?? [];
    const items = rows.flatMap((r) => (r.freeze_live === 0 ? [{ level: 'high', why: 'saved, not live yet', sub: r.id, name: displayName(r) }]
      : threadOpen(r, r, nowS) && r.last_staff === 0 ? [{ level: 'medium', why: 'frozen, waiting on a staff answer', sub: r.id, name: displayName(r) }] : []));
    items.sort((a, b) => (a.level === b.level ? 0 : a.level === 'high' ? -1 : 1));
    return { items: items.slice(0, n), high: items.filter((x) => x.level === 'high').length, total: items.length };
  },
});
