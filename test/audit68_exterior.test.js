// AUDIT 68 (2026-09-24), cluster exterior - src/scenes exterior.js,
// exteriorFoes, hitEffects, horseCartPool: the frame loop's exits, the
// one damage door on a corpse, the floating origin under a foe's memory,
// a failed splash warm, and the encounter cap across the spawn's awaits.
// The pools are the real ones on crafted careers; each pin failed on the base source.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'acorn';
import { createExteriorFoes, MAX_ACTIVE_ENCOUNTER_FOES } from '../src/scenes/exteriorFoes.js';
import { createCityGuards } from '../src/scenes/cityGuards.js';
import { createHitEffects } from '../src/scenes/hitEffects.js';
import { subscribeFoePools } from '../src/scenes/shared.js';
import { POISONS } from '../src/systems/poisons.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const settle = () => new Promise((r) => setTimeout(r, 0));

// ---- the crafted data: two monster careers and the watch's class (world6b's and watch1's shapes) ------------------
function craftCfg({ hpPerLevel = 4, speed = 90, str = 40, agi = 85, luck = 55, atkFlags = 0x08 } = {}) {
  const b = new Uint8Array(74); const v = new DataView(b.buffer);
  b[10] = atkFlags; v.setUint16(52, hpPerLevel, true);
  const attrs = [str, 50, 50, agi, 50, 50, speed, luck];
  for (let i = 0; i < 8; i++) v.setUint16(58 + i * 2, attrs[i], true);
  return b;
}
function craftMonsterBsa(records) {
  const NAME_FIELD = 14, ENTRY = 18;
  const dataLen = records.reduce((a, [, b]) => a + b.length, 0);
  const out = new Uint8Array(4 + dataLen + ENTRY * records.length); const v = new DataView(out.buffer);
  v.setInt16(0, records.length, true); v.setUint16(2, 0x0100, true);
  let pos = 4;
  for (const [, bytes] of records) { out.set(bytes, pos); pos += bytes.length; }
  for (const [name, bytes] of records) { for (let i = 0; i < name.length; i++) out[pos + i] = name.charCodeAt(i); v.setInt32(pos + NAME_FIELD, bytes.length, true); pos += ENTRY; }
  return out;
}
function stubClassCfg() {
  const b = new Uint8Array(80); const v = new DataView(b.buffer);
  v.setUint16(52, 10, true);
  for (let i = 0; i < 8; i++) v.setUint16(58 + i * 2, 50, true);
  return b;
}
const bsa = craftMonsterBsa([['ENEMY000.CFG', craftCfg()], ['ENEMY002.CFG', craftCfg()]]);
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 1 };
const player = () => ({ level: 1, reflexes: 2, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50 }, crimeCommitted: 4 });
/** One host's pools, as world.js hands them their deps. `made` counts every billboard batch minted (a corpse is one). */
function rig({ said = [], made = { n: 0 }, fetchBytes = null } = {}) {
  return {
    renderer: { createBillboardBatch: () => { made.n++; return {}; }, destroyBillboardBatch: () => {}, destroyBatch: () => {}, textures: new Map() },
    collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false },
    fetchBytes: fetchBytes ?? (async (n) => { if (n === 'MONSTER.BSA') return bsa; if (n === 'CLASS18.CFG') return stubClassCfg(); throw new Error(`no ${n} in this pin`); }),
    getTexture: async () => stubTex, uploadRecordFrame: () => {},
    currentMinute: () => 0, currentPixelKey: () => '3,12',
    playerEntity: player(), audio: null, onPlayerHurt: () => {}, rolls: () => 0.5, rand: () => 0.9, say: (t) => said.push(t),
  };
}
const deaths = (said) => said.filter((l) => / just died\.$/.test(l)).length;

