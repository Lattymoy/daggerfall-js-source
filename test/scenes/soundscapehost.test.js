// SOUNDSCAPE (2026-10-24, the owner: "enhancing sound and ambience, different music and ambience sounds for sailing ... and
// whatever else we could improve"; bible/08-Audio/Audio.md SOUNDSCAPE): THE SOUNDSCAPE'S HOST HALF (scenes/soundscapeHost.js).
// The shore's edge found on rings and bearings of the sea's depth from either side of it - from the land or from the sea
// - placed by halvings, standing at the sea's surface; land near a map pixel for the gulls, the sea beside one for a far
// surf; a door's building type off its block; the winter's climates. The host against fakes: nothing with Enhanced
// Sounds off (the classic skin, the switch); on any ship's deck - at a helm, at anchor off it, a sea ship's, a peer's -
// the deck's air and none of the land's, either way across the rail; her bow hers; a peer's boat's way her own; every door the host reads varied and heard - the fight, a port, the weather, the night, the wind, the land near,
// the town, the season's climates, the smithies; at a helm the sea's songs registered once and played, held before the
// director and let go by a fade the frame I sail no more, the fight's held through a boarding; on land the world's
// air, the smithies' and taverns' doors read off the host's own list at their doorways. And the world host's own text:
// the three calls where they belong. AUDIT SOUNDSCAPE (2026-10-24): W1, W2, W3, W8, W10, S2, S3, S4, S7, M1, M2, P2, P3.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  shoreEdge, landNear, seaBeside, doorBuildingType, winterIn, createSoundscapeHost, SHORE_RADII, SHORE_BEARINGS, SHORE_DEPTH, SHORE_FAR_M,
  GULL_RING, DOORS_REACH_M, DOOR_OUT_M, ASK_EVERY_S, ASK_MOVED_M, WAY_TAU_S, WAY_JUMP_MPS,
} from '../../src/scenes/soundscapeHost.js';
import { seaScoreSongs, SEA_SONGS } from '../../src/systems/soundscape/seaScore.js';
import { SCAPE_SFX } from '../../src/systems/soundscape/soundscapeSfx.js';
import { BELL_CLIP } from '../../src/systems/soundscape/seaAir.js';
import { CLIMATES } from '../../src/formats/mapsTables.js';
import { BUILDING_TYPES } from '../../src/world/buildingNames.js';
import { setPref } from '../../src/systems/uiPrefs.js';
import { uiSkin, setUiSkin } from '../../src/systems/uiSkin.js';
import { _resetSoundscapeSounds } from '../../src/systems/soundscape/soundscapeSfx.js';
import { seededRng } from '../../src/systems/wind/wind.js';

const W = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');

test('SOUNDSCAPE THE SHORE\'S EDGE (AUDIT SOUNDSCAPE W3, W10): where the water changes - the sea deeper than SHORE_DEPTH meeting the shallows or the land - on SHORE_BEARINGS bearings at each of SHORE_RADII, nearest ring first, placed along its bearing by halvings to within a metre, the nearest of the bearings that met it; found from the land and from the sea alike; the edge a point at the sea\'s surface; far out at sea, or inland past the last ring, none (mutants: the depth\'s threshold; the halvings; the rings\' order; the first bearing taken for the nearest; the sea\'s side unread; the surface unread)', () => {
  assert.deepEqual([[...SHORE_RADII], SHORE_BEARINGS, SHORE_DEPTH], [[6, 14, 28, 50, 85, 130, 200], 12, 0.3]);
  // a beach running along z: the deep past x0, shallows 3 m wide, then the land (no column)
  const beach = (x0, oceanY = -1.5) => (x) => (x > x0 ? { depth: 2, oceanY } : x > x0 - 3 ? { depth: 0.2, oceanY } : null);
  const e = shoreEdge([0, 0, 0], beach(37));
  assert.ok(e && Math.abs(e.dist - 37) < 1, `the edge at 37 m: ${e?.dist}`);
  assert.ok(Math.abs(e.dir[0] - 1) < 1e-9 && Math.abs(e.dir[1]) < 1e-9, 'its bearing: square to the shore, the nearest of the bearings that met it (one at 60 degrees meets it at 43 m)');
  assert.ok(Math.abs(e.at[0] - e.dist) < 1e-9 && e.at[1] === -1.5 && Math.abs(e.at[2]) < 1e-9, `at the sea's surface: ${e.at}`);
  assert.ok(Math.abs(shoreEdge([0, 0, 0], beach(4)).dist - 4) < 1, 'inside the first ring');
  const out = shoreEdge([60, 0, 0], beach(37));
  assert.ok(out && Math.abs(out.dist - 23) < 1 && Math.abs(out.dir[0] + 1) < 1e-9, `a swimmer 23 m out: the edge behind them (${out?.dist})`);
  assert.equal(shoreEdge([0, 0, 0], () => ({ depth: 40, oceanY: 0 })), null, 'far out at sea: no edge (a swimmer was "at" it)');
  assert.equal(shoreEdge([0, 0, 0], beach(260)), null, 'no sea within the last ring');
  assert.equal(shoreEdge([0, 0, 0], () => ({ depth: 0.25 })), null, 'the shallows are not the sea');
  assert.equal(shoreEdge([0, 0, 0], () => null), null);
  assert.equal(shoreEdge([0, 5, 0], (x) => (x > 20 ? { depth: 3 } : null)).at[1], 4, 'no surface known: under the ear');
});

