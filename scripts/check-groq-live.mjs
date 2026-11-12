// Synthetic content only. No employee data or keys are printed.
const key=process.env.GROQ_API_KEY
if(!key)throw new Error('Set GROQ_API_KEY')
const model=process.env.GROQ_TEXT_MODEL||'qwen/qwen3.8-27b'
const response=await fetch('https://api.groq.com/openai/v1/chat/completions',{
 method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},signal:AbortSignal.timeout(20000),
 body:JSON.stringify({model,...(model.startsWith('qwen/')?{reasoning_format:'hidden',reasoning_effort:'none'}:{}),temperature:0,max_completion_tokens:3500,response_format:{type:'json_object'},messages:[{role:'system',content:'Catalog: [{"id":"catalog","name":"Каталог и данные"}]. Return JSON only: title (Russian, short precise subject), category (must be the catalog ID "catalog", the only supplied category), hasExistingProblem (boolean), description (detailed factual description), proposal (explicitly proposed solution only), sentiment (integer 0..10), tags (short topical strings). Preserve identifiers and never invent facts.'},{role:'user',content:'Синтетическая проверка. В каталоге SYN-001 и SYN001 обозначают один товар. Приходится сверять вручную. Предлагаю единый артикул.'}]})
})
if(!response.ok)throw new Error('Groq text HTTP '+response.status)
const data=await response.json(),choice=data.choices?.[0]
if(choice?.finish_reason!=='stop')throw new Error('Groq incomplete response')
const draft=JSON.parse(choice.message.content)
if(!draft.title||draft.category!=='catalog'||draft.hasExistingProblem!==true)throw new Error('Unexpected synthetic classification')
console.log('PASS live Groq text: '+model+', valid JSON, catalog classification and existing-problem detection')
// A short generated silent WAV verifies the HTTP transcription contract only.
// It does not measure recognition quality; human voice is a separate live step.
const samples=32000, audio=Buffer.alloc(44+samples*2)
audio.write('RIFF',0);audio.writeUInt32LE(audio.length-8,4);audio.write('WAVEfmt ',8);audio.writeUInt32LE(16,16);audio.writeUInt16LE(1,20);audio.writeUInt16LE(1,22);audio.writeUInt32LE(16000,24);audio.writeUInt32LE(32000,28);audio.writeUInt16LE(2,32);audio.writeUInt16LE(16,34);audio.write('data',36);audio.writeUInt32LE(samples*2,40)
const form=new FormData();form.set('file',new Blob([audio],{type:'audio/wav'}),'synthetic-silence.wav');form.set('model',process.env.GROQ_WHISPER_MODEL||'whisper-large-v3-turbo');form.set('response_format','json')
const speech=await fetch('https://api.groq.com/openai/v1/audio/transcriptions',{method:'POST',headers:{Authorization:'Bearer '+key},body:form,signal:AbortSignal.timeout(20000)})
if(!speech.ok)throw new Error('Groq speech HTTP '+speech.status)
const transcript=await speech.json()
if(typeof transcript.text!=='string')throw new Error('Invalid speech response shape')
console.log('PASS live Groq Whisper HTTP contract (synthetic silence only; human speech quality not tested)')
