// COST-0 (2026-10-24, the owner's bill: about $90 a day, $50 of it Durable Objects compute duration) - HOW MANY ROOMS
// ARE AWAKE, READ BY THE OPERATOR: tools/doActive.mjs walks Cloudflare's GraphQL schema to durableObjectsPeriodicGroups,
// builds its questions from what the schema says it has, and draws each day's objects awake, the always-awake count, the
// object-days and their cost; .github/workflows/do-active.yml runs it by hand, writing nothing. Over a fake endpoint in the
// real one's shape (test/fixtures/doActiveGraphql.mjs). bible/11-Multiplayer/Scale-Arc.md COST-0.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import {
  GRAPHQL, DAYS_MAX, ALWAYS_ON_H, OBJECT_DAY_USD, HOUR_EDGES, activeDays, accountId, windowDays, typeQuery, introspect,
  schemaTable, readingPlan, dayFilters, objectsQuery, totalQuery, unitOf, bucketOf, reading, graphqlAsk, namespacesOf,
} from '../../tools/doActive.mjs';
import { fakeCloudflare, NS_ROOM, NS_GATE } from '../fixtures/doActiveGraphql.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const src = (p) => readFileSync(join(ROOT, p), 'utf8');
const ACCT = src('server/wrangler.toml').match(/^account_id\s*=\s*"([^"]+)"/m)[1];
const NOW = Date.parse('2026-10-24T15:00:00Z');

test('COST-0 the window and the law: whole days 1 to a week (empty: the week), the last whole UTC days before now, an account id of 32 hex, an object-day $0.135 (128 MB a day at $12.50 per million GB-s), the unit the one that puts the busiest object-day nearest a whole day without passing it, the histogram\'s edges (mutants: the window\'s guard; the day the window ends; the price; the unit\'s rule; an edge)', () => {
  assert.equal(DAYS_MAX, 7);
  assert.equal(activeDays(''), 7);
  assert.equal(activeDays(' 3 '), 3);
  for (const bad of ['0', '8', '1.5', '-1', 'x', '1; rm']) assert.throws(() => activeDays(bad), /not a window/, bad);
  assert.equal(accountId(ACCT), ACCT);
  assert.throws(() => accountId('"}) { x'), /not an account id/);
  assert.deepEqual(windowDays(3, NOW), ['2026-10-21', '2026-10-22', '2026-10-23'], 'whole days, oldest first, today left out');
  assert.equal(OBJECT_DAY_USD.toFixed(4), '0.1350');
  assert.equal(ALWAYS_ON_H, 22);
  assert.deepEqual([...HOUR_EDGES], [1, 2, 4, 8, 12, 16, 20, 22, 24]);
  assert.deepEqual([0, 1, 1.01, 2, 21.9, 22, 22.1, 24, 30].map(bucketOf), [0, 0, 1, 1, 7, 7, 8, 8, 8]);
  const us = unitOf(23.9 * 3600 * 1e6);
  assert.deepEqual([us.chosen.name, us.sure], ['microseconds', true]);
  assert.deepEqual(us.readings.map((r) => Math.round(r.hours * 10) / 10), [23.9, 23900]);
  assert.equal(unitOf(23.9 * 3600 * 1e3).chosen.name, 'milliseconds', 'read as microseconds the bus would sleep 99.9% of the day');
  assert.deepEqual([unitOf(30 * 3600 * 1e6).chosen.name, unitOf(30 * 3600 * 1e6).sure], ['microseconds', false], 'every reading past a day: unsure');
});

