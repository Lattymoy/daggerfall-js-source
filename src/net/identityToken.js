// @ts-check
// ═══════════════════════════════════════════════════════════════════
// ACC1a — THE IDENTITY TOKEN: the one thing the relay is willing to
// believe about who a player is.
//
// Mac (2026-09-21): "the account name would be used for online."
//
// THE HOLE THIS CLOSES EXISTS TODAY. The hello is
// `{ t:'hello', id, secret, name, look, pose }` and THE CLIENT ASSERTS
// ITS OWN NAME - `wire.js` sanitises the string and has no idea whether
// it is yours. That is harmless while a name means nothing. The moment
// a name means "this is a linked account", a forged name is worth
// forging, and every name on the roster becomes a claim nobody checked.
//
// So the account service SIGNS a short-lived token and the relay
// VERIFIES it. The relay never reads D1, never talks to the account
// service, and holds no secret that could mint one - it holds a public
// key and checks a signature.
//
// ONE MECHANISM FOR BOTH ACCOUNT_KINDS OF PLAYER. A guest is issued a token
// too, carrying the generated name it did not choose. The relay cannot
// tell a guest from a linked account and does not need to: it is told a
// name it can trust, and the wall (ACC0 - cloud saves and nothing else)
// is enforced where the saves are, not here.
//
// ═══ WHY THIS IS NOT A JWT ═════════════════════════════════════════
//
// A JWT names its own algorithm in a header field the verifier reads,
// which is the root of the whole `alg: none` family of bugs - the
// attacker chooses how their signature is checked. THIS FORMAT HAS NO
// ALGORITHM FIELD. The version prefix IS the algorithm, the verifier
// knows exactly one version, and a token that does not open with it is
// refused before a byte of it is parsed. There is nothing in the
// payload that can change how the payload is judged.
//
//   v1.<base64url(payload JSON)>.<base64url(64-byte Ed25519 signature)>
//
// Ed25519 because it is the smallest thing that does this job: a 32-byte
// public key the relay can carry in its config, a 64-byte signature,
// one WebCrypto call to verify, and no curve or padding to choose
// wrongly.
//
// ═══ WHAT THE VERIFIER REFUSES ═════════════════════════════════════
//
// Every arm below is a refusal rather than a repair, and that is the
// law of this file: a token is the only evidence there is, so a token
// that is not exactly right is not evidence. In particular THE NAME IS
// NOT SANITISED HERE. `wire.js`'s `sanitizeName` falls back to a safe
// string for a bad one, which is right for a chat frame and wrong for
// an identity: falling back would silently rename a player and hand
// them a name the account service never issued. A token whose name does
// not ALREADY satisfy the wire's own law is refused, because that is a
// minting bug and the place to fix it is the handle endpoint - NAME-F2
// refuses at entry, and this checks that it did.
//
// PURE, and both ends import it. `subtle` and the key are arguments, so
// node drives it in a test exactly as a Worker drives it in production;
// it reaches for no global and no clock of its own.
//
// ═══ AUDIT-ACC F8: THIS TOKEN IS A BEARER CREDENTIAL, AND NOTHING ══
// ═══ HERE STOPS IT BEING REPLAYED. ACC1d MAKES IT ONE-SHOT. ════════
//
// What this file closes is FORGERY: nobody without the private key can
// invent a name. What it does not close, and what nothing in the arc
// had written down until the audit went looking, is REPLAY. There is no
// nonce, no audience, and no binding to a connection - so anyone who
// obtains a token can present it as that player until it expires.
//
// The exposure is bounded by MAX_TTL_S and by TLS, and the stakes today
// are a name on a roster. But "the only people who can take a name are
// the people who can be banned" (ACC0's wall) is weaker if a name can
// be BORROWED for five minutes.
//
// MAC DECIDED IT (2026-09-21, asked whether to close replay or accept
// the five-minute window: "Yes"). A TOKEN IS SPENT ONCE. The relay
// keeps the signatures it has seen and refuses a repeat; `e` bounds how
// long it must remember, so the set sweeps itself.
//
// IT IS CHEAP PRECISELY BECAUSE OF HOW THIS TOKEN IS USED: a client
// mints one per connection from its session secret, so nothing
// legitimate ever presents the same token twice. Rejected alternatives:
// a nonce claim needs shared state to check and buys nothing this does
// not, and binding to the socket is awkward over a WebSocket upgrade.
//
// AND THE TTL CEILING BELONGS IN THE RELAY'S CONFIG, beside the public
// key - not at a call site. The relay passes `maxTtlS` into
// `verifyToken`, so a relay that passes a generous one silently grants
// long-lived tokens, and a ceiling typed at the one call that happens
// to be in front of somebody is the second-home shape SLAM13 burned us
// on.
//
// ACC1d BUILT BOTH (2026-09-22), so the paragraphs above describe
// RUNNING CODE and not an intention. `server/src/index.js` `_named`
// verifies the token, keeps the signature for as long as `e` says the
// room must remember it, refuses a repeat, and takes the name out of
// the token; the ceiling is `IDENTITY_MAX_TTL_S` beside the public key
// in `server/wrangler.toml`, and config may only TIGHTEN `MAX_TTL_S`.
//
// AND THE HONEST BOUND, BECAUSE THE REFUSAL IS PER ROOM: a Durable
// Object is the only memory a hello can touch without becoming a global
// object every connection queues behind (ACC0 refused exactly that for
// provider links, and a hello is far hotter than a sign-in). So a token
// replayed into the SAME room is refused - that is where the victim is
// and where impersonation is worth doing - and one replayed into a
// different room, or after that room's object has been evicted, is not
// caught. bible ACC1d D4 says why the line sits there rather than
// claiming the window is shut.
//
// THIS COMMENT IS EXPENSIVE NOW. The module is in RELAY_GRAPH, so
// SLAM8 hashes its raw bytes: every edit here costs a RELAY_VERSION
// bump, and a bump on main deploys the relay and DROPS EVERY CONNECTED
// PLAYER. That is why the note above was written BEFORE the import
// landed - DEPLOY-PROSE's lesson, paid in advance for once - and why a
// correction from here on waits for a slice that is bumping anyway.
// ═══════════════════════════════════════════════════════════════════

