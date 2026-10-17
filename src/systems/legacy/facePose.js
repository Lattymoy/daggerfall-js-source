// @ts-check
// AUDIT LEGACY III P17 (2026-10-06, bible/01-Overview/audits/Audit-Legacy-III.md): A PERSON'S PORTRAIT, ASKED ONE WAY - the pose
// the party HUD's face loader draws (ui/partyPanel.js createFaceLoader). A member of the blood, and another player's
// character, wear their race's chargen head `face`; a townsperson wed in wears the talk window's CommonFaces record their
// census gave them for life (`residentFace` - livingTown.js personFaceRecordId, the face they were courted with), never
// head 0 of their race's chargen faces. The Family tab's card (ui/familyPages.js faceBox) and the Succession's and the
// meeting's (ui/legacy/legacySuccession.js face) both ask it, so a spouse met in the street wears the face the tree shows them
// with. PORTRAIT3D: and their census id beside it (`resident`), the seed the head their body walks the street with is
// walked off (characters/headPortraits.js poseHeadImage). MW-HEADS2 (the owner: "only the player Britons should recieve
// the new heads, not npcs"): and a member of the blood who is not the one played (`kin` - `currentId` named) is one of
// the people - their body in the world is (scenes/world.js makeFamilyBodies), so their face is too: the data's heads.
// A leaf with no imports: the Succession is a lazy chunk.

/**
 * @param {{ id?: number, race?: string, gender?: string, face?: number, kind?: string, residentFace?: number|null, residentId?: string|null }} p - a person of the record
 * @param {{ currentId?: number|null }} [o] - the one played's id, where the asker knows it
 * @returns {{ race: string|undefined, gender: string|undefined, face: number|undefined, common?: number, resident?: string, kin?: boolean }}
 */
export const facePose = (p, { currentId = null } = {}) => ({
  race: p.race, gender: p.gender, face: p.face,
  ...(p.kind === 'member' && currentId != null && p.id !== currentId ? { kin: true } : {}),
  ...(p.kind === 'resident' && Number.isInteger(p.residentFace) && /** @type {number} */ (p.residentFace) >= 0 ? { common: /** @type {number} */ (p.residentFace), ...(p.residentId ? { resident: String(p.residentId) } : {}) } : {}),
});
