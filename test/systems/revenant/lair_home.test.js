// LAIR-HOME (FIELD BUGS 2026-10-19; Shines: "he never showed up in the lair. I had to bait them out to me on the road"):
// A KNOWN LAIR ANSWERS. RVN7d stood a revenant at home only when it was not OUT, and the road's return roll
// (revenantToReturn) puts a due one out the moment it stands it for me - so a lair entered just after the road had stood
// it was empty for the visit, and the body it had stood waited by the door. Now one revenant has one body
// (systems/revenant/revenant.js - the entity its latest stand put it in): entering its lair takes it home unless that body
// is here already, is in a fight with me, kneels for my judgement, or has not stood up yet; the body it left is STALE and
// its pool withdraws it with its band (scenes/exteriorFoes.js withdrawStale). The record:
// bible/01-Overview/bugs/Field-Bugs-2026-10-19.md LAIR-HOME.
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
const { markPlayerHarm, endPlayerFights } = await import('../../../src/systems/harmMark.js');
const { feudOf } = await import('../../../src/systems/feudLedger.js');
const { modSaveRecords, restoreModSaveRecords } = await import('../../../src/systems/modSaveData.js');
const { setPref, _resetForTests } = await import('../../../src/systems/uiPrefs.js');
const { setPlayerDoor } = await import('../../../src/systems/playerDoor.js');
const { setWorldMinutes } = await import('../../../src/systems/worldTick.js');
const { MOBILE_TYPES: M } = await import('../../../src/characters/mobile/mobileTypes.js');

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const me = () => ({ isPlayer: true, name: 'Ayla Stormwind', characterId: 'char-lairhome', level: 10, stats: {}, skills: [], career: {}, activeEffects: [], items: [], health: 100, maxHealth: 100 });
const NOW = 1440 * 5;
const LAIR = Object.freeze({ px: 40, py: 41, name: 'The Pit', region: 5 });
const HERE = Object.freeze({ px: 40, py: 41 });
const foe = (r) => ({ mobileType: r?.mobileType ?? M.Orc, level: 6, health: 100, maxHealth: 100, items: [], team: 'Monster' });

beforeEach(() => {
  _resetForTests(); setPref('lootRarity', true);
  N._resetRevenantForTests(); _store.clear(); setPlayerDoor(null); setWorldMinutes(NOW); endPlayerFights();
});

/** A known lair's revenant, due, that the ROAD has stood for me - the return roll's claim and its body (the producers'). */
function onTheRoad(p) {
  const r = N.revenantDeed(p, { mobileType: M.Orc, level: 6, champion: 'mighty', unquiet: true, health: 5, maxHealth: 50, team: 'Monster' }, 'fled', { mobileType: M.Orc, rolls: () => 0 });
  r.lair = { ...LAIR }; r.lairKnown = true; r.dueAt = NOW - 1;
  assert.equal(N.revenantToReturn(p, { now: NOW, rolls: () => 0 }), r, 'the road\'s return claims it');
  const road = foe(r);
  N.applyRevenant(road, r, { now: NOW });
  return { r, road };
}

test('LAIR-HOME a known lair answers when the road has stood it: it goes home, its road body stale - and a stale body is no presence (mutants: out never home; the stale test read off the id; presence counting a stale body)', () => {
  const p = me();
  const { r, road } = onTheRoad(p);
  assert.equal(r.out, true, 'out on the road');
  assert.equal(N.revenantStale(road), false, 'its road body is its body');
  assert.equal(N.revenantForLair(p, HERE, { now: NOW, foes: [] }), r, 'entering its lair: it is at home');
  const home = foe(r);
  N.applyRevenant(home, r, { now: NOW });
  assert.deepEqual([N.revenantStale(road), N.revenantStale(home)], [true, false], 'one revenant, one body: the road\'s is stale');
  assert.equal(N.revenantForLair(p, HERE, { now: NOW, foes: [{ entity: home }] }), null, 'never twice: its body is here');
  // out of the lair, the dungeon gone: the stale road body is no presence - it is lost as any body is, due again later
  r.outAt = Date.now() - N.REVENANT_STAND_GRACE_MS - 1;
  assert.equal(N.revenantPresence([{ entity: road }], { now: NOW }), true);
  assert.equal(r.out, false, 'the road body it left keeps nothing out');
  assert.equal(r.dueAt, NOW + N.REVENANT_LOST_MINUTES);
});

