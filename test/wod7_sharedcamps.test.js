// WOD7 (2026-09-23, Mac: "and all the enemies are synced online?" ... "yes dude") - WORLD OF DAGGERFALL'S CAMPS,
// SHARED. The first player to spring a marker owns what it made: its foes ride that player's cell stream tagged
// with the marker's site, every reader stands them under an allowance of their own and spends its own copy of the
// marker, and two players who spring one marker at once are settled by id. The site law is world/wodShared.js; the
// pool's two halves are scenes/exteriorFoes.js; the host's are scenes/world.js (sliced through the audit's rig).

import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { wodSiteId, validSites, validSiteTags, yieldsTo, WOD_SITES_MAX, WOD_CAMP_PUPPETS_MAX, WOD_CLAIM_WINDOW_MS } from '../src/world/wodShared.js';
import { createExteriorFoes } from '../src/scenes/exteriorFoes.js';
import { CELL_PUPPETS_MAX } from '../src/net/wire.js';
import { isPeerTarget } from '../src/characters/enemyTargets.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
const WORLD = rd('src/scenes/world.js');
const tick = () => new Promise((r) => setTimeout(r, 0));
const flush = async () => { for (let i = 0; i < 6; i++) await tick(); };

// ── the pool's rig (the audit's own shape) ──────────────────────────────

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
const bsa = craftMonsterBsa([['ENEMY000.CFG', craftCfg()], ['ENEMY003.CFG', craftCfg({ speed: 60 })]]);
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 1 };
const playerEntity = () => ({ level: 1, reflexes: 2, health: 50, maxHealth: 50, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50, endurance: 50 }, armorValues: new Array(7).fill(60) });
const poolRig = (extra = {}) => ({
  renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
  collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false, capsuleCast: () => ({ dist: Infinity, key: null }), sphereCast: () => ({ dist: Infinity, key: null }), move: (feet, mx, my, mz) => { feet[0] += mx; feet[2] += mz; return { grounded: true, hitCeiling: false, groundKey: 'floor' }; } },
  fetchBytes: async (n) => { if (n === 'MONSTER.BSA') return bsa; throw new Error(`no ${n} in this pin`); },
  getTexture: async () => stubTex,
  uploadRecordFrame: () => {}, currentMinute: () => 0, currentPixelKey: () => '3,12',
  playerEntity: playerEntity(), audio: null, onPlayerHurt: () => {}, rolls: () => 0.01, rand: () => 0.01, ...extra,
});
const netFor = (id, peers = { list: [] }) => ({ room: () => 'world:3,12', selfId: () => id, peers: () => peers.list, now: () => 0, staleMs: 0, onPeerHit: (h, fate) => { fate?.sent?.(); return true; }, toWire: (f) => [f[0], f[1], f[2]], toScene: (p) => [p[0], p[1], p[2]] });
const senses = (pe) => ({ candidates: () => [], playerEntity: pe, playerHeight: 1.8, playerCrouching: false, playerInvisible: false, movingLessThanHalfSpeed: true });
const camp = async (pool, n, site, x0 = 2000) => { const out = []; for (let i = 0; i < n; i++) out.push(await pool.spawnFoe(0, [x0 + i * 5, 0, 2000], { placed: true, groundAlign: { hitDist: 0.5 }, site })); return out; };

// ── the site law ────────────────────────────────────────────────────────

test('WOD7: a marker\'s site is the pixel and its objectID (or the Hold) - every client names it alike; frames name at most WOD_SITES_MAX, projected', () => {
  assert.equal(wodSiteId(625, 418, 33), '625,418:33');
  assert.equal(wodSiteId(-1, 7, 'hold'), '-1,7:hold');
  assert.deepEqual(validSites(['625,418:33', '625,418:33', 'bad', 7, '1,2:hold', '1,2:x']), ['625,418:33', '1,2:hold'], 'valid, once each');
  assert.deepEqual(validSites('625,418:33'), []);
  assert.equal(validSites(Array.from({ length: 200 }, (_, i) => `1,1:${i}`)).length, WOD_SITES_MAX);
  assert.deepEqual([...validSiteTags([[3, '1,1:5'], [-1, '1,1:6'], [4, 'nope'], [5], 'x', [6, '2,2:hold']])], [[3, '1,1:5'], [6, '2,2:hold']]);
  assert.ok(WOD_CAMP_PUPPETS_MAX > CELL_PUPPETS_MAX, 'a camp has room of its own beyond the encounter allowance');
});