test('SOUNDSCAPE THE MAP\'S WORD: land near a map pixel - one within GULL_RING that is not the sea; the sea beside one - its own or one of its eight; a door\'s building type off its block\'s own list, -1 without one; a winter where the climate has one (mutants: the ring; the eight; the record\'s index; the desert\'s winter)', () => {
  assert.equal(GULL_RING, 2);
  const islandAt = (ix, iy) => (x, y) => !(x === ix && y === iy);
  assert.deepEqual([landNear(10, 10, islandAt(12, 12)), landNear(10, 10, islandAt(13, 10)), landNear(10, 10, () => true), landNear(10, 10, () => false)], [true, false, false, true]);
  const seaAt = (sx, sy) => (x, y) => x === sx && y === sy;
  assert.deepEqual([seaBeside(5, 5, seaAt(6, 6)), seaBeside(5, 5, seaAt(5, 5)), seaBeside(5, 5, seaAt(7, 5)), seaBeside(5, 5, () => false)], [true, true, false, false]);
  const block = { rmbBlock: { fldHeader: { buildingDataList: [{ buildingType: BUILDING_TYPES.Tavern }, { buildingType: BUILDING_TYPES.WeaponSmith }] } } };
  assert.deepEqual([doorBuildingType({ dfBlock: block, recordIndex: 1 }), doorBuildingType({ dfBlock: block, recordIndex: 0 }), doorBuildingType({ dfBlock: block, recordIndex: 4 }), doorBuildingType({}), doorBuildingType(null)], [BUILDING_TYPES.WeaponSmith, BUILDING_TYPES.Tavern, -1, -1, -1]);
  assert.deepEqual([CLIMATES.Woodlands, CLIMATES.Mountain, CLIMATES.Desert, CLIMATES.Desert2, CLIMATES.Rainforest, CLIMATES.Subtropical, CLIMATES.Swamp].map((c) => winterIn(c, true)), [true, true, false, false, false, false, true]);
  assert.equal(winterIn(CLIMATES.Woodlands, false), false);
});

