// PURSE-BACK (2026-10-19; FIELD BUGS 2026-10-18b TRADE-WRAP's repair, bible/01-Overview/bugs/Field-Bugs-2026-10-18b.md) -
// THE ROLLBACK FROM ACTIONS, driven over the real account service: every migration, the real checkpoint and its judge,
// and the review's own act (server-account/src/review.js reviewAct) run through tools/lib/wranglerBindings.mjs, whose
// wrangler is answered here by the service's own database and bucket - so every statement the act binds is written as a
// literal and run against the real schema, as the workflow's wrangler runs it. What it holds:
//   - a purse a counter's sale wrapped below nothing: the dry run is the act whole with nothing written, the apply is the
//     record back to its last clean save - the pieces sold, the letters, the purse - its hold lifted, its seat taken,
//     the staff finding naming who and the run, and the save rolled away dropped;
//   - THE CHECK: a purse set at nothing after the wrap makes a later save clean - the run refuses, writing nothing;
//   - the act's own refusals said before anything is written (service-moved, not-developer), the pick (the one
//     character, `which`, `not-theirs`, none), and a guarded write that moved nothing (`changes()` read, not assumed);
//   - the bindings' literals and their R2 word for a missing key; the toml's names; the workflow by hand, dry by default.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { standService, T0 } from '../accountDb.mjs';
import { seatRealm, recordOf } from '../realmSeat.mjs';
import { prepareRealmRecord } from '../../server-account/src/realm.js';
import { creditSave } from '../../src/net/realm/realmGoldLaw.js';
import { createWeapon } from '../../src/combat/enemyEquipment.js';
import { letterOfCredit } from '../../src/systems/inventory.js';
import { seededRng } from '../../src/systems/wind/wind.js';
import { literalSql, wranglerD1, wranglerR2, wranglerExec, CHANGES_SQL } from '../../tools/lib/wranglerBindings.mjs';
import { rollbackPurse, purseReach, configOf, rollbackReport, noteFor, readBackOk, REFUSALS } from '../../tools/realmRollback.mjs';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
let _now = T0;
const realNow = Date.now;
Date.now = () => _now * 1000;
test.after(() => { Date.now = realNow; });

/** The service's own names, read as the tool reads them. */
const CONFIG = configOf(src('server-account/wrangler.toml'));
/** A Daedric claymore, as the counter's sale took them (TRADE-WRAP: 150 of them sold for -7,489,216). */
const claymore = (seed) => createWeapon(122, 9, seededRng(seed));
const WRAPPED = -7_489_216;
const PURSE = 25_000;

/**
 * wrangler as the bindings call it, answered by the stood service's database and bucket: a command's statements run one
 * at a time on the database (the bindings' `SELECT changes()` on the write's own connection), a get writes the object's
 * bytes to its file - R2's word for a key that holds nothing as wrangler says it - a delete takes the object. `before`
 * sees each statement first (a race laid between the act's read and its write).
 */
function fakeWrangler(env, { before = () => {} } = {}) {
  const raw = env.DB._raw, objects = env.SAVES._map;
  const calls = [];
  const exec = (args) => {
    calls.push(args);
    if (args[0] === 'd1') {
      assert.deepEqual(args.slice(0, 7), ['d1', 'execute', CONFIG.database, '--remote', '--json', '--yes', '--command'], 'the command line the workflow\'s wrangler runs');
      const sql = args[7];
      before(sql);
      const parts = sql.endsWith(`; ${CHANGES_SQL}`) ? [sql.slice(0, -(CHANGES_SQL.length + 2)), CHANGES_SQL] : [sql];
      return JSON.stringify(parts.map((p) => {
        const st = raw.prepare(p);
        return { results: /^\s*SELECT\b/i.test(p) ? st.all() : (st.run(), []), success: true, meta: { duration: 0 } };
      }));
    }
    const [, , verb, path] = args;
    assert.deepEqual([args[0], args[1], path.split('/')[0], args[4]], ['r2', 'object', CONFIG.bucket, '--remote']);
    const key = path.slice(path.indexOf('/') + 1);
    if (verb === 'get') {
      const file = args[args.indexOf('--file') + 1];
      if (!objects.has(key)) {
        writeFileSync(file, '');
        const stderr = '✘ [ERROR] The specified key does not exist.';
        throw Object.assign(new Error(`wrangler r2 object get failed (exit 1): ${stderr}`), { stderr });
      }
      writeFileSync(file, objects.get(key));
      return 'Download complete.';
    }
    assert.equal(verb, 'delete');
    objects.delete(key);
    return 'Delete complete.';
  };
  return { exec, calls };
}

