// GUILD-GRANT (2026-10-03, Mac: "Can we award the empire of tamriel guild 1.6mil gold") - gold into one guild's
// treasury, awarded by the operator. `tools/grantGuildGold.mjs` writes the statements and
// `.github/workflows/guild-grant.yml` runs them by hand - a dry run that reads the guild, then the award. The award is
// the treasury AND `realm_gold`, so it buys a hall and comes back out to a realm character, and the guild's own ledger
// says who put it there.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, chmodSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { standService, d1 } from '../accountDb.mjs';
import { grantSql, lookSql, grantGold, GRANT_BY } from '../../tools/grantGuildGold.mjs';
import { GUILD_LEDGER_WORDS } from '../../src/ui/socialPanel.js';
import { GUILD_TREASURY_MAX, GUILD_RANK_NAMES } from '../../src/net/guild/guildLaw.js';

const ROOT = new URL('../../', import.meta.url);
const src = (p) => readFileSync(new URL(p, ROOT), 'utf8');
const TOOL = fileURLToPath(new URL('tools/grantGuildGold.mjs', ROOT));

test('GUILD-GRANT end to end: the award lands in the treasury AND what buys a hall, the ledger names it the developers\' award, a realm character can take it out, and the next deposit is a deposit again (mutants: realm_gold left out; the kind unnamed; the moment unstamped)', async () => {
  const svc = await standService();
  const gm = await svc.registered('Gwen', { renown: 12 });
  assert.equal((await svc.found(gm, { name: 'Empire of Tamriel', tag: 'EOT' })).status, 200);
  assert.equal((await svc.call('/v1/guilds/deposit', { character: gm.character, gold: 60_000, realm: gm.at(), region: 17 }, gm.secret)).status, 200);
  svc.env.DB._raw.prepare('UPDATE guilds SET treasury = treasury + 40000').run();   // gold that came in before the realm
  const view = async () => (await svc.call('/v1/guilds/mine', { character: gm.character }, gm.secret)).body.guild;

  // THE DRY RUN, typed as the operator typed it: the one guild, as it stands
  assert.deepEqual(svc.env.DB._raw.prepare(lookSql('empire of tamriel')).all().map((r) => ({ ...r })),
    [{ name: 'Empire of Tamriel', tag: 'EOT', treasury: 100_000, realm_gold: 60_000, members: 1 }]);

  // THE AWARD
  const changed = svc.env.DB._raw.prepare(grantSql('empire of tamriel', '1600000')).all().map((r) => ({ ...r }));
  assert.deepEqual(changed, [{ name: 'Empire of Tamriel', tag: 'EOT', treasury: 1_700_000, realm_gold: 1_660_000 }], 'RETURNING names the one row it changed');
  let v = await view();
  assert.deepEqual([v.treasury, v.hallGold], [1_700_000, 1_660_000], 'the whole award buys a hall');
  const line = v.ledger[0];
  assert.deepEqual([line.who, line.kind, line.amount, line.balance], [GRANT_BY, 'grant', 1_600_000, 1_700_000]);
  assert.ok(Math.abs(line.at - Date.now() / 1000) < 60, 'stamped with its own moment');
  assert.equal(`${line.who} ${GUILD_LEDGER_WORDS[line.kind]} ${line.amount.toLocaleString('en-US')}`, 'The developers awarded the guild 1,600,000', 'the Guild tab\'s line');

  // ...AND IT COMES BACK OUT to a realm character like any gold a realm character put in
  assert.equal((await svc.call('/v1/guilds/withdraw', { character: gm.character, gold: 1_000_000, realm: gm.at(), region: 17 }, gm.secret)).status, 200);
  assert.equal((await svc.call('/v1/guilds/deposit', { character: gm.character, gold: 5, realm: gm.at(), region: 17 }, gm.secret)).status, 200);
  v = await view();
  assert.deepEqual([v.treasury, v.hallGold], [700_005, 660_005]);
  assert.deepEqual(v.ledger.slice(0, 3).map((l) => [l.who, l.kind, l.amount]), [['Gwen', 'deposit', 5], ['Gwen', 'withdraw', 1_000_000], [GRANT_BY, 'grant', 1_600_000]], 'the row forgets the kind with the line');
});

