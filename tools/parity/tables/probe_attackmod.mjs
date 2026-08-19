import fs from 'fs';
const { ClassFile } = await import('../../../src/formats/classFile.js');
const both = [];
for (let i=0;i<=18;i++) {
  const p = `${process.env.ARENA2_PATH ?? ""}/CLASS${String(i).padStart(2,'0')}.CFG`;
  const cf = new ClassFile(); cf.load(new Uint8Array(fs.readFileSync(p))); const c = cf.career;
  const f = c.attackModifierFlags;
  const groups = [['Undead',0x01,0x10],['Daedra',0x02,0x20],['Humanoid',0x04,0x40],['Animals',0x08,0x80]];
  const hits = groups.filter(([n,b,ph])=>((f&b)===b)&&((f&ph)===ph)).map(x=>x[0]);
  console.log(String(i).padStart(2), (c.name||'').padEnd(14), '0x'+f.toString(16).padStart(2,'0'),
    groups.map(([n,b,ph])=>`${n}${((f&b)===b?'+':'')}${((f&ph)===ph?'-':'')}`).join(' '), hits.length?('BOTH: '+hits.join(',')):'');
  if (hits.length) both.push([i, c.name, hits]);
}
console.log('\ncareers carrying BOTH bits for one group:', both.length, JSON.stringify(both));
