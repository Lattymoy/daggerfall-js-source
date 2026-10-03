// L10N1 (2026-09-27, the request: "a proper localization/translation integration for our game ... for as many
// languages as we possibly can and do this right"). DAGGERFALL UNITY'S TEXT CORE, AND THE PORT'S LOCALES ON TOP OF IT.
//
// What DFU has, ported 1:1 (the doctrine's translation rule):
//   - TextManager.cs - the ten string-table collections, GetLocalizedText (the runtime collection, then the default
//     one, then an error string or a throw), GetLocalizedTextWithReversion, GetLocalizedTextList (split on newlines,
//     cached), GetLocalizedTextListFromKeyArray, TryGetLocalizedText, SplitTextList, the id-keyed name helpers
//     (region, location, spell, item, magic item, faction) and the localized-font registry. GetLocalizedEnemyName's
//     index law already has its one home (characters/enemyBasics.js enemyDisplayName) and reads the list from here.
//   - StringTableCSVParser.cs - the two-column Key,Value reader, regex and all: an UNQUOTED value is cut at its first
//     comma, a key can hold no comma, quote or newline, and the header row is dropped only when it is exactly
//     Key/Value. Every DFU translation pack is authored against this parser, so its quirks are kept.
//   - StringTablePatcher.cs - a pack's rows overwrite the table's entry or are added to it.
//   - Grammar.cs / DefaultGrammarRules.cs (DFU master, PR #2667) - one grammar processor, the identity by default,
//     that a language's rules replace (the French pack's FrenchGrammarRules).
//
// What DFU does not have, and the port adds (a Ledger A departure - DFU patches ONE English table in place, keeps no
// second language and never clears its list cache):
//   - LOCALES. A table set per language, one selected, switchable in play. A lookup walks the locale's chain - its
//     own tag, then each shorter tag (pt-BR, then pt), then en - so a regional pack falls back to its language.
//   - ENGLISH STAYS IN THE CODE. The port holds DFU's en values as constants where DFU resolves a key (the standing
//     MECHANISM departure, Port-Ledger A); `localizedText(key, en)` answers the table's word for the key in the
//     current locale, else the constant. English is therefore byte-identical by construction.
//   - THE PORT'S OWN STRINGS (the online game, the enhanced skin, the port's systems) live in a collection DFU does
//     not have, Port_Strings, keyed by dotted names and written in a small ICU MessageFormat subset (`t`): {name},
//     {n, number}, {n, plural, ...}, {n, selectordinal, ...} and {x, select, ...}, the plural and ordinal categories
//     from Intl.PluralRules - so "1 item / 2 items" has a form for every language's rules, not one English ternary.
//   - A PSEUDO-LOCALE (qps-ploc): every routed string accented and lengthened, its macros, markup and arguments
//     kept whole - text that stays plain English was never routed, and text that overflows has no room to grow.
//
// This module imports nothing: every game fact it needs (an English list, a canonical name, a font) is handed to it.

/** DaggerfallUnityEnums.cs TextCollections, plus the port's own (`Port`). */
export const TextCollections = Object.freeze({
  Internal: 'Internal', TextRSC: 'TextRSC', TextFlats: 'TextFlats', TextQuests: 'TextQuests', TextLocations: 'TextLocations',
  TextSettings: 'TextSettings', TextSpells: 'TextSpells', TextItems: 'TextItems', TextMagicItems: 'TextMagicItems', Factions: 'Factions',
  Port: 'Port',
});

/** TextManager.cs:34-43 - the default collection names; `Port_Strings` is the port's. */
export const DEFAULT_COLLECTION_NAMES = Object.freeze({
  Internal: 'Internal_Strings', TextRSC: 'Internal_RSC', TextFlats: 'Internal_Flats', TextQuests: 'Internal_Quests',
  TextLocations: 'Internal_Locations', TextSettings: 'Internal_Settings', TextSpells: 'Internal_Spells', TextItems: 'Internal_Items',
  TextMagicItems: 'Internal_MagicItems', Factions: 'Internal_Factions', Port: 'Port_Strings',
});

/** TextManager.cs:45 - what an unfound, unexcepted lookup answers. */
export const LOCALIZED_TEXT_LOOKUP_ERROR = '<LocaleText-NotFound>';

/** The language the port's code is written in. */
export const BASE_LOCALE = 'en';
/** The pseudo-locale (the private-use tag Windows' pseudo-localization uses). */
export const PSEUDO_LOCALE = 'qps-ploc';

// ─── the runtime collection names (TextManager.cs:52-61) ───────────────────────────────────────────────────────────
const _runtime = new Map(Object.entries(DEFAULT_COLLECTION_NAMES));

