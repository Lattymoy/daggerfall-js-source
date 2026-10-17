// THE REFERENCE HERO FRAGMENT, BAKED - its own bake script, as each of Mac's fragments will have one.
//
//     node tools/bakeEgRefFrag.mjs [--fbx=src/assets/egfrags/source/egRefFrag.fbx]
//
// EG6c (2026-10-12, bible/11-Multiplayer/Elite-Gates.md section 11.6: "each fragment its own bake script and byte-for-byte
// test, as every bake in the port has"). The scene is the port's own (tools/egRefFragScene.mjs writes it); the bake is
// tools/fragBake.mjs's, the one every authored fragment goes through. Its SPEC says what the scene cannot: which fragment
// it is (`id`), the library kit it belongs to (the Oblivion Caverns - its band, reverb, light and engine follow, net/
// egFragLaw.js EG_FRAGS), its class, which hero of the kit it is (`variant` - 'reference': the stand-in, which no hall
// lays - net/eliteGates/egHeroFrags.js), and a chamber's play (a passage names none). The two halves land beside the source:
// `LAW` (net/eliteGates/egFragLaw.js's record, the relay's - registered in net/eliteGates/egHeroFrags.js) and `MESH` (the client's - registered
// in world/eliteGates/egHeroFragModel.js), each held to its bytes by test/tooling/eg6c_bake.test.js.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { bakeFrag, fragJson } from './fragBake.mjs';
import { ROOT, sourcePath } from './shipBake.mjs';
import { isMain } from './lib/isMain.mjs';

export const SPEC = Object.freeze({ id: 'egRefFrag', kit: 'caverns', class: 'passage', variant: 'reference', play: Object.freeze([]), source: 'src/assets/egfrags/source/egRefFrag.fbx' });
export const LAW = 'src/assets/egfrags/egRefFrag.law.json';
export const MESH = 'src/assets/egfrags/egRefFrag.mesh.json';

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const fbx = resolve(args.find((a) => a.startsWith('--fbx='))?.slice(6) ?? resolve(ROOT, SPEC.source));
  const { law, mesh } = bakeFrag(readFileSync(fbx), SPEC, undefined, sourcePath(fbx));
  for (const [rel, half] of [[LAW, law], [MESH, mesh]]) {
    const out = resolve(ROOT, rel);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, fragJson(half));
  }
  console.log(`${fbx} -> ${LAW}, ${MESH}`);
  console.log(`  law: ${law.floors.length} floors, ${law.ramps.length} ramps, ${law.ceil?.length ?? 0} ceilings, ${law.open.length} open edges, ${law.graph.nodes.length} nodes and ${law.graph.edges.length} edges, ${law.hazards.length} hazards, ${law.course.length} inner pieces (crossed in ${law.proof.crossFast} ms at best, ${law.proof.crossSlow} ms at the median), box ${JSON.stringify(law.box)} cm`);
  console.log(`  mesh: ${mesh.positions.length / 3} vertices, ${law.cost.tris} triangles in ${law.cost.draws} draws (${mesh.subMeshes.map((s) => s.material).join(', ')}), a ${law.cost.collider}-triangle collider`);
}
