// B1 (AUDIT 25 blocker 1): the HOST half of quest foe spawning.
//
// The quest machine has declared the spawn seams since Q3-iii -
// world.createFoeGameObjects(foe, count) and world.tryPlaceFoe(handle)
// (contract in systems/quest/machine.js) - and the placement law,
// PlaceFoeFreely, has sat fully ported in sceneMount.js with NO
// CALLER. This module is the wiring both foe pools share:
//
//   mintQuestFoeWave     - GameObjectHelper.CreateFoeGameObjects
//                          (GameObjectHelper.cs:1243-1305): mint
//                          `count` INACTIVE handles, one behaviour
//                          each, activation deferred to placement
//   bindQuestFoeHost     - the QuestResourceBehaviour host handle
//                          over a live pool foe (the `enemy` surface
//                          resourceBehaviour.js documents)
//   placeFoeEnv          - the placeFoeFreely env adapter over the
//                          port's collider ([x,y,z] arrays in, the
//                          law's {x,y,z} objects out)
//   questFoeGender       - the Foe resource's own 0.55-male humanoid
//                          gender (Foe.cs:290, rolled at construction
//                          and already ported in quest/foe.js), the
//                          same read sceneMount's marker stand uses
//
// DFU builds each enemy GameObject whole and inactive, then
// TryPlacement positions + activates one per machine tick. The port's
// foe build is async (textures), so a handle here is DATA until
// placement finds a spot; the pool's async build then stands the foe
// a beat later. A build that fails after placement (a missing
// CLASS*.CFG) logs loudly and the foe never appears - DFU's
// equivalent failure throws at mint. Recorded runtime difference.

import { QuestResourceBehaviour } from '../systems/quest/resourceBehaviour.js';
import { questNameIn } from '../systems/quest/machine.js';   // AUDIT CURSE-SYNC: IsProtectedQuest's name test, one home
import { applySpell } from '../systems/effects.js';
import { GENDERS } from '../characters/nameHelper.js';

export function questFoeGender(foe) { return foe.gender === GENDERS.Female ? 'female' : 'male'; }

/** CreateFoeGameObjects' mint loop (:1248-1305), data-side: one
 *  handle + one QuestResourceBehaviour per instance (AddComponent +
 *  AssignResource, :1276-1280), count clamped 1..8 (:1248 - foe.js
 *  clamps spawnCount at parse too; kept for direct callers).
 *  behaviour.start() waits for placement: the C# objects are
 *  SetActive(false), so Unity defers Start until activation. The
 *  resource's own questResourceBehaviour field couples in
 *  behaviour.update() ("coupling is otherwise lost"), so a wave of
 *  several instances ends owned by the last updated - C#'s shape. */
export function mintQuestFoeWave(machine, foe, count) {
  const total = Math.min(Math.max(count, 1), 8);
  const handles = [];
  for (let i = 0; i < total; i++) {
    const behaviour = new QuestResourceBehaviour(machine);
    behaviour.assignResource(foe);
    handles.push({ foe, behaviour });
  }
  return handles;
}

/** The behaviour's host handle over a live pool foe `f` (the pool
 *  record shape both pools share: { entity, ai, dead, corpse }).
 *  pool supplies: removeFoe(f) - Destroy(gameObject) (the isHidden
 *  teardown); zeroFoeHealth(f) - the DeathTrigger zeroing routed
 *  through the pool's own death door so corpse/loot/alert all run;
 *  spellsByIndex() + foeSinks(f) + rolls - the CastSpellQueue drain.
 *  Called at PLACEMENT (the activation moment), so behaviour.start()
 *  runs here - Unity defers Start on an inactive object. */
