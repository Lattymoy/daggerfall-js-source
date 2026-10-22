// @ts-check
// GRANT1 (2026-10-18, Mac: "Lets build the plan"; bible/11-Multiplayer/Spawn-Grants.md sections 4 and 7): THE SPAWN
// GRANT'S LAW, PURE - what the relay signs when a foe that rides to another player is made, and what every reader checks.
// GRANT2 (section 12) wires the asks: the client's (net/online.js sendGrant, scenes/grantHost.js) and the relay's
// (server/src/index.js _grantFrame), measured (net/grantMeasure.js). The reader's check is GRANT3's.
//
//   THE FRAME (GRANT2):  client -> cell  {t:'grant', k:'mint', id, kind, n}   validGrantAsk; on grantGate's bucket
//                        cell -> client  {t:'grant', k:'ok', id, gr}          the grant, signed (validGrantOut)
//                                        {t:'grant', k:'no', id, r}           a refusal: the gate's, while enforcing; `cell`
//                                                                             to a pose not in the cell
//                                        {t:'grant', k:'off', id}             the law is off: ask no more
//                        welcome `gm`    the law's mode in a cell (GRANT_MODES), from world218 (GRANT_RELAY_MIN)
//
//   A GRANT (section 4.2) - the room's own number `g`, the owner's socket id `o`, the room it was minted for `q`, the
//     owner's account `a` (its token's `s` - a guest's token has its own; '' for a socket with none), its kind `k`, the map
//     pixel the relay read off the owner's pose `p`, the world minute `m`, the owner's signed level `l` and Renown `r` (0
//     where its token says none - a guest's Renown), how many foes it stands
//     `n`, the seed `s`, which members are elite `e` (a bitmask) and each member's champion trait `c` (-1 none), the one
//     member a handed-on grant stands `h` (-1: every member - GRANT3's heir), when it expires `x`, and the relay's
//     signature `sg`.
//   THE SIGNATURE - Ed25519 with the relay's receipt key (GATE_SIGNING_KEY), verified with its public half (`rk`, the
//     account service's /v1/eg/keys), as the Elite Gates arch call is (net/eliteGates/egCallSig.js). ONE KEY, NEVER
//     CONFUSED: the signed bytes begin `spawn-grant1\n`, so no receipt (its version and a '.') and no call (`ec1|`)
//     verifies as a grant, nor a grant as either.
//   THE MARKS (section 4.2, `e` and `c`) - rolled by the relay from the seed alone, so a mint asked again rolls the same.
//     Three draws a member, always: the elite's, the champion's chance, its trait. RENOWN-GATE as the street has it
//     (systems/eliteFoes.js rollOverworldElite): the elite's draw is made first, then the Renown's word. An elite is
//     never a champion (scenes/exteriorFoes.js: `!entity.eliteFoe` before applyChampion).
//   THE DICE (section 4.4) - one seeded stream per die (GRANT_DICE), never one stream in an order: chooseRandomEnemy
//     draws a variable count (its short-list guard), and a stream shared with the next die would shift it.
//   THE GATE (section 4.6) - each account's bucket per kind, one ask spending one token (net/wire.js tokenGate, the
//     relay's one bucket), so a fisher's asks are an honest player's; and the cell's ceiling on live hostile members.
//     Guests have the same budget (Mac, 2026-10-18, Spawn-Grants section 10 question 1).
//   THE READER'S CHECK (section 4.7) - the sender, the cell, the expiry and the member index (grantRefusal); a record's
//     elite and champion only as the grant's or less (grantMarksAllow) - a mark worn below its grant costs only the
//     liar. The dice's match, the verdict cache and the tally are GRANT3's.
//
// Not a DFU member: online, an encounter's dice come from the relay's seed. The slice that ships that (GRANT2) adds
// its bracket to Port-Ledger section A, row ONLINE (Spawn-Grants section 6).
import { _b64url, SIG_BYTES, ID_RE, characterLevelIssuable, renownIssuable } from './identityToken.js';
import { EG_CALL_SG_RE, roomOf, tokenGate } from './wire.js';   // a signature's shape on the wire (64 bytes, base64url) - the wire's own; a room's name; the relay's one bucket

/** The version leading the signed bytes, and the line that ends it. */
export const GRANT_SIG_V = 'spawn-grant1';

/** A grant's life, ms - "about ten minutes on" (Spawn-Grants section 4.2; OPEN: GRANT5's measure sets it). A live
 *  grant is renewed before it (`renew`). */
export const GRANT_TTL_MS = 10 * 60 * 1000;
/** A reader's clock against the relay's, ms: a grant is believed this long past its `x`. */
export const GRANT_SKEW_MS = 60 * 1000;

