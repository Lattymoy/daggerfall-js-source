// @ts-check
// QL4 (bible/06-Systems/Questlines-Arc.md section 2.3): THE QUESTLINES' ACTIONS - six lines a quest script may say
// that DFU's machine does not know, registered by the quest bridge beside DFU's 82 (scenes/quest/questBridge.js), as
// Jagget's four are (systems/quest/questActionsExtension.js, FORAGE1). Not DFU members; Port-Ledger A (QL4).
//
//   ask <message> choices <message> _task_ <message> _task_ [...]   two to four choices, each its own words (a message
//                                                                   of the quest's), the one taken sets its task. DFU's
//                                                                   `prompt` is its two-choice case with Yes and No for
//                                                                   words, and stays as it is; `promptmulti` names
//                                                                   BUTTONS.RCI records, fixed words. A branch is a
//                                                                   choice in the player's own words.
//   outcome _name_                                                  the outcome a path reached - written into a stamped
//                                                                   quest's state where the script decides it, rather
//                                                                   than read off a task (qlLaw.js observe's latch); a
//                                                                   DFU quest's (unstamped) says nothing.
//   ql act <kind> <n>                                               a trigger (QL11): true once the player has done <n>
//                                                                   acts of <kind> since the task was armed - a fish
//                                                                   caught, a breach closed, a Redoubt taken. The acts
//                                                                   are the layer's (qlLayer.js act), heard from the
//                                                                   features; a quest that is not stamped hears none.
//   ql paid                                                         the quest paid, quietly: its success and its
//                                                                   outcome's reward (qlLayer.js reward), without the
//                                                                   QuestComplete box `give pc nothing` raises - for a
//                                                                   branch's other way, whose words are its own (a box
//                                                                   that says "here is your gold" over a fee the player
//                                                                   waived is a lie).
//   ql name _person_ <Given_Name>                                   QL12: a questline's giver by their own name (Ysolde
//                                                                   Marnhel, who wrote the breach's book), where DFU
//                                                                   names a Person only from its name banks or FACTION.TXT's
//                                                                   individuals; underscores are spaces. Said first in the
//                                                                   start-up, before the talk shows the person.
//   ql name _foe_ <Name> [female|male]                              STAR8: a quest's FOE by its own name, every one of it
//                                                                   (a coven's Spinner, its sisters), and a class foe's
//                                                                   gender, where SetFoeName rolls both (Foe.cs:271-296).
//   ql gone _foe_ [_foe_ ...]                                       AUDIT STAR8 S1: a trigger - true once the foes named
//                                                                   have stood and none stands now, the first not killed
//                                                                   (QlGone): an ambush gone unfought, to be armed again.
//
// And the questlines' own rows of the quest tables (QL_PLACE_ROWS), laid as a mod lays its own.
import { ActionTemplate } from '../quest/actions.js';
import { Symbol as QuestSymbol } from '../quest/symbol.js';
import { GENDERS } from '../../characters/nameHelper.js';   // STAR8: a foe's gender, named
import { isClassEnemyId } from '../../characters/enemy/enemyBasics.js';
import { isStamped, isEnding } from './qlLaw.js';
import { sheetFor } from './qlSheets.js';   // AUDIT QUESTLINES BRANCH-10: an outcome is one its quest's sheet has
import { addIntoQuestTables } from '../quest/tables.js';   // AUDIT STAR8 S4: the questlines' place rows

const SYMBOL = '[a-zA-Z0-9_.]+';

/** AUDIT QUESTLINES BRANCH-3: a question answered null - the host could not show its pick (questBridge.js choiceBoxes:
 *  no list art yet) - is asked again this many of the machine's ticks later (30 s at machine.js TICKS_PER_SECOND 10).
 *  Asked again on the next tick, the question came back the moment it was clicked away, for as long as the art was not
 *  there; and before, nothing answered at all - the box went, and the question was never asked again until a load. */
export const ASK_AGAIN_TICKS = 300;

