// @ts-check
// ═══════════════════════════════════════════════════════════════════
// STAFF-PANEL2 (2026-10-22, mob: "do all 6"; design doc "DFO Staff Panel: design", build step 2) - THE PANEL'S REPORTS:
// the open chat cases most urgent first, one case read with its lines and the account's strike record, a case claimed
// and let go, and Mute, Ban, Unban and Dismiss - Admins and Moderators both (mob, 03:03Z: Moderators get "only chat report
// notifications with Mute and Ban").
//
// NOTHING NEW IS JUDGED. Every act is the one the game's own moderators' routes make (index.js /v1/mod/*): MOD1's
// muteAccount, SAFE4's banAccount and unbanAccount, AUDIT SAFE DOC-4's modCase and modDismiss - so a panel act lands in the
// same strike history (`mod_actions`), closes the case as an in-game act does, and its order reaches the relay's door
// (pushLaw) as one does. What the panel adds is who acted from where ("(staff panel)"), the audit row, and the claim.
// STAFF-PANEL2-FIX: an act's audit row is written in modAct, as every door's is, by the panel's own writer - once.
//
// WHAT GOES FIRST (design doc, "What goes first"; mob, 04:05Z: "prioty of reports"): each case a level - high, medium or
// low - and the words that say why, from what mod_cases and mod_reports already hold (caseUrgency). The reviewer's
// severity is read off the row, never `modCases`' verdict, which hides one while a case is read again. The weights are
// starting numbers to tune, not measured ones.
//
// A CLAIM (mob, 04:13Z: "admin can alwasy take a case", "mods can only take one"): a Moderator holds one open case at a
// time, checked in the statement that takes it; an Admin takes any, one a Moderator holds too, and the Moderator is told
// (`claim_from`, answered as `lost`). A claim lets go CLAIM_S after its holder's last look or act on it. While another
// member holds a case, the panel's acts on its account are refused (`staff-claimed`), and so is a Discord press on it
// (discord.js onPress).
//
// EVERY LIST PAGES (mob, 19:25Z: "put inf scroll in anything that pull lists"): `from` the offset of the next page,
// answered as `next` while more stand.
//
// STAFF-PANEL2-FIX (2026-10-22; design doc, Weak spots "Sanctions, cases and roles" and "Panel Mute and Ban have no
// route"): the acts are safety.js modAct's, the one code every door shares - one sanction a case (a Mute or Ban carries
// its case and the press's one-time `click`), the claim asked inside it, a spawn case an Admin's, and an Admin's
// sanction lifted by an Admin alone. Cases have a kind: Moderators see and act on chat cases only, Admins on both. One
// reporter's own "threat" makes a case Medium at most; a claimed High case nobody touched for HIGH_IDLE_S returns to the
// top of its level; a claim ends with the staff session that took it (safety.js claimHeldSql).
import { displayName } from './accounts.js';
import { caseReads, caseView, modAct, claimHeldSql } from './safety.js';
import { strikesLook, findAccount } from './sanctions.js';
import { canModerate } from './titles.js';
import { LADDER_BAN_AT, STRIKE_WINDOW_S } from '../../src/net/safety/safetyLaw.js';
import { ID_RE } from '../../src/net/identityToken.js';

/** A claim lets go this long after its holder's last look or act on the case (design doc: "a starting number to tune"). */
export const CLAIM_S = 30 * 60;
/** Cases one page answers. */
export const CASES_PAGE = 25;
/** The open cases one read ranks at most - the ranking is the whole list's, so it is read whole. */
export const CASES_RANKED_MAX = 500;
/** A reviewer's read still waiting this long is itself a reason to look. */
export const AI_WAIT_S = 10 * 60;
/** A case nobody has touched this long goes up one level. */
export const STALE_S = 24 * 60 * 60;
/** Reporters who count, inside one hour, that make a case high. */
export const CREDIBLE_WAVE = 3;
/** STAFF-PANEL2-FIX (Weak spots: "One reporter's own 'threat' pick can make a case High. It can raise a case to Medium
 *  at most"): reporters who must say "threat" before the reviewer reads it for the case to be high. */
export const THREAT_HIGH = 2;
/** STAFF-PANEL2-FIX (Weak spots: "A claimed High case returns to the top after 5 minutes with no action"): how long a
 *  claimed high case may stand untouched by its holder before it sorts as if nobody held it. */
export const HIGH_IDLE_S = 5 * 60;

