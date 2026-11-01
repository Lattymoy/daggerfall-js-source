// REAL-GPU PROBE's reader: how long the main thread waited inside render/glProgram.js buildProgram, by who built - the
// shader links a cold cache waits on (BOOT-COMPILE, bible/07-Rendering/Performance-Priority.md). Reads a boot's
// .cpuprofile; a sample counts when buildProgram is on its stack, and goes to the first two callers above it that are not
// the renderer's own _buildProgram helper.
// Run:  node tools/realGpu/compileWaits.mjs <boot>.cpuprofile
import { readFileSync } from 'node:fs';
import { isMain } from '../lib/isMain.mjs';
import { nodeKey } from './realGpuProbe.mjs';

/** The ms inside buildProgram in all, and by caller, largest first.
 *  @param {{ nodes: any[], samples: number[], timeDeltas: number[], startTime: number }} profile */
export function compileWaits(profile) {
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const parent = new Map();
  for (const n of profile.nodes) for (const c of n.children || []) parent.set(c, n.id);
  let t = profile.startTime;
  const times = profile.samples.map((_, i) => (t += profile.timeDeltas[i] ?? 0) / 1000);
  const byCaller = new Map();
  let total = 0;
  for (let i = 0; i < times.length; i++) {
    const w = Math.max(0, (times[i + 1] ?? times[i]) - times[i]);
    const chain = [];
    for (let c = profile.samples[i]; c != null; c = parent.get(c)) chain.push(byId.get(c));
    const at = chain.findIndex((n) => n.callFrame.functionName === 'buildProgram');
    if (at < 0) continue;
    total += w;
    const callers = chain
      .slice(at + 1)
      .filter((n) => n.callFrame.functionName !== '_buildProgram')
      .slice(0, 2)
      .map(nodeKey)
      .join(' < ');
    byCaller.set(callers, (byCaller.get(callers) || 0) + w);
  }
  return { total, byCaller: [...byCaller].sort((a, b) => b[1] - a[1]) };
}

if (isMain(import.meta.url)) {
  const [file] = process.argv.slice(2);
  if (!file) throw new Error('compileWaits: name a boot .cpuprofile');
  const { total, byCaller } = compileWaits(JSON.parse(readFileSync(file, 'utf8')));
  console.log('inside buildProgram ms', total.toFixed(0));
  for (const [caller, ms] of byCaller.slice(0, 25)) console.log(String(ms.toFixed(0)).padStart(7), caller);
}
