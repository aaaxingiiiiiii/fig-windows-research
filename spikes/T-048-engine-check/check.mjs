// Copyright (c) fig-windows-research contributors. Licensed under the MIT License.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
const root=process.cwd();
const base=path.join(root,'local/acceptance/T-035-20261015');
const load=p=>import(pathToFileURL(path.join(root,'src/inshellisense/build',p)));
const {getSuggestions}=await load('runtime/runtime.js');
const {calculateReplacement}=await load('runtime/replacement.js');
const {Shell}=await load('utils/shell.js');
const {enable}=await load('utils/log.js');
const {loggingResourcesPath}=await load('utils/constants.js');
await enable();
const results=[];
async function check(id,cmd,cwd,expected,absent=[]){
 const b=await getSuggestions(cmd,cwd,Shell.Pwsh);
 const names=b?.suggestions.map(x=>x.name)??[];
 results.push({id,cmd,names,pass:expected.every(x=>names.includes(x))&&absent.every(x=>!names.includes(x))});
}
await check('1','git checkout ',path.join(base,'git-demo'),['main','demo-feature']);
for(const name of ['中文目录',"it's",'a$b','a&b','a`b',"it's dir"]){
 const prefix=name==='中文目录'?'中':name.startsWith('it')?'it':'a';
 const b=await getSuggestions('cd '+prefix,base,Shell.Pwsh);
 const s=b?.suggestions.find(x=>x.name===name);
 const a=s?calculateReplacement(b.activeToken,s):null;
 let entered='';
 if(a) entered=execFileSync(process.env.FIGWIN_TEST_PWSH,['-NoProfile','-Command',`Set-Location ${a.insertText}; (Get-Location).Path`],{cwd:base,encoding:'utf8'}).trim();
 results.push({id:'2/3',name,insert:a?.insertText,backspace:a?.backspaceCount,pass:entered===path.join(base,name)&&a.backspaceCount===prefix.length});
}
const globalPackages=Object.keys(JSON.parse(execFileSync(process.env.FIGWIN_TEST_PWSH,['-NoProfile','-Command','npm ls -g --depth=0 --json'],{encoding:'utf8'})).dependencies??{});
if(globalPackages.length===0) throw new Error('Need at least one global package for case 4');
await check('4','npm uninstall -g ',base,globalPackages);
await check('5a','git diff ',path.join(base,'git-demo'),['tracked.txt','staged.txt']);
await check('5b','git diff --staged ',path.join(base,'git-demo'),['staged.txt'],['tracked.txt']);
await check('6a','npm run ',path.join(base,'npm-demo/child'),['hello','check']);
await check('6b','node ',path.join(base,'npm-demo'),['demo.js']);
await check('8','npm run -w ',path.join(base,'npm-demo'),['packages/a','packages/b']);
await new Promise(r=>setTimeout(r,300));
fs.copyFileSync(path.join(loggingResourcesPath,'inshellisense.log'),path.join(root,'local/evidence/T-048-engine.log'));
fs.writeFileSync(path.join(root,'local/evidence/T-048-engine.json'),JSON.stringify(results,null,2));
console.log(JSON.stringify(results.map(({id,name,pass})=>({id,name,pass})),null,2));
process.exitCode=results.every(x=>x.pass)?0:1;
