// THE FACTION REPUTATION STORE - the player's LIVE clone of FACTION.TXT.
// 1:1 translation of Daggerfall Unity's PersistentFactionData.cs (MIT,
// Daggerfall Workshop / Hazelnut) - the reputation, flag and power half.
// Unity plumbing dropped; the laws, constants and quirks kept.
//
// WHY THIS IS THE FOUNDATION AND NOT A DETAIL. The port has carried
// TWO reputation channels for a while - the per-region LegalRep the
// court runs on, and the social-group reputations the talk reaction
// reads - and NEITHER is per-FACTION reputation. Three sites were
// already parked waiting on this one: court.js's halved People-faction
// delta on a crime, biography.js's `rf` answers (which the reader
// parses correctly and then has nowhere to put), and every guild rank,
// because Guild.GetReputation IS playerEntity.FactionData.GetReputation.
//
// ── the propagation law (ChangeReputation :390-438) ────────────────
// A propagating change is not one write, it is a walk:
//   1. ALLIES take +amount/2 and ENEMIES -amount/2, all three slots
//      each, BEFORE anything else - and non-propagating, so they do
//      not fan out again.
//   2. Then the faction's own hierarchy. A KNIGHTLY ORDER (ggroup 9)
//      takes its own change flat and hands a PROPAGATING change to
//      Generic Knightly Order (844) - DFU's comment calls classic's
//      omission of the generic children an assumed bug and fixes it.
//   3. Everything else walks UP to its root - treating the Dark
//      Brotherhood (108) as a root even though it has a parent - and
//      propagates back DOWN over that root's children.
//   4. If the ROOT is type God (1) - the root, not the faction the
//      change started at - Generic Temple (450) takes a propagating
//      change too.
//
// TERMINATION IS DATA, NOT STRUCTURE. Step 4 re-enters with
// propagate=true, so it only terminates because Generic Temple's own
// type is 9 rather than God: if 450 were type God it would walk to
// itself forever. Same shape in step 2 - 844's ggroup is 17
// (HolyOrder), not 9, so it does not re-enter the knightly branch.
// DFU has no cycle guard and neither does this; the corpus test pins
// that the real FACTION.TXT actually terminates, and bounds the call
// count so a mutation that breaks it FAILS rather than hangs.
//
// ── integer division ──────────────────────────────────────────────
// `amount / 2` is C# int division: it truncates TOWARD ZERO, so
// -5 / 2 is -2, not -3. Math.floor would drift on every negative
// half-delta - a crime penalty, an enemy's share of a reward - so
// every halving here is Math.trunc.
import { GUILD_GROUPS, FACTION_TYPES } from '../formats/factionFile.js';
import { restoreFactionRep } from './save.js';   // AUDIT 23 C1: the stashed-load replay

/** Mathf.Clamp bounds (:32-35). */
export const MIN_REPUTATION = -100;
export const MAX_REPUTATION = 100;
export const MIN_POWER = 1;
export const MAX_POWER = 100;

/** FactionFile.Flags (:629-633) - the only two DFU names. */
export const FACTION_FLAGS = Object.freeze({ RulerImmune: 0x10, Summoned: 0x40 });

/** The faction ids the law names by hand (FactionFile.FactionIDs). */
export const THE_THIEVES_GUILD = 42;   // FactionFile.cs:91
export const THE_DARK_BROTHERHOOD = 108;
export const GENERIC_TEMPLE = 450;
export const GENERIC_KNIGHTLY_ORDER = 844;

/** questorIds (:37-38) - the six guild QUESTOR npcs, from
 *  GuildNpcServices. A questor takes the FULL delta inside a
 *  propagating walk where its siblings take half. */
export const QUESTOR_IDS = Object.freeze(new Set([
  63,   // MG_Quests
  851,  // FG_Quests
  804,  // TG_Quests
  807,  // DB_Quests
  240,  // T_Quests
  846,  // KO_Quests
]));

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
/** C# int division - toward zero, NOT Math.floor. See the header. */
const half = (n) => Math.trunc(n / 2);

