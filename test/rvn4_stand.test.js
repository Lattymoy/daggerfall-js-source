// RVN4 - THE LAST STAND (bible/12-Enhanced-AI/Feud-Arc.md section 15; Mac, 2026-10-04: "more complex, less easy to
// accomplish and more detailed", then "Go"). From rank 3, once a stand, the blow that would kneel or kill a revenant
// brings it back instead - to 30%, 35% or 40% of its health by rank (FEUD BALANCE, OPEN 23; RVN4 built 35/45/55) - ROARING: for 1.2 s no blow reaches it, and (the
// Enhanced AI switch on) an iron ring about its feet lands as the roar ends; switch off, its motor is held and its swing
// raised. Then PHASE TWO for the rest of the stand: blows x1.2, +20 Speed, wind-ups x0.85, cooldowns x0.7, chains to
// three, iron one in two, an ember rim, stood a tenth larger. Its deed is written, its card shown. A kill is a kill.
// Pinned: the law; on the REAL street pool the stand (its health by rank, the roar's refusal, phase two's blows and
// Speed, the deed, the card), once a stand, never at rank 2, never against a Disintegrate; the roar both ways (the real
// brain's iron ring; the motor's hold and the raised swing let go); the brain's table and the motor; the pools' rim and
// size, every refusal and the dungeon's seam by source; the page.
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
const { setRevenantPresenter } = await import('../src/systems/revenantVoice.js');
const { createExteriorFoes } = await import('../src/scenes/exteriorFoes.js');
const { TELL, windupSeconds, blowCooldown, blowGuard, chainMax } = await import('../src/ai/tells.js');
const { setTacticsClock, resetTactics } = await import('../src/ai/tactics.js');
const { liveBlows, resetBlows } = await import('../src/ai/foeBlows.js');
const { Collider } = await import('../src/player/collider.js');
const { EnemyAI } = await import('../src/characters/enemyMotor.js');
const { setWorldMinutes } = await import('../src/systems/worldTick.js');
const { lastStandWords } = await import('../src/ui/revenantPage.js');

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const me = (id = 'char-rvn4') => ({ isPlayer: true, name: 'Ayla Stormwind', characterId: id, level: 10, reflexes: 2, stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 }, skills: new Array(40).fill(40), skillUses: new Array(40).fill(0), career: {}, activeEffects: [], items: [], health: 100, maxHealth: 100, crimeCommitted: 4 });
let shown = [];
let T = 0;
setTacticsClock(() => T);

beforeEach(() => {
  _resetForTests(); setPref('lootRarity', true); setPref('enhancedAI', false);
  N._resetRevenantForTests(); RC._resetRetinueForTests(); S._resetCompanionSlotsForTests(); _store.clear();
  S.registerCompanionCount('revenant', () => RC.revenantsWithYou().length);
  setPlayerDoor(null); setWorldMinutes(1440 + 120); shown = []; T = 0; resetTactics(); resetBlows();
  setRevenantPresenter((ev) => { shown.push(ev); return true; });
});

const careers = (() => {
  const b = new Uint8Array(74); const v = new DataView(b.buffer);
  b[10] = 0x08; v.setUint16(52, 4, true);
  for (let i = 0; i < 8; i++) v.setUint16(58 + i * 2, 50, true);
  const NAME_FIELD = 14, ENTRY = 18, out = new Uint8Array(4 + b.length + ENTRY), dv = new DataView(out.buffer);
  dv.setInt16(0, 1, true); dv.setUint16(2, 0x0100, true); out.set(b, 4);
  const name = 'ENEMY002.CFG';
  for (let i = 0; i < name.length; i++) out[4 + b.length + i] = name.charCodeAt(i);
  dv.setInt32(4 + b.length + NAME_FIELD, b.length, true);
  return out;
})();
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 20, getFrameCount: () => 5 };
function rig(p) {
  const renderer = {
    createBillboardBatch: (archive, record, size) => ({ archive, record, size, conceal: undefined, dissolve: undefined, origin: null }),
    destroyBillboardBatch: () => {}, destroyBatch: () => {}, textures: new Map(), uploadTexture: () => ({}), uploadEmissionTexture: () => ({}),
  };
  return createExteriorFoes({
    renderer, collider: new Collider(() => 0),   // a real, empty collider: the foes walk and the brain thinks
    fetchBytes: async (n) => { if (n === 'MONSTER.BSA') return careers; throw new Error(`no ${n} here`); },
    getTexture: async () => stubTex, uploadRecordFrame: () => {},
    currentMinute: () => 1000, currentPixelKey: () => '3,12', inLocation: () => true,
    playerEntity: p, audio: null, onPlayerHurt: () => {}, rolls: () => 0.5, rand: () => 0.9, say: () => {},
    fates: true, dropLoot: () => {}, shake: () => {},
  });
}
const frame = (pool) => { T += 0.016; pool.update(0.016, [0, 0, 3], [0, 1.6, 3]); };
function revenantOf(p, rank) {
  const r = N.revenantDeed(p, { mobileType: 2, level: 6, champion: 'mighty', health: 5, maxHealth: 50, team: 'Monster' }, 'fled', { mobileType: 2, rolls: () => 0 });
  r.rank = rank;
  return r;
}
async function stood(p, rank, at = [0, 0, 0], pool = rig(p)) {
  const r = revenantOf(p, rank);
  const f = await pool.spawnFoe(2, at, { feetGiven: true, level: 6, revenant: r });
  frame(pool);
  return { pool, f, r };
}

