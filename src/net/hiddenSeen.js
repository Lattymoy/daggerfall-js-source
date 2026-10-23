// @ts-check
// STAFF-PANEL5-HIDDEN (2026-10-22, mob: "true invis not lattys invis"; design doc "DFO Staff Panel: design", Invisible
// follow, and Weak spots: "entering a home is logged") - A HIDDEN STAFF SPECTATOR SEEN ENTERING A PRIVATE HOME, carried from
// the relay to the account service, which writes it in the staff audit log (server-account/src/staffHidden.js takeHiddenSeen).
//
// A hidden socket's subject is a staff session's, never an account's id (identityToken.js `hd`), so the relay cannot say
// WHO entered - only which hidden subject, and which room. The account service knows whose session minted that subject (and
// its own audit row of every hidden token minted says so too).
//
// THE DOOR IS THE GRANTS' MEASURE'S (net/grantMeasure.js), kept as narrow:
//   - ONE WAY. The relay posts; the hello never waits on the answer. A post that fails is dropped and said in the log.
//   - OFF UNTIL ASKED. The relay posts only while its HIDDEN_SEEN_URL is set (server/wrangler.toml) - and, while it is
//     not, lets no hidden socket into a private home at all (STAFF-PANEL5-HIDDEN-FIX: an entry is never unwritten).
//   - SIGNED with the relay's receipt key over "hidden-seen1\n" + the body's bytes, in HIDDEN_SEEN_SIG_HEADER; the
//     service checks it with the public half (GATE_PUBLIC_KEY).
//
// THE NOTE: {"v":"hidden-seen1","id":<16 hex>,"at":<ms>,"s":<hidden subject>,"r":<room>}
//
// PURE; the relay (server/src/staffHidden.js) and the service (server-account/src/staffHidden.js) import it. Not a DFU member.
import { _b64url, SIG_BYTES, ID_RE } from './identityToken.js';

/** The only version this file writes or reads - a word of its own, never a receipt's or a feed's. */
export const HIDDEN_SEEN_V = 'hidden-seen1';
/** The header the note's signature rides. */
export const HIDDEN_SEEN_SIG_HEADER = 'x-relay-seen-sig';
/** The account service's door for it - outside /v1/staff/, which needs a staff session (service.js STAFF_ROUTES). */
export const HIDDEN_SEEN_PATH = '/v1/mod/hidden-seen';
/** The most bytes a note may be. */
export const HIDDEN_SEEN_MAX_BYTES = 512;
/** How old a note may be when it arrives (ms) - a replayed old one is refused. */
export const HIDDEN_SEEN_AGE_MAX_MS = 10 * 60_000;
/** How long the relay waits on the service's answer, ms. */
export const HIDDEN_SEEN_POST_MS = 8_000;

const ID_HEX_RE = /^[0-9a-f]{16}$/;
const ROOM_RE = /^owned:[A-Za-z0-9_.,:+-]{1,80}$/;   // a private room's key (net/wire.js roomOf's own characters)

/** Whether a parsed note is one. Pure. @param {any} b */
export function hiddenSeenValid(b) {
  return !!b && typeof b === 'object' && !Array.isArray(b) && b.v === HIDDEN_SEEN_V && typeof b.id === 'string' && ID_HEX_RE.test(b.id)
    && Number.isSafeInteger(b.at) && b.at > 0 && typeof b.s === 'string' && ID_RE.test(b.s) && typeof b.r === 'string' && ROOM_RE.test(b.r)
    && Object.keys(b).length === 5;
}

const enc = new TextEncoder();
/** The bytes a note's signature signs. @param {Uint8Array} body */
const signedBytes = (body) => {
  const head = enc.encode(`${HIDDEN_SEEN_V}\n`);
  const out = new Uint8Array(head.length + body.length);
  out.set(head, 0);
  out.set(body, head.length);
  return out;
};

/**
 * THE RELAY'S HALF: a note's body and its signature, or null with no key or no note.
 * @param {any} note @param {CryptoKey|null} privateKey @param {{ subtle: SubtleCrypto }} env
 */
export async function sealHiddenSeen(note, privateKey, { subtle }) {
  if (!privateKey || !hiddenSeenValid(note)) return null;
  const body = enc.encode(JSON.stringify(note));
  if (body.length > HIDDEN_SEEN_MAX_BYTES) return null;
  const sig = new Uint8Array(await subtle.sign({ name: 'Ed25519' }, privateKey, signedBytes(body)));
  return { body, sig: _b64url.encode(sig) };
}

/**
 * THE SERVICE'S HALF: the note, when its signature holds and it is a note, young enough - or `{ error }`. Never throws.
 * @param {Uint8Array} body @param {unknown} sig64 @param {CryptoKey|null} publicKey @param {{ subtle: SubtleCrypto, nowMs: number }} env
 * @returns {Promise<{ ok: true, note: { v: string, id: string, at: number, s: string, r: string } } | { error: string }>}
 */
export async function openHiddenSeen(body, sig64, publicKey, { subtle, nowMs }) {
  if (!publicKey) return { error: 'seen-closed' };
  if (!(body instanceof Uint8Array) || !body.length || body.length > HIDDEN_SEEN_MAX_BYTES) return { error: 'seen-shape' };
  const sig = typeof sig64 === 'string' ? _b64url.decode(sig64) : null;
  if (!sig || sig.length !== SIG_BYTES) return { error: 'seen-signature' };
  let good = false;
  try { good = await subtle.verify({ name: 'Ed25519' }, publicKey, sig, signedBytes(body)); } catch { good = false; }
  if (!good) return { error: 'seen-signature' };
  let note;
  try { note = JSON.parse(new TextDecoder().decode(body)); } catch { return { error: 'seen-shape' }; }
  if (!hiddenSeenValid(note)) return { error: 'seen-shape' };
  if (Math.abs(nowMs - note.at) > HIDDEN_SEEN_AGE_MAX_MS) return { error: 'seen-stale' };
  return { ok: true, note };
}
