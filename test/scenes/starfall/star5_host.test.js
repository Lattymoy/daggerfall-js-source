// STAR5/STAR6 (bible/11-Multiplayer/Starfall.md sections 3, 4, 5 and 8): THE STARFALL'S HOST, END TO END on the world's
// bindings by name - a night's stars found over a scan, their moments said where they should be heard, the defense
// stood by the ledger the cell says (each wave, the master, its circle at its calls, the ward), the star a body its own
// coven's monsters strike and each blow kept across a reload, the word to the cell, the hold and the loss, the camp's
// race; and the Timers', the map's and the compass's readings. tools/mutants/star5.json.
// AUDIT STARFALL (2026-10-20): the foes handed over taken as the star's (C1), one leash (C2), the master stood again
// (C4), the festival's last stars (C5), the blows by account (C6), the star's allowance (C7); the crater where its
// heart is (R1), the beacon clamped (R2), the ring on the land (R3), the floor pulled forward (R4), the landing's cues
// (R7), a first ledger taken in silently (R8), the coarse ground and the pass at idle (R9).
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createStarfallHost, starfallStands, STAR_BLOWS_STORE, STAR_LIVE_MAX, STAR_RESTAND_MS, STAR_COARSE_EVERY, STAR_FLOOR_OFFSET, STAR_BUILD_M, STAR_GROUND_EVERY,
} from '../../../src/scenes/starfall/starfallHost.js';
import {
  starNightAt, starTimes, starCircleSize, starLostAt, STAR_ORPHAN_MS, STAR_CIRCLE_AT, STAR_LOST_DARK, STAR_LIFE_MS, STAR_AFTER_MS, STAR_GRACE_MS,
  P_GATHER, P_WAVE, P_BREATH, P_MASTER, P_HELD, P_LOST, STAR_FOE_HEALTH,
} from '../../../src/net/starfall/starfallLaw.js';
import { starCovenOf, covenWitches, STAR_COVENS } from '../../../src/systems/starfall/starfallCovens.js';
import { findStarSites } from '../../../src/systems/starfall/starfallSites.js';
import { findGateSite } from '../../../src/systems/gate/gateSite.js';
import { starWaveFoes, starMasterOf, starCircleFoes, STAR_ROSTERS } from '../../../src/systems/starfall/starCoven.js';
import { starHeldKey, STAR_SAY_M } from '../../../src/systems/starfall/starfallClient.js';
import { STAR_REGION_TEXT, STAR_AT_TEXT } from '../../../src/systems/starfall/starWords.js';
import { STAR_SOUNDS } from '../../../src/systems/starfall/starSounds.js';
import { starSiteId, WOD_STAR_PUPPETS_MAX, WOD_CAMP_PUPPETS_MAX } from '../../../src/world/worldOfDaggerfall/wodShared.js';
import { CELL_FRAME_RECORDS_MAX } from '../../../src/net/wire.js';
import { createExteriorFoes } from '../../../src/scenes/exteriorFoes.js';
import { skyClamp, STAR_SKY_R, STAR_RING_SEGS, STAR_RING_WIDTH_M } from '../../../src/render/starfall/starfallPass.js';
import { rimAt, buildStarModel, STAR_CRATER_R, STAR_RIM_H } from '../../../src/world/starfall/starModel.js';
import { lateSolidsOf } from '../../../src/player/lateSolid.js';
import { thunderOf, thunderSourceAt } from '../../../src/systems/distantStorms.js';
import { playerEntity } from '../../../src/characters/playerEntity.js';
import { characterIdOf } from '../../../src/systems/characterId.js';
import { midScreenText } from '../../../src/ui/midScreenText.js';
import { renownFoeStruck } from '../../../src/net/renownTracker.js';
import { FESTIVALS } from '../../../src/net/festivalLaw.js';
const FESTIVAL_FROM_MS = FESTIVALS[0].fromMs;   // the Witches' Festival's first day, the Starfall's own (net/festivalLaw.js)

const N = starNightAt(FESTIVAL_FROM_MS) + 30;
const COVEN = starCovenOf(N);
const settle = async () => { for (let i = 0; i < 8; i++) await new Promise((r) => setImmediate(r)); };

/** Each coven's region 400 pixels in a block of its own, each pixel its own town's (STAR2's scan). */
function scanOf(regions) {
  const byRegion = new Map(), townAt = new Int32Array(1000 * 500).fill(-1), towns = [];
  regions.forEach((region, i) => {
    const pixels = [];
    for (let y = 20 + i * 30; y < 40 + i * 30; y++) for (let x = 300; x < 320; x++) { const id = y * 1000 + x; pixels.push(id); townAt[id] = towns.length; towns.push({ name: `Town ${towns.length}`, px: x, py: y, region }); }
    byRegion.set(region, Int32Array.from(pixels));
  });
  return { byRegion, towns, townAt };
}
const SCAN = scanOf([...new Set(STAR_COVENS.map((c) => c.region))]);
const sitesOf = (n) => findStarSites(n, SCAN, { gateSiteOf: (day) => { try { return findGateSite(day, SCAN); } catch { return null; } } });

/** The foe pool's doors the host uses, recording. */
function pool() {
  const p = { foes: [], stood: [], dropped: [], reclaimed: [], removed: [], camp: 0, nullFor: null };
  p.newCampId = () => ++p.camp;
  p.spawnFoe = (career, pos, o) => {
    if (p.nullFor?.(o)) { p.stood.push(null); return Promise.resolve(null); }   // no ground, a full pool
    const f = { mobileType: career, site: o.site, opts: o, entity: { health: 100, maxHealth: 100 }, ai: { feet: [...pos] }, dead: false };
    p.foes.push(f); p.stood.push(f);
    return Promise.resolve(f);
  };
  p.dropSiteFoes = (s) => { p.dropped.push(s); p.foes = p.foes.filter((f) => f.site !== s || f.puppet); };
  p.reclaimSite = (s) => p.reclaimed.push(s);
  p.removeFoe = (f) => { p.removed.push(f); p.foes = p.foes.filter((x) => x !== f); };
  return p;
}
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), m }; };

/** A GL that answers every call (its programs link, its uniforms are their names) and keeps what it was told. */
function fakeGl() {
  const calls = [];
  const answer = { createProgram: () => ({ program: true }), getProgramParameter: () => true, getShaderParameter: () => true, getUniformLocation: (p, n) => ({ n }) };
  return new Proxy({ calls }, {
    get(o, k) {
      if (k in o) return o[k];
      if (typeof k === 'string' && /^[A-Z_0-9]+$/.test(k)) return k;
      return (...a) => { calls.push([k, ...a]); return answer[k] ? answer[k](...a) : {}; };
    },
  });
}
/** A world with one player, the host on its bindings - `gfx` a renderer and a collider that keep what they are told,
 *  `surface` the drawn ground (the scene's), `coarse` the ground past it, `account` the signed-in account. */