// ── the law ─────────────────────────────────────────────────────────

test('RVN4 THE LAW: from rank 3; its health 30/35/40% by rank (FEUD BALANCE), none under; the roar 1.2 s; phase two\'s numbers whole, frozen; its rim and size only in phase two (mutants: any number moved; the rank floor moved)', () => {
  assert.equal(F.LAST_STAND_RANK, 3);
  // PIN MOVED (FEUD BALANCE, Feud-Arc.md OPEN 23 - Mac: 30 / 35 / 40%, so a rank 5 is about 2.5 times a rank 1's fight)
  assert.deepEqual([1, 2, 3, 4, 5].map(F.lastStandHealth), [0, 0, 0.3, 0.35, 0.4]);
  assert.equal(F.LAST_STAND_ROAR, 1.2);
  assert.deepEqual({ ...F.PHASE_TWO, GLINT: [...F.PHASE_TWO.GLINT] }, { BLOWS: 1.2, SPEED: 20, WINDUP: 0.85, COOLDOWN: 0.7, CHAIN_MAX: 2, IRON: 0.5, SIZE: 1.1, GLINT: [1.0, 0.36, 0.12, 0.5] });
  const p2 = F.phaseTwo();
  assert.ok(Object.isFrozen(p2));
  assert.deepEqual({ ...p2 }, { windup: 0.85, cooldown: 0.7, chainMax: 2, iron: 0.5, size: 1.1 });
  assert.equal(F.lastStandGlint({ revenant: { p2 } }), F.PHASE_TWO.GLINT);
  assert.equal(F.lastStandGlint({ revenant: {} }), null);
  assert.equal(F.lastStandSize({ revenant: { p2 } }), 1.1);
  assert.equal(F.lastStandSize({}), 1);
});

// ── on the real pool ────────────────────────────────────────────────

test('RVN4 THE STAND on the REAL street pool: the killing blow brings a rank-3 one back to 30% - ROARING, no blow reaching it - then phase two (blows x1.2, +20 Speed), its deed and its card; once a stand: the next killing blow is the will\'s (mutants: it dies or kneels; the health moved; the roar touchable; phase two unstood; the deed unwritten; twice a stand)', async () => {
  const p = me();
  const { pool, f, r } = await stood(p, 3);
  const scale = f.entity.damageScale ?? 1, speed = f.entity.stats.speed, max = f.entity.maxHealth;
  pool.damageFoe(f, 99999, [0, 0, 3], null, { fromPlayer: true });
  assert.equal(f.dead, false);
  assert.equal(f.yielded, undefined, 'no kneel');
  assert.equal(f.leaving, undefined, 'no tear-away');
  assert.equal(f.entity.health, Math.round(max * 0.3));   // PIN MOVED (FEUD BALANCE, OPEN 23)
  assert.ok(f.roaring, 'roaring');
  pool.damageFoe(f, 99999, [0, 0, 3], null, { fromPlayer: true });
  assert.equal(f.entity.health, Math.round(max * 0.3), 'no blow reaches it while it roars');   // PIN MOVED (FEUD BALANCE, OPEN 23)
  assert.deepEqual({ ...f.entity.revenant.p2 }, { ...F.phaseTwo() }, 'phase two stood');
  assert.ok(Math.abs(f.entity.damageScale - scale * 1.2) < 1e-9);
  assert.equal(f.entity.stats.speed, speed + 20);
  assert.equal(N.revenantById(r.id).history.at(-1).deed, 'laststand');
  const ev = shown.find((e) => e.kind === 'laststand');
  assert.ok(ev);
  assert.equal(ev.kicker, 'Last stand');
  assert.equal(ev.body, `${r.given} rises again - its last stand.`);
  // the roar spent: blows land; the next killing blow is the will's (unbroken - it tears away), never a second stand
  f.roaring.until -= 5000;
  frame(pool);
  assert.equal(f.roaring, null, 'the roar spent');
  pool.damageFoe(f, 99999, [0, 0, 3], null, { fromPlayer: true });
  assert.ok(f.leaving, 'once a stand: the will asks now');
  assert.equal(N.revenantById(r.id).history.filter((d) => d.deed === 'laststand').length, 1);
});

