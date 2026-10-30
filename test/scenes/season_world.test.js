// STOREFRONT (2026-10-29, the brief: "world changes with new dwemer enemies/boss/weapon"; bible/06-Systems/Battle-Pass.md
// section 6): THE SEASON IN THE WORLD, END TO END - its law (systems/pass/seasonWorld.js: the tremor's clock, the stage's
// Brass Fissures over the gate's scan, their camps on the camp law), the Resonant Maul (systems/pass/resonantMaul.js:
// lawful, unrolled), a fissure made (world/fissureModel.js, fissureArt.js), and the host (scenes/seasonHost.js) on
// the world's bindings by name: the pass's notices, the tremor felt, a fissure built where the law puts it, breathing and
// humming, its camp stood and shared, cleared and quiet, the Colossus and its Maul once a day, the gate given way to,
// the map's cards and the rock's clearings; the held map's brass cog; and the world host's wiring. tools/mutants/storefront.json.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

import {
  seasonStageAt, tremorAt, stageFissures, regionFissures, fissureUnderGate, fissureRoster, TREMOR_MS, TREMOR_KICK, TREMOR_EVERY_MS,
  FISSURES_BY_STAGE, FISSURE_APART_PX, HEART_ESCORT, FISSURE_ROSTER, COLOSSUS_MOBILE,
} from '../../src/systems/pass/seasonWorld.js';
import { passSeasonById, PASS_CONSTRUCT_MOBILES } from '../../src/net/battlePassLaw.js';
import { WOD_SITE_RE, isBrassSite, brassSiteId } from '../../src/world/worldOfDaggerfall/wodShared.js';
import { RESONANT_MAUL, mintResonantMaul } from '../../src/systems/pass/resonantMaul.js';
import { itemFindings } from '../../src/systems/item/itemLaw.js';
import { applyRarity, legendariesFor, powerOf, LEGENDARY_POWERS } from '../../src/systems/loot/lootRarity.js';
import { codexRows } from '../../src/systems/loot/lootCodex.js';
import { buildFissureModel, fissureLayout, fissureVents, FISSURE_LEN } from '../../src/world/fissureModel.js';
import { fissureArt, FISSURE_ARCHIVE, FISSURE_REC, FISSURE_ART_SIZE } from '../../src/world/fissureArt.js';
import { pseudoArchiveOwner } from '../../src/world/eliteGates/pseudoArchives.js';
import { createSeasonHost, SEASON_QUIET_MS, SEASON_ORPHAN_MS, SEASON_LEAVE_M, COLOSSUS_HEALTH, COLOSSUS_TRAITS, TREMOR_KICK_MS, fissureBucket } from '../../src/scenes/seasonHost.js';
import { TREMOR_TEXT, COLOSSUS_TEXT, FISSURE_TEXT } from '../../src/systems/pass/seasonWords.js';
import { gateClearSet, FISSURE_ROCK_M } from '../../src/world/gate/gateClearance.js';
import { readFissureMarksIn } from '../../src/ui/fissureMapMark.js';
import { paintFissureMark } from '../../src/ui/ink/inkMap.js';
import { midScreenText } from '../../src/ui/midScreenText.js';
import { accountRefusalText } from '../../src/net/accountClient.js';
import { reportPlayerKill } from '../../src/systems/playerKills.js';
import { _resetPassClientForTests } from '../../src/systems/pass/passClient.js';
import { passChallengeText } from '../../src/ui/passText.js';
import { gateScanner } from '../../src/systems/gate/gateSite.js';
import { HAS_ARENA2, ARENA2, loadMaps } from '../arena1Data.mjs';
import { WoodsFile } from '../../src/formats/woodsFile.js';

const S1 = passSeasonById('s1');
const HEART_T = S1.stages[2].fromMs + 30 * 60_000;   // mid-hour in the third stage: no tremor
const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const settle = async () => { for (let i = 0; i < 8; i++) await new Promise((r) => setImmediate(r)); };
const seeded = (s = 9) => () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };

/** Two regions of 400 pixels each, every pixel its own town's (the Starfall's test scan). */
function scanOf(regions = [17, 23]) {
  const byRegion = new Map(), townAt = new Int32Array(1000 * 500).fill(-1), towns = [];
  regions.forEach((region, i) => {
    const pixels = [];
    for (let y = 20 + i * 40; y < 40 + i * 40; y++) for (let x = 300; x < 320; x++) { const id = y * 1000 + x; pixels.push(id); townAt[id] = towns.length; towns.push({ name: `Town ${towns.length}`, px: x, py: y, region }); }
    byRegion.set(region, Int32Array.from(pixels));
  });
  return { byRegion, towns, townAt };
}
const SCAN = scanOf();

// ── THE LAW ──────────────────────────────────────────────────────────────────────────────────────────────────────────
test('STOREFRONT the tremor: the first seconds of each hour inside an open stage, its kick swelling to its stage\'s peak a fifth in and dying away, harder each stage; none outside the season (mutants: every stage one force; the tremor all hour)', () => {
  assert.equal(seasonStageAt(S1.fromMs - 1), null);
  assert.equal(seasonStageAt(S1.toMs), null);
  assert.deepEqual(S1.stages.map((s) => seasonStageAt(s.fromMs + 1)?.stage), [0, 1, 2]);
  for (const [i, st] of S1.stages.entries()) {
    const hour = Math.ceil((st.fromMs + 1) / TREMOR_EVERY_MS) * TREMOR_EVERY_MS;
    assert.equal(tremorAt(hour).kick, 0, 'it swells from nothing');
    assert.ok(Math.abs(tremorAt(hour + TREMOR_MS * 0.2).kick - TREMOR_KICK[i]) < 1e-9, `stage ${i}: its peak`);
    assert.ok(tremorAt(hour + TREMOR_MS * 0.9).kick < TREMOR_KICK[i] * 0.2, 'dying away');
    assert.equal(tremorAt(hour + TREMOR_MS), null, 'over');
    assert.equal(tremorAt(hour + TREMOR_MS * 0.5).stage, i);
  }
  assert.ok(TREMOR_KICK[0] < TREMOR_KICK[1] && TREMOR_KICK[1] < TREMOR_KICK[2]);
  assert.equal(tremorAt(Math.ceil(S1.toMs / TREMOR_EVERY_MS) * TREMOR_EVERY_MS + 10), null);
});

test('STOREFRONT the Brass Fissures: each region\'s by the stage over the gate\'s scan, the same every run, apart; the third stage\'s first its Heart Fissure with a Colossus\'s site; every site the camp law\'s; a fissure gives way to the day\'s gate beside it (mutants: the fissures bunched; a heart in the first stage; the gate ignored)', () => {
  for (const stage of [0, 1, 2]) {
    const list = stageFissures(1, stage, SCAN);
    assert.deepEqual(stageFissures(1, stage, SCAN), list, 'the same on every machine');
    for (const region of [17, 23]) {
      const mine = list.filter((f) => f.region === region);
      assert.equal(mine.length, FISSURES_BY_STAGE[stage], `stage ${stage} region ${region}`);
      for (const a of mine) for (const b of mine) if (a !== b) assert.ok(Math.max(Math.abs(a.px - b.px), Math.abs(a.py - b.py)) >= FISSURE_APART_PX, 'apart');
      for (const f of mine) {
        assert.ok(SCAN.byRegion.get(region).includes(f.py * 1000 + f.px), 'on a pixel the scan found');
        assert.ok(WOD_SITE_RE.test(f.site) && isBrassSite(f.site));
        assert.equal(f.heart, stage === 2 && f.k === 0);
        assert.equal(f.hSite, f.heart ? brassSiteId(f.px, f.py, stage, f.k, 'h') : null);
        if (f.hSite) assert.ok(WOD_SITE_RE.test(f.hSite));
        assert.equal(f.near, `Town ${SCAN.townAt[f.py * 1000 + f.px]}`);
        assert.ok(f.spot.every((v) => v > 200 && v < 620), 'inside its pixel, the gate\'s spread');
      }
    }
  }
  assert.notDeepEqual(stageFissures(1, 0, SCAN).map((f) => f.px), stageFissures(1, 1, SCAN).map((f) => f.px), 'a stage its own places');
  assert.deepEqual(regionFissures(1, 0, 99, SCAN), [], 'a region the scan has none of');
  const f = stageFissures(1, 0, SCAN)[0];
  assert.equal(fissureUnderGate(f, { px: f.px + 1, py: f.py - 1 }), true, 'the gate beside it');
  assert.equal(fissureUnderGate(f, { px: f.px + 2, py: f.py }), false);
  assert.equal(fissureUnderGate(f, null), false);
  assert.deepEqual(fissureRoster(stageFissures(1, 2, SCAN).find((x) => x.heart)), HEART_ESCORT);
  assert.deepEqual(FISSURE_ROSTER.map((r) => r.every((m) => PASS_CONSTRUCT_MOBILES.includes(m))), [true, true, true], 'the season\'s constructs');
  assert.ok(PASS_CONSTRUCT_MOBILES.includes(COLOSSUS_MOBILE));
  assert.equal(WOD_SITE_RE.test('1,2:brass.0.12'), false, 'one digit');
  assert.equal(WOD_SITE_RE.test('1,2:brass.3.0'), false, 'three stages');
});

