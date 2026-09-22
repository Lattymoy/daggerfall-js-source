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
import { RELAY_GRAPH } from './relayversion.test.js';   // the files a relay deploy would have to reship

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

// ── AND THE PROSE MUST AGREE WITH THE TRIGGER ───────────────────────
//
// 2026-09-21, Mac: "I think the server claim is stale. It's auto".
//
// It was, and it had been for fifteen weeks. `server/wrangler.toml` still
// said "It is manual on purpose", `src/net/wire.js` still said "the deploy
// is by hand ... nothing in CI does it", and `src/net/updateNotice.js` -
// the module whose WHOLE SUBJECT is telling a player when the server
// moved - opened by explaining that the server moves by hand. SRV-N/CI
// made all three false on 2026-09-17 and nothing went red, because every
// one of them was a sentence typed beside the fact rather than derived
// from it.
//
// So this asks the WORKFLOW what the deploy is and holds the tree to the
// answer. It is deliberately two-directional: make the deploy manual
// again and the pin does not merely stop caring, it starts requiring the
// files to say so. A claim about the deploy is a claim this test owns.
//
// THE POPULATION IS LIVE SOURCE AND CONFIG, not the bible. A dated arc
// entry that says "the deploy was by hand when this was written" is a
// RECORD and is true; the same sentence in a comment over running code is
// a lie a reader acts on. The bible's own entries already carry their
// corrections inline and are left alone.
//
// ...AND NOT THE RELAY BUNDLE ITSELF, which is the one exclusion here and
// is a real constraint of this repo rather than a convenience. SLAM8
// hashes the RAW BYTES of every file the Worker bundles, comments
// included, deliberately: `/health` answers "is the Worker running the
// bundle I built?", and a bundle whose comments differ is a different
// bundle. So correcting a COMMENT in `src/net/wire.js` forces a
// RELAY_VERSION bump, and a bump on main deploys the relay and drops
// every connected player. A prose fix is not worth a player's dungeon
// run, so the words in there are left for a slice that is redeploying
// anyway - and `src/net/wire.js` does still carry the stale sentence as
// this is written (2026-09-21), which is recorded here rather than
// hidden.
//
// The exclusion is DERIVED from `RELAY_GRAPH`, not listed: if wire.js
// ever leaves the bundle it falls straight back into the population, and
// a file that JOINS the bundle leaves it without anyone editing this.
const MANUAL_CLAIM = /(deploy(ed)?\s+(is\s+)?by\s+hand|by\s+hand\s*[-,]\s*`?npx wrangler|manual on purpose|nothing in CI does it|hand-deployed)/i;

test('SRV-N/CI: nothing in live source calls the deploy a hand command while the workflow runs on push', () => {
  // (0) THE GATE MUST BE ABLE TO CATCH ITS OWN SUBJECT. A pattern that
  //     matches nothing is green over any prose in the tree - which is
  //     EXACTLY the state this file was in for fifteen weeks, and a
  //     mutation that emptied MANUAL_CLAIM survived the first cut of
  //     this very test. The three sentences below are the ones that
  //     were actually live in the tree on 2026-09-21, quoted here
  //     because a test is not in the population it checks.
  for (const real of [
    '# that did not happen. It is manual on purpose: a deploy restarts every',
    '/** AUDIT WORLD34 D4: the relay names itself in /health - the deploy is by hand (`npx wrangler deploy`), nothing in',
    '//   deployed BY HAND - `npx wrangler deploy`, nothing in CI does it -',
  ]) {
    assert.match(real, MANUAL_CLAIM, 'the gate can no longer see the sentence it exists to catch');
  }
  // ...and it does not fire on the true prose that replaced them
  for (const fine of [
    '# THE DEPLOY IS AUTOMATIC, and has been since SRV-N/CI (PR #209):',
    '//   SRV-N/CI it is deployed by `.github/workflows/relay-deploy.yml` on',
  ]) {
    assert.doesNotMatch(fine, MANUAL_CLAIM, 'the gate fires on prose that says the right thing');
  }

  const wf = rd(WF);

  // (1) WHAT IS THE DEPLOY? Derived from the workflow's own trigger.
  const on = wf.slice(wf.search(/^on:/m));
  const head = on.slice(0, on.search(/^permissions:/m) >>> 0);
  const auto = /push:/.test(head) && /branches:\s*\[\s*main\s*\]/.test(head);

  // (2) EVERY LIVE .js AND THE WORKER'S OWN CONFIG. Walked, so a file
  //     added later is in the population without anyone remembering.
  const bundled = new Set(RELAY_GRAPH);   // see the note above: a comment here costs a deploy
  const files = [...walk('src'), ...walk('server/src'), 'server/wrangler.toml']
    .filter((f) => !bundled.has(f));
  const claims = files.filter((f) => MANUAL_CLAIM.test(rd(f)));

  // ...and the exclusion is exactly the bundle, nothing wider. wire.js is
  // in it today and IS carrying a stale claim - if that ever stops being
  // true the note above is wrong and should come out.
  assert.ok(bundled.has('src/net/wire.js'), 'the exclusion no longer covers the file it was written for');
  assert.ok([...bundled].some((f) => MANUAL_CLAIM.test(rd(f))),
    'nothing in the relay bundle claims a hand deploy any more - delete this exclusion and the note above it');

  if (auto) {
    assert.deepEqual(claims, [],
      'the workflow deploys on every push to main, so no comment over running code may call it a hand command');
  } else {
    assert.ok(claims.length > 0,
      'the workflow no longer deploys on push - some file must now tell a reader how the relay actually moves');
  }

  // (3) AND THE COST IS STILL WRITTEN DOWN WHERE THE DEPLOY IS
  //     CONFIGURED. Whichever way the trigger goes, a person opening
  //     wrangler.toml must learn that a deploy drops every connected
  //     player - that is the fact the old "manual on purpose" sentence
  //     was carrying, and it must not be lost with it.
  const toml = rd('server/wrangler.toml');
  assert.match(toml, /drops every connected player/i,
    'wrangler.toml no longer says what a deploy costs');
  // ...and says it in terms a person feels, not just as a phrase. A
  // banner alone survived a mutation that deleted the sentence under
  // it, which is a cost stated and not explained.
  assert.match(toml, /peers vanish/i, 'and no longer says what that looks like from inside the game');
  assert.match(toml, /chat goes quiet/i);
  assert.match(rd('server/wrangler.toml'), /relay-deploy\.yml/,
    'and no longer names the workflow that performs it');
});

test('ACC1d D2: the relay\'s identity key is CHECKED against the service that publishes it, and an unreachable service is not a mismatch', () => {
  const wf = rd(WF);
  const toml = rd('server/wrangler.toml');

  // THE KEY IS A VAR, NOT A SECRET, and that is the decision: a public
  // key can verify and cannot mint, so there is nothing to hide - and
  // fetching it at runtime would put the account service in the relay's
  // startup path, which is the coupling ACC0's two-Worker split exists
  // to refuse.
  const key = /^IDENTITY_PUBLIC_KEY\s*=\s*"([^"]+)"/m.exec(toml)?.[1];
  assert.ok(key, 'the relay carries the public half');
  assert.match(key, /^[A-Za-z0-9_-]{43}$/, 'a raw Ed25519 public key, base64url, no padding');
  const ttl = /^IDENTITY_MAX_TTL_S\s*=\s*"(\d+)"/m.exec(toml)?.[1];
  assert.ok(ttl && Number(ttl) > 0, 'and the TTL ceiling beside it (D3), because a call site that passes its own is how a generous value spreads');

  // THE WORKFLOW READS THE TOML rather than carrying a second copy. A
  // key typed into a workflow is a third home for a fact that already
  // has two, and it would agree with nothing on the day it drifts.
  assert.match(wf, /grep -oP '\^IDENTITY_PUBLIC_KEY[^']*' server\/wrangler\.toml/, 'the key comes out of the config the deploy ships');
  assert.doesNotMatch(wf, new RegExp(key.slice(0, 20)), 'and never as a literal in the workflow');
  assert.match(wf, /\/v1\/pubkey/, 'checked against what the account service publishes');

  // AN UNREACHABLE SERVICE IS A WARNING, NOT A REFUSAL. Blocking the
  // relay's deploy because a SECOND Worker is slow is the exact
  // coupling D1 and D2 both refused; only a key that answers and
  // disagrees stops it.
  const step = /- name: The relay's identity key matches[\s\S]*?\n\n/.exec(wf)?.[0] ?? '';
  assert.ok(step, 'the step is there');
  assert.match(step, /if \[ -z "\$got" \]; then\s*\n\s*echo "::warning::[^\n]*"\s*\n\s*exit 0/, 'no answer: a warning and a pass');
  assert.match(step, /if \[ "\$want" != "\$got" \]; then\s*\n\s*echo "::error::[^\n]*"\s*\n\s*exit 1/, 'a real disagreement: an error and a stop');
  // ...and it runs BEFORE the deploy, because a relay deployed with a
  // key nothing can verify against refuses every hello silently.
  assert.ok(wf.indexOf('- name: The relay\'s identity key matches') < wf.indexOf('- name: Deploy'), 'before wrangler runs, not after');
});