function world({ storage = memStorage(), t = starTimes(N, 0).omenAt - 1000, gfx = false, surface = () => 0, coarse = undefined, account = undefined } = {}) {
  const w = { t, feet: null, region: COVEN.region, said: [], mids: [], sounds: [], heard: [], words: [], sprung: new Set(), peer: new Set(), peerAgo: 0, forgot: [], bare: [], storage, origin: [0, 0, 0] };
  w.foes = pool();
  w.session = { starReady: () => true, starGrantOk: true, sendStar: (word, cell) => { w.words.push({ ...word, cell }); return true; } };   // AUDIT STAR-TUNE F1: a relay that mints the `star` kind
  w.gl = gfx ? fakeGl() : null;
  w.renderer = gfx ? { gl: w.gl, meshes: [], draws: [], createMesh(m) { const mesh = { m }; this.meshes.push(mesh); return mesh; }, destroyMesh() {}, uploadTexture() {}, uploadEmissionTexture() {}, drawMesh(mesh, mat) { w.draws.push({ mesh, mat: Array.from(mat), offset: w.gl.calls.filter(([k, c]) => (k === 'enable' || k === 'disable') && c === 'POLYGON_OFFSET_FILL').at(-1)?.[0] === 'enable' }); } } : null;
  w.draws = [];
  w.col = { adds: [], removes: [], addMesh(b, pos, idx, m) { this.adds.push({ b, m: Array.from(m), tris: idx.length / 3 }); }, removeBucket(b) { this.removes.push(b); }, surfaceHit: () => null };
  const bindings = {
    renderer: w.renderer,
    state: { pixelTranslation: (px, py, out) => { out[0] = px * 100 + w.origin[0]; out[1] = w.origin[1]; out[2] = py * 100 + w.origin[2]; return out; } },
    exteriorFoes: w.foes, gateScanOf: () => SCAN, warmGateScan: () => {},
    surfaceAt: (x, z) => surface(x - w.origin[0], z - w.origin[2]) + w.origin[1], ...(coarse !== undefined ? { gateGroundAt: coarse } : {}),
    player: { feetAt: () => w.feet }, walkMode: true, playerSpawned: true,
    get online() { return w.session; },
    _wodPeerSprung: w.peer, wodPeerHeldAgo: () => w.peerAgo, wodForgetPeer: (s) => { w.forgot.push(s); w.peer.delete(s); },
    wodSprang: (s) => w.sprung.add(s), wodUnsprang: (s) => w.sprung.delete(s),
    chatNotice: (s) => w.said.push(s), labGrassField: { invalidate: (...a) => w.bare.push(a) },
    _questRegionIndex: () => w.region, gamePaused: () => false, townTalk: { hudHidden: false },
    collider: gfx ? w.col : null, _sharedOffsetMs: 0,
    audio: { playOneShot: (clip) => w.sounds.push(clip), play3d: (clip, pos) => { w.sounds.push(clip); w.heard.push({ clip, pos: [...pos] }); } },
    storage, ...(account !== undefined ? { starAccount: { me: () => account } } : {}),
  };
  w.host = createStarfallHost(bindings);
  w.frame = () => w.host.frame();
  w.beat = async () => { w.host.frame(); await settle(); w.host.frame(); };
  w.star = (k) => w.host.state().find((s) => s.key.startsWith(`${N}.${k}@`));
  w.siteOf = (k) => sitesOf(N).find((s) => s.k === k);
  w.heart = (k) => { const s = w.siteOf(k); return [s.px * 100 + s.spot[0] + w.origin[0], w.origin[1], s.py * 100 + s.spot[1] + w.origin[2]]; };
  w.at = (k, m = 0) => { const h = w.heart(k); w.feet = [h[0] + m, h[1], h[2]]; };
  w.sites = (k) => { const s = w.siteOf(k); return { base: starSiteId(s.px, s.py, N, k), m: starSiteId(s.px, s.py, N, k, 'm'), c: starSiteId(s.px, s.py, N, k, 'c') }; };
  w.st = (k, over) => { const s = w.siteOf(k); w.host.onStar({ k: 'st', n: N, s: k, px: s.px, py: s.py, p: P_WAVE, w: 1, wz: 3, kn: 0, wl: -1, lt: 100, nd: 2, b: 1, ow: 1, hc: 0, hd: 0, lo: 0, why: 0, ...over }); };
  return w;
}

let realNow;
const clockOf = (w) => { Date.now = () => w.t; };
test.before(() => { realNow = Date.now; midScreenText.onMessage = null; });
test.after(() => { Date.now = realNow; });
const mids = [];
const watchMids = () => { mids.length = 0; midScreenText.onMessage = (m) => mids.push(m); };

test('STAR5 THE NIGHT\'S STARS: three in the coven\'s region, each from its omen; none outside the Witches\' Festival\'s days; a star whose landing is before they open is no star (mutants: the festival\'s days, the window filter)', () => {
  const w = world();
  clockOf(w);
  assert.equal(sitesOf(N).length, 3);
  w.t = FESTIVALS[0].toMs + STAR_LIFE_MS + STAR_AFTER_MS;
  assert.equal(w.frame(), null);
  assert.deepEqual(w.host.state(), [], 'the festival over and its last star gone, no stars');
  w.t = starTimes(N, 0).omenAt;
  w.frame();
  assert.deepEqual(w.host.state().map((s) => s.phase), ['omen']);
  w.t = starTimes(N, 2).fallAt + 1000;
  w.frame();
  assert.deepEqual(w.host.state().map((s) => s.phase), ['after', 'fallen', 'fallen'], 'the first\'s deadline the last\'s landing');
  // the window's first night: its first two stars land before it opens - none on this screen; its last at the opening
  const first = starNightAt(FESTIVAL_FROM_MS);
  const w2 = world({ t: FESTIVAL_FROM_MS + 1000 });
  clockOf(w2);
  w2.region = -9;
  w2.frame();
  assert.deepEqual(w2.host.state().map((s) => s.key.split('@')[0]), [`${first}.2`]);
  w2.t = FESTIVAL_FROM_MS - 1;
  assert.equal(w2.frame(), null);
  assert.deepEqual(w2.host.state(), [], 'before the window, nothing');
  Date.now = realNow;
});

test('STAR5 THE REGION HEARS IT: the omen to everyone in the coven\'s region, once, with its whine; the landing as it happens; a player elsewhere hears neither (mutants: the region guard, the once)', () => {
  const w = world();
  clockOf(w);
  const s0 = w.siteOf(0), T = starTimes(N, 0);
  w.t = T.omenAt + 10;
  w.frame(); w.frame();
  assert.deepEqual(w.said, [STAR_REGION_TEXT.omen(s0.near, covenWitches(COVEN))]);
  assert.deepEqual(w.sounds, [STAR_SOUNDS.omen.clip]);
  w.t = T.streakAt + 10; w.frame();
  assert.ok(w.sounds.includes(STAR_SOUNDS.fall.clip), 'its roar');
  w.t = T.fallAt + 10; w.frame(); w.frame();
  assert.deepEqual(w.said.slice(1), [STAR_REGION_TEXT.fell(s0.near)]);
  const away = world();
  clockOf(away);
  away.region = COVEN.region + 1;
  away.t = T.omenAt + 10; away.frame();
  away.t = T.fallAt + 10; away.frame();
  assert.deepEqual(away.said, []);
  assert.deepEqual(away.sounds, []);
  Date.now = realNow;
});

test('STAR5 THE DEFENSE: at the fallen star this player springs its coven - its three sites said to be mine; each wave stood off the ledger, its own roster at its own places, in no save; the waves\' calls said at the star; kills counted, a wave seen cleared; the word says it all to the star\'s cell (mutants: the stand, the count, the word)', async () => {
  const w = world();
  clockOf(w);
  watchMids();
  const T = starTimes(N, 1), sites = w.sites(1), s1 = w.siteOf(1);
  w.t = T.fallAt + 500;
  w.at(1, 10);
  w.frame();
  assert.deepEqual([...w.sprung].sort(), Object.values(sites).sort(), 'the star\'s three sites, mine');
  assert.deepEqual(w.foes.reclaimed.sort(), Object.values(sites).sort());
  assert.equal(w.foes.stood.length, 0, 'nothing stood before the cell speaks');
  assert.equal(w.words.at(-1).o, 1);
  assert.deepEqual([w.words.at(-1).n, w.words.at(-1).k, w.words.at(-1).px, w.words.at(-1).py], [N, 1, s1.px, s1.py]);
  w.st(1, { p: P_GATHER, w: 0, wz: 0 });
  w.st(1, { p: P_WAVE, w: 1, wz: 3, kn: 0, b: 1 });
  await w.beat();
  assert.deepEqual(w.foes.stood.map((f) => f.mobileType), starWaveFoes(N, 1, 1, 3, 1));
  for (const f of w.foes.stood) {
    assert.equal(f.site, sites.base);
    assert.equal(f.starSite, sites.base, 'its hunters\' star');
    assert.equal(f.opts.transient, true, 'in no save');
    assert.equal(f.opts.eliteFoe, false);
    assert.equal(f.campId, 1);
  }
  assert.ok(mids.includes(STAR_AT_TEXT.wave(1)), 'the first wave\'s call at the star');
  // the wave falls: each with a body counted once; the wave seen cleared once the last is down, never before
  const [a, b, c] = w.foes.stood;
  for (const f of [a, b]) { f.dead = true; f.corpse = true; }
  w.frame(); w.t += 2100; w.frame();
  assert.deepEqual([w.words.at(-1).kw, w.words.at(-1).kn, w.words.at(-1).wc], [1, 2, 0], 'two down of the first wave, the wave stands');
  c.dead = true;
  w.frame(); w.t += 2100; w.frame();
  assert.equal(w.words.at(-1).kn, 2, 'gone without a body: walked off, no fall');
  c.corpse = true;
  w.frame(); w.t += 2100; w.frame();
  assert.equal(w.host.state().find((s) => s.key.startsWith(`${N}.1@`)).kn, 3);
  assert.equal(w.words.at(-1).kn, 3);
  assert.equal(w.words.at(-1).wc, 1, 'the wave seen cleared');
  // the breath: the word still names the wave its deaths are (the cell credits them to that wave alone)
  w.st(1, { p: P_BREATH, w: 1, wz: 3, kn: 3, b: 1 });
  w.frame(); w.t += 2100; w.frame();
  assert.deepEqual([w.words.at(-1).kw, w.words.at(-1).kn], [1, 3], 'the first wave\'s deaths, named by it');
  // wave 2, taken over mid-wave: only what is left of it stands
  w.st(1, { p: P_WAVE, w: 2, wz: 5, kn: 2, b: 1 });
  await w.beat();
  assert.deepEqual(w.foes.stood.slice(3).map((f) => f.mobileType), starWaveFoes(N, 1, 2, 3, 1));
  w.frame(); w.t += 2100; w.frame();
  assert.deepEqual([w.words.at(-1).kw, w.words.at(-1).kn], [2, 2], 'the second wave\'s word counts on from the deaths the cell said of it');
  assert.ok(starWaveFoes(N, 1, 2, 3, 1).every((c) => STAR_ROSTERS[1][1].includes(c)));
  Date.now = realNow;
});

