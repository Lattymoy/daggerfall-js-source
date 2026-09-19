import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { restorePlayer, snapshotPlayer } from '../src/systems/save.js';
import { respawnHealth } from '../src/systems/deathRespawn.js';

// ONLINE-DEATH-FIX: (1) an online death always respawns - never the death video / title menu - and
// (2) a save is never LOADED at 0 HP online (a character restored dead can never die again: hurtPlayer
// fires the death only on the alive->0 transition, so it stood at 0% and unkillable).

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

const withSearch = (search, fn) => {
  const had = Object.getOwnPropertyDescriptor(globalThis, 'location');
  Object.defineProperty(globalThis, 'location', { value: { search, pathname: '/' }, configurable: true, writable: true });
  try { return fn(); } finally {
    if (had) Object.defineProperty(globalThis, 'location', had); else delete globalThis.location;
  }
};

/** A minimal saved character, dead or alive, as the real snapshot composes it. */
const savedAt = (health) => {
  const e = {
    name: 'Tester', health, maxHealth: 80, magicka: 10, maxMagicka: 10, fatigue: 100,
    stats: { strength: 50, endurance: 50 }, skills: [], skillUses: [], items: [], career: {},
  };
  const snap = snapshotPlayer(e, {});
  return { snap, fresh: () => ({ items: [], stats: {}, activeEffects: [] }) };
};

test('ONLINE-DEATH-FIX: an ONLINE page loading a 0 HP save comes back at the respawn health, not dead', () => {
  const { snap, fresh } = savedAt(0);
  const entity = fresh();
  withSearch('?online=1&load=1', () => assert.ok(restorePlayer(entity, snap)));
  assert.equal(entity.health, respawnHealth(80));
  assert.ok(entity.health > 0);
});

test('ONLINE-DEATH-FIX: an online load of a LIVING save is untouched', () => {
  const { snap, fresh } = savedAt(37);
  const entity = fresh();
  withSearch('?online=1&load=1', () => restorePlayer(entity, snap));
  assert.equal(entity.health, 37);
});

test('ONLINE-DEATH-FIX: OFFLINE is unchanged - a 0 HP save loads as saved', () => {
  const { snap, fresh } = savedAt(0);
  const entity = fresh();
  withSearch('?load=1', () => restorePlayer(entity, snap));
  assert.equal(entity.health, 0);
});

test('ONLINE-DEATH-FIX by source: the online-death predicate is the PAGE flag first, and the modal hosts\' reset never reads "no snapshot yet" as offline', () => {
  const w = read('src/scenes/world.js');
  assert.match(w, /const _onlineWorldSession = \(\) => onlineOn \|\| /);
  assert.match(w, /if \(!\(_deathWasOnline \?\? _onlineWorldSession\(\)\)\) return false;/);
  assert.ok(w.indexOf('const onlineOn = params.has') < w.indexOf('const _onlineWorldSession'), 'onlineOn is declared before the predicate reads it');
});
