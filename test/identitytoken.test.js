// ACC1a - THE IDENTITY TOKEN (2026-09-21, Mac: "the account name would
// be used for online").
//
// The hole this closes exists TODAY: the hello carries a `name` the
// client wrote and wire.js only sanitises. These pins hold the thing
// that replaces it - a short-lived Ed25519 token the account service
// signs and the relay verifies, with no algorithm field for an attacker
// to choose and no repair anywhere in the verifier.
//
// EVERY ARM IS A REFUSAL, and that is the law: a token is the only
// evidence there is, so a token that is not exactly right is not
// evidence. The pins below drive REAL WebCrypto over a REAL key pair -
// a signature law verified against a stub is a law about the stub.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  TOKEN_V, MAX_TTL_S, SKEW_S, ACCOUNT_KINDS, PUBKEY_BYTES, SIG_BYTES, ID_RE,
  mintToken, verifyToken, claimsValid, nameIsIssuable,
  importPublicKey, importPublicKeyB64, _b64url,
} from '../src/net/identityToken.js';
import { sanitizeName, NAME_MAX } from '../src/net/wire.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const { subtle } = globalThis.crypto;
const NOW = 1_758_400_000;                       // a fixed clock; nothing here reads a real one
const WHO = { s: 'acct-abcdef123456', n: 'Nystul', k: 'linked' };

async function keys() {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  return kp;
}
const mint = (kp, who = WHO, over = {}) => mintToken(who, kp.privateKey, { subtle, nowS: NOW, ...over });

/** Sign arbitrary claims with a REAL key. This is how a test models a
 *  minter whose own constants differ from ours - the production minter
 *  keeps no loophole for it, because giving `mintToken` an override
 *  would be giving the greedy minter the very door this file refuses. */
async function handSign(kp, claims) {
  return handSignBytes(kp, new TextEncoder().encode(JSON.stringify(claims)));
}
/** ...and the same over RAW BYTES, for the one case a claims object
 *  cannot reach: a body that is correctly signed and is not JSON. */
async function handSignBytes(kp, bytes) {
  const body = _b64url.encode(bytes);
  const sig = new Uint8Array(await subtle.sign({ name: 'Ed25519' }, kp.privateKey,
    new TextEncoder().encode(`${TOKEN_V}.${body}`)));
  return `${TOKEN_V}.${body}.${_b64url.encode(sig)}`;
}
const check = (kp, token, over = {}) => verifyToken(token, kp.publicKey, { subtle, nowS: NOW, ...over });

test('ACC1a: a token the service signed verifies, and says exactly who it is for', async () => {
  const kp = await keys();
  const token = await mint(kp);
  const got = await check(kp, token);
  assert.equal(got.ok, true, got.why);
  assert.equal(got.claims.s, WHO.s);
  assert.equal(got.claims.n, WHO.n);
  assert.equal(got.claims.k, 'linked');
  assert.equal(got.claims.i, NOW);
  assert.equal(got.claims.e, NOW + MAX_TTL_S);

  // THE SHAPE IS THE CONTRACT: three parts, and the FIRST is the
  // version - which is the algorithm. A reader that does not know this
  // version stops before parsing a byte of the rest.
  const parts = token.split('.');
  assert.equal(parts.length, 3);
  assert.equal(parts[0], TOKEN_V);
  assert.equal(_b64url.decode(parts[2]).length, SIG_BYTES);

  // A GUEST GETS THE SAME TOKEN. One mechanism, and the relay cannot
  // tell them apart - the wall is at the saves, not here (ACC0).
  const guest = await check(kp, await mint(kp, { s: 'guest-0000aaaa', n: 'Ochre Fox', k: 'guest' }));
  assert.equal(guest.ok, true, guest.why);
  assert.equal(guest.claims.k, 'guest');
  assert.deepEqual([...ACCOUNT_KINDS].sort(), ['guest', 'linked']);
});

