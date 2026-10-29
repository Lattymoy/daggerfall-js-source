// @ts-check
// VIDEO1 — interaction menu for a painting video surface.
// Overlay shape matches lockpickDoor: mountInterior pauses + frees the cursor.
import { videoSourceOf, videoCapabilitiesOf, videoStateOf } from '../net/videoSurfaceLaw.js';
import { registerOverlay } from './enhanced/enhancedOverlays.js';

/**
 * Open the television menu as a host overlay (done / dispose / input / draw).
 * @param {{ doc?: Document, mapId: number, buildingKey: number, pieceId: string, character: string, state: any, canControl: boolean, onCmd: (body: object) => Promise<any>, onMute: (mute: boolean) => void, onClose?: () => void, say?: (t: string) => void }} opts
 */
export function openVideoSurfaceWindow(opts) {
  const doc = opts.doc ?? (typeof document !== 'undefined' ? document : null);
  if (!doc) return null;
  let state = opts.state;
  let fired = false;
  let unregister = () => {};

  const root = doc.createElement('div');
  root.className = 'df-video-win';
  root.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:10000;min-width:280px;max-width:420px;background:#1a1520;color:#e8e0d0;border:1px solid #6a5a40;padding:12px;font:14px/1.35 sans-serif;';
  const title = doc.createElement('div');
  title.textContent = 'Television';
  title.style.cssText = 'font-weight:bold;margin-bottom:8px;';
  root.appendChild(title);

  const status = doc.createElement('div');
  status.style.cssText = 'margin-bottom:8px;opacity:0.85;';
  const paint = (note = null) => {
    if (note) { status.textContent = note; return; }
    if (!state) { status.textContent = 'No video configured.'; return; }
    status.textContent = `${state.provider} · ${state.status} · rev ${state.revision}`;
  };
  paint();
  root.appendChild(status);

  const url = doc.createElement('input');
  url.type = 'url';
  url.placeholder = 'Paste HTTPS URL';
  url.style.cssText = 'width:100%;box-sizing:border-box;margin-bottom:8px;';
  if (state?.provider === 'youtube') url.value = `https://www.youtube.com/watch?v=${state.sourceId}`;
  else if (state?.sourceId) url.value = state.sourceId;
  if (opts.canControl) root.appendChild(url);

  const row = doc.createElement('div');
  row.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;';
  root.appendChild(row);

  const btn = (label, fn) => {
    const b = doc.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.style.cssText = 'cursor:pointer;padding:4px 8px;';
    b.addEventListener('click', (e) => { e.stopPropagation(); void fn(b); });
    row.appendChild(b);
    return b;
  };

  const base = () => ({
    mapId: opts.mapId, buildingKey: opts.buildingKey, id: opts.pieceId,
    character: opts.character, rev: state?.revision ?? 0,
  });

  const run = async (body) => {
    paint('…');
    let r;
    try { r = await opts.onCmd({ ...base(), ...body }); }
    catch { paint('Request failed.'); return null; }
    if (!r || r.ok === false || r.error) {
      const err = String(r?.error ?? 'failed');
      paint(err);
      opts.say?.(err);
      return r;
    }
    if (r.surface) state = videoStateOf(r.surface) ?? r.surface;
    else if (body.op === 'clear') state = null;
    paint();
    return r;
  };

  if (opts.canControl) {
    btn('Set URL', async () => {
      if (!videoSourceOf(url.value)) { paint('Unsupported URL.'); opts.say?.('Unsupported URL.'); return; }
      await run({ op: 'source', url: url.value });
    });
    btn('Play', () => run({ op: 'play' }));
    btn('Pause', () => run({ op: 'pause' }));
    btn('Stop', () => run({ op: 'stop' }));
    const caps = videoCapabilitiesOf(state?.provider);
    if (caps?.seek) {
      btn('Seek +10s', () => run({ op: 'seek', seconds: (state?.basePositionSeconds ?? 0) + 10 }));
    }
    btn('Clear', () => run({ op: 'clear' }));
  }

  let muted = false;
  btn('Mute locally', (b) => {
    muted = !muted;
    b.textContent = muted ? 'Unmute locally' : 'Mute locally';
    opts.onMute(muted);
  });
  btn('Close', () => close(true));

  const close = (self = false) => {
    if (fired) return;
    fired = true;
    unregister();
    doc.removeEventListener('keydown', onKey, true);
    root.remove();
    opts.onClose?.();
    void self;
  };

  const onKey = (e) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    close(true);
  };
  doc.addEventListener('keydown', onKey, true);
  try { if (doc.pointerLockElement) doc.exitPointerLock?.(); } catch { /* no lock */ }
  doc.body.appendChild(root);
  unregister = registerOverlay(() => close(true));

  /** @type {any} */
  const overlay = {
    isChoiceWindow: true,
    get done() { return fired; },
    input(a) {
      if (a === 'back' || a === 'Escape') close(true);
    },
    click() {},
    wheel() {},
    hover() {},
    tick() {},
    draw() {},
    dispose() { close(false); },
    close: () => close(true),
    root,
  };
  return overlay;
}
