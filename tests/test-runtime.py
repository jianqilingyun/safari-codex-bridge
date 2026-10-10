"""No network fixture: startup fallback and lost completion recovery."""
from pathlib import Path
import importlib.util,threading,io,json,unittest,types
root=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('worker',root/'chat-runtime/worker.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class Tests(unittest.TestCase):
 def test_same_turn_recovery_when_stream_completion_missing(self):
  events=[];oldemit=m.emit;m.emit=lambda job,event,**v:events.append(dict(event=event,**v))
  e=m.Engine.__new__(m.Engine);e.sessions={'s':'thr_test'};e.active={};e.lock=threading.RLock();e.search_modes={};e.work_mode=False;e.approvals={};e.work=types.SimpleNamespace(name="/tmp/fixture");e.session_busy=set()
  def rpc(method,params,**kw):
   if method=='turn/start':return {'turn':{'id':'turn_test'}}
   if method=='thread/read':return {'thread':{'turns':[{'id':'turn_test','status':'completed','items':[{'type':'agentMessage','text':'恢复的完成回答'}]}]}}
   return {}
  e.rpc=rpc
  try:
   e.chat({'id':'test','session':'s','question':'公开测试','model':'gpt-6-luna','pages':[]})
   self.assertEqual(events[-1],{'event':'done','text':'恢复的完成回答'});self.assertEqual(e.active,{})
  finally:m.emit=oldemit
 def test_protocol_failure_selects_next_runtime(self):
  done=threading.Event();events=[];started=[]
  class Fake:
   def __init__(self,binary):
    started.append(binary)
    if binary=='unsupported':raise RuntimeError('unsupported protocol')
    self.active={};self.proc=types.SimpleNamespace(poll=lambda:None)
   def rpc(self,*args):return {'data':[]}
   def close(self):pass
   def catalog(self,job):m.emit(job,'catalog',runtime='fallback')
  def stdin():
   yield json.dumps({'id':'test','action':'catalog'})+'\n'
   self.assertTrue(done.wait(5))
  originals=(m.Engine,m.runtime_candidates,m.candidates_fingerprint,m.emit,m.sys.stdin)
  m.Engine=Fake;m.runtime_candidates=lambda:['unsupported','compatible'];m.candidates_fingerprint=lambda:('fixture',)
  def emit(job,event,**v):events.append(v);done.set()
  m.emit=emit;m.sys.stdin=stdin()
  try:m.main();self.assertEqual(started,['unsupported','compatible']);self.assertEqual(events,[{'runtime':'fallback'}])
  finally:m.Engine,m.runtime_candidates,m.candidates_fingerprint,m.emit,m.sys.stdin=originals
if __name__=='__main__':unittest.main()
