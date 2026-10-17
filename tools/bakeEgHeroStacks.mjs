// THE FALLEN STACKS HERO CHAMBER, BAKED - its own bake script, the reference's shape (tools/bakeEgRefFrag.mjs).
//
//     node tools/bakeEgHeroStacks.mjs [--fbx=src/assets/egfrags/source/egheroStacks.fbx]
//
// EG-HERO (2026-10-13, Mac: "You have to author the fragments"; bible/11-Multiplayer/Elite-Gates.md section 11.6: "each
// fragment its own bake script and byte-for-byte test, as every bake in the port has"). The scene is the port's own
// (tools/egHeroStacksScene.mjs writes it); the bake is tools/fragBake.mjs's. Its SPEC: the fragment (`id`), its library kit
// (the Fallen Stacks - its band, reverb, light and engine follow, net/eliteGates/egFragLaw.js EG_FRAGS), its class (a chamber), which
// hero of the kit it is (`variant` 'stacks' - a hero a hall may lay, net/eliteGates/egHeroFrags.js egHeroFragLaws) and a chamber's play
// (section 11.4: a second fight floor on its stairs where Casters stand, and THE SHELF, the kit's engine). The halves land
// beside the source: `LAW` (registered in net/eliteGates/egHeroFrags.js) and `MESH` (in world/eliteGates/egHeroFragModel.js), each held to its
// bytes by test/tooling/eghero_galleries.test.js.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { bakeFrag, fragJson } from './fragBake.mjs';
import { ROOT, sourcePath } from './shipBake.mjs';
import { isMain } from './lib/isMain.mjs';

export const SPEC = Object.freeze({ id: 'egheroStacks', kit: 'stacks', class: 'chamber', variant: 'stacks', play: Object.freeze(['balcony', 'engine']), source: 'src/assets/egfrags/source/egheroStacks.fbx' });
export const LAW = 'src/assets/egfrags/egheroStacks.law.json';
export const MESH = 'src/assets/egfrags/egheroStacks.mesh.json';

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
