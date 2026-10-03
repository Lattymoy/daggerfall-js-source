#!/usr/bin/env node
// WD3 (2026-10-01): A MOD'S WHOLE WORLD DATA AS ONE PACK - the author's edits over the player's own MAPS.BSA and
// BLOCKS.BSA, every shared piece once (formats/worldDataPack.js says what a pack is and why).
//
//   node tools/worldDataPackBuild.mjs <arena2> <bundle.dfmod> <vendor> <out.json> [--title T] [--author A] [--version V]
//
// What it does, file by file, for every world-data TextAsset in the bundle that DFU's WorldDataReplacement reads
// (`location-<r>-<i>.json`, `<BLOCK>.RMB.json`; a TextAsset no DFU name reaches is reported and not carried):
//   1. parses the author's file as FullSerializer does (`\0` and `\a` are its escapes, not JSON's);
//   2. takes its BASE - the classic location (MAPS.BSA) or block (BLOCKS.BSA) of its own name; for a block
//      BLOCKS.BSA has not got, the classic block or the pack's own file it is nearest to (fewest bytes of edit);
//   3. writes the EDIT, subtree by subtree, each the smaller of WD1's op script and a whole value, values encoded:
//      a large piece the classic game has is a reference into the player's BLOCKS.BSA (with the author's edits to
//      it, when that is smaller), a large piece the pack already holds is its node number, records are rows;
//   4. rebuilds EVERY file through the runtime's own reader and refuses to write the pack if one file's canonical
//      sha256 is not the author's.
// The output is a function of the bundle and the ARENA2 alone.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import zlib from 'node:zlib';
import { isMain } from './lib/isMain.mjs';
import { readUnityFs, readSerializedFile, CLASS_ID } from '../src/formats/unityBundle.js';
import { BlocksFile } from '../src/formats/blocksFile.js';
import { MapsFile } from '../src/formats/mapsFile.js';
import { blockToDfuJson, locationToDfuJson, diffJson, canonicalJson } from '../src/formats/worldDataJson.js';
import { PACK_FORMAT, ROW_ENCODERS, runLength, openWorldDataPack, classicIndicesOf } from '../src/formats/worldDataPack.js';

/** FullSerializer's string escapes that JSON lacks (fsJsonParser.UnescapeChar: `\0`, `\a`), rewritten, then parsed. */
export function parseFullSerializerJson(text) {
  let out = '';
  let start = 0, inStr = false;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (!inStr) { if (c === 34) inStr = true; continue; }
    if (c === 92) {
      const n = text[i + 1];
      if (n === '0' || n === 'a') { out += text.slice(start, i) + (n === '0' ? '\\u0000' : '\\u0007'); start = i + 2; }
      i++;
      continue;
    }
    if (c === 34) inStr = false;
  }
  return JSON.parse(start === 0 ? text : out + text.slice(start));
}

/** The DFU file name a bundle TextAsset is looked up by, or null (DFU's asset lookup is case-blind; the port's door
 *  asks with the block name as the location spells it, upper case). */
export function dfuWorldDataName(containerPath) {
  const base = containerPath.split('/').pop();
  if (/^location-\d+-\d+\.json$/i.test(base)) return base.toLowerCase();
  const m = /^(.+\.(?:rmb|rdb|rdi))\.json$/i.exec(base);
  if (m) return `${m[1].toUpperCase()}.json`;
  return null;
}

const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const size = (v) => JSON.stringify(v).length;

