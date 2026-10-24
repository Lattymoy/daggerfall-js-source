// STAR-CLEAR (2026-10-24, the owner: "The star fall world event has the tendency to fall into mountains and become
// inaccesable"; bible/11-Multiplayer/Starfall.md section 3, AS BUILT STAR-CLEAR) - World of Daggerfall's rock keeps off a
// fallen star. A star's spot is the law's alone (net/starfall/starfallLaw.js starSpotLocal, on the gate's own pixels), and
// the mod stands its rock fields there - of the festival's 1,366 stars, 381 had a piece's mesh box reach within
// STAR_ROCK_M of the heart. So each star keeps a clearing in the gate's own set (world/gate/gateClearance.js gateClearSet's
// `stars`), from its town's naming to its going (scenes/starfall/starfallHost.js starClears), and the gate's sweep and
// build refuse the rock in it. tools/mutants/starclear.json.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  gateClearFor, gateClearSet, gateClearMemo, boxNearGate, pointNearGate, wodSiteOffGate, gateSiteTest, createGateClearSweep,
  STAR_ROCK_M, EG_ARCH_ROCK_M, GATE_CLEAR_M,
} from '../../../src/world/gate/gateClearance.js';
import { createStarfallHost } from '../../../src/scenes/starfall/starfallHost.js';
import { starNightAt, starTimes, starSpotLocal, starInWindow, STAR_HOUR_MS, STAR_PER_NIGHT } from '../../../src/net/starfall/starfallLaw.js';
import { STAR_STAND_R, STAR_WARN_MS } from '../../../src/systems/starfall/starfallClient.js';
import { STAR_BARE_R } from '../../../src/world/starfall/starModel.js';
import { STAR_COVENS } from '../../../src/systems/starfall/starfallCovens.js';
import { findStarSites } from '../../../src/systems/starfall/starfallSites.js';
import { findGateSite, gateScanner } from '../../../src/systems/gate/gateSite.js';
import { FESTIVALS } from '../../../src/net/festivalLaw.js';
import { LocationSession, pickLocations, placeObjects } from '../../../src/world/worldOfDaggerfall/wodLocationLoader.js';
import { decodeRegionPack } from '../../../src/world/worldOfDaggerfall/wodLocationPack.js';
import { loadLocationPrefab, validateValue } from '../../../src/world/worldOfDaggerfall/wodLocationData.js';
import { classifyObject, objectMatrix } from '../../../src/world/worldOfDaggerfall/wodLocationObjects.js';
import { wodPiecewise, wodSiteClear } from '../../../src/world/road/roadClearance.js';
import { pathsDataPoint } from '../../../src/systems/travel/travelPaths.js';
import { transformedAabb } from '../../../src/render/frustum.js';
import { WoodsFile } from '../../../src/formats/woodsFile.js';
import { HAS_ARENA2, ARENA2, ROOT, loadMaps, classicModels } from '../../arena1Data.mjs';
import { hostText } from '../../hostText.mjs';

const FESTIVAL = FESTIVALS[0];
const N = starNightAt(FESTIVAL.fromMs) + 30;
const SKIP = HAS_ARENA2 ? false : 'no ARENA2 (sh tools/fetch-data.sh, then ARENA2_PATH)';
const star = (s, px, py, x, z) => ({ s, px, py, x, z });

