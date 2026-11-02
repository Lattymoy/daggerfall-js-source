// @ts-check
// DELVE II (DLV5 and DLV6, bible/03-World/Delve-II.md section 8): THE CURATED BLOCKS' RECORDS - one JSON file a block in
// src/assets/delve/ (the lab's export, delve.html), each checked as it is listed: a record curatedBlocks.js refuses, a number
// or an id twice, stops the list by name. Number 0 is the lab's own draft and never ships.
import CRYPT_HALL from '../../assets/delve/crypt-hall.json' with { type: 'json' };
import MINE_GALLERY from '../../assets/delve/mine-gallery.json' with { type: 'json' };
import DESECRATED_CHAPEL from '../../assets/delve/desecrated-chapel.json' with { type: 'json' };
import THRONE_HALL from '../../assets/delve/throne-hall.json' with { type: 'json' };
import { curatedRecordError } from './curatedBlocks.js';

/** Each record checked, frozen. @param {readonly any[]} list */
export function checkedRecords(list) {
  const ids = new Set(),
    ns = new Set();
  return Object.freeze(
    list.map((rec) => {
      const why =
        curatedRecordError(rec) ??
        (rec.n === 0 ? "n: 0 is the lab's draft" : ids.has(rec.id) ? 'id: twice' : ns.has(rec.n) ? 'n: twice' : null);
      if (why) throw new Error(`curated block ${rec?.id ?? '?'}: ${why}`);
      ids.add(rec.id);
      ns.add(rec.n);
      return Object.freeze(structuredClone(rec));
    }),
  );
}
/** The blocks that ship, in number order (DLV6: the first four - Delve-II.md section 15). */
export const CURATED_RECORDS = checkedRecords([CRYPT_HALL, MINE_GALLERY, DESECRATED_CHAPEL, THRONE_HALL]);

/** THE LAB'S DRAFT (delve.html, the bench's `?dungeon=lab`): number 0, read beside the shipped records by the site law
 *  alone - never spliced, never in a save, never online (the bench is offline). Null clears it; a draft the law
 *  refuses is refused here, by name. */
let _draft = null;
export function setCuratedDraft(rec) {
  if (rec == null) {
    _draft = null;
    return null;
  }
  const why = curatedRecordError(rec) ?? (rec.n !== 0 ? 'n: a draft is number 0' : null);
  if (why) return why;
  _draft = Object.freeze(structuredClone(rec));
  return null;
}
/** The records the site law reads: the shipped ones, and the lab's draft while one stands. */
export const curatedRecordsLive = () => (_draft ? [...CURATED_RECORDS, _draft] : CURATED_RECORDS);
