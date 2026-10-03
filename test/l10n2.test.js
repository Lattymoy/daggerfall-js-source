// L10N2 (2026-09-27): THE CLASSIC SCREENS DRAW ANY SCRIPT. The face that grows (ui/glyphFace.js: DFU's dynamic SDF
// asset - a glyph rasterised the first time it is asked, a control code missing and remembered, shelves that never
// overlap, a page uploaded before its first draw and again only after it grew), the localized font ahead of every
// other (ui/text.js sdfOf: DaggerfallUI.GetFont's priority) and measured and drawn by code point, English's pixel
// fonts untouched, the port's own faces for every language but English (ui/localeFaces.js) with a pack's own kept and
// the SDF setting forced on as RegisterLocalizedFont forces it, the boot installing them, and the line break that
// Chinese and Japanese need (ui/talkWindow.js wrapText) with every English line where it was.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as tm from '../src/systems/textManager.js';
import { createGlyphFace, isControlCode, FACE_POINT_SIZE } from '../src/ui/glyphFace.js';
import { measureText, drawText, sdfOf, makeFont, SDF_SHADOW_SCALE } from '../src/ui/text.js';
import { installLocaleFaces, faceFamilyFor, CLASSIC_FONT_NAMES, _resetLocaleFacesForTests } from '../src/ui/localeFaces.js';
import { wrapText } from '../src/ui/talkWindow.js';
import { getBool, setValue, _resetForTests as resetSettings } from '../src/systems/settings.js';
import * as data from '../src/scenes/localeData.js';
import { _resetForTests as resetPrefs } from '../src/systems/uiPrefs.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
beforeEach(() => { tm._resetTextManagerForTests(); _resetLocaleFacesForTests(); resetSettings(); resetPrefs(); });

/** A canvas the face can draw on under node. A code from U+2E80 up is a full em wide, anything else half of one;
 *  every glyph stands 0.8 em above its baseline and 0.2 below. fillText is recorded; getImageData is the page. */
function fakeCanvases(log = []) {
  const made = [];
  const measured = [];
  const make = (w, h) => {
    const ctx = {
      font: '', fillStyle: '', textBaseline: '',
      measureText(ch) {
        measured.push(ch);
        const em = Number(/(\d+)px/.exec(this.font)[1]);
        const width = ch.codePointAt(0) >= 0x2e80 ? em : em / 2;
        if (ch === ' ') return { width, actualBoundingBoxLeft: 0, actualBoundingBoxRight: 0, actualBoundingBoxAscent: 0, actualBoundingBoxDescent: 0 };   // ink-less, as a real canvas measures it
        return { width, actualBoundingBoxLeft: 0, actualBoundingBoxRight: width, actualBoundingBoxAscent: em * 0.8, actualBoundingBoxDescent: em * 0.2 };
      },
      fillText(ch, x, y) { log.push({ ch, x, y, page: made.indexOf(canvas) }); },
      getImageData() { return { data: new Uint8ClampedArray(w * h * 4) }; },
    };
    const canvas = { width: w, height: h, getContext: () => ctx };
    made.push(canvas);
    return canvas;
  };
  return { make, made, log, measured };
}

/** A renderer that records uploads, releases and quads. */
function recorder() {
  const r = { ups: [], rel: [], quads: [], n: 0 };
  r.uploadTexture = (a, k) => { r.ups.push(k); return `${k}@${++r.n}`; };
  r.releaseTexture = (a, k) => { r.rel.push(k); };
  r.drawScreenQuad = (tex, dst, src) => { r.quads.push({ tex, ...dst, src }); };
  return r;
}

