// @ts-check
// /noclip [on|off] - a flight through walls, floors and terrain for staff and Moderators.
// The motor's levitating step skips the collider (player/motor.js registerNoclip). It lives outside
// net/staffCommands.js, which the relay's graph holds, so the relay is untouched.
// Who may: the glyphs the account service signs into the identity token - the staff's (STAFF_GLYPHS) or a
// Moderator's `mod` (server-account/src/titles.js). It moves only the typer and is never saved or sent.

import { STAFF_GLYPHS } from './staffCommands.js';
import { t } from '../systems/textManager.js';   // the help line in the player's language, read when /staff is asked

/** The glyphs that open /noclip. */
export const NOCLIP_GLYPHS = Object.freeze([...STAFF_GLYPHS, 'mod']);
/** Whether a player wearing `glyphs` may use /noclip. */
export const mayNoclip = (glyphs) => Array.isArray(glyphs) && glyphs.some((glyph) => NOCLIP_GLYPHS.includes(glyph));
/** What the typer is told. */
export const noclipOnText = () => t('net.staff.noclipOn', 'No-clip on: fly through walls, floors and the ground. Jump rises, crouch sinks.');
export const noclipOffText = () => t('net.staff.noclipOff', 'No-clip off.');
/** The line `/staff` adds for it. */
export const noclipHelpLine = () => t('net.staff.noclipHelp', '/noclip [on|off|speed <1-20>] - fly through walls, floors and the ground');
export const noclipSpeedText = (speed) => t('net.staff.noclipSpeed', 'No-clip speed {speed}x.', { speed });
export const noclipSpeedUsage = () => t('net.staff.noclipSpeedUsage', 'Usage: /noclip speed <1-20>.');
/** The fastest `/noclip speed` takes, as a multiple of the levitating pace. */
export const NOCLIP_SPEED_MAX = 20;

/**
 * What a /noclip line IS: { cmd: 'noclip', on }, { cmd: 'noclip', speed } (1 to NOCLIP_SPEED_MAX, a multiple of the
 * levitating pace), { error } for a shape it refuses, or null for any other line.
 * A bare /noclip flips `now`.
 * @param {string} text @param {boolean} [now]
 */
export function parseNoclipCommand(text, now = false) {
  const match = /^\/noclip(?:\s+([\s\S]*))?$/i.exec(String(text ?? '').trim());
  if (!match) return null;
  const words = (match[1] ?? '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words[0] === 'speed') {
    const speed = Number(words[1]);
    return words.length === 2 && Number.isFinite(speed) && speed >= 1 && speed <= NOCLIP_SPEED_MAX
      ? { cmd: 'noclip', speed }
      : { error: noclipSpeedUsage() };
  }
  if (words.length > 1) return { error: 'Usage: /noclip [on|off].' };
  const word = words[0];
  const on = word === 'on' ? true : word === 'off' ? false : word === undefined ? !now : null;
  return on === null ? { error: 'Usage: /noclip [on|off].' } : { cmd: 'noclip', on };
}
