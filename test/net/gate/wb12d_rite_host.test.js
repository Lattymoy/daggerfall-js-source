// AUDIT WB12d (2026-10-02, Mac: "Audit this. Its needs to be detailed and perfection. AAA grade"): THE FAITHFUL ON THE
// CAMPS' LAW, END TO END - the real exteriorFoes pool, the world host's own WOD7 law sliced from scenes/world.js (the
// WOD7 pin's own way), and the real rite host on the world's deps: a teleport and back, an owner who leaves, a race and
// its winner gone, a handover, a save and its load, a Wabbajack, the opening - bible/11-Multiplayer/World-Bosses.md
// section 19 D, AUDIT WB12d C1, C2, C3, C5, C11.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createExteriorFoes, siteFoeSpawn, carrySiteFoe, CAMP_CULL_DISTANCE } from '../../../src/scenes/exteriorFoes.js';
import { createRiteHost, RITE_ORPHAN_MS, RITE_SPRING_M, RITE_SIGHT_M, RITE_ALERT_M, RITE_TEXT } from '../../../src/scenes/riteHost.js';
import { riteLocalOf, riteFaithfulOf, RITE_SUMMONER_CAREER, RITE_SUMMONER_HEALTH } from '../../../src/net/gate/gateRite.js';
import { gateTimes } from '../../../src/net/gate/gateLaw.js';
import { riteSiteId, wodSiteId, yieldsTo } from '../../../src/world/worldOfDaggerfall/wodShared.js';
import { renownStruckAt } from '../../../src/net/renownTracker.js';
import { restoreModSaveRecords, modSaveRecords } from '../../../src/systems/modSaveData.js';
import { RITE_DAY_SAVE_VENDOR } from '../../../src/systems/riteChest.js';

const WORLD = readFileSync(new URL('../../../src/scenes/world.js', import.meta.url), 'utf8');
const DAY = 700, T = gateTimes(DAY), PX = 300, PY = 200;
const SITE = { day: DAY, px: PX, py: PY, place: 'Copperham, Wrothgarian Mountains', near: 'Copperham' };
const SITE_ID = riteSiteId(PX, PY, DAY);
const [E, N] = riteLocalOf(DAY);
const FAITHFUL = riteFaithfulOf(DAY);
const settle = async () => { for (let i = 0; i < 12; i++) await new Promise((r) => setImmediate(r)); };

// ── the pool's rig (WOD7's) ──
function craftCfg() {
  const b = new Uint8Array(74); const v = new DataView(b.buffer);
  b[10] = 0x08; v.setUint16(52, 4, true);
  const attrs = [40, 50, 50, 85, 50, 50, 90, 55];
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
const playerEntity = () => ({ isPlayer: true, level: 10, reflexes: 2, health: 50, maxHealth: 50, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50, endurance: 50 }, armorValues: new Array(7).fill(60) });
const pool = () => createExteriorFoes({
  renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
  collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false, capsuleCast: () => ({ dist: Infinity, key: null }), sphereCast: () => ({ dist: Infinity, key: null }), move: (feet, mx, my, mz) => { feet[0] += mx; feet[2] += mz; return { grounded: true, hitCeiling: false, groundKey: 'floor' }; } },
  fetchBytes: async (n) => { if (n === 'MONSTER.BSA') return bsa; if (/^CLASS\d\d\.CFG$/.test(n)) return craftCfg(); throw new Error(`no ${n} in this pin`); },
  getTexture: async () => stubTex, uploadRecordFrame: () => {},
  currentMinute: () => 0, currentPixelKey: () => `${PX},${PY}`,
  playerEntity: playerEntity(), audio: null, onPlayerHurt: () => {}, rolls: () => 0.01, rand: () => 0.01,
});
const netFor = (id) => ({ room: () => 'world:18,12', inRoom: () => true, selfId: () => id, peers: () => [], now: () => 0, staleMs: 0, onPeerHit: (h, fate) => { fate?.sent?.(); return true; }, toWire: (f) => [f[0], f[1], f[2]], toScene: (p) => [p[0], p[1], p[2]] });

