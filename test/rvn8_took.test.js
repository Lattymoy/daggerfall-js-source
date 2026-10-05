// RVN8 - WHAT IT TAKES (bible/12-Enhanced-AI/Feud-Arc.md section 19; Mac, 2026-10-04: "more complex, less easy to
// accomplish and more detailed", then "Go"). Online alone: at the respawn, when this death was a revenant's kill, it
// takes one piece - drawn on its id and its kill count from the equipped weapon and the pack's five most valuable pieces;
// never a quest item, a summoned piece, the Materials Bag, gold or a locked piece; at most three held, past that it only
// gloats. Off the hand that held it, out of the pack, onto its record (the save's copy winning over the app's mirror),
// in its pack at every stand. Back: slain, in its body; executed, in the pile; spared, handed back at the oath ("It's
// yours. It always was."); escaped, kept. The cap never buries one holding a piece.
// Pinned: the exclusions; the pick (its pool, its draw, nothing to take); the take (online alone, once a death, off
// the hand, the line, the standing killer's pack, the gloat at three, the sworn and the fallen); carried at a stand;
// every way back and the escape; the cap; the save's copy over the mirror; the respawn's wiring and the spare's words.
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
const FT = await import('../src/systems/revenantFate.js');
const RC = await import('../src/systems/revenantCompanions.js');
const S = await import('../src/systems/companionSlots.js');
const { setPref, _resetForTests } = await import('../src/systems/uiPrefs.js');
const { setPlayerDoor } = await import('../src/systems/playerDoor.js');
const { setWorldMinutes } = await import('../src/systems/worldTick.js');
const { MOBILE_TYPES: M } = await import('../src/characters/mobileTypes.js');
const { WEAPONS: W } = await import('../src/characters/weapons.js');
const { createWeapon } = await import('../src/combat/enemyEquipment.js');
const { equipItem, equipTableOf, EQUIP_SLOTS } = await import('../src/systems/equip.js');
const { goldStack } = await import('../src/systems/inventory.js');
const { setLocked } = await import('../src/systems/itemLock.js');
const { itemLongName } = await import('../src/systems/itemInfo.js');
const { itemValueOf } = await import('../src/systems/itemTemplates.js');
const { modSaveRecords, restoreModSaveRecords } = await import('../src/systems/modSaveData.js');

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

beforeEach(() => {
  _resetForTests(); setPref('lootRarity', true);
  N._resetRevenantForTests(); RC._resetRetinueForTests(); S._resetCompanionSlotsForTests(); _store.clear();
  S.registerCompanionCount('revenant', () => RC.revenantsWithYou().length);
  setPlayerDoor(null); setWorldMinutes(1440 * 3);
});

const blade = (tpl = W.Longsword, mat = 1) => createWeapon(tpl, mat, () => 0.5);
function me(id = 'char-rvn8') {
  const p = { isPlayer: true, name: 'Ayla Stormwind', characterId: id, level: 10, stats: {}, skills: [], career: {}, activeEffects: [], items: [], health: 100, maxHealth: 100 };
  const w = blade(W.Longsword, 3);
  p.items.push(w, blade(W.Dagger, 0), blade(W.Claymore, 4), blade(W.Saber, 2), blade(W.Mace, 5), blade(W.Staff, 0), blade(W.Katana, 6), goldStack(500));
  equipItem(p, w);
  return p;
}
const killer = () => ({ mobileType: M.Orc, level: 6, champion: 'mighty', health: 50, maxHealth: 50, team: 'Monster' });
function slain(p, e = killer()) { return N.revenantDeed(p, e, 'slew', { mobileType: M.Orc, rolls: () => 0 }); }

