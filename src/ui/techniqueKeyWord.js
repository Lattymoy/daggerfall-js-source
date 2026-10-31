// @ts-check
// TECH-KEY2: THE WORD FOR A TECHNIQUE KEY on the HUD's chips (combat/techniques.js techniqueHudChips) - the technique key's
// and the signature key's. Moved out of scenes/world.js bootWorld (HOST-SPLIT) when the second key came.
// AUDIT TECH-FX: looked up once a binding change (the store's `rev`) - asked each frame, getBinding walked every binding
// (10 KB and 11 us a frame). FINAL AUDIT (TECH-CARD): the card's word (quickslotTags.js actionKeyWord) - the key that
// answers, primary or secondary, and the pad's button while a pad is in hand - asked again when the pad is taken up or put down.
import { actionKeyWord } from './quickslotTags.js';
import { bindings } from './input.js';
import { controllerLook } from '../player/lookFilter.js';
import { padFamily } from './padGlyphs.js';
import { TECHNIQUE_ACTION } from '../combat/technique/techniqueRoster.js';

const _words = new Map();
let _store = null,
  _rev = -1,
  _pad = null;

/** The word for `action`'s key, kept until the bindings or the pad in hand change. @param {string} [action] */
export function techniqueKeyWord(action = TECHNIQUE_ACTION) {
  const b = bindings(),
    rev = b?.rev ?? 0,
    pad = controllerLook() ? (padFamily() ?? 'xbox') : null;
  if (_store !== b || _rev !== rev || _pad !== pad) {
    _store = b;
    _rev = rev;
    _pad = pad;
    _words.clear();
  }
  if (!_words.has(action))
    _words.set(action, actionKeyWord(action, { bindings: b, controller: pad !== null, family: pad ?? 'xbox' }));
  return _words.get(action);
}
