// BUG-G1 (2026-09-21, SquidKam on Discord: "Guards kill the framerate too /
// I think thats a sound issue right? cause the guards have some null
// sounds"). WHAT A WATCHMAN COSTS PER FRAME, measured rather than guessed.
//
// The sound path was read first and is cheap by construction: a missing
// DAGGER.SND record is cached as null once (audio.js _buffer) and the attract
// cadence fires every 3-9 s per guard. So this stands the REST of a
// watchman's frame on a table - the real EnemyAI over the real Collider
// holding a synthetic town (a grid of building boxes on a flat ground), the
// target machine with a candidate list, the sound source's clock - for FIVE
// guards (MAX_ACTIVE_GUARD_SPAWNS) chasing a player who walks a circle, and
// counts what the collider is asked per frame and how long a frame takes.
//
//   node tools/guardCostProbe.mjs            5 guards, 600 frames
//   node tools/guardCostProbe.mjs 5 600 12   guards, frames, town side (buildings per row)
//   node --cpu-prof tools/guardCostProbe.mjs  then read the .cpuprofile
import { Collider } from '../src/player/collider.js';
import { EnemyAI } from '../src/characters/enemyMotor.js';
import { EnemySoundSource } from '../src/characters/enemySounds.js';
import { runTargetMachine } from '../src/characters/enemyTargets.js';
import { tickEnemySound } from '../src/scenes/hostCombat.js';
import { sensesContext } from '../src/scenes/shared.js';
import { KNIGHT_CITY_WATCH } from '../src/characters/mobileTypes.js';

const N = +(process.argv[2] ?? 5), FRAMES = +(process.argv[3] ?? 600), SIDE = +(process.argv[4] ?? 12);
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

/** A closed box as 12 triangles, CCW outward. */
function box(x0, y0, z0, x1, y1, z1) {
  const P = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
  const F = [[0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7], [1, 5, 6, 2], [3, 2, 6, 7], [4, 5, 1, 0]];
  const pos = [], idx = [];
  for (const f of F) {
    const b = pos.length / 3;
    for (const v of f) pos.push(...P[v]);
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  return { pos: new Float32Array(pos), idx: new Uint16Array(idx) };
}

// THE TOWN: SIDE x SIDE buildings, 10 wide, 8 tall, on 16-unit streets, one
// bucket per building (the streaming world keys a bucket per block; per
// building is the harsher case for the ray's broad phase).
const collider = new Collider(() => 0);
let tris = 0;
for (let i = 0; i < SIDE; i++) for (let j = 0; j < SIDE; j++) {
  const x = (i - SIDE / 2) * 16, z = (j - SIDE / 2) * 16;
  const b = box(x, 0, z, x + 10, 8, z + 10);
  collider.addMesh(`b${i}_${j}`, b.pos, b.idx, I);
  tris += b.idx.length / 3;
}

// COUNT what the collider is asked.
const counts = {};
for (const m of ['raycast', 'raycastHit', 'sphereOverlaps', 'capsuleCast', 'sphereCast', 'move', 'heightAt', 'groundNormal', 'surfaceHit', '_moveStep', '_resolveCapsule', '_resolveSphere', 'penetrationAt', 'findClearFloor']) {
  if (typeof collider[m] !== 'function') continue;
  const f = collider[m].bind(collider);
  collider[m] = (...a) => { counts[m] = (counts[m] ?? 0) + 1; return f(...a); };
}

const playerEntity = { level: 5, career: {}, stats: {}, skills: {}, activeEffects: [], items: [] };
const guards = [];
for (let k = 0; k < N; k++) {
  const a = (k / N) * Math.PI * 2;
  const feet = [Math.cos(a) * 20 + 5, 0, Math.sin(a) * 20 + 5];   // on the streets, around the player
  const ai = new EnemyAI(collider, feet, -a, { liveSpeed: () => 50, height: 1.8, centreOffset: 0.9, playerInside: false, hasBowAttack: false, canCastRangedSpell: () => false, hasMagickaToCast: () => false });
  ai.makeHostileToPlayer(600, [5, 0, 5]);
  guards.push({ ai, entity: { health: 40, maxHealth: 40, activeEffects: [] }, dead: false, sounds: new EnemySoundSource(KNIGHT_CITY_WATCH, Math.random), mobileType: KNIGHT_CITY_WATCH });
}
const candidates = () => guards.filter((g) => !g.dead);

const dt = 1 / 60;
let t = 0;
const frameMs = [];
const t0 = performance.now();
for (let f = 0; f < FRAMES; f++) {
  t += dt;
  const playerFeet = [5 + Math.cos(t * 0.5) * 12, 0, 5 + Math.sin(t * 0.5) * 12];   // a walk round the block
  const s0 = performance.now();
  const senses = sensesContext(playerEntity, t / 60, { candidates, playerEntity, playerHeight: 1.8 });
  for (const g of guards) {
    const armed = { ...senses, targeting: (ai, pf, cdt) => runTargetMachine(g, senses.candidates(), pf, cdt, { playerEntity, playerHeight: 1.8 }) };
    g.ai.update(dt, playerFeet, armed, false);
    tickEnemySound(g.sounds, g.ai.feet, playerFeet, dt, { audio: null, collider, hearing: 1 });
  }
  frameMs.push(performance.now() - s0);
}
const total = performance.now() - t0;
frameMs.sort((a, b) => a - b);
const pct = (p) => frameMs[Math.min(frameMs.length - 1, Math.floor(frameMs.length * p))].toFixed(3);
console.log(`town: ${SIDE * SIDE} buildings, ${tris} tris in ${SIDE * SIDE} buckets; ${N} guards, ${FRAMES} frames`);
console.log(`frame ms: median ${pct(0.5)}  p90 ${pct(0.9)}  p99 ${pct(0.99)}  max ${frameMs[frameMs.length - 1].toFixed(3)}  mean ${(total / FRAMES).toFixed(3)}`);
console.log('collider calls per frame:', Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, (v / FRAMES).toFixed(1)])));
console.log('guards ended at', guards.map((g) => g.ai.feet.map((v) => v.toFixed(1)).join(',')).join(' | '), 'targets', guards.map((g) => (g.ai.target ? 'set' : 'none')).join(','));
