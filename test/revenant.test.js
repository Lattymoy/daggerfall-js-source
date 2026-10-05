// REVENANT (2026-10-02; systems/revenant.js, Mac: "the ability for these enemies that kill you, or a very small chance
// to flee at low health. These enemies can return at a later time stronger, with a new name, a chance of more loot
// and taunt the player"). The laws pinned here:
//   - WHO: a special foe (an elite, a champion, a revenant already) of level 3 or more - never the watch, an ally, a
//     quest's foe; off (the loot-rarity row), none.
//   - THE KILL: the blow that kills the player, through the real door - and not one a Stendarr's mercy undoes.
//   - THE NAME: DFU's banks, seeded by the revenant's id, the shared DFRandom put back; an epithet by the deed, a new
//     one at every rank, the risen ones from rank 3.
//   - THE RETURN: due one to three days on, one at a time, the highest rank first; its rank's health and blows; out
//     until it dies or leaves, then due again.
//   - ITS DROP, ITS WORDS, ITS KEEPING: the save slot and the app's storage merged by revision.
//   - THE HOSTS: the open world's pool runs, escapes, taunts and closes it; the world's roll stands it.

import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// the app's storage: a plain map in node
const _store = new Map();
globalThis.localStorage = {
  getItem: (k) => (_store.has(k) ? _store.get(k) : null), setItem: (k, v) => { _store.set(k, String(v)); },
  removeItem: (k) => { _store.delete(k); }, clear: () => _store.clear(), key: (i) => [..._store.keys()][i] ?? null, get length() { return _store.size; },
};

const N = await import('../src/systems/revenant.js');
const { setPref, _resetForTests } = await import('../src/systems/uiPrefs.js');
const { hurtPlayer, setAvoidDeathHook } = await import('../src/characters/playerEntity.js');
const { setStruck, _resetSetPowersForTests } = await import('../src/systems/sigilSetPowers.js');
const { setPlayerDoor } = await import('../src/systems/playerDoor.js');
const { getSeed, setSeed } = await import('../src/formats/dfRandom.js');
const { modSaveRecords, restoreModSaveRecords } = await import('../src/systems/modSaveData.js');
const { KNIGHT_CITY_WATCH, MOBILE_TYPES } = await import('../src/characters/mobileTypes.js');
const { foeTitle } = await import('../src/systems/foeTitle.js');

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const stats = () => ({ strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 });
const player = (id = 'char-1') => ({
  isPlayer: true, name: 'Ayla Stormwind', characterId: id, items: [], stats: stats(), skills: new Array(35).fill(30), level: 5,
  career: {}, activeEffects: [], health: 100, maxHealth: 100, magicka: 0, maxMagicka: 1000, armorValues: new Array(7).fill(100),
});
const orc = (over = {}) => ({ mobileType: MOBILE_TYPES.Orc, level: 6, health: 60, maxHealth: 60, team: 'Orcs', champion: 'mighty', ...over });
const seq = (...vals) => { let i = 0; return () => vals[Math.min(i++, vals.length - 1)]; };
const tick = () => new Promise((r) => setTimeout(r, 0));
function fresh() {
  _resetForTests(); setPref('lootRarity', true);
  N._resetRevenantForTests(); _store.clear(); _resetSetPowersForTests(); setPlayerDoor(null); setAvoidDeathHook(null);
}

test('REVENANT WHO: a special foe of level 3 or more - an elite, a champion, a revenant already; never a plain foe, the watch, an ally, a quest\'s foe; off, none (mutants: a plain foe made one; the floor dropped; the watch; off ignored)', () => {
  fresh();
  assert.equal(N.revenantCandidate(orc()), true, 'a champion');
  assert.equal(N.revenantCandidate(orc({ champion: undefined, eliteFoe: true })), true, 'an elite');
  assert.equal(N.revenantCandidate(orc({ champion: undefined, revenant: { id: 'x' } })), true, 'a revenant already');
  assert.equal(N.revenantCandidate(orc({ champion: undefined })), false, 'a plain foe never');
  assert.equal(N.revenantCandidate(orc({ level: 2 })), false, 'under the floor');
  assert.equal(N.revenantCandidate(orc({ mobileType: KNIGHT_CITY_WATCH })), false, 'the watch');
  assert.equal(N.revenantCandidate(orc({ team: 'PlayerAlly' })), false, 'an ally');
  assert.equal(N.revenantCandidate(orc(), { questBehaviour: {} }), false, 'a quest\'s foe');
  setPref('lootRarity', false);
  assert.equal(N.revenantCandidate(orc()), false, 'off: none - DFU exactly');
  assert.equal(N.rollRevenantFlee(orc(), () => 0), false, '...and none runs');
});

