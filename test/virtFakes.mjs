// VIRT's picture fakes (moved here from test/systems/virt_pack.test.js for TRADE-VIRT, whose pins drive the same chain):
// a canvas that carries a picture's opacity and says its size in its data URL, an Image that reads the size back -
// enough for requestIcon's whole chain and the fitted door's (ui/textureCanvas.js) - and a settle over the timers.

/** A canvas that carries a picture's opacity and says its size in its data URL - `pad()` characters longer, for a
 *  picture's weight. */
export const makeCanvas = (pad = () => 0) => {
  const c = { width: 0, height: 0, alpha: null };
  const ctx = {
    imageSmoothingEnabled: true, imageSmoothingQuality: 'low',
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    putImageData(img) { c.alpha = (x, y) => img.data[(y * img.width + x) * 4 + 3]; },
    getImageData(x0, y0, w, h) {
      const data = new Uint8ClampedArray(w * h * 4);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data[(y * w + x) * 4 + 3] = c.alpha?.(x0 + x, y0 + y) ?? 0;
      return { data };
    },
    drawImage(from) { if (from.alpha) c.alpha = from.alpha; },
  };
  c.getContext = () => ctx;
  c.toDataURL = () => `data:image/png;src-${c.width}x${c.height}${'x'.repeat(pad())}`;
  return c;
};
export class FakeImage {
  set src(u) { this.u = u; const m = /src-(\d+)x(\d+)/.exec(u); this.naturalWidth = Number(m?.[1] ?? 0); this.naturalHeight = Number(m?.[2] ?? 0); this.alpha = () => 255; }
  get src() { return this.u; }
  decode() { return Promise.resolve(); }
}
export const settle = async () => { for (let i = 0; i < 30; i++) await new Promise((r) => setTimeout(r, 0)); };
/** A fake document's canvases made by `makeCanvas`; answers the Image to install beside them. */
export function canvases(dom) {
  const mk0 = dom.doc.createElement;
  dom.doc.createElement = (t) => (t === 'canvas' ? makeCanvas() : mk0(t));
  return FakeImage;
}
