// @ts-check
// ═══════════════════════════════════════════════════════════════════
// ACC1c — THE PASSWORD, AND THE ONE WAY BACK IN.
//
// Mac (2026-09-21): "I want email completely optional. Username and
// Password will be the main thing for the account" — and, asked what a
// player does when they forget one: "Yes" to a recovery code.
//
// ═══ WHY A RECOVERY CODE EXISTS AT ALL ═════════════════════════════
//
// EMAIL OPTIONAL MEANS PASSWORD RESET IS IMPOSSIBLE. There is no
// address to send a link to and no second fact about the player the
// service holds, so a forgotten password would be a lost account - and
// with it the cloud saves, which are the only reason the account
// exists. A design whose failure mode is "your forty-hour character is
// gone" is not one to ship quietly.
//
// So a code is minted at registration, shown ONCE, and stored exactly
// as the password is: hashed, salted, and unreadable here. It is a
// credential and it is treated as one. Using it sets a new password AND
// MINTS A NEW CODE, because a player who spends their only way back in
// and is left with none has simply moved the same cliff one step away.
//
// ═══ WHAT THE HASHING IS AND WHY ═══════════════════════════════════
//
// PBKDF2-SHA256, because it is what WebCrypto gives a Worker. scrypt
// and argon2 are better and neither is available without shipping WASM
// into a hot path; that trade is recorded rather than pretended away.
// 210,000 iterations is OWASP's current figure for this exact pairing,
// and it measures ~35 ms, which the paid Workers CPU budget swallows
// without noticing (the relay's Durable Objects already require that
// plan, so there is no free-tier 10 ms ceiling to fear).
//
// THE STORED FORM IS SELF-DESCRIBING:
//
//   pbkdf2-sha256$<iterations>$<salt b64>$<derived b64>
//
// ...so the count can be raised in a year and every existing row still
// verifies under the count it was written with, then gets rewritten at
// the new one on its owner's next correct login. A bare hash column
// cannot be upgraded without logging everybody out.
//
// NFKC BEFORE ANYTHING. A password typed with a composed é on one
// machine and a decomposed one on another is the same password to the
// person typing it, and two different byte strings to a KDF. NIST says
// normalise; this normalises.
//
// PURE. `subtle` and `rand` are arguments, as everywhere in this arc,
// so node drives this exactly as a Worker does.
// ═══════════════════════════════════════════════════════════════════

/* global atob, btoa */

/** OWASP's current figure for PBKDF2-SHA256. Raise it, and old rows
 *  keep working - that is what the stored form is for. */
export const PBKDF2_ITERS = 210_000;
export const SALT_BYTES = 16;
export const DERIVED_BITS = 256;
export const ALG = 'pbkdf2-sha256';

/** NIST's advice, and no composition rules: length is the only thing
 *  that reliably buys entropy, and "must contain a symbol" buys
 *  `Password1!` a hundred million times over. The upper bound is here
 *  so a megabyte of "password" cannot cost a megabyte of KDF. */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 200;

