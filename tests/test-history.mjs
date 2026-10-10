import vm from 'node:vm';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
const root=new URL('../',import.meta.url),code=fs.readFileSync(new URL('extension/background.js',root),'utf8');
let stored={},requests=[],responses={},closed;
const thread='00000000-0000-4000-8000-000000000001';
const tab={id:1,windowId:2,url:'https://public.example/chart',title:'公开测试页',incognito:false};
const model={model:'gpt-6-luna',displayName:'GPT-6-Luna',isDefault:true,inputModalities:['text','image'],supportedReasoningEfforts:[{reasoningEffort:'medium'}]};
function context(){
 const b={runtime:{id:'test',onMessage:{addListener(){}},connectNative:()=>({onMessage:{addListener(){}},onDisconnect:{addListener(){}}}),sendNativeMessage:async(_,m)=>{
  if(m.type==='chat_request'){requests.push(m.request);responses[m.request.id]=m.request.action==='catalog'?{models:[model],authenticated:true,runtime:{source:'Codex 桌面配套',version:'codex-cli 0.160.0'}}:m.request.action==='history'?{history:[{role:'user',text:'公开测试问题'},{role:'assistant',text:'桌面接续后的回答'}],title:'Safari · 公开测试问题'}:{thread_id:thread,text:'公开测试回答'};return{ok:true};}
  if(m.type==='chat_poll')return{ok:true,state:{revision:1,finished:true,...responses[m.id]}};return{ok:true};}},storage:{local:{get:async()=>structuredClone(stored),set:async v=>{stored=structuredClone(v);}}},tabs:{get:async()=>tab,query:async()=>[tab],sendMessage:async()=>({ok:true}),executeScript:async()=>{}},windows:{onRemoved:{addListener:f=>closed=f}}};
 const c=vm.createContext({browser:b,tab,crypto:webcrypto,URL,console,setTimeout,clearTimeout});vm.runInContext(code+'\nglobalThis.call=m=>sidebarMessage(m,{id:"test",tab});globalThis.getState=()=>tabState(tab);',c);return c;
}
let c=context();await c.call({type:'sidebar_open_toolbar'}).catch(()=>{}); // toolbar requires non-tab sender; use state to set opened below.
c.getState().opened=true;
let state=await c.call({type:'sidebar_state'});state=await c.call({type:'sidebar_state'});assert.equal(state.temporary,false);
await c.call({type:'sidebar_preferences',values:{model:model.model,effort:'medium',theme:'dark',attach_page:false,include_image:false}});
await c.call({type:'sidebar_ask',question:'公开测试问题',model:model.model,effort:'medium',attach_page:false});await c.call({type:'sidebar_state'});
assert.equal(requests.find(r=>r.action==='chat').temporary,false);assert.equal(Object.keys(stored.safari_codex_history).length,1);assert.equal(stored.safari_codex_history[state.session].thread_id,thread);
c=context();state=await c.call({type:'sidebar_state'});assert.equal(state.thread_id,thread);assert.equal(state.preferences.model,model.model);assert.equal(state.preferences.theme,'dark');
await c.call({type:'sidebar_history_open',session:state.session});state=await c.call({type:'sidebar_state'});assert.equal(state.history[1].text,'桌面接续后的回答');
await c.call({type:'sidebar_ask',question:'继续问',model:model.model,effort:'medium',attach_page:false});await c.call({type:'sidebar_state'});assert.equal(requests.filter(r=>r.action==='chat').at(-1).thread_id,thread);
await c.call({type:'sidebar_new',temporary:true});await c.call({type:'sidebar_ask',question:'不长期保存的测试',model:model.model,effort:'medium',attach_page:false});await c.call({type:'sidebar_state'});assert.equal(requests.filter(r=>r.action==='chat').at(-1).temporary,true);assert.equal(Object.keys(stored.safari_codex_history).length,1);assert(!JSON.stringify(stored).includes('不长期保存的测试'));await assert.rejects(c.call({type:'sidebar_open_desktop'}),/临时/);
closed(2);c=context();state=await c.call({type:'sidebar_state'});assert.equal(state.temporary,false);assert.equal(state.thread_id,thread);
await c.call({type:'sidebar_state'});
await assert.rejects(c.call({type:'sidebar_ask',question:'测试',model:'gpt-missing',attach_page:false}),/不会自动替换/);
const report={scope:'extension background transport/storage fixture, real Codex persistence tested separately',passed:8,checks:['default persistent chat','thread ID and messages persist in local extension storage','preferences survive background restart','official history refresh imports desktop continuation','resumed sends use same thread ID','temporary excludes local history and desktop handoff','window close discards temporary state','missing model explicitly errors without substitution']};fs.writeFileSync(new URL('tests/history-storage-results.json',root),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
