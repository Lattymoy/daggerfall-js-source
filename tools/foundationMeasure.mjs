#!/usr/bin/env node
// FOUNDATION (2026-10-30, bible/03-World/Foundation-Arc.md): the measurement pass DnfJeff's proposal "A Foundation for
// Scale" asked for as its first step - each structural number it states, re-taken on this tree by one method that is
// written down, so both sides read the same figures. The world's own numbers (places, blocks, doors) are the atlas's:
// `node tools/atlasMeasure.mjs`.
//   node tools/foundationMeasure.mjs          the table
//   node tools/foundationMeasure.mjs --json   the figures as JSON
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMain } from './lib/isMain.mjs';
import { parseModule, findHostFunction, lines, logicalLines } from './hostScope.mjs';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** The four hosts the proposal counts: the scene hosts THE FOUR HOSTS RULE names. */
export const HOSTS = Object.freeze([
  ['src/scenes/world.js', 'bootWorld'],
  ['src/scenes/worldModes.js', 'createWorldModes'],
  ['src/scenes/dungeonContext.js', 'buildDungeonContext'],
  ['src/scenes/exterior.js', 'bootExterior'],
]);

/** Every file under `dir` (relative to the root) whose name passes `keep`. Skips node_modules and dot directories. */
export function walk(dir, keep, root = ROOT) {
  /** @type {string[]} */ const out = [];
  const go = (/** @type {string} */ d) => {
    let names;
    try { names = readdirSync(join(root, d), { withFileTypes: true }); } catch { return; }
    for (const e of names) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const p = d ? `${d}/${e.name}` : e.name;
      if (e.isDirectory()) go(p);
      else if (keep(p)) out.push(p);
    }
  };
  go(dir);
  return out.sort();
}

/** Each host function's length in source lines and in logical lines (tools/hostScope.mjs, the ceiling's measure). */
export function measureHosts(root = ROOT) {
  return HOSTS.map(([file, name]) => {
    const host = findHostFunction(parseModule(readFileSync(join(root, file), 'utf8')), name);
    return { file, name, lines: host ? lines(host.fn) : 0, logical: host ? logicalLines(host.fn) : 0 };
  });
}

