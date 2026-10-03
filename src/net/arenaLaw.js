// @ts-check
// ARENA4 (2026-10-02, Mac: "Players can choose to watch AI fights, player fights, join a team (red and blue) and climb
// esclating tiers of opponents, or choose to matchmake for a real opponent to take on in real time"; "Being the #1 pvp
// arena player comes with it's own temporary title/glyph"): THE ARENA ONLINE, AS LAW - what the relay, the account
// service and the game all read the same way. Design: bible/11-Multiplayer/Arena.md "7. Online".
//
//   THE ROOMS     `arena:hall` (the queue, the offers, the list of live bouts), `arena:b<16 hex>` (one bout's floor:
//                 its fighters, its spectators, the relay's referee and, on the ladder, its AI fighters) and (ARENA4b)
//                 `arena:x<hour>` (the hour's exhibition - two of the relay's fighters and the stands).
//   THE SEASON    eight weeks of wall time from a Monday (`arenaSeasonOf`) - Seats-Arc 9.1's planned seasons.
//   THE RATING    Elo, 1,000 to start, K 32 (`eloAfter`), a season's own.
//   THE QUEUE     paired by rating inside a band that widens every 10 s (`matchBand`, `pairQueue`); a pair is offered a
//                 bout both accept in 20 s.
//   THE REFEREE   PVP-REF (Seats-Arc 6.1, built here): the relay holds every fighter's vitality (300 + 2 x Renown level in
//                 a bout between players - flat on purpose), checks a blow's reach against the striker's own pose, its
//                 rate, its damage against DFU's weapon table at its material (doubled for a critical, never more) and a
//                 damage bucket; a spell at most 3 damaging casts in 5 s, each 60 at most.
//   THE LADDER    the account's climb (one row a bout won, in order), its AI fighters run by the relay from a table the
//                 game's own ladder is pinned against (`ARENA_LADDER_SPEC`, `ARENA_BEASTS`).
//   THE TEAMS     the Red and the Blue Banner, a season's points (`ARENA_TEAM_POINTS`), the laurel to last season's
//                 winner.
//
// PURE - no clock, no dice of its own, no I/O; every end hands those in. It imports nothing.
//
// Not a DFU member (Daggerfall has no arena and no other players). Ledger A (ARENA).

// ── THE ROOMS ─────────────────────────────────────────────────────────────────────────────────
/** The hall: the matchmaking queue, the offers, the list of bouts to watch. */
export const ARENA_HALL = 'arena:hall';
/** A bout's id - 16 hex, the relay's CSPRNG for a bout it mints, the client's own for a ladder bout it opens. */
export const ARENA_BOUT_ID_RE = /^[0-9a-f]{16}$/;
/** A bout's room key. */
export const ARENA_BOUT_ROOM_RE = /^arena:b[0-9a-f]{16}$/;
export const isArenaHall = (key) => key === ARENA_HALL;
export const isArenaBoutRoom = (key) => ARENA_BOUT_ROOM_RE.test(String(key ?? ''));
/** ARENA4b (Arena.md 2: "Exhibition - online: yes - the relay runs it, every client sees one bout"): THE HOUR'S
 *  EXHIBITION'S ROOM, `arena:x<hour>` - the game hour since the epoch (systems/arenaLadder.js hourIndexOf) on the shared
 *  clock, so every screen near the colosseum names one room and the relay runs one bout in it (net/arenaExhibition.js). */
export const ARENA_EX_ROOM_RE = /^arena:x(0|[1-9]\d{0,8})$/;
export const isArenaExhibitionRoom = (key) => ARENA_EX_ROOM_RE.test(String(key ?? ''));
export const arenaExhibitionRoom = (hour) => `arena:x${Math.max(0, Math.floor(Number(hour) || 0))}`;
/** The hour out of an exhibition room's key, or null. */
export const arenaExhibitionHourOf = (key) => { const m = ARENA_EX_ROOM_RE.exec(String(key ?? '')); return m ? Number(m[1]) : null; };
/** A room the bout law stands on - a bout's or the hour's exhibition's: its sand holds the fighters alone, its stands
 *  every other socket (no body drawn, no pose fanned). */
export const isArenaFloorRoom = (key) => isArenaBoutRoom(key) || isArenaExhibitionRoom(key);
/** Any arena room - the Worker opens an object for these and no other `arena:` key. */
export const isArenaRoom = (key) => isArenaHall(key) || isArenaFloorRoom(key);
export const arenaBoutRoom = (id) => `arena:b${id}`;
/** The bout's id out of its room's key, or null. */
export const arenaBoutIdOf = (key) => (isArenaBoutRoom(key) ? String(key).slice(7) : null);
/** ARENA4b: the room a floor's instance stands in, by the bout it was entered for - a bout's id (`arena:b<id>`) or an
 *  exhibition's `x<hour>` (`arena:x<hour>`); null for anything else. */
export const arenaFloorRoomOf = (o) => (ARENA_BOUT_ID_RE.test(String(o ?? '')) ? arenaBoutRoom(o) : isArenaExhibitionRoom(`arena:${o}`) ? `arena:${o}` : null);

