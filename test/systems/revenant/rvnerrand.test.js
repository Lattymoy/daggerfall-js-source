// RVN-ERRAND (bible/06-Systems/Revenants.md section 42; the owner, 2026-10-17: "Add the ability to send revnants off on
// timed missions to anywhere within tamriel (They disappear and come back brining rewards like loot, crafting materials,
// currency, etc)"). A sworn one sent to one of Tamriel's nine provinces on a venture (Plunder, Forage, Sell-sword) leaves
// through its portal, is gone the place's days on the character's own clock, and comes back - at the party's frame - with
// a haul drawn on its errand's seed into my purse, pack and Materials Bag: won on its odds (its rank and kit against the
// place's danger) and more loyal, or hard-won with half and hurt. At most two abroad. An errand is the save's.
// Pinned: the law and its data (every place a province, every good a material with a pack form); the odds; the errand's
// shape and its clamp; the haul (its seed, its formulas, the ventures, hard-won, rarity off); the send, the refusals, the
// return through the party's own wake, the words; the recall; the save both ways; the days; the page. AUDIT RVN
// (Revenants.md section 43): online the lived step alone carries it on (a raise and time away pushed back), offline the
// one clock; the clamp written back; the tier, piece and fine-goods bounds; the loyalty once an errand; no call bonus after
// a road; the recall's rest; no desertion abroad; a save abroad restored whole; no kit act abroad; the provinces' names.
import '../../modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const _store = new Map();
globalThis.localStorage = {
  getItem: (k) => (_store.has(k) ? _store.get(k) : null), setItem: (k, v) => { _store.set(k, String(v)); },
  removeItem: (k) => { _store.delete(k); }, clear: () => _store.clear(), key: (i) => [..._store.keys()][i] ?? null, get length() { return _store.size; },
};

const N = await import('../../../src/systems/revenant/revenant.js');
const E = await import('../../../src/systems/revenant/revenantErrands.js');
const RC = await import('../../../src/systems/revenant/revenantCompanions.js');
const S = await import('../../../src/systems/companionSlots.js');
const { setPref, _resetForTests } = await import('../../../src/systems/uiPrefs.js');
const WT = await import('../../../src/systems/worldTick.js');
const { setWorldMinutes } = WT;
const { MOBILE_TYPES: M } = await import('../../../src/characters/mobile/mobileTypes.js');
const { modSaveRecords, restoreModSaveRecords } = await import('../../../src/systems/modSaveData.js');
const { PROVINCES, CITIES } = await import('../../../src/world/tamriel/tamrielGeography.js');
const { materialKeys, materialKeyOfItem } = await import('../../../src/systems/materialsBag.js');
const { withdrawable } = await import('../../../src/net/professionLaw.js');
const { weaponOfMaterial } = await import('../../../src/combat/enemyEquipment.js');
const { rarityOf } = await import('../../../src/systems/loot/lootRarity.js');
const { drawCompanionsPage, _resetCompanionRosterForTests, _setCompanionRosterIconForTests } = await import('../../../src/ui/companionRoster.js');

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const DAY = 1440, T0 = DAY * 10;
let me, said;
beforeEach(() => {
  _resetForTests(); setPref('lootRarity', true); WT.setSharedClock(null);
  N._resetRevenantForTests(); RC._resetRetinueForTests(); S._resetCompanionSlotsForTests(); _store.clear();
  S.registerCompanionCount('revenant', () => RC.revenantsWithYou().length);
  me = { isPlayer: true, name: 'Ayla Stormwind', characterId: 'char-rvnerrand', level: 12, health: 100, maxHealth: 100, items: [], goldPieces: 0 };
  RC.setRetinuePlayer(me);
  setWorldMinutes(T0);
  said = [];
  N.setRevenantPresenter((ev) => { said.push(ev); return true; });
});
function sworn({ mobileType = M.Orc, rank = 1, state = 'with', loyalty = 60 } = {}) {
  const r = N.revenantDeed(me, { mobileType, level: 6, champion: 'mighty', unquiet: true, health: 5, maxHealth: 50, team: 'Monster' }, 'fled', { mobileType, rolls: () => 0 });
  r.rank = rank;
  const s = N.revenantSpared(me, { revenant: { id: r.id } }, { state });
  s.companion.loyalty = loyalty;
  return s;
}
const rec = (r) => N.revenantById(r.id);
const place = (k) => E.errandPlace(k);
/** A seed whose haul is won (or not) for `r` at `key` - the haul's first draw decides. */
function seedFor(r, key, won, venture = 'plunder') {
  for (let s = 0; s < 500; s++) { const e = E.newErrand(r, key, venture, T0, s); if (E.errandHaul(r, e, { level: 12 }).won === won) return s; }
  throw new Error('no seed');
}
const party = () => RC.revenantParty();

