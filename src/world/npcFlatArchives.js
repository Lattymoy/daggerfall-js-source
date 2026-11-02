// @ts-check
// DECOR-FIGURE (2026-10-10): RDBLayout.NPCFlatArchives' one home - a LEAF, so the
// decor law (net/decorLaw.js decorIsFigure), which the account service reads as
// the client does, names a person's flat without carrying the dungeon layout's
// whole reader into the Worker. world/rdbLayout.js re-exports both members.

/** RDBLayout.NPCFlatArchives / IsNPCFlat (RDBLayout.cs:1250-1254).
 *  A flat in one of these archives is a PERSON: AddFlat gives it a
 *  StaticNPC with SetLayoutData(obj) (:1226-1231) - the overload that
 *  stamps Context.Dungeon - and DaggerfallBillboard.cs:318-319 gives
 *  it FlatTypes.NPC, which is the only reason it carries a trigger
 *  BoxCollider at all (:343-349), i.e. the only reason the activation
 *  ray can hit it. */
export const NPC_FLAT_ARCHIVES = Object.freeze([334, 346, 357, 175, 176, 177, 178, 179, 180, 181, 182, 183, 184]);
const NPC_FLAT_ARCHIVE_SET = new Set(NPC_FLAT_ARCHIVES);
export const isNpcFlat = (archive) => NPC_FLAT_ARCHIVE_SET.has(archive);
