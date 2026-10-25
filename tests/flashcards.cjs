const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const sandbox={exports:{},atob};vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/study/flashcards.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,sandbox);
const {parseFlashDeck:parse,newWordSession:newSession,rateWord}=sandbox.exports;
const fixture=JSON.parse(fs.readFileSync('../windows-rust/frontend-rebuilt/samples/flashcards-starter.bbplus','utf8'));
const deck=parse(fixture);assert.equal(deck.cards.length,6);assert.equal(deck.cards[0].front,'Momentum');
for(const mutate of [p=>p.version=2,p=>p.type='practice',p=>p.cards=[],p=>p.cards[1].id=p.cards[0].id,p=>p.cards[0].front='',p=>p.cards[0].frontImage='https://example.com/image.png',p=>p.cards[0].backImage='data:image/svg+xml;base64,PHN2Zz4=']){const bad=structuredClone(fixture);mutate(bad);assert.throws(()=>parse(bad));}
const illustrated=structuredClone(fixture);illustrated.cards[0].front='';illustrated.cards[0].frontImage='data:image/png;base64,iVBORw0KGgo=';assert.ok(parse(illustrated).cards[0].frontImage);
let s=newSession(deck.cards);assert.equal(rateWord(s,true),s);s={...s,revealed:true};s=rateWord(s,false);assert.equal(s.index,1);assert.equal(s.answers.momentum,false);assert.equal(rateWord(s,true),s);
s={...s,revealed:true};s=rateWord(s,true);assert.equal(s.answers.concise,true);const missed=newSession(deck.cards,s.answers);assert.equal(missed.order.length,1);assert.equal(missed.order[0],'momentum');
while(s.index<s.order.length)s=rateWord({...s,revealed:true},true);assert.equal(s.index,6);assert.equal(rateWord({...s,revealed:true},true).index,6);
assert.equal(parse({...fixture,cards:[{id:'literal',front:'<script>alert(1)</script>',back:'literal text'}]}).cards[0].front,'<script>alert(1)</script>');
console.log('Flashcard compatibility, validation, images, recall gating, duplicate rating, completion, and learning-only review passed.');
