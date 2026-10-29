// @ts-check
// DELVE II (DLV5): THE LAB'S FRONT PAGE (delve.html) - the shipped curated blocks, each opened in the bench's lab, and a
// new block begun from a base and a type: its draft kept in this browser (world/dungeon/curatedLab.js LAB_DRAFT_KEY) and
// the bench opened on it (`?dungeon=lab`). The game's own data is the player's, read by the bench as the game reads it.
import { CURATED_RECORDS } from '../world/dungeon/curatedRecords.js';
import { curatedRecordError } from '../world/dungeon/curatedBlocks.js';
import { labNew, LAB_DRAFT_KEY } from '../world/dungeon/curatedLab.js';
import { DUNGEON_TYPES } from '../formats/mapsFile.js';

const LAB = '/play/?dungeon=lab&class=1&novideo';
const $ = (id) => /** @type {any} */ (document.getElementById(id));
for (const r of CURATED_RECORDS) {
  const a = Object.assign(document.createElement('a'), { href: `${LAB}&lab=${encodeURIComponent(r.id)}`, textContent: r.id });
  const li = document.createElement('li');
  li.append(a, ` - number ${r.n}, base ${r.base}, ${r.anchors.map((x) => x.kind).join(' and ') || 'no anchor'}`);
  $('shipped').append(li);
}
for (const [k, v] of Object.entries(DUNGEON_TYPES)) if (k !== 'NoDungeon') $('type').append(Object.assign(document.createElement('option'), { value: String(v), textContent: k }));
$('new').addEventListener('submit', (e) => {
  e.preventDefault();
  const draft = labNew($('id').value.trim(), $('base').value.trim().toUpperCase(), Number($('type').value));
  const why = curatedRecordError(draft);
  if (why) { $('say').textContent = why; return; }
  try { localStorage.setItem(LAB_DRAFT_KEY, JSON.stringify(draft)); } catch { $('say').textContent = 'This browser keeps no storage: the lab needs it.'; return; }
  location.href = LAB;
});
