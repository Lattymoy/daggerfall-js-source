// FIRST-VISIT (bible/07-Rendering/Performance-Priority.md FIRST-VISIT, "Refresh on update"): A COMPUTATION'S SOURCE, PINNED.
//
// An answer kept across launches (src/systems/firstVisit/) is keyed on its inputs and on its computation's pin: a hash
// over the code that computes the answer and nothing else - the named roots and every top-level declaration they reach
// by name, followed across imports, as tokens (a comment or a line break moves nothing) - and over any shipped data file
// the computation reads. The pins are generated, never written by hand: scripts/firstVisitPins.mjs writes them into
// src/firstVisitPins.js at install and at build, and the dev server serves them live (scripts/firstVisitPins.mjs
// firstVisitPinsPlugin). An update that does not touch a computation keeps its kept answers; one that does is a new key,
// so every player's kept answer is worked out again on their next launch.
//
//   node tools/computationPin.mjs          every cache's pin
//
// The walk is by name, not by meaning: an identifier in a root's text that names a top-level declaration of its file,
// or an import of it, is followed - a word that only happens to share a name pulls in a little more, never less.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tokenizer } from 'acorn';
import { parseModule } from './hostScope.mjs';
import { isMain } from './lib/isMain.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** A module's top-level declarations by name, its imports and its local re-exports. */
const modules = new Map();
function moduleOf(file) {
  const src = readFileSync(file, 'utf8');
  let m = modules.get(file);
  if (m?.src === src) return m;
  const ast = parseModule(src);
  const tops = new Map(); // name -> source text of its declaration
  const imports = new Map(); // local name -> { from, name } (name '*' for a namespace)
  const aliases = new Map(); // exported name -> its local name (`export { a as b }`)
  const declare = (node, name) => tops.set(name, src.slice(node.start, node.end));
  for (const s of ast.body) {
    const d = s.type === 'ExportNamedDeclaration' || s.type === 'ExportDefaultDeclaration' ? (s.declaration ?? s) : s;
    if (s.type === 'ImportDeclaration') {
      for (const sp of s.specifiers) {
        imports.set(sp.local.name, {
          from: s.source.value,
          name:
            sp.type === 'ImportNamespaceSpecifier'
              ? '*'
              : sp.type === 'ImportDefaultSpecifier'
                ? 'default'
                : sp.imported.name,
        });
      }
      continue;
    }
    if (s.type === 'ExportNamedDeclaration' && s.source) {
      for (const sp of s.specifiers) imports.set(sp.exported.name, { from: s.source.value, name: sp.local.name });
      continue;
    }
    if (s.type === 'ExportNamedDeclaration' && !s.declaration) {
      for (const sp of s.specifiers)
        if (sp.exported.name !== sp.local.name) aliases.set(sp.exported.name, sp.local.name);
      continue;
    }
    if (d.type === 'FunctionDeclaration' || d.type === 'ClassDeclaration') {
      if (d.id) declare(d, d.id.name);
    } else if (d.type === 'VariableDeclaration')
      for (const v of d.declarations) for (const n of namesIn(v.id)) declare(d, n);
  }
  m = { file, src, tops, imports, aliases };
  modules.set(file, m);
  return m;
}
function namesIn(pattern) {
  if (!pattern) return [];
  if (pattern.type === 'Identifier') return [pattern.name];
  if (pattern.type === 'ObjectPattern') return pattern.properties.flatMap((p) => namesIn(p.value ?? p.argument));
  if (pattern.type === 'ArrayPattern') return pattern.elements.flatMap((e) => namesIn(e));
  if (pattern.type === 'RestElement') return namesIn(pattern.argument);
  if (pattern.type === 'AssignmentPattern') return namesIn(pattern.left);
  return [];
}
/** A text's tokens - comments and layout dropped. */
function tokensOf(text) {
  const out = [];
  for (const t of tokenizer(text, {
    ecmaVersion: 'latest',
    sourceType: 'module',
    allowReturnOutsideFunction: true,
    allowHashBang: true,
  })) {
    out.push(
      t.type.label === 'name' || t.value === undefined ? (t.value ?? t.type.label) : `${t.type.label}:${t.value}`,
    );
  }
  return out;
}
function resolveImport(file, from) {
  if (!from.startsWith('.')) return null; // a package: its version is the lockfile's, not this pin's
  const p = resolve(dirname(file), from);
  return existsSync(p) ? p : null;
}

