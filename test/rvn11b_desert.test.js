// RVN11b - DESERTION (bible/12-Enhanced-AI/Feud-Arc.md section 22.2, OPEN 18; Mac, 2026-10-04: "more complex, less
// easy to accomplish and more detailed", then "Go"). A sworn one under 20 loyalty, once a day, one time in 0.15, leaves:
// no longer sworn - a living revenant again, its rank kept, the `deserted` deed, "the Oathbreaker" - due in one to three
// days; it keeps the more valuable half of its pack (on its record, as a theft is kept), the rest and its gold come back.
// Pinned: the numbers and the split; the day's roll (after its loyalty's move; never at 20, never on the first count,
// once a day); the deserter's record, pack and card; the cap; the save that knew it sworn; the party's member forgotten.
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
const RC = await import('../src/systems/revenantCompanions.js');
const S = await import('../src/systems/companionSlots.js');
const { setPref, _resetForTests } = await import('../src/systems/uiPrefs.js');
const { setWorldMinutes } = await import('../src/systems/worldTick.js');
const { MOBILE_TYPES: M } = await import('../src/characters/mobileTypes.js');
const { modSaveRecords, restoreModSaveRecords } = await import('../src/systems/modSaveData.js');
const { goldStack, goldPiecesOf } = await import('../src/systems/inventory.js');
const { itemLongName } = await import('../src/systems/itemInfo.js');
const { createWeapon } = await import('../src/combat/enemyEquipment.js');
const { WEAPONS: W } = await import('../src/characters/weapons.js');

const DAY = 1440;
let me;
beforeEach(() => {
  _resetForTests(); setPref('lootRarity', true);
  N._resetRevenantForTests(); RC._resetRetinueForTests(); S._resetCompanionSlotsForTests(); _store.clear();
  S.registerCompanionCount('revenant', () => RC.revenantsWithYou().length);
  me = { isPlayer: true, name: 'Ayla Stormwind', characterId: 'char-rvn11b', level: 8, health: 100, maxHealth: 100, items: [] };
  RC.setRetinuePlayer(me);
  setWorldMinutes(DAY * 10);
});
function sworn(state = 'away', { loyalty = 10, mobileType = M.Orc } = {}) {
  const r = N.revenantDeed(me, { mobileType, level: 6, champion: 'mighty', health: 5, maxHealth: 50, team: 'Monster' }, 'fled', { mobileType, rolls: () => 0 });
  const s = N.revenantSpared(me, { revenant: { id: r.id } }, { state });
  s.companion.loyalty = loyalty;
  return s;
}
const piece = (tpl, value) => { const it = createWeapon(tpl, 1, () => 0.5); it.value = value; return it; };
const at = (day, rolls) => ({ now: DAY * day + 30, rolls });

// ── the law ─────────────────────────────────────────────────────────

test('RVN11b THE LAW: under 20, one time in 0.15; the split keeps the more valuable half (an odd one its way), at most its room, never gold - the rest and the gold back (mutants: the numbers; the half; the room; gold kept)', () => {
  assert.deepEqual({ ...F.DESERT }, { AT: 20, CHANCE: 0.15 });
  const v = (it) => it.v;
  const gold = { gold: true }, a = { v: 50 }, b = { v: 40 }, c = { v: 30 }, d = { v: 20 }, e = { v: 10 };
  const opts = (room) => ({ value: v, isGold: (it) => it.gold === true, room });
  assert.deepEqual(F.deserterSplit([e, gold, c, a, d, b, null, 'x'], opts(3)), { kept: [a, b, c], back: [d, e, gold] });
  assert.deepEqual(F.deserterSplit([a, b, c, d], opts(3)), { kept: [a, b], back: [c, d] });
  assert.deepEqual(F.deserterSplit([a, b, c], opts(1)), { kept: [a], back: [b, c] }, 'its room');
  assert.deepEqual(F.deserterSplit([gold], opts(3)), { kept: [], back: [gold] });
  assert.deepEqual(F.deserterSplit(null, opts(3)), { kept: [], back: [] });
});

