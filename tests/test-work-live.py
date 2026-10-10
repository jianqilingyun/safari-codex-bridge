"""Opt-in real Codex Work task, restricted to a prewritten synthetic fixture."""
from pathlib import Path
import importlib.util,json,shlex,uuid
ROOT=Path(__file__).resolve().parents[1]
folder=ROOT/'tests/live/work-fixture';folder.mkdir(parents=True,exist_ok=True)
script=folder/'make_report.py'
script.write_text("from pathlib import Path\nimport csv,json\nr=Path(__file__).resolve().parent\nrows=[('A',10),('B',20),('C',40)]\nwith (r/'report.csv').open('w') as f:\n w=csv.writer(f);w.writerow(['category','value']);w.writerows(rows)\n(r/'report.html').write_text('<h1>Fixture Report</h1><p>Total: 70</p>')\nprint('Generated report.csv and report.html; total=70')\n")
for name in ['report.csv','report.html']:(folder/name).unlink(missing_ok=True)
spec=importlib.util.spec_from_file_location('worker_work_live',ROOT/'chat-runtime/worker.py');w=importlib.util.module_from_spec(spec);spec.loader.exec_module(w)
events=[];e=None
approved=[]
def emit(job,event,**v):
 events.append(dict(event=event,**v))
 if event=='approval' and v.get('approval'):
  a=v['approval'];tokens=shlex.split(a.get('command') or '')
  # The runtime presents an argv-safe shell wrapper, not a bare command.
  if len(tokens)==3 and tokens[0] in ['/bin/zsh','/bin/bash','/bin/sh'] and tokens[1]=='-lc':
   tokens=shlex.split(tokens[2])
  safe=(a['kind']=='command' and Path(a.get('cwd') or '').resolve()==folder.resolve() and len(tokens)==2 and tokens[0] in ['python3','/usr/bin/python3'] and tokens[1]=='make_report.py')
  e.approve({'session':session,'approval_id':a['id'],'decision':'accept' if safe else 'decline'})
  if safe:approved.append(a['kind'])
w.emit=emit
session=str(uuid.uuid4());e=w.Engine(work=True)
try:
 e.chat({'id':str(uuid.uuid4()),'session':session,'temporary':True,'workspace':str(folder),'model':'gpt-6-luna','effort':'medium','web_search':False,'question':'在当前选定文件夹，只运行这一条命令：/usr/bin/python3 make_report.py。脚本已写好，会生成合成数据的 report.csv 和 report.html，不需改代码。执行完成后告知总数并列出生成的文件。为核验审批流程，请以 require_escalated 请求执行这条命令并等待用户审批。不执行其他命令，不读取其他文件夹。'})
 answer=next((x['text'] for x in reversed(events) if x['event']=='done'),'')
 assert (folder/'report.csv').exists() and (folder/'report.html').exists(),events[-10:]
 assert '70' in answer,answer
 assert approved,'expected a real command approval'
 report={'passed':True,'model':'gpt-6-luna','actual_command_approvals':len(approved),'actual_activities':sum(x['event']=='activity' for x in events),'csv':(folder/'report.csv').read_text(),'answer':answer}
 (ROOT/'tests/work-live-results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False,indent=2))
finally:e.close()
