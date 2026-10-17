// @ts-check
// EG-PLAY (2026-10-11, the Elite Gates arc; bible/11-Multiplayer/Elite-Gates.md sections 6, 7 and 21) and EG-FULL
// (2026-10-11, Mac: "I said I want everything" - sections 14, 15, 16, 17 and 27): AN ELITE BREACH'S TRACKER AND ITS
// PANELS -
//   THE TRACKER (a readout, no click): outside the Spire the call; inside, THE COUNT CHIP (gold above 10:00, white to
//     2:00, red below and pulsing in the last 30 s; *Held* while it holds; the last word's seal when it is nearer), the
//     circle and hall by name with its band, the objective and its progress (rifts 3 of 5, the hold's seconds, the winch,
//     the casters left), the decrees in force, my run (Reliquaries, lumen, shards, tonics, Cantrips, THE POTION LAW's
//     pip), the marks on me, the company's rows (numerals, a cracked recall, a witness's eye, home, forsaken), a
//     witness's own line;
//   THE PANEL (clicked, or answered by keys and `/breach` words): the Vestige offer (each card its name, rank and line;
//     1-6 to take), the company's word (each choice open, its options and its countdown; Y/N, 1-2), and THE RECAP at a
//     run's end (the depth, the time, why it ended, the circles' strip, the company, the Vestiges held).
//
// The models are pure (`egHudModel`, `egPanelModel`, `egRecapModel`); the drawing keeps one node each, updated, never
// rebuilt line by line beyond what changed, and hidden with the HUD.
//
// EG-ZF (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md section 27.6): THE RECAP'S
// NUMBERS - each member's share of the company's damage and what they healed (the room's `ds`, net/eliteGates/egTally.js), the board's
// line from the end's claim (`egBoardLine` - *The Descent, the Few: 14th*), and the lord's fall's chart as the gate's own
// chart reads one (`egChartFell` - ui/gate/gateDamageChart.js damageChartModel).
//
// AUDIT EG III (2026-10-13, section 15's resonance and Accords): an offer's card says the capstone a third Vestige of its family
// completes (`egCardCompletes` - *Completes Stone: Rooted.* and what Rooted does, in the Vestiges' blue) and what each Accord it
// takes does; the recap lists the capstones held.
//
// Not a DFU member. Ledger A (ELITE-GATES).
import { egHallOf, egCircleOfHall, egSlotOfHall, egPhase, egTimes, egCountText, egObjectiveOf, EG_TEXT, EG_COUNT_START_MS, EG_LAST_WORD_MS, EG_BANDS, EG_DECREES, EG_TWIST_NAMES } from '../../net/eliteGates/egLaw.js';
import { EG_OPEN_ENDS } from '../../net/eliteGates/egLaw.js';   // AUDIT EG III (section 16.3): the ends that open the Reliquaries
import { egBossOf, egLordCard } from '../../net/eliteGates/egLaw.js';   // AUDIT EG V (L2-11): the next Court's lord, the law's
import { egStrataSecond } from '../../net/eliteGates/egBrain.js';   // AUDIT EG V (L2-11): and the second lord its strata stand beside it
import { egPanoplyIn, egValkRedoubt } from '../../net/eliteGates/egPay.js';   // AUDIT EG III: the rest's stake line - a Reliquary's Panoply odds
import { EG_RELIQUARY_PANOPLY_X } from '../../systems/eliteGates/egSpoils.js';
import { egCountAt, egLivingCount, egMemberOf, egRunOfMember } from '../../net/eliteGates/egLink.js';
import { egCardText, egAccordsOf, EG_VESTIGES, EG_M_BY_ID } from '../../net/eliteGates/egVestige.js';
import { egCardAccords } from '../../net/eliteGates/egVestige.js';   // EG-ZS (section 15): the Accord an offer's card would take
import { egResonance, egRankOf, EG_ACCORDS, EG_CAPSTONES, EG_V_FAMILY_NAMES } from '../../net/eliteGates/egVestige.js';   // AUDIT EG III: the capstone a card completes, what an Accord does
import { EG_CANTRIPS } from '../../net/eliteGates/egRun.js';
import { egTwistShown } from '../../net/eliteGates/egRun.js';   // AUDIT EG V (L2-4): no Bargain's name when no family is free
import { injectEnhancedFonts } from '../enhanced/enhancedStyle.js';
import { chartShare, chartNumber } from '../gate/gateDamageChart.js';   // EG-ZF: the share and the numbers as the gate's chart says them
import { EG_PRES_TEXT } from './egBeats.js';   // EG-ZF: the board's line and the chart's words
import { t } from '../../systems/textManager.js';   // AUDIT EG V (c): the words this audit adds, in the player's language

