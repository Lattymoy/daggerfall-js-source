// @ts-check
// SHIPS-2 (2026-10-07, Mac, sending Tiny_Ship.fbx: "implement both of these new ship placement models, UV Map/Texture,
// and ensure it matches the love we gave the other new ship model we implemented"): THE NEW LARGE BOAT - Mac's Tiny Ship,
// built as Come Sail Away builds a hull, as the galleon (world/galleonModel.js) and the carrack (world/carrackModel.js)
// are.
//
// Come Sail Away's hull 1 (the Large Boat, the mod's OldSkiffHull) is a prefab the C# walks BY NAME (systems/
// comeSailAwayBoat.js GetBoatTransforms) - and walks its `Variants`: seven sail plans on one mast, the boat's `variant`
// the one switched on, the VariantTrigger the player cycles them by. `largeBoatPrefab` makes that tree over Mac's model
// (src/assets/ships/largeBoat.json, baked by tools/bakeLargeBoat.mjs) and the parts built here - all seven variants,
// each with the mod's own sails by the mod's own names (world/largeBoatRig.js), so each plan sails as the mod's did -
// and systems/comeSailAwayModels.js stands it in for prefab 112411.
//
// WHAT IS MAC'S AND WHAT IS BUILT. His: her hull - a double skin, her outer planking and her ceiling, met at her
// gunwale's cap - her deck, her mast and its collar, her bowsprit and the rail round her stern. Built here: their
// textures (world/largeBoatArt.js - her clinker livery, every face laid on its picture by `faceSkin`), her rudder hung on
// her sternpost and turning about its rake, its stock and its tiller over her stern rail, the helmsman's step at her
// stern the tiller is worked from (her stern rail its guard rail), her swivel guns on her gunwale, the topmast her four
// larger plans set their upper canvas on, and the rig (world/largeBoatRig.js). Come Sail Away's own small things stand
// in her as they stood in the mod's boat - its anchor stowed on her foredeck, the boarding flat and the board trigger at
// her stem while she lies idle, its cargo and the lanterns' tall pole at her stem and short one at her quarter, the wake
// and the boat's modifiers (her handling: so she rows and sails as the mod's large boat does).
//
// THE FRAME is Unity's, the boat's: +x starboard, +y up, +z the bow, the root on the waterline - every measurement below
// is read off the bake (tools/bakeLargeBoat.mjs FRAME: Mac's metres x 0.72) and pinned against it
// (test/ships2_largeboat.test.js). Not a DFU member. Ledger A (SHIPS-2).
import { LARGE_BOAT_ARCHIVE, TEX, LARGE_BOAT_TILE, BANDS } from './largeBoatArt.js';
import { MeshBench, colliderOf, prism, box, planarUv, sub, add, dot } from './galleonMesh.js';
import { bakedPartGeometry, benchPart, mastCap, mergeGeometries, chaserGeometry, RUDDER_DEG } from './galleonModel.js';
import { nodeOf, yaw, clone, findNode, constClip, eulerCurve, partOf, prefabBench, inArchive } from './shipKit.js';
import { buildLargeBoatRig, VARIANT_COUNT } from './largeBoatRig.js';
import { CAPSULE_HEIGHT } from '../player/motor.js';   // Come Sail Away pins the capsule's CENTRE to DrivePosition (AUDIT GN-P1)

/** The prefab she stands in for: Come Sail Away's hull 1 (FIRST_HULL_MODEL_ID + 1). */
export const LARGE_BOAT_PREFAB_ID = 112411;
/** The node the boat's frame is (Boat.MeshObject): her hull, carrying the first MeshCollider of the tree. */
export const LARGE_BOAT_HULL_NODE = 'NewLargeBoat';
/** The mod's galleon, whose short lantern pole stands at her quarter. */
const GALLEON_ID = 112412;

/** Her measurements in the boat's frame (metres): each read off the bake (tools/bakeLargeBoat.mjs FRAME) and pinned
 *  there (test/ships2_largeboat.test.js). */
