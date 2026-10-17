// AUDIT REST II - THE DUNGEON FIRES (2026-10-03, bible/06-Systems/Rest-Arc.md section 4 and its AUDIT REST /
// AUDIT REST-PARTY as-built notes): REST3's placement law and the dungeon host's use of it, audited again.
// F1: a joiner's rest asked the host for an encounter the host's 15 m ward then refused at every spot, and broke the
// joiner's night for nothing - and an ask let the night run on to the hour's check, rolling again. F2: a palace stood
// fires in its other blocks. F3: a fire stood ON a loot pile, a quest marker or the player's own entry. F4: a closed
// room's roof read as a floor (the collider meets both sides) and a fixed treasure's fire stood on its tabletop. F5: a
// brazier the law took for the entrance's fire had no ward and no mark. F6: the probe tool read the models unpatched.
// F7: an exit door was measured from its model's origin. F8: in the drowned abyss the fires' flames went and the fires
// stayed. F9: the cold-fire sweep minted a roster every frame. Each is RUN here - the law over synthetic layouts and a
// real Collider, the host's own statements sliced out of dungeonContext.js and mounted (test/net/restsync.test.js's
// harness) - and the law stays one answer on every client.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as acorn from 'acorn';
import * as DF from '../../src/world/dungeon/dungeonFires.js';
import * as PROBE from '../../tools/dungeonFireProbe.mjs';
import { Collider } from '../../src/player/collider.js';
import { RDB_SIDE } from '../../src/world/rdbLayout.js';
import { DOOR_TYPE, dfMeshToModel } from '../../src/world/meshReader.js';
import { patchSeams } from '../../src/world/arch3dSeams.js';
import { doorWorldPosition } from '../../src/player/enterExit.js';
import { multiply, trs } from '../../src/world/mat4.js';
import { placeFoeEnv, entityOccupancy } from '../../src/scenes/quest/questFoeHost.js';
import { placeFoeFreely, PLACE_FOE_DEFAULTS } from '../../src/systems/quest/sceneMount.js';
import { SPAWNER_ARMS } from '../../src/systems/encounters.js';
import { runRestNight, ambushNight } from '../../src/systems/rest/restAct.js';
import { REST_TEXT, MINUTES_PER_TICK } from '../../src/systems/rest/restSession.js';
import { isDungeonLightFixture } from '../../src/world/oceanHoles.js';
import { withFireMarks } from '../../src/ui/nodeMarks.js';
import { isHearthFlat } from '../../src/systems/survival/hearth.js';

const { DFIRE, fireCandidates, landCandidates, colliderFireProbe, placeDungeonFires, fireLayoutInputs, inFireWard } = DF;
const rd = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const I = Object.freeze([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const mk = (record, x, z, y = 0.5, archive) => (archive == null ? { record, x, y, z } : { record, x, y, z, archive });
const open = { floor: () => ({ y: 0, ny: 1 }), room: () => true };   // a flat open floor at y 0 everywhere
const flat2 = (a, b) => (a[0] - b[0]) ** 2 + (a[2] - b[2]) ** 2;

// ---- geometry wound as a real mesh is: a floor's front looks up, a ceiling's down (renderer.js frontFace) ----
function mesh() {
  const positions = [], indices = [];
  const quad = (a, b, c, d) => { const n = positions.length / 3; positions.push(...a, ...b, ...c, ...d); indices.push(n, n + 1, n + 2, n, n + 2, n + 3); };
  /** a level face at `y` over [x0, x1] x [z0, z1] looking up (a floor, a top) or down (a ceiling, an underside) */
  const up = (x0, z0, x1, z1, y) => quad([x0, y, z0], [x0, y, z1], [x1, y, z1], [x1, y, z0]);
  const down = (x0, z0, x1, z1, y) => quad([x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]);
  const walls = (x0, y0, z0, x1, y1, z1) => {
    quad([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]); quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]);
    quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]); quad([x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]);
  };
  /** a closed room: its floor up, its ceiling down, four walls */
  const room = (x0, y0, z0, x1, y1, z1) => { up(x0, z0, x1, z1, y0); down(x0, z0, x1, z1, y1); walls(x0, y0, z0, x1, y1, z1); };
  /** a solid box (a table, a plinth): its top up, its underside down, four sides */
  const box = (x0, y0, z0, x1, y1, z1) => { up(x0, z0, x1, z1, y1); down(x0, z0, x1, z1, y0); walls(x0, y0, z0, x1, y1, z1); };
  return { positions, indices, quad, up, down, room, box };
}
const collider = (m) => { const c = new Collider(() => -Infinity); c.addMesh('dungeon', m.positions, m.indices, I); return c; };
/** A hall `2h` square and `t` high, centred on the origin. */
const hall = (h, t = 6) => { const m = mesh(); m.room(-h, 0, -h, h, t, h); return m; };

/** A row of `n` blocks along x, the first the starting block: the start (or a treasure) at (5, 5), a fixed treasure at (30, 30). */
function row(n, { castleAt = -1 } = {}) {
  return Array.from({ length: n }, (_, i) => ({
    name: i === n - 1 ? 'B0000001.RDB' : `N00000${i}.RDB`, originX: i * RDB_SIDE, originZ: 0, isStartingBlock: i === 0,
    layout: {
      waterLevel: 10000, castleBlock: i === castleAt,
      markers: [mk(i === 0 ? 10 : 19, 5, 5), mk(4, 30, 30, 0.5, 216)],
      startMarkers: i === 0 ? [mk(10, 5, 5)] : [],
    },
  }));
}

