// FIELD BUGS 2026-09-30 (FALL-KEPT) - the report "saves dont save player velocity": "you can negate all fall damage by
// saving while falling right before you hit ground. once you load your save, you will land safely. as your velocity
// will be reset". DFU's own behaviour - SerializablePlayer keeps the position, the yaw, the pitch and the crouch
// (:204-226) and LoadGame cancels the movement - and Mac, of the DFU-faithful field bugs: "Dont worry abour DFU."
//
// A DECLARED DEPARTURE. The save carries the fall in the pose (PlayerMotor.fallSnapshot): how far above the feet it
// began and the speed the body had. A load that lands the player where the save stood lands the fall with them
// (restoreFall, after the placement's spawn) - the street, the building re-entered, the dungeon's saved position; a
// load that lands anywhere else (the door's reposition, the start-marker warp) carries none. A save in the air is never
// refused: the quiet saves (the realm's checkpoint, the page-hide save, the exit autosave) would lose their progress,
// and online the exploit is the closed tab, whose save is that checkpoint. The re-skin hold keeps a fall across its
// re-anchor, so a rebuild in the frames after a load cannot wipe it.
//
// Every pin here runs the REAL PlayerMotor on a flat floor at y = 0, through the real snapshotPlayer/restorePlayer
// and a JSON round trip, with each host's composer and landing lifted from the live source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import * as MOTOR from '../src/player/motor.js';   // the namespace: FALL_CARRY_MAX is the fix's, so the file loads without it
import { Collider } from '../src/player/collider.js';
import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';
import { createBankAccounts, createHouses, SHIP_TYPES } from '../src/systems/banking.js';
import { MAX_TERRAIN_HEIGHT, STREAMING_TERRAIN_SCALE } from '../src/world/terrainSampler.js';

const { PlayerMotor, FALL_DAMAGE_THRESHOLD, FALL_HP_PER_METRE, GRAVITY } = MOTOR;
const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const W = rd('src/scenes/world.js');
const WM = rd('src/scenes/worldModes.js');
const DC = rd('src/scenes/dungeonContext.js');

// dialload.test.js's live-source runner: the text AS WRITTEN, run in a scope whose unknown names are inert stubs
function literalBody(text, opener) {
  const i = text.indexOf(opener);
  assert.ok(i >= 0, `could not find ${opener}`);
  const open = text.indexOf('{', i + opener.length);
  let depth = 0;
  for (let k = open; k < text.length; k++) {
    const c = text[k];
    if (c === '/' && text[k + 1] === '/') { k = text.indexOf('\n', k); continue; }
    if (c === '/' && text[k + 1] === '*') { k = text.indexOf('*/', k) + 1; continue; }
    if (c === '\'' || c === '"' || c === '`') {
      const q = c;
      for (k++; k < text.length; k++) { if (text[k] === '\\') k++; else if (text[k] === q) break; }
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return text.slice(open, k + 1);
  }
  throw new Error(`unbalanced literal after ${opener}`);
}
const STUB = new Proxy(function stub() {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => 'STUB' : STUB), apply: () => STUB });
// over `env` itself, so what the text assigns (`_seasonHoldKey = null`) is read back off it; `undefined` is a name too
const scopeOf = (env) => new Proxy(env, {
  has: () => true,
  get: (t, k) => (k === Symbol.unscopables || k === 'undefined' ? undefined : (k in t ? t[k] : STUB)),
});
// eslint-disable-next-line no-new-func
const run = (expr, env) => new Function('__scope', `with (__scope) { return (${expr}); }`)(scopeOf(env));
// eslint-disable-next-line no-new-func
const exec = (stmts, env) => new Function('__scope', `with (__scope) { ${stmts} }`)(scopeOf(env));
const between = (text, from, to) => {
  const a = text.indexOf(from);
  const b = text.indexOf(to, a);
  assert.ok(a >= 0 && b > a, `could not find ${from}`);
  return text.slice(a, b);
};

// ── the motor, the fall and its bill ────────────────────────────────────────────────────────────────────────────
const idle = { forward: 0, strafe: 0 };
const DT = 1 / 60;
/** PlayerHealth.ApplyPlayerFallDamage over the landed distance (shared.applyFallLanding's law) */
const hp = (d) => (d > FALL_DAMAGE_THRESHOLD ? Math.trunc(FALL_HP_PER_METRE * (d - FALL_DAMAGE_THRESHOLD)) : 0);
const motor = () => new PlayerMotor(new Collider(() => 0));
function motorAt(y) { const m = motor(); m.spawn(0, y, 0); return m; }
/** steps until `pred` holds; the steps it took */
function stepUntil(m, pred, input = idle) {
  for (let i = 0; i < 6000; i++) { if (pred(m)) return i; m.update(DT, input, 0, 0); }
  throw new Error('never');
}
/** steps to the landing: { d: the distance it billed (0: stood on the floor with none), steps } */
function land(m) {
  for (let i = 1; i < 6000; i++) {
    m.update(DT, idle, 0, 0);
    if (m.landedFallDistance) return { d: m.landedFallDistance, steps: i };
    if (m.grounded && !m.falling) return { d: 0, steps: i };
  }
  throw new Error('never landed');
}
const UNSAVED = land(motorAt(50));
/** the save point: in the air, the last step before the ground. A 50 m fall moves 0.73 m a step there, and the step
 *  after 1.23 m stands on the floor - that is the landing's own frame, pinned by itself below. */