/** PersistentFactionData.Reset (:319-335): the player's live faction
 *  data is FACTION.TXT, fresh.
 *
 *  DEPARTURE (Ledger A): DFU assigns the reader's dictionary straight
 *  across, because C# FactionData is a STRUCT - `factionDict[id]`
 *  hands back a copy and the writes go through an explicit write-back.
 *  JS objects are references, so assigning across would let a
 *  reputation change reach into the shared reader and corrupt every
 *  later load. This CLONES each record AND its children array. Same
 *  semantics, and the only way to get them. */
export function createFactionRep(factionDict) {
  const dict = new Map();
  // The spread detaches the RECORD; `children` is an array and would
  // still be shared, so the reader's own hierarchy could be mutated
  // through the store. AUDIT 20 found the header promising a clone
  // that was only one level deep.
  for (const [id, f] of factionDict) dict.set(id, { ...f, children: f.children ? [...f.children] : f.children });
  return { dict };
}

/** GetReputation (:356-367). An unknown faction reads 0 - it does not
 *  throw and does not create the entry. */
export function getReputation(store, factionID) {
  const f = store.dict.get(factionID);
  return f ? f.rep : 0;
}

/** SetReputation (:370-384). False when the faction is unknown. */
export function setReputation(store, factionID, value) {
  const f = store.dict.get(factionID);
  if (!f) return false;
  f.rep = clamp(value, MIN_REPUTATION, MAX_REPUTATION);
  return true;
}

/** ChangeReputation (:390-438). `propagate` is the whole difference
 *  between a note and a walk - see the header. */
export function changeReputation(store, factionID, amount, propagate = false) {
  const f = store.dict.get(factionID);
  if (!f) return false;

  if (!propagate) {
    f.rep = clamp(f.rep + amount, MIN_REPUTATION, MAX_REPUTATION);
    return true;
  }

  // 1. allies and enemies FIRST, and flat - they do not fan out again.
  const allies = [f.ally1, f.ally2, f.ally3];
  const enemies = [f.enemy1, f.enemy2, f.enemy3];
  for (let i = 0; i < 3; i++) {
    changeReputation(store, allies[i], half(amount));
    changeReputation(store, enemies[i], half(-amount));
  }

  if (f.ggroup === GUILD_GROUPS.KnightlyOrder) {
    // 2. the order itself flat, the generic order propagating. DFU
    // adds the second call deliberately - classic skips the generic
    // children, which its comment calls an assumed bug.
    changeReputation(store, factionID, amount, false);
    changeReputation(store, GENERIC_KNIGHTLY_ORDER, amount, true);
    return true;
  }

  // 3. up to the root. The Dark Brotherhood HAS a parent (356) and is
  // still treated as a root - the check is on the CURRENT node's id,
  // tested before each step up.
  let root = f;
  while (store.dict.has(root.parent) && root.id !== THE_DARK_BROTHERHOOD) {
    root = store.dict.get(root.parent);
  }

  if (root.children) propagateReputationChange(store, root, factionID, amount);
  else changeReputation(store, factionID, amount);

  // 4. the ROOT's type decides the temple hop, not the faction the
  // change started at.
  if (root.type === FACTION_TYPES.God) {
    changeReputation(store, GENERIC_TEMPLE, amount, true);
  }
  return true;
}

/** PropagateReputationChange (:448-459). Down the tree from a root:
 *  the faction the change STARTED at, any root parent, and a questor
 *  npc take the full amount; every other node in the hierarchy takes
 *  half. */
export function propagateReputationChange(store, faction, factionID, amount) {
  const full = faction.id === factionID || faction.parent === 0 || QUESTOR_IDS.has(faction.id);
  changeReputation(store, faction.id, full ? amount : half(amount));
  if (faction.children) {
    for (const id of faction.children) {
      const child = store.dict.get(id);
      if (child) propagateReputationChange(store, child, factionID, amount);
    }
  }
}

/** ZeroAllReputations (:463-476): faction reputations reset FROM
 *  FACTION.TXT (not merely zeroed - a faction whose file value is
 *  non-zero returns to that), and every region's LegalRep to 0. */
