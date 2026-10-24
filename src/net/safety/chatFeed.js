// @ts-check
// SAFE5 (2026-10-17, the chat safety plan, bible/11-Multiplayer/Chat-Safety-Arc.md section 6): THE REVIEWER'S FEED -
// the public channels' lines, carried from the relay to the account service, which has the reviewer read them.
//
// THE RELAY HAD NO DOOR TO THE SERVICE (identityToken.js: "The relay never reads D1, never talks to the account
// service"), and this is the one it now has, kept as narrow as a door can be:
//   - ONE WAY. The relay posts; the service answers nothing the relay reads but its status. No game rule waits on it.
//   - OFF UNTIL ASKED. The relay posts only while its MOD_FEED_URL is set (server/wrangler.toml); unset, nothing is
//     kept and nothing is sent.
//   - NEVER IN THE LINE'S PATH. A line is fanned first; the feed keeps a copy and posts a batch later, never awaited
//     by the chat. A post that fails is dropped - the reviewer is an assistant, and a line it missed is a line a
//     player can still report.
//   - THE PUBLIC TABS ALONE (chatStamp.js PUBLIC_TABS). Party, guild and a place's talk never ride it.
//   - SIGNED. The batch's bytes are signed with the relay's receipt key (GATE_SIGNING_KEY) and the service checks them
//     with its public half, so nobody but the relay can feed it lines.
//
// THE BATCH: {"v":"chat-feed1","id":<16 hex>,"at":<ms>,"lines":[{"tab","sub","name","at","text"}...]}, its signature
// over "chat-feed1\n" + the body's bytes in the FEED_SIG_HEADER header. A body the service has seen (`id`) is not read
// twice. AUDIT SAFE RELAY-13c: the tag was `f1` - the wild receipt's own (wildReceipt.js WILD_RECEIPT_V), kept apart by
// one byte; a word of its own while the feed was still unreleased (world214 never deployed), as chatStamp.js's.
//
// AUDIT SAFE RELAY-12: A ROOM'S BATCH IS FEED_BATCH LINES AT MOST - the relay posts the moment the FEED_BATCH-th line
// joins, and takes the lines before it awaits anything (server/src/index.js `_feedFlush`), so no batch it sends holds
// more. FEED_LINES_MAX is the SERVICE's bound on what it reads (`feedValid`), with room above the relay's own.
//
// Not a DFU member: Daggerfall Unity has no chat. Ledger A row (ONLINE).
import { _b64url, SIG_BYTES } from '../identityToken.js';
import { stampableLine, PUBLIC_TABS } from './chatStamp.js';

/** The only version this file writes or reads - AUDIT SAFE RELAY-13c: a word of its own, never a receipt's tag. */
export const FEED_V = 'chat-feed1';
/** The header the batch's signature rides. */
export const FEED_SIG_HEADER = 'x-relay-feed-sig';
/** A batch posts once this many lines wait... */
export const FEED_BATCH = 40;
/** ...or once its first line has waited this long, ms. */
export const FEED_WAIT_MS = 30_000;
/** The most lines a batch the service reads may carry. AUDIT SAFE RELAY-12: the relay's own batch is FEED_BATCH at most
 *  (it posts at that count), so this is the reader's wall, not a drop the relay makes - "a room that outruns its post
 *  drops its oldest" was a branch that could never run. */
export const FEED_LINES_MAX = 60;
/** The most bytes a batch's body may be - AUDIT SAFE RELAY-12: FEED_BATCH lines of the longest chat line (CHAT_MAX UTF-16
 *  units, three bytes each in UTF-8 at the most, with the longest name and account: about 1 KiB a line), and room. */
export const FEED_MAX_BYTES = 48 * 1024;
/** How old a batch may be when it arrives (ms) - a replayed old one is refused. */
export const FEED_AGE_MAX_MS = 10 * 60_000;
/** How long the relay waits on the service's answer, ms. */
export const FEED_POST_MS = 8_000;
const ID_HEX_RE = /^[0-9a-f]{16}$/;

const enc = new TextEncoder();

/** The bytes a batch's signature signs. @param {Uint8Array} body */
const signedBytes = (body) => {
  const head = enc.encode(`${FEED_V}\n`);
  const out = new Uint8Array(head.length + body.length);
  out.set(head, 0);
  out.set(body, head.length);
  return out;
};

/** Whether a parsed batch is one: its version, a 16-hex id, a clock, and 1 to FEED_LINES_MAX public, stampable lines. */
export function feedValid(b) {
  if (!b || typeof b !== 'object' || Array.isArray(b) || b.v !== FEED_V) return false;
  if (typeof b.id !== 'string' || !ID_HEX_RE.test(b.id) || !Number.isSafeInteger(b.at) || b.at <= 0) return false;
  if (!Array.isArray(b.lines) || !b.lines.length || b.lines.length > FEED_LINES_MAX) return false;
  return b.lines.every((l) => stampableLine(l) && PUBLIC_TABS.includes(l.tab));
}

/**
 * THE RELAY'S HALF: a batch's body and its signature, or null with no key (no key, no feed).
 * @param {{id: string, at: number, lines: {tab: string, sub: string, name: string, at: number, text: string}[]}} batch
 * @param {CryptoKey|null} privateKey @param {{subtle: SubtleCrypto}} env
 */
export async function sealFeed({ id, at, lines }, privateKey, { subtle }) {
  if (!privateKey) return null;
  const batch = { v: FEED_V, id, at, lines: lines.map(({ tab, sub, name, at: t, text }) => ({ tab, sub, name, at: t, text })) };
  if (!feedValid(batch)) return null;
  const body = enc.encode(JSON.stringify(batch));
  if (body.length > FEED_MAX_BYTES) return null;
  const sig = new Uint8Array(await subtle.sign({ name: 'Ed25519' }, privateKey, signedBytes(body)));
  return { body, sig: _b64url.encode(sig) };
}

/**
 * THE SERVICE'S HALF: the batch, when its signature holds and it is a batch, young enough - or `{ error }`. Never throws.
 * @param {Uint8Array} body @param {unknown} sig64 @param {CryptoKey|null} publicKey
 * @param {{subtle: SubtleCrypto, nowMs: number}} env
 */
export async function openFeed(body, sig64, publicKey, { subtle, nowMs }) {
  if (!publicKey) return { error: 'feed-closed' };
  if (!(body instanceof Uint8Array) || !body.length || body.length > FEED_MAX_BYTES) return { error: 'feed-shape' };
  const sig = typeof sig64 === 'string' ? _b64url.decode(sig64) : null;
  if (!sig || sig.length !== SIG_BYTES) return { error: 'feed-signature' };
  let good = false;
  try { good = await subtle.verify({ name: 'Ed25519' }, publicKey, sig, signedBytes(body)); } catch { good = false; }
  if (!good) return { error: 'feed-signature' };
  let batch;
  try { batch = JSON.parse(new TextDecoder().decode(body)); } catch { return { error: 'feed-shape' }; }
  if (!feedValid(batch)) return { error: 'feed-shape' };
  if (Math.abs(nowMs - batch.at) > FEED_AGE_MAX_MS) return { error: 'feed-stale' };
  return { ok: true, batch };
}
