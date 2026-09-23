// ═══════════════════════════════════════════════════════════════════
// WOD2 - WORLD OF DAGGERFALL: WHAT ONE PREFAB OBJECT BECOMES.
//
// LocationHelper.LoadObject (LocationHelper.cs:1167-1247) and the
// helpers it calls - AddLight (:1254-1475), AddAnimalAudioSource
// (:1481-1515) and the Add*Spawn family (:1559-1647) - as DATA the
// streaming host stands. Cites are to vendor/world-of-daggerfall/Scripts/.
//
//   type 0 - CreateDaggerfallMeshGameObject(uint.Parse(name)): a classic
//            model WITH its MeshCollider (DFU's Option_AddMeshColliders),
//            NO climate swap (only a DaggerfallLocation re-skins its
//            children, and these hang off the terrain) and NO doors (a
//            static door is RMBLayout's, never GameObjectHelper's).
//   type 1 - a flat, `ARCHIVE.RECORD`, whose ARCHIVE STRING picks the rest:
//            "216"  a treasure container (while a player entity exists,
//                   which in a streamed world it always does), then
//                   AddLootSpawn;
//            "210"  AddLight - the mod's OWN copy of DaggerfallInterior's,
//                   which differs from it in two arms (below);
//            "201"  AddAnimalAudioSource - RMBLayout's table, verbatim, so
//                   the port's ANIMAL_SOUND_BY_RECORD is that table;
//            "479" / "483" / "457" / "478" / ("357", "6")
//                   the spawn MARKERS (LocationEnemySpawner).
//
// THE MARKERS ARE INVISIBLE, AND THAT IS READ OFF THE SHADER. Every
// Add*Spawn sets `GetComponentInChildren<MeshRenderer>().material.color
// = new Color(1, 1, 1, 0.1f)`; DFU's billboard shader multiplies the
// texel by _Color and alpha-tests at _Cutoff 0.5 (DaggerfallBillboard
// .shader: `albedo = tex2D(...) * _Color`, `alphatest:_Cutoff`), so a
// 0.1 alpha discards every texel. A bandit marker is a spawn point, not
// a bandit standing there - the treasure container under AddLootSpawn
// included. An editor flat (archive 199) is hidden too, by
// DaggerfallBillboard.Start. A LEAF: no imports.
// ═══════════════════════════════════════════════════════════════════

export const WOD_LIGHTS_ARCHIVE = 210;
export const WOD_ANIMALS_ARCHIVE = 201;
export const WOD_TREASURE_ARCHIVE = 216;
export const WOD_EDITOR_ARCHIVE = 199;   // FlatTypes.Editor - DaggerfallBillboard.Start disables the renderer

/** LocationEnemySpawner.SpawnType (LocationEnemySpawner.cs:28-35). */
export const WOD_SPAWN_TYPE = Object.freeze({ Quest: 0, BillboardPerson: 1, Enemy: 2, Loot: 3, Good: 4 });
/** LocationEnemySpawner.enemyID (:37-40). */
export const WOD_ENEMY_ID = Object.freeze({ Bandits: 1, Bears: 2, Warriors: 3 });

/** uint.Parse over a name ValidateValue already accepted as an Int32:
 *  a negative one is the C#'s OverflowException - null here. */
function parseUInt(name) {
  const n = Number(name.trim());
  return Number.isInteger(n) && n >= 0 ? n : null;
}

/**
 * LoadObject's decision for one prefab object (type and name already
 * through ValidateValue). Answers what to stand, never how.
 * @param {{type:number, name:string}} obj
 * @returns {{kind:'model', modelId:?number} | {kind:'flat', archive:number,
 *   record:number, visible:boolean, light:boolean, animal:boolean,
 *   treasure:boolean, spawners:Array<{spawnType:number, enemyID:number, questID:number}>}}
 */
