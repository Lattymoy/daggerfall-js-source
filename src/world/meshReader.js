// DFMesh -> engine model conversion.
// 1:1 translation of the geometry paths of Daggerfall Unity's MeshReader.cs
// (MIT, Daggerfall Workshop): LoadVertices and LoadIndices. Conventions kept
// verbatim:
//   - GlobalScale 0.025; position = (X, -Y, Z) * scale.
//   - normal = normalize(NX, -NY, NZ).
//   - uv = (U / textureWidth, -(V / textureHeight)) - negative V relies on
//     REPEAT wrapping, exactly as DFU.
//   - Each plane is a triangle fan from point 0 indexed [shared, vc+1, vc].
//   - ModelDoor extraction runs inside the vertex pass exactly as DFU's
//     LoadVertices: door archives 74 (building), 56 (dungeon enter),
//     331 (dungeon ruin enter, record 0 is plain stone and skipped),
//     95 (dungeon exit); 156 (Scourg exterior) only exempts the base-archive
//     reduction and never becomes a door itself. Archives > 100 reduce to
//     archive - trunc(archive/100)*100 for the check (climate variants),
//     except 331/156. Each plane of a door submesh is one door; Index resets
//     per submesh (verbatim DFU doorCount scope). Verts are the plane's first
//     three points in model space; Normal = normalize(cross(v0-v2, v0-v1)).

export const GLOBAL_SCALE = 0.025; // Default scale

// DFU DoorTypes enum, same order.
export const DOOR_TYPE = {
  NONE: 0,
  BUILDING: 1,
  DUNGEON_ENTRANCE: 2,
  DUNGEON_EXIT: 3,
};

// LoadVertices door archive constants, verbatim.
const BUILDING_DOORS = 74;
const DUNGEON_ENTER_DOORS = 56;
const DUNGEON_RUIN_ENTER_DOORS = 331;
const SCOURG_EXTERIOR = 156;
const DUNGEON_EXIT_DOORS = 95;

/**
 * LoadVertices' door law for one submesh, alone (OW-DUNGEONS, 2026-10-08): the door type its texture archive - and for
 * the ruins' archive its record - makes it, NONE where it is no door. dfMeshToModel reads every door through it, and
 * the Overworld's dungeon models (systems/travelDungeonModels.js) ask it of a mesh's submeshes without building it.
 * @param {number} textureArchive @param {number} textureRecord @returns {number} a DOOR_TYPE
 */
export function subMeshDoorType(textureArchive, textureRecord) {
  // Base climate archive for the door check. All base door textures are
  // > 100 with some exceptions (verbatim DFU).
  let doorArchive = textureArchive;
  if (
    doorArchive > 100 &&
    doorArchive !== DUNGEON_RUIN_ENTER_DOORS &&
    doorArchive !== SCOURG_EXTERIOR
  ) {
    doorArchive = textureArchive - Math.trunc(textureArchive / 100) * 100;
  }
  switch (doorArchive) {
    case BUILDING_DOORS:
      return DOOR_TYPE.BUILDING;
    case DUNGEON_ENTER_DOORS:
      return DOOR_TYPE.DUNGEON_ENTRANCE;
    case DUNGEON_RUIN_ENTER_DOORS:
      return textureRecord > 0 ? DOOR_TYPE.DUNGEON_ENTRANCE : DOOR_TYPE.NONE;   // Dungeon ruins index 0 is just a stone texture
    case DUNGEON_EXIT_DOORS:
      return DOOR_TYPE.DUNGEON_EXIT;
    default:
      return DOOR_TYPE.NONE;
  }
}

/**
 * Convert a decomposed DFMesh into flat GPU-ready buffers.
 * @param {object} dfMesh - output of Arch3dFile.getMesh().
 * @param {(archive:number, record:number) => {width:number,height:number}} getTextureSize
 *   Record dimensions used to finalize UVs (DFU pulls these from cached
 *   materials; we pull them from TextureFile).
 * @returns {{positions:Float32Array,normals:Float32Array,uvs:Float32Array,
 *   indices:Uint32Array,subMeshes:Array<{textureArchive:number,textureRecord:number,
 *   startIndex:number,primitiveCount:number}>,
 *   doors:Array<{index:number,type:number,
 *     vert0:{x,y,z},vert1:{x,y,z},vert2:{x,y,z},normal:{x,y,z}}>}}
 */
