// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { MODELS, isModel, foundFamily, newPerson, currentOf } from '../../src/systems/legacy/family.js';
import { legacySettings } from '../../src/systems/legacy/settings.js';
import { payToll, tollLine } from '../../src/systems/legacy/age.js';
import { createLegacyHost, LEGACY_TEXT } from '../../src/scenes/legacyHost.js';
import { modelWord, modelLine } from '../../src/ui/familyPages.js';
import { legacyModelOptions } from '../../src/ui/legacy/legacyModelChoice.js';
import { setModSetting, _resetModSettings } from '../../src/systems/modSettings.js';
import { _resetModSaveData } from '../../src/systems/modSaveData.js';

const mem = () => {
  const m = new Map();
  return {
    map: m,
    get length() { return m.size; },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
  };
};

const ent = (cid, over = {}) => ({
  name: 'Breton Hero', gender: 'male', race: 'Breton', faceIndex: 1, careerIndex: 0,
  career: { name: 'Mage', primarySkills: [], majorSkills: [], minorSkills: [] },
  level: 1, characterId: cid, chargenDone: true, health: 50, maxHealth: 50, items: [], wagonItems: [],
  stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 },
  skills: Array.from({ length: 35 }, () => 30), ...over,
});

test('LEGACY DYNASTY: model definition, settings and UI words', () => {
  _resetModSettings();
  assert.equal(MODELS.dynasty, 'dynasty');
  assert.ok(isModel(MODELS.dynasty));

  setModSetting('project-legacy', 'Legacy.Model', 2);
  const s = legacySettings();
  assert.equal(s.model, MODELS.dynasty);
  assert.equal(s.tollShare, 0, 'Dynasty toll share is always 0');

  assert.equal(modelWord(MODELS.dynasty), 'Dynasty');
  assert.match(modelLine(MODELS.dynasty), /without permadeath or lost years/);

  const opts = legacyModelOptions({ online: false, includeDynasty: true });
  assert.ok(opts.some((o) => o.id === MODELS.dynasty), 'Dynasty option present when included');

  const foundedLine = LEGACY_TEXT.founded('Dirennis', MODELS.dynasty);
  assert.match(foundedLine, /Dynasty, where death costs no years and permadeath never claims you/);
});

test('LEGACY DYNASTY: payToll takes no years and never marks spent/final', () => {
  const person = newPerson(1);
  person.race = 'Breton';
  person.toll = 0;
  person.lived = 0;

  const res = payToll(person, 0, 0, { dynasty: true });
  assert.equal(res.final, false);
  assert.equal(res.years, 0);
  assert.equal(res.spent, false);
  assert.equal(person.toll, 0, 'no years added to person.toll');

  const line = tollLine('Hero', res);
  assert.match(line, /rises to carry on the family name/);
});

test('LEGACY DYNASTY: death under Respawn mode (online or offlineRespawn: true) rises with 0 toll and no permadeath', () => {
  _resetModSaveData();
  _resetModSettings();
  setModSetting('project-legacy', 'Legacy.Model', 2);

  const storage = mem();
  const entity = ent('c1');
  const host = createLegacyHost({
    entity, storage: () => storage, tab: () => mem(), on: () => true, online: () => false,
    offlineRespawn: () => true, now: () => 100, own: () => 100, here: () => ({ x: 0, y: 0, mapId: 1 }),
    town: () => 'Daggerfall', nearestTown: () => 'Daggerfall', gold: () => 100, say: () => {}, boot: () => {},
    search: () => '', loadCharacter: () => false, saveNow: () => true, inFight: () => false, rng: () => 0.5,
  });

  const fam = host.found();
  assert.equal(fam.model, MODELS.dynasty);

  const out = host.onDeath();
  assert.equal(out.kind, 'rise');
  assert.match(out.line, /rises to carry on the family name/);
  assert.equal(host.willRise(), true);

  const p = currentOf(host.family);
  assert.equal(p.toll | 0, 0, 'toll remains 0');
  assert.equal(p.died, null, 'person is not dead');
});

test('LEGACY DYNASTY: death under Classic Save/Load mode (offlineRespawn: false) does not record permadeath', () => {
  _resetModSaveData();
  _resetModSettings();
  setModSetting('project-legacy', 'Legacy.Model', 2);

  const storage = mem();
  const entity = ent('c1');
  const host = createLegacyHost({
    entity, storage: () => storage, tab: () => mem(), on: () => true, online: () => false,
    offlineRespawn: () => false, now: () => 100, own: () => 100, here: () => ({ x: 0, y: 0, mapId: 1 }),
    town: () => 'Daggerfall', nearestTown: () => 'Daggerfall', gold: () => 100, say: () => {}, boot: () => {},
    search: () => '', loadCharacter: () => false, saveNow: () => true, inFight: () => false, rng: () => 0.5,
  });

  host.found();
  const out = host.onDeath();
  assert.equal(out.kind, 'none', 'host stands aside for standard DFU save/load death screen');
  assert.equal(host.past, null, 'person is not marked as past');

  const p = currentOf(host.family);
  assert.equal(p.died, null, 'person is not marked dead');
});

test('LEGACY DYNASTY: voluntary mantle pass is allowed without requiring isElder', () => {
  _resetModSaveData();
  _resetModSettings();
  setModSetting('project-legacy', 'Legacy.Model', 2);

  const storage = mem();
  const entity = ent('c1');
  const host = createLegacyHost({
    entity, storage: () => storage, tab: () => mem(), on: () => true, online: () => false,
    offlineRespawn: () => true, now: () => 100, own: () => 100, here: () => ({ x: 0, y: 0, mapId: 1 }),
    town: () => 'Daggerfall', nearestTown: () => 'Daggerfall', gold: () => 100, say: () => {}, boot: () => {},
    search: () => '', loadCharacter: () => false, saveNow: () => true, inFight: () => false, rng: () => 0.5,
  });

  host.found();
  assert.equal(host.mantleRefusal(), null, 'non-elder in Dynasty can pass mantle voluntarily');

  const r = host.passMantle();
  assert.equal(r.ok, true);
  assert.equal(r.outcome.kind, 'fall');
  assert.equal(host.family.pending != null, true);
});
