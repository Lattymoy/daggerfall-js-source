// ACC1-CI (2026-09-21): THE ACCOUNT SERVICE'S DEPLOY, PINNED.
//
// Mac: "The token provided allows you to take this on yourself. I am
// not needed at all."
//
// ACC1b shipped `server-account/` with a four-step list headed "WHAT A
// PERSON HAS TO DO ONCE, BY HAND", and the reason given was that CI
// cannot create resources - only deploy code to them. That was wrong,
// and DEPLOY-PROSE had just finished paying for the same class of
// mistake on the relay: a sentence typed BESIDE a fact rather than
// derived from it goes on being read long after it stops being true.
//
// So this file holds the new arrangement the way `relaydeploy.test.js`
// holds the relay's, and for the same reason: a workflow is executed by
// GitHub, not by node, so it is the one thing in this tree that cannot
// fail in a test run. What CAN be held is held here.
//
// THE PINS THAT MATTER MOST ARE THE TWO DESTRUCTIVE ONES:
//   - re-minting the signing pair invalidates every token in flight;
//   - applying 0002 twice errors, because `ALTER TABLE ADD COLUMN` has
//     no IF NOT EXISTS.
// Both are now properties of a tool rather than warnings in a comment,
// and both are asked here in the shape that would actually break.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(root, p), 'utf8');
const WF = '.github/workflows/account-deploy.yml';
const TOML = 'server-account/wrangler.toml';
const TOOL = 'tools/mintIdentityKeys.mjs';

/** Every file under a directory, walked rather than listed - a file
 *  added later is in the population without anybody remembering. */
function walk(dir, out = []) {
  for (const name of readdirSync(join(root, dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(join(root, rel)).isDirectory()) walk(rel, out);
    else out.push(rel);
  }
  return out;
}

test('ACC1-CI: the database id is ONE fact in two files, and the substitution is checked', () => {
  // The config carries a sentinel where a real id would go, and the
  // workflow is the only thing that replaces it. Neither half is any
  // use without the other, so the pin derives the string from the
  // config and asks the workflow about THAT - rather than spelling it
  // twice and watching them drift.
  const toml = rd(TOML);
  const m = /^database_id\s*=\s*"([^"]+)"/m.exec(toml);
  assert.ok(m, 'the config no longer declares a database_id at all');
  const sentinel = m[1];
  assert.doesNotMatch(sentinel, /^[0-9a-f-]{32,}$/i,
    'a REAL database id is committed - the whole point is that Cloudflare owns it and the deploy resolves it');

  // THE ASSIGNMENT, NOT A MENTION. The workflow's own header comment
  // quotes this string while explaining what it is for, so asking
  // "does the file contain it?" is answered by the prose no matter
  // what the shell variable says - a mutant that drifted the
  // assignment by one word survived exactly that reading.
  const wf = rd(WF);
  const assigned = /^\s*sentinel='([^']+)'/m.exec(wf);
  assert.ok(assigned, 'the workflow no longer assigns a sentinel to substitute');
  assert.equal(assigned[1], sentinel,
    `the workflow substitutes "${assigned[1]}" but the config carries "${sentinel}" - it would deploy a config naming a database that cannot exist`);

  // AND THE SUBSTITUTION IS VERIFIED RATHER THAN ASSUMED. `sed` that
  // matched nothing exits 0, so without a check the failure surfaces
  // three steps later as a wrangler error about a missing database -
  // which reads like a code fault and is not one.
  assert.match(wf, /grep -q "\$sentinel"[\s\S]{0,400}?exit 1/,
    'nothing confirms the sentinel is present before the substitution');
  assert.match(wf, /if grep -q "\$sentinel"[\s\S]{0,200}?exit 1/,
    'nothing confirms the sentinel is GONE after the substitution');
});

