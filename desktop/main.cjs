const {app,BrowserWindow,dialog,shell}=require('electron');
const path=require('node:path');
const os=require('node:os');
const {pathToFileURL}=require('node:url');
let service;
if(!app.requestSingleInstanceLock())app.quit();
else {
 app.on('second-instance',()=>{const w=BrowserWindow.getAllWindows()[0];if(w){w.show();w.focus();}});
 app.whenReady().then(async()=>{
  const {startServer}=await import(pathToFileURL(path.join(__dirname,'../src/server.mjs')).href);
  const dataDir=process.env.SOHKEN_HOME||path.join(os.homedir(),'.sohken');
  try{service=await startServer({dataDir,port:Number(process.env.SOHKEN_PORT||4317),releaseDir:path.join(app.isPackaged?process.resourcesPath:path.join(__dirname,'..'),'release')});}
  catch(error){dialog.showErrorBox('Sohken could not start',error.code==='EADDRINUSE'?'Port 4317 is in use. Stop the terminal engine before opening the desktop app.':error.message);app.quit();return;}
  const window=new BrowserWindow({width:1380,height:920,minWidth:760,minHeight:600,title:'Sohken',backgroundColor:'#0b1117',autoHideMenuBar:true,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}});
  window.webContents.setWindowOpenHandler(({url})=>{try{const parsed=new URL(url);if(parsed.protocol==='https:'&&['rzp.io','razorpay.com','www.razorpay.com'].includes(parsed.hostname)){shell.openExternal(url);return {action:'deny'};}}catch{}return {action:'deny'};});
  window.webContents.on('will-navigate',(event,url)=>{try{const parsed=new URL(url);if(parsed.origin===service.url)return;if(parsed.protocol==='https:'&&['rzp.io','razorpay.com','www.razorpay.com'].includes(parsed.hostname)){event.preventDefault();shell.openExternal(url);return;}}catch{}event.preventDefault();});
  window.webContents.session.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
  await window.loadURL(service.url);
 }).catch(e=>{dialog.showErrorBox('Sohken startup failed',e.message);app.quit();});
 app.on('window-all-closed',()=>app.quit());
 let closing=false;
 app.on('before-quit',event=>{if(service&&!closing){event.preventDefault();closing=true;service.close().finally(()=>app.quit());}});
}
