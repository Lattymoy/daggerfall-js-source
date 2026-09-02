// Exterior NPCs (Characters C2).
// Verbatim RMBLayout rule (both flat sites): a flat record with a
// NON-ZERO FactionID is an exterior NPC - it gets StaticNPC layout
// data on top of its billboard. Editor flats are skipped BEFORE the
// faction check (DFU order); scenery never carries a faction. The
// billboards themselves already render through collectBlockFlats -
// this module filters that same list into the NPC registry (position,
// archive/record, factionID, flags, and the raw record position that
// feeds DFU's NPC hash).

import { exteriorNpcFlags, NPC_CONTEXT } from './staticNpc.js';

/** @param flats - output of collectBlockFlats (C2 passthrough fields) */
export function collectExteriorNpcs(flats) {
  return flats.filter((f) => f.factionID !== 0 && f.factionID !== undefined);
}

/**
 * AUDIT 26 (F019/F190): the collection above had NO caller, so no
 * street NPC was ever stood as a StaticNPC and none could be clicked
 * or talked to. This is the record the hosts stand, i.e. what
 * RMBLayout.cs:372-376 / :443-447 does with one collected flat:
 *
 *   dfBillboard.SetRMBPeopleData(FactionID, Flags, Position)  - the
 *     billboard's own people summary (FactionOrMobileID/Flags/NameSeed).
 *     Inert in this port: nothing reads a billboard's summary, and the
 *     RAW flags ride it - DFU's gender repair below happens INSIDE
 *     SetLayoutData, on that method's own copy of the record.
 *   npc.SetLayoutData(obj, mapId, locationIndex)              - the
 *     identity, which IS this record's job: the same field names
 *     collectInteriorPeople mints, so the click derives an NPCData
 *     through the one staticNpcData door for both people paths.
 *
 * The gender repair (StaticNPC.cs:185-194) belongs to that overload and
 * lives with it in staticNpc.js; it is applied HERE because this record
 * is the layout input, and a repaired flag is what the derivation must
 * see.
 *
 * @param flat      one entry of collectExteriorNpcs' output
 * @param flatData  FlatsFile.getFlatData(archive, record), or null
 */
export function exteriorNpcRecord(flat, flatData = null) {
  return {
    x: flat.x, y: flat.y, z: flat.z,
    textureArchive: flat.archive,
    textureRecord: flat.record,
    factionID: flat.factionID,
    flags: exteriorNpcFlags(flat.flags ?? 0, flatData),
    rawX: flat.rawX, rawY: flat.rawY, rawZ: flat.rawZ,
    // DFU's obj.Position - the nameSeed's identity component.
    position: flat.recordPosition,
    // ...and the overload's own last line (StaticNPC.cs:206): an
    // exterior NPC is Context.Custom, NOT Context.Building. The
    // derivation reads it off the record, so a street NPC and a
    // building person go through the one staticNpcData door.
    context: NPC_CONTEXT.Custom,
  };
}

/**
 * E3 - RMBLayout's THIRD act on an exterior StaticNPC, as a pass over
 * the records above (RMBLayout.cs:377 and :453 - the block-flat site and
 * the building-subrecord one; the same statement in both):
 *
 *     QuestMachine.Instance.SetupIndividualStaticNPC(go, obj.FactionID);
 *
 * It is a LOOP here and a per-GameObject line there because the port
 * resolves its billboards in one pass, but nothing about the order
 * changes: it runs at LAYOUT, per NPC, before the billboard is drawn or
 * clickable. Two halves, both C#'s:
 *
 *   - the AWAY ARM. An individual a live quest has placed somewhere
 *     else answers false, and the machine has already called
 *     `SetActive(false)` on the host it was handed - so the home copy
 *     is out of the draw AND out of the activation ray, a disabled
 *     GameObject having no BoxCollider either. The host is the flag,
 *     which is why the caller must stand billboards AFTER this pass.
 *   - the BOOTSTRAP BEHAVIOUR. Every other individual gets a
 *     QuestResourceBehaviour whatever the quest state is (a
 *     non-individual faction gets `true` and nothing attached, C#'s own
 *     shape). It is not inert when no quest is running: DoClick's
 *     individual broadcast (QuestResourceBehaviour :243-248) walks the
 *     LIVE quests at click time, which is how a questor hands out the
 *     follow-up quest they had no resource for at layout.
 *
 * @param npcs      exteriorNpcRecord()s carrying `active`/`questBehaviour`
 * @param machine   the QuestMachine, or null when the host mounts none
 *                  (DFU always has the singleton; a machine-less host
 *                  gets C#'s empty-machine answer - everyone stands)
 * @param makeHost  the person's GameObject stand-in (setActive + the
 *                  DoClick broadcast's staticNpcFactionId)
 * @returns whether the pass ran (false = no machine to ask)
 */
export function setupExteriorQuestStaticNpcs(npcs, machine, makeHost) {
  if (!machine) return false;
  for (const pn of npcs) {
    pn.host = makeHost(pn);
    const setup = machine.setupIndividualStaticNPC(pn.host, pn.factionID);
    // The RETURN is the behaviour when there is one, `true` for a
    // non-individual and `false` for the away arm - C# hands back a
    // bool and the port hands back the component, so only an object
    // is a behaviour.
    if (setup && setup !== true) pn.questBehaviour = setup;
  }
  return true;
}