/** The world host's WOD7 law, sliced (scenes/world.js), on this pin's clock. */
function wodLaw(id, foes, clock) {
  const i = WORLD.indexOf('  const _wodSprung = new Map();');
  const j = WORLD.indexOf('  /** WOD6: SaveLoadManager.OnLoad', i);
  assert.ok(i > 0 && j > i, 'the law sliced');
  return new Function('online', 'performance', 'exteriorFoes', 'wodSiteId', 'yieldsTo',
    `${WORLD.slice(i, j)}\nreturn { wodSprang, wodPeerSites, wodSprungList, sprung: _wodSprung, peer: _wodPeerSprung, heldAgo: wodPeerHeldAgo, forgetPeer: wodForgetPeer, unsprang: wodUnsprang };`)(
    { id }, { now: clock }, foes, wodSiteId, yieldsTo);
}

/** A client: the real pool, the world's law, the real rite host on the world's deps (scenes/world.js createRiteHost). */
function client(id, { clock = { t: T.omenAt + 60_000 } } = {}) {
  let feetAt = null;
  const p = pool();
  p.setNet(netFor(id));
  const wod = wodLaw(id, p, () => clock.t);
  p.setOnSites((from, sites) => wod.wodPeerSites(from, sites), wod.wodSprungList);
  const c = { id, pool: p, wod, clock, words: [], said: [], near: [] };
  c.host = createRiteHost({
    now: () => clock.t, omen: () => ({ site: SITE }), pixelTranslation: () => [0, 0, 0], groundAt: () => 0, feet: () => feetAt, online: () => true,
    foes: {
      spawn: (career, [x, z], { yaw, site, transient }) => p.spawnFoe(career, [x, 0, z], { yaw, placed: true, groundAlign: { hitDist: 0.2 }, site, transient }),
      list: () => p.foes, drop: (s) => p.dropSiteFoes(s), remove: (f) => p.removeFoe(f), reclaim: (s) => p.reclaimSite(s), campId: () => p.newCampId(),
    },
    peerSprang: (s) => wod.peer.has(s), peerHeldAgo: (s) => wod.heldAgo(s), forgetPeer: (s) => wod.forgetPeer(s),
    sprang: (s) => wod.wodSprang(s), unsprang: (s) => wod.unsprang(s), struckAt: (f) => renownStruckAt(f),
    send: (w, cell) => { c.words.push({ ...w, cell }); return true; }, say: (t) => c.said.push(t), sayNear: (t) => c.near.push(t),
  });
  c.at = (m) => { feetAt = m == null ? null : [E + m, 0, N]; };
  c.site = () => p.foes.filter((f) => f.site === SITE_ID);
  c.live = () => c.site().filter((f) => !f.dead);
  c.own = () => c.live().filter((f) => !f.puppet);
  c.copies = () => c.live().filter((f) => f.puppet);
  c.beat = async () => { c.host.frame(); await settle(); c.host.frame(); };
  c.kill = (f) => p.damageFoe(f, 99999, [E, 0, N]);
  /** my full frame heard by `o` */
  c.tell = async (o) => { o.pool.applyFoes(c.id, c.pool.foesFrame(true)); await settle(); };
  return c;
}
const careers = (fs) => fs.map((f) => f.mobileType).sort((a, b) => a - b);
const fresh = () => restoreModSaveRecords({});

