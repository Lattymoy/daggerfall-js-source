// @ts-check
// AUDIT WORLD-EVENTS L1-10 (bible/01-Overview/audits/Audit-World-Events.md): THE MADE LEVEL'S PAUSE AT THE HURT DOOR -
// systems/courtRules.js courtRulesHurt heard at the player's hurt door (characters/playerEntity.js
// registerPlayerHurtListener). Wired here, the client's own, not in courtRules.js: the account Worker bundles courtRules
// (server-account/src/lostSpoils.js -> item/itemLaw.js -> enchanting.js -> enchantments.js) and must never pull the
// player's whole entity in with it (test/server/accountdeploy.test.js ACC1-CI). scenes/world.js imports it once.
import { registerPlayerHurtListener } from '../characters/playerEntity.js';
import { courtRulesHurt } from './courtRules.js';

registerPlayerHurtListener('court-rules', (_e, hurt) => courtRulesHurt(hurt));
