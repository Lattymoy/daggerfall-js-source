// ARENA2 (2026-10-02): THE TWO SEAMS THE FIGHTERS NEED, AND THE CITY'S PEACE. (1) THE BOUT TEAM - an isolation seam
// beside the camp's in the targeting law (characters/enemyTargets.js boutGate): a bout's fighters target only each
// other across their sides, whatever their kinds and whatever the infighting setting; nobody outside the bout joins it;
// a fighter takes the player only when the player is its bout's opponent; nobody is a target before the word or once
// out. (2) THE FOE YIELD FLOOR in the pools' damage doors (scenes/exteriorFoes.js, its dungeon twin): a bout fighter at
// the floor is held at 1 - no corpse, no loot, no renown, no death notice - and the bout hears every blow and the fall.
// (3) A player striking an EXHIBITION fighter never turns the city - the bout's hook answers (the Herald, then the watch).
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { boutGate, setPlayerBout, playerBoutOf, getTargets, runTargetMachine, PLAYER_TARGET } from '../src/characters/enemyTargets.js';
import { EnemyAI } from '../src/characters/enemyMotor.js';
import { Collider } from '../src/player/collider.js';
import { createExteriorFoes } from '../src/scenes/exteriorFoes.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const settle = () => new Promise((r) => setTimeout(r, 0));
const I4 = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const floored = () => { const c = new Collider(() => -100); c.addMesh('floor', new Float32Array([-80, 0, -80, 80, 0, -80, 80, 0, 80, -80, 0, 80]), new Uint32Array([0, 1, 2, 0, 2, 3]), I4); return c; };
const COL = floored();
const body = (feet, team, bout = null, hostile = true) => {
  const ai = Object.assign(new EnemyAI(COL, feet, 0, { liveSpeed: 50, height: 1.8, centreOffset: 0.9 }), { wouldBeSpawned: true });
  ai.isHostile = hostile;
  return { ai, entity: { team, bout } };
};
const tag = (id, side, o = {}) => ({ id, side, out: false, hold: false, ...o });

test('ARENA2 bout team: the gate - a pair across sides fights; a teammate, a stranger, the held and the out never', () => {
  const a = body([0, 0, 0], 'Orcs', tag('x', 0)), b = body([0, 0, 3], 'Orcs', tag('x', 1));
  assert.equal(boutGate(a, b, false), true, 'two orcs of one bout fight, whatever their team');
  assert.equal(boutGate(a, body([0, 0, 3], 'Bears', tag('x', 0)), false), false, 'a teammate never');
  assert.equal(boutGate(a, body([0, 0, 3], 'Bears', tag('y', 1)), false), false, 'another bout\'s fighter never');
  assert.equal(boutGate(a, body([0, 0, 3], 'CityWatch'), false), false, 'the watch never joins a bout');
  assert.equal(boutGate(body([0, 0, 0], 'CityWatch'), b, false), false, 'and no fighter is the watch\'s target');
  assert.equal(boutGate(body([0, 0, 0], 'Orcs'), body([0, 0, 1], 'Bears'), false), null, 'no bout on either side: the classic chain decides');
  assert.equal(boutGate(a, body([0, 0, 3], 'Bears', tag('x', 1, { out: true })), false), false, 'one already out never');
  assert.equal(boutGate(body([0, 0, 0], 'Orcs', tag('x', 0, { hold: true })), b, false), false, 'before the word, nobody');
  assert.equal(boutGate(a, b, false), true);
  // the player
  assert.equal(boutGate(a, PLAYER_TARGET, true, null), false, 'an exhibition fighter never takes the player');
  assert.equal(boutGate(a, PLAYER_TARGET, true, { id: 'x', side: 1 }), true, 'the player in the bout on the other side');
  assert.equal(boutGate(a, PLAYER_TARGET, true, { id: 'x', side: 0 }), false, 'never a teammate player');
  assert.equal(boutGate(body([0, 0, 0], 'Orcs'), PLAYER_TARGET, true, { id: 'x', side: 1 }), false, 'nobody outside joins my bout either');
  assert.equal(boutGate(a, { isPlayer: true, isPeer: true, id: 'p', feet: [0, 0, 1] }, true, { id: 'x', side: 1 }), false, 'a peer is not in my bout');
  assert.equal(boutGate(a, { isPlayer: true, isPeer: true, bout: tag('x', 1) }, true), true, 'a peer that is (ARENA4)');
  setPlayerBout({ id: 'x', side: 1 });
  assert.deepEqual(playerBoutOf(), { id: 'x', side: 1, out: false });
  assert.equal(boutGate(a, PLAYER_TARGET, true), true, 'the module\'s player bout');
  setPlayerBout(null);
  assert.equal(playerBoutOf(), null);
});

