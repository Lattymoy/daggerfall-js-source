// @ts-check
// PROFILE-SLOTS (2026-10-28, the owner: "an actual preview of either your morrowind/sprite for the selected character";
// bible/04-Characters/Aura-Armory.md section 10) - THE BODY THE PROFILE'S STAGE DRAWS (render/characterStage.js): the
// character as the world draws it. Its Morrowind body where one stands for it (combat/fpArm.js stage() - in a game, where
// the rig is built), and its sprite everywhere: the on-foot skin chosen, or the layered gear it wears in its own body
// (player/eyeOfTheBeholder/eotbBody.js look(), layeredArmor.js), at the world's size and offset. Not a DFU member.
import { modSettingsOf } from '../systems/modSettings.js';
import {
  spriteFor,
  eotbSpriteUrl,
  spriteOffset,
  spriteArtScale,
  spriteSize,
  decodeSprite,
} from '../player/eyeOfTheBeholder/eotbSprite.js';
import { layeredGenderOf } from '../player/eyeOfTheBeholder/layeredArmor.js';
import { STAGE_BONES, stageCameraOfBones } from '../render/characterStage.js';
import { CAPSULE_HEIGHT } from '../player/motor.js';

/** The kinds of body a character can be shown as, in the order the stage prefers them: what the world draws first. */
export const PROFILE_BODY_KINDS = Object.freeze(['mw', 'sprite']);

/** The look the world draws a character's sprite in on foot - eotbBody.js look(): the skin chosen (Graphics.OnFoot), or
 *  with Layered Gearing on (Graphics.LayeredGear) the armour it wears (`outfit`, layeredArmor.js outfitOfSlots) in the
 *  body chosen or its own (`gender`). Pure. */
export function profileSpriteLook(
  /** @type {{ gender?: string|null, outfit?: string|null }} */ who = {},
  /** @type {Record<string, any>} */ settings = {},
) {
  const choice = settings['Graphics.LayeredGear'] ?? 0;
  const gender = layeredGenderOf(choice, who.gender ?? null);
  return {
    onFoot: settings['Graphics.OnFoot'] ?? 0,
    wornArmour: gender != null,
    ...(gender ? { gender, outfit: who.outfit || 'lll' } : {}),
  };
}

/** Where the world stands a Morrowind body's plate, m over its feet - net/peer/peerBodies.js heightOf on foot and
 *  ungrown: a creature's own height, else the capsule's at the race's height. Pure. */
export const mwHeadOf = (/** @type {any} */ arm) =>
  arm?.bodyHeight?.() ?? CAPSULE_HEIGHT * (arm?.raceHeightScale?.() ?? 1);

/** The billboard scale the player chose (eotbBody.js look()'s `scale`). Pure. */
export const spriteScaleOf = (/** @type {Record<string, any>} */ settings = {}) =>
  (settings['Animation.BillboardScale'] ?? 1) + (settings['Animation.FineBillboardScale'] ?? 0);

/** The sprite the world draws standing, front on (the idle table's orientation `view`, 0), as the stage takes it: its picture's
 *  color32 rows bottom first, its metres a pixel, its foot over the feet and its offset across - eotbBody.js place()'s
 *  law. Null where the bundle has no picture for it. */
export async function spriteBodyOf(
  /** @type {any} */ look,
  { scale = 1, view = 0, decode = decodeSprite, urlOf = eotbSpriteUrl } = {},
) {
  const s = spriteFor('Idle', view, 0, look);
  const url = s ? urlOf(s.key) : null;
  if (!s || !url) return null;
  const px = await decode(url);
  if (!px?.width || !px?.height || !px.colors) return null;
  const xml = spriteOffset(s.archive, s.record);
  const size = spriteSize(px.width, px.height, { scale: scale > 0 ? scale : 1 }, xml.scale);
  return {
    kind: 'sprite',
    width: px.width,
    height: px.height,
    colors: px.colors,
    mpp: size.h / px.height,
    base: xml.y / xml.scale,
    shift: (xml.x / xml.scale) * (s.mirror ? -1 : 1),
    key: s.key,
    view: s.view ?? 0,
    art: spriteArtScale(s.archive, s.record),
  };
}

/**
 * THE BODIES OF ONE CHARACTER, for the profile: `kinds()` the kinds it can be shown as now ('mw' only where a Morrowind
 * body stands - `arm.canThirdPerson()`), and `of(kind, { width, height })` the body (a promise; null where it cannot be
 * drawn). `who()` the character's own body and armour - { gender, outfit }.
 * @param {{ arm?: any, who?: () => { gender?: string|null, outfit?: string|null }|null, settings?: () => Record<string, any> }} deps
 */
export function profileBodies({
  arm = null,
  who = () => null,
  settings = () => modSettingsOf('eye-of-the-beholder'),
} = {}) {
  const settingsNow = () => {
    try {
      return settings() ?? {};
    } catch {
      return {};
    }
  };
  return {
    kinds: () => PROFILE_BODY_KINDS.filter((k) => k !== 'mw' || !!arm?.canThirdPerson?.()),
    /** What a kind's body is drawn in now - a body asked in another look is asked again (the skin changed beside it). */
    lookKey(/** @type {string} */ kind) {
      if (kind === 'mw') return 'mw';
      const s = settingsNow();
      return `${JSON.stringify(profileSpriteLook(who() ?? {}, s))}@${spriteScaleOf(s)}`;
    },
    async of(/** @type {string} */ kind, { width = 320, height = 420 } = {}) {
      if (kind === 'mw') {
        let r = null,
          head = 0;
        try {
          head = mwHeadOf(arm);
          r =
            arm?.stage?.({
              width,
              height,
              names: STAGE_BONES,
              frame: (/** @type {any} */ bones) => stageCameraOfBones(head, bones, width / height),
            }) ?? null;
        } catch {
          r = null;
        }
        return r?.data ? { kind: 'mw', ...r, head } : null;
      }
      const s = settingsNow();
      try {
        return await spriteBodyOf(profileSpriteLook(who() ?? {}, s), { scale: spriteScaleOf(s) });
      } catch {
        return null;
      }
    },
  };
}
