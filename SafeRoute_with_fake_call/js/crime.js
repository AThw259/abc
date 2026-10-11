// User-defined severity weights, matched to NIBRS codes or explicit descriptions.
export const crimePenalties={drug:-1,vandalism:-1,shoplifting:-2,theft:-3,vehicle_theft:-4,burglary:-4,robbery:-6,simple_assault:-5,aggravated_assault:-8,weapons:-7,shooting:-10,sexual:-10,kidnapping:-10,homicide:-12};
const codes={'35A':'drug','35B':'drug','290':'vandalism','23C':'shoplifting','240':'vehicle_theft','220':'burglary','120':'robbery','13B':'simple_assault','13A':'aggravated_assault','520':'weapons','100':'kidnapping','09A':'homicide','09B':'homicide','09C':'homicide','11A':'sexual','11B':'sexual','11C':'sexual','11D':'sexual','36A':'sexual','36B':'sexual'};
export function classifyCrime(attributes){
 const code=String(attributes.NibrsUcrCode||'').trim().toUpperCase();
 const label=String(attributes.NIBRS_Offense||'').toLowerCase();
 let type=codes[code]||(/^23[A-H]$/.test(code)?'theft':undefined);
 if(!type){
  const rules=[['homicide',/homicide|murder|manslaughter/],['kidnapping',/kidnap|abduction/],['sexual',/sexual|rape|sodomy|incest/],['aggravated_assault',/aggravated assault/],['simple_assault',/simple assault/],['weapons',/weapon/],['robbery',/robbery/],['burglary',/burglary|breaking.*entering/],['vehicle_theft',/motor vehicle theft|vehicle theft/],['shoplifting',/shoplift|retail theft/],['theft',/theft|larceny/],['drug',/drug|narcotic/],['vandalism',/vandalism|property damage|damage.*property/]];
  type=rules.find(([,pattern])=>pattern.test(label))?.[0];
 }
 // Preserve the larger homicide penalty; mere firearm involvement is not shooting.
 if(/\bshooting\b|\bshot fired\b|\bshots fired\b/.test(label)&&(!type||crimePenalties[type]>-10))type='shooting';
 return type?{type,points:crimePenalties[type]}:null;
}
