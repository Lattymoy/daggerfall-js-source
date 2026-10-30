// @ts-check
// APPEARANCES-II (2026-10-27; bible/04-Characters/Wardrobe.md section 4): THE PREVIEW - the character wearing a look on
// the piece picked, before Wear is paid. It is the figure the pack shows on this skin: the Morrowind body on Enhanced
// Plus where one stands for the player (ui/enhanced/enhancedInventory.js modelFigure), else the paper doll. Both are
// drawn off a stand-in (systems/appearances.js previewWearer) through net/appearanceLaw.js drawnPiece, so the piece and
// the player's own doll and body are never touched. The body is a rig of the preview's own, unloaded with the window.
import { previewWearer } from '../../systems/appearances.js';
import { appearanceSig } from '../../net/appearanceLaw.js';
import { composeDollFor, paperDollArtLoaded } from '../paperDoll.js';
import { createFpArm, fpArm } from '../../combat/fpArm.js';
import { armBuildOptsOf, armRenderer } from '../../combat/weapon/weaponRig.js';
import { isEnhancedPlus } from '../../systems/uiSkin.js';
import { equipTableOf } from '../../systems/equip.js';

/** The body's figure height in pixels - the pack's own (enhancedInventory.js modelFigureImage). */
export const PREVIEW_FIGURE_H = 384;
/** The figures a window keeps, so a look tried again is not drawn twice - few, since a texture mod's doll is 1.3 MB. */
export const PREVIEW_KEEP = 8;

/** What a stand-in draws as - its identity and every worn piece's fields and look - so a figure is drawn again when any
 *  of it changes (a Wear on another piece is in every later figure). */
function standKey(/** @type {any} */ stand) {
  let slots = [];
  try {
    slots = equipTableOf(stand) ?? [];
  } catch {
    slots = [];
  }
  const worn = slots
    .map((it) =>
      it ? `${it.group}.${it.templateIndex}.${it.material}.${it.variant}.${it.dye}.${appearanceSig(it)}` : '',
    )
    .join('|');
  return `${stand?.race}|${stand?.gender}|${stand?.faceIndex}|${worn}`;
}

/**
 * THE PREVIEW - `{ figure, dispose }`. `figure(item, look, onReady)` answers what to show for `item` wearing `look` (its
 * own look for null): `{ kind, width, height, data }` drawn - `kind` 'body' or 'doll', `data` RGBA rows top down - or
 * `{ kind, data: null }` while it draws (`onReady` is told once it lands), or null with nothing to draw it with.
 * @param {{ entity: any, arm?: any, renderer?: () => any, createRig?: () => any, buildOpts?: (e: any) => any,
 *   composeDoll?: (e: any) => Promise<any>, dollArt?: () => boolean, plus?: () => boolean }} deps
 */
export function createWardrobePreview({
  entity,
  arm = fpArm,
  renderer = armRenderer,
  createRig = createFpArm,
  buildOpts = armBuildOptsOf,
  composeDoll = composeDollFor,
  dollArt = paperDollArtLoaded,
  plus = isEnhancedPlus,
}) {
  /** key -> a figure drawn, null while drawing, false when it cannot be. @type {Map<string, any>} */
  const memo = new Map();
  let alive = true;
  /** @type {any} */
  let rig = null;
  let building = false;
  /** @type {{ key: string, stand: any, onReady?: () => void } | null} */
  let want = null;
  const keep = (/** @type {string} */ key, /** @type {any} */ v) => {
    memo.delete(key);
    memo.set(key, v);
    while (memo.size > PREVIEW_KEEP) memo.delete(/** @type {string} */ (memo.keys().next().value));
  };
  /** One body build at a time, the newest asked last: a look tried while one builds waits, one passed over is dropped. */
  async function pump() {
    if (building || !want || !alive) return;
    const job = want;
    want = null;
    building = true;
    let px = null;
    try {
      rig ??= createRig();
      rig.attach(renderer(), null);
      const res = await rig.build(buildOpts(job.stand));
      if (alive && res?.ok) px = rig.figure({ yaw: 0, height: PREVIEW_FIGURE_H });
    } catch {
      px = null;
    }
    building = false;
    if (!alive) {
      release();
      return;
    }
    keep(
      job.key,
      px?.width && px?.height && px?.data ? { kind: 'body', width: px.width, height: px.height, data: px.data } : false,
    );
    job.onReady?.();
    pump();
  }
  function bodyFigure(
    /** @type {any} */ stand,
    /** @type {string} */ key,
    /** @type {(() => void) | undefined} */ onReady,
  ) {
    if (memo.has(key)) return memo.get(key);
    if (want && want.key !== key) memo.delete(want.key); // passed over before it was built
    memo.set(key, null);
    want = { key, stand, onReady };
    pump();
    return null;
  }
  function dollFigure(
    /** @type {any} */ stand,
    /** @type {string} */ key,
    /** @type {(() => void) | undefined} */ onReady,
  ) {
    if (memo.has(key)) return memo.get(key);
    memo.set(key, null);
    Promise.resolve(composeDoll(stand))
      .then((px) => {
        if (!alive) return;
        const data = px?.rgba ? new Uint8ClampedArray(px.rgba.buffer, px.rgba.byteOffset, px.rgba.length) : null;
        keep(key, data ? { kind: 'doll', width: px.width, height: px.height, data } : false);
        onReady?.();
      })
      .catch(() => {
        if (alive) keep(key, false);
      });
    return null;
  }
  function figure(/** @type {any} */ item, /** @type {any} */ look, /** @type {(() => void) | undefined} */ onReady) {
    if (!alive || !item) return null;
    const stand = previewWearer(entity, item, look ?? null);
    const key = standKey(stand);
    if (plus() && arm?.canThirdPerson?.()) {
      const body = bodyFigure(stand, `body|${key}`, onReady);
      if (body !== false) return body ?? { kind: 'body', data: null }; // a body that cannot be built shows the doll
    }
    if (!dollArt()) return null;
    const doll = dollFigure(stand, `doll|${key}`, onReady);
    return doll === false ? null : (doll ?? { kind: 'doll', data: null });
  }
  function release() {
    try {
      rig?.unload?.();
    } catch {
      /* the rig is going either way */
    }
    rig = null;
  }
  /** The window shut: the body's rig unloaded (EVERY ALLOCATION HAS AN OWNER) - one still building, as it lands. */
  function dispose() {
    alive = false;
    want = null;
    memo.clear();
    if (!building) release();
  }
  return { figure, dispose };
}