/**
 * The pin of a computation: its roots ([file, name] pairs, paths from the repo root) and every declaration they reach,
 * and `files` (shipped data it reads: paths, or a directory and a suffix), hashed. `skip`: files the walk never enters
 * (the kept answers' own modules, which hold the VERSION this pin becomes). Answers 8 hex digits.
 * @param {{ roots: [string, string][], files?: (string | [string, RegExp])[], skip?: string[], root?: string }} o
 */
export function computationPin(o) {
  const { seen, data } = computationReach(o);
  const h = createHash('sha256');
  for (const k of [...seen.keys()].sort()) h.update(`${k}\n${seen.get(k)}\n`);
  for (const f of data) h.update(`${f}\n`).update(dataBytes(resolve(o.root ?? ROOT, f)));
  return h.digest('hex').slice(0, 8);
}
/** What a pin is taken over: `seen` the declarations ("file#name" -> their tokens), `data` the shipped files. */
export function computationReach({ roots, files = [], skip = [], root = ROOT }) {
  const rel = (p) => relative(root, p).split(sep).join('/').replace(/\\/g, '/'); // the same key on every OS
  const skipSet = new Set(skip.map((f) => resolve(root, f)));
  const seen = new Map(); // "file#name" -> token text
  const visit = (file, name, root = false) => {
    const key = `${rel(file)}#${name}`;
    if (seen.has(key) || (skipSet.has(file) && !root)) return; // a root is walked even in a skipped file - only what it reaches by name is skipped
    if (file.endsWith('.json') || name === '*') {
      seen.set(key, file.endsWith('.json') ? dataBytes(file).toString('utf8') : tokensOf(moduleOf(file).src).join(' '));
      return;
    }
    const m = moduleOf(file);
    if (m.aliases.has(name)) {
      visit(file, m.aliases.get(name));
      return;
    }
    const imp = m.imports.get(name);
    if (!m.tops.has(name)) {
      if (imp) {
        const to = resolveImport(file, imp.from);
        if (to) visit(to, imp.name);
      }
      return;
    }
    const tokens = tokensOf(m.tops.get(name));
    seen.set(key, tokens.join(' '));
    for (const id of new Set(tokens)) {
      if (id === name) continue;
      if (m.tops.has(id)) visit(file, id);
      else if (m.imports.has(id)) {
        const i = m.imports.get(id);
        const to = resolveImport(file, i.from);
        if (to) visit(to, i.name);
      }
    }
  };
  for (const [file, name] of roots) {
    const f = resolve(root, file);
    if (!moduleOf(f).tops.has(name)) throw new Error(`computationPin: ${file} declares no ${name}`);
    visit(f, name, true);
  }
  return { seen, data: files.flatMap((x) => (Array.isArray(x) ? listed(root, x[0], x[1]) : [x])).sort() };
}
/** A shipped file's bytes as the pin reads them: a text file with its line ends as LF, so a checkout that writes CRLF
 *  (core.autocrlf on Windows) pins the same. */
function dataBytes(file) {
  const b = readFileSync(file);
  return file.endsWith('.json') ? Buffer.from(b.toString('utf8').replace(/\r\n/g, '\n'), 'utf8') : b;
}
/** Every file under `dir` (paths from the repo root) whose path `match` (a RegExp) finds. */
function listed(root, dir, match) {
  const out = [];
  const walk = (d) => {
    for (const e of readdirSync(resolve(root, d), { withFileTypes: true })) {
      const p = `${d}/${e.name}`;
      if (e.isDirectory()) walk(p);
      else if (match.test(p)) out.push(p);
    }
  };
  walk(dir);
  return out;
}

