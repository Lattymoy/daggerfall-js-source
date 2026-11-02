// FIELD BUGS 2026-10-14b DOOR-JAM (the Discord: "Multiple enemies cannot pass through a doorway at the same time
// because their hitboxes collide"; the screenshot a dungeon corridor's wooden door frame, several humanoid foes stood
// in it and none coming through). Not their hitboxes: a foe's capsule is its idle sprite's height (SetupDemoEnemy,
// characters/enemy/enemyAnchor.js), a humanoid's often taller than a doorway's lintel, and EnemyMotor.HeightAdjust - DFU's
// "temporarily reduce their height to 1.65, which should be short enough to fit through most if not all doorways" -
// was never ported. The obstacle probe stops under DOOR_CROUCHING_HEIGHT by design, so it saw no lintel and bought no
// detour; the capsule's head met the lintel every step; and every foe that followed stood in the same doorway beside
// it, the port's foes pushing apart only softly. Driven on the real motor over the real collider, the foes minted as
// the dungeon host mints them and stepped in its frame order. bible/01-Overview/bugs/Field-Bugs-2026-10-14b.md.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setPref } from '../../../src/systems/uiPrefs.js';
import { Collider, SIDE_CONTACT } from '../../../src/player/collider.js';
import { EnemyAI, DOOR_CROUCHING_HEIGHT, HEIGHT_CHANGE_SECONDS, foeFrameDt } from '../../../src/characters/enemy/enemyMotor.js';
import { enemyControllerHeight, idleSpriteHeight } from '../../../src/characters/enemy/enemyAnchor.js';
import { spaceFoes, spaceAcross, clearDoorways, doorSpotsNear, sweepHeight } from '../../../src/characters/foeSpacing.js';
import { setTacticsClock, resetTactics, noteLocalPlayer } from '../../../src/ai/tactics.js';
import { CAPSULE_HEIGHT } from '../../../src/player/motor.js';

const rd = (p) => readFileSync(new URL('../../../' + p, import.meta.url), 'utf8');
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const DT = 1 / 60;
let T = 0;
setTacticsClock(() => T);
/** A closed box, every face both ways - the collider reads a face either way. */
function box(c, key, min, max) {
  const [x0, y0, z0] = min, [x1, y1, z1] = max;
  const v = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]].flat();
  const idx = [];
  for (const [a, b, d, e] of [[0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7], [1, 5, 6, 2], [3, 2, 6, 7], [4, 5, 1, 0]]) idx.push(a, b, d, a, d, e, a, d, b, a, e, d);
  c.addMesh(key, new Float32Array(v), new Uint32Array(idx), I);
}
const floorOf = (c) => c.addMesh('floor', new Float32Array([-30, 0, -30, 30, 0, -30, 30, 0, 30, -30, 0, 30]), new Uint32Array([0, 1, 2, 0, 2, 3, 0, 2, 1, 0, 3, 2]), I);
/** The report's shape: a corridor (x < 0, 3 m wide) through a door frame in a wall at x = 0 onto a room - the opening
 *  1.4 m wide under a lintel at LINTEL, over the player's 1.8 m and under the humanoids' 2.1 m. */
const LINTEL = 2.0, OPEN = 1.4, WALL = 0.15;
function doorway() {
  const c = new Collider(() => -1000);
  floorOf(c);
  box(c, 'corridorN', [-30, 0, 1.5], [-WALL, 3, 1.7]);
  box(c, 'corridorS', [-30, 0, -1.7], [-WALL, 3, -1.5]);
  box(c, 'jambN', [-WALL, 0, OPEN / 2], [WALL, 3, 8]);
  box(c, 'jambS', [-WALL, 0, -8], [WALL, 3, -OPEN / 2]);
  box(c, 'lintel', [-WALL, LINTEL, -OPEN / 2], [WALL, 3, OPEN / 2]);
  return c;
}
/** A humanoid's idle record, 84 px tall at GlobalScale (2.1 m) - the producer's own law reads it. */
const HUMANOID = { getSize: () => ({ width: 50, height: 84 }), getScale: () => ({ width: 0, height: 0 }) };
/** A foe as dungeonContext.js stands one: the capsule off the idle sprite, the transform at its centre. */
function mint(c, at, tex = HUMANOID) {
  const idleH = idleSpriteHeight(tex);
  const ai = new EnemyAI(c, at, Math.PI / 2, { liveSpeed: 50, height: enemyControllerHeight(idleH, 'General'), centreOffset: idleH / 2, rolls: () => 0.25 });
  ai.detected = true; ai.inSight = true;
  return { ai, dead: false };
}
const senses = () => ({ gameMinutes: 0, playerStealth: 0, rolls: () => 0.5, playerHeight: CAPSULE_HEIGHT });
const through = (f) => f.ai.feet[0] > WALL + 0.36;

