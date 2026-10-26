// @ts-check
// GRANT2-GRANT4 (2026-10-18, Mac: "Lets build the plan", "Do all slices"; bible/11-Multiplayer/Spawn-Grants.md sections
// 12-16): THE GRANTS' HOST - a module the host wires (HOST-SPLIT; scenes/fishHost.js is the shape), the owner's half and
// the reader's of every spawn grant this client holds or hears. The pools (scenes/exteriorFoes.js - the street's and a
// building's - and the dungeon's own lane, scenes/dungeonContext.js) ask it; world.js makes one, hands it to their nets
// (`grants`) and its session's answers (`online.onGrant`).
//
// THE OWNER'S HALF (section 13):
//   - A STAND ASKS: spawnFoe asks a member for its kind (memberFor); every stand of a kind in one turn is ONE ask of that
//     many (the batch flushes at the turn's end - a camp's members all start in one loop), split at the kind's most. The
//     answer's grant names the member's elite and champion (the pool stands them as the grant says); a stand whose grant
//     does not come inside GRANT_WAIT_MS stands as it would have with no law.
//   - A MEMBER ENDS (dies, is culled, leaves with its owner): the grant's count goes down, and its last member frees it
//     (`free`, believed only downward). A member HANDED ON at a death or a door asks the relay to sign it to its heir
//     (`heir`, said to the heir, never awaited - a death waits on no relay).
//   - THE CLOCK (tick, the pool's frame): a live grant near its expiry is signed again (`renew`), one carried out of the
//     cell it was minted in is signed for the cell its owner stands in (`carry`; one refused is dropped, and its members
//     stand ungranted), an expired one is dropped.
//   - THE FRAME: a record names its grant and member (`gr`), and the frame carries each grant it names on a full frame and
//     whenever it was signed again (`gs`).
//   - GRANT4 (section 14): THE WATCH asks as the street's pool first streams a watchman (watchReady); a world room's grants
//     stay its own (carried cell to cell alone, freed only to the room that holds them). GRANT6 (section 15): a stand made
//     while its socket's welcome is owed waits on it (`unsaid`). GRANT8 (section 16): an `encr` member's species is its
//     seed's (grantSpecies).
// THE READER'S HALF (section 13):
//   - every grant a frame carries is checked against the relay's public half (/v1/relaykey - a guest's game too), once per
//     owner, grant and signature; every new foe's grant once: the signature, the sender, the cell, the expiry, the member,
//     a member standing once, its marks within the grant's, a class foe of an encounter at the owner's signed level or
//     under, an encounter's or a camp's species one its pixel's tables hold. What it would refuse is TALLIED, by sender
//     and reason, and handed to the cell every GRANT_TALLY_MS (`tally`) - the measure, and GRANT7's evidence. While the
//     law measures the foe stands all the same; while it enforces (GRANT6) the pool stands down a forged grant or none
//     (standsDown). A grant a record names that the reader has not heard is waited for (GRANT_VERDICT_WAIT_MS) - and
//     GRANT-UNHEARD (section 18): one never heard is tallied `ungranted`, never `unsigned`, which a forged signature alone is.
//   - LEFT AS THE OWNER'S WORD, said plainly: a foe's weapon and its health. Each depends on its owner's own settings and
//     state (the Roleplay & Realism assigner, the monster rows' mods, the wilds' scaling), which a seed cannot rebuild -
//     FOE-FORGE's caps hold them (FOE_HEALTH_MAX, the weapon's template law).
import {
  GRANT_ASK_ID_MAX, GRANT_KINDS, GRANT_WAIT_MS, GRANT_RENEW_LEAD_MS, GRANT_RENEW_MAX, GRANT_TALLY_MS, GRANT_TALLY_ROWS_MAX, GRANT_TALLY_COUNT_MAX,
  GRANT_FRAME_GRANTS_MAX, GRANT_SKEW_MS, GRANT_STANDDOWN_REASONS, validGrant, verifyGrant, grantRefusal, grantMarksAllow, wireGrant, grantDice,
} from '../net/grantLaw.js';
import { isNight } from '../world/worldClock.js';
import { isCellRoom, mapPixelOfWire } from '../net/wire.js';
import { staffBossBound } from '../systems/staffEvents.js';   // BOSS-BOUND: a staff event's mini boss, past a plain elite's bound
import { foeStatsRefusal } from '../net/foeBounds.js';   // FOE-BOUNDS: the most health a streamed foe can legally have
import { wildHere, wildMask, wildRingAt, WILD_NEAR_PX } from '../systems/wild/wildZone.js';
import { inEther } from '../world/ethericSea.js';   // ETHER-WILD: the open sea's foes, read from Veilhaven's peace
import { KNIGHT_CITYWATCH_ID } from '../characters/enemy/enemyEntity.js';
import { importPublicKeyB64 } from '../net/identityToken.js';
import { serviceBase } from '../net/accountClient.js';
import { appStorage } from '../systems/appStorage.js';
import { resolveEncounterTableIndex, chooseRandomEnemy } from '../systems/encounters.js';
import { encounterTableChoices, encounterTableGeneration } from '../characters/encounterTableDoor.js';   // DEX3: every table a mod may pick, on any machine
import { isClassEnemyId } from '../characters/enemy/enemyBasics.js';   // DEX1: DFU's class test (DaggerfallEntity.IsClassEnemyId) - a mod's monster past 255 is no class