/** GetRuntimeCollectionName (TextManager.cs:258-298): an unknown collection is Internal's (the switch's default). */
export function runtimeCollectionName(collection) { return _runtime.get(collection) ?? _runtime.get(TextCollections.Internal); }
/** The runtime* fields' setters: a mod redirects a collection to a table of its own. */
export function setRuntimeCollectionName(collection, name) {
  if (!Object.hasOwn(DEFAULT_COLLECTION_NAMES, collection)) throw new Error(`unknown text collection '${collection}'`);
  _runtime.set(collection, name || DEFAULT_COLLECTION_NAMES[collection]);
  _listCache.clear();
}
/** GetDefaultCollectionName (TextManager.cs:305-341), verbatim: its switch has NO TextFlats case, so a flats miss
 *  falls back to Internal_Strings through the default arm. Kept - it is the table a DFU pack's flats row misses into. */
export function defaultCollectionName(collection) {
  if (collection === TextCollections.TextFlats) return DEFAULT_COLLECTION_NAMES.Internal;
  return DEFAULT_COLLECTION_NAMES[collection] ?? DEFAULT_COLLECTION_NAMES.Internal;
}

// ─── the locales (the port's) ──────────────────────────────────────────────────────────────────────────────────────
const _tables = new Map();   // locale -> Map<collectionName, Map<key, value>>
const _infos = new Map();    // locale -> its description
const _listCache = new Map();
const _listeners = new Set();
let _locale = BASE_LOCALE;

/** A locale's description: `code` (a BCP 47 tag), `name` (in its own language), `englishName`, `dir` ('ltr' or
 *  'rtl'), `source` ('base', 'community', 'machine', 'mixed' or 'pseudo') and whatever a host adds (credits, fonts). */
export function registerLocale(info) {
  if (!info?.code || typeof info.code !== 'string') throw new Error('a locale needs a code');
  const prev = _infos.get(info.code) ?? {};
  _infos.set(info.code, Object.freeze({ dir: 'ltr', source: 'community', ...prev, ...info }));
  return _infos.get(info.code);
}
export const localeInfo = (code = _locale) => _infos.get(code) ?? null;
export const availableLocales = () => [..._infos.values()];
export const currentLocale = () => _locale;

/** The tags a lookup walks for `code`: the tag, each shorter tag, then the base locale ('pt-BR' -> pt-BR, pt, en). */
export function localeChain(code = _locale) {
  const out = [];
  const parts = String(code || BASE_LOCALE).split('-');
  for (let n = parts.length; n > 0; n--) out.push(parts.slice(0, n).join('-'));
  if (!out.includes(BASE_LOCALE)) out.push(BASE_LOCALE);
  return out;
}

/** Select a locale. The list cache is cleared (DFU's is never cleared - a switch in play would keep the old lists)
 *  and every listener is told. Answers whether it changed. */
export function setLocale(code) {
  const next = code || BASE_LOCALE;
  if (next === _locale) return false;
  _locale = next;
  _listCache.clear();
  _revision++;
  chooseGrammar();
  for (const fn of [..._listeners]) { try { fn(next); } catch (err) { console.error('[text] a locale listener threw:', err?.message ?? err); } }
  return true;
}
/** A listener for locale switches; answers its remover. */
export function onLocaleChange(fn) { _listeners.add(fn); return () => _listeners.delete(fn); }

/** The table `name` of `locale` - null when it has none, unless `create`. */
export function localeTable(locale, name, { create = false } = {}) {
  let set = _tables.get(locale);
  if (!set) { if (!create) return null; set = new Map(); _tables.set(locale, set); }
  let table = set.get(name);
  if (!table && create) { table = new Map(); set.set(name, table); }
  return table ?? null;
}
/** StringTablePatcher.PostprocessTable (StringTablePatcher.cs:27-43): each row overwrites the table's entry or is
 *  added to it. `rows` is [key, value] pairs (parseStringTableCsv's) or a Map. Answers how many rows landed. */
export function patchStringTable(table, rows) {
  let n = 0;
  for (const [k, v] of rows instanceof Map ? rows : rows ?? []) { table.set(k, v); n++; }
  return n;
}
/** Patch `locale`'s table `name` with `rows` - a pack's CSV, laid over whatever the table already holds. */
export function patchLocaleTable(locale, name, rows) {
  const n = patchStringTable(localeTable(locale, name, { create: true }), rows);
  if (n) { _listCache.clear(); _revision++; }
  return n;
}
/** Forget every table and document of `locale` (a pack removed). */
export function clearLocaleTables(locale) {
  const had = _tables.delete(locale);
  if (_docs.delete(locale) || had) { _listCache.clear(); _revision++; }
}