test('DOOR-JAM: three humanoids chasing the player through a door frame lower than they stand all come through it - on the classic lane and the Enhanced AI\'s, in the dungeon host\'s frame order', () => {
  // the premise: the lintel stops a 2.1 m capsule that does not duck, and lets the player's 1.8 m one walk on
  const premise = doorway();
  const tall = [-1.5, 0, 0], player = [-1.5, 0, 0];
  for (let i = 0; i < 120; i++) { premise.move(tall, 5 * DT, -0.1 * DT, 0, 2.1, true, true); premise.move(player, 5 * DT, -0.1 * DT, 0, CAPSULE_HEIGHT); }
  assert.ok(tall[0] < 0, `the lintel stops a body taller than the opening (${tall[0].toFixed(2)})`);
  assert.ok(player[0] > 5, 'the player walks on under it');
  for (const enhanced of [false, true]) {
    resetTactics(); T = 0; setPref('enhancedAI', enhanced);
    const c = doorway();
    const foes = [mint(c, [-3, 0, -0.6]), mint(c, [-4, 0, 0]), mint(c, [-5, 0, 0.6])];
    assert.ok(foes.every((f) => Math.abs(f.ai.height - 2.1) < 1e-9 && f.ai.height > LINTEL), 'each stands taller than the lintel');
    const me = [5, 0, 0];
    noteLocalPlayer(me, [-1, 0, 0]);
    const doors = doorSpotsNear([{ matrix: I, centre: { x: 0, y: 1, z: 0 }, normal: { x: 1, y: 0, z: 0 } }], me, 40);
    let crouched = 0;
    for (let k = 0; k < 12 * 60; k++) {
      T += DT;
      spaceFoes(foes, c, foeFrameDt(DT));
      clearDoorways(foes, doors, c, foeFrameDt(DT));
      for (const f of foes) { f.ai.update(foeFrameDt(DT), me, senses()); if (f.ai.controllerHeight < f.ai.height) crouched++; }
    }
    const lane = enhanced ? 'enhanced' : 'classic';
    assert.deepEqual(foes.map(through), [true, true, true], `${lane}: every one came through (${foes.map((f) => f.ai.feet.map((v) => v.toFixed(2)).join(',')).join(' | ')})`);
    assert.ok(crouched > 0, `${lane}: by ducking - HeightAdjust's crouch`);
    for (const f of foes) assert.equal(f.ai.height, 2.1, `${lane}: its own height is never what changes`);
  }
  setPref('enhancedAI', false);
});

