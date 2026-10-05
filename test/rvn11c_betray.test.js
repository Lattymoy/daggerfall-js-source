// RVN11c - BETRAYAL (bible/12-Enhanced-AI/Feud-Arc.md section 22.3, OPEN 19; Mac, 2026-10-04: "more complex, less
// easy to accomplish and more detailed", then "Go"). A sworn one under 10 loyalty - and only an Unhinged, Craven or
// Brutal one - turns on me once, when a hurt leaves me under a quarter of my health: out of the party first, then a
// hostile revenant standing where it stood (the `betrayed` deed, "the Betrayer", rank +1). The rest never betray.
// Pinned: the numbers and who may; the moment through the real hurt (the line, my death, one a hurt, at my side with a
// body); the record's turn (rank, signature, name, deed, its pack as a deserter's, the cap, the member); its stand (no
// return counted); its card; the hosts' plumbing and the world's turning.
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
const { setPref, _resetForTests } = await import('../src/systems/uiPrefs.js');
const { setWorldMinutes } = await import('../src/systems/worldTick.js');
const { hurtPlayer, setAvoidDeathHook } = await import('../src/characters/playerEntity.js');
const { MOBILE_TYPES: M } = await import('../src/characters/mobileTypes.js');
const { createWeapon } = await import('../src/combat/enemyEquipment.js');
const { WEAPONS: W } = await import('../src/characters/weapons.js');
const { goldStack, goldPiecesOf } = await import('../src/systems/inventory.js');

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const DAY = 1440;
let me;
const told = [];
beforeEach(() => {
  _resetForTests(); setPref('lootRarity', true);
  N._resetRevenantForTests(); RC._resetRetinueForTests(); S._resetCompanionSlotsForTests(); _store.clear(); setAvoidDeathHook(null);
  S.registerCompanionCount('revenant', () => RC.revenantsWithYou().length);
  me = { isPlayer: true, name: 'Ayla Stormwind', characterId: 'char-rvn11c', level: 8, health: 100, maxHealth: 100, items: [], stats: {}, skills: [], career: {}, activeEffects: [] };
  RC.setRetinuePlayer(me);
  told.length = 0;
  RC.setRetinueListener((kind, r) => told.push([kind, r.id]));
  setWorldMinutes(DAY * 10);
});
function sworn(state = 'with', { loyalty = 5, personality = 'brutal', rank = 1 } = {}) {
  const r = N.revenantDeed(me, { mobileType: M.Orc, level: 6, champion: 'mighty', health: 5, maxHealth: 50, team: 'Monster' }, 'fled', { mobileType: M.Orc, rolls: () => 0 });
  r.rank = rank;
  const s = N.revenantSpared(me, { revenant: { id: r.id } }, { state });
  s.companion.loyalty = loyalty;
  s.personality = personality;
  return s;
}
const bodies = (map) => RC.setRetinueBodies((id) => map[id] ?? null);

test('RVN11c THE LAW: under 10, under a quarter of my health, the Unhinged, the Craven and the Brutal alone (mutants: a number moved; a kind added or lost)', () => {
  assert.deepEqual({ ...F.BETRAY, KINDS: [...F.BETRAY.KINDS] }, { AT: 10, HEALTH: 0.25, KINDS: ['unhinged', 'craven', 'brutal'] });
  const r = (personality, loyalty, isSworn = true) => ({ sworn: isSworn, personality, companion: { loyalty } });
  assert.deepEqual(['unhinged', 'craven', 'brutal'].map((p) => F.mayBetray(r(p, 9))), [true, true, true]);
  assert.equal(F.mayBetray(r('brutal', 10)), false, 'at 10: no');
  for (const p of ['honourable', 'weary', 'humorous', 'cold', 'witty', 'zealous', 'arrogant']) assert.equal(F.mayBetray(r(p, 0)), false, `${p}: deserts, never betrays`);
  assert.equal(F.mayBetray(r('brutal', 0, false)), false, 'not sworn');
  assert.equal(F.mayBetray(null), false);
});