export const MEASURED = Object.freeze({
  deckY: 0.9032, gunwaleY: 2.2488, keelY: -0.6147,
  // her ceiling's face (her bulwark's inner side) and her planking's widest, amidships
  innerX: 1.5214, outerX: 2.0271, capOuterX: 1.8869,
  // her stem's head and its knee, her sternpost's foot and head (the hull's centreline vertices)
  stemHead: Object.freeze([0, 2.2488, 6.2388]), stemKnee: Object.freeze([0, 1.1773, 5.659]),
  postFoot: Object.freeze([0, -0.6147, -5.907]), postHead: Object.freeze([0, 1.1773, -6.2427]),
  // the rail round her stern: its cap, and its run along her
  sternRail: Object.freeze({ capY: 2.5939, z0: -5.8977, z1: -3.1467 }),
  // her mast's axis (it stands 1.7 cm to port of her centreline, as Mac drew it), its foot and head
  mast: Object.freeze({ x: -0.0171, z: -0.5993, footY: 0.8116, topY: 6.3471 }),
});

/** Her rudder: hung on her sternpost (from its foot to its head the post rakes aft 10.6 degrees) and turned about it,
 *  its blade's front `clear` abaft the post, from `y0` to `y1` up the post's line (metres along it), `chord` its
 *  breadth at its foot and its head, `t` its thickness; its stock up the post's line to `stockTop` along it, and its
 *  tiller from the stock's head forward `tiller` m, level, over her stern rail. */
export const RUDDER = Object.freeze({ clear: 0.04, y0: 0.08, y1: 1.72, chord: Object.freeze([0.52, 0.4]), t: 0.07, stockR: 0.045, stockTop: 3.42, tiller: 1.68 });
/** The post's line: its foot, its unit direction up it, and its rake (degrees about x, Unity's: +y toward +z). */
const POST_UP = (() => { const d = sub(MEASURED.postHead, MEASURED.postFoot), l = Math.hypot(...d); return Object.freeze(d.map((v) => v / l)); })();
export const POST_RAKE_DEG = (Math.atan2(POST_UP[2], POST_UP[1]) * 180) / Math.PI;
/** The helmsman's step at her stern: a planked platform over her deck between her stern's sides, its top `topY`, from
 *  `z0` to `z1` and `halfX` a side (inside her ceiling there: 1.31 at its after end), with a tread before it - so her
 *  tiller over her stern rail comes to the helmsman's hand (her stern rail his guard rail, 1.04 m over the step). */
export const STEP = Object.freeze({ topY: 1.55, z0: -5.0, z1: -3.9, halfX: 1.15, treadY: 1.2266, treadZ1: -3.6 });
/** The helm: where the helmsman stands (DrivePosition: half a capsule over the step - AUDIT GN-P1), forward of the
 *  tiller's end, and its DriveTrigger's node over the tiller's end. */
export const HELM = Object.freeze({ stand: Object.freeze([0, STEP.topY + CAPSULE_HEIGHT / 2, -4.4]), trigger: Object.freeze([0, 2.75, -5.1]) });

/** Where the mod's anchor stands stowed on her foredeck (z): its flukes (0.44 m a side, 0.53 m forward of its node)
 *  inside her ceiling, which narrows to 0.50 a side at the deck by z 4.0; its mesh's foot 3.4 cm under its node. */
export const ANCHOR_Z = 3.4;

/** Her lanterns' tall pole: on her gunwale's cap at her starboard bow (x, z: between the cap's inner edge, x 0.48 there,
 *  and its outer, 1.05), its hook (the pole's -z) turned square out of her side's run there. */
export const LANTERNS = Object.freeze({ bow: Object.freeze([0.85, 4.6]), bowYaw: -123 });

/** Her swivel guns: on posts on her gunwale's cap, three a side (aft to fore) and one on the cap at her port bow
 *  (`bow`: x, z - her stem is her bowsprit's heel's), each muzzle out over her side or her bow (`muzzle` its reach
 *  from its post - the barrel's end, world/galleonModel.js chaserGeometry's - `y` the barrel's height). The starboard
 *  muzzles as HULL_BUILDS reads them (the port side their mirror) and the bow's. */
export const SWIVELS = Object.freeze({ z: Object.freeze([-2.3, 0.3, 2.3]), postX: 1.7, y: 2.62, muzzle: 0.95, bow: Object.freeze([-0.35, 5.3]) });
export const LARGE_BOAT_BATTERIES = Object.freeze({
  broadside: Object.freeze(SWIVELS.z.map((z) => Object.freeze([SWIVELS.postX + SWIVELS.muzzle, SWIVELS.y, z]))),
  bow: Object.freeze([Object.freeze([SWIVELS.bow[0], SWIVELS.y, SWIVELS.bow[1] + SWIVELS.muzzle])]),
});

