// @ts-check
// STOREFRONT (2026-10-29; bible/06-Systems/Battle-Pass.md): THE BATTLE PASS'S LAW - a season's calendar and its three
// stages, the track's fifty levels and their rewards, the experience a deed gives, the challenges and the boosters. Read
// by the account service (server-account/src/battlePass.js), which holds each account's season experience and decides each
// find, and by the page (systems/pass/, the pass window, the shop). The brief: a theme, the world changed a little, three
// stages of 20 days, a booster, a test season from 10 November. Every reward is cosmetic (the Terms' section 9). A leaf.
// Not a DFU member: DFU has no seasons or accounts. Ledger A (STOREFRONT).

const DAY_MS = 86_400_000;
/** The levels of a track, and the experience each level asks (flat: the tenth level asks what the first did). */
export const PASS_LEVELS = 50;
export const PASS_XP_PER_LEVEL = 1000;

const stage = (/** @type {string} */ key, /** @type {number} */ fromMs, /** @type {number} */ top) => Object.freeze({ key, fromMs, toMs: fromMs + 20 * DAY_MS, top });
const S1_FROM = Date.UTC(2026, 10, 10);
/** THE SEASONS, one a row: its id (a ware's and a row's column name: `pass_<id>`), its first and end instant (UTC ms; the end
 *  is not inside), and its stages - each twenty days and the highest level it opens. A level past the open stage's top
 *  is banked: its experience is kept and counts when the next stage opens. */
export const PASS_SEASONS = Object.freeze([
  Object.freeze({
    id: 's1', fromMs: S1_FROM, toMs: S1_FROM + 60 * DAY_MS,
    stages: Object.freeze([stage('tremor', S1_FROM, 17), stage('halls', S1_FROM + 20 * DAY_MS, 34), stage('heart', S1_FROM + 40 * DAY_MS, 50)]),
  }),
]);
/** A season by its id, or null. */
export const passSeasonById = (/** @type {unknown} */ id) => PASS_SEASONS.find((s) => s.id === id) ?? null;
/** The season open at `nowMs`, or null. Pure. */
export const passSeasonAt = (/** @type {number} */ nowMs) => (Number.isFinite(nowMs) ? PASS_SEASONS.find((s) => nowMs >= s.fromMs && nowMs < s.toMs) ?? null : null);
/** The season open now or the next to come, else the last that ran - the one the pass window shows. */
export const passSeasonShown = (/** @type {number} */ nowMs) => passSeasonAt(nowMs) ?? PASS_SEASONS.find((s) => s.fromMs > nowMs) ?? PASS_SEASONS[PASS_SEASONS.length - 1] ?? null;
/** The index of a season's stage open at `nowMs`: -1 before it, the last stage's after it ends (every level open). */
export function passStageAt(/** @type {any} */ season, /** @type {number} */ nowMs) {
  if (!season || !Number.isFinite(nowMs) || nowMs < season.fromMs) return -1;
  let i = 0;
  while (i + 1 < season.stages.length && nowMs >= season.stages[i + 1].fromMs) i++;
  return i;
}
/** The highest level open at `nowMs` (0 before the season). */
export const passTopAt = (/** @type {any} */ season, /** @type {number} */ nowMs) => { const i = passStageAt(season, nowMs); return i < 0 ? 0 : season.stages[i].top; };
/** The level an experience reaches at `nowMs`: whole levels, no higher than the open stage's top. Pure. */
export function passLevelOf(/** @type {unknown} */ xp, /** @type {any} */ season, /** @type {number} */ nowMs) {
  const x = Number.isSafeInteger(xp) && /** @type {number} */ (xp) > 0 ? /** @type {number} */ (xp) : 0;
  return Math.min(Math.floor(x / PASS_XP_PER_LEVEL), passTopAt(season, nowMs), PASS_LEVELS);
}
/** Whether a season's finds are asked at `nowMs` (inside its days). */
export const passOpen = (/** @type {any} */ season, /** @type {number} */ nowMs) => !!season && Number.isFinite(nowMs) && nowMs >= season.fromMs && nowMs < season.toMs;

// ═══ THE FINDS ═══════════════════════════════════════════════════════════════════════════════════════════════════════
/** The experience a deed gives, by its source - a foe by its kind (systems/pass/passClient.js passFoeSource), an act by
 *  its family (systems/questlines/qlActs.js ACT_KINDS), a quest done and a bounty paid. `construct` is the season's own foe. */