test('STAR-CLEAR THE CLEARING: a star keeps STAR_ROCK_M about its heart - its crater\'s earth, the ring its coven stands on and room past it - in the gate\'s own set, keyed by its night and star after the gate\'s and the arches\'; a star alone is a set; a malformed or repeated one is none (mutants: the stars left out of the set; a star\'s reach the arch\'s)', () => {
  assert.equal(STAR_ROCK_M, 28);
  assert.ok(STAR_ROCK_M >= STAR_STAND_R[1] + 8 && STAR_STAND_R[1] > STAR_BARE_R, 'the crater, the stand ring\'s far edge and a foe\'s room past it');
  assert.ok(STAR_ROCK_M > GATE_CLEAR_M && STAR_ROCK_M > EG_ARCH_ROCK_M, 'a coven stands round a star, further out than the gate\'s or an arch\'s own');
  const gate = gateClearFor({ day: 700, px: 10, py: 10, spot: [400, 400] });
  const set = gateClearSet(gate, [{ b: 'aaaaaaaaaaaaaaaa', px: 30, py: 30, x: 50, z: 60 }], [star(`${N}.2`, 40, 41, 300, 500), star(`${N}.0`, 50, 51, 410, 420)]);
  assert.equal(set.key, `${gate.key}|eg:aaaaaaaaaaaaaaaa|star:${N}.0|star:${N}.2`, 'the gate, the arches, then the stars by night and star');
  assert.deepEqual({ ...set.list[2] }, { key: `star:${N}.0`, px: 50, py: 51, x: 410, z: 420, r: STAR_ROCK_M });
  assert.ok(Object.isFrozen(set.list[2]));
  assert.equal(boxNearGate(set, 50, 51, 410 + STAR_ROCK_M - 0.5, 420, 410 + STAR_ROCK_M - 0.5, 420), true, 'inside a star\'s reach');
  assert.equal(boxNearGate(set, 50, 51, 410 + STAR_ROCK_M + 0.5, 420, 410 + STAR_ROCK_M + 0.5, 420), false, 'just past it');
  assert.equal(pointNearGate(set, 51, 51, 410 + STAR_ROCK_M - 819.2 - 1, 420), true, 'from the pixel east of it, its own frame');
  assert.equal(gateClearSet(null, [], [star(`${N}.1`, 5, 6, 1, 2)]).key, `star:${N}.1`, 'a star with no gate');
  assert.equal(gateClearSet(gate, [], []), gate, 'the gate alone is still the gate\'s own clearing');
  assert.equal(gateClearSet(null, [], [null, star(7, 1, 1, 1, 1), star('x', 1.5, 1, 1, 1), star('y', 1, 1, NaN, 1)]), null, 'none malformed');
  assert.equal(gateClearSet(null, [], [star('z', 1, 1, 1, 1), star('z', 2, 2, 2, 2)]).list.length, 1, 'a star once');
});

test('STAR-CLEAR THE MEMO: the world host\'s set is made again only when the gate, the arches or the stars move - the same object while each is the same (mutants: the stars never remake it)', () => {
  const memo = gateClearMemo();
  const gate = gateClearFor({ day: 700, px: 10, py: 10, spot: [400, 400] });
  const arches = Object.freeze([]), stars = Object.freeze([star(`${N}.0`, 50, 51, 410, 420)]);
  const a = memo(gate, arches, stars);
  assert.equal(memo(gate, arches, stars), a, 'nothing moved: the same set');
  assert.equal(a.key, `${gate.key}|star:${N}.0`);
  const b = memo(gate, arches, Object.freeze([...stars, star(`${N}.1`, 60, 61, 1, 2)]));
  assert.notEqual(b, a);
  assert.equal(b.key, `${gate.key}|star:${N}.0|star:${N}.1`, 'a star come');
  assert.equal(memo(gate, null, null), gate, 'none: the gate\'s own');
  assert.equal(memo(null, null, null), null);
});

/** Each coven's region 400 pixels in a block of its own, each pixel its own town's (STAR2's scan, star5_host's). */
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
/** The host on the bindings starClears reads - the gate's scan and the clock. */
function hostAt(clock) {
  return createStarfallHost({
    renderer: null, state: { pixelTranslation: (px, py, out) => { out[0] = px * 100; out[1] = 0; out[2] = py * 100; return out; } },
    exteriorFoes: null, gateScanOf: () => SCAN, warmGateScan: () => {}, surfaceAt: () => 0, player: { feetAt: () => null },
    walkMode: true, playerSpawned: true, online: null, _wodPeerSprung: new Set(), _questRegionIndex: () => -1,
    gamePaused: () => false, townTalk: { hudHidden: false }, collider: null, _sharedOffsetMs: 0, storage: null,
    eventNotice: () => {}, audio: { playOneShot() {}, play3d() {} },
  });
}

