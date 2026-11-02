import { Arch3dFile } from '../../../src/formats/arch3dFile.js';
import { openOut, out, closeOut, read, pad, sha1, F, BW } from './common.mjs';

openOut(process.argv[2]);
const a3d = new Arch3dFile();
if (!a3d.load(read('ARCH3D.BSA'))) { out('arch3d.load', 'FAIL'); }
else {
  a3d.autoDiscard = true;
  out('arch3d.count', a3d.count);
  for (let i = 0; i < a3d.count; i++) {
    const p = `arch3d.${pad(i, 5)}.`;
    out(p + 'id', a3d.getRecordId(i));
    const m = a3d.getMesh(i);
    out(p + 'objectId', m.objectId);
    out(p + 'radius', F(m.radius));
    out(p + 'sizeX', F(m.size.x)); out(p + 'sizeY', F(m.size.y)); out(p + 'sizeZ', F(m.size.z));
    out(p + 'centreX', F(m.centre.x)); out(p + 'centreY', F(m.centre.y)); out(p + 'centreZ', F(m.centre.z));
    out(p + 'totalVertices', m.totalVertices);
    out(p + 'totalTriangles', m.totalTriangles);
    out(p + 'subMeshes', m.subMeshes === null || m.subMeshes === undefined ? -1 : m.subMeshes.length);
    if (!m.subMeshes) continue;
    const bw = new BW();
    for (let s = 0; s < m.subMeshes.length; s++) {
      const sm = m.subMeshes[s];
      const ps = `${p}sm${pad(s, 3)}.`;
      out(ps + 'archive', sm.textureArchive);
      out(ps + 'record', sm.textureRecord);
      out(ps + 'tris', sm.totalTriangles);
      out(ps + 'planes', sm.planes === null || sm.planes === undefined ? -1 : sm.planes.length);
      bw.i32(sm.textureArchive); bw.i32(sm.textureRecord); bw.i32(sm.totalTriangles);
      if (!sm.planes) continue;
      for (let pl = 0; pl < sm.planes.length; pl++) {
        const plane = sm.planes[pl];
        bw.i32(plane.uvGenerationMethod);
        bw.i32(plane.points === null || plane.points === undefined ? -1 : plane.points.length);
        if (!plane.points) continue;
        for (const pt of plane.points) {
          bw.f32(pt.x); bw.f32(pt.y); bw.f32(pt.z);
          bw.f32(pt.nx); bw.f32(pt.ny); bw.f32(pt.nz);
          bw.f32(pt.u); bw.f32(pt.v);
        }
      }
    }
    out(p + 'meshSha', sha1(bw.bytes()));
  }
}
await closeOut();
