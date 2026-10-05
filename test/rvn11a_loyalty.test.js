// RVN11a - LOYALTY (bible/12-Enhanced-AI/Feud-Arc.md section 22.1 and 22.4; Mac, 2026-10-04: "more complex, less easy
// to accomplish and more detailed", then "Go"). A sworn one's `companion.loyalty` (0-100, its personality's start)
// moves with how it is kept: +3 a fight won at my side, +2 a day with me, +10 called back after its rest; -1 a day sent
// away (never resting), -8 knocked out, -10 sent away a second time in a day, -15 one of its own kind executed in its
// sight. Its word: Devoted (90+), Loyal, Wavering, Restless (under 20). Devoted: its blows x1.1, and "Behind you,
// Ayla!" when a wind-up at me begins behind me. The Companions page: a bar and its word.
// Pinned: the numbers and the words; the days; the call after a rest; the second sending; the fall; a fight won; the
// witness; Devoted's blows and its warning (the hook through the real cues, the host's wiring); the record's new fields
// through the save; the page.
import './modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const _store = new Map();
globalThis.localStorage = {
  getItem: (k) => (_store.has(k) ? _store.get(k) : null), setItem: (k, v) => { _store.set(k, String(v)); },
  removeItem: (k) => { _store.delete(k); }, clear: () => _store.clear(), key: (i) => [..._store.keys()][i] ?? null, get length() { return _store.size; },
};

const N = await import('../src/systems/revenant.js');
const F = await import('../src/systems/revenantFeud.js');
const RC = await import('../src/systems/revenantCompanions.js');
const S = await import('../src/systems/companionSlots.js');
const { finishExecution } = await import('../src/systems/revenantFate.js');
const { setPref, _resetForTests } = await import('../src/systems/uiPrefs.js');
const { setWorldMinutes } = await import('../src/systems/worldTick.js');
const { tellCues, setWindupAtMeListener } = await import('../src/scenes/hostCombat.js');
const { LOCAL_TARGET } = await import('../src/ai/tactics.js');
const { MOBILE_TYPES: M } = await import('../src/characters/mobileTypes.js');
const { modSaveRecords, restoreModSaveRecords } = await import('../src/systems/modSaveData.js');
const { loyaltyRow, drawCompanionsPage, _resetCompanionRosterForTests, _setCompanionRosterIconForTests } = await import('../src/ui/companionRoster.js');

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const DAY = 1440;
const me = { isPlayer: true, name: 'Ayla Stormwind', characterId: 'char-rvn11a', level: 8, health: 100, maxHealth: 100 };

beforeEach(() => {
  _resetForTests(); setPref('lootRarity', true);
  N._resetRevenantForTests(); RC._resetRetinueForTests(); S._resetCompanionSlotsForTests(); _store.clear();
  S.registerCompanionCount('revenant', () => RC.revenantsWithYou().length);
  RC.setRetinuePlayer(me);
  setWorldMinutes(DAY * 10);
  setWindupAtMeListener(null);
});
function sworn(state = 'with', { mobileType = M.Orc, loyalty = 60 } = {}) {
  const r = N.revenantDeed(me, { mobileType, level: 6, champion: 'mighty', health: 5, maxHealth: 50, team: 'Monster' }, 'fled', { mobileType, rolls: () => 0 });
  const s = N.revenantSpared(me, { revenant: { id: r.id } }, { state });
  s.companion.loyalty = loyalty;
  return s;
}
const loy = (r) => N.revenantById(r.id).companion.loyalty;
/** The bodies the host answers for (swornBodyOf). */
const bodies = (map) => RC.setRetinueBodies((id) => map[id] ?? null);

// ── the law ─────────────────────────────────────────────────────────

