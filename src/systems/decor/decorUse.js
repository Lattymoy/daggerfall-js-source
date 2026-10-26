// @ts-check
// DECOR-USE (2026-10-24, Discord - "Make bed decor and firepit decor actually funtional": "Was hyped to get a caravan for
// a mini house until i saw the beds dont actually let you sleep in it and firepit doesnt actually let you cook on it";
// "Cooking station is not an option in decorate"; bible/06-Systems/Online-Arc.md DECOR-USE) - WHAT A PLACED PIECE IS
// FOR, past what it holds and the craft it serves. The port's own; DFU places no furniture.
//
//   A BED     a placed piece that is one of Daggerfall's beds (rrRealism.js BED_MODELS, a town mod's coloured bed read
//             as the classic one it stands for - customModels.js classicModelIdOf) is slept in when pressed, as the
//             room's own beds are (worldModes.js restFromInteriorBed - the rest window's own gate decides who may).
//             The room's beds answer only under Roleplay Realism's bed sleeping; a bed the player placed answers
//             always - it was placed to be slept in.
//   A FIRE    a placed fire one can stand over - the lights archive's bowl of fire, camp flame and brazier
//             (survival/hearth.js isHearthFlat, the world's own cooking fires) - is one of the room's hearths: it warms,
//             a rest by it is a camp's, it is cooked on (Climates & Calories' list, and the Stores page's fire -
//             professionLaw.js COOK_FIRE) and pressed it opens what a brazier opens.
//             AUDIT DECOR-USE D4: and Daggerfall's own fireplaces (41116, 41117 - improvedInteriorLighting.js
//             IIL_FIREPLACE_MODELS, the models ImproveFireplaces lights), placed: a fireplace is a fire.
//   COOKING   a piece made the cooking station (net/decorLaw.js DECOR_STATIONS) is a hearth too, whatever it is - a
//             stove, an oven, a cauldron: the licence makes it the room's fire. AUDIT DECOR-USE D2: and it is the
//             profession's station - pressed where the Stores page is, it opens there on The Fire (`stores`), as a
//             forge opens on the forge; where it is not, it opens what a brazier opens.
//   NOT OFF   AUDIT DECOR-USE D6: a placed fire answers a press only where the room's own braziers do (camps.js
//             `usable`: Climates & Calories on, or online) - it is no more a fire than they are.
// A piece that holds things holds things: pressed, its storage opens, and it is neither bed nor fire.
import { isBedModel } from '../roleplayRealism/rrRealism.js';
import { classicModelIdOf } from '../../world/customModels.js';
import { isHearthFlat } from '../survival/hearth.js';
import { IIL_FIREPLACE_MODELS } from '../improvedInteriorLighting.js';   // AUDIT DECOR-USE D4: Daggerfall's fireplaces, one home

/** The station that makes any piece a hearth (net/decorLaw.js DECOR_STATIONS). */
export const COOKING_STATION = 'cooking';

/** Whether a placed piece is a bed to sleep in: one of Daggerfall's beds, holding nothing and serving no craft. */
export function decorBed(piece) {
  if (!piece || piece.storage || piece.station || piece.model == null) return false;
  return isBedModel(classicModelIdOf(piece.model));
}

/** Whether a placed piece is one of the room's hearths: the cooking station, or a fire one stands over or a fireplace
 *  that holds nothing and serves no other craft. */
export function decorHearth(piece) {
  if (!piece || piece.storage) return false;
  if (piece.station) return piece.station === COOKING_STATION;
  if (piece.model != null) return IIL_FIREPLACE_MODELS.has(classicModelIdOf(piece.model));   // AUDIT DECOR-USE D4
  return Array.isArray(piece.flat) && isHearthFlat(piece.flat[0], piece.flat[1]);
}

/**
 * A placed piece's own use, pressed (the interior host's activateDecor, before a station's craft): the cooking station
 * opens the Stores page on The Fire where there is one (`stores()` - true when it opened); a hearth opens what a brazier
 * opens (`camps` - scenes/camps.js activate, a `hearth:` press in the interaction `mode()`) where the braziers answer
 * (camps `usable`); a bed is slept in (`bed()` - the room's own beds' door). Whether it had one; a piece with none is
 * left to its station or its storage.
 */
export function useDecorPiece(piece, camps, mode, bed, stores = () => false) {
  if (piece?.station === COOKING_STATION && !piece.storage && stores()) return true;   // AUDIT DECOR-USE D2
  if (decorHearth(piece)) { if (camps.usable?.() !== false) camps.activate('hearth:', mode()); }   // AUDIT DECOR-USE D6
  else if (decorBed(piece)) bed();
  else return false;
  return true;
}

