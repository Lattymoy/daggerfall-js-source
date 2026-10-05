// RVN6 - THE BAND (bible/12-Enhanced-AI/Feud-Arc.md section 17; Mac, 2026-10-04: "more complex, less easy to
// accomplish and more detailed", then "Go"). From rank 2 a revenant brings its kin - RETINUE's none, 1, 2, 3, 3 by
// rank - drawn on its id and kept on its record: of its faction (orcs bring orcs, the undead their own, a beast its own
// kind), a person its class's family; a solitary kind rides alone. Stood about it in a camp member's ring, in the room
// the pool has left (followers trimmed first), ordinary (never a champion or an elite, never a revenant), transient,
// sharing its camp's infighting exemption, named for it ("Orc of Grushnak's Warband"). When it kneels, runs, dies, is
// executed or tears away, its band scatters - each runs (DFU's flee, 8 s) and is gone; said once. RVN4's rank 5, built
// with it: at its last stand its band runs to it, or two of its kin step out of a portal.
// Pinned: the law (counts, words, names, levels, the kin's pools); on the REAL street pool the band by rank, its kin,
// its ring, its marks, the cap trimming it, no band for a puppet or rank 1; the infighting exemption on the real target
// machine; the scatter on a kneel and a death, its run spent and gone, said once; rank 5's rally both ways; the hover's
// title; the candidate's refusal; the save; the page.
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
const { setPlayerDoor } = await import('../src/systems/playerDoor.js');
const { setRevenantPresenter } = await import('../src/systems/revenantVoice.js');
const { createExteriorFoes, MAX_ACTIVE_ENCOUNTER_FOES } = await import('../src/scenes/exteriorFoes.js');
const { setTacticsClock, resetTactics } = await import('../src/ai/tactics.js');
const { resetBlows } = await import('../src/ai/foeBlows.js');
const { Collider } = await import('../src/player/collider.js');
const { MOBILE_TYPES: M } = await import('../src/characters/mobileTypes.js');
const { getTargets } = await import('../src/characters/enemyTargets.js');
const { foeTitle } = await import('../src/systems/foeTitle.js');
const { setWorldMinutes } = await import('../src/systems/worldTick.js');
const { bandWords, pluralKind } = await import('../src/ui/revenantPage.js');

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const me = (id = 'char-rvn6') => ({ isPlayer: true, name: 'Ayla Stormwind', characterId: id, level: 10, reflexes: 2, stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 }, skills: new Array(40).fill(40), skillUses: new Array(40).fill(0), career: {}, activeEffects: [], items: [], health: 100, maxHealth: 100, crimeCommitted: 4 });
let shown = [];
let said = [];
let T = 0;
setTacticsClock(() => T);

beforeEach(() => {
  _resetForTests(); setPref('lootRarity', true); setPref('enhancedAI', false);
  N._resetRevenantForTests(); RC._resetRetinueForTests(); S._resetCompanionSlotsForTests(); _store.clear();
  S.registerCompanionCount('revenant', () => RC.revenantsWithYou().length);
  setPlayerDoor(null); setWorldMinutes(1440 + 120); shown = []; said = []; T = 0; resetTactics(); resetBlows();
  setRevenantPresenter((ev) => { shown.push(ev); return true; });
});

// ── the law ─────────────────────────────────────────────────────────