test('STOREFRONT the Brass Fissures on the player\'s map: every Bay region the gate\'s scan finds room in has its stage\'s fissures, on suitable pixels', { skip: HAS_ARENA2 ? false : 'no ARENA2 (sh tools/fetch-data.sh, then ARENA2_PATH)' }, () => {
  const woods = new WoodsFile();
  woods.load(new Uint8Array(readFileSync(join(ARENA2, 'WOODS.WLD'))));
  const scan = gateScanner(loadMaps(), { heightAt: (x, y) => woods.getHeightMapValue(x, y) }).step();
  const list = stageFissures(1, 2, scan);
  assert.ok(list.length >= scan.byRegion.size * 2, `${list.length} fissures over ${scan.byRegion.size} regions`);
  for (const f of list) assert.ok(scan.byRegion.get(f.region).includes(f.py * 1000 + f.px));
  assert.equal(list.filter((f) => f.heart).length, [...scan.byRegion.values()].filter((p) => p.length).length, 'a Heart Fissure a region');
});

// ── THE MAUL ─────────────────────────────────────────────────────────────────────────────────────────────────────────
test('STOREFRONT the Resonant Maul: a Dwarven warhammer of the Legendary rung, lawful where the item law reads it; no ordinary roll of a warhammer lands on it; its power a bane on the season\'s constructs under Dragonsbane\'s share (mutants: the record rolled; the item unlawful)', () => {
  const m = mintResonantMaul(seeded(3));
  assert.deepEqual([m.templateIndex, m.material, m.rarity, m.legendary, m.name, m.isIdentified], [126, 4, 'legendary', 'resonant-maul', 'The Resonant Maul', true]);
  assert.deepEqual(itemFindings(m), [], 'lawful');
  // the account service's judge loads the item law alone (server-account/src/judge.js): the record must come with it
  const alone = execFileSync(process.execPath, ['--input-type=module', '-e', "await import('./src/systems/item/itemLaw.js'); const { legendaryById } = await import('./src/systems/loot/lootRarity.js'); process.stdout.write(String(!!legendaryById('resonant-maul')));"], { cwd: new URL('../..', import.meta.url).pathname }).toString();
  assert.equal(alone, 'true', 'the item law brings the record');
  assert.ok(legendariesFor(m).some((l) => l.id === RESONANT_MAUL.id), 'the law knows it');
  const rolls = seeded(11);
  for (let i = 0; i < 400; i++) {
    const it = { ...mintResonantMaul(rolls), legendary: undefined, rarity: undefined, affixes: [], enchantments: [] };
    applyRarity(it, 'legendary', rolls);
    assert.notEqual(it.legendary, RESONANT_MAUL.id, 'never rolled');
  }
  const p = powerOf(RESONANT_MAUL.id);
  assert.deepEqual([p.kind, [...p.foes]], ['bane', [...PASS_CONSTRUCT_MOBILES]]);
  assert.ok(p.pct < LEGENDARY_POWERS.wyrmbane.pct, 'inside THE CEILING HOLDS');
  const row = codexRows().find((r) => r.id === RESONANT_MAUL.id);
  assert.ok(row && row.hint.includes('Colossus'), 'the codex says where it is found');
});

