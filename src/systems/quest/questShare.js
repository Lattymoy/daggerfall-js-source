// QUEST SHARING — OURS, not DFU's: there are no parties in Daggerfall
// Unity, so there is no "share this quest" law to port. This is new
// ground, built entirely on machinery that DOES already exist and is
// already correct: Quest.getSaveData()/restoreSaveData() (the same
// envelope a save file carries), QuestListsManager's catalog rows (the
// same membership/minReq/oneTime gates the guild counter already
// enforces), and systems/guild/guilds.js's membership readers.
//
// THE SHAPE: the sender captures one quest's save-data envelope
// (machine.js's `getShareableQuestData`); a network layer neither
// this file nor machine.js knows about carries it to party members;
// the receiver runs the three gates below, and only on a clean pass
// does machine.js's `receiveSharedQuest` build a real, live Quest out
// of it - the exact reconstruction restoreSaveData's own load loop
// runs for a quest out of a save file, just fed a wire envelope
// instead of a save slot.
//
// WHY EACH PARTY MEMBER GETS THEIR OWN COPY, NOT ONE SHARED INSTANCE.
// This multiplayer layer is "each client simulates its own world; only
// poses/chat/social are relayed" (net/online.js) - there is no
// server-authoritative world or quest state to make one instance work
// across two independently-simulated worlds without a much bigger
// redesign (whose NPC is the real one, who is allowed to click it
// first, whose completion is the one that counts). A received quest
// is a full independent copy instead: the receiver's own world grows
// the same NPC/dungeon/items the sender's did (Place resources carry
// their own resolved siteDetails, so createSiteLink reaches the exact
// link a fresh accept would have), and the receiver's own completion
// and reward are theirs alone.
//
// LIVE SYNC, ADDED LATER, still keeps that shape - it does not make the
// two copies one instance. `machine.js`'s `sharedQuestNames` marks a
// quest name as "kept in step with the party" (set on a fresh receive,
// and by the sender on their own copy too - `markQuestShared`); a HOST
// hook watches those quests' state for changes and periodically
// re-shares them (world.js's own tick), landing here as a RESYNC
// (`canReceiveSharedQuest`'s `resync: true`) that updates the existing
// local Quest object in place (`updateSharedQuest`, keeping the
// receiver's OWN uid) rather than building a second one. Bidirectional:
// whichever copy changes first propagates to the other, only while
// both are still partied (no party, nothing to resync to - each copy
// just sits at its last-synced state and keeps working solo). Still not
// one instance: two Foe resources, two sets of quest variables, kept
// EQUAL by periodic resync rather than BEING the same object - a
// receiver who somehow diverges in a way a resync cannot express (rare,
// given the resync is a full state overwrite each time) would see the
// two copies drift until the next resync corrects it.
//
// "COUNTS AS ACCEPT" (machine.js's own note on receiveSharedQuest):
// restoreSaveData deliberately never REPLAYS an action - a save-game
// load must not refire a reward, reset a timer, or repeat dialogue,
// and a share rides that exact same restore path. That is correct for
// every action but one from a FRESH receiver's own point of view:
// TeleportPc, if it already fired for the sender, restores at
// isComplete=true with the receiver never actually having gone
// anywhere - their quest log can say "you are at the dungeon" while
// they are standing wherever they were when the share landed. A fresh
// receive rearms any already-fired TeleportPc so the next tick moves
// the receiver too - once, the same as the sender's own "yes" once
// did. A RESYNC never does this (would re-teleport on every later
// sync, which is not what "counts as accept, once" means).
//
// THE UID IS NEVER THE SENDER'S (machine.js's own note on
// receiveSharedQuest) - two independent machines mint UIDs from their
// own counters, so keeping the sender's risks colliding with a quest
// the receiver already has for an unrelated reason.

import { MEMBERSHIP_STATUS, isMainQuestName } from './questLists.js';
import { TaskType } from './task.js';
import { getInnerSymbolName } from './symbol.js';
import { sharedActionMatches, takeLocalActions } from './shareActions.js';
import { GUILDS, hasJoined } from '../guild/guilds.js';
import { QUEST_FRAME_MAX } from '../../net/wire.js';
import { BUILD_TAG } from '../../buildTag.js';   // SHARE-MEND: the sender's build rides the envelope, so a refusal can name a skew
import { relayQuestOnline, relayQuestMovedLayout } from './questRepair.js';   // AUDIT SD III (D5): a shared copy laid on this page's world sizes
import { isOnlinePage } from '../online/onlineLane.js';
import { isShelved } from './quest.js';   // QUEST-SHELF: a copy set aside
import { lineStepOf } from '../questlines/qlLines.js';   // AUDIT QUESTLINES REWARD-2: a questline's step is never shared
import { QL_STAMP } from '../questlines/qlState.js';   // AUDIT QUESTLINES BRANCH-12: the script a copy was read with
import { t } from '../textManager.js';   // AUDIT QUESTLINES REWARD-2: the refusal's words
import { ONLINE_REPUTE_GATES } from './onlineRepute.js';   // QUEST-AUDIT III REPUTE-SHARE: the gate, on receipt too

