// @ts-check
// WITCH1 (2026-10-20, bible/06-Systems/Witches-Festival.md): THE WITCHES' FESTIVAL, AS THIS PAGE PLAYS IT - the one home
// of the client's half of the economy: the Soul Cakes this account holds (the service's count, the pack's stack its face),
// the finds a kill and an act ask for, the Wyrd Sister's sales, and the moves on a Hearth Offering.
//
// THE SERVICE DECIDES, THIS PAGE ASKS (net/festivalLaw.js; server-account/src/festival.js). A kill my own blow made
// (systems/playerKills.js - every pool's word, a dungeon's room bodies and a foe another machine runs among them), an act
// of mine (systems/questlines/qlActs.js), a quest of mine done and a bounty paid each ask for a find by its source; the
// service's die decides it and caps the day. Every find lands in the pack: the pack's cakes are the count's face, and a
// face on a body is a face the count cannot see. Asks run one after another (a fight's kills, in order), never dropped. A
// find whose ask never reached the service was a die never rolled - nothing is owed, so nothing is kept to ask again.
//
// A SALE IS ASKED BY ITS OWN ID and kept on the character's save until its answer lands (`pending`, systems/
// modSaveData.js), under the account that made it (AUDIT 28 M2's law, net/marksBook.js): an answer lost - a closed tab, a
// dropped line, an overloaded service - is asked again by the same id at the next refresh, the service answers `repeat`
// with the ware it sold, and the ware is minted then, ONCE: one ask of a sale is in flight at a time, and an answer mints
// only while its sale is still the one pending. Only a refusal that says the sale never happened lets it go.
//
// HOSTS: the world host binds its doors (bindFestival - online, the player, a line, the save, the room - scenes/
// witchesHost.js). Unbound - the ?exterior bench, a pin - nothing is asked and nothing is found: the festival is the
// online realm's (the decorations are the calendar's, world/witchesDecor.js).
//
// Not a DFU member. Ledger A (THE WITCHES' FESTIVAL).
import { accountFestival, equipTitle, equipAura, equipIcon, adoptIdentity, storedSession, serviceBase, readAccount, accountRefusalText } from '../../net/accountClient.js';
import { appStorage } from '../appStorage.js';
import { registerPlayerKillListener } from '../playerKills.js';
import { hearActs, ACT_KINDS } from '../questlines/qlActs.js';
import { registerModSaveData } from '../modSaveData.js';
import { KNIGHT_CITY_WATCH } from '../../characters/mobile/mobileTypes.js';
import { festivalOpen, isFindSource, wareById, accountWare, bowlWare, festivalWaresHeld, SALE_RID_RE, FIND_CAKES_PER_DAY } from '../../net/festivalLaw.js';
import { utcDay } from '../../net/marksLaw.js';   // CAKE-CAP-SAID: the service's own day (server-account/src/festival.js)
import { restackSoulCakes, restackHearthOfferings, isHearthOffering } from './soulCake.js';
import { foeFindSource } from './festivalFoes.js';
import { cakesFoundText, festivalRefusalText, isFestivalRefusal, findsFullText } from './festivalWords.js';
import { wyrdPieceById } from '../aetheric.js';
import { mintIliacCard } from '../iliac/iliacItems.js';
import { addItem } from '../inventory.js';

/** The kill listener's and the act hearer's name. */
export const FESTIVAL_FIND = 'festival-find';

const NO_DOORS = Object.freeze({ online: () => false, entity: () => null, say: (/** @type {string} */ _l) => {}, selfId: () => null, saved: () => {}, room: () => null, nowMs: () => Date.now() });
/** @type {any} */
let _doors = NO_DOORS;
/** @type {any} */
let _api = null;
/** @typedef {{ cakes: number|null, bowls: number|null, wares: string[], given: number|null, taken: number|null, offerings: any[], open: boolean|null, today: number|null, todayDay: number|null, fullDay: number|null }} FestivalState */
/** What no answer has said: nothing known - every count null (unknown, never a known nought), nothing held or standing. */
const UNHEARD = Object.freeze({ cakes: null, bowls: null, wares: [], given: null, taken: null, offerings: [], open: null, today: null, todayDay: null, fullDay: null });
/** The account's festival as the service last said it: its cakes and bowls, its wares, given and taken, its own offerings
 *  standing, and whether the festival is open for it - and the account it was said for (`_stateOf`): another signed in
 *  hears nothing of it (AUDIT WITCH1 G2). */