export function classifyObject(obj) {
  if (obj.type === 0) return { kind: 'model', modelId: parseUInt(obj.name) };
  const arg = obj.name.split('.');
  const archive = Number(arg[0]);
  const record = Number(arg[1]);
  // :1199 - the loot container arm (PlayerEntity is never null while a
  // world streams), else the plain billboard (:1207).
  const treasure = arg[0] === '216';
  const spawners = [];
  // :1203 - the container's own AddLootSpawn...
  if (treasure) spawners.push({ spawnType: WOD_SPAWN_TYPE.Loot, enemyID: 0, questID: 0 });
  if (arg[0] === '479') spawners.push({ spawnType: WOD_SPAWN_TYPE.Enemy, enemyID: WOD_ENEMY_ID.Bandits, questID: 0 });   // :1218-1219
  if (arg[0] === '483') spawners.push({ spawnType: WOD_SPAWN_TYPE.Good, enemyID: WOD_ENEMY_ID.Bandits, questID: 0 });    // :1221-1222
  if (arg[0] === '457') spawners.push({ spawnType: WOD_SPAWN_TYPE.Enemy, enemyID: WOD_ENEMY_ID.Bears, questID: 0 });    // :1224-1225
  // :1227-1228 - ...and AddLootSpawn AGAIN. On a container that already
  // carries one this ADDS A SECOND LocationEnemySpawner, and
  // GetComponent<> hands the first back to be set, so the second keeps
  // the class defaults - SpawnType 0, the quest arm. It never runs: the
  // first component's Update deactivates the GameObject on the frame
  // either could act (SpawnLoot ends in SetActive(false)), and Unity
  // calls no further Update on an inactive object. So one spawner.
  if (arg[0] === '357' && arg[1] === '6') spawners.push({ spawnType: WOD_SPAWN_TYPE.Quest, enemyID: 0, questID: 0 });   // :1230-1231
  if (arg[0] === '478') spawners.push({ spawnType: WOD_SPAWN_TYPE.Enemy, enemyID: WOD_ENEMY_ID.Warriors, questID: 0 });   // :1233-1234
  return {
    kind: 'flat',
    archive,
    record,
    // Every Add*Spawn blanks the flat (the alpha-0.1 colour above); an
    // editor flat is hidden by its own billboard.
    visible: spawners.length === 0 && archive !== WOD_EDITOR_ARCHIVE,
    light: arg[0] === '210',     // :1211-1212
    animal: arg[0] === '201',    // :1214-1215
    treasure,
    spawners,
  };
}

// ── AddLight ─────────────────────────────────────────────────────────

/** Its FIRST switch (:1261-1353), the light's local lift above the
 *  flat's centre: a number, or 'half' (size.y / 2) or 'fifth'
 *  (size.y / 2.4). DaggerfallInterior's has the same arms but for one:
 *  the mod lifts record 29 (Street Lantern 2) by half its height where
 *  DFU's is a "todo". */
const LIGHT_LIFT = new Map([
  [0, -0.1], [2, 0.1], [3, 0.1], [5, 0.15], [6, 0.6], [9, 0.4],
  [11, -0.4], [13, -0.35], [14, 'half'], [15, 'half'], [17, 0.2], [20, 0.6],
  [21, 'fifth'], [22, -0.5], [24, -1.85], [25, -1.0], [27, -0.02], [29, 'half'],
]);

// The light starts as DaggerfallUnity.Option_InteriorLightPrefab's own
// ("DaggerfallLight [Interior]": point, white, intensity 1, range 15,
// not animated - world/interiorLights.js carries the same prefab).
const PREFAB = Object.freeze({ range: 15, intensity: 1, color: Object.freeze([1, 1, 1]) });
const c32 = (r, g, b) => Object.freeze([r / 255, g / 255, b / 255]);
const L = (range, intensity, color) => Object.freeze({ range, intensity, color: color ? Object.freeze(color) : PREFAB.color });

/** Its SECOND switch (:1354-1474), resolved against the prefab. Two arms
 *  are the mod's own and NOT DaggerfallInterior's: record 0 (Bowl of
 *  Fire) is intensity 1.2, range 15, Color32(255, 147, 41) - DFU's is
 *  1.1, 20 and a pale yellow - and a DEFAULT arm does the same for any
 *  record past 29, where DFU's switch has none. The "todo" arms (1, 7,
 *  10, 12, 14, 15, 16, 18, 19, 23, 28, 29) leave the prefab's light. */
const LIGHT_PROPS = new Map([
  [0, L(15, 1.2, c32(255, 147, 41))],
  [2, L(15 / 3, 0.6, [1.0, 0.99, 0.82])],
  [3, L(15 / 3, 1, null)],
  [4, L(15 / 3, 1, null)],
  [5, L(7.5, 0.33, [1.0, 0.89, 0.61])],
  [6, L(15.0, 0.75, [1.0, 0.93, 0.62])],
  [8, L(15, 1, [0.68, 1.0, 0.94])],
  [9, L(15.0, 0.65, [1.0, 0.92, 0.6])],
  [11, L(5.0, 0.5, null)],
  [13, L(15 * 1.2, 1.1, [0.93, 0.84, 0.49])],
  [17, L(15, 0.8, [1.0, 0.97, 0.87])],
  [20, L(12.0, 0.75, [1.0, 0.92, 0.72])],
  [21, L(15 / 3, 0.5, [1.0, 0.95, 0.67])],
  [22, L(15, 1.5, [1.0, 0.95, 0.78])],
  [24, L(15, 1.4, [1.0, 0.98, 0.64])],
  [25, L(15, 1.4, [1.0, 0.98, 0.64])],
  [26, L(15, 1.4, [1.0, 0.98, 0.64])],
  [27, L(15, 1.4, [1.0, 0.98, 0.64])],
]);
const DEFAULT_ARM = L(15, 1.2, c32(255, 147, 41));

