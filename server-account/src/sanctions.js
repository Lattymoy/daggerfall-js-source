// @ts-check
// ═══════════════════════════════════════════════════════════════════
// SAFE4 (2026-10-17, Mac: "Lets do every single thing here. I want a full fledged future proof system"; the chat safety
// plan, bible/11-Multiplayer/Chat-Safety-Arc.md section 5): THE RECORD, THE LADDER AND THE BAN.
//
// MOD1 wrote who muted a player beside the mute, and cleared it with the mute: a power whose use was forgotten the
// moment it lapsed, so a player muted every week for a month looked, to the next moderator, like a first offender. Now
// every mute, unmute, ban, unban and dismissal is a row in `mod_actions` that nothing clears - who acted (a moderator's
// account, a Discord moderator through theirs, or the automatic `auto:reports` / `auto:review`), on whom, until when,
// why, and the case it answered. A STRIKE is a mute or a ban in the last STRIKE_WINDOW_S - but an automatic mute a
// moderator dismissed (AUDIT SAFE SERVICE-6: three accounts who count could otherwise walk an innocent player up the
// ladder one dismissed case at a time) - and the LADDER (net/safety/safetyLaw.js) is the mute the next strike earns.
//
// THE BAN. MOD1 bounded a mute at a week and said "Longer is a ban, which is a different decision and not one Mac has
// asked for" - he has now. A ban is `players.banned_until` (BAN_FOREVER for good) and the reason the player is shown;
// the service answers a banned account `banned` on every door behind a session but signing out, and at signing in and
// recovering (index.js; AUDIT SAFE SERVICE-7 - both minted a banned account a session), so it mints no token and opens
// no room - and a ban order (identityToken.js mintBanOrder) tells the rooms already holding it, which silence it and say
// so, and its own client leaves. A moderator may ban and unban; a moderator is never banned, nor muted, by anyone (MOD1's
// `protected`).
//
// THE SERVICE'S DOOR TO THE RELAY (pushLaw). A moderator's /mute in the game is carried to the rooms by their own client
// (MOD1). A mute or ban from Discord, or an automatic one, has no such client, so the service posts its signed order to
// the relay's SAFE_LAW_PATH (RELAY_LAW_URL): the hub applies it and hands it to its target's own client to carry on.
// Never the truth - the row is - only how a room already open hears it now; a push that fails is said in the log and the
// order lands on the target's next connection, as MOD1's always did without a key.
// ═══════════════════════════════════════════════════════════════════

import { canModerate, isDeveloper } from './titles.js';
import { displayName, isMuted } from './accounts.js';
import { signingKey } from './signing.js';
import { mintOrder, mintBanOrder, mintStaffCutOrder, ID_RE } from '../../src/net/identityToken.js';
import { STRIKE_WINDOW_S, LADDER_BAN_AT, ladderMinutes, BAN_DAYS_MAX, banUntil } from '../../src/net/safety/safetyLaw.js';
import { MUTE_MAX_MIN } from '../../src/net/moderation.js';
import { SAFE_LAW_PATH } from '../../src/net/wire.js';

/** The kinds of act the record keeps. */
export const ACTION_KINDS = Object.freeze(['mute', 'unmute', 'ban', 'unban', 'dismiss']);
/** The longest reason a ban or an act carries. */
export const REASON_MAX = 200;
/** How many of an account's acts a moderator's look reads, newest first. */
export const HISTORY_MAX = 20;
/** How long the service waits on the relay's door, ms (a Discord press pushes after it answers - AUDIT SAFE DISCORD-4). */
export const LAW_PUSH_MS = 2000;
/** The automatic actors - the record's words for a mute no moderator wrote. */
export const AUTO_ACTORS = Object.freeze(['auto:reports', 'auto:review']);

/** Until when the account may not play: 0 for not banned. @param {any} row */
export const bannedUntil = (row) => (Number.isSafeInteger(row?.banned_until) ? row.banned_until : 0);
/** Whether the account is banned now. @param {any} row @param {number} nowS */
export const isBanned = (row, nowS) => bannedUntil(row) > nowS;
/** A reason as kept: one line, trimmed and bounded, or null. @param {unknown} r */
export const reasonOf = (r) => (typeof r === 'string' && r.trim() ? r.replace(/\s+/g, ' ').trim().slice(0, REASON_MAX) : null);