// ── the law ─────────────────────────────────────────────────────────

test('RVN-ERRAND THE LAW: every number; the three ventures\' leans; the nine places - each a province of Tamriel with cities, its days and danger, its goods real materials with a pack form (mutants: a number moved; a lean moved; a place\'s days or danger moved; a good misspelt)', async () => {
  assert.deepEqual(JSON.parse(JSON.stringify(E.ERRAND)), { MAX: 2, WON_LOYALTY: 4, GOLD: [10, 18], DANGER_GOLD: 0.25, RANK_HAUL: 0.1, ODDS: { BASE: 0.55, PER: 0.1, MIN: 0.3, MAX: 0.95, DEVOTED: 0.05 }, HARD_SHARE: 0.5, UNITS: { BASE: 3, PER_DANGER: 2, FINE_TIER: 5, FINE_A_DAY: 1 }, TIERS: { MAGIC: 0.5, RARE: [0.06, 0.03, 0.02], LEGENDARY: [0.005, 0.004, 0.003] }, STEP_MAX: 30 });
  const { PLAYED_STEP_MAX_SECONDS } = await import('../../../src/systems/quest/clock.js');
  assert.equal(E.ERRAND.STEP_MAX, PLAYED_STEP_MAX_SECONDS / 60, 'a quest clock\'s played step, in minutes');
  const T = E.ERRAND.TIERS;
  assert.ok(T.LEGENDARY[0] + 5 * T.LEGENDARY[1] + 4 * T.LEGENDARY[2] <= 0.045, 'AUDIT RVN F2: a Legendary a piece at most the loot ladder\'s 4.5%');
  assert.deepEqual(Object.fromEntries(Object.entries(E.VENTURES).map(([k, v]) => [k, [v.gold, v.units, v.items]])), { plunder: [0.4, 0.35, 'many'], forage: [0.15, 1, 0.2], contract: [1, 0, 0.25] });
  assert.deepEqual(E.ERRAND_PLACES.map((p) => [p.key, p.days, p.danger]), [['HighRock', 1, 1], ['Hammerfell', 1, 2], ['Imperial', 2, 2], ['Skyrim', 2, 3], ['Valenwood', 2, 3], ['Sumurset', 3, 3], ['Elsweyr', 3, 3], ['Morrowind', 3, 4], ['BlackMarsh', 4, 5]]);
  assert.deepEqual(E.ERRAND_PLACES.map((p) => p.key).sort(), PROVINCES.map((p) => p.key).sort(), 'all nine provinces, and only them');
  const keys = new Set(materialKeys());
  for (const p of E.ERRAND_PLACES) {
    assert.equal(p.name, PROVINCES.find((x) => x.key === p.key).name);
    assert.ok(CITIES.some((c) => c.province === p.key), `${p.name} has cities`);
    for (const g of p.goods) { assert.ok(keys.has(g), `${g} is a material`); assert.ok(withdrawable(g), `${g} has a pack form`); }
  }
  assert.deepEqual(E.ERRAND_PLACES.map((p) => p.name), E.ERRAND_PLACES.map((p) => PROVINCES.find((x) => x.key === p.key).name), 'AUDIT RVN D6: the map\'s English, through the text core');
  assert.match(read('src/systems/revenant/revenantErrands.js'), /get BlackMarsh\(\) \{ return t\('rvn\.errand\.place\.blackMarsh', 'Black Marsh'\); \}/);
});