test('DOOR-JAM: EnemyMotor.HeightAdjust, verbatim - a bump on the sides sweeps the controller at 1.65 for 0.5 s, then it stands back up; a body no taller than 1.65 never ducks', () => {
  assert.equal(DOOR_CROUCHING_HEIGHT, 1.65, 'EnemyMotor.cs:37 doorCrouchingHeight');
  assert.equal(HEIGHT_CHANGE_SECONDS, 0.5, ':1462 heightChangeTimer = 0.5f');
  const c = new Collider(() => 0);
  const ai = new EnemyAI(c, [0, 0, 0], 0, { height: 2.1 });
  assert.equal(ai.controllerHeight, 2.1, 'a fresh controller stands at its own height');
  ai._heightAdjust(DT);
  assert.equal(ai.controllerHeight, 2.1, 'nothing met, nothing changes');
  ai.collidedSides = true;
  ai._heightAdjust(DT);
  assert.equal(ai.controllerHeight, 1.65, 'CollidedSides: down to doorCrouchingHeight (:1452-1460)');
  ai.collidedSides = false;
  let calls = 1;
  while (ai.controllerHeight === 1.65 && calls < 100) { ai._heightAdjust(DT); calls++; }
  assert.ok(calls >= 30 && calls <= 32, `held for the half second, then restored (:1464-1477) - ${calls} fixed steps`);
  assert.equal(ai.controllerHeight, 2.1, 'back to originalHeight');
  assert.equal(ai.height, 2.1, 'originalHeight itself never moves');
  // the flags are the LAST Move's, kept (Unity keeps collisionFlags): one still bumping ducks again at once
  ai.collidedSides = true;
  ai._heightAdjust(DT);
  assert.equal(ai.controllerHeight, 1.65);
  // `originalHeight > doorCrouchingHeight` (:1452): a rat's 1.6 floor and a 1.65 body never change
  for (const h of [1.6, 1.65]) {
    const small = new EnemyAI(c, [0, 0, 0], 0, { height: h });
    small.collidedSides = true;
    for (let i = 0; i < 40; i++) small._heightAdjust(DT);
    assert.equal(small.controllerHeight, h, `${h} m: no crouch`);
  }
  // a puppet handed back stands afresh at its own height
  ai.resumeLive();
  assert.equal(ai.controllerHeight, 2.1);
  assert.equal(ai.collidedSides, false);
});

test('DOOR-JAM: the collider\'s move says when it met something on the body\'s sides (CollisionFlags.CollidedSides) - a wall, a lintel\'s edge; never open floor or a walkable ramp', () => {
  const walk = (c, feet, vx, vz, h = 2.1, n = 90) => {
    let velY = 0, sides = 0;
    for (let i = 0; i < n; i++) {
      velY -= 9.81 * DT;
      const r = c.move(feet, vx * DT, velY * DT, vz * DT, h, true, true);
      if (r.grounded) velY = 0;
      if (r.sides) sides++;
    }
    return sides;
  };
  const open = new Collider(() => -1000); floorOf(open);
  assert.equal(walk(open, [0, 0, 0], 5, 0), 0, 'open floor');
  const ramp = new Collider(() => -1000); floorOf(ramp);
  ramp.addMesh('ramp', new Float32Array([2, 0, -5, 12, 5.77, -5, 12, 5.77, 5, 2, 0, 5]), new Uint32Array([0, 1, 2, 0, 2, 3, 0, 2, 1, 0, 3, 2]), I);   // 30 degrees
  const up = [0, 0, 0];
  assert.equal(walk(ramp, up, 5, 0), 0, 'a walkable ramp is ridden, not met');
  assert.ok(up[1] > 2, 'and climbed');
  const wall = new Collider(() => -1000); floorOf(wall); box(wall, 'wall', [-30, 0, 1], [30, 3, 1.4]);
  assert.ok(walk(wall, [0, 0, 0], 0, 5) > 60, 'walked square into a wall');
  assert.ok(walk(wall, [0, 0, 0.6], 5, 0.8) > 60, 'slid along one');
  assert.equal(walk(wall, [0, 0, 0.5], 5, 0), 0, 'walked beside one without touching');
  assert.equal(walk(wall, [0, 0, 1 - 0.35 + SIDE_CONTACT / 2], 5, 0), 0, 'the resolve settling a body a hair off a wall it leans on is no bump');
  // a head under a lintel's edge, the report's own contact - every step that meets it, never the step ladder's "landing"
  const door = doorway(), head = [-1.5, 0, 0.4];
  let met = 0, steps = 0;
  for (let i = 0; i < 60; i++) {
    const was = head[0];
    const r = door.move(head, 5 * DT, -0.1 * DT, 0, 2.1, true, true);
    if (head[0] < was + 5 * DT * 0.5) { steps++; if (r.sides) met++; }
  }
  assert.ok(steps > 20 && met === steps, `every stopped step reports it (${met} of ${steps})`);
  assert.ok(SIDE_CONTACT > 0 && SIDE_CONTACT < 1e-3, 'a resting touch is not a bump');
});