export function bindQuestFoeHost(f, behaviour, pool) {
  const host = {
    // Person hide/show only in core - no Foe caller reaches setActive
    // (behaviour.update tears a hidden Foe DOWN via destroy instead)
    setActive: () => {},
    destroy: () => pool.removeFoe(f),
    enemy: {
      get currentHealth() { return f.entity.health; },
      get maxHealth() { return f.entity.maxHealth; },
      setCurrentHealth: (n) => { if (n <= 0) pool.zeroFoeHealth(f); else f.entity.health = n; },
      setNonHostile: () => { if (f.ai) f.ai.isHostile = false; },
      // wave 31/32: every port entity runs the broker's magic rounds,
      // so the manager always stands - the queue never parks here
      hasEffectManager: () => true,
      /** CastSpellQueue's per-entry drain (QuestResourceBehaviour.cs:
       *  293-351): resolve the classic record and AssignBundle with
       *  BypassSavingThrows; the bundle's caster is the foe ITSELF
       *  (enemyEntityBehaviour), so casterLevel is the foe's level. A
       *  record the seam cannot resolve - custom keys included, the
       *  port has no custom effect registry - is skipped, never
       *  retried, C#'s own `continue`. */
      assignSpellBundle: (ref) => {
        if (ref?.customKey) return;
        const record = pool.spellsByIndex?.()?.get?.(ref?.classicId);
        if (!record) return;
        applySpell(record, f.entity.level ?? 1, f.entity, pool.foeSinks(f), pool.rolls ?? Math.random, null, { bypassSavingThrows: true });
      },
      // The port's corpse loot IS the entity's items (both pools'
      // takeLoot reads them), so the corpse and live arms of
      // AddItemQueue land in the one place and this stays false.
      hasCorpseLootContainer: () => false,
      addItemsToEntity: (items) => { if (items) (f.entity.items ??= []).push(...items); },
    },
  };
  f.questBehaviour = behaviour;
  behaviour.bindHost(host);
  behaviour.start();
  return host;
}

/** placeFoeFreely's env over the port collider. isOccupied(point,
 *  radius) is the host's entity term: characters are not in the
 *  collider's triangle soup (its own comment says so), where Unity's
 *  OverlapSphere sees their capsules - the caller supplies foe and
 *  player proximity. */
export function placeFoeEnv({ collider, playerFeet, playerYawRad, fovDegrees, rolls = Math.random, isOccupied = null }) {
  const toObj = (p) => ({ x: p[0], y: p[1], z: p[2] });
  return {
    playerPosition: toObj(playerFeet),
    playerYawRadians: playerYawRad,
    fovDegrees,
    rolls,
    raycast: (origin, dir, maxDist) => {
      const o = [origin.x, origin.y, origin.z];
      const d = [dir.x, dir.y, dir.z];
      const h = collider.raycastHit(o, d, maxDist);
      let dist = h.dist;
      let normal = h.normal;
      // THE ANALYTIC FLOOR IS GROUND TOO (the guards-run-in-place
      // class of bug): the exterior collider's terrain and town
      // surface live in heightAt, not in triangles, so the law's
      // straight-down floor probe found no ground anywhere in the
      // open and no exterior spot could ever place a foe. Same fix as
      // the motor's FallCheck.
      if (d[1] < -0.999 && Math.abs(d[0]) < 1e-6 && Math.abs(d[2]) < 1e-6) {
        const drop = o[1] - (collider.heightAt?.(o[0], o[2]) ?? -Infinity);
        if (drop >= 0 && drop <= maxDist && drop < dist) { dist = drop; normal = [0, 1, 0]; }
      }
      if (!Number.isFinite(dist) || dist > maxDist) return null;
      return {
        point: { x: o[0] + d[0] * dist, y: o[1] + d[1] * dist, z: o[2] + d[2] * dist },
        normal: normal ? { x: normal[0], y: normal[1], z: normal[2] } : { x: -d[0], y: -d[1], z: -d[2] },
        distance: dist,
      };
    },
    overlapSphere: (p, r) => collider.sphereOverlaps([p.x, p.y, p.z], r) || (isOccupied?.(p, r) ?? false),
  };
}

/** The occupancy term over a foe list + the player: DFU's
 *  OverlapSphere(0.65) catches character capsules; the port tests
 *  centre distance against the test radius + the capsule radius the
 *  pools stand foes at (~0.45). feetOf(f) answers a foe's [x,y,z]. */