/** A door at (x, z) facing +z, of record `recordIndex` of `block` - a door's own centre and normal in its model, placed. */
const doorOf = (block, x, z, recordIndex) => ({ dfBlock: block, recordIndex, door: { matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, 0, z, 1], centre: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 0, z: 1 } } });
/** The fakes: an engine that records, a music service that records, a deck, a helm and every door the test moves. */
function rig({ boat = null, helm = null, depth = null, inTown = false, doors = [], people = false, aboard = false, sea = () => true, bow = null, rand } = {}) {
  const calls = { beds: new Map(), beds3d: new Map(), shots: [], music: [], registered: new Set() };
  const audio = {
    listenerPose: () => ({ pos: [0, 0, 0], fwd: [0, 0, 1] }),
    registerSamples(key) { calls.registered.add(key); return true; },
    registerSound: async () => true,
    samplesOf: (i) => (people && i >= 441 && i <= 450 ? Float32Array.from({ length: 3000 }, (_, k) => Math.sin(k * 0.07) * 0.3) : null),
    setBed(name, clip, o = {}) { if (clip == null) calls.beds.delete(name); else calls.beds.set(name, { clip, ...o }); },
    setBed3d(name, clip, pos, o = {}) { if (clip == null) calls.beds3d.delete(name); else calls.beds3d.set(name, { clip, pos, ...o }); },
    play3d(clip, pos, volume, o) { calls.shots.push({ clip, pos, volume, ...o }); return 1; },
    fadeFar() {},
  };
  const music = { current: null, registerSong(name) { calls.music.push(['register', name]); }, playSong(name) { music.current = name; calls.music.push(['play', name]); }, fadeOut() { music.current = null; calls.music.push(['fade']); } };
  const state = { boat, helm, aboard, fight: false, port: false, inTown, sea };
  const host = createSoundscapeHost({
    audio, music, boat: () => state.boat, aboard: () => state.aboard, bow: bow ?? undefined,
    csa: { helmPanelState: () => state.helm, IsNearPort: () => state.port }, fight: () => state.fight,
    pixel: () => ({ x: 100, y: 100 }), seaPixel: (x, y) => state.sea(x, y), dw: depth ? { rawColumnAt: (x, z) => depth(x, z) } : null,
    inTown: () => state.inTown, towns: () => new Map([[100 * 1000 + 100, { blocks: 9 }]]), doors, doorAt: (e) => e.door, rand,
  });
  return { host, calls, state, music };
}
const F = Object.freeze({ wd: { on: true, strength01: 0.5, gust: 0.7 }, weather: 'sunny', minute: 720, climate: CLIMATES.Woodlands, winter: false, paused: false });
const frames = (r, n, f = F, dt = 1 / 30) => { for (let k = 0; k < n; k++) r.host.frame(dt, typeof f === 'function' ? f(k * dt) : f); };
const enhanced = (fn) => () => { const skin = uiSkin(); try { setUiSkin('enhanced'); setPref('soundEnhancements', true); fn(); } finally { setUiSkin(skin); setPref('soundEnhancements', true); } };
// the smith's bouts are Math.random's (worldAir.js createWorldAir's rand): a bout of three and a long rest left the land's
// 400 frames three blows, a run in some twenty - so the land is heard on a fixed draw
const seeded = (fn, seed = 7) => () => { const rnd = Math.random; let s = seed; Math.random = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32); try { fn(); } finally { Math.random = rnd; } };

test('SOUNDSCAPE THE HOST: nothing with Enhanced Sounds off - the classic skin, or the switch; aboard, the deck\'s air and none of the land\'s - and stepping aboard from the land lets the land\'s go (AUDIT SOUNDSCAPE P3); on land the world\'s air - a far surf off the map\'s coast where the sea\'s depth is not there to ask - and none of the deck\'s; stop silences both (mutants: the switch unread; the deck and the land at once, either way; the far surf)', () => {
  const skin = uiSkin();
  _resetSoundscapeSounds();
  try {
    setUiSkin('classic'); setPref('soundEnhancements', true);
    const off = rig({ boat: {} });
    frames(off, 30);
    assert.deepEqual([off.calls.beds.size, off.calls.shots.length], [0, 0], 'the classic skin hears what DFU plays');
    setUiSkin('enhanced'); setPref('soundEnhancements', false);
    frames(off, 30);
    assert.deepEqual([off.calls.beds.size, off.calls.shots.length], [0, 0], 'the switch off');
    setPref('soundEnhancements', true);
    const r = rig({ boat: {}, helm: { way: 4, sailsUp: true, inIrons: false } });
    frames(r, 60);
    assert.ok(r.calls.beds.has('sea:swell') && r.calls.beds.has('sea:wash'), [...r.calls.beds.keys()].join());
    assert.equal(r.calls.beds.has('shore:surf') || r.calls.beds.has('town:murmur'), false, 'no land\'s air on a deck');
    r.state.boat = null;
    frames(r, 60);
    assert.equal(r.calls.beds.has('sea:swell'), false, 'ashore: the deck\'s air let go');
    assert.ok(r.calls.beds.get('shore:surf')?.volume > 0, `the map's coast, the sea's depth not there to ask: a far surf (${SHORE_FAR_M} m)`);
    r.state.boat = {};
    frames(r, 5);
    assert.equal(r.calls.beds.has('shore:surf'), false, 'aboard again: the land\'s air let go');
    r.host.stop();
    assert.deepEqual([...r.calls.beds.keys()], []);
  } finally { setUiSkin(skin); setPref('soundEnhancements', true); }
});

