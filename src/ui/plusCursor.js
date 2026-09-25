// PLUS6: THE GAUNTLET CURSOR (Enhanced Plus only) - the grey gauntlet, and a second frame with the pointing finger
// drawn in while a mouse button is held (click and hold, drag). Pixel art, two sizes (1x, and 2x for dense screens),
// embedded so it needs no asset. The hot spot is the fingertip in both frames, so a press never moves the point.
// A text field keeps the text caret. installPlusCursor() is called once, when the Plus sheet is laid on the page.

import { getPref, setPref } from '../systems/uiPrefs.js';

const N1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB8AAAAiCAYAAACnSgJKAAAC6ElEQVR4nK1YPW/iQBB9IEBY8s+gcGEsROHfQRHRhAqhlFdddT/gqquujCIqrkFX8Du2QAi22MI/I1IiQPIV0dsbL7vYkDwpij92d97MvJ1Z0+pHcQkP3t9eW77nX4lWP4rLTrdnHwySFOawvSAQIumOuwVtaXQynQEASKYfxSX/AODhcY5kOEYyHKPT7SEZjmuJXUOrH8UlF0mzEQBA73fBCWk2su8Lo4ORaoI2AJjDFoXRFQNcPESAhguj745Am2wHSYrNegW93yHPc8wXTxgkKdJshPniyRLarFcAgJ+/foPz7iVgc24OWwySFACglLIebtYrLF+eAcAS2qxXUErZCBAk0BQXapb5z/McSils1isbhTzPsXx5RmE0JtOZHcOonE9HAM3y3+HF+9trqx/FpZvnPM/twoXRNiU0CHwIlPOS4dgKsLHn9L7T7dnwywgAH+mQnkrVS5xPx0ae25wz7BQSBSZBEvxPSLK3oJLzZDi2ImPBCREAEIxA07y3Qy+4ILeWa9h3TzRVfdA4xTVI0qsVT4Ilmimr2/Ne4+5+J9x7H/R+B73fNfLea3y+eMJkOrPby1W8C584m3hfMU7BKKWg97u7VVwYXfE+ROCiwrn7HKhWO8JVvd7vLiJArYS6nvWcL86nY7CbhcCqBwB//ywtsTQbIc1GwQhUwi4J+DyQ12w2Lh4e57YSEuaw9RK4EBwJyB6fZiMbWhLwiUwSlARo2CXQ8U1mkwmlQKr/GgE5nvedbg/n0xH9KC6vlr+QCOl1iICbEmmcMIdtuMIBfhH6FnJBoRFyfGG0Xeuq8RCBW3eDNCzR+LRZ1+sJnnxccJ7sfF7BhRDagiTw4/u3ijGecEOoDTshq5MbPqVUxbAkIMF5fH7TIV+qXy7iLuqDjALLbWPPgf/eu0YGSWpPt8BllyM5c9hW6vzNH3jXGpALGRFfc7nr69L3ZVtn1DX8KeO8liQk5M4IHSQ/9QNA3Rmt7vT6D8dI3MKbjy/yAAAAAElFTkSuQmCC';
const N2 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAD4AAABECAYAAADZeIbjAAADGklEQVR4nO2bvYpUQRCFa2QVBR/DYINVxGCeYwMx0WgRQyMjH8BATDQSWTbSRAx8jglEdIMNfAxBUUEDPco9dw6n+/6N0PVFO3N/Zpmvqrq6b8/q4qXLP6OCr18+r2rO/185t+t/YFesYHzv/IWtJ1zZP4iIiLOP7zrvK/O1EeTuNxfNGt/jN2D44Nr1iIg4/fD+94l/IuLH928R4c3evH3UuR58OjvtfA4iCfdbynyzxv/m+P7VG50DMA7YXCkcOUCZB3ObT+MAuXx4687WC2COjSk4ct6+ftm5blfm2zWOPzjX2cTR3XudC0+OX0TEP6Pr9ToiIjabTUT0IwMRhPNwPVjafBrnXFdVns1yzvJ5MMvmAa4HXDNgPo1PRO9bXNo83wfgfugUwVTmmzXe69XxjcI8DClgDMAUrsNxjApsFvAoABBxXOXH0qxxmS88T1cdGucygFmVw6p3VyDXM8dH0stxruqPnjyLiH6n5mZrHAHKPODefW6aNS7HcVRTGEa1VrM2BZsHtTk/9XjerPFejjtgxkWCMs3HVc4zU4/nabwU5B46MUQAR8JYuOcHU63KpnEHj7MuN7lzGwpX+6lyPY07eHbFKydqfl1qvrQjxHljcz2NM8hlfMO8erp0b+3m6bXmmzVu19zcfByotTjG9e6l/QDXgtp1+GaN2zU3zIpKn5UNBZHAEfPm1UlERDx++rzzvoqI0pxv1ritgG6dneHxnnMWr/lZHONqBB9HZKjOjs2ncYer9qU7KNSqLKNWaNzTWUaZb9Z4ca/uqr2j1LTDRRIfV7u1mjU+eKWytsPjGlBrnndQqPu72R1yPo0PpbTaq6pciluHV6j1+WaNV6+yMq7awzC/nhs32jRrfPJdg2OfqzNqjU/Bn5c5TozOcQU/3WS4KrP5hw/ub71O7YGtJY1PBVd54AyNzWWGc5v3yDZrfLZfAaiODrjqOzR3VWTxvDyNz4XbB69QPb7q0d2eGdD8CsxixkHpkxmHq9og19WJxX7PWfobVkWpYZDPzgSLG2dUBChctS4ljS/N0N+Zg9zLOpBf+oY0aqvgeKkAAAAASUVORK5CYII=';
const P1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB8AAAAiCAYAAACnSgJKAAACw0lEQVR4nMVXu4rbQBQ9G2RjgT5DhYqxEC5U5htcBDdxZYxLV6nyAalSpQxhK6cxKfwdUwghqVDhz1jYxTYoxXKHq9HVwzIhB4QleTT33DNn7swA/xFPYz+cuV5F92+vL6P6+TDmoyj+WDmTKYL5okHknwZfb/cVAPiBwrksHiLQCD5zvUq6gPeMAUCFEc5l8TABMXNnMjUXdUwZn44HAMC37z8APKZAq+x+oLBcrQHAdLzZ7uAHCqfjAVprowCB2j0U3A+UuacARZZCa10jALwrsFyta0SGZu9IL8s8gTOZQoUR4jgG8C73uSwQxzE22x201qZ9kaUmcDBfoMyTIbHleT5zvYok5AS01ojj2AQushQAatIDwO16GTT3RdmD+QIqjBrviQT9Evgw3YMGu/V2X52OB2O2NgIAWhW4XS8A+itfLXOax7xDMpYdWHomDHW9CW47lMzlB8oQ6QNNTxqyPtd3TjXuaOlZQpGlKLJ0UPZi8M12h+VqbaaX7XgbkjmHZF8LTobRWqPI0tEupqLUV3KNG6mBM5k2glLmPGvb9UWWNhQgr1DRsd1vMqc/btdLo2j0gaoeAPz5/WyIqTCCCqNWBWqycwJSBvz++ddPkcinzxtTCQllnogEGoYjAmWeGAVUGBlpiYBkMk6QE6DANgFxYXl7fXmauV7VNgTc/V0EeHt6diZT3K4XzFyv6ix/bSakrNsI2EPCgxPKPOnew0kmlDqyQUYj8PbnsjB99W4gJQL3zgYemGPwfnvmepUkvy291rq2GBHoO77yiYZrQ9sUJAJfv+xrwWiH24bB+3ZenWz5tNa1wJwAB31H7+865nD3807sTiVwFajc3nVioeztIH6g4AfKONwuQESuzJNanb/7gNe1ANngikiLy6jTJTmf0DW2fBttr2qjg9M9J8HBZ0bbRnL0+dwmIaFv9/oXDJWpN+3sZiUAAAAASUVORK5CYII=';
const P2 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAD4AAABECAYAAADZeIbjAAADAklEQVR4nO2bv2pUQRjFjxJFwcewSBElWGzpM1iIjalCsExl5SPY2YlIKm3EwufYQkRTpPAxBEWFtTqEe3YP38z9MxHm+3W5d7N32d+cb76ZexdI+uJa6wveun1ns+v4r58/mn6W6y0v9j/R7Fs+XD3cAMD3i3MAwN39AwDAxbfPg9e1Mp/Gl+Lo5HQDAOdfvwyOX7X5NO5wVdhBU8z0wf3DwflPH94BuDR9VebTuIPG927c3HleTT1+egzgMtM0+ujJEQBgtVoBAM7evhm8T2vzadyhxmmE2dVqzeNqVs0TZp7w/QnNp/GZKDa+f+/B4HhUrUvN8/x6vd75fn///B4cn8t8t8b3Sl/IrDHrapTQFM3y/PHJMwDbZonOAoQjTav8VLo1XpyXKOtqnmZdhl3v7mDWM+MTKc44Tbv5W9ER4MwT7d2XplvjYV64nma11s4rQs2T2szPPZ93a9xmnOtphWaYdTcSnGk97zKvzD2fp3ES7bgwe+zEOAJ0JExFe35C4/ycY7OexiN0no2yqZ3bWLTaz5X1NB6hqyvdOXHr61LzpR0hXzc162lcYZb5DdMcjbTuraN1eq35bo1vfTs6j+vuqkPX5a7qR717aT+gtaB2H75b41sZ5zdF81wV6Z2OueFI0BHz8f0ZAODlq9eD425ElGa+W+PVd0t1z03R+V4zy7/5OkdUI/Q8R4br7NR8Go+Iqr1mznVgbldWcTs0bvZw13PmuzVe3KtH1T6i1HRENJL0PEcmPy8/f7fGR+9U1nZ4WgNqzesTFO79o9UdM5/Gx1Ja7V1VLiXah3e4/flujRdXdUdU7WlY/16aaLbp1vjsTw26p6SU2g5O9/gcer3MuDA54w69u6loVVbzL56f7vw/9wxsLWl8LrTKk8jQ1Cwrmm19RrZb44v9CsB1dCSqvmOz60aWrsvT+FLo83Gl1dj1+K5Hj56ZId3vwDQzTkrvzEREVZvkvrrQ7JeGpb9tcZQaJnnvzNDcuOJGgCOq1qWk8dbU/oJRyWdZR/IPP8YJDAACIzkAAAAASUVORK5CYII=';
export const CURSOR_HOTSPOT = [0, 0];
const cur = (a, b) => `image-set(url("${a}") 1x, url("${b}") 2x) ${CURSOR_HOTSPOT[0]} ${CURSOR_HOTSPOT[1]}, auto`;
const curFallback = (a) => `url("${a}") ${CURSOR_HOTSPOT[0]} ${CURSOR_HOTSPOT[1]}, auto`;