/* global atob, btoa */
// HOST GLOBALS, declared the way ai/navmesh.js declares its own: base64
// is in every runtime this file has to run in - the browser, the Worker
// and node 22 - and in none of the shared globals lists, because this
// is the first module in src/net/ to need it.

import { sanitizeName, NAME_MAX } from './wire.js';

/** The only version this file will read or write. It names the
 *  algorithm, so the payload cannot. */
export const TOKEN_V = 'v1';

/** An Ed25519 public key and signature are fixed sizes; anything else
 *  is not one, and is refused before WebCrypto is asked. */
export const PUBKEY_BYTES = 32;
export const SIG_BYTES = 64;

/**
 * HOW LONG A TOKEN MAY LIVE, bounded by the VERIFIER and not merely by
 * the minter. `exp` alone says when this token dies; `MAX_TTL_S` says
 * no token may ever have been issued for longer than this, which is
 * what a token stolen off a client is worth. A minter that got greedy -
 * or a future slice that quietly raised its own constant - is refused
 * here rather than trusted.
 *
 * Five minutes is chosen against the thing it gates: a token is spent
 * ONCE, on a hello, and a connection outlives its token perfectly well
 * because the socket is the session from then on. It does not need to
 * cover a play session; it needs to cover the walk from "press Online"
 * to "socket open".
 */
export const MAX_TTL_S = 300;

/** A verifier's clock and a minter's clock are two machines. This is
 *  how far in the future an `iat` may sit before the token is read as a
 *  lie rather than as skew - small, because both ends are Cloudflare. */
export const SKEW_S = 30;

/** What kind of player the token speaks for. Named ACCOUNT_KINDS and
 *  not KINDS because `systems/features.js` already declares a KINDS -
 *  the one-home gate caught the collision the moment this file landed,
 *  and two unrelated things under one name is how a reader comes to
 *  believe they are one thing. The relay does not act on
 *  this; it is here so a host can say "link your account to keep these
 *  saves" without asking the account service a second question. */
export const ACCOUNT_KINDS = Object.freeze(['guest', 'linked']);

