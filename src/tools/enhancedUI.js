// ═══════════════════════════════════════════════════════════════════
// ENHANCED — a modern UI for Daggerfall
//
// A PROTOTYPE. It is wired to the real data and to nothing else: no
// save, no game state, no integration. It exists to be argued with.
//
// ── THE FINDING THAT DRIVES EVERY DECISION HERE ──────────────────
//
// "Make it more like Skyrim" cannot mean "show as little as Skyrim
// shows", because Daggerfall is three to four times denser in every
// axis and the density is the game:
//
//     35 skills          Skyrim has 18
//     28 equip slots     Skyrim has about 10
//     30 item groups     Skyrim has 8
//
// Nine of those skills are creature LANGUAGES. There is no Skyrim
// equivalent of being able to talk a Daedra out of a fight, and a UI
// that flattens to Skyrim's shape would have nowhere to put it.
//
// So what is borrowed from Skyrim is its INTERACTION MODEL, not its
// information architecture: one thing at a time, targets big enough for
// a thumb, and every screen reachable by four directions and a confirm.
// That last property is why Skyrim's menus work on a controller — and it
// is exactly what makes a layout work on a phone.
//
// Daggerfall's density is then handled by DISCLOSURE rather than
// deletion. Nothing is thrown away; it is one press further in.
//
// ── THE SIGNATURE: THE SLOT MAP ──────────────────────────────────
//
// Twenty-eight equipment slots is absurd, and it is also the most
// Daggerfall thing in the game — two amulets, two bracelets, two marks,
// two crystals, chest armour AND chest clothes as separate layers. The
// classic paperdoll draws this as a picture of a person and you hunt for
// the slots.
//
// Here it is an information graphic: a body schematic where every slot
// is a node, filled nodes are lit, and the whole state of a character's
// kit reads in one glance at any size. A picture of a person tells you
// how they look. This tells you what you are carrying, which is what the
// screen is for.
//
// ── WHY NOT A BLACK VOID ─────────────────────────────────────────
//
// Skyrim's menus float in near-black nothing. That is a real choice for
// a game about a cold empty north, and it is the wrong one for the
// Iliac Bay. Daggerfall's own chrome is carved stone with BRASS
// fittings; this keeps the metal and drops the ornament — matte,
// structural, no bevels. The accent is brass because the game already
// owns it, and its counterpart is verdigris, which is what brass
// becomes.
// ═══════════════════════════════════════════════════════════════════

import { SKILL_NAMES } from '../systems/skills.js';
import { ITEM_GROUPS } from '../characters/equipRules.js';
import { EQUIP_SLOTS } from '../characters/paperdoll.js';

const skills = Array.isArray(SKILL_NAMES) ? SKILL_NAMES : Object.values(SKILL_NAMES);
const groups = Object.keys(ITEM_GROUPS).filter((g) => g !== 'None');
const slots = Object.keys(EQUIP_SLOTS).filter((s) => s !== 'None' && !s.startsWith('Unknown'));

// ── SAMPLE STATE ─────────────────────────────────────────────────
// Invented, and clearly so: a prototype needs something to render and
// this is not pretending to be a save file. The SHAPE is real — these
// are the game's own attributes, skills and slots.
const HERO = {
  name: 'Vaerin of Daggerfall',
  klass: 'Spellsword',
  level: 9,
  health: [84, 112],
  magicka: [61, 96],
  fatigue: [140, 168],
  gold: 2417,
  weight: [82, 130],
  attributes: {
    Strength: 62,
    Intelligence: 71,
    Willpower: 58,
    Agility: 66,
    Endurance: 54,
    Personality: 49,
    Speed: 63,
    Luck: 51,
  },
  // A handful of skills raised; the rest sit at their starting values.
  skilled: {
    'Long Blade': 68,
    Destruction: 61,
    Restoration: 44,
    Mysticism: 39,
    Dodging: 52,
    Etiquette: 31,
    Daedric: 22,
    Streetwise: 28,
    Mercantile: 35,
    'Critical Strike': 41,
  },
  equipped: {
    Head: 'Steel Helm',
    ChestArmor: 'Elven Cuirass',
    ChestClothes: 'Casual Shirt',
    RightHand: 'Silver Longsword',
    LeftHand: 'Steel Buckler',
    Gloves: 'Leather Gauntlets',
    LegsArmor: 'Steel Greaves',
    Feet: 'Leather Boots',
    Ring0: 'Ring of Feather',
    Amulet0: "Mara's Charm",
    Cloak1: 'Formal Cloak',
  },
};

