#!/usr/bin/env node
// L10N6 (2026-10-03): A BUNDLED TRANSLATION PACK, AS THE TREE HOLDS ONE.
//
// Mac's first decision (Localization-Arc.md): a player installs any Daggerfall Unity translation pack from their own
// disk (L10N3b), and the port BUNDLES a pack only when its terms allow it - credited, and kept as separately licensed
// data. Mac, 2026-10-03: build the way, bundle nothing until each author's permission is in hand. This is the way:
//
//   locales/<tag>/pack/PACK.json      who made it and on what terms (below) - required
//   locales/<tag>/pack/LICENSE        the pack's own licence text, verbatim (PACK.json `licenseFile` names another)
//   locales/<tag>/pack/Text/...       the pack's files in DFU's own layout, exactly as a player would install them
//   locales/<tag>/pack/Fonts/...      (systems/translationPacks.js classifyPackFile reads every path)
//
// PACK.json: { "name", "authors": [..], "source": "<where it is published>", "license": "<SPDX id or 'permission'>",
//              "terms": "<what the authors allowed, and when>", "version"?, "licenseFile"? }
// The build loads a bundled pack over the machine drafts and beneath any pack the player installs (scenes/localeData.js),
// and the About pane credits it (ui/credits.js translationCredits). A pack's textures and subtitled videos are edits of
// Bethesda's assets and fall under the no-ARENA2 rule whatever its terms say: anything here that is not text the game
// reads, a font, the licence or a README is refused.
//
//   node tools/l10nPack.mjs            every bundled pack checked (exit 1 on a problem)
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseStringTableCsv } from '../src/systems/textManager.js';
import { classifyPackFile, PACK_KIND } from '../src/systems/translationPacks.js';
import { isMain } from './lib/isMain.mjs';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
/** A file a pack folder may hold that the game does not read. */
const LOOSE = /^(PACK\.json|LICEN[CS]E(\.[a-z]+)?|COPYING(\.[a-z]+)?|README(\.[a-z]+)?|CREDITS(\.[a-z]+)?)$/i;

const walk = (d, out = []) => {
  for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p, out); else out.push(p); }
  return out;
};

/** What PACK.json must say. Answers the problems, [] when it says enough. */
export function packMetaProblems(meta) {
  const out = [];
  if (!meta || typeof meta !== 'object') return ['PACK.json is not an object'];
  for (const k of ['name', 'source', 'license', 'terms']) if (typeof meta[k] !== 'string' || !meta[k].trim()) out.push(`PACK.json has no ${k}`);
  if (!Array.isArray(meta.authors) || !meta.authors.length || !meta.authors.every((a) => typeof a === 'string' && a.trim())) out.push('PACK.json names no authors');
  return out;
}

/** `code`'s bundled pack - { meta, tables: { Table: rows }, quests, books, fonts, problems } - or null when there is none. */
export function readBundledPack(code, root = ROOT) {
  const dir = join(root, 'locales', code, 'pack');
  if (!existsSync(dir)) return null;
  const problems = [];
  let meta = null;
  try { meta = JSON.parse(readFileSync(join(dir, 'PACK.json'), 'utf8')); } catch { problems.push('no readable PACK.json'); }
  problems.push(...(meta ? packMetaProblems(meta) : []));
  const licenseFile = meta?.licenseFile ?? 'LICENSE';
  if (!existsSync(join(dir, licenseFile))) problems.push(`no ${licenseFile} - the pack's own licence text is bundled beside it`);
  const out = { meta: meta ?? {}, tables: {}, quests: 0, books: 0, fonts: 0, problems };
  for (const path of walk(dir)) {
    const rel = relative(dir, path).split('\\').join('/');
    if (!rel.includes('/') && LOOSE.test(rel)) continue;
    const f = classifyPackFile(rel);
    if (!f) { problems.push(`${rel}: not text the game reads (a pack's textures and videos are Bethesda's, never bundled)`); continue; }
    if (f.kind === PACK_KIND.TABLE) out.tables[f.name] = parseStringTableCsv(readFileSync(path, 'utf8')).length;
    else if (f.kind === PACK_KIND.QUEST) out.quests++;
    else if (f.kind === PACK_KIND.BOOK) out.books++;
    else if (f.kind === PACK_KIND.FONT) out.fonts++;
  }
  return out;
}

/** Every bundled pack in the tree: { code -> pack }. */
export function bundledPacks(root = ROOT) {
  const dir = join(root, 'locales');
  const out = {};
  for (const code of readdirSync(dir)) {
    if (!statSync(join(dir, code)).isDirectory()) continue;
    const p = readBundledPack(code, root);
    if (p) out[code] = p;
  }
  return out;
}

if (isMain(import.meta.url)) {
  const packs = bundledPacks();
  let bad = 0;
  for (const [code, p] of Object.entries(packs)) {
    console.log(`${code}: ${p.meta.name ?? '?'} (${p.meta.license ?? '?'}) - ${Object.keys(p.tables).length} tables, ${p.quests} quests, ${p.books} books, ${p.fonts} fonts`);
    for (const x of p.problems) { console.error(`  ${x}`); bad++; }
  }
  if (!Object.keys(packs).length) console.log('no bundled packs (locales/<tag>/pack/) - every pack is a player\'s own install');
  process.exit(bad ? 1 : 0);
}
