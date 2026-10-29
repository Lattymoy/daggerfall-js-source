// @ts-check
// DRAGON5 (bible/11-Multiplayer/Dwarven-Dragon.md section 10): THE DRAGON'S SADDLE OVER MY VIEW, ONE HOME - an Admin's ride
// (scenes/staffDragonHost.js, DRAGON-RIDE) and a tamed dragon's (player/mountRig.js) draw the same two pictures
// (systems/staffDragon.js SADDLE_PICTURES: at rest, and the cannons firing) along the bottom of the view, as wide as the
// screen, over the large HUD's band. Asked once; a failed load is asked again at the next draw. Not a DFU member.
import { SADDLE_PICTURES } from '../systems/staffDragon.js';
import { dwarvenDragonArtUrl } from '../characters/dwarvenDragon.js';
import { loadLogo } from '../ui/titleScreen.js';
import { uiCanvas, onUiScreen } from '../ui/uiScreen.js';
import { horseOffsetHeight } from '../ui/hud/hudLarge.js';

/** `load(url)` a picture's pixels (tests hand their own). @param {{ renderer: any, load?: (url: string) => Promise<any> }} deps */
export function createDragonSaddle({ renderer, load = loadLogo }) {
  /** @type {any[] | null} */
  let art = null;
  let asked = false;
  function loadArt() {
    if (asked) return;
    asked = true;
    Promise.all(SADDLE_PICTURES.map((n) => load(dwarvenDragonArtUrl(n)))).then((px) => {
      if (px.every(Boolean)) art = px.map((p, i) => ({ tex: renderer.uploadTexture('ui', `dragon:${SADDLE_PICTURES[i]}`, p), width: p.width, height: p.height }));
    }).catch(() => { asked = false; });
  }
  return {
    loadArt,
    loaded: () => !!art,
    /** The saddle along the bottom of my view - its firing picture when `firing`. @param {any} canvas @param {boolean} [firing] */
    draw(canvas, firing = false) {
      loadArt();
      if (!art) return;
      const ui = uiCanvas(typeof canvas === 'function' ? canvas() : canvas);
      const a = art[firing ? 1 : 0];
      const w = ui.width, h = (a.height * w) / a.width;
      onUiScreen(renderer, ui, () => renderer.drawScreenQuad(a.tex, { x: 0, y: ui.height - h - horseOffsetHeight(), w, h }, undefined, undefined, { blend: true }));
    },
  };
}
