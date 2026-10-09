// SERVER-POST (2026-10-08, Mac: "... First use is to utilize it for players being granted items.") and HOURS-FIRST
// ("... and each the gilded gun"): THE POST, SENT BY THE OPERATOR - tools/sendServerPost.mjs writes the statements,
// .github/workflows/server-post.yml runs them by hand (a dry run, then the send), and the post's first send, the
// Hourlock to the thirteen of the first clear, is migration 0094 - this file's statement, held to the tool's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, chmodSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { d1, standService } from './accountDb.mjs';
import {
  postHandles, postBatch, postWords, postItem, sqlText, lookSql, sendSql, hoursFirstSql, hoursFirstHandles, HOURS_FIRST, POST_ITEMS,
  POST_RECIPIENTS_MAX,
} from '../tools/sendServerPost.mjs';
import { postBoxOf } from '../server-account/src/post.js';
import { POST_SENDER, POST_BODY_MAX, POST_SUBJECT_MAX } from '../src/net/postLaw.js';
import { mintHourlock } from '../src/systems/gilded.js';

const ROOT = new URL('../', import.meta.url);
const src = (p) => readFileSync(new URL(p, ROOT), 'utf8');
const TOOL = fileURLToPath(new URL('tools/sendServerPost.mjs', ROOT));
const rows = (db, sql) => db._raw.prepare(sql).all().map((r) => ({ ...r }));
const player = (db, id, handle) => db._raw.prepare('INSERT INTO players (id, handle, handle_lc, guest_name, created_at, last_seen, registered_at) VALUES (?, ?, ?, ?, 1, 1, ?)')
  .run(id, handle, handle?.toLowerCase() ?? null, `Guest ${id}`, handle ? 1 : null);