// ---- S20-frame-return-kills-loop ----------------------------------------------------------------------------------
/** The host's `function frame` and every ReturnStatement directly in it (a nested function's return is its own). */
function frameReturns(file) {
  const src = rd(file);
  const ast = parse(src, { ecmaVersion: 'latest', sourceType: 'module' });
  let frame = null;
  (function find(n) {
    if (!n || typeof n.type !== 'string' || frame) return;
    if (n.type === 'FunctionDeclaration' && n.id?.name === 'frame') { frame = n; return; }
    for (const k in n) { const v = n[k]; if (Array.isArray(v)) v.forEach(find); else if (v && typeof v.type === 'string') find(v); }
  })(ast);
  assert.ok(frame, `${file}: function frame`);
  const out = [];
  (function walk(n, block) {
    if (!n || typeof n.type !== 'string') return;
    if (n !== frame && /Function/.test(n.type)) return;
    if (n.type === 'ReturnStatement') out.push({ src, at: n.start, block });
    const inner = n.type === 'BlockStatement' ? n : block;
    for (const k in n) { const v = n[k]; if (Array.isArray(v)) v.forEach((x) => walk(x, inner)); else if (v && typeof v.type === 'string') walk(v, inner); }
  })(frame, null);
  return { src, ast, returns: out };
}

test('AUDIT 68 S20-frame-return-kills-loop: every exit from a host\'s frame() re-queues the loop (or is the dead loop\'s own), and a quick take on a pile is the take\'s close - an emptied pile is freed', () => {
  for (const file of ['src/scenes/exterior.js', 'src/scenes/world.js']) {
    const { src, returns } = frameReturns(file);
    const bad = returns.filter(({ at, block }) => {
      const line = src.slice(src.lastIndexOf('\n', at) + 1, at);
      return !/if \(!frameAlive\(_frameToken\)\)/.test(line) && !/requestAnimationFrame\(frame\);/.test(src.slice(block.start, at));
    }).map(({ at }) => src.slice(0, at).split('\n').length);
    assert.deepEqual(bad, [], `${file}: a return in frame() with no requestAnimationFrame(frame) ahead of it stops the game for good`);
    // the pile's quick take: the consequent frees an emptied pile, as the window's onClose would
    const i = src.indexOf('if (quickLootTake(dropKey, _hooks, playerEntity,');
    assert.ok(i > 0, `${file}: the pile's quick take`);
    const stmt = src.slice(i, src.indexOf('\n', i));
    assert.match(stmt, /\)\) droppedLoot\.releaseEmptied\(\);/, `${file}: a take that emptied the pile frees it`);
  }
  // ...and the interior host's pile, the third door onto the same law (the dungeon's settles through onEmptied)
  const wm = rd('src/scenes/worldModes.js');
  assert.match(wm, /if \(!quickLootTake\(key, _hooks, playerEntity, [^\n]*\)\) mountInterior\(interiorInventory\(\{ loot: _hooks \}\)\);[^\n]*\n\s*else interiorDropped\.releaseEmptied\(\);/,
    'worldModes.js: a take that emptied the room\'s pile frees it');
});