const enc = new TextEncoder();
const b64 = (u) => { let s = ''; for (const b of u) s += String.fromCharCode(b); return btoa(s); };
const unb64 = (s) => {
  try {
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch { return null; }
};

/** Normalise the way the person typing it would expect, and no more.
 *  Leading and trailing spaces are KEPT: a space is a character in a
 *  password, and trimming one silently changes what somebody chose. */
export const normalise = (pw) => (typeof pw === 'string' ? pw.normalize('NFKC') : '');

/** Is this something a player may set? Length in CODE POINTS after
 *  normalising, because that is what a person counts. */
export function passwordRefusal(pw) {
  if (typeof pw !== 'string') return 'shape';
  const n = normalise(pw);
  const len = [...n].length;
  if (len < PASSWORD_MIN) return 'short';
  if (len > PASSWORD_MAX) return 'long';
  return null;
}

/**
 * CONSTANT-TIME EQUALITY over two byte arrays. Every byte of the longer
 * is read whichever way the comparison is going, so the time says
 * nothing about where the first difference was.
 *
 * Written out rather than taken from the platform on purpose: Cloudflare
 * offers `crypto.subtle.timingSafeEqual` and node does not, so a module
 * that used it could not be driven in node - and a security property
 * that is only exercised in production is not one anybody has checked.
 * A JS loop is not a guarantee at the CPU level, and it is enormously
 * better than `===` short-circuiting on the first byte.
 */
export function timingSafeEqual(a, b) {
  // ═══ AUDIT-PW P2: IT USED TO FAIL OPEN ═══════════════════════════
  //
  // Both arguments were COERCED to an empty array when they were not
  // byte arrays - so `timingSafeEqual(null, null)` was TRUE, and so was
  // `timingSafeEqual(undefined, {})`. Two lengths of 0 XOR to 0, the
  // loop does not run, and a function whose whole job is to say NO
  // says yes. Nothing reaches it that way today (verifyPassword is its
  // only caller and always hands it two real derivations), which is
  // exactly why it could sit there: a defensive coercion that defends
  // in the wrong direction, on the one primitive in this service that
  // must never guess.
  //
  // ANYTHING THAT IS NOT A PAIR OF BYTE ARRAYS IS NOT EQUAL.
  if (!(a instanceof Uint8Array) || !(b instanceof Uint8Array)) return false;
  const x = a; const y = b;
  let diff = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) diff |= (x[i % (x.length || 1)] ?? 0) ^ (y[i % (y.length || 1)] ?? 0);
  return diff === 0;
}

async function derive(pw, salt, iters, subtle) {
  const key = await subtle.importKey('raw', enc.encode(normalise(pw)), 'PBKDF2', false, ['deriveBits']);
  const bits = await subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iters }, key, DERIVED_BITS);
  return new Uint8Array(bits);
}

/** Hash a password (or a recovery code - it is the same kind of thing
 *  and gets the same treatment).
 *
 *  ═══ AUDIT-PW P1: IT REFUSES TO HASH NOTHING ════════════════════
 *
 *  `normalise` answers '' for anything that is not a string, and this
 *  is the one chokepoint every stored credential in this service goes
 *  through - so it is where the refusal belongs.
 *
 *  THE HOLE IT CLOSES IS NOT HYPOTHETICAL; this file's own note below
 *  records the day it was open. `codeForHashing` has TWO CONTRACTS: at
 *  the mint (accounts.js register/recover) a null is impossible, and at
 *  the check a null is the ordinary answer to a typo. Nothing enforced
 *  the first. So a minted code that failed to canonicalise - which is
 *  what the Q fold did to `7GEPQ-47BS9-AYK70-QMWYW` - hashed the EMPTY
 *  STRING into `recovery_hash`, and the check arm then compares
 *  `canon ?? ''` against it: EVERY account registered in that window is
 *  opened by typing any string that is not a code at all.
 *
 *  A password cannot reach here empty (`passwordRefusal` runs first at
 *  all three call sites and its floor is 8), so nothing legitimate is
 *  refused and the throw is a programming error rather than a player's.
 */
export async function hashPassword(pw, { subtle, rand }, iters = PBKDF2_ITERS) {
  if (!normalise(pw)) throw new Error('refusing to hash an empty credential - a caller handed this null or ""');
  const salt = new Uint8Array(SALT_BYTES);
  rand(salt);
  const out = await derive(pw, salt, iters, subtle);
  return `${ALG}$${iters}$${b64(salt)}$${b64(out)}`;
}

/** The stored string, taken apart. Answers null for anything that is
 *  not one - a row we cannot read is a row nobody can log in with, and
 *  that is a refusal rather than a throw. */
export function parseStored(stored) {
  if (typeof stored !== 'string') return null;
  const parts = stored.split('$');
  if (parts.length !== 4) return null;
  const [alg, itersS, saltS, hashS] = parts;
  if (alg !== ALG) return null;
  const iters = Number(itersS);
  if (!Number.isSafeInteger(iters) || iters < 1000 || iters > 10_000_000) return null;
  const salt = unb64(saltS); const hash = unb64(hashS);
  if (!salt || !hash || salt.length !== SALT_BYTES || hash.length !== DERIVED_BITS / 8) return null;
  return { alg, iters, salt, hash };
}