test('SERVER-POST the tool: names a handle\'s shape, none twice, folded; a send\'s name its shape; the words within the post\'s bounds, \\n a line, no control character; an item only by name, minted by the game; every word a string with its quotes doubled; the command line prints the statement or nothing (mutants: a name unchecked; the bounds dropped; an item typed in)', () => {
  assert.deepEqual(postHandles(' Duck, duck ,ArtemisGodfrey '), ['duck', 'artemisgodfrey'], 'folded, and once');
  for (const bad of ['', ' , ', 'ab', 'Duck, 9lives', "x'; DROP TABLE players; --", 'a b']) assert.throws(() => postHandles(bad), /not a/, JSON.stringify(bad));
  assert.throws(() => postHandles(Array.from({ length: POST_RECIPIENTS_MAX + 1 }, (_, i) => `Player${i}`).join(',')), /not a list of names/);
  assert.equal(postBatch(' hours-first-hourlock '), 'hours-first-hourlock');
  for (const bad of ['', 'ab', 'Hours First', 'x\'y', '-lead', 'a'.repeat(49)]) assert.throws(() => postBatch(bad), /not a send's name/, JSON.stringify(bad));
  assert.deepEqual(postWords({ subject: ' Hello ', body: 'one\\ntwo' }), { subject: 'Hello', body: 'one\ntwo' });
  assert.throws(() => postWords({ subject: '', body: 'x' }), /not a subject/);
  assert.throws(() => postWords({ subject: 'x'.repeat(POST_SUBJECT_MAX + 1), body: 'x' }), /not a subject/);
  assert.throws(() => postWords({ subject: 'x', body: 'x'.repeat(POST_BODY_MAX + 1) }), /not a message/);
  assert.throws(() => postWords({ subject: 'x', body: 'bell\u0007' }), /control character/);
  assert.deepEqual(Object.keys(POST_ITEMS), ['none', 'hourlock']);
  assert.equal(postItem('none'), null);
  assert.deepEqual(JSON.parse(postItem('hourlock')), mintHourlock(), 'the Hourlock as its drop mints it');
  assert.throws(() => postItem('{"templateIndex":560}'), /not an item/);
  assert.equal(sqlText("Hour's First"), "'Hour''s First'");

  assert.equal(execFileSync(process.execPath, [TOOL, '--names', 'Duck,Terra'], { encoding: 'utf8' }), 'duck\nterra\n');
  assert.equal(execFileSync(process.execPath, [TOOL, '--look', 'Duck', 'b-one'], { encoding: 'utf8' }), `${lookSql('Duck', 'b-one')}\n`);
  assert.equal(execFileSync(process.execPath, [TOOL, '--sql', 'Duck', 'b-one', 'hourlock', 'Hi', 'A gift'], { encoding: 'utf8' }), `${sendSql({ handles: 'Duck', batch: 'b-one', item: 'hourlock', subject: 'Hi', body: 'A gift' })}\n`);
  assert.equal(execFileSync(process.execPath, [TOOL, '--migration', 'hours-first'], { encoding: 'utf8' }), `${hoursFirstSql()}\n`);
  for (const args of [['--sql', 'Duck', 'b-one', 'sword', 'Hi', 'x'], ['--sql', "x'; --", 'b-one', 'none', 'Hi', 'x'], ['--look', 'Duck'], ['--migration', 'nobody'], []]) {
    const r = spawnSync(process.execPath, [TOOL, ...args], { encoding: 'utf8' });
    assert.equal(r.status, 1, args.join(' '));
    assert.equal(r.stdout, '', 'nothing for the workflow to run');
  }
});

test('SERVER-POST the send, over the real schema: one piece to each registered account the names find - never a guest, never another; the words and the item as the tool made them; RETURNING names what it wrote; the same send again writes nothing, another send is another piece; the dry run reads who holds it; a quote in the words is words (mutants: the send not once a name; a guest sent post; the item\'s record changed)', () => {
  const db = d1();
  player(db, 'p-duck', 'Duck'); player(db, 'p-terra', 'Terra'); player(db, 'p-other', 'Other'); player(db, 'p-guest', null);
  const o = { handles: 'duck, TERRA, Nobody', batch: 'gift-one', item: 'hourlock', subject: "Hour's First", body: "It's yours.\\nClaim it." };
  const wrote = rows(db, sendSql(o));
  assert.deepEqual(wrote.map((r) => r.to_id).sort(), ['p-duck', 'p-terra'], 'the names found, no other');
  const kept = rows(db, 'SELECT * FROM server_post ORDER BY to_id');
  assert.equal(kept.length, 2);
  for (const k of kept) {
    assert.match(k.id, /^[0-9a-f]{24}$/);
    assert.deepEqual([k.batch, k.sender, k.subject, k.body, k.read_at, k.claimed_at], ['gift-one', POST_SENDER, "Hour's First", "It's yours.\nClaim it.", null, null]);
    assert.deepEqual(JSON.parse(k.item), mintHourlock());
    assert.ok(Math.abs(k.sent_at - Date.now() / 1000) < 60, 'the database\'s own clock');
  }
  assert.notEqual(kept[0].id, kept[1].id);
  assert.deepEqual(rows(db, sendSql(o)), [], 'the same send twice sends once');
  assert.equal(rows(db, sendSql({ ...o, batch: 'gift-two', item: 'none' })).length, 2, 'another send is another piece');
  assert.equal(rows(db, "SELECT item FROM server_post WHERE batch = 'gift-two'")[0].item, null, 'a message alone');
  assert.deepEqual(rows(db, lookSql('Duck,Terra,Other,Nobody', 'gift-one')), [
    { handle: 'Duck', handle_lc: 'duck', sent: 1 }, { handle: 'Other', handle_lc: 'other', sent: 0 }, { handle: 'Terra', handle_lc: 'terra', sent: 1 },
  ], 'the dry run: who it finds, and who holds it');
  assert.equal(rows(db, "SELECT COUNT(*) AS n FROM server_post WHERE to_id = 'p-guest'")[0].n, 0, 'never a guest');
});

test('HOURS-FIRST THE FIRST SEND, migration 0094: the tool\'s own statement to the config\'s thirteen, holding the Hourlock; applied over the live accounts it sends each of the thirteen one piece and no one else, the box shows the gift by name, and applied again it sends nothing (mutants: a name missing from the send; the gun swapped; the send not once)', async () => {
  const mig = src('server-account/migrations/0094_hours_first_post.sql');
  const statement = mig.split('\n').filter((l) => !l.startsWith('--')).join('\n').trim();
  assert.equal(statement, hoursFirstSql(), 'the tool\'s statement, as it prints it');
  assert.equal(hoursFirstHandles().split(',').length, 13);
  assert.deepEqual(postHandles(hoursFirstHandles()), hoursFirstHandles().split(',').map((h) => h.toLowerCase()), 'the config\'s list, each a handle');
  assert.equal(HOURS_FIRST.item, 'hourlock');
  assert.equal(HOURS_FIRST.subject, "Hour's First");
  assert.ok(HOURS_FIRST.body.length <= POST_BODY_MAX);
  assert.match(src('server-account/migrations/0093_server_post.sql'), /CREATE TABLE IF NOT EXISTS server_post/, '0093 lays the table it writes into');

  const svc = await standService();
  const thirteen = [];
  for (const h of hoursFirstHandles().split(',')) thirteen.push(await svc.registered(h));
  const other = await svc.registered('Bystander');
  svc.env.DB._raw.exec(mig);
  const pieces = rows(svc.env.DB, 'SELECT to_id, batch, item FROM server_post');
  assert.equal(pieces.length, 13, 'one each');
  assert.deepEqual(new Set(pieces.map((p) => p.to_id)), new Set(thirteen.map((t) => t.id)));
  assert.ok(pieces.every((p) => p.batch === 'hours-first-hourlock'));
  assert.ok(pieces.every((p) => JSON.stringify(JSON.parse(p.item)) === JSON.stringify(mintHourlock())), 'the gilded gun, as its drop mints it');
  const box = await postBoxOf({ db: svc.env.DB }, { id: thirteen[0].id });
  assert.deepEqual([box.post.length, box.post[0].subject, box.post[0].item, box.unread, box.unclaimed], [1, "Hour's First", { name: 'The Hourlock', rarity: 'gilded' }, 1, 1]);
  assert.equal((await postBoxOf({ db: svc.env.DB }, { id: other.id })).post.length, 0, 'no one else');
  svc.env.DB._raw.exec(mig);
  assert.equal(rows(svc.env.DB, 'SELECT COUNT(*) AS n FROM server_post')[0].n, 13, 'applied again, nothing more');
});

/** A step's `run: |` block, by its name, as the runner hands it to bash (guildgrant.test.js's reader). */
function runBlock(yml, stepName) {
  const at = yml.indexOf(`- name: ${stepName}\n`);
  assert.ok(at >= 0, `no step named "${stepName}"`);
  const from = yml.indexOf('run: |\n', at) + 'run: |\n'.length;
  const lines = [];
  for (const l of yml.slice(from).split('\n')) {
    if (l.trim() && !l.startsWith('          ')) break;
    lines.push(l.slice(10));
  }
  return lines.join('\n');
}

test('SERVER-POST the workflow: run by hand only, a dry run unless asked, its inputs read once each as environment, the item a choice of the tool\'s names, the deploy\'s queue, nothing created or deployed; its steps, run here over D1\'s own answer, write the tool\'s statements, refuse a bad input before the database is asked, fail a name that finds nobody, summarise who holds it, and send only with apply (mutants: an input spliced into a run line; a missing name passing; the send on a dry run)', () => {
  const wf = src('.github/workflows/server-post.yml');
  const on = /\non:\n([\s\S]*?)\n\S/.exec(wf)?.[1] ?? '';
  assert.match(on, /^ {2}workflow_dispatch:/);
  assert.doesNotMatch(on, /push:|pull_request|schedule:/);
  assert.match(on, /\n {6}apply:\n(?: {8}.*\n)*? {8}default: false\n/, 'a dry run unless asked');
  assert.match(on, /\n {6}item:\n(?: {8}.*\n)*? {8}type: choice\n {8}options:\n {10}- none\n {10}- hourlock\n/, 'the tool\'s names, and only those');
  assert.equal(wf.match(/\$\{\{ inputs\./g)?.length, 6, 'the six inputs, each read once');
  assert.match(wf, /\n {6}HANDLES: \$\{\{ inputs\.handles \}\}\n {6}BATCH: \$\{\{ inputs\.batch \}\}\n {6}ITEM: \$\{\{ inputs\.item \}\}\n {6}SUBJECT: \$\{\{ inputs\.subject \}\}\n {6}MESSAGE: \$\{\{ inputs\.message \}\}\n {6}APPLY: \$\{\{ inputs\.apply \}\}\n/);
  assert.match(wf, /\nconcurrency:\n {2}group: account-deploy\n {2}cancel-in-progress: false\n/);
  assert.match(wf, /\npermissions:\n {2}contents: read\n/);
  assert.doesNotMatch(wf, /d1 create|migrations apply|wrangler deploy|--file/, 'it creates, migrates and deploys nothing');
  assert.equal(wf.match(/if: env\.APPLY == 'true'\n/g)?.length, 1);
  assert.match(wf, /- name: Send the post\n {8}if: env\.APPLY == 'true'\n/);
  assert.deepEqual(Object.keys(POST_ITEMS), ['none', 'hourlock'], 'the choice list is the tool\'s');

  const dir = mkdtempSync(join(tmpdir(), 'serverpost-'));
  const fake = join(dir, 'wrangler');
  writeFileSync(fake, '#!/usr/bin/env bash\ncase "$*" in *"INSERT OR IGNORE"*) cat "$FAKE_DIR/send.json";; *) cat "$FAKE_DIR/look.json";; esac\n');
  chmodSync(fake, 0o755);
  const d1Answer = (r) => JSON.stringify([{ results: r, success: true, meta: {} }]);
  const run = (step, { handles = 'Duck,Terra', batch = 'gift-one', item = 'hourlock', subject = "Hour's First", message = 'For you.', apply = 'false', look = [], send = [] } = {}) => {
    writeFileSync(join(dir, 'look.json'), d1Answer(look));
    writeFileSync(join(dir, 'send.json'), d1Answer(send));
    const summary = join(dir, `summary-${Math.random()}`);
    writeFileSync(summary, '');
    const r = spawnSync('bash', ['-c', runBlock(wf, step)], {
      cwd: fileURLToPath(ROOT),
      env: { PATH: process.env.PATH, WRANGLER: fake, FAKE_DIR: dir, DB_NAME: 'daggerfall-accounts', RUNNER_TEMP: dir, GITHUB_STEP_SUMMARY: summary,
        HANDLES: handles, BATCH: batch, ITEM: item, SUBJECT: subject, MESSAGE: message, APPLY: apply },
      encoding: 'utf8',
    });
    return { ...r, summary: readFileSync(summary, 'utf8') };
  };

  let r = run('Write the statements');
  assert.equal(r.status, 0, r.stderr);
  assert.equal(readFileSync(join(dir, 'names.txt'), 'utf8'), 'duck\nterra\n');
  assert.equal(readFileSync(join(dir, 'look.sql'), 'utf8'), `${lookSql('Duck,Terra', 'gift-one')}\n`);
  assert.equal(readFileSync(join(dir, 'send.sql'), 'utf8'), `${sendSql({ handles: 'Duck,Terra', batch: 'gift-one', item: 'hourlock', subject: "Hour's First", body: 'For you.' })}\n`);
  for (const bad of [{ item: 'sword' }, { handles: '$(touch pwned)' }, { batch: 'Not A Name' }, { subject: '' }]) {
    assert.notEqual(run('Write the statements', bad).status, 0, `a bad input stops the run before the database is asked: ${JSON.stringify(bad)}`);
  }
  assert.equal(run('Write the statements').status, 0, 'the good statements again');

  const found = [{ handle: 'Duck', handle_lc: 'duck', sent: 0 }, { handle: 'Terra', handle_lc: 'terra', sent: 1 }];
  r = run('Read the recipients', { look: found });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.summary, /\*\*Hour's First\*\* \(gift-one\), holding: hourlock/);
  assert.match(r.summary, /\| Duck \|  \|/);
  assert.match(r.summary, /\| Terra \| yes \|/);
  assert.match(r.summary, /A dry run: nothing was sent/);
  assert.doesNotMatch(run('Read the recipients', { look: found, apply: 'true' }).summary, /A dry run/);
  r = run('Read the recipients', { look: [found[0]] });
  assert.equal(r.status, 1, 'a name that finds nobody fails the run');
  assert.match(r.stdout, /::error::no registered account is named terra - nothing was sent/);

  r = run('Send the post', { apply: 'true', send: [{ id: 'a'.repeat(24), to_id: 'p-duck' }] });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.summary, /\*\*Sent\.\*\* 1 of 2 players were sent it now; the rest already held it\./);
});