// ---- S20-foe-dies-twice -------------------------------------------------------------------------------------------
test('AUDIT 68 S20-foe-dies-twice: a foe a poison kills mid-rest dies ONCE - every later round of the window finds a corpse - and a slain watchman takes no second blow', async () => {
  const said = [], made = { n: 0 };
  const pool = createExteriorFoes(rig({ said, made }));
  const f = await pool.spawnFoe(2, [10, 0, 10], { feetGiven: true });
  assert.ok(f && f.entity.level > 1, 'a foe above level one takes poison (Poisons.InflictPoison)');
  assert.ok(pool.poisonFoe(f, POISONS.Arsenic), 'the Arsenic took');
  f.entity.health = 3;
  // the host's sink (exterior.js / world.js foeSinks: hurt routes an encounter foe to the pool's door) and the broker
  let window = null;
  subscribeFoePools({ subscribe: (fn) => { window = fn; return () => {}; } }, [() => pool.foes],
    (g) => ({ hurt: (n) => { if (n > 0) pool.damageFoe(g, n, [0, 0, 0], null, { fromPlayer: true, kind: 'spell' }); } }));
  const before = made.n;
  window(0, 60, 60);   // one hour of rest, one broker window
  await settle(); await settle();
  assert.equal(f.dead, true, 'the poison killed it');
  assert.equal(deaths(said), 1, `one kill notice: ${said.join(' | ')}`);
  assert.equal(made.n - before, 1, 'one corpse minted');
  pool.damageFoe(f, 5, [0, 0, 0], null);   // a foe's maul landing inside its target machine's 16 Hz window
  await settle();
  assert.equal(deaths(said), 1, 'a corpse takes no blow');
  assert.equal(made.n - before, 1);

  // the watch's door: the same law, and a second death would be a second Murder
  const gsaid = [], gmade = { n: 0 };
  const guards = createCityGuards(rig({ said: gsaid, made: gmade }));
  await guards.spawnCityGuards(true, { playerFeet: [0, 0, 0], playerFwd: [0, 0, 1], pool: [{ pos: [5, 0, 5], fwdYaw: 0, guard: true, disable: () => {} }] });
  const g = guards.guards[0];
  assert.ok(g, 'a watchman off the synthetic CLASS18.CFG');
  guards.hurtGuard(g, 9999, [0, 0, 0]);
  await settle();
  assert.equal(g.dead, true);
  const gBefore = gmade.n;
  guards.hurtGuard(g, 5, [0, 0, 0]);   // the host's spell sink, a later round
  await settle();
  assert.equal(deaths(gsaid), 1, `one kill notice: ${gsaid.join(' | ')}`);
  assert.equal(gmade.n, gBefore, 'no second body');
});

// ---- S20-offset-ai-memory -----------------------------------------------------------------------------------------
test('AUDIT 68 S20-offset-ai-memory: a recenter moves the motor\'s fall anchor and its pursuit memory with the feet - a hop across a vertical recenter is no fall, a hunt out of sight still walks to the player', async () => {
  const pool = createExteriorFoes(rig());
  const f = await pool.spawnFoe(0, [100, 510, 100], { feetGiven: true });
  const ai = f.ai;
  // grounded at 510, a hop, the vertical recenter mid-air (world.js: |y| > 500), the landing on the same ground
  ai._trackFall(true);
  ai._trackFall(false);
  pool.offsetAll([0, -510, 0]);
  assert.equal(ai.feet[1], 0);
  ai._trackFall(true);
  assert.equal(ai.landedFall, 0, 'AdjustLastGrounded: the shift is not a fall');
  // the pursuit memory: the player's blow seeds where it came from (MakeEnemyHostileToAttacker), then a map-pixel recenter
  pool.handleAttackFromPlayer(f, [110, 0, 100]);
  ai.avoidObstaclesTimer = 1;
  ai._getDestination([110, 0, 100]);   // a detour running: destination IS detourDestination
  assert.equal(ai.destination, ai.detourDestination);
  const lead = ai.lastKnownTargetPos[0] - ai.feet[0], det = ai.detourDestination[0];
  pool.offsetAll([-819.2, 0, 0]);
  assert.equal(ai.lastKnownTargetPos[0] - ai.feet[0], lead, 'the last known position follows the origin');
  assert.equal(ai.oldLastKnownTargetPos[0] - ai.feet[0], lead);
  assert.equal(ai.predictedTargetPos, ai.lastKnownTargetPos, 'the alias stands');
  assert.equal(ai.detourDestination[0], det - 819.2, 'an aliased destination moves ONCE');

  // the watch's pool: the same recenter, the same memory
  const guards = createCityGuards(rig());
  await guards.spawnCityGuards(true, { playerFeet: [0, 0, 0], playerFwd: [0, 0, 1], pool: [{ pos: [5, 0, 5], fwdYaw: 0, guard: true, disable: () => {} }] });
  const g = guards.guards[0];
  guards.handleAttackFromPlayer(g, [15, 0, 5]);
  const glead = g.ai.lastKnownTargetPos[0] - g.ai.feet[0];
  guards.offsetAll([-819.2, 0, 0]);
  assert.equal(g.ai.lastKnownTargetPos[0] - g.ai.feet[0], glead, 'a watchman\'s memory follows too');
});