/** The reader's bounds: the verdicts it keeps (owner and grant), the members it has seen stand, the puppets it knows the
 *  grant of. */
export const GRANT_VERDICTS_MAX = 512;
export const GRANT_MEMBERS_MAX = 2048;
/** How long an heir's game waits for its handed grant (or its handed foe), ms, before it asks a fresh one of its own. */
export const GRANT_HEIR_WAIT_MS = 10_000;
/** How soon a reader asks the relay's key again after it could not, ms. */
export const GRANT_KEY_RETRY_MS = 5 * 60_000;
/** GRANT6: how long a reader waits for a grant a record names before it calls it unheard (`ungranted`), ms - three full frames
 *  (net/online.js FOES_FULL_MS): a reader that came in after the grant went hears it again on the owner's next, and
 *  AUDIT GRANT A2: a full frame carries the grants longest unsaid first, so CELL_FRAME_RECORDS_MAX's sixty-four grants
 *  ride within two of them. */
export const GRANT_VERDICT_WAIT_MS = 6_000;
/** GRANT6: the levels a class foe may stand over its owner's signed one - a character's token says the level its last
 *  judged checkpoint found (server-account/src/realm.js `cl`), and a player gains a level or two between checkpoints. */
export const GRANT_LEVEL_SLACK = 2;
/** GRANT6: how often a stand made while its socket's welcome is owed asks whether the law is said yet, ms. */
const MODE_POLL_MS = 100;
/** AUDIT GRANT A12: how soon a watchman whose grant was refused or never came asks again, ms - the watch's bucket's own
 *  pace (net/grantLaw.js GRANT_KINDS.watch: one a 30 s). */
export const GRANT_WATCH_REASK_MS = 30_000;
/** AUDIT GRANT A13: how many times a carry that went unanswered is asked again before its grants are given up. */
export const GRANT_CARRY_TRIES = 3;

/** The kinds whose species is an encounter table's (a random encounter's, a camp's) - and whose class foes stand at the
 *  owner's level. */
const ROLLED_KINDS = new Set(['enc', 'camp']);
const LEVELLED_KINDS = new Set(['enc', 'camp', 'band', 'encr']);

/** GRANT8 (Spawn-Grants section 16): AN `encr` MEMBER'S SPECIES - its seed's: chooseRandomEnemy (systems/encounters.js,
 *  RandomEncounters.ChooseRandomEnemy) over climate `climate` (a map pixel's - every machine's own CLIMATE.PAK, the
 *  relay's never), in a location's rect or out of one, the grant's world minute's day or night and its owner's signed
 *  level (1 where it signs none), drawn from the member's own species die (net/grantLaw.js grantDice). -1 where the place
 *  rolls none. DEX3: a roll every machine agrees on, so where a mod offers more than one table for the place the die picks
 *  one of them first (characters/encounterTableDoor.js) - never a table a machine's own events picked. Pure.
 *  @param {{ s: number, m: number, l: number }} gr @param {number} i @param {number} climate @param {boolean} inRect */
export function grantSpecies(gr, i, climate, inRect) {
  return chooseRandomEnemy({ climateIndex: climate, inLocationRect: inRect, isDay: !isNight(gr.m), playerLevel: gr.l > 0 ? gr.l : 1 }, grantDice(gr.s, i).species);
}

const _speciesOf = new Map();
/** THE SPECIES A GRANTED ENCOUNTER OR CAMP MAY STAND at climate `c`: every species of its band's three tables - a town's
 *  night, the wild's day, the wild's night (systems/encounters.js resolveEncounterTableIndex). A camp's members are its
 *  seed's faction-mates out of the same table. Null for a climate with no band. Pure. @param {unknown} c */