export function entityOccupancy(feetOf, liveFoes, playerFeet) {
  const CAPSULE_R = 0.45;
  return (p, r) => {
    const hit = (feet, half = 0.9) => {   // REVIEW 2026-09-05: a foe's sphere sits at ITS capsule centre
      if (!feet) return false;
      const dx = feet[0] - p.x, dy = feet[1] + half - p.y, dz = feet[2] - p.z;
      return dx * dx + dy * dy + dz * dz < (r + CAPSULE_R) * (r + CAPSULE_R);
    };
    if (hit(playerFeet)) return true;
    for (const f of liveFoes()) if (!f.dead && hit(feetOf(f), (f.ai?.height ?? 1.8) / 2)) return true;
    return false;
  };
}

/** QUEST-WAVE (2026-09-26, SquidKamer, Warm Ashes - Ships' author: "ship encounters ... get jumped by everyone"):
 *  THE SPOTS A PLACEMENT HOLDS UNTIL ITS FOE LANDS, per scene (keyed by its collider). PlaceFoeFreely's OverlapSphere
 *  meets every placed foe's capsule (CreateFoe.cs:319-323 - Unity syncs a placed foe's transform before the next
 *  action's test, in the same tick), but a pool's stand is async here - the career, the texture - and its record joins
 *  the pool only after. So a wave placed in ONE machine tick (WAQ_SHIP_SMALLRAID's thirteen) saw none of its own and
 *  stood in a heap: every spot of a tick falls in the same two slivers of the view's edge. AUDIT 68 S21 held the loose
 *  foes' spots; every arm holds them here now, in one set a scene, so a quest wave, a loose foe and each other all
 *  see what is in flight. A held spot is a capsule centred on the point the law tested, released when the stand
 *  settles - by then its record stands in the pool. */
const _heldSpots = new WeakMap();
export function heldSpots(collider) {
  let set = _heldSpots.get(collider);
  if (!set) _heldSpots.set(collider, (set = new Set()));
  return set;
}
/** Hold `spot` while `stand()` runs its async chain; answers the stand's promise, the hold released either way. */
export function holdSpotWhile(collider, spot, stand) {
  const set = heldSpots(collider);
  const held = { ai: { feet: [spot.x, spot.y - 0.9, spot.z], height: 1.8 } };   // a capsule centred on the tested point
  set.add(held);
  const release = () => { set.delete(held); };
  let landing;
  try { landing = stand(); } catch (err) { release(); throw err; }
  return Promise.resolve(landing).finally(release);
}

/** QUEST-PARTY (2026-09-26, Mac: "Party shares them"). Online a quest stayed its player's own (Multiplayer.md's first
 *  lock): a party that shared one ran a copy each, and each copy stood its own foes that no one else saw - two players
 *  on the ship raid fought two raids. Now a quest SHARED with the party streams its foes to the party, a member stands
 *  them and fights them, and each member's own copy counts the injuries and the kills it sees; a receiver's copy
 *  stands no wave while the member who shared the quest stands within QUEST_SHARE_RADIUS (that copy stands it). Anyone
 *  outside the party never sees them, and a peer's blow and a quest foe's hunt reach only the party. */
export const QUEST_SHARE_RADIUS = 100;   // the camps' group (systems/campEncounters.js GROUP_ROLL_RADIUS)

/** QUEST-PARTY: the stream's word on quest foe `f` - { q, s } (the quest's name, the foe's symbol) while its quest is
 *  kept in step with the party and this player is partied; else null, and it stays this player's alone. */
export function questShareTag(machine, f, partied) {
  const b = f?.questBehaviour;
  if (!partied || !b || !machine) return null;
  const quest = machine.getQuest?.(b.questUID) ?? null;
  const s = b.targetSymbol?.name;
  if (!quest || quest.questTombstoned || typeof s !== 'string' || !machine.hasSharedQuestNamed?.(quest.questName)) return null;
  return { q: quest.questName, s };
}

