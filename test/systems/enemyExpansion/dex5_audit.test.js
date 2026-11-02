// AUDIT DEX (2026-10-20, bible/01-Overview/audits/Audit-DEX.md) - THE TROLL'S BODY, AUDITED. DEX5's body over the hosts'
// real chain: the dungeon's corpse functions and its reach mounted from src/scenes/dungeonContext.js as
// test/systems/audit68_dungeonctx.test.js mounts host code, the reach itself out of scenes/corpsePrefabHost.js (D11).
// Each finding's pin, and each with a mutation it must fail under (tools/mutants/dex5.json, the AUDIT-DEX records):
//   D8  the rise stands first - a refused stand leaves the body, to try again after its time; no missile meets a rising body
//   D2  a foe standing up again forgets its body's fate - the next death lays a body
//   D1  a load lays again the save's body a prefab had taken since; a load's rebuild takes the ash
//   D3  the room's memory keeps a body's fate (validSharedFoe `bg`); D4 a load settles it, so the record says it
//   D6  a street copy told a body gone drops its marker, prefab or none
//   D12 a host destroyed lets its prefabs go
//   A1  a female mobile lies as her row's female corpse (EnemyDeath.cs:86-93)
//   B3  a corpse of more than one frame animates (DaggerfallBillboard's AnimatedMaterial)
import '../../modsOff.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as acorn from 'acorn';
import { trollSaveData, restoreTrollSaveData, _resetDexTroll, TROLL_CORPSE } from '../../../src/systems/enemyExpansion/dexTroll.js';
import { createCorpsePrefabs, mintCorpseMarker, corpseTextureOf, tickCorpseMarkers, _resetCorpsePrefabs } from '../../../src/scenes/corpseMarker.js';
import { createDungeonCorpsePrefabs, createStreetCorpsePrefabs } from '../../../src/scenes/corpsePrefabHost.js';
import { installEnemyExpansion, _resetEnemyExpansion } from '../../../src/systems/enemyExpansion/dexInstall.js';
import { validSharedFoe } from '../../../src/net/wire.js';
import { ENEMY_BASICS } from '../../../src/characters/enemy/enemyBasics.js';
import { eliteCorpseSize, isEliteCorpse, markEliteCorpseBatch } from '../../../src/systems/eliteFoes.js';
import { GENERAL_FPS } from '../../../src/render/flatAnimation.js';
import { _resetModSettings } from '../../../src/systems/modSettings.js';
import { clearCustomEnemies } from '../../../src/characters/enemy/customEnemies.js';
import { _resetMintRowEditors } from '../../../src/characters/enemy/enemyEntity.js';
import { _resetFoeGhosts } from '../../../src/characters/enemy/foeLook.js';
import { _resetExtraQuestRows } from '../../../src/systems/quest/tables.js';
import { _resetEncounterTableSelectors } from '../../../src/characters/encounterTableDoor.js';
import { _resetPlayerGps } from '../../../src/world/playerGps.js';
import { _resetSpellRecordsAssets } from '../../../src/systems/spell/standardSpells.js';
import { _resetEnemySpellbooks } from '../../../src/systems/enemySpells.js';
import { _resetFormulaDoors } from '../../../src/combat/formulas.js';
import { _resetForcedGenders } from '../../../src/characters/mobile/mobileUnit.js';
import { _resetDexBodies } from '../../../src/systems/enemyExpansion/dexBodies.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
const TROLL = 272;
const silent = () => {};
const reset = () => {
  _resetDexTroll(); _resetCorpsePrefabs(); _resetDexBodies(); _resetFormulaDoors(); _resetForcedGenders(); _resetSpellRecordsAssets(); _resetEnemySpellbooks();
  _resetEncounterTableSelectors(); _resetPlayerGps(); _resetEnemyExpansion(); clearCustomEnemies(); _resetMintRowEditors(); _resetFoeGhosts(); _resetExtraQuestRows();
  _resetModSettings();
};
const flush = async (n = 4) => { for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0)); };