/**
 * ONE ACT, RECORDED. `actor` an account id or an automatic actor's word; `actorName` what a moderator reads. `click`
 * (STAFF-PANEL2-FIX) the one-time id of the press that made it, where one did (safety.js modAct).
 * @param {any} db
 * @param {{ target: string, kind: string, until?: number|null, reason?: string|null, actor: string, actorName?: string|null, caseId?: string|null, click?: string|null, at: number }} act
 */
export const actionStatement = (db, { target, kind, until = null, reason = null, actor, actorName = null, caseId = null, click = null, at }) =>
  db.prepare('INSERT INTO mod_actions (target, kind, until, reason, actor, actor_name, case_id, at, click) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)')
    .bind(target, kind, until, reason, actor, actorName, caseId, at, click);

/** The strikes standing against an account: its mutes and bans of the last STRIKE_WINDOW_S, the voided not counted. */
export async function strikesOf(db, target, nowS) {
  const r = await db.prepare("SELECT COUNT(*) AS n FROM mod_actions WHERE target = ?1 AND kind IN ('mute', 'ban') AND at > ?2 AND void_at IS NULL").bind(target, nowS - STRIKE_WINDOW_S).first();
  return Number(r?.n ?? 0);
}

/**
 * FIND THE ACCOUNT a moderator names - by its id, or by a name: a handle (unique, any case), else a guest's generated
 * name when exactly one guest wears it. Two guests of one name is a refusal, never a guess (MOD1: banning the wrong
 * person is worse than banning nobody). The row, or `{ error }`.
 * @param {any} db @param {{ target?: unknown, name?: unknown }} who
 */
export async function findAccount(db, { target, name }) {
  if (typeof target === 'string' && ID_RE.test(target)) {
    return (await db.prepare('SELECT * FROM players WHERE id = ?1').bind(target).first()) ?? { error: 'no-player' };
  }
  if (typeof name !== 'string' || !name.trim() || name.length > 64) return { error: 'no-player' };
  const said = name.trim();
  const byHandle = await db.prepare('SELECT * FROM players WHERE handle_lc = ?1').bind(said.toLowerCase()).first();
  if (byHandle) return byHandle;
  const guests = (await db.prepare('SELECT * FROM players WHERE handle IS NULL AND guest_name = ?1 LIMIT 2').bind(said).all())?.results ?? [];
  if (guests.length > 1) return { error: 'ambiguous' };
  return guests[0] ?? { error: 'no-player' };
}

/**
 * A MUTE WRITTEN, by anyone the caller has already judged may write it - MOD1's row (`muted_until`, `muted_by`) and its
 * act in the record, in one batch. `minutes` 0 lifts it. Answers the mute's end (0 for lifted). Its callers write only
 * automatic mutes and lift only those, so it is never an Admin's (`mute_admin`, STAFF-PANEL2-FIX).
 * @param {any} db @param {any} row the target's row
 * @param {{ minutes: number, actor: string, actorName?: string|null, reason?: string|null, caseId?: string|null, nowS: number }} act
 */
export async function writeMute(db, row, { minutes, actor, actorName = null, reason = null, caseId = null, nowS }) {
  const until = minutes ? nowS + minutes * 60 : null;
  await db.batch([
    db.prepare('UPDATE players SET muted_until = ?1, muted_by = ?2, mute_admin = NULL WHERE id = ?3').bind(until, until ? actor : null, row.id),
    actionStatement(db, { target: row.id, kind: until ? 'mute' : 'unmute', until, reason, actor, actorName, caseId, at: nowS }),
  ]);
  return until ?? 0;
}

/** Whether an automatic mute may fall on `row`: never a moderator, never an account muted or banned already (a
 *  moderator's week is never shortened to the automatic half hour). @param {any} row @param {any} env @param {number} nowS */
export const autoMutable = (row, env, nowS) => !!row && !canModerate(row, env) && !isMuted(row, nowS) && !isBanned(row, nowS);

