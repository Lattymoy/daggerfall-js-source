// @ts-check
// STAFF1 (2026-09-28, Mac: "So for developer, dungeon master and the shadow fang titles I want to add teleport, debug,
// and other admin commands"; Mac chose the groups: TELEPORT (self) and DEBUG, no time or weather, nothing that acts on
// another player): THE STAFF'S CHAT COMMANDS - one grammar, pure, DOM-free (net/chatCommands.js's way).
//
//   /tp <place>          to a town, dungeon or other named place, anywhere in the Iliac Bay (its best match)
//   /tp <x> <y>          to a map pixel (x 0-999, y 0-499 - the travel map's own grid)
//   /tp @<player>        to another online player's exact live position, through the authenticated hub
//   /god [on|off]        no damage reaches me
//   /fly [on|off]        levitation, without the spell
//   /heal                health, fatigue and magicka full
//   /pos                 where I stand: the map pixel, the place, native world units
//   /staff               this list
//   /relay <setting> <v> a relay setting, at run time - the Developer's alone (SCALE5b, net/relayCfg.js)
//
// WHO MAY: a player whose OWN glyphs say `dev`, `dm` or `shadowfang` - the Developer's, the Dungeon Master's and Shadow
// Fang's (identityToken.js TITLES/GLYPHS). Commands move/change only the typer.
// The exact-player lookup additionally requires the relay's verified staff claim.
// Anyone else gets `unknown` - the chat's own refusal - so the commands are not advertised to them.
//
// Not a DFU member: DFU's GodMode / teleport console verbs are Wenzil console commands (Ledger A: the console window is
// a departure); these ride the chat, the one text field the port has. Ledger A row (ONLINE).

import { parseRelayCfgCommand } from './relayCfg.js';   // SCALE5b: /relay's words

/** The glyphs that open the staff's commands. */
export const STAFF_GLYPHS = Object.freeze(['dev', 'dm', 'shadowfang']);
/** Whether a player wearing `glyphs` is staff. */
export const isStaff = (glyphs) => Array.isArray(glyphs) && glyphs.some((g) => STAFF_GLYPHS.includes(g));

/** The staff's command names (lowercase). */
export const STAFF_COMMANDS = Object.freeze(['tp', 'god', 'fly', 'heal', 'pos', 'staff', 'relay']);   // SCALE5b: `relay`, a developer's (net/relayCfg.js)
/** The travel map's grid: MapsFile's 1000 x 500 pixels. */
export const TP_MAP_W = 1000;
export const TP_MAP_H = 500;

/** The lines `/staff` shows. */
export const STAFF_HELP_LINES = Object.freeze([
  'Staff commands:',
  '/tp <place> - to a named place anywhere',
  '/tp <x> <y> - to a map pixel (x 0-999, y 0-499)',
  '/tp @<player> - to their exact live position',
  '/god [on|off] - take no damage',
  '/fly [on|off] - levitate',
  '/heal - restore health, fatigue and magicka',
  '/pos - show your position',
  '/relay [<setting> <value>|-] - server settings (developers only)',
]);

const onOff = (word, was) => (word === 'on' ? true : word === 'off' ? false : word === undefined ? !was : null);

/**
 * What a staff line IS, or null when it is not one of STAFF_COMMANDS:
 *   { cmd: 'tp', place }        { cmd: 'tp', px, py }        { cmd: 'tp', player }
 *   { cmd: 'god', on }          { cmd: 'fly', on }           { cmd: 'heal' }   { cmd: 'pos' }   { cmd: 'staff' }
 *   { error }                   in words, for a line in a shape its command refuses
 * `now` is the toggles' present state ({ god, fly }), so a bare /god flips it.
 * @param {string} text
 * @param {{ god?: boolean, fly?: boolean }} [now]
 */
export function parseStaffCommand(text, now = {}) {
  const m = /^\/([A-Za-z]+)(?:\s+([\s\S]*))?$/.exec(String(text ?? '').trim());
  if (!m) return null;
  const name = m[1].toLowerCase();
  if (!STAFF_COMMANDS.includes(name)) return null;
  const rest = (m[2] ?? '').replace(/\s+/g, ' ').trim();
  const words = rest ? rest.split(' ') : [];
  if (name === 'tp') {
    if (!rest) return { error: 'Usage: /tp <place>, /tp <x> <y>, or /tp @<player>.' };
    if (rest.startsWith('@')) {
      const player = rest.slice(1).trim();
      return player ? { cmd: 'tp', player } : { error: 'Usage: /tp @<player>.' };
    }
    if (words.length === 2 && words.every((w) => /^\d+$/.test(w))) {
      const px = Number(words[0]), py = Number(words[1]);
      if (px >= TP_MAP_W || py >= TP_MAP_H) return { error: `A map pixel is x 0-${TP_MAP_W - 1}, y 0-${TP_MAP_H - 1}.` };
      return { cmd: 'tp', px, py };
    }
    return { cmd: 'tp', place: rest.slice(0, 64) };
  }
  if (name === 'god' || name === 'fly') {
    if (words.length > 1) return { error: `Usage: /${name} [on|off].` };
    const on = onOff(words[0]?.toLowerCase(), !!now[name]);
    return on === null ? { error: `Usage: /${name} [on|off].` } : { cmd: name, on };
  }
  if (name === 'relay') return parseRelayCfgCommand(rest);   // SCALE5b
  if (words.length) return { error: `/${name} takes nothing after it.` };
  return { cmd: name };
}

/** Folds a name for matching: lowercase, apostrophes dropped, a hyphen a space, spaces single. */
const fold = (s) => String(s ?? '').toLowerCase().replace(/['\u2019]/g, '').replace(/[\s-]+/g, ' ').trim();

/**
 * THE PLACE A TYPED NAME MEANS among `places` ({ name, px, py }): an exact name first, then one the name begins, then
 * one it contains - the shortest name of the first rung that holds any (so "daggerfall" is the city, not "Daggerfall
 * Hollow"). Null when none.
 * @template {{ name: string }} P
 * @param {Iterable<P>} places
 * @param {string} typed
 * @returns {P|null}
 */
export function findPlace(places, typed) {
  const want = fold(typed);
  if (!want) return null;
  const rungs = [null, null, null];
  for (const p of places) {
    const n = fold(p?.name);
    if (!n) continue;
    const r = n === want ? 0 : n.startsWith(want) ? 1 : n.includes(want) ? 2 : -1;
    if (r < 0) continue;
    if (!rungs[r] || n.length < fold(rungs[r].name).length) rungs[r] = p;
  }
  return rungs[0] ?? rungs[1] ?? rungs[2];
}

/** THE PLAYER A TYPED NAME MEANS among `players` ({ name, px, py }): exact (folded), else the one it begins. */
export function findPlayer(players, typed) {
  const want = fold(typed);
  if (!want) return null;
  let begins = null;
  for (const p of players) {
    const n = fold(p?.name);
    if (n === want) return p;
    if (!begins && n.startsWith(want)) begins = p;
  }
  return begins;
}