export function zeroAllReputations(store, factionDict, player) {
  // REFILL, do not rebind. Rebinding store.dict strands any caller
  // that captured it - court.js reads store.dict on every crime - and
  // there is no reason to hand back a different Map (AUDIT 20).
  const fresh = createFactionRep(factionDict);
  store.dict.clear();
  for (const [id, f] of fresh.dict) store.dict.set(id, f);
  // DFU walks player.RegionData[i].LegalRep. The port has no such
  // array - court.js's changeLegalRep mints `player.legalRep` as an
  // object KEYED BY REGION INDEX, created lazily on the first crime.
  // Same law, the port's own shape; a live probe caught this reading
  // the DFU field name and zeroing nothing.
  const legal = player?.legalRep;
  if (legal) for (const k of Object.keys(legal)) legal[k] = 0;
}

/** THE ATTACH SEAM. Builds the player's store and immediately drains
 *  whatever the biography parked.
 *
 *  biography.js reads `rf` answers correctly - 136 of them across the
 *  files - but cannot apply one, because it runs before FACTION.TXT is
 *  in hand. So it parks {id, amount} on the entity and this drains
 *  them, PROPAGATING, which is what BiogFile.cs:339 does:
 *      playerEntity.FactionData.ChangeReputation(id, amount, true)
 *  Draining is idempotent - the pending list is cleared - so a second
 *  call cannot double-apply a backstory. */
export function attachFactionRep(entity, factionDict) {
  if (!entity || !factionDict) return null;
  const store = createFactionRep(factionDict);
  entity.factionRep = store;
  // AUDIT 23 C1: a save restored BEFORE the store existed (the menu
  // LOAD GAME path) parked its faction columns on the entity; replay
  // them onto the fresh store first, then drain any pending deltas -
  // the stash IS the saved state, the pending list is deltas captured
  // un-applied at save time.
  if (entity.savedFactionRep) {
    restoreFactionRep(store, entity.savedFactionRep);
    delete entity.savedFactionRep;
  }
  const pending = entity.pendingFactionRep;
  if (pending?.length) {
    for (const { id, amount } of pending) changeReputation(store, id, amount, true);
    entity.pendingFactionRep = [];
  }
  return store;
}

/** THE ONE CONSTRUCTION SEAM, fifth occurrence (U23). DFU's
 *  PlayerEntity is CONSTRUCTED with its FactionData - the field is
 *  initialised inline (PlayerEntity.cs:65, `protected
 *  PersistentFactionData factionData = new PersistentFactionData()`),
 *  so there is no moment in DFU where a player exists without one. The
 *  port's pre-chargen stand-in entity (characters/playerEntity.js) has
 *  no store until finishChargen or applyHeadlessChargen attaches one,
 *  so a host reached without chargen - ?play, a probe, a save loaded
 *  into a fresh tab - handed every reputation reader a null and it
 *  threw on `store.dict`. The U23 guild popup found it live.
 *
 *  RECORDED, and no gap at this site: the guard below IS the answer,
 *  the idempotent front door - attach if absent, return what is there
 *  otherwise. It does NOT re-drain the biography (attachFactionRep
 *  already clears the pending list), and it cannot invent a store
 *  without FACTION.TXT - a caller with no dictionary gets null and must
 *  say so rather than pretend the reputation is zero. The stand-in
 *  entity's own stand-in columns are flagged where they live, at
 *  characters/playerEntity.js:5/:20/:27, and are that file's to retire. */
export function ensureFactionRep(entity, factionDict) {
  if (!entity) return null;
  return entity.factionRep ?? attachFactionRep(entity, factionDict);
}

/** GetFlag (:480-488) - a missing faction reads false. */
export function getFlag(store, factionID, flag) {
  const f = store.dict.get(factionID);
  return f ? (f.flags & flag) > 0 : false;
}

/** SetFlag (:490-501) - OR only; DFU never clears one. */
export function setFlag(store, factionID, flag) {
  const f = store.dict.get(factionID);
  if (!f) return false;
  f.flags |= flag;
  return true;
}

/** ChangePower (:509-521). Note the floor is 1, not 0. */
export function changePower(store, factionID, amount) {
  const f = store.dict.get(factionID);
  if (!f) return false;
  f.power = clamp(f.power + amount, MIN_POWER, MAX_POWER);
  return true;
}
