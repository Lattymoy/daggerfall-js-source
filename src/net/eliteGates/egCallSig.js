// @ts-check
// EG-F (2026-10-12, the Elite Gates arc, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md sections
// 6.3 and 23): THE HUB'S SIGNATURE ON THE CALL - what lets a stranger on the opener's world cell stand the arch.
//
// The hub says the call (`{t:'eg', k:'call', ...}`) to the company's sockets alone; the arch, though, is the WORLD's -
// everyone on the opener's cell should see it rise. The opener's client carries the call's arch fields on its foes frame
// (`ea`, scenes/eliteGates/egArch.js egArchWord) as a Portal Stone's portal rides it, and the relay reads none of it. So a stranger
// believes an arch only when the hub's signature `sg` over those fields verifies: no client can stand an arch under
// another's name, or move one, or keep one past its window.
//
//     sg = base64url(Ed25519(GATE_SIGNING_KEY, "ec1|" + b|os|o|op|ew|px|py|x|y|z|yaw))
//
// ONE KEY, NEVER CONFUSED: the relay's receipt key signs it (every relay receipt's - net/eliteGates/egReceipt.js), and the version
// `ec1` leads the signed bytes, so no receipt verifies as a call and no call as a receipt (a receipt's bytes begin with its
// own version and a '.'). The verifying half is the account service's GATE_PUBLIC_KEY, which it hands every signed-in
// client (`rk`, /v1/eg/keys). With no key the hub signs nothing (`sg` ''), and no stranger stands that arch - the company
// still hears its call from the hub itself.
//
// PURE; the relay (server/src/index.js) and the client import it. Not a DFU member. Ledger A (ELITE-GATES).
import { _b64url, SIG_BYTES } from '../identityToken.js';
import { EG_CALL_SG_RE } from '../wire.js';   // a signature's shape on the wire (64 bytes, base64url, unpadded) - the wire's own

/** The version leading the signed bytes. */
export const EG_CALL_SIG_V = 'ec1';
const enc = new TextEncoder();

/**
 * THE SIGNED BYTES: the call's arch fields in one fixed order - the breach, the opener (sub and name), the opening, the
 * start Redoubt and the arch's site. Pure.
 * @param {{ b: string, os: string, o: string, op: number, ew?: number, site: { px: number, py: number, x: number, y: number, z: number, yaw: number } }} c
 */
export function egCallBytes(c) {
  const s = c.site;
  return `${EG_CALL_SIG_V}|${c.b}|${c.os}|${c.o}|${c.op}|${c.ew ?? 0}|${s.px}|${s.py}|${s.x}|${s.y}|${s.z}|${s.yaw}`;
}

/**
 * SIGN - the hub's half: `sg`, or '' with no key (a relay built without GATE_SIGNING_KEY).
 * @param {Parameters<typeof egCallBytes>[0]} c @param {CryptoKey|null} privateKey @param {{ subtle: SubtleCrypto }} env
 */
export async function signEgCall(c, privateKey, { subtle }) {
  if (!privateKey) return '';
  const sig = new Uint8Array(await subtle.sign({ name: 'Ed25519' }, privateKey, enc.encode(egCallBytes(c))));
  return _b64url.encode(sig);
}

/**
 * VERIFY - a peer's half: whether `c.sg` is the hub's signature over `c`'s arch fields. Never throws.
 * @param {Parameters<typeof egCallBytes>[0] & { sg?: string }} c @param {CryptoKey|null} publicKey @param {{ subtle: SubtleCrypto }} env
 */
export async function verifyEgCall(c, publicKey, { subtle }) {
  if (!publicKey || !c || typeof c.sg !== 'string' || !EG_CALL_SG_RE.test(c.sg) || !c.site) return false;
  const sig = _b64url.decode(c.sg);
  if (!sig || sig.length !== SIG_BYTES) return false;
  try { return await subtle.verify({ name: 'Ed25519' }, publicKey, sig, enc.encode(egCallBytes(c))); } catch { return false; }
}