// the store's own door and the generated pins - a pin reaching the pins would be a pin of itself
const KEPT = ['src/systems/firstVisit/firstVisitStore.js', 'src/firstVisitPins.js', 'src/buildTag.js'];
/** Every kept answer's computation, by the name its cache asks firstVisitPin for: its roots, the shipped data it reads,
 *  and the files its walk does not enter (the kept answers' own modules). */
export const FIRST_VISIT_COMPUTATIONS = Object.freeze({
  groundTiles: {
    // a block's ground tiles as the world-data door serves it: the classic reader, the door, the packs and patches it
    // rebuilds, the arena's own block, the carriages' layer - and the mods' shipped world data itself
    roots: [
      ['src/formats/blocksFile.js', 'BlocksFile'],
      ['src/formats/worldData/worldDataReplacement.js', 'getDFBlockReplacementData'],
      ['src/formats/worldData/worldDataPack.js', 'openWorldDataPack'],
      ['src/formats/worldData/worldDataPatch.js', 'rebuildWorldDataPatch'],
      ['src/world/arena/arenaCity.js', 'installArena'],
      ['src/world/immersiveTravelGates.js', 'installImmersiveTravelGates'],
      ['src/scenes/modWorldData.js', 'loadModWorldData'],
      ['src/world/terrain/groundTilesKept.js', 'pack'],
      ['src/world/terrain/groundTilesKept.js', 'unpack'],
    ],
    files: [['vendor', /\/WorldData(Patches)?\/[^/]+\.json$|\.pack\.json\.gz$/]],
    skip: [
      'src/world/terrain/terrainTiles.js',
      'src/world/terrain/groundTilesKept.js',
      'src/world/portSitesKept.js',
      ...KEPT,
    ],
  },
  landPieces: {
    roots: [['src/systems/travel/travelRoute.js', 'routeGround']],
    skip: ['src/systems/travel/landPiecesKept.js', ...KEPT],
  },
  portSites: {
    roots: [
      ['src/world/portSites.js', 'portSitesOn'],
      ['src/world/merchantYards/merchantYardSites.js', 'closeSite'],
    ],
    skip: ['src/world/portSitesKept.js', ...KEPT],
  },
  shipBuilds: {
    roots: [
      ['src/world/ships/galleonModel.js', 'galleonPrefab'],
      ['src/world/ships/carrackModel.js', 'carrackPrefab'],
      ['src/world/ships/largeBoatModel.js', 'largeBoatPrefab'],
    ],
    skip: ['src/systems/comeSailAway/shipBuildsKept.js', 'src/world/ships/standInsKept.js', ...KEPT],
  },
  standIns: {
    roots: [
      ['src/world/ships/galleonArt.js', 'registerGalleonArt'],
      ['src/world/ships/carrackArt.js', 'registerCarrackArt'],
      ['src/world/ships/largeBoatArt.js', 'registerLargeBoatArt'],
      ['src/world/dfLook.js', 'setDfLookPalette'],
    ],
    skip: ['src/world/ships/standInsKept.js', ...KEPT],
  },
  bayFit: {
    roots: [['src/world/tamriel/tamrielLand.js', 'fitBayToPicture']],
    skip: ['src/world/tamriel/bayFitKept.js', ...KEPT],
  },
});

/** Every kept answer's pin, by its cache's name. */
export const firstVisitPins = (root = ROOT) =>
  Object.fromEntries(
    Object.entries(FIRST_VISIT_COMPUTATIONS).map(([name, c]) => [name, computationPin({ ...c, root })]),
  );

if (isMain(import.meta.url)) {
  for (const [name, pin] of Object.entries(firstVisitPins())) console.log(`${name.padEnd(12)} ${pin}`);
}