const lastMetres = (b) => {
  if (b.pos[1] > 2) return false;
  assert.deepEqual([b.grounded, b.falling], [false, true], 'airborne at the save');
  return true;
};

// ── the envelope, as the slot and the realm hold it ─────────────────────────────────────────────────────────────
const character = () => ({ name: 'Gary', gender: 'male', careerIndex: 4, level: 3, reflexes: 2, health: 22, maxHealth: 400, magicka: 15, maxMagicka: 30,
  startingLevelUpSkillSum: 90, currentLevelUpSkillSum: 120, readyToLevelUp: false, pendingLevel: null, chargenDone: true,
  stats: { strength: 55, luck: 60 }, skills: [30, 28], skillUses: [100, 0], career: { name: 'Healer', hitPointsPerLevel: 8 },
  items: [], spells: [], activeEffects: [], bankAccounts: createBankAccounts(), houses: createHouses(62), ownedShip: SHIP_TYPES.None });
/** snapshotPlayer -> JSON (the slot's, the realm's checkpoint's) -> restorePlayer: the load's extras */
function roundTrip(opts) {
  const snap = JSON.parse(JSON.stringify(snapshotPlayer(character(), { classicMinutes: 0, ...opts })));
  return restorePlayer(character(), snap, new Map());
}

// world.js worldQuickSave's pose, as written
const WORLD_POSE = literalBody(W.slice(W.indexOf('pose: { yaw: cam.yaw, pitch: cam.pitch, crouching: !!player.crouching')), 'pose: ');
/** F9 above ground (the street or a building - one composer): the pose over the live motor, the feet's height beside it */
const saveWorld = (m) => roundTrip({ pose: run(WORLD_POSE, { cam: { yaw: 0.5, pitch: 0 }, player: m }), locationKey: 'world', world: { y: m.pos[1] } });
// worldQuickLoad's landing, as written: the building's re-entry, the door's reposition or the street
const LOAD = W.slice(W.indexOf('async function worldQuickLoad'), W.indexOf('function applyPose'));
const LANDING = between(LOAD, '        if (inside) {', '        // P2-slice (items-2): the teleport');
/** the world load's arms over `m` (the teleport's placements already made) */
function loadWorld(m, extras, { inside = false } = {}) {
  const said = [];
  const env = { inside, extras, walkMode: true, player: m, lx: 0, ly: extras.world.y, lz: 0, cam: {}, townTalk: { say: (t) => said.push(t) }, caravanDoorLanding: () => null };   // WAGONS2 (FINAL AUDIT): a building's door, no caravan's
  exec(LANDING, env);
  return said;
}

test('FALL-KEPT the report: a 50 m fall saved in the air two metres above the ground and loaded lands the whole 50 m - 225 HP, as it does unsaved - on a fresh page and over the live motor alike (mutants: the save forgets the fall; the street drops the fall; the restore not falling)', () => {
  assert.equal(hp(UNSAVED.d), 225, 'the fall unsaved');
  const m = motorAt(50);
  stepUntil(m, lastMetres);
  const extras = saveWorld(m);
  assert.ok(extras.pose.fall, 'the envelope carries the fall');
  const fresh = motor();   // the tab closed, the realm's checkpoint loaded by the next boot
  fresh.spawn(0, extras.world.y, 0);   // the load's teleport stands it first
  loadWorld(fresh, extras);
  const got = land(fresh);
  assert.ok(Math.abs(got.d - UNSAVED.d) < 1e-3, `the whole fall: ${got.d}`);
  assert.equal(hp(got.d), 225, 'before: 0 HP');
  loadWorld(m, extras);   // F11 over the same live motor
  assert.equal(hp(land(m).d), 225);
  // the realm's checkpoint is the envelope whole, so the online save (the 2-min checkpoint, the page-hide save, the
  // exit autosave) carries what the slot carries (AUDIT RESCUE-SAVE A1: the envelope spread whole, the spoils records its
  // pack holds named beside it - systems/realmSaves.js realmSaveWithHeld)
  assert.match(W, /realmSession\.checkpoint\(realmSaveWithHeld\(snap, holding\), realmSummaryOf\(playerEntity\)\)/);
});

