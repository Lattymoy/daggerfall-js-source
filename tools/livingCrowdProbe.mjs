// LW-SPACE (2026-10-06, Mac: "I notice NPCs and walk stuck inside each other, and in towns some NPCs can group up too
// much when talking to each other"; bible/06-Systems/Living-World.md "LW-SPACE"): THE LIVING TOWN'S STREET ON THE GAME'S
// OWN TOWNS, MEASURED - each town as the streaming host builds it (test/lwRealTown.mjs, the population block replayed
// word for word), its living town run at the hours asked with the player standing at its square, 30 frames a second:
//   - INSIDE ANOTHER: the share of the body-frames in view within half a metre of another body, and by what the two were
//     about (both walking, the same way, the other way or across - and whether they left one place together; one walking
//     by one standing; both standing, in one circle, alone at one spot, or at two spots), and how many pairs stood inside
//     each other a second and more;
//   - THE CROWD: the town's people standing out of doors, at how many spots, and the busiest spots (the square marked;
//     LW-SPREAD: the square's people at any of its points).
// Numbers only: nothing of the game's data is written, drawn or kept.
//
// Usage: ARENA2_PATH=<arena2> node tools/livingCrowdProbe.mjs [towns, comma-separated: Ripmarket,Daggerfall] [hours: 8,13,18] [seconds: 40]
//        ARENA2_PATH=<arena2> node tools/livingCrowdProbe.mjs --crowds     (LW-SPREAD: a sample of 34 towns' busiest spots)
import { skipReal, hostTown, townsOf, LOCATION_TYPES } from '../test/lwRealTown.mjs';
import { LivingTown } from '../src/systems/livingWorld/livingTown.js';
import { ResidentWalker } from '../src/characters/residentWalker.js';
import { PERSON_MOVE_SPEED } from '../src/characters/mobilePerson.js';
import { CLASSIC_MINUTES_PER_SECOND } from '../src/systems/worldTick.js';
import { DAY_MIN, isOutdoor } from '../src/systems/livingWorld/dayPlan.js';
import { isMain } from './lib/isMain.mjs';

const RATE = CLASSIC_MINUTES_PER_SECOND, MPM = PERSON_MOVE_SPEED / RATE;
/** The day the probe lives (any: the plans are the seeds'), and how near is inside (m). */
const DAY = 120, NEAR = 0.5;

/**
 * A town's street at an hour: `seconds` of frames after ten to settle the way in.
 * @param {ReturnType<typeof hostTown>} h @param {number} hour @param {number} seconds
 */
