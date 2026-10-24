// INT6 (2026-10-09, the INTEGRITY arc - bible/06-Systems/Integrity-Arc.md): THE REVIEW, BY HAND. The account service's
// routes do the work and hold the law (server-account/src/review.js); this names the act and says the answer.
//
//   node tools/realmReview.mjs holds                         the characters held or flagged, each with its last finding
//   node tools/realmReview.mjs findings <id>                 one character's findings and its wealth by the hour, and the
//                                                            purse its record holds (`character.purse` - PURSE-MEND's `was`)
//   node tools/realmReview.mjs clear <id> [note]             lift its hold (its strikes and timed holds with it) and its flag -
//                                                            an override: AUTO-HOLD (2026-10-16), no hold waits on it to lift
//   node tools/realmReview.mjs hold <id> [note]              hold its trade by hand
//   node tools/realmReview.mjs rollback <id> [note]          back to its last checkpoint judged clean (its tab loses the seat)
//   node tools/realmReview.mjs budget [days]                 the measure: gold an hour of play, by level band, the service's
//                                                            own faucets' gold in the window (a patron's purchases), and the config
//   node tools/realmReview.mjs budget-set <json>             write the budget's config - { enforce, bands: [{ upTo, rate, cap }] }
//   node tools/realmReview.mjs bodies [days]                 INT14: the boss fights' count - mends claimed a minute, and what
//                                                            the line standing would have cost
//   node tools/realmReview.mjs grants [days]                 GRANT2: the spawn grants' asks - per kind, an account's asks an
//                                                            hour, what the buckets and the cell's ceiling would have refused
//   node tools/realmReview.mjs progress [days]               INT17: the progression claims' measure - each stream's claims an
//                                                            hour of play, its quantiles, who went past the line standing
//   node tools/realmReview.mjs progress-set <json>           write the line - { enforce, streams: { <stream>: { rate, cap } } }
//   node tools/realmReview.mjs gains [days]                  HACKED-GOLD: who gained past the bucket, largest first - held or
//                                                            not (while the budget only measures, `holds` lists none of them)
//   node tools/realmReview.mjs trades <id>                   HACKED-GOLD: one character's realm trades - whom it traded with,
//                                                            and the gold, letters and pieces each side gave
//   node tools/realmReview.mjs characters <handle>           SUMMON-REPAIR: an account's realm characters, each its id
//   node tools/realmReview.mjs repair <id> <ticket> <faction> <flag> <gold> [note]
//                                                            SUMMON-REPAIR: one of FactionFile's flag bits (0x40, 64 or
//                                                            Summoned) cleared on the faction of that character's record and
//                                                            the gold given back as a letter of credit - once a ticket, so the
//                                                            same command run again moves nothing; its tab loses the seat and
//                                                            its next join plays the mended record (net/repairLaw.js)
//   node tools/realmReview.mjs mend <id> <ticket> <was> <gold> [note]
//                                                            PURSE-MEND: a purse a wrapped sale left below nothing - `was`,
//                                                            the purse `findings` says, reckoned from - set to nothing and
//                                                            the gold owed given as a letter of credit, once a ticket; the
//                                                            law's hold lifted when the purse was all it held on; its tab
//                                                            loses the seat, as the repair's does (net/repairLaw.js)
//
// THE MEASURE FIRST (Mac, 2026-10-09: "Measure 7 days, then enforce"): read `budget 7` after a week, set each band's
// `rate` past its 0.999 quantile with room, and `budget-set` with `enforce: true`.
// INT17 (the owner, 2026-10-17: "Measure first"): read `progress 7` after a week, set each stream's `rate` past its 0.999
// quantile with room (and its `cap` a few hours' worth), and `progress-set` with `enforce: true` and every stream named.
// GRANT2 (bible/11-Multiplayer/Spawn-Grants.md section 12; the owner: seven days): read `grants 7` after a week, set each
// kind's bucket in net/grantLaw.js GRANT_KINDS past its 0.999 quantile with room and GRANT_CELL_CEILING past the cells'
// most live - GRANT5: each kind's `rate.suggested` and the cells' `suggested` say both, half again past the measure - then
// GRANT6: `/relay grantMode enforce` (Spawn-Grants section 15).
// INT14 (Mac, 2026-10-10: "Measure, then enforce"): read `bodies 7` after a week; the boss fights' line is the RELAY'S - set
// its BOSS_BODY var (server/wrangler.toml, net/bossBody.js bodyConfig) to `{"enforce": true, "body": {"depth", "perS"},
// "hull": {"depth", "perS"}}`, `perS` past the 0.999 quantile's rate (a minute's, in thousandths: / 60000) with room.
//
// Signed in as YOU - a developer, your handle in the service's DEVELOPER_HANDLES: DAGGER_HANDLE and DAGGER_PASSWORD sign
// in for this one call and sign out after it; DAGGER_SECRET, a session secret you already hold, is used as it is and left
// signed in. DAGGER_ACCOUNT_SERVICE points at another service (a local one); the live one by default.
import { DEFAULT_ACCOUNT_SERVICE, accountRefusalText } from '../src/net/accountClient.js';
import { repairOf, repairFlagOf, purseMendOf } from '../src/net/repairLaw.js';   // SUMMON-REPAIR: the service's own law, asked first here; PURSE-MEND: the mend's
import { isHandleShaped } from '../src/net/handleShape.js';
import { isMain } from './lib/isMain.mjs';