test('L10N2 the face grows: a glyph rasterised the first time it is asked and never again, TMP metrics in point units, a control code missing and remembered, shelves that never overlap, a new row and a new page when one fills', () => {
  const { make, log } = fakeCanvases();
  const face = createGlyphFace('"Test"', { raster: 16, page: 64, makeCanvas: make, name: 't' });
  assert.equal(face.add(0x65e5), true, '日');
  assert.equal(face.add(0x65e5), true);
  assert.equal(log.length, 1, 'rasterised once');
  const g = face.glyphs.get(0x65e5);
  assert.equal(g.advance, FACE_POINT_SIZE, 'a full-width glyph advances one em: 45 point units');
  assert.equal(g.offY, 0.8 * FACE_POINT_SIZE);
  assert.equal(face.add(0x41), true);
  assert.equal(face.glyphs.get(0x41).advance, FACE_POINT_SIZE / 2);
  for (const c of [0, 9, 10, 31, 127, 0x9f]) assert.equal(face.add(c), false, `control ${c}`);
  assert.equal(face.missing.has(10), true, 'missing, and remembered');
  assert.equal(isControlCode(0xa0), false, 'a no-break space is a glyph');
  const tiny = fakeCanvases();
  const small = createGlyphFace('"Test"', { raster: 16, page: 16, makeCanvas: tiny.make });
  assert.equal(small.add(0x4e00), false, 'a glyph larger than a page cannot be added');
  const asked = tiny.measured.length;
  assert.equal(small.add(0x4e00), false);
  assert.equal(tiny.measured.length, asked, 'and is never measured again (TryAddCharacter\'s missing list)');
  // fill the page: 16px glyphs, 64px pages, 2px padding
  for (let c = 0x4e00; c < 0x4e00 + 12; c++) face.add(c);
  const boxes = [...face.glyphs.values()].filter((x) => x.page >= 0).map((x) => ({ p: x.page, ...x.src }));
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      const overlap = a.p === b.p && a.u0 < b.u1 && b.u0 < a.u1 && a.v0 < b.v1 && b.v0 < a.v1;
      assert.equal(overlap, false, `glyph boxes ${i} and ${j} overlap`);
    }
  }
  assert.ok(face.pages.length >= 2, 'a full page opens the next');
  assert.ok(boxes.every((b) => b.u1 <= 1 && b.v1 <= 1), 'every box inside its page');
  assert.ok(new Set(boxes.filter((b) => b.p === 0).map((b) => b.v0)).size >= 2, 'a full shelf opens the next row');
});

test('L10N2 the face goes up: a page uploads before its first draw, again only after it grew (its old copy released first), white where the canvas drew', () => {
  const { make } = fakeCanvases();
  const face = createGlyphFace('"Test"', { raster: 16, page: 64, makeCanvas: make, name: 'loc-x' });
  const r = recorder();
  face.add(0x41);
  assert.equal(face.flush(r), 1);
  assert.deepEqual(r.ups, ['loc-x#p0']);
  assert.equal(face.texOf(face.glyphs.get(0x41)), 'loc-x#p0@1');
  assert.equal(face.flush(r), 0, 'nothing grew, nothing goes up');
  face.add(0x42);
  assert.equal(face.flush(r), 1);
  assert.deepEqual(r.rel, ['loc-x#p0'], 'the old copy released');
  assert.equal(face.texOf(face.glyphs.get(0x41)), 'loc-x#p0@2', 'every glyph of the page reads the new copy');
  face.add(0x20);
  assert.equal(face.glyphs.get(0x20).page, -1, 'a space has no box and no page');
  assert.equal(face.texOf(face.glyphs.get(0x20)), null);
});