/**
 * THE AUTOMATIC MUTE - the reports' (SAFE3) or the reviewer's (SAFE5): the ladder's first rung and no more, where
 * autoMutable allows - the caller has claimed the case (safety.js fileReport, safetyClock.js), so one wave mutes once.
 * Answers the mute's end, or 0 when it held its hand.
 * @param {any} db @param {any} env @param {any} row @param {{ actor: 'auto:reports'|'auto:review', reason: string, caseId: string, nowS: number }} act
 */
export async function autoMute(db, env, row, { actor, reason, caseId, nowS }) {
  if (!autoMutable(row, env, nowS)) return 0;
  return writeMute(db, row, { minutes: ladderMinutes(0), actor, actorName: actor, reason, caseId, nowS });
}

/**
 * A CASE'S AUTOMATIC MUTES VOIDED, a moderator having dismissed it (AUDIT SAFE SERVICE-6): each stays in the record,
 * marked, and no longer a strike; one still running is lifted - in the record as the moderator's unmute. Answers the
 * unmute's order for the rooms, or null.
 * @param {{ db: any, nowS: number, subtle: SubtleCrypto }} ctx @param {any} env
 * @param {{ caseId: string, row: any, actor: any, actorName: string }} what
 */
export async function voidAutoMutes({ db, nowS, subtle }, env, { caseId, row, actor, actorName }) {
  await db.prepare("UPDATE mod_actions SET void_at = ?2 WHERE case_id = ?1 AND kind = 'mute' AND actor IN ('auto:reports', 'auto:review') AND void_at IS NULL").bind(caseId, nowS).run();
  if (!row || !isMuted(row, nowS) || !AUTO_ACTORS.includes(row.muted_by)) return null;
  await writeMute(db, row, { minutes: 0, actor: actor.id, actorName, reason: `case ${caseId} dismissed`, caseId, nowS });
  return lawOrder(env, subtle, nowS, { s: row.id, mu: 0 });
}

/**
 * BAN, a moderator's: `days` 1 to BAN_DAYS_MAX, or 0 for good. The account is found by id or name (findAccount); a
 * moderator is never banned, nor is the moderator who asks. The row and the act in one batch. `keepLonger` (a case's
 * button) never shortens a ban that stands longer (AUDIT SAFE DISCORD-5: "Ban 30 days" cut a ban for good) - its act
 * is recorded, the longer end kept; a moderator who names the days by command means them.
 * @param {{ db: any, nowS: number }} ctx @param {any} actor @param {any} env
 * STAFF-PANEL2-FIX: `also(answer)`, the caller's own statements for the same batch (safety.js modAct: its case closed,
 * so the ban, its record and the close land together or none does).
 * @param {{ target?: unknown, name?: unknown, days?: unknown, reason?: unknown, caseId?: string|null, click?: string|null, actorName?: string|null, keepLonger?: boolean,
 *   also?: ((answer: { ok: true, target: string, name: string, until: number, reason: string|null }) => any[])|null }} ask
 */
export async function banAccount({ db, nowS }, actor, env, { target, name, days, reason, caseId = null, click = null, actorName = null, keepLonger = false, also = null }) {
  if (!canModerate(actor, env)) return { error: 'not-moderator' };
  if (!Number.isSafeInteger(days) || /** @type {number} */ (days) < 0 || /** @type {number} */ (days) > BAN_DAYS_MAX) return { error: 'bad-days' };
  const row = await findAccount(db, { target, name });
  if ('error' in row) return row;
  if (row.id === actor.id || canModerate(row, env)) return { error: 'protected' };
  const asked = banUntil(/** @type {number} */ (days), nowS);
  const until = keepLonger && isBanned(row, nowS) ? Math.max(asked, bannedUntil(row)) : asked;
  const why = reasonOf(reason) ?? (until !== asked ? (row.ban_reason ?? null) : null);
  // STAFF-PANEL2-FIX (design doc, Weak spots: "A Moderator can lift an Admin's ban"): a ban an Admin set (`ban_admin`,
  // 0156) is cut short by an Admin alone, and stays the Admin's when another moderator lengthens it; who set the ban that
  // stands is kept beside it (`banned_by`), as MOD1's `muted_by` is beside a mute
  const adminHeld = row.ban_admin === 1 && isBanned(row, nowS);
  const admin = isDeveloper(actor, env);
  if (adminHeld && !admin && until < bannedUntil(row)) return { error: 'admin-sanction' };
  const keptOld = until !== asked;   // a button's ban that left a longer one standing: its setter stays who set it
  const done = /** @type {{ ok: true, target: string, name: string, until: number, reason: string|null }} */ ({ ok: true, target: row.id, name: displayName(row), until, reason: why });
  await db.batch([
    db.prepare(`UPDATE players SET banned_until = ?1, ban_reason = ?2, banned_by = CASE WHEN ?5 = 1 THEN banned_by ELSE ?4 END,
      ban_admin = CASE WHEN ?5 = 1 THEN ban_admin ELSE ?6 END WHERE id = ?3`).bind(until, why, row.id, actor.id, keptOld ? 1 : 0, admin || adminHeld ? 1 : 0),
    actionStatement(db, { target: row.id, kind: 'ban', until, reason: why, actor: actor.id, actorName: actorName ?? displayName(actor), caseId, click, at: nowS }),
    ...(also ? also(done) : []),
  ]);
  return done;
}