test('DOOR-JAM: through the crouch the probes and aims read the foe\'s own height, as DFU\'s read originalHeight; every Move, and the pushes that keep foes apart, sweep the crouched controller', () => {
  const c = doorway();
  const ai = new EnemyAI(c, [-2, 0, 0], Math.PI / 2, { height: 2.1, centreOffset: 1.05 });
  const casts = [];
  const cast = c.capsuleCast.bind(c);
  c.capsuleCast = (p1, p2, r, d, dist) => { casts.push([p1[1], p2[1]]); return cast(p1, p2, r, d, dist); };
  ai._obstacleCheck([1, 0, 0]);
  const standing = casts.splice(0);
  ai.controllerHeight = DOOR_CROUCHING_HEIGHT;
  ai._obstacleCheck([1, 0, 0]);
  assert.deepEqual(casts, standing, 'ObstacleCheck casts from originalHeight (:1151-1152) whatever the controller');
  const heights = [];
  const move = c.move.bind(c);
  c.move = (feet, dx, dy, dz, h, ...rest) => { heights.push(h); return move(feet, dx, dy, dz, h, ...rest); };
  ai.detected = true; ai.inSight = true;
  ai._resetHeight = true; ai._heightChangeTimer = 10;   // held down for the look
  for (let i = 0; i < 30; i++) ai.update(DT, [6, 0, 0], senses());
  assert.ok(heights.length > 0 && heights.every((h) => h === DOOR_CROUCHING_HEIGHT), `every Move sweeps the crouch (${[...new Set(heights)]})`);
  // two crouched bodies overlapping under the lintel part along it and stay under it - a push at their full height
  // would sweep a 2.1 m capsule into the lintel
  const d2 = doorway();
  const a = { ai: { feet: [0, 0, -0.05], height: 2.1, controllerHeight: DOOR_CROUCHING_HEIGHT }, dead: false };
  const b = { ai: { feet: [0, 0, 0.05], height: 2.1, controllerHeight: DOOR_CROUCHING_HEIGHT }, dead: false };
  assert.equal(sweepHeight(a.ai), DOOR_CROUCHING_HEIGHT);
  assert.equal(sweepHeight({ height: 2.1 }), 2.1, 'a body with no motor sweeps its capsule');
  assert.equal(sweepHeight({}), CAPSULE_HEIGHT);
  for (let i = 0; i < 60; i++) spaceFoes([a, b], d2, DT);
  assert.ok(Math.abs(a.ai.feet[0]) < 1e-6 && Math.abs(b.ai.feet[0]) < 1e-6, `still under the lintel (${a.ai.feet[0].toFixed(3)}, ${b.ai.feet[0].toFixed(3)})`);
  assert.ok(b.ai.feet[2] - a.ai.feet[2] > 0.5, `apart along it (${(b.ai.feet[2] - a.ai.feet[2]).toFixed(3)})`);
  // ...and two of different pools (TACT3's spaceAcross - the watch and a building's foes), by the same push
  const d3 = doorway();
  const g = { ai: { feet: [0, 0, -0.05], height: 2.1, controllerHeight: DOOR_CROUCHING_HEIGHT }, dead: false };
  const h = { ai: { feet: [0, 0, 0.05], height: 2.1, controllerHeight: DOOR_CROUCHING_HEIGHT }, dead: false };
  for (let i = 0; i < 60; i++) spaceAcross([[g], [h]], d3, DT);
  assert.ok(Math.abs(g.ai.feet[0]) < 1e-6 && Math.abs(h.ai.feet[0]) < 1e-6 && h.ai.feet[2] - g.ai.feet[2] > 0.5, `across pools too (${g.ai.feet.map((v) => v.toFixed(3))} | ${h.ai.feet.map((v) => v.toFixed(3))})`);
});