// ─── L10N3b/L10N3c: A TRANSLATION'S DOCUMENTS ──────────────────────────────────────────────────────────────────────
// A pack's text that is not a table row - its quests' and books' -LOC files, its name banks, its text tables - kept by
// kind and name for each locale, and read along the chain as a table is. The text core is the one store: the loader
// (scenes/localeData.js) writes here, and the quest machine and the book reader read here.
const _docs = new Map();   // locale -> Map(`${kind}:${name}` -> text)
let _revision = 0;
/** A number that moves whenever what a lookup could answer moves - a locale switched, a table patched, a locale's
 *  text forgotten, its documents set - so a cache kept outside the core (a parsed -LOC quest) knows to go stale. */
export const textRevision = () => _revision;
/** `locale`'s documents, all of them at once: [[`${kind}:${name}`, text]] or a Map. */
export function setLocaleDocuments(locale, docs) { _docs.set(locale, new Map(docs)); _revision++; }
/** The first locale on `code`'s chain holding a document of `kind` and `name`, its text; null when none does. */
export function localeDocument(kind, name, code = _locale) {
  for (const loc of localeChain(code)) {
    const v = _docs.get(loc)?.get(`${kind}:${name}`);
    if (v !== undefined) return v;
  }
  return null;
}

/** TextProvider.GetLocalizedString's table read, over the locale chain: the first locale whose table `name` holds
 *  `key`. Answers undefined when none does. */
function readTable(name, key, chain = localeChain()) {
  const k = String(key);
  for (const loc of chain) {
    const v = _tables.get(loc)?.get(name)?.get(k);
    if (v !== undefined) return v;
  }
  return undefined;
}

// ─── TextManager's public localized-text methods ───────────────────────────────────────────────────────────────────
/** TryGetLocalizedText(collection, key) (TextManager.cs:557-560): the RUNTIME collection only. Answers the text,
 *  or undefined. */
export function tryGetLocalizedText(collection, key) { return readTable(runtimeCollectionName(collection), key); }

/** GetLocalizedText (TextManager.cs:356-374): the runtime collection, then the default one, then a throw
 *  (`exception`) or LOCALIZED_TEXT_LOOKUP_ERROR. */
export function getLocalizedText(key, collection = TextCollections.Internal, exception = false) {
  const v = readTable(runtimeCollectionName(collection), key) ?? readTable(defaultCollectionName(collection), key);
  if (v !== undefined) return v;
  if (exception) throw new Error(`Localized text not found for collection='${collection}', key='${key}'`);
  return LOCALIZED_TEXT_LOOKUP_ERROR;
}

/** GetLocalizedTextWithReversion (TextManager.cs:387-402): as GetLocalizedText, with `reversion` answered before
 *  the error - but only a NON-EMPTY one (string.IsNullOrEmpty), so an empty reversion still errors. */
export function getLocalizedTextWithReversion(key, collection = TextCollections.Internal, exception = false, reversion = null) {
  const v = readTable(runtimeCollectionName(collection), key) ?? readTable(defaultCollectionName(collection), key);
  if (v !== undefined) return v;
  if (reversion) return reversion;
  if (exception) throw new Error(`Localized text not found for collection='${collection}', key='${key}'`);
  return LOCALIZED_TEXT_LOOKUP_ERROR;
}

/** SplitTextList (TextManager.cs:568-571): trailing newlines trimmed, then split on \r\n, \r or \n. */
export function splitTextList(textList) { return String(textList).replace(/[\n\r]+$/, '').split(/\r\n|\r|\n/); }

/** GetLocalizedTextList (TextManager.cs:634-653): the RUNTIME collection's entry split into lines, cached per
 *  locale, collection and key. Not found: a throw (`exception`, DFU's default) or null - or, the port's arm, the
 *  English list `reversion` the port holds where DFU's own en table would answer. */
export function getLocalizedTextList(key, collection = TextCollections.Internal, exception = true, reversion = null) {
  const name = runtimeCollectionName(collection);
  const cacheKey = `${_locale}\u0000${name}\u0000${key}`;
  const hit = _listCache.get(cacheKey);
  if (hit) return hit;
  const v = readTable(name, key);
  if (v === undefined) {
    if (reversion) return reversion;
    if (exception) throw new Error(`${name}${key} array text not found`);
    return null;
  }
  const list = Object.freeze(splitTextList(v));
  _listCache.set(cacheKey, list);
  return list;
}

/** GetLocalizedTextListFromKeyArray (TextManager.cs:662-686): every key's text from the runtime collection; one
 *  missing key throws (`exception`) or answers null. */
export function getLocalizedTextListFromKeyArray(keyArray, collection = TextCollections.Internal, exception = true) {
  if (!keyArray?.length) { if (exception) throw new Error('keyArray is null or empty'); return null; }
  const name = runtimeCollectionName(collection);
  const out = [];
  for (const key of keyArray) {
    const v = readTable(name, key);
    if (v === undefined) { if (exception) throw new Error(`Text for key ${key} not found`); return null; }
    out.push(v);
  }
  return out;
}

