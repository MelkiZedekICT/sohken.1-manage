/** Agent-scoped local API client. Human approval is intentionally absent. */
export type Finding = {rule:string;severity:'medium'|'high'|'critical';title:string;detail:string;line:number};
export type Scan = {id:string;score:number;level:string;findings:Finding[];summary:string;createdAt:string};
export type ToolRequest =
 | {tool:'diagnostics.read';args:{service:'api'|'database'|'queue'};idempotencyKey?:string}
 | {tool:'ticket.create';args:{title:string;body:string};idempotencyKey?:string}
 | {tool:'file.delete';args:{path:string};idempotencyKey?:string}
 | {tool:'network.send';args:{url:string;body:string};idempotencyKey?:string};
export type Action = {id:string;tool:string;args:Record<string,string>;digest:string;decision:'allow'|'deny'|'require_approval';status:'pending'|'ready'|'approved'|'rejected'|'denied'|'succeeded';reasons:string[];createdAt:string;expiresAt:string;result?:Record<string,unknown>};
export class Sohken {
 private readonly base:string;
 private readonly token:string;
 constructor(agentToken:string,port=4317){
  if(!/^sohken_agent_[a-f0-9]{64}$/.test(agentToken))throw new Error('An agent token is required. Never pass an owner token to an agent.');
  if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid port.');
  this.token=agentToken;this.base=`http://127.0.0.1:${port}`;
 }
 private async request<T>(route:string,body?:unknown):Promise<T>{
  const response=await fetch(this.base+route,{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${this.token}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(15000)});
  const data=await response.json() as T & {error?:string};
  if(!response.ok)throw new Error(data.error||`Sohken rejected the request (${response.status}).`);
  return data;
 }
 scan(text:string):Promise<Scan>{return this.request('/api/scan',{text,source:'typescript-sdk'});}
 propose(action:ToolRequest):Promise<Action>{return this.request('/api/actions',action);}
 execute(id:string):Promise<Action>{if(!/^[a-f0-9-]{36}$/.test(id))throw new Error('Invalid action ID.');return this.request(`/api/actions/${id}/execute`,{});}
 status():Promise<{version:string;paused:boolean;stats:Record<string,number>}>{return this.request('/api/status');}
}