test('SOUNDSCAPE ANY SHIP\'S DECK IS THE SEA\'S (AUDIT SOUNDSCAPE S2): my own at anchor off her helm, a sea ship\'s - the naval host\'s aboard - the deck\'s air, lying still, and never the shore\'s surf "standing in it" over deep water (mutants: the deck test unread; the deck off the helm taken for land)', enhanced(() => {
  const r = rig({ aboard: true, depth: () => ({ depth: 40, oceanY: 0 }) });
  frames(r, 90);
  assert.ok(r.calls.beds.has('sea:swell'), `the swell under her: ${[...r.calls.beds.keys()].join()}`);
  assert.equal(r.calls.beds.has('sea:wash'), false, 'at anchor: no wash');
  assert.equal(r.calls.beds.has('shore:surf') || r.calls.beds3d.has('shore:surf'), false, 'no surf in open water');
  assert.equal(r.host.scoreFrame(1), false, 'at no helm the director plays');
}));

test('SOUNDSCAPE HER BOW AND A PEER\'S BOAT (AUDIT SOUNDSCAPE S3, S4): her heading off her own rotation (the host\'s boatForward), the watch bell on her deck ahead whatever way the ear looks; a boat I ride and do not steer - another player\'s - her way her root\'s own going, eased, so she washes; a recentre\'s jump never her way (mutants: the bow unread; the passenger\'s way my idle helm\'s; a jump taken for way)', enhanced(() => {
  assert.deepEqual([WAY_TAU_S, WAY_JUMP_MPS], [0.6, 40]);
  const asked = [];
  const her = { GameObject: { position: [0, 0, 0], rotation: [0, 0.7071, 0, 0.7071] } };
  const r = rig({ boat: her, helm: { way: 12 }, bow: (b, yaw) => (asked.push([b, yaw]), [1, 0, 0]) });
  // the world's clock at DFU's pace across a half hour (12:29 -> 12:30): one bell
  frames(r, 30 * 12, (t) => ({ ...F, minute: 749 + 0.2 * t }));
  assert.ok(asked.length > 0 && asked.every(([b]) => b === her), 'her bow asked of her own');
  const bell = r.calls.shots.filter((s) => s.clip === BELL_CLIP);
  assert.equal(bell.length, 1);
  assert.deepEqual(bell[0].pos.map((v) => Math.round(v * 1e9) / 1e9), [3, 2.5, 0], 'on her deck ahead, not the camera\'s forward (+z)');
  // a peer's boat: no helm of mine - her own going
  const peer = { GameObject: { position: [0, 0, 0] } };
  const p = rig({ boat: peer });
  frames(p, 30 * 4, () => { peer.GameObject.position = [peer.GameObject.position[0] + 6 / 30, 0, 0]; return F; });
  assert.ok(p.calls.beds.get('sea:wash')?.volume > 0, `six metres a second: her wash (${p.calls.beds.get('sea:wash')?.volume})`);
  const before = p.calls.beds.get('sea:wash').volume;
  peer.GameObject.position = [peer.GameObject.position[0] + 500, 0, 0];
  frames(p, 1, () => F);
  assert.ok(p.calls.beds.get('sea:wash').volume <= before + 1e-9, 'a recentre\'s jump is not her way');
}));

