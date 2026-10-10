import vm from 'node:vm';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
const root=new URL('../',import.meta.url),code=fs.readFileSync(new URL('extension/background.js',root),'utf8');
const tabs=[{id:1,windowId:7,url:'https://public.example/a',title:'A',incognito:false},{id:2,windowId:7,url:'https://public.example/b',title:'B',incognito:false}];
const model={model:'gpt-6-luna',isDefault:true,inputModalities:['text','image'],supportedReasoningEfforts:[]};
let stored={},calls=[],results={},removed,menuClick,installed,menuCreates=0,selected='可读的公开选中文字';
const browser={runtime:{id:'test',onMessage:{addListener(){}},onInstalled:{addListener:f=>installed=f},connectNative:()=>({onMessage:{addListener(){}},onDisconnect:{addListener(){}}}),sendNativeMessage:async(_,m)=>{
 if(m.type==='chat_request'){calls.push(m.request);const r=m.request;results[r.id]=r.action==='catalog'?{models:[model],authenticated:true}:r.action==='chat'?{thread_id:r.thread_id||'thread_'+r.session,text:'已阅读来源'}:{};return{ok:true};}
 if(m.type==='chat_poll')return{ok:true,state:{revision:1,finished:true,...results[m.id]}};return{ok:true};}},
 storage:{local:{get:async()=>structuredClone(stored),set:async v=>stored=structuredClone(v)}},
 tabs:{get:async id=>tabs.find(t=>t.id===id),query:async()=>tabs,executeScript:async()=>{},sendMessage:async(id,msg)=>msg.type==='collect'?{text:msg.args.mode==='selection'?selected:'网页正文',url:tabs.find(t=>t.id===id).url,title:'公开页'}:{ok:true},onRemoved:{addListener:f=>removed=f}},
 windows:{onRemoved:{addListener(){}}},contextMenus:{removeAll:async()=>{},create:(_,done)=>{menuCreates++;queueMicrotask(done);},onClicked:{addListener:f=>menuClick=f}}};
const c=vm.createContext({browser,crypto:webcrypto,URL,console,setTimeout,clearTimeout});vm.runInContext(code+'\nglobalThis.call=(tab,m)=>sidebarMessage(m,{id:"test",tab});globalThis.state=tab=>tabState(tab);',c);
await installed();assert.equal(menuCreates,1,'startup and installation must coalesce menu creation');
const a=tabs[0],b=tabs[1];
for(const t of tabs){c.state(t).opened=true;await c.call(t,{type:'sidebar_init',document_id:'doc-'+t.id});await c.call(t,{type:'sidebar_reconnect'});await c.call(t,{type:'sidebar_state'});}
assert.notEqual(c.state(a).session,c.state(b).session);
const autoBefore=calls.length;
const auto=await c.call(a,{type:'sidebar_selection',session:c.state(a).session,document_id:'doc-1',selection:{url:a.url,text:selected}});
assert.equal(auto.ok,true);assert.equal(auto.context.automatic,true);assert.equal(calls.length,autoBefore,'selection must not start native capture/model work');
assert.equal(c.state(b).context,null);assert(!JSON.stringify(stored).includes(selected),'unsubmitted quote must not be written to storage');
for(const change of [{session:'old-session'},{document_id:'old-document'},{selection:{url:b.url,text:selected}},{selection:{url:a.url,text:'x'.repeat(8001)}}]){
 const result=await c.call(a,{type:'sidebar_selection',session:c.state(a).session,document_id:'doc-1',selection:{url:a.url,text:selected},...change});assert.equal(result.ok,false);
}
await c.call(a,{type:'sidebar_context_clear'});assert.equal(c.state(a).context,null);

await c.call(a,{type:'sidebar_draft',text:'A 的未发送问题'});await c.call(b,{type:'sidebar_draft',text:'B 的未发送问题'});
assert.equal((await c.call(a,{type:'sidebar_state'})).draft,'A 的未发送问题');assert.equal((await c.call(b,{type:'sidebar_state'})).draft,'B 的未发送问题');
await c.call(a,{type:'sidebar_ask',question:'只读所选文字',model:model.model,attach_page:false,selection:{url:a.url,text:selected}});await c.call(a,{type:'sidebar_state'});
const chat=calls.find(r=>r.action==='chat');assert.equal(chat.pages.length,1);assert.equal(chat.pages[0].mode,'selection');assert.equal(chat.pages[0].text,selected);assert.equal(c.state(a).draft,'');assert.equal(c.state(b).history.length,0);assert.equal(c.state(b).draft,'B 的未发送问题');
assert.equal(c.state(a).history[0].sources[0].excerpt,selected);
await c.call(a,{type:'sidebar_ask',question:'结合整页解释引用',model:model.model,attach_page:true,selection:{url:a.url,text:selected}});await c.call(a,{type:'sidebar_state'});
const focused=calls.filter(r=>r.action==='chat').at(-1);assert.equal(focused.pages.length,2);assert.equal(focused.pages[0].mode,'selection');assert.equal(focused.pages[1].text,'网页正文');
assert.equal(c.state(a).history[2].sources.map(s=>s.kind).join(','),'selection,page');

await assert.rejects(c.call(b,{type:'sidebar_ask',question:'来源过期',model:model.model,attach_page:false,selection:{url:a.url,text:selected}}),/过期/);
await menuClick({menuItemId:'safari-codex-selection',selectionText:selected},b);assert.equal(c.state(b).context.text,selected);assert.equal(c.state(b).history.length,0);
b.url='https://public.example/new';assert.equal((await c.call(b,{type:'sidebar_state'})).context,null);
selected='';await menuClick({menuItemId:'safari-codex-selection',selectionText:'私密输入框文字'},b);assert.equal(c.state(b).context,null);assert.match(c.state(b).error,/输入框/);
await c.call(b,{type:'sidebar_new',temporary:true});await c.call(b,{type:'sidebar_draft',text:'临时草稿'});assert(!JSON.stringify(stored).includes('临时草稿'));removed(b.id);assert.equal(c.state(a).history.length,4);assert.equal(c.state(b).draft,'');
const report={scope:'mock Safari background, no network, per-tab sessions and context privacy',passed:17,checks:['automatic selection stays in local tab RAM without native/model calls or storage writes','automatic selection requires matching session and document','automatic selection rejects stale URL and overlong text','quote can be removed explicitly','send combines focused excerpt and opted-in page with distinct source metadata','startup and installation coalesce context-menu registration','independent sessions in same window','drafts isolated per tab','selected-text-only request excludes full page','accepted send clears only own draft','messages never appear in sibling tab','selection excerpt preserved in source metadata','stale URL selection rejected','context-menu prefill never auto sends','navigation invalidates pending selection','input-field selection blocked','temporary draft not persisted and tab removal isolated']};fs.writeFileSync(new URL('tests/tab-context-results.json',root),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
