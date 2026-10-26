// @ts-check
// RAID5 (2026-10-25, the owner: "I was want to rework town raids to bring them up to par with other world events,
// implementing mechanics (not the puzzle), different types of structure like wave based, defend, escort, etc"; asked
// which, "Waves", "Defend", "Escort" and "Classic skirmish"; bible/03-World/Raiding-Parties.md RAID5): A RAID'S KIND.
//
// Every raid the day rolls is one of four, and the kind is the raid's own - read off what the day already drew (its
// key, start, target and party: `raidKindOf`), never a new draw, so the roll the relay checks a word against
// (net/raid/raidLaw.js rollRaidTowns, RAID-ROLL) is the roll it always was, and every machine names the same kind:
//
//   classic   Kamer's raid as RAID1 ported it - one raider at a time, just out of view, the watch beside you
//   waves     THE ASSAULT: the target's raiders come in RAID_WAVES_FOR(tg) waves, in packs, a breather between; the
//             last wave is the party's LEADER alone - an elite with two boss traits (systems/bossTraits.js) - and its
//             fall is the last death the town's count needs
//   defend    THE STANDARD: a Standard-Bearer of the watch holds the town's square, and the raiders march on him; while
//             he stands the town is HELD, and if he falls it is sacked (the raid goes on, the thanks are less)
//   escort    THE EXODUS: refugees walk the streets from the town's edge to its square while the raiders hunt them;
//             each one who arrives is saved, and the town is held if most are
//
// A raid's count and its cleanse are what they were (RAID1-RAID3): its deaths, mine and every owner's, against its
// target - the relay keeps them and needs no word of the kind. The kind decides how the raiders stand and what more the
// town asks; its objective's state is the runner's, and each reader sees it on the raid's own foes.
//
// PURE - the raid in, the plan and the words out; systems/raidingParties.js runs it. Not a DFU member, nor Kamer's:
// Ledger A (RAID1's row, RAID5).
import { t } from './textManager.js';

/** The kinds, by the order `raidKindOf` draws them in (append only). */
export const RAID_KIND_ORDER = Object.freeze(['classic', 'waves', 'defend', 'escort']);
/** A staff event's raid (systems/staffEvents.js) is its own - staff set the fight. */
export const STAFF_KIND = 'staff';

