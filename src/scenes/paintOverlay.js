// C6L tuner: in-browser paint overlay for the body sheets. Two 1x
// sheets (front / back, rear-view space) editable at 6x with ART_PAL
// swatches, eyedrop, erase-to-classic (alpha 0 falls through), undo,
// export/load PNG, localStorage autosave. Silhouette is the law:
// strokes outside the mask are ignored. Every stroke rebuilds the
// live character mesh via the kit's rebuild().
const Z = 6;

export function mountPaintOverlay(kit, palette) {
  const { sheets, masks, W, H, rebuild } = kit; // sheets: {front,back} ImageData
  const root = document.createElement('div');
  root.style.cssText = 'position:fixed;top:0;right:0;bottom:0;width:min(460px,95vw);background:#16161acc;color:#ddd;font:12px monospace;overflow:auto;z-index:50;padding:8px;touch-action:none';
  document.body.appendChild(root);

  let side = 'front';
  let color = { r: 200, g: 160, b: 120, a: 255 };
  const undoStack = [];

  const bar = document.createElement('div');
  bar.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px';
  root.appendChild(bar);
  const btn = (label, fn) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = 'background:#2a2a30;color:#ddd;border:1px solid #444;padding:4px 8px;font:12px monospace';
    b.onclick = fn;
    bar.appendChild(b);
    return b;
  };
  const frontBtn = btn('FRONT', () => setSide('front'));
  const backBtn = btn('BACK', () => setSide('back'));
  btn('eyedrop', () => { mode = 'drop'; status('eyedrop: tap a pixel'); });
  btn('erase', () => { color = { r: 0, g: 0, b: 0, a: 0 }; status('erase (falls through to classic)'); });
  btn('undo', () => {
    const u = undoStack.pop();
    if (!u) return;
    sheets[u.side].data.set(u.data);
    redraw(); rebuild(); save();
  });
  btn('export', () => {
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    cv.getContext('2d').putImageData(sheets[side], 0, 0);
    const a = document.createElement('a');
    a.download = `body-${side}.png`;
    a.href = cv.toDataURL('image/png');
    a.click();
  });
  const loadInput = document.createElement('input');
  loadInput.type = 'file'; loadInput.accept = 'image/png'; loadInput.style.display = 'none';
  loadInput.onchange = async () => {
    const f = loadInput.files[0];
    if (!f) return;
    const bm = await createImageBitmap(f);
    const cv = new OffscreenCanvas(W, H);
    const c2 = cv.getContext('2d');
    c2.drawImage(bm, 0, 0, W, H);
    push();
    sheets[side].data.set(c2.getImageData(0, 0, W, H).data);
    redraw(); rebuild(); save();
  };
  root.appendChild(loadInput);
  btn('load png', () => loadInput.click());
  btn('clear saved', () => { localStorage.removeItem('paint-front'); localStorage.removeItem('paint-back'); status('autosave cleared (reload for starters)'); });

  const stat = document.createElement('div');
  stat.style.cssText = 'margin:4px 0;color:#8c8';
  root.appendChild(stat);
  const status = (t) => { stat.textContent = t; };

  // ART_PAL swatches, 16x16.
  const pcv = document.createElement('canvas');
  pcv.width = 16 * 14; pcv.height = 16 * 14;
  pcv.style.cssText = 'image-rendering:pixelated;border:1px solid #444';
  const pcx = pcv.getContext('2d');
  for (let i = 0; i < 256; i++) {
    const c = palette.get(i);
    pcx.fillStyle = i === 0 ? '#111' : `rgb(${c.r},${c.g},${c.b})`;
    pcx.fillRect((i % 16) * 14, ((i / 16) | 0) * 14, 14, 14);
  }
  pcv.onpointerdown = (e) => {
    const r = pcv.getBoundingClientRect();
    const i = ((((e.clientY - r.top) / 14) | 0) * 16 + (((e.clientX - r.left) / 14) | 0)) & 255;
    const c = palette.get(i);
    color = i === 0 ? { r: 0, g: 0, b: 0, a: 0 } : { r: c.r, g: c.g, b: c.b, a: 255 };
    status(`color 0x${i.toString(16)}${i === 0 ? ' (erase)' : ''}`);
    mode = 'draw';
  };
  root.appendChild(pcv);

  // The sheet canvas.
  const cv = document.createElement('canvas');
  cv.width = W * Z; cv.height = H * Z;
  cv.style.cssText = 'image-rendering:pixelated;border:1px solid #444;display:block;margin-top:6px;cursor:crosshair';
  root.appendChild(cv);
  const cx = cv.getContext('2d');
  let mode = 'draw';

  const redraw = () => {
    const tmp = document.createElement('canvas');
    tmp.width = W; tmp.height = H;
    tmp.getContext('2d').putImageData(sheets[side], 0, 0);
    cx.imageSmoothingEnabled = false;
    cx.fillStyle = '#222';
    cx.fillRect(0, 0, cv.width, cv.height);
    cx.drawImage(tmp, 0, 0, W * Z, H * Z);
  };
  const setSide = (s) => {
    side = s;
    frontBtn.style.background = s === 'front' ? '#464' : '#2a2a30';
    backBtn.style.background = s === 'back' ? '#464' : '#2a2a30';
    redraw();
  };
  const push = () => {
    undoStack.push({ side, data: sheets[side].data.slice() });
    if (undoStack.length > 24) undoStack.shift();
  };
  const save = () => {
    for (const sd of ['front', 'back']) {
      const t = document.createElement('canvas');
      t.width = W; t.height = H;
      t.getContext('2d').putImageData(sheets[sd], 0, 0);
      try { localStorage.setItem(`paint-${sd}`, t.toDataURL('image/png')); } catch {}
    }
  };

  let drawing = false;
  const plot = (e) => {
    const r = cv.getBoundingClientRect();
    const x = ((e.clientX - r.left) / Z) | 0, y = ((e.clientY - r.top) / Z) | 0;
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    if (mode === 'drop') {
      const o = (y * W + x) * 4;
      const d = sheets[side].data;
      color = d[o + 3] > 0 ? { r: d[o], g: d[o + 1], b: d[o + 2], a: 255 } : { r: 0, g: 0, b: 0, a: 0 };
      status(`picked rgb(${color.r},${color.g},${color.b})`);
      mode = 'draw';
      return;
    }
    if (!masks[side][y * W + x]) return; // silhouette is the law
    const o = (y * W + x) * 4;
    const d = sheets[side].data;
    d[o] = color.r; d[o + 1] = color.g; d[o + 2] = color.b; d[o + 3] = color.a;
    redraw();
  };
  cv.onpointerdown = (e) => { push(); drawing = true; plot(e); cv.setPointerCapture(e.pointerId); };
  cv.onpointermove = (e) => { if (drawing) plot(e); };
  cv.onpointerup = () => { if (drawing) { drawing = false; rebuild(); save(); } };

  setSide('front');
  status('paint the sheet; the figure rebuilds on stroke end');
  window.__paintKit = { ...kit, setColor: (c) => { color = c; }, plot: (sd, x, y, c) => { setSide(sd); color = c; push(); const o = (y * W + x) * 4; const d = sheets[sd].data; if (masks[sd][y * W + x]) { d[o] = c.r; d[o + 1] = c.g; d[o + 2] = c.b; d[o + 3] = c.a; } redraw(); rebuild(); save(); } };
}
