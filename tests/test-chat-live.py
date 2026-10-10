"""Actual subscription-model inference with a public synthetic chart, not a UI mock."""
from pathlib import Path
import base64
import importlib.util
import json
import time
import uuid

root = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('chat_worker', root/'chat-runtime/worker.py')
module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
events = []
def capture(job,event,**v):
    events.append(dict(id=job,event=event,**v))
module.emit=capture
engine=module.Engine()
try:
    account=engine.rpc('account/read',{'refreshToken':False}).get('account')
    assert account and account.get('type')=='chatgpt', 'requires logged-in subscription account'
    servers=engine.rpc('mcpServerStatus/list',{'limit':100}).get('data',[])
    assert not any(s.get('tools') for s in servers), 'sidebar backend must not inherit active MCP tools'
    configured=engine.rpc('config/read',{'includeLayers':False})['config'].get('mcp_servers',{})
    assert all(not v.get('enabled',True) for v in configured.values()), 'all inherited servers must be disabled'
    models=engine.rpc('model/list',{'limit':100})['data']
    selected=next(m for m in models if m.get('model')=='gpt-6-luna')
    session=str(uuid.uuid4())
    page={'url':'https://bridge-fixture.example/article','title':'季度增长测试图','text':'季度数据：10、20、40。',
          'pixels':[{'mimeType':'image/png','data':base64.b64encode((root/'tests/fixture-viewport.png').read_bytes()).decode()}]}
    engine.chat({'id':str(uuid.uuid4()),'session':session,'temporary':True,'question':'请看图表，说出最后一根柱子的数值，以及它是第一根的几倍。仅回答一句话。','model':selected['model'],'pages':[page]})
    first=[e for e in events if e['event']=='done'][-1]['text'] if any(e['event']=='done' for e in events) else ''
    assert '40' in first and ('4' in first or '四' in first), json.dumps(events,ensure_ascii=False)[-2000:]
    before=len(events)
    engine.chat({'id':str(uuid.uuid4()),'session':session,'temporary':True,'question':'沿用刚才的数据，第一根和最后一根合计是多少？只回答数字。','model':selected['model'],'pages':[]})
    second=[e for e in events[before:] if e['event']=='done'][-1]['text'] if any(e['event']=='done' for e in events[before:]) else ''
    assert '50' in second, json.dumps(events[before:],ensure_ascii=False)[-2000:]
    report={'scope':'real official app-server inference using existing ChatGPT-managed auth and a synthetic public-page image',
            'model':selected['model'],'auth_type':account['type'],'image_answer':first,'followup_answer':second,
            'deltas':sum(e['event']=='delta' for e in events),'ephemeral_threads':len(engine.sessions),
            'inherited_mcp_servers_disabled':True,'active_mcp_tools':0,'passed':True}
    (root/'tests/chat-live-results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print(json.dumps(report,ensure_ascii=False,indent=2))
finally:engine.close()
