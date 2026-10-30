// @ts-check
// The saved deed UID is the boat identity, including when its stream slot changes.
export const boatUid = (uid) => Number.isSafeInteger(uid) && uid > 0;
const vec = (v) => Array.isArray(v) && v.length === 3 && v.every((n) => Number.isFinite(n) && Math.abs(n) <= 1e9);

/** One cabin descriptor for saves, door entry and staff teleport. */
export function readSailingCabin(v) {
  if (
    !v ||
    v.v !== 1 ||
    !boatUid(v.uid) ||
    ![2, 3, 4].includes(v.hull) ||
    !vec(v.origin) ||
    !vec(v.deck) ||
    !Number.isFinite(v.yaw) ||
    Math.abs(v.yaw) > 1e9
  )
    return null;
  return { v: 1, uid: v.uid, hull: v.hull, origin: [...v.origin], deck: [...v.deck], yaw: v.yaw };
}

export function readBankCabinLink(v) {
  return v?.v === 1 &&
    boatUid(v.uid) &&
    [0, 1].includes(v.type) &&
    [2, 3, 4].includes(v.hull) &&
    (v.hull === 2 ? 0 : 1) === v.type
    ? { v: 1, uid: v.uid, hull: v.hull, type: v.type }
    : null;
}
