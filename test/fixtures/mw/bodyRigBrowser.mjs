// MWNPC1 (2026-10-09): bodyRig.mjs's fixtureBodyDeps for a PAGE - the same files, fetched off the dev server instead
// of read with node:fs, and the same two BODY records (bodyRec.mjs, the one writer) - so the browser probe
// (tools/mwGpuSkinProbe.mjs) builds the very body the node pins stand.
import { fpSkeletonPath, FP_CLIP_PATH } from '../../../src/combat/fpArm.js';
import { bodyRec } from './bodyRec.mjs';

const fetched = async (n) => new Uint8Array(await (await fetch(new URL(`./${n}`, import.meta.url))).arrayBuffer());

export async function fixtureBodyDepsBrowser() {
  const [skel, idle, hand, arm, esm] = await Promise.all(['armfp.nif', 'armfpidle.kf', 'armfphand.nif', 'armfparm.nif', 'armfp.esm'].map(fetched));
  const files = new Map([
    [fpSkeletonPath({}), skel], [FP_CLIP_PATH, idle],
    ['meshes/fixture/armfphand.nif', hand], ['meshes/fixture/armfparm.nif', arm],
    ['meshes/xbase_anim.nif', skel], ['meshes/xbase_anim.kf', idle],
  ]);
  const extra = [bodyRec('b_fprace_m_hand', 'fixture\\armfphand.nif', 'fprace', 5), bodyRec('b_fprace_m_upperarm', 'fixture\\armfparm.nif', 'fprace', 8)];
  const all = new Uint8Array(esm.length + extra.reduce((a, r) => a + r.length, 0));
  all.set(esm, 0); let o = esm.length; for (const r of extra) { all.set(r, o); o += r.length; }
  return {
    loadMorrowindArchives: async () => [{ has: (p) => files.has(p), get: (p) => files.get(p) }],
    storedMorrowindNames: async () => ['armfp.esm'],
    loadMorrowindFile: async () => all,
  };
}
