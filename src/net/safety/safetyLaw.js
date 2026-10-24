// @ts-check
// SAFE1-SAFE4 (2026-10-17, the chat safety plan, bible/11-Multiplayer/Chat-Safety-Arc.md): THE LAW BOTH ENDS AGREE ON
// - the client that asks, and the account service that decides. A player's block list (SAFE1), a report's shape
// (SAFE3), the ladder a strike climbs and a ban's bounds (SAFE4), and the chat commands that ask for them.
//
// THIS SIDE DECIDES NOTHING ABOUT AUTHORITY, as MOD1's (net/moderation.js): a moderator's /ban here is a request the
// service checks against MODERATOR_HANDLES, and a modified client that skipped every line of this file could do
// nothing a player's could not. Pure, and every side effect is the caller's.
//
// Not a DFU member: Daggerfall Unity has no chat. Ledger A row (ONLINE).
import { t, intlLocale } from '../../systems/textManager.js';
import { ID_RE, _b64url } from '../identityToken.js';
import { STAMP_RE, stampableLine } from './chatStamp.js';

/* ═══ SAFE1 - THE BLOCK LIST ═══════════════════════════════════════════
 * An account's own list of the accounts it no longer hears: their chat lines, their invites, their requests. Kept by
 * the service (so it follows the player to every device) and applied by the client (the relay fans a line to everyone;
 * what one hearer hides is that hearer's business). The blocked account is never told. */

/** The most accounts one account may block. */
export const BLOCKS_MAX = 200;

/* ═══ SAFE3 - A REPORT ═════════════════════════════════════════════════ */

/** Why a line is reported - the reporter's word, which the moderator and the reviewer read beside the lines. */
export const REPORT_REASONS = Object.freeze(['harassment', 'hate', 'sexual', 'threat', 'spam', 'other']);
const REASON_LABELS = Object.freeze({
  harassment: () => t('net.safety.reasonHarassment', 'Harassment or bullying'),
  hate: () => t('net.safety.reasonHate', 'Hate or slurs'),
  sexual: () => t('net.safety.reasonSexual', 'Sexual remarks'),
  threat: () => t('net.safety.reasonThreat', 'Threats'),
  spam: () => t('net.safety.reasonSpam', 'Spam or scams'),
  other: () => t('net.safety.reasonOther', 'Something else'),
});
/** A reason in the player's language. @param {string} r */
export const reportReasonLabel = (r) => (Object.hasOwn(REASON_LABELS, r) ? REASON_LABELS[/** @type {keyof typeof REASON_LABELS} */ (r)]() : r);
/** The most lines one report carries: the reported player's and the lines around them. */
export const REPORT_LINES_MAX = 16;
/** How old a line may be when it is reported, ms - a session's chat, not last week's. */
export const REPORT_LINE_AGE_MS = 24 * 3600 * 1000;
/** AUDIT SAFE DOC-17: how far AHEAD of the service's clock a line's stamp may say it was said, ms - the relay's clock and
 *  the service's are two machines, and a minute is more than they drift; a line further on is no line of now. */
export const REPORT_LINE_AHEAD_MS = 60_000;
/** AUDIT SAFE CLIENT-5 (2026-10-17): THE CLIENT'S OWN BOUND, an hour under the service's - a line this page heard more
 *  than this long ago (by its own clock, net/chat.js reportLines) is not picked. The hour is the room between the page's
 *  clock and the relay's, and the moments a report spends on the wire. */
export const REPORT_PICK_AGE_MS = REPORT_LINE_AGE_MS - 3600 * 1000;
/** The longest note a reporter may add. */
export const REPORT_NOTE_MAX = 200;

