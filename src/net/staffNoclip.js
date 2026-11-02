// @ts-check
// STAFF-NOCLIP (2026-11-02): /noclip [on|off] - THE STAFF'S AND THE MODERATORS' NO-CLIP. A flight that goes through walls,
// floors and terrain: the motor's levitating step moves the body with no collider (player/motor.js registerNoclip). Kept
// out of net/staffCommands.js, which the relay's graph holds: this file is the game's alone.
//
// WHO MAY: a player whose OWN glyphs, as the account service signs them into the identity token, say `dev`, `dm`,
// `shadowfang` (the staff, net/staffCommands.js STAFF_GLYPHS) or `mod` (an account on the service's Moderator list,
// server-account/src/titles.js). Anyone else's /noclip is no command - the chat's own refusal. It moves only the typer,
// is never saved and never sent, and the host drops it the moment the glyphs no longer allow it.

import { STAFF_GLYPHS } from './staffCommands.js';
import { t } from '../systems/textManager.js';   // the help line in the player's language, read when /staff is asked

/** The glyphs that open /noclip. */
export const NOCLIP_GLYPHS = Object.freeze([...STAFF_GLYPHS, 'mod']);
/** Whether a player wearing `glyphs` may use /noclip. */
export const mayNoclip = (glyphs) => Array.isArray(glyphs) && glyphs.some((g) => NOCLIP_GLYPHS.includes(g));
/** What the typer is told. */
export const noclipOnText = () => t('net.staff.noclipOn', 'No-clip on: fly through walls, floors and the ground. Jump rises, crouch sinks.');
export const noclipOffText = () => t('net.staff.noclipOff', 'No-clip off.');
/** The line `/staff` adds for it. */
export const noclipHelpLine = () => t('net.staff.noclipHelp', '/noclip [on|off] - fly through walls, floors and the ground');

/**
 * What a /noclip line IS: { cmd: 'noclip', on }, { error } for a shape it refuses, or null for any other line.
 * A bare /noclip flips `now`.
 * @param {string} text @param {boolean} [now]
 */
export function parseNoclipCommand(text, now = false) {
  const m = /^\/noclip(?:\s+([\s\S]*))?$/i.exec(String(text ?? '').trim());
  if (!m) return null;
  const words = (m[1] ?? '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length > 1) return { error: 'Usage: /noclip [on|off].' };
  const w = words[0];
  const on = w === 'on' ? true : w === 'off' ? false : w === undefined ? !now : null;
  return on === null ? { error: 'Usage: /noclip [on|off].' } : { cmd: 'noclip', on };
}
