// @ts-check
// CLAUDE'S PANEL DOORS (claudeStaff.js writes what these show): its suggestions, for staff members to read and decide.
// /v1/staff/claude/list lists them (Admins all, Moderators the chat reports'), /decide records accept or dismiss for members
// on CLAUDE_ORDER_HANDLES alone, /digest gives those members counts and the top pending items since a time.
// ACCEPT ONLY RECORDS THE DECISION. It never runs the suggested act: the panel runs it through the act's own door under
// the deciding member's session, so the audit log shows who decided and who acted.
import { displayName } from './accounts.js';
import { claudeHandle, isClaudeOrder } from './claudeStaff.js';

export const CLAUDE_ROUTES = Object.freeze(['/v1/staff/claude/list', '/v1/staff/claude/decide', '/v1/staff/claude/digest']);
export const CLAUDE_PAGE = 50;
export const DIGEST_TOP = 10;
export const DIGEST_SINCE_S = 3600;
/** A read is one audit row per member and view in this many seconds (the log's own habit). */
const READ_ROW_S = 10 * 60;

const json = (/** @type {any} */ s) => {
  try { return s ? JSON.parse(s) : null; } catch { return null; }
};

/**
 * THE PANEL'S DOORS for Claude. Answers the route's body, or `{ error }` (staff.js STAFF_STATUS its status).
 * @param {any} ctx @param {any} env @param {string} path @param {any} body
 * @param {{ player: any, role: string }} who @param {(act: string, target?: string|null, detail?: object|null, how?: any) => any} audit
 */
export async function staffClaude(ctx, env, path, body, who, audit) {
  const { db, nowS } = ctx;
  const me = who.player;
  const refuse = async (/** @type {string} */ need) => {
    await audit('refused', null, { path, need }, { outcome: 'denied' }).run();
    return { error: 'staff-admin' };
  };
  if (path === '/v1/staff/claude/list') {
    const status = ['pending', 'accepted', 'dismissed'].includes(body.status) ? body.status : null;
    const before = Number.isSafeInteger(body.before) && body.before > 0 ? body.before : null;
    const limit = Number.isSafeInteger(body.limit) ? Math.min(Math.max(body.limit, 1), CLAUDE_PAGE) : CLAUDE_PAGE;
    const [r] = await db.batch([
      db
        .prepare(`SELECT s.*, p.handle, p.guest_name FROM claude_suggestions s JOIN players p ON p.id = s.subject
          WHERE (?1 IS NULL OR s.status = ?1) AND (?2 IS NULL OR s.id < ?2) AND (?3 = 'admin' OR s.kind = 'report')
          ORDER BY s.id DESC LIMIT ?4`)
        .bind(status, before, who.role, limit),
      audit('claude-read', null, { status, before }, { onceIn: READ_ROW_S }),
    ]);
    return {
      author: claudeHandle(env),
      suggestions: (r.results ?? []).map((/** @type {any} */ s) => ({
        id: s.id, kind: s.kind, subject: s.subject, name: displayName(s), caseId: s.case_id, urgency: s.urgency, summary: s.summary,
        evidence: json(s.evidence), action: json(s.action), status: s.status, decidedBy: s.decided_by, decidedAt: s.decided_at, createdAt: s.created_at,
      })),
    };
  }
  if (!isClaudeOrder(env, me)) return refuse('claude-order');
  if (path === '/v1/staff/claude/decide') {
    const decision = body.decision === 'accept' ? 'accepted' : body.decision === 'dismiss' ? 'dismissed' : null;
    if (!Number.isSafeInteger(body.id) || !decision) return { error: 'body' };
    const row = await db.prepare('SELECT id, kind, subject, status FROM claude_suggestions WHERE id = ?1').bind(body.id).first();
    if (!row) return { error: 'no-suggestion' };
    const [, done] = await db.batch([
      audit('claude-decide', row.subject, { id: row.id, kind: row.kind, decision }, { okIf: { sql: "EXISTS (SELECT 1 FROM claude_suggestions WHERE id = ? AND status = 'pending')", args: [row.id] } }),
      db.prepare("UPDATE claude_suggestions SET status = ?2, decided_by = ?3, decided_at = ?4 WHERE id = ?1 AND status = 'pending'").bind(row.id, decision, me.handle, nowS),
    ]);
    return done.meta.changes ? { ok: true, id: row.id, status: decision } : { error: 'suggestion-decided' };
  }
  // /v1/staff/claude/digest
  const since = Number.isSafeInteger(body.since) && body.since >= 0 ? body.since : nowS - DIGEST_SINCE_S;
  const [counts, top] = await db.batch([
    db.prepare("SELECT kind, urgency, status, COUNT(*) AS n FROM claude_suggestions WHERE created_at > ?1 AND (?2 = 'admin' OR kind = 'report') GROUP BY kind, urgency, status").bind(since, who.role),
    db.prepare("SELECT id, kind, urgency, summary, created_at FROM claude_suggestions WHERE status = 'pending' AND created_at > ?1 AND (?3 = 'admin' OR kind = 'report') ORDER BY urgency = 'urgent' DESC, id DESC LIMIT ?2").bind(since, DIGEST_TOP, who.role),
  ]);
  return { since, counts: counts.results ?? [], top: top.results ?? [] };
}