test('ARENA2 bout team: getTargets - two fighters pick each other over a nearer stranger, with infighting off and pacified', () => {
  const a = body([0, 0, 0], 'Orcs', tag('x', 0), false), b = body([0, 0, 6], 'Orcs', tag('x', 1), false);
  const stranger = body([0, 0, 2], 'Bears'), watch = body([1, 0, 1], 'CityWatch');
  const got = getTargets(a, [stranger, watch, b], [0, 0, 1], { infighting: false });
  assert.equal(got.target, b, 'the bout\'s opponent, never the nearer bear or the watchman beside it');
  const got2 = getTargets(stranger, [a, b, watch], [0, 0, 30], { infighting: true });
  assert.notEqual(got2.target, a);
  assert.notEqual(got2.target, b, 'a bear never wanders into the bout');
  assert.equal(getTargets(a, [stranger], [0, 0, 1], { infighting: true }).target, null, 'no opponent: nobody, not even the player');
  // the player in the bout, on the other side: the fighter takes them (hostile or not)
  assert.equal(getTargets(a, [stranger], [0, 0, 1], { infighting: true, playerBout: { id: 'x', side: 1 } }).target, PLAYER_TARGET);
});

test('ARENA2 bout team: the target machine drops a target the gate refuses - the striker an exhibition fighter was handed, one out', () => {
  const a = body([0, 0, 0], 'Orcs', tag('x', 0), false), b = body([0, 0, 6], 'Orcs', tag('x', 1), false);
  a.ai.target = PLAYER_TARGET;   // MakeEnemyHostileToAttacker wrote the striker in
  runTargetMachine(a, [b], [0, 0, 1], 0, { infighting: true });
  assert.notEqual(a.ai.target, PLAYER_TARGET, 'the player is not its bout');
  a.ai.target = b;
  b.entity.bout.out = true;
  runTargetMachine(a, [b], [0, 0, 1], 0, { infighting: true });
  assert.equal(a.ai.target, null, 'one out of the bout is nobody\'s target');
  // a HOSTILE exhibition fighter handed the striker drops them too (the gate, not the pacification, does it)
  const h = body([0, 0, 0], 'Orcs', tag('x', 0), true);
  h.ai.target = PLAYER_TARGET;
  runTargetMachine(h, [], [0, 0, 1], 0, { infighting: true, playerBout: null });
  assert.equal(h.ai.target, null);
  // a ladder fighter (pacified or not) keeps the player it fights
  const c = body([0, 0, 0], 'Orcs', tag('z', 1), false);
  c.ai.target = PLAYER_TARGET;
  runTargetMachine(c, [], [0, 0, 1], 0, { infighting: true, playerBout: { id: 'z', side: 0 } });
  assert.equal(c.ai.target, PLAYER_TARGET, 'my opponent keeps me, hostile or not');
  runTargetMachine(c, [], [0, 0, 1], 0, { infighting: true, playerBout: null });
  assert.equal(c.ai.target, null, 'out of the bout I am nobody\'s');
});

// ── THE FOE YIELD FLOOR, on the exterior pool's own door ───────────────────────────────────────────────────
function craftCfg() { const b = new Uint8Array(74); const v = new DataView(b.buffer); b[10] = 0x08; v.setUint16(52, 4, true); for (let i = 0; i < 8; i++) v.setUint16(58 + i * 2, 50, true); return b; }
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
const bsa = craftMonsterBsa([['ENEMY002.CFG', craftCfg()]]);
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 1 };
function rig({ said = [], made = { n: 0 }, hostile = { n: 0 } } = {}) {
  return {
    renderer: { createBillboardBatch: () => { made.n++; return {}; }, destroyBillboardBatch: () => {}, destroyBatch: () => {}, textures: new Map() },
    collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false },
    fetchBytes: async (n) => { if (n === 'MONSTER.BSA') return bsa; throw new Error(`no ${n}`); },
    getTexture: async () => stubTex, uploadRecordFrame: () => {}, currentMinute: () => 0, currentPixelKey: () => '3,12',
    playerEntity: { level: 1, reflexes: 2, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50 } },
    audio: null, onPlayerHurt: () => {}, rolls: () => 0.5, rand: () => 0.9, say: (t) => said.push(t), makeAreaHostile: () => { hostile.n++; },
  };
}

