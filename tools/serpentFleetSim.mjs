#!/usr/bin/env node
// AUDIT SHIPS (2026-10-06, Mac: "Audit everything", of PR #634's SAIL-FREE + SERPENT3): THE SERPENT'S FIGHT, SIMULATED
// AGAINST THE RELAY'S OWN BRAIN - a fleet of galleons circling its waters and firing, every attack word judged on each
// ship by the struck machine's own law (systems/serpentStrike.js shapeMeets and shipHurt, the coil held, gripped and
// crushed or broken, a wreck retiring her share), the pair's share read off the brain's own count as a client reads it.
// SERPENT3's balance figures (bible/11-Multiplayer/Sea-Serpent.md sections 5 and 15) were measured with a scratch copy of
// this harness that never reached the tree, at 8 and 13 m/s - below the ways SAIL-FREE gives a ship circling under full
// sail (0.819 of her best: a galleon 13.3 m/s at the rated wind and 17.7 at 2 m/s, a Carrack 15.9 and 21.2), where its
// lone galleon won (AUDIT SHIPS A1). The harness is the tree's now, so every figure the record quotes is a command away.
//
//   node tools/serpentFleetSim.mjs --ships 2 --hit 0.38 --v 15.9 --seeds 12
//   node tools/serpentFleetSim.mjs --ships 1 --hit 0.5 --v 17.7 --lone-eased        # a lone ship given the pair's share
//   node tools/serpentFleetSim.mjs --ships 2 --hit 0.38 --v 13.3 --no-share          # the pair without it
//   node tools/serpentFleetSim.mjs --grid                                             # the record's table
//   node tools/serpentFleetSim.mjs --root ../other-tree ...                           # another tree's brain (a base)
//
// `--hit` is the share of a ship's reference broadside that strikes (the audit's measured gunnery is 0.38); `--v` the
// way she circles at (m/s), slowed as her canvas is torn. Each fight is seeded, so a run is the same run every time.
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { isMain } from './lib/isMain.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
/** The waters' clock: a fight is stepped 50 ms at a time, the brain beat every SERPENT_TICK_MS, the guns every 500 ms. */
const STEP_MS = 50;
/** The galleon's whole (navalShips.js HULL_BUILDS - the Small Ship), her length and beam, as the strike tests her. */
export const GALLEON = Object.freeze({ maxHull: 672, maxSail: 256, hl: 20.9, hw: 5.86, hull: 2 });
const POSE_TS_MOD = 2 ** 24;
const mulberry = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

/** The laws a run reads - this tree's, or `root`'s. */
export async function lawsOf(root = ROOT) {
  const at = (p) => pathToFileURL(join(resolve(root), p)).href;
  return { B: await import(at('src/net/serpentBrain.js')), S: await import(at('src/systems/serpentStrike.js')) };
}

/**
 * ONE FLEET'S FIGHTS. `ships` galleons circling at `v` m/s on rounds 140-300 m about its waters' heart (every other one
 * the other way), each firing `hit` of her reference broadside every half second while any of it shows within reach -
 * the coil while one holds, else its body (a seventh of the blows at its head). `share` 'law' takes the pair's share as
 * the client does (fleetShare of the brain's count), 'none' takes every blow whole, 'lone' gives a lone ship the pair's
 * share as well. Answers the wins, the minutes each kill took, the wrecks and what each attack did.
 */