test('ACC1-CI: the migrations are applied by the tool that remembers, never enumerated', () => {
  // THIS IS THE PIN 0002 PAID FOR. `ALTER TABLE ... ADD COLUMN` has no
  // IF NOT EXISTS, so a second application errors - "apply each one
  // exactly once, in order" has to be something a tool knows, not a
  // sentence in a comment that somebody reads once. wrangler's
  // `migrations apply` keeps a `d1_migrations` ledger in the database
  // itself; `d1 execute --file` keeps nothing.
  const wf = rd(WF);
  assert.match(wf, /d1 migrations apply/, 'the deploy no longer applies migrations through the ledger');

  const dir = 'server-account/migrations';
  const files = readdirSync(join(root, dir)).filter((f) => f.endsWith('.sql')).sort();
  assert.ok(files.length >= 2, 'the migration set shrank - this pin is about there being more than one');

  // DERIVED: no migration may be named in the workflow. A run that
  // lists them is a run that applies a new one only when somebody
  // remembers to edit the list, and applies an old one twice when they
  // copy the wrong line.
  for (const f of files) {
    assert.ok(!wf.includes(f), `${f} is named in the deploy - the ledger is what decides what runs, not the workflow`);
  }
  // A COMMAND, NOT A COMMENT. The workflow's own note names the
  // `d1 execute --file` spelling it replaced, and that note is worth
  // keeping - so the pin looks only at lines that are not comments.
  // (It fired on that very sentence the first time it ran: the right
  // failure from the wrong reading.)
  //
  // ONE REGEX, USED THREE TIMES. Narrowing a pin to dodge a false
  // positive is how a pin quietly stops asking anything, so the
  // controls below must exercise THE SAME pattern the assertion does -
  // a mutant that blanked the assertion's regex survived while the
  // controls carried copies of their own, proving only that two
  // throwaway literals still matched each other.
  const HAND_RUN = /^\s*[^#\n]*d1 execute[^\n]*--file/m;
  const COMMENT = '      # whole reason it replaced two `d1 execute --file` lines: 0002 is';
  const COMMAND = '          $WRANGLER d1 execute "$DB_NAME" --remote --file=migrations/0002_passwords.sql';
  assert.match(COMMAND, HAND_RUN, 'the pin cannot see a real hand-run migration');
  assert.doesNotMatch(COMMENT, HAND_RUN, 'the pin still fires on a comment about the old spelling');
  assert.doesNotMatch(wf, HAND_RUN, 'the deploy runs a migration file by hand again');

  // ...and the directory the ledger reads is the directory they are in.
  const toml = rd(TOML);
  const md = /^migrations_dir\s*=\s*"([^"]+)"/m.exec(toml);
  assert.ok(md, 'the binding no longer says where the migrations are');
  assert.equal(`server-account/${md[1]}`, dir,
    `migrations_dir points at ${md[1]}, but the migrations are in ${dir}`);

  // AND THE BINDING IS LIVE. ACC1b commented it out because the
  // database did not exist yet; it exists the moment the deploy runs,
  // so a commented binding now would mean a Worker deployed with no DB
  // at all, which answers 503 to every route.
  assert.match(toml, /^\[\[d1_databases\]\]/m, 'the D1 binding is still commented out');
  assert.match(toml, /^binding\s*=\s*"DB"/m, 'the binding is no longer named DB, which is what src/index.js reads');
});