test('WOD7: two players who spring one marker at once are settled by id - the smaller keeps it, inside the claim window; past it both camps stand', () => {
  assert.equal(yieldsTo('mmmm-0002', 'aaaa-0001', 0, 100), true, 'the peer\'s id is smaller: mine yields');
  assert.equal(yieldsTo('aaaa-0001', 'mmmm-0002', 0, 100), false, 'mine is smaller: theirs yields at their end');
  assert.equal(yieldsTo('mmmm-0002', 'aaaa-0001', 0, WOD_CLAIM_WINDOW_MS + 1), false, 'a fight already begun is never taken');
  assert.equal(yieldsTo('mmmm-0002', 'mmmm-0002', 0, 0), false);
  assert.equal(yieldsTo('', 'aaaa-0001', 0, 0), false, 'offline, nothing yields');
});

// ── the pool: the owner's half ──────────────────────────────────────────

test('WOD7: an owner\'s camp foes ride its stream tagged with their marker; a full frame names every marker it sprang; a placed foe WITHOUT a site still never rides', async () => {
  const A = createExteriorFoes(poolRig());
  A.setNet(netFor('aaaa-0001')); A.setOnSites(() => {}, () => ['3,12:99']);
  const foes = await camp(A, 10, '3,12:7');
  await A.spawnFoe(0, [3000, 0, 3000], { placed: true, groundAlign: { hitDist: 0.5 } });   // a placed foe of no site (the exterior host's Hold)
  const enc = [];
  for (let i = 0; i < 3; i++) enc.push(await A.spawnFoe(3, [10 + i, 0, 10], { feetGiven: true }));
  const frame = A.foesFrame(true);
  assert.deepEqual(frame.f.map((r) => r.i).sort((a, b) => a - b), [...foes, ...enc].map((f) => f.seq).sort((a, b) => a - b), 'the camp and the encounter; the siteless placed foe stays home (M1)');
  assert.deepEqual(new Map(frame.st), new Map(foes.map((f) => [f.seq, '3,12:7'])), 'each camp record carries its marker');
  assert.deepEqual(frame.sp.sort(), ['3,12:7', '3,12:99'], 'the full frame: my live camps\' sites and the host\'s sprung list (a treasure I took)');
  const delta = A.foesFrame(false);
  assert.equal(delta, null, 'nothing moved: no delta, no sprung list');
});

test('WOD7: a shared camp\'s foe hunts the peers as an encounter\'s does - a siteless placed foe still does not', async () => {
  const run = async (site) => {
    const peers = { list: [{ id: 'bob-0002', feet: [12, 0, 10], height: 1.8 }] };
    const pe = playerEntity();
    const pool = createExteriorFoes(poolRig({ playerEntity: pe }));
    pool.setNet(netFor('mac-0001', peers));
    const f = await pool.spawnFoe(0, [10, 0, 10], { yaw: Math.PI / 2, placed: true, groundAlign: { hitDist: 0.5 }, site });
    f.ai.isHostile = true; f.ai.detected = true;
    const me = [80, 0, 80];
    for (let i = 0; i < 40; i++) pool.update(0.05, me, [me[0], me[1] + 1.6, me[2]], senses(pe));
    return f.ai.target;
  };
  assert.ok(isPeerTarget(await run('3,12:7')), 'the camp\'s foe takes Bob, beside it');
  assert.ok(!isPeerTarget(await run(null)), 'the siteless one does not');
});

test('WOD7: removeSiteFoes takes down my foes of that site alone - a race lost', async () => {
  const A = createExteriorFoes(poolRig());
  A.setNet(netFor('aaaa-0001'));
  await camp(A, 3, '3,12:7');
  await camp(A, 2, '3,12:8', 2500);
  A.removeSiteFoes('3,12:7');
  await flush();
  assert.deepEqual(A.foes.filter((f) => !f.dead && !f._removed).map((f) => f.site).filter(Boolean).sort(), ['3,12:8', '3,12:8']);
});

// ── the pool: the reader's half ─────────────────────────────────────────

test('WOD7: a reader stands an owner\'s camp under WOD_CAMP_PUPPETS_MAX, apart from the encounter\'s CELL_PUPPETS_MAX, and hears which markers the owner sprang', async () => {
  const A = createExteriorFoes(poolRig());
  A.setNet(netFor('aaaa-0001')); A.setOnSites(() => {}, () => ['3,12:99']);
  await camp(A, WOD_CAMP_PUPPETS_MAX + 4, '3,12:7');
  const enc = [];
  for (let i = 0; i < CELL_PUPPETS_MAX; i++) enc.push(await A.spawnFoe(3, [10 + i, 0, 10], { feetGiven: true }));
  const frame = JSON.parse(JSON.stringify(A.foesFrame(true)));   // through the wire's JSON
  const B = createExteriorFoes(poolRig());
  B.setNet(netFor('bbbb-0002'));
  const heard = [];
  B.setOnSites((from, sites) => heard.push([from, [...sites].sort()]));
  B.applyFoes('aaaa-0001', frame);
  await flush();
  const pups = B.foes.filter((f) => f.puppet === 'aaaa-0001' && !f.dead);
  assert.equal(pups.filter((f) => f.site === '3,12:7').length, WOD_CAMP_PUPPETS_MAX, 'the camp, under its own allowance');
  assert.equal(pups.filter((f) => !f.site).length, CELL_PUPPETS_MAX, 'and every encounter foe still stands beside it - the bug M1 kept the camps home for');
  assert.deepEqual(heard, [['aaaa-0001', ['3,12:7', '3,12:99']]], 'the host is told both: the camp it sees and the treasure it does not');
  // a record whose tag is garbage is an ordinary record, under the ordinary allowance
  const C = createExteriorFoes(poolRig()); C.setNet(netFor('cccc-0003'));
  C.applyFoes('aaaa-0001', { ...frame, st: frame.st.map(([i]) => [i, 'not a site']) });
  await flush();
  assert.equal(C.foes.filter((f) => f.puppet && !f.dead).length, CELL_PUPPETS_MAX);
});