/** UNBAN, a moderator's - the ban lifted, the record kept; an account not banned is told so, and nothing is written
 *  (AUDIT SAFE SERVICE-11). @param {{ db: any, nowS: number }} ctx @param {any} actor @param {any} env @param {{ target?: unknown, name?: unknown, actorName?: string|null }} ask */
export async function unbanAccount({ db, nowS }, actor, env, { target, name, actorName = null }) {
  if (!canModerate(actor, env)) return { error: 'not-moderator' };
  const row = await findAccount(db, { target, name });
  if ('error' in row) return row;
  if (!isBanned(row, nowS)) return { error: 'not-banned' };
  if (row.ban_admin === 1 && !isDeveloper(actor, env)) return { error: 'admin-sanction' };   // STAFF-PANEL2-FIX: an Admin's ban, an Admin's to lift
  await db.batch([
    db.prepare('UPDATE players SET banned_until = NULL, ban_reason = NULL, banned_by = NULL, ban_admin = NULL WHERE id = ?1').bind(row.id),
    actionStatement(db, { target: row.id, kind: 'unban', actor: actor.id, actorName: actorName ?? displayName(actor), at: nowS }),
  ]);
  return { ok: true, target: row.id, name: displayName(row), until: 0 };
}

/**
 * A MODERATOR'S LOOK at an account: its strikes, the next rung (a mute's minutes, or 'ban' past the ladder), whether it
 * is muted or banned now, and its last HISTORY_MAX acts. STAFF-PANEL-SPEED: `row` the account's row, from a door that
 * found it already (staffCases.js).
 * @param {{ db: any, nowS: number }} ctx @param {any} actor @param {any} env @param {{ target?: unknown, name?: unknown, row?: any }} who
 */
export async function strikesLook({ db, nowS }, actor, env, { target, name, row: found = null }) {
  if (!canModerate(actor, env)) return { error: 'not-moderator' };
  const row = found ?? await findAccount(db, { target, name });
  if ('error' in row) return row;
  // STAFF-PANEL-SPEED (mob: "The click takes a while before the new page shows"): the strikes and the history, one trip
  const [strikes, acts] = await Promise.all([strikesOf(db, row.id, nowS),
    db.prepare('SELECT kind, until, reason, actor_name, case_id, at, void_at FROM mod_actions WHERE target = ?1 ORDER BY at DESC, id DESC LIMIT ?2').bind(row.id, HISTORY_MAX).all().then((/** @type {any} */ r) => r?.results ?? [])]);
  return {
    ok: true, target: row.id, name: displayName(row), strikes,
    next: strikes >= LADDER_BAN_AT ? 'ban' : ladderMinutes(strikes),
    mutedUntil: isMuted(row, nowS) ? row.muted_until : 0,
    bannedUntil: isBanned(row, nowS) ? row.banned_until : 0,
    banReason: isBanned(row, nowS) ? (row.ban_reason ?? null) : null,
    history: acts.map((a) => ({ kind: a.kind, until: a.until ?? 0, reason: a.reason ?? null, by: a.actor_name ?? null, case: a.case_id ?? null, at: a.at, ...(a.void_at ? { voided: true } : {}) })),
  };
}