/**
 * A REPORT'S SHAPE, before any stamp is believed: the account reported, a reason, an optional note, and 1 to
 * REPORT_LINES_MAX stamped lines, at least one of them the reported account's own. The same line twice is one line; the
 * lines come back in the order they were said. `{ error }` names what is wrong in the service's refusal words. The
 * stamps are the service's to verify (chatStamp.js verifyStamp) - this is the shape alone.
 *
 * AUDIT SAFE CLIENT-5 / DOC-7 (2026-10-17): A LINE OUT OF ITS DAY IS DROPPED, NOT REFUSED. A line older than
 * REPORT_LINE_AGE_MS - or stamped more than REPORT_LINE_AHEAD_MS after now (DOC-17) - refused the WHOLE report as
 * `report-stale`, and the client picked lines by nothing but the tab they were on: a quiet tab (a guild's, a party's, a
 * language's) or a page left open overnight keeps yesterday's lines, so a line said a minute ago, reported from its own
 * menu with a context line from last night, was refused. Each such line is left out now, as a reporter may leave any
 * line out; `report-stale` is said only when the reported account HAD lines in the report and every one of them was out
 * of its day, and `report-no-line` when none of the lines was theirs at all. Both ends read this.
 * @param {any} body @param {number} nowMs
 */
export function reportShape(body, nowMs) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'report-shape' };
  const { target, reason, lines } = body;
  if (typeof target !== 'string' || !ID_RE.test(target)) return { error: 'no-player' };
  if (!REPORT_REASONS.includes(reason)) return { error: 'report-reason' };
  const note = body.note ?? '';
  if (typeof note !== 'string' || note.length > REPORT_NOTE_MAX) return { error: 'report-shape' };
  if (!Array.isArray(lines) || !lines.length || lines.length > REPORT_LINES_MAX) return { error: 'report-shape' };
  /** @type {{tab: string, sub: string, name: string, at: number, text: string, sg: string}[]} */
  const out = [];
  const seen = new Set();
  let theirsOut = false;   // AUDIT SAFE CLIENT-5: a line of the reported account's left out for its age
  for (const l of lines) {
    if (!stampableLine(l) || typeof l.sg !== 'string' || !STAMP_RE.test(l.sg)) return { error: 'report-shape' };
    if (nowMs - l.at > REPORT_LINE_AGE_MS || l.at - nowMs > REPORT_LINE_AHEAD_MS) { if (l.sub === target) theirsOut = true; continue; }   // AUDIT SAFE CLIENT-5 / DOC-7 / DOC-17: dropped, never the whole report refused
    const k = `${l.at}|${l.sub}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ tab: l.tab, sub: l.sub, name: l.name, at: l.at, text: l.text, sg: l.sg });
  }
  if (theirsOut && !out.some((l) => l.sub === target)) return { error: 'report-stale' };   // AUDIT SAFE CLIENT-5: theirs, and every one out of its day
  if (!out.some((l) => l.sub === target)) return { error: 'report-no-line' };
  out.sort((a, b) => a.at - b.at);
  return { target, reason, note: note.trim(), lines: out };
}

/* ═══ SAFE4 - STRIKES, THE LADDER AND BANS ═════════════════════════════
 * Every mute and ban is a row in the service's record (mod_actions), and the record is never cleared - MOD1's
 * `muted_by` said who muted a player now; the record says who did what, and when, for good. A strike is a mute or a ban
 * within STRIKE_WINDOW_S; the ladder is the mute the next one earns. A moderator may always choose otherwise; the
 * automatic mutes (SAFE3's reports, SAFE5's reviewer) only ever take the first rung. */

/** The mute each strike earns, minutes: half an hour, then a day, then a week (MOD1's MUTE_MAX_MIN). */
export const LADDER_MIN = Object.freeze([30, 24 * 60, 7 * 24 * 60]);
/** The strikes past which the next answer is a ban, not a mute - a moderator's to give. */
export const LADDER_BAN_AT = LADDER_MIN.length;
/** How long a strike counts, seconds: ninety days. */
export const STRIKE_WINDOW_S = 90 * 24 * 3600;
/** The mute the next strike earns, given the strikes standing. @param {number} strikes */
export const ladderMinutes = (strikes) => LADDER_MIN[Math.max(0, Math.min(LADDER_MIN.length - 1, Math.trunc(Number(strikes) || 0)))];
/** The longest timed ban, days. Past it a ban is for good. */
export const BAN_DAYS_MAX = 365;
/** A ban with no length given, days. */
export const BAN_DAYS_DEFAULT = 30;
/** A ban for good: the last second of 9999, a date no clock reaches. */
export const BAN_FOREVER = 253402300799;
/** When a ban of `days` (0 for good) ends. @param {number} days @param {number} nowS */
export const banUntil = (days, nowS) => (days === 0 ? BAN_FOREVER : nowS + days * 86400);
/** The command's refusal and the service's (accountClient REFUSALS 'bad-days') in one sentence. */
export const banRangeText = () => t('net.safety.banRange', 'A ban is 1 to {max} days, or perm.', { max: BAN_DAYS_MAX });
/** When a mute or a ban ends, as a player reads it: the date in the player's language (the text core's, not the
 *  browser's - AUDIT SAFE CLIENT-13), or "for good". @param {number} s epoch seconds */
export const untilText = (s) => (s >= BAN_FOREVER ? t('net.safety.forGood', 'for good') : t('net.safety.until', 'until {when}', { when: new Date(s * 1000).toLocaleString(intlLocale()) }));
/** AUDIT SAFE CLIENT-2 (2026-10-17): A BAN, AS ITS PLAYER IS TOLD IT - banRangeText's way: one sentence with one home,
 *  said by the game when the relay says the account is banned (scenes/chatSafetyHost.js) and by the account card when
 *  the service refuses a sign-in or a recovery for it (accountClient REFUSALS 'banned' - the service's 403 carries the
 *  end and the moderator's reason). @param {number} until epoch seconds @param {unknown} [reason] */
export const bannedText = (until, reason = null) => {
  const why = typeof reason === 'string' ? reason.trim() : '';
  return why ? t('net.safety.bannedWhy', 'This account is banned {until}. Reason: {reason}', { until: untilText(until), reason: why })
    : t('net.safety.bannedAccount', 'This account is banned {until}.', { until: untilText(until) });
};

/** SAFE4: WHICH DOOR AN ORDER GOES TO - 'mute' or 'ban', read off its body, or null. The client never verifies an order
 *  (the room does, with the key); it only needs to carry a pushed one (the hub's `law`) to the arm that reads its kind.
 *  STAFF-PANEL5-CUT-FIX: and 'staffcut', a staff member cut off - carried by the ban's door (the room's `_banFrame`). */
export function orderKindOf(order) {
  const body = typeof order === 'string' ? order.split('.')[1] : null;
  const raw = body ? _b64url.decode(body) : null;
  if (!raw) return null;
  try { const o = JSON.parse(new TextDecoder().decode(raw))?.o; return o === 'mute' || o === 'ban' || o === 'staffcut' ? o : null; } catch { return null; }
}

/* ═══ THE COMMANDS ═════════════════════════════════════════════════════ */

/** The commands this file reads - the host asks before the chat parser (net/chatCommands.js HOST_COMMANDS). AUDIT SAFE
 *  DOC-4: and a moderator's look at the reports - /cases, /case <name>, /dismiss <name> - and their list, /modhelp. */
export const SAFETY_COMMANDS = Object.freeze(['block', 'unblock', 'blocked', 'report', 'conduct', 'rules', 'ban', 'unban', 'strikes', 'cases', 'case', 'dismiss', 'modhelp']);
const USAGE = Object.freeze({
  block: () => t('net.safety.usageBlock', 'Usage: /block <name> - hides their messages. /unblock <name> undoes it; /blocked lists them.'),
  unblock: () => t('net.safety.usageUnblock', 'Usage: /unblock <name>.'),
  report: () => t('net.safety.usageReport', 'Usage: /report <name> [harassment|hate|sexual|threat|spam][: note] - sends their recent lines, and your note, to the moderators.'),
  ban: () => t('net.safety.usageBan', 'Usage: /ban <name> [days|perm][: reason], or /unban <name>.'),
  unban: () => t('net.safety.usageUnban', 'Usage: /unban <name>.'),
  strikes: () => t('net.safety.usageStrikes', 'Usage: /strikes <name>.'),
  case: () => t('net.safety.usageCase', 'Usage: /case <name> - the open case on that player.'),
  dismiss: () => t('net.safety.usageDismiss', 'Usage: /dismiss <name> - closes their open case with no action.'),
});
/** AUDIT SAFE DOC-4 (2026-10-17): THE MODERATORS' OWN LINES - /modhelp. MOD1's /mute and /unmute (net/moderation.js), this
 *  file's /ban, /unban and /strikes, and the reports' queue read in the game: the service answers each for a moderator
 *  alone (MODERATOR_HANDLES), so a player who asks reads what they could not do. */
export const modHelpLines = () => [
  t('net.safety.modHelpHead', 'Moderators\' commands:'),
  t('net.safety.modHelpMute', '/mute <name> [minutes], /unmute <name> - stop a player chatting for a while, or allow it again'),
  t('net.safety.modHelpBan', '/ban <name> [days|perm][: reason], /unban <name> - ban an account (the reason is shown to them), or lift it'),
  t('net.safety.modHelpStrikes', '/strikes <name> - their strikes, the next penalty, any current mute or ban, and their recent history'),
  t('net.safety.modHelpCases', '/cases - the open reports, the most credible first'),
  t('net.safety.modHelpCase', '/case <name> - one case: its lines (theirs marked >), reasons, notes and the reviewer\'s verdict (its line marked !)'),
  t('net.safety.modHelpDismiss', '/dismiss <name> - close a case with no action; an automatic mute it caused is lifted'),
];
const COMMAND_RE = new RegExp(`^/(${SAFETY_COMMANDS.join('|')})(?:\\s+([\\s\\S]*))?$`, 'i');

/**
 * Read a line as a safety command, or null if it is not one. `{ op, name?, reason?, note?, days? }`, or `{ error }` for
 * a command typed wrong - said, never sent as chat. A NAME MAY HAVE A SPACE IN IT (a guest's always does), so a report's
 * reason and a ban's length are the LAST word, and only when that word is one; everything before it is the name.
 *
 * AUDIT SAFE DOC-13 + SERVICE-10 (2026-10-17): AND WHAT FOLLOWS THE FIRST COLON IS THE REPORTER'S OR THE MODERATOR'S OWN
 * WORDS - a report's note (`/report <name> [reason]: <note>`, at most REPORT_NOTE_MAX, which the moderators read beside
 * the lines) and a ban's reason (`/ban <name> [days|perm]: <reason>`, which the banned player is shown). The service
 * took both and no client ever sent either. A name with a colon in it is reported or banned from a line's own menu.
 * @param {string} text
 */
export function parseSafetyCommand(text) {
  const m = COMMAND_RE.exec(String(text ?? '').trim());
  if (!m) return null;
  const op = m[1].toLowerCase();
  const whole = (m[2] ?? '').trim();
  if (op === 'blocked' || op === 'conduct' || op === 'rules' || op === 'cases' || op === 'modhelp') return { op: op === 'rules' ? 'conduct' : op };
  // AUDIT SAFE DOC-13 + SERVICE-10: the words after the first colon - a report's note, a ban's reason - never the name
  const colon = op === 'report' || op === 'ban' ? whole.indexOf(':') : -1;
  const rest = colon >= 0 ? whole.slice(0, colon).trim() : whole;
  const words = colon >= 0 ? whole.slice(colon + 1).replace(/\s+/g, ' ').trim() : '';
  if (!rest) return { error: USAGE[/** @type {keyof typeof USAGE} */ (op)]() };
  if (op === 'report') {
    if (words.length > REPORT_NOTE_MAX) return { error: t('net.safety.noteLong', 'A note is at most {max} characters.', { max: REPORT_NOTE_MAX }) };
    const tail = /^(.*\S)\s+(\S+)$/.exec(rest);
    const said = tail?.[2].toLowerCase();
    const note = words ? { note: words } : {};
    return tail && said && REPORT_REASONS.includes(said) ? { op, name: tail[1], reason: said, ...note } : { op, name: rest, reason: 'other', ...note };
  }
  if (op === 'ban') {
    const tail = /^(.*\S)\s+(\d+|perm|forever)$/i.exec(rest);
    const counted = !!tail && /^\d+$/.test(tail[2]);
    const days = !tail ? BAN_DAYS_DEFAULT : counted ? Number(tail[2]) : 0;
    if (counted && (!Number.isSafeInteger(days) || days < 1 || days > BAN_DAYS_MAX)) return { error: banRangeText() };
    return { op, name: tail ? tail[1] : rest, days, ...(words ? { reason: words } : {}) };
  }
  return { op, name: rest };
}
