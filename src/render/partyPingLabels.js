// @ts-check
// PARTY-PING: the mark, who placed it, and what it names. A screen layer,
// so the pin is the same size at any distance and shows through walls.
// The words wear the vitals' face (ui/pixelifyFive.js). The pin is a map
// marker drawn here. Not a DFU member.
import { PIXEL_FONT_CSS, PIXEL_TEXT_SHADOW } from '../ui/pixelifyFive.js';

const eliteInk = (now) => {
  const k = 0.775 + 0.225 * Math.sin(now / 1000 * 3.2);
  const c = (v) => Math.round(Math.min(1, v * 2 * k) * 255);
  return `rgb(${c(0.35)}, ${c(0.75)}, ${c(1)})`;
};

/** A filled map pin, 24 units. The tip is the bottom of the view. */
const PIN = `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M12 1.2c-4.3 0-7.6 3.4-7.6 7.6 0 5.7 7.6 13.8 7.6 13.8s7.6-8.1 7.6-13.8c0-4.2-3.3-7.6-7.6-7.6zm0 10.4a2.8 2.8 0 1 1 0-5.6 2.8 2.8 0 0 1 0 5.6z"/></svg>`;

/** Metres, the way a plaque says them. */
export function pingDistanceText(metres) {
  if (!(metres >= 0)) return '';
  const n = metres < 10 ? Math.round(metres * 10) / 10 : Math.round(metres);
  return `${n} m`;
}

export function createPingLabels() {
  if (typeof document === 'undefined') return { sync() {}, dispose() {} };
  const root = document.createElement('div');
  root.setAttribute('data-party-ping', '');
  root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:12;overflow:hidden;';
  document.body.appendChild(root);
  /** @type {Map<string, HTMLDivElement>} */
  const nodes = new Map();
  return {
    /**
     * @param {ReadonlyArray<{ id: string, x: number, y: number, author?: string, name?: string, dist: string, elite?: boolean, alpha: number, color: string }>} rows
     * @param {number} now
     */
    sync(rows, now) {
      const live = new Set();
      for (const r of rows) {
        live.add(r.id);
        let node = nodes.get(r.id);
        if (!node) {
          node = document.createElement('div');
          node.style.cssText = `position:absolute;width:16px;height:16px;transform:translate(-50%,-50%);${PIXEL_FONT_CSS}text-align:center;color:#d8cfae;text-shadow:${PIXEL_TEXT_SHADOW};`;
          const author = document.createElement('div');
          author.dataset.role = 'author';
          author.style.cssText = 'position:absolute;left:50%;bottom:calc(100% + 2px);transform:translateX(-50%);white-space:nowrap;font-size:12px;line-height:1;';
          const pin = document.createElement('div');
          pin.dataset.role = 'pin';
          pin.style.cssText = 'width:16px;height:16px;filter:drop-shadow(2px 2px 0 rgba(0,0,0,0.85));';
          pin.innerHTML = PIN;
          const under = document.createElement('div');
          under.dataset.role = 'under';
          under.style.cssText = 'position:absolute;left:50%;top:calc(100% + 2px);transform:translateX(-50%);white-space:nowrap;font-size:12px;line-height:1.15;';
          node.append(author, pin, under);
          root.appendChild(node);
          nodes.set(r.id, node);
        }
        const author = /** @type {HTMLElement|null} */ (node.querySelector('[data-role="author"]'));
        const pin = /** @type {HTMLElement|null} */ (node.querySelector('[data-role="pin"]'));
        const under = /** @type {HTMLElement|null} */ (node.querySelector('[data-role="under"]'));
        if (author) {
          author.textContent = r.author || '';
          author.style.color = r.color;
          author.style.display = r.author ? '' : 'none';
        }
        if (pin) pin.style.color = r.color;
        if (under) {
          under.replaceChildren();
          if (r.name) {
            const title = document.createElement('div');
            title.textContent = r.name;
            title.style.color = r.elite ? eliteInk(now) : '#d8cfae';
            if (r.elite) title.style.textShadow = `0 0 1px ${title.style.color}, ${PIXEL_TEXT_SHADOW}`;
            under.appendChild(title);
          }
          const dist = document.createElement('div');
          dist.textContent = r.dist;
          dist.style.fontSize = '11px';
          under.appendChild(dist);
        }
        node.style.left = `${r.x}px`;
        node.style.top = `${r.y}px`;
        node.style.opacity = String(Math.max(0, Math.min(1, r.alpha)));
      }
      for (const [id, node] of nodes) if (!live.has(id)) { node.remove(); nodes.delete(id); }
    },
    dispose() { root.remove(); nodes.clear(); },
  };
}
