// STUDIO1 (2026-10-17, bible/07-Rendering/Studio-Art.md): THE STUDIO'S TOOL - what the game's artists can paint, the
// pictures they start from, and whether their folder is ready to ship.
//
//   node tools/studioArt.mjs                 every slot the port paints itself, and which the studio already covers
//   node tools/studioArt.mjs templates [dir] each slot's picture as the game wears it today, as a PNG named the way the
//                                            studio names it - repaint it, drop it in your folder (default dir:
//                                            studio-templates/, which git ignores)
//   node tools/studioArt.mjs check           the folder's rules (scripts/studioArtIndex.mjs) and every picture decoded;
//                                            exits 1 on a problem - the suite runs the same check
//
// The studio page (studio.html, on the dev server and the site) shows and hands out the same templates in a browser.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { writePng } from './pngIO.mjs';
import { isMain } from './lib/isMain.mjs';
import { studioListing, STUDIO_TREE } from '../scripts/studioArtIndex.mjs';
import { studioEntries } from '../src/systems/studioArt/studioArt.js';
import { LAST_CLASSIC_TEXTURE_ARCHIVE } from '../src/formats/textureFile.js';
import { STUDIO_SETS, studioSlots } from '../src/systems/studioArt/studioSlots.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

/** Every picture the studio holds, by the key it paints. */
const studioByKey = (listing) => new Map(studioEntries(listing.files).map((e) => [e.key, e]));

/** AUDIT STUDIO1 C4: the pictures git would never commit - a folder named as one .gitignore passes over - each with the
 *  pattern that ignores it. Nothing outside a git checkout (a tree of a test's own). */
function ignoredByGit(at, files) {
  if (!files.length) return [];
  const r = spawnSync('git', ['check-ignore', '-v', '--no-index', '--stdin'], { cwd: at, input: files.map((f) => `${STUDIO_TREE}/${f}`).join('\n'), encoding: 'utf8' });
  if (r.status !== 0 || !r.stdout) return [];
  return r.stdout.split('\n').filter(Boolean).map((line) => {
    const [why, path] = line.split('\t');
    return { path: path.slice(STUDIO_TREE.length + 1), pattern: why.split(':').slice(2).join(':') };
  });
}

/**
 * THE CHECK: the folder's rules, then - `problems`, which fail - every picture decoded whole (a header can say PNG over
 * bytes that will not decode), a picture git would never commit (C4), and a name of a painted model's archive that is
 * none of its slots (no door asks for it: a digit dropped, the frame mistyped); and `notes`, said: a picture whose shape
 * is not its slot's (its face would stretch it), clear texels on a slot the game draws solid (they come out black), and
 * an archive past TEXTURE.511 that is no painted model's (a mod's, or a number to check). Daggerfall's own archives'
 * names cannot be checked here: they are the player's data. Exported for the suite
 * (test/systems/studioArt/studio1_folder.test.js, auditstudio1.test.js).
 */
export async function checkStudio(at = root) {
  const listing = studioListing(at);
  const problems = [...listing.problems], notes = [];
  const slots = new Map();
  for (const set of STUDIO_SETS) for (const s of studioSlots(set)) slots.set(s.key, s);
  const sets = new Map(STUDIO_SETS.map((s) => [s.archive, s]));
  for (const { path, pattern } of ignoredByGit(at, listing.files)) problems.push(`${path}: git ignores it (.gitignore's \`${pattern}\`), so it would never be committed - rename the folder`);
  for (const e of studioEntries(listing.files)) {
    let png;
    try { png = PNG.sync.read(readFileSync(join(at, STUDIO_TREE, e.path))); } catch (err) {
      problems.push(`${e.path}: will not decode (${err?.message ?? err}) - re-export it as PNG`);
      continue;
    }
    const slot = slots.get(e.key);
    if (slot) {
      const p = await slot.picture();
      if (p && Math.abs(png.width / png.height - p.width / p.height) > 0.01) notes.push(`${e.path}: ${png.width} x ${png.height}, and ${slot.name} is ${p.width} x ${p.height} - it is stretched to the slot's shape`);
      if (!slot.cutout && png.data.some((v, i) => (i & 3) === 3 && v < 128)) notes.push(`${e.path}: clear texels, and ${slot.name} is drawn solid - they come out black; paint them`);
    } else if (e.map === 'Albedo' && sets.has(e.archive)) {
      problems.push(`${e.path}: ${sets.get(e.archive).title} has no picture ${e.key} - the templates' names are its slots (a digit dropped, the frame mistyped?)`);
    } else if (e.map === 'Albedo' && e.archive > LAST_CLASSIC_TEXTURE_ARCHIVE) {
      notes.push(`${e.path}: archive ${e.archive} is none of the painted models' - it is worn only where a mod's own picture of that name stands (check the number)`);
    }
  }
  return { listing, problems, notes };
}

async function list(at, log) {
  const listing = studioListing(at);
  const own = studioByKey(listing);
  for (const set of STUDIO_SETS) {
    const slots = studioSlots(set);
    log(`\n${set.title} - archive ${set.archive}, ${slots.length} slots${set.door === 'painted' ? '' : ' (on the texture door)'}`);
    for (const s of slots) {
      const p = await s.picture();
      const by = own.get(s.key);
      log(`  ${s.key.padEnd(12)} ${`${p.width} x ${p.height}`.padEnd(10)} ${s.name}${s.cutout ? ' (glass)' : ''}${by ? `   <- studio: ${by.path}` : ''}`);
      own.delete(s.key);
    }
  }
  if (own.size) {
    log("\nPictures of no painted model (Daggerfall's own textures, a mod's, or a name to check - see `check`):");
    for (const e of own.values()) log(`  ${e.key.padEnd(12)} ${e.path}`);
  }
  log(`\nThe studio: ${listing.files.length} picture(s) worn, ${listing.problems.length} problem(s) - node tools/studioArt.mjs check says which.`);
  return 0;
}

async function templates(at, log, dir = null) {
  const out = dir ? resolve(dir) : join(at, 'studio-templates');   // a folder named is the caller's; the default is the checkout's (ignored)
  let n = 0;
  for (const set of STUDIO_SETS) {
    mkdirSync(join(out, set.id), { recursive: true });
    for (const s of studioSlots(set)) {
      const p = await s.picture();
      writeFileSync(join(out, set.id, s.fileName), writePng({ width: p.width, height: p.height, data: Uint8Array.from(p.data) }));
      n++;
    }
  }
  log(`${n} templates in ${out}`);
  return 0;
}

async function check(at, log) {
  const { listing, problems, notes } = await checkStudio(at);
  for (const n of notes) log(`note: ${n}`);
  for (const p of problems) log(`PROBLEM: ${p}`);
  log(`${listing.files.length} picture(s) worn by ${listing.roster.length} artist(s) on the roster; ${problems.length} problem(s).`);
  return problems.length ? 1 : 0;
}

/**
 * The tool's commands, run over the checkout at `at` (AUDIT STUDIO1 E13: a tree of a test's own), each line said to
 * `log`. Answers the exit code: 0, 1 when `check` finds a problem, 2 for a command it does not know.
 */
export async function studioCli([cmd = 'list', arg] = [], { at = root, log = console.log } = {}) {
  if (cmd === 'list') return list(at, log);
  if (cmd === 'templates') return templates(at, log, arg);
  if (cmd === 'check') return check(at, log);
  log('usage: node tools/studioArt.mjs [list | templates [dir] | check]');
  return 2;
}

if (isMain(import.meta.url)) process.exitCode = await studioCli(process.argv.slice(2));