/** AUDIT QUESTLINES BRANCH-1: THE QUESTIONS UP, QUEST BY QUEST - an ask's latch is its QUEST's, by the ask's place (its
 *  task, its index there), not the action object's: a party's resync rebuilds every action (machine.js
 *  updateSharedQuest), and the rebuilt ask, its own latch gone, raised the question again over the box still up. No save
 *  state: a load builds new quests, and asks afresh. A place holds UP while its box is up, else the ticks left before a
 *  question answered null is asked again. */
const held = new WeakMap();
const UP = -1;
const heldOf = (quest) => { let m = held.get(quest); if (!m) held.set(quest, (m = new Map())); return m; };

/** AUDIT QUESTLINES BRANCH-1: A RECEIVED COPY KEPT IN STEP WITH A PARTY ASKS NOTHING - the sharer chooses, and the copies
 *  take the choice on the resync (decision 7, record 10.2). Every copy asked: the resync carried the sharer's click, so
 *  the member was asked the sharer's question; the member's answer synced back and decided the sharer's copy under the
 *  sharer's own box, whose answer then started the other choice's task - the kept gold AND the standing for giving it up
 *  (R0C11Y26). A received copy with no party to resync it (machine.js rewardShares: the party gone; or after a load - the
 *  share memory is no save state) is its holder's alone, and asks. */
const awaitsSharer = (quest) => quest?.ql?.received === true && !!quest.hooks?.sharedCopy?.(quest) && (quest.hooks?.rewardShares?.(quest) ?? 1) > 1;

/** `ask` - a choice in the player's own words. The host shows the question's message and the choices' messages
 *  (hooks.showChoice - a box, then a pick that cannot be dismissed without a choice, as PromptMulti's box cannot -
 *  PromptMulti.cs:87-88); the choice taken starts its task. COMPLETE ONLY ON THE ANSWER: while the question is up it is
 *  not asked again, and a question no one answered - the page reloaded under it, the box torn down with its scene - is
 *  asked again (the latch is no save state: a load asks afresh). A host that answers null (its pick could not be shown)
 *  is asked again ASK_AGAIN_TICKS later. AUDIT QUESTLINES BRANCH-19: allowRearm false, as PromptMulti: once answered it is
 *  never asked again - a task cleared and set again does not re-arm it (ActionTemplate.rearmAction). */
