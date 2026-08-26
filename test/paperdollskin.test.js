import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSkin } from '../src/tools/paperdoll/skin.js';

class Attr {
  constructor(array, itemSize) { this.array = array; this.itemSize = itemSize; this.version = 0; }
  set needsUpdate(v) { if (v) this.version++; }
}
class FakeCanvasTexture { constructor(canvas) { this.image = canvas; this.needsUpdate = false; } }
class FakeContext {
  constructor(canvas) { this.canvas = canvas; this.image = null; this.fills = []; this.fillStyle = ''; this.imageSmoothingEnabled = false; }
  createImageData(w, h) { return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }; }
  drawImage(src) {
    if (src && src._pixels) this.image = { width: this.canvas.width, height: this.canvas.height, data: src._pixels.slice() };
  }
  getImageData(_x, _y, w, h) {
    if (this.image) return { width: w, height: h, data: this.image.data.slice() };
    return this.createImageData(w, h);
  }
  putImageData(img) { this.image = { width: img.width, height: img.height, data: img.data.slice() }; }
  fillRect(x, y, w, h) { this.fills.push({ x, y, w, h, fill: this.fillStyle }); }
}
class FakeCanvas {
  constructor() { this.width = 0; this.height = 0; this.ctx = new FakeContext(this); }
  getContext() { return this.ctx; }
}
class FakeImage {
  set src(v) {
    this._src = v;
    this.width = 10; this.height = 10;
    this._pixels = new Uint8ClampedArray(this.width * this.height * 4);
    for (let i = 0; i < this._pixels.length; i += 4) {
      this._pixels[i] = 180; this._pixels[i + 1] = 180; this._pixels[i + 2] = 180; this._pixels[i + 3] = 255;
    }
    queueMicrotask(() => this.onload && this.onload());
  }
}

const ramp = [[40, 30, 20], [120, 90, 60], [210, 170, 120]];

function fixture() {
  const nf = 2;
  const color = new Float32Array(nf * 18);
  const D = {
    P: new Array(nf * 12).fill(0),
    G: [0, 1],
    C: [120, 90, 60, 120, 90, 60],
    Ib: [128, 128],
    faceSet: null,
  };
  for (let f = 0; f < nf; f++) {
    let o = f * 18;
    for (let k = 0; k < 6; k++) {
      color[o] = D.C[f * 3] / 255;
      color[o + 1] = D.C[f * 3 + 1] / 255;
      color[o + 2] = D.C[f * 3 + 2] / 255;
      o += 3;
    }
  }
  const attrs = { color: new Attr(color, 3) };
  const geo = { getAttribute: (n) => attrs[n], setAttribute: (n, a) => { attrs[n] = a; } };
  const mat = { map: null, vertexColors: true, needsUpdate: false };
  const snapRamp = (r, i) => r[Math.max(0, Math.min(r.length - 1, Math.round((i / 255) * (r.length - 1))))];
  const setBodyRamp = (r) => {
    const a = attrs.color;
    for (let f = 0; f < nf; f++) {
      const c = snapRamp(r, D.Ib[f]); let o = f * 18;
      for (let k = 0; k < 6; k++) { a.array[o] = c[0] / 255; a.array[o + 1] = c[1] / 255; a.array[o + 2] = c[2] / 255; o += 3; }
    }
    a.needsUpdate = true;
  };
  return { D, geo, mat, attrs, snapRamp, setBodyRamp, nf };
}

function setFace(attr, f, c) {
  let o = f * 18;
  for (let k = 0; k < 6; k++) { attr.array[o] = c[0] / 255; attr.array[o + 1] = c[1] / 255; attr.array[o + 2] = c[2] / 255; o += 3; }
  attr.needsUpdate = true;
}

test('paperdoll skin composes body face colours and falls back for head deltas', async () => {
  const old = { fetch: globalThis.fetch, Image: globalThis.Image, document: globalThis.document, raf: globalThis.requestAnimationFrame };
  const raf = [];
  globalThis.requestAnimationFrame = (fn) => { raf.push(fn); return raf.length; };
  globalThis.Image = FakeImage;
  globalThis.document = { createElement: (tag) => { assert.equal(tag, 'canvas'); return new FakeCanvas(); } };
  globalThis.fetch = async (url) => ({
    ok: true,
    json: async () => url.endsWith('skin-uv.json')
      ? { n: 2, w: 10, h: 10, uv: [0.15,0.85, 0.85,0.85, 0.85,0.15, 0.15,0.15, 0,0,0,0,0,0,0,0] }
      : { body: { x: 0, y: 0, w: 10, h: 10, mode: 'face-atlas', tile: 8, pad: 1, stride: 10, columns: 1, faceCount: 1 } },
  });

  try {
    const F = fixture();
    const THREE = { BufferAttribute: Attr, CanvasTexture: FakeCanvasTexture, NearestFilter: 1 };
    const skin = createSkin({
      THREE, D: F.D, geo: F.geo, mat: F.mat, nf: F.nf, TRI: [0,1,2,0,2,3],
      RACES: ['Breton'], RACE_KEY: { Breton: 'Breton' }, snapRamp: F.snapRamp, setBodyRamp: F.setBodyRamp,
      getRaceIx: () => 0, getGender: () => 'male', onReady: () => {},
    });

    await skin.loadSkin();
    skin.setBodySkin(ramp);
    assert.ok(F.mat.map, 'skin texture mounted');
    assert.equal(F.mat.vertexColors, false);

    // A shirt recolours one BODY face. The watcher must keep the texture mounted
    // and paint only that face's isolated atlas tile instead of multiplying skin
    // colour through the garment.
    setFace(F.attrs.color, 0, [200, 40, 30]);
    assert.ok(raf.length, 'colour watcher scheduled');
    raf.shift()();
    assert.ok(F.mat.map, 'body recolour keeps exact-atlas texture');
    assert.equal(F.mat.vertexColors, false);
    assert.ok(F.mat.map.image.ctx.fills.some((x) => x.fill === 'rgb(200,40,30)' && x.w === 10 && x.h === 10));

    // A hood/closed helm changes a HEAD face. Head UVs share a wrapped cell, so
    // painting a whole cell would corrupt neighbouring skull sectors. The honest
    // fallback is the authored vertex-colour rig for that design.
    setFace(F.attrs.color, 1, [30, 50, 180]);
    raf.shift()();
    assert.equal(F.mat.map, null);
    assert.equal(F.mat.vertexColors, true);
  } finally {
    globalThis.fetch = old.fetch;
    globalThis.Image = old.Image;
    globalThis.document = old.document;
    globalThis.requestAnimationFrame = old.raf;
  }
});
