// S3c/U9: the CHARGEN SESSION - one place that owns "load the
// careers, run the flow, apply the result".
//
// THE FOUR HOSTS RULE: chargen used to live entirely inside
// dungeonContext, so a player who booted straight into a town
// (either exterior host) never created a character at all - they
// played the pre-chargen INTERIM entity (flat skills 30, maxHealth
// 50, Warrior-shaped nothing). The dungeon kept its own copy of the
// load/apply code, which is exactly the duplication the audit's
// rules forbid, so both live here now.
//
// The returned object is shaped for the exterior hosts' overlay seam
// (townTalk.showOverlay): isChoiceWindow so it receives RAW key
// codes, which it translates through the SHARED overlayAction table
// rather than a second mapping of its own.

import { ClassFile } from '../formats/classFile.js';
import { ChargenFlow } from '../ui/chargen.js';
import { applyCharacter, startingSpells, CLASS_CAREERS } from './chargen.js';
import { overlayAction } from '../ui/input.js';
import { assignStartingGear } from './startingGear.js';   // S3d

/** The 18 classic careers (CLASS00..17.CFG). */
export async function loadCareers(fetchBytes) {
  const careers = [];
  for (let i = 0; i < CLASS_CAREERS.length; i++) {
    const cf = new ClassFile();
    cf.load(await fetchBytes(`CLASS${String(i).padStart(2, '0')}.CFG`));
    careers.push({ name: cf.career.name || CLASS_CAREERS[i], career: cf.career });
  }
  return careers;
}

/** Apply a finished flow result onto the entity: the career/stat/
 *  skill derivations (applyCharacter), the starting spellbook, and
 *  the IDENTITY the paperdoll reads. */
export function finishChargen(playerEntity, result, spellsByIndex = null, { rolls = Math.random } = {}) {
  applyCharacter(playerEntity, result.career, result.careerIndex, result);
  if (spellsByIndex) playerEntity.spells = startingSpells(result.careerIndex, spellsByIndex);
  // S3d: the real starting kit replaces the INTERIM dagger seed -
  // AssignStartingGear runs ONCE, at creation, exactly as DFU does.
  // Anything the interim seed put in the bag is cleared first so a
  // host that seeded at boot does not leave a stray dagger.
  playerEntity.items = [];
  playerEntity.equip = null;
  playerEntity.armorValues = null;
  assignStartingGear(playerEntity, { classIndex: result.careerIndex, rolls });
  return playerEntity;
}

/** An overlay-shaped chargen window for the exterior hosts.
 *  onDone(result) fires once, after the flow reaches 'done'. */
export function createChargenWindow(careers, { onDone, rolls = Math.random, hudScale = 2 } = {}) {
  const flow = new ChargenFlow(careers, rolls);
  return {
    flow,
    isChoiceWindow: true,   // raw key codes through the overlay seam
    get done() { return flow.done; },
    input(code, ev) {
      // the SHARED overlay table (ui/input.js) - not a second copy
      const a = overlayAction(ev ?? { key: codeToKey(code) });
      if (a) flow.input(a);
      if (flow.done) onDone?.(flow.result());
    },
    draw(renderer, canvas, font) { flow.draw(renderer, canvas, font, hudScale); },
  };
}

/** The hosts hand us KeyboardEvent.code strings; overlayAction reads
 *  .key. Translate the codes chargen actually needs. */
function codeToKey(code) {
  if (typeof code !== 'string') return '';
  if (code.startsWith('Key')) return code.slice(3).toLowerCase();
  if (code.startsWith('Digit')) return code.slice(5);
  return ({
    ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', Enter: 'Enter',
    Backspace: 'Backspace', Escape: 'Escape', Space: ' ',
    Equal: '=', Minus: '-', NumpadAdd: '+', NumpadSubtract: '-',
  })[code] ?? '';
}
