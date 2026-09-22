// AUDIT-ACC: THE ACCOUNT SERVICE, IN A REAL WORKERD.
//
//   npm run account
//
// ═══ WHY THIS EXISTS ═══════════════════════════════════════════════
//
// `test/accountworker.test.js` runs the service's own functions in node
// against a real SQLite, and it is a good suite - it caught the guest
// name alphabet, the modulo bias, the recovery-code folding. What it
// cannot do is START THE WORKER, and the day this probe was written
// that is exactly what was broken:
//
//   Uncaught TypeError: Incorrect type for map entry 'ACCOUNT_VERSION':
//   the provided value is not of type 'function or ExportedHandler'.
//
// In a module Worker every named export of the entrypoint is read as an
// entrypoint, and `src/index.js` exported four constants. The Worker
// could not boot. THE SUITE WAS GREEN, and it was green *because* it
// imported those very names - it proved they existed while the runtime
// refused to start over them. Importability is not deployability, and
// nothing in this tree was asking the second question.
//
// So this asks it, the way tools/bloodProbe.mjs asks the questions a
// node test cannot: by standing the real thing up and driving it.
//
// ═══ WHAT IT PROVES THAT THE SUITE DOES NOT ════════════════════════
//
//   - the Worker BOOTS in workerd at the committed compatibility_date;
//   - Ed25519 exists in that runtime at all (it is not in every
//     WebCrypto, and the whole token design rests on it);
//   - PBKDF2 at PBKDF2_ITERS finishes inside a Worker's CPU budget,
//     measured rather than assumed;
//   - the real migrations apply to a real D1 through wrangler's own
//     ledger, in order;
//   - a token minted BY THE WORKER verifies against the key the Worker
//     PUBLISHES - the exact seam ACC1d will use, both ends live;
//   - ACC2's SAVES BINDING IS REALLY BOUND (AUDIT-312 F4). A save goes
//     up and comes back byte for byte out of workerd's own R2, the
//     guest wall and the account isolation hold in the runtime, and the
//     delete takes the object as well as the row. The suite drives
//     these routes over a Map behind an R2-shaped face; a Map cannot
//     tell you whether the bucket in wrangler.toml exists, and a
//     binding that is absent does not crash - it answers `no-storage`,
//     which reaches a player as "Cloud saves are unavailable right now"
//     with a green suite behind it.
//
// ═══ WHAT IT STILL DOES NOT PROVE ══════════════════════════════════
//
// `--local` is workerd with local D1, not Cloudflare. There is no
// network, no real D1 limit, no cold start and no global. It proves the
// service runs and the crypto is there; it does not prove the deploy.
//
// It is NOT in the suite and has no Testing.md row, for the same reason
// the blood probe has none: it needs a toolchain (`npx wrangler`) and
// half a minute, and CI has neither to spare on every push.
import { spawn, execFile } from 'node:child_process';
import { request as httpRequest } from 'node:http';
import { promisify } from 'node:util';
import { writeFileSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyToken, importPublicKeyB64 } from '../src/net/identityToken.js';
import { PBKDF2_ITERS } from '../server-account/src/password.js';
import { ACCOUNT_VERSION, SHOT_MAX_BYTES } from '../server-account/src/service.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const acct = join(root, 'server-account');
const run = promisify(execFile);
const PORT = Number(process.env.ACCOUNT_PROBE_PORT || 8811);
const BASE = `http://127.0.0.1:${PORT}`;
// HOW WRANGLER IS RUN. `npx --yes wrangler@4` needs no install and is
// what `.github/workflows/account-deploy.yml` uses, so it is the
// default. But npx re-resolves the package on every invocation, and on
// a slow or proxied network that is minutes per call - and this probe
// calls it twice. Set WRANGLER_BIN to an already-installed wrangler
// (`node_modules/.bin/wrangler`) to skip all of that.
const WRANGLER_BIN = process.env.WRANGLER_BIN || '';
const cmd = (args) => (WRANGLER_BIN ? [WRANGLER_BIN, args] : ['npx', ['--yes', 'wrangler@4', ...args]]);

