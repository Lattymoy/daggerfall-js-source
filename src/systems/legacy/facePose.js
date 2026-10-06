// @ts-check
// AUDIT LEGACY III P17 (2026-10-06, bible/01-Overview/Audit-Legacy-III.md): A PERSON'S PORTRAIT, ASKED ONE WAY - the pose
// the party HUD's face loader draws (ui/partyPanel.js createFaceLoader). A member of the blood, and another player's
// character, wear their race's chargen head `face`; a townsperson wed in wears the talk window's CommonFaces record their
// census gave them for life (`residentFace` - livingTown.js personFaceRecordId, the face they were courted with), never
// head 0 of their race's chargen faces. The Family tab's card (ui/familyPages.js faceBox) and the Succession's and the
// meeting's (ui/legacySuccession.js face) both ask it, so a spouse met in the street wears the face the tree shows them
// with. A leaf with no imports: the Succession is a lazy chunk.

/**
 * @param {{ race?: string, gender?: string, face?: number, kind?: string, residentFace?: number|null }} p - a person of the record
 * @returns {{ race: string|undefined, gender: string|undefined, face: number|undefined, common?: number }}
 */
export const facePose = (p) => ({
  race: p.race, gender: p.gender, face: p.face,
  ...(p.kind === 'resident' && Number.isInteger(p.residentFace) && /** @type {number} */ (p.residentFace) >= 0 ? { common: /** @type {number} */ (p.residentFace) } : {}),
});