test('RVN8 THE LAW: at most three held; never a quest item, a summoned piece, the Materials Bag, gold or a locked piece (mutants: the cap moved; any exclusion dropped)', () => {
  assert.equal(F.TOOK_MAX, 3);
  const b = blade();
  assert.equal(N.revenantMayTake(b), true);
  assert.equal(N.revenantMayTake({ ...b, questItem: true }), false, 'a quest item');
  assert.equal(N.revenantMayTake({ ...b, timeForItemToDisappear: 600 }), false, 'a summoned piece');
  assert.equal(N.revenantMayTake(goldStack(10)), false, 'gold');
  const locked = blade(); setLocked(locked, true);
  assert.equal(N.revenantMayTake(locked), false, 'a locked piece stays yours');
  assert.equal(N.revenantMayTake({ templateIndex: 'x' }), false);
  assert.equal(N.revenantMayTake(null), false);
  assert.match(read('src/systems/revenant.js'), /&& !item\.questItem && !isSummoned\(item\) && !isGoldPieces\(item\) && !isBagItem\(item\) && !isLocked\(item\);/, 'and the Materials Bag');
});

test('RVN8 THE PICK: drawn on its id and its kill count from my equipped weapon and my pack\'s five most valuable takeable pieces - never a sixth, never a locked one; one id and count one piece; nothing to take, null (mutants: the pool\'s size; the weapon left out; the draw off its id or its count; the least valuable)', () => {
  const p = me();
  const weapon = equipTableOf(p)[EQUIP_SLOTS.RightHand];
  const pack = p.items.filter((it) => it !== weapon && N.revenantMayTake(it)).sort((a, b) => itemValueOf(b) - itemValueOf(a));
  const pool = new Set([weapon, ...pack.slice(0, 5)]);
  const seen = new Set();
  for (let i = 0; i < 300; i++) {
    const it = N.pickTaken(`rvn8-${i}`, i % 4, weapon, p.items);
    assert.ok(pool.has(it), 'from the pool alone');
    seen.add(it);
    assert.equal(N.pickTaken(`rvn8-${i}`, i % 4, weapon, p.items), it, 'one id and count, one piece');
  }
  assert.equal(seen.size, pool.size, 'every piece of the pool drawn by someone');
  assert.ok(!seen.has(pack[5]), 'never the sixth most valuable');
  // the count draws again
  const ids = [...Array(50).keys()].map((i) => `rvn8-k${i}`);
  assert.ok(ids.some((id) => N.pickTaken(id, 1, weapon, p.items) !== N.pickTaken(id, 2, weapon, p.items)), 'a kill more, a draw anew');
  // a locked weapon is never in it
  setLocked(weapon, true);
  for (let i = 0; i < 100; i++) assert.notEqual(N.pickTaken(`rvn8-${i}`, 0, weapon, p.items), weapon);
  assert.equal(N.pickTaken('x', 0, null, [goldStack(5)]), null, 'nothing to take');
  assert.equal(N.pickTaken('x', 0, null, null), null);
});

