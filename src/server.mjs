import http from 'node:http';
import {timingSafeEqual} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import {readFileSync,readdirSync,lstatSync,createReadStream} from 'node:fs';
import {Engine,EngineError,initConfig,object} from './engine.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function parseStrictJSON(text){
 let at=0;
 const ws=()=>{while(/\s/.test(text[at]||'!'))at++;};
 const fail=()=>{throw new EngineError('Invalid or ambiguous JSON.');};
 function string(){const start=at;if(text[at++]!=='"')fail();while(at<text.length){if(text[at]==='\\'){at+=2;continue;}if(text[at++]==='"'){try{return JSON.parse(text.slice(start,at));}catch{fail();}}}fail();}
 function value(depth=0){if(depth>10)fail();ws();const c=text[at];if(c==='"')return string();
  if(c==='{'){at++;const out=Object.create(null),keys=new Set();ws();if(text[at]==='}'){at++;return out;}while(true){ws();const key=string();if(keys.has(key)||['__proto__','constructor','prototype'].includes(key))fail();keys.add(key);ws();if(text[at++]!==':')fail();out[key]=value(depth+1);ws();const end=text[at++];if(end==='}')return out;if(end!==',')fail();}}
  if(c==='['){at++;const out=[];ws();if(text[at]===']'){at++;return out;}while(true){out.push(value(depth+1));ws();const end=text[at++];if(end===']')return out;if(end!==',')fail();}}
  const m=/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(at));if(!m)fail();at+=m[0].length;const v=JSON.parse(m[0]);if(typeof v==='number'&&!Number.isFinite(v))fail();return v;
 }
 const result=value();ws();if(at!==text.length)fail();return result;
}
function equal(a,b){return typeof a==='string'&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));}
function readBody(req){return new Promise((resolve,reject)=>{let size=0,chunks=[];req.on('data',chunk=>{size+=chunk.length;if(size>100000){reject(new EngineError('Request body too large.',413));chunks=[];}else chunks.push(chunk);});req.on('end',()=>{if(size>100000)return;if(!String(req.headers['content-type']||'').startsWith('application/json'))return reject(new EngineError('Use application/json.',415));try{resolve(parseStrictJSON(Buffer.concat(chunks).toString('utf8')||'{}'));}catch(e){reject(e);}});req.on('error',reject);});}
export async function startServer({dataDir=process.env.SOHKEN_HOME||path.join(os.homedir(),'.sohken'),port=4317,releaseDir=path.join(ROOT,'release')}={}) {
 const config=initConfig(dataDir),engine=new Engine({dataDir,config});let origin;const rate=new Map();
 function json(res,status,payload){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(payload));}
 const server=http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  try{
   if(req.headers.host!==new URL(origin).host)throw new EngineError('Host not permitted. Use the displayed 127.0.0.1 address.',403);
   const url=new URL(req.url,origin),p=url.pathname;const requestOrigin=req.headers.origin;
   const extension=typeof requestOrigin==='string'&&/^chrome-extension:\/\/[a-p]{32}$/.test(requestOrigin);
   if(requestOrigin&&requestOrigin!==origin&&!extension)throw new EngineError('Origin not permitted.',403);
   if(extension){if(!['/api/scan','/api/health'].includes(p))throw new EngineError('Extension origin can only scan.',403);res.setHeader('Access-Control-Allow-Origin',requestOrigin);res.setHeader('Vary','Origin');}
   if(req.method==='OPTIONS'){if(!extension&&requestOrigin!==origin)throw new EngineError('Origin not permitted.',403);res.setHeader('Access-Control-Allow-Methods','GET, POST');res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');res.writeHead(204);res.end();return;}
   if(req.method==='GET'&&['/','/index.html','/app.js','/styles.css','/style.css','/favicon.svg'].includes(p)){
    const name=p==='/'?'index.html':p.slice(1);const file=path.join(ROOT,'ui',name);try{const s=lstatSync(file);if(!s.isFile()||s.isSymbolicLink())throw new Error();const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'}[path.extname(file)];res.writeHead(200,{'Content-Type':mime+'; charset=utf-8'});res.end(readFileSync(file));return;}catch{throw new EngineError('UI asset not found.',404);}
   }
   const auth=req.headers.authorization?.replace(/^Bearer /,'');const role=equal(auth,config.ownerToken)?'owner':equal(auth,config.agentToken)?'agent':null;
   if(!role)throw new EngineError('Pair with a valid local token.',401);
   if(extension&&role!=='agent')throw new EngineError('Use an agent token for the browser extension.',403);
   const bucket=role+(extension?':extension':'');const now=Date.now();let b=rate.get(bucket);if(!b||now-b.at>60000){b={at:now,n:0};rate.set(bucket,b);}if(++b.n>240)throw new EngineError('Too many requests. Wait a minute.',429);
   const owner=()=>{if(role!=='owner')throw new EngineError('Only the local owner can perform this operation.',403);};
   const downloads=()=>{try{return readdirSync(releaseDir).filter(name=>/^sohken-[a-zA-Z0-9._-]+\.(?:zip|tgz|json|txt)$/.test(name)).flatMap(name=>{const s=lstatSync(path.join(releaseDir,name));return s.isFile()&&!s.isSymbolicLink()?[{name,size:s.size,url:'/downloads/'+name}]:[];});}catch{return [];}};
   if(req.method==='GET'){
    if(p==='/api/health')return json(res,200,{status:'ok',version:engine.state().version});
    if(p==='/api/state'){owner();return json(res,200,engine.state());}
    if(p==='/api/status'){const {version,mode,paused,stats,tools,policy}=engine.state();return json(res,200,{version,mode,paused,stats,tools,policy});}
    if(p==='/api/audit/verify'){owner();return json(res,200,engine.verify());}
    if(p==='/api/export'){owner();res.setHeader('Content-Disposition','attachment; filename="sohken-evidence.json"');return json(res,200,engine.export());}
    if(p==='/api/downloads'){owner();return json(res,200,{files:downloads()});}
    if(p==='/api/connection'){owner();return json(res,200,{agentToken:config.agentToken,url:origin});}
    if(/^\/api\/actions\/[a-f0-9-]{36}$/.test(p))return json(res,200,engine.getAction(p.split('/')[3]));
    if(p.startsWith('/downloads/')){owner();const name=p.slice('/downloads/'.length);if(!downloads().some(d=>d.name===name))throw new EngineError('Download not found.',404);res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename="${name}"`});createReadStream(path.join(releaseDir,name)).pipe(res);return;}
   }
   if(req.method==='POST'){
    const input=await readBody(req);
    if(p==='/api/scan')return json(res,200,engine.scan(input));
    if(p==='/api/actions')return json(res,201,engine.propose(input));
    if(p==='/api/pause'){owner();object(input,['paused']);return json(res,200,engine.setPaused(input.paused));}
    if(p==='/api/demo'){owner();object(input,[]);return json(res,200,engine.demo());}
    const match=/^\/api\/actions\/([a-f0-9-]{36})\/(approve|reject|execute)$/.exec(p);
    if(match){if(match[2]==='execute'){object(input,[]);return json(res,200,engine.execute(match[1]));}owner();return json(res,200,engine.decide(match[1],input,match[2]==='approve'));}
   }
   throw new EngineError('Route not found.',404);
  }catch(e){if(!res.headersSent)json(res,e instanceof EngineError?e.status:400,{error:e instanceof EngineError?e.message:e.message?.includes('64 KB')||e.message==='Enter some text to scan.'?e.message:'Request could not be processed.'});else res.end();}
 });
 server.requestTimeout=10000;server.headersTimeout=10000;server.maxHeadersCount=30;
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});origin='http://127.0.0.1:'+server.address().port;
 return {server,url:origin,...config,engine,close:()=>new Promise(resolve=>{server.close(()=>{engine.close();resolve();});server.closeIdleConnections();})};
}
