"""Opt-in official search and same-thread search-disable verification."""
from pathlib import Path
import importlib.util,json,uuid
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('worker',ROOT/'chat-runtime/worker.py');worker=importlib.util.module_from_spec(spec);spec.loader.exec_module(worker)
events=[];worker.emit=lambda job,event,**v:events.append(dict(id=job,event=event,**v))
e=worker.Engine()
try:
 session=str(uuid.uuid4())
 e.chat({'id':str(uuid.uuid4()),'session':session,'temporary':True,'model':'gpt-6-luna','effort':'medium','web_search':True,'question':'请实际联网搜索并阅读 OpenAI 官方 Codex web search 文档，说明 live 和 cached 的区别。回答中文，附上支持结论的 Markdown 来源链接，不要仅凭记忆回答。'})
 result=next((x['text'] for x in reversed(events) if x['event']=='done'),'')
 assert any(x['event']=='search' for x in events),json.dumps(events,ensure_ascii=False)[-3000:]
 assert 'https://' in result and 'cached' in result and 'live' in result,result
 before=len(events)
 e.chat({'id':str(uuid.uuid4()),'session':str(uuid.uuid4()),'temporary':True,'model':'gpt-6-luna','web_search':False,'question':'不联网，仅解释术语 live 和 cached；回答一句话。'})
 assert any(x['event']=='done' for x in events[before:]),events[before:]
 assert not any(x['event']=='search' for x in events[before:]),events[before:]
 report={'passed':True,'actual_search_events':sum(x['event']=='search' for x in events),'new_ephemeral_search_off':True,'answer':result}
 (ROOT/'tests/search-live-results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
 print(json.dumps(report,ensure_ascii=False,indent=2))
finally:e.close()
