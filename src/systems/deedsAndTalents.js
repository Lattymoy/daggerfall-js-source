// @ts-check
// DEEDS (2026-10-23, bible/06-Systems/Deeds-And-Talents.md): THE ARC'S REGISTRATIONS, in one place - imported once by
// scenes/shared.js, which every host imports, so no host grows a line (HOST-SPLIT). The laws stay where they are read:
// talents.js (the switch, the prices, the four advantages), partyTalents.js (the party's minor skills), deeds.js (the
// tallies and the fold). This module only tells them what happened:
//   - a magic round (worldTick.js): the deeds folded onto the career (the switch may have moved), and the party's care;
//   - a hurt on me (characters/playerEntity.js): care waits;
//   - a kill of mine (playerKills.js) and a spell or poison endured (playerEndures.js): the deeds' tallies;
//   - a blow of mine (entityMods.js, read by both combat cores and the stats card): Adrenaline Rush's harder blows.
import { registerMagicRoundHook } from './worldTick.js';
import { registerPlayerKillListener } from './playerKills.js';
import { registerPlayerEndureListener } from './playerEndures.js';
import { registerWeaponBlowMod } from './entityMods.js';
import { registerPlayerHurtListener, playerEntity } from '../characters/playerEntity.js';
import { playerDoor } from './playerDoor.js';
import { hudText } from './notify.js';
import { rushBlow } from './talents.js';
import { careRound, notePlayerHurt } from './partyTalents.js';
import { applyDeeds, deedKill, deedEndured } from './deeds.js';

export const DEEDS_AND_TALENTS = 'deeds-and-talents';

const me = () => playerDoor()?.player?.() ?? playerEntity;
const say = (lines) => { for (const line of lines ?? []) { try { hudText(line); } catch { /* a line is not the deed's problem */ } } };

registerMagicRoundHook(DEEDS_AND_TALENTS, (entity, { nowMinutes = 0, sinks = null } = {}) => {
  if (!entity?.isPlayer) return;
  applyDeeds(entity);
  careRound(entity, { nowMinutes, sinks });
});
registerPlayerHurtListener(DEEDS_AND_TALENTS, () => { notePlayerHurt(); });
registerPlayerKillListener(DEEDS_AND_TALENTS, (foe) => { say(deedKill(me(), foe)); });
registerPlayerEndureListener(DEEDS_AND_TALENTS, (entity, flags) => { say(deedEndured(entity, flags)); });
registerWeaponBlowMod(DEEDS_AND_TALENTS, (weapon, damage, attacker) => rushBlow(damage, attacker));
