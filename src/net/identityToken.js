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
import { GUILD_ID_RE, GUILD_TAG_RE, GUILD_MEMBER_RE } from './guildLaw.js';   // GUILD1c: a guild rides the token - the law's own three shapes
import { ribbonClaimOk } from './heraldryLaw.js';   // SEASON1 part two: a Season's banner ribbon - heraldryLaw.js imports nothing, so the worker's graph stays flat
import { worksOf } from './siegeRef.js';   // SEAT2b part two (b): a siege's works on its pass - siegeRef.js imports nothing

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
export const TITLES = Object.freeze(['founder', 'developer', 'dungeonmaster', 'disciple', 'apostle', 'hierophant', 'shadowfang', 'penitent', 'gatebreaker', 'herald', 'warden', 'protector', 'crowned', 'keeper', 'champion', 'grandchampion', 'arenachampion', 'aegis', 'primarch']);   // PRIMARCH (2026-10-04, GA00250: "the title will be Primarch"): GA00250's own, last; AEGIS (2026-10-03, the owner: "For the account named Sureme ... a title, glyph and new custom aura for this user. Title: Aegis of Oblivion. Theme: Purple"): Sureme's own, last;   // ARENA4 (2026-10-02, Mac: "Being a top rank PvE fighter comes with it's own title. Being the #1 pvp arena player comes with it's own temporary title/glyph"): the Grand Champion (the ladder's tenth tier's champion beaten, relay-refereed - for good) and the Arena Champion (the season's #1 of the refereed board - while they are #1), both derived at the mint (server-account/src/titles.js, the row's `arena`), last;   // HERALD (2026-10-01, Mac: "Herald doesnt exist ingame yet" - "you'll need to develop the herald title/glyph"): the Patreon tier between Disciple and Hierophant, after the Gatebreaker (the seats' five after it, SEAT1c); TITLE-N (2026-09-24, Mac): the Dungeon Master, and the three Patreon tiers in their order; SHADOW-FANG (2026-09-26, Mac): SirMcMobdon's own; PENITENT (2026-09-29, Mac): Diggleborf's own; WB9g (2026-09-30, Mac: "a brand new title to the broker"): the Gatebreaker, bought with Sigil Stones (net/insignia.js)

/** SEAT1c (2026-09-30, Mac: "Finish the seats"; Seats-Arc 7.4): THE SEATS' TITLES - five GENERIC ids, because a town's
 *  or a Season's name cannot be a closed list's word: "Warden of <Town>" (a palace seat's guildmaster), "Protector of
 *  <Kingdom>" (a crown's), "Crowned in Season N", "Keeper of <Town>, Season N" (kept for good, SEASON1) and the Royal
 *  Tourney's champion (CROWN1). Each rides with a bounded claim beside it - `ts`: [the seat key, the Season] - from
 *  which the client words it. Reaching the relay once, here, before the service mints any (the SHADOW-FANG order). */
export const SEAT_TITLES = Object.freeze(['warden', 'protector', 'crowned', 'keeper', 'champion']);
/** SEAT1c: whether `ts` is a seat title's claim - [seat key (a map id, unsigned 32), Season (0-9999)]. */
export const seatTitleClaimOk = (ts) => Array.isArray(ts) && ts.length === 2 && Number.isSafeInteger(ts[0]) && ts[0] >= 0 && ts[0] <= 0xffffffff
  && Number.isSafeInteger(ts[1]) && ts[1] >= 0 && ts[1] <= 9999;

/** WB9g (2026-09-30, Mac: "a new addition (the aura), an animated burning ground aura that circles the ground where
 *  your character stands. These items should be expensive and sought after"): THE AURAS THAT EXIST. An aura is WORN,
 *  one at a time, as a title is - so a token carries at most one (`au`) - and it is signed for the same reason a title
 *  is: a fire at a player's feet that a client could assert is a fire every client has. Holding one is the service's
 *  business (the Broker's insignia, bought - net/insignia.js; or, since AEGIS, granted by name beside its title -
 *  server-account/src/titles.js TIER_AURA: the Oblivion Ward, since PRIMARCH the Golden Radiance and since SHADOW-CLOAK
 *  the Holo Shadow Cloak; since SERAPH-WINGS, the developers' Seraph Wings - titles.js DEVELOPER_AURA); this list is the
 *  vocabulary both ends share. */
