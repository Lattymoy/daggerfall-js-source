// @ts-check
// DELVE II (DLV5, bible/03-World/Delve-II.md section 8): THE LAB'S PANEL, over the bench's own dungeon (`?dungeon=lab`,
// opened from delve.html). Walk the block; each button puts a thing at your feet in the block's own frame - a model or a
// flat set on the floor there, a marker, a light over you, a drop, an anchor or its vault - and Rebuild lays the block
// again with it, you where you stood. Check asks the site law of every anchor; Export gives the record as
// src/assets/delve/<id>.json takes it. The law is world/dungeon/curatedLab.js; this file is its buttons alone. A developer's
// tool: its words are not the game's.
import { labPut, labTake, labVault, labExport, labTypes } from '../../world/dungeon/curatedLab.js';
import { CURATED_MARKERS } from '../../world/dungeon/curatedBlocks.js';
import { CURATED_RECORDS } from '../../world/dungeon/curatedRecords.js';
import { DELVE_KIND_NAMES } from '../../net/delve/delveLaw.js';
import { DUNGEON_TYPES } from '../../formats/mapsFile.js';

const CSS = `#delve-lab { position: fixed; right: 10px; top: 10px; width: min(360px, calc(100vw - 32px)); max-height: calc(100vh - 20px);
  overflow: auto; background: rgba(14, 16, 19, 0.92); color: #e9e4d9; font: 12px system-ui, sans-serif; padding: 10px;
  border: 1px solid #2b323b; z-index: 30; box-sizing: border-box; }
#delve-lab h2 { font-size: 13px; margin: 0 0 6px; } #delve-lab h3 { font-size: 12px; margin: 10px 0 4px; color: #c08a3e; }
#delve-lab input, #delve-lab select, #delve-lab button { font: inherit; margin: 2px 2px 2px 0; }
#delve-lab input[type=number] { width: 5.5em; } #delve-lab .row { display: flex; flex-wrap: wrap; align-items: center; gap: 2px; }
#delve-lab ul { margin: 0; padding-left: 16px; } #delve-lab li button { margin-left: 6px; }
#delve-lab .say { color: #9aa3ad; min-height: 1.2em; white-space: pre-wrap; } #delve-lab .bad { color: #e07a5f; }`;

/**
 * The panel, mounted once: `draft` the lab's record, `feet()` the player's feet, `landing(at, r)` the site law's word on
 * a spot (scenes/delve/delveHost.js landing), `foot(item)` how far a model's or a flat's origin stands over its foot
 * (scenes/delve/delveBench.js labFoot; null for one the data lacks), `rebuild(draft, at)` keeps the draft and lays the
 * block again with me at `at` - or says why not (curatedLab.js labKeep), and nothing is lost.
 * @param {{ draft: any, feet: () => number[], landing: (at: number[], r: number) => any, foot: (item: any) => Promise<number | null>,
 *   rebuild: (d: any, at: number[]) => string | null, doc?: Document }} o
 */