/** FNV-1a over the raid's own tuple - the same on every machine (no game data, no clock). */
function tupleHash(parts) {
  let h = 0x811c9dc5;
  for (const p of parts) {
    const s = String(p);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    h ^= 0x7c; h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** A raid's kind - read off its key, its start, its target and its party; a staff event's is STAFF_KIND. Pure.
 *  @param {any} raid @returns {string} */
export function raidKindOf(raid) {
  if (!raid || raid.staff) return STAFF_KIND;
  const key = raid.key ?? `${raid.regionIndex}:${raid.locationIndex}:${raid.startDay}`;
  return RAID_KIND_ORDER[tupleHash(['raid-kind', key, raid.startMinute, raid.attackAmount, raid.type]) % RAID_KIND_ORDER.length];
}

// ── the assault ─────────────────────────────────────────────────────────────────────────────────────────────────────
/** How many waves come before the leader: four for a big raid (a target of 21 or more), else three. */
export const RAID_WAVES_FOR = (tg) => (tg >= 21 ? 4 : 3);
/** The breather between two waves (s) - the next is said when it ends. */
export const RAID_WAVE_BREATHER_S = 12;
/** A wave's packs: RAID_WAVE_PACK_MIN to RAID_WAVE_PACK_MAX at once, RAID_WAVE_PACK_GAP_S apart. */
export const RAID_WAVE_PACK_MIN = 3;
export const RAID_WAVE_PACK_MAX = 5;
export const RAID_WAVE_PACK_GAP_S = 6;
/** The leader's traits (systems/bossTraits.js), drawn for it, and how long after a leader falls before another is stood
 *  for a count the town has not yet heard (s). */
export const RAID_LEADER_TRAITS = 2;
export const RAID_LEADER_AGAIN_S = 10;
/** AUDIT WORLD-EVENTS L3-10: a wave whose count has not moved in this long (s, the kind's clock) stands again past the
 *  raiders it counts as standing - one it cannot reach held its wave, and the raid, forever (BOSS-CLEAR's 120 s). */
export const RAID_WAVE_STALL_S = 120;
/** AUDIT WORLD-EVENTS L4-4: how soon a square or a way not found is asked for again (s) - the town not yet built about
 *  the player, or the player still on its road. */
export const RAID_SITE_AGAIN_S = 5;
/** Each party's leader: its kind (MobileTypes - the knights' Knight, the bandits' Assassin, the orcs' Orc Warlord), and
 *  the word it is called by. */
export const RAID_LEADER_KINDS = Object.freeze([145, 139, 24]);
export const raidLeaderOf = (type) => RAID_LEADER_KINDS[type === 0 ? 0 : type === 1 ? 1 : 2];
const LEADER_NAMES = Object.freeze({
  145: () => t('raid.leaderName.knights', 'Knight-Captain'),
  139: () => t('raid.leaderName.bandits', 'Bandit Chief'),
  24: () => t('raid.leaderName.orcs', 'Orc Warlord'),
});
/** A leader's word by its kind (a puppet's, off its record), '' for a kind no party leads with. */
export const raidLeaderNameOf = (mobileType) => LEADER_NAMES[mobileType]?.() ?? '';
/** A party's leader's word ("Knight-Captain"), for the raid's line - AUDIT WORLD-EVENTS L5-8: the line's own article,
 *  never a "the" composed in front of it (it stood lowercase at the line's head). */
export const raidLeaderName = (type) => raidLeaderNameOf(raidLeaderOf(type));

/**
 * THE ASSAULT'S PLAN for a target of `tg` deaths: the waves' sizes (the target less the leader's one, shared as evenly
 * as it goes, the first the biggest), each wave's end on the count, and the count the leader stands at. Pure.
 * @param {number} tg @returns {{ sizes: number[], ends: number[], leaderAt: number }}
 */
export function raidWavePlan(tg) {
  const n = Math.max(0, (tg | 0) - 1), w = RAID_WAVES_FOR(tg | 0);
  const sizes = Array.from({ length: w }, (_, i) => Math.floor(n / w) + (i < n % w ? 1 : 0));
  const ends = [];
  sizes.reduce((s, x) => { ends.push(s + x); return s + x; }, 0);
  return { sizes, ends, leaderAt: n };
}
/** Where a count of `killed` stands in the plan: the wave (0-based - `sizes.length` is the leader's), and the deaths
 *  its wave still needs. Pure. @param {{ ends: number[], leaderAt: number }} plan @param {number} killed */
export function raidWaveAt(plan, killed) {
  const k = Math.max(0, killed | 0);
  const wave = plan.ends.findIndex((e) => k < e);
  if (wave < 0) return { wave: plan.ends.length, left: k < plan.leaderAt + 1 ? 1 : 0 };
  return { wave, left: plan.ends[wave] - k };
}

// ── the standard ───────────────────────────────────────────────────────────────────────────────────────────────────
/** The Standard-Bearer's health, times a watchman's. */
export const RAID_BEARER_HEALTH_X = 8;
/** How far from his post the bearer is let fight (m) - he holds the square. */
export const RAID_BEARER_LEASH_M = 4;
/** The standard's packs: at most RAID_DEFEND_PACK_MAX at once, RAID_DEFEND_PACK_GAP_S apart, led from
 *  RAID_DEFEND_FROM_M out about the square. */
export const RAID_DEFEND_PACK_MAX = 3;
export const RAID_DEFEND_PACK_GAP_S = 9;
export const RAID_DEFEND_FROM_M = 40;
/** How long a raider's grudge at the objective it is sent at holds (EnemyAI's give-up ticks - the defenders' own 600).
 *  AUDIT WORLD-EVENTS L5-14: ticks, never milliseconds (its name had it so). */
export const RAID_AIM_TICKS = 600;

// ── the exodus ─────────────────────────────────────────────────────────────────────────────────────────────────────
/** How many refugees walk, and how many arriving holds the town. */
export const RAID_REFUGEES = 3;
export const RAID_REFUGEES_HOLD = 2;
/** Their way's pace (m/s) - their guide waits while the nearest of them is RAID_REFUGEE_WAIT_M behind it. */
export const RAID_REFUGEE_PACE = 2.2;
export const RAID_REFUGEE_WAIT_M = 5;
/** A refugee within this of the way's end is safe (m). */
export const RAID_REFUGEE_SAFE_M = 4;
/** AUDIT WORLD-EVENTS L4-9: how far behind the one before each refugee stands along the way (m) - never all on one point. */
export const RAID_REFUGEE_GAP_M = 1.5;
/** Their health, times their kind's - they are townsfolk, but they must last a street. */
export const RAID_REFUGEE_HEALTH_X = 4;
/** The exodus's packs: at most RAID_ESCORT_PACK_MAX at once, RAID_ESCORT_PACK_GAP_S apart, led from RAID_ESCORT_AHEAD_M
 *  ahead of the refugees on their way. */
export const RAID_ESCORT_PACK_MAX = 3;
export const RAID_ESCORT_PACK_GAP_S = 10;
export const RAID_ESCORT_AHEAD_M = 25;

/** A walk along a polyline of [x, y, z] points: the point `s` metres along it (the end past it). Pure. */
export function alongWay(pts, s) {
  if (!Array.isArray(pts) || !pts.length) return null;
  let left = Math.max(0, s);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const d = Math.hypot(b[0] - a[0], b[2] - a[2]);
    if (left <= d && d > 0) { const k = left / d; return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; }
    left -= d;
  }
  return [...pts[pts.length - 1]];
}
/** A way's length (m). */
export const wayLength = (pts) => (Array.isArray(pts) ? pts.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - pts[i - 1][0], p[2] - pts[i - 1][2]) : 0), 0) : 0);

