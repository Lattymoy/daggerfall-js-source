// UNQUIET III (bible/06-Systems/Revenants.md section 48; the owner, 2026-10-18: "Do it", of UNQUIET II's next three: a
// revenant of mastery trains a counter to the player's most-used weapon; wounds heal over time, so leaving it unhunted has
// a cost; and the trail picks its den from the nearest dungeon). Pinned: the numbers; a wound healing through the real
// day loop (every five days left alone - AUDIT UNQUIET, it was three - the oldest first; a new wound counting again; never one out or the Dread),
// saved, and said on the page; training through the real day loop (its scars' most-used habit, in a lesson's room, on its
// training days alone, never one of another ambition), its card through the notice step; the nearest den through the real
// deed (an escape in the open, the nearest; a kill or underground, the lair's own law).
import '../../modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const _store = new Map();
globalThis.localStorage = {
  getItem: (k) => (_store.has(k) ? _store.get(k) : null), setItem: (k, v) => { _store.set(k, String(v)); },
  removeItem: (k) => { _store.delete(k); }, clear: () => _store.clear(), key: (i) => [..._store.keys()][i] ?? null, get length() { return _store.size; },
};

const N = await import('../../../src/systems/revenant/revenant.js');
const U = await import('../../../src/systems/revenant/revenantUnquiet.js');
const F = await import('../../../src/systems/revenant/revenantFeud.js');
const PG = await import('../../../src/ui/revenant/revenantPage.js');
const { REVENANT_CARD_CSS } = await import('../../../src/ui/revenant/revenantCard.js');
const { feudOf } = await import('../../../src/systems/feudLedger.js');
const { setPref, _resetForTests } = await import('../../../src/systems/uiPrefs.js');
const { setPlayerDoor } = await import('../../../src/systems/playerDoor.js');
const { setWorldMinutes } = await import('../../../src/systems/worldTick.js');
const { MOBILE_TYPES: M } = await import('../../../src/characters/mobile/mobileTypes.js');
const { modSaveRecords, restoreModSaveRecords } = await import('../../../src/systems/modSaveData.js');

const DAY = 1440;
const me = (id = 'char-unquiet3') => ({ isPlayer: true, name: 'Ayla Stormwind', characterId: id, level: 10, stats: {}, skills: [], career: {}, activeEffects: [], items: [], health: 100, maxHealth: 100 });
const foe = (over = {}) => ({ mobileType: M.Orc, level: 6, champion: 'mighty', unquiet: true, health: 5, maxHealth: 50, team: 'Monster', ...over });
const D = (px, py, name, region = 3) => ({ px, py, name, region });

beforeEach(() => {
  _resetForTests(); setPref('lootRarity', true);
  N._resetRevenantForTests(); _store.clear(); setPlayerDoor(null); setWorldMinutes(DAY * 10);
});
function made(p, { personality = 'brutal', now = DAY * 10, deedName = 'fled' } = {}) {
  const r = N.revenantDeed(p, foe(), deedName, { mobileType: M.Orc, rolls: () => 0, now });
  assert.ok(r, 'born');
  r.personality = personality;
  return r;
}
const at = (d) => ({ now: DAY * d + 60, rolls: () => 0.99 });   // 0.99: no deserter among the sworn

test('UNQUIET III THE NUMBERS: a wound heals every five days left alone - counted from the day of its last; the days to the next (mutants: the days; a day before counted; the count from the wrong day)', () => {
  // PIN MOVED (AUDIT UNQUIET, section 49): five days - at three a wound healed before most returns found it
  assert.deepEqual({ ...U.WOUND }, { MAX: 3, RESIST: -15, HEAL_DAYS: 5 });
  assert.deepEqual([10, 11, 14, 15, 16, 20, 25].map((d) => U.healsOn(10, d)), [false, false, false, true, false, true, true]);
  assert.deepEqual([U.healsOn(-1, 4), U.healsOn(-1, 5), U.healsOn(undefined, 5), U.healsOn(0, 5)], [false, false, false, true], 'no wound day, none');
  assert.deepEqual([10, 11, 12, 14, 15].map((d) => U.daysToHeal(10, d, ['bled'])), [5, 4, 3, 1, 5]);
  assert.deepEqual([U.daysToHeal(10, 11, []), U.daysToHeal(-1, 11, ['bled'])], [0, 0]);
});