export class QlAsk extends ActionTemplate {
  static typeName = 'QlAsk';
  get saveShape() { return [['id'], ['choiceIds'], ['choiceTasks', 'symArray']]; }
  constructor(parentQuest) {
    super(parentQuest);
    this.allowRearm = false;
    this.reported = false;   // AUDIT QUESTLINES BRANCH-9: a missing message said once - transient
    this.id = 0;
    /** @type {number[]} */
    this.choiceIds = [];
    /** @type {any[]} */
    this.choiceTasks = [];
  }
  get pattern() { return new RegExp(`^\\s*ask (?<id>\\d+) choices (?<rest>(?:\\d+ ${SYMBOL}\\s*){2,4})$`); }
  createNew(source, parentQuest) {
    const match = this.test(source);
    if (!match) return null;
    const words = match.groups.rest.trim().split(/\s+/);
    if (words.length % 2 !== 0) return null;
    const action = new QlAsk(parentQuest);
    action.id = Number.parseInt(match.groups.id, 10);
    for (let i = 0; i < words.length; i += 2) {
      action.choiceIds.push(Number.parseInt(words[i], 10));
      action.choiceTasks.push(new QuestSymbol(words[i + 1]));
    }
    return action;
  }
  update(caller) {
    const quest = this.parentQuest;
    const task = caller?.symbol ?? null, at = caller?.actions?.indexOf?.(this) ?? -1;
    const key = `${task?.name ?? ''}#${at}`, latch = heldOf(quest), was = latch.get(key);
    if (was === UP) return;
    if (was > 0) { latch.set(key, was - 1); return; }
    if (awaitsSharer(quest)) return;
    const message = quest.getMessage(this.id) ?? null;
    const offered = this.choiceIds.map((id, i) => ({ id, task: this.choiceTasks[i], message: quest.getMessage(id) ?? null }));
    const choices = offered.filter((c) => c.message);
    // AUDIT QUESTLINES BRANCH-9: A MESSAGE THE QUEST DOES NOT HAVE FAILS LOUDLY, AND THE QUEST STAYS ANSWERABLE. The ask
    // warned, marked itself done and asked nothing - the reward waited on its choice for ever (M0B60Y10 with a misspelt
    // id passed every pin). Said once as an error, naming the quest and the ids; asked with what it has (the choices that
    // have words, the pick alone if the question has none); never complete but on an answer.
    if (!this.reported && (!message || choices.length < offered.length)) {
      this.reported = true;
      const missing = [...(message ? [] : [this.id]), ...offered.filter((c) => !c.message).map((c) => c.id)];
      console.error(`[questlines] ${quest.questName}: ask ${this.id} names a message the quest does not have (${missing.join(', ')}) - ${choices.length ? 'asked with what it has' : 'nothing to ask: it waits, unanswered'}`);
    }
    if (!choices.length) return;
    latch.set(key, UP);
    quest.hooks?.showChoice?.(quest, message, choices.map((c) => c.message), (index) => {
      if (latch.get(key) === UP) latch.delete(key);
      const chosen = Number.isInteger(index) ? choices[index] : null;
      if (!chosen) { latch.set(key, ASK_AGAIN_TICKS); return; }   // closed unanswered: asked again later
      // AUDIT QUESTLINES BRANCH-1: THE ANSWER IS THE ASK'S AS IT STANDS NOW - the one in this place (a resync's rebuild of
      // it, or itself), and only while unanswered: not once it is complete or a choice of its is already set (a partner's
      // answer, carried on the resync while this box was up - taken too, both ways paid), nor once the quest is ending.
      const live = task ? quest.getTask?.(task)?.actions?.[at] : this;
      if (!(live instanceof QlAsk) || live.id !== this.id || live.isComplete || isEnding(quest) || quest.questTombstoned
        || live.choiceTasks.some((s) => quest.getTask?.(s)?.getTriggerValue?.())) return;
      live.setComplete();
      quest.startTask(chosen.task);
    });
  }
}

/** `outcome _name_` - the outcome a stamped quest reached, written where the script says it (first one stands). */
export class QlOutcome extends ActionTemplate {
  static typeName = 'QlOutcome';
  constructor(parentQuest) {
    super(parentQuest);
    /** @type {any} */
    this.outcomeSymbol = null;
  }
  get saveShape() { return [['outcomeSymbol', 'sym']]; }
  get pattern() { return new RegExp(`^\\s*outcome (?<name>${SYMBOL})\\s*$`); }
  createNew(source, parentQuest) {
    const match = this.test(source);
    if (!match) return null;
    const action = new QlOutcome(parentQuest);
    action.outcomeSymbol = new QuestSymbol(match.groups.name);
    return action;
  }
  update(_caller) {
    const quest = this.parentQuest, name = this.outcomeSymbol?.name;
    if (isStamped(quest) && !quest.ql.outcome && name) {
      // AUDIT QUESTLINES BRANCH-10: a name the quest's sheet does not have is no outcome - written, it stood first, so the
      // sheet's own bindings never settled one, and the quest ended a success that paid no standing and no gear and filed
      // `done` (outcomeOf finds no row). Said, and left to the sheet. A quest with no sheet has nothing to hold it to.
      const sheet = sheetFor(quest.questName);
      if (!sheet || (sheet.outcomes ?? []).some((o) => o.id === name)) quest.ql.outcome = name;
      else console.warn(`[questlines] ${quest.questName}: outcome ${name} is not one its sheet has - left to the sheet's bindings`);
    }
    this.setComplete();
  }
}