test('ACC1-CI: the signing pair is NEVER re-minted, and never leaves the pipe', () => {
  const wf = rd(WF);

  // THE DESTRUCTIVE CASE. Every token this service has signed verifies
  // against the public half; replacing the pair fails all of them at
  // once and signs out everybody online. So the existing secret is
  // asked about, and the step stops before it puts anything.
  const found = /Mint the signing pair[\s\S]*?(?=\n      - name:)/.exec(wf);
  assert.ok(found, 'the minting step is gone or renamed past recognition');
  const step = found[0];
  assert.match(step, /secret list/, 'nothing asks whether a key is already set');
  assert.match(step, /IDENTITY_PRIVATE_KEY[\s\S]*?exit 0/,
    'the step does not bail out when a key already exists - it would re-mint and invalidate every token in flight');
  // THE BAIL-OUT MUST COME BEFORE THE MINT, not merely before the
  // write. A first cut asked only that `exit 0` precede `secret put`,
  // and a mutant that moved the whole guard down past the minting call
  // walked through it: the guard was still true, still upstream of the
  // put, and the pair was already generated. One line lower and the
  // same shape is the destructive case wearing a passing test.
  const look = step.indexOf('secret list');
  const bail = step.indexOf('exit 0');
  const mint = step.indexOf('mintIdentityKeys');
  const put = step.indexOf('secret put');
  assert.ok(look >= 0 && bail >= 0 && mint >= 0 && put >= 0, 'the minting step lost one of its four landmarks');
  assert.ok(look < mint, 'the existing key is looked for after a new one is minted');
  assert.ok(bail < mint, 'the early exit is after the mint, so a deploy re-mints on every run');
  assert.ok(mint < put, 'the secret is written before it is minted, which cannot be what was meant');

  // NEITHER HALF ON A COMMAND LINE, IN A FILE, OR IN A LOG. The private
  // value reaches wrangler through a pipe and nothing else touches it.
  assert.doesNotMatch(step, /echo[^\n]*\$priv|cat[^\n]*\$priv|>\s*[^\s|]*priv/,
    'the private half is echoed or written to a file');
  assert.doesNotMatch(step, /secret put[^\n]*\$priv/,
    'the private half is passed as an argument, where a process list can read it');
  assert.match(step, /printf '%s' "\$priv" \| .*secret put IDENTITY_PRIVATE_KEY/,
    'the private half no longer reaches wrangler through a pipe');
});

test('ACC1-CI: --pipe emits ONE pair, private first, and there is no way to ask for half', async () => {
  // Run the real tool. Two lines, in the documented order, and they
  // must actually be each other's halves - because the failure this
  // prevents is a service that signs with a key its own /v1/pubkey
  // disowns, which looks exactly like a forged token.
  const out = execFileSync('node', [join(root, TOOL), '--pipe'], { encoding: 'utf8' });
  const lines = out.split('\n').filter((l) => l !== '');
  assert.equal(lines.length, 2, `--pipe emitted ${lines.length} lines; the workflow reads exactly two`);
  const [priv, pub] = lines;

  const { subtle } = globalThis.crypto;
  const msg = new TextEncoder().encode('the two halves are one pair');
  const sk = await subtle.importKey('pkcs8', Buffer.from(priv, 'base64'), { name: 'Ed25519' }, false, ['sign']);
  const vk = await subtle.importKey('raw', Buffer.from(pub, 'base64url'), { name: 'Ed25519' }, false, ['verify']);
  const sig = await subtle.sign({ name: 'Ed25519' }, sk, msg);
  assert.ok(await subtle.verify({ name: 'Ed25519' }, vk, sig, msg),
    'the private half and the public half printed by ONE run are not a pair - the order may have flipped');

  // ORDER IS THE CONTRACT: the workflow reads private, then public. If
  // they swapped, the public half would be stored as the secret and
  // every token would be unsignable - so ask which is which rather
  // than trusting the shape.
  assert.ok(priv.length > pub.length, 'a PKCS8 private key is longer than a raw public key - these look swapped');

  // AND THERE IS NO SINGLE-HALF FLAG. Two calls would mint two
  // unrelated pairs. The tool deliberately offers no way to do it.
  const tool = rd(TOOL);
  assert.doesNotMatch(tool, /'--private'|'--public'/,
    'the tool offers a way to ask for one half alone, which mints two unrelated pairs across two calls');

  // ...and it still writes nothing to disk.
  assert.doesNotMatch(tool, /writeFile|appendFile|createWriteStream/, 'the key tool writes a key to disk');
});

