
'use strict';
// A small expression interpreter. User input is parsed as math, never executed as JavaScript.
const FUNCTIONS=new Set(['sin','cos','tan','asin','acos','atan','sqrt','abs','ln','log','exp','floor','ceil','round','min','max','cbrt','sign','sinh','cosh','tanh','hypot','mod','ncr','npr','nthrt','distance']);
let pointValues=Object.create(null);
let userFunctions=Object.create(null),functionNames=new Set(),callDepth=0;
function normalize(s){return s.replace(/[₀₁₂₃₄₅₆₇₈₉]/g,c=>'₀₁₂₃₄₅₆₇₈₉'.indexOf(c)).replace(/_([0-9]+)/g,'$1')}
function expandAbsoluteBars(source){let output='',depth=0,operand=true;for(const c of source){if(c==='|'){if(operand||depth===0){output+='abs(';depth++;operand=true}else{output+=')';depth--;operand=false}}else{output+=c;if(/\s/.test(c))continue;if('+-*/^(,'.includes(c))operand=true;else operand=false}}if(depth)throw Error('Close absolute-value bars, e.g. |x-2|');return output}
function tokenize(source){
 source=normalize(source).replace(/π/g,'pi').replace(/×/g,'*').replace(/÷/g,'/').replace(/−/g,'-').replace(/²/g,'^2').replace(/³/g,'^3').replace(/√/g,'sqrt');
 source=expandAbsoluteBars(source);
 const out=[];let i=0;
 while(i<source.length){let c=source[i];if(/\s/.test(c)){i++;continue}
 let m=source.slice(i).match(/^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/);
 if(m){out.push({t:'number',v:Number(m[0])});i+=m[0].length;continue}
 m=source.slice(i).match(/^[a-zA-Z]+[0-9]*/);if(m){let name=m[0].toLowerCase();if(name==='pi'||FUNCTIONS.has(name)||functionNames.has(name)||/^[a-z]\d+$/.test(name))out.push({t:'name',v:name,raw:m[0]});else for(let j=0;j<name.length;j++)out.push({t:'name',v:name[j],raw:m[0][j]});i+=m[0].length;continue}
 if('+-*/^(),!'.includes(c)){out.push({t:c});i++;continue}throw Error('Unexpected character: '+c);
 }if(out.length>250)throw Error('Expression is too long');out.push({t:'end'});return out;
}
function parse(source){
 const tokens=tokenize(source);let pos=0;const take=()=>tokens[pos++]||{t:'end'},peek=()=>tokens[pos]?.t||'end';
 function expression(min=0){let token=take(),left;
 if(token.t==='number')left={type:'number',value:token.v};
 else if(token.t==='+'||token.t==='-')left={type:'unary',op:token.t,arg:expression(25)};
 else if(token.t==='('){left=expression();if(peek()===','){take();left={type:'point',coords:[left,expression()]}}if(take().t!==')')throw Error('Missing closing parenthesis')}
 else if(token.t==='name'){
 if(FUNCTIONS.has(token.v)||functionNames.has(token.v)){if(take().t!=='(')throw Error('Use '+token.v+'(...)');const args=[expression()];while(peek()===','){take();args.push(expression())}if(take().t!==')')throw Error('Missing closing parenthesis');if(!['min','max','hypot','mod','ncr','npr','log','nthrt','distance'].includes(token.v)&&args.length!==1)throw Error(token.v+' needs one argument');left={type:'call',name:token.v,args}}
 else left={type:'variable',name:token.v,raw:token.raw};
 }else throw Error('Enter a number or expression');
 while(true){const t=peek();if(t==='!'){if(40<min)break;take();left={type:'factorial',arg:left};continue}
 const implicit=t==='number'||t==='name'||t==='(';const op=implicit?'*':t;const prec={'+':10,'-':10,'*':20,'/':20,'^':30}[op];if(prec===undefined||prec<min)break;if(!implicit)take();left={type:'binary',op,left,right:expression(prec+(op==='^'?0:1))}}
 return left;
 }const ast=expression();if(peek()!=='end')throw Error('Check parentheses or operators');return ast;
}
function numeric(v){if(typeof v!=='number')throw Error('Use a number here; points can be used with distance');return v}
function evaluate(n,vars={},angle='rad'){
 if(n.type==='number')return n.value;
 if(n.type==='point')return n.coords.map(c=>numeric(evaluate(c,vars,angle)));
 if(n.type==='call'&&n.name==='distance'){const args=n.args.map(a=>a.type==='variable'&&Object.hasOwn(pointValues,a.raw||a.name)?pointValues[a.raw||a.name]:evaluate(a,vars,angle));if(args.length===2&&args.every(a=>Array.isArray(a)&&a.length===2))return Math.hypot(args[1][0]-args[0][0],args[1][1]-args[0][1]);if(args.length===4&&args.every(a=>typeof a==='number'))return Math.hypot(args[2]-args[0],args[3]-args[1]);throw Error('Use distance((x1,y1),(x2,y2)) or distance(A,B)')}
 if(n.type==='variable'){if(n.name==='pi')return Math.PI;if(n.name==='e')return Math.E;if(Object.hasOwn(vars,n.name))return vars[n.name];throw Error('Define '+n.name+' first, e.g. '+n.name+' = 2')}
 if(n.type==='unary')return(n.op==='-'?-1:1)*numeric(evaluate(n.arg,vars,angle));
 if(n.type==='factorial'){const v=evaluate(n.arg,vars,angle);if(!Number.isInteger(v)||v<0||v>170)return NaN;let r=1;for(let k=2;k<=v;k++)r*=k;return r}
 if(n.type==='binary'){let a=numeric(evaluate(n.left,vars,angle)),b=numeric(evaluate(n.right,vars,angle));switch(n.op){case '+':return a+b;case '-':return a-b;case '*':return a*b;case '/':return a/b;case '^':return Math.pow(a,b)}}
 const args=n.args.map(a=>numeric(evaluate(a,vars,angle)));
 if(n.name==='nthrt'){if(args.length!==2)throw Error('Use nthrt(value,index), e.g. nthrt(27,3)');const [value,index]=args;if(!Number.isFinite(index)||index===0)return NaN;if(value<0)return Number.isInteger(index)&&Math.abs(index%2)===1?-Math.pow(-value,1/index):NaN;return Math.pow(value,1/index)}
 if(['mod','ncr','npr'].includes(n.name)&&args.length!==2)throw Error(n.name+' needs two arguments');
 if(n.name==='log'&&(args.length<1||args.length>2))throw Error('log needs one or two arguments');
 if(n.name==='mod')return ((args[0]%args[1])+args[1])%args[1];
 if(n.name==='ncr'||n.name==='npr'){let [a,b]=args;if(!Number.isInteger(a)||!Number.isInteger(b)||a<0||b<0||b>a||a>10000)return NaN;if(n.name==='ncr')b=Math.min(b,a-b);let result=1;for(let i=0;i<b;i++)result*=n.name==='ncr'?(a-i)/(i+1):a-i;return result}
 let v=args[0],factor=angle==='deg'?Math.PI/180:1;
 if(functionNames.has(n.name)){const f=userFunctions[n.name];if(!f)throw Error('Invalid function '+n.name);if(callDepth>=20)throw Error('Recursive functions are not supported');callDepth++;try{return evaluate(f.ast,{...vars,[f.parameter]:v},angle)}finally{callDepth--}}
 if(['sin','cos','tan'].includes(n.name))return Math[n.name](v*factor);
 if(['asin','acos','atan'].includes(n.name))return Math[n.name](v)/factor;
 if(n.name==='ln')return Math.log(v);if(n.name==='log')return args.length===2?(args[1]>0&&args[1]!==1?Math.log(v)/Math.log(args[1]):NaN):Math.log10(v);return Math[n.name](...args);
}
function hasVariable(n,name){return n.type==='variable'?n.name===name:Object.values(n).some(v=>v&&typeof v==='object'&&(Array.isArray(v)?v.some(a=>hasVariable(a,name)):hasVariable(v,name)))}
function namesIn(ast,names=new Set(),seen=new Set()){
 if(ast.type==='variable'&&!Object.hasOwn(pointValues,ast.raw||ast.name))names.add(ast.name);
 if(ast.type==='call'&&userFunctions[ast.name]){if(seen.has(ast.name))throw Error('Recursive functions are not supported');const next=new Set(seen);next.add(ast.name);const f=userFunctions[ast.name];const inside=namesIn(f.ast,new Set(),next);inside.delete(f.parameter);inside.forEach(n=>names.add(n))}
 for(const v of Object.values(ast))if(v&&typeof v==='object'){if(Array.isArray(v))v.forEach(a=>namesIn(a,names,seen));else namesIn(v,names,seen)}return names;
}
function pointParts(text){
 let match=text.match(/^(?:([a-z]\d*)\s*(?:=\s*)?)?\((.*)\)$/i);if(!match)return null;
 let depth=0,comma=-1;for(let i=0;i<match[2].length;i++){const c=match[2][i];if(c==='(')depth++;if(c===')')depth--;if(c===','&&depth===0){if(comma!==-1)return null;comma=i}}if(comma<0)return null;
 return {name:match[1]||'',coords:[parse(match[2].slice(0,comma)),parse(match[2].slice(comma+1))]};
}
// QR least squares avoids squaring the condition number of the data matrix.
function leastSquares(matrix,target){
 const n=matrix[0].length,q=[],r=Array.from({length:n},()=>Array(n).fill(0));
 for(let j=0;j<n;j++){let v=matrix.map(row=>row[j]);const original=Math.hypot(...v);
 for(let k=0;k<j;k++){r[k][j]=v.reduce((s,x,i)=>s+x*q[k][i],0);v=v.map((x,i)=>x-r[k][j]*q[k][i])}
 r[j][j]=Math.hypot(...v);if(r[j][j]<=1e-10*Math.max(1,original))throw Error('Not enough independent data; use distinct x values');
 q[j]=v.map(x=>x/r[j][j])}
 const b=q.map(v=>v.reduce((s,x,i)=>s+x*target[i],0)),out=Array(n).fill(0);
 for(let j=n-1;j>=0;j--)out[j]=(b[j]-r[j].reduce((s,x,k)=>s+(k>j?x*out[k]:0),0))/r[j][j];return out;
}
function fitModel(ast,points,known,unit){
 const reserved=new Set(['x','x1','pi','e']);const parameters=[...namesIn(ast)].filter(n=>!reserved.has(n)&&!Object.hasOwn(known,n));
 if(parameters.some(n=>['y','y1','a1'].includes(n)))throw Error('Use x1 on the right side of a fit');
 if(parameters.length>6)throw Error('Use at most six fit parameters');
 if(points.length<Math.max(2,parameters.length))throw Error('Add more complete table rows for this fit');
 const zero=Object.fromEntries(parameters.map(n=>[n,0])),base=[],matrix=[],target=[];
 for(const p of points){const scope={...known,...zero,x:p.x,x1:p.x};const offset=evaluate(ast,scope,unit);const basis=parameters.map(n=>evaluate(ast,{...scope,[n]:1},unit)-offset);
 if(!Number.isFinite(offset)||basis.some(x=>!Number.isFinite(x)))throw Error('Model must be finite and linear in its fitted parameters');
 for(const t of [2,-.7]){const actual=evaluate(ast,{...scope,...Object.fromEntries(parameters.map((n,j)=>[n,t*(j+1)]))},unit),expected=offset+basis.reduce((s,b,j)=>s+b*t*(j+1),0);if(!Number.isFinite(actual)||Math.abs(actual-expected)>1e-7*Math.max(1,Math.abs(expected)))throw Error('Use a model linear in its parameters, e.g. m*x1+b or p*x1^2+q*x1+r')}
 base.push(offset);matrix.push(basis);target.push(p.y-offset)}
 const values=parameters.length?leastSquares(matrix,target):[],params=Object.fromEntries(parameters.map((n,i)=>[n,values[i]]));
 const fn=x=>evaluate(ast,{...known,...params,x,x1:x},unit),mean=points.reduce((s,p)=>s+p.y,0)/points.length;
 const sse=points.reduce((s,p)=>s+(p.y-fn(p.x))**2,0),sst=points.reduce((s,p)=>s+(p.y-mean)**2,0);
 return {params,fn,rmse:Math.sqrt(sse/points.length),r2:sst>1e-20?1-sse/sst:null};
}
const $=id=>document.getElementById(id),colors=['#c34257','#3579c8','#339480','#9961bd','#d28b2e','#446276'];
let rows=[{text:'y = a*x^2',visible:true},{text:'y = 2x + 3',visible:true},{text:'a = 1',visible:true}],view={x:0,y:0,scale:45},angle='rad',selected=0,compiled=[],variables={},trace=null,W=0,H=0;
let tableRows=[['-2',''],['-1',''],['0',''],['1',''],['2','']],tableFormula='',tablePoints=[],tableVisible=true,theme='light',keypadHidden=false,tableOpen=false;
try{const data=JSON.parse(localStorage.getItem('redbook-graph-v1'));if(data&&Array.isArray(data.rows)&&data.rows.length<=30&&data.rows.every(r=>typeof r.text==='string'&&r.text.length<=500)){rows=data.rows;angle=data.angle==='deg'?'deg':'rad';if(data.view&&[data.view.x,data.view.y,data.view.scale].every(Number.isFinite)&&data.view.scale>=.01&&data.view.scale<=1e6&&Math.abs(data.view.x)<=1e10&&Math.abs(data.view.y)<=1e10)view=data.view;if(Array.isArray(data.tableRows)&&data.tableRows.length<=100&&data.tableRows.every(r=>Array.isArray(r)&&r.length===2&&r.every(v=>typeof v==='string'&&v.length<=100)))tableRows=data.tableRows;tableFormula=typeof data.tableFormula==='string'?data.tableFormula.slice(0,500):'';theme=data.theme==='dark'?'dark':'light';keypadHidden=!!data.keypadHidden;tableOpen=!!data.tableOpen;tableVisible=data.tableVisible!==false}}catch{}
$('angle').value=angle;
function save(){try{localStorage.setItem('redbook-graph-v1',JSON.stringify({rows,view,angle,tableRows,tableFormula,tableVisible,theme,keypadHidden,tableOpen}));$('save-status').textContent='Saved on this device'}catch{$('save-status').textContent='Browser storage unavailable; keep this tab open'}}
function fmt(n){return Number.isFinite(n)?Number(n.toPrecision(7)).toString():'Undefined'}
function renderRows(){const list=$('expressions');list.replaceChildren();rows.forEach((r,i)=>{
 const row=document.createElement('div');row.className='expr';row.style.setProperty('--color',colors[i%colors.length]);
 row.innerHTML='<div class="entry"><button class="swatch" aria-label="Toggle expression visibility"></button><input class="expression" spellcheck="false" autocomplete="off"><button class="remove" aria-label="Delete expression">×</button></div><div class="result" aria-live="polite"></div>';
 const input=row.querySelector('input');input.value=r.text;input.maxLength=500;input.setAttribute('aria-label','Expression '+(i+1));input.onfocus=()=>selected=i;input.oninput=()=>{r.text=input.value;trace=null;recalculate();save()};input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();addRow()}};
 const toggle=row.querySelector('.swatch');toggle.setAttribute('aria-pressed',String(r.visible!==false));toggle.onclick=()=>{r.visible=r.visible===false;toggle.setAttribute('aria-pressed',String(r.visible));trace=null;recalculate();save()};
 row.querySelector('.remove').onclick=()=>{rows.splice(i,1);if(!rows.length)rows.push({text:'',visible:true});selected=Math.min(selected,rows.length-1);trace=null;renderRows();save()};
 list.append(row);
 });recalculate()}