// ── the day ─────────────────────────────────────────────────────────

test('RVN11b THE DAY\'S ROLL: after the day\'s loyalty move, under 20 a roll under 0.15 deserts - not at 0.15, never at 20; never on the first count; once a day, a resting one too (mutants: the line moved; the roll\'s side; the first count rolling; rolled twice a day; the resting spared)', () => {
  const rolled = [];
  const roll = (v) => () => { rolled.push(v); return v; };
  const low = sworn('away', { loyalty: 19 });
  const edge = sworn('away', { loyalty: 22 });   // two days away: 21, then 20 - never
  const rest = sworn('away', { loyalty: 5 });
  N.revenantById(rest.id).companion.state = 'resting';
  N.revenantFester(me, at(10, roll(0)));
  assert.equal(rolled.length, 0, 'the first count: no day, no roll');
  N.revenantFester(me, at(11, roll(0.15)));
  assert.deepEqual([N.revenantById(low.id).sworn, N.revenantById(edge.id).sworn, N.revenantById(rest.id).sworn], [true, true, true], '0.15: stays');
  assert.equal(rolled.length, 2, 'one roll a day for each under the line (the low one at 18, the resting at 5) - none for one at 20');
  N.revenantFester(me, at(12, roll(0.149)));
  assert.deepEqual([N.revenantById(low.id).sworn, N.revenantById(edge.id).sworn, N.revenantById(rest.id).sworn], [false, true, false]);
  const w = sworn('with', { loyalty: 19 });
  N.revenantFester(me, at(13, roll(0)));
  assert.equal(N.revenantById(w.id).sworn, true, 'with me: the day\'s +2 first - 21, no roll');
});

// ── the deserter ────────────────────────────────────────────────────

test('RVN11b THE DESERTER: no longer sworn - a living revenant, its rank kept, "the Oathbreaker" whatever its rank, the deed at that day, due in one to three days, its notice and card (mutants: still sworn; the rank moved; a risen epithet; due at once; the card missing)', () => {
  const r = sworn('away', { loyalty: 3 });
  r.rank = 4;
  N.revenantFester(me, at(10, () => 0));
  N.revenantFester(me, at(11, () => 0));
  const x = N.revenantById(r.id);
  assert.deepEqual([x.sworn, x.fate, x.companion, x.defeated, x.rank], [false, null, null, false, 4]);
  assert.equal(x.epithet, 'the Oathbreaker');
  assert.equal(x.name, `${x.given} the Oathbreaker`);
  assert.deepEqual(x.history.at(-1), { deed: 'deserted', at: DAY * 11 });
  assert.ok(x.dueAt >= DAY * 11 + N.REVENANT_RETURN_MIN_MINUTES && x.dueAt <= DAY * 11 + N.REVENANT_RETURN_MAX_MINUTES);
  assert.ok(N.livingRevenants().includes(x));
  const ev = N.takeRevenantNotice(me, at(11, () => 0));
  assert.deepEqual([ev.kind, ev.kicker], ['deserted', 'Oathbreaker']);
  assert.equal(ev.body, `${x.given} broke its oath and left you.`);
  assert.equal(x.notice, null);
});

