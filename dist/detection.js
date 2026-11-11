// Lightweight geometric candidate detection, not patch recognition.
// Runs on small preview frames, without transmitting images to a service.
const cross = (o, a, b) => (a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x);
const area = points => Math.abs(points.reduce((s,p,i) => {
  const q=points[(i+1)%points.length]; return s+p.x*q.y-p.y*q.x;
},0))/2;

function hull(points) {
  points.sort((a,b)=>a.x-b.x||a.y-b.y);
  const lower=[],upper=[];
  for(const p of points){while(lower.length>1&&cross(lower.at(-2),lower.at(-1),p)<=0)lower.pop();lower.push(p);}
  for(const p of points.slice().reverse()){while(upper.length>1&&cross(upper.at(-2),upper.at(-1),p)<=0)upper.pop();upper.push(p);}
  return lower.slice(0,-1).concat(upper.slice(0,-1));
}

function quadrilateral(points,width,height) {
  const boundary=hull(points);
  if(boundary.length<4)return null;
  const originalArea=area(boundary);
  if(originalArea<width*height*.025||originalArea>width*height*.65)return null;
  const corners=boundary.slice();
  while(corners.length>4){
    let best=Infinity,index=0;
    for(let i=0;i<corners.length;i++){
      const loss=Math.abs(cross(corners[(i+corners.length-1)%corners.length],corners[i],corners[(i+1)%corners.length]));
      if(loss<best){best=loss;index=i;}
    }
    corners.splice(index,1);
  }
  const quadArea=area(corners);
  // Circles and irregular contours lose too much area when reduced to four sides.
  if(quadArea/originalArea<.88)return null;
  const lengths=corners.map((p,i)=>Math.hypot(p.x-corners[(i+1)%4].x,p.y-corners[(i+1)%4].y));
  if(Math.min(...lengths)/Math.max(...lengths)<.64)return null;
  for(let i=0;i<4;i++){
    const p=corners[i],a=corners[(i+3)%4],b=corners[(i+1)%4];
    const cosine=((a.x-p.x)*(b.x-p.x)+(a.y-p.y)*(b.y-p.y))/(lengths[(i+3)%4]*lengths[i]);
    if(Math.abs(cosine)>.42)return null;
    if(p.x<=2||p.y<=2||p.x>=width-3||p.y>=height-3)return null;
  }
  const center=corners.reduce((s,p)=>({x:s.x+p.x/4,y:s.y+p.y/4}),{x:0,y:0});
  if(Math.abs(center.x/width-.5)>.3||Math.abs(center.y/height-.5)>.3)return null;
  const centerBonus=1-Math.hypot(center.x/width-.5,center.y/height-.5);
  return {corners:corners.map(p=>({x:p.x/width,y:p.y/height})),score:quadArea/originalArea*centerBonus*Math.min(...lengths)/Math.max(...lengths)};
}

function components(mask,width,height) {
  const visited=new Uint8Array(mask.length),queue=new Int32Array(mask.length),candidates=[];
  for(let start=0;start<mask.length;start++){
    if(!mask[start]||visited[start])continue;
    let head=0,tail=1;queue[0]=start;visited[start]=1;
    const boundary=[];
    while(head<tail){
      const i=queue[head++],x=i%width,y=Math.floor(i/width);
      let edge=false;
      for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]){
        const nx=x+dx,ny=y+dy;
        if(nx<0||nx>=width||ny<0||ny>=height){edge=true;continue;}
        const n=ny*width+nx;
        if(!mask[n]){edge=true;continue;}
        if(!visited[n]){visited[n]=1;queue[tail++]=n;}
      }
      if(edge)boundary.push({x,y});
    }
    if(tail<30||boundary.length<12)continue;
    const candidate=quadrilateral(boundary,width,height);
    if(candidate)candidates.push(candidate);
  }
  return candidates;
}

export function detectSquare({data,width,height}) {
  if(width<16||height<16||data.length!==width*height*4)return null;
  const gray=new Uint8Array(width*height);let sum=0;
  for(let i=0;i<gray.length;i++){gray[i]=Math.round(data[i*4]*.299+data[i*4+1]*.587+data[i*4+2]*.114);sum+=gray[i];}
  const mean=sum/gray.length,candidates=[];
  // Multiple intensity cuts let both pale and dark patches form a contour.
  for(const [factor,bright] of [[.7,false],[.9,false],[1.1,true],[1.3,true]]){
    const threshold=mean*factor,mask=new Uint8Array(gray.length);
    for(let i=0;i<mask.length;i++)mask[i]=bright?gray[i]>threshold:gray[i]<threshold;
    candidates.push(...components(mask,width,height));
  }
  // Gradient edges also catch outlined squares with similar interior/background.
  const edges=new Uint8Array(gray.length);
  for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){
    const i=y*width+x;
    const gx=-gray[i-width-1]+gray[i-width+1]-2*gray[i-1]+2*gray[i+1]-gray[i+width-1]+gray[i+width+1];
    const gy=-gray[i-width-1]-2*gray[i-width]-gray[i-width+1]+gray[i+width-1]+2*gray[i+width]+gray[i+width+1];
    if(Math.abs(gx)+Math.abs(gy)>160)edges[i]=1;
  }
  candidates.push(...components(edges,width,height));
  return candidates.sort((a,b)=>b.score-a.score)[0]||null;
}

export function sameCandidate(a,b) {
  if(!a||!b)return false;
  const bounds=q=>({x:Math.min(...q.corners.map(p=>p.x)),y:Math.min(...q.corners.map(p=>p.y)),r:Math.max(...q.corners.map(p=>p.x)),b:Math.max(...q.corners.map(p=>p.y))});
  const x=bounds(a),y=bounds(b);
  const intersection=Math.max(0,Math.min(x.r,y.r)-Math.max(x.x,y.x))*Math.max(0,Math.min(x.b,y.b)-Math.max(x.y,y.y));
  return intersection/((x.r-x.x)*(x.b-x.y)+(y.r-y.x)*(y.b-y.y)-intersection)>.7;
}

// Source rectangle for the same object-fit: cover crop displayed by the video.
export function coverRect(sourceWidth,sourceHeight,targetWidth,targetHeight) {
  const scale=Math.max(targetWidth/sourceWidth,targetHeight/sourceHeight);
  const width=targetWidth/scale,height=targetHeight/scale;
  return {x:(sourceWidth-width)/2,y:(sourceHeight-height)/2,width,height};
}

export function captureBounds(candidate,width,height) {
  if(candidate){
    const xs=candidate.corners.map(p=>p.x*width),ys=candidate.corners.map(p=>p.y*height);
    const side=Math.min(Math.max(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys))*1.12,width,height);
    return {x:Math.max(0,Math.min(width-side,(Math.min(...xs)+Math.max(...xs)-side)/2)),y:Math.max(0,Math.min(height-side,(Math.min(...ys)+Math.max(...ys)-side)/2)),width:side,height:side};
  }
  const side=Math.min(width,height)*.64;
  return {x:(width-side)/2,y:(height-side)/2,width:side,height:side};
}