// ---- S20-hiteffects-warm-leak -------------------------------------------------------------------------------------
test('AUDIT 68 S20-hiteffects-warm-leak: a splash whose archive fails to warm leaves the live list - a rejected load or a null texture is not a batch still coming', async () => {
  const renderer = { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {} };
  const failed = Promise.reject(new Error('TEXTURE.380: HTTP 404')); failed.catch(() => {});   // dataPipeline caches the rejection per archive
  const fx = createHitEffects({ renderer, getTexture: () => failed, uploadRecordFrame: () => {} });
  for (let i = 0; i < 5; i++) fx.showBloodSplash(0, [0, 0, 0]);
  await settle();
  fx.tick(1 / 60);
  assert.equal(fx._live.length, 0, 'a rejected warm');
  const fx2 = createHitEffects({ renderer, getTexture: async () => null, uploadRecordFrame: () => {} });
  for (let i = 0; i < 5; i++) fx2.showMissEffect('clang', [0, 0, 0]);
  await settle();
  fx2.tick(1 / 60);
  assert.equal(fx2._live.length, 0, 'no texture at all');
});

// ---- S20-encounter-cap-race ---------------------------------------------------------------------------------------
test('AUDIT 68 S20-encounter-cap-race: a camp that starts every member in one loop cannot stand the pool past its cap - a spawn crossing its awaits holds its slot, and a teardown hands the slot back', async () => {
  const pool = createExteriorFoes(rig());
  for (let i = 0; i < MAX_ACTIVE_ENCOUNTER_FOES - 1; i++) assert.ok(await pool.spawnFoe(0, [i * 3, 0, 0], { feetGiven: true }));
  const camp = await Promise.all([0, 1, 2, 3, 4].map((i) => pool.spawnFoe(0, [i * 3, 0, 10], { feetGiven: true })));
  assert.equal(camp.filter(Boolean).length, 1, 'one slot was left');
  assert.equal(pool.activeCount(), MAX_ACTIVE_ENCOUNTER_FOES);
  // a quickload mid-camp: the teardown cancels the spawns in flight, and the saved foes restore into free slots
  pool.clearLive();
  const inFlight = [0, 1, 2].map((i) => pool.spawnFoe(0, [i * 3, 0, 20], { feetGiven: true }));
  pool.clearLive();
  const restored = await Promise.all(Array.from({ length: MAX_ACTIVE_ENCOUNTER_FOES }, (_, i) => pool.spawnFoe(0, [i * 3, 0, 30], { feetGiven: true })));
  assert.deepEqual(await Promise.all(inFlight), [null, null, null], 'the cancelled spawns stand nothing');
  assert.equal(restored.filter(Boolean).length, MAX_ACTIVE_ENCOUNTER_FOES, 'and hold no slot in the next world');
});
test('AUDIT 68 review R-scenes-loose-foe-squad-capped: a CreateFoeSpawner squad stood in one loop is not the encounter cap\'s - every member stands, and the rolls stay capped', async () => {
  const pool = createExteriorFoes(rig());
  for (let i = 0; i < MAX_ACTIVE_ENCOUNTER_FOES - 1; i++) assert.ok(await pool.spawnFoe(0, [i * 3, 0, 0], { feetGiven: true }));
  const squad = await Promise.all([0, 1, 2, 3, 4].map((i) => pool.spawnFoe(0, [i * 3, 0, 10], { feetGiven: true, loose: true })));
  assert.equal(squad.filter(Boolean).length, 5, 'mutants: `loose` back under the cap - the squad is cut at the one free slot');
  assert.equal(await pool.spawnFoe(0, [0, 0, 40], { feetGiven: true }), null, 'an encounter roll is still refused over the cap');
});

