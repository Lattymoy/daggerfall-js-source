import { Arch3dFile } from '../../../src/formats/arch3dFile.js';
import { openOut, out, closeOut, read, pad, F } from './common.mjs';
openOut(process.argv[2]);
const a3d = new Arch3dFile();
a3d.load(read('ARCH3D.BSA'));
a3d.autoDiscard = true;
const i0 = +(process.env.A3D_LO || 0), i1 = +(process.env.A3D_HI || 30);
for (let i = i0; i < i1 && i < a3d.count; i++) {
  const p = `a3d.${pad(i, 5)}.`;
  const m = a3d.getMesh(i);
  if (!m.subMeshes) { out(p + 'subMeshes', -1); continue; }
  for (let s = 0; s < m.subMeshes.length; s++) {
    const sm = m.subMeshes[s];
    for (let pl = 0; pl < sm.planes.length; pl++) {
      const plane = sm.planes[pl];
      const pp = `${p}${pad(s, 3)}.${pad(pl, 3)}.`;
      out(pp + 'uvgen', plane.uvGenerationMethod);
      out(pp + 'pts', plane.points.length);
      for (let q = 0; q < plane.points.length; q++) {
        const pt = plane.points[q];
        const pq = `${pp}${pad(q, 2)}.`;
        out(pq + 'x', F(pt.x)); out(pq + 'y', F(pt.y)); out(pq + 'z', F(pt.z));
        out(pq + 'nx', F(pt.nx)); out(pq + 'ny', F(pt.ny)); out(pq + 'nz', F(pt.nz));
        out(pq + 'u', F(pt.u)); out(pq + 'v', F(pt.v));
      }
    }
  }
}
await closeOut();
