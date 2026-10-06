#!/usr/bin/env node
// AUDIT SHIPS (2026-10-06, Mac: "Audit everything", of PR #634's SAIL-FREE + SERPENT3): THE SERPENT'S FIGHT, SIMULATED
// AGAINST THE RELAY'S OWN BRAIN - a fleet of galleons circling its waters and firing, every attack word judged on each
// ship by the struck machine's own law (systems/serpentStrike.js shapeMeets and shipHurt, the coil held, gripped and
// crushed or broken, a wreck retiring her share), the pair's share read off the brain's own count as a client reads it.
// SERPENT3's balance figures (bible/11-Multiplayer/Sea-Serpent.md sections 5 and 15) were measured with a scratch copy of
// this harness that never reached the tree, at 8 and 13 m/s - below the ways SAIL-FREE gives a ship circling under full
// sail (0.819 of her best: a galleon 13.3 m/s at the rated wind and 17.7 at 2 m/s, a Carrack 15.9 and 21.2), where its
// lone galleon won (AUDIT SHIPS A1). The harness is the tree's now, so every figure the record quotes is a command away.
// AUDIT SHIPS 2 XD2 (2026-10-06): each fleet flies its own hull - her hull and canvas, her length and beam as the strike
// tests her, her reference broadside (navalShips.js hullBuild, serpentBrain.js SHIP_REF) - and each ship carries her own
// remainder of the pair's share blow to blow, as her client does (AUDIT SHIPS C3). Every fleet flew a galleon's body, so
// the record's "Carrack" figures were a galleon at a Carrack's way.
//
//   node tools/serpentFleetSim.mjs --ships 2 --hit 0.38 --v 15.9 --hull 4 --seeds 12   # a pair of Carracks
//   node tools/serpentFleetSim.mjs --ships 1 --hit 0.5 --v 17.7 --lone-eased        # a lone ship given the pair's share
//   node tools/serpentFleetSim.mjs --ships 2 --hit 0.38 --v 13.3 --no-share          # the pair without it
//   node tools/serpentFleetSim.mjs --grid                                             # the record's table
//   node tools/serpentFleetSim.mjs --root ../other-tree ...                           # another tree's brain (a base)
//
// `--hit` is the share of a ship's reference broadside that strikes (the audit's measured gunnery is 0.38); `--v` the
// way she circles at (m/s), slowed as her canvas is torn. Each fight is seeded, so a run is the same run every time.
// AUDIT SHIPS 2 XB3 (2026-10-06): `--react <ms>` gives her A HELM - a heading turned at most `--turn` deg/s (8.5, the
// record's rudder at full way), her round sailed as the circling ships sail it, and every mark drawn at her (named hers,
// or its shape within 90 m of her) answered `react` ms after its word by steering away from it until it lands - the
// telegraph's use; `--lag <ms>` hands the brain her pose as it was that long ago. Circling ships never answer a mark,
// and sail exactly the course the serpent's lead predicts.
//
//   node tools/serpentFleetSim.mjs --ships 1 --v 21.2 --hull 4 --react 300 --seeds 24 # a lone Carrack's captain
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { isMain } from './lib/isMain.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
/** The waters' clock: a fight is stepped 50 ms at a time, the brain beat every SERPENT_TICK_MS, the guns every 500 ms. */
const STEP_MS = 50;
/** The galleon's hull (navalShips.js HULL - the Small Ship): every fleet's, unless it says its own. */
export const GALLEON = 2;
/** A hull's whole as the serpent meets her - her hull and canvas, her half-length and half-beam (the naval host's own
 *  serpentBoat), unrefitted. */
export function hullBody(N, hull) {
  const b = N.hullBuild(hull);
  return { hull, maxHull: b.hullHp, maxSail: b.sailHp, hl: (b.bowZ - b.aftZ) / 2, hw: b.halfWidth };
}
const POSE_TS_MOD = 2 ** 24;
const mulberry = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