export const AURAS = Object.freeze(['dagonfire', 'oblivionward', 'radiance', 'shadowcloak', 'seraphwings']);   // SERAPH-WINGS (2026-10-05, Mac: "I want to build an aura for the developers ... Golden Angel wings that flow"): the Seraph Wings.    // SHADOW-CLOAK (2026-10-04, the owner, for SirMcMobdon: "A holo shadow cloak with red accents"): the Holo Shadow Cloak - the Shadow Fang's own hooded cloak of shadow and crimson light, granted with its title by name, never sold; PRIMARCH (2026-10-04, GA00250: "can the aura be a golden light around the character?"): the Golden Radiance - the Primarch's own column of golden light about the body, granted with its title by name, never sold; AEGIS (2026-10-03): the Oblivion Ward - the Aegis of Oblivion's own ring of runes, granted with its title by name (server-account/src/titles.js TIER_AURA), never sold

/** The glyphs that exist. A glyph is not worn, it is TRUE of a player -
 *  sprout is "this account is new", dev is "this is a developer", mod is
 *  "this is a moderator" (MOD1, Mac: "a moderator glyph") - so a token
 *  may carry several and a player chooses none of them. */
export const GLYPHS = Object.freeze(['sprout', 'dev', 'mod', 'dm', 'disciple', 'apostle', 'hierophant', 'shadowfang', 'penitent', 'herald', 'tower', 'crownDF', 'crownWR', 'crownSN', 'laurel', 'aegis', 'primarch']);   // PRIMARCH: the primarch - GA00250's three-barred cross, last;   // AEGIS: the aegis - three pillars through a ring over the void's tendrils, Sureme's reference, last;   // ARENA4: the laurel - the Arena Champion's wreath, true of the season's #1 while they hold the top, last;   // HERALD: the herald's trumpet and its banner, after the penitent's; SEAT1c (Seats-Arc 7.4): a seat's - `tower` every member of a guild holding a palace seat, a crown in its kingdom's metal every member of a crown's   // TITLE-N: each new title has its own glyph (Mac), true of whoever holds the title; SHADOW-FANG: the wolf's head, and the werewolf's skin rides it; PENITENT: the sword in its lozenge

/** The bound on `g`, and it is the vocabulary's own size rather than a
 *  number somebody picked: a token carrying more glyph slots than there
 *  are glyphs is a minter that got greedy or a body that got edited,
 *  and either way the verifier says no. */
export const GLYPHS_MAX = GLYPHS.length;

/** RENOWN1 (2026-09-24, Mac: "What if the leveling system was something
 *  seperate unique to online but compatible" ... "Plus having their level
 *  appear on the left side of character name"): THE RENOWN'S
 *  CAP, and it lives HERE because the level rides the token (`lv`) and
 *  the relay stamps it beside the name, exactly as a title - so the
 *  verifier's bound is the vocabulary both ends share, and the curve that
 *  reaches it (src/net/renown.js) reads it from here. */
export const RENOWN_MAX = 50;

/** A level a token or an order may carry: a whole number from 1 to the cap. */
export const renownIssuable = (lv) => Number.isSafeInteger(lv) && lv >= 1 && lv <= RENOWN_MAX;

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
 * @typedef {{s: string, n: string, k: 'guest'|'linked', i: number, e: number, t?: string, g?: string[], mu?: number, lv?: number, gi?: string, gt?: string, gm?: string, rc?: 0|1, au?: string, ar?: number, cl?: number}} Claims
 *   s  the account id          n  the display name
 *   k  guest or linked         i  issued at, epoch seconds
 *   e  expires at, epoch seconds
 *   t  the title WORN, absent for none (ACC3)
 *   g  the glyphs TRUE of this player, absent for none (ACC3)
 *   mu muted until, epoch seconds, absent when not muted (MOD1)
 *   lv the Renown of the character the client named at the
 *      mint, absent when it named none (RENOWN1)
 *   gi gt gm  that character's guild - its id, its tag and its
 *      member row - all three or none (GUILD1c)
 *   rc 1 when the character the client named at the mint is one of
 *      the account's realm characters, else 0; absent from a service
 *      before REALM-DOOR (the relay refuses a 0)
 *   au the aura WORN, absent for none (WB9g)
 *   gx the glyphs the player has TAKEN OFF - each one in `g`, absent for
 *      none (GLYPH-WEAR). Paint alone: `g` stays what is true and what
 *      the rights read; a face drawing the badge leaves these out
 *   ar the account's arena rating this season, absent for a guest (ARENA4)
 *   cl the level of the character the client named at the mint, as the
 *      realm keeps it (server-account/src/realm.js - the summary's
 *      `level`), absent when it named none or from a service before
 *      ARENA4b; the relay's ladder vitality reads it (net/arenaLaw.js
 *      ladderVitality) and never a health the client claims
 */