// ── THE SEASON ────────────────────────────────────────────────────────────────────────────────
/** The first season's first second: Monday 2026-09-28 00:00 UTC. */
export const ARENA_SEASON_EPOCH_S = 1_790_553_600;
/** A season: eight weeks (Arena.md 3 - "8 weeks online, matching Seats-Arc 9.1's planned seasons"). */
export const ARENA_SEASON_S = 8 * 7 * 24 * 3600;
/** The season holding `nowS` (1 the first; nothing before the epoch is earlier than the first). */
export const arenaSeasonOf = (nowS) => Math.max(1, Math.floor((Math.floor(Number(nowS) || 0) - ARENA_SEASON_EPOCH_S) / ARENA_SEASON_S) + 1);
/** When a season ends (its last second's successor), epoch seconds. */
export const arenaSeasonEndsS = (season) => ARENA_SEASON_EPOCH_S + Math.max(1, Math.floor(season)) * ARENA_SEASON_S;
/** A season's day, 1-based (1..56). */
export const arenaSeasonDay = (nowS) => Math.floor(((Math.floor(Number(nowS) || 0) - ARENA_SEASON_EPOCH_S) % ARENA_SEASON_S + ARENA_SEASON_S) % ARENA_SEASON_S / 86400) + 1;

// ── THE RATING ────────────────────────────────────────────────────────────────────────────────
export const ARENA_ELO_START = 1000;
export const ARENA_ELO_K = 32;
/** The rating's floor - nobody's falls under it. */
export const ARENA_ELO_MIN = 100;
/** The rating's bound on the wire and in a token. */
export const ARENA_ELO_MAX = 4000;
/** The chance A beats B, by their ratings. Pure. */
export const eloExpected = (ra, rb) => 1 / (1 + 10 ** ((rb - ra) / 400));
/**
 * BOTH RATINGS AFTER A BOUT: `score` A's - 1 won, 0 lost, 0.5 a draw. One change, A's gain B's loss (the sum is kept),
 * rounded to the whole point, neither under the floor. Pure.
 * @returns {[number, number]}
 */
export function eloAfter(ra, rb, score) {
  const d = Math.round(ARENA_ELO_K * (score - eloExpected(ra, rb)));
  return [Math.max(ARENA_ELO_MIN, ra + d), Math.max(ARENA_ELO_MIN, rb - d)];
}
/** A rating as a claim or a column holds it: a whole number in bounds, the start for anything else. */
export const arenaRatingOk = (r) => (Number.isSafeInteger(r) && r >= ARENA_ELO_MIN && r <= ARENA_ELO_MAX ? r : ARENA_ELO_START);

// ── THE QUEUE ─────────────────────────────────────────────────────────────────────────────────
/** The band a fighter is matched inside, by how long they have waited: 100 points either way, widened by 100 every
 *  10 s (Arena.md 7: "the band widening every 10 s"), to the whole scale. */
export const MATCH_BAND_START = 100;
export const MATCH_BAND_STEP = 100;
export const MATCH_WIDEN_MS = 10_000;
export const MATCH_BAND_MAX = ARENA_ELO_MAX;
/** An offered bout waits this long for both to accept (Arena.md 7: "both accept in 20 s"). */
export const MATCH_ACCEPT_MS = 20_000;
/** The most fighters the hall's queue holds. */
export const MATCH_QUEUE_MAX = 256;
/** A pair that one of them declined (or let lapse) is not offered again for this long. */
export const MATCH_REPAIR_MS = 60_000;
/** A fighter's band after `waitMs` in the queue. Pure. */
export const matchBand = (waitMs) => Math.min(MATCH_BAND_MAX, MATCH_BAND_START + MATCH_BAND_STEP * Math.floor(Math.max(0, Number(waitMs) || 0) / MATCH_WIDEN_MS));
/**
 * THE PAIRS the queue makes now: oldest first, each with the nearest rating that both bands admit (|a - b| inside the
 * narrower of the two), never a fighter twice, never a fighter with themselves, never a pair `apart(a, b)` says not to
 * offer again yet - and ARENA4b: like with like, a casual bout's seeker (`casual`) only with another (Arena.md 7: "A
 * casual bout (unranked) may run"), so nobody sent to a rated bout meets one who asked for none. `queue`
 * `[{ sub, rating, at, casual? }]`. Pure.
 * @param {ReadonlyArray<{ sub: string, rating: number, at: number, casual?: boolean }>} queue
 * @param {number} now
 * @param {(a: string, b: string) => boolean} [apart]
 * @returns {Array<[any, any]>}
 */
export function pairQueue(queue, now, apart = () => false) {
  const list = [...queue].sort((x, y) => x.at - y.at || (x.sub < y.sub ? -1 : 1));
  const taken = new Set();
  const out = [];
  for (const a of list) {
    if (taken.has(a.sub)) continue;
    let best = null, gap = Infinity;
    for (const b of list) {
      if (b === a || b.sub === a.sub || taken.has(b.sub) || apart(a.sub, b.sub) || !!a.casual !== !!b.casual) continue;
      const d = Math.abs(a.rating - b.rating);
      if (d > Math.min(matchBand(now - a.at), matchBand(now - b.at))) continue;
      if (d < gap || (d === gap && best && b.at < best.at)) { best = b; gap = d; }
    }
    if (!best) continue;
    taken.add(a.sub); taken.add(best.sub);
    out.push([a, best]);
  }
  return out;
}

// ── THE TEAMS ─────────────────────────────────────────────────────────────────────────────────
export const ARENA_BANNERS = Object.freeze(['red', 'blue']);
/** ARENA4b: A FIGHTER'S BANNER AS A WORD CLAIMS IT - 'red' or 'blue', or null for none and for anything else (a word is
 *  never refused over a pennant). COSMETIC ONLY: the relay bills it beside the name (the hall's offers, the bouts to
 *  watch) so a rival's and a watched fighter's pennant shows; no point is counted off it - the account service counts a
 *  banner's points off its own `arena_members` row (server-account/src/arena.js), never a word. The token does not sign
 *  the banner, so the word's claim is all the relay has to bill. Pure. */
export const bannerClaim = (b) => (ARENA_BANNERS.includes(b) ? b : null);
/** ARENA4b: the hour's exhibition's banners by side (Arena.md 3, ARENA3's exhibition): side 0 the Red's fighter, side 1
 *  the Blue's - the relay's two billed so on the list to watch. */
