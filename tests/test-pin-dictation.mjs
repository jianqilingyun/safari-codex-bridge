import vm from 'node:vm';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
const root=new URL('../',import.meta.url),code=fs.readFileSync(new URL('extension/background.js',root),'utf8'),checks=[];
const tabs=[{id:1,windowId:1,url:'https://public.example/a',incognito:false},{id:2,windowId:1,url:'https://public.example/b',incognito:false},{id:3,windowId:1,url:'https://public.example/c',incognito:false}];
let stored={},requests=[],results={},deferStart,releaseStart;
const browser={
 runtime:{id:'fixture',onMessage:{addListener(){}},connectNative:()=>({onMessage:{addListener(){}},onDisconnect:{addListener(){}}}),
 sendNativeMessage:async(_,m)=>{
  if(m.type==='chat_poll')return{ok:true,state:results[m.id]||{revision:0,finished:false}};
  if(m.type==='chat_request'){
   const r=m.request;requests.push(r);
   results[r.id]=r.action==='catalog'?{revision:1,finished:true,models:[],authenticated:true}:r.action==='dictate_start'?{revision:1,finished:false,event:'dictation',phase:'handoff'}:{revision:1,finished:true,event:'ack'};
   if(r.action==='dictate_start'&&deferStart)await new Promise(resolve=>releaseStart=resolve);
   return{ok:true};
  }return{ok:true};
 }},
 storage:{local:{get:async()=>structuredClone(stored),set:async value=>stored=structuredClone(value)}},
 tabs:{get:async id=>tabs.find(t=>t.id===id),query:async()=>tabs,executeScript:async()=>{},sendMessage:async()=>({ok:true})}
};
const c=vm.createContext({browser,crypto:webcrypto,URL,console,setTimeout,clearTimeout});
vm.runInContext(code+'\nglobalThis.call=(tab,m)=>sidebarMessage(m,{id:"fixture",tab});globalThis.state=tab=>tabState(tab);',c);
const [a,b,t]=tabs;
await c.call(a,{type:'sidebar_preferences',values:{language:'en',font_size:18}});
assert.equal(stored.safari_codex_preferences.language,'en');assert.equal(stored.safari_codex_preferences.font_size,18);
assert.equal((await c.call(b,{type:'sidebar_state'})).preferences.language,'en');
await c.call(a,{type:'sidebar_preferences',values:{language:'invalid',font_size:200}});
assert.equal(stored.safari_codex_preferences.language,'en');assert.equal(stored.safari_codex_preferences.font_size,18);
await c.call(a,{type:'sidebar_preferences',values:{language:'zh-CN',font_size:16}});
checks.push('interface language and text size persist across tabs; unsupported values are rejected');
assert.equal((await c.call(a,{type:'sidebar_init',document_id:'a1'})).opened,false);checks.push('unpinned fresh page remains closed');
await c.call(a,{type:'sidebar_preferences',values:{pinned:true}});
assert.equal(stored.safari_codex_preferences.pinned,true);
assert.equal((await c.call(b,{type:'sidebar_init',document_id:'b1'})).opened,true);checks.push('pin persists and automatically opens a newly authorized tab');
await c.call(b,{type:'sidebar_close'});
assert.equal((await c.call(b,{type:'sidebar_init',document_id:'b1'})).opened,false);
assert.equal((await c.call(b,{type:'sidebar_init',document_id:'b2'})).opened,true);checks.push('explicit close lasts for current document; refresh reopens when pinned');
await c.call(a,{type:'sidebar_preferences',values:{pinned:false}});
assert.equal((await c.call(t,{type:'sidebar_init',document_id:'t1'})).opened,false);checks.push('unpin prevents new-tab auto opening');
await assert.rejects(c.call({...t,incognito:true},{type:'sidebar_init',document_id:'private'}),/普通网页/);checks.push('pin does not bypass private-tab boundary');
await c.call(a,{type:'sidebar_preferences',values:{dictation_shortcut:'Ctrl+Option+D',dictation_shortcut_mode:'single'}});
await c.call(a,{type:'sidebar_preferences',values:{dictation_shortcut_mode:'arbitrary'}});
assert.equal(stored.safari_codex_preferences.dictation_shortcut_mode,'single');checks.push('official dictation shortcut mode accepts only supported choices');
c.state(a).opened=true;await c.call(a,{type:'sidebar_draft',text:'未发送的原草稿'});
const start=await c.call(a,{type:'sidebar_dictation_start'});
assert.equal(requests.at(-1).shortcut,'Ctrl+Option+D');assert.equal(requests.at(-1).action,'dictate_start');
const state=await c.call(a,{type:'sidebar_state'});
assert.equal(state.dictation.phase,'handoff');assert.equal(state.draft,'未发送的原草稿');assert.equal(state.history.length,0);checks.push('pending official handoff is separate from draft and conversation history');
await assert.rejects(c.call(a,{type:'sidebar_dictation_start'}),/听写/);
await assert.rejects(c.call(a,{type:'sidebar_ask',question:'不应发送'}),/听写/);checks.push('pending shortcut dispatch rejects duplicate starts and accidental send');
const before=requests.length;await c.call(b,{type:'sidebar_dictation_stop',id:start.id});await c.call(b,{type:'sidebar_dictation_cancel',id:start.id});assert.equal(requests.length,before);checks.push('sibling tab cannot cancel another tab pending shortcut');
await c.call(a,{type:'sidebar_dictation_stop',id:start.id});assert.equal(requests.at(-1).recording_id,start.id);
results[start.id]={revision:2,finished:true,event:'ack',handed_off:true};
const done=await c.call(a,{type:'sidebar_state'});assert.equal(done.dictation.handed_off,true);assert.equal(done.dictation.text,undefined);assert.equal(done.history.length,0);assert.equal(done.draft,'未发送的原草稿');assert(!JSON.stringify(stored).includes('handed_off'));checks.push('official handoff does not create a transcript, draft or conversation entry');
await assert.rejects(c.call(b,{type:'sidebar_dictation_finish',id:start.id}),/当前标签页/);checks.push('another tab cannot finish this official dictation');
await c.call(a,{type:'sidebar_preferences',values:{dictation_shortcut:'Ctrl+Option+X'}});
const finish=await c.call(a,{type:'sidebar_dictation_finish',id:start.id});
assert.equal(requests.at(-1).action,'dictate_finish');assert.equal(requests.at(-1).recording_id,start.id);assert.equal(requests.at(-1).shortcut,'Ctrl+Option+D');assert.equal(requests.at(-1).shortcut_mode,'single');
await assert.rejects(c.call(a,{type:'sidebar_dictation_finish',id:start.id}),/已结束/);assert.equal(c.state(a).history.length,0);assert.equal(c.state(a).draft,'未发送的原草稿');
checks.push('finish is scoped to original start, snapshots its keybinding, rejects repeated finishes and never creates chat entries');
await c.call(a,{type:'sidebar_state'});await assert.rejects(c.call(a,{type:'sidebar_dictation_finish',id:finish.id}),/已结束/);
checks.push('finish acknowledgement cannot become another finish cycle');
await c.call(a,{type:'sidebar_preferences',values:{dictation_shortcut:'Ctrl+Option+D'}});
await c.call(a,{type:'sidebar_dictation_start'});await c.call(a,{type:'sidebar_close'});assert.equal(requests.at(-1).action,'dictate_cancel');assert(!c.state(a).dictationJob);checks.push('closing sidebar cancels pending native shortcut');
c.state(a).opened=true;await c.call(a,{type:'sidebar_init',document_id:'a2'});await c.call(a,{type:'sidebar_dictation_start'});await c.call(a,{type:'sidebar_init',document_id:'a3'});assert(!c.state(a).dictationJob);checks.push('navigation cancels previous document pending shortcut');
c.state(a).opened=true;deferStart=true;
const pending=c.call(a,{type:'sidebar_dictation_start'});
await new Promise(resolve=>setTimeout(resolve,0));await c.call(a,{type:'sidebar_close'});releaseStart();await pending;deferStart=false;
assert.equal(requests.at(-1).action,'dictate_cancel');assert(!c.state(a).dictationJob);checks.push('close while native start is pending cancels after start acknowledgement');
const report={scope:'controlled background transport; no microphone, speech recognition or real global shortcut used',passed:checks.length,checks};
fs.writeFileSync(new URL('tests/pin-dictation-results.json',root),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
