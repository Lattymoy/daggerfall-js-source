// QUEST-POPUP-PAUSE (2026-09-26, SquidKamer on the Discord: a ship raid's box came up and the player "get[s] jumped by
// everyone"; Mac, asked: "Pause them offline"). DFU's message box pauses the game (UserInterfaceWindow.PauseWhileOpen),
// so a quest's box held every foe; WINFOE1 had let the foes run under every window. Offline, a quest box that is open
// and on top of its slot holds the foes again - the street's pools, the watch, the town's answer and the interior
// pools through the mode machine's bag. A rest window keeps WINFOE1; online nothing is held (one room, one clock).
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { questBoxHoldsFoes } from '../src/scenes/questFoeHost.js';
import { createExteriorFoes } from '../src/scenes/exteriorFoes.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('QUEST-POPUP-PAUSE: the foes stand still offline while a quest box is open and on top - not online, not once it is closed, not under another window', () => {
  const box = { done: false };
  const top = (w) => w === box;
  assert.equal(questBoxHoldsFoes(box, { online: false, onTop: top }), true, 'offline, the box on top holds them');
  assert.equal(questBoxHoldsFoes(box, { online: true, onTop: top }), false, 'online the room keeps its clock');
  assert.equal(questBoxHoldsFoes(null, { online: false, onTop: top }), false, 'no box, nothing held');
  assert.equal(questBoxHoldsFoes({ done: true }, { online: false, onTop: () => true }), false, 'a box the player closed holds nothing');
  assert.equal(questBoxHoldsFoes(box, { online: false, onTop: () => false }), false, 'a box no longer in the slot holds nothing - WINFOE1 is the other window\'s');
});

// the WORLD6b-ii rig: a synthetic MONSTER.BSA (a rat's career) on flat open ground
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
const bsa = craftMonsterBsa([['ENEMY000.CFG', craftCfg()]]);
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 1 };
const playerEntity = () => ({ level: 1, reflexes: 2, health: 50, maxHealth: 50, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50, endurance: 50 }, armorValues: new Array(7).fill(60) });
const poolRig = (extra = {}) => ({
  renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
  collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false, capsuleCast: () => ({ dist: Infinity, key: null }), sphereCast: () => ({ dist: Infinity, key: null }), move: (feet, mx, my, mz) => { feet[0] += mx; feet[2] += mz; return { grounded: true, hitCeiling: false, groundKey: 'floor' }; } },
  fetchBytes: async (n) => { if (n === 'MONSTER.BSA') return bsa; throw new Error(`no ${n} in this pin`); },
  getTexture: async () => stubTex, uploadRecordFrame: () => {},
  currentMinute: () => 0, currentPixelKey: () => '3,12',
  playerEntity: playerEntity(), audio: null, onPlayerHurt: () => {}, rolls: () => 0.01, rand: () => 0.01,
  ...extra,
});
const senses = (pe) => ({ candidates: () => [], playerEntity: pe, playerHeight: 1.8, playerCrouching: false, playerInvisible: false, movingLessThanHalfSpeed: true });

test('QUEST-POPUP-PAUSE executed: a pool handed the held frame (0) stands its hunter where it was and lands no blow; handed the frame again, it comes on', async () => {
  const pe = playerEntity();
  let hurts = 0;
  const pool = createExteriorFoes(poolRig({ playerEntity: pe, onPlayerHurt: () => { hurts++; } }));
  const rat = await pool.spawnFoe(0, [10, 0, 10], { feetGiven: true, yaw: -Math.PI / 2 });
  rat.ai.isHostile = true; rat.ai.detected = true;
  const me = [4, 0, 10];
  const frame = (dt, n) => { for (let i = 0; i < n; i++) pool.update(dt, me, [me[0], me[1] + 1.6, me[2]], senses(pe)); };
  const was = [...rat.ai.feet];
  frame(0, 120);   // two seconds of frames under the box
  assert.deepEqual(rat.ai.feet, was, 'held where it stood');
  assert.equal(hurts, 0);
  assert.equal(pe.health, 50, 'and the player untouched');
  frame(0.05, 60);   // the box closed: three seconds of play
  assert.ok(Math.hypot(rat.ai.feet[0] - was[0], rat.ai.feet[2] - was[2]) > 1, 'the hunt goes on');
});

test('QUEST-POPUP-PAUSE by source: both outdoor hosts ask the one rule of their own quest box, hand the held clock to both pools and the town\'s answer, and give the mode machine the same read for the interior pools', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /const _questBoxHoldsFoes = \(\) => questBoxHoldsFoes\(_questBoxWin, \{ online: onlineOn, onTop: _liveQuestOverlay \}\);/, 'world.js: its box, its slot, its page');
  assert.match(w, /const foeDt = _questBoxHoldsFoes\(\) \? 0 : dt;\n\s*livePersonBatches\.push\(\.\.\.cityGuards\.update\(foeDt,/, 'world.js: the watch');
  assert.match(w, /exteriorFoes\.update\(foeDt, _pf, cam\.pos, _foeSenses\(\)\);/, 'world.js: the encounter pool');
  assert.match(w, /if \(playerSpawned\) _townWatchFrame\(foeDt\);/, 'world.js: the town\'s answer runs on the pools\' clock');
  assert.match(w, /questBoxHoldsFoes: \(\) => _questBoxHoldsFoes\(\),/, 'world.js: the mode machine\'s bag');
  const e = rd('src/scenes/exterior.js');
  assert.match(e, /const _questBoxHoldsFoes = \(\) => questBoxHoldsFoes\(_questBoxWin, \{ online: isOnlinePage\(\), onTop: _liveQuestOverlay \}\);/, 'exterior.js: the same rule');
  assert.match(e, /const foeDt = _questBoxHoldsFoes\(\) \? 0 : dt;/, 'exterior.js: the held clock');
  assert.match(e, /exteriorFoes\.update\(foeDt,/, 'exterior.js: the encounter pool');
  assert.match(e, /questBoxHoldsFoes: \(\) => _questBoxHoldsFoes\(\),/, 'exterior.js: the mode machine\'s bag');
  const m = rd('src/scenes/worldModes.js');
  assert.match(m, /const foeDt = host\.questBoxHoldsFoes\?\.\(\) \? 0 : dt;/, 'worldModes.js: the host\'s read');
  assert.match(m, /interiorFoes\.update\(foeDt, /, 'the interior pool');
  assert.match(m, /interiorGuards\.update\(foeDt, /, 'the indoor watch');
  for (const [name, h] of [['world.js', w], ['exterior.js', e], ['worldModes.js', m]]) {
    assert.doesNotMatch(h, /(?:Foes|Guards)\.update\(dt,/, `${name}: no enemy pool bypasses the held clock`);
  }
});