/** THE PINNED RATES (section 4.2): the relay cannot import the modules that hold them (they reach the loot tables), so
 *  each is a copy here, held equal to its home by test/net/grant1_law.test.js. */
/** systems/eliteFoes.js ELITE_FOE_OVERWORLD_CHANCE. */
export const GRANT_ELITE_CHANCE = 0.05;
/** systems/eliteFoes.js ELITE_FOE_MIN_RENOWN - an elite stands for an owner of this Renown or more. */
export const GRANT_ELITE_MIN_RENOWN = 5;
/** systems/champions.js CHAMPION_PER_MILLE. */
export const GRANT_CHAMPION_PER_MILLE = 70;
/** systems/champions.js CHAMPION_TRAITS.length - `c` holds an index into them. */
export const GRANT_CHAMPION_TRAITS = 5;

/** THE KINDS (section 4.9): `max` the most members one grant stands (at most 24 - a bigger group asks two grants, and the
 *  elite mask stays a small integer), `rate` and `cap` the account's bucket - asks a second, and the burst (PROVISIONAL:
 *  GRANT5's measure sets both; Spawn-Grants section 10 question 3, seven days), `hostile` whether its members count
 *  against the cell's ceiling. GRANT2's two first; GRANT4 (section 14) every other source - every one of the open world's
 *  and the interior lane's stands through one pool (scenes/exteriorFoes.js spawnFoe), so a stand's kind is its caller's
 *  word or its own shape (grantKindOf).
 *    enc     - a random encounter (systems/encounters.js): systems/roadEncounters.js ROAD_PARTY_MAX, its party's extra
 *              foes inside it (wandererCount).
 *    camp    - a camp or a pack (systems/campEncounters.js): CAMP_SIZE's top and the party's extra (systems/party/
 *              partyScale.js PARTY_SCALE_EXTRA_MAX, partyGroupMembers).
 *    band    - a roaming band (TV7b) or any other capped stand: bandSizeOf's six, four times in the open zone, and the
 *              party's extra - a band past 24 asks again.
 *    bounty  - a bounty's pack (BOUNTY1): BOUNTY_PACK_MAX.
 *    loose   - a loose stand (a summons, a squad, a naval muster, a raider, Wabbajack's change): MUSTER_MAX's twelve.
 *    site    - a World of Daggerfall marker's arms, the rite's faithful: the rite's Summoner and its eight.
 *    managed - the deep's foes and the Living World's (their spawner owns their life): the hideout's eight.
 *    giant   - a Greater Giant's call: GREATER_GIANT_CALL's ten.
 *    rev     - a revenant standing (its band rides as `band`).
 *    quest   - a shared quest's foe: one a stand.
 *    ally    - a companion, a shipmate, an allied summons (allies fight foes, never the reader): never against the ceiling.
 *    watch   - the City Watch a crime calls (scenes/cityGuards.js), asked as the pool first streams a watchman:
 *              CELL_WATCH_PUPPETS_MAX's ten.
 *    kept    - a stand whose marks are its own caller's (a foe a save brought back, a search party's leader): a save's
 *              whole field in a few asks, rarely.
 *    encr    - GRANT8: an encounter whose species its seed rolls - the relay's answer to an `enc` ask while its `grantRoll`
 *              is on (never asked for by name): enc's own bounds.
 *    star    - STAR-TUNE: a fallen star's coven (scenes/starfall/starfallHost.js stand): its law's largest wave in one
 *              grant (net/starfall/starfallLaw.js STAR_WAVE_MAX, held equal by the test); a star's waves, its master and
 *              its circle's two calls asked within the burst, a breath's ten seconds a token. The open country's alone.
 *  enc's, camp's and star's `max` are held equal to their homes by the test; the rest are bounds. */
export const GRANT_KINDS = Object.freeze({
  enc: Object.freeze({ max: 4, rate: 1 / 60, cap: 6, hostile: true }),
  camp: Object.freeze({ max: 8, rate: 1 / 20, cap: 9, hostile: true }),
  band: Object.freeze({ max: 24, rate: 1 / 30, cap: 6, hostile: true }),
  bounty: Object.freeze({ max: 8, rate: 1 / 60, cap: 4, hostile: true }),
  loose: Object.freeze({ max: 12, rate: 1 / 10, cap: 12, hostile: true }),
  site: Object.freeze({ max: 9, rate: 1 / 20, cap: 8, hostile: true }),
  managed: Object.freeze({ max: 8, rate: 1 / 5, cap: 16, hostile: true }),
  giant: Object.freeze({ max: 10, rate: 1 / 120, cap: 2, hostile: true }),
  rev: Object.freeze({ max: 4, rate: 1 / 60, cap: 4, hostile: true }),
  quest: Object.freeze({ max: 1, rate: 1 / 5, cap: 24, hostile: true }),
  ally: Object.freeze({ max: 4, rate: 1 / 30, cap: 6, hostile: false }),
  watch: Object.freeze({ max: 10, rate: 1 / 30, cap: 6, hostile: true }),
  kept: Object.freeze({ max: 24, rate: 1 / 600, cap: 2, hostile: true }),
  encr: Object.freeze({ max: 4, rate: 1 / 60, cap: 6, hostile: true }),
  star: Object.freeze({ max: 24, rate: 1 / 10, cap: 8, hostile: true }),
});
/** GRANT4: the kinds of the open country alone - a world room (a building's, a dungeon's) refuses them `kind`: its stands
 *  roll no road's table, carry no bounty and call no Greater Giant. */