test('L10N2 the localized font first (DaggerfallUI.GetFont): a face registered for the current locale draws and measures every classic font it names, ahead of a UI pack\'s face; English keeps Daggerfall\'s own glyphs', () => {
  const { make } = fakeCanvases();
  const face = createGlyphFace('"Test"', { raster: 16, page: 256, makeCanvas: make, name: 'loc-ja' });
  const fnt = { fontName: 'FONT0003', fixedHeight: 9, fixedWidth: 4, glyphWidth: () => 3 };
  assert.equal(sdfOf(fnt), null, 'no face: the classic law');
  assert.equal(measureText(fnt, 'AB'), 8, 'the classic glyphs, spacing included');
  assert.equal(measureText(fnt, '日本'), 8, 'folded to ? by the classic law');
  tm.registerLocalizedFont('ja', 'FONT0003', face);
  assert.equal(sdfOf(fnt), null, 'registered for Japanese, and English stands');
  tm.setLocale('ja');
  assert.equal(sdfOf(fnt), face);
  const pack = { glyphs: new Map(), tex: 'PACK' };
  fnt.sdf = pack;
  assert.equal(sdfOf(fnt), face, 'the localized font ahead of the pack\'s');
  assert.equal(measureText(fnt, '日本語'), 3 * 9, 'three full-width glyphs, each GlyphHeight wide at 45 points an em');
  assert.equal(measureText(fnt, 'Ab'), 9, 'two half-width ones');
  assert.equal(measureText(fnt, 'A\u0007'), 9, 'a control code measures as ?');
  const r = recorder();
  drawText(r, { fnt }, '日本 A', 100, 50, 4);
  assert.deepEqual(r.ups, ['loc-ja#p0'], 'the page went up before the draw');
  assert.equal(r.quads.length, 3, 'three glyphs drawn, the space advanced');
  assert.ok(r.quads.every((q) => q.tex === 'loc-ja#p0@1'));
  const k = (9 / FACE_POINT_SIZE) * 4;
  assert.equal(r.quads[1].x - r.quads[0].x, FACE_POINT_SIZE * k, 'a full-width advance');
  assert.equal(r.quads[0].y, 50 + (9 - 2) * 4 - 0.8 * FACE_POINT_SIZE * k, 'on the classic baseline, GlyphHeight - 2 down');
  const other = { fontName: 'FONT0000', fixedHeight: 11, fixedWidth: 5, glyphWidth: () => 4 };
  assert.equal(sdfOf(other), null, 'a font the locale registered nothing for keeps its own glyphs');
  const made = { fixedHeight: 9, fixedWidth: 4, glyphWidth: () => 3, getGlyphPixels: () => new Uint8Array(256) };
  makeFont(recorder(), made, 'FONT0003');
  assert.equal(made.fontName, 'FONT0003', 'makeFont names the font as DaggerfallFont.FontName does');
  assert.equal(sdfOf(made), face, 'so every font made under the name draws the locale\'s face');
  tm.setLocale('en');
  assert.equal(sdfOf(fnt), pack, 'English: the pack\'s face again');
  delete fnt.sdf;
  assert.equal(sdfOf(fnt), null);
  assert.equal(typeof SDF_SHADOW_SCALE, 'number');
});

test('L10N2 the port\'s faces: every language but English gets one face for the five classic fonts, over its script\'s system fonts (Han by region), a pack\'s own font kept, the SDF setting forced on in memory as RegisterLocalizedFont forces it; nothing where nothing can rasterise', () => {
  const made = [];
  const createFace = (family, opts) => { const f = { family, opts, glyphs: new Map() }; made.push(f); return f; };
  assert.notEqual(faceFamilyFor('ja'), faceFamilyFor('zh-Hans'));
  assert.notEqual(faceFamilyFor('zh-Hans'), faceFamilyFor('zh-Hant'));
  assert.match(faceFamilyFor('ja'), /^"Hiragino Sans"/);
  assert.match(faceFamilyFor('zh-Hant'), /"PingFang TC"/);
  assert.match(faceFamilyFor('ko'), /"Malgun Gothic"/);
  assert.equal(faceFamilyFor('ru'), faceFamilyFor('fr'), 'Cyrillic in the Latin stack - the same fonts carry both');
  for (const code of ['ja', 'ko', 'ru', 'fr', 'zh-Hant', 'qps-ploc']) assert.match(faceFamilyFor(code), /sans-serif$/, `${code} ends in a generic family`);
  for (const l of ['bg', 'el', 'vi', 'uk']) tm.registerLocale({ code: l, script: { bg: 'cyrillic', el: 'greek', vi: 'latin', uk: 'cyrillic' }[l] });
  setValue('GUI', 'SDFFontRendering', false);
  assert.equal(getBool('GUI', 'SDFFontRendering'), false);
  assert.equal(installLocaleFaces('en', { createFace, canDraw: () => true }), false, 'English: Daggerfall\'s own fonts');
  assert.equal(installLocaleFaces('fr', { createFace, canDraw: () => false }), false, 'nothing to rasterise with');
  assert.equal(made.length, 0);
  const pack = { glyphs: new Map() };
  tm.registerLocalizedFont('fr', 'FONT0001', pack);
  assert.equal(installLocaleFaces('fr', { createFace, canDraw: () => true }), true);
  assert.equal(made.length, 1, 'one face for the five fonts');
  assert.equal(made[0].opts.lang, 'fr');
  for (const n of CLASSIC_FONT_NAMES) assert.equal(tm.getLocalizedFont(n, 'fr'), n === 'FONT0001' ? pack : made[0], n);
  assert.equal(getBool('GUI', 'SDFFontRendering'), true, 'forced on');
  installLocaleFaces('fr', { createFace, canDraw: () => true });
  assert.equal(made.length, 1, 'once');
  installLocaleFaces('qps-ploc', { createFace, canDraw: () => true });
  assert.equal(made[1].opts.lang, 'en', 'the pseudo-locale reads as English');
});

