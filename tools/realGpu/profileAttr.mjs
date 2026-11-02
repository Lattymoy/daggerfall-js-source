// REAL-GPU PROBE's reader: where a whole phase's main-thread time went - each function's inclusive and self time over a
// .cpuprofile (tools/realGpu/realGpuProbe.mjs writes one per phase), idle left out.
// Run:  node tools/realGpu/profileAttr.mjs <phase>.cpuprofile [top=40] [filter]   (filter: a substring of the key)
import { readFileSync } from 'node:fs';
import { isMain } from '../lib/isMain.mjs';
import { nodeKey } from './realGpuProbe.mjs';

/** The busy time and each function's inclusive and self ms, largest first.
 *  @param {{ nodes: any[], samples: number[], timeDeltas: number[], startTime: number }} profile */
export function profileAttribution(profile) {
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const parent = new Map();
  for (const n of profile.nodes) for (const c of n.children || []) parent.set(c, n.id);
  let t = profile.startTime;
  const times = profile.samples.map((_, i) => (t += profile.timeDeltas[i] ?? 0) / 1000);
  const inclusive = new Map();
  const self = new Map();
  let busy = 0;
  for (let i = 0; i < times.length; i++) {
    const w = Math.max(0, (times[i + 1] ?? times[i]) - times[i]);
    const node = byId.get(profile.samples[i]);
    if (node.callFrame.functionName === '(idle)') continue;
    busy += w;
    self.set(nodeKey(node), (self.get(nodeKey(node)) || 0) + w);
    const seen = new Set(); // a recursive function counts once a sample
    for (let c = node.id; c != null; c = parent.get(c)) {
      const key = nodeKey(byId.get(c));
      if (seen.has(key)) continue;
      seen.add(key);
      inclusive.set(key, (inclusive.get(key) || 0) + w);
    }
  }
  const ranked = (m) => [...m].sort((a, b) => b[1] - a[1]);
  return { busy, inclusive: ranked(inclusive), self: ranked(self) };
}

if (isMain(import.meta.url)) {
  const [file, top = 40, filter = ''] = process.argv.slice(2);
  if (!file) throw new Error('profileAttr: name a .cpuprofile');
  const { busy, inclusive, self } = profileAttribution(JSON.parse(readFileSync(file, 'utf8')));
  const show = (rows) =>
    rows
      .filter(([k]) => k.includes(filter))
      .slice(0, Number(top))
      .forEach(([k, v]) =>
        console.log(String(v.toFixed(0)).padStart(8), `${((100 * v) / busy).toFixed(1)}%`.padStart(6), k),
      );
  console.log('busy ms', busy.toFixed(0));
  console.log('-- inclusive');
  show(inclusive);
  console.log('-- self');
  show(self);
}