test('DOOR-JAM by source: HeightAdjust runs after every fixed step\'s moves (FixedUpdate\'s last call), and every Move in both motors writes its CollidedSides', () => {
  const m = rd('src/characters/enemy/enemyMotor.js');
  assert.match(m, /this\._step\(FIXED_DT, playerFeet, senses, paralyzed, paused\);\n\s*this\._heightAdjust\(FIXED_DT\);/);
  for (const f of ['src/characters/enemy/enemyMotor.js', 'src/ai/enhancedMotor.js']) {
    const s = rd(f);
    const moves = [...s.matchAll(/const (\w+) = this\.collider\.move\(this\.feet,[^;]*\);[^\n]*\n\s*this\.isGrounded = \1\.grounded;[^\n]*\n\s*this\.collidedSides = !!\1\.sides;/g)].length;
    assert.equal(moves, [...s.matchAll(/this\.collider\.move\(this\.feet,/g)].length, `${f}: every Move keeps its CollidedSides`);
  }
});

// ── KEEP FULL HEIGHT (Mac, 2026-10-15) ──────────────────────────────
// "Keep full height": while a foe ducks, only its movement sweeps the duck. Projectiles, touch spells, its sight, a
// foe hunting it, the crosshair, the lock-on and the health bars keep its full height - DFU's own side effect of the
// duck ("projectiles will not collide with the top of the enemy", EnemyMotor.cs:1451) is not carried (Port-Ledger A).

/** A Mage-height foe, ducked under a doorway: its controller at the crouch, its body its own. */
function ducked(c = new Collider(() => 0), at = [0, 0, 0]) {
  const ai = new EnemyAI(c, at, Math.PI / 2, { height: 2.475, centreOffset: 1.2375 });
  ai.controllerHeight = DOOR_CROUCHING_HEIGHT; ai._resetHeight = true; ai._heightChangeTimer = 10;
  return { ai, dead: false };
}

test('KEEP FULL HEIGHT: a ducking foe is still hit, touched, aimed at, picked and sighted at its full height - and it sees from where it stands', async () => {
  const { missileHitsFoe, pickTouchTarget } = await import('../../../src/systems/spellcast.js');
  const { foeAabb } = await import('../../../src/player/activate.js');
  const { chestPoint, CHEST_FRACTION } = await import('../../../src/player/lockOn.js');
  const f = ducked();
  assert.equal(f.ai.controllerHeight, DOOR_CROUCHING_HEIGHT, 'it is ducking');
  assert.equal(missileHitsFoe([0, 2.2, 0], f), true, 'a missile at its head, over the crouch, hits it');
  const eye = [-2, 1.9, 0];
  assert.equal(pickTouchTarget(eye, [1, 0, 0], [f]), f, 'a touch at its head, over the crouch, finds it');
  assert.ok(Math.abs(foeAabb(f).max[1] - 2.475) < 1e-9, 'the crosshair meets its whole body');
  assert.ok(Math.abs(chestPoint(f)[1] - 2.475 * CHEST_FRACTION) < 1e-9, 'the lock-on holds its chest');
  // a foe hunting it aims by its full capsule (GetDestination's targetController.height)
  const hunter = new EnemyAI(new Collider(() => 0), [6, 0, 0], 0, { height: 2.1 });
  hunter._armedTargeting = true; hunter._targetCandidate = { ai: f.ai, isPlayer: false };
  assert.equal(hunter._targetHeight(), 2.475);
  // its eye: over a 1.6 m parapet halfway to the player it sees from its full height - a 1.65 body's eye does not
  const c = new Collider(() => 0);
  c.addMesh('wall', new Float32Array([3, 0, -5, 3, 0, 5, 3, 1.6, 5, 3, 1.6, -5]), new Uint32Array([0, 1, 2, 0, 2, 3, 0, 2, 1, 0, 3, 2]), I);
  const looker = ducked(c);
  looker.ai._senses([6, 0, 0], senses());
  assert.equal(looker.ai.inSight, true, 'the ducking foe sees over the parapet');
  const small = new EnemyAI(c, [0, 0, 0], Math.PI / 2, { height: DOOR_CROUCHING_HEIGHT, centreOffset: DOOR_CROUCHING_HEIGHT / 2 });
  small._senses([6, 0, 0], senses());
  assert.equal(small.inSight, false, 'the parapet hides the player from an eye at the crouch - the case is a real one');
});

test('KEEP FULL HEIGHT by source: the duck is read by movement alone - every `.controllerHeight` and every sweepHeight in src/ is a Move, a push or the duck\'s own bookkeeping', () => {
  const files = [];
  const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name.endsWith('.js')) files.push(p); } };
  const root = fileURLToPath(new URL('../../..', import.meta.url));
  walk(join(root, 'src'));
  const MOVE = /this\.collider\.move\(this\.feet,[^;]*, this\.controllerHeight[,)]/;
  const KEEP = /^\s*this\.controllerHeight = (?:height|DOOR_CROUCHING_HEIGHT|this\.height);/;
  const bad = [];
  let moves = 0, pushes = 0;
  for (const p of files) {
    const rel = relative(root, p).split(sep).join('/');
    readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
      const at = `${rel}:${i + 1}`;
      if (/\.controllerHeight\b/.test(line)) {
        if (MOVE.test(line)) moves++;
        else if (rel === 'src/characters/enemy/enemyMotor.js' && KEEP.test(line)) { /* the duck's own state */ }
        else if (rel === 'src/characters/foeSpacing.js' && /^export const sweepHeight = \(ai\) => ai\.controllerHeight \?\? ai\.height \?\? CAPSULE_HEIGHT;$/.test(line)) { /* the pushes' one door */ }
        else bad.push(`${at} ${line.trim()}`);
      }
      if (/\bsweepHeight\(/.test(line) && !/^export const sweepHeight/.test(line)) {
        if (rel === 'src/characters/foeSpacing.js' && (/collider\.move\(feet, px, 0, pz, sweepHeight\(ai\), !airborne\);/.test(line) || /h[ab] = sweepHeight\(/.test(line))) pushes++;
        else bad.push(`${at} ${line.trim()}`);
      }
    });
  }
  assert.deepEqual(bad, [], 'a reader of the duck that is not movement - Mac\'s call keeps the full height everywhere else');
  assert.equal(moves, 7, 'the seven Moves of both motors sweep it');
  assert.equal(pushes, 6, 'and the pushes: spaceFoes\' and spaceAcross\' overlaps, spaceFoes\' push, the nudge');
});

