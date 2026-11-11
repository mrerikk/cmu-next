'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const path=require('node:path'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'..');
if(process.argv.length!==4){console.error('usage: node tools/test-settings-framework.cjs <owner-supplied-rootfs> <new-output.json>');process.exit(2);}
const root=path.join(path.resolve(process.argv[2]),'jci/gui');
const output=path.resolve(process.argv[3]);
if(fs.existsSync(output))throw Error('output already exists');
const pins=JSON.parse(fs.readFileSync(path.join(repo,'tests/fixtures/settings-framework-pins.json'),'utf8'));
for(const [name,expected] of Object.entries(pins.source_sha256)){
 const file=path.join(root,name);let current=root;
 for(const part of name.split('/')){current=path.join(current,part);assert(!fs.lstatSync(current).isSymbolicLink(),'source symlink: '+name);}
 assert(fs.lstatSync(file).isFile(),'source must be regular: '+name);
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),expected,'unsupported source: '+name);
}

const tabSource=fs.readFileSync(root+'/common/controls/Tabs/js/TabsCtrl.js','utf8');
const commonSource=fs.readFileSync(root+'/common/js/Common.js','utf8');
const guiSource=fs.readFileSync(root+'/framework/js/GuiFramework.js','utf8');
const multiSource=fs.readFileSync(root+'/common/js/Multicontroller.js','utf8');
const settings=fs.readFileSync(root+'/apps/syssettings/js/syssettingsApp.js','utf8');
const code=fs.readFileSync(path.join(repo,'src/visual/categories.js'),'utf8');
function configExpression(name,settingsSource=settings){const settings=settingsSource;let at=settings.indexOf('this.'+name+' =');assert(at>=0);let start=settings.indexOf('[',at),depth=0;for(let i=start;i<settings.length;i++){if(settings[i]==='[')depth++;if(settings[i]===']'&&!--depth)return settings.slice(start,i+1);}throw Error('array');}
function fixture(variant='_tabsConfig',options={}){
 const callbacks=[],intents=[],nativeEvents=[],allNodes=[];let app=options.uiaId||'syssettings',ctxt='DisplayTab',language='ru:',inputEnabled=true;
 function el(tag){const e={tag,className:'',style:{},children:[],parentNode:null,textContent:'',appendChild(n){this.children.push(n);n.parentNode=this;},removeChild(n){this.children.splice(this.children.indexOf(n),1);n.parentNode=null;},setAttribute(k,v){this[k]=v;}};
  e.classList={add(c){if(!e.className.split(' ').includes(c))e.className+=(e.className?' ':'')+c;},remove(c){e.className=e.className.split(' ').filter(x=>x!==c).join(' ');},contains(c){return e.className.split(' ').includes(c);}};allNodes.push(e);return e;}
 const d={body:el('body'),createElement:el};
 const f={getInputEnabled:()=>inputEnabled,registerCtrlLoaded(){},registerCommonLoaded(){},getCurrentApp:()=>app,getCurrCtxtId:()=>ctxt,sendEventToMmui(...a){intents.push(a);},localize:{getLocStr(id,key){if(options.localizationFailure)throw Error('missing locale');return language+key;}}};
 const log={addSrcFile(){},debug(){},info(){},warn(){},error(){}};
 const ctx=vm.createContext({window:{},document:d,framework:f,log,isFinite});
 vm.runInContext(guiSource,ctx);vm.runInContext(multiSource,ctx);vm.runInContext(tabSource,ctx);vm.runInContext(commonSource,ctx);vm.runInContext(code,ctx);
 ctx.tabClick=function(...args){callbacks.push(args);};
 const config=vm.runInContext('(function(){return '+configExpression(variant,options.source||settings)+';}).call({tabClick:tabClick})',ctx);
 const tabs=Object.create(ctx.TabsCtrl.prototype);tabs.uiaId=options.uiaId||'syssettings';tabs.divElt=el('div');tabs.divElt.className='native-tabs';tabs.properties={tabsConfig:config,tabsGroup:'settings',currentlySelectedTab:variant==='_tabsConfigNoHUD'?0:1,defaultSelectCallback:null};
 const list={properties:{inDialog:false},divElt:el('div'),tabsCtrl:tabs,dataList:{items:[{value:4,disabled:false},{value:8,disabled:true}]}};
 list.divElt.className='native-list';list.divElt.appendChild(tabs.divElt);d.body.appendChild(list.divElt);
 const t={list2Ctrl:list,properties:{isDialog:false,leftButtonVisible:false},handleControllerEvent(e){nativeEvents.push(e);return 'consumed';}};
 const common=Object.create(ctx.Common.prototype);common._cachedTemplate=t;common._diagEntrySequence=0;
 common.leftBtn={btnInstance:{hasFocus:false},handleControllerEvent(e){nativeEvents.push('left:'+e);}};
 common.statusBar={remoteUiBtn:null,handleControllerEvent(e){nativeEvents.push('status:'+e);return 'consumed';}};
 f.common=common;f._currTmpltInstance=t;
 ctx.f=f;ctx.d=d;ctx.w={};const adapter=vm.runInContext('new CmuSettingsCategories(w,d,f)',ctx);
 const original=common.handleControllerEvent;
 return {adapter,common,f,d,t,list,tabs,config,callbacks,intents,nativeEvents,allNodes,original,el,
  input(enabled){inputEnabled=enabled;},send(event,first=false){ctx.GuiFramework.prototype._multicontrollerEventHandler.call(f,event,first);},tick(ms=0){adapter.tick(ms);},arm(){adapter.armFromHome('Настройки',0);adapter.tick(1);},
  buttons(){return d.body.children.filter(n=>n.className==='cmu-settings-categories').flatMap(n=>n.children).filter(n=>n.tag==='button');},
  focusTo(i){for(let safety=0;adapter.snapshot().focus!==i&&safety<40;safety++)common.handleControllerEvent(i>adapter.snapshot().focus?'down':'up',false);assert.equal(adapter.snapshot().focus,i);},
  locale(s){language=s;},app(a,b){app=a;ctxt=b;},ctx};
}
const variants=['_tabsConfig','_tabsConfigNoHUD','_tabsConfigJ78A'];
let testedSelections=0;
for(const uiaId of ['syssettings','vehsettings','audiosettings']){
const source=fs.readFileSync(root+'/apps/'+uiaId+'/js/'+uiaId+'App.js','utf8');
for(const variant of variants){
 const options={uiaId,source},initial=fixture(variant,options);initial.tick();assert.equal(initial.common.handleControllerEvent,initial.original);assert.equal(initial.buttons().length,0);
 assert.equal(initial.config.length,variant==='_tabsConfigNoHUD'?7:8);
 for(let i=0;i<initial.config.length;i++){
  const q=fixture(variant,options),before=JSON.stringify(q.config),data=q.list.dataList,props=q.list.properties;
  q.arm();assert(q.adapter.showingCategories());assert.equal(q.adapter.snapshot().count,q.config.length);assert.equal(q.buttons().length,6);
  q.focusTo(i);assert.equal(q.adapter.scrollControl().focussedItem,i);assert.equal(q.adapter.scrollControl().dataList.itemCount,q.config.length);
  q.send('selectStart',false);assert.equal(q.callbacks.length,0);
  q.send('select',false);testedSelections++;assert.equal(q.callbacks.length,1);assert.equal(q.callbacks[0][0],q.tabs);assert.equal(q.callbacks[0][1],q.config[i].appData);assert.equal(q.callbacks[0][2],null);
  assert(!q.adapter.showingCategories());assert.equal(q.list.dataList,data);assert.equal(q.list.properties,props);assert.equal(JSON.stringify(q.config),before);
  q.send('cw',false);assert(q.nativeEvents.includes('cw'));
  q.send('goBack',false);assert(q.adapter.showingCategories());assert.equal(q.intents.length,0);
  q.send('goBack',false);assert.equal(q.intents.length,1);assert.equal(q.intents[0][1],'Global.IntentHome');assert.equal(q.common.handleControllerEvent,q.original);assert.equal(q.list.divElt.className,'native-list');assert.equal(q.tabs.divElt.className,'native-tabs');
 }
}
}
assert.equal(testedSelections,69);
const stable=fixture();stable.arm();const proxy=stable.adapter.scrollControl();for(let i=0;i<8;i++){stable.focusTo(i);assert.equal(stable.adapter.scrollControl(),proxy);}const nodeCount=stable.allNodes.length;for(let i=0;i<5000;i++)stable.tick(i+2);assert.equal(stable.allNodes.length,nodeCount);
const locked=fixture();locked.arm();locked.input(false);const lockedIndex=locked.adapter.snapshot().focus;locked.send('down');locked.send('select');locked.send('goBack');assert.equal(locked.adapter.snapshot().focus,lockedIndex);assert.equal(locked.callbacks.length,0);assert.equal(locked.intents.length,0);locked.buttons()[1].onclick();assert.equal(locked.callbacks.length,0);let stopped=false;locked.ctx.Multicontroller.prototype._clickEventHandler({stopPropagation(){stopped=true;}});assert(stopped);locked.input(true);locked.send('select');assert.equal(locked.callbacks.length,1);
const disabled=fixture();disabled.config[2].disabled=1;disabled.config[3].disabled='disabled';disabled.arm();disabled.common.handleControllerEvent('down',false);assert.equal(disabled.adapter.snapshot().focus,4);assert(disabled.buttons().filter(b=>b.disabled).length>=1);
const invalidClick=disabled.buttons().find(b=>b.disabled);invalidClick.onclick();assert.equal(disabled.callbacks.length,0);
const dynamic=fixture();dynamic.arm();const stale=dynamic.buttons()[1],oldConfig=dynamic.tabs.properties.tabsConfig;
dynamic.tabs.properties.tabsConfig=oldConfig.map(x=>({...x}));dynamic.tick(2);const newButton=dynamic.buttons()[1];assert.notEqual(newButton,stale);stale.onclick();assert.equal(dynamic.callbacks.length,0);newButton.onclick();assert.equal(dynamic.callbacks[0][1],oldConfig[1].appData);
const reordered=fixture();reordered.arm();const old=reordered.buttons()[0];reordered.config.reverse();old.onclick();assert.equal(reordered.callbacks.length,0);reordered.tick(2);reordered.buttons()[0].onclick();assert.equal(reordered.callbacks[0][1],reordered.config[0].appData);
const locale=fixture();locale.arm();const firstText=locale.buttons()[0].textContent;locale.locale('jp:');locale.tick(2);assert.notEqual(locale.buttons()[0].textContent,firstText);
const modal=fixture();modal.arm();modal.common.handleControllerEvent('select',false);modal.t.properties.isDialog=true;modal.tick(3);assert.equal(modal.tabs.divElt.className,'native-tabs');modal.common.handleControllerEvent('goBack',false);assert.equal(modal.intents.at(-1)[1],'Global.GoBack');modal.t.properties.isDialog=false;modal.tick(4);assert(modal.tabs.divElt.classList.contains('cmu-settings-native-tabs'));
const voice=fixture();voice.arm();voice.common.endStateSbn=function(){};voice.common.showStateSbn=function(){};voice.common._showHideLineNumbers=function(){};voice.common._vuiStateMsgHandler({msgId:'vuiState',params:{payload:{state:'Listening'}}});voice.tick(2);assert.equal(voice.buttons().length,0);assert.equal(voice.tabs.divElt.className,'native-tabs');voice.send('goBack');assert.equal(voice.intents.at(-1)[1],'Global.GoBack');voice.common._vuiStateMsgHandler({msgId:'vuiState',params:{payload:{state:'Idle'}}});voice.tick(3);assert(voice.adapter.showingCategories());for(const flag of ['cmnCtrlsDisabled','_vuiHelpDialog','_vuiExamplesDialog']){voice.common[flag]=true;voice.tick(4);assert.equal(voice.buttons().length,0);voice.common[flag]=false;voice.tick(5);assert(voice.adapter.showingCategories());}
const nested=fixture();nested.arm();nested.common.handleControllerEvent('select',false);const rootTemplate=nested.f._currTmpltInstance;nested.f._currTmpltInstance={properties:{isDialog:false},handleControllerEvent(e){nested.nativeEvents.push('nested:'+e);return 'consumed';}};nested.common._cachedTemplate=nested.f._currTmpltInstance;nested.tick(3);nested.common.handleControllerEvent('goBack',false);assert.equal(nested.intents.at(-1)[1],'Global.GoBack');nested.f._currTmpltInstance=rootTemplate;nested.common._cachedTemplate=rootTemplate;nested.tick(4);nested.common.handleControllerEvent('goBack',false);assert(nested.adapter.showingCategories());
const remote=fixture();remote.arm();remote.common.statusBar.remoteUiBtn={hasFocus:true};remote.common.handleControllerEvent('select',false);assert.equal(remote.callbacks.length,0);assert(remote.nativeEvents.includes('status:select'));
const first=fixture();first.arm();let index=first.adapter.snapshot().focus;first.common.handleControllerEvent('down',true);assert.equal(first.adapter.snapshot().focus,index);first.common.handleControllerEvent('controllerActive',false);assert(first.nativeEvents.includes('controllerActive'));
const expire=fixture();expire.adapter.armFromHome('Настройки',0);expire.tick(15001);assert(!expire.adapter.snapshot().active);
const foreign=fixture();foreign.arm();const ours=foreign.common.handleControllerEvent;const external=function(){return ours.apply(this,arguments);};foreign.common.handleControllerEvent=external;foreign.list.divElt.className+=' other-module';foreign.tabs.divElt.className+=' other-tab-state';foreign.adapter.dispose();assert.equal(foreign.common.handleControllerEvent,external);assert.equal(foreign.list.divElt.className,'native-list other-module');assert.equal(foreign.tabs.divElt.className,'native-tabs other-tab-state');foreign.common.handleControllerEvent('goBack',false);assert.equal(foreign.intents.at(-1)[1],'Global.GoBack');
for(const mutate of [q=>q.tabs.properties.tabsGroup='phone',q=>q.tabs.properties.currentlySelectedTab=20,q=>q.tabs.properties.tabsConfig=[],q=>q.common._cachedTemplate={},q=>q.list.properties.inDialog=true,q=>q.config[0].labelId=null,q=>q.tabs._selectTabCallback=null]){const q=fixture();mutate(q);q.arm();assert(!q.adapter.snapshot().active);assert.equal(q.common.handleControllerEvent,q.original);}
const unavailable=fixture('_tabsConfig',{localizationFailure:true});unavailable.arm();assert.equal(unavailable.common.handleControllerEvent,unavailable.original);
const callbackError=fixture();callbackError.config[1].selectCallback=()=>{callbackError.callbacks.push('called');throw Error('native service error');};callbackError.arm();callbackError.common.handleControllerEvent('select',false);assert.deepEqual(callbackError.callbacks,['called']);assert.equal(callbackError.common.handleControllerEvent,callbackError.original);assert.equal(callbackError.list.divElt.className,'native-list');
const defaultCallback=fixture();defaultCallback.config[1].selectCallback=null;defaultCallback.tabs.properties.defaultSelectCallback=(...args)=>defaultCallback.callbacks.push(args);defaultCallback.arm();defaultCallback.common.handleControllerEvent('select',false);assert.equal(defaultCallback.callbacks[0][1],defaultCallback.config[1].appData);
const allDisabled=fixture();allDisabled.config.forEach(c=>c.disabled=true);allDisabled.arm();assert.equal(allDisabled.adapter.snapshot().focus,-1);allDisabled.common.handleControllerEvent('select',false);assert.equal(allDisabled.callbacks.length,0);allDisabled.common.handleControllerEvent('goBack',false);assert.equal(allDisabled.intents.at(-1)[1],'Global.IntentHome');
const diag=fixture();diag.arm();diag.common._diagEntrySequence=2;diag.common.handleControllerEvent('goBack',false);assert.equal(diag.intents.length,0); // original OEM diagnostic guard retained
const home=fixture();home.arm();home.app('system','HomeScreen');home.tick(3);assert(!home.adapter.snapshot().active);assert.equal(home.common.handleControllerEvent,home.original);
for(const bad of ['sendEventToMmui','Global.IntentSettingsTab','fetch(','XMLHttpRequest','=>','const ','let '])assert(!code.includes(bad),bad);
// Equipment-sized arrays stay native even when they differ from the inspected factory presets.
let dynamicSelections=0;
for(const count of [1,5,12,32]){
 const q=fixture();
 const originalList=q.list.dataList,originalProperties=q.list.properties;
 const rows=Array.from({length:count},(_,i)=>({...q.config[1],labelId:null,label:'Native category '+i,appData:{equipmentOption:i}}));
 q.tabs.properties.tabsConfig=rows;q.tabs.properties.currentlySelectedTab=0;q.arm();
 assert.equal(q.adapter.snapshot().count,count);
 for(let i=0;i<count;i++){
  q.focusTo(i);q.send('select');assert.equal(q.callbacks.at(-1)[1],rows[i].appData);dynamicSelections++;
  assert.equal(q.list.dataList,originalList);assert.equal(q.list.properties,originalProperties);
  q.send('goBack');assert(q.adapter.showingCategories());
 }
}
const payload=fs.readFileSync(path.join(repo,'src/visual/module/payload/cmu-next-layout.js'),'utf8');
assert(payload.includes(code),'module must embed the categories source under test');
const result={source_pins: pins.source_sha256, adapter_sha256:crypto.createHash('sha256').update(code).digest('hex'),native_selection_cases:testedSelections,dynamic_selection_cases:dynamicSelections,passed:['nine real category configurations across syssettings/vehsettings/audiosettings: seven/eight categories and J78A variant','all 69 native tab selections dispatch the original appData through actual TabsCtrl methods','configuration objects, callback appData and setting data preserved','disabled/unknown categories and default callback honored','stale clicks, array replacement and reorder guarded','native localization and language changes','category scroll proxy uses actual array count and selected row; same proxy survives all focus/window movements; 5000 idle ticks allocate no nodes','content navigation delegated to actual Common handler','Back from category content to root; root returns via actual OEM Home callback','nested screens and modal dialogs preserve native GoBack','actual Common voice-state updates, VUI help/examples and disabled common controls reveal factory UI and preserve original routing','remote projection focus and first-event behavior delegated','native diagnostic Home-button guard retained','actual GuiFramework input routing and Multicontroller capture lock retained; disabled input cannot select by controller or touch','not armed, expired request, invalid frame or missing localization leave factory UI','external wrappers and unknown classes preserved on disposal','return to Home cleans adapter state'],scope:'actual v74 TabsCtrl and Common prototype methods plus nine OEM configuration arrays with constructed state and DOM/service stubs; not full CMU initialization, real MMUI history or vehicle rendering',vehicle_verified:false};
fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log('PASS: '+result.passed.length+' native settings category groups; real MMUI/vehicle verification pending');
