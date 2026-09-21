// ACC1b: mint the identity signing pair.  ACC1-CI: ...and do it where
// no person is watching.
//
//   node tools/mintIdentityKeys.mjs          both halves, labelled, for a person
//   node tools/mintIdentityKeys.mjs --pipe   both halves, bare, one per line
//
// Prints and keeps nothing. NOTHING IS EVER WRITTEN TO DISK, and
// test/accountworker.test.js reads this file to keep it that way.
//
//   IDENTITY_PRIVATE_KEY  the account service's secret, base64 PKCS8.
//                         Goes in with `wrangler secret put`. NEVER
//                         into a file, a toml, or a command line that a
//                         shell will remember.
//   IDENTITY_PUBLIC_KEY   base64url raw, and NOT a secret - a public
//                         key can verify and cannot mint, which is the
//                         whole reason the relay is allowed to hold it.
//                         The service serves it openly at /v1/pubkey.
//
// ═══ WHY `--pipe` EXISTS, AND WHY IT EMITS BOTH HALVES AT ONCE ═════
//
// `.github/workflows/account-deploy.yml` mints the pair and pipes each
// half STRAIGHT INTO `wrangler secret put`, so no person ever sees the
// private one and no file ever holds it. Two things make that safe, and
// both are properties of this tool rather than of the workflow:
//
//   1. THE OUTPUT IS BARE. A run that has to `grep` a key out of a
//      banner puts the key in its own log the first time the banner
//      changes wording.
//   2. ONE RUN EMITS THE WHOLE PAIR. Calling this twice, once per half,
//      would mint two unrelated pairs and the service would sign with a
//      key its own /v1/pubkey disowns - an outage that looks exactly
//      like a forged token. There is deliberately no way to ask for one
//      half alone.
//
// Ed25519: 32 bytes of public key, 64 of signature. The private half is
// base64 PKCS8, which is the one format WebCrypto will import a private
// key from.
const { subtle } = globalThis.crypto;

const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);

const b64 = (buf) => Buffer.from(new Uint8Array(buf)).toString('base64');
const b64url = (buf) => Buffer.from(new Uint8Array(buf)).toString('base64url');

const priv = b64(await subtle.exportKey('pkcs8', kp.privateKey));
const pub = b64url(await subtle.exportKey('raw', kp.publicKey));

// PRIVATE FIRST, PUBLIC SECOND, one line each and nothing else on
// stdout - the order is the contract the workflow reads them in.
if (process.argv.includes('--pipe')) {
  process.stdout.write(`${priv}\n${pub}\n`);
  process.exit(0);
}

console.log('\n── IDENTITY_PRIVATE_KEY (secret - server-account) ──────────────\n');
console.log(priv);
console.log('\n── IDENTITY_PUBLIC_KEY (not secret - served at /v1/pubkey) ─────\n');
console.log(pub);
console.log(`\n(${pub.length}-char base64url public key; the private half is base64 PKCS8.)`);
console.log('Nothing was written to disk. If you lose the private half, mint a new pair');
console.log('and update both ends - every token signed by the old one stops verifying,');
console.log('which costs every player one reconnect and nothing else.\n');
