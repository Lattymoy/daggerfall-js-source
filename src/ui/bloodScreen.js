// @ts-check
// BLOOD2e - BLOOD ON THE LENS (2026-09-21, Mac: "make it even more
// visceral and detailed").
//
// A blow that takes a real share of the player's health in ONE FRAME
// throws a few drops onto the screen: the port's own spatter cells (the
// atlas bloodArt.js makes at boot, white ink under the blood's tint),
// each its own size and place, sliding down a little as it goes and
// fading out over its last part. The reference has no screen blood;
// this is the port's, and it rides the vitals detector the HUD already
// runs (VitalsChangeDetector.HealthLostPercent, which CameraRecoiler
// reads for the same reason: a blow that hurt should be FELT).
//
// NO RENDERER OF ITS OWN: a pure list of drops the HUD's one
// host-agnostic call ticks and draws (hud.js drawHud, beside the damage
// flash), through the renderer's screen quad with the atlas texture.
import { BLOOD_BASE, pickCell } from '../combat/bloodArt.js';

/** The share of max health lost in one frame that throws blood on the
 *  lens - a tenth: a real blow, never the tick of a poison. */
export const SCREEN_SPATTER_MIN = 0.1;
/** Drops per blow: from one at the threshold to this at a blow worth
 *  half a life, rounded. */
export const SCREEN_DROPS_MAX = 5;
/** The share of a life that throws the most drops. */
export const SCREEN_DROPS_AT = 0.5;
/** Never more than this on the lens at once - the oldest go first. */
export const SCREEN_DROPS_CAP = 12;
/** A drop's life in seconds; it holds, then fades over SCREEN_FADE_SHARE of it. */
export const SCREEN_DROP_LIFE = 2.5;
export const SCREEN_FADE_SHARE = 0.4;
/** A drop's size as a share of the canvas HEIGHT (so it is the same
 *  drop on a phone and a monitor), and how far it slides down over its
 *  life, in canvas heights. */
export const SCREEN_DROP_SIZE = Object.freeze({ min: 0.05, max: 0.11 });
export const SCREEN_DROP_SLIDE = 0.06;

/** How many drops a blow of `share` (of max health) throws. */
export function screenDrops(share) {
  if (!(share >= SCREEN_SPATTER_MIN)) return 0;
  const t = Math.max(0, Math.min(1, (share - SCREEN_SPATTER_MIN) / (SCREEN_DROPS_AT - SCREEN_SPATTER_MIN)));
  return Math.max(1, Math.round(1 + t * (SCREEN_DROPS_MAX - 1)));
}

/** A drop's alpha at `age`: one, then a straight fade over the last share. */
export function screenDropAlpha(age, life = SCREEN_DROP_LIFE) {
  if (!(age >= 0) || age >= life) return 0;
  const hold = life * (1 - SCREEN_FADE_SHARE);
  return age <= hold ? 1 : Math.max(0, 1 - (age - hold) / (life - hold));
}

export function createBloodScreen({ rng = Math.random } = {}) {
  /** @type {Array<{ x: number, y: number, size: number, turn: number, age: number, cell: any }>} x, y, size in shares of the canvas */
  let drops = [];
  return {
    /** A blow for `share` of max health: the drops it throws, each its
     *  own place, size and turn. `atlas` picks the cells; without one
     *  (a host with no art yet) the drops still exist and draw nothing. */
    spatter(share, atlas = null) {
      const n = screenDrops(share);
      for (let i = 0; i < n; i++) {
        drops.push({
          x: 0.1 + rng() * 0.8, y: 0.1 + rng() * 0.7,
          size: SCREEN_DROP_SIZE.min + rng() * (SCREEN_DROP_SIZE.max - SCREEN_DROP_SIZE.min),
          turn: rng() * Math.PI * 2,
          age: 0,
          cell: atlas ? pickCell(atlas, 'spatter', rng) : null,
        });
      }
      if (drops.length > SCREEN_DROPS_CAP) drops = drops.slice(drops.length - SCREEN_DROPS_CAP);
      return n;
    },
    /** The host's REAL dt, like the flash: a drop does not slow because the game does. */
    tick(dt) {
      if (!(dt > 0) || !drops.length) return 0;
      for (const d of drops) d.age += dt;
      drops = drops.filter((d) => d.age < SCREEN_DROP_LIFE);
      return drops.length;
    },
    /** One screen quad a drop, BLENDED (the atlas's alpha is the shape)
     *  in the blood's own red at the drop's alpha, slid down by its age.
     *  Answers the quads drawn. */
    draw(renderer, canvas, tex) {
      if (!drops.length || !tex || !renderer?.drawScreenQuad) return 0;
      const H = canvas.height, W = canvas.width;
      let n = 0;
      for (const d of drops) {
        if (!d.cell) continue;
        const a = screenDropAlpha(d.age);
        if (!(a > 0)) continue;
        const px = d.size * H;
        const slide = SCREEN_DROP_SLIDE * H * (d.age / SCREEN_DROP_LIFE);
        const x = d.x * W - px / 2, y = d.y * H - px / 2 + slide;
        renderer.drawScreenQuad(tex, { x, y, w: px, h: px }, d.cell,
          [BLOOD_BASE[0], BLOOD_BASE[1], BLOOD_BASE[2], a],
          { blend: true, rotate: { rad: d.turn, px: x + px / 2, py: y + px / 2 } });
        n++;
      }
      return n;
    },
    clear() { drops = []; },
    get count() { return drops.length; },
    _drops: () => drops.slice(),
  };
}

/** THE PLAYER'S ONE LENS, for the reason damageFlash.js has one flash:
 *  one player, one screen, and whichever host is drawing ticks and
 *  draws it through drawHud. */
export const playerBloodScreen = createBloodScreen();