test('GUILD-GRANT the statement: that guild\'s treasury, realm gold and ledger and nothing else on any row; found by its name key in any case; never past the cap; a name nobody holds changes nothing; a quote in a name is data (mutants: the cap unasked; the name as typed)', () => {
  const db = d1()._raw;
  const add = db.prepare('INSERT INTO guilds (id, name, name_key, tag, ranks, treasury, founded_at, realm_gold) VALUES (?, ?, ?, ?, ?, ?, 1, ?)');
  add.run('g1', 'Empire of Tamriel', 'empireoftamriel', 'EOT', JSON.stringify(GUILD_RANK_NAMES), 100, 50);
  add.run('g2', "Tamriel's Empire", 'tamrielsempire', 'TE', JSON.stringify(GUILD_RANK_NAMES), 7, 7);
  add.run('g3', 'Brimful', 'brimful', 'BF', JSON.stringify(GUILD_RANK_NAMES), GUILD_TREASURY_MAX - 10, 0);
  const rows = () => db.prepare('SELECT * FROM guilds ORDER BY id').all().map((r) => ({ ...r }));
  const ledger = () => db.prepare('SELECT guild_id, who, kind, amount, balance FROM guild_ledger ORDER BY seq').all().map((r) => ({ ...r }));
  const was = rows();

  assert.deepEqual(db.prepare(grantSql('EMPIRE  OF TAMRIEL', 1000)).all().map((r) => r.tag), ['EOT'], 'the name key: case and spaces aside');
  const now = rows();
  assert.deepEqual({ ...now[0], treasury: 100, realm_gold: 50, moved_by: null, moved_at: null }, was[0], 'nothing else on the row');
  assert.deepEqual([now[0].treasury, now[0].realm_gold, now[0].moved_kind], [1100, 1050, null]);
  assert.deepEqual(now.slice(1), was.slice(1), 'and no other guild');
  assert.deepEqual(ledger(), [{ guild_id: 'g1', who: GRANT_BY, kind: 'grant', amount: 1000, balance: 1100 }]);

  assert.deepEqual(db.prepare(grantSql('Brimful', 11)).all(), [], 'past the cap: no row, which the workflow refuses');
  assert.deepEqual(db.prepare(grantSql('Brimful', 10)).all().map((r) => r.treasury), [GUILD_TREASURY_MAX], 'up to it');
  assert.deepEqual(db.prepare(grantSql('Nobody Here', 10)).all(), [], 'nobody by that name');
  assert.deepEqual(db.prepare(lookSql('Nobody Here')).all(), []);
  assert.deepEqual(db.prepare(grantSql("Tamriel's Empire", 3)).all().map((r) => r.tag), ['TE'], 'a quote in a guild\'s name is found, not a syntax error');
  assert.deepEqual(db.prepare(grantSql("x' OR 'a", 3)).all(), [], 'and a name shaped like SQL stays a name');
  assert.equal(ledger().length, 3);
});

test('GUILD-GRANT the tool: only a name a guild could be founded with, only a whole positive award within the cap; the command line prints the statement or nothing (mutants: the gold unchecked; zero awarded)', () => {
  assert.equal(grantGold('1600000'), 1_600_000);
  assert.equal(grantGold(' 1600000 '), 1_600_000, 'a pasted space is not an amount of its own');
  assert.equal(grantGold(String(GUILD_TREASURY_MAX)), GUILD_TREASURY_MAX);
  for (const bad of ['0', '-5', '1.5', '1,600,000', '1e6', '1600000; DROP TABLE guilds', '', undefined, '0100', String(GUILD_TREASURY_MAX + 1)]) {
    assert.throws(() => grantGold(bad), /not an award/, JSON.stringify(bad));
  }
  for (const bad of ['', 'ab', "x'; DROP TABLE guilds; --", 'a'.repeat(33), undefined]) {
    assert.throws(() => grantSql(bad, 1), /not a guild name/, JSON.stringify(bad));
    assert.throws(() => lookSql(bad), /not a guild name/, JSON.stringify(bad));
  }
  assert.throws(() => grantSql('Empire of Tamriel', '1.6m'), /not an award/);

  // THE COMMAND LINE, as the workflow runs it
  assert.equal(execFileSync(process.execPath, [TOOL, '--sql', 'Empire of Tamriel', '1600000'], { encoding: 'utf8' }), `${grantSql('Empire of Tamriel', '1600000')}\n`);
  assert.equal(execFileSync(process.execPath, [TOOL, '--look', 'Empire of Tamriel'], { encoding: 'utf8' }), `${lookSql('Empire of Tamriel')}\n`);
  for (const args of [['--sql', 'Empire of Tamriel', '1.6m'], ['--sql', "x'; DROP TABLE guilds; --", '5'], ['--look'], ['--sql', 'Empire of Tamriel']]) {
    const r = spawnSync(process.execPath, [TOOL, ...args], { encoding: 'utf8' });
    assert.equal(r.status, 1, args.join(' '));
    assert.equal(r.stdout, '', 'nothing for the workflow to run');
  }
});

/** A step's `run: |` block, by its name, as the runner hands it to bash (audit0929_terms.test.js's reader). */
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