test('STAR5 THE STAR AS A BODY: its owner\'s machine hands it to the senses while it stands fallen; each blow its coven lands is one, kept per character across a reload and said in the word (mutants: the ward\'s owner guard, the store)', async () => {
  const storage = memStorage();
  const w = world({ storage });
  clockOf(w);
  const T = starTimes(N, 0);
  w.t = T.fallAt + 500; w.at(0, 5);
  w.frame();
  const wards = w.host.wards();
  assert.equal(wards.length, 1);
  assert.equal(wards[0].starWard, true);
  assert.equal(wards[0].site, w.sites(0).base);
  assert.equal(wards[0].hurtFromFoe(), 1);
  wards[0].hurtFromFoe();
  w.t += 2100; w.frame();
  assert.equal(w.words.at(-1).hb, 2);
  assert.ok(w.sounds.includes(STAR_SOUNDS.blow.clip));
  const kept = JSON.parse(storage.getItem(STAR_BLOWS_STORE));
  assert.equal(kept[`-|${characterIdOf(playerEntity)}|${starHeldKey(N, 0, w.siteOf(0).px, w.siteOf(0).py)}`], 2, 'under no account (none signed in) and this character');
  // a reload: the same count goes on
  const again = world({ storage });
  clockOf(again);
  again.t = w.t; again.at(0, 5); again.frame();
  assert.equal(again.words.at(-1).hb, 2, 'counted on from its own');
  // a player not at it stands no body
  const far = world();
  clockOf(far);
  far.t = T.fallAt + 500; far.at(0, STAR_SAY_M + 1); far.frame();
  assert.deepEqual(far.host.wards(), []);
  Date.now = realNow;
});

test('STAR5 THE MASTER AND ITS CIRCLE: the ledger\'s master stood an elite by its own name under its own site; at two-thirds and a third its circle about it, sized by the defenders; the ward holds while one of the circle stands; the calls and the breaking said on every screen; its fall said in the word (mutants: a call\'s edge, the circle\'s size, the ward, the fall)', async () => {
  const w = world();
  clockOf(w);
  watchMids();
  const T = starTimes(N, 2), sites = w.sites(2), M = starMasterOf(2, 2);
  w.t = T.fallAt + 500; w.at(2, 5);
  w.frame();
  w.st(2, { p: P_BREATH, w: 4, wz: 0, kn: 0, b: 2, nd: 4 });
  w.st(2, { p: P_MASTER, w: 4, wz: 0, kn: 0, b: 2, nd: 4 });
  await w.beat();
  const master = w.foes.stood.find((f) => f.site === sites.m);
  assert.ok(master, 'the master stood');
  assert.equal(master.mobileType, M.career);
  assert.equal(master.opts.eliteFoe, true);
  assert.equal(master.entity.name, M.name());
  assert.equal(master.entity.worldBoss, true, 'a world boss\'s body: its fall is the star\'s deed, no body find of its own');
  assert.ok(mids.includes(M.call()), 'its call');
  assert.ok(w.sounds.includes(STAR_SOUNDS.master.clip));
  assert.equal(master.circleWard(), false, 'no circle yet');
  master.entity.maxHealth = 300;
  master.entity.health = 201;
  await w.beat();
  assert.equal(w.foes.stood.filter((f) => f.site === sites.c).length, 0, 'not before two-thirds');
  master.entity.health = 300 * STAR_CIRCLE_AT[0];
  await w.beat();
  const circle = w.foes.stood.filter((f) => f.site === sites.c);
  assert.deepEqual(circle.map((f) => f.mobileType), starCircleFoes(N, 2, 0, starCircleSize(4, false), 2));
  w.frame();
  assert.ok(circle.every((f) => f.entity.worldBoss === undefined), 'its circle\'s witches no world boss');
  assert.equal(master.circleWard(), true, 'warded');
  assert.ok(mids.includes(M.circle()));   // AUDIT STAR (W1): the master's own circle line, its name with its article
  for (const f of circle) { f.dead = true; f.corpse = true; }
  w.frame();
  assert.equal(master.circleWard(), false, 'broken');
  assert.equal(w.star(2).kn, 0, 'the circle\'s dead are no wave\'s kills');
  assert.ok(mids.includes(STAR_AT_TEXT.circleBroken(M.female)));
  assert.ok(w.sounds.includes(STAR_SOUNDS.circle.clip));
  master.entity.health = 300 * STAR_CIRCLE_AT[1];
  await w.beat();
  assert.equal(w.foes.stood.filter((f) => f.site === sites.c).length, circle.length * 2, 'the second call');
  master.dead = true; master.corpse = true;
  w.frame(); w.t += 2100; w.frame();
  assert.equal(w.words.at(-1).mf, 1, 'its fall in the word');
  Date.now = realNow;
});

test('STAR5 HELD AND LOST: a hold said at the star with its sound, the region told by the hub once with who held it, the defense taken down; a loss said by its cause (mutants: the over test, the once)', async () => {
  const w = world();
  clockOf(w);
  watchMids();
  const T = starTimes(N, 0), sites = w.sites(0), s0 = w.siteOf(0);
  w.t = T.fallAt + 500; w.at(0, 5);
  w.frame();
  w.st(0, { p: P_WAVE, w: 1, wz: 3 });
  await w.beat();
  w.st(0, { p: P_HELD, w: 4, hd: w.t });
  w.frame();
  assert.ok(mids.includes(STAR_AT_TEXT.held()));
  assert.ok(w.sounds.includes(STAR_SOUNDS.held.clip));
  assert.deepEqual(w.foes.dropped.sort(), Object.values(sites).sort(), 'the defense taken down');
  assert.deepEqual(w.host.wards(), []);
  const said = w.said.length;
  const hd = { k: 'hd', n: N, s: 0, px: s0.px, py: s0.py, at: w.t, top: ['Ann', 'Bran'], c: 3 };
  w.host.onStar(hd); w.host.onStar(hd);
  assert.deepEqual(w.said.slice(said), [STAR_REGION_TEXT.held(s0.near, ['Ann', 'Bran'], 3)], 'once');
  // a hold heard after its star is gone from this screen: said once all the same
  const s2 = w.siteOf(2), late = { k: 'hd', n: N, s: 2, px: s2.px, py: s2.py, at: w.t, top: ['Cy'], c: 1 };
  w.t = starTimes(N, 2).goneAt + 10; w.frame();
  assert.equal(w.star(2), undefined, 'gone');
  w.host.onStar(late); w.host.onStar(late);
  assert.deepEqual(w.said.slice(said + 1), [STAR_REGION_TEXT.held(s2.near, ['Cy'], 1)]);
  const l = world();
  clockOf(l);
  watchMids();
  l.t = starTimes(N, 1).fallAt + 500; l.at(1, 5); l.frame();
  l.st(1, { p: P_WAVE, lt: 10 });
  l.st(1, { p: P_LOST, lt: 0, why: STAR_LOST_DARK, lo: l.t });
  l.frame();
  assert.ok(mids.includes(STAR_AT_TEXT.lost()));
  assert.ok(l.sounds.includes(STAR_SOUNDS.dark.clip));
  const d = world();
  clockOf(d);
  watchMids();
  d.t = starTimes(N, 1).fallAt + 500; d.at(1, 5); d.frame();
  d.st(1, { p: P_WAVE, lt: 40 });
  d.st(1, { p: P_LOST, lt: 40, why: 2, lo: d.t });
  d.frame();
  assert.ok(mids.includes(STAR_AT_TEXT.dawn()), 'dawn\'s own words');
  Date.now = realNow;
});

