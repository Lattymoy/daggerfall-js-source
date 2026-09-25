// LV1 — THE ASCENSION LAB. The enhanced level-up window, mounted on a
// page of its own with a made-up character and no game data at all.
//
// WHY A LAB AND NOT A PROBE OF THE GAME: /play/ cannot boot without a
// player's own ARENA2, and a level-up is four hundred in-game hours
// behind the title screen. A look has to be judged on a real screen at
// real sizes (the argument grass-proto.html and enhanced.html are both
// deployed for), and a window has to be DRIVEN to be believed - so
// this page hands the real module a real rollout screen over a fake
// entity, and tools/levelUpProbe.mjs drives exactly this.
//
// Everything below the entity is the SHIPPING code: ui/charsheet.js's
// LevelUpScreen and ui/virtueLevelUp.js's VirtueLevelUpScreen are the
// real laws, and the window is the real window.

import { LevelUpScreen } from '../ui/charsheet.js';
import { VirtueLevelUpScreen } from '../ui/virtueLevelUp.js';
// LV1's audit: the DOOR lane drives ui/charSheetDoor.js itself - the
// skin fork, the overlay the hosts are handed, the lazy chunk and the
// wait in front of it - rather than the view alone. It is the only way
// to see what a player sees between the level-up landing and the
// window arriving.
import { createCharSheetWindow } from '../ui/charSheetDoor.js';
// HOTFIX (2026-09-19): STATIC, AND THE REASON IS A BLACK SCREEN.
//
// This lane used to `await import('../ui/enhancedHud.js')`. A DYNAMIC
// import makes the bundler build a NAMESPACE OBJECT for the target, and
// a namespace object reads EVERY binding the module exports the moment
// it is built - including the ones a module re-exports from somewhere
// else. `ui/enhancedHud.js:1026` re-exports `compassScroll`, which is
// `ui/hud.js`'s, and hud.js and enhancedHud.js import each other. So
// the namespace read hud.js's `const compassScroll` while hud.js was
// still initialising: "can't access lexical declaration before
// initialization", thrown out of a chunk `/play/` loads, and the game
// black-screened for everyone.
//
// A NAMED STATIC IMPORT TAKES NO NAMESPACE - it binds the one export
// and reads it when it is used. This file is only ever loaded by
// `levelup.html`, so nothing is added to the player's bundle by moving
// it up here. The cycle underneath is older than this arc and is not
// what changed; what changed is that something asked for a namespace
// over one end of it.
import { drawEnhancedHud } from '../ui/enhancedHud.js';
// ...and NAMED here too, for the same reason: `import * as` is a
// namespace object as surely as a dynamic import is.
import { announceLevelUp, announceSkillRaise, announceMastery, drawLevelNotices } from '../ui/levelNotice.js';
import { SKILLS } from '../systems/skills.js';
import { LEVELUP_TOTAL } from '../systems/oblivionLeveling.js';

/** A character who has just earned a level. Every field is one a real
 *  entity carries; the numbers are invented, which is the only thing
 *  about this page that is. */
export function labEntity() {
  const skills = new Array(35).fill(0).map((_, i) => 8 + ((i * 7 + 13) % 46));
  skills[SKILLS.Archery] = 26;
  skills[SKILLS.LongBlade] = 57;
  skills[SKILLS.Stealth] = 71;
  skills[SKILLS.Climbing] = 41;
  skills[SKILLS.Dodging] = 22;
  skills[SKILLS.Restoration] = 34;
  return {
    name: 'Toshley',
    race: 'Nord',
    level: 5,
    pendingLevel: 6,
    readyToLevelUp: true,
    career: {
      name: 'Knight',
      hitPointsPerLevel: 20,
      primarySkills: [SKILLS.LongBlade, SKILLS.Etiquette, SKILLS.Climbing],
      majorSkills: [SKILLS.Archery, SKILLS.Restoration, SKILLS.CriticalStrike],
      minorSkills: [SKILLS.Dodging, SKILLS.Stealth, SKILLS.Swimming, SKILLS.Running, SKILLS.Mercantile, SKILLS.Medical],
    },
    stats: { strength: 62, intelligence: 41, willpower: 48, agility: 55, endurance: 58, personality: 44, speed: 51, luck: 47 },
    skills,
    // PlayerEntity's uint[2] mask: Archery and Climbing rose on the way
    // here, so the ribbon leads with them. THE WORD INDEX IS THE POINT -
    // Archery is skill 33, so it is bit 1 of the SECOND word, and the
    // obvious `1 << SKILLS.Archery` marks Etiquette instead (JS shifts
    // mod 32). The lab made exactly that mistake and the ribbon led with
    // a skill nobody had raised; systems/skills.js's own getter is the
    // reason the window was right and the fake data was wrong.
    skillsRecentlyRaised: [(1 << SKILLS.Climbing) >>> 0, (1 << (SKILLS.Archery - 32)) >>> 0],
    health: 96, maxHealth: 118,
    magicka: 0, maxMagicka: 0,
    fatigue: 64 * 104,
    startingLevelUpSkillSum: 180,
    currentLevelUpSkillSum: 254,
    levelProgress: 38, levelRollUp: 6,
    equipment: {}, items: [],
  };
}

const q = new URLSearchParams(globalThis.location?.search ?? '');
const host = document.getElementById('lab');
let view = null;
let entity = null;