export const PASS_SOURCES = Object.freeze({
  foe: 12, undead: 15, daedra: 15, elite: 60, construct: 40,
  gather: 8, make: 12, loot: 10, tavern: 50, sea: 40, world: 120, endgame: 300, quest: 150, bounty: 150,
});
export const isPassSource = (/** @type {unknown} */ s) => typeof s === 'string' && Object.hasOwn(PASS_SOURCES, s);
/** The Rourken's works, the season's constructs wherever they are met (Daggerfall Enemy Expansion's Centurion Sphere,
 *  Iron Golem and Steam Centurion - scenes/ketch/ketchFight.js KT_LOOKS): a `construct` find, and the Resonant Maul's
 *  quarry (systems/pass/resonantMaul.js). */
export const PASS_CONSTRUCT_MOBILES = Object.freeze([289, 270, 290]);
/** A UTC day's bounds an account: the asks heard, and the experience found before a booster's share (a booster's share
 *  is on top, so a booster speeds every player, the one who plays all day too). */
export const PASS_DAY_ASKS = 2000;
export const PASS_DAY_XP = 2000;

// ═══ THE CHALLENGES ══════════════════════════════════════════════════════════════════════════════════════════════════
const challenge = (/** @type {number} */ st, /** @type {string} */ key, /** @type {string[]} */ sources, /** @type {number} */ n, /** @type {number} */ xp) => Object.freeze({ stage: st, key, sources: Object.freeze(sources), n, xp });
/** A STAGE'S CHALLENGES: each counts its sources' deeds while its stage is open and pays its experience once, on the
 *  deed that completes it, beside the day's bound (never under it) and never boosted. */
export const PASS_CHALLENGES = Object.freeze([
  challenge(0, 'tremor-foes', ['foe', 'undead', 'daedra', 'elite', 'construct'], 100, 1500),
  challenge(0, 'tremor-constructs', ['construct'], 25, 2000),
  challenge(0, 'tremor-gather', ['gather'], 60, 1000),
  challenge(0, 'tremor-tavern', ['tavern'], 3, 800),
  challenge(0, 'tremor-endgame', ['endgame'], 1, 1500),
  challenge(1, 'halls-constructs', ['construct'], 60, 2500),
  challenge(1, 'halls-elites', ['elite'], 10, 1500),
  challenge(1, 'halls-make', ['make', 'loot'], 30, 1000),
  challenge(1, 'halls-world', ['world', 'quest', 'bounty'], 6, 1500),
  challenge(1, 'halls-endgame', ['endgame'], 3, 2000),
  challenge(2, 'heart-constructs', ['construct'], 100, 3000),
  challenge(2, 'heart-foes', ['foe', 'undead', 'daedra', 'elite', 'construct'], 300, 2000),
  challenge(2, 'heart-sea', ['sea', 'gather'], 40, 1000),
  challenge(2, 'heart-world', ['world', 'quest', 'bounty'], 8, 1500),
  challenge(2, 'heart-endgame', ['endgame'], 5, 2500),
]);
export const passChallengeOf = (/** @type {unknown} */ key) => PASS_CHALLENGES.find((c) => c.key === key) ?? null;

// ═══ THE TRACKS AND THEIR REWARDS ════════════════════════════════════════════════════════════════════════════════════
/** A reward's grant is `<kind>:<key>` - a title, a glyph, a profile icon, an aura or an effect (net/effectLaw.js `kill`,
 *  `portal`, `mount`), each the account's from the level it is reached on its track. */
const reward = (/** @type {number} */ level, /** @type {string} */ track, /** @type {string} */ grant) => Object.freeze({ level, track, grant });
/** SEASON ONE'S TRACK: the free track every registered account plays; the premium track the Premium Pass (or the
 *  Deluxe) opens, its rewards reached before the purchase given at once. */