/** Under this, THE COUNT burns red; under this it pulses; above this it is gold (ms). */
export const EG_HUD_LOW_MS = 2 * 60_000;
export const EG_HUD_PULSE_MS = 30_000;
export const EG_HUD_GOLD_MS = 10 * 60_000;
/** A mark's words on a member (net/eliteGates/egBodies.js egMarksOut). */
export const EG_MARK_NAMES = Object.freeze(['The Scent', 'Soul-mark', 'Fire-touched', 'Frost-touched', 'Chained', 'Caged', 'Challenged', 'Hunted', 'Bound']);
/** THE POTION LAW (section 17.4): restoring potions a hall. */
export const EG_POTIONS_PER_HALL = 2;
export const EG_HUD_STYLE_ID = 'dagger-eg-hud-style';
export const EG_HUD_CSS = `
.eg-hud { position: fixed; right: 16px; top: 24%; width: min(320px, 72vw); box-sizing: border-box; pointer-events: none; z-index: 30;
  padding: 10px 14px 11px; border: 1px solid rgba(214,170,92,0.55); border-radius: 3px;
  background: linear-gradient(180deg, rgba(18,12,10,0.82), rgba(10,7,6,0.72)); box-shadow: 0 0 18px rgba(0,0,0,0.65);
  font: 600 calc(14px * var(--hud-scale, 1)) 'Cormorant', Georgia, serif; color: #f1dcc2; text-shadow: 0 0 3px #000; }
.eg-hud-kicker { font-size: 11px; letter-spacing: 0.32em; text-transform: uppercase; color: #d6aa5c; }
.eg-hud-title { font-size: 18px; line-height: 1.15; margin-top: 2px; color: #ffe9cf; }
.eg-hud-count { font: 700 26px 'Cormorant', Georgia, serif; font-variant-numeric: tabular-nums; letter-spacing: 0.06em; margin-top: 4px; color: #ffffff; }
.eg-hud-count.gold { color: #e8c473; }
.eg-hud-count.held { color: #e8c473; }
.eg-hud-count.low { color: #ff6a4a; text-shadow: 0 0 4px #000, 0 0 12px rgba(255,60,30,0.6); }
.eg-hud-count.pulse { color: #ff4a2a; animation: eg-pulse 1s ease-in-out infinite; }
@keyframes eg-pulse { 50% { opacity: 0.55; } }
@media (prefers-reduced-motion: reduce) { .eg-hud-count.pulse { animation: none; } }
.eg-hud-count:empty { display: none; }
.eg-hud-line { font-size: 15px; line-height: 1.25; margin-top: 5px; }
.eg-hud-sub, .eg-hud-run, .eg-hud-dec, .eg-hud-mark { font-size: 13px; line-height: 1.25; margin-top: 3px; color: #cdb79e; }
.eg-hud-mark { color: #ff8a6a; }
.eg-hud-sub:empty, .eg-hud-company:empty, .eg-hud-run:empty, .eg-hud-dec:empty, .eg-hud-mark:empty { display: none; }
.eg-hud-company { font-size: 12px; letter-spacing: 0.06em; margin-top: 7px; color: #b9a084; white-space: pre-line; }
.eg-panel { position: fixed; left: 50%; top: 18%; transform: translateX(-50%); width: min(620px, 92vw); box-sizing: border-box; z-index: 32; pointer-events: auto;
  padding: 14px 16px; border: 1px solid rgba(214,170,92,0.7); border-radius: 4px; background: rgba(14,10,8,0.92); box-shadow: 0 0 28px rgba(0,0,0,0.8);
  font: 600 15px 'Cormorant', Georgia, serif; color: #f1dcc2; }
.eg-panel h3 { margin: 0 0 6px; font-size: 13px; letter-spacing: 0.28em; text-transform: uppercase; color: #d6aa5c; font-weight: 700; }
.eg-panel .eg-cards { display: flex; flex-wrap: wrap; gap: 8px; }
.eg-panel button { flex: 1 1 170px; text-align: left; cursor: pointer; padding: 8px 10px; border: 1px solid rgba(214,170,92,0.45); border-radius: 3px;
  background: rgba(40,28,20,0.85); color: #f1dcc2; font: inherit; }
.eg-panel button:hover, .eg-panel button:focus { border-color: #e8c473; background: rgba(70,50,30,0.95); outline: none; }
.eg-panel button.eg-focus { border-color: #6f9dff; box-shadow: 0 0 0 1px #6f9dff; }
.eg-panel button b { display: block; color: #ffe9cf; }
.eg-panel button small { display: block; color: #cdb79e; font-size: 13px; margin-top: 2px; }
.eg-panel button small.eg-accord { color: #8fb4ff; font-style: italic; }
.eg-panel button small.eg-cap { color: #8fb4ff; }
.eg-panel .eg-ask { margin-top: 10px; }
.eg-panel .eg-note { margin-top: 8px; font-size: 13px; color: #b9a084; }
@media (max-width: 640px) { .eg-hud { top: 16%; right: 8px; padding: 7px 10px 8px; } .eg-hud-title { font-size: 15px; } .eg-hud-count { font-size: 21px; } .eg-hud-line { font-size: 13px; } .eg-panel { top: 8%; } }
`;

const ms = (v) => egCountText(Math.max(0, v));
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
const FAMILY = Object.freeze({ blows: 'blows', legion: 'legion', ground: 'ground', covenant: 'Covenant', lord: 'lord' });
/** The objective's progress, from the fight's (net/eliteGates/egBodies.js `pg`). */
export function egProgressText(spec, pg) {
  if (!pg) return '';
  if (Array.isArray(pg.rifts)) return `Rifts ${pg.rifts[1] - pg.rifts[0]} of ${pg.rifts[1]} closed`;
  if (pg.obj === 'wellspring') return pg.anchors > 0 ? `Anchors standing: ${pg.anchors}` : 'The Wellspring is open to blows';
  if (pg.obj === 'holdfast') return `Hold ${ms(75_000 - (pg.hold ?? 0))} - the relic ${pg.relic ?? 100}%`;
  if (pg.obj === 'winch') return `The winch ${Math.round(((pg.winch ?? 0) / 60_000) * 100)}%`;
  if (pg.obj === 'gauntlet') return `Casters left: ${pg.left ?? 0}`;
  if (pg.obj === 'engine') return `Hold the engine ${ms(45_000 - (pg.hold ?? 0))}`;
  if (pg.obj === 'orrery' && Array.isArray(pg.st)) return `Stones true: ${pg.lit ?? 0} of 6 - fray ${pg.f ?? 0}`;
  if (pg.obj === 'quiet') return `The door opens in ${ms(pg.quiet ?? 0)}`;
  return '';
}
/** A stage's words, by the hall's kind where it matters. */
function stageLines(E, spec, now) {
  const left = E.su > 0 ? E.su - now : 0;
  switch (E.sg) {
    case 'wait': return { line: EG_TEXT.sealed(ms(left)), sub: 'Gather your company.' };
    case 'arrive': return { line: 'Gather on the arrival plate.', sub: left > 0 ? `The hall wakes in ${ms(left)}.` : '' };
    case 'trial': {
      const obj = egObjectiveOf(spec), prog = egProgressText(spec, E.fight?.pg);
      const lordAsleep = spec?.kind === 'court' && !(E.fight?.bodies ?? []).some((b) => b.role === 0 && b.ph);
      return { line: obj, sub: prog || (spec?.kind === 'court' && lordAsleep && !(E.fight?.says ?? []).some((s) => s.w === 'wake') ? 'Step into the ring to wake its lord.' : egTwistShown(spec, E.dc) ? EG_TWIST_NAMES[spec.twist] : '') };
    }
    case 'closing': return { line: `${EG_TEXT.door} Step through the door.`, sub: left > 0 ? `${EG_TEXT.pulled.replace('.', '')} in ${ms(left)}.` : '' };
    case 'rest': return { line: `${EG_TEXT.redoubt(E.rd)} - ${EG_TEXT.rest}`, sub: left > 0 ? `${EG_TEXT.descend.replace('.', '')} in ${ms(left)} - or take the way home.` : '' };
    case 'end': return { line: EG_TEXT.ended, sub: '' };
    default: return { line: '', sub: '' };
  }
}
/**
 * AUDIT EG III (section 16.3) - THE STAKE, as the rest card shows it: *4 Reliquaries - 1 Valkynaz - a Panoply piece about 1 in
 * 2.* - `rw` each Reliquary's circle (net/eliteGates/egRun.js egRunOf's): how many, how many of a Valkynaz's Redoubt, and the odds that at
 * least one holds a Panoply piece, each at EG_RELIQUARY_PANOPLY_X times its Redoubt's (net/eliteGates/egPay.js egPanoplyIn) - *likely*
 * past two in three, where "about 1 in 1" would say nothing. '' for none.
 * Pure.
 * @param {number[]} rw
 */
