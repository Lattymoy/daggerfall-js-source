// WOD7 (2026-09-23, Mac: "and all the enemies are synced online?" ... "yes dude") - WORLD OF DAGGERFALL'S CAMPS,
// SHARED. The first player to spring a marker owns what it made: its foes ride that player's cell stream tagged
// with the marker's site, every reader stands them under an allowance of their own and spends its own copy of the
// marker, and two players who spring one marker at once are settled by id. The site law is world/wodShared.js; the
// pool's two halves are scenes/exteriorFoes.js; the host's are scenes/world.js (sliced through the audit's rig).

import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { wodSiteId, validSites, validSiteTags, yieldsTo, WOD_SITES_MAX, WOD_CAMP_PUPPETS_MAX, WOD_CLAIM_WINDOW_MS, WOD_AGE_MAX } from '../src/world/wodShared.js';
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
  assert.equal(wodSiteId(3, 12, 0, 1), '3,12:0.1', 'AUDIT WOD7: the second marker of an objectID a layout repeats (WOD_Nature_01\'s two bears, both 0)');
  assert.equal(wodSiteId(3, 12, 0, 0), '3,12:0');
  assert.deepEqual(validSites([['625,418:33', 5], ['625,418:33', 9], 'bad', ['1,2:hold', -3], ['1,2:x', 1], ['3,12:0.1', 1e12], ['4,4:1', NaN]]),
    [['625,418:33', 5], ['1,2:hold', 0], ['3,12:0.1', WOD_AGE_MAX]], 'valid, once each, the age clamped');
  assert.deepEqual(validSites('625,418:33'), []);
  assert.equal(validSites(Array.from({ length: 200 }, (_, i) => [`1,1:${i}`, i])).length, WOD_SITES_MAX);
  // every shipped layout, read: two repeat an objectID among their markers - the index covers them
  const V = join(ROOT, 'vendor/world-of-daggerfall/LocationPrefab');
  const dup = [];
  for (const f of readdirSync(V)) {
    const t = readFileSync(join(V, f), 'utf8');
    const ids = [...t.matchAll(/<name>(\d+\.\d+)<\/name>[\s\S]*?<objectID>(-?\d+)<\/objectID>/g)].filter((m) => /^(199|216|457|478|201)\./.test(m[1])).map((m) => m[2]);
    if (new Set(ids).size !== ids.length) dup.push(f);
  }
  assert.deepEqual(dup.sort(), ['WOD_Nature_01.txt', 'WOD_Ruins_04.txt'], 'two bears both 0; three warriors both 0');
  assert.deepEqual([...validSiteTags([[3, '1,1:5'], [-1, '1,1:6'], [4, 'nope'], [5], 'x', [6, '2,2:hold']])], [[3, '1,1:5'], [6, '2,2:hold']]);
  assert.ok(WOD_CAMP_PUPPETS_MAX > CELL_PUPPETS_MAX, 'a camp has room of its own beyond the encounter allowance');
});

test('WOD7: two players who spring one marker - the FIRST keeps it, the smaller id inside the claim window; both sides reach the same answer from the two ages', () => {
  assert.equal(yieldsTo('mmmm-0002', 'aaaa-0001', 100, 200), true, 'a tie inside the window: the smaller id keeps it');
  assert.equal(yieldsTo('aaaa-0001', 'mmmm-0002', 200, 100), false, '...and the smaller id, asked, keeps it');
  // AUDIT WOD7: ten seconds apart, the first spring keeps it whichever id is smaller - from both sides
  const first = 12000, second = 2000;
  assert.equal(yieldsTo('aaaa-0001', 'mmmm-0002', second, first), true, 'I sprang second: mine yields, though my id is smaller');
  assert.equal(yieldsTo('mmmm-0002', 'aaaa-0001', first, second), false, 'I sprang first: mine stands');
  assert.equal(yieldsTo('mmmm-0002', 'aaaa-0001', 100, null), false, 'an age not yet heard decides nothing');
  assert.equal(yieldsTo('mmmm-0002', 'mmmm-0002', 0, 0), false);
  assert.equal(yieldsTo('', 'aaaa-0001', 0, 0), false, 'offline, nothing yields');
  assert.ok(WOD_CLAIM_WINDOW_MS < first - second);
});

// ── the pool: the owner's half ──────────────────────────────────────────