/** The laws a run reads - this tree's, or `root`'s. */
export async function lawsOf(root = ROOT) {
  const at = (p) => pathToFileURL(join(resolve(root), p)).href;
  return { B: await import(at('src/net/serpentBrain.js')), S: await import(at('src/systems/serpentStrike.js')), N: await import(at('src/systems/naval/navalShips.js')) };
}

/**
 * ONE FLEET'S FIGHTS. `ships` galleons circling at `v` m/s on rounds 140-300 m about its waters' heart (every other one
 * the other way), each firing `hit` of her reference broadside every half second while any of it shows within reach -
 * the coil while one holds, else its body (a seventh of the blows at its head). `share` 'law' takes the pair's share as
 * the client does (fleetShare of the brain's count), 'none' takes every blow whole, 'lone' gives a lone ship the pair's
 * share as well. Answers the wins, the minutes each kill took, the wrecks and what each attack did.
 */
export function fleetFights(laws, { ships = 2, hit = 0.38, v = 13.3, seeds = 12, share = 'law', hull = GALLEON, helm = null } = {}) {
  const { B, S, N } = laws;
  const T = B.SERPENT_ATTACK_TABLE, REF = B.SHIP_REF[hull], H = hullBody(N, hull);
  const k = (n) => (share === 'none' ? 1 : share === 'lone' && n === 1 ? S.SERPENT_PAIR_SHARE ?? 1 : typeof S.fleetShare === 'function' ? S.fleetShare(n) : 1);
  const out = { ships, hit, v, seeds, hull, helm, maxHull: H.maxHull, wins: 0, minutes: [], wrecks: 0, taken: [], byKind: {}, begun: {}, dodges: 0 };
  const turn = ((helm?.turn ?? 8.5) * Math.PI) / 180, react = helm?.react ?? 0, lag = helm?.lag ?? 0;
  for (let seed = 1; seed <= seeds; seed++) {
    const rng = mulberry(seed * 7919 + ships), srng = mulberry(seed * 104729);
    const t0 = 1_000_000, sound = t0 + 25 * 60_000;
    const f = B.newSerpentFight(1, t0, sound, 'sethrakul', 0, 0, rng() * 6.28);
    const fleet = Array.from({ length: ships }, (_, i) => ({ sub: `s${i}`, a: (i / ships) * 6.28 + srng(), r: 140 + srng() * 160, dir: i % 2 ? 1 : -1, hull: H.maxHull, sail: H.maxSail, wreck: false, held: null, grip: { hull: 0, crew: 0 }, carry: { hull: 0, sail: 0, crew: 0 }, took: 0, away: null, past: [] }));
    for (const s of fleet) B.joinSerpentFight(f, s.sub, s.sub, 30, hull, t0, true, null, true);
    // a helmed ship sails her own heading from where her round puts her (XB3)
    if (helm) for (const s of fleet) { s.x = Math.sin(s.a) * s.r; s.z = Math.cos(s.a) * s.r; s.yw = s.a + (s.dir > 0 ? Math.PI / 2 : -Math.PI / 2); }
    const pos = (s) => (helm ? { x: s.x, z: s.z, yw: s.yw } : { x: Math.sin(s.a) * s.r, z: Math.cos(s.a) * s.r, yw: s.a + (s.dir > 0 ? Math.PI / 2 : -Math.PI / 2) });
    const foot = (s) => { const p = s.held ?? pos(s); return { x: p.x, z: p.z, yw: p.yw, hl: H.hl, hw: H.hw }; };
    let tNow = t0;
    const hurt = (s, h, kind) => {
      if (s.wreck) return;
      const n = Math.round(h.hull ?? 0);
      out.byKind[kind] = (out.byKind[kind] ?? 0) + n;
      s.hull -= n; s.sail = Math.max(0, s.sail - Math.round(h.sail ?? 0)); s.took += n;
      if (s.hull <= 0) { s.wreck = true; s.held = null; B.serpentWreck(f, s.sub, 1, tNow); }
    };
    const whole = { maxHull: H.maxHull, maxSail: H.maxSail };
    const pend = new Map();
    let lastHit = t0;
    const words = (ws) => {
      for (const w of ws) {
        if (w.k === 'atk') {
          pend.set(w.i, { ...w, done: false });
          const A = B.SERPENT_ATTACK_BY_ID[w.a];
          out.begun[A.key] = (out.begun[A.key] ?? 0) + 1;
          // THE HELM: a mark drawn at her - named hers, or its shape within 90 m of her - steered away from until it lands
          if (helm && A.shape !== 'none') for (const s of fleet) {
            if (s.wreck || s.held) continue;
            const [mx, mz] = w.tg[0];
            if (w.s !== s.sub && Math.hypot(mx - s.x, mz - s.z) >= 90) continue;
            let away;
            if (A.shape === 'lane' && w.tg[1]) { const lx = w.tg[1][0] - mx, lz = w.tg[1][1] - mz, side = Math.sign((s.x - mx) * lz - (s.z - mz) * lx) || 1; away = Math.atan2(lz * side, -lx * side); }
            else away = Math.atan2(s.x - mx, s.z - mz);
            s.away = { yw: away, from: tNow + react, until: w.at + (A === T.ram ? A.active : 300) };
            out.dodges++;
          }
        }
        if (w.k === 'cb' || w.k === 'cr' || w.k === 'cx') for (const s of fleet) if (s.held && s.held.i === w.i) { if (w.k === 'cr') hurt(s, S.crushHurt(whole, k(f.ships ?? ships), s.carry), 'crush'); s.held = null; }
      }
    };
    for (let t = t0; t < sound && !f.fell; t += STEP_MS) {
      tNow = t;
      for (const s of fleet) {
        if (s.wreck || s.held) continue;
        const sp = v * (H.maxSail > 0 ? 0.35 + 0.65 * s.sail / H.maxSail : 1);
        if (!helm) { s.a += (s.dir * sp * (STEP_MS / 1000)) / s.r; continue; }
        let want;
        if (s.away && t < s.away.until && t >= s.away.from) want = s.away.yw;
        else {
          if (s.away && t >= s.away.until) s.away = null;
          // her round, as the circling ships sail it: its tangent, drawn back onto her own radius
          const a = Math.atan2(s.x, s.z), rr = Math.hypot(s.x, s.z);
          want = a + s.dir * Math.PI / 2 + s.dir * Math.max(-0.6, Math.min(0.6, (rr - s.r) / 60));
        }
        const err = B.serpentWrapYaw(want - s.yw), max = (turn * STEP_MS) / 1000;
        s.yw = B.serpentWrapYaw(s.yw + Math.max(-max, Math.min(max, err)));
        s.x += (Math.sin(s.yw) * sp * STEP_MS) / 1000; s.z += (Math.cos(s.yw) * sp * STEP_MS) / 1000;
        s.past.push({ t, x: s.x, z: s.z, yw: s.yw });
        while (s.past.length && s.past[0].t < t - lag - 200) s.past.shift();
      }
      // the brain's beat, every ship's pose at it with its own send time (net/wire.js POSE_TS_MOD) - `lag` ms old
      if ((t - t0) % B.SERPENT_TICK_MS === 0) {
        const bodies = fleet.map((s) => {
          const p = helm && lag ? s.past.find((q) => q.t >= t - lag) ?? { t, ...foot(s) } : { t, ...foot(s) };
          return { sub: s.sub, x: p.x, z: p.z, yw: p.yw, hl: H.hl, hw: H.hw, dead: false, ts: p.t % POSE_TS_MOD };
        });
        words(B.stepSerpentBrain(f, t, bodies, rng));
      }
      // the landings, judged on each ship's own machine
      for (const a of pend.values()) {
        const A = B.SERPENT_ATTACK_BY_ID[a.a];
        if (a.done || t < a.at) continue;
        if (A === T.ram) {
          for (const s of fleet) if (!s.wreck && !a[s.sub] && S.shapeMeets(a, foot(s), t)) { a[s.sub] = 1; hurt(s, S.shipHurt(A, whole, k(f.ships ?? ships), s.carry), A.key); }
          if (t > a.at + A.active) a.done = true;
          continue;
        }
        a.done = true;
        if (A === T.coil) {
          const s = fleet.find((q) => q.sub === a.s);
          if (s && !s.wreck) {
            if (S.shapeMeets(a, foot(s), a.at)) { const p = foot(s); s.held = { i: a.i, ...pos(s) }; s.away = null; words(B.coilWord(f, s.sub, 'held', a.i, p.x, p.z, t)); }
            else words(B.coilWord(f, s.sub, 'esc', a.i, 0, 0, t));
          }
          continue;
        }
        if (A.hull + A.base <= 0) continue;
        for (const s of fleet) if (!s.wreck && S.shapeMeets(a, foot(s), a.at)) hurt(s, S.shipHurt(A, whole, k(f.ships ?? ships), s.carry), A.key);
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
/** The hulls by name, as a fight line says them. */
export const HULL_NAMES = Object.freeze(['rowboat', 'Large Boat', 'galleon', 'Large Galley', 'Carrack']);
export const fightLine = (r) => `${HULL_NAMES[r.hull] ?? r.hull} ships ${r.ships} hit ${r.hit} v ${r.v}${r.helm ? ` helm ${r.helm.react} ms${r.helm.lag ? ` lag ${r.helm.lag}` : ''}` : ''}: wins ${r.wins}/${r.seeds}, mean ${mean(r.minutes).toFixed(1)} min, wrecks ${(r.wrecks / r.seeds).toFixed(2)}/fight, hull taken/ship ${mean(r.taken).toFixed(0)} of ${r.maxHull}`;

/** The record's grid: each fighting hull at the ways SAIL-FREE gives her circling under full sail (0.819 of her best) in
 *  the rated wind, a fair day's strongest (2 m/s) and the sea's strongest (3 m/s) - and the galleon at the old 8 m/s; the
 *  measured gunnery and a quarter either side; one, two, three and five ships of her. AUDIT SHIPS 2 XD2: each at her own
 *  ways - a galleon's 31.8 m/s was a Carrack's. */
export const GRID = Object.freeze({
  hulls: Object.freeze({ 2: Object.freeze([8, 13.3, 17.7, 26.5]), 4: Object.freeze([15.9, 21.2, 31.8]), 3: Object.freeze([6.6, 8.8, 13.3]) }),
  hit: Object.freeze([0.25, 0.38, 0.5]), ships: Object.freeze([1, 2, 3, 5]),
});

async function main(argv) {
  const arg = (name, d) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : d; };
  const laws = await lawsOf(arg('root', ROOT));
  const seeds = Number(arg('seeds', 12));
  if (argv.includes('--grid')) {
    for (const [hull, vs] of Object.entries(GRID.hulls)) for (const v of vs) for (const hit of GRID.hit) for (const ships of GRID.ships) console.log(fightLine(fleetFights(laws, { ships, hit, v, seeds, hull: Number(hull) })));
    return 0;
  }
  const share = argv.includes('--no-share') ? 'none' : argv.includes('--lone-eased') ? 'lone' : 'law';
  const helm = arg('react') === undefined ? null : { react: Number(arg('react')), turn: Number(arg('turn', 8.5)), lag: Number(arg('lag', 0)) };
  const r = fleetFights(laws, { ships: Number(arg('ships', 2)), hit: Number(arg('hit', 0.38)), v: Number(arg('v', 13.3)), seeds, share, hull: Number(arg('hull', GALLEON)), helm });
  console.log(fightLine(r));
  console.log('   hull by kind / fight:', Object.entries(r.byKind).map(([kk, x]) => `${kk} ${(x / seeds).toFixed(0)}`).join(', '), '| begun / fight:', Object.entries(r.begun).map(([kk, x]) => `${kk} ${(x / seeds).toFixed(1)}`).join(', '));
  return 0;
}

if (isMain(import.meta.url)) process.exitCode = await main(process.argv.slice(2));