test('RVN-ERRAND ITS ODDS: BASE + PER a point of its strength (rank and kit) over the danger, within MIN..MAX, a Devoted one more; the words (mutants: the kit unread; a clamp gone; Devoted unread; a word\'s line moved)', () => {
  const r = sworn({ rank: 1 });
  assert.equal(E.errandOdds(rec(r), place('HighRock')), 0.55);
  assert.equal(E.errandOdds(rec(r), place('Hammerfell')), 0.45);
  assert.equal(E.errandOdds(rec(r), place('BlackMarsh')), 0.3, 'never under MIN');
  const big = sworn({ rank: 5, loyalty: 95 });
  assert.equal(E.errandOdds(rec(big), place('HighRock')), 0.95, 'never over MAX');
  assert.equal(E.errandOdds(rec(big), place('BlackMarsh')), 0.6, 'Devoted: 0.55 + 0.05');
  const b = weaponOfMaterial(120, 1);
  me.items.push(b);
  RC.giveSwornGear(r.id, b);
  assert.equal(E.errandOdds(rec(r), place('Hammerfell')), 0.455, 'a Common piece: a twentieth of a point (AUDIT RVN G8)');
  assert.deepEqual([0.75, 0.74, 0.5, 0.49].map(E.oddsWord), ['Good odds', 'Fair odds', 'Fair odds', 'Grim odds']);
});

test('RVN-ERRAND THE ERRAND: back the place\'s days later, a city of its province, read back whole or none; an older clock never stretches its days (mutants: the days unread; the clamp gone; a bad errand kept)', () => {
  const r = sworn();
  const e = E.newErrand(r, 'Skyrim', 'forage', T0, 7);
  assert.deepEqual([e.place, e.venture, e.at, e.until, e.seed], ['Skyrim', 'forage', T0, T0 + 2 * DAY, 7]);
  assert.ok(CITIES.some((c) => c.province === 'Skyrim' && c.name === e.city));
  assert.equal(E.newErrand(r, 'Akavir', 'forage', T0, 1), null);
  assert.equal(E.newErrand(r, 'Skyrim', 'heist', T0, 1), null);
  assert.deepEqual(E.sanitizeErrand(JSON.parse(JSON.stringify(e))), e);
  assert.equal(E.sanitizeErrand({ ...e, place: 'Akavir' }), null);
  assert.equal(E.sanitizeErrand({ ...e, until: e.at - 1 }), null);
  assert.equal(E.errandUntil(e, T0 + 60), T0 + 2 * DAY);
  assert.equal(E.errandUntil(e, T0 - 10 * DAY), T0 - 8 * DAY, 'an older clock: its days from now, never more');
  assert.equal(E.errandWords(e, T0 + 60), `In ${e.city}, Skyrim (Forage), back in about 47 hours`);
  assert.equal(E.errandLeftWords(T0 + 3 * DAY, T0), 'back in about 3 days');
});

