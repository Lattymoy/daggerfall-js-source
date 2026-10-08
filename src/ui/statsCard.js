// STATS-CARD: THE PAPERDOLL'S FLIP SIDE (enhanced pack only; the classic window keeps DFU's doll untouched).
//
// A "Stats" button sits at the bottom centre of the paperdoll card - in the figure's own column, clear of every slot. Pressing it turns the whole card over on a 3D
// hinge to its back: what your swing does - damage, chance to hit, critical and backstab chances, per swing direction
// and against four reference foes (three monsters and a human) - built from your weapon, your attributes, your skills, your race and career and
// everything you wear. The numbers come from combat/combatStats.js, which reads the same formulas the combat core
// rolls (stock FormulaHelper or the Physical Combat And Armor Overhaul, whichever is in force). Armour is the card's
// own (ui/armourCard.js), so the doll's badges and this page cannot disagree.
//
// The card stays turned across repaints of the pack (equipping something repaints it; the back then recomputes at
// once, so you can watch a new sword change the numbers), and a repaint while turned builds the back already facing
// you - the flip animation plays only on the press.
import { computeCombatStats, signed } from '../combat/combatStats.js';
import { dollArmour, overallArmour, tenth, PART_NAMES } from './armourCard.js';
import { SKILL_NAMES } from '../systems/skills.js';
import { itemLongName } from '../systems/itemInfo.js';
import { PIXEL_STACK } from './pixelifyFive.js';
import { savingChance, elementalResistanceChance, ELEMENTS, EFFECT_FLAGS } from '../systems/spellcast.js';   // STATS-RESIST: the saving throw's own law   // the Enhanced Plus face: Pixelify Sans, its 5 from Silkscreen

const FLIP_MS = 900;
// THE TURN, one set of numbers for the keyframes and for FIREFOX-FLIP's face swap below: the first leg runs to FLIP_MID
// of the turn and FLIP_PAST degrees past edge-on (90 + 6 to the back, 90 - 6 coming home), on FLIP_EASE; the second leg
// settles. The easing is the segment's own (an animation's timing function runs per keyframe interval), so the card is
// EDGE-ON well before half the turn.
const FLIP_MID = 0.45;
const FLIP_PAST = 6;
const FLIP_EASE = Object.freeze([0.3, 0.7, 0.25, 1]);
/** The moment the turning card is edge-on (ms into the turn): where the first leg's eased rotation crosses 90 degrees
 *  - the cubic-bezier solved for its output, then read back as time. Both directions cross at the same moment. */
export function flipEdgeMs(ms = FLIP_MS, [x1, y1, x2, y2] = FLIP_EASE, mid = FLIP_MID, past = FLIP_PAST) {
  const ax = 1 - 3 * x2 + 3 * x1, bx = 3 * x2 - 6 * x1, cx = 3 * x1;
  const ay = 1 - 3 * y2 + 3 * y1, by = 3 * y2 - 6 * y1, cy = 3 * y1;
  const want = 90 / (90 + past);
  let lo = 0, hi = 1;
  for (let i = 0; i < 40; i++) { const s = (lo + hi) / 2; if (((ay * s + by) * s + cy) * s < want) lo = s; else hi = s; }
  return Math.round(ms * mid * ((ax * lo + bx) * lo + cx) * lo);
}
export const FLIP_EDGE_MS = flipEdgeMs();
let flipped = false;      // survives repaints of the pack
let foeIdx = 0;           // which reference foe the page scores against

