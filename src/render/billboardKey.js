// @ts-check
// AUDIT 68 S16-bbkey-stale-shadow-reach (2026-09-24): A BILLBOARD BATCH'S
// TEXTURE KEY - one home. The main pass (renderer.drawBillboards), the shadow
// replay (shadowPass.js) and the air pass's emitters (airPass.js) all key a
// batch's texture by it. It used to be minted in drawBillboards alone, with
// the two replays taking `b._bbKey` as it stood: a batch that reached the
// records without being drawn (SHADOW-REACH's recordShadowBillboards) cast
// whatever frame it was on when it left the view. A leaf: nothing here
// touches GL, and it imports nothing.

/**
 * The key a batch's texture is uploaded under, re-minted whenever a field it
 * is made of changed since it was last minted.
 *
 * FA1: an animated flat's frames are uploaded under `record#frame` (the key
 * uploadRecordFrame already mints for enemy sprites); a still flat is
 * `record` alone. MAC4 (2026-09-11, Mac: "enemy animations are completely
 * broken"): the cache re-minted on a FRAME change only, and the mobiles -
 * every foe, guard and townsperson (exteriorFoes, dungeonContext, cityGuards,
 * the two hosts' people) - animate by writing the RECORD (`record#frame`,
 * orientation and frame folded into one) and never touch `frame`: their key
 * was minted once and they stood on their first texture for the rest of the
 * session. The key follows every field it is made of.
 * @param {{ archive: number, record: number|string, frame?: number|null, _bbKey?: string, _bbKeyRecord?: number|string, _bbKeyFrame?: number|null, _bbKeyArchive?: number }} b
 * @returns {string}
 */
export function billboardKey(b) {
  if (b._bbKey == null || b._bbKeyRecord !== b.record || b._bbKeyFrame !== b.frame || b._bbKeyArchive !== b.archive) {
    b._bbKeyRecord = b.record; b._bbKeyFrame = b.frame; b._bbKeyArchive = b.archive;
    b._bbKey = b.frame == null ? `${b.archive}_${b.record}` : `${b.archive}_${b.record}#${b.frame}`;
  }
  return b._bbKey;
}