// ---- the host's own statements, mounted (test/net/restsync.test.js's harness) ----
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
/** A function or a declaration's source, or '' where this tree has none (a name the fix adds: absent before it, the
 *  behaviour - not a missing name - is what fails). */
const optional = (name) => {
  const n = find((x) => (x.type === 'FunctionDeclaration' && x.id?.name === name) || (x.type === 'VariableDeclaration' && x.declarations.some((d) => d.id?.name === name)));
  return n ? D.slice(n.start, n.end) : '';
};
const propSrc = (decl, prop) => {
  const d = find((x) => x.type === 'VariableDeclarator' && x.id?.name === decl);
  const p = d?.init?.properties?.find((q) => q.key?.name === prop);
  return p ? D.slice(p.value.start, p.value.end) : 'null';
};
const scoped = (state) => new Proxy(state, {
  has: (t, k) => k !== '__s',
  get: (t, k) => (k === Symbol.unscopables ? undefined : (k in t ? t[k] : globalThis[k])),
  set: (t, k, v) => { t[k] = v; return true; },
});
const mount = (body, state) => new Function('__s', `with (__s) { ${body} }`)(scoped(state));
const AsyncFunction = (async () => {}).constructor;
const mountAsync = (body, state) => new AsyncFunction('__s', `with (__s) { ${body} }`)(scoped(state));

const HIT = { mobileType: 5, ...SPAWNER_ARMS.dungeonRest };
/** AUDIT REST III (lens F4): the placement's dice, seeded - Math.random found no spot outside the ward in a 40 m hall
 *  about once in 3000 calls, and the file failed for nothing about once in 700 runs. */
const seeded = (seed = 1) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
/** A joiner's rest doors over a real collider: the ask, its latch, the host's placement - the context's own source. */
function joinerDoors({ col, feet = [2, 0, 0], fires = [[0, 0, 0]], wire = true, ambush = () => false, seed = 1 } = {}) {
  const asked = [], ambushes = [];
  const state = {
    opts: { selfId: () => 'me', onActions: (d) => { asked.push(d); return wire; } },
    _authority: false, lastPlayerFeet: feet, _motorYaw: 0, _locationKey: 'dungeon:7',
    collider: col, foes: [], placeFoeEnv: ((rolls) => (o) => placeFoeEnv({ ...o, rolls }))(seeded(seed)), entityOccupancy, placeFoeFreely, fieldOfView: () => (65 * Math.PI) / 180,
    sharedClockOn: () => true, inFireWard, dungeonFires: fires,
    ambushNight: () => { ambushes.push(1); return ambush(); },
    _spawnEncounter: () => assert.fail('a joiner stands no foe of its own'),
  };
  const doors = mount(`
    ${['REST_ASK_WAIT_MS', 'REST_ASK_GAP_MS', 'ENCOUNTER_PLACE_ATTEMPTS', 'q2', 'q3', 'onlineRoom', 'encounterSpot', 'restEncounter', 'roomEncounterComing'].map(optional).join('\n')}
    let _restAskAt = null;
    ${optional('_restAskSentAt')}
    return { restEncounter, roomEncounterComing };
  `, state);
  return { ...doors, asked, ambushes };
}

test('AUDIT REST II F1: a joiner asks the host only for a foe the host can stand - in a room the fire\'s 15 m ward fills, no ask and no break; in a hall, the ask', () => {
  const small = joinerDoors({ col: collider(hall(10)) });   // a 20 m room, the fire in its middle, the joiner 2 m from it
  for (let i = 0; i < 25; i++) small.restEncounter(HIT);
  assert.deepEqual(small.asked, [], 'the host would refuse every spot (its ward) - so nothing is asked');
  assert.deepEqual(small.ambushes, [], 'and no night is broken for it');
  assert.equal(small.roomEncounterComing(), false, 'nor at the hour\'s check');
  const big = joinerDoors({ col: collider(hall(20)) });   // a 40 m hall: spots outside the ward
  big.restEncounter(HIT);
  assert.equal(big.asked.length, 1, 'a spot stands outside the ward: the host is asked');
  const { s: bigSpot, ...bigAsk } = big.asked[0].rs;
  assert.deepEqual(bigAsk, { t: 5, lo: HIT.minDistance, hi: HIT.maxDistance, v: 0, f: [2, 0, 0], y: 0 });
  assert.ok(Array.isArray(bigSpot) && !inFireWard([[0, 0, 0]], { x: bigSpot[0], y: bigSpot[1], z: bigSpot[2] }), 'and names the spot it found, outside the ward (AUDIT III E1)');
  // offline there is no ward (AUDIT REST-PARTY C1) - and a fire nowhere near is no ward either
  const far = joinerDoors({ col: collider(hall(10)), fires: [[400, 0, 0]] });
  far.restEncounter(HIT);
  assert.equal(far.asked.length, 1, 'no fire near: the room is the host\'s to stand a foe in');
});

