"""Explicit integration check on the two public Wikipedia test tabs only.
Requires the app running, and Bar_chart / Histogram tabs open and authorized.
Does not write tokens or unrelated browser metadata to its report.
"""
import base64,importlib.util,json,socket,subprocess,os
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
CONNECTION=Path(os.environ.get('SAFARI_CODEX_CONNECTION_FILE',Path.home()/'Documents/Safari-Codex-connection.json'))
spec=importlib.util.spec_from_file_location('bridge',ROOT/'codex-plugin/server/server.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
b=m.HTTPBridge(CONNECTION);s=m.Server(b);checks=[]
def call(name,args=None):
 x=s.rpc({'method':'tools/call','params':{'name':name,'arguments':args or {}}});assert not x.get('isError'),x
 return json.loads(x['content'][0]['text']),x['content']
x,_=call('safari_connection_status');assert x['connected'] and x['companion']['running'];checks.append('Live native Safari status and companion 0.1.2')
tabs,_=call('safari_list_tabs');public=[t for t in tabs['tabs'] if t['url'] in ['https://en.wikipedia.org/wiki/Bar_chart','https://en.wikipedia.org/wiki/Histogram']];assert len(public)==2;checks.append('Live tab IDs for both public pages')
x,_=call('safari_compare_tabs',{'tab_ids':[t['tab_id'] for t in public]});assert all(p.get('text') and 'error' not in p for p in x['pages']);checks.append('Read two actual Safari tabs with separate sources')
page,_=call('safari_read_page',{'max_chars':1000});assert page['url'] in [t['url'] for t in public];tail,_=call('safari_read_page',{'start':page['next_start'],'max_chars':30000});assert tail['source_hash']==page['source_hash'];assert page['end']==tail['start'];checks.append('Live long-article continuation and stable hash')
share,blocks=call('safari_get_shared_page');assert share['snapshot'] and share['url']=='https://en.wikipedia.org/wiki/Bar_chart' and blocks[1]['type']=='image';checks.append('Toolbar snapshot contains real image and explicit snapshot label')
# Check actual native HTTP boundary, keeping the pairing secret private.
settings=json.loads((CONNECTION).read_text());body=b'{"action":"host_status","args":{}}'
def post(token=None,host='127.0.0.1:53728',origin=None,path='/rpc'):
 headers=[f'POST {path} HTTP/1.1',f'Host: {host}',f'Content-Length: {len(body)}']
 if token is not None:headers.append('Authorization: Bearer '+token)
 if origin:headers.append('Origin: '+origin)
 with socket.create_connection(('127.0.0.1',53728),timeout=3) as sock:
  sock.sendall(('\r\n'.join(headers)+'\r\n\r\n').encode()+body);data=sock.recv(8192)
 return int(data.split(b' ')[1])
assert post(settings['token'])==200
assert post()==403 and post('0'*64)==403 and post(settings['token'],origin='https://example.com')==403 and post(settings['token'],host='example.com')==403
checks.append('Native endpoint rejects missing/wrong secret, browser Origin, and wrong Host')
messages=[{'jsonrpc':'2.0','id':1,'method':'initialize','params':{'protocolVersion':'2025-06-18'}},{'jsonrpc':'2.0','method':'notifications/initialized'},{'jsonrpc':'2.0','id':2,'method':'tools/list'},{'jsonrpc':'2.0','id':3,'method':'tools/call','params':{'name':'safari_capture_visible_page','arguments':{}}}]
x=subprocess.run(['/usr/bin/python3',str(ROOT/'codex-plugin/server/server.py'),'--connection-file',str(CONNECTION)],input='\n'.join(map(json.dumps,messages))+'\n',capture_output=True,text=True,timeout=40);assert x.returncode==0
replies={a['id']:a['result'] for a in map(json.loads,x.stdout.splitlines())};assert len(replies[2]['tools'])==7;assert not replies[3]['isError'] and replies[3]['content'][1]['type']=='image';checks.append('Actual STDIO MCP process returns 7 tools and Safari screenshot IMAGE')
report={'version':'0.1.2','scope':'real installed Safari extension, native companion, authenticated loopback and STDIO MCP; public test pages only','passed':len(checks),'checks':checks,'pages':[t['url'] for t in public]}
(ROOT/'tests/live-results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False,indent=2))
