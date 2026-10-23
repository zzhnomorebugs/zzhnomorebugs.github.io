(function () {
  'use strict';
  var NS='http://www.w3.org/2000/svg', STEPS=24, VECTOR_LENGTH=0.38, L_WIDTH=0.76;
  var palette={ink:'#26333b',muted:'#68777d',green:'#719a4e',blue:'#357bb7',orange:'#ed913a',red:'#b72828'};
  var clamp=function(x){return Math.max(0,Math.min(1,x));};
  var ease=function(x){x=clamp(x);return x*x*(3-2*x);};
  var lerp=function(a,b,t){return a+(b-a)*t;};
  var dot=function(a,b){return a.reduce(function(s,x,i){return s+x*b[i];},0);};
  var normalize=function(v){var norm=Math.hypot.apply(null,v);return v.map(function(x){return x/norm;});};
  var cross=function(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];};
  function rotate(v){var a=-0.42,c=Math.cos(a),s=Math.sin(a);return[c*v[0]-s*v[1],s*v[0]+c*v[1],v[2]];}
  // Equal display lengths let Shift apply the same-sized arrow in L. The bounded
  // walk remains illustrative: real reverse-diffusion steps need not be equal.
  var coordinateWalk=[[0.28,0]];
  for(var step=0;step<STEPS;step++){
    var previous=coordinateWalk[step],dy=0.09+0.17*Math.sin(step*2.31)+0.045*Math.sin(step*5.7);
    var dx=Math.sqrt(VECTOR_LENGTH*VECTOR_LENGTH-dy*dy),sign=Math.sin(step*1.72+0.8)>0?1:-1;
    if(previous[0]+sign*dx<0||previous[0]+sign*dx>L_WIDTH)sign=-sign;
    coordinateWalk.push([previous[0]+sign*dx,previous[1]+dy]);
  }
  var coordinateHeight=Math.max.apply(null,coordinateWalk.map(function(p){return p[1];}));
  // A common sample index drives the three schematic trajectories.
  // These are explanatory paths, not a trained model rollout.
  var states=Array.from({length:STEPS+1},function(_,i){
    var u=i/STEPS,e=Math.sin(Math.PI*u)*Math.pow(1-u,0.35);
    var x=-0.58+1.12*u+e*(0.17*Math.sin(31*u)+0.075*Math.sin(79*u));
    var y=-0.53+1.05*u+e*(0.15*Math.sin(43*u+0.5)+0.055*Math.sin(97*u));
    var m=[x,y,Math.sqrt(1-x*x-y*y)];
    return {l:coordinateWalk[i],m:m,n:rotate(m)};
  });
  // Tangents in the illustrative sphere chart, NOT the paper's sampling operator.
  // p.v=0 and normalize(p+v)=q, so each displayed small step joins the next state.
  function tangent(p,q){var d=dot(p,q);return q.map(function(x,i){return x/d-p[i];});}
  function between(a,b,t){return a.map(function(x,i){return lerp(x,b[i],t);});}
  // Rotate the whole illustrative sphere chart, rather than relocating one point.
  function inspectionRotation(p,q){
    var d=normalize(tangent(p,q)),rho=0.82,z=Math.sqrt(1-rho*rho),h=Math.SQRT1_2;
    var targetP=[rho*h,-rho*h,z],targetD=[z*h,-z*h,-rho];
    var source=[p,d,cross(p,d)],target=[targetP,targetD,cross(targetP,targetD)];
    var m=[0,1,2].map(function(i){return[0,1,2].map(function(j){return target.reduce(function(sum,column,k){return sum+column[i]*source[k][j];},0);});});
    var trace=m[0][0]+m[1][1]+m[2][2],s,rotation;
    if(trace>0){s=2*Math.sqrt(trace+1);rotation=[(m[2][1]-m[1][2])/s,(m[0][2]-m[2][0])/s,(m[1][0]-m[0][1])/s,s/4];}
    else if(m[0][0]>m[1][1]&&m[0][0]>m[2][2]){s=2*Math.sqrt(1+m[0][0]-m[1][1]-m[2][2]);rotation=[s/4,(m[0][1]+m[1][0])/s,(m[0][2]+m[2][0])/s,(m[2][1]-m[1][2])/s];}
    else if(m[1][1]>m[2][2]){s=2*Math.sqrt(1+m[1][1]-m[0][0]-m[2][2]);rotation=[(m[0][1]+m[1][0])/s,s/4,(m[1][2]+m[2][1])/s,(m[0][2]-m[2][0])/s];}
    else{s=2*Math.sqrt(1+m[2][2]-m[0][0]-m[1][1]);rotation=[(m[0][2]+m[2][0])/s,(m[1][2]+m[2][1])/s,s/4,(m[1][0]-m[0][1])/s];}
    rotation=normalize(rotation);return rotation[3]<0?rotation.map(function(x){return-x;}):rotation;
  }
  function rotationAt(q,amount){
    var angle=Math.acos(clamp(q[3]));
    if(angle<1e-7)return[0,0,0,1];
    var factor=Math.sin(angle*amount)/Math.sin(angle);
    return[q[0]*factor,q[1]*factor,q[2]*factor,Math.cos(angle*amount)];
  }
  function rotateBy(v,q){var u=q.slice(0,3),uv=cross(u,v),uuv=cross(u,uv);return v.map(function(x,i){return x+2*(q[3]*uv[i]+uuv[i]);});}
  var inspectionRotations=states.slice(0,STEPS).map(function(state,i){return{m:inspectionRotation(state.m,states[i+1].m),n:inspectionRotation(state.n,states[i+1].n)};});
  var words={
    zh:{title:'一次去噪更新在三个空间中的传递',desc:'等大的绿球与蓝球分别表示 N 和 M。三条对应轨迹共享时间进度：模型读取距离，预测橙色切向量，转换为绿色流形的红色切向量，再经 Shift 更新灰色坐标空间。',
      coordinates:'坐标空间',representatives:'谱坐标代表',distances:'距离流形',model:'模型预测',transform:'切空间之间的局部转换',recompute:'重新计算距离',
      play:'播放去噪全程',pause:'暂停全程',slow:'慢放当前小步',slowPause:'暂停小步',resume:'继续去噪',slowResume:'继续小步',replay:'重播去噪全程',full:'整体去噪',
      statuses:['模型读入当前距离 dₛ；三个亮点表示同一时刻在 L、N、M 中的对应状态。','模型给出距离侧的变化，橙色向量从 dₛ 出发，位于蓝色流形的切平面。','把橙色距离向量局部转换为 N 的切向量；红色向量从 φ(dₛ) 出发。','通过 Shift 转回当前坐标代表，得到 Cₛ → Cₜ；三个状态同步走到下一步。'],
      done:'三条对应轨迹同步到达终点：C₀、φ(d₀) 与 d₀。可拖动整体进度，慢放任意一个小步。'},
    en:{title:'One denoising update across three spaces',desc:'Equal-sized green and blue spheres depict N and M. Three corresponding paths share one time index: read distances, predict the orange tangent, transform it to the red tangent on N, then Shift the update into the gray coordinate space.',
      coordinates:'Coordinates',representatives:'Spectral representatives',distances:'Distance manifold',model:'Model prediction',transform:'Local tangent conversion',recompute:'Recompute distances',
      play:'Play denoising',pause:'Pause denoising',slow:'Slow down this step',slowPause:'Pause step',resume:'Resume denoising',slowResume:'Resume step',replay:'Replay denoising',full:'Full denoising',
      statuses:['The model reads dₛ. The three highlighted points are corresponding states in L, N and M.','Predict the distance change: the orange vector starts at dₛ in the blue manifold’s tangent plane.','Locally transform the orange distance vector into a tangent on N; the red vector starts at φ(dₛ).','Shift back to the current coordinate representative: Cₛ → Cₜ. All three states advance together.'],
      done:'All three paths reach their endpoints together: C₀, φ(d₀) and d₀. Scrub the full trajectory to inspect any individual step.'}
  };
  function init(root,instance){
    if(root.dataset.mappingReady)return;
    var w=words[root.dataset.language==='en'?'en':'zh'];
    var story=root.dataset.language==='en'?{
      overview:'Follow the denoising trajectory',overviewCaption:'Three corresponding states move together from T to 0.',
      focus:'Pause at one small step',focusCaption:'The highlighted segments are the same s → t update in three spaces.',
      detail:'Zoom in: how this step is made',detailCaption:'Read distances, predict the direction, map between tangent spaces, then Shift.',
      returning:'Return to the full trajectory',returnCaption:'The local mapping is complete. Continue from the updated states.',
      resumed:'Continue denoising',resumeCaption:'The same update repeats along the remaining trajectory.',
      done:'The denoising trajectory is complete',doneCaption:'All three states have reached time 0.',
      play:'Play animation',pause:'Pause',resume:'Continue',replay:'Replay animation',inspect:'Inspect this step',inspecting:'Inspecting this step',
      walking:'Follow the three synchronized paths. The animation will pause to explain one small step.',
      focusing:'The paths pause here. Highlight the next corresponding segment in L, N and M.',
      zooming:'Rotate the view of the same states so the local update appears at the upper right of each sphere.',
      returningStatus:'This mapping has advanced all three states by one step. Zoom out and continue the same paths.',
      resumedStatus:'Resume from the updated states, repeating the same local mapping until time 0.'
    }:{
      overview:'先看整体去噪轨迹',overviewCaption:'三个空间中的对应状态，从 T 到 0 同步游走。',
      focus:'暂停在这一小步',focusCaption:'圈出的三段曲线，对应同一次 s → t 更新。',
      detail:'放大：这一小步是怎么走的',detailCaption:'读入距离、预测方向、转换切空间，再通过 Shift 更新坐标。',
      returning:'回到整体轨迹',returnCaption:'局部映射已完成，从更新后的三个状态继续。',
      resumed:'继续整体去噪',resumeCaption:'沿着剩余轨迹，重复同样的单步更新。',
      done:'去噪轨迹完成',doneCaption:'三个空间中的状态已同步到达时间 0。',
      play:'播放动画',pause:'暂停',resume:'继续播放',replay:'重新播放',inspect:'放大当前小步',inspecting:'正在讲解小步',
      walking:'先观察三条同步游走的轨迹；稍后会自动暂停，放大其中的一小步。',
      focusing:'三个空间在同一时刻暂停。圈出的下一小段，是即将展开的 s → t 更新。',
      zooming:'保持状态对应关系，转动观察角度，在球体右上侧放大这次局部更新。',
      returningStatus:'这次 mapping 已让三个状态同步前进一步。缩回整体视图，接着沿原轨迹去噪。',
      resumedStatus:'从刚才更新后的状态继续游走，重复同样的局部映射，直到时间 0。'
    };
    var scene=root.querySelector('[data-mapping-scene]'),controls=root.querySelector('[data-mapping-controls]'),formula=root.querySelector('[data-mapping-formula]');
    var recomputeFormula=root.querySelector('[data-mapping-recompute-formula]');
    var play=root.querySelector('[data-mapping-play]'),slow=root.querySelector('[data-mapping-step-play]'),restart=root.querySelector('[data-mapping-restart]');
    var slider=root.querySelector('[data-mapping-progress]'),counter=root.querySelector('[data-mapping-counter]'),status=root.querySelector('[data-mapping-status]');
    if(!scene||!play||!slow||!slider)return;
    var id='se3-map-'+instance+'-',refs={},layout,displayStates=states;
    var reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
    var index=0,phase=0,playing=false,raf=0,last=0,announced='';
    var view='overview',walkPosition=0,viewTime=0,inspectAt=8,inspected=false;
    var autoplayStarted=false,visible=false,resumeOnVisible=false,userPaused=false;
    var readDuration=1750,stageDuration=3500,walkStepDuration=300,resumeStepDuration=200,focusDuration=550,zoomInDuration=600,recomputeHoldDuration=1000,zoomOutDuration=1200;
    var fps=60,frame=0,playhead=0;
    function frames(ms){return Math.round(ms*fps/1000);}
    function timelineBounds(){
      var focus=inspectAt*frames(walkStepDuration),zoomIn=focus+frames(focusDuration),detail=zoomIn+frames(zoomInDuration);
      var predict=detail+frames(readDuration),convert=predict+frames(stageDuration),shift=convert+frames(stageDuration);
      var hold=shift+frames(stageDuration),zoomOut=hold+frames(recomputeHoldDuration),resume=zoomOut+frames(zoomOutDuration);
      return{focus:focus,zoomIn:zoomIn,detail:detail,predict:predict,convert:convert,shift:shift,hold:hold,zoomOut:zoomOut,resume:resume,total:resume+(STEPS-inspectAt-1)*frames(resumeStepDuration)};
    }
    function el(tag,attrs,parent,text){
      var node=document.createElementNS(NS,tag);
      Object.keys(attrs||{}).forEach(function(key){node.setAttribute(key,attrs[key]);});
      if(text!==undefined)node.textContent=text;
      (parent||refs.world||refs.svg).appendChild(node);return node;
    }
    function label(x,y,text,attrs,parent){
      return el('text',Object.assign({x:x,y:y,fill:palette.ink,'font-size':17,'text-anchor':'middle',class:'se3-map-label'},attrs||{}),parent,text);
    }
    function math(x,y,main,sub,parent,attrs){
      var node=label(x,y,main,Object.assign({class:'se3-map-math','font-size':25},attrs||{}),parent);
      if(sub)el('tspan',{'baseline-shift':'sub','font-size':'70%'},node,sub);
      return node;
    }
    function phi(x,y,sub,parent,attrs){var node=math(x,y,'φ(d',sub,parent,attrs);el('tspan',{},node,')');return node;}
    function arrow(color,parent,dashed){
      return el('path',{d:'M0 0L0 0',fill:'none',stroke:palette[color],'stroke-width':3.1,'stroke-linecap':'round','stroke-dasharray':dashed?'5 5':'none','marker-end':'url(#'+id+color+')'},parent);
    }
    function move(node,p){node.setAttribute('cx',p[0]);node.setAttribute('cy',p[1]);}
    function pointLabel(node,p,dx,dy){node.setAttribute('x',p[0]+dx);node.setAttribute('y',p[1]+dy);}
    function opacity(node,v){node.setAttribute('opacity',clamp(v));}
    function line(node,p,q){node.setAttribute('d','M'+p.join(' ')+' L'+q.join(' '));}
    function pathData(points){return points.map(function(p,i){return(i?'L':'M')+p.map(function(x){return x.toFixed(2);}).join(' ');}).join(' ');}
    function project(v,center){return[center[0]+layout.r*v[0],center[1]+layout.r*v[1]];}
    function lPoint(v){return[layout.l[0]+(layout.l[2]-L_WIDTH*layout.r)/2+layout.r*v[0],layout.l[1]+(layout.l[3]-coordinateHeight*layout.r)/2+layout.r*v[1]];}
    function sphere(center,color,name,description){
      var group=el('g');
      el('circle',{cx:center[0],cy:center[1],r:layout.r,fill:'url(#'+id+color+'-sphere)',stroke:palette[color],'stroke-width':1.6,'stroke-opacity':0.6,'data-manifold':name},group);
      [0,1].forEach(function(front){el('path',{d:'M'+(center[0]-layout.r)+' '+center[1]+' A'+layout.r+' '+layout.r*.22+' 0 0 '+front+' '+(center[0]+layout.r)+' '+center[1],fill:'none',stroke:palette[color],opacity:0.32,'stroke-dasharray':front?'4 4':'none'},group);});
      var nameLabel=math(center[0],center[1]+layout.r+31,name,'',group,{fill:palette[color]});
      var descriptionLabel=label(center[0],center[1]+layout.r+54,description,{fill:palette[color],'font-size':16},group);
      return{name:nameLabel,description:descriptionLabel};
    }
    function trail(key,color,center){
      var points=displayStates.map(function(state){return key==='l'?lPoint(state.l):project(state[key],center);}),group=el('g');
      var whole=el('path',{d:pathData(points),fill:'none',stroke:palette[color],'stroke-width':1.5,opacity:0.22,'stroke-linejoin':'round','data-trajectory':key},group);
      var completed=el('path',{fill:'none',stroke:palette[color],'stroke-width':2.3,'stroke-linejoin':'round','stroke-linecap':'round'},group);
      var segment=el('path',{fill:'none',stroke:palette[color],'stroke-width':4.5,'stroke-linecap':'round',opacity:0.65},group);
      var start=el('circle',{r:4.2,fill:palette[color]},group);move(start,points[0]);
      var end=el('circle',{r:4.2,fill:'#fff',stroke:palette[color],'stroke-width':1.6},group);move(end,points[STEPS]);
      var current=el('circle',{r:6,fill:palette[color],stroke:'#fff','stroke-width':1.8,'data-state-point':key},group);
      var target=el('circle',{r:4.2,fill:'#fff',stroke:palette[color],'stroke-width':1.5},group);
      var startLabel,endLabel,currentLabel,targetLabel;
      if(key==='n'){
        startLabel=phi(points[0][0]-12,points[0][1]-16,'T',group,{'text-anchor':'end','font-size':21,fill:palette[color]});
        endLabel=phi(points[STEPS][0]+12,points[STEPS][1]+19,'0',group,{'text-anchor':'start','font-size':21,fill:palette[color]});
        currentLabel=phi(0,0,'s',group,{'text-anchor':'end','font-size':22,fill:palette[color]});
        targetLabel=phi(0,0,'t',group,{'text-anchor':'start','font-size':22,fill:palette[color]});
      }else{
        var symbol=key==='l'?'𝒞':'d';
        startLabel=math(points[0][0]-12,points[0][1]-17,symbol,'T',group,{'text-anchor':'end',fill:palette[color]});
        endLabel=math(points[STEPS][0]+12,points[STEPS][1]+20,symbol,'0',group,{'text-anchor':'start',fill:palette[color]});
        currentLabel=math(0,0,symbol,'s',group,{'text-anchor':'end',fill:palette[color]});
        targetLabel=math(0,0,symbol,'t',group,{'text-anchor':'start',fill:palette[color]});
      }
      var focus=el('circle',{r:23,fill:'none',stroke:palette[color],'stroke-width':1.4,'stroke-dasharray':'4 4',opacity:0},group);
      var nextSegment=el('path',{fill:'none',stroke:palette[color],'stroke-width':4.5,'stroke-linecap':'round',opacity:0},group);
      return{points:points,whole:whole,completed:completed,segment:segment,start:start,end:end,current:current,target:target,currentLabel:currentLabel,targetLabel:targetLabel,startLabel:startLabel,endLabel:endLabel,focus:focus,nextSegment:nextSegment};
    }
    function tangentPlane(color){
      var group=el('g');
      var plane=el('polygon',{fill:color==='orange'?'#ffe0af':'#f1c3c3','fill-opacity':0.62,stroke:palette[color],'stroke-width':1.6},group);
      var grid=el('path',{fill:'none',stroke:palette[color],'stroke-width':0.8,opacity:0.3},group);
      var gap=el('path',{fill:'none',stroke:palette.muted,'stroke-width':1.4,'stroke-dasharray':'3 4','data-tangent-gap':color==='orange'?'m':'n'},group);
      var surface=el('circle',{r:3.4,fill:'#fff',stroke:palette.muted,'stroke-width':1.3},group);
      var contact=el('circle',{r:4.8,fill:palette[color],stroke:'#fff','stroke-width':1.5},group);
      var halo=el('path',{fill:'none',stroke:'#fff','stroke-width':6,'stroke-linecap':'round',opacity:0.8},group);
      var vector=arrow(color,group),vectorLabel=math(0,0,'v',color==='orange'?'M':'N',group,{fill:palette[color],'font-size':24,'text-anchor':'start'});
      vector.setAttribute('data-tangent-vector',color==='orange'?'m':'n');
      vector.setAttribute('stroke-width',3.8);
      return{group:group,plane:plane,grid:grid,contact:contact,halo:halo,gap:gap,surface:surface,vector:vector,label:vectorLabel};
    }
    function planeGeometry(ref,p,q,center,amount){
      var v=tangent(p,q),direction=normalize(v),other=normalize(cross(p,direction));
      // At the inspection angle the tip reaches 1.2 radii. Normalize its
      // screen projection so camera rotation preserves the visible length;
      // scalar rescaling still preserves tangency (p.v=0).
      var extent=VECTOR_LENGTH/Math.hypot(direction[0],direction[1]);
      function onPlane(along,across){return project(p.map(function(x,i){return x+along*direction[i]+across*other[i];}),center);}
      var corners=[[-0.13,-0.18],[extent+0.08,-0.18],[extent+0.08,0.18],[-0.13,0.18]].map(function(pair){return onPlane(pair[0],pair[1]);});
      ref.plane.setAttribute('points',corners.map(function(x){return x.join(',');}).join(' '));
      ref.grid.setAttribute('d',[0.25,0.5,0.75].map(function(f){return pathData([onPlane(extent*f,-0.18),onPlane(extent*f,0.18)]);}).join(' '));
      var start=project(p,center),lifted=p.map(function(x,i){return x+amount*extent*direction[i];}),tip=project(lifted,center);
      move(ref.contact,start);line(ref.halo,start,tip);opacity(ref.halo,amount>0?0.8:0);
      line(ref.vector,start,tip);opacity(ref.vector,amount>0?1:0);ref.vector.setAttribute('data-vector-progress',amount.toFixed(4));
      // This unarrowed guide measures the geometric gap, not an extra mapping.
      var foot=project(normalize(lifted),center);line(ref.gap,foot,tip);move(ref.surface,foot);
      opacity(ref.gap,ease((amount-0.25)/0.5));opacity(ref.surface,ease((amount-0.25)/0.5));
      ref.label.setAttribute('text-anchor','end');
      pointLabel(ref.label,start,-22,-26);opacity(ref.label,amount>0.8?1:0);
      var shaft=onPlane(extent*0.7,0),screenDirection=normalize([direction[0],direction[1]]);
      return{start:start,tip:tip,shaft:shaft,approach:[shaft[0]+screenDirection[1]*50,shaft[1]-screenDirection[0]*50],direction:screenDirection,bottom:Math.max.apply(null,corners.map(function(c){return c[1];}))};
    }
    function build(){
      var c=scene.clientWidth<720;
      // Exactly the same radius for N and M in either responsive layout.
      layout=c?{c:true,r:120,n:[284,305],m:[284,755],l:[38,165,97,322],width:460,height:955}
        :{c:false,r:145,n:[440,320],m:[865,320],l:[44,175,200,330],width:1060,height:580};
      scene.replaceChildren();refs={};
      refs.svg=el('svg',{viewBox:'0 0 '+layout.width+' '+layout.height,role:'img','aria-labelledby':id+'title '+id+'desc',class:'se3-map-svg',focusable:'false'},scene);
      el('title',{id:id+'title'},refs.svg,w.title);el('desc',{id:id+'desc'},refs.svg,w.desc);
      var defs=el('defs');
      Object.keys(palette).forEach(function(color){var m=el('marker',{id:id+color,markerWidth:9,markerHeight:9,refX:8,refY:4.5,orient:'auto',markerUnits:'userSpaceOnUse'},defs);el('path',{d:'M0 0L9 4.5L0 9Z',fill:palette[color]},m);});
      ['green','blue'].forEach(function(color){var g=el('radialGradient',{id:id+color+'-sphere',cx:'28%',cy:'24%',r:'82%'},defs);el('stop',{offset:'0%','stop-color':color==='green'?'#eef5df':'#e2eff8'},g);el('stop',{offset:'100%','stop-color':color==='green'?'#b7cca4':'#8dbbdb'},g);});
      refs.world=el('g',{'data-mapping-camera':''},refs.svg);
      el('rect',{x:14,y:c?85:94,width:c?432:610,height:c?460:463,fill:'#f5f5f4',stroke:'#a7aca9','stroke-width':1.2});
      label(80,c?116:125,w.coordinates,{'text-anchor':'start'});math(190,c?116:125,'L');
      refs.nSphere=sphere(layout.n,'green','N',w.representatives);refs.mSphere=sphere(layout.m,'blue','M',w.distances);
      refs.l=trail('l','ink');refs.n=trail('n','green',layout.n);refs.m=trail('m','blue',layout.m);
      refs.mPlane=tangentPlane('orange');refs.nPlane=tangentPlane('red');
      refs.input=el('g');refs.inputArrow=arrow('blue',refs.input);
      refs.inputArrow.setAttribute('data-mapping-prediction','');
      var model=[c?230:800,c?610:112];refs.model=model;
      el('rect',{x:model[0]-82,y:model[1]-21,width:164,height:42,rx:3,fill:'#fff',stroke:palette.blue,'stroke-width':1.5},refs.input);
      label(model[0],model[1]+6,w.model,{'font-size':18},refs.input);
      refs.convert=el('g');refs.convertArrow=arrow('red',refs.convert);refs.convertBead=el('circle',{r:6,fill:palette.red,stroke:'#fff','stroke-width':1.4},refs.convert);
      refs.convertArrow.setAttribute('data-mapping-conversion','');
      refs.shift=el('g');refs.shiftArrow=arrow('red',refs.shift);
      refs.shiftLabel=label(0,0,'Shift',{fill:palette.red,'font-size':21},refs.shift);refs.lUpdate=arrow('red',refs.shift);
      refs.lUpdate.setAttribute('data-coordinate-update','');refs.lUpdate.setAttribute('stroke-width',3.8);
      refs.recompute=el('g');refs.recomputeArrow=arrow('blue',refs.recompute,true);refs.recomputeBead=el('circle',{r:5,fill:palette.blue,stroke:'#fff','stroke-width':1.4},refs.recompute);
      label(c?244:475,c?40:45,w.recompute,{fill:palette.blue,'font-size':16},refs.recompute);
      [refs.nSphere,refs.mSphere].forEach(function(sphereLabels){
        [sphereLabels.name,sphereLabels.description].forEach(function(node){
          node.setAttribute('stroke','#fff');node.setAttribute('stroke-width',3);node.setAttribute('paint-order','stroke');refs.world.appendChild(node);
        });
      });
      if(c){var min=11*layout.width/Math.max(240,scene.clientWidth);refs.svg.querySelectorAll('text').forEach(function(node){node.setAttribute('font-size',Math.max(min,Number(node.getAttribute('font-size'))));});}
      render();
    }
    function bead(path,node,amount){var p=path.getPointAtLength(path.getTotalLength()*clamp(amount));move(node,[p.x,p.y]);}
    function drawArrow(path,amount){var length=path.getTotalLength();path.style.strokeDasharray=length+' '+length;path.style.strokeDashoffset=length*(1-clamp(amount));path.style.markerEnd=amount>0.97?'':'none';}
    function showTrail(ref,key,fraction){
      var a=displayStates[index],b=displayStates[index+1];
      var p=key==='l'?lPoint(between(a.l,b.l,fraction)):project(normalize(between(a[key],b[key],fraction)),layout[key]);
      ref.completed.setAttribute('d',pathData(ref.points.slice(0,index+1).concat([p])));line(ref.segment,ref.points[index],p);
      move(ref.current,p);move(ref.target,ref.points[index+1]);
      pointLabel(ref.currentLabel,ref.points[index],-12,27);pointLabel(ref.targetLabel,ref.points[index+1],12,27);
      ref.targetLabel.setAttribute('text-anchor','start');
      opacity(ref.currentLabel,index===0||fraction>0.95?0:1);opacity(ref.targetLabel,index===STEPS-1||fraction<0.08?0:1);opacity(ref.target,fraction>0.05?1:0.25);
      return p;
    }
    function orientTrails(zoom){
      var mRotation=rotationAt(inspectionRotations[index].m,zoom),nRotation=rotationAt(inspectionRotations[index].n,zoom);
      displayStates=zoom===0?states:states.map(function(state){return{l:state.l,m:rotateBy(state.m,mRotation),n:rotateBy(state.n,nRotation)};});
      ['n','m'].forEach(function(key){
        var ref=refs[key];ref.points=displayStates.map(function(state){return project(state[key],layout[key]);});
        ref.whole.setAttribute('d',pathData(ref.points));move(ref.start,ref.points[0]);move(ref.end,ref.points[STEPS]);
        pointLabel(ref.startLabel,ref.points[0],-12,key==='n'?-16:-17);pointLabel(ref.endLabel,ref.points[STEPS],12,key==='n'?19:20);
      });
    }
    function render(){
      if(!refs.svg)return;
      var zoom=view==='detail'?1:view==='zoom-in'?ease(viewTime/zoomInDuration):view==='zoom-out'?1-ease(viewTime/zoomOutDuration):0;
      var localView=view==='detail'||view==='zoom-in'||view==='zoom-out';
      var detail=Math.min(3,Math.floor(phase*4)),local=phase*4-detail;
      if(reduced.matches)local=1;
      var amount=view==='overview'?walkPosition-index:view==='done'||view==='zoom-out'?1:detail===3&&view==='detail'?ease((local-0.44)/0.4):0;
      if(reduced.matches&&view==='overview')amount=0;
      orientTrails(reduced.matches?(localView?1:0):zoom);
      var lp=showTrail(refs.l,'l',amount),np=showTrail(refs.n,'n',amount),mp=showTrail(refs.m,'m',amount);
      var a=displayStates[index],b=displayStates[index+1];
      var mv=planeGeometry(refs.mPlane,a.m,b.m,layout.m,detail<1?0:detail===1?ease(local/0.68):1);
      // The M → N connection arrives first; only then does the N tangent grow.
      var nv=planeGeometry(refs.nPlane,a.n,b.n,layout.n,detail<2?0:detail===2?ease((local-0.58)/0.37):1);
      opacity(refs.mPlane.group,detail>=1?1:0);opacity(refs.nPlane.group,detail>=2?1:0);
      ['n','m'].forEach(function(key){
        var center=layout[key],geometry=key==='n'?nv:mv,sphereLabels=refs[key+'Sphere'];
        if(localView){
          refs[key].targetLabel.setAttribute('text-anchor','end');
          pointLabel(refs[key].targetLabel,[refs[key].points[index+1][0],geometry.bottom],key==='m'?-18:-12,32);
        }
        var overlaps=geometry.bottom>center[1]+layout.r+10&&detail>=(key==='n'?2:1);
        var shifted=Math.max(140,Math.min(layout.width-110,center[0]-(geometry.direction[0]>=0?1:-1)*layout.r*0.75));
        var labelX=lerp(center[0],overlaps?shifted:center[0],zoom);
        sphereLabels.name.setAttribute('x',labelX);sphereLabels.description.setAttribute('x',labelX);
      });
      var ms=refs.m.points[index],ns=refs.n.points[index],ls=refs.l.points[index],lt=refs.l.points[index+1],model=refs.model;
      if(localView){
        refs.l.currentLabel.setAttribute('text-anchor','middle');pointLabel(refs.l.currentLabel,ls,0,-18);
        refs.l.targetLabel.setAttribute('text-anchor','middle');pointLabel(refs.l.targetLabel,lt,0,28);
      }
      refs.inputArrow.setAttribute('d','M'+(model[0]+82)+' '+model[1]+' C'+(layout.m[0]+layout.r+12)+' '+model[1]+' '+mv.approach.join(' ')+' '+mv.shaft.join(' '));
      // The orange prediction completes first. Its blue annotation appears
      // in one frame, without a travelling bead or stroke-drawing animation.
      var predictionVisible=detail>1||(detail===1&&local>=0.68);
      opacity(refs.input,detail<=1?1:0.28);opacity(refs.inputArrow,predictionVisible?1:0);
      refs.convertArrow.setAttribute('d',layout.c?
        'M'+mv.tip.join(' ')+' C414 585 414 300 '+ns.join(' '):
        'M'+mv.tip.join(' ')+' C900 138 680 138 '+ns.join(' '));
      var convertAmount=detail<2?0:detail===2?ease(local/0.52):1;
      drawArrow(refs.convertArrow,convertAmount);bead(refs.convertArrow,refs.convertBead,convertAmount);opacity(refs.convert,detail>=2?1:0);opacity(refs.convertBead,detail===2&&convertAmount<1?1:0);
      refs.convertArrow.setAttribute('data-conversion-progress',convertAmount.toFixed(4));
      refs.shiftArrow.setAttribute('d',layout.c?
        'M'+nv.tip.join(' ')+' C400 145 170 130 '+ls.join(' '):
        'M'+nv.tip.join(' ')+' C595 128 245 128 '+ls.join(' '));
      var shiftAmount=detail===3?ease(local/0.4):1;
      drawArrow(refs.shiftArrow,shiftAmount);pointLabel(refs.shiftLabel,layout.c?[345,110]:[355,88],0,0);
      // Finish the N → L connector, then reveal the fixed coordinate update.
      // C_s moves along it only after it has appeared.
      line(refs.lUpdate,ls,lt);opacity(refs.lUpdate,detail===3&&shiftAmount===1?1:0);
      refs.lUpdate.setAttribute('data-shift-progress',shiftAmount.toFixed(4));
      opacity(refs.shift,detail===3?1:0);
      refs.recomputeArrow.setAttribute('d',layout.c?
        'M'+lp.join(' ')+' C8 '+lp[1]+' 8 10 80 10 L410 10 Q446 10 446 60 L446 '+(mp[1]+60)+' Q446 '+(mp[1]+95)+' '+mp.join(' '):
        'M'+lp.join(' ')+' C18 '+lp[1]+' 18 18 170 18 L950 18 Q1040 18 1040 100 L1040 '+(mp[1]+60)+' Q1040 '+(mp[1]+95)+' '+mp.join(' '));
      opacity(refs.recompute,detail===3&&local>0.86?0.85:0);bead(refs.recomputeArrow,refs.recomputeBead,ease((local-0.86)/0.14));opacity(refs.recomputeBead,detail===3&&local>0.86?1:0);
      // A single camera and the same three state points carry the transition.
      // Only the local mapping layers fade in; the trajectory never restarts.
      var cameraZoom=reduced.matches?(localView?1:0):zoom;
      var scale=lerp(layout.c?0.88:0.79,1,cameraZoom);
      refs.world.setAttribute('transform','translate('+((1-scale)*layout.width/2)+' '+((1-scale)*layout.height*0.46)+') scale('+scale+')');
      // Keep the page's MathJax formula aligned with the SVG camera on resize.
      if(formula){
        formula.style.left=((1-scale)*50+scale*(layout.c?230:654)/layout.width*100)+'%';
        formula.style.top=((1-scale)*46+scale*(layout.c?533:470)/layout.height*100)+'%';
        formula.style.fontSize=Math.max(layout.c?14:0,20*scene.clientWidth/layout.width)+'px';
        formula.style.transform='translate(-50%, -50%) scale('+scale+')';
        formula.style.opacity=String((detail>=2?1:0)*ease(zoom));
        formula.setAttribute('aria-hidden',String(!localView||detail<2));
      }
      if(recomputeFormula){
        recomputeFormula.style.left=((1-scale)*50+scale*(layout.c?244:475)/layout.width*100)+'%';
        recomputeFormula.style.top=((1-scale)*46+scale*(layout.c?70:73)/layout.height*100)+'%';
        recomputeFormula.style.fontSize=Math.max(layout.c?17:0,23*scene.clientWidth/layout.width)+'px';
        recomputeFormula.style.transform='translate(-50%, -50%) scale('+scale+')';
        recomputeFormula.style.opacity=String((detail===3&&local>0.86?0.85:0)*ease(zoom));
        recomputeFormula.setAttribute('aria-hidden',String(!localView||detail!==3||local<=0.86));
      }
      [refs.input,refs.mPlane.group,refs.nPlane.group,refs.convert,refs.shift,refs.recompute].forEach(function(node){opacity(node,Number(node.getAttribute('opacity'))*ease(zoom));});
      var focusing=view==='focus'||view==='zoom-in';
      ['l','n','m'].forEach(function(key){
        var ref=refs[key],p=ref.points[index],q=ref.points[index+1];
        move(ref.focus,[(p[0]+q[0])/2,(p[1]+q[1])/2]);
        ref.focus.setAttribute('r',Math.max(23,Math.hypot(p[0]-q[0],p[1]-q[1])/2+12));
        opacity(ref.focus,focusing?1-zoom:0);
        line(ref.nextSegment,p,q);opacity(ref.nextSegment,focusing?0.85:0);
        opacity(ref.whole,lerp(0.25,0.08,zoom));opacity(ref.completed,lerp(1,0.4,zoom));
        if(!localView){opacity(ref.currentLabel,0);opacity(ref.targetLabel,0);opacity(ref.target,0);}
        opacity(ref.startLabel,1-zoom);opacity(ref.endLabel,1-zoom);
      });
      var finished=view==='done';
      var progress=finished?STEPS:index+amount;
      var timeline=timelineBounds(),frameUnit=root.dataset.language==='en'?' frames':' 帧';
      slider.max=String(timeline.total);slider.value=String(frame);
      slider.setAttribute('aria-valuetext',frame+' / '+timeline.total+frameUnit+', '+(frame/fps).toFixed(1)+' s');
      counter.textContent=frame+' / '+timeline.total+frameUnit;
      counter.title=(frame/fps).toFixed(1)+' / '+(timeline.total/fps).toFixed(1)+' s';
      root.dataset.mappingView=view;root.dataset.mappingStage=String(detail);root.dataset.mappingSample=String(index);root.dataset.mappingPhase=phase.toFixed(4);root.dataset.mappingZoom=zoom.toFixed(4);root.dataset.mappingPosition=progress.toFixed(4);
      root.dataset.mappingFrame=String(frame);root.dataset.mappingFrames=String(timeline.total);
      root.querySelectorAll('[data-mapping-equations]').forEach(function(panel){panel.setAttribute('aria-hidden',String((panel.dataset.mappingEquations==='detail')!==localView));});
      var announcement=view+':'+(localView?detail:'')+':'+inspected;
      if(announcement!==announced){
        announced=announcement;
        var key=view==='done'?'done':view==='focus'?'focus':view==='zoom-in'||view==='detail'?'detail':view==='zoom-out'?'returning':inspected?'resumed':'overview';
        var title=root.querySelector('[data-mapping-view-title]'),caption=root.querySelector('[data-mapping-view-caption]');
        if(title)title.textContent=story[key];
        if(caption)caption.textContent=story[{overview:'overviewCaption',focus:'focusCaption',detail:'detailCaption',returning:'returnCaption',resumed:'resumeCaption',done:'doneCaption'}[key]];
        status.textContent=finished?w.done:view==='focus'?story.focusing:view==='zoom-in'?story.zooming:view==='detail'?w.statuses[detail]:view==='zoom-out'?story.returningStatus:inspected?story.resumedStatus:story.walking;
        var part=view==='overview'?(inspected?'resume':'overview'):finished||view==='zoom-out'?'resume':'detail';
        root.querySelectorAll('[data-mapping-story-part]').forEach(function(node){var active=node.dataset.mappingStoryPart===part;node.classList.toggle('is-current',active);if(active)node.setAttribute('aria-current','step');else node.removeAttribute('aria-current');});
        root.querySelectorAll('[data-mapping-step]').forEach(function(node,i){var active=view==='detail'&&i===detail;node.classList.toggle('is-current',active);var button=node.querySelector('button');if(active)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');});
      }
    }
    function buttons(){
      play.textContent=playing?story.pause:view==='done'?story.replay:autoplayStarted?story.resume:story.play;
      var inspecting=view!=='overview'&&view!=='done';
      slow.textContent=inspecting?story.inspecting:story.inspect;slow.disabled=inspecting;
      play.setAttribute('aria-pressed',String(playing));slow.removeAttribute('aria-pressed');
    }
    function pause(manual){
      playing=false;cancelAnimationFrame(raf);last=0;
      if(manual){userPaused=true;resumeOnVisible=false;}
      buttons();
    }
    function run(){
      userPaused=false;autoplayStarted=true;
      if(!visible||document.hidden){resumeOnVisible=true;buttons();return;}
      resumeOnVisible=false;playing=true;last=0;buttons();cancelAnimationFrame(raf);raf=requestAnimationFrame(tick);
    }
    // All visible state is a pure function of the film frame and selected
    // inspection step. Playback and seeking therefore traverse identical
    // camera, tangent, mapping, and denoising states in either direction.
    function applyFrame(target){
      var b=timelineBounds();frame=Math.max(0,Math.min(b.total,Math.round(target)));
      phase=0;viewTime=0;inspected=false;index=inspectAt;walkPosition=inspectAt;
      if(frame<b.focus){
        view='overview';walkPosition=frame/frames(walkStepDuration);index=Math.floor(walkPosition);
      }else if(frame<b.zoomIn){
        view='focus';viewTime=(frame-b.focus)*1000/fps;
      }else if(frame<b.detail){
        view='zoom-in';viewTime=(frame-b.zoomIn)*1000/fps;
      }else if(frame<b.hold){
        view='detail';var elapsed=frame-b.detail;
        phase=elapsed<frames(readDuration)?elapsed/frames(readDuration)/4:(1+(elapsed-frames(readDuration))/frames(stageDuration))/4;
      }else if(frame<b.zoomOut){
        // Keep the completed distance recomputation visible for one second.
        view='detail';phase=1;walkPosition=inspectAt+1;
      }else if(frame<b.resume){
        view='zoom-out';phase=1;walkPosition=inspectAt+1;viewTime=(frame-b.zoomOut)*1000/fps;
      }else if(frame<b.total){
        view='overview';inspected=true;walkPosition=inspectAt+1+(frame-b.resume)/frames(resumeStepDuration);index=Math.floor(walkPosition);
      }else{
        view='done';inspected=true;index=STEPS-1;phase=1;walkPosition=STEPS;
      }
      render();buttons();
    }
    function seekFrame(target){
      playhead=Math.max(0,Math.min(timelineBounds().total,Math.round(target)));
      applyFrame(playhead);
    }
    function tick(now){
      if(!playing)return;
      var delta=last?Math.max(0,now-last):0;last=now;
      playhead=Math.min(timelineBounds().total,playhead+delta*fps/1000);
      applyFrame(Math.floor(playhead+1e-7));
      if(view==='done'){pause(false);return;}
      raf=requestAnimationFrame(tick);
    }
    function reset(){
      pause(false);inspectAt=8;seekFrame(0);run();
    }
    play.addEventListener('click',function(){if(playing)pause(true);else if(view==='done')reset();else run();});
    slow.addEventListener('click',function(){
      pause(false);
      inspectAt=Math.min(STEPS-1,Math.ceil(walkPosition));
      // Finish any partial trajectory segment before inspecting its endpoint.
      seekFrame(Math.min(walkPosition,inspectAt)*frames(walkStepDuration));run();
    });
    restart.addEventListener('click',reset);
    slider.addEventListener('input',function(){
      var requested=Number(slider.value);pause(true);seekFrame(requested);
    });
    root.querySelectorAll('[data-mapping-jump]').forEach(function(button){button.disabled=false;button.addEventListener('click',function(){
      pause(true);
      if(view==='overview'||view==='done')inspectAt=Math.min(STEPS-1,Math.ceil(walkPosition));
      var step=Number(button.dataset.mappingJump),offset=step===0?0.98*frames(readDuration):frames(readDuration)+(step-1+0.98)*frames(stageDuration);
      seekFrame(timelineBounds().detail+offset);
      scene.scrollIntoView({behavior:reduced.matches?'auto':'smooth',block:'start'});
    });});
    document.addEventListener('visibilitychange',function(){
      if(document.hidden){resumeOnVisible=resumeOnVisible||playing;pause(false);}
      else if(resumeOnVisible&&!userPaused&&visible)run();
    });
    reduced.addEventListener('change',function(){if(reduced.matches)pause(true);render();});
    var width=scene.clientWidth;build();
    if('ResizeObserver'in window)new ResizeObserver(function(){if(Math.abs(scene.clientWidth-width)>1){width=scene.clientWidth;build();}}).observe(scene);
    root.dataset.mappingReady='true';controls.hidden=false;buttons();
    if('IntersectionObserver'in window)new IntersectionObserver(function(entries){
      var entry=entries[0];visible=entry.isIntersecting;
      if(!visible){if(playing){resumeOnVisible=true;pause(false);}return;}
      if(resumeOnVisible&&!userPaused)run();
      else if(!autoplayStarted&&!userPaused&&!reduced.matches&&entry.intersectionRect.height>=Math.min(240,scene.clientHeight*0.35))run();
    },{threshold:[0,0.15,0.3,0.5,0.7,1]}).observe(scene);
    else{visible=true;if(!reduced.matches)run();}
  }
  document.querySelectorAll('[data-se3-mapping]').forEach(init);
}());