export const CASE_ROUTES = Object.freeze(['/v1/staff/cases', '/v1/staff/case', '/v1/staff/claim', '/v1/staff/release',
  '/v1/staff/strikes', '/v1/staff/mute', '/v1/staff/ban', '/v1/staff/unban', '/v1/staff/dismiss']);

const LEVELS = Object.freeze(['low', 'medium', 'high']);
const SEVERITY_WORD = Object.freeze({ 1: 'low', 2: 'medium', 3: 'high' });

/**
 * A CASE'S LEVEL, and why - the design doc's rules, from the row and its reports.
 * @param {any} c a mod_cases row
 * @param {{ reports: Array<{ reason: string, counted: number, at: number }>, strikes: number, nowS: number }} what
 * @returns {{ level: 'high'|'medium'|'low', why: string[] }}
 */
export function caseUrgency(c, { reports, strikes, nowS }) {
  const why = [];
  let rank = 0;
  const raise = (/** @type {number} */ to, /** @type {string} */ word) => { if (to > rank) rank = to; why.push(word); };
  const n = Number(c.reports) || reports.length;
  why.push(`${n} reporter${n === 1 ? '' : 's'}`);
  const sev = c.ai_category ? Number(c.ai_severity) : 0;
  if (sev) {
    const word = `AI check: ${c.ai_category}, ${SEVERITY_WORD[/** @type {1|2|3} */ (sev)] ?? sev}`;
    if (sev >= 3 || (sev === 2 && (c.ai_category === 'threat' || c.ai_category === 'personal-info'))) raise(2, word);
    else raise(sev === 2 ? 1 : 0, word);
  } else {
    // before the reviewer has read it, the reporters' own reason stands in
    const said = new Set(reports.map((r) => r.reason));
    const threats = reports.filter((r) => r.reason === 'threat').length;
    if (threats) raise(threats >= THREAT_HIGH ? 2 : 1, 'reported as a threat');
    else if (said.has('hate') || said.has('sexual')) raise(1, `reported as ${said.has('hate') ? 'hate' : 'sexual'}`);
    else if (said.has('harassment') && n >= 2) raise(1, 'reported as harassment');
  }
  if (c.ai_state === 'failed') raise(2, 'AI check failed');
  else if ((c.ai_state === 'due' || c.ai_state === 'reading') && nowS - Number(c.updated_at) >= AI_WAIT_S) raise(1, 'AI check still waiting');
  if (c.auto) raise(2, 'muted automatically, unchecked');
  const counted = reports.filter((r) => r.counted === 1).map((r) => r.at).sort((a, b) => a - b);
  let wave = 0;
  for (let i = 0, j = 0; j < counted.length; j++) { while (counted[j] - counted[i] > 3600) i++; wave = Math.max(wave, j - i + 1); }
  if (wave >= CREDIBLE_WAVE) raise(2, `${wave} trusted reporters within an hour`);
  else if (n >= 2 && counted.length) raise(1, '');   // reporters who are all guests or new accounts are low
  if (strikes >= LADDER_BAN_AT) raise(2, `${strikes} strikes: next is a ban`);
  else if (strikes > 0) raise(1, `${strikes} strike${strikes === 1 ? '' : 's'}`);
  if (c.discord_state === 'failed') raise(1, 'Discord card failed');
  if (reports.length && !counted.length) why.push('reporters all guests or new');
  if (nowS - Number(c.updated_at) >= STALE_S && rank < 2) { rank++; why.push('untouched for a day'); }
  return { level: /** @type {'high'|'medium'|'low'} */ (LEVELS[rank]), why: why.filter(Boolean) };
}

/** STAFF-PANEL6-STATUS (design doc, "Home: only the top of everything"; mob, 03:23Z): THE REPORTS' WATCH ON HOME
 *  (staffStatus.js HOME_WATCHES) - the open cases as /v1/staff/cases ranks them, its first `n`, every staff member's
 *  (Moderators see Reports only). Home writes its own audit row for the read, so this one writes none. */
export const HOME_WATCH = Object.freeze({
  id: 'reports', label: 'Reports', role: 'moderator',
  /** @param {any} ctx @param {any} env @param {{ player: any, role: string }} who @param {number} n */
  async top(ctx, env, who, n) {
    const r = /** @type {any} */ (await staffCases(ctx, env, '/v1/staff/cases', {}, who, () => null));
    return { items: r.cases.slice(0, n).map((/** @type {any} */ c) => ({ level: c.level, why: c.why.join(' · '), sub: c.target, name: c.name })), high: r.high, total: r.total };
  },
});

