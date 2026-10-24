// @ts-check
// EG-PLAY (2026-10-11, the Elite Gates arc; bible/11-Multiplayer/Elite-Gates.md section 23): THE ELITE BREACH'S RECEIPT -
// the relay's signature on what a breach gave a member, the Hour's and the gate's twin (net/superDungeon/sdReceipt.js,
// net/gate/gateReceipt.js).
//
//     e1.<base64url({ q, b, s, c, ... i, e })>.<base64url(64-byte Ed25519 signature)>
//         q its kind: 'w' a Redoubt taken, 'x' the member's end, 'v' a void (the stake given back)
//         b the breach (16 hex)   s the account (the identity sub)   z the open order's id (the stake it settles)
//         c the receipt's own seed (32 bits, the relay's CSPRNG - never the breach's)
//         w the Redoubt ('w')   h the hall ('w': its Court; 'x': the deepest cleared)   t seconds since the first wake
//         n the earning entrants   ew the start Redoubt   l the level the breach froze   rh 1 for a Rehearsal
//         why how the member's breach ended ('x' alone)   i issued, epoch seconds   e expires (i + EG_RECEIPT_TTL_S)
//         lk the Redoubt's lord, ft its feats ('w'; EG-E - net/eliteGates/egFeats.js: three bits)
//         vs the member's Vestiges ('w')   rl the Reliquaries its end opens ('x')   fl its falls   lb a Court felled alone
//         wg the breach's Wager decrees (both kinds - EG-E3: the end's too, for the boards)
//         an the pages of the Annals the breach gave the member ('x'; EG-E3 mints it, EG-E2 bounds it - a bitmask, bit p for net/eliteGates/egAnnals.js's page p)
//         td seconds from Hall 1's wake to the deepest hall's door ('x', once a hall is cleared - EG-ZA)
//         sh the member's share of the circle's damage, thousandths ('w')   m the circle's measures, six whole numbers ('w')
//         co the company: its entrants' count and a 48-bit tag of their accounts, sorted (both kinds - egCompanyTag)
//         nr 1 when the BREACH ended with no Redoubt taken ('x' alone - AUDIT EG III: the first breach's mercy is decided by it)
//
// EG-ZA (2026-10-12, Mac: "I said I want everything"; Elite-Gates.md sections 20, 21 and 23's table): THE FIELDS THE
// TABLE ASKED THAT NOTHING MINTED. `td` on the end (the Descent's seconds - the director kept it and said it only to the
// herald), `sh` and `m` on a Redoubt (the share dealt; THE FAIR TRAIL's measures, which rode no receipt), `co` on both.
// THE COMPANY'S PACKING: eight 40-character accounts are some 460 characters on the wire, and a worst-case Redoubt has
// about 170 to spare, so `co` is `[n, tag]` - the entrants' count and twelve hex of a 64-bit FNV-1a over their accounts
// sorted and comma-joined (egCompanyTag). Every member's receipt of one breach says the same tag, so the service groups
// a company by it (the Descent's rows - server-account/src/egHonours.js) without the receipt naming anyone else; it
// cannot list a member who never claimed, and the row names those who did.
//
// EG-E3 (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md section 23): THE BOUND IS THE
// MINT'S. Every reader refuses a receipt past EG_RECEIPT_MAX (readEgReceipt, verifyEgReceipt, the wire's `rcpt` -
// net/wire.js EG_RECEIPT_WIRE_MAX, the same 640), and a Redoubt's `w` with 32 Vestiges, a Wager, its lord and feats and a
// long account id passed it: the relay signed it and nobody could read it. The mint now holds every receipt inside it,
// trimming its optional lists oldest first - the Vestiges (`vs`), then the Reliquaries (`rl`) - and never a claim the
// service pays by (test/net/eliteGates/egeco_receipts.test.js: the worst case, every id at its longest).
//
// ONE KEY, NEVER CONFUSED: GATE_SIGNING_KEY signs it as it signs every relay receipt, and the version is inside the
// signed bytes, so `e1` is refused by every other verifier and theirs by this one. The kind rides `q` - never `k`, an
// identity's field (the page's table said `k`; EG-PLAY keeps the shapes disjoint).
//
// PURE, and all three ends import it. Not a DFU member. Ledger A (ELITE-GATES).
import { _b64url, SIG_BYTES, SKEW_S, ID_RE } from '../identityToken.js';

