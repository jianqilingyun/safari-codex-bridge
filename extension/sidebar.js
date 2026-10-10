/* Isolated page UI. Credentials and model transport stay in native processes. */
(() => {
  const version='0.4.8';
  const documentId=crypto.randomUUID();
  let selectionTimer,selectionGeneration=0,lastSelectionSeen='';
  if(globalThis.__safariCodexSidebar?.version===version)return;
  globalThis.__safariCodexSidebar?.dispose?.();
  let host,shadow,timer,lastView='',width=Math.min(460,Math.max(320,Math.round(innerWidth*.30))),busy=false,attachment=true;
  let model='',effort='',catalog=[],extraTabs=[],ready=false,current={},hydrated=false,session='',theme='system',selection=null,cachedSelection=null,contextId='',draftTimer,tabCatalog=[],mentionStart=-1,composing=false,menuRequest=0;
  let pinned=false,voice=null,voiceConsumed='',voiceGeneration=0,voiceError='',voiceNotice='',voiceReturnTimer;
  const send=message=>browser.runtime.sendMessage(message),el=id=>shadow?.getElementById(id);
  let language='zh-CN',fontSize=16,staticLabels=[],displayKey='';
  const translations={
    "Codex 网页问答": "Codex",
    "Codex 桌面配套": "Codex desktop runtime",
    "调整侧栏宽度": "Resize sidebar",
    "历史记录": "Chat history",
    "新对话": "New chat",
    "固定侧栏": "Pin sidebar",
    "取消固定侧栏": "Unpin sidebar",
    "固定侧栏：在获授权网页自动打开": "Pin sidebar: open on authorized pages",
    "更多选项": "More options",
    "关闭侧边栏": "Close sidebar",
    "临时聊天": "Temporary chat",
    "在 Codex 中继续": "Continue in Codex",
    "开始临时聊天": "Start temporary chat",
    "附上所选文字": "Attach selected text",
    "导出 Markdown": "Export Markdown",
    "复制整段对话": "Copy conversation",
    "刷新模型与重新连接": "Refresh models and reconnect",
    "Codex 听写快捷键": "Codex dictation shortcut",
    "快捷键模式": "Shortcut mode",
    "听写快捷键模式": "Dictation shortcut mode",
    "与 Codex Settings → Voice 中的设置保持一致。": "Match the shortcut in Codex Settings → Voice.",
    "跟随系统": "System",
    "浅色": "Light",
    "深色": "Dark",
    "关闭历史记录": "Close history",
    "搜索历史记录": "Search history",
    "搜索对话": "Search chats",
    "跳到最新回答": "Jump to latest",
    "↓ 最新回答": "↓ Latest",
    "网页上下文": "Page context",
    "附上当前网页": "Attach current page",
    "包含可见截图": "Include visible screenshot",
    "截图": "Screenshot",
    "添加其他标签页": "Add other tabs",
    "模型": "Model",
    "思考深度": "Reasoning effort",
    "关闭来源预览": "Close source preview",
    "含截图": "Screenshot",
    "取消附上当前网页": "Remove current page",
    "问题": "Message",
    "提问，或输入 @ 添加标签页": "Ask anything, or type @ to add tabs",
    "添加来源": "Add context",
    "选择模型与推理程度": "Choose model and reasoning effort",
    "选择模型": "Choose model",
    "停止回答": "Stop response",
    "发送": "Send",
    "正在连接…": "Connecting…",
    "所选文字": "Selected text",
    "所选文字（已截取）": "Selected text (excerpt)",
    "附加标签页": "Additional tab",
    "标签页": "Tab",
    "查看来源：": "Preview context: ",
    "移除来源：": "Remove context: ",
    "发送时读取这篇网页正文。": "Page text is read when you send.",
    "针对所选文字提问…": "Ask about the selected text…",
    "已附上所选文字；发送前可以预览或移除。": "Selected text attached. Preview or remove it before sending.",
    "请先在网页正文中选择文字，再点击“附上所选文字”。": "Select text on the page, then choose “Attach selected text”.",
    "临时聊天 · 不加入历史": "Temporary chat · Not saved to history",
    "默认保存 · 可在 Codex 中继续": "Saved by default · Continue in Codex",
    "正在读取运行时": "Loading runtime",
    "正在思考…": "Thinking…",
    "这条回答没有完成，可以继续提问。": "This response is incomplete. You can continue the conversation.",
    "复制问题": "Copy message",
    "复制回答": "Copy response",
    "请选择文字复制。": "Select text to copy.",
    "正在恢复历史…": "Restoring chat…",
    "正在回答 · 可以随时停止": "Responding · You can stop at any time",
    "正在刷新模型…": "Refreshing models…",
    "请打开 Codex 完成登录，再点击重新连接。": "Open Codex and sign in, then reconnect.",
    "所选模型暂不可用，请重新选择。": "This model is unavailable. Choose another model.",
    "本次对话不长期保存；关闭窗口后结束。": "Temporary chat ends when you close the window.",
    "对话已准备好 · Enter 发送，Shift+Enter 换行": "Ready · Enter to send, Shift+Enter for a new line",
    "已请求结束听写，等待文字回填…": "Finishing dictation. Waiting for transcript…",
    "尚未收到听写文字，请查看 Codex 听写窗口。": "No transcript received. Check the Codex dictation window.",
    "再次点击麦克风结束听写。": "Click the microphone again to finish dictation.",
    "请在 Codex 听写窗口完成或取消；文字会填入这里。": "Finish or cancel in Codex. Your transcript will appear here.",
    "结束听写并转写": "Finish dictation and transcribe",
    "正在读取当前网页…": "Reading current page…",
    "正在发送…": "Sending…",
    "发送失败": "Could not send",
    "搜索标签页标题或网址": "Search tabs by title or URL",
    "搜索标签页": "Search tabs",
    "添加标签页：": "Add tab: ",
    "最多附加三个标签页，请先移除一个来源。": "You can attach up to three tabs. Remove one first.",
    "没有匹配的已授权标签页。": "No matching authorized tabs.",
    "没有匹配的对话。": "No matching chats.",
    "保存的对话会显示在这里。": "Saved chats will appear here.",
    "已请求 Codex 打开这段对话。": "Requested this chat in Codex.",
    "Safari 网页问答": "Safari chat",
    "你": "You",
    "来源：": "Sources:",
    "已复制整段对话。": "Conversation copied.",
    "请选择对话文字复制。": "Select conversation text to copy.",
    "正在停止…": "Stopping…",
    "设置": "Settings",
    "关闭设置": "Close settings",
    "界面语言": "Interface language",
    "字号": "Text size",
    "对话与输入文字": "Messages and composer",
    "外观": "Appearance",
    "听写": "Dictation",
    "默认": "Default",
    "问答后台未就绪。请先打开 Safari Codex Bridge 应用。": "Chat service is not ready. Open Safari Codex Bridge first.",
    "后台连接超时，请点击重连后重试。": "Connection timed out. Reconnect and try again.",
    "后台连接失败": "Connection failed",
    "请选择普通窗口中的 HTTP/HTTPS 网页。私密窗口与内部页面不支持读取。": "Choose an HTTP/HTTPS page in a normal window. Private windows and internal pages are unsupported.",
    "网页脚本未响应，请刷新此网页后重试。": "The page did not respond. Reload and try again.",
    "无法读取该网页。请刷新此网页，并确认已授予此网站访问权限。": "Cannot read this page. Reload it and check website access.",
    "请先停止当前回答。": "Stop the current response first.",
    "未找到这段历史。": "Chat not found.",
    "临时会话不加入 Codex 历史。": "Temporary chats are not saved in Codex history.",
    "请等待回答结束后在 Codex 中继续。": "Wait for the response to finish before continuing in Codex.",
    "请先完成当前回答或听写。": "Finish the current response or dictation first.",
    "仅支持已授权的普通网页。": "Only authorized pages in normal windows are supported.",
    "网页发生变化，请重试。": "The page changed. Try again.",
    "网页或对话已变化。": "The page or chat changed.",
    "所选文字已过期或过长。": "The selection is out of date or too long.",
    "请等待听写快捷键交接完成。": "Wait for the dictation shortcut handoff.",
    "这次听写已结束或不属于当前标签页。": "This dictation ended or belongs to another tab.",
    "侧栏结束按钮需要 Codex 的 Single tap 听写快捷键。": "Finishing from the sidebar requires the Codex Single tap shortcut.",
    "请先连接已登录的 Codex 账号。": "Connect to a signed-in Codex account first.",
    "请输入 8000 字以内的问题。": "Enter a message of up to 8,000 characters.",
    "所选模型已不可用，请刷新模型列表重新选择。不会自动替换模型。": "This model is unavailable. Refresh the model list and choose again. Models are never switched automatically.",
    "所选思考深度已不可用，请重新选择。": "This reasoning effort is unavailable. Choose again.",
    "此模型不支持图片，请关闭截图或换一个支持图片的模型。": "This model does not support images. Turn off screenshots or choose a compatible model.",
    "选中文字已过期或过长，请重新选择。": "The selection is out of date or too long. Select it again.",
    "这段对话正在另一个标签页回答，请等待完成。": "This chat is responding in another tab. Wait for it to finish.",
    "请保持目标标签页可见，或取消截图。": "Keep the target tab visible or turn off screenshots.",
    "截图时网页发生变化，请重试。": "The page changed during capture. Try again.",
    "提取时网页发生变化，请重试。": "The page changed during extraction. Try again.",
    "只支持添加当前窗口的标签页。": "Only tabs in the current window can be added.",
    "附加网页发生变化，请重试。": "An attached page changed. Try again.",
    "请先在更多菜单设置与 Codex 一致的听写快捷键。": "Set the same dictation shortcut as Codex in Settings.",
    "请先运行 Codex，并在 Settings → Voice 开启全局听写。": "Run Codex and enable global dictation in Settings → Voice.",
    "一键调用需要在系统设置 → 隐私与安全性 → 辅助功能中允许 Safari Chat Helper；也可直接按 Codex 听写快捷键。": "Allow Safari Chat Helper in System Settings → Privacy & Security → Accessibility, or use the Codex dictation shortcut directly.",
    "请回到 Safari 输入框后再点击 Dictate。": "Focus the Safari composer before clicking Dictate."
  };
  const t=text=>language==='en'?(translations[text]||text):text;
  function prepareLabels(){
    staticLabels=[];
    const walk=node=>{for(const child of node.childNodes){if(child.nodeType===3&&translations[child.textContent.trim()])staticLabels.push({node:child,text:child.textContent.trim()});else if(child.nodeType===1&&child.tagName!=='STYLE')walk(child);}};
    walk(shadow.querySelector('.panel'));
    for(const node of shadow.querySelectorAll('[aria-label],[title],[placeholder]'))for(const attr of ['aria-label','title','placeholder']){const text=node.getAttribute(attr);if(translations[text])staticLabels.push({node,attr,text});}
  }
  function applyDisplay(p={}){
    const nextLanguage=p.language==='en'?'en':'zh-CN',nextSize=[12,14,16,18,20].includes(p.font_size)?p.font_size:16;
    const key=nextLanguage+'|'+nextSize+'|'+(p.theme||'system');if(displayKey===key)return;
    const languageChanged=language!==nextLanguage;language=nextLanguage;fontSize=nextSize;displayKey=key;
    host.setAttribute('lang',language);host.setAttribute('aria-label',t('Codex 网页问答'));host.style.setProperty('--chat-font-size',fontSize+'px');
    for(const item of staticLabels)if(item.attr)item.node.setAttribute(item.attr,t(item.text));else item.node.textContent=t(item.text);
    el('language').value=language;el('font-size').value=String(fontSize);el('theme-select').value=p.theme||'system';applyTheme(p.theme);
    if(languageChanged){lastView='';if(catalog.length)updateModels(catalog);if(!el('history-panel').hidden){el('history-panel').hidden=true;}el('tabs-menu').hidden=true;}
    drawContexts();resizeComposer();
  }
  const paths={settings:'M4 7h16M4 17h16M9 4v6M15 14v6',pin:'M16 3l5 5-4 2-3 5-5-5 5-3zM9 15l-6 6',mic:'M12 3a3 3 0 00-3 3v6a3 3 0 006 0V6a3 3 0 00-3-3M5 10v2a7 7 0 0014 0v-2M12 19v3M8 22h8',close:'M6 6l12 12M18 6L6 18',new:'M12 20h9M16.5 3.5a2.1 2.1 0 013 3L9 17l-4 1 1-4z',history:'M3 11a9 9 0 119 10M3 4v7h7M12 7v5l3 2',more:'M5 12h.01M12 12h.01M19 12h.01',desktop:'M14 3h7v7M21 3l-9 9M10 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-5',page:'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M8 13h8M8 17h5',plus:'M12 5v14M5 12h14',send:'M12 19V5M5 12l7-7 7 7',stop:'M7 7h10v10H7z',copy:'M9 9h12v12H9zM5 15H3V3h12v2',check:'M5 12l4 4L19 6',refresh:'M20 7v5h-5M4 17v-5h5M6 6a8 8 0 0114 6M18 18A8 8 0 014 12',moon:'M21 12a9 9 0 11-9-9 7 7 0 009 9',search:'M21 21l-5-5M18 10a8 8 0 11-16 0 8 8 0 0116 0',chevron:'M6 9l6 6 6-6',shield:'M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6z'};
  const icon=name=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name]||paths.page}"/></svg>`;
  const action=(id,label,kind=id)=>`<button id="${id}" class="icon-button" aria-label="${label}" title="${label}">${icon(kind)}</button>`;
  function inline(parent, text) {
    const tokens = String(text).split(/(\*\*[^*\n]+\*\*|`[^`\n]+`|\[[^\]\n]+\]\(https?:\/\/[^\s)]+\))/g);
    for (const t of tokens) {
      let node;
      if (t.startsWith('**') && t.endsWith('**')) { node=document.createElement('strong');node.textContent=t.slice(2,-2); }
      else if(t.startsWith('`') && t.endsWith('`')) {node=document.createElement('code');node.textContent=t.slice(1,-1);}
      else {
        const match=t.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
        if(match){node=document.createElement('a');node.textContent=match[1];node.href=match[2];node.target='_blank';node.rel='noopener noreferrer';}
        else node=document.createTextNode(t);
      }
      parent.append(node);
    }
  }
  function markdown(parent, text) {
    parent.replaceChildren(); let list, code, table;
    for (const line of String(text).split('\n')) {
      if(line.startsWith('```')) {if(code){code=null;}else{code=document.createElement('pre');parent.append(code);}list=null;table=null;continue;}
      if(code){code.textContent += line+'\n';continue;}
      if(!line.trim()){list=null;table=null;continue;}
      if(/^\s*\|.+\|\s*$/.test(line)) {
        if(/^\s*\|[\s:|-]+\|\s*$/.test(line))continue;
        if(!table){table=document.createElement('table');parent.append(table);} const row=document.createElement('tr');
        line.trim().slice(1,-1).split('|').forEach(s=>{const cell=document.createElement('td');inline(cell,s.trim());row.append(cell);});table.append(row);list=null;continue;
      }
      table=null;
      const bullet=line.match(/^\s*(?:[-*] |\d+\. )(.*)$/);
      if(bullet){if(!list){list=document.createElement('ul');parent.append(list);}const li=document.createElement('li');inline(li,bullet[1]);list.append(li);continue;}
      list=null;const heading=line.match(/^(#{1,4})\s+(.*)$/);const p=document.createElement(heading?'h'+Math.min(4,heading[1].length+1):'p');inline(p,heading?heading[2]:line);parent.append(p);
    }
  }

  function layout(){width=Math.min(Math.max(280,width),innerWidth,Math.max(280,innerWidth*.65));host.style.setProperty('width',width+'px','important');document.documentElement.style.setProperty('--safari-codex-width',width+'px');resizeComposer();const grip=el('resize');if(grip){grip.setAttribute('aria-valuemin','280');grip.setAttribute('aria-valuemax',String(Math.floor(Math.min(innerWidth,Math.max(280,innerWidth*.65)))));grip.setAttribute('aria-valuenow',String(Math.round(width)));}}
  function close(){clearTimeout(selectionTimer);selectionGeneration++;clearTimeout(voiceReturnTimer);if(voice){send({type:'sidebar_dictation_cancel',id:voice.id}).catch(()=>{});voice=null;}voiceGeneration++;if(el('question'))saveDraft();clearInterval(timer);timer=null;host?.remove();host=null;shadow=null;hydrated=false;document.documentElement.removeAttribute('data-safari-codex-open');document.documentElement.style.removeProperty('--safari-codex-width');document.getElementById('safari-codex-layout')?.remove();}
  function status(text,error=false){if(el('status')){el('status').textContent=t(text);el('status').className=error?'error':'';el('status').hidden=!error&&[t('对话已准备好 · Enter 发送，Shift+Enter 换行'),t('本次对话不长期保存；关闭窗口后结束。')].includes(t(text));positionOverlays();}}
  function positionOverlays(){if(!host)return;const offset=shadow.querySelector('footer').offsetHeight+8;for(const id of ['tabs-menu','attach-menu','model-menu','source-details','latest','history-panel'])el(id).style.bottom=offset+'px';}
  function modelLabel(){if(!el('model-trigger'))return;const label=catalog.find(m=>m.model===model)?.displayName||model||t('选择模型'),depth=el('effort').selectedOptions[0]?.textContent||'';el('model-label').textContent=label+(depth?' · '+depth:'');el('model-trigger').title=el('model-label').textContent;}
  async function preference(values){const r=await send({type:'sidebar_preferences',values});if(r?.ok===false)status(r.error,true);}
  function applyTheme(value){theme=['light','dark','system'].includes(value)?value:'system';host.dataset.theme=theme;}
  function updateModels(models){
    catalog=models||[];const select=el('model');select.replaceChildren();
    catalog.forEach(m=>{const o=document.createElement('option');o.value=m.model;o.textContent=m.displayName||m.model;select.append(o);});
    if(!model)model=catalog.find(m=>m.isDefault)?.model||catalog[0]?.model||'';
    if(model&&!catalog.some(m=>m.model===model)){const o=document.createElement('option');o.value=model;o.textContent=model+(language==='en'?' (unavailable)':'（暂不可用）');o.disabled=true;select.append(o);}
    select.value=model;updateEffort();
  }
  function updateEffort(){
    const m=catalog.find(m=>m.model===model),select=el('effort');select.replaceChildren();
    const names={none:'None',minimal:'Minimal',low:'Low',medium:'Medium',high:'High',xhigh:'Extra high',max:'Max',ultra:'Ultra'};
    (m?.supportedReasoningEfforts||[]).forEach(e=>{const o=document.createElement('option');o.value=e.reasoningEffort;o.textContent=names[e.reasoningEffort]||e.reasoningEffort;select.append(o);});
    if(![...select.options].some(o=>o.value===effort))effort=m?.defaultReasoningEffort||select.options[0]?.value||'';
    select.value=effort;modelLabel();
  }
  function saveDraft(){clearTimeout(draftTimer);if(el('question'))send({type:'sidebar_draft',text:el('question').value}).catch(()=>{});}
  function resizeComposer(){const field=el('question');if(!field)return;field.style.height='auto';field.style.height=Math.min(150,Math.max(48,field.scrollHeight))+'px';}
  function composerInput(){if(voiceError||voiceNotice){voiceError='';voiceNotice='';if(current)render(current);}const field=el('question');resizeComposer();clearTimeout(draftTimer);draftTimer=setTimeout(saveDraft,180);
    const prefix=field.value.slice(0,field.selectionStart),match=prefix.match(/(?:^|\s)@([^@\n]*)$/);
    if(match&&!composing){el('attach-menu').hidden=true;el('model-menu').hidden=true;mentionStart=field.selectionStart-match[1].length-1;tabsMenu(true,match[1]);}
    else if(mentionStart>=0){mentionStart=-1;el('tabs-menu').hidden=true;}positionOverlays();
  }
  function drawContexts(){
    if(!host)return;const box=el('context-cards');box.replaceChildren();
    const refs=[...(selection?[{kind:'selection',title:selection.truncated?t('所选文字（已截取）'):t('所选文字'),subtitle:selection.text,text:selection.text,url:selection.url}]:[]),...extraTabs.map(id=>({kind:'tab',tab_id:id,...tabCatalog.find(t=>t.tab_id===id)}))];
    for(const ref of refs){const card=document.createElement('div');card.className='source'+(ref.kind==='selection'?' selection':'');const preview=document.createElement('button');preview.className='context-preview';preview.title=ref.text||ref.url||ref.title||t('附加标签页');preview.setAttribute('aria-label',t('查看来源：')+(ref.title||t('标签页')));const title=document.createElement('strong'),sub=document.createElement('small');title.textContent=ref.title||t('附加标签页');sub.textContent=ref.subtitle||ref.url||'';preview.append(title,sub);
      preview.addEventListener('click',()=>{el('source-details').hidden=false;el('source-detail-title').textContent=ref.title||t('标签页');el('source-detail-body').textContent=ref.text||ref.url||t('发送时读取这篇网页正文。');});
      const remove=document.createElement('button');remove.className='icon-button';remove.innerHTML=icon('close');remove.setAttribute('aria-label',t('移除来源：')+(ref.title||t('标签页')));remove.addEventListener('click',()=>{if(ref.kind==='selection'){clearTimeout(selectionTimer);selectionGeneration++;selection=null;el('source-details').hidden=true;send({type:'sidebar_context_clear'}).catch(()=>{});}else extraTabs=extraTabs.filter(id=>id!==ref.tab_id);drawContexts();});card.append(preview,remove);box.append(card);
    }
    el('extra-count').textContent=extraTabs.length?(language==='en'?`${extraTabs.length} more tabs`:`另附 ${extraTabs.length} 页`):'';el('question').placeholder=selection?t('针对所选文字提问…'):t('提问，或输入 @ 添加标签页');resizeComposer();positionOverlays();
  }
  function attachSelection(ref){
    if(!ref?.text)return;
    selection={text:ref.text.slice(0,8000),url:ref.url,title:ref.title,truncated:!!ref.truncated};
    if(!ref.automatic){attachment=false;el('attach').checked=false;el('screenshot').disabled=true;el('source-card').hidden=true;}
    drawContexts();
    if(!ref.automatic){el('question').focus();status(t('已附上所选文字；发送前可以预览或移除。'));}
  }
  async function selectText(){if(cachedSelection?.url===location.href)attachSelection(cachedSelection);else status(t('请先在网页正文中选择文字，再点击“附上所选文字”。'),true);}
  function sources(parent,refs){
    const box=document.createElement('div');box.className='sources';
    for(const ref of refs||[]){try{const url=new URL(ref.url);if(!['http:','https:'].includes(url.protocol))continue;const a=document.createElement('a');a.textContent=(ref.kind==='selection'?t('所选文字')+' · ':'')+(ref.title||url.hostname);a.href=url.href;a.target='_blank';a.rel='noopener noreferrer';a.title=ref.excerpt||url.href;box.append(a);}catch(_){}}
    if(box.childNodes.length)parent.append(box);
  }
  function render(state){
    if(!host)return;if(state.opened===false){close();return;}
    current=state;applyDisplay(state.preferences||{});
    pinned=state.preferences?.pinned===true;el('pin').setAttribute('aria-pressed',String(pinned));el('pin').title=pinned?t('取消固定侧栏'):t('固定侧栏：在获授权网页自动打开');el('pin').setAttribute('aria-label',pinned?t('取消固定侧栏'):t('固定侧栏'));
    if(shadow.activeElement!==el('dictation-shortcut'))el('dictation-shortcut').value=state.preferences?.dictation_shortcut||'';
    el('dictation-shortcut-mode').value=state.preferences?.dictation_shortcut_mode||'single';
    renderDictation(state);
    busy=!!(state.busy||state.historyBusy);ready=state.authenticated===true;
    if(!hydrated){const p=state.preferences||{};attachment=p.attach_page!==false;el('screenshot').checked=p.include_image!==false;applyTheme(p.theme);if(p.width){width=p.width;layout();}model=state.model||p.model||'';effort=state.effort||p.effort||'';el('question').value=state.draft||'';hydrated=true;}
    if(session!==state.session){if(session){clearTimeout(selectionTimer);selectionGeneration++;lastSelectionSeen='';cachedSelection=null;selection=null;extraTabs=[];el('question').value=state.draft||'';drawContexts();}session=state.session;lastView='';model=state.model||model;effort=state.effort||effort;updateModels(state.models||catalog);}
    if(JSON.stringify(state.models)!==JSON.stringify(catalog)&&state.models?.length)updateModels(state.models);
    el('submit').disabled=!!voice||busy||!ready||!catalog.some(m=>m.model===model);el('stop').hidden=!state.busy;el('submit').hidden=!!state.busy;
    for(const id of ['new','temporary','history','model','effort','model-trigger'])el(id).disabled=busy||!!voice;
    el('dictate').disabled=busy||!!voice&&voice.phase!=='ready';
    el('desktop').disabled=busy||state.temporary||!state.thread_id;
    el('title').textContent=state.temporary?t('临时聊天'):(!state.title||state.title==='新对话'?t('新对话'):state.title).replace(/^Safari · /,'');
    el('title').title=el('title').textContent;el('mode-note').hidden=!state.temporary;el('temporary').classList.toggle('selected',!!state.temporary);
    el('mode-note').textContent=state.temporary?t('临时聊天 · 不加入历史'):t('默认保存 · 可在 Codex 中继续');
    el('page-title').textContent=document.title;el('page-url').textContent=location.hostname;el('source-card').hidden=!attachment;el('attach').checked=attachment;el('screenshot').disabled=!attachment;el('snapshot-note').hidden=!el('screenshot').checked;
    el('extra-count').textContent=extraTabs.length?(language==='en'?`${extraTabs.length} more tabs`:`另附 ${extraTabs.length} 页`):'';positionOverlays();
    el('runtime-info').textContent=state.runtime?`${t(state.runtime.source)} · ${state.runtime.version}`:t('正在读取运行时');
    if(state.context&&state.context.id!==contextId){contextId=state.context.id;attachSelection(state.context);}
    const serialized=JSON.stringify(state.history||[]);
    if(serialized!==lastView){
      const box=el('messages'),previousTop=box.scrollTop,nearEnd=box.scrollHeight-previousTop-box.clientHeight<100;lastView=serialized;box.replaceChildren();
      // Empty conversations intentionally leave the reading area blank.
      for(const message of state.history||[]){const entry=document.createElement('article');entry.className='message '+message.role;const body=document.createElement('div');body.className='body';
        if(message.text)markdown(body,message.text);else{body.className+=' thinking';body.textContent=busy?t('正在思考…'):t('这条回答没有完成，可以继续提问。');}
        const bubble=message.role==='user'?document.createElement('div'):entry;if(bubble!==entry){bubble.className='message-bubble';entry.append(bubble);}bubble.append(body);sources(bubble,message.sources);
        if(message.text){const tools=document.createElement('div');tools.className='message-tools';const copy=document.createElement('button');copy.className='icon-button';copy.innerHTML=icon('copy');copy.title=t(message.role==='user'?'复制问题':'复制回答');copy.setAttribute('aria-label',copy.title);copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(message.text);copy.innerHTML=icon('check');}catch(_){status(t('请选择文字复制。'),true);}});tools.append(copy);entry.append(tools);}
        box.append(entry);
      }
      box.scrollTop=nearEnd?box.scrollHeight:previousTop;el('latest').hidden=box.scrollHeight-box.scrollTop-box.clientHeight<100;
    }
    if(voiceError)status(voiceError,true);
    else if(voiceNotice)status(voiceNotice);
    else if(state.error)status(state.error,true);
    else if(state.historyBusy)status(t('正在恢复历史…'));
    else if(state.busy)status(t('正在回答 · 可以随时停止'));
    else if(state.catalogBusy)status(t('正在刷新模型…'));
    else if(!ready)status(t('请打开 Codex 完成登录，再点击重新连接。'),true);
    else if(!catalog.some(m=>m.model===model))status(t('所选模型暂不可用，请重新选择。'),true);
    else status(state.temporary?t('本次对话不长期保存；关闭窗口后结束。'):t('对话已准备好 · Enter 发送，Shift+Enter 换行'));
  }
  async function startDictation(){
    if(voice?.phase==='ready'){await finishDictation();return;}
    if(busy||voice)return;
    voiceError='';voiceNotice='';
    if(!current.preferences?.dictation_shortcut){dismissPopovers();el('settings-panel').hidden=false;positionOverlays();el('dictation-shortcut').focus();return;}
    dismissPopovers();
    const q=el('question'),generation=++voiceGeneration;
    q.focus();voice={id:null,session:session,phase:'dispatch',mode:current.preferences.dictation_shortcut_mode||'single'};saveDraft();renderDictation(current);
    try{
      const r=await send({type:'sidebar_dictation_start'});
      if(r?.ok===false)throw new Error(r.error);
      if(!host||generation!==voiceGeneration){send({type:'sidebar_dictation_cancel',id:r.id}).catch(()=>{});return;}
      if(voice)voice.id=r.id;
      await refresh();
    }catch(e){if(host&&generation===voiceGeneration){voice=null;voiceError=e.message;renderDictation(current);status(e.message,true);}}
  }
  async function finishDictation(){
    if(!voice||voice.phase!=='ready')return;
    const startID=voice.id,generation=++voiceGeneration;
    dismissPopovers();el('question').focus();saveDraft();voice.phase='finish';voiceError='';voiceNotice='';renderDictation(current);
    try{
      const r=await send({type:'sidebar_dictation_finish',id:startID});
      if(r?.ok===false)throw new Error(r.error);
      if(!host||generation!==voiceGeneration){send({type:'sidebar_dictation_cancel',id:r.id}).catch(()=>{});return;}
      if(voice){voice.startID=startID;voice.id=r.id;}
      await refresh();
    }catch(e){if(host&&generation===voiceGeneration&&voice){voice.phase='ready';voice.id=startID;voiceError=e.message;renderDictation(current);status(e.message,true);}}
  }
  function dictationReturned(){
    if(!voice)return;
    if(['dispatch','finish'].includes(voice.phase))send({type:'sidebar_dictation_cancel',id:voice.id}).catch(()=>{});
    clearTimeout(voiceReturnTimer);voice=null;voiceGeneration++;voiceError='';voiceNotice='';
    if(host){saveDraft();render(current);}
  }
  async function endDictation(){
    if(!voice)return;
    const id=voice.id;clearTimeout(voiceReturnTimer);voiceGeneration++;voice=null;voiceError='';voiceNotice='';renderDictation(current);
    try{await send({type:'sidebar_dictation_cancel',id});await refresh();}catch(e){status(e.message,true);}
  }
  function renderDictation(state){
    const d=state.dictation;
    if(voice&&voice.session!==state.session&&state.session){clearTimeout(voiceReturnTimer);voice=null;voiceGeneration++;}
    if(voice&&d?.id===voice.id&&d.finished&&voiceConsumed!==d.id){
      voiceConsumed=d.id;voiceError=d.error||'';
      if(d.handed_off&&voice.phase==='finish'){
        voice.phase='waiting';voiceNotice='已请求结束听写，等待文字回填…';
        clearTimeout(voiceReturnTimer);voiceReturnTimer=setTimeout(()=>{if(host&&voice?.phase==='waiting'){voice=null;voiceGeneration++;voiceNotice='';voiceError='尚未收到听写文字，请查看 Codex 听写窗口。';render(current);}},30000);
      }else if(d.handed_off&&voice.mode==='single'){
        voice.phase='ready';voiceNotice='再次点击麦克风结束听写。';
      }else{voice=null;if(d.handed_off)voiceNotice='请在 Codex 听写窗口完成或取消；文字会填入这里。';}
    }
    const active=!!voice;
    // Keep the actual textarea editable: official dictation returns text using
    // the focused app's normal paste action. Never pretend to own recording.
    el('question').hidden=false;el('question').readOnly=false;
    const finishable=voice?.phase==='ready';
    el('dictate').disabled=busy||active&&!finishable;
    el('dictate').setAttribute('aria-busy',String(active&&!finishable));
    el('dictate').setAttribute('aria-pressed',String(finishable));
    el('dictate').setAttribute('aria-label',finishable?t('结束听写并转写'):'Dictate');el('dictate').title=finishable?t('结束听写并转写'):'Dictate';
    positionOverlays();
  }
  async function refresh(){try{const state=await send({type:'sidebar_state'});if(state?.ok===false)throw new Error(state.error);render(state||{});}catch(e){status(e.message,true);}}
  async function ask(){clearTimeout(selectionTimer);selectionGeneration++;const question=el('question').value.trim();if(!question||busy||voice||!ready)return;busy=true;el('submit').disabled=true;status(attachment?t('正在读取当前网页…'):t('正在发送…'));
    try{const r=await send({type:'sidebar_ask',question,model,effort:el('effort').value,attach_page:attachment,include_image:attachment&&el('screenshot').checked,extra_tabs:extraTabs,selection});if(r?.ok===false)throw new Error(r.error||t('发送失败'));el('question').value='';el('question').style.height='';selection=null;drawContexts();await refresh();}catch(e){busy=false;el('submit').disabled=false;status(e.message,true);}
  }
  function toggleMenu(id){for(const name of ['menu','tabs-menu','history-panel','attach-menu','model-menu','settings-panel','source-details'])if(name!==id)el(name).hidden=true;el(id).hidden=!el(id).hidden;}
  async function tabsMenu(mention=false,query=''){
    if(!mention){mentionStart=-1;toggleMenu('tabs-menu');}else el('tabs-menu').hidden=false;
    const menu=el('tabs-menu');if(menu.hidden)return;
    const request=++menuRequest,r=await send({type:'sidebar_tabs'});if(!host||menu.hidden||request!==menuRequest)return;
    tabCatalog=r?.tabs||[];menu.replaceChildren();
    const search=document.createElement('input');search.type='search';search.placeholder=t('搜索标签页标题或网址');search.setAttribute('aria-label',t('搜索标签页'));search.value=query;menu.append(search);
    const list=document.createElement('div');menu.append(list);
    const draw=()=>{list.replaceChildren();const tabs=tabCatalog.filter(t=>(t.title+' '+t.url).toLowerCase().includes(search.value.toLowerCase()));
      for(const tab of tabs){const row=document.createElement('button');row.className='tab-row';row.setAttribute('aria-label',t('添加标签页：')+(tab.title||tab.url));const title=document.createElement('strong'),url=document.createElement('small');title.textContent=(extraTabs.includes(tab.tab_id)?'✓ ':'')+(tab.title||tab.url);url.textContent=tab.url;row.append(title,url);
        row.addEventListener('click',()=>{if(extraTabs.includes(tab.tab_id))extraTabs=extraTabs.filter(id=>id!==tab.tab_id);else if(extraTabs.length<3)extraTabs.push(tab.tab_id);else {status(t('最多附加三个标签页，请先移除一个来源。'),true);return;}
          if(mentionStart>=0){const field=el('question');field.value=field.value.slice(0,mentionStart)+field.value.slice(field.selectionStart);mentionStart=-1;saveDraft();}
          menu.hidden=true;drawContexts();el('question').focus();});list.append(row);}
      if(!tabs.length)list.textContent=t('没有匹配的已授权标签页。');};search.oninput=draw;draw();if(!mention)search.focus();
  }
  async function newChat(temporary=false){clearTimeout(selectionTimer);selectionGeneration++;lastSelectionSeen='';cachedSelection=null;const r=await send({type:'sidebar_new',temporary});if(r?.ok===false){status(r.error,true);return;}extraTabs=[];selection=null;drawContexts();el('question').value='';el('menu').hidden=true;el('history-panel').hidden=true;await refresh();el('question').focus();}
  async function historyMenu(){toggleMenu('history-panel');if(el('history-panel').hidden)return;const r=await send({type:'sidebar_history_list'});const chats=r.chats||[],box=el('history-list'),search=el('history-search');
    const draw=()=>{box.replaceChildren();const filtered=chats.filter(c=>c.title.toLowerCase().includes(search.value.toLowerCase()));if(!filtered.length){box.textContent=chats.length?t('没有匹配的对话。'):t('保存的对话会显示在这里。');return;}
      for(const chat of filtered){const b=document.createElement('button');b.className='history-row';const title=document.createElement('span');title.textContent=chat.title.replace(/^Safari · /,'');const date=document.createElement('small');date.textContent=new Date(chat.updated_at).toLocaleString(language,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});b.append(title,date);b.addEventListener('click',async()=>{const r=await send({type:'sidebar_history_open',session:chat.session});if(r?.ok===false){status(r.error,true);return;}el('history-panel').hidden=true;await refresh();});box.append(b);}
    };search.value='';search.oninput=draw;draw();search.focus();
  }
  function open(){
    if(host){el('question')?.focus();return;}
    const style=document.createElement('style');style.id='safari-codex-layout';style.textContent='html[data-safari-codex-open]{box-sizing:border-box!important;padding-right:var(--safari-codex-width)!important;}';document.documentElement.append(style);document.documentElement.setAttribute('data-safari-codex-open','');
    host=document.createElement('aside');host.setAttribute('data-safari-codex-sidebar','');host.setAttribute('aria-label',t('Codex 网页问答'));host.style.cssText='all:initial!important;position:fixed!important;right:0!important;top:0!important;height:100vh!important;box-sizing:border-box!important;padding:8px!important;background:var(--frame)!important;z-index:2147483647!important;display:block!important;';
    shadow=host.attachShadow({mode:'closed'});shadow.innerHTML=`<style>
      :host{--frame:#202124;--bg:#18191c;--surface:#26272b;--composer:#26272b;--hover:#ffffff0d;--text:#ececec;--muted:#aaa;--line:#ffffff16;--accent:#b6c9f7;--user:#303030;--shadow:#0004}
      @media(prefers-color-scheme:light){:host([data-theme=system]){--frame:#edf0f4;--bg:#f8f9fb;--surface:#f1f3f5;--composer:#fff;--hover:#00000008;--text:#242424;--muted:#717171;--line:#00000014;--accent:#3653a6;--user:#f0f0f0;--shadow:#0001}}
      :host([data-theme=light]){--frame:#edf0f4;--bg:#f8f9fb;--surface:#f1f3f5;--composer:#fff;--hover:#00000008;--text:#242424;--muted:#717171;--line:#00000014;--accent:#3653a6;--user:#f0f0f0;--shadow:#0001}
      *{box-sizing:border-box;min-width:0}button,input,select,textarea{font:inherit}button{border:0;background:none;color:inherit;cursor:pointer}button:disabled{opacity:.4;cursor:default}button:hover{background:var(--hover)}button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid var(--accent);outline-offset:2px}svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;flex:none}
      :host{--chat-font-size:16px;background:var(--frame)!important;padding:8px!important}.panel{height:100%;display:flex;flex-direction:column;position:relative;background:var(--bg);color:var(--text);font:14px/1.65 -apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif;border:1px solid var(--line);border-radius:18px;box-shadow:0 2px 12px var(--shadow);container-type:inline-size;overflow:hidden}
      header{padding:10px 12px 7px;flex:none}.heading-row{display:flex;align-items:center;gap:3px}.conversation-switch{display:flex;align-items:center;gap:6px;flex:1;text-align:left;padding:6px 8px;border-radius:9px;overflow:hidden}.conversation-switch svg{width:12px;height:12px;color:var(--muted)}#title{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:13px;font-weight:550}.icon-button{display:inline-flex;align-items:center;justify-content:center;border-radius:9px;width:30px;height:30px;padding:0;flex:0 0 auto;color:var(--muted)}#mode-note{font-size:11px;color:var(--muted);margin:2px 8px}
      .welcome{min-height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:28px 4px 56px;text-align:center}.welcome h2{font-size:21px;line-height:1.4;font-weight:500;margin:0 0 24px;letter-spacing:-.3px}.suggestions{display:flex;flex-wrap:wrap;justify-content:center;gap:8px}.suggestions button{border:1px solid var(--line);border-radius:20px;padding:7px 11px;font-size:12px;color:var(--muted);white-space:nowrap}
      #messages{font-size:var(--chat-font-size);flex:1;min-height:0;overflow:auto;padding:16px 18px 6px;overscroll-behavior:contain;scrollbar-width:thin}.message{margin:0 0 22px;overflow-wrap:anywhere;line-height:1.8}.message.user{margin-left:20px;font-size:var(--chat-font-size)}.message.user .message-bubble{background:var(--user);border-radius:17px;padding:10px 13px}.body p{margin:0 0 12px}.body p:last-child{margin:0}.body h2,.body h3,.body h4{font-size:1.08em;line-height:1.5;margin:20px 0 10px}.body ul{padding-left:20px;margin:10px 0}.body li{margin:6px 0}.thinking{color:var(--muted);animation:breathe 1.5s ease-in-out infinite}@keyframes breathe{50%{opacity:.45}}pre{white-space:pre-wrap;border:1px solid var(--line);background:var(--surface);border-radius:10px;padding:10px;font:.88em/1.6 monospace;overflow-wrap:anywhere}code{background:var(--surface);padding:2px 4px;border-radius:4px;font-size:.88em}table{display:block;overflow:auto;border-collapse:collapse;font-size:.88em;max-width:100%}td{border:1px solid var(--line);padding:7px}a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}.sources{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px;font-size:11px}.sources a{padding:3px 8px;border:1px solid var(--line);border-radius:8px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.message-tools{margin-top:7px;display:flex;gap:4px;color:var(--muted)}.message-tools .icon-button{width:26px;height:25px}.message.user .message-tools{justify-content:flex-end;height:25px;opacity:0;pointer-events:none;transition:opacity .12s ease}.message.user:hover .message-tools,.message.user:focus-within .message-tools{opacity:1;pointer-events:auto}@media(hover:none){.message.user .message-tools{opacity:1;pointer-events:auto}}@media(prefers-reduced-motion:reduce){.message.user .message-tools{transition:none}}
      footer{padding:8px 12px 12px;flex:none;max-height:55%;overflow:auto}.compose{border:1px solid var(--line);border-radius:22px;padding:10px;background:var(--composer);box-shadow:0 3px 14px var(--shadow)}.source{background:var(--surface);display:flex;align-items:center;gap:6px;border:1px solid var(--line);border-radius:10px;padding:4px 6px;font-size:11px;overflow:hidden}.source>svg{color:var(--muted);width:14px;height:14px}.source .titles{flex:1;overflow:hidden}#source-card{margin-bottom:6px}#page-title{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:11px;font-weight:500}#page-url,#extra-count{display:none}#snapshot-note{font-size:10px;color:var(--muted);white-space:nowrap;flex:none}.source .icon-button{width:22px;height:22px}.source .icon-button svg{width:13px;height:13px}#context-cards{display:flex;flex-wrap:wrap;gap:5px;max-height:100px;overflow:auto}#context-cards:not(:empty){margin-bottom:6px}#context-cards .source{flex:1 1 120px;max-width:100%;margin:0}.context-preview{flex:1;display:flex;flex-direction:column;text-align:left;padding:0;overflow:hidden}.context-preview strong{font-size:11px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}.context-preview small{display:none}#context-cards .source.selection{flex:1 0 100%}.source.selection .context-preview small{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;line-height:1.5;color:var(--muted);font-size:11px;margin-top:2px}.source.selection .icon-button{align-self:flex-start}
      textarea{display:block;width:100%;border:0;outline:none;background:none;color:var(--text);resize:none;min-height:48px;max-height:150px;height:48px;line-height:1.6;padding:7px 4px;font-size:var(--chat-font-size)}.compose:focus-within{border-color:color-mix(in srgb,var(--muted) 30%,transparent)}textarea:focus-visible{outline:none}textarea::placeholder{color:var(--muted)}.options{display:flex;align-items:center;gap:6px;min-height:32px;margin-top:8px}#model-trigger{display:flex;align-items:center;gap:5px;margin-left:auto;max-width:calc(100% - 112px);padding:5px 7px;border-radius:9px;color:var(--muted);font-size:11px;overflow:hidden}#model-label{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#model-trigger svg{width:12px;height:12px}#submit,#stop{border-radius:50%;width:30px;height:30px;flex:none}#submit{background:var(--text);color:var(--bg)}#stop{border:1px solid var(--line)}#submit svg,#stop svg{width:16px;height:16px}#status{font-size:11px;color:var(--muted);line-height:1.5;margin:7px 4px 0;overflow-wrap:anywhere}#status.error{color:#d76666}
      .floating{position:absolute;right:12px;left:12px;z-index:2;border:1px solid var(--line);border-radius:13px;background:var(--bg);box-shadow:0 8px 30px var(--shadow);padding:8px;font-size:12px;max-height:70%;overflow:auto}#menu{top:48px;left:auto;width:260px;max-width:calc(100% - 24px)}#menu button,.menu-action{display:flex;align-items:center;gap:9px;width:100%;padding:9px 10px;border-radius:8px;text-align:left;white-space:nowrap}#menu .icon-button{height:auto;color:var(--text);justify-content:flex-start}#menu small{display:block;color:var(--muted);font-size:10px;padding:7px 10px;border-top:1px solid var(--line);overflow-wrap:anywhere}#temporary.selected{background:var(--hover)}.appearance{display:flex;gap:4px;padding:5px}#menu .appearance button{justify-content:center;padding:6px;font-size:10px}.menu-title{font-size:11px;color:var(--muted);padding:5px 9px}.visual{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 10px;border-radius:8px;white-space:nowrap;cursor:pointer}.visual:hover{background:var(--hover)}input[type=checkbox]{width:14px;height:14px;flex:none;margin:0;accent-color:var(--accent)}.model-option{display:flex;flex-direction:column;gap:5px;padding:5px 8px 9px}.model-option span{color:var(--muted);font-size:11px}select{appearance:none;-webkit-appearance:none;cursor:pointer;width:100%;min-height:34px;padding:6px 25px 6px 10px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--text);line-height:1.4;background-image:linear-gradient(45deg,transparent 50%,var(--muted) 50%),linear-gradient(135deg,var(--muted) 50%,transparent 50%);background-position:calc(100% - 12px) 15px,calc(100% - 8px) 15px;background-size:4px 4px;background-repeat:no-repeat;font-size:12px}
      #tabs-menu{max-height:240px;padding:9px}#tabs-menu input{width:100%;border:1px solid var(--line);border-radius:8px;padding:8px;background:var(--surface);color:var(--text);margin-bottom:5px}.tab-row{display:flex;flex-direction:column;text-align:left;width:100%;padding:8px;border-radius:8px;overflow:hidden}.tab-row strong,.tab-row small{font-weight:500;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}.tab-row small{font-size:10px;color:var(--muted)}.latest{position:absolute;left:50%;transform:translateX(-50%);font-size:11px;background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:6px 12px;box-shadow:0 2px 10px var(--shadow);white-space:nowrap}#source-details{max-height:50%}#source-detail-body{white-space:pre-wrap;margin:0;font:12px/1.7 -apple-system,sans-serif;max-height:260px;overflow:auto}#history-panel{top:48px;display:flex;flex-direction:column;padding:12px;max-height:none}.history-heading{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;margin-bottom:10px}.history-heading span{flex:1}#history-search{width:100%;border:1px solid var(--line);border-radius:9px;background:var(--surface);color:var(--text);padding:8px 10px;font-size:12px}#history-list{margin-top:10px;overflow:auto;flex:1;color:var(--muted)}.history-row{display:flex;flex-direction:column;align-items:flex-start;gap:2px;width:100%;padding:10px;border-radius:9px;text-align:left;color:var(--text)}.history-row span{width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.history-row small{color:var(--muted);font-size:10px}.resize{position:absolute;left:0;top:18px;width:6px;height:calc(100% - 36px);cursor:ew-resize;z-index:3}.resize:hover{background:var(--line)}[hidden]{display:none!important}
      @container(max-width:340px){header{padding:8px 9px 5px}#messages{padding:10px 13px 6px}footer{padding:7px 9px 10px}.compose{padding:8px}.welcome h2{font-size:19px}.suggestions{gap:6px}.suggestions button{font-size:11px;padding:6px 9px}.message.user{margin-left:12px}#snapshot-note{display:none}.floating{left:9px;right:9px}#menu{max-width:calc(100% - 18px)}}
      #settings-panel{top:48px;bottom:12px!important;left:12px;right:12px;max-height:none;padding:12px;scrollbar-width:thin}.settings-section{border-top:1px solid var(--line);margin:10px 8px 4px;padding-top:12px;font-size:12px;font-weight:550}.settings-note,#runtime-info{display:block;color:var(--muted);font-size:11px;margin:7px 8px;overflow-wrap:anywhere}#settings-panel .model-option small{font-size:11px;color:var(--muted)}#dictation-shortcut{width:100%;background:var(--surface);border:1px solid var(--line);border-radius:8px;color:var(--text);padding:7px 8px;outline-offset:2px}#pin[aria-pressed=true]{color:var(--accent);background:var(--hover)}#dictate{width:28px;height:30px;flex:none}#dictate[aria-pressed=true]{color:var(--accent);background:var(--hover)}
      @media(prefers-reduced-motion:reduce){.thinking{animation:none}}
      </style><section class="panel"><div id="resize" class="resize" role="separator" aria-label="调整侧栏宽度" aria-orientation="vertical"></div><header><div class="heading-row"><button id="history" class="conversation-switch" aria-label="历史记录" title="历史记录"><span id="title">新对话</span>${icon('chevron')}</button>${action('new','新对话')}${action('pin','固定侧栏')}${action('more','更多选项')}${action('close','关闭侧边栏')}</div><div id="mode-note" hidden>临时聊天</div></header><div id="menu" class="floating" hidden><button id="desktop">${icon('desktop')}在 Codex 中继续</button><button id="temporary">${icon('shield')}开始临时聊天</button><button id="selection-add">${icon('page')}附上所选文字</button><button id="download">${icon('page')}导出 Markdown</button><button id="export">${icon('copy')}复制整段对话</button><button id="reconnect">${icon('refresh')}刷新模型与重新连接</button><button id="settings-open">${icon('settings')}设置</button></div><div id="settings-panel" class="floating" hidden><div class="history-heading"><span>设置</span>${action('settings-close','关闭设置','close')}</div><label class="model-option"><span>界面语言</span><select id="language" aria-label="界面语言"><option value="zh-CN">中文</option><option value="en">English</option></select></label><label class="model-option"><span>字号</span><select id="font-size" aria-label="字号"><option value="12">12 px</option><option value="14">14 px</option><option value="16">16 px</option><option value="18">18 px</option><option value="20">20 px</option></select><small>对话与输入文字</small></label><label class="model-option"><span>外观</span><select id="theme-select" aria-label="外观"><option value="system">跟随系统</option><option value="light">浅色</option><option value="dark">深色</option></select></label><div class="settings-section">听写</div><label class="model-option"><span>Codex Dictate</span><input id="dictation-shortcut" aria-label="Codex 听写快捷键" placeholder="Ctrl+Option+D" maxlength="64"></label><label class="model-option"><span>快捷键模式</span><select id="dictation-shortcut-mode" aria-label="听写快捷键模式"><option value="single">Single tap</option><option value="double">Double tap</option></select></label><small class="settings-note">与 Codex Settings → Voice 中的设置保持一致。</small><small id="runtime-info"></small></div><div id="history-panel" class="floating" hidden><div class="history-heading"><span>历史记录</span>${action('history-close','关闭历史记录','close')}</div><input id="history-search" type="search" aria-label="搜索历史记录" placeholder="搜索对话"><div id="history-list"></div></div><main id="messages" aria-live="polite"></main><button id="latest" class="latest" hidden aria-label="跳到最新回答">↓ 最新回答</button><div id="attach-menu" class="floating" hidden><div class="menu-title">网页上下文</div><label class="visual">附上当前网页<input id="attach" type="checkbox" checked aria-label="附上当前网页"></label><label class="visual">包含可见截图<input id="screenshot" type="checkbox" checked aria-label="截图"></label><button id="tabs-add" class="menu-action">${icon('plus')}添加其他标签页</button></div><div id="model-menu" class="floating" hidden><label class="model-option"><span>模型</span><select id="model" aria-label="模型"></select></label><label class="model-option"><span>Reasoning effort</span><select id="effort" aria-label="思考深度"></select></label></div><div id="tabs-menu" class="floating" hidden></div><div id="source-details" class="floating" hidden><div class="history-heading"><span id="source-detail-title"></span>${action('source-detail-close','关闭来源预览','close')}</div><pre id="source-detail-body"></pre></div><footer><div class="compose"><div id="source-card" class="source">${icon('page')}<div class="titles"><div id="page-title"></div><div id="page-url"></div><div id="extra-count"></div></div><span id="snapshot-note">含截图</span>${action('source-remove','取消附上当前网页','close')}</div><div id="context-cards"></div><textarea id="question" rows="1" maxlength="8000" aria-label="问题" placeholder="提问，或输入 @ 添加标签页"></textarea><div id="composer-options" class="options">${action('tabs','添加来源','plus')}<button id="model-trigger" aria-label="选择模型与推理程度"><span id="model-label">选择模型</span>${icon('chevron')}</button>${action('dictate','Dictate','mic')}<button id="stop" class="icon-button" aria-label="停止回答" title="停止回答" hidden>${icon('stop')}</button><button id="submit" class="icon-button" aria-label="发送" title="发送" disabled>${icon('send')}</button></div></div><div id="status" role="status">正在连接…</div></footer></section>`;
    el('resize').tabIndex=0;el('resize').setAttribute('aria-controls','messages');
    prepareLabels();displayKey='';document.documentElement.append(host);layout();lastView='';hydrated=false;catalog=[];session='';
    host.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'){for(const id of ['menu','tabs-menu','history-panel','attach-menu','model-menu','source-details','settings-panel'])el(id).hidden=true;el('question').focus();}});shadow.addEventListener('click',e=>{if(!e.target.closest('button,input,select,label,.floating'))for(const id of ['menu','tabs-menu','history-panel','attach-menu','model-menu','source-details','settings-panel'])el(id).hidden=true;});host.addEventListener('keypress',e=>e.stopPropagation());
    el('pin').addEventListener('click',async()=>{const next=!pinned;await preference({pinned:next});await refresh();});
    el('dictation-shortcut').addEventListener('change',()=>preference({dictation_shortcut:el('dictation-shortcut').value}));
    el('dictation-shortcut-mode').addEventListener('change',()=>preference({dictation_shortcut_mode:el('dictation-shortcut-mode').value}));
    el('dictate').addEventListener('click',startDictation);
    el('close').addEventListener('click',async()=>{await send({type:'sidebar_close'});close();});el('submit').addEventListener('click',ask);
    el('question').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();ask();}});el('question').addEventListener('input',e=>{if(e.inputType==='insertFromPaste')dictationReturned();composerInput();});el('question').addEventListener('paste',()=>{setTimeout(dictationReturned,0);});el('question').addEventListener('compositionstart',()=>composing=true);el('question').addEventListener('compositionend',()=>{composing=false;composerInput();});
    const attach=value=>{attachment=value;el('attach').checked=value;el('source-card').hidden=!value;el('screenshot').disabled=!value;positionOverlays();preference({attach_page:value});};
    el('attach').addEventListener('change',()=>attach(el('attach').checked));el('source-remove').addEventListener('click',()=>attach(false));el('screenshot').addEventListener('change',()=>{el('snapshot-note').hidden=!el('screenshot').checked;preference({include_image:el('screenshot').checked});});
    el('model').addEventListener('change',()=>{model=el('model').value;effort='';updateEffort();preference({model,effort});});el('effort').addEventListener('change',()=>{effort=el('effort').value;modelLabel();preference({model,effort});});
    el('tabs').addEventListener('click',()=>{toggleMenu('attach-menu');positionOverlays();});el('tabs-add').addEventListener('click',()=>{el('attach-menu').hidden=true;tabsMenu();});el('model-trigger').addEventListener('click',()=>{toggleMenu('model-menu');positionOverlays();});el('selection-add').addEventListener('click',()=>{el('menu').hidden=true;selectText();});el('source-detail-close').addEventListener('click',()=>el('source-details').hidden=true);el('latest').addEventListener('click',()=>{el('messages').scrollTop=el('messages').scrollHeight;el('latest').hidden=true;});el('messages').addEventListener('scroll',()=>el('latest').hidden=el('messages').scrollHeight-el('messages').scrollTop-el('messages').clientHeight<100);el('more').addEventListener('click',()=>toggleMenu('menu'));el('new').addEventListener('click',()=>newChat(false));el('temporary').addEventListener('click',()=>newChat(true));
    el('history').addEventListener('click',historyMenu);el('history-close').addEventListener('click',()=>el('history-panel').hidden=true);
    el('desktop').addEventListener('click',async()=>{const r=await send({type:'sidebar_open_desktop'});if(r?.ok===false)status(r.error,true);else status(t('已请求 Codex 打开这段对话。'));});
    el('download').addEventListener('click',()=>{const text='# '+(current.title||t('Safari 网页问答'))+'\n\n'+(current.history||[]).map(m=>'## '+(m.role==='user'?t('你'):'Codex')+'\n\n'+m.text+(m.sources?.length?'\n\n'+t('来源：')+'\n'+m.sources.map(s=>'- '+s.title+' — '+s.url).join('\n'):'')).join('\n\n');const url=URL.createObjectURL(new Blob([text],{type:'text/markdown;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='Safari-Codex-Chat.md';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);el('menu').hidden=true;});
    el('export').addEventListener('click',async()=>{try{const text=(current.history||[]).map(m=>(m.role==='user'?t('你'):'Codex')+'\n'+m.text+(m.sources?.length?'\n'+m.sources.map(s=>s.url).join('\n'):'')).join('\n\n');await navigator.clipboard.writeText(text);el('menu').hidden=true;status(t('已复制整段对话。'));}catch(_){status(t('请选择对话文字复制。'),true);}});
    el('settings-open').addEventListener('click',()=>{toggleMenu('settings-panel');positionOverlays();});
    el('settings-close').addEventListener('click',()=>{el('settings-panel').hidden=true;el('question').focus();});
    for(const [id,key] of [['language','language'],['font-size','font_size'],['theme-select','theme']])el(id).addEventListener('change',async()=>{const value=id==='font-size'?Number(el(id).value):el(id).value;await preference({[key]:value});await refresh();});
    el('stop').addEventListener('click',async()=>{await send({type:'sidebar_stop'});status(t('正在停止…'));});el('reconnect').addEventListener('click',async()=>{el('menu').hidden=true;const r=await send({type:'sidebar_reconnect'});if(r?.ok===false)status(r.error,true);else await refresh();});
    el('resize').addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();e.stopPropagation();width=e.key==='Home'?280:e.key==='End'?innerWidth*.65:width+(e.key==='ArrowLeft'?1:-1)*(e.shiftKey?50:10);layout();positionOverlays();preference({width});});
    el('resize').addEventListener('pointerdown',e=>{e.preventDefault();const grip=el('resize');grip.focus();grip.setPointerCapture(e.pointerId);const move=e=>{width=Math.max(280,innerWidth-e.clientX);layout();positionOverlays();};const end=()=>{grip.removeEventListener('pointermove',move);grip.removeEventListener('pointerup',end);preference({width});};grip.addEventListener('pointermove',move);grip.addEventListener('pointerup',end);});
    refresh();timer=setInterval(refresh,650);el('question').focus();
  }
  function dismissPopovers(){if(!host)return false;let active=false;for(const id of ['menu','tabs-menu','history-panel','attach-menu','model-menu','source-details','settings-panel']){if(!el(id).hidden)active=true;el(id).hidden=true;}return active;}
  const dismissEscape=e=>{if(e.key==='Escape'&&voice){if(voice.phase==='dispatch'||voice.phase==='finish')e.preventDefault();endDictation();return;}if(e.key==='Escape'&&dismissPopovers()){e.preventDefault();el('question')?.focus();}};
  const dismissOutside=e=>{if(host&&!e.composedPath().includes(host))dismissPopovers();};
  document.addEventListener('keydown',dismissEscape,true);document.addEventListener('pointerdown',dismissOutside,true);
  function rememberSelection(e){
    if(e.composedPath().includes(host)||(e.type!=='mouseup'&&document.activeElement===host))return;
    const ref=globalThis.__safariCodexReadSelection?.();cachedSelection=ref?.text?ref:null;
    clearTimeout(selectionTimer);const generation=++selectionGeneration;
    selectionTimer=setTimeout(async()=>{
      if(generation!==selectionGeneration)return;
      const fingerprint=ref?.text?ref.url+'\n'+ref.text:'';
      if(!fingerprint){lastSelectionSeen='';return;}
      if(fingerprint===lastSelectionSeen)return;
      lastSelectionSeen=fingerprint;
      if(!host||!hydrated||!session||voice)return;
      const activeSession=session;
      try{
        const r=await send({type:'sidebar_selection',selection:ref,session:activeSession,document_id:documentId});
        if(generation!==selectionGeneration||session!==activeSession||!host||r?.ok===false)return;
        contextId=r.context.id;attachSelection(r.context);
      }catch(_){}
    },100);
  }
  document.addEventListener('mouseup',rememberSelection);
  document.addEventListener('selectionchange',rememberSelection);
  document.addEventListener('keyup',rememberSelection);
  addEventListener('resize',()=>{if(host)layout();});
  const listener=(message,sender)=>{
    if(sender.id&&sender.id!==browser.runtime.id)return;
    if(message.type==='sidebar_open'){open();return Promise.resolve({ok:true});}
    if(message.type==='sidebar_visible')return Promise.resolve({opened:!!host});
    if(message.type==='sidebar_close_panel'){close();return Promise.resolve({ok:true});}
    if(message.type==='sidebar_hide_capture'){if(host)host.style.setProperty('visibility','hidden','important');return Promise.resolve({crop_width:host?innerWidth-width:innerWidth,viewport_width:innerWidth});}
    if(message.type==='sidebar_restore_capture'){if(host)host.style.removeProperty('visibility');return Promise.resolve({ok:true});}
  };
  browser.runtime.onMessage.addListener(listener);globalThis.__safariCodexSidebar={version,dispose:()=>{close();removeEventListener('pagehide',cancelOnLeave);document.removeEventListener('mouseup',rememberSelection);document.removeEventListener('selectionchange',rememberSelection);document.removeEventListener('keyup',rememberSelection);document.removeEventListener('keydown',dismissEscape,true);document.removeEventListener('pointerdown',dismissOutside,true);browser.runtime.onMessage.removeListener(listener);}};
  const cancelOnLeave=()=>{if(voice)send({type:'sidebar_dictation_cancel',id:voice.id}).catch(()=>{});};
  addEventListener('pagehide',cancelOnLeave);
  send({type:'sidebar_init',document_id:documentId}).then(r=>{if(r?.opened)open();}).catch(()=>{});
})();
