// THE DEATH SCREEN (UI arc, D1). This module was ui/inventory.js and
// held three windows; two of them retired onto their classic art and
// the third is what is left, so the file finally carries its name.
//
//   (The keyed INVENTORY window that lived here is DELETED at U26.
//   It was the dungeon host's until that slice swapped in the classic
//   ui/nativeInventory.js window, after which nothing imported it.
//   Its one law - EquipItem excludes exactly Weapons/Arrow and hands
//   everything else to the equip table - was never the window's: it
//   lives in systems/equip.js, where every host now reaches it.)
//
//   (The keyed SPELLBOOK window that lived here is DELETED at U42,
//   which puts DaggerfallSpellBookWindow on the real SPBK00I0.IMG in
//   ui/spellbookWindow.js - list, icons, effect panels, delete,
//   rename, sort and the guilds' buy mode. Its `knownSpells` helper
//   went with it: the interim "an empty book lists the file's ranged
//   damage spells" fallback had been dead for players since S3c gave
//   chargen real starting spells, and the two flight probes that
//   still wanted that list read spellcast.rangedDamageSpells now.)
//
// Death (D1): health 0 opens this through the ONE hurtPlayer door and
// it drives PlayerDeath's whole sequence - the camera sinks a
// quarter-capsule below the feet, the HUD fades black over two
// seconds, the classic death sound plays, and three seconds in the
// host runs ANIM0012.VID and returns to the title menu (DFU's
// TitleMenuFromDeath). ENTER skips to that end; the F11 hint is the
// real quickload binding (InputManager.SetupDefaults: F9/F11).

import { drawText, measureText } from './text.js';
import { PlayerDeathSequence, DEATH_TIME_BEFORE_RESET } from '../systems/playerDeath.js';   // D1
import { playerEntity } from '../characters/playerEntity.js';   // D1: the death clip's race/gender
import { audio } from '../systems/audio.js';

const DIM = [0.5, 0.5, 0.45, 1];
/** D1: the death screen DRIVES PlayerDeath's sequence - the camera
 *  sinks, the HUD fades to black over two seconds, the classic death
 *  sound plays once, and three seconds in the host's onReset runs
 *  (the death video, then the title menu: DFU's
 *  StartMethods.TitleMenuFromDeath). ENTER skips straight to that
 *  reset rather than reloading the same scene, which is where DFU's
 *  death lands you; F11 still quickloads, the port's own affordance
 *  and the reason the hint is drawn. `drop` is read by each host's
 *  frame to sink its camera - one player, one death, one law. */
export class DeathScreen {
  constructor({ eyeHeight, capsuleHeight, onReset = null, entity = playerEntity } = {}) {
    this.done = false;
    // MERGE AUDIT: the death clip is the character's OWN race/gender
    // Pain3 whenever CombatVoices is on (it ships on), so the sequence
    // needs an identity. It reads the shared player entity here - ONE
    // seam, the way onReset is one seam - rather than making all four
    // hosts remember to pass a race they all already import.
    this.sequence = new PlayerDeathSequence({
      eyeHeight, capsuleHeight, onReset,
      race: entity?.raceId ?? null, gender: entity?.gender ?? null,
      playSound: (clip) => audio.playOneShot(clip, 1),
    });
  }
  get drop() { return this.sequence.drop; }
  tick(dt) { this.sequence.tick(dt); }
  input(action) {
    // ENTER ends the run now; the sequence's own reset is the timer.
    if (action === 'confirm') this.sequence.tick(DEATH_TIME_BEFORE_RESET + 1);
  }
  draw(renderer, canvas, font, s) {
    // FadeHUDToBlack over the death: the world dims to black behind
    // the text rather than sitting under a fixed red wash.
    const fade = this.sequence.fade;
    renderer.drawScreenQuad(null, { x: 0, y: 0, w: canvas.width, h: canvas.height }, undefined, [0.05, 0.01, 0.01, 0.35 + 0.6 * fade]);
    const t = 'YOU HAVE DIED';
    drawText(renderer, font, t, (canvas.width - measureText(font.fnt, t) * s) / 2, canvas.height / 2 - 10 * s, s, [0.9, 0.2, 0.15, 1]);
    drawText(renderer, font, 'ENTER end   F11 load', (canvas.width - measureText(font.fnt, 'ENTER end   F11 load') * s) / 2, canvas.height / 2 + 6 * s, s, DIM);
  }
}
