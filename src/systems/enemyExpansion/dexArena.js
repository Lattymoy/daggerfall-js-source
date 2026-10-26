// ARN3 (2026-10-26; Mac: "let's do arena") - THE ENEMY EXPANSION'S CREATURES IN TES: ARENA'S OWN SPRITES. Arena's
// bestiary is much of the mod's: its goblin, lizard man, homunculus, medusa, wolves, hell hound, troll, wraith, ghost,
// spider, golems, ghoul, fire daemon and minotaur (dexStandIns.js `arena`). Bethesda's freeware, read from the player's
// own GLOBAL.BSA and PAL.COL (scenes/dataSource.js, the TES: Arena store) - never carried, as ARENA2 is not.
//
// AN ARENA CREATURE IS SIX FILES (OpenTESArena, MIT: OpenTESArena/src/Entities/ArenaAnimUtils.h): `<set>1`-`<set>5`
// its five facings, front to back, mirrored for the other three - DFU's own scheme (characters/mobile/mobileUnit.js
// MOVE_ANIMS) - each frames 0-5 its walk and 6-7 a look aside (CreatureWalkIndices, CreatureLookIndices), the front's
// 8-11 its attack (CreatureAttackIndices: Arena attacks facing you, so no other facing has one); and `<set>6` its death,
// three frames, the last the body on the floor. Into the mod's records (the same layout its own pictures had, dexArt.js):
//   move (0-4)                      the facing's walk
//   attack, ranged, spell (5-9, 20-29)  the front's attack, a turned facing's first four walking frames
//   hurt (10-14)                    the facing's look aside (its first frame where the file has none)
//   idle (15-19)                    the facing's first frame
//   the corpse record (dexStandIns.js DEX_CORPSE_RECORDS)  the death's last frame
// Arena's sprites face the other way from Daggerfall's - a side view looks right where Daggerfall's looks left (the
// Skeletal Warrior's TEXTURE.270 record 2 against SKELE3.CFA) - so every picture is mirrored. A creature is scaled
// once, every record alike, so it stands as tall as the authors' art stood (`height`). Their emission maps went with
// their art; nothing of Arena's glows.

import { TesArenaBsa } from '../../formats/tesArena/tesArenaBsa.js';
import { TesArenaCfaFile } from '../../formats/tesArena/tesArenaCfa.js';
import { loadTesArenaPalette } from '../../formats/tesArena/tesArenaPalette.js';
import { classicRecordRgba } from '../../formats/derivedTexture.js';
import { DEX_STAND_INS, DEX_CORPSE_RECORDS } from './dexStandIns.js';

export const TES_ARENA_XML_VENDOR = 'tes-arena';

/** The Arena file and frames a mod record is drawn from, `{ file, frames }`, or null - `counts[file]` the frames each of
 *  the set's six files has. */
export function arenaSourceOf(record, counts, corpseRecord) {
  if (record === corpseRecord) return counts[6] ? { file: 6, frames: [counts[6] - 1] } : null;
  if (record >= 30) return null;
  const facing = record % 5, kind = Math.floor(record / 5), file = facing + 1, n = counts[file] ?? 0;
  if (!n) return null;
  const range = (from, to) => Array.from({ length: Math.max(0, Math.min(to, n) - from) }, (_, i) => from + i);
  if (kind === 0) return { file, frames: range(0, 6) };
  if (kind === 2) return { file, frames: [n >= 8 ? 6 : 0] };
  if (kind === 3) return { file, frames: [0] };
  if (facing === 0 && n >= 12) return { file, frames: range(8, 12) };
  return { file, frames: range(0, 4) };
}

/** A creature's six files decoded - `{ width, height, frames }` by file number - or null when GLOBAL.BSA lacks one. */
export function decodeArenaSet(bsa, set) {
  const files = {};
  for (let file = 1; file <= 6; file++) {
    const name = `${set}${file}.CFA`, bytes = bsa.get(name);
    if (!bytes) return null;
    const c = new TesArenaCfaFile().load(bytes, name);
    files[file] = { width: c.header.widthUncompressed, height: c.header.height, frames: c.frames };
  }
  return files;
}

/** One frame as a top-down RGBA picture in Daggerfall's facing: mirrored, index 0 clear. */
export function arenaPicture(file, frame, palette) {
  const { width, height } = file, src = file.frames[frame];
  const data = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data[y * width + x] = src[y * width + (width - 1 - x)];
  return classicRecordRgba({ width, height, data }, palette);
}

/** The rows a frame draws on, top to bottom - how tall the creature in it is. */
export function visibleHeight(file, frame = 0) {
  const { width, height } = file, px = file.frames[frame];
  let top = -1, bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) if (px[y * width + x]) { if (top < 0) top = y; bottom = y; break; }
  }
  return top < 0 ? 0 : bottom - top + 1;
}

/** Every Arena picture the mod's layouts draw, as texture-door entries, and the xml scale each archive stands at.
 *  `layouts[archive]` is the mod's record list (dexArt.js frames); an archive whose set GLOBAL.BSA lacks keeps its
 *  classic copies. */
export function dexArenaEntries(bsa, palette, layouts) {
  const entries = [], scales = {}, sets = new Map();
  for (const [a, s] of Object.entries(DEX_STAND_INS)) {
    if (!s.arena || !layouts[a]) continue;
    if (!sets.has(s.arena)) sets.set(s.arena, decodeArenaSet(bsa, s.arena));
    const files = sets.get(s.arena);
    if (!files) continue;
    const archive = Number(a), counts = Object.fromEntries(Object.entries(files).map(([f, v]) => [f, v.frames.length]));
    const scale = s.height / (visibleHeight(files[1]) || files[1].height);
    scales[archive] = {};
    layouts[a].forEach((n, record) => {
      const src = n ? arenaSourceOf(record, counts, DEX_CORPSE_RECORDS[archive]) : null;
      if (!src) return;
      scales[archive][record] = [scale, scale];
      src.frames.forEach((f, frame) => entries.push({
        archive, record, frame, map: 'Albedo', standIn: true, readOnly: true, fileName: `${s.arena}${src.file}.CFA_${f}`,
        build: async () => arenaPicture(files[src.file], f, palette),
      }));
    });
  }
  return { entries, scales };
}

/** The player's two files, from the TES: Arena store - null where either is missing (or there is no store: a test). */
async function storedArenaFiles() {
  try {
    const d = await import('../../scenes/dataSource.js');
    const [bsa, pal] = await Promise.all([d.loadTesArenaFile('GLOBAL.BSA'), d.loadTesArenaFile('PAL.COL')]);
    return bsa && pal ? { bsa, pal } : null;
  } catch {
    return null;
  }
}

/** Read the player's Arena and put its sprites on the texture door in place of the classic copies, the xml scales
 *  beside them. Answers the pictures registered - 0 with no Arena attached, which leaves Daggerfall's copies standing.
 *  `deps` (a test's): `files()` the bytes, `layouts`, `add` / `remove` / `xml` the doors. */
export async function registerDexArenaArt({ files = storedArenaFiles, layouts, add, remove, xml }) {
  const got = await files();
  if (!got) return 0;
  const { entries, scales } = dexArenaEntries(new TesArenaBsa(got.bsa), loadTesArenaPalette(got.pal), layouts);
  if (!entries.length) return 0;
  const drawn = new Set(entries.map((e) => e.archive));
  remove((e) => drawn.has(e.archive));
  xml(TES_ARENA_XML_VENDOR, scales);
  return add(entries);
}