// ── her faces, textured ─────────────────────────────────────────────────────────────────────────────────────────────

/** Which picture a face of a baked part of hers wears, and how it lies on it (world/carrackModel.js faceSkin's law):
 *  `{ rec, uv(p) }`, or `{ band, u(p) }` a face of her livery. */
function faceSkin(role, n, c) {
  const tiled = (rec, key = keyOf(rec)) => ({ rec, uv: (p) => planarUv(p, n, LARGE_BOAT_TILE[key]) });
  const banded = (name) => ({ band: BANDS[name], u: (p) => planarUv(p, n, [LARGE_BOAT_TILE[name][0], 1])[0] });
  const up = n[1] > 0.7, down = n[1] < -0.7;
  switch (role) {
    case 'hull': {
      if (up) return tiled(TEX.trim);   // her gunwale's cap
      const core = [0, c[1], Math.max(-4.5, Math.min(4, c[2]))];
      if (dot(n, sub(core, c)) > 0) return tiled(TEX.hullInner);   // her ceiling, looking in
      if (n[1] < -0.55) return tiled(TEX.hullBottom);
      if (n[2] < -0.6 && c[1] > 0.4) return banded('transom');
      return banded('hullSide');
    }
    case 'deck': return tiled(up ? TEX.deck : down ? TEX.underDeck : TEX.trim);
    case 'mast': case 'bowsprit': return tiled(TEX.spar);
    default: return tiled(TEX.trim);   // her mast's collar, her stern rail
  }
}
const keyOf = (rec) => Object.keys(TEX).find((k) => TEX[k] === rec);
/** A baked part of hers drawn: her skin, her archive. */
const drawn = (part, opts = {}) => bakedPartGeometry(part, { ...opts, skin: faceSkin, archive: LARGE_BOAT_ARCHIVE });

// ── the parts built here ───────────────────────────────────────────────────────────────────────────────────────────