export function egStakeText(rw) {
  const ws = (Array.isArray(rw) ? rw : []).filter((w) => Number.isSafeInteger(w) && w >= 1);
  if (!ws.length) return '';
  const valk = ws.filter((w) => egValkRedoubt(w)).length;
  const none = ws.reduce((p, w) => p * Math.max(0, 1 - EG_RELIQUARY_PANOPLY_X / egPanoplyIn(w)), 1);
  const k = Math.round(1 / Math.max(1e-9, 1 - none));
  return [`${ws.length} ${ws.length === 1 ? 'Reliquary' : 'Reliquaries'}`, valk ? `${valk} Valkynaz` : '', k >= 2 ? `a Panoply piece about 1 in ${k}` : 'a Panoply piece likely'].filter(Boolean).join(' - ');
}
/**
 * AUDIT EG V (L2-11; sections 14 and 16.3: "the next circle's decrees ... and the next lord, both shown on the beacon") - THE
 * BEACON'S WORDS in a rest: *The next circle bears: Gale-Swept, Hunting Pack II.* once the company's word chose them (the
 * state's `nx` - net/eliteGates/egBrain.js egNextOf), and *The next Court: Grath, the Hound.* - the next circle's lord, the law's
 * (net/eliteGates/egLaw.js egBossOf), with the second lord the strata held stand beside it (the Twin Court's, the Old Masters' -
 * net/eliteGates/egBrain.js egStrataSecond, the state's `sr`). '' outside a rest. Pure.
 * @param {any} E
 */
export function egNextCircleText(E) {
  if (!E?.b || E.sg !== 'rest' || !(E.h > 0)) return '';
  const dec = (E.nx ?? []).map(([id, rank]) => `${EG_DECREES[id]?.name ?? ''}${rank >= 2 ? ' II' : ''}`).filter(Boolean);
  const c = egCircleOfHall(E.h) + 1, key = egBossOf(E.seed, c), two = egStrataSecond(E.sr, key, c);
  const card = (k) => { const L = egLordCard(k); return `${L.name}${L.epithet ? `, ${L.epithet}` : ''}`; };
  return [dec.length ? `The next circle bears: ${dec.join(', ')}.` : '', `The next Court: ${card(key)}${two ? ` - and ${card(two)}` : ''}.`].filter(Boolean).join(' ');
}
/** The company's rows (section 27.4): each member's numeral and name, a cracked recall, a witness's eye, home, forsaken. */
export function egCompanyRows(E) {
  return E.co.map((c) => {
    const [, name, n, alive, home, , wit, forsaken, , recall] = c;
    const state = forsaken ? ' (forsaken)' : home ? ' - home' : wit ? ' - watching' : !alive ? ' - fallen' : '';
    const crack = alive && !home && recall === 0 ? ' *' : '';
    return `${ROMAN[n] ?? n} ${name}${crack}${state}`;
  }).join('\n');
}

/**
 * What the tracker says now, or null. Pure.
 * @param {any} E net/eliteGates/egLink.js's state @param {string|null} me @param {number} now
 * @param {{ inSpire?: boolean, witness?: boolean, potions?: number }} where
 */