let _state = /** @type {FestivalState} */ (UNHEARD), _stateOf = /** @type {string|null} */ (null);
const _hear = new Set();
let _version = 0;
const changed = () => { _version++; for (const fn of _hear) { try { fn(); } catch { /* a listener's throw is not ours */ } } };

/** THE HOST'S DOORS: `online()` the world plays online, `entity()` the player, `say(line)` a line on the screen,
 *  `selfId()` this client's peer id, `saved()` the save asked for, `room()` the relay's client (my own badge worn at once -
 *  net/online.js adoptIdentity), `nowMs()` the shared clock (the relay's - this machine's clock and its offset). Null
 *  unbinds. Answers the door to the service (or null). */
export function bindFestival(doors = null) {
  _doors = doors ? { ...NO_DOORS, ...doors } : NO_DOORS;
  _api = doors ? (doors.api ?? accountFestival({ fetch: (/** @type {any} */ u, /** @type {any} */ i) => globalThis.fetch(u, i), storage: appStorage() })) : null;
  if (doors) refreshFestival().catch(() => {});
  return _api;
}
/** The doors bound now (the host module and the window read them). */
export const festivalDoors = () => _doors;
/** A listener told whenever the account's festival changes; answers its unregistering. */
export function hearFestival(/** @type {() => void} */ fn) { _hear.add(fn); return () => { _hear.delete(fn); }; }
export const festivalVersion = () => _version;
/** The account's festival as last heard. */
export const festivalState = () => (_stateOf === festivalAccount() ? _state : UNHEARD);
/** The clock the festival's days are read by on this page. The decorations are the calendar's, so the device's own; what
 *  a find, a sale and an offering may do is the service's days, read off the shared clock (the host's `nowMs`). */
export const festivalNowMs = () => _doors.nowMs();
/** WHY THIS PAGE DOES NOT PLAY THE FESTIVAL NOW - `offline` (unbound, or no relay), `guest` (signed out, or a guest's
 *  session: a guest's cakes would be a cleared browser's), `closed` (outside its days, or the service has said it is shut
 *  for this account) - or null when it does. */
export function festivalShut() {
  if (!_api || !_doors.online()) return 'offline';
  const s = storedSession(appStorage());
  if (!s || s.kind === 'guest') return 'guest';
  if (!festivalOpen(festivalNowMs()) || festivalState().open === false) return 'closed';
  return null;
}
/** The account this page asks for (the stored session's), or null - a host clears what it stood when it changes. */
export const festivalAccount = () => _api?.me?.() ?? storedSession(appStorage())?.id ?? null;
/** Whether this page plays the festival now: bound, online, a registered account, inside its days, open for it. */
export const festivalLive = () => festivalShut() == null;
/** A refusal's line: the festival's own words, else the account service's (a session signed out, a ban, its fault). */
const refusalText = (/** @type {unknown} */ code) => (isFestivalRefusal(code) || typeof code !== 'string' ? festivalRefusalText(code) : accountRefusalText(code));

/** Lay an answer's counts on the state and the pack: `cakes` and `bowls` the account's, the pack's stacks their faces. */
function learn(/** @type {any} */ d) {
  if (!d || typeof d !== 'object') return;
  const who = festivalAccount();
  if (who !== _stateOf) { _state = UNHEARD; _stateOf = who; }
  let moved = false;
  const items = _doors.entity()?.items;
  if (Number.isSafeInteger(d.cakes) && d.cakes >= 0) {
    _state = { ..._state, cakes: d.cakes };
    if (Array.isArray(items) && restackSoulCakes(items, d.cakes)) _doors.saved();
    moved = true;
  }
  if (Number.isSafeInteger(d.bowls) && d.bowls >= 0) {
    _state = { ..._state, bowls: d.bowls };
    if (Array.isArray(items) && restackHearthOfferings(items, d.bowls)) _doors.saved();
    moved = true;
  }
  if (Array.isArray(d.wares)) { _state = { ..._state, wares: festivalWaresHeld(d.wares.join(' ')) }; moved = true; }
  for (const k of ['given', 'taken']) if (Number.isSafeInteger(d[k])) { _state = { ..._state, [k]: d[k] }; moved = true; }
  if (Array.isArray(d.offerings)) { _state = { ..._state, offerings: d.offerings }; moved = true; }
  if (typeof d.open === 'boolean') { _state = { ..._state, open: d.open }; moved = true; }
  // CAKE-CAP-SAID: the day's finds as the service counts them (`today`, the UTC day it was said in), and the day it said
  // they are all found (a find's `capped: true`, or the refusal once the day's asks are spent)
  if (Number.isSafeInteger(d.today) && d.today >= 0) { _state = { ..._state, today: d.today, todayDay: findDay() }; moved = true; }
  if (d.capped === true || d.error === 'capped') { _state = { ..._state, fullDay: findDay() }; moved = true; }
  if (moved) changed();
}

