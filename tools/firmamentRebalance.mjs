// FIRM2 balance tool (2026-10-15): reads the authored SKY of src/net/firmament/firmamentTree.js and finds every channel whose stars,
// summed over ONE sign's whole sky (starts, roads, small stars, notables, keystones, the Wayfarer's road beside it), pass
// the channel's cap (firmamentLaw.js STAT_DEFS). Such a channel makes some stars worth nothing - the cap eats them. The
// tool scales the stars of an over-full channel down, in proportion and in whole numbers (never under 1), until the sum
// fits - so every star in the sign counts. A keystone keeps its stars in step (its prices are left alone).
//   node tools/firmamentRebalance.mjs            the report: what passes its cap now, what the fix would be
//   node tools/firmamentRebalance.mjs --write    put the fixed table back into src/net/firmament/firmamentTree.js
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(root, 'src/net/firmament/firmamentTree.js');
const text = readFileSync(file, 'utf8');
const a = text.indexOf('const SKY = {');
const b = text.indexOf('\n};\n', a) + 4;
const block = text.slice(a, b);
const heads = new Map();   // the comment line above each sign
for (const m of block.matchAll(/^( {2}\/\/ ══.*)\n {2}(\w+): \{$/gm)) heads.set(m[2], m[1]);

const N = (name, stats) => ({ name, stats: { ...stats } });
const K = (name, stats, t) => ({ name, stats: { ...stats }, text: t });
const SKY = new Function('N', 'K', `${block}\nreturn SKY;`)(N, K);

// ── the table, written the way it is authored ──
const q = (s) => (s.includes("'") ? `"${s}"` : `'${s}'`);
const key = (k) => (/^[A-Za-z_$][\w$]*$/.test(k) ? k : q(k));
const obj = (o) => `{ ${Object.entries(o).map(([k, v]) => `${key(k)}: ${v}`).join(', ')} }`;
const val = (v) => (Array.isArray(v) ? `[${v.map(obj).join(', ')}]` : obj(v));
const nota = (n) => `N(${q(n.name)}, ${obj(n.stats)})`;
const kst = (k) => `K(${q(k.name)}, ${obj(k.stats)}, ${q(k.text)})`;
export function serialise(sky) {
  const out = ['const SKY = {'];
  for (const [id, s] of Object.entries(sky)) {
    if (heads.has(id)) out.push(heads.get(id));
    out.push(`  ${id}: {`);
    out.push(`    start: ${obj(s.start)},`);
    out.push(`    roads: { ${Object.entries(s.roads).map(([k, v]) => `${k}: ${obj(v)}`).join(', ')} },`);
    out.push('    combat: [');
    for (const c of s.combat) out.push(`      { id: ${q(c.id)}, tpl: ${q(c.tpl)}, n: ${c.n}, small: ${val(c.small)}, notables: [${c.notables.map(nota).join(', ')}] },`);
    out.push('    ],');
    out.push(`    keystone: ${kst(s.keystone)},`);
    out.push(`    life: { ring: ${val(s.life.ring)}, lr1: ${obj(s.life.lr1)}, lr2: ${obj(s.life.lr2)}, la: ${obj(s.life.la)} },`);
    out.push('    lifeClusters: [');
    for (const c of s.lifeClusters) out.push(`      { id: ${q(c.id)}, tpl: ${q(c.tpl)}, n: ${c.n}, small: ${val(c.small)}, notables: [${c.notables.map(nota).join(', ')}] },`);
    out.push('    ],');
    out.push(`    lifeKeystone: ${kst(s.lifeKeystone)},`);
    out.push('  },');
  }
  out.push('};', '');
  return out.join('\n');
}

const T = await import(pathToFileURL(path.join(root, 'src/net/firmament/firmamentTree.js')).href);
const L = await import(pathToFileURL(path.join(root, 'src/net/firmament/firmamentLaw.js')).href);
const { smallStats } = T;

if (process.argv.includes('--roundtrip')) { console.log(serialise(SKY) === block ? 'roundtrip: identical' : 'roundtrip: DIFFERS'); if (serialise(SKY) !== block) writeFileSync(process.argv[3] ?? 'roundtrip.out', serialise(SKY)); process.exit(0); }

// ── every term: one raw number in the table, the stars that carry it, the channel it lands on ──
/** @type {{ sign: string, kind: string, holder: any, k: string, count: number }[]} */
const terms = [];
const sorted = (n) => [...T.FIRM_NODES.values()].filter((x) => x.sector === n);
for (const s of T.SIGNS) {
  const sky = SKY[s.id];
  const sector = sorted(s.id);
  const add = (kind, holder, count) => { for (const k of Object.keys(holder)) terms.push({ sign: s.id, kind, holder, k, count }); };
  add('start', sky.start, 1);
  for (const [id, st] of Object.entries(sky.roads)) add('road', st, 1);
  sky.life.ring.forEach((st) => add('road', st, 1));
  add('road', sky.life.lr1, 1); add('road', sky.life.lr2, 1); add('road', sky.life.la, 1);
  add('keystone', sky.keystone.stats, 1); add('keystone', sky.lifeKeystone.stats, 1);
  for (const [list, ring] of [[sky.combat, 'combat'], [sky.lifeClusters, 'life']]) for (const c of list) {
    const cid = `${s.id}.${c.id}`;
    const ns = sector.filter((n) => n.cluster === cid && n.kind === 'small').length;
    const arr = Array.isArray(c.small) ? c.small : [c.small];
    arr.forEach((st, e) => { let cnt = 0; for (let j = 0; j < ns; j++) if (j % arr.length === e) cnt++; add('small', st, cnt); });
    for (const nb of c.notables) add('notable', nb.stats, 1);
  }
}
const effOf = (t, v = t.holder[t.k]) => {
  if (t.kind === 'small' || t.kind === 'road') { const o = smallStats({ [t.k]: v }); const [[ch, ev]] = Object.entries(o); return [ch, ev]; }
  return [t.k, v];
};
// what the Wayfarer's road (a constant outside the table) and nothing else adds, by sign
const fixed = {};
for (const n of T.FIRM_NODES.values()) if (/\.(bt|w|x|xr1|xr2|lgx)$/.test(n.key)) for (const [k, v] of Object.entries(n.stats)) { fixed[n.sector] ??= {}; fixed[n.sector][k] = (fixed[n.sector][k] ?? 0) + v; }

const sums = () => {
  const out = {};
  for (const s of T.SIGNS) out[s.id] = { ...(fixed[s.id] ?? {}) };
  for (const t of terms) { const [ch, ev] = effOf(t); out[t.sign][ch] = (out[t.sign][ch] ?? 0) + ev * t.count; }
  return out;
};
const over = (sm) => { const r = []; for (const [s, st] of Object.entries(sm)) for (const [ch, v] of Object.entries(st)) { const d = L.statDef(ch); if (d && v > d.max) r.push({ sign: s, ch, v, cap: d.max }); } return r; };
const before = over(sums());
const log = [];

for (let pass = 0; pass < 30; pass++) {
  const bad = over(sums());
  if (!bad.length) break;
  for (const { sign, ch, cap } of bad) {
    const mine = terms.filter((t) => t.sign === sign && effOf(t)[0] === ch && effOf(t)[1] > 0);
    const total = () => mine.reduce((x, t) => x + effOf(t)[1] * t.count, 0) + (fixed[sign]?.[ch] ?? 0);
    const room = cap - (fixed[sign]?.[ch] ?? 0);
    for (const t of mine) if (t.kind === 'keystone') t.was ??= { ...t.holder };
    const f = room / (total() - (fixed[sign]?.[ch] ?? 0));
    for (const t of mine) if (t.kind !== 'start') t.holder[t.k] = Math.max(1, Math.round(t.holder[t.k] * f));
    // whatever is left over: take the coarsest step that still fits, else the finest
    for (let guard = 0; guard < 200 && total() > cap; guard++) {
      const excess = total() - cap;
      let best = null;
      for (const t of mine) {
        if (t.kind === 'start') continue;
        for (let d = 1; d <= 4 && t.holder[t.k] - d >= 1; d++) {
          const was = effOf(t)[1], now = effOf(t, t.holder[t.k] - d)[1];
          if (now === was) continue;
          const cut = (was - now) * t.count;
          const fit = cut <= excess;
          const score = fit ? 1000 + cut : -cut;
          if (!best || score > best.score) best = { t, d, score };
          break;
        }
      }
      if (!best) break;
      best.t.holder[best.t.k] -= best.d;
    }
    // a keystone's other gains follow its scaled one, so the card stays one idea (its prices stay as they are)
    for (const t of mine) if (t.kind === 'keystone') {
      const was = (t.was ??= { ...t.holder }), r = t.holder[t.k] / was[t.k];
      for (const [k2, v2] of Object.entries(t.holder)) if (k2 !== t.k && v2 > 0 && !/Taken$/.test(k2)) t.holder[k2] = Math.max(1, Math.round(v2 * Math.min(1, r)));
    }
  }
}
const after = over(sums());
const mins = [];
for (const [s, st] of Object.entries(sums())) for (const [ch, v] of Object.entries(st)) { const d = L.statDef(ch); if (d && v < d.min) mins.push({ sign: s, ch, v, floor: d.min }); }

console.log(`passing their cap before: ${before.length}; after: ${after.length}`);
for (const o of before) console.log(`  ${o.sign}  ${o.ch.padEnd(22)} ${String(o.v).padStart(3)} > ${o.cap}`);
if (after.length) { console.log('STILL OVER:'); for (const o of after) console.log(`  ${o.sign} ${o.ch} ${o.v} > ${o.cap}`); }
if (mins.length) { console.log('under their floor:'); for (const o of mins) console.log(`  ${o.sign} ${o.ch} ${o.v} < ${o.floor}`); }
if (process.argv.includes('--write')) {
  writeFileSync(file, text.slice(0, a) + serialise(SKY) + text.slice(b));
  console.log('written', path.relative(root, file));
}
