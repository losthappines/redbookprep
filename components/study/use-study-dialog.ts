'use client';
import {useEffect} from 'react';
export function useStudyDialog(open:boolean,onClose:()=>void){
 useEffect(()=>{if(!open)return;let trigger=document.activeElement as HTMLElement|null;const dialog=document.querySelector<HTMLElement>('.redbook-app [role="dialog"]');if(!dialog)return;if(trigger&&dialog.contains(trigger))trigger=document.querySelector<HTMLElement>('.redbook-app [aria-haspopup="dialog"][aria-expanded="true"]');
 const focusable=()=>Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input,textarea,select,summary,[tabindex="0"]')).filter(el=>el.getClientRects().length>0);
 (focusable()[0]||dialog).focus();const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();onClose()}if(e.key==='Tab'){const list=focusable();const first=list[0],last=list[list.length-1];if(!first){e.preventDefault();return}if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}};document.addEventListener('keydown',key);return()=>{document.removeEventListener('keydown',key);trigger?.focus()};
 },[open,onClose]);
}
