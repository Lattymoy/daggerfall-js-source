// @ts-check
// SCALE5b (2026-10-10, Mac: "lets now tackle the bigger work ... really future proof our archetecture while also
// increasing performance"; bible/11-Multiplayer/Scale-Arc.md SCALE5b): THE RELAY'S SETTINGS, AT RUN TIME. The line the
// boss fights' count runs by (BOSS_BODY, INT11-INT14) and the Discord roles the herald pings (GATE_DISCORD_ROLE,
// SERPENT_DISCORD_ROLE, SD_DISCORD_ROLE - and, HERALD-CARDS, the threads it posts to) were the Worker's vars alone, and a var changed is a Worker redeployed: every
// player online dropped, a reconnect wave and its mints, to move one number. A developer now sets each in the hub
// (`/relay <setting> <value>`, a hub frame - only a token whose glyphs say `dev` may), the hub keeps it in its storage,
// and every room reads it there: the hub its own, a boss's room by asking the hub at most every RELAY_CFG_TTL_MS. The
// var is still read: it is the setting while the hub holds none, and `-` hands a setting back to it.
//
// The law both ends run: the settings' names, a setting's bound, the frame in and its answer out.

/** A setting's name -> the Worker var it stands over. */
export const RELAY_CFG_VARS = Object.freeze({
  bossBody: 'BOSS_BODY',
  gateRole: 'GATE_DISCORD_ROLE',
  serpentRole: 'SERPENT_DISCORD_ROLE',
  sdRole: 'SD_DISCORD_ROLE',
  // HERALD-CARDS (net/herald/heraldCard.js): the thread of the world events' channel each herald posts its cards to - its
  // own when set, else the gate's, else the channel itself (a Discord id; a forum channel needs the gate's at least)
  gateThread: 'GATE_DISCORD_THREAD',
  serpentThread: 'SERPENT_DISCORD_THREAD',
  sdThread: 'SD_DISCORD_THREAD',
  egThread: 'EG_DISCORD_THREAD',
  ktRole: 'KT_DISCORD_ROLE',   // KETCH (net/ketch/ketchHerald.js): the role the Sky-Ketch's sighting pings - its own, else the gate's
  ktThread: 'KT_DISCORD_THREAD',   // KETCH: and the thread her cards post to
  egDrain: 'EG_DRAIN',   // EG-H2 (bible/11-Multiplayer/Elite-Gates.md section 22): THE DRAIN - 'on' shuts the Spire's road (no new breach) while a deploy drains it
  groundGate: 'GROUND_GATE',   // GROUND-GATE (bible/01-Overview/bugs/Field-Bugs-2026-10-17f.md): 'on' refuses a ground room's hello from a build on an older ground (net/wire.js GROUND_LAW) - off until the site serves the build that says it, since the relay deploys first
  grantMode: 'GRANT_MODE',   // GRANT2 (bible/11-Multiplayer/Spawn-Grants.md section 12): the spawn grants' law - 'measure' (and unset: net/grantLaw.js grantModeOf), 'enforce' (GRANT6), 'off'
  grantRoll: 'GRANT_ROLL',   // GRANT8 (Spawn-Grants.md section 16): 'on' - an encounter's grant rolls its species from its seed (`encr`); off unset
  grantStrip: 'GRANT_STRIP',   // GRANT9 (Spawn-Grants.md section 16): 'on' - the relay drops a record its grant does not stand (FOE-BOUNDS, section 19: and one no builder could give); off unset
  grantDoor: 'GRANT_DOOR',   // GRANT-DOOR (Spawn-Grants.md section 20): 'on' - a foes room refuses a build whose hello says no spawn grants (net/wire.js GRANT_HELLO_LAW); off unset, and off until the site serves the build that says it, since the relay deploys first
  leaseDoor: 'LEASE_DOOR',   // LEASE1 (net/roomLease.js): 'on' - a lease room refuses a hello that does not hand on its hub's lease, and hears a bound socket in nothing but its ping while it holds no live lease; off unset, and off until the site serves the build that says it, since the relay deploys first
});
/** The settings a developer may set. */
export const RELAY_CFG_KEYS = Object.freeze(Object.keys(RELAY_CFG_VARS));
/** The longest a setting's value may be - BOSS_BODY's JSON is the longest, about a hundred characters. */
export const RELAY_CFG_VALUE_MAX = 512;
/** How long a boss's room trusts the settings it last asked the hub for - a change is in force everywhere inside it. */
export const RELAY_CFG_TTL_MS = 60_000;
/** The hub's internal door a room asks the settings at. */
export const RELAY_INTERNAL_CFG = '/internal/relay/cfg';
/** The first relay that takes the frame (RELAY_VERSION's number) - world192: SCALE5b's world191 was renumbered into it at
 *  the merge past main's WARDEN1, whose world191 takes none. */
