// CROWN-HALL (2026-10-02, Mac: "Build that next"): A CROWN'S CASTLE AS ITS HOLDER'S HALL - the throne room found by its
// ruler (the region's Province faction's first child, an Individual - MacroHelper.GetLordNameForFaction's law), its
// pieces placed about them in the dungeon's own collider (src/systems/crownHall.js), and the hosts' seams
// (src/scenes/worldModes.js crownHall, src/scenes/world.js seatHall.crown and drawDungeonBanners). bible/11-Multiplayer/
// Seats-Arc.md 7.2; `06-Systems/Online-Arc.md` CROWN-HALL.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Collider } from '../../src/player/collider.js';
import { FACTION_TYPES } from '../../src/formats/factionFile.js';
import { BULLETIN_BOARD_MODEL_ID } from '../../src/world/rmbLayout.js';
import { BANNER_H_M } from '../../src/render/bannerPass.js';
import {
  crownRulerFactionId, crownRulerHere, crownHallPlan, CROWN_HALL_CHEST_MODEL, CROWN_HALL_BOARD_MODEL, CROWN_HALL_TEXT,
  CROWN_HALL_SPOTS, CROWN_HALL_BANNER_SIDE_M, CROWN_HALL_BANNER_OUT_M, CROWN_HALL_BANNER_TOP_M, CROWN_HALL_WALL_M,
} from '../../src/systems/crownHall.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const quad = (c, key, a, b, cc, d) => c.addMesh(key, new Float32Array([...a, ...b, ...cc, ...d]), new Uint32Array([0, 1, 2, 0, 2, 3]), IDENTITY);
const box = (c, key, [x0, y0, z0, x1, y1, z1]) => c.addMesh(key,
  new Float32Array([x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1]),
  new Uint32Array([0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 3, 2, 6, 3, 6, 7, 0, 3, 7, 0, 7, 4, 1, 5, 6, 1, 6, 2]), IDENTITY);
