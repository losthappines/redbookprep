import React,{useState,useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import Landing from '../app/page';
import Study from '../app/study/page';
import Auth from '../components/ui/auth-page';
import About from '../app/about/page';
import Privacy from '../app/privacy/page';
const nativeReplace=history.replaceState.bind(history);
history.replaceState=(state,title,url)=>{if(typeof url==='string'&&url.startsWith('/'))return nativeReplace(state,title,location.href.split('#')[0]+'#'+url);return nativeReplace(state,title,url)};
document.addEventListener('click',event=>{const link=event.target.closest?.('a');if(!link||event.defaultPrevented||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||link.hasAttribute('download')||link.target==='_blank')return;const href=link.getAttribute('href');if(href?.startsWith('/')){event.preventDefault();location.hash=href}});
function route(){const hash=location.hash.slice(1);return hash.startsWith('/')?hash.split('?')[0]:'/'}
function App(){const [path,setPath]=useState(route);useEffect(()=>{const update=()=>{setPath(route());if(location.hash.startsWith('#/'))window.scrollTo(0,0)};addEventListener('hashchange',update);return()=>removeEventListener('hashchange',update)},[]);if(path==='/study')return <Study/>;if(path==='/signup'||path==='/login')return <Auth mode={path==='/signup'?'signup':'login'}/>;if(path==='/about')return <About/>;if(path==='/privacy')return <Privacy/>;return <Landing/>}
createRoot(document.getElementById('root')).render(<App/>);