/** `ql act <kind> <n>` - a trigger on the acts a stamped quest has heard: true once <n> more than when its task was
 *  first asked. The count it started from is saved, so a reload never restarts it. */
export class QlAct extends ActionTemplate {
  static typeName = 'QlAct';
  get saveShape() { return [['kind'], ['count'], ['from']]; }
  constructor(parentQuest) {
    super(parentQuest);
    this.isTriggerCondition = true;
    this.kind = '';
    this.count = 1;
    /** @type {number|null} */
    this.from = null;
  }
  get pattern() { return /^\s*ql act (?<kind>[a-z][a-z0-9-]{0,39}) (?<n>\d+)\s*$/; }
  createNew(source, parentQuest) {
    const match = this.test(source);
    if (!match) return null;
    const action = new QlAct(parentQuest);
    action.kind = match.groups.kind;
    action.count = Math.max(1, Number.parseInt(match.groups.n, 10));
    return action;
  }
  checkTrigger(_caller) {
    const quest = this.parentQuest;
    if (!isStamped(quest)) return false;
    const heard = quest.ql.acts?.[this.kind] ?? 0;
    if (this.from == null) this.from = heard;
    return heard - this.from >= this.count;
  }
}

/** `ql paid` - GivePc's `nothing` arm without its box (quest/actions.js GivePc): the quest a success, and the layer told
 *  it paid at the script's own moment, so its outcome's gear waits as a reward's does. A DFU quest (unstamped) is still
 *  made a success - the line is the script's word that this way ends well. */
export class QlPaid extends ActionTemplate {
  static typeName = 'QlPaid';
  get pattern() { return /^\s*ql paid\s*$/; }
  createNew(source, parentQuest) {
    return this.test(source) ? new QlPaid(parentQuest) : null;
  }
  update(_caller) {
    const quest = this.parentQuest;
    quest.hooks?.questReward?.(quest, null);
    quest.questSuccess = true;
    this.setComplete();
  }
}

/** `ql name _person_ <Name>` - the person's name, the script's own (underscores read as spaces); saved with the person
 *  (quest/person.js's `displayName`), so a load keeps it. STAR8: or a foe's - `ql name _foe_ <Name> [female|male]`, the
 *  name every one of it wears and, a class foe, the gender it stands as (DFU's Foe.cs SetFoeName rolls a humanoid's at
 *  55% male: the Coven on the Bluff's Spinner and her sisters are its women); saved with the foe (quest/foe.js's
 *  `displayName`, `humanoidGender`). A person's gender is its own line's (`Person ... female`), and a monster stands as
 *  DFU stands every monster: a gender word for either warns and is not taken. A symbol that is neither warns and is
 *  done. */