const el = (tag, cls = null, text = null) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const pct = (x) => `${Math.round(x * 100)}%`;
const signedPct = (n) => `${signed(n)}%`;
const one = (x) => (Math.round(x * 10) / 10).toFixed(1);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// ── the page ────────────────────────────────────────────────────
function tile(label, big, sub, title, i) {
  const t = el('div', 'sf-tile sf-rise');
  t.style.setProperty('--i', String(i));
  t.append(el('span', 'sf-k', label), el('span', 'sf-v', big), el('span', 'sf-s', sub));
  if (title) t.title = title;
  return t;
}
function section(title, i) {
  const s = el('section', 'sf-sec sf-rise');
  s.style.setProperty('--i', String(i));
  s.append(el('h4', null, title));
  return s;
}
function row(k, v, title = null) {
  const r = el('div', 'sf-row');
  r.append(el('span', 'sf-rk', k), el('span', 'sf-rv', v));
  if (title) r.title = title;
  return r;
}

export function buildStatsPage(entity, repaint, opts = {}) {
  const page = el('div', 'sf-page');
  let s;
  try { s = computeCombatStats(entity, opts); } catch (e) {
    console.warn('[statsCard] the numbers could not be computed', e);
    page.append(el('p', 'sf-err', 'The stats could not be worked out for this character.'));
    return page;
  }
  foeIdx = Math.min(foeIdx, s.foes.length - 1);
  const foe = s.foes[foeIdx];
  const head = s.head.byFoe[foeIdx];
  const d = head.dmg;
  const skillName = SKILL_NAMES[s.skillId] ?? 'Skill';

  // header: what is in the hand
  const hd = el('header', 'sf-head sf-rise');
  hd.style.setProperty('--i', '0');
  hd.append(el('h3', null, 'Combat Stats'));
  const weaponLine = s.weapon ? (safeName(s.weapon) || 'Weapon') : 'Bare hands';
  hd.append(el('p', null, `${weaponLine} \u00b7 ${skillName} ${s.skill}% \u00b7 Level ${s.level}`));
  page.append(hd);

  // the foe chips
  const chips = el('div', 'sf-chips sf-rise');
  chips.style.setProperty('--i', '1');
  chips.append(el('span', 'sf-chips-k', 'Against a level-' + s.level + ':'));
  s.foes.forEach((f, i) => {
    const b = el('button', `sf-chip${i === foeIdx ? ' on' : ''}`, f.label);
    b.type = 'button';
    b.title = f.tip;
    b.onclick = (e) => { e.stopPropagation(); foeIdx = i; repaint(); };
    chips.append(b);
  });
  page.append(chips);

  // the five headline tiles
  const tiles = el('div', 'sf-tiles');
  const dmgSub = s.crit.kind === 'damage' ? `avg ${one(d.avg)} \u00b7 crit ${d.critMin}\u2013${d.critMax}` : `average ${one(d.avg)}`;
  tiles.append(
    tile('Damage', d.min === d.max ? String(d.min) : `${d.min}\u2013${d.max}`, dmgSub,
      'Per hit, before the foe\u2019s armour takes its share. Sideways swing; the table below has the others.', 2),
    tile('Hit chance', pct(head.hit), `vs ${foe.label.toLowerCase()}`,
      'The chance a swing lands, averaged over where it strikes the foe and over your critical roll.', 3),
    tile('Critical', pct(s.crit.chance), s.crit.kind === 'damage'
      ? `+${s.crit.hitBonus} hit \u00b7 \u00d7${s.crit.damageMult.toFixed(2)} dmg` : `+${s.crit.hitBonus} to hit`,
    s.crit.kind === 'damage'
      ? 'Critical Strike roll: a success adds to your chance to hit and multiplies the blow.'
      : 'Critical Strike roll: a success adds to your chance to hit (Daggerfall\u2019s own critical).', 4),
    tile('Backstab', pct(s.backstab.chance), s.backstab.chance ? `\u00d7${s.backstab.multiplier} from behind` : 'needs skill 2+',
      'When the foe faces away: your Backstabbing skill is the chance the blow does triple damage, and it adds to your chance to hit.', 5),
    tile('Per swing', one(head.perSwing), 'expected damage',
      'Hit chance times damage, criticals included: what an average swing is worth.', 6),
  );
  page.append(tiles);

  // swings
  const sw = section(s.isBow ? 'The shot' : 'Swing directions', 7);
  const tbl = el('div', 'sf-tbl');
  const th = el('div', 'sf-tr sf-th');
  ['', 'Damage', 'Hit', 'Per swing'].forEach((t) => th.append(el('span', null, t)));
  tbl.append(th);
  s.swings.forEach((w) => {
    const m = w.byFoe[foeIdx];
    const tr = el('div', `sf-tr${w.key === s.headlineKey ? ' on' : ''}`);
    const mods = `${signed(w.mods.damage)} dmg, ${signed(w.mods.toHit)}% hit`;
    tr.title = `${w.label}: ${mods}`;
    tr.append(el('span', 'sf-name', w.label), el('span', null, `${m.dmg.min}\u2013${m.dmg.max}`), el('span', null, pct(m.hit)), el('span', null, one(m.perSwing)));
    tbl.append(tr);
  });
  sw.append(tbl);
  page.append(sw);

  // how the damage and the hit are built
  const build = section('Breakdown', 8);
  const p = d.parts;
  build.append(row(s.weapon ? 'Weapon roll' : 'Fists', `${p.roll[0]}\u2013${p.roll[1]}`, 'The span the weapon (or your Hand-to-Hand) rolls in, with its own modifiers.'));
  if (p.matMod) build.append(row('Material', signed(p.matMod)));
  build.append(row('Strength', signed(p.strMod) + (p.twoHanded && s.core === 'overhaul' ? ' (two-handed)' : ''), 'Your Strength\u2019s damage modifier.'));
  if (p.prof) build.append(row('Proficiency', signed(p.prof), 'Your career\u2019s expertise with this weapon.'));
  if (p.racial) build.append(row('Race', signed(p.racial), 'Your race\u2019s bonus with this kind of attack.'));
  const t = head.terms;
  build.append(row('Attack (skill, gear, swing)', signedPct(t.base), 'Your weapon skill and everything that adds to the chance before the foe is counted.'));
  build.append(row('Foe\u2019s armour', signedPct(Math.round(t.armour)), 'Its armour value on the part you strike, averaged over where blows land.'));
  build.append(row('Foe\u2019s dodging', signedPct(-t.dodge)));
  build.append(row('Attributes & adjustments', signedPct(t.other + t.dodge), 'Agility, luck (and speed) against the foe\u2019s, enchantments, adrenaline, and the flat adjustments the core applies.'));
  build.append(row('= Hit chance', pct(head.hit), 'The four lines above added together, then kept between 3% and 97%.'));
  page.append(build);

  // defence
  const def = section('Defence', 9);
  const parts = dollArmour(entity);
  def.append(row('Armour', one(tenth(overallArmour(parts))), 'The armour a blow meets on average (the plaque on the doll).'));
  const pills = el('div', 'sf-pills');
  parts.forEach((v, i) => {
    const pl = el('span', `sf-pill${v ? '' : ' nil'}`);
    pl.append(el('i', null, PART_NAMES[i].replace(/^(Left|Right) /, (m) => m[0] + '. ')), el('b', null, String(v)));
    pl.title = `${PART_NAMES[i]}: armour ${v}`;
    pills.append(pl);
  });
  def.append(pills);
  def.append(row('Dodging', `${s.dodging}%`, s.core === 'overhaul' ? 'Takes half its value off an attacker\u2019s chance to hit you.' : 'Takes a quarter of its value off an attacker\u2019s chance to hit you.'));
  if (s.avoidHit) def.append(row('Biography', signed(-s.avoidHit) + ' to be hit', 'Your biography\u2019s answer to "Fighting without magic" and its kin.'));
  def.append(row('Health', `${Math.round(s.derived.health)} / ${Math.round(s.derived.maxHealth)}`));
  page.append(def);

  // STATS-RESIST (the owner: "Resistances on the stat screen please"): each kind of harm's chance to be shrugged off -
  // the saving throw's own chance before its roll (systems/spellcast.js savingChance: race, career, biography, worn
  // affixes and Willpower), and over it any Resist effect running now, which turns the harm away whole first
  const rs = section('Resistances', 10);
  const pillsR = el('div', 'sf-pills sf-res');
  for (const r of resistanceRows(entity)) {
    const pl = el('span', `sf-pill${r.immune ? ' imm' : r.total >= 60 ? ' up' : r.total <= 25 ? ' down' : ''}`);
    pl.append(el('i', null, r.label), el('b', null, r.immune ? 'Immune' : `${r.total}%`));
    pl.title = r.immune ? `${r.label}: immune` : `${r.label}: ${r.save}% to resist${r.ward ? `, and a ${r.ward}% ward that turns it away whole first` : ''}`;
    pillsR.append(pl);
  }
  rs.append(pillsR);
  rs.title = 'Your chance to shrug each harm off: race, career, biography, what you wear and your Willpower (one point a ten).';
  page.append(rs);

  // attributes
  const at = section('Attributes', 11);
  const grid = el('div', 'sf-attrs');
  s.attributes.forEach((a) => {
    const c = el('div', 'sf-attr');
    const shown = a.value === a.base ? String(a.value) : `${a.value} (${a.base})`;
    c.append(el('span', 'sf-ak', cap(a.key)), el('span', `sf-av${a.value > a.base ? ' up' : a.value < a.base ? ' down' : ''}`, shown));
    if (a.effect) c.append(el('span', 'sf-ae', a.effect));
    grid.append(c);
  });
  at.append(grid);
  at.append(row('Carry limit', `${s.derived.carry} kg`));
  page.append(at);

  // skills
  const sk = section('Skills in play', 12);
  sk.append(row(skillName, `${s.skill}%`), row('Critical Strike', `${s.crit.skill}%`), row('Backstabbing', `${s.backstab.skill}%`), row('Dodging', `${s.dodging}%`));
  page.append(sk);

  const foot = el('p', 'sf-foot sf-rise', s.core === 'overhaul'
    ? 'Rules: Physical Combat And Armor Overhaul. Damage is before the foe\u2019s armour reduces it.'
    : 'Rules: Daggerfall\u2019s classic combat formulas. Damage is before any armour effects.');
  foot.style.setProperty('--i', '13');
  page.append(foot);
  return page;
}
function safeName(item) { try { return itemLongName(item); } catch { return item?.name ?? ''; } }
/** STATS-RESIST: the seven harms a saving throw is asked against, each `{ label, save, ward, total, immune }` - `total`
 *  the chance it is turned away at all (the ward first, then the throw). */
