// L10N1b (2026-09-27): THE LOCALES' TEXT IN THE BUILD, AND THE LANGUAGE THE GAME STARTS IN.
//
// Every `locales/<tag>/<table>.csv` is one lazy chunk - a DFU string-table CSV (StringTableCSVParser's format, so a
// DFU pack's own files drop in beside the port's) patched into its locale's table of the same name. Only the chosen
// language's files (and its chain's - pt-BR's and then pt's) are ever fetched. `locales/en/` is the English catalog
// the tools and the translators read; the English the game shows is the code's own, so it is never loaded here.
//
// import.meta.glob is Vite's compile-time macro, absent under bare node - so node sees no files (worldOfDaggerfall.js's
// door), the module still loads (test/moduleload_smoke.test.js runs every body), and the tests feed the same files off
// the disk (_useLocaleFilesForTests) to run the boot's laws. Nothing here may stop the game: a language whose text
// fails to load leaves English standing.

import { registerLocale, patchLocaleTable, setLocale, loadStringTableCsv, localeChain, localeInfo, clearLocaleTables, registerLocalizedFont, currentLocale, setLocaleDocuments, localeDocument, BASE_LOCALE, PSEUDO_LOCALE } from '../systems/textManager.js';
import { LOCALE_CATALOG, localeFileOf, resolveLocale, localeForBrowser, catalogLocale } from '../systems/localeCatalog.js';
import { getPref } from '../systems/uiPrefs.js';
import { installLocaleFaces } from '../ui/localeFaces.js';   // L10N2: the classic fonts' faces for the language
import { createGlyphFace } from '../ui/glyphFace.js';   // L10N3b: a pack's own font, grown as DFU's is
import { PACK_KIND } from '../systems/translationPacks.js';
import * as packStore from './translationStore.js';   // L10N3b: the packs the player installed
import '../systems/grammar/frenchGrammar.js';   // L10N3g: the French pack's grammar processor (MIT), chosen for French

const IN_BROWSER = typeof window !== 'undefined';
const FILES = IN_BROWSER ? import.meta.glob('../../locales/*/*.csv', { query: '?raw', import: 'default' }) : {};

/** A glob's locale files by tag - `locales/<tag>/<table>.csv` -> [{ table, load }] - English left out: it is the
 *  code's. */
export function indexLocaleFiles(glob) {
  const byCode = new Map();
  for (const [path, load] of Object.entries(glob ?? {})) {
    const f = localeFileOf(path);
    if (!f || f.code === BASE_LOCALE) continue;
    if (!byCode.has(f.code)) byCode.set(f.code, []);
    byCode.get(f.code).push({ table: f.table, load });
  }
  return byCode;
}
let byCode = indexLocaleFiles(FILES);

/** L10N3b: the installed packs, by tag - read from the store at boot and after every install or removal. */
let _packs = new Map();
/** Whether the game holds text for `code`: the build's (English and the pseudo-locale always), or an installed pack. */
export const hasLocaleText = (code) => code === BASE_LOCALE || code === PSEUDO_LOCALE || byCode.has(code) || (_packs.has(code) && !!catalogLocale(code));

let _registered = false;
/** The catalog's languages whose text the game holds, told to the text core once - each with its installed pack's
 *  record (`pack`), which the language row shows. */
export function registerLocales() {
  if (_registered) return;
  _registered = true;
  for (const info of LOCALE_CATALOG) if (hasLocaleText(info.code)) registerLocale({ ...info, pack: _packs.get(info.code) ?? null });
}
/** L10N3b: read the installed packs again, and tell the text core. */
export async function refreshPacks() {
  _packs = await packStore.installedPacks();
  for (const info of LOCALE_CATALOG) if (hasLocaleText(info.code)) registerLocale({ ...info, pack: _packs.get(info.code) ?? null });
  return _packs;
}
/** The installed pack's record for `code`, or null. */
export const installedPackFor = (code) => _packs.get(code) ?? null;

/** The current language's pack text of `kind` and `name` - a quest's or a book's -LOC file, a name bank - walking its
 *  chain; null when no pack in it has one. The text core keeps it (localeDocument), for the readers that ask. */
export const localePackText = (kind, name, code = currentLocale()) => localeDocument(kind, name, code);

/** A pack's font as a face: its bytes loaded as a FontFace (DaggerfallFont.ReplaceTMPFontFromFile's font from the
 *  pack), grown on demand. Null where there is no FontFace (bare node) or the font will not load. */
async function packFontFace(tag, name, bytes) {
  if (typeof globalThis.FontFace !== 'function') return null;
  try {
    const family = `dfu-pack-${tag}-${name}`;
    const face = new globalThis.FontFace(family, bytes);
    await face.load();
    globalThis.document?.fonts?.add?.(face);
    return createGlyphFace(`"${family}"`, { name: `pack-${tag}-${name}`, lang: tag });
  } catch (err) {
    console.warn(`[text] the pack's ${name} did not load - the language's own face stands:`, err?.message ?? err);
    return null;
  }
}

/** Put `tag`'s installed pack to use: its string tables patched over the build's drafts (a person's translation
 *  outranks a machine's - StringTablePatcher's overwrite), its fonts registered as DFU registers a localized font, the
 *  rest kept for the readers that ask. */