test('COST-0 the schema, walked: the root\'s query type, viewer, accounts, the dataset\'s group and each of its parts (an object\'s fields, a value null), its filter\'s fields, its orders and the account\'s settings - every name the schema\'s own; the plan built from it (the day filter, the page the settings allow, the order by active time, the namespace split), a cut window and every missing field named, the questions exact (mutants: a wrapper unwrapped wrong; the settings unread; the page size; the order; the per-object dimension; the total through the page)', async () => {
  const cf = fakeCloudflare();
  const ask = graphqlAsk('t', cf.fetch);
  const schema = await introspect(ask, ACCT);
  assert.equal(schema.group, 'AccountDurableObjectsPeriodicGroups');
  assert.deepEqual(schema.parts, { count: null, dimensions: ['date', 'datetimeHour', 'namespaceId', 'objectId'], sum: ['activeTime', 'cpuTime', 'inboundWebsocketMsgCount'], max: ['activeWebsocketConnections'] });
  assert.ok(schema.filters.includes('date') && schema.filters.includes('datetime_lt'));
  assert.ok(schema.orders.includes('sum_activeTime_DESC'));
  assert.deepEqual(schema.settings, { enabled: true, maxDuration: 259200, maxNumberOfFields: 30, maxPageSize: 3, notOlderThan: 2678400 });
  assert.equal(cf.asked[0], 'query { __schema { queryType { name } } }');
  assert.equal(cf.asked[1], typeQuery('Query'));
  assert.ok(cf.asked.includes(`query { viewer { accounts(filter: {accountTag: "${ACCT}"}) { settings { durableObjectsPeriodicGroups { enabled maxDuration maxNumberOfFields maxPageSize notOlderThan } } } } }`), 'the settings the schema has, by name');
  assert.match(schemaTable(schema), /\| sum \| activeTime, cpuTime, inboundWebsocketMsgCount \|\n/);
  assert.match(schemaTable(schema), /\| orderBy \(activeTime\) \| sum_activeTime_ASC, sum_activeTime_DESC \|/);

  const plan = readingPlan(schema, 7);
  assert.deepEqual(plan, { days: 7, cut: null, byDay: 'date', slice: 86400, pageSize: 3, order: 'sum_activeTime_DESC', namespace: true });
  assert.deepEqual(dayFilters(plan, '2026-10-23'), ['{date: "2026-10-23"}']);
  assert.equal(objectsQuery(ACCT, plan, '{date: "2026-10-23"}'), `query { viewer { accounts(filter: {accountTag: "${ACCT}"}) { g: durableObjectsPeriodicGroups(limit: 3, filter: {date: "2026-10-23"}, orderBy: [sum_activeTime_DESC]) { dimensions { objectId namespaceId } sum { activeTime } } } } }`);
  assert.equal(totalQuery(ACCT, plan, '{date: "2026-10-23"}'), `query { viewer { accounts(filter: {accountTag: "${ACCT}"}) { g: durableObjectsPeriodicGroups(limit: 3, filter: {date: "2026-10-23"}) { dimensions { namespaceId } sum { activeTime } } } } }`, 'the total never by object');
  // a schema with less: what is missing named, before any data is asked
  assert.throws(() => readingPlan({ ...schema, parts: { ...schema.parts, sum: ['cpuTime'] } }, 7), /lacks sum\.activeTime/);
  assert.throws(() => readingPlan({ ...schema, parts: { ...schema.parts, dimensions: ['date'] } }, 7), /lacks dimensions\.objectId/);
  assert.throws(() => readingPlan({ ...schema, filters: ['objectId'] }, 7), /lacks a filter by day/);
  assert.throws(() => readingPlan({ ...schema, settings: { ...schema.settings, maxDuration: 3600 } }, 7), /finer than a day \(maxDuration 3600 s\)/);
  // the spellings the schema offers instead, and a window the account no longer keeps
  const range = readingPlan({ ...schema, filters: ['date_geq', 'date_leq'], orders: [] }, 2);
  assert.deepEqual([range.byDay, range.order], ['date_range', null]);
  assert.deepEqual(dayFilters(range, '2026-10-23'), ['{date_geq: "2026-10-23", date_leq: "2026-10-23"}']);
  assert.doesNotMatch(objectsQuery(ACCT, range, '{}'), /orderBy/, 'an order the schema lacks is not asked');
  const hours = readingPlan({ ...schema, filters: ['datetime_geq', 'datetime_lt'], settings: { ...schema.settings, maxDuration: 43200 } }, 2);
  assert.deepEqual(dayFilters(hours, '2026-10-23'), ['{datetime_geq: "2026-10-23T00:00:00.000Z", datetime_lt: "2026-10-23T12:00:00.000Z"}', '{datetime_geq: "2026-10-23T12:00:00.000Z", datetime_lt: "2026-10-24T00:00:00.000Z"}'], 'a day in the slices the account allows');
  assert.deepEqual([readingPlan({ ...schema, settings: { ...schema.settings, notOlderThan: 4 * 86400 } }, 7).days, readingPlan({ ...schema, settings: { ...schema.settings, notOlderThan: 4 * 86400 } }, 7).cut], [3, 3], 'the whole days the account keeps');
  assert.equal(readingPlan({ ...schema, settings: { ...schema.settings, maxPageSize: 50_000 } }, 7).pageSize, 10_000, 'never past PAGE_MAX');
  assert.equal(readingPlan({ ...schema, parts: { ...schema.parts, dimensions: ['objectId'] } }, 7).namespace, false);
});