test('STAR-CLEAR THE HOST\'S STARS: each star\'s clearing stands from STAR_WARN_MS before it falls (its town first named) until it is gone, at its pixel and the law\'s spot; the same frozen list while the same stars stand, read again once a second at most; none outside the festival (mutants: from the omen alone; kept past its going; a new list every ask)', () => {
  const realNow = Date.now;
  let t = 0;
  Date.now = () => t;
  try {
    const host = hostAt();
    const sites = sitesOf(N);
    assert.equal(sites.length, STAR_PER_NIGHT);
    const T0 = starTimes(N, 0);
    t = FESTIVAL.fromMs - 10 * STAR_HOUR_MS;
    assert.deepEqual(host.starClears(), [], 'before the festival: none');
    // the hour before night N's first star is named: the night before's stars are all gone
    t = T0.fallAt - STAR_WARN_MS - 5000;
    assert.ok(!host.starClears().some((c) => c.s === `${N}.0`), 'not yet named: no clearing');
    t = T0.fallAt - STAR_WARN_MS - 1;
    const before = host.starClears();
    assert.ok(!before.some((c) => c.s === `${N}.0`), 'a moment before it is named: none yet');
    t = T0.fallAt - STAR_WARN_MS + 500;
    assert.equal(host.starClears(), before, 'read again once a second at most: named half a second on, the list last read stands');
    t = T0.fallAt - STAR_WARN_MS + 999;   // a second after the last read
    const named = host.starClears();
    const c0 = named.find((c) => c.s === `${N}.0`);
    assert.ok(c0, 'named on the Timers row and the board: its clearing stands');
    const s0 = sites.find((s) => s.k === 0);
    assert.deepEqual({ ...c0 }, { s: `${N}.0`, px: s0.px, py: s0.py, x: s0.spot[0], z: s0.spot[1] }, 'its pixel and its heart in it');
    assert.deepEqual(s0.spot, starSpotLocal(N, 0), 'the law\'s own spot');
    assert.ok(Object.isFrozen(named) && Object.isFrozen(c0));
    t += 500;
    assert.equal(host.starClears(), named, 'read again once a second at most');
    t += 2000;
    assert.equal(host.starClears(), named, 'the same stars: the same list (the world host\'s set is not made again)');
    t = T0.omenAt;
    assert.ok(host.starClears().some((c) => c.s === `${N}.0`), 'its omen');
    t = T0.fallAt + 1;
    assert.ok(host.starClears().some((c) => c.s === `${N}.0`), 'fallen, defended');
    t = T0.goneAt - 1000;
    assert.ok(host.starClears().some((c) => c.s === `${N}.0`), 'held or lost, still standing');
    t = T0.goneAt;   // a second on: read again
    assert.ok(!host.starClears().some((c) => c.s === `${N}.0`), 'gone: its clearing with it');
    // every star of the night, each in its own time
    for (let k = 0; k < STAR_PER_NIGHT; k++) {
      const T = starTimes(N, k);
      t = T.fallAt - STAR_WARN_MS + 1500;
      assert.ok(host.starClears().some((c) => c.s === `${N}.${k}`), `star ${k} named`);
    }
    t = FESTIVAL.toMs + 10 * STAR_HOUR_MS;
    assert.deepEqual(host.starClears(), [], 'the festival over and its last stars gone: none');
  } finally { Date.now = realNow; }
});

test('STAR-CLEAR THE SWEEP: a star come builds again the pixel whose rock reaches its heart and only it; a star gone builds again the pixel it cost a piece - the gate\'s own sweep, a star a member like an arch', () => {
  const gate = gateClearFor({ day: 700, px: 10, py: 10, spot: [400, 400] });
  const sweep = createGateClearSweep();
  const near = { px: 50, py: 51, gateClearKey: gate.key, gateRefused: false, wodReach: [400, 400, 430, 425, 0] };
  const far = { px: 50, py: 52, gateClearKey: gate.key, gateRefused: false, wodReach: [5, 5, 5, 5, 0] };
  const built = new Map([['n', near], ['f', far]]);
  assert.deepEqual(sweep.step(gate, built), [], 'the gate alone, as built');
  const withStar = gateClearSet(gate, [], [star(`${N}.0`, 50, 51, 410, 420)]);
  assert.deepEqual(sweep.step(withStar, built), [near], 'the star come: the pixel whose boulder reaches its heart is built again');
  assert.equal(far.gateClearKey, withStar.key, 'the far pixel marked current');
  near.gateClearKey = withStar.key; near.gateRefused = true; near.wodReach = [5, 5, 5, 5, 0];
  assert.deepEqual(sweep.step(gate, built), [near], 'the star gone: the rock it cost comes back');
});