export const PASS_REWARDS = Object.freeze({
  s1: Object.freeze([
    reward(1, 'free', 'icon:centurion'),
    reward(1, 'premium', 'icon:aetherium'),
    reward(5, 'premium', 'glyph:tonalfork'),
    reward(10, 'free', 'title:brassbound'),
    reward(10, 'premium', 'icon:lexicon'),
    reward(15, 'premium', 'title:tonalarchitect'),
    reward(20, 'free', 'glyph:cog'),
    reward(20, 'premium', 'icon:spider'),
    reward(25, 'premium', 'kill:tonal'),
    reward(30, 'free', 'icon:sphere'),
    reward(30, 'premium', 'icon:colossus'),
    reward(35, 'premium', 'title:brasswright'),
    reward(40, 'free', 'title:tremorborn'),
    reward(40, 'premium', 'portal:brass'),
    reward(45, 'premium', 'icon:gearheart'),
    reward(50, 'free', 'icon:numidium'),
    reward(50, 'premium', 'aura:aetherium'),
    reward(50, 'premium', 'title:heartwaker'),
  ]),
});
/** THE DELUXE PASS'S OWN, given at once on its purchase beside the premium track (the brief: "Optional cosmetic rewards
 *  unlocked immediately"), and the levels it gives. */
export const PASS_DELUXE = Object.freeze({
  s1: Object.freeze({ grants: Object.freeze(['aura:aetheriumgilded', 'mount:automaton', 'title:numidiumecho']), levels: 5 }),
});
/** THE PASS'S WARES, by season (net/shopLaw.js sells them): the Premium Pass, the Deluxe, and the three boosters - a
 *  booster's share of every find's experience for the season (the highest held counts, never their sum) and the levels it
 *  gives at once. */
export const PASS_WARES = Object.freeze({
  s1: Object.freeze({ premium: 'pass:s1premium', deluxe: 'pass:s1deluxe' }),
});
export const PASS_BOOSTS = Object.freeze({
  'boost:s1cog': Object.freeze({ season: 's1', mult: 1.25, levels: 0 }),
  'boost:s1tonal': Object.freeze({ season: 's1', mult: 1.5, levels: 3 }),
  'boost:s1heart': Object.freeze({ season: 's1', mult: 2, levels: 8 }),
});
/** The levels a ware gives at once (a Deluxe Pass, a booster), as experience - 0 for every other ware. */
export function passWareXp(/** @type {unknown} */ id) {
  const b = typeof id === 'string' && Object.hasOwn(PASS_BOOSTS, id) ? PASS_BOOSTS[/** @type {keyof typeof PASS_BOOSTS} */ (id)] : null;
  if (b) return b.levels * PASS_XP_PER_LEVEL;
  for (const [s, w] of Object.entries(PASS_WARES)) if (w.deluxe === id) return (PASS_DELUXE[/** @type {keyof typeof PASS_DELUXE} */ (s)]?.levels ?? 0) * PASS_XP_PER_LEVEL;
  return 0;
}
/** The season a pass ware or a booster is of, or null. */
export function passWareSeason(/** @type {unknown} */ id) {
  if (typeof id === 'string' && Object.hasOwn(PASS_BOOSTS, id)) return PASS_BOOSTS[/** @type {keyof typeof PASS_BOOSTS} */ (id)].season;
  for (const [s, w] of Object.entries(PASS_WARES)) if (w.premium === id || w.deluxe === id) return s;
  return null;
}
/** The tracks an account plays in a season, by the wares it holds (`held`, ware ids): the free track, the premium track
 *  with either pass, the deluxe's own with the Deluxe. Pure. */
export function passTracks(/** @type {string} */ season, /** @type {ReadonlyArray<string>} */ held) {
  const w = PASS_WARES[/** @type {keyof typeof PASS_WARES} */ (season)];
  const deluxe = !!w && held.includes(w.deluxe);
  return { free: true, premium: deluxe || (!!w && held.includes(w.premium)), deluxe };
}
/** The booster's share an account's finds get in a season: the highest of the boosters it holds, 1 with none. Pure. */
export function passMult(/** @type {string} */ season, /** @type {ReadonlyArray<string>} */ held) {
  let m = 1;
  for (const [id, b] of Object.entries(PASS_BOOSTS)) if (b.season === season && held.includes(id)) m = Math.max(m, b.mult);
  return m;
}
/** A find's experience: the source's base under what is left of the day's bound, and the booster's share of that base on
 *  top. `{ base, bonus }`. Pure. */