test('COST-0 the reading: the schema drawn first, then each day by namespace - its objects, its page cut, the objects awake past ALWAYS_ON_H, its object-days from the day\'s own total (never the cut page\'s) and their cost - the window\'s object-days a day beside the bill, the hours histogram of the object-days the pages hold, and the objects awake longest; the unit said; a schema that lacks the active time stops after the schema, drawn; a refusal names the token (mutants: the total from the page; the always-on bound; the cut unsaid; the namespace name; the histogram; the top order)', async () => {
  const cf = fakeCloudflare();
  let md = '';
  const r = await reading({ ask: graphqlAsk('t', cf.fetch), account: ACCT, days: 2, now: NOW, out: (s) => { md += s; }, namespaces: await namespacesOf('t', ACCT, cf.fetch) });
  assert.ok(md.startsWith('**What the account exposes (`durableObjectsPeriodicGroups`)**'), 'the schema first');
  assert.equal(r.unit.chosen.name, 'microseconds');
  assert.match(md, /the busiest object-day reads 86,040,000,000 - 23\.9 h as microseconds, 23,900 h as milliseconds\. Read as \*\*microseconds\*\*/);
  assert.match(md, /\| day \| namespace \| objects \| page cut \| awake > 22 h \| object_days \| duration \$ \|/);
  for (const day of ['2026-10-22', '2026-10-23']) {
    assert.ok(md.includes(`| ${day} | Room (daggerfall-relay) | 3 | yes (3) | 2 | 3 | $0.41 |`), `${day}: the Room's three objects on a cut page, two awake past 22 h, three object-days from the day's total`);
    assert.ok(md.includes(`| ${day} | AdmitGate (daggerfall-relay) | 0 | yes (3) | 0 | 0 | $0.01 |`), `${day}: the door's hour, from the total alone`);
  }
  assert.match(md, /Over the window: 6\.1 object-days, 3 a day - \$0\.41 a day at \$0\.135 an object-day/);
  assert.match(md, /\*\*Hours awake a day \(the 6 object-days the pages hold; a cut page leaves out the least awake\)\*\*/);
  assert.match(md, /\| 1-2 \| 2 \|\n/);
  assert.match(md, /\| 22-24 \| 4 \|\n/);
  assert.match(md, /\| 0-1 \| 0 \|\n/);
  const top = md.slice(md.indexOf('objects awake longest'));
  assert.ok(top.indexOf('`bus') < top.indexOf('`shard') && top.indexOf('`shard') < top.indexOf('`cell'), 'the longest awake first');
  assert.ok(top.includes(`| \`${'bus'.padEnd(64, '0')}\` | Room (daggerfall-relay) | 2 | 23.9 | 2 |`));
  assert.equal(Math.round(r.objectDays * 1000), Math.round(2 * (3 + 1 / 24) * 1000));
  assert.ok(cf.asked.filter((q) => q.includes('objectId namespaceId')).length === 2 && cf.asked.filter((q) => q.includes('dimensions { namespaceId } sum')).length === 2, 'a day: one page of objects and one total');

  // milliseconds: the same day read in the other unit
  let ms = '';
  await reading({ ask: graphqlAsk('t', fakeCloudflare({ unit: 1e-3 }).fetch), account: ACCT, days: 1, now: NOW, out: (s) => { ms += s; } });
  assert.match(ms, /Read as \*\*milliseconds\*\*/);
  assert.ok(ms.includes(`| 2026-10-23 | ${NS_ROOM} | 3 | yes (3) | 2 | 3 | $0.41 |`), 'the same day, the namespace by its id where its name was not read');

  // a schema without the active time: the schema drawn, then the stop
  let part = '';
  await assert.rejects(reading({ ask: graphqlAsk('t', fakeCloudflare({ drop: 'sum.activeTime' }).fetch), account: ACCT, days: 1, now: NOW, out: (s) => { part += s; } }), /lacks sum\.activeTime/);
  assert.match(part, /\*\*What the account exposes/);
  // the endpoint's own refusals
  await assert.rejects(graphqlAsk('t', fakeCloudflare({ refuse: 403 }).fetch)('query { x }'), /refused \(HTTP 403\) - the token needs Account Analytics: Read/);
  await assert.rejects(graphqlAsk('t', fakeCloudflare({ errors: /x/ }).fetch)('query { x }'), /not answered \(HTTP 200\): \[\{"message":"unknown field"\}\]/);
  assert.equal(GRAPHQL, 'https://api.cloudflare.com/client/v4/graphql');
  assert.deepEqual(await namespacesOf('t', ACCT, async () => ({ ok: false, status: 403, json: async () => ({ success: false }) })), new Map(), 'namespaces the token may not read: the ids stand');
  assert.equal((await namespacesOf('t', ACCT, cf.fetch)).get(NS_GATE), 'AdmitGate (daggerfall-relay)');
});