test('AUDIT-ACC F2: the Worker entrypoint exports ONLY a handler, or workerd will not start', () => {
  // THE WORKER DID NOT BOOT. AUDIT-ACC stood it up in a real workerd
  // and it refused, before a single request:
  //
  //   Uncaught TypeError: Incorrect type for map entry 'ACCOUNT_VERSION':
  //   the provided value is not of type 'function or ExportedHandler'.
  //
  // In a module Worker EVERY named export of the entrypoint is read as
  // an entrypoint - a WorkerEntrypoint, a Durable Object, a Workflow -
  // and a plain string or Set is not one, so it is a hard startup
  // failure rather than something ignored. `src/index.js` exported four
  // constants and a test hook.
  //
  // NO NODE TEST COULD SEE IT, and that is the lesson worth keeping:
  // the pins IMPORTED those very names, so they proved the exports
  // existed while the runtime rejected them for existing. Importability
  // and deployability are different questions and the suite was only
  // ever asking the first one.
  const entry = rd('server-account/src/index.js');
  const named = [...entry.matchAll(/^export\s+(?!default\b)(\w+)\s+(\w+)/gm)];
  assert.deepEqual(named.map((m) => m[2]), [],
    `server-account/src/index.js has named exports (${named.map((m) => m[2]).join(', ')}) - workerd reads each as an entrypoint and refuses to start`);
  assert.match(entry, /^export default \{/m, 'the entrypoint no longer exports a handler at all');

  // THE RELAY IS THE CONTROL, and it is why this is a law rather than a
  // guess: server/src/index.js has deployed for months exporting
  // `default` and the `Room` Durable Object CLASS. A class is a legal
  // entrypoint; a constant is not. So the pin forbids named value
  // exports, not named exports outright.
  const relay = rd('server/src/index.js');
  assert.match(relay, /^export default \{/m);
  const relayNamed = [...relay.matchAll(/^export\s+(?!default\b)(\w+)\s+(\w+)/gm)];
  assert.ok(relayNamed.length > 0 && relayNamed.every((m) => m[1] === 'class'),
    'the relay entrypoint grew a non-class named export - the same startup failure is one deploy away');
});

test('AUDIT-ACC F15: the Worker is DEPLOYED before its secrets are asked about', () => {
  // `wrangler secret list` asks Cloudflare for a Worker's secrets, and
  // on a Worker that does not exist yet it fails outright:
  //
  //   Worker "daggerfall-accounts" not found.
  //   If this is a new Worker, run `wrangler deploy` first to create it.
  //
  // On the VERY FIRST DEPLOY that is the expected state. With the mint
  // before the deploy, the job aborted at the listing and nothing was
  // ever deployed - the first run could not have succeeded.
  //
  // F1 is what made it fatal. Before F1 the step swallowed the failure
  // with `|| echo '[]'`; F1 correctly made an unreadable listing stop
  // the job, and in doing so turned a first-run certainty into a hard
  // stop. BOTH HALVES WERE RIGHT ON THEIR OWN - the ORDER was wrong,
  // which is why this pin holds an order rather than a line.
  const wf = rd(WF);
  const step = (name) => {
    const i = wf.indexOf(`- name: ${name}`);
    assert.ok(i > 0, `the workflow has no step called "${name}"`);
    return i;
  };
  const migrations = step('Apply migrations');
  const deploy = step('Deploy');
  const mint = step('Mint the signing pair if the service has none');
  const verifyHealth = step('Verify /v1/health names this deploy');
  const verifyKey = step('Verify the service can hand back its own public key');

  assert.ok(migrations < deploy, 'the schema must exist before the Worker that reads it');
  assert.ok(deploy < mint, 'the secrets are asked about before the Worker exists - the first run cannot succeed');
  assert.ok(mint < verifyKey, '/v1/pubkey is checked before there is a key to publish');
  assert.ok(deploy < verifyHealth, 'the deploy is verified before it happens');

  // AND DEPLOYING WITHOUT A KEY MUST STAY SAFE, because that is the
  // window this order opens. The service answers `no-signing-key`
  // rather than minting something the relay would refuse, and that arm
  // is pinned in test/accountworker.test.js - named here so deleting it
  // there is not a quiet change to this order's safety.
  assert.match(rd('test/accountworker.test.js'), /no-signing-key/,
    'nothing pins what a keyless service does, and this order deploys one on every first run');
});

test('AUDIT-ACC F1: "I could not tell" must never be read as "there is no key"', () => {
  // THE GUARD FAILED OPEN, and it is the worst shape a bug can take: it
  // read correct. `wrangler secret list` has no `--json` flag (it takes
  // `--format json|pretty` and defaults to json), so wrangler printed
  // its HELP TEXT and exited 0; jq could not parse that; the `if` went
  // false; and the step fell through to minting a new pair. Every
  // deploy would have signed out everybody online.
  //
  // The flag was the trigger. THE FALLBACK WAS THE FAULT - `|| echo
  // '[]'` turns "I could not read the secrets" into "there are no
  // secrets", which is a destructive default reached by ignorance.
  const wf = rd(WF);
  const found = /Mint the signing pair[\s\S]*?(?=\n      - name:)/.exec(wf);
  assert.ok(found, 'the minting step is gone or renamed past recognition');
  const step = found[0];

  const listing = step.split('\n').find((l) => /secret list/.test(l) && !/^\s*#/.test(l));
  assert.ok(listing, 'nothing in the step lists the existing secrets any more');
  assert.doesNotMatch(listing, /\|\|/,
    'the secret listing has a fallback again - a listing that fails must fail the step, not answer "none"');
  assert.doesNotMatch(listing, /--json\b/,
    '`--json` is not a flag on `wrangler secret list`; it prints help and exits 0, which is how this failed open');
  assert.match(listing, /--format json/, 'the listing no longer asks for json in the spelling wrangler accepts');

  // ...and what came back is checked to BE a list before it is asked a
  // question about its contents.
  const shape = step.indexOf("type == \"array\"");
  const decide = step.indexOf('IDENTITY_PRIVATE_KEY"');
  assert.ok(shape >= 0, 'nothing checks that the listing is actually an array before trusting it');
  assert.ok(shape < decide, 'the shape is checked after the decision, which is not a check');
});

test('ACC1-CI: the deploy is verified BY CONTENT, and reads the host and version from the config', () => {
  const wf = rd(WF);
  const toml = rd(TOML);

  // A wrangler exit code of 0 over an unchanged Worker is a green
  // deploy that did not happen - U60's law for the client, SRV-N/CI's
  // for the relay, and this service's now.
  assert.match(wf, /v1\/health/, 'nothing checks that the deploy actually landed');
  assert.match(wf, /v1\/pubkey/, 'nothing checks the service can hand back the public key it was given');

  // DERIVED, NOT TYPED. The version and the worker name are read out of
  // wrangler.toml by the workflow itself, so a rename cannot leave the
  // check interrogating a host that no longer exists.
  assert.match(wf, /grep -oP '\^ACCOUNT_VERSION[^\n]*\$toml/, 'the workflow no longer reads the version from the config');

  // ...AND THE HOST IS NOT TYPED ANYWHERE. It used to be the worker
  // name from the config plus a hardcoded account subdomain beside it -
  // half derived, half typed, which is a second home for a fact and the
  // exact shape SLAM13 burned the relay on (AUDIT-ACC F16). The deploy
  // step reads the URL off wrangler's own output, which is the only
  // thing that knows where the Worker actually landed, and it makes
  // this workflow portable to any Cloudflare account.
  const live = wf.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
  assert.doesNotMatch(live, /[a-z0-9-]+\.workers\.dev/,
    'a workers.dev host is typed into a command - it must come from the deploy step');
  assert.match(live, /workers\\\.dev.*GITHUB_OUTPUT|GITHUB_OUTPUT[\s\S]{0,200}deployed to/,
    'the deploy step no longer publishes the URL it deployed to');

  const steps = wf.split(/\n      - name: /).slice(1);
  const verifiers = steps.filter((s) => /curl/.test(s) && /v1\//.test(s));
  assert.ok(verifiers.length >= 2, `expected the health and pubkey checks - found ${verifiers.length}`);
  for (const v of verifiers) {
    const title = v.split('\n')[0];
    assert.match(v, /steps\.deploy\.outputs\.base/,
      `"${title}" reaches a URL it did not get from the deploy`);
  }

  // ...and the value it would read is the one the code answers with.
  const inToml = /^ACCOUNT_VERSION\s*=\s*"([^"]+)"/m.exec(toml);
  const name = /^name\s*=\s*"([^"]+)"/m.exec(toml);
  assert.ok(inToml && name, 'the config no longer carries both a version and a name to read');
  // ...read from service.js since AUDIT-ACC F2 moved it there: the
  // entrypoint may export only a handler, so the constants live in
  // their own home and this pin follows them.
  const svc = rd('server-account/src/service.js');
  const inCode = /^export const ACCOUNT_VERSION = '([^']+)'/m.exec(svc);
  assert.ok(inCode, 'server-account/src/service.js no longer declares ACCOUNT_VERSION');
  assert.equal(inToml[1], inCode[1], 'the config and the code name different deploys - the verify step would never go green');

  // A path filter is allowed HERE and is refused on the relay. The
  // difference is not taste: this Worker holds no sockets. Hold the
  // filter, so a slice that moves the service somewhere the filter does
  // not cover reddens rather than silently stopping the deploys.
  const paths = /paths:\s*\n((?:\s*-\s*"[^"]+"\n)+)/.exec(wf);
  assert.ok(paths, 'the trigger no longer has a path filter');
  assert.match(paths[1], /server-account\/\*\*/, 'a change to the service itself would not deploy it');
  assert.match(paths[1], new RegExp('src/net/identityToken\\.js'.replace(/\//g, '\\/')),
    'the token module is bundled into this Worker and a change to it would not deploy');
});

test('ACC1-CI: nothing in the service still claims a person has to do this by hand', () => {
  // TWO-DIRECTIONAL, the shape DEPLOY-PROSE settled on the same day.
  // While the workflow exists, no file may say the work is manual;
  // delete the workflow and this pin starts REQUIRING them to say so.
  // A claim about who deploys this service is a claim this test owns.
  let automatic = true;
  try { rd(WF); } catch { automatic = false; }

  const MANUAL_CLAIM = /(what a person has to do once, by hand|none of this can be done from ci|cannot be done from ci|by hand, because it creates resources|only a cloudflare login can)/i;

  // POSITIVE CONTROLS. A pattern that matches nothing is green over any
  // prose at all, which is exactly the state DEPLOY-PROSE found the
  // relay's comments in - and the first cut of THAT gate had this same
  // hole. These are the sentences ACC1b really shipped.
  for (const real of [
    '# ─── WHAT A PERSON HAS TO DO ONCE, BY HAND ─────────────────────────',
    '# None of this can be done from CI, because it creates resources on the',
  ]) {
    assert.match(real, MANUAL_CLAIM, 'the pattern cannot see the sentences this gate exists to catch');
  }
  // ...and it does not fire on ordinary prose about the deploy
  assert.doesNotMatch('# A DEPLOY HERE DROPS NOBODY. That is the entire point of the split.', MANUAL_CLAIM);

  const population = [...walk('server-account'), TOOL];
  const liars = population.filter((f) => MANUAL_CLAIM.test(rd(f)));

  if (automatic) {
    assert.deepEqual(liars, [],
      'the deploy is automatic and these files still tell a reader to do it by hand');
    // ...and the config says what IS true, so a reader who never opens
    // the workflow still learns where the deploy comes from.
    assert.match(rd(TOML), /THE DEPLOY IS AUTOMATIC/,
      'the config no longer says the deploy is automatic');
    assert.ok(rd(TOML).includes('account-deploy.yml'),
      'the config does not name the workflow that deploys it');
  } else {
    assert.ok(liars.length > 0,
      'the deploy workflow is gone and nothing tells a reader the work is theirs again');
  }
});

test('ACC1d D2: the service\'s deploy checks the RELAY\'s copy of the public key, and says what to paste when it is stale', () => {
  const wf = rd(WF);
  // THE MINTING STEP IS THE DANGEROUS ONE. A newly minted pair is a
  // relay whose configured copy is now wrong, and the failure mode is
  // the worst there is: every hello refused as a bad signature, with
  // nothing anywhere saying why. So the deploy that can mint is the
  // deploy that checks.
  const step = /- name: Verify the service can hand back its own public key[\s\S]*?(?=\n      - name: |\n$)/.exec(wf)?.[0] ?? '';
  assert.ok(step, 'the pubkey step is there');
  assert.match(step, /grep -oP '\^IDENTITY_PUBLIC_KEY[^']*' server\/wrangler\.toml/, 'the relay\'s copy, read from the config that ships it');
  assert.match(step, /if \[ "\$want" != "\$key" \]; then/, 'compared against what this service publishes');
  assert.match(step, /exit 1/, 'and a mismatch fails the deploy');
  // AND IT SAYS WHAT TO DO. A red step naming two keys nobody can read
  // is a red step somebody re-runs; the summary carries the value.
  assert.match(step, /GITHUB_STEP_SUMMARY/, 'the correct value goes somewhere a person can copy it from');
  assert.doesNotMatch(wf, /IDENTITY_PRIVATE_KEY[^\n]*GITHUB_STEP_SUMMARY/, 'and never the private half');
  // THE KEY IS NEVER TYPED HERE, in either workflow: one home, which is
  // the relay's own config.
  const key = /^IDENTITY_PUBLIC_KEY\s*=\s*"([^"]+)"/m.exec(rd('server/wrangler.toml'))?.[1] ?? '';
  assert.doesNotMatch(wf, new RegExp(key.slice(0, 20)), 'no literal copy in the workflow');
});