export function egHudModel(E, me, now, { inSpire = false, witness = false, potions = EG_POTIONS_PER_HALL } = {}) {
  if (!E) return null;
  if (inSpire && E.b) {
    const spec = E.h > 0 ? egHallOf(E.seed, E.h, E.geo ?? 0) : null;
    const left = E.wk > 0 ? egCountAt(E, now) : EG_COUNT_START_MS;
    const lastWord = E.op + EG_LAST_WORD_MS - now;
    const { line, sub } = stageLines(E, spec, now);
    const n = E.co.length, standing = egLivingCount(E);
    const held = !(E.ca > 0);
    const seal = lastWord < left;
    const shown = seal ? lastWord : left;
    const countCls = E.sg === 'end' ? '' : held ? 'held' : shown < EG_HUD_PULSE_MS ? 'pulse' : shown < EG_HUD_LOW_MS ? 'low' : shown > EG_HUD_GOLD_MS ? 'gold' : '';
    const run = me ? egRunOfMember(E, me) : null;
    const cants = (run?.cant ?? []).map((c) => EG_CANTRIPS[c]?.name).filter(Boolean);
    const runLine = run ? [`Reliquaries ${run.rel}`, `lumen ${run.lumen}`, run.shards ? `shards ${run.shards}` : '', run.tonics ? `tonics ${run.tonics}` : '', `potions ${potions}/${EG_POTIONS_PER_HALL}`, cants.length ? `Cantrips: ${cants.join(', ')}` : ''].filter(Boolean).join(' - ') : '';
    const dec = (E.dc ?? []).map(([id, rank]) => `${EG_DECREES[id]?.name ?? ''}${rank >= 2 ? ' II' : ''}`).filter(Boolean);
    const marks = (E.fight?.mk ?? []).filter((m) => m[0] === me && m[2] > now).map((m) => `${EG_MARK_NAMES[m[1]] ?? ''} ${Math.ceil((m[2] - now) / 1000)}s`);
    const mine = me ? egMemberOf(E, me) : null;
    const memento = me ? (E.mm ?? []).find((q) => q[0] === me) : null;
    const witLine = witness || (mine && mine.wit) ? (mine && mine.recall ? (memento ? `Your Memento lies in Hall ${memento[1]}. You will be called back at Redoubt ${egCircleOfHall(E.h)}.` : `You will be called back at Redoubt ${egCircleOfHall(E.h)}.`) : `${EG_TEXT.fallen} Forsaking leaves for good.`) : '';   // AUDIT EG V (c, L7-20): in no one input's words
    return {
      kicker: `${E.rh ? `${EG_TEXT.name} - Rehearsal` : EG_TEXT.name}${spec ? ` - ${EG_BANDS[spec.band]?.name ?? ''}` : ''}`,
      title: spec ? `Circle ${egCircleOfHall(E.h)} - Hall ${egSlotOfHall(E.h)}: ${spec.name}` : 'The Battlespire',
      count: E.sg === 'end' ? '' : `${held ? 'Held ' : ''}${seal ? 'Last word ' : ''}${ms(shown)}`, countCls,
      line: witLine || line, sub: witLine ? '' : E.sg === 'rest' && run?.rw?.length ? `${egStakeText(run.rw)}. ${sub}` : sub, company: n > 1 ? `${standing} of ${n} standing\n${egCompanyRows(E)}` : '',
      run: runLine, dec: E.sg === 'rest' ? egNextCircleText(E) : dec.length ? `Decrees: ${dec.join(', ')}` : '', mark: marks.join(' - '),   // AUDIT EG V (L2-11): a rest's beacon
    };
  }
  const c = E.call;
  if (!c || !me || !c.co.some((r) => r[0] === me)) return null;
  const phase = egPhase({ openedAt: c.op }, now), T = egTimes({ openedAt: c.op });
  if (phase === 'ended' || phase === 'deep' || phase === 'torn') return null;
  const mine = c.os === me;
  return {
    kicker: c.rh ? `${EG_TEXT.name} - Rehearsal` : EG_TEXT.name,
    title: mine ? 'Your breach is opening' : EG_TEXT.call(c.o || 'Your company'),
    count: '', countCls: '',
    line: phase === 'open' ? EG_TEXT.answer(ms(T.admitUntil - now)) : EG_TEXT.sealed(ms(T.openAt - now)),
    sub: phase === 'open' ? 'Answer the call to step through.' : 'Gather your company. Answer the call once it opens.',   // AUDIT EG V (c, L7-20): the prompt answers it - Enter, the pad's A, a tap, or /breach
    company: c.co.length > 1 ? `Company of ${c.co.length}` : '', run: '', dec: '', mark: '',
  };
}

/** A choice's words (the company's word - section 16.4). */
export function egAskText(q, o) {
  if (q.startsWith('dec:')) { const fam = q.slice(4); return { title: `The next circle's ${FAMILY[fam] ?? fam} decree`, opts: o.map((id) => `${EG_DECREES[id]?.name ?? '?'} - ${EG_DECREES[id]?.line ?? ''}`) }; }
  if (q === 'bargain') return { title: "Dagon's Bargain: one more decree for this circle, a Reliquary to each who says yes", opts: ['No', 'Yes'] };
  if (q === 'respite') return { title: 'Take a respite? Two minutes from the budget, the count held', opts: ['No', 'Yes'] };
  if (q === 'ready') return { title: 'Ready to descend?', opts: ['Not yet', 'Ready'] };
  return { title: q, opts: o.map(String) };
}
/**
 * AUDIT EG III (section 15's resonance: "Three different Vestiges of one family ... grant that family's capstone"): the line a
 * card says when taking it completes a family - a Vestige I do not hold, of a family I hold exactly two different Vestiges of:
 * *Completes Stone: Rooted.* and what the capstone does; '' for any other card (a Mastery, a rank, a family short or complete).
 * Pure.
 * @param {number} card @param {number[][]} vs mine
 */
export function egCardCompletes(card, vs) {
  const V = card < 100 ? EG_VESTIGES[card] : null;
  if (!V || egRankOf(vs, V.key) > 0) return '';
  const had = (vs ?? []).filter(([id]) => EG_VESTIGES[id]?.fam === V.fam).length;   // three or more: the family resonates already
  if (had !== 2) return '';
  const C = EG_CAPSTONES[V.fam];
  return EG_PRES_TEXT.completes(EG_V_FAMILY_NAMES[V.fam], C.name, C.line);
}
/** AUDIT EG III (section 15's Accords): what Accord `key` does, in its own words, or ''. Pure. */
export const egAccordDoes = (key) => { const A = EG_ACCORDS.find((x) => x.key === key); return A ? EG_PRES_TEXT.accordDoes(A.name, A.line) : ''; };
/**
 * THE PANEL's model, or null: my Vestige offer (each card's name, rank and line; how many I may take), the company's
 * word open (each choice, its options, its time left, my answer), a Surplus to spend. Pure.
 */