/** CURSE-SYNC (2026-09-27, the bug-reports channel: "Monsters aren't syncing ... The ghost on daggerfall ... We all had
 *  to kill them ... And everyone had to kill thier ow[n]"). A WORLD QUEST'S FOES ARE THE WORLD'S. S0000977, the Curse of
 *  Daggerfall, is no player's story: the tutorial starts it for every character as it ends (_TUTOR__'s `_no_`: `start
 *  quest 977 977`, finished or declined), a main quest is never shared (systems/questShare.js), and at night in
 *  Daggerfall's streets it stands a wraith every 21 minutes and a ghost every 31, one time in two. As a quest's foes they
 *  rode nowhere (Multiplayer.md's first lock), so every player in the streets fought a haunting nobody else could see.
 *  They ride the cell as an encounter's do - their spawner's, everyone else's puppet, anyone's to strike and to be
 *  hunted by. Their quest holds them while their spawner does; a foe handed on (a door, a death) is its heir's plain
 *  foe, which no quest counts. So A QUEST JOINS THIS LIST ONLY IF NO TASK COUNTS ITS FOES - no `killed`, no `injured`,
 *  nothing but their Foe line and the actions that stand them (test/cursesync.test.js holds every entry to it). */
export const WORLD_QUESTS = Object.freeze(['S0000977']);

/** CURSE-SYNC: the name of the quest pool foe `f` stands for - its behaviour's quest as the behaviour resolved it, else
 *  by its uid; null for a foe of no quest. */
export function questNameOf(f) {
  const b = f?.questBehaviour;
  if (!b) return null;
  const quest = b.targetQuest ?? b.machine?.getQuest?.(b.questUID) ?? null;
  return typeof quest?.questName === 'string' ? quest.questName : null;
}

/** AUDIT CURSE-SYNC (the review's first and fourth findings): the answer, per behaviour, once its quest is known. A
 *  behaviour's quest never changes (its uid is stamped once), but the machine's table does - an ended quest leaves it a
 *  week on, a save's foe can stand before its quest is restored - and a foe whose answer flipped mid-fight would leave
 *  every other player's screen with no fall. Known once, it stays; not known yet, it is asked again. And the stream's gates
 *  read it several times a foe a frame: one lookup. */
const _worldOf = new WeakMap();
/** CURSE-SYNC: a world quest's foe - WORLD_QUESTS by name, as QuestMachine.IsProtectedQuest reads its own list. */
export function isWorldQuestFoe(f) {
  const b = f?.questBehaviour;
  if (!b) return false;
  let w = _worldOf.get(b);
  if (w === undefined) {
    const n = questNameOf(f);
    if (n == null) return false;
    w = questNameIn(WORLD_QUESTS, n);
    _worldOf.set(b, w);
  }
  return w;
}

/** CURSE-SYNC: a quest foe that is its player's alone (Multiplayer.md's first lock) - every quest's but a world quest's.
 *  The one word the stream's gates read: what rides, whose blow lands, whom it hunts, who takes it over. */
export const isPrivateQuestFoe = (f) => !!f?.questBehaviour && !isWorldQuestFoe(f);

/** QUEST-PARTY: this machine's own Foe for a partner's shared quest foe - the quest kept in step with the party, by
 *  name, and its Foe by symbol; null for a quest this player does not share. */
export function sharedQuestFoe(machine, tag) {
  if (!machine || !tag || !machine.hasSharedQuestNamed?.(tag.q)) return null;
  const quest = machine.sharedCandidateNamed?.(tag.q) ?? null;
  if (!quest) return null;
  for (const r of quest.resources.values()) if (r.isFoe && r.symbol?.name === tag.s) return r;
  return null;
}

/** QUEST-PARTY: whether the member who shared quest `questName` - still in my party - stands within `radius` of me:
 *  then that member's copy stands the quest's foes and mine stands none (a wave counts here as placed). */
export function partnerStandsQuestFoes({ questName, sharerOf, inMyParty, peers, accountOfPeer, myFeet, radius = QUEST_SHARE_RADIUS }) {
  const sharer = questName ? sharerOf(questName) : null;
  if (!sharer || !inMyParty(sharer) || !myFeet) return false;
  for (const p of peers ?? []) {
    if (!p || accountOfPeer(p.id) !== sharer || !Array.isArray(p.feet)) continue;
    const dx = p.feet[0] - myFeet[0], dz = p.feet[2] - myFeet[2];
    if (dx * dx + dz * dz <= radius * radius) return true;
  }
  return false;
}