export const CURSOR_CSS = `
/* ── PLUS6: THE GAUNTLET CURSOR ── !important on purpose: many buttons and rails (and sheets injected after this one)
   set their own cursor: pointer, which showed the system hand over them. The gauntlet is the one pointer Plus has. */
html:not(.plus-nocursor), html:not(.plus-nocursor) *, html:not(.plus-nocursor) *::before, html:not(.plus-nocursor) *::after { cursor: ${curFallback(N1)} !important; cursor: ${cur(N1, N2)} !important; }
html.plus-press:not(.plus-nocursor), html.plus-press:not(.plus-nocursor) *, html.plus-press:not(.plus-nocursor) *::before, html.plus-press:not(.plus-nocursor) *::after { cursor: ${curFallback(P1)} !important; cursor: ${cur(P1, P2)} !important; }
html:not(.plus-nocursor) input:not([type="range"]):not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]), html:not(.plus-nocursor) textarea, html:not(.plus-nocursor) [contenteditable="true"] { cursor: text !important; }
`;

/** PLUS6: the gauntlet is ON unless the player turned it off (UI Overhaul card, Enhanced Plus). */
export const plusCursorOn = () => getPref('plusCursor') !== false;
/** Wear the stored choice on the page: off puts .plus-nocursor on the root and the rules above stand down. */
export function applyPlusCursor(doc = globalThis.document) {
  doc?.documentElement?.classList?.toggle('plus-nocursor', !plusCursorOn());
}
/** Choose: stored, and worn at once - no reload. */
export function setPlusCursor(on, doc = globalThis.document) {
  setPref('plusCursor', !!on);
  applyPlusCursor(doc);
}

let installed = false;
export function installPlusCursor(doc = globalThis.document) {
  const win = doc?.defaultView;
  if (installed || !win) return;
  installed = true;
  const root = doc.documentElement;
  applyPlusCursor(doc);
  const down = (e) => { if (e.pointerType !== 'touch') root.classList.add('plus-press'); };
  const up = () => root.classList.remove('plus-press');
  win.addEventListener('pointerdown', down, { capture: true, passive: true });
  win.addEventListener('pointerup', up, { capture: true, passive: true });
  win.addEventListener('pointercancel', up, { capture: true, passive: true });
  win.addEventListener('blur', up);
}
