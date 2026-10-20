#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// PURSE-BACK (2026-10-19; FIELD BUGS 2026-10-18b TRADE-WRAP's repair - the owner: "We need to restore Kurasawa's account
// to before they were in a negative balance", and, asked how it should run, "Build a workflow") - A REALM CHARACTER BACK
// TO ITS LAST SAVE FROM BEFORE ITS PURSE WENT BELOW NOTHING, RUN FROM THE ACTIONS TAB (.github/workflows/realm-rollback.yml).
//
// TRADE-WRAP's counter paid a big lot's sale millions below nothing into the purse, and a purse below nothing is a law
// finding (server-account/src/judge.js purseWord, code 'gold'): the character is held, and no checkpoint after it is
// judged clean. The review's rollback (server-account/src/review.js, INT6) puts a record back to its last clean
// checkpoint - for such a character the last save before the sale, with the pieces it sold, the letters of credit spent
// since and the purse as it stood. That act is a developer's, signed in (tools/realmReview.mjs). This runs THE SAME ACT -
// reviewAct itself: its developer gate, its guards, its statements and its staff finding - over the live database and
// bucket, reached through wrangler with the repository's CLOUDFLARE_API_TOKEN (tools/lib/wranglerBindings.mjs). Nothing of
// its law is copied here.
//
// THE CHECK THE ROUTE CANNOT MAKE (purseReach): the clean save must be older than the purse's first finding. A payment
// the letters could not cover, a fare, a death in the open zone or a house bought through the bank sets such a purse at
// nothing again (systems/court.js deductGold and deductGoldPieces, systems/wild/wildDropLaw.js), the next checkpoint is
// judged clean, and the save from before the sale left the bucket when the clean one moved past it (realm.js keeps the
// record, the one before it and the clean one) - a rollback would land after the sale, undo the play since and give
// nothing back. So the earliest law finding naming 'gold' must stand after the clean save, or the act is never asked.
//
// THE DRY RUN IS THE ACT WITH ITS WRITES HELD: the same reviewAct over bindings that read the live database and bucket
// and hold every write (`dry`) - so every refusal it would make ('not-developer', 'dead', 'no-clean', 'service-moved') is
// its own, said before anything is written. The run's page names the account by the handle typed, its characters by
// their names and realm ids, and never an account's id or a save's key (a public repository's run is public).
//
//   node tools/realmRollback.mjs --handle <account> --by <developer> [--character <realm id>] [--run <run id>] [--apply]
//                                [--summary <file>] [--local]
//
// Run where wrangler finds server-account's wrangler.toml: the database, the bucket and the developers' list are read
// from it, the deployed config's own words. `--by` must be on that list - the review's gate is the act's own. --local
// reads and writes wrangler's local D1 and R2 (a probe's), never the workflow's.
// ═══════════════════════════════════════════════════════════════════

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { reviewAct } from '../server-account/src/review.js';
import { realmSaveTextOf } from '../server-account/src/realm.js';
import { wealthOf } from '../server-account/src/judge.js';
import { REALM_LETTER_TEMPLATE } from '../src/net/realm/realmGoldLaw.js';
import { wranglerD1, wranglerR2, wranglerExec } from './lib/wranglerBindings.mjs';
import { isMain } from './lib/isMain.mjs';

export const USAGE = [
  'usage: node tools/realmRollback.mjs --handle <account> --by <developer> [--character <realm id>] [--run <run id>] [--apply] [--summary <file>] [--local]',
  '  run where wrangler finds server-account/wrangler.toml; a dry run unless --apply',
].join('\n');

/** Each refusal in the run page's words - the act's own and the check's. */
export const REFUSALS = Object.freeze({
  'not-developer': "the run was asked by someone not on the developers' list (server-account/wrangler.toml DEVELOPER_HANDLES)",
  body: 'that is no account name',
  'no-player': 'no account has that name',
  'not-theirs': "the character named is not one of this account's",
  which: "more than one of this account's characters has a purse that went below nothing - name the one to roll back in `character`",
  'no-purse-finding': "no finding says a purse of this account's went below nothing - there is nothing here for this run to undo",
  'no-clean': 'no clean save is kept to go back to',
  'clean-after': 'the last clean save is from AFTER the purse first went below nothing: the purse was set at nothing since and a later save judged clean, so the save from before the sale is gone - a rollback would land after the sale and give nothing back',
  'rolled-back': 'the character was rolled back since its purse went below nothing (a staff rollback stands in its findings) - there is nothing left to undo',
  dead: 'the character is dead - a rollback never raises the dead',
  'service-moved': 'the service moved this record after its clean save (a death in the open zone, a sale from its shop, a repair) - a rollback would bring back what stands elsewhere now',
  'no-realm-character': 'the character is gone',
});

