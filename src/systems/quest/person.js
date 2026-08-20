// THE QUEST PERSON (Q1) - Person.cs, declaration half. The options
// scan runs over the WHOLE line (unlike Item/Clock, which scan only
// past the declaration - a DFU asymmetry kept as-is), and DFU throws
// when none of named/group/factionType/faction identifies the NPC.
// The NPC SETUP chain (SetupIndividualNPC/SetupCareerAllianceNPC/...,
// race/gender/face/display-name/home-town assignment against
// FACTION.TXT and the world) is the world half and ships at Q3;
// `npcPending` says so until then.

import { QuestResource } from './questResource.js';
import { Symbol as QuestSymbol } from './symbol.js';
import { parseInt as questParseInt } from './parseUtils.js';

const DECL = /(Person|person) (?<symbol>[a-zA-Z0-9'_.-]+)/;
const OPTIONS = /named (?<individualNPCName>[a-zA-Z0-9'_.-]+)|face (?<faceIndex>\d+)|(factionType|factiontype) (?<factionType>[a-zA-Z0-9'_.-]+)|faction (?<factionAlliance>[a-zA-Z0-9'_.-]+)|group (?<careerAlliance>[a-zA-Z0-9'_.-]+)|(?<gender>female|male)|(?<locationScope>local|remote)|(?<atHome>atHome|athome)/g;

export class Person extends QuestResource {
  constructor(parentQuest, line = null) {
    super(parentQuest);
    this.individualNPCName = '';
    this.faceIndex = -1;
    this.factionTypeName = '';
    this.factionAllianceName = '';
    this.careerAllianceName = '';
    this.genderName = '';
    this.locationScopeName = '';
    this.atHome = false;
    this.npcPending = true;   // Q1: the Setup*NPC chain (faction/world binding) ships at Q3
    // Q2b lifecycle flags (Person.cs:42,86,143,149). displayName is
    // assigned by the Q3 Setup*NPC chain - '' pends until then, and
    // the questor record / dialog-link display names ride it.
    this.isMuted = false;
    this.isDestroyed = false;
    this.isQuestor = false;
    this.displayName = '';
    if (line !== null) this.setResource(line);
  }

  get isPerson() { return true; }

  /** DestroyNPC (Person.cs:507-511). The Tick law then keeps a
   *  destroyed NPC hidden while it stands in a scene. */
  destroyNPC() { this.isDestroyed = true; }

  setResource(line) {
    super.setResource(line);
    const match = DECL.exec(line);
    if (!match) return;
    this.symbol = new QuestSymbol(match.groups.symbol);

    for (const option of line.matchAll(OPTIONS)) {
      const g = option.groups;
      if (g.individualNPCName != null) this.individualNPCName = g.individualNPCName;
      if (g.faceIndex != null) this.faceIndex = questParseInt(g.faceIndex);
      if (g.factionType != null) this.factionTypeName = g.factionType;
      if (g.factionAlliance != null) this.factionAllianceName = g.factionAlliance;
      if (g.careerAlliance != null) this.careerAllianceName = g.careerAlliance;
      if (g.gender != null) this.genderName = g.gender;
      if (g.locationScope != null) this.locationScopeName = g.locationScope;
      this.atHome = g.atHome != null;   // AUDIT quest-P6: C# assigns UNCONDITIONALLY per option - last one wins, a later option resets it
    }

    // DFU's identification ladder: named > group > factionType > faction,
    // and no match at all throws.
    if (!this.individualNPCName && !this.careerAllianceName && !this.factionTypeName && !this.factionAllianceName) {
      throw new Error(`Person resource could not identify NPC from line ${line}`);
    }
  }
}