test('RVN4 BY RANK: 35% at rank 4, 40% at rank 5 (FEUD BALANCE); at rank 2 it kneels; a Disintegrate kills (mutants: the rank\'s share moved; a rank-2 stand; the whole kill stood up)', async () => {
  const p = me();
  for (const [rank, share] of [[4, 0.35], [5, 0.4]]) {   // PIN MOVED (FEUD BALANCE, OPEN 23)
    const { pool, f } = await stood(p, rank);
    pool.damageFoe(f, 99999, [0, 0, 3], null, { fromPlayer: true });
    assert.equal(f.entity.health, Math.round(f.entity.maxHealth * share), `rank ${rank}`);
  }
  const two = await stood(p, 2);
  two.pool.damageFoe(two.f, 99999, [0, 0, 3], null, { fromPlayer: true });
  assert.ok(two.f.yielded, 'rank 2 kneels');
  assert.equal(two.f.roaring, undefined);
  const z = await stood(p, 3);
  z.pool.damageFoe(z.f, 99999, [0, 0, 3], null, { fromPlayer: true, whole: true });
  assert.equal(z.f.roaring, undefined);
  assert.equal(N.revenantById(z.r.id).defeated, true, 'a kill is a kill');
});

test('RVN4 THE ROAR, switch off: its motor held for the roar on the brain\'s clock and its swing raised - let go (striking nothing) when the roar is spent (mutants: no hold; the swing kept raised)', async () => {
  const p = me();
  const { pool, f } = await stood(p, 3);
  pool.damageFoe(f, 99999, [0, 0, 3], null, { fromPlayer: true });
  assert.ok(Math.abs(f.ai.roarUntil - (T + 1.2)) < 1e-9, 'held on the brain\'s clock');
  assert.equal(f.ai._blowHold, true, 'its swing raised');
  f.roaring.until -= 5000;
  frame(pool);
  assert.equal(f.ai._blowHold, 'cancel', 'let go when the roar is spent');
  // the motor itself: a roar's hold is a lock as a stagger's is
  const ent = { health: 100, maxHealth: 100, mobileType: 7, level: 12 };
  const ai = new EnemyAI(new Collider(() => 0), [0, 0, 5], Math.PI, { vitals: () => ent, liveSpeed: () => 50 });
  for (let i = 0; i < 30; i++) { T += 1 / 60; ai.update(1 / 60, [0, 0, 0]); }
  assert.equal(ai.canAct, true, 'free before');
  ai.roarUntil = T + 1;
  T += 1 / 60; ai.update(1 / 60, [0, 0, 0]);
  assert.equal(ai.canAct, false, 'held through the roar');
  T += 2;
  ai.update(1 / 60, [0, 0, 0]);
  assert.equal(ai.canAct, true, 'and let go after');
});

test('RVN4 THE ROAR, switch on: the REAL brain winds an iron ring about its feet for the roar - landing as it ends - and the motor is not held (mutants: no ring; not iron; the roar\'s length moved; held besides)', async () => {
  setPref('enhancedAI', true);
  const p = me();
  const { pool, f } = await stood(p, 3);
  for (let i = 0; i < 5; i++) frame(pool);
  assert.ok(f.ai._tac, 'its brain is thinking');
  pool.damageFoe(f, 99999, [0, 0, 3], null, { fromPlayer: true });
  const b = liveBlows().get(f.ai);
  assert.ok(b, 'a blow wound');
  assert.equal(b.kind, 'ring');
  assert.equal(b.guard, 'iron');
  assert.equal(b.roar, true);
  assert.ok(Math.abs((b.land - b.start) - 1.2) < 1e-9, 'its wind-up the roar');
  assert.deepEqual(b.origin, [f.ai.feet[0], b.origin[1], f.ai.feet[2]], 'about its feet');
  assert.equal(f.ai.roarUntil ?? 0, 0, 'the wind-up stands it - no motor hold');
  assert.equal(f.ai._tac.state, 'windup');
});