test('ACC1a: THERE IS NO ALGORITHM FIELD - the version prefix is the algorithm', async () => {
  // A JWT names its own algorithm in a header the verifier reads, which
  // is the root of the `alg: none` family: the attacker chooses how
  // their signature is checked. This format cannot have that bug, and
  // the pin holds the ABSENCE rather than trusting the comment.
  const kp = await keys();
  const token = await mint(kp);
  const claims = JSON.parse(new TextDecoder().decode(_b64url.decode(token.split('.')[1])));
  for (const forbidden of ['alg', 'typ', 'kid', 'crv', 'jwk']) {
    assert.ok(!(forbidden in claims), `the payload carries '${forbidden}', which is a say in how it is judged`);
  }
  assert.deepEqual(Object.keys(claims).sort(), ['e', 'i', 'k', 'n', 's']);

  // ...and the verifier never reads an algorithm from anywhere but its
  // own constant. Held at the source, because this is the one law a
  // fixture cannot demonstrate the absence of.
  const text = src('src/net/identityToken.js');
  const algs = [...text.matchAll(/name:\s*'([A-Za-z0-9-]+)'/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(algs)], ['Ed25519'], 'more than one algorithm is named in this file');

  // A TOKEN UNDER ANOTHER VERSION IS REFUSED, not guessed at.
  const [, body, sig] = token.split('.');
  assert.deepEqual(await check(kp, `v2.${body}.${sig}`), { ok: false, why: 'version' });
  assert.deepEqual(await check(kp, `.${body}.${sig}`), { ok: false, why: 'version' });
});

test('ACC1a: a token only verifies under the key that signed it, and a public key cannot mint', async () => {
  const mine = await keys();
  const theirs = await keys();
  const token = await mint(mine);
  assert.equal((await check(mine, token)).ok, true);
  assert.deepEqual(await check(theirs, token), { ok: false, why: 'signature' },
    'a token signed by anyone else is not a token');

  // THE RELAY HOLDS A PUBLIC KEY AND A PUBLIC KEY CANNOT SIGN. Held by
  // driving it, because "the relay cannot mint" is the whole reason the
  // relay is allowed to be the bigger attack surface.
  const raw = new Uint8Array(await subtle.exportKey('raw', mine.publicKey));
  assert.equal(raw.length, PUBKEY_BYTES);
  const imported = await importPublicKey(raw, { subtle });
  assert.ok(imported, 'a 32-byte raw key is the shape a relay carries');
  assert.deepEqual(imported.usages, ['verify'], 'imported for verify and nothing else');
  await assert.rejects(() => subtle.sign({ name: 'Ed25519' }, imported, new Uint8Array(1)),
    'the key the relay holds was able to sign');
  // ...and it verifies what its private half signed
  assert.equal((await verifyToken(token, imported, { subtle, nowS: NOW })).ok, true);

  // a key of the wrong size, or nonsense, is refused ONCE at boot
  // rather than throwing once per connection
  assert.equal(await importPublicKey(new Uint8Array(31), { subtle }), null);
  assert.equal(await importPublicKey(new Uint8Array(33), { subtle }), null);
  assert.equal(await importPublicKey(null, { subtle }), null);
  assert.equal(await importPublicKeyB64('not base64!!', { subtle }), null);
  assert.ok(await importPublicKeyB64(_b64url.encode(raw), { subtle }), 'the config shape imports');
});

test('ACC1a: ONE BYTE CHANGED ANYWHERE and the token is not a token', async () => {
  const kp = await keys();
  const token = await mint(kp);
  const [v, body, sig] = token.split('.');

  // the payload, re-signed by nobody: promote a guest, take a name,
  // become another account, live for a year
  const raw = JSON.parse(new TextDecoder().decode(_b64url.decode(body)));
  for (const tamper of [
    { ...raw, k: 'linked', s: 'somebody-elses-id' },
    { ...raw, n: 'Mac' },
    { ...raw, e: raw.i + 60 * 60 * 24 * 365 },
  ]) {
    const forged = _b64url.encode(new TextEncoder().encode(JSON.stringify(tamper)));
    assert.deepEqual(await check(kp, `${v}.${forged}.${sig}`), { ok: false, why: 'signature' },
      `a rewritten payload verified: ${JSON.stringify(tamper)}`);
  }

  // and the signature itself, bit by bit over its whole length
  const sigBytes = _b64url.decode(sig);
  for (const i of [0, 1, 31, 32, SIG_BYTES - 1]) {
    const bent = Uint8Array.from(sigBytes);
    bent[i] ^= 1;
    assert.deepEqual(await check(kp, `${v}.${body}.${_b64url.encode(bent)}`), { ok: false, why: 'signature' });
  }
});