test('RVN11a THE LAW: the moves and the words whole; a loyalty kept 0-100; of its own kind by kind or faction (mutants: any number moved; a word\'s line moved; the clamp; the faction unread)', () => {
  assert.deepEqual({ ...F.LOYALTY }, { WON: 3, DAY_WITH: 2, CALLED: 10, DAY_AWAY: -1, KNOCKED: -8, SENT_TWICE: -10, KIN_EXECUTED: -15 });
  assert.deepEqual({ ...F.DEVOTED }, { AT: 90, BLOWS: 1.1, WARN_S: 15 });
  assert.deepEqual([100, 90, 89, 50, 49, 20, 19, 0].map(F.loyaltyLabel), ['Devoted', 'Devoted', 'Loyal', 'Loyal', 'Wavering', 'Wavering', 'Restless', 'Restless']);
  assert.deepEqual([F.movedLoyalty(95, 10), F.movedLoyalty(5, -8), F.movedLoyalty(50.4, 0), F.movedLoyalty(undefined, 3)], [100, 0, 50, 3]);
  assert.deepEqual([F.isDevoted(90), F.isDevoted(89), F.isDevoted(null)], [true, false, false]);
  assert.equal(F.sameKin(M.Orc, M.OrcShaman), true, 'the orcs');
  assert.equal(F.sameKin(M.Mage, M.Knight), true, 'people');
  assert.equal(F.sameKin(M.Orc, M.Rat), false);
  assert.equal(F.sameKin(M.Lich, M.Lich), true, 'a solitary kind: its own kind alone');
  assert.equal(F.sameKin(M.Lich, M.AncientLich), false);
  assert.equal(F.sameKin(M.Orc, undefined), false);
});

// ── the moves ───────────────────────────────────────────────────────

test('RVN11a THE DAYS: with me +2 a day, sent away -1, resting none; the first count only sets the day; seven days caught up at most (mutants: the day\'s move unread; resting moved; the cap)', () => {
  const w = sworn('with'), a = sworn('away'), r = sworn('with');
  N.revenantById(r.id).companion.state = 'resting';
  N.revenantFester(me, { now: DAY * 10 });
  assert.deepEqual([loy(w), loy(a), loy(r)], [60, 60, 60], 'the first count');
  N.revenantFester(me, { now: DAY * 12 + 5 });
  assert.deepEqual([loy(w), loy(a), loy(r)], [64, 58, 60]);
  N.revenantFester(me, { now: DAY * 40 });
  assert.deepEqual([loy(w), loy(a)], [78, 51], 'seven days at most');
});

test('RVN11a THE CALL AFTER A REST: its wake marks it rested; the first call after +10, once; a call with no rest nothing; the mark rides the save while it waits (mutants: the wake\'s mark; the +10 unread; spent twice; the save)', () => {
  const r = sworn('with');
  const party = RC.revenantParty();
  assert.equal(party.knock('rv', r.id, 100), true);
  assert.equal(loy(r), 52, 'the fall: -8');
  party.wake(100 + RC.REVENANT_REST_MIN);
  assert.equal(N.revenantById(r.id).companion.rested, true);
  restoreModSaveRecords(modSaveRecords());
  RC.setRetinuePlayer(me);
  assert.equal(N.revenantRecord(me, r.id).companion.rested, true, 'the save keeps it');
  assert.equal(RC.callRevenant(r.id, 1e6), null);
  assert.equal(loy(r), 62, '+10');
  assert.equal(N.revenantById(r.id).companion.rested, false);
  RC.sendRevenantAway(r.id, { now: DAY * 3 });
  RC.callRevenant(r.id, 1e6);
  assert.equal(loy(r), 62, 'no rest, no reward');
});

test('RVN11a SENT TWICE IN A DAY: the first sending free, a second the same day -10, the next day free again; the slots\' own hold never costs (mutants: every sending costs; the day unread; the hold costs)', () => {
  const r = sworn('with');
  RC.sendRevenantAway(r.id, { now: DAY * 5 + 10 });
  assert.equal(loy(r), 60);
  RC.callRevenant(r.id, 0);
  RC.sendRevenantAway(r.id, { now: DAY * 5 + 900 });
  assert.equal(loy(r), 50, 'twice in a day');
  RC.callRevenant(r.id, 0);
  RC.sendRevenantAway(r.id, { now: DAY * 6 + 1 });
  assert.equal(loy(r), 50, 'a new day');
  RC.callRevenant(r.id, 0);
  RC.sendRevenantAway(r.id, { now: DAY * 6 + 2, byYou: false });
  assert.equal(loy(r), 50, 'the slots\' hold');
  RC.callRevenant(r.id, 0);
  RC.sendRevenantAway(r.id, { now: DAY * 6 + 3 });
  assert.equal(loy(r), 40, 'the hold noted no day of its own - the day stays the player\'s sending');
  assert.equal(N.revenantById(r.id).companion.sentDay, 6);
  assert.match(read('src/scenes/world.js'), /if \(last && sendRevenantAway\(last\.id, \{ byYou: false \}\)\)/, 'the host\'s hold');
});