test('RVN6 THE LAW: RETINUE none at 1, then 1, 2, 3, 3; the scatter\'s 8 s, its ring\'s 6 m, rank 5\'s two; the band\'s word by faction and by a person\'s family - none for a solitary kind; its name from rank 2 with kin; its members the first of its kin, a monster at its kind\'s level, a person at mine - 2 (mutants: any count moved; a word moved; the floor; the levels)', () => {
  assert.deepEqual([...F.RETINUE], [0, 0, 1, 2, 3, 3]);
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, -1].map(F.retinueCount), [0, 0, 1, 2, 3, 3, 3, 0]);
  assert.equal(F.BAND_SCATTER_S, 8);
  assert.equal(F.BAND_SPACING, 6);
  assert.equal(F.RALLY_KIN, 2);
  const w = (k) => F.bandWord(M[k]);
  assert.deepEqual(['Orc', 'OrcSergeant', 'OrcShaman'].map(w), ['Warband', 'Warband', 'Warband']);
  assert.deepEqual(['Rat', 'GrizzlyBear', 'SabertoothTiger', 'Werewolf', 'Wereboar'].map(w), ['Pack', 'Pack', 'Pack', 'Pack', 'Pack']);
  assert.deepEqual(['SkeletalWarrior', 'Zombie', 'Ghost', 'Wraith', 'Vampire', 'Centaur', 'Harpy', 'Gargoyle'].map(w), ['Host', 'Host', 'Host', 'Host', 'Host', 'Host', 'Host', 'Host']);
  assert.deepEqual(['Spider', 'GiantScorpion', 'GiantBat', 'Slaughterfish'].map(w), ['Brood', 'Brood', 'Brood', 'Brood']);
  assert.deepEqual(['Warrior', 'Barbarian', 'Knight'].map(w), ['Warband', 'Warband', 'Warband']);
  assert.deepEqual(['Thief', 'Rogue', 'Burglar', 'Acrobat', 'Assassin', 'Archer', 'Ranger', 'Monk', 'Bard'].map(w), new Array(9).fill('Crew'));
  assert.deepEqual(['Mage', 'Sorcerer', 'Battlemage', 'Spellsword', 'Healer', 'Nightblade'].map(w), new Array(6).fill('Coven'));
  assert.deepEqual(['Giant', 'Lich', 'FireAtronach', 'Imp', 'Dragonling'].map(w), [null, null, null, null, null], 'a solitary kind rides alone');
  const r = { given: 'Grushnak', rank: 2, kin: [M.Orc, M.OrcShaman, M.Orc], mobileType: M.Orc };
  assert.equal(F.bandName(r), "Grushnak's Warband");
  assert.equal(F.bandName({ ...r, rank: 1 }), null, 'rank 1: none');
  assert.equal(F.bandName({ ...r, kin: [] }), null, 'no kin: none');
  assert.equal(F.bandName({ ...r, given: null }), 'Warband');
  assert.equal(F.bandName({ ...r, given: 'Varis' }), "Varis' Warband");
  assert.equal(F.bandName(null), null);
  assert.deepEqual(F.bandMembers(r, 10), [{ mobileType: M.Orc, level: null }]);
  assert.deepEqual(F.bandMembers({ ...r, rank: 4 }, 10).map((m) => m.mobileType), [M.Orc, M.OrcShaman, M.Orc]);
  assert.deepEqual(F.bandMembers({ rank: 3, kin: [M.Thief, M.Rogue, M.Burglar] }, 10), [{ mobileType: M.Thief, level: 8 }, { mobileType: M.Rogue, level: 8 }]);
  assert.deepEqual(F.bandMembers({ rank: 2, kin: [M.Thief] }, 2), [{ mobileType: M.Thief, level: 1 }], 'never under 1');
  assert.deepEqual(F.bandMembers({ rank: 5, kin: [M.Orc, M.Orc, M.Orc] }, 10, 2).length, 2, 'a count given (rank 5\'s rally)');
  assert.deepEqual(F.bandMembers(null, 10), []);
  // its kin: a faction's, a family's, its own kind's; none for a solitary kind - three drawn on its id, the same twice
  assert.deepEqual(F.kinPool(M.Orc), [M.Orc, M.OrcSergeant, M.OrcShaman]);
  assert.deepEqual(F.kinPool(M.Barbarian), [M.Warrior, M.Barbarian, M.Knight]);
  assert.deepEqual(F.kinPool(M.GrizzlyBear), [M.GrizzlyBear]);
  assert.deepEqual(F.kinPool(M.Lich), []);
  const kin = F.drawKin('rvn6-kin', M.Orc);
  assert.equal(kin.length, 3);
  assert.deepEqual(F.drawKin('rvn6-kin', M.Orc), kin);
  assert.ok(kin.every((t) => F.kinPool(M.Orc).includes(t)));
});

