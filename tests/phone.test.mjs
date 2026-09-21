import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source = await readFile(new URL('../lib/phone.ts', import.meta.url), 'utf8');
const {outputText} = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.ESNext}});
const {formatPhone,normalizePhone} = await import('data:text/javascript;base64,'+Buffer.from(outputText).toString('base64'));
test('phone mask supports typing, pasting, deletion and round-trip normalization',()=>{
 for(const [input,expected] of [['',''],['8','(8'],['85','(85)'],['859','(85) 9'],['8598925','(85) 98925'],['85989255','(85) 98925-5'],['85989255170','(85) 98925-5170'],['(85) 98925-5170','(85) 98925-5170']]) assert.equal(formatPhone(input),expected);
 assert.equal(normalizePhone('(85) 98925-5170'),'85989255170');
 assert.equal(formatPhone('abc85989255170'),'(85) 98925-5170');
 for(const input of ['', '8598925517','5585989255170']) assert.throws(()=>normalizePhone(input),/invalid_phone/);
});