test('ARENA2 foe yield floor: a bout fighter at the floor stands at 1 - no corpse, no death notice - and the bout hears every blow and the fall once', async () => {
  const said = [], made = { n: 0 };
  const pool = createExteriorFoes(rig({ said, made }));
  const f = await pool.spawnFoe(2, [10, 0, 10], { feetGiven: true, loose: true, transient: true, managed: true, champion: null, level: 5 });
  assert.ok(f);
  const heard = [];
  f.entity.bout = { id: 'x', side: 1, out: false, hold: false, hooks: { hurt: (foe, d, o) => heard.push(['hurt', d, o.fromPlayer]), floor: (foe, o) => heard.push(['floor', o.fromPlayer]), intrude: () => heard.push(['intrude']) } };
  setPlayerBout({ id: 'x', side: 0 });
  try {
    const before = made.n;
    f.entity.health = 10;
    pool.damageFoe(f, 4, [0, 0, 0], null, { fromPlayer: true });
    assert.equal(f.entity.health, 6);
    pool.damageFoe(f, 50, [0, 0, 0], null, { fromPlayer: true });
    await settle();
    assert.equal(f.entity.health, 1, 'held at the floor');
    assert.equal(f.dead, false, 'nobody dies on the sand');
    assert.equal(f.corpse, undefined);
    assert.equal(made.n, before, 'no corpse minted');
    assert.equal(said.filter((l) => /died/.test(l)).length, 0, 'no death notice');
    assert.equal(f.entity.bout.out, true);
    pool.damageFoe(f, 50, [0, 0, 0], null, { fromPlayer: false });
    assert.equal(f.entity.health, 1, 'still at 1');
    assert.deepEqual(heard, [['hurt', 4, true], ['hurt', 50, true], ['floor', true], ['hurt', 50, false]], 'the floor told once');
  } finally { setPlayerBout(null); }
});

test('ARENA2 the city\'s peace: a player striking an exhibition fighter turns no area - the bout\'s hook answers; a foe not in a bout turns it as ever', async () => {
  const hostile = { n: 0 };
  const pool = createExteriorFoes(rig({ hostile }));
  const f = await pool.spawnFoe(2, [10, 0, 10], { feetGiven: true, loose: true, transient: true, managed: true, champion: null });
  const heard = [];
  f.ai.isHostile = false;
  f.entity.bout = { id: 'ex', side: 0, out: false, hold: false, hooks: { intrude: () => heard.push('intrude') } };
  pool.handleAttackFromPlayer(f, [0, 0, 0]);
  assert.deepEqual(heard, ['intrude']);
  assert.equal(hostile.n, 0, 'the city never turns for a blow on the sand');
  assert.equal(f.ai.isHostile, false, 'the fighter keeps to its bout');
  const g = await pool.spawnFoe(2, [12, 0, 10], { feetGiven: true, loose: true });
  g.ai.isHostile = false;
  pool.handleAttackFromPlayer(g, [0, 0, 0]);
  assert.equal(hostile.n, 1, 'a passive foe off the sand turns the area, DFU\'s law');
});

test('ARENA2 the dungeon\'s twin: the same floor, the same hook, the level and the bout on a loose stand; the 1 HP spare on my blows taken', () => {
  const d = rd('src/scenes/dungeonContext.js');
  assert.match(d, /if \(bout\) \{ foe\.entity\.health = 1; if \(!bout\.out\) \{ bout\.out = true; bout\.hooks\?\.floor\?\.\(foe, \{ fromPlayer: fromPlayer && !peer, striker \}\); \} return; \}/);
  assert.match(d, /if \(bout && healthDamage > 0\) bout\.hooks\?\.hurt\?\.\(foe, healthDamage, \{ fromPlayer: fromPlayer && !peer, striker \}\);/);
  assert.match(d, /if \(bout && !peer && foeDeps && foeDeps\.boutGate\(foe, foeDeps\.PLAYER_TARGET, true\) !== true\) \{ bout\.hooks\?\.intrude\?\.\(foe\); return; \}/);
  assert.match(d, /if \(fromPlayer && !peer && !bout\) renownFoeStruck\(foe\);/, 'no renown on the sand');
  assert.match(d, /e\.level \?\? effectiveLevel\(D\.playerEntity\)/, 'a fighter at its tier\'s level');
  assert.match(d, /if \(!puppet && e\.level == null\) applyProgressionScalingTo\(entity, basics\);/, 'the ladder is a fixed mountain');
  assert.match(d, /if \(bout\) \{ f\.entity\.bout = bout; f\.entity\.items = \[\]; f\._bout = true; return f; \}/, 'no loot, never the room\'s');
  assert.match(d, /hurtEntity\(playerEntity, dmg, opts\.playerSpare\?\.\(\) \?\? \{\}\);/);
  const x = rd('src/scenes/exteriorFoes.js');
  assert.match(x, /if \(bout\) \{ f\.entity\.health = 1; if \(!bout\.out\) \{ bout\.out = true; bout\.hooks\?\.floor\?\.\(f, \{ fromPlayer: fromPlayer && !peer, striker \}\); \} return; \}/);
  // the floor stands BEFORE every death arm in both doors (the companion's, the soul trap's, the corpse's)
  for (const [src, comp] of [[d, 'if (foe.companion != null) { foe.entity.health = 1'], [x, 'if (f.companion != null) { f.entity.health = 1']]) {
    assert.ok(src.indexOf('bout.hooks?.floor?.(') < src.indexOf(comp), 'the yield floor first');
  }
});
