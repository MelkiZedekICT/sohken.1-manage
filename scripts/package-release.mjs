import {mkdir,readFile,writeFile,readdir,cp,stat,rm,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
const root=process.cwd();
const release=path.join(root,'release');await mkdir(release,{recursive:true});
const pkg=JSON.parse(await readFile('package.json','utf8'));
for(const file of await readdir(release))if(/^sohken-(?:full-source|desktop|extension|security)-.*\.(?:zip|tgz)$/.test(file)||file==='sohken-checksums.json')await rm(path.join(release,file),{force:true});
const npmCli=process.env.NPM_CLI||path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
execFileSync(process.execPath,['node_modules/typescript/bin/tsc','-p','tsconfig.json'],{stdio:'inherit'});
execFileSync(process.execPath,[npmCli,'pack','--ignore-scripts','--cache',path.join(root,'.cache','npm'),'--pack-destination',release],{stdio:'inherit'});
function zip(source,destination){
 if(process.platform!=='win32')throw new Error('ZIP packaging currently uses PowerShell on Windows.');
 const folder=source.endsWith('*')?path.dirname(source):path.dirname(source);
 const item=source.endsWith('*')?'.':path.basename(source);
 execFileSync('tar.exe',['-a','-c','-f',destination,'-C',folder,item],{stdio:'inherit'});
}
async function packageFullSource(){
 const stagingRoot=path.join(root,'.cache','release-source');
 const stage=path.join(stagingRoot,`Sohken-${pkg.version}`);
 await rm(stagingRoot,{recursive:true,force:true});
 const project=stage;
 await mkdir(project,{recursive:true});
 const directories=['assets','bin','desktop','docs','extension','integration','research','scripts','sdk','src','tests','ui','web'];
 const rootFiles=['.dockerignore','.env.example','.gitignore','BUILD_JOURNAL.md','CHANGELOG.md','CONTRIBUTING.md','Dockerfile','HOW_TO_RUN.md','package.json','package-lock.json','README.md','SECURITY.md','tsconfig.json'];
 const allowed=(file)=>rootFiles.includes(file)||directories.some(dir=>file.startsWith(`${dir}/`))||file.startsWith('.github/workflows/')||file==='miscellaneous/README.md';
 const tracked=execFileSync('git',['ls-files','-z','--cached','--others','--exclude-standard']).toString('utf8').split('\0').filter(file=>file&&allowed(file));
 for(const file of tracked){
  const source=path.resolve(root,file),destination=path.join(project,file);
  let info;
  try{info=await lstat(source);}catch(e){if(e.code==='ENOENT')continue;throw e;}
  if(!info.isFile())continue;
  await mkdir(path.dirname(destination),{recursive:true});
  await cp(source,destination);
 }
 zip(project,path.join(release,`sohken-full-source-${pkg.version}.zip`));
 await rm(stagingRoot,{recursive:true,force:true});
}
zip(path.join(root,'extension','*'),path.join(release,`sohken-extension-${pkg.version}.zip`));
const desktop=path.join(root,'dist','Sohken-win32-x64');
try{await stat(path.join(desktop,'Sohken.exe'));
 const included=path.join(desktop,'resources','release');await mkdir(included,{recursive:true});
 for(const file of await readdir(included))if(/^sohken-(?:extension|security)-.*\.(?:zip|tgz)$/.test(file))await rm(path.join(included,file),{force:true});
 for(const f of await readdir(release))if(f.endsWith('.tgz')||f.startsWith('sohken-extension-'))await cp(path.join(release,f),path.join(included,f));
 await cp('README.md',path.join(desktop,'README.md'));await cp('HOW_TO_RUN.md',path.join(desktop,'HOW_TO_RUN.md'));await cp('SECURITY.md',path.join(desktop,'SECURITY.md'));
 zip(desktop,path.join(release,`sohken-desktop-win32-x64-${pkg.version}.zip`));
}catch(e){if(e.code!=='ENOENT')throw e;console.log('Desktop binary absent; terminal and extension packaged.');}
await packageFullSource();
const manifest=[];
for(const file of await readdir(release)){if(!/\.(zip|tgz)$/.test(file))continue;const data=await readFile(path.join(release,file));manifest.push({file,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')});}
await writeFile(path.join(release,'sohken-checksums.json'),JSON.stringify({version:pkg.version,artifacts:manifest},null,2)+'\n');
console.log('Built '+manifest.map(x=>x.file).join(', '));
