// S25 LIVE PROBE: the faction reputation store through the REAL chargen
// seam and the REAL crime path, on the real FACTION.TXT.
// Usage: ARENA2_PATH=... node tools/factionRepProbe.mjs
import { readFileSync } from 'node:fs';
import { FactionFile } from '../src/formats/factionFile.js';
import { finishChargen, loadCareers } from '../src/systems/chargenSession.js';
import { lowerRepForCrime, REPUTATION_LOSS_PER_CRIME, CRIMES } from '../src/systems/court.js';
import { getReputation } from '../src/systems/factionRep.js';
import { getPeopleOfCurrentRegion } from '../src/systems/talk.js';

const A = process.env.ARENA2_PATH;
const careers = await loadCareers(async (n) => readFileSync(A + '/' + n));
const ff = new FactionFile();
ff.load(readFileSync(process.env.ARENA2_PATH + '/FACTION.TXT'));
const dict = ff.factionDict;

const entity = { isPlayer: true, level: 1, stats: {}, skills: 30, items: [], armorValues: null };
const result = {
  name: 'Probe', gender: 'male', race: 'Breton', raceId: 1, faceIndex: 0,
  careerIndex: 0, career: careers[0].career, stats: { strength: 50, endurance: 50, willpower: 50, agility: 50, intelligence: 50, personality: 50, speed: 50, luck: 50 },
  skills: {}, reflexes: 2, biographyEffects: ['rf42 20'], factionDict: dict,
};
finishChargen(entity, result, null);
console.log('store attached:', !!entity.factionRep, '| factions:', entity.factionRep?.dict.size);
console.log('pendingFactionRep drained:', JSON.stringify(entity.pendingFactionRep));
console.log('faction 42 rep after rf42 +20:', getReputation(entity.factionRep, 42));
const f42 = dict.get(42);
console.log('  42 is', f42?.name, '| allies', [f42?.ally1,f42?.ally2,f42?.ally3].filter(Boolean).join(','));
for (const a of [f42?.ally1, f42?.ally2, f42?.ally3].filter(Boolean))
  console.log('  ally', a, dict.get(a)?.name, '->', getReputation(entity.factionRep, a), '(expect +10)');

// now a crime in region 17
const REGION = 17;
const people = getPeopleOfCurrentRegion(entity.factionRep.dict, REGION);
console.log('\nPeople of region', REGION + ':', people?.id, people?.name);
entity.regionData = Array.from({length: 62}, () => ({ legalRep: 0 }));
const before = getReputation(entity.factionRep, people.id);
lowerRepForCrime(entity, REGION, CRIMES.Murder);
const after = getReputation(entity.factionRep, people.id);
const loss = REPUTATION_LOSS_PER_CRIME[CRIMES.Murder];
console.log('Murder (crime ' + CRIMES.Murder + ') loss:', loss, '| People rep', before, '->', after, '| delta', after-before, '| expect', -Math.trunc(loss/2));
console.log('legalRep region 17:', entity.regionData[REGION].legalRep, '| expect', -loss);
