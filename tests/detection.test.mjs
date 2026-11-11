import {test} from 'node:test';
import assert from 'node:assert/strict';
import {detectSquare,sameCandidate,coverRect,captureBounds} from '../dist/detection.js';
function scene(shape){const width=160,height=200,data=new Uint8ClampedArray(width*height*4);for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=(y*width+x)*4,v=shape(x-80,y-100)?65:190;data.set([v,v,v,255],i);}return {data,width,height};}
test('detects a contrasting square and a rotated square',()=>{for(const shape of [(x,y)=>Math.abs(x)<35&&Math.abs(y)<35,(x,y)=>Math.abs(x+y)<48&&Math.abs(x-y)<48]){const d=detectSquare(scene(shape));assert.ok(d);assert.ok(d.score>.65);}});
test('detects pale squares and square outlines',()=>{const pale=scene((x,y)=>Math.abs(x)<35&&Math.abs(y)<35);for(let i=0;i<pale.data.length;i+=4)for(let c=0;c<3;c++)pale.data[i+c]=255-pale.data[i+c];assert.ok(detectSquare(pale));assert.ok(detectSquare(scene((x,y)=>Math.max(Math.abs(x),Math.abs(y))<36&&Math.max(Math.abs(x),Math.abs(y))>32)));});
test('rejects flat frames, circles, elongated rectangles and clipped shapes',()=>{for(const shape of [()=>false,(x,y)=>x*x+y*y<35**2,(x,y)=>Math.abs(x)<55&&Math.abs(y)<14,(x,y)=>x<20&&y<30])assert.equal(detectSquare(scene(shape)),null);});
test('stability rejects a lost or displaced candidate',()=>{const a=detectSquare(scene((x,y)=>Math.abs(x)<30&&Math.abs(y)<30));assert.equal(sameCandidate(a,a),true);assert.equal(sameCandidate(a,null),false);const b={corners:a.corners.map(p=>({x:p.x+.4,y:p.y}))};assert.equal(sameCandidate(a,b),false);});
test('cover crop matches portrait preview of landscape video',()=>{assert.deepEqual(coverRect(1920,1080,300,600),{x:690,y:0,width:540,height:1080});});
test('manual and detected capture bounds stay inside preview',()=>{assert.deepEqual(captureBounds(null,300,600),{x:54,y:204,width:192,height:192});const b=captureBounds({corners:[{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}]},300,600);assert.ok(b.x>=0&&b.y>=0&&b.x+b.width<=300&&b.y+b.height<=600);});