test('WOD7: an owner\'s camp foes ride its stream tagged with their marker; a full frame names every marker it sprang; a placed foe WITHOUT a site still never rides', async () => {
  const A = createExteriorFoes(poolRig());
  A.setNet(netFor('aaaa-0001')); A.setOnSites(() => {}, () => [['3,12:99', 40]]);
  const foes = await camp(A, 10, '3,12:7');
  await A.spawnFoe(0, [3000, 0, 3000], { placed: true, groundAlign: { hitDist: 0.5 } });   // a placed foe of no site (the exterior host's Hold)
  const enc = [];
  for (let i = 0; i < 3; i++) enc.push(await A.spawnFoe(3, [10 + i, 0, 10], { feetGiven: true }));
  const frame = A.foesFrame(true);
  assert.deepEqual(frame.f.map((r) => r.i).sort((a, b) => a - b), [...foes, ...enc].map((f) => f.seq).sort((a, b) => a - b), 'the camp and the encounter; the siteless placed foe stays home (M1)');
  assert.deepEqual(new Map(frame.st), new Map(foes.map((f) => [f.seq, '3,12:7'])), 'each camp record carries its marker');
  assert.deepEqual(frame.sp, [['3,12:99', 40], ['3,12:7', WOD_AGE_MAX]], 'the full frame: the host\'s sprung list with its ages (newest first), then a live camp it no longer lists, as old');
  const delta = A.foesFrame(false);
  assert.equal(delta, null, 'nothing moved: no delta, no sprung list');
  // AUDIT WOD7: past WOD_SITES_MAX the frame keeps the NEWEST (the host's list comes newest first) - it sent the oldest 64 for ever
  const many = Array.from({ length: 70 }, (_, k) => [`5,5:${69 - k}`, k]);   // newest first
  A.setOnSites(() => {}, () => many);
  const big = A.foesFrame(true).sp;
  assert.equal(big.length, WOD_SITES_MAX);
  assert.deepEqual(big[0], ['5,5:69', 0], 'the newest spring rides');
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
  // AUDIT WOD7: a foe of that site still BUILDING when the race was lost ends as it lands - it never stands, never rides
  const late = await A.spawnFoe(0, [2100, 0, 2000], { placed: true, groundAlign: { hitDist: 0.5 }, site: '3,12:7' });
  assert.equal(late, null);
  assert.ok(!A.foesFrame(true).st?.some(([, s]) => s === '3,12:7'));
});

// ── the pool: the reader's half ─────────────────────────────────────────