export const RESIST_ROWS = Object.freeze([
  ['Fire', ELEMENTS.Fire, EFFECT_FLAGS.Fire], ['Frost', ELEMENTS.Frost, EFFECT_FLAGS.Frost], ['Shock', ELEMENTS.Shock, EFFECT_FLAGS.Shock],
  ['Magic', ELEMENTS.Magic, EFFECT_FLAGS.Magic], ['Poison', ELEMENTS.DiseaseOrPoison, EFFECT_FLAGS.Poison],
  ['Disease', ELEMENTS.DiseaseOrPoison, EFFECT_FLAGS.Disease], ['Paralysis', ELEMENTS.Magic, EFFECT_FLAGS.Paralysis],
]);
export function resistanceRows(entity) {
  return RESIST_ROWS.map(([label, element, flag]) => {
    let sc = { immune: false, chance: 50 };
    try { sc = savingChance(element, flag, entity); } catch { /* a half-built character: the base */ }
    const ward = Math.max(0, Math.min(100, Math.round(elementalResistanceChance(entity, element) || 0)));
    const total = sc.immune ? 100 : Math.round(100 - (100 - ward) * (1 - sc.chance / 100));
    return { label, save: sc.chance, ward, total, immune: sc.immune || ward >= 100 };
  });
}

