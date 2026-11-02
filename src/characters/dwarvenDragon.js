// @ts-check
// DWARVEN-DRAGON (2026-10-28): THE DWARVEN DRAGON, A DWEMER CLOCKWORK DRAGON WITH A DAEDRIC RIDER - the game's own monster, for
// staff events (a kind or a mini boss) and Play as boss. Its pictures are our own renders, walking and clawing on the
// werewolf's Bloodmoon animation, in Daggerfall's mobile layout (characters/mobile/mobileUnit.js: five facings of move,
// attack, hurt and idle). It registers as an Enemy Expansion monster does (systems/enemyExpansion/dexInstall.js): a row,
// a career template, a name and its archive on the texture door. Never in an encounter table: staff place it.
import { registerEnemyRows } from './enemy/enemyBasics.js';
import { loadMonsterCareer } from './enemy/enemyEntity.js';
import { registerCustomCareerTemplate, registerCustomEnemyName } from './enemy/customEnemies.js';
import { registerCreatureMatches } from './creatureBodies.js';
import { addVendorTextures } from '../systems/textureReplacement.js';
import { APP_ROOT } from '../systems/appRoot.js';
import { t, registerCustomEnemyNameText } from '../systems/textManager.js';
import { DWARVEN_DRAGON_ID, DWARVEN_DRAGON_ARCHIVE, AETHERBRIGHT_ARCHIVE } from './dwarvenDragonId.js';
import { aetherbrightPng } from './dwarvenDragonShiny.js'; // DRAGON7: the Aetherbright, 1800's pictures under its palette

export { DWARVEN_DRAGON_ID, DWARVEN_DRAGON_ARCHIVE, AETHERBRIGHT_ARCHIVE };

/** Its name in the player's language; the game's own English (the save, the log) is the career's. */
export const dwarvenDragonName = () => t('enemy.dwarvenDragon', 'Dwarven Dragon');
export const DWARVEN_DRAGON_ART = 'art/dwarven-dragon/';
/** Frames by record: 0-4 move, 5-9 claw attack, 10-14 hurt, 15-19 idle, 20-24 hovering (DRAGON-HOVER). */
export const DWARVEN_DRAGON_FRAMES = Object.freeze([
  8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 8, 8, 8, 8, 8,
]);

/** The Iron Atronach's row (36) made a boss: a metal golem's career, sounds and remains. */
export const DWARVEN_DRAGON_ROW = Object.freeze({
  maleTexture: DWARVEN_DRAGON_ARCHIVE,
  femaleTexture: DWARVEN_DRAGON_ARCHIVE,
  behaviour: 'General',
  affinity: 'Golem',
  corpseTexture: Object.freeze({ archive: 405, record: 1 }),
  minMetalToHit: -1,
  minDamage: 20,
  maxDamage: 45,
  minHealth: 300,
  maxHealth: 500,
  level: 24,
  armorValue: 0,
  weight: 10000,
  mapChance: 0,
  soulPts: 0,
  hasIdle: true,
  primaryAttackAnimFrames: Object.freeze([0, 1, 2, 3, -1, 4, 5, 6, 7]),
  team: 'Magic',
  canOpenDoors: false,
  parrySounds: true,
  moveSound: 222,
  barkSound: 223,
  attackSound: 224,
});
const IRON_ATRONACH = 36;
/** Its English, the game's own (the save, the log, the staff's list). */
export const DWARVEN_DRAGON_NAME = 'Dwarven Dragon';

export const dwarvenDragonArtUrl = (name) =>
  new URL(`${DWARVEN_DRAGON_ART}${name}.png`, APP_ROOT ?? globalThis.document?.baseURI ?? 'http://localhost/').href;
async function fetchPng(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`[DWARVEN-DRAGON] ${url}: ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
}

/** Every picture, as texture-door entries (dexSprites.js's shape): the brass (1800), and the Aetherbright (1801) - the same
 *  file under its own palette, turned as it loads (DRAGON7). */
export function dwarvenDragonSpriteEntries({ fetchBytes = fetchPng } = {}) {
  const out = [];
  DWARVEN_DRAGON_FRAMES.forEach((n, record) => {
    for (let frame = 0; frame < n; frame++) {
      const name = `${DWARVEN_DRAGON_ARCHIVE}_${record}-${frame}`,
        url = dwarvenDragonArtUrl(name);
      out.push({
        archive: DWARVEN_DRAGON_ARCHIVE,
        record,
        frame,
        map: 'Albedo',
        standIn: true,
        readOnly: true,
        fileName: name,
        load: () => fetchBytes(url),
      });
      out.push({
        archive: AETHERBRIGHT_ARCHIVE,
        record,
        frame,
        map: 'Albedo',
        standIn: true,
        readOnly: true,
        fileName: `${AETHERBRIGHT_ARCHIVE}_${record}-${frame}`,
        load: async () => aetherbrightPng(await fetchBytes(url)),
      });
    }
  });
  return out;
}

let _installed = false;
/** Once a page: the row, the career, the name, its declared Morrowind miss and the pictures (Daggerfall's own density, 40 pixels a metre: no xml scale). Answers the pictures added. */
export function installDwarvenDragon(opts = {}) {
  if (_installed) return 0;
  _installed = true;
  registerEnemyRows([[DWARVEN_DRAGON_ID, structuredClone(DWARVEN_DRAGON_ROW)]]);
  registerCustomCareerTemplate(DWARVEN_DRAGON_ID, {
    name: DWARVEN_DRAGON_NAME,
    load: (fetchBytes) => loadMonsterCareer(IRON_ATRONACH, fetchBytes),
  });
  registerCustomEnemyName((id) => (id === DWARVEN_DRAGON_ID ? DWARVEN_DRAGON_NAME : null));
  registerCustomEnemyNameText((id) => (id === DWARVEN_DRAGON_ID ? dwarvenDragonName() : null));
  registerCreatureMatches([
    [DWARVEN_DRAGON_ID, { miss: 'our own clockwork dragon: no Morrowind creature is it, so its sprite stands' }],
  ]);
  return addVendorTextures(dwarvenDragonSpriteEntries(opts));
}
/** The test seam: the next install registers again. */
export function _resetDwarvenDragon() {
  _installed = false;
}