/** A point of her frame in the post's (its foot the origin, its +y up the post). */
function toPost(p) {
  const d = sub(p, MEASURED.postFoot), a = (-POST_RAKE_DEG * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  // Unity's turn about x by -rake: (y, z) -> (y c - z s, y s + z c)
  return [d[0], d[1] * c - d[2] * s, d[1] * s + d[2] * c];
}
/** Her rudder, its stock and its tiller, in the post's frame (its foot the origin, +y up the post, +z forward across
 *  it): the blade abaft the post from RUDDER.y0 to RUDDER.y1, tapering aft; the stock up the post's line to its head;
 *  the tiller from the head forward, level in her frame, over her stern rail; iron straps where the blade hangs. */
export function rudderGeometry() {
  const bench = new MeshBench(LARGE_BOAT_ARCHIVE);
  const R = RUDDER;
  const at = (y, back) => [0, y, -(R.clear + back)];
  const [c0, c1] = R.chord;
  // the blade: a slab, its front on the post's line (offset aft), thinning to its after edge
  const f0 = at(R.y0, 0), f1 = at(R.y1, 0), a0 = at(R.y0, c0), a1 = at(R.y1, c1);
  const th = R.t / 2, ta = R.t * 0.3;
  const sides = (s) => [[s * th, ...f0.slice(1)], [s * th, ...f1.slice(1)], [s * ta, ...a1.slice(1)], [s * ta, ...a0.slice(1)]];
  const uvs = [[0, 0], [0, 1.6], [0.5, 1.6], [0.5, 0]];
  for (const s of [1, -1]) bench.quad(TEX.hullBottom, ...sides(s), uvs, [s, 0, 0]);
  const [pS, pP] = [sides(1), sides(-1)];
  bench.quad(TEX.hullBottom, pS[0], pP[0], pP[1], pS[1], uvs, [0, 0, 1]);   // its front
  bench.quad(TEX.hullBottom, pS[3], pS[2], pP[2], pP[3], uvs, [0, 0, -1]);  // its after edge
  bench.quad(TEX.hullBottom, pS[1], pP[1], pP[2], pS[2], uvs, [0, 1, 0]);   // its head
  bench.quad(TEX.hullBottom, pS[0], pS[3], pP[3], pP[0], uvs, [0, -1, 0]);  // its foot
  // the straps (pintles) where it hangs on the post
  for (const y of [R.y0 + 0.3, (R.y0 + R.y1) / 2, R.y1 - 0.25]) box(bench, TEX.iron, [0, y, -(R.clear + 0.12)], [th + 0.01, 0.03, 0.14], { tile: LARGE_BOAT_TILE.iron });
  // the stock, up the post's line from the blade's head
  prism(bench, TEX.spar, [0, R.y1 - 0.15, -R.clear - 0.05], [0, R.stockTop, -R.clear - 0.05], R.stockR, R.stockR * 0.9, 8, { smooth: true, tileV: LARGE_BOAT_TILE.spar[1] });
  // the tiller: from the stock's head forward, level in her frame
  const head = toPostInverse([0, R.stockTop, -R.clear - 0.05]);
  const end = [0, head[1] + 0.05, head[2] + R.tiller];
  prism(bench, TEX.spar, toPost(head), toPost(end), 0.05, 0.035, 8, { smooth: true, tileV: LARGE_BOAT_TILE.spar[1] });
  prism(bench, TEX.iron, [0, R.stockTop - 0.06, -R.clear - 0.05], [0, R.stockTop + 0.07, -R.clear - 0.05], 0.07, 0.07, 8, { smooth: true });
  return bench.finish();
}
/** A point of the post's frame in hers. */
export function toPostInverse(q) {
  const a = (POST_RAKE_DEG * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  return add([q[0], q[1] * c - q[2] * s, q[1] * s + q[2] * c], MEASURED.postFoot);
}
/** The tiller's end in her frame (rest): where her DriveTrigger stands over. */
export function tillerEnd() {
  const head = toPostInverse([0, RUDDER.stockTop, -RUDDER.clear - 0.05]);
  return [0, head[1] + 0.05, head[2] + RUDDER.tiller];
}

/** The helmsman's step and its tread, planked on top, in her frame. */
export function helmStepGeometry() {
  const bench = new MeshBench(LARGE_BOAT_ARCHIVE);
  const S = STEP, y0 = MEASURED.deckY;
  box(bench, TEX.grate, [0, (y0 + S.topY) / 2, (S.z0 + S.z1) / 2], [S.halfX, (S.topY - y0) / 2, (S.z1 - S.z0) / 2], { tile: LARGE_BOAT_TILE.grate, skip: [0, 1, 3, 4, 5] });
  box(bench, TEX.trim, [0, (y0 + S.topY) / 2, (S.z0 + S.z1) / 2], [S.halfX, (S.topY - y0) / 2, (S.z1 - S.z0) / 2], { tile: LARGE_BOAT_TILE.trim, skip: [2, 3] });
  box(bench, TEX.deck, [0, (y0 + S.treadY) / 2, (S.z1 + S.treadZ1) / 2], [S.halfX * 0.6, (S.treadY - y0) / 2, (S.treadZ1 - S.z1) / 2], { tile: LARGE_BOAT_TILE.deck, skip: [3] });
  return bench.finish();
}

/** A swivel gun on its post on her gunwale's cap, in its post's frame (the post's foot at its origin on the cap, the
 *  barrel out along +x): the galleon's chaser, turned. */
const swivelGeometry = () => inArchive(chaserGeometry(SWIVELS.y - MEASURED.gunwaleY), LARGE_BOAT_ARCHIVE);

// ── the clips ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** Her helm's clips over the mod's Rudder Controller (the large boat's own states: rowing and sailing): the rudder and
 *  its tiller turned RUDDER_DEG about her post sailing or rowing either way, and amidships rowing ahead, astern or
 *  still. The rudder rides `RudderPost/HelmRudder` (the post's frame its parent's). */
export function largeBoatClips() {
  const clips = {}, overrides = {};
  const at = (deg) => [eulerCurve('RudderPost/HelmRudder', [0, deg, 0])];
  const swaps = [];
  for (const [state, deg] of [['Rudder Sailing Left', RUDDER_DEG], ['Rudder Sailing Right', -RUDDER_DEG], ['Rudder Rowing Left', RUDDER_DEG], ['Rudder Rowing Right', -RUDDER_DEG], ['Rudder Rowing Center', 0], ['Rudder Rowing Forward', 0], ['Rudder Rowing Backward', 0]]) {
    const name = `largeboat2/${state}`;
    clips[name] = constClip(name, at(deg));
    swaps.push([`clips/${state}`, name]);
  }
  overrides['largeboat2/Rudder'] = { base: 'Rudder Controller', clips: swaps };
  return { clips, overrides };
}

// ── the prefab ─────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The new large boat as Come Sail Away's data (world/carrackModel.js carrackPrefab's shape): her prefab tree, the
 * components she adds (from `base` in the shared table), her meshes by key, and the clips and overrides she adds.
 * @param {any} bake - largeBoat.json
 * @param {{ prefabs: Record<string, any>, components: any[] }} csa - Come Sail Away's prefabs.json (the mod's large
 *   boat's own small things are copied out of its tree, and the galleon's short lantern pole)
 * @param {number} [base]
 */
export function largeBoatPrefab(bake, csa, base = csa.components.length) {
  const { comp, mesh, renderer, meshNode, animator, skinned, finish, meshes } = prefabBench(base, 'largeBoat');
  const cx = { archive: LARGE_BOAT_ARCHIVE, mesh, comp, skinned, meshes, geometryOf: (key) => meshes[key], modBoat: csa.prefabs[String(LARGE_BOAT_PREFAB_ID)] };
  const part = (role) => partOf(bake, role, 'largeBoat');
  const fromPrefab = (id, ship) => (name, at = {}) => {
    const n = clone(findNode(csa.prefabs[String(id)], name));
    if (!n) throw new Error(`largeBoat: Come Sail Away's ${ship} has no ${name}`);
    if (at.p) n.position = [...at.p];
    if (at.r) n.rotation = [...at.r];
    if (at.name) n.name = at.name;
    return n;
  };
  const fromBoat = fromPrefab(LARGE_BOAT_PREFAB_ID, 'large boat'), fromGalleon = fromPrefab(GALLEON_ID, 'galleon');
  const M = MEASURED, D = M.deckY;
  const kids = [];
  const hull = part('hull');

  // ── her own: the helm ──
  kids.push(nodeOf('DriveTrigger', { p: HELM.trigger }));
  kids.push(nodeOf('DrivePosition', { p: HELM.stand }));

  // ── Mac's model ──
  // her stern rail draws on its own node and stands in the hull's collider (below), as the carrack's houses do
  kids.push(meshNode('SternRail', 'largeBoat:sternRail', drawn(part('sternRail'))));
  const solid = (role, name, extra = null) => {
    const plain = drawn(part(role));
    if (!extra) return meshNode(name, `largeBoat:${role}`, plain, { collider: true });
    const bench = new MeshBench(LARGE_BOAT_ARCHIVE);
    benchPart(bench, part(role), { offset: [0, 0, 0], role, keep: null, skin: faceSkin });
    extra(bench, part(role));
    return meshNode(name, `largeBoat:${role}`, bench.finish(), { collider: true, colliderGeometry: plain });
  };
  kids.push(solid('deck', 'Deck'));
  kids.push(solid('mast', 'Mast', (b, p) => mastCap(b, p, faceSkin)));
  kids.push(solid('mastStep', 'MastStep'));
  kids.push(solid('bowsprit', 'Bowsprit'));
  kids.push(meshNode('HelmStep', 'largeBoat:helmStep', helmStepGeometry(), { collider: true }));

  // her swivel guns: three a side on her gunwale's cap, one at her stem
  mesh('largeBoat:swivel', swivelGeometry());
  const swivel = (name, p, deg) => nodeOf(name, { p, r: yaw(deg), c: [comp({ type: 'MeshFilter', m_Mesh: { mesh: 'largeBoat:swivel' } }), renderer(meshes['largeBoat:swivel'])] });
  for (const [side, s] of /** @type {const} */ ([['Starboard', 1], ['Port', -1]])) SWIVELS.z.forEach((z, i) => kids.push(swivel(`Swivel${side}${i}`, [s * SWIVELS.postX, M.gunwaleY, z], s > 0 ? 90 : -90)));
  kids.push(swivel('SwivelBow', [SWIVELS.bow[0], M.gunwaleY, SWIVELS.bow[1]], 0));

  // the helm: the RudderObject the mod's Rudder Controller plays, her rudder and its tiller turning about her post
  mesh('largeBoat:rudder', rudderGeometry());
  kids.push(nodeOf('RudderObject', {
    c: [animator('largeboat2/Rudder')],
    kids: [nodeOf('RudderPost', { p: M.postFoot, r: [Math.sin((POST_RAKE_DEG * Math.PI) / 360), 0, 0, Math.cos((POST_RAKE_DEG * Math.PI) / 360)], kids: [
      nodeOf('HelmRudder', { c: [comp({ type: 'MeshFilter', m_Mesh: { mesh: 'largeBoat:rudder' } }), renderer(meshes['largeBoat:rudder'])] }),
    ] })],
  }));

  // her rig: the seven sail plans under `Variants` (each switched off - the walk switches on the boat's own), and the
  // VariantTrigger at her mast
  const rig = buildLargeBoatRig(cx);
  kids.push(nodeOf('Variants', { kids: rig.variants }));
  kids.push(...rig.kids);
  kids.push(nodeOf('VariantTrigger', { p: [M.mast.x, 1.95, M.mast.z] }));

  // ── Come Sail Away's own small things, stood in her ──
  // sailing: the anchor stowed on her foredeck; idle: the boarding flat down her stem and the board trigger there,
  // three metres tall as the mod's, its BoardPosition on her foredeck
  kids.push(nodeOf('ActiveObject', { kids: [fromBoat('SkiffAnchor', { p: [0, D + 0.034, ANCHOR_Z] })] }));
  const board = [0, 0.75, 6.75];
  kids.push(nodeOf('IdleObject', { kids: [
    fromBoat('BillboardHelper-253_015:2', { p: [0, M.gunwaleY + 0.08, M.stemHead[2] + 0.05] }),
    nodeOf('BoardTrigger', { p: board, s: [1, 3, 1], kids: [nodeOf('BoardPosition', { p: [0, (D + 0.05 - board[1]) / 3, 4.0 - board[2]], r: yaw(180) })] }),
  ] }));
  // her cargo on her deck forward of her mast, and its trigger over it
  kids.push(fromBoat('SkiffCargo', { p: [0, D, 1.5] }));
  kids.push(nodeOf('CargoTrigger', { p: [0, D + 0.85, 1.5] }));
  kids.push(fromBoat('FireObject'), fromBoat('BedObject'));
  // her lanterns, hung outboard as the mod hangs its own: the mod's tall pole on her gunwale's cap at her starboard
  // bow (her stem carries her bow swivel, and her stays and staysails come down over it), its hook square to her side
  // there; a short pole on her stern rail's cap at her port quarter
  kids.push(fromBoat('LanternHookStandPoleTall', { p: [LANTERNS.bow[0], M.gunwaleY, LANTERNS.bow[1]], r: yaw(LANTERNS.bowYaw) }));
  kids.push(fromGalleon('LanternHookStandPoleShort', { p: [-1.735, M.sternRail.capY + 0.003, -4.1], r: yaw(90) }));

  // her hull: the node the boat's frame is, every other part under it - its collider her hull's planking and her stern
  // rail's, one mesh (the first MeshCollider of the tree)
  const hullGeometry = drawn(hull);
  mesh('largeBoat:hull:collider', colliderOf(mergeGeometries([hullGeometry, meshes['largeBoat:sternRail']])));
  const hullNode = meshNode(LARGE_BOAT_HULL_NODE, 'largeBoat:hull', hullGeometry, { kids, c: [comp({ type: 'MeshCollider', m_Enabled: true, m_IsTrigger: false, m_Convex: false, m_Mesh: { mesh: 'largeBoat:hull:collider' } })] });
  const root = nodeOf(String(LARGE_BOAT_PREFAB_ID), { kids: [fromBoat('WakeObject'), hullNode, fromBoat('Modifiers')] });
  if (rig.variants.length !== VARIANT_COUNT) throw new Error(`largeBoat: ${rig.variants.length} sail plans where the mod's boat has ${VARIANT_COUNT}`);

  const { components } = finish(root);
  const own = largeBoatClips();
  return {
    prefab: root, components, meshes,
    animation: { clips: { ...own.clips, ...rig.clips }, overrides: { ...own.overrides, ...rig.overrides } },
  };
}
