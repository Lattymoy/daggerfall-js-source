// INT6 (2026-10-09, the INTEGRITY arc - bible/06-Systems/Integrity-Arc.md): THE REVIEW, BY HAND. The account service's
// routes do the work and hold the law (server-account/src/review.js); this names the act and says the answer.
//
//   node tools/realmReview.mjs holds                         the characters held or flagged, each with its last finding
//   node tools/realmReview.mjs findings <id>                 one character's findings and its wealth by the hour
//   node tools/realmReview.mjs clear <id> [note]             lift its hold (its strikes with it) and its flag
//   node tools/realmReview.mjs hold <id> [note]              hold its trade by hand
//   node tools/realmReview.mjs rollback <id> [note]          back to its last checkpoint judged clean (its tab loses the seat)
//   node tools/realmReview.mjs budget [days]                 the measure: gold an hour of play, by level band, the service's
//                                                            own faucets' gold in the window (a patron's purchases), and the config
//   node tools/realmReview.mjs budget-set <json>             write the budget's config - { enforce, bands: [{ upTo, rate, cap }] }
//   node tools/realmReview.mjs bodies [days]                 INT14: the boss fights' count - mends claimed a minute, and what
//                                                            the line standing would have cost
//
// THE MEASURE FIRST (Mac, 2026-10-09: "Measure 7 days, then enforce"): read `budget 7` after a week, set each band's
// `rate` past its 0.999 quantile with room, and `budget-set` with `enforce: true`.
// INT14 (Mac, 2026-10-10: "Measure, then enforce"): read `bodies 7` after a week; the boss fights' line is the RELAY'S - set
// its BOSS_BODY var (server/wrangler.toml, net/bossBody.js bodyConfig) to `{"enforce": true, "body": {"depth", "perS"},
// "hull": {"depth", "perS"}}`, `perS` past the 0.999 quantile's rate (a minute's, in thousandths: / 60000) with room.
//
// Signed in as YOU - a developer, your handle in the service's DEVELOPER_HANDLES: DAGGER_HANDLE and DAGGER_PASSWORD sign
// in for this one call and sign out after it; DAGGER_SECRET, a session secret you already hold, is used as it is and left
// signed in. DAGGER_ACCOUNT_SERVICE points at another service (a local one); the live one by default.
import { DEFAULT_ACCOUNT_SERVICE, accountRefusalText } from '../src/net/accountClient.js';
import { isMain } from './lib/isMain.mjs';

export const USAGE = [
  'usage: node tools/realmReview.mjs holds',
  '       node tools/realmReview.mjs findings|clear|hold|rollback <realm character id> [note]',
  '       node tools/realmReview.mjs budget [days]',
  '       node tools/realmReview.mjs budget-set <json>',
  '       node tools/realmReview.mjs bodies [days]',
  '  Sign in with DAGGER_HANDLE and DAGGER_PASSWORD (or DAGGER_SECRET); DAGGER_ACCOUNT_SERVICE for another service.',
].join('\n');

/** AUDIT LW-II-2 S6 (Living World II decision 7): the measure's faucets named, one line each - the gold the service paid
 *  that no player paid, over the window the measure read (server-account/src/review.js measure's `faucets`).
 *  @param {any} body @returns {string[]} */
export function faucetLines(body) {
  if (!Array.isArray(body?.faucets)) return [];
  return body.faucets.map((/** @type {any} */ f) => `faucet ${f.kind}: ${f.gold} gold in ${f.n} payments over the last ${body.days} days`);
}

/** The acts that name a character. */
const BY_ID = Object.freeze(['findings', 'clear', 'hold', 'rollback']);

/**
 * The route and body for these arguments - `{ path, body }` - or `{ usage }`.
 * @param {string[]} argv
 * @returns {{ path: string, body: any } | { usage: string }}
 */
export function reviewRequest(argv) {
  const [act, ...rest] = argv;
  if (act === 'holds' && rest.length === 0) return { path: '/v1/mod/realm-holds', body: {} };
  if (BY_ID.includes(act) && rest.length >= 1 && /^r[0-9a-f]{20}$/.test(rest[0])) {
    const note = rest.slice(1).join(' ');
    return { path: `/v1/mod/realm-${act}`, body: { id: rest[0], ...(note ? { note } : {}) } };
  }
  if (act === 'budget' && rest.length <= 1) {
    const days = rest.length ? Number(rest[0]) : 7;
    return Number.isSafeInteger(days) && days >= 1 && days <= 30 ? { path: '/v1/mod/realm-budget', body: { days } } : { usage: USAGE };
  }
  if (act === 'bodies' && rest.length <= 1) {   // INT14
    const days = rest.length ? Number(rest[0]) : 7;
    return Number.isSafeInteger(days) && days >= 1 && days <= 30 ? { path: '/v1/mod/realm-bodies', body: { days } } : { usage: USAGE };
  }
  if (act === 'budget-set' && rest.length >= 1) {
    let set = null;
    try { set = JSON.parse(rest.join(' ')); } catch { set = null; }
    return set ? { path: '/v1/mod/realm-budget', body: { set } } : { usage: USAGE };
  }
  return { usage: USAGE };
}

/** One POST to the service - `{ ok, status, body }`, never a throw for an answer the service gave. */
async function post(base, path, body, secret = null) {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json', ...(secret ? { authorization: `Bearer ${secret}` } : {}) },
    body: JSON.stringify(body),
  });
  return { ok: res.ok, status: res.status, body: await res.json().catch(() => null) };
}

async function main() {
  const req = reviewRequest(process.argv.slice(2));
  if ('usage' in req) { console.error(req.usage); process.exit(2); }
  const base = process.env.DAGGER_ACCOUNT_SERVICE || DEFAULT_ACCOUNT_SERVICE;
  let secret = process.env.DAGGER_SECRET || null;
  let opened = false;
  if (!secret) {
    const handle = process.env.DAGGER_HANDLE, password = process.env.DAGGER_PASSWORD;
    if (!handle || !password) { console.error('Sign in first: set DAGGER_HANDLE and DAGGER_PASSWORD, or DAGGER_SECRET.'); process.exit(2); }
    const signed = await post(base, '/v1/auth/login', { handle, password, label: 'tools/realmReview.mjs' });
    if (!signed.ok || typeof signed.body?.secret !== 'string') { console.error(`Sign-in refused: ${accountRefusalText(signed.body?.error)}`); process.exit(1); }
    secret = signed.body.secret;
    opened = true;
  }
  try {
    const r = await post(base, req.path, req.body, secret);
    if (!r.ok) { console.error(`Refused (${r.body?.error ?? r.status}): ${accountRefusalText(r.body?.error)}`); process.exitCode = 1; return; }
    console.log(JSON.stringify(r.body, null, 2));
    for (const line of faucetLines(r.body)) console.log(line);   // AUDIT LW-II-2 S6: what the living world minted, said
  } finally {
    if (opened) await post(base, '/v1/auth/logout', {}, secret).catch(() => {});   // the session this call opened, and no other
  }
}

if (isMain(import.meta.url)) main();
