const point = p => p?.length === 3 && Array.from(p).every(Number.isFinite);
// Read the native live pool, so packing/despawning and floating-origin shifts
// are reflected immediately. Never persist another player's camp or stale coords.
export function campOverworldMarks(pool) {
  const marks=[];
  for(const camp of pool?.camps??[]) {
    if(camp.owner!=null||camp.hidden||!point(camp.rec?.pos))continue;
    const tent=camp.rec.kind==='tent';
    marks.push({key:`keta-camp-${camp.rec.id??marks.length}`,at:[...camp.rec.pos],
      label:tent?'My campsite':'My campfire',sub:tent?'Your camping equipment':'Your placed campfire',kind:'place',edge:true});
    if(marks.length===16)break;
  }
  return marks;
}
export function ownCampMarks(pool, feet) {
  if (!point(feet)) return [];
  return (pool?.camps ?? []).filter(c => c.owner == null && !c.hidden && point(c.rec?.pos))
    .map(c => ({ at: [c.rec.pos[0],c.rec.pos[1]+(Number.isFinite(c.batch?.size?.h)?Math.max(0,c.batch.size.h):0),c.rec.pos[2]], distance: Math.hypot(...c.rec.pos.map((v,i)=>v-feet[i])) }))
    .filter(c => c.distance <= 1024).sort((a,b) => a.distance-b.distance).slice(0,16);
}
// Close: a short, subdued wisp. Far: rises above the canopy, never above 100m.
export function campBeamStyle(distance, {height=100,opacity=.6,exterior=true}={}) {
  const t=Math.max(0,Math.min(1,(distance-15)/185));
  const smooth=t*t*(3-2*t), maximum=Math.max(5,Math.min(100,height));
  return {height:exterior?Math.min(maximum,5+(maximum-5)*smooth):6,
    opacity:Math.max(.1,Math.min(.6,opacity))*(.55+.45*smooth),throughWalls:false};
}
