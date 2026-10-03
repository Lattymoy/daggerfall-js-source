// ARENA5 (2026-10-03): THE HALL OF CHAMPIONS' PLAQUE WALL, DRIVEN (bible/11-Multiplayer/Arena.md 1: "the Hall of Champions
// - a plaque wall naming every Grand Champion this save (offline) or this realm (online)"). The row measured about the
// Keeper in a room's collider (world/arenaPlaques.js hallPlaquePlan - the nearest wall, a plaque where that wall stands and
// nothing between her and it, left to right as one faces it, capped); the plaque's two boards (plaqueModel - Daggerfall's
// framed picture on the dark wood of its paintings' backs, the bare board) on the model door; the names (systems/arenaBoard.js
// hallPlaques - the save's own Grand Champion among the banners' by season offline, the realm's hall online) through the
// gate (scenes/arenaGate.js plaques - online never the save's); the host's wiring by source (scenes/worldModes.js - stood at
// the undercroft's mount, drawn, named, pressed; dungeonContext.js's Hall place; both hosts' door).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  hallPlaquePlan, plaqueModel, registerArenaPlaques, _resetArenaPlaques, PLAQUE_MODEL, PLAQUE_BARE_MODEL, PLAQUE_MAX, PLAQUE_GAP_M, PLAQUE_UP_M,
  PLAQUE_OFF_M, PLAQUE_PICTURE, PLAQUE_WOOD,
} from '../src/world/arenaPlaques.js';
import { customModelFor, _resetCustomModels } from '../src/world/customModels.js';
import { hallPlaques } from '../src/systems/arenaBoard.js';
import * as LG from '../src/systems/arenaLeague.js';
import { newArenaLadder } from '../src/systems/arenaLadder.js';
import { ARENA_TEXT } from '../src/systems/arenaText.js';
import { createArenaGate } from '../src/scenes/arenaGate.js';
import { MINUTES_PER_DAY } from '../src/systems/gameDate.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const START = 523530;
const U = ARENA_TEXT.undercroft;

/** A room's collider: the box's walls, a doorway's gap in some (`holes`: `{ wall: 'x+'|'x-'|'z+'|'z-', lo, hi }` along the
 *  wall, under 2.5 m) through which a ray runs on; answers the distance to the first wall, or Infinity. */
function roomRay(box, holes = []) {
  return (o, d, max) => {
    let best = Infinity;
    const axes = [['x', 0], ['y', 1], ['z', 2]];
    for (const [a, i] of axes) {
      if (Math.abs(d[i]) < 1e-9) continue;
      const bound = d[i] > 0 ? box[a][1] : box[a][0];
      const t = (bound - o[i]) / d[i];
      if (!(t >= 0) || t >= best) continue;
      const p = [o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t];
      const wall = `${a}${d[i] > 0 ? '+' : '-'}`;
      const along = a === 'x' ? p[2] : p[0];
      if (holes.some((h) => h.wall === wall && along >= h.lo && along <= h.hi && p[1] < 2.5)) continue;   // through the doorway
      best = t;
    }
    return best <= max ? best : Infinity;
  };
}
const ROOM = { x: [-6, 6], y: [0, 4], z: [-3, 2] };

