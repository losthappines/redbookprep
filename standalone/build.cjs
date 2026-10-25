const fs=require('node:fs'),path=require('node:path');
const esbuild=require('esbuild');
const root=path.resolve('.'),out=path.join(root,'releases');
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const result=await esbuild.build({entryPoints:['standalone/entry.jsx'],bundle:true,write:false,minify:true,format:'iife',platform:'browser',target:['chrome110','edge110'],jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'standalone-adapters',setup(build){
  build.onResolve({filter:/^next\/(link|navigation)$/},args=>({path:path.join(root,args.path==='next/link'?'standalone/link.jsx':'standalone/navigation.js')}));
  build.onLoad({filter:/\.css$/},()=>({contents:'',loader:'js'}));
  build.onLoad({filter:/\.tsx$/},args=>({contents:require('./loader.cjs')(fs.readFileSync(args.path,'utf8'),args.path),loader:'js'}));
 }}]});
 const postcss=require(require.resolve('postcss',{paths:[path.dirname(require.resolve('@tailwindcss/postcss'))]})),tailwind=require('@tailwindcss/postcss');
 const cssSource=['app/globals.css','app/redbook-public.css','app/study/redbook.css'].map(p=>fs.readFileSync(p,'utf8')).join('\n');
 let css=(await postcss([tailwind()]).process(cssSource,{from:path.join(root,'app/globals.css')})).css;
 const grain='data:image/svg+xml;base64,'+fs.readFileSync('public/dashboard-grain.svg').toString('base64');
 css=css.replaceAll("'/dashboard-grain.svg'",JSON.stringify(grain));
 css=css.replace(/url\((["']?)(\/[^)'"\s]+)\1\)/g,(full,quote,url)=>{const asset=path.join(root,'public',url.slice(1));if(!fs.existsSync(asset))throw Error('Missing release asset: '+url);const mime=url.endsWith('.woff2')?'font/woff2':url.endsWith('.svg')?'image/svg+xml':'application/octet-stream';return 'url("data:'+mime+';base64,'+fs.readFileSync(asset).toString('base64')+'")'});
 let js=result.outputFiles[0].text;
 const bootstrap="try{var p=JSON.parse(localStorage.getItem('prepdeck-settings')||'{}');var d=p.theme==='dark'||(p.theme!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';document.documentElement.style.colorScheme=d?'dark':'light';document.documentElement.dataset.motion=p.reduced?'reduced':'normal'}catch(e){}";
 const notices=['react','react-dom','lucide-react','tailwindcss','tw-animate-css'].map(name=>{const dir=fs.realpathSync(path.join(root,'node_modules',name));const license=['LICENSE','LICENSE.txt','LICENSE.md'].find(f=>fs.existsSync(path.join(dir,f)));return name+'\n'+(license?fs.readFileSync(path.join(dir,license),'utf8'):'See package license.');}).join('\n\n');
 fs.writeFileSync(path.join(out,'Third-party-licenses.txt'),notices);
 const html=`<!doctype html><html lang="en"><!-- Third-party licenses\n${notices}\n--><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="PrepDeck standalone SAT study companion"><title>PrepDeck · Standalone Release</title><script>${bootstrap}</script><style>${css.replaceAll('</style','<\\/style')}</style></head><body><div id="root"></div><noscript>Enable JavaScript to use PrepDeck.</noscript><script>${js.replaceAll('</script','<\\/script')}</script></body></html>`;
 fs.writeFileSync(path.join(out,'PrepDeck.html'),html);
 console.log('Created releases/PrepDeck.html ('+(Buffer.byteLength(html)/1024/1024).toFixed(2)+' MB). No external scripts or server required.');
})().catch(e=>{console.error(e);process.exitCode=1});