test('ACC2: the deploy creates the SAVE BUCKET the same way it creates the database, and reads its name from the config it ships', () => {
  const wf = rd(WF);
  const toml = rd(TOML);
  // THE BINDING IS IN THE CONFIG, and it is the config the deploy
  // ships: a Worker whose toml binds a bucket that does not exist does
  // not start, which is why the create runs BEFORE the deploy.
  assert.match(toml, /^\[\[r2_buckets\]\]$/m, 'the save bucket is bound');
  const bucket = /^bucket_name\s*=\s*"([^"]+)"/m.exec(toml)?.[1];
  const binding = /^binding\s*=\s*"(SAVES)"/m.exec(toml)?.[1];
  assert.ok(bucket, 'and it has a name');
  assert.equal(binding, 'SAVES', 'under the name server-account/src/index.js reads (env.SAVES)');
  assert.match(rd('server-account/src/index.js'), /env\.SAVES/, 'which the Worker really reads');

  const step = /- name: Create the save bucket[\s\S]*?(?=\n      # |\n      - name: )/.exec(wf)?.[0] ?? '';
  assert.ok(step, 'the create step is there');
  // DERIVED, NOT TYPED TWICE - the same law the database's id follows.
  assert.match(step, /grep -oP '\^bucket_name[^']*' server-account\/wrangler\.toml/, 'the name comes out of the config');
  assert.doesNotMatch(step, new RegExp(`["']${bucket}["']`), 'and is never a literal in the workflow');
  // AUDIT-ACC F1 AGAIN: no `|| echo` fallback on the listing. "I could
  // not read this" must never become "there is none of it".
  assert.match(step, /\$WRANGLER r2 bucket list/, 'the list is asked before the create');
  assert.doesNotMatch(step, /r2 bucket list[^\n]*\|\|/, 'a listing that fails must fail the step');
  assert.match(step, /r2 bucket create/, 'and the create is only reached when it is missing');
  // ...and it runs BEFORE the deploy, for the reason above.
  assert.ok(wf.indexOf('- name: Create the save bucket') < wf.indexOf('- name: Deploy'), 'the bucket exists before the Worker that binds it');

  // THE MIGRATION IS NOT NAMED HERE EITHER. ACC1-CI's law: a workflow
  // that lists migration files applies a new one only when somebody
  // remembers. 0003 is applied by the ledger like every other.
  const migrations = readdirSync(new URL('../server-account/migrations', import.meta.url)).filter((f) => f.endsWith('.sql'));
  assert.ok(migrations.includes('0003_saves.sql'), 'ACC2 brought a migration');
  const live = wf.split('\n').filter((l) => !l.trim().startsWith('#')).join('\n');
  for (const m of migrations) assert.ok(!live.includes(m), `the workflow names ${m}`);
});
