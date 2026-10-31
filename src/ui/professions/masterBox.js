// @ts-check
// MASTER-ART (2026-10-27; bible/06-Systems/Professions-Arc.md section 57): THE MASTER'S WORK, IN A STATION'S CRAFT BOX.
// At Master in the recipe's craft: the three lines to choose (native selects - a keyboard's and a touch's), the
// catalysts held and asked, the day's bound, and the last work's card. The service decides (masterWork.js); this asks
// through the station's own craft door, so the fee, the chain and the kept act are a craft's.
import {
  MASTER_RANK,
  MASTER_LINES,
  MASTER_PROCS_MAX,
  MASTER_CATALYSTS,
  masterRecipe,
  masterTrackOf,
  masterOptions,
  masterChoiceRefusal,
  masterBand,
} from '../../net/masterLaw.js';
import { recipeInputs } from '../../net/recipeLaw.js'; // AUDIT HORIZONTAL B4: the recipe's own goods, no stand-in
import { chainPlan, chainNeeded, storesRoom } from '../../net/chainLaw.js'; // and the works that make them from raw, as the book runs them
import { AFFIX_KINDS, affixLabel } from '../../systems/loot/lootRarity.js';
import { mintPieces } from '../../systems/smithItems.js';
import { itemLongName } from '../../systems/item/itemInfo.js';
import { t } from '../../systems/textManager.js';

/** Each station's choice, by its name: the recipe it was made for and its lines' keys ('' unchosen). */
const _picks = new Map();
/** A fresh visit starts plain (profPages.js resetProfPages). */
export function resetMasterBoxes() {
  _picks.clear();
}

/** The lines chosen at `station` for recipe `r` - three keys, '' where none is chosen; a new recipe starts empty. */
export function masterPicks(station, r) {
  const was = _picks.get(station);
  if (was?.recipe === r.id) return was.lines;
  const lines = Array.from({ length: MASTER_LINES }, () => '');
  _picks.set(station, { recipe: r.id, lines });
  return lines;
}

/** Where a catalyst comes from, by its row's pursuit - '' for a pursuit with no word yet (its row still shows). */
const pursuitWord = (/** @type {string} */ p) =>
  p === 'gathering'
    ? t('prof.master.from.gathering', "Logging's rarest find")
    : p === 'sea'
      ? t('prof.master.from.sea', 'nets hauled at sea')
      : p === 'enchanting'
        ? t('prof.master.from.enchanting', 'Enchanting')
        : '';

/** An option's words: its line at the band's two ends ("+20 to 40% damage"). @param {{ id: string, param?: any }} o */
export function masterOptionWords(o) {
  const band = masterBand(o.id);
  return band ? AFFIX_KINDS[o.id].label({ id: o.id, param: o.param, value: `${band[0]} to ${band[1]}` }) : o.id;
}

/** The catalysts a Master's work asks, each against the units the service counted (`held`, own or bought - never loose):
 *  `{ key, need, have, pursuit }`. AUDIT HORIZONTAL B6: a key the recipe spends too (a Pearl jewel's Pearl) shows its
 *  goods' share among the goods (masterGoods), not here. @param {(k: string) => number} held */
export function masterNeeds(held) {
  return MASTER_CATALYSTS.map((c) => ({
    key: c.key,
    need: c.n,
    have: Math.max(0, held(c.key) | 0),
    pursuit: c.pursuit,
  }));
}

/** What a station may work of a key: everything held, counted or loose (profBook.js workable). */
const workOf = (/** @type {any} */ book, /** @type {string} */ k) =>
  Math.max(0, (typeof book?.workable === 'function' ? book.workable(k) : book?.held?.(k)) | 0);