export function passFindXp(/** @type {string} */ source, /** @type {number} */ dayXp, /** @type {number} */ mult) {
  if (!isPassSource(source)) return { base: 0, bonus: 0 };
  const left = Math.max(0, PASS_DAY_XP - Math.max(0, Number(dayXp) || 0));
  const base = Math.min(PASS_SOURCES[/** @type {keyof typeof PASS_SOURCES} */ (source)], left);
  return { base, bonus: Math.floor(base * (Math.max(1, Number(mult) || 1) - 1)) };
}
/** EVERY GRANT A SEASON GIVES an account: the rewards of each track it plays up to the level it reached, and the Deluxe's
 *  own - each `<kind>:<key>`, in the track's order. `xp` the season's experience. Pure. */
export function passGrants(/** @type {string} */ season, /** @type {unknown} */ xp, /** @type {ReadonlyArray<string>} */ held, /** @type {number} */ nowMs) {
  const s = passSeasonById(season);
  if (!s) return [];
  const lv = passLevelOf(xp, s, nowMs), tr = passTracks(season, held);
  const out = (PASS_REWARDS[/** @type {keyof typeof PASS_REWARDS} */ (season)] ?? []).filter((r) => r.level <= lv && (r.track === 'free' || (r.track === 'premium' && tr.premium))).map((r) => r.grant);
  if (tr.deluxe) out.push(...(PASS_DELUXE[/** @type {keyof typeof PASS_DELUXE} */ (season)]?.grants ?? []));
  return [...new Set(out)];
}
/** The keys of one kind (`title`, `glyph`, `icon`, `aura`, `kill`, `portal`, `mount`) every season gives an account -
 *  `seasons` its `{ [season]: xp }`. Pure. */
export function passKeysOf(/** @type {Record<string, unknown>} */ seasons, /** @type {ReadonlyArray<string>} */ held, /** @type {string} */ kind, /** @type {number} */ nowMs) {
  const out = [];
  for (const s of PASS_SEASONS) for (const g of passGrants(s.id, seasons?.[s.id], held, nowMs)) {
    const i = g.indexOf(':');
    if (g.slice(0, i) === kind && !out.includes(g.slice(i + 1))) out.push(g.slice(i + 1));
  }
  return out;
}
/** Every grant the pass gives, in any season and track - the keys a vocabulary must hold (pinned). */
export const PASS_ALL_GRANTS = Object.freeze([...new Set([
  ...Object.values(PASS_REWARDS).flatMap((rs) => rs.map((r) => r.grant)),
  ...Object.values(PASS_DELUXE).flatMap((d) => d.grants),
])]);

/**
 * THE PASS'S CARD as the account read carries it (`/v1/account`'s `pass`, server-account/src/battlePass.js passOf),
 * checked on the way in: the season shown, whether finds are asked, the open stage, the account's experience, level and
 * the open top, its tracks and booster, today's experience, and each challenge's count. Null for anything else. Pure.
 * @param {any} c
 */
export function passCardOf(c) {
  const season = c && typeof c === 'object' ? passSeasonById(c.season) : null;
  if (!season) return null;
  const whole = (/** @type {unknown} */ v, /** @type {number} */ max) => (Number.isSafeInteger(v) && /** @type {number} */ (v) >= 0 && /** @type {number} */ (v) <= max ? /** @type {number} */ (v) : 0);
  const rows = Array.isArray(c.challenges) ? c.challenges : [];
  return {
    season: season.id, open: c.open === true,
    stage: Number.isInteger(c.stage) && c.stage >= -1 && c.stage < season.stages.length ? c.stage : -1,
    xp: whole(c.xp, PASS_LEVELS * PASS_XP_PER_LEVEL * 10), level: whole(c.level, PASS_LEVELS), top: whole(c.top, PASS_LEVELS),
    tracks: { free: true, premium: c.tracks?.premium === true || c.tracks?.deluxe === true, deluxe: c.tracks?.deluxe === true },
    mult: Number.isFinite(c.mult) && c.mult >= 1 && c.mult <= 4 ? c.mult : 1,
    today: whole(c.today, PASS_DAY_XP * 4), dayMax: PASS_DAY_XP,
    challenges: PASS_CHALLENGES.map((k) => { const g = rows.find((/** @type {any} */ x) => x?.key === k.key); return { key: k.key, n: Math.min(whole(g?.n, 1e6), k.n), paid: g?.paid === true }; }),
  };
}