/** The relay's own frame cap for a quest-share envelope (net/wire.js's
 *  QUEST_FRAME_MAX - its own oversized-frame arm, the same scale
 *  FOES_FRAME_MAX gets, not the ordinary MAX_FRAME_BYTES a first draft
 *  used and a live report promptly outgrew on an ordinary side quest).
 *  Checked here too, before a network layer ever sees the payload, so
 *  a quest too elaborate to share fails with a WORD instead of a
 *  silently dropped frame. A little headroom is kept for the rest of
 *  the wire envelope (t, quest.questName, quest.displayName) around
 *  this payload. */
export const QUEST_SHARE_MAX_BYTES = QUEST_FRAME_MAX - 512;

/** SENDER SIDE: one quest's shareable envelope, or a refusal.
 *  `machine` is the sender's own QuestMachine. */
export function prepareQuestShare(machine, uid) {
  const prepared = prepareShareData(machine.getShareableQuestData(uid));
  // AUDIT QA3 E2/E4: A COPY NEW HERE ANSWERS "HELD" - its first sync, while nothing has changed since it came, tells the
  // party it is held (machine.js noteShareHolder: the purse's shares) and is merged by nobody: answered with the copy,
  // it carried the sharer's state at the share back over what the sharer did since (a `hide npc` undone, its action
  // spent). A deliberate share is never one (the receiver reads `held` only on a sync).
  const quest = machine.quests?.get?.(Number(uid));
  if (prepared.ok && quest?._heldSig !== undefined) {
    if (quest._heldSig === shareSignature(quest)) prepared.data = { ...prepared.data, held: 1 };
    else delete quest._heldSig;
  }
  return prepared;
}

/** DISC28-I: the same preparation over an envelope already taken - a finished copy's final state
 *  (machine.nextFinishedShare), captured before its tombstone disposed anything. */
export function prepareShareData(data) {
  if (!data) return { ok: false, reason: 'gone' };
  // The main quest is the SAME one thread for everyone already - not a
  // side or guild quest's own copy to hand off - so it is never
  // shareable, whatever a stale or hand-built UI call might ask for.
  if (isMainQuestName(data.questName)) return { ok: false, reason: 'mainQuest' };
  // AUDIT QUESTLINES REWARD-2: NOR A QUESTLINE'S STEP (qlLines.js) - a line is the player's own road, walked step by step
  // and paid at its end with its named piece (qlLayer.js ending). Shared, the last step paid that piece and the line's
  // gear to every member who never began the line; refused at both ends, as the main quest is.
  if (lineStepOf(data.questName)) return { ok: false, reason: 'questline' };
  // SHARE-MEND: the markers travel slim (slimShareMarkers) and the envelope says which build made it
  const slim = slimShareMarkers({ ...data, build: BUILD_TAG });
  const text = JSON.stringify(slim);
  if (text.length > QUEST_SHARE_MAX_BYTES) return { ok: false, reason: 'tooLarge' };
  return { ok: true, questName: slim.questName, displayName: slim.displayName, data: slim };
}

/** DISC28-I: WHAT A SYNC WATCHES - everything a partner's copy can take from mine: the log, every action's completion
 *  and every task's trigger, each Foe's kills and injury, and the end. The sync watched the log's LENGTH alone, and a
 *  `killed N` count, a `give pc`, an `end quest` or a `say` writes no log line: a kill made on one copy never reached
 *  the other, and an ending never did. Pure; a string, compared for change. */
export function shareSignature(quest) {
  if (!quest) return '';
  const parts = [quest.getLogMessages?.()?.length ?? 0, quest.questComplete ? 1 : 0, quest.ticksToEnd | 0];
  for (const task of quest.tasks?.values?.() ?? []) {
    parts.push(task.triggered ? 1 : 0);
    for (const action of task.actions ?? []) parts.push(action.isComplete ? 1 : 0);
  }
  for (const r of quest.resources?.values?.() ?? []) if (r.isFoe) parts.push(`${r.killCount | 0}${r.injuredTrigger ? 'i' : ''}`);
  return parts.join(',');
}

/** The host's sync baseline after a receipt (scenes/world.js onQuestShared): what I just received is what I have seen
 *  (AUDIT PARTY8's echo) - unless the merge kept progress of my own (QUEST-AUDIT III PROGRESS-KEPT: machine.js
 *  `_keptLocal`) or the copy is new here (GOLD-HOLDERS: it answers once, "held" - prepareQuestShare - so its sharer
 *  hears it is held): then '' - no signature - and the next check sends it. A held answer merged nothing (AUDIT QA3
 *  E4): the baseline stays `prev`, so a change of mine still waiting on the floor still goes. */