/** Whether a row's claim stands now - held, in time, its session alive: the row's `claim_live` (claimHeldSql). @param {any} c */
const held = (c) => !!c?.claimed_by && c.claim_live === 1;

/**
 * THE PANEL'S CASE DOORS. Answers the route's body, or `{ error }` (staff.js STAFF_STATUS its status).
 * @param {any} ctx @param {any} env @param {string} path @param {any} body
 * @param {{ player: any, role: string, hash: string }} who
 * @param {(act: string, target?: string|null, detail?: object|null, how?: object) => any} audit
 */
export async function staffCases(ctx, env, path, body, who, audit) {
  const { db, nowS } = ctx;
  const me = who.player;
  const admin = who.role === 'admin';
  const asName = `${displayName(me)} (staff panel)`;

  if (path === '/v1/staff/cases') {
    const sort = body.sort === 'newest' ? 'newest' : 'urgent';
    const from = Number.isSafeInteger(body.from) && body.from > 0 ? body.from : 0;
    // STAFF-PANEL-SPEED (mob: "The click takes a while before the new page shows (it's waiting on the server)"): the
    // list's reads and its audit row in one batch, one trip - none needs another's answer (Home's watch writes no row)
    const said = audit('cases-read', null, { sort }, { onceIn: 10 * 60 });
    const read = await db.batch([
      // STAFF-PANEL2-FIX: a Moderator's list is the chat cases alone; an Admin's every kind
      db.prepare(`SELECT c.*, p.handle, p.guest_name, h.handle AS holder_handle, h.guest_name AS holder_guest, ${claimHeldSql('c', 2)} AS claim_live
      FROM mod_cases c JOIN players p ON p.id = c.target LEFT JOIN players h ON h.id = c.claimed_by
      WHERE c.status = 'open' AND (c.kind = 'chat' OR ?3 = 1) ORDER BY c.opened_at DESC LIMIT ?1`).bind(CASES_RANKED_MAX, nowS, admin ? 1 : 0),
      db.prepare(`SELECT r.case_id, r.reason, r.counted, r.at FROM mod_reports r JOIN mod_cases c ON c.id = r.case_id
      WHERE c.status = 'open'`),
      db.prepare(`SELECT a.target, COUNT(*) AS n FROM mod_actions a WHERE a.kind IN ('mute', 'ban') AND a.at > ?1
      AND a.void_at IS NULL AND a.target IN (SELECT target FROM mod_cases WHERE status = 'open') GROUP BY a.target`).bind(nowS - STRIKE_WINDOW_S),
      // the cases taken from this member, told on the first page alone
      ...(from ? [] : [db.prepare(`SELECT c.id, c.target, p.handle, p.guest_name, h.handle AS holder FROM mod_cases c JOIN players p ON p.id = c.target
      LEFT JOIN players h ON h.id = c.claimed_by WHERE c.status = 'open' AND c.claim_from = ?1 AND c.claimed_by IS NOT ?1 AND ${claimHeldSql('c', 2)}`).bind(me.id, nowS)]),
      ...(said ? [said] : []),
    ]);
    const [rows, reports, strikes] = read.slice(0, 3).map((/** @type {any} */ x) => x?.results ?? []);
    const strikesOf = new Map(strikes.map((s) => [s.target, Number(s.n)]));
    const ranked = rows.map((c) => {
      const mine = reports.filter((r) => r.case_id === c.id);
      const u = caseUrgency(c, { reports: mine, strikes: strikesOf.get(c.target) ?? 0, nowS });
      // a high case its holder left untouched HIGH_IDLE_S (claim_until is CLAIM_S past their last look or act) is `idle`
      const claim = held(c) ? { by: c.claimed_by, name: c.holder_handle ?? c.holder_guest ?? null, until: c.claim_until, mine: c.claimed_by === me.id,
        idle: u.level === 'high' && nowS - (Number(c.claim_until) - CLAIM_S) >= HIGH_IDLE_S } : null;
      return {
        id: c.id, target: c.target, kind: c.kind, name: displayName(c), reports: c.reports, credible: c.credible, reasons: [...new Set(mine.map((r) => String(r.reason)))],
        level: u.level, why: u.why, ai: c.ai_category ? { category: c.ai_category, severity: c.ai_severity, confidence: c.ai_confidence, state: c.ai_state } : null,
        auto: c.auto ?? null, openedAt: c.opened_at, updatedAt: c.updated_at, lastReport: mine.reduce((a, r) => Math.max(a, r.at), 0), claim,
      };
    });
    const lvl = (/** @type {any} */ x) => LEVELS.indexOf(x.level);
    ranked.sort(sort === 'newest' ? (a, b) => b.openedAt - a.openedAt : (a, b) => lvl(b) - lvl(a)
      || (a.claim && !a.claim.idle ? 1 : 0) - (b.claim && !b.claim.idle ? 1 : 0)   // a claimed case sorts below the rest of its level, unless left idle
      || (b.ai?.confidence ?? 0) - (a.ai?.confidence ?? 0)
      || (nowS - b.lastReport < 3600 ? 1 : 0) - (nowS - a.lastReport < 3600 ? 1 : 0)   // reports still coming in
      || a.openedAt - b.openedAt);
    const page = ranked.slice(from, from + CASES_PAGE);
    const lost = from ? [] : (read[3]?.results ?? []).map((/** @type {any} */ c) => ({ id: c.id, target: c.target, name: displayName(c), by: c.holder ?? null }));
    return { cases: page, next: from + CASES_PAGE < ranked.length ? from + CASES_PAGE : null, total: ranked.length, high: ranked.filter((c) => c.level === 'high').length, lost };   // STAFF-PANEL6-STATUS: `high`, the Reports' "N high of M"
  }

  // every other door names one account: by its id, or a name (sanctions.js findAccount) - and its open case: the one
  // `case` names, else its chat case first; a Moderator's, chat cases alone (STAFF-PANEL2-FIX). The whole row: a case
  // read shows it (safety.js caseView)
  const named = typeof body.case === 'string' ? body.case : null;
  const openOf = (/** @type {string} */ id) => db.prepare(`SELECT *, ${claimHeldSql('mod_cases', 2)} AS claim_live FROM mod_cases WHERE target = ?1 AND status = 'open'
    AND (?3 IS NULL OR id = ?3) AND (kind = 'chat' OR ?4 = 1) ORDER BY kind = 'chat' DESC LIMIT 1`).bind(id, nowS, named, admin ? 1 : 0).first();
  // STAFF-PANEL-SPEED: an account named by its id is read beside its open case, one trip; one named by a name is found first
  const byId = typeof body.target === 'string' && ID_RE.test(body.target);
  const [row, early] = await Promise.all([findAccount(db, { target: body.target, name: body.name }), byId ? openOf(body.target) : null]);
  if ('error' in row) return row;
  const open = byId && row.id === body.target ? early : await openOf(row.id);
  const theirs = held(open) && open.claimed_by !== me.id;
  /** The holder's look or act keeps the claim - and moves it to the session that looked (a claim ends with its session):
   *  the statement, or null when there is none to keep. */
  const keep = () => (open && held(open) && open.claimed_by === me.id
    ? db.prepare("UPDATE mod_cases SET claim_until = ?3, claim_session = ?4 WHERE id = ?1 AND claimed_by = ?2 AND status = 'open'").bind(open.id, me.id, nowS + CLAIM_S, who.hash) : null);

  if (path === '/v1/staff/case' || path === '/v1/staff/strikes') {
    if (!canModerate(me, env)) return { error: 'not-moderator' };   // strikesLook's own refusal, asked before the batch below writes
    const one = path === '/v1/staff/case';
    if (one && !open) return { error: 'no-case' };   // safety.js modCase's answer: the account has no open case this member may read
    // STAFF-PANEL-SPEED: the case's lines and reports, the claim kept, the audit row and the claim read back - one batch,
    // in the order they were made one after another, so the page is never shown without its row - and beside it the
    // record's reads (strikesLook: mod_actions alone, which the batch never writes), the same trip
    const k = keep();
    const [look, out] = await Promise.all([strikesLook(ctx, me, env, { target: row.id, row }),
      db.batch([...(one ? caseReads(db, open.id) : []), ...(k ? [k] : []),
        audit(one ? 'case-read' : 'strikes-read', row.id, { name: displayName(row) }, { onceIn: 10 * 60 }),
        ...(open ? [db.prepare(`SELECT c.claimed_by, c.claim_until, h.handle, h.guest_name, ${claimHeldSql('c', 2)} AS claim_live FROM mod_cases c
        LEFT JOIN players h ON h.id = c.claimed_by WHERE c.id = ?1`).bind(open.id, nowS)] : [])])]);
    if ('error' in look) return look;
    const c = open ? out[out.length - 1]?.results?.[0] ?? null : null;
    return {
      ...(one ? { case: caseView(row, open, out[0]?.results ?? [], out[1]?.results ?? []) } : {}), record: look,
      claim: held(c) ? { by: c.claimed_by, name: c.handle ?? c.guest_name ?? null, until: c.claim_until, mine: c.claimed_by === me.id } : null,
    };
  }

  if (path === '/v1/staff/claim' || path === '/v1/staff/release') {
    if (!open) return { error: 'no-case' };
    if (path === '/v1/staff/release') {
      const [, r] = await db.batch([
        audit('case-release', row.id, { case: open.id }, { okIf: { sql: "EXISTS (SELECT 1 FROM mod_cases WHERE id = ? AND claimed_by = ? AND status = 'open')", args: [open.id, me.id] } }),
        db.prepare("UPDATE mod_cases SET claimed_by = NULL, claim_until = NULL, claim_from = NULL, claim_session = NULL WHERE id = ?1 AND claimed_by = ?2 AND status = 'open'").bind(open.id, me.id),
      ]);
      return r.meta.changes ? { ok: true, case: open.id } : { error: 'no-case' };
    }
    const until = nowS + CLAIM_S;
    // an Admin takes any open case, and the member it was taken from is told; a Moderator takes one nobody holds, and
    // only while holding no other - both in the statement that takes it, so two takes at once land one. A claim is this
    // session's (`claim_session`): one whose session ended stands for nobody (claimHeldSql)
    const take = admin
      ? db.prepare(`UPDATE mod_cases SET claim_from = CASE WHEN claimed_by != ?2 AND ${claimHeldSql('mod_cases', 3)} THEN claimed_by ELSE NULL END,
          claimed_by = ?2, claim_until = ?4, claim_session = ?5 WHERE id = ?1 AND status = 'open'`).bind(open.id, me.id, nowS, until, who.hash)
      : db.prepare(`UPDATE mod_cases SET claim_from = NULL, claimed_by = ?2, claim_until = ?4, claim_session = ?5 WHERE id = ?1 AND status = 'open'
          AND (claimed_by IS ?2 OR NOT ${claimHeldSql('mod_cases', 3)})
          AND NOT EXISTS (SELECT 1 FROM mod_cases o WHERE o.status = 'open' AND o.claimed_by = ?2 AND ${claimHeldSql('o', 3)} AND o.id != ?1)`).bind(open.id, me.id, nowS, until, who.hash);
    const r = await take.run();
    if (!r.meta.changes) {
      await audit('case-claim', row.id, { case: open.id, why: theirs ? 'held' : 'one-case' }, { outcome: 'denied' }).run();
      return { error: theirs ? 'staff-claimed' : 'staff-one-case' };
    }
    await audit('case-claim', row.id, { case: open.id, ...(admin && theirs ? { from: open.claimed_by } : {}) }).run();
    return { ok: true, case: open.id, until };
  }

  // ═══ THE ACTS: the game's moderators' own, made as this member, from the panel (safety.js modAct) ═══
  const act = path.slice('/v1/staff/'.length);
  if (!['mute', 'ban', 'unban', 'dismiss'].includes(act)) return { error: 'not-found' };
  // a panel's Mute and Ban carry the press's one-time id (the design doc: "Mute and Ban send the case id and a one-time
  // click id"), so a press sent twice is one strike - one sent with none is refused by modAct as a bad one, and written
  const r = await modAct(ctx, me, env, {
    act: /** @type {'mute'|'ban'|'unban'|'dismiss'} */ (act), target: row.id, row, caseId: body.case ?? null,
    click: (act === 'mute' || act === 'ban') && typeof body.click !== 'string' ? '' : body.click ?? null,
    minutes: body.minutes, days: body.days, reason: body.reason, actorName: asName, from: 'staff panel',
  }, { audit });
  if (r.error) return r;
  // STAFF-PANEL-SPEED: an act that closed the open case leaves it no claim to keep (keep's UPDATE asks it open) - no trip
  if (r.case !== open?.id) await keep()?.run();
  return { ...r, order: undefined };   // no rooms to carry it to: the relay's door has it
}