export function streetAt(h, hour, seconds) {
  const clock = { t: DAY * DAY_MIN + hour * 60 };
  const lt = new LivingTown(h.nav, { town: h.town, buildings: h.buildings, doors: h.doors,
    makePerson: (archive, guard) => new ResidentWalker(h.nav, { archive, guard, frameCount: () => 4, groundY: () => 0 }),
    clock: () => clock.t, rate: () => RATE, mpm: MPM });
  const sq = lt.places.square, at = [sq?.x ?? 0, 0, sq?.z ?? 0];
  /** @type {Record<string, number>} */
  const kinds = {};
  let frames = 0, bodies = 0, inside = 0, glued = 0;
  /** @type {Map<string, number>} pair -> frames inside each other so far */
  const together = new Map();
  for (let i = 0; i < (10 + seconds) * 30; i++) {
    clock.t += RATE / 30;
    const seats = lt.update(1 / 30, at, 0, at, true);
    if (i < 10 * 30) continue;
    frames++;
    const b = seats.map((s) => {
      const p = s.person, res = p.living.res;
      const w = lt.where(res, lt._now - (lt._lag.get(res.id) ?? 0), false);
      return { id: res.id, x: p.pos[0], z: p.pos[2], walking: p.moving, yaw: p.yaw, circle: lt._inCircle.get(res.id)?.circle ?? null, spot: w && !w.moving ? (w.e.at?.key ?? null) : null, e: w?.e ?? null };
    });
    bodies += b.length;
    const hit = new Set(), now = new Set();
    for (let x = 0; x < b.length; x++) {
      for (let y = x + 1; y < b.length; y++) {
        const p = b[x], q = b[y];
        if (Math.hypot(p.x - q.x, p.z - q.z) >= NEAR) continue;
        hit.add(x); hit.add(y);
        let k;
        if (p.walking && q.walking) {
          let dy = Math.abs(p.yaw - q.yaw) % (2 * Math.PI);
          if (dy > Math.PI) dy = 2 * Math.PI - dy;
          const together_ = p.e?.kind === 'walk' && q.e?.kind === 'walk' && p.e.from === q.e.from && Math.abs(p.e.t0 - q.e.t0) < 3;
          k = `walking, ${dy < Math.PI / 4 ? 'one way' : dy > 3 * Math.PI / 4 ? 'the other way' : 'across'}${together_ ? ', left together' : ''}`;
        } else if (p.walking || q.walking) k = `walking by one standing${(p.walking ? q : p).spot === sq?.key ? ' at the square' : ''}`;
        else k = p.circle && p.circle === q.circle ? 'standing in one circle' : p.spot === q.spot ? 'standing at one spot' : 'standing at two spots';
        kinds[k] = (kinds[k] ?? 0) + 1;
        const pk = p.id < q.id ? `${p.id}|${q.id}` : `${q.id}|${p.id}`;
        now.add(pk);
        together.set(pk, (together.get(pk) ?? 0) + 1);
      }
    }
    for (const [pk, n] of together) if (!now.has(pk)) { if (n >= 30) glued++; together.delete(pk); }
    inside += hit.size;
  }
  for (const n of together.values()) if (n >= 30) glued++;
  // the crowd: the town's people out of doors now, by spot
  const day = lt.dayOf(lt._now);
  /** @type {Map<string, number>} */
  const bySpot = new Map();
  let standing = 0, walking = 0;
  for (const res of lt.peopleOf(day)) {
    const a = lt.entryOf(res, lt._now);
    if (!a) continue;
    if (a.e.kind === 'walk') { walking++; continue; }
    if (!isOutdoor(a.e)) continue;
    standing++;
    bySpot.set(a.e.at.key, (bySpot.get(a.e.at.key) ?? 0) + 1);
  }
  const busiest = [...bySpot.entries()].sort((x, y) => y[1] - x[1]).slice(0, 4).map(([k, n]) => ({ spot: k === sq?.key ? 'the square' : k, n }));
  // LW-SPREAD: the square is its points - the town at the square is the town at any of them
  const squareKeys = new Set((lt.places.squares ?? (sq ? [sq] : [])).map((s) => s.key));
  const atSquare = [...bySpot.entries()].reduce((n, [k, c]) => n + (squareKeys.has(k) ? c : 0), 0);
  return { frames, seen: bodies / Math.max(1, frames), share: inside / Math.max(1, bodies), glued, kinds: Object.fromEntries(Object.entries(kinds).map(([k, n]) => [k, n / Math.max(1, frames)])),
    standing, walking, spots: bySpot.size, busiest, atSquare, mostAtOne: busiest[0]?.n ?? 0 };
}

/**
 * LW-SPREAD: A TOWN'S CROWDS THROUGH A DAY, by its plans alone (no frames): every `step` minutes from `from` to `to`
 * (hours), the most of its people standing at one spot, and at the square (all its points); the town's own living town.
 * @param {ReturnType<typeof hostTown>} h @param {number} [from] @param {number} [to] @param {number} [step]
 * @returns {{ people: number, busiest: number, busiestAt: number, outThen: number, square: number }}
 */