export function syncBaselineAfter(quest, result, prev = undefined) {
  if (result?.held) return prev;
  return quest?._keptLocal || !result?.resync ? '' : shareSignature(quest);
}

/** The hub refused a share as 'busy' (net/online.js onQuestBusy): a FINAL goes back on the machine's pending finals
 *  (AUDIT DISC28 QS-1); QUEST-AUDIT III BUSY-SYNC: an ordinary sync's baseline is let go (`seen`, the host's map), so the
 *  next check sends it - the change it carried was otherwise sent by nothing until the next change. */
export function questBusyAgain(machine, quest, seen) {
  if (quest?.data?.final === 1) { machine?.pendFinishedShare?.(quest.data); return; }
  if (quest?.questName) seen?.set?.(quest.questName, '');
}

/** AUDIT DISC28 QS-5: an envelope whose `end quest` has RUN - a quest ending (EndQuest's two ticks of grace) or ended.
 *  EndQuest never re-arms (allowRearm false, as EndQuest.cs), so its action complete is the end's own mark, carried by
 *  the save shape where ticksToEnd is not. Pure. */
export function shareEnvelopeEnding(data) {
  for (const task of Array.isArray(data?.tasks) ? data.tasks : []) {
    for (const action of Array.isArray(task?.actions) ? task.actions : []) if (action?.type === 'EndQuest' && action.isComplete === true) return true;
  }
  return false;
}

/** SHARE-MEND (2026-09-27, Discord - Tabitha: "Fix sharing Guild & Temple quests - It says the quests don't match up,
 *  can't share, etc."): A DUNGEON PLACE CARRIES EVERY QUEST MARKER IN THE DUNGEON (place.js
 *  _enumerateDungeonQuestMarkers - DFU's SiteDetails keeps them all, and a save must), about 240 bytes each, and a
 *  guild's or a temple's "clear the dungeon" sends the party to a big one: three hundred markers were 71 KB, over
 *  QUEST_SHARE_MAX_BYTES on their own, and the Share button said "This quest is too complex to share." A marker's
 *  place in its list is its identity (an action's `marker N`, the scene mount's walk), so none may be dropped - but
 *  four of its fields repeat what the site already says: `questUID` (the site's own), `placeSymbol` (the Place
 *  resource's own symbol), and `targetResources` and `buildingKey` at their defaults (null and 0). Those are left
 *  off the wire and put back on receipt (fullShareMarkers), exactly - half the bytes, and a receiver that predates
 *  this reads the rest as before (nothing reads those four off a marker). */
const MARKER_LISTS = ['questSpawnMarkers', 'questItemMarkers'];
// the resource's own symbol rides the save as {original} alone (symbol.js symbolToSaveData); a marker's is the clone's
// {original, name} - so a marker's is left off only when it IS that symbol with the name its original derives
const ownSymbol = (m, symbol) => !!m && !!symbol && m.original === symbol.original && m.name === getInnerSymbolName(m.original ?? '')
  && Object.keys(m).length === 2;
function mapPlaceMarkers(data, each) {
  if (!data || !Array.isArray(data.resources)) return data;
  return {
    ...data,
    resources: data.resources.map((r) => {
      const sd = r?.type === 'Place' ? r.resourceSpecific?.siteDetails : null;
      if (!sd || !MARKER_LISTS.some((k) => Array.isArray(sd[k]))) return r;
      const out = { ...sd };
      for (const k of MARKER_LISTS) if (Array.isArray(sd[k])) out[k] = sd[k].map((m) => (m && typeof m === 'object' ? each(m, sd, r.symbol) : m));
      return { ...r, resourceSpecific: { ...r.resourceSpecific, siteDetails: out } };
    }),
  };
}
/** SHARE-MEND, the sender's half: each marker without the four fields the site already says. A copy. */
export function slimShareMarkers(data) {
  return mapPlaceMarkers(data, (m, sd, symbol) => {
    const out = { ...m };
    if (m.questUID === sd.questUID) delete out.questUID;
    if (ownSymbol(m.placeSymbol, symbol)) delete out.placeSymbol;
    if (m.targetResources === null) delete out.targetResources;
    if (m.buildingKey === 0) delete out.buildingKey;
    return out;
  });
}
/** SHARE-MEND, the receiver's half: each marker whole again - the site's uid, the Place's symbol and the two defaults
 *  under whatever the marker itself carried - so the restored site is the sender's. A copy. */
export function fullShareMarkers(data) {
  return mapPlaceMarkers(data, (m, sd, symbol) => ({
    questUID: sd.questUID,
    placeSymbol: symbol ? { original: symbol.original, name: getInnerSymbolName(symbol.original ?? '') } : null,
    targetResources: null,
    buildingKey: 0,
    ...m,
  }));
}