/** World of Daggerfall's shipped lists in the room's order (17 first, then ascending) and its prefabs - online's Mountains off. */
function wodLists() {
  const V = join(ROOT, 'vendor/world-of-daggerfall');
  const rb = (n) => new Uint8Array(readFileSync(join(ROOT, 'vendor/roads-hazelnut', n)));
  const net = { roads: rb('roadData.bytes'), tracks: rb('trackData.bytes') };
  const prefabs = new Map();
  for (const f of readdirSync(join(V, 'LocationPrefab'))) prefabs.set(f.replace(/\.txt$/, ''), loadLocationPrefab(readFileSync(join(V, 'LocationPrefab', f), 'utf8')));
  const session = new LocationSession();
  const regions = readdirSync(join(V, 'Locations')).map((f) => [parseInt(f, 10), f]).sort((a, b) => (a[0] === 17 ? -1 : b[0] === 17 ? 1 : a[0] - b[0]));
  for (const [r, f] of regions) session.appendRegion(r, decodeRegionPack(new Uint8Array(readFileSync(join(V, 'Locations', f)))));
  const getPrefab = (n) => (/^WOD_Mountain_/.test(n ?? '') ? null : prefabs.get(n) ?? null);
  return { net, session, getPrefab, paths: (a, b) => pathsDataPoint(net, a, b) };
}

test('STAR-CLEAR over the shipped lists: a star\'s spot DOES land in the mod\'s rock, and its clearing leaves no whole site the mod stands within it - the rock fields\' pieces the placement\'s, box by box', () => {
  const { net, session, getPrefab, paths } = wodLists();
  const pixels = [];
  const seen = new Set();
  for (let i = 0; i < session.count; i++) { const k = session.worldX[i] + session.worldY[i] * 1000; if (!seen.has(k)) { seen.add(k); pixels.push([session.worldX[i], session.worldY[i]]); } }
  const tile = (x, y) => ({ mapPixelX: x, mapPixelY: y, hasLocation: false, worldHeight: 10 });
  let spots = 0, hit = 0, refused = 0, leftWhole = 0, left = 0;
  for (let n = N; n < N + 1500; n++) for (let k = 0; k < STAR_PER_NIGHT; k++) {
    const [x, y] = pixels[((n * 3 + k) * 7919) % pixels.length];
    const [sx, sz] = starSpotLocal(n, k);
    const clear = gateClearSet(null, [], [star(`${n}.${k}`, x, y, sx, sz)]);
    spots++;
    let within = 0;
    for (const p of pickLocations(tile(x, y), session, getPrefab, paths, null)) for (const o of p.prefab.obj) if (Math.abs(o.pos.y) <= 1000 && pointNearGate(clear, x, y, p.rect.x * 6.4 + o.pos.x, p.rect.y * 6.4 + o.pos.z)) within++;
    if (within) hit++;
    const ledger = { refused: false, reach: [] };
    for (const p of pickLocations(tile(x, y), session, getPrefab, paths, (nm, pf, r) => wodSiteClear(net, x, y, nm, pf, r) && gateSiteTest(clear, x, y, ledger)(nm, pf, r))) {
      const whole = !wodPiecewise(session.prefab[p.index]);
      assert.ok(!whole || wodSiteOffGate(clear, x, y, session.prefab[p.index], p.prefab, p.rect));
      for (const o of p.prefab.obj) {
        if (Math.abs(o.pos.y) > 1000 || !pointNearGate(clear, x, y, p.rect.x * 6.4 + o.pos.x, p.rect.y * 6.4 + o.pos.z)) continue;
        if (whole) leftWhole++; else left++;
      }
    }
    if (ledger.refused) refused++;
  }
  assert.ok(hit >= 100, `of ${spots} star spots on the pixels the lists name, ${hit} stand within ${STAR_ROCK_M} m of a piece the mod stands`);
  assert.ok(refused > 0, `the pick refused a whole site at ${refused} of them`);
  assert.equal(leftWhole, 0, 'no camp, fort, shrine, ruin, cave or nature spot stands in a star\'s clearing once its pick is asked');
  assert.ok(left > 0, `the rock fields' pieces are the placement's to refuse, box by box: ${left} such positions`);
});