/** ARENA4: the rating's bounds on a token (net/arenaLaw.js ARENA_ELO_MIN and ARENA_ELO_MAX, pinned - written here, not
 *  imported, so the token module stays the leaf every end reads). */
export const ARENA_RATING_MIN = 100;
export const ARENA_RATING_MAX = 4000;
/** ARENA4b: the character level's bounds on a token (`cl` - the realm summary's own, server-account/src/realm.js
 *  realmSummaryOf's 1000; net/arenaLaw.js ARENA_CL_MIN and ARENA_CL_MAX, pinned). */
export const CHARACTER_LEVEL_MIN = 1;
export const CHARACTER_LEVEL_MAX = 1000;
/** ARENA4b: a character level a token may carry - a whole number in bounds, never a stand-in. */
export const characterLevelIssuable = (cl) => Number.isSafeInteger(cl) && cl >= CHARACTER_LEVEL_MIN && cl <= CHARACTER_LEVEL_MAX;

/** The account id's own shape - the same one `net/social.js` already
 *  keeps in `dagger.online.account`, so an id minted by SOC1 is an id
 *  this token can carry (ACC0: the existing account is ADOPTED, never
 *  replaced). */
export const ID_RE = /^[A-Za-z0-9_-]{4,40}$/;

/** GUILD1c: A CHARACTER'S GUILD ON A SIGNED SET - its id, its tag and its member row (the roster's `m<rowid>`), ALL
 *  THREE OR NONE: a token minted for a character in no guild, or by a service before GUILD1c, carries none. Each a
 *  string of the law's own shape and never coerced - the tag is drawn beside a name, and an array that stringifies to
 *  one is not one. The room routes a guild's chat by the id and takes a removal off by the member row; the tag is the
 *  only one of the three anybody else is shown. */