/** A throne room x 0 to 20, z 0 to 12, `h` high, its back wall at z = 0; a throne against it. */
function throneRoom({ h = 5, pillar = null, back = 0 } = {}) {
  const c = new Collider();
  quad(c, 'floor', [0, 0, 0], [20, 0, 0], [20, 0, 12], [0, 0, 12]);
  quad(c, 'ceiling', [0, h, 0], [20, h, 0], [20, h, 12], [0, h, 12]);
  quad(c, 'back', [0, 0, back], [20, 0, back], [20, h, back], [0, h, back]);
  quad(c, 'front', [0, 0, 12], [20, 0, 12], [20, h, 12], [0, h, 12]);
  quad(c, 'west', [0, 0, 0], [0, h, 0], [0, h, 12], [0, 0, 12]);
  quad(c, 'east', [20, 0, 0], [20, h, 0], [20, h, 12], [20, 0, 12]);
  box(c, 'throne', [9.5, 0, 0.6, 10.5, 1.8, 1.2]);   // its back under the wall's look, over the eye's
  if (pillar) box(c, 'pillar', pillar);
  return c;
}
const RULER = { x: 10, y: 0.9, z: 1.5, factionID: 381 };
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg}: ${a} vs ${b}`);

test('CROWN-HALL the ruler: the region\'s Province faction\'s first child, when an Individual (MacroHelper.GetLordNameForFaction\'s law); found among the castle\'s people by it (mutants: the type; the region; the first child; the Individual)', () => {
  const dict = new Map([
    [17, { id: 17, type: FACTION_TYPES.Province, region: 17, children: [381, 382] }],
    [381, { id: 381, type: FACTION_TYPES.Individual, region: 17 }],
    [382, { id: 382, type: FACTION_TYPES.Individual, region: 17 }],
    [23, { id: 23, type: FACTION_TYPES.Province, region: 23, children: [900] }],
    [900, { id: 900, type: FACTION_TYPES.Group, region: 23 }],
    [5, { id: 5, type: FACTION_TYPES.Courts, region: 1, children: [381] }],
  ]);
  assert.equal(crownRulerFactionId(dict, 17), 381, 'Gothryd, the first child');
  assert.equal(crownRulerFactionId(dict, 23), null, 'a first child no Individual names no ruler');
  assert.equal(crownRulerFactionId(dict, 1), null, 'a court is no Province');
  assert.equal(crownRulerFactionId(dict, 99), null);
  assert.equal(crownRulerFactionId(null, 17), null);
  const people = [{ factionID: 12 }, RULER, { ...RULER, z: 9 }];
  assert.equal(crownRulerHere(people, 381), RULER, 'the first standing');
  assert.equal(crownRulerHere(people, 382), null);
  assert.equal(crownRulerHere(people, null), null);
});

test('CROWN-HALL the throne room\'s pieces (7.2): the two banners on the wall behind the ruler facing into the room, a pace and a half either side, the cloth\'s top under the ceiling; the roster board and the Stores chest on the floor a few paces in, one each side of the aisle, facing it - over a real collider (mutants: the nearest wall; the open side; the spread; the cloth off the wall; the facing; the spots)', () => {
  assert.deepEqual([CROWN_HALL_BANNER_SIDE_M, CROWN_HALL_BANNER_OUT_M, CROWN_HALL_BANNER_TOP_M, CROWN_HALL_WALL_M], [1.5, 0.15, 3.2, 6], 'a pace and a half either side; the street\'s gap off the wall');
  const c = throneRoom();
  const ray = (o, d, m) => c.raycast(o, d, m);
  const plan = crownHallPlan(RULER, ray);
  assert.ok(plan);
  near(plan.floor, 0, 'the floor under the ruler');
  assert.equal(plan.banners.length, 2);
  for (const b of plan.banners) {
    near(b.top[2], CROWN_HALL_BANNER_OUT_M, 'on the back wall, off it by the cloth\'s gap');
    near(b.top[1], CROWN_HALL_BANNER_TOP_M, 'the top under the ceiling');
    assert.deepEqual(b.out.map((v) => Math.round(v * 1e6) / 1e6 + 0), [0, 0, 1], 'facing into the room');
    assert.deepEqual(b.right.map((v) => Math.round(v * 1e6) / 1e6 + 0), [-1, 0, 0], 'its right from its face (AUDIT GUILD1d R4)');
  }
  assert.deepEqual(plan.banners.map((b) => Math.round(b.top[0] * 1e6) / 1e6).sort((a, b) => a - b), [10 - CROWN_HALL_BANNER_SIDE_M, 10 + CROWN_HALL_BANNER_SIDE_M]);
  const [fwd, lat] = CROWN_HALL_SPOTS[0];
  assert.equal(plan.board.model, CROWN_HALL_BOARD_MODEL);
  assert.equal(CROWN_HALL_BOARD_MODEL, BULLETIN_BOARD_MODEL_ID, 'Daggerfall\'s own board');
  assert.equal(plan.chest.model, CROWN_HALL_CHEST_MODEL);
  assert.equal(CROWN_HALL_CHEST_MODEL, 41811, 'Daggerfall\'s chest');
  near(plan.board.pos[0], 10 + lat, 'the board one side'); near(plan.board.pos[2], 1.5 + fwd, 'paces in'); near(plan.board.pos[1], 0, 'on the floor');
  near(plan.chest.pos[0], 10 - lat, 'the chest the other'); near(plan.chest.pos[2], 1.5 + fwd, 'paces in');
  near(plan.board.yawDeg, -90, 'facing the aisle');
  near(plan.chest.yawDeg, 90, 'facing the aisle');
});

test('CROWN-HALL where the room is not so: a low ceiling lowers the cloth and too low hangs none; a wall too far hangs none; a pillar in the way moves the board to the next spot; a step or a void under a spot stands none there; no floor under the ruler, nothing (mutants: the ceiling; the wall\'s reach; the line\'s clearance; the step; the floor)', () => {
  const plan = (o, at = RULER) => { const c = throneRoom(o); return crownHallPlan(at, (q, d, m) => c.raycast(q, d, m)); };
  const low = plan({ h: 2.9 });
  assert.equal(low.banners.length, 2);
  near(low.banners[0].top[1], 2.8, 'the top a hand under the ceiling');
  assert.equal(plan({ h: 2.7 }).banners.length, 0, 'no room for the cloth');
  assert.ok(2.6 - BANNER_H_M < 0);
  const far = plan({}, { ...RULER, z: CROWN_HALL_WALL_M + 1 });
  assert.equal(far.banners.length, 2, 'the nearest wall is a side one now - within reach');
  const wide = crownHallPlan(RULER, (o, d, m) => (d[1] === -1 ? o[1] : d[1] === 1 ? 4 : Math.min(m, CROWN_HALL_WALL_M + 0.5)));
  assert.deepEqual(wide.banners, [], 'every wall past CROWN_HALL_WALL_M: no banners');
  const open = crownHallPlan(RULER, (o, d, m) => (d[1] === -1 ? o[1] : Infinity));
  assert.deepEqual(open.banners, [], 'no wall at all: no banners');
  assert.ok(open.board, 'and the pieces still stand on the floor');
  const [fwd, lat] = CROWN_HALL_SPOTS[0];
  const blocked = plan({ pillar: [10 + lat - 0.3, 0, 1.5 + fwd - 0.3, 10 + lat + 0.3, 3, 1.5 + fwd + 0.3] });
  assert.ok(blocked.board, 'stood elsewhere');
  assert.notDeepEqual([blocked.board.pos[0], blocked.board.pos[2]], [10 + lat, 1.5 + fwd], 'not in the pillar');
  near(blocked.chest.pos[0], 10 - lat, 'the chest\'s side is clear');
  // a ray that finds a dais under every spot but the ruler's: no floor of the throne room's - none stands
  const dais = crownHallPlan(RULER, (o, d, m) => {
    if (d[1] !== -1) return Infinity;
    const onThrone = Math.hypot(o[0] - RULER.x, o[2] - RULER.z) < 0.5;
    return onThrone ? o[1] : o[1] - 1.5 <= m ? o[1] - 1.5 : Infinity;
  });
  assert.equal(dais.board, null, 'a step of more than CROWN_HALL_STEP_M under every spot');
  assert.equal(dais.chest, null);
  assert.equal(crownHallPlan(RULER, () => Infinity), null, 'no floor under the ruler');
  assert.equal(crownHallPlan(null, () => 1), null);
  assert.equal(crownHallPlan({ x: NaN, y: 0, z: 0 }, () => 1), null);
});

test('CROWN-HALL the words', () => {
  assert.equal(CROWN_HALL_TEXT.board, 'Roster board');
  assert.equal(CROWN_HALL_TEXT.chest, 'Stores chest');
  assert.equal(CROWN_HALL_TEXT.chestShut('The Silver Hand'), 'This chest is The Silver Hand\'s. Its Stores are for its members.');
});

test('CROWN-HALL the hosts by source: the throne room stood at the dungeon\'s mount about its ruler, kept only for the visit that asked, cleared at both teardowns; drawn on the dungeon\'s own pass before the flats, the banners through the street\'s cloth; its board and chest pressed open the guild\'s notes and Stores to the holder\'s members and say whose they are to anyone else; world.js names a held crown\'s guild, its member and its banner, and draws the cloth under the dungeon\'s light (mutants: the mount; the visit; a teardown; the draw; the board\'s member; the chest\'s member; the crown\'s tier; the banner)', () => {
  const m = src('src/scenes/worldModes.js');
  assert.match(m, /dungeonLoc = dfLocation;\n      host\.profDungeonEntered\?\.\(ctx\);[^\n]*\n      standCrownHall\(ctx, dfLocation\)\.catch\(\(\) => \{\}\);/);
  assert.match(m, /const ruler = crownRulerHere\(ctx\.people, crownRulerFactionId\(townTalk\?\.factionDict, loc\?\.regionIndex\)\);/);
  assert.match(m, /const plan = ruler \? crownHallPlan\(ruler, \(o, d, m\) => ctx\.collider\?\.raycast\?\.\(o, d, m\) \?\? Infinity\) : null;/);
  assert.match(m, /if \(dungeonCtx !== ctx \|\| dungeonLoc !== loc\) return;/);
  assert.match(m, /const crownHallLive = \(\) => \(crownHall && crownHall\.loc === dungeonLoc && crownHere\(\) \? crownHall : null\);/);
  assert.match(m, /dungeonLoc = null;\n    pendingDungeonWagonOpen = false;[^\n]*\n    crownHall = null;/);
  assert.match(m, /crownHall = null;[^\n]*\n        dungeonCtx\.destroy\(\); dungeonCtx = null; dungeonLoc = null;/);
  assert.match(m, /host\.drawModeMeshes\?\.\(\);[^\n]*\n      drawCrownHall\(\{ proj, view, eye: mwv\.eye \}\);/);
  assert.match(m, /for \(const p of h\.pieces\) renderer\.drawMesh\(p\.gpu, p\.matrix, null\);/);
  assert.match(m, /host\.drawDungeonBanners\?\.\(\{ \.\.\.frame, banners: h\.banners\.map\(\(b, i\) => \(\{ \.\.\.b, key: bannerKeyOf\(heraldry\), heraldry, phase: i \}\)\) \}\);/);
  assert.match(m, /ctx\.addActivationTargets\(\(\) => crownHallLive\(\)\?\.pieces\.map\(\(p\) => \(\{ key: p\.key, aabb: p\.aabb, distance: RAY_DISTANCE, reach: DEFAULT_ACTIVATION_DISTANCE \}\)\) \?\? NO_TARGETS\);/);
  assert.match(m, /if \(key\.startsWith\('crown:'\)\) \{ openCrownPiece\(key\); return true; \}/);
  const open = m.slice(m.indexOf('  function openCrownPiece(key) {'), m.indexOf('  /** DECOR1d: WHERE THE PLAYER MAY DECORATE'));
  assert.match(open, /if \(!c\.member\) \{ say\(hallBoardShutLine\(c\.name\)\); return; \}\n      if \(!host\.guildHall\?\.openBoard\?\.\(c\.name\)\) say\(HALL_BOARD_COLD\);/);
  assert.match(open, /if \(!c\.member\) \{ say\(CROWN_HALL_TEXT\.chestShut\(c\.name\)\); return; \}\n    openHallChest\(\);/);
  const w = src('src/scenes/world.js');
  const crown = w.slice(w.indexOf('      crown: (mapId) => {'), w.indexOf('    guildHall: {'));
  assert.match(crown, /const g = seat\?\.tier === 'crown' \? seat\.holder\?\.guild \?\? null : null;/);
  assert.match(crown, /member: seatHallOf\(seat, guildBook\?\.guild\?\.id \?\? null\), heraldry: seatBannerOf\(seat\)/);
  assert.match(w, /drawDungeonBanners: \(\{ banners, proj, view, eye \}\) => \{\n      if \(banners\?\.length && bannerPass\?\.draw\(banners, proj, view, new Float32Array\(eye\), performance\.now\(\) \/ 1000, \{/);
});