export const ARENA_EX_BANNERS = Object.freeze(['red', 'blue']);
/** A season's team points (systems/arenaLeague.js TEAM_POINTS, pinned, and Arena.md 3's refereed PvP win, two). */
export const ARENA_TEAM_POINTS = Object.freeze({ bout: 1, champion: 3, grand: 10, pvp: 2 });

// ── THE LADDER ────────────────────────────────────────────────────────────────────────────────
export const ARENA_TIERS = 10;
/** A tier's bouts before its champion; the champion is bout BOUTS (3). */
export const ARENA_TIER_BOUTS = 3;
/**
 * THE TEN TIERS' OPPONENTS as the relay fights them: each tier's three bouts and its champion, a bout a list of
 * `[mobile, level|null]` (null - a monster at its own). systems/arenaLadder.js LADDER_TIERS row for row - pinned, so the
 * relay and the game cannot come to fight two ladders. The Grand Melee's bouts are every fighter for themselves
 * (`ARENA_FREE_TIER`); the beast tier is `ARENA_BEAST_TIER`.
 */
export const ARENA_LADDER_SPEC = Object.freeze([
  [[[138, 1]], [[136, 2]], [[143, 3]], [[143, 3]]],
  [[[144, 3]], [[140, 4]], [[141, 5]], [[145, 5]]],
  [[[129, 5]], [[133, 6]], [[142, 7]], [[130, 7]]],
  [[[145, 7]], [[143, 8]], [[132, 9]], [[139, 9]]],
  [[[130, 9]], [[131, 10]], [[144, 11]], [[144, 11], [144, 11]]],
  [[[4, null]], [[5, null]], [[20, null]], [[2, null]]],
  [[[145, 13]], [[129, 14]], [[133, 15]], [[24, null]]],
  [[[139, 15]], [[130, 16]], [[140, 17]], [[29, null]]],
  [[[145, 17], [132, 17]], [[144, 18], [128, 18]], [[145, 19], [128, 19]], [[28, null]]],
  [[[145, 20], [144, 20], [132, 20]], [[139, 21], [130, 21], [140, 21]], [[28, null], [29, null], [24, null]], [[36, null]]],
].map((t) => Object.freeze(t.map((b) => Object.freeze(b.map((o) => Object.freeze(o)))))));
export const ARENA_FREE_TIER = 9;
export const ARENA_BEAST_TIER = 5;
/** The monsters the ladder fights, as DFU's EnemyBasics has them: `[level, minHealth, maxHealth, minDamage, maxDamage]`
 *  (characters/enemyBasics.js, pinned). */
export const ARENA_BEASTS = Object.freeze({
  2: Object.freeze([3, 12, 26, 1, 8]), 4: Object.freeze([4, 13, 34, 1, 8]), 5: Object.freeze([4, 13, 34, 1, 10]),
  20: Object.freeze([12, 18, 74, 15, 25]), 24: Object.freeze([16, 20, 90, 5, 50]), 28: Object.freeze([19, 28, 154, 20, 50]),
  29: Object.freeze([19, 27, 146, 15, 50]), 36: Object.freeze([16, 25, 130, 5, 15]),
});
/** A class fighter on the relay: its health 10 + 8 a level (DFU's RollEnemyClassMaxHealth at a 15-point career's mean),
 *  its blow 1 + level/4 to 6 + level (a weapon's range and the level's strength). */
export const CLASS_HP_BASE = 10;
export const CLASS_HP_PER_LEVEL = 8;
/** One AI fighter's body as the relay runs it. Pure. */
export function arenaFoeStats(mobile, level) {
  const beast = ARENA_BEASTS[mobile] ?? null;
  if (beast) {
    const [lv, minH, maxH, minD, maxD] = beast;
    return { mobile, level: lv, hp: Math.round((minH + maxH) / 2), dmg: [minD, maxD], speed: 3.6, every: 1300, windup: 350, reach: 2.4, beast: true };
  }
  const lv = Math.max(1, Math.floor(level ?? 1));
  return { mobile, level: lv, hp: CLASS_HP_BASE + CLASS_HP_PER_LEVEL * lv, dmg: [1 + Math.floor(lv / 4), 6 + lv], speed: 3.2, every: 1500, windup: 450, reach: 2.3, beast: false };
}
/** The bout `bout` (0..2, 3 the champion) of `tier` (0..9): its opponents' bodies, and whether it is every fighter for
 *  themselves (the Grand Melee's three bouts - not its champion). Null for no such bout. Pure. */
export function arenaLadderBout(tier, bout) {
  const t = ARENA_LADDER_SPEC[tier];
  const list = t?.[bout];
  if (!list) return null;
  return { tier, bout, champion: bout === ARENA_TIER_BOUTS, grand: bout === ARENA_TIER_BOUTS && tier === ARENA_TIERS - 1, free: tier === ARENA_FREE_TIER && bout < ARENA_TIER_BOUTS, foes: list.map(([m, l]) => arenaFoeStats(m, l)) };
}
/** A ladder bout's key: `tier * 4 + bout` (0..39) - the climb's one order. */
export const ladderKey = (tier, bout) => tier * (ARENA_TIER_BOUTS + 1) + bout;
/**
 * THE ACCOUNT'S LADDER from its rows (the bouts it won - `[{ tier, bout }]` - and its record), in the save ladder's own
 * shape (systems/arenaLadder.js newArenaLadder), so the window and the Herald read the online climb as they read the
 * offline one: the tier it fights in, the bouts won in it, the champions beaten, the Grand Champion. Only the climb in
 * order counts - a row past the first gap is not a step (the service never writes one). Pure.
 */