/** RECEIVER SIDE, gate only - no side effects, so a UI can grey a
 *  button or show a reason before anything is ever accepted. All
 *  three of the caller's own edge cases live here:
 *
 *  'active' - the receiver already has a live quest of this exact
 *  name (machine.js's hasActiveQuestNamed, by questName since a
 *  received copy is never the same object as whatever the receiver
 *  may already be running).
 *
 *  'done' - a ONE-TIME quest (its catalog row's `oneTime`) the
 *  receiver has already accepted or completed before, fresh or
 *  shared (questLists.js's own oneTimeQuestsAccepted ledger, the SAME
 *  list the guild counter's own pool-builder excludes from). A
 *  repeatable quest carries no such record by design and is never
 *  gated here - DFU means it to be redoable.
 *
 *  'guild' - the quest's catalog row requires guild membership
 *  (Member, Prospect, or a Temple deity - anything but Nonmember) and
 *  the receiver has not joined that guild GROUP at all. This is the
 *  structural gate, not DFU's full rank/reputation threshold
 *  (minReq): the exact per-guild rank overrides (Mages/Knightly
 *  orders read player LEVEL, not raw rank; Temple folds every deity
 *  to Member) live deep in each guild's own live-session wrapper, not
 *  in the catalog row, and are not replicated here. A receiver who
 *  has joined the right guild always passes; a receiver who has not
 *  always fails - the one direction that must never be wrong. */
export function canReceiveSharedQuest(machine, questLists, questName, { memberships = {}, shareId, factionId = 0 } = {}) {
  // AUDIT DROPS A2: a quest this player already FINISHED under a share is never received again this session -
  // a fresh receipt rebuilds it from the sender's envelope and "counts as advance" would pay every completed
  // GivePc/TrainPc a second time. (The tombstone only lives a week; the memory of having been paid outlives it.)
  // DISC22-F: by the COPY (the envelope's shareId), not the name - a new share of a repeatable quest is a new copy
  if (shareId !== undefined ? machine.hasFinishedSharedCopy?.(questName, shareId) : machine.hasFinishedSharedQuestNamed?.(questName)) return { ok: false, reason: 'done' };
  if (lineStepOf(questName)) return { ok: false, reason: 'questline' };   // AUDIT QUESTLINES REWARD-2: a line's step, on receipt too (prepareShareData)
  // AUDIT DROPS A1: the main quest is refused on RECEIPT as well as on send - the sender's own gate is the sender's
  // client, and a hand-built envelope is not bound by it.
  if (isMainQuestName(questName)) return { ok: false, reason: 'mainQuest' };
  // QUEST-SHELF (2026-10-08): a copy I set aside takes no partner's share or step - reclaimed, it is as I left it
  if (isShelved(machine.sharedCandidateNamed?.(questName))) return { ok: false, reason: 'shelved' };
  if (machine.hasActiveQuestNamed(questName)) {
    // QUEST1 LIVE SYNC: a resync of a quest ALREADY kept in sync with the
    // party (shared out earlier, or received before) updates the existing
    // copy in place instead of refusing - the bidirectional half of live
    // sync. An independent quest of the same name the player never shared
    // either direction keeps the ordinary refusal below it: overwriting
    // THAT one is exactly the collision this gate exists to prevent.
    // QUEST-AUDIT III SAME-COPY: and only of THE SAME COPY - a party member's own copy of a repeatable quest (taken at
    // their own hall, then shared) or a stranger's final carries another shareId, and by name it replaced this copy's
    // progress, sites and identity, or ended it and paid for a quest this player never did. Both identities known and
    // different: the receiver's own quest stands, as an unshared one does (an older client's envelope carries none)
    const own = machine.sharedCandidateNamed?.(questName)?.shareId;
    if (typeof shareId === 'string' && shareId && typeof own === 'string' && own && own !== shareId) return { ok: false, reason: 'active' };
    if (machine.hasSharedQuestNamed(questName)) return { ok: true, resync: true };
    return { ok: false, reason: 'active' };
  }
  const meta = questLists.findQuestMeta(questName);
  if (meta?.quest?.oneTime && questLists.hasAcceptedOneTime(questName)) return { ok: false, reason: 'done' };
  if (meta?.scope === 'guild' && meta.quest.membership !== MEMBERSHIP_STATUS.Nonmember) {
    const guild = Object.values(GUILDS).find((g) => g.guildGroup === meta.group);
    if (guild && !hasJoined(memberships, guild)) return { ok: false, reason: 'guild', guild: guild.name };   // DISC25-D: WHICH guild
  }
  // QUEST-AUDIT III REPUTE-SHARE: REPUTE-GATE's two quests (onlineRepute.js) wait online for the guild standing their
  // headers name - in the guild's own pool, and a party's share handed them to a member at standing 0, the penalties the
  // gate keeps off a new member with them. The receiver's own standing with the quest's faction (the envelope's)
  // AUDIT QA3 E7: the faction is the catalog row's guild's (guilds.js), never the envelope's word - the sender writes it
  const need = ONLINE_REPUTE_GATES[questName];
  const fid = Object.values(GUILDS).find((g) => g.guildGroup === meta?.group)?.factionId ?? (Number(factionId) || 0);
  if (need != null && isOnlinePage() && (machine.deps?.getReputation?.(fid) ?? 0) < need) return { ok: false, reason: 'repute', need };
  return { ok: true, meta };
}