let checks = 0; let bad = 0;
const ok = (name, pass, detail = '') => {
  checks++; if (!pass) bad++;
  console.log(`${pass ? '  ok  ' : ' FAIL '} ${name}${detail ? ` - ${detail}` : ''}`);
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ═══ EVERY RUN GETS ITS OWN STATE (AUDIT-312) ══════════════════════
//
// `wrangler --local` keeps its D1 and R2 under server-account/.wrangler
// and REUSES them, so this probe was only correct the first time it was
// ever run: the second run registered a username the first run already
// took, then logged in with a password the first run's recovery check
// had changed, and reported six failures that were about the LAST run
// rather than about the service. The migration check read "no
// migrations to apply" as "no migrations".
//
// A probe that is only right once is a probe nobody can re-run, which
// is the whole point of one. `--persist-to` a fresh temp directory, and
// every run stands the service up on an empty database.
const STATE = mkdtempSync(join(tmpdir(), 'acctprobe-state-'));
const HANDLE = 'ProbeWalker';
const STRANGER = 'ProbeStranger';

// `node:http` RATHER THAN fetch, deliberately. This container sets
// HTTPS_PROXY/NO_PROXY, and a probe that talks to 127.0.0.1 through
// whatever a global fetch decides about proxies is a probe that hangs
// for reasons that have nothing to do with the service. http.request to
// an explicit host and port consults nothing.
function call(method, path, body, opts = {}) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : JSON.stringify(body);
    const req = httpRequest({
      host: '127.0.0.1', port: PORT, path, method, timeout: Number(opts.timeout ?? 20_000),
      headers: {
        ...(payload ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) } : {}),
        // AUDIT-ACC F13: the credential rides in a header, never a URL.
        ...(opts.bearer ? { authorization: `Bearer ${opts.bearer}` } : {}),
      },
    }, (res) => {
      let text = '';
      res.on('data', (d) => { text += d; });
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(text); } catch { /* not json */ }
        resolve({ status: res.statusCode, body: parsed, text });
      });
    });
    req.on('timeout', () => { req.destroy(new Error('timed out')); });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}
const post = (path, body) => call('POST', path, body ?? {});
const get = (path, opts) => call('GET', path, undefined, opts);

/** ACC2's blob routes speak RAW BYTES in both directions - a save is
 *  hundreds of kilobytes and base64 in a JSON envelope is a third more
 *  of them, paid twice. `call` above would stringify, so these have
 *  their own door, and it keeps the BUFFER rather than a decoded string
 *  because "byte for byte" is the claim under test. */
function raw(method, path, buf, bearer) {
  return new Promise((resolve, reject) => {
    const req = httpRequest({
      host: '127.0.0.1', port: PORT, path, method, timeout: 30_000,
      headers: {
        ...(buf ? { 'content-type': 'application/octet-stream', 'content-length': buf.length } : {}),
        ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
      },
    }, (res) => {
      const parts = [];
      res.on('data', (d) => parts.push(d));
      res.on('end', () => {
        const all = Buffer.concat(parts);
        const type = res.headers['content-type'] ?? '';
        let body = null;
        if (type.includes('json')) { try { body = JSON.parse(all.toString('utf8')); } catch { /* not json */ } }
        resolve({ status: res.statusCode, type, buf: all, body });
      });
    });
    req.on('timeout', () => { req.destroy(new Error('timed out')); });
    req.on('error', reject);
    if (buf) req.write(buf);
    req.end();
  });
}

// THE THROWAWAY PAIR NEVER TOUCHES THE REPO. It is minted for this run,
// written to a private file in the OS temp dir, and deleted in the
// `finally`. The real pair is minted by the deploy and read by nobody.
const tmp = mkdtempSync(join(tmpdir(), 'acctprobe-'));
let dev = null;

