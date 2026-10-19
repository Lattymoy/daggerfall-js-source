// DEV-ENV (2026-10-19, bible/01-Overview/Release-Flow.md): A MEMBER OF THE DEV NETWORK, MADE ON THEIR OWN MACHINE.
//
//   node tools/devPeer.mjs keys
//       a WireGuard key pair, both halves - the CI runner's: its private half is the `dev` environment's
//       DEV_WG_PRIVATE_KEY secret and its public half bootstrap.sh's CI_WG_PUBLIC_KEY (an admin makes it, once)
//   node tools/devPeer.mjs member --name <login> --ip 10.66.0.<3-250> --server-key <key> --endpoint <host:port> [--out <file>]
//       a member's key pair and WireGuard config, written to <file> (dfo-dev.conf by default) for their app to import,
//       readable by them alone; and the entry ops/dev/peers.json takes for them - their pull request adding it is the
//       request to join, a reviewer's approval the admission, and the next dev deploy lets them in
//
// The private half never leaves the machine it was made on: it is written into that config and nowhere else, never
// printed. A key made in the WireGuard app itself serves as well - the app shows its public half, which is all
// peers.json needs. WireGuard keys are X25519 keys in standard base64 - node's own crypto makes them.
//
// ops/dev/dfo-dev-root checks the whole list on the VM before it applies any of it, and is the one judge of it; the
// rules this checks a single member by are the same, held to it by test/tooling/releaseflow.test.js.
import { generateKeyPairSync, createPrivateKey, createPublicKey } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { isMain } from './lib/isMain.mjs';

/** A WireGuard key: 32 bytes, standard base64. */
export const WG_KEY_RE = /^[A-Za-z0-9+/]{42}[AEIMQUYcgkosw480]=$/;
/** A member's name: their GitHub login, or a service's own name. */
export const MEMBER_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,38}$/;
/** The network: this VM is .1, the CI runner .2, and the members .3 to .250. */
export const NETWORK = Object.freeze({ prefix: '10.66.0.', hub: '10.66.0.1', ci: '10.66.0.2', first: 3, last: 250 });

const b64 = (b64url) => Buffer.from(b64url, 'base64url').toString('base64');
/** PKCS#8's wrapping of a raw X25519 private key (RFC 8410). */
const PKCS8_X25519 = Buffer.from('302e020100300506032b656e04220420', 'hex');

/** A new key pair, both halves in WireGuard's spelling. */
export function wgKeyPair() {
  const { publicKey, privateKey } = generateKeyPairSync('x25519');
  return { privateKey: b64(privateKey.export({ format: 'jwk' }).d), publicKey: b64(publicKey.export({ format: 'jwk' }).x) };
}

/** The public half of a private key, as `wg pubkey` derives it. */
export function wgPublicOf(privateKey) {
  const raw = Buffer.from(privateKey, 'base64');
  if (!WG_KEY_RE.test(privateKey) || raw.length !== 32) throw new Error('no WireGuard private key');
  const key = createPrivateKey({ key: Buffer.concat([PKCS8_X25519, raw]), format: 'der', type: 'pkcs8' });
  return b64(createPublicKey(key).export({ format: 'jwk' }).x);
}

/** A member's address, or why it is none. */
export function memberIpProblem(ip) {
  const n = String(ip).startsWith(NETWORK.prefix) ? String(ip).slice(NETWORK.prefix.length) : '';
  if (!/^[1-9][0-9]{0,2}$/.test(n) || Number(n) < NETWORK.first || Number(n) > NETWORK.last) {
    return `${ip} is no member's address (${NETWORK.prefix}${NETWORK.first} to ${NETWORK.prefix}${NETWORK.last})`;
  }
  return null;
}

/** A member's WireGuard config: their key and address, the dev network through the VM, its DNS for the site's name. */
export function memberConfig({ privateKey, ip, serverKey, endpoint }) {
  return [
    '[Interface]', `PrivateKey = ${privateKey}`, `Address = ${ip}/32`, `DNS = ${NETWORK.hub}`, '',
    '[Peer]', `PublicKey = ${serverKey}`, `Endpoint = ${endpoint}`, `AllowedIPs = ${NETWORK.prefix}0/24`, 'PersistentKeepalive = 25', '',
  ].join('\n');
}

/** `--name value` pairs, read. */
function argsOf(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i].startsWith('--') || argv[i + 1] === undefined) throw new Error(`expected --name value pairs, at "${argv[i]}"`);
    out[argv[i].slice(2)] = argv[i + 1];
  }
  return out;
}

function main([cmd, ...rest]) {
  if (cmd === 'keys') {
    const { privateKey, publicKey } = wgKeyPair();
    console.log(`private (the dev environment's DEV_WG_PRIVATE_KEY secret - keep it nowhere else): ${privateKey}`);
    console.log(`public  (bootstrap.sh's CI_WG_PUBLIC_KEY): ${publicKey}`);
    return 0;
  }
  if (cmd === 'member') {
    const a = argsOf(rest);
    const problems = [
      MEMBER_NAME_RE.test(a.name ?? '') ? null : `--name "${a.name ?? ''}" is no member's name`,
      memberIpProblem(a.ip ?? ''),
      WG_KEY_RE.test(a['server-key'] ?? '') ? null : '--server-key is no WireGuard key (bootstrap.sh prints the VM\'s)',
      /^[A-Za-z0-9.-]+:\d{1,5}$/.test(a.endpoint ?? '') ? null : '--endpoint is no host:port (the VM\'s public address and 51820)',
    ].filter(Boolean);
    if (problems.length) {
      for (const p of problems) console.error(p);
      return 1;
    }
    const out = a.out ?? 'dfo-dev.conf';
    const { privateKey, publicKey } = wgKeyPair();
    writeFileSync(out, memberConfig({ privateKey, ip: a.ip, serverKey: a['server-key'], endpoint: a.endpoint }), { mode: 0o600, flag: 'wx' });
    console.log(`${out}: your WireGuard config - import it into the WireGuard app; it holds your private key, so it stays yours alone.`);
    console.log('Add this to ops/dev/peers.json by a pull request; the next dev deploy after its merge lets you in:');
    console.log(`  ${JSON.stringify({ name: a.name, key: publicKey, ip: a.ip })}`);
    return 0;
  }
  console.error('usage: devPeer.mjs keys | member --name <login> --ip 10.66.0.<n> --server-key <key> --endpoint <host:port> [--out <file>]');
  return 2;
}

if (isMain(import.meta.url)) process.exit(main(process.argv.slice(2)));