test('RVN11b ITS PACK: the better half kept on its record (its room what it took leaves), named on its card; the rest into my pack, its gold into my purse (mutants: nothing back; gold as a piece; kept over its room; the card unnamed)', () => {
  const r = sworn('away', { loyalty: 3 });
  const hi = piece(W.Longsword, 900), mid = piece(W.Saber, 500), lo = piece(W.Dagger, 100), low = piece(W.Staff, 10);
  const g = goldStack(75);
  N.revenantCompanionUpdate(me, r.id, (c) => { c.items = [lo, g, hi, low, mid]; });
  const q = sworn('away', { loyalty: 3 });
  const q1 = piece(W.Claymore, 800), q2 = piece(W.Katana, 700), q3 = piece(W.Dagger, 5);
  N.revenantById(q.id).took = [piece(W.Mace, 50), piece(W.Mace, 40)];
  N.revenantCompanionUpdate(me, q.id, (c) => { c.items = [q1, q2, q3]; });   // its half two - its room one
  N.revenantFester(me, at(10, () => 0));
  N.revenantFester(me, at(11, () => 0));
  const x = N.revenantById(r.id), y = N.revenantById(q.id);
  assert.deepEqual(x.took, [hi, mid], 'the better half');
  assert.equal(y.took.length, 3, 'its room: TOOK_MAX less the two it took');
  assert.equal(y.took[2], q1);
  for (const it of [lo, low, q2, q3]) assert.ok(me.items.includes(it), 'the rest, back');
  assert.ok(!me.items.includes(hi) && !me.items.includes(mid) && !me.items.includes(q1));
  assert.ok(!me.items.includes(g), 'gold is never a piece in the pack');
  assert.equal(goldPiecesOf(me), 75);
  const cards = [N.takeRevenantNotice(me, at(11, () => 0)), N.takeRevenantNotice(me, at(11, () => 0))];
  const byId = Object.fromEntries(cards.map((ev) => [ev.id, ev.body]));
  assert.equal(byId[r.id], `${x.given} broke its oath and left you. It kept your ${itemLongName(hi)} and ${itemLongName(mid)}. It left the rest of its pack to you.`);
  assert.equal(byId[q.id], `${y.given} broke its oath and left you. It kept your ${itemLongName(q1)}. It left the rest of its pack to you.`);
});

test('RVN11b THE CAP: a deserter living again past REVENANT_MAX forgets the weakest, oldest living one - never itself, nor one holding a piece (mutants: no trim; the deserter buried)', () => {
  const r = sworn('away', { loyalty: 3 });
  N.revenantById(r.id).rank = 1;
  const weak = [];
  for (let i = 0; i < N.REVENANT_MAX; i++) {
    const x = N.revenantDeed(me, { mobileType: M.Orc, level: 6, champion: 'mighty', health: 5, maxHealth: 50, team: 'Monster' }, 'fled', { mobileType: M.Orc, rolls: () => 0, now: 100 + i });
    x.rank = 2; weak.push(x);
  }
  N.revenantFester(me, at(10, () => 0));
  N.revenantFester(me, at(11, () => 0));
  assert.equal(N.livingRevenants().length, N.REVENANT_MAX);
  assert.ok(N.revenantById(r.id), 'never itself');
  assert.equal(N.revenantById(weak[0].id), null, 'the oldest of the weakest');
});

test('RVN11b THE SAVE THAT KNEW IT SWORN: a reload to before it deserted - its pack split since - stands it as the save had it (mutants: the deserter kept over the save)', () => {
  const r = sworn('away', { loyalty: 3 });
  const hi = piece(W.Longsword, 900);
  N.revenantCompanionUpdate(me, r.id, (c) => { c.items = [hi]; });
  const before = modSaveRecords();
  N.revenantFester(me, at(10, () => 0));
  N.revenantFester(me, at(11, () => 0));
  assert.equal(N.revenantById(r.id).sworn, false);
  restoreModSaveRecords(before);
  const back = N.revenantRecord(me, r.id);
  assert.equal(back.sworn, true, 'as the save had it');
  assert.equal(back.companion.items.length, 1);
  assert.deepEqual(back.took, []);
});

test('RVN11b THE PARTY: a deserter leaves the party (the layer takes its body out through its portal) and its member is forgotten - sworn again, a fresh one (mutants: the member kept)', () => {
  const r = sworn('with', { loyalty: 1 });
  const party = RC.revenantParty();
  const m = party.party.find((x) => x.name === r.id);
  assert.ok(m);
  N.revenantById(r.id).companion.state = 'away';   // a day away: -1 - and the roll
  N.revenantFester(me, at(10, () => 0));
  N.revenantFester(me, at(11, () => 0));
  assert.equal(party.party.some((x) => x.name === r.id), false);
  const again = N.revenantSpared(me, { revenant: { id: r.id } }, { state: 'with' });
  assert.ok(again);
  assert.notEqual(party.party.find((x) => x.name === r.id), m, 'a fresh member');
});