test('AUDIT REST II F1 (A1\'s latch, the joiner\'s): the ask breaks a night running at its next sub-tick - no hour\'s latch left behind, nothing rolled again; a paced window breaks at the hour as before; a refused ask breaks nothing', () => {
  const col = collider(hall(20));
  // a night running: the real night (restAct.js runRestNight) and its real latch
  const j = joinerDoors({ col, ambush: ambushNight });
  let ticks = 0;
  const log = [];
  const deps = {
    advanceMinutes: (n) => { log.push(n); if (++ticks === 20) j.restEncounter(HIT); },
    tickQuests: () => {}, tickVitals: () => false, enemiesNearby: () => j.roomEncounterComing(), dead: () => false, fullyHealed: () => false,
    onEnemyBreak: () => log.push('break'),
  };
  const r = runRestNight(deps);
  assert.equal(j.asked.length, 1, 'asked once');
  assert.equal(r.result.enemyBroke, true);
  assert.equal(r.result.textId, REST_TEXT.enemiesNearby);
  assert.equal(log.filter((l) => l === MINUTES_PER_TICK).length, 20, 'the sub-tick that asked is the last that rolled - not run on to the hour\'s check');
  assert.equal(r.hours, 3, 'its hours slept counted');
  assert.equal(j.roomEncounterComing(), false, 'no latch left to break the next rest');
  // a paced window (no night running): the hour's check breaks it, once
  const paced = joinerDoors({ col, ambush: () => false });
  paced.restEncounter(HIT);
  assert.deepEqual(paced.ambushes, [1]);
  assert.equal(paced.roomEncounterComing(), true);
  assert.equal(paced.roomEncounterComing(), false);
  // the wire refused the ask: no break of any kind
  const refused = joinerDoors({ col, wire: false, ambush: () => true });
  refused.restEncounter(HIT);
  assert.equal(refused.asked.length, 1);
  assert.deepEqual(refused.ambushes, [], 'a refused ask tells no night');
  assert.equal(refused.roomEncounterComing(), false);
});

test('AUDIT REST II F1 by source: the host\'s stand and the joiner\'s ask read ONE placement (encounterSpot), the ward inside it', () => {
  const spot = optional('encounterSpot');
  assert.match(spot, /spot = placeFoeFreely\(env, \{ minDistance, maxDistance, lineOfSightCheck \}\);\n      if \(spot && sharedClockOn\(\) && inFireWard\(dungeonFires, spot\)\) spot = null;/);
  assert.match(optional('_spawnEncounter'), /const spot = \(asked && askedSpotStands\(asked, \{ minDistance, maxDistance \}, feet\)\) \|\| encounterSpot\(\{ minDistance, maxDistance, lineOfSightCheck \}, feet, yaw\);[^\n]*\n    if \(!spot\) return null;\n    ambushNight\(\);/);   // AUDIT III E1 re-aim: the joiner's spot first
  assert.match(optional('restEncounter'), /const spot = encounterSpot\(hit, feet, _motorYaw\);\n    if \(!spot\) return null;[^\n]*\n/);   // AUDIT III E1 re-aim: the spot kept, for the ask
  assert.equal((D.match(/placeFoeFreely\(env, \{ minDistance, maxDistance, lineOfSightCheck \}\)/g) ?? []).length, 1, 'one placement, not a copy');
});

/** The host's half over the same collider - a joiner's ask answered by the context's own source; where its foe stands. */
function hostDoors({ col, fires = [[0, 0, 0]], foes = [] } = {}) {
  const stood = [];
  const state = {
    opts: { selfId: () => 'host' }, _authority: true, collider: col, foes, placeFoeEnv: ((rolls) => (o) => placeFoeEnv({ ...o, rolls }))(seeded(97)), entityOccupancy, placeFoeFreely, PLACE_FOE_DEFAULTS,
    fieldOfView: () => (65 * Math.PI) / 180, sharedClockOn: () => true, inFireWard, dungeonFires: fires,
    ambushNight: () => false, ENEMY_BASICS: { 5: {} }, foeDeps: {}, lastPlayerFeet: null, _motorYaw: 0,
    _ctxDead: false, _sharedSeq: 0, _sharedById: new Map(),
    buildFoeAt: async (rec) => { stood.push([rec.x, rec.y, rec.z]); return { ai: {} }; },
  };
  const doors = mount(`
    ${['REST_ASK_GAP_MS', 'REST_ASK_BAND_MAX', 'REST_ASK_SPOT_SLACK', 'HIT_POS_MAX', 'ENCOUNTER_PLACE_ATTEMPTS', 'onlineRoom', 'encounterSpot', 'askedSpotStands', '_spawnEncounter', '_askAt', 'roomEncounterAsked'].map(optional).join('\n')}
    return { roomEncounterAsked };
  `, state);
  return { ...doors, stood };
}

test('AUDIT REST III E1: the host stands a joiner\'s encounter on the spot the joiner\'s placement found - one trial, not two: in a fire room 26 m across, where the two trials disagreed about half the time, every ask stands its foe where the joiner saw it', () => {
  const col = collider(hall(13));   // the fire in its middle, the joiner 2 m from it: about half the ring's spots inside the ward
  let asks = 0;
  for (let i = 0; i < 300; i++) {
    const j = joinerDoors({ col, seed: i + 1 });
    j.restEncounter(HIT);
    if (!j.asked.length) continue;
    asks++;
    const { rs } = j.asked[0];
    const h = hostDoors({ col });
    assert.equal(h.roomEncounterAsked(`peer${i}`, rs), true);
    assert.deepEqual(h.stood, [rs.s], 'the host stands the foe it was asked for, on the joiner\'s spot - never nothing, never elsewhere');
  }
  assert.ok(asks > 60 && asks < 240, `a room the two trials split in (${asks} asks of 300)`);
});