test('STAR5 THE CAMP\'S RACE: a peer who sprang the coven first holds it - this screen stands nothing and drops what it stood; a peer silent past the orphan\'s wait holds nothing, and the star is taken over (mutants: the race, the orphan)', async () => {
  const w = world();
  clockOf(w);
  const T = starTimes(N, 0), sites = w.sites(0);
  w.t = T.fallAt + 500; w.at(0, 5);
  w.frame();
  w.st(0, { p: P_WAVE, w: 1, wz: 3 });
  await w.beat();
  assert.equal(w.foes.stood.length, 3);
  w.peer.add(sites.base); w.peerAgo = 0;
  w.frame();
  assert.deepEqual(w.foes.dropped.sort(), Object.values(sites).sort(), 'the race lost: mine dropped');
  assert.equal(w.words.at(-1).o, 0, 'no longer the owner, said at once');
  assert.equal(w.host.wards().length, 0);
  w.peerAgo = STAR_ORPHAN_MS;
  await w.beat();
  assert.deepEqual(w.forgot, [sites.base], 'the silent peer forgotten');
  assert.equal(w.foes.stood.length, 6, 'the wave stood again');
  Date.now = realNow;
});

test('STAR4 THE SKY: the omen burns over its site, the streak comes down, the landing flashes and its ring runs out; the beacon rises over the star and dims with its light as the cell says it, goes gold when it is held and out when it is lost (mutants: the dimming, the held gold, the lost dark)', () => {
  const w = world();
  clockOf(w);
  const T = starTimes(N, 0), eye = [0, 2, 0];
  w.at(0, 5);
  w.t = T.omenAt + 1000; w.frame();
  let sky = w.host.skyLists(eye);
  assert.deepEqual([sky.glows.length, sky.trails.length, sky.beacons.length], [1, 0, 0], 'the omen: a glow');
  w.t = T.streakAt + 1000; w.frame();
  sky = w.host.skyLists(eye);
  assert.deepEqual([sky.glows.length, sky.trails.length], [1, 1], 'the streak: its head and its trail');
  w.t = T.fallAt + 500; w.frame();
  sky = w.host.skyLists(eye);
  assert.ok(sky.rings.length === 1 && sky.glows.length === 1, 'the landing\'s flash and its ring');
  w.t = T.fallAt + 5000; w.frame();
  const full = w.host.skyLists(eye).beacons[0];
  assert.deepEqual([full.fade, full.held], [1, false], 'the beacon at full strength');
  w.st(0, { p: P_WAVE, lt: 50 });
  const half = w.host.skyLists(eye).beacons[0].fade;
  w.st(0, { p: P_WAVE, lt: 0 });
  const none = w.host.skyLists(eye).beacons[0].fade;
  assert.ok(half < 1 && none < half && none > 0, `it dims with the light (${half}, ${none})`);
  w.st(0, { p: P_HELD, lt: 40, hd: w.t });
  const held = w.host.skyLists(eye).beacons[0];
  assert.deepEqual([held.held, held.fade > 0.9], [true, true], 'held: gold, full');
  w.t += 30_000;
  assert.ok(w.host.skyLists(eye).beacons[0].fade < 0.6, 'and thinning');
  const l = world();
  clockOf(l);
  l.at(1, 5); l.t = starTimes(N, 1).fallAt + 5000; l.frame();
  const standing = l.host.skyLists(eye).beacons.length;   // the night's first star stands beside it
  l.st(1, { p: P_LOST, lt: 0, why: STAR_LOST_DARK, lo: l.t });
  assert.equal(l.host.skyLists(eye).beacons.length, standing - 1, 'lost: its beacon out');
  Date.now = realNow;
});

test('STAR6 THE READINGS: the Timers\' rows (the standing star and the next fall), the map\'s cards, the compass\'s nearest star in the region, the grass\'s clearing, the star\'s sites; all let go on destroyAll (mutants: the region guard, the clearing)', () => {
  const w = world();
  clockOf(w);
  const T0 = starTimes(N, 0), T1 = starTimes(N, 1);
  w.t = T0.fallAt + 500; w.at(0, 5);
  w.frame();
  assert.deepEqual(w.host.timerRows().map((r) => [r.kind, r.live, r.at]), [['star', true, T0.endAt], ['star', false, T1.fallAt]]);
  const marks = w.host.mapMarks();
  assert.equal(marks.length, 1);
  assert.deepEqual([marks[0].px, marks[0].py], [w.siteOf(0).px, w.siteOf(0).py]);
  const c = w.host.compassMark();
  assert.ok(Array.isArray(c) && c.length === 2);
  w.region = -1;
  assert.equal(w.host.compassMark(), null, 'another region\'s star is not on the compass');
  const clear = w.host.clearing();
  assert.ok(clear && clear.r > 0 && clear.key.startsWith(`${N}.0@`));
  assert.equal(w.host.isStarSite(w.sites(0).m), true);
  assert.equal(w.host.isStarSite(w.sites(0).c), true);
  assert.equal(w.host.isStarSite('300,200:7'), false);
  assert.equal(w.host.active(), true);
  w.host.destroyAll();
  assert.equal(w.host.active(), false);
  assert.deepEqual(w.host.state(), []);
  w.t = FESTIVALS[0].toMs + STAR_LIFE_MS + STAR_AFTER_MS;   // the festival over and its last star gone: no rows, no marks
  assert.deepEqual(w.host.timerRows(), []);
  assert.deepEqual(w.host.mapMarks(), []);
  Date.now = realNow;
});

// ── AUDIT STARFALL (2026-10-20) ──────────────────────────────────────────────────────────────────────────────────────

/** A foe of the star handed to this screen (scenes/exteriorFoes.js adopt): mine now, its site kept and nothing else. */
const handed = (career, site, at, hp = 100, max = 100) => ({ mobileType: career, site, entity: { health: hp, maxHealth: max }, ai: { feet: [...at] }, dead: false, puppet: null });