export function grantSpeciesOf(c) {
  if (!Number.isInteger(c)) return null;
  const key = `${c}:${encounterTableGeneration()}`;   // DEX3: kept per climate while the tables' selectors stand
  if (_speciesOf.has(key)) return _speciesOf.get(key);
  const tables = [{ inLocationRect: true, isDay: false }, { inLocationRect: false, isDay: true }, { inLocationRect: false, isDay: false }]
    .map((o) => resolveEncounterTableIndex({ climateIndex: c, ...o })).filter((i) => i != null);
  const set = tables.length ? new Set(tables.flatMap((i) => encounterTableChoices(/** @type {number} */ (i)).flat())) : null;   // DEX3: every table any machine's mod may have picked
  _speciesOf.set(key, set);
  return set;
}

/** The relay's public half, from the account service's open route - null when it cannot be had. */
async function relayKeyOf({ subtle }) {
  const res = await fetch(`${serviceBase(appStorage())}/v1/relaykey`);   // the storage seam, never the browser's own (a PIN)
  if (!res.ok) return null;
  const j = await res.json().catch(() => null);
  return typeof j?.rk === 'string' ? importPublicKeyB64(j.rk, { subtle }) : null;
}

const capMap = (m, max) => { while (m.size > max) m.delete(m.keys().next().value); };

/**
 * @param {{ session: () => any, climateAt?: ((px: number, py: number) => number)|null, now?: () => number,
 *   fetchKey?: (env: { subtle: SubtleCrypto }) => Promise<CryptoKey|null>, subtle?: SubtleCrypto, wait?: number, verdictWait?: number }} deps
 *   `session` the online session now (null offline); `climateAt` a map pixel's climate (the reader's species law); `now` the
 *   relay's clock
 */
