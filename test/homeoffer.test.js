// HOME-OFFER (2026-09-26, Mac: "Enhanced plus cant buy house"): HOME1 put a house's offer (and its owner's menu)
// behind Info mode alone. Nothing on the enhanced skins says so - the mode is a drawn word, the default is Grab
// (PlayerActivate.cs:70) - so a player the bank told "a home is bought at its own front door" pressed the door and
// walked in. The offer asks now in any mode but Steal, once a session per house (a No is remembered; Info always
// asks); the owner's menu stays Info's, since an owner's press is the way in.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { homeDoorPrompt } from '../src/systems/onlineHomes.js';
import { MODES, getInteractionMode } from '../src/player/interactionMode.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const forSale = (mode, more = {}) => homeDoorPrompt({ door: 'none', mode, price: 12800, ...more });

test('HOME-OFFER: a house for sale asks in the mode a player stands in by default - Grab - and in Talk and Info; never in Steal', () => {
  assert.equal(getInteractionMode(), 'grab', 'the default mode (PlayerActivate.cs:70)');
  assert.equal(forSale(getInteractionMode()), 'offer', 'the press that found nothing before');
  assert.equal(forSale('dialogue'), 'offer');
  assert.equal(forSale('info'), 'offer');
  assert.equal(forSale('steal'), null, 'a thief is not shopping - the door opens by Daggerfall\'s law');
  assert.deepEqual([...MODES].sort(), ['dialogue', 'grab', 'info', 'steal'], 'every mode is named above');
});

test('HOME-OFFER: a No is remembered for that house - Grab and Talk go straight in after it; Info always asks', () => {
  assert.equal(forSale('grab', { declined: true }), null, 'asked once');
  assert.equal(forSale('dialogue', { declined: true }), null);
  assert.equal(forSale('info', { declined: true }), 'offer', 'Info is the way to be asked again');
});

test('HOME-OFFER: nothing asks on the onward press, a bash, a house not for sale, or someone else\'s home', () => {
  assert.equal(forSale('grab', { asked: true }), null, 'the No and Go-in presses come back to the door past the box');
  assert.equal(forSale('info', { asked: true }), null);
  assert.equal(forSale('grab', { isBash: true }), null, 'a bash is a bash');
  assert.equal(homeDoorPrompt({ door: 'none', mode: 'info', price: 0 }), null, 'not for sale (a quest is set in it, or no candidate)');
  assert.equal(homeDoorPrompt({ door: 'none', mode: 'grab' }), null, 'no price, no offer');
  for (const door of ['open', 'locked']) {
    for (const mode of MODES) assert.equal(homeDoorPrompt({ door, mode, price: 12800 }), null, `${door} in ${mode}: another's home is not for sale`);
  }
});

test('HOME-OFFER: the owner\'s menu is Info\'s alone - in every other mode the owner\'s press is the way in', () => {
  assert.equal(homeDoorPrompt({ door: 'own', mode: 'info' }), 'menu');
  for (const mode of ['grab', 'dialogue', 'steal']) assert.equal(homeDoorPrompt({ door: 'own', mode }), null, mode);
  assert.equal(homeDoorPrompt({ door: 'own', mode: 'info', asked: true }), null, 'Go in comes back past the menu');
});

test('HOME-OFFER by source: the door asks what the prompt says in the mode the player stands in, and the offer\'s No - alone - remembers the house', () => {
  const m = rd('src/scenes/worldModes.js');
  assert.match(m, /const prompt = homeDoorPrompt\(\{ door, mode: getInteractionMode\(\), price, declined: _homeDeclined\.has\(homeKeyOf\(bd\)\), asked: homeAsked, isBash \}\);/);
  assert.match(m, /const _homeDeclined = new Set\(\);\n  const homeKeyOf = \(b\) => `\$\{homeTownOf\(b\)\}:\$\{b\?\.buildingKey \?\? 0\}`;/, 'a house is its own town\'s building');
  const offer = m.slice(m.indexOf('function openHomeOffer('), m.indexOf('\n  }\n', m.indexOf('function openHomeOffer(')));
  assert.match(offer, /\{ code: 'KeyN', label: 'N - no', action: \(\) => \{ _homeDeclined\.add\(homeKeyOf\(bd\)\); homeOnward\(hit, entries\)\(\); \} \},/, 'No: remembered, then on through the door');
  assert.doesNotMatch(offer.slice(offer.indexOf("code: 'KeyY'"), offer.indexOf("code: 'KeyN'")), /_homeDeclined/, 'a Yes is not a No');
  assert.equal((m.match(/_homeDeclined\.add\(/g) ?? []).length, 1, 'nothing else declines for the player');
});