/** RECEIVER SIDE, the whole act: gate, then (only on a clean pass)
 *  actually build the quest and note it as accepted where a one-time
 *  row's ledger expects that. `data` is the sender's envelope
 *  (prepareQuestShare's own `data`), `questName` its own `questName`
 *  field - carried alongside rather than re-read from `data`, so a
 *  caller can gate on the name BEFORE ever deserialising the (larger)
 *  envelope, on a network layer that separates the two.
 *
 *  A RESYNC (canReceiveSharedQuest's own `resync: true`) updates the
 *  existing local Quest in place (machine.js's `updateSharedQuest`,
 *  which keeps THIS machine's own uid) rather than building a second
 *  one - the result still carries `quest`, so a caller need not branch
 *  on which arm ran to read the outcome. */
export function receiveSharedQuest(machine, questLists, questName, data, ctx = {}) {
  const check = canReceiveSharedQuest(machine, questLists, questName, { ...ctx, shareId: data?.shareId ?? null, factionId: data?.factionId ?? 0 });   // DISC22-F: the copy being offered; REPUTE-SHARE: its faction
  // AUDIT QA3 E2/E4: a partner's word that it holds the copy (prepareQuestShare) - on a sync, or a deliberate Share of a
  // copy unchanged since it came: either way nothing in it is news to a member who holds the copy
  const held = data?.held === 1;
  if (!check.ok) return held && data.sync === 1 ? { ...check, quiet: true } : check;   // a member who refused the share is not told so again by each answer
  if (held && check.resync) {
    machine.noteShareHolder?.(questName, ctx.from);
    const quest = machine.sharedCandidateNamed?.(questName) ?? null;
    return quest ? { ok: true, quest, resync: true, held: true } : { ok: false, reason: 'gone' };
  }
  // AUDIT DROPS A1: THE ENVELOPE IS NOT TRUSTED. The wire's `questName` gated the receipt above, but the quest is
  // BUILT from `data` - so the two must agree, and the envelope's SHAPE (every task symbol and every action TYPE in
  // order, every resource symbol and type) must be the receiver's OWN parse of that quest by name. Without this a
  // party member's hand-built envelope could put any GivePc, TeleportPc or global-var link on the receiver's
  // machine. The receiver's parse also supplies the ITEM resources' items (`takeLocalItems`): a reward is the
  // receiver's own roll, never a `daggerfallUnityItem` somebody typed.
  if (!data || typeof data !== 'object' || data.questName !== questName) return { ok: false, reason: 'mismatch' };
  const local = machine.parseQuestShape?.(questName, data.factionId, { questlines: data.ql?.stamp === QL_STAMP }) ?? null;
  // AUDIT QUESTLINES BRANCH-12 (above): the receiver's parse reads the script the copy was read with - its branch while
  // the copy is stamped, DFU's while it is not (a quest begun before the deploy, or offline with the switch off): the read
  // followed the receiver's switch, forced on online, and every share and resync of such a copy was refused as a forgery
  if (!local) return { ok: false, reason: 'unknown' };
  const why = shapeMismatch(local, data);
  if (why) return { ok: false, reason: 'mismatch' };
  // SHARE-MEND: the markers travel slim - made whole AFTER the shape check (AUDIT D3): it holds every resource's symbol
  // to a string, and a forged Place's number there threw out of the receipt instead of being refused in words
  // AUDIT QUESTLINES BRANCH-2: a resync keeps the progress that is this holder's own (shareActions.js `holders`) off the
  // copy it holds; a fresh copy takes it from its own parse
  const live = check.resync ? machine.sharedCandidateNamed?.(questName) ?? null : null;
  const safe = takeLocalItems(local, takeLocalActions(local, fullShareMarkers(data), live));
  // AUDIT SD III (D5): online, the copy's dungeons laid on the world's own sizes, as a load lays a saved quest's
  // (questRepair.js relayQuestOnline) - an older page's copy was laid whole, and pointed into blocks this build has not
  // MEDIUM-DISTINCT's audit: and a copy whose medium dungeon the older page laid with one block twice, laid on this
  // page's (questRepair.js relayQuestMovedLayout - the load's own pass runs only at a load)
  const relay = (q) => {
    const online = ctx.online ?? isOnlinePage();
    if (online) relayQuestOnline(q, { carriesQuestItem: ctx.carriesQuestItem ?? null });
    relayQuestMovedLayout(q, machine, { carriesQuestItem: ctx.carriesQuestItem ?? null }, online);
  };
  if (check.resync) {
    const quest = machine.updateSharedQuest(questName, safe, { from: ctx.from });   // AUDIT QA3 E3: whose kills it brings
    if (quest) { relay(quest); machine.noteShareHolder?.(questName, ctx.from); return { ok: true, quest, resync: true }; }   // QUEST-AUDIT III GOLD-HOLDERS: `from` holds it
    // AUDIT SHARE-MEND D4: a copy that still stands was not GONE - the restore choked on the partner's (machine.js
    // logs why), most often another build of the game, and the receiver was told they no longer had it
    const still = machine.sharedCandidateNamed?.(questName) ?? null;
    return { ok: false, reason: still && !still.questComplete && !still.questTombstoned ? 'restore' : 'gone' };
  }
  // DISC28-I: a FINISHED copy's envelope ends a copy that stands; it never makes one - to a member who never took the
  // quest it is news of nothing, and built it would be a quest ended on arrival. AUDIT DISC28 QS-5: nor an ENDING
  // copy's (shareEnvelopeEnding) - a sync its sender sent from EndQuest's grace carried questComplete false, and a
  // member who joined the party after the share was handed a copy whose `end quest` had run, its reward re-armed and
  // paid, that never ended (ticksToEnd is no save state).
  if (safe.questComplete === true || shareEnvelopeEnding(safe)) return { ok: false, reason: 'finished' };
  const quest = machine.receiveSharedQuest(safe);
  if (!quest) return { ok: false, reason: 'restore' };   // SHARE-MEND: the restore choked (machine.js logs why) - not a forged envelope
  relay(quest);
  machine.noteShareHolder?.(questName, ctx.from);   // QUEST-AUDIT III GOLD-HOLDERS: the sharer holds it
  quest._sentBy = ctx.from ?? null;   // AUDIT QA3 E1: who shared it - its questline choices wait while they are in the party
  quest._heldSig = shareSignature(quest);   // AUDIT QA3 E2/E4: its first sync, unchanged, answers held
  if (check.meta?.quest?.oneTime) questLists.markOneTimeAccepted(questName);
  return { ok: true, quest };
}

