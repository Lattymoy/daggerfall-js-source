// @ts-check
// LIGHT-ID (2026-10-14, Mac: "Engine fix (Recommended)" - FIELD BUGS 2026-10-13e AOE-PERF's follow-up, the boss's lights'
// shadows): A LIGHT IS SOMEBODY'S LIGHT. Design and record: bible/07-Rendering/Enhanced-Lighting-Arc.md LIGHT-ID.
//
// The frame's light list was a place and a range a light - four floats - so the shadow pass could tell one light from
// another only by WHERE it stood (SC1's sticky slots, DISC15's lo slots). A light that moved (the gate boss's glow at his
// chest, a thrown torch, a burning foe) was a new light every frame it moved, and its cube took a new light's path: its
// static cache drawn, then copied into the map it is read from, then its movers on top - every frame, for a cache no
// frame ever served (tools/courtShadowProbe.mjs counted it: half of a fight's shadow work about him).
//
// THE ONE CONSTRUCTION SEAM: a light enters a frame's list here and nowhere else (`packLight`, into a `lightList`), its
// place and its range in the list's vec4 and its IDENTITY beside it - the list's `ids`, which ride the array as MAC-T1's
// `carried` mask does and which renderer.setPointLights lifts for the shadow pass. The identity is the PRODUCER'S RECORD:
// the object it hands over, named the first time it is packed (`lightIdOf`), so no producer can forget to give one, and
// carried by that object on a symbol of its own, NOT enumerable - the record's fields, its equality (a deep-equal, a
// spread, Object.assign) and its wire form are what they were. A copy is another record: a copier that stands for the
// same light says so (`adoptLight` - worldModes.js's dungeon tint and the abyss's candle, `{ ...l, color }` a frame).
// A producer that keeps its record and refills it in place (AUDIT WB D10's law: the boss's glow, his crystals, a
// burst's flash, a Ward-Bearer's gold) keeps its light's identity as it moves; one that hands a new record each frame
// hands a new light each frame, and nothing claims it moved - unless it says whose light the new record is
// (`adoptLight`, the source's identity: a thrown torch's, a camp's, a ship's lantern's). The same door keeps a pool
// honest - an entry that stands for another producer's light this frame takes that light's identity (the lantern pools,
// refilled in order) - and a record handed to a different light from now on says so (`relight`: a burst's slot given to
// the next burst). An identity is never more than a schedule: the pass draws the same map for a light whatever it is
// called (a moved light's cube drawn whole, a still one's from its cache), so a wrong name costs a redraw, never a
// picture.
//
// test/render/lightid.test.js sweeps the source for a light written into a list anywhere else.
//
// Not a DFU member: Unity's lights are components with their own identity, and the shadow pass is the Enhanced Lighting
// lane's own (Ledger A's ENHANCED LIGHTING row).

/** The identity's own key on a record - a symbol, defined not enumerable: no producer's field is touched, and the
 *  record compares, spreads and serialises as it did (a copy is another record - adoptLight). */
const LIGHT_ID = Symbol('lightId');
/** The one descriptor every first naming defines with (a frame names its fresh records - no descriptor made a light). */
const _desc = { value: 0, writable: true, enumerable: false, configurable: false };
const _own = Object.prototype.hasOwnProperty;
/** @type {WeakMap<object, number>} a frozen record's identity (the court's braziers are frozen constants) - gone with it */
const _frozen = new WeakMap();
let _seq = 0;

/** No identity: an anonymous list's (a test's raw vec4s, the empty list) - the pass names such a light by its place. */
export const NO_LIGHT_ID = 0;

/** @param {any} l @param {number} id */
function nameLight(l, id) {
  if (_own.call(l, LIGHT_ID)) l[LIGHT_ID] = id;
  else if (Object.isExtensible(l)) { _desc.value = id; Object.defineProperty(l, LIGHT_ID, _desc); }
  else _frozen.set(l, id);
}

/** The identity of light record `l` (any object: a producer's `{ x, y, z, range }`, a lantern's position array) -
 *  named here the first time it is asked and the same for as long as the record lives.
 *  @param {any} l */
export function lightIdOf(l) {
  let id = l[LIGHT_ID] ?? _frozen.get(l);
  if (id === undefined) { id = ++_seq; nameLight(l, id); }
  return id;
}

/** Record `l` stands for ANOTHER light from now on (a pooled record handed to a new burst): a new identity.
 *  @template T @param {T} l @returns {T} */
export function relight(l) {
  nameLight(l, ++_seq);
  return l;
}

/** Record `e` stands for producer record `src` (a pool's entry for its lantern, a frame's record of a burning torch):
 *  `src`'s identity. Answers `e`.
 *  @template T @param {T} e @param {any} src @returns {T} */
export function adoptLight(e, src) {
  nameLight(e, lightIdOf(src));
  return e;
}

/** @typedef {Float32Array<ArrayBuffer> & { ids?: Float64Array<ArrayBuffer>, carried?: Uint8Array }} LightList */

/** A list of `n` lights: their vec4s [x, y, z, range] and, riding it, their identities (`ids` - not enumerable: two lists
 *  of the same lights in the same places are the same list, whatever their lights are called). */
export function lightList(n) {
  const out = /** @type {LightList} */ (new Float32Array(n * 4));
  Object.defineProperty(out, 'ids', { value: new Float64Array(n), writable: true, enumerable: false, configurable: true });
  return out;
}

/** THE SEAM: light `l` into list `out` (a lightList) at `i` - its place, `range` (its own by default) and its identity. */
export function packLight(out, i, l, range = l.range) {
  out[i * 4] = l.x; out[i * 4 + 1] = l.y; out[i * 4 + 2] = l.z; out[i * 4 + 3] = range;
  if (out.ids) out.ids[i] = lightIdOf(l);
}

/** Lights `from` of list `src` (a lightList, or an anonymous one) into `out` at `at`, `count` of them - their vec4s and
 *  their identities (none for an anonymous list's). Element by element: a frame's copy makes no view (sdRealm.js's
 *  Hour lines make nothing a frame). */
export function copyLights(out, at, src, from = 0, count = (src.length >> 2) - from) {
  for (let j = 0, a = at * 4, b = from * 4; j < count * 4; j++) out[a + j] = src[b + j];
  const ids = out.ids, sids = src.ids;
  if (ids) for (let j = 0; j < count; j++) ids[at + j] = sids ? sids[from + j] : NO_LIGHT_ID;
}

/** The first `n` lights of list `list` as a list of their own - a view of its vec4s and of its identities (a kept array's
 *  frame view: sdRealm.js realmLightsWith). */
export function lightListView(list, n) {
  const out = /** @type {LightList} */ (list.subarray(0, n * 4));
  if (list.ids) Object.defineProperty(out, 'ids', { value: list.ids.subarray(0, n), writable: true, enumerable: false, configurable: true });
  return out;
}

/** The identities a list carries, or null (an anonymous list). */
export const lightIdsOf = (data) => /** @type {LightList} */ (data)?.ids ?? null;