test('UNQUIET III A WOUND HEALS: left alone, its oldest wound heals every five days through the real day loop; a new wound counts from its own day; never one out in the world, nor the Dread; its day rides the save (mutants: never heals; the newest healed; the count unreset; one out healing; unsaved)', () => {
  const p = me();
  const r = made(p);
  r.dueAt = DAY * 99;   // far off: no festering in the way
  r.wounds = ['bled', 'lamed']; r.woundDay = 10;
  N.revenantFester(p, at(10));   // the first count: from here
  N.revenantFester(p, at(14));
  assert.deepEqual(r.wounds, ['bled', 'lamed'], 'four days: none yet');
  N.revenantFester(p, at(15));
  assert.deepEqual(r.wounds, ['lamed'], 'five days: the oldest heals');
  restoreModSaveRecords(modSaveRecords());
  const q = N.revenantsFor(p).find((x) => x.id === r.id);
  assert.equal(q.woundDay, 10, 'its day saved');
  N.revenantFester(p, at(20));
  assert.deepEqual(q.wounds, [], 'ten: the next');
  // a new wound through the real deed counts from its own day
  const e = foe({ revenant: { id: q.id } });
  feudOf(e).last = 'arrow';
  N.revenantDeed(p, e, 'fled', { mobileType: M.Orc, rolls: () => 0, now: DAY * 21 + 5 });
  assert.deepEqual([q.wounds, q.woundDay], [['lamed'], 21]);
  q.dueAt = DAY * 99; q.out = false;
  N.revenantFester(p, at(25));
  assert.deepEqual(q.wounds, ['lamed'], 'four days after its own day: none');
  N.revenantFester(p, at(26));
  assert.deepEqual(q.wounds, [], 'five');
  // never one out, nor the Dread
  q.wounds = ['bled']; q.woundDay = 26; q.out = true;
  N.revenantFester(p, at(31));
  assert.deepEqual(q.wounds, ['bled'], 'out in the world');
  q.out = false; q.dread = true; q.rank = 5;
  N.revenantFester(p, at(36));
  assert.deepEqual(q.wounds, ['bled'], 'the Dread keeps what it has');
});

test('UNQUIET III THE PAGE: its wounds and when the oldest heals - "unless you find it first"; with no day known, the wounds alone (mutants: unsaid; the days wrong)', () => {
  assert.equal(PG.woundLine({ wounds: ['lamed'], woundDay: 10 }, DAY * 11 + 60), 'Wounds you left: Lamed (a lamed leg, so it runs slower). The oldest heals in 4 days unless you find it first.');
  assert.ok(PG.woundLine({ wounds: ['lamed'], woundDay: 10 }, DAY * 14).endsWith('heals in 1 day unless you find it first.'));
  assert.equal(PG.woundLine({ wounds: ['lamed'] }), 'Wounds you left: Lamed (a lamed leg, so it runs slower).');
  assert.equal(PG.woundLine({ wounds: [], woundDay: 10 }, DAY * 11), '');
});

test('UNQUIET III TRAINING: a revenant of mastery, on its days of training, learns the answer to the habit its scars name most - the latest among equals, never my running or the night - in a lesson\'s room; never past its rank\'s lessons, never one of another ambition (mutants: never trains; trains on any day; the count unread; past its room; any ambition)', () => {
  assert.equal(U.trainLesson({ personality: 'cold', rank: 2, learned: [], scars: [{ k: 'arrow', at: 1 }, { k: 'blade', at: 2 }, { k: 'blade', at: 3 }], mobileType: M.Orc }), 'mailed', 'its scars name the blade most');
  assert.equal(U.trainLesson({ personality: 'cold', rank: 2, learned: [], scars: [{ k: 'blade', at: 1 }, { k: 'arrow', at: 2 }], mobileType: M.Orc }), 'arrowWise', 'the latest among equals');
  assert.equal(U.trainLesson({ personality: 'cold', rank: 2, learned: ['mailed'], scars: [{ k: 'blade', at: 1 }, { k: 'blade', at: 2 }, { k: 'axe', at: 3 }], mobileType: M.Orc }), 'hewnHard', 'one it holds passes to the next');
  assert.equal(U.trainLesson({ personality: 'cold', rank: 2, learned: [], scars: [{ k: 'routed', at: 1 }, { k: 'routed', at: 2 }, { k: 'night', at: 3 }], mobileType: M.Orc }), null, 'my running and the night teach no training');
  assert.equal(U.trainLesson({ personality: 'cold', rank: 1, learned: ['mailed'], scars: [{ k: 'axe', at: 1 }], mobileType: M.Orc }), null, 'no room at rank I');
  assert.equal(U.trainLesson({ personality: 'cold', rank: 5, learned: ['mailed', 'braced', 'patient'], scars: [{ k: 'axe', at: 1 }], mobileType: M.Orc }), null, 'ADAPT_MAX');
  assert.equal(U.trainLesson({ personality: 'brutal', rank: 2, learned: [], scars: [{ k: 'blade', at: 1 }], mobileType: M.Orc }), null, 'vengeance trains none');
  assert.deepEqual(F.ADAPTATIONS.filter((a) => U.trainedHow(a) !== F.ADAPT_HOW[a]), [], 'every lesson\'s habit in its own words (each through the text core)');
  assert.equal(U.trainedHow('nope'), null);
  // through the real day loop: on its training days alone
  const p = me();
  const r = made(p, { personality: 'cold' });
  Object.assign(r, { rank: 2, learned: [], scars: [{ k: 'blade', at: 1 }, { k: 'blade', at: 2 }, { k: 'arrow', at: 3 }], dueAt: DAY * 10 + 300, wrath: 0, out: false, notice: null });
  N.revenantFester(p, at(10));
  N.revenantFester(p, at(11));
  assert.deepEqual(r.learned, [], 'day 11: no training day (mastery\'s 12, 14, 16)');
  N.revenantFester(p, at(12));
  assert.deepEqual(r.learned, ['mailed'], 'day 12: it trained against my blade');
  assert.equal(r.notice, 'trained');
  const ev = N.takeRevenantNotice(p, at(12));
  assert.equal(ev.kind, 'trained');
  assert.equal(ev.kicker, 'Trained');
  assert.equal(ev.body, `${r.given} has been training. It has learned to answer your blade.`);
  N.revenantFester(p, at(14));
  assert.deepEqual(r.learned, ['mailed', 'arrowWise'], 'day 14: the next habit, its second room');
  N.takeRevenantNotice(p, at(14));
  N.revenantFester(p, at(16));
  assert.equal(r.rank, 3, 'its third wrath: a rank');
  assert.equal(r.notice, 'festered', 'the rank\'s card over the training\'s');
  assert.deepEqual(r.learned, ['mailed', 'arrowWise'], 'nothing left to train against');
  // another ambition never trains
  const b = made(p, { personality: 'brutal', now: DAY * 20 });
  Object.assign(b, { rank: 2, learned: [], scars: [{ k: 'blade', at: 1 }], dueAt: DAY * 20 + 300, wrath: 0, out: false, notice: null });
  for (let d = 21; d <= 30; d++) N.revenantFester(p, at(d));
  assert.deepEqual(b.learned, [], 'vengeance');
});