/** CAKE-CAP-SAID: the UTC day the service counts a day's finds in (marksLaw utcDay, its own), on the shared clock. */
const findDay = () => utcDay(festivalNowMs() / 1000);
/**
 * CAKE-CAP-SAID (FIELD BUGS 2026-10-21b, "Soul Cake stopped dropping"): THE DAY'S FINDS - `{ found, max, full, resetMs }`:
 * the cakes found this UTC day (null while no answer has said; a count said on an earlier day is this day's 0), the day's
 * most (FIND_CAKES_PER_DAY), whether the service has said they are all found, and when the next day opens.
 */
export function festivalFindsToday() {
  const s = festivalState(), day = findDay();
  const found = s.today == null ? null : s.todayDay === day ? s.today : 0;
  return { found, max: FIND_CAKES_PER_DAY, full: s.fullDay === day || (found ?? 0) >= FIND_CAKES_PER_DAY, resetMs: (day + 1) * 86_400_000 };
}
/** The account and day the day's end was last said for: said once a day, an account. */
let _fullSaid = /** @type {string|null} */ (null);
/** Say the day's finds are spent and when more are found - once a UTC day for an account, never while they are not. */
function sayDayFull() {
  const today = festivalFindsToday();
  if (!today.full) return;
  const key = `${festivalAccount()}:${findDay()}`;
  if (_fullSaid === key) return;
  _fullSaid = key;
  _doors.say(findsFullText(today.max, today.resetMs));
}

/** Ask the service for the account's festival, and a pending sale's answer after it. Answers whether it was heard. */
export async function refreshFestival() {
  if (!_api || !_doors.online()) return false;
  const r = await _api.mine().catch(() => null);
  if (!r?.ok) return false;
  learn(r.data);
  await resumeSale();
  return true;
}

// ═══ THE FINDS ═══════════════════════════════════════════════════════════════════════════════════════════════════════
let _chain = Promise.resolve();
/** @type {WeakSet<object>} */
const _asked = new WeakSet();
/** A kill that never pays (Renown's own rule, net/renownTracker.js neverPays): the city watch, and my own ally. */
const neverPays = (/** @type {any} */ e) => e?.mobileType === KNIGHT_CITY_WATCH || e?.team === 'PlayerAlly' || e?.mobileTeam === 'PlayerAlly';
/**
 * ASK FOR A FIND: `source` (festivalLaw FIND_SOURCES), queued behind the asks before it; the cakes it gives land in the
 * pack (the count's face). Answers a promise of the cakes found.
 * @param {string} source
 */
export function askFind(source) {
  if (!isFindSource(source) || !festivalLive()) return Promise.resolve(0);
  const run = async () => {
    // CAKE-CAP-SAID: the day's finds spent, nothing is asked until the day turns - a find past them was a miss's answer
    // and a write for nothing, every kill - and the player is told why (once a day)
    if (festivalFindsToday().full) { sayDayFull(); return 0; }
    const r = await _api.find(source).catch(() => null);
    const d = r?.ok ? r.data : r;   // a refusal (`capped`) carries the count too
    const found = r?.ok && Number.isSafeInteger(d?.found) ? d.found : 0;
    learn(d);
    if (found > 0) _doors.say(cakesFoundText(found));
    sayDayFull();
    return found;
  };
  const p = _chain.then(run, run);
  _chain = p.catch(() => 0);
  return p;
}
/** A DFU quest of mine done (scenes/quest/questBridge.js onQuestEnded): a find, as the world's events give. */
export function festivalQuestEnded(/** @type {any} */ q) { if (q?.questSuccess) askFind('world'); }
/** A bounty of mine paid (scenes/bountyHost.js): the same. */
export const festivalBountyPaid = () => askFind('world');