// ── on the player's own data ────────────────────────────────────────
const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(join(ARENA2, 'BLOCKS.BSA')) ? 'ARENA2_PATH not set or missing - real-data validation skipped' : false;
const transform = (m, x, y, z) => [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];

test('DOOR-JAM on the real dungeons: Mages - the capsule their own idle record mints - come through real doorways lower than they stand, three at a time', { skip: skipReal }, async () => {
  const { BlocksFile } = await import('../../../src/formats/blocksFile.js');
  const { Arch3dFile } = await import('../../../src/formats/arch3dFile.js');
  const { TextureFile } = await import('../../../src/formats/textureFile.js');
  const { dfMeshToModel } = await import('../../../src/world/meshReader.js');
  const { layoutRdbBlock } = await import('../../../src/world/rdbLayout.js');
  const { ENEMY_BASICS } = await import('../../../src/characters/enemy/enemyBasics.js');
  const { MOBILE_TYPES } = await import('../../../src/characters/mobile/mobileTypes.js');
  const bytes = (f) => new Uint8Array(readFileSync(join(ARENA2, f)));
  const fn = TextureFile.indexToFileName(ENEMY_BASICS[MOBILE_TYPES.Mage].maleTexture);
  const tex = new TextureFile();
  assert.ok(tex.load(bytes(fn), fn));
  const mage = enemyControllerHeight(idleSpriteHeight(tex), 'General');
  assert.ok(mage > 2.4, `a Mage stands ${mage} m`);
  const blocks = new BlocksFile(); blocks.load(bytes('BLOCKS.BSA'));
  const arch = new Arch3dFile(); arch.load(bytes('ARCH3D.BSA'));
  const models = new Map();
  const getModel = (id) => { if (!models.has(id)) { const i = arch.getRecordIndex(id); models.set(id, i === -1 ? null : dfMeshToModel(arch.getMesh(i), () => ({ width: 1, height: 1 }))); } return models.get(id); };
  const passed = [];
  for (let b = 0; b < blocks.count && passed.length < 6; b++) {
    if (!blocks.getBlockName(b)?.toUpperCase().endsWith('.RDB')) continue;
    const layout = layoutRdbBlock(blocks.getBlock(b), b, false, getModel);
    if (!layout.actionDoors?.length) continue;
    const c = new Collider(() => -Infinity);   // the block's models, its doors open (an open door stands clear of its opening)
    for (const p of layout.placements) { const m = getModel(p.modelIdNum); if (m) c.addMesh('dungeon', m.positions, m.indices, p.matrix); }
    for (const d of layout.actionDoors) {
      if (passed.length >= 6) break;
      const m = getModel(d.modelIdNum);
      if (!m) continue;
      const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
      for (let k = 0; k < m.positions.length; k += 3) { const v = transform(d.matrix, m.positions[k], m.positions[k + 1], m.positions[k + 2]); for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], v[a]); hi[a] = Math.max(hi[a], v[a]); } }
      const cx = (lo[0] + hi[0]) / 2, cz = (lo[2] + hi[2]) / 2, n = hi[0] - lo[0] < hi[2] - lo[2] ? [1, 0, 0] : [0, 0, 1];
      const mid = [cx, lo[1] + 1, cz];
      const down = c.raycast(mid, [0, -1, 0], 3), up = c.raycast(mid, [0, 1, 0], 6);
      if (!Number.isFinite(down) || !Number.isFinite(up)) continue;
      const floorY = mid[1] - down, opening = mid[1] + up - floorY;
      if (!(opening > CAPSULE_HEIGHT && opening < mage)) continue;   // a doorway the player walks through and a Mage stands taller than
      const at = (s) => [cx + n[0] * s, floorY, cz + n[2] * s];
      const level = (s) => { const p = at(s), dd = c.raycast([p[0], floorY + 1, p[2]], [0, -1, 0], 1.5); return Number.isFinite(dd) && Math.abs(1 - dd) < 0.05; };
      if ([1, -1].some((s) => Number.isFinite(c.raycast([cx, floorY + 1, cz], [n[0] * s, 0, n[2] * s], 6.5))) || ![-3, -4, -5, 5].every(level)) continue;   // a straight, level way through
      const foes = [-3, -4, -5].map((s) => mint(c, at(s), tex));
      for (const f of foes) f.ai.yaw = Math.atan2(n[0], n[2]);
      const me = at(5), spots = [{ pos: [cx, (lo[1] + hi[1]) / 2, cz], normal: n }];
      for (let k = 0; k < 12 * 60; k++) {
        spaceFoes(foes, c, foeFrameDt(DT));
        clearDoorways(foes, spots, c, foeFrameDt(DT));
        for (const f of foes) f.ai.update(foeFrameDt(DT), me, senses());
      }
      const came = foes.filter((f) => (f.ai.feet[0] - cx) * n[0] + (f.ai.feet[2] - cz) * n[2] > 0.5).length;
      passed.push(`${blocks.getBlockName(b)} ${d.modelIdNum} (${opening.toFixed(2)} m): ${came}`);
    }
  }
  assert.equal(passed.length, 6, 'six real doorways a Mage stands taller than');
  assert.ok(passed.every((p) => p.endsWith(': 3')), passed.join('; '));
});