test('RVN8 THE TAKE: online alone, once a death - the piece off the hand that held it and out of my pack, onto its record and into its standing body\'s pack, the wake box\'s line; at three it only gloats; a sworn or fallen one takes nothing (mutants: offline; twice a death; left equipped; left in the pack; the body empty; past three)', () => {
  const p = me();
  const e = killer();
  const r = slain(p, e);
  setPlayerDoor({ foes: () => [{ entity: e, dead: false }], feet: () => null, hurtFoe: () => {}, castOnPlayer: () => {} });
  assert.equal(N.revenantTakes(p, { online: false }), null, 'offline: nothing');
  assert.equal(N.revenantTakes(p, { online: true }), null, 'the death was answered already - offline, it was spent');
  slain(p, e);
  const got = N.revenantTakes(p, { online: true });
  const item = got.item;
  assert.ok(item);
  assert.equal(got.line, `${r.name} took your ${itemLongName(item)}.`);
  assert.ok(!p.items.includes(item), 'out of my pack');
  assert.equal(item.equipSlot ?? null, null, 'off my hand');
  assert.ok(!Object.values(equipTableOf(p)).includes(item));
  assert.deepEqual(r.took, [item]);
  assert.ok(e.items.includes(item), 'the killer standing over me carries it');
  slain(p, e);
  const second = N.revenantTakes(p, { online: true }).item;
  assert.equal(e.items.filter((it) => it === item).length, 1, 'each piece once in its pack');
  assert.ok(e.items.includes(second));
  assert.equal(N.revenantTakes(p, { online: true }), null, 'once a death');
  // three held: it gloats
  slain(p, e); N.revenantTakes(p, { online: true });
  assert.equal(r.took.length, 3);
  const before = p.items.length;
  slain(p, e);
  const gloat = N.revenantTakes(p, { online: true });
  assert.equal(gloat.item, null, 'at three it only gloats');
  assert.equal(gloat.line, null);
  assert.equal(p.items.length, before);
  // the sworn, and the switch off - each after its kill
  r.took = [];
  slain(p, e); r.sworn = true;
  assert.equal(N.revenantTakes(p, { online: true }), null, 'sworn since');
  r.sworn = false;
  slain(p, e); setPref('lootRarity', false);
  assert.equal(N.revenantTakes(p, { online: true }), null, 'the switch off');
  setPref('lootRarity', true);
  // the weapon in my hand, when it is the only piece to take: off my hand
  N._resetRevenantForTests(); _store.clear();
  const solo = me('char-rvn8w');
  const w = equipTableOf(solo)[EQUIP_SLOTS.RightHand];
  solo.items = [w, goldStack(10)];
  slain(solo);
  assert.equal(N.revenantTakes(solo, { online: true }).item, w);
  assert.equal(equipTableOf(solo)[EQUIP_SLOTS.RightHand] ?? null, null, 'off my hand');
  assert.equal(w.equipSlot ?? null, null);
});

test('RVN8 BACK: carried at every stand (once); slain carrying it, the record lets it go (it is in the body); executed, in the pile; spared, handed back at the oath; escaped, kept (mutants: not carried; carried twice; kept when slain; lost when escaped; the pile without it; never handed back)', () => {
  const p = me();
  const e = killer();
  const r = slain(p, e);
  setPlayerDoor({ foes: () => [], feet: () => null, hurtFoe: () => {}, castOnPlayer: () => {} });
  N.revenantTakes(p, { online: true });
  const item = r.took[0];
  // a later stand carries it
  const stand = { mobileType: M.Orc, level: 6, health: 50, maxHealth: 50, items: [] };
  N.applyRevenant(stand, r);
  N.grantRevenantLoot(stand, 10, () => 0.5);
  assert.ok(stand.items.includes(item), 'in its pack');
  N.grantRevenantLoot(stand, 10, () => 0.5);
  assert.equal(stand.items.filter((it) => it === item).length, 1, 'once');
  // escaped: kept
  N.revenantDeed(p, stand, 'fled', { mobileType: M.Orc, rolls: () => 0 });
  assert.deepEqual(r.took, [item], 'escaped: kept');
  // executed: the pile hands it over, the record lets it go
  const ex = { mobileType: M.Orc, level: 6, health: 50, maxHealth: 50, items: [] };
  N.applyRevenant(ex, r); N.grantRevenantLoot(ex, 10, () => 0.5);
  const pile = FT.finishExecution(p, { entity: ex });
  assert.ok(pile.includes(item), 'in the pile');
  assert.deepEqual(r.took, []);
  // slain carrying it: in the body; one never carrying it keeps its record's
  N._resetRevenantForTests(); _store.clear();
  const p2 = me('char-rvn8b');
  const r2 = slain(p2);
  N.revenantTakes(p2, { online: true });
  const bare = { revenant: { id: r2.id } };
  N.revenantSlain(p2, bare);
  assert.equal(r2.took.length, 1, 'a body that never carried it: the record keeps it');
  // spared: handed back
  N._resetRevenantForTests(); _store.clear();
  const p3 = me('char-rvn8c');
  const r3 = slain(p3);
  N.revenantTakes(p3, { online: true });
  const piece = r3.took[0];
  const kneel = { mobileType: M.Orc, level: 6, health: 1, maxHealth: 50, items: [] };
  N.applyRevenant(kneel, r3); N.grantRevenantLoot(kneel, 10, () => 0.5);
  const f = { entity: kneel, yielded: { at: 0 }, archive: null };
  const sp = FT.beginSpare(p3, f, { now: 0, rolls: () => 0 });
  assert.ok(sp, 'sworn');
  assert.ok(p3.items.includes(piece), 'handed back');
  assert.ok(!kneel.items.includes(piece));
  assert.deepEqual(r3.took, []);
  assert.ok(sp.event.body.endsWith(`It hands back your ${itemLongName(piece)}: "It's yours. It always was."`), sp.event.body);
});