test('RVN-ERRAND THE HAUL: drawn on its seed (one seed, one haul); gold by level, days, danger and rank; units of the place\'s goods; pieces by venture; hard-won halves each; Loot rarity off mints Common (mutants: the seed unread; a scale unread; the share skipped; the units\' count moved; the pieces\' count moved)', () => {
  const r = sworn({ rank: 3 });
  const key = 'Morrowind', p = place(key);
  const won = E.newErrand(r, key, 'plunder', T0, seedFor(rec(r), key, true));
  const h = E.errandHaul(rec(r), won, { level: 12 });
  const shape = (x) => ({ ...x, items: x.items.map((it) => [it.group, it.templateIndex, it.material, it.rarity ?? null]) });
  assert.deepEqual(shape(E.errandHaul(rec(r), won, { level: 12 })), shape(h), 'one seed, one haul');
  assert.equal(h.won, true);
  const scale = (1 + 0.25 * (p.danger - 1)) * (1 + 0.1 * 2);
  assert.ok(h.gold >= Math.floor(12 * 3 * 10 * scale * 0.4) && h.gold <= Math.floor(12 * 3 * 18 * scale * 0.4), `gold ${h.gold} in its band`);
  assert.equal(h.units.reduce((n, [, k]) => n + k, 0), Math.floor((3 + 2 * 4) * 3 * 0.35), 'Plunder: a third of a forage\'s units');
  for (const [k] of h.units) assert.ok(p.goods.includes(k), `${k} is Morrowind's`);
  assert.equal(h.items.length, p.days, 'Plunder: a piece a day (AUDIT RVN F3)');
  const hf = E.errandHaul(rec(r), E.newErrand(r, 'Hammerfell', 'plunder', T0, seedFor(rec(r), 'Hammerfell', true)), { level: 12 });
  assert.equal(hf.items.length, 1, 'the nearer shore no more a day');
  const hard = E.newErrand(r, key, 'plunder', T0, seedFor(rec(r), key, false));
  const hh = E.errandHaul(rec(r), hard, { level: 12 });
  assert.equal(hh.won, false);
  assert.equal(hh.units.reduce((n, [, k]) => n + k, 0), Math.floor((3 + 2 * 4) * 3 * 0.35 * 0.5), 'hard-won: half');
  assert.equal(hh.items.length, Math.round(3 * 0.5), 'half the pieces, a half rounded up');
  assert.ok(hh.gold <= Math.floor(12 * 3 * 18 * scale * 0.4 * 0.5));
  const c = E.errandHaul(rec(r), E.newErrand(r, key, 'contract', T0, 3), { level: 12 });
  assert.deepEqual(c.units, [], 'Sell-sword: no goods');
  assert.ok(c.gold >= Math.floor(12 * 3 * 10 * scale * 0.5), 'Sell-sword: gold first');
  const f = E.errandHaul(rec(r), E.newErrand(r, key, 'forage', T0, seedFor(rec(r), key, true, 'forage')), { level: 12 });
  assert.equal(f.units.reduce((n, [, k]) => n + k, 0), (3 + 2 * 4) * 3, 'Forage: its full units');
  const fine = (u) => u.filter(([k]) => ['ore:ebony', 'hide:dreugh', 'gem:diamond'].includes(k)).reduce((n, [, k]) => n + k, 0);
  for (let sd = 0; sd < 40; sd++) assert.ok(fine(E.errandHaul(rec(r), E.newErrand(r, key, 'forage', T0, sd), { level: 12 }).units) <= p.days, 'AUDIT RVN F4: the finest goods at most one a day');
  const off = E.errandHaul(rec(r), won, { level: 12, rarity: false });
  assert.ok(off.items.every((it) => rarityOf(it) === 'common'), 'Loot rarity off: Common');
  assert.equal(E.errandHaulWords({ gold: 412, units: [['ore:ebony', 6], ['hide:dreugh', 2]], items: [{}] }), '412 gold, 6 Ebony Ore, 2 Dreugh Shells and a piece of gear', 'AUDIT RVN D5: the Materials Bag\'s own names, counted');
  assert.equal(E.errandHaulWords({ gold: 0, units: [], items: [] }), 'nothing');
});

// ── the acts ────────────────────────────────────────────────────────