/** GetLocalizedRegionName (TextManager.cs:467-478): the `regionNames` list's row, else the canonical name
 *  (`canonical(i)`, MapsFile.GetRegionName) when the list is missing or the index is outside it. For display only -
 *  the canonical name stays the key. */
export function getLocalizedRegionName(regionIndex, canonical) {
  const list = getLocalizedTextList('regionNames', TextCollections.Internal, false);
  if (!list?.length || !Number.isInteger(regionIndex) || regionIndex < 0 || regionIndex >= list.length) return canonical(regionIndex);   // L10N3e: an index that is no integer too - C#'s int cannot be one
  return list[regionIndex];
}
/** GetLocalizedLocationName (TextManager.cs:489-496): by MapTableData.MapId, else the canonical `fallback`. */
export const getLocalizedLocationName = (mapId, fallback) => tryGetLocalizedText(TextCollections.TextLocations, mapId) ?? fallback;
/** GetLocalizedSpellName (TextManager.cs:504-511): by spell id, else `standardName` (the broker's
 *  GetStandardSpellName, handed in). */
export const getLocalizedSpellName = (id, standardName) => tryGetLocalizedText(TextCollections.TextSpells, id) ?? standardName;
/** GetLocalizedItemName (TextManager.cs:519-526): by item template index, else `fallback`. */
export const getLocalizedItemName = (id, fallback) => tryGetLocalizedText(TextCollections.TextItems, id) ?? fallback;
/** GetLocalizedMagicItemName (TextManager.cs:534-541): by magic item template index, else `fallback`. */
export const getLocalizedMagicItemName = (id, fallback) => tryGetLocalizedText(TextCollections.TextMagicItems, id) ?? fallback;
/** GetLocalizedFactionName (TextManager.cs:550-557): by faction id, else `fallback`. */
export const getLocalizedFactionName = (id, fallback) => tryGetLocalizedText(TextCollections.Factions, id) ?? fallback;
/** GetLocalizedEnemyName (TextManager.cs:432-459): a MobileTypes id (0-42, and the classes 128-146) reads the
 *  `enemyNames` list - row `id`, or `43 + id - 128` for a class. A custom enemy, or a language whose list is missing or
 *  shorter, answers `fallback`: the port's own name for it (GetCustomEnemyName, then the career's Name). */
export function getLocalizedEnemyName(enemyId, fallback) {
  const id = Number(enemyId);
  if (!Number.isInteger(id) || !((id >= 0 && id <= 42) || (id >= 128 && id <= 146))) return fallback;
  const row = getLocalizedTextList('enemyNames', TextCollections.Internal, false)?.[id < 128 ? id : 43 + id - 128];
  return row ?? fallback;
}

// ─── the localized fonts (TextManager.cs:114-209) ──────────────────────────────────────────────────────────────────
const _fonts = new Map();
let _forceSdf = null;
/** The host's hand for DFU's `DaggerfallUnity.Settings.SDFFontRendering = true` (RegisterLocalizedFont's tail). */
export function setSdfForcer(fn) { _forceSdf = typeof fn === 'function' ? fn : null; }
const fontKey = (locale, fontName) => `${fontName}_${locale}`;   // GetLocaleFontKey (:206-209)
/** RegisterLocalizedFont (:114-125): `font` replaces `fontName` (one of the five FONT000x) for `locale`, and SDF
 *  rendering is forced on - a localized font can only be an SDF one. */
export function registerLocalizedFont(locale, fontName, font) {
  if (locale == null || font == null) { console.error('RegisterLocalizedFont() locale and font cannot be null.'); return; }
  _fonts.set(fontKey(locale, fontName), font);
  _forceSdf?.();
}
/** HasLocalizedFont (:133-160): for `locale`, the current one by default. */
export const hasLocalizedFont = (fontName, locale = _locale) => locale != null && _fonts.has(fontKey(locale, fontName));
/** GetLocalizedFont (:168-203): the registered replacement, or null. */
export const getLocalizedFont = (fontName, locale = _locale) => (locale == null ? null : _fonts.get(fontKey(locale, fontName)) ?? null);