// ---- the dungeon's real corpse chain, mounted ---------------------------------------------------------------------------
const D = rd('src/scenes/dungeonContext.js');
const AST = acorn.parse(D, { ecmaVersion: 'latest', sourceType: 'module' });
function find(pred) {
  let hit = null;
  (function walk(n) {
    if (!n || typeof n.type !== 'string' || hit) return;
    if (pred(n)) { hit = n; return; }
    for (const k of Object.keys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === 'string') walk(v); }
  })(AST);
  return hit;
}
const fnSrc = (name) => { const n = find((x) => x.type === 'FunctionDeclaration' && x.id?.name === name); assert.ok(n, name); return D.slice(n.start, n.end); };
const declSrc = (name) => { const n = find((x) => x.type === 'VariableDeclaration' && x.declarations.some((d) => d.id?.name === name)); assert.ok(n, name); return D.slice(n.start, n.end); };
const scoped = (state) => new Proxy(state, {
  has: (t, k) => k !== '__s',
  get: (t, k) => (k === Symbol.unscopables ? undefined : (k in t ? t[k] : globalThis[k])),
  set: (t, k, v) => { t[k] = v; return true; },
});
const mount = (body, state) => new Function('__s', `with (__s) { ${body} }`)(scoped(state));

/** The dungeon's spawnCorpse, spawnCorpseNow, freeCorpse and setFoeDead, and its `corpsePrefabs` wiring, over a stub
 *  renderer. `stand(t, p)` answers the loose stand (the troll that rises) - a promise of a foe, or of null. */
