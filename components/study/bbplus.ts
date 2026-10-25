export type PracticeQuestion = {
 id:string;skill:string;section:string;domain:string;focus:string;source:string;
 passageTitle:string;passage:string;prompt:string;options:{text:string;letter:string}[];answer:number;explanation:string;
 imageDataUrl?:string;imageAlt?:string;moduleId?:string;materialTitle?:string;moduleTitle?:string;
};
const text=(value:unknown,label:string,required=false)=>{
 if(value==null&&!required)return '';
 if(typeof value!=='string'||value.length>100000||(required&&!value.trim()))throw Error(`${label} must be valid text.`);
 return value;
};
export function parseBbplus(input:unknown,key:string):PracticeQuestion[]{
 if(!input||typeof input!=='object')throw Error('This is not a .bbplus practice file.');
 const pack=input as Record<string,unknown>;
 if(pack.format!=='bbplus'||pack.version!==1)throw Error('Only .bbplus version 1 is supported.');
 if(pack.type==='flashcards')throw Error('This file contains flashcards. Import it from the Vocabulary tab.');
 if(pack.type!==undefined&&pack.type!=='practice')throw Error('Unknown material type.');
 const title=text(pack.title,'Material title',true);
 if(!Array.isArray(pack.modules)||!pack.modules.length||pack.modules.length>100)throw Error('The file must contain 1–100 practice modules.');
 const result:PracticeQuestion[]=[];
 pack.modules.forEach((raw,mi)=>{
  if(!raw||typeof raw!=='object')throw Error(`Module ${mi+1} is invalid.`);
  const m=raw as Record<string,unknown>;
  const moduleTitle=text(m.title,`Module ${mi+1} title`)||`Module ${mi+1}`;
  if(m.section!=='reading'&&m.section!=='math')throw Error(`Module ${mi+1}: section must be reading or math.`);
  if(!Array.isArray(m.questions)||!m.questions.length)throw Error(`Module ${mi+1} has no questions.`);
  m.questions.forEach((rawQ,qi)=>{
   if(!rawQ||typeof rawQ!=='object')throw Error(`Question ${qi+1} is invalid.`);
   const q=rawQ as Record<string,unknown>, label=`Module ${mi+1}, question ${qi+1}`;
   if(!Array.isArray(q.options)||q.options.length!==4)throw Error(`${label}: four answer choices are required. Student-entered responses are not supported yet.`);
   if(!Number.isInteger(q.answer)||Number(q.answer)<0||Number(q.answer)>3)throw Error(`${label}: answer must be an index from 0 to 3.`);
   let imageDataUrl:string|undefined;
   if(q.imageDataUrl){
    if(typeof q.imageDataUrl!=='string'||q.imageDataUrl.length>1400000||!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+=*$/.test(q.imageDataUrl))throw Error(`${label}: image must be an embedded PNG or JPEG.`);
    let bytes:string;
    try{bytes=atob(q.imageDataUrl.split(',')[1])}catch{throw Error(`${label}: invalid image encoding.`);}
    if(!(q.imageDataUrl.startsWith('data:image/png;')&&bytes.startsWith('\x89PNG\r\n\x1a\n'))&&!(q.imageDataUrl.startsWith('data:image/jpeg;')&&bytes.startsWith('\xff\xd8\xff')))throw Error(`${label}: invalid image data.`);
    imageDataUrl=q.imageDataUrl;
   }
   result.push({imageDataUrl,imageAlt:text(q.imageAlt,'Image description'),id:`bbplus-${key}-${mi}-${qi}`,moduleId:`bbplus-${key}-${mi}`,materialTitle:title,moduleTitle,skill:text(q.skill,'Skill')||'Unclassified skill',domain:text(q.domain,'Domain')||'Unclassified',focus:text(q.focus,'Focus')||moduleTitle,source:`Imported · ${title}`,section:m.section==='math'?'Math':'Reading and Writing',passageTitle:text(q.passageTitle,'Passage title')||moduleTitle,passage:text(q.passage,'Passage'),prompt:text(q.prompt,`${label} prompt`,true),options:q.options.map((v,i)=>({text:text(v,`${label} choice`,true),letter:'ABCD'[i]})),answer:Number(q.answer),explanation:text(q.explanation,'Explanation')||'No explanation was provided in this material.'});
   if(result.length>1000)throw Error('A material can contain at most 1,000 questions.');
  });
 });
 return result;
}