test('ARENA5 the row: on the wall nearest the Keeper at a plaque\'s height, centred on her a pace apart, its back two centimetres off it, its face out, left to right as one faces it, PLAQUE_MAX at most (mutants: ARENA5-PLAQUE-NEAREST-WALL, ARENA5-PLAQUE-YAW, ARENA5-PLAQUE-ORDER, ARENA5-PLAQUE-CAP)', () => {
  const plan = hallPlaquePlan([0.5, 1.1, 0], roomRay(ROOM));
  assert.equal(plan.floor, 0);
  assert.deepEqual(plan.wall, [0, 1], 'the z = 2 wall - 2 m off, the nearest');
  assert.equal(plan.plaques.length, PLAQUE_MAX);
  const xs = plan.plaques.map((p) => p.pos[0]);
  assert.deepEqual(xs, [...xs].sort((a, b) => a - b), 'left to right facing +z (+x on the right)');
  assert.deepEqual(plan.plaques.map((p) => p.k), [...Array(PLAQUE_MAX).keys()]);
  for (const p of plan.plaques) {
    assert.ok(Math.abs(p.pos[2] - (2 - PLAQUE_OFF_M)) < 1e-9, 'its back two centimetres off the wall');
    assert.equal(p.pos[1], PLAQUE_UP_M, 'at a plaque\'s height over the floor');
    assert.equal(Math.round(Math.abs(p.yawDeg)), 180, 'its face out of the wall (to -z)');
  }
  for (let i = 1; i < xs.length; i++) assert.ok(Math.abs(xs[i] - xs[i - 1] - PLAQUE_GAP_M) < 1e-9, 'a pace apart');
  assert.ok(xs.includes(0.5), 'one centred on her');
  assert.ok(Math.max(...xs) <= 6 - 0.4 && Math.min(...xs) >= -6 + 0.4, 'inside the room\'s corners');
  // a short row asked: the cap is the caller's
  assert.equal(hallPlaquePlan([0.5, 1.1, 0], roomRay(ROOM), { max: 3 }).plaques.length, 3);
  assert.deepEqual(hallPlaquePlan([0.5, 1.1, 0], roomRay(ROOM), { max: 3 }).plaques.map((p) => p.pos[0]), [-0.5, 0.5, 1.5], 'kept round her');
  // the nearest wall another way: the x = -6 wall a metre off
  const west = hallPlaquePlan([-5, 1, 0], roomRay(ROOM));
  assert.deepEqual(west.wall.map((v) => Math.round(v) + 0), [-1, 0]);
  assert.ok(west.plaques.every((p) => Math.abs(p.pos[0] - (-6 + PLAQUE_OFF_M)) < 1e-9 && Math.round(p.yawDeg) === 90), 'face to +x');
  const zs = west.plaques.map((p) => p.pos[2]);
  assert.deepEqual(zs, [...zs].sort((a, b) => a - b), 'facing -x, the right is +z (a quarter turn left of +z): left to right is -z to +z');
});

test('ARENA5 the row keeps to the wall: no plaque over a doorway or past a corner, none where no floor or no wall stands near her (mutants: ARENA5-PLAQUE-DOORWAY, ARENA5-PLAQUE-CORNER, ARENA5-PLAQUE-NO-FLOOR)', () => {
  const door = hallPlaquePlan([0, 1, 0], roomRay(ROOM, [{ wall: 'z+', lo: 1.5, hi: 2.5 }]));
  const xs = door.plaques.map((p) => p.pos[0]);
  assert.ok(!xs.some((x) => x >= 1.5 - 1e-9 && x <= 2.5 + 1e-9), 'nothing hung in the doorway');
  assert.deepEqual(xs, [-5, -4, -3, -2, -1, 0, 1, 3, 4, 5], 'either side of it, every one on the wall');
  assert.ok(door.plaques.every((p) => p.pos.every(Number.isFinite) && Math.abs(p.pos[2] - (2 - PLAQUE_OFF_M)) < 1e-9), 'none hung out past the doorway');
  // a narrow room: the corners close the row
  const narrow = hallPlaquePlan([0, 1, 0], roomRay({ x: [-1.6, 1.6], y: [0, 4], z: [-3, 1] }));
  assert.deepEqual(narrow.plaques.map((p) => p.pos[0]), [-1, 0, 1], 'three fit between the corners');
  assert.equal(hallPlaquePlan([0, 1, 0], () => Infinity), null, 'no floor under her');
  assert.equal(hallPlaquePlan([0, 1, 0], (o, d) => (d[1] < 0 ? Infinity : 2)), null, 'walls round her but no floor');
  assert.equal(hallPlaquePlan([0, 1, 0], (o, d) => (d[1] < 0 ? 1 : Infinity)), null, 'no wall near her');
  assert.equal(hallPlaquePlan(null, roomRay(ROOM)), null);
  assert.equal(hallPlaquePlan([0, 1, 0], null), null);
});

