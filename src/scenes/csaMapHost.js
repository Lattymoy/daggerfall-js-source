// HOST-SPLIT: moved verbatim out of src/scenes/world.js's bootWorld (bible/01-Overview/Host-Split.md) by tools/hostMove.mjs.
// The host constructs it where the code stood. What it reads of the host's scope comes through `host`: the
// settled names by value at construction, every live one (a `let` someone writes, a `const` made below) read at its
// use as `host.<name>` - as the code read them where it was.
import { LINE_TEXTURE as CSA_LINE_TEXTURE, TRAVEL_MAP_IMG, travelMapPicture } from '../systems/comeSailAway/comeSailAwayMap.js';
import { toScreenOrder as csaToScreenOrder } from '../formats/color32Order.js';
import { DFPalette } from '../formats/dfPalette.js';
import { drawEnhancedTextLayer } from '../ui/enhanced/enhancedTextLayer.js';
import { drawText } from '../ui/text.js';
import { fetchBytes } from './shared.js';
import { ImgFile } from '../formats/imgFile.js';
import { isEnhanced } from '../systems/uiSkin.js';

/** @param {any} host */
export function createCsaMap(host) {
  const {
    CSA_MAP_TEXT_LAYER, canvas, getTexture, renderer, townTalk
  } = host;
  /** OnGUI's two pictures, built at the map's first draw: record 3 rebuilt from the player's TRAV0I00.IMG (the
   *  port never carries it) and lineTexture, TEXTURE.000's solid record 112. */
  const _csaPics = {};   // HOST-SPLIT (BAY-LEFT-MAPS): the pictures and their loads in a holder ({ map, mapLoad, line, lineLoad }), so the draw moves out whole
  function csaMapPictures() {
    _csaPics.mapLoad ??= (async () => {
      const img = new ImgFile();
      img.load(await fetchBytes(TRAVEL_MAP_IMG), TRAVEL_MAP_IMG);
      const pal = new DFPalette();
      pal.load(await fetchBytes(img.paletteName), img.paletteName);
      _csaPics.map = renderer.uploadTexture('img', 'csa-map', csaToScreenOrder(travelMapPicture(img.getDFBitmap(0, 0), (i) => pal.get(i))));
    })().catch((e) => console.warn('[come-sail-away] the position reading\'s map did not build', e));
    _csaPics.lineLoad ??= getTexture(CSA_LINE_TEXTURE.archive).then((t) => {
      _csaPics.line = renderer.uploadTexture('img', 'csa-line', t.getColor32(t.getDFBitmap(CSA_LINE_TEXTURE.record, CSA_LINE_TEXTURE.frame), 0));
    }).catch((e) => console.warn('[come-sail-away] the position reading\'s line texture did not load', e));
    return _csaPics;
  }
  /** A draw list the runtime answers (OnGUI's): each quad its picture stretched and tinted, each text
   *  DaggerfallFont.DrawText's two passes - the shadow, then the text. */
  function csaDrawList(draws, layerId = null) {
    const pics = draws.some((d) => d.kind === 'quad') ? csaMapPictures() : null;
    const font = townTalk.font;
    const rgba = (c) => [c.r, c.g, c.b, c.a];
    // FONT3: under the enhanced skin a list that names a layer says its words in the pixel face (ui/enhanced/enhancedTextLayer.js)
    // - the pictures stay on the canvas. The debug values name none and keep the bitmap face, as F8's lines do.
    const words = layerId && isEnhanced() && typeof document !== 'undefined' ? [] : null;
    for (const d of draws) {
      if (d.kind === 'quad') {
        const tex = d.tex === 'map' ? pics?.map : pics?.line;
        if (tex) renderer.drawScreenQuad(tex, d.rect, undefined, rgba(d.color));
      } else if (words) {
        words.push({ text: d.text, x: d.x, y: d.y, cell: (font?.fnt?.fixedHeight ?? 7) * d.scale, color: rgba(d.color), shadow: rgba(d.shadow), shadowPos: d.shadowPos });
      } else if (font) {
        drawText(renderer, font, d.text, d.x + d.shadowPos[0], d.y + d.shadowPos[1], d.scale, rgba(d.shadow));
        drawText(renderer, font, d.text, d.x, d.y, d.scale, rgba(d.color));
      }
    }
    if (words) drawEnhancedTextLayer(layerId, words, canvas);
  }
  /** OnGUI's map, while the reading has it up - drawn by its window, the slot's last. */
  function csaDrawMap() {
    if (!host.csaRuntime) return;
    host.csaCall(() => {
      const draws = host.csaRuntime.mapOverlay({ screenRect: { x: 0, y: 0, width: canvas.width, height: canvas.height }, screen: [canvas.width, canvas.height], unscaledTime: performance.now() / 1000 });
      if (draws) csaDrawList(draws, CSA_MAP_TEXT_LAYER);
    });
  }
  return { _csaPics, csaDrawList, csaDrawMap };
}
