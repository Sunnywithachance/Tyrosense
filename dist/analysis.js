// Descriptive image comparison only. No TYR calibration or clinical thresholds.
export function meanRGB(data) {
  if (!data.length || data.length % 4) throw new Error('Invalid image pixels');
  const sum=[0,0,0]; let n=0;
  for(let i=0;i<data.length;i+=4){if(data[i+3]<128)continue; for(let c=0;c<3;c++)sum[c]+=data[i+c];n++;}
  if(!n)throw new Error('No visible pixels');
  return sum.map(v=>v/n);
}
export function compareRGB(before,after){
  if([...before,...after].length!==6||[...before,...after].some(v=>!Number.isFinite(v)||v<0||v>255))throw new Error('Invalid RGB values');
  return {distance:Math.hypot(...after.map((v,i)=>v-before[i])),before,after};
}
export function remainingSeconds(test,now=Date.now()){return Math.max(0,Math.ceil((test.dueAt-now)/1000));}
export function clock(seconds){const s=Math.max(0,Math.floor(seconds));return [Math.floor(s/3600),Math.floor(s/60)%60,s%60].map(v=>String(v).padStart(2,'0')).join(':');}