test('RVN11a A FIGHT WON: begun with a live target, won the frame it stands with none and the last is down - once; a target that walked off, or one still up, no win; +3, wired in the sworn\'s frame (mutants: a live target a win; won twice; unwired)', () => {
  const foe = { entity: { health: 10 }, dead: false };
  const rec = { ai: { target: foe } };
  assert.equal(RC.swornFightStep(rec), false);
  foe.entity.health = 0;
  assert.equal(RC.swornFightStep(rec), true, 'a target held after its death is none: won');
  assert.equal(RC.swornFightStep(rec), false, 'once');
  const other = { entity: { health: 10 }, dead: false };
  rec.ai.target = other; RC.swornFightStep(rec);
  rec.ai.target = null;
  assert.equal(RC.swornFightStep(rec), false, 'it walked off still standing');
  const r = sworn('with');
  RC.swornFightWon(r.id);
  assert.equal(loy(r), 63);
  assert.match(read('src/scenes/world.js'), /for \(const rec of revenantAshore\.bodies\(\)\) if \(rec\.revenantCompanion && !rec\.dead && swornFightStep\(rec\)\) swornFightWon\(rec\.revenantCompanion\);/);
});

test('RVN11a THE WITNESS: one of its own kind executed - each sworn one at my side whose body stands here, of its kind or faction, -15; one away, one without a body, one of another kind untouched (mutants: unwired; the kind unread; the body unread)', () => {
  const orc = sworn('with'), rat = sworn('with', { mobileType: M.Rat }), gone = sworn('with'), away = sworn('away');
  bodies({ [orc.id]: { health: 30 }, [rat.id]: { health: 30 }, [away.id]: { health: 30 } });
  const items = finishExecution(me, { mobileType: M.OrcSergeant, entity: { revenant: null, items: [] } });
  assert.deepEqual(items, []);
  assert.deepEqual([loy(orc), loy(rat), loy(gone), loy(away)], [45, 60, 60, 60]);
});

// ── devoted ─────────────────────────────────────────────────────────

test('RVN11a DEVOTED\'S BLOWS: at 90 its stand strikes x1.1 over its rank\'s; at 89 not (mutants: unread; the line moved)', () => {
  const blows = (loyalty) => { const r = sworn('with', { loyalty }); const e = { maxHealth: 50, health: 50 }; RC.applySwornStrength(e, N.revenantById(r.id)); return e.damageScale; };
  const rank = N.revenantById(sworn('with').id).rank;
  assert.ok(Math.abs(blows(90) - (1 + N.REVENANT_DAMAGE_PER_RANK * rank) * 1.1) < 1e-9);
  assert.ok(Math.abs(blows(89) - (1 + N.REVENANT_DAMAGE_PER_RANK * rank)) < 1e-9);
});