test('ARENA5 the plaques themselves: a board of the dark wood Daggerfall backs its paintings with, facing +Z from its back\'s middle, and a champion\'s with one of Daggerfall\'s framed pictures set proud of it; on the model door behind no switch (mutants: ARENA5-PLAQUE-NO-PICTURE, ARENA5-PLAQUE-NOT-REGISTERED)', () => {
  const cut = plaqueModel(true), bare = plaqueModel(false);
  const tex = (m) => m.subMeshes.map((s) => `${s.textureArchive}_${s.textureRecord}`);
  assert.deepEqual(tex(cut), [`${PLAQUE_PICTURE.archive}_${PLAQUE_PICTURE.record}`, PLAQUE_WOOD.join('_')]);
  assert.deepEqual(tex(bare), [PLAQUE_WOOD.join('_')]);
  assert.deepEqual([PLAQUE_PICTURE.archive, PLAQUE_WOOD[0], PLAQUE_WOOD[1]], [48, 0, 46], 'TEXTURE.048 (the framed paintings), TEXTURE.000 record 46 (their backs)');
  let zmin = Infinity, zmax = -Infinity;
  for (let i = 2; i < bare.positions.length; i += 3) { zmin = Math.min(zmin, bare.positions[i]); zmax = Math.max(zmax, bare.positions[i]); }
  assert.ok(zmin === 0 && zmax > 0 && zmax < 0.1, 'from its back (z 0) out along +Z, a few centimetres');
  // every face wound to its normal (the port's front face)
  for (const m of [cut, bare]) {
    for (let t = 0; t < m.indices.length; t += 3) {
      const [a, b, c] = [0, 1, 2].map((k) => [...m.positions.subarray(m.indices[t + k] * 3, m.indices[t + k] * 3 + 3)]);
      const n = [...m.normals.subarray(m.indices[t] * 3, m.indices[t] * 3 + 3)];
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const cr = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      assert.ok(cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] > 0, 'wound to its normal');
    }
  }
  _resetCustomModels(); _resetArenaPlaques();
  assert.equal(customModelFor(PLAQUE_MODEL), null);
  registerArenaPlaques();
  assert.deepEqual(tex(customModelFor(PLAQUE_MODEL)), tex(cut));
  assert.deepEqual(tex(customModelFor(PLAQUE_BARE_MODEL)), tex(bare));
  assert.match(read('src/world/arenaCity.js'), /registerArenaPlaques\(\);/, 'installArena registers them with the colosseum');
  _resetCustomModels(); _resetArenaPlaques();
});

test('ARENA5 the names on the wall: offline this save\'s - its own Grand Champion (the banner won under, the season taken) among the banners\' champions by season, the newest first; online the realm\'s hall, its season each, no banner; capped (mutants: ARENA5-PLAQUES-MINE-MISSING, ARENA5-PLAQUES-ORDER, ARENA5-PLAQUES-ONLINE-SAVE)', () => {
  const gm = START + 3 * 360 * MINUTES_PER_DAY;
  const L = { ...LG.newArenaLeague(), season: 405, since: 405 };
  const theirs = LG.rosterGrandChampions(L, gm);
  assert.ok(theirs.length >= 1);
  const none = hallPlaques({ ladder: newArenaLadder(), league: L, gameMinutes: gm, name: 'Aldo' });
  assert.deepEqual(none.map((p) => p.name), theirs.map((c) => `${c.name} of ${c.home}`).slice(0, 10));
  assert.deepEqual(none[0], { name: `${theirs[0].name} of ${theirs[0].home}`, banner: theirs[0].banner, season: `3E ${theirs[0].season}` });
  // mine: taken in 3E 406 under the Blue
  const grand = { ...newArenaLadder(), grand: true, tier: 9, won: 3, champs: Array(10).fill(true) };
  const mineAt = START + 400 * MINUTES_PER_DAY;
  const L2 = { ...L, grandAt: mineAt, bouts: [{ at: mineAt, tier: 9, label: '', opp: 'x', won: true, how: 'fall', purse: 0, points: 10, champion: true, grand: true, team: 'blue' }] };
  const mine = hallPlaques({ ladder: grand, league: L2, gameMinutes: gm, name: 'Aldo' });
  const k = mine.findIndex((p) => p.name === 'Aldo');
  assert.deepEqual(mine[k], { name: 'Aldo', banner: 'blue', season: '3E 406' });
  assert.ok(mine.slice(0, k).every((p) => Number(p.season.slice(3)) > 406) && mine.slice(k + 1).every((p) => Number(p.season.slice(3)) <= 406), 'among them by season, mine first in my own');
  assert.equal(hallPlaques({ ladder: grand, league: L2, gameMinutes: gm, name: 'Aldo', max: 1 }).length, 1);
  // online: the realm's
  const board = { season: 3, hall: [{ name: 'Vex', at: 1_790_553_600 + 60 * 86400 }, { name: '', at: 0 }, { name: 'Ro', at: 0 }], me: { ladder: grand } };
  assert.deepEqual(hallPlaques({ board, ladder: grand, league: L2, gameMinutes: gm, name: 'Aldo' }), [{ name: 'Vex', banner: null, season: 'Season 2' }, { name: 'Ro', banner: null, season: 'Season 3' }], 'the realm\'s alone - never the save\'s');
  assert.deepEqual(hallPlaques({ board: { season: 1, hall: [] } }), []);
});

