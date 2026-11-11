/* Project application lifecycle core. ES5; no native CMU bridge is installed here. */
(function(global){
 'use strict';
 function CmuAppRuntime(options){
  var w=options.window,d=options.document,root=options.root,host=options.host||{},now=options.now||function(){return Date.now();};
  var apps=Object.create(null),current=null,disposed=false;
  if(!root||typeof root.appendChild!=='function'){throw new Error('application root required');}
  function report(error){try{if(typeof options.onError==='function'){options.onError(error);}}catch(ignored){}}
  function notifyClosed(session){
   if(session.app&&!session.notified){session.notified=true;try{if(typeof session.app.onClose==='function'){session.app.onClose(session.closeReason);}}catch(error){report(error);}}
  }
  function release(session,reason){
   if(!session||!session.live){return;}
   session.live=false;session.closeReason=reason;if(current===session){current=null;}
   var i;
   for(i=session.resources.length-1;i>=0;i--){try{session.resources[i]();}catch(error){report(error);}}
   session.resources=[];
   notifyClosed(session);
   if(session.view.parentNode){session.view.parentNode.removeChild(session.view);}
  }
  function failed(session,error){report(error);release(session,'error');}
  function track(session,remove){
   if(typeof remove!=='function'){throw new Error('host subscription must return an unsubscribe function');}
   if(session.live){session.resources.push(remove);}else{remove();}
  }
  function guarded(session,callback){return function(){
   if(!session.live||current!==session){return;}
   try{return callback.apply(null,arguments);}catch(error){failed(session,error);}
  };}
  function speedSample(sample){
   var at=now();
   if(typeof at!=='number'||!isFinite(at)||!sample||sample.unit!=='km/h'||(sample.source!=='demo'&&sample.source!=='vehicle')||
      typeof sample.value!=='number'||!isFinite(sample.value)||sample.value<0||sample.value>400||
      typeof sample.timestamp!=='number'||!isFinite(sample.timestamp)||
      at-sample.timestamp>2000||sample.timestamp-at>250){return null;}
   return {value:sample.value,unit:'km/h',source:sample.source,timestamp:sample.timestamp};
  }
  this.register=function(manifest,factory){
   if(disposed){throw new Error('runtime disposed');}
   if(!manifest||typeof manifest.id!=='string'||!(/^[a-z][a-z0-9-]{0,63}$/).test(manifest.id)||
      typeof manifest.title!=='string'||!manifest.title.length||typeof manifest.version!=='string'||
      !(/^[0-9]+\.[0-9]+\.[0-9]+$/).test(manifest.version)||typeof factory!=='function'||apps[manifest.id]){throw new Error('invalid or duplicate application');}
   var caps=manifest.requiredCapabilities||[],copy=[],i;
   if(Object.prototype.toString.call(caps)!=='[object Array]'){throw new Error('capability list required');}
   for(i=0;i<caps.length;i++){if(caps[i]!=='vehicle-speed'||copy.indexOf(caps[i])!==-1){throw new Error('unknown or duplicate capability');}copy.push(caps[i]);}
   apps[manifest.id]={id:manifest.id,title:manifest.title,version:manifest.version,requiredCapabilities:copy,factory:factory};
  };
  this.open=function(id){
   var item=apps[id],i;
   if(disposed||!item){return false;}
   try{for(i=0;i<item.requiredCapabilities.length;i++){
    if(typeof host.hasCapability!=='function'||host.hasCapability(item.requiredCapabilities[i])!==true){return false;}
   }}catch(error){report(error);return false;}
   release(current,'replace');
   var session={id:id,live:true,view:d.createElement('div'),app:null,resources:[]};
   session.view.className='cmu-app-root';session.view.setAttribute('data-app-id',id);
   current=session;root.appendChild(session.view);
   var context={view:session.view,document:d,now:now,
    close:function(){release(session,'application');},
    listen:function(node,event,callback){
     var listener=guarded(session,callback);node.addEventListener(event,listener,false);track(session,function(){node.removeEventListener(event,listener,false);});
    },
    interval:function(callback,milliseconds){
     if(typeof milliseconds!=='number'||!isFinite(milliseconds)||milliseconds<16||milliseconds>60000){throw new Error('invalid interval');}
     var timer=w.setInterval(guarded(session,callback),milliseconds);track(session,function(){w.clearInterval(timer);});
    },
    subscribeSpeed:function(callback){
     if(typeof host.hasCapability!=='function'||host.hasCapability('vehicle-speed')!==true||typeof host.subscribeSpeed!=='function'){throw new Error('speed source unavailable');}
     track(session,host.subscribeSpeed(guarded(session,function(sample){callback(speedSample(sample));})));
    },
    normalizeSpeed:speedSample
   };
   try{
    session.app=item.factory(context)||{};
    if(!session.live){notifyClosed(session);return false;}
    if(typeof host.subscribeInput==='function'){
     track(session,host.subscribeInput(function(event){
      if(!session.live||current!==session){return false;}
      try{
       if(typeof host.inputEnabled==='function'&&host.inputEnabled()===false){return false;}
       if(session.app.onInput&&session.app.onInput(event)===true){return true;}
       if(event==='goBack'){release(session,'back');return true;}
       return false;
      }catch(error){failed(session,error);return false;}
     }));
    }
    return session.live;
   }catch(error){failed(session,error);return false;}
  };
  this.close=function(){release(current,'close');};
  this.destroy=function(){release(current,'destroy');disposed=true;apps=Object.create(null);};
  this.snapshot=function(){return {active:current?current.id:null,disposed:disposed};};
 }
 global.CmuAppRuntime=CmuAppRuntime;
})(this);