test('RVN-ERRAND SENT, AND BACK: it leaves the party (its portal - the layer reads `party`), its words said at the party\'s next frame; refused resting, abroad, past two; no call, no release while abroad; back at the party\'s wake on its minute with its haul in my purse and pack, waiting to be called and +4 more loyal (mutants: never leaves; the words said under the menu; back early; the haul never handed; the loyalty unmoved)', () => {
  const r = sworn({ rank: 2 });
  const seed = seedFor(rec(r), 'HighRock', true, 'plunder');
  assert.equal(party().party.length, 1);
  assert.equal(RC.sendOnErrand(r.id, 'HighRock', 'plunder', { now: T0, seed }), null);
  assert.equal(rec(r).companion.state, 'errand');
  assert.equal(party().party.length, 0, 'gone from my side');
  assert.equal(said.length, 0, 'its words wait for the frame');
  party().wake(T0);
  assert.equal(said.length, 1);
  assert.deepEqual([said[0].kind, said[0].kicker], ['errand', 'Mission']);
  assert.match(said[0].line, /It sets out for .+, in High Rock, back in about 24 hours\./);
  assert.equal(RC.callRefusal(rec(r), T0 + 60), 'Abroad, back in about 23 hours.');
  assert.equal(RC.releaseRevenant(r.id), null, 'no release while abroad');
  assert.equal(RC.sendOnErrand(r.id, 'Skyrim', 'forage', { now: T0 }), 'It is already abroad.');
  const b = sworn({ state: 'away' }), c = sworn({ state: 'away' }), d = sworn({ state: 'away' });
  assert.equal(RC.sendOnErrand(b.id, 'Skyrim', 'forage', { now: T0 }), null);
  assert.equal(RC.sendOnErrand(c.id, 'Skyrim', 'forage', { now: T0 }), '2 of your sworn are abroad already, the most allowed at once.');
  N.revenantCompanionUpdate(me, d.id, (x) => { x.state = 'resting'; x.until = T0 + 60; });
  assert.equal(RC.errandRefusal(rec(d), T0), 'Still recovering.');
  const loyal = rec(r).companion.loyalty;
  party().wake(T0 + DAY - 1);
  assert.equal(rec(r).companion.state, 'errand', 'not yet');
  const haul = E.errandHaul(rec(r), rec(r).companion.errand, { level: 12 });
  said.length = 0;
  party().wake(T0 + DAY);
  assert.equal(rec(r).companion.state, 'away', 'back, waiting to be called');
  assert.equal(rec(r).companion.errand, null);
  assert.equal(rec(r).companion.loyalty, loyal + 4);
  assert.equal(me.goldPieces, haul.gold);
  assert.equal(me.items.filter((it) => !materialKeyOfItem(it)).length, haul.items.length, 'its pieces in my pack');
  const units = me.items.filter((it) => materialKeyOfItem(it)).reduce((n, it) => n + (it.stackCount ?? 1), 0);
  assert.equal(units, haul.units.reduce((n, [, k]) => n + k, 0), 'its goods in my pack (offline, no bag)');
  assert.equal(said.length, 1);
  assert.deepEqual([said[0].kind, said[0].kicker], ['errand_back', 'Returned']);
  assert.match(said[0].line, new RegExp(`Back from High Rock with ${E.errandHaulWords(haul).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.`));
  assert.equal(RC.callRefusal(rec(r), T0 + DAY), null, 'it may be called');
});

test('RVN-ERRAND HARD-WON AND RECALLED: a hard road brings back half and it must recover a rest\'s length, its loyalty unmoved; a recall brings it back at once with nothing (mutants: hard-won read as won; the rest skipped; a recall paid)', () => {
  const r = sworn({ rank: 1 });
  const seed = seedFor(rec(r), 'BlackMarsh', false, 'contract');
  RC.sendOnErrand(r.id, 'BlackMarsh', 'contract', { now: T0, seed });
  const loyal = rec(r).companion.loyalty;
  const haul = E.errandHaul(rec(r), rec(r).companion.errand, { level: 12 });
  party().wake(T0 + 4 * DAY);
  assert.equal(haul.won, false);
  assert.deepEqual([rec(r).companion.state, rec(r).companion.until], ['resting', T0 + 4 * DAY + RC.REVENANT_REST_MIN]);
  assert.equal(rec(r).companion.loyalty, loyal);
  assert.equal(me.goldPieces, haul.gold);
  assert.match(said.at(-1).line, /Back, hurt, from Black Marsh with .+\. It must recover\./);
  const q = sworn({ state: 'away' });
  RC.sendOnErrand(q.id, 'Skyrim', 'plunder', { now: T0, seed: 1 });
  const gold = me.goldPieces, items = me.items.length;
  assert.equal(RC.recallFromErrand(q.id, T0 + 60), true);
  assert.deepEqual([rec(q).companion.state, rec(q).companion.errand, rec(q).companion.until], ['resting', null, T0 + 60 + RC.REVENANT_REST_MIN], 'AUDIT RVN F8: worn from the road - no free re-roll of its seed');
  assert.deepEqual([me.goldPieces, me.items.length], [gold, items], 'nothing brought');
  assert.equal(RC.recallFromErrand(q.id), false, 'not abroad');
  // AUDIT RVN F6: a road's rest earns no call bonus (a hard road out-paid a won one: +10 against +4)
  party().wake(T0 + 4 * DAY + RC.REVENANT_REST_MIN);
  assert.deepEqual([rec(r).companion.state, rec(r).companion.rested], ['away', false]);
  RC.callRevenant(r.id, T0 + 5 * DAY);
  assert.equal(rec(r).companion.loyalty, loyal, 'no +10 after a road');
});