/* ═══ ACC3: WHAT A PLAYER WEARS, AND WHY IT RIDES THE TOKEN ═══════════
 *
 * Mac (2026-09-22): "Player titles appear above a player name... 1st
 * title is Founder with a gold color, 2nd title is Developer with a red
 * color", and "name glyphs... appear on the right side of the player
 * name".
 *
 * A TITLE A CLIENT COULD ASSERT IS A TITLE EVERY CLIENT HAS. This is
 * the same hole ACC1g just shut on the name, one field over: if the
 * hello carried `title: 'developer'` the relay could only sanitise it,
 * and the first person to open devtools would be a developer. So the
 * account service - the only thing that knows what a player was granted
 * - signs it into the token, and the relay reads it OUT of the token
 * exactly as it reads the name.
 *
 * AND IT COSTS NOTHING TO ADD NOW. Mac's own framing: "Next feature
 * before this becomes a live addition." The token module is in the
 * relay bundle, so a claim added here bumps RELAY_VERSION and drops
 * every connected player - but the deployed relay is world84 and both
 * world86 (ACC1g) and world87 (this) are still on the branch, so all
 * of it rides ONE drop rather than three. After that merge each would
 * cost its own.
 */

/** The titles that exist. A title is WORN one at a time, so a token
 *  carries at most one. Grants are the service's business (who HOLDS
 *  one); this list is the vocabulary both ends share. */
export const TITLES = Object.freeze(['founder', 'developer', 'dungeonmaster', 'disciple', 'apostle', 'hierophant']);   // TITLE-N (2026-09-24, Mac): the Dungeon Master, and the three Patreon tiers in their order

/** The glyphs that exist. A glyph is not worn, it is TRUE of a player -
 *  sprout is "this account is new", dev is "this is a developer", mod is
 *  "this is a moderator" (MOD1, Mac: "a moderator glyph") - so a token
 *  may carry several and a player chooses none of them. */
export const GLYPHS = Object.freeze(['sprout', 'dev', 'mod', 'dm', 'disciple', 'apostle', 'hierophant']);   // TITLE-N: each new title has its own glyph (Mac), true of whoever holds the title

/** The bound on `g`, and it is the vocabulary's own size rather than a
 *  number somebody picked: a token carrying more glyph slots than there
 *  are glyphs is a minter that got greedy or a body that got edited,
 *  and either way the verifier says no. */
export const GLYPHS_MAX = GLYPHS.length;

/** ADV1 (2026-09-24, Mac: "What if the leveling system was something
 *  seperate unique to online but compatible" ... "Plus having their level
 *  appear on the left side of character name"): THE ADVENTURING LEVEL'S
 *  CAP, and it lives HERE because the level rides the token (`lv`) and
 *  the relay stamps it beside the name, exactly as a title - so the
 *  verifier's bound is the vocabulary both ends share, and the curve that
 *  reaches it (src/net/advLevel.js) reads it from here. */
export const ADV_LEVEL_MAX = 50;

/** A level a token or an order may carry: a whole number from 1 to the cap. */
export const levelIssuable = (lv) => Number.isSafeInteger(lv) && lv >= 1 && lv <= ADV_LEVEL_MAX;

const enc = new TextEncoder();
const dec = new TextDecoder();

