// SEAT1d (2026-10-01, Mac: "Finish the seats"; "Continue") - THE ECONOMY MODEL, AS A TOOL (bible/06-Systems/
// Professions-Arc.md Appendix C: "SEAT1d ships the model as a tool reading townSeatLaw.js and professionLaw.js
// directly, so every later balance pass is re-run, not re-guessed"; Seats-Arc 13: "the model re-runs Appendix C's
// table").
//
// A seeded Monte Carlo of a guild's week: its members drawn from Appendix C's three players (35% casual, 45% regular,
// 20% hardcore), each one's influence at its pledged seat counted by the law's own sources and caps (the Watch, gate
// receipts, Renown in the region, the Siege Camp's writs at a Mark of influence a Mark, the account's cap), and its
// Court writ income by the law's own writ (its units by tier, its pay, the day's cap). The guild's week is the sum; the
// table is each size's p10 / p50 / p90 influence, its median writ income, and what a palace's and a crown's upkeep take of
// it. Every number the law owns is read from it - change a cap there and the table moves here.
//
// The players are ASSUMPTIONS (Appendix C's table), kept here and named: MEASURED replaces them with the weekly
// report's own after four weeks of Marks.
//
//   node tools/seatEconomy.mjs                 # the table, 400 runs a size, seed 1
//   node tools/seatEconomy.mjs --runs 2000 --seed 7
//   node tools/seatEconomy.mjs --json
import {
  WATCH_INFLUENCE,
  WATCH_DAY_CAP,
  GATE_INFLUENCE,
  GATE_WEEK_CAP,
  RENOWN_XP_PER_INFLUENCE,
  RENOWN_WEEK_CAP,
  WRIT_INFLUENCE_PER_MARK,
  ACCOUNT_SEAT_WEEK_CAP,
  SEAT_UPKEEP,
  CLAIM_THRESHOLD,
  crownScale,
} from '../src/net/townSeatLaw.js';
import { COURT_WRITS_PER_DAY, WRIT_UNITS, WRIT_TIER_WEIGHTS, writPay } from '../src/net/professionLaw.js';
import { isMain } from './lib/isMain.mjs';

/** APPENDIX C'S PLAYERS - assumptions, not law. `town` minutes in the seat town a session (the Watch: one influence a
 *  two minutes); `harvests` and `writs` a session; `gates` felled and `renownXp` earned a week, everywhere. */
export const PROFILES = Object.freeze({
  casual: Object.freeze({ share: 0.35, sessions: 3, town: 20, harvests: 20, writs: 1, gates: 0.3, renownXp: 3000 }),
  regular: Object.freeze({ share: 0.45, sessions: 5, town: 30, harvests: 45, writs: 2, gates: 1.5, renownXp: 9000 }),
  hardcore: Object.freeze({ share: 0.2, sessions: 7, town: 60, harvests: 90, writs: 4, gates: 4, renownXp: 25000 }),
});
/** The rest of Appendix C's assumptions: the share of play in the pledged region; units a harvest and Marks a unit; the
 *  share of the gathering sent to the Siege Camp; the wilderness's daylight (FORAGE0's fold: 55/120 + 65/120 x 0.5). */
export const ASSUME = Object.freeze({
  inRegion: 0.6,
  unitsAHarvest: 2.5,
  marksAUnit: 2.5,
  toCamp: 0.25,
  daylight: 55 / 120 + (65 / 120) * 0.5,
});
/** The guild sizes the table is read at, and the server the crown's upkeep is scaled to (a hundred accounts). */
export const SIZES = Object.freeze([5, 8, 12, 20, 30, 50]);
export const SERVER_ACTIVE = 100;

/** mulberry32 - a small seeded generator, so a run is the same run. */
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const poisson = (mean, r) => {
  const l = Math.exp(-mean);
  let k = 0,
    p = 1;
  do {
    k++;
    p *= r();
  } while (p > l);
  return k - 1;
};
const around = (mean, r) => mean * (0.5 + r()); // a session's spread: half to one and a half of its mean
const pickProfile = (r) => {
  const u = r();
  let acc = 0;
  for (const [k, p] of Object.entries(PROFILES)) {
    acc += p.share;
    if (u < acc) return k;
  }
  return 'regular';
};
/** A Court writ's pay - its tier by the law's weights, its units in the tier's range (in tens), at ASSUME's Mark value. */
function writOf(r) {
  const total = WRIT_TIER_WEIGHTS.reduce((a, b) => a + b, 0);
  let u = r() * total,
    tier = 1;
  for (let i = 0; i < WRIT_TIER_WEIGHTS.length; i++) {
    u -= WRIT_TIER_WEIGHTS[i];
    if (u < 0) {
      tier = i + 1;
      break;
    }
  }
  const [lo, hi] = WRIT_UNITS[tier];
  const units = lo + Math.floor(r() * ((hi - lo) / 10 + 1)) * 10;
  return writPay(units, ASSUME.marksAUnit);
}

