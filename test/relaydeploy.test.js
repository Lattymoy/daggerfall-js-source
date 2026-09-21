// SRV-N/CI (2026-09-17): THE DEPLOY WORKFLOW, PINNED.
//
// `.github/workflows/relay-deploy.yml` is the only thing in this tree that
// can drop every connected player, and it is the only thing that cannot
// fail in a test run - a workflow is executed by GitHub, not by node. So
// what CAN be held is held here, and the first pin exists because the
// hazard already happened:
//
//   THE GREP IS AIMED AT A FILE PATH. `RELAY_VERSION` lived in
//   `server/src/index.js` when the workflow was written and moved to
//   `src/net/wire.js` the same afternoon (SLAM13), which silently made the
//   deploy read a file that no longer declared it. A concurrent session
//   caught that one by hand. This asks the question instead: WHEREVER the
//   constant actually is, that is the file the workflow must grep - and if
//   it moves again the test reddens rather than the deploy.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(root, p), 'utf8');
const WF = '.github/workflows/relay-deploy.yml';

/** Every .js under a directory, walked rather than listed: a file added
 *  later is in the population without anybody remembering to add it. */
function walk(dir, out = []) {
  for (const name of readdirSync(join(root, dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(join(root, rel)).isDirectory()) walk(rel, out);
    else if (name.endsWith('.js')) out.push(rel);
  }
  return out;
}

test('SRV-N/CI: the deploy greps RELAY_VERSION out of the file that actually declares it', () => {
  // DERIVED: find the declaration, do not name it. The workflow's own path
  // is then checked against what was found.
  const declares = [...walk('src'), ...walk('server/src')]
    .filter((f) => /^export const RELAY_VERSION = '/m.test(rd(f)));
  assert.equal(declares.length, 1,
    `RELAY_VERSION must have exactly ONE home - found ${declares.length}: ${declares.join(', ')}`);
  const home = declares[0];

  const wf = rd(WF);
  const grep = /grep -oP "\^export const RELAY_VERSION = '\\\\K\[\^'\]\+" ([^\s)]+)/.exec(wf);   // not \S+: the grep sits in $( ) and would capture the paren
  assert.ok(grep, 'the workflow no longer greps RELAY_VERSION in the shape this pin knows');
  assert.equal(grep[1], home,
    `the workflow greps ${grep[1]} but RELAY_VERSION is declared in ${home} - the deploy would read a file that does not declare it, which is how it broke the first time`);

  // ...and the pattern it uses really does extract the version from that
  // file, rather than merely pointing at the right one.
  const want = /^export const RELAY_VERSION = '([^']+)'/m.exec(rd(home))?.[1];
  assert.match(want ?? '', /^world\d+$/, 'the declared version is a deploy name');
});

test('SRV-N/CI: the deploy is triggered by the VERSION drifting, not by a path filter', () => {
  const wf = rd(WF);

  // It runs on every push to main...
  assert.match(wf, /on:\s*\n\s*push:\s*\n\s*branches: \[main\]/, 'it runs on push to main');
  assert.match(wf, /workflow_dispatch:/, 'and can still be forced by hand');

  // ...but a PATH FILTER would be the wrong automation and must not appear.
  // The relay's law lives in src/net/wire.js, which changes constantly for
  // reasons the running Worker does not care about; filtering on paths
  // would drop every player in the game over a comment.
  assert.doesNotMatch(wf, /^\s*paths(-ignore)?:/m,
    'no path filter - the trigger is the version, because only a relay-changing slice bumps it');

  // The decision is a COMPARISON between what main says and what is live,
  // and the guard must sit ON THE DEPLOY STEP. A campaign survivor deleted
  // it from there and passed anyway, because the same string still appeared
  // on the Verify step below - the assertion was satisfied by an occurrence
  // that was not the one it meant. Aim at the step, not the file.
  const deployStep = wf.slice(wf.indexOf('- name: Deploy\n'));
  assert.match(deployStep.slice(0, 160), /if: steps\.live\.outputs\.version != steps\.ver\.outputs\.version/,
    'the DEPLOY step itself runs only when live and source disagree - without this guard every push drops every player');
  assert.match(wf, /steps\.live\.outputs\.version == steps\.ver\.outputs\.version/,
    'and says so, rather than silently doing nothing, when they agree');

  // An unreadable relay is not "no drift" and is not a reason to deploy.
  assert.match(wf, /steps\.live\.outputs\.version == '' && github\.event_name == 'push'/,
    'a push will not deploy blind over a relay it could not read');

  // One at a time, and not cancelled between deploy and verify.
  assert.match(wf, /concurrency:\s*\n\s*group: relay-deploy\s*\n\s*cancel-in-progress: false/,
    'serialized, and never cancelled halfway - an interrupted run leaves a live version nothing confirmed');
});

test('SRV-N/CI: the deploy PROVES it landed, because an exit code does not', () => {
  const wf = rd(WF);
  // U60's standing lesson, applied to the relay: tools/verify-deploy.mjs
  // exists because HTTP 200 proves nothing, and a wrangler exit of 0 over
  // an unchanged Worker is the same lie one layer down.
  assert.match(wf, /\/health/, 'it asks the relay what it is serving');
  assert.match(wf, /VERIFIED: the relay serves/, 'and passes only on the version it built');
  assert.match(wf, /the relay never reported .* the deploy did not take/,
    'and fails loudly when the Worker never reports it');

  // the verify step is guarded on the same condition as the deploy, so a
  // skipped deploy does not sit in a thirty-attempt poll for five minutes
  const verify = wf.slice(wf.indexOf('Verify /health names this deploy'));
  assert.match(verify.slice(0, 200), /if: steps\.live\.outputs\.version != steps\.ver\.outputs\.version/,
    'verify runs exactly when the deploy did');
});

test('SRV-N/CI: the token is the repo\'s, never a literal', () => {
  const wf = rd(WF);
  assert.match(wf, /CLOUDFLARE_API_TOKEN: \$\{\{ secrets\.CLOUDFLARE_API_TOKEN \}\}/,
    'read from the repository secret');
  // The reason this workflow exists at all: a token was pasted into a chat
  // window because there was no other way to deploy. Nothing in the tree
  // should ever carry one.
  assert.doesNotMatch(wf, /cfat_[A-Za-z0-9_-]+/, 'no literal Cloudflare token');
  assert.equal(/wrangler/.test(wf) && /working-directory: server/.test(wf), true,
    'and it deploys from server/, where wrangler.toml is');
});
