// @ts-check
// The world host's /noclip, wired here so bootWorld does not grow. The grammar and who may type it are
// net/staffNoclip.js; the step that passes through what it meets is player/motor.js registerNoclip; the switch is
// characters/playerEntity.js setStaffPowers({ noclip }).
//
// The motor asks the switch every levitating step, and the switch holds only while the service's own glyphs (the
// identity token's) still name the typer staff or a Moderator: a role taken away turns it off at the next step.
import { registerNoclip, registerFlySpeedMod } from '../player/motor.js';
import { setStaffPowers, staffNoclip } from '../characters/playerEntity.js';
import { mayNoclip, parseNoclipCommand, noclipOnText, noclipOffText, noclipSpeedText } from '../net/staffNoclip.js';

/**
 * @param {() => any} glyphs the service's glyphs for me now
 * @param {(g: any) => boolean} isStaff the host's own staff test (scenes/world.js isStaffT)
 */
export function createStaffNoclipHost(glyphs, isStaff) {
  const may = () => isStaff(glyphs()) || mayNoclip(glyphs());
  let speed = 1;   // the typer's /noclip speed, this page's alone
  registerNoclip(() => {
    if (staffNoclip() && !may()) setStaffPowers({ noclip: false });   // the role went: the switch with it
    return staffNoclip();
  });
  registerFlySpeedMod('noclip', () => (staffNoclip() ? speed : 1));
  return {
    /** A chat line: null when it is not /noclip from someone who may; else the switch set and its line said to the
     *  typer alone in `tabId` (as /god's and /fly's are), and the chat's answer returned (false for a shape it refuses).
     *  @param {string} text @param {{ push: (tab: any, line: any) => void }} log @param {any} tabId */
    chat(text, log, tabId) {
      const command = may() ? parseNoclipCommand(text, staffNoclip()) : null;
      if (!command) return null;
      if ('error' in command) { log.push(tabId, { text: command.error, system: true }); return false; }
      if ('speed' in command) {
        speed = command.speed;
        log.push(tabId, { text: noclipSpeedText(speed), system: true });
        return true;
      }
      setStaffPowers({ noclip: command.on });
      log.push(tabId, { text: command.on ? noclipOnText() : noclipOffText(), system: true });
      return true;
    },
  };
}