// ─── StringTableCSVParser.cs ───────────────────────────────────────────────────────────────────────────────────────
// ParseCSVRows' line pattern (StringTableCSVParser.cs:116), verbatim. Without a multiline flag `^` is the text's start.
const CSV_LINE = /(?:\n|^)([^",\n]*),((?:"[^"]*")+|[^",\n]*)/g;
const trimCrLf = (s) => s.replace(/^[\r\n]+|[\r\n]+$/g, '');
/** UnescapeCSVvalue (:139-147): a value that opens with a quote loses its outer quotes, and "" becomes ". */
function unescapeCsvValue(value) {
  if (value.length > 0 && value[0] === '"') return value.substring(1, value.length - 1).replaceAll('""', '"');
  return value;
}
/** ParseCSVRows (:113-133): [key, value] rows, each trimmed of \r and \n at both ends; the first row is dropped only
 *  when it is exactly Key,Value. */
export function parseStringTableCsv(csvText) {
  const rows = [];
  for (const m of String(csvText ?? '').matchAll(CSV_LINE)) rows.push([trimCrLf(m[1]), trimCrLf(unescapeCsvValue(m[2]))]);
  if (rows.length > 0 && rows[0][0] === 'Key' && rows[0][1] === 'Value') rows.shift();
  return rows;
}
/** Load (:37-80), given the file's text: the BOM a StreamReader would strip, stripped; an empty file answers null,
 *  and so does one that fails to parse. */
export function loadStringTableCsv(csvText) {
  if (csvText == null) return null;
  const s = String(csvText).replace(/^\uFEFF/, '');
  if (!s) return null;
  try { return parseStringTableCsv(s); } catch (err) {
    console.error(`Could not parse CSV. Exception message: ${err?.message ?? err}`);
    return null;
  }
}
/** The port's writer for the same format, so every file it writes reads back through ParseCSVRows unchanged: the
 *  Key,Value header, every value quoted with its quotes doubled. A key the parser cannot read (a comma, quote or
 *  newline), or a value that begins or ends with a line break (the parser trims those), throws. */
export function formatStringTableCsv(rows) {
  let out = 'Key,Value\n';
  for (const [k, v] of rows instanceof Map ? rows : rows ?? []) {
    const key = String(k), value = String(v);
    if (/[",\r\n]/.test(key)) throw new Error(`a string-table key cannot hold a comma, quote or line break: ${JSON.stringify(key)}`);
    if (/^[\r\n]|[\r\n]$/.test(value)) throw new Error(`a string-table value cannot begin or end with a line break: ${key}`);
    out += `${key},"${value.replaceAll('"', '""')}"\n`;
  }
  return out;
}
/** LoadDictionary (:92-105): the rows as a Map; a key twice throws, as Dictionary.Add does. */
export function loadStringTableDictionary(csvText) {
  const dict = new Map();
  for (const [k, v] of loadStringTableCsv(csvText) ?? []) {
    if (dict.has(k)) throw new Error(`An item with the same key has already been added. Key: ${k}`);
    dict.set(k, v);
  }
  return dict;
}

// ─── Grammar.cs / DefaultGrammarRules.cs (DFU master, PR #2667) ────────────────────────────────────────────────────
/** GrammarRules: a language's grammar tokens resolved in finished text; the hero's and an NPC's gender reachable
 *  through getters the game hands in. L10N3g: the getters are the MANAGER's, shared by every language's rules - DFU
 *  keeps them on its one processor (statics, in the French rules), so a getter handed in while English was chosen
 *  still answers after a switch to French. */
export class GrammarRules {
  processGrammar(text) { return text; }
  setHeroGenderGetter(getter) { GrammarManager.heroGender = typeof getter === 'function' ? getter : null; }
  setNPCGenderGetter(getter) { GrammarManager.npcGender = typeof getter === 'function' ? getter : null; }
}
/** DefaultGrammarRules: the identity. */
export class DefaultGrammarRules extends GrammarRules {}
const DEFAULT_GRAMMAR = new DefaultGrammarRules();
/** GrammarManager: the one processor, replaced by a language's rules; the two gender getters. */
export const GrammarManager = { grammarProcessor: DEFAULT_GRAMMAR, heroGender: null, npcGender: null };
/** GrammarManager.grammarProcessor.ProcessGrammar(text), at the sites DFU calls it. */
export const processGrammar = (text) => GrammarManager.grammarProcessor.processGrammar(text);

/** L10N3g: the grammar rules a language brings - DFU's language mod replaces GrammarManager.grammarProcessor when it
 *  loads; here the rules register under their language and are chosen whenever it is on the current locale's chain
 *  (fr-CA reads fr's). A registration outlives a test reset, as an import does. */
const _grammars = new Map();
export function registerGrammarRules(language, rules) { _grammars.set(language, rules); chooseGrammar(); }
function chooseGrammar() {
  for (const loc of localeChain(_locale)) {
    const rules = _grammars.get(loc) ?? _grammars.get(loc.split('-')[0]);
    if (rules) { GrammarManager.grammarProcessor = rules; return; }
  }
  GrammarManager.grammarProcessor = DEFAULT_GRAMMAR;
}

// ─── the port's lookups over the constants it holds ────────────────────────────────────────────────────────────────
/** The table's word for `key` in the current locale (the runtime collection, then the default), else `en` - the
 *  constant the port holds for DFU's en value. Under the pseudo-locale an unrouted-but-routable string is shown
 *  pseudo-localized. English answers `en` untouched. */
export function localizedText(key, en = '', collection = TextCollections.Internal) {
  const v = readTable(runtimeCollectionName(collection), key) ?? readTable(defaultCollectionName(collection), key);
  if (v !== undefined) return v;
  return _locale === PSEUDO_LOCALE ? pseudoLocalize(en) : en;
}
/** The list form: the table's entry split into lines, else the port's English list `en`. */
export function localizedTextList(key, en, collection = TextCollections.Internal) {
  const list = getLocalizedTextList(key, collection, false, null);
  if (list) return list;
  return _locale === PSEUDO_LOCALE ? Object.freeze(en.map((s) => pseudoLocalize(s))) : en;
}

/** THE PORT'S OWN STRINGS: `key` in Port_Strings for the current locale, else the English pattern `en`, formatted
 *  with `args` (formatMessage). */
export function t(key, en, args = null) {
  const v = readTable(runtimeCollectionName(TextCollections.Port), key);
  const pattern = v ?? en;
  const pseudo = v === undefined && _locale === PSEUDO_LOCALE;
  return formatMessage(pattern, args, { locale: intlLocale(), pseudo });
}

/** L10N3d: a table of DFU text constants keyed by their Internal_Strings key, each read through localizedText at the
 *  moment it is read - GetLocalizedText(key) where DFU asks for it - so the table's English is the fallback and a
 *  translation's row the answer. English reads the constants, byte for byte. Frozen and enumerable: the same shape as
 *  the plain table it replaces, so every `TABLE.key` read stays as it was. */
export function localizedStrings(en, collection = TextCollections.Internal) {
  const out = {};
  for (const [key, value] of Object.entries(en)) {
    Object.defineProperty(out, key, { enumerable: true, get: () => localizedText(key, value, collection) });
  }
  return Object.freeze(out);
}

/** L10N3d: a table keyed by the port's own names whose words are DFU's - `entries` maps each name to [its DFU key,
 *  DFU's English] (GuildServices.Training -> "serviceTraining") - read as localizedStrings reads. An entry that is a
 *  function is the port's own line beside DFU's (a `t` call, L10N4): it is that name's getter as it stands, so a table
 *  that mixes the two keeps one shape. */
export function localizedTable(entries, collection = TextCollections.Internal) {
  const out = {};
  for (const [name, entry] of Object.entries(entries)) {
    const get = typeof entry === 'function' ? entry : () => localizedText(entry[0], entry[1], collection);
    Object.defineProperty(out, name, { enumerable: true, get });
  }
  return Object.freeze(out);
}

/** C#'s string.Format over DFU's patterns: `{n}`, and `{n:00}` zero-padded to its zeros. A placeholder with no
 *  argument - a translation's slip - is left as it stands, where the C# would throw. */
export function formatText(pattern, ...args) {
  return String(pattern).replace(/\{(\d+)(?::(0+))?\}/g, (whole, i, zeros) => {
    if (Number(i) >= args.length) return whole;
    const v = args[Number(i)];
    if (!zeros || !Number.isFinite(Number(v))) return String(v ?? '');
    const n = Number(v);
    return (n < 0 ? '-' : '') + String(Math.abs(Math.round(n))).padStart(zeros.length, '0');
  });
}

/** `t` for a locale other than the current one - its own chain, its own plural rules (L10N1b: the front door offers
 *  a language IN that language, before switching to it). */
export function tIn(code, key, en, args = null) {
  const v = readTable(runtimeCollectionName(TextCollections.Port), key, localeChain(code));
  return formatMessage(v ?? en, args, { locale: intlLocale(code), pseudo: v === undefined && code === PSEUDO_LOCALE });
}

/** The tag Intl is asked with: the pseudo-locale formats as English. */
export const intlLocale = (code = _locale) => (code === PSEUDO_LOCALE ? BASE_LOCALE : code);
const _numberFormats = new Map();
/** `n` formatted for the current locale (grouping and decimal separators); `options` are Intl.NumberFormat's. */
export function formatNumber(n, options = null) {
  const loc = intlLocale();
  const key = `${loc}|${options ? JSON.stringify(options) : ''}`;
  let f = _numberFormats.get(key);
  if (!f) { f = new Intl.NumberFormat(loc, options ?? undefined); _numberFormats.set(key, f); }
  return f.format(n);
}
const _pluralRules = new Map();
function pluralRules(locale, type) {
  const key = `${locale}|${type}`;
  let r = _pluralRules.get(key);
  if (!r) { r = new Intl.PluralRules(locale, { type }); _pluralRules.set(key, r); }
  return r;
}

// ─── the ICU MessageFormat subset `t` speaks ───────────────────────────────────────────────────────────────────────
// {name}                                            the argument, as a string
// {n, number}  {n, number, integer}                 Intl.NumberFormat (integer: no fraction digits)
// {n, plural, =0 {...} one {...} other {...}}       Intl.PluralRules; `#` inside a branch is n, unformatted, so an
//                                                   English pattern prints exactly what `${n}` did
// {n, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}
// {x, select, male {...} female {...} other {...}}
// Apostrophes as ICU's default (DOUBLE_OPTIONAL) mode: '' is one apostrophe, and a lone ' quotes only when it comes
// before { or } (or # inside a plural), so "don't" is plain text.
const _parsed = new Map();
/** The pattern's syntax tree, parsed once. Throws on a malformed pattern (the catalog tests call this). */
export function parseMessage(pattern) {
  const hit = _parsed.get(pattern);
  if (hit) return hit;
  const src = String(pattern);
  let i = 0;
  const ws = () => { while (i < src.length && /\s/.test(src[i])) i++; };
  const fail = (what) => { throw new Error(`message pattern: ${what} at ${i} in "${src}"`); };
  function message(inPlural) {
    const nodes = [];
    let text = '';
    const flush = () => { if (text) { nodes.push(text); text = ''; } };
    while (i < src.length) {
      const c = src[i];
      if (c === '}') break;
      if (c === '{') { flush(); nodes.push(argument(inPlural)); continue; }
      if (c === '#' && inPlural) { flush(); nodes.push({ pound: true }); i++; continue; }
      if (c === "'") {
        const next = src[i + 1];
        if (next === "'") { text += "'"; i += 2; continue; }
        if (next === '{' || next === '}' || (inPlural && next === '#')) {
          i++;
          while (i < src.length) {
            if (src[i] === "'") { if (src[i + 1] === "'") { text += "'"; i += 2; continue; } i++; break; }
            text += src[i++];
          }
          continue;
        }
      }
      text += c; i++;
    }
    flush();
    return nodes;
  }
  function argument(inPlural) {
    i++;   // {
    ws();
    const start = i;
    while (i < src.length && !/[\s,}{]/.test(src[i])) i++;
    const name = src.slice(start, i);
    if (!name) fail('an argument without a name');
    ws();
    if (src[i] === '}') { i++; return { arg: name }; }
    if (src[i] !== ',') fail(`'${src[i] ?? 'end'}' after an argument name`);
    i++; ws();
    const ts = i;
    while (i < src.length && /[a-z]/i.test(src[i])) i++;
    const type = src.slice(ts, i);
    ws();
    if (type === 'number') {
      let style = '';
      if (src[i] === ',') { i++; ws(); const ss = i; while (i < src.length && src[i] !== '}') i++; style = src.slice(ss, i).trim(); }
      if (src[i] !== '}') fail('an unclosed number argument');
      i++;
      return { arg: name, type, style };
    }
    if (type !== 'plural' && type !== 'selectordinal' && type !== 'select') fail(`an unknown argument type '${type}'`);
    if (src[i] !== ',') fail(`no options for a ${type} argument`);
    i++; ws();
    let offset = 0;
    if (type !== 'select' && src.startsWith('offset:', i)) {
      i += 7; ws();
      const os = i; while (i < src.length && /[0-9]/.test(src[i])) i++;
      offset = Number(src.slice(os, i)); ws();
    }
    const options = new Map();
    while (i < src.length && src[i] !== '}') {
      const ks = i;
      while (i < src.length && !/[\s{}]/.test(src[i])) i++;
      const sel = src.slice(ks, i);
      if (!sel) fail('an option without a selector');
      ws();
      if (src[i] !== '{') fail(`option '${sel}' without a message`);
      i++;
      const branch = message(type === 'select' ? inPlural : true);
      if (src[i] !== '}') fail(`option '${sel}' unclosed`);
      i++; ws();
      options.set(sel, branch);
    }
    if (src[i] !== '}') fail(`an unclosed ${type} argument`);
    i++;
    if (!options.has('other')) fail(`a ${type} argument without an 'other' option`);
    return { arg: name, type, offset, options };
  }
  const tree = message(false);
  if (i < src.length) fail("an unmatched '}'");
  _parsed.set(pattern, tree);
  return tree;
}

/** `pattern` with `args` in place, for `locale` (Intl's tag). `pseudo` pseudo-localizes the literal text and leaves
 *  every argument's value alone. A malformed pattern is answered as it stands - text is never worth a crash. */
export function formatMessage(pattern, args = null, { locale = BASE_LOCALE, pseudo = false } = {}) {
  let tree;
  try { tree = parseMessage(pattern); } catch (err) {
    console.error(`[text] ${err?.message ?? err}`);
    return String(pattern);
  }
  const lit = pseudo ? pseudoBody : (s) => s;
  const out = (nodes, pound) => {
    let s = '';
    for (const node of nodes) {
      if (typeof node === 'string') { s += lit(node); continue; }
      if (node.pound) { s += pound ?? '#'; continue; }
      const value = args?.[node.arg];
      if (!node.type) { s += value === undefined ? `{${node.arg}}` : String(value); continue; }
      if (node.type === 'number') {
        s += Number.isFinite(Number(value)) ? formatNumber(Number(value), node.style === 'integer' ? { maximumFractionDigits: 0 } : null) : String(value);
        continue;
      }
      if (node.type === 'select') { s += out(node.options.get(String(value)) ?? node.options.get('other'), pound); continue; }
      const n = Number(value);
      const exact = node.options.get(`=${n}`);
      const shown = n - node.offset;
      if (exact) { s += out(exact, String(shown)); continue; }
      const cat = Number.isFinite(shown) ? pluralRules(locale, node.type === 'selectordinal' ? 'ordinal' : 'cardinal').select(shown) : 'other';
      s += out(node.options.get(cat) ?? node.options.get('other'), String(shown));
    }
    return s;
  };
  const s = out(tree, null);
  return pseudo && s ? `[${s}]` : s;   // one bracket round the whole message, not one per literal
}

// ─── the pseudo-locale ─────────────────────────────────────────────────────────────────────────────────────────────
// Spans that must reach the game whole: DFU's %macros, {0} placeholders, [/markup], a quest's _symbol_ / =symbol_ /
// __symbol_ forms, <ce> and the other classic angle codes, and HTML entities.
const PSEUDO_KEEP = /%[A-Za-z][A-Za-z0-9]*|\{\d+\}|\[\/[^\]]*\]|={0,2}#?_{0,4}[A-Za-z][A-Za-z0-9.]*_(?=\W|$)|<[^>\s]{1,8}>|&[a-z]+;|&#\d+;/g;
const PSEUDO_MAP = {
  a: 'å', b: 'ƀ', c: 'ç', d: 'ð', e: 'é', f: 'ƒ', g: 'ĝ', h: 'ĥ', i: 'î', j: 'ĵ', k: 'ķ', l: 'ļ', m: 'ɱ', n: 'ñ', o: 'ö', p: 'þ',
  q: 'ǫ', r: 'ŕ', s: 'š', t: 'ţ', u: 'û', v: 'ṽ', w: 'ŵ', x: 'ẋ', y: 'ý', z: 'ž',
  A: 'Å', B: 'Ɓ', C: 'Ç', D: 'Ð', E: 'É', F: 'Ƒ', G: 'Ĝ', H: 'Ĥ', I: 'Î', J: 'Ĵ', K: 'Ķ', L: 'Ļ', M: 'Ṁ', N: 'Ñ', O: 'Ö', P: 'Þ',
  Q: 'Ǫ', R: 'Ŕ', S: 'Š', T: 'Ţ', U: 'Û', V: 'Ṽ', W: 'Ŵ', X: 'Ẋ', Y: 'Ý', Z: 'Ž',
};
const pseudoRun = (s) => s.replace(/[A-Za-z]/g, (ch) => (/[aeiouAEIOU]/.test(ch) ? PSEUDO_MAP[ch] + PSEUDO_MAP[ch] : PSEUDO_MAP[ch]));
/** The pseudo transform without the brackets: every Latin letter accented, every vowel doubled (about a third
 *  longer - room a translation will need); the spans PSEUDO_KEEP names pass untouched. */
function pseudoBody(text) {
  const s = String(text ?? '');
  let out = '', last = 0;
  for (const m of s.matchAll(PSEUDO_KEEP)) { out += pseudoRun(s.slice(last, m.index)) + m[0]; last = m.index + m[0].length; }
  return out + pseudoRun(s.slice(last));
}
/** `text` pseudo-localized and bracketed, so a clipped end shows. Empty stays empty. */
export function pseudoLocalize(text) {
  const s = String(text ?? '');
  return s ? `[${pseudoBody(s)}]` : s;
}

/** Tests only: every locale, table, font, listener and cache back to the start. */
export function _resetTextManagerForTests() {
  _tables.clear(); _infos.clear(); _listCache.clear(); _listeners.clear(); _fonts.clear(); _parsed.clear();
  _runtime.clear(); for (const [k, v] of Object.entries(DEFAULT_COLLECTION_NAMES)) _runtime.set(k, v);
  _locale = BASE_LOCALE; _forceSdf = null; _docs.clear(); _revision = 0;
  GrammarManager.grammarProcessor = DEFAULT_GRAMMAR; GrammarManager.heroGender = null; GrammarManager.npcGender = null;
}