export const GRANT_OPEN_KINDS = Object.freeze(['enc', 'camp', 'bounty', 'giant', 'encr', 'star']);
/** GRANT8 (Spawn-Grants section 16): the kind the relay makes an `enc` ask's grant while `grantRoll` is on - its species
 *  rolled from its seed (scenes/grantHost.js grantSpecies), so neither its owner nor a forger chooses it. Pure. */
export const grantKindRolled = (k, roll) => (k === 'enc' && roll ? 'encr' : k);
/** GRANT4: A STAND'S KIND BY ITS OWN SHAPE (scenes/exteriorFoes.js spawnFoe's options), for a caller that names none - the
 *  first that holds: an ally, a quest's foe, a Greater Giant, a revenant, a stand whose marks its caller decided
 *  (`kept`), the deep's or the Living World's, a loose stand or Wabbajack's change, a marker's or the rite's, else a capped
 *  stand (a band's). Pure. @param {any} o */
export function grantKindOf(o) {
  if (o?.allied) return 'ally';
  if (o?.questBehaviour) return 'quest';
  if (o?.zoneGiant != null) return 'giant';
  if (o?.revenant) return 'rev';
  if (o?.kept) return 'kept';
  if (o?.managed) return 'managed';
  if (o?.replacing || o?.loose) return 'loose';
  if (o?.site || o?.placed) return 'site';
  return 'band';
}
/** The cell's ceiling on live granted hostile members, every sender together (section 4.6; Mac, 2026-10-18, question
 *  5: on, at the number the measure gives - PROVISIONAL until GRANT5). */
export const GRANT_CELL_CEILING = 192;

/** What a refusal says - the relay's mint (kind, size, bucket, ceiling) and a reader's (the rest); a reader's tally
 *  counts by it (GRANT3). */
export const GRANT_REFUSALS = Object.freeze(['kind', 'size', 'bucket', 'ceiling', 'unsigned', 'sender', 'cell', 'expired', 'member', 'marks']);

/** The dice a granted member's identity is drawn with (section 4.4), each its own stream: its species
 *  (chooseRandomEnemy, or the kind's own table), its level in its band, its weapon (equipEnemy), its health. */
export const GRANT_DICE = Object.freeze(['species', 'level', 'weapon', 'health']);

/** FNV-1a over the parts' text, then mulberry32 - systems/eliteFoes.js eliteHash and eliteRng, the same law (the test
 *  holds them equal); a copy because this module is the relay's too. */