/** Mount a lane. `oghma` is the classic screen with the book's flag
 *  latched - a fixed thirty, no Level++ - which is the arm AUDIT 39
 *  found unreachable, so the lab can see it. */
export async function mount(lane = 'classic') {
  view?.destroy?.();
  entity = labEntity();
  if (lane === 'oghma') { entity.oghmaLevelUp = true; entity.pendingLevel = null; }
  if (lane === 'virtue') entity.levelingSystem = 'virtue';
  // LV1's AUDIT: the character the window could not let go of. Every
  // attribute at the ceiling means `statUp` refuses every press, so
  // the pool never reaches zero - and the first cut's only exit tested
  // for zero. DFU's own CheckIfDoneLeveling has the IsAllMax term for
  // exactly this character, and the lab can now stand one up.
  if (lane === 'allmax') for (const k of Object.keys(entity.stats)) entity.stats[k] = 100;
  // LV2 - THE RISING. The notification is a HUD element, so the lane
  // mounts the REAL enhanced HUD under it: placement is the whole
  // question and a strip judged over an empty page would be judged
  // against nothing. Everything below the fake vitals is shipping
  // code.
  if (lane === 'notice') {
    entity.readyToLevelUp = true;
    announceLevelUp(entity, {});
    announceSkillRaise(SKILLS.Archery, 26, {});
    announceSkillRaise(SKILLS.Climbing, 41, {});
    announceMastery(SKILLS.LongBlade, {});
    const vitals = {
      health: 96, maxHealth: 118, fatigue: 104 * 64, maxFatigue: 120 * 64,
      magicka: 0, maxMagicka: 0, breath: null,
    };
    let heading = 0;
    const tick = () => {
      if (globalThis.__lv?.lane !== 'notice') return;
      heading = (heading + 0.0004) % 1;
      // IN ui/hud.js'S OWN ORDER, which is the strip FIRST: AUDIT LV2
      // F4 made where the strip hangs depend on whether the HUD host
      // exists yet, and drawHud paints the notices on the call BEFORE
      // it builds that host. A lab that drew them the other way round
      // would never take the fallback the shipping order takes on the
      // first frame of every session.
      drawLevelNotices({ owed: !!entity.readyToLevelUp });
      drawEnhancedHud(vitals, heading, 16, { hidden: false });
      globalThis.requestAnimationFrame(tick);
    };
    globalThis.__lv = { entity, lane, spend: () => { entity.readyToLevelUp = false; } };
    tick();
    return null;
  }
  if (lane === 'door') {
    // THE REAL DOOR. It builds its own rollout, its own host div and
    // its own wait; the lab holds the overlay so a probe can read the
    // host contract off it.
    const win = createCharSheetWindow({ entity });
    globalThis.__lv = { door: win, entity, lane, view: null, screen: null };
    return win;
  }
  // THE VIEW IS A DYNAMIC IMPORT HERE TOO, exactly as the door loads
  // it (MENU1's lazy chunk). A static import at the top of this file
  // put the module in the lab's own graph, so the DOOR lane resolved
  // it from the registry before the page had finished loading and the
  // wait could never be seen - the probe's first run read a green
  // "never blank" against a gap that had been closed by the lab
  // itself.
  const { mountEnhancedLevelUp } = await import('../ui/enhancedLevelUp.js');
  const screen = lane === 'virtue' ? new VirtueLevelUpScreen(entity) : new LevelUpScreen(entity);
  // THE DOOR'S OWN onExit IS A CLOSE (ui/charSheetDoor.js's
  // enhancedLevelUpOverlay), so the lab's must be too - the first
  // version only printed the result and left the window standing over
  // it, and the probe read "the window is gone" as false against a
  // commit that had in fact landed.
  view = mountEnhancedLevelUp(host, {
    screen, entity, onExit: () => { view?.destroy?.(); view = null; done(lane); },
  });
  // The probe reads these rather than the DOM's text where it wants
  // the LAW's answer: the window under test and the screen under it.
  globalThis.__lv = { view, screen, entity, lane };
  return view;
}

function done(lane) {
  const note = document.createElement('div');
  note.id = 'lab-done';
  note.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;'
    + 'background:#07080d;color:#d8cfae;font:16px system-ui,sans-serif;text-align:center;padding:24px';
  note.textContent = `Ascended. Level ${entity.level}, `
    + `stats ${Object.entries(entity.stats).map(([k, v]) => `${k.slice(0, 3)} ${v}`).join(' ')}`
    + `, bar ${entity.levelProgress ?? 0}/${LEVELUP_TOTAL} (${lane}).`;
  host.append(note);
  globalThis.__lvDone = { level: entity.level, stats: { ...entity.stats }, maxHealth: entity.maxHealth, lane };
}

// The lane picker. Kept out of the window's own tree so nothing on
// screen belongs to the lab except this one strip.
const bar = document.getElementById('lanes');
for (const lane of ['classic', 'oghma', 'virtue', 'allmax', 'door', 'notice']) {
  const b = document.createElement('button');
  b.textContent = lane;
  b.dataset.lane = lane;
  b.onclick = () => { document.getElementById('lab-done')?.remove(); mount(lane); };   // fire and forget: the lane strip is the lab's, not a law
  bar.append(b);
}

mount(q.get('lane') ?? 'classic');