/** The bundle's world-data TextAssets: Map<dfuName, {path, text}>, and the ones no DFU name reaches. */
export function bundleWorldData(bytes) {
  const fs = readUnityFs(bytes);
  const main = fs.files.find((f) => !/\.res(S|ource)$/.test(f.path));
  const sf = readSerializedFile(main, main.path);
  const byId = new Map(sf.objects.map((o) => [String(o.pathId), o]));
  const ab = sf.objects.find((o) => o.classId === CLASS_ID.AssetBundle).read();
  const found = new Map(), ignored = [];
  let manifest = null;
  for (const p of ab.m_Container) {
    const path = p.first;
    const o = byId.get(String(p.second.asset.m_PathID));
    if (o?.classId !== CLASS_ID.TextAsset) continue;
    if (/\.dfmod\.json$/i.test(path)) { manifest = new TextDecoder().decode(o.read().m_Script); continue; }
    if (!/\/worlddata\//i.test(path)) continue;
    const name = dfuWorldDataName(path);
    const text = new TextDecoder().decode(o.read().m_Script);
    if (!name) { ignored.push(path); continue; }
    if (found.has(name)) {
      if (found.get(name).text !== text) throw new Error(`${name}: two different TextAssets in one bundle (${found.get(name).path}, ${path})`);
      continue;   // the same file twice (Beautiful Cities carries Beautiful Villages' farms under their own path)
    }
    found.set(name, { path, text });
  }
  return { files: found, ignored, manifest };
}

// ---- the classic game's pieces, by content ------------------------------------------------------------------------

const HALF_KEYS = ['Header', 'Block3dObjectRecords', 'BlockFlatObjectRecords', 'BlockSection3Records', 'BlockPeopleRecords', 'BlockDoorRecords'];
const isHalf = (o) => isObj(o) && HALF_KEYS.every((k) => Object.hasOwn(o, k));
const isSubRecord = (o) => isObj(o) && isHalf(o.Exterior) && isHalf(o.Interior);

/** Every classic RMB block's buildings and their two halves by canonical hash -> [index, path] (what a pack may name
 *  instead of carrying), and the halves by record for the nearest-half search. */
function classicIndex(blocks) {
  const byHash = new Map();
  const halves = [];   // { ref, json, recs:Set }
  const recordIndex = new Map();   // record hash -> [half ids]
  const blockJson = new Map();
  const add = (v, ref) => { const h = sha256(canonicalJson(v)); if (!byHash.has(h)) byHash.set(h, ref); };
  for (let i = 0; i < blocks.count; i++) {
    if (!blocks.getBlockName(i)?.endsWith('.RMB')) continue;
    const b = blocks.readClassicBlock(i);
    if (!b) continue;
    const j = blockToDfuJson(b);
    blockJson.set(i, j);
    j.RmbBlock.SubRecords.forEach((sr, k) => {
      add(sr, [i, ['RmbBlock', 'SubRecords', k]]);
      for (const half of ['Exterior', 'Interior']) {
        const v = sr[half];
        const ref = [i, ['RmbBlock', 'SubRecords', k, half]];
        add(v, ref);
        const id = halves.length;
        const recs = new Set([...v.Block3dObjectRecords, ...v.BlockFlatObjectRecords].map((r) => sha256(canonicalJson(r))));
        halves.push({ ref, json: v, recs });
        for (const r of recs) { if (!recordIndex.has(r)) recordIndex.set(r, []); recordIndex.get(r).push(id); }
      }
    });
  }
  return { byHash, halves, recordIndex, blockJson };
}

// ---- the encoder ----------------------------------------------------------------------------------------------------

function createEncoder(classic) {
  const nodes = [];
  const nodeOf = new Map();   // canonical hash -> node id
  const memo = new WeakMap(); // object -> canonical string
  const canon = (v) => {
    if (v === null || typeof v !== 'object') return JSON.stringify(v);
    let s = memo.get(v);
    if (s === undefined) { s = canonicalJson(v); memo.set(v, s); }
    return s;
  };

  /** Rows for an array of records, when its elements are (mostly) one codec's records. */
  function rowsOf(arr) {
    if (!arr.length) return null;
    for (const [key, enc] of Object.entries(ROW_ENCODERS)) {
      const rows = arr.map((r) => enc(r));
      const fit = rows.filter((r) => r !== null).length;
      if (fit === 0 || fit < arr.length * 0.5) continue;
      return { [key]: rows.map((r, i) => (r !== null ? r : encodeValue(arr[i]))) };
    }
    return null;
  }

  /** The nearest classic half to a half of the author's: most records in common (the inverted index), then the
   *  smallest edit. */
  function nearestClassicHalf(v) {
    const counts = new Map();
    for (const r of [...v.Block3dObjectRecords, ...v.BlockFlatObjectRecords]) {
      for (const id of classic.recordIndex.get(sha256(canon(r))) ?? []) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    const top = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 4);
    let best = null;
    for (const [id, shared] of top) {
      const h = classic.halves[id];
      if (shared < Math.min(h.recs.size, 4) * 0.5) continue;
      const ops = diffJson(h.json, v);
      const s = size(ops);
      if (!best || s < best.size) best = { ref: h.ref, ops, size: s };
    }
    return best;
  }

  /** A building or a half of one: a classic reference, a node already held, or a new node (itself a classic half with
   *  the author's edits when that is much smaller than carrying it). */
  const refMemo = new WeakMap();
  function nodeRef(v) {
    const memoed = refMemo.get(v);
    if (memoed) return memoed;
    const r = nodeRefOf(v);
    refMemo.set(v, r);
    return r;
  }
  function nodeRefOf(v) {
    const h = sha256(canon(v));
    const cref = classic.byHash.get(h);
    if (cref) return { $c: cref };
    let id = nodeOf.get(h);
    if (id !== undefined) return { $n: id };
    let content = null;
    const half = isHalf(v) ? v : null;
    if (half) {
      const near = nearestClassicHalf(half);
      if (near) {
        const edit = { $c: near.ref, $o: encodeOps(near.ops) };
        const whole = encodeFields(v);
        if (size(edit) < size(whole) * 0.7) content = edit; else content = whole;
      }
    }
    content ??= encodeFields(v);
    id = nodes.length;
    nodes.push(content);
    nodeOf.set(h, id);
    return { $n: id };
  }

  function encodeFields(o) {
    const out = {};
    for (const [k, x] of Object.entries(o)) {
      if (k.charCodeAt(0) === 36) throw new Error(`a world-data object has a key ${k} - the pack's references would read it`);
      out[k] = encodeValue(x);
    }
    return out;
  }

  function encodeValue(v) {
    if (Array.isArray(v)) {
      if (v.length >= 8 && v.every((x) => typeof x === 'number')) {
        const rl = runLength(v);
        if (size(rl) < size(v)) return { $r: rl };
        return v;
      }
      const rows = rowsOf(v);
      if (rows) return rows;
      return v.map(encodeValue);
    }
    if (!isObj(v)) return v;
    if (isSubRecord(v) || isHalf(v)) return nodeRef(v);
    return encodeFields(v);
  }

  /** WD1 ops, values encoded, element sets of a number array grouped into runs. */
  function encodeOps(ops) {
    const out = [];
    for (let i = 0; i < ops.length; i++) {
      const op = ops[i];
      const last = op[1][op[1].length - 1];
      if (op[0] === 's' && typeof last === 'number' && (op[2] === null || typeof op[2] !== 'object')) {
        const parent = op[1].slice(0, -1);
        const key = JSON.stringify(parent);
        let j = i + 1;
        while (j < ops.length && ops[j][0] === 's' && typeof ops[j][1][ops[j][1].length - 1] === 'number'
          && JSON.stringify(ops[j][1].slice(0, -1)) === key && (ops[j][2] === null || typeof ops[j][2] !== 'object')) j++;
        if (j - i >= 3) {
          const runs = [];
          for (let k = i; k < j; k++) {
            const idx = ops[k][1][ops[k][1].length - 1];
            if (runs.length && runs[runs.length - 2] + runs[runs.length - 1].length === idx) runs[runs.length - 1].push(ops[k][2]);
            else runs.push(idx, [ops[k][2]]);
          }
          out.push(['sr', parent, runs]);
          i = j - 1;
          continue;
        }
      }
      out.push(op[0] === 's' || op[0] === 'i' ? [op[0], op[1], encodeValue(op[2])] : op);
    }
    return out;
  }

  /** The edit of `base` into `mod` at `path`, subtree by subtree, each the smaller of an op script and a whole value. */
  function bestOps(base, mod, path) {
    if (canon(base) === canon(mod)) return [];
    if (isObj(base) && isObj(mod) && !(path.length && (isSubRecord(mod) || isHalf(mod)))) {
      const out = [];
      for (const k of Object.keys(base)) if (!Object.hasOwn(mod, k)) out.push(['d', [...path, k]]);
      for (const k of Object.keys(mod)) {
        if (!Object.hasOwn(base, k)) out.push(['s', [...path, k], encodeValue(mod[k])]);
        else out.push(...bestOps(base[k], mod[k], [...path, k]));
      }
      return out;
    }
    const whole = [['s', path, encodeValue(mod)]];
    if (Array.isArray(base) && Array.isArray(mod) && !mod.some(isSubRecord)) {
      const script = encodeOps(diffJson(base, mod).map((op) => [op[0], [...path, ...op[1]], ...op.slice(2)]));
      if (size(script) < size(whole)) return script;
    }
    return whole;
  }

  return { nodes, bestOps, encodeValue, nodeCount: () => nodes.length };
}

// ---- the base of a block BLOCKS.BSA has not got ---------------------------------------------------------------------

/** Candidate bases for a new block: the classic block or pack file whose name it carries (`DABOOKBM00` -> BOOKBM00;
 *  `WALLAA03.FARMBA07` -> FARMBA07, WALLAA03), then classic blocks of its own prefix - chosen by the smallest edit. */
function baseCandidates(name, blocks, packNames) {
  let stem = name.replace(/\.RMB$/, '');
  const names = new Set();
  for (const p of stem.split('.')) names.add(p);
  if (/^DA[A-Z]{4}[A-Z0-9]{2}\d\d$/.test(stem)) { stem = stem.slice(2); names.add(stem); }   // the desert architecture's twin of a block
  const out = [];
  for (const n of names) {
    if (packNames.has(`${n}.RMB.json`) && `${n}.RMB` !== name) out.push({ kind: 'f', name: `${n}.RMB.json` });
    const i = blocks.getBlockIndex(`${n}.RMB`);
    if (i >= 0) out.push({ kind: 'b', name: `${n}.RMB`, index: i });
  }
  // the classic blocks and pack files of the same four-letter kind (TEMPASA0 -> TEMPAA*, TEMPAS*; FARMBA03 -> FARMAA*)
  const last = stem.split('.').pop();
  const head = last.slice(0, 4);
  for (let i = 0; i < blocks.count; i++) {
    const n = blocks.getBlockName(i);
    if (n?.endsWith('.RMB') && n.startsWith(head)) out.push({ kind: 'b', name: n, index: i });
  }
  for (const p of packNames) if (p.startsWith(head) && p !== `${name}.json` && /\.RMB\.json$/.test(p)) out.push({ kind: 'f', name: p });
  return out;
}

/** About how many bytes the edit of `base` into `mod` costs, outside the buildings (which are references either way):
 *  ground tiles and scenery, automap cells and the block's own models and flats that differ - counted in place, not
 *  diffed (a Myers script over a 4,096-cell automap for every candidate of 415 new blocks is an hour). */
function baseCost(base, mod) {
  const b = base.RmbBlock, m = mod.RmbBlock;
  if (!b?.FldHeader || !m?.FldHeader) return Infinity;
  let cost = 0;
  const bt = b.FldHeader.GroundData?.GroundTiles ?? [], mt = m.FldHeader.GroundData?.GroundTiles ?? [];
  for (let i = 0; i < mt.length; i++) if (bt[i]?.TileBitfield !== mt[i]?.TileBitfield || bt[i]?.TextureRecord !== mt[i]?.TextureRecord) cost += 30;
  const bs = b.FldHeader.GroundData?.GroundScenery ?? [], ms = m.FldHeader.GroundData?.GroundScenery ?? [];
  for (let i = 0; i < ms.length; i++) if (bs[i]?.TextureRecord !== ms[i]?.TextureRecord) cost += 15;
  const ba = b.FldHeader.AutoMapData ?? [], ma = m.FldHeader.AutoMapData ?? [];
  for (let i = 0; i < ma.length; i++) if (ba[i] !== ma[i]) cost += 4;
  for (const key of ['Misc3dObjectRecords', 'MiscFlatObjectRecords']) {
    const have = new Map();
    for (const r of b[key] ?? []) { const k = canonicalJson(r); have.set(k, (have.get(k) ?? 0) + 1); }
    for (const r of m[key] ?? []) { const k = canonicalJson(r); const n = have.get(k) ?? 0; if (n) have.set(k, n - 1); else cost += 40; }
  }
  return cost;
}

/** Every classic RMB block, for a new block of a kind Daggerfall has none of (Beautiful Cities' EMTYAA00) - narrowed
 *  by the ground: the ten whose 256 tiles agree most with the new block's. */
function nearestByGround(json, classic) {
  const tiles = json.RmbBlock?.FldHeader?.GroundData?.GroundTiles ?? [];
  const scored = [];
  for (const [index, bj] of classic.blockJson) {
    const ct = bj.RmbBlock.FldHeader.GroundData.GroundTiles ?? [];
    let same = 0;
    for (let i = 0; i < tiles.length; i++) if (ct[i]?.TileBitfield === tiles[i]?.TileBitfield) same++;
    scored.push({ kind: 'b', name: bj.Name, index, same });
  }
  return scored.sort((a, b) => b.same - a.same).slice(0, 10);
}

// ---- the build -------------------------------------------------------------------------------------------------------

export function buildPack({ arena2, bundleBytes, vendor, mod = {}, log = () => {} }) {
  const blocks = new BlocksFile();
  if (!blocks.load(new Uint8Array(readFileSync(join(arena2, 'BLOCKS.BSA'))))) throw new Error('BLOCKS.BSA did not load');
  const maps = new MapsFile();
  if (!maps.load(new Uint8Array(readFileSync(join(arena2, 'MAPS.BSA'))), new Uint8Array(readFileSync(join(arena2, 'CLIMATE.PAK'))), new Uint8Array(readFileSync(join(arena2, 'POLITIC.PAK'))))) throw new Error('MAPS.BSA did not load');
  const { files, ignored, manifest } = bundleWorldData(bundleBytes);
  log(`${vendor}: ${files.size} world-data files (${ignored.length} TextAssets no DFU name reaches: ${ignored.map((p) => p.split('/').pop()).join(', ') || 'none'})`);
  const t0 = Date.now();
  const classic = classicIndex(blocks);
  log(`  classic index: ${classic.byHash.size} pieces, ${classic.halves.length} halves (${Date.now() - t0} ms)`);
  const enc = createEncoder(classic);
  const parsed = new Map([...files].map(([name, f]) => [name, parseFullSerializerJson(f.text)]));
  const packNames = new Set(parsed.keys());

  // Bases first. A location's is its classic self, a block's its classic self when BLOCKS.BSA has it; a block BLOCKS.BSA
  // has not got takes the nearest candidate whose own base is already settled - plain new blocks before the composites
  // made of them (`WALLAA03.FARMBA07` after `FARMBA07`), so no chain of bases can close on itself.
  const bases = new Map();
  const pending = [];
  for (const [name, json] of parsed) {
    const loc = /^location-(\d+)-(\d+)\.json$/.exec(name);
    if (loc) {
      const [r, i] = [Number(loc[1]), Number(loc[2])];
      const c = maps.readClassicLocation(r, i);
      if (!c) throw new Error(`${name}: MAPS.BSA has no location ${r}/${i}`);
      bases.set(name, { base: ['l', r, i, c.name], json: locationToDfuJson(c), depth: 0 });
      continue;
    }
    const blockName = name.replace(/\.json$/, '');
    const index = blocks.getBlockIndex(blockName);
    if (index >= 0) { bases.set(name, { base: ['b', blockName, index], json: classic.blockJson.get(index) ?? blockToDfuJson(blocks.readClassicBlock(index)), depth: 0 }); continue; }
    pending.push(name);
  }
  pending.sort((a, b) => (a.split('.').length - b.split('.').length) || a.localeCompare(b));
  for (const name of pending) {
    const json = parsed.get(name);
    const blockName = name.replace(/\.json$/, '');
    let best = null;
    const candidates = baseCandidates(blockName, blocks, packNames);
    for (const c of candidates.length ? candidates : nearestByGround(json, classic)) {
      let bj, depth = 0;
      if (c.kind === 'b') bj = classic.blockJson.get(c.index) ?? blockToDfuJson(blocks.readClassicBlock(c.index));
      else { const settled = bases.get(c.name); if (!settled || settled.depth >= 2) continue; bj = parsed.get(c.name); depth = settled.depth + 1; }
      const s = baseCost(bj, json);
      if (!best || s < best.s) best = { c, s, bj, depth };
    }
    if (!best) throw new Error(`${name}: no base - neither BLOCKS.BSA nor the pack has a block like it`);
    bases.set(name, { base: best.c.kind === 'b' ? ['b', best.c.name, best.c.index] : ['f', best.c.name], json: best.bj, depth: best.depth });
  }

  const out = { format: PACK_FORMAT, vendor, mod, files: {}, nodes: enc.nodes };
  let done = 0;
  const order = [...parsed.keys()].sort();
  for (const name of order) {
    const json = parsed.get(name);
    const { base, json: baseJson } = bases.get(name);
    const ops = enc.bestOps(baseJson, json, []);
    if (ops.some((op) => op[1].length === 0)) throw new Error(`${name}: an op on the whole document - its base is no base`);
    out.files[name] = [sha256(canonicalJson(json)), base, ops];
    if (++done % 1000 === 0) log(`  encoded ${done}/${order.length} (${enc.nodeCount()} nodes)`);
  }

  // Every file rebuilt through the runtime's own reader, from the pack as it will be SHIPPED (serialised and read back),
  // the author's sha256 for sha256.
  // AUDIT WD3 P5: the name of every classic block a `$c` reference reads, as the BLOCKS.BSA it was built against has it
  out.classicNames = Object.fromEntries(classicIndicesOf(out).map((i) => [i, blocks.getBlockName(i)]));
  const shipped = serialisePack(out);
  const pack = openWorldDataPack(JSON.parse(shipped), { blocks });
  for (const name of order) {
    const back = pack.rebuild(name, maps);
    if (sha256(canonicalJson(back)) !== out.files[name][0]) throw new Error(`${name}: the pack does not rebuild the author's file`);
  }
  log(`  verified ${order.length} files rebuild the author's, ${enc.nodeCount()} nodes (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  return { pack: out, shipped, ignored, manifest };
}

/** The pack as shipped: each file's entry and each node its own JSON text (read when first wanted), the files other
 *  files are based on named up front, the whole gzipped by the caller. */
export function serialisePack(pack) {
  const bases = [...new Set(Object.values(pack.files).filter(([, b]) => b?.[0] === 'f').map(([, b]) => b[1]))].sort();
  const files = {};
  for (const name of Object.keys(pack.files).sort()) files[name] = JSON.stringify(pack.files[name]);
  return JSON.stringify({ format: pack.format, vendor: pack.vendor, mod: pack.mod, bases, ...(pack.classicNames ? { classicNames: pack.classicNames } : {}), files, nodes: pack.nodes.map((n) => JSON.stringify(n)) });
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const flag = (k) => { const i = args.indexOf(k); if (i < 0) return undefined; const v = args[i + 1]; args.splice(i, 2); return v; };
  const title = flag('--title'), author = flag('--author'), version = flag('--version');
  const [arena2, bundle, vendor, outFile] = args;
  if (!arena2 || !bundle || !vendor || !outFile || !outFile.endsWith('.pack.json.gz')) {
    console.error('usage: node tools/worldDataPackBuild.mjs <arena2> <bundle.dfmod> <vendor> <out.pack.json.gz> [--title T] [--author A] [--version V]');
    process.exit(1);
  }
  const { pack, shipped } = buildPack({ arena2, bundleBytes: new Uint8Array(readFileSync(bundle)), vendor, mod: { title, author, version }, log: (s) => console.log(s) });
  mkdirSync(dirname(outFile), { recursive: true });
  const gz = zlib.gzipSync(Buffer.from(shipped, 'utf8'), { level: 9 });
  writeFileSync(outFile, gz);
  console.log(`wrote ${outFile}: ${(gz.length / 1e6).toFixed(2)} MB gzipped (${(shipped.length / 1e6).toFixed(2)} MB), ${Object.keys(pack.files).length} files, ${pack.nodes.length} nodes`);
}
