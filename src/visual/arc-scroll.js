 // Read-only presentation of the active v74 List2 control. Native data/actions are untouched.
 var arcView=null,arcFailureControl=null,arcFailureWrapper=null;
 function releaseArc(){
  var a=arcView;arcView=null;
  if(!a){return;}
  if(a.wrapper&&a.wrapper.classList){a.wrapper.classList.remove('cmu-next-arc-scroll-owned');}
  if(a.canvas&&a.canvas.parentNode){a.canvas.parentNode.removeChild(a.canvas);}
 }
 function arcPoint(t){var angle=-Math.PI/2+Math.PI*t;return [54+54*Math.cos(angle),178+178*Math.sin(angle)];}
 function arcEase(x){x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);}
 function paintArc(a,index,total){
  var ctx=a.ctx,length=.86*Math.max(.10,Math.min(.40,2/total));
  var progress=total>1?index/(total-1):.5,start=.07+progress*(.86-length),end=start+length;
  var pass,i,u,v,p,q,strength;
  ctx.clearRect(0,0,216,712);ctx.save();ctx.scale(2,2);ctx.lineCap='round';
  for(pass=0;pass<2;pass++){
   for(i=0;i<100;i++){
    u=i/100;v=(i+1)/100;
    strength=arcEase(Math.min((u+v)/2,1-(u+v)/2)/.26);
    p=arcPoint(start+length*u);q=arcPoint(start+length*v);
    ctx.beginPath();ctx.moveTo(p[0],p[1]);ctx.lineTo(q[0],q[1]);
    ctx.strokeStyle='rgba(255,255,255,'+(strength*(pass===0?.025:.88))+')';
    ctx.lineWidth=pass===0?10:1+4*strength;
    ctx.shadowColor='rgba(255,255,255,'+(strength*.32)+')';ctx.shadowBlur=pass===0?7:2;
    ctx.stroke();
   }
  }
  ctx.restore();
  // Diagnostic values belong only to our own canvas, never the native control.
  a.canvas.cmuArcPosition={index:index,total:total,progress:progress,start:start,end:end};
 }
 function syncArc(control){
  try{
   var data=control&&control.dataList,props=control&&control.properties;
   var wrapper=control&&control.scrollIndicatorWrapper,index=control&&control.focussedItem;
   var total=data&&data.itemCount;
   var valid=control&&data&&props&&props.showScrollIndicator===true&&data.itemCountKnown===true&&
    typeof total==='number'&&isFinite(total)&&total>0&&Math.floor(total)===total&&
    typeof index==='number'&&isFinite(index)&&Math.floor(index)===index&&index>=0&&index<total&&
    wrapper&&wrapper.classList&&wrapper.parentNode&&control.divElt&&control.divElt.parentNode;
   if(valid&&d.body.contains&&!d.body.contains(control.divElt)){valid=false;}
   if(!valid){releaseArc();arcFailureControl=null;arcFailureWrapper=null;return;}
   if(arcView&&(arcView.control!==control||arcView.wrapper!==wrapper)){releaseArc();}
   if(arcFailureControl===control&&arcFailureWrapper===wrapper){return;}
   arcFailureControl=null;arcFailureWrapper=null;
   if(!arcView){
    var a={control:control,wrapper:wrapper,canvas:d.createElement('canvas'),ctx:null,key:null};
    arcView=a;a.canvas.className='cmu-next-arc-scroll';a.canvas.width=216;a.canvas.height=712;
    a.canvas.setAttribute('aria-hidden','true');
    a.ctx=a.canvas.getContext?a.canvas.getContext('2d'):null;
    if(!a.ctx){arcFailureControl=control;arcFailureWrapper=wrapper;releaseArc();return;}
    d.body.appendChild(a.canvas);
   }
   var key=index+'/'+total;
   if(arcView.key!==key){paintArc(arcView,index,total);arcView.key=key;}
   // Hide the native rail only after a valid thumb has been successfully drawn.
   wrapper.classList.add('cmu-next-arc-scroll-owned');
  }catch(arcFailure){if(arcView){arcFailureControl=control;arcFailureWrapper=wrapper;}releaseArc();}
 }