/** The act's own context over the bindings - dry or live - with what a dry one held. */
function over(env, dir, { dry, before } = {}) {
  const { exec, calls } = fakeWrangler(env, { before });
  const held = [];
  return {
    held, calls,
    ctx: {
      db: wranglerD1({ database: CONFIG.database, exec, dry, held }),
      bucket: wranglerR2({ bucket: CONFIG.bucket, exec, dir, dry, held }),
      nowS: _now,
    },
  };
}

/**
 * Kurasawa's account: a realm character whose clean save carries three Daedric claymores, two letters of credit and a
 * purse of 25,000; then the counter's wrapped sale - the claymores gone, the purse millions below nothing - and a
 * payment the letters covered, the purse still below nothing. `after` lays more checkpoints past the wrap.
 */
async function wrapped({ developers = 'mac', after = [] } = {}) {
  const s = await standService({ DEVELOPER_HANDLES: developers });
  const raw = s.env.DB._raw;
  const kura = await s.seated('Kurasawa');
  const put = async (save) => {
    _now += 300;
    const at = kura.at();
    const res = await s.fetch(`https://accounts.invalid/v1/realm/${kura.character}/data`, {
      method: 'PUT', headers: { authorization: `Bearer ${kura.secret}`, 'x-realm-lease': at.lease, 'x-realm-seq': String(at.seq + 1) }, body: JSON.stringify(save),
    });
    assert.equal(res.status, 200, await res.text());
    return at.seq + 1;
  };
  const letters = [letterOfCredit(650_000), letterOfCredit(700_000)];
  const clean = { name: 'Kurasawa', level: 5, goldPieces: PURSE, items: [claymore(1), claymore(2), claymore(3), ...letters] };
  const cleanSeq = await put(clean);
  const wrapSeq = await put({ ...clean, goldPieces: PURSE + WRAPPED, items: letters });
  await put({ ...clean, goldPieces: PURSE + WRAPPED, items: [] });
  for (const save of after) await put(save);
  const row = () => raw.prepare('SELECT seq, obj, prev, clean_obj, clean_seq, svc_seq, held, lease FROM realm_characters WHERE id = ?').get(kura.character);
  const findings = () => raw.prepare('SELECT seq, kind, detail FROM realm_findings WHERE char_id = ? ORDER BY id').all(kura.character);
  const objects = () => [...s.env.SAVES._map.keys()].sort();
  return { s, raw, kura, clean, cleanSeq, wrapSeq, put, row, findings, objects };
}

const tmp = () => mkdtempSync(join(tmpdir(), 'purse-back-'));