export function guildClaimsValid(c) {
  if (c?.gi === undefined && c?.gt === undefined && c?.gm === undefined) return true;
  return typeof c.gi === 'string' && GUILD_ID_RE.test(c.gi)
    && typeof c.gt === 'string' && GUILD_TAG_RE.test(c.gt)
    && typeof c.gm === 'string' && GUILD_MEMBER_RE.test(c.gm);
}

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
  // SEAT1c: a seat's title rides with its claim, and the claim with nothing else - absent for every other title
  if (SEAT_TITLES.includes(c.t) ? !seatTitleClaimOk(c.ts) : c.ts !== undefined) return false;
  if (c.au !== undefined && !AURAS.includes(c.au)) return false;   // WB9g: the aura worn, the title's law - absent for none, one of the known or refused
  if (c.rb !== undefined && !ribbonClaimOk(c.rb)) return false;   // SEASON1 part two: a Season's banner ribbon - absent for none, two of the sixteen colours or refused
  if (c.g !== undefined) {
    if (!Array.isArray(c.g) || c.g.length > GLYPHS_MAX) return false;
    if (!c.g.every((g) => GLYPHS.includes(g))) return false;
    if (new Set(c.g).size !== c.g.length) return false;   // a repeat is a longer claim set saying one thing
  }
  // GLYPH-WEAR: the glyphs taken off - a list of `g`'s own, each once; absent for none, so a service before it signs
  // nothing new. One `g` does not carry is refused: a token cannot hide what it never said was true.
  if (c.gx !== undefined) {
    if (!Array.isArray(c.gx) || !c.gx.length || !Array.isArray(c.g)) return false;
    if (!c.gx.every((g) => c.g.includes(g)) || new Set(c.gx).size !== c.gx.length) return false;
  }
  // MOD1: THE MUTE RIDES THE SIGNATURE, like the name and the badge, so
  // a player cannot talk their way out of one by reconnecting - every
  // hello re-reads it off a claim the service signed. Absent when not
  // muted; present, it must END AFTER the token was issued, because a
  // mute that is already over is not a mute and the minter must not say
  // one is.
  if (c.mu !== undefined && (!Number.isSafeInteger(c.mu) || c.mu <= c.i)) return false;
  // RENOWN1: the level, optional the same way - absent from a token minted
  // without a character (an older build) - and within the cap when there.
  if (c.lv !== undefined && !renownIssuable(c.lv)) return false;
  if (!guildClaimsValid(c)) return false;   // GUILD1c
  // REALM-DOOR: the realm's word on the named character - exactly 0 or 1, never a truthy stand-in; absent from a service
  // before it, which the relay admits as it always did (the two Workers deploy on their own)
  if (c.rc !== undefined && c.rc !== 0 && c.rc !== 1) return false;
  // ARENA4: the account's arena rating this season (net/arenaLaw.js - the hall queues by it): absent from a service before
  // it and from a guest's token; present, a whole number on the rating's scale
  if (c.ar !== undefined && !(Number.isSafeInteger(c.ar) && c.ar >= ARENA_RATING_MIN && c.ar <= ARENA_RATING_MAX)) return false;
  // ARENA4b: the named character's level (the relay's ladder vitality reads it): absent from a service before it and from a
  // mint that named no character; present, a whole number from 1 to the realm's 1000
  if (c.cl !== undefined && !characterLevelIssuable(c.cl)) return false;
  if (!Number.isSafeInteger(c.i) || !Number.isSafeInteger(c.e)) return false;
  if (c.e <= c.i) return false;                 // a token that is born dead
  if (c.e - c.i > maxTtlS) return false;        // a minter that got greedy
  return true;
}

/**
 * MINT. The account service's half - it holds the private key and
 * nothing else does.
 *
 * @param {{s:string, n:string, k:'guest'|'linked', t?:string, ts?:number[], g?:string[], mu?:number, lv?:number, gi?:string, gt?:string, gm?:string, rc?:0|1, au?:string, rb?:number[], gx?:string[], ar?:number, cl?:number}} who
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
  if (who?.ts !== undefined) claims.ts = who.ts;   // SEAT1c: a seat title's claim - beside its title alone (claimsValid)
  if (who?.g !== undefined && who.g.length) claims.g = who.g;
  if (who?.mu !== undefined) claims.mu = who.mu;   // MOD1: only while muted - an unmuted player mints the bytes they always did
  if (who?.lv !== undefined) claims.lv = who.lv;   // RENOWN1: only when the client named its character
  // GUILD1c: only while that character is in a guild - all three, and a partial set is refused below, not trimmed
  if (who?.gi !== undefined || who?.gt !== undefined || who?.gm !== undefined) Object.assign(claims, { gi: who.gi, gt: who.gt, gm: who.gm });
  if (who?.rc !== undefined) claims.rc = who.rc;   // REALM-DOOR: a 0 is said, never dropped as falsy - it is the relay's refusal
  if (who?.au !== undefined) claims.au = who.au;   // WB9g: only while an aura is worn - a player wearing none mints the bytes they always did
  if (who?.rb !== undefined) claims.rb = who.rb;   // SEASON1 part two: only while a Season's ribbon is worn - none, the bytes as before
  if (who?.gx !== undefined && who.gx.length) claims.gx = who.gx;   // GLYPH-WEAR: only while a glyph is taken off - a player hiding none mints the bytes they always did
  if (who?.ar !== undefined) claims.ar = who.ar;   // ARENA4: only for a registered account - a guest mints the bytes it always did
  if (who?.cl !== undefined) claims.cl = who.cl;   // ARENA4b: only when a character was named - a mint naming none, the bytes as before
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
 *  refuses a kind it does not know rather than guessing. RENOWN1 adds the
 *  second: 'renown', a character's Renown that ROSE while its player was
 *  already in a room, carried in by that player's own client (the token
 *  that let them in said the Renown they had then). */
