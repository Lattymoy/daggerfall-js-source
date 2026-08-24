// X4: PlayerGPS's NEARBY OBJECTS list (PlayerGPS.cs:105-123, :347-357,
// :530-550, :747-836, MIT Daggerfall Workshop) - the low-frequency
// scan of everything alive or lootable around the player, and the
// flag query every detection/affinity system in DFU reads.
//
// This module is the PRODUCER three ported laws were already waiting
// on, each shipped with no feed:
//   - the three Detect effects (39,0/39,1/39,2), whose whole body is
//     one GetNearbyObjects call per magic round;
//   - mysticism.dispelNearby, which had no caller in src/ at all -
//     DispelUndead/DispelDaedra are GetNearbyObjects(Undead|Daedra)
//     scans (DispelUndead.cs:50, DispelDaedra.cs:50);
//   - enchantments' nearbyFoes dep, declared in its header as
//     "PlayerGPS.GetNearbyObjects - the affinity classifier lives
//     HERE off ENEMY_BASICS" and supplied by ONE of the four hosts.
//
// THE LAWS, verbatim:
//
//  1. The list is REBUILT WHOLE on a timer, not queried live:
//     refreshNearbyObjectsInterval = 0.33 s (:39), ticked from Update
//     (:352-356). GetNearbyObjects' own docstring is explicit -
//     "does not trigger a scene search, this only searches
//     pre-populated list of nearby objects which is updated at low
//     frequency" (:532-533). A detector therefore reads a snapshot
//     that can be up to a third of a second stale, and that staleness
//     is the design, not an artifact.
//
//  2. The rebuild walks enemy behaviours CONCAT civilian mobile
//     behaviours, then loot (:751-775) - three pools, one list, each
//     record { ref, distance, flags }.
//
//  3. GetEntityFlags (:779-819): an EnemyClass/EnemyMonster takes the
//     Enemy bit PLUS exactly one group bit off its enemy group
//     (Undead/Daedra/Humanoid/Animal); a CivilianNPC takes Humanoid
//     ALONE and never Enemy - so a town wanderer is a Detect Enemy
//     miss and a BadReactionsFrom humanoid hit at the same time.
//
//  4. The MAGIC bit is set for ANY entity carrying at least one live
//     effect (:814-817), with DFU's own comment attached: "Not
//     completely sure what conditions should flag entity for detect
//     magic. Currently just assuming entity has active effects." That
//     is an acknowledged approximation in DFU itself, carried here
//     verbatim rather than improved - including its consequence, that
//     a buffed friendly civilian lights up Detect Magic.
//
//  5. GetLootFlags (:822-836): the Treasure bit iff the container
//     holds at least one item - an EMPTY pile is not treasure. DFU
//     leaves two questions in the code here ("Are any other
//     conditions required? Should corpse loot container be filtered
//     out?"); the answer today is no filter, so a lootable corpse
//     reads as treasure.
//
//  6. The query (:538-550) is an ALL-BITS match - `(no.flags & flags)
//     == flags`, not an any-bits test. Asking for Undead|Daedra would
//     find nothing, because no entity carries both group bits. Range
//     is STRICT `distance < maxRange`, default 14, and DFU flags the
//     number itself: "Not matched to classic range at this time."
//     A None query answers null, not an empty list.
//
// The module is PURE: hosts adapt their own pools into the record
// shape below, so one law serves all four rather than four hosts
// each growing their own scan (which is how the port ended up with
// world.js's lone nearbyFoes using an INCLUSIVE `<= range` where DFU
// is strict).

/** PlayerGPS.NearbyObjectFlags (:112-123), verbatim. */
export const NEARBY = Object.freeze({
  None: 0,
  Enemy: 1,
  Treasure: 2,
  Magic: 4,
  Undead: 8,
  Daedra: 16,
  Humanoid: 32,
  Animal: 64,
});

export const REFRESH_NEARBY_OBJECTS_INTERVAL = 0.33;   // :39
// GetNearbyObjects' default maxRange (:538). DFU's own note: "Not
// matched to classic range at this time" - a recorded approximation.
export const NEARBY_DEFAULT_MAX_RANGE = 14;

