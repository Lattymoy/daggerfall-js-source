// PERF-NEXT (2026-10-06): THE A/B OF TWO FRAME PROBE RUNS (tools/frameProbe.mjs) - one scene, two TAGs, the same OUT.
// The frame's JavaScript by area (each row INCLUSIVE: a sample counts for a row when the row's function is anywhere on
// its stack), the collector, the WebGL calls and draws a frame (the census, exact), what a frame allocates, and with
// INSTR=shadow the shadow pass's own methods. Milliseconds of the probe machine's CPU a frame, by sample count.
//
// Run:  node tools/frameAb.mjs <scene> <tagA> <tagB>     (OUT as the probe's: the OS temp dir's frameProbe/ by default)
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const D = process.env.OUT || join(tmpdir(), 'frameProbe');
const [scene, A, B] = process.argv.slice(2);
if (!scene || !A || !B) throw new Error('frameAb: node tools/frameAb.mjs <scene> <tagA> <tagB>');
const load = (t) => ({ j: JSON.parse(readFileSync(`${D}/${scene}.${t}.json`, 'utf8')), p: JSON.parse(readFileSync(`${D}/${scene}.${t}.cpuprofile`, 'utf8')) });
const incl = (prof, frames, re) => {
  const byId = new Map(prof.nodes.map((n) => [n.id, n])); const parent = new Map();
  for (const n of prof.nodes) for (const c of n.children || []) parent.set(c, n.id);
  const cnt = new Map(); for (const s of prof.samples) cnt.set(s, (cnt.get(s) || 0) + 1);
  const d = prof.timeDeltas.slice(1).sort((a, b) => a - b); const med = d[Math.floor(d.length / 2)] / 1000;
  const key = (n) => `${n.callFrame.functionName} ${(n.callFrame.url || '').replace(/^.*\/src\//, 'src/')}:${n.callFrame.lineNumber + 1}`;
  let tot = 0;
  for (const [id, c] of cnt) { let cur = id, hit = false; while (cur != null) { if (re.test(key(byId.get(cur)))) { hit = true; break; } cur = parent.get(cur); } if (hit) tot += c; }
  return (tot * med) / frames;
};
const a = load(A), b = load(B);
const rows = [
  ['world host frame', /^frame src\/scenes\/world\.js/],
  ['shadow pass render', /^render src\/render\/shadowPass\.js/],
  ['  replay', /^replay src\/render\/shadowPass\.js/],
  ['  _dynamicNear', /^_dynamicNear /],
  ['  _casterCandidates', /^_casterCandidates /],
  ['  _sunCandidates', /^_sunCandidates /],   // AUDIT PERF-ON4 (sun lens 4): the sun's walk, outside its replays
  ['  _candidateQuads', /^_candidateQuads /],
  ['drawBillboards', /^drawBillboards /],
  ['garbage collector', /^\(garbage collector\)/],
];
const f = (x) => x.toFixed(3).padStart(8);
console.log(`${scene}: ${A} vs ${B} (ms a frame, by sample count; frames ${a.j.cpu.frames}/${b.j.cpu.frames})`);
for (const [nm, re] of rows) { const x = incl(a.p, a.j.cpu.frames, re), y = incl(b.p, b.j.cpu.frames, re); console.log(`${nm.padEnd(22)} ${f(x)} ${f(y)}   ${x > 0 ? ((y / x - 1) * 100).toFixed(0).padStart(5) + '%' : ''}`); }
const gl = (j) => Object.entries(j.census.perFrame).filter(([k]) => k.startsWith('gl.')).reduce((s, [, v]) => s + v, 0);
const dr = (j) => ['gl.drawElements', 'gl.drawArrays', 'gl.drawElementsInstanced', 'gl.drawArraysInstanced'].reduce((s, k) => s + (j.census.perFrame[k] || 0), 0);
console.log(`GL calls a frame       ${f(gl(a.j))} ${f(gl(b.j))}\ndraws a frame          ${f(dr(a.j))} ${f(dr(b.j))}`);
console.log(`heap a frame (bytes)   ${String(a.j.heap.bytesPerFrame).padStart(8)} ${String(b.j.heap.bytesPerFrame).padStart(8)}`);
const hs = (j, re) => j.heap.top.filter(([k]) => re.test(k)).reduce((s, [, v]) => s + v, 0);
console.log(`  replay's allocations ${String(hs(a.j, /^replay /)).padStart(8)} ${String(hs(b.j, /^replay /)).padStart(8)}`);
for (const [t, j] of [[A, a.j], [B, b.j]]) if (j.shStats) { const s = j.shStats; console.log(`${t}: shadow render ${(s.renderMs / s.frames).toFixed(2)} ms/frame over ${s.frames} frames, records ${(s.records / s.frames).toFixed(0)}, flats ${(s.batches / s.frames).toFixed(0)} a frame`); for (const [k, v] of Object.entries(s.byKind).sort((x, y) => y[1].ms - x[1].ms)) console.log(`   ${k.padEnd(18)} ${(v.n / s.frames).toFixed(1).padStart(6)} a frame  ${(v.ms / s.frames).toFixed(3).padStart(7)} ms  draws ${(v.draws / s.frames).toFixed(0)}`); }