test('LAIR-HOME never home while its road body is in a fight with me, kneels for my judgement, or stands in this pool (mutants: the fight unread; the kneel unread; the pool unread)', () => {
  const p = me();
  const { r, road } = onTheRoad(p);
  markPlayerHarm(road);
  assert.equal(N.revenantForLair(p, HERE, { now: NOW, foes: [] }), null, 'in a fight with me: it is at the door behind me');
  assert.equal(N.revenantStale(road), false);
  endPlayerFights();
  assert.equal(N.revenantForLair(p, HERE, { now: NOW, foes: [{ entity: road, dead: false }] }), null, 'its body here already');
  N.revenantYielded(p, road, { now: NOW });
  assert.equal(N.revenantForLair(p, HERE, { now: NOW, foes: [] }), null, 'kneeling where it was beaten, awaiting me');
  assert.equal(r.out, true);
});

test('LAIR-HOME a claim not yet stood waits its grace, then is a stand that never came; a lair\'s claim that stood nobody gives the road\'s back as it was; a fresh claim freed is free (mutants: no grace; the release clearing the road\'s; the release keeping a fresh one)', () => {
  const p = me();
  const r = N.revenantDeed(p, { mobileType: M.Orc, level: 6, champion: 'mighty', unquiet: true, health: 5, maxHealth: 50, team: 'Monster' }, 'fled', { mobileType: M.Orc, rolls: () => 0 });
  r.lair = { ...LAIR }; r.lairKnown = true; r.dueAt = NOW - 1;
  assert.equal(N.revenantToReturn(p, { now: NOW, rolls: () => 0 }), r);
  assert.equal(N.revenantForLair(p, HERE, { now: NOW, foes: [] }), null, 'the road\'s stand still standing up');
  r.outAt = Date.now() - N.REVENANT_STAND_GRACE_MS;
  assert.equal(N.revenantForLair(p, HERE, { now: NOW, foes: [] }), r, 'past its grace: a stand that never came');
  N.releaseRevenantStand(r);
  assert.equal(r.out, false, 'a claim on one not out, freed: free');
  r.dueAt = NOW + 9999; r.lair = null;   // out of the next half's way
  // the road's body standing, a lair's claim on it that stood nobody: the road's claim back, as it was
  const { r: q, road } = onTheRoad(me());
  const roadAt = q.outAt;
  assert.equal(N.revenantForLair(p, HERE, { now: NOW, foes: [] }), q);
  N.releaseRevenantStand(q);
  assert.deepEqual([q.out, q.outAt, N.revenantStale(road)], [true, roadAt, false], 'still out, where it stood');
});

test('LAIR-HOME the bodies: a killer over my body is its body; a body a later stand replaced is left FOR GOOD - whatever comes of the later one (slain, got away, routed) - and does nothing in its name (no deed, no fall, no kneel, no oath); a sworn one is never stale; a load forgets them all (AUDIT FB1019 C1, C2) (mutants: staleness off the registry; a left body\'s deed; the load keeping them; the sworn withdrawn)', () => {
  for (const after of ['slain', 'fled', 'routed']) {
    N._resetRevenantForTests(); _store.clear(); endPlayerFights();
    const p = me();
    const { r, road } = onTheRoad(p);
    assert.equal(N.revenantForLair(p, HERE, { now: NOW, foes: [] }), r);
    const home = foe(r);
    N.applyRevenant(home, r, { now: NOW });
    if (after === 'slain') N.revenantSlain(p, home, { now: NOW });
    else if (after === 'fled') N.revenantDeed(p, home, 'fled', { mobileType: M.Orc, rolls: () => 0 });
    else N.revenantRouted(p, { entity: home, mobileType: M.Orc, gender: 'male' }, { rolls: () => 0 });
    assert.equal(N.revenantStale(road), true, `the lair's body ${after}: the road's stays left`);
    const before = JSON.stringify(N.revenantById(r.id));
    assert.equal(N.revenantDeed(p, road, 'fled', { mobileType: M.Orc, rolls: () => 0 }), null, 'no deed in its name');
    assert.equal(N.revenantSlain(p, road, { now: NOW }), null, 'nor its fall');
    assert.equal(N.revenantYielded(p, road, { now: NOW }), null, 'nor its kneel');
    assert.equal(N.revenantSpared(p, road, { now: NOW }), null, 'nor its oath');
    assert.equal(JSON.stringify(N.revenantById(r.id)), before, 'its record untouched');
  }
  // a killer over my body is its body; a sworn one never stale
  N._resetRevenantForTests(); _store.clear();
  const p = me();
  const killer = { mobileType: M.Orc, level: 6, champion: 'mighty', unquiet: true, health: 50, maxHealth: 50, team: 'Monster' };
  const r = N.revenantDeed(p, killer, 'slew', { mobileType: M.Orc, rolls: () => 0 });
  assert.equal(r.out, true, 'standing over my body');
  assert.equal(N.revenantStale(killer), false);
  const next = foe(r);
  N.applyRevenant(next, r, { now: NOW });
  assert.deepEqual([N.revenantStale(killer), N.revenantStale(next)], [true, false], 'a later stand leaves it');
  const kept = killer.revenant;
  killer.revenant = { id: kept.id, name: kept.name, rank: kept.rank, sworn: true };   // a sworn one's stamp (revenantCompanions.js)
  assert.equal(N.revenantStale(killer), false, 'a sworn one is its own law, even a body it left');
  killer.revenant = kept;
  assert.equal(N.revenantStale({ revenant: { id: r.id } }), false, 'a body this session does not know');
  // a load stands no body: what it had left is forgotten with it
  const save = modSaveRecords();
  restoreModSaveRecords(save);
  assert.equal(N.revenantStale(killer), false, 'a load forgets the bodies');
});

