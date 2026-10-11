import test from 'node:test';
import assert from 'node:assert/strict';
import {havenStatus,openingState,trustPoints,placeType} from '../js/havens.js';
const now=Date.parse('2026-10-10T16:00:00Z'); // Saturday noon Atlanta
const place={type:'library',position:[33.75,-84.39]};
test('all trust weights apply only to open places',()=>{for(const [type,points] of Object.entries(trustPoints)){assert.equal(havenStatus({...place,type,hours:'24/7'},now).points,points);assert.equal(havenStatus({...place,type,hours:'off'},now).points,0);assert.equal(havenStatus({...place,type},now).points,0);}});
test('local timezone, split hours and weekday schedules',()=>{assert.equal(openingState({...place,hours:'Sa 09:00-13:00,14:00-18:00'},now),'open');assert.equal(openingState({...place,hours:'Mo-Fr 09:00-17:00'},now),'closed');assert.equal(openingState({...place,hours:'09:00-17:00; Sa off'},now),'closed');});
test('overnight ranges cover the following morning',()=>{assert.equal(openingState({...place,hours:'Fr 22:00-02:00'},Date.parse('2026-10-10T05:00:00Z')),'open');assert.equal(openingState({...place,hours:'Fr 22:00-02:00'},Date.parse('2026-10-10T06:00:00Z')),'closed');});
test('unsupported rules and missing timezone are unknown; private places earn no points',()=>{assert.equal(openingState({...place,hours:'Mo-Su 09:00-17:00; PH off'},now),'unknown');assert.equal(openingState({...place,position:[0,0],hours:'09:00-17:00'},now),'unknown');assert.equal(havenStatus({...place,hours:'24/7',access:'private'},now).points,0);});
test('new tags map to trust types',()=>{assert.equal(placeType({healthcare:'urgent_care'}),'urgent_care');assert.equal(placeType({shop:'supermarket'}),'supermarket');assert.equal(placeType({amenity:'police',name:'Campus police'}),'campus_police');});