test('L10N2 the boot installs them: a switch to a language gives its fonts their face, English none', async () => {
  const { make } = fakeCanvases();
  const was = globalThis.OffscreenCanvas;
  globalThis.OffscreenCanvas = function OffscreenCanvas(w, h) { return make(w, h); };
  try {
    data._useLocaleFilesForTests({ '../../locales/fr/Port_Strings.csv': async () => rd('locales/fr/Port_Strings.csv') });
    assert.equal(await data.switchLocale('fr'), 'fr');
    const face = tm.getLocalizedFont('FONT0003');
    assert.ok(face?.add, 'French\'s face');
    assert.equal(face.add('é'.codePointAt(0)), true);
    assert.equal(await data.switchLocale('en'), 'en');
    assert.equal(tm.getLocalizedFont('FONT0003'), null, 'English: none');
  } finally {
    if (was === undefined) delete globalThis.OffscreenCanvas; else globalThis.OffscreenCanvas = was;
    data._useLocaleFilesForTests({});
  }
});

// The line break. The old law, kept here verbatim, is what English must still do.
function oldWrap(fnt, text, maxWidth, measure) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const probe = line.length ? `${line} ${w}` : w;
    if (line.length && measure(fnt, probe) > maxWidth) { lines.push(line); line = w; }
    else line = probe;
  }
  if (line.length) lines.push(line);
  return lines;
}
/** One unit a character: a full-width CJK character two, anything else one. */
const units = (_, s) => [...s].reduce((n, ch) => n + (ch.codePointAt(0) >= 0x2e80 ? 2 : 1), 0);

test('L10N2 the line break: every English line where it was; Chinese and Japanese break between characters, never before a closing mark or after an opening one; Korean at its spaces; a Latin word inside CJK text kept whole', () => {
  const english = [
    'You are in the town of Daggerfall. The guards will not let you pass without a writ from the court.',
    'a  double  spaced   line and a verylongwordthatcannotfitonanylineatallbecauseitisfartoolong here',
    '', ' leading and trailing ', 'one',
  ];
  for (const s of english) for (const w of [10, 24, 40]) assert.deepEqual(wrapText(null, s, w, units), oldWrap(null, s, w, units), `${JSON.stringify(s)} at ${w}`);
  const ja = '旅人よ、ダガーフォールの街へようこそ。「王の手紙」を届けてくれ。';
  const rows = wrapText(null, ja, 20, units);
  assert.ok(rows.length > 1);
  assert.equal(rows.join(''), ja, 'nothing lost, no space put in');
  for (const r of rows) assert.ok(units(null, r) <= 20, `${r} fits`);
  for (const r of rows.slice(1)) assert.doesNotMatch(r, /^[、。」』）]/, `${r} starts with a closing mark`);
  for (const r of rows) assert.doesNotMatch(r, /[「『（]$/, `${r} ends with an opening mark`);
  const zh = '欢迎来到丹格尔佛。国王的信必须今天送到。';
  assert.equal(wrapText(null, zh, 12, units).join(''), zh);
  assert.ok(wrapText(null, zh, 12, units).every((r) => units(null, r) <= 12));
  const ko = '대거폴 도시에 오신 것을 환영합니다';
  assert.deepEqual(wrapText(null, ko, 12, units), oldWrap(null, ko, 12, units), 'Korean breaks at its spaces');
  // the natural break would put the full stop at a line's head; kinsoku carries the character before it down with it
  assert.deepEqual(wrapText(null, 'あいうえおかきくけこ。', 20, units), ['あいうえおかきくけ', 'こ。']);
  assert.deepEqual(wrapText(null, 'あいうえおかきくけ「こ', 20, units), ['あいうえおかきくけ', '「こ'], 'an opening mark never ends a line - it goes down with what it opens');
  assert.deepEqual(wrapText(null, 'ABCDEFの世界', 5, units), ['ABCDEF', 'の世', '界'], 'a Latin word inside CJK text is never cut');
  const mixed = 'DFUの世界へようこそ';
  const mrows = wrapText(null, mixed, 8, units);
  assert.equal(mrows.join(''), mixed);
  assert.ok(mrows.some((r) => r.startsWith('DFU')), 'DFU kept whole');
});