const BAG = [
  { name: 'Silver Longsword', group: 'Weapons', w: 6, v: 1200, note: 'Silver · 42 / 48 condition' },
  { name: 'Elven Cuirass', group: 'Armor', w: 22, v: 3400, note: 'Elven · worn' },
  { name: 'Ring of Feather', group: 'Jewellery', w: 0, v: 5200, note: 'Feather · 14 charges' },
  { name: 'Potion of Healing', group: 'MiscItems', w: 1, v: 90, note: '×3' },
  { name: 'Chronicles of Nchuleft', group: 'Books', w: 2, v: 150, note: 'Unread' },
  { name: "Wayrest Harbour Deed", group: 'Deeds', w: 0, v: 0, note: 'Ship berth' },
  { name: 'Daedra Heart', group: 'CreatureIngredients1', w: 1, v: 400, note: 'Reagent' },
  { name: 'Map of the Wrothgarians', group: 'Maps', w: 1, v: 60, note: '3 dungeons marked' },
];

// ── THE SLOT MAP ─────────────────────────────────────────────────
// Where each of the game's slots sits on the body schematic, in
// percentages so it scales with the frame. Paired slots sit either side
// of the spine, which is what makes "two of everything" legible instead
// of confusing.
const SLOT_MAP = {
  Head: [50, 7],
  Amulet0: [37, 17],
  Amulet1: [63, 17],
  Cloak1: [22, 24],
  Cloak2: [78, 24],
  ChestClothes: [42, 30],
  ChestArmor: [58, 30],
  RightArm: [28, 34],
  LeftArm: [72, 34],
  Bracer0: [24, 46],
  Bracer1: [76, 46],
  Bracelet0: [17, 54],
  Bracelet1: [83, 54],
  RightHand: [26, 62],
  LeftHand: [74, 62],
  Gloves: [50, 60],
  Ring0: [34, 68],
  Ring1: [66, 68],
  Mark0: [40, 44],
  Mark1: [60, 44],
  Crystal0: [40, 51],
  Crystal1: [60, 51],
  LegsClothes: [42, 74],
  LegsArmor: [58, 74],
  Feet: [50, 92],
};

const SCREENS = ['Inventory', 'Character', 'Magic', 'Map', 'Journal'];
let screen = 'Inventory';
let group = 'All';
let picked = BAG[0];
// On a phone the third pane is a SHEET rather than a column: there is
// only one column on a phone whatever you do, and a detail that lives
// below a list is a detail nobody scrolls to.
let sheetOpen = false;

const el = (t, cls, txt) => {
  const n = document.createElement(t);
  if (cls) n.className = cls;
  if (txt != null) n.textContent = txt;
  return n;
};

/** Pretty-print the game's own CamelCase group keys. */
const pretty = (s) =>
  s
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Za-z])(\d)/g, '$1 $2')
    .replace(/Ingredients/g, 'Ingr.');

function bar(label, [now, max], tone) {
  const w = el('div', 'bar');
  const head = el('div', 'bar-head');
  head.append(el('span', 'bar-label', label), el('span', 'bar-num', `${now} / ${max}`));
  const track = el('div', 'bar-track');
  const fill = el('div', `bar-fill ${tone}`);
  fill.style.width = `${Math.round((now / max) * 100)}%`;
  track.append(fill);
  w.append(head, track);
  return w;
}

