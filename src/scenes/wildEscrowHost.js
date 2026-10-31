// @ts-check
// THE TWO-PHASE HANDOFF (PVP-ESCROW; MAC'S DECISION, 2026-10-14: "the fallen must lose the worn piece only once the
// killer actually has it" - bible/11-Multiplayer/Wild-Zone.md section 4): server-account/src/wild.js holds the killer's
// piece in ESCROW from the fall. Both sides of it on this page - my pieces held, asked back once my killer can no longer
// collect them, and my collects carried to the service - moved out of bootWorld as they stood (HOST-SPLIT, FIELD BUGS
// 2026-10-15c: the merge of main beside the 2026-10-14 roll-up had put bootWorld 55 code lines past its ceiling).
// The host hands in what it holds: its talk, the realm's session, the modes, the zone's account door and the
// checkpoint; it calls `held` from the drop's receipt, `collectHeard` from the room's collect, `frame` from the zone's.
import { WILD_TEXT } from '../systems/wild/wildZone.js';
import { itemLongName } from '../systems/item/itemInfo.js';
import { validLootList } from '../systems/loot/loot.js';
import {
  addItem,
  addGoldPieces,
  isGoldPieces,
  carriedWeight,
  LETTER_OF_CREDIT_TEMPLATE,
} from '../systems/inventory.js';
import { entityMaxEncumbrance } from '../combat/formulas.js'; // PVP-REWARD: the weight a policy's gold must fit
import { realmGoldAct } from '../systems/realmSaves.js';
import { DeathScreen } from '../ui/deathScreen.js';
import { playerEntity } from '../characters/playerEntity.js';

/**
 * @param {{ townTalk: any, session: any, modes: () => any, wildAccount: any, checkpoint: () => any }} deps
 */
