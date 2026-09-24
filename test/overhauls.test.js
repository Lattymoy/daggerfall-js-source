// OVH1-OVH3 (2026-09-24, Mac: "A new option on the main menu that opens to show 3 large panels ... 1. Texture
// Overhaul 2. Sound Overhaul 3. UI Overhaul ... These overhauls need to adapt to online with ease ... Our first
// overhaul option will be the file attached" - GrimoireUI 1.2 - and then "Currently there are no texture packs, it
// should be empty").
//
// Driven through the real registry, the real shelf, the real pack index off the vendored listing, the real texture
// door and the real text layout; the browser half (the three cards, browse vs wear, the reload) is
// tools/overhaulsProbe.mjs.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { OVERHAUL_PANELS, SOUND_ROWS, currentOption, uiChoiceUrl } from '../src/systems/overhauls.js';
import { UI_PACKS, activeUiPack, packIndex, packImgUrl, packCifRciUrl, packColourUrl, packFontUrl, _setPackFetchForTests } from '../src/systems/uiPack.js';
import { getPref, setPref, _resetForTests } from '../src/systems/uiPrefs.js';
import { modSetting, setModSetting } from '../src/systems/modSettings.js';
import { packTexture, _setPackDecodeForTests } from '../src/ui/packArt.js';
import { loadImg } from '../src/ui/nativePanel.js';
import { measureText, drawText, SDF_POINT_SIZE } from '../src/ui/text.js';
import { Renderer } from '../src/render/renderer.js';
import { playerTradeReady } from '../src/ui/playerTradeDoor.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const manifest = JSON.parse(rd('vendor/grimoire-ui/grimoire-ui.files.json'));
beforeEach(() => _resetForTests());

test('OVH1: three panels, Texture, Sound and UI in that order; Texture stands EMPTY until a texture pack ships (OVH1b); Sound is Classic and Enhanced; UI is Classic, Enhanced and GrimoireUI (mutants: a texture look back on the panel; a panel dropped)', () => {
  assert.deepEqual(OVERHAUL_PANELS.map((p) => p.id), ['texture', 'sound', 'ui']);
  assert.deepEqual(OVERHAUL_PANELS.map((p) => p.title), ['Texture Overhaul', 'Sound Overhaul', 'UI Overhaul']);
  const [tex, snd, ui] = OVERHAUL_PANELS;
  assert.equal(tex.options.length, 0, 'no texture pack ships - the panel holds nothing');
  assert.equal(tex.empty, 'No texture packs yet.');
  assert.equal(currentOption(tex), null);
  assert.deepEqual(snd.options.map((o) => o.id), ['classic', 'enhanced']);
  assert.deepEqual(ui.options.map((o) => o.name), ['Classic', 'Enhanced', 'GrimoireUI']);
  assert.match(ui.options[2].by, /LordSquacquerone, version 1\.2/, 'the pack wears its author and version');
});

test('OVH1: a Sound look reads and writes the SAME Features rows its tiles do - Classic turns both off, Enhanced both on, and a mix made on Features reads Custom, never a look (mutants: the preset writing one row; Custom read as a look)', () => {
  const snd = OVERHAUL_PANELS[1];
  assert.deepEqual([...SOUND_ROWS], ['enhanced-sounds', 'mod-immersive-footsteps']);
  assert.equal(currentOption(snd).id, 'enhanced', 'a fresh shelf: the shipped defaults are the Enhanced look');
  assert.deepEqual(snd.options[0].apply(), { reload: false }, 'a sound look takes effect without a reload');
  assert.equal(getPref('soundEnhancements'), false);
  assert.equal(modSetting('immersive-footsteps', 'Enabled'), false);
  assert.equal(currentOption(snd).id, 'classic');
  setPref('soundEnhancements', true);   // the player's own mix, made on Features
  assert.equal(currentOption(snd), null, 'Custom');
  snd.options[1].apply();
  assert.equal(currentOption(snd).id, 'enhanced');
  assert.equal(modSetting('immersive-footsteps', 'Enabled'), true);
  setModSetting('immersive-footsteps', 'Enabled', true);
});