test('ARENA5 the gate\'s word on the wall: offline the save\'s names, online the realm\'s board - asked when it is not in, and bare until it comes (mutants: ARENA5-GATE-PLAQUES-OFFLINE, ARENA5-GATE-PLAQUES-WAIT)', () => {
  const gm = START + 3 * 360 * MINUTES_PER_DAY;
  const P = { name: 'Aldo', health: 10, maxHealth: 10, arenaLadder: newArenaLadder(), arenaLeague: { ...LG.newArenaLeague(), season: 405, since: 405 } };
  let on = null;
  const G = createArenaGate({ playerEntity: P, gameMinutes: () => gm, showOverlay: () => {}, online: () => on });
  const offline = G.plaques();
  assert.deepEqual(offline, hallPlaques({ ladder: P.arenaLadder, league: P.arenaLeague, gameMinutes: gm, name: 'Aldo' }));
  assert.ok(offline.length >= 1);
  let asked = 0, board = null;
  on = { live: () => true, board: () => board, refresh: () => { asked++; } };
  assert.deepEqual(G.plaques(), [], 'online, no board yet: bare');
  assert.equal(asked, 1, 'the board asked');
  board = { season: 2, hall: [{ name: 'Vex', at: 0 }] };
  assert.deepEqual(G.plaques(), [{ name: 'Vex', banner: null, season: 'Season 2' }]);
  assert.ok(PLAQUE_MAX >= 8, 'a wall of names');
});

test('ARENA5 the wall\'s words and wiring: a plaque reads its champion - name, banner, season, Grand Champion - or the stone\'s waiting line; stood at the undercroft\'s mount about the Keeper\'s place, drawn on the dungeon\'s pass (a champion\'s board for each name, the bare after), named and pressed through one key (mutants: ARENA5-WALL-NOT-STOOD, ARENA5-WALL-CUT-COUNT, ARENA5-WALL-PRESS)', () => {
  assert.equal(U.plaqueLine('Aldo', 'the Blue Banner', '3E 406'), 'Aldo - Grand Champion of the Arena of Daggerfall, for the Blue Banner, 3E 406.');
  assert.equal(U.plaqueLine('Vex', '', 'Season 2'), 'Vex - Grand Champion of the Arena of Daggerfall, Season 2.');
  assert.equal(U.plaqueTitle('Vex'), 'Vex, Grand Champion');
  assert.equal(U.hallNone, 'No name is cut here yet. The stone waits for one.');
  const M = read('src/scenes/worldModes.js');
  assert.match(M, /standArenaWall\(ctx, dfLocation\)\.catch\(\(\) => \{\}\);/, 'stood at the mount');
  assert.match(M, /const plan = hallPlaquePlan\(ctx\.arenaHall, \(o, d, m\) => ctx\.collider\?\.raycast\?\.\(o, d, m\) \?\? Infinity\);/, 'about the Keeper, in the level\'s collider');
  assert.match(M, /for \(const p of w\.plaques\) renderer\.drawMesh\(p\.k < n \? w\.gpu\.cut : w\.gpu\.bare, p\.matrix, null\);/, 'a champion\'s board for each name');
  assert.match(M, /drawArenaWall\(\);   \/\/ ARENA5/, 'drawn on the dungeon\'s pass');
  assert.match(M, /if \(key\.startsWith\('plaque:'\)\) \{ readPlaque\(key\); return true; \}/, 'pressed');
  assert.match(M, /say\(c \? U\.plaqueLine\(c\.name, c\.banner \? ARENA_TEXT\.teams\.the\[c\.banner\] \?\? '' : '', c\.season\) : U\.hallNone\);/, 'its line, or the stone\'s');
  assert.match(M, /ctx\.addActivationTargets\(\(\) => arenaWallLive\(\)\?\.plaques\.map/, 'in the ray');
  assert.match(M, /key\.startsWith\('plaque:'\) \? plaqueName\(key\) : null/, 'and named on the plaque');
  assert.match(read('src/scenes/dungeonContext.js'), /arenaHall: _undercroftHall\?\.hall \?\? null,/);
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) assert.match(read(f), /arenaHallPlaques: \(\) => arenaGate\.plaques\(\),/, f);
});
