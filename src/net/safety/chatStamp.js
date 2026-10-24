// @ts-check
// SAFE2 (2026-10-17, Mac: "Lets do every single thing here. I want a full fledged future proof system" - the chat
// safety plan, bible/11-Multiplayer/Chat-Safety-Arc.md section 3): THE LINE'S WITNESS.
//
// A report is only as good as its evidence, and a player's own chat log is the player's word: a client can write any
// line it likes into its log and "report" it. So the relay - the one party that SAW the line, because it relayed it -
// signs every chat line it fans out, with the key it already signs its receipts with (GATE_SIGNING_KEY, gateReceipt.js):
//
//     sg = base64url(Ed25519( "chat-stamp1\n" + JSON.stringify([tab, sub, name, at, text]) ))
//         tab  the chat tab the line is heard on (stampTabOf: world, region, lang, trade, lfg, party, guild, local)
//         sub  the speaker's verified account (the token's `s`)   name the name the relay said beside it
//         at   the relay's clock, ms   text the line as the relay relayed it (sanitizeChat's, its words starred)
//
// The frame already carries every field but `tab` (the hearer knows which tab it heard the line on), so a stamp is
// the 86 characters of the signature and nothing else. A report carries the lines as heard with their stamps, and the
// account service (`verifyStamp`, with GATE_PUBLIC_KEY) believes a line only when its stamp holds: what the relay
// relayed, said by whom it says, when it says. A reporter can leave lines out - the context is theirs to choose - but
// cannot put words in anyone's mouth.
//
// THE WORDS ARE THE STARRED ONES. The relay signs what it relayed, which is what everyone read: TEXT-F1's mask has
// already starred a listed word. A moderator and the reviewer judge the line the room saw.
//
// A STAMP IS NEVER AN IDENTITY, AN ORDER OR A RECEIPT: it is a bare signature over bytes that begin `chat-stamp1\n`,
// which no token, order or receipt's signed bytes do (theirs begin `v1.`, `r1.`, `c1.` and the like), so no signature
// can be lifted from one to the other. AUDIT SAFE RELAY-13c: the tag was `c1` - the card receipt's own (cardReceipt.js
// CARD_RECEIPT_V), the two kept apart by one byte, `\n` against `.`. A word no receipt's one-letter tag can be, while
// the stamp was still unreleased (world214 never deployed); chatFeed.js's `f1` went the same way.
//
// UNSIGNED IS A REAL ANSWER, as a receipt's: a relay with no key relays its lines without `sg`, and a line without one
// cannot be reported (the client says so). Nothing else changes.
//
// PURE, and all three ends import it: the relay mints, the client carries, the account service verifies. `subtle` and
// the keys are arguments.
//
// Not a DFU member: Daggerfall Unity has no chat. Ledger A row (ONLINE).
import { _b64url, SIG_BYTES } from '../identityToken.js';
import { channelOf, isRegionBus } from '../hubShards.js';

/** The only version this file signs or reads - AUDIT SAFE RELAY-13c: a word of its own, never a receipt's tag. */
export const STAMP_V = 'chat-stamp1';
/** A stamp on the wire: a 64-byte signature, base64url without padding. */
export const STAMP_RE = /^[A-Za-z0-9_-]{86}$/;
/** The tabs a stamped line can be heard on - net/chat.js CHAT_TABS' ids, the same words. */
export const STAMP_TABS = Object.freeze(['world', 'region', 'lang', 'trade', 'lfg', 'party', 'guild', 'local']);
/** The tabs whose lines are said to everyone in a channel - the public ones, which the reviewer reads (chatFeed.js).
 *  Party, guild and a place's local talk are not: those reach a reviewer only in a report. */
export const PUBLIC_TABS = Object.freeze(['world', 'region', 'lang', 'trade', 'lfg']);

/**
 * THE TAB A LINE IS HEARD ON, from the room the relay said it in and its channel (`ch`, the hub's party and guild):
 * the hub's world, a region's, a language's, Trade's and LFG's channels each their own tab; every other room - a
 * place - its local talk. A shard is its channel's (hubShards.js channelOf), so the bus and the hearer agree.
 * @param {string} key the relay room's key @param {unknown} [ch]
 */
export function stampTabOf(key, ch) {
  if (ch === 'party' || ch === 'guild') return ch;
  const k = channelOf(String(key ?? ''));
  if (k === 'chat:world') return 'world';
  if (isRegionBus(k)) return 'region';
  if (k.startsWith('chat:lang.')) return 'lang';
  if (k === 'chat:trade') return 'trade';
  if (k === 'chat:lfg') return 'lfg';
  return 'local';
}

const enc = new TextEncoder();

/** The bytes a stamp signs - one byte string for one line.
 *  @param {{tab: string, sub: string, name: string, at: number, text: string}} line */
export const stampBytes = ({ tab, sub, name, at, text }) => enc.encode(`${STAMP_V}\n${JSON.stringify([tab, sub, name, at, text])}`);

/** Whether a line is one a stamp can be about: every field its type, the tab one of the tabs. */
export function stampableLine(l) {
  return !!l && typeof l === 'object' && STAMP_TABS.includes(l.tab) && typeof l.sub === 'string' && l.sub.length > 0 && l.sub.length <= 64
    && typeof l.name === 'string' && l.name.length <= 64 && Number.isSafeInteger(l.at) && l.at > 0 && typeof l.text === 'string' && l.text.length <= 512;
}

/**
 * MINT, the relay's half: the line's stamp, or '' with no key (the line goes out unstamped, and is unreportable).
 * @param {{tab: string, sub: string, name: string, at: number, text: string}} line
 * @param {CryptoKey|null} privateKey the relay's Ed25519 signing key (gateReceipt.js importReceiptKey), or null
 * @param {{subtle: SubtleCrypto}} env
 */
export async function mintStamp(line, privateKey, { subtle }) {
  if (!privateKey || !stampableLine(line)) return '';
  const sig = new Uint8Array(await subtle.sign({ name: 'Ed25519' }, privateKey, stampBytes(line)));
  return _b64url.encode(sig);
}

/**
 * VERIFY, the account service's half: whether `sg` is the relay's stamp on exactly this line. Never throws.
 * @param {{tab: string, sub: string, name: string, at: number, text: string}} line
 * @param {unknown} sg @param {CryptoKey} publicKey the relay's Ed25519 public half (GATE_PUBLIC_KEY)
 * @param {{subtle: SubtleCrypto}} env
 */
export async function verifyStamp(line, sg, publicKey, { subtle }) {
  if (!publicKey || typeof sg !== 'string' || !STAMP_RE.test(sg) || !stampableLine(line)) return false;
  const sig = _b64url.decode(sg);
  if (!sig || sig.length !== SIG_BYTES) return false;
  try { return await subtle.verify({ name: 'Ed25519' }, publicKey, sig, stampBytes(line)); } catch { return false; }
}