test('FALL-KEPT the building: a save inside re-entered lands the fall; the door\'s reposition, no saved place, lands none (mutants: the building drops the fall; the reposition keeps the fall)', () => {
  const m = motorAt(50);
  stepUntil(m, lastMetres);
  const extras = saveWorld(m);
  extras.interior = { door: {} };   // an inside save
  const inside = motor();
  inside.spawn(0, extras.world.y, 0);   // enterInteriorCore lands the saved position raw (worldModes.js: player.spawn at restore.pos)
  loadWorld(inside, extras, { inside: true });
  assert.equal(hp(land(inside).d), 225, 'the building re-entered: the whole fall');
  const out = motor();
  out.spawn(0, 0, 0);   // no door found: the teleport's default landing stands
  assert.deepEqual(loadWorld(out, extras, { inside: false }), ['Building has no exterior doors. Repositioning player.']);
  assert.deepEqual([out.falling, land(out).d], [false, 0], 'repositioned: no fall carried to a place the save never stood');
});

// the dungeon: worldModes' read, the context's composer, restoreSaved and the host's load law, as written
const MODES_READ = /read: (\(\) => \(\{ yaw: cam\.yaw, pitch: cam\.pitch, crouching: !!player\.crouching[^\n]*?\}\)),/.exec(WM)?.[1];
const CTX_POSE = literalBody(DC.slice(DC.indexOf('pose: { ...(opts.pose?.read?.() ?? {})')), 'pose: ');
const RESTORE = 'restoreSaved(extras, setPlayerPos, { session = true, announce = session } = {}) ';
const restoreSavedOf = (env) => run(`function ${RESTORE}${literalBody(DC, RESTORE)}`, env);
function saveDungeon(m) {
  const read = run(MODES_READ, { cam: { yaw: 1, pitch: 0 }, player: m });
  return roundTrip({ position: [m.pos[0], m.pos[1], m.pos[2]], pose: run(CTX_POSE, { opts: { pose: { read } } }), locationKey: 'dungeon:7' });
}
function loadDungeon(m, extras, { warp = false } = {}) {
  const law = run(/^\s*const placeLoadedPlayer = (.*);$/m.exec(WM)[1], { player: m });
  const restoreSaved = restoreSavedOf({ opts: { pose: { apply: () => {} } }, _locationKey: 'dungeon:7', needsStartWarp: () => warp });
  restoreSaved.call({ startSpawn: () => [0, 0, 0] }, extras, law, { session: false });
}

test('FALL-KEPT the dungeon: the host\'s pose read carries the fall and the context lands it with the saved position; the other layout\'s start-marker warp lands none (mutants: the dungeon save forgets the fall; the context drops the fall; the host law drops the fall; the warp keeps the fall)', () => {
  assert.ok(MODES_READ, 'the mode machine\'s pose read');
  const m = motorAt(50);
  stepUntil(m, lastMetres);
  const extras = saveDungeon(m);
  assert.ok(extras.pose.fall, 'the dungeon envelope carries the fall');
  const next = motor();
  loadDungeon(next, extras);
  assert.ok(Math.abs(next.pos[1] - extras.position[1]) < 1e-6, 'placed at the saved position');
  assert.equal(hp(land(next).d), 225, 'the whole fall');
  const warped = motor();
  loadDungeon(warped, extras, { warp: true });
  assert.deepEqual([warped.pos[1], warped.falling], [0, false], 'moved to the dungeon start');
  assert.equal(land(warped).d, 0, 'no fall at the start marker');
});

test('FALL-KEPT the landing\'s own frame: a save between the step that touched down and the step that bills it still bills the fall (mutant: a grounded body carries no fall)', () => {
  const m = motorAt(50);
  stepUntil(m, (b) => b.grounded && b.falling);
  const extras = saveWorld(m);
  const next = motor();
  next.spawn(0, extras.world.y, 0);
  loadWorld(next, extras);
  assert.equal(hp(land(next).d), 225);
});

