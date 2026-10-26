// @ts-check
// ═══════════════════════════════════════════════════════════════════
// CRAFT-WRITS (2026-10-22; bible/06-Systems/Professions-Arc.md section 49): THE WORK TAB'S CRAFTING WRITS, HANDED OVER
// FROM THE PACK. The law is src/net/craftWritLaw.js, the service server-account/src/craftWrits.js; this is the host's
// half - what the pack holds toward a writ, and its goods out of the pack inside the realm act that takes them out of the
// record (systems/realmSaves.js realmGoldAct: the save checkpointed first, the goods out as the service is first asked,
// back on a refusal; silence ends the session and a join reads the record - the disenchant's own order).
//
// THE FOUR HOSTS. The Notice Board's Work tab is scenes/world.js's (its `work` names this host); worldModes.js and
// dungeonContext.js stand inside world.js's page and open no board of their own;
// scenes/exterior.js - FLAGGED: the fixed-city bench never goes online, so it posts no crafting writ, as no Court writ.
// ═══════════════════════════════════════════════════════════════════

import { realmGoldAct } from '../systems/realmSaves.js';
import { craftGoodsPick, craftGoodsHeld, pieceOf } from '../net/craftWritLaw.js';
import { recordCount } from '../net/realm/realmTradeLaw.js';

/**
 * @param {{ player: () => any, session: () => any, checkpoint: () => any, saved: () => void, book: () => any }} deps
 *   `player` the playing entity (its `items` the pack), `session` the realm session (null offline), `checkpoint` the
 *   host's realm checkpoint, `saved` the save's own "changed", `book` the professions' book (net/profBook.js)
 */
export function createCraftWritHost({ player, session, checkpoint, saved, book }) {
  /** A dish or kit writ's pieces the pack holds that may go (craftWritLaw.js pieceOf - AUDIT CRAFT-WRITS C9: never a worn,
   *  bound or locked one, which the pick would refuse after the card offered it) - the service's list of the character's
   *  own (`w.pieces`), in pack order. */
  const piecesOf = (/** @type {any} */ w) => {
    const ok = new Set(Array.isArray(w?.pieces) ? w.pieces : []);
    return (player()?.items ?? []).filter((it) => ok.has(it?.provenance) && pieceOf(it, w.product)).map((it) => String(it.provenance));
  };
  return {
    /**
     * WHAT THE CHARACTER HOLDS TOWARD A WRIT: `pack` its goods in the pack that may go, `made` what the service counts as
     * its own (a potion writ's witnessed brews not yet given, a piece writ's own pieces in the pack), `ready` whether
     * both cover the count.
     * @param {any} w
     */
    held(w) {
      if (w?.kind === 'potion') {
        const pack = craftGoodsHeld(player()?.items ?? [], w);
        const made = Math.max(0, Number(w.brewed) || 0);
        return { pack, made, ready: pack >= w.qty && made >= w.qty };
      }
      const made = piecesOf(w).length;
      return { pack: craftGoodsHeld(player()?.items ?? [], w), made, ready: made >= w.qty };
    },
    /**
     * A WRIT DELIVERED: its goods picked from the pack as the service picks them from the record (craftWritLaw.js
     * craftGoodsPick - the plain bottles before the Potent, a dish's or kit's own pieces), taken out as the service is
     * first asked, put back where they stood on its refusal - and on an `ok` that moved no record (AUDIT CRAFT-WRITS C1: a
     * request answered again, `repeat` with no `realm` - the goods it took out were never the record's to lose). Answers
     * the service's answer (`{ ok, data }`, `landed` for an act that landed with its answer lost) or `{ ok: false, error }`.
     * @param {any} w
     */
    async deliver(w) {
      const p = player();
      const pack = p?.items;
      const s = session();
      if (!s || !Array.isArray(pack)) return { ok: false, error: 'realm-needed' };
      const pieces = w.kind === 'potion' ? null : piecesOf(w).slice(0, w.qty);
      const pick = craftGoodsPick(pack, w, pieces);
      if (!pick) return { ok: false, error: w.kind === 'potion' ? 'craft-goods-gone' : 'craft-pieces' };
      // AUDIT CRAFT-WRITS C9: the records out from the last index first, and back from the first - each where it stood
      const took = pick.map(({ at, n }) => ({ rec: pack[at], at, n, whole: recordCount(pack[at]) <= n })).sort((a, b) => b.at - a.at);
      const here = () => player() === p && p.items === pack;
      let out = false;
      const takeOut = () => {
        for (const t of took) {
          if (t.whole) { const i = pack.indexOf(t.rec); if (i >= 0) pack.splice(i, 1); } else t.rec.stackCount = recordCount(t.rec) - t.n;
        }
        out = true;
      };
      const putBack = () => {
        if (!out) return;
        for (const t of [...took].reverse()) {
          if (t.whole) { if (!pack.includes(t.rec)) pack.splice(Math.min(t.at, pack.length), 0, t.rec); } else t.rec.stackCount = recordCount(t.rec) + t.n;
        }
        out = false;
      };
      let r;
      try {
        r = await realmGoldAct({
          session: s, checkpoint: () => { if (here()) checkpoint(); },
          reserve: () => putBack,
          apply: (/** @type {any} */ a) => { if (a.data?.repeat && a.data?.realm == null) putBack(); },   // C1
          call: (at) => {
            if (!here()) return Promise.resolve({ ok: false, error: 'elsewhere', elsewhere: true });
            if (!out) takeOut();
            return book().craftDeliver(w.id, pieces, at);
          },
        });
      } catch (e) {
        putBack();   // C9: a throw before the service was asked (the book gone) - the goods were never the record's
        console.warn('[craft writ] the delivery would not ask', e);
        return { ok: false, error: 'offline' };
      }
      if (r?.ok) saved();
      // AUDIT CRAFT-WRITS C4: a realm act that LANDED (its answer lost, the record one on) says no track and no Renown - the
      // state read again now (the disenchant's own, AUDIT PROF-541 R2-C1)
      if (r?.ok && !r.data) Promise.resolve(book()?.refresh?.({ force: true })).catch(() => {});
      return r;
    },
  };
}