test('RVN-ERRAND AUDIT RVN F1 THE LIVED STEP: online an errand is carried on by the time lived with the world alone - a rest, a Loiter or a journey (a raise) pushes its minute back by as much, a step past STEP_MAX (time away) by the rest; offline the one clock carries it (mutants: the raise charged; the step unbounded; offline pushed; the push unwritten)', () => {
  assert.deepEqual([E.errandStep(10, 0, true), E.errandStep(10, 4, true), E.errandStep(10, 10, true), E.errandStep(10, 30, true), E.errandStep(90, 0, true), E.errandStep(10, 10, false), E.errandStep(-5, 0, true)], [0, 4, 10, 10, 60, 0, 0]);
  let world = T0;
  WT.setSharedClock(() => world);
  WT.setOwnMinutes(T0);
  const r = sworn({ rank: 5, state: 'away', loyalty: 95 });
  assert.equal(RC.sendOnErrand(r.id, 'Hammerfell', 'plunder', { now: T0, seed: 1 }), null);
  for (let d = 0; d < 10; d++) { WT.advanceOwnMinutes(DAY); party().wake(Math.floor(WT.ownMinutes())); }
  assert.equal(rec(r).companion.state, 'errand', 'ten days raised: still abroad');
  assert.equal(rec(r).companion.errand.until, T0 + 11 * DAY, 'its minute pushed back by every raise');
  for (let m = 0; m < DAY; m += 20) { world += 20; WT.setOwnMinutes(WT.ownMinutes() + 20); party().wake(Math.floor(WT.ownMinutes())); }   // lived: the own clock with the world's, nothing raised
  assert.equal(world, T0 + DAY);
  assert.notEqual(rec(r).companion.state, 'errand', 'a day lived: back');
  WT.setSharedClock(null);
  const q = sworn({ rank: 5, state: 'away', loyalty: 95 });
  setWorldMinutes(T0);
  RC.sendOnErrand(q.id, 'Hammerfell', 'plunder', { now: T0, seed: 1 });
  setWorldMinutes(T0 + DAY);
  party().wake(T0 + DAY);
  assert.notEqual(rec(q).companion.state, 'errand', 'offline: a rest\'s day is a day');
});

test('RVN-ERRAND AUDIT RVN F5, F7, F9, F10 THE RECORD: an errand an older clock stretched is written back to its days; a reload of a save made abroad brings its haul back again, never its loyalty; abroad, no day\'s desertion is rolled, and a save abroad comes back whole over a record that has since left me; abroad, its kit is neither given nor taken (mutants: the clamp unwritten; the loyalty paid twice; desertion abroad; the save\'s errand lost; a kit act abroad)', () => {
  const r = sworn({ rank: 2 });
  RC.sendOnErrand(r.id, 'Skyrim', 'plunder', { now: T0, seed: seedFor(rec(r), 'Skyrim', true) });
  N.revenantCompanionUpdate(me, r.id, (c) => { c.errand.until = T0 + 12 * DAY; });
  party().wake(T0);
  assert.equal(rec(r).companion.errand.until, T0 + 2 * DAY, 'written back: its days from now');
  const saved = JSON.parse(JSON.stringify(modSaveRecords()));
  const loyal = rec(r).companion.loyalty;
  party().wake(T0 + 2 * DAY);
  assert.equal(rec(r).companion.loyalty, loyal + 4);
  restoreModSaveRecords(saved);
  party().wake(T0 + 2 * DAY);
  assert.equal(rec(r).companion.loyalty, loyal + 4, 'the haul again, the loyalty once');
  // desertion
  const w = sworn({ state: 'away', loyalty: 5 });
  RC.sendOnErrand(w.id, 'BlackMarsh', 'forage', { now: T0, seed: 1 });
  for (let d = 1; d <= 5; d++) N.revenantFester(me, { now: T0 + d * DAY, rolls: () => 0 });
  assert.equal(rec(w).sworn, true, 'never lost abroad');
  // a save abroad, the record gone since
  const g = sworn({ state: 'away' });
  RC.sendOnErrand(g.id, 'Imperial', 'contract', { now: T0, seed: 2 });
  const saved2 = JSON.parse(JSON.stringify(modSaveRecords()));
  party().wake(T0 + 2 * DAY);
  RC.releaseRevenant(g.id);
  assert.equal(rec(g)?.sworn ?? false, false);
  restoreModSaveRecords(saved2);
  assert.deepEqual([N.revenantRecord(me, g.id)?.sworn, rec(g).companion.state], [true, 'errand'], 'abroad again, as the save had it');
  // kit
  RC.recallFromErrand(w.id); RC.recallFromErrand(g.id);
  const k = sworn({ rank: 3, state: 'away' });
  const blade = weaponOfMaterial(120, 1);
  me.items.push(blade);
  assert.equal(RC.giveSwornGear(k.id, blade), null);
  assert.equal(RC.sendOnErrand(k.id, 'HighRock', 'plunder', { now: T0, seed: 1 }), null);
  assert.equal(RC.takeSwornGear(k.id, 'weapon').length, 0, 'not taken abroad');
  const helm = { group: 'Armor', templateIndex: 102, material: 0, currentCondition: 100, maxCondition: 100 };
  me.items.push(helm);
  assert.equal(RC.giveSwornGear(k.id, helm), 'It is abroad with its kit.');
});

