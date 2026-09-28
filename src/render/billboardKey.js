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
 * LA-COST2: and its interned id (`_bbKeyId`, keyId below), minted with it.
 * @param {{ archive: number, record: number|string, frame?: number|null, _bbKey?: string, _bbKeyId?: number, _bbKeyRecord?: number|string, _bbKeyFrame?: number|null, _bbKeyArchive?: number }} b
 * @returns {string}
 */
export function billboardKey(b) {
  if (b._bbKey == null || b._bbKeyRecord !== b.record || b._bbKeyFrame !== b.frame || b._bbKeyArchive !== b.archive) {
    b._bbKeyRecord = b.record; b._bbKeyFrame = b.frame; b._bbKeyArchive = b.archive;
    b._bbKey = b.frame == null ? `${b.archive}_${b.record}` : `${b.archive}_${b.record}#${b.frame}`;
    b._bbKeyId = keyId(b._bbKey);   // LA-COST2
  }
  return b._bbKey;
}

// LA-COST2 (2026-09-27, Mac: "a deep audit on the enhanced lighting system ... performance improvements"): THE
// CUTOUT PASS'S SORT, BY BUCKET. drawBillboards sorted every visible opaque batch by its STRING key each call - a
// comparison sort of string compares, 186 us at 800 batches - to put one texture's batches together so their binds
// happen once (PERF3). Grouping needs no comparison between batches at all: each key is interned to a small integer
// when it is minted, the batches are counted into one bucket per key, and only the DISTINCT keys are ordered - a
// street's 800 flats wear tens of keys, not hundreds.
//
// THE ORDER IS THE OLD ORDER, EXACTLY. The audit's premise was that order within one key does not matter to the
// cutout pass; read against the pass, that is true of every pixel but one kind. The pass writes depth under LESS,
// discards below the cutout and does not blend, so the nearer fragment wins whatever came first - except at an
// exact depth TIE, two coplanar quads overlapping (every flat faces the same way, so any two whose origins sit at one
// depth along the view are coplanar), where the FIRST drawn keeps the pixel. So nothing is relaxed: keys ascend as
// the string compare had them, and one key's batches keep the order they came in, as the stable Array sort kept
// them. The same draws, in the same order, for the same picture (test/la_cost.test.js holds it to the old sort).

/** key string -> id, and id -> key string: the intern table. It holds a string per texture key the session has
 *  minted - the same set the renderer's texture cache holds a GL texture for - and never shrinks. */
const _keyIds = new Map();
/** @type {string[]} */ const _keyStrs = [];
/** per key id: 1 + its bucket in the sort in hand, 0 outside one (reset by every sort) */
let _slot = new Int32Array(256);
/** per bucket: its batch count, then its next write position */
let _count = new Int32Array(64);
/** per bucket: its key id; the buckets in key order; the placed batches - scratch, reused, emptied after */
/** @type {number[]} */ const _bucketKey = [];
/** @type {number[]} */ const _order = [];
/** @type {any[]} */ const _placed = [];
const byKey = (x, y) => { const a = _keyStrs[_bucketKey[x]], b = _keyStrs[_bucketKey[y]]; return a < b ? -1 : a > b ? 1 : 0; };

/** LA-COST2: the interned id of a texture key - one small integer per distinct string, for the life of the page. */
export function keyId(key) {
  let id = _keyIds.get(key);
  if (id === undefined) {
    id = _keyStrs.length;
    _keyIds.set(key, id);
    _keyStrs.push(key);
    if (id >= _slot.length) { const grown = new Int32Array(_slot.length * 2); grown.set(_slot); _slot = grown; }
  }
  return id;
}

/**
 * LA-COST2: `list`'s first `n` batches reordered IN PLACE by texture key - keys ascending as strings, one key's
 * batches in the order they came: exactly the order `list.sort((a, b) => (a._bbKey < b._bbKey ? -1 : a._bbKey >
 * b._bbKey ? 1 : 0))` gives, a stable sort. Every batch must have been through billboardKey. O(n) placing and
 * O(k log k) string compares for k distinct keys; nothing is allocated once the scratch has grown to the pass.
 * @param {any[]} list
 * @param {number} [n]
 */
export function sortByKey(list, n = list.length) {
  if (n < 2) return list;
  let k = 0;
  for (let i = 0; i < n; i++) {
    const b = list[i];
    const id = b._bbKeyId ?? (b._bbKeyId = keyId(b._bbKey));   // a key minted before its id (a batch dressed by hand) interns here
    let s = _slot[id];
    if (s === 0) {
      s = ++k;
      _slot[id] = s;
      _bucketKey[s - 1] = id;
      if (s > _count.length) { const grown = new Int32Array(_count.length * 2); grown.set(_count); _count = grown; }
      _count[s - 1] = 0;
    }
    _count[s - 1]++;
  }
  if (k > 1) {
    _order.length = k;
    for (let s = 0; s < k; s++) _order[s] = s;
    _order.sort(byKey);
    let at = 0;
    for (let j = 0; j < k; j++) { const s = _order[j], c = _count[s]; _count[s] = at; at += c; }   // each bucket's count becomes its first position
    for (let i = 0; i < n; i++) { const b = list[i]; _placed[_count[_slot[b._bbKeyId] - 1]++] = b; }
    for (let i = 0; i < n; i++) { list[i] = _placed[i]; _placed[i] = null; }   // a scratch keeps no batch alive past the call
  }
  for (let s = 0; s < k; s++) _slot[_bucketKey[s]] = 0;
  return list;
}