// ── on the real street pool ─────────────────────────────────────────

/** MONSTER.BSA with a career record for every monster kind (the pool loads each kind's). */
const careers = (() => {
  const ids = Array.from({ length: 43 }, (_, i) => i);
  const rec = () => { const b = new Uint8Array(74); const v = new DataView(b.buffer); b[10] = 0x08; v.setUint16(52, 4, true); for (let i = 0; i < 8; i++) v.setUint16(58 + i * 2, 50, true); return b; };
  const NAME_FIELD = 14, ENTRY = 18, body = 74 * ids.length;
  const out = new Uint8Array(4 + body + ENTRY * ids.length), dv = new DataView(out.buffer);
  dv.setInt16(0, ids.length, true); dv.setUint16(2, 0x0100, true);
  ids.forEach((id, k) => {
    out.set(rec(), 4 + k * 74);
    const name = `ENEMY${String(id).padStart(3, '0')}.CFG`, at = 4 + body + k * ENTRY;
    for (let i = 0; i < name.length; i++) out[at + i] = name.charCodeAt(i);
    dv.setInt32(at + NAME_FIELD, 74, true);
  });
  return out;
})();
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 20, getFrameCount: () => 5 };
let portalsOpened = 0;
function rig(p) {
  const renderer = {
    createBillboardBatch: (archive, record, size) => { if (archive === 'portal' || archive === 'PORTAL' || /portal/i.test(String(archive))) portalsOpened++; return { archive, record, size, conceal: undefined, dissolve: undefined, origin: null }; },
    destroyBillboardBatch: () => {}, destroyBatch: () => {}, textures: new Map(), uploadTexture: () => ({}), uploadEmissionTexture: () => ({}),
  };
  return createExteriorFoes({
    renderer, collider: new Collider(() => 0),
    fetchBytes: async (n) => { if (n === 'MONSTER.BSA') return careers; throw new Error(`no ${n} here`); },
    getTexture: async () => stubTex, uploadRecordFrame: () => {},
    currentMinute: () => 1000, currentPixelKey: () => '3,12', inLocation: () => true,
    playerEntity: p, audio: null, onPlayerHurt: () => {}, rolls: () => 0.5, rand: () => 0.9, say: (l) => said.push(l),
    fates: true, dropLoot: () => {}, shake: () => {},
  });
}
const frame = (pool, n = 1) => { for (let i = 0; i < n; i++) { T += 0.016; pool.update(0.016, [0, 0, 30], [0, 1.6, 30]); } };
const settle = async () => { for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0)); };
function orcRecord(p, rank) {
  const r = N.revenantDeed(p, { mobileType: M.Orc, level: 6, champion: 'mighty', health: 5, maxHealth: 50, team: 'Monster' }, 'fled', { mobileType: M.Orc, rolls: () => 0 });
  r.rank = rank;
  if (rank >= F.SIG_RANK) r.sig = F.drawSignature(r.id, r.mobileType);   // as its rank-up draws it (RVN1's pin)
  return r;
}
async function stood(p, rank, { pool = rig(p), fill = 0 } = {}) {
  for (let i = 0; i < fill; i++) await pool.spawnFoe(M.Rat, [20 + i * 2, 0, 20], { feetGiven: true });
  const r = orcRecord(p, rank);
  const f = await pool.spawnFoe(M.Orc, [4, 0, 2], { feetGiven: true, revenant: r });   // off my feet and the world's origin
  await settle();
  const band = pool.foes.filter((g) => g.retinueOf === r.id);
  return { pool, f, r, band };
}