test('WOD7: a reader stands an owner\'s camp under WOD_CAMP_PUPPETS_MAX, apart from the encounter\'s CELL_PUPPETS_MAX, and hears which markers the owner sprang', async () => {
  const A = createExteriorFoes(poolRig());
  A.setNet(netFor('aaaa-0001')); A.setOnSites(() => {}, () => [['3,12:99', 40]]);
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
  assert.deepEqual(heard, [['aaaa-0001', [['3,12:7', WOD_AGE_MAX], ['3,12:99', 40]]]], 'the host is told both, with their ages: the camp it sees and the treasure it does not');
  // AUDIT WOD7: a camp the allowance refused whole is NOT spent here - B's allowance for A is full, so A's next camp stands
  // nowhere at B, and B's own marker for it must stay B's to spring
  await camp(A, 3, '3,14:2', 2600);
  heard.length = 0;
  B.applyFoes('aaaa-0001', JSON.parse(JSON.stringify(A.foesFrame(true))));
  await flush();
  assert.equal(B.foes.filter((f) => f.site === '3,14:2').length, 0, 'refused');
  assert.ok(!heard[0][1].some(([s]) => s === '3,14:2'), 'and not spent');
  assert.ok(heard[0][1].some(([s]) => s === '3,12:7'), 'the camp it does stand, still spent');
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
    `${WORLD.slice(i, j)}\nreturn { wodSprang, wodPeerSites, wodSiteOf, sprung: _wodSprung, peer: _wodPeerSprung, changed: () => _wodSprungChanged, list: wodSprungList, forget: wodForgetPeerSites };`)(
    id ? { id } : null, { now: () => clock }, { removeSiteFoes: (s) => removed.push(s) }, wodSiteId, yieldsTo);
  const off = mk(null);
  off.wodSprang('1,1:1');
  assert.equal(off.sprung.size, 0, 'offline: nothing recorded, nothing rides');
  const me = mk('mmmm-0002');
  assert.equal(me.wodSiteOf({ px: 3, py: 12 }, { oid: 7 }), '3,12:7');
  assert.equal(me.wodSiteOf({ px: 3, py: 12 }, { oid: 0, oidN: 1 }), '3,12:0.1', 'AUDIT WOD7: a repeated objectID\'s second marker');
  me.wodSprang('3,12:7'); me.wodSprang('3,12:8');
  assert.ok(me.changed(), 'a new spring asks for a full frame');
  me.wodPeerSites('aaaa-0001', [['3,12:7', 0], ['3,12:9', 0]]);
  assert.deepEqual(removed, ['3,12:7'], 'a tie inside the window, a smaller id: my camp comes down');
  assert.deepEqual([...me.sprung.keys()], ['3,12:8']);
  assert.deepEqual([...me.peer].sort(), ['3,12:7', '3,12:9']);
  me.wodPeerSites('zzzz-0009', [['3,12:8', 0]]);
  assert.deepEqual(removed, ['3,12:7'], 'a larger id: mine stands (theirs yields at their end)');
  assert.ok(!me.peer.has('3,12:8'));
  me.wodPeerSites('aaaa-0001', [['3,12:8', null]]);
  assert.ok(me.sprung.has('3,12:8'), 'a tag without an age decides nothing yet');
  clock = WOD_CLAIM_WINDOW_MS * 2;
  me.wodSprang('3,12:10'); clock += WOD_CLAIM_WINDOW_MS * 2;
  me.wodPeerSites('aaaa-0001', [['3,12:10', 0]]);
  assert.ok(me.sprung.has('3,12:10') && !removed.includes('3,12:10'), 'AUDIT WOD7: I sprang first: mine stands, whatever the ids');
  me.wodPeerSites('zzzz-0009', [['3,12:10', WOD_CLAIM_WINDOW_MS * 5]]);
  assert.ok(removed.includes('3,12:10'), '...and a peer who sprang it before me takes it, whatever the ids');
  // newest first, bounded
  for (let k = 0; k < 300; k++) { clock += 1; me.wodSprang(`9,9:${k}`); }
  assert.equal(me.sprung.size, 256, 'bounded: the oldest go first');
  assert.equal(me.list()[0][0], '9,9:299', 'the frame\'s list is newest first');
  // a fresh promote forgets a peer's springs on that pixel
  me.wodPeerSites('aaaa-0001', [['4,4:1', 0], ['4,40:1', 0]]);
  me.forget('4,4');
  assert.ok(!me.peer.has('4,4:1') && me.peer.has('4,40:1'), 'that pixel\'s alone');
  // the frame and the tick, by source
  assert.match(WORLD, /if \(_wodPeerSprung\.has\(wodSiteOf\(p, w\)\)\) \{ w\.spawner\.active = false; continue; \}/, 'a peer\'s marker never springs here');
  assert.match(WORLD, /if \(act\) \{ standWodAction\(p, w, act, x, y, z\); if \(act\.kind === 'foe' \|\| act\.kind === 'loot'\) wodSprang\(wodSiteOf\(p, w\)\); \}/, 'a foe or a treasure makes the marker mine; a captive\'s flat is each player\'s own');
  assert.match(WORLD, /if \(_wodPeerSprung\.has\(hs\)\) p\.privateersHold\.state\.rolled = true;[^\n]*\n\s*else \{ standHold\(p, hs\); wodSprang\(hs\); \}/, 'the Hold\'s camp too');
  assert.match(WORLD, /if \(_wodSprungChanged\) \{ _wodSprungChanged = false; _foesFullAt = -Infinity; \}/, 'the stream sends it whole at once');
  const EF = rd('src/scenes/exteriorFoes.js');
  assert.match(EF, /        site: f\.site \?\? null,/, 'a camp foe\'s site rides the save...');
  assert.match(EF, /        if \(typeof sf\.site === 'string'\) f\.site = sf\.site;/, '...and comes back with it, so a loaded camp still rides');
  assert.match(WORLD, /exteriorFoes\.setOnSites\(\(from, sites\) => wodPeerSites\(from, sites\), wodSprungList\);/);
  assert.match(WORLD, /if \(!wodKept\.life\) wodForgetPeerSites\(key\);/, 'a fresh promote forgets them');
  assert.match(WORLD, /const n = oidSeen\.get\(s\.objectID\) \?\? 0; oidSeen\.set\(s\.objectID, n \+ 1\);\n\s*wodSpawners\.push\(\{[^\n]*oid: s\.objectID, oidN: n \}\);/, 'the index among the pixel\'s alike');
});
