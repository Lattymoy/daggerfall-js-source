// DFMesh -> engine model conversion.
// 1:1 translation of the geometry paths of Daggerfall Unity's MeshReader.cs
// (MIT, Daggerfall Workshop): LoadVertices and LoadIndices. Conventions kept
// verbatim:
//   - GlobalScale 0.025; position = (X, -Y, Z) * scale.
//   - normal = normalize(NX, -NY, NZ).
//   - uv = (U / textureWidth, -(V / textureHeight)) - negative V relies on
//     REPEAT wrapping, exactly as DFU.
//   - Each plane is a triangle fan from point 0 indexed [shared, vc+1, vc].
// Door extraction (ModelDoor, archives 74/56/331/156/95) is gameplay metadata
// consumed by the Player arc; it is not built here yet and is tracked in
// bible/03-World/World-Arc.md.

export const GLOBAL_SCALE = 0.025; // Default scale

/**
 * Convert a decomposed DFMesh into flat GPU-ready buffers.
 * @param {object} dfMesh - output of Arch3dFile.getMesh().
 * @param {(archive:number, record:number) => {width:number,height:number}} getTextureSize
 *   Record dimensions used to finalize UVs (DFU pulls these from cached
 *   materials; we pull them from TextureFile).
 * @returns {{positions:Float32Array,normals:Float32Array,uvs:Float32Array,
 *   indices:Uint32Array,subMeshes:Array<{textureArchive:number,textureRecord:number,
 *   startIndex:number,primitiveCount:number}>}}
 */
export function dfMeshToModel(dfMesh, getTextureSize) {
  const totalVertices = dfMesh.totalVertices;
  const positions = new Float32Array(totalVertices * 3);
  const normals = new Float32Array(totalVertices * 3);
  const uvs = new Float32Array(totalVertices * 2);
  const indices = new Uint32Array(dfMesh.totalTriangles * 3);
  const subMeshes = new Array(dfMesh.subMeshes.length);

  // LoadVertices.
  let vertexCount = 0;
  for (const sm of dfMesh.subMeshes) {
    const sz = getTextureSize(sm.textureArchive, sm.textureRecord);
    for (const plane of sm.planes) {
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

  return { positions, normals, uvs, indices, subMeshes };
}
