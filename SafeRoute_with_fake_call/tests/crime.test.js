import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyCrime} from '../js/crime.js';
import {scoreRoute} from '../js/scoring.js';
test('all requested crime penalties',()=>{for(const [code,label,points] of [['35A','',-1],['290','',-1],['23C','',-2],['23F','',-3],['240','',-4],['220','',-4],['120','',-6],['13B','',-5],['13A','',-8],['520','',-7],['','Shooting',-10],['11A','',-10],['100','',-10],['09A','',-12]])assert.equal(classifyCrime({NibrsUcrCode:code,NIBRS_Offense:label}).points,points);});
test('firearm flag does not prove a shooting and unknown offenses remain unknown',()=>{assert.equal(classifyCrime({NibrsUcrCode:'13A',FireArmInvolved:'Y'}).points,-8);assert.equal(classifyCrime({NIBRS_Offense:'Fraud'}),null);assert.equal(classifyCrime({NibrsUcrCode:'09A',NIBRS_Offense:'Homicide shooting'}).points,-12);});
test('crime points affect route score and final floor',()=>{const r={points:[[0,0],[0,.01]]};assert.equal(scoreRoute(r,[],[],{crimePoints:-6}).score,44);assert.equal(scoreRoute(r,[],[],{crimePoints:-90}).score,0);assert.equal(scoreRoute(r,[],[],{crimePoints:5}).score,50);});