test('LAIR-HOME never home while I fight its road body - my blows on it (its feud ledger open: a beaten one chased home is never made whole by its lair) as well as its on me; a lair\'s claim still standing up over a road body answers no second ask (a rest\'s); a dead record of its body in the pool is no body here (AUDIT FB1019 C3) (mutants: my blows unread; the pending claim over a body; a dead record counted)', () => {
  const p = me();
  const { r, road } = onTheRoad(p);
  assert.ok(feudOf(road), 'my first blow opens its ledger');
  assert.equal(N.revenantForLair(p, HERE, { now: NOW, foes: [] }), null, 'beaten down and chased home: it is no home of its');
  delete road._feud;
  assert.equal(N.revenantForLair(p, HERE, { now: NOW, foes: [{ entity: road, dead: true }] }), r, 'a dead record of its body is none here');
  assert.equal(N.revenantForLair(p, HERE, { now: NOW, dueOnly: true, foes: [] }), null, 'its lair\'s claim still standing up: no second ask');
});

test('LAIR-HOME the hosts: the open world\'s pool withdraws a stale body and its band as the cull takes a foe, before its fate, after a puppet; the dungeon\'s pool withdraws one too, and asks with its own pool, both of its asks (mutants: never withdrawn; the band left; a corpse left; the dungeon never withdrawing; the pool unasked)', () => {
  const X = read('src/scenes/exteriorFoes.js');
  assert.match(X, /\n {8}continue;\n {6}\}\n {6}\/\/ LAIR-HOME[^\n]*\n[^\n]*\n {6}if \(revenantStale\(f\.entity\)\) \{ withdrawStale\(f\); continue; \}\n {6}\/\/ REVENANT-FATE/, 'after the puppet\'s branch, before the fate');
  const w = X.slice(X.indexOf('function withdrawStale(f) {'), X.indexOf('function withdrawStale(f) {') + 420);
  assert.match(w, /for \(const g of foes\) if \(g !== f && !g\.dead && !g\.puppet && g\.retinueOf === id\) \{ releaseFoeBatch\(g\); g\.dead = true; \}/);
  assert.match(w, /releaseFoeBatch\(f\);\n\s*f\.dead = true;\n\s*if \(f\.ai\?\.detected\) setEnemyAlert\(playerEntity, false\);/, 'its alert let go with it');
  assert.doesNotMatch(w, /corpse|revenantDeed|revenantRouted/, 'no corpse, no deed');
  const D = read('src/scenes/dungeonContext.js');
  assert.match(D, /\n {6}if \(f\.dead\) continue;\n {6}if \(revenantStale\(f\.entity\)\) \{ for \(const g of foes\) if \(g\.retinueOf === f\.entity\.revenant\.id\) questPoolOps\.removeFoe\(g\); questPoolOps\.removeFoe\(f\); continue; \}/, 'the dungeon\'s pool too: one body, whichever stand came last');
  assert.match(D, /const r = revenantForLair\(playerEntity, lairPixel\(\), \{ foes \}\);/);
  assert.match(D, /const r = revenantForLair\(playerEntity, lairPixel\(\), \{ dueOnly: true, foes \}\);/);
});