// ── the card ────────────────────────────────────────────────────
/**
 * Wrap the paperdoll `front` (the worn map) in a two-sided card with a Stats button, or hand `front` back untouched if
 * anything goes wrong - the pack must open whatever this page does.
 */
export function statFlip(front, entity, usingRightHand = () => true) {
  try {
    if (typeof document === 'undefined' || !entity) return front;
    ensureStyle();
    const root = el('div', `statflip${flipped ? ' is-back' : ''}`);
    const inner = el('div', 'statflip-inner');
    const fFace = el('div', 'statflip-face statflip-front');
    const bFace = el('div', 'statflip-face statflip-back');
    const scroll = el('div', 'statflip-scroll');
    scroll.tabIndex = -1;
    bFace.append(scroll);
    fFace.append(front);
    inner.append(fFace, bFace);
    const btn = el('button', 'statflip-btn');
    btn.type = 'button';
    btn.setAttribute('aria-pressed', String(flipped));
    root.append(inner, btn);

    const paintBack = () => { scroll.replaceChildren(buildStatsPage(entity, paintBack, { usingRightHand: usingRightHand() })); };
    const setFaces = () => {
      fFace.inert = flipped; bFace.inert = !flipped;
      fFace.setAttribute('aria-hidden', String(flipped)); bFace.setAttribute('aria-hidden', String(!flipped));
      btn.textContent = flipped ? 'Paperdoll' : 'Stats';
      btn.setAttribute('aria-label', flipped ? 'Turn the card back to the paperdoll' : 'Turn the card over to show your combat stats');
      btn.setAttribute('aria-pressed', String(flipped));
    };
    if (flipped) paintBack();
    setFaces();

    let busy = false;
    btn.onclick = (e) => {
      e?.stopPropagation?.(); e?.preventDefault?.();   // a synthetic press (a key, a test) may carry neither
      if (busy) return;
      busy = true;
      flipped = !flipped;
      if (flipped) { paintBack(); scroll.scrollTop = 0; }
      root.classList.remove('to-back', 'to-front');
      void root.offsetWidth;   // restart the animation if it ran before
      root.classList.add(flipped ? 'to-back' : 'to-front');
      root.classList.toggle('is-back', flipped);
      setFaces();
      setTimeout(() => { busy = false; root.classList.remove('to-back', 'to-front'); }, FLIP_MS);
    };
    btn.addEventListener('pointerdown', (e) => e.stopPropagation());
    return root;
  } catch (e) {
    console.warn('[statsCard] falling back to the plain paperdoll', e);
    return front;
  }
}