export const USAGE = [
  'usage: node tools/realmReview.mjs holds',
  '       node tools/realmReview.mjs findings|clear|hold|rollback <realm character id> [note]',
  '       node tools/realmReview.mjs budget [days]',
  '       node tools/realmReview.mjs budget-set <json>',
  '       node tools/realmReview.mjs bodies [days]',
  '       node tools/realmReview.mjs grants [days]',
  '       node tools/realmReview.mjs progress [days]',
  '       node tools/realmReview.mjs progress-set <json>',
  '       node tools/realmReview.mjs gains [days]',
  '       node tools/realmReview.mjs trades <realm character id>',
  '       node tools/realmReview.mjs characters <handle>',
  '       node tools/realmReview.mjs repair <realm character id> <ticket> <faction id> <flag: 0x40 | 64 | Summoned> <gold> [note]',
  '       node tools/realmReview.mjs mend <realm character id> <ticket> <was: the purse below nothing, -8000000> <gold owed> [note]',
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
const BY_ID = Object.freeze(['findings', 'clear', 'hold', 'rollback', 'trades']);   // HACKED-GOLD: a character's trades

/**
 * The route and body for these arguments - `{ path, body }` - or `{ usage }`.
 * @param {string[]} argv
 * @returns {{ path: string, body: any } | { usage: string }}
 */
export function reviewRequest(argv) {
  const [act, ...rest] = argv;
  if (act === 'holds' && rest.length === 0) return { path: '/v1/mod/realm-holds', body: {} };
  if (act === 'characters' && rest.length === 1 && isHandleShaped(rest[0])) return { path: '/v1/mod/realm-characters', body: { name: rest[0] } };
  if (act === 'repair' && rest.length >= 5 && /^r[0-9a-f]{20}$/.test(rest[0])) {
    // SUMMON-REPAIR: checked by the law the service checks it by, so a typo is refused here and never half-sent
    const [id, ticket, faction, flag, gold] = rest;
    const repair = repairOf({ ticket, faction: /^[0-9]+$/.test(faction) ? Number(faction) : NaN, flag: repairFlagOf(flag), gold: /^[0-9]+$/.test(gold) ? Number(gold) : NaN });
    const note = rest.slice(5).join(' ');
    return repair ? { path: '/v1/mod/realm-repair', body: { id, ...repair, ...(note ? { note } : {}) } } : { usage: USAGE };
  }
  if (act === 'mend' && rest.length >= 4 && /^r[0-9a-f]{20}$/.test(rest[0])) {
    // PURSE-MEND: checked by the law the service checks it by - the purse below nothing it was reckoned from, the gold owed
    const [id, ticket, was, gold] = rest;
    const mend = purseMendOf({ ticket, was: /^-[0-9]+$/.test(was) ? Number(was) : NaN, gold: /^[0-9]+$/.test(gold) ? Number(gold) : NaN });
    const note = rest.slice(4).join(' ');
    return mend ? { path: '/v1/mod/realm-mend', body: { id, ...mend, ...(note ? { note } : {}) } } : { usage: USAGE };
  }
  if (BY_ID.includes(act) && rest.length >= 1 && /^r[0-9a-f]{20}$/.test(rest[0])) {
    const note = rest.slice(1).join(' ');
    return { path: `/v1/mod/realm-${act}`, body: { id: rest[0], ...(note ? { note } : {}) } };
  }
  if (act === 'budget' && rest.length <= 1) {
    const days = rest.length ? Number(rest[0]) : 7;
    return Number.isSafeInteger(days) && days >= 1 && days <= 30 ? { path: '/v1/mod/realm-budget', body: { days } } : { usage: USAGE };
  }
  if ((act === 'bodies' || act === 'gains' || act === 'progress' || act === 'grants') && rest.length <= 1) {   // INT14; HACKED-GOLD: the gains past the bucket; INT17: the claims' measure; GRANT2: the spawn grants'
    const days = rest.length ? Number(rest[0]) : 7;
    return Number.isSafeInteger(days) && days >= 1 && days <= 30 ? { path: `/v1/mod/realm-${act}`, body: { days } } : { usage: USAGE };
  }
  if (act === 'budget-set' && rest.length >= 1) {
    let set = null;
    try { set = JSON.parse(rest.join(' ')); } catch { set = null; }
    return set ? { path: '/v1/mod/realm-budget', body: { set } } : { usage: USAGE };
  }
  if (act === 'progress-set' && rest.length >= 1) {   // INT17: the progression claims' line
    let set = null;
    try { set = JSON.parse(rest.join(' ')); } catch { set = null; }
    return set ? { path: '/v1/mod/realm-progress', body: { set } } : { usage: USAGE };
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
