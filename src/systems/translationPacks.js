// L10N3b (2026-09-27, Mac: "Install + bundle allowed" - a player installs any DFU translation pack from their own disk):
// WHAT A DFU TRANSLATION PACK HOLDS, by the path DFU reads each file from. A pack is loose files for Daggerfall
// Unity's StreamingAssets, usually inside a folder of its own ("French files for DFU 1.2/Text/..."):
//   Text/<Table>.csv                 a string table - Internal_Strings, Internal_RSC, Internal_Locations... (TextManager)
//   Text/Quests/<QUEST>-LOC.txt      a quest's messages in the language (Quest.cs's -LOC lookup)
//   Text/Books/<BOOK>-LOC.txt        a book in the language (LocalizedBook.cs)
//   Text/NameGen.txt                 the name banks (NameHelper), JSON
//   Text/<Name>.txt                  a text table in DFU's Table format - MainMenu, GameSettings, a grammar's lists
//   Fonts/FONT000N-SDF.ttf|.otf      a classic font's face (DaggerfallFont.ReplaceTMPFontFromFile)
//   Fonts/FONT000N-SDF.txt           the characters that face is asked for first (LoadCustomFontChars)
// Anything else - a README, the translators' own tools, a .dfmod, textures - is not text the game reads, and is left.
// Pure: the store (scenes/translationStore.js) keeps the files, and scenes/localeData.js puts them to use.

export const PACK_KIND = Object.freeze({
  TABLE: 'table', QUEST: 'quest', BOOK: 'book', NAMEGEN: 'nameGen', TEXT_TABLE: 'textTable', FONT: 'font', FONT_CHARS: 'fontChars',
});
/** The kinds read as text; a font is bytes. */
export const TEXT_KINDS = new Set([PACK_KIND.TABLE, PACK_KIND.QUEST, PACK_KIND.BOOK, PACK_KIND.NAMEGEN, PACK_KIND.TEXT_TABLE, PACK_KIND.FONT_CHARS]);

/** A pack file's kind and name by its path - `{ kind, name }` - or null for a file the game does not read. The path is
 *  read from its LAST `Text` or `Fonts` folder on (any case, either slash), so a pack's own top folder, a zip's, or a
 *  whole StreamingAssets tree all read the same. */
export function classifyPackFile(path) {
  const parts = String(path ?? '').replace(/\\/g, '/').split('/').filter(Boolean);
  let at = -1;
  for (let i = parts.length - 2; i >= 0; i--) {
    const seg = parts[i].toLowerCase();
    if (seg === 'text' || seg === 'fonts') { at = i; break; }
  }
  if (at < 0) return null;
  const folder = parts[at].toLowerCase();
  const rest = parts.slice(at + 1);
  const file = rest[rest.length - 1];
  let m;
  if (folder === 'fonts') {
    if (rest.length !== 1) return null;
    if ((m = /^(FONT000[0-4])-SDF\.(ttf|otf)$/i.exec(file))) return { kind: PACK_KIND.FONT, name: m[1].toUpperCase() };
    if ((m = /^(FONT000[0-4])-SDF\.txt$/i.exec(file))) return { kind: PACK_KIND.FONT_CHARS, name: m[1].toUpperCase() };
    return null;
  }
  if (rest.length === 2) {
    const sub = rest[0].toLowerCase();
    if (sub === 'quests' && (m = /^(.+)-LOC\.txt$/i.exec(file))) return { kind: PACK_KIND.QUEST, name: m[1].toUpperCase() };
    if (sub === 'books' && (m = /^(.+)-LOC\.txt$/i.exec(file))) return { kind: PACK_KIND.BOOK, name: m[1].toUpperCase() };
    return null;
  }
  if (rest.length !== 1) return null;
  if ((m = /^([A-Za-z0-9_]+)\.csv$/i.exec(file))) return { kind: PACK_KIND.TABLE, name: m[1] };
  if (/^NameGen\.txt$/i.test(file)) return { kind: PACK_KIND.NAMEGEN, name: 'NameGen' };
  if ((m = /^([A-Za-z0-9_]+)\.txt$/i.exec(file))) return { kind: PACK_KIND.TEXT_TABLE, name: m[1] };
  return null;
}

/** The files a pack's listing holds that the game reads, one per kind and name (a later path of the same kind and name
 *  replaces an earlier one, as DFU's later search path does), and how many of each kind. */
export function packContents(paths) {
  const files = new Map();   // `${kind}:${name}` -> { kind, name, path }
  for (const path of paths ?? []) {
    const c = classifyPackFile(path);
    if (c) files.set(`${c.kind}:${c.name}`, { ...c, path });
  }
  const counts = Object.fromEntries(Object.values(PACK_KIND).map((k) => [k, 0]));
  for (const f of files.values()) counts[f.kind]++;
  return { files: [...files.values()], counts };
}

/** Whether a pack's contents are a translation at all: a string table, a quest or a book. */
export const isTranslationPack = (counts) => !!counts && counts.table + counts.quest + counts.book > 0;

/** The pack's name, off its listing: the folder above its `Text` or `Fonts`, else the fallback (a zip's own name). */
export function packNameOf(paths, fallback = 'Translation pack') {
  for (const path of paths ?? []) {
    const parts = String(path).replace(/\\/g, '/').split('/').filter(Boolean);
    const at = parts.findIndex((p, i) => i < parts.length - 1 && /^(text|fonts)$/i.test(p));
    if (at > 0 && !/^streamingassets$/i.test(parts[at - 1])) return parts[at - 1];
    if (at > 1 && /^streamingassets$/i.test(parts[at - 1])) return parts[at - 2];
  }
  return fallback;
}