test('AUDIT WB12d (C1): a teleport and back - the site never given away: the survivors stand again, the two slain do not, and the site is said again (mutants: the site poisoned on leaving; every one stood again)', async () => {
  fresh();
  const A = client('aaaa-0001');
  A.at(50); await A.beat();
  assert.equal(A.own().length, FAITHFUL.length, 'sprung');
  const slain = A.own().filter((f) => f.mobileType !== RITE_SUMMONER_CAREER).slice(0, 2);
  for (const f of slain) A.kill(f);
  await A.beat();
  // the teleport, in scenes/world.js's order: the pools swept, the circle let go
  A.pool.clearLive(); A.host.destroyAll();
  assert.equal(A.wod.sprung.has(SITE_ID), false, 'let go: my frames no longer say it is mine');
  A.at(5000); await A.beat();
  assert.equal(A.own().length, 0, 'away: nothing stands');
  A.at(50); await A.beat();
  const want = FAITHFUL.map((m) => m.career);
  for (const f of slain) want.splice(want.indexOf(f.mobileType), 1);
  assert.deepEqual(careers(A.own()), want.sort((a, b) => a - b), 'the survivors, the Summoner among them');
  assert.ok(A.wod.sprung.has(SITE_ID), 'said to be mine again');
  assert.ok(A.own().every((f) => f.transient), 'in no save');
  // and a shared camp's site a race gave away is the old world's once a teleport has swept it (the camps have no reclaim)
  const camp = wodSiteId(PX, PY, 7);
  A.pool.removeSiteFoes(camp);
  const lost = await A.pool.spawnFoe(0, [E + 40, 0, N], { placed: true, groundAlign: { hitDist: 0.2 }, site: camp });
  assert.equal(lost, null, 'lost: a stand of it ends as it lands');
  A.pool.clearLive();
  const back = await A.pool.spawnFoe(0, [E + 40, 0, N], { placed: true, groundAlign: { hitDist: 0.2 }, site: camp });
  assert.ok(back && !back.dead, 'after the sweep it stands');
  fresh();
});

test('AUDIT WB12d (C1, C5): the Summoner fallen is never stood again - not after a teleport, not after a reload of the save that saw it; the word still says it (mutants: a fallen Summoner stood again; the memory unsaved)', async () => {
  fresh();
  const A = client('aaaa-0001');
  A.at(30); await A.beat();
  const sum = A.own().find((f) => f.mobileType === RITE_SUMMONER_CAREER);
  assert.equal(sum.entity.maxHealth % RITE_SUMMONER_HEALTH, 0);
  A.kill(sum); await A.beat();
  assert.equal(A.words.at(-1).f, 1, 'his fall said');
  const saved = modSaveRecords()[RITE_DAY_SAVE_VENDOR];
  assert.equal(saved.fell, 1);
  // a new page, the save loaded
  fresh(); restoreModSaveRecords({ [RITE_DAY_SAVE_VENDOR]: saved });
  const B = client('aaaa-0001');
  B.at(30); await B.beat();
  assert.equal(B.own().length, FAITHFUL.length - 1);
  assert.ok(!B.own().some((f) => f.mobileType === RITE_SUMMONER_CAREER), 'no second Summoner');
  assert.equal(B.words.at(-1).f, 1, 'the fall still said');
  fresh();
});

test('AUDIT WB12d (C2): an owner who leaves - their copies gone, their word quiet for RITE_ORPHAN_MS - leaves the survivors to the player at the circle, the ones they saw fall excepted (mutants: never stood again; stood while the owner still speaks)', async () => {
  fresh();
  const clock = { t: T.omenAt + 60_000 };
  const A = client('aaaa-0001', { clock }), B = client('bbbb-0002', { clock });
  A.at(50); await A.beat();
  await A.tell(B);
  B.at(20); await B.beat();
  assert.equal(B.copies().length, FAITHFUL.length, 'B sees A\'s');
  assert.equal(B.own().length, 0, 'and stands none of its own');
  const one = A.own().find((f) => f.mobileType !== RITE_SUMMONER_CAREER);
  A.kill(one);
  await A.tell(B); await B.beat();
  assert.equal(B.copies().length, FAITHFUL.length - 1, 'B saw one fall');
  // A's tab closes: B's session drops A, its copies with it
  B.pool.pruneOwners(new Set());
  clock.t += RITE_ORPHAN_MS - 1000; await B.beat();
  assert.equal(B.own().length, 0, 'A spoke less than RITE_ORPHAN_MS ago: B waits');
  clock.t += 2000; await B.beat();
  assert.equal(B.own().length, FAITHFUL.length - 1, 'the survivors are B\'s');
  assert.ok(B.wod.sprung.has(SITE_ID) && !B.wod.peer.has(SITE_ID), 'B\'s now, and said to be');
  fresh();
});