test('RVN-ERRAND AN ERRAND IS THE SAVE\'S: abroad in the save, abroad again after a reload - back on its minute with the same haul; begun since the save, never begun (where the save had it); an errand day moves no loyalty (mutants: the mirror\'s errand kept; the save\'s lost; the days counted)', () => {
  const r = sworn({ rank: 2 });
  RC.sendOnErrand(r.id, 'Skyrim', 'plunder', { now: T0, seed: seedFor(rec(r), 'Skyrim', true) });
  const saved = JSON.parse(JSON.stringify(modSaveRecords()));
  party().wake(T0 + 2 * DAY);
  const first = { gold: me.goldPieces, n: me.items.length };
  assert.equal(rec(r).companion.state, 'away');
  restoreModSaveRecords(saved);
  me.items = []; me.goldPieces = 0;
  assert.equal(N.revenantRecord(me, r.id).companion.state, 'errand', 'the save sent it, the save has it abroad');
  assert.equal(rec(r).companion.errand.until, T0 + 2 * DAY);
  party().wake(T0 + 2 * DAY);
  assert.deepEqual({ gold: me.goldPieces, n: me.items.length }, first, 'the same haul');
  // begun since the save
  const q = sworn({ state: 'with' });
  const saved2 = JSON.parse(JSON.stringify(modSaveRecords()));
  RC.sendOnErrand(q.id, 'Hammerfell', 'forage', { now: T0, seed: 1 });
  restoreModSaveRecords(saved2);
  assert.deepEqual([N.revenantRecord(me, q.id).companion.state, rec(q).companion.errand], ['with', null], 'never begun');
  // the days
  const w = sworn({ state: 'away', loyalty: 50 });
  RC.sendOnErrand(w.id, 'BlackMarsh', 'forage', { now: T0, seed: 1 });
  N.revenantFester(me, { now: T0, rolls: () => 0.99 });
  N.revenantFester(me, { now: T0 + 3 * DAY, rolls: () => 0.99 });
  assert.equal(rec(w).companion.loyalty, 50, 'abroad: no day away counted');
});