test('UNQUIET III THE NEAREST DEN: one that gets away in the open goes to ground in the nearest dungeon in reach, its trail there; a kill keeps the lair\'s own law; underground, that dungeon (mutants: the bearing\'s pick on an escape; the nearest on a kill)', () => {
  assert.deepEqual(U.nearestLair(100, 100, [D(110, 100, 'Far Keep'), D(103, 98, 'Near Den'), D(97, 103, 'Tied Den')]), D(103, 98, 'Near Den'), 'the nearest - the earlier among equals');
  assert.deepEqual(U.nearestLair(100, 100, [{ px: 100, py: 100 }, null, D(101, 100, 'Ok')]), D(101, 100, 'Ok'), 'only a named one');
  assert.deepEqual(U.nearestLair(100, 100, [D(101, 109, 'South Gap'), D(104, 100, 'East Hole')]), D(104, 100, 'East Hole'), 'its longer side measured');
  assert.equal(U.nearestLair(1.5, 100, [D(101, 100, 'Ok')]), null);
  assert.equal(U.nearestLair(100, 100, []), null);
  const p = me();
  let here = { px: 100, py: 100, dungeons: [D(108, 100, 'East Keep'), D(102, 101, 'Hollow'), D(94, 100, 'West Crypt')] };
  setPlayerDoor({ foes: () => [], feet: () => [0, 0, 0], hurtFoe: () => {}, castOnPlayer: () => {}, lairHere: () => here });
  const k = made(p, { deedName: 'slew' });
  assert.deepEqual(k.lair, F.pickLair(k.id, 100, 100, here.dungeons), 'a kill: the lair\'s own pick');
  const r = made(p, { now: DAY * 11 });
  assert.deepEqual(r.lair, D(102, 101, 'Hollow'), 'an escape: the nearest');
  assert.equal(r.lairKnown, true, 'its trail leads there');
  here = { px: 300, py: 300, dungeons: [D(305, 300, 'Far Hole', 9)] };
  N.revenantDeed(p, foe({ revenant: { id: r.id } }), 'fled', { mobileType: M.Orc, rolls: () => 0, now: DAY * 12 });
  assert.deepEqual(r.lair, D(305, 300, 'Far Hole', 9), 'it moves to the den nearest its flight');
  N.revenantDeed(p, foe({ revenant: { id: r.id } }), 'routed', { mobileType: M.Orc, rolls: () => 0, now: DAY * 13 });
  assert.deepEqual(r.lair, D(305, 300, 'Far Hole', 9), 'my flight: its lair kept');
  here = { underground: D(40, 41, 'The Pit', 5) };
  N.revenantDeed(p, foe({ revenant: { id: r.id } }), 'fled', { mobileType: M.Orc, rolls: () => 0, now: DAY * 14 });
  assert.deepEqual(r.lair, D(40, 41, 'The Pit', 5), 'underground: that dungeon');
});

test('UNQUIET III THE CARD\'S EDGE: training an old gold (mutants: the edge lost)', () => {
  assert.match(REVENANT_CARD_CSS, /\.rvncard\.is-trained \{ border-left-color: #8a7a3a; \}/);
});