// FormulaHelper.GetEnemyEntityEnemyGroup (:2746-2806) - the group
// classifier, a hardcoded CareerIndex switch. It is NOT the port's
// ENEMY_BASICS `affinity` field, which is a DIFFERENT nine-value
// classification (Human/Darkness/Undead/Daylight/Animal/Daedra/
// Golem/Water/None) serving PotentVs and the item affinity arms.
// Reaching for `affinity` here would misgroup half the bestiary -
// every Darkness/Daylight/Golem/Water enemy would silently take no
// group bit, and the four careers DFU deliberately regroups below
// would take the wrong one. Monster mobileType IS MonsterCareers
// (EntityEnums.cs:120-166), so these are the indexes verbatim.
//
// The trailing comments are DFU's own, marking the five careers
// where DFU DEPARTS from classic's grouping - kept because they are
// the reason the table cannot be derived from anything else.
const ENEMY_GROUP_BIT = Object.freeze({
  // Animals
  0: NEARBY.Animal,    // Rat
  3: NEARBY.Animal,    // GiantBat
  4: NEARBY.Animal,    // GrizzlyBear
  5: NEARBY.Animal,    // SabertoothTiger
  6: NEARBY.Animal,    // Spider
  11: NEARBY.Animal,   // Slaughterfish
  20: NEARBY.Animal,   // GiantScorpion
  34: NEARBY.Animal,   // Dragonling
  39: NEARBY.Animal,   // Horse_Invalid          (grouped as UNDEAD in classic)
  40: NEARBY.Animal,   // Dragonling_Alternate   (grouped as UNDEAD in classic)
  // Humanoid
  1: NEARBY.Humanoid,  // Imp
  2: NEARBY.Humanoid,  // Spriggan
  7: NEARBY.Humanoid,  // Orc
  8: NEARBY.Humanoid,  // Centaur
  9: NEARBY.Humanoid,  // Werewolf
  10: NEARBY.Humanoid, // Nymph
  12: NEARBY.Humanoid, // OrcSergeant
  13: NEARBY.Humanoid, // Harpy
  14: NEARBY.Humanoid, // Wereboar
  16: NEARBY.Humanoid, // Giant
  21: NEARBY.Humanoid, // OrcShaman
  22: NEARBY.Humanoid, // Gargoyle
  24: NEARBY.Humanoid, // OrcWarlord
  41: NEARBY.Humanoid, // Dreugh                 (grouped as UNDEAD in classic)
  42: NEARBY.Humanoid, // Lamia                  (grouped as UNDEAD in classic)
  // Undead
  15: NEARBY.Undead,   // SkeletalWarrior
  17: NEARBY.Undead,   // Zombie                 (grouped as ANIMAL in classic)
  18: NEARBY.Undead,   // Ghost
  19: NEARBY.Undead,   // Mummy
  23: NEARBY.Undead,   // Wraith
  28: NEARBY.Undead,   // Vampire
  30: NEARBY.Undead,   // VampireAncient
  32: NEARBY.Undead,   // Lich
  33: NEARBY.Undead,   // AncientLich
  // Daedra
  25: NEARBY.Daedra,   // FrostDaedra
  26: NEARBY.Daedra,   // FireDaedra
  27: NEARBY.Daedra,   // Daedroth
  29: NEARBY.Daedra,   // DaedraSeducer
  31: NEARBY.Daedra,   // DaedraLord
  // The four ATRONACHS return EnemyGroups.None EXPLICITLY (:2797-2801)
  // rather than falling to the default - DFU spells them out, so they
  // are spelled out here. 35 FireAtronach, 36 IronAtronach,
  // 37 FleshAtronach, 38 IceAtronach: no group bit.
});

/** FormulaHelper.GetEnemyEntityEnemyGroup as a plain lookup - the
 *  group BIT for a mobile id, or NEARBY.None for a class enemy and
 *  the four atronachs. X8's Pacify family reads this rather than
 *  re-transcribing the career switch: DFU's PacifyEffect matches on
 *  exactly this enum (PacifyEffect.cs:131-132), so the two must not
 *  be allowed to drift apart. */
export const enemyGroupOf = (mobileType) => ENEMY_GROUP_BIT[mobileType] ?? NEARBY.None;

/** GetEntityFlags (:779-819).
 *  rec = { mobileType, civilian?, effectCount? }.
 *  A CIVILIAN takes Humanoid alone - never Enemy, and never a group
 *  bit (DFU's civilian branch is an `else if` that skips the
 *  enemy-group switch entirely).
 *
 *  A CLASS enemy (mobileType >= 128 - bandits, mages, every human
 *  career) is absent from the group switch, so it falls to the
 *  default and takes the Enemy bit with NO group bit. That is DFU
 *  behaviour, not an omission: a human bandit is invisible to a
 *  Humanoid scan while a Nymph is not. */
export function entityFlags(rec) {
  if (!rec) return NEARBY.None;
  let result = NEARBY.None;
  if (rec.civilian) {
    result |= NEARBY.Humanoid;
  } else {
    result |= NEARBY.Enemy;
    result |= ENEMY_GROUP_BIT[rec.mobileType] ?? 0;
  }
  // The Magic bit: DFU's acknowledged approximation - ANY live effect.
  if ((rec.effectCount ?? 0) > 0) result |= NEARBY.Magic;
  return result;
}

/** GetLootFlags (:822-836): non-empty containers only. */
export function lootFlags(rec) {
  if (!rec) return NEARBY.None;
  return (rec.itemCount ?? 0) > 0 ? NEARBY.Treasure : NEARBY.None;
}

const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** UpdateNearbyObjects (:747-776): clear, then entities (enemies
 *  CONCAT civilians) then loot, each measured from the player's
 *  position at THIS rebuild. Records keep their host `ref` so a
 *  consumer can act on the thing itself (dispel destroys it, the
 *  compass reads its position, VampiricEffect drains it). */