/** An assertion's call site: `assert(`, `assert.x(`, `t.assert.x(`. Counted in the text, not at run time. */
const ASSERT_CALL = /\bassert(?:\.\w+)?\s*\(/g;
/** A test that reads one of our source files as text: a readFileSync (or a helper named read*) of a path under a
 *  source directory. */
const READS_SOURCE = /\b(?:readFileSync|read\w*)\s*\([^)]*['"`](?:\.\.\/)*(?:src|server\/src|server-account\/src)\//;
/** A text pin: an assertion that matches a pattern or a string against text. */
const TEXT_PIN = /\bassert\.(?:match|doesNotMatch)\s*\(|\bassert(?:\.ok)?\s*\(\s*!?\s*\w+(?:\.\w+)*\.(?:includes|test|indexOf)\s*\(/g;

/** The suite's assertion call sites, and how many of them sit in files that read our source as text. */
export function measureTests(root = ROOT) {
  const files = walk('test', (p) => p.endsWith('.test.js'), root);
  let asserts = 0, textPins = 0, readerFiles = 0, readerAsserts = 0, readerTextPins = 0;
  for (const f of files) {
    const src = readFileSync(join(root, f), 'utf8');
    const a = (src.match(ASSERT_CALL) ?? []).length;
    const pins = (src.match(TEXT_PIN) ?? []).length;
    asserts += a; textPins += pins;
    if (READS_SOURCE.test(src)) { readerFiles++; readerAsserts += a; readerTextPins += pins; }
  }
  return { files: files.length, asserts, textPins, readerFiles, readerAsserts, readerTextPins };
}

/** What a presentation-free layer may not reach: the renderer, the UI, the scene hosts, or the browser's page. */
const PRESENTATION_IMPORT = /from\s+['"](?:\.\.\/)+(?:render|ui|scenes)\//;
const PAGE_GLOBAL = /\b(?:document|window)\.\w|\bWebGL2?RenderingContext\b|\bgetContext\s*\(\s*['"]webgl/;

/** How many files of a layer reach presentation, by import or by touching the page. */
export function measureLayer(dir, root = ROOT) {
  const files = walk(dir, (p) => p.endsWith('.js'), root);
  const touching = files.filter((f) => {
    const src = readFileSync(join(root, f), 'utf8');
    return PRESENTATION_IMPORT.test(src) || PAGE_GLOBAL.test(src);
  });
  return { dir, files: files.length, touching: touching.length, list: touching };
}

/** PNG files in the tree, by top directory, and their bytes. */
export function measureArt(root = ROOT) {
  /** @type {Record<string, { files: number, bytes: number }>} */ const by = {};
  for (const top of ['public', 'vendor', 'src']) {
    const pngs = walk(top, (p) => p.toLowerCase().endsWith('.png'), root);
    by[top] = { files: pngs.length, bytes: pngs.reduce((s, p) => s + statSync(join(root, p)).size, 0) };
  }
  return by;
}

/** The bible: its pages, lines and words. */
export function measureBible(root = ROOT) {
  const pages = walk('bible', (p) => p.endsWith('.md'), root);
  let lineCount = 0, words = 0;
  for (const p of pages) {
    const text = readFileSync(join(root, p), 'utf8');
    lineCount += text.split('\n').length;
    words += text.split(/\s+/).filter(Boolean).length;
  }
  return { pages: pages.length, lines: lineCount, words };
}

/** Where the classic PopupText model (ui/hud/hudText.js HudText) is made: one ring a file that constructs one. */
export function measureTextRings(root = ROOT) {
  return walk('src', (p) => p.endsWith('.js'), root)
    .filter((f) => /\bnew HudText\s*\(/.test(readFileSync(join(root, f), 'utf8')))
    .map((f) => relative(root, join(root, f)));
}

/** Which of the four hosts files the HUD's lines in the message ring (the notebook's addMessage): its file names the
 *  sink the ring is reached by (`hudMessageSink` - set on the talk host, or threaded to a dungeon). */
export function measureMessageRing(root = ROOT) {
  return HOSTS.map(([file, name]) => [name, /\bhudMessageSink\b/.test(readFileSync(join(root, file), 'utf8'))]);
}

/** The two skins: the enhanced face's files and lines, the screens a door picks a face for (`ui/**Door.js`), the
 *  classic windows PORT2 wears in both (ui/enhanced/enhancedPorts.js PORT_SPECS' entries), and the skin's call sites. */
export function measureSkins(root = ROOT) {
  const enhanced = walk('src/ui/enhanced', (p) => p.endsWith('.js'), root);
  const lines = enhanced.reduce((n, f) => n + readFileSync(join(root, f), 'utf8').split('\n').length, 0);
  const doors = walk('src/ui', (p) => /Door\.js$/.test(p), root).length;
  const portsFile = join(root, 'src/ui/enhanced/enhancedPorts.js');
  const spec = existsSync(portsFile) ? /PORT_SPECS = Object\.freeze\(\{([^}]*)\}\)/.exec(readFileSync(portsFile, 'utf8')) : null;
  const ports = spec ? spec[1].split(',').filter((w) => w.trim()).length : 0;
  const calls = walk('src', (p) => p.endsWith('.js'), root).reduce((n, f) => n + (readFileSync(join(root, f), 'utf8').match(/\bisEnhanced(?:Plus)?\(/g) ?? []).length, 0);
  return { enhancedFiles: enhanced.length, enhancedLines: lines, doors, ports, calls };
}

export function measureAll(root = ROOT) {
  return {
    hosts: measureHosts(root),
    tests: measureTests(root),
    systems: measureLayer('src/systems', root),
    formats: measureLayer('src/formats', root),
    art: measureArt(root),
    bible: measureBible(root),
    textRings: measureTextRings(root),
    ring: measureMessageRing(root),
    skins: measureSkins(root),
  };
}

if (isMain(import.meta.url)) {
  const m = measureAll();
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ ...m, systems: { ...m.systems, list: undefined }, formats: { ...m.formats, list: m.formats.list } }, null, 2));
  } else {
    const sum = m.hosts.reduce((s, h) => s + h.lines, 0);
    for (const h of m.hosts) console.log(`host ${h.name.padEnd(20)} ${String(h.lines).padStart(6)} lines ${String(h.logical).padStart(6)} logical`);
    console.log(`hosts, the four             ${sum} lines`);
    const t = m.tests;
    console.log(`tests ${t.files} files, ${t.asserts} assertion sites, ${t.textPins} text pins; ${t.readerFiles} files read our source (${t.readerAsserts} sites, ${t.readerTextPins} text pins)`);
    for (const l of [m.systems, m.formats]) console.log(`${l.dir}: ${l.touching} of ${l.files} reach presentation`);
    for (const [k, v] of Object.entries(m.art)) console.log(`png ${k}: ${v.files} files, ${(v.bytes / 1e6).toFixed(1)} MB`);
    console.log(`bible ${m.bible.pages} pages, ${m.bible.lines} lines, ${m.bible.words} words`);
    console.log(`PopupText rings: ${m.textRings.join(', ')}`);
    console.log(`the message ring: ${m.ring.map(([n, w]) => `${n} ${w ? 'files' : 'does not file'}`).join(', ')}`);
    const k = m.skins;
    console.log(`skins: ${k.enhancedFiles} enhanced files (${k.enhancedLines} lines), ${k.doors} doors pick a face, ${k.ports} classic windows worn in both, ${k.calls} skin call sites`);
  }
}