/** The only version this file reads or writes. */
export const EG_RECEIPT_V = 'e1';
/** How long a receipt may be carried to the account service: a week, the gate's own. */
export const EG_RECEIPT_TTL_S = 7 * 24 * 3600;
/** The bound on a receipt's length on the wire. */
export const EG_RECEIPT_MAX = 640;
/** The kinds, and how a member's breach may end. */
export const EG_RECEIPT_KINDS = Object.freeze(['w', 'x', 'v']);
// EG-E3: and the two the relay mints that the list lacked - a witness forsaking (net/eliteGates/egBrain.js egForsake) and THE SEAL
// (section 13.3, a good end) - whose receipts mintEgReceipt refused, so a forsaken member's stake and end were never said
export const EG_END_WHYS = Object.freeze(['fall', 'home', 'tear', 'wipe', 'last', 'empty', 'void', 'gone', 'rehearsal', 'forsake', 'seal']);
/** EG-E3: the optional lists the mint may trim to keep a receipt inside EG_RECEIPT_MAX, in the order it trims them -
 *  each oldest first (a Vestige is appended as it is taken, a Reliquary as its Redoubt falls). */
export const EG_RECEIPT_TRIMS = Object.freeze(['vs', 'rl']);
/** AUDIT EG IV (lane3 #7): the most Vestiges a Redoubt's receipt carries, and Reliquaries an end's (the mint's own slices -
 *  net/eliteGates/egBrain.js owe, oweEnd). */
export const EG_RECEIPT_LIST_MAX = 32;
export const EG_RECEIPT_RELS_MAX = 64;
/** EG-E2: the bound on an end's `an` - one bit a page, thirty pages (net/eliteGates/egAnnals.js EG_ANNALS). */
export const EG_ANNALS_BITS_MAX = 2 ** 30 - 1;
/** EG-ZA: a share's whole (`sh`, thousandths), a measure's bound (`m`, each of its EG_MEASURES), the company tag's hex. */
export const EG_SHARE_WHOLE = 1000;
export const EG_MEASURES = 6;
export const EG_MEASURE_MAX = 999_999;
export const EG_CO_TAG_HEX = 12;
const CO_TAG_RE = new RegExp(`^[0-9a-f]{${EG_CO_TAG_HEX}}$`);
const FNV64_OFFSET = 0xcbf29ce484222325n, FNV64_PRIME = 0x100000001b3n, U64 = (1n << 64n) - 1n;
/**
 * EG-ZA: THE COMPANY ON A RECEIPT (`co`) - `[n, tag]`: how many accounts, and the first EG_CO_TAG_HEX hex of a 64-bit
 * FNV-1a over them sorted and comma-joined (UTF-8). The same company says the same tag whatever its order. Pure.
 * @param {string[]} subs
 * @returns {[number, string]}
 */
export function egCompanyTag(subs) {
  let h = FNV64_OFFSET;
  for (const b of enc.encode([...subs].map(String).sort().join(','))) h = ((h ^ BigInt(b)) * FNV64_PRIME) & U64;
  return [subs.length, h.toString(16).padStart(16, '0').slice(0, EG_CO_TAG_HEX)];
}
/** Is `co` a company a receipt may carry - one to eight accounts and a tag? */
export const egCompanyValid = (/** @type {any} */ co) => Array.isArray(co) && co.length === 2 && int(co[0], 1, 8) && typeof co[1] === 'string' && CO_TAG_RE.test(co[1]);
/** Is `m` a breach's measures a receipt may carry - EG_MEASURES whole numbers, each 0..EG_MEASURE_MAX? */
export const egMeasuresValid = (/** @type {any} */ m) => Array.isArray(m) && m.length === EG_MEASURES && m.every((n) => int(n, 0, EG_MEASURE_MAX));
const enc = new TextEncoder();
const dec = new TextDecoder();
const BREACH_RE = /^[0-9a-f]{16}$/;
const ZID_RE = /^[a-z0-9]{16,32}$/;
const int = (v, lo, hi) => Number.isSafeInteger(v) && v >= lo && v <= hi;
/** A signed receipt's length for a body of `n` characters: `e1.` + the body + `.` + the signature's 86. */
const SIG64_LEN = Math.ceil((SIG_BYTES * 4) / 3);
const signedLen = (n) => EG_RECEIPT_V.length + 1 + n + 1 + SIG64_LEN;

/**
 * Everything a well-formed breach receipt's claims must be, before any signature is considered. Another signed shape's
 * fields are refused outright.
 * @param {any} c
 */
