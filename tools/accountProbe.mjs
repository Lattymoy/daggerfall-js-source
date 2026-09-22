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
//     PUBLISHES - the exact seam ACC1d will use, both ends live.
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
import { ACCOUNT_VERSION } from '../server-account/src/service.js';

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
  const [migBin, migArgs] = cmd(['d1', 'migrations', 'apply', 'daggerfall-accounts', '--local']);
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
  const [devBin, devArgs] = cmd(['dev', '--local', '--port', String(PORT), '--ip', '127.0.0.1', '--env-file', envFile]);
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
    { secret: guest.secret, handle: 'ProbeWalker', password: 'a good long one' })).body;
  const regMs = Date.now() - t0;
  ok('registering is an UPGRADE IN PLACE - the id does not change', Boolean(reg?.recoveryCode));
  const view = (await get('/v1/account', { bearer: guest.secret })).body;
  ok('...the same player id, now linked', view?.account?.id === guest.id && view?.account?.kind === 'linked');
  // TWO derivations (password + recovery code) plus D1 round trips.
  ok(`PBKDF2 at ${PBKDF2_ITERS} fits a Worker's CPU budget`, regMs < 10_000, `register took ${regMs}ms`);

  const good = await post('/v1/auth/login', { handle: 'probewalker', password: 'a good long one' });
  ok('a handle is case-insensitive on the way in', good.status === 200);
  const miss = await post('/v1/auth/login', { handle: 'nobody-holds-this', password: 'a good long one' });
  const wrong = await post('/v1/auth/login', { handle: 'ProbeWalker', password: 'not the password' });
  ok('a handle nobody holds and a wrong password refuse identically',
    miss.status === wrong.status && miss.body?.error === wrong.body?.error, miss.body?.error);

  const back = await post('/v1/auth/recover',
    { handle: 'ProbeWalker', code: reg.recoveryCode.toLowerCase(), password: 'the new one here' });
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
}

console.log(`\n${checks - bad}/${checks} checks passed`);
process.exit(bad ? 1 : 0);