test('PURSE-BACK: a purse the counter wrapped below nothing - the dry run is the review\'s act whole and writes nothing; the apply is the record back to its last clean save (the claymores, the letters, the purse), its hold lifted, its seat taken, the staff finding naming who and the run, the save rolled away dropped (mutants: the writes run dry; the check gone)', async () => {
  const k = await wrapped();
  const dir = tmp();
  try {
    assert.equal(k.row().held, 'law', 'a purse below nothing holds the character (judge.js purseWord)');
    assert.equal(k.row().clean_seq, k.cleanSeq, 'and no save after it is judged clean');
    const before = { row: k.row(), findings: k.findings(), objects: k.objects() };
    // THE DRY RUN: the act whole, its every write held
    const dry = over(k.s.env, dir, { dry: true });
    const seen = await rollbackPurse(dry.ctx, { handle: 'Kurasawa', by: 'mac', developers: 'mac', run: '77' });
    assert.equal(seen.refusal, null, REFUSALS[seen.refusal]);
    assert.deepEqual(seen.answer, { ok: true, seq: before.row.seq + 1 }, 'the review\'s rollback answers yes');
    assert.deepEqual([seen.character.id, seen.character.reach.first, seen.character.reach.clean], [k.kura.character, k.wrapSeq, k.cleanSeq]);
    assert.deepEqual({ row: k.row(), findings: k.findings(), objects: k.objects() }, before, 'a dry run wrote nothing - not the row, not a finding, not an object');
    assert.deepEqual(dry.held.map((h) => /^(UPDATE \w+|INSERT INTO \w+|r2 object delete)/.exec(h)?.[1]), ['UPDATE realm_characters', 'INSERT INTO realm_findings', 'r2 object delete'], 'what an apply writes');
    assert.deepEqual([seen.now.purse, seen.now.letters, seen.back.purse, seen.back.letters, seen.back.lettersGold, seen.back.pieces], [PURSE + WRAPPED, 0, PURSE, 2, 1_350_000, 5]);
    const page = rollbackReport(seen, { apply: false, held: dry.held });
    assert.match(page, /The review's rollback answers yes\.\*\* Run again with apply on to write it - 1 UPDATE realm_characters, 1 INSERT INTO realm_findings, 1 r2 object delete\./);
    assert.match(page, /\| Now \| -7,464,216 \| 0 \(0 gold\) \|/);
    assert.match(page, /\| Back \| 25,000 \| 2 \(1,350,000 gold\) \|/);
    assert.ok(!page.includes(k.kura.id), 'the page never names the account\'s id');
    assert.ok(!dry.held.some((h) => h.startsWith('r2') && page.includes(h.split('/').slice(1).join('/'))), 'nor a save\'s key');
    // THE APPLY
    const live = over(k.s.env, dir, { dry: false });
    const done = await rollbackPurse(live.ctx, { handle: 'Kurasawa', by: 'mac', developers: 'mac', run: '78' });
    assert.equal(done.refusal, null, REFUSALS[done.refusal]);
    assert.deepEqual(recordOf(k.s.env, k.kura.character), k.clean, 'the record is the clean save: three claymores, both letters, the purse of 25,000');
    const row = k.row();
    assert.deepEqual([row.seq, row.obj, row.held, row.lease, row.clean_seq], [before.row.seq + 1, before.row.clean_obj, null, null, before.row.seq + 1], 'one sequence on, the hold lifted, the seat taken from any tab');
    const staff = k.findings().filter((f) => f.kind === 'staff').map((f) => JSON.parse(f.detail));
    assert.deepEqual(staff, [{ act: 'rollback', by: 'mac', note: noteFor({ first: k.wrapSeq }, '78'), from: before.row.seq, to: k.cleanSeq }], 'the staff finding: who, the cause, the run');
    assert.ok(!k.s.env.SAVES._map.has(before.row.prev), 'the save before the one rolled away is dropped');
    assert.ok(k.s.env.SAVES._map.has(before.row.clean_obj), 'and the clean one is the record');
    done.after = await live.ctx.db.prepare('SELECT seq, held FROM realm_characters WHERE id = ?').bind(k.kura.character).first();
    assert.ok(readBackOk(done));
    assert.match(rollbackReport(done, { apply: true }), /\*\*Rolled back\.\*\* Kurasawa is save \d+ again, at sequence \d+[^\n]*\n\nRead back: sequence \d+, held by nothing\./);
    // run again, it refuses: the clean save now is the record itself, after the purse's finding - and the staff rollback
    // says why
    const again = await rollbackPurse(over(k.s.env, dir, { dry: false }).ctx, { handle: 'Kurasawa', by: 'mac', developers: 'mac' });
    assert.equal(again.refusal, 'rolled-back', 'a second run rolls nothing back');
    assert.equal(k.findings().filter((f) => f.kind === 'staff').length, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('PURSE-BACK THE CHECK: a purse set at nothing after the wrap makes a later save clean - the save from before the sale is gone, and the run refuses with nothing written, dry or applied (mutant: the check gone - the rollback lands after the sale)', async () => {
  const k = await wrapped({ after: [{ name: 'Kurasawa', level: 5, goldPieces: 0, items: [] }] });
  const dir = tmp();
  try {
    assert.equal(k.row().held, null, 'a purse at nothing is clean again');
    assert.ok(k.row().clean_seq > k.wrapSeq, 'and the clean save is from after the wrap');
    const before = { row: k.row(), findings: k.findings(), objects: k.objects() };
    for (const dry of [true, false]) {
      const r = await rollbackPurse(over(k.s.env, dir, { dry }).ctx, { handle: 'Kurasawa', by: 'mac', developers: 'mac' });
      assert.equal(r.refusal, 'clean-after');
      assert.equal(r.answer, null, 'the act is never asked');
      assert.match(rollbackReport(r, { apply: !dry }), /\*\*Refused - clean-after\.\*\* the last clean save is from AFTER the purse first went below nothing/);
    }
    assert.deepEqual({ row: k.row(), findings: k.findings(), objects: k.objects() }, before, 'nothing written');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('PURSE-BACK: the act\'s own refusals, said by the dry run before anything is written - a service move after the clean save, a run by someone off the developers\' list - and a guarded write that moved nothing answered as the act answers it, read from SQLite\'s own count (mutant: the count assumed)', async () => {
  const dir = tmp();
  try {
    // the service moved the held record after its clean save: the act's own 'service-moved', in the dry run already
    const k = await wrapped();
    const credit = await prepareRealmRecord({ db: k.s.env.DB, bucket: k.s.env.SAVES, rand: (b) => globalThis.crypto.getRandomValues(b), nowS: _now }, k.kura.id, k.kura.at(), (save) => (creditSave(save, 5) ? null : 'bad'));
    await k.s.env.DB.batch(credit.steps);
    const moved = { row: k.row(), findings: k.findings(), objects: k.objects() };
    const sm = await rollbackPurse(over(k.s.env, dir, { dry: true }).ctx, { handle: 'Kurasawa', by: 'mac', developers: 'mac' });
    assert.equal(sm.refusal, 'service-moved');
    assert.deepEqual({ row: k.row(), findings: k.findings(), objects: k.objects() }, moved);
    // off the developers' list: the review's own gate, before any read of the account
    const k2 = await wrapped({ developers: 'mac' });
    const gate = over(k2.s.env, dir, { dry: false });
    const off = await rollbackPurse(gate.ctx, { handle: 'Kurasawa', by: 'rando', developers: 'mac' });
    assert.equal(off.refusal, 'not-developer');
    assert.deepEqual(gate.calls, [], 'nothing asked of the database or the bucket');
    // a checkpoint landing between the act's read and its write: the guarded UPDATE moves nothing, the act says no-clean
    // and writes no finding - SQLite's count, read in the write's own command
    const k3 = await wrapped();
    const race = over(k3.s.env, dir, {
      dry: false,
      before: (sql) => { if (/^UPDATE realm_characters SET seq = seq \+ 1, obj = clean_obj/.test(sql)) k3.raw.prepare('UPDATE realm_characters SET seq = seq + 1 WHERE id = ?').run(k3.kura.character); },
    });
    const raced = await rollbackPurse(race.ctx, { handle: 'Kurasawa', by: 'mac', developers: 'mac' });
    assert.equal(raced.refusal, 'no-clean');
    assert.deepEqual(k3.findings().filter((f) => f.kind === 'staff'), [], 'no staff finding for a rollback that did not land');
    assert.notEqual(k3.row().obj, k3.row().clean_obj, 'the record is not the clean save');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('PURSE-BACK the pick: the one character whose purse went below nothing; two, and the run asks which (`which`) and takes the one named; one of another account\'s never (`not-theirs`); none (`no-purse-finding`) (mutants: any one of several taken; another account\'s taken)', async () => {
  const dir = tmp();
  try {
    const k = await wrapped();
    // a second character of the account, its purse wrapped too
    const second = await seatRealm(k.s.env, k.kura.secret, 'Kura Two');
    const put = async (save) => {
      _now += 300;
      const at = second.at();
      const res = await k.s.fetch(`https://accounts.invalid/v1/realm/${second.id}/data`, {
        method: 'PUT', headers: { authorization: `Bearer ${k.kura.secret}`, 'x-realm-lease': at.lease, 'x-realm-seq': String(at.seq + 1) }, body: JSON.stringify(save),
      });
      assert.equal(res.status, 200, await res.text());
    };
    await put({ name: 'Kura Two', level: 5, goldPieces: 10, items: [claymore(4)] });
    await put({ name: 'Kura Two', level: 5, goldPieces: WRAPPED, items: [] });
    const which = await rollbackPurse(over(k.s.env, dir, { dry: true }).ctx, { handle: 'Kurasawa', by: 'mac', developers: 'mac' });
    assert.equal(which.refusal, 'which');
    assert.deepEqual(which.characters.map((c) => [c.name, c.reach.ok]), [['Kurasawa', true], ['Kura Two', true]]);
    assert.match(rollbackReport(which, { apply: false }), new RegExp(`\\| Kura Two \\| ${second.id} \\|`), 'the page lists each with the id to name');
    const named = await rollbackPurse(over(k.s.env, dir, { dry: true }).ctx, { handle: 'Kurasawa', by: 'mac', developers: 'mac', character: second.id });
    assert.deepEqual([named.refusal, named.character.id], [null, second.id]);
    // another account's character, named: never
    const other = await wrapped();
    const theirs = await rollbackPurse(over(k.s.env, dir, { dry: true }).ctx, { handle: 'Kurasawa', by: 'mac', developers: 'mac', character: other.kura.character });
    assert.equal(theirs.refusal, 'not-theirs');
    // an account whose purses never went below nothing
    const clean = await k.s.seated('Clean');
    assert.ok(clean.character);
    const none = await rollbackPurse(over(k.s.env, dir, { dry: true }).ctx, { handle: 'Clean', by: 'mac', developers: 'mac' });
    assert.equal(none.refusal, 'no-purse-finding');
    const nobody = await rollbackPurse(over(k.s.env, dir, { dry: true }).ctx, { handle: 'Nobody', by: 'mac', developers: 'mac' });
    assert.equal(nobody.refusal, 'no-player');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('PURSE-BACK purseReach: the earliest law finding naming gold against the clean save - the older clean one alone passes, an equal or later one is clean-after, no clean save no-clean; the law\'s other holds between them named (mutants: an equal clean save passed; the latest gold finding read)', () => {
  const law = (seq, ...codes) => ({ seq, at: T0 + seq, kind: 'law', detail: { count: codes.length, findings: codes.map((code) => ({ code })) } });
  const answer = (clean, findings) => ({ character: { clean_seq: clean }, findings });
  const reach = purseReach(answer(40, [law(57, 'gold'), law(44, 'gold', 'uid'), law(42, 'shape'), { seq: 50, kind: 'staff', detail: {} }]));
  assert.deepEqual(reach, { ok: true, why: null, first: 44, at: T0 + 44, clean: 40, between: [{ seq: 42, codes: ['shape'] }] });
  assert.equal(purseReach(answer(44, [law(44, 'gold')])).why, 'clean-after', 'a clean save at the finding\'s own sequence passes never');
  assert.equal(purseReach(answer(45, [law(44, 'gold')])).why, 'clean-after');
  const staff = (seq) => ({ seq, at: T0 + seq, kind: 'staff', law: 0, detail: { act: 'rollback', by: 'mac' } });
  assert.equal(purseReach(answer(48, [staff(47), law(44, 'gold')])).why, 'rolled-back', 'a rollback since says so');
  assert.equal(purseReach(answer(48, [staff(40), law(44, 'gold')])).why, 'clean-after', 'one from before the purse\'s finding is no reason');
  assert.equal(purseReach(answer(null, [law(44, 'gold')])).why, 'no-clean');
  assert.equal(purseReach(answer(40, [law(44, 'shape')])).why, 'no-purse-finding');
  assert.equal(purseReach({ error: 'no-realm-character' }).why, 'no-purse-finding');
});

test('PURSE-BACK the bindings: a statement\'s binds written as literals outside quotes alone (?, ?N, a quote doubled, every bind used and nothing past them); a write\'s rows counted in its own command; a dry binding holds every write and runs none; R2\'s missing key is null and any other failure throws (mutants: a quoted ? bound; a dry write run; a missing key thrown)', async () => {
  assert.equal(literalSql("SELECT * FROM t WHERE a = ? AND b = 'it''s ?' AND c = ?", ['x', 7]), "SELECT * FROM t WHERE a = 'x' AND b = 'it''s ?' AND c = 7");
  assert.equal(literalSql('UPDATE t SET a = ?1, b = ?2 WHERE c = ?1 AND d = ?', ["o'k", null, 3]), "UPDATE t SET a = 'o''k', b = NULL WHERE c = 'o''k' AND d = 3");
  assert.throws(() => literalSql('SELECT ?', []), /binds nothing/);
  assert.throws(() => literalSql('SELECT ?', [1, 2]), /2 bound, 1 asked/);
  assert.throws(() => literalSql("SELECT 'open", []), /never closed/);
  assert.throws(() => literalSql('SELECT ?', [1.5]), /no statement here writes/);
  const asked = [];
  const exec = (args) => {
    asked.push(args[7]);
    return JSON.stringify(args[7].endsWith(CHANGES_SQL) ? [{ results: [], success: true }, { results: [{ changes: 0 }], success: true }] : [{ results: [{ a: 1 }], success: true }]);
  };
  const live = wranglerD1({ database: 'db', exec });
  assert.deepEqual(await live.prepare('UPDATE t SET a = ? WHERE b = ?').bind(1, 'x').run(), { meta: { changes: 0 } });
  assert.equal(asked.at(-1), `UPDATE t SET a = 1 WHERE b = 'x'; ${CHANGES_SQL}`);
  assert.deepEqual(await live.prepare('SELECT a FROM t').first(), { a: 1 });
  assert.equal(await live.prepare('SELECT a FROM t').first('a'), 1);
  await assert.rejects(live.batch([]), /no batch/);
  const held = [];
  const dry = wranglerD1({ database: 'db', exec, dry: true, held });
  const n = asked.length;
  assert.deepEqual(await dry.prepare("INSERT INTO t (a) VALUES (?)").bind('y').run(), { meta: { changes: 1 } });
  await assert.rejects(dry.prepare('DELETE FROM t RETURNING a').first(), /dry binding cannot answer/);
  assert.equal(asked.length, n, 'a dry binding ran no write');
  assert.deepEqual(held, ["INSERT INTO t (a) VALUES ('y')"]);
  assert.deepEqual(await dry.prepare('SELECT a FROM t').first(), { a: 1 }, 'and reads');
  const dir = tmp();
  try {
    const missing = wranglerR2({ bucket: 'b', dir, exec: () => { throw Object.assign(new Error('x'), { stderr: '✘ [ERROR] The specified key does not exist.' }); } });
    assert.equal(await missing.get('k'), null);
    const broken = wranglerR2({ bucket: 'b', dir, exec: () => { throw Object.assign(new Error('wrangler r2 object get failed (exit 1): Authentication error'), { stderr: '✘ [ERROR] Authentication error [code: 10000]' }); } });
    await assert.rejects(broken.get('k'), /Authentication error/);
    const deletes = [];
    await wranglerR2({ bucket: 'b', dir, dry: true, held: deletes, exec: () => { throw new Error('a dry delete ran'); } }).delete('p/r/1');
    assert.deepEqual(deletes, ['r2 object delete b/p/r/1']);
    // wrangler's failure says wrangler's words and its exit, never its command - a statement can name an account's id
    const script = join(dir, 'wrangler.mjs');
    writeFileSync(script, 'process.stderr.write("Resource location: remote\\n\\u2718 [ERROR] no such table: x: SQLITE_ERROR\\n"); process.exit(3);\n');
    const failing = wranglerExec({ command: `${process.execPath} ${script}` });
    assert.throws(() => failing(['d1', 'execute', 'db', '--remote', '--json', '--yes', '--command', "SELECT * FROM x WHERE player = 'p-secret-id'"]), (e) => {
      assert.equal(e.message, 'wrangler d1 execute db failed (exit 3): ✘ [ERROR] no such table: x: SQLITE_ERROR');
      assert.ok(!e.message.includes('p-secret-id'));
      return true;
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('PURSE-BACK the config and the workflow: the database, the bucket and the developers\' list read off the service\'s own wrangler.toml; the workflow by hand, a dry run by default, its inputs as environment, its actor the act\'s, in the deploy\'s queue, the page written whatever the act answers (mutants: apply by default; an input spliced; the actor typed)', () => {
  assert.deepEqual(CONFIG, { database: 'daggerfall-accounts', bucket: 'daggerfall-saves', developers: /^DEVELOPER_HANDLES = "([^"]*)"$/m.exec(src('server-account/wrangler.toml'))[1] });
  const wf = src('.github/workflows/realm-rollback.yml');
  assert.match(wf, /on:\n  workflow_dispatch:/);
  assert.match(wf, /      apply:\n        description: [^\n]*\n        required: true\n        default: false/);
  assert.doesNotMatch(wf, /run: [^\n]*\$\{\{ inputs\./, 'an input spliced into a run line');
  for (const step of wf.split('\n      - ').filter((s) => /\n {8}run: \|/.test(s))) assert.doesNotMatch(step, /\$\{\{/, 'nothing spliced into a script');
  assert.match(wf, /HANDLE: \$\{\{ inputs\.handle \}\}\n {6}CHARACTER: \$\{\{ inputs\.character \}\}\n {6}APPLY: \$\{\{ inputs\.apply \}\}/);
  assert.match(wf, /if \[ "\$APPLY" = "true" \]; then flags="--apply"; fi/);
  assert.match(wf, /node \.\.\/tools\/realmRollback\.mjs --handle "\$HANDLE" --character "\$CHARACTER" --by "\$GITHUB_ACTOR" --run "\$GITHUB_RUN_ID" --summary "\$RUNNER_TEMP\/summary\.md" \$flags \|\| status=\$\?/);
  assert.match(wf, /if \[ -s "\$RUNNER_TEMP\/summary\.md" \]; then cat "\$RUNNER_TEMP\/summary\.md" >> "\$GITHUB_STEP_SUMMARY"; fi\n {10}exit \$status/);
  assert.match(wf, /- name: Roll the character back\n {8}working-directory: server-account/);
  assert.match(wf, /group: account-deploy\n {2}cancel-in-progress: false/);
  assert.match(wf, /permissions:\n {2}contents: read/);
});
