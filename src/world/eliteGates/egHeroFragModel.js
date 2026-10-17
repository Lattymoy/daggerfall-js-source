// @ts-check
// EG6c (2026-10-12; bible/11-Multiplayer/Elite-Gates.md section 11.6 - "Authored hero fragments", "One kit of mesh tools",
// "One registry of pseudo-archives"): THE HERO FRAGMENTS' MESH HALVES - the one place a baked fragment's mesh is registered,
// and the path it is laid by. Each is the JSON tools/fragBake.mjs writes beside its law half (net/eliteGates/egHeroFrags.js, the
// relay's): positions, normals and UVs in the fragment's own frame (metres, the foot of its mouth at the origin, its exits
// along +Z), a sub-mesh a record of its band's dress, and its collider's proxy.
//
// WHERE IT IS REGISTERED, decided with section 11.6:
//   - its PICTURES take no number of their own: every face wears a record of its band's dress (world/eliteGates/egBandArt.js
//     EG_DRESS - the bake refuses any other material), so it draws under its band's archive, which the one registry
//     already holds (world/eliteGates/pseudoArchives.js EG_BAND_ARCHIVES) - an authored fragment can never collide with anything;
//   - its MESH goes through the one mesh kit (world/eliteGates/meshKit.js `mesh`) into the hall's own buckets, moved to where it is
//     laid, so it packs with the hall's code-built shapes in one model (THE SWAP's slices, section 7);
//   - its LAW is net/eliteGates/egHeroFrags.js's, held to net/eliteGates/egFragLaw.js's reader.
// LAID (EG-HERO-LAY, spec law 7): world/eliteGates/egHall.js draws a hall's hero (net/eliteGates/egLaw.js's `heroes`) through egHeroFragInto into
// its circle's one mesh at the hero's origin and lays its proxy in the circle's one collider bucket (egHeroFragCollider) -
// freed with the circle; the reference (`egRefFrag`) is laid by none. Not a DFU member. Ledger A (ELITE-GATES).
import { createMeshKit } from './meshKit.js';
import { EG_BAND_ARCHIVES } from './pseudoArchives.js';
import { EG_HERO_FRAGS } from '../../net/eliteGates/egHeroFrags.js';
import EG_REF_FRAG_MESH from '../../assets/egfrags/egRefFrag.mesh.json' with { type: 'json' };
// EG-HERO (the Soul Cairn, 2026-10-13): the Ossuary's and the Mist Stair's mesh halves (net/eliteGates/egHeroFrags.js has their laws)
import EG_HERO_OSSUARY_MESH from '../../assets/egfrags/egheroOssuary.mesh.json' with { type: 'json' };
import EG_HERO_MIST_STAIR_MESH from '../../assets/egfrags/egheroMistStair.mesh.json' with { type: 'json' };
import EG_HERO_GLOAM_MESH from '../../assets/egfrags/egheroGloam.mesh.json' with { type: 'json' };   // EG-HERO: the Shade's two heroes
import EG_HERO_ECLIPSE_MESH from '../../assets/egfrags/egheroEclipse.mesh.json' with { type: 'json' };
// EG-HERO (2026-10-13): the Broken Galleries' three heroes' mesh halves, beside their laws (net/eliteGates/egHeroFrags.js)
import EG_HERO_CAVERNS_MESH from '../../assets/egfrags/egheroCaverns.mesh.json' with { type: 'json' };
import EG_HERO_STACKS_MESH from '../../assets/egfrags/egheroStacks.mesh.json' with { type: 'json' };
import EG_HERO_COLONNADE_MESH from '../../assets/egfrags/egheroColonnade.mesh.json' with { type: 'json' };
// EG-HERO (2026-10-13): the Havoc Wellhead's three hero fragments' mesh halves (net/eliteGates/egHeroFrags.js holds their laws).
import EG_HERO_FORGE_GUT_MESH from '../../assets/egfrags/egheroForgeGut.mesh.json' with { type: 'json' };
import EG_HERO_CLAN_PIT_MESH from '../../assets/egfrags/egheroClanPit.mesh.json' with { type: 'json' };
import EG_HERO_DEEP_CAVERNS_MESH from '../../assets/egfrags/egheroDeepCaverns.mesh.json' with { type: 'json' };

/** A registry of mesh halves, by id: each beside its law half in `laws` (the same id, the same band, the same bake) - or
 *  refused, naming it. */
export function egHeroFragMeshes(meshes, laws = EG_HERO_FRAGS) {
  return Object.freeze(Object.fromEntries(meshes.map((mesh) => {
    const law = laws[mesh.id];
    if (!law || law.band !== mesh.band || law.bake.sha256 !== mesh.bake.sha256) throw new Error(`world/eliteGates/egHeroFragModel.js: ${mesh.id}'s mesh half has no law half of its bake beside it`);
    return [mesh.id, Object.freeze(mesh)];
  })));
}
/** EVERY BAKED FRAGMENT'S MESH HALF, by its id. */
export const EG_HERO_FRAG_MESHES = egHeroFragMeshes([
  EG_REF_FRAG_MESH,
  EG_HERO_OSSUARY_MESH,
  EG_HERO_MIST_STAIR_MESH,
  EG_HERO_GLOAM_MESH,
  EG_HERO_ECLIPSE_MESH,
  EG_HERO_CAVERNS_MESH,
  EG_HERO_STACKS_MESH,
  EG_HERO_COLONNADE_MESH,
  EG_HERO_FORGE_GUT_MESH,
  EG_HERO_CLAN_PIT_MESH,
  EG_HERO_DEEP_CAVERNS_MESH,
]);

/** Fragment `id`'s drawn mesh into kit `kit` (world/eliteGates/meshKit.js, or anything with its `mesh`), its origin laid at `at` (m, the
 *  frame `kit` builds in): a bucket a dress record. EG-HERO-LAY: `meshes` the registry it is read from (a test's seam). */
export function egHeroFragInto(kit, id, at = [0, 0, 0], meshes = EG_HERO_FRAG_MESHES) {
  const mesh = meshes[id];
  for (const s of mesh.subMeshes) kit.mesh(s.record, mesh, { start: s.startIndex, count: s.primitiveCount, at });
  return kit;
}
/** Fragment `id` alone as renderer.createMesh's model, under its band's archive. */
export const egHeroFragModel = (id) => egHeroFragInto(createMeshKit(), id).pack(EG_BAND_ARCHIVES[EG_HERO_FRAGS[id].band]);
/** Fragment `id`'s collider proxy (section 11.6 - never the drawn mesh) as a triangle soup, its origin laid at `at` (m).
 *  EG-HERO-LAY: `meshes` the registry it is read from (a test's seam). */
export function egHeroFragCollider(id, at = [0, 0, 0], meshes = EG_HERO_FRAG_MESHES) {
  const c = meshes[id].collider, out = new Float32Array(c.length);
  for (let i = 0; i < c.length; i++) out[i] = c[i] + at[i % 3];
  return out;
}