test('GUILD-GRANT the workflow: run by hand only, its inputs read once each as environment, the tool\'s statements in the deploy\'s queue, the award behind apply alone, and a run that finds no guild or changes none fails - its steps run here as the runner runs them, over D1\'s own answer (mutants: an input spliced into a run line; a missing guild passing; an award that changed none passing; the award run on a dry run)', () => {
  const wf = src('.github/workflows/guild-grant.yml');
  const on = /\non:\n([\s\S]*?)\n\S/.exec(wf)?.[1] ?? '';
  assert.match(on, /^ {2}workflow_dispatch:/);
  assert.doesNotMatch(on, /push:|pull_request|schedule:/);
  assert.match(on, /\n {6}apply:\n(?: {8}.*\n)*? {8}default: false\n/, 'a dry run unless asked');
  assert.equal(wf.match(/\$\{\{ inputs\./g)?.length, 3, 'the three inputs, each read once');
  assert.match(wf, /\n {6}GUILD: \$\{\{ inputs\.guild \}\}\n {6}GOLD: \$\{\{ inputs\.gold \}\}\n {6}APPLY: \$\{\{ inputs\.apply \}\}\n/);
  assert.match(wf, /\nconcurrency:\n {2}group: account-deploy\n {2}cancel-in-progress: false\n/);
  assert.match(wf, /\npermissions:\n {2}contents: read\n/);
  assert.doesNotMatch(wf, /d1 create|migrations apply|wrangler deploy/, 'it creates, migrates and deploys nothing');
  assert.equal(wf.match(/if: env\.APPLY == 'true'\n/g)?.length, 1);
  assert.match(wf, /- name: Award the gold\n {8}if: env\.APPLY == 'true'\n/, 'the award, and the award alone, behind apply');

  // THE STEPS, run by bash over a wrangler that answers as D1 does (the look's rows, then the award's)
  const dir = mkdtempSync(join(tmpdir(), 'guildgrant-'));
  const fake = join(dir, 'wrangler');
  writeFileSync(fake, '#!/usr/bin/env bash\ncase "$*" in *"UPDATE guilds"*) cat "$FAKE_DIR/grant.json";; *) cat "$FAKE_DIR/look.json";; esac\n');
  chmodSync(fake, 0o755);
  const d1Answer = (rows) => JSON.stringify([{ results: rows, success: true, meta: {} }]);
  const run = (step, { guild = 'empire of tamriel', gold = '1600000', apply = 'false', look = [], grant = [] } = {}) => {
    writeFileSync(join(dir, 'look.json'), d1Answer(look));
    writeFileSync(join(dir, 'grant.json'), d1Answer(grant));
    const summary = join(dir, `summary-${Math.random()}`);
    writeFileSync(summary, '');
    const r = spawnSync('bash', ['-c', runBlock(wf, step)], {
      cwd: fileURLToPath(ROOT),
      env: { PATH: process.env.PATH, WRANGLER: fake, FAKE_DIR: dir, DB_NAME: 'daggerfall-accounts', RUNNER_TEMP: dir, GITHUB_STEP_SUMMARY: summary, GUILD: guild, GOLD: gold, APPLY: apply },
      encoding: 'utf8',
    });
    return { ...r, summary: readFileSync(summary, 'utf8') };
  };

  let r = run('Write the statements');
  assert.equal(r.status, 0, r.stderr);
  assert.equal(readFileSync(join(dir, 'look.sql'), 'utf8'), `${lookSql('empire of tamriel')}\n`);
  assert.equal(readFileSync(join(dir, 'grant.sql'), 'utf8'), `${grantSql('empire of tamriel', '1600000')}\n`);
  assert.notEqual(run('Write the statements', { gold: '1,600,000' }).status, 0, 'a bad award stops the run before the database is asked');
  assert.notEqual(run('Write the statements', { guild: '$(touch pwned)' }).status, 0);
  assert.equal(run('Write the statements').status, 0, 'the good statements again - a refused step ends a real run here');

  const eot = { name: 'Empire of Tamriel', tag: 'EOT', treasury: 100_000, realm_gold: 60_000, members: 12 };
  r = run('Read the guild', { look: [eot] });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.summary, /\*\*Empire of Tamriel \[EOT\]\*\*, 12 members/);
  assert.match(r.summary, /\| treasury \| 100000 \| 1700000 \|/);
  assert.match(r.summary, /\| buys a hall \| 60000 \| 1660000 \|/);
  assert.match(r.summary, /A dry run: nothing was written/);
  assert.doesNotMatch(run('Read the guild', { look: [eot], apply: 'true' }).summary, /A dry run/);
  r = run('Read the guild', { look: [] });
  assert.equal(r.status, 1, 'no guild by that name fails the run');
  assert.match(r.stdout, /::error::no guild is named empire of tamriel - nothing was changed/);

  r = run('Award the gold', { apply: 'true', grant: [{ name: 'Empire of Tamriel', tag: 'EOT', treasury: 1_700_000, realm_gold: 1_660_000 }] });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.summary, /\*\*Awarded\.\*\* Empire of Tamriel \[EOT\] now holds 1700000 gold, 1660000 of it able to buy a hall\./);
  r = run('Award the gold', { apply: 'true', grant: [] });
  assert.equal(r.status, 1, 'an award that changed no guild fails the run');
  assert.match(r.stdout, /::error::the award changed no guild/);
});
