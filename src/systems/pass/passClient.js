// @ts-check
// STOREFRONT (2026-10-29; bible/06-Systems/Battle-Pass.md section 4): THE BATTLE PASS, AS THIS PAGE PLAYS IT - the
// account's season as the service last said it, and the finds a kill and a deed ask for. THE SERVICE DECIDES, THIS PAGE
// ASKS (server-account/src/battlePass.js): a kill my own blow made (systems/playerKills.js), an act of mine
// (systems/questlines/qlActs.js), a quest done and a bounty paid each ask by their source, one after another, never
// dropped. PASS-PANELS: a find pays Aurum; a challenge paid and the day's Aurum found are told through the host's doors
// (`onEvent`), which word them.
// HOSTS: the world host binds it (scenes/seasonHost.js); unbound, nothing is asked. Not a DFU member. Ledger A (STOREFRONT).
import { accountBattlePass } from '../../net/accountClient.js';
import { appStorage } from '../appStorage.js';
import { registerPlayerKillListener } from '../playerKills.js';
import { hearActs, ACT_KINDS, ACT_NOT_FOUND } from '../questlines/qlActs.js';
import { KNIGHT_CITY_WATCH } from '../../characters/mobile/mobileTypes.js';
import { foeFindSource } from '../festival/festivalFoes.js';
import { isPassSource, passChallengeOf, PASS_DAY_AURUM, PASS_FINDS_FROM_MS, PASS_CONSTRUCT_MOBILES } from '../../net/battlePassLaw.js';
import { utcDay } from '../../net/marksLaw.js';
import { createAskRest } from '../../net/askRest.js';

/** The kill listener's and the act hearer's name. */
export const PASS_FIND = 'pass-find';
/** The season's constructs (net/battlePassLaw.js) - a body the season stood is marked `passConstruct` as well
 *  (scenes/seasonHost.js). */
export { PASS_CONSTRUCT_MOBILES };

/** AUDIT-STOREFRONT II (lane B 2): a find the service could not be reached for (off line, its own error) stays at the head
 *  of the queue and is asked again with its own id - first this long after, doubling to the most - so none is lost, and
 *  one that landed with its answer lost counts once (server-account/src/battlePass.js). */
export const PASS_FIND_RETRY_MS = 4000;
export const PASS_FIND_RETRY_MAX_MS = 60_000;
/** A find's own id: sixteen hex. */
const findRid = () => [...globalThis.crypto.getRandomValues(new Uint8Array(8))].map((b) => b.toString(16).padStart(2, '0')).join('');
/** No answer from the service - asked again; any other word is the service's. */
const unreached = (/** @type {any} */ r) => !!r && (r.error === 'offline' || r.error === 'server' || (r.status ?? 0) >= 500);
const NO_DOORS = Object.freeze({
  online: () => false, nowMs: () => Date.now(), onEvent: (/** @type {any} */ _e) => {},
  wait: (/** @type {number} */ ms) => new Promise((r) => { setTimeout(r, ms); }), rid: findRid,
});
/** @type {any} */ let _doors = NO_DOORS;
/** @type {any} */ let _api = null;
/** @type {any} */ let _state = null;
let _stateOf = /** @type {string|null} */ (null);
let _fullSaid = '';
const _hear = new Set();
let _version = 0;
const changed = () => { _version++; for (const fn of _hear) { try { fn(); } catch { /* a listener's throw is not ours */ } } };
const account = () => _api?.me?.() ?? null;
/** AUDIT PASS 2, 11: the page's rest after the service said shut or refused a find - the festival's rule too (net/askRest.js). */
const _rest = createAskRest({ nowMs: () => _doors.nowMs(), account });
let _chain = Promise.resolve();
/** AUDIT PASS 9: ONE QUEUE - the season's reads and the finds one after another, so no answer lands over a newer one. */
function queued(/** @type {() => Promise<any>} */ fn) {
  const p = _chain.then(fn, fn);
  _chain = p.catch(() => 0);
  return p;
}

/** THE HOST'S DOORS: `online()` the world plays online, `nowMs()` the shared clock, `onEvent(e)` a challenge paid (`{ kind:
 *  'challenge', key, aurum }`) or the day's Aurum found (`{ kind: 'full' }`) - and, for the tests, `wait(ms)` and `rid()`.
 *  Null unbinds. Answers the door to the service (or null). */