export function arenaLadderOf(won, record = {}) {
  const have = new Set((won ?? []).map((r) => ladderKey(r.tier, r.bout)));
  let k = 0;
  while (k < ARENA_TIERS * (ARENA_TIER_BOUTS + 1) && have.has(k)) k++;
  const grand = k >= ARENA_TIERS * (ARENA_TIER_BOUTS + 1);
  const tier = grand ? ARENA_TIERS - 1 : Math.floor(k / (ARENA_TIER_BOUTS + 1));
  const champs = Array.from({ length: ARENA_TIERS }, (_, i) => have.has(ladderKey(i, ARENA_TIER_BOUTS)) && ladderKey(i, ARENA_TIER_BOUTS) < k);
  const int = (v) => (Number.isSafeInteger(v) && v > 0 ? v : 0);
  return {
    v: 1, tier, won: grand ? ARENA_TIER_BOUTS : k % (ARENA_TIER_BOUTS + 1), champs, grand,
    record: { wins: int(record.wins), losses: int(record.losses), yields: int(record.yields), falls: int(record.falls), ringouts: int(record.ringouts), purses: 0, streak: int(record.streak), best: int(record.best) },
  };
}
/** The account's next bout on its climb as `{ tier, bout }`, or null once the Grand Champion has fallen. Pure. */
export function arenaNextOf(won) {
  const L = arenaLadderOf(won);
  return L.grand ? null : { tier: L.tier, bout: L.won };
}

// ── THE REFEREE (PVP-REF) ─────────────────────────────────────────────────────────────────────
/** The Renown level a vitality reads (the token's `lv`), bounded. */
export const ARENA_LV_MIN = 1;
export const ARENA_LV_MAX = 60;
export const arenaLv = (lv) => Math.max(ARENA_LV_MIN, Math.min(ARENA_LV_MAX, Number.isFinite(lv) ? Math.floor(lv) : ARENA_LV_MIN));
/** A fighter's vitality in a bout between players: 300 + 2 x Renown level - Seats-Arc 6.1's normalised vitality, flat
 *  on purpose, so even a lie about the level buys a third more at most. */
export const pvpVitality = (lv) => 300 + 2 * arenaLv(lv);
/** ARENA4b: A LADDER FIGHTER'S VITALITY FROM A LEVEL - DFU's most at it (25 and 30 a level: systems/chargen.js
 *  rollMaxHealthLevel1's base and the steepest career's hit points a level - the bound ARENA4 held a claimed health to),
 *  bounded. The relay cannot see a career or an endurance (neither is signed), so every fighter of a level fights at the
 *  honest most of it: a lie about the health buys nothing, and nobody fights under what they could be. */
export const PVE_HP_MIN = 10;
export const PVE_HP_MAX = 2000;
export const ladderVitalityAt = (level) => Math.max(PVE_HP_MIN, Math.min(PVE_HP_MAX, 25 + 30 * Math.max(1, Math.floor(Number(level) || 1))));
/** ARENA4b: the signed character level's bounds (net/identityToken.js CHARACTER_LEVEL_MIN/MAX, pinned - written here so
 *  this law imports nothing). */
export const ARENA_CL_MIN = 1;
export const ARENA_CL_MAX = 1000;
/** ARENA4b: how far past a tier's own top level a claimed level is believed when no signed one rides the token (an old
 *  account service): a tier spans two or three levels, so five past its top is two tiers' climb - an honest fighter who
 *  out-levelled the mountain still fights near their own, and a forged level-sixty is no longer carried into the Pit.
 *  AUDIT PRE-MERGE 1003 S2: and a signed level alike (ladderVitality - the client writes the tile `cl` is read off). */
export const LADDER_LV_MARGIN = 5;
/** ARENA4b: the highest opponent level of a tier (a class fighter's own, a monster's DFU level - ARENA_BEASTS), plus the
 *  margin - the hard cap on a claimed level there. Pure. */
export function ladderLevelCap(tier) {
  let top = 1;
  for (const b of ARENA_LADDER_SPEC[tier] ?? []) for (const [m, l] of b) top = Math.max(top, l ?? ARENA_BEASTS[m]?.[0] ?? 1);
  return top + LADDER_LV_MARGIN;
}
/**
 * ARENA4b: A LADDER FIGHTER'S VITALITY, the relay's alone. The signed character level (`cl`, the account service's,
 * off the realm character - net/identityToken.js) is the level; a client's claimed health (the `in` word's `mh`) is read
 * by nothing. A token from a service before `cl` falls back to the claimed level. Pure.
 * AUDIT PRE-MERGE 1003 S2: EITHER LEVEL IS HELD TO THE TIER'S CAP (ladderLevelCap). The signature says whose the level
 * is, not that it is true: `cl` is the realm tile's summary `level`, which the client writes itself (the realm's create
 * and every checkpoint's summary, never read against the save) - a token signing a thousand fought the Pit at 2,000
 * health where the old token's claim was held to 265.
 */
export function ladderVitality(cl, lv, tier) {
  const level = Number.isSafeInteger(cl) && cl >= ARENA_CL_MIN && cl <= ARENA_CL_MAX ? cl : arenaLv(lv);
  return ladderVitalityAt(Math.min(level, ladderLevelCap(tier)));
}
/** The blows a fighter lands a second, at most (the gate's GATE_HIT_HZ_MAX shape). */
export const ARENA_HIT_HZ_MAX = 4;
/** A fighter's damage bucket: it refills at this a second and holds this much - a sustained fight is bounded by it,
 *  however a claim is dressed (Seats-Arc 6.1's "damage bucket"). */
