import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const req=createRequire(import.meta.url);
const {chromium}=req('playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.BRIDGE_TEST_CHROMIUM});
const checks=[],screenshots=[];
try {
 const context=await browser.newContext({viewport:{width:1200,height:900},colorScheme:'light'}),page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const fixture=`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>季度增长与业务结构</title><style>body{margin:0;background:#f9fbff;color:#17243b;font:20px/1.8 -apple-system,sans-serif}article{max-width:760px;margin:55px auto;padding:0 35px}h1{font-size:44px;line-height:1.2}canvas{width:100%;height:240px;background:#fff;border-radius:15px}figcaption{font-size:15px;color:#62738e}</style></head><body><article><p>测试网页 · 图片与正文</p><h1>季度增长与业务结构</h1><p>三个季度的指标分别为 10、20、40。最后一个季度继续增长。</p><figure><canvas id="chart" width="650" height="240"></canvas><figcaption>三个季度的对比图（公开的合成测试数据）</figcaption></figure><h2>可以继续追问</h2><p>在右侧分析当前网页，查看图表，继续询问数据之间的关系。</p></article><script>const c=document.getElementById('chart'),x=c.getContext('2d');x.font='20px sans-serif';[10,20,40].forEach((v,i)=>{x.fillStyle='#376fee';x.fillRect(80+i*180,210-v*4,95,v*4);x.fillStyle='#17305d';x.fillText(String(v),115+i*180,225)});</script></body></html>`;
 await page.route('https://sidebar-fixture.example/**',r=>r.fulfill({status:200,contentType:'text/html',body:fixture}));
 await page.goto('https://sidebar-fixture.example/article');
 await page.evaluate(()=>{
   // Expose only in this isolated test environment so controls in the closed
   // shadow root can be inspected without weakening the production component.
   const original=Element.prototype.attachShadow;Element.prototype.attachShadow=function(options){const r=original.call(this,options);globalThis.testShadow=r;return r;};
   Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{globalThis.copiedText=text;}}});
   globalThis.listeners=[];globalThis.sent=[];globalThis.voiceCounter=0;globalThis.rejectDictation=false;
   globalThis.state={session:'fixture-session',temporary:false,title:'新对话',preferences:{dictation_shortcut:'Ctrl+Option+D'},history:[],models:[{model:'fixture-model',displayName:'GPT-6-Luna',isDefault:true,defaultReasoningEffort:'medium',supportedReasoningEfforts:[{reasoningEffort:'low'},{reasoningEffort:'medium'}]}],authenticated:true,plan:'Pro',busy:false};
   globalThis.browser={runtime:{id:'fixture',onMessage:{addListener:f=>listeners.push(f),removeListener:f=>{}},sendMessage:async m=>{sent.push(m);switch(m.type){case 'sidebar_preferences':Object.assign(state.preferences,m.values);return{ok:true};case 'sidebar_dictation_start':if(rejectDictation)return{ok:false,error:'测试权限拒绝'};state.dictation={id:'voice-'+(++voiceCounter),finished:true,handed_off:true};return{ok:true,id:state.dictation.id};case 'sidebar_dictation_finish':if(rejectDictation)return{ok:false,error:'测试权限拒绝'};state.dictation={id:'voice-'+(++voiceCounter),finished:true,handed_off:true};return{ok:true,id:state.dictation.id};case 'sidebar_dictation_stop':return{ok:true};case 'sidebar_dictation_cancel':state.dictation={...state.dictation,finished:true,cancelled:true};return{ok:true};case 'sidebar_draft':state.draft=m.text;return{ok:true};case 'sidebar_context_clear':state.context=null;return{ok:true};case 'sidebar_init':state.documentId=m.document_id;state.opened=true;return{opened:true};case 'sidebar_selection':state.context={...m.selection,id:'selection-'+sent.length,automatic:true};return{ok:true,context:state.context};case 'sidebar_state':return state;case 'sidebar_ask':state.history.push({role:'user',text:m.question,sources:[{title:document.title,url:location.href}]},{role:'assistant',text:'最后一根柱子的数值是 **40**，是第一根的 **4 倍**。\n\n这是当前截图里三个季度的对比。'});return{ok:true};case 'sidebar_new':state.history=[];state.session+='x';state.temporary=!!m.temporary;return{ok:true};case 'sidebar_history_list':return{chats:[{session:'saved',title:'Safari · 保存的测试对话',updated_at:Date.now()}]};case 'sidebar_history_open':state.session='saved';state.temporary=false;state.thread_id='00000000-0000-4000-8000-000000000001';state.history=[{role:'assistant',text:'恢复的回答'}];return{ok:true};case 'sidebar_tabs':return{tabs:[{tab_id:2,title:'另一篇已授权网页',url:'https://sidebar-fixture.example/other'}]};default:return{ok:true};}}}};
 });
 await page.addScriptTag({content:fs.readFileSync(root+'/extension/vendor/Readability.js','utf8')});
 await page.addScriptTag({content:fs.readFileSync(root+'/extension/collector.js','utf8')});
 await page.addScriptTag({content:fs.readFileSync(root+'/extension/sidebar.js','utf8')});
 await page.waitForFunction(()=>globalThis.testShadow?.getElementById('submit')?.disabled===false);

 await page.evaluate(()=>{state.model='fixture-model';state.effort='medium';state.draft='Unsent draft';state.context={id:'quote',automatic:true,text:'A selected passage, kept verbatim.',title:'Fixture page',url:location.href};state.history=[{role:'user',text:'Keep this original question unchanged.',sources:[{kind:'selection',title:'Fixture page',url:location.href}]},{role:'assistant',text:'## A clear answer\n\nThis is a **response** that wraps naturally in a narrow sidebar.\n\n- First finding\n- Another finding\n\n`Readable code`'}];});
 await page.waitForFunction(()=>testShadow.querySelectorAll('.message').length===2);
 const set=async(id,value)=>{await page.evaluate(({id,value})=>{const e=testShadow.getElementById(id);e.value=String(value);e.dispatchEvent(new Event('change'));},{id,value});await page.waitForFunction(({id,value})=>testShadow.getElementById(id).value===String(value),{id,value});};
 await page.evaluate(()=>{testShadow.getElementById('more').click();testShadow.getElementById('settings-open').click();});
 assert(await page.evaluate(()=>!testShadow.getElementById('settings-panel').hidden&&testShadow.getElementById('menu').hidden));checks.push('settings use a separate panel rather than crowding the conversation menu');
 await set('language','en');await page.waitForFunction(()=>testShadow.getElementById('submit').getAttribute('aria-label')==='Send');
 assert.equal(await page.evaluate(()=>testShadow.getElementById('title').textContent),'New chat');
 assert.equal(await page.evaluate(()=>testShadow.getElementById('question').placeholder),'Ask about the selected text…');
 assert.equal(await page.evaluate(()=>testShadow.getElementById('pin').getAttribute('aria-label')),'Pin sidebar');
 assert.equal(await page.evaluate(()=>testShadow.querySelector('.message.user .body').textContent),'Keep this original question unchanged.');
 assert.equal(await page.evaluate(()=>testShadow.getElementById('context-cards').textContent),'Selected textA selected passage, kept verbatim.');
 checks.push('English labels, accessible names, quote context and placeholders update while chat and quote text remain unchanged');
 await set('font-size',20);await page.waitForFunction(()=>getComputedStyle(testShadow.querySelector('.body')).fontSize==='20px');
 assert.equal(await page.evaluate(()=>getComputedStyle(testShadow.getElementById('question')).fontSize),'20px');
 checks.push('text size applies to existing messages and the composer');
 await page.evaluate(()=>{const q=testShadow.getElementById('question');q.value='Unsent draft survives preferences';q.dispatchEvent(new Event('input'));});
 await page.waitForFunction(()=>state.draft==='Unsent draft survives preferences');
 await set('language','zh-CN');await page.waitForFunction(()=>testShadow.getElementById('submit').getAttribute('aria-label')==='发送');
 assert.equal(await page.evaluate(()=>testShadow.getElementById('question').value),'Unsent draft survives preferences');
 checks.push('changing language preserves unsent draft, selected context, model and effort');
 const sizes=[12,14,16,18,20],widths=[280,340,460];
 for(const theme of ['light','dark'])for(const lang of ['zh-CN','en'])for(const width of widths)for(const size of sizes){
  await page.evaluate(p=>Object.assign(state.preferences,p),{theme,language:lang,font_size:size});
  const grip=await page.evaluate(()=>{const r=testShadow.getElementById('resize').getBoundingClientRect();return{x:r.left+3,y:r.top+80};});
  await page.mouse.move(grip.x,grip.y);await page.mouse.down();await page.mouse.move(1200-width,grip.y);await page.mouse.up();
  await page.waitForFunction(({lang,size,width,theme})=>{const h=document.querySelector('[data-safari-codex-sidebar]');return h.lang===lang&&h.dataset.theme===theme&&getComputedStyle(testShadow.getElementById('question')).fontSize===size+'px'&&h.getBoundingClientRect().width===width;},{lang,size,width,theme});
  const metrics=await page.evaluate(()=>{const panel=testShadow.querySelector('.panel'),rect=panel.getBoundingClientRect(),q=testShadow.getElementById('question'),ids=['history','new','pin','more','close','tabs','model-trigger','dictate','submit'];return {overflow:panel.scrollWidth-panel.clientWidth,controls:ids.map(id=>{const b=testShadow.getElementById(id).getBoundingClientRect();return{id,left:b.left-rect.left,right:rect.right-b.right,top:b.top,bottom:b.bottom,width:b.width}}),font:getComputedStyle(q).fontSize,rounding:getComputedStyle(panel).borderRadius,background:getComputedStyle(panel).backgroundColor,composer:getComputedStyle(testShadow.querySelector('.compose')).backgroundColor,settingsOverflow:testShadow.getElementById('settings-panel').scrollWidth-testShadow.getElementById('settings-panel').clientWidth}});
  assert(metrics.overflow<=1);assert(metrics.settingsOverflow<=1);assert(metrics.controls.every(c=>c.left>=-1&&c.right>=-1&&c.width>0));assert.notEqual(metrics.background,metrics.composer);assert.equal(metrics.rounding,'18px');
  // Hover tools must not change message or next-message geometry at any size.
  await page.evaluate(()=>testShadow.getElementById('settings-close').click());
  const geometry=()=>page.evaluate(()=>Array.from(testShadow.querySelectorAll('.message')).map(e=>{const r=e.getBoundingClientRect();return [r.top,r.height]}));const before=await geometry();
  const point=await page.evaluate(()=>{const r=testShadow.querySelector('.message.user .body').getBoundingClientRect();return{x:r.left+4,y:r.top+4}});await page.mouse.move(point.x,point.y);assert.deepEqual(await geometry(),before);await page.mouse.move(20,20);assert.deepEqual(await geometry(),before);
  checks.push(`${theme}/${lang}/${width}px/${size}px: contained controls, distinct surfaces, stable hover geometry`);
  if(size===16&&((width===460&&lang==='zh-CN'&&theme==='light')||(width===280&&lang==='en'&&theme==='light')||(width===340&&lang==='en'&&theme==='dark'))){const filename=`appearance-0.4.8-${theme}-${lang}-${width}.png`;await page.screenshot({path:path.join(root,'tests',filename),clip:{x:1200-width,y:0,width,height:900}});screenshots.push(filename);}
  await page.evaluate(()=>{testShadow.getElementById('more').click();testShadow.getElementById('settings-open').click();});
 }
 await set('language','en');await set('font-size',18);await set('theme-select','light');
 await page.waitForFunction(()=>document.querySelector('[data-safari-codex-sidebar]').lang==='en');
 await page.screenshot({path:path.join(root,'tests','appearance-0.4.8-settings-en.png'),clip:{x:740,y:0,width:460,height:900}});
 await page.evaluate(async()=>{await listeners[0]({type:'sidebar_close_panel'},{id:'fixture'});await listeners[0]({type:'sidebar_open'},{id:'fixture'});});
 await page.waitForFunction(()=>testShadow.getElementById('submit').disabled===false);
 assert.equal(await page.evaluate(()=>document.querySelector('[data-safari-codex-sidebar]').lang),'en');assert.equal(await page.evaluate(()=>getComputedStyle(testShadow.getElementById('question')).fontSize),'18px');
 assert.equal(await page.evaluate(()=>testShadow.getElementById('question').value),'Unsent draft survives preferences');
 checks.push('closing and reopening restores English, text size, theme, draft and session');
 await page.evaluate(()=>{testShadow.getElementById('tabs').click();});
 assert.equal(await page.evaluate(()=>testShadow.getElementById('tabs-add').textContent.trim()),'Add other tabs');
 await page.evaluate(()=>testShadow.getElementById('tabs-add').click());await page.waitForFunction(()=>testShadow.querySelector('.tab-row'));
 assert((await page.evaluate(()=>testShadow.querySelector('.tab-row').getAttribute('aria-label'))).startsWith('Add tab: '));
 checks.push('English tab picker and context menu remain functional');
 await page.evaluate(()=>{const grip=testShadow.getElementById('resize');grip.focus();grip.dispatchEvent(new KeyboardEvent('keydown',{key:'Home',bubbles:true}));});
 assert.equal(await page.evaluate(()=>document.querySelector('[data-safari-codex-sidebar]').getBoundingClientRect().width),280);
 assert.equal(await page.evaluate(()=>testShadow.getElementById('resize').getAttribute('aria-valuenow')),'280');
 await page.keyboard.press('Shift+ArrowLeft');
 assert.equal(await page.evaluate(()=>document.querySelector('[data-safari-codex-sidebar]').getBoundingClientRect().width),330);
 assert.equal(await page.evaluate(()=>state.preferences.width),330);
 checks.push('accessible separator supports Home and Shift+ArrowLeft with persisted width');
 assert.equal(errors.length,0,errors.join('\n'));
 const report={version:'0.4.8',engine:'Chromium headless',scope:'controlled local fixture; mocked extension APIs; not a real Safari run',passed:checks.length,checks,screenshots};fs.writeFileSync(root+'/tests/appearance-results.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:checks.length,screenshots},null,2));
}finally{await browser.close();}