test('AUDIT STARFALL C1 THE FOES HANDED TO ME ARE THE STAR\'S: a wave\'s foes handed over are made its own (its hunters\' star, the camp, the wave) and only what is missing of it stands; a handed master is the master - warded by its circle, marked, its calls as its health passed them - and no second one stands (mutants: the claim, the wave\'s own, the master taken, its calls)', async () => {
  const w = world();
  clockOf(w);
  const sites = w.sites(1);
  w.t = starTimes(N, 1).fallAt + 500; w.at(1, 5);
  const a = handed(0, sites.base, w.heart(1)), b = handed(0, sites.base, w.heart(1)), far = handed(0, '300,20:7', w.heart(1));
  w.foes.foes.push(a, b, far);
  w.st(1, { p: P_GATHER, w: 0, wz: 0 });
  w.st(1, { p: P_WAVE, w: 2, wz: 5, kn: 1, b: 1 });
  await w.beat();
  assert.deepEqual([a.starSite, b.starSite], [sites.base, sites.base], 'its hunters go for the star again');
  assert.deepEqual([a.campId, b.campId], [1, 1], 'one camp with what this screen stands');
  assert.equal(far.starSite, undefined, 'another site\'s foe is no star\'s');
  assert.equal(w.foes.stood.length, 2, 'five less the one fallen and the two handed');
  assert.deepEqual(w.foes.stood.map((f) => f.mobileType), starWaveFoes(N, 1, 2, 2, 1));
  for (const f of [...w.foes.stood, a]) { f.dead = true; f.corpse = true; }
  w.frame(); w.t += 2100; w.frame();
  assert.equal(w.star(1).kn, 1 + 3, 'the handed are the wave\'s: their falls counted');
  assert.equal(w.words.at(-1).wc, 0, 'and the wave stands while one of them does');
  b.dead = true; b.corpse = true;
  w.frame(); w.t += 2100; w.frame();
  assert.equal(w.words.at(-1).wc, 2, 'cleared with the last');
  // the master: handed at half its health - past the first call, short of the second
  const m = world();
  clockOf(m);
  const ms = m.sites(2), M = starMasterOf(1, 2);
  m.t = starTimes(N, 2).fallAt + 500; m.at(2, 5);
  const boss = handed(M.career, ms.m, m.heart(2), 150, 300);
  m.foes.foes.push(boss);
  m.st(2, { p: P_BREATH, w: 4, wz: 0, b: 1, nd: 2 });
  m.st(2, { p: P_MASTER, w: 4, wz: 0, b: 1, nd: 2 });
  await m.beat();
  m.t += STAR_RESTAND_MS + 100; await m.beat();
  assert.equal(m.foes.stood.filter((f) => f?.site === ms.m).length, 0, 'no second master');
  assert.equal(m.star(2).master, true);
  assert.equal(boss.entity.worldBoss, true);
  assert.equal(boss.entity.name, M.name());
  assert.equal(typeof boss.circleWard, 'function', 'warded by its circle');
  assert.equal(m.star(2).calls, 1, 'its first call made before it came to me');
  assert.equal(m.foes.stood.filter((f) => f?.site === ms.c).length, 0, 'and not made again');
  boss.entity.health = 300 * STAR_CIRCLE_AT[1];
  await m.beat();
  const circle = m.foes.stood.filter((f) => f?.site === ms.c);
  assert.deepEqual(circle.map((f) => f.mobileType), starCircleFoes(N, 2, 1, starCircleSize(2, false), 1), 'the second call, about it');
  m.frame();
  assert.equal(boss.circleWard(), true, 'and its circle wards it');
  Date.now = realNow;
});

test('AUDIT STARFALL C2 ONE LEASH, THE RELAY\'S: the coven is sprung and stood from where the word is said, never past it; an owner outside it keeps the camp STAR_ORPHAN_MS, says nothing, and then gives it up (mutants: the spring\'s reach, the leash, its wait)', async () => {
  const w = world();
  clockOf(w);
  const sites = w.sites(0);
  w.t = starTimes(N, 0).fallAt + 500; w.at(0, STAR_SAY_M + 5);
  w.st(0, { p: P_GATHER, w: 0, wz: 0 });
  w.st(0, { p: P_WAVE, w: 1, wz: 3 });
  await w.beat();
  assert.equal(w.star(0).own, false, 'between the word\'s reach and the old spring\'s: nobody\'s');
  assert.equal(w.foes.stood.length, 0, 'and nothing stood the relay would not hear of');
  assert.equal(w.words.length, 0);
  w.at(0, 10); await w.beat();
  assert.equal(w.star(0).own, true);
  assert.equal(w.foes.stood.length, 3);
  w.at(0, 150);
  const said = w.words.length;
  w.frame();
  w.t += STAR_ORPHAN_MS - 500; await w.beat();
  assert.equal(w.star(0).own, true, 'kept a while - a step out and back loses nothing');
  assert.deepEqual([...w.sprung].sort(), Object.values(sites).sort());
  w.t += 1000; w.frame();
  assert.equal(w.star(0).own, false, 'given up');
  assert.deepEqual([...w.sprung], [], 'its sites nobody\'s: another defender\'s screen takes them');
  assert.deepEqual(w.foes.dropped.sort(), Object.values(sites).sort());
  assert.equal(w.words.length, said, 'no word from off the star');
  w.at(0, 10); w.st(0, { p: P_WAVE, w: 1, wz: 3, kn: 1 }); await w.beat();
  assert.equal(w.star(0).own, true, 'back at the star: mine again');
  assert.equal(w.foes.stood.length, 3 + 2, 'what is left of the wave');
  Date.now = realNow;
});

test('AUDIT STARFALL C4 A MASTER THAT NEVER STOOD IS STOOD AGAIN: a stand that came to nothing is tried again STAR_RESTAND_MS on, as a wave\'s is, a world boss from its landing; one standing is never stood twice (mutants: the retry, the world boss)', async () => {
  const w = world();
  clockOf(w);
  const ms = w.sites(2);
  w.t = starTimes(N, 2).fallAt + 500; w.at(2, 5); w.frame();
  w.foes.nullFor = (o) => o.eliteFoe === true;
  w.st(2, { p: P_BREATH, w: 4, wz: 0, b: 1, nd: 2 });
  w.st(2, { p: P_MASTER, w: 4, wz: 0, b: 1, nd: 2 });
  await w.beat();
  assert.deepEqual(w.foes.stood, [null], 'its stand came to nothing');
  w.foes.nullFor = null;
  w.t += STAR_RESTAND_MS - 500; await w.beat();
  assert.equal(w.foes.stood.length, 1, 'not at once');
  w.t += 1000; w.frame(); await settle();
  const again = w.foes.stood.filter((f) => f?.site === ms.m);
  assert.equal(again.length, 1, 'stood again');
  assert.equal(again[0].entity.worldBoss, true, 'a world boss from its landing, before any frame - or blow - comes to it');
  w.frame();
  w.t += STAR_RESTAND_MS * 3; await w.beat();
  assert.equal(w.foes.stood.filter((f) => f?.site === ms.m).length, 1, 'and only once');
  Date.now = realNow;
});

test('AUDIT STARFALL C5 THE FESTIVAL\'S LAST STARS STAND TO THEIR END: a star that landed inside it is drawn, timed and marked past its close, until it is gone; one landing at its close is none (mutants: the stars outliving the days)', () => {
  const end = FESTIVALS[0].toMs, n = starNightAt(end - 1);
  assert.ok(starTimes(n, 1).fallAt < end && starTimes(n, 1).endAt > end && starTimes(n, 2).fallAt >= end);
  const w = world({ t: end + 1000 });
  clockOf(w);
  w.region = -9;
  assert.equal(starfallStands(end + 1000), true);
  w.frame();
  assert.deepEqual(w.host.state().map((s) => [s.key.split('@')[0], s.phase]), [[`${n}.0`, 'after'], [`${n}.1`, 'fallen']], 'the last two of the festival, the third never');
  assert.deepEqual(w.host.timerRows().map((r) => [r.kind, r.live, r.at]), [['star', true, starTimes(n, 1).endAt]], 'its deadline still timed');
  assert.equal(w.host.mapMarks().length, 2);
  w.t = starTimes(n, 1).goneAt; w.frame();
  assert.deepEqual(w.host.state(), [], 'gone at its end');
  assert.equal(starfallStands(end + STAR_LIFE_MS + STAR_AFTER_MS), false);
  assert.equal(starfallStands(FESTIVALS[0].fromMs - 1), false, 'nothing before it opens');
  Date.now = realNow;
});

test('AUDIT STARFALL C6 THE BLOWS ARE AN ACCOUNT\'S: kept under the account and the character, so another account on the device counts from its own; the cell\'s word of what this account was credited (`hm`) raises the count and never lowers it - a page that kept none counts on from it (mutants: the account\'s key, the credit said)', () => {
  const storage = memStorage();
  const a = world({ storage, account: 'acctA' });
  clockOf(a);
  a.t = starTimes(N, 0).fallAt + 500; a.at(0, 5); a.frame();
  a.host.wards()[0].hurtFromFoe(); a.host.wards()[0].hurtFromFoe();
  a.t += 2100; a.frame();
  assert.equal(a.words.at(-1).hb, 2);
  const b = world({ storage, account: 'acctB' });
  clockOf(b);
  b.t = a.t; b.at(0, 5); b.frame();
  assert.equal(b.words.at(-1).hb, 0, 'another account on this device: its own count');
  b.st(0, { p: P_WAVE, hm: 5 });
  b.t += 2100; b.frame();
  assert.equal(b.words.at(-1).hb, 5, 'counted on from what the cell credited it');
  b.st(0, { p: P_WAVE, hm: 3 });
  b.host.wards()[0].hurtFromFoe();
  b.t += 2100; b.frame();
  assert.equal(b.words.at(-1).hb, 6, 'never lowered');
  b.st(0, { p: P_WAVE });
  assert.equal(b.star(0).hb, 6, 'a word with none moves nothing');
  const again = world({ storage, account: 'acctA' });
  clockOf(again);
  again.t = b.t; again.at(0, 5); again.frame();
  assert.equal(again.words.at(-1).hb, 2, 'the first account\'s own, kept');
  const priv = world({ storage: null, account: 'acctA' });
  clockOf(priv);
  priv.t = b.t; priv.at(0, 5); priv.frame();
  assert.equal(priv.star(0).hb, 0, 'a private window keeps nothing');
  priv.st(0, { p: P_WAVE, hm: 2 });
  priv.host.wards()[0].hurtFromFoe();
  priv.t += 2100; priv.frame();
  assert.equal(priv.words.at(-1).hb, 3, 'and counts on from the cell\'s word: its next blow is credited');
  Date.now = realNow;
});

