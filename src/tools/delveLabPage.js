// @ts-check
// DELVE II (DLV5): THE LAB'S FRONT PAGE (delve.html) - the shipped curated blocks, each opened in the bench's lab; the
// drafts this browser keeps, each by its id, to resume; and a new block begun from a base and its types, kept beside them
// (world/dungeon/curatedLab.js labKeep - AUDIT DLV5-6 M6: never over a kept one) and the bench opened on it
// (`?dungeon=lab`). The game's own data is the player's, read by the bench as the game reads it.
import { CURATED_RECORDS } from '../world/dungeon/curatedRecords.js';
import { labNew, labKeep, labKept, labTypes } from '../world/dungeon/curatedLab.js';
import { DUNGEON_TYPES } from '../formats/mapsFile.js';
import { appStorage } from '../systems/appStorage.js';

const LAB = '/play/?dungeon=lab&class=1&novideo';
const $ = (id) => /** @type {any} */ (document.getElementById(id));
const item = (href, text, rest) => {
  const li = document.createElement('li');
  li.append(Object.assign(document.createElement('a'), { href, textContent: text }), rest);
  return li;
};
for (const r of CURATED_RECORDS)
  $('shipped').append(
    item(
      `${LAB}&lab=${encodeURIComponent(r.id)}`,
      r.id,
      ` - number ${r.n}, base ${r.base}, ${r.anchors.map((x) => x.kind).join(' and ') || 'no anchor'}`,
    ),
  );
const { drafts } = labKept(appStorage());
for (const d of Object.values(drafts))
  $('kept').append(
    item(
      `${LAB}&draft=${encodeURIComponent(d.id)}`,
      d.id,
      ` - base ${d.base}, ${(d.add ?? []).length} added, ${(d.anchors ?? []).length} anchor(s)`,
    ),
  );
if (!Object.keys(drafts).length)
  $('kept').append(Object.assign(document.createElement('li'), { textContent: 'none yet' }));
$('types-help').textContent = Object.entries(DUNGEON_TYPES)
  .filter(([k]) => k !== 'NoDungeon')
  .map(([k, v]) => `${v} ${k}`)
  .join(', ');
$('new').addEventListener('submit', (e) => {
  e.preventDefault();
  const id = $('id').value.trim(),
    types = labTypes($('types').value);
  if (!types) {
    $('say').textContent = 'types: the dungeon types it joins, by number (1, 2, 11)';
    return;
  }
  if (Object.hasOwn(labKept(appStorage()).drafts, id)) {
    $('say').textContent = `a draft named ${id} is kept: resume it above, or name this one otherwise`;
    return;
  }
  const draft = { ...labNew(id, $('base').value.trim().toUpperCase(), types[0]), types };
  const why = labKeep(appStorage(), draft);
  if (why) {
    $('say').textContent = why;
    return;
  }
  location.href = `${LAB}&draft=${encodeURIComponent(id)}`;
});
