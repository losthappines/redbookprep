'use client';
import {useEffect,useRef} from 'react';
/** Soft gradient bubbles inspired by Animate UI's Bubble Background (21st.dev). */
export function StudyBubbleBackground({reduced,highContrast}:{reduced:boolean;highContrast:boolean}){
 const root=useRef<HTMLDivElement>(null),pointer=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const layer=root.current,glow=pointer.current;if(!layer||!glow)return;
  const motion=matchMedia('(prefers-reduced-motion: reduce)'),fine=matchMedia('(hover: hover) and (pointer: fine)'),contrast=matchMedia('(prefers-contrast: more)');
  let frame=0,last=0,initialized=false,x=0,y=0,vx=0,vy=0,tx=0,ty=0;
  const allowed=()=>!reduced&&!highContrast&&!motion.matches&&!contrast.matches&&fine.matches&&!document.hidden;
  const stop=()=>{cancelAnimationFrame(frame);frame=0;last=0;glow.dataset.active='false'};
  const tick=(time:number)=>{
   if(!allowed()){stop();return;}
   const dt=Math.min(.032,(time-(last||time-16))/1000);last=time;
   // Critically damped spring, half-second response; preserve velocity on retarget.
   const w=2*Math.PI/.5,decay=Math.exp(-w*dt);
   const dx=x-tx,cx=vx+w*dx,dy=y-ty,cy=vy+w*dy;
   x=tx+(dx+cx*dt)*decay;vx=(vx-w*cx*dt)*decay;
   y=ty+(dy+cy*dt)*decay;vy=(vy-w*cy*dt)*decay;
   glow.style.transform=`translate3d(${x}px,${y}px,0)`;
   if(Math.abs(x-tx)+Math.abs(y-ty)+Math.abs(vx)+Math.abs(vy)>.2)frame=requestAnimationFrame(tick);else{frame=0;last=0;}
  };
  const move=(event:PointerEvent)=>{
   if(event.pointerType!=='mouse'||!allowed()){stop();return;}
   const bounds=layer.getBoundingClientRect();
   if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<0||event.clientY>bounds.height){stop();return;}
   tx=event.clientX-bounds.left;ty=event.clientY;
   if(!initialized){x=tx;y=ty;initialized=true;}
   glow.dataset.active='true';if(!frame)frame=requestAnimationFrame(tick);
  };
  const visibility=()=>{layer.dataset.paused=document.hidden?'true':'false';if(document.hidden)stop()};
  window.addEventListener('pointermove',move,{passive:true});window.addEventListener('blur',stop);document.documentElement.addEventListener('pointerleave',stop);document.addEventListener('visibilitychange',visibility);
  for(const media of [motion,fine,contrast])media.addEventListener('change',stop);
  visibility();
  return()=>{stop();window.removeEventListener('pointermove',move);window.removeEventListener('blur',stop);document.documentElement.removeEventListener('pointerleave',stop);document.removeEventListener('visibilitychange',visibility);for(const media of [motion,fine,contrast])media.removeEventListener('change',stop)};
 },[reduced,highContrast]);
 return <div ref={root} className="rb-bubble-background" aria-hidden="true" data-reduced={reduced} data-contrast={highContrast}>
  <div className="rb-bubble rb-bubble-one"/><div className="rb-bubble rb-bubble-two"/><div className="rb-bubble rb-bubble-three"/><div className="rb-bubble rb-bubble-four"/>
  <div ref={pointer} className="rb-bubble-pointer" data-active="false"><span/></div>
 </div>;
}