test('STAR-CLEAR on the player\'s map: of the festival\'s real stars, the mod\'s rock reaches the heart of hundreds - and with each star\'s clearing the build stands none of it there (the pick\'s site test and the placement\'s box test, the gate\'s own)', { skip: SKIP }, () => {
  const maps = loadMaps();
  const woods = new WoodsFile();
  woods.load(new Uint8Array(readFileSync(join(ARENA2, 'WOODS.WLD'))));
  const scan = gateScanner(maps, { heightAt: (x, y) => woods.getHeightMapValue(x, y) }).step();
  const { net, session, getPrefab, paths } = wodLists();
  const models = classicModels(), boxes = new Map();
  const boxOf = (id) => {
    if (!boxes.has(id)) {
      const m = models(id);
      let b = null;
      if (m) { b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]; for (let i = 0; i < m.positions.length; i += 3) for (let j = 0; j < 3; j++) { b[j] = Math.min(b[j], m.positions[i + j]); b[j + 3] = Math.max(b[j + 3], m.positions[i + j]); } }
      boxes.set(id, b);
    }
    return boxes.get(id);
  };
  const tile = (x, y) => ({ mapPixelX: x, mapPixelY: y, hasLocation: false, worldHeight: woods.getHeightMapValue(x, y), regionIndex: maps.getRegionIndexAt(x, y) });
  /** Does a model the mod stands about (sx, sy) reach the clearing - with the clearing asked at the pick (`asked`), or not? */
  const reaches = (s, clear, asked) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = s.px + dx, y = s.py + dy;
      const siteClear = (nm, pf, r) => wodSiteClear(net, x, y, nm, pf, r) && (!asked || gateSiteTest(clear, x, y, { refused: false, reach: [] })(nm, pf, r));
      for (const p of pickLocations(tile(x, y), session, getPrefab, paths, siteClear)) {
        for (const { obj, pos } of placeObjects(p, 0, validateValue)) {
          const c = classifyObject(obj);
          const lb = c.kind === 'model' && c.modelId != null ? boxOf(c.modelId) : null;
          if (!lb) continue;
          const b = transformedAabb(lb, objectMatrix(pos, obj.rot, obj.scale));
          if (boxNearGate(clear, x, y, b[0], b[2], b[3], b[5])) { if (!asked) return true; if (!wodPiecewise(session.prefab[p.index])) return true; }   // asked: a piece the placement refuses is not stood; a whole site's must never reach
        }
      }
    }
    return false;
  };
  let stars = 0, rocked = 0, wholeLeft = 0;
  for (let n = Math.ceil(FESTIVAL.fromMs / STAR_HOUR_MS); n < Math.ceil(FESTIVAL.toMs / STAR_HOUR_MS); n++) {
    for (const s of findStarSites(n, scan, { gateSiteOf: (d) => findGateSite(d, scan) })) {
      if (!starInWindow(s.n, s.k)) continue;
      stars++;
      const clear = gateClearSet(null, [], [star(`${s.n}.${s.k}`, s.px, s.py, s.spot[0], s.spot[1])]);
      if (reaches(s, clear, false)) rocked++;
      if (reaches(s, clear, true)) wholeLeft++;
    }
  }
  assert.ok(stars > 1300, `${stars} stars over the festival`);
  assert.ok(rocked > 200, `${rocked} of ${stars} stars had the mod's rock reach within ${STAR_ROCK_M} m of the heart`);
  assert.equal(wholeLeft, 0, 'with the clearing asked, no whole site reaches a star - and every piece that does is the placement\'s to refuse');
});

test('STAR-CLEAR by source: the world host hands the starfall host\'s stars to the clearing\'s one set beside the arches\', and the build and the sweep read that set (mutants: the host never hands its stars)', () => {
  const w = hostText('src/scenes/world.js');
  assert.match(w, /const _gateClearSetOf = gateClearMemo\(\);/, 'the set\'s memo, the module\'s');
  assert.match(w, /return _gateClearSetOf\(_gateClearOf\.clear, egClient\?\.archClears\(\) \?\? null, starfall\?\.starClears\(\) \?\? null\);/, 'the gate, the arches and the stars');
  assert.match(w, /const gateClear = host\._gateClearNow\(\);/, 'the build reads the set');
  assert.match(w, /function sweepGateClear\(\) \{\n\s*const clear = _gateClearNow\(\);/, 'the sweep reads the set');
  const src = readFileSync(join(ROOT, 'src/scenes/starfall/starfallHost.js'), 'utf8');
  assert.match(src, /starClears\(\) \{/, 'the starfall host answers its stars');
});
