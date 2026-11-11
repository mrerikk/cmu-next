/* Native settings category view for the inspected v74 framework. No MMUI intents are constructed here. */
function CmuSettingsCategories(w,d,f){
 'use strict';
 var active=false,mode='content',pendingUntil=-1,now=0,title='',focus=0,view=null,current=null,bridge=null,disposed=false;
 function remove(node){if(node&&node.parentNode){node.parentNode.removeChild(node);}}
 function clearView(){
  if(d.body&&d.body.classList){d.body.classList.remove('cmu-settings-adapted');}
  if(!view){return;}
  if(view.list&&view.list.divElt){view.list.divElt.classList.remove('cmu-settings-covered');}
  if(view.tabs&&view.tabs.divElt){view.tabs.divElt.classList.remove('cmu-settings-native-tabs');}
  remove(view.overlay);remove(view.heading);view=null;
 }
 function frame(){
  try{
   var t=f._currTmpltInstance,common=f.common,list=t&&t.list2Ctrl,tabs=list&&list.tabsCtrl,p=tabs&&tabs.properties;
   if(!common||common._cachedTemplate!==t||!t.properties||t.properties.isDialog===true||!list||!list.properties||list.properties.inDialog===true||!tabs||!tabs.divElt||!list.divElt||!p||p.tabsGroup!=='settings'||typeof tabs._selectTabCallback!=='function'||typeof common._statusBarClicked!=='function'){return null;}
   var voice=common._cachedVuiState;
   if(common.cmnCtrlsDisabled||common._vuiHelpDialog||common._vuiExamplesDialog||(voice!==null&&typeof voice!=='undefined'&&voice!=='Idle'&&voice!=='Not Ready'&&voice!=='Playing Out of Session Alert')){return null;}
   var config=p.tabsConfig,rows=[],i,c,label;
   if(typeof p.currentlySelectedTab!=='number'||!isFinite(p.currentlySelectedTab)||Math.floor(p.currentlySelectedTab)!==p.currentlySelectedTab){return null;}
   if(Object.prototype.toString.call(config)!=='[object Array]'||config.length<1||config.length>32||p.currentlySelectedTab<0||p.currentlySelectedTab>=config.length){return null;}
   for(i=0;i<config.length;i++){
    c=config[i];if(!c||typeof c!=='object'){return null;}
    label=c.labelId?f.localize.getLocStr(tabs.uiaId,c.labelId,c.subMap):c.label;
    if(typeof label!=='string'||!label.length){return null;}
    rows.push({config:c,index:i,label:label,disabled:!!c.disabled||typeof (typeof c.selectCallback==='function'?c.selectCallback:p.defaultSelectCallback)!=='function'});
   }
   return {template:t,list:list,tabs:tabs,rows:rows,config:config,selected:p.currentlySelectedTab};
  }catch(invalidFrame){return null;}
 }
 function enabledIndex(a,start,direction){
  for(var i=start;i>=0&&i<a.length;i+=direction){if(!a[i].disabled){return i;}}
  return -1;
 }
 function chooseFocus(a,selected){
  if(selected>=0&&selected<a.length&&!a[selected].disabled){return selected;}
  return enabledIndex(a,0,1);
 }
 function add(tag,name,parent){var node=d.createElement(tag);node.className=name;parent.appendChild(node);return node;}
 function invoke(index,expected){
  try{if(typeof f.getInputEnabled!=='function'||f.getInputEnabled()===false){return false;}}catch(inputUnavailable){return false;}
  var next=frame(),row=next&&next.rows[index];
  // A pending click must never act on a reordered/replaced configuration.
  if(!active||mode!=='categories'||!row||row.config!==expected||row.disabled){tick(now);return false;}
  focus=index;mode='content';clearView();current=next;
  try{next.tabs._selectTabCallback(null,index,null);tick(now);return true;}
  catch(callbackFailure){active=false;clearView();restoreBridge();return false;}
 }
 function firstRow(a){return Math.max(0,Math.min(focus-4,a.rows.length-6));}
 function populateRows(a){
  var i,row,button,first=firstRow(a),end=Math.min(a.rows.length,first+6);
  for(i=0;i<view.buttons.length;i++){remove(view.buttons[i].button);}
  view.buttons=[];view.first=first;view.focus=focus;
  for(i=first;i<end;i++){
   (function(row){
    var button=add('button','cmu-settings-category-row'+(row.index===focus?' cmu-settings-category-current':''),view.overlay);
    button.type='button';button.textContent=row.label;button.disabled=row.disabled;
    button.style.top=(54+(row.index-first)*54)+'px';button.setAttribute('aria-current',row.index===focus?'true':'false');
    button.onclick=function(){invoke(row.index,row.config);};view.buttons.push({button:button,index:row.index});
   })(a.rows[i]);
  }
 }
 function updateFocus(a){
  if(view.first!==firstRow(a)){populateRows(a);}
  else if(view.focus!==focus){
   for(var i=0;i<view.buttons.length;i++){
    var entry=view.buttons[i];entry.button.classList.remove('cmu-settings-category-current');
    if(entry.index===focus){entry.button.classList.add('cmu-settings-category-current');}
    entry.button.setAttribute('aria-current',entry.index===focus?'true':'false');
   }
   view.focus=focus;
  }
  if(view.scroll){view.scroll.focussedItem=focus;}
 }
 function render(a){
  var signature=[],i,selectedLabel='';
  for(i=0;i<a.rows.length;i++){signature.push(a.rows[i].label+'|'+a.rows[i].disabled);}
  signature=signature.join('\n')+'|'+a.selected+'|'+mode;
  var sameRefs=view&&view.config===a.config;
  if(sameRefs){for(i=0;i<a.rows.length;i++){if(view.refs[i]!==a.rows[i].config){sameRefs=false;break;}}}
  if(view&&view.list===a.list&&view.tabs===a.tabs&&view.signature===signature&&sameRefs){if(mode==='categories'){updateFocus(a);}return;}
  clearView();
  view={list:a.list,tabs:a.tabs,config:a.config,refs:[],overlay:null,heading:null,signature:signature,scroll:null,buttons:[],first:0,focus:focus};
  for(i=0;i<a.rows.length;i++){view.refs.push(a.rows[i].config);}
  d.body.classList.add('cmu-settings-adapted');
  a.tabs.divElt.classList.add('cmu-settings-native-tabs');
  if(mode==='content'){
   if(a.rows[a.selected]){selectedLabel=a.rows[a.selected].label;}
   view.heading=add('div','cmu-settings-content-heading',a.list.divElt);view.heading.textContent=selectedLabel;return;
  }
  a.list.divElt.classList.add('cmu-settings-covered');
  var overlay=add('div','cmu-settings-categories',d.body);view.overlay=overlay;
  overlay.setAttribute('role','region');overlay.setAttribute('aria-label',title);
  var heading=add('div','cmu-settings-categories-heading',overlay);heading.textContent=title;
  populateRows(a);
  var marker=add('div','cmu-settings-category-scroll-marker',overlay);
  view.scroll={divElt:overlay,scrollIndicatorWrapper:marker,properties:{showScrollIndicator:true},dataList:{itemCountKnown:true,itemCount:a.rows.length},focussedItem:focus};
 }
 function showCategories(a){mode='categories';focus=chooseFocus(a.rows,a.selected);clearView();current=a;render(a);}
 function restoreBridge(){
  var b=bridge;bridge=null;if(!b){return;}
  if(b.common.handleControllerEvent===b.wrapper){if(b.own){b.common.handleControllerEvent=b.original;}else{delete b.common.handleControllerEvent;}}
 }
 function installBridge(){
  var common=f.common;
  if(bridge&&bridge.common===common){return;}
  restoreBridge();
  if(!common||typeof common.handleControllerEvent!=='function'){return;}
  var b={common:common,original:common.handleControllerEvent,own:Object.prototype.hasOwnProperty.call(common,'handleControllerEvent'),wrapper:null};
  b.wrapper=function(eventId,firstEvent){
   if(disposed||!active){return b.original.apply(this,arguments);}
   var a=frame(),remote=this.statusBar&&this.statusBar.remoteUiBtn;
   var left=this.leftBtn&&this.leftBtn.btnInstance;
   if(!a||(remote&&remote.hasFocus)||(left&&left.hasFocus)){return b.original.apply(this,arguments);}
   if(eventId==='goBack'){
    if(mode==='content'){showCategories(a);return;}
    // This root view is only armed by the native Home->Settings action.
    // Delegate its return to the exact OEM Home-button handler, including its diagnostic guard.
    active=false;clearView();restoreBridge();return this._statusBarClicked(null,null,{statusBtn:'home'});
   }
   if(mode!=='categories'||firstEvent){return b.original.apply(this,arguments);}
   var direction=eventId==='cw'||eventId==='down'?1:(eventId==='ccw'||eventId==='up'?-1:0);
   if(direction){
    var target=enabledIndex(a.rows,focus+direction,direction);
    if(target!==-1){focus=target;current=a;render(a);}return;
   }
   if(eventId==='select'){if(a.rows[focus]){invoke(focus,a.rows[focus].config);}return;}
   if(eventId==='selectStart'||eventId==='selectHold'||eventId==='upStart'||eventId==='downStart'||eventId==='leftStart'||eventId==='rightStart'||eventId==='left'||eventId==='right'){return;}
   return b.original.apply(this,arguments);
  };
  common.handleControllerEvent=b.wrapper;bridge=b;
 }
 function tick(ms){
  if(disposed){return;}
  now=ms;
  try{
   if(active&&f.getCurrentApp()==='system'&&f.getCurrCtxtId()==='HomeScreen'){active=false;clearView();restoreBridge();current=null;return;}
   if(!active&&pendingUntil<now){pendingUntil=-1;return;}
   var a=frame();
   if(!a){clearView();current=null;return;}
   if(!active){
    if(pendingUntil<now){return;}
    pendingUntil=-1;active=true;mode='categories';focus=chooseFocus(a.rows,a.selected);
   }
   current=a;
   if(mode==='categories'&&(focus<0||focus>=a.rows.length||a.rows[focus].disabled)){focus=chooseFocus(a.rows,a.selected);}
   installBridge();render(a);
  }catch(viewFailure){active=false;clearView();restoreBridge();current=null;}
 }
 return {
  armFromHome:function(label,ms){if(!disposed&&typeof label==='string'&&label.length){title=label;pendingUntil=ms+15000;}},
  cancelPending:function(){pendingUntil=-1;},
  tick:tick,
  scrollControl:function(){return view&&mode==='categories'?view.scroll:null;},
  showingCategories:function(){return active&&mode==='categories'&&!!view;},
  snapshot:function(){return {active:active,mode:mode,focus:focus,count:current?current.rows.length:0,pending:pendingUntil>=now};},
  dispose:function(){if(disposed){return;}disposed=true;active=false;pendingUntil=-1;clearView();restoreBridge();current=null;}
 };
}