function dungeon({ foes, stand = async (t, p) => ({ mobileType: t, feet: p }) }) {
  const log = { minted: [], freed: [], stood: [], hud: [], hits: [], unclocked: [] };
  const tex = { getSize: () => ({ width: 64, height: 40 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 30, getFrameCount: () => 1 };
  const state = {
    foes, _layoutFoes: foes.length, _authority: true, _ctxDead: false, _locationKey: 'dungeon:7',
    _wallNow: () => null, roomBodyBorn: () => {}, floorLanding: (c, p) => p, collider: null,
    getTexture: async () => tex, uploadRecord: () => {}, uploadRecordFrame: () => {},
    billboardSize: () => ({ w: 1.5, h: 0.6 }), eliteCorpseSize, isEliteCorpse, markEliteCorpseBatch,
    armFlatAnim: () => {}, flatAnims: { remove: (b) => log.unclocked.push(b) },
    _npcLane: null, foeId: () => 0, billboardBatches: [], ENEMY_BASICS, corpseTextureOf,
    _lootSeen: new Set(), _lootAt: new Map(), forgetRoomContainer: () => {}, renownFoeRevived: () => {},
    renderer: {
      createBillboardBatch: (archive, record, size, centers) => { const b = { archive, record, size, centers }; log.minted.push(b); return b; },
      destroyBillboardBatch: (b) => { log.freed.push(b); },
    },
    isPuppetFoe: (f) => f != null && f._ownFrom != null,
    spawnLooseFoe: (t, p, o) => { log.stood.push({ t, p, o }); return stand(t, p); },
    mintCorpseMarker, opts: { onFoeHit: (h) => log.hits.push(h) }, hudText: { add: (l) => log.hud.push(l) }, createDungeonCorpsePrefabs,
  };
  const api = mount(`
    ${fnSrc('spawnCorpse')}
    ${fnSrc('spawnCorpseNow')}
    ${fnSrc('freeCorpse')}
    ${fnSrc('setFoeDead')}
    ${declSrc('corpsePrefabs')}
    return { spawnCorpse, setFoeDead, freeCorpse, corpsePrefabs };
  `, state);
  return { ...api, state, log };
}
const trollFoe = () => ({ mobileType: TROLL, ai: { feet: [3, 0, 4] }, entity: { career: null }, mobile: { basics: ENEMY_BASICS[TROLL], gender: 'male' } });
const kill = async (d, f) => { d.setFoeDead(f, true); await flush(); };
const rise = async (f) => { f.corpsePrefab.frame(TROLL_CORPSE.respawnTime + 0.5); await flush(); };

test('AUDIT DEX D8: THE RISE STANDS FIRST - the troll is asked for and the body goes, and the HUD says so, only once it stands; a stand refused leaves the body lying to try again after its time; no missile meets a rising body', async () => {
  reset();
  installEnemyExpansion({ on: true, log: silent });
  let answer = null;
  const f = trollFoe();
  const d = dungeon({ foes: [f], stand: () => new Promise((r) => { answer = r; }) });
  await kill(d, f);
  const body = f.corpseBatch, prefab = f.corpsePrefab;
  assert.ok(body && prefab, 'the body lies with its prefab');
  assert.deepEqual(prefab.sphere(), { center: [3, 0.1 + 0.6 / 2, 4], radius: 1 }, 'the trigger about the flat\'s centre - its size the dungeon\'s body\'s');
  prefab.frame(TROLL_CORPSE.respawnTime + 0.5);
  assert.equal(d.log.stood.length, 1, 'the stand is asked');
  assert.equal(f.corpseBatch, body, '...and the body still lies while it is');
  assert.equal(prefab.sphere(), null, 'a rising body is gone to the world: no trigger');
  assert.equal(prefab.struck({ effects: [] }, 1, null), null, '...and no bundle lands');
  prefab.frame(30);
  assert.equal(d.log.stood.length, 1, 'one ask at a time');
  answer(null); await flush();
  assert.equal(f.corpseBatch, body, 'refused: the body lies on');
  assert.equal(f.corpseDestroyed, undefined);
  assert.equal(d.log.hud.length, 0, 'and nothing is said');
  assert.equal(prefab.respawnBuffer, TROLL_CORPSE.respawnTime, 'its time again');
  prefab.frame(TROLL_CORPSE.respawnTime + 0.5);
  assert.equal(d.log.stood.length, 2, 'asked again after its time');
  answer({ mobileType: TROLL }); await flush();
  assert.equal(f.corpseBatch, null, 'stood: the body goes');
  assert.equal(f.corpseDestroyed, 1);
  assert.deepEqual(d.log.hud, ['The Troll has recovered from its injuries.']);
  assert.deepEqual(d.log.stood[1].p, [3, 0.1, 4], 'where the body lay (its corpsePos - the landing a tenth over the feet)');
  assert.equal(d.log.stood[1].o, undefined, 'CreateEnemy\'s: hostile, no quest\'s, no ally');
  // a copy's body (a loose foe another machine runs) counts nothing - its runner rises it
  const copy = { ...trollFoe(), _ownFrom: 'peer-2' };
  d.state.foes.push(copy);
  await kill(d, copy);
  copy.corpsePrefab.frame(60);
  assert.equal(d.log.stood.length, 2, 'no stand asked for a copy');
});

test('AUDIT DEX D2 / D1 / D12: THE DUNGEON\'S BODY OVER ITS REAL CHAIN - a foe standing up again forgets its body\'s fate and its next death lays a body; a load lays again the save\'s body a prefab had taken since, its time the save\'s; a load\'s word settles a body gone with no ash; the host destroyed lets its prefabs go', async () => {
  reset();
  installEnemyExpansion({ on: true, log: silent });
  const f = trollFoe();
  const d = dungeon({ foes: [f] });
  await kill(d, f);
  await rise(f);
  assert.equal(f.corpseDestroyed, 1, 'risen');
  assert.equal(f.corpseBatch, null);
  // D2: the load's rewind stands it up again (setFoeDead(f, false)), and it is killed once more
  d.setFoeDead(f, false);
  assert.equal(f.corpseDestroyed, 0, 'its body\'s fate forgotten');
  assert.equal(f.corpsePrefab, null, 'and its prefab with it');
  await kill(d, f);
  assert.ok(f.corpseBatch, 'the second death lays a body');
  assert.ok(f.corpsePrefab, '...with a prefab of its own');
  // D1: risen again, then a save from before the rise is loaded: patchFoe's arm lays the body again, at the save's time
  await rise(f);
  assert.equal(f.corpseDestroyed, 1);
  restoreTrollSaveData({ activeCorpses: [{ key: 'dungeon:7|0', respawnBuffer: 4 }] });   // the mod's record lands first
  assert.match(D, /else if \(sf\.dead && f\.corpseDestroyed\) \{ corpsePrefabs\.forget\(f\); spawnCorpse\(f\); \}/, 'patchFoe\'s arm (AUDIT DEX D1)');
  d.corpsePrefabs.forget(f); d.spawnCorpse(f); await flush();
  assert.ok(f.corpseBatch, 'the save\'s body lies again');
  assert.equal(f.corpsePrefab.respawnBuffer, 4, '...with the save\'s time');
  // a second load's record replaces the first's: a time it no longer names is never handed to a later body
  restoreTrollSaveData({ activeCorpses: [{ key: 'dungeon:7|5', respawnBuffer: 7 }] });
  restoreTrollSaveData({ activeCorpses: [] });
  const late = trollFoe(); d.state.foes.push(late); d.state._layoutFoes = d.state.foes.length;
  while (d.state.foes.length < 6) d.state.foes.splice(d.state.foes.length - 1, 0, { mobileType: 1, ai: { feet: [0, 0, 0] } });
  d.state._layoutFoes = 6;
  await kill(d, late);
  assert.equal(late.corpsePrefab.respawnBuffer, TROLL_CORPSE.respawnTime, 'the first record\'s pending time gone with it');
  // D4 / D3: a load's (or the memory's) word that it was burnt: the body goes, no ash stands, the record says `bg` 2
  const ashesBefore = d.state.billboardBatches.length;
  d.corpsePrefabs.settle(f, 2);
  assert.equal(f.corpseBatch, null);
  assert.equal(f.corpseDestroyed, 2);
  assert.equal(f.corpsePrefab, null);
  await flush();
  assert.equal(d.state.billboardBatches.length, ashesBefore - 1, 'its body flat gone and no ash stood');
  // D12: a body that lies, then the host destroyed - nothing of it is saved, its prefab let go
  const g = trollFoe(); d.state.foes.push(g); d.state._layoutFoes = d.state.foes.length;
  await kill(d, g);
  assert.deepEqual(trollSaveData().activeCorpses.map((r) => r.key), ['dungeon:7|5', 'dungeon:7|6'], 'late\'s body and g\'s, each by its slot');
  d.corpsePrefabs.destroy();
  assert.equal(g.corpsePrefab, null, 'let go with the host');
  assert.deepEqual(trollSaveData(), { activeCorpses: [] });
});

test('AUDIT DEX D1: THE ASH IS NO SAVED OBJECT - a burnt body\'s ash is a flat of the level, and a save\'s load takes every ash flat (and one still warming never lands)', async () => {
  reset();
  installEnemyExpansion({ on: true, log: silent });
  const f = trollFoe(), g = trollFoe();
  const d = dungeon({ foes: [f, g] });
  await kill(d, f); await kill(d, g);
  f.corpsePrefab.gone(2); await flush();
  const ash = d.state.billboardBatches.find((b) => b.archive === TROLL_CORPSE.ash.archive && b.record === TROLL_CORPSE.ash.record);
  assert.ok(ash, 'the ash stands among the level\'s flats');
  g.corpsePrefab.gone(2);   // a second ash, still warming when the load lands
  d.corpsePrefabs.clearAsh();
  await flush();
  assert.equal(d.state.billboardBatches.some((b) => b.archive === TROLL_CORPSE.ash.archive), false, 'none stands after the load');
  assert.ok(d.log.freed.includes(ash), 'its batch freed');
  assert.match(D, /if \(truncate\) corpsePrefabs\.clearAsh\(\);/, 'applyWorld takes them on a save\'s load (truncate)');
});

test('AUDIT DEX D3 / D4: THE SAVE AND THE ROOM\'S MEMORY KEEP A BODY\'S FATE - the save writes its kind (`bg`), the memory\'s door keeps it on a dead record alone, and a load settles it so the record says it to every copy', () => {
  assert.deepEqual(validSharedFoe({ dead: true, bg: 2 }), { dead: true, bg: 2 });
  assert.deepEqual(validSharedFoe({ dead: true, bg: 1 }), { dead: true, bg: 1 });
  assert.equal(validSharedFoe({ dead: false, bg: 2 }), null, 'a living foe has no body to have lost');
  assert.equal(validSharedFoe({ dead: true, bg: 3 }), null, '1 risen or 2 burnt, nothing else');
  assert.deepEqual(validSharedFoe({ dead: true }), { dead: true }, 'a body that lies says nothing');
  assert.match(D, /\.\.\.\(f\.dead && f\.corpseDestroyed \? \{ bg: f\.corpseDestroyed \} : \{\}\),/, 'the save writes the kind');
  assert.match(D, /if \(\(sf\.noBody \|\| sf\.bg\) && sf\.dead\) \{ if \(!f\.dead\) questPoolOps\.removeFoe\(f\); corpsePrefabs\.settle\(f, sf\.bg\);/, 'a load settles it');
  assert.match(D, /for \(const f of w\.foes\) delete f\.noBody;/, 'the memory still drops the revenants\' word (not its to carry) - `bg` rides');
  assert.match(D, /freeCorpse\(f\);\n\s*corpsePrefabs\.forget\(f\);/, 'the un-death door forgets the body\'s fate (D2)');
});

test('AUDIT DEX D6: A STREET COPY TOLD A BODY GONE DROPS ITS MARKER - with no prefab of its own to name the ash, its flat still goes at its owner\'s word', () => {
  reset();
  const freed = [], corpseBatches = [];
  const runner = createStreetCorpsePrefabs({
    removeCorpse: () => assert.fail('a copy never ends its owner\'s record'), spawnFoe: async () => null, mintMarker: async () => null,
    renderer: { destroyBillboardBatch: (b) => freed.push(b) }, corpseBatches, collider: null, epoch: () => 0, currentPixelKey: () => 'p', sendHit() {}, say() {},
  });
  const marker = { batch: { id: 'body' }, pos: [0, 0, 0] };
  corpseBatches.push(marker);
  const copy = { dead: true, corpse: true, puppet: 'owner-1', corpseMarker: marker, corpsePrefab: null };
  runner.told(copy, 2);
  assert.equal(copy.corpseMarker, null);
  assert.deepEqual(freed, [marker.batch]);
  assert.equal(corpseBatches.length, 0);
  assert.equal(copy.corpseDestroyed, 1);
});

test('AUDIT DEX A1: A FEMALE MOBILE LIES AS HER ROW\'S FEMALE CORPSE (EnemyDeath.cs:86-93) - the mod\'s riders and Dark Slayer; a male, a row with none, a rig foe by its row; every corpse mint asks it', () => {
  reset();
  installEnemyExpansion({ on: true, log: silent });
  const row = ENEMY_BASICS[392];   // Thief Rider - its gender forced Female (BestiaryMod.cs:1378-1387)
  assert.ok(row.femaleCorpseTexture && row.corpseTexture, 'the row names both');
  assert.deepEqual(corpseTextureOf({ mobileType: 392, mobile: { basics: row, gender: 'female' } }), row.femaleCorpseTexture);
  assert.deepEqual(corpseTextureOf({ mobileType: 392, mobile: { basics: row, gender: 'male' } }), row.corpseTexture);
  assert.deepEqual(corpseTextureOf({ mobileType: 395, gender: 'female' }), ENEMY_BASICS[395].femaleCorpseTexture, 'a rig foe: the row and its own gender');
  assert.deepEqual(corpseTextureOf({ mobileType: 128, mobile: { basics: ENEMY_BASICS[128], gender: 'female' } }), ENEMY_BASICS[128].corpseTexture, 'no classic row names a female corpse');
  const ext = rd('src/scenes/exteriorFoes.js');
  assert.equal((D.match(/const ct = corpseTextureOf\(f\);/g) ?? []).length, 2, 'the dungeon\'s mint and its body\'s loot icon');
  assert.equal((ext.match(/const ct = corpseTextureOf\(f\);/g) ?? []).length, 1, 'the street\'s mint');
  assert.ok(!/basics\?\.corpseTexture \?\? ENEMY_BASICS\[f\.mobileType\]\?\.corpseTexture/.test(D + ext), 'no mint reads the male corpse alone');
});

test('AUDIT DEX B3: A CORPSE OF MORE THAN ONE FRAME ANIMATES - every frame uploaded, the clock on the record (GENERAL_FPS, DFU\'s fixed step) so a rebuilt batch keeps it; one frame stands still; the dungeon unclocks a freed body', async () => {
  const uploads = [];
  const tex = (frames) => ({ getSize: () => ({ width: 64, height: 40 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 30, getFrameCount: () => frames });
  const renderer = { createBillboardBatch: (archive, record, size) => ({ archive, record, size }) };
  const hound = await mintCorpseMarker({ renderer, getTexture: async () => tex(3), uploadRecordFrame: (a, r, f) => uploads.push(f), corpseTexture: { archive: 1614, record: 20 }, feet: [0, 0, 0] });
  assert.ok(hound.anim, 'three frames: a clock');
  assert.deepEqual(uploads, [0, 1, 2], 'every frame uploaded at the mint');
  assert.equal(hound.batch.frame, 0);
  tickCorpseMarkers([hound], 1 / GENERAL_FPS + 1e-6);
  assert.equal(hound.batch.frame, 1, 'a frame a fifth of a second');
  tickCorpseMarkers([hound], 2 / GENERAL_FPS);
  assert.equal(hound.batch.frame, 0, 'and round again');
  const plain = await mintCorpseMarker({ renderer, getTexture: async () => tex(1), uploadRecordFrame: () => {}, corpseTexture: { archive: 400, record: 2 }, feet: [0, 0, 0] });
  assert.equal(plain.anim, null, 'a classic corpse is one frame and stands still');
  const ext = rd('src/scenes/exteriorFoes.js');
  assert.match(ext, /tickCorpseMarkers\(corpseBatches, dt\);/, 'the street ticks its bodies');
  assert.equal((ext.match(/c\.batch\.frame = c\.anim\?\.frame \?\? 0;/g) ?? []).length, 2, 'a recentred or re-grounded batch keeps its clock\'s frame');
  // the dungeon's own mint arms its animator (FA1); a freed body leaves it
  reset();
  installEnemyExpansion({ on: true, log: silent });
  const f = trollFoe();
  const d = dungeon({ foes: [f] });
  await kill(d, f);
  const body = f.corpseBatch;
  d.freeCorpse(f);
  assert.ok(d.log.unclocked.includes(body), 'freeCorpse takes the body off the animator');
});

test('AUDIT DEX D11: THE HOSTS WIRE THE REACH - scenes/corpsePrefabHost.js holds it; the dungeon and the street pass it their doors and nothing more', () => {
  const ext = rd('src/scenes/exteriorFoes.js');
  assert.match(D, /const corpsePrefabs = createDungeonCorpsePrefabs\(\{/);
  assert.match(ext, /const corpsePrefabs = createStreetCorpsePrefabs\(\{/);
  assert.ok(!/createCorpsePrefabs\(/.test(D + ext), 'no host builds the runner itself');
  // the runner a test builds by hand still answers the old doors (registerCorpsePrefab's contract)
  const runner = createCorpsePrefabs({ runs: () => true, key: () => null });
  for (const k of ['mint', 'frame', 'told', 'forget', 'settle', 'destroy']) assert.equal(typeof runner[k], 'function', k);
});