const b64urlFromBytes = (bytes) => {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const bytesFromB64url = (s) => {
  if (typeof s !== 'string' || !/^[A-Za-z0-9_-]+$/.test(s)) return null;
  let t = s.replace(/-/g, '+').replace(/_/g, '/');
  while (t.length % 4) t += '=';
  try {
    const bin = atob(t);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch { return null; }
};

/**
 * IS THIS A NAME THE ACCOUNT SERVICE COULD HAVE ISSUED? The wire's own
 * law, asked as a question instead of as a repair: `sanitizeName`
 * returns what it would have made of the string, and a name already fit
 * to travel is one it leaves alone. So the minter and the verifier
 * cannot drift - there is one law and this is it, asked from the other
 * side.
 * @param {unknown} name
 */
export function nameIsIssuable(name) {
  return typeof name === 'string' && name.length > 0 && name.length <= NAME_MAX
    && sanitizeName(name) === name;
}

/**
 * The claims, as they ride. Short keys because this travels in a hello
 * on every connection and the payload is base64 on top.
 * @typedef {{s: string, n: string, k: 'guest'|'linked', i: number, e: number, t?: string, g?: string[], mu?: number, lv?: number}} Claims
 *   s  the account id          n  the display name
 *   k  guest or linked         i  issued at, epoch seconds
 *   e  expires at, epoch seconds
 *   t  the title WORN, absent for none (ACC3)
 *   g  the glyphs TRUE of this player, absent for none (ACC3)
 *   mu muted until, epoch seconds, absent when not muted (MOD1)
 *   lv the Adventuring Level of the character the client named at the
 *      mint, absent when it named none (ADV1)
 */

/** The account id's own shape - the same one `net/social.js` already
 *  keeps in `dagger.online.account`, so an id minted by SOC1 is an id
 *  this token can carry (ACC0: the existing account is ADOPTED, never
 *  replaced). */
export const ID_RE = /^[A-Za-z0-9_-]{4,40}$/;

/** Everything a well-formed claim set must be, before any signature is
 *  considered. Split out so the minter can refuse to sign a bad one -
 *  a token that cannot verify is worse than no token, because it fails
 *  at the player's machine instead of at ours. */
export function claimsValid(c, { maxTtlS = MAX_TTL_S } = {}) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return false;
  if (typeof c.s !== 'string' || !ID_RE.test(c.s)) return false;
  if (!nameIsIssuable(c.n)) return false;
  if (!ACCOUNT_KINDS.includes(c.k)) return false;
  // ACC3: the two OPTIONAL claims, and optional means ABSENT rather
  // than null or '' - a token from a build before this slice has
  // neither, and a player who wears no title has no `t`. Present and
  // wrong is refused; present and right is the only other answer.
  if (c.t !== undefined && !TITLES.includes(c.t)) return false;
  if (c.g !== undefined) {
    if (!Array.isArray(c.g) || c.g.length > GLYPHS_MAX) return false;
    if (!c.g.every((g) => GLYPHS.includes(g))) return false;
    if (new Set(c.g).size !== c.g.length) return false;   // a repeat is a longer claim set saying one thing
  }
  // MOD1: THE MUTE RIDES THE SIGNATURE, like the name and the badge, so
  // a player cannot talk their way out of one by reconnecting - every
  // hello re-reads it off a claim the service signed. Absent when not
  // muted; present, it must END AFTER the token was issued, because a
  // mute that is already over is not a mute and the minter must not say
  // one is.
  if (c.mu !== undefined && (!Number.isSafeInteger(c.mu) || c.mu <= c.i)) return false;
  // ADV1: the level, optional the same way - absent from a token minted
  // without a character (an older build) - and within the cap when there.
  if (c.lv !== undefined && !levelIssuable(c.lv)) return false;
  if (!Number.isSafeInteger(c.i) || !Number.isSafeInteger(c.e)) return false;
  if (c.e <= c.i) return false;                 // a token that is born dead
  if (c.e - c.i > maxTtlS) return false;        // a minter that got greedy
  return true;
}

/**
 * MINT. The account service's half - it holds the private key and
 * nothing else does.
 *
 * @param {{s:string, n:string, k:'guest'|'linked', t?:string, g?:string[], mu?:number, lv?:number}} who
 * @param {CryptoKey} privateKey  an Ed25519 private key
 * @param {{subtle: SubtleCrypto, nowS: number, ttlS?: number}} env
 * @returns {Promise<string>}
 */
export async function mintToken(who, privateKey, { subtle, nowS, ttlS = MAX_TTL_S }) {
  if (!Number.isSafeInteger(nowS)) throw new TypeError('mintToken needs an integer epoch-seconds clock');
  // ACC3: `t` and `g` are written ONLY when there is something to say,
  // so a player with no title and no glyph mints the exact bytes this
  // minter has always minted.
  const claims = { s: who?.s, n: who?.n, k: who?.k, i: nowS, e: nowS + ttlS };
  if (who?.t !== undefined) claims.t = who.t;
  if (who?.g !== undefined && who.g.length) claims.g = who.g;
  if (who?.mu !== undefined) claims.mu = who.mu;   // MOD1: only while muted - an unmuted player mints the bytes they always did
  if (who?.lv !== undefined) claims.lv = who.lv;   // ADV1: only when the client named its character
  // A BAD CLAIM SET IS REFUSED AT THE MINTER. The verifier would refuse
  // it too, but at the player's machine, where the only thing anyone
  // learns is that online is broken.
  if (!claimsValid(claims)) throw new TypeError('mintToken refused a claim set it could not verify');
  return sealClaims(claims, privateKey, subtle);
}

/** Sign a claim set - the one place a signature is made, for an
 *  identity and for an order alike. */
async function sealClaims(claims, privateKey, subtle) {
  const body = b64urlFromBytes(enc.encode(JSON.stringify(claims)));
  const signed = enc.encode(`${TOKEN_V}.${body}`);
  const sig = new Uint8Array(await subtle.sign({ name: 'Ed25519' }, privateKey, signed));
  return `${TOKEN_V}.${body}.${b64urlFromBytes(sig)}`;
}

/**
 * VERIFY. The relay's half - it holds the public key, and a public key
 * cannot mint.
 *
 * Answers `{ ok: true, claims }` or `{ ok: false, why }`. NEVER throws
 * and never repairs: `why` is for a log at our end, not for the player,
 * and the caller's only correct response to `ok: false` is to treat the
 * connection as carrying no identity at all.
 *
 * @param {unknown} token
 * @param {CryptoKey} publicKey  an Ed25519 public key
 * @param {{subtle: SubtleCrypto, nowS: number, maxTtlS?: number, skewS?: number}} env
 * @returns {Promise<{ok: true, claims: Claims} | {ok: false, why: string}>}
 */
export async function verifyToken(token, publicKey, { subtle, nowS, maxTtlS = MAX_TTL_S, skewS = SKEW_S }) {
  return openSealed(token, publicKey, { subtle, nowS, skewS, valid: (c) => claimsValid(c, { maxTtlS }) });
}

/** The verifier's whole ladder, shared by an identity and an order so
 *  the two cannot come to check a signature differently. `valid` is
 *  the only thing that differs, and it is what keeps one kind from
 *  passing as the other.
 *  @param {unknown} token @param {CryptoKey} publicKey
 *  @param {{subtle: SubtleCrypto, nowS: number, skewS: number, valid: (c: any) => boolean}} env
 *  @returns {Promise<{ok: true, claims: any} | {ok: false, why: string}>} */
async function openSealed(token, publicKey, { subtle, nowS, skewS, valid }) {
  if (typeof token !== 'string' || token.length > 1024) return { ok: false, why: 'shape' };
  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, why: 'shape' };
  const [v, body, sig64] = parts;
  // THE VERSION IS READ BEFORE ANYTHING ELSE and it is the algorithm.
  // Nothing inside the payload gets a say in how the payload is judged.
  if (v !== TOKEN_V) return { ok: false, why: 'version' };

  const sig = bytesFromB64url(sig64);
  if (!sig || sig.length !== SIG_BYTES) return { ok: false, why: 'sig-shape' };
  const raw = bytesFromB64url(body);
  if (!raw) return { ok: false, why: 'body-shape' };

  // SIGNATURE FIRST, CONTENT SECOND. The claims are an attacker's bytes
  // until the signature says otherwise, so nothing is read off them -
  // not even a length - before this passes.
  let good = false;
  try {
    good = await subtle.verify({ name: 'Ed25519' }, publicKey, sig, enc.encode(`${v}.${body}`));
  } catch { return { ok: false, why: 'verify-threw' }; }
  if (!good) return { ok: false, why: 'signature' };

  let claims;
  try { claims = JSON.parse(dec.decode(raw)); } catch { return { ok: false, why: 'json' }; }
  // Signed, and still checked: a key of ours signing a claim set we
  // would not have minted means the minter has a bug, and a bug is not
  // an authorisation.
  if (!valid(claims)) return { ok: false, why: 'claims' };

  if (!Number.isSafeInteger(nowS)) return { ok: false, why: 'clock' };
  if (nowS >= claims.e) return { ok: false, why: 'expired' };
  if (claims.i > nowS + skewS) return { ok: false, why: 'future' };
  return { ok: true, claims };
}