export function egReceiptValid(c) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return false;
  if (c.n0 !== undefined || c.k !== undefined || c.o !== undefined || c.d !== undefined || c.x !== undefined || c.r !== undefined || c.y !== undefined) return false;
  if (!EG_RECEIPT_KINDS.includes(c.q)) return false;
  if (typeof c.b !== 'string' || !BREACH_RE.test(c.b)) return false;
  if (typeof c.s !== 'string' || !ID_RE.test(c.s)) return false;
  if (typeof c.z !== 'string' || !ZID_RE.test(c.z)) return false;
  if (!Number.isSafeInteger(c.i) || !Number.isSafeInteger(c.e) || c.e <= c.i || c.e - c.i > EG_RECEIPT_TTL_S) return false;
  if (c.q === 'v') return Object.keys(c).every((f) => ['q', 'b', 's', 'z', 'i', 'e'].includes(f));
  if (!int(c.c, 0, 0xffffffff) || !int(c.h, 0, 99_999) || !int(c.t, 0, 7 * 24 * 3600) || !int(c.n, 0, 8) || !int(c.ew, 0, 999) || !int(c.l, 1, 999)) return false;
  if (c.rh !== undefined && c.rh !== 1) return false;
  // EG-E: a Redoubt's lord (`lk`) and its feats (`ft`, three bits - net/eliteGates/egFeats.js), where it says them
  if (c.lk !== undefined && (typeof c.lk !== 'string' || !/^[a-z]{1,16}$/.test(c.lk))) return false;
  if (c.ft !== undefined && !int(c.ft, 0, 7)) return false;
  // EG-E2: the pages of the Annals the member was given (`an`, bit p page p of net/eliteGates/egAnnals.js's thirty), an end's alone -
  // the account keeps them (server-account/src/egHonours.js, `players.eg_annals`)
  if (c.an !== undefined && (c.q !== 'x' || !int(c.an, 0, EG_ANNALS_BITS_MAX))) return false;
  // EG-ZA: the company (both kinds), the Descent's seconds (an end's), the share dealt and the measures (a Redoubt's)
  if (c.co !== undefined && !egCompanyValid(c.co)) return false;
  if (c.td !== undefined && (c.q !== 'x' || !int(c.td, 0, 7 * 24 * 3600))) return false;
  if (c.sh !== undefined && (c.q !== 'w' || !int(c.sh, 0, EG_SHARE_WHOLE))) return false;
  if (c.m !== undefined && (c.q !== 'w' || !egMeasuresValid(c.m))) return false;
  // AUDIT EG III (lane3 #6): an end's word that its breach ended with no Redoubt taken - 1 or absent, an end's alone
  if (c.nr !== undefined && (c.q !== 'x' || c.nr !== 1)) return false;
  // AUDIT EG IV (lane3 #7): EVERY FIELD ON ITS OWN KIND, AS THE MINT MAKES IT (net/eliteGates/egBrain.js owe, oweEnd) - the falls (`fl`,
  // a second fall is final), a Court felled alone (`lb`, a Redoubt's), the Vestiges (`vs`, a Redoubt's: `[id, rank]` pairs,
  // EG_RECEIPT_LIST_MAX), the Reliquaries (`rl`, an end's: the Redoubts they fell at, EG_RECEIPT_RELS_MAX), the Wager (`wg`,
  // at most three decrees) and a Redoubt's lord and feats (`lk`, `ft`); the service reads several of them (a wagered row,
  // the falls, the Lone Beacon), and every other shape was taken
  if (c.fl !== undefined && !int(c.fl, 0, 2)) return false;
  if (c.lb !== undefined && (c.q !== 'w' || c.lb !== 1)) return false;
  if (c.vs !== undefined && (c.q !== 'w' || !Array.isArray(c.vs) || c.vs.length > EG_RECEIPT_LIST_MAX || !c.vs.every((p) => Array.isArray(p) && p.length === 2 && int(p[0], 0, 99) && int(p[1], 1, 3)))) return false;
  if (c.rl !== undefined && (c.q !== 'x' || !Array.isArray(c.rl) || c.rl.length > EG_RECEIPT_RELS_MAX || !c.rl.every((w) => int(w, 1, 19_999)))) return false;
  if (c.wg !== undefined && (!Array.isArray(c.wg) || c.wg.length > 3 || !c.wg.every((d) => int(d, 0, 31)))) return false;
  if ((c.lk !== undefined || c.ft !== undefined) && c.q !== 'w') return false;
  if (c.q === 'w') return int(c.w, 1, 19_999) && c.why === undefined;
  return EG_END_WHYS.includes(c.why) && c.w === undefined;
}