export function createGrantHost({ session, climateAt = null, now = () => Date.now() + (Number(session()?.clockOffsetMs) || 0), fetchKey = relayKeyOf, subtle = globalThis.crypto?.subtle, wait = GRANT_WAIT_MS, verdictWait = GRANT_VERDICT_WAIT_MS }) {
  // AUDIT GRANT A6: `now` the RELAY's clock (net/online.js clockOffsetMs, from the welcome) - a grant's expiry is the relay's
  // ── the asks ─────────────────────────────────────────────────────────────────────────────────────────────────────
  let askId = 0;
  const pending = new Map();   // ask id -> its answer's resolver
  /** The session while its cell's law is on, else null - AUDIT GRANT A2: and its socket open (a closed one's last law is no
   *  law: nothing can be asked of it, and nothing is refused for it). */
  const open = () => { const s = session(); return s && s.status === 'open' && s.grantMode && s.grantMode !== 'off' && typeof s.sendGrant === 'function' ? s : null; };
  /** GRANT6: a socket open whose welcome has not said the law yet (net/online.js: null) - a stand waits on it, so a cell
   *  crossed is never a moment of ungranted stands. */
  const unsaid = () => { const s = session(); return !!s && s.status === 'open' && s.grantMode == null && typeof s.sendGrant === 'function'; };
  /** An ask sent, its id - 0 when it did not go. */
  function send(body) {
    const s = open();
    if (!s) return 0;
    askId = askId >= GRANT_ASK_ID_MAX ? 1 : askId + 1;
    return s.sendGrant({ ...body, id: askId }) ? askId : 0;
  }
  /** An ask whose answer comes back to me, or null (not sent, or no answer inside `wait`). */
  const ask = (body) => new Promise((resolve) => {
    const id = send(body);
    if (!id) { resolve(null); return; }
    const t = setTimeout(() => { pending.delete(id); resolve(null); }, wait);
    pending.set(id, (a) => { clearTimeout(t); resolve(a); });
  });

  // ── the owner's grants ───────────────────────────────────────────────────────────────────────────────────────────
  const live = new Set();   // grants with my members standing
  const queue = new Map();   // kind -> the stands waiting on this turn's ask
  /** A MEMBER FOR A STAND of `kind`: a promise of `{ gr, i }`, `{ refused }` (the law enforcing) or null (no grant came) -
   *  or null at once when no law is on. GRANT6: while the socket's welcome is owed, the stand waits on it (`wait` at most). */
  function memberFor(kind) {
    if (!(open() || unsaid()) || !Object.hasOwn(GRANT_KINDS, kind)) return null;
    return new Promise((resolve) => {
      const q = queue.get(kind);
      if (q) { q.push(resolve); return; }
      queue.set(kind, [resolve]);
      void Promise.resolve().then(() => flush(kind));   // at this turn's end: every stand of the turn asked
    });
  }
  function flush(kind, polls = 0) {
    if (!open() && unsaid() && polls * MODE_POLL_MS < wait) { setTimeout(() => flush(kind, polls + 1), MODE_POLL_MS); return; }
    const all = queue.get(kind) ?? [];
    queue.delete(kind);
    const max = GRANT_KINDS[/** @type {keyof typeof GRANT_KINDS} */ (kind)].max;
    for (let at = 0; at < all.length; at += max) {
      const chunk = all.slice(at, at + max);
      ask({ k: 'mint', kind, n: chunk.length }).then((a) => {
        if (a?.k === 'ok') { const gr = { ...a.gr, _members: 0 }; chunk.forEach((res, i) => res({ gr, i })); }
        else chunk.forEach((res) => res(a?.k === 'no' ? { refused: a.r } : null));
      });
    }
  }
  /** Member `i` of `gr` stands as foe `f`. */
  function stood(gr, i, f) {
    if (!gr || !f) return;
    f._grant = gr; f._grantI = i;
    gr._members = (gr._members ?? 0) + 1;
    live.add(gr);
  }
  /** Foe `f`'s member is gone from my pool; its grant's last frees it. */
  function ended(f) {
    const gr = f?._grant;
    if (!gr) return;
    f._grant = null;
    gr._members = Math.max(0, (gr._members ?? 1) - 1);
    if (gr._members) return;
    live.delete(gr);
    if (!gr._dead && gr.q === open()?.room) post('free', gr.g);   // GRANT4: to the room that holds it - one left behind counts there to its expiry
  }
  /** Foe `f` handed on to socket `to` - its member signed to the heir, then gone from me. */
  function handed(f, to) {
    const gr = f?._grant;
    if (gr && !gr._dead && typeof to === 'string' && to) post('heir', { gr: wireGrant(gr), i: f._grantI, to });
    ended(f);
  }
  /** AUDIT GRANT A7: A TURN'S FREES AND HEIRS, ONE ASK EACH - a cull or a death ends a dozen grants at once, and every ask
   *  spends the socket's one bucket (net/grantLaw.js grantGate), which a camp's mint needs next. The heirs go first: the
   *  relay hands a member on only from a grant it still holds live. */
  const outbox = { heir: [], free: [] };
  let outboxDue = false;
  function post(k, item) {
    outbox[k].push(item);
    if (!outboxDue) { outboxDue = true; void Promise.resolve().then(flushOutbox); }
  }
  function flushOutbox() {
    outboxDue = false;
    const hs = outbox.heir, gs = [...new Set(outbox.free)];
    outbox.heir = []; outbox.free = [];
    for (let at = 0; at < hs.length; at += GRANT_RENEW_MAX) send({ k: 'heir', hs: hs.slice(at, at + GRANT_RENEW_MAX) });
    for (let at = 0; at < gs.length; at += GRANT_RENEW_MAX) send({ k: 'free', gs: gs.slice(at, at + GRANT_RENEW_MAX) });
  }
  let renewing = false, carrying = false, lastRoom = null, carryTo = null, carryTries = 0, tallyAt = now();
  async function renew(gs) {
    renewing = true;
    const a = await ask({ k: 'renew', grs: gs.map(wireGrant) });   // AUDIT GRANT A8: whole, so a relay that forgot them signs them again
    renewing = false;
    if (a?.k !== 'renew') return;
    for (const ng of a.grs) { const g = gs.find((x) => x.g === ng.g); if (g) { g.x = ng.x; g.sg = ng.sg; } }
  }
  /** AUDIT GRANT A13: a carry's answer is the cell's word on each grant - one it refused (null) is given up; one never
   *  answered (a timeout, an answer gone to a socket that is now a halo's) is carried again while I stand in a cell,
   *  GRANT_CARRY_TRIES times, then given up. */
  async function carry(room) {
    const gs = [...live].filter((g) => !g._dead && g.q !== room && isCellRoom(g.q));
    if (!gs.length) return;
    carrying = true;
    let unanswered = false;
    for (let at = 0; at < gs.length; at += GRANT_RENEW_MAX) {
      const chunk = gs.slice(at, at + GRANT_RENEW_MAX);
      const a = await ask({ k: 'carry', grs: chunk.map(wireGrant) });
      if (a?.k !== 'carry') { unanswered = true; continue; }
      chunk.forEach((g, i) => { const ng = a.grs[i]; if (ng) Object.assign(g, { g: ng.g, q: ng.q, x: ng.x, sg: ng.sg }); else g._dead = true; });
    }
    carrying = false;
    if (!unanswered) { carryTries = 0; return; }
    if (++carryTries < GRANT_CARRY_TRIES) { if (!carryTo && isCellRoom(open()?.room)) carryTo = open().room; return; }
    carryTries = 0;
    for (const g of gs) if (g.q !== open()?.room) g._dead = true;
  }
  /** THE CLOCK, the pool's frame: carry, renew, drop the expired, hand the tally on, the heirs' waits. */
  function tick() {
    const s = open(), t = now();
    if (s) {
      if (s.room !== lastRoom) { const from = lastRoom; lastRoom = s.room; carryTo = from && isCellRoom(s.room) ? s.room : null; carryTries = 0; }   // GRANT4: cell to cell - a world room's grants stay its own (carry: a cell's alone)
      if (carryTo && !carrying) { const to = carryTo; carryTo = null; if (to === s.room) void carry(to); }   // AUDIT GRANT A13: a crossing made while a carry was out is carried when it lands
      if (!renewing && !carrying) {
        const due = [...live].filter((g) => !g._dead && g.q === s.room && g.x - t <= GRANT_RENEW_LEAD_MS).slice(0, GRANT_RENEW_MAX);
        if (due.length) void renew(due);
      }
    }
    for (const g of live) if (t > g.x + GRANT_SKEW_MS) { g._dead = true; live.delete(g); }   // GRANT4: an expired grant is no longer mine to renew or free (a room left keeps none)
    if (t - tallyAt >= GRANT_TALLY_MS) { tallyAt = t; flushTally(); }
    for (const [k, w] of heirWaits) {
      if (t - w.at < GRANT_HEIR_WAIT_MS) continue;
      heirWaits.delete(k);
      const f = w.f;
      if (!f.dead && !f.puppet && !f._grant) memberFor(w.k === 'encr' ? 'enc' : w.k)?.then((m) => { if (m && 'gr' in m && !f.dead && !f._grant) stood(m.gr, m.i, f); });   // AUDIT GRANT A14: `encr` the relay's answer, never an ask
    }
    for (const [k, h] of heirGrants) if (t - h.at >= GRANT_HEIR_WAIT_MS) heirGrants.delete(k);
  }
  /** THE FRAME'S GRANTS: of the grants its records name, each signed since it last went, and on a full frame the rest -
   *  AUDIT GRANT A2: the longest unsaid first, GRANT_FRAME_GRANTS_MAX a frame, so a reader that came in late hears every
   *  grant within a few full frames, never the same first ones again and again - its wire form. */
  let fullSeq = 0;
  function frameGrants(grs, full) {
    const fresh = [], rest = [];
    for (const g of new Set(grs)) {
      if (!g || g._dead) continue;
      if (g._gsSent !== g.sg) fresh.push(g);
      else if (full) rest.push(g);
    }
    if (full) { fullSeq++; rest.sort((a, b) => (a._gsFull ?? 0) - (b._gsFull ?? 0)); }
    const out = [...fresh, ...rest].slice(0, GRANT_FRAME_GRANTS_MAX);
    for (const g of out) { g._gsSent = g.sg; if (full) g._gsFull = fullSeq; }
    return out.map(wireGrant);
  }

  // ── the heir's ───────────────────────────────────────────────────────────────────────────────────────────────────
  const heirGrants = new Map();   // `${seed}:${member}` -> a handed grant come before its foe
  const heirWaits = new Map();    // `${seed}:${member}` -> a foe I took whose grant has not come
  function heirArrived(gr) {
    const k = `${gr.s}:${gr.h}`;
    const w = heirWaits.get(k);
    if (w) { heirWaits.delete(k); if (!w.f.dead && !w.f.puppet && !w.f._grant) stood({ ...gr, _members: 0 }, gr.h, w.f); return; }
    heirGrants.set(k, { gr, at: now() });
  }
  /** I took foe `f` of `from` (its puppet's number still its owner's - `seq`, a dungeon's own lane's `_ownI`): its member's
   *  handed grant, now or when it comes. */
  function adopted(from, f, seq = f.seq) {
    const m = pups.get(`${from}|${seq}`);
    if (!m) return;
    const k = `${m.s}:${m.i}`;
    const h = heirGrants.get(k);
    if (h) { heirGrants.delete(k); stood({ ...h.gr, _members: 0 }, h.gr.h, f); return; }
    heirWaits.set(k, { f, at: now(), k: m.k });
  }

  // ── the reader's ─────────────────────────────────────────────────────────────────────────────────────────────────
  let keyP = /** @type {Promise<CryptoKey|null>|null} */ (null), keyAt = -Infinity, keyHeld = false;
  function key() {
    if (keyP && (keyHeld || now() - keyAt < GRANT_KEY_RETRY_MS)) return keyP;
    keyAt = now();
    keyP = Promise.resolve().then(() => fetchKey({ subtle })).catch(() => null).then((k) => { keyHeld = !!k; return k; });
    return keyP;
  }
  const verdicts = new Map();   // `${owner}|${grant}` -> { gr, sg, ok }
  const members = new Map();    // `${owner}|${grant}|${member}` -> the record's number standing on it
  const pups = new Map();       // `${owner}|${record}` -> { s, i, k }: what a puppet's grant was
  const tallies = new Map();    // `${owner}|${reason}` -> how many
  const capable = new Set();    // owners that have carried a grant: a hostile record of theirs with none is `ungranted`
  const waiters = new Map();    // `${owner}|${grant}` -> the checks waiting to hear it (GRANT6)
  const verdictOf = new Map();  // `${owner}|${record}` -> { k, why }: a record's refusal, by the grant it named (AUDIT GRANT A11)
  /** A frame's grants heard from `from`: each read whole and its signature checked, once per owner, grant and signature. */
  function heard(from, gs) {
    if (!Array.isArray(gs) || !gs.length) return;
    capable.add(from);
    capMap(capable, GRANT_VERDICTS_MAX);
    for (const raw of gs.slice(0, GRANT_FRAME_GRANTS_MAX)) {
      const gr = validGrant(raw);
      if (!gr || typeof gr.sg !== 'string') { note(from, 'unsigned'); continue; }
      const k = `${from}|${gr.g}`;
      if (verdicts.get(k)?.sg === gr.sg) continue;
      verdicts.set(k, { gr, sg: gr.sg, ok: key().then((pk) => (pk ? verifyGrant(gr, pk, { subtle }) : null)) });
      capMap(verdicts, GRANT_VERDICTS_MAX);
      const w = waiters.get(k);
      if (w) { waiters.delete(k); for (const res of w) res(verdicts.get(k)); }
    }
  }
  /** GRANT6: a grant a record names that this reader has not heard yet - its verdict once a frame carries it, or null
   *  after GRANT_VERDICT_WAIT_MS. */
  function heardOf(k) {
    return new Promise((resolve) => {
      const w = waiters.get(k) ?? [];
      if (!w.length) { waiters.set(k, w); capMap(waiters, GRANT_VERDICTS_MAX); }
      w.push(resolve);
      setTimeout(() => { const at = w.indexOf(resolve); if (at >= 0) { w.splice(at, 1); if (!w.length && waiters.get(k) === w) waiters.delete(k); resolve(null); } }, verdictWait);
    });
  }
  /**
   * A NEW FOE'S CHECK - record `r` from `from` in cell `cell` (null: the room my session stands in - GRANT4, a dungeon's
   * own lane keys its frames by the dungeon, not the room): a promise of the reason it would be refused, tallied, or
   * null. Null too while the relay's key cannot be had (judged by nobody, refused for nothing).
   * @param {string} from @param {string|null} cell @param {any} r
   */
  async function check(from, cell, r) {
    const memo = judged(from, r);
    if (memo) return memo.why;   // AUDIT GRANT A11: a record judged once is never tallied twice
    const why = await judge(from, cell, r);
    if (why) { verdictOf.set(`${from}|${r?.i}`, { k: grKey(r), why }); capMap(verdictOf, GRANT_MEMBERS_MAX); }
    return why;
  }
  /** AUDIT GRANT A11: a record's grant, as a memo's key. */
  const grKey = (r) => (Array.isArray(r?.gr) ? r.gr.join(':') : '-');
  /** AUDIT GRANT A11: the refusal this record was judged with, while it still names the same grant - GRANT-UNHEARD: a grant
   *  unheard (`ungranted` naming one) only until it is heard (a reader that came in late judges it again then); a
   *  signature that failed (`unsigned`) for good. */
  function judged(from, r) {
    const v = verdictOf.get(`${from}|${r?.i}`);
    if (!v || v.k !== grKey(r)) return null;
    if (v.why === 'ungranted' && r?.gr && verdicts.has(`${from}|${r.gr[0]}`)) return null;   // GRANT-UNHEARD: a grant unheard, heard since
    return v;
  }
  /** AUDIT GRANT A11: would an enforcing reader stand this record down on its last verdict? The pools ask it before they
   *  build a puppet again, so a foe stood down is not rebuilt, checked and tallied on every frame. */
  const downed = (from, r) => { const v = judged(from, r); return !!v && standsDown(v.why); };
  async function judge(from, cell, r) {
    if (!r?.gr) return capable.has(from) || session()?.grantSenders?.has(from) ? note(from, 'ungranted') : null;   // GRANT4: the City Watch's too (watchReady); GRANT-DOOR: a sender the relay vouches stands on grants (net/online.js grantSenders)
    const [g, i] = r.gr;
    const v = verdicts.get(`${from}|${g}`) ?? await heardOf(`${from}|${g}`);
    if (!v) return note(from, 'ungranted');   // GRANT-UNHEARD: never heard is no forgery - the relay drops frames past its byte budget, the full ones (the grants') first
    const ok = await v.ok;
    if (ok === null) return null;
    if (!ok) return note(from, 'unsigned');
    pups.set(`${from}|${r.i}`, { s: v.gr.s, i, k: v.gr.k });
    capMap(pups, GRANT_MEMBERS_MAX);
    const at = cell ?? session()?.room ?? '';
    const why = grantRefusal(v.gr, { from, cell: at, cover: session()?.coverOf?.(at) ?? at, nowMs: now(), i })   // COST-2 (b): in any cell the socket it came on covers
      ?? (!grantMarksAllow(v.gr, i, r) ? 'marks' : null)
      ?? diceRefusal(v.gr, r)
      ?? twice(from, g, i, r.i);
    return why ? note(from, why) : null;
  }
  /** What a seed cannot rebuild left aside, what it bounds: a rolled kind's species from its pixel's tables, a levelled
   *  kind's class foe at the owner's signed level or under, GRANT_LEVEL_SLACK aside (a guest's 0 says none), the watch's
   *  a watchman. */
  function diceRefusal(gr, r) {
    if (gr.k === 'watch' && r.t !== KNIGHT_CITYWATCH_ID) return 'dice';   // GRANT4: the watch's grant stands the watch alone
    if (gr.k === 'encr' && climateAt) {   // GRANT8: its seed's species exactly - out of a location's rect or in one (its owner's place, which a reader cannot see)
      const c = climateAt(gr.p[0], gr.p[1]), i = r.gr[1];
      if (r.t !== grantSpecies(gr, i, c, false) && r.t !== grantSpecies(gr, i, c, true)) return 'dice';
    }
    if (LEVELLED_KINDS.has(gr.k) && isClassEnemyId(r.t) && gr.l > 0 && Number.isInteger(r.l) && r.l > gr.l + GRANT_LEVEL_SLACK) return 'dice';
    if (ROLLED_KINDS.has(gr.k) && climateAt) {
      const set = grantSpeciesOf(climateAt(gr.p[0], gr.p[1]));
      if (set && !set.has(r.t)) return 'dice';
    }
    return null;
  }
  function twice(from, g, i, seq) {
    const k = `${from}|${g}|${i}`, was = members.get(k);
    members.set(k, seq);
    capMap(members, GRANT_MEMBERS_MAX);
    return was !== undefined && was !== seq ? 'twice' : null;
  }
  /** FOE-BOUNDS (Spawn-Grants section 19): MAY THE OPEN ZONE BE ABOUT RECORD `r`? Its lane's own question - a street's
   *  foe in a cell by its own pixel (WILD_NEAR_PX about it: its owner's ring is the owner's feet, a stride away), anything
   *  else by the zone under my own feet (a building's and a dungeon's: its door's) - and yes while no zone is known. */
  function wildAbout(r, lane) {
    const mask = wildMask();
    if (!mask || wildHere()) return true;
    if (lane !== 'street' || !isCellRoom(session()?.room) || !Array.isArray(r?.f)) return false;
    const [px, py] = mapPixelOfWire(r.f[0], r.f[2]);
    if (inEther(px, py)) return true;   // ETHER-WILD: past the Veil the zone is everywhere but Veilhaven's peace - a foe stood by an owner a stride over its edge is the zone's (a wider bound only allows)
    for (let dy = -WILD_NEAR_PX; dy <= WILD_NEAR_PX; dy++) for (let dx = -WILD_NEAR_PX; dx <= WILD_NEAR_PX; dx++) if (wildRingAt(px + dx, py + dy, mask) > 0) return true;
    return false;
  }
  const statsSaid = new Set();   // `${owner}|${record}`: a record refused for its health, tallied once (the spec's one case an enemy)
  /**
   * FOE-BOUNDS (Spawn-Grants section 19; the hand-off spec "REJECT AND REMOVE INVALID ENEMY HANDOFFS; DO NOT RESCALE"):
   * IS RECORD `r` FROM `from` PROVABLY IMPOSSIBLE - a health no builder could give it (net/foeBounds.js foeStatsRefusal)?
   * Then its pool stands nothing of it - never builds it, never updates its copy, never ADOPTS it (a hand-off of it is
   * refused before it is mine, so it never rides as mine and its receiver is never blamed) - and takes down a copy
   * already standing, silently (no death, no body, no loot, no experience). Tallied `stats` against its sender, once a
   * record. Judged whenever the law is on, measuring or enforcing - a bound is no estimate - and never while it is off
   * (`/relay grantMode off`, the staff's own switch). `lane` 'street' (a cell's pool or a building's) or 'dungeon';
   * `camp` its frame tags it a camp's; `ally` an ally, a companion or a crewman (unverified: never refused).
   * @param {string} from @param {any} r @param {{ lane?: 'street'|'dungeon', camp?: boolean, ally?: boolean, boss?: string|null }} [o] `boss` a staff event's raid key when the record is its mini boss (BOSS-BOUND)
   */
  function statsRefused(from, r, { lane = 'street', camp = false, ally = false, boss = null } = {}) {
    if (ally || !open() || typeof from !== 'string') return false;
    const s = foeStatsRefusal(r, { lane, wild: wildAbout(r, lane), camp });
    if (!s) return false;
    if (typeof boss === 'string') { const b = staffBossBound(boss, s.mx); if (b !== null && s.k <= b) return false; }   // BOSS-BOUND: a live staff event's mini boss, held to its event's own health
    const k = `${from}|${r.i}`;
    if (!statsSaid.has(k)) { statsSaid.add(k); capMap(statsSaid, GRANT_MEMBERS_MAX); note(from, 'stats'); }
    return true;
  }
  function note(from, why) {
    const k = `${from}|${why}`;
    tallies.set(k, Math.min(GRANT_TALLY_COUNT_MAX, (tallies.get(k) ?? 0) + 1));
    return why;
  }
  function flushTally() {
    if (!tallies.size) return;
    const said = session()?.grantStatsOk;   // FOE-BOUNDS: `stats` to a relay that knows the word (net/grantLaw.js relaySupportsGrantStats) - an older one refuses the whole tally
    const rows = [...tallies].filter(([k]) => said || !k.endsWith('|stats')).sort((a, b) => b[1] - a[1]).slice(0, GRANT_TALLY_ROWS_MAX).map(([k, n]) => { const at = k.lastIndexOf('|'); return { o: k.slice(0, at), r: k.slice(at + 1), n }; });
    tallies.clear();
    if (rows.length) send({ k: 'tally', rows });
  }

  /** My cell's answer (net/online.js onGrant): an heir's grant, or the answer an ask of mine waits on. */
  function answer(a) {
    if (!a) return;
    if (a.k === 'heir') { heirArrived(a.gr); return; }
    const res = pending.get(a.id);
    if (res) { pending.delete(a.id); res(a); }
  }
  /** GRANT8: my `encr` member's species - its seed's at its pixel's climate (-1: none, or no map to read). */
  const speciesOf = (gr, i, inRect) => (gr?.k === 'encr' && climateAt ? grantSpecies(gr, i, climateAt(gr.p[0], gr.p[1]), !!inRect) : -1);
  /** Is the law enforcing in my cell (GRANT6: the pool stands down what the check refuses)? */
  const enforcing = () => open()?.grantMode === 'enforce';
  /** GRANT6: does an enforcing reader stand down a foe its check refused for `why` (GRANT_STANDDOWN_REASONS)? */
  const standsDown = (why) => !!why && enforcing() && GRANT_STANDDOWN_REASONS.includes(why);

  // ── the watch's ──────────────────────────────────────────────────────────────────────────────────────────────────
  const watchmen = new Map();   // my watchmen standing on a grant -> the pool that streams them (AUDIT GRANT A3)
  /** GRANT4: A WATCHMAN'S GRANT, asked as the pool first streams him (his own pool, scenes/cityGuards.js, stands him, and
   *  only the pool that streams him knows he rides): whether his record may go now - his grant come, or his ask answered
   *  or `wait` past without one (while the law enforces, never without one), or no law to ask. */
  function watchReady(g, pool = null) {
    if (!g || g._grant) return true;
    if (g._grantDone && now() - g._grantAt >= GRANT_WATCH_REASK_MS) { g._grantAt = undefined; g._grantDone = false; }   // AUDIT GRANT A12: refused or never come - asked again at the watch's pace
    if (g._grantAt === undefined) {
      const m = memberFor('watch');
      if (!m) return true;
      g._grantAt = now();
      void m.then((a) => { g._grantDone = true; if (a && 'gr' in a && !g._grant && !g._gone) { stood(a.gr, a.i, g); watchmen.set(g, pool); } });
      return false;
    }
    if (!g._grantDone && now() - g._grantAt < wait) return false;
    return !enforcing();
  }
  /** GRANT4: the watchmen gone from the list his pool streams - each one's member ended (`list` the pool's watch now).
   *  AUDIT GRANT A3: the street's pool and a building's share this host, so each sweeps its own watchmen alone (`pool`). */
  function watchSweep(list, pool = null) {
    if (!watchmen.size) return;
    const here = new Set(list);
    for (const [g, p] of watchmen) if (p === pool && (!here.has(g) || g._gone)) { watchmen.delete(g); ended(g); }
  }

  return { memberFor, stood, ended, handed, tick, frameGrants, adopted, heard, check, downed, statsRefused, answer, enforcing, standsDown, watchReady, watchSweep, speciesOf, tallied: () => new Map(tallies), live: () => [...live] };
}
