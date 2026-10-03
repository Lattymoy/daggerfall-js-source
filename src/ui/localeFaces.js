// L10N2 (2026-09-27): THE CLASSIC SCREENS DRAW ANY SCRIPT. Daggerfall's five FNT fonts hold printable ASCII, and DFU
// draws them through Encoding.ASCII (ui/text.js asciiFold), so a translation's letters reach the classic windows as
// question marks. DFU's answer is the localized font: a translation registers a face for each of the five fonts
// (TextManager.RegisterLocalizedFont, which forces GUI/SDFFontRendering on), and DaggerfallUI.GetFont hands that face
// out ahead of every other for as long as its locale is the one selected. This registers the port's own: for every
// language but English, a face over the system's fonts for its script, so no font file is bundled and no request is
// made. A face a DFU pack registered for the same font and locale (L10N3b) is never replaced - the pack's own letters
// win. English registers nothing and keeps Daggerfall's pixel fonts, byte for byte.

import { registerLocalizedFont, hasLocalizedFont, setSdfForcer, localeInfo, BASE_LOCALE, PSEUDO_LOCALE } from '../systems/textManager.js';
import { setValue } from '../systems/settings.js';
import { catalogLocale } from '../systems/localeCatalog.js';
import { createGlyphFace, canRasterise } from './glyphFace.js';

/** DaggerfallFont.FontName: the five classic fonts a locale's face stands in for. */
export const CLASSIC_FONT_NAMES = Object.freeze(['FONT0000', 'FONT0001', 'FONT0002', 'FONT0003', 'FONT0004']);

// The system's fonts for each script, most particular first and a generic family last, so every platform finds one.
// Han is read three ways - the same code point is drawn differently in Japan, the mainland and Taiwan - so each of
// those languages names its own region's fonts first.
const LATIN = ['"Segoe UI"', '"Noto Sans"', 'Roboto', '"Helvetica Neue"', 'Arial', '"DejaVu Sans"', 'sans-serif'];
export const FACE_FAMILIES = Object.freeze({
  latin: LATIN,
  cyrillic: LATIN,
  greek: LATIN,
  ja: ['"Hiragino Sans"', '"Hiragino Kaku Gothic ProN"', '"Yu Gothic UI"', '"Yu Gothic"', 'Meiryo', '"Noto Sans CJK JP"', '"Noto Sans JP"', 'sans-serif'],
  'zh-Hans': ['"PingFang SC"', '"Microsoft YaHei UI"', '"Microsoft YaHei"', '"Noto Sans CJK SC"', '"Noto Sans SC"', '"Source Han Sans SC"', 'sans-serif'],
  'zh-Hant': ['"PingFang TC"', '"Microsoft JhengHei UI"', '"Microsoft JhengHei"', '"Noto Sans CJK TC"', '"Noto Sans TC"', '"Source Han Sans TC"', 'sans-serif'],
  hangul: ['"Apple SD Gothic Neo"', '"Malgun Gothic"', '"Noto Sans CJK KR"', '"Noto Sans KR"', '"Source Han Sans K"', 'sans-serif'],
});

/** The CSS family list a locale's face draws with: its own (Han's three) or its script's - as the text core was told
 *  it, else as the catalog knows it - and Latin's when neither is known. */
export function faceFamilyFor(code) {
  const list = FACE_FAMILIES[code] ?? FACE_FAMILIES[localeInfo(code)?.script ?? catalogLocale(code)?.script] ?? LATIN;
  return list.join(', ');
}

/** DFU's `DaggerfallUnity.Settings.SDFFontRendering = true` at RegisterLocalizedFont's tail (TextManager.cs:125): the
 *  setting in memory, as DFU's is - the file keeps the player's own until a settings save writes it. */
const forceSdf = () => setValue('GUI', 'SDFFontRendering', true);

const _faces = new Map();   // locale -> its face
/** The port's faces for `code`'s five fonts, registered once. English registers none; a font a pack already
 *  registered for `code` is left to the pack. Answers whether the locale has a port face (false where nothing can
 *  rasterise - bare node - or for English). */
export function installLocaleFaces(code, { createFace = createGlyphFace, canDraw = canRasterise } = {}) {
  if (!code || code === BASE_LOCALE || !canDraw()) return false;
  setSdfForcer(forceSdf);
  let face = _faces.get(code);
  if (!face) {
    face = createFace(faceFamilyFor(code), { name: `locale-${code}`, lang: code === PSEUDO_LOCALE ? BASE_LOCALE : code, weight: 500 });
    _faces.set(code, face);
  }
  for (const n of CLASSIC_FONT_NAMES) if (!hasLocalizedFont(n, code)) registerLocalizedFont(code, n, face);
  return true;
}

/** Tests: forget the faces made. */
export function _resetLocaleFacesForTests() { _faces.clear(); }