/** A kill my blow made: one find by the foe's kind - once a body, whichever pool says it; a world boss's none (its
 *  deed's act is its find - foeFindSource). */
registerPlayerKillListener(FESTIVAL_FIND, (/** @type {any} */ entity) => {
  if (!entity || typeof entity !== 'object' || neverPays(entity) || _asked.has(entity)) return;
  const source = foeFindSource(entity);
  if (!source) return;
  _asked.add(entity);
  askFind(source);
});
/** ONE DEED, ONE FIND: an elite foe's fall is its kill's find (`elite`, above), never its act's too; and the acts one
 *  receipt says together - a breach closed with its rite broken, a Valkynaz's Redoubt taken - ask one find of their family,
 *  not one each (the acts a turn says are one deed). AUDIT STAR8 T1: and a Wyrd Sister's window opened is no deed at all -
 *  a press at her door is never a Soul Cake. */
const ACT_NOT_FOUND = Object.freeze(['elite-foe-slain', 'wyrd-met']);
let _actTurn = /** @type {Set<string>|null} */ (null);
hearActs(FESTIVAL_FIND, (/** @type {string} */ kind) => {
  const g = ACT_KINDS[/** @type {keyof typeof ACT_KINDS} */ (kind)];
  if (!g || ACT_NOT_FOUND.includes(kind)) return;
  if (!_actTurn) { _actTurn = new Set(); Promise.resolve().then(() => { _actTurn = null; }); }   // the turn over, the next deed its own
  if (_actTurn.has(g)) return;
  _actTurn.add(g);
  askFind(g);
});

// ═══ THE SALES ═══════════════════════════════════════════════════════════════════════════════════════════════════════
/** The sale asked and not yet answered, on the character's save: `{ rid, ware, account }` or null. */
let _pending = /** @type {{ rid: string, ware: string, account: string } | null} */ (null);
/** The ask of the pending sale in flight (one at a time): `{ sale, p }`. */
let _asking = /** @type {{ sale: object, p: Promise<any> } | null} */ (null);
export const FESTIVAL_SAVE_VENDOR = 'WitchesFestival';
/** The refusals that say a sale never happened (server-account/src/festival.js buyFestival) - the only answers that let a
 *  kept sale go. Every other (no answer, a session signed out, a ban, the service's fault) keeps it to ask again. */
export const SALE_FINAL = Object.freeze(['ware', 'rid', 'owned', 'cakes', 'closed', 'rate']);
const validPending = (/** @type {any} */ r) => (r && typeof r.rid === 'string' && SALE_RID_RE.test(r.rid) && wareById(r.ware) && typeof r.account === 'string' && r.account
  ? { rid: r.rid, ware: r.ware, account: r.account } : null);
registerModSaveData(FESTIVAL_SAVE_VENDOR, {
  newSaveData: () => ({ pending: null }),
  getSaveData: () => ({ pending: _pending ? { ..._pending } : null }),
  restoreSaveData: (/** @type {any} */ r) => { _pending = validPending(r?.pending); _asking = null; },
});
export const pendingSale = () => _pending;
/** Twelve hex digits for a sale's id. */
export function saleRid(rand = Math.random) {
  let s = '';
  for (let i = 0; i < 12; i++) s += Math.floor(rand() * 16).toString(16);
  return s;
}
/** The pack's piece a ware mints, or null for one the account holds (a title, an aura, an icon, the Hearth Offering's
 *  bowl - the service's to count). A Raiment piece is BOUND to its buyer, as the Sigil Broker's are: the cakes that bought
 *  it are bound, and it is never gold or another player's. */
export function wareItem(/** @type {any} */ w) {
  if (!w || accountWare(w) || bowlWare(w)) return null;
  if (w.kind === 'piece') { const it = wyrdPieceById(w.key); if (it) it.bound = true; return it; }
  if (w.kind === 'card') return mintIliacCard(w.key);
  return null;
}
/** A sale answered: while it is still the one pending, its ware minted into the pack (once) and let go; the counts and the
 *  wares learned either way. */