/** QUEST-PARTY phase 2: a behaviour over this machine's own Foe for a partner's shared quest foe - what binds a foe
 *  this player takes over (an heir's, an orphan's) to its own copy of the quest; null for a quest it does not share. */
export function questBehaviourFor(machine, tag) {
  const foe = sharedQuestFoe(machine, tag);
  if (!foe) return null;
  const b = new QuestResourceBehaviour(machine);
  b.assignResource(foe);
  return b;
}

/** QUEST-PARTY phase 2: whether I take an orphaned quest foe (its owner gone without a handover) - I stand within
 *  `radius` of it and no party member within `radius` of it has a lower id: one member takes it, the one every member's
 *  view names alike. */
export function adoptsOrphanQuestFoe({ myId, myFeet, foeFeet, partyPeers, radius = QUEST_SHARE_RADIUS }) {
  if (myId == null || !myFeet || !foeFeet) return false;
  const near = (a) => { const dx = a[0] - foeFeet[0], dz = a[2] - foeFeet[2]; return dx * dx + dz * dz <= radius * radius; };
  if (!near(myFeet)) return false;
  const me = String(myId);
  for (const p of partyPeers ?? []) if (p?.id != null && Array.isArray(p.feet) && near(p.feet) && String(p.id) < me) return false;
  return true;
}

/** QUEST-POPUP-PAUSE (2026-09-26, SquidKamer on the Discord: a ship raid's box came up and the player "get[s] jumped
 *  by everyone"; Mac, asked: "Pause them offline"). DFU's message box pauses the game (UserInterfaceWindow
 *  .PauseWhileOpen), so a quest's box held every foe. WINFOE1 let the foes run under every window; offline they stand
 *  still again while the host's quest box is open and the window on top of its slot - a rest window keeps WINFOE1,
 *  and the rest under a box resumes with the foes. Online the room keeps one clock for everyone: nothing is held.
 *  Both outdoor hosts ask this (world.js, exterior.js), and hand the answer to the mode machine's interior pools. */
export const questBoxHoldsFoes = (win, { online, onTop }) => !online && !!win && !win.done && !!onTop(win);

/** AUDIT 63r F24 - SerializableEnemy.RestoreSaveData's quest-link arm
 *  (Serialization/SerializableEnemy.cs:206-217), the ONE home for it:
 *
 *      enemy.QuestSpawn = data.questSpawn;
 *      if (enemy.QuestSpawn) {
 *          var b = gameObject.AddComponent<QuestResourceBehaviour>();
 *          b.RestoreSaveData(data.questResource);
 *          if (b.QuestUID == 0 || b.TargetSymbol == null) {
 *              enemy.QuestSpawn = false; Destroy(b);
 *          }
 *      }
 *
 *  The foe POOLS carry no dependency on the quest machine, so the host
 *  that owns one hands this in as `restoreWorld`'s
 *  `reviveQuestBehaviour`. It lives here rather than in either host
 *  because BOTH need it - the interior pools (worldModes
 *  .restoreInteriorPools) and the exterior pool (world.js's load arm),
 *  which is the same law under a different WorldContext - and because
 *  bindQuestFoeHost, the mint-side half of the same link, is already
 *  here. Returns null for a record that names no quest, which is the
 *  Destroy: the foe stands plain.
 *
 *  @param machine the live QuestMachine, or null on a host without one
 *  @param data    the record's `questResource` (GetSaveData's object) */
export function reviveQuestBehaviour(machine, data) {
  if (!machine || !data) return null;
  const b = new QuestResourceBehaviour(machine);
  b.restoreSaveData(data);
  if (!b.questUID || b.targetSymbol == null) return null;   // :214-217 - QuestSpawn = false; Destroy(questResourceBehaviour)
  return b;
}
