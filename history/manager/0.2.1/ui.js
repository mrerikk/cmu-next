/* Fullscreen CMU package manager. ES5 for the inspected Opera runtime. */
(function(w,d){
 'use strict';
 if(w.__cmuManagerUnmount){w.__cmuManagerUnmount();}
 var disposed=false,root,style,body,footer,badge,dialog=null,buttons=[],focus=0,tab='packages',filter='all',selected={},catalog=[],installed=[],online=false,status=null,pending={},scripts=[],timers=[],bridge=null,queue=[],running=false,waitingJob=0,lastError='',configLoading=false,suspended=false,history=[],chosenLog=null,lookupBusy=false,activeRequest=w.__cmuManagerPendingAction||null;
 if(activeRequest&&!(/^[a-f0-9]{32}$/).test(activeRequest.key||'')){activeRequest=null;}if(activeRequest){running=true;}
 var labels={packages:'Пакеты',installed:'Установлено',backup:'Резервная копия',reports:'Отчёты'};
 var operationLabels={install:'Установка',rollback:'Откат',backup:'Резервная копия',restore:'Восстановление копии',recover:'Восстановление после сбоя',report:'Сохранение отчёта'},phaseLabels={accepted:'Принято',running:'Выполняется',succeeded:'Завершено',failed:'Ошибка',interrupted:'Прервано'};
 function add(tag,cls,text,parent){var n=d.createElement(tag);n.className=cls||'';if(text!==null&&typeof text!=='undefined'){n.textContent=text;}if(parent){parent.appendChild(n);}return n;}
 function remove(n){if(n&&n.parentNode){n.parentNode.removeChild(n);}}
 function clear(n){while(n.firstChild){n.removeChild(n.firstChild);}}
 function canInput(){var f=w.framework;try{return !disposed&&(!f||typeof f.getInputEnabled!=='function'||f.getInputEnabled()!==false)&&root.style.display!=='none';}catch(e){return false;}}
 function btn(text,fn,parent,disabled,cls){var n=add('button',cls||'',text,parent);n.type='button';n.disabled=!!disabled;n.onclick=function(){if(!n.disabled&&canInput()){fn();}};buttons.push(n);return n;}
 function finishRequest(id){var p=pending[id];if(!p){return null;}delete pending[id];w.clearTimeout(p.timer);remove(p.script);return p;}
 w.__cmuManagerReply=function(reply){if(disposed||!reply||typeof reply.request!=='string'){return;}var p=finishRequest(reply.request);if(p){p.done(reply);}};
 function rpc(op,item,done,key){var c=w.__cmuManagerConfig;if(!c||!/^http:\/\/127\.0\.0\.1:\d+\/api\.js$/.test(c.url)||!(/^[a-f0-9]{64}$/).test(c.token)){done({ok:false,error:'offline'});return;}
  if(typeof w.__cmuManagerRpcSerial==='undefined'){w.__cmuManagerRpcSerial=0;}
  var serial=w.__cmuManagerRpcSerial;
  if(typeof serial!=='number'||!isFinite(serial)||serial<0||serial%1!==0||serial>=9007199254740990){done({ok:false,error:'client-state'});return;}
  serial++;w.__cmuManagerRpcSerial=serial;
  var id='r'+serial.toString(36),s=d.createElement('script');s.type='text/javascript';
  s.src=c.url+'?token='+c.token+'&op='+op+'&id='+(item||'-')+'&rid='+id+(key?'&key='+key:'');
  var p={script:s,done:done,timer:null};pending[id]=p;
  p.timer=w.setTimeout(function(){var x=finishRequest(id);if(x){x.done({ok:false,error:'connection-lost'});}},5000);
  s.onerror=function(){var x=finishRequest(id);if(x){x.done({ok:false,error:'connection-lost'});}};
  (d.head||d.body).appendChild(s);
 }
 function loadConfig(){if(w.__cmuManagerConfig||configLoading){return;}var u=w.utility;if(!u||typeof u.loadScript!=='function'){return;}configLoading=true;
  try{if(typeof u.removeScript==='function'){u.removeScript('../../../tmp/cmu-next-control/client.js');}u.loadScript('../../../tmp/cmu-next-control/client.js');}catch(e){}
  timers.push(w.setTimeout(function(){configLoading=false;},5000));
 }
 function refreshHistory(){rpc('history','-',function(r){if(r.ok&&r.data&&Object.prototype.toString.call(r.data.jobs)==='[object Array]'){history=r.data.jobs;render();}});}
 function refreshData(){refreshHistory();rpc('catalog','-',function(r){if(r.ok&&r.data&&Object.prototype.toString.call(r.data.items)==='[object Array]'){catalog=r.data.items;render();}});rpc('installed','-',function(r){if(r.ok&&r.data&&Object.prototype.toString.call(r.data.items)==='[object Array]'){installed=r.data.items;render();}});}
 function count(){var n=0,k;for(k in selected){if(Object.prototype.hasOwnProperty.call(selected,k)&&selected[k]){n++;}}return n;}
 function note(text){add('p','note',text,body);}
 function confirm(title,text,action){if(dialog){return;}var old=buttons;buttons=[];dialog=add('div','cmum-shade',null,root);var panel=add('div','cmum-dialog',null,dialog);add('div','eyebrow','ПОДТВЕРЖДЕНИЕ',panel);add('h2','',title,panel);add('p','',text,panel);var actions=add('div','dialog-actions',null,panel);btn('Отмена',function(){remove(dialog);dialog=null;buttons=old;render();},actions,false);btn('Продолжить',function(){remove(dialog);dialog=null;buttons=old;action();},actions,false,'primary');setFocus(0);}
 function blocked(){return running||status&&(status.busy||status.recovery_required||status.journal_error);}
 function fail(message){lastError=message;queue=[];running=false;waitingJob=0;render();}
 function clearAction(){activeRequest=null;delete w.__cmuManagerPendingAction;waitingJob=0;}
 function resolveAction(){if(!activeRequest||lookupBusy||!online||status.journal_error){return;}var request=activeRequest;lookupBusy=true;
  rpc('lookup',request.key,function(r){lookupBusy=false;if(disposed||activeRequest!==request){return;}if(!r.ok||!r.data){queue=[];lastError='Подтверждение операции пока недоступно. Повторный запуск не выполняется.';render();return;}
   if(r.data.found===false){queue=[];lastError='Команда пока не найдена в журнале. Ожидаем подтверждение; автоматический повтор отключён.';render();return;}
   var j=r.data.job;if(!j||j.request!==request.key||j.operation!==request.operation||j.item!==request.item){queue=[];lastError='Ответ журнала не совпал с командой. Сохраните отчёт.';render();return;}
   waitingJob=j.sequence;if(j.phase==='accepted'||j.phase==='running'){running=true;render();return;}
   if(j.phase==='failed'||j.phase==='interrupted'){clearAction();fail(j.phase==='interrupted'?'Операция прервана. Требуется восстановление.':'Операция завершилась с ошибкой. Откройте «Отчёты».');return;}
   if(j.phase==='succeeded'&&!status.busy){clearAction();running=false;lastError='';chosenLog=null;if(queue.length){nextInstall();}else{selected={};refreshData();render();}}
  });
 }
 function dispatch(op,id){if(!online||running||status.busy||status.journal_error||status.recovery_required&&op!=='recover'&&op!=='report'){return;}running=true;lastError='';
  rpc('nonce','-',function(n){if(!n.ok||!n.data||!(/^[a-f0-9]{32}$/).test(n.data.key||'')){fail('Не удалось подготовить команду. Ничего не запущено.');return;}
   activeRequest={key:n.data.key,operation:op,item:id};w.__cmuManagerPendingAction=activeRequest;
   var submitted=activeRequest;rpc(op,id,function(r){if(disposed||activeRequest!==submitted){return;}if(!r.ok||!r.submission||!r.submission.job||r.submission.job.request!==submitted.key){queue=[];lastError='Команда не подтверждена. Проверяем журнал; повторный запуск не выполняется.';render();return;}
    if(r.data){status=r.data;}waitingJob=r.submission.job.sequence;render();
   },activeRequest.key);
  });render();
 }
 function nextInstall(){if(!queue.length){running=false;waitingJob=0;selected={};refreshData();render();return;}var id=queue.shift();running=false;dispatch('install',id);}
 function doInstall(){var ids=[],k;for(k in selected){if(Object.prototype.hasOwnProperty.call(selected,k)&&selected[k]){ids.push(k);}}if(!ids.length){return;}confirm('Установить выбранные пакеты?',ids.length+' пакет(а). Сначала будут проверены совместимость и исходные файлы. '+(status&&status.mode==='ram-lab'?'Изменится только временная копия.':'Изменения будут применены по очереди.'),function(){queue=ids;nextInstall();});}
 function render(){if(disposed||dialog){return;}var previous=focus;buttons=[];clear(body);clear(footer);badge.textContent=online?(status&&status.mode==='ram-lab'?'Временная копия':'CMU подключена'):'Сервис не подключён';badge.className=online?'badge online':'badge';if(status&&status.journal_error){badge.textContent='Журнал недоступен';}else if(status&&status.recovery_required){badge.textContent='Требуется восстановление';}
  var nav=root.querySelectorAll('.cmum-nav button'),i;for(i=0;i<nav.length;i++){nav[i].className=nav[i].getAttribute('data-tab')===tab?'active':'';buttons.push(nav[i]);}
  if(!online){add('div','eyebrow','CMU NEXT',body);add('h1','','Управление с экрана',body);note('Темы, приложения, резервные копии и восстановление — в одном месте.');var box=add('div','empty',null,body);add('h2','','Ожидаем сервис CMU',box);add('p','','Для первого запуска системного сервиса пока нужен терминал. После его запуска кнопки подключатся автоматически.',box);add('p','muted','Первый запуск: sh /mnt/sda1/cmu-manager/start.sh',box);btn('Проверить подключение',poll,footer,false,'primary');btn('Инструменты CMU',tools,footer,false);}
  else if(status.journal_error){add('h1','','Журнал недоступен',body);note('Операции заблокированы. Сохранённые файлы не удаляются.');btn('Проверить журнал',poll,footer,false);
  }else if(status.recovery_required&&tab!=='reports'){add('h1','','Требуется восстановление',body);note('После ошибки или прерывания установка новых пакетов заблокирована. Восстановление отменит все известные установленные модули временной копии. Журнал сохранится.');btn('Восстановить исходные файлы',function(){confirm('Восстановить временную копию?','Будут отменены все известные установленные модули временной копии. Журнал ошибок сохранится. Автомобильная прошивка не изменится.',function(){dispatch('recover','-');});},footer,running||status.busy,'primary');
  }else if(tab==='packages'){
   add('div','eyebrow','НА ФЛЕШКЕ',body);add('h1','','Выберите, что установить',body);var filters=add('div','filters',null,body);[['all','Все'],['theme','Темы'],['app','Приложения']].forEach(function(pair){btn(pair[1],function(){filter=pair[0];render();},filters,false,filter===pair[0]?'selected':'');});
   var list=add('div','package-list',null,body),found=0;catalog.forEach(function(item){if(!item||!(/^[a-z0-9-]{1,64}$/).test(item.id)||(item.kind!=='theme'&&item.kind!=='app')||filter!=='all'&&item.kind!==filter){return;}found++;var row=btn('',function(){selected[item.id]=!selected[item.id];render();},list,blocked(),'package-row'+(selected[item.id]?' checked':''));add('span','package-icon',item.kind==='theme'?'◈':'＋',row);var text=add('span','package-text',null,row);add('strong','',item.name,text);add('small','',(item.kind==='theme'?'Тема':'Приложение')+' · '+item.version,text);add('span','check',selected[item.id]?'✓':'',row);});if(!found){add('p','empty','Совместимых пакетов в каталоге packages пока нет.',list);}btn('Обновить',refreshData,footer,blocked());btn('Установить'+(count()?' · '+count():''),doInstall,footer,!count()||blocked(),'primary');
  }else if(tab==='installed'){
   add('div','eyebrow','МОДУЛИ',body);add('h1','','Установлено',body);var rows=add('div','package-list',null,body);installed.forEach(function(item){var row=add('div','installed-row',null,rows);add('strong','',item.name,row);btn('Откатить',function(){confirm('Откатить модуль?',item.name+'. Будут восстановлены исходные файлы этой операции.',function(){dispatch('rollback',item.id);});},row,blocked());});if(!installed.length){add('p','empty','Установленных модулей пока нет.',rows);}btn('Обновить',refreshData,footer,blocked());
  }else if(tab==='backup'){
   add('div','eyebrow','ВОССТАНОВЛЕНИЕ',body);add('h1','','Резервная копия',body);note(status.mode==='ram-lab'?'Сейчас копируются четыре исходных файла временной среды. Это не образ прошивки автомобиля.':'Здесь будут доступны проверенные резервные копии.');var state=add('div','empty',null,body);add('h2','',status.backup_available?'Исходная копия создана':'Исходная копия не создана',state);add('p','',status.backup_available?'Можно вернуть временную среду к исходному состоянию.':'Создайте её до первой установки. Для каждого установленного модуля также сохраняется отдельный откат.',state);btn('Создать копию',function(){dispatch('backup','-');},footer,status.backup_available||installed.length>0||blocked(),'primary');btn('Восстановить',function(){confirm('Вернуть исходное состояние?','Установленные модули будут восстановлены через проверку исходных файлов и журнал операций.',function(){dispatch('restore','-');});},footer,!status.backup_available||blocked());
  }else{add('div','eyebrow','ЖУРНАЛ ОПЕРАЦИЙ',body);add('h1','','Отчёты',body);var jobs=add('div','job-history',null,body);history.slice().reverse().forEach(function(j){btn('#'+j.sequence+' · '+(operationLabels[j.operation]||'?')+' · '+(phaseLabels[j.phase]||'?'),function(){var name='j'+('000000'+j.sequence).slice(-6);rpc('job',name,function(r){if(r.ok&&r.data){chosenLog='#'+j.sequence+' · '+(phaseLabels[r.data.job.phase]||'?')+'\n'+r.data.log;render();}});},jobs,false);});add('pre','log',chosenLog||status.log||'Операции ещё не выполнялись.',body);btn('Обновить',function(){poll();refreshHistory();},footer,false);btn('Сохранить на USB',function(){dispatch('report','-');},footer,running||status.busy||status.journal_error);}

  if(lastError){add('p','error',lastError,body);}var progress=root.querySelector('.cmum-progress');progress.textContent=running||status&&status.busy?'Выполняется операция. Дождитесь результата.':(status&&status.job?'Последняя операция: '+(status.phase==='succeeded'?'завершена':status.phase==='interrupted'?'прервана':status.phase==='failed'?'ошибка · '+status.exit:status.phase==='accepted'?'принята':status.phase==='running'?'выполняется':'состояние уточняется'):'');
  setFocus(Math.min(previous,buttons.length-1));
 }
 function setFocus(n){var i;focus=Math.max(0,n);for(i=0;i<buttons.length;i++){buttons[i].className=buttons[i].className.replace(/\s?commander-focus/g,'')+(i===focus?' commander-focus':'');}if(buttons[focus]&&buttons[focus].scrollIntoView){try{buttons[focus].scrollIntoView(false);}catch(e){}}}
 function move(direction){var n=focus+direction;while(n>=0&&n<buttons.length){if(!buttons[n].disabled){setFocus(n);return;}n+=direction;}}
 function back(){if(dialog){remove(dialog);dialog=null;render();return;}if(tab!=='packages'){tab='packages';render();return;}unmount();}
 function input(event){if(!canInput()){return false;}if(event==='cw'||event==='down'){move(1);return true;}if(event==='ccw'||event==='up'){move(-1);return true;}if(event==='select'){if(buttons[focus]&&!buttons[focus].disabled){buttons[focus].onclick();}return true;}if(event==='goBack'){back();return true;}return false;}
 function guard(){var f=w.framework;if(suspended){root.style.display='none';return;}try{if(f&&typeof f.getCurrentApp==='function'){var a=f.getCurrentApp(),c=f.common,v=c&&c._cachedVuiState;var t=f._currTmpltInstance;var blocked=!!(t&&t.properties&&t.properties.isDialog)||a==='diag'||a==='backupparking'||a==='carplay'||a==='androidauto'||a==='phone'||c&&(c.cmnCtrlsDisabled||c._vuiHelpDialog||c._vuiExamplesDialog||v&&v!=='Idle'&&v!=='Not Ready'&&v!=='Playing Out of Session Alert');root.style.display=blocked?'none':'block';}}catch(e){root.style.display='none';}}
 function poll(){if(disposed){return;}guard();loadConfig();rpc('status','-',function(r){if(disposed){return;}if(!r.ok||!r.data){if(r.error==='journal-unavailable'){online=true;status=status||{mode:'ram-lab',busy:false,job:0};status.journal_error=true;queue=[];}else{online=false;if(activeRequest){queue=[];lastError='Связь потеряна. Результат команды будет проверен по журналу.';}}render();return;}suspended=false;var was=online;online=true;status=r.data;if(!was){refreshData();}resolveAction();render();});}
 function tools(){var f=w.framework;if(!f||typeof f.sendEventToMmui!=='function'){lastError='Штатные инструменты доступны только на CMU.';render();return;}suspended=true;root.style.display='none';f.sendEventToMmui('syssettings','SelectDiagnostics');timers.push(w.setTimeout(function(){if(disposed){return;}f.sendEventToMmui('diag','ActivateJCITest');timers.push(w.setTimeout(function(){if(!disposed){f.sendEventToMmui('diag','ReadDTC',{payload:{testId:11}});}},7000));},7000));}
 function key(e){if(input(e.keyCode===40?'down':e.keyCode===38?'up':e.keyCode===13?'select':e.keyCode===27?'goBack':'')){e.preventDefault();}}
 function unmount(){if(disposed){return;}disposed=true;var k;for(k in pending){if(Object.prototype.hasOwnProperty.call(pending,k)){finishRequest(k);}}for(var i=0;i<timers.length;i++){w.clearTimeout(timers[i]);}w.clearInterval(interval);d.removeEventListener('keydown',key,false);if(bridge&&bridge.common.handleControllerEvent===bridge.wrapper){if(bridge.own){bridge.common.handleControllerEvent=bridge.original;}else{delete bridge.common.handleControllerEvent;}}remove(root);remove(style);if(w.__cmuManagerReply===reply){delete w.__cmuManagerReply;}delete w.__cmuManagerUnmount;}
 var reply=w.__cmuManagerReply;
 style=add('style','',null,d.head||d.body);style.textContent='@@css@@';
 root=add('div','',null,d.body);root.id='cmu-manager';var header=add('div','cmum-header',null,root);add('strong','brand','cmu next',header);badge=add('span','badge','Подключение…',header);var close=add('button','exit','Вернуться к Mazda',header);close.onclick=unmount;
 var nav=add('div','cmum-nav',null,root);['packages','installed','backup','reports'].forEach(function(id){var b=add('button','',labels[id],nav);b.type='button';b.setAttribute('data-tab',id);b.onclick=function(){if(canInput()&&!dialog){tab=id;render();}};});
 body=add('div','cmum-body',null,root);footer=add('div','cmum-footer',null,root);add('div','cmum-progress','',root);
 var f=w.framework,common=f&&f.common;if(common&&typeof common.handleControllerEvent==='function'){bridge={common:common,original:common.handleControllerEvent,own:Object.prototype.hasOwnProperty.call(common,'handleControllerEvent'),wrapper:null};bridge.wrapper=function(event,first){guard();if(!first&&input(event)){return;}return bridge.original.apply(this,arguments);};common.handleControllerEvent=bridge.wrapper;}
 d.addEventListener('keydown',key,false);w.__cmuManagerUnmount=unmount;render();poll();var interval=w.setInterval(poll,2000);
})(window,document);