test('AUDIT REST III E1: the joiner\'s spot is held to what the placement asks of a spot - a forged one (out of the band, through a wall, floating, in the ward, on a foe) is not stood; the host searches for itself, as before', () => {
  const m = hall(20);
  m.quad([5, 0, -20], [5, 0, 20], [5, 6, 20], [5, 6, -20]);   // a partition across the hall at x 5
  const walled = collider(m), open40 = collider(hall(20));
  const ask = (s) => ({ t: 5, lo: HIT.minDistance, hi: HIT.maxDistance, v: 0, f: [0, 0, 0], y: 0, s });
  const at = (h, s) => h.stood.some((p) => p[0] === s[0] && p[1] === s[1] && p[2] === s[2]);
  const far = [[400, 0, 0]];
  const good = hostDoors({ col: open40, fires: far });
  assert.equal(good.roomEncounterAsked('a', ask([-12, 1.25, 0])), true);
  assert.deepEqual(good.stood, [[-12, 1.25, 0]], 'an honest spot: stood where it was found');
  for (const [why, col, s, over] of [
    ['past the band', open40, [-0.5, 1.25, -19.9 - 1], {}],
    ['inside the band\'s near edge', open40, [-3, 1.25, 0], {}],
    ['through a wall', walled, [12, 1.25, 0], {}],
    ['floating', open40, [-12, 4.25, 0], {}],
    ['in a fire\'s ward', open40, [-12, 1.25, 0], { fires: [[-14, 0, 0]] }],
    ['on a foe', open40, [-12, 1.25, 0], { foes: [{ ai: { feet: [-12, 0, 0.2] } }] }],
  ]) {
    const h = hostDoors({ col, fires: far, ...over });
    assert.equal(h.roomEncounterAsked('b', ask(s)), true, `${why}: the ask itself is a rest's`);
    assert.equal(at(h, s), false, `${why}: not stood there`);
  }
});

test('AUDIT REST III E1: a joiner asks no oftener than the host answers - inside the host\'s gap (and the wire\'s wait) no ask and no break; past it, the ask', () => {
  const j = joinerDoors({ col: collider(hall(20)), fires: [[400, 0, 0]] });
  j.restEncounter(HIT);
  assert.equal(j.asked.length, 1);
  j.roomEncounterComing();
  j.restEncounter(HIT);
  assert.equal(j.asked.length, 1, 'the host would refuse it (REST_ASK_GAP_MS) - so it is not asked');
  assert.deepEqual(j.ambushes, [1], 'and breaks nothing');
  assert.equal(j.roomEncounterComing(), false);
});