/* ═══ MOD1: THE MUTE ORDER ══════════════════════════════════════════
 *
 * Mac: "moderator chat commands" - /mute and /unmute.
 *
 * A mute lands in two places. The ACCOUNT ROW is the truth (ACC0's own
 * `muted_until`), and every identity token minted afterwards carries it
 * as `mu`, so a reconnect cannot shed one. But a player already in a
 * room holds a token minted before the mute, and the relay cannot read
 * D1 - that is the seam's whole design. So the service also hands the
 * moderator an ORDER: the service's signature over "account s is muted
 * until mu", which any socket may carry to a room and the room checks
 * with the key it already holds. The relay never trusts WHO delivers it
 * (the moderator, today) - only who signed it.
 *
 * AN ORDER CAN NEVER PASS AS AN IDENTITY, NOR AN IDENTITY AS AN ORDER.
 * An identity needs an issuable `n`; an order must carry no `n` and must
 * carry `o`. One key signs both, so that split is the thing standing
 * between "a moderator muted you" and "you are now called that".
 */

/** What an order may say - a closed list, so a relay a build behind
 *  refuses a kind it does not know rather than guessing. ADV1 adds the
 *  second: 'level', an Adventuring Level that ROSE while its player was
 *  already in a room, carried in by that player's own client (the token
 *  that let them in said the level they had then). */
