// @ts-check
// QL1/QL3 (bible/06-Systems/Questlines-Arc.md decisions 2 and 8, sections 2 and 5): THE LAYER - made once by the quest
// bridge (scenes/quest/questBridge.js createQuestBridge, THE ONE CONSTRUCTION SEAM: every host that has quests holds the
// bridge, so no host builds a layer of its own). It answers the machine's two questions - a starting quest's stamp
// (deps.questlinesStamp), a paying quest's gold (deps.questReward) - and the bridge's three: what moved this tick
// (look), what a journal row shows (rowOf), what a quest that ends is owed (ending: its outcome, standing and gear)
// and what its filed entry says of it (outcomeLine).
//
// WHAT IT KEEPS of its own (snapshot/restore, beside the machine's envelope in the bridge's save): the rewards waiting to
// be chosen - a quest's choice outlives the quest (the machine drops a tombstone after a week), so the three pieces are
// the character's from the moment they are rolled, until one is taken - the gold a running quest has paid (REWARD-3: its
// end settles it), and the questlines begun (QL12-QL16: its line runner's records, qlLineRunner.js - QL-OFFERED: each one
// the player took).
import { startStamp, isStamped, observe, readObjectives, outcomeOf, outcomeNow, fallbackOutcome, questTierOf } from './qlLaw.js';
import { sheetFor } from './qlSheets.js';
import { scaleGold, goldFactor, goldStillOwed, rewardTier, payProfileOf, rollRewardChoice, rewardSeed, standingMovesOf } from './qlRewards.js';
import { isGoldPieces } from '../inventory.js';
import { t, textRevision } from '../textManager.js';   // REWARD-3: the settled gold's line; LAW-11: a row read again when the words could read otherwise
import { createLineRunner } from './qlLineRunner.js';
import { noteFirstUse } from '../tutorials.js';   // QL2: the Tutorials' Questlines page, the first quest stamped

/** How many rewards may wait to be chosen at once - a player who never chooses keeps the last few, never a hoard. */
export const OFFERS_MAX = 12;

/** AUDIT QUESTLINES LINES-20: the waiting rewards cut to OFFERS_MAX - the oldest that names no piece goes first (a named
 *  piece is a line's once; dropped with the oldest it was lost for good), the oldest of all only when every one names one.
 *  In place; answers the offers dropped, oldest first. */
export function trimOffers(list) {
  const dropped = [];
  while (list.length > OFFERS_MAX) {
    const i = list.findIndex((o) => !o.pieces?.some((p) => p.named));
    dropped.push(...list.splice(i < 0 ? 0 : i, 1));
  }
  return dropped;
}

/** AUDIT QUESTLINES LAW-10: A SHEET LINE'S TRANSLATION KEY (TextQuests `QL.<key>`, ui/quest/questLens.js quietText), by its
 *  kind - an objective's `<QUEST>.o.<id>`, an outcome's `<QUEST>.r.<id>`, a branch's `<QUEST>.b.<id>` and its choice's
 *  `<QUEST>.b.<id>.<choice>`. A sheet's ids are unique within each list only: one `<QUEST>.<id>` read two lines (21 in 19
 *  sheets - A0C10Y05's `wed` an objective and an outcome). No translation pack ships them yet: nothing to move. */
export const sheetTextKey = (sheet, kind, id, choice = null) => `${sheet?.quest}.${kind}.${id}${choice != null ? `.${choice}` : ''}`;

/** AUDIT QUESTLINES REWARD-6/LAW-3: whether a quest's script can pay at all - a `give pc` that is no letter (`give pc
 *  nothing` too: its box is the reward turned down, and the layer hears it as paid), `ql paid`, or `train pc` (DFU's other
 *  success). Read once a quest: a script is fixed at its parse. */
const _payers = new WeakMap();
function scriptPays(quest) {
  if (_payers.has(quest)) return _payers.get(quest);
  let pays = false;
  for (const task of quest?.tasks?.values?.() ?? []) {
    for (const a of task?.actions ?? []) {
      if (a.typeName === 'QlPaid' || a.typeName === 'TrainPc' || (a.typeName === 'GivePc' && (a.isNothing || quest.getItem?.(a.itemSymbol)?.itemName !== 'letter'))) { pays = true; break; }
    }
    if (pays) break;
  }
  _payers.set(quest, pays);
  return pays;
}
/** The row's `gear` (REWARD-6): whether this quest can still pay a choice of gear - an outcome on its sheet that pays gear
 *  (the one it settled on, once it has) over a script that pays (it paid, it succeeded, or it is running and says so). */
