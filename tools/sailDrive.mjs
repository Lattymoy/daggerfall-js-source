#!/usr/bin/env node
// AUDIT HELM-SIGHT (bible/01-Overview/audits/Audit-Helm-Sight.md): a seeded random drive of the real Come Sail Away
// runtime (test/csaScene.mjs) - every state with her sails set and the player outdoors (FIELD BUGS 2026-10-29d: a wind of
// nought too) is sailed 12 s, and her sails must still drive her. FIELD BUGS 2026-10-27 found HELM-SIGHT with it.
//   node tools/sailDrive.mjs [--seed N] [--runs N] [--classic] [--lost]
// --lost adds NO-PIXEL's step, a boat left with no map pixel (off by default, so the audits' seeds replay their counts).
// A runtime call that throws is printed and the drive goes on, as world.js csaCall logs it. Exit 1 on any throw, and on a
// stop under the Responsive helm; the Classic helm stops by design (the record says where), so those are only listed.
import { scene } from '../test/csaScene.mjs';
import { BOAT_ACTIONS } from '../src/systems/comeSailAway/comeSailAwayActions.js';
import { WEATHER_TYPE } from '../src/systems/comeSailAway/comeSailAway.js';
import { isMain } from './lib/isMain.mjs';

const TS = 819.2;
const STEPS = 30;
const SAIL_S = 12;
/** Under this (m/s) her sails drive her toward nothing - asked of the way she is driven to, not the way she still carries. */
const DEAD_MPS = 0.3;
const OPS = [
  'helm',
  'W',
  'S',
  'end',
  'toggle',
  'leave',
  'leaveNow',
  'door',
  'hour',
  'weather',
  'saveload',
  'frames',
  'frames',
  'round',
  'shift',
  'fasttravel',
  'jump',
  'startload',
  'death',
  'place',
  'pixel',
  'reanchor',
  'partyLetGo',
];

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? Number(process.argv[i + 1]) : fallback;
};
/** mulberry32: one stream per seed, so a run is its seed. */
function stream(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One run of STEPS random steps; the first stop it meets, or null. Every throw is pushed onto `thrown`. */
export function driveOnce(rnd, { classic = false, lost = false, thrown = [] } = {}) {
  const pick = (list) => list[Math.floor(rnd() * list.length)];
  const ops_ = lost ? [...OPS, 'lostPixel'] : OPS;
  // AUDIT FB1029d C5: each runtime call caught on its own, as world.js csaCall wraps each - a restore that threw had skipped OnLoad
  const safe = (what, fn) => {
    try {
      fn();
    } catch (e) {
      thrown.push(`${what}: ${e.message}`);
      ops.push(`threw: ${e.message}`);
    }
  };
  const s = scene({
    float: Array.from({ length: 400 }, () => 1 + rnd()),
    int: Array.from({ length: 400 }, () => Math.floor(rnd() * 8) - 4),
  });
  s.deps.handling = () => (classic ? 'classic' : 'responsive');
  s.deps.items = {
    create: (templateIndex) => ({ templateIndex }),
    player: () => [],
    titles: () => [],
    addToPlayer: () => {},
  };
  const px = { X: 10, Y: 20 };
  s.deps.currentMapPixel = () => ({ ...px });
  const jump = (dx, dy) => {
    px.X += dx;
    px.Y += dy;
    s.rt.OnWorldReanchored([-dx * TS, 0, dy * TS]);
  }; // world.js: state.init's pixel, then the boats
  // a frame of a party's wait: world.js holds the mod's frame (`_partyArrivalPending`), and its Animators still step
  const heldFrame = () => {
    s.rt.endOfFrame();
    s.rt.fixedUpdate({ paused: true });
    s.rt.update({ paused: true });
    s.rt.lateUpdate({ paused: true });
  };
  const boats = [s.place(pick([1, 2, 3, 4]), 0)];
  const ops = [];
  for (let step = 0; step < STEPS; step++) {
    const op = pick(ops_);
    ops.push(op);
    safe(op, () => {
      const sailing = s.rt.isSailing();
      const live = boats.filter((b) => s.rt.AllBoats.includes(b) && b.GameObject.activeSelf); // a helm is taken by a ray on her: in sight
      switch (op) {
        case 'helm':
          if (!sailing && !s.world.inside && live.length) s.helm(pick(live));
          break;
        case 'W':
          if (sailing) s.frame({ press: ['MoveForwards'] });
          break;
        case 'S':
          if (sailing) s.frame({ press: ['MoveBackwards'] });
          break;
        case 'end':
          if (sailing) s.frame({ press: [BOAT_ACTIONS.toggleSail] });
          break;
        case 'toggle':
          if (sailing) s.rt.ToggleSails();
          break;
        case 'leave':
          if (sailing) s.rt.StopSailingDelayed();
          break;
        case 'leaveNow':
          if (sailing) s.rt.StopSailing();
          break;
        case 'door':
          if (!sailing) {
            s.world.inside = !s.world.inside;
            s.rt.OnTransition();
          }
          break;
        case 'hour':
          s.world.hour = (s.world.hour + 1) % 24;
          s.rt.OnNewHour();
          break;
        case 'weather':
          s.world.weather = pick(Object.values(WEATHER_TYPE));
          s.rt.OnWeatherChange(s.world.weather);
          break;
        case 'saveload': {
          const record = JSON.parse(JSON.stringify(s.rt.getSaveData()));
          safe('OnStartLoad', () => s.rt.OnStartLoad());
          if (rnd() < 0.5) s.world.inside = !s.world.inside;
          safe('restoreSaveData', () => s.rt.restoreSaveData(record));
          safe('OnLoad', () => s.rt.OnLoad());
          break;
        }
        case 'frames':
          for (let i = 0; i < 4; i++) s.frame();
          break;
        case 'round':
          s.rt.OnNewMagicRound();
          break;
        case 'shift':
          s.rt.OnPositionUpdate([pick([-TS, 0, TS]), 0, pick([-TS, 0, TS])]);
          break;
        case 'fasttravel':
          if (!s.world.inside) {
            s.rt.OnPreFastTravel();
            jump(pick([-30, 30]), 0);
            s.rt.OnPostFastTravel();
          }
          break;
        case 'jump':
          s.rt.OnPreJump();
          if (!s.world.inside) jump(pick([-3, 3]), 0);
          break;
        case 'startload':
          s.rt.OnStartLoad();
          break;
        case 'death':
          s.rt.OnPlayerDeath();
          break;
        case 'pixel':
          px.X += pick([-1, 1]);
          s.rt.OnPositionUpdate([0, 0, 0]);
          break;
        // a party's journey (world.js fastTravelTo): the jump made with the helm held, then back on a failed landing...
        case 'reanchor':
          if (!s.world.inside) {
            const d = pick([-30, -1, 1, 30]);
            jump(d, 0);
            heldFrame();
            heldFrame();
            jump(-d, 0);
          }
          break;
        // ...or let go from the landing once it is sure
        case 'partyLetGo':
          if (!s.world.inside && sailing) {
            jump(pick([-30, -1, 1, 30]), pick([-1, 0, 1]));
            heldFrame();
            s.rt.OnPreFastTravel();
          }
          break;
        case 'place':
          if (!sailing && !s.world.inside && boats.length < 3)
            boats.push(s.place(pick([1, 2, 3, 4]), 0, [100 + boats.length * 60, 34, 200]));
          break;
        case 'lostPixel':
          pick(boats).MapPixel = null;
          break; // NO-PIXEL: a boat of mine left with no map pixel
      }
    });
    s.frame();
    const st = s.rt.state;
    if (s.rt.isSailing() && st.sailPosition === 1 && !s.world.inside) {
      for (let t = 0; t < SAIL_S; t += 0.25) s.frame();
      const driven = Math.hypot(...(st.velocityTarget ?? [0, 0, 0]));
      if (!(driven > DEAD_MPS))
        return {
          hull: st.CurrentBoat.hull,
          ops,
          driven: +driven.toFixed(3),
          way: +(s.rt.helmPanelState()?.way ?? 0).toFixed(3),
          wind: st.windVectorCurrent.map((v) => +v.toFixed(3)),
        };
    }
  }
  return null;
}

if (isMain(import.meta.url)) {
  const seed = arg('--seed', 1),
    runs = arg('--runs', 300),
    classic = process.argv.includes('--classic');
  const rnd = stream(seed),
    lost = process.argv.includes('--lost');
  let stops = 0,
    throws = 0;
  for (let i = 0; i < runs; i++) {
    const thrown = [];
    const stop = driveOnce(rnd, { classic, lost, thrown });
    for (const t of thrown) console.log(JSON.stringify({ run: i, threw: t }));
    throws += thrown.length;
    if (stop) {
      stops++;
      console.log(JSON.stringify({ run: i, ...stop }));
    }
  }
  console.log(
    `${stops} of ${runs} runs (seed ${seed}, ${classic ? 'Classic' : 'Responsive'} helm${lost ? ', boats losing their pixel' : ''}) stopped dead under sail; ${throws} runtime calls threw`,
  );
  process.exitCode = throws || (stops && !classic) ? 1 : 0;
}
