// THE OBLIVION CAVERNS, DEEP, BAKED - the Havoc Wellhead's hero chamber of the magma tide, its own bake script (the reference's shape).
//
//     node tools/bakeEgHeroDeepCaverns.mjs [--fbx=src/assets/egfrags/source/egheroDeepCaverns.fbx]
//
// EG-HERO (2026-10-13, the owner: "You have to author the fragments"; bible/11-Multiplayer/Elite-Gates.md section 11.6:
// "each fragment its own bake script and byte-for-byte test"). The scene is the port's own (tools/egHeroDeepCavernsScene.mjs
// writes it); the bake is tools/fragBake.mjs's. Its SPEC: the Oblivion Caverns, deep (`deep` - band 3, the cave's reverb,
// the kit's magma light, the Sluice its engine: net/eliteGates/egFragLaw.js EG_FRAGS), a chamber whose play is its two dry ledges
// (`balcony` - EG_PLAYS, section 11.4; egFragChamber's deep play), the hero `deepcaverns` (net/eliteGates/egHeroFrags.js lays any hero
// but the reference). The two halves land beside the source -
// `LAW` registered in net/eliteGates/egHeroFrags.js, `MESH` in world/eliteGates/egHeroFragModel.js - each held to its bytes by
// test/tooling/eghero_wellhead.test.js.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { bakeFrag, fragJson } from './fragBake.mjs';
import { ROOT, sourcePath } from './shipBake.mjs';
import { isMain } from './lib/isMain.mjs';

export const SPEC = Object.freeze({ id: 'egheroDeepCaverns', kit: 'deep', class: 'chamber', variant: 'deepcaverns', play: Object.freeze(['balcony']), source: 'src/assets/egfrags/source/egheroDeepCaverns.fbx' });
export const LAW = 'src/assets/egfrags/egheroDeepCaverns.law.json';
export const MESH = 'src/assets/egfrags/egheroDeepCaverns.mesh.json';

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
