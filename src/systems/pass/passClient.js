// @ts-check
// STOREFRONT (2026-10-29; bible/06-Systems/Battle-Pass.md section 4): THE BATTLE PASS, AS THIS PAGE PLAYS IT - the
// account's season as the service last said it, and the finds a kill and a deed ask for. THE SERVICE DECIDES, THIS PAGE
// ASKS (server-account/src/battlePass.js): a kill my own blow made (systems/playerKills.js), an act of mine
// (systems/questlines/qlActs.js), a quest done and a bounty paid each ask by their source, one after another, never
// dropped. A level reached and a challenge paid are told through the host's doors (`onEvent`), which word them.
// HOSTS: the world host binds it (scenes/seasonHost.js); unbound, nothing is asked. Not a DFU member. Ledger A (STOREFRONT).
import { accountBattlePass } from '../../net/accountClient.js';
import { appStorage } from '../appStorage.js';
import { registerPlayerKillListener } from '../playerKills.js';
import { hearActs, ACT_KINDS, ACT_NOT_FOUND } from '../questlines/qlActs.js';
import { KNIGHT_CITY_WATCH } from '../../characters/mobile/mobileTypes.js';
import { foeFindSource } from '../festival/festivalFoes.js';
import { isPassSource, passSeasonAt, PASS_REWARDS, PASS_DAY_XP, PASS_CONSTRUCT_MOBILES } from '../../net/battlePassLaw.js';
import { utcDay } from '../../net/marksLaw.js';

/** The kill listener's and the act hearer's name. */
export const PASS_FIND = 'pass-find';
/** The season's constructs (net/battlePassLaw.js) - a body the season stood is marked `passConstruct` as well
 *  (scenes/seasonHost.js). */
export { PASS_CONSTRUCT_MOBILES };
/** AUDIT PASS 11: HOW LONG A REFUSAL STANDS THE PAGE BACK. `brief`: a find called closed (the two clocks may straddle the
 *  opening - the season is read again after it), a rate, an enforced line's empty bucket. `long`: a read saying the pass is
 *  shut for this account (read again after it: a switch turned on is heard no other way), a seat or hold refused. The
 *  day's asks spent wait for the next UTC day. */
export const PASS_REST_MS = Object.freeze({ brief: 60_000, long: 10 * 60_000 });

const NO_DOORS = Object.freeze({ online: () => false, nowMs: () => Date.now(), onEvent: (/** @type {any} */ _e) => {} });
/** @type {any} */ let _doors = NO_DOORS;
/** @type {any} */ let _api = null;
/** @type {any} */ let _state = null;
let _stateOf = /** @type {string|null} */ (null);
let _fullSaid = '';
const _hear = new Set();
let _version = 0;
const changed = () => { _version++; for (const fn of _hear) { try { fn(); } catch { /* a listener's throw is not ours */ } } };
const account = () => _api?.me?.() ?? null;
/** No find is asked before `until` (the shared clock) for the account `of`; `_reread`: the season is read before the next. */
let _rest = { until: 0, of: /** @type {string|null} */ (null) }, _reread = false;
const restUntil = (/** @type {number} */ at) => { _rest = { until: at, of: account() }; };
let _chain = Promise.resolve();
/** AUDIT PASS 9: ONE QUEUE - the season's reads and the finds one after another, so no answer lands over a newer one. */
function queued(/** @type {() => Promise<any>} */ fn) {
  const p = _chain.then(fn, fn);
  _chain = p.catch(() => 0);
  return p;
}

/** THE HOST'S DOORS: `online()` the world plays online, `nowMs()` the shared clock, `onEvent(e)` a level reached (`{ kind:
 *  'level', level, grants }`), a challenge paid (`{ kind: 'challenge', key }`) or the day's experience spent (`{ kind:
 *  'full' }`). Null unbinds. Answers the door to the service (or null). */
export function bindPass(doors = null) {
  _doors = doors ? { ...NO_DOORS, ...doors } : NO_DOORS;
  _api = doors ? (doors.api ?? accountBattlePass({ fetch: (/** @type {any} */ u, /** @type {any} */ i) => globalThis.fetch(u, i), storage: appStorage() })) : null;
  _rest = { until: 0, of: null }; _reread = false;
  if (doors) refreshPass().catch(() => {});
  return _api;
}
/** A listener told whenever the account's season changes; answers its unregistering. */
export function hearPass(/** @type {() => void} */ fn) { _hear.add(fn); return () => { _hear.delete(fn); }; }
export const passVersion = () => _version;
/** The account's season as last heard (null: unheard, or another account's). */
export const passState = () => (_stateOf && _stateOf === account() ? _state : null);
/** Whether this page plays the pass now: bound and online, a registered account, a season open on the shared clock, and
 *  no refusal standing it back. AUDIT PASS 2: a season the service said shut is read again (askPassFind), never shut for
 *  the page - a page loaded before the opening or before the switch turned on asked nothing until it was reloaded. */
export function passLive() {
  if (!_api || !_doors.online() || !account() || _api.guest?.()) return false;
  const now = _doors.nowMs();
  return !!passSeasonAt(now) && !(_rest.of === account() && now < _rest.until);
}

