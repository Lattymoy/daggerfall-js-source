import { readSpellsStd } from '../../../src/formats/spellsStd.js';
import { readMagicDef } from '../../../src/formats/magicDef.js';
import { openOut, out, closeOut, read, pad, S } from './common.mjs';
openOut(process.argv[2]);
const which = process.argv[3];
if (which === 'spells') {
  const spells = readSpellsStd(read('SPELLS.STD'));
  out('spells.count', spells.length);
  for (let i = 0; i < spells.length; i++) {
    const sp = spells[i];
    const p = `spells.${pad(i, 4)}.`;
    out(p + 'name', S(sp.name));
    out(p + 'element', sp.element);
    out(p + 'rangeType', sp.rangeType);
    out(p + 'cost', sp.cost);
    out(p + 'index', sp.index);
    out(p + 'icon', sp.icon);
    for (let e = 0; e < sp.effects.length; e++) {
      const ef = sp.effects[e];
      const q = `${p}e${e}.`;
      out(q + 'type', ef.type);
      out(q + 'subType', ef.subType);
      out(q + 'durationBase', ef.durationBase);
      out(q + 'durationMod', ef.durationMod);
      out(q + 'durationPerLevel', ef.durationPerLevel);
      out(q + 'chanceBase', ef.chanceBase);
      out(q + 'chanceMod', ef.chanceMod);
      out(q + 'chancePerLevel', ef.chancePerLevel);
      out(q + 'magnitudeBaseLow', ef.magnitudeBaseLow);
      out(q + 'magnitudeBaseHigh', ef.magnitudeBaseHigh);
      out(q + 'magnitudeLevelBase', ef.magnitudeLevelBase);
      out(q + 'magnitudeLevelHigh', ef.magnitudeLevelHigh);
      out(q + 'magnitudePerLevel', ef.magnitudePerLevel);
    }
  }
} else {
  const items = readMagicDef(read('MAGIC.DEF'));
  out('magic.count', items.length);
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const p = `magic.${pad(i, 4)}.`;
    out(p + 'index', it.index);
    out(p + 'name', S(it.name));
    out(p + 'type', it.type);
    out(p + 'group', it.group);
    out(p + 'groupIndex', it.groupIndex);
    out(p + 'uses', it.uses);
    out(p + 'value', it.value);
    out(p + 'material', it.material);
    for (let e = 0; e < it.enchantments.length; e++)
      out(`${p}ench${pad(e, 2)}`, `${it.enchantments[e].type},${it.enchantments[e].param}`);
  }
}
await closeOut();
