// Pixel-level regression: live sidebar stays visible and chat pixels are cropped.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const code=fs.readFileSync(new URL('../extension/background.js',import.meta.url),'utf8');
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage();
 await page.evaluate(()=>{
  globalThis.messages=[];globalThis.geometry={crop_width:90,viewport_width:1000};globalThis.changeGeometry=false;globalThis.activeID=1;globalThis.changeURL=false;
  const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=500;const x=canvas.getContext('2d');x.fillStyle='#1455aa';x.fillRect(0,0,90,500);x.fillStyle='#e92cac';x.fillRect(90,0,910,500);globalThis.pixels=canvas.toDataURL('image/png');
  globalThis.browser={runtime:{id:'test',onMessage:{addListener(){}},connectNative:()=>({onMessage:{addListener(){}},onDisconnect:{addListener(){}}})},tabs:{query:async()=>[{id:activeID,url:changeURL?'https://fixture.example/new':'https://fixture.example/',windowId:1}],captureVisibleTab:async()=>{if(changeGeometry)geometry.crop_width=100;return pixels;},sendMessage:async(_,m)=>{messages.push(m.type);return{...geometry};}}};
 });
 await page.addScriptTag({content:code+'\nglobalThis.capture=sidebarScreenshot;globalThis.raster=rasterize;'});
 const result=await page.evaluate(async()=>{
  const image=await capture({id:1,windowId:1,url:'https://fixture.example/'});const img=new Image();img.src='data:image/jpeg;base64,'+image.data;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const x=c.getContext('2d');x.drawImage(img,0,0);return{width:image.width,height:image.height,right:Array.from(x.getImageData(img.width-1,100,1,1).data),messages};
 });
 assert.equal(result.width,90);assert.equal(result.height,500);assert(result.right[0]<40&&result.right[1]>70&&result.right[2]>140,'must exclude all pink chat pixels');assert.deepEqual(result.messages,['sidebar_capture_geometry','sidebar_capture_geometry']);
 await page.evaluate(()=>changeGeometry=true);await assert.rejects(page.evaluate(()=>capture({id:1,windowId:1,url:'https://fixture.example/'})),/发生变化/);
 await page.evaluate(()=>{changeGeometry=false;activeID=2;});await assert.rejects(page.evaluate(()=>capture({id:1,windowId:1,url:'https://fixture.example/'})),/可见/);
 await page.evaluate(()=>{activeID=1;geometry.crop_width=0;});await assert.rejects(page.evaluate(()=>capture({id:1,windowId:1,url:'https://fixture.example/'})),/截图区域/);
 for(const fraction of [0,NaN,1.1])await assert.rejects(page.evaluate(f=>raster(pixels,2400,f),fraction),/crop boundary/);
 console.log(JSON.stringify({passed:7,scope:'real canvas pixels; no live website capture',checks:['no hide/restore messages','exact crop below 10%','chat pixels excluded','resize rejected','wrong tab rejected','zero geometry rejected','invalid crop rejected']}));
}finally{await browser.close();}
