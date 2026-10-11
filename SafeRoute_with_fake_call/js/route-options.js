import {distance,distanceToRoute} from './scoring.js?v=havens-1';
const line=f=>f.geometry.coordinates.map(p=>[p[1],p[0]]);
function overlap(a,b){
 let shared=0,total=0;
 for(let i=1;i<a.length;i++){
  const length=distance(a[i-1],a[i]),steps=Math.max(1,Math.ceil(length/40));
  for(let j=0;j<steps;j++){
   const t=(j+.5)/steps,p=a[i-1].map((v,k)=>v+(a[i][k]-v)*t);
   total+=length/steps;if(distanceToRoute(p,b)<=35)shared+=length/steps;
  }
 }
 return total?shared/total:1;
}
export function distinctRoutes(features,limit=5){
 const sorted=[...features].sort((a,b)=>a.properties.summary.distance-b.properties.summary.distance);
 if(!sorted.length)return [];
 const shortest=sorted[0].properties.summary.distance,chosen=[];
 for(const f of sorted){
  if(f.properties.summary.distance>Math.min(shortest*1.75,shortest+2000))continue;
  const points=line(f);
  // Compare both directions so an out-and-back spur isn't a new route.
  if(chosen.some(other=>Math.max(overlap(points,line(other)),overlap(line(other),points))>.8))continue;
  chosen.push(f);if(chosen.length===limit)break;
 }
 return chosen;
}
export function detourPoints(from,to){
 const length=distance(from,to);if(length<250)return [];
 const cos=Math.cos((from[0]+to[0])/2*Math.PI/180),dx=(to[1]-from[1])*111195*cos,dy=(to[0]-from[0])*111195;
 const norm=Math.hypot(dx,dy),offset=Math.min(650,Math.max(120,length*.22));
 return [.5,.3].flatMap(t=>[-1,1].map(side=>[
  from[0]+(to[0]-from[0])*t+side*dx/norm*offset/111195,
  from[1]+(to[1]-from[1])*t-side*dy/norm*offset/(111195*cos)
 ]));
}