function landSale(/** @type {object} */ sale, /** @type {any} */ d) {
  if (_pending !== sale) { learn(d); return wareById(d?.ware); }
  _pending = null;
  const w = wareById(d?.ware);
  const items = _doors.entity()?.items;
  const item = wareItem(w);
  if (item && Array.isArray(items)) addItem(items, item);
  learn(d);
  _doors.saved();
  return w;
}
/** ONE ASK OF A SALE IN FLIGHT: its answer landed (or, final, let go); answers the service's reply. */
function askSale(/** @type {{ rid: string, ware: string, account: string }} */ sale) {
  if (_asking?.sale === sale) return _asking.p;
  const p = (async () => {
    const r = await _api.buy(sale.ware, sale.rid).catch(() => null);
    if (r?.ok) landSale(sale, r.data);
    else if (r && SALE_FINAL.includes(r.error)) {
      if (_pending === sale) { _pending = null; _doors.saved(); }
      learn(r);
    }
    return r;
  })();
  const asking = { sale, p };
  _asking = asking;
  p.finally(() => { if (_asking === asking) _asking = null; }).catch(() => {});
  return p;
}
/**
 * BUY a ware by its id: the sale asked by a fresh id (kept on the save until answered), its piece minted on the answer.
 * Answers `{ ok, text }` - `text` the line to show.
 * @param {string} wareId
 */
export async function buyWare(wareId) {
  const w = wareById(wareId);
  if (!w) return { ok: false, text: festivalRefusalText('ware') };
  const shut = festivalShut();
  if (shut) return { ok: false, text: festivalRefusalText(shut) };
  if (_pending) await resumeSale();
  if (_pending) return { ok: false, text: festivalRefusalText('offline') };   // the sale before it is still unanswered
  const sale = { rid: saleRid(), ware: w.id, account: _api.me() ?? '' };
  _pending = sale;
  _doors.saved();
  const r = await askSale(sale);
  if (r?.ok) return { ok: true, text: '' };
  return { ok: false, text: !r || !SALE_FINAL.includes(r.error) ? festivalRefusalText('offline') : refusalText(r.error) };   // kept: asked again by its id
}
/** A pending sale asked again by its own id, under the account that made it: answered `repeat` (it landed), or as a sale
 *  now, or refused for good (let go). Another account signed in leaves it kept for its own. */
async function resumeSale() {
  if (!_pending || !_api || _pending.account !== _api.me()) return;
  await askSale(_pending);
}

// ═══ THE WARDROBE ════════════════════════════════════════════════════════════════════════════════════════════════════
/** What the account holds and wears, as the service last said it (its wardrobe - server-account/src/titles.js
 *  wardrobeOf): the titles, auras and icons held, and the one of each worn. Null until read. */
