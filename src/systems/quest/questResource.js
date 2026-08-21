// THE QUEST RESOURCE BASE (Q1 parse + Q2b lifecycle) -
// QuestResource.cs. Q1: every resource (Clock/Item/Person/Place/Foe)
// carries a Symbol and the three message tags its declaration may
// name (anyInfo / used / rumors, by id or by static-message name).
// Q2b: the click lifecycle - SetPlayerClicked (with the base's
// muted/destroyed Person refusal), RearmPlayerClick, and PostTick's
// UNCONDITIONAL rearm (a click lives for exactly one quest tick
// unless an action consumes it via Quest.ScheduleClickRearm) - plus
// the IsHidden setter and Tick's show/hide law. Tick's whole body is
// gated on questResourceBehaviour (the scene link), which stays null
// until Q3 spawns world objects - including the destroyed-Person->
// hidden rule, which DFU only applies to a Person standing in the
// scene. The C# `this is Person`/`this is Foe` type tests ride the
// isPerson/isFoe flags (the getClock/getPlace flag pattern).
//
// matchFirst: C# Regex alternations reuse one group name across
// alternatives, which this Node cannot express in a single RegExp -
// so a C# "a|b|c" pattern becomes an ordered pattern list, and the
// winner is the match at the LEFTMOST position, ties broken by
// pattern order. That is exactly .NET's alternation semantics.

import { Symbol as QuestSymbol } from './symbol.js';
import { staticMessagesTable } from './tables.js';
import { parseInt as questParseInt } from './parseUtils.js';

/** .NET-alternation matcher over an ordered pattern list. */
export function matchFirst(line, patterns) {
  let best = null, bestIndex = Infinity;
  for (const p of patterns) {
    const m = p.exec(line);
    if (m && m.index < bestIndex) { best = m; bestIndex = m.index; }
  }
  return best;
}

const MESSAGE_TAGS = /anyInfo (?<info>\d+)|used (?<used>\d+)|rumors (?<rumors>\d+)|anyInfo (?<infoName>\w+)|used (?<usedName>\w+)|rumors (?<rumorsName>\w+)/g;

export class QuestResource {
  constructor(parentQuest) {
    this.parentQuest = parentQuest;
    this.symbol = null;
    this.infoMessageID = -1;
    this.usedMessageID = -1;
    this.rumorsMessageID = -1;
    this._isHidden = false;
    this.hasPlayerClicked = false;
    // The scene link (QuestResourceBehaviour). Null until the scene
    // mount stands an object - Tick's show/hide half is inert until
    // then. The destroy handler carries its own identity so the
    // accessor's subscribe/unsubscribe pair matches (Q4-iii).
    this._questResourceBehaviour = null;
    this._onBehaviourDestroyed = (behaviour) => {
      // Clean up when target GameObject being destroyed (:373-377)
      behaviour.offDestroy(this._onBehaviourDestroyed);
      this._questResourceBehaviour = null;
    };
  }

  get Symbol() { return this.symbol; }
  set Symbol(v) { this.symbol = v; }

  /** QuestResourceBehaviour (QuestResource.cs:105-117): setting the
   *  scene link SUBSCRIBES the destroy uncoupling, so a torn-down
   *  object never strands a stale link. C#'s setter dereferences the
   *  value - a null assignment throws, kept: only real behaviours
   *  are ever assigned. */
  get questResourceBehaviour() { return this._questResourceBehaviour; }
  set questResourceBehaviour(value) {
    this._questResourceBehaviour = value;
    value.onDestroy(this._onBehaviourDestroyed);
  }

  /** IsHidden get/set -> SetHidden (QuestResource.cs:90,362). NOTE
   *  from the C#: Foes are a one-to-many resource - hiding a Foe
   *  removes ALL spawned instances of that Foe. */
  get isHidden() { return this._isHidden; }
  set isHidden(value) { this._isHidden = value; }

  /** Base SetResource parses the message tags off the line. */
  setResource(line) {
    this._parseMessageTags(line);
  }

  /** Tick (QuestResource.cs:155-174): the show/hide law, whole body
   *  gated on the scene link - INCLUDING destroyed-Person->hidden,
   *  which C# only applies while a behaviour stands in the scene.
   *  Overridden by resources that act (Clock). */
  tick(_caller) {
    if (!this.questResourceBehaviour) return;
    // Ignore for Foes
    if (this.isFoe) return;
    // A destroyed NPC is always hidden
    if (this.isPerson && this.isDestroyed) this.isHidden = true;
    // Show or hide the mapped GameObject off the hidden flag
    // (Q4-iii closes the Q3 pend; C# notes this can conflict with
    // other code disabling the object for its own reasons)
    this.questResourceBehaviour.setGameObjectActive(!this.isHidden);
  }

  /** PostTick (QuestResource.cs:176-182): the click rearms every
   *  quest tick, unconditionally. */
  postTick(_caller) {
    this.rearmPlayerClick();
  }

  /** ExpandMacro (QuestResource.cs): the base answers nothing; the
   *  resources override. Returns a string or false. */
  expandMacro(_macroType) { return false; }

  /** Gender (QuestResource.cs:100-103): Male unless overridden
   *  (Person -> npcGender, Foe -> humanoidGender); the pronoun
   *  macros read it off lastResourceReferenced. */
  get gender() { return 0; }   // GENDERS.Male

  dispose() {}

  /** SetPlayerClicked (QuestResource.cs:264-272): a muted or
   *  destroyed Person refuses the click, loudly. */
  setPlayerClicked() {
    if (this.isPerson && (this.isMuted || this.isDestroyed)) {
      console.warn(`[quest] Ignoring click on muted or destroyed Person ${this.symbol?.original}.`);
      return;
    }
    this.hasPlayerClicked = true;
  }

  /** RearmPlayerClick (QuestResource.cs:278-281). */
  rearmPlayerClick() { this.hasPlayerClicked = false; }

  _parseMessageTags(line) {
    const matches = [...line.matchAll(MESSAGE_TAGS)];
    for (const match of matches) {
      const g = match.groups;
      if (g.info) this.infoMessageID = questParseInt(g.info);
      if (this.infoMessageID === -1 && g.infoName) {
        this.infoMessageID = questParseInt(staticMessagesTable().getValue('id', g.infoName));
      }
      if (g.used) this.usedMessageID = questParseInt(g.used);
      if (this.usedMessageID === -1 && g.usedName) {
        this.usedMessageID = questParseInt(staticMessagesTable().getValue('id', g.usedName));
      }
      if (g.rumors) this.rumorsMessageID = questParseInt(g.rumors);
      if (this.rumorsMessageID === -1 && g.rumorsName) {
        this.rumorsMessageID = questParseInt(staticMessagesTable().getValue('id', g.rumorsName));
      }
    }
  }
}

export { QuestSymbol };