/** AddLight's properties for a record: the mod's switch, arm for arm. */
export function wodLightProperties(record) {
  if (LIGHT_PROPS.has(record)) return LIGHT_PROPS.get(record);
  return record >= 0 && record <= 29 ? L(PREFAB.range, PREFAB.intensity, null) : DEFAULT_ARM;
}

/**
 * Where the light sits, tile-local. The light is instantiated as a
 * CHILD of the billboard at the billboard's origin and lifted by the
 * first switch in the billboard's LOCAL space (:1258, :1264-1352); the
 * billboard then gets the object's scale and AlignToBase, so the light
 * ends at the sprite's centre plus the lift, both scaled by the flat's
 * Y scale. `size` is GetScaledBillboardSize(210, record) (the record's
 * own scale, unscaled by the object).
 * @param {number[]} base - the flat's placement base (the object's pos)
 * @param {number} record
 * @param {{w:number,h:number}} size
 * @param {number} scaleY - the object's scale.y
 * @returns {number[]}
 */
export function wodLightPosition(base, record, size, scaleY = 1) {
  const lift = LIGHT_LIFT.get(record);
  const l = lift === 'half' ? size.h / 2 : lift === 'fifth' ? size.h / 2.4 : (lift ?? 0);
  return [base[0], base[1] + (size.h / 2 + l) * scaleY, base[2]];
}

// ── the transform ────────────────────────────────────────────────────

/** A unit quaternion's rotation columns, Unity's component order. */
function rotationColumns({ x, y, z, w }) {
  const n = Math.hypot(x, y, z, w);
  if (n > 0) { x /= n; y /= n; z /= n; w /= n; } else { x = 0; y = 0; z = 0; w = 1; }
  const xx = x * x, yy = y * y, zz = z * z;
  const xy = x * y, xz = x * z, yz = y * z, wx = w * x, wy = w * y, wz = w * z;
  return [
    [1 - 2 * (yy + zz), 2 * (xy + wz), 2 * (xz - wy)],
    [2 * (xy - wz), 1 - 2 * (xx + zz), 2 * (yz + wx)],
    [2 * (xz + wy), 2 * (yz - wx), 1 - 2 * (xx + yy)],
  ];
}

/**
 * The matrix a scaled object's NORMALS take: the inverse transpose of
 * R * S, which is R * S^-1 - each rotation column divided by its scale
 * rather than multiplied. Null when the scale is uniform (the object's
 * own matrix is then exact once renormalised) or degenerate.
 * @returns {?Float32Array}
 */
export function objectNormalMatrix(rot, scale) {
  if (scale.x === scale.y && scale.y === scale.z) return null;
  if (!scale.x || !scale.y || !scale.z) return null;
  const [c0, c1, c2] = rotationColumns(rot);
  // prettier-ignore
  return new Float32Array([
    c0[0] / scale.x, c0[1] / scale.x, c0[2] / scale.x, 0,
    c1[0] / scale.y, c1[1] / scale.y, c1[2] / scale.y, 0,
    c2[0] / scale.z, c2[1] / scale.z, c2[2] / scale.z, 0,
    0, 0, 0, 1,
  ]);
}

/**
 * LoadObject's transform (:1239-1244): `localPosition = pos`,
 * `rotation = rot` (the terrain parent carries none, so world and local
 * agree), `localScale *= scale` - as a column-major matrix,
 * T * R(q) * S, in the tile's own frame. The quaternion is Unity's and
 * the port's world is Unity's frame (mat4.js), so it is used as is,
 * normalized as Unity normalizes a rotation it is handed.
 * @param {number[]} pos
 * @param {{x:number,y:number,z:number,w:number}} rot
 * @param {{x:number,y:number,z:number}} scale
 * @returns {Float32Array}
 */
export function objectMatrix(pos, rot, scale) {
  const [c0, c1, c2] = rotationColumns(rot);
  // prettier-ignore
  return new Float32Array([
    c0[0] * scale.x, c0[1] * scale.x, c0[2] * scale.x, 0,
    c1[0] * scale.y, c1[1] * scale.y, c1[2] * scale.y, 0,
    c2[0] * scale.z, c2[1] * scale.z, c2[2] * scale.z, 0,
    pos[0], pos[1], pos[2], 1,
  ]);
}