/** AUDIT HORIZONTAL B4, B6: THE GOODS A MASTER'S WORK SPENDS - its recipe's own (recipeInputs: no Heartwood, Joiner's or
 *  cracked gem), each against what the station may work of it once the catalysts' share of a key both ask is set aside.
 *  The service holds every unit to both and the counted ones to the catalysts (masterWork.js), so this and masterNeeds
 *  are its law. @param {any} r @param {any} book @returns {{ key: string, n: number, have: number }[]} */
export function masterGoods(r, book) {
  const cat = (/** @type {string} */ k) => MASTER_CATALYSTS.filter((c) => c.key === k).reduce((n, c) => n + c.n, 0);
  return recipeInputs(r).map((/** @type {any} */ i) => ({
    key: i.key,
    n: i.n,
    have: Math.max(0, workOf(book, i.key) - cat(i.key)),
  }));
}
/** Whether the works the book runs first (CRAFT1's chain) make the goods it lacks from raw - a good at what masterGoods
 *  leaves it. @param {any} r @param {any} book @param {{ key: string, have: number }[]} goods */
function goodsFromRaw(r, book, goods) {
  const inputs = recipeInputs(r),
    held = (/** @type {string} */ k) => goods.find((g) => g.key === k)?.have ?? workOf(book, k);
  if (typeof book?.track !== 'function' || typeof book?.store !== 'function' || !chainNeeded(inputs, held))
    return false;
  return chainPlan(inputs, held, { track: (p) => book.track(p), room: (k) => storesRoom(book.store(k)) }).ok === true;
}

/**
 * THE BOX: drawn into a station's craft box where the recipe takes a Master's work and its craft is at Master. `station`
 * the station's name (its choice kept by it), `state` its page state (`crafting`, `word` - handsAt reads them), `free`
 * whether the station could press now, its goods aside (the rank, the fee, the hands - AUDIT HORIZONTAL B4: the box
 * reads its own goods), `go(lines)` the craft door with the lines.
 * @param {HTMLElement} box @param {any} kit @param {any} r
 * @param {{ station: string, book: any, state: any, free: boolean, rerender: () => void, name: (k: string) => string, go: (lines: string[]) => Promise<any> }} o
 */