export function egPanelModel(E, me, now, voted = {}) {
  if (!E?.b || E.end) return null;
  // AUDIT EG V (L6-4): nothing to offer or ask (the common frame) - nothing worked out and nothing made, not even the
  // closures' context the model's own work holds (panelModelOf)
  if (!E.offer?.v?.length && !askingAt(E, now)) return null;
  return panelModelOf(E, me, now, voted);
}
/** AUDIT EG V (L6-4): is any of the company's words open at `now`? Read in place. */
function askingAt(E, now) {
  const as = E.as;
  if (as) for (let k = 0; k < as.length; k++) if (as[k][2] > now) return true;
  return false;
}
/** egPanelModel's work, for a breach with an offer or a word open. */
function panelModelOf(E, me, now, voted) {
  const run = me ? egRunOfMember(E, me) : null;
  // EG-ZS (section 15: "The offer card names it: *Takes an Accord with Mira's Hunter's Mark.*"): each living companion's
  // Vestiges, by name, for the Accord a card would take with them (net/eliteGates/egVestige.js egCardAccords)
  const mates = (E.co ?? []).filter((c) => c[0] !== me).map((c) => [egMemberOf(E, c[0]), egRunOfMember(E, c[0]).vs]).filter(([m]) => m?.in && m.alive && !m.home).map(([m, vs]) => [m.name, vs]);
  // AUDIT EG III: and what each Accord does, once a card
  const accord = (c) => { const told = new Set(); return egCardAccords(c, run?.vs ?? [], mates).map((a) => { const first = !told.has(a.key); told.add(a.key); return `${EG_PRES_TEXT.takesAccord(a.name, a.with)}${first ? ` ${egAccordDoes(a.key)}` : ''}`; }).join(' '); };
  const offer = E.offer?.v?.length ? { cards: E.offer.v.map((c, j) => ({ key: j + 1, card: c, ...egCardText(c, run?.vs ?? []), accord: accord(c), completes: egCardCompletes(c, run?.vs ?? []) })), n: E.offer.n, surplus: E.sp ?? 0 } : null;
  const asks = (E.as ?? []).filter((a) => a[2] > now).map(([q, o, until]) => ({ q, ...egAskText(q, o), left: until - now, mine: voted[q] ?? null, tally: E.tally?.[q] ?? [] }));
  if (!offer && !asks.length) return null;
  return { offer, asks };
}
/** THE RECAP (section 27.6): the depth, the time from the first wake, why it ended, the circles' strip, the company,
 *  my Vestiges. `log` the client's own record of the halls it saw. Pure.
 *  EG-G1 (2026-10-12, section 27.6 completed): the depth as its parts (`depth` - the hall, the Redoubt, the band), why it
 *  ended in words (`whyText`, the client's end words), a strip per circle (`strip` - its halls' glyphs, its lord, its
 *  falls), the company member by member (`members` - numeral, name, falls, the recall kept or spent, how they left), the
 *  Accords I held with any companion (`accords`), the Reliquaries opened (`opened` - the way home, THE SEAL, the last word
 *  and a void open them, net/eliteGates/egLaw.js EG_OPEN_ENDS; a tear, a wipe and a fall lose them - AUDIT EG III: the service's count
 *  once the end's claim answers it, scenes/eliteGates/egClient.js openedHeard) and the board's line (`board`).
 *  EG-ZF (2026-10-12, section 27.6): each member's share of the company's damage (`share`, the gate chart's words - "34%")
 *  and what they healed in others (`healed`), off the room's `ds` (null both where the room said none); the board's line
 *  from the end's claim (`board`, egBoardLine); the breach it was (`b` - the board's line finds its recap by it). */
export function egRecapModel(E, me, log, now, { whyText = '', board = '', why = E?.end ?? '' } = {}) {
  if (!E?.b) return null;
  const run = me ? egRunOfMember(E, me) : null;
  const t = E.wk ? Math.max(0, now - E.wk) : 0;
  const circles = [];
  for (const h of log ?? []) { const c = egCircleOfHall(h.h); (circles[c - 1] ??= []).push(h); }
  const band = E.h > 0 ? EG_BANDS[egHallOf(E.seed, E.h, E.geo ?? 0).band]?.name ?? '' : '';
  const others = (E.ms ?? []).filter((r) => r[0] !== me);
  const accords = [...new Set(others.flatMap((r) => egAccordsOf(run?.vs ?? [], r[6] ?? []).map((A) => A.name)))];
  const ds = new Map((E.ds ?? []).map((t) => [t[0], t])), dealt = [...ds.values()].reduce((a, t) => a + t[1], 0);   // EG-ZF
  return {
    b: E.b,
    title: `Hall ${E.h} - Redoubt ${E.rd} - ${band}`,
    time: ms(t), why: why ?? '',
    circles: circles.filter(Boolean).map((hs, j) => `Circle ${j + 1}: ${hs.map((h) => h.glyph).join(' ')}${hs.some((h) => h.fall) ? ' (a fall)' : ''}`),
    company: egCompanyRows(E),
    vestiges: (run?.vs ?? []).map(([id, r]) => `${EG_VESTIGES[id]?.name ?? ''} ${ROMAN[r]}`).concat(run && run.mast >= 100 ? [`${EG_M_BY_ID[run.mast]?.name ?? ''} (Mastery)`] : []),
    capstones: egResonance(run?.vs ?? []).map((f) => EG_CAPSTONES[f].name),   // AUDIT EG III (section 27.6): the capstones held
    reliquaries: run?.rel ?? 0,
    // EG-G1: the page's fields
    depth: { h: E.h, rd: E.rd, band }, whyText,
    strip: circles.map((hs, j) => (hs ? { c: j + 1, glyphs: hs.map((h) => h.glyph), lord: hs.find((h) => h.lordName)?.lordName ?? '', falls: hs.reduce((n, h) => n + (Number.isSafeInteger(h.falls) ? h.falls : h.fall ? 1 : 0), 0) } : null)).filter(Boolean),   // AUDIT EG V (c, L7-8): every member's falls, the room's count (scenes/eliteGates/egClient.js logFrame)
    members: E.co.map((c) => {
      const [, name, n, alive, home, inn, wit, forsaken, falls, recall] = c;
      const t = ds.get(c[0]);   // EG-ZF: their share of the company's damage and what they healed - the room's own count
      return { numeral: ROMAN[n] ?? String(n), name, falls: falls ?? 0, recall: recall === 1 ? 'held' : 'spent', left: forsaken ? 'forsaken' : home ? 'home' : inn !== 1 ? 'away' : wit || !alive ? 'fallen' : 'standing',
        share: ds.size ? chartShare(t?.[1] ?? 0, dealt) : null, healed: ds.size ? t?.[2] ?? 0 : null };
    }),
    accords, opened: EG_OPEN_ENDS.includes(why) ? run?.rel ?? 0 : 0, board,   // AUDIT EG III: THE SEAL and a void open them too
  };
}
/** EG-G1 (section 27.6): THE LAST FIVE RUNS, kept on the device - each recap as it ended, newest last. */
export const EG_RECAPS_KEY = 'eg.recaps';
export const EG_RECAPS_KEPT = 5;
export const egRecapsKept = (store) => { try { const v = JSON.parse(store?.getItem?.(EG_RECAPS_KEY) ?? '[]'); return Array.isArray(v) ? v.slice(-EG_RECAPS_KEPT) : []; } catch { return []; } };
export function egRecapKeep(store, recap, at = Date.now()) {
  if (!recap) return egRecapsKept(store);
  const list = [...egRecapsKept(store), { ...recap, at }].slice(-EG_RECAPS_KEPT);
  try { store?.setItem?.(EG_RECAPS_KEY, JSON.stringify(list)); } catch { /* the session's alone */ }
  return list;
}
/** EG-G1: a recap member's line (section 27.6's company - numeral, name, falls, the recall, how they left). EG-ZF: and their
 *  share of the damage and what they healed, where the room said them (`words.share`, `words.healed`; healing where any). */