test('ACC1a: the verifier NEVER throws, whatever it is handed', async () => {
  const kp = await keys();
  // A hello is an attacker's bytes. Every one of these is a refusal
  // with a reason, and not one of them is an exception that would take
  // the socket - or the room - down with it (ONCRASH1's whole lesson).
  const junk = [
    undefined, null, 0, 1, true, {}, [], () => {}, Symbol('x'),
    '', '.', '..', 'v1', 'v1.', 'v1..', 'v1.a', 'v1.a.b.c',
    'v1.!!!.@@@', `v1.${'A'.repeat(100)}.${'A'.repeat(86)}`,
    `v1.${_b64url.encode(new TextEncoder().encode('not json'))}.${'A'.repeat(86)}`,
    'v1.' + 'A'.repeat(2000) + '.' + 'A'.repeat(86),
  ];
  for (const bad of junk) {
    const got = await verifyToken(bad, kp.publicKey, { subtle, nowS: NOW });
    assert.equal(got.ok, false, `${String(bad)} was accepted`);
    assert.equal(typeof got.why, 'string');
    assert.ok(got.why.length > 0);
  }

  // AND THE ONE CASE THE JUNK ABOVE CANNOT REACH. The signature is
  // checked FIRST, so every malformed body in that list dies at
  // 'signature' and never touches the parser. A body that is CORRECTLY
  // SIGNED and is not JSON is the only way to get there - it means our
  // own minter shipped garbage, and the verifier must still refuse
  // rather than throw, because a throw out of a hello is ONCRASH1's
  // lesson: it does not end this socket, it ends the reader.
  for (const bytes of [
    new TextEncoder().encode('not json at all'),
    new TextEncoder().encode('{"s":'),
    new Uint8Array([0xff, 0xfe, 0xfd]),
  ]) {
    const signed = await handSignBytes(kp, bytes);
    const got = await verifyToken(signed, kp.publicKey, { subtle, nowS: NOW });
    assert.equal(got.ok, false, 'a signed non-JSON body was accepted');
    assert.equal(got.why, 'json', 'a signed non-JSON body threw instead of refusing');
  }
  // an EMPTY body is refused earlier and by its own name - an empty
  // payload is not a payload, and it never reaches the parser
  assert.deepEqual(await verifyToken(await handSignBytes(kp, new Uint8Array(0)), kp.publicKey, { subtle, nowS: NOW }),
    { ok: false, why: 'body-shape' });
  // a signed body that IS json but is not an object
  for (const notObj of ['"a string"', '42', 'null', 'true', '[1,2,3]']) {
    const signed = await handSignBytes(kp, new TextEncoder().encode(notObj));
    assert.deepEqual(await verifyToken(signed, kp.publicKey, { subtle, nowS: NOW }),
      { ok: false, why: 'claims' }, `a signed ${notObj} was read as a claim set`);
  }
  // an oversized token is refused on SHAPE, before any base64 or any
  // WebCrypto call - a megabyte of "signature" costs nothing
  assert.deepEqual(await verifyToken('v1.' + 'A'.repeat(4000) + '.x', kp.publicKey, { subtle, nowS: NOW }),
    { ok: false, why: 'shape' });
});

test('ACC1a: THE CLOCK - expired, not yet issued, and a lifetime the verifier never agreed to', async () => {
  const kp = await keys();
  const token = await mint(kp, WHO, { ttlS: 60 });

  assert.equal((await check(kp, token, { nowS: NOW + 59 })).ok, true, 'alive a second before it dies');
  assert.deepEqual(await check(kp, token, { nowS: NOW + 60 }), { ok: false, why: 'expired' },
    'the expiry is the moment it is dead, not the last moment it lives');
  assert.deepEqual(await check(kp, token, { nowS: NOW + 10_000 }), { ok: false, why: 'expired' });

  // A TOKEN FROM THE FUTURE is skew until it is a lie. Two Cloudflare
  // machines, so the allowance is small and bounded.
  assert.equal((await check(kp, token, { nowS: NOW - SKEW_S })).ok, true, 'inside the skew it is a clock, not a forgery');
  assert.deepEqual(await check(kp, token, { nowS: NOW - SKEW_S - 1 }), { ok: false, why: 'future' });

  // THE LIFETIME IS BOUNDED BY THE VERIFIER, not merely by the minter -
  // this is what a token stolen off a client is worth, and a future
  // slice that quietly raised the minter's own constant is refused
  // here. Driven with a minter that WAS allowed a long ttl.
  const long = await handSign(kp, { ...WHO, i: NOW, e: NOW + 60 * 60 * 24 });
  assert.deepEqual(await check(kp, long), { ok: false, why: 'claims' },
    'a day-long token passed a five-minute verifier');
  // ...and the PRODUCTION minter cannot even make one: it has no
  // override, so the greedy minter above had to be hand-signed
  await assert.rejects(() => mint(kp, WHO, { ttlS: 60 * 60 * 24 }), TypeError,
    'mintToken will sign a lifetime its own verifier would refuse');
  assert.ok(MAX_TTL_S <= 600, 'a token is spent once, on a hello - it does not need to cover a play session');

  // a verifier with no clock refuses rather than treating NaN as now
  assert.deepEqual(await check(kp, token, { nowS: NaN }), { ok: false, why: 'clock' });
  assert.deepEqual(await verifyToken(token, kp.publicKey, { subtle, nowS: undefined }), { ok: false, why: 'clock' });
});