// ── the brain's table ───────────────────────────────────────────────

test('RVN4 PHASE TWO in the brain\'s table: wind-ups x0.85, cooldowns x0.7, iron one in two, chains to three; none without it (mutants: any unread)', () => {
  const p2 = { revenant: { rank: 0, p2: F.phaseTwo() } };
  const plain = { revenant: { rank: 0 } };
  assert.ok(Math.abs(windupSeconds(1, p2, { roll: 0.5 }) - windupSeconds(1, plain, { roll: 0.5 }) * 0.85) < 1e-9);
  assert.ok(Math.abs(blowCooldown(p2, 0.5) - blowCooldown(plain, 0.5) * 0.7) < 1e-9);
  assert.equal(blowGuard('lunge', 300, p2, 0.49), 'iron');
  assert.equal(blowGuard('lunge', 300, p2, 0.5), 'poise');
  assert.equal(blowGuard('lunge', 300, plain, 0.01), 'poise');
  assert.equal(chainMax(p2), 2);
  assert.equal(chainMax(plain), 1);
  assert.match(read('src/ai/tactics.js'), /\(b\.chain \?\? 0\) < chainMax\(ent\) && chains\(/, 'the brain chains to its max');
  assert.equal(TELL.CHAIN_CHANCE, 0.35);
});

// ── the pools, the doors, the page ──────────────────────────────────

test('RVN4 THE POOLS AND DOORS: the ember rim where no wind-up glints and a tenth larger, in both pools; the roar refused at every door - both pools\', a spell\'s, a shaft\'s; the dungeon\'s seam ahead of the will, a room\'s shared foe never (mutants: any unwired)', () => {
  for (const [file, v] of [['src/scenes/exteriorFoes.js', 'f'], ['src/scenes/dungeonContext.js', 'f']]) {
    const s = read(file);
    assert.ok(s.includes(`setBatchGlint(${v}.batch, foeGlint(${v}.ai, undefined, prefersReducedMotion()) ?? lastStandGlint(${v}.entity));`), `${file}: the rim`);
    assert.ok(s.includes(`const szE = eliteSize(${v}.entity) * lastStandSize(${v}.entity);`), `${file}: the size`);
    assert.match(s, /if \(f\.roaring\) roarStep\(f\);/, `${file}: the roar spent`);
  }
  assert.match(read('src/scenes/exteriorFoes.js'), /if \(f\.yielded \|\| f\.executing \|\| f\.sparing \|\| f\.leaving \|\| f\.roaring\) return;/);
  const d = read('src/scenes/dungeonContext.js');
  assert.match(d, /if \(foe\.yielded \|\| foe\.executing \|\| foe\.sparing \|\| foe\.leaving \|\| foe\.roaring\) return;/);
  assert.match(d, /if \(!_whole && foe\.entity\?\.revenant\?\.id && \(!onlineRoom\(\) \|\| !isRoomFoe\(foe\)\) && revenantLastStandDue\(foe\)\) \{ lastStandDungeonFoe\(foe\); return; \}\n[^\n]*\n\s*if \(opts\.fates && !_whole/);
  assert.match(d, /function lastStandDungeonFoe\(f\) \{\n\s*const ev = beginLastStand\(playerEntity, f, \{ now: Date\.now\(\), clock: tacticsNow\(\), roar: \(s\) => beginRoar\(f\.ai, f\.entity, s\) \}\);/);
  assert.match(read('src/scenes/hostMagic.js'), /if \(foe\?\.yielded \|\| foe\?\.executing \|\| foe\?\.sparing \|\| foe\?\.leaving \|\| foe\?\.roaring\) return null;/);
  assert.match(read('src/combat/arrowFlight.js'), /if \(foe\.yielded \|\| foe\.executing \|\| foe\.sparing \|\| foe\.leaving \|\| foe\.roaring\) return 0;/);
  assert.equal(FT.revenantLastStandDue({ entity: { revenant: { id: 'nope' } } }), false, 'no record: none');
});

test('RVN4 the page: from rank 3 its last stand and its share (mutants: shown at rank 2; the share unread)', () => {
  assert.equal(lastStandWords({ rank: 2 }), '');
  // PIN MOVED (FEUD BALANCE, OPEN 23)
  assert.equal(lastStandWords({ rank: 3 }), 'Last stand: once a fight it rises again, at 30% of its health.');
  assert.equal(lastStandWords({ rank: 5 }), 'Last stand: once a fight it rises again, at 40% of its health.');
});