export const ARENA_BUCKET_RATE = 40;
export const ARENA_BUCKET_DEPTH = 120;
/** How far a melee blow reaches (DFU's effective melee reach - combat/playerWeapon.js WEAPON_REACH) and the pose's slack;
 *  a shaft's reach. */
export const ARENA_MELEE_REACH = 2.5;
export const ARENA_POSE_SLACK = 3;
export const ARENA_BOW_REACH = 60;
/** The blow kinds on the wire (net/gateBrain.js HIT_KINDS' own). */
export const ARENA_HIT = Object.freeze({ Melee: 0, Shaft: 1, Spell: 2 });
/** Spells: at most this many damaging casts in this window, each at most this. */
export const ARENA_SPELLS_IN = 3;
export const ARENA_SPELL_WINDOW_MS = 5000;
export const ARENA_SPELL_MAX = 60;
/** The fastest a fighter moves (Seats-Arc 6.1's starting ceiling) and the slack: a pose further than this from the last
 *  good one is not believed (the referee measures reach from the last good pose). */
export const ARENA_SPEED_MAX = 12.5;
export const ARENA_SPEED_SLACK = 0.5;
/** DFU's CalculateWeaponMaxDamage, verbatim case groups, by template (characters/weapons.js, pinned). */
export const ARENA_WEAPON_MAX = Object.freeze({ 113: 6, 114: 8, 115: 8, 116: 8, 117: 10, 118: 12, 119: 12, 120: 16, 121: 16, 122: 18, 123: 21, 124: 12, 125: 14, 126: 18, 127: 12, 128: 16, 129: 16, 130: 18 });
/** DFU's weapon material modifier (combat/formulas.js WEAPON_MATERIAL_MODIFIER, pinned), by material 0..9. */
export const ARENA_MATERIAL_MOD = Object.freeze([-1, 0, 0, 1, 2, 3, 3, 4, 5, 6]);
/** A bare hand's most (CalculateHandToHandMaxDamage at a skill past 100, the softcap's 200) and the room a fighter's own
 *  modifiers (strength, enchantments) are given past a weapon's. */
export const ARENA_HAND_MAX = 41;
export const ARENA_MOD_MAX = 20;
/**
 * THE MOST ONE BLOW MAY BE: a weapon's DFU maximum at its material and the fighter's modifiers' room, doubled for a
 * critical; a bare hand's (or an unknown template's) likewise; a spell ARENA_SPELL_MAX. Pure.
 * @param {{ r: number, w?: number, m?: number }} blow
 */
export function arenaBlowCap({ r, w = -1, m = 0 }) {
  if (r === ARENA_HIT.Spell) return ARENA_SPELL_MAX;
  const wmax = ARENA_WEAPON_MAX[/** @type {any} */ (w)];
  const mat = Number.isInteger(m) && m >= 0 && m < ARENA_MATERIAL_MOD.length ? ARENA_MATERIAL_MOD[m] : 0;
  return 2 * ((wmax != null ? wmax + mat : ARENA_HAND_MAX) + ARENA_MOD_MAX);
}

// ── THE FLOOR ─────────────────────────────────────────────────────────────────────────────────
/** The floor's centre in the made level's frame (world/arenaFloor.js floorCentre, pinned) - the frame a bout room's poses
 *  are in - and the ring (RING_R). */
export const ARENA_FLOOR_CENTRE = Object.freeze([50.625, 0.245, 42.975]);
export const ARENA_RING_R = 14;
/** Where each side of a bout between players stands on the sand, [x, z] from the centre - west and east. */
export const ARENA_PVP_MARKS = Object.freeze([Object.freeze([-6, 0]), Object.freeze([6, 0])]);

// ── THE BOUT ROOM ─────────────────────────────────────────────────────────────────────────────
/** The owner a relay-run fighter's puppet stands under on the client (scenes/dungeonContext.js's own lane): a blow on it
 *  is the referee's (`onArenaHit`), never a peer's. */
export const ARENA_PUPPET_OWNER = 'arena-relay';
/** The most who may watch a bout (Arena.md 7: "up to 60"). */
export const ARENA_SPECTATORS_MAX = 60;
/** A fighter of a matched bout who has not come to the sand in this long voids it. */
export const ARENA_JOIN_WAIT_MS = 45_000;
/** A fighter gone from a live bout this long forfeits it. */
export const ARENA_GONE_MS = 15_000;
/** The room's beat, ms (net/gateBrain.js BRAIN_TICK_MS's own). */
export const ARENA_TICK_MS = 250;
/** A spectator's cheer or boo: one every this long, ms. */
export const ARENA_CHEER_MS = 1500;
/** A finished bout's room keeps its result (and its receipts for a reconnect) this long. */
export const ARENA_KEEP_MS = 10 * 60_000;
/** A rated pair's bouts a day the account service counts (the duel's 'pair' bound's shape). */
export const ARENA_PAIR_DAY_MAX = 5;
/** The #1 of the season's board must have fought this many rated bouts to wear the laurel. */
export const ARENA_CHAMPION_MIN_BOUTS = 3;
/** The bouts a hall lists to watch. */
export const ARENA_LIVE_MAX = 24;
/** Why a bout ended, on the wire (systems/arenaBout.js's endings, and the relay's own: a forfeit, a void). */
export const ARENA_HOW = Object.freeze(['yield', 'fall', 'ringout', 'judges', 'forfeit']);
/** ARENA4b: a bout's kinds on the wire - between players, the ladder, and the hour's exhibition (two of the relay's own). */
export const ARENA_KINDS = Object.freeze(['pvp', 'pve', 'ex']);
/** ARENA4b: the largest game hour an exhibition's word names (the room key's nine digits). */
export const ARENA_HOUR_MAX = 999_999_999;
/** ARENA4b: a finished exhibition's room keeps its verdict this long - a game day on the shared clock (two real hours),
 *  so the bookmaker of a screen that left before the verdict can still ask it (scenes/arenaOnline.js exhibitionVerdict). */
