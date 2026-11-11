'use strict';
// Public synthetic DOM/framework fixture; no OEM source or firmware is included.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const code=fs.readFileSync(path.join(__dirname,'../src/visual/categories.js'),'utf8');
function fixture(count){
 const callbacks=[],nativeEvents=[],homes=[];let input=true,app='syssettings',context='DisplayTab',locale='ru:';
 function node(tag){const n={tag,className:'',style:{},children:[],parentNode:null,textContent:'',appendChild(c){this.children.push(c);c.parentNode=this;},removeChild(c){this.children.splice(this.children.indexOf(c),1);c.parentNode=null;},setAttribute(k,v){this[k]=v;}};n.classList={add(c){if(!this.contains(c))n.className+=(n.className?' ':'')+c;},remove(c){n.className=n.className.split(' ').filter(x=>x!==c).join(' ');},contains(c){return n.className.split(' ').includes(c);}};return n;}
 const d={body:node('body'),createElement:node};
 const config=Array.from({length:count},(_,i)=>({labelId:'category-'+i,appData:{option:i},selectCallback(){}}));
 const tabs={uiaId:'syssettings',divElt:node('div'),properties:{tabsGroup:'settings',tabsConfig:config,currentlySelectedTab:0},_selectTabCallback(a,i,b){this.properties.currentlySelectedTab=i;callbacks.push({index:i,config:this.properties.tabsConfig[i],appData:this.properties.tabsConfig[i].appData});}};
 const list={divElt:node('div'),properties:{inDialog:false},tabsCtrl:tabs,dataList:{items:Array.from({length:count},(_,i)=>({id:i,value:i,enabled:i%2===0}))}};
 list.divElt.appendChild(tabs.divElt);d.body.appendChild(list.divElt);
 const template={list2Ctrl:list,properties:{isDialog:false}};
 const common={_cachedTemplate:template,_cachedVuiState:'Idle',handleControllerEvent(e,first){nativeEvents.push([e,first]);},_statusBarClicked(a,b,c){homes.push(c);}};
 const original=common.handleControllerEvent;
 const f={common,_currTmpltInstance:template,getInputEnabled:()=>input,getCurrentApp:()=>app,getCurrCtxtId:()=>context,localize:{getLocStr:(id,key)=>locale+key}};
 const ctx=vm.createContext({w:{},d,f,isFinite});vm.runInContext(code,ctx);const adapter=vm.runInContext('new CmuSettingsCategories(w,d,f)',ctx);
 return {adapter,f,common,original,tabs,list,template,config,callbacks,nativeEvents,homes,d,
  arm(){adapter.armFromHome('Settings',0);adapter.tick(1);},tick(ms=2){adapter.tick(ms);},send(e,first=false){common.handleControllerEvent(e,first);},
  buttons(){return d.body.children.filter(n=>n.className==='cmu-settings-categories').flatMap(n=>n.children).filter(n=>n.tag==='button');},
  input(v){input=v;},locale(v){locale=v;},home(){app='system';context='HomeScreen';adapter.tick(3);}};
}
let cases=0;
function test(name,body){body();cases++;console.log('PASS '+name);}
test('native category and option counts remain dynamic',()=>{
 for(const count of [1,5,12,32]){
  const q=fixture(count),items=q.list.dataList,properties=q.list.properties,before=JSON.stringify(q.config);q.arm();
  assert.equal(q.adapter.snapshot().count,count);assert.equal(q.buttons().length,Math.min(6,count));
  for(let i=0;i<count;i++){
   if(i)q.send('down');q.send('select');assert.equal(q.callbacks.at(-1).config,q.config[i]);assert.equal(q.callbacks.at(-1).appData,q.config[i].appData);
   assert.equal(q.list.dataList,items);assert.equal(q.list.properties,properties);assert.equal(JSON.stringify(q.config),before);q.send('goBack');
  }
 }
});
test('disabled rows skipped and touch cannot invoke them',()=>{
 const q=fixture(5);q.config[1].disabled=true;q.arm();q.send('down');assert.equal(q.adapter.snapshot().focus,2);q.buttons()[1].onclick();assert.equal(q.callbacks.length,0);
});
test('input lock preserves pointer and controller restrictions',()=>{
 const q=fixture(5);q.arm();q.input(false);q.send('select');q.buttons()[0].onclick();assert.equal(q.callbacks.length,0);q.input(true);q.send('select');assert.equal(q.callbacks.length,1);
});
test('reordered and replaced configurations reject old clicks',()=>{
 const q=fixture(5);q.arm();const stale=q.buttons()[0];q.config.reverse();stale.onclick();assert.equal(q.callbacks.length,0);q.tick();q.buttons()[0].onclick();assert.equal(q.callbacks.at(-1).appData,q.config[0].appData);
 q.send('goBack');const old=q.buttons()[0];q.tabs.properties.tabsConfig=q.config.map(x=>({...x}));old.onclick();assert.equal(q.callbacks.length,1);q.tick();q.buttons()[0].onclick();assert.equal(q.callbacks.length,2);
});
test('back from content returns to categories then native home',()=>{
 const q=fixture(5);q.arm();q.send('select');q.send('goBack');assert(q.adapter.showingCategories());q.send('goBack');assert.equal(q.homes[0].statusBtn,'home');assert.equal(q.common.handleControllerEvent,q.original);
});
test('dialogs and voice activity retain native event routing',()=>{
 for(const alter of [q=>q.template.properties.isDialog=true,q=>q.common._cachedVuiState='Listening',q=>q.common.cmnCtrlsDisabled=true]){
  const q=fixture(5);q.arm();alter(q);q.tick();assert.equal(q.buttons().length,0);q.send('goBack');assert.equal(q.nativeEvents.at(-1)[0],'goBack');
 }
});
test('localization changes refresh labels',()=>{
 const q=fixture(5);q.arm();const before=q.buttons()[0].textContent;q.locale('jp:');q.tick();assert.notEqual(q.buttons()[0].textContent,before);
});
test('return home and disposal restore only owned wrappers',()=>{
 const q=fixture(5);q.arm();const ours=q.common.handleControllerEvent;const external=function(){return ours.apply(this,arguments);};q.common.handleControllerEvent=external;q.adapter.dispose();assert.equal(q.common.handleControllerEvent,external);assert.equal(q.buttons().length,0);
 const other=fixture(5);other.arm();other.home();assert.equal(other.common.handleControllerEvent,other.original);assert.equal(other.buttons().length,0);
});
console.log(JSON.stringify({synthetic_groups_passed:cases,native_vehicle_verified:false}));