test('AUDIT REST II F2: a palace stands no fire - its castle block\'s none (AUDIT REST) and its other blocks\' none; its blocks count for nothing', () => {
  const palace = row(4, { castleAt: 0 });
  assert.deepEqual(placeDungeonFires({ blocks: palace, probe: open, seed: 42 }), [], 'the halls behind the court');
  assert.equal(DF.layoutFireCount?.(palace), 0);
  assert.equal(DF.layoutFireCount?.(palace, true), 0, 'an elite palace neither');
  assert.equal(DF.isPalaceLayout?.(palace), true);
  // the castle block anywhere in the layout makes it a palace
  assert.deepEqual(placeDungeonFires({ blocks: row(12, { castleAt: 7 }), probe: open, seed: 42 }), []);
  // and a dungeon with none is no palace: its count is REST3's
  assert.equal(DF.layoutFireCount?.(row(12)), 4);
  assert.equal(placeDungeonFires({ blocks: row(12), probe: open, seed: 42 }).length, 4);
  // the probe tool says so: none wanted, none short
  const r = PROBE.probeFires(new Collider(() => -Infinity), palace.map((b) => ({ ...b, layout: { ...b.layout, placements: [], flats: [] } })), { seed: 42 });
  assert.equal(r.wanted, 0);
  assert.deepEqual(r.fires, []);
  // and the host stands none in the Burning Court or on the Arena's sand (#545's made level, its rest refused there)
  assert.match(D, /\n {2}const firePlan = isGateArena\(dfLocation\) \|\| isArenaFloor\(dfLocation\) \? null : dungeonFirePlan\(\{/);
});

test('AUDIT REST II F3: no fire stands on a loot pile, a quest marker or the player\'s way in - each at least 1.5 m clear of every such marker; the start\'s fire on its ring, 2 m out', () => {
  const blocks = row(12);
  const fires = placeDungeonFires({ blocks, probe: open, seed: 1234 });
  assert.equal(fires.length, 4);
  const items = blocks.flatMap((b) => b.layout.markers.map((m) => [m.x + b.originX, m.y, m.z + b.originZ]));
  for (const f of fires) for (const m of items) assert.ok(flat2(f, m) >= DFIRE.itemM ** 2, `${f} is ${Math.sqrt(flat2(f, m)).toFixed(2)} m from the marker at ${m}`);
  assert.deepEqual(fires[0], [7, 0, 5], 'the entrance fire: the first bearing of the start\'s ring - never on the start (the player appears there)');
  assert.deepEqual([DFIRE.itemM, DFIRE.ringM], [1.5, 2]);
  // the treasure markers' fires all stand on their rings
  for (const f of fires.slice(1)) assert.ok(items.some((m) => Math.abs(flat2(f, m) - DFIRE.ringM ** 2) < 1e-9), `${f} on a marker's ring`);
});

test('AUDIT REST II F3: the ring is asked in a fixed order - the four axis bearings, then the four diagonals (SQRT1_2, no sine) - each spot landed and held to every rule; the first that keeps them is the marker\'s', () => {
  const cand = (x, z) => ({ pos: [x, 0.5, z], water: -Infinity, marker: true });
  const refuse = (bad) => ({ floor: (p) => (bad(p) ? null : { y: 0, ny: 1 }), room: () => true });
  const land = (probe, items = []) => landCandidates([cand(10, 10)], { probe, items }).map((c) => c.pos);
  assert.deepEqual(land(open), [[12, 0, 10]], '+x first');
  assert.deepEqual(land(refuse((p) => p[0] > 11.9 && p[0] < 12.1 && p[2] === 10)), [[8, 0, 10]], 'then -x');
  assert.deepEqual(land(refuse((p) => Math.abs(p[0] - 10) > 1.9 && Math.abs(p[2] - 10) < 0.01)), [[10, 0, 12]], 'then +z');
  const d = DFIRE.ringM * Math.SQRT1_2;
  const axes = (p) => (Math.abs(Math.abs(p[0] - 10) - 2) < 0.01 && Math.abs(p[2] - 10) < 0.01) || (Math.abs(Math.abs(p[2] - 10) - 2) < 0.01 && Math.abs(p[0] - 10) < 0.01);
  assert.deepEqual(land(refuse(axes)), [[10 + d, 0, 10 + d]], 'then the first diagonal, by literal');
  // every rule asks each spot: a door 1 m from +x refuses it; another marker 1 m from it does too (F3's clearance)
  assert.deepEqual(landCandidates([cand(10, 10)], { probe: open, doors: [[13, 0, 10]] }).map((c) => c.pos), [[8, 0, 10]]);
  assert.deepEqual(land(open, [[10, 0.5, 10], [13, 0.5, 10]]), [[8, 0, 10]], 'a second marker by the first bearing');
  assert.deepEqual(land(open, [[10, 0.5, 10], [13, 7, 10]]), [[12, 0, 10]], 'a marker a storey up is not this floor\'s');
  // a block's centre is its own spot - and keeps the clearance too
  const centre = { pos: [0, 0.5, 0], water: -Infinity, centre: true };
  assert.deepEqual(landCandidates([centre], { probe: open }).map((c) => c.pos), [[0, 0, 0]]);
  assert.deepEqual(landCandidates([centre], { probe: open, items: [[1, 0.5, 0.5]] }), [], 'a centre 1.1 m from a pile');
  // nothing kept on a ring whose every spot fails
  assert.deepEqual(land(refuse((p) => !(p[0] === 10 && p[2] === 10))), [], 'never the marker itself, even when only it would do');
});

test('AUDIT REST II F4: a floor looks up - a closed room\'s roof, seen from the void between storeys, is a ceiling\'s back and no floor (the collider says which side it struck)', () => {
  const m = mesh();
  m.room(-10, 0, -10, 10, 4, 10);        // the lower room: floor 0, ceiling 4 (its roof, from above)
  m.room(-12, 9, -12, 12, 13, 12);       // a room of the storey above: its floor's underside at 9
  m.room(14, 3.5, -20, 18, 7.5, 20); m.room(-18, 3.5, -20, -14, 7.5, 20);   // the middle storey's corridors round the void
  m.room(-20, 3.5, 14, 20, 7.5, 18); m.room(-20, 3.5, -18, 20, 7.5, -14);
  const col = collider(m);
  assert.equal(col.raycastHit([0, 6, 0], [0, -1, 0], 5).back, true, 'down onto the roof: the ceiling\'s back');
  assert.equal(col.raycastHit([0, 2, 0], [0, -1, 0], 5).back, false, 'down onto the room\'s floor: its front');
  assert.equal(col.raycastHit([0, 2, 0], [0, 1, 0], 5).back, false, 'up to the ceiling: its front');
  const probe = colliderFireProbe(col);
  assert.equal(probe.floor([0, 5, 0]), null, 'the roof is no floor');
  assert.deepEqual(probe.floor([0, 1, 0]), { y: 0, ny: 1 }, 'the room\'s floor is');
  const centre = { pos: [0, 5, 0], water: -Infinity, centre: true };   // a block's centre at a corridor marker's height
  assert.deepEqual(landCandidates([centre], { probe }), [], 'no fire on the roof between storeys');
  assert.equal(landCandidates([{ pos: [0, 1, 0], water: -Infinity, centre: true }], { probe }).length, 1, 'the room under it keeps its own');
  // the TRAVEL-NAV1 `out` result says it too
  const out = { dist: 0, key: null, normal: [0, 0, 0] };
  col.raycastHit([0, 6, 0], [0, -1, 0], 5, null, out);
  assert.equal(out.back, true);
});

test('AUDIT REST II F4: a hearth\'s width of level floor round it (a second ring, 1.4 m) - a plinth, a dais or a tabletop under the chest-height rays is no hearth, and a fixed treasure on a table stands no fire on it', () => {
  const m = hall(20);
  m.box(-1.2, 0, -1.2, 1.2, 0.85, 1.2);   // a plinth 2.4 m square: the 0.5 m ring stays on it
  const probe = colliderFireProbe(collider(m));
  const top = probe.floor([0, 1.5, 0]);
  assert.ok(Math.abs(top.y - 0.85) < 1e-9 && top.ny === 1, 'its top is a flat face looking up');
  assert.deepEqual(landCandidates([{ pos: [0, 1.5, 0], water: -Infinity, centre: true }], { probe }), [], 'on the plinth: refused');
  assert.equal(landCandidates([{ pos: [10, 0.5, 10], water: -Infinity, centre: true }], { probe }).length, 1, 'the hall\'s floor: kept');
  assert.deepEqual(landCandidates([{ pos: [2.3, 0.5, 0], water: -Infinity, centre: true }], { probe }), [], 'hard by its side: refused');
  // the audit's table: a fixed treasure (216) on a 1.6 m table, 85 cm high - its fire stood on the tabletop
  const t = hall(10);
  t.box(-0.8, 0, -0.8, 0.8, 0.85, 0.8);
  const blocks = [{ name: 'N1.RDB', originX: 0, originZ: 0, isStartingBlock: true, layout: { waterLevel: 10000, markers: [mk(4, 0, 0, 1.0, 216)] } }];
  const kept = landCandidates(fireCandidates(blocks).filter((c) => !c.centre), { probe: colliderFireProbe(collider(t)), items: DF.itemMarks?.(blocks) ?? [] });
  assert.ok(kept.every((c) => c.pos[1] < 0.1), `nothing on the tabletop: ${JSON.stringify(kept.map((c) => c.pos))}`);
  assert.ok(kept.every((c) => Math.abs(c.pos[0]) > 0.8 + DFIRE.reachR || Math.abs(c.pos[2]) > 0.8 + DFIRE.reachR), 'nor within a hearth\'s width of it');
  // ...and the same treasure on the open floor stands its fire on its ring, 2 m out
  const bare = [{ ...blocks[0], layout: { ...blocks[0].layout, markers: [mk(4, 0, 0, 0.5, 216)] } }];
  assert.deepEqual(landCandidates(fireCandidates(bare).filter((c) => !c.centre), { probe: colliderFireProbe(collider(hall(10))), items: DF.itemMarks?.(bare) ?? [] }).map((c) => c.pos), [[2, 0, 0]]);
  assert.equal(DFIRE.reachR, DFIRE.roomM - 0.1, 'the wall rays promise 1.5 m of room; the floor answers for all but its last 10 cm');
});

test('AUDIT REST II F5: the law says which layout fire it took for the entrance\'s - the nearest the door, whatever the list\'s order - and none where it stood its own', () => {
  const blocks = row(12);
  const plan = DF.dungeonFirePlan?.({ blocks, probe: open, seed: 1234, existing: [[8, 0, 8], [RDB_SIDE * 6, 0, 30]] });
  assert.deepEqual(plan?.doorFire, [8, 0, 8]);
  assert.equal(plan.fires.length, 3, 'C5: the brazier counts toward N');
  assert.deepEqual(plan.fires, placeDungeonFires({ blocks, probe: open, seed: 1234, existing: [[8, 0, 8], [RDB_SIDE * 6, 0, 30]] }), 'the placed list and its keys unchanged');
  // two braziers by the door: the nearer; at the same reach, the lesser coordinates - in any order
  for (const ex of [[[9, 0, 5], [5, 0, 8]], [[5, 0, 8], [9, 0, 5]], [[5, 0, 10], [9, 0, 5], [5, 0, 1]], [[5, 0, 1], [9, 0, 5], [5, 0, 10]]]) {
    const want = ex.length === 2 ? [5, 0, 8] : [5, 0, 1];
    assert.deepEqual(DF.dungeonFirePlan({ blocks, probe: open, seed: 1, existing: ex }).doorFire, want, JSON.stringify(ex));
  }
  assert.equal(DF.dungeonFirePlan({ blocks, probe: open, seed: 1234 }).doorFire, null, 'no brazier: the law\'s own entrance fire');
  assert.equal(DF.dungeonFirePlan({ blocks, probe: open, seed: 1234, existing: [[RDB_SIDE * 6, 0, 30]] }).doorFire, null, 'a brazier far in is not the door\'s');
  assert.deepEqual(DF.chooseFirePlan?.([], { existing: [[1, 0, 1]] }), { fires: [], doorFire: null }, 'nothing landed: nothing chosen');
  // the probe tool reports it off the same call
  const tool = PROBE.probeFires(new Collider(() => -Infinity), blocks.map((b) => ({ ...b, layout: { ...b.layout, placements: [], flats: [] } })), { seed: 1 });
  assert.equal(tool.doorFire, null);
});

/** The host's placement, from the plan to the list the ward, the compass and the map read - and the abyss's door -
 *  mounted from dungeonContext.js's own statements over the real law. */
async function hostFires({ hearths, blocks, size = { w: 1, h: 2 } }) {
  const at = D.indexOf('  const firePlan = isGateArena(dfLocation)');
  const endMark = '  function dropDungeonFires(isFixture) {';
  const fnEnd = D.indexOf('\n  }\n', D.indexOf(endMark)) + 4;
  const body = at >= 0 && D.indexOf(endMark) > at ? D.slice(at, fnEnd) : '';
  const state = {
    isGateArena: () => false, isArenaFloor: () => false, dungeonFirePlan: DF.dungeonFirePlan, placeDungeonFires, colliderFireProbe: () => open, collider: null,
    fireLayoutInputs, dungeon: { blocks }, dfLocation: { dungeon: { recordElement: { header: { locationId: 1234 } } } },
    DUNGEON_FIRE_FLAT: DF.DUNGEON_FIRE_FLAT, getTexture: async () => ({ recordCount: 30 }), billboardSize: () => size,
    flatGroups: new Map(), torches: [], iilLightFlats: [], lights: [], billboardBatches: [], FIRE_LIGHT_UP: 1, FIRE_LIGHT_RANGE: 12,
    dungeonHearths: hearths, flatAnims: { remove: () => {} }, renderer: { destroyBatch: () => {} },
  };
  const api = await mountAsync(`${body}\n const abyss = ${propSrc('api', 'abyss')};\n return { dungeonFires: typeof dungeonFires === 'undefined' ? [] : dungeonFires, abyss };`, state);
  return { ...api, state };
}

test('AUDIT REST II F5: the brazier taken for the entrance\'s fire keeps a campfire\'s promises - the online ward, the compass\'s yellow mark and the held map read it with the placed fires', async () => {
  const blocks = row(12);
  const brazier = { x: 8, y: 1, z: 8, foot: 0, lawFoot: 0, w: 1, h: 2 };
  const { dungeonFires, state } = await hostFires({ hearths: [brazier], blocks });
  assert.equal(state.dungeonHearths.filter((h) => h.placed).length, 3, 'three placed past the brazier (C5)');
  assert.deepEqual(dungeonFires[0], [8, 0, 8], 'the door\'s brazier, first');
  assert.deepEqual(dungeonFires.slice(1), state.dungeonHearths.filter((h) => h.placed).map((h) => [h.x, h.foot, h.z]), 'then the placed fires, in their order');
  assert.equal(inFireWard(dungeonFires, { x: 14, y: 0, z: 8 }), true, 'a wandering spawn 6 m from the brazier is warded (encounterSpot reads this list)');
  assert.ok(withFireMarks(null, dungeonFires, [5, 0, 5]).some((p) => p.mark === 'fire' && p.xz[0] === 8 && p.xz[1] === 8), 'the compass marks it');
  // the compass and the held map read this one list (REST3's pins name the reads; this is the list they name)
  assert.match(D, /nodes: playerFeet \? withFireMarks\(opts\.nodeMarks\?\.\(playerFeet\) \?\? null, dungeonFires, playerFeet\) : null,/);
  assert.match(D, /fires: dungeonFires,   \/\/ REST3/);
  // no brazier by the door: the placed fires alone
  const plain = await hostFires({ hearths: [], blocks });
  assert.equal(plain.dungeonFires.length, 4);
  assert.deepEqual(plain.dungeonFires, plain.state.dungeonHearths.map((h) => [h.x, h.foot, h.z]));
});

test('AUDIT REST II F6: tools/dungeonFireProbe.mjs reads the models the host reads - patchSeams before the mesh (stair 59002\'s foot where the game\'s collider has it)', () => {
  const plane = (pts) => ({ points: pts.map(([x, y, z]) => ({ x, y, z, nx: 0, ny: -1, nz: 0, u: 0, v: 0 })) });
  const raw = { totalVertices: 3, totalTriangles: 1, subMeshes: [{ textureArchive: 1, textureRecord: 0, planes: [plane([[-166, -2, 0], [38, -2, 0], [38, -2, 64]])] }] };
  const arch = { getRecordIndex: (id) => (id === 59002 || id === 7 ? id : -1), getMesh: () => raw };
  const read = PROBE.hostModelReader?.(arch);
  assert.equal(typeof read, 'function');
  const host = dfMeshToModel(patchSeams(59002, raw), () => ({ width: 64, height: 64 }));
  assert.deepEqual(Array.from(read(59002).positions), Array.from(host.positions), 'the host\'s patched stair');
  assert.notDeepEqual(Array.from(read(59002).positions), Array.from(dfMeshToModel(raw, () => ({ width: 64, height: 64 })).positions), 'not the raw one');
  assert.deepEqual(Array.from(read(7).positions), Array.from(dfMeshToModel(raw, () => ({ width: 1, height: 1 })).positions), 'a model with no rule as it is');
  assert.equal(read(123), null, 'one the archive lacks is none, as the host\'s');
  assert.equal(read(59002), read(59002), 'read once');
  assert.match(rd('tools/dungeonFireProbe.mjs'), /const getModel = hostModelReader\(data\.arch\);[^\n]*\n[\s\S]*layoutDungeon\(loc, data\.blocks, getModel\);\n    const col = hostFireCollider\(blocks, getModel\);/, 'the tool\'s collider and layout over it');
});

test('AUDIT REST II F7: an exit door is measured from its face\'s centre (doorWorldPosition\'s reading), not its model\'s origin; an action door, which carries none, from its origin', () => {
  const turn = [0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 3, 0.5, 4, 1];   // a quarter turn about y, then to (3, 0.5, 4)
  const exit = { doorType: DOOR_TYPE.DUNGEON_EXIT, matrix: turn, centre: { x: 2, y: 1, z: 0.5 }, normal: { x: 0, y: 0, z: 1 } };
  const blocks = [{ name: 'N1.RDB', originX: 100, originZ: 50, isStartingBlock: true, layout: { markers: [], actionDoors: [{ matrix: trs(1, 0, 2, 0, 0, 0) }], exitDoors: [exit] } }];
  const { doors } = fireLayoutInputs(blocks, []);
  const host = doorWorldPosition({ ...exit, matrix: multiply(trs(100, 0, 50, 0, 0, 0), exit.matrix) });   // the host's own exit door (dungeonContext's exitDoors)
  assert.equal(doors.length, 2);
  assert.deepEqual(doors[0], [101, 0, 52], 'the action door at its origin');
  for (let k = 0; k < 3; k++) assert.ok(Math.abs(doors[1][k] - host[k]) < 1e-9, `the exit door's centre, as the host reads it: ${doors[1]} / ${host}`);
  assert.notDeepEqual(doors[1], [103, 0.5, 54], 'not the origin');
  // the law keeps 3 m from the centre: a spot 2.5 m from it (3.5 m from the origin) is a doorway
  const c = doors[1];
  const cand = { pos: [c[0] + 2.5, 0.5, c[2]], water: -Infinity, centre: true };
  assert.deepEqual(landCandidates([cand], { probe: { floor: () => ({ y: c[1], ny: 1 }), room: () => true }, doors }), []);
});

test('AUDIT REST II F8: the drowned abyss puts the fires out - the light fixtures\' removal takes the placed fires\' hearths, the ward and the marks with their flames; AUDIT REST III E4 (RE-AIMED): and the layout\'s own braziers, the one taken for the entrance\'s among them - no flameless "Fire" to cook at under the water', async () => {
  const blocks = row(12);
  const brazier = { x: 8, y: 1, z: 8, foot: 0, lawFoot: 0, w: 1, h: 2, archive: 210, record: 0 };   // a layout row names its flat (E4)
  const { dungeonFires, abyss, state } = await hostFires({ hearths: [brazier], blocks });
  assert.equal(dungeonFires.length, 4);
  assert.deepEqual(state.dungeonHearths.filter((h) => h.placed).map((h) => [h.archive, h.record]), [[210, 1], [210, 1], [210, 1]], 'each placed row names its flat');
  abyss.removeLightFixtures((a, r) => a === 210 && r === 99);   // a removal that spares every hearth's flat: the fires stand
  assert.equal(dungeonFires.length, 4);
  assert.equal(state.dungeonHearths.length, 4);
  abyss.removeLightFixtures(isDungeonLightFixture);   // There's a Hole in the Bottom of the Ocean's RemoveDungeonLightFixtures
  assert.deepEqual(dungeonFires, [], 'no ward, no compass mark, no map mark');
  assert.deepEqual(state.dungeonHearths, [], 'no hearth under the water - placed or the layout\'s own');
  assert.equal(inFireWard(dungeonFires, { x: 8, y: 0, z: 8 }), false);
  // the invariant the abyss leans on: every hearth's flame, and the placed fires', is a dungeon light fixture
  for (let r = 0; r < 64; r++) if (isHearthFlat(210, r)) assert.equal(isDungeonLightFixture(210, r), true, `hearth 210/${r}`);
  assert.equal(isDungeonLightFixture(DF.DUNGEON_FIRE_FLAT.archive, DF.DUNGEON_FIRE_FLAT.record), true);
  // a layout row is built naming its flat
  assert.match(D, /lawFoot: lawSize \? f\.y - lawSize\.h \/ 2 : undefined, archive: f\.archive, record: f\.record \}\);/);
});