/**
 * What the run reads of server-account's wrangler.toml: the database and the bucket the service binds (DB, SAVES) and
 * the developers' list its review gate reads.
 * @param {string} toml
 */
export function configOf(toml) {
  const sections = toml.split(/\n(?=\[)/);
  const bound = (/** @type {string} */ head, /** @type {string} */ binding) => sections.find((s) => s.startsWith(head) && new RegExp(`^binding\\s*=\\s*"${binding}"`, 'm').test(s)) ?? '';
  const value = (/** @type {string} */ text, /** @type {string} */ key) => new RegExp(`^${key}\\s*=\\s*"([^"]*)"`, 'm').exec(text)?.[1] ?? null;
  return {
    database: value(bound('[[d1_databases]]', 'DB'), 'database_name'),
    bucket: value(bound('[[r2_buckets]]', 'SAVES'), 'bucket_name'),
    developers: value(sections.find((s) => s.startsWith('[vars]')) ?? '', 'DEVELOPER_HANDLES'),
  };
}

/**
 * THE CHECK, from one character's review findings (reviewAct 'findings', the newest hundred): the save its purse first
 * went below nothing (`first`, `at` - the earliest law finding naming 'gold') and its last clean save (`clean`). `ok`
 * only when the clean one is the older; else `why` - 'no-purse-finding', 'no-clean', or 'clean-after' ('rolled-back'
 * when a staff rollback since is why: a run applied twice). `between`: the law findings after the clean save and before
 * the purse's - the saves the law held for something else, undone with it.
 * @param {any} answer
 */
export function purseReach(answer) {
  const findings = (Array.isArray(answer?.findings) ? answer.findings : []).filter((f) => Number.isSafeInteger(f?.seq));
  const law = findings.filter((f) => f.kind === 'law');
  const codes = (/** @type {any} */ f) => (Array.isArray(f.detail?.findings) ? f.detail.findings.map((/** @type {any} */ x) => x?.code) : []);
  const purse = law.filter((f) => codes(f).includes('gold')).reduce((a, f) => (a && a.seq <= f.seq ? a : f), null);
  const clean = Number.isSafeInteger(answer?.character?.clean_seq) ? answer.character.clean_seq : null;
  const first = purse?.seq ?? null;
  const back = findings.some((f) => f.kind === 'staff' && f.detail?.act === 'rollback' && f.seq >= first);
  const why = first == null ? 'no-purse-finding' : clean == null ? 'no-clean' : clean >= first ? (back ? 'rolled-back' : 'clean-after') : null;
  return {
    ok: why == null, why, first, at: purse?.at ?? null, clean,
    between: why ? [] : law.filter((f) => f.seq > clean && f.seq < first).map((f) => ({ seq: f.seq, codes: codes(f) })).sort((a, b) => a.seq - b.seq),
  };
}

/**
 * What a stored save holds that the run's page says - its purse, its letters of credit (how many, and their gold), its
 * banks' gold, the pieces it carries and its wealth as the judge counts it - or null.
 * @param {any} bucket @param {unknown} key
 */
export async function saveSummary(bucket, key) {
  if (typeof key !== 'string' || !key) return null;
  let save = null;
  try { save = JSON.parse((await realmSaveTextOf(await bucket.get(key))) ?? ''); } catch { save = null; }
  if (!save || typeof save !== 'object' || Array.isArray(save)) return null;
  const gold = (/** @type {unknown} */ v) => (Number.isFinite(v) ? /** @type {number} */ (v) : 0);
  const items = Array.isArray(save.items) ? save.items : [];
  const letters = items.filter((/** @type {any} */ it) => it?.templateIndex === REALM_LETTER_TEMPLATE);
  return {
    level: save.level ?? null,
    purse: gold(save.goldPieces),
    letters: letters.length,
    lettersGold: letters.reduce((/** @type {number} */ n, /** @type {any} */ it) => n + gold(it.value), 0),
    banks: (Array.isArray(save.bankAccounts) ? save.bankAccounts : []).reduce((/** @type {number} */ n, /** @type {any} */ a) => n + gold(a?.accountGold), 0),
    pieces: items.length,
    wealth: wealthOf(save),
  };
}

/** The act's note, kept by its staff finding: the cause, the save it undoes from, and the run. */
export const noteFor = (/** @type {{ first: number | null }} */ reach, /** @type {string | null} */ run = null) =>
  `PURSE-BACK (TRADE-WRAP, FIELD BUGS 2026-10-18b): the purse below nothing from save ${reach.first}${run ? ` - realm-rollback.yml run ${run}` : ''}`;

/**
 * THE RUN: the account by its handle and its realm characters (reviewAct 'characters'), each one's reach (purseReach over
 * its 'findings'), the one to roll back - the one named, else the one character whose purse went below nothing - and,
 * when its check holds, the review's own rollback asked of it. `ctx` is the act's own `{ db, bucket, nowS }`, live or dry.
 * Answers the run whole, `refusal` the act's word or the check's (REFUSALS) when it stopped.
 * @param {any} ctx
 * @param {{ handle: string, by: string, character?: string | null, developers: string | null, run?: string | null }} o
 */
export async function rollbackPurse(ctx, { handle, by, character = null, developers, run = null }) {
  const player = { handle: by };
  const env = { DEVELOPER_HANDLES: developers };
  /** @type {any} */
  const result = { handle, by, account: null, characters: [], character: null, now: null, back: null, answer: null, refusal: null };
  const stop = (/** @type {string} */ refusal) => Object.assign(result, { refusal });
  const who = await reviewAct(ctx, player, env, 'characters', { name: handle });
  if (who.error) return stop(who.error);
  result.account = who.player;
  for (const c of who.characters) result.characters.push({ ...c, reach: purseReach(await reviewAct(ctx, player, env, 'findings', { id: c.id })) });
  const below = result.characters.filter((/** @type {any} */ c) => c.reach.first != null);
  const pick = character ? result.characters.find((/** @type {any} */ c) => c.id === character) : below.length === 1 ? below[0] : null;
  if (!pick) return stop(character ? 'not-theirs' : below.length ? 'which' : 'no-purse-finding');
  result.character = pick;
  if (!pick.reach.ok) return stop(pick.reach.why);
  const row = await ctx.db.prepare('SELECT obj, clean_obj FROM realm_characters WHERE id = ?').bind(pick.id).first();
  result.now = await saveSummary(ctx.bucket, row?.obj);
  result.back = await saveSummary(ctx.bucket, row?.clean_obj);
  result.answer = await reviewAct(ctx, player, env, 'rollback', { id: pick.id, note: noteFor(pick.reach, run) });
  return result.answer.error ? stop(result.answer.error) : result;
}

/** An apply's row read back as the rollback leaves it: at the sequence the act answered (or past it, should the character
 *  have joined since) and held by nothing. */
export const readBackOk = (/** @type {any} */ r) => !!r.after && r.after.seq >= r.answer?.seq && r.after.held == null;

const n = (/** @type {number} */ v) => v.toLocaleString('en-US');
const when = (/** @type {number | null} */ s) => (s == null ? '' : ` (${new Date(s * 1000).toISOString().slice(0, 16).replace('T', ' ')} UTC)`);
/** What a held write is, by its first words - a statement's verb and table, an object's delete - never its values. */
const heldKind = (/** @type {string} */ h) => /^(UPDATE \w+|INSERT INTO \w+|DELETE FROM \w+|INSERT OR \w+ INTO \w+|r2 object delete)/.exec(h)?.[1] ?? 'a write';

/**
 * The run in the page's words: the characters and their reach, the one rolled back, what its record holds now and what
 * it holds back, and the outcome - a refusal, a dry run's yes and the writes it held, or the rollback written.
 * @param {any} r rollbackPurse's answer (with `after`, the row read back after an apply)
 * @param {{ apply: boolean, held?: string[] }} o
 */
export function rollbackReport(r, { apply, held = [] }) {
  const out = [`## Realm rollback (a purse below nothing): ${r.handle}`, ''];
  out.push(`Asked by **${r.by}**. ${apply ? 'Apply: on.' : 'A dry run: nothing is written.'}`, '');
  if (r.characters.length) {
    out.push('| Character | Realm id | Purse below nothing from save | Last clean save | Playing | Held | Dead |', '|---|---|---|---|---|---|---|');
    for (const c of r.characters) out.push(`| ${c.name ?? '?'} | ${c.id} | ${c.reach.first ?? '-'}${when(c.reach.at)} | ${c.reach.clean ?? '-'} | ${c.playing ? 'yes' : 'no'} | ${c.held ?? '-'} | ${c.dead ? 'yes' : 'no'} |`);
    out.push('');
  }
  const c = r.character;
  if (c && r.now && r.back) {
    out.push(`**${c.name ?? c.id}** goes back to save ${c.reach.clean}, its last clean one - from before its purse went below nothing at save ${c.reach.first}.`, '');
    out.push('| | Purse | Letters of credit | Banks | Pieces carried | Wealth |', '|---|---|---|---|---|---|');
    for (const [label, s] of [['Now', r.now], ['Back', r.back]]) out.push(`| ${label} | ${n(s.purse)} | ${s.letters} (${n(s.lettersGold)} gold) | ${n(s.banks)} | ${s.pieces} | ${n(s.wealth)} |`);
    out.push('');
    if (c.reach.between.length) out.push(`Also undone, the saves the law held for something else between them: ${c.reach.between.map((/** @type {any} */ b) => `save ${b.seq} (${b.codes.join(', ')})`).join('; ')}.`, '');
  }
  if (r.refusal) {
    out.push(`**Refused - ${r.refusal}.** ${REFUSALS[r.refusal] ?? 'the review answered so'}. Nothing was written.`);
  } else if (!apply) {
    const kinds = new Map();
    for (const h of held) kinds.set(heldKind(h), (kinds.get(heldKind(h)) ?? 0) + 1);
    out.push(`**The review's rollback answers yes.** Run again with apply on to write it - ${[...kinds].map(([k, v]) => `${v} ${k}`).join(', ')}.`);
  } else {
    const a = r.after;
    out.push(`**Rolled back.** ${c.name ?? c.id} is save ${c.reach.clean} again, at sequence ${r.answer.seq} - its hold lifted and its seat taken from any tab, so its next join plays it. What was played after save ${c.reach.clean} is undone.`);
    out.push('', readBackOk(r) ? `Read back: sequence ${a.seq}, held by nothing.` : `**Read back wrong** - sequence ${a?.seq ?? 'none'}, held ${a?.held ?? 'by nothing'}: look at the record (tools/realmReview.mjs findings ${c.id}).`);
  }
  return out.join('\n') + '\n';
}

// ── the command ──
async function main() {
  const arg = (/** @type {string} */ name) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] ?? null : null; };
  const handle = arg('handle'), by = arg('by');
  if (!handle || !by) { console.error(USAGE); process.exit(2); }
  const apply = process.argv.includes('--apply');
  const where = process.argv.includes('--local') ? 'local' : 'remote';
  const summary = arg('summary');
  const config = configOf(readFileSync('wrangler.toml', 'utf8'));
  if (!config.database || !config.bucket) { console.error('the wrangler.toml here binds no DB and no SAVES - run this in server-account'); process.exit(2); }
  const say = (/** @type {string} */ text) => { process.stdout.write(text); if (summary) writeFileSync(summary, text); };
  const exec = wranglerExec();
  /** @type {string[]} */
  const held = [];
  const dir = mkdtempSync(join(tmpdir(), 'realm-rollback-'));
  try {
    const db = wranglerD1({ database: config.database, exec, where, dry: !apply, held });
    const ctx = { db, bucket: wranglerR2({ bucket: config.bucket, exec, dir, where, dry: !apply, held }), nowS: Math.floor(Date.now() / 1000) };
    const result = await rollbackPurse(ctx, { handle, by, character: arg('character') || null, developers: config.developers, run: arg('run') || null });
    if (process.env.GITHUB_ACTIONS && result.account?.id) process.stdout.write(`::add-mask::${result.account.id}\n`);   // never on the page
    if (apply && !result.refusal) result.after = await db.prepare('SELECT seq, held FROM realm_characters WHERE id = ?').bind(result.character.id).first();
    say(rollbackReport(result, { apply, held }));
    process.exitCode = result.refusal || (apply && !readBackOk(result)) ? 1 : 0;
  } catch (e) {
    say(`## Realm rollback (a purse below nothing): ${handle}\n\n**Failed** - ${e instanceof Error ? e.message : String(e)}\n`);
    process.exitCode = 1;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (isMain(import.meta.url)) main();