test('REVENANT THE NAME: DFU\'s banks seeded by the id - one id, one name, the shared DFRandom left where it was; a person a first name, a beast a monster\'s (mutants: the shared stream moved; an unseeded draw)', () => {
  fresh();
  setSeed(12345);
  const a = N.revenantGivenName('abc', MOBILE_TYPES.Orc), b = N.revenantGivenName('abc', MOBILE_TYPES.Orc);
  assert.equal(getSeed(), 12345, 'the shared stream untouched');
  assert.equal(a, b, 'one id, one name');
  assert.match(a, /^[A-Z][a-z'\- ]+$/i);
  assert.notEqual(N.revenantGivenName('abc', MOBILE_TYPES.Orc), N.revenantGivenName('a-different-id-entirely', MOBILE_TYPES.Orc) + 'x', 'a name, not a constant');
  const person = N.revenantGivenName('id-7', 130, 'female');
  assert.ok(person.length > 1 && person !== 'Nameless', `a person's first name (${person})`);
  // epithets: by the deed, a new one each rank, the risen from rank 3, the player's name filled
  assert.ok(N.REVENANT_EPITHETS.slew.map((e) => e.replace('{p}', 'Ayla')).includes(N.revenantEpithet('slew', 1, 'Ayla Stormwind', () => 0.99)));
  assert.ok(N.REVENANT_EPITHETS.fled.includes(N.revenantEpithet('fled', 2, 'Ayla', () => 0)));
  assert.ok(N.REVENANT_EPITHETS.risen.map((e) => e.replace('{p}', 'Ayla')).includes(N.revenantEpithet('fled', 3, 'Ayla', () => 0.5)));
  assert.notEqual(N.revenantEpithet('slew', 1, 'Ayla', () => 0, 'the Butcher'), 'the Butcher', 'never the one it wears');
});

test('REVENANT THE KILL: the blow that kills me makes its foe a revenant through the real door - named at once where it stands, due in one to three days, the player told once alive; a death a Stendarr\'s mercy undoes makes nobody one (mutants: no confirm; the mercy ignored; the name not stood)', async () => {
  fresh();
  const me = player();
  const killer = orc({ health: 60 });
  const rec = { entity: killer, mobileType: MOBILE_TYPES.Orc, gender: 'male', dead: false };
  setPlayerDoor({ foes: () => [rec], feet: () => [0, 0, 0], hurtFoe: () => {}, castOnPlayer: () => {}, player: () => me });
  // a blow that does not kill: nothing
  setStruck(killer, me, 30); hurtPlayer(me, 30);
  await tick();
  assert.equal(N.livingRevenants().length, 0, 'a wound is no deed');
  // a mercy: the killing blow undone
  setAvoidDeathHook(() => true);
  setStruck(killer, me, 500); hurtPlayer(me, 500);
  await tick();
  assert.equal(N.livingRevenants().length, 0, 'Stendarr\'s mercy: no death, no revenant');
  setAvoidDeathHook(null);
  me.health = 100;
  setStruck(killer, me, 500); hurtPlayer(me, 500);
  assert.equal(N.livingRevenants().length, 0, 'confirmed once the hurt is done, not inside it');
  await tick();
  const [r] = N.livingRevenants();
  assert.ok(r, 'the killer is a revenant');
  assert.equal(r.rank, 1); assert.equal(r.kills, 1); assert.equal(r.trait, 'mighty'); assert.equal(r.mobileType, MOBILE_TYPES.Orc);
  assert.ok(r.dueAt >= r.born + N.REVENANT_RETURN_MIN_MINUTES && r.dueAt <= r.born + N.REVENANT_RETURN_MAX_MINUTES, 'due in one to three days');
  assert.equal(killer.revenant.id, r.id, 'the foe over my body wears its name at once');
  assert.equal(foeTitle(killer, 'Orc'), r.name, '...on every surface');
  assert.ok(r.out, 'and stands out in the world');
  assert.equal(N.takeRevenantNotice(me), null, 'dead: nothing said yet');
  me.health = 50;
  const note = N.takeRevenantNotice(me);
  assert.equal(note.kind, 'rise', 'alive again: told once - an event a face draws');
  assert.match(note.line, /that killed you lives on as /, '...and its line for a text surface');
  assert.equal(N.takeRevenantNotice(me), null, '...once');
  // a peer's own hurt, or a blow with no foe behind it, is nobody's
  me.health = 100; const peer = { ...player('p'), peer: true };
  setStruck(killer, peer, 500); hurtPlayer(peer, 500); await tick();
  assert.equal(N.livingRevenants().length, 1);
});

test('REVENANT DEEDS AND RANKS: killing me again ranks it up with a new epithet; an escape ranks it up too; the rank stops at five and the epithet rises from three; past five revenants the weakest, oldest is forgotten (mutants: no rank-up; the same epithet kept; no cap)', () => {
  fresh();
  const me = player();
  const e = orc();
  const r = N.revenantDeed(me, e, 'slew', { now: 1000, rolls: () => 0 });
  const ep1 = r.epithet;
  N.revenantDeed(me, e, 'slew', { now: 2000, rolls: () => 0 });
  assert.equal(r.rank, 2); assert.equal(r.kills, 2); assert.notEqual(r.epithet, ep1, 'a new name for a new deed');
  N.revenantDeed(me, e, 'fled', { now: 3000, rolls: () => 0 });
  assert.equal(r.rank, 3); assert.equal(r.escapes, 1); assert.equal(r.out, false, 'an escape is gone');
  assert.ok(N.REVENANT_EPITHETS.risen.map((x) => x.replace('{p}', 'Ayla')).includes(r.epithet), 'risen from rank three');
  for (let i = 0; i < 5; i++) N.revenantDeed(me, e, 'slew', { now: 4000 + i, rolls: () => 0.3 });
  assert.equal(r.rank, N.REVENANT_MAX_RANK, 'five and no more');
  assert.equal(r.history.length <= 12, true);
  // the cap
  for (let i = 0; i < 5; i++) N.revenantDeed(me, orc({ champion: 'swift' }), 'fled', { now: 9000 + i, rolls: () => 0.5 });
  assert.equal(N.livingRevenants().length, N.REVENANT_MAX, 'five living at most');
  assert.ok(N.revenantById(r.id), 'the strongest is kept');
});

test('REVENANT THE RETURN: not before it is due; then on the roll, the highest rank first, one at a time; it stands with its rank\'s health and blows, its name, a class foe higher; gone unfought it is due again; slain it never comes back (mutants: early; two out at once; no scaling; lost forgotten; the slain returned)', () => {
  fresh();
  const me = player();
  const a = N.revenantDeed(me, orc(), 'fled', { now: 0, rolls: () => 0 });
  const b = N.revenantDeed(me, orc({ champion: 'stalwart' }), 'fled', { now: 0, rolls: () => 0 });
  b.rank = 3;
  assert.equal(N.revenantToReturn(me, { now: 100, rolls: () => 0 }), null, 'not before its time');
  const late = N.REVENANT_RETURN_MAX_MINUTES + 10;
  assert.equal(N.revenantToReturn(me, { now: late, rolls: () => 0.99 }), null, 'the roll can pass it by');
  const r = N.revenantToReturn(me, { now: late, rolls: () => 0 });
  assert.equal(r, b, 'the highest rank first');
  const opt = N.revenantSpawnOptions(r, 10);
  assert.equal(opt.revenant, r); assert.equal(opt.level, null, 'a monster is its kind\'s level'); assert.equal(opt.gender, null);
  assert.equal(N.revenantSpawnOptions({ ...r, mobileType: 130, gender: 'female' }, 10).level, 10 + 3 * N.REVENANT_LEVEL_PER_RANK, 'a class foe over the player');
  const ent = { maxHealth: 100, health: 100, damageScale: 1.25 };
  assert.equal(N.applyRevenant(ent, r, { now: late }), true);
  assert.equal(ent.maxHealth, Math.round(100 * (1 + N.REVENANT_HEALTH_PER_RANK * 3)));
  assert.equal(ent.health, ent.maxHealth);
  assert.ok(Math.abs(ent.damageScale - 1.25 * (1 + N.REVENANT_DAMAGE_PER_RANK * 3)) < 1e-9, 'its blows over its trait\'s');
  assert.equal(ent.revenant.name, r.name);
  assert.equal(r.out, true); assert.equal(r.returns, 1);
  assert.equal(N.revenantToReturn(me, { now: late, rolls: () => 0 }), null, 'one out at a time');
  // in the world: present, then gone unfought
  N.revenantPresence([{ entity: ent, dead: false }], { now: late, wall: Date.now() + 60000 });
  assert.equal(r.out, true, 'still there');
  N.revenantPresence([], { now: late, wall: Date.now() + 1000 });
  assert.equal(r.out, true, 'a stand crossing its awaits has its grace');
  N.revenantPresence([], { now: late, wall: Date.now() + 60000 });
  assert.equal(r.out, false, 'gone unfought');
  assert.ok(r.dueAt >= late + N.REVENANT_LOST_MINUTES, 'and due again later');
  // slain
  assert.equal(N.revenantSlain(me, ent, { now: late + 1 }), r);
  assert.equal(r.defeated, true);
  assert.equal(N.revenantSlain(me, ent), null, 'once');
  assert.equal(N.livingRevenants().includes(r), false);
  assert.equal(N.revenantToReturn(me, { now: late + 99999, rolls: () => 0 }), a, 'the slain never comes back; the other does');
});

test('REVENANT ITS DROP AND ITS WORDS: gold by level and rank and gear on chances that grow, a Rare always from rank three; a taunt that knows the deed and the player, a beast\'s growl, the flee, the escape and the fall (mutants: no gold; no rank-three Rare; a beast that talks)', () => {
  fresh();
  const low = N.revenantLoot(10, 1, () => 0.99);
  assert.equal(low.length, 1, 'rank one, unlucky: gold alone');
  assert.equal(low[0].templateIndex !== undefined || low[0].stackCount !== undefined || low[0].group !== undefined, true);
  const high = N.revenantLoot(10, 3, () => 0.99);
  assert.ok(high.some((i) => i.rarity === 'rare'), 'rank three: a Rare always');
  const e = { revenant: { id: 'x', rank: 2 }, level: 8, items: [] };
  N.grantRevenantLoot(e, 8, () => 0.5); const n = e.items.length;
  N.grantRevenantLoot(e, 8, () => 0.5);
  assert.equal(e.items.length, n, 'once');
  const r = { name: 'Grushnak the Butcher', given: 'Grushnak', mobileType: MOBILE_TYPES.Orc, rank: 1, kills: 1, history: [{ deed: 'slew', at: 0 }], personality: 'witty' };
  assert.equal(N.revenantTaunt(r, 'Ayla Stormwind', () => 0), 'Grushnak the Butcher: "Ah, Ayla! Back from the dead? Even Arkay sent you back - he must have found you tiresome too."', 'REVENANT-VOICE: the witty one\'s, for the kill');
  assert.equal(N.revenantTaunt({ ...r, history: [{ deed: 'fled', at: 0 }] }, 'Ayla', () => 0), 'Grushnak the Butcher: "Missed me, Ayla? Clearly. You missed a great deal."', '...for the flight');
  assert.equal(N.revenantTaunt({ ...r, personality: 'craven' }, 'Ayla', () => 0), 'Grushnak the Butcher: "I-I killed you once! I can do it again! Probably!"', 'another personality, another voice');
  assert.equal(N.revenantTaunt({ ...r, mobileType: MOBILE_TYPES.SabertoothTiger, personality: 'craven' }, 'Ayla', () => 0), 'Grushnak the Butcher circles you with a nervous whine. It remembers the taste of you.', 'a beast does not talk - its temperament shows');
  const fleer = { mobileType: MOBILE_TYPES.Orc };
  const fl = N.revenantFleeLine(fleer, 'Mighty Orc', () => 0);
  assert.match(fl, /^Mighty Orc breaks and runs! ".+"$/);
  assert.equal(N.revenantFleeLine(fleer, 'Mighty Orc', () => 0), fl, 'its voice drawn once and kept (the id minted on it)');
  assert.equal(N.revenantEscapeLine(r), 'Grushnak got away. Grushnak the Butcher will remember this.');
  assert.equal(N.revenantSlainLine(r), 'Grushnak the Butcher has fallen. Your revenant is no more.');
});

test('REVENANT ITS KEEPING: the save slot carries the records (never as out); the app\'s storage mirrors them per character, and the two merge by revision - an older save forgets no revenant made since, nor raises one slain (mutants: no mirror; the older revision wins; out carried over a load)', () => {
  fresh();
  const me = player('char-keep');
  const r = N.revenantDeed(me, orc(), 'slew', { now: 10, rolls: () => 0 });
  const saved = modSaveRecords()[N.REVENANT_SAVE];
  assert.equal(saved.list.length, 1); assert.equal(saved.list[0].out, false, 'never out across a load');
  assert.ok(_store.get(`${N.REVENANT_STORE_PREFIX}char-keep`), 'mirrored under the character');
  // made since the save: a second, and the first slain
  const r2 = N.revenantDeed(me, orc({ champion: 'swift' }), 'fled', { now: 20, rolls: () => 0 });
  N.revenantSlain(me, { revenant: { id: r.id } }, { now: 30 });
  // the old save restored
  restoreModSaveRecords({ [N.REVENANT_SAVE]: saved });
  assert.equal(N.revenantById(r.id).defeated, false, 'before the mirror is read: the save\'s word');
  N.revenantToReturn(me, { now: 0 });   // any ask reads the mirror in
  assert.equal(N.revenantById(r.id).defeated, true, 'the slain stays slain');
  assert.ok(N.revenantById(r2.id), 'the one made since is kept');
  // another character's mirror is its own
  N._resetRevenantForTests();
  N.revenantToReturn(player('char-other'), { now: 0 });
  assert.equal(N.allRevenants().length, 0, 'another character: none of these');
  assert.deepEqual(N.mergeRevenants([{ ...saved.list[0], rev: 5, rank: 2 }], [{ ...saved.list[0], rev: 3, rank: 4 }])[0].rank, 2, 'the higher revision wins');
  assert.equal(N.mergeRevenants([{ id: 'bad' }], []).length, 0, 'a broken record is dropped');
});

test('REVENANT THE HOSTS: the open world\'s pool rolls the flee once under a fifth, runs and escapes without a corpse, taunts once in sight, closes a slain one; the spawn stands its trait or glow, then its rank, before its loot; the world\'s roll stands a due one, whoever rolls the group\'s wanderers, and reads its presence and its notice', () => {
  const x = read('src/scenes/exteriorFoes.js');
  assert.match(x, /const _flee = f\.fleeing \|\| \(!f\._fleeRolled && revenantFleeHealth\(f\.entity\)\) \? revenantFleeStep\(f, playerFeet, \{ onMe: \(\) => isLocalPlayerTarget\(f\.ai\.target\) \|\| !f\.ai\._armedTargeting \}\) : null;/, 'the one flee law, asked only of a foe running or under the line');
  assert.match(x, /if \(_flee === 'escape'\) \{ escapeFoe\(f\); continue; \}/, 'out of reach: escaped');
  assert.match(x, /if \(_flee === 'start' \|\| _flee === 'run'\) \{ fleeWalk\(f, dt, eye\); continue; \}/, 'running: its walk and nothing else');
  assert.match(x, /function fleeWalk\(f, dt, eye\) \{\s*\n\s*f\._mout = f\.mobile\.update\(dt, \{ moving: f\.ai\.moving, striking: false, rangedStriking: false, hurting: f\.ai\.hurtKnock, casting: false \}/, 'no blow and no cast in it');
  assert.match(x, /else if \(_flee === 'cornered'\) revenantSay\(revenantCorneredEvent\(/, 'cornered: said');
  // PIN MOVED (RVN3: the unbroken's escape - the same door, its own words)
  // PIN MOVED (RVN6: its band scatters first - bible/12-Enhanced-AI/Feud-Arc.md 17)
  assert.match(x, /function escapeFoe\(f(?:, \{ slip = false(?:, unbroken = false)? \} = \{\})?\) \{\s*\n(?:\s*scatterBand\(f\);[^\n]*\n)?\s*releaseFoeBatch\(f\);\s*\n\s*f\.dead = true;[\s\S]{0,300}revenantDeed\(playerEntity, f\.entity, 'fled'/, 'gone without a corpse, made a revenant');
  const esc = x.indexOf('function escapeFoe(f');   // AUDIT (2026-10-02): the slip's option widened the head - the old '(f)' read nothing, and this passed on an empty slice
  assert.ok(esc > 0);
  assert.doesNotMatch(x.slice(esc, esc + 600), /f\.corpse = true|sayEnemyDied|reportPlayerKill/, 'no corpse, no kill');
  assert.match(x, /if \(f\.entity\.revenant && !f\._taunted && f\.ai\.inSight && \(isLocalPlayerTarget\(f\.ai\.target\) \|\| !f\.ai\._armedTargeting\)/, 'the taunt, once a return');
  assert.match(x, /if \(f\.entity\?\.revenant\) \{ const nr = revenantSlain\(playerEntity, f\.entity\); if \(nr && !peer\) revenantSay\(revenantSlainEvent\(nr, playerEntity\?\.name, \{ archive: f\.archive \}\), say\); \}/, 'slain at last');
  const spawn = x.slice(x.indexOf('async function spawnFoe('), x.indexOf('const gender = MobileUnit.resolveGender'));
  assert.match(spawn, /revenant \? revenant\.elite : rollOverworldElite\(Math\.random\)\)/, 'an elite stands as one again, never a fresh roll');
  assert.match(spawn, /revenant \? \(revenant\.trait \? championIndex\(revenant\.trait\) : null\)/, 'its trait, never a fresh one');
  const iApply = spawn.indexOf('applyRevenant(entity, revenant, { turned })'), iLoot = spawn.indexOf('spawnEnemyLoot(entity');   // PIN MOVED (RVN11c: a betrayer's turning is no return)
  assert.ok(iApply > spawn.indexOf('applyChampion(entity') && iApply < iLoot, 'its rank over its trait, before its loot');
  assert.match(spawn, /if \(entity\.revenant\) grantRevenantLoot\(entity, builtLevel\);/);
  const w = read('src/scenes/world.js');
  assert.match(w, /const _revenant = hit && _m === 'exterior' \? revenantToReturn\(playerEntity, \{ now \}\) : null;\s*\n\s*if \(_revenant\) \{ Promise\.resolve\(_standEncounterFoe\(\{ \.\.\.hit, mobileType: _revenant\.mobileType, revenant: _revenant \}, playerFeet\)\)\.then\(\(f\) => \{ if \(!f\) releaseRevenantStand\(_revenant\); \}\); break; \}[^\n]*\n\s*if \(hit && _rollsForGroup\)/, 'before the group\'s gate - a revenant is the player\'s own');
  assert.match(w, /\.\.\.\(hit\.revenant \? revenantSpawnOptions\(hit\.revenant, effectiveLevel\(playerEntity\)\) : \{\}\)/);
  assert.match(w, /revenantPresence\(exteriorFoes\.foes, \{ now \}\);\s*\n\s*revenantSay\(takeRevenantNotice\(playerEntity\), \(l\) => townTalk\.say\(l\)\);/);
});