test('RVN6 ON THE REAL STREET POOL: a rank-3 one stands with the first two of its kin - in its ring, ordinary, transient, each `retinueOf` it, in its camp, named for it; rank 2 one, rank 4 three, rank 1 none (mutants: no band; the count; the kin; the ring; a champion or an elite; saved; unmarked; no camp; unnamed)', async () => {
  const p = me();
  const { pool, f, r, band } = await stood(p, 3);
  assert.ok(f.entity.revenant);
  assert.equal(band.length, 2);
  assert.deepEqual(band.map((g) => g.mobileType).sort(), r.kin.slice(0, 2).sort(), 'its kin, in order');
  for (const g of band) {
    assert.ok(Math.hypot(g.ai.feet[0] - f.ai.feet[0], g.ai.feet[2] - f.ai.feet[2]) <= F.BAND_SPACING + 0.5, 'in its ring');
    assert.equal(g.entity.retinueOf, r.id);
    assert.equal(g.entity.campId, f.entity.campId, 'its camp');
    assert.ok(f.entity.campId != null);
    assert.equal(g.entity.bandName, `${r.given}'s Warband`.replace(/s's /, "s' "));
    assert.equal(g.entity.eliteFoe ?? false, false);
    assert.ok(!g.entity.champion, 'never a champion');
    assert.equal(g.entity.revenant ?? null, null);
    assert.equal(g.transient, true, 'no save carries it');
    assert.equal(foeTitle(g.entity, 'Orc'), `Orc of ${g.entity.bandName}`);
    assert.equal(N.revenantCandidate({ ...g.entity, champion: 'mighty' }), false, 'never a revenant, whatever it wears');
  }
  assert.equal(pool.snapshotWorld().length, 0, 'neither it nor its band in the save');
  for (const [rank, n] of [[2, 1], [4, 3], [1, 0]]) {
    N._resetRevenantForTests();
    const s = await stood(p, rank);
    assert.equal(s.band.length, n, `rank ${rank}`);
  }
});

test('RVN6 THE CAP: followers are trimmed first - the room the pool has left after its master, never past MAX_ACTIVE_ENCOUNTER_FOES; a puppet\'s stands none (mutants: the room unread; a puppet\'s band)', async () => {
  const p = me();
  assert.equal(MAX_ACTIVE_ENCOUNTER_FOES, 8);
  const { pool, band } = await stood(p, 4, { fill: 6 });
  assert.equal(band.length, 1, 'six and its master: room for one');
  assert.ok(pool.activeCount() <= MAX_ACTIVE_ENCOUNTER_FOES);
  assert.match(read('src/scenes/exteriorFoes.js'), /if \(revenant && band && !puppet && !allied && entity\.revenant\) Promise\.resolve\(\)\.then\(\(\) => standBand\(f, bandMembers\(revenant, effectiveLevel\(playerEntity\)\)\)\);/);   // PIN MOVED (RVN11c: a betrayer stands without one)
});

test('RVN6 NO INFIGHTING: on the real target machine a follower never takes its master or its bandmate (different combat teams in one band), and still takes another foe; its master likewise (mutants: no shared camp)', async () => {
  const p = me();
  const { f, band } = await stood(p, 3);
  const g = band[0];
  // candidates its senses would see (`wouldBeSpawned`), so only the chain decides; the self on another combat team, so
  // the truce of one team does not hold them - only the camp does
  const cand = (x, team = x.entity.team) => ({ entity: { ...x.entity, team }, ai: { feet: x.ai.feet, height: x.ai.height ?? 1.8, wouldBeSpawned: true, target: null, isHostile: true } });
  const asSelf = (x) => ({ entity: { ...x.entity, team: 'Undead' }, ai: x.ai, mobileType: x.mobileType });
  const take = (self, others) => getTargets(asSelf(self), others, null, { infighting: true }).target;
  const stranger = cand({ entity: { team: 'Spiders', campId: null }, ai: { feet: [3, 0, 3] } });
  assert.equal(take(g, [cand(f)]), null, 'never its master');
  assert.equal(take(g, [cand(band[1])]), null, 'never a bandmate');
  assert.equal(take(g, [stranger]), stranger, 'another foe it takes');
  assert.equal(take(f, [cand(g)]), null, 'its master never takes it');
  assert.equal(take(f, [stranger]), stranger);
});

test('RVN6 THE SCATTER: its master kneels - each follower runs from it (DFU\'s flee, 8 s), said once ("The warband scatters."), and is gone when its run is spent, no body left; a death scatters as a kneel does (mutants: no scatter; said twice; the run kept; a body)', async () => {
  const p = me();
  const { pool, f, band } = await stood(p, 2);
  assert.equal(band.length, 1);
  pool.damageFoe(f, 99999, [0, 0, 3], null, { fromPlayer: true });
  assert.ok(f.yielded, 'it kneels');
  const g = band[0];
  assert.equal(g.scattering, true);
  assert.ok(Math.abs(g.ai.fleeLeft - 8) < 1e-9);
  assert.deepEqual(g.ai.fleeFrom, [f.ai.feet[0], f.ai.feet[1], f.ai.feet[2]], 'from its master');
  assert.deepEqual(said.filter((l) => /scatters/.test(l)), ['The warband scatters.']);
  pool.damageFoe(f, 99999, [0, 0, 3], null, { fromPlayer: true });
  assert.equal(said.filter((l) => /scatters/.test(l)).length, 1, 'once');
  frame(pool, 20);
  assert.equal(g.dead ?? false, false, 'running');
  frame(pool, Math.ceil(8.2 / 0.016));
  assert.equal(g.dead, true, 'gone');
  assert.equal(g.escaped, true);
  assert.ok(!g.corpse, 'no body');
  // a death (a Disintegrate's whole - no kneel) scatters its band too
  N._resetRevenantForTests(); said = [];
  const d = await stood(p, 2);
  d.pool.damageFoe(d.f, 99999, [0, 0, 3], null, { fromPlayer: true, whole: true });
  assert.equal(d.f.dead, true);
  assert.equal(d.band[0].scattering, true);
  assert.equal(said.filter((l) => /scatters/.test(l)).length, 1);
  // one with no band says nothing of one
  N._resetRevenantForTests(); said = [];
  const lone = await stood(p, 1);
  lone.pool.damageFoe(lone.f, 99999, [0, 0, 3], null, { fromPlayer: true });
  assert.ok(lone.f.yielded);
  assert.equal(said.filter((l) => /scatters/.test(l)).length, 0, 'no band, no word');
  // every way it leaves the fight
  const s = read('src/scenes/exteriorFoes.js');
  assert.match(s, /const ev = beginYield\(playerEntity, f, \{ now: Date\.now\(\), rolls \}\);\n\s*scatterBand\(f\);/, 'it kneels');
  assert.match(s, /if \(_flee === 'start'\) scatterBand\(f\);/, 'it runs');
  assert.match(s, /if \(f\.entity\?\.revenant\) scatterBand\(f\);   \/\/ RVN6: it dies/, 'it dies');
  assert.match(s, /scatterBand\(f\);   \/\/ RVN6: executed/, 'it is executed');
  assert.match(s, /scatterBand\(f\);   \/\/ RVN6\n\s*beginTearAway\(f,/, 'it tears away');
  assert.match(s, /function escapeFoe\(f, \{ slip = false, unbroken = false \} = \{\}\) \{\n\s*scatterBand\(f\);/, 'it escapes');
});

test('RVN4 RANK 5, built with RVN6: at its last stand its band\'s survivors run to it (set on me from its feet); with none left, two of its kin step out of a portal about it (mutants: no rally; the portal\'s kin unstood; more than two; unmarked)', async () => {
  const p = me();
  const { pool, f, r, band } = await stood(p, 5);
  assert.equal(band.length, 3);
  for (const g of band) g.ai.lastKnownTargetPos = null;
  pool.damageFoe(f, 99999, [0, 0, 3], null, { fromPlayer: true });
  assert.ok(f.roaring, 'its last stand');
  for (const g of band) assert.deepEqual(g.ai.lastKnownTargetPos, [f.ai.feet[0], f.ai.feet[1], f.ai.feet[2]], 'to it');
  // none left: its kin through a portal
  N._resetRevenantForTests(); portalsOpened = 0;
  const z = await stood(p, 5);
  for (const g of z.band) { g.dead = true; }
  z.pool.damageFoe(z.f, 99999, [0, 0, 3], null, { fromPlayer: true });
  await settle();
  const fresh = z.pool.foes.filter((g) => !g.dead && g.retinueOf === z.r.id);
  assert.equal(fresh.length, F.RALLY_KIN);
  assert.deepEqual(fresh.map((g) => g.mobileType).sort(), z.r.kin.slice(0, 2).sort());
  for (const g of fresh) assert.equal(g.portalFx?.dir, 'in', 'through a portal');
  assert.ok(portalsOpened >= 2, 'its portals opened');
  assert.ok(r.kin.length >= 3);
  // the room left: one portal and one of its kin (never a portal for a stand the cap refuses)
  N._resetRevenantForTests(); portalsOpened = 0;
  const c = await stood(p, 5, { fill: 6 });
  for (const g of c.band) { g.dead = true; }
  c.pool.damageFoe(c.f, 99999, [0, 0, 3], null, { fromPlayer: true });
  await settle();
  assert.equal(c.pool.foes.filter((g) => !g.dead && g.retinueOf === c.r.id).length, 1);
  assert.equal(portalsOpened, 1, 'one portal');
  // a scatter after the portal breaks its kin too, said once more for them
  said = [];
  c.f.roaring.until -= 5000;
  frame(c.pool);   // its roar spent - blows reach it again
  c.pool.damageFoe(c.f, 99999, [0, 0, 3], null, { fromPlayer: true, whole: true });
  assert.equal(c.f.dead, true);
  assert.ok(c.pool.foes.filter((g) => g.retinueOf === c.r.id && !g.dead).every((g) => g.scattering));
  assert.equal(said.filter((l) => /scatters/.test(l)).length, 1);
});

// ── the page ────────────────────────────────────────────────────────

test('RVN6 the page: from rank 2 who rides with it, counted, and its band\'s name; none at rank 1 or for a solitary kind (mutants: shown at rank 1; the count; the name)', () => {
  const kind = (t) => ({ [M.Orc]: 'Orc', [M.OrcShaman]: 'Orc Shaman', [M.Thief]: 'Thief' })[t] ?? 'Thing';
  const r = { given: 'Grushnak', rank: 3, kin: [M.Orc, M.Orc, M.OrcShaman], mobileType: M.Orc };
  assert.equal(bandWords(r, kind), "Band: rides with two Orcs - Grushnak's Warband.");
  assert.equal(bandWords({ ...r, rank: 4 }, kind), "Band: rides with two Orcs and an Orc Shaman - Grushnak's Warband.");
  assert.equal(bandWords({ ...r, rank: 2 }, kind), "Band: rides with an Orc - Grushnak's Warband.");
  assert.equal(bandWords({ ...r, rank: 1 }, kind), '');
  assert.equal(bandWords({ ...r, mobileType: M.Giant, kin: [] }, kind), '');
  assert.equal(pluralKind('Thief', 3), 'three Thieves');
  assert.equal(pluralKind('Harpy', 2), 'two Harpies');
  assert.equal(pluralKind('Slaughterfish', 2), 'two Slaughterfish');
  assert.equal(pluralKind('Werewolf', 1), 'a Werewolf');
  assert.match(read('src/ui/revenantPage.js'), /const band = fallen \? '' : bandWords\(r, kindName\);   \/\/ RVN6\n\s*if \(band\) text\.append\(el\('span', 'rvn-will', band\)\);/);
});