test('OVH1/OVH2: a UI look is the skin and the pack over it - wearing one lands both on the shelf and reloads; a shelf that refuses the write carries the choice on the URL instead (SKIN-CARRY\'s law); GrimoireUI is in use only on the classic skin wearing the pack (mutants: the pack set without the skin; Classic reading GrimoireUI as in use)', () => {
  const ui = OVERHAUL_PANELS[2];
  const [classic, enhanced, grim] = ui.options;
  assert.equal(currentOption(ui), enhanced, 'the default skin');
  const r = grim.apply();
  assert.equal(r.reload, true);
  assert.equal(getPref('skin'), 'classic');
  assert.equal(getPref('uiPack'), 'grimoire');
  const u = new URL(r.url);
  assert.equal(u.searchParams.get('skin'), null, 'the shelf took it - the URL carries nothing');
  assert.equal(u.searchParams.get('uipack'), null);
  assert.equal(currentOption(ui), grim);
  // a browser that refuses storage (a private window): the URL is the one carrier left, for both halves
  globalThis.localStorage = { getItem: () => null, setItem: () => { throw new Error('blocked'); } };
  try {
    const refused = new URL(uiChoiceUrl('classic', 'grimoire', 'http://x/play/'));
    assert.equal(refused.searchParams.get('skin'), 'classic');
    assert.equal(refused.searchParams.get('uipack'), 'grimoire');
  } finally { delete globalThis.localStorage; }
  assert.equal(classic.isOn(), false, 'the classic skin with the pack worn is not Classic');
  setPref('uiPack', 'none');
  assert.equal(currentOption(ui), classic);
  const back = new URL(uiChoiceUrl('enhanced', 'none', 'http://x/play/?skin=classic&uipack=grimoire&nointro'));
  assert.equal(back.searchParams.get('skin'), null, 'the old URL carriers are cleared - the shelf holds the choice now');
  assert.equal(back.searchParams.get('uipack'), null);
  assert.equal(getPref('skin'), 'enhanced');
  assert.equal(back.searchParams.get('nointro'), '', 'and the rest of the URL is left alone');
});

test('OVH2: the pack is worn only over the classic skin, never under a probe\'s ?skin override unless ?uipack asks, and the stored choice answers otherwise (mutants: the pack worn on the enhanced skin; the override door wearing the stored pack)', () => {
  assert.equal(activeUiPack(''), null, 'the enhanced skin wears no pack');
  setPref('uiPack', 'grimoire');
  assert.equal(activeUiPack(''), null, '...even with one stored');
  setPref('skin', 'classic');
  assert.equal(activeUiPack('')?.id, 'grimoire', 'the classic skin wears the stored pack');
  assert.equal(activeUiPack('?skin=classic'), null, 'a probe\'s skin override pins classic ART, whatever the player chose');
  assert.equal(activeUiPack('?skin=classic&uipack=grimoire')?.id, 'grimoire', '...unless the probe asks for the pack');
  assert.equal(activeUiPack('?uipack=none'), null);
  assert.equal(activeUiPack('?uipack=bogus')?.id, 'grimoire', 'a typo is no instruction - the stored choice stands');
});

test('OVH2: the pack\'s index is the vendored listing, and every file it names ships under public/art/grimoire-ui/ - IMG by name, BUTTONS.RCI by record with the case folded as DFU\'s Windows lookup does, the save window\'s textures by DFU\'s camelCase name, the two SDF faces by their FNT (mutants: the case fold dropped; a listed file missing)', () => {
  const g = UI_PACKS.grimoire;
  assert.equal(g.files.length, manifest.Files.length);
  assert.equal(g.author, 'LordSquacquerone');
  const idx = packIndex(g);
  assert.equal(idx.img.size, 93);
  assert.equal(idx.cifRci.size, 38, 'BUTTONS.RCI 0-37');
  assert.equal(idx.colours.size, 8);
  assert.deepEqual([...idx.fonts.keys()].sort(), ['FONT0002.FNT', 'FONT0003.FNT']);
  for (const served of [...idx.img.values(), ...idx.cifRci.values(), ...idx.colours.values(), ...idx.fonts.values()]) {
    assert.ok(existsSync(new URL(`../public/${g.dir}/${served}`, import.meta.url)), `${served} ships`);
  }
  setPref('skin', 'classic'); setPref('uiPack', 'grimoire');
  assert.match(packImgUrl('inve00i0.img', ''), /art\/grimoire-ui\/Img\/INVE00I0\.IMG\.png$/);
  assert.equal(packImgUrl('LOAD00I0.IMG', ''), null, 'a screen the pack never drew stays classic');
  assert.match(packCifRciUrl('BUTTONS.RCI', 0, 0, ''), /CifRci\/Buttons\.rci_0-0\.png$/, 'the pack ships record 0 as Buttons.rci_0-0');
  assert.match(packCifRciUrl('BUTTONS.RCI', 21, 0, ''), /CifRci\/BUTTONS\.RCI_21-0\.png$/);
  assert.match(packColourUrl('mainPanelBackgroundColor', ''), /mainpanelbackgroundcolor\.png$/);
  assert.equal(packColourUrl('savesListBackgroundColor', ''), null, 'a texture the pack does not carry: the colour alone');
  assert.match(packFontUrl('FONT0003', ''), /Fonts\/FONT0003-SDF\.ttf$/);
  assert.equal(packFontUrl('FONT0004', ''), null);
});