/** SHARE-COPY (2026-09-26, "Shared Quest did not match copy"): the task types whose symbol is MINTED at parse -
 *  `nextUid()` in task.js, DFU's own NextUID - the headless startup task EVERY quest has, and each
 *  `until _x_ performed:` block. The number is wherever the parsing machine's counter stood, so no two parses
 *  agree on it, and A1 compared it anyway: every share of every quest was refused. Such a task is the same task
 *  by its TYPE and its place in the order (and a persist-until by the symbol it watches), never by its number. */
const MINTED_TASK_TYPES = new Set([TaskType.Headless, TaskType.PersistUntil]);

/** SHARE-COPY: the Place a Person's set-up mints over the SENDER's world (person.js _assignHomeTown,
 *  `_<person>_home_`) - the questor's hall, a generic NPC's house. The receiver's shape parse is headless and
 *  makes none, so the envelope may carry one per Person the script declares, and it must be a Place. */
const HOME_SYMBOL = /^_(.+)_home_$/;

/** AUDIT DROPS A1: does the envelope's SHAPE match `local` (a Quest the receiver parsed from its own source by
 *  the same name - headless, SHARE-COPY)? Every task's type and symbol and its actions' types in order, and
 *  every resource's symbol and type - answers a word for the first thing that differs, or null when they agree.
 *  Pure, so a test hands in both. */
export function shapeMismatch(local, data) {
  const ref = local.getSaveData();
  const tasks = Array.isArray(data.tasks) ? data.tasks : null;
  if (!tasks || tasks.length !== ref.tasks.length) return 'tasks';
  const taskNames = new Set();
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i], r = ref.tasks[i];
    if (!t || typeof t !== 'object' || t.type !== r.type || typeof t.symbol?.original !== 'string') return 'task';
    if (MINTED_TASK_TYPES.has(r.type)) {
      // SHARE-COPY: the sender's number is KEPT - the restore keys the task by it, as a save's load does - so it
      // must be a number; a persist-until must watch the symbol the script names
      if (!/^\d+$/.test(t.symbol.original)) return 'task';
      if (r.type === TaskType.PersistUntil && t.targetSymbol?.original !== r.targetSymbol?.original) return 'task';
    } else if (t.symbol.original !== r.symbol?.original) return 'task';
    // SHARE-COPY: and no two tasks under one name - the restore's Map would keep the last and drop a task
    const name = getInnerSymbolName(t.symbol.original);
    if (taskNames.has(name)) return 'task';
    taskNames.add(name);
    const acts = Array.isArray(t.actions) ? t.actions : null;
    if (!acts || acts.length !== r.actions.length) return 'actions';
    for (let j = 0; j < acts.length; j++) if (!sharedActionMatches(r.actions[j], acts[j])) return 'action';
  }
  const res = Array.isArray(data.resources) ? data.resources : null;
  if (!res) return 'resources';
  const want = new Map(ref.resources.map((r) => [r.symbol?.original, r.type]));
  const persons = new Set(ref.resources.filter((r) => r.type === 'Person').map((r) => getInnerSymbolName(r.symbol?.original ?? '')));
  const seen = new Set();
  for (const r of res) {
    const sym = r && typeof r === 'object' ? r.symbol?.original : null;
    if (typeof sym !== 'string' || seen.has(sym)) return 'resource';
    seen.add(sym);
    if (want.has(sym)) { if (want.get(sym) !== r.type) return 'resource'; continue; }
    const home = HOME_SYMBOL.exec(sym);
    if (!home || r.type !== 'Place' || !persons.has(home[1])) return 'resource';
  }
  for (const sym of want.keys()) if (!seen.has(sym)) return 'resources';
  return null;
}