test('AUDIT REST II F9: the cold-fire sweep reads the room\'s roster at most once a second, and only while a peer\'s camp stands - no roster minted every frame', () => {
  let calls = 0;
  const swept = [];
  const camps = { camps: [{ owner: null }], sweepColdAbsent: (s) => { swept.push([...s].sort()); return 0; } };
  const state = { opts: { selfId: () => 'me', peers: () => { calls++; return [{ id: 'b' }, { id: 'a' }]; } }, camps };
  const { sweep } = mount(`${['COLD_SWEEP_S', '_coldSweepT', 'onlineRoom', 'sweepColdPeers'].map(optional).join('\n')}\n return { sweep: typeof sweepColdPeers === 'function' ? sweepColdPeers : null };`, state);
  assert.equal(typeof sweep, 'function');
  for (let i = 0; i < 600; i++) sweep(1 / 60);
  assert.equal(calls, 0, 'only my own camp stands: no roster read at all');
  camps.camps.push({ owner: 'b' });
  for (let i = 0; i < 600; i++) sweep(1 / 60);
  assert.ok(calls >= 9 && calls <= 10, `ten seconds, at most ten reads (was one a frame): ${calls}`);
  assert.deepEqual(swept.at(-1), ['a', 'b'], 'the room\'s ids, as before');
  calls = 0;
  for (let i = 0; i < 8; i++) sweep(0.25);
  assert.equal(calls, 2, 'once a second');
  state.opts.selfId = () => null;   // offline: no room, no sweep
  calls = 0;
  for (let i = 0; i < 8; i++) sweep(0.25);
  assert.equal(calls, 0);
  assert.match(D, /camps\.tick\(dt\);[^\n]*\n    sweepColdPeers\(dt\);/, 'the frame calls it after the camps\' own tick');
  assert.doesNotMatch(D, /camps\.sweepColdAbsent\(new Set\(peers\.map\(\(q\) => q\?\.id\)\)\); \}   \/\/ AUDIT REST-PARTY B3/, 'the per-frame roster is gone');
});

