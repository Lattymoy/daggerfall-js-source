// RVN9 - FESTERING (bible/12-Enhanced-AI/Feud-Arc.md section 20; Mac, 2026-10-04: "more complex, less easy to
// accomplish and more detailed", then "Go"). The character's day against the store's `lastDay`, whole days caught up
// (seven at most): a living, unsworn, not-out revenant three days past its due day gains a wrath, and another every
// three days more - health +10% and blows +5% a wrath at its stand, and facing it clears it. At three it ranks up on its
// own (the `festered` deed, a new epithet, "Grushnak grows bolder - it has waited too long.") and its wrath goes back to
// none; never past rank 5, where its wrath stops at three.
// Pinned: the numbers and the day's law; the catch-up (the first count, whole days, seven at most, a clock wound back);
// the wrath and the rank-up; who festers; rank 5; the card through the notice; the stand's health and blows, cleared;
// the switch; the save's day.
import './modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const _store = new Map();
globalThis.localStorage = {
  getItem: (k) => (_store.has(k) ? _store.get(k) : null), setItem: (k, v) => { _store.set(k, String(v)); },
  removeItem: (k) => { _store.delete(k); }, clear: () => _store.clear(), key: (i) => [..._store.keys()][i] ?? null, get length() { return _store.size; },
};

const N = await import('../src/systems/revenant.js');
const F = await import('../src/systems/revenantFeud.js');
const { setPref, _resetForTests } = await import('../src/systems/uiPrefs.js');
const { setPlayerDoor } = await import('../src/systems/playerDoor.js');
const { setWorldMinutes } = await import('../src/systems/worldTick.js');
const { MOBILE_TYPES: M } = await import('../src/characters/mobileTypes.js');
const { modSaveRecords } = await import('../src/systems/modSaveData.js');

const DAY = 1440;
const me = (id = 'char-rvn9') => ({ isPlayer: true, name: 'Ayla Stormwind', characterId: id, level: 10, stats: {}, skills: [], career: {}, activeEffects: [], items: [], health: 100, maxHealth: 100 });

beforeEach(() => {
  _resetForTests(); setPref('lootRarity', true);
  N._resetRevenantForTests(); _store.clear(); setPlayerDoor(null); setWorldMinutes(DAY * 10);
});

function made(p, { dueDay = 10, rank = 1 } = {}) {
  const r = N.revenantDeed(p, { mobileType: M.Orc, level: 6, champion: 'mighty', health: 5, maxHealth: 50, team: 'Monster' }, 'fled', { mobileType: M.Orc, rolls: () => 0, now: DAY * dueDay - 600 });
  r.dueAt = DAY * dueDay + 300; r.rank = rank; r.wrath = 0; r.out = false; r.notice = null;
  return r;
}
const at = (day) => ({ now: DAY * day + 60, rolls: () => 0 });

test('RVN9 THE LAW: three days past its due day a wrath, and every three more; a wrath +10% health, +5% blows; seven days caught up at most; three wraths a rank (mutants: any number moved; the day\'s law)', () => {
  assert.deepEqual({ ...F.FESTER }, { DAYS: 3, EVERY: 3, CATCHUP: 7, HEALTH: 0.10, BLOWS: 0.05 });
  assert.equal(F.WRATH_MAX, 3);
  assert.deepEqual([12, 13, 14, 15, 16, 17, 18, 19].map((d) => F.festersOn(10, d)), [false, true, false, false, true, false, false, true]);
  assert.equal(F.festersOn(10, 10), false);
});

test('RVN9 THE DAYS: the first count only sets the day; then each whole day caught up - a wrath on its days, the rank-up at three with its deed, a new epithet, its card\'s notice, its wrath back to none (mutants: the first count festering; a day skipped or counted twice; the rank-up early or never; the wrath kept)', () => {
  const p = me();
  const r = made(p);
  assert.deepEqual(N.revenantFester(p, at(13)), [], 'the first count: from here - even on a day it would fester');
  assert.equal(r.wrath, 0);
  N.revenantFester(p, at(15));
  assert.equal(r.wrath, 0, 'days 14 and 15: nothing');
  N.revenantFester(p, at(16));
  assert.equal(r.wrath, 1, 'day 16');
  N.revenantFester(p, at(16));
  assert.equal(r.wrath, 1, 'the same day: nothing more');
  N.revenantFester(p, at(19));
  assert.equal(r.wrath, 2);
  const epithet = r.epithet, rank = r.rank;
  const up = N.revenantFester(p, at(22));
  assert.deepEqual(up, [r]);
  assert.equal(r.rank, rank + 1, 'it ranks up on its own');
  assert.equal(r.wrath, 0, 'its wrath back to none');
  assert.notEqual(r.epithet, epithet, 'a new epithet');
  assert.ok(r.name.endsWith(r.epithet));
  assert.equal(r.history.at(-1).deed, 'festered');
  assert.equal(r.history.at(-1).at, DAY * 22);
  assert.equal(r.notice, 'festered');
  assert.ok(F.SIGNATURES.includes(r.sig), 'at rank 2 its signature drawn, as a deed\'s rank-up draws it');
  // the card, through the notice's step
  const ev = N.takeRevenantNotice(p, at(22));
  assert.equal(ev.kind, 'festered');
  assert.equal(ev.kicker, 'Grows bolder');
  assert.equal(ev.body, `${r.given} grows bolder - it has waited too long.`);
  assert.equal(r.notice, null);
  // the notice's step itself counts the days (the encounter tick asks it, never the festering alone)
  const q = made(p, { dueDay: 30 });
  N.takeRevenantNotice(p, at(33));
  assert.equal(q.wrath, 1, 'counted by the notice\'s step');
});

