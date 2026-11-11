'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const code=fs.readFileSync(path.join(__dirname,'../src/apps/runtime.js'),'utf8');
function fixture(){
 const errors=[],inputs=[],speeds=[],timers=new Map();let enabled=true,time=10000,next=0,caps=true,removed=0;
 function node(){const listeners=new Map();return {children:[],parentNode:null,className:'',setAttribute(){},appendChild(c){this.children.push(c);c.parentNode=this;},removeChild(c){this.children.splice(this.children.indexOf(c),1);c.parentNode=null;},addEventListener(e,fn){listeners.set(e,fn);},removeEventListener(e,fn){if(listeners.get(e)===fn)listeners.delete(e);},listeners};}
 const root=node(),native=node();root.appendChild(native);
 const host={hasCapability:()=>caps,inputEnabled:()=>enabled,subscribeInput(fn){inputs.push(fn);return ()=>{removed++;};},subscribeSpeed(fn){speeds.push(fn);return ()=>{removed++;};}};
 const w={setInterval(fn){timers.set(++next,fn);return next;},clearInterval(id){timers.delete(id);}},ctx=vm.createContext({});vm.runInContext(code,ctx);
 const runtime=new ctx.CmuAppRuntime({window:w,document:{createElement:node},root,host,now:()=>time,onError:e=>errors.push(e.message)});
 return {runtime,host,root,native,errors,inputs,speeds,timers,node,removed:()=>removed,enable:v=>enabled=v,caps:v=>caps=v,time:v=>time=v};
}
const manifest=id=>({id,title:id,version:'0.1.0'});let groups=0;
function test(name,fn){fn();groups++;console.log('PASS '+name);}
test('registration and missing capabilities do not replace an active app',()=>{
 const q=fixture();q.runtime.register(manifest('first'),()=>({}));assert(q.runtime.open('first'));
 q.runtime.register({...manifest('speed'),requiredCapabilities:['vehicle-speed']},()=>({}));q.caps(false);assert.equal(q.runtime.open('speed'),false);assert.equal(q.runtime.snapshot().active,'first');
 assert.throws(()=>q.runtime.register(manifest('first'),()=>({})));assert.throws(()=>q.runtime.register({...manifest('bad'),requiredCapabilities:['shell']},()=>({})));
});
test('closing releases input, speed, listeners and timers without removing native DOM',()=>{
 const q=fixture();let updates=0,closed=0,owned;
 q.runtime.register(manifest('first'),c=>{owned=c.view;c.listen(c.view,'click',()=>updates++);c.interval(()=>updates++,100);c.subscribeSpeed(()=>updates++);return {onClose(){closed++;}};});
 assert(q.runtime.open('first'));const lateInput=q.inputs[0],lateSpeed=q.speeds[0],lateTimer=[...q.timers.values()][0];q.runtime.close();
 assert.equal(q.root.children.length,1);assert.equal(q.root.children[0],q.native);assert.equal(owned.listeners.size,0);assert.equal(q.timers.size,0);assert.equal(q.removed(),2);assert.equal(closed,1);
 lateInput('select');lateSpeed({value:20,unit:'km/h',source:'demo',timestamp:10000});lateTimer();assert.equal(updates,0);q.runtime.close();assert.equal(closed,1);
});
test('unhandled events delegate; native input lock and back are honored',()=>{
 const q=fixture();let input=0;q.runtime.register(manifest('app'),()=>({onInput(e){input++;return e==='select';}}));q.runtime.open('app');const send=q.inputs[0];
 assert.equal(send('cw'),false);assert.equal(send('select'),true);q.enable(false);assert.equal(send('goBack'),false);assert.equal(input,2);assert.equal(q.runtime.snapshot().active,'app');q.enable(true);assert.equal(send('goBack'),true);assert.equal(q.runtime.snapshot().active,null);
});
test('replacement makes old subscriptions inert',()=>{
 const q=fixture();let old=0;q.runtime.register(manifest('old'),c=>{c.subscribeSpeed(()=>old++);return {};});q.runtime.register(manifest('new'),()=>({}));q.runtime.open('old');const callback=q.speeds[0];q.runtime.open('new');callback({value:20,unit:'km/h',source:'demo',timestamp:10000});assert.equal(old,0);assert.equal(q.runtime.snapshot().active,'new');
});
test('factory and callback failures tear down owned resources',()=>{
 const q=fixture();q.runtime.register(manifest('bad'),c=>{c.interval(()=>{},100);throw Error('init failed');});assert.equal(q.runtime.open('bad'),false);assert.equal(q.timers.size,0);assert.equal(q.root.children.length,1);
 q.runtime.register(manifest('callback'),()=>({onInput(){throw Error('input failed');}}));q.runtime.open('callback');q.inputs.at(-1)('select');assert.equal(q.runtime.snapshot().active,null);assert.equal(q.root.children.length,1);assert.equal(q.errors.length,2);
});
test('speed validation preserves real zero but rejects stale, future and malformed data',()=>{
 const q=fixture();let normalize;q.runtime.register(manifest('app'),c=>{normalize=c.normalizeSpeed;return {};});q.runtime.open('app');
 const base={value:0,unit:'km/h',source:'vehicle',timestamp:10000};assert.equal(normalize(base).value,0);
 for(const change of [{value:NaN},{value:-1},{value:401},{unit:'mph'},{source:'unknown'},{timestamp:7999},{timestamp:10251}])assert.equal(normalize({...base,...change}),null);
 assert.equal(normalize(null),null);q.time(13000);assert.equal(normalize(base),null);
});
test('synchronous close during factory and failing host capability queries do not leak',()=>{
 const q=fixture();let closed=0;q.runtime.register(manifest('immediate'),c=>{c.interval(()=>{},100);c.close();return {onClose(){closed++;}};});
 assert.equal(q.runtime.open('immediate'),false);assert.equal(closed,1);assert.equal(q.timers.size,0);assert.equal(q.root.children.length,1);
 q.runtime.register(manifest('normal'),()=>({}));q.runtime.open('normal');q.runtime.register({...manifest('speed'),requiredCapabilities:['vehicle-speed']},()=>({}));q.host.hasCapability=()=>{throw Error('unavailable host');};
 assert.equal(q.runtime.open('speed'),false);assert.equal(q.runtime.snapshot().active,'normal');
});
test('destroy prevents reopening and resource cleanup remains idempotent',()=>{
 const q=fixture();q.runtime.register(manifest('app'),()=>({}));q.runtime.open('app');q.runtime.destroy();q.runtime.destroy();assert.equal(q.runtime.open('app'),false);assert.throws(()=>q.runtime.register(manifest('next'),()=>({})));assert.equal(q.root.children.length,1);
});
console.log(JSON.stringify({lifecycle_groups_passed:groups,native_bridge_verified:false}));
