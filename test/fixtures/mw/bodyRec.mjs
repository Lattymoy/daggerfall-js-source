// MWNPC1 (2026-10-09): THE BODY RECORD WRITER, moved out of bodyRig.mjs (which reads its fixtures with node:fs) so
// the browser probe (tools/mwGpuSkinProbe.mjs, through bodyRigBrowser.mjs) mints the same records the node pins do.

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