export const ORDER_KINDS = Object.freeze(['mute', 'renown', 'guild', 'guildout', 'siege']);   // GUILD1c: a character's guild now, and a member or a guild gone   // SEAT2a: a battle's pass
/** An order lives a minute - long enough to be carried to every room
 *  the moderator holds, short enough that a leaked one is stale before
 *  anyone could use it for anything but what it already said. */
export const ORDER_TTL_S = 60;

/** `{o:'mute', s, mu, i, e}` - `mu` 0 is "unmuted" - or `{o:'renown', s,
 *  lv, i, e}` (RENOWN1), or `{o:'guild', s, gi?, gt?, gm?, i, e}` and
 *  `{o:'guildout', s, gi, gm?, i, e}` (GUILD1c). Each kind carries its OWN
 *  fields and never another's, so a renown order can never be read as a
 *  mute that says nothing, nor a mute as a renown order. */
export function orderValid(c) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return false;
  if (!ORDER_KINDS.includes(c.o)) return false;
  if (c.n !== undefined || c.k !== undefined) return false;   // an identity's fields: never on an order
  if (typeof c.s !== 'string' || !ID_RE.test(c.s)) return false;
  const noGuild = c.gi === undefined && c.gt === undefined && c.gm === undefined;   // GUILD1c: a guild's fields are the guild kinds' alone
  if (c.o === 'mute' && (!Number.isSafeInteger(c.mu) || c.mu < 0 || c.lv !== undefined || !noGuild)) return false;
  if (c.o === 'renown' && (!renownIssuable(c.lv) || c.mu !== undefined || !noGuild)) return false;
  // GUILD1c: `guild` - the guild the carrier's character is in NOW, all three or none; `guildout` - guild `gi` lost its
  // member `gm` (removed), or everyone (no `gm`: disbanded), and never a tag, which names nobody
  if (c.o === 'guild' && (!guildClaimsValid(c) || c.mu !== undefined || c.lv !== undefined)) return false;
  if (c.o === 'guildout' && (typeof c.gi !== 'string' || !GUILD_ID_RE.test(c.gi) || c.gt !== undefined
    || (c.gm !== undefined && (typeof c.gm !== 'string' || !GUILD_MEMBER_RE.test(c.gm))) || c.mu !== undefined || c.lv !== undefined)) return false;
  // SEAT2a: a battle's pass carries its own fields and no other kind's; no other kind carries a pass's
  const noSiege = SIEGE_PASS_FIELDS.every((f) => c[f] === undefined);
  if (c.o !== 'siege' && !noSiege) return false;
  if (c.o === 'siege' && (!siegePassValid(c) || c.mu !== undefined || c.lv !== undefined || !noGuild)) return false;
  if (!Number.isSafeInteger(c.i) || !Number.isSafeInteger(c.e)) return false;
  if (c.e <= c.i || c.e - c.i > ORDER_TTL_S) return false;
  return true;
}

/* ═══ SEAT2a: THE SIEGE PASS (bible/11-Multiplayer/Seats-Arc.md 6.2, 6.4, 6.6) ═══════════════════════════════════
 *
 * FACT: the relay has no door to the account service (its receipts ride the players' own clients). So a siege's room
 * cannot ask who signed which side - the service tells it, once a socket, in an order the room checks with the key it
 * already holds: `{o:'siege', s, sk, sw, sd, st, sn, sb, se, sf, i, e}` - account `s` may enter seat `sk`'s battle of
 * week `sw` on side `sd` ('attack', 'defend', or 'watch' - a spectator), the battle a `sn` ('siege' | 'tourney') at a
 * `st` seat ('palace' | 'crown'), starting `sb` and its window closing `se` (epoch seconds), on the field `sf` (the
 * banners' points, the Throne's, the attackers' camp and the defenders', each `[x, z]` in the room's units - the
 * service derives none of it; the client derives it from the town and the service signs what every signed client
 * agrees, part four). Its carrier is the account it names: the room refuses a pass whose `s` is not the hello's own.
 * CROWN1 part two: a Royal Tourney's pass is the same order - `sn` 'royal' at a crown, its side a contender's `duel` or a
 * spectator's `watch`, its window the week the Edict rules (to ROYAL_PASS_SPAN_S), its field the ring's centre alone.
 * SEAT2b part two (c): a REVOLT's (Seats-Arc 7.7) - `sn` 'revolt', its side the holder's `defend` or a spectator's
 * `watch` (the rising is the relay's own: nobody signs to attack), its field a siege's (the palace door the Throne's
 * point, the defenders' camp where they rise), no works.
 */