export const RELAY_CFG_RELAY_MIN = 192;
/** HERALD-CARDS: a setting newer than the frame, and the first relay that knows it - an older one finds no such name in
 *  its RELAY_CFG_KEYS and closes the hub link on the frame, so the client says it only to a relay at this or later
 *  (world250: world243 on its branch, renumbered at the merge - AUDIT HERALD-CARDS S1). */
export const RELAY_CFG_KEY_MIN = Object.freeze({ gateThread: 250, serpentThread: 250, sdThread: 250, egThread: 250, ktRole: 255, ktThread: 255 });   // KETCH: world255's (world253 on its branch)
/** Does the relay at version `v` take a setting - any (`k` unsaid), or that one? */
export const relayCfgSupported = (v, k = null) => Number(/^world(\d+)$/.exec(String(v ?? ''))?.[1]) >= Math.max(RELAY_CFG_RELAY_MIN, RELAY_CFG_KEY_MIN[k] ?? 0);
/** May a player whose verified glyphs are `glyphs` set the relay's settings? The Developer's alone - a Dungeon Master's
 *  and Shadow Fang's staff commands move only themselves (net/staffCommands.js). */
export const mayRelayCfg = (glyphs) => Array.isArray(glyphs) && glyphs.includes('dev');

/**
 * A setting said to the hub: `{ k, v }` - `k` one of RELAY_CFG_KEYS, `v` its value (a string of at most
 * RELAY_CFG_VALUE_MAX) or null (handed back to the Worker's var). Null for anything else.
 * @param {any} m
 * @returns {{ k: string, v: string|null }|null}
 */
export function validRelayCfgIn(m) {
  if (!m || typeof m !== 'object' || !RELAY_CFG_KEYS.includes(m.k)) return null;
  if (m.v === null) return { k: m.k, v: null };
  if (typeof m.v !== 'string' || m.v.length > RELAY_CFG_VALUE_MAX) return null;
  return { k: m.k, v: m.v };
}

/**
 * The hub's answer: `{ k, v }` taken (`v` what is now in force: the hub's, or the var's when handed back), or
 * `{ k, error }`. Null for anything else.
 * @param {any} m
 * @returns {{ k: string, v?: string, error?: string }|null}
 */
export function validRelayCfgOut(m) {
  if (!m || typeof m !== 'object' || !RELAY_CFG_KEYS.includes(m.k)) return null;
  if (typeof m.error === 'string') return { k: m.k, error: m.error.slice(0, 120) };
  if (typeof m.v !== 'string' || m.v.length > RELAY_CFG_VALUE_MAX) return null;
  return { k: m.k, v: m.v };
}

/**
 * The setting in force: the hub's when it holds one, else the Worker's var (as the Worker hands it: a string, or
 * nothing). A hub's stored settings that are not an object hold none.
 * @param {any} cfg  the hub's settings ({ [k]: string })
 * @param {any} env  the Worker's bindings
 * @param {string} k
 * @returns {string|undefined}
 */
export function relayCfgValue(cfg, env, k) {
  const held = cfg && typeof cfg === 'object' ? cfg[k] : undefined;
  if (typeof held === 'string') return held;
  const v = env?.[RELAY_CFG_VARS[k]];
  return typeof v === 'string' ? v : undefined;
}

/**
 * A staff command's words for a setting: `/relay <setting> <value>`, `/relay <setting> -` (back to the var), or
 * `/relay` alone (the settings' names). Null when the words are not one.
 * @param {string} rest  what followed `/relay`
 * @returns {{ cmd: 'relay', k?: string, v?: string|null }|{ error: string }}
 */
export function parseRelayCfgCommand(rest) {
  const text = String(rest ?? '').trim();
  if (!text) return { cmd: 'relay' };
  const m = /^(\S+)\s*([\s\S]*)$/.exec(text);
  const k = RELAY_CFG_KEYS.find((x) => x.toLowerCase() === String(m?.[1] ?? '').toLowerCase());
  if (!k) return { error: `No relay setting called "${String(m?.[1] ?? '').slice(0, 24)}" - ${RELAY_CFG_KEYS.join(', ')}.` };
  const v = (m?.[2] ?? '').trim();
  if (!v) return { error: `Usage: /relay ${k} <value>, or /relay ${k} - to hand it back to the Worker's var.` };
  if (v.length > RELAY_CFG_VALUE_MAX) return { error: `A setting is ${RELAY_CFG_VALUE_MAX} characters at most.` };
  return { cmd: 'relay', k, v: v === '-' ? null : v };
}