export function createWildEscrowHost({ townTalk, session, modes, wildAccount, checkpoint }) {
  /** MY PIECES IN ESCROW (the fallen's side): r -> { name, killer, due, tries, busy } - each watched by the zone's frame and
   *  taken back into my record once my killer can no longer collect it (wildReclaim), or told collected. A game closed
   *  while one is held asks the service for its own at its next play (`_wildEscrowsAsked`). */
  const _wildEscrows = new Map();
  let _wildEscrowsAsked = false;
  const wildEscrowHeld = (e, { killer = null, name = null, say = true } = {}) => {
    if (!e?.r || _wildEscrows.has(e.r)) return;
    const shown = name ?? (e.rec ? itemLongName(validLootList([e.rec])?.[0] ?? e.rec) : null);
    const dueMs = Number.isFinite(e.back) ? e.back * 1000 : Date.now(); // the service's second; a skewed clock is answered `escrow-wait`
    _wildEscrows.set(e.r, { name: shown, killer, due: Math.max(Date.now(), dueMs), tries: 0, busy: false });
    if (say) townTalk.say(WILD_TEXT.heldNote(killer, shown, Math.max(1, Math.ceil((dueMs - Date.now()) / 60_000))));
  };
  /** MY KILLER'S COLLECTS (the killer's side): r -> { cr, tries, due, busy } - the room's signed collect of the piece I picked,
   *  carried to the service as an act on my record (wildCollect); the piece comes in its answer. */
  const _wildCollects = new Map();
  const wildCollectHeard = (cr, at) => {
    if (at?.r && !_wildCollects.has(at.r)) _wildCollects.set(at.r, { cr, tries: 0, due: 0, busy: false });
  };
  const wildCollected = (d) => {
    if (!d || d.again) return; // collected already: my record (and the pack it loaded) holds it
    const item = validLootList([d.item])?.[0] ?? null;
    if (!item) return;
    // PVP-REWARD: a policy's gold comes as coin, or as a letter of credit where the coin would overweight me
    if (isGoldPieces(item)) addGoldPieces(playerEntity, item.stackCount ?? 1);
    else addItem((playerEntity.items ??= []), item);
    // PVP-NO-TENTH: the last roll's gold (`last`) said as its own
    const words = d.last ? [WILD_TEXT.lastGold, WILD_TEXT.lastLetter] : [WILD_TEXT.policyGold, WILD_TEXT.policyLetter];
    townTalk.say(
      isGoldPieces(item)
        ? words[0](item.stackCount ?? 1)
        : item.templateIndex === LETTER_OF_CREDIT_TEMPLATE
          ? words[1](item.value ?? 0)
          : WILD_TEXT.collected(itemLongName(item)),
    );
  };
  const wildEscrowBack = (r, d) => {
    const e = _wildEscrows.get(r);
    _wildEscrows.delete(r);
    if (!d || d.again) return; // back already: my record (and the pack it loaded) holds it
    const item = validLootList([d.item])?.[0] ?? null;
    if (item) addItem((playerEntity.items ??= []), item);
    townTalk.say(WILD_TEXT.heldBack(item ? itemLongName(item) : (e?.name ?? null)));
  };
  /** The zone's frame: an escrow due is asked back, a collect heard is carried - each an act on my record, alive, one at a
   *  time each, a word that says nothing asked again on its own clock. */
  const wildEscrowFrame = () => {
    if (!session || session.lost) return;
    if (!_wildEscrowsAsked) {
      _wildEscrowsAsked = true;
      wildAccount
        .escrows({ character: session.id })
        .then((a) => {
          for (const e of (a?.ok ? a.data?.escrows : null) ?? []) wildEscrowHeld(e, { say: false });
        })
        .catch(() => {
          _wildEscrowsAsked = false;
        });
    }
    if (!(playerEntity.health > 0) || modes()?.deathUp?.() || townTalk.overlay instanceof DeathScreen) return; // an act on my record, never on a dead frame
    const now = Date.now();
    const again = (/** @type {any} */ res) =>
      !res?.unknown && ['offline', 'server', 'rate', 'no-session'].includes(res?.error); // an outcome unknown is the session's own to settle (realmSaves.js)
    for (const [r, e] of _wildEscrows) {
      if (e.busy || now < e.due) continue;
      e.busy = true;
      realmGoldAct({
        session,
        checkpoint: () => checkpoint(),
        needsAnswer: true,
        call: (at) => wildAccount.reclaim({ r, realm: at }),
        apply: (a) => wildEscrowBack(r, a?.data ?? null),
      })
        .then((res) => {
          e.busy = false;
          if (res?.ok) return;
          if (res?.error === 'escrow-collected') {
            _wildEscrows.delete(r);
            townTalk.say(WILD_TEXT.heldTaken(e.killer, e.name));
            return;
          }
          if (res?.error === 'escrow-wait') {
            e.due = Date.now() + Math.max(1, res.wait ?? 30) * 1000 + 1_000;
            return;
          }
          if (again(res) && e.tries < 8) {
            e.tries++;
            e.due = Date.now() + 15_000 * e.tries;
            return;
          }
          _wildEscrows.delete(r); // nothing of mine there (taken back already, another tab's), or the session's own end
        })
        .catch(() => {
          e.busy = false;
          e.tries++;
          e.due = Date.now() + 30_000;
        });
    }
    for (const [r, c] of _wildCollects) {
      if (c.busy || now < c.due) continue;
      c.busy = true;
      realmGoldAct({
        session,
        checkpoint: () => checkpoint(),
        needsAnswer: true,
        call: (at) =>
          wildAccount.collect({
            receipt: c.cr,
            realm: at,
            free: entityMaxEncumbrance(playerEntity) - carriedWeight(playerEntity),
          }),
        apply: (a) => wildCollected(a?.data ?? null),
      })
        .then((res) => {
          c.busy = false;
          if (res?.ok) {
            _wildCollects.delete(r);
            return;
          }
          if (again(res) && c.tries < 8) {
            c.tries++;
            c.due = Date.now() + 5_000 * c.tries;
            return;
          }
          _wildCollects.delete(r);
          if (['escrow-late', 'escrow-returned', 'escrow-collected'].includes(res?.error))
            townTalk.say(WILD_TEXT.collectLate());
        })
        .catch(() => {
          c.busy = false;
          c.tries++;
          c.due = Date.now() + 30_000;
        });
    }
  };
  return { held: wildEscrowHeld, collectHeard: wildCollectHeard, frame: wildEscrowFrame };
}