/** A step's `run:` block, as the runner sees it. */
function stepRun(yml, stepName) {
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
const stepOf = (yml, stepName) => { const at = yml.indexOf(`- name: ${stepName}\n`); const end = yml.indexOf('\n      - ', at + 1); return yml.slice(at, end < 0 ? undefined : end); };

test('COST-0 the workflow: run by hand only, its one input read once as environment, its own queue, writing nothing, bounded, the token the two steps\' that use it and never the job\'s; the token step refuses to start without one and asks the tool\'s window first; its reading step, run here as the runner runs it over the fake endpoint, says the window and draws the reading into the summary - and a run the schema stops keeps the schema and fails (mutants: the input spliced into a run line; the token the job\'s; the token step\'s guard; the account; the run green on a stop)', () => {
  const wf = src('.github/workflows/do-active.yml');
  const on = /\non:\n([\s\S]*?)\n\S/.exec(wf)?.[1] ?? '';
  assert.match(on, /^ {2}workflow_dispatch:/);
  assert.doesNotMatch(on, /push:|pull_request|schedule:/);
  assert.equal(wf.match(/\$\{\{ inputs\./g)?.length, 1, 'the one input, read once');
  assert.match(wf, /\n {6}DAYS: \$\{\{ inputs\.days \}\}\n/);
  assert.match(wf, /\nconcurrency:\n {2}group: do-active\n {2}cancel-in-progress: false\n/);
  assert.match(wf, /\npermissions:\n {2}contents: read\n/);
  assert.match(wf, /\n {4}timeout-minutes: 15\n/);
  assert.match(stepOf(wf, 'Read the objects\' active time'), /run: \|\n {10}set -euo pipefail\n/);
  assert.doesNotMatch(wf, /wrangler(@\d)? |npx |migrations apply|d1 execute|curl /, 'it deploys, migrates and writes nothing - its one call the tool\'s');
  const job = wf.slice(wf.indexOf('\njobs:'), wf.indexOf('\n    steps:'));
  assert.doesNotMatch(job, /CLOUDFLARE_API_TOKEN/, 'never the job\'s');
  assert.equal(wf.match(/CLOUDFLARE_API_TOKEN: \$\{\{ secrets\.CLOUDFLARE_API_TOKEN \}\}/g)?.length, 2);
  for (const name of ['Refuse to start without a token', 'Read the objects\' active time']) assert.match(stepOf(wf, name), /\n {8}env:\n {10}CLOUDFLARE_API_TOKEN: \$\{\{ secrets\.CLOUDFLARE_API_TOKEN \}\}\n/, name);

  const dir = mkdtempSync(join(tmpdir(), 'doactive-'));
  const guard = (token, days) => {
    try { return { code: 0, out: execFileSync('bash', ['-c', stepRun(wf, 'Refuse to start without a token')], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe', env: { ...process.env, CLOUDFLARE_API_TOKEN: token, DAYS: days } }) }; } catch (e) { return { code: e.status, out: `${e.stdout}` }; }
  };
  assert.equal(guard('', '2').code, 1);
  assert.match(guard('', '2').out, /::error::secrets\.CLOUDFLARE_API_TOKEN is not set/);
  assert.equal(guard('x', '2').code, 0);
  assert.notEqual(guard('x', '2; rm -rf /').code, 0, 'a window the tool refuses stops the run');

  // THE READING STEP: `node` on the PATH is the real one with the fake endpoint loaded first, so the step runs as written
  const fixture = pathToFileURL(join(ROOT, 'test/fixtures/doActiveGraphql.mjs')).href;
  const run = (opts) => {
    const pre = join(dir, `pre-${Math.random().toString(36).slice(2)}.mjs`);
    writeFileSync(pre, `import { fakeCloudflare } from ${JSON.stringify(fixture)};\nconst cf = fakeCloudflare(${JSON.stringify(opts)});\nglobalThis.fetch = async (url, init) => { if (String(url).includes('/accounts/') && !String(url).includes(${JSON.stringify(ACCT)})) throw new Error('not the relay\\'s account'); return cf.fetch(url, init); };\n`);
    const bin = join(dir, `bin-${Math.random().toString(36).slice(2)}`);
    execFileSync('mkdir', ['-p', bin]);
    writeFileSync(join(bin, 'node'), `#!/usr/bin/env bash\nexec ${JSON.stringify(process.execPath)} --import ${JSON.stringify(pathToFileURL(pre).href)} "$@"\n`);
    chmodSync(join(bin, 'node'), 0o755);
    const summary = join(dir, `summary-${Math.random().toString(36).slice(2)}.md`);
    writeFileSync(summary, '');
    let out, status = 0;
    try {
      out = execFileSync('bash', ['-c', stepRun(wf, 'Read the objects\' active time')], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe', env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, DAYS: '2', GITHUB_STEP_SUMMARY: summary, CLOUDFLARE_API_TOKEN: 'x' } });
    } catch (e) { out = `${e.stdout}${e.stderr}`; status = e.status; }
    return { out, status, summary: readFileSync(summary, 'utf8') };
  };
  const ok = run({});
  assert.equal(ok.status, 0, ok.out);
  assert.match(ok.summary, /^\*\*Window: the last 2 whole UTC day\(s\), to \d{4}-\d\d-\d\d 00:00 UTC\*\*\n\n\*\*What the account exposes/);
  assert.match(ok.summary, /\| Room \(daggerfall-relay\) \| 3 \| yes \(3\) \| 2 \| 3 \| \$0\.41 \|/);
  const stopped = run({ drop: 'sum.activeTime' });
  assert.notEqual(stopped.status, 0, 'a run the schema stops is red');
  assert.match(stopped.out, /::error::the account's durableObjectsPeriodicGroups lacks sum\.activeTime/);
  assert.match(stopped.summary, /\*\*What the account exposes/, 'its schema kept');
});