export function drawMasterBox(box, kit, r, { station, book, state, free, rerender, name, go }) {
  const { el } = kit;
  if (!masterRecipe(r) || (book?.track?.(masterTrackOf(r))?.rank ?? 0) < MASTER_RANK) return null;
  const sec = el('section', 'prof-master');
  sec.append(el('b', 'prof-master-head', t('prof.master.head', "Master's work")));
  sec.append(
    el(
      'p',
      'px-note',
      t(
        'prof.master.about',
        'A Legendary piece with three lines you choose. Their values roll in the Legendary band. It carries no Legendary power.',
      ),
    ),
  );
  const picks = masterPicks(station, r);
  const options = masterOptions(r);
  const busy = state.crafting === true;
  const lines = el('div', 'prof-master-lines');
  picks.forEach((key, i) => {
    const lab = el('label', 'prof-master-line');
    lab.append(el('span', null, t('prof.master.line', 'Line {n}', { n: i + 1 })));
    const sel = /** @type {HTMLSelectElement} */ (el('select', 'prof-master-pick'));
    sel.disabled = busy;
    const none = /** @type {HTMLOptionElement} */ (el('option', null, t('prof.master.choose', 'Choose a line')));
    none.value = '';
    sel.append(none);
    const others = picks.filter((_, j) => j !== i);
    const procElsewhere = others.filter((k) => options.find((o) => o.key === k)?.proc).length >= MASTER_PROCS_MAX;
    for (const [proc, word] of [
      [false, t('prof.master.bonuses', 'Bonuses')],
      [true, t('prof.master.effects', 'Effects, one at most')],
    ]) {
      const group = /** @type {HTMLOptGroupElement} */ (el('optgroup'));
      group.label = String(word);
      for (const o of options.filter((x) => x.proc === proc)) {
        const opt = /** @type {HTMLOptionElement} */ (el('option', null, masterOptionWords(o)));
        opt.value = o.key;
        opt.disabled = others.includes(o.key) || (o.proc && procElsewhere);
        group.append(opt);
      }
      if (group.children.length) sel.append(group);
    }
    sel.value = key;
    sel.onchange = () => {
      picks[i] = sel.value;
      rerender();
    };
    lab.append(sel);
    lines.append(lab);
  });
  sec.append(lines);
  sec.append(
    el('p', 'px-note', t('prof.master.takes', "It takes these goods, the station's fee and these catalysts:")),
  );
  const goods = masterGoods(r, book);
  for (const g of goods) {
    const words = t('prof.page.craft.input', '{name} {have} / {need} ({held} stored)', {
      name: name(g.key),
      have: Math.min(g.have, g.n),
      need: g.n,
      held: g.have,
    });
    sec.append(
      el('div', ['prof-input', 'prof-master-good', ...(g.have >= g.n ? [] : ['prof-short'])].join(' '), words),
    );
  }
  const needs = masterNeeds((k) => (typeof book?.held === 'function' ? book.held(k) : 0));
  for (const c of needs) {
    const where = pursuitWord(c.pursuit);
    const words = where
      ? t('prof.master.catalyst', '{name} {have} / {need} ({where})', {
          name: name(c.key),
          have: c.have,
          need: c.need,
          where,
        })
      : t('prof.master.catalystBare', '{name} {have} / {need}', { name: name(c.key), have: c.have, need: c.need });
    const cls = ['prof-input', 'prof-master-cat', ...(c.have >= c.need ? [] : ['prof-short'])];
    sec.append(el('div', cls.join(' '), words));
  }
  const made = book?.state?.master?.made === true;
  sec.append(
    el(
      'p',
      `px-note${made ? ' prof-short' : ''}`,
      made
        ? t('prof.master.madeToday', "Today's Master's work is made. The next can be made after midnight UTC.")
        : t('prof.master.oneADay', "One Master's work a day."),
    ),
  );
  const can =
    free &&
    !made &&
    !busy &&
    masterChoiceRefusal(r, picks) === null &&
    needs.every((c) => c.have >= c.need) &&
    (goods.every((g) => g.have >= g.n) || goodsFromRaw(r, book, goods));
  const btn = /** @type {HTMLButtonElement} */ (
    el(
      'button',
      'act primary prof-master-go',
      busy ? t('prof.master.making', 'Making...') : t('prof.master.go', "Make the Master's work"),
    )
  );
  btn.type = 'button';
  btn.disabled = !can;
  btn.onclick = async () => {
    if (btn.disabled) return;
    state.crafting = true;
    rerender();
    const res = await go([...picks]);
    state.crafting = false;
    state.word = res?.text ?? null;
    rerender();
  };
  sec.append(btn);
  const card = masterCard(kit, book?.state?.master?.last, r);
  if (card) sec.append(card);
  box.append(sec);
  return sec;
}

/** THE RESULT CARD: the last Master's work of this recipe - its name as the pack names it, the tier, its three lines at
 *  the values the service rolled. Null for none, or one of another recipe. @param {any} kit @param {any} last @param {any} r */
export function masterCard(kit, last, r) {
  if (!last || last.recipe !== r.id || !Array.isArray(last.lines)) return null;
  const { el } = kit;
  const card = el('div', 'prof-master-card');
  card.setAttribute('role', 'status');
  let piece = null;
  try {
    piece = mintPieces(last)[0] ?? null;
  } catch {
    piece = null;
  }
  card.append(
    el('b', 'prof-master-name', piece ? itemLongName(piece) : r.name),
    el('span', 'prof-master-tier', t('prof.master.legendary', 'Legendary')),
  );
  const list = el('ul', 'prof-master-got');
  for (const a of last.lines) list.append(el('li', null, affixLabel(a)));
  card.append(list);
  return card;
}