/**
 * VERIFY. Always does the work: a stored string that cannot be parsed
 * still costs a derivation against a throwaway salt, so "this account
 * has no password" and "this password is wrong" take the same time.
 */
export async function verifyPassword(pw, stored, { subtle }) {
  const parsed = parseStored(stored);
  const salt = parsed?.salt ?? new Uint8Array(SALT_BYTES);
  const iters = parsed?.iters ?? PBKDF2_ITERS;
  const got = await derive(pw, salt, iters, subtle);
  if (!parsed) return false;
  return timingSafeEqual(got, parsed.hash);
}

/** Should this row be rewritten at the current cost? True for an older
 *  iteration count - rewritten on the owner's next CORRECT login, which
 *  is the only moment the plaintext is in hand. */
export function needsRehash(stored, iters = PBKDF2_ITERS) {
  const parsed = parseStored(stored);
  return !parsed || parsed.iters < iters;
}

// ── THE RECOVERY CODE ───────────────────────────────────────────────

/** Crockford's alphabet: no I, L, O or U. The first three because a
 *  person reading their own handwriting cannot tell them from 1 and 0,
 *  and U because dropping it is how the alphabet avoids spelling
 *  things nobody wants printed on their screen. */
export const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
/** Four groups of five: 20 characters, 100 bits, and a shape a person
 *  can copy onto paper without losing their place. */
export const CODE_GROUPS = 4;
export const CODE_GROUP_LEN = 5;

/** What a code looks like when it is shown. */
export function mintRecoveryCode(rand) {
  const n = CODE_GROUPS * CODE_GROUP_LEN;
  const bytes = new Uint8Array(n * 2);
  rand(bytes);
  const chars = [];
  // rejection sampling again: 256 is not a multiple of 32... it is, so
  // every byte is usable and the mask is exact. Written as a mask
  // rather than a modulo so that stays true if the alphabet changes
  // size - a 32-character alphabet is 5 bits and nothing is discarded.
  const bits = Math.log2(CODE_ALPHABET.length);
  if (!Number.isInteger(bits)) throw new Error('the code alphabet must be a power of two, or the draw is biased');
  const mask = CODE_ALPHABET.length - 1;
  for (let i = 0; i < n; i++) chars.push(CODE_ALPHABET[bytes[i] & mask]);
  const out = [];
  for (let g = 0; g < CODE_GROUPS; g++) out.push(chars.slice(g * CODE_GROUP_LEN, (g + 1) * CODE_GROUP_LEN).join(''));
  return out.join('-');
}

/**
 * A code as the player typed it, made canonical. Upper-cased, groups
 * and spaces thrown away, and the look-alikes folded the way Crockford
 * says - because somebody WILL write down an O and type a zero, and
 * refusing them their own account over a serif is not a security
 * property.
 */
export function canonicalCode(input) {
  if (typeof input !== 'string') return null;
  // CROCKFORD'S ACTUAL FOLDING, and only it: O is a zero, I and L are
  // ones. NOTHING ELSE IS FOLDED.
  //
  // The first cut also folded Q to 0 and U to V, and it was wrong in a
  // way that would have locked people out of their own accounts: Q IS
  // IN THE ALPHABET, so a minted code carrying one canonicalised to a
  // DIFFERENT string than the one that was hashed. The very first code
  // this file ever printed - 7GEPQ-47BS9-AYK70-QMWYW - could not have
  // been used. U is excluded from the alphabet rather than folded, so a
  // U is simply not a character a code can contain and the check below
  // refuses it.
  const s = input.toUpperCase().replace(/[\s-]/g, '')
    .replace(/O/g, '0').replace(/[IL]/g, '1');
  if (s.length !== CODE_GROUPS * CODE_GROUP_LEN) return null;
  for (const c of s) if (!CODE_ALPHABET.includes(c)) return null;
  return s;
}

/** The form that is hashed and compared - never the pretty one, so a
 *  player who types it without the dashes still gets in. */
export const codeForHashing = (code) => canonicalCode(code);
