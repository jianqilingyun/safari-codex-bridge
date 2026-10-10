import base64
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import time
import unittest

SOURCE=Path(__file__).resolve().parents[1]/'codex-plugin/server/server.py'
spec=importlib.util.spec_from_file_location('bridge_server',SOURCE);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
PNG='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aPyoAAAAASUVORK5CYII='
class MCPTest(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name)
  for n in ['commands','responses']: (self.root/n).mkdir()
  module.atomic_json(self.root/'host.json',{'updated_at':time.time()})
  self.bridge=module.Bridge(self.root,timeout=.25);self.server=module.Server(self.bridge)
 def tearDown(self): self.temp.cleanup()
 def test_initialize_and_seven_tools(self):
  result=self.server.rpc({'method':'initialize','params':{'protocolVersion':'2025-06-18'}})
  self.assertEqual(result['protocolVersion'],'2025-06-18');self.assertEqual(len(module.TOOLS),7)
 def test_mailbox_request_response_and_cleanup(self):
  def reply():
   while not list((self.root/'commands').glob('*.json')):time.sleep(.005)
   f=next((self.root/'commands').glob('*.json'));req=json.loads(f.read_text())
   module.atomic_json(self.root/'responses'/f.name,{'id':req['id'],'result':{'url':'https://example.com','text':'测试正文'}})
  thread=threading.Thread(target=reply);thread.start()
  result=self.bridge.request('read_page',{});thread.join()
  self.assertEqual(result['text'],'测试正文');self.assertFalse(list((self.root/'commands').iterdir()));self.assertFalse(list((self.root/'responses').iterdir()))
 def test_timeout_is_explicit_and_cleans_data(self):
  with self.assertRaisesRegex(module.BridgeError,'超时'):self.bridge.request('read_page',{})
  self.assertFalse(list((self.root/'commands').iterdir()))
 def test_stopped_host(self):
  module.atomic_json(self.root/'host.json',{'updated_at':time.time()-20})
  with self.assertRaisesRegex(module.BridgeError,'停止'):self.bridge.request('read_page',{})
 def test_shared_snapshot_label_and_expiration(self):
  p=self.root/'shared-page.json';module.atomic_json(p,{'text':'shared'})
  self.assertTrue(self.bridge.shared()['snapshot']);os.utime(p,(time.time()-1900,)*2)
  with self.assertRaisesRegex(module.BridgeError,'30'):self.bridge.shared()
  self.assertFalse(p.exists())
 def test_images_are_mcp_image_blocks(self):
  result=module.mcp_result({'url':'https://example.com','image':{'data':PNG,'mimeType':'image/png'}})
  self.assertEqual(result['content'][1]['type'],'image');self.assertNotIn(PNG,result['content'][0]['text'])
 def test_invalid_image_and_symlink(self):
  with self.assertRaises(module.BridgeError):module.mcp_result({'image':{'data':base64.b64encode(b'not-pixels').decode(),'mimeType':'image/png'}})
  dest=self.root/'linked.json';dest.symlink_to(self.root/'host.json')
  with self.assertRaises(module.BridgeError):self.bridge.read(dest)
 def test_arguments_reject_unsafe_or_invalid_values(self):
  for name,args in [('safari_read_page',{'javascript':'document.cookie'}),('safari_read_page',{'max_chars':999999}),('safari_read_page',{'tab_id':True}),('safari_compare_tabs',{'tab_ids':[1,1]}),('safari_read_image',{'image_id':-1})]:
   with self.assertRaises(module.BridgeError):module.validate(name,args)
 def test_stdio_protocol_actual_process(self):
  messages=[{'jsonrpc':'2.0','id':1,'method':'initialize','params':{'protocolVersion':'2025-06-18'}},{'jsonrpc':'2.0','method':'notifications/initialized'},{'jsonrpc':'2.0','id':2,'method':'tools/list'},{'jsonrpc':'2.0','id':3,'method':'tools/call','params':{'name':'safari_read_page','arguments':{'mode':'wrong'}}}]
  r=subprocess.run([sys.executable,str(SOURCE),'--bridge-dir',str(self.root)],input='\n'.join(map(json.dumps,messages))+'\n',capture_output=True,text=True,timeout=5)
  replies=[json.loads(s) for s in r.stdout.splitlines()];self.assertEqual(r.returncode,0)
  self.assertEqual(replies[0]['result']['protocolVersion'],'2025-06-18');self.assertEqual(len(replies[1]['result']['tools']),7);self.assertTrue(replies[2]['result']['isError']);self.assertEqual(r.stderr,'')
if __name__=='__main__':unittest.main(verbosity=2)