try {
  console.log('== minting a throwaway signing pair (never written into the repo)');
  const { stdout } = await run(process.execPath, [join(root, 'tools/mintIdentityKeys.mjs'), '--pipe']);
  const [priv, pub] = stdout.split('\n');
  ok('the key tool emits a pair', Boolean(priv && pub));
  const envFile = join(tmp, 'probe.env');
  writeFileSync(envFile, `IDENTITY_PRIVATE_KEY=${priv}\nIDENTITY_PUBLIC_KEY=${pub}\n`, { mode: 0o600 });

  console.log('== applying the real migrations to a local D1, through wrangler\'s ledger');
  const [migBin, migArgs] = cmd(['d1', 'migrations', 'apply', 'daggerfall-accounts', '--local', '--persist-to', STATE]);
  const mig = await run(migBin, migArgs, { cwd: acct, timeout: 300_000 });
  // wrangler reprints its whole summary table once per migration, so
  // the names repeat - dedupe before comparing, and compare against
  // what is actually in the directory rather than against itself.
  const seen = [...new Set([...mig.stdout.matchAll(/(\d{4}_\w+\.sql)/g)].map((m) => m[1]))];
  const onDisk = readdirSync(join(acct, 'migrations')).filter((f) => f.endsWith('.sql')).sort();
  ok('every migration in the directory was applied, in order',
    seen.join() === onDisk.join(), `applied ${seen.join(' ')} | on disk ${onDisk.join(' ')}`);

  // FAIL FAST ON A PORT SOMEBODY ELSE HOLDS. An earlier cut of this
  // probe left orphans behind (see the kill below), and the symptom was
  // a run that sat at "booting" until it was killed - because wrangler
  // could not bind and this loop polled a port that would never be
  // ours. A clear sentence beats a ten-minute hang.
  // ONLY A REFUSED CONNECTION MEANS THE PORT IS FREE. The first cut of
  // this check also let a TIMEOUT through as "nothing there", and that
  // is precisely backwards: an orphaned workerd accepts the connection
  // and never answers, so a timeout is the strongest evidence that
  // something IS holding the port. Every run after the first orphan
  // then sat at "booting" until it was killed, because wrangler could
  // not bind and the poll waited on a port that would never be ours.
  let held = false;
  try {
    await get('/v1/health', { timeout: 2000 });
    held = true;
  } catch (e) {
    if (!/ECONNREFUSED/i.test(String(e?.message ?? e))) held = true;
  }
  if (held) {
    throw new Error(`something is already holding ${PORT} (answering, or accepting and never replying)`
      + ' - kill it with `pkill -f workerd`, or set ACCOUNT_PROBE_PORT to a free port');
  }

  console.log('== booting the Worker in workerd');
  // DETACHED, so the kill below takes the whole process group. `npx` is
  // a wrapper around `wrangler`, which is a wrapper around `workerd`;
  // killing the pid this call returns leaves the grandchild running,
  // holding the port, and every later run of this probe hangs on it.
  const [devBin, devArgs] = cmd(['dev', '--local', '--persist-to', STATE, '--port', String(PORT), '--ip', '127.0.0.1', '--env-file', envFile]);
  dev = spawn(devBin, devArgs, { cwd: acct, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  let log = '';
  dev.stdout.on('data', (d) => { log += d; });
  dev.stderr.on('data', (d) => { log += d; });

  let up = false;
  for (let i = 0; i < 150 && !up; i++) {
    await sleep(1000);
    if (i && i % 10 === 0) console.log(`   ...still waiting for workerd (${i}s)`);
    // A SHORT poll. The first cut used the default 20s request timeout,
    // so a port that ACCEPTS but does not answer made each attempt cost
    // twenty seconds and the loop crawled - which read exactly like a
    // hang and hid the diagnostics underneath it.
    try { up = (await get('/v1/health', { timeout: 2000 })).status === 200; } catch { /* not yet */ }
  }
  if (!up) {
    // The whole point of this probe is the boot, so when the boot is
    // what failed, print what the runtime said instead of a bare FAIL.
    console.log('--- wrangler said ---');
    console.log(log.split('\n').filter((l) => l.trim()).slice(-25).join('\n'));
    console.log('---------------------');
  }
  // THE BOOT IS THE HEADLINE CHECK. A named export on the entrypoint
  // fails here and nowhere else in this repo.
  ok('the Worker BOOTS in workerd', up,
    up ? '' : `never answered /v1/health. workerd said: ${(/Uncaught[^\n]*/.exec(log) || ['(no uncaught error)'])[0]}`);
  if (!up) throw new Error('the Worker did not start');

  const health = await get('/v1/health');
  ok('/v1/health names the deploy this tree builds', health.body?.v === ACCOUNT_VERSION,
    `${health.body?.v} vs ${ACCOUNT_VERSION}`);
  ok('an unknown path is 404, answered before any credential', (await get('/v1/nope')).status === 404);

  console.log('== the account lifecycle, against real D1');
  // THE DATABASE MUST BE THERE BEFORE ANY OF THIS MEANS ANYTHING.
  // /v1/health answers without touching D1, so a Worker whose binding
  // is empty looks healthy - and the first run of this probe reported
  // six mysterious failures in a row because of exactly that. Ask the
  // binding a real question, and say plainly what came back.
  const first = await post('/v1/auth/guest', { label: 'probe' });
  if (first.status !== 200) {
    throw new Error(`/v1/auth/guest answered ${first.status} ${JSON.stringify(first.body)}`
      + ' - if this is `no-database`, the local D1 wrangler dev opened is not the one'
      + ' `d1 migrations apply --local` wrote to');
  }
  const guest = first.body;
  ok('a guest is a real row from first contact', Boolean(guest?.id && guest?.secret));
  ok('...under a name from Daggerfall\'s own banks, with exactly one space',
    /^\S+ \S+$/.test(guest?.name ?? ''), guest?.name);

  const tokRes = await post('/v1/auth/token', { secret: guest.secret });
  const tok = tokRes.body;
  ok('the Worker mints a token', typeof tok?.token === 'string',
    typeof tok?.token === 'string' ? '' : `${tokRes.status} ${JSON.stringify(tok)}`);
  if (typeof tok?.token !== 'string') throw new Error('no token to verify - the rest of this probe is about that token');

  const pubRes = await get('/v1/pubkey');
  const pubkey = pubRes.body;
  ok('the service publishes its own public half, with no credential', Boolean(pubkey?.key),
    pubkey?.key ? '' : `${pubRes.status} ${JSON.stringify(pubkey)}`);
  if (!pubkey?.key) throw new Error('no published key - the seam ACC1d needs is not there');

  // ═══ THE SEAM ACC1d WILL USE, BOTH ENDS LIVE ═══════════════════
  const { subtle } = globalThis.crypto;
  const vk = await importPublicKeyB64(pubkey.key, { subtle });
  const nowS = Math.floor(Date.now() / 1000);
  const v = await verifyToken(tok.token, vk, { subtle, nowS });
  ok('A TOKEN THE WORKER SIGNED VERIFIES AGAINST THE KEY THE WORKER PUBLISHES',
    v.ok === true, v.ok ? `${v.claims.n} / ${v.claims.k}` : v.why);
  ok('...and the name in it is the one the SERVICE holds, not one a client asked for',
    v.ok && v.claims.n === guest.name);

  // Negative controls: a probe that only ever sees success proves nothing.
  const stranger = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const svk = await subtle.importKey('raw', await subtle.exportKey('raw', stranger.publicKey),
    { name: 'Ed25519' }, false, ['verify']);
  ok('a stranger\'s key refuses the same token', (await verifyToken(tok.token, svk, { subtle, nowS })).ok === false);
  const [tv, body, sig] = tok.token.split('.');
  const bent = `${tv}.${body.slice(0, -2)}${body.slice(-2) === 'AA' ? 'AB' : 'AA'}.${sig}`;
  ok('one bent byte in the claims is refused', (await verifyToken(bent, vk, { subtle, nowS })).ok === false);

  console.log('== password, recovery and the throttle, in the runtime that will run them');
  const t0 = Date.now();
  const reg = (await post('/v1/auth/register',
    { secret: guest.secret, handle: HANDLE, password: 'a good long one' })).body;
  const regMs = Date.now() - t0;
  ok('registering is an UPGRADE IN PLACE - the id does not change', Boolean(reg?.recoveryCode));
  const view = (await get('/v1/account', { bearer: guest.secret })).body;
  ok('...the same player id, now linked', view?.account?.id === guest.id && view?.account?.kind === 'linked');
  // TWO derivations (password + recovery code) plus D1 round trips.
  // WORKERD IS NOT CLOUDFLARE, and this line is where that was learned.
  // It measured "PBKDF2 at 210,000 costs 36ms" and passed, against a
  // runtime with no iteration cap, while the deployed Worker answered
  // 500 to every password route. The timing is still worth having; the
  // CEILING is the thing this probe cannot see, so it says so and the
  // suite holds the number instead.
  ok(`PBKDF2 at ${PBKDF2_ITERS} fits a Worker's CPU budget`, regMs < 10_000, `register took ${regMs}ms`);
  ok('...and is at or under the cap Cloudflare enforces in PRODUCTION ONLY (workerd does not)', PBKDF2_ITERS <= 100_000, `${PBKDF2_ITERS} would be NotSupportedError on the real platform`);

  const good = await post('/v1/auth/login', { handle: HANDLE.toLowerCase(), password: 'a good long one' });
  ok('a handle is case-insensitive on the way in', good.status === 200);
  const miss = await post('/v1/auth/login', { handle: 'nobody-holds-this', password: 'a good long one' });
  const wrong = await post('/v1/auth/login', { handle: HANDLE, password: 'not the password' });
  ok('a handle nobody holds and a wrong password refuse identically',
    miss.status === wrong.status && miss.body?.error === wrong.body?.error, miss.body?.error);

  // ═══ ACC2: THE SAVE ROUTES, AGAINST REAL LOCAL R2 ══════════════
  //
  // AUDIT-312 F4. This probe exists because IMPORTABILITY IS NOT
  // DEPLOYABILITY - and ACC2 added a whole new BINDING (`SAVES`, an R2
  // bucket) plus seven routes, and nothing here asked the one question
  // this tool was written to ask. The gap mattered more than it looks:
  // a binding that is absent does not crash, it answers `no-storage`,
  // so a mis-declared bucket would have reached players as "Cloud saves
  // are unavailable right now" for ever, with a green suite and a green
  // deploy behind it.
  //
  // `test/cloudsaves.test.js` drives these routes over a Map behind an
  // R2-shaped face. THIS drives them over workerd's own R2, which is
  // the half a Map cannot answer for.
  console.log('== the cloud saves, against real local R2');
  const me = (await post('/v1/auth/login', { handle: HANDLE, password: 'a good long one' })).body;
  const SLOT = '/v1/saves/c0ffee00-1111-2222-3333-444455556666/before%20the%20lich';
  ok('a linked account starts with no cloud saves',
    (await get('/v1/saves', { bearer: me.secret })).body?.saves?.length === 0);

  // THE WALL, in the runtime. A guest is refused, and the same request
  // from the linked account above is not - a refusal check with no
  // positive control is green over a service that refuses everybody.
  const visitor = (await post('/v1/auth/guest', { label: 'probe-guest' })).body;
  const walled = await get('/v1/saves', { bearer: visitor.secret });
  ok('a GUEST is walled out of the save routes', walled.status === 403 && walled.body?.error === 'saves-need-account',
    `${walled.status} ${walled.body?.error}`);

  const blob = Buffer.from(`{"probe":"${'x'.repeat(4096)}"}`);
  ok('a blob with no card is refused (SAV4: a slot is only real WITH its SaveInfo)',
    (await raw('PUT', `${SLOT}/data`, blob, me.secret)).status === 404);
  const card = await call('PUT', SLOT, { characterName: 'Nystul', gameTime: 42, realTime: Date.now() }, { bearer: me.secret });
  ok('the card creates the slot', card.status === 200 && card.body?.created === true,
    `${card.status} ${JSON.stringify(card.body)}`);
  const put = await raw('PUT', `${SLOT}/data`, blob, me.secret);
  ok('the blob lands in R2 and the row counts its bytes',
    put.status === 200 && put.body?.bytes === blob.length, `${put.status} ${JSON.stringify(put.body)}`);
  const listed = (await get('/v1/saves', { bearer: me.secret })).body?.saves ?? [];
  ok('...and the listing says so', listed.length === 1 && listed[0].bytes === blob.length
    && listed[0].saveName === 'before the lich', JSON.stringify(listed[0]));
  const down = await raw('GET', `${SLOT}/data`, undefined, me.secret);
  ok('THE BYTES COME BACK OUT OF REAL R2, byte for byte',
    Buffer.compare(down.buf, blob) === 0, `${down.status} ${down.buf.length} of ${blob.length}`);
  ok('...as an octet-stream and not a JSON envelope around base64',
    down.type.includes('octet-stream'), down.type);
  ok('the shot is bounded apart from the save',
    (await raw('PUT', `${SLOT}/shot`, Buffer.alloc(SHOT_MAX_BYTES + 1), me.secret)).status === 413);

  // ANOTHER ACCOUNT, THE SAME CHARACTER ID AND THE SAME SLOT NAME -
  // which two people produce the moment both call a save QuickSave.
  const other = (await post('/v1/auth/guest', { label: 'probe-other' })).body;
  await post('/v1/auth/register', { secret: other.secret, handle: STRANGER, password: 'a good long one' });
  ok('another account cannot read this slot',
    (await raw('GET', `${SLOT}/data`, undefined, other.secret)).status === 404);
  ok('...and cannot delete it either',
    (await call('DELETE', SLOT, undefined, { bearer: other.secret })).status === 404);
  ok('...and this slot is still here', (await get('/v1/saves', { bearer: me.secret })).body?.saves?.length === 1);

  // AUDIT-312 F1: the player's own delete, which had no door in the
  // game until this audit and is the remedy the `too-many-saves`
  // sentence names.
  ok('the player\'s own delete takes the slot', (await call('DELETE', SLOT, undefined, { bearer: me.secret })).status === 200);
  ok('...the row is gone', (await get('/v1/saves', { bearer: me.secret })).body?.saves?.length === 0);
  ok('...and so is the object in R2', (await raw('GET', `${SLOT}/data`, undefined, me.secret)).status === 404);

  console.log('== back to the account: recovery');
  const back = await post('/v1/auth/recover',
    { handle: HANDLE, code: reg.recoveryCode.toLowerCase(), password: 'the new one here' });
  ok('the recovery code ROUND-TRIPS through a real request, lowercased', back.status === 200);
  ok('...and mints a NEW code', Boolean(back.body?.recoveryCode) && back.body.recoveryCode !== reg.recoveryCode);
  ok('...and signs the old devices out', (await post('/v1/auth/token', { secret: guest.secret })).status === 401);
} catch (e) {
  bad++;
  console.log(` FAIL  the probe could not finish - ${e?.message ?? e}`);
} finally {
  // THE WHOLE GROUP, not just npx: negative pid is the group. Without
  // this the workerd grandchild outlives the probe and holds the port.
  if (dev?.pid) {
    for (const sig of ['SIGTERM', 'SIGKILL']) {
      try { process.kill(-dev.pid, sig); } catch { /* already gone */ }
      await sleep(500);
    }
  }
  rmSync(tmp, { recursive: true, force: true });
  rmSync(STATE, { recursive: true, force: true });
}

console.log(`\n${checks - bad}/${checks} checks passed`);
process.exit(bad ? 1 : 0);