test('FALL-KEPT the velocity: the loaded body falls on at the saved speed and lands when the unsaved one does; a jump saved on its rise lands the fall from its takeoff, not from the save (mutants: the velocity reset; the rise carried from the save)', () => {
  const m = motorAt(50);
  const atSave = stepUntil(m, lastMetres);
  const velY = m.velY;
  const extras = saveWorld(m);
  assert.equal(extras.pose.fall.velY, velY);
  const next = motor();
  next.spawn(0, extras.world.y, 0);
  loadWorld(next, extras);
  assert.equal(next.velY, velY, 'the speed carried');
  const got = land(next);
  assert.ok(Math.abs(atSave + got.steps - UNSAVED.steps) <= 1, `lands on the unsaved fall's step (${atSave + got.steps} vs ${UNSAVED.steps})`);
  // a jump on the ground, saved as it rises
  const jump = () => { const b = motorAt(0); stepUntil(b, (x) => x.groundedTime >= 0.2); b.update(DT, { ...idle, jump: true }, 0, 0); return b; };
  const plain = land(jump()).d;
  const j = jump();
  stepUntil(j, (b) => b.pos[1] >= 0.3);
  assert.ok(j.velY > 0, 'rising');
  const jx = saveWorld(j);
  const after = motor();
  after.spawn(0, jx.world.y, 0);
  loadWorld(after, jx);
  assert.ok(after.velY > 0, 'still rising once loaded');
  assert.ok(Math.abs(land(after).d - plain) < 1e-4, `the takeoff's fall, ${plain}`);
});

test('FALL-KEPT a torn or absent fall restores as a save always has - no fall, the spawn\'s state standing; an old save without the field lands 0 HP as before (mutants: a torn number restores a fall; a torn speed restored)', () => {
  for (const torn of [undefined, null, 7, 'x', {}, { above: 'x' }, { above: '12' }, { above: NaN }, { above: Infinity }, { above: null, velY: -5 }]) {
    const m = motorAt(3);
    m.restoreFall(torn);
    assert.deepEqual([m.falling, m.fallStart, m.velY], [false, 3, 0], `torn ${JSON.stringify(torn)}`);
  }
  const m = motorAt(50);
  stepUntil(m, lastMetres);
  const extras = saveWorld(m);
  delete extras.pose.fall;   // a save from before FALL-KEPT
  const next = motor();
  next.spawn(0, extras.world.y, 0);
  loadWorld(next, extras);
  assert.equal(hp(land(next).d), 0);
  // a sound height with a torn speed: the fall, from rest
  const v = motorAt(3);
  v.restoreFall({ above: 2, velY: 'fast' });
  assert.deepEqual([v.falling, v.fallStart, v.velY], [true, 5, 0], 'a fall with a torn speed falls from rest');
});

test('FALL-KEPT the bound: a fall carried is at most the world\'s tallest drop - terrainData.size.y, MaxTerrainHeight at the game\'s TerrainScale - at no more than that drop\'s speed from rest (mutants: the height unbounded; the speed unbounded; the bound not the world\'s)', () => {
  assert.equal(MOTOR.FALL_CARRY_MAX, MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE);
  assert.equal(MOTOR.FALL_CARRY_MAX, 1923.75);
  assert.equal(MOTOR.FALL_CARRY_MAX_SPEED, Math.sqrt(2 * GRAVITY * MOTOR.FALL_CARRY_MAX));
  const m = motorAt(3);
  m.restoreFall({ above: 1e300, velY: -1e300 });
  assert.deepEqual([m.falling, m.fallStart - 3, m.velY], [true, MOTOR.FALL_CARRY_MAX, -MOTOR.FALL_CARRY_MAX_SPEED]);
  const up = motorAt(3);
  up.restoreFall({ above: -1e300, velY: 1e300 });
  assert.deepEqual([up.fallStart - 3, up.velY], [-MOTOR.FALL_CARRY_MAX, MOTOR.FALL_CARRY_MAX_SPEED]);
  const d = land(m).d;
  assert.ok(d > MOTOR.FALL_CARRY_MAX && d <= MOTOR.FALL_CARRY_MAX + 3 + 1e-3, `billed the bound and the 3 m under it: ${d}`);
});

test('FALL-KEPT the re-skin hold: a rebuild of the pixel under a falling player (the season\'s flip, the roads\' or a late region\'s sweep - any in the frames after a load) keeps the fall across its re-anchor (mutant: the hold drops the fall)', () => {
  const RELEASE = 'if (_seasonHoldKey !== null && (built.has(_seasonHoldKey) || (!building && !queue.length))) ';
  const block = RELEASE + literalBody(W, RELEASE);
  const m = motorAt(50);
  stepUntil(m, (b) => b.pos[1] <= 30);
  const env = { _seasonHoldKey: '4,5', built: new Set(), building: true, queue: [{}], player: m };
  exec(block, env);
  assert.equal(env._seasonHoldKey, '4,5', 'held while the pixel builds');
  for (let i = 0; i < 20; i++) m.holdFrame();   // the frame loop holds the motor
  env.built.add('4,5');
  exec(block, env);
  assert.equal(env._seasonHoldKey, null, 'released once it stands');
  assert.equal(hp(land(m).d), 225, 'the whole fall - before: 123 HP, the drop under the hold alone');
});
