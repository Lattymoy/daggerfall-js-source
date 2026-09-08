// STATIC BUILDINGS - RMBLayout's per-subrecord StaticBuilding array
// (Utility/RMBLayout.cs:864-882) and DaggerfallStaticBuildings.HasHit
// (Internal/DaggerfallStaticBuildings.cs:54-92), the pair PlayerActivate
// consults before anything else it might have hit above ground
// (Game/PlayerActivate.cs:340-361).
//
// RMBLayout builds ONE StaticBuilding per subrecord, off the FIRST model
// of the record that actually loaded ("First model is main record
// structure, others are attachments like posts / Only main structure is
// needed to resolve building after hit-test", :866-869):
//
//   staticBuilding.modelMatrix = modelMatrix;                    (:871)
//   staticBuilding.recordIndex = recordCount;                    (:872)
//   staticBuilding.size   = DFMesh.Size * MeshReader.GlobalScale;(:873)
//   staticBuilding.centre = (0, DFMesh.Size.Y / 2, 0) * GlobalScale;
//        // "All DF meshes are already centred on X & Z"          (:874)
//
// THE BOX IS THE MODEL'S OWN WORLD SILHOUETTE, and the units line up
// because DFMesh's SIZE and DFMesh's POINTS are divided by the same
// Arch3dFile pointDivisor. Arch3dFile.cs:695-697 stores the RAW native
// point values into PureMesh.Planes[].Points[]; :711-713 builds the size
// from those same raw extremes as `maxX / pointDivisor - minX /
// pointDivisor`; :714 stores it as PureMesh.Size and :846 copies it
// straight over as `records[record].DFMesh.Size`. The DFMesh POINT
// buffer is written by WritePoint (:941-943, doc comment at :935
// "Vector coordinates are divided by 256.0f"), which divides those same
// raw PureMesh points by the SAME pointDivisor - so the two are in
// identical units. MeshReader.cs:717 then lays the vertices down as
// `new Vector3(dfPoint.X, -dfPoint.Y, dfPoint.Z) * scale` off that
// already-divided buffer, which makes `DFMesh.Size * GlobalScale`
// exactly the vertex AABB extent in world units: the building's
// silhouette. RMBLayout's own alternative branch says the same thing out
// loud - when a custom GameObject supplies the model it takes
// `goRenderer.bounds.size` (:876-878), a true world extent, for the very
// same member.
//
// (An earlier reading of this lane recorded the box as one 256th of the
// mesh, on the theory that the Size was divided while the vertices were
// not. It is wrong: WritePoint divides the vertices too. The shipped
// arithmetic never changed - it copies :873-874 - but the reasoning and
// its "the arm only fires at the model origin" consequence are struck.)
//
// HasHit places a temp BoxCollider at the matrix translation (plus the
// block parent's position), rotates it by the matrix, sets
// `c.center = centre` and `c.size = size * 1.01f`, then asks
// `c.bounds.Contains(point)` (:73-86). `Collider.bounds` is the WORLD
// AXIS-ALIGNED bounds of that rotated box, so the effective test is
// point-in-AABB-of-the-rotated-box - NOT an oriented-box test, which
// would be tighter than DFU on every rotated shop.
import { GLOBAL_SCALE } from './meshReader.js';

/** RMBLayout.cs:873-874, off Arch3dFile's DFMesh.Size. */
export function staticBuildingBox(dfMeshSize) {
  const s = dfMeshSize ?? { x: 0, y: 0, z: 0 };
  return {
    size: [s.x * GLOBAL_SCALE, s.y * GLOBAL_SCALE, s.z * GLOBAL_SCALE],
    centre: [0, (s.y / 2) * GLOBAL_SCALE, 0],
  };
}

/** The world AABB of the 1.01-inflated box under `matrix` - DFU's
 *  `c.bounds` (DaggerfallStaticBuildings.cs:73-81). `matrix` is the
 *  column-major 4x4 the layout composed; only its rotation and
 *  translation are read, exactly as the temp collider's transform is. */
export function staticBuildingWorldAabb({ size, centre }, matrix) {
  const hx = (size[0] * 1.01) / 2;
  const hy = (size[1] * 1.01) / 2;
  const hz = (size[2] * 1.01) / 2;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < 8; i++) {
    const lx = centre[0] + ((i & 1) ? hx : -hx);
    const ly = centre[1] + ((i & 2) ? hy : -hy);
    const lz = centre[2] + ((i & 4) ? hz : -hz);
    const wx = matrix[0] * lx + matrix[4] * ly + matrix[8] * lz + matrix[12];
    const wy = matrix[1] * lx + matrix[5] * ly + matrix[9] * lz + matrix[13];
    const wz = matrix[2] * lx + matrix[6] * ly + matrix[10] * lz + matrix[14];
    if (wx < min[0]) min[0] = wx; if (wx > max[0]) max[0] = wx;
    if (wy < min[1]) min[1] = wy; if (wy > max[1]) max[1] = wy;
    if (wz < min[2]) min[2] = wz; if (wz > max[2]) max[2] = wz;
  }
  return { min, max };
}

/** HasHit (DaggerfallStaticBuildings.cs:54-92): the FIRST building whose
 *  world box contains the ray's hit point, or null. DFU breaks on the
 *  first match, so array order decides. */
export function staticBuildingsHasHit(buildings, point) {
  for (const b of buildings) {
    const { min, max } = b.aabb;
    if (point[0] >= min[0] && point[0] <= max[0]
      && point[1] >= min[1] && point[1] <= max[1]
      && point[2] >= min[2] && point[2] <= max[2]) return b;
  }
  return null;
}
