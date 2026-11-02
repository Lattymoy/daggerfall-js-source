// Client-only presentation. No party state or network messages are changed.
export const PARTY_VISIBILITY_DEFAULTS = Object.freeze({
  outline: true, throughWalls: true, fade: true, fadeStart: 10, diamondDistance: 60,
  nearAlpha: 0.9, farAlpha: 0.2, width: 2, color: '#66e5a0', diamonds: true,
  offscreen: true, size: 14, markerAlpha: 0.9, names: true, distance: true,
  elevation: true, approximate: true, maxDistance: 0, entrances: true, entranceMap: true,
  brightDiamonds: true, distanceFocus: true, idleDistanceAlpha: 0.18, focusRadius: 96,
  leaderTrail: false, trailAlpha: 0.25,
});

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export function partyVisibilityOptions(raw = {}) {
  const out = { ...PARTY_VISIBILITY_DEFAULTS };
  if (!raw || typeof raw !== 'object') return out;
  for (const k of Object.keys(out)) if (typeof out[k] === 'boolean' && typeof raw[k] === 'boolean') out[k] = raw[k];
  for (const [k, lo, hi] of [['fadeStart', 0, 299], ['diamondDistance', 5, 300], ['nearAlpha', 0, 1],
    ['farAlpha', 0, 1], ['width', 1, 6], ['size', 8, 32], ['markerAlpha', 0, 1], ['maxDistance', 0, 10000],
    ['idleDistanceAlpha', 0, 1], ['focusRadius', 24, 240], ['trailAlpha', 0.05, 0.8]]) {
    if (typeof raw[k] === 'number' && Number.isFinite(raw[k])) out[k] = clamp(raw[k], lo, hi);
  }
  out.fadeStart = Math.min(out.fadeStart, out.diamondDistance - 1);
  if (typeof raw.color === 'string' && /^#[0-9a-f]{6}$/i.test(raw.color)) out.color = raw.color;
  return out;
}

const smooth = (v) => {
  const t = clamp(v, 0, 1);
   return t * t * (3 - 2 * t);
   };
// CSS pixels in the actual world viewport, including classic HUD letterboxing.
export function partyDistanceAlpha(marker, rect, options) {
  const o = partyVisibilityOptions(options);
  if (!o.distanceFocus) return 1;
  if (marker?.edge || !(rect?.width > 0 && rect?.height > 0)) return o.idleDistanceAlpha;
  const d = Math.hypot(marker.x - rect.left - rect.width / 2, marker.y - rect.top - rect.height / 2);
  if (!Number.isFinite(d)) return o.idleDistanceAlpha;
  const focus = 1 - smooth((d - o.focusRadius / 3) / (o.focusRadius * 2 / 3));
  return o.idleDistanceAlpha + (1 - o.idleDistanceAlpha) * focus;
}
export function partyVisibilityAlpha(d, options) {
  const o = partyVisibilityOptions(options);
  if (!Number.isFinite(d) || d < 0 || (o.maxDistance > 0 && d > o.maxDistance)) return { outline: 0, marker: 0 };
  const t = o.fade ? smooth((d - o.fadeStart) / (o.diamondDistance - o.fadeStart)) : 0;
  const cross = o.diamonds ? smooth((d - o.diamondDistance + 2) / 4) : 0;
  return { outline: o.outline ? (o.nearAlpha + (o.farAlpha - o.nearAlpha) * t) * (1 - cross) : 0,
    marker: o.diamonds ? o.markerAlpha * (o.outline ? cross : 1) : 0 };
}

const point = (v) => v?.length >= 3 && [v[0], v[1], v[2]].every(Number.isFinite);

export function partyPlaceLabel(p, here, regionAt) {
  if (!p) return '';
  let region = '', localRegion = '';
  try {
    if (Number.isInteger(p.px) && Number.isInteger(p.py)) region = regionAt?.(p.px, p.py) || '';
    if (here) localRegion = regionAt?.(here.x, here.y) || '';
  } catch { /* Missing map data is not a location claim. */ }
  if (region && localRegion && region !== localRegion) return region;
  const place = typeof p.loc === 'string' ? p.loc.trim() : '';
  if (place) return p.in === 1 && place !== 'Dungeon' ? `Dungeon · ${place}` : p.in === 2 ? `Inside · ${place}` : place;
  return region || (p.in === 1 ? 'Dungeon' : p.in === 2 ? 'Indoors' : 'Location approximate');
}

// A marker keeps its account identity even when its position is only a map pixel.
export function partyVisibilityMembers({ others = [], bodies = [], hidden = () => false,
  fresh = () => true, fromWorld = null, pixelCentre = null, here = null, regionAt = null } = {}) {
  const out = [];
  for (const member of others) {
    if (member.online === false || !member.acct) continue;
    const body = bodies.find((b) => b.acct === member.acct && !hidden(b.id) && fresh(b.id) && point(b.feet));
    if (body) {
      out.push({ acct: member.acct, id: body.id, name: member.name || 'Party member', at: [...body.feet], exact: true });
       continue;
       }
    if (!here || member.peers?.some(hidden) || !member.p) continue;
    const p = member.p;
    let at = null;
    if (p.in === 0 && Number.isFinite(p.wx) && Number.isFinite(p.wy) && Number.isFinite(p.wz) && fromWorld) at = fromWorld(p);
    else if (Number.isInteger(p.px) && Number.isInteger(p.py) && (p.px !== here.x || p.py !== here.y) && pixelCentre) at = pixelCentre(p.px, p.py);
    if (point(at)) out.push({ acct: member.acct, id: null, name: member.name || 'Party member', at,
      exact: false, place: partyPlaceLabel(p, here, regionAt) });
  }
  return out.slice(0, 7);
}

// Clip-space direction handles the rear hemisphere without mirroring its bearing.
export function projectPartyMarker(at, proj, view, rect, pad = 24) {
  if (!point(at) || !proj || !view || !(rect?.width > 0) || !(rect?.height > 0)) return null;
  const v = [0, 0, 0, 0], c = [0, 0, 0, 0];
  for (let i = 0; i < 4; i++) v[i] = view[i] * at[0] + view[i + 4] * at[1] + view[i + 8] * at[2] + view[i + 12];
  for (let i = 0; i < 4; i++) c[i] = proj[i] * v[0] + proj[i + 4] * v[1] + proj[i + 8] * v[2] + proj[i + 12] * v[3];
  if (!c.every(Number.isFinite)) return null;
  const front = c[3] > 0.00001;
  let dx = c[0] / Math.max(Math.abs(c[3]), 0.00001) * rect.width / 2;
  let dy = -c[1] / Math.max(Math.abs(c[3]), 0.00001) * rect.height / 2;
  const rx = Math.max(1, rect.width / 2 - pad), ry = Math.max(1, rect.height / 2 - pad);
  const edge = !front || Math.abs(dx) > rx || Math.abs(dy) > ry;
  if (edge) {
    if (Math.abs(dx) + Math.abs(dy) < 0.001) dy = ry; // Exactly behind: a stable downward turn cue.
    const scale = 1 / Math.max(Math.abs(dx) / rx, Math.abs(dy) / ry);
    dx *= scale;
       dy *= scale;
  }
  return { x: rect.left + rect.width / 2 + dx, y: rect.top + rect.height / 2 + dy, edge,
    angle: Math.atan2(dy, dx) * 180 / Math.PI };
}

// Conservative body volume, projected to bottom-origin framebuffer pixels.
// A volume crossing the near plane keeps the entire viewport to avoid clipping.
export function partyOutlineBounds(at, height, proj, view, viewport) {
  const [vx, vy, vw, vh] = viewport;
  let left = vx + vw, right = vx, bottom = vy + vh, top = vy;
  const radius = Math.max(2, height * 1.5);
  for (const x of [-radius, radius]) for (const y of [-radius, radius]) for (const z of [-radius, radius]) {
    const p = [at[0] + x, at[1] + height / 2 + y, at[2] + z], v = [], c = [];
    for (let i = 0; i < 4; i++) v[i] = view[i] * p[0] + view[i + 4] * p[1] + view[i + 8] * p[2] + view[i + 12];
    for (let i = 0; i < 4; i++) c[i] = proj[i] * v[0] + proj[i + 4] * v[1] + proj[i + 8] * v[2] + proj[i + 12] * v[3];
    if (!c.every(Number.isFinite) || c[3] <= 0.001 || c[2] <= -c[3]) return [...viewport];
    const sx = vx + (c[0] / c[3] + 1) * vw / 2, sy = vy + (c[1] / c[3] + 1) * vh / 2;
    left = Math.min(left, sx);
       right = Math.max(right, sx);
       bottom = Math.min(bottom, sy);
       top = Math.max(top, sy);
  }
  left = Math.max(vx, Math.floor(left - 8));
     right = Math.min(vx + vw, Math.ceil(right + 8));
  bottom = Math.max(vy, Math.floor(bottom - 8));
     top = Math.min(vy + vh, Math.ceil(top + 8));
  return [left, bottom, Math.max(0, right - left), Math.max(0, top - bottom)];
}
