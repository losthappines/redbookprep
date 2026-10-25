const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const source=fs.readFileSync('components/study/bbplus.ts','utf8');
const sandbox={exports:{},atob};
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,sandbox);
const parse=sandbox.exports.parseBbplus;
const pack=JSON.parse(fs.readFileSync('../windows-rust/frontend-rebuilt/samples/original-practice.bbplus','utf8'));
const rows=parse(pack,'sample');
assert.equal(rows.length,2);assert.equal(rows[0].section,'Reading and Writing');assert.equal(rows[1].answer,1);assert.notEqual(rows[0].moduleId,rows[1].moduleId);assert.equal(rows[0].options[0].letter,'A');
assert.equal(parse(pack,'sample')[0].id,rows[0].id);assert.notEqual(parse(pack,'other')[0].id,rows[0].id);
for(const mutate of [p=>p.version=2,p=>p.type='flashcards',p=>p.modules[0].questions[0].answer=8,p=>p.modules[0].questions[0].options=[],p=>p.modules[0].section='unknown',p=>p.modules[0].questions[0].prompt='',p=>p.modules=[]]){const bad=structuredClone(pack);mutate(bad);assert.throws(()=>parse(bad,'x'));}
const markup=structuredClone(pack);markup.modules[0].questions[0].prompt='<script>alert(1)</script>';assert.equal(parse(markup,'text')[0].prompt,'<script>alert(1)</script>');
console.log('bbplus parser: sample compatibility, stable IDs, module boundaries, validation, and literal text passed');

const image=structuredClone(pack);image.modules[0].questions[0].imageDataUrl='data:image/svg+xml;base64,PHN2Zz4=';assert.throws(()=>parse(image,'unsafe'));
image.modules[0].questions[0].imageDataUrl='data:image/png;base64,iVBORw0KGgo=';assert.ok(parse(image,'png')[0].imageDataUrl);
