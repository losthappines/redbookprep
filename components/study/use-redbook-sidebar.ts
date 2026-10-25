'use client';
import {useLayoutEffect,useRef,type RefObject} from 'react';
/** Same critically damped integration as frontend-rebuilt/experience.js. */
export function useRedbookSidebar(root:RefObject<HTMLElement|null>,collapsed:boolean,reduced:boolean,ready:boolean){
 const track=useRef({x:1,v:0,last:0,frame:0,initialized:false});
 useLayoutEffect(()=>{const el=root.current;if(!el||!ready)return;const s=track.current;const target=collapsed?0:1;const paint=()=>el.style.setProperty('--sidebar-space',`calc(var(--sidebar-width) * ${s.x})`);
 if(!s.initialized||reduced||matchMedia('(prefers-reduced-motion: reduce)').matches){s.initialized=true;s.x=target;s.v=0;paint();return}
 s.last=0;
 const tick=(t:number)=>{const dt=Math.min(.025,(t-(s.last||t-16))/1000);s.last=t;const w=2*Math.PI/.4;const d=s.x-target;const c=s.v+w*d;const decay=Math.exp(-w*dt);s.x=target+(d+c*dt)*decay;s.v=(s.v-w*c*dt)*decay;paint();if(Math.abs(s.x-target)<.002&&Math.abs(s.v)<.02){s.x=target;s.v=0;paint();s.frame=0}else s.frame=requestAnimationFrame(tick)};
 s.frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(s.frame);
 },[root,collapsed,reduced,ready]);
}
