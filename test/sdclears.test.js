// SD-CLEARS (2026-10-08, Mac: "The first group clear of the new abyss dungeon is done. Can you pull up all of their
// names?") - who broke an Abyss Dungeon, read by the operator. `tools/sdClears.mjs` writes the statements and
// `.github/workflows/sd-clears.yml` runs them by hand: every Abyss Dungeon broken, then the names of one - the first
// ever broken unless a slot is asked. It reads only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, chmodSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { d1 } from './accountDb.mjs';
import { createGuest } from '../server-account/src/accounts.js';
import { claimSd, sdHonoursRoll } from '../server-account/src/sds.js';
import { mintSdReceipt } from '../src/net/sdReceipt.js';
import { importReceiptKey } from '../src/net/gateReceipt.js';
import { importPublicKeyB64 } from '../src/net/identityToken.js';
import { listSql, namesSql, sdSlot } from '../tools/sdClears.mjs';

const ROOT = new URL('../', import.meta.url);
const src = (p) => readFileSync(new URL(p, ROOT), 'utf8');
const TOOL = fileURLToPath(new URL('tools/sdClears.mjs', ROOT));
const { subtle } = globalThis.crypto;
const rand = (b) => globalThis.crypto.getRandomValues(b);
const T0 = 1_800_000_000;

const named = (db, id, h) => db._raw.prepare('UPDATE players SET handle = ?, handle_lc = ? WHERE id = ?').run(h, h.toLowerCase(), id);
const account = async (db, handle) => {
  const id = (await createGuest({ db, subtle, rand, nowS: T0 }, { deviceLabel: null })).id;
  if (handle) named(db, id, handle);
  return id;
};
async function relayPair() {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  const pub = Buffer.from(new Uint8Array(await subtle.exportKey('raw', kp.publicKey))).toString('base64url');
  return { priv: await importReceiptKey(pkcs8, { subtle }), pubKey: await importPublicKeyB64(pub, { subtle }) };
}
/** A seed whose first write grants what is asked (sd9b_claim.test.js's), and a `rand` that answers the claim's draw with it. */
const seedFor = (title, aura) => { for (let c = 1; c <= 1000; c++) { const h = sdHonoursRoll(c); if (h.title === title && h.aura === aura) return c; } throw new Error(`no seed grants title ${title}, aura ${aura}`); };
const rolling = (seed) => (b) => (b.length === 4 ? (b.set([(seed >>> 24) & 255, (seed >>> 16) & 255, (seed >>> 8) & 255, seed & 255]), b) : rand(b));
const rows = (db, sql) => db._raw.prepare(sql).all().map((r) => ({ ...r }));

test('SD-CLEARS end to end: the claims the service recorded, read back - every Hollow broken with its count and first claim, the first broken\'s names oldest first with how each earned it, its level and its grants, another slot\'s by its number; a guest\'s fought and not listed until it registers and claims (mutants: the first broken the last; the claims unordered; another slot\'s names mixed in)', async () => {
  const db = d1();
  const { priv, pubKey } = await relayPair();
  const claim = async (id, slot, at, { x = 'dealt', l = 30, title = false, aura = false } = {}) => {
    const receipt = await mintSdReceipt({ d: slot, s: id, c: 1, x, l }, priv, { subtle, nowS: T0 });
    const player = db._raw.prepare('SELECT id, handle FROM players WHERE id = ?').get(id);   // the session's row, as the route hands it
    return claimSd({ db, nowS: at, subtle, rand: rolling(seedFor(title, aura)) }, { ...player }, receipt, pubKey);
  };
  const vex = await account(db, 'Vex'), ana = await account(db, 'ana'), bram = await account(db, 'Bram'), guest = await account(db, null);

  assert.deepEqual(rows(db, listSql()), [], 'nothing broken yet');
  assert.deepEqual(rows(db, namesSql()), []);

  assert.equal((await claim(vex, 1, T0 + 60, { title: true })).recorded, true);
  assert.equal((await claim(bram, 1, T0 + 30, { x: 'stood', l: 12, aura: true })).recorded, true);
  assert.equal((await claim(ana, 1, T0 + 60)).recorded, true, 'claimed the same second as Vex');
  assert.equal((await claim(guest, 1, T0 + 40)).why, 'guest', 'a guest\'s is answered and not counted');
  assert.equal((await claim(ana, 2, T0 + 9000)).recorded, true, 'the next Hollow');

  assert.deepEqual(rows(db, listSql()), [{ slot: 1, fighters: 3, first_at: T0 + 30 }, { slot: 2, fighters: 1, first_at: T0 + 9000 }]);
  const first = [
    { slot: 1, name: 'Bram', earned: 'stood', lv: 12, title: 0, aura: 1, at: T0 + 30 },
    { slot: 1, name: 'ana', earned: 'dealt', lv: 30, title: 0, aura: 0, at: T0 + 60 },
    { slot: 1, name: 'Vex', earned: 'dealt', lv: 30, title: 1, aura: 0, at: T0 + 60 },
  ];
  assert.deepEqual(rows(db, namesSql()), first, 'no slot: the first broken, oldest claim first, a tie by name in any case');
  assert.deepEqual(rows(db, namesSql('')), first, 'the workflow\'s empty input');
  assert.deepEqual(rows(db, namesSql(' 1 ')), first);
  assert.deepEqual(rows(db, namesSql(2)).map((r) => [r.slot, r.name]), [[2, 'ana']]);
  assert.deepEqual(rows(db, namesSql(3)), [], 'a slot nobody claimed');

  // THE GUEST REGISTERS, and its kept receipt lands late
  named(db, guest, 'Latecomer');
  assert.equal((await claim(guest, 1, T0 + 86_400)).recorded, true);
  assert.deepEqual(rows(db, namesSql()).map((r) => r.name), ['Bram', 'ana', 'Vex', 'Latecomer']);
  assert.deepEqual(rows(db, listSql())[0], { slot: 1, fighters: 4, first_at: T0 + 30 });
});

