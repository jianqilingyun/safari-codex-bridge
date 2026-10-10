const status=document.getElementById('status'),button=document.getElementById('share');
let english=false;
const text=(zh,en)=>english?en:zh;
const configured=browser.storage.local.get('safari_codex_preferences').then(data=>{
  english=data.safari_codex_preferences?.language==='en';if(!english)return;
  document.documentElement.lang='en';document.querySelector('h1').textContent='Codex';
  document.getElementById('open').textContent='Open sidebar';document.querySelector('summary').textContent='Share with Codex desktop';
  document.getElementById('include-image').parentNode.lastChild.textContent=' Include visible screenshot';button.textContent='Share current page';status.textContent='Checking connection…';
});
configured.then(()=>browser.runtime.sendMessage({type:'toolbar_status'})).then(r=>{status.textContent=r?.ready?text('本地连接可用','Local connection ready'):text('请先打开 Safari Codex Bridge 应用。','Open Safari Codex Bridge first.');}).catch(()=>{status.textContent=text('本地连接尚未就绪。','Local connection is not ready.');});
button.addEventListener('click',async()=>{button.disabled=true;try{await configured;const r=await browser.runtime.sendMessage({type:'share_page',include_image:document.getElementById('include-image').checked});status.textContent=r?.ok?text('已保存当前网页，回到 Codex 即可读取。','Page saved. Continue in Codex to read it.'):r?.error || text('分享未完成。','Sharing did not complete.');}catch(e){status.textContent=e.message;}finally{button.disabled=false;}});

document.getElementById('open').addEventListener('click',async()=>{try{await configured;const r=await browser.runtime.sendMessage({type:'sidebar_open_toolbar'});if(!r?.ok)throw new Error(r?.error||text('打开失败','Could not open sidebar'));window.close();}catch(e){status.textContent=e.message;}});