test('RVN11c THE MOMENT, THROUGH THE REAL HURT: a hurt that leaves me under a quarter (alive) turns the first that may, at my side with its body here - one a hurt; at a quarter none; my death none (mutants: the line moved; a death turning; the body unread; two a hurt; unwired)', () => {
  const loyal = sworn('with', { loyalty: 50 }), honest = sworn('with', { personality: 'honourable' });   // first, bodies here - and neither may
  const away = sworn('away'), bodiless = sworn('with'), a = sworn('with'), b = sworn('with');
  bodies({ [loyal.id]: { health: 9 }, [honest.id]: { health: 9 }, [away.id]: { health: 9 }, [a.id]: { health: 9 }, [b.id]: { health: 9 } });
  hurtPlayer(me, 75);
  assert.deepEqual(told, [], 'at a quarter: none');
  hurtPlayer(me, 1);
  assert.deepEqual(told, [['betray', a.id]], 'the first that may, its body here - one a hurt');
  assert.equal(N.revenantById(a.id).sworn, false);
  assert.deepEqual([N.revenantById(loyal.id).sworn, N.revenantById(honest.id).sworn, N.revenantById(away.id).sworn, N.revenantById(bodiless.id).sworn, N.revenantById(b.id).sworn], [true, true, true, true, true]);
  hurtPlayer(me, 1);
  assert.deepEqual(told.at(-1), ['betray', b.id], 'the next hurt, the next');
  const c = sworn('with');
  bodies({ [c.id]: { health: 9 } });
  told.length = 0;
  hurtPlayer(me, 1000);
  assert.deepEqual(told, [], 'my death turns nobody');
  assert.equal(RC.betrayalStep({ isPlayer: true, peer: true, maxHealth: 100 }, 5), null, 'a peer\'s hurt is not mine');
});

test('RVN11c THE TURN: not sworn, its rank up (never past 5; its signature at 2), "the Betrayer" whatever its rank, the deed, due should it get away, its member forgotten (mutants: still sworn; the rank kept; past 5; a risen epithet; no deed)', () => {
  const r = sworn('with', { rank: 1 });
  const party = RC.revenantParty();
  const m = party.party.find((x) => x.name === r.id);
  N.revenantBetrays(me, N.revenantById(r.id), { now: DAY * 10 + 5, rolls: () => 0 });
  const x = N.revenantById(r.id);
  assert.deepEqual([x.sworn, x.fate, x.companion, x.rank], [false, null, null, 2]);
  assert.ok(F.SIGNATURES.includes(x.sig), 'its signature drawn at rank 2');
  assert.equal(x.name, `${x.given} the Betrayer`);
  assert.deepEqual(x.history.at(-1), { deed: 'betrayed', at: DAY * 10 + 5 });
  assert.equal(x.dueAt, DAY * 10 + 5 + N.REVENANT_RETURN_MIN_MINUTES);
  assert.equal(party.party.some((y) => y.name === r.id), false);
  N.revenantSpared(me, { revenant: { id: r.id } }, { state: 'with' });
  assert.notEqual(party.party.find((y) => y.name === r.id), m, 'its member forgotten');
  const top = sworn('with', { rank: 5 });
  N.revenantBetrays(me, N.revenantById(top.id));
  assert.equal(N.revenantById(top.id).rank, 5, 'never past 5');
  assert.equal(N.revenantById(top.id).epithet, 'the Betrayer');
  assert.equal(N.revenantBetrays(me, N.revenantById(top.id)), null, 'once - no longer sworn');
});

test('RVN11c ITS PACK: a deserter\'s split - what it may hold on its record, the rest and its gold to me (mutants: nothing back; all kept)', () => {
  const r = sworn('with');
  const hi = createWeapon(W.Longsword, 1, () => 0.5), lo = createWeapon(W.Dagger, 1, () => 0.5);
  hi.value = 900; lo.value = 10;
  N.revenantCompanionUpdate(me, r.id, (c) => { c.items = [lo, hi, goldStack(40)]; });
  N.revenantBetrays(me, N.revenantById(r.id));
  assert.deepEqual(N.revenantById(r.id).took, [hi]);
  assert.ok(me.items.includes(lo));
  assert.equal(goldPiecesOf(me), 40);
});

