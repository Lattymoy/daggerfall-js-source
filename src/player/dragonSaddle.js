// @ts-check
// DRAGON5 (bible/11-Multiplayer/Dwarven-Dragon.md section 10): THE DRAGON'S SADDLE OVER MY VIEW, ONE HOME - an Admin's ride
// (scenes/staffDragonHost.js, DRAGON-RIDE) and a tamed dragon's (player/mountRig.js) draw the same two pictures
// (systems/staffDragon.js SADDLE_PICTURES: at rest, and the cannons firing) along the bottom of the view, as wide as the
// screen, over the large HUD's band. Asked once; a failed load is asked again at the next draw. An Aetherbright's rider sees
// its saddle in its own colours (DRAGON7: the same pictures under its palette). Not a DFU member.
import { SADDLE_PICTURES } from '../systems/staffDragon.js';
import { dwarvenDragonArtUrl } from '../characters/dwarvenDragon.js';
import { aetherbrightUrl } from '../characters/dwarvenDragonShiny.js';
import { loadLogo } from '../ui/titleScreen.js';
import { uiCanvas, onUiScreen } from '../ui/uiScreen.js';
import { horseOffsetHeight } from '../ui/hud/hudLarge.js';

/** DRAGON-POV (2026-10-30, as the owner asked): the host's word that something stands over the view the
 *  saddle would be painted on - a chat, a friends panel, the F-menu (the surfaces that free the pointer without pausing the
 *  game), a window that takes the HUD away, the travel view. The saddle is the view from its seat, so it goes with them. */
let _covered = () => false;
/** @param {(() => boolean) | null} fn */
export function setDragonSaddleCovered(fn) {
  _covered = typeof fn === 'function' ? fn : () => false;
}

/** `load(url)` a picture's pixels (tests hand their own); `look()` the ridden dragon's look (1 the Aetherbright); `turn(url)`
 *  an Aetherbright picture's address (characters/dwarvenDragonShiny.js aetherbrightUrl).
 *  @param {{ renderer: any, load?: (url: string) => Promise<any>, look?: () => number, turn?: (url: string) => Promise<string | null> }} deps */
export function createDragonSaddle({ renderer, load = loadLogo, look = () => 0, turn = aetherbrightUrl }) {
  /** @type {(any[] | null)[]} the brass's [0], the Aetherbright's [1] */
  const arts = [null, null];
  const asked = [false, false];
  const lookNow = () => (look() === 1 ? 1 : 0);
  function loadArt(k = lookNow()) {
    if (asked[k]) return;
    asked[k] = true;
    Promise.all(
      SADDLE_PICTURES.map(async (n) => {
        const url = k ? await turn(dwarvenDragonArtUrl(n)) : dwarvenDragonArtUrl(n);
        try {
          return url ? await load(url) : null;
        } finally {
          if (k && url) URL.revokeObjectURL?.(url);
        }
      }),
    )
      .then((px) => {
        if (px.every(Boolean))
          arts[k] = px.map((p, i) => ({
            tex: renderer.uploadTexture('ui', `dragon:${k ? 'aether:' : ''}${SADDLE_PICTURES[i]}`, p),
            width: p.width,
            height: p.height,
          }));
        else asked[k] = false;
      })
      .catch(() => {
        asked[k] = false;
      });
  }
  return {
    loadArt,
    loaded: () => !!arts[lookNow()],
    /** The saddle along the bottom of my view - its firing picture when `firing`. @param {any} canvas @param {boolean} [firing] */
    draw(canvas, firing = false) {
      if (_covered()) return; // DRAGON-POV: nothing painted under a panel
      const k = lookNow();
      loadArt(k);
      const art = arts[k];
      if (!art) return;
      const ui = uiCanvas(typeof canvas === 'function' ? canvas() : canvas);
      const a = art[firing ? 1 : 0];
      const w = ui.width,
        h = (a.height * w) / a.width;
      onUiScreen(renderer, ui, () =>
        renderer.drawScreenQuad(a.tex, { x: 0, y: ui.height - h - horseOffsetHeight(), w, h }, undefined, undefined, {
          blend: true,
        }),
      );
    },
  };
}