test('SD-CLEARS the tool: only a whole slot from 1, nothing else reaches the statement; the statements only read; the command line prints the statement or nothing (mutants: the slot unchecked)', () => {
  assert.equal(sdSlot('7'), 7);
  assert.equal(sdSlot(' 12 '), 12, 'a pasted space is not a slot of its own');
  assert.equal(sdSlot(3), 3);
  for (const bad of ['0', '-1', '1.5', '1e3', '0x10', '07', 'one', '1; DROP TABLE sd_kills', '1 OR 1=1', '9999999999', '', undefined]) {
    assert.throws(() => sdSlot(bad), /not a slot/, JSON.stringify(bad));
  }
  for (const bad of ['1; DROP TABLE sd_kills', '0', '(SELECT 1)']) assert.throws(() => namesSql(bad), /not a slot/, JSON.stringify(bad));
  for (const sql of [listSql(), namesSql(), namesSql(4)]) {
    assert.match(sql, /^SELECT /);
    assert.doesNotMatch(sql, /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE)\b/i, 'it reads only');
    assert.equal(sql.split(';').length, 2, 'one statement');
  }

  // THE COMMAND LINE, as the workflow runs it
  assert.equal(execFileSync(process.execPath, [TOOL, '--list'], { encoding: 'utf8' }), `${listSql()}\n`);
  assert.equal(execFileSync(process.execPath, [TOOL, '--names'], { encoding: 'utf8' }), `${namesSql()}\n`);
  assert.equal(execFileSync(process.execPath, [TOOL, '--names', ''], { encoding: 'utf8' }), `${namesSql()}\n`, 'the empty input');
  assert.equal(execFileSync(process.execPath, [TOOL, '--names', '2'], { encoding: 'utf8' }), `${namesSql(2)}\n`);
  for (const args of [['--names', '1; DROP TABLE sd_kills'], ['--names', '0'], ['--list', '1'], ['--names', '1', '2'], []]) {
    const r = spawnSync(process.execPath, [TOOL, ...args], { encoding: 'utf8' });
    assert.equal(r.status, 1, args.join(' '));
    assert.equal(r.stdout, '', 'nothing for the workflow to run');
  }
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

test('SD-CLEARS the workflow: run by hand only, its one input read once as environment, the tool\'s statements in the deploy\'s queue, writing nothing; its steps, run here as the runner runs them over D1\'s own answer, list the Hollows broken and name the one asked, and fail when nothing is found (mutants: the input spliced into a run line; an empty answer passing)', () => {
  const wf = src('.github/workflows/sd-clears.yml');
  const on = /\non:\n([\s\S]*?)\n\S/.exec(wf)?.[1] ?? '';
  assert.match(on, /^ {2}workflow_dispatch:/);
  assert.doesNotMatch(on, /push:|pull_request|schedule:/);
  assert.match(on, /\n {6}slot:\n(?: {8}.*\n)*? {8}required: false\n/, 'the first broken unless a slot is asked');
  assert.equal(wf.match(/\$\{\{ inputs\./g)?.length, 1, 'the one input, read once');
  assert.match(wf, /\n {6}SLOT: \$\{\{ inputs\.slot \}\}\n/);
  assert.match(wf, /\nconcurrency:\n {2}group: sd-clears\n {2}cancel-in-progress: false\n/);
  assert.match(wf, /\npermissions:\n {2}contents: read\n/);
  assert.doesNotMatch(wf, /d1 create|migrations apply|wrangler deploy|--file/, 'it creates, migrates, deploys and runs no file of its own');

  // THE STEPS, run by bash over a wrangler that answers as D1 does (the list's rows, or the names')
  const dir = mkdtempSync(join(tmpdir(), 'sdclears-'));
  const fake = join(dir, 'wrangler');
  writeFileSync(fake, '#!/usr/bin/env bash\ncase "$*" in *"GROUP BY slot"*) cat "$FAKE_DIR/list.json";; *) cat "$FAKE_DIR/names.json";; esac\n');
  chmodSync(fake, 0o755);
  const d1Answer = (r) => JSON.stringify([{ results: r, success: true, meta: {} }]);
  const run = (step, { slot = '', list = [], names = [] } = {}) => {
    writeFileSync(join(dir, 'list.json'), d1Answer(list));
    writeFileSync(join(dir, 'names.json'), d1Answer(names));
    const summary = join(dir, `summary-${Math.random()}`);
    writeFileSync(summary, '');
    const r = spawnSync('bash', ['-c', runBlock(wf, step)], {
      cwd: fileURLToPath(ROOT),
      env: { PATH: process.env.PATH, WRANGLER: fake, FAKE_DIR: dir, DB_NAME: 'daggerfall-accounts', RUNNER_TEMP: dir, GITHUB_STEP_SUMMARY: summary, SLOT: slot },
      encoding: 'utf8',
    });
    return { ...r, summary: readFileSync(summary, 'utf8') };
  };

  let r = run('Write the statements');
  assert.equal(r.status, 0, r.stderr);
  assert.equal(readFileSync(join(dir, 'list.sql'), 'utf8'), `${listSql()}\n`);
  assert.equal(readFileSync(join(dir, 'names.sql'), 'utf8'), `${namesSql()}\n`, 'no slot: the first broken');
  assert.equal(run('Write the statements', { slot: '2' }).status, 0);
  assert.equal(readFileSync(join(dir, 'names.sql'), 'utf8'), `${namesSql(2)}\n`);
  assert.notEqual(run('Write the statements', { slot: '1; DROP TABLE sd_kills' }).status, 0, 'a bad slot stops the run before the database is asked');
  assert.notEqual(run('Write the statements', { slot: '$(touch pwned)' }).status, 0);

  r = run('Read the clears', { list: [{ slot: 1, fighters: 3, first_at: T0 + 30 }, { slot: 2, fighters: 1, first_at: T0 + 9000 }] });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.summary, /\*\*Abyss Dungeons broken\*\*/);
  assert.match(r.summary, /\| 1 \| 3 \| 2027-01-15T08:00:30Z \|/);
  assert.match(r.summary, /\| 2 \| 1 \| 2027-01-15T10:30:00Z \|/);
  r = run('Read the clears', { list: [] });
  assert.equal(r.status, 1, 'nothing broken fails the run');
  assert.match(r.stdout, /::error::no Abyss Dungeon has been broken yet/);

  r = run('Read the names', { names: [
    { slot: 1, name: 'Bram', earned: 'stood', lv: 12, title: 0, aura: 1, at: T0 + 30 },
    { slot: 1, name: 'Vex', earned: 'dealt', lv: 30, title: 1, aura: 0, at: T0 + 60 },
  ] });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.summary, /\*\*Slot 1: 2 accounts\*\*/);
  assert.match(r.summary, /\| Bram \| stood \| 12 \|  \| yes \| 2027-01-15T08:00:30Z \|/);
  assert.match(r.summary, /\| Vex \| dealt \| 30 \| yes \|  \| 2027-01-15T08:01:00Z \|/);
  assert.match(r.stdout, /\| Bram \|/, 'the names in the log as well');
  r = run('Read the names', { slot: '9', names: [] });
  assert.equal(r.status, 1, 'a slot nobody claimed fails the run');
  assert.match(r.stdout, /::error::no claim names slot 9/);
});