// ── THE FISSURE MADE ─────────────────────────────────────────────────────────────────────────────────────────────────
test('STOREFRONT a fissure made: its art a picture each record, the crack and the earth lit; its model whole and the same for the same fissure, its wreckage clear of the crack and of each other; its vents on the crack (mutants: the pipe on the pillar; the crack unlit)', () => {
  for (const [rec, a] of fissureArt()) {
    assert.deepEqual([a.albedo.width, a.albedo.height], [FISSURE_ART_SIZE, FISSURE_ART_SIZE], `record ${rec}`);
    const lit = (img) => { let n = 0; for (let i = 0; i < img.colors.length; i += 4) if (img.colors[i] + img.colors[i + 1] + img.colors[i + 2] > 0) n++; return n; };
    if (rec === FISSURE_REC.crack) assert.ok(lit(a.emission) > FISSURE_ART_SIZE * FISSURE_ART_SIZE * 0.4, 'the crack\'s aetherium, its seam and its walls');
    if (rec === FISSURE_REC.earth) assert.ok(lit(a.emission) > 0 && lit(a.emission) < FISSURE_ART_SIZE * FISSURE_ART_SIZE * 0.25, 'hairlines, not a glow');
  }
  assert.equal(pseudoArchiveOwner(FISSURE_ARCHIVE)?.name, 'FISSURE_ARCHIVE');
  for (const f of stageFissures(1, 2, SCAN)) {
    const h = (x, z) => 0.03 * x + 0.1 * Math.sin(z);
    const g = buildFissureModel(f, h, { solid: false }), s = buildFissureModel(f, h, { ground: false });
    for (const m of [g, s]) {
      assert.ok(m.indices.length > 300 && [...m.positions, ...m.normals].every(Number.isFinite), f.key);
      assert.ok(m.subMeshes.every((x) => x.textureArchive === FISSURE_ARCHIVE));
    }
    assert.deepEqual(Array.from(buildFissureModel(f, h).positions), Array.from(buildFissureModel(f, h).positions), 'the same fissure, the same model');
    const L = fissureLayout(f);
    const pieces = [...L.cogs.map((c) => [c.x, c.z, c.r * 1.2]), [L.pipe.x, L.pipe.z, 2.5], [L.pillar.x, L.pillar.z, 2.8]];
    for (const [x, z, r] of pieces) assert.ok(Math.abs(z) > 3.5 || Math.abs(x) > FISSURE_LEN / 2 + 0.5 - r * 0.2, `${f.key}: a piece off the crack (${x.toFixed(1)}, ${z.toFixed(1)})`);
    assert.ok(Math.hypot(L.pipe.x - L.pillar.x, L.pipe.z - L.pillar.z) > 5, 'the pipe and the pillar apart');
    for (const [x, z] of fissureVents(f)) assert.ok(L.spine.some((p) => Math.abs(p.x - x) < 1e-9 && Math.abs(p.z - z) < 1e-9), 'a vent on the crack');
  }
});