/** WOD7's pool rig (test/scenes/wod7_sharedcamps.test.js), for a reader's allowance. */
function craftMonsterBsa() {
  const cfg = new Uint8Array(74), v = new DataView(cfg.buffer);
  cfg[10] = 0x08; v.setUint16(52, 4, true);
  [40, 50, 50, 85, 50, 50, 90, 55].forEach((x, i) => v.setUint16(58 + i * 2, x, true));
  const name = 'ENEMY000.CFG', out = new Uint8Array(4 + cfg.length + 18), d = new DataView(out.buffer);
  d.setInt16(0, 1, true); d.setUint16(2, 0x0100, true); out.set(cfg, 4);
  for (let i = 0; i < name.length; i++) out[4 + cfg.length + i] = name.charCodeAt(i);
  d.setInt32(4 + cfg.length + 14, cfg.length, true);
  return out;
}
const BSA = craftMonsterBsa();
const poolRig = () => ({
  renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
  collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false, capsuleCast: () => ({ dist: Infinity, key: null }), sphereCast: () => ({ dist: Infinity, key: null }), move: (feet, mx, my, mz) => { feet[0] += mx; feet[2] += mz; return { grounded: true, hitCeiling: false, groundKey: 'floor' }; } },
  fetchBytes: async (n) => { if (n === 'MONSTER.BSA') return BSA; throw new Error(`no ${n} in this pin`); },
  getTexture: async () => ({ getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 1 }),
  uploadRecordFrame: () => {}, currentMinute: () => 0, currentPixelKey: () => '3,12',
  playerEntity: { level: 1, reflexes: 2, health: 50, maxHealth: 50, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50, endurance: 50 }, armorValues: new Array(7).fill(60) },
  audio: null, onPlayerHurt: () => {}, rolls: () => 0.01, rand: () => 0.01,
});
const netFor = (id) => ({ room: () => 'world:3,12', selfId: () => id, peers: () => [], now: () => 0, staleMs: 0, onPeerHit: (h, fate) => { fate?.sent?.(); return true; }, toWire: (f) => [f[0], f[1], f[2]], toScene: (p) => [p[0], p[1], p[2]] });
const flush = async () => { for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0)); };

test('AUDIT STARFALL C7 A STAR\'S FOES UNDER AN ALLOWANCE THE SIZE OF ITS LAW: its owner never stands past STAR_LIVE_MAX of them at once - the most the law calls - and a reader stands that many of one owner\'s, apart from its camps\' sixteen (mutants: the bound, the star\'s allowance)', async () => {
  assert.equal(STAR_LIVE_MAX, 24 + 1 + 2 * 10, 'a wave\'s twenty-four (STAR-TUNE), the master, two calls of the Heart-Star\'s circle');
  assert.equal(WOD_STAR_PUPPETS_MAX, STAR_LIVE_MAX, 'the reader\'s allowance is the owner\'s bound');
  assert.ok(WOD_STAR_PUPPETS_MAX > WOD_CAMP_PUPPETS_MAX);
  // the owner: a crowd of the circle's still standing, and a wave of nine called - only the room left stands
  const w = world();
  clockOf(w);
  const sites = w.sites(0);
  w.t = starTimes(N, 0).fallAt + 500; w.at(0, 5);
  for (let i = 0; i < STAR_LIVE_MAX - 2; i++) w.foes.foes.push(handed(0, sites.c, w.heart(0)));
  w.st(0, { p: P_GATHER, w: 0, wz: 0 });
  w.st(0, { p: P_WAVE, w: 1, wz: 9 });
  await w.beat();
  assert.equal(w.foes.stood.length, 2, 'two of the nine: the bound');
  // a reader: one owner's star foes and its camp's, each under its own allowance
  const A = createExteriorFoes(poolRig());
  A.setNet(netFor('aaaa-0001')); A.setOnSites(() => {}, () => []);
  const star = starSiteId(3, 12, N, 0, 'c');
  // over each allowance, the whole inside one frame's sixty-four records (CELL_FRAME_RECORDS_MAX - STAR-TUNE: the star's forty-five and the camp's sixteen fit under it)
  assert.ok(WOD_STAR_PUPPETS_MAX + 2 + WOD_CAMP_PUPPETS_MAX + 1 <= CELL_FRAME_RECORDS_MAX);
  for (let i = 0; i < WOD_STAR_PUPPETS_MAX + 2; i++) await A.spawnFoe(0, [2000 + i * 3, 0, 2000], { placed: true, groundAlign: { hitDist: 0.5 }, site: star });
  for (let i = 0; i < WOD_CAMP_PUPPETS_MAX + 1; i++) await A.spawnFoe(0, [2600 + i * 3, 0, 2000], { placed: true, groundAlign: { hitDist: 0.5 }, site: '3,12:7' });
  const B = createExteriorFoes(poolRig());
  B.setNet(netFor('bbbb-0002')); B.setOnSites(() => {});
  B.applyFoes('aaaa-0001', JSON.parse(JSON.stringify(A.foesFrame(true))));
  await flush();
  const pups = B.foes.filter((f) => f.puppet === 'aaaa-0001' && !f.dead);
  assert.equal(pups.filter((f) => f.site === star).length, WOD_STAR_PUPPETS_MAX, 'the star\'s, under its own allowance');
  assert.equal(pups.filter((f) => f.site === '3,12:7').length, WOD_CAMP_PUPPETS_MAX, 'and the camp\'s beside it, unspent by them');
  Date.now = realNow;
});

test('AUDIT STARFALL THE MASTER IS A WORLD BOSS ON EVERY SCREEN: a peer\'s master, seen as its copy, carries `worldBoss` too - its witches never (mutants: the mark)', () => {
  const w = world();
  clockOf(w);
  const ms = w.sites(2);
  w.t = starTimes(N, 2).fallAt + 500; w.at(2, 100);
  const copy = { ...handed(0, ms.m, w.heart(2)), puppet: 'peer-1', seq: 4 }, witch = { ...handed(0, ms.c, w.heart(2)), puppet: 'peer-1', seq: 5 };
  copy.entity.eliteFoe = true;
  w.foes.foes.push(copy, witch);
  w.frame();
  assert.equal(copy.entity.worldBoss, true);
  assert.equal(witch.entity.worldBoss, undefined);
  Date.now = realNow;
});

test('AUDIT STARFALL R1 THE CRATER STANDS WHERE ITS HEART IS: a floating origin\'s recentre moves its stone\'s collider and its drawn place with it - in the band between its build and its letting go too (mutants: the collider\'s matrix, the place in the band)', () => {
  const w = world({ gfx: true });
  clockOf(w);
  w.t = starTimes(N, 0).fallAt + 5000; w.at(0, 30);
  w.frame(); w.frame();
  const at = (m) => [m[12], m[13], m[14]].map((v) => Math.round(v * 100) / 100);
  const heart = () => w.heart(0).map((v) => Math.round(Math.fround(v) * 100) / 100);
  assert.deepEqual(at(w.col.adds.at(-1).m), heart(), 'its stone in the collider at its heart');
  w.origin = [-819.2, 0, 409.6]; w.at(0, 30);
  w.frame();
  assert.deepEqual(at(w.col.adds.at(-1).m), heart(), 'moved with the recentre');
  assert.equal(w.col.adds.length, 2, 'once');
  w.frame(); w.frame();
  assert.equal(w.col.adds.length, 2, 'and not again while it stands still');
  // the band: built at 1500 m, let go at 1800 - a recentre there still moves what is drawn
  w.at(0, STAR_BUILD_M + 100); w.frame();
  w.origin = [0, 0, 0]; w.at(0, STAR_BUILD_M + 100);
  w.frame();
  w.draws.length = 0; w.host.draw(w.renderer);
  assert.ok(w.draws.length > 0);
  for (const d of w.draws) assert.deepEqual(at(d.mat), heart(), 'drawn where its heart is');
  assert.deepEqual(at(w.col.adds.at(-1).m), heart());
  Date.now = realNow;
});