export const ARENA_EX_KEEP_MS = 2 * 3600_000;

// ── THE WIRE ──────────────────────────────────────────────────────────────────────────────────
const int = (v, lo, hi) => (Number.isInteger(v) && v >= lo && v <= hi ? v : null);
const num = (v, lim) => (typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= lim ? v : null);
const FID_RE = /^(p0|p1|a[0-3])$/;
/** A fighter's id in a bout room: `p0`/`p1` the players, `a0`..`a3` the relay's own. */
export const ARENA_FIGHTER_RE = FID_RE;
/** The client's words, by kind (its `k`). */
export const ARENA_IN_KINDS = Object.freeze(['q', 'x', 'y', 'n', 'ls', 'in', 'hit', 'yd', 'ch', 'out']);
/**
 * A CLIENT'S ARENA WORD, projected - or null for anything that is not one:
 *   hall:  q (the queue - `lv` my Renown level, ARENA4b: `b` my banner - bannerClaim, cosmetic), x (out of it), y / n
 *          (yes or no to offer `o`), ls (the live bouts)
 *   bout:  in (`r` 'f' to fight, 's' to watch; a ladder bout's opener names `tier` and `bout`, `lv` my level, ARENA4b:
 *          `b` my banner (bannerClaim - an unknown one dropped, never a refusal)
 *          and `mh` my whole health - ARENA4b: read by nothing now, the vitality is the signed level's, ladderVitality -
 *          kept on the wire for a build before it), hit (`i` whom, `d` the damage, `r` how - ARENA_HIT, `w` the weapon's
 *          template, `m` its material, `q` the blow's sequence), yd (I yield), ch (a spectator's `c` cheer 1 or boo -1),
 *          out (I leave)
 * @param {any} m
 */
export function validArenaIn(m) {
  if (!m || typeof m !== 'object' || !ARENA_IN_KINDS.includes(m.k)) return null;
  switch (m.k) {
    case 'q': return { k: 'q', ...(int(m.lv, 1, 999) != null ? { lv: m.lv } : {}), ...(bannerClaim(m.b) ? { b: m.b } : {}), ...(m.u === 1 ? { u: 1 } : {}) };   // ARENA4b: `u` a casual bout sought
    case 'x': case 'ls': case 'yd': case 'out': return { k: m.k };
    case 'y': case 'n': return typeof m.o === 'string' && ARENA_BOUT_ID_RE.test(m.o) ? { k: m.k, o: m.o } : null;
    case 'in': {
      if (m.r !== 'f' && m.r !== 's') return null;
      const out = { k: 'in', r: m.r };
      if (m.tier !== undefined || m.bout !== undefined) {
        if (int(m.tier, 0, ARENA_TIERS - 1) == null || int(m.bout, 0, ARENA_TIER_BOUTS) == null) return null;
        Object.assign(out, { tier: m.tier, bout: m.bout });
      }
      if (m.lv !== undefined) { if (int(m.lv, 1, 999) == null) return null; out.lv = m.lv; }
      if (m.mh !== undefined) { if (int(m.mh, 1, 99999) == null) return null; out.mh = m.mh; }
      if (bannerClaim(m.b)) out.b = m.b;   // ARENA4b: a ladder fighter's banner, billed on the list to watch
      return out;
    }
    case 'hit': {
      if (typeof m.i !== 'string' || !FID_RE.test(m.i)) return null;
      const d = num(m.d, 10000), r = int(m.r, 0, 2);
      if (d == null || d < 0 || r == null) return null;
      const out = { k: 'hit', i: m.i, d, r };
      if (m.w !== undefined) { if (int(m.w, -1, 9999) == null) return null; out.w = m.w; }
      if (m.m !== undefined) { if (int(m.m, 0, 15) == null) return null; out.m = m.m; }
      if (m.q !== undefined) { if (int(m.q, 0, 0x7fffffff) == null) return null; out.q = m.q; }
      return out;
    }
    case 'ch': return m.c === 1 || m.c === -1 ? { k: 'ch', c: m.c } : null;
    default: return null;
  }
}