// ── the words ───────────────────────────────────────────────────────────────────────────────────────────────────────
/** A kind's name on the event board's row (AUDIT WORLD-EVENTS L5-14: the board's alone - the map names no kind; L5-15: a
 *  classic raid and a staff event name none, '' - their words were never shown). */
export const RAID_KIND_NAMES = Object.freeze({
  waves: () => t('raid.kind.waves', 'Assault'),
  defend: () => t('raid.kind.defend', 'Siege of the Standard'),
  escort: () => t('raid.kind.escort', 'Exodus'),
});
export const raidKindName = (kind) => RAID_KIND_NAMES[kind]?.() ?? '';
/** What a kind asks, said once with the raid's own line. */
export const raidKindAsk = (kind, town) => ({
  waves: () => t('raid.ask.waves', 'They come in waves. Hold until their leader falls.'),
  defend: () => t('raid.ask.defend', 'Keep the Standard-Bearer of {town} alive in the square.', { town }),
  escort: () => t('raid.ask.escort', 'Refugees flee to the square of {town}. See them there safely.', { town }),
}[kind]?.() ?? '');
export const raidWaveLine = (n, of, town) => t('raid.wave', 'Wave {n} of {of} falls on {town}!', { n, of, town });
export const raidLeaderLine = (name, town) => t('raid.leaderCharge', 'The {name} leads the last charge on {town}!', { name, town });   // AUDIT WORLD-EVENTS L5-8: its article its own
export const raidBearerFellLine = (town) => t('raid.bearerFell', 'The standard of {town} has fallen! The raiders sack the town.', { town });
export const raidRefugeeSafeLine = (n, of) => t('raid.refugeeSafe', 'A refugee reaches the square ({n} of {of} safe).', { n, of });
export const raidRefugeeLostLine = () => t('raid.refugeeLost', 'A refugee has fallen.');
export const raidHeldLine = (town) => t('raid.held', '{town} is held - its people will not forget it.', { town });
/** The board's word on a raid's objective, or '' (classic). */
export function raidObjectiveDetail(kind, o) {
  if (!o) return '';
  if (kind === 'waves') return o.wave >= o.of ? t('raid.detail.leader', 'Their leader') : t('raid.detail.wave', 'Wave {n} of {of}', { n: o.wave + 1, of: o.of });
  if (kind === 'defend') return o.fallen ? t('raid.detail.sacked', 'Sacked') : t('raid.detail.standard', 'Standard {pct}%', { pct: Math.max(0, Math.round(o.pct ?? 100)) });
  if (kind === 'escort') return t('raid.detail.refugeesSafe', 'Refugees: {safe} of {of} safe, {lost} lost', { safe: o.safe | 0, lost: o.lost | 0, of: o.of | 0 });   // AUDIT WORLD-EVENTS L5-13
  return '';
}