test('AUDIT STARFALL R2 THE BEACON IS A SKY THING: seen from across the region its column stands scaled about the eye inside STAR_SKY_R - the far plane never cuts it (mutants: the clamp)', () => {
  const w = world();
  clockOf(w);
  w.t = starTimes(N, 0).fallAt + 5000; w.at(0, 5); w.frame();
  const h = w.heart(0), near = [h[0] + 30, 2, h[2]], far = [h[0] + 9000, 2, h[2] + 4000];
  const b0 = w.host.skyLists(near).beacons[0];
  assert.deepEqual([b0.origin[0], b0.scale], [h[0], 1], 'near: as it stands');
  const b = w.host.skyLists(far).beacons[0], c = skyClamp(far, [h[0], h[1] + 2.5, h[2]]);
  assert.ok(Math.hypot(b.origin[0] - far[0], b.origin[1] - far[1], b.origin[2] - far[2]) <= STAR_SKY_R + 1e-6, 'inside the sky\'s reach');
  assert.deepEqual(b.origin, c.at);
  assert.ok(b.scale < 0.5 && b.scale === c.s, 'its lengths scaled with it');
  Date.now = realNow;
});

test('AUDIT STARFALL R3 THE RING RIDES THE LAND: while it runs, the ground at its inner and outer edge at each bearing over the heart\'s, the crater\'s rim on it, handed to the pass (mutants: the ground read, its edge)', () => {
  const slope = (x, z) => 0.1 * (x - 30000) + 0.05 * (z - 2000);
  const w = world({ surface: slope });
  clockOf(w);
  const T = starTimes(N, 0);
  w.t = T.fallAt + 600; w.at(0, 5); w.frame();
  const ring = w.host.skyLists([0, 2, 0]).rings[0];
  assert.ok(ring && ring.r > 0);
  assert.equal(ring.ground.length, STAR_RING_SEGS * 2);
  const h = w.heart(0), y0 = slope(h[0], h[2]);
  for (const i of [0, 5, 13, 31]) {
    const a = (i / STAR_RING_SEGS) * 2 * Math.PI;
    for (const j of [0, 1]) {
      const rr = j ? ring.r + STAR_RING_WIDTH_M : Math.max(0, ring.r - STAR_RING_WIDTH_M);
      const want = slope(h[0] + Math.sin(a) * rr, h[2] + Math.cos(a) * rr) - y0 + rimAt(rr);
      assert.ok(Math.abs(ring.ground[i * 2 + j] - want) < 1e-3, `bearing ${i}, edge ${j}`);
    }
  }
  w.t = T.fallAt + 5000;
  assert.deepEqual(w.host.skyLists([0, 2, 0]).rings, [], 'run: nothing read');
  Date.now = realNow;
});

test('AUDIT STARFALL R4 THE FLOOR PULLED TOWARD THE EYE: the crater\'s floor and rim a mesh of their own, drawn under the ground marks\' polygon offset and the state put back; the stone and its thread without it (mutants: the offset)', () => {
  const w = world({ gfx: true });
  clockOf(w);
  w.t = starTimes(N, 0).fallAt + 5000; w.at(0, 30);
  w.frame();
  assert.equal(w.star(0).floor, true);
  w.gl.calls.length = 0; w.draws.length = 0;
  assert.equal(w.host.draw(w.renderer), 2);
  const [stone, floor] = w.draws;
  assert.equal(stone.offset, false, 'the stone as it is');
  assert.equal(floor.offset, true, 'the floor pulled forward');
  assert.deepEqual(w.gl.calls.filter(([k]) => k === 'polygonOffset'), [['polygonOffset', ...STAR_FLOOR_OFFSET], ['polygonOffset', 0, 0]]);
  assert.deepEqual(w.gl.calls.at(-2), ['disable', 'POLYGON_OFFSET_FILL'], 'put back');
  Date.now = realNow;
});

test('AUDIT STARFALL R7 THE LANDING HEARD ITS DISTANCE LATE, FROM WHERE IT IS: the stone\'s strike comes with the thunder, never with the flash, and both from the heart as it stands when they arrive - a recentre between moves them (mutants: the strike\'s delay, the heart read late)', () => {
  const w = world();
  clockOf(w);
  const T = starTimes(N, 0), d = 500;
  w.t = T.fallAt + 10; w.at(0, d); w.frame();
  assert.deepEqual(w.heard, [], 'nothing with the flash');
  w.origin = [-819.2, 0, 0]; w.at(0, d);
  w.t = T.fallAt + thunderOf(d).delay * 1000 + 20; w.frame();
  const impact = w.heard.find((x) => x.clip === STAR_SOUNDS.impact.clip), thunder = w.heard.find((x) => x.clip === thunderOf(d).clip);
  assert.ok(impact && thunder, 'both, at its distance');
  assert.deepEqual(impact.pos, w.heart(0), 'the strike at the heart where it stands now');
  assert.deepEqual(thunder.pos, thunderSourceAt(w.feet, w.heart(0)[0], w.heart(0)[2]), 'the thunder from its bearing now');
  Date.now = realNow;
});

test('AUDIT STARFALL R8 A FIRST LEDGER IS TAKEN IN SILENTLY: a page that comes to a star mid-fight hears no wave called and no low light, its next move it does (mutants: the silence)', () => {
  const w = world();
  clockOf(w);
  watchMids();
  w.t = starTimes(N, 0).fallAt + 500; w.at(0, 5); w.frame();
  const sounds = w.sounds.length;
  w.st(0, { p: P_WAVE, w: 3, wz: 4, lt: 10 });
  assert.deepEqual(mids, [], 'mid-wave: no wave called, no low light said');
  assert.equal(w.sounds.length, sounds);
  w.st(0, { p: P_LOST, lt: 0, why: STAR_LOST_DARK });
  assert.ok(mids.includes(STAR_AT_TEXT.lost()), 'what moves from then on is said');
  Date.now = realNow;
});

test('AUDIT STARFALL R9 THE COARSE GROUND READ ONCE, THE PASS BUILT AT IDLE: a star over an unbuilt pixel asks the coarse ground once in STAR_COARSE_EVERY frames; the sky\'s three programs are built in idle time, never in the frame of the first omen (mutants: the cache, the warm)', async () => {
  let asks = 0;
  const w = world({ surface: () => NaN, coarse: () => { asks++; return 12; } });
  clockOf(w);
  w.t = starTimes(N, 0).omenAt + 1000; w.frame();
  for (let i = 0; i < 50; i++) w.frame();
  assert.equal(asks, 1, 'once for the night\'s one star');
  assert.equal(w.host.state()[0].heart[1], 12, 'and its heart on it');
  for (let i = 0; i < STAR_COARSE_EVERY; i++) w.frame();
  assert.equal(asks, 2, 'and again a while on');
  const idle = [], had = globalThis.requestIdleCallback;
  globalThis.requestIdleCallback = (fn) => { idle.push(fn); return idle.length; };
  try {
    const g = world({ gfx: true, t: starTimes(N, 0).omenAt + 1000 });
    clockOf(g);
    const programs = () => g.gl.calls.filter(([k]) => k === 'createProgram').length;
    g.frame(); g.frame();
    assert.equal(programs(), 0, 'nothing compiled in the frame');
    while (idle.length) { idle.shift()(); await settle(); }
    assert.equal(programs(), 3, 'its three programs, at idle');
    g.frame();
    assert.equal(programs(), 3, 'once');
  } finally { if (had) globalThis.requestIdleCallback = had; else delete globalThis.requestIdleCallback; }
  Date.now = realNow;
});