export const egRecapMemberLine = (m, words) => `${m.numeral} ${m.name} - ${words.left[m.left] ?? m.left}, ${m.falls === 1 ? '1 fall' : `${m.falls} falls`}, ${words.recall[m.recall] ?? m.recall}`
  + (m.share != null && words.share ? ` - ${words.share(m.share)}${m.healed > 0 && words.healed ? `, ${words.healed(chartNumber(m.healed))}` : ''}` : '');
/** EG-ZF (section 27.6): a rank as the board's line says it - 1st, 2nd, 3rd, 4th; 11th, 12th, 13th; 21st, 111th. Pure. */
export function egRankText(n) {
  const k = Math.max(1, Math.floor(Number(n) || 1)), t = k % 100;
  return `${k}${t >= 11 && t <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][k % 10] ?? 'th'}`;
}
/** EG-ZF (section 27.6): THE BOARD'S LINE - the end's claim's standing (server-account/src/egHonours.js egStandingOf:
 *  `{ k: 'descent', br, rank }` or `{ k: 'depths', rank }`) in words, *The Descent, the Few: 14th*; '' for none. Pure. */
export function egBoardLine(board) {
  if (!board || !Number.isSafeInteger(board.rank) || board.rank < 1) return '';
  if (board.k === 'descent' && EG_PRES_TEXT.boardBrackets[board.br]) return EG_PRES_TEXT.boardDescent(EG_PRES_TEXT.boardBrackets[board.br], egRankText(board.rank));
  if (board.k === 'depths') return EG_PRES_TEXT.boardDepths(egRankText(board.rank));
  return '';
}
/** EG-ZF: the board's line set on the kept recap of breach `b` (the claim answers after the run is kept). Answers the list. */
export function egRecapBoardKeep(store, b, line) {
  const list = egRecapsKept(store);
  let i = list.length - 1;
  while (i >= 0 && list[i]?.b !== b) i--;
  if (i < 0 || !line || list[i].board === line) return list;
  list[i] = { ...list[i], board: line };
  try { store?.setItem?.(EG_RECAPS_KEY, JSON.stringify(list)); } catch { /* the session's alone */ }
  return list;
}
/**
 * EG-ZF (section 27.6): A LORD'S FALL'S CHART as the gate's chart reads a fall (ui/gate/gateDamageChart.js damageChartModel's
 * `fell`): the room's compact rows (`E.chart.dm` - `[sub, level, dealt, on the lord, blows, heaviest, falls, healed]`)
 * named by the company, the lord's part in the crystals' column, the Healed column where anyone healed; null for none.
 * Pure.
 */
export function egChartFell(E) {
  const C = E?.chart;
  if (!C?.dm?.length) return null;
  const nameOf = (sub) => (E.co ?? []).find((c) => c[0] === sub)?.[1] ?? '?';
  const healed = C.dm.some((t) => t[7] > 0);
  return { at: C.at, n: C.dm.length, dm: C.dm.map(([sub, l, d, x, h, b, f, hl]) => ({ n: nameOf(sub), l, d, x, h, b, f, ...(healed ? { hl } : {}) })) };
}

// ── the drawing ─────────────────────────────────────────────────────────────────────────────────────────────
let root = null, parts = null, panel = null, panelKey = /** @type {any} */ (null);   // AUDIT EG V (L6-4): what the panel drew (panelSame)
const SHOWN = () => ({ vis: '', kicker: null, title: null, count: null, countCls: null, line: null, sub: null, company: null, run: null, dec: null, mark: null });
let shown = SHOWN();
const KEYS = ['kicker', 'title', 'count', 'line', 'sub', 'run', 'dec', 'mark', 'company'];

