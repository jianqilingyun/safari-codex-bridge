const nativeApp = 'local.codex.safari.context';
let nativePort;
const normalTab = tab => !tab.incognito && /^https?:\/\//.test(tab.url || '');
async function targetTab(id) {
  const tab = id === undefined ? (await browser.tabs.query({active:true,lastFocusedWindow:true}))[0] : await browser.tabs.get(id);
  if (!tab || !normalTab(tab)) throw new Error('请选择普通窗口中的 HTTP/HTTPS 网页。私密窗口与内部页面不支持读取。');
  return tab;
}
async function content(tab, message) {
  const send = async () => {
    const reply=await browser.tabs.sendMessage(tab.id,message);
    // Safari can resolve without a response when an already-open page still
    // has an invalidated content-script connection after an extension update.
    if (!reply || typeof reply !== 'object') throw new Error('网页脚本未响应，请刷新此网页后重试。');
    return reply;
  };
  try { return await send(); }
  catch (first) {
    try {
      await browser.tabs.executeScript(tab.id, {file:'vendor/Readability.js'});
      await browser.tabs.executeScript(tab.id, {file:'collector.js'});
      return await send();
    } catch (_) { throw new Error('无法读取该网页。请刷新此网页，并确认已授予此网站访问权限。'); }
  }
}
async function rasterize(dataUrl, maxDimension=2400, cropFraction=1) {
  if (!/^data:image\/(png|jpeg|webp|gif);base64,/.test(dataUrl)) throw new Error('Unsupported image encoding');
  const img = new Image(); img.src = dataUrl; await img.decode();
  const sourceWidth=Math.max(1,Math.round(img.naturalWidth*Math.max(0.1,Math.min(1,cropFraction))));
  const scale = Math.min(1,maxDimension / Math.max(sourceWidth,img.naturalHeight));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(sourceWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
  const ctx=canvas.getContext('2d');
  // JPEG has no alpha channel. Transparent charts often use black text, so
  // composite onto white instead of letting transparent pixels become black.
  ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(img,0,0,sourceWidth,img.naturalHeight,0,0,canvas.width,canvas.height);
  const resized = canvas.toDataURL('image/jpeg',0.9);
  return {data:resized.split(',')[1],mimeType:'image/jpeg',width:canvas.width,height:canvas.height};
}
async function screenshot(tab) {
  const before=(await browser.tabs.query({active:true,windowId:tab.windowId}))[0];
  if (before?.id !== tab.id) throw new Error('截图只支持当前可见标签页。请先自行切换到目标页。');
  const data=await browser.tabs.captureVisibleTab(tab.windowId,{format:'png'});
  const after=(await browser.tabs.query({active:true,windowId:tab.windowId}))[0];
  if (after?.id !== tab.id || after?.url !== tab.url) throw new Error('截图时标签页发生变化，请重试。');
  return rasterize(data);
}
async function readImage(tab,id) {
  const meta=await content(tab,{type:'image',image_id:id});
  const src=new URL(meta.src);
  if (!['http:','https:','data:'].includes(src.protocol) || src.username || src.password) throw new Error('不支持该图片地址，请使用页面截图。');
  let data;
  if (src.protocol === 'data:') data=src.href;
  else {
    const abort=new AbortController();const timer=setTimeout(()=>abort.abort(),12000);
    try {
      const response=await fetch(src.href,{credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',signal:abort.signal});
      if (!response.ok || !/^image\/(png|jpeg|webp|gif)/i.test(response.headers.get('content-type') || '')) throw new Error('图片无法直接读取（或需登录）；请使用当前页截图。');
      if (Number(response.headers.get('content-length') || 0)>8000000) throw new Error('图片超过 8MB，请使用截图。');
      const blob=await response.blob();if(blob.size>8000000)throw new Error('图片超过 8MB，请使用截图。');
      data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(blob);});
    } finally {clearTimeout(timer);}
  }
  return {metadata:meta,image:await rasterize(data)};
}
async function execute(command) {
  const a=command.args || {};
  switch(command.action) {
    case 'status': return {version:'0.4.8',connected:true,captured_at:new Date().toISOString(),sidebar_tabs:[...sidebarTabs].map(([tab_id,s])=>({tab_id,window_id:s.windowId,opened:s.opened,busy:s.busy,message_count:s.history.length,error:s.error}))};
    case 'list_tabs': return {captured_at:new Date().toISOString(),tabs:(await browser.tabs.query({})).filter(normalTab).map(t=>({tab_id:t.id,window_id:t.windowId,title:t.title,url:t.url,active:t.active}))};
    case 'read_page': {const t=await targetTab(a.tab_id);return {tab_id:t.id,...await content(t,{type:'collect',args:a})};}
    case 'capture_visible_page': {
      const t=await targetTab(a.tab_id);const page=await content(t,{type:'collect',args:{mode:'page',max_chars:6000}});
      const image=await screenshot(t);return {tab_id:t.id,...page,image,screenshot_scope:'当前可见区域，包含图表及图片；不是整个长网页。'};
    }
    case 'read_image': {const t=await targetTab(a.tab_id);return {tab_id:t.id,url:t.url,captured_at:new Date().toISOString(),...await readImage(t,a.image_id)};}
    case 'compare_tabs': {
      const pages=[];
      for(const id of a.tab_ids) {try{const t=await targetTab(id);pages.push({tab_id:t.id,...await content(t,{type:'collect',args:{mode:'article',max_chars:a.max_chars || 10000}})});}catch(error){pages.push({tab_id:id,error:error.message});}}
      return {pages};
    }
    default: throw new Error('Unsupported read-only command');
  }
}
async function handle(command) {
  if (!command || !/^[0-9a-f-]{36}$/.test(command.id || '')) return;
  if (Number(command.expires_at)<Date.now()/1000) return;
  let response;
  try {response={id:command.id,result:await execute(command)};}
  catch(error){response={id:command.id,error:error.message};}
  await browser.runtime.sendNativeMessage(nativeApp,{type:'response',...response});
}
function connect() {
  try {
    nativePort=browser.runtime.connectNative(nativeApp);
    nativePort.onMessage.addListener(message=>handle(message.userInfo || message));
    nativePort.onDisconnect.addListener(()=>{nativePort=null;setTimeout(connect,2000);});
  } catch(_){setTimeout(connect,2000);}
}
connect();
browser.runtime.onMessage.addListener(async (message,sender)=>{
  if (sender.id !== browser.runtime.id) return;
  if(message?.type?.startsWith('sidebar_')) {
    try{return await sidebarMessage(message,sender);}catch(e){return {ok:false,error:e.message};}
  }
  // Legacy sharing remains a toolbar-only operation.
  if(sender.tab)return;
  if (message.type === 'toolbar_status') return browser.runtime.sendNativeMessage(nativeApp,{type:'status'});
  if (message.type === 'share_page') {
    const tab=await targetTab();const page={tab_id:tab.id,...await content(tab,{type:'collect',args:{mode:'article',max_chars:30000}})};
    if(message.include_image)page.image=await screenshot(tab);
    return browser.runtime.sendNativeMessage(nativeApp,{type:'share',page});
  }
});

const sidebarTabs=new Map();
let savedChats={},preferences={},lastSession='',storageQueue=Promise.resolve();
const storeReady=(async()=>{
  if(!browser.storage?.local)return;
  const data=await browser.storage.local.get(['safari_codex_history','safari_codex_preferences','safari_codex_last']);
  savedChats=data.safari_codex_history||{};preferences=data.safari_codex_preferences||{};lastSession=data.safari_codex_last||'';
})();
function saveStore() {
  if(!browser.storage?.local)return Promise.resolve();
  storageQueue=storageQueue.catch(()=>{}).then(()=>browser.storage.local.set({safari_codex_history:savedChats,safari_codex_preferences:preferences,safari_codex_last:lastSession}));
  return storageQueue;
}
function tabState(tab) {
  if(!sidebarTabs.has(tab.id)){
    const occupied=sidebarTabs.size>0;
    const restored=!occupied&&savedChats[lastSession];
    sidebarTabs.set(tab.id,{windowId:tab.windowId,session:crypto.randomUUID(),temporary:false,thread_id:null,title:'新对话',history:[],model:preferences.model||'',effort:preferences.effort||'',...restored,opened:false,draft:'',context:null,models:[],authenticated:false,error:'',busy:false,catalogBusy:false,historyBusy:false});
  }
  return sidebarTabs.get(tab.id);
}
async function persistChat(state) {
  if(state.temporary||!state.thread_id||!state.history.length)return;
  savedChats[state.session]={session:state.session,thread_id:state.thread_id,title:state.title,history:state.history.map(({job,...m})=>m),model:state.model,effort:state.effort,updated_at:Date.now()};
  lastSession=state.session;await saveStore();
}
async function nativeJob(state, action, args={}) {
  const id=crypto.randomUUID();const reply=await browser.runtime.sendNativeMessage(nativeApp,{type:'chat_request',request:{id,session:state.session,action,...args}});
  if(!reply?.ok)throw new Error(reply?.error||'问答后台未就绪。请先打开 Safari Codex Bridge 应用。');
  return {id,started:Date.now(),revision:-1};
}
async function loadCatalog(state) {
  state.error='';state.catalogBusy=true;
  try{state.catalogJob=await nativeJob(state,'catalog');}catch(e){state.error=e.message;state.catalogBusy=false;}
}
async function loadHistory(state) {
  if(!state.thread_id||state.temporary)return;
  state.historyBusy=true;
  try{state.historyJob=await nativeJob(state,'history',{thread_id:state.thread_id});}catch(e){state.error=e.message;state.historyBusy=false;}
}
async function cancelDictation(state) {
  if(state.dictationJob)await nativeJob(state,'dictate_cancel',{recording_id:state.dictationJob.id});
  if(state.dictation)state.dictation={...state.dictation,finished:true,cancelled:true,phase:'idle'};
  delete state.dictationJob;
  delete state.dictationBinding;
}
async function pollSidebar(state) {
  if(state.polling)return;state.polling=true;
  try {
    for(const key of ['catalogJob','historyJob','dictationJob','job']) {
      const job=state[key];if(!job)continue;
      if(Date.now()-job.started>(key==='job'?260000:key==='dictationJob'?180000:60000))throw new Error('后台连接超时，请点击重连后重试。');
      const response=await browser.runtime.sendNativeMessage(nativeApp,{type:'chat_poll',id:job.id});
      if(!response?.ok)throw new Error(response?.error||'后台连接失败');
      const r=response.state;if(!r||r.revision===job.revision)continue;job.revision=r.revision;
      if(key==='dictationJob') {
        state.dictation={id:job.id,...r};
        if(r.finished)delete state.dictationJob;
      } else if(key==='catalogJob') {
        if(r.finished){state.catalogBusy=false;delete state.catalogJob;if(r.error)state.error=r.error;else{state.models=r.models||[];state.authenticated=!!r.authenticated;state.plan=r.plan;state.runtime=r.runtime;state.catalogAt=Date.now();}}
      } else if(key==='historyJob') {
        if(r.finished){state.historyBusy=false;delete state.historyJob;if(r.error)state.error=r.error;else{state.history=r.history||[];state.title=r.title||state.title;await persistChat(state);}}
      } else {
        const assistant=state.history.find(m=>m.job===job.id);
        if(r.thread_id&&!state.thread_id){state.thread_id=r.thread_id;await persistChat(state);}
        if(assistant&&typeof r.text==='string')assistant.text=r.text;
        if(r.finished){state.busy=false;delete state.job;state.error=r.error||'';if(assistant&&!assistant.text)assistant.text=r.error?'回答未完成。':r.event==='stopped'?'已停止。':'模型未返回内容，请重试。';await persistChat(state);}
      }
    }
  } catch(e){await cancelDictation(state).catch(()=>{});state.error=e.message;state.busy=false;state.catalogBusy=false;state.historyBusy=false;delete state.job;delete state.catalogJob;delete state.historyJob;}
  finally{state.polling=false;}
}
async function sidebarScreenshot(tab) {
  let geometry;
  try{
    geometry=await browser.tabs.sendMessage(tab.id,{type:'sidebar_hide_capture'});
    // Let Safari paint the hidden panel before capturing the visible viewport.
    await new Promise(r=>setTimeout(r,100));
    const before=(await browser.tabs.query({active:true,windowId:tab.windowId}))[0];
    if(before?.id!==tab.id)throw new Error('请保持目标标签页可见，或取消截图。');
    const image=await browser.tabs.captureVisibleTab(tab.windowId,{format:'png'});
    const after=(await browser.tabs.query({active:true,windowId:tab.windowId}))[0];
    if(after?.id!==tab.id||after?.url!==tab.url)throw new Error('截图时网页发生变化，请重试。');
    return await rasterize(image,2400,geometry?.crop_width/geometry?.viewport_width||1);
  } finally{await browser.tabs.sendMessage(tab.id,{type:'sidebar_restore_capture'}).catch(()=>{});}
}

async function sidebarMessage(message,sender) {
  await storeReady;
  let tab;
  if(message.type==='sidebar_open_toolbar') {
    if(sender.tab)throw new Error('Unsupported sidebar entry');tab=await targetTab();
  } else {
    if(!sender.tab||!normalTab(sender.tab))throw new Error('仅支持已授权的普通网页。');
    tab=await targetTab(sender.tab.id);if(sender.tab.url!==tab.url)throw new Error('网页发生变化，请重试。');
  }
  const state=tabState(tab);
  switch(message.type) {
    case 'sidebar_open_toolbar':
      state.opened=true;await browser.tabs.executeScript(tab.id,{file:'sidebar.js'});await browser.tabs.sendMessage(tab.id,{type:'sidebar_open'});
      if(!state.models.length&&!state.catalogBusy)await loadCatalog(state);return {ok:true};
    case 'sidebar_init':
      if(state.documentId!==message.document_id){if(state.documentId){state.context=null;await cancelDictation(state);}state.documentId=message.document_id;if(preferences.pinned===true)state.opened=true;}
      if(state.opened&&!state.models.length&&!state.catalogBusy)await loadCatalog(state);
      return {opened:state.opened,preferences};
    case 'sidebar_close':state.opened=false;await cancelDictation(state);return {ok:true};
    case 'sidebar_state':
      await pollSidebar(state);
      if(!state.catalogBusy&&Date.now()-(state.catalogAt||0)>300000)await loadCatalog(state);
      if(state.context&&state.context.url!==tab.url)state.context=null;
      return {opened:state.opened,session:state.session,temporary:state.temporary,thread_id:state.thread_id,title:state.title,history:state.history,models:state.models,model:state.model,effort:state.effort,authenticated:state.authenticated,error:state.error,busy:state.busy,catalogBusy:state.catalogBusy,historyBusy:state.historyBusy,runtime:state.runtime,preferences,draft:state.draft,context:state.context,dictation:state.dictation};
    case 'sidebar_draft':
      if(typeof message.text==='string'&&message.text.length<=8000)state.draft=message.text;
      return {ok:true};
    case 'sidebar_selection': {
      if(!state.opened||message.session!==state.session||message.document_id!==state.documentId)return {ok:false,error:'网页或对话已变化。'};
      const ref=message.selection;
      if(ref?.url!==tab.url||typeof ref.text!=='string'||!ref.text.trim()||ref.text.length>8000)return {ok:false,error:'所选文字已过期或过长。'};
      state.context={id:crypto.randomUUID(),text:ref.text,url:tab.url,title:tab.title,truncated:!!ref.truncated,automatic:true};
      return {ok:true,context:state.context};
    }
    case 'sidebar_context_clear':state.context=null;return {ok:true};
    case 'sidebar_reconnect':
      if(state.busy)throw new Error('请先停止当前回答。');
      await loadCatalog(state);await loadHistory(state);return {ok:true};
    case 'sidebar_preferences':
      for(const key of ['model','effort','attach_page','include_image','theme','width'])if(message.values?.[key]!==undefined)preferences[key]=message.values[key];
      if(['zh-CN','en'].includes(message.values?.language))preferences.language=message.values.language;
      if([12,14,16,18,20].includes(message.values?.font_size))preferences.font_size=message.values.font_size;
      if(typeof message.values?.pinned==='boolean')preferences.pinned=message.values.pinned;
      if(typeof message.values?.dictation_shortcut==='string'&&message.values.dictation_shortcut.length<=64)preferences.dictation_shortcut=message.values.dictation_shortcut.trim();
      if(['single','double'].includes(message.values?.dictation_shortcut_mode))preferences.dictation_shortcut_mode=message.values.dictation_shortcut_mode;
      if(message.values?.model!==undefined)state.model=message.values.model;
      if(message.values?.effort!==undefined)state.effort=message.values.effort;
      await persistChat(state);await saveStore();if(message.values?.language!==undefined)await updateChromeLanguage();return {ok:true};
    case 'sidebar_history_list':return {chats:Object.values(savedChats).map(({history,...record})=>record).sort((a,b)=>b.updated_at-a.updated_at)};
    case 'sidebar_history_open': {
      if(state.busy||state.preparing||state.historyBusy||state.dictationStarting)throw new Error('请先完成当前操作。');
      await cancelDictation(state);
      const record=savedChats[message.session];if(!record)throw new Error('未找到这段历史。');
      await nativeJob(state,'reset');delete state.historyJob;state.historyBusy=false;Object.assign(state,record,{temporary:false,error:'',draft:'',context:null});await loadHistory(state);return {ok:true};
    }
    case 'sidebar_open_desktop':
      if(state.temporary||!state.thread_id)throw new Error('临时会话不加入 Codex 历史。');
      if(state.busy)throw new Error('请等待回答结束后在 Codex 中继续。');
      return browser.runtime.sendNativeMessage(nativeApp,{type:'chat_open_desktop',thread_id:state.thread_id});
    case 'sidebar_tabs':return {tabs:(await browser.tabs.query({windowId:tab.windowId})).filter(t=>normalTab(t)&&t.id!==tab.id).map(t=>({tab_id:t.id,title:t.title,url:t.url}))};
    case 'sidebar_stop':if(state.job)await nativeJob(state,'stop');return {ok:true};
    case 'sidebar_dictation_start': {
      if(state.busy||state.dictationJob||state.dictationStarting)throw new Error('请先完成当前回答或听写。');
      state.dictationStarting=true;
      try{
        const args={shortcut:preferences.dictation_shortcut||'',shortcut_mode:preferences.dictation_shortcut_mode||'single'};
        const job=await nativeJob(state,'dictate_start',args);state.dictationBinding={id:job.id,...args};
        state.dictationJob=job;state.dictation={id:job.id,phase:'permission',finished:false};
        if(!state.opened)await cancelDictation(state);
        return {ok:true,id:job.id};
      }finally{state.dictationStarting=false;}
    }
    case 'sidebar_dictation_finish': {
      await pollSidebar(state);
      const binding=state.dictationBinding;
      if(state.busy||state.dictationStarting||state.dictationJob)throw new Error('请等待听写快捷键交接完成。');
      if(!binding||binding.id!==message.id||state.dictation?.id!==message.id||!state.dictation.handed_off||state.dictation.cancelled)throw new Error('这次听写已结束或不属于当前标签页。');
      if(binding.shortcut_mode!=='single')throw new Error('侧栏结束按钮需要 Codex 的 Single tap 听写快捷键。');
      state.dictationStarting=true;
      try{
        const job=await nativeJob(state,'dictate_finish',{shortcut:binding.shortcut,shortcut_mode:'single',recording_id:message.id});
        state.dictationJob=job;state.dictation={id:job.id,phase:'finishing',finished:false};
        if(!state.opened)await cancelDictation(state);
        return {ok:true,id:job.id};
      }finally{state.dictationStarting=false;}
    }
    case 'sidebar_dictation_stop':
      if(state.dictationJob?.id===message.id)await nativeJob(state,'dictate_stop',{recording_id:message.id});
      return {ok:true};
    case 'sidebar_dictation_cancel':
      if(state.dictationJob?.id===message.id||!message.id)await cancelDictation(state);
      return {ok:true};
    case 'sidebar_new':
      if(state.busy||state.preparing||state.historyBusy||state.dictationStarting)throw new Error('请先完成当前操作。');
      await cancelDictation(state);
      await nativeJob(state,'reset');delete state.historyJob;state.historyBusy=false;state.session=crypto.randomUUID();state.temporary=!!message.temporary;state.thread_id=null;state.title='新对话';state.history=[];state.error='';state.draft='';state.context=null;return {ok:true};
    case 'sidebar_ask': {
      if(state.busy||state.preparing||state.historyBusy||state.dictationJob||state.dictationStarting)throw new Error('请先完成当前回答或听写。');
      if([...sidebarTabs.values()].some(s=>s!==state&&s.thread_id&&s.thread_id===state.thread_id&&s.busy))throw new Error('这段对话正在另一个标签页回答，请等待完成。');
      if(!state.authenticated)throw new Error('请先连接已登录的 Codex 账号。');
      if(typeof message.question!=='string'||!message.question.trim()||message.question.length>8000)throw new Error('请输入 8000 字以内的问题。');
      if(!state.models.some(m=>m.model===message.model))throw new Error('所选模型已不可用，请刷新模型列表重新选择。不会自动替换模型。');
      const chosen=state.models.find(m=>m.model===message.model);
      if(message.effort&&!chosen.supportedReasoningEfforts?.some(e=>e.reasoningEffort===message.effort))throw new Error('所选思考深度已不可用，请重新选择。');
      if(message.include_image&&message.attach_page&&chosen.inputModalities&&!chosen.inputModalities.includes('image'))throw new Error('此模型不支持图片，请关闭截图或换一个支持图片的模型。');
      state.preparing=true;state.error='';
      try{
        const pages=[];
        if(message.selection){
          const selected=message.selection;
          if(typeof selected.text!=='string'||!selected.text.trim()||selected.text.length>8000||selected.url!==tab.url)throw new Error('选中文字已过期或过长，请重新选择。');
          pages.push({tab_id:tab.id,title:tab.title,url:tab.url,mode:'selection',text:selected.text,total_chars:selected.text.length,truncated:!!selected.truncated,captured_at:new Date().toISOString()});
        }
        if(message.attach_page){const page={tab_id:tab.id,...await content(tab,{type:'collect',args:{mode:'article',max_chars:30000}})};
          if(page.url!==tab.url)throw new Error('提取时网页发生变化，请重试。');
          if(message.include_image)page.pixels=[await sidebarScreenshot(tab)];pages.push(page);
        }
        const ids=[...new Set(message.extra_tabs||[])].filter(id=>Number.isInteger(id)&&id!==tab.id).slice(0,3);
        for(const id of ids){const t=await targetTab(id);if(t.windowId!==tab.windowId)throw new Error('只支持添加当前窗口的标签页。');const page={tab_id:id,...await content(t,{type:'collect',args:{mode:'article',max_chars:20000}})};if(page.url!==t.url)throw new Error('附加网页发生变化，请重试。');pages.push(page);}
        const latest=await targetTab(tab.id);if(latest.url!==tab.url)throw new Error('网页发生变化，请重试。');
        if(!state.history.length)state.title='Safari · '+message.question.slice(0,44);
        state.model=message.model;state.effort=message.effort;
        state.job=await nativeJob(state,'chat',{question:message.question,model:message.model,effort:message.effort,pages,thread_id:state.thread_id,temporary:state.temporary,title:state.title});
        state.history.push({role:'user',text:message.question,sources:pages.map(p=>({title:p.title,url:p.url,kind:p.mode==='selection'?'selection':'page',excerpt:p.mode==='selection'?p.text:undefined}))},{role:'assistant',text:'',job:state.job.id});
        state.draft='';state.context=null;
        state.busy=true;return {ok:true};
      }finally{state.preparing=false;}
    }
    default:throw new Error('Unsupported sidebar message');
  }
}
function releaseTab(id){const state=sidebarTabs.get(id);if(state){state.opened=false;cancelDictation(state).catch(()=>{});persistChat(state).catch(()=>{});nativeJob(state,'reset').catch(()=>{});}sidebarTabs.delete(id);}
if(browser.tabs?.onRemoved)browser.tabs.onRemoved.addListener(releaseTab);
if(browser.windows?.onRemoved)browser.windows.onRemoved.addListener(id=>{for(const [tabId,state] of sidebarTabs)if(state.windowId===id)releaseTab(tabId);});
async function toggleSidebar(clickedTab) {
  await storeReady;
  const tab=await targetTab(clickedTab.id),state=tabState(tab);
  await browser.tabs.executeScript(tab.id,{file:'sidebar.js'});
  const current=await browser.tabs.sendMessage(tab.id,{type:'sidebar_visible'});
  if(current?.opened){state.opened=false;await browser.tabs.sendMessage(tab.id,{type:'sidebar_close_panel'});return;}
  state.opened=true;await browser.tabs.sendMessage(tab.id,{type:'sidebar_open'});
  if(!state.models.length&&!state.catalogBusy)await loadCatalog(state);
  if(state.thread_id&&!state.busy&&!state.historyBusy)await loadHistory(state);
}
if(browser.browserAction?.onClicked)browser.browserAction.onClicked.addListener(tab=>toggleSidebar(tab).catch(error=>{
  const state=tabState(tab);state.error=error.message;
  browser.browserAction.setTitle({tabId:tab.id,title:'Codex 网页问答：'+error.message}).catch(()=>{});
}));
async function updateChromeLanguage(){
  const title=preferences.language==='en'?'Codex':'Codex 网页问答';
  await browser.browserAction?.setTitle?.({title});
  if(browser.contextMenus?.update)await browser.contextMenus.update('safari-codex-selection',{title:preferences.language==='en'?'Ask Codex about selected text':'询问 Codex：所选文字'}).catch(()=>{});
}
storeReady.then(()=>updateChromeLanguage()).catch(()=>{});
if(browser.contextMenus){
  let registration=null;
  const register=()=>{
    if(registration)return registration;
    registration=browser.contextMenus.removeAll().then(()=>new Promise(resolve=>{
      browser.contextMenus.create({id:'safari-codex-selection',title:preferences.language==='en'?'Ask Codex about selected text':'询问 Codex：所选文字',contexts:['selection'],documentUrlPatterns:['http://*/*','https://*/*']},()=>{
        // Safari reports asynchronous create failures through the callback.
        const error=browser.runtime.lastError;
        if(error)console.warn('Selection menu registration:',error.message);
        resolve();
      });
    })).catch(()=>{}).finally(()=>{registration=null;});
    return registration;
  };
  browser.runtime.onInstalled?.addListener(register);storeReady.then(register);
  browser.contextMenus.onClicked.addListener(async(info,clickedTab)=>{
    if(info.menuItemId!=='safari-codex-selection'||!normalTab(clickedTab)||!info.selectionText?.trim())return;
    try{
      await storeReady;const tab=await targetTab(clickedTab.id),state=tabState(tab);
      if(info.frameUrl&&info.frameUrl!==tab.url)throw new Error('请在主网页选择文字；跨源框架请使用截图。');
      const readable=await content(tab,{type:'collect',args:{mode:'selection',max_chars:8000}});
      if(!readable.text)throw new Error('请选择网页正文；输入框和聊天内容不会附上。');
      state.context={id:crypto.randomUUID(),text:readable.text.slice(0,8000),url:tab.url,title:tab.title};state.opened=true;
      await browser.tabs.executeScript(tab.id,{file:'sidebar.js'});await browser.tabs.sendMessage(tab.id,{type:'sidebar_open'});
      if(!state.models.length&&!state.catalogBusy)await loadCatalog(state);
    }catch(e){tabState(clickedTab).error=e.message;}
  });
}
browser.commands?.onCommand.addListener(async command=>{if(command==='toggle-sidebar'){try{await toggleSidebar(await targetTab());}catch(_){}}});
