import {mkdir,readFile,writeFile,readdir,cp,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
const root=process.cwd();
const release=path.join(root,'release');await mkdir(release,{recursive:true});
const pkg=JSON.parse(await readFile('package.json','utf8'));
const npmCli=process.env.NPM_CLI||path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
execFileSync(process.execPath,['node_modules/typescript/bin/tsc','-p','tsconfig.json'],{stdio:'inherit'});
execFileSync(process.execPath,[npmCli,'pack','--ignore-scripts','--cache',path.join(root,'.cache','npm'),'--pack-destination',release],{stdio:'inherit'});
function zip(source,destination){
 if(process.platform!=='win32')throw new Error('ZIP packaging currently uses PowerShell on Windows.');
 const folder=source.endsWith('*')?path.dirname(source):path.dirname(source);
 const item=source.endsWith('*')?'.':path.basename(source);
 execFileSync('tar.exe',['-a','-c','-f',destination,'-C',folder,item],{stdio:'inherit'});
}
zip(path.join(root,'extension','*'),path.join(release,`sohken-extension-${pkg.version}.zip`));
const desktop=path.join(root,'dist','Sohken-win32-x64');
try{await stat(path.join(desktop,'Sohken.exe'));
 const included=path.join(desktop,'resources','release');await mkdir(included,{recursive:true});
 for(const f of await readdir(release))if(f.endsWith('.tgz')||f.startsWith('sohken-extension-'))await cp(path.join(release,f),path.join(included,f));
 await cp('README.md',path.join(desktop,'README.md'));await cp('SECURITY.md',path.join(desktop,'SECURITY.md'));
 zip(desktop,path.join(release,`sohken-desktop-win32-x64-${pkg.version}.zip`));
}catch(e){if(e.code!=='ENOENT')throw e;console.log('Desktop binary absent; terminal and extension packaged.');}
const manifest=[];
for(const file of await readdir(release)){if(!/\.(zip|tgz)$/.test(file))continue;const data=await readFile(path.join(release,file));manifest.push({file,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')});}
await writeFile(path.join(release,'sohken-checksums.json'),JSON.stringify({version:pkg.version,artifacts:manifest},null,2)+'\n');
console.log('Built '+manifest.map(x=>x.file).join(', '));