/**
 * MINT - the relay's half. With no key the receipt goes out unsigned (`e1.<body>.`), and the service declines it.
 * @param {Record<string, any>} what the claims less `i` and `e`
 * @param {CryptoKey|null} privateKey an Ed25519 private key (net/gate/gateReceipt.js importReceiptKey), or null for none
 * @param {{subtle: SubtleCrypto, nowS: number}} env
 * @returns {Promise<string>}
 */
export async function mintEgReceipt(what, privateKey, { subtle, nowS }) {
  if (!Number.isSafeInteger(nowS)) throw new TypeError('mintEgReceipt needs an integer epoch-seconds clock');
  const claims = { ...what, i: nowS, e: nowS + EG_RECEIPT_TTL_S };
  if (!egReceiptValid(claims)) throw new TypeError('mintEgReceipt refused a claim set it could not verify');
  // EG-E3: THE BOUND - measured as the signed receipt's (an unsigned one trims alike), the lists trimmed oldest first
  let body = _b64url.encode(enc.encode(JSON.stringify(claims)));
  for (const k of EG_RECEIPT_TRIMS) {
    while (signedLen(body.length) > EG_RECEIPT_MAX && Array.isArray(claims[k]) && claims[k].length) {
      claims[k] = claims[k].slice(1);
      body = _b64url.encode(enc.encode(JSON.stringify(claims)));
    }
  }
  if (signedLen(body.length) > EG_RECEIPT_MAX) throw new TypeError('mintEgReceipt could not keep a receipt inside its bound');
  if (!privateKey) return `${EG_RECEIPT_V}.${body}.`;
  const sig = new Uint8Array(await subtle.sign({ name: 'Ed25519' }, privateKey, enc.encode(`${EG_RECEIPT_V}.${body}`)));
  return `${EG_RECEIPT_V}.${body}.${_b64url.encode(sig)}`;
}

/**
 * READ - the client's half: the claims of a receipt the relay handed this socket, signed or not, never a verdict on it.
 * Null for anything that is not a well-formed breach receipt.
 * @param {unknown} r
 */
export function readEgReceipt(r) {
  if (typeof r !== 'string' || r.length > EG_RECEIPT_MAX) return null;
  const parts = r.split('.');
  if (parts.length !== 3 || parts[0] !== EG_RECEIPT_V) return null;
  const raw = _b64url.decode(parts[1]);
  if (!raw) return null;
  let c;
  try { c = JSON.parse(dec.decode(raw)); } catch { return null; }
  return egReceiptValid(c) ? { ...c, signed: parts[2].length > 0 } : null;
}

/**
 * VERIFY - the account service's half. `{ ok: true, claims }` or `{ ok: false, why }`, never a throw: the gate's
 * verifier rung for rung (the version first, the signature before the content).
 * @param {unknown} r
 * @param {CryptoKey} publicKey the relay's Ed25519 public half
 * @param {{subtle: SubtleCrypto, nowS: number, skewS?: number}} env
 * @returns {Promise<{ok: true, claims: any} | {ok: false, why: string}>}
 */
export async function verifyEgReceipt(r, publicKey, { subtle, nowS, skewS = SKEW_S }) {
  if (typeof r !== 'string' || r.length > EG_RECEIPT_MAX) return { ok: false, why: 'shape' };
  const parts = r.split('.');
  if (parts.length !== 3) return { ok: false, why: 'shape' };
  const [v, body, sig64] = parts;
  if (v !== EG_RECEIPT_V) return { ok: false, why: 'version' };
  if (!sig64) return { ok: false, why: 'unsigned' };
  const sig = _b64url.decode(sig64);
  if (!sig || sig.length !== SIG_BYTES) return { ok: false, why: 'sig-shape' };
  const raw = _b64url.decode(body);
  if (!raw) return { ok: false, why: 'body-shape' };
  let good = false;
  try { good = await subtle.verify({ name: 'Ed25519' }, publicKey, sig, enc.encode(`${v}.${body}`)); } catch { return { ok: false, why: 'verify-threw' }; }
  if (!good) return { ok: false, why: 'signature' };
  let claims;
  try { claims = JSON.parse(dec.decode(raw)); } catch { return { ok: false, why: 'json' }; }
  if (!egReceiptValid(claims)) return { ok: false, why: 'claims' };
  if (!Number.isSafeInteger(nowS)) return { ok: false, why: 'clock' };
  if (nowS >= claims.e) return { ok: false, why: 'expired' };
  if (claims.i > nowS + skewS) return { ok: false, why: 'future' };
  return { ok: true, claims };
}