/** The mute's minutes a moderator may ask (MOD1's bound). @param {unknown} m */
export const muteMinutesOk = (m) => Number.isSafeInteger(m) && /** @type {number} */ (m) >= 0 && /** @type {number} */ (m) <= MUTE_MAX_MIN;

/**
 * THE ORDER FOR A ROOM: a mute order (`mu`) or a ban order (`bn`), signed - or null for a service with no key.
 * @param {any} env @param {SubtleCrypto} subtle @param {number} nowS @param {{ s: string, mu?: number, bn?: number }} what
 */
export async function lawOrder(env, subtle, nowS, { s, mu, bn }) {
  const key = await signingKey(env, subtle);
  if (!key) return null;
  return bn !== undefined ? mintBanOrder({ s, bn }, key, { subtle, nowS }) : mintOrder({ s, mu: mu ?? 0 }, key, { subtle, nowS });
}

/**
 * THE SERVICE'S DOOR TO THE RELAY: `order` posted to RELAY_LAW_URL (the relay's SAFE_LAW_PATH), answered whether the hub
 * took it. Never throws, never retries: the row is the truth, and the order lands on the next connection regardless.
 * THROUGH THE `RELAY` SERVICE BINDING where the Worker has it (server-account/wrangler.toml - AUDIT SAFE RELAY S1): one
 * Worker fetching another's workers.dev address on the same account may be refused outright (Cloudflare's error 1042),
 * and a push that fails is silent by design, so the binding is the door and the address only names the path; a Worker
 * without it (a test, a local run) fetches the address.
 * STAFF-PANEL5-MESSAGE: `hear`, for a caller that reads more of the door's answer than yes or no - handed the body of an
 * answer the door took (a staff message's: how many of its target's sockets the hub handed the nudge).
 * @param {any} env @param {(url: string, init: any) => Promise<Response>} fetchFn @param {string|null} order
 * STAFF-EVENT: `refused`, handed the body of an answer the door refused (a staff event's: the hub's why - a full book).
 * @param {((said: any) => void)|null} [hear] @param {((said: any) => void)|null} [refused]
 */
export async function pushLaw(env, fetchFn, order, hear = null, refused = null) {
  const url = env?.RELAY_LAW_URL;
  if (!order || typeof url !== 'string' || !url.startsWith('https://') || !url.endsWith(SAFE_LAW_PATH)) return false;
  const init = { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ order }), signal: AbortSignal.timeout(LAW_PUSH_MS) };
  try {
    const res = typeof env.RELAY?.fetch === 'function' ? await env.RELAY.fetch(new Request(url, init)) : await fetchFn(url, init);
    const said = await res.json().catch(() => null);   // STAFF-EVENT: a refusal's body read too (its `why`)
    // the hub's own word: the Worker answers 200 only for an order the hub took (AUDIT SAFE RELAY-13)
    if (!res.ok || said?.ok === false) { console.warn('[safety] the relay\'s door said', res.status, said?.error ?? ''); if (said) refused?.(said); }   // STAFF-EVENT: the hub's why (a full book), for the door that asked
    else hear?.(said);
    return res.ok && said?.ok !== false;
  } catch (e) { console.warn('[safety] the relay\'s door', /** @type {any} */ (e)?.message ?? e); return false; }
}

/**
 * STAFF-PANEL2-FIX (design doc, Weak spots: "the cut also ends game sessions and pushes a relay order that strips staff
 * glyphs"): THE CUT'S ORDER FOR THE RELAY - `{o:'staffcut', s, i, e}`, signed (identityToken.js mintStaffCutOrder): the
 * hub closes every socket of account `s` whose token was minted before it, so its staff glyphs leave with them; the
 * account's next token (staff.js /v1/staff/cut ended its game sessions, so only after it signs in again) carries none.
 * null for a service with no key. @param {any} env @param {SubtleCrypto} subtle @param {number} nowS @param {string} s
 */
export async function staffCutOrder(env, subtle, nowS, s) {
  const key = await signingKey(env, subtle);
  return key ? mintStaffCutOrder({ s }, key, { subtle, nowS }) : null;
}