let _wardrobe = /** @type {{ title: string|null, aura: string|null, icon: string|null, titles: string[], auras: string[], icons: string[] } | null} */ (null);
export const festivalWardrobe = () => _wardrobe;
const list = (/** @type {unknown} */ v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
function adoptWardrobe(/** @type {any} */ w) {
  if (!w || typeof w !== 'object') return;
  _wardrobe = { title: w.title ?? null, aura: w.aura ?? null, icon: w.icon ?? null, titles: list(w.titles), auras: list(w.auras), icons: list(w.icons) };
  changed();
}
/** The account service's door as the stored session opens it, or null signed out. */
function accountIo() {
  const storage = appStorage(), s = storedSession(storage);
  return s ? { fetch: (/** @type {any} */ u, /** @type {any} */ i) => globalThis.fetch(u, i), base: serviceBase(storage), secret: s.secret, storage } : null;
}
/** Ask for the account's wardrobe (the window asks it as it opens). Answers whether it was heard. */
export async function loadWardrobe() {
  const io = accountIo();
  const r = io ? await readAccount(io).catch(() => null) : null;
  if (!r?.ok) return false;
  adoptWardrobe(r.data?.wardrobe);
  return true;
}
/**
 * WEAR a title, an aura or an icon the account holds - or take it off (`on` false). The service decides what is held
 * (`not-held`); its answer is the wardrobe, worn at once on my own name, feet and portrait (the stored session, the
 * room's client) and by the room from the next hello. Answers `{ ok, text }`.
 * @param {'title'|'aura'|'icon'} kind @param {string} key
 */
export async function wearAccount(kind, key, on = true) {
  const io = accountIo();
  if (!io) return { ok: false, text: festivalRefusalText('offline') };
  const want = on ? key : null;
  const r = await (kind === 'title' ? equipTitle(io, want) : kind === 'aura' ? equipAura(io, want) : equipIcon(io, want)).catch(() => null);
  if (!r?.ok) return { ok: false, text: r?.error === 'not-held' ? festivalRefusalText('held') : refusalText(r?.error ?? 'offline') };
  adoptWardrobe(r.data);
  const w = _wardrobe;
  adoptIdentity(io.storage, { glyphs: r.data?.glyphs, glyphsOff: r.data?.glyphsOff, aura: w?.aura ?? null, icon: w?.icon ?? null, secret: io.secret });
  const room = _doors.room();
  room?.adoptIdentity?.({ title: w?.title ?? null, ts: (w?.title ?? null) === (room.title ?? null) ? room.ts : null, glyphs: room.glyphs, level: room.lv, aura: w?.aura ?? null, icon: w?.icon ?? null });   // a seat title's claim kept while its title is
  return { ok: true, text: '' };
}
/** WEAR a ware the account bought (festivalLaw FESTIVAL_WARES: a title, an aura, an icon). */
export async function wearWare(/** @type {string} */ wareId, on = true) {
  const w = wareById(wareId);
  if (!w || !accountWare(w)) return { ok: false, text: festivalRefusalText('ware') };
  return wearAccount(/** @type {'title'|'aura'|'icon'} */ (w.kind), w.key, on);
}

// ═══ THE HEARTH OFFERINGS ════════════════════════════════════════════════════════════════════════════════════════════
/** One move on an offering through the service: `set`, `fill`, `takeIn` or `take` - its answer's counts learned (the
 *  cakes, and the bowls: set out, one fewer in the pack; taken in, one more). A take-in goes on whatever the festival's
 *  state (a bowl's cakes are never lost to its end). Answers `{ ok, data, text, error? }`. */
export async function offeringMove(/** @type {'set'|'fill'|'takeIn'|'take'} */ move, /** @type {any} */ at) {
  if (!_api || !_doors.online()) return { ok: false, data: null, text: festivalRefusalText('offline'), error: 'offline' };
  const shut = move === 'takeIn' ? null : festivalShut();
  if (shut) return { ok: false, data: null, text: festivalRefusalText(shut), error: shut };
  const items = _doors.entity()?.items;
  if (move === 'set' && !(Array.isArray(items) && items.some(isHearthOffering))) return { ok: false, data: null, text: festivalRefusalText('item'), error: 'item' };
  const r = await _api[move](at).catch(() => null);
  if (!r?.ok) {
    learn(r);   // a refusal's counts (`cakes`, `bowls`)
    const code = move === 'take' && r?.error === 'none' ? 'gone' : r?.error ?? 'offline';   // a take's `none`: taken in since
    return { ok: false, data: null, text: refusalText(code), error: code };
  }
  learn(r.data);
  if (move !== 'take') refreshFestival().catch(() => {});   // the account's own offerings, as they stand now
  _doors.saved();
  return { ok: true, data: r.data, text: '' };
}
/** A town's offerings, as the service says them (`{ mapId, open, offerings }`), or null. */
export async function townOfferings(/** @type {number} */ mapId) {
  if (!_api || !_doors.online()) return null;
  const r = await _api.town(mapId).catch(() => null);
  if (r?.ok && typeof r.data?.open === 'boolean' && r.data.open !== festivalState().open) learn({ open: r.data.open });   // the switch, as it stands
  return r?.ok ? r.data : null;
}

/** Tests only. */
export function _resetFestivalClientForTests() {
  _doors = NO_DOORS; _api = null; _pending = null; _asking = null; _wardrobe = null; _chain = Promise.resolve(); _actTurn = null;
  _state = UNHEARD; _stateOf = null; _fullSaid = null;
  _hear.clear(); _version = 0;
}
