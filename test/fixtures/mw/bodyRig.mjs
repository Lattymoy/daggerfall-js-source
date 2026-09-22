// PEER-CADENCE (2026-09-22): THE FIXTURE BODY RIG, shared. The arm
// fixtures under this directory (armfp.nif, armfpidle.kf, the hand and
// upperarm meshes, armfp.esm) stand a whole `createFpArm()` rig with a
// third-person body when the ESM is given the two BODY records and the
// retail x-model names - fparm.test.js's fpFixtureBuildWithBody. The
// peer-bodies probe and the cadence pins drive the SAME rig, so the
// build lives here once, with the renderer that counts what it costs.
import { readFileSync } from 'node:fs';
import { fpSkeletonPath, FP_CLIP_PATH } from '../../../src/combat/fpArm.js';

export const fixtureFile = (n) => new Uint8Array(readFileSync(new URL(`./${n}`, import.meta.url)));

/** a BODY record, as fparm.test.js mints them (hand=5, upperarm=8 in MW_BODY_PARTS order) */
export function bodyRec(id, model, race, part, { female = false } = {}) {
  const sub = (name, data) => { const b = new Uint8Array(8 + data.length); b.set([...name].map((c) => c.charCodeAt(0)), 0); new DataView(b.buffer).setUint32(4, data.length, true); b.set(data, 8); return b; };
  const z = (s) => Uint8Array.from([...s].map((c) => c.charCodeAt(0)).concat(0));
  const bydt = new Uint8Array(4); bydt[0] = part; bydt[2] = female ? 1 : 0; bydt[3] = 0;   // BPF_Female=1; MT_Skin=0
  const subs = [sub('NAME', z(id)), sub('MODL', z(model)), sub('FNAM', z(race)), sub('BYDT', bydt)];
  const size = subs.reduce((a, s) => a + s.length, 0);
  const rec = new Uint8Array(16 + size);
  rec.set([...'BODY'].map((c) => c.charCodeAt(0)), 0);
  new DataView(rec.buffer).setUint32(4, size, true);
  let o = 16; for (const s of subs) { rec.set(s, o); o += s.length; }
  return rec;
}

/** The build deps for a rig with a third-person body: the FP fixture plus the retail x-model names and the two BODY records. */
export function fixtureBodyDeps() {
  const f = fixtureFile;
  const files = new Map([
    [fpSkeletonPath({}), f('armfp.nif')], [FP_CLIP_PATH, f('armfpidle.kf')],
    ['meshes/fixture/armfphand.nif', f('armfphand.nif')], ['meshes/fixture/armfparm.nif', f('armfparm.nif')],
    ['meshes/xbase_anim.nif', f('armfp.nif')], ['meshes/xbase_anim.kf', f('armfpidle.kf')],
  ]);
  const esm = f('armfp.esm');
  const extra = [bodyRec('b_fprace_m_hand', 'fixture\\armfphand.nif', 'fprace', 5), bodyRec('b_fprace_m_upperarm', 'fixture\\armfparm.nif', 'fprace', 8)];
  const all = new Uint8Array(esm.length + extra.reduce((a, r) => a + r.length, 0));
  all.set(esm, 0); let o = esm.length; for (const r of extra) { all.set(r, o); o += r.length; }
  return {
    loadMorrowindArchives: async () => [{ has: (p) => files.has(p), get: (p) => files.get(p) }],
    storedMorrowindNames: async () => ['armfp.esm'],
    loadMorrowindFile: async () => all,
  };
}

/** a renderer that counts what a body costs it: meshes minted, mesh uploads, sprite renders, sprite quads */
export function countingRenderer() {
  const c = { meshes: 0, uploads: 0, sprites: 0, quads: 0 };
  return { c, gl: null,
    createCharacterMesh: () => { c.meshes++; return { vao: {}, buffers: [] }; },
    updateCharacterMesh: () => { c.uploads++; },
    createCharacterTexture: (mips) => ({ mips }),
    renderCharacterSprite: () => { c.sprites++; return { tex: {} }; },
    drawCharacterSpriteQuad: () => { c.quads++; },
    drawScreenOverlayQuad: () => {},
    createParticleEffect: () => ({}),
  };
}
