export type WordCard={id:string;front:string;back:string;frontImage?:string;backImage?:string;frontAlt?:string;backAlt?:string};
export type FlashDeck={format:'bbplus';version:1;type:'flashcards';title:string;description:string;cards:WordCard[]};
function readText(v:unknown,label:string,max:number,required=false){if(v==null&&!required)return '';if(typeof v!=='string'||v.length>max||(required&&!v.trim()))throw Error(`Invalid ${label}.`);return v;}
function image(v:unknown){if(v==null||v==='')return undefined;if(typeof v!=='string'||v.length>1400000||!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+=*$/.test(v))throw Error('Flashcard images must be embedded PNG or JPEG, up to 1 MB.');let bytes:string;try{bytes=atob(v.split(',')[1])}catch{throw Error('Invalid flashcard image encoding.');}if(!(v.startsWith('data:image/png;')&&bytes.startsWith('\x89PNG\r\n\x1a\n'))&&!(v.startsWith('data:image/jpeg;')&&bytes.startsWith('\xff\xd8\xff')))throw Error('Invalid flashcard image data.');return v;}
export function parseFlashDeck(raw:unknown):FlashDeck{
 if(!raw||typeof raw!=='object')throw Error('This is not a valid .bbplus deck.');
 const p=raw as Record<string,unknown>;
 if(p.format!=='bbplus'||p.version!==1)throw Error('Only .bbplus version 1 is supported.');
 if(p.type!=='flashcards')throw Error('This is a practice test. Import it from the Practice tab.');
 if(!Array.isArray(p.cards)||!p.cards.length||p.cards.length>500)throw Error('A deck must contain 1–500 flashcards.');
 const ids=new Set<string>();
 const cards=p.cards.map((raw,i)=>{
  if(!raw||typeof raw!=='object')throw Error(`Card ${i+1} is invalid.`);const c=raw as Record<string,unknown>;
  const id=readText(c.id,'card ID',100,true);if(ids.has(id))throw Error('Flashcard IDs must be unique.');ids.add(id);
  const front=readText(c.front,'front text',30000),back=readText(c.back,'back text',30000),frontImage=image(c.frontImage),backImage=image(c.backImage);
  if((!front.trim()&&!frontImage)||(!back.trim()&&!backImage))throw Error(`Card ${i+1}: each side needs text or an image.`);
  return {id,front,back,frontImage,backImage,frontAlt:readText(c.frontAlt,'front image description',1000),backAlt:readText(c.backAlt,'back image description',1000)};
 });
 return {format:'bbplus',version:1,type:'flashcards',title:readText(p.title,'deck title',120,true).trim(),description:readText(p.description,'description',1000),cards};
}
export type WordSession={order:string[];index:number;revealed:boolean;answers:Record<string,boolean>};
export function newWordSession(cards:WordCard[],learning?:Record<string,boolean>):WordSession{return {order:cards.filter(c=>!learning||learning[c.id]===false).map(c=>c.id),index:0,revealed:false,answers:{}};}
export function rateWord(session:WordSession,known:boolean):WordSession{
 const id=session.order[session.index];if(!id||!session.revealed||Object.hasOwn(session.answers,id))return session;
 return {...session,index:session.index+1,revealed:false,answers:{...session.answers,[id]:known}};
}
export const starterDeck:FlashDeck={format:'bbplus',version:1,type:'flashcards',title:'SAT word essentials',description:'Eight original starter cards. Read the word, recall its meaning, then reveal and rate.',cards:[
 ['concise','Concise','Expressing an idea clearly in few words.\nExample: Her concise summary captured the main argument.'],
 ['infer','Infer','To reach a conclusion from evidence and reasoning.\nExample: We can infer that the author favors the policy.'],
 ['substantiate','Substantiate','To support a claim with evidence.\nExample: The researcher used survey data to substantiate the conclusion.'],
 ['ambiguous','Ambiguous','Open to more than one interpretation; unclear.\nExample: The ambiguous wording allowed two readings.'],
 ['mitigate','Mitigate','To make something less severe or harmful.\nExample: Shade can mitigate the effects of extreme heat.'],
 ['pragmatic','Pragmatic','Focused on practical results.\nExample: The team chose a pragmatic solution within its budget.'],
 ['corroborate','Corroborate','To confirm or strengthen a statement with additional evidence.\nExample: A second experiment corroborated the findings.'],
 ['nuance','Nuance','A subtle difference in meaning, feeling, or expression.\nExample: The translation preserved the nuance of the original sentence.'],
 ].map(([id,front,back])=>({id,front,back}))};