test('SOUNDSCAPE THE SEA\'S SONGS: at a helm the six songs registered once, by their names, and the law\'s song played - the sea holding the music before the director; standing on a deck at no helm, the director\'s; leaving the helm, the music let go by a fade, once (mutants: the songs registered every frame; the hold kept ashore; the cut)', enhanced(() => {
  const r = rig({ boat: {}, helm: { way: 4, sailsUp: true, inIrons: false } });
  assert.equal(r.host.scoreFrame(0), false, 'before any frame: nothing held');
  r.host.frame(1 / 30, F);
  assert.equal(r.host.scoreFrame(1), true, 'at a helm the sea holds the music');
  assert.equal(r.host.scoreFrame(2), true);
  const reg = r.calls.music.filter(([k]) => k === 'register').map(([, n]) => n);
  assert.deepEqual(reg, Object.values(seaScoreSongs()).map((s) => s.name), 'registered once');
  assert.deepEqual(new Set(reg), new Set(Object.values(SEA_SONGS)));
  assert.ok(r.calls.music.some(([k, n]) => k === 'play' && Object.values(SEA_SONGS).includes(n)), 'a sea song played');
  r.state.helm = null;
  r.host.frame(1 / 30, F);
  assert.equal(r.host.scoreFrame(3), false, 'aboard at no helm: the director\'s');
  assert.deepEqual(r.calls.music.at(-1), ['fade'], 'let go by a fade');
  const n = r.calls.music.length;
  assert.equal(r.host.scoreFrame(4), false);
  assert.equal(r.calls.music.length, n, 'once');
}));

test('SOUNDSCAPE EVERY DOOR THE SCORE READS (AUDIT SOUNDSCAPE P2, M1, M2): a sea fight the fight\'s song - and held through a boarding, the helm let go on her deck; a port\'s approach landfall; a thunderstorm the storm; a night\'s minute the night\'s (mutants: the fight unread; a port unread; the weather unread; the night unread; the boarding\'s helm let go)', enhanced(() => {
  const song = (setup, f = F) => {
    const r = rig({ boat: {}, helm: { way: 6, sailsUp: true, inIrons: false } });
    setup(r.state);
    r.host.frame(1 / 30, f);
    r.host.scoreFrame(1);
    return r;
  };
  assert.equal(song(() => {}).music.current, SEA_SONGS.open);
  assert.equal(song((s) => { s.fight = true; }).music.current, SEA_SONGS.fight);
  assert.equal(song((s) => { s.port = true; }).music.current, SEA_SONGS.port);
  assert.equal(song(() => {}, { ...F, weather: 'thunder' }).music.current, SEA_SONGS.storm);
  assert.equal(song(() => {}, { ...F, minute: 23 * 60 }).music.current, SEA_SONGS.night);
  const b = song((s) => { s.fight = true; });
  b.state.helm = null;   // grapples away: the helm let go, the deck fight on
  b.host.frame(1 / 30, F);
  assert.equal(b.host.scoreFrame(2), true, 'the boarding: the sea still holds the music');
  assert.equal(b.music.current, SEA_SONGS.fight);
}));

test('SOUNDSCAPE EVERY DOOR THE AIR READS (AUDIT SOUNDSCAPE P2): the wind under the sea state (a gale\'s swell over a calm\'s); land near for the gulls (by day in fair weather, none with the sea all round); the town\'s word for the murmur; the season\'s climates - a rainforest\'s frogs in winter, it has none; the weaponsmith\'s door a smithy as the armourer\'s is (mutants: the wind unread; the land near unread; the town always; the winter everywhere; the weaponsmith not a smithy)', enhanced(() => {
  const swell = (strength01) => { const r = rig({ boat: {}, helm: { way: 6, sailsUp: true, inIrons: false } }); frames(r, 3, { ...F, wd: { on: true, strength01, gust: 0.7 } }); return r.calls.beds.get('sea:swell').volume; };
  assert.ok(swell(1) > 1.5 * swell(0), `a gale's swell over a calm's: ${swell(1)} against ${swell(0)}`);
  const gulls = (sea) => { const r = rig({ boat: {}, helm: { way: 6, sailsUp: true, inIrons: false }, sea }); frames(r, 30 * 120); return r.calls.shots.filter((s) => SCAPE_SFX.gull.includes(s.clip)).length; };
  assert.ok(gulls((x, y) => x === 100 && y === 100) >= 2, 'land about the pixel: the gulls');
  assert.equal(gulls(() => true), 0, 'the sea all round: none');
  const town = (inTown) => { const r = rig({ inTown, people: true }); frames(r, 120, { ...F, minute: 11 * 60 }); return r.calls.beds.has('town:murmur'); };
  assert.deepEqual([town(true), town(false)], [true, false]);
  const frogs = (winter) => { const r = rig(); frames(r, 30 * 60, { ...F, climate: CLIMATES.Rainforest, minute: 23 * 60, winter }); return r.calls.shots.filter((s) => SCAPE_SFX.frog.includes(s.clip)).length; };
  assert.ok(frogs(true) >= 5, `the rainforest's winter has no winter: frogs (${frogs(true)})`);
  const block = { rmbBlock: { fldHeader: { buildingDataList: [{ buildingType: BUILDING_TYPES.WeaponSmith }] } } };
  const r = rig({ inTown: true, doors: [doorOf(block, -12, 4, 0)] });
  frames(r, 30 * 40, { ...F, minute: 11 * 60 });
  assert.ok(r.calls.shots.filter((x) => SCAPE_SFX.anvil.includes(x.clip)).length >= 4, 'the weaponsmith\'s anvil');
}));

