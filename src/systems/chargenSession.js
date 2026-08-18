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
import { applyCharacter, createCharacter, startingSpells, CLASS_CAREERS } from './chargen.js';
import { overlayAction } from '../ui/input.js';
import { assignStartingGear } from './startingGear.js';   // S3d
import { readSpellsStd } from '../formats/spellsStd.js';
import { parseBiog, biogFileName } from '../formats/biogFile.js';   // S3e
import { applyBiographyEffects } from './biography.js';   // S3e

/** SPELLS.STD as an index -> spell map. AUDIT 17f: the exterior
 *  hosts ran chargen without one and called finishChargen with no
 *  spell table at all, so a Mage or Spellsword created in a TOWN
 *  started with an EMPTY spellbook - the same character created in
 *  the dungeon host got their three starting spells. One loader, so
 *  a host cannot forget it. Returns null (loud) when the file is
 *  unavailable, which is the pre-existing no-magic fallback. */
export async function loadSpellIndex(fetchBytes) {
  try {
    return new Map(readSpellsStd(await fetchBytes('SPELLS.STD')).map((sp) => [sp.index, sp]));
  } catch (e) {
    console.warn('[chargen] SPELLS.STD unavailable; the starting spellbook stays empty', e);
    return null;
  }
}

/** All 18 classes' question sets, index-keyed - the shape
 *  createChargenWindow wants. A class whose file is missing is simply
 *  absent, and its biography screen is skipped. */
export async function loadBiogs(fetchBytes) {
  const out = [];
  for (let i = 0; i < CLASS_CAREERS.length; i++) out.push(await loadBiog(fetchBytes, i));
  return out;
}

/** S3e: one class's BIOGRAPHY questions (BIOG<class>T0.TXT). The
 *  file is latin1 text, not a binary record table. Returns null
 *  (loud) when unavailable, which skips the biography screen. */
export async function loadBiog(fetchBytes, classIndex) {
  try {
    const bytes = await fetchBytes(biogFileName(classIndex));
    const text = new TextDecoder('latin1').decode(bytes);
    return parseBiog(text, classIndex);
  } catch (e) {
    console.warn(`[chargen] ${biogFileName(classIndex)} unavailable; the biography questions are skipped`, e);
    return null;
  }
}

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

/** AUDIT 17f: the HEADLESS skip (?class=N) - the rolls-and-go path
 *  the dungeon host has had since U2b. It lived only there, so the
 *  exterior hosts parsed ?class for the dungeon they might build and
 *  ignored it for their OWN chargen: a probe (or anyone booting a
 *  town) had no way past the overlay, which is how S3c broke the
 *  U8d/U8e/U8g probes without a gate noticing. One implementation,
 *  three hosts. */
export async function applyHeadlessChargen(playerEntity, classIndex, { fetchBytes, spellsByIndex = null } = {}) {
  const cf = new ClassFile();
  cf.load(await fetchBytes(`CLASS${String(classIndex).padStart(2, '0')}.CFG`));
  createCharacter(playerEntity, cf.career, classIndex);
  playerEntity.spells = startingSpells(classIndex, spellsByIndex);
  // S3d: the same kit every other creation path gets
  playerEntity.items = [];
  playerEntity.equip = null;
  playerEntity.armorValues = null;
  assignStartingGear(playerEntity, { classIndex });
  console.log(`[chargen] ${CLASS_CAREERS[classIndex]}: HP ${playerEntity.maxHealth}, spells ${playerEntity.spells.length}`);
  return playerEntity;
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
  // S3e: the BIOGRAPHY effects land LAST, exactly where DFU applies
  // them (StartGameBehaviour.cs:416 - at game start, over the built
  // character), so a skill bonus rides on top of the distributed value
  // instead of being overwritten by applyCharacter's roll.
  if (result.biographyEffects?.length) applyBiographyEffects(playerEntity, result.biographyEffects, { rolls });
  return playerEntity;
}

/** An overlay-shaped chargen window for the exterior hosts.
 *  onDone(result) fires once, after the flow reaches 'done'. */
export function createChargenWindow(careers, { onDone, rolls = Math.random, hudScale = 2, biogs = null } = {}) {
  const flow = new ChargenFlow(careers, rolls);
  // S3e: the question sets, keyed by class index. Absent = the
  // biography screen is skipped rather than blocking the flow.
  if (biogs) flow.biogFor = (i) => biogs[i] ?? null;
  let _fired = false;
  return {
    flow,
    isChoiceWindow: true,   // raw key codes through the overlay seam
    get done() { return flow.done; },
    input(code, ev) {
      // AUDIT 17f / THE MODAL CONTRACT: the doc above promised onDone
      // fires once and the code did not - every key after the flow
      // reached 'done' fired it again, and each call re-ran
      // applyCharacter and re-rolled the starting kit. A host that
      // tears the overlay down on `.done` hid it; a key repeat inside
      // the same frame did not.
      if (_fired) return;
      // the SHARED overlay table (ui/input.js) - not a second copy
      const a = overlayAction(ev ?? { key: codeToKey(code) });
      if (a) flow.input(a);
      if (flow.done) { _fired = true; onDone?.(flow.result()); }
    },
    // U10: the shared overlay pointer seam hands NATIVE coords; the
    // classic screens are clickable exactly where DFU's buttons are.
    click(vx, vy) {
      if (_fired) return;
      flow.clickNative(vx, vy);
      if (flow.done) { _fired = true; onDone?.(flow.result()); }
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