/** The relay's words, by kind. */
export const ARENA_OUT_KINDS = Object.freeze(['qd', 'qx', 'of', 'go', 'live', 'st', 'ev', 'hp', 'mv', 'atk', 'blow', 'rc', 'cr', 'no', 'sp']);
/** A name on an arena word: the relay's own (the token's, a display name) - bounded and free of control characters. */
const nameOk = (s) => typeof s === 'string' && s.length >= 1 && s.length <= 40 && !/[\u0000-\u001f\u007f]/.test(s);
const bannerOk = (b) => b == null || ARENA_BANNERS.includes(b);
/** A fighter as the hall bills one: name, rating, title and banner (each optional but the name). */
function billOk(v) {
  if (!v || typeof v !== 'object' || !nameOk(v.n)) return null;
  const out = { n: v.n };
  if (v.r !== undefined) { if (int(v.r, 0, ARENA_ELO_MAX) == null) return null; out.r = v.r; }
  if (v.t !== undefined && v.t !== null) { if (typeof v.t !== 'string' || !/^[a-z]{1,24}$/.test(v.t)) return null; out.t = v.t; }
  if (v.b !== undefined && v.b !== null) { if (!bannerOk(v.b)) return null; out.b = v.b; }
  if (v.m !== undefined) { if (int(v.m, 0, 999) == null) return null; out.m = v.m; }
  return out;
}
/** A bout's fighter in a state word: `[id, name, side, hp, max, out, ai(0|1), mobile, temper(x100), home|'' , epithet|'']`. */
function stFighterOk(f) {
  if (!Array.isArray(f) || f.length !== 11) return null;
  const [id, n, side, hp, max, out, ai, mob, tmp, home, ep] = f;
  if (typeof id !== 'string' || !FID_RE.test(id) || !nameOk(n) || int(side, 0, 3) == null || int(hp, 0, 99999) == null || int(max, 1, 99999) == null) return null;
  if (!(out === '' || ARENA_HOW.includes(out)) || (ai !== 0 && ai !== 1) || int(mob, -1, 999) == null || int(tmp, 0, 100) == null) return null;
  if (typeof home !== 'string' || home.length > 40 || typeof ep !== 'string' || ep.length > 40) return null;
  return [id, n, side, hp, max, out, ai, mob, tmp, home, ep];
}
/** One law event as the relay says it (systems/arenaBout.js's events - their `k`, `at`, and the fields each carries). */
const EV_KINDS = Object.freeze(['call', 'crier', 'walk', 'count', 'fight', 'hit', 'crit', 'miss', 'knockdown', 'comeback', 'stall', 'flee', 'yield', 'fall', 'ringout', 'timeout', 'end', 'verdict', 'heal', 'done', 'cheer']);
function evOk(e) {
  if (!e || typeof e !== 'object' || !EV_KINDS.includes(e.k) || num(e.at, 1e15) == null) return null;
  const out = { k: e.k, at: e.at };
  if (e.a !== undefined) { if (typeof e.a !== 'string' || !FID_RE.test(e.a)) return null; out.a = e.a; }
  if (e.b !== undefined) { if (typeof e.b !== 'string' || !FID_RE.test(e.b)) return null; out.b = e.b; }
  if (e.dmg !== undefined) { if (int(e.dmg, 0, 99999) == null) return null; out.dmg = e.dmg; }
  if (e.n !== undefined) { if (int(e.n, -1, 3) == null) return null; out.n = e.n; }
  if (e.side !== undefined) { if (e.side !== null && int(e.side, 0, 3) == null) return null; out.side = e.side; }
  if (e.how !== undefined) { if (typeof e.how !== 'string' || e.how.length > 12) return null; out.how = e.how; }
  return out;
}
/**
 * A RELAY'S ARENA WORD, projected - or null:
 *   hall:  qd (queued: `n` waiting, `band`), qx (out of the queue: `m` why), of (an offer: `o` its id, `vs` the opponent
 *          billed, `until` its lapse on the relay's clock), go (the bout is on: `o` its id, `side`, `vs`), live (`l` the
 *          bouts to watch: `[{ o, kind, a, b, tier, sp, at }]` - ARENA4b: an exhibition's `kind` 'ex' with its hour `h`
 *          and its two billed by banner alone (`{ b }`, ARENA_EX_BANNERS), the relay knowing no names: every screen
 *          names its fighters off the hour). ARENA4b: a bill's `b` is the fighter's banner (bannerClaim - cosmetic)
 *   bout:  st (the whole bout: `o`, `kind` - 'pvp', 'pve' or (ARENA4b) 'ex' with its hour `h` - `ph` its phase, `pa` the
 *          phase's start, `fa` the fight's, `lim`, `tier`, `bout`,
 *          `f` its fighters, `me` my id or '', `sp` spectators, `res` the result), ev (`e` law events), hp (`h`
 *          `[[id, hp, max]]`), mv (`i` an AI fighter, its walk `x z tx tz v at`), atk (`i` its blow `at` landing at `x z`),
 *          blow (`i` struck player `to` for `d`), rc (`r` my receipt), cr (the crowd's `c` cheer or boo, `n` how many), no (`m` a
 *          refusal), sp (`n` spectators)
 * @param {any} m
 */