// ── THE HOST ─────────────────────────────────────────────────────────────────────────────────────────────────────────
/** The foe pool's doors the host uses, recording (the Starfall's test pool). */
function pool() {
  const p = { foes: [], stood: [], dropped: [], reclaimed: [], removed: [], camp: 0 };
  p.newCampId = () => ++p.camp;
  p.spawnFoe = (career, pos, o) => {
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
/** A world with one player and the host on its bindings: a pixel 1000 m, the ground flat, a renderer and a collider that keep
 *  what they are told. */
function world({ t = HEART_T, online = true } = {}) {
  const w = { t, feet: null, said: [], tells: [], shakes: [], bursts: [], heard: [], taken: [], sprung: new Set(), peer: new Set(), peerAgo: 0, forgot: [], storage: memStorage(), struck: true, asks: [], days: new Set() };
  /** the service's Maul door, its day's law (server-account/src/seasonClaim.js - test/server/seasonmaul_service.test.js) */
  const maulApi = { claim: async (rid) => { w.asks.push(rid); const day = Math.floor(w.t / 86_400_000); if (w.days.has(day)) return { ok: false, error: 'taken', status: 409 }; w.days.add(day); return { ok: true, data: { day } }; } };
  w.foes = pool();
  w.meshes = []; w.draws = []; w.adds = []; w.removes = [];
  w.renderer = { meshes: w.meshes, createMesh(m) { const mesh = { m }; w.meshes.push(mesh); return mesh; }, destroyMesh(m) { m.gone = true; }, uploadTexture() {}, uploadEmissionTexture() {}, drawMesh(mesh) { w.draws.push(mesh); } };
  w.col = { addMesh(b, pos, idx) { w.adds.push(b); }, removeBucket(b) { w.removes.push(b); }, surfaceHit: () => null };
  w.host = createSeasonHost({
    renderer: w.renderer,
    state: { pixelTranslation: (px, py, out) => { out[0] = px * 1000; out[1] = 0; out[2] = py * 1000; return out; } },
    exteriorFoes: w.foes, gateScanOf: () => SCAN, warmGateScan: () => {}, surfaceAt: () => 0,
    player: { feetAt: () => w.feet }, walkMode: true, playerSpawned: true, get online() { return online ? {} : null; }, collider: w.col, _sharedOffsetMs: 0, relayNowS: () => Math.floor(w.t / 1000),
    _wodPeerSprung: w.peer, wodPeerHeldAgo: () => w.peerAgo, wodForgetPeer: (s) => { w.forgot.push(s); w.peer.delete(s); },
    wodSprang: (s) => w.sprung.add(s), wodUnsprang: (s) => w.sprung.delete(s),
    chatNotice: (s) => w.tells.push(s), say: (s) => w.said.push(s), shake: (k) => w.shakes.push(k), burst: (r, at, o) => { w.bursts.push([r, o ?? null]); return true; },
    struckAt: () => (w.struck ? 1 : null), take: (item) => w.taken.push(item), who: () => 'acct|char', storage: w.storage, bindPass: false,
    maulApi, rid: () => `${w.asks.length}`.padStart(16, '0'), wait: async () => {}, roads: null,
    audio: { buffers: new Map([['storefront:season-hum', {}], ['storefront:season-tremor', {}]]), play3d: (k, at) => w.heard.push(k) },
    labGrassField: { invalidate() {} }, gamePaused: () => false, townTalk: { hudHidden: false },
  });
  w.sites = () => stageFissures(1, seasonStageAt(w.t).stage, SCAN);
  w.heart = (f) => [f.px * 1000 + f.spot[0], 0, f.py * 1000 + f.spot[1]];
  w.at = (f, m = 0) => { const h = w.heart(f); w.feet = [h[0] + m, 0, h[2]]; };
  w.beat = async () => { w.host.frame(); await settle(); w.host.frame(); };
  return w;
}
let realNow;
test.before(() => { realNow = Date.now; });
test.after(() => { Date.now = realNow; });
const clock = (w) => { Date.now = () => w.t; };

test('STOREFRONT the host\'s tremor: at the hour the stage\'s line once, its rumble, the camera kicked through it every few hundred ms and dust about the feet; nothing past its seconds or off line (mutants: the line every frame; the kick never repeated)', () => {
  const hour = Math.ceil(S1.stages[1].fromMs / TREMOR_EVERY_MS) * TREMOR_EVERY_MS + 3 * TREMOR_EVERY_MS;
  const w = world({ t: hour + 1000 }); clock(w);
  w.feet = [0, 0, 0];
  w.host.frame();
  assert.deepEqual(w.said, [TREMOR_TEXT[1]()]);
  assert.ok(w.heard.includes('storefront:season-tremor'));
  assert.equal(w.shakes.length, 1);
  assert.ok(w.bursts.some(([r]) => r === 'tremor-dust'));   // in the places' pool, by its recipe (render/killFx.js KFX_POOL_OF)
  w.t += TREMOR_KICK_MS - 1; w.host.frame();
  assert.equal(w.shakes.length, 1, 'not every frame');
  w.t += 1; w.host.frame();
  assert.equal(w.shakes.length, 2);
  assert.equal(w.said.length, 1, 'once an hour');
  w.t = hour + TREMOR_MS + 10; w.host.frame();
  assert.equal(w.shakes.length, 2, 'over');
  const off = world({ t: hour + 1000, online: false }); clock(off); off.feet = [0, 0, 0]; off.host.frame();
  assert.deepEqual([off.said, off.shakes], [[], []], 'off line');
});

test('STOREFRONT a fissure on the host: built where the law puts it when the player nears, its wreckage a late solid, its floor drawn pulled forward; its vents breathe and its hum is heard beside it; let go when the player is far (mutants: never built; the collider forgotten; the hum from afar)', async () => {
  const w = world(); clock(w);
  const f = w.sites().find((s) => s.heart);
  w.at(f, 150);
  w.host.frame();
  let st = w.host.state().find((s) => s.key === f.key);
  assert.ok(st?.mesh && st.floor && st.solid, 'built and solid');
  assert.deepEqual(st.heart, w.heart(f));
  assert.deepEqual(w.adds, [fissureBucket(f.key)]);
  assert.equal(w.host.draw(w.renderer), 2);
  assert.ok(w.bursts.filter(([r]) => r === 'fissure-steam').length === 3, 'its three vents');
  assert.ok(!w.heard.includes('storefront:season-hum'), 'its hum is close work');
  w.at(f, 20); w.t += 2200; w.host.frame();
  assert.ok(w.heard.includes('storefront:season-hum'));
  assert.equal(w.host.lights().length, 1, 'the aetherium\'s light');
  assert.ok(w.host.clearing(), 'the grass kept off');
  w.at(f, 900); w.host.frame();
  assert.equal(w.host.state().length, 0, 'let go');
  assert.ok(w.meshes.every((m) => m.gone));
  assert.deepEqual(w.removes, [fissureBucket(f.key)]);
});

test('STOREFRONT a fissure\'s camp: sprung by the first player near, its constructs on a ring, the season\'s and woken together - the Heart Fissure\'s Colossus at its middle a raid leader, three times that health, a boss\'s traits, named on every screen; a peer\'s held camp waited on, an orphaned one taken; walked off, mine taken down (mutants: a peer\'s camp stood over; the Colossus unpromoted)', async () => {
  const w = world(); clock(w);
  const f = w.sites().find((s) => s.heart);
  w.peer.add(f.site); w.peerAgo = 0;
  w.at(f, 30); await w.beat();
  assert.equal(w.foes.stood.length, 0, 'a peer holds it');
  w.peerAgo = SEASON_ORPHAN_MS; w.t += 6000; await w.beat();
  assert.deepEqual(w.forgot, [f.site, f.hSite], 'its owner went quiet: mine to stand');
  assert.deepEqual(w.foes.stood.map((x) => x.mobileType), [...HEART_ESCORT, COLOSSUS_MOBILE]);
  assert.ok(w.sprung.has(f.site) && w.sprung.has(f.hSite));
  assert.ok(w.foes.stood.every((x) => x.entity.passConstruct === true && x.campId === 1 && x.opts.transient && x.opts.placed));
  const col = w.foes.stood.find((x) => x.site === f.hSite);
  assert.equal(col.entity.raidLeader.name, COLOSSUS_TEXT.name());
  assert.ok(col.entity.eliteFoe);
  assert.ok(col.entity.healthMult >= COLOSSUS_HEALTH);
  assert.deepEqual(col.entity.bossTraits, [...COLOSSUS_TRAITS]);
  assert.ok(w.said.includes(COLOSSUS_TEXT.wakes(f.near)));
  const wake = w.bursts.find(([r]) => r === 'fissure-wake');
  assert.ok(wake && Math.abs(wake[1].dir[0] - Math.sin(f.yaw)) < 1e-9 && Math.abs(wake[1].dir[1] - Math.cos(f.yaw)) < 1e-9, 'it wakes along its crack (AUDIT STOREFRONT RENDER L2)');
  // a reader's copy is named by its site
  const copy = { site: f.hSite, puppet: 'peer', mobileType: COLOSSUS_MOBILE, entity: { raidLeader: { name: '' } }, ai: { feet: [0, 0, 0] } };
  w.foes.foes.push(copy); w.host.frame();
  assert.equal(copy.entity.raidLeader.name, COLOSSUS_TEXT.name());
  w.foes.foes.pop();
  w.at(f, SEASON_LEAVE_M + 10); w.host.frame();
  assert.deepEqual(w.foes.dropped, [f.site, f.hSite], 'walked off: mine taken down');
  assert.ok(!w.sprung.has(f.site), 'and its site nobody\'s');
});

test('STOREFRONT the Colossus falls: a character whose blow landed takes the Resonant Maul on the service\'s yes, once a UTC day, its line said - and the day\'s no said too; one who never struck it asks nothing; a camp cleared is quiet a while, then stands again (mutants: a Maul unstruck; the camp stood again at once; the day\'s no unsaid)', async () => {
  const w = world(); clock(w);
  const f = w.sites().find((s) => s.heart);
  w.at(f, 30); await w.beat();
  const kill = () => { for (const x of w.foes.foes) { x.dead = true; x.corpse = {}; } };
  kill(); w.host.frame(); await settle();
  assert.equal(w.taken.length, 1);
  assert.equal(w.taken[0].legendary, RESONANT_MAUL.id);
  assert.ok(w.said.includes(COLOSSUS_TEXT.falls()));
  assert.equal(w.asks.length, 1, 'the service asked once');
  w.t += 6000; await w.beat();
  assert.equal(w.foes.stood.length, 4, 'cleared: quiet');
  w.t += SEASON_QUIET_MS; await w.beat();
  assert.equal(w.foes.stood.length, 8, 'stood again');
  w.foes.foes = w.foes.foes.filter((x) => !x.dead);
  kill(); w.host.frame(); await settle();
  assert.equal(w.taken.length, 1, 'once a day: the service said no');
  assert.equal(midScreenText.text, accountRefusalText('taken'), 'and the player is told why no Maul came');   // AUDIT-STOREFRONT
  w.t += 86_400_000; w.foes.foes = []; await w.beat(); kill(); w.host.frame(); await settle();
  assert.equal(w.taken.length, 2, 'the next day');
  const u = world(); clock(u); u.struck = false;
  u.at(f, 30); await u.beat();
  for (const x of u.foes.foes) { x.dead = true; x.corpse = {}; }
  u.host.frame(); await settle();
  assert.deepEqual([u.taken.length, u.asks.length], [0, 0], 'never struck: nothing asked');
});

test('STOREFRONT the host\'s map, clearings and gate: a card each fissure of the stage, the Heart Fissure\'s its own; the rock\'s clearings one frozen list while the stage stands; a fissure beside the day\'s gate neither built nor stood, its card saying so; off line nothing (mutants: the clearings made every frame; the gate ignored)', async () => {
  const w = world(); clock(w);
  const marks = w.host.mapMarks();
  assert.equal(marks.length, w.sites().length);
  const heart = marks.find((m) => m.heart);
  assert.equal(heart.tip.title, FISSURE_TEXT.heart());
  assert.ok(heart.label.startsWith(`${FISSURE_TEXT.heart()}, Town `));
  assert.equal(w.host.fissureClears(), w.host.fissureClears(), 'one list');
  const set = gateClearSet(null, [], [], w.host.fissureClears());
  assert.equal(set.list.length, w.sites().length);
  assert.ok(set.list.every((c) => c.key.startsWith('brass:') && c.r === FISSURE_ROCK_M));
  assert.equal(readFissureMarksIn(() => marks, { x0: 0, y0: 0, w: 1000, h: 500 }).filter((m) => m.heart).length, 2);
  const off = world({ online: false }); clock(off);
  assert.deepEqual([off.host.mapMarks(), off.host.fissureClears()], [[], []]);
});

test('STOREFRONT the pass\'s notices (PIN MOVED, PASS-PANELS: no levels): a challenge paid said in the chat with its Aurum, and the day\'s Aurum found said once; nothing mid-screen (mutants: a challenge unsaid; its Aurum unsaid; the bound said twice)', async () => {
  _resetPassClientForTests();
  let today = 98;
  const tells = [], mids = [];
  midScreenText.onMessage = (m) => mids.push(m);
  createSeasonHost({
    state: { pixelTranslation: (px, py, out) => out }, get online() { return {}; }, _sharedOffsetMs: 0, chatNotice: (s) => tells.push(s),
    passApi: {
      me: () => 'acct-1', guest: () => false,
      mine: async () => ({ ok: true, data: { season: 's1', open: true, stage: 0, tracks: { free: true, premium: false }, bought: [], today, dayMax: 100, challenges: [] } }),
      find: async () => { const found = Math.min(2, 100 - today); today += found; return { ok: true, data: { gained: found + 150, found, today, done: ['tremor-constructs'], season: 's1' } }; },
    },
  });
  Date.now = () => S1.fromMs + 3600_500;
  await settle();
  reportPlayerKill({ mobileType: PASS_CONSTRUCT_MOBILES[0] });
  await settle();
  reportPlayerKill({ mobileType: PASS_CONSTRUCT_MOBILES[0] });
  await settle();
  const said = tells.filter((s) => s.startsWith('Season challenge done: '));
  assert.ok(said.length >= 1 && said[0].includes(passChallengeText('tremor-constructs')) && said[0].includes('150'), JSON.stringify(tells));
  assert.equal(tells.filter((s) => s.includes('all the Aurum')).length, 1, JSON.stringify(tells));
  assert.deepEqual(mids, [], 'nothing mid-screen');
  midScreenText.onMessage = null;
  _resetPassClientForTests();
});

test('STOREFRONT the held map\'s fissure: a brass cog on its pixel with the crack across it, the Heart Fissure\'s larger and ringed; the map reads, draws, legends and answers a hover for them; the world host wires the season (mutants: no hover; the cog unringed at a heart)', () => {
  const ops = [];
  const ctx = new Proxy({}, { get: (o, k) => (k in o ? o[k] : (...a) => ops.push([k, ...a])), set: (o, k, v) => { o[k] = v; ops.push(['=', k, v]); return true; } });
  const view = { scale: 1, ox: 0, oy: 0, x0: 0, y0: 0, w: 1000, h: 500, cw: 1000, ch: 500 };
  paintFissureMark(ctx, view, { x: 10.5, y: 10.5, heart: false });
  const arcs = ops.filter(([k]) => k === 'arc').length;
  ops.length = 0;
  paintFissureMark(ctx, view, { x: 10.5, y: 10.5, heart: true });
  assert.equal(ops.filter(([k]) => k === 'arc').length, arcs + 1, 'a ring about the heart');
  const H = rd('src/ui/heldMap.js'), I = rd('src/ui/ink/inkMap.js'), W = rd('src/scenes/world.js');
  assert.match(H, /const fissures = readFissureMarksIn\(this\.deps\.fissures, sheet\);/);
  assert.match(H, /fissures: this\._fissures,/);
  assert.match(H, /const fissure = this\._fissureAt\(sx, sy\);/);
  assert.match(I, /for \(const m of opts\.fissures \?\? \[\]\) if \(visible\(m\.x, m\.y\)\) paintFissureMark\(ctx, view, m, pulse\);/);
  assert.match(W, /const passSeason = params\.has\('online'\) \? createSeasonHost\(_eventHostDeps\) : null;/);
  assert.match(W, /const starfall = params\.has\('online'\) \? createStarfallHost\(_eventHostDeps\) : null;/);
  for (const re of [/if \(_mode\(\) === 'exterior'\) passSeason\?\.frame\(\);/, /passSeason\?\.draw\(renderer\);/, /passSeason\?\.destroyAll\(\);/, /fissures: \(\) => passSeason\?\.mapMarks\(\) \?\? \[\],/,
    /passSeason\?\.clearing\(\)/, /starfall\?\.starClears\(\) \?\? null, passSeason\?\.fissureClears\(\) \?\? null\)/]) assert.match(W, re);
  assert.equal((W.match(/\.\.\.\(passSeason\?\.lights\(\) \?\? \[\]\)/g) ?? []).length, 2, 'its light in both of the frame\'s lists');
});