export class QlName extends ActionTemplate {
  static typeName = 'QlName';
  constructor(parentQuest) {
    super(parentQuest);
    /** @type {any} */
    this.personSymbol = null;
    this.given = '';
    /** STAR8: `female`, `male`, or '' (none named) */
    this.gender = '';
  }
  get saveShape() { return [['personSymbol', 'sym'], ['given'], ['gender']]; }
  get pattern() { return /^\s*ql name (?<sym>_[a-zA-Z0-9_.]+_) (?<given>[A-Za-z][A-Za-z'_-]{0,47})(?: (?<gender>female|male))?\s*$/; }
  createNew(source, parentQuest) {
    const match = this.test(source);
    if (!match) return null;
    const action = new QlName(parentQuest);
    action.personSymbol = new QuestSymbol(match.groups.sym);
    action.given = match.groups.given.replace(/_/g, ' ');
    action.gender = match.groups.gender ?? '';
    return action;
  }
  update(_caller) {
    const sym = this.personSymbol?.original ?? this.personSymbol?.name;
    const person = this.parentQuest.getPerson?.(this.personSymbol);
    const foe = person ? null : this.parentQuest.getFoe?.(this.personSymbol) ?? null;
    if (person) person.displayName = this.given;
    if (foe) {
      foe.displayName = this.given;
      foe.namePending = false;
      if (this.gender && isClassEnemyId(foe.foeType)) foe.humanoidGender = this.gender === 'female' ? GENDERS.Female : GENDERS.Male;
    }
    if (!person && !foe) console.warn(`[questlines] ql name: no person ${sym}`);
    else if (this.gender && !(foe && isClassEnemyId(foe.foeType))) console.warn(`[questlines] ql name: ${sym} takes no gender here`);
    this.setComplete();
  }
}

/**
 * AUDIT STAR8 S1: `ql gone _foe_ [_foe_ ...]` (one to four) - a trigger: true once one of the foes named has stood in a
 * scene since the trigger last fired, none of them stands now (machine.js questFoeStands: a cull, a teleport's sweep, a
 * load that did not bring it back), and the first is not all killed (its kills below its count). The Coven on the Bluff's
 * Spinner, gone unkilled - the encounters' cull takes a quest foe past 120 m (scenes/exteriorFoes.js), a death's teleport
 * sweeps the street - took the spindle with her, and the step could never end: QLTF02 clears its ambush on this, and the
 * next arrival brings the coven again. Every foe named must be gone, so a second coven never stands beside the first.
 * `seen` is saved: a foe that stood before a save and is not stood again by the load is gone. Not a DFU member.
 */
export class QlGone extends ActionTemplate {
  static typeName = 'QlGone';
  constructor(parentQuest) {
    super(parentQuest);
    this.isTriggerCondition = true;
    /** @type {any[]} */
    this.foeSymbols = [];
    this.seen = false;
  }
  get saveShape() { return [['foeSymbols', 'symArray'], ['seen']]; }
  get pattern() { return /^\s*ql gone((?: _[a-zA-Z0-9_.]+_){1,4})\s*$/; }
  createNew(source, parentQuest) {
    const match = this.test(source);
    if (!match) return null;
    const action = new QlGone(parentQuest);
    action.foeSymbols = match[1].trim().split(/\s+/).map((s) => new QuestSymbol(s));
    return action;
  }
  checkTrigger(_caller) {
    const quest = this.parentQuest;
    const stands = quest?.hooks?.questFoeStands;
    const foes = this.foeSymbols.map((s) => quest?.getFoe?.(s)).filter(Boolean);
    if (typeof stands !== 'function' || !foes.length) return false;
    if (foes.some((f) => stands(quest, f))) { this.seen = true; return false; }
    if (!this.seen || foes[0].killCount >= Math.max(1, foes[0].spawnCount)) return false;
    this.seen = false;   // fired: what stands next is seen afresh
    return true;
  }
}

/** AUDIT STAR8 S4: THE QUESTLINES' ROWS OF Quests-Places, laid as a mod lays its own (quest/tables.js addIntoQuestTables -
 *  Roleplay & Realism's AddIntoTable), keyed so they are laid once. `templeArkay`: a temple of Arkay - its building's
 *  faction in MAPS.BSA is FACTION.TXT's god, 21 (396 of the Bay's 2,980 temples) - which quest/place.js holds a temple
 *  to as DFU holds a guild hall to its row's faction (QLTF04's priest of Arkay keeps vigil in Arkay's own temple). */
export const QL_PLACE_ROWS = Object.freeze(['templeArkay,        0, 14, 21']);
addIntoQuestTables({ places: QL_PLACE_ROWS.map((line) => ({ line, unlessKey: line.split(',')[0].trim() })) });

/** The questlines' templates, in the order the bridge registers them (after DFU's 82 - a first-match scan, and no DFU
 *  pattern claims any of these lines: test/systems/questlines/ql4_actions.test.js). */
export const questlineActionTemplates = () => [new QlAsk(null), new QlOutcome(null), new QlAct(null), new QlPaid(null), new QlName(null), new QlGone(null)];