/** A pass's fields - never on another kind. SEAT2b part two (b): `sx` a siege's works, as the service froze them at the
 *  battle's first pass - `[walls, gatehouse (-1 none), rams, siegewright (0|1), barracks]` (net/siegeRef.js worksOf);
 *  optional (a battle whose works were never frozen carries none), a siege's alone. */
export const SIEGE_PASS_FIELDS = Object.freeze(['sk', 'sw', 'sd', 'st', 'sn', 'sb', 'se', 'sf', 'sx']);
/** The sides a pass may name: the two sides' fighters, and a spectator's - CROWN1 part two: and a Royal Tourney's
 *  contender. */
export const SIEGE_PASS_SIDES = Object.freeze(['attack', 'defend', 'watch', 'duel']);
/** A pass's field: a palace's three banners or a crown's four, the Throne and the two camps - each a point; a Royal
 *  Tourney's ring, one. */
export const siegePassPoints = (tier, kind = 'siege') => (kind === 'royal' ? 1 : tier === 'crown' ? 7 : 6);
/** A field's coordinates' bound, in the room's units. */
export const SIEGE_PASS_COORD_MAX = 1e9;
/** The longest a battle's window may run on a pass (a palace siege's or a Tourney's two hours). */
export const SIEGE_PASS_SPAN_S = 2 * 3600;
/** CROWN1 part two: a Royal Tourney's - its seat week. */
export const ROYAL_PASS_SPAN_S = 7 * 24 * 3600;
const coordOk = (v) => Number.isSafeInteger(v) && Math.abs(v) <= SIEGE_PASS_COORD_MAX;
/** Whether a claim set's pass fields are a pass's. */
export function siegePassValid(c) {
  if (!Number.isSafeInteger(c.sk) || c.sk < 0 || c.sk > 0xffffffff || !Number.isSafeInteger(c.sw) || c.sw < 0) return false;
  const royal = c.sn === 'royal';
  if (!SIEGE_PASS_SIDES.includes(c.sd) || (c.st !== 'palace' && c.st !== 'crown') || (c.sn !== 'siege' && c.sn !== 'tourney' && c.sn !== 'revolt' && !royal)) return false;
  if (royal ? c.st !== 'crown' || (c.sd !== 'duel' && c.sd !== 'watch') : c.sd === 'duel') return false;   // a contender is a Royal Tourney's alone
  if (c.sn === 'revolt' && c.sd === 'attack') return false;   // SEAT2b part two (c): a revolt's rising is the relay's own
  if (!Number.isSafeInteger(c.sb) || c.sb <= 0 || !Number.isSafeInteger(c.se) || c.se <= c.sb || c.se - c.sb > (royal ? ROYAL_PASS_SPAN_S : SIEGE_PASS_SPAN_S)) return false;
  if (c.sx !== undefined && (c.sn !== 'siege' || !worksOf(c.sx, c.st, c.sn))) return false;   // SEAT2b part two (b): a siege's works, well made
  return siegeFieldValid(c.sf, c.st, c.sn);
}
/** A battle's field as a pass carries it (`sf`): a palace's six points or a crown's seven, each `[x, z]` whole room units
 *  within their bound - the service asks it of a client's derivation too (SEAT2a part three). */
export function siegeFieldValid(sf, tier, kind = 'siege') {
  if (!Array.isArray(sf) || sf.length !== siegePassPoints(tier, kind)) return false;
  return sf.every((p) => Array.isArray(p) && p.length === 2 && coordOk(p[0]) && coordOk(p[1]));
}