test('AUDIT WB12d (C2): a race lost, and its winner gone - the loser stands them after all (the site the race gave away taken back) (mutants: the site never reclaimed)', async () => {
  fresh();
  const clock = { t: T.omenAt + 60_000 };
  const A = client('aaaa-0001', { clock }), B = client('bbbb-0002', { clock });
  A.at(50); B.at(-50);
  A.host.frame(); B.host.frame(); await settle();
  await A.tell(B); await B.tell(A);
  await A.tell(B); await B.tell(A);
  await A.beat(); await B.beat();
  assert.equal(A.own().length, FAITHFUL.length, 'the smaller id keeps them');
  assert.equal(B.own().length, 0, 'the other\'s came down');
  assert.equal(B.copies().length, FAITHFUL.length);
  B.pool.pruneOwners(new Set());
  clock.t += RITE_ORPHAN_MS + 1; await B.beat(); await settle(); await B.beat();
  assert.equal(B.own().length, FAITHFUL.length, 'B stands them - its lost site taken back');
  fresh();
});

test('AUDIT WB12d (C3): taken over, the faithful stay the rite\'s - where they stood (placed, past any relevance cull), chanting (sight 12, one woken wakes them within 30 m), one camp; the world hands a site\'s foes only within a camp\'s cull distance (mutants: adopted unplaced; the chant lost; a far heir)', async () => {
  fresh();
  const clock = { t: T.omenAt + 60_000 };
  const A = client('aaaa-0001', { clock }), B = client('bbbb-0002', { clock });
  A.at(50); await A.beat();
  await A.tell(B);
  const hand = A.pool.handOverFrame((f) => (f.site === SITE_ID ? 'bbbb-0002' : null));
  assert.equal(A.pool.dropOwnLive(), FAITHFUL.length);
  B.pool.applyFoes('aaaa-0001', hand); await settle();
  B.at(30); await B.beat();
  const mine = B.own();
  assert.equal(mine.length, FAITHFUL.length, 'B took them');
  assert.ok(mine.every((f) => f.placed), 'placed');
  assert.ok(mine.every((f) => f.ai.sightRadius === RITE_SIGHT_M && f.campAlertRadius === RITE_ALERT_M), 'chanting');
  assert.equal(new Set(mine.map((f) => f.campId)).size, 1, 'one camp');
  assert.ok(mine.every((f) => f.riteRole === (f.mobileType === RITE_SUMMONER_CAREER ? 'summoner' : 'faithful')));
  assert.equal(B.host.state().spawned, true, 'B holds them as if it had stood them');
  clock.t += RITE_ORPHAN_MS * 2; await B.beat();
  assert.equal(B.own().length, FAITHFUL.length, 'A long quiet: B holds them, and stands no second set');
  B.pool.update(0.05, [E + 600, 0, N], [E + 600, 1.6, N]);
  assert.equal(B.own().length, FAITHFUL.length, 'a player 600 m off culls none');
  // the world's two heirs for a site's foe: within CAMP_CULL_DISTANCE of it alone
  assert.match(WORLD, /let id = null, best = f\.site \? CAMP_CULL_DISTANCE : Infinity;/);
  const i = WORLD.indexOf('  const handOverSiteFoes = () => {');
  const j = WORLD.indexOf('\n  };', i) + 4;
  const sent = [];
  const far = { id: 'far-0001', feet: [E + CAMP_CULL_DISTANCE + 30, 0, N] }, nearby = { id: 'near-0002', feet: [E + CAMP_CULL_DISTANCE - 30, 0, N] };
  let peers = [far];
  const handOverSiteFoes = new Function('online', 'isCellRoom', 'modes', 'peersNear', 'exteriorFoes', 'CAMP_CULL_DISTANCE', `${WORLD.slice(i, j)}\nreturn handOverSiteFoes;`)(
    { room: 'world:18,12', sendFoes: (fr) => { sent.push(fr); return true; } }, () => true, { mode: 'exterior' }, () => peers, B.pool, CAMP_CULL_DISTANCE);
  assert.equal(handOverSiteFoes(), 0, 'a player past a camp\'s cull distance takes none');
  assert.equal(sent.length, 0);
  peers = [far, nearby];
  const walker = await B.pool.spawnFoe(0, [E, 0, N + 5], { feetGiven: true });
  assert.equal(handOverSiteFoes(), FAITHFUL.length, 'the faithful went at the teleport');
  const heirs = sent[0].f.filter((r) => r.e).map((r) => r.e);
  assert.ok(heirs.length === FAITHFUL.length && heirs.every((e) => e === 'near-0002'), 'to the one within reach of them');
  assert.ok(B.pool.foes.includes(walker) && !walker.dead, 'a wanderer goes with me');
  fresh();
});