test('SOUNDSCAPE THE HOST ON LAND (AUDIT SOUNDSCAPE W1, W2): the shore found on the sea\'s depth and the surf stood at its edge, at the sea\'s surface; the town\'s word PlayerGPS\'s own (never a dungeon\'s rect) and its size off the living towns\' index (its murmur the root of nine blocks in sixteen); the smithies\' and the taverns\' doors read off the host\'s own list, their types off their blocks, each heard at its own doorway - its centre, DOOR_OUT_M out along its face - within DOORS_REACH_M; a house silent; the dear questions asked twice a second, or at once past ASK_MOVED_M (mutants: a smithy taken for a tavern; the town\'s size unread; the door at its building\'s middle; the asking\'s clock)', enhanced(seeded(() => {
  assert.deepEqual([DOORS_REACH_M, DOOR_OUT_M, ASK_EVERY_S, ASK_MOVED_M], [70, 1.2, 0.5, 15]);
  const block = { rmbBlock: { fldHeader: { buildingDataList: [{ buildingType: BUILDING_TYPES.Tavern }, { buildingType: BUILDING_TYPES.Armorer }, { buildingType: BUILDING_TYPES.House1 }] } } };
  const doors = [doorOf(block, 10, 10, 0), doorOf(block, -12, 4, 1), doorOf(block, 5, 5, 2), doorOf(block, 200, 0, 1)];
  const sea = (x) => (x > 40 ? { depth: 3, oceanY: -2 } : null);
  const quiet = rig({ depth: sea, inTown: true, doors });
  frames(quiet, 60, { ...F, minute: 11 * 60 });
  assert.equal(quiet.calls.beds3d.get('town:tavern'), undefined, 'the town\'s beds wait on the people (no archive)');
  // seeded: the smith's bouts and rests are the air's dice, and Math.random's gave 3 blows in these 400 frames on CI
  const r = rig({ depth: sea, inTown: true, doors, people: true, rand: seededRng(3) });
  frames(r, 400, { ...F, minute: 11 * 60 });
  const surf = r.calls.beds3d.get('shore:surf');
  assert.ok(surf && Math.abs(surf.pos[0] - 40) < 1 && surf.pos[1] === -2, `the surf at the edge, at the sea's surface: ${surf?.pos}`);
  const tavern = r.calls.beds3d.get('town:tavern');
  assert.ok(tavern && tavern.pos[0] === 10 && Math.abs(tavern.pos[2] - (10 + DOOR_OUT_M)) < 1e-9, `the tavern's noise at its doorway: ${tavern?.pos}`);
  const blows = r.calls.shots.filter((x) => x.clip === 'town-anvil-1');
  assert.ok(blows.length >= 4 && blows.every((x) => x.pos[0] === -12 && Math.abs(x.pos[2] - (4 + DOOR_OUT_M)) < 1e-9), `the anvil at the armourer's doorway: ${blows.length}`);
  assert.ok(Math.abs(r.calls.beds.get('town:murmur')?.volume - 0.22 * 0.75 * Math.SQRT1_2) < 1e-9, `nine blocks: ${r.calls.beds.get('town:murmur')?.volume}`);
  // the asking's clock (frames of an eighth of a second: asked at the first, then every fourth): a door new on the
  // host's list is heard at the next ask, half a second on - and at once when I have walked past ASK_MOVED_M
  const list = [];
  const late = rig({ inTown: true, people: true, doors: list });
  const at = (ear) => ({ ...F, minute: 11 * 60, ear, fwd: [0, 0, 1] });
  frames(late, 5, at([0, 0, 0]), 0.125);
  list.push(doorOf(block, 3, 3, 0));
  frames(late, 3, at([0, 0, 0]), 0.125);
  assert.equal(late.calls.beds3d.has('town:tavern'), false, 'not asked every frame');
  frames(late, 1, at([0, 0, 0]), 0.125);
  assert.ok(late.calls.beds3d.has('town:tavern'), 'asked again half a second on');
  frames(late, 4, at([0, 0, 0]), 0.125);
  list.push(doorOf(block, 18, 0, 0));
  frames(late, 1, at([16, 0, 0]), 0.125);
  assert.equal(late.calls.beds3d.get('town:tavern')?.pos[0], 18, 'walked 16 m: asked at once');
})));