test('ACC1a: THE NAME IS NOT SANITISED HERE - a name the wire would repair is refused instead', async () => {
  // wire.js's sanitizeName falls back to a safe string for a bad one,
  // which is right for a chat frame and WRONG for an identity: falling
  // back would silently rename a player to something the account
  // service never issued. So the law is asked as a QUESTION.
  assert.ok(nameIsIssuable('Nystul'));
  assert.ok(nameIsIssuable('A'.repeat(NAME_MAX)));
  assert.ok(!nameIsIssuable('A'.repeat(NAME_MAX + 1)), 'past the wire\'s own bound');
  assert.ok(!nameIsIssuable(''));
  assert.ok(!nameIsIssuable(' Nystul'), 'a name the wire would TRIM is not the name it would carry');
  assert.ok(!nameIsIssuable('Nystul\u0007'), 'a control character the wire would strip');
  assert.ok(!nameIsIssuable(null));
  assert.ok(!nameIsIssuable(42));

  // DERIVED FROM THE WIRE'S OWN LAW, not a second copy of it: whatever
  // sanitizeName does, an issuable name is a fixed point of it.
  for (const n of ['Nystul', ' spaced ', 'x'.repeat(40), 'ok name', '\u0000nul']) {
    assert.equal(nameIsIssuable(n), sanitizeName(n) === n && n.length > 0 && n.length <= NAME_MAX);
  }

  // and a signed token carrying one is REFUSED, not repaired - held by
  // signing it with a real key, so this is the verifier's answer and
  // not the minter's
  const kp = await keys();
  const got = await check(kp, await handSign(kp, { s: WHO.s, n: ' Nystul', k: 'linked', i: NOW, e: NOW + 60 }));
  assert.deepEqual(got, { ok: false, why: 'claims' },
    'a key of OURS signing a claim set we would not mint is a bug, and a bug is not an authorisation');
});

test('ACC1a: the minter refuses a claim set the verifier would have refused', async () => {
  // A token that cannot verify fails at the PLAYER'S machine, where the
  // only thing anyone learns is that online is broken. So it is refused
  // where the fix is.
  const kp = await keys();
  for (const who of [
    { s: 'abc', n: 'Nystul', k: 'linked' },                  // id too short
    { s: 'has spaces in it!!', n: 'Nystul', k: 'linked' },
    { s: WHO.s, n: ' Nystul', k: 'linked' },                 // a name the wire would trim
    { s: WHO.s, n: '', k: 'linked' },
    { s: WHO.s, n: 'Nystul', k: 'admin' },                   // a kind nobody defined
    { s: WHO.s, n: 'Nystul', k: undefined },
    {},
  ]) {
    await assert.rejects(() => mint(kp, who), TypeError, `minted ${JSON.stringify(who)}`);
  }
  await assert.rejects(() => mintToken(WHO, kp.privateKey, { subtle, nowS: 1.5 }), TypeError, 'a fractional clock');
  await assert.rejects(() => mintToken(WHO, kp.privateKey, { subtle, nowS: NaN }), TypeError);

  // THE ACCOUNT ID IS SOC1'S OWN SHAPE, so an id minted by the social
  // arc is an id this token can carry - ACC0's adoption, held here
  // rather than assumed. net/social.js keeps it under the same regex.
  assert.match(String(ID_RE), /A-Za-z0-9_-/);
  const soc = src('src/net/social.js');
  const socRe = /\/\^\[A-Za-z0-9_-\]\{4,40\}\$\//.exec(soc);
  assert.ok(socRe, 'net/social.js no longer keeps the account id under the shape this token carries');
  assert.equal(String(ID_RE), socRe[0], 'the two shapes have drifted - an existing account could not be adopted');

  // claimsValid is the one place the shape lives, and the minter and
  // the verifier both go through it
  assert.equal(claimsValid({ s: WHO.s, n: 'Nystul', k: 'guest', i: NOW, e: NOW + 1 }), true);
  assert.equal(claimsValid({ s: WHO.s, n: 'Nystul', k: 'guest', i: NOW, e: NOW }), false, 'born dead');
  assert.equal(claimsValid({ s: WHO.s, n: 'Nystul', k: 'guest', i: NOW, e: NOW - 1 }), false);
  assert.equal(claimsValid(null), false);
  assert.equal(claimsValid([]), false, 'an array is not a claim set');
  assert.equal(claimsValid('x'), false);
});