/** SEAT2a: MINT A SIEGE PASS - the service's word that account `s` may enter seat `sk`'s battle of week `sw` on side `sd`.
 *  SEAT2b part two (b): `sx` the siege's frozen works, where it has them. */
export async function mintSiegeOrder({ s, sk, sw, sd, st, sn, sb, se, sf, sx }, privateKey, { subtle, nowS, ttlS = ORDER_TTL_S }) {
  if (!Number.isSafeInteger(nowS)) throw new TypeError('mintSiegeOrder needs an integer epoch-seconds clock');
  const claims = { o: 'siege', s, sk, sw, sd, st, sn, sb, se, sf, ...(sx === undefined || sx === null ? {} : { sx }), i: nowS, e: nowS + ttlS };
  if (!orderValid(claims)) throw new TypeError('mintSiegeOrder refused an order it could not verify');
  return sealClaims(claims, privateKey, subtle);
}

/** MINT AN ORDER - the account service's half, as `mintToken` is. */
export async function mintOrder({ s, mu }, privateKey, { subtle, nowS, ttlS = ORDER_TTL_S }) {
  if (!Number.isSafeInteger(nowS)) throw new TypeError('mintOrder needs an integer epoch-seconds clock');
  const claims = { o: 'mute', s, mu, i: nowS, e: nowS + ttlS };
  if (!orderValid(claims)) throw new TypeError('mintOrder refused an order it could not verify');
  return sealClaims(claims, privateKey, subtle);
}

/** RENOWN1: MINT A RENOWN ORDER - `lv` the Renown level `s`'s
 *  character has now reached, signed by the service that derived it. */
export async function mintRenownOrder({ s, lv }, privateKey, { subtle, nowS, ttlS = ORDER_TTL_S }) {
  if (!Number.isSafeInteger(nowS)) throw new TypeError('mintRenownOrder needs an integer epoch-seconds clock');
  const claims = { o: 'renown', s, lv, i: nowS, e: nowS + ttlS };
  if (!orderValid(claims)) throw new TypeError('mintRenownOrder refused an order it could not verify');
  return sealClaims(claims, privateKey, subtle);
}

/** GUILD1c: MINT A GUILD ORDER - the guild `s`'s character is in NOW (`gi`, `gt`, `gm`), or none, signed by the
 *  service that just changed it (a founding, a join, a leaving, a disbanding) or read it (the guild tab's look). Its
 *  own client carries it to the rooms it is in, as a renown order. */
export async function mintGuildOrder({ s, gi, gt, gm }, privateKey, { subtle, nowS, ttlS = ORDER_TTL_S }) {
  if (!Number.isSafeInteger(nowS)) throw new TypeError('mintGuildOrder needs an integer epoch-seconds clock');
  const claims = { o: 'guild', s, i: nowS, e: nowS + ttlS };
  if (gi !== undefined || gt !== undefined || gm !== undefined) Object.assign(claims, { gi, gt, gm });
  if (!orderValid(claims)) throw new TypeError('mintGuildOrder refused an order it could not verify');
  return sealClaims(claims, privateKey, subtle);
}

/** GUILD1c: MINT A GUILD-OUT ORDER - guild `gi` lost its member `gm` (removed by an officer), or everyone (no `gm`:
 *  disbanded). Any client may carry it and the room believes the signature alone, as a mute's; `s` is the account
 *  the member was, or the disbander's. */
export async function mintGuildOutOrder({ s, gi, gm }, privateKey, { subtle, nowS, ttlS = ORDER_TTL_S }) {
  if (!Number.isSafeInteger(nowS)) throw new TypeError('mintGuildOutOrder needs an integer epoch-seconds clock');
  const claims = { o: 'guildout', s, gi, i: nowS, e: nowS + ttlS };
  if (gm !== undefined) claims.gm = gm;
  if (!orderValid(claims)) throw new TypeError('mintGuildOutOrder refused an order it could not verify');
  return sealClaims(claims, privateKey, subtle);
}

/** VERIFY AN ORDER - the relay's half. Same ladder, same answers - and
 *  the KIND is the caller's to name (RENOWN1): a room's mute arm asks for a
 *  mute and its renown arm for a renown order, so an order of one kind carried to
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
