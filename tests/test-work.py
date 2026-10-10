"""Work protocol regressions without processes, credentials or network."""
import importlib.util, threading, unittest
from pathlib import Path
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('worker_work',ROOT/'chat-runtime/worker.py');w=importlib.util.module_from_spec(spec);spec.loader.exec_module(w)
def engine(work=True):
 e=w.Engine.__new__(w.Engine);e.work_mode=work;e.lock=threading.RLock();e.sessions={'s':'thr_fixture'};e.active={'thr_fixture':{'job':'job','turn':'turn','items':{},'text':{},'done':threading.Event()}};e.approvals={};e.search_modes={};e.workspaces={};e.work=type('Work',(),{'name':'/tmp'})();e.writes=[];e.write=e.writes.append;return e
def request(method='item/commandExecution/requestApproval',**extra):
 return {'id':7,'method':method,'params':{'threadId':'thr_fixture','turnId':'turn','itemId':'item','command':'python3 fixture.py','cwd':'/tmp',**extra}}
class Tests(unittest.TestCase):
 def test_reader_refuses_approvals(self):
  e=engine(False);e.server_request(request());self.assertIn('error',e.writes[0]);self.assertFalse(e.approvals)
 def test_unknown_or_inactive_callback_refused(self):
  for msg in [request('unknown/tool'),request(turnId='old'),request(threadId='other')]:
   e=engine();e.server_request(msg);self.assertIn('error',e.writes[0]);self.assertFalse(e.approvals)
 def test_command_waits_until_explicit_accept(self):
  e=engine()
  with patch.object(w,'emit') as emit:
   e.server_request(request());token=emit.call_args.kwargs['approval']['id'];self.assertFalse(e.writes)
   e.approve({'session':'s','approval_id':token,'decision':'accept'})
  self.assertEqual(e.writes,[{'id':7,'result':{'decision':'accept'}}]);self.assertFalse(e.approvals)
 def test_decline_does_not_expand_permissions(self):
  e=engine()
  with patch.object(w,'emit'):
   e.server_request(request('item/permissions/requestApproval',permissions={'network':{'enabled':True}}));token=next(iter(e.approvals))
   e.approve({'session':'s','approval_id':token,'decision':'decline'})
  self.assertEqual(e.writes[-1]['result'],{'permissions':{},'scope':'turn'})
 def test_permission_accept_only_uses_requested_grants(self):
  e=engine();grants={'fileSystem':{'write':['/tmp/report']}}
  with patch.object(w,'emit'):
   e.server_request(request('item/permissions/requestApproval',permissions=grants));token=next(iter(e.approvals))
   e.approve({'session':'s','approval_id':token,'decision':'accept','permissions':{'network':{'enabled':True}}})
  self.assertEqual(e.writes[-1]['result'],{'permissions':grants,'scope':'turn'})
 def test_expired_wrong_session_or_duplicate_reply_rejected(self):
  e=engine()
  with patch.object(w,'emit'):
   e.server_request(request());token=next(iter(e.approvals))
   with self.assertRaises(ValueError):e.approve({'session':'other','approval_id':token,'decision':'accept'})
   with self.assertRaises(ValueError):e.approve({'session':'s','approval_id':token,'decision':'acceptForSession'})
   e.approve({'session':'s','approval_id':token,'decision':'decline'})
   with self.assertRaises(ValueError):e.approve({'session':'s','approval_id':token,'decision':'accept'})
 def test_parallel_approvals_queue(self):
  e=engine()
  with patch.object(w,'emit') as emit:
   e.server_request(request());first=next(iter(e.approvals));msg=request();msg['id']=8;e.server_request(msg)
   self.assertEqual(emit.call_count,1)
   e.approve({'session':'s','approval_id':first,'decision':'accept'})
   second=emit.call_args.kwargs['approval']['id'];self.assertNotEqual(first,second)
   e.approve({'session':'s','approval_id':second,'decision':'decline'})
  self.assertEqual([x['id'] for x in e.writes],[7,8]);self.assertFalse(e.approvals)
 def test_stop_cancels_pending_approval(self):
  e=engine();e.rpc=lambda *args,**kwargs:{}
  with patch.object(w,'emit'):e.server_request(request());e.stop('s')
  self.assertEqual(e.writes[-1]['result']['decision'],'cancel');self.assertFalse(e.approvals)
 def test_question_response_validates_ids(self):
  e=engine()
  with patch.object(w,'emit'):
   e.server_request(request('item/tool/requestUserInput',questions=[{'id':'q','question':'Format?'}]));token=next(iter(e.approvals))
   with self.assertRaises(ValueError):e.approve({'session':'s','approval_id':token,'decision':'accept','answers':{'unknown':'CSV'}})
   e.approve({'session':'s','approval_id':token,'decision':'accept','answers':{'q':'CSV'}})
  self.assertEqual(e.writes[-1]['result'],{'answers':{'q':{'answers':['CSV']}}})
 def test_secret_question_not_collected(self):
  e=engine();e.server_request(request('item/tool/requestUserInput',questions=[{'id':'q','isSecret':True}]))
  self.assertEqual(e.writes[-1]['result'],{'answers':{}});self.assertFalse(e.approvals)
 def test_search_toggle_reconfigures_same_saved_thread(self):
  e=engine(False);e.active={};e.session_busy=set();calls=[]
  def rpc(method,params,**kw):
   calls.append((method,params))
   if method=='turn/start':e.active['thr_fixture']['done'].set();return{'turn':{'id':'new'}}
   return{}
  e.rpc=rpc
  with patch.object(w,'emit'):e.chat({'session':'s','id':'job','question':'Explain','web_search':False})
  self.assertEqual(calls[0][0],'thread/resume');self.assertEqual(calls[0][1]['config']['web_search'],'disabled')
  self.assertIs(calls[0][1]['config']['features.shell_tool'],False)
 def test_temporary_search_change_requires_new_chat(self):
  e=engine(False);e.active={};e.session_busy=set()
  with self.assertRaisesRegex(ValueError,'临时聊天'):e.chat({'session':'s','id':'job','question':'Explain','web_search':False,'temporary':True})
 def test_work_turn_overrides_inherited_writable_roots(self):
  e=engine();e.active={};e.session_busy=set();e.workspaces={'s':'/tmp'};calls=[]
  def rpc(method,params,**kw):
   calls.append((method,params))
   if method=='turn/start':e.active['thr_fixture']['done'].set();return{'turn':{'id':'new'}}
   return{}
  e.rpc=rpc
  with patch.object(w,'emit'):e.chat({'session':'s','id':'job','question':'Generate','workspace':'/tmp','temporary':True})
  start=next(p for m,p in calls if m=='turn/start')
  self.assertEqual(start['sandboxPolicy'],{'type':'workspaceWrite','writableRoots':['/tmp'],'networkAccess':False})
 def test_activity_history_is_bounded_and_restores(self):
  item={'type':'commandExecution','id':'c','command':'python3 fixture.py','aggregatedOutput':'x'*5000,'exitCode':0}
  value=w.visible_history({'turns':[{'items':[item,{'type':'agentMessage','text':'Done'}]}]})
  self.assertEqual(len(value[0]['activities'][0]['output']),4000);self.assertEqual(value[0]['activities'][0]['exit_code'],0)
if __name__=='__main__':unittest.main(verbosity=2)