function ensureStyle(doc) {
  if (doc.getElementById && !doc.getElementById(EG_HUD_STYLE_ID)) {
    const st = doc.createElement('style');
    st.id = EG_HUD_STYLE_ID;
    st.textContent = EG_HUD_CSS;
    (doc.head ?? doc.body)?.append(st);
    if (doc.head) injectEnhancedFonts(doc);
  }
}
function build(doc) {
  ensureStyle(doc);
  const part = (cls) => { const n = doc.createElement('div'); n.className = cls; return n; };
  root = part('eg-hud');
  root.setAttribute?.('aria-live', 'polite');
  parts = Object.fromEntries(KEYS.map((k) => [k, part(`eg-hud-${k}`)]));
  root.append(...KEYS.map((k) => parts[k]));
  (doc.body ?? doc.documentElement)?.append(root);
}

/** Draw the tracker for a model (null hides it); `hidden` the HUD's own hide. */
export function drawEgHud(model, { hidden = false, doc = globalThis.document } = {}) {
  const want = !hidden && !!model;
  if (!root) {
    if (!want || !doc?.createElement) return;
    build(doc);
  }
  const vis = want ? 'on' : 'off';
  if (vis !== shown.vis) { shown.vis = vis; root.style.display = want ? '' : 'none'; }
  if (!want || !model) return;
  for (const k of KEYS) { const v = model[k] ?? ''; if (v !== shown[k]) { shown[k] = v; parts[k].textContent = v; } }
  if (model.countCls !== shown.countCls) { shown.countCls = model.countCls; parts.count.className = `eg-hud-count${model.countCls ? ` ${model.countCls}` : ''}`; }
}
/**
 * Draw THE PANEL for a model (null takes it down): its buttons call `onPick(card)`, `onVote(q, y)`, `onSurplus(use)`;
 * rebuilt only when what it shows changes (its key).
 * @param {any} model
 * AUDIT EG V (c, L7-3): `focus` one index over every choice it shows, in its order - the cards, a Surplus's two, then each
 * choice's options (scenes/eliteGates/egClient.js choices); L7-9: `onClose()` the recap's own close button, `touch` the words of a screen
 * in hand (a tap, never a key).
 * @param {{ hidden?: boolean, doc?: any, onPick?: (card: number) => void, onVote?: (q: string, y: number) => void, onSurplus?: (use: number) => void, onClose?: () => void, recap?: any, focus?: number, relShown?: number|null, words?: any, touch?: boolean }} [o]
 */
export function drawEgPanel(model, { hidden = false, doc = globalThis.document, onPick = () => {}, onVote = () => {}, onSurplus = () => {}, onClose = () => {}, recap = null, focus = -1, relShown = null, words = null, touch = false } = {}) {
  const want = !hidden && (!!model || !!recap);
  if (!want) { if (panel) { panel.remove?.(); panel = null; panelKey = null; } return; }
  if (!doc?.createElement) return;
  // EG-G1: the pad's focus redraws; EG-ZF: the board's line, when the claim brings it. AUDIT EG V (L6-4): the panel stands
  // while what its nodes say stands - read field by field against the last it drew (panelSame), never the whole model
  // serialised a frame; the seconds left are written in place
  const same = panel && panelSame(panelKey, model, recap, focus, touch);   // AUDIT EG V (c, L7-9): the touch words its own redraw
  const leftOf = (q) => model?.asks?.find((a) => a.q === q)?.left ?? 0;
  if (same) {
    for (const el of panel.querySelectorAll?.('[data-left]') ?? []) el.textContent = `${Math.ceil(leftOf(el.getAttribute('data-left')) / 1000)}s`;
    if (recap && relShown != null && words) for (const el of panel.querySelectorAll?.('[data-rel]') ?? []) el.textContent = words.recapReliquaries(relShown);   // EG-G1: the Reliquaries open one by one
    return;
  }
  ensureStyle(doc);
  panel?.remove?.();
  panel = doc.createElement('div');
  panel.className = 'eg-panel';
  panelKey = { model, recap, title: recap?.title ?? '', why: recap?.why ?? '', board: recap?.board ?? '', focus, touch };
  const h = (text) => { const e = doc.createElement('h3'); e.textContent = text; return e; };
  if (recap && words) {
    // EG-G1 (section 27.6): THE RECAP, whole - the depth, the time and why, a strip per circle, the company member by
    // member, the Vestiges and the Accords, the Reliquaries opening one by one, the board's line
    panel.append(h(words.recapHead));
    const opened = doc.createElement('div'); opened.className = 'eg-note eg-rel'; opened.setAttribute('data-rel', '1'); opened.textContent = words.recapReliquaries(relShown ?? recap.opened);
    const lines = [words.recapDepth(recap.depth.h, recap.depth.rd, recap.depth.band), `${words.recapTime(recap.time)} - ${recap.whyText || recap.why}`, opened,
      ...recap.strip.map((c) => `Circle ${c.c}: ${c.glyphs.join(' ')}${c.lord ? ` - ${c.lord}` : ''}${c.falls ? ` (${c.falls === 1 ? 'a fall' : `${c.falls} falls`})` : ''}`),
      ...recap.members.map((m) => egRecapMemberLine(m, { left: words.recapLeft, recall: words.recapRecall, share: words.recapShare, healed: words.recapHealed })),
      recap.vestiges.length ? `Vestiges: ${recap.vestiges.join(', ')}` : '', recap.capstones?.length ? `${words.recapCapstones}: ${recap.capstones.join(', ')}` : '',   // AUDIT EG III: the capstones
      recap.accords.length ? `${words.recapAccords}: ${recap.accords.join(', ')}` : '', recap.board];
    for (const line of lines) {
      if (!line) continue;
      if (typeof line !== 'string') { panel.append(line); continue; }
      const p = doc.createElement('div'); p.className = 'eg-note'; p.style.whiteSpace = 'pre-line'; p.textContent = line; panel.append(p);
    }
  } else if (recap) {
    panel.append(h('The breach is over'));
    for (const line of [recap.title, `Time: ${recap.time} - ${recap.why}`, `Reliquaries opened: ${recap.opened ?? 0}`, ...recap.circles, recap.company, recap.vestiges.length ? `Vestiges: ${recap.vestiges.join(', ')}` : '']) {
      if (!line) continue;
      const p = doc.createElement('div'); p.className = 'eg-note'; p.style.whiteSpace = 'pre-line'; p.textContent = line; panel.append(p);
    }
  }
  if (model?.offer) {
    panel.append(h(`A Vestige${model.offer.n > 1 ? ` - take ${model.offer.n}` : ''} (keys 1-${model.offer.cards.length})`));
    const row = doc.createElement('div'); row.className = 'eg-cards';
    for (const c of model.offer.cards) {
      const b = doc.createElement('button');
      if (c.key - 1 === focus) b.className = 'eg-focus';   // EG-G1: the pad's choice
      const t = doc.createElement('b'); t.textContent = `${c.key}. ${c.name}`;
      const s = doc.createElement('small'); s.textContent = c.line;
      b.append(t, s);
      if (c.completes) { const k = doc.createElement('small'); k.className = 'eg-cap'; k.textContent = c.completes; b.append(k); }   // AUDIT EG III: the capstone it completes
      if (c.accord) { const a = doc.createElement('small'); a.className = 'eg-accord'; a.textContent = c.accord; b.append(a); }   // EG-ZS: the Accord it takes
      b.addEventListener?.('click', () => onPick(c.card));
      row.append(b);
    }
    panel.append(row);
    if (model.offer.surplus > 0) {
      const sr = doc.createElement('div'); sr.className = 'eg-cards eg-ask';
      for (const [use, label] of /** @type {[number, string][]} */ ([[0, `Spend a Surplus: a fourth card (${model.offer.surplus})`], [1, 'Spend a Surplus: reroll']])) { const b = doc.createElement('button'); if (focus === model.offer.cards.length + use) b.className = 'eg-focus'; b.textContent = label; b.addEventListener?.('click', () => onSurplus(use)); sr.append(b); }   // EG-ZD (section 27.8): the pad reaches the Surplus's two buttons, after the cards
      panel.append(sr);
    }
  }
  // AUDIT EG V (c, L7-3): the pad's focus runs on from the cards (and a Surplus's two) through every choice's options
  let at = model?.offer ? model.offer.cards.length + (model.offer.surplus > 0 ? 2 : 0) : 0;
  for (const a of model?.asks ?? []) {
    const box = doc.createElement('div'); box.className = 'eg-ask';
    const t = h(a.title); const left = doc.createElement('span'); left.setAttribute('data-left', a.q); left.textContent = `${Math.ceil(a.left / 1000)}s`; t.append(' - ', left);
    box.append(t);
    const row = doc.createElement('div'); row.className = 'eg-cards';
    const base = at;
    a.opts.forEach((label, y) => { const b = doc.createElement('button'); if (base + y === focus) b.className = 'eg-focus'; b.textContent = `${a.mine === y ? '> ' : ''}${label}`; b.addEventListener?.('click', () => onVote(a.q, y)); row.append(b); });   // EG-G1: the pad's choice
    at += a.opts.length;
    box.append(row);
    panel.append(box);
  }
  // AUDIT EG V (c, L7-9): the recap closes by a tap - its own button - and a screen in hand reads no key's words (L7-20)
  if (recap) { const row = doc.createElement('div'); row.className = 'eg-cards eg-ask'; const b = doc.createElement('button'); b.className = 'eg-close'; b.textContent = t('eg.recap.close', 'Close'); b.addEventListener?.('click', () => onClose()); row.append(b); panel.append(row); }
  const noteText = recap ? (touch ? '' : 'Press Enter to close.') : touch ? t('eg.panel.noteTouch', 'Tap a card or a choice.') : 'Y: the Ready vote - R: a respite - 1-6: a card or a choice; /breach pick and /breach vote work in chat.';
  if (noteText) { const note = doc.createElement('div'); note.className = 'eg-note'; note.textContent = noteText; panel.append(note); }
  (doc.body ?? doc.documentElement)?.append(panel);
}

