import { ClassFile } from '../../../src/formats/classFile.js';
import { openOut, out, closeOut, read, files, S, F } from './common.mjs';
openOut(process.argv[2]);
for (const name of files(/^CLASS.*\.CFG$/)) {
  const cf = new ClassFile();
  const ok = cf.load(read(name));
  const p = `class.${name}.`;
  out(p + 'load', ok);
  if (!ok) continue;
  const c = cf.career;
  out(p + 'name', S(c.name));
  out(p + 'hpPerLevel', c.hitPointsPerLevel);
  out(p + 'advMultiplier', F(c.advancementMultiplier));
  out(p + 'strength', c.strength); out(p + 'intelligence', c.intelligence);
  out(p + 'willpower', c.willpower); out(p + 'agility', c.agility);
  out(p + 'endurance', c.endurance); out(p + 'personality', c.personality);
  out(p + 'speed', c.speed); out(p + 'luck', c.luck);
  out(p + 'primary', c.primarySkills.join(','));
  out(p + 'major', c.majorSkills.join(','));
  out(p + 'minor', c.minorSkills.join(','));
}
await closeOut();