test('OVH2: the texture door uploads a pack picture ONCE per renderer, smooth and alpha, and a picture that does not load answers null so the classic art stands (mutants: the upload without alpha; a failed fetch thrown into the loader)', async () => {
  const ups = [];
  const renderer = { uploadTexture: (a, r, px, opts) => { ups.push({ a, r, w: px.width, opts }); return `tex:${r}`; } };
  _setPackDecodeForTests(async () => ({ width: 6, height: 3, data: new Uint8Array(72) }));
  _setPackFetchForTests(async (url) => { if (/missing/.test(url)) throw new Error('404'); return new Uint8Array(4); });
  try {
    assert.equal(await packTexture(renderer, 'http://x/a.png'), 'tex:http://x/a.png');
    assert.equal(await packTexture(renderer, 'http://x/a.png'), 'tex:http://x/a.png');
    assert.equal(ups.length, 1, 'once');
    assert.deepEqual(ups[0].opts, { smooth: true, alpha: true });
    assert.equal(await packTexture(renderer, 'http://x/missing.png'), null);
    assert.equal(await packTexture(renderer, null), null, 'no pack file, no upload');
  } finally { _setPackDecodeForTests(null); _setPackFetchForTests(null); }
});

/** A classic IMG's bytes: a 12-byte header and one fill index (the helmMask fixture's shape). */
function imgBytes(w, h, fill) {
  const b = new Uint8Array(12 + w * h);
  const v = new DataView(b.buffer);
  v.setInt16(4, w, true); v.setInt16(6, h, true); v.setUint16(10, w * h, true);
  b.fill(fill, 12);
  return b;
}

test('OVH2: THE SIZE LAW - loadImg hands the pack\'s texture under the CLASSIC w/h (ImageReader keeps imageData.size), so every sub-rect and hit rect is the classic one; a screen the pack lacks, or no pack worn, uploads the classic art (mutants: the pack\'s own size handed back; the pack asked with no pack worn)', async () => {
  const ups = [];
  const renderer = { uploadTexture: (a, r, px, opts) => { ups.push({ a, r, w: px.width, h: px.height, opts }); return `${a}:${r}`; } };
  const deps = { renderer, fetchBytes: async () => imgBytes(320, 200, 5), palette: { get: (i) => ({ r: i, g: i, b: i }) } };
  _setPackDecodeForTests(async () => ({ width: 960, height: 600, data: new Uint8Array(960 * 600 * 4) }));
  _setPackFetchForTests(async () => new Uint8Array(4));
  try {
    let img = await loadImg(deps, 'INVE00I0.IMG');
    assert.equal(img.tex, 'img:INVE00I0.IMG', 'no pack worn: the classic upload');
    setPref('skin', 'classic'); setPref('uiPack', 'grimoire');
    img = await loadImg(deps, 'INVE00I0.IMG');
    assert.match(img.tex, /^pack:.*INVE00I0\.IMG\.png$/, 'the pack\'s picture');
    assert.deepEqual([img.w, img.h], [320, 200], 'at the classic size');
    assert.equal(ups.at(-1).w, 960, 'over the pack\'s own pixels');
    img = await loadImg(deps, 'LOAD00I0.IMG');
    assert.equal(img.tex, 'img:LOAD00I0.IMG', 'a screen the pack never drew');
  } finally { _setPackDecodeForTests(null); _setPackFetchForTests(null); }
});

test('OVH2: the renderer carries a texture\'s alpha law to every draw of it - an `alpha` upload keys apart and blends at a plain drawScreenQuad call, a classic upload keeps the 1-bit cutout (mutants: the flag dropped at upload; the draw ignoring it)', () => {
  const texs = [];
  const gl = new Proxy({}, { get: (_, k) => (k === 'createTexture' ? () => { const t = { id: texs.length }; texs.push(t); return t; } : typeof k === 'string' && /^[A-Z_0-9]+$/.test(k) ? k : () => {}) });
  const r = Object.create(Renderer.prototype);
  Object.assign(r, { gl, textures: new Map(), _texGen: 0 });
  const px = { width: 1, height: 1, colors: new Uint8ClampedArray(4) };
  const a = Renderer.prototype.uploadTexture.call(r, 'pack', 'u', px, { smooth: true, alpha: true });
  const b = Renderer.prototype.uploadTexture.call(r, 'img', 'u', px);
  assert.ok(r.textures.has('pack_u#smooth#alpha') && r.textures.has('img_u'), [...r.textures.keys()].join());
  assert.equal(r._alphaArt.has(a), true);
  assert.equal(!!r._alphaArt.has(b), false);
});