async function applyPack(tag) {
  if (!_packs.has(tag)) return;
  const text = new Map();
  for (const f of await packStore.packFiles(tag)) {
    if (f.kind === PACK_KIND.TABLE) {
      const rows = loadStringTableCsv(f.data);
      if (rows) patchLocaleTable(tag, f.name, rows);
    } else if (f.kind === PACK_KIND.FONT) {
      const face = await packFontFace(tag, f.name, f.data);
      if (face) registerLocalizedFont(tag, f.name, face);
    } else {
      text.set(`${f.kind}:${f.name}`, f.data);
    }
  }
  setLocaleDocuments(tag, text);
}

const _loaded = new Map();   // tag -> the promise of its tables patched in
/** Fetch and patch every table of `code`'s chain not yet loaded. A load that fails is forgotten, so the next ask
 *  fetches again. */
export function loadLocaleText(code) {
  const jobs = [];
  for (const tag of localeChain(code)) {
    if (!byCode.has(tag) && !_packs.has(tag)) continue;
    if (!_loaded.has(tag)) {
      _loaded.set(tag, Promise.all((byCode.get(tag) ?? []).map(async ({ table, load }) => {
        const rows = loadStringTableCsv(await load());
        if (rows) patchLocaleTable(tag, table, rows);
      })).then(() => applyPack(tag)).catch((err) => { _loaded.delete(tag); throw err; }));   // L10N3b: the pack over the drafts
    }
    jobs.push(_loaded.get(tag));
  }
  return Promise.all(jobs);
}

/** L10N3b: `code`'s text read again from the start - its tables and documents emptied and loaded afresh, drafts then
 *  pack - after a pack was installed or removed. Every lookup reads the tables live, so nothing else is owed. */
export async function reloadLocaleText(code) {
  clearLocaleTables(code);
  _loaded.delete(code);
  await loadLocaleText(code);
}

/** L10N3b: install `entries` (a folder's files or a zip's, translationStore.entriesFromFiles) as `code`'s pack, and put
 *  it to use at once. Answers the pack's record; throws, changing nothing, when they hold no translation. */
export async function installTranslationPack(code, entries, opts = {}) {
  if (!catalogLocale(code) || code === BASE_LOCALE || catalogLocale(code).hidden) throw new Error(`${code} is not a language a pack can be installed for`);
  const record = await packStore.installPack(code, entries, opts);
  await refreshPacks();
  await reloadLocaleText(code);
  return record;
}
/** L10N3b: remove `code`'s pack; its drafts stand again. */
export async function removeTranslationPack(code) {
  const had = await packStore.removePack(code);
  await refreshPacks();
  await reloadLocaleText(code);
  return had;
}

/** The page's own language and direction, for the browser's fonts, hyphenation and screen readers. */
export function applyDocumentLanguage(code) {
  const html = globalThis.document?.documentElement;
  if (!html) return;
  html.lang = code === PSEUDO_LOCALE ? BASE_LOCALE : code;
  html.dir = localeInfo(code)?.dir ?? 'ltr';
}

/** Switch to `wanted` (English when the build holds no text for it): its text loaded, its classic fonts given their
 *  face (L10N2), the core switched, the page's language set. Answers the locale that stands. */
export async function switchLocale(wanted) {
  registerLocales();
  const code = resolveLocale(wanted, hasLocaleText);
  await loadLocaleText(code);
  installLocaleFaces(code);
  setLocale(code);
  applyDocumentLanguage(code);
  return code;
}

/** The browser's own languages, most wanted first. */
export function browserLanguages() {
  const nav = globalThis.navigator;
  return nav?.languages?.length ? [...nav.languages] : [nav?.language].filter(Boolean);
}

/** THE BOOT'S LANGUAGE: `?lang=` for one visit, else the player's own choice (uiPrefs `language`). While English
 *  stands and the front door has not yet offered the browser's own language, that language's text is fetched too, so
 *  the offer can ask in it (ui/enhancedMenu.js languageOffer). A failure leaves English standing and the game starts. */
export async function initLocale(params = null, { languages = browserLanguages() } = {}) {
  try {
    _packs = await packStore.installedPacks();   // L10N3b: before anything is registered, so a pack's language is offered
    const code = await switchLocale(params?.get?.('lang') ?? getPref('language'));
    if (code === BASE_LOCALE && !params?.has?.('lang') && !getPref('languageOffered')) {
      const offer = localeForBrowser(languages, hasLocaleText);
      if (offer) await loadLocaleText(offer).catch((err) => console.warn('[text] the offered language could not load:', err?.message ?? err));
    }
    return code;
  } catch (err) {
    console.error('[text] the language could not load; English stands:', err?.message ?? err);
    setLocale(BASE_LOCALE);
    applyDocumentLanguage(BASE_LOCALE);
    return BASE_LOCALE;
  }
}

/** Tests: the files of `glob` (path -> loader, as Vite's glob gives them) in place of the build's, nothing registered
 *  or loaded yet. */
export function _useLocaleFilesForTests(glob) {
  byCode = indexLocaleFiles(glob);
  _registered = false;
  _loaded.clear();
  _packs = new Map();
}