// ── the dress ───────────────────────────────────────────────────
export const STATS_CARD_CSS = `
.sf-res .sf-pill.imm b { color: #8fd18a; }
.sf-res .sf-pill.up b { color: #d9c27a; }
.sf-res .sf-pill.down b { color: #e08a72; }
/* STATS-CARD, dressed as Enhanced Plus. PAINT is the stone-and-brass kit's: every part has a ROLE in ui/enhancedFrame.js
   (the back is a panel, Stats / Paperdoll a button, the headline tiles and the armour pills chips, the foe chips tiles,
   each section a well with an engraved head, each line a rule), so all six Plus themes - Stone's grit and marble
   included - dress it, as they dress the pack beside it. This sheet is injected AFTER the kit, so it writes only what a
   role does not: border WIDTH and STYLE (never a colour or a ground), geometry, the pixel face and the words' colours. */
.pack-shell .statflip { --sf-ink: #efe8d6; --sf-soft: #cfc6af; --sf-dim: #a39a84; --sf-hi: #f3cf86; --sf-up: #7fbf8a; --sf-down: #e0786c;
  position: relative; flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column;
  perspective: 1500px; perspective-origin: 50% 40%; }
:root[data-plus-theme="stone"] .pack-shell .statflip { --sf-ink: #fbf8f0; --sf-soft: #f0ead9; --sf-dim: #e2dccd; --sf-hi: #ffd98a; --sf-up: #c4f5cc; --sf-down: #ffc4bb; }
.pack-shell .statflip::before { content: ''; position: absolute; left: 6%; right: 6%; bottom: -10px; height: 18px; z-index: 0;
  background: radial-gradient(ellipse at center, rgba(0,0,0,0.5), transparent 70%); opacity: 0.35; pointer-events: none; }
.pack-shell .statflip-inner { position: relative; flex: 1 1 auto; min-height: 0; display: grid; transform-style: preserve-3d; }
.pack-shell .statflip.is-back .statflip-inner { transform: rotateY(180deg); }
.pack-shell .statflip.to-back .statflip-inner { animation: sf-to-back ${FLIP_MS}ms cubic-bezier(${FLIP_EASE.join(',')}) both; }
.pack-shell .statflip.to-front .statflip-inner { animation: sf-to-front ${FLIP_MS}ms cubic-bezier(${FLIP_EASE.join(',')}) both; }
.pack-shell .statflip.to-back::before, .pack-shell .statflip.to-front::before { animation: sf-shadow ${FLIP_MS}ms ease-in-out both; }
@keyframes sf-to-back {
  0% { transform: rotateY(0deg) translateZ(0) scale(1); }
  ${FLIP_MID * 100}% { transform: rotateY(${90 + FLIP_PAST}deg) translateZ(70px) scale(1.05) rotateZ(-0.6deg); }
  100% { transform: rotateY(180deg) translateZ(0) scale(1); } }
@keyframes sf-to-front {
  0% { transform: rotateY(180deg) translateZ(0) scale(1); }
  ${FLIP_MID * 100}% { transform: rotateY(${90 - FLIP_PAST}deg) translateZ(70px) scale(1.05) rotateZ(0.6deg); }
  100% { transform: rotateY(0deg) translateZ(0) scale(1); } }
@keyframes sf-shadow { 0%,100% { opacity: 0.35; transform: scaleX(1); } ${FLIP_MID * 100}% { opacity: 0.75; transform: scaleX(0.55); } }
.pack-shell .statflip-face { grid-area: 1 / 1; min-height: 0; display: flex; flex-direction: column;
  backface-visibility: hidden; -webkit-backface-visibility: hidden; }
.pack-shell .statflip-front > * { flex: 1 1 auto; min-height: 0; }
.pack-shell .statflip-back { position: relative; min-height: 280px; transform: rotateY(180deg); border-width: 2px; border-style: solid; }
.pack-shell .statflip-scroll { position: absolute; inset: 0; overflow-y: auto; overflow-x: hidden; padding: 12px 14px 46px;
  text-align: left; outline: 0; }
/* CURSOR-EDGE: the standard scrollbar properties for Firefox alone - in Chromium they turn the ::-webkit-scrollbar dress
   (and the kit's cursor over it) off */
@supports not selector(::-webkit-scrollbar) {
  .pack-shell .statflip-scroll { scrollbar-width: thin; scrollbar-color: #7a7260 rgba(0,0,0,0.35); }
}

/* THE BUTTON stands in the PAPERDOLL's own cell: bottom centre of the card, which is the middle column the figure
   holds (the worn map is 1fr | auto | 1fr) - never a corner, where it sat on the right weapon's slot. On the back it
   stays put and reads Paperdoll. A button role: raised stone, brass under the pointer, sunk when pressed. */
.pack-shell .statflip-btn { position: absolute; bottom: 6px; left: 0; right: 0; margin: 0 auto; width: max-content; min-width: 92px;
  z-index: 6; height: 28px; padding: 0 14px; border-width: 2px; border-style: solid; cursor: pointer; text-align: center;
  font-family: ${PIXEL_STACK}; font-size: 12px; line-height: 1; letter-spacing: 0.1em; text-transform: uppercase;
  -webkit-font-smoothing: none; font-variant-ligatures: none; color: var(--sf-ink); text-shadow: 1px 1px 0 #050608; }
.pack-shell .statflip-btn:hover, .pack-shell .statflip-btn:focus-visible { color: var(--sf-hi); outline: 0; }
.pack-shell .statflip-btn:focus-visible { outline: 2px solid rgba(243,207,134,0.6); outline-offset: 2px; }

/* THE PAGE - the window's own pixel face (Pixelify Sans, never the plain skin's Barlow / Cormorant) */
.statflip .sf-page { font-family: ${PIXEL_STACK}; -webkit-font-smoothing: none; font-variant-ligatures: none; color: var(--sf-ink);
  font-size: 13px; line-height: 1.4; text-shadow: 1px 1px 0 rgba(5,6,8,0.8); max-width: 880px; margin: 0 auto; }
.statflip .sf-head { margin: 0 0 8px; text-align: center; }
.statflip .sf-head h3 { margin: 0; font-family: inherit; font-weight: 400; font-size: 20px; line-height: 1.15; letter-spacing: 0.12em;
  text-transform: uppercase; color: var(--sf-hi); text-shadow: 2px 2px 0 rgba(0,0,0,0.85); }
.statflip .sf-head p { margin: 4px 0 0; color: var(--sf-soft); font-size: 12px; }
.statflip .sf-chips { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 6px; margin: 4px 0 10px; }
.statflip .sf-chips-k { color: var(--sf-dim); font-size: 11px; margin-right: 2px; }
.statflip .sf-chip { cursor: pointer; padding: 3px 10px; border-width: 2px; border-style: solid; font-family: inherit; font-size: 12px; line-height: 1.2;
  color: var(--sf-soft); text-shadow: 1px 1px 0 rgba(5,6,8,0.8); }
.statflip .sf-chip:hover, .statflip .sf-chip:focus-visible { color: var(--sf-hi); outline: 0; }
.statflip .sf-chip.on { color: var(--sf-hi); }
.statflip .sf-tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(118px, 1fr)); gap: 8px; margin-bottom: 10px; }
.statflip .sf-tile { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 7px 6px 8px; border-width: 2px; border-style: solid; }
.statflip .sf-k { font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--sf-soft); }
.statflip .sf-v { font-size: 22px; line-height: 1.1; color: var(--sf-hi); text-shadow: 2px 2px 0 rgba(0,0,0,0.85); }
.statflip .sf-s { font-size: 11px; color: var(--sf-dim); text-align: center; }
.statflip .sf-sec { margin: 0 0 10px; padding: 7px 10px 8px; border-width: 2px; border-style: solid; background-color: rgba(0,0,0,0.2); break-inside: avoid; }
.statflip .sf-sec h4 { margin: 0 0 6px; padding: 0 0 4px; border-bottom-width: 2px; border-bottom-style: solid; font-family: inherit; font-weight: 400;
  font-size: 12px; line-height: 1.1; letter-spacing: 0.14em; text-transform: uppercase; color: var(--sf-hi); }
.statflip .sf-row { display: flex; justify-content: space-between; gap: 10px; padding: 2px 0; border-bottom-width: 1px; border-bottom-style: solid; }
.statflip .sf-rk { color: var(--sf-soft); } .statflip .sf-rv { color: var(--sf-ink); white-space: nowrap; }
.statflip .sf-tbl { display: flex; flex-direction: column; gap: 1px; }
.statflip .sf-tr { display: grid; grid-template-columns: 1.3fr 1fr 0.7fr 0.9fr; gap: 6px; padding: 2px 4px; }
.statflip .sf-tr span:not(.sf-name) { text-align: right; }
.statflip .sf-th { color: var(--sf-dim); font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; border-bottom-width: 1px; border-bottom-style: solid; }
.statflip .sf-tr.on { color: var(--sf-hi); }
.statflip .sf-pills { display: flex; flex-wrap: wrap; gap: 4px; margin: 3px 0 5px; }
.statflip .sf-pill { display: inline-flex; gap: 5px; align-items: baseline; padding: 1px 6px; border-width: 2px; border-style: solid; }
.statflip .sf-pill i { font-style: normal; font-size: 10px; color: var(--sf-soft); } .statflip .sf-pill b { color: var(--sf-ink); font-weight: 400; }
.statflip .sf-pill.nil b { color: var(--sf-dim); }
.statflip .sf-attrs { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 4px 10px; margin-bottom: 4px; }
.statflip .sf-attr { display: grid; grid-template-columns: 1fr auto; column-gap: 6px; }
.statflip .sf-ak { color: var(--sf-soft); } .statflip .sf-av { color: var(--sf-ink); }
.statflip .sf-av.up { color: var(--sf-up); } .statflip .sf-av.down { color: var(--sf-down); }
.statflip .sf-ae { grid-column: 1 / -1; font-size: 11px; color: var(--sf-dim); }
.statflip .sf-foot, .statflip .sf-err { margin: 6px 0 0; text-align: center; font-size: 11px; color: var(--sf-dim); }
@media (min-width: 900px) { .statflip .sf-page { max-width: 940px; } .statflip .sf-tiles { grid-template-columns: repeat(5, 1fr); } }

.pack-shell .statflip.is-back .sf-rise { animation: sf-rise .55s cubic-bezier(.2,.8,.25,1) both; animation-delay: calc(var(--i, 0) * 55ms + 380ms); }
.pack-shell .statflip:not(.to-back):not(.to-front) .sf-rise { animation-duration: 0s; animation-delay: 0s; }
@keyframes sf-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }

/* FIREFOX-FLIP: Firefox alone can lose the 3D chain under the pack's backdrop-filter, ignore backface-visibility and draw the
   paperdoll mirrored over the stats. Only there, the turned-away face is also hidden by VISIBILITY - swapped at the moment
   the card is EDGE-ON (FLIP_EDGE_MS, ~226ms of the 900ms turn: the first leg's easing crosses 90 degrees long before half
   the turn), so neither face is ever seen from behind. Two Firefox-only tests, either enough: -moz-appearance, and the
   :-moz-focusring selector. Other browsers never see this; reduced motion has its own crossfade (below). */
@supports (-moz-appearance: none) or selector(:-moz-focusring) {
  @media (prefers-reduced-motion: no-preference) {
    .pack-shell .statflip-front, .pack-shell .statflip-back { transition: visibility 0s ${FLIP_EDGE_MS}ms; }
    .pack-shell .statflip-back { visibility: hidden; }
    .pack-shell .statflip.is-back .statflip-back { visibility: visible; }
    .pack-shell .statflip.is-back .statflip-front { visibility: hidden; }
  }
}

@media (prefers-reduced-motion: reduce) {
  .pack-shell .statflip { perspective: none; }
  .pack-shell .statflip-inner, .pack-shell .statflip.is-back .statflip-inner { transform: none; animation: none !important; }
  .pack-shell .statflip-face { backface-visibility: visible; -webkit-backface-visibility: visible; transition: opacity .25s; }
  .pack-shell .statflip-back { transform: none; opacity: 0; }
  .pack-shell .statflip.is-back .statflip-back { opacity: 1; } .pack-shell .statflip.is-back .statflip-front { opacity: 0; }
  .pack-shell .statflip::before { display: none; }
  .pack-shell .statflip .sf-rise { animation: none !important; }
}
`;
function ensureStyle() {
  if (document.getElementById('statflip-css')) return;
  const st = document.createElement('style');
  st.id = 'statflip-css';
  st.textContent = STATS_CARD_CSS;
  document.head.append(st);
}