test('AUDIT WB12d (C5): the faithful are in no save - and a save from before that held them stands none of them (mutants: saved; restored)', async () => {
  fresh();
  const A = client('aaaa-0001');
  A.at(30); await A.beat();
  const camp = await A.pool.spawnFoe(0, [E + 40, 0, N], { placed: true, groundAlign: { hitDist: 0.2 }, site: wodSiteId(PX, PY, 7) });
  const saved = A.pool.snapshotWorld((p) => ({ x: p[0], z: p[2] }));
  assert.deepEqual(saved.map((s) => s.site), [camp.site], 'a camp\'s foe saved; the faithful not');
  const B = client('aaaa-0001');
  const old = { ...saved[0], site: `${PX},${PY}:rite` }, today = { ...saved[0], site: SITE_ID };
  B.pool.restoreWorld([old, today, saved[0]], (x, z) => [x, z], 0); await settle();
  assert.deepEqual(B.pool.foes.map((f) => f.site), [camp.site], 'the camp\'s alone stands again');
  fresh();
});

test('AUDIT WB12d (C11): the Summoner a beast is still the Summoner - a Wabbajack\'s re-stand keeps his site, his part and his camp, and his death breaks the rite (mutants: the site dropped; the part dropped)', async () => {
  fresh();
  const A = client('aaaa-0001');
  A.at(30); await A.beat();
  const sum = A.own().find((f) => f.mobileType === RITE_SUMMONER_CAREER);
  // scenes/world.js enchantReplaceFoe, its exterior arm
  A.pool.removeFoe(sum);
  const beast = await A.pool.spawnFoe(0, [...sum.ai.feet], { replacing: true, ...siteFoeSpawn(sum) });
  carrySiteFoe(sum, beast);
  assert.deepEqual([beast.site, beast.placed, beast.transient, beast.riteRole, beast.campId], [SITE_ID, true, true, 'summoner', sum.campId]);
  await A.beat();
  assert.equal(A.host.state().own, FAITHFUL.length, 'still one of them');
  assert.equal(beast.entity.properName, RITE_TEXT.summoner, 'by his name');
  A.kill(beast); await A.beat();
  assert.equal(A.words.at(-1).f, 1, 'his fall breaks the rite');
  assert.deepEqual(siteFoeSpawn({ mobileType: 3 }), {}, 'a wanderer is changed as ever');
  assert.match(WORLD, /exteriorFoes\.spawnFoe\(mobileType, feet, \{ replacing: true, \.\.\.siteFoeSpawn\(f\) \}\)\.then\(\(nf\) => \{ stamp\(nf\); carrySiteFoe\(f, nf\); \}\)/);
  fresh();
});

test('AUDIT WB12d (C1): the opening - the faithful still standing pass into the breach, taken down without giving the site away; said once, to a player near them (mutants: they stay; the site poisoned at the opening)', async () => {
  fresh();
  const clock = { t: T.omenAt + 60_000 };
  const A = client('aaaa-0001', { clock });
  A.at(RITE_SPRING_M - 10); await A.beat();
  clock.t = T.openAt + 100; await A.beat(); await A.beat();
  assert.equal(A.own().length, 0);
  assert.deepEqual(A.near, [RITE_TEXT.pass]);
  const late = await A.pool.spawnFoe(0, [E, 0, N], { placed: true, groundAlign: { hitDist: 0.2 }, site: SITE_ID });
  assert.ok(late && !late.dead, 'the site is still mine to stand on');
  fresh();
});