export function fleetFights(laws, { ships = 2, hit = 0.38, v = 13.3, seeds = 12, share = 'law' } = {}) {
  const { B, S } = laws;
  const T = B.SERPENT_ATTACK_TABLE, REF = B.SHIP_REF[GALLEON.hull];
  const k = (n) => (share === 'none' ? 1 : share === 'lone' && n === 1 ? S.SERPENT_PAIR_SHARE ?? 1 : typeof S.fleetShare === 'function' ? S.fleetShare(n) : 1);
  const out = { ships, hit, v, seeds, wins: 0, minutes: [], wrecks: 0, taken: [], byKind: {}, begun: {} };
  for (let seed = 1; seed <= seeds; seed++) {
    const rng = mulberry(seed * 7919 + ships), srng = mulberry(seed * 104729);
    const t0 = 1_000_000, sound = t0 + 25 * 60_000;
    const f = B.newSerpentFight(1, t0, sound, 'sethrakul', 0, 0, rng() * 6.28);
    const fleet = Array.from({ length: ships }, (_, i) => ({ sub: `s${i}`, a: (i / ships) * 6.28 + srng(), r: 140 + srng() * 160, dir: i % 2 ? 1 : -1, hull: GALLEON.maxHull, sail: GALLEON.maxSail, wreck: false, held: null, grip: { hull: 0, crew: 0 }, took: 0 }));
    for (const s of fleet) B.joinSerpentFight(f, s.sub, s.sub, 30, GALLEON.hull, t0, true, null, true);
    const pos = (s) => ({ x: Math.sin(s.a) * s.r, z: Math.cos(s.a) * s.r, yw: s.a + (s.dir > 0 ? Math.PI / 2 : -Math.PI / 2) });
    const foot = (s) => { const p = s.held ?? pos(s); return { x: p.x, z: p.z, yw: p.yw, hl: GALLEON.hl, hw: GALLEON.hw }; };
    let tNow = t0;
    const hurt = (s, h, kind) => {
      if (s.wreck) return;
      const n = Math.round(h.hull ?? 0);
      out.byKind[kind] = (out.byKind[kind] ?? 0) + n;
      s.hull -= n; s.sail = Math.max(0, s.sail - Math.round(h.sail ?? 0)); s.took += n;
      if (s.hull <= 0) { s.wreck = true; s.held = null; B.serpentWreck(f, s.sub, 1, tNow); }
    };
    const whole = { maxHull: GALLEON.maxHull, maxSail: GALLEON.maxSail };
    const pend = new Map();
    let lastHit = t0;
    const words = (ws) => {
      for (const w of ws) {
        if (w.k === 'atk') { pend.set(w.i, { ...w, done: false }); const key = B.SERPENT_ATTACK_BY_ID[w.a].key; out.begun[key] = (out.begun[key] ?? 0) + 1; }
        if (w.k === 'cb' || w.k === 'cr' || w.k === 'cx') for (const s of fleet) if (s.held && s.held.i === w.i) { if (w.k === 'cr') hurt(s, S.crushHurt(whole, k(f.ships ?? ships)), 'crush'); s.held = null; }
      }
    };
    for (let t = t0; t < sound && !f.fell; t += STEP_MS) {
      tNow = t;
      for (const s of fleet) if (!s.wreck && !s.held) s.a += (s.dir * v * (0.35 + 0.65 * s.sail / GALLEON.maxSail) * (STEP_MS / 1000)) / s.r;
      // the brain's beat, every ship's pose at it with its own send time (net/wire.js POSE_TS_MOD)
      if ((t - t0) % B.SERPENT_TICK_MS === 0) words(B.stepSerpentBrain(f, t, fleet.map((s) => ({ sub: s.sub, ...foot(s), dead: false, ts: t % POSE_TS_MOD })), rng));
      // the landings, judged on each ship's own machine
      for (const a of pend.values()) {
        const A = B.SERPENT_ATTACK_BY_ID[a.a];
        if (a.done || t < a.at) continue;
        if (A === T.ram) {
          for (const s of fleet) if (!s.wreck && !a[s.sub] && S.shapeMeets(a, foot(s), t)) { a[s.sub] = 1; hurt(s, S.shipHurt(A, whole, k(f.ships ?? ships)), A.key); }
          if (t > a.at + A.active) a.done = true;
          continue;
        }
        a.done = true;
        if (A === T.coil) {
          const s = fleet.find((q) => q.sub === a.s);
          if (s && !s.wreck) {
            if (S.shapeMeets(a, foot(s), a.at)) { const p = foot(s); s.held = { i: a.i, ...pos(s) }; words(B.coilWord(f, s.sub, 'held', a.i, p.x, p.z, t)); }
            else words(B.coilWord(f, s.sub, 'esc', a.i, 0, 0, t));
          }
          continue;
        }
        if (A.hull + A.base <= 0) continue;
        for (const s of fleet) if (!s.wreck && S.shapeMeets(a, foot(s), a.at)) hurt(s, S.shipHurt(A, whole, k(f.ships ?? ships)), A.key);
      }
      for (const [i, a] of pend) if (a.done && t > a.at + 10_000) pend.delete(i);
      // the grip, each second
      if ((t - t0) % 1000 === 0) for (const s of fleet) if (s.held && !s.wreck) { const g = S.gripHurt(whole, 1, s.grip, k(f.ships ?? ships)); s.grip = g.carry; hurt(s, g.hurt, 'grip'); }
      // the guns: every 500 ms
      if (t - lastHit >= 500) {
        lastHit = t;
        const coil = B.coilHolds(f, t);
        for (const s of fleet) {
          if (s.wreck) continue;
          const z = coil ? B.ZONES.coil : rng() < 0.15 ? B.ZONES.head : B.ZONES.body;
          words(B.applySerpentHit(f, s.sub, REF * hit * 0.5, z, foot(s), t));
        }
      }
    }
    if (f.fell) { out.wins++; out.minutes.push((f.fell.at - t0) / 60000); }
    for (const s of fleet) { if (s.wreck) out.wrecks++; out.taken.push(s.took); }
  }
  return out;
}

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
export const fightLine = (r) => `ships ${r.ships} hit ${r.hit} v ${r.v}: wins ${r.wins}/${r.seeds}, mean ${mean(r.minutes).toFixed(1)} min, wrecks ${(r.wrecks / r.seeds).toFixed(2)}/fight, hull taken/ship ${mean(r.taken).toFixed(0)} of ${GALLEON.maxHull}`;

/** The record's grid: the ways SAIL-FREE gives a circling galleon and Carrack at the rated wind and at 2 m/s, and the
 *  old 8 m/s; the measured gunnery and a quarter either side; one, two, three and five ships. */
export const GRID = Object.freeze({ v: [8, 13.3, 15.9, 17.7, 21.2, 26.5, 31.8], hit: [0.25, 0.38, 0.5], ships: [1, 2, 3, 5] });

async function main(argv) {
  const arg = (name, d) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : d; };
  const laws = await lawsOf(arg('root', ROOT));
  const seeds = Number(arg('seeds', 12));
  if (argv.includes('--grid')) {
    for (const v of GRID.v) for (const hit of GRID.hit) for (const ships of GRID.ships) console.log(fightLine(fleetFights(laws, { ships, hit, v, seeds })));
    return 0;
  }
  const share = argv.includes('--no-share') ? 'none' : argv.includes('--lone-eased') ? 'lone' : 'law';
  const r = fleetFights(laws, { ships: Number(arg('ships', 2)), hit: Number(arg('hit', 0.38)), v: Number(arg('v', 13.3)), seeds, share });
  console.log(fightLine(r));
  console.log('   hull by kind / fight:', Object.entries(r.byKind).map(([kk, x]) => `${kk} ${(x / seeds).toFixed(0)}`).join(', '), '| begun / fight:', Object.entries(r.begun).map(([kk, x]) => `${kk} ${(x / seeds).toFixed(1)}`).join(', '));
  return 0;
}

if (isMain(import.meta.url)) process.exitCode = await main(process.argv.slice(2));