test('ACC1a: PURE, and both ends can import it', async () => {
  // The relay will import this file, which puts it in the worker's
  // bundle. It may reach for no global clock, no fetch, no storage and
  // no DOM - the same law server/src/relay.js lives under.
  const text = src('src/net/identityToken.js')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[ \t])\/\/[^\n]*/gm, '$1');
  for (const forbidden of [/\bDate\.now\b/, /\bfetch\b/, /\bdocument\b/, /\blocalStorage\b/, /\bprocess\b/,
    /\bglobalThis\.crypto\b/, /\brequire\(/]) {
    assert.doesNotMatch(text, forbidden, `identityToken.js reaches for ${forbidden}`);
  }
  // the clock and the crypto are ARGUMENTS, which is why node can drive
  // this file exactly as a Worker does
  assert.match(text, /nowS/);
  assert.match(text, /subtle/);
  // it imports the wire's name law and nothing else
  const imports = [...text.matchAll(/from\s+'(\.[^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(imports, ['./wire.js'], 'a new import here is a new file in the relay\'s bundle');
});

// ═══ ACC1d: THE TRIPWIRE FIRED, AND THIS IS WHAT REPLACED IT ═══════
//
// The gate this slice removed said, in its own failure message:
//
//   REPLACE THIS PIN with one that DRIVES it: present the same token
//   twice and prove the second is refused.
//
// It fired the moment `server/src/index.js` imported this module, which
// is the moment it was written for. What stands here now is the thing
// it was demanding: the relay's own `_named`, driven with a REAL key
// pair and a REAL token, twice.
//
// The room is not stood up - `_named` is a method on a big Durable
// Object and node has no workerd. It is driven the way this suite
// drives any pure-ish method: on a bare object carrying the two fields
// it reads (`env`, `_spent`), with WebCrypto doing the arithmetic for
// real. A stub signature would have proved something about the stub.
import { readFileSync as _rf } from 'node:fs';

/** `_named` lifted off the class, so node can call it without a
 *  Durable Object. Read from the SOURCE rather than copied, so the day
 *  the method changes this pin is driving the new one - a copy here
 *  would be a second implementation agreeing with itself. */
async function namedOf(room, m, now) {
  const text = _rf(new URL('../server/src/index.js', import.meta.url), 'utf8');
  const start = text.indexOf('  async _named(m, now) {');
  assert.ok(start > 0, 'server/src/index.js no longer has a _named - this pin is driving nothing');
  const end = text.indexOf('\n  }\n', start) + 4;
  const body = text.slice(start + '  async _named(m, now) {'.length, end - 4);
  // the two module-level names the method closes over
  const fn = new Function('m', 'now', 'verifyToken', 'importPublicKeyB64', 'MAX_TTL_S', 'SPENT_MAX', 'crypto', 'console',
    `return (async () => {${body}})()`);
  return fn.call(room, m, now, verifyToken, importPublicKeyB64, MAX_TTL_S, 4096, globalThis.crypto, console);
}

const roomWith = (pub) => ({ env: { IDENTITY_PUBLIC_KEY: pub }, _spent: new Map(), _verifyKey: undefined });