/** AUDIT DROPS A1: the envelope with every Item resource's ITEM replaced by the receiver's own parse's roll for
 *  that symbol - the sender's flags (useClicked, actionWatching, playerDropped, madePermanent) stay, the object a
 *  player would end up holding is never the sender's bytes. A copy; the envelope handed in is not touched. */
export function takeLocalItems(local, data) {
  const mine = new Map();
  for (const r of local.resources.values()) if (r.resourceTypeName === 'Item') mine.set(r.symbol?.original, r);
  return {
    ...data,
    resources: data.resources.map((r) => {
      const own = r?.type === 'Item' ? mine.get(r.symbol?.original) : null;
      if (!own) return r;
      const item = own.daggerfallUnityItem ? structuredClone(own.daggerfallUnityItem) : null;
      return { ...r, resourceSpecific: { ...(r.resourceSpecific ?? {}), artifact: !!own.artifact, item } };
    }),
  };
}

/** A short, player-facing word for a refusal's `reason` - the UI's
 *  own line (a HUD text, a party-chat system note) fills in the
 *  quest/party names around it. */
// QUEST-AUDIT III SHARE-WORDS: every word below in the player's language (the text core's) - English in every language
// before; the fragments still follow "... but you" (scenes/world.js `quest.share.refused`), each language's frame drafted to take them
export const SHARE_REFUSAL_TEXT = Object.freeze({
  get gone() { return t('quest.share.gone', 'That quest is no longer active.'); },
  get tooLarge() { return t('quest.share.tooLarge', 'This quest is too complex to share.'); },
  get mainQuest() { return t('quest.share.mainQuest', 'The main quest cannot be shared.'); },
  // AUDIT QUESTLINES REWARD-2: the sender's word for a questline's step (world.js reads this table by the reason)
  get questline() { return t('quest.share.questline', 'A questline is your own road. Its steps cannot be shared.'); },   // AUDIT QUESTLINES VOICE-QL: two sentences, no dash aside (bible/10-UI/Voice.md rule 5)
  // DISC22-F: the fragments below are said to the RECEIVER, after "... but you" (scenes/world.js) - second person
  get active() { return t('quest.share.active', 'already have this quest.'); },
  get done() { return t('quest.share.done', 'have already done this quest.'); },
  get mismatch() { return t('quest.share.mismatch', 'received a quest that did not match your own copy.'); },   // AUDIT DROPS A1: the envelope is not the quest it names
  get unknown() { return t('quest.share.unknown', 'do not know this quest.'); },   // AUDIT DROPS A1: no local source to check the envelope against
  get guild() { return t('quest.share.guild', 'are not a member of the guild this quest requires.'); },
  get repute() { return t('quest.share.repute', 'do not yet have the standing with its guild this quest asks for.'); },   // QUEST-AUDIT III REPUTE-SHARE
});

/** DISC25-D: the four guilds a guild quest's catalog row can name (GUILDS), as a sentence says them. */
export const SHARE_GUILD_NAMES = Object.freeze({
  get FightersGuild() { return t('quest.share.guildName.fighters', 'the Fighters Guild'); },
  get MagesGuild() { return t('quest.share.guildName.mages', 'the Mages Guild'); },
  get ThievesGuild() { return t('quest.share.guildName.thieves', 'the Thieves Guild'); },
  get DarkBrotherhood() { return t('quest.share.guildName.darkBrotherhood', 'the Dark Brotherhood'); },
});

/**
 * DISC25-D (Sir McMobdon on Discord: "Assumed it was cause I wasn't a part of same guild I couldn't receive the quest.
 * But I checked i am In guild. Still cant get quest shared"): the refusal a receiver reads, naming the guild when the
 * gate was one. "Guard the Guild" is a Mages Guild quest, and a Temple of Julianos member was told only that they
 * were "not a member of the guild this quest requires" - true, and no use to someone who is in a guild. The rest are
 * SHARE_REFUSAL_TEXT's own fragments; null for a reason with none.
 * @param {{reason?: string, guild?: string}|null} result
 */