/** ONE MEMBER'S WEEK: `{ influence, writMarks }` - each source at its own cap, then the account's. */
export function memberWeek(profile, r) {
  const p = PROFILES[profile];
  let watch = 0,
    harvests = 0,
    writs = 0,
    writMarks = 0;
  for (let day = 0; day < 7; day++) {
    if (r() >= p.sessions / 7) continue; // a session on this day
    watch += Math.min(WATCH_DAY_CAP, Math.floor(around(p.town, r) / 2) * WATCH_INFLUENCE);
    harvests += around(p.harvests, r) * ASSUME.daylight;
    const n = Math.min(COURT_WRITS_PER_DAY, Math.round(around(p.writs, r)));
    for (let i = 0; i < n; i++) writMarks += writOf(r);
    writs += n;
  }
  const gates = Math.min(GATE_WEEK_CAP, poisson(p.gates * ASSUME.inRegion, r) * GATE_INFLUENCE);
  const renown = Math.min(
    RENOWN_WEEK_CAP,
    Math.floor((around(p.renownXp, r) * ASSUME.inRegion) / RENOWN_XP_PER_INFLUENCE),
  );
  const camp =
    Math.floor(harvests * ASSUME.inRegion * ASSUME.unitsAHarvest * ASSUME.marksAUnit * ASSUME.toCamp) *
    WRIT_INFLUENCE_PER_MARK;
  return {
    influence: Math.min(ACCOUNT_SEAT_WEEK_CAP, watch + gates + renown + camp),
    writMarks: Math.round(writMarks),
    writs,
  };
}

const pct = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
/**
 * THE TABLE: for each guild size, `runs` weeks - `{ size, p10, p50, p90, writP50, palaceShare, crownShare }`, the shares
 * the upkeep's of the median writ income (the crown's at SERVER_ACTIVE accounts' scale).
 */
export function runModel({ runs = 400, seed = 1, sizes = SIZES } = {}) {
  const r = seeded(seed);
  return sizes.map((size) => {
    const inf = [],
      marks = [];
    for (let i = 0; i < runs; i++) {
      let a = 0,
        m = 0;
      for (let k = 0; k < size; k++) {
        const w = memberWeek(pickProfile(r), r);
        a += w.influence;
        m += w.writMarks;
      }
      inf.push(a);
      marks.push(m);
    }
    inf.sort((x, y) => x - y);
    marks.sort((x, y) => x - y);
    const writP50 = pct(marks, 0.5);
    return {
      size,
      p10: pct(inf, 0.1),
      p50: pct(inf, 0.5),
      p90: pct(inf, 0.9),
      writP50,
      palaceShare: SEAT_UPKEEP.palace / writP50,
      crownShare: (SEAT_UPKEEP.crown * crownScale(SERVER_ACTIVE)) / writP50,
    };
  });
}

/** The table in Appendix C's own shape (Markdown). */
export function tableText(rows) {
  const n = (v) => Math.round(v).toLocaleString('en-US');
  const p = (v) => `${Math.round(v * 100)}%`;
  return [
    '| Guild size | Influence a week (p10 / p50 / p90) | Writ Marks a week (p50) | Palace upkeep, of that | Crown upkeep, of that |',
    '|---|---|---|---|---|',
    ...rows.map(
      (x) =>
        `| ${x.size} | ${n(x.p10)} / ${n(x.p50)} / ${n(x.p90)} | ${n(x.writP50)} | ${p(x.palaceShare)} | ${p(x.crownShare)} |`,
    ),
  ].join('\n');
}

if (isMain(import.meta.url)) {
  const arg = (name, d) => {
    const i = process.argv.indexOf(name);
    return i > 0 ? Number(process.argv[i + 1]) : d;
  };
  const rows = runModel({ runs: arg('--runs', 400), seed: arg('--seed', 1) });
  if (process.argv.includes('--json')) console.log(JSON.stringify(rows, null, 2));
  else {
    console.log(tableText(rows));
    console.log(
      `\nThe lines: a palace ${CLAIM_THRESHOLD.palace.toLocaleString('en-US')}, a crown ${CLAIM_THRESHOLD.crown.toLocaleString('en-US')}; the crown's upkeep at ${SERVER_ACTIVE} accounts.`,
    );
  }
}
