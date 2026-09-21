// ACC1b: mint the identity signing pair.
//
//   node tools/mintIdentityKeys.mjs
//
// Prints two things and keeps neither:
//
//   IDENTITY_PRIVATE_KEY  the account service's secret. Goes in with
//                         `npx wrangler secret put IDENTITY_PRIVATE_KEY`
//                         from server-account/. NEVER into a file, a
//                         toml, or a command line that a shell will
//                         remember.
//   IDENTITY_PUBLIC_KEY   the relay's config. NOT a secret - a public
//                         key can verify and cannot mint, which is the
//                         whole reason the relay is allowed to hold it.
//
// Ed25519: 32 bytes of public key, 64 of signature. The private half is
// printed as base64 PKCS8, which is the one format WebCrypto will
// import a private key from.
const { subtle } = globalThis.crypto;
const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);

const b64 = (buf) => Buffer.from(new Uint8Array(buf)).toString('base64');
const b64url = (buf) => Buffer.from(new Uint8Array(buf)).toString('base64url');

const priv = await subtle.exportKey('pkcs8', kp.privateKey);
const pub = await subtle.exportKey('raw', kp.publicKey);

console.log('\n── IDENTITY_PRIVATE_KEY (secret - server-account) ──────────────\n');
console.log(b64(priv));
console.log('\n── IDENTITY_PUBLIC_KEY (not secret - the relay\'s config) ───────\n');
console.log(b64url(pub));
console.log(`\n(${new Uint8Array(pub).length}-byte public key, base64url; the private half is base64 PKCS8.)`);
console.log('Nothing was written to disk. If you lose the private half, mint a new pair');
console.log('and update both ends - every token signed by the old one stops verifying,');
console.log('which costs every player one reconnect and nothing else.\n');
