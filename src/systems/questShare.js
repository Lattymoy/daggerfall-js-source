// QUEST SHARING — OURS, not DFU's: there are no parties in Daggerfall
// Unity, so there is no "share this quest" law to port. This is new
// ground, built entirely on machinery that DOES already exist and is
// already correct: Quest.getSaveData()/restoreSaveData() (the same
// envelope a save file carries), QuestListsManager's catalog rows (the
// same membership/minReq/oneTime gates the guild counter already
// enforces), and systems/guilds.js's membership readers.
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

import { MEMBERSHIP_STATUS } from './quest/questLists.js';
import { GUILDS, hasJoined } from './guilds.js';
import { QUEST_FRAME_MAX } from '../net/wire.js';

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

/** ui/questRail.js's own isMainQuest, duplicated rather than imported -
 *  that module is UI-layer and this one is systems-layer, and a quest
 *  UID's own name is enough that the two never need to agree through a
 *  shared import to agree in fact. Keep this in step with questRail.js's
 *  copy if either ever changes. */
const isMainQuestName = (questName) => /^S0000/.test(questName ?? '') || questName === '_BRISIEN';

/** SENDER SIDE: one quest's shareable envelope, or a refusal.
 *  `machine` is the sender's own QuestMachine. */
export function prepareQuestShare(machine, uid) {
  const data = machine.getShareableQuestData(uid);
  if (!data) return { ok: false, reason: 'gone' };
  // The main quest is the SAME one thread for everyone already - not a
  // side or guild quest's own copy to hand off - so it is never
  // shareable, whatever a stale or hand-built UI call might ask for.
  if (isMainQuestName(data.questName)) return { ok: false, reason: 'mainQuest' };
  const text = JSON.stringify(data);
  if (text.length > QUEST_SHARE_MAX_BYTES) return { ok: false, reason: 'tooLarge' };
  return { ok: true, questName: data.questName, displayName: data.displayName, data };
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
export function canReceiveSharedQuest(machine, questLists, questName, { memberships = {} } = {}) {
  if (machine.hasActiveQuestNamed(questName)) {
    // QUEST1 LIVE SYNC: a resync of a quest ALREADY kept in sync with the
    // party (shared out earlier, or received before) updates the existing
    // copy in place instead of refusing - the bidirectional half of live
    // sync. An independent quest of the same name the player never shared
    // either direction keeps the ordinary refusal below it: overwriting
    // THAT one is exactly the collision this gate exists to prevent.
    if (machine.hasSharedQuestNamed(questName)) return { ok: true, resync: true };
    return { ok: false, reason: 'active' };
  }
  const meta = questLists.findQuestMeta(questName);
  if (meta?.quest?.oneTime && questLists.hasAcceptedOneTime(questName)) return { ok: false, reason: 'done' };
  if (meta?.scope === 'guild' && meta.quest.membership !== MEMBERSHIP_STATUS.Nonmember) {
    const guild = Object.values(GUILDS).find((g) => g.guildGroup === meta.group);
    if (guild && !hasJoined(memberships, guild)) return { ok: false, reason: 'guild' };
  }
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
  const check = canReceiveSharedQuest(machine, questLists, questName, ctx);
  if (!check.ok) return check;
  if (check.resync) {
    const quest = machine.updateSharedQuest(questName, data);
    return quest ? { ok: true, quest, resync: true } : { ok: false, reason: 'gone' };
  }
  const quest = machine.receiveSharedQuest(data);
  if (check.meta?.quest?.oneTime) questLists.markOneTimeAccepted(questName);
  return { ok: true, quest };
}

/** A short, player-facing word for a refusal's `reason` - the UI's
 *  own line (a HUD text, a party-chat system note) fills in the
 *  quest/party names around it. */
export const SHARE_REFUSAL_TEXT = Object.freeze({
  gone: 'That quest is no longer active.',
  tooLarge: 'This quest is too complex to share.',
  mainQuest: 'The main quest cannot be shared.',
  active: 'already has this quest.',
  done: 'has already done this quest.',
  guild: 'is not a member of the guild this quest requires.',
});