// PIN MOVED (AUDIT FEUD: a clock behind the last counted day - a reload of an older save - counts nothing and moves nothing
// back; the mirror counted those days, and none counts twice)
test('RVN9 THE CATCH-UP: a long absence counts seven days at most; a clock wound back counts nothing until it passes the last counted day; the switch off, nothing (mutants: no cap; the cap moved; the wound clock counted)', () => {
  const p = me();
  const r = made(p, { dueDay: 10 });
  N.revenantFester(p, at(10));
  N.revenantFester(p, at(40));   // thirty days: only days 34-40 are counted - 34 and 37 and 40 fester
  assert.equal(r.rank, 2, 'three wraths in the last seven days: one rank');
  assert.equal(r.wrath, 0);
  N.revenantFester(p, at(5));   // wound back
  N.revenantFester(p, at(6));
  assert.equal(r.wrath, 0, 'nothing before its due day');
  N.revenantFester(p, at(41));   // past it again: day 41 alone - never days 35-40 a second time
  assert.equal(r.wrath, 0, 'no day counted twice');
  assert.equal(r.rank, 2);
  setPref('lootRarity', false);
  assert.deepEqual(N.revenantFester(p, at(60)), []);
  assert.equal(r.wrath, 0);
});

test('RVN9 WHO FESTERS: the living, unsworn, not out - never one standing, sworn or fallen; at rank 5 its wrath stops at three and it never ranks past it (mutants: one out festering; the sworn; past rank 5)', () => {
  const p = me();
  const out = made(p);
  const sworn = made(p);
  const fallen = made(p);
  const top = made(p, { rank: 5 });
  out.out = true; sworn.sworn = true; fallen.defeated = true;
  N.revenantFester(p, at(10));
  for (let d = 11; d <= 40; d++) N.revenantFester(p, at(d));
  assert.equal(out.wrath, 0, 'standing');
  assert.equal(sworn.wrath, 0, 'sworn');
  assert.equal(fallen.wrath, 0, 'fallen');
  assert.equal(top.rank, 5, 'never past rank 5');
  assert.equal(top.wrath, 3, 'its wrath stops at three');
});

test('RVN9 THE STAND: its wrath at the stand - +10% health and +5% blows a wrath, over its rank\'s - and facing it clears it (mutants: unread; the shares moved; kept)', () => {
  const p = me();
  const stand = (wrath) => {
    const r = made(p);
    r.wrath = wrath;
    const e = { mobileType: M.Orc, level: 6, health: 100, maxHealth: 100 };
    N.applyRevenant(e, r);
    return { e, r };
  };
  const calm = stand(0), angry = stand(2);
  assert.equal(angry.e.maxHealth, Math.round(calm.e.maxHealth * 1.2));
  assert.equal(angry.e.health, angry.e.maxHealth);
  assert.ok(Math.abs(angry.e.damageScale - calm.e.damageScale * 1.1) < 1e-9);
  assert.ok(Math.abs(angry.e.healthMult - calm.e.healthMult * 1.2) < 1e-9);
  assert.equal(angry.r.wrath, 0, 'facing it clears it');
});

test('RVN9 THE SAVE: the day it counted to rides the save, and its wrath on its record (mutants: the day unsaved)', () => {
  const p = me();
  const r = made(p);
  N.revenantFester(p, at(10));
  N.revenantFester(p, at(13));
  const saved = modSaveRecords()[N.REVENANT_SAVE];
  assert.equal(saved.lastDay, 13);
  assert.equal(saved.list.find((x) => x.id === r.id).wrath, 1);
});