export function dfMeshToModel(dfMesh, getTextureSize) {
  const totalVertices = dfMesh.totalVertices;
  const positions = new Float32Array(totalVertices * 3);
  const normals = new Float32Array(totalVertices * 3);
  const uvs = new Float32Array(totalVertices * 2);
  const indices = new Uint32Array(dfMesh.totalTriangles * 3);
  const subMeshes = new Array(dfMesh.subMeshes.length);

  // LoadVertices.
  const doors = [];
  let vertexCount = 0;
  for (const sm of dfMesh.subMeshes) {
    const sz = getTextureSize(sm.textureArchive, sm.textureRecord);

    // OW-DUNGEONS: the door law is subMeshDoorType's, below - one home for it (the Overworld's dungeon models ask it of a
    // mesh they never build)
    const doorType = subMeshDoorType(sm.textureArchive, sm.textureRecord);
    const doorFound = doorType !== DOOR_TYPE.NONE;

    let doorCount = 0; // Resets per submesh, verbatim DFU scope.
    for (const plane of sm.planes) {
      // If this is a door then each plane is a single door.
      if (doorFound) {
        const p0 = plane.points[0];
        const p1 = plane.points[1];
        const p2 = plane.points[2];
        const vert0 = {
          x: p0.x * GLOBAL_SCALE, y: -p0.y * GLOBAL_SCALE, z: p0.z * GLOBAL_SCALE,
        };
        const vert1 = {
          x: p1.x * GLOBAL_SCALE, y: -p1.y * GLOBAL_SCALE, z: p1.z * GLOBAL_SCALE,
        };
        const vert2 = {
          x: p2.x * GLOBAL_SCALE, y: -p2.y * GLOBAL_SCALE, z: p2.z * GLOBAL_SCALE,
        };
        // Normal facing away from door: normalize(cross(v0 - v2, v0 - v1)).
        const ux = vert0.x - vert2.x, uy = vert0.y - vert2.y, uz = vert0.z - vert2.z;
        const vx = vert0.x - vert1.x, vy = vert0.y - vert1.y, vz = vert0.z - vert1.z;
        let nx = uy * vz - uz * vy;
        let ny = uz * vx - ux * vz;
        let nz = ux * vy - uy * vx;
        const nl = Math.hypot(nx, ny, nz) || 1;
        nx /= nl; ny /= nl; nz /= nl;
        doors.push({
          index: doorCount++,
          type: doorType,
          vert0, vert1, vert2,
          normal: { x: nx, y: ny, z: nz },
        });
      }

      for (const p of plane.points) {
        const vi = vertexCount * 3;
        positions[vi] = p.x * GLOBAL_SCALE;
        positions[vi + 1] = -p.y * GLOBAL_SCALE;
        positions[vi + 2] = p.z * GLOBAL_SCALE;

        const nx = p.nx;
        const ny = -p.ny;
        const nz = p.nz;
        const nl = Math.hypot(nx, ny, nz) || 1;
        normals[vi] = nx / nl;
        normals[vi + 1] = ny / nl;
        normals[vi + 2] = nz / nl;

        uvs[vertexCount * 2] = p.u / sz.width;
        uvs[vertexCount * 2 + 1] = -(p.v / sz.height);

        vertexCount++;
      }
    }
  }

  // LoadIndices.
  let indexCount = 0;
  let subMeshCount = 0;
  let vc = 0;
  for (const sm of dfMesh.subMeshes) {
    subMeshes[subMeshCount] = {
      textureArchive: sm.textureArchive,
      textureRecord: sm.textureRecord,
      startIndex: indexCount,
      primitiveCount: sm.totalTriangles,
    };
    for (const plane of sm.planes) {
      // Every plane is a triangle fan radiating from point 0.
      const sharedPoint = vc++;
      for (let tri = 0; tri < plane.points.length - 2; tri++) {
        indices[indexCount++] = sharedPoint;
        indices[indexCount++] = vc + 1;
        indices[indexCount++] = vc;
        vc++;
      }
      // Advance to start of next fan in the vertex buffer.
      vc++;
    }
    subMeshCount++;
  }

  return { positions, normals, uvs, indices, subMeshes, doors };
}
