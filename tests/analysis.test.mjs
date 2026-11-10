import {test} from 'node:test';
import assert from 'node:assert/strict';
import {meanRGB,compareRGB,remainingSeconds,clock} from '../dist/analysis.js';
test('RGB mean excludes transparent pixels',()=>assert.deepEqual(meanRGB([10,20,30,255,30,40,50,255,255,255,255,0]),[20,30,40]));
test('empty and transparent photographs are rejected',()=>{assert.throws(()=>meanRGB([]));assert.throws(()=>meanRGB([0,0,0,0]));});
test('same colour has zero difference; distance is symmetric',()=>{assert.equal(compareRGB([10,20,30],[10,20,30]).distance,0);assert.ok(Math.abs(compareRGB([0,0,0],[255,255,255]).distance-Math.sqrt(3*255**2))<1e-10);assert.equal(compareRGB([0,10,20],[30,50,60]).distance,compareRGB([30,50,60],[0,10,20]).distance);});
test('invalid colour inputs rejected',()=>{assert.throws(()=>compareRGB([NaN,0,0],[0,0,0]));assert.throws(()=>compareRGB([256,0,0],[0,0,0]));});
test('timer uses an absolute deadline across reloads, never negative',()=>{assert.equal(remainingSeconds({dueAt:61000},1000),60);assert.equal(remainingSeconds({dueAt:61000},62000),0);assert.equal(clock(3599),'00:59:59');assert.equal(clock(3600),'01:00:00');});