/** The season's answer taken in - its level before and after told as a level reached, with the rewards on it. */
function learn(/** @type {any} */ d, /** @type {boolean} */ told) {
  if (!d || typeof d !== 'object') return;
  const was = passState();
  const next = { ...(was ?? {}), ...d };
  _state = next; _stateOf = account();
  if (d.open === false) { restUntil(_doors.nowMs() + PASS_REST_MS.long); _reread = true; }
  if (told && was && Number.isSafeInteger(d.level) && d.level > (was.level ?? 0)) {
    for (let lv = (was.level ?? 0) + 1; lv <= d.level; lv++) _doors.onEvent({ kind: 'level', level: lv, grants: grantsAt(next, lv) });
  }
  if (told && Array.isArray(d.done)) for (const key of d.done) _doors.onEvent({ kind: 'challenge', key });
  if (told && Number.isSafeInteger(d.today) && d.today >= PASS_DAY_XP) {
    const k = `${account()}:${utcDay(Math.floor(_doors.nowMs() / 1000))}`;
    if (_fullSaid !== k) { _fullSaid = k; _doors.onEvent({ kind: 'full' }); }
  }
  changed();
}
/** The rewards a level gives an account that plays these tracks (the state's `tracks`). Pure but for the law. */
export function grantsAt(/** @type {any} */ state, /** @type {number} */ level) {
  const rewards = PASS_REWARDS[/** @type {keyof typeof PASS_REWARDS} */ (state?.season)] ?? [];
  return rewards.filter((r) => r.level === level && (r.track === 'free' || (r.track === 'premium' && state?.tracks?.premium))).map((r) => r.grant);
}

/** The account's season read, off the queue (its own steps call it). Answers whether it was heard. */
async function readPass() {
  if (!_api || !account() || _api.guest?.()) return false;
  const r = await _api.mine().catch(() => null);
  if (!r?.ok) return false;
  _reread = false;
  learn(r.data, false);
  return true;
}
/** Ask the service for the account's season, queued with the finds. Answers whether it was heard. */
export const refreshPass = () => queued(readPass);

/** AUDIT PASS 11: a find refused stands the page back (PASS_REST_MS), so the deeds after it ask nothing. */
function refused(/** @type {unknown} */ error) {
  const now = _doors.nowMs();
  if (error === 'capped') restUntil((utcDay(Math.floor(now / 1000)) + 1) * 86_400_000);
  else if (error === 'closed') { restUntil(now + PASS_REST_MS.brief); _reread = true; }
  else if (error === 'rate' || error === 'progress-play') restUntil(now + PASS_REST_MS.brief);
  else if (error === 'progress-seat' || error === 'trade-held') restUntil(now + PASS_REST_MS.long);
}

/** ASK FOR A FIND: `source` (battlePassLaw PASS_SOURCES), queued behind the asks before it. Answers the experience gained. */
export function askPassFind(/** @type {string} */ source) {
  if (!isPassSource(source) || !passLive()) return Promise.resolve(0);
  return queued(async () => {
    if (!passLive()) return 0;   // a refusal ahead of it in the queue stood the page back
    if (!passState() || _reread) {   // a level reached is told against the level before it: read it first; a shut season again
      if (!(await readPass()) && _reread) { restUntil(_doors.nowMs() + PASS_REST_MS.brief); return 0; }
    }
    if (passState()?.open === false) return 0;
    const r = await _api.find(source).catch(() => null);
    if (!r?.ok) { refused(r?.error); return 0; }
    learn(r.data, true);
    return Number.isSafeInteger(r.data?.gained) ? r.data.gained : 0;
  });
}
/** A DFU quest of mine done (scenes/quest/questBridge.js onQuestEnded), and a bounty of mine paid (scenes/bountyHost.js). */
export function passQuestEnded(/** @type {any} */ q) { if (q?.questSuccess) askPassFind('quest'); }
export const passBountyPaid = () => askPassFind('bounty');

/** A kill that never pays (Renown's own rule): the city watch, and my own ally. */
const neverPays = (/** @type {any} */ e) => e?.mobileType === KNIGHT_CITY_WATCH || e?.team === 'PlayerAlly' || e?.mobileTeam === 'PlayerAlly';
/** A foe's source: a construct of the season's, else the festival's own reading of a body (festivalFoes.js). */
export const passFoeSource = (/** @type {any} */ e) => (e?.passConstruct === true || PASS_CONSTRUCT_MOBILES.includes(e?.mobileType) ? 'construct' : foeFindSource(e));
/** @type {WeakSet<object>} */
const _asked = new WeakSet();
registerPlayerKillListener(PASS_FIND, (/** @type {any} */ entity) => {
  if (!entity || typeof entity !== 'object' || neverPays(entity) || _asked.has(entity)) return;
  const source = passFoeSource(entity);
  if (!source) return;
  _asked.add(entity);
  askPassFind(source);
});
/** ONE DEED, ONE FIND (the festival's law): the acts one turn says are one deed, and the acts that are none are the leaf's
 *  one list (qlActs.js ACT_NOT_FOUND - an elite's fall, a Wyrd Sister met, the Ketch's lift and its cells). */
let _actTurn = /** @type {Set<string>|null} */ (null);
hearActs(PASS_FIND, (/** @type {string} */ kind) => {
  const g = ACT_KINDS[/** @type {keyof typeof ACT_KINDS} */ (kind)];
  if (!g || ACT_NOT_FOUND.includes(kind)) return;
  if (!_actTurn) { _actTurn = new Set(); Promise.resolve().then(() => { _actTurn = null; }); }
  if (_actTurn.has(g)) return;
  _actTurn.add(g);
  askPassFind(g);
});

/** For the tests: forget everything. */
export function _resetPassClientForTests() { _doors = NO_DOORS; _api = null; _state = null; _stateOf = null; _fullSaid = ''; _chain = Promise.resolve(); _hear.clear(); _rest = { until: 0, of: null }; _reread = false; }