function slotMap() {
  const wrap = el('div', 'slotmap');
  const fig = el('div', 'figure');
  // The schematic: a spine and a shoulder line, and nothing else. It is
  // a diagram of where things GO, not a drawing of a person.
  fig.innerHTML =
    '<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' +
    '<line x1="50" y1="6" x2="50" y2="96" /><line x1="26" y1="30" x2="74" y2="30" />' +
    '<line x1="26" y1="30" x2="24" y2="64" /><line x1="74" y1="30" x2="76" y2="64" />' +
    '<line x1="42" y1="70" x2="40" y2="94" /><line x1="58" y1="70" x2="60" y2="94" />' +
    '</svg>';
  for (const [slot, [x, y]] of Object.entries(SLOT_MAP)) {
    const filled = HERO.equipped[slot];
    const node = el('button', `node${filled ? ' on' : ''}`);
    node.style.left = `${x}%`;
    node.style.top = `${y}%`;
    node.title = `${pretty(slot)}${filled ? ' — ' + filled : ' — empty'}`;
    node.setAttribute('aria-label', node.title);
    node.onclick = () => {
      const found = BAG.find((i) => i.name === filled);
      if (found) {
        picked = found;
        render();
      }
    };
    fig.append(node);
  }
  const count = Object.keys(HERO.equipped).length;
  wrap.append(fig);
  const cap = el('div', 'slotcap');
  cap.append(el('span', 'k', `${count} of ${slots.length}`), el('span', 'v', 'slots filled'));
  wrap.append(cap);
  return wrap;
}

function inventory() {
  const pane = el('div', 'panes');

  // Column 1: the categories, as a scrolling rail rather than tabs.
  // Thirty of them will not fit across a phone, and hiding two-thirds
  // behind a "more" control is how Daggerfall's density gets lost.
  const cats = el('div', 'rail');
  for (const g of ['All', ...groups]) {
    const b = el('button', `railbtn${g === group ? ' on' : ''}`, pretty(g));
    const n = g === 'All' ? BAG.length : BAG.filter((i) => i.group === g).length;
    if (n) b.append(el('span', 'count', String(n)));
    else b.classList.add('empty');
    b.onclick = () => {
      group = g;
      render();
    };
    cats.append(b);
  }

  // Column 2: the list.
  const list = el('div', 'list');
  const shown = BAG.filter((i) => group === 'All' || i.group === group);
  if (!shown.length) {
    const e = el('div', 'empty-state');
    e.append(el('p', null, `Nothing in ${pretty(group)}.`), el('p', 'dim', 'Loot, buy or craft to fill it.'));
    list.append(e);
  }
  for (const it of shown) {
    const row = el('button', `row${it === picked ? ' on' : ''}`);
    const main = el('div', 'row-main');
    main.append(el('div', 'row-name', it.name), el('div', 'row-note', it.note));
    const side = el('div', 'row-side');
    side.append(el('div', 'row-val', it.v ? `${it.v} g` : '—'), el('div', 'row-w', `${it.w} kg`));
    row.append(main, side);
    row.onclick = () => {
      picked = it;
      sheetOpen = true; // a phone shows the detail as a sheet; a desk ignores this
      render();
    };
    list.append(row);
  }

  // Column 3: the detail, and the slot map above it.
  // THE CARD COMES FIRST. It was under the slot map, which pushed the
  // Equip/Drop/Sell actions off the bottom on a desk and put the whole
  // detail below the fold on a phone — you tapped an item and nothing
  // appeared to happen. The map is context; the card is the answer to
  // the tap, and the answer goes at the top.
  const detail = el('div', 'detail');
  if (picked) {
    const d = el('div', 'card');
    d.append(el('div', 'card-kicker', pretty(picked.group)));
    d.append(el('h2', null, picked.name));
    d.append(el('p', 'card-note', picked.note));
    const stats = el('dl', 'stats');
    for (const [k, v] of [
      ['Value', picked.v ? `${picked.v} gold` : 'Not for sale'],
      ['Weight', `${picked.w} kg`],
      ['Group', pretty(picked.group)],
    ]) {
      stats.append(el('dt', null, k), el('dd', null, v));
    }
    d.append(stats);
    const acts = el('div', 'acts');
    for (const a of ['Equip', 'Drop', 'Sell']) acts.append(el('button', a === 'Equip' ? 'act primary' : 'act', a));
    d.append(acts);
    detail.append(d);
  }
  detail.append(slotMap());

  if (sheetOpen) detail.classList.add('open');
  const close = el('button', 'sheet-close', 'Close');
  close.onclick = () => {
    sheetOpen = false;
    render();
  };
  detail.prepend(close);
  pane.append(cats, list, detail);
  return pane;
}

