// Character mesh packing (Characters C4b).
// Rewrite-rig faces ({p: flat verts 3f/vtx, n: normal, c: [r,g,b]
// 0-255}) into the renderer's interleaved character vertex stream:
// [pos.xyz, color.rgb (0-1), normal.xyz] per vertex, faces
// fan-triangulated (v0, vi, vi+1) exactly like the engine's own
// consumer. Dagger departures from Voxlight's meshFromFaces, by
// design: REAL normals ride the stream (dagger's character program
// lights in-shader with the scene's ambient/sun/point model - no
// baked cel shade, no pixel-lock ref-slot), and no eye-space culling -
// instead drawCharacter DISABLES GL back-face culling for its draws
// (rig winding is inconsistent by upstream design; the authored
// normals are correct and light the faces).

/** @returns {Float32Array} interleaved 9 floats/vertex */
export function packCharacterFaces(faces) {
  let tris = 0;
  for (const f of faces) tris += f.p.length / 3 - 2;
  const out = new Float32Array(tris * 3 * 9);
  let o = 0;
  const put = (f, vi, r, g, b) => {
    out[o++] = f.p[vi * 3];
    out[o++] = f.p[vi * 3 + 1];
    out[o++] = f.p[vi * 3 + 2];
    out[o++] = r; out[o++] = g; out[o++] = b;
    out[o++] = f.n[0]; out[o++] = f.n[1]; out[o++] = f.n[2];
  };
  for (const f of faces) {
    const r = f.c[0] / 255, g = f.c[1] / 255, b = f.c[2] / 255;
    const np = f.p.length / 3;
    for (let i = 1; i < np - 1; i++) {
      put(f, 0, r, g, b);
      put(f, i, r, g, b);
      put(f, i + 1, r, g, b);
    }
  }
  return out;
}

/** Bounding box of a face set (for height-normalising a rig pose). */
export function facesBounds(faces) {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (const f of faces) {
    for (let i = 0; i < f.p.length; i += 3) {
      minX = Math.min(minX, f.p[i]); maxX = Math.max(maxX, f.p[i]);
      minY = Math.min(minY, f.p[i + 1]); maxY = Math.max(maxY, f.p[i + 1]);
      minZ = Math.min(minZ, f.p[i + 2]); maxZ = Math.max(maxZ, f.p[i + 2]);
    }
  }
  return { minX, minY, minZ, maxX, maxY, maxZ };
}
