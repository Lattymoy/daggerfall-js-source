// @ts-check
// VIDEO1 — interaction menu for a painting video surface.
import { videoSourceOf, videoCapabilitiesOf } from '../net/videoSurfaceLaw.js';

/** @param {{ doc?: Document, mapId: number, buildingKey: number, pieceId: string, character: string, state: any, canControl: boolean, onCmd: (body: object) => Promise<any>, onMute: (mute: boolean) => void, onClose: () => void, say?: (t: string) => void }} opts */
export function openVideoSurfaceWindow(opts) {
  const doc = opts.doc ?? (typeof document !== 'undefined' ? document : null);
  if (!doc) return null;
  let state = opts.state;
  const root = doc.createElement('div');
  root.className = 'df-video-win';
  root.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:50;min-width:280px;max-width:420px;background:#1a1520;color:#e8e0d0;border:1px solid #6a5a40;padding:12px;font:14px/1.35 sans-serif;';
  const title = doc.createElement('div');
  title.textContent = 'Television';
  title.style.cssText = 'font-weight:bold;margin-bottom:8px;';
  root.appendChild(title);

  const status = doc.createElement('div');
  status.style.cssText = 'margin-bottom:8px;opacity:0.85;';
  const paint = () => {
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
    b.addEventListener('click', () => { void fn(b); });
    row.appendChild(b);
    return b;
  };

  const base = () => ({
    mapId: opts.mapId, buildingKey: opts.buildingKey, id: opts.pieceId,
    character: opts.character, rev: state?.revision ?? 0,
  });

  const run = async (body) => {
    const r = await opts.onCmd({ ...base(), ...body });
    if (r?.error) opts.say?.(String(r.error));
    if (r?.surface) state = r.surface;
    if (r?.ok && body.op === 'clear') state = null;
    paint();
    return r;
  };

  if (opts.canControl) {
    btn('Set URL', async () => {
      if (!videoSourceOf(url.value)) { opts.say?.('Unsupported URL.'); return; }
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
  btn('Close', () => close());

  const onKey = (e) => { if (e.key === 'Escape') close(); };
  doc.addEventListener('keydown', onKey);
  doc.body.appendChild(root);

  function close() {
    doc.removeEventListener('keydown', onKey);
    root.remove();
    opts.onClose();
  }

  return { close, root };
}
