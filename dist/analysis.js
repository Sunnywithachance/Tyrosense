// Mean sRGB of the central 40% of each PNG in Baseline_images.
export const patchColourReferences = [
  {label: '0', rgb: [204.22, 180.41, 140.04]},
  {label: '0.1', rgb: [181.79, 155.91, 112.75]},
  {label: '0.5', rgb: [172.12, 149.35, 110.25]},
  {label: '2.5', rgb: [147.44, 123.82, 99.01]},
  {label: '10', rgb: [131.43, 109.70, 87.49]},
  {label: '50', rgb: [103.42, 79.24, 64.64]},
  {label: '100', rgb: [77.79, 61.50, 53.26]},
  {label: '200', rgb: [77.04, 58.23, 50.32]},
];

export function meanRGB(data) {
  if (!data.length || data.length % 4) throw new Error('Invalid image pixels');
  const sum=[0,0,0]; let n=0;
  for(let i=0;i<data.length;i+=4){if(data[i+3]<128)continue; for(let c=0;c<3;c++)sum[c]+=data[i+c];n++;}
  if(!n)throw new Error('No visible pixels');
  return sum.map(v=>v/n);
}
export function compareRGB(before,after){
  if([...before,...after].length!==6||[...before,...after].some(v=>!Number.isFinite(v)||v<0||v>255))throw new Error('Invalid colour values');
  return {distance:Math.hypot(...after.map((v,i)=>v-before[i])),before,after};
}

export function matchPatchChange(before, after) {
  compareRGB(before, after); // Validate the stored colour samples.
  const [initial] = patchColourReferences;
  const change = after.map((value, channel) => value - before[channel]);
  let closest = initial;
  let smallestDistance = Infinity;
  for (const swatch of patchColourReferences) {
    const distance = Math.hypot(...swatch.rgb.map((value, channel) =>
      change[channel] - (value - initial.rgb[channel])
    ));
    if (distance < smallestDistance) {
      closest = swatch;
      smallestDistance = distance;
    }
  }
  return {before: initial.label, after: closest.label};
}

export function remainingSeconds(test,now=Date.now()){return Math.max(0,Math.ceil((test.dueAt-now)/1000));}
export function clock(seconds){const s=Math.max(0,Math.floor(seconds));return [Math.floor(s/3600),Math.floor(s/60)%60,s%60].map(v=>String(v).padStart(2,'0')).join(':');}