export function crowdsOf(h, from = 7, to = 22, step = 10) {
  const lt = new LivingTown(h.nav, { town: h.town, buildings: h.buildings, doors: h.doors, makePerson: () => null, clock: () => DAY * DAY_MIN, rate: () => RATE, mpm: MPM });
  const squareKeys = new Set((lt.places.squares ?? (lt.places.square ? [lt.places.square] : [])).map((s) => s.key));
  let busiest = 0, busiestAt = 0, outThen = 0, square = 0;
  for (let m = from * 60; m <= to * 60; m += step) {
    const t = DAY * DAY_MIN + m;
    /** @type {Map<string, number>} */
    const at = new Map();
    let out = 0;
    for (const res of lt.peopleOf(DAY)) {
      const a = lt.entryOf(res, t);
      if (!a || a.e.kind === 'walk' || !isOutdoor(a.e)) continue;
      out++;
      at.set(a.e.at.key, (at.get(a.e.at.key) ?? 0) + 1);
    }
    const top = Math.max(0, ...at.values());
    if (top > busiest) { busiest = top; busiestAt = m / 60; outThen = out; }
    square = Math.max(square, [...at].reduce((n, [k, c]) => n + (squareKeys.has(k) ? c : 0), 0));
  }
  return { people: lt.residents.length, busiest, busiestAt, outThen, square };
}

/** LW-SPREAD: a sample of the game's towns - `n` of each kind asked, spread over its rows. @param {readonly [number, number][]} kinds */
export function sampleTowns(kinds) {
  const out = [];
  for (const [type, n] of kinds) {
    const all = townsOf([type]);
    for (let i = 0; i < n; i++) out.push(all[Math.floor((i * all.length) / n)]);
  }
  return out;
}

if (isMain(import.meta.url)) {
  if (skipReal) { console.log(skipReal); process.exit(1); }
  if (process.argv[2] === '--crowds') {
    // LW-SPREAD: the busiest spot of each of a sample of the game's towns, by its plans, 07:00 to 22:00
    const towns = sampleTowns([[LOCATION_TYPES.TownCity, 14], [LOCATION_TYPES.TownVillage, 10], [LOCATION_TYPES.TownHamlet, 10]]);
    const rows = towns.map((loc) => ({ name: loc.name, ...crowdsOf(hostTown(loc)) }));
    console.log(`${rows.length} towns: the busiest spot ${(rows.reduce((n, r) => n + r.busiest, 0) / rows.length).toFixed(1)} on average, the square ${(rows.reduce((n, r) => n + r.square, 0) / rows.length).toFixed(1)}`);
    for (const r of rows.sort((a, b) => b.busiest - a.busiest).slice(0, 10)) console.log(`  ${r.name} (${r.people}): ${r.busiest} at one spot at ${r.busiestAt.toFixed(1)}h of ${r.outThen} out; the square ${r.square}`);
    process.exit(0);
  }
  const names = (process.argv[2] ?? 'Ripmarket,Wayrest,Daggerfall,Tuntale,Bubyrydata').split(',');
  const hours = (process.argv[3] ?? '8,13,18').split(',').map(Number);
  const seconds = Number(process.argv[4] ?? 40);
  const all = townsOf([LOCATION_TYPES.TownCity, LOCATION_TYPES.TownVillage, LOCATION_TYPES.TownHamlet]);
  for (const name of names) {
    const loc = all.find((l) => l.name === name);
    if (!loc) { console.log(`${name}: no such town`); continue; }
    const h = hostTown(loc);
    console.log(`\n${name} (${h.town.blocks} blocks)`);
    for (const hour of hours) {
      const m = streetAt(h, hour, seconds);
      console.log(`  ${String(hour).padStart(2)}:00  ${m.seen.toFixed(1)} in view, ${(100 * m.share).toFixed(1)}% inside another, ${m.glued} pairs a second and more;`
        + ` ${m.standing} standing out at ${m.spots} spots (the square ${m.atSquare}; the busiest ${m.busiest.map((b) => `${b.spot} ${b.n}`).join(', ')}), ${m.walking} walking`);
      for (const [k, n] of Object.entries(m.kinds).sort((x, y) => y[1] - x[1])) console.log(`         ${n.toFixed(2)} pairs a frame ${k}`);
    }
  }
}
