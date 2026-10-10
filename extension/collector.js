/* DOM data stays in Safari until the extension asks for it. */
(() => {
  const collectorVersion='0.4.8';
  if (globalThis.__safariCodexCollector === collectorVersion) return;
  if (globalThis.__safariCodexListener) browser.runtime.onMessage.removeListener(globalThis.__safariCodexListener);
  globalThis.__safariCodexCollector = collectorVersion;
  const reject = '[data-safari-codex-sidebar],#safari-codex-layout,script,style,noscript,template,input,textarea,select,[contenteditable], [aria-hidden="true"], [hidden]';
  const compact = s => String(s || '').replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  function visible(el) {
    if (el.closest(reject) || !el.getClientRects().length) return false;
    const c = getComputedStyle(el);
    if (c.display === 'none' || c.visibility === 'hidden' || c.opacity === '0') return false;
    for(let parent=el.parentElement;parent;parent=parent.parentElement) {
      if(getComputedStyle(parent).opacity==='0')return false;
    }
    return true;
  }
  function cleanClone(root) {
    const clone = root.cloneNode(true);
    clone.querySelectorAll(reject).forEach(el => el.remove());
    return clone;
  }
  function cloneDocument() {
    const doc = document.cloneNode(true);
    const a = [...document.querySelectorAll('*')], b = [...doc.querySelectorAll('*')];
    for (let i = 0; i < a.length; i++) {
      if (a[i].matches(reject) || !visible(a[i])) b[i]?.remove();
    }
    return doc;
  }
  function textFrom(root) {
    const clone = cleanClone(root);
    clone.querySelectorAll('p,div,section,article,li,tr,h1,h2,h3,h4,blockquote,pre,br').forEach(el => {
      el.prepend(document.createTextNode('\n')); el.append(document.createTextNode('\n'));
    });
    return compact(clone.textContent);
  }
  function pageText() {
    const doc = cloneDocument();
    return textFrom(doc.body || doc.documentElement);
  }
  function imageNodes() {
    return [...document.images].filter(el => visible(el) && el.getClientRects().length > 0 && (el.naturalWidth > 32 || el.width > 32));
  }
  function images() {
    return imageNodes().slice(0, 200).map((el, i) => {
      const r = el.getBoundingClientRect();
      return {image_id: i, src: el.currentSrc || el.src, alt: el.alt || '',
        caption: compact(el.closest('figure')?.querySelector('figcaption')?.textContent || ''),
        width: el.naturalWidth || el.width, height: el.naturalHeight || el.height,
        loaded: el.complete && el.naturalWidth > 0,
        in_viewport: r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth};
    });
  }
  // Lightweight local selection read; does not collect the page or send data.
  function readSelection() {
    const selectedRange=getSelection();
    const selection = compact(selectedRange?.toString());
    const active = document.activeElement;
    const privateSelection = !!(active?.closest('input,textarea,[contenteditable]')||[...Array(selectedRange?.rangeCount||0)].some((_,i)=>{
      const range=selectedRange.getRangeAt(i),node=range.commonAncestorContainer;
      const element=node.nodeType===1?node:node.parentElement;
      return element?.closest(reject)||element?.getRootNode()?.host?.matches('[data-safari-codex-sidebar]')||[...document.querySelectorAll('input,textarea,[contenteditable],[data-safari-codex-sidebar]')].some(el=>range.intersectsNode(el));
    }));
    return {text:privateSelection?'':selection.slice(0,8000),total_chars:privateSelection?0:selection.length,truncated:!privateSelection&&selection.length>8000,url:location.href,title:document.title};
  }
  globalThis.__safariCodexReadSelection=readSelection;
  async function collect(args = {}) {
    const mode = args.mode || 'article';
    if (!['article','page','selection'].includes(mode)) throw new Error('Unknown reading mode');
    const selected = readSelection(), selection = selected.text;
    const privateSelection = !selection;
    let text, method;
    if (mode === 'selection') { text = privateSelection ? '' : selection; method = 'selection'; }
    else if (mode === 'article' && typeof Readability === 'function') {
      const article = new Readability(cloneDocument(), {charThreshold: 100}).parse();
      if (article && article.textContent.trim().length > 100) {
        const content = document.createElement('div'); content.innerHTML = article.content;
        text = textFrom(content); method = 'readability';
      }
    }
    if (text === undefined) {text = pageText(); method = 'visible-dom';}
    const start = Math.max(0, Number.isInteger(args.start) ? args.start : 0);
    const max = Math.max(100, Math.min(30000, Number.isInteger(args.max_chars) ? args.max_chars : 16000));
    const sourceHash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map(b=>b.toString(16).padStart(2,'0')).join('');
    const warnings = ['只包含当前已加载的网页内容；付费墙后未加载的正文不在其中。'];
    if (document.querySelector('iframe')) warnings.push('iframe 正文未并入；可见 iframe 可通过截图查看。');
    if (document.querySelector('canvas,svg')) warnings.push('页面含 canvas 或 SVG，图形需通过截图查看。');
    if ([...document.querySelectorAll('*')].some(el => el.shadowRoot)) warnings.push('Shadow DOM 未并入正文，必要时使用截图。');
    if (!text) warnings.push(mode === 'selection' ? '未选择可读文本。' : '未获取到正文，可能需要网页权限或页面尚未加载。');
    return {url: location.href, title: document.title, language: document.documentElement.lang,
      captured_at: new Date().toISOString(), mode, extraction_method: method, source_hash: sourceHash,
      selection: privateSelection ? '' : selection.slice(0, 8000), text: text.slice(start, start + max),
      total_chars: mode === 'selection' ? selected.total_chars : text.length, start, end: Math.min(text.length, start + max),
      truncated: selected.truncated && mode === 'selection' || text.length > start + max, next_start: text.length > start + max ? start + max : null,
      images: images(), images_truncated: imageNodes().length > 200,
      headings: [...document.querySelectorAll('h1,h2,h3')].filter(visible).slice(0,80).map(el=>({level:el.tagName,text:compact(el.textContent)})),
      links: [...document.querySelectorAll('a[href]')].filter(visible).slice(0,100).map(el=>({text:compact(el.textContent).slice(0,150),url:el.href})),
      viewport: {width:innerWidth,height:innerHeight,scroll_x:scrollX,scroll_y:scrollY,page_height:document.documentElement.scrollHeight}, warnings};
  }
  globalThis.__safariCodexCollect = collect;
  const listener = (message, sender) => {
    if (sender.id && sender.id !== browser.runtime.id) return;
    if (message?.type === 'collect') return collect(message.args);
    if (message?.type === 'image') {
      const el = imageNodes()[message.image_id];
      if (!el) throw new Error('Image no longer exists; read the page again');
      return Promise.resolve(images()[message.image_id]);
    }
  };
  globalThis.__safariCodexListener=listener;
  browser.runtime.onMessage.addListener(listener);
})();
