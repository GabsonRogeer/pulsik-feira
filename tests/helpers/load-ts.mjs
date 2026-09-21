import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import Module from 'node:module';
import path from 'node:path';
import ts from 'typescript';
export function loadTs(url,mocks={}) {
 const filename=fileURLToPath(url);const mod=new Module(filename);mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));
 const original=mod.require.bind(mod);mod.require=id=>Object.hasOwn(mocks,id)?mocks[id]:original(id);
 const {outputText}=ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true,target:ts.ScriptTarget.ES2020}});
 mod._compile(outputText,filename);return mod.exports;
}