function addRow(){if(rows.length>=30){$('save-status').textContent='Up to 30 expressions supported';return}rows.push({text:'',visible:true});selected=rows.length-1;renderRows();$('expressions').lastElementChild.querySelector('input').focus();save()}
function recalculate(){
 trace=null;variables={};pointValues=Object.create(null);userFunctions=Object.create(null);functionNames=new Set();
 const definitions=rows.map(r=>normalize(r.text.trim()).match(/^([a-z]\d*)\s*\(\s*([a-z])\s*\)\s*=\s*(.+)$/i)),definitionCounts={};
 definitions.forEach(m=>{if(m){const name=m[1].toLowerCase();functionNames.add(name);definitionCounts[name]=(definitionCounts[name]||0)+1}});
 compiled=rows.map((r,i)=>{try{const text=normalize(r.text.trim());if(!text)return {empty:true};if(text.toLowerCase()==='table')return {kind:'table',label:'Value table · x1 / y1'};
 const definition=definitions[i];if(definition){const name=definition[1].toLowerCase(),parameter=definition[2].toLowerCase();if(['x','y','e'].includes(name)||FUNCTIONS.has(name))throw Error('Choose a function name such as f or g');if(['e'].includes(parameter))throw Error('Choose a parameter such as x or t');if(definitionCounts[name]>1)throw Error('This function is defined more than once');const ast=parse(definition[3]);userFunctions[name]={ast,parameter};return {ast,kind:'definition',name,parameter}}
 if(text.includes('~')){const parts=text.split('~');if(parts.length!==2||!['y1','a1'].includes(parts[0].trim().toLowerCase()))throw Error('Fit table values with y1 ~ m*x1+b (a1 also works)');return {ast:parse(parts[1]),kind:'regression'}}
 const relation=text.match(/^(.+?)(<=|>=|≤|≥|<|>|=)(.+)$/);
 if(relation){const left=relation[1].trim().toLowerCase(),right=relation[3],op=relation[2].replace('≤','<=').replace('≥','>=');
 const direct=op==='='&&(/^[a-z]\d*$/.test(left))&&!(left==='x'&&/[xy]/.test(right))&&!(left==='y'&&/\by\b/.test(right));
 if(!direct){const ast={type:'binary',op:'-',left:parse(relation[1]),right:parse(right)};return {ast,kind:'relation',op}}}
 const point=pointParts(text);if(point)return {...point,kind:'point'};
 const parts=text.split('=');if(parts.length>2)throw Error('Use one equals sign');let lhs=parts.length===2?parts[0].trim().toLowerCase():null;const ast=parse(parts.at(-1));if(lhs&&!/^[a-z]\d*$/.test(lhs))throw Error('Use y = expression, f(x) = expression, or a = number');if(lhs&&['e','x1','y1','a1'].includes(lhs))throw Error(lhs+' is reserved');if(lhs&&functionNames.has(lhs))throw Error('This name is already a function');return {ast,lhs}
 }catch(e){return {error:e.message}}});
 const assignments=compiled.map((c,i)=>({c,i})).filter(({c})=>c.ast&&c.lhs&&!['x','y'].includes(c.lhs));
 const counts={};assignments.forEach(({c})=>counts[c.lhs]=(counts[c.lhs]||0)+1);
 function resolveAssignments(){for(let pass=0;pass<=assignments.length+compiled.filter(c=>c.kind==='point').length;pass++){for(const c of compiled.filter(c=>c.kind==='point'&&c.name)){try{const pair=c.coords.map(a=>numeric(evaluate(a,variables,angle)));if(pair.every(Number.isFinite))pointValues[c.name]=pair}catch{}}for(const {c} of assignments){if(counts[c.lhs]>1){c.error='This variable is defined more than once';continue}try{const n=evaluate(c.ast,variables,angle);if(!Number.isFinite(n))throw Error('Value is undefined');variables[c.lhs]=n;c.value=n;delete c.error}catch(e){c.error=e.message}}}}
 const showTable=hasTable();const panel=$('table-panel');if(showTable&&panel.hidden)panel.open=true;panel.hidden=!showTable;
 resolveAssignments();updateTable();
 const fitNames=new Set();
 for(const c of compiled.filter(c=>c.kind==='regression')){try{if(!hasTable())throw Error('Type table in an expression to enable table fitting');if([...namesIn(c.ast)].some(n=>fitNames.has(n)))throw Error('Use different parameter names for each fit');const fit=fitModel(c.ast,tablePoints,variables,angle);for(const name of Object.keys(fit.params)){if(fitNames.has(name)||counts[name])throw Error('Use different parameter names for each fit');fitNames.add(name)}Object.assign(variables,fit.params);c.kind='function';c.fn=fit.fn;c.fitted=true;c.label=Object.entries(fit.params).map(([n,v])=>n+' ≈ '+fmt(v)).join(' · ')+(Object.keys(fit.params).length?' · ':'Fixed model · ')+'RMSE '+fmt(fit.rmse)+(fit.r2===null?'':' · R² '+fmt(fit.r2))}catch(e){c.error=e.message}}
 resolveAssignments();
 compiled.forEach((c,i)=>{const el=$('expressions').children[i],result=el.querySelector('.result');let slider=el.querySelector('.slider');if(!c.error){try{
 if(c.kind==='relation'){namesIn(c.ast);evaluate(c.ast,{...variables,x:.123,y:.456},angle);c.field=(x,y)=>evaluate(c.ast,{...variables,x,y},angle);c.label=c.op==='='?'Implicit curve':'Shaded region · '+(c.op.length===1?'strict boundary':'inclusive boundary')}
 else if(c.kind==='point'){c.x=evaluate(c.coords[0],variables,angle);c.y=evaluate(c.coords[1],variables,angle);if(!Number.isFinite(c.x)||!Number.isFinite(c.y))throw Error('Point coordinates must be finite');c.label=(c.name?c.name+' = ':'')+'('+fmt(c.x)+', '+fmt(c.y)+')'}
 else if(c.kind==='definition'){namesIn(c.ast);evaluate(c.ast,{...variables,[c.parameter]:.123},angle);c.fn=x=>evaluate(c.ast,{...variables,[c.parameter]:x},angle);c.kind='function';c.label=c.name+'('+c.parameter+') · try '+c.name+'(2)'}
 else if(c.fitted||c.empty||c.kind==='table'){}
 else if(c.lhs&&!['x','y'].includes(c.lhs)){c.kind='variable';c.label=c.lhs+' = '+fmt(c.value)}
 else if(c.lhs==='x'){c.value=evaluate(c.ast,variables,angle);if(!Number.isFinite(c.value))throw Error('Value is undefined');c.kind='vertical';c.label='Vertical line'}
 else if(c.lhs==='y'||hasVariable(c.ast,'x')){evaluate(c.ast,{...variables,x:.123},angle);c.kind='function';c.fn=x=>evaluate(c.ast,{...variables,x},angle);c.label=''}
 else{c.value=evaluate(c.ast,variables,angle);c.kind='constant';c.label='= '+fmt(c.value)}}catch(e){c.error=e.message}}
 result.textContent=c.error||c.label||'';result.classList.toggle('error',!!c.error);
 const literal=c.kind==='variable'&&!c.error&&/^\s*[a-z]\d*\s*=\s*[+-]?(?:\d+\.?\d*|\.\d+)\s*$/i.test(rows[i].text);
 if(literal){if(!slider){slider=document.createElement('input');slider.type='range';slider.className='slider';slider.step='.1';el.append(slider);slider.oninput=()=>{rows[i].text=c.lhs+' = '+slider.value;el.querySelector('.expression').value=rows[i].text;trace=null;recalculate();save()}}slider.min=Math.min(-10,Math.floor(c.value));slider.max=Math.max(10,Math.ceil(c.value));slider.value=c.value;slider.setAttribute('aria-label',c.lhs+' value')}else slider?.remove();
 });draw();
}
function hasTable(){return rows.some(r=>r.text.trim().toLowerCase()==='table')}
function renderTable(){
 $('table-body').replaceChildren();tableRows.forEach((values,i)=>{const tr=document.createElement('tr');
 values.forEach((v,j)=>{const td=document.createElement('td'),input=document.createElement('input');input.value=v;input.maxLength=100;input.setAttribute('aria-label',(j?'y1':'x1')+' row '+(i+1));input.onfocus=()=>lastTableInput=input;input.oninput=()=>{tableRows[i][j]=input.value;recalculate();save()};td.append(input);tr.append(td)});
 const td=document.createElement('td'),remove=document.createElement('button');remove.textContent='×';remove.setAttribute('aria-label','Delete table row '+(i+1));remove.onclick=()=>{tableRows.splice(i,1);renderTable();recalculate();save()};td.append(remove);tr.append(td);$('table-body').append(tr)});
}
function updateTable(){
 tablePoints=[];let issues=0,formulaAst;
 try{if(tableFormula.trim())formulaAst=parse(tableFormula)}catch(e){for(const input of $('table-body').querySelectorAll('tr td:nth-child(2) input')){input.readOnly=true;input.value='Invalid formula';input.setAttribute('aria-invalid','true')}$('table-message').textContent=e.message;return}
 tableRows.forEach((values,i)=>{const inputs=$('table-body').children[i]?.querySelectorAll('input');if(!inputs)return;inputs[1].readOnly=!!formulaAst;inputs[0].removeAttribute('aria-invalid');inputs[1].removeAttribute('aria-invalid');
 if(!values[0].trim()){if(formulaAst)inputs[1].value='';return}
 try{const x=evaluate(parse(values[0]),variables,angle);if(!Number.isFinite(x))throw Error('Invalid x');let y;if(formulaAst){y=evaluate(formulaAst,{...variables,x,x1:x},angle);inputs[1].value=fmt(y)}else{inputs[1].value=values[1];if(!values[1].trim())return;y=evaluate(parse(values[1]),variables,angle)}if(!Number.isFinite(y))throw Error('Undefined table value');tablePoints.push({x,y,label:'Table row '+(i+1)})}
 catch{issues++;inputs[formulaAst?1:!values[0].trim()?0:1].setAttribute('aria-invalid','true');if(formulaAst)inputs[1].value='Undefined'}});
 $('table-message').textContent=tablePoints.length+' points'+(issues?' · '+issues+' invalid row(s); excluded from fits':'');
}
const canvas=$('canvas'),ctx=canvas.getContext('2d');
function sx(x){return W/2+(x-view.x)*view.scale}function sy(y){return H/2-(y-view.y)*view.scale}function wx(x){return view.x+(x-W/2)/view.scale}function wy(y){return view.y-(y-H/2)/view.scale}
function niceStep(raw){const base=10**Math.floor(Math.log10(raw));return [1,2,5,10].find(n=>n*base>=raw)*base}
function draw(){if(!W||!H)return;const palette=getComputedStyle(document.documentElement),paint=n=>palette.getPropertyValue(n).trim();ctx.clearRect(0,0,W,H);ctx.fillStyle=paint('--surface');ctx.fillRect(0,0,W,H);const step=niceStep(75/view.scale),minor=step/5;
 function grid(gap,color){ctx.strokeStyle=color;ctx.lineWidth=1;ctx.beginPath();for(let k=0,x0=Math.ceil(wx(0)/gap)*gap;k<=Math.ceil(W/view.scale/gap)+1;k++){const x=x0+k*gap;if(x>wx(W))break;ctx.moveTo(sx(x),0);ctx.lineTo(sx(x),H)}for(let k=0,y0=Math.ceil(wy(H)/gap)*gap;k<=Math.ceil(H/view.scale/gap)+1;k++){const y=y0+k*gap;if(y>wy(0))break;ctx.moveTo(0,sy(y));ctx.lineTo(W,sy(y))}ctx.stroke()}
 grid(minor,paint('--minor-grid'));grid(step,paint('--major-grid'));
 ctx.strokeStyle=paint('--axis');ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(sx(0),0);ctx.lineTo(sx(0),H);ctx.moveTo(0,sy(0));ctx.lineTo(W,sy(0));ctx.stroke();
 ctx.font='11px Segoe UI, sans-serif';ctx.fillStyle=paint('--muted');ctx.textAlign='center';
 for(let x=Math.ceil(wx(0)/step)*step;x<=wx(W);x+=step)if(Math.abs(x)>step/100)ctx.fillText(fmt(x),sx(x),Math.max(15,Math.min(H-8,sy(0)+17)));
 ctx.textAlign='right';for(let y=Math.ceil(wy(H)/step)*step;y<=wy(0);y+=step)if(Math.abs(y)>step/100)ctx.fillText(fmt(y),Math.max(36,Math.min(W-8,sx(0)-9)),sy(y)+4);
 compiled.forEach((c,i)=>{if(c.error||rows[i].visible===false)return;ctx.strokeStyle=colors[i%colors.length];ctx.lineWidth=2.3;ctx.lineJoin='round';ctx.beginPath();
 if(c.kind==='relation'){drawRelation(c,colors[i%colors.length]);return}
 if(c.kind==='vertical'){ctx.moveTo(sx(c.value),0);ctx.lineTo(sx(c.value),H)}
 if(c.kind==='function'){let previous=null;for(let px=0;px<=W;px+=1){const x=wx(px),y=c.fn(x),py=sy(y);if(!Number.isFinite(py)||Math.abs(py)>H*10){previous=null;continue}if(previous){const mid=sy(c.fn(wx(px-.5)));if(Number.isFinite(mid)&&Math.abs(mid-(previous.py+py)/2)<Math.max(3,H*.03)&&Math.abs(py-previous.py)<H*1.5)ctx.lineTo(px,py);else ctx.moveTo(px,py)}else ctx.moveTo(px,py);previous={py}}}ctx.stroke();
 if(c.kind==='point')drawPoint(c.x,c.y,colors[i%colors.length],c.name);
 });
 if(tableVisible&&hasTable())tablePoints.forEach(p=>drawPoint(p.x,p.y,theme==='dark'?'#e3b86c':'#9d6a1d',''));
 if(trace){ctx.fillStyle=trace.color;ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(sx(trace.x),sy(trace.y),5,0,Math.PI*2);ctx.fill();ctx.stroke()}
}
function drawPoint(x,y,color,label){const px=sx(x),py=sy(y);if(px<-10||px>W+10||py<-10||py>H+10)return;ctx.beginPath();ctx.arc(px,py,5,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();ctx.lineWidth=1.5;ctx.strokeStyle=theme==='dark'?'#19202c':'#fff';ctx.stroke();if(label){ctx.font='13px Segoe UI, sans-serif';ctx.textAlign='left';ctx.fillText(label,px+9,py-9)}}
function resize(){const box=canvas.getBoundingClientRect();W=box.width;H=box.height;const dpr=window.devicePixelRatio||1;canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);draw()}
new ResizeObserver(resize).observe(canvas);
function zoom(factor,px=W/2,py=H/2){const x=wx(px),y=wy(py);view.scale=Math.max(.01,Math.min(1e6,view.scale*factor));view.x=x-(px-W/2)/view.scale;view.y=y+(py-H/2)/view.scale;draw();save()}
function home(){$('graph-status').textContent='Drag to pan · Scroll to zoom';view={x:0,y:0,scale:Math.min(W,H)/20};trace=null;draw();save()}
canvas.addEventListener('wheel',e=>{e.preventDefault();const b=canvas.getBoundingClientRect();zoom(Math.exp(-Math.max(-100,Math.min(100,e.deltaY))*.002),e.clientX-b.left,e.clientY-b.top)},{passive:false});
let drag=null;
canvas.onpointerdown=e=>{canvas.focus();canvas.setPointerCapture(e.pointerId);drag={id:e.pointerId,x:e.clientX,y:e.clientY,vx:view.x,vy:view.y,moved:false};$('tooltip').style.display='none'};
canvas.onpointermove=e=>{if(drag&&drag.id===e.pointerId){const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.moved ||= Math.hypot(dx,dy)>4;view.x=drag.vx-dx/view.scale;view.y=drag.vy+dy/view.scale;draw()}};
canvas.onpointerup=e=>{if(!drag||drag.id!==e.pointerId)return;const moved=drag.moved;drag=null;if(!moved){const b=canvas.getBoundingClientRect();traceAt(e.clientX-b.left,e.clientY-b.top)}save()};
canvas.onpointercancel=()=>{drag=null};
function traceAt(px,py){const x=wx(px),y=wy(py);let best=null;
 compiled.forEach((c,i)=>{if(c.error||rows[i].visible===false)return;let tx=x,ty;if(c.kind==='function')ty=c.fn(x);else if(c.kind==='vertical'){tx=c.value;ty=y}else if(c.kind==='point'){tx=c.x;ty=c.y}else return;const d=Math.hypot(sx(tx)-px,sy(ty)-py);if(Number.isFinite(d)&&(!best||d<best.d))best={x:tx,y:ty,d,i,color:colors[i%colors.length],label:c.kind==='point'?(c.name||'Point'):null}});
 if(tableVisible&&hasTable())for(const p of tablePoints){const d=Math.hypot(sx(p.x)-px,sy(p.y)-py);if(!best||d<best.d)best={...p,d,i:-1,color:theme==='dark'?'#e3b86c':'#9d6a1d'}}
 if(!best||best.d>35){trace=null;$('graph-status').textContent='x = '+fmt(x)+' · y = '+fmt(y);draw();return}
 let label=best.label||'Trace';const a=compiled[best.i];
 if(!a||a.kind==='point'){trace=best;$('graph-status').textContent=label+' ('+fmt(best.x)+', '+fmt(best.y)+')';draw();return}
 compiled.forEach((b,j)=>{if(j===best.i||b.error||rows[j].visible===false||label==='Intersection ≈')return;let root;
 if(a.kind==='vertical'&&b.kind==='function')root=a.value;else if(a.kind==='function'&&b.kind==='vertical')root=b.value;
 else if(a.kind==='function'&&b.kind==='function'){root=best.x;for(let k=0;k<15;k++){const h=1e-5*Math.max(1,Math.abs(root)),f=a.fn(root)-b.fn(root),der=((a.fn(root+h)-b.fn(root+h))-(a.fn(root-h)-b.fn(root-h)))/(2*h);if(!Number.isFinite(der)||Math.abs(der)<1e-12)break;root-=f/der}if(!Number.isFinite(root)||Math.abs(a.fn(root)-b.fn(root))>1e-7)return}else return;
 const value=(a.kind==='function'?a:b).fn(root);if(Number.isFinite(value)&&Math.hypot(sx(root)-px,sy(value)-py)<22){best.x=root;best.y=value;label='Intersection ≈'}
 });trace=best;$('graph-status').textContent=label+' ('+fmt(best.x)+', '+fmt(best.y)+')';draw();
}
canvas.onkeydown=e=>{let handled=true;switch(e.key){case 'ArrowLeft':view.x-=40/view.scale;break;case 'ArrowRight':view.x+=40/view.scale;break;case 'ArrowUp':view.y+=40/view.scale;break;case 'ArrowDown':view.y-=40/view.scale;break;case '+':case '=':zoom(1.25);break;case '-':zoom(.8);break;case 'Home':home();break;default:handled=false}if(handled){e.preventDefault();draw();save()}};
$('add').onclick=addRow;$('zoom-in').onclick=()=>zoom(1.3);$('zoom-out').onclick=()=>zoom(1/1.3);$('home').onclick=home;
$('angle').onchange=e=>{angle=e.target.value;trace=null;recalculate();save()};
$('help').onclick=()=>$('help-dialog').showModal();$('close-help').onclick=()=>$('help-dialog').close();
let lastMathInput=null,lastTableInput=null;
document.addEventListener('focusin',e=>{if(e.target instanceof HTMLInputElement&&e.target.type==='text'&&!e.target.readOnly)lastMathInput=e.target});
const keyList=[['sin','sin('],['cos','cos('],['tan','tan('],['√','sqrt('],['x²','^2'],['ln','ln('],['log','log('],['(', '('],[')',')'],['^','^'],['7','7'],['8','8'],['9','9'],['÷','/'],['⌫','backspace'],['4','4'],['5','5'],['6','6'],['×','*'],['x','x'],['1','1'],['2','2'],['3','3'],['−','-'],['π','pi'],['0','0'],['.','.'],['=','='],['+','+'],['↵','enter'],[',',','],['~','~'],['f(x)','f(x)'],['x₁','x1'],['y₁','y1'],['√x','sqrt('],['ⁿ√x','nthrt('],['dist','distance('],['|x|','abs('],['|','|']];
keyList.forEach(([label,value],i)=>{const b=document.createElement('button');b.textContent=label;b.className=value==='enter'?'enter':i<10?'math':'';b.setAttribute('aria-label',value==='backspace'?'Backspace':value==='enter'?'Add expression':label);b.onpointerdown=e=>e.preventDefault();b.onclick=()=>{if(value==='enter'){addRow();return}const input=lastMathInput?.isConnected&&!lastMathInput.readOnly?lastMathInput:$('expressions').children[selected]?.querySelector('input');if(!input)return;input.focus();let start=input.selectionStart,end=input.selectionEnd;if(value==='backspace'){if(start===end)start=Math.max(0,start-1);input.setRangeText('',start,end,'end')}else input.setRangeText(value,start,end,'end');input.dispatchEvent(new Event('input',{bubbles:true}))};$('keys').append(b)});
$('export').onclick=()=>{const a=document.createElement('a');a.download='redbook-graph.png';a.href=canvas.toDataURL('image/png');a.click()};
function applyPreferences(){document.documentElement.dataset.theme=theme;$('theme').textContent=theme==='dark'?'Light mode':'Dark mode';$('theme').setAttribute('aria-pressed',String(theme==='dark'));$('keys').hidden=keypadHidden;$('keypad-toggle').textContent=keypadHidden?'Show keypad':'Hide keypad';$('keypad-toggle').setAttribute('aria-expanded',String(!keypadHidden));$('table-show').textContent=tableVisible?'Hide points':'Show points';$('table-show').setAttribute('aria-pressed',String(tableVisible))}
$('theme').onclick=()=>{theme=theme==='dark'?'light':'dark';applyPreferences();draw();save()};
$('keypad-toggle').onclick=()=>{keypadHidden=!keypadHidden;applyPreferences();save()};
$('table-panel').open=tableOpen;$('table-panel').ontoggle=()=>{tableOpen=$('table-panel').open;save()};
$('table-formula').value=tableFormula;$('table-formula').maxLength=500;
$('table-formula').oninput=e=>{tableFormula=e.target.value;recalculate();save()};
$('table-add').onclick=()=>{if(tableRows.length>=100){$('table-message').textContent='Maximum 100 table rows';return}tableRows.push(['','']);renderTable();recalculate();$('table-body').lastElementChild.querySelector('input').focus();save()};
$('table-show').onclick=()=>{tableVisible=!tableVisible;applyPreferences();draw();save()};
function addFit(text){if(rows.length>=30){$('save-status').textContent='Up to 30 expressions supported';return}rows.push({text,visible:true});selected=rows.length-1;renderRows();$('expressions').lastElementChild.scrollIntoView({block:'nearest'});save()}
$('fit-linear').onclick=()=>addFit('y1 ~ m*x1 + b');
$('fit-quadratic').onclick=()=>addFit('y1 ~ p*x1^2 + q*x1 + r');
// Embedded into the deliverable at build time; no external resources are required.
function drawRelation(c,color){
 const cell=9,cols=Math.ceil(W/cell),count=Math.ceil(H/cell),values=Array.from({length:count+1},(_,j)=>Array.from({length:cols+1},(_,i)=>c.field(wx(i*cell),wy(j*cell))));
 ctx.save();ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=1.8;
 if(c.op!=='='){ctx.globalAlpha=.1;for(let j=0;j<count;j++)for(let i=0;i<cols;i++){const v=c.field(wx((i+.5)*cell),wy((j+.5)*cell));if(Number.isFinite(v)&&(c.op.startsWith('<')?v<0:v>0))ctx.fillRect(i*cell,j*cell,cell,cell)}ctx.globalAlpha=1;if(c.op.length===1)ctx.setLineDash([5,4])}
 // Marching triangles makes ambiguous saddle cells deterministic.
 function triangle(p,v){if(v.some(n=>!Number.isFinite(n)))return;const hits=[];for(let k=0;k<3;k++){const n=(k+1)%3;if((v[k]<=0)!==(v[n]<=0)){const t=v[k]/(v[k]-v[n]);hits.push([p[k][0]+t*(p[n][0]-p[k][0]),p[k][1]+t*(p[n][1]-p[k][1])])}}if(hits.length===2){const mx=(hits[0][0]+hits[1][0])/2,my=(hits[0][1]+hits[1][1])/2,res=c.field(wx(mx),wy(my));const max=Math.max(...v.map(Math.abs));if(!Number.isFinite(res)||Math.abs(res)>max*.6)return;ctx.moveTo(...hits[0]);ctx.lineTo(...hits[1])}}
 ctx.beginPath();for(let j=0;j<count;j++)for(let i=0;i<cols;i++){const p=[[i*cell,j*cell],[(i+1)*cell,j*cell],[(i+1)*cell,(j+1)*cell],[i*cell,(j+1)*cell]],v=[values[j][i],values[j][i+1],values[j+1][i+1],values[j+1][i]];triangle([p[0],p[1],p[2]],[v[0],v[1],v[2]]);triangle([p[0],p[2],p[3]],[v[0],v[2],v[3]])}ctx.stroke();ctx.restore();
}
const studio=$('studio-dialog');
function openStudio(title,body){studio.replaceChildren();const h=document.createElement('h2');h.textContent=title;studio.append(h);const content=document.createElement('div');content.innerHTML=body;studio.append(content);const end=document.createElement('div');end.className='dialog-end';const close=document.createElement('button');close.textContent='Done';close.onclick=()=>studio.close();end.append(close);studio.append(end);studio.showModal();return content}
function downloadText(filename,text,type){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function snapshot(){return JSON.stringify({rows,tableRows,tableFormula,tableVisible,angle})}
let history=[snapshot()],historyIndex=0,lastEditAt=0,lastEditField=null;
const baseSave=save;
save=function(){const next=snapshot();if(history[historyIndex]!==next){const field=document.activeElement;const now=Date.now();if(field instanceof HTMLInputElement&&field===lastEditField&&now-lastEditAt<600&&historyIndex>0&&historyIndex===history.length-1)history[historyIndex]=next;else{history=history.slice(0,historyIndex+1);history.push(next);if(history.length>80)history.shift();historyIndex=history.length-1}lastEditAt=now;lastEditField=field}updateHistory();baseSave()};
function updateHistory(){$('undo').disabled=historyIndex===0;$('redo').disabled=historyIndex===history.length-1}
function restoreData(data){rows=data.rows.map(r=>({text:r.text,visible:r.visible!==false}));tableRows=data.tableRows.map(r=>[...r]);tableFormula=data.tableFormula;tableVisible=data.tableVisible;angle=data.angle;$('angle').value=angle;$('table-formula').value=tableFormula;selected=0;renderTable();renderRows();applyPreferences()}
function undoRedo(direction){if(historyIndex+direction<0||historyIndex+direction>=history.length)return;historyIndex+=direction;lastEditField=null;restoreData(JSON.parse(history[historyIndex]));updateHistory();baseSave()}
$('undo').onclick=()=>undoRedo(-1);$('redo').onclick=()=>undoRedo(1);
document.addEventListener('keydown',e=>{if(!(e.ctrlKey||e.metaKey)||e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement||studio.open)return;if(e.key.toLowerCase()==='z'){e.preventDefault();undoRedo(e.shiftKey?1:-1)}else if(e.key.toLowerCase()==='y'){e.preventDefault();undoRedo(1)}});
function validateWorkspace(data){
 if(!data||data.format!=='redbook-graph'||data.version!==1)throw Error('Choose a RedBook Graph workspace JSON file');
 if(!Array.isArray(data.rows)||!data.rows.length||data.rows.length>30||!data.rows.every(r=>r&&typeof r.text==='string'&&r.text.length<=500))throw Error('Invalid expression list');
 if(!Array.isArray(data.tableRows)||data.tableRows.length>100||!data.tableRows.every(r=>Array.isArray(r)&&r.length===2&&r.every(v=>typeof v==='string'&&v.length<=100)))throw Error('Invalid value table');
 if(typeof data.tableFormula!=='string'||data.tableFormula.length>500||!['rad','deg'].includes(data.angle))throw Error('Invalid calculator settings');
 if(data.view&&(![data.view.x,data.view.y,data.view.scale].every(Number.isFinite)||Math.abs(data.view.x)>1e10||Math.abs(data.view.y)>1e10||data.view.scale<.01||data.view.scale>1e6))throw Error('Invalid graph bounds');
 return data;
}
$('workspace-file').onclick=()=>{const content=openStudio('Keep your workspace','<p class="menu-note">Save expressions, table values, angle units, and graph view in a portable file. Opening a workspace replaces the current one; Undo restores your previous expressions and table.</p><button id="save-workspace" class="primary">Download workspace</button><label>Open workspace<input id="open-workspace" type="file" accept=".json,application/json"></label><p id="file-message" role="status" class="menu-note"></p>');
 content.querySelector('#save-workspace').onclick=()=>downloadText('redbook-workspace.json',JSON.stringify({format:'redbook-graph',version:1,...JSON.parse(snapshot()),view,theme,keypadHidden},null,2),'application/json');
 content.querySelector('#open-workspace').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>200000)throw Error('Workspace is too large');const data=validateWorkspace(JSON.parse(await file.text()));restoreData(data);if(data.view)view={...data.view};theme=data.theme==='dark'?'dark':'light';keypadHidden=!!data.keypadHidden;applyPreferences();draw();save();studio.close()}catch(error){content.querySelector('#file-message').textContent=error.message}};
};
function parseCSV(text){
 if(text.length>100000)throw Error('CSV is too large');const records=[];let record=[],value='',quoted=false;
 for(let i=0;i<=text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){value+='"';i++}else quoted=!quoted}else if(!quoted&&(c===','||c==='\n'||c===undefined)){record.push(value.trim());value='';if(c!==','){if(record.some(Boolean))records.push(record);record=[]}}else if(c!=='\r'&&c!==undefined)value+=c}
 if(quoted)throw Error('Unclosed CSV quotation');if(records.length&&/^(x|x1|x_1)$/i.test(records[0][0]))records.shift();if(!records.length||records.length>100)throw Error('Use 1–100 data rows');
 return records.map((r,i)=>{if(r.length!==2||r.some(v=>!v||!Number.isFinite(Number(v))))throw Error('Row '+(i+1)+' must contain two finite numbers');return r.map(v=>String(Number(v)))});
}
$('table-csv').onclick=()=>{const content=openStudio('Bring your data','<p class="menu-note">Paste two columns: x,y. An optional x,y header is supported. Importing replaces the table and clears the generator; Undo restores it.</p><label>CSV data<textarea id="csv-data" placeholder="x,y&#10;0,1&#10;1,3&#10;2,5"></textarea></label><div class="table-actions"><button id="csv-import" class="primary">Import data</button><button id="csv-export">Download CSV</button></div><p id="csv-message" role="status" class="menu-note"></p>');
 content.querySelector('#csv-import').onclick=()=>{try{tableRows=parseCSV(content.querySelector('textarea').value);tableFormula='';$('table-formula').value='';renderTable();recalculate();$('table-panel').open=true;save();studio.close()}catch(e){content.querySelector('#csv-message').textContent=e.message}};
 content.querySelector('#csv-export').onclick=()=>{if(!tablePoints.length){content.querySelector('#csv-message').textContent='Add valid table values first';return}downloadText('redbook-table.csv','x,y\n'+tablePoints.map(p=>p.x+','+p.y).join('\n'),'text/csv')};
};
function setBounds(xmin,xmax,ymin,ymax){if(![xmin,xmax,ymin,ymax].every(Number.isFinite)||xmin>=xmax||ymin>=ymax||Math.max(...[xmin,xmax,ymin,ymax].map(Math.abs))>1e10)throw Error('Enter increasing, finite bounds between −10 billion and 10 billion');const scale=Math.min(W/(xmax-xmin),H/(ymax-ymin));if(scale<.01||scale>1e6)throw Error('Choose a smaller or larger range');view={x:(xmin+xmax)/2,y:(ymin+ymax)/2,scale};trace=null;draw();save()}
$('graph-settings').onclick=()=>{const content=openStudio('Graph window','<p class="menu-note">Set visible bounds. Equal axis scaling may add space on one axis to keep circles round.</p><div class="sheet-grid"><label>x minimum<input id="xmin" type="number" step="any"></label><label>x maximum<input id="xmax" type="number" step="any"></label><label>y minimum<input id="ymin" type="number" step="any"></label><label>y maximum<input id="ymax" type="number" step="any"></label></div><button id="apply-bounds" class="primary">Apply window</button><p id="bounds-message" role="status" class="menu-note"></p>');const values={xmin:wx(0),xmax:wx(W),ymin:wy(H),ymax:wy(0)};Object.entries(values).forEach(([id,v])=>content.querySelector('#'+id).value=Number(v.toPrecision(8)));content.querySelector('#apply-bounds').onclick=()=>{try{setBounds(...['xmin','xmax','ymin','ymax'].map(id=>{const value=content.querySelector('#'+id).value;if(!value.trim())throw Error('Fill all bounds');return Number(value)}));studio.close()}catch(e){content.querySelector('#bounds-message').textContent=e.message}}};
$('fit-view').onclick=()=>{const points=tableVisible&&hasTable()?[...tablePoints]:[];compiled.forEach((c,i)=>{if(c.error||rows[i].visible===false)return;if(c.kind==='point')points.push({x:c.x,y:c.y});if(c.kind==='function')for(let k=0;k<=160;k++){const x=wx(W*k/160),y=c.fn(x);if(Number.isFinite(y)&&Math.abs(y)<1e9)points.push({x,y})}});if(!points.length){$('graph-status').textContent='Fit view needs points, table data, or explicit functions';return}const xs=points.map(p=>p.x),ys=points.map(p=>p.y),lo=Math.min(...xs),hi=Math.max(...xs),bottom=Math.min(...ys),top=Math.max(...ys),dx=Math.max(2,hi-lo)*.15,dy=Math.max(2,top-bottom)*.15;try{setBounds(lo-dx,hi+dx,bottom-dy,top+dy);$('graph-status').textContent='Fitted points and explicit curves in the current x range'}catch(e){$('graph-status').textContent=e.message}};
const exampleSets=[{name:'Parabola & slider',hint:'Change a and watch the curve move',rows:['f(x) = a*x^2','a = 1','A(2,4)']},{name:'Circle & region',hint:'Implicit curves and inequalities',rows:['x^2 + y^2 = 25','y >= x + 1']},{name:'Function family',hint:'Compose functions and calculate values',rows:['f(x) = sin(x)','g(x) = 2*f(x) + 1','g(pi/2)']},{name:'Fit the data',hint:'Estimate slope and intercept',rows:['y1 ~ m*x1+b','m*10+b','table'],table:[['0','1'],['1','3.1'],['2','4.9'],['3','7.1'],['4','9']]}];
$('examples').onclick=()=>{const content=openStudio('Start with an idea','<p class="menu-note">Load an example workspace. Undo restores your expressions and table.</p><div class="example-grid"></div>');exampleSets.forEach(example=>{const b=document.createElement('button'),strong=document.createElement('strong'),span=document.createElement('span');strong.textContent=example.name;span.textContent=example.hint;b.append(strong,span);b.onclick=()=>{rows=example.rows.map(text=>({text,visible:true}));if(example.table){tableRows=example.table.map(pair=>[...pair]);tableFormula='';$('table-formula').value='';renderTable();$('table-panel').open=true}else{tableRows=[['-2',''],['-1',''],['0',''],['1',''],['2','']];tableFormula='';$('table-formula').value='';renderTable()}angle='rad';$('angle').value=angle;selected=0;renderRows();$('table-panel').open=!!example.table;document.querySelector('.workspace-list').scrollTop=0;home();save();studio.close()};content.querySelector('.example-grid').append(b)})};
function analyzeFunction(fn,left,right){
 const roots=[],turning=[];const N=1200,step=(right-left)/N;
 function unique(list,x){if(Math.abs(x)<1e-10)x=0;if(Number.isFinite(x)&&!list.some(v=>Math.abs(v-x)<Math.max(1e-6,step*.1)))list.push(x)}
 function bisect(f,a,b){let fa=f(a);for(let k=0;k<55;k++){const mid=(a+b)/2,fm=f(mid);if(!Number.isFinite(fm))return NaN;if(Math.abs(fm)<1e-11)return mid;if((fa<0)===(fm<0)){a=mid;fa=fm}else b=mid}const x=(a+b)/2;return Math.abs(f(x))<1e-6?x:NaN}
 const derivative=x=>{const h=Math.max(1e-6,Math.abs(x)*1e-6,step*.001);return (fn(x+h)-fn(x-h))/(2*h)};
 let prev=fn(left),prevD=derivative(left);
 for(let i=1;i<=N;i++){const x=left+i*step,y=fn(x),d=derivative(x),previousX=x-step;if(Number.isFinite(prev)&&Number.isFinite(y)){if(Math.abs(prev)<1e-9)unique(roots,previousX);if((prev<0)!==(y<0))unique(roots,bisect(fn,previousX,x));if(i===N&&Math.abs(y)<1e-9)unique(roots,x)}if(Number.isFinite(prevD)&&Number.isFinite(d)&&(prevD<0)!==(d<0)){const t=bisect(derivative,previousX,x);if(Number.isFinite(t)&&Number.isFinite(fn(t))){unique(turning,t);if(Math.abs(fn(t))<1e-8)unique(roots,t)}}prev=y;prevD=d}
 return {roots:roots.sort((a,b)=>a-b).slice(0,40),turning:turning.sort((a,b)=>a-b).slice(0,40),intercept:fn(0)};
}
$('analyze').onclick=()=>{const candidates=compiled.map((c,i)=>({c,i})).filter(({c,i})=>c.kind==='function'&&!c.error&&rows[i].visible!==false);const content=openStudio('Explore a function','<p class="menu-note">Approximate roots and turning points in the current x window. Sampling may miss narrow features or rapid oscillations. Up to 40 results per kind are shown.</p><label>Function<select id="analysis-choice"></select></label><button id="analysis-run" class="primary">Find key points</button><div id="analysis-output" role="status"></div>');const select=content.querySelector('select');candidates.forEach(({i})=>{const option=document.createElement('option');option.value=i;option.textContent=rows[i].text;select.append(option)});const run=()=>{const output=content.querySelector('#analysis-output');output.replaceChildren();if(!candidates.length){output.textContent='Add a visible explicit function first, such as f(x)=x^2-4';return}const index=Number(select.value),c=compiled[index],result=analyzeFunction(c.fn,wx(0),wx(W)),ul=document.createElement('ul');ul.className='analysis-list';for(const text of ['Roots: '+(result.roots.map(fmt).join(', ')||'none detected'),'Turning points: '+(result.turning.map(x=>'('+fmt(x)+', '+fmt(c.fn(x))+')').join(', ')||'none detected'),'y-intercept: '+(Number.isFinite(result.intercept)?'(0, '+fmt(result.intercept)+')':'undefined')]){const li=document.createElement('li');li.textContent=text;ul.append(li)}output.append(ul)};content.querySelector('#analysis-run').onclick=run;run()};
// Two-finger pinch zoom; one finger still pans. Pointer capture keeps gestures on canvas.
const pointers=new Map();let pinch=null;
canvas.addEventListener('pointerdown',e=>{pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){drag=null;const [a,b]=[...pointers.values()],box=canvas.getBoundingClientRect(),mx=(a.x+b.x)/2-box.left,my=(a.y+b.y)/2-box.top;pinch={distance:Math.hypot(a.x-b.x,a.y-b.y),scale:view.scale,x:wx(mx),y:wy(my)}}});
canvas.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2&&pinch){drag=null;const [a,b]=[...pointers.values()],box=canvas.getBoundingClientRect(),mx=(a.x+b.x)/2-box.left,my=(a.y+b.y)/2-box.top;view.scale=Math.min(1e6,Math.max(.01,pinch.scale*Math.hypot(a.x-b.x,a.y-b.y)/Math.max(1,pinch.distance)));view.x=pinch.x-(mx-W/2)/view.scale;view.y=pinch.y+(my-H/2)/view.scale;draw()}});
for(const event of ['pointerup','pointercancel'])canvas.addEventListener(event,e=>{pointers.delete(e.pointerId);if(pointers.size<2)pinch=null;save()});
updateHistory();

applyPreferences();renderTable();renderRows();resize();

addEventListener('message',e=>{if(e.source!==parent||e.origin!==location.origin)return;if(e.data?.type==='redbook-graph-theme'){theme=e.data.theme==='dark'?'dark':'light';applyPreferences();draw()}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!document.querySelector('dialog[open]')){e.preventDefault();parent.postMessage({type:'redbook-graph-close'},location.origin)}});