test('RVN-ERRAND THE PAGE: Mission opens the sheet - the three ventures, the nine places with their days, danger and odds; Send sends it; one abroad says where and when, and is Recalled - no Release, no Gear, no Mission (mutants: the sheet never drawn; the odds unsaid; Release left on one abroad)', () => {
  _resetCompanionRosterForTests();
  _setCompanionRosterIconForTests(() => ({ src: 'data:x', w: 30, h: 40 }));
  globalThis.document = undefined;
  const r = sworn({ rank: 1 });
  const draw = () => { const d = el('div', 'px-qdetail'); drawCompanionsPage(d, () => {}, { el, divider: (t) => el('h4', 'px-divider', t), meter: (n, m) => el('div', 'px-meter', `${n}/${m}`), here: () => null, kindName: () => 'Orc' }); return d; };
  let d = draw();
  buttons(d, 'Mission')[0].onclick();
  d = draw();
  assert.deepEqual(byClass(d, 'cmp-vent').map((b) => b.textContent), ['Plunder', 'Forage', 'Sell-sword']);
  const dests = byClass(d, 'cmp-dest');
  assert.equal(dests.length, 9);
  assert.match(dests[0].textContent, /^High Rock - a day, danger IFair odds 55%Send$/);
  assert.match(dests[8].textContent, /^Black Marsh - 4 days, danger VGrim odds 30%Send$/);
  assert.doesNotMatch(d.textContent, /Online, a mission keeps real time/, 'offline: the one clock, no word of the world\'s');   // PIN MOVED (OFFLINE-ROAD): the online word is the world's time now
  assert.match(d.textContent, /A hard-won mission brings back 50% of the haul/);
  byClass(d, 'cmp-vent')[1].onclick();
  d = draw();
  assert.ok(byClass(d, 'cmp-vent')[1].classList.contains('on'), 'Forage chosen');
  buttons(d, 'Send')[3].onclick();
  assert.deepEqual([rec(r).companion.state, rec(r).companion.errand.place, rec(r).companion.errand.venture], ['errand', 'Skyrim', 'forage']);
  d = draw();
  assert.match(d.textContent, /Abroad/);
  assert.match(d.textContent, /In .+, Skyrim \(Forage\), back in about 2 days/);
  assert.equal(buttons(d, 'Recall').length, 1);
  assert.deepEqual([buttons(d, 'Release').length, buttons(d, 'Gear').length, buttons(d, 'Mission').length, buttons(d, 'Call').length], [0, 0, 0, 0]);
  buttons(d, 'Recall')[0].onclick();
  assert.equal(rec(r).companion.state, 'errand', 'AUDIT RVN D9: asked first - a recall forfeits its haul');
  d = draw();
  assert.match(d.textContent, /Recall .+\? It returns now with nothing and must rest\./);
  buttons(d, 'Let it go on')[0].onclick();
  d = draw();
  assert.equal(buttons(d, 'Let it go on').length, 0);
  buttons(d, 'Recall')[0].onclick();
  d = draw();
  buttons(d, 'Recall')[0].onclick();
  assert.equal(rec(r).companion.state, 'resting');
});

// ── the page's fake document (revenant_companions.test.js's) ────────
function fakeEl(tag) {
  const classes = new Set();
  const n = {
    tag, children: [], attrs: {}, parent: null, title: '', isConnected: true,
    classList: { add: (...c) => c.forEach((x) => classes.add(x)), contains: (c) => classes.has(c), remove: (...c) => c.forEach((x) => classes.delete(x)) },
    get className() { return [...classes].join(' '); }, set className(v) { classes.clear(); String(v).split(/\s+/).filter(Boolean).forEach((x) => classes.add(x)); },
    _text: '', get textContent() { return n._text + n.children.map((c) => c.textContent ?? '').join(''); }, set textContent(v) { n._text = String(v ?? ''); },
    get firstChild() { return n.children[0] ?? null; },
    append(...cs) { for (const c of cs) { c.parent = n; n.children.push(c); } },
    insertBefore(c, ref) { c.parent = n; const i = ref ? n.children.indexOf(ref) : -1; if (i < 0) n.children.push(c); else n.children.splice(i, 0, c); return c; },
    setAttribute(k, v) { n.attrs[k] = v; },
  };
  return n;
}
function el(t, cls, text) { const n = fakeEl(t); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
function byClass(root, cls) { const out = []; const walk = (x) => { for (const c of x.children ?? []) { if (c.classList?.contains(cls)) out.push(c); walk(c); } }; walk(root); return out; }
function buttons(root, label) { const out = []; const walk = (x) => { for (const c of x.children ?? []) { if (c.tag === 'button' && c.textContent === label) out.push(c); walk(c); } }; walk(root); return out; }