function character() {
  const pane = el('div', 'panes wide');

  const left = el('div', 'col');
  left.append(el('h3', 'colhead', 'Attributes'));
  const attrs = el('div', 'attrs');
  for (const [k, v] of Object.entries(HERO.attributes)) {
    const a = el('div', 'attr');
    a.append(el('span', 'attr-k', k), el('span', 'attr-v', String(v)));
    const t = el('div', 'attr-track');
    const f = el('div', 'attr-fill');
    f.style.width = `${v}%`;
    t.append(f);
    a.append(t);
    attrs.append(a);
  }
  left.append(attrs);

  // THIRTY-FIVE SKILLS, and the ones that matter are the ones the
  // player has raised. The rest are one press away rather than absent —
  // this is the disclosure the density argument turns on.
  const mid = el('div', 'col');
  mid.append(el('h3', 'colhead', 'Skills'));
  const sk = el('div', 'skills');
  const raised = Object.entries(HERO.skilled).sort((a, b) => b[1] - a[1]);
  for (const [k, v] of raised) {
    const r = el('div', 'skill');
    r.append(el('span', 'skill-k', k), el('span', 'skill-v', String(v)));
    sk.append(r);
  }
  const more = el('button', 'more', `Show all ${skills.length} skills`);
  more.onclick = () => {
    sk.innerHTML = '';
    for (const name of skills) {
      const v = HERO.skilled[name] ?? 5 + ((name.length * 7) % 14);
      const r = el('div', `skill${HERO.skilled[name] ? ' raised' : ''}`);
      r.append(el('span', 'skill-k', name), el('span', 'skill-v', String(v)));
      sk.append(r);
    }
    more.remove();
  };
  mid.append(sk, more);

  const right = el('div', 'col');
  right.append(el('h3', 'colhead', 'Condition'));
  const vit = el('div', 'vitals');
  vit.append(
    bar('Health', HERO.health, 'blood'),
    bar('Magicka', HERO.magicka, 'verdigris'),
    bar('Fatigue', HERO.fatigue, 'brass'),
  );
  right.append(vit);
  right.append(slotMap());

  pane.append(left, mid, right);
  return pane;
}

function placeholder(title, line) {
  const p = el('div', 'placeholder');
  p.append(el('h2', null, title), el('p', null, line));
  return p;
}

const app = document.getElementById('app');

function render() {
  app.innerHTML = '';

  // ── THE PLAY HUD ───────────────────────────────────────────────
  // What is on screen when no menu is open: three bars and nothing
  // else. Shown here behind the menu so the two can be judged
  // together, which is the thing a static mockup never lets you do.
  const hud = el('div', 'hud');
  const hb = el('div', 'hudbars');
  for (const [v, tone] of [
    [HERO.health, 'blood'],
    [HERO.magicka, 'verdigris'],
    [HERO.fatigue, 'brass'],
  ]) {
    const t = el('div', 'hudbar');
    const f = el('div', `hudfill ${tone}`);
    f.style.width = `${Math.round((v[0] / v[1]) * 100)}%`;
    t.append(f);
    hb.append(t);
  }
  hud.append(hb);

  const head = el('header', 'top');
  const who = el('div', 'who');
  who.append(el('div', 'who-name', HERO.name), el('div', 'who-sub', `${HERO.klass} · level ${HERO.level}`));
  const purse = el('div', 'purse');
  purse.append(
    el('span', 'purse-n', HERO.gold.toLocaleString()),
    el('span', 'purse-l', 'gold'),
    el('span', 'purse-n', `${HERO.weight[0]}`),
    el('span', 'purse-l', `/ ${HERO.weight[1]} kg`),
  );
  head.append(who, purse);

  const body = el('main', 'body');
  body.append(
    screen === 'Inventory'
      ? inventory()
      : screen === 'Character'
        ? character()
        : placeholder(screen, 'Not in this prototype yet — the shape is the argument, not the coverage.'),
  );

  // ── THE RAIL ───────────────────────────────────────────────────
  // On a phone this sits at the BOTTOM, in the thumb's arc. Skyrim
  // puts its screen switcher at the top because a controller does not
  // care where it is; a thumb does, and that is the single biggest
  // change a phone forces on this design.
  const nav = el('nav', 'nav');
  for (const s of SCREENS) {
    const b = el('button', `navbtn${s === screen ? ' on' : ''}`, s);
    b.onclick = () => {
      screen = s;
      render();
    };
    nav.append(b);
  }

  app.append(hud, head, body, nav);
}

render();