test('AUDIT STARFALL THE GRACE, ONE TIME: this screen says its last word at the deadline (the grace is a word\'s flight), but the star is not dark until the grace is out (starLostAt) - a hold said in it turns it gold from lit, never from dark; past the grace it is dark (mutants: the grace)', async () => {
  const beaconAt = (w, k) => { const h = w.heart(k); return w.host.skyLists([h[0] + 20, 2, h[2]]).beacons.find((b) => Math.abs(b.origin[0] - h[0]) < 1e-6 && Math.abs(b.origin[2] - h[2]) < 1e-6) ?? null; };
  const fight = async (w) => {
    clockOf(w);
    w.t = starTimes(N, 1).fallAt + 500; w.at(1, 5); w.frame();
    w.st(1, { p: P_GATHER, w: 0, wz: 0 });
    w.st(1, { p: P_MASTER, w: 4, wz: 0, b: 1, nd: 1 });
    await w.beat();
  };
  const T = starTimes(N, 1);
  const w = world();
  await fight(w);
  w.t = T.endAt + 500;
  const said = w.words.length;
  w.frame();
  assert.equal(w.star(1).phase, 'after', 'past its deadline');
  assert.equal(w.words.length, said, 'no word past the deadline: what was said as it came is in flight');
  assert.equal(w.star(1).own, false, 'its defense down');
  assert.ok(beaconAt(w, 1)?.fade > 0 && beaconAt(w, 1).held === false, 'its beacon lit in the grace, never dark before it is out');
  w.st(1, { p: P_HELD, hd: w.t });
  w.frame();
  assert.equal(beaconAt(w, 1).held, true, 'a hold in the grace: gold');
  const d = world();
  await fight(d);
  d.t = T.endAt + 500; d.frame();
  assert.ok(beaconAt(d, 1)?.fade > 0);
  d.t = starLostAt(N, 1) + 10; d.frame();
  assert.equal(beaconAt(d, 1), null, 'past the grace, unheld: its beacon out');
  assert.equal(starLostAt(N, 1), T.endAt + STAR_GRACE_MS);
  Date.now = realNow;
});

test('STAR-TUNE THE COVEN STANDS AS AN EVENT\'S (the owner, of the first run: "the enemies are too few and die too quickly"; "The dirt mound where the star is crashed can be walked through"): a wave\'s foes and its circle\'s stand with STAR_FOE_HEALTH times their health, the master as the elite it is, a foe handed to me as its owner stood it; the crater - floor, rim and stones with the stone - is the collider\'s, through the late-solid gate: a body standing on the rim as it is built is not closed in, and the rim stands once the body is clear; a stand is read from over the rim\'s crest, so a foe stood on it lands on it (mutants: STAR-TUNE-the-coven-as-the-road; STAR-TUNE-the-master-toughened; STAR-TUNE-the-crater-hollow; STAR-TUNE-the-gate-passed; STAR-TUNE-a-stand-under-the-rim)', async () => {
  const w = world({ gfx: true });
  clockOf(w);
  const T = starTimes(N, 2), sites = w.sites(2);
  // a body on the rim's crest as the crater builds: held back, never closed on it
  const h = w.heart(2), onRim = [h[0] + STAR_CRATER_R, h[1], h[2]];
  const late = lateSolidsOf(w.col);
  late.settle({ pos: onRim, height: 1.8 });
  w.t = T.fallAt + 500; w.feet = [...onRim];
  w.frame(); w.frame();
  const star = (b) => typeof b === 'string' && b.startsWith(`star:${N}.2@`);   // this star's bucket (the night's others stand, no body in their rims)
  assert.equal(w.col.adds.filter((a) => star(a.b)).length, 0, 'withheld while the body stands in its rim');
  assert.equal(late.settle({ pos: [h[0] + 40, h[1], h[2]], height: 1.8 }), 1, 'clear of it, it stands');
  const solid = w.col.adds.filter((a) => star(a.b)).at(-1);
  assert.equal(solid.tris, buildStarModel(N, 2, () => 0, { thread: false }).indices.length / 3, 'the stone AND its crater - floor, rim and stones');
  assert.ok(solid.tris > buildStarModel(N, 2, () => 0, { ground: false, thread: false }).indices.length / 3, 'more than the stone alone');
  // the waves: twice their health; stood on what is highest at their place
  w.col.surfaceHit = (o) => (o[1] > STAR_RIM_H ? { dist: o[1] - 0.8 } : null);   // a surface 0.8 over the land wherever it is asked from above
  w.at(2, 5);
  w.st(2, { p: P_WAVE, w: 1, wz: 4, kn: 0, b: 1 });
  await w.beat();
  const wave = w.foes.stood.filter((f) => f && f.site === sites.base);
  assert.equal(wave.length, 4);
  for (const f of wave) {
    assert.deepEqual([f.entity.maxHealth, f.entity.health, f.entity.healthMult], [100 * STAR_FOE_HEALTH, 100 * STAR_FOE_HEALTH, STAR_FOE_HEALTH], 'the coven\'s, no foe of the road');
    assert.ok(Math.abs(f.ai.feet[1] - (h[1] + 0.8)) < 1e-6, `stood on the surface read from above (${f.ai.feet[1]})`);
    assert.equal(f.opts.groundAlign.hitDist, 0.2, 'its drop from just over it');
    assert.equal(f.opts.grantKind, 'star', 'a grant of the star\'s own kind - a wave of any size its law gives, one ask');
  }
  // AUDIT STAR-TUNE F1: a relay before the star's kind (the site live first) is asked the stand's own - main's, a wave of nine at most
  w.session.starGrantOk = false;
  w.st(2, { p: P_WAVE, w: 2, wz: 5, kn: 0, b: 1 });
  await w.beat();
  const older = w.foes.stood.filter((f) => f && f.site === sites.base).slice(wave.length);
  assert.equal(older.length, 5, 'the next wave stands on an older relay too');
  for (const f of older) assert.equal(f.opts.grantKind, undefined, 'its own shape\'s kind (net/grantLaw.js grantKindOf), never one the relay refuses');
  w.session.starGrantOk = true;
  // the master: an elite's own health; its circle the coven's
  w.st(2, { p: P_MASTER, w: 4, wz: 0, kn: 0, b: 1, nd: 1 });
  await w.beat();
  const master = w.foes.stood.find((f) => f && f.site === sites.m);
  assert.equal(master.entity.maxHealth, 100, 'the master as the elite it is - the pool\'s own, never twice');
  master.entity.health = 100 * STAR_CIRCLE_AT[0];
  await w.beat();
  const circle = w.foes.stood.filter((f) => f && f.site === sites.c);
  assert.ok(circle.length > 0);
  for (const f of circle) assert.equal(f.entity.maxHealth, 100 * STAR_FOE_HEALTH, 'its circle the coven\'s');
  Date.now = realNow;
});

test('AUDIT STAR-TUNE F4 A CRATER BUILT AGAIN ASKS THE BODY AGAIN: the ground under a standing crater built finer (a player walking up to it) makes the crater anew - a new solid, withheld while the body stands in its rim, never stood round it; a recentre alone puts the same solid back (mutants: AUDIT-STAR-TUNE-F4-the-rebuild-replaced)', () => {
  let H = null, bump = 0;
  const w = world({ gfx: true, surface: (x, z) => (H && Math.hypot(x - H[0], z - H[2]) > 2 ? bump : 0) });
  clockOf(w);
  const T = starTimes(N, 2);
  const h = w.heart(2), onRim = [h[0] + STAR_CRATER_R, h[1], h[2]], away = [h[0] + 40, h[1], h[2]];
  H = [h[0] - w.origin[0], h[1], h[2] - w.origin[2]];
  const late = lateSolidsOf(w.col);
  const star = (b) => typeof b === 'string' && b.startsWith(`star:${N}.2@`);
  late.settle({ pos: away, height: 1.8 });
  w.t = T.fallAt + 500; w.feet = [...away];
  w.frame(); w.frame();
  const stood = () => w.col.adds.filter((a) => star(a.b)).length;
  assert.equal(stood(), 1, 'the crater stands, nobody in its rim');
  // the body walks onto the rim; the ground under the crater is built finer
  late.settle({ pos: onRim, height: 1.8 }); w.feet = [...onRim];
  bump = 0.5;
  for (let i = 0; i <= STAR_GROUND_EVERY; i++) w.frame();
  assert.ok(w.col.removes.some(star), 'the old crater taken down');
  assert.equal(stood(), 1, 'the new one withheld while the body stands in its rim - never stood round it');
  assert.equal(late.settle({ pos: away, height: 1.8 }), 1, 'clear of it, the new crater stands');
  assert.equal(stood(), 2);
  Date.now = realNow;
});