export const ORDER_KINDS = Object.freeze(['mute', 'level']);
/** An order lives a minute - long enough to be carried to every room
 *  the moderator holds, short enough that a leaked one is stale before
 *  anyone could use it for anything but what it already said. */
export const ORDER_TTL_S = 60;

/** `{o:'mute', s, mu, i, e}` - `mu` 0 is "unmuted" - or `{o:'level', s,
 *  lv, i, e}` (ADV1). Each kind carries its OWN field and never the
 *  other's, so a level order can never be read as a mute that says
 *  nothing, nor a mute as a level. */
export function orderValid(c) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return false;
  if (!ORDER_KINDS.includes(c.o)) return false;
  if (c.n !== undefined || c.k !== undefined) return false;   // an identity's fields: never on an order
  if (typeof c.s !== 'string' || !ID_RE.test(c.s)) return false;
  if (c.o === 'mute' && (!Number.isSafeInteger(c.mu) || c.mu < 0 || c.lv !== undefined)) return false;
  if (c.o === 'level' && (!levelIssuable(c.lv) || c.mu !== undefined)) return false;
  if (!Number.isSafeInteger(c.i) || !Number.isSafeInteger(c.e)) return false;
  if (c.e <= c.i || c.e - c.i > ORDER_TTL_S) return false;
  return true;
}

/** MINT AN ORDER - the account service's half, as `mintToken` is. */
export async function mintOrder({ s, mu }, privateKey, { subtle, nowS, ttlS = ORDER_TTL_S }) {
  if (!Number.isSafeInteger(nowS)) throw new TypeError('mintOrder needs an integer epoch-seconds clock');
  const claims = { o: 'mute', s, mu, i: nowS, e: nowS + ttlS };
  if (!orderValid(claims)) throw new TypeError('mintOrder refused an order it could not verify');
  return sealClaims(claims, privateKey, subtle);
}

/** ADV1: MINT A LEVEL ORDER - `lv` the Adventuring Level `s`'s character
 *  has now reached, signed by the service that derived it. */
export async function mintLevelOrder({ s, lv }, privateKey, { subtle, nowS, ttlS = ORDER_TTL_S }) {
  if (!Number.isSafeInteger(nowS)) throw new TypeError('mintLevelOrder needs an integer epoch-seconds clock');
  const claims = { o: 'level', s, lv, i: nowS, e: nowS + ttlS };
  if (!orderValid(claims)) throw new TypeError('mintLevelOrder refused an order it could not verify');
  return sealClaims(claims, privateKey, subtle);
}

/** VERIFY AN ORDER - the relay's half. Same ladder, same answers - and
 *  the KIND is the caller's to name (ADV1): a room's mute arm asks for a
 *  mute and its level arm for a level, so an order of one kind carried to
 *  the other's door is refused there, never read as something it is not. */
export async function verifyOrder(token, publicKey, { subtle, nowS, skewS = SKEW_S, kind }) {
  if (!ORDER_KINDS.includes(kind)) return { ok: false, why: 'kind' };
  return openSealed(token, publicKey, { subtle, nowS, skewS, valid: (c) => orderValid(c) && c.o === kind });
}

/** Import a raw 32-byte Ed25519 public key - the shape a relay carries
 *  in its config. Answers null rather than throwing, because a
 *  mis-pasted key is a deployment mistake that should be reported once
 *  at boot and not once per connection.
 *  @param {Uint8Array|ArrayBuffer} raw @param {{subtle: SubtleCrypto}} env */
export async function importPublicKey(raw, { subtle }) {
  if (!raw) return null;
  // COPIED, not borrowed: a caller that keeps hold of the array it
  // handed in cannot reach into the key afterwards, and the copy is a
  // plain ArrayBuffer view, which is the shape WebCrypto's own types
  // ask for.
  const bytes = new Uint8Array(raw instanceof Uint8Array ? raw : new Uint8Array(raw));
  if (bytes.length !== PUBKEY_BYTES) return null;
  try {
    return await subtle.importKey('raw', bytes, { name: 'Ed25519' }, false, ['verify']);
  } catch { return null; }
}

/** The same, from the base64url a config file would hold. */
export async function importPublicKeyB64(s, { subtle }) {
  const bytes = bytesFromB64url(String(s ?? ''));
  return bytes ? importPublicKey(bytes, { subtle }) : null;
}

export const _b64url = { encode: b64urlFromBytes, decode: bytesFromB64url };