test('SOUNDSCAPE THE WORLD HOST: constructed once beside the Deadlands\' air with the world\'s own doors as they are - the deck test, her bow\'s law and the fight the watch knows; its frame on the exterior frame after the listener is set and beside the wind, the game\'s pause handed it; its stop on the modal frame beside the wind\'s; its score in the music\'s chain after the arena\'s, before the director; the clips\' loader asked every frame (mutants: the frame before the listener; the stop dropped; the score ahead of the gate\'s; the pause unwired; the deck test unwired; the fight on hostileNear)', () => {
  const made = W.indexOf('const soundscape = createSoundscapeHost({');
  assert.ok(made > W.indexOf('const deadlandsAir = createDeadlandsAir(audio);'));
  assert.equal(W.split('createSoundscapeHost(').length - 1, 1, 'once');
  assert.ok(W.includes('audio, music, boat: csaBoatUnderMe, aboard: () => !!naval?.aboard?.(), bow: boatForward, csa: csaRuntime, fight: () => !!naval?.battle?.(), pixel: playerTravelPixel,'));
  assert.ok(W.includes('seaPixel: openSea, dw: dwPlayer, inTown: _isPlayerInTownStrict, towns: livingTownsIndex, doors: buildingDoors, doorAt: shiftedDoor,'));
  const listener = W.indexOf('audio.setListener(cam.pos, tvf ? [viewFwd[0], 0, viewFwd[2]] : fwd);');
  const frame = W.indexOf('soundscape.frame(dt, {');
  assert.ok(listener > 0 && frame > listener && frame - W.indexOf('windAudio.update(wd, dt, windSoundOn());') < 1200, 'after the listener, beside the wind');
  assert.ok(W.includes('winter: season === SEASON.Winter, paused: gamePaused() });'), 'the pause handed it');
  assert.match(W, /^      windAudio\.stop\(\); soundscape\.stop\(\);   \/\/ WIND3/m, 'the modal frame silences it with the wind, on the wind\'s own line (DISC6 reads the lines after it)');
  assert.match(W, /if \(!hourScoreFrame\(\) && !gateScoreFrame\(\) && !arenaScoreFrame\(\) && !soundscape\.scoreFrame\(\)\) musicDirector\.update\(\{/);
  const H = readFileSync(new URL('../../src/scenes/soundscapeHost.js', import.meta.url), 'utf8');
  assert.ok(H.includes('      installSoundscapeSounds(deps.audio);   // AUDIT SOUNDSCAPE S7'), 'the loader asked every frame - its own backoff decides');
  const N = readFileSync(new URL('../../src/scenes/naval/navalHost.js', import.meta.url), 'utf8');
  assert.ok(N.includes('    battle: () => aiming || crewAlarm() || !!boarding,'), 'the naval host\'s battle: the watch\'s alarm and a boarding');
});
