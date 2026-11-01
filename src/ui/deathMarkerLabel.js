// A persistent opaque symbol; only its caption depends on crosshair proximity.
export function deathLabelFocused(point, rect, radiusPercent = 6) {
  if (!point || point.edge || !(rect?.height > 0) || !(rect.width > 0)) return false;
  const radius = rect.height * Math.max(2, Math.min(15, radiusPercent)) / 100;
  return Math.hypot(point.x - (rect.left + rect.width / 2), point.y - (rect.top + rect.height / 2)) <= radius;
}

export function createDeathMarkerLabel(doc = document) {
  const root = doc.createElement('div'), caption = doc.createElement('div');
  root.dataset.deathBeacon = '';
  root.style.cssText = 'position:fixed;pointer-events:none;z-index:12;transform:translate(-50%,-50%);text-align:center;opacity:1;';
  const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = 'display:block;opacity:1;filter:drop-shadow(0 1px 1px #000);';
  const skull = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
  skull.setAttribute('d', 'M7 2H17L21 6V14L17 17V22H7V17L3 14V6ZM6 8V12H10V8ZM14 8V12H18V8ZM12 13L10 16H14Z');
  skull.setAttribute('fill', 'currentColor'); skull.setAttribute('fill-rule', 'evenodd');
  skull.setAttribute('stroke', '#16191b'); skull.setAttribute('stroke-width', '1');
  svg.append(skull);
  caption.dataset.deathCaption = '';
  caption.style.cssText = 'position:absolute;top:100%;left:50%;transform:translateX(-50%);width:max-content;max-width:240px;font:500 13px/18px system-ui,sans-serif;color:#e6e0d2;text-shadow:1px 1px 0 #000,-1px -1px 0 #000;padding-top:3px;';
  root.append(svg, caption); doc.body.append(root);
  const cached = new Map();
  const changed = (key, value, write) => { if (cached.get(key) === value) return; cached.set(key, value); write(value); };
  return {
    sync(point, { name, metres, color, size, showLabel, labelOpacity }) {
      root.hidden = false;
      changed('x', `${Math.round(point.x*(globalThis.devicePixelRatio||1))/(globalThis.devicePixelRatio||1)}px`, value => { root.style.left = value; });
      changed('y', `${Math.round(point.y*(globalThis.devicePixelRatio||1))/(globalThis.devicePixelRatio||1)}px`, value => { root.style.top = value; });
      changed('color', color, value => { root.style.color = value; });
      changed('size', String(size), value => { svg.setAttribute('width', value); svg.setAttribute('height', value); });
      changed('caption', `${name} · ${Math.round(metres)} m`, value => { caption.textContent = value; });
      changed('opacity', String(labelOpacity), value => { caption.style.opacity = value; });
      caption.hidden = !showLabel;
    },
    hide() { root.hidden = true; },
    dispose() { root.remove(); cached.clear(); },
  };
}