export function bindPass(doors = null) {
  _doors = doors ? { ...NO_DOORS, ...doors } : NO_DOORS;
  _api = doors ? (doors.api ?? accountBattlePass({ fetch: (/** @type {any} */ u, /** @type {any} */ i) => globalThis.fetch(u, i), storage: appStorage() })) : null;
  _rest.reset();
  if (doors) refreshPass().catch(() => {});
  return _api;
}
/** A listener told whenever the account's season changes; answers its unregistering. */
export function hearPass(/** @type {() => void} */ fn) { _hear.add(fn); return () => { _hear.delete(fn); }; }
export const passVersion = () => _version;
/** The account's season as last heard (null: unheard, or another account's). */
export const passState = () => (_stateOf && _stateOf === account() ? _state : null);
/** Whether this page plays the pass now: bound and online, a registered account, the finds begun on the shared clock
 *  (PASS-PANELS: they never close), and no refusal standing it back. AUDIT PASS 2: a pass the service said shut is read
 *  again (askPassFind), never shut for the page - a page loaded before the switch turned on asked nothing until reloaded. */
export function passLive() {
  if (!_api || !_doors.online() || !account() || _api.guest?.()) return false;
  return _doors.nowMs() >= PASS_FINDS_FROM_MS && !_rest.resting();
}

/** The pass's answer taken in - a find's challenges paid told with their Aurum, and the day's bound once a day. A find's
 *  answer (`gained`, `found`, `done`) is no card: only its `today` is kept. */
function learn(/** @type {any} */ d, /** @type {boolean} */ told) {
  if (!d || typeof d !== 'object') return;
  const was = passState();
  _state = told ? { ...(was ?? {}), ...(Number.isSafeInteger(d.today) ? { today: d.today } : {}) } : d;
  _stateOf = account();
  if (told && Array.isArray(d.done)) {
    for (const key of d.done) { const c = passChallengeOf(key); if (c) _doors.onEvent({ kind: 'challenge', key, aurum: c.aurum }); }
  }
  if (told && Number.isSafeInteger(d.today) && d.today >= PASS_DAY_AURUM) {
    const k = `${account()}:${utcDay(Math.floor(_doors.nowMs() / 1000))}`;
    if (_fullSaid !== k) { _fullSaid = k; _doors.onEvent({ kind: 'full' }); }
  }
  changed();
}

/** The account's season read, off the queue (its own steps call it). Answers whether it was heard. */
async function readPass() {
  if (!_api || !account() || _api.guest?.()) return false;
  const r = await _api.mine().catch(() => null);
  if (!r?.ok) return false;
  learn(r.data, false);
  _rest.heard(r.data?.open);
  return true;
}
/** Ask the service for the account's season, queued with the finds. Answers whether it was heard. */
export const refreshPass = () => queued(readPass);

/** ASK FOR A FIND: `source` (battlePassLaw PASS_SOURCES), queued behind the asks before it, with its own id - asked again
 *  with it while the service cannot be reached (AUDIT-STOREFRONT II, lane B 2). Answers the Aurum gained. */
export function askPassFind(/** @type {string} */ source) {
  if (!isPassSource(source) || !passLive()) return Promise.resolve(0);
  const rid = _doors.rid();
  return queued(async () => {
    if (!passLive()) return 0;   // a refusal ahead of it in the queue stood the page back
    // the day's bound is told against the pass as read: read it first; and a pass said shut, again
    const due = _rest.due(passState()?.open);
    if ((due || !passState()) && !(await readPass()) && due) { _rest.unheard(); return 0; }
    if (passState()?.open === false) return 0;
    for (let i = 0; ; i++) {
      const r = await _api.find(source, rid).catch(() => null);
      if (r?.ok) { learn(r.data, true); return Number.isSafeInteger(r.data?.gained) ? r.data.gained : 0; }
      if (!unreached(r)) { _rest.refused(r?.error); return 0; }   // the deeds after it ask nothing while it stands
      await _doors.wait(Math.min(PASS_FIND_RETRY_MAX_MS, PASS_FIND_RETRY_MS * 2 ** i));
      if (!passLive()) return 0;   // unbound, signed out or off line meanwhile: let go
    }
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
export function _resetPassClientForTests() { _doors = NO_DOORS; _api = null; _state = null; _stateOf = null; _fullSaid = ''; _chain = Promise.resolve(); _hear.clear(); _rest.reset(); }