test('OVH2: DFU\'s SDF arm - a font with a face measures each glyph at its advance x GlyphHeight/45 with no spacing, reads UTF-32 with \'?\' for a code the face lacks, and draws each glyph on its bearing from the baseline GlyphHeight - 2 below the label; a face-less font is the classic law untouched (mutants: the classic spacing kept; the baseline at the top)', () => {
  const g = (code, advance) => ({ code, advance, offX: 1, offY: 30, w: 20, h: 36, src: { u0: 0, v0: 0, u1: 1, v1: 1 } });
  const fnt = { fixedHeight: 9, fixedWidth: 4, glyphWidth: () => 3, sdf: { tex: 'SDF', glyphs: new Map([[65, g(65, 45)], [66, g(66, 30)], [63, g(63, 15)], [32, g(32, 10)]]) } };
  const k = 9 / SDF_POINT_SIZE;
  assert.equal(measureText(fnt, 'AB'), (45 + 30) * k);
  assert.equal(measureText(fnt, 'A€'), (45 + 15) * k, 'a code the face lacks measures as ?');
  const quads = [];
  drawText({ drawScreenQuad: (tex, dst) => quads.push({ tex, ...dst }) }, { fnt }, 'A B', 100, 50, 4);
  assert.equal(quads.length, 2, 'the space advances and draws nothing');
  assert.equal(quads[0].tex, 'SDF');
  const r = k * 4;
  assert.equal(quads[0].x, 100 + 1 * r);
  assert.equal(quads[0].y, 50 + (9 - 2) * 4 - 30 * r, 'on the classic baseline, GlyphHeight - 2 down');
  assert.equal(quads[1].x, 100 + (45 + 10) * r + 1 * r);
  delete fnt.sdf;
  assert.equal(measureText(fnt, 'AB'), 8, 'no face: the classic law, spacing included');
});

test('OVH3: the online windows are the page\'s, not the skin\'s - player trade opens on either skin wherever there is a document, and the chat, the names and the social panels mount in world.js on the same gate (mutant: player trade gated back on the enhanced skin)', () => {
  assert.equal(playerTradeReady(), false, 'node has no document');
  globalThis.document = {};
  try { assert.equal(playerTradeReady(), true, 'a document: the window, whatever UI Overhaul is worn'); } finally { delete globalThis.document; }
  const w = rd('src/scenes/world.js').replace(/\/\/[^\n]*/g, ' ');
  assert.match(w, /if \(typeof document !== 'undefined'\) chatStart\(\);/);
  assert.match(w, /if \(nameLayerWanted\(\)\) nameLayer = createNameLayer\(\{\}\);/);
});

test('OVH2 by source: the classic art doors ask the pack first - the HUD\'s own loader, chargen\'s (keeping the raw bitmap its masks read), the message box\'s buttons, the save window\'s textures and the paper doll\'s backdrop drawn under a composite made on nothing', () => {
  assert.match(rd('src/ui/hud.js'), /const packed = await packImgTexture\(renderer, name\);[^\n]*\n\s*return \{ tex: packed \?\? renderer\.uploadTexture\('img', name,/);
  assert.match(rd('src/ui/chargenArt.js'), /const packed = await packImgTexture\(deps\.renderer, name\);\s*return \{ tex: packed \?\? [^\n]*, bmp \};/);
  const mb = rd('src/ui/messageBox.js');
  assert.match(mb, /const packUrl = _packFailed\.has\(record\) \? null : packCifRciUrl\('BUTTONS\.RCI', record, 0\);/);
  assert.ok(mb.indexOf("packCifRciUrl('BUTTONS.RCI'") < mb.indexOf('const custom = _buttonArt.get(record);'), 'the pack before Roleplay & Realism\'s own 21-37');
  const sw = rd('src/ui/saveWindow.js');
  for (const n of ['mainPanelBackgroundColor', 'namePanelBackgroundColor', 'saveButtonBackgroundColor', 'cancelButtonBackgroundColor', 'switchClassicButtonBackgroundColor', 'renameSaveButtonBackgroundColor', 'deleteSaveButtonBackgroundColor', 'switchCharButtonBackgroundColor']) {
    assert.ok(sw.includes(`'${n}'`), `${n} is asked for`);
  }
  const pd = rd('src/ui/paperDoll.js');
  assert.match(pd, /const \{ out, layout, bgSize \} = await composeDoll\(_art, _deps, entity, \{ background: !packBg \}\);/);
  assert.match(pd, /if \(_live\.packBg\) \{[^\n]*\n\s*const \{ tex, w, h \} = _live\.packBg, \[sx, sy\] = BG_SUBRECT;\s*renderer\.drawScreenQuad\(tex, dst,/);
});