export function shareRefusalText(result, theirBuild = undefined) {
  const named = result?.reason === 'guild' ? SHARE_GUILD_NAMES[result.guild] : null;
  if (named) return t('quest.share.guildNamed', 'are not a member of {guild}, which this quest requires.', { guild: named });
  const base = RECEIVER_REFUSAL_TEXT[result?.reason] ?? SHARE_REFUSAL_TEXT[result?.reason] ?? null;
  return base && theirBuild !== undefined && SKEW_REASONS.has(result.reason) ? base + shareSkewText(theirBuild) : base;
}

/** AUDIT QA3: the sender's own line after a deliberate share - sent to the party, or not now - in the player's language. */
export function shareSentLine(sent, quest) {
  return sent ? t('quest.share.sent', 'Shared "{quest}" with your party.', { quest }) : t('quest.share.notNow', 'Could not share that quest right now.');
}

/** QUEST-AUDIT III SHARE-WORDS: the receiver's lines, whole, in the player's language - a partner who has no name yet, the
 *  share's arrival, and its refusal (shareRefusalText's fragment after the language's own "... but you"), or the bare
 *  failure where no fragment says why. */
export const shareSomeone = () => t('quest.share.someone', 'A party member');
export const shareReceivedLine = (who, quest) => t('quest.share.received', '{who} shared a quest: "{quest}".', { who, quest });
export function shareRefusedLine(result, who, quest, theirBuild = undefined) {
  const why = shareRefusalText(result, theirBuild);
  return why ? t('quest.share.refused', '{who} tried to share "{quest}", but you {why}', { who, quest, why })
    : t('quest.share.notReceived', 'Could not receive the quest "{quest}" from {who}.', { who, quest });
}

/** SHARE-MEND: the reasons SHARE_REFUSAL_TEXT words for the SENDER ("That quest is no longer active."), worded for the
 *  RECEIVER after "... tried to share X, but you" - a resync whose local copy had ended read "... but you That quest
 *  is no longer active." - and the restore's own reason. */
export const RECEIVER_REFUSAL_TEXT = Object.freeze({
  get gone() { return t('quest.share.receiver.gone', 'no longer have a copy of it to bring up to date.'); },
  get tooLarge() { return t('quest.share.receiver.tooLarge', 'were sent a quest too large to read.'); },
  get mainQuest() { return t('quest.share.receiver.mainQuest', 'cannot be given the main quest.'); },
  get questline() { return t('quest.share.questline.receiver', 'cannot be given a step of a questline. Each player walks their own.'); },   // AUDIT QUESTLINES REWARD-2; VOICE-QL: still a fragment after "... but you", its aside a second sentence (Voice.md rule 5)
  get restore() { return t('quest.share.receiver.restore', 'could not rebuild it in your world.'); },
  get shelved() { return t('quest.share.receiver.shelved', 'have abandoned it. Reclaim it from the Quests tab of the pause menu to take it up again.'); },   // QUEST-SHELF's audit: a deliberate share is answered
});

/** SHARE-MEND: the refusals that say the two copies disagree - most often two BUILDS of the game: before SHARE-COPY
 *  every receiver refused every share as "did not match your own copy", and a player with an old page open keeps
 *  that build until they reload. */
const SKEW_REASONS = new Set(['mismatch', 'unknown', 'restore']);
/** SHARE-MEND: what such a refusal adds, read off the envelope's `build` (BUILD_TAG at the sender): nothing when it is
 *  mine; when it is another, both should reload; when there is none, theirs predates this build. */
export function shareSkewText(theirBuild, mine = BUILD_TAG) {
  if (!theirBuild) return ` ${t('quest.share.skewOld', 'Their game is out of date. They should reload the page.')}`;
  return theirBuild === mine ? '' : ` ${t('quest.share.skewDiffer', 'You are on different versions of the game. Both of you should reload the page.')}`;
}

/** SHARE-MEND: whether a refusal is to be SAID. A quest kept in step with the party is re-shared on every change
 *  (world.js questSyncTick, `sync: 1` on its envelope), so a member the guild gate refuses, or who holds a quest of
 *  that name of their own, read the same refusal every few seconds for as long as the sharer played. A deliberate
 *  share is always answered; a sync's refusal is said once per sharer, quest and reason. `said` is the host's Set. */
export function sayShareRefusal(said, acct, questName, result, sync, copy = '') {
  if (result?.quiet) return false;   // AUDIT QA3 E4: a partner's held answer, refused here, is no share to answer
  // AUDIT SHARE-MEND D5: keyed by the copy too (`copy` - its share id and the sender's build): a sender who reloads onto
  // another build, or shares a fresh copy, is answered again; and a deliberate share's refusal counts as said
  const key = `${acct}|${questName}|${result?.reason}|${result?.guild ?? ''}|${copy}`;
  const fresh = !said.has(key);
  said.add(key);
  return !sync || fresh;
}