export function mountDelveLab({ draft, feet, landing, foot, rebuild, doc = document }) {
  let d = draft;
  const el = (tag, attrs = {}, ...kids) => {
    const e = doc.createElement(tag);
    Object.assign(e, attrs);
    for (const k of kids) e.append(k);
    return e;
  };
  const num = (value, step = 1) => el('input', { type: 'number', value: String(value), step: String(step) });
  const style = el('style', { textContent: CSS });
  const panel = el('div', { id: 'delve-lab' });
  for (const k of ['keydown', 'keyup']) panel.addEventListener(k, (e) => e.stopPropagation()); // typing here walks no one
  const say = el('div', { className: 'say' });
  const tell = (text, bad = false) => {
    say.textContent = text;
    say.className = bad ? 'say bad' : 'say';
  };
  const at = () => feet().map((v) => Math.round(v * 100) / 100);
  const putAt = (list, item, p) => {
    const r = labPut(d, list, item, p);
    if (r.why) tell(r.why, true);
    else {
      d = r.draft;
      draw();
      tell(`${list}: ${JSON.stringify(item)} at ${p.join(', ')}`);
    }
  };
  const put = (list, item) => putAt(list, item, at());
  /** A model or a flat set on the floor at my feet: its origin its foot's height over them. */
  const stand = async (item) => {
    const up = await foot(item);
    if (up == null) {
      tell(`${JSON.stringify(item)}: not in your game's data`, true);
      return;
    }
    const p = at();
    putAt('add', item, [p[0], p[1] + up, p[2]]);
  };

  const id = el('input', { value: d.id }),
    base = el('input', { value: d.base });
  const types = el('input', { value: d.types.join(', ') }); // AUDIT DLV5-6 M5: every type the record joins, never the first alone
  const typeNames = Object.entries(DUNGEON_TYPES)
    .filter(([k]) => k !== 'NoDungeon')
    .map(([k, v]) => `${v} ${k}`)
    .join(', ');
  const where = el('div', { className: 'say' });
  const model = num(41300),
    rotY = num(0, 15),
    marker = el('select'),
    mobile = num(0),
    archive = num(199),
    record = num(0);
  for (const k of Object.keys(CURATED_MARKERS)) marker.append(el('option', { value: k, textContent: k }));
  const dropWhat = el('select'),
    dropId = el('input', { value: 'foe' }),
    dropR = num(3, 0.5);
  for (const k of ['marker', 'model', 'flat']) dropWhat.append(el('option', { value: k, textContent: k }));
  const reach = num(6, 0.5),
    over = num(2.2, 0.1);
  const kind = el('select'),
    wardR = el('select');
  for (const k of DELVE_KIND_NAMES) kind.append(el('option', { value: k, textContent: k }));
  for (const r of [4, 3]) wardR.append(el('option', { value: String(r), textContent: `${r} m` }));
  const lists = el('div');
  const ship = el('select');
  for (const r of CURATED_RECORDS) ship.append(el('option', { value: r.id, textContent: `${r.id} (${r.n})` }));
  const exportN = num(d.from ?? Math.max(1, ...CURATED_RECORDS.map((r) => r.n + 1))); // AUDIT DLV5-6 M5: a shipped block ships as its own number
  const btn = (text, fn) => el('button', { type: 'button', textContent: text, onclick: fn });
  /** The draft with the panel's id, base and types - or why not. */
  const drafted = () => {
    const t = labTypes(types.value);
    return t
      ? { draft: { ...d, id: id.value.trim(), base: base.value.trim().toUpperCase(), types: t } }
      : { why: 'types: the dungeon types it joins, by number (1, 2, 11)' };
  };
  const dropItem = () => {
    if (dropWhat.value === 'marker') return { marker: dropId.value };
    if (dropWhat.value === 'model') return { model: Number(dropId.value) };
    return { flat: dropId.value.split(',').map(Number) };
  };

  function draw() {
    lists.replaceChildren();
    for (const list of ['add', 'drop', 'anchors']) {
      lists.append(el('h3', { textContent: `${list} (${(d[list] ?? []).length})` }));
      const ul = el('ul');
      (d[list] ?? []).forEach((item, k) =>
        ul.append(
          el(
            'li',
            {},
            JSON.stringify(item),
            btn('x', () => {
              d = labTake(d, list, k);
              draw();
            }),
          ),
        ),
      );
      lists.append(ul);
    }
  }
  panel.append(
    el('h2', { textContent: 'Delve lab - a curated block' }),
    el('div', { className: 'row' }, 'id ', id, ' base ', base, ' types ', types),
    el('div', { className: 'say' }, typeNames),
    where,
    el('h3', { textContent: 'At my feet' }),
    el(
      'div',
      { className: 'row' },
      'model ',
      model,
      ' turn ',
      rotY,
      btn('Model here', () => stand({ model: Number(model.value), rot: [0, Number(rotY.value), 0] })),
    ),
    el(
      'div',
      { className: 'row' },
      'marker ',
      marker,
      ' mobile ',
      mobile,
      btn('Marker here', () =>
        put('add', marker.value === 'foe' ? { marker: 'foe', mobile: Number(mobile.value) } : { marker: marker.value }),
      ),
    ),
    el(
      'div',
      { className: 'row' },
      'flat ',
      archive,
      record,
      btn('Flat here', () => stand({ flat: [Number(archive.value), Number(record.value)] })),
    ),
    el(
      'div',
      { className: 'row' },
      'light reach ',
      reach,
      ' m, ',
      over,
      ' m over me',
      btn('Light here', () => {
        const p = at();
        putAt('add', { light: Number(reach.value) }, [p[0], p[1] + Number(over.value), p[2]]);
      }),
    ),
    el(
      'div',
      { className: 'row' },
      'drop ',
      dropWhat,
      dropId,
      ' within ',
      dropR,
      btn('Drop here', () => put('drop', { ...dropItem(), r: Number(dropR.value) })),
    ),
    el(
      'div',
      { className: 'row' },
      'anchor ',
      kind,
      wardR,
      btn('Anchor here', () => put('anchors', { kind: kind.value, r: Number(wardR.value) })),
      btn('Its vault here', () => {
        const r = labVault(d, at());
        if (r.why) tell(r.why, true);
        else {
          d = r.draft;
          draw();
        }
      }),
    ),
    el(
      'div',
      { className: 'row' },
      btn('Check the anchors', () =>
        tell(
          (d.anchors ?? [])
            .map((a) => {
              const w = landing(a.at, a.r);
              return `${a.kind} at ${a.at.join(', ')}: ${w.ok ? 'stands' : `refused (${w.rule})`}`;
            })
            .join('\n') || 'no anchors',
        ),
      ),
    ),
    lists,
    el('h3', { textContent: 'The record' }),
    el(
      'div',
      { className: 'row' },
      btn('Rebuild', () => {
        const r = drafted();
        if (r.why) {
          tell(r.why, true);
          return;
        }
        const why = rebuild(r.draft, at());
        if (why) tell(why, true);
      }),
      ' ship as number ',
      exportN,
      btn('Export', () => {
        const rec = drafted();
        if (rec.why) {
          tell(rec.why, true);
          return;
        }
        const r = labExport(rec.draft, Number(exportN.value));
        if (r.why) {
          tell(r.why, true);
          return;
        }
        const a = el('a', {
          href: URL.createObjectURL(new Blob([r.text], { type: 'application/json' })),
          download: `${id.value}.json`,
        });
        a.click();
        globalThis.navigator?.clipboard?.writeText(r.text).catch(() => {});
        tell(
          `src/assets/delve/${id.value}.json, number ${exportN.value}: list it in src/world/dungeon/curatedRecords.js`,
        );
      }),
    ),
    el(
      'div',
      { className: 'row' },
      'open a shipped one ',
      ship,
      btn('Open', () => {
        globalThis.location.search = `?dungeon=lab&lab=${encodeURIComponent(ship.value)}&class=1&novideo`;
      }),
    ),
    say,
  );
  doc.head.append(style);
  doc.body.append(panel);
  draw();
  const tick = setInterval(() => {
    const f = at();
    where.textContent = `feet ${f.join(', ')} - the block's frame (its north-west corner 0, 0)`;
  }, 250);
  return {
    panel,
    draft: () => d,
    destroy() {
      clearInterval(tick);
      panel.remove();
      style.remove();
    },
  };
}