function gearOf(quest, sheet, o) {
  const pays = (x) => !x.failure && payProfileOf(x).gear;
  if (!(o ? pays(o) : (sheet.outcomes ?? []).some(pays))) return false;
  return !!(quest.ql.paid || quest.questSuccess || (!quest.questComplete && scriptPays(quest)));
}
/** The plain read rowOf uses when it is handed none. */
const PLAIN = (_q, text, _key) => text;

/**
 * @param {{ machine: any, questLists?: any, ctx?: any, service?: any, nowMs?: () => number }} deps - `ctx` is the
 *   bridge's host context: carriesQuestItem, playerEntity, changeReputation, changeLegalRep, offerReward (absent on a
 *   host with no door for a taken piece - REWARD-13), onQuestlineOffer (the window's door), onOfferDropped (an offer the
 *   cap cut - REWARD-8), and for the lines (QL12): nowSeconds (the character's clock), online (an
 *   account to claim for), onHonour (a title or key the service paid), expand (the window's quiet read of quest text);
 *   `service` the account service's door (scenes/quest/questlineHost.js), null offline.
 */
export function createQuestlines({ machine, questLists = null, ctx = {}, service = null, nowMs = undefined }) {
  const probe = { carries: (r) => !!ctx.carriesQuestItem?.(r) };
  /** The rewards waiting: `[{ id, questName, title, outcome, tier, pieces: [{ item, tier, kind, named? }] }]`, oldest first. */
  let offers = [];
  let nextOffer = 1;
  /** AUDIT QUESTLINES REWARD-3: the gold each running quest's GivePc paid, by quest uid - `{ base, factor, shares }`
   *  (qlRewards.js goldStillOwed) - so its end pays what the outcome it settles on owes above it. Dropped at the end. */
  let golds = new Map();
  /** AUDIT QUESTLINES LAW-11: each stamped quest's last row, beside what it was read from (rowOf). */
  const rows = new WeakMap();
  /** AUDIT QUESTLINES REWARD-13: whether the host has the door a taken piece goes through (RW1's pile). */
  const hasDoor = () => typeof ctx.offerReward === 'function';
  /** QL12 (section 4.4): the quests this character finished well while the questlines were on - upper-case name ->
   *  its outcome's id - so a guild's ladder (qlLadders.js) can mark what is done. Bounded by the pack's quest names. */
  let history = {};
  /** QL12-QL16: the questlines, run over this machine. */
  const runner = createLineRunner({
    machine, service, nowMs,
    ctx: {
      level: () => ctx.playerEntity?.level ?? 1,
      online: () => !!ctx.online?.(),
      nowSeconds: () => ctx.nowSeconds?.() ?? 0,
      onHonour: (h) => ctx.onHonour?.(h),
      outcomeText: (quest) => layer.outcomeLine(quest, ctx.expand),
    },
  });

  const layer = {
    /** machine deps.questlinesStamp: a fresh state with the quest's tier while the switch is on, else null. */
    stamp(quest) {
      const st = startStamp();
      if (!st) return null;
      const meta = questLists?.findQuestMeta?.(quest?.questName) ?? null;
      // QL2: the Tutorials' Questlines page, at the first quest that shows objectives - AUDIT QUESTLINES UI-13: one the
      // player TAKES, never one a new character is started on (scenes/quest/questBridge.js GAME_START_QUESTS, S0000977 and
      // _BRISIEN, and the lists' init rows): the page popped at character creation, ahead of the Quests page itself
      if (sheetFor(quest?.questName) && !['S0000977', '_BRISIEN'].includes(quest?.questName) && meta?.scope !== 'init') noteFirstUse('questlines');
      st.tier = questTierOf({
        minReq: meta?.scope === 'init' ? null : meta?.quest?.minReq ?? null,
        social: meta?.scope === 'social',
        level: ctx.playerEntity?.level ?? 1,
        sheetTier: sheetFor(quest?.questName)?.tier ?? null,
      });
      return st;
    },

    /** After each machine tick: latch what each stamped quest's state has now shown. Answers the moves, quest by quest
     *  (`[{ quest, done, failed, chose, outcome }]` - only quests where something moved), for the herald. */
    look() {
      const news = [];
      for (const quest of machine.quests.values()) {
        if (!isStamped(quest) || quest.questTombstoned) continue;
        const sheet = sheetFor(quest.questName);
        if (!sheet) continue;
        const moved = observe(quest, sheet, probe);
        if (moved.done.length || moved.failed.length || moved.chose.length || moved.outcome) news.push({ quest, ...moved });
      }
      runner.look();   // QL12: each line's next step, when it is due
      return news;
    },

    /**
     * A journal row's questline part, or null for DFU's quest (unstamped, or no sheet): `{ tier, family, objectives,
     * choices, outcome, gear }` - each objective `{ id, text, state, optional, group, any, mark }` with its text read in the
     * player's words through `expand` (the window's quiet read - ui/quest/questLens.js quietText), hidden ones left out;
     * `gear` whether the quest can pay a choice of gear (REWARD-6: the window promises one only then).
     * AUDIT QUESTLINES LAW-11: the journal's walk reads every stamped quest's row ten times a second while the herald or
     * the tracker listens, and the words are the dear part (a macro read per line) - so a row is kept and handed again
     * while what it was read from stands: its objectives' states, its choices, its outcome, its gear, its tier, its
     * people's names (`ql name`), the text core's revision (a language switched, a pack laid) and the read itself - and
     * an ENDED quest's row (its latch settled, its script still) while the words and the read stand, unread.
     */
    rowOf(quest, expand = PLAIN) {
      if (!isStamped(quest)) return null;
      const sheet = sheetFor(quest.questName);
      if (!sheet) return null;
      const kept = rows.get(quest);
      const rev = textRevision();
      if (kept && kept.ended && quest.questComplete && kept.rev === rev && kept.expand === expand) return kept.row;
      const read = readObjectives(quest, sheet, probe).filter((o) => o.state !== 'hidden');
      const o = outcomeOf(quest, sheet);
      const gear = gearOf(quest, sheet, o);
      let names = '';
      for (const r of quest.resources?.values?.() ?? []) if (r?.isPerson === true) names += `${r.displayName ?? ''}|`;
      const sig = `${rev}|${quest.ql.tier}|${read.map((x) => `${x.id}:${x.state}`).join(',')}|${JSON.stringify(quest.ql.choices)}|${o?.id ?? ''}|${gear}|${names}`;
      if (kept && kept.sig === sig && kept.expand === expand) {
        kept.ended = !!quest.questComplete;
        return kept.row;
      }
      const objectives = read.map((x) => ({ ...x, text: expand(quest, x.text, sheetTextKey(sheet, 'o', x.id)) }));
      const choices = (sheet.branches ?? []).filter((b) => quest.ql.choices[b.id]).map((b) => {
        const c = b.choices.find((x) => x.id === quest.ql.choices[b.id]);
        return { branch: b.id, text: expand(quest, b.text, sheetTextKey(sheet, 'b', b.id)), choice: c ? expand(quest, c.text, sheetTextKey(sheet, 'b', b.id, c.id)) : '' };
      });
      const row = {
        tier: quest.ql.tier, family: sheet.family ?? null, objectives, choices,
        outcome: o ? { id: o.id, text: expand(quest, o.text, sheetTextKey(sheet, 'r', o.id)), failure: !!o.failure } : null,
        gear,
      };
      rows.set(quest, { sig, rev, expand, row, ended: !!quest.questComplete });
      return row;
    },

    /**
     * machine deps.questReward - GivePc's moment (quest/actions.js): a gold reward scaled by the outcome the quest's state
     * holds NOW (not latched: a quest may pay before it ends - M0B00Y16 pays at the giant's death and ends at the
     * merchant's rescue), and the quest marked paid. `dfItem` is the script's reward item (null for `give pc nothing`);
     * `resource` its Item resource. A LETTER IS NOT PAY: `give pc _letter_` hands the player the quest's own mail (the
     * main quest's invitations - _BRISIEN, S0000988), which marks nothing paid. AUDIT QUESTLINES REWARD-3: what this
     * moment paid is kept - the script's count, the factor and the party's shares (GivePc splits the purse after this, the
     * same hook's count: REWARD-11) - so the quest's end pays what the outcome it settles on owes above it (ending).
     */
    reward(quest, dfItem, resource = null) {
      if (!isStamped(quest)) return;
      if (resource?.itemName === 'letter') { runner.lettered(quest); return; }   // FB1020c LETTER-PACE: the next courier waits an hour from it
      const sheet = sheetFor(quest.questName);
      if (sheet) observe(quest, sheet, probe);
      if (sheet && dfItem && !quest.ql.paid) {
        const now = outcomeNow(quest, sheet, probe) ?? fallbackOutcome({ ...quest, questSuccess: true }, sheet);
        const scaled = scaleGold(dfItem, now, isGoldPieces(dfItem));
        if (scaled) golds.set(quest.uid, { base: scaled.before, factor: goldFactor(now), shares: Math.max(1, Math.trunc(quest.hooks?.rewardShares?.(quest) ?? 1) || 1) });
      }
      quest.ql.paid = true;
    },

    /**
     * machine deps.questEnding - the quest's own `end quest` (quest.js endQuest): the outcome SETTLED - the first whose
     * binding holds as the quest ends, else its success or failure fallback - the standing it names moved, and, for a
     * quest that paid (its script's GivePc, or a success) and an outcome that pays gear, its choice of three rolled and
     * set waiting. Once a quest (a resync's second end changes nothing). Answers the offer made, or null.
     * AUDIT QUESTLINES REWARD-3: and the gold its GivePc paid before the outcome settled, settled - the coin the settled
     * outcome's factor owes above the one applied then, through the quest's own gold door (GetItem's: hooks.addGold) and
     * a HUD line that says why; never taken back. M0B00Y16 pays at the questor's click and settles `rescued` (greater,
     * x1.25) on the merchant's walk home: its gold stood at x1.00 in either order.
     */
    ending(quest) {
      if (!isStamped(quest) || quest.ql.moved) return null;
      const sheet = sheetFor(quest.questName);
      if (!sheet) return null;
      observe(quest, sheet, probe, { settle: true, ending: true });
      quest.ql.moved = true;
      const outcome = outcomeOf(quest, sheet);
      runner.ended(quest, outcome);   // QL12: a line's step - the line moves on, or offers it again
      if (outcome ? !outcome.failure : quest.questSuccess) history[String(quest.questName).toUpperCase()] = outcome?.id ?? 'done';
      const paidGold = golds.get(quest.uid);
      golds.delete(quest.uid);
      if (!outcome) return null;
      // AUDIT QUESTLINES REWARD-14: a failure's standing obeys QFAIL-FREE (quest.js endQuest) - online, where the clock
      // spends a countdown on a journey, a quest that ends unfinished costs no faction anything; offline it stands.
      // Moved flat, each named faction once - a sheet names every faction it moves (Port-Ledger: no propagation).
      const failureFree = !!outcome.failure && !!quest.hooks?.sharedClock?.();
      if (!failureFree) for (const st of standingMovesOf(outcome)) ctx.changeReputation?.(st.factionId, st.amount, false);
      if (Number.isSafeInteger(outcome.legal) && outcome.legal !== 0) ctx.changeLegalRep?.(outcome.legal);
      const owed = goldStillOwed(paidGold, outcome);   // REWARD-3
      if (owed > 0) {
        quest.hooks?.addGold?.(owed);
        quest.hooks?.addHUDText?.(t('ql.reward.goldSettled', 'You receive {gold} more gold pieces for how it ended.', { gold: owed }));
      }
      if (!payProfileOf(outcome).gear || outcome.failure || !(quest.ql.paid || quest.questSuccess)) return null;
      const tier = rewardTier(quest.ql.tier, outcome);
      // QL3 (section 5.2): a questline's ending NAMES one piece - the card of its kind, made from the base its sheet names,
      // by the same producer as its two companions, so the item law reads it as any piece; once a character. AUDIT
      // QUESTLINES LINES-20: the name is spent when the named piece is TAKEN (take below) - spent when it was rolled, an offer
      // dropped at OFFERS_MAX or another card chosen lost it for good - and a name a waiting offer already holds is not
      // rolled twice
      const line = quest.questName;
      const named = outcome.named && !history[`named:${line}`] && !offers.some((x) => x.questName === line && x.pieces.some((p) => p.named)) ? outcome.named : null;
      const pieces = rollRewardChoice({ seed: rewardSeed(quest), level: ctx.playerEntity?.level ?? 1, tier, entity: ctx.playerEntity ?? null, named });
      if (!pieces.length) return null;
      const offer = { id: nextOffer++, questName: quest.questName, title: quest.displayName || quest.questName, outcome: outcome.id, tier, pieces };
      offers.push(offer);
      // LINES-20: the oldest offer naming no piece goes first; AUDIT QUESTLINES REWARD-8: and its going is said (the bridge's)
      const dropped = trimOffers(offers);
      for (const gone of dropped) ctx.onOfferDropped?.(gone);
      if (dropped.includes(offer)) return null;   // twelve named pieces wait: this one, naming none, is the one that goes
      ctx.onQuestlineOffer?.(offer);
      return offer;
    },

    /** The line the notebook files beside a stamped quest's ended entry - its outcome's words, read through `expand`
     *  (the quiet read), or null (DFU's quest, no sheet, no outcome). */
    outcomeLine(quest, expand = PLAIN) {
      if (!isStamped(quest)) return null;
      const sheet = sheetFor(quest.questName);
      const o = sheet ? outcomeOf(quest, sheet) : null;
      return o ? expand(quest, o.text, sheetTextKey(sheet, 'r', o.id)) : null;
    },

    /** QL11: an act the player did - a fish caught, a breach closed - heard by every running stamped quest, counted in
     *  its state (the `act` binding and `ql act` read it). A quest set aside or ending hears nothing. */
    act(kind, n = 1) {
      if (typeof kind !== 'string' || !kind || !(n > 0)) return 0;
      let heard = 0;
      for (const quest of machine.quests.values()) {
        if (!isStamped(quest) || quest.questComplete || quest.questTombstoned || quest.shelvedAt != null) continue;
        quest.ql.acts[kind] = (quest.ql.acts[kind] ?? 0) + Math.floor(n);
        heard++;
      }
      return heard;
    },

    /** The rewards waiting to be chosen, oldest first - none on a host with no door to take one through (REWARD-13: kept
     *  in the save for a host that has one). */
    offers: () => (hasDoor() ? offers.map((o) => ({ ...o })) : []),

    /** The player takes piece `index` of offer `id`: it goes the reward's way (ctx.offerReward - RW1's pile, opened over
     *  the pack), and the offer is gone. Answers the item taken, or null. AUDIT QUESTLINES REWARD-13: the offer was cut
     *  before the piece was given, and a host with no door (the ?exterior host) lost it - no door, nothing cut; the
     *  door first, the cut after. LINES-20: a named piece taken spends its line's name. */
    take(id, index) {
      if (!hasDoor()) return null;
      const i = offers.findIndex((o) => o.id === id);
      if (i < 0) return null;
      const offer = offers[i];
      const piece = offer.pieces[index];
      if (!piece) return null;
      ctx.offerReward(null, piece.item);
      offers.splice(offers.indexOf(offer), 1);
      if (piece.named) history[`named:${offer.questName}`] = String(piece.item.name);
      return piece.item;
    },

    /** QL12-QL16: the questlines, every one begun or on offer, as the window draws them (qlLineRunner.js rows). */
    lineRows: () => runner.rows(),
    /** QL-OFFERED: the player takes a line on offer (qlLineRunner.js takeLine) - `quest` the first step an offer was read
     *  from (offerQuest), else its first step scheduled by name. */
    takeLine: (id, opts) => runner.takeLine(id, opts),
    /** QL12 (section 4.4): what this character finished well, by quest name (a copy). */
    history: () => ({ ...history }),
    /** The line runner, for the pins. */
    runner,

    /** The layer's own save: the rewards waiting, the gold the running quests paid (REWARD-3: only quests the machine
     *  still holds), and the questlines begun. */
    snapshot: () => ({
      offers: structuredClone(offers), nextOffer, lines: runner.snapshot(), history: { ...history },
      gold: Object.fromEntries([...golds].filter(([uid]) => machine.quests?.has?.(uid)).map(([uid, g]) => [uid, { ...g }])),
    }),
    restore(data) {
      runner.restore(data?.lines);
      history = {};
      if (data?.history && typeof data.history === 'object') for (const [k, v] of Object.entries(data.history)) if (typeof v === 'string' && /^(named:)?[A-Z0-9$_]{1,12}$/.test(k)) history[k] = v;
      offers = Array.isArray(data?.offers) ? data.offers.filter((o) => o && Number.isSafeInteger(o.id) && Array.isArray(o.pieces) && o.pieces.length).map((o) => structuredClone(o)) : [];
      trimOffers(offers);   // LINES-20's cut, as the ending's
      nextOffer = Math.max(Number.isSafeInteger(data?.nextOffer) ? data.nextOffer : 1, ...offers.map((o) => o.id + 1), 1);
      // REWARD-3: a record of its own kind, for a quest the loaded machine holds (the bridge restores the machine first)
      golds = new Map();
      if (data?.gold && typeof data.gold === 'object') {
        for (const [k, g] of Object.entries(data.gold)) {
          const uid = Number(k);
          if (machine.quests?.has?.(uid) && Number.isSafeInteger(g?.base) && g.base >= 0 && Number.isFinite(g?.factor) && Number.isSafeInteger(g?.shares) && g.shares >= 1) golds.set(uid, { base: g.base, factor: g.factor, shares: g.shares });
        }
      }
    },
  };
  return layer;
}