test('AUDIT REST II: the law stays one answer on every client - a real collider, the same layout twice, a copy, the layout\'s fires in any order; no trig, no clock, no dice in the law', () => {
  const m = hall(25, 8);
  m.box(-1.2, 0, -1.2, 1.2, 0.85, 1.2);   // a plinth with a treasure on it
  m.box(20, 0, 20, 22, 1, 22);   // a table with a fixed treasure on it
  const col = collider(m);
  const blocks = [{   // in the hall's frame: the start at (5, 5), the plinth's treasure (0, 0), the table's (21, 21), a treasure at (-15, 10), a foe at (-15, -15)
    name: 'N1.RDB', originX: -40, originZ: -40, isStartingBlock: true,
    layout: { waterLevel: 10000, markers: [mk(10, 45, 45), mk(19, 40, 40, 1), mk(4, 61, 61, 1.2, 216), mk(19, 25, 50), mk(15, 25, 25)], startMarkers: [mk(10, 45, 45)] },
  }, { name: 'N2.RDB', originX: 11.2, originZ: -40, isStartingBlock: false, layout: { waterLevel: 10000, markers: [mk(19, -1.2, 25)] } }];   // a treasure at (10, -15)
  const existing = [[-50, 0, 50], [50, 0, -50]];
  const plan = DF.dungeonFirePlan?.({ blocks, probe: colliderFireProbe(col), seed: 99, existing });
  assert.equal(plan?.valid, 3, 'the start\'s and the two floor treasures\' rings; neither the plinth\'s nor the table\'s');
  assert.equal(plan.fires.length, 1, 'a 50 m hall holds one fire - the next must stand 80 m off');
  assert.deepEqual(DF.dungeonFirePlan({ blocks: structuredClone(blocks), probe: colliderFireProbe(col), seed: 99, existing: structuredClone(existing) }), plan);
  assert.deepEqual(DF.dungeonFirePlan({ blocks, probe: colliderFireProbe(col), seed: 99, existing: [...existing].reverse() }), plan);
  const law = rd('src/world/dungeon/dungeonFires.js').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(law, /Math\.(sin|cos|tan|atan2?|random|hypot)\(|Date\.|performance\./, 'only literals and plain arithmetic');
});
