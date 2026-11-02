// HOST-SPLIT: moved verbatim out of src/scenes/world.js's bootWorld (bible/01-Overview/Host-Split.md) by tools/hostMove.mjs.
// The host constructs it where the code stood. What it reads of the host's scope comes through `host`: the
// settled names by value at construction, every live one (a `let` someone writes, a `const` made below) read at its
// use as `host.<name>` - as the code read them where it was.
import { ETHER_KIND } from '../systems/wild/etherWild.js';
import { isEquipped, unequipItem } from '../systems/equip.js';
import { itemLongName } from '../systems/item/itemInfo.js';
import { playerEntity } from '../characters/playerEntity.js';
import { readWildReceipt } from '../net/wild/wildReceipt.js';
import { realmGoldAct } from '../systems/realmSaves.js';
import { revenantsWithYou } from '../systems/revenant/revenantCompanions.js';
import { seaRoomOf } from '../net/wire.js';
import { setWildDeath, wildDeath, zoneWord } from '../systems/wild/wildZone.js';
import { wildFallWords, wildPacks, wildTakeTook, wildTookAny } from '../systems/wild/wildDeath.js';

/** @param {any} host */
export function createWildDropHost(host) {
  const {
    _wildTaking, realmSession, townTalk, wildAccount, wildDeathCheckpoint, wildInsure
  } = host;
  /**
   * INT9: MY DROP, TAKEN OFF MY RECORD BY THE ACCOUNT SERVICE (server-account/src/wild.js) - against the fall the relay
   * signed (`rc`; FOE-KEEPS: a death to a foe drops nothing, and asks none). The record's own act (systems/realmSaves.js
   * realmGoldAct): checkpointed as it will rise, the service asked - naming the room my remains will lie in - and on its answer EXACTLY
   * WHAT IT TOOK taken out of my pack (systems/wild/wildDropLaw.js wildTakeTook - AUDIT INT9: this game ran the law again
   * without the ledger's word, and took what the service kept), the room given the service's records on its order
   * (wildDeposit). The answer is needed: a landed act whose answer was lost ends the session, and the join reads the record.
   */
  const wildTakeDrop = (rc, room) => {
    const key = readWildReceipt(rc)?.r;
    const body = host._wildBody;
    const lay = room ?? body?.room ?? null;
    if (!key || !realmSession || realmSession.lost || !lay || _wildTaking.has(key)) return;
    _wildTaking.add(key);
    if (_wildTaking.size > 32) _wildTaking.delete(_wildTaking.values().next().value);
    realmGoldAct({
      session: realmSession,
      checkpoint: () => wildDeathCheckpoint(),
      needsAnswer: true,
      call: (at) => wildAccount.fall({ receipt: rc, realm: at, room: lay, ...(host.online?.wildCollectAt?.(lay) ? { collect: 1 } : {}), ...wildFallWords() }),   // MAC (2026-10-14): my killer's piece into escrow where its room signs the collect; COMPANION-DROP (AUDIT FB1019f B2) and LETTERS-TENTH: the words my game applies (systems/wild/wildDeath.js wildFallWords - STORE-KEEPS retired CART-AWAY's wagon word)
      apply: (a) => wildDropTaken(a?.data ?? null, body, lay),
    }).catch((e) => console.warn('[wild] the drop failed', e?.message ?? e));
  };
  /** The service's answer to my drop: what it took off my record goes out of my pack (a worn piece unequipped), the death
   *  screen says what fell - or, risen since, a line says it - and the records go to the room on the service's order.
   *  WILD-INSURE: the pieces my policies kept are said, and those policies are spent here as on the service; REPEAT-SHIELD:
   *  a kill by the same hand inside its half hour took nothing, and says so. */
  const wildDropTaken = (d, body, room) => {
    if (!d) return;
    const out = wildTakeTook(playerEntity, d.took, d.gold, (it) => { if (isEquipped(it)) unequipItem(playerEntity, it); }, wildPacks(host.naval?.companions?.party, revenantsWithYou()));   // COMPANION-DROP: and out of my companions' packs at my side, as the service took them
    const n = Array.isArray(d.items) ? d.items.length : 0;
    const dd = wildDeath();
    const claimed = d.wi === 0 && out.length && d.took?.[0] ? itemLongName(out[0]) : null;
    // MAC (2026-10-14, the two-phase handoff): the piece my killer claimed is in the service's escrow until they collect it
    const held = d.wi === 0 && !!d.escrow?.r;
    const insured = wildInsure?.spent(d.insured) ?? 0;   // WILD-INSURE: the keys my policies kept, spent
    // PVP-NO-TENTH: the killer's one record lies for them alone, never said as dropped; the last roll's gold said
    const last = d.last ? Math.max(0, Math.floor(Number(d.gold?.purse) || 0)) + (out.letters?.gold ?? 0) : 0;
    if (dd) setWildDeath({ killer: dd.killer, kill: true, dropped: d.order ? n - (d.wi === 0 ? 1 : 0) : 0, claimed, held, burnt: d.burnt ? n : 0, letters: out, insured, shield: d.shield === true, last });   // BURNT-SAID (FIELD BUGS 2026-10-18b): a held record's drop said, and the letters by their worth
    else if (wildTookAny(out, d.gold)) townTalk.say(d.burnt ? zoneWord('burntLate', seaRoomOf(room) ? ETHER_KIND : null)() : zoneWord('dropLate', seaRoomOf(room) ? ETHER_KIND : null));   // AUDIT SEA VENTURES C7: in the words of the ground the fall was on   // AUDIT INT9: a receipt that found me risen - AUDIT FB1019f B5: a companion's coin alone said too (systems/wild/wildDeath.js wildTookAny)
    if (held) host.wildEscrow.held(d.escrow, { killer: dd?.killer ?? null, name: claimed });
    if (d.order && n && body) host.wildDeposit({ r: d.r, items: d.items, o: d.order, p: body.p, room, mine: body });
  };
  return { wildTakeDrop };
}