export function validArenaOut(m) {
  if (!m || typeof m !== 'object' || !ARENA_OUT_KINDS.includes(m.k)) return null;
  switch (m.k) {
    case 'qd': return int(m.n, 0, MATCH_QUEUE_MAX) != null && int(m.band, 0, MATCH_BAND_MAX) != null ? { k: 'qd', n: m.n, band: m.band } : null;
    case 'qx': case 'no': return typeof m.m === 'string' && m.m.length <= 80 ? { k: m.k, m: m.m } : null;
    case 'of': case 'go': {
      if (typeof m.o !== 'string' || !ARENA_BOUT_ID_RE.test(m.o)) return null;
      const vs = billOk(m.vs);
      if (!vs) return null;
      const u = m.u === 1 ? { u: 1 } : {};   // ARENA4b: a casual bout's offer and call say so
      if (m.k === 'of') return num(m.until, 1e15) != null ? { k: 'of', o: m.o, vs, until: m.until, ...u } : null;
      return int(m.side, 0, 1) != null ? { k: 'go', o: m.o, side: m.side, vs, ...u } : null;
    }
    case 'live': {
      if (!Array.isArray(m.l) || m.l.length > ARENA_LIVE_MAX) return null;
      const l = [];
      for (const b of m.l) {
        if (!b || typeof b.o !== 'string' || !ARENA_BOUT_ID_RE.test(b.o) || !ARENA_KINDS.includes(b.kind)) return null;
        // ARENA4b: an exhibition is billed by its hour alone; every other bout by its fighters
        const ex = b.kind === 'ex';
        if (ex && int(b.h, 0, ARENA_HOUR_MAX) == null) return null;
        // ARENA4b: an exhibition's two billed by their banners alone (the relay names nobody), an unknown one dropped
        const exBill = (v) => (bannerClaim(v?.b) ? { b: v.b } : null);
        const a = ex ? exBill(b.a) : billOk(b.a), z = ex ? exBill(b.b) : b.b ? billOk(b.b) : null;
        if ((!ex && !a) || (!ex && b.b && !z) || int(b.sp, 0, ARENA_SPECTATORS_MAX) == null || num(b.at, 1e15) == null) return null;
        if (b.tier !== undefined && int(b.tier, 0, ARENA_TIERS - 1) == null) return null;
        l.push({ o: b.o, kind: b.kind, ...(ex ? { h: b.h } : {}), ...(a ? { a } : {}), ...(z ? { b: z } : {}), ...(b.tier !== undefined ? { tier: b.tier } : {}), ...(b.u === 1 ? { u: 1 } : {}), sp: b.sp, at: b.at });
      }
      return { k: 'live', l };
    }
    case 'st': {
      if (typeof m.o !== 'string' || !ARENA_BOUT_ID_RE.test(m.o) || !ARENA_KINDS.includes(m.kind)) return null;
      if (m.kind === 'ex' && int(m.h, 0, ARENA_HOUR_MAX) == null) return null;   // ARENA4b: an exhibition says its hour
      const PH = ['wait', 'call', 'walk', 'count', 'fight', 'end', 'verdict', 'heal', 'done', 'void'];
      if (!PH.includes(m.ph) || num(m.pa, 1e15) == null || num(m.lim, 1e9) == null) return null;
      if (!Array.isArray(m.f) || m.f.length > 4) return null;
      const f = m.f.map(stFighterOk);
      if (f.some((x) => !x)) return null;
      if (typeof m.me !== 'string' || (m.me !== '' && !FID_RE.test(m.me))) return null;
      /** @type {any} */
      const out = { k: 'st', o: m.o, kind: m.kind, ph: m.ph, pa: m.pa, fa: num(m.fa, 1e15) ?? null, lim: m.lim, f, me: m.me, sp: int(m.sp, 0, ARENA_SPECTATORS_MAX) ?? 0, ...(m.kind === 'ex' ? { h: m.h } : {}), ...(m.kind === 'pvp' && m.u === 1 ? { u: 1 } : {}) };
      if (m.tier !== undefined) { if (int(m.tier, 0, ARENA_TIERS - 1) == null || int(m.bout, 0, ARENA_TIER_BOUTS) == null) return null; Object.assign(out, { tier: m.tier, bout: m.bout }); }
      if (m.res !== undefined && m.res !== null) {
        const r = m.res;
        if (!r || typeof r !== 'object' || (r.side !== null && int(r.side, 0, 3) == null) || typeof r.how !== 'string' || r.how.length > 12) return null;
        out.res = { side: r.side, how: r.how };
      }
      return out;
    }
    case 'ev': {
      if (!Array.isArray(m.e) || m.e.length > 64) return null;
      const e = m.e.map(evOk);
      return e.some((x) => !x) ? null : { k: 'ev', e };
    }
    case 'hp': {
      if (!Array.isArray(m.h) || m.h.length > 4) return null;
      const h = [];
      for (const t of m.h) {
        if (!Array.isArray(t) || t.length !== 3 || typeof t[0] !== 'string' || !FID_RE.test(t[0]) || int(t[1], 0, 99999) == null || int(t[2], 1, 99999) == null) return null;
        h.push([t[0], t[1], t[2]]);
      }
      return { k: 'hp', h };
    }
    case 'mv': {
      const v = [m.x, m.z, m.tx, m.tz].map((q) => num(q, 1e5));
      if (typeof m.i !== 'string' || !/^a[0-3]$/.test(m.i) || v.some((q) => q == null) || num(m.v, 50) == null || m.v < 0 || num(m.at, 1e15) == null) return null;
      return { k: 'mv', i: m.i, x: m.x, z: m.z, tx: m.tx, tz: m.tz, v: m.v, at: m.at };
    }
    case 'atk': {
      if (typeof m.i !== 'string' || !/^a[0-3]$/.test(m.i) || num(m.at, 1e15) == null || num(m.x, 1e5) == null || num(m.z, 1e5) == null) return null;
      if (typeof m.tg !== 'string' || !FID_RE.test(m.tg)) return null;
      return { k: 'atk', i: m.i, at: m.at, x: m.x, z: m.z, tg: m.tg };
    }
    case 'blow': return typeof m.i === 'string' && /^a[0-3]$/.test(m.i) && int(m.d, 0, 9999) != null && typeof m.to === 'string' && /^p[01]$/.test(m.to) ? { k: 'blow', i: m.i, d: m.d, to: m.to } : null;
    case 'rc': return typeof m.r === 'string' && m.r.length <= 640 ? { k: 'rc', r: m.r } : null;
    case 'cr': return (m.c === 1 || m.c === -1) && int(m.n, 1, ARENA_SPECTATORS_MAX) != null ? { k: 'cr', c: m.c, n: m.n } : null;
    case 'sp': return int(m.n, 0, ARENA_SPECTATORS_MAX) != null ? { k: 'sp', n: m.n } : null;
    default: return null;
  }
}

/** The relay's refusals, as the player reads them (`qx` and `no`). */
export const ARENA_NO_TEXT = Object.freeze({
  busy: 'You are already in a bout.',
  full: 'The hall is full - try again in a moment.',
  declined: 'Your opponent declined the bout. Back in the queue.',
  lapsed: 'The bout was not accepted in time.',
  left: 'You left the queue.',
  guest: 'Only a registered account fights a rated bout.',
  'no bout': 'That bout is over.',
  'seats full': 'The stands are full.',
  'not yours': 'That bout is not yours to fight.',
  void: 'The bout is void - a fighter never came to the sand.',
});
