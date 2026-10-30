// FIXED-PVE STAGE 4 (bible/05-Combat/Fixed-PvE.md section 6): one law for hostile, neutral and friendly creatures - the
// template's start, the player's standing with its faction (the game's reputation), what the player did, an event.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PVE_FACTIONS, STANDING, SERVICE_REP, TERRITORY, KILL_SHARE, AGGRESSION_REP, factionStanding, effectiveDisposition,
  struckState, neutralAction, aggressionKind, aggressionCost, killShare, servicesOffered } from '../../../src/systems/pve/pveStanding.js';
import { TEMPLATE_BY_KEY, GROUP_TEMPLATES, groupProblems } from '../../../src/systems/pve/pveTemplates.js';
import { CRIMES } from '../../../src/systems/crimes.js';
import { createFactionRep, setReputation } from '../../../src/systems/faction/factionRep.js';

const t = (k) => TEMPLATE_BY_KEY.get(k);

test('STAGE 4: the spec\'s stronghold guard - neutral to a stranger, friendly to an ally, hostile to one who attacked the stronghold or whom the clan hates', () => {
  const guard = t('orc-stronghold-guard');
  assert.equal(effectiveDisposition(guard, { rep: 0 }), 'neutral');
  assert.equal(effectiveDisposition(guard, { rep: STANDING.ALLY }), 'friendly');
  assert.equal(effectiveDisposition(guard, { rep: 0, ally: true }), 'friendly');
  assert.equal(effectiveDisposition(guard, { rep: 50, crime: true }), 'hostile', 'a crime against the clan outweighs its standing');
  assert.equal(effectiveDisposition(guard, { rep: STANDING.HOSTILE }), 'hostile');
  assert.equal(effectiveDisposition(guard, { rep: 50, event: 'fleeing' }), 'fleeing', 'an event has the last word');
  // a hostile clansman stands down for an ally, but is not made a friend
  assert.equal(effectiveDisposition(t('orc-grunt'), { rep: STANDING.ALLY }), 'neutral');
});

test('STAGE 4: the standing is the game\'s own reputation with Orsinium (FACTION.TXT #358); an outlaw band and the faithless read none', () => {
  const store = createFactionRep(new Map([[358, { id: 358, name: 'Orsinium', rep: 0, children: null }]]));
  setReputation(store, 358, -30);
  assert.equal(factionStanding(t('orc-merchant'), store), -30);
  assert.equal(effectiveDisposition(t('orc-merchant'), { rep: factionStanding(t('orc-merchant'), store) }), 'hostile');
  assert.equal(factionStanding(t('bandit-chief'), store), null);
  assert.equal(factionStanding(t('crypt-lich'), store), null);
  assert.equal(PVE_FACTIONS.bandits.outlaw, true);
  assert.equal(effectiveDisposition(t('bandit-chief'), { ally: true }), 'hostile', 'no standing makes a bandit a friend');
  assert.equal(effectiveDisposition(t('bandit-chief'), { rep: 90 }), 'hostile', 'an outlaw band reads no reputation');
});

test('STAGE 4: wildlife starts and turns by its way; anything else struck turns on the one who struck it', () => {
  assert.deepEqual([t('wild-rat'), t('grizzly'), t('sabretooth')].map((x) => effectiveDisposition(x)), ['neutral', 'territorial', 'hostile']);
  assert.equal(struckState(t('wild-rat')), 'hostile');
  assert.equal(effectiveDisposition(t('orc-merchant'), { rep: 50, struck: true }), 'hostile');
  assert.equal(struckState({ wildlife: 'skittish' }), 'fleeing');
});

test('STAGE 4: a neutral or friendly creature starts nothing; a territorial one warns, then fights a player who stays or comes close', () => {
  assert.equal(neutralAction('neutral', 1), 'ignore');
  assert.equal(neutralAction('friendly', 1), 'ignore');
  assert.equal(neutralAction('hostile', 99), 'attack');
  assert.equal(neutralAction('territorial', TERRITORY.warn + 1), 'ignore');
  assert.equal(neutralAction('territorial', TERRITORY.warn), 'warn');
  assert.equal(neutralAction('territorial', TERRITORY.warn, TERRITORY.warnS), 'attack', 'it warned long enough');
  assert.equal(neutralAction('territorial', TERRITORY.fight), 'attack');
  assert.equal(neutralAction('wary', 5), 'watch');
  assert.equal(neutralAction('fleeing', 5), 'flee');
});

test('STAGE 4: a blow is a foe\'s, self-defence, hunting, a crime against the protected, or a faction\'s member - and each costs what the spec says', () => {
  assert.equal(aggressionKind(t('orc-merchant'), 'friendly'), 'protected');
  assert.equal(aggressionKind(t('orc-merchant'), 'friendly', { provoked: true }), 'selfDefence');
  assert.equal(aggressionKind(t('orc-grunt'), 'hostile'), 'foe');
  assert.equal(aggressionKind(t('orc-hunter'), 'neutral'), 'factionMember');
  assert.equal(aggressionKind(t('grizzly'), 'territorial'), 'hunting');
  assert.equal(aggressionKind(t('grove-spriggan'), 'territorial'), 'aggression');
  assert.deepEqual(aggressionCost('protected'), { crime: CRIMES.Assault, rep: AGGRESSION_REP.blow, servicesLost: true });
  assert.deepEqual(aggressionCost('protected', true), { crime: CRIMES.Murder, rep: AGGRESSION_REP.kill, servicesLost: true });
  assert.deepEqual(aggressionCost('factionMember', true), { crime: null, rep: AGGRESSION_REP.kill, servicesLost: true });
  for (const k of ['foe', 'selfDefence', 'hunting', 'aggression']) assert.deepEqual(aggressionCost(k, true), { crime: null, rep: 0, servicesLost: false }, k);
});

test('STAGE 4: killing the peaceful never pays like hunting the hostile, and the protected pay nothing', () => {
  assert.equal(killShare(t('orc-grunt')), KILL_SHARE.hostile);
  assert.equal(killShare(t('wild-rat')), KILL_SHARE.wildlife);
  assert.equal(killShare(t('orc-hunter')), KILL_SHARE.peaceful, 'turned hostile by the player, still a peaceful one');
  assert.equal(killShare(t('orc-merchant')), KILL_SHARE.protected);
  assert.ok(KILL_SHARE.peaceful < KILL_SHARE.hostile && KILL_SHARE.protected === 0);
});

test('STAGE 4: a service is offered only out of a fight and to the standing it asks; a creature with no list needs no profile', () => {
  const merchant = t('orc-merchant');
  assert.deepEqual(servicesOffered(merchant, 'friendly', 0), ['talk', 'trade']);
  assert.deepEqual(servicesOffered(merchant, 'friendly', SERVICE_REP.trade - 1), ['talk']);
  assert.deepEqual(servicesOffered(merchant, 'hostile', 50), []);
  assert.deepEqual(servicesOffered(merchant, 'fleeing', 50), []);
  assert.deepEqual(servicesOffered(t('wild-rat'), 'neutral', null), []);
});

test('STAGE 4: the Orc Stronghold is a community - its people start peaceful, and the validator refuses one that starts hostile', () => {
  const home = GROUP_TEMPLATES.find((g) => g.key === 'orc-stronghold');
  assert.ok(home?.community);
  assert.deepEqual(groupProblems(home), []);
  assert.ok(home.members.every(([k]) => effectiveDisposition(t(k), { rep: 0 }) !== 'hostile'));
  assert.deepEqual(groupProblems({ ...home, members: [...home.members, ['orc-grunt', 1]] }), ['a community\'s orc-grunt starts hostile']);
});
