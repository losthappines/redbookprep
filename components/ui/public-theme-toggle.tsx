'use client';
import {useEffect,useState} from 'react';
import {Moon,Sun} from 'lucide-react';
export function PublicThemeToggle(){
 const [dark,setDark]=useState(false),[error,setError]=useState('');
 useEffect(()=>{
  const media=matchMedia('(prefers-color-scheme: dark)');
  const apply=()=>{let settings:{theme?:string;reduced?:boolean}={};try{settings=JSON.parse(localStorage.getItem('prepdeck-settings')||'{}')}catch{}const next=settings.theme==='dark'||(settings.theme!=='light'&&media.matches);document.documentElement.dataset.theme=next?'dark':'light';document.documentElement.style.colorScheme=next?'dark':'light';document.documentElement.dataset.motion=settings.reduced?'reduced':'normal';setDark(next)};
  apply();media.addEventListener('change',apply);window.addEventListener('storage',apply);return()=>{media.removeEventListener('change',apply);window.removeEventListener('storage',apply)};
 },[]);
 return <><button type="button" className="rb-public-button rb-theme-toggle" aria-label={dark?'Switch to light mode':'Switch to dark mode'} title={dark?'Switch to light mode':'Switch to dark mode'} onClick={()=>{const next=!dark;setDark(next);document.documentElement.dataset.theme=next?'dark':'light';document.documentElement.style.colorScheme=next?'dark':'light';try{const p=JSON.parse(localStorage.getItem('prepdeck-settings')||'{}');localStorage.setItem('prepdeck-settings',JSON.stringify({...p,theme:next?'dark':'light'}));setError('')}catch{setError('Theme changed for this page; the preference could not be saved.')}}}>{dark?<Sun size={18}/>:<Moon size={18}/>}</button>{error&&<span role="status">{error}</span>}</>;
}