function grantHash(...parts) {
  let h = 0x811c9dc5;
  for (const p of parts) {
    const t = String(p);
    for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    h ^= 0x2c; h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}
/** A grant's seeded [0,1) stream for one purpose: `eliteRng(eliteHash('grant', s, salt))`. Pure.
 *  @param {number} s @param {string} salt @returns {() => number} */
export function grantRng(s, salt) {
  let a = grantHash('grant', s >>> 0, salt);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Member `i`'s dice: one stream per GRANT_DICE word, the same on the owner's machine and every reader's. Pure.
 *  @param {number} s @param {number} i @returns {Readonly<Record<string, () => number>>} */
export function grantDice(s, i) {
  return Object.freeze(Object.fromEntries(GRANT_DICE.map((d) => [d, grantRng(s, `${d}:${i}`)])));
}

/** THE MARKS - the relay's roll of `e` and `c` for `n` members of seed `s`, its owner of Renown `r`. Pure.
 *  @param {number} s @param {number} n @param {number} r @returns {{ e: number, c: number[] }} */
export function grantMarks(s, n, r) {
  const rng = grantRng(s, 'marks');
  let e = 0;
  const c = [];
  for (let i = 0; i < n; i++) {
    const elite = rng() < GRANT_ELITE_CHANCE, chance = rng(), trait = rng();   // three draws a member, always
    if (elite && r >= GRANT_ELITE_MIN_RENOWN) { e |= 1 << i; c.push(-1); continue; }
    c.push(chance * 1000 < GRANT_CHAMPION_PER_MILLE ? Math.floor(trait * GRANT_CHAMPION_TRAITS) : -1);
  }
  return { e, c };
}

/** GRANT4: the kinds whose members roll no marks - a quest's foe, an ally, a revenant (its own record's), the watch, a
 *  stand whose marks its caller decided - as none of them takes an elite or a champion from its owner's street. A reader
 *  believes such a member's marks (grantMarksAllow): its own law decides them, and its kind's bucket bounds them. */
export const GRANT_MARKLESS = Object.freeze(['quest', 'ally', 'rev', 'watch', 'kept']);
/** The marks a grant of kind `k` carries: none for a markless kind, else the seed's (grantMarks). Pure. */
export const grantMarksFor = (k, s, n, r) => (GRANT_MARKLESS.includes(k) ? { e: 0, c: Array(n).fill(-1) } : grantMarks(s, n, r));

/** @typedef {{ g: number, o: string, q: string, a: string, k: string, p: [number, number], m: number, l: number, r: number, n: number, s: number, e: number, c: number[], h: number, x: number, sg?: string }} SpawnGrant */

const intIn = (v, lo, hi) => Number.isSafeInteger(v) && v >= lo && v <= hi;
/**
 * A grant as the wire carries it, read whole or not at all: a fresh grant, or null. `sg`, when present, must be a
 * signature's shape; a grant with none is still read (the relay's own, before it signs). Pure.
 * @param {any} v @returns {SpawnGrant|null}
 */
export function validGrant(v) {
  if (!v || typeof v !== 'object') return null;
  const law = typeof v.k === 'string' && Object.hasOwn(GRANT_KINDS, v.k) ? GRANT_KINDS[/** @type {keyof typeof GRANT_KINDS} */ (v.k)] : null;
  if (!law) return null;
  if (!intIn(v.g, 0, 0x7fffffff) || typeof v.o !== 'string' || !ID_RE.test(v.o)) return null;
  if (typeof v.q !== 'string' || roomOf(`/room/${v.q}`) !== v.q) return null;
  if (typeof v.a !== 'string' || (v.a !== '' && !ID_RE.test(v.a))) return null;
  if (!Array.isArray(v.p) || v.p.length !== 2 || !intIn(v.p[0], 0, 999) || !intIn(v.p[1], 0, 499)) return null;
  if (!intIn(v.m, 0, Number.MAX_SAFE_INTEGER) || !intIn(v.x, 1, Number.MAX_SAFE_INTEGER)) return null;
  if (!(v.l === 0 || characterLevelIssuable(v.l)) || !(v.r === 0 || renownIssuable(v.r))) return null;
  if (!intIn(v.n, 1, law.max) || !intIn(v.s, 0, 0xffffffff) || !intIn(v.e, 0, (1 << v.n) - 1)) return null;
  if (!Array.isArray(v.c) || v.c.length !== v.n) return null;
  for (let i = 0; i < v.n; i++) {
    if (!intIn(v.c[i], -1, GRANT_CHAMPION_TRAITS - 1)) return null;
    if (((v.e >>> i) & 1) && v.c[i] !== -1) return null;   // an elite is never a champion
  }
  if (!intIn(v.h, -1, v.n - 1)) return null;   // GRANT3: -1 every member; a handed-on grant's one (grantHanded)
  if (v.sg !== undefined && (typeof v.sg !== 'string' || !EG_CALL_SG_RE.test(v.sg))) return null;
  /** @type {SpawnGrant} */
  const g = { g: v.g, o: v.o, q: v.q, a: v.a, k: v.k, p: [v.p[0], v.p[1]], m: v.m, l: v.l, r: v.r, n: v.n, s: v.s, e: v.e, c: v.c.slice(), h: v.h, x: v.x };
  if (v.sg !== undefined) g.sg = v.sg;
  return g;
}

/** THE SIGNED BYTES: every field but `sg`, in one fixed order. Pure. @param {SpawnGrant} g */
export function grantBytes(g) {
  return `${GRANT_SIG_V}\n${g.g}|${g.o}|${g.q}|${g.a}|${g.k}|${g.p[0]},${g.p[1]}|${g.m}|${g.l}|${g.r}|${g.n}|${g.s}|${g.e}|${g.c.join(',')}|${g.h}|${g.x}`;
}

const enc = new TextEncoder();
/**
 * SIGN - the relay's half: `sg`, or '' with no key (a relay built without GATE_SIGNING_KEY signs nothing).
 * @param {SpawnGrant} g @param {CryptoKey|null} privateKey @param {{ subtle: SubtleCrypto }} env
 */
export async function signGrant(g, privateKey, { subtle }) {
  if (!privateKey) return '';
  const sig = new Uint8Array(await subtle.sign({ name: 'Ed25519' }, privateKey, enc.encode(grantBytes(g))));
  return _b64url.encode(sig);
}

/**
 * VERIFY - a reader's half: whether `g.sg` is the relay's signature over the grant read whole. Never throws.
 * @param {any} g @param {CryptoKey|null} publicKey @param {{ subtle: SubtleCrypto }} env
 */
export async function verifyGrant(g, publicKey, { subtle }) {
  const v = validGrant(g);
  if (!publicKey || !v || typeof v.sg !== 'string') return false;
  const sig = _b64url.decode(v.sg);
  if (!sig || sig.length !== SIG_BYTES) return false;
  try { return await subtle.verify({ name: 'Ed25519' }, publicKey, sig, enc.encode(grantBytes(v))); } catch { return false; }
}

/**
 * THE MINT'S GATE - the relay's word on an account's ask for `n` members of kind `k`, the cell holding `live` granted
 * hostile members now: `refusal` null to mint, else the first that stands of 'kind', 'size', 'ceiling', 'bucket'. The
 * ceiling is asked before the bucket, so an ask the cell refuses spends nothing of the asker's. `bucket` is the
 * account's own for the kind (tokenGate's shape; undefined for a first ask), and the answer's is the one to keep. Pure.
 * @param {string} k @param {number} n @param {{ tokens: number, at: number }|undefined} bucket @param {number} live @param {number} nowMs
 * @returns {{ bucket: { tokens: number, at: number }|undefined, refusal: string|null }}
 */
export function grantMintGate(k, n, bucket, live, nowMs) {
  const law = Object.hasOwn(GRANT_KINDS, k) ? GRANT_KINDS[/** @type {keyof typeof GRANT_KINDS} */ (k)] : null;
  if (!law) return { bucket, refusal: 'kind' };
  if (!intIn(n, 1, law.max)) return { bucket, refusal: 'size' };
  if (law.hostile && live + n > GRANT_CELL_CEILING) return { bucket, refusal: 'ceiling' };
  const gate = tokenGate(bucket, nowMs, law.rate, law.cap);
  return { bucket: gate.bucket, refusal: gate.pass ? null : 'bucket' };
}

/**
 * THE READER'S CHECK, past the signature: why member `i` of grant `g` may not stand from sender `from` in cell `cell`
 * at `nowMs` - 'sender', 'cell', 'expired', 'member' - or null. Pure.
 * @param {SpawnGrant} g @param {{ from: string, cell: string, nowMs: number, i: number }} at
 */
export function grantRefusal(g, { from, cell, nowMs, i }) {
  if (g.o !== from) return 'sender';
  if (g.q !== cell) return 'cell';
  if (!(nowMs <= g.x + GRANT_SKEW_MS)) return 'expired';
  if (!Number.isInteger(i) || i < 0 || i >= g.n || (g.h >= 0 && i !== g.h)) return 'member';   // GRANT3: a handed-on grant stands its one member
  return null;
}

/** Whether a record's elite (`z`) and champion (`cp`) are within member `i`'s grant: an elite only where `e` says, a
 *  trait only `c`'s own - and either left off is always believed (a mark worn below its grant costs only the liar). A
 *  markless kind's are its own law's (GRANT4: GRANT_MARKLESS), believed. Pure.
 *  @param {SpawnGrant} g @param {number} i @param {{ z?: any, cp?: any }} rec */
export const grantMarksAllow = (g, i, { z, cp }) => GRANT_MARKLESS.includes(g.k) || ((!z || ((g.e >>> i) & 1) === 1) && (cp == null || cp === g.c[i]));

// ── GRANT2: THE ASK, THE ANSWER, THE MODE (Spawn-Grants section 12) ─────────────────────────────────────────────────
/** The first relay that takes the `grant` frame (RELAY_VERSION's number). An older relay refuses a frame it does not
 *  know by closing the socket, so a client asks only of a relay at this or later (relayCfgSupported's way). */
export const GRANT_RELAY_MIN = 218;
/** Does the relay at version `v` take a grant's ask? */
export const relaySupportsGrant = (v) => Number(/^world(\d+)$/.exec(String(v ?? ''))?.[1]) >= GRANT_RELAY_MIN;
/** FOE-BOUNDS (Spawn-Grants section 19): the first relay that takes a tally's `stats` - an older one refuses the whole tally
 *  for a word it does not know, so a reader hands that row only to a relay at this or later. */
export const GRANT_STATS_RELAY_MIN = 223;
/** Does the relay at version `v` take a tally's `stats`? */
export const relaySupportsGrantStats = (v) => Number(/^world(\d+)$/.exec(String(v ?? ''))?.[1]) >= GRANT_STATS_RELAY_MIN;
/** AUDIT STAR-TUNE F1: the first relay that mints the `star` kind (STAR-TUNE's). An older one answers the ask `kind`, so
 *  under `enforce` no wave stands and under `grantStrip` the coven is its owner's alone - and the site goes live before
 *  the relay's deploy is through (deploy.yml waits on the account service, which STAR-TUNE does not move). A client asks
 *  `star` of a relay at this or later, and its stand's own kind (`site`, the master `kept` - main's) of an older one,
 *  whose waves its own law holds to nine. */
export const STAR_GRANT_RELAY_MIN = 238;
/** Does the relay at version `v` mint the `star` kind? */
export const relaySupportsStarGrant = (v) => Number(/^world(\d+)$/.exec(String(v ?? ''))?.[1]) >= STAR_GRANT_RELAY_MIN;

/** The law's modes (relayCfg `grantMode`, the welcome's `gm`): `off` - no ask is made or answered; `measure` - every ask
 *  is granted and what the gate would refuse is counted (GRANT2 to GRANT5); `enforce` - the gate refuses (GRANT6). */
export const GRANT_MODES = Object.freeze(['off', 'measure', 'enforce']);
/** The mode a setting names: `off` and `enforce` exactly, anything else `measure` - the law measures from its deploy
 *  (Mac, 2026-10-18: "Measure on deploy"), and a setting nobody wrote is that. Pure. @param {unknown} v */
export const grantModeOf = (v) => (v === 'off' || v === 'enforce' ? v : 'measure');

/** The most a client's ask number may be - it names the answer that comes back, nothing more. */
export const GRANT_ASK_ID_MAX = 0x7fffffff;
/** GRANT3: the most grants one `renew` or `carry` names - an owner's live grants, which its buckets bound well under it. */
export const GRANT_RENEW_MAX = 32;
/** GRANT3: a reader's tally - the most senders and reasons one names, how often a reader hands one on (ms), and the most
 *  refusals one row says. */
export const GRANT_TALLY_ROWS_MAX = 32;
export const GRANT_TALLY_MS = 10 * 60 * 1000;
export const GRANT_TALLY_COUNT_MAX = 10_000;
/** The reasons a READER refuses for (grantRefusal, grantMarksAllow, the signature and the dice) - a tally's words. FOE-BOUNDS
 *  (section 19): `stats`, a record whose health no builder could give it (net/foeBounds.js foeStatsRefusal). */
export const GRANT_READER_REFUSALS = Object.freeze(['unsigned', 'sender', 'cell', 'expired', 'member', 'marks', 'dice', 'twice', 'ungranted', 'stats']);
/** GRANT6-GRANT7 (Spawn-Grants section 15): THE REASONS ONLY A CHANGED CLIENT GIVES - a grant no relay signed (once the
 *  reader has waited for it), another's, a member past it, marks past it, a member standing twice. GRANT7's case counts
 *  these alone. The rest come of an honest client's timing or settings too - a record that beat its carry (`cell`) or its
 *  renewal (`expired`), a level risen since its checkpoint (`dice`), a stand whose grant never came (`ungranted`) - and are
 *  the measure's. FOE-BOUNDS (section 19): `stats` - a health past every builder's worst is no timing and no setting. */
export const GRANT_CASE_REASONS = Object.freeze(['unsigned', 'sender', 'member', 'marks', 'twice', 'stats']);
/** GRANT6: what an enforcing reader stands down - the case's reasons and a record with no grant (the law's whole point:
 *  without it a changed client sends none). An honest owner never streams one while the law enforces (scenes/
 *  exteriorFoes.js spawnFoe drops a stand its grant did not come for). A reader stands nothing down for the rest. */
export const GRANT_STANDDOWN_REASONS = Object.freeze([...GRANT_CASE_REASONS, 'ungranted']);

const uniqInts = (a, max) => Array.isArray(a) && a.length >= 1 && a.length <= max && a.every((g) => intIn(g, 0, 0x7fffffff)) && new Set(a).size === a.length;
const signedGrant = (v) => { const g = validGrant(v); return g && typeof g.sg === 'string' ? g : null; };
/**
 * An ask as the relay reads it, or null (GRANT2's mint, GRANT3's others). Pure.
 *   {k:'mint', id, kind, n}            a grant for `n` members of `kind`
 *   {k:'renew', id, grs}               my grants signed again with a new expiry - whole (AUDIT GRANT A8: a relay that
 *                                      forgot them signs its own again)
 *   {k:'free', id, gs}                 my grants' members are all gone - believed only downward (AUDIT GRANT A7: a turn's)
 *   {k:'carry', id, grs}               I crossed into this cell: my grants from another, signed again for this one
 *   {k:'heir', id, hs: [{gr, i, to}]}  I hand member `i` of each grant on to socket `to` in this cell (A7: a turn's)
 *   {k:'tally', id, rows}              what I refused, by sender and reason, since my last tally - [{o, r, n}]
 * @param {any} m @returns {any}
 */
export function validGrantAsk(m) {
  if (!m || typeof m !== 'object' || !intIn(m.id, 0, GRANT_ASK_ID_MAX)) return null;
  if (m.k === 'mint') {
    if (typeof m.kind !== 'string' || !Object.hasOwn(GRANT_KINDS, m.kind) || m.kind === 'encr') return null;   // GRANT8: `encr` the relay's word, never asked
    if (!intIn(m.n, 1, GRANT_KINDS[/** @type {keyof typeof GRANT_KINDS} */ (m.kind)].max)) return null;
    return { k: 'mint', id: m.id, kind: m.kind, n: m.n };
  }
  if (m.k === 'free') return uniqInts(m.gs, GRANT_RENEW_MAX) ? { k: 'free', id: m.id, gs: m.gs.slice() } : null;   // AUDIT GRANT A7: a turn's frees in one ask
  if (m.k === 'renew' || m.k === 'carry') {   // AUDIT GRANT A8: a renewal carries its grants whole, so a relay that forgot them signs them again
    if (!Array.isArray(m.grs) || !m.grs.length || m.grs.length > GRANT_RENEW_MAX) return null;
    const grs = m.grs.map(signedGrant);
    return grs.every(Boolean) ? { k: m.k, id: m.id, grs } : null;
  }
  if (m.k === 'heir') {   // AUDIT GRANT A7: a handover's members in one ask
    if (!Array.isArray(m.hs) || !m.hs.length || m.hs.length > GRANT_RENEW_MAX) return null;
    const hs = m.hs.map((x) => {
      const gr = signedGrant(x?.gr);
      if (!gr || !intIn(x.i, 0, gr.n - 1) || (gr.h >= 0 && gr.h !== x.i) || typeof x.to !== 'string' || !ID_RE.test(x.to)) return null;
      return { gr, i: x.i, to: x.to };
    });
    return hs.every(Boolean) ? { k: 'heir', id: m.id, hs } : null;
  }
  if (m.k === 'tally') {
    if (!Array.isArray(m.rows) || !m.rows.length || m.rows.length > GRANT_TALLY_ROWS_MAX) return null;
    const ok = m.rows.every((r) => r && typeof r.o === 'string' && ID_RE.test(r.o) && GRANT_READER_REFUSALS.includes(r.r) && intIn(r.n, 1, GRANT_TALLY_COUNT_MAX));
    return ok ? { k: 'tally', id: m.id, rows: m.rows.map((r) => ({ o: r.o, r: r.r, n: r.n })) } : null;
  }
  return null;
}

/**
 * The relay's answer as a client reads it, or null. Pure. AUDIT GRANT A10: a mint's answer (`ok`, `no`) says the law in
 * force (`gm`, GRANT_MODES) - the setting the relay read at the ask, which a welcome from a cold cell may not have.
 *   {k:'ok', id, gr, gm?}   a mint's grant, read whole
 *   {k:'renew', id, grs}    my grants signed again (the ones the cell still held as mine, or signed here)
 *   {k:'carry', id, grs}    my carried grants, made out to this cell - null where one was refused
 *   {k:'heir', id, gr}      the handed-on grant, made out to the heir, for my handover frame
 *   {k:'no', id, r}         a refusal in the law's words
 *   {k:'off', id}           the law is off: ask no more
 * @param {any} m
 */
export function validGrantOut(m) {
  if (!m || typeof m !== 'object' || !intIn(m.id, 0, GRANT_ASK_ID_MAX)) return null;
  if (m.k === 'off') return { k: 'off', id: m.id };
  const gm = GRANT_MODES.includes(m.gm) ? { gm: m.gm } : {};
  if (m.k === 'no') return typeof m.r === 'string' && GRANT_REFUSALS.includes(m.r) ? { k: 'no', id: m.id, r: m.r, ...gm } : null;
  if (m.k === 'ok' || m.k === 'heir') {
    const gr = validGrant(m.gr);
    return gr ? { k: m.k, id: m.id, gr, ...(m.k === 'ok' ? gm : {}) } : null;
  }
  if (m.k === 'renew' || m.k === 'carry') {
    if (!Array.isArray(m.grs) || m.grs.length > GRANT_RENEW_MAX) return null;
    const grs = m.grs.map((g) => (g === null && m.k === 'carry' ? null : validGrant(g)));
    return grs.every((g, i) => g !== null || m.grs[i] === null) ? { k: m.k, id: m.id, grs } : null;
  }
  return null;
}

// ── GRANT3: THE RELAY'S OWN GRANTS AGAIN (Spawn-Grants sections 4.3 and 4.8) ──────────────────────────────────────────
const unsigned = (g) => { const { sg, ...rest } = g; void sg; return rest; };
/** A live grant signed again: the same in every field but its expiry. Pure. @param {SpawnGrant} g @param {number} nowMs */
export const grantRenewed = (g, nowMs) => ({ ...unsigned(g), c: g.c.slice(), p: [g.p[0], g.p[1]], x: nowMs + GRANT_TTL_MS });
/** A grant carried into cell `q` under that cell's number `n`: its members, seed and marks as they were. Pure.
 *  @param {SpawnGrant} g @param {string} q @param {number} n @param {number} nowMs */
export const grantCarried = (g, q, n, nowMs) => ({ ...grantRenewed(g, nowMs), g: n, q });
/** Member `i` of a grant handed on to socket `to` under this cell's number `n` - the same seed and marks, so the member
 *  is the same foe, standing on its own (`h`). Pure. @param {SpawnGrant} g @param {number} i @param {string} to @param {number} n @param {number} nowMs */
export const grantHanded = (g, i, to, n, nowMs) => ({ ...grantRenewed(g, nowMs), g: n, o: to, h: i });
/**
 * THE RELAY'S OWN SIGNATURE, CHECKED WITHOUT ITS PUBLIC HALF: Ed25519 is deterministic (RFC 8032), so the relay signs the
 * grant's bytes again and compares. Never throws. @param {SpawnGrant} g @param {CryptoKey|null} privateKey @param {{ subtle: SubtleCrypto }} env
 */
export async function grantSignedHere(g, privateKey, env) {
  if (!privateKey || typeof g?.sg !== 'string') return false;
  try { return (await signGrant(unsigned(g), privateKey, env)) === g.sg; } catch { return false; }
}

/** Is an account's bucket for kind `k` full again at `nowMs` - one the relay may forget, since a first ask's bucket is
 *  full? Pure. @param {string} k @param {{ tokens: number, at: number }|undefined} b @param {number} nowMs */
export function grantBucketIdle(k, b, nowMs) {
  const law = Object.hasOwn(GRANT_KINDS, k) ? GRANT_KINDS[/** @type {keyof typeof GRANT_KINDS} */ (k)] : null;
  if (!law || !b) return true;
  return b.tokens + ((nowMs - b.at) / 1000) * law.rate >= law.cap;
}

/** A socket's asks a second at the relay, and its burst - a chunk entered rolls up to three camps at once
 *  (systems/campEncounters.js CAMP_GROUPS_ON_CHUNK_LOAD), two chunks at a corner. The law's own buckets are the
 *  account's (grantMintGate); this one guards the room from a flood of frames. */
export const GRANT_HZ_MAX = 2;
export const GRANT_BURST_MAX = 8;
/** The per-socket gate the relay spends an ask on. */
export const grantGate = (bucket, nowMs) => tokenGate(bucket, nowMs, GRANT_HZ_MAX, GRANT_BURST_MAX);
/** How often a cell asks the hub for the law's mode again, at an ask, ms: a staff change is in force everywhere inside
 *  it (relayCfg's RELAY_CFG_TTL_MS is a boss room's minute; every cell a player roams asks this one). */
export const GRANT_CFG_TTL_MS = 5 * 60 * 1000;

// ── GRANT3: THE OWNER'S AND THE READER'S CLOCKS (section 13) ─────────────────────────────────────────────────────────
/** How long a stand waits on its grant, ms - past it the foe stands as it would have with no law (its own rolls). */
export const GRANT_WAIT_MS = 1500;
/** How long before a live grant's expiry its owner asks it signed again, ms. */
export const GRANT_RENEW_LEAD_MS = 2 * 60 * 1000;
/** The most grants one foes frame carries (`gs`) - a full frame's every live grant, a delta's new ones. */
export const GRANT_FRAME_GRANTS_MAX = 32;
/** A grant as the wire carries it: its fields alone, in a fresh object (a host's bookkeeping on it stays home). Pure.
 *  @param {any} g */
export const wireGrant = (g) => ({ g: g.g, o: g.o, q: g.q, a: g.a, k: g.k, p: [g.p[0], g.p[1]], m: g.m, l: g.l, r: g.r, n: g.n, s: g.s, e: g.e, c: g.c.slice(), h: g.h, x: g.x, ...(typeof g.sg === 'string' ? { sg: g.sg } : {}) });
/** Is member `i` of grant `g` an elite? Pure. */
export const grantElite = (g, i) => ((g.e >>> i) & 1) === 1;
