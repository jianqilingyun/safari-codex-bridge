"""Official persisted thread, real exact-model turn, restart and resume."""
from pathlib import Path
import importlib.util,json,uuid,os
root=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('worker',root/'chat-runtime/worker.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
events=[];m.emit=lambda job,event,**v:events.append(dict(id=job,event=event,**v))
workspace=root.parent.parent/'work/safari-context-build/history-live';workspace.mkdir(exist_ok=True)
os.environ['SAFARI_CODEX_WORKSPACE']=str(workspace)
runtime='/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex'
e=m.Engine(runtime)
try:
 e.catalog('catalog');catalog=events[-1];assert any(x['model']=='gpt-6-luna' for x in catalog['models'])
 assert not any(s.get('tools') for s in e.rpc('mcpServerStatus/list',{'limit':100}).get('data',[]))
 sid=str(uuid.uuid4());e.chat({'id':'first','session':sid,'model':'gpt-6-luna','effort':'low','title':'Safari 网页问答 · 持久化重启验收','question':'请记住本次测试标记青杉48，仅回复已记住。','pages':[]})
 thread=next(x['thread_id'] for x in events if x['id']=='first' and x['event']=='started');assert any(x['id']=='first' and x['event']=='done' for x in events)
 e.close();e=m.Engine(runtime)
 e.chat({'id':'resume','session':str(uuid.uuid4()),'thread_id':thread,'model':'gpt-6-luna','effort':'low','question':'刚才的测试标记是什么？仅回复标记。','pages':[]})
 answer=next(x['text'] for x in events if x['id']=='resume' and x['event']=='done');assert '青杉48' in answer,answer
 e.history({'id':'history','thread_id':thread});assert len(events[-1]['history'])==4
 temporary=e.rpc('thread/start',{'ephemeral':True,'cwd':str(workspace),'model':'gpt-6-luna','sandbox':'read-only','approvalPolicy':'never'})['thread'];assert temporary['path'] is None
 report={'scope':'real official Codex app-server subscription runtime; new persistent test only','model':'gpt-6-luna','runtime':catalog['runtime'],'thread_id':thread,'restart_resume_answer':answer,'official_history_messages':len(events[-1]['history']),'ephemeral_has_no_rollout':True,'active_mcp_tools':0,'passed':True}
 (root/'tests/persistence-live-results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False,indent=2))
finally:e.close()
