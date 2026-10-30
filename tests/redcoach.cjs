const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file);
  const exports = {};
  const context = {
    exports, process, console, crypto, AbortController, setTimeout, clearTimeout, Date,
    fetch: (...args) => global.fetch(...args),
    require: (name) => name === 'next/server' ? { NextResponse: { json: (data, init = {}) => ({ data, status: init.status || 200 }) } } : name.startsWith('.') ? load(path.resolve(path.dirname(file), name) + '.ts') : require(name),
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, context, { filename: file });
  cache.set(file, exports);
  return exports;
}
const { COACH_MODELS: models, resolveModel } = load('lib/redcoach-models.ts');
const { runCoach } = load('lib/redcoach-provider.ts');
const { cleanCoachText } = load('lib/redcoach-text.ts');
const keys = { gemini: 'google-test', groq: 'groq-test', mistral: 'mistral-test', gemma: 'google-test' };
const ok = (model, text = 'x = 5') => new Response(JSON.stringify({ model, choices: [{ message: { content: text } }] }));

test('legacy selections migrate to supported explicit IDs', () => {
  assert.equal(resolveModel('Groq · Llama 4 Maverick').id, 'openai/gpt-oss-120b');
  assert.equal(resolveModel('Gemma 3 27B').id, 'gemma-4-31b-it');
  assert.equal(resolveModel('unknown'), undefined);
});
for (const [http, status] of [[401, 'invalid_key'], [403, 'access_denied'], [429, 'rate_limited'], [404, 'model_unavailable'], [400, 'bad_request'], [503, 'upstream_error']]) {
  test(`${http} classified and backup identity is truthful`, async () => {
    let n = 0;
    const out = await runCoach(models[3], keys, [], 'Solve x', 'Coach', { fetcher: async () => ++n === 1 ? new Response('secret provider details', { status: http }) : ok('openai/gpt-oss-20b') });
    assert.equal(out.attempts[0].status, status);
    assert.equal(out.model, 'Groq · GPT-OSS 20B');
    assert.equal(out.modelId, 'openai/gpt-oss-20b');
    assert.equal(out.requestedModelId, 'mistral-large-latest');
    assert.equal(out.fallback, true);
    assert.ok(!JSON.stringify(out).includes('secret provider details'));
  });
}
test('Mistral text content blocks and resolved model version are retained', async () => {
  const out = await runCoach(models[3], keys, [], 'Hi', 'Coach', { fetcher: async () => ok('mistral-large-version', [{type: 'text', text: 'Answer'}, {type: 'other', text: 'ignore'}]) });
  assert.equal(out.text, 'Answer'); assert.equal(out.modelId, 'mistral-large-version'); assert.equal(out.fallback, false);
});
test('Gemini hides thought parts and uses key header, not URL', async () => {
  const out = await runCoach(models[0], keys, [], 'Hi', 'Coach', { fetcher: async (url, init) => {
    assert.ok(!url.includes(keys.gemini)); assert.equal(init.headers['x-goog-api-key'], keys.gemini);
    return new Response(JSON.stringify({modelVersion: 'gemini-3.8-flash-version', candidates:[{content:{parts:[{thought:true,text:'private thinking'},{text:'Answer'}]}}]}));
  }});
  assert.equal(out.text, 'Answer'); assert.equal(out.modelId, 'gemini-3.8-flash-version');
});
test('Gemma preserves history and does not use systemInstruction', async () => {
  const out = await runCoach(models[5], keys, [{role:'user',content:'Remember 17'}, {role:'assistant',content:'OK'}], 'What number?', 'Coach', {fetcher:async (url, init) => {
    const body = JSON.parse(init.body); assert.ok(url.includes('gemma-4-31b-it'));
    assert.equal(body.systemInstruction, undefined); assert.equal(body.contents.length, 3);
    assert.ok(body.contents[0].parts[0].text.includes('Remember 17'));
    return new Response(JSON.stringify({candidates:[{content:{parts:[{text:'17'}]}}]}));
  }}); assert.equal(out.text,'17');
});
test('unsupported Gemma provider key is not transmitted to Google', async () => {
  let calls = 0;
  const out = await runCoach(models[5], {...keys, gemma:'gsk_secret'}, [], 'Hi', 'Coach', {fetcher:async (url, init) => {
    calls++; assert.ok(url.includes('groq.com')); assert.ok(!JSON.stringify(init).includes('gsk_secret')); return ok('openai/gpt-oss-20b');
  }}); assert.equal(calls,1); assert.equal(out.attempts[0].status,'invalid_key');
});
test('a timed-out primary leaves time for backup', async () => {
  let n = 0;
  const out = await runCoach(models[3], keys, [], 'Hi', 'Coach', { totalMs: 500, attemptMs: 10, fetcher: async (_, init) => {
    if (++n === 2) return ok('openai/gpt-oss-20b');
    return new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted'))));
  }}); assert.equal(out.attempts[0].status, 'timeout'); assert.equal(out.fallback,true); assert.equal(n,2);
});
test('missing keys do not make outbound requests', async () => {
  const out = await runCoach(models[0], {gemini:'',groq:'',mistral:'',gemma:''}, [], 'Hi', 'Coach', {fetcher:async()=>{throw Error('must not fetch')}});
  assert.equal(out.attempts[0].status, 'missing_key'); assert.equal(out.text, undefined);
});
test('thought-only response is not shown to student', async () => {
  const out = await runCoach(models[0], {...keys,groq:'',mistral:'',gemma:''}, [], 'Hi', 'Coach', {fetcher:async()=>new Response(JSON.stringify({candidates:[{content:{parts:[{thought:true,text:'hidden'}]}}]}))});
  assert.equal(out.attempts[0].status, 'empty_response'); assert.equal(out.text, undefined);
});
test('plain text formatting removes bold/backticks and preserves currency and math', () => {
  assert.equal(cleanCoachText('## Answer\n**x = 5**\n* Check `3(5)+7=22`\nCost $5 and $10.'), 'Answer\nx = 5\n- Check 3(5)+7=22\nCost $5 and $10.');
  assert.equal(cleanCoachText('\\frac{1}{2} + x^2'), '(1)/(2) + x²');
});
test('route rejects malformed payloads and unknown models', async () => {
  const {POST} = load('app/api/chat/route.ts');
  for (const body of [null, [], {message:''}, {message:'Hi',model:'invented'}, {message:'Hi',history:{}}, {message:'Hi',apiKeys:{groq:42}}]) {
    const res = await POST({json:async()=>body}); assert.equal(res.status,400);
  }
});
test('configured does not claim healthy; all-provider failure returns non-200', async () => {
  const {GET, POST} = load('app/api/chat/route.ts');
  const get = await GET(); assert.equal(get.data.healthy, undefined);
  const original = global.fetch;
  global.fetch = async () => new Response('do not echo credentials', {status:401});
  try {
    const res = await POST({json:async()=>({message:'Hi',model:models[3].id,apiKeys:keys})});
    assert.equal(res.status,503); assert.equal(res.data.checks[0].status,'invalid_key');
    assert.ok(!JSON.stringify(res).includes('do not echo credentials'));
  } finally { global.fetch = original; }
});
test('known provider codes distinguish unavailable model from malformed request', async () => {
  for (const [error, expected] of [[{code:'model_decommissioned'}, 'model_unavailable'], [{details:[{reason:'API_KEY_INVALID'}]}, 'invalid_key']]) {
    const out = await runCoach(models[0], {...keys,groq:'',mistral:'',gemma:''}, [], 'Hi', 'Coach', {fetcher:async()=>new Response(JSON.stringify({error}),{status:400})});
    assert.equal(out.attempts[0].status, expected);
  }
});
test('route success exposes separate fallback notice and per-model checks', async () => {
  const {POST} = load('app/api/chat/route.ts');
  const original = global.fetch;
  let n = 0;
  global.fetch = async () => ++n === 1 ? new Response('', {status:429}) : ok('openai/gpt-oss-20b', '**x = 5**');
  try {
    const res = await POST({json:async()=>({message:'Hi',model:models[3].id,apiKeys:keys})});
    assert.equal(res.status,200); assert.equal(res.data.reply,'x = 5');
    assert.equal(res.data.fallback,true); assert.ok(res.data.notice.includes('Groq · GPT-OSS 20B'));
    assert.equal(res.data.checks[0].status,'rate_limited'); assert.equal(res.data.checks[1].status,'ok');
    assert.ok(res.data.checks[0].checkedAt);
  } finally { global.fetch = original; }
});
