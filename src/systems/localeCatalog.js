// L10N1b (2026-09-27, Mac: "for as many languages as we possibly can and do this right"). THE LANGUAGES THE PORT
// OFFERS: each one's BCP 47 tag, its name in its own language and in English, the script it is written in, and where
// its words come from. A language is offered when the build holds its text (`locales/<tag>/`, scenes/localeData.js);
// until a human translation is bundled or installed, the port's own strings in it are Claude's drafts, and the picker
// says so (Mac: "AI drafts, labeled"). English is the port's own and lives in the code. The right-to-left and complex
// scripts (Arabic, Hebrew, Persian, Thai, the Indic scripts) wait for L10N7's shaping; Chinese is tagged by script,
// not by region, because the script is what a reader reads. The laws here are pure - the build's files are
// scenes/localeData.js's.

/** English first, then by English name. `hidden` keeps a locale out of the picker (the pseudo-locale is ?lang= only). */
export const LOCALE_CATALOG = Object.freeze([
  { code: 'en', name: 'English', englishName: 'English', script: 'latin', source: 'base' },
  { code: 'bg', name: 'Български', englishName: 'Bulgarian', script: 'cyrillic' },
  { code: 'zh-Hans', name: '简体中文', englishName: 'Chinese (Simplified)', script: 'han' },
  { code: 'zh-Hant', name: '繁體中文', englishName: 'Chinese (Traditional)', script: 'han' },
  { code: 'cs', name: 'Čeština', englishName: 'Czech', script: 'latin' },
  { code: 'da', name: 'Dansk', englishName: 'Danish', script: 'latin' },
  { code: 'nl', name: 'Nederlands', englishName: 'Dutch', script: 'latin' },
  { code: 'fi', name: 'Suomi', englishName: 'Finnish', script: 'latin' },
  { code: 'fr', name: 'Français', englishName: 'French', script: 'latin' },
  { code: 'de', name: 'Deutsch', englishName: 'German', script: 'latin' },
  { code: 'el', name: 'Ελληνικά', englishName: 'Greek', script: 'greek' },
  { code: 'hu', name: 'Magyar', englishName: 'Hungarian', script: 'latin' },
  { code: 'id', name: 'Bahasa Indonesia', englishName: 'Indonesian', script: 'latin' },
  { code: 'it', name: 'Italiano', englishName: 'Italian', script: 'latin' },
  { code: 'ja', name: '日本語', englishName: 'Japanese', script: 'han' },
  { code: 'ko', name: '한국어', englishName: 'Korean', script: 'hangul' },
  { code: 'nb', name: 'Norsk bokmål', englishName: 'Norwegian', script: 'latin' },
  { code: 'pl', name: 'Polski', englishName: 'Polish', script: 'latin' },
  { code: 'pt-BR', name: 'Português (Brasil)', englishName: 'Portuguese (Brazil)', script: 'latin' },
  { code: 'ro', name: 'Română', englishName: 'Romanian', script: 'latin' },
  { code: 'ru', name: 'Русский', englishName: 'Russian', script: 'cyrillic' },
  { code: 'es', name: 'Español', englishName: 'Spanish', script: 'latin' },
  { code: 'sv', name: 'Svenska', englishName: 'Swedish', script: 'latin' },
  { code: 'tr', name: 'Türkçe', englishName: 'Turkish', script: 'latin' },
  { code: 'uk', name: 'Українська', englishName: 'Ukrainian', script: 'cyrillic' },
  { code: 'vi', name: 'Tiếng Việt', englishName: 'Vietnamese', script: 'latin' },
  { code: 'qps-ploc', name: 'Pseudo', englishName: 'Pseudo-locale (testing)', script: 'latin', source: 'pseudo', hidden: true },
].map((l) => Object.freeze({ dir: 'ltr', source: 'machine', ...l })));

const BY_CODE = new Map(LOCALE_CATALOG.map((l) => [l.code, l]));
/** The catalog's entry for `code`, or null. */
export const catalogLocale = (code) => BY_CODE.get(code) ?? null;

/** A build path's locale file: `.../locales/<tag>/<table>.csv` -> { code, table }; anything else null. */
export function localeFileOf(path) {
  const m = /(?:^|\/)locales\/([A-Za-z0-9-]+)\/([A-Za-z0-9_]+)\.csv$/.exec(String(path ?? ''));
  return m ? { code: m[1], table: m[2] } : null;
}

/** The locale to run: `wanted` when the catalog knows it and `has(code)` says its text is present, else English. */
export function resolveLocale(wanted, has = () => true) {
  const code = String(wanted ?? '');
  return BY_CODE.has(code) && has(code) ? code : 'en';
}

// The tags a browser may send, folded onto the catalog's: Chinese by the script a region writes, Norwegian's three
// tags onto Bokmål.
const CHINESE_TRADITIONAL_REGIONS = new Set(['TW', 'HK', 'MO']);
function catalogTagFor(tag) {
  const parts = String(tag ?? '').split(/[-_]/);
  const lang = parts[0].toLowerCase();
  if (lang === 'zh') {
    if (parts.some((p) => p.toLowerCase() === 'hant') || CHINESE_TRADITIONAL_REGIONS.has(parts[1]?.toUpperCase())) return 'zh-Hant';
    return 'zh-Hans';
  }
  if (lang === 'no' || lang === 'nn') return 'nb';
  return null;
}

/** The catalog language the browser's own list asks for, among those `has` offers: for each of `languages` in turn,
 *  its exact tag, then the tag the Chinese and Norwegian folds give it, then its language alone (pt-PT finds pt-BR,
 *  fr-CA finds fr). English and the pseudo-locale are never offered - English is where the port already stands. */
export function localeForBrowser(languages, has = () => true) {
  const ok = (code) => !!code && code !== 'en' && !catalogLocale(code)?.hidden && BY_CODE.has(code) && has(code);
  for (const tag of languages ?? []) {
    const raw = String(tag ?? '');
    if (!raw) continue;
    const lang = raw.split(/[-_]/)[0].toLowerCase();
    if (lang === 'en') return null;   // the player reads English first: nothing to offer
    const exact = LOCALE_CATALOG.find((l) => l.code.toLowerCase() === raw.toLowerCase())?.code;
    if (ok(exact)) return exact;
    const folded = catalogTagFor(raw);
    if (ok(folded)) return folded;
    const byLang = LOCALE_CATALOG.find((l) => l.code.split('-')[0].toLowerCase() === lang)?.code;
    if (ok(byLang)) return byLang;
  }
  return null;
}
