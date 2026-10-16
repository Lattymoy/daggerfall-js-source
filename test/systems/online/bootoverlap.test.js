// BOOT-OVERLAP (2026-10-12, a player's launch into the world captured from the live client; bible/07-Rendering/
// Performance-Priority.md BOOT-OVERLAP) - THE BOOT'S NETWORK, ASKED BESIDE ITS WORK. From the character's click to the
// boot's last step the main thread waited on the network 7.5 s of 12.2: the realm's lines and then its roster one after
// the other, the homes' layouts only after the data's read, and each town the boot builds waiting on its homes in turn.
// The lines and the roster are asked at once and read behind the boot, waited for where Project Legacy's host is made;
// the layouts go out above the data's read; the towns the boot builds (its start and a realm save's own place) are asked
// at once as the save's character - `onlineHomes.ensure`'s `character`, so the tenancies that ride the answer are the
// ones the arrival would have asked for.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createOnlineHomes } from '../../../src/systems/online/onlineHomes.js';
import { hostText } from '../../hostText.mjs';   // HOST-SPLIT 2 (AUDIT, the second read): its negatives read the host whole

const src = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');

/** A homes door that records each town asked and answers it when told (`answer()`), as the service would. */
function door() {
  const asked = [];
  const waiting = [];
  return {
    asked,
    answer: () => { for (const w of waiting.splice(0)) w({ ok: true, data: { homes: [{ buildingKey: 7, owner: 'Ann', mine: false }] } }); },
    town: (mapId, character) => { asked.push([mapId, character]); return new Promise((res) => waiting.push(res)); },
  };
}

test('BOOT-OVERLAP ensure asks as the character named, or as the one playing when none is named - null named is none, and the town known once answered (mutants: the named character ignored, the playing one never asked)', async () => {
  const api = door();
  const homes = createOnlineHomes({ api, character: () => 'playing' });
  const a = homes.ensure(1001, { character: 'realm-7' });
  const b = homes.ensure(1002);
  const c = homes.ensure(1003, { character: null });
  await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(api.asked, [[1001, 'realm-7'], [1002, 'playing'], [1003, null]]);
  api.answer();
  assert.deepEqual(await Promise.all([a, b, c]), [true, true, true]);
  assert.equal(homes.homesIn(1001)?.get(7)?.owner, 'Ann');
});

test('BOOT-OVERLAP a town the boot asked early is the build\'s - a build that waits on it while it flies, or asks it once answered, asks nothing again (mutants: the build asking a second time)', async () => {
  const api = door();
  const homes = createOnlineHomes({ api, character: () => 'playing' });
  const early = homes.ensure(2001, { character: 'realm-7' });
  await Promise.resolve(); await Promise.resolve();
  const build = homes.waitFor(2001, 5_000);   // the build's wait, as world.js buildPixel waits on a town never heard
  api.answer();
  assert.equal(await early, true);
  assert.equal(await build, true);
  assert.equal(homes.known(2001), true);
  await homes.ensure(2001);   // a build of a town heard: fresh, nothing asked
  assert.deepEqual(api.asked, [[2001, 'realm-7']]);
});

test('BOOT-OVERLAP the boot, by source: the realm\'s lines and roster asked at once at the join and waited for where Project Legacy\'s host is made; the homes\' door and its layouts ask above the data\'s read, once `online` is settled; the towns the boot builds asked at once as the realm save\'s character, after the start is known (mutants: the lines unawaited, the roster awaited at the join, the layouts asked at the first build, the towns unasked, the save\'s town unread, the character unnamed)', () => {
  const w = hostText('src/scenes/world.js');
  assert.match(w, /const legacyRealmRead = legacyRealmLine \? Promise\.all\(\[\n\s+legacyRealmLine\.pull\(\)\.catch\([^\n]*\n\s+realmList\(realmIoNow\(\)\)\.catch\(\(\) => null\)\.then\(\(listed\) => \{ if \(listed\?\.ok\) legacyRealmRoster = /);
  assert.doesNotMatch(w, /await legacyRealmLine\.pull\(\)|await realmList\(realmIoNow\(\)\)/, 'nothing of it waited at the join');
  assert.match(w, /if \(legacyRealmRead\) \{\n\s+if \(!legacyRealmHeard\) status\('Reading the family'\);\n\s+await legacyRealmRead;\n\s+\}\n\s+legacyHost = createLegacyHost\(\{/);
  const homesAt = w.indexOf("const homesApi = params.has('online') ? accountHomes(");
  assert.ok(homesAt > w.indexOf("if (testRoomOffline) { params.delete('online'); publishBootParams(params); }") && homesAt > w.indexOf("if (realmRefused) { params.delete('online'); publishBootParams(params); }"), 'built once `online` is settled');
  assert.match(w, /const bootHomeLayoutsAsk = homesApi \? homesApi\.layouts\(\)\.catch\(\(\) => null\) : null;\n\s+status\('loading data'\);/);
  assert.match(w, /let _homeLayoutsAsk = bootHomeLayoutsAsk;/);
  const towns = w.indexOf('if (onlineHomes && realmBoot && bootSnapRead) {');
  assert.ok(towns > w.indexOf('const startPixel = longitudeLatitudeToMapPixel('), 'after the start is known');
  assert.ok(towns < w.indexOf("status(`building player pixel ${startPixel.x},${startPixel.y}`);"), 'before the first build');
  assert.match(w, /const at = bootSnapRead\.locationKey === 'world' \? bootSnapRead\.world\?\.pixel : null;\n\s+const saved = at \? locationIndex\.get\(`\$\{at\.x\},\$\{at\.y\}`\) : null;\n\s+const as = typeof bootSnapRead\.characterId === 'string' \? bootSnapRead\.characterId : null;\n\s+for \(const loc of new Set\(\[startLoc, saved\]\)\) if \(loc\?\.mapTableData\) onlineHomes\.ensure\(loc\.mapTableData\.mapId, \{ character: as \}\)\.catch\(\(\) => \{\}\);/);
});
