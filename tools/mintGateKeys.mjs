// WB5b (2026-09-25): mint the Oblivion Gate's receipt pair - the relay's
// ONE signing key and the account service's half that verifies it.
//
//   node tools/mintGateKeys.mjs          both halves, labelled, for a person
//   node tools/mintGateKeys.mjs --pipe   both halves, bare, one per line
//
// Prints and keeps nothing. NOTHING IS EVER WRITTEN TO DISK, and
// test/wb5b_gate_claim.test.js reads this file to keep it that way.
//
//   GATE_SIGNING_KEY  the RELAY's secret, base64 PKCS8 - the key a kill
//                     receipt is signed with (src/net/gateReceipt.js).
//                     `npx wrangler secret put GATE_SIGNING_KEY` from
//                     server/. NEVER into a file, a toml, or a command
//                     line a shell will remember.
//   GATE_PUBLIC_KEY   base64url raw, and NOT a secret - it can verify a
//                     receipt and cannot sign one. It is the ACCOUNT
//                     SERVICE's (server-account/wrangler.toml [vars]),
//                     the one party that honours a receipt.
//
// THE MIRROR OF THE IDENTITY PAIR (tools/mintIdentityKeys.mjs): there the
// account service signs and the relay verifies; here the relay signs,
// because the relay is the one party that SAW the kill, and the account
// service verifies. Two pairs, two directions, and neither key can pass
// for the other: a receipt's `r1` is refused by the identity verifier
// before a byte is parsed, and a token's `v1` by the receipt's.
//
// ONE RUN EMITS THE WHOLE PAIR, for the identity tool's reason: calling
// this twice, once per half, mints two unrelated pairs, and every
// receipt the relay signs would be declined as forged. Replacing a pair
// costs only the receipts in flight - a claim of one signed by the old
// key is declined - and never a kill already recorded.
//
// Ed25519: 32 bytes of public key, 64 of signature. The private half is
// base64 PKCS8, the one format WebCrypto imports a private key from.
const { subtle } = globalThis.crypto;

const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);

const b64 = (buf) => Buffer.from(new Uint8Array(buf)).toString('base64');
const b64url = (buf) => Buffer.from(new Uint8Array(buf)).toString('base64url');

const priv = b64(await subtle.exportKey('pkcs8', kp.privateKey));
const pub = b64url(await subtle.exportKey('raw', kp.publicKey));

// PRIVATE FIRST, PUBLIC SECOND, one line each and nothing else on
// stdout - the order is the contract a pipe reads them in.
if (process.argv.includes('--pipe')) {
  process.stdout.write(`${priv}\n${pub}\n`);
  process.exit(0);
}

console.log('\n── GATE_SIGNING_KEY (secret - the RELAY: `npx wrangler secret put GATE_SIGNING_KEY` from server/) ──\n');
console.log(priv);
console.log('\n── GATE_PUBLIC_KEY (not secret - server-account/wrangler.toml [vars]) ──\n');
console.log(pub);
console.log(`\n(${pub.length}-char base64url public key; the private half is base64 PKCS8.)`);
console.log('Nothing was written to disk. Both halves are this one pair: set the private one on the relay and');
console.log('the public one on the account service, or every receipt is declined as forged.\n');
