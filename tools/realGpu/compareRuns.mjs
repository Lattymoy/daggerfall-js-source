// REAL-GPU PROBE's reader: one table over several runs - an A/B's arms, or ANGLE's backends (ANGLE=d3d11|vulkan). Each
// arm is a label and its cold run's folder, optionally its warm run's (tools/realGpu/realGpuProbe.mjs's OUT folders).
// Run:  node tools/realGpu/compareRuns.mjs base=<cold dir>,<warm dir> head=<cold dir>,<warm dir>
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { isMain } from '../lib/isMain.mjs';
import { compileWaits } from './compileWaits.mjs';

/** A phase's json from a run folder, or null. */
const readPhase = (dir, phase) => {
  const file = dir && join(dir, `${phase}.json`);
  return file && existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
};

/** An arm's lines: the cold boot (its link waits by caller), the warm boot, standing and flying.
 *  @param {string} label @param {string} coldDir @param {string} [warmDir] @returns {string[]} */
export function armLines(label, coldDir, warmDir) {
  const lines = [`=== ${label}`];
  const fps = (p) => (p.frames / p.seconds).toFixed(0);
  const cold = readPhase(coldDir, 'boot');
  const coldProfile = join(coldDir, 'boot.cpuprofile');
  const waits = existsSync(coldProfile) ? compileWaits(JSON.parse(readFileSync(coldProfile, 'utf8'))) : null;
  if (cold) {
    lines.push(
      `cold boot: ${cold.seconds}s, worst stall ${cold.frameMs.max} ms, frames>100ms ${cold.over100}, first world frame ${cold.firstFrameS ?? '?'} s, link wait ${waits ? (waits.total / 1000).toFixed(1) : '?'} s`,
    );
    if (waits)
      lines.push(
        `   by caller (s): ${waits.byCaller
          .slice(0, 7)
          .map(([k, v]) => `${k.split(' ')[0]} ${(v / 1000).toFixed(2)}`)
          .join(', ')}`,
      );
  }
  const warm = readPhase(warmDir, 'boot');
  const standing = readPhase(warmDir, 'settled');
  const flying = readPhase(warmDir, 'out');
  if (warm) lines.push(`warm boot: ${warm.seconds}s, worst stall ${warm.frameMs.max} ms, frames>100ms ${warm.over100}`);
  if (standing)
    lines.push(
      `standing: ${fps(standing)} fps, p50 ${standing.frameMs.p50} p95 ${standing.frameMs.p95} p99 ${standing.frameMs.p99} max ${standing.frameMs.max}; main thread ${JSON.stringify(standing.share)}`,
    );
  if (flying)
    lines.push(
      `flying:   ${fps(flying)} fps, p50 ${flying.frameMs.p50} p95 ${flying.frameMs.p95} max ${flying.frameMs.max}, >50ms ${flying.over50}; main thread ${JSON.stringify(flying.share)}`,
    );
  return lines;
}

if (isMain(import.meta.url)) {
  const arms = process.argv.slice(2);
  if (!arms.length) throw new Error('compareRuns: name one or more arms as <label>=<cold dir>[,<warm dir>]');
  for (const arm of arms) {
    const [label, dirs = ''] = arm.split('=');
    const [coldDir, warmDir] = dirs.split(',');
    console.log(armLines(label, coldDir, warmDir).join('\n'));
  }
}