export function updateNearbyObjects(playerPos, { entities = [], loot = [] } = {}) {
  const out = [];
  for (const rec of entities) {
    if (!rec?.pos) continue;
    out.push({
      ref: rec.ref ?? rec,
      pos: [rec.pos[0], rec.pos[1], rec.pos[2]],
      distance: dist3(playerPos, rec.pos),
      flags: entityFlags(rec),
      active: rec.active !== false,
    });
  }
  for (const rec of loot) {
    if (!rec?.pos) continue;
    out.push({
      ref: rec.ref ?? rec,
      pos: [rec.pos[0], rec.pos[1], rec.pos[2]],
      distance: dist3(playerPos, rec.pos),
      flags: lootFlags(rec),
      active: rec.active !== false,
    });
  }
  return out;
}

/** GetNearbyObjects (:538-550), verbatim including its three quirks:
 *  a None query answers NULL rather than an empty list; the flag test
 *  is ALL-BITS (`(flags & want) == want`), so a multi-bit query wants
 *  every bit; and the range test is STRICT. */
export function getNearbyObjects(list, flags, maxRange = NEARBY_DEFAULT_MAX_RANGE, activeInHierarchy = true) {
  if (flags === NEARBY.None) return null;
  return (list ?? []).filter((no) =>
    (no.flags & flags) === flags
    && no.distance < maxRange
    && no.active === activeInHierarchy);
}

/** The 0.33 s rebuild timer (:352-356), as a tiny stateful pump a
 *  host frame can drive. `rebuild` is called with no arguments and
 *  answers the new list. The timer resets to 0 on fire - it does NOT
 *  subtract the interval, so a long frame does not bank a second
 *  rebuild (DFU's `nearbyObjectsUpdateTimer = 0`, :356). */
export function createNearbyScan(rebuild) {
  let timer = 0;
  let list = [];
  return {
    get list() { return list; },
    tick(dt) {
      timer += dt;
      if (timer > REFRESH_NEARBY_OBJECTS_INTERVAL) {
        list = rebuild() ?? [];
        timer = 0;
      }
      return list;
    },
    /** A scene change must not carry the previous scene's objects. */
    reset() { timer = 0; list = []; },
  };
}

// ── the bridge from a live Detect effect to the scan ──────────────

/** The three Detect effects' BUFF_KINDS names -> the flag each scans
 *  with (DetectMagic.cs:69, DetectEnemy.cs:69, DetectTreasure.cs:69).
 *  Kept here rather than in effects.js: effects.js knows only that
 *  three duration buffs exist, which is all DFU's effect classes do
 *  beyond holding a list. */
export const DETECT_KIND_FLAG = Object.freeze({
  detectMagic: NEARBY.Magic,
  detectEnemy: NEARBY.Enemy,
  detectTreasure: NEARBY.Treasure,
});

/** HUDCompass.DrawTrackedObjects (:198-217) flattened: every live
 *  detector contributes its own GetNearbyObjects result, and the
 *  compass walks the detectors OUTSIDE and the objects inside.
 *
 *  Two consequences of that nesting are kept rather than tidied:
 *  an object matched by TWO live Detect spells is emitted TWICE (DFU
 *  draws two markers exactly on top of each other), and a detector
 *  whose scan is empty contributes nothing rather than blocking the
 *  others. An ENDED entry is skipped - DFU's HasEnded test, which is
 *  also what expires it off registeredDetectors.
 *
 *  Answers the marker positions as [x, z] pairs, which is all the
 *  compass consumes. */
export function detectedMarkers(entity, list) {
  const out = [];
  for (const a of entity?.activeEffects ?? []) {
    if (a.ended) continue;
    const flag = DETECT_KIND_FLAG[a.kind];
    if (flag == null) continue;
    for (const no of getNearbyObjects(list, flag) ?? []) out.push([no.pos[0], no.pos[2]]);
  }
  return out;
}

// TWO DFU DEFECTS THIS SHAPE AVOIDS, recorded so the divergence is
// deliberate rather than accidental. DFU's compass keeps its own
// `registeredDetectors` LIST, pushed by Start and popped by End:
//   - a duplicate cast pushes a SECOND detector which the manager then
//     discards as a like-kind merge - and nothing ever deregisters it,
//     so the list grows for the rest of the session;
//   - there is no Resume() override, so a Detect spell that survives a
//     save/load keeps counting down but never re-registers, and shows
//     no markers for the remainder of its duration.
// Neither can happen here because there IS no separate registry: the
// entity's own activeEffects list is the registry, so a recast merges
// into the incumbent by the same law every other buff uses, and a
// restored entry is a live detector the moment it is read back. The
// port is closer to the effect's INTENT than DFU's own bookkeeping;
// where that is a behaviour difference a player could notice, it is
// this one, and it favours the port.

/** Is any Detect effect live? The hosts' gate for doing the scan at
 *  all - DFU keeps its nearby list warm for every system that reads
 *  it, but the port has only these consumers so far, and a scan
 *  nothing reads is pure per-frame cost. */
export const hasLiveDetector = (entity) =>
  (entity?.activeEffects ?? []).some((a) => !a.ended && DETECT_KIND_FLAG[a.kind] != null);