test('RVN11c ITS STAND: turned, no return counted and no `returned` deed - it stands out, a fight counted; a plain stand as ever (mutants: the turn unread)', () => {
  const r = sworn('with');
  N.revenantBetrays(me, N.revenantById(r.id), { now: 100 });
  const x = N.revenantById(r.id);
  const returns = x.returns, fights = x.fights;
  N.applyRevenant({ mobileType: M.Orc, level: 6, health: 50, maxHealth: 50 }, x, { now: 101, turned: true });
  assert.deepEqual([x.returns, x.history.at(-1).deed, x.out, x.fights], [returns, 'betrayed', true, fights + 1]);
  N.applyRevenant({ mobileType: M.Orc, level: 6, health: 50, maxHealth: 50 }, x, { now: 102 });
  assert.deepEqual([x.returns, x.history.at(-1).deed], [returns + 1, 'returned']);
});

test('RVN11c ITS CARD: Betrayed - "Grushnak turns on you!" (mutants: the kicker; the words)', () => {
  const r = sworn('with');
  N.revenantBetrays(me, N.revenantById(r.id));
  const ev = N.revenantBetrayEvent(N.revenantById(r.id));
  assert.deepEqual([ev.kind, ev.kicker, ev.body, ev.line], ['betrayed', 'Betrayed', `${r.given} turns on you!`, `${r.given} the Betrayer turns on you!`]);
});

test('RVN11c THE HOSTS: the pools stand a turned revenant (no band, no return); the world turns it before the layer\'s frame - its card, its body lifted (no portal), the hostile stood at its feet and set on me (mutants: each seam unwired; the band stood; the portal; after the frame)', () => {
  const x = read('src/scenes/exteriorFoes.js');
  assert.match(x, /revenant = null, eliteFoe = undefined, turned = false, band = true \} = \{\}\) \{/);
  assert.match(x, /if \(revenant && !puppet\) applyRevenant\(entity, revenant, \{ turned \}\);/);
  assert.match(x, /if \(revenant && band && !puppet && !allied && entity\.revenant\) Promise\.resolve\(\)\.then\(\(\) => standBand\(/);
  const d = read('src/scenes/dungeonContext.js');
  assert.equal((d.match(/if \(e\.revenant && !puppet\) applyRevenant\(entity, e\.revenant, \{ turned: !!e\.turned \}\);/g) ?? []).length, 2, 'both builds');
  assert.match(d, /\.\.\.\(revenant \? \{ revenant, lairStand: !!lairStand, \.\.\.\(turned \? \{ turned: true \} : \{\}\) \} : \{\}\) \};/);
  const w = read('src/scenes/world.js');
  assert.match(w, /const turnIn = \(pool\) => \(r, feet, yaw\) => pool\.spawnFoe\(r\.mobileType, feet, \{ yaw, feetGiven: true, loose: true, band: false, turned: true, \.\.\.revenantSpawnOptions\(r, effectiveLevel\(playerEntity\)\) \}\);/);
  assert.equal((w.match(/turn: turnIn\((?:exteriorFoes|pool)\)/g) ?? []).length, 2, 'the street and a building');
  assert.match(w, /turn: \(r, feet, yaw\) => \{ const so = revenantSpawnOptions\(r, effectiveLevel\(playerEntity\)\); return d\.spawnLooseFoe\(r\.mobileType, feet, \{ yawRad: yaw, revenant: r, turned: true, gender: so\.gender, level: so\.level \}\); \}/, 'underground');
  assert.match(w, /if \(kind === 'betray'\) \{ _revenantArrivals\.delete\(r\.id\); _revenantBetrayals\.push\(r\); return; \}/);
  const tick = w.slice(w.indexOf('function revenantAshoreTick() {'));
  assert.ok(tick.indexOf('while (_revenantBetrayals.length) turnSworn(_revenantBetrayals.shift());') < tick.indexOf('revenantAshore.frame();'), 'before the layer\'s frame');
  const turn = w.slice(w.indexOf('function turnSworn(r) {'), w.indexOf('function revenantAshoreTick() {'));
  assert.match(turn, /revenantSay\(revenantBetrayEvent\(r, \{ playerName: playerEntity\?\.name \}\), /);   // PIN MOVED (RVN12a: its words, my name in them)
  assert.match(turn, /try \{ place\.remove\(rec\); \}/);
  assert.match(turn, /Promise\.resolve\(place\.turn\(r, feet, yaw\)\)\.then\(\(f\) => \{\n\s*if \(f\?\.ai && !f\.dead\) f\.ai\.makeHostileToPlayer\?\.\(/);
});