test('RVN11a DEVOTED\'S WARNING: the real cues tell the host a wind-up at me as it begins (once a blow; never one at another); a Devoted one standing here is its voice; its words; the host\'s back test and wait (mutants: the hook unwired; told every frame; a peer\'s wind-up told; a Loyal one warning; the back unread)', () => {
  const heard = [];
  setWindupAtMeListener((f, b) => heard.push(b));
  const blow = { start: 1, land: 2, kind: 'swing' };
  const f = { mobileType: M.Orc, ai: { feet: [0, 0, 0], _tac: { state: 'windup', blow, key: LOCAL_TARGET } }, mobile: { meleeSeq: 0 } };
  tellCues(f, null, 1, 1); tellCues(f, null, 1, 1.1);
  assert.deepEqual(heard, [blow], 'once a blow');
  const g = { mobileType: M.Orc, ai: { feet: [0, 0, 0], _tac: { state: 'windup', blow: { start: 1, land: 2, kind: 'swing' }, key: 'peer:1' } }, mobile: { meleeSeq: 0 } };
  tellCues(g, null, 1, 1);
  assert.equal(heard.length, 1, 'at another, not me');
  const down = sworn('with', { loyalty: 99 }), loyal = sworn('with', { loyalty: 89 }), devoted = sworn('with', { loyalty: 95 });   // the one down first: passed over
  bodies({ [loyal.id]: { health: 9 }, [devoted.id]: { health: 9 }, [down.id]: { health: 0 } });
  assert.equal(RC.devotedWithYou()?.id, devoted.id);
  // PIN MOVED (RVN12a, Feud-Arc.md 23): its warning in its own voice (`devoted_warn`) - a beast's, what it does
  const d = N.revenantById(devoted.id);
  d.personality = 'brutal';
  const ev = N.revenantWarnEvent(d, 'ayla stormwind', { rolls: () => 0 });
  assert.deepEqual([ev.kind, ev.kicker, ev.speech, ev.line], ['warn', 'Companion', 'Behind you, Ayla!', `${devoted.name}: "Behind you, Ayla!"`]);
  const rat = sworn('with', { mobileType: M.Rat });
  N.revenantById(rat.id).personality = 'craven';
  assert.equal(N.revenantWarnEvent(N.revenantById(rat.id), 'Ayla').body, 'Snarls a warning with a nervous whine - behind you!', 'a beast, what it does');
  const w = read('src/scenes/world.js');
  assert.match(w, /setWindupAtMeListener\(\(f\) => \{\n\s*if \(!playerSpawned \|\| !f\?\.ai\?\.feet \|\| Date\.now\(\) - _devotedWarnAt < DEVOTED\.WARN_S \* 1000\) return;\n\s*if \(!isBackFacing\(cam\.yaw, player\.feetAt\(\), f\.ai\.feet\)\) return;\n\s*const r = devotedWithYou\(\);\n\s*if \(!r\) return;\n\s*_devotedWarnAt = Date\.now\(\);\n\s*revenantSay\(revenantWarnEvent\(r, playerEntity\?\.name\), /);
});

// ── the record, the page ────────────────────────────────────────────

test('RVN11a THE RECORD: `rested` read back only while away, `sentDay` a whole day or none (mutants: rested kept resting; a bad day kept)', () => {
  const r = sworn('away');
  Object.assign(N.revenantById(r.id).companion, { rested: true, sentDay: 4 });
  const s = sworn('with');
  Object.assign(N.revenantById(s.id).companion, { rested: true, sentDay: -2 });
  restoreModSaveRecords(modSaveRecords());
  RC.setRetinuePlayer(me);
  const a = N.revenantRecord(me, r.id).companion, b = N.revenantRecord(me, s.id).companion;
  assert.deepEqual([a.rested, a.sentDay, b.rested, b.sentDay], [true, 4, false, null]);
});

test('RVN11a THE PAGE: each sworn one\'s loyalty - a bar of 100 and its word, at my side and away; none without one (mutants: the row dropped; the word wrong; away unshown)', () => {
  const made = [];
  const el = (tag, cls = '', text = '') => { const n = { tag, cls, text, kids: [], title: '', append(...k) { this.kids.push(...k); }, insertBefore(k) { this.kids.unshift(k); }, setAttribute() {}, get firstChild() { return this.kids[0] ?? null; }, isConnected: true, style: {} }; made.push(n); return n; };
  const meters = [];
  const meter = (now, max, tone) => { meters.push([now, max, tone]); return el('div', 'px-meter'); };
  const r = sworn('with', { loyalty: 15 });
  const [row] = loyaltyRow(el, N.revenantById(r.id), meter);
  assert.equal(row.title, 'Loyalty 15 of 100');
  assert.deepEqual(meters, [[15, 100, '']]);
  assert.ok(row.kids.some((k) => k.cls === 'cmp-loyw is-restless' && k.text === 'Restless'));
  assert.deepEqual(loyaltyRow(el, { companion: {} }, meter), []);
  sworn('away', { loyalty: 92 });
  _resetCompanionRosterForTests(); _setCompanionRosterIconForTests(() => null);
  made.length = 0;
  const detail = el('div');
  drawCompanionsPage(detail, () => {}, { el, divider: (t) => el('h4', '', t), meter });
  const words = made.filter((n) => n.cls.startsWith('cmp-loyw')).map((n) => n.text);
  assert.deepEqual(words, ['Restless', 'Devoted'], 'at my side, and away');
});