test('ACC1d/F8: A TOKEN IS SPENT ONCE - the same token presented twice is refused the second time', async () => {
  const kp = await keys();
  const pub = _b64url.encode(new Uint8Array(await subtle.exportKey("raw", kp.publicKey)));
  const token = await mint(kp);
  const room = roomWith(pub);
  const now = NOW * 1000;

  const first = await namedOf(room, { tok: token, name: 'anything' }, now);
  assert.equal(first.error, undefined, `the first presentation was refused: ${first.error}`);
  assert.equal(first.verified, true, 'the relay did not vouch for a token it just verified');
  // THE NAME COMES OUT OF THE TOKEN, and the frame's own is ignored -
  // that is the whole point of the seam.
  assert.equal(first.name, WHO.n);

  const second = await namedOf(room, { tok: token, name: 'anything' }, now);
  assert.equal(second.error, 'token spent', 'the same token was honoured twice');
  assert.equal(second.verified, undefined);
});

test('ACC1d: a hello with NO token is admitted with its own name, unvouched', async () => {
  const kp = await keys();
  const pub = _b64url.encode(new Uint8Array(await subtle.exportKey("raw", kp.publicKey)));
  const r = await namedOf(roomWith(pub), { name: 'Traveller' }, NOW * 1000);
  assert.deepEqual(r, { name: 'Traveller', verified: false },
    'a build from before this slice must connect exactly as it always did');
});

test('ACC1d: a relay with NO key vouches for nobody and refuses nobody', async () => {
  // The state a relay is in before its config carries a key, and the
  // state a mistyped one leaves it in. It must not pretend it checked,
  // and it must not take the room down.
  for (const pub of [undefined, '', 'not-a-key']) {
    const r = await namedOf(roomWith(pub), { tok: 'v1.aaa.bbb', name: 'Traveller' }, NOW * 1000);
    assert.deepEqual(r, { name: 'Traveller', verified: false }, `key ${JSON.stringify(pub)}`);
  }
});

test('ACC1d: a token that does not verify REFUSES the hello - it is never a quiet downgrade', async () => {
  const kp = await keys();
  const stranger = await keys();
  const pub = _b64url.encode(new Uint8Array(await subtle.exportKey("raw", kp.publicKey)));
  const now = NOW * 1000;

  // signed by somebody else's key
  const forged = await mint(stranger);
  const a = await namedOf(roomWith(pub), { tok: forged, name: 'Nystul' }, now);
  assert.match(a.error ?? '', /^token /, 'a token signed by a stranger was admitted');

  // expired: minted far enough back that `e` has passed
  const old = await mint(kp, WHO, { nowS: NOW - 10_000 });
  const b = await namedOf(roomWith(pub), { tok: old, name: 'Nystul' }, now);
  assert.match(b.error ?? '', /^token /, 'an expired token was admitted');

  // A DOWNGRADE WOULD BE THE BUG: admitting these as `verified: false`
  // would let a replay quietly succeed at exactly the level the
  // attacker wanted, and would drop an honest player to their typed
  // name with nothing on screen saying why.
  assert.equal(a.name, undefined);
  assert.equal(b.name, undefined);
});

test('ACC1d: the TTL ceiling is config, and config may only TIGHTEN the module\'s own', async () => {
  const kp = await keys();
  const pub = _b64url.encode(new Uint8Array(await subtle.exportKey("raw", kp.publicKey)));
  const now = NOW * 1000;
  const token = await mint(kp);   // minted at the module's full MAX_TTL_S

  // a relay that allows less than the token was minted for refuses it
  const tight = { env: { IDENTITY_PUBLIC_KEY: pub, IDENTITY_MAX_TTL_S: '5' }, _spent: new Map(), _verifyKey: undefined };
  const r = await namedOf(tight, { tok: token, name: 'x' }, now);
  assert.match(r.error ?? '', /^token /, 'a relay configured to 5s honoured a 300s token');

  // ...and one that asks for MORE than the module allows does not get it
  const loose = { env: { IDENTITY_PUBLIC_KEY: pub, IDENTITY_MAX_TTL_S: String(MAX_TTL_S * 100) }, _spent: new Map(), _verifyKey: undefined };
  const wide = await namedOf(loose, { tok: token, name: 'x' }, now);
  assert.equal(wide.verified, true, 'a sane token was refused under a generous config');
  const src2 = _rf(new URL('../server/src/index.js', import.meta.url), 'utf8');
  assert.match(src2, /Math\.min\(configured, MAX_TTL_S\)/,
    'config can widen the ceiling past the module\'s own, which is the door F8 asked to be shut');
});