test('RVN8 THE CAP AND THE SAVE: the cap never buries one holding a piece; the save\'s copy of what it took wins over the app\'s mirror - a load never brings back a piece the save holds (mutants: one holding a piece buried; the mirror\'s copy kept)', () => {
  const p = me();
  const r = slain(p);
  N.revenantTakes(p, { online: true });
  assert.equal(r.took.length, 1);
  r.rank = 1; r.born = -1; r.out = false;   // the weakest, the oldest, not standing - the one the cap would bury first
  for (let i = 0; i < N.REVENANT_MAX; i++) N.revenantDeed(p, { ...killer(), champion: 'swift' }, 'fled', { mobileType: M.Orc, rolls: () => 0 });
  assert.ok(N.revenantById(r.id), 'never buried while it holds a piece');
  // the save's copy wins: a save made before the theft knows no piece; the mirror (newer) does
  N._resetRevenantForTests(); _store.clear();
  const q = me('char-rvn8s');
  const rq = N.revenantDeed(q, killer(), 'fled', { mobileType: M.Orc, rolls: () => 0 });
  const save = JSON.parse(JSON.stringify(modSaveRecords()[N.REVENANT_SAVE]));
  slain(q, { ...killer(), revenant: { id: rq.id } });
  N.revenantTakes(q, { online: true });
  assert.equal(N.revenantById(rq.id).took.length, 1);
  restoreModSaveRecords({ [N.REVENANT_SAVE]: save });
  N.revenantToReturn(q, { now: 0 });   // any ask reads the mirror in
  assert.deepEqual(N.revenantById(rq.id).took, [], 'the save never knew it: no piece comes back');
  // and one the save holds is kept
  N.revenantTakes(q, { online: true });
  slain(q, { ...killer(), revenant: { id: rq.id } });
  N.revenantTakes(q, { online: true });
  const save2 = JSON.parse(JSON.stringify(modSaveRecords()[N.REVENANT_SAVE]));
  restoreModSaveRecords({ [N.REVENANT_SAVE]: save2 });
  N.revenantToReturn(q, { now: 0 });
  assert.equal(N.revenantById(rq.id).took.length, 1, 'the save holds it: kept');
});

test('RVN8 THE HOSTS: the online respawn takes it beside the death penalty and the chase\'s end, once a death (its guard), and the wake box says it (mutants: unwired; unsaid)', () => {
  const w = read('src/scenes/world.js');
  // PIN MOVED (RVN8's gate: AUDIT REP's pin holds the chase's clear right under the death's price - the theft follows it)
  assert.match(w, /const goldLost = applyDeathPenalty\(playerEntity\);[\s\S]{0,1200}?arrestFlow\.abandon\(\);[^\n]*\n\s*const took = revenantTakes\(playerEntity, \{ online: true \}\);/);
  assert.match(w, /new ActionTextBox\(\[respawnFlavorText\(kind\), deathPenaltyText\(goldLost\), took\?\.line\]\.filter\(Boolean\)\)/);
  assert.match(read('src/systems/revenantFate.js'), /const back = revenantHandBack\(player, r, f\.entity\);/);
});
