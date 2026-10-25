'use client';
import {useEffect,useState,useCallback,useRef} from 'react';
import GlassFolder from '@/components/ui/glass-folder-cards';
import {useStudyDialog} from './use-study-dialog';
type Test = {id:string;skill:string;section:string;domain:string;focus:string;moduleId?:string;materialTitle?:string;moduleTitle?:string};
type Folder = {id:string;name:string;section:string;tests:string[];art:number};
export function PracticeFolders({questions,search,section,theme,onStart,onSearch,onSection,onImport}:{questions:Test[];search:string;section:string;theme:string;onStart:(i:number)=>void;onSearch:(value:string)=>void;onSection:(value:string)=>void;onImport:(file:File)=>Promise<Test[]>}) {
 const importInput=useRef<HTMLInputElement>(null);
 const targetFolder=useRef<string|null>(null);
 const [importing,setImporting]=useState(false),[importNotice,setImportNotice]=useState('');
 function chooseImport(target:string|null=null){targetFolder.current=target;importInput.current?.click()}
 async function receiveImport(file:File){
  setImporting(true);setError('');setImportNotice('');
  try{
   const tests=await onImport(file),target=targetFolder.current;
   const id='import-'+tests[0].id;
   const destination=target||id;
   const existing=folders.find(f=>f.id===destination);
   const next=existing?folders.map(f=>f.id===destination?{...f,tests:[...new Set([...f.tests,...tests.map(t=>t.id)])]}:f):[...folders,{id:destination,name:file.name.replace(/\.bbplus$/i,''),section:tests.every(t=>t.section===tests[0].section)?tests[0].section:'Mixed',tests:tests.map(t=>t.id),art:folders.length%3}];
   if(!save(next))return;
   setImportNotice(`Imported ${tests.length} practice module${tests.length===1?'':'s'} from ${file.name}.`);
  }catch(error){setError(error instanceof Error?error.message:'The material could not be imported.');}
  finally{setImporting(false);if(importInput.current)importInput.current.value='';}
 }
 const defaults=useCallback(()=>{const map=new Map<string,Folder>();questions.forEach((q,i)=>{if(q.materialTitle){const fid='folder-material-'+q.materialTitle.toLowerCase().replace(/[^a-z0-9]+/g,'-');const existing=map.get(fid);if(existing){if(!existing.tests.includes(q.id))existing.tests.push(q.id);}else map.set(fid,{id:fid,name:q.materialTitle,section:q.section,tests:[q.id],art:map.size%3});}else{const fid='folder-'+q.id;map.set(fid,{id:fid,name:q.skill==='Linear equations in one variable'?'Linear equations':q.skill,section:q.section,tests:[q.id],art:i});}});return Array.from(map.values());},[questions]);
 const [folders,setFolders]=useState<Folder[]>(defaults);
 const [ready,setReady]=useState(false),[error,setError]=useState('');
 const [expanded,setExpanded]=useState<string[]>([]);
 const [editor,setEditor]=useState<Folder|null>(null),[manage,setManage]=useState(false);
 const [undo,setUndo]=useState<{folder:Folder;index:number}|null>(null);
 const close=useCallback(()=>{setEditor(null);setManage(false)},[]);
 useStudyDialog(Boolean(editor)||manage,close);
 useEffect(()=>{const built=defaults();try{const raw=localStorage.getItem('redbookprep-folders');if(raw){const data=JSON.parse(raw);if(!Array.isArray(data)||!data.every(f=>f&&typeof f.id==='string'&&typeof f.name==='string'&&['Math','Reading and Writing','Mixed'].includes(f.section)&&Array.isArray(f.tests)&&f.tests.every((id:unknown)=>typeof id==='string')&&Number.isInteger(f.art)))throw Error();const cleaned=data.map(f=>({...f,tests:f.tests.filter((id:string)=>questions.some(q=>q.id===id))})).filter(f=>f.tests.length>0||!f.id.startsWith('folder-'));const missingBuiltIn=built.filter(b=>b.id.startsWith('folder-material-')&&!cleaned.some(f=>f.id===b.id));setFolders([...cleaned,...missingBuiltIn]);}else{setFolders(built);}}catch{setFolders(built);setError('Saved folders could not be loaded. Your practice history is still available.')}setReady(true)},[questions,defaults]);
 function save(next:Folder[]){try{localStorage.setItem('redbookprep-folders',JSON.stringify(next));setFolders(next);setError('');return true}catch{setError('Folders could not be saved. Please free browser storage and try again.');return false}}
 function remove(id:string){const index=folders.findIndex(f=>f.id===id);if(index<0)return;setUndo({folder:folders[index],index});save(folders.filter(f=>f.id!==id))}
 function create(){setManage(false);setEditor({id:crypto.randomUUID(),name:'',section:section==='All sections'?'Mixed':section,tests:[],art:folders.length%3})}
 function edit(folder:Folder){setManage(false);setEditor({...folder,tests:[...folder.tests]})}
 const filtered=folders.filter(f=>(section==='All sections'||f.section===section||f.tests.some(id=>questions.find(q=>q.id===id)?.section===section))&&(f.name+' '+f.tests.map(id=>{const q=questions.find(q=>q.id===id);return q?.skill+' '+q?.domain}).join(' ')).toLowerCase().includes(search.toLowerCase()));
 const toggle=(id:string,open:boolean)=>setExpanded(old=>open?[...new Set([...old,id])]:old.filter(x=>x!==id));
 return <>
 <input ref={importInput} type="file" accept=".bbplus" aria-label="Import bbplus practice material" hidden onChange={event=>{const file=event.target.files?.[0];if(file)void receiveImport(file)}}/>
 {importNotice&&<p role="status">{importNotice}</p>}
 <div className="library-filters"><input aria-label="Search practice" type="search" placeholder="Search folders or practice tests…" value={search} onChange={e=>onSearch(e.target.value)}/><div className="folder-filter-actions"><div className="folder-toolbar" aria-label="Folder controls"><button className="folder-import" disabled={importing||!ready} onClick={()=>chooseImport()}>{importing?'Importing…':'Import .bbplus'}</button><button aria-label="Create folder" onClick={create} disabled={!ready}>＋</button><button aria-label="Remove folders" onClick={()=>setManage(true)} disabled={!ready}>−</button></div>
 <div className="segmented" aria-label="Filter section">{['All sections','Reading and Writing','Math'].map(value=><button key={value} aria-pressed={section===value} onClick={()=>onSection(value)}>{value==='All sections'?'All':value}</button>)}</div></div></div>
 {error&&<p role="alert">{error}</p>}
 {undo&&<div className="folder-notice" role="status">Removed “{undo.folder.name}”. Practice history is preserved. <button onClick={()=>{const next=[...folders];next.splice(undo.index,0,undo.folder);save(next);setUndo(null)}}>Undo</button></div>}
 <div className="rb-section-heading"><h2>Practice folders</h2><span>{folders.length} folders · Saved on this device</span></div>
 <div className="covers">{filtered.map(folder=>{const tests=folder.tests.map(id=>questions.find(q=>q.id===id)!).filter(Boolean);const open=expanded.includes(folder.id);const art=((folder.art%3)+3)%3;return <article className="material" key={folder.id}>
 <div className="cover-folder"><GlassFolder key={folder.id+folder.tests.join(',')} label={folder.name} meta={`${tests.length} practice ${tests.length===1?'test':'tests'}`} tone={theme==='dark'||art===2?'dark':'light'} art={(['aurora','dusk','ember'] as const)[art]} seed={[3,7,11][art]} action="more" labelPlacement={(['bottom-left','top-left','top-right'] as const)[art]} appearDelay={0} width={268} open={open} onOpenChange={value=>toggle(folder.id,value)} files={tests.map((q,i)=>({name:q.moduleTitle||q.skill,meta:q.section,art:(['ember','verdant','aurora'] as const)[i%3]}))} menu={[{label:'Import .bbplus into folder',onSelect:()=>chooseImport(folder.id)},{label:'Add / remove practice tests',onSelect:()=>edit(folder)},{label:'Remove folder',danger:true,onSelect:()=>remove(folder.id)}]} onFileSelect={(_,i)=>onStart(questions.findIndex(q=>q.id===tests[i]?.id))}/></div>
 <div className="material-info"><h3>{folder.name}</h3><p>{folder.section} · {tests.length} practice {tests.length===1?'test':'tests'}</p>

 </div></article>})}</div>
 {!filtered.length&&<section className="card"><h2>No matching folders</h2><p>Create a folder or change your search and section filters.</p><button onClick={create}>Create folder</button></section>}
 {(editor||manage)&&<div className="navigator-backdrop" onClick={close}><section className="question-navigator folder-editor" role="dialog" aria-modal="true" aria-label={editor?'Edit practice folder':'Manage folders'} onClick={e=>e.stopPropagation()}><div className="navigator-heading"><h2>{editor?(folders.some(f=>f.id===editor.id)?'Edit folder':'Create folder'):'Remove folders'}</h2><button aria-label="Close folder editor" onClick={close}>✕</button></div>
 {editor?<form onSubmit={e=>{e.preventDefault();if(!editor.name.trim())return;save(folders.some(f=>f.id===editor.id)?folders.map(f=>f.id===editor.id?{...editor,name:editor.name.trim()}:f):[...folders,{...editor,name:editor.name.trim()}]);close();toggle(editor.id,true)}}><label>Folder name<input required maxLength={80} value={editor.name} onChange={e=>setEditor({...editor,name:e.target.value})}/></label><label>Section<select value={editor.section} onChange={e=>setEditor({...editor,section:e.target.value})}><option>Mixed</option><option>Reading and Writing</option><option>Math</option></select></label><fieldset><legend>Practice tests</legend><p>Choose from your available practice modules.</p>{questions.map(q=><label className="folder-check" key={q.id}><input type="checkbox" checked={editor.tests.includes(q.id)} onChange={e=>setEditor({...editor,tests:e.target.checked?[...editor.tests,q.id]:editor.tests.filter(id=>id!==q.id)})}/><span>{q.skill}<small>{q.section}</small></span></label>)}</fieldset><div className="module-actions"><button type="button" onClick={close}>Cancel</button><button className="primary" type="submit">Save folder</button></div></form>:<><p>Removing a folder keeps your answers, mistakes, and progress. You can undo the latest removal.</p>{folders.map(f=><div className="folder-test" key={f.id}><span>{f.name}</span><button onClick={()=>remove(f.id)} aria-label={'Remove folder '+f.name}>Remove</button></div>)}{!folders.length&&<p>No folders yet.</p>}<button onClick={create}>＋ Create folder</button></>}
 </section></div>}
 </>;
}