// ── the host ────────────────────────────────────────────────────────────

test('WOD7: the host - a marker I spring is recorded and asks for a full frame; a marker a peer sprang never springs here; a race is settled by id, the loser taking its camp down', () => {
  const i = WORLD.indexOf('  const _wodSprung = new Map();');
  const j = WORLD.indexOf('  /** WOD6: SaveLoadManager.OnLoad', i);
  assert.ok(i > 0 && j > i);
  const removed = [];
  let clock = 0;
  const mk = (id) => new Function('online', 'performance', 'exteriorFoes', 'wodSiteId', 'yieldsTo',
    `${WORLD.slice(i, j)}\nreturn { wodSprang, wodPeerSites, wodSiteOf, sprung: _wodSprung, peer: _wodPeerSprung, changed: () => _wodSprungChanged };`)(
    id ? { id } : null, { now: () => clock }, { removeSiteFoes: (s) => removed.push(s) }, wodSiteId, yieldsTo);
  const off = mk(null);
  off.wodSprang('1,1:1');
  assert.equal(off.sprung.size, 0, 'offline: nothing recorded, nothing rides');
  const me = mk('mmmm-0002');
  assert.equal(me.wodSiteOf({ px: 3, py: 12 }, { oid: 7 }), '3,12:7');
  me.wodSprang('3,12:7'); me.wodSprang('3,12:8');
  assert.ok(me.changed(), 'a new spring asks for a full frame');
  me.wodPeerSites('aaaa-0001', ['3,12:7', '3,12:9']);
  assert.deepEqual(removed, ['3,12:7'], 'raced by a smaller id inside the window: my camp comes down');
  assert.deepEqual([...me.sprung.keys()], ['3,12:8']);
  assert.deepEqual([...me.peer].sort(), ['3,12:7', '3,12:9']);
  me.wodPeerSites('zzzz-0009', ['3,12:8']);
  assert.deepEqual(removed, ['3,12:7'], 'raced by a larger id: mine stands (theirs yields at their end)');
  assert.ok(!me.peer.has('3,12:8'));
  clock = WOD_CLAIM_WINDOW_MS * 2;
  me.wodSprang('3,12:10'); clock += WOD_CLAIM_WINDOW_MS + 1;
  me.wodPeerSites('aaaa-0001', ['3,12:10']);
  assert.ok(me.sprung.has('3,12:10') && !removed.includes('3,12:10'), 'past the window both stand');
  // the frame and the tick, by source
  assert.match(WORLD, /if \(_wodPeerSprung\.has\(wodSiteOf\(p, w\)\)\) \{ w\.spawner\.active = false; continue; \}/, 'a peer\'s marker never springs here');
  assert.match(WORLD, /if \(act\) \{ standWodAction\(p, w, act, x, y, z\); if \(act\.kind === 'foe' \|\| act\.kind === 'loot'\) wodSprang\(wodSiteOf\(p, w\)\); \}/, 'a foe or a treasure makes the marker mine; a captive\'s flat is each player\'s own');
  assert.match(WORLD, /if \(_wodPeerSprung\.has\(hs\)\) p\.privateersHold\.state\.rolled = true;[^\n]*\n\s*else \{ standHold\(p, hs\); wodSprang\(hs\); \}/, 'the Hold\'s camp too');
  assert.match(WORLD, /if \(_wodSprungChanged\) \{ _wodSprungChanged = false; _foesFullAt = -Infinity; \}/, 'the stream sends it whole at once');
  const EF = rd('src/scenes/exteriorFoes.js');
  assert.match(EF, /        site: f\.site \?\? null,/, 'a camp foe\'s site rides the save...');
  assert.match(EF, /        if \(typeof sf\.site === 'string'\) f\.site = sf\.site;/, '...and comes back with it, so a loaded camp still rides');
  assert.match(WORLD, /exteriorFoes\.setOnSites\(\(from, sites\) => wodPeerSites\(from, sites\), \(\) => \[\.\.\._wodSprung\.keys\(\)\]\);/);
});