/** AUDIT EG V (L6-4): does the panel drawn of `k` (panelKey - the model, the recap and its words, the focus it drew) say
 *  what `model`, `recap` and `focus` would: each card (its words, its capstone, its Accord, its pick), the take and the
 *  Surplus, each ask (its question, title, choices and my vote) - every field the nodes show but the seconds left? Reads
 *  in place, makes nothing. */
function panelSame(k, model, recap, focus, touch = false) {
  if (!k || k.focus !== focus || k.touch !== touch || !k.recap !== !recap) return false;   // a recap's words, never its object (a new one each Reliquary opened)
  if (recap && (k.title !== recap.title || k.why !== recap.why || k.board !== (recap.board ?? ''))) return false;
  const a = k.model, b = model;
  if (a === b) return true;
  if (!a || !b) return false;
  const oa = a.offer, ob = b.offer;
  if (!oa !== !ob) return false;
  if (oa) {
    if (oa.n !== ob.n || oa.surplus !== ob.surplus || oa.cards.length !== ob.cards.length) return false;
    for (let i = 0; i < oa.cards.length; i++) {
      const x = oa.cards[i], y = ob.cards[i];
      if (x.key !== y.key || x.card !== y.card || x.name !== y.name || x.line !== y.line || x.completes !== y.completes || x.accord !== y.accord) return false;
    }
  }
  const qa = a.asks ?? NO_ASKS, qb = b.asks ?? NO_ASKS;
  if (qa.length !== qb.length) return false;
  for (let i = 0; i < qa.length; i++) {
    const x = qa[i], y = qb[i];
    if (x.q !== y.q || x.title !== y.title || x.mine !== y.mine || x.opts.length !== y.opts.length) return false;
    for (let j = 0; j < x.opts.length; j++) if (x.opts[j] !== y.opts[j]) return false;
  }
  return true;
}
const NO_ASKS = Object.freeze([]);

/** The page is going (a test's reset): the nodes leave with it. */
export function destroyEgHud() {
  root?.remove?.(); panel?.remove?.();
  root = null; parts = null; panel = null; panelKey = null;
  shown = SHOWN();
}
