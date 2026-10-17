// @ts-check
// MENU-ORDER (2026-10-12, bible/10-UI/Menu-Order.md) - A SHIP'S OWN PICTURE ON THE SHIPMASTER'S CARD.
//
// The owner, of the shops and the menus: "I just feel like text lists are too much. Why cant you try something else".
// The shipmaster's cards (ui/shipyardWindow.js) led with a ship's glyph at her size; each now shows her: the hull's
// portrait boat (scenes/comeSailAway/comeSailAwayPool.js `portrait` - built once, standing, never on the water) drawn with the panel
// pass into a box of the game canvas under the window, and copied out (scenes/panelPicture.js), once a hull for the
// session. The window asks (`picture`); the world's frame draws (`draw`, after its own pass, as the decorator's preview
// is drawn) SHIP_PORTRAITS_A_FRAME a frame, once her every part has come. An ask the world cannot answer in
// SHIP_PORTRAIT_WAIT_MS (Come Sail Away's models never in, a hull that never builds) gives none: the card keeps her glyph.
import { lookAt, perspective, mirrorProjectionX } from '../world/mat4.js';
import { panelPicture, canvasBoxUnder } from './panelPicture.js';

/** The picture's size, the canvas's own pixels (the card shows it at its width - AUDIT MENU-ORDER R7: up to some 330px on
 *  a phone's one column, so twice the 240 it was drawn at; never more than the window's box holds). */
export const SHIP_PORTRAIT_W = 480;
export const SHIP_PORTRAIT_H = 240;
export const SHIP_PORTRAITS_A_FRAME = 1;
export const SHIP_PORTRAIT_WAIT_MS = 30_000;
/** How she is seen: from a little above and off her beam, a quarter turned toward one end (a hull's length runs along
 *  her z - every one of the five measured so: turned from that line, radians) - as a ship is met from a quay. */
export const SHIP_PORTRAIT_TURN = 1.15;
export const SHIP_PORTRAIT_LOOK_DOWN = 0.22;
const FOV = 30 * (Math.PI / 180);

/** The camera her picture is drawn with: her box whole in the frame, seen off her quarter from above. Pure. */
export function shipPortraitCamera(box, aspect = SHIP_PORTRAIT_W / SHIP_PORTRAIT_H) {
  const [x0, y0, z0, x1, y1, z1] = box;
  const c = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
  const rad = Math.hypot(x1 - x0, y1 - y0, z1 - z0) / 2 || 1;
  const dist = rad / Math.sin(FOV / 2);
  const flat = dist * Math.cos(SHIP_PORTRAIT_LOOK_DOWN);
  const eye = [c[0] + flat * Math.sin(SHIP_PORTRAIT_TURN), c[1] + dist * Math.sin(SHIP_PORTRAIT_LOOK_DOWN), c[2] - flat * Math.cos(SHIP_PORTRAIT_TURN)];
  return {
    proj: mirrorProjectionX(perspective(FOV, aspect, Math.max(0.05, dist - rad * 1.5), dist + rad * 1.5)),
    view: lookAt(eye, c, [0, 1, 0]),
  };
}

/**
 * @param {{ renderer: any, canvas: any, doc: any, portrait: (hull: number) => ({ parts: Array<[any, Float32Array]>, box: number[] } | null), now?: () => number }} deps
 */
export function createShipPortraits(deps) {
  const now = () => deps.now?.() ?? Date.now();
  /** @type {Map<number, Promise<string|null>>} a hull's picture, asked or made - kept for the session */
  const made = new Map();
  /** @type {Array<{ hull: number, where: () => any, asked: number, resolve: (url: string|null|PromiseLike<string|null>) => void }>} */
  const asks = [];
  /**
   * A hull's picture: a promise of its URL (null: none to be had - the card keeps her glyph). `where` is the box on the
   * page the window stands in, read when she is drawn: her picture is made under it.
   * @param {number} hull @param {() => any} where
   */
  function picture(hull, where) {
    if (!deps.renderer?.panelFrame || !deps.canvas || !deps.doc) return null;
    let p = made.get(hull);
    for (const a of asks) if (a.hull === hull) a.where = where;   // still waiting: drawn under the window that asks now
    if (!p) {
      p = new Promise((resolve) => { asks.push({ hull, where, asked: now(), resolve }); });
      p.then((url) => { if (!url) made.delete(hull); });   // none this time: the next window asks again
      made.set(hull, p);
    }
    return p;
  }
  /** The frame's turn, after the world's pass: the next asks whose ship has come, drawn and copied. Answers how many. */
  function draw() {
    let drawn = 0;
    for (let i = 0; i < asks.length && drawn < SHIP_PORTRAITS_A_FRAME;) {
      const ask = asks[i];
      if (now() - ask.asked > SHIP_PORTRAIT_WAIT_MS) { asks.splice(i, 1); ask.resolve(null); continue; }
      const rect = canvasBoxUnder(deps.canvas, ask.where?.() ?? null, SHIP_PORTRAIT_W, SHIP_PORTRAIT_H);
      const ship = rect ? deps.portrait(ask.hull) : null;
      if (!ship) { i++; continue; }
      asks.splice(i, 1);
      drawn++;
      const cam = shipPortraitCamera(ship.box, rect.w / rect.h);
      ask.resolve(panelPicture({
        renderer: deps.renderer, canvas: deps.canvas, doc: deps.doc, rect, proj: cam.proj, view: cam.view,
        body: () => { for (const [gpu, m] of ship.parts) deps.renderer.drawMesh(gpu, m, null); },
      }));
    }
    return drawn;
  }
  return { picture, draw, pending: () => asks.length };
}
